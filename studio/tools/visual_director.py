#!/usr/bin/env python3
"""VisualDirector + SceneDirector + Timeline : paroles calées + analyse audio → storyboard.json (modifiable).

  python3 tools/visual_director.py [--lyrics input/lyrics_sound.json] [--audio config/audio.json] [--duration 23.9] [--out storyboard.json]

Pour chaque phrase :
  1. Analyse : sens (catégories du lexique), objets, actions, intensité (énergie de la basse sur la phrase),
     mots importants, rimes / répétitions (« -ter-ter »), musique (impacts forts, kicks, sections HyperFrames).
  2. Choix de la scène : score = Σ poids(tags de la scène × sens de la phrase) − répétition (même scène, même
     technique que la précédente) + bonus « lecture symbolique » quand deux idées sont proches (on évite la première
     interprétation évidente). Changement de technique 2D/3D/dessin/néon justifié par le sens.
  3. Typographie : règle du lexique (ex. « merde / enterrer » → phrase lourde qui tombe) sinon variation,
     jamais deux fois de suite la même famille d'animation ; mot important = mot porteur du sens, son effet est
     calé sur l'IMPACT musical fort le plus proche (kick dans les 30 % les plus forts).
  4. Transition : provoquée par le contenu (objet de sortie → l'objet remplit l'écran ; texte qui tombe → flash
     d'impact ; passage 2D↔3D → zoom à travers ; réseau social → glitch ; dessin → encre), sans répétition.
  5. Découpage : une phrase de plus de 3,3 s est coupée en deux plans à la frontière de mots la plus proche du milieu.
Aucune parole n'est modifiée : le texte affiché est celui de la source.
"""
import argparse
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def norm(w):
    w = unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r"[^a-z0-9'-]", '', w)


def core(tok):
    t = norm(tok).strip("'-")
    t = t.split("'")[-1] if "'" in t else t
    return t.split('-')[0] if '-' in t else t


def wrap(words, maxc=13):
    lines, cur = [], ''
    for w in words:
        if cur and len(cur) + 1 + len(w) > maxc:
            lines.append(cur); cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        lines.append(cur)
    return ' / '.join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lyrics', default=os.path.join(ROOT, 'input/lyrics_sound.json'))
    ap.add_argument('--audio', default=os.path.join(ROOT, 'config/audio.json'))
    ap.add_argument('--duration', type=float)
    ap.add_argument('--out', default=os.path.join(ROOT, 'storyboard.json'))
    a = ap.parse_args()
    VP = json.load(open(os.path.join(ROOT, 'config/visual-presets.json')))
    AP = json.load(open(os.path.join(ROOT, 'config/animation-presets.json')))
    TP = json.load(open(os.path.join(ROOT, 'config/transition-presets.json')))
    PJ = json.load(open(os.path.join(ROOT, 'config/project.json')))
    AU = json.load(open(a.audio))
    L = json.load(open(a.lyrics))
    D = a.duration or PJ.get('duration') or AU['duration']
    lex = {c: {norm(w) for w in ws} for c, ws in VP['lexicon'].items()}
    impacts = AU.get('impacts', [])
    bass = AU.get('bass_10hz', [])

    # 1) phrases entièrement contenues dans le son ; mots horodatés (temps du son)
    shots = []
    for l in L['lines']:
        if not l['text'].strip() or l['t'] < -.05 or l['t'] > D - .6:
            continue
        toks = l['text'].split()
        wst = l.get('words_sound_t') or {}
        times = [wst.get(str(i)) for i in range(len(toks))]
        known = [(i, x) for i, x in enumerate(times) if x is not None]
        for i in range(len(toks)):
            if times[i] is None:
                lo = [k for k in known if k[0] < i]; hi = [k for k in known if k[0] > i]
                if lo and hi:
                    (i0, t0), (i1, t1) = lo[-1], hi[0]; times[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
                elif lo:
                    times[i] = lo[-1][1] + .18 * (i - lo[-1][0])
                else:
                    times[i] = l['t'] + .2 * i
        end_sung = times[-1] + .35
        if end_sung > D + .1:
            continue                                     # phrase coupée par la fin du son : écartée
        segs = [(0, len(toks))]
        if l['end'] - l['t'] > 3.3 and len(toks) >= 6:   # plusieurs plans pour une même phrase
            mid = (l['t'] + l['end']) / 2
            cut = min(range(2, len(toks) - 2), key=lambda i: abs(times[i] - mid))
            segs = [(0, cut), (cut, len(toks))]
        for (s0, s1) in segs:
            shots.append({'toks': toks[s0:s1], 'times': [round(x, 3) for x in times[s0:s1]], 'line': l['text'], 'part': segs.index((s0, s1)), 'nparts': len(segs), 'song_t': l.get('song_t')})

    # 2) analyse + choix
    used_tpl, used_family, used_text_family, used_trans = {}, None, None, {}
    prev_tpl = None
    scenes = []
    for k, sh in enumerate(shots):
        cores = [core(t) for t in sh['toks']]
        sense = {}
        for c, ws in lex.items():
            n = sum(1 for w in cores if w in ws)
            if n:
                sense[c] = n
        t0, t1 = sh['times'][0], sh['times'][-1] + .3
        seg = bass[int(t0 * 10):int(t1 * 10) + 1] or [0]
        intensity = round(sum(seg) / len(seg), 3)
        # scène
        cands = []
        for name, T in VP['templates'].items():
            s = sum(T['tags'].get(c, 0) * min(2, n) for c, n in sense.items())
            s -= 4 if name == prev_tpl else 0
            s -= 3.2 * used_tpl.get(name, 0)
            if prev_tpl and VP['templates'][prev_tpl].get('exitObject') and 'phone' in T['tags']:
                s += 3                                     # on sort de la scène PAR l'écran du téléphone : la suivante est dedans
            s -= 1.2 if T['family'] == used_family else 0
            cands.append([s, name])
        cands.sort(reverse=True)
        best = cands[0]
        if len(cands) > 1 and cands[1][0] >= best[0] * .85 and VP['templates'][cands[1][1]]['reading'] == 'symbolic' and VP['templates'][best[1]]['reading'] == 'literal' and best[0] > 0:
            best = cands[1]                                # idée symbolique plutôt que la première interprétation évidente
        tpl = best[1]; T = VP['templates'][tpl]
        # mot important : porteur du sens le plus fort pour cette scène ; à égalité, le plus tardif (chute de phrase)
        imp_i, imp_score = None, -1
        for i, w in enumerate(cores):
            sc_ = sum(T['tags'].get(c, 0) + 1 for c, ws in lex.items() if w in ws)
            if sh['toks'][i][:1].isupper() and i > 0:
                sc_ += 5
            if len(w) >= 3 and sc_ >= imp_score and sc_ > 0:
                imp_i, imp_score = i, sc_
        if imp_i is None:
            imp_i = max(range(len(cores)), key=lambda i: len(cores[i]))
        imp_word = re.sub(r"^.*['’]", '', sh['toks'][imp_i]).strip(',.!?') or sh['toks'][imp_i]
        wt = sh['times'][imp_i]
        near = [x for x in impacts if wt - .15 <= x <= wt + .7]
        impact = round(near[0], 3) if near else round(wt + .05, 3)
        # typographie
        preset, why, rule = None, '', None
        ranked = sorted([r for r in VP['text_rules'] if any(c in sense for c in r['if'])], key=lambda r: -sum(T['tags'].get(c, 0) + 1 for c in r['if'] if c in sense))
        if ranked:
            rule = ranked[0]; preset, why = rule['preset'], rule['why']
            # le mot mis en valeur est celui qui porte le sens de la règle choisie (ex. « prix » pour le grossissement)
            cand = [i for i, w in enumerate(cores) if any(w in lex[c] for c in rule['if'] if c in lex) and len(w) >= 3]
            if cand and not (sh['toks'][imp_i][:1].isupper() and imp_i > 0):
                imp_i = cand[-1]; imp_word = re.sub(r"^.*['’]", '', sh['toks'][imp_i]).strip(',.!?'); wt = sh['times'][imp_i]
                near = [x for x in impacts if wt - .15 <= x <= wt + .7]; impact = round(near[0], 3) if near else round(wt + .05, 3)
        if not preset or AP[preset]['family'] == used_text_family and k and scenes[-1]['text']['preset'] == preset:
            pool = [p for p, v in AP.items() if not p.startswith('_') and v.get('family') != used_text_family]
            preset = pool[(k * 7) % len(pool)]; why = 'variation (aucune règle du lexique)'
        used_text_family = AP[preset]['family']
        tx = dict(T['text'])
        maxc = 11 if preset in ('brutalGiant', 'materialize3D', 'toCamera') else 13
        tx.update({'text': wrap(sh['toks'], maxc), 'words': sh['times'], 'important': imp_word, 'impact': impact, 'preset': preset, 'intensity': round(.85 + min(.6, intensity), 2), 'why': why})
        if preset == 'heavySentence':
            tx.update({'pos': [150, 900], 'ground': 1300})
        if preset == 'stackPile':
            tx.update({'pos': 'upper', 'align': 'center'})
        params = {}
        if tpl == 'stage3d_name':
            params['word3d'] = imp_word.strip("'")
        if tpl == 'night_drive':
            params['word3d'] = imp_word.upper().strip("'") if imp_word else None
        scenes.append({'id': f's{k + 1:02d}', 'start': None, 'end': None, 'lyrics': ' '.join(sh['toks']), 'line': sh['line'], 'part': f"{sh['part'] + 1}/{sh['nparts']}",
                       'template': tpl, 'style': T['family'], 'reading': T['reading'],
                       'description': f"{T['main']} — {T['decor']}", 'characters': T['characters'], 'objects': T['objects'], 'decor': T['decor'],
                       'camera': {'label': T['camera']}, 'animations': {'main': T['main'], 'secondary': T['secondary']},
                       'text': tx, 'params': params, 'sfx': [],
                       'analysis': {'sense': sense, 'intensity': intensity, 'important': imp_word, 'impact': impact, 'scores': {n: round(s, 2) for s, n in cands[:4]}},
                       't_first_word': sh['times'][0]})
        used_tpl[tpl] = used_tpl.get(tpl, 0) + 1
        used_family, prev_tpl = T['family'], tpl

    # 3) Timeline : coupes juste avant le 1er mot, recalées sur le temps le plus proche (±0,1 s)
    beats = AU.get('beats', [])
    for i, s in enumerate(scenes):
        t = 0.0 if i == 0 else max(0.0, s['t_first_word'] - .12)
        if i and beats:
            b = min(beats, key=lambda x: abs(x - t))
            if abs(b - t) <= .1 and b < s['t_first_word']:
                t = b
        s['start'] = round(t, 3)
    for i, s in enumerate(scenes):
        s['end'] = round(scenes[i + 1]['start'] if i + 1 < len(scenes) else D, 3)
        s['text']['outAt'] = round(s['end'] - .32, 3)
        del s['t_first_word']
    # 4) transitions provoquées par le contenu
    for i, s in enumerate(scenes[:-1]):
        n = scenes[i + 1]; Ts = VP['templates'][s['template']]; Tn = VP['templates'][n['template']]
        if Ts.get('exitObject'):
            tr = 'objectFillScreen'
        elif s['template'] == n['template']:
            tr = 'whipPan'                                 # même monde, plan suivant de la même phrase
        elif s['text']['preset'] in ('heavySentence', 'stackPile', 'impactScatter'):
            tr = 'impactFlash'
        elif (Ts['family'] == '3d') != (Tn['family'] == '3d'):
            tr = 'zoomThroughObject' if used_trans.get('zoomThroughObject', 0) < 2 else 'flyThrough'
        elif 'neon' in (Ts['family'], Tn['family']):
            tr = 'glitch'
        elif Tn['family'] in ('drawing', 'cartoon'):
            tr = 'liquid'
        else:
            order = ['whipPan', 'perspectiveCube', 'starShape', 'splitReveal', 'particles', 'rotateSpin', 'irisFromPoint', 'dropFall']
            tr = min(order, key=lambda x: (used_trans.get(x, 0), order.index(x)))
        if used_trans.get(tr, 0) >= 2 and tr not in ('objectFillScreen',):
            tr = min(['whipPan', 'perspectiveCube', 'starShape', 'splitReveal', 'particles', 'rotateSpin'], key=lambda x: used_trans.get(x, 0))
        used_trans[tr] = used_trans.get(tr, 0) + 1
        s['transition_out'] = {'preset': tr, 'cause': TP[tr]['cause']}
    scenes[-1]['transition_out'] = {'preset': None, 'cause': 'fin du clip'}
    sb = {'project': PJ, 'audio_analysis': os.path.relpath(a.audio, ROOT), 'lyrics_source': os.path.relpath(a.lyrics, ROOT),
          'song': {k: L.get(k) for k in ('artist', 'title', 'album', 'n_sources', 'sync_confidence')},
          'duration': D, 'scenes': scenes}
    json.dump(sb, open(a.out, 'w'), indent=1, ensure_ascii=False)
    for s in scenes:
        print(f"{s['id']} {s['start']:5.2f}-{s['end']:5.2f} {s['template']:14s} {s['text']['preset']:14s} imp={s['text']['important']!r:12s} → {s['transition_out']['preset']}")


if __name__ == '__main__':
    main()
