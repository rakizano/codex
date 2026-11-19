#!/usr/bin/env python3
"""Propose les meilleurs passages candidats (15-45 s) pour un clip TikTok.

Le script fait le tri MÉCANIQUE (entrée/sortie propres, densité de paroles, répétitions,
durée, énergie si l'audio a été analysé). Le choix FINAL est artistique : Claude lit les
candidats et juge le sens, la narration et le potentiel visuel.

Usage :
  python3 passage_candidates.py <work>/lyrics.json [--audio <work>/audio.json] [--min 15 --max 45 --target 30 --top 8]
"""
import argparse
import json
import re
import sys
from collections import Counter


def norm(s):
    return re.sub(r'[^a-z0-9]+', ' ', (s or '').lower()).strip()


def syllables(text):
    return max(1, len(re.findall(r'[aeiouyàâäéèêëîïôöùûü]+', text.lower())))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lyrics')
    ap.add_argument('--audio')
    ap.add_argument('--min', type=float, default=15)
    ap.add_argument('--max', type=float, default=45)
    ap.add_argument('--target', type=float, default=30)
    ap.add_argument('--top', type=int, default=8)
    a = ap.parse_args()
    L = json.load(open(a.lyrics))
    lines = [l for l in L['lines'] if l['text'].strip()]
    allL = L['lines']
    counts = Counter(norm(l['text']) for l in lines)
    # fin réaliste de la voix : début de la ligne suivante, plafonnée par une estimation syllabique
    for l in lines:
        est = syllables(l['text']) * 0.32 + 0.8
        l['sung_end'] = round(min(l['end'], l['t'] + max(est, 1.2)), 3) if l['gap_after'] > 6 else l['end']
        l['repeat'] = counts[norm(l['text'])] > 1
    energy = None
    if a.audio:
        A = json.load(open(a.audio))
        energy = (A['energy_hop'], A['energy'])

    def e_mean(t0, t1):
        hop, e = energy
        seg = e[int(t0 / hop):max(int(t0 / hop) + 1, int(t1 / hop))]
        return sum(seg) / len(seg) if seg else 0

    cands = []
    for i in range(len(lines)):
        for j in range(i, len(lines)):
            li, lj = lines[i], lines[j]
            prev_t = next((x['t'] for x in reversed(allL) if x['t'] < li['t'] - 0.01), 0.0)
            gap_before = li['t'] - (lines[i - 1]['sung_end'] if i > 0 else prev_t)
            lead = min(1.2, max(0.25, gap_before * 0.4))
            start = max(0.0, li['t'] - lead)
            end = lj['sung_end'] + min(1.0, max(0.3, (lines[j + 1]['t'] - lj['sung_end']) * 0.5 if j + 1 < len(lines) else 1.0))
            dur = end - start
            if dur < a.min or dur > a.max:
                continue
            win = lines[i:j + 1]
            n = len(win)
            gap_after = (lines[j + 1]['t'] - lj['sung_end']) if j + 1 < len(lines) else 99
            internal = [win[k + 1]['t'] - win[k]['sung_end'] for k in range(n - 1)]
            dup_inside = n - len({norm(x['text']) for x in win})
            score = 0.0
            score += min(gap_before, 4) * 0.6            # entrée propre (début de section)
            score += min(gap_after, 4) * 0.6             # sortie propre (fin de phrase/section)
            score -= abs(dur - a.target) * 0.08          # proche de la durée cible
            score -= dup_inside * 0.8                    # éviter les répétitions internes
            score -= sum(max(0, g - 4) for g in internal) * 0.35  # trous instrumentaux longs
            density = n / dur
            score += 1.0 if 0.18 <= density <= 0.5 else -0.5
            notes = []
            if energy:
                em = e_mean(start, end)
                eg = e_mean(0, L['duration'])
                score += (em / eg - 1) * 2
                notes.append(f'énergie relative {em / eg:.2f}')
            if any(x['repeat'] for x in win):
                notes.append('contient des lignes répétées ailleurs (refrain probable)')
            cands.append({'score': round(score, 2), 'start': round(start, 2), 'end': round(end, 2), 'duration': round(dur, 2),
                          'first_line': i, 'last_line': j, 'n_lines': n, 'gap_before': round(gap_before, 2),
                          'gap_after': round(gap_after, 2), 'notes': notes,
                          'text': [f"{x['t']:7.2f}  {x['text']}" for x in win]})
    cands.sort(key=lambda c: -c['score'])
    picked = []
    for c in cands:  # diversité : éviter les fenêtres qui se chevauchent à plus de 50 %
        if all(min(c['end'], p['end']) - max(c['start'], p['start']) < 0.5 * c['duration'] for p in picked):
            picked.append(c)
        if len(picked) >= a.top:
            break
    print(json.dumps({'song': f"{L['artist']} – {L['title']}", 'duration': L['duration'], 'candidates': picked}, indent=1, ensure_ascii=False))


if __name__ == '__main__':
    sys.exit(main())
