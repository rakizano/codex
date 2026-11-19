#!/usr/bin/env python3
"""Storyboard : création du squelette à partir des paroles synchronisées, puis validation.

  python3 storyboard.py init  --lyrics <work>/lyrics.json --start 323.72 --end 356.39 --out <projet>/storyboard.json [--split-long 9]
  python3 storyboard.py check <projet>/storyboard.json [--lyrics <work>/lyrics.json] [--scenes <projet>/scenes.js]

Convention de temps : dans storyboard.json, tous les temps (scènes, paroles) sont en secondes
DEPUIS LE DÉBUT DU PASSAGE (t=0 = passage.start dans la chanson). Les champs song_t donnent
le temps correspondant dans la chanson originale.
"""
import argparse
import json
import re
import sys
import unicodedata

TRANSITIONS = {'cut', 'fade', 'dip', 'flash', 'wipe', 'diagonal', 'iris', 'ink', 'shape', 'blinds', 'push', 'slide',
               'zoom', 'spin', 'whip', 'glitch', 'bar', 'radial'}
ENTERS = {'pop', 'rise', 'drop', 'slide', 'blur', 'stamp', 'type', 'split', 'mask', 'drift', 'line'}
EMPHASES = {'grow', 'late', 'shake', 'pulse', 'slidein', 'drop', 'reveal', 'glow', 'scramble', 'breathe', 'shrink', 'none'}


def norm_words(s):
    s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower().replace('/', ' ')
    s = s.replace('’', "'")
    return [w for w in re.sub(r"[^a-z0-9' ]+", ' ', s).split() if w.strip("'")]


def syl(w):
    return max(1, len(re.findall(r'[aeiouy]+', w.lower())))


def fmt(t):
    m, s = divmod(t, 60)
    return f'{int(m)}:{s:06.3f}'


def cmd_init(a):
    L = json.load(open(a.lyrics))
    start, end = a.start, a.end
    dur = round(end - start, 3)
    sung = [l for l in L['lines'] if l['text'].strip() and start - 0.05 <= l['t'] < end - 0.3]
    for k, l in enumerate(L['lines']):
        if l['text'].strip():
            est = len(norm_words(l['text'])) * 0.42 + 0.9
            l['sung_end'] = min(l['end'], l['t'] + est) if l['gap_after'] > 6 else l['end']
    pieces = []
    for l in sung:
        words = l['text'].split()
        t0, t1 = l['t'] - start, min(l['sung_end'], end) - start
        if a.split_long and len(words) > a.split_long:
            # coupe à la virgule la plus proche du milieu, sinon au milieu ; timing proportionnel aux syllabes (ESTIMÉ)
            mid = len(words) // 2
            commas = [i + 1 for i, w in enumerate(words[:-1]) if w.endswith(',')]
            cut = min(commas, key=lambda c: abs(c - mid)) if commas else mid
            s1 = sum(syl(w) for w in words[:cut]); s2 = sum(syl(w) for w in words[cut:])
            tm = t0 + (t1 - t0) * s1 / (s1 + s2)
            pieces.append({'text': ' '.join(words[:cut]), 'start': t0, 'end': tm, 'src_line': l['i'], 'timing': 'estimé (découpe intra-ligne)'})
            pieces.append({'text': ' '.join(words[cut:]), 'start': tm, 'end': t1, 'src_line': l['i'], 'timing': 'estimé (découpe intra-ligne)'})
        else:
            pieces.append({'text': l['text'], 'start': t0, 'end': t1, 'src_line': l['i'], 'timing': 'LRC'})
    scenes = []
    lead = 0.12
    if pieces and pieces[0]['start'] > 1.2:
        scenes.append({'id': 's00', 'start': 0.0, 'lyrics': [], 'role': 'intro instrumentale'})
    for k, p in enumerate(pieces):
        st = 0.0 if (k == 0 and not scenes) else max(0.0, p['start'] - lead)
        scenes.append({'id': f's{len(scenes):02d}', 'start': round(st, 3), 'lyrics': [{
            'text': p['text'], 'red': '', 'start': round(max(p['start'], st), 3), 'end': None,
            'song_t': round(p['start'] + start, 3), 'timing': p['timing'], 'src_line': p['src_line']}]})
    for k, s in enumerate(scenes):
        s['end'] = round(scenes[k + 1]['start'] if k + 1 < len(scenes) else dur, 3)
        for ly in s['lyrics']:
            nxt_piece_end = next(p['end'] for p in pieces if round(max(p['start'], 0), 3) <= ly['start'] + 1e-6 and p['text'] == ly['text'])
            ly['end'] = round(min(s['end'] - 0.02, max(nxt_piece_end + 0.35, ly['start'] + 1.0)), 3)
        s.update({'transition': {'type': 'fade', 'dur': 0.5} if k else {'type': 'cut', 'dur': 0},
                  'visual': '', 'camera': '', 'animation': ''})
    sb = {
        'song': {'artist': L['artist'], 'title': L['title'], 'album': L.get('album'), 'version_duration': L['duration'],
                 'lrclib_ref_id': L['lrclib_ref_id'], 'sync_confidence': L['sync_confidence'],
                 'sync_spread_median_s': L.get('sync_spread_median_s'), 'n_sources': L['n_sources']},
        'passage': {'start': round(start, 3), 'end': round(end, 3), 'duration': dur, 'start_fmt': fmt(start), 'end_fmt': fmt(end)},
        'fps': 30, 'width': 1080, 'height': 1920,
        'direction': {'concept': '', 'universe': '', 'palette': {}, 'typography': '', 'graphic_style': '', 'animation_principles': '', 'transitions': '', 'references': ''},
        'style': {'typo': {'font': 'Anton', 'color': '#ffffff', 'red': '#e10600'}, 'fx': {}, 'palette': {}},
        'beats': [],
        'scenes': scenes,
    }
    json.dump(sb, open(a.out, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(scenes)} scènes, durée {dur:.2f}s -> {a.out}')
    for s in scenes:
        print(f"  {s['id']} {s['start']:6.2f}-{s['end']:6.2f}  " + ' | '.join(l['text'] for l in s['lyrics']))


def cmd_check(a):
    sb = json.load(open(a.storyboard))
    errs, warns = [], []
    sc = sb['scenes']
    D = sb['passage']['duration']
    if abs(sb['passage']['end'] - sb['passage']['start'] - D) > 0.01:
        errs.append('passage.duration != end - start')
    if not sc or abs(sc[0]['start']) > 1e-6:
        errs.append('la première scène doit commencer à 0')
    if abs(sc[-1]['end'] - D) > 0.01:
        errs.append(f"la dernière scène doit finir à {D} (finit à {sc[-1]['end']})")
    ids = set()
    for k, s in enumerate(sc):
        if s['id'] in ids:
            errs.append(f"id dupliqué {s['id']}")
        ids.add(s['id'])
        if k and abs(s['start'] - sc[k - 1]['end']) > 1e-3:
            errs.append(f"{s['id']}: non contigu avec la scène précédente")
        if s['end'] - s['start'] < 0.6:
            warns.append(f"{s['id']}: scène très courte ({s['end'] - s['start']:.2f}s)")
        tr = s.get('transition') or {}
        if tr.get('type') and tr['type'] not in TRANSITIONS:
            errs.append(f"{s['id']}: transition inconnue {tr['type']}")
        if not s.get('visual'):
            errs.append(f"{s['id']}: champ 'visual' vide (description de la composition)")
        if k and s.get('visual') and s['visual'] == sc[k - 1].get('visual'):
            errs.append(f"{s['id']}: même description visuelle que la scène précédente")
        for ly in s.get('lyrics', []):
            if ly['start'] < s['start'] - 0.3 or ly['end'] > s['end'] + 0.05:
                errs.append(f"{s['id']}: paroles hors des bornes de la scène ({ly['start']}-{ly['end']})")
            red = ly.get('red')
            if not red:
                errs.append(f"{s['id']}: aucun mot rouge pour « {ly['text']} »")
            else:
                reds = red if isinstance(red, list) else [red]
                tw = norm_words(ly['text'])
                for r in reds:
                    if not norm_words(r) or norm_words(r)[0] not in tw:
                        errs.append(f"{s['id']}: mot rouge « {r} » absent du texte")
            if ly.get('enter') and ly['enter'] not in ENTERS:
                errs.append(f"{s['id']}: enter inconnu {ly['enter']}")
            if ly.get('emphasis') and ly['emphasis'] not in EMPHASES:
                errs.append(f"{s['id']}: emphasis inconnue {ly['emphasis']}")
    # Paroles affichées == paroles sources (aucune invention / modification)
    if a.lyrics:
        L = json.load(open(a.lyrics))
        p0, p1 = sb['passage']['start'], sb['passage']['end']
        src = [w for l in L['lines'] if l['text'].strip() and p0 - 0.05 <= l['t'] < p1 - 0.3 for w in norm_words(l['text'])]
        shown = [w for s in sc for ly in s.get('lyrics', []) for w in norm_words(ly['text'])]
        if src != shown:
            import difflib
            d = [x for x in difflib.ndiff(src, shown) if x[0] in '+-']
            errs.append('les paroles affichées diffèrent des paroles sources : ' + ' '.join(d[:30]))
        # passage cohérent avec la durée de la version
        if p1 > L['duration'] + 0.5:
            errs.append('fin du passage au-delà de la durée de la version')
    # Mots rouges : variété
    reds = [str(ly.get('red')).lower() for s in sc for ly in s.get('lyrics', [])]
    last_word = sum(1 for s in sc for ly in s.get('lyrics', []) if ly.get('red') and norm_words(ly['text'])[-1:] == norm_words(str(ly['red']))[:1])
    if reds and last_word / len(reds) > 0.7:
        warns.append(f'le mot rouge est le dernier mot dans {last_word}/{len(reds)} séquences : varier')
    trs = [(s.get('transition') or {}).get('type') for s in sc[1:]]
    if trs and max(trs.count(t) for t in set(trs)) / len(trs) > 0.6 and len(trs) > 3:
        warns.append('une même transition domine (>60 %) : varier selon la musique')
    if a.scenes:
        js = open(a.scenes).read()
        for s in sc:
            if not re.search(r"CLIP\.scene\(\s*['\"]" + re.escape(s['id']) + r"['\"]", js):
                errs.append(f"{s['id']}: aucune fonction CLIP.scene('{s['id']}', …) dans scenes.js")
    res = {'ok': not errs, 'errors': errs, 'warnings': warns, 'n_scenes': len(sc),
           'n_lyric_scenes': sum(1 for s in sc if s.get('lyrics'))}
    print(json.dumps(res, indent=1, ensure_ascii=False))
    return 0 if not errs else 1


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    i = sub.add_parser('init')
    i.add_argument('--lyrics', required=True)
    i.add_argument('--start', type=float, required=True)
    i.add_argument('--end', type=float, required=True)
    i.add_argument('--out', required=True)
    i.add_argument('--split-long', type=int, default=0, help='découper en 2 scènes les lignes de plus de N mots')
    c = sub.add_parser('check')
    c.add_argument('storyboard')
    c.add_argument('--lyrics')
    c.add_argument('--scenes')
    a = ap.parse_args()
    return cmd_init(a) if a.cmd == 'init' else cmd_check(a)


if __name__ == '__main__':
    sys.exit(main())
