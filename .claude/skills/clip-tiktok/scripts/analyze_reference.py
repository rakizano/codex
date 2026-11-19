#!/usr/bin/env python3
"""Analyse d'une vidéo de référence (à lancer quand l'utilisateur la fournit).

  python3 analyze_reference.py <video> --out <dossier>

Détecte les changements de plan (filtre scene de FFmpeg), calcule le rythme de montage
(durée moyenne/médiane des plans), extrait une image par plan + une planche contact
que Claude regarde ensuite (outil Read) pour décrire la grammaire visuelle :
composition, position et animation du texte, mots en rouge, transitions, mouvements.
"""
import argparse
import json
import os
import re
import statistics
import subprocess

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('video')
    ap.add_argument('--out', required=True)
    ap.add_argument('--threshold', type=float, default=0.25)
    ap.add_argument('--every', type=float, default=0.5)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout)
    r = subprocess.run(['ffmpeg', '-i', a.video, '-vf', f"select='gt(scene,{a.threshold})',showinfo", '-f', 'null', '-'], capture_output=True, text=True)
    cuts = [0.0] + [float(m) for m in re.findall(r'pts_time:([\d.]+)', r.stderr)]
    shots = [(cuts[i], cuts[i + 1] if i + 1 < len(cuts) else dur) for i in range(len(cuts))]
    lens = [b - a_ for a_, b in shots]
    files = []
    for i, (s, e) in enumerate(shots):
        for tag, t in (('a', s + 0.15), ('b', (s + e) / 2)):
            f = os.path.join(a.out, f'shot{i:03d}{tag}_{t:.2f}s.jpg')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', a.video, '-frames:v', '1', '-vf', 'scale=270:-2', f], check=True)
            files.append(f)
    mids = [f for f in files if 'b_' in os.path.basename(f)]
    cols = 8
    ims = [Image.open(f) for f in mids]
    if ims:
        w, h = ims[0].size
        sheet = Image.new('RGB', (cols * w, ((len(ims) + cols - 1) // cols) * h), (0, 0, 0))
        for i, im in enumerate(ims):
            sheet.paste(im, ((i % cols) * w, (i // cols) * h))
        sheet.save(os.path.join(a.out, 'reference_sheet.jpg'), quality=85)
    # planche chronologique : une image toutes les --every s (capte aussi les transitions progressives)
    tl = os.path.join(a.out, 'timeline')
    os.makedirs(tl, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', a.video, '-vf', f'fps=1/{a.every},scale=180:-2', os.path.join(tl, 't%04d.jpg')], check=True)
    tims = sorted(os.listdir(tl))
    for page in range(0, len(tims), 40):
        ims = [Image.open(os.path.join(tl, f)) for f in tims[page:page + 40]]
        w, h = ims[0].size
        sh = Image.new('RGB', (10 * w, ((len(ims) + 9) // 10) * h))
        for i, im in enumerate(ims):
            sh.paste(im, ((i % 10) * w, (i // 10) * h))
        sh.save(os.path.join(a.out, f'timeline_{page // 40:02d}.jpg'), quality=85)
    rep = {'duration': dur, 'timeline_every_s': a.every, 'n_shots': len(shots), 'shot_len_mean': round(statistics.mean(lens), 2),
           'shot_len_median': round(statistics.median(lens), 2), 'cuts_per_10s': round(len(shots) / dur * 10, 2),
           'shots': [{'start': round(s, 2), 'end': round(e, 2)} for s, e in shots]}
    json.dump(rep, open(os.path.join(a.out, 'reference_analysis.json'), 'w'), indent=1)
    print(json.dumps({k: v for k, v in rep.items() if k != 'shots'}, indent=1))


if __name__ == '__main__':
    main()
