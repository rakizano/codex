#!/usr/bin/env python3
"""Ambiance et bruitages 100 % procéduraux (aucun échantillon, aucun droit tiers).

Usage: sound.py <episode_dir>
Lit build/timeline.json ; écrit build/music_bed.wav, build/sfx.wav (44.1 kHz stéréo).
Nappe : accords lents (pad désaccordé filtré) + souffle vinyle + kick feutré.
SFX   : whoosh à chaque changement de scène, clic platine au début, impact doux sur la révélation.
"""
import json, os, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x):  # simple 1-pole, suffisant pour une nappe
        acc = (1 - a) * v + a * acc; y[i] = acc
    return y


def lp_fast(x, cutoff):
    # filtre 1 pôle vectorisé via FFT (réponse en fréquence équivalente)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), len(x))


def pad(dur, chords, bpm=72):
    n = int(dur * SR); t = np.arange(n) / SR; out = np.zeros(n)
    bar = 4 * 60 / bpm * 2  # 2 mesures par accord
    for k in range(int(dur / bar) + 1):
        ch = chords[k % len(chords)]; s = int(k * bar * SR); e = min(n, int((k + 1) * bar * SR) + SR)
        if s >= n: break
        tt = t[s:e] - t[s]; env = np.minimum(1, tt / 1.2) * np.minimum(1, np.maximum(0, (bar + 1 - tt)) / 1.2)
        seg = np.zeros(e - s)
        for m in ch:
            for det in (-0.08, 0.0, 0.08):
                ph = 2 * np.pi * note(m + det) * tt
                seg += (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph))
        out[s:e] += seg * env / (len(ch) * 3)
    return lp_fast(out, 1800)


def kick_pattern(dur, bpm=72):
    n = int(dur * SR); out = np.zeros(n); beat = 60 / bpm
    k_len = int(0.35 * SR); kt = np.arange(k_len) / SR
    kick = np.sin(2 * np.pi * (45 + 60 * np.exp(-kt * 25)) * kt) * np.exp(-kt * 9)
    t = 0.0
    while t < dur:
        s = int(t * SR); e = min(n, s + k_len); out[s:e] += kick[:e - s] * 0.5; t += beat * 2
    return out


def vinyl(dur):
    n = int(dur * SR); hiss = lp_fast(rng.normal(0, 1, n), 4000) * 0.015
    pops = np.zeros(n); idx = rng.integers(0, n, int(dur * 6)); pops[idx] = rng.uniform(0.1, 0.4, len(idx))
    return hiss + lp_fast(pops, 3000)


def whoosh(len_s=0.6):
    n = int(len_s * SR); t = np.arange(n) / SR; x = rng.normal(0, 1, n)
    env = np.sin(np.pi * t / len_s) ** 2
    # balayage : mélange progressif bas -> haut
    lo, hi = lp_fast(x, 600), lp_fast(x, 5000)
    return (lo * (1 - t / len_s) + hi * (t / len_s)) * env * 0.35


def click():
    n = int(0.08 * SR); t = np.arange(n) / SR
    return (rng.normal(0, 1, n) * np.exp(-t * 120) + np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 80)) * 0.4


def impact():
    n = int(1.2 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 55 * t) * np.exp(-t * 3) + lp_fast(rng.normal(0, 1, n), 300) * np.exp(-t * 6) * 0.5) * 0.6


def place(buf, snd, at):
    s = int(at * SR); e = min(len(buf), s + len(snd))
    if s < len(buf): buf[s:e] += snd[:e - s]


def write(path, mono_l, mono_r=None):
    r = mono_l if mono_r is None else mono_r
    st = np.stack([mono_l, r], 1); st = st / max(1e-9, np.abs(st).max()) * 0.89
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


def main():
    ep = sys.argv[1]; tl = json.load(open(os.path.join(ep, "build", "timeline.json")))
    dur = tl["duration"] + 3.0
    # Do mineur / La bémol / Mi bémol / Si bémol (couleur nocturne, pas un pastiche)
    chords = [[48, 55, 63, 67], [44, 51, 60, 63], [51, 58, 62, 67], [46, 53, 62, 65]]
    p = pad(dur, chords); k = kick_pattern(dur); v = vinyl(dur)
    fade = np.minimum(1, np.arange(len(p)) / SR / 2.0) * np.minimum(1, (len(p) / SR - np.arange(len(p)) / SR) / 2.5)
    left = (p + 0.6 * k + v) * fade
    right = (np.roll(p, int(0.012 * SR)) + 0.6 * k + np.roll(v, 999)) * fade
    write(os.path.join(ep, "build", "music_bed.wav"), left, right)

    sfx = np.zeros(int(dur * SR))
    place(sfx, click(), 0.05)
    for seg in tl["segments"][1:]:
        place(sfx, whoosh(), max(0, seg["start"] - 0.35))
        if seg["scene"] in ("FactReveal", "PoolDive"):
            place(sfx, impact(), seg["start"] + 0.2)
    write(os.path.join(ep, "build", "sfx.wav"), sfx)
    print(f"[sound] bed + sfx {dur:.1f}s")


if __name__ == "__main__":
    main()
