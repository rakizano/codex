#!/usr/bin/env python3
"""Contrôle de cadrage : analyse <projet>/build/framing.json (produit par render.mjs --framing).

  python3 framing.py <projet>        → build/framing_report.json + résumé ; code 1 si erreur bloquante

Sujets clés = éléments marqués data-key (personnages automatiquement, objets via S.key()).
Problèmes détectés, à 3 instants de chaque scène :
  COUPÉ       le sujet dépasse du cadre 1080×1920 (> 6 % de sa largeur ou hauteur)      [allow 'cut' pour l'ignorer]
  SOUS_TEXTE  le sujet est recouvert par un bloc de paroles (> 18 % de sa surface)    [allow 'text']
  ZONE_UI     le sujet est sous les boutons TikTok (droite) ou la légende (bas) > 35 % [allow 'ui']
  MINUSCULE   le sujet occupe moins de 0,4 % de l'image (illisible sur téléphone)
Erreurs bloquantes : COUPÉ et SOUS_TEXTE (> 35 %). Le reste : avertissements.
"""
import json
import os
import sys

W, H = 1080, 1920
UI_RIGHT = (920, 640, W, 1560)    # colonne des boutons TikTok
UI_BOTTOM = (0, 1560, W, H)       # légende + barre musique


def inter(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    return max(0, x1 - x0) * max(0, y1 - y0)


def main():
    P = sys.argv[1]
    d = json.load(open(os.path.join(P, 'build', 'framing.json')))
    issues = {}
    for s in d['samples']:
        r = (s['x'], s['y'], s['x'] + s['w'], s['y'] + s['h'])
        area = max(1, s['w'] * s['h'])
        allow = s['allow']
        found = []
        out_x = max(0, -r[0]) + max(0, r[2] - W)
        out_y = max(0, -r[1]) + max(0, r[3] - H)
        if 'cut' not in allow and (out_x > .06 * s['w'] or out_y > .06 * s['h']):
            found.append(('COUPÉ', f"dépasse de {out_x:.0f}px en largeur / {out_y:.0f}px en hauteur", True))
        if 'text' not in allow:
            cov = max([inter(r, (q['x'], q['y'], q['x'] + q['w'], q['y'] + q['h'])) for q in s['text']] or [0]) / area
            if cov > .18:
                found.append(('SOUS_TEXTE', f"{cov:.0%} du sujet sous les paroles", cov > .35))
        if 'ui' not in allow:
            ui = (inter(r, UI_RIGHT) + inter(r, UI_BOTTOM)) / area
            if ui > .35:
                found.append(('ZONE_UI', f"{ui:.0%} sous l'interface TikTok", False))
        if area < .004 * W * H:
            found.append(('MINUSCULE', f"{area / (W * H):.2%} de l'image", False))
        for code, msg, block in found:
            k = (s['scene'], s['key'], code)
            if k not in issues or (block and not issues[k]['bloquant']):
                issues[k] = {'scene': s['scene'], 'sujet': s['key'], 'probleme': code, 'detail': msg, 't': s['t'], 'bloquant': block,
                             'boite': [round(v) for v in r]}
    lst = sorted(issues.values(), key=lambda i: (i['scene'], i['probleme']))
    rep = {'ok': not any(i['bloquant'] for i in lst), 'n_problemes': len(lst), 'problemes': lst}
    json.dump(rep, open(os.path.join(P, 'build', 'framing_report.json'), 'w'), indent=1, ensure_ascii=False)
    for i in lst:
        print(f"{'❌' if i['bloquant'] else '⚠️ '} {i['scene']} t={i['t']:.1f}s  {i['sujet']:<12} {i['probleme']:<10} {i['detail']}")
    print(json.dumps({'ok': rep['ok'], 'n_problemes': rep['n_problemes']}))
    return 0 if rep['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
