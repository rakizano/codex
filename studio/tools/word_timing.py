#!/usr/bin/env python3
"""AudioSync — re-vérification du calage mot à mot.

  python3 tools/word_timing.py [--lyrics input/lyrics_sound.json] [--transcripts assets/audio/transcript.json input/words_large.json]
                               [--out input/lyrics_sound.json] [--report config/timing_report.json]

1. Transcriptions de référence : `npx hyperframes transcribe <son> --model medium --language fr` (moteur Whisper de
   HyperFrames, sans invite → pas de biais vers les paroles), éventuellement complétées par d'autres (large-v3…).
2. Alignement global (programmation dynamique type Needleman-Wunsch) entre les mots des paroles (texte de la source,
   jamais modifié) et les mots entendus, avec un score de ressemblance des lettres : tolérant aux mots mal reconnus
   (« Taracly » ↔ « racli », « Mouna » ↔ « Ounga »).
3. Chaque mot apparié prend l'instant où il est ENTENDU ; les autres sont interpolés entre leurs voisins appariés de la
   même phrase ; un mot n'est jamais placé avant le précédent.
4. Rapport : écart avec l'ancien calage, taux d'appariement par phrase, phrases douteuses.
"""
import argparse
import difflib
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nrm(w):
    w = unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode()
    w = re.sub(r"[^a-z0-9' -]", '', w).strip("'- ")
    return w.split("'")[-1].replace('-', '') if "'" in w else w.replace('-', '')


def sim(a, b):
    if not a or not b:
        return 0
    return difflib.SequenceMatcher(a=a, b=b).ratio()


def align(A, B):
    """A = mots des paroles, B = mots entendus → liste d'index j (ou None) pour chaque i"""
    n, m = len(A), len(B)
    GAP = -0.45
    S = [[0.0] * (m + 1) for _ in range(n + 1)]
    P = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        S[i][0] = S[i - 1][0] + GAP; P[i][0] = 1
    for j in range(1, m + 1):
        S[0][j] = S[0][j - 1] + GAP; P[0][j] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            s = sim(A[i - 1], B[j - 1])
            d = S[i - 1][j - 1] + (s * 2 - .9)
            u = S[i - 1][j] + GAP
            l = S[i][j - 1] + GAP
            S[i][j], P[i][j] = max((d, 0), (u, 1), (l, 2))
    i, j, out = n, m, [None] * n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and P[i][j] == 0:
            if sim(A[i - 1], B[j - 1]) >= .5:
                out[i - 1] = j - 1
            i -= 1; j -= 1
        elif i > 0 and (j == 0 or P[i][j] == 1):
            i -= 1
        else:
            j -= 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lyrics', default=os.path.join(ROOT, 'input/lyrics_sound.json'))
    ap.add_argument('--transcripts', nargs='+', default=[os.path.join(ROOT, 'assets/audio/transcript.json')])
    ap.add_argument('--out', default=None)
    ap.add_argument('--report', default=os.path.join(ROOT, 'config/timing_report.json'))
    ap.add_argument('--until', type=float, default=1e9, help='ignorer les mots entendus après cet instant (fin de la musique)')
    a = ap.parse_args()
    L = json.load(open(a.lyrics))
    lines = [l for l in L['lines'] if l['text'].strip()]
    toks = [(li, k, w) for li, l in enumerate(lines) for k, w in enumerate(l['text'].split())]
    A = [nrm(w) for _, _, w in toks]
    times = [None] * len(toks)
    src = [None] * len(toks)
    for ti, path in enumerate(a.transcripts):
        if not os.path.exists(path):
            continue
        H = json.load(open(path))
        H = H if isinstance(H, list) else H.get('words', [])
        H = [w for w in H if w['start'] < a.until and nrm(w['text'])]
        B = [nrm(w['text']) for w in H]
        al = align(A, B)
        for i, j in enumerate(al):
            if j is not None and times[i] is None:
                times[i] = H[j]['start']; src[i] = os.path.basename(path)
    # interpolation dans la phrase + monotonie
    report = []
    for li, l in enumerate(lines):
        idx = [i for i, (x, _, _) in enumerate(toks) if x == li]
        known = [(i, times[i]) for i in idx if times[i] is not None]
        old = l.get('words_sound_t') or {}
        for i in idx:
            if times[i] is None:
                lo = [k for k in known if k[0] < i]; hi = [k for k in known if k[0] > i]
                if lo and hi:
                    (i0, t0), (i1, t1) = lo[-1], hi[0]; times[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
                elif lo:
                    times[i] = lo[-1][1] + .22 * (i - lo[-1][0])
                elif hi:
                    times[i] = max(l['t'], hi[0][1] - .22 * (hi[0][0] - i))
                else:
                    times[i] = l['t'] + .22 * (i - idx[0])
                src[i] = 'interpolé'
        for a_, b_ in zip(idx, idx[1:]):
            if times[b_] < times[a_] + .05:
                times[b_] = times[a_] + .05
        newt = {str(k): round(times[i], 3) for k, i in enumerate(idx)}
        shift = [round(newt[k] - old[k], 2) for k in newt if k in old]
        matched = sum(1 for i in idx if src[i] != 'interpolé')
        report.append({'line': l['text'], 'matched': f'{matched}/{len(idx)}', 'first': newt['0'], 'last': newt[str(len(idx) - 1)], 'max_shift_vs_old': max(shift, key=abs) if shift else None,
                       'words': [(toks[i][2], round(times[i], 2), src[i]) for i in idx]})
        l['words_sound_t'] = newt
        l['timing'] = 'mots entendus (hyperframes transcribe, alignement global) + interpolation'
    json.dump(L, open(a.out or a.lyrics, 'w'), indent=1, ensure_ascii=False)
    json.dump(report, open(a.report, 'w'), indent=1, ensure_ascii=False)
    for r in report:
        print(f"{r['first']:6.2f}→{r['last']:6.2f}  {r['matched']:>5}  décalage max {r['max_shift_vs_old']}  {r['line'][:60]}")


if __name__ == '__main__':
    main()
