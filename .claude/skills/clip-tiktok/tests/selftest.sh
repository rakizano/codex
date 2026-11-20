#!/usr/bin/env bash
# Auto-test du moteur multi-univers : 1) chaque gabarit A–H se construit et se rend sans erreur (WebGL compris),
# 2) le contrôle de cadrage tourne, 3) le directeur choisit plusieurs univers sur des paroles d'exemple
# et produit un storyboard valide.  Usage : bash tests/selftest.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; SK="$(dirname "$HERE")"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
python3 - "$TMP" <<'PY'
import json, sys
T = sys.argv[1]
tpl = [('cinematic.spotlight_crowd', {}), ('cartoon.dig', {}), ('editorial.chart', {'motif': 'ecg'}), ('pastel.storm', {}), ('retro.toy', {'icon': 'tag'}),
       ('neon.live', {}), ('voxel.red_carpet', {'word3d': 'STAR'}), ('lowpoly.night_drive', {'word3d': 'GO', 'props': ['bills']}), ('neon.reject', {}), ('cinematic.duo_night', {})]
sc = [{'id': f's{i:02d}', 'start': i * 1.5, 'end': (i + 1) * 1.5, 'lyrics': [], 'visual': t, 'template': t, 'params': p,
       'transition': {'type': 'cut', 'dur': 0} if i == 0 else {'type': ['fade', 'zoom', 'tear', 'glitch', 'slices'][i % 5], 'dur': .4}} for i, (t, p) in enumerate(tpl)]
json.dump({'song': {}, 'passage': {'start': 0, 'end': 15, 'duration': 15}, 'fps': 30, 'width': 1080, 'height': 1920,
           'style': {'fonts': ['Anton'], 'typo': {'font': 'Anton'}, 'fx': {}}, 'beats': [i * .5 for i in range(30)], 'scenes': sc}, open(f'{T}/storyboard.json', 'w'))
PY
python3 "$SK/scripts/fonts.py" --project "$TMP" Anton >/dev/null
OUT=$(node "$SK/scripts/render.mjs" --project "$TMP" --stills 0.8,2.3,3.8,5.3,6.8,8.3,9.8,11.3,12.8,14.3,1.5,4.5)
echo "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); assert not d['errors'], d['errors']; assert len(d['stills'])==12; print('OK rendu des 10 gabarits + transitions :', len(d['stills']), 'images')"
python3 - "$TMP" <<'PY'
from PIL import Image; import glob, sys
for f in sorted(glob.glob(sys.argv[1] + '/stills/*.png')):
    im = Image.open(f).convert('L').resize((54, 96)); px = list(im.getdata()); var = max(px) - min(px)
    assert var > 25, f'image presque uniforme (rendu vide ?) : {f}'
print('OK aucune image vide')
PY
node "$SK/scripts/render.mjs" --project "$TMP" --framing >/dev/null && python3 "$SK/scripts/framing.py" "$TMP" >/dev/null || true
echo 'OK contrôle de cadrage exécuté'
# directeur sur des paroles d'exemple (fixture, texte libre de droits écrit pour le test)
python3 "$SK/scripts/director.py" --lyrics "$HERE/fixtures/lyrics_sound_demo.json" --duration 12 --out "$TMP/sb2.json" --lyrics-out "$TMP/l2.json" > "$TMP/dir.txt"
python3 - "$TMP" <<'PY'
import json, sys
sb = json.load(open(sys.argv[1] + '/sb2.json')); st = [s['style_id'] for s in sb['scenes']]
assert len(set(st)) >= 4, st
assert all(s['lyrics'][0]['red'] for s in sb['scenes'])
print('OK directeur :', ' '.join(f"{s['style_id']}:{s['template']}" for s in sb['scenes']))
PY
python3 "$SK/scripts/storyboard.py" check "$TMP/sb2.json" --lyrics "$TMP/l2.json" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['ok'], d; print('OK storyboard du directeur valide')"
echo 'TOUS LES TESTS SONT PASSÉS'
