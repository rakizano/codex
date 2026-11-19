#!/usr/bin/env python3
"""Prépare le découpage en phrases d'un clip calé sur un son TikTok (après tiktok_sound_match.py).

  python3 sound_scenes.py <work> [--max-words 9] [--tail-min 1.2]

Entrée  : <work>/lyrics_sound.json (paroles sur l'horloge du son, avec words_sound_t).
Sortie  : <work>/lyrics_sound_scenes.json — une « ligne » par future scène :
  - début de chaque phrase = instant où son 1er mot est réellement entendu (Whisper) si disponible ;
  - lignes longues coupées aux virgules (morceaux ≤ max-words, sinon coupe au milieu),
    instant de coupe = mot entendu qui suit la coupe (sinon proportionnel aux mots, marqué estimé) ;
  - une phrase commencée AVANT le début du son est écartée (on n'en entend que la fin) ;
  - les morceaux qui démarrent à moins de tail-min s de la fin du son sont écartés.
Puis : storyboard.py init --lyrics <work>/lyrics_sound_scenes.json --start 0 --end <durée>
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tiktok_sound_match import tokens  # noqa: E402


def pieces(text, maxw):
    """Découpe aux virgules en regroupant les petits morceaux ; renvoie une liste de textes."""
    parts = [p.strip() for p in re.split(r'(?<=[,?!.])\s+', text) if p.strip()]
    out = []
    for p in parts:
        if out and len(out[-1].split()) + len(p.split()) <= maxw:
            out[-1] = out[-1] + ' ' + p
        else:
            out.append(p)
    res = []
    for p in out:  # morceau encore trop long : coupe au milieu
        w = p.split()
        while len(w) > maxw:
            k = len(w) // 2 if len(w) <= 2 * maxw else maxw
            res.append(' '.join(w[:k])); w = w[k:]
        res.append(' '.join(w))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('work')
    ap.add_argument('--max-words', type=int, default=9)
    ap.add_argument('--tail-min', type=float, default=1.2)
    ap.add_argument('--min-dur', type=float, default=1.3)
    a = ap.parse_args()
    L = json.load(open(os.path.join(a.work, 'lyrics_sound.json')))
    S, r, D = L['sound_mapping']['song_start_s'], L['sound_mapping']['speed'], L['duration']
    out, dropped = [], []
    for l in L['lines']:
        txt = re.sub(r'\s*\([^)]*\)', '', l['text']).strip()  # ad-libs non affichés
        if not txt:
            continue
        if l['song_t'] < S - 0.05:
            dropped.append(f"« {txt[:40]}… » (commencée avant le début du son)")
            continue
        ws = {int(k): v for k, v in l.get('words_sound_t', {}).items()}
        t0 = ws.get(0, l['t'])
        t_end = l['end']
        ntok = max(1, len(tokens(txt)))
        k0 = 0
        for p in pieces(txt, a.max_words):
            if k0 == 0:
                tp, src = t0, ('mot entendu' if 0 in ws else 'LRC recalé')
            elif k0 in ws:
                tp, src = ws[k0], 'mot entendu'
            else:
                tp, src = t0 + (t_end - t0) * k0 / ntok, 'estimé'
            if tp > D - a.tail_min:
                dropped.append(f"« {p[:40]} » (commence à {tp:.2f} s, trop près de la fin du son)")
                break
            out.append({'t': round(tp, 3), 'text': p, 'song_t': round(S + r * tp, 3), 'timing_source': src, 'src_line': l['i']})
            k0 += len(tokens(p))
    out.sort(key=lambda x: x['t'])
    # fusion des morceaux trop courts (< min-dur) avec le suivant de la même ligne
    merged = []
    for k, l in enumerate(out):
        nxt = out[k + 1]['t'] if k + 1 < len(out) else D
        if merged and merged[-1].get('_short') and merged[-1]['src_line'] == l['src_line']:
            merged[-1]['text'] += ' ' + l['text']
            merged[-1]['_short'] = (nxt - merged[-1]['t']) < a.min_dur
            continue
        l['_short'] = (nxt - l['t']) < a.min_dur
        merged.append(l)
    for l in merged:
        l.pop('_short', None)
    out = merged
    for k, l in enumerate(out):
        nxt = out[k + 1]['t'] if k + 1 < len(out) else D
        l.update(i=k, end=round(nxt, 3), gap_after=round(nxt - l['t'], 3))
    LS = dict(L, lines=out)
    json.dump(LS, open(os.path.join(a.work, 'lyrics_sound_scenes.json'), 'w'), indent=1, ensure_ascii=False)
    for l in out:
        print(f"{l['t']:6.2f}  [{l['timing_source']:>11}]  {l['text']}")
    for d in dropped:
        print('écarté :', d)


if __name__ == '__main__':
    main()
