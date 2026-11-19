#!/usr/bin/env python3
"""Analyse audio OPTIONNELLE (si l'utilisateur fournit le fichier du morceau : mp3, m4a, wav…).
Dépendances : ffmpeg + numpy uniquement.

Produit <out>/audio.json :
  - duration            durée réelle du fichier (comparée à la version LRCLIB)
  - energy, energy_hop  courbe d'énergie RMS (pour choisir le passage le plus intense)
  - tempo_bpm, beats    pulsation estimée (pour caler coupes et pulsations du mot rouge)
  - novelty_peaks       ruptures musicales (changements d'instrumentation / sections)
  - lyrics_offset       (si --lyrics) décalage global estimé entre les timestamps LRC
                        et les attaques vocales (bande 300-3400 Hz) + indice de confiance

Usage :
  python3 audio_analyze.py <audio> --out <work> [--lyrics <work>/lyrics.json]
"""
import argparse
import json
import os
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 512


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def stft_mag(x, n=2048):
    win = np.hanning(n).astype(np.float32)
    frames = 1 + (len(x) - n) // HOP
    idx = np.arange(n)[None, :] + HOP * np.arange(frames)[:, None]
    out = np.empty((frames, n // 2 + 1), dtype=np.float32)
    for s in range(0, frames, 4096):  # par blocs pour limiter la mémoire
        out[s:s + 4096] = np.abs(np.fft.rfft(x[idx[s:s + 4096]] * win, axis=1))
    return out


def onset_env(mag, lo_hz=0, hi_hz=SR / 2):
    freqs = np.fft.rfftfreq(2048, 1 / SR)
    band = (freqs >= lo_hz) & (freqs <= hi_hz)
    m = np.log1p(mag[:, band] * 10)
    flux = np.maximum(0, np.diff(m, axis=0)).sum(1)
    flux = np.concatenate([[0], flux])
    flux -= np.convolve(flux, np.ones(16) / 16, mode='same')  # retirer la tendance locale
    return np.maximum(flux, 0) / (flux.max() + 1e-9)


def tempo_and_beats(env):
    fps = SR / HOP
    ac = np.correlate(env, env, mode='full')[len(env) - 1:]
    lags = np.arange(len(ac)) / fps
    valid = (lags >= 60 / 200) & (lags <= 60 / 60)
    w = np.exp(-0.5 * (np.log2(60 / np.maximum(lags, 1e-6) / 120)) ** 2)  # préférence ~120 BPM
    best = np.argmax(np.where(valid, ac * w, 0))
    period = best  # en frames
    bpm = 60 * fps / period
    # suivi de pulsation par programmation dynamique (Ellis 2007)
    N = len(env)
    score = env.copy()
    back = np.full(N, -1)
    for i in range(N):
        lo, hi = i - int(period * 2), i - int(period / 2)
        if lo < 0:
            continue
        cand = np.arange(lo, hi)
        pen = -100 * (np.log((i - cand) / period)) ** 2
        k = np.argmax(score[cand] + pen)
        score[i] += score[cand[k]] + pen[k]
        back[i] = cand[k]
    i = int(np.argmax(score[-int(period * 2):]) + N - int(period * 2))
    beats = []
    while i >= 0:
        beats.append(i)
        i = back[i]
    return float(bpm), [round(b / fps, 3) for b in reversed(beats)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('--out', required=True)
    ap.add_argument('--lyrics')
    a = ap.parse_args()
    x = decode(a.audio)
    dur = len(x) / SR
    mag = stft_mag(x)
    fps = SR / HOP
    rms = np.sqrt(np.convolve(x.astype(np.float64) ** 2, np.ones(2205) / 2205, mode='same'))[::2205]  # pas de 0.1 s
    energy = (rms / (rms.max() + 1e-9)).round(4).tolist()
    env = onset_env(mag)
    bpm, beats = tempo_and_beats(env)
    # nouveauté : distance entre moyennes spectrales avant/après (fenêtre 4 s)
    chroma = np.log1p(mag[:, :256])
    k = int(4 * fps)
    cs = np.cumsum(np.vstack([np.zeros((1, chroma.shape[1])), chroma]), axis=0)
    nov = np.zeros(len(chroma))
    for i in range(k, len(chroma) - k):
        a1 = (cs[i] - cs[i - k]) / k
        a2 = (cs[i + k] - cs[i]) / k
        nov[i] = np.linalg.norm(a2 - a1)
    peaks = []
    for i in range(1, len(nov) - 1):
        if nov[i] == nov[max(0, i - k):i + k].max() and nov[i] > np.percentile(nov, 90):
            peaks.append(round(i / fps, 2))
    out = {'file': os.path.basename(a.audio), 'duration': round(dur, 3), 'energy_hop': 0.1, 'energy': energy,
           'tempo_bpm': round(bpm, 2), 'beats': beats, 'novelty_peaks': peaks}
    if a.lyrics:
        L = json.load(open(a.lyrics))
        out['lyrics_duration_diff_s'] = round(dur - L['duration'], 3)
        venv = onset_env(mag, 300, 3400)
        starts = [l['t'] for l in L['lines'] if l['text'].strip()]
        offs = np.arange(-2.0, 2.0001, 0.02)

        def sc(o):
            vals = []
            for t in starts:
                i0 = int((t + o) * fps)
                if 0 <= i0 < len(venv) - 4:
                    vals.append(venv[i0:i0 + 4].max())
            return float(np.mean(vals)) if vals else 0

        scores = np.array([sc(o) for o in offs])
        b = int(np.argmax(scores))
        z = (scores[b] - scores.mean()) / (scores.std() + 1e-9)
        out['lyrics_offset'] = {'best_offset_s': round(float(offs[b]), 2), 'peak_z': round(float(z), 2),
                                'interpretation': ('décalage net détecté' if z > 3 else 'pas de décalage net (pic faible)'),
                                'note': 'Heuristique : corrélation entre débuts de lignes LRC et attaques en bande vocale. '
                                        "Un décalage n'est appliqué que si |offset| > 0.15 s ET peak_z > 3."}
    json.dump(out, open(os.path.join(a.out, 'audio.json'), 'w'))
    s = {k: v for k, v in out.items() if k not in ('energy', 'beats')}
    s['n_beats'] = len(beats)
    print(json.dumps(s, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    sys.exit(main())
