#!/usr/bin/env python3
"""Récupère les paroles SYNCHRONISÉES d'un morceau sur LRCLIB (base libre, gratuite, sans clé)
et mesure la fiabilité des timestamps en comparant plusieurs sources indépendantes.

Usage :
  python3 lyrics_fetch.py --artist "Pink Floyd" --title "Time" --out <dossier> [--duration 413] [--allow-live]

Sorties dans <dossier> :
  lyrics.json   lignes {t, end, text, n_src, spread} + métadonnées de version et de confiance
  lyrics.lrc    fichier LRC de la source de référence
  sources.json  toutes les entrées LRCLIB trouvées (pour traçabilité)

Méthode de fiabilité : les entrées LRCLIB d'une même version (durée ±2.5 s) sont alignées
ligne à ligne (difflib) ; pour chaque ligne on garde la MÉDIANE des timestamps et l'écart
max entre sources ("spread"). Une seule source = timestamps non recoupés (signalé).
"""
import argparse
import difflib
import json
import os
import re
import statistics
import sys
import unicodedata
import urllib.parse
import urllib.request

API = 'https://lrclib.net/api'
UA = 'clip-tiktok-skill/1.0 (https://github.com/)'
BAD_VERSION = re.compile(r'\b(live|remix|acoustic|instrumental|karaoke|demo|edit|version|sped|slowed|cover|tribute|mix)\b', re.I)


def norm(s):
    s = unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def get(path, **params):
    url = f'{API}/{path}?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def parse_lrc(lrc):
    out = []
    for raw in lrc.splitlines():
        tags = re.findall(r'\[(\d+):(\d+(?:\.\d+)?)\]', raw)
        text = re.sub(r'\[[^\]]*\]', '', raw).strip()
        for m, s in tags:
            out.append((int(m) * 60 + float(s), text))
    out.sort(key=lambda x: x[0])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--artist', required=True)
    ap.add_argument('--title', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--duration', type=float, help='durée (s) de la version officielle visée, si connue')
    ap.add_argument('--allow-live', action='store_true')
    ap.add_argument('--id', type=int, help="forcer l'id LRCLIB de référence")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    seen = {}
    for res in (get('search', track_name=a.title, artist_name=a.artist), get('search', q=f'{a.artist} {a.title}')):
        for r in res:
            seen[r['id']] = r
    na, nt = norm(a.artist), norm(a.title)
    cands = []
    for r in seen.values():
        if not r.get('syncedLyrics'):
            continue
        ra, rt = norm(r.get('artistName')), norm(r.get('trackName'))
        if na not in ra and ra not in na:
            continue
        if not (rt == nt or rt.startswith(nt + ' ') or nt.startswith(rt + ' ')):
            continue
        label = f"{r.get('trackName')} {r.get('albumName') or ''}"
        live = bool(BAD_VERSION.search(label)) and not BAD_VERSION.search(a.title)
        if live and not a.allow_live:
            r['_rejected'] = 'version live/remix/etc.'
        cands.append(r)
    json.dump([{k: v for k, v in r.items() if k not in ('plainLyrics', 'syncedLyrics')} for r in cands],
              open(os.path.join(a.out, 'sources.json'), 'w'), indent=1, ensure_ascii=False)
    ok = [r for r in cands if '_rejected' not in r]
    if not ok:
        print(json.dumps({'error': 'Aucune parole synchronisée trouvée sur LRCLIB pour ce titre.',
                          'candidates_rejected': len(cands)}, ensure_ascii=False))
        return 2

    # 1) regroupement par durée (= par version), NON chaîné : ±2 s autour du premier élément
    ok.sort(key=lambda r: r['duration'])
    clusters = []
    for r in ok:
        if clusters and abs(r['duration'] - clusters[-1][0]['duration']) <= 2.0:
            clusters[-1].append(r)
        else:
            clusters.append([r])
    if a.id:
        cl = next(c for c in clusters if any(r['id'] == a.id for r in c))
    elif a.duration:
        cl = min(clusters, key=lambda c: abs(statistics.median(r['duration'] for r in c) - a.duration))
    else:
        cl = max(clusters, key=lambda c: (len(c), statistics.median(r['duration'] for r in c)))
    parsed = {r['id']: parse_lrc(r['syncedLyrics']) for r in cl}
    nlines = lambda r: len([1 for t, x in parsed[r['id']] if x])

    def match(ref_id, other_id):
        A = [norm(x) for t, x in parsed[ref_id]]
        B = [norm(x) for t, x in parsed[other_id]]
        sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
        pairs = [(blk.a + k, blk.b + k) for blk in sm.get_matching_blocks() for k in range(blk.size) if A[blk.a + k]]
        return sm.ratio(), pairs

    # 2) sous-groupe de sources dont les timestamps concordent (décalage médian ±0.6 s)
    prov = next((r for r in cl if r['id'] == a.id), None) or max(cl, key=nlines)
    offs = {}
    for r in cl:
        if r['id'] == prov['id']:
            offs[r['id']] = 0.0
            continue
        ratio, pairs = match(prov['id'], r['id'])
        if ratio < 0.6 or len(pairs) < 4:
            continue
        offs[r['id']] = statistics.median(parsed[r['id']][j][0] - parsed[prov['id']][i][0] for i, j in pairs)
    best_o = max(offs.values(), key=lambda o: sum(1 for v in offs.values() if abs(v - o) <= 0.6))
    group = [r for r in cl if r['id'] in offs and abs(offs[r['id']] - best_o) <= 0.6]
    if a.id:
        group = [r for r in cl if r['id'] in offs and abs(offs[r['id']] - offs[a.id]) <= 0.6]
    disagree = [{'id': r['id'], 'album': r.get('albumName'), 'offset_vs_consensus_s': round(offs[r['id']] - best_o, 2)}
                for r in cl if r['id'] in offs and r not in group]
    ref = next((r for r in group if r['id'] == a.id), None) or max(group, key=nlines)
    ref_lines = parsed[ref['id']]
    times = [[t] for t, _ in ref_lines]
    text_agree = []
    for r in group:
        if r['id'] == ref['id']:
            continue
        ratio, pairs = match(ref['id'], r['id'])
        text_agree.append(round(ratio, 3))
        for i, j in pairs:
            times[i].append(parsed[r['id']][j][0])
    cl = group
    lines = []
    for i, (t, txt) in enumerate(ref_lines):
        ts = times[i]
        med = statistics.median(ts)
        lines.append({'i': i, 't': round(med, 3), 't_ref': round(t, 3), 'text': txt, 'n_src': len(ts),
                      'spread': round(max(ts) - min(ts), 3) if len(ts) > 1 else None})
    # fin de ligne = début de la suivante (borne supérieure : la voix peut s'arrêter avant)
    dur = ref['duration']
    for k, ln in enumerate(lines):
        nxt = lines[k + 1]['t'] if k + 1 < len(lines) else dur
        ln['end'] = round(nxt, 3)
        ln['gap_after'] = round(nxt - ln['t'], 3)
    sung = [l for l in lines if l['text']]
    spreads = [l['spread'] for l in sung if l['spread'] is not None]
    multi = len(cl) > 1
    conf = 'aucune vérification croisée (1 seule source)'
    if multi and spreads:
        m = statistics.median(spreads)
        conf = 'élevée' if m <= 0.35 else 'moyenne' if m <= 0.8 else 'faible'
    out = {
        'artist': ref['artistName'], 'title': ref['trackName'], 'album': ref.get('albumName'),
        'duration': dur, 'lrclib_ref_id': ref['id'], 'version_cluster_ids': [r['id'] for r in cl],
        'version_cluster_albums': sorted({r.get('albumName') or '?' for r in cl}),
        'other_versions': [{'duration': round(statistics.median(r['duration'] for r in c), 1), 'n': len(c),
                            'albums': sorted({r.get('albumName') or '?' for r in c})[:4]} for c in clusters if c is not cl],
        'n_sources': len(cl), 'text_agreement': text_agree, 'sources_disagreeing': disagree,
        'sync_spread_median_s': round(statistics.median(spreads), 3) if spreads else None,
        'sync_spread_p90_s': round(sorted(spreads)[int(len(spreads) * .9) - 1], 3) if len(spreads) >= 3 else None,
        'sync_confidence': conf,
        'sync_method': 'LRCLIB (paroles synchronisées ligne par ligne par la communauté), médiane multi-sources',
        'lines': lines,
    }
    json.dump(out, open(os.path.join(a.out, 'lyrics.json'), 'w'), indent=1, ensure_ascii=False)
    open(os.path.join(a.out, 'lyrics.lrc'), 'w').write(ref['syncedLyrics'])
    summary = {k: out[k] for k in ('artist', 'title', 'album', 'duration', 'lrclib_ref_id', 'n_sources', 'text_agreement',
                                   'sync_spread_median_s', 'sync_spread_p90_s', 'sync_confidence', 'sources_disagreeing', 'version_cluster_albums', 'other_versions')}
    summary['n_lines'] = len(sung)
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
