#!/usr/bin/env python3
"""AudioAnalyzer — analyse locale d'un son (numpy + ffmpeg), déterministe.

  python3 tools/audio_analyzer.py assets/audio/sound.m4a --out config/audio.json [--hf]

Produit, en secondes depuis le début du son :
  bpm, beats (grille ancrée sur les kicks), kicks (40–150 Hz), snares (1,5–5 kHz, attaque large bande),
  bass (énergie 40–200 Hz lissée, 10 valeurs/s), onsets (transitoires toutes bandes), silences (RMS < seuil ≥ 0,25 s),
  rises (montées : pente d'énergie positive sur ≥ 1,2 s), sections (changements d'intensité), duration.
--hf : ajoute la sortie de `npx hyperframes audio … --only sections,onsets,moments --json` si la commande répond
(analyse officielle HyperFrames) dans `hyperframes_audio`.
"""
import argparse
import json
import os
import subprocess

import numpy as np

SR = 22050
HOP = 512


def load(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


def stft_bands(x):
    win = np.hanning(2048).astype(np.float32)
    n = 1 + (len(x) - 2048) // HOP
    frames = np.lib.stride_tricks.as_strided(x, shape=(n, 2048), strides=(x.strides[0] * HOP, x.strides[0]))
    S = np.abs(np.fft.rfft(frames * win, axis=1))
    f = np.fft.rfftfreq(2048, 1 / SR)
    band = lambda lo, hi: S[:, (f >= lo) & (f < hi)].sum(axis=1)
    return S, f, {'kick': band(40, 150), 'bass': band(40, 200), 'snare': band(1500, 5000), 'hat': band(6000, 11000), 'all': S.sum(axis=1)}


def onset_env(e):
    d = np.diff(np.log1p(e * 10), prepend=np.log1p(e[0] * 10))
    d[d < 0] = 0
    return d


def peaks(env, min_gap_s=.12, k=1.6, strength=False):
    """pics au-dessus de médiane mobile + k·écart (seuil adaptatif), espacés d'au moins min_gap_s"""
    w = 43
    pad = np.pad(env, w, mode='edge')
    med = np.array([np.median(pad[i:i + 2 * w]) for i in range(len(env))])
    mad = np.array([np.median(np.abs(pad[i:i + 2 * w] - med[i])) for i in range(len(env))]) + 1e-6
    thr = med + k * 1.4826 * mad
    out, last = [], -1e9
    for i in range(1, len(env) - 1):
        if env[i] > thr[i] and env[i] >= env[i - 1] and env[i] >= env[i + 1]:
            t = i * HOP / SR
            if t - last >= min_gap_s:
                out.append((round(t, 3), float(env[i])) if strength else round(t, 3)); last = t
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('--out', required=True)
    ap.add_argument('--hf', action='store_true')
    ap.add_argument('--end', type=float, help='ignorer après cet instant (ex. fin de la musique avant un générique)')
    a = ap.parse_args()
    x = load(a.audio)
    if a.end:
        x = x[:int(a.end * SR)]
    dur = len(x) / SR
    S, f, B = stft_bands(x)
    fps = SR / HOP
    ks = peaks(onset_env(B['kick']), .24, 3.2, strength=True)
    kicks = [t for t, _ in ks]
    top = sorted(v for _, v in ks)[int(len(ks) * .7)] if ks else 0
    impacts = [t for t, v in ks if v >= top]          # les 30 % de kicks les plus forts : impacts musicaux
    snares = peaks(onset_env(B['snare']) * (onset_env(B['all']) > 0), .22, 3.4)
    onsets = peaks(onset_env(B['all']), .09, 1.4)
    # BPM par autocorrélation de l'enveloppe des transitoires (60–180)
    env = onset_env(B['all'])
    ac = np.correlate(env - env.mean(), env - env.mean(), 'full')[len(env) - 1:]
    lags = np.arange(len(ac)) / fps
    m = (lags > 60 / 180) & (lags < 60 / 60)
    period = lags[m][np.argmax(ac[m])]
    bpm = 60 / period
    while bpm < 80:
        bpm *= 2
    while bpm > 170:
        bpm /= 2
    period = 60 / bpm
    # grille de temps ancrée sur le kick le plus fort (phase qui maximise la coïncidence avec les kicks)
    best, phase = -1, 0
    for ph in np.linspace(0, period, 48, endpoint=False):
        grid = np.arange(ph, dur, period)
        sc = sum(np.min(np.abs(grid - k)) < .06 for k in kicks)
        if sc > best:
            best, phase = sc, ph
    beats = [round(float(t), 3) for t in np.arange(phase, dur, period)]
    # basse lissée (10 valeurs / s), RMS, silences, montées, sections
    rms = np.sqrt(np.convolve(x * x, np.ones(2205) / 2205, 'same'))[::2205]
    bass = B['bass'][::max(1, int(fps / 10))]
    bass = (bass / (bass.max() + 1e-9)).round(3).tolist()
    thr = max(.01, np.percentile(rms, 20) * .5)
    sil, start = [], None
    for i, v in enumerate(rms):
        t = i * .1
        if v < thr and start is None:
            start = t
        if (v >= thr or i == len(rms) - 1) and start is not None:
            if t - start >= .25:
                sil.append([round(start, 2), round(t, 2)])
            start = None
    sm = np.convolve(rms, np.ones(8) / 8, 'same')
    rises, i = [], 0
    while i < len(sm) - 12:
        j = i
        while j + 1 < len(sm) and sm[j + 1] > sm[j] * 1.005:
            j += 1
        if (j - i) * .1 >= 1.2 and sm[j] > sm[i] * 1.35:
            rises.append([round(i * .1, 2), round(j * .1, 2)])
        i = j + 1
    lvl = np.convolve(rms, np.ones(20) / 20, 'same')
    sections, last = [0.0], 0
    for k in range(20, len(lvl) - 20, 5):
        if abs(lvl[k + 10] - lvl[k - 10]) > .35 * (lvl.max() + 1e-9) and k * .1 - last > 3:
            sections.append(round(k * .1, 2)); last = k * .1
    out = {'file': os.path.basename(a.audio), 'duration': round(dur, 3), 'bpm': round(float(bpm), 2), 'beats': beats, 'kicks': kicks, 'impacts': impacts, 'snares': snares, 'onsets': onsets,
           'bass_10hz': bass, 'silences': sil, 'rises': rises, 'sections': sections}
    if a.hf:
        try:
            r = subprocess.run(['npx', '--yes', 'hyperframes@0.9.72', 'audio', a.audio, '--only', 'sections,onsets,moments', '--json'], capture_output=True, text=True, timeout=300,
                               env=dict(os.environ, DO_NOT_TRACK='1', HYPERFRAMES_NO_TELEMETRY='1', HYPERFRAMES_NO_UPDATE_CHECK='1'))
            s = r.stdout[r.stdout.find('{'):]
            out['hyperframes_audio'] = json.loads(s) if s else {'error': r.stderr[-400:]}
        except Exception as e:  # noqa: BLE001
            out['hyperframes_audio'] = {'error': str(e)}
    json.dump(out, open(a.out, 'w'), indent=1)
    print(json.dumps({k: (v if not isinstance(v, list) else f'{len(v)} valeurs') for k, v in out.items() if k != 'hyperframes_audio'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
