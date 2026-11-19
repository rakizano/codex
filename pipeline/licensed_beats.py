#!/usr/bin/env python3
"""Cale le montage sur les VRAIS temps d'un morceau sous licence (analyse locale video-gif-studio).

Usage: licensed_beats.py <episode_dir> <morceau_sous_licence.wav|mp3> [--bpm N --offset-ms N]
- Analyse le tempo avec .claude/skills/video-gif-studio/scripts/music_sync.py (local, gratuit).
- Réécrit build/beats.json : beats/cuts/énergie calés sur le morceau, + "licensed": chemin du fichier.
- Le mix est fait ensuite par `pipeline/mix.sh <episode> <morceau>` (ducking automatique).
À utiliser UNIQUEMENT avec un fichier dont tu détiens les droits. Vérifier le tempo à l'oreille :
l'analyse peut se tromper du simple au double (voir le skill).
"""
import json, os, shutil, subprocess, sys, tempfile

ep, song = sys.argv[1], sys.argv[2]
extra = sys.argv[3:]
here = os.path.dirname(os.path.abspath(__file__))
tool = os.path.join(here, "..", ".claude", "skills", "video-gif-studio", "scripts", "music_sync.py")
out = tempfile.mkdtemp(); shutil.rmtree(out)
subprocess.run([sys.executable, tool, song, "--out", out, *extra], check=True, stdout=subprocess.DEVNULL)
ana = json.load(open(os.path.join(out, "beats.json")))
beats = [round(b / 1000, 3) for b in ana["beats_ms"]]
tl = json.load(open(os.path.join(ep, "build", "timeline.json")))
vo = float(os.environ.get("VOICE_OFFSET", 0.6))
cuts = []
for s in tl["segments"][1:]:
    want = vo + s["start"] - 0.25
    cuts.append(min(beats, key=lambda b: abs(b - want)) if beats else want)
bj = os.path.join(ep, "build", "beats.json")
old = json.load(open(bj)) if os.path.exists(bj) else {}
old.update(bpm=ana.get("bpm"), beats=beats, energy=[1.0] * len(beats), cuts=cuts, licensed=os.path.abspath(song),
           review=ana.get("review"))
json.dump(old, open(bj, "w"))
print(f"[licence] {ana.get('bpm')} BPM détectés (à vérifier à l'oreille), {len(beats)} temps, coupes calées : {cuts}")
