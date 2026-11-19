#!/usr/bin/env python3
"""Contrôle qualité automatique d'un clip rendu.

  python3 qa.py <projet>      (lit storyboard.json, video_finale.mp4, build/text_rects.json)

Vérifie : format TikTok (1080x1920, H.264, 30 fps, yuv420p), ABSENCE de piste audio, durée,
évolution visuelle à chaque nouvelle scène, animation à l'intérieur de chaque scène,
mots rouges, texte dans la zone de sécurité TikTok et taille lisible, absence de bandes noires.
Produit qa_report.json et contact_sheet.jpg (une vignette par scène) pour la revue visuelle.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SAFE = {'left': 60, 'right': 910, 'top': 220, 'bottom': 1450}
MIN_FONT = 64


def probe(f):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', f], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def frame(f, t, w=216, h=384, full=False):
    vf = [] if full else ['-vf', f'scale={w}:{h}']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t):.3f}', '-i', f, '-frames:v', '1', *vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    W, H = (1080, 1920) if full else (w, h)
    return np.frombuffer(raw, np.uint8).reshape(H, W, 3)


def main():
    P = sys.argv[1]
    sb = json.load(open(os.path.join(P, 'storyboard.json')))
    vid = os.path.join(P, 'video_finale.mp4')
    fails, warns, info = [], [], {}
    pr = probe(vid)
    vs = [s for s in pr['streams'] if s['codec_type'] == 'video']
    aus = [s for s in pr['streams'] if s['codec_type'] == 'audio']
    v = vs[0]
    fps = eval(v['r_frame_rate'])
    info['format'] = f"{v['codec_name']} {v['width']}x{v['height']} {fps:.2f}fps {v['pix_fmt']} profil={v.get('profile')}"
    if v['codec_name'] != 'h264': fails.append('codec != H.264')
    if (v['width'], v['height']) != (1080, 1920): fails.append('résolution != 1080x1920')
    if abs(fps - 30) > 0.01: warns.append(f'fps = {fps}')
    if v['pix_fmt'] != 'yuv420p': fails.append('pix_fmt != yuv420p (compatibilité iPad/TikTok)')
    if aus: fails.append('la vidéo contient une piste audio (doit être muette)')
    dur = float(pr['format']['duration'])
    info['duration'] = dur
    info['size_mb'] = round(int(pr['format']['size']) / 1e6, 2)
    if abs(dur - sb['passage']['duration']) > 1.5 / 30: fails.append(f"durée {dur:.3f}s != passage {sb['passage']['duration']}s")

    scenes = sb['scenes']
    thumbs, mids = [], []
    per_scene = []
    for k, s in enumerate(scenes):
        a, b = s['start'], s['end']
        ly = (s.get('lyrics') or [None])[0]
        tm = min(b - 0.1, max(ly['start'] + 0.9, (a + b) / 2)) if ly else (a + b) / 2
        f_mid = frame(vid, tm)
        f_a, f_b = frame(vid, a + min(0.45, (b - a) * .3)), frame(vid, b - min(0.45, (b - a) * .3))
        motion = float(np.abs(f_a.astype(int) - f_b.astype(int)).mean())
        mids.append(f_mid)
        thumbs.append((f_mid, s, tm))
        rec = {'id': s['id'], 'motion': round(motion, 2)}
        if motion < 1.5: warns.append(f"{s['id']}: peu de mouvement détecté dans la scène (Δ={motion:.2f})")
        if k:
            change = float(np.abs(mids[k].astype(int) - mids[k - 1].astype(int)).mean())
            rec['change_vs_prev'] = round(change, 2)
            if change < 10: fails.append(f"{s['id']}: évolution visuelle insuffisante vs scène précédente (Δ={change:.1f})")
        per_scene.append(rec)
    info['scenes'] = per_scene

    # bandes noires : bords uniformément noirs sur plusieurs images
    for f_ in mids[:: max(1, len(mids) // 5)]:
        for name, edge in (('haut', f_[:4]), ('bas', f_[-4:]), ('gauche', f_[:, :3]), ('droite', f_[:, -3:])):
            if edge.mean() < 6 and edge.std() < 2:
                warns.append(f'bord {name} entièrement noir sur une image (bande noire ?)')

    # texte
    rp = os.path.join(P, 'build', 'text_rects.json')
    if os.path.exists(rp):
        R = json.load(open(rp))
        for r in R['rects']:
            tag = f"« {r['text'][:30]} »"
            if not r['red']: fails.append(f'{tag}: aucun mot rouge trouvé dans le rendu')
            if r['fontSize'] < MIN_FONT: warns.append(f"{tag}: police petite ({r['fontSize']}px) pour smartphone")
            if r['x'] < SAFE['left'] - 5 or r['x'] + r['w'] > SAFE['right'] + 5 or r['y'] < SAFE['top'] - 5 or r['y'] + r['h'] > SAFE['bottom'] + 5:
                warns.append(f"{tag}: texte hors zone de sécurité TikTok (x={r['x']:.0f}..{r['x'] + r['w']:.0f}, y={r['y']:.0f}..{r['y'] + r['h']:.0f})")
        for e in R.get('errors', []):
            fails.append('console: ' + e) if 'error' in e else warns.append('console: ' + e)
    else:
        warns.append('text_rects.json absent : lancer render.mjs --rects')

    # planche contact
    cols = min(6, len(thumbs))
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 226, rows * 420), (20, 20, 20))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
    except Exception:
        font = ImageFont.load_default()
    for i, (f_, s, tm) in enumerate(thumbs):
        x, y = (i % cols) * 226 + 5, (i // cols) * 420 + 5
        sheet.paste(Image.fromarray(f_), (x, y))
        d.text((x, y + 388), f"{s['id']}  {tm:.1f}s", fill=(230, 230, 230), font=font)
    sheet.save(os.path.join(P, 'contact_sheet.jpg'), quality=88)
    rep = {'pass': not fails, 'failures': fails, 'warnings': warns, 'info': info}
    json.dump(rep, open(os.path.join(P, 'qa_report.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps({k: rep[k] for k in ('pass', 'failures', 'warnings')} | {'format': info['format'], 'duration': dur, 'size_mb': info['size_mb']}, indent=1, ensure_ascii=False))
    return 0 if not fails else 1


if __name__ == '__main__':
    sys.exit(main())
