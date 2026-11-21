#!/usr/bin/env python3
"""SceneDirector → HyperFrames : compile storyboard.json en compositions HyperFrames.

  python3 tools/build.py [--storyboard storyboard.json] [--no-audio]

Écrit :
  compositions/<id>.html  — une sous-composition par scène (gabarit templates/<template>.html + configuration)
  index.html              — composition racine 1080×1920 : hôtes des scènes (chevauchés de la durée des
                            transitions), piste audio, analyse audio (window.HFS_AUDIO), bibliothèques locales
  assets/lib/hfs/presets.js — préréglages typographiques (depuis config/animation-presets.json)
Timeline : la frontière entre deux scènes B est le début de la scène suivante ; une transition de durée d fait
chevaucher les hôtes sur [B − d/2, B + d/2] ; la sortante joue son geste de sortie, l'entrante (au-dessus) son entrée.
"""
import argparse
import html
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIBS = ['assets/lib/gsap.min.js', 'assets/lib/CustomEase.min.js', 'assets/lib/three.min.js', 'assets/lib/font3d-helvetiker-bold.js',
        'assets/lib/hfs/core.js', 'assets/lib/hfs/kinetic.js', 'assets/lib/hfs/presets.js', 'assets/lib/hfs/stage.js',
        'assets/lib/hfs/characters.js', 'assets/lib/hfs/three-kit.js', 'assets/lib/hfs/boot.js']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--storyboard', default=os.path.join(ROOT, 'storyboard.json'))
    ap.add_argument('--no-audio', action='store_true')
    a = ap.parse_args()
    SB = json.load(open(a.storyboard))
    PJ = SB['project']
    TP = json.load(open(os.path.join(ROOT, 'config/transition-presets.json')))
    AP = json.load(open(os.path.join(ROOT, 'config/animation-presets.json')))
    AU = json.load(open(os.path.join(ROOT, SB.get('audio_analysis', 'config/audio.json'))))
    D = SB['duration']
    open(os.path.join(ROOT, 'assets/lib/hfs/presets.js'), 'w').write('/* généré par tools/build.py depuis config/animation-presets.json */\nwindow.HFS.kt.presets = ' + json.dumps({k: v for k, v in AP.items() if not k.startswith('_')}, ensure_ascii=False) + ';\n')
    fonts = ''.join(f"@font-face {{ font-family: '{fam}'; src: url('assets/fonts/{fn}'); font-display: block; }}\n    " for fam, fn in PJ['fonts'].items())
    scenes = SB['scenes']
    hosts = []
    os.makedirs(os.path.join(ROOT, 'compositions'), exist_ok=True)
    for f in os.listdir(os.path.join(ROOT, 'compositions')):
        if f.startswith('s') and f.endswith('.html'):
            os.remove(os.path.join(ROOT, 'compositions', f))
    for i, s in enumerate(scenes):
        trin = (TP.get((scenes[i - 1].get('transition_out') or {}).get('preset') or '', None) if i else None)
        trout = TP.get((s.get('transition_out') or {}).get('preset') or '', None)
        din = trin['dur'] if trin else 0
        dout = trout['dur'] if trout else 0
        h0 = max(0.0, s['start'] - din / 2) if i else 0.0
        h1 = min(D, s['end'] + dout / 2) if i < len(scenes) - 1 else D
        tin = dict(trin['in'], dur=din, delay=(trin['in'].get('delay', 0) * din / max(1e-6, trin['dur'])) if trin else 0) if trin else None
        tout = dict(trout['out'], dur=dout) if trout else None
        if tout and tout['kind'] == 'objectFill':
            tout['color'] = (scenes[i + 1].get('params') or {}).get('bg', '#071226')
        # repères : mot (ou « all:mot ») → instants LOCAUX où ce mot est chanté dans la scène
        cues = {}
        if s.get('text') and s.get('cues'):
            import re as _re, unicodedata as _u
            nz = lambda w: _re.sub(r"[^a-z0-9]", '', _u.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode().split("'")[-1])
            toks = s['lyrics'].split(); wt = s['text']['words']
            for name, spec in s['cues'].items():
                specs = spec if isinstance(spec, list) else [spec]
                ts = []
                for sp in specs:
                    allm = str(sp).startswith('all:'); w0 = nz(str(sp)[4:] if allm else str(sp))
                    hits = [wt[i] for i, tk in enumerate(toks) if nz(tk) == w0 or nz(tk).startswith(w0) and len(w0) >= 3]
                    ts += hits if allm else hits[:1]
                cues[name] = [round(x - h0, 3) for x in sorted(ts)]
        cfg = {'cues': cues, 'fonts': list(PJ['fonts'].keys()), 'id': s['id'], 'dur': round(h1 - h0, 3), 't0': round(h0, 3), 'text': s['text'], 'params': s.get('params') or {}, 'camera': {k: v for k, v in (s.get('camera') or {}).items() if k != 'label'} or None, 'tin': tin, 'tout': tout}
        tpl = open(os.path.join(ROOT, 'templates', s['template'] + '.html')).read()
        out = tpl.replace('__ID__', s['id']).replace('__FONTS__', fonts).replace('__CFG__', json.dumps(cfg, ensure_ascii=False))
        open(os.path.join(ROOT, 'compositions', s['id'] + '.html'), 'w').write(out)
        hosts.append(f'      <div id="{s["id"]}" data-composition-id="{s["id"]}" data-composition-src="compositions/{s["id"]}.html" data-start="{h0:.3f}" data-duration="{h1 - h0:.3f}" data-track-index="{1 + i % 2}" data-track-kind="graphics" data-width="1080" data-height="1920" style="z-index:{10 + i}"></div>')
    audio = {k: AU.get(k, []) for k in ('beats', 'kicks', 'impacts', 'snares', 'onsets', 'silences', 'rises', 'sections')}
    audio_tag = '' if a.no_audio else f'      <audio id="music" class="clip" src="{PJ["audio"]}" data-start="0" data-duration="{D}" data-volume="1" data-track-index="5"></audio>\n'
    idx = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <title>{html.escape(PJ.get("title", "clip"))}</title>
{chr(10).join(f'    <script src="{l}"></script>' for l in LIBS)}
    <script>window.HFS_AUDIO = {json.dumps(audio)};</script>
    <style>* {{ margin: 0; padding: 0; box-sizing: border-box; }} html, body {{ width: 1080px; height: 1920px; overflow: hidden; background: #000; }}</style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="1080" data-height="1920">
{chr(10).join(hosts)}
{audio_tag}    </div>
    <script>window.__timelines = window.__timelines || {{}}; window.__timelines["main"] = gsap.timeline({{ paused: true }});</script>
  </body>
</html>
'''
    open(os.path.join(ROOT, 'index.html'), 'w').write(idx)
    print(f'{len(scenes)} scènes compilées → index.html + compositions/ (durée {D} s)')


if __name__ == '__main__':
    main()
