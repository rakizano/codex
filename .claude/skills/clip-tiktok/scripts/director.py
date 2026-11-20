#!/usr/bin/env python3
"""Directeur artistique automatique (SceneDirector + VisualStyleSelector + Timeline + AudioSync).

À partir des paroles synchronisées sur le son (lyrics_sound.json, issu de tiktok_sound_match.py) et de
l'analyse audio (audio.json), produit un storyboard.json complet, rendu SANS scenes.js grâce aux
gabarits des 8 univers (engine/scenes/*.js) :

  python3 director.py --lyrics <work>/lyrics_sound.json --audio <work>/audio.json --duration 23.9 \
      --out <projet>/storyboard.json [--lyrics-out <work>/lyrics_sound_scenes.json] [--seed 1]

Pour chaque phrase :
  1. Sens : catégories (solitude, amour, argent, voiture, réussite, réseaux, humour, douleur, rétro, colère, nuit)
     détectées par lexique pondéré (config/styles.json), émotion dominante.
  2. Mot-clé : le mot porteur de la catégorie dominante devient le mot coloré (couleur selon le sens,
     ex. argent = or, tristesse = bleu, amour = rose, colère = rouge), jamais appliqué à l'aveugle :
     la couleur est ensuite harmonisée avec l'univers de la scène.
  3. Univers : score = Σ poids(style, catégorie) − pénalité de répétition (même style que la scène
     précédente) − usure (style déjà beaucoup utilisé) → changement de style justifié par le sens.
  4. Mise en scène : gabarit de l'univers + paramètres déduits des mots (mot 3D, motif, icône, accessoires).
  5. Timeline / AudioSync : coupes calées sur les débuts de phrases entendus, recalées sur la pulsation
     la plus proche (±0,12 s) ; mots horodatés par la reconnaissance vocale ; transition d'entrée choisie
     par l'univers entrant (plus marquée quand l'univers change).
Aucune parole n'est modifiée ni inventée : le texte affiché est celui de la source.
"""
import argparse
import json
import os
import re
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
NEG = {'pas', 'jamais', 'rien', 'bloque', 'refuse', 'non', 'ptou'}


def norm(w):
    w = unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode()
    return re.sub(r"[^a-z0-9']", '', w)


def tokens(text):
    return text.split()


def core(tok):
    """mot plein sans élision ni ponctuation : qu'j'suis -> suis ; d'la -> la ; Ade' -> ade"""
    t = norm(tok).strip("'")
    return t.split("'")[-1] if "'" in t else t


def wrap(text, maxc=14):
    lines, cur = [], ''
    for w in text.split():
        if cur and len(cur) + 1 + len(w) > maxc:
            lines.append(cur); cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur:
        lines.append(cur)
    return ' / '.join(lines)


def analyse(text, CFG):
    cats = {c: [norm(x) for x in ws] for c, ws in CFG['categories'].items()}
    toks = tokens(text)
    hits = {}
    for i, tk in enumerate(toks):
        c0 = core(tk)
        for c, ws in cats.items():
            if c0 and (c0 in ws or any(len(w) > 4 and c0.startswith(w[:5]) for w in ws)):
                hits.setdefault(c, []).append(i)
    return toks, hits


def pick_red(toks, hits, cat_order, weights=None):
    # mot porteur : catégories de l'univers (poids), mot multi-sens (ex. « prix » = argent + rétro), nom propre
    cand = {}
    for c in cat_order:
        for i in hits.get(c, []):
            if len(core(toks[i])) >= 3:
                sc = cand.get(i, (0, c))[0] + (weights or {}).get(c, .5) + 1
                cand[i] = (sc, cand.get(i, (0, c))[1])
    for i in list(cand):
        if i > 0 and toks[i][:1].isupper():
            cand[i] = (cand[i][0] + 3, cand[i][1])
    if cand:
        i = max(cand, key=lambda j: (cand[j][0], j))   # à égalité : le mot le plus tardif (rime, chute de la phrase)
        return i, cand[i][1]
    # repli : mot le plus long (hors mots outils)
    stop = {'que', 'qui', 'pour', 'dans', 'alors', 'elles', 'sont', 'mais', 'avec', 'tout', 'cette', 'comme'}
    best = max(range(len(toks)), key=lambda i: (len(core(toks[i])) if core(toks[i]) not in stop else 0))
    return best, None


def extrude(color='#4a0008', depth=14, angle=60, blur=18):
    import math
    out = [f"{math.cos(math.radians(angle)) * i:.1f}px {math.sin(math.radians(angle)) * i:.1f}px 0 {color}" for i in range(1, depth + 1)]
    out.append(f"{math.cos(math.radians(angle)) * depth * 1.8:.1f}px {math.sin(math.radians(angle)) * depth * 2.2:.1f}px {blur}px rgba(0,0,0,.35)")
    return ', '.join(out)


ZRED, ZBLACK, ZYEL = '#c8102e', '#0d0d0d', '#ffd400'
ZINE_FONTS = ['Anton', 'Tinos:700', 'Special Elite', 'Oswald:700']
ZSTATE = {}


def zine_choice(k, toks, catscore, words_core, red, dur):
    """Style maison « zine collage N&B » : décor selon le sens, traitement typographique selon la longueur de phrase,
    en évitant de répéter deux fois de suite le même traitement."""
    n = len(toks)
    if 'money' in catscore:
        tpl, params = ('zine.collage', {'base': 'door' if k % 2 else 'paper', 'n': 7}) if k % 3 != 2 else ('zine.spot', {})
    elif 'place' in catscore or 'night' in catscore:
        tpl, params = 'zine.cite', {}
    elif {'solitude', 'love', 'pain', 'anger'} & set(catscore) or k % 4 == 0:
        tpl, params = 'zine.door', {'action': 'sway' if k % 2 else 'breathe'}
    else:
        tpl, params = 'zine.blank', {'bars': k % 2 == 0}
    alt = ['zine.door', 'zine.blank', 'zine.cite']
    if tpl == ZSTATE.get('tpl'):
        tpl = next(x for x in alt if x != tpl); params = {'bars': True} if tpl == 'zine.blank' else {}
    ZSTATE['tpl'] = tpl
    if n <= 5:
        cand = ['extrude', 'boxserif', 'ransom']
    elif n <= 9:
        cand = ['labels', 'ransom', 'boxserif']
    else:
        cand = ['typewriter', 'labels']
    used = ZSTATE.setdefault('used', {})
    t = min([c for c in cand if c != ZSTATE.get('prev')] or cand, key=lambda c: (used.get(c, 0), cand.index(c)))
    used[t] = used.get(t, 0) + 1; ZSTATE['prev'] = t
    base = {'case': 'upper', 'align': 'left', 'pos': 'top', 'exit': 'none', 'emphasis': 'shake', 'step': 12, 'lineHeight': 1.02, 'shadow': 'none', 'wordIn': .1}
    if t == 'labels':
        typo = dict(base, font='Anton', size=118, enter='stamp', color='#fff', red=ZBLACK, _maxc=12,
                    lineStyles=[{'bg': ZRED, 'color': '#fff', 'indent': 0, 'redBg': ZYEL, 'redColor': ZBLACK}, {'bg': ZBLACK, 'color': '#fff', 'indent': 110, 'size': .82, 'redBg': ZYEL, 'redColor': ZBLACK},
                                {'bg': ZYEL, 'color': ZBLACK, 'indent': 30, 'size': 1.12, 'rotate': -2, 'redBg': ZRED, 'redColor': '#fff'}, {'bg': '#ffffff', 'color': ZBLACK, 'indent': 160, 'size': .9, 'redBg': ZRED, 'redColor': '#fff'}])
    elif t == 'ransom':
        typo = dict(base, font='Anton', size=150, enter='ransom', color=ZBLACK, red=ZRED, pos='center', align='center', _maxc=11, maxHeight=900, lineHeight=1.12,
                    ransomFonts=['Anton', 'Tinos', 'Special Elite', 'Oswald'])
    elif t == 'extrude':
        typo = dict(base, font='Tinos', weight=700, size=210, enter='flip', color=ZRED, red=ZRED, pos='center', align='center', spacing=.06, emphasis='none', _maxc=9,
                    extrude={'color': '#4a0008', 'depth': 14, 'angle': 62})
    elif t == 'typewriter':
        typo = dict(base, font='Special Elite', size=86, enter='type', color=ZRED, case='none', red=ZRED, redFont='Anton', redScale=2.6, emphasis='drop', _maxc=18,
                    redShadow=extrude('#3a0006', 12, 60), pos='upper')
    else:
        typo = dict(base, font='Tinos', weight=700, size=128, enter='pop', color='#ffffff', box=ZRED, red=ZYEL, redBox=ZBLACK, redOnBox=ZYEL, pos='center', align='center', _maxc=10)
    tr = [{'type': 'bar', 'dur': .35, 'color': ZBLACK, 'slant': 0, 'width': .7, 'dir': 'right'}, {'type': 'cut', 'dur': 0}, {'type': 'dots', 'dur': .4},
          {'type': 'cut', 'dur': 0}, {'type': 'ink', 'dur': .45}][k % 5]
    params['treatment'] = t
    return tpl, params, typo, tr, ZINE_FONTS


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--lyrics', required=True)
    ap.add_argument('--audio')
    ap.add_argument('--duration', type=float, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--lyrics-out')
    ap.add_argument('--styles', default=os.path.join(HERE, '..', 'config', 'styles.json'))
    ap.add_argument('--intro', type=float, default=0.0, help='durée d\'une scène d\'ouverture sans paroles (0 = aucune)')
    ap.add_argument('--house', help="zine (style maison, défaut de config/styles.json) | multi (8 univers A–H)")
    a = ap.parse_args()
    CFG = json.load(open(a.styles))
    house = a.house or CFG.get('house') or 'multi'
    L = json.load(open(a.lyrics))
    beats = json.load(open(a.audio))['beats'] if a.audio and os.path.exists(a.audio) else []
    D = a.duration
    # 1) phrases entièrement contenues dans le son (on écarte celles coupées par le début ou la fin)
    lines = [l for l in L['lines'] if l['text'].strip() and l['t'] >= -0.05 and l['t'] < D - 0.6 and min(l['end'], l['t'] + 0.42 * len(tokens(l['text'])) + .4) <= D + 0.25]
    dropped = [l['text'] for l in L['lines'] if l['text'].strip() and l not in lines and -3 < l['t'] < D]

    def snap(t):
        if not beats:
            return t
        b = min(beats, key=lambda x: abs(x - t))
        return b if abs(b - t) <= .12 else t

    used, scenes, prev = {}, [], None
    allfonts = set()
    for k, l in enumerate(lines):
        toks, hits = analyse(l['text'], CFG)
        catscore = {c: len(v) for c, v in hits.items()}
        # score des univers
        best, bscore, detail = None, -1e9, {}
        for sid, st in CFG['styles'].items():
            s = sum(st['weights'].get(c, 0) for c in catscore)          # présence du sens (pas le nombre de mots)
            s -= 2.2 if sid == prev else 0
            s -= 1.4 * used.get(sid, 0)
            s += .35 if sid not in used else 0
            detail[sid] = round(s, 2)
            if s > bscore:
                best, bscore = sid, s
        st = CFG['styles'][best]
        order = sorted(catscore, key=lambda c: -(st['weights'].get(c, 0) * 10 + catscore[c]))
        ri, rcat = pick_red(toks, hits, order, st['weights'])
        red_tok = toks[ri]
        m = re.match(r"^(.*['’])([^'’]+)$", red_tok)
        red = m.group(2) if (m and len(core(m.group(2))) >= 3) else red_tok
        red = red.strip(',.!?;:')
        dom = order[0] if order else None
        # gabarit + paramètres
        tpl = st['templates'].get('default')
        if best == 'A' and 'love' in catscore and catscore.get('love', 0) >= catscore.get('solitude', 0):
            tpl = st['templates']['love']
        if best == 'D' and (NEG & {core(x) for x in toks}):
            tpl = st['templates'].get('reject', tpl)
        words_core = {core(x) for x in toks}
        params = {'category': dom, 'keywords': [toks[i] for c in hits for i in hits[c]]}
        if best in ('E', 'H'):
            params['word3d'] = red.strip("'").strip()
        if best == 'E' and 'money' in catscore:
            params['props'] = ['bills']
        if best == 'B':
            params['motif'] = 'ecg' if 'pain' in catscore else 'coins' if 'money' in catscore else 'arrow'
        if best == 'F':
            params['icon'] = 'tag' if words_core & {'prix', 'payer', 'paye'} else 'coin' if 'money' in catscore else 'heart' if 'love' in catscore else 'diamond'
        if best == 'A':
            params['accent'] = {'love': '#ff6aa8', 'anger': '#ff5a3a', 'solitude': '#ffe2b8'}.get(dom, '#ffe2b8')
        # typographie de l'univers + couleur du mot selon le sens, harmonisée avec l'univers
        typo = dict(st['typo'])
        col = CFG['category_colors'].get(rcat or dom or '', '#e10600')
        if best == 'B' and rcat == 'money':
            col = '#b26b00'
        if best == 'F':
            col = '#7a1630'
        if st.get('red'):
            col = st['red']               # couleur imposée par l'univers (lisibilité)
        typo['red'] = col
        if house == 'zine':
            tpl, params, typo, ztr, zf = zine_choice(k, toks, catscore, words_core, red, lines[k]['end'] - lines[k]['t'])
            best, st = 'Z', {'name': 'Zine collage N&B (style maison)', 'fonts': zf, 'transitions': [ztr]}
        for f in st['fonts']:
            allfonts.add(f)
        # timeline (coupe sur la pulsation la plus proche)
        st0 = 0.0 if k == 0 and a.intro <= 0 else snap(max(0.0, l['t'] - .12))
        wst = l.get('words_sound_t') or {}
        n = len(toks)
        times = [wst.get(str(i)) for i in range(n)]
        known = [(i, x) for i, x in enumerate(times) if x is not None]
        for i in range(n):
            if times[i] is None:
                lo = max([kk for kk in known if kk[0] < i], default=None, key=lambda z: z[0])
                hi = min([kk for kk in known if kk[0] > i], default=None, key=lambda z: z[0])
                if lo and hi:
                    times[i] = lo[1] + (hi[1] - lo[1]) * (i - lo[0]) / (hi[0] - lo[0])
                elif lo:
                    times[i] = lo[1] + .18 * (i - lo[0])
                elif hi:
                    times[i] = max(l['t'], hi[1] - .18 * (hi[0] - i))
                else:
                    times[i] = l['t'] + .2 * i
        times = [round(max(l['t'] - .05, x), 3) for x in times]
        tr = st['transitions'][0] if house == 'zine' else st['transitions'][(k + len(used)) % len(st['transitions'])] if best != prev else {'type': 'whip', 'dur': .3, 'dir': 'left'}
        maxc = typo.pop('_maxc', None) or {'F': 14, 'G': 15}.get(best, 13)
        scenes.append({'id': f's{len(scenes):02d}', 'start': round(st0, 3), 'style_id': best, 'style_name': st['name'], 'template': tpl, 'params': params,
                       'typo': typo, 'transition': dict(tr) if k else {'type': 'cut', 'dur': 0},
                       'lyrics': [{'text': wrap(l['text'], maxc), 'words': times, 'start': round(max(l['t'], st0), 3), 'red': red, 'song_t': l.get('song_t'),
                                   'timing': 'mots entendus dans le son (reconnaissance vocale), texte de la source'}],
                       'director': {'categories': catscore, 'dominant': dom, 'red_category': rcat, 'style_scores': detail},
                       'visual': f"[{st['name']}] gabarit {tpl} — sens dominant : {dom or 'neutre'} ; mot-clé « {red} »"})
        used[best] = used.get(best, 0) + 1
        prev = best
    for i, s in enumerate(scenes):
        s['end'] = round(scenes[i + 1]['start'] if i + 1 < len(scenes) else D, 3)
        ly = s['lyrics'][0]
        nxt = lines[i + 1]['t'] if i + 1 < len(lines) else D
        ly['end'] = round(min(s['end'] - .02, max(lines[i]['end'], ly['words'][-1] + .5), nxt - .02 if i + 1 < len(lines) else D), 3)
    sb = {
        'song': {'artist': L.get('artist'), 'title': L.get('title'), 'album': L.get('album'), 'version_duration': L.get('duration'), 'lrclib_ref_id': L.get('lrclib_ref_id'),
                 'sync_confidence': L.get('sync_confidence'), 'sync_spread_median_s': L.get('sync_spread_median_s'), 'n_sources': L.get('n_sources'),
                 'notes': ['Storyboard généré par director.py (choix des univers par le sens des paroles).'] + ([f'Phrases écartées (coupées par les bords du son) : {dropped}'] if dropped else [])},
        'passage': {'start': 0.0, 'end': D, 'duration': D, 'start_fmt': '0:00.000', 'end_fmt': f'0:{D:06.3f}'},
        'fps': 30, 'width': 1080, 'height': 1920,
        'direction': {'concept': 'Montage multi-univers : chaque phrase raconte son sens dans l\'univers graphique qui lui correspond le mieux.',
                      'universes': sorted({s['style_name'] for s in scenes}), 'engine': 'gabarits engine/scenes/*.js + couche 3D Three.js'},
        'house': house,
        'style': {'fonts': sorted(allfonts), 'typo': {'font': 'Anton', 'color': '#ffffff', 'red': '#e10600', 'lineHeight': 1.0, 'wordIn': .14, 'preroll': .02, 'maxHeight': 520, 'width': 830},
                  'fx': {'grain': .09, 'vignette': 0} if house == 'zine' else {'grain': .05, 'vignette': .3}, 'palette': {}},
        'beats': beats, 'outro': {'dur': .4, 'color': '#000000', 'text': True},
        'lyrics_file': os.path.relpath(a.lyrics_out, os.path.dirname(os.path.abspath(a.out))) if a.lyrics_out else None,
        'scenes': scenes,
    }
    json.dump(sb, open(a.out, 'w'), indent=1, ensure_ascii=False)
    if a.lyrics_out:
        LL = {k: v for k, v in L.items() if k != 'lines'}
        LL['lines'] = [{'t': l['t'], 'text': l['text'], 'end': l['end']} for l in lines]
        LL['duration'] = D
        json.dump(LL, open(a.lyrics_out, 'w'), indent=1, ensure_ascii=False)
    for s in scenes:
        print(f"{s['id']} {s['start']:6.2f}-{s['end']:6.2f}  [{s['style_id']}] {s['template']:28s} rouge={s['lyrics'][0]['red']!r:14s} {s['director']['categories']}")
    if dropped:
        print('écartées :', dropped)


if __name__ == '__main__':
    main()
