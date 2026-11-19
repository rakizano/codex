#!/usr/bin/env python3
"""Instrumentale ORIGINALE calée sur un clip (même grille que video/src/clip : BPM, offset, mesures par scène).

Usage: clip_score.py <sortie.wav> [--bpm 74 --offset 0.5 --plan "intro:2,salon:4,refrain:4,pression:4,eau:3,aube:3"]
Arrangement par scène (aucune imitation du morceau d'origine, uniquement des sons procéduraux) :
  intro    : piano électrique filtré + vinyle, kick discret
  salon    : groove chaleureux (kick/snare/hats), basse
  refrain  : tout le kit + crash à chaque mesure + éclaboussures sur les temps forts
  pression : hats doublés, snare plus forte, montée en fin de scène
  eau      : tout passe « sous l'eau » (filtre grave), bulles, pas de batterie
  aube     : piano seul qui s'ouvre, fondu final
Chaque changement de scène : roulement de caisse claire + cymbale (raccord).
"""
import argparse, os, sys, wave
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sound as S  # instruments procéduraux du pipeline

ap = argparse.ArgumentParser()
ap.add_argument("out"); ap.add_argument("--bpm", type=float, default=74); ap.add_argument("--offset", type=float, default=0.5)
ap.add_argument("--plan", default="intro:2,salon:4,refrain:4,pression:4,eau:3,aube:3")
a = ap.parse_args()
SR = S.SR; beat = 60 / a.bpm; bar = 4 * beat
plan = [(p.split(":")[0], int(p.split(":")[1])) for p in a.plan.split(",")]
total_bars = sum(b for _, b in plan)
dur = a.offset + total_bars * bar + 2.0
n = int(dur * SR)
keysL, keysR, drums, bass, fx = (np.zeros(n) for _ in range(5))
root = 49  # do#, couleur sombre (choix original)
prog = [[0, 3, 7, 10, 14], [-4, 0, 3, 7, 10], [-7, -3, 0, 3, 7], [-2, 2, 5, 9, 12]]

bi = 0; t_scene = a.offset; cuts = []
for name, nb in plan:
    for k in range(nb):
        t0 = a.offset + bi * bar; ch = prog[bi % len(prog)]; last = k == nb - 1
        vel = {"intro": .35, "salon": .5, "refrain": .55, "pression": .45, "eau": .3, "aube": .4}[name]
        for j, iv in enumerate(ch):
            x = S.epiano(root + 12 + iv, bar + 0.4, vel / len(ch) * 2.2)
            pan = j / (len(ch) - 1) * .6 + .2
            S.add(keysL, x, t0 + j * .008, 1 - pan); S.add(keysR, x, t0 + j * .008, pan)
        if name in ("salon", "refrain", "pression", "intro"):
            S.add(bass, S.sub(root - 12 + ch[0], beat * 1.6), t0, .9 if name != "intro" else .5)
            S.add(bass, S.sub(root - 12 + ch[0], beat * .8), t0 + 2.5 * beat, .7)
        if name in ("salon", "refrain", "pression"):
            for st in (0, 2.5): S.add(drums, S.kick(), t0 + st * beat, .95)
            for st in (1, 3): S.add(drums, S.snare(), t0 + st * beat, .8 if name != "pression" else 1.0)
            hats = 16 if name == "pression" else 8
            for h in range(hats):
                S.add(drums, S.hat(open_=(h == hats - 1 and k % 2)), t0 + h * (4 * beat / hats), .35 if h % 2 == 0 else .22)
        if name == "intro":
            S.add(drums, S.kick(), t0, .5); S.add(drums, S.kick(), t0 + 2 * beat, .4)
        if name == "refrain":
            S.add(drums, S.crash(), t0, .55)
            for st in (0, 2): S.add(fx, S.splash(), t0 + st * beat + .05, .35)
        if name == "pression" and last:
            S.add(fx, S.riser(), t0 + bar - 1.6, .8)
        if name == "eau":
            for j in range(6): S.add(fx, S.pop(), t0 + j * .55 + .1, .4)
        bi += 1
    t_scene += nb * bar; cuts.append(t_scene)

# raccords : roulement avant chaque coupe + cymbale dessus
for c in cuts[:-1]:
    S.add(drums, S.snare_roll(beat), c - beat, .7); S.add(drums, S.crash(), c, .7); S.add(fx, S.whoosh(), c - .4, .5)

keys = np.stack([keysL, keysR])
# sections filtrées : intro (s'ouvre), eau (sous l'eau)
def span(name):
    t = a.offset
    for nm, nb in plan:
        if nm == name: return int(t * SR), int((t + nb * bar) * SR)
        t += nb * bar
    return 0, 0
for name, fc in (("intro", 900), ("eau", 500)):
    s0, s1 = span(name)
    if s1 > s0:
        for c in range(2): keys[c, s0:s1] = S.lp(keys[c, s0:s1], fc) * 1.3
        bass[s0:s1] = S.lp(bass[s0:s1], 200)
v = S.vinyl(dur)
L = keys[0] * .8 + drums + bass + fx + v; R = keys[1] * .8 + drums + bass + fx + np.roll(v, 777)
tt = np.arange(n) / SR
fade = np.minimum(1, tt / .8) * np.minimum(1, (dur - tt) / 2.5)
st = np.stack([L * fade, R * fade]); st = st / np.abs(st).max() * .89
with wave.open(a.out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st.T * 32767).astype("<i2").tobytes())
print(f"[clip-score] {a.out} — {a.bpm} BPM, {total_bars} mesures, coupes à {[round(c, 2) for c in cuts[:-1]]}")
