#!/usr/bin/env python3
"""Réalisation manuelle assistée : config/direction.json (intention par phrase) + paroles calées → storyboard.json.

  python3 tools/direct.py [--direction config/direction.json] [--duration 59.95]

Le réalisateur (humain ou assistant) choisit pour chaque phrase le monde, l'animation du texte, le mot important et
les actions déclenchées par les mots (cues). Ce script fait le reste, de façon déterministe :
  • plans : début juste avant le 1er mot chanté (0,12 s), fin au début du plan suivant (le texte reste à l'écran
    jusqu'au plan suivant : jamais de texte qui disparaît trop tôt) ;
  • tenue minimale : si la fin du plan arrive moins de 0,9 s après le dernier mot, pas d'animation de sortie (le texte
    part avec la transition) ;
  • effet du mot important calé sur l'impact musical fort le plus proche (−0,1 / +0,35 s), sinon sur le mot ;
  • transitions choisies par visual_director (même logique : provoquées par le contenu, sans répétition).
"""
import argparse
import json
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nz(w):
    return re.sub(r"[^a-z0-9]", '', unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode().split("'")[-1])


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
    ap.add_argument('--direction', default=os.path.join(ROOT, 'config/direction.json'))
    ap.add_argument('--duration', type=float)
    ap.add_argument('--out', default=os.path.join(ROOT, 'storyboard.json'))
    a = ap.parse_args()
    DR = json.load(open(a.direction))
    VP = json.load(open(os.path.join(ROOT, 'config/visual-presets.json')))
    TP = json.load(open(os.path.join(ROOT, 'config/transition-presets.json')))
    PJ = json.load(open(os.path.join(ROOT, 'config/project.json')))
    AU = json.load(open(os.path.join(ROOT, 'config/audio.json')))
    L = json.load(open(os.path.join(ROOT, 'input/lyrics_sound.json')))
    D = a.duration or PJ['duration']
    lines = [l for l in L['lines'] if l['text'].strip()]
    impacts = AU.get('impacts', [])
    scenes = []
    for k, sh in enumerate(DR['shots']):
        l = lines[sh['line']]
        toks = l['text'].split(); wt = [l['words_sound_t'][str(i)] for i in range(len(toks))]
        i0, i1 = sh.get('from', 0), sh.get('to', len(toks))
        toks, wt = toks[i0:i1], wt[i0:i1]
        T = VP['templates'][sh['template']]
        imp = sh.get('important') or max(toks, key=len)
        idx = next((i for i, tk in enumerate(toks) if nz(tk) == nz(imp)), len(toks) - 1)
        near = [x for x in impacts if wt[idx] - .1 <= x <= wt[idx] + .35]
        tx = dict(T['text'])
        maxc = 11 if sh['preset'] in ('brutalGiant', 'materialize3D', 'toCamera', 'rebuild') else 13
        tx.update({'text': wrap(toks, maxc), 'words': [round(x, 3) for x in wt], 'important': imp, 'impact': round(near[0] if near else wt[idx] + .03, 3), 'preset': sh['preset'], 'intensity': 1.1})
        if sh['preset'] == 'stackPile':
            tx.update({'pos': 'upper', 'align': 'center'})
        scenes.append({'id': f's{k + 1:02d}', 'start': None, 'end': None, 'lyrics': ' '.join(toks), 'line': l['text'], 'template': sh['template'], 'style': T['family'], 'reading': T['reading'],
                       'description': sh.get('intent', T['main']), 'characters': T['characters'], 'objects': T['objects'], 'decor': T['decor'], 'camera': {'label': T['camera']},
                       'animations': {'main': T['main'], 'secondary': T['secondary']}, 'text': tx, 'params': sh.get('params', {}), 'cues': sh.get('cues', {}), 'sfx': [],
                       'analysis': {'important': imp, 'impact': tx['impact'], 'intent': sh.get('intent')}, '_first': wt[0], '_last': wt[-1]})
    for i, s in enumerate(scenes):
        s['start'] = 0.0 if i == 0 else round(max(scenes[i - 1]['_last'] + .25, s['_first'] - .12), 3)
    for i, s in enumerate(scenes):
        s['end'] = round(scenes[i + 1]['start'] if i + 1 < len(scenes) else D, 3)
        hold = s['end'] - s['_last']
        s['text']['outAt'] = round(s['end'] - .25, 3) if hold >= .9 else round(s['end'] + 5, 3)   # pas de sortie : le texte part avec la transition
        s['analysis']['hold_after_last_word'] = round(hold, 2)
        del s['_first'], s['_last']
    used = {}
    for i, s in enumerate(scenes[:-1]):
        n = scenes[i + 1]; Ts = VP['templates'][s['template']]; Tn = VP['templates'][n['template']]
        if s['template'] == n['template']:
            tr = 'whipPan'
        elif s['text']['preset'] in ('heavySentence', 'stackPile', 'lettersRain'):
            tr = 'impactFlash'
        elif (Ts['family'] == '3d') != (Tn['family'] == '3d'):
            tr = 'zoomThroughObject' if used.get('zoomThroughObject', 0) < 2 else 'flyThrough'
        elif 'neon' in (Ts['family'], Tn['family']):
            tr = 'glitch'
        elif Tn['family'] in ('drawing', 'cartoon'):
            tr = 'liquid'
        else:
            order = ['whipPan', 'perspectiveCube', 'starShape', 'splitReveal', 'rotateSpin', 'irisFromPoint', 'dropFall', 'flyThrough']
            tr = min(order, key=lambda x: (used.get(x, 0), order.index(x)))
        if used.get(tr, 0) >= 3:
            tr = min(['whipPan', 'perspectiveCube', 'starShape', 'splitReveal', 'rotateSpin', 'dropFall'], key=lambda x: used.get(x, 0))
        used[tr] = used.get(tr, 0) + 1
        s['transition_out'] = {'preset': tr, 'cause': TP[tr]['cause']}
    scenes[-1]['transition_out'] = {'preset': None, 'cause': 'fin du clip'}
    sb = {'project': PJ, 'audio_analysis': 'config/audio.json', 'lyrics_source': 'input/lyrics_sound.json', 'direction': os.path.relpath(a.direction, ROOT),
          'song': {k: L.get(k) for k in ('artist', 'title', 'album', 'n_sources', 'sync_confidence')}, 'duration': D, 'scenes': scenes}
    json.dump(sb, open(a.out, 'w'), indent=1, ensure_ascii=False)
    for s in scenes:
        print(f"{s['id']} {s['start']:5.2f}-{s['end']:5.2f} {s['template']:13s} {s['text']['preset']:13s} tenue {s['analysis']['hold_after_last_word']:4.2f}s  {s['lyrics'][:46]}")


if __name__ == '__main__':
    main()
