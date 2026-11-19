#!/usr/bin/env python3
"""Retrouve où un SON TIKTOK (extrait, éventuellement accéléré/ralenti) se situe dans la chanson,
pour caler le clip exactement sur ce son : l'utilisateur choisit ensuite ce son dans TikTok,
sans rien couper, et publie.

Entrée : n'importe quel fichier contenant l'audio du son (vidéo TikTok enregistrée, enregistrement
d'écran, .mp4/.mov/.m4a/.mp3…). Il sert UNIQUEMENT à l'analyse ; il n'est jamais intégré au clip.

  python3 tiktok_sound_match.py <audio_ou_video> --lyrics <work>/lyrics.json --out <work> [--model small]

Méthode :
 1. Reconnaissance vocale locale et gratuite (faster-whisper) avec horodatage de chaque mot.
 2. Alignement de la transcription sur les paroles synchronisées (LRCLIB) mot à mot (difflib),
    tolérant aux erreurs de reconnaissance.
 3. Ancrages = premiers mots de lignes reconnus (t_song connu par le LRC) ↔ instant dans le son.
 4. Régression robuste t_song = S + r·τ  →  S = début dans la chanson, r = vitesse du son.
Sorties : <out>/sound_match.json, <out>/lyrics_sound.json (paroles sur l'horloge du son, t=0 = début
du son, avec horodatage mot à mot issu de la reconnaissance quand disponible).
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'cache', 'whisper')


def norm(w):
    w = unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r"[^a-z0-9]", '', w)


def tokens(text):
    text = re.sub(r'\([^)]*\)', ' ', text)  # ad-libs
    return [t for t in (norm(x) for x in re.split(r"[\s'’\-]+", text)) if t]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('audio')
    ap.add_argument('--lyrics', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--model', default='small')
    ap.add_argument('--language', default=None, help='fr, en… (détecté si absent)')
    a = ap.parse_args()
    from faster_whisper import WhisperModel

    L = json.load(open(a.lyrics))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.audio, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(raw, dtype=np.float32).copy()
    D = len(audio) / 16000
    model = WhisperModel(a.model, device='cpu', compute_type='int8', download_root=CACHE)
    lyr_text = ' '.join(l['text'] for l in L['lines'] if l['text'].strip())
    segs, info = model.transcribe(audio, language=a.language, word_timestamps=True, vad_filter=False,
                                  initial_prompt=lyr_text[:600], beam_size=5)
    words = []
    for s in segs:
        for w in s.words or []:
            for t in tokens(w.word):
                words.append((t, float(w.start), float(w.end)))
    # séquence des mots des paroles avec leur ligne
    lw = []
    for li, l in enumerate(L['lines']):
        for k, t in enumerate(tokens(l['text'])):
            lw.append((t, li, k))
    sm = difflib.SequenceMatcher(a=[w[0] for w in words], b=[x[0] for x in lw], autojunk=False)
    pairs = [(blk.a + k, blk.b + k) for blk in sm.get_matching_blocks() for k in range(blk.size)]
    # ancrages : mot n°0 d'une ligne (temps connu précisément par le LRC)
    anchors = [(words[i][1], L['lines'][lw[j][1]]['t']) for i, j in pairs if lw[j][2] == 0]
    used = 'débuts de lignes'
    if len(anchors) < 3:  # repli : tous les mots appariés, temps intra-ligne estimés
        anchors = []
        for i, j in pairs:
            ln = L['lines'][lw[j][1]]
            n = max(1, len(tokens(ln['text'])))
            anchors.append((words[i][1], ln['t'] + (min(ln['end'], ln['t'] + 0.4 * n) - ln['t']) * lw[j][2] / n))
        used = 'tous les mots (temps intra-ligne estimés)'
    if len(anchors) < 3:
        res = {'error': "Paroles non reconnues dans ce son : est-ce bien la même chanson, avec du chant audible ?",
               'recognized_words': len(words), 'matched_words': len(pairs), 'language': info.language}
        print(json.dumps(res, ensure_ascii=False, indent=1))
        return 2
    A = np.array(anchors)
    keep = np.ones(len(A), bool)
    for _ in range(4):  # régression robuste
        r, S = np.polyfit(A[keep, 0], A[keep, 1], 1)
        res_ = A[:, 1] - (S + r * A[:, 0])
        thr = max(0.35, 2.5 * np.median(np.abs(res_[keep])))
        keep = np.abs(res_) < thr
        if keep.sum() < 3:
            keep[:] = True
            break
    r, S = np.polyfit(A[keep, 0], A[keep, 1], 1)
    if abs(r - 1) < 0.015:  # vitesse normale : on fixe r = 1 et on ne régresse que le décalage
        r = 1.0
        S = float(np.median(A[keep, 1] - A[keep, 0]))
    rms = float(np.sqrt(np.mean((A[keep, 1] - (S + r * A[keep, 0])) ** 2)))
    nk = int(keep.sum())
    conf = 'élevée' if nk >= 5 and rms < 0.25 else 'moyenne' if nk >= 3 and rms < 0.5 else 'faible'
    # paroles sur l'horloge du son + mots reconnus
    wmap = {}
    for i, j in pairs:
        wmap.setdefault(lw[j][1], {})[lw[j][2]] = words[i][1]
    lines = []
    for li, l in enumerate(L['lines']):
        t = (l['t'] - S) / r
        e = (l['end'] - S) / r
        if e <= 0 or t >= D:
            continue
        d = dict(l, t=round(max(0.0, t), 3), end=round(min(D, e), 3), song_t=l['t'])
        d['gap_after'] = round(d['end'] - d['t'], 3)
        if li in wmap:
            d['words_sound_t'] = {str(k): round(v, 3) for k, v in sorted(wmap[li].items())}
        lines.append(d)
    LS = dict(L, duration=round(D, 3), lines=lines, sound_clock=True,
              sound_mapping={'song_start_s': round(S, 3), 'speed': round(r, 4), 'sound_duration_s': round(D, 3)})
    json.dump(LS, open(os.path.join(a.out, 'lyrics_sound.json'), 'w'), indent=1, ensure_ascii=False)
    out = {'file': os.path.basename(a.audio), 'language': info.language, 'sound_duration_s': round(D, 3),
           'song_start_s': round(S, 3), 'song_end_s': round(S + r * D, 3), 'speed': round(r, 4),
           'speed_note': 'accéléré' if r > 1.01 else 'ralenti' if r < 0.99 else 'vitesse normale',
           'recognized_words': len(words), 'matched_words': len(pairs), 'anchors_used': nk, 'anchor_type': used,
           'fit_rms_s': round(rms, 3), 'confidence': conf,
           'first_lines_in_sound': [f"{l['t']:6.2f}s  {l['text']}" for l in lines[:4]]}
    json.dump(out, open(os.path.join(a.out, 'sound_match.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(out, indent=1, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
