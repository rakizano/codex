#!/usr/bin/env python3
"""Télécharge des polices Google Fonts (libres, OFL) et écrit <projet>/fonts.css.

Usage :
  python3 fonts.py --project <dossier> "Anton" "Playfair Display:700,900" "Space Mono:400"

Les fichiers TTF sont mis en cache dans ../cache/fonts/ (réutilisés d'un clip à l'autre).
"""
import argparse
import os
import re
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '..', 'cache', 'fonts')
UA = 'clip-fonts/1.0'  # UA minimal => Google renvoie un TTF complet (non sous-ensemble)


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def get_family(spec):
    fam, _, weights = spec.partition(':')
    weights = [w.strip() for w in weights.split(',') if w.strip()] or ['400']
    faces = []
    for w in weights:
        safe = re.sub(r'[^A-Za-z0-9]', '', fam) + f'-{w}.ttf'
        dst = os.path.join(CACHE, safe)
        if not os.path.exists(dst):
            q = urllib.parse.quote(fam) + (f':wght@{w}' if w != '400' else '')
            css = fetch(f'https://fonts.googleapis.com/css2?family={q}').decode()
            m = re.search(r'url\((https://[^)]+)\)', css)
            if not m:
                # certaines familles n'ont pas la graisse demandée : on prend la régulière
                css = fetch(f'https://fonts.googleapis.com/css2?family={urllib.parse.quote(fam)}').decode()
                m = re.search(r'url\((https://[^)]+)\)', css)
            if not m:
                raise SystemExit(f'Police introuvable sur Google Fonts : {fam}')
            data = fetch(m.group(1))
            os.makedirs(CACHE, exist_ok=True)
            with open(dst, 'wb') as f:
                f.write(data)
        faces.append((fam, w, os.path.abspath(dst)))
    return faces


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--project', required=True)
    ap.add_argument('families', nargs='+')
    a = ap.parse_args()
    css = []
    for spec in a.families:
        for fam, w, p in get_family(spec):
            css.append(f"@font-face {{ font-family: '{fam}'; font-weight: {w}; src: url('file://{p}') format('truetype'); }}")
            print(f'OK  {fam} {w}  ->  {p}')
    with open(os.path.join(a.project, 'fonts.css'), 'w') as f:
        f.write('\n'.join(css) + '\n')


if __name__ == '__main__':
    sys.exit(main())
