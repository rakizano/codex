#!/usr/bin/env python3
"""Génère des SceneTemplates à partir d'un squelette commun (fond + calques + script de scène).
Chaque gabarit utilise les mêmes bibliothèques (HFS.kt, HFS.camera, HFS.char, HFS.three…) : même style d'animation,
nouveaux mondes. Usage : python3 tools/make_templates.py  (écrit templates/<nom>.html)"""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKEL = '''<template>
  <style>__FONTS__
    #root {{ position: absolute; inset: 0; overflow: hidden; }}
    #__ID__-stage, #__ID__-stage .lay {{ position: absolute; inset: 0; }}
    #__ID__-stage {{ background: {bg}; }}
    #__ID__-stage svg {{ overflow: visible; }}
    #__ID__-gl {{ position: absolute; inset: 0; width: 1080px; height: 1920px; }}
  </style>
  <div id="root" data-composition-id="__ID__" data-width="1080" data-height="1920">
    <div id="__ID__-stage">
{layers}
      <div id="__ID__-txt"></div>
    </div>
  </div>
  <script>
    /* SceneTemplate « {name} » — {doc} */
    (function () {{
      const CFG = __CFG__;
      HFS.boot('__ID__', CFG, (sc, ctx) => {{
        const P = ctx.P, sv = HFS.svg, m = HFS.m, E = HFS.ease;
{body}
      }});
    }})();
  </script>
</template>
'''
L = lambda *names: '\n'.join(f'      <svg id="__ID__-{n}" class="lay" width="1080" height="1920" viewBox="0 0 1080 1920"></svg>' if not n.startswith('cv:') and n != 'gl' else (f'      <canvas id="__ID__-gl" width="1080" height="1920"></canvas>' if n == 'gl' else f'      <canvas id="__ID__-{n[3:]}" class="lay" width="1080" height="1920"></canvas>') for n in names)
T = {}

T['luxe_window'] = dict(bg='#0b0a10', layers=L('gl', 'cv:dust'), doc="3D : vitrine de luxe la nuit, trois lettres (les mots désirés) en relief chromé tournent sur des socles, projecteurs, reflets de vitre ; la caméra glisse le long de la vitrine.", body='''
        const X = HFS.three(sc, document.getElementById('__ID__-gl'), { bg: 0x0b0a10, fog: [0x0b0a10, 8, 30], exposure: 1.2 }), T = X.T, K = HFS.K3;
        X.add(new T.HemisphereLight(0x40384f, 0x000000, .5));
        const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x1a1720, roughness: .15, metalness: .8 })); floor.rotation.x = -Math.PI / 2; X.add(floor);
        const wall = new T.Mesh(new T.PlaneGeometry(40, 20), new T.MeshStandardMaterial({ color: 0x2a2230, roughness: .9 })); wall.position.set(0, 10, -4); X.add(wall);
        const letters = (P.letters || 'L V G').split(' ').filter(Boolean), items = [];
        letters.forEach((ch, i) => { const x = (i - (letters.length - 1) / 2) * 2.4;
          const ped = new T.Mesh(new T.CylinderGeometry(.75, .85, 1.2, 40), new T.MeshStandardMaterial({ color: 0xf2efe8, roughness: .4 })); ped.position.set(x, .6, 0); ped.castShadow = ped.receiveShadow = true; X.add(ped);
          const t3 = K.text3D(T, ch, { size: 1.3, depth: .4, color: i % 2 ? 0xd9b34a : 0xe8e8ee, side: 0x5a4a30, metalness: .9, roughness: .2 }); t3.position.set(x, 1.25, 0); X.add(t3); items.push(t3);
          const v = K.volumetric(T, { color: 0xfff2d8, length: 7, radius: 1.1, intensity: .45, power: 4 }); v.position.set(x, 7.4, 0); X.add(v); });
        const glass = new T.Mesh(new T.PlaneGeometry(14, 9), new T.MeshStandardMaterial({ color: 0x8fb0ff, transparent: true, opacity: .07, roughness: 0, metalness: 1 })); glass.position.set(0, 4, 3.2); X.add(glass);
        X.update(t => items.forEach((it, i) => { const k = E.outBack(m.clamp((t - ctx.cue('letters', i, .15 + i * .35)) / .35)); it.scale.setScalar(Math.max(.01, k)); it.rotation.y = t * 1.2 + i; it.position.y = 1.25 + sc.beat(t, 'kicks', 9) * .15; }));
        X.camMove('truck', { from: [-4.5, 3.2, 14], to: [4.5, 3.4, 12.5], target: t => new T.Vector3(-1 + t * .8, 1.8, 0), fov0: 42, fov1: 36, ease: 'inOut' });
        const dust = HFS.fx.particles(ctx.layer('dust'), { n: 60, colors: ['#fff2d8'], seed: 3, size: 3 }); sc.update(t => dust(t));''')

T['wardrobe'] = dict(bg='#f4e9e2', layers=L('back', 'rail'), doc="aplats : une penderie, les vêtements glissent sur la tringle, les cintres se balancent, une veste s'envole (physique) ; travelling latéral.", body='''
        const B = ctx.layer('back'), R = ctx.layer('rail'), cols = ['#e8452c', '#2b4c9a', '#f2c94c', '#1b1a17', '#ff6aa8', '#3ddc97'];
        sv('rect', { width: 1080, height: 1920, fill: '#f4e9e2' }, B); for (let x = 0; x < 1080; x += 90) sv('rect', { x, width: 45, height: 1920, fill: '#efe1d8' }, B);
        sv('rect', { x: -200, y: 700, width: 1500, height: 16, rx: 8, fill: '#8a8a92' }, R);
        const hang = []; for (let i = 0; i < 9; i++) { const g = sv('g', {}, R); sv('path', { d: 'M 0 0 q 0 -26 18 -26 M 0 0 L -80 50 L 80 50 Z', fill: 'none', stroke: '#6a6a72', 'stroke-width': 6 }, g);
          sv('path', { d: 'M -80 50 L 80 50 L 95 380 L -95 380 Z', fill: cols[i % cols.length] }, g); sv('path', { d: 'M -80 50 L -120 200 L -95 210 M 80 50 L 120 200 L 95 210', stroke: cols[i % cols.length], 'stroke-width': 34, 'stroke-linecap': 'round' }, g); hang.push(g); }
        const fly = 4, tFly = ctx.cue('fly', 0, sc.dur * .35), tGo = ctx.cue('slide', 0, 0);
        sc.update(t => hang.forEach((g, i) => { const slide = -Math.max(0, t - tGo) * 320, x = 120 + i * 220 + slide, sw = Math.sin(t * 4 + i) * 6 + (i === fly ? 0 : 0);
          if (i === fly && t > tFly) { const u = t - tFly, b = HFS.phys.ballistic(u, 500, -1400, 3600); g.setAttribute('transform', `translate(${x + b.x},${700 + b.y}) rotate(${u * 420})`); }
          else g.setAttribute('transform', `translate(${x},${700}) rotate(${sw})`); }));
        HFS.camera(sc, [{ el: B, depth: .4 }, { el: R, depth: 1 }], Object.assign({ preset: 'truckLeft', amount: .5 }, CFG.camera || {}));''')

T['elevator'] = dict(bg='#1a1416', layers=L('wall', 'doors', 'cv:fx'), doc="aplats : cabine d'ascenseur, l'indicateur d'étage file vers le bas, lueur rouge de l'enfer qui monte par les portes ; ou ascenseur coincé (voyant PANNE qui clignote) côté paradis.", body='''
        const Wl = ctx.layer('wall'), Dr = ctx.layer('doors'), hell = P.mode !== 'stuck';
        sv('rect', { width: 1080, height: 1920, fill: hell ? '#1a1416' : '#dfe9f5' }, Wl);
        const glow = sv('rect', { x: 240, y: 500, width: 600, height: 1100, fill: hell ? '#ff3b1f' : '#ffffff', opacity: .0 }, Wl);
        const panel = sv('g', {}, Wl); sv('rect', { x: 430, y: 300, width: 220, height: 130, rx: 16, fill: '#0b0b0e', stroke: '#8a8a92', 'stroke-width': 6 }, panel);
        const floorTxt = sv('text', { x: 540, y: 395, 'text-anchor': 'middle', 'font-family': 'VT323', 'font-size': 100, fill: hell ? '#ff5a3c' : '#3ddc97' }, panel);
        const arrow = sv('path', { d: 'M 0 -26 L 20 0 L 8 0 L 8 26 L -8 26 L -8 0 L -20 0 Z', fill: hell ? '#ff5a3c' : '#9aa3b5' }, panel);
        const L1 = sv('rect', { y: 500, width: 300, height: 1100, fill: '#b9bcc6', stroke: '#6a6d78', 'stroke-width': 6 }, Dr), R1 = sv('rect', { y: 500, width: 300, height: 1100, fill: '#c5c8d2', stroke: '#6a6d78', 'stroke-width': 6 }, Dr);
        sv('rect', { x: 220, y: 480, width: 640, height: 1140, fill: 'none', stroke: '#4a4d58', 'stroke-width': 40 }, Dr);
        const fx = HFS.fx.particles(ctx.layer('fx'), hell ? { kind: 'sparks', n: 80, colors: ['#ff5a3c', '#ffb03a'], at: ctx.cue('open', 0, sc.dur * .4) + .1, x: 540, y: 1500, seed: 4, size: 6 } : { kind: 'dust', n: 50, colors: ['#ffffff'], seed: 4 });
        sc.update(t => {
          const open = hell ? E.inOut(m.clamp((t - ctx.cue('open', 0, sc.dur * .4)) / .45)) : m.clamp((t - .3) / .25) * .18 * (1 + Math.sin(t * 30) * .3);
          L1.setAttribute('x', 240 - open * 300); R1.setAttribute('x', 540 + open * 300); glow.setAttribute('opacity', hell ? open * .9 : .25);
          const fl = hell ? Math.max(-9, -Math.floor(t * 6)) : 99; floorTxt.textContent = hell ? (fl <= -9 ? '-∞' : String(fl)) : (t >= ctx.cue('panne', 0, 0) && Math.floor(t * 3) % 2 ? 'PANNE' : (t < ctx.cue('panne', 0, 0) ? '∞' : '')); floorTxt.setAttribute('font-size', hell ? 100 : 64);
          arrow.setAttribute('transform', `translate(600,${hell ? 365 + (t * 60 % 20) : 365}) rotate(${hell ? 180 : 0})`); fx(t);
        });
        HFS.camera(sc, [{ el: Wl, depth: .6 }, { el: Dr, depth: 1 }, { el: ctx.layer('fx'), depth: 1 }], Object.assign({ preset: hell ? 'pedestalDown' : 'dollyIn', amount: .5, shake: t => hell ? m.clamp((t - sc.dur * .4) * 2) * 4 : 0 }, CFG.camera || {}));''')

T['stairwell3d'] = dict(bg='#101218', layers=L('gl'), doc="3D : cage d'escalier de tour, un personnage monte les marches en colimaçon, la caméra s'élève au centre (crane) en tournant, néon qui grésille.", body='''
        const X = HFS.three(sc, document.getElementById('__ID__-gl'), { bg: 0x101218, fog: [0x101218, 6, 26], exposure: 1.15 }), T = X.T, K = HFS.K3;
        X.add(new T.HemisphereLight(0x8090a0, 0x101010, .55));
        const mat = new T.MeshStandardMaterial({ color: 0x8a8d96, roughness: .9 }), N = 64;
        for (let i = 0; i < N; i++) { const a = i * .38, s = new T.Mesh(new T.BoxGeometry(2.2, .18, .7), mat); s.position.set(Math.cos(a) * 1.9, i * .22, Math.sin(a) * 1.9); s.rotation.y = -a; s.castShadow = s.receiveShadow = true; X.add(s); }
        const core = new T.Mesh(new T.CylinderGeometry(.45, .45, 16, 20), new T.MeshStandardMaterial({ color: 0x5a5d66 })); core.position.y = 7; X.add(core);
        const neon = new T.PointLight(0xbfe0ff, 2, 10, 2); X.add(neon);
        const hero = K.human(T, { color: 0x1d1922, emissive: 0x220a0a }); X.add(hero);
        X.update(t => { const k = t / sc.dur, i = 4 + k * 22, a = i * .38; hero.position.set(Math.cos(a) * 1.9, i * .22 + .1, Math.sin(a) * 1.9); hero.rotation.y = -a - Math.PI / 2; hero.pose({ walk: t * 8, amt: 1, lean: .12 });
          neon.position.set(0, i * .22 + 2, 0); neon.intensity = HFS.m.noise(t * 10, 3) > -.6 ? 2 : .3; });
        X.camMove('orbit', { center: [0, 2, 0], a0: 0, a1: 1.6, r: () => .25, y: t => (4 + t / sc.dur * 22) * .22 + 5.5, target: t => { const i = 4 + t / sc.dur * 22, a = i * .38; return new T.Vector3(Math.cos(a) * 1.9, i * .22, Math.sin(a) * 1.9); }, fov0: 62, fov1: 52 });   // vue plongeante au centre de la cage''')

T['ballot'] = dict(bg='#f2e8d5', layers=L('bg', 'fg'), doc="éditorial : urne transparente, des bulletins BLANCS tombent au ralenti et s'empilent, le compteur reste à zéro, tampon rouge ; formes géométriques.", body='''
        const B = ctx.layer('bg'), F = ctx.layer('fg'), ink = '#1b1a17', acc = P.accent || '#e8452c';
        for (let y = 760; y < 1500; y += 70) sv('line', { x1: 80, y1: y, x2: 1000, y2: y, stroke: ink, 'stroke-width': 1.5, opacity: .1 }, B);
        sv('path', { d: 'M 300 1000 L 780 1000 L 760 1500 L 320 1500 Z', fill: '#cfe3ff', opacity: .55, stroke: ink, 'stroke-width': 6 }, F); sv('rect', { x: 460, y: 990, width: 160, height: 18, fill: ink }, F);
        const ballots = [...Array(14)].map((_, i) => { const g = sv('g', {}, F); sv('rect', { x: -60, y: -40, width: 120, height: 80, fill: '#ffffff', stroke: '#c9c0aa', 'stroke-width': 3 }, g); return g; });
        const cnt = sv('text', { x: 860, y: 900, 'text-anchor': 'middle', 'font-family': 'Archivo Black', 'font-size': 160, fill: ink }, F); cnt.textContent = '0';
        const stamp = sv('g', {}, F); sv('rect', { x: -170, y: -60, width: 340, height: 120, rx: 10, fill: 'none', stroke: acc, 'stroke-width': 12 }, stamp); const st = sv('text', { 'text-anchor': 'middle', y: 30, 'font-family': 'Archivo Black', 'font-size': 84, fill: acc }, stamp); st.textContent = 'BLANC';
        const tV = ctx.cue('vote', 0, .1);
        sc.update(t => { ballots.forEach((g, i) => { const t0 = tV + i * .12, u = t - t0; if (u < 0) { g.setAttribute('opacity', 0); return; } const land = 1460 - Math.floor(i / 3) * 22; const y = Math.min(land, 300 + u * 520); g.setAttribute('opacity', 1); g.setAttribute('transform', `translate(${540 + Math.sin(u * 3 + i) * (y < land ? 90 : 0) + (i % 3 - 1) * 70},${y}) rotate(${y < land ? Math.sin(u * 4 + i) * 30 : (i * 17 % 20) - 10})`); });
          const ks = E.outBack(m.clamp((t - ctx.cue('stamp', 0, sc.dur * .55)) / .22), 3); stamp.setAttribute('transform', `translate(540,1700) rotate(-12) scale(${ks > 0 ? 2.4 - ks * 1.4 : 0})`); stamp.setAttribute('opacity', ks > 0 ? 1 : 0); });
        HFS.camera(sc, [{ el: B, depth: .4 }, { el: F, depth: 1 }], Object.assign({ preset: 'slowZoom' }, CFG.camera || {}));''')

T['jungle_beat'] = dict(bg='#14321f', layers=L('leaves', 'mid', 'front'), doc="cartoon : jungle aux feuilles qui rebondissent sur les kicks, tambours frappés, personnage cartoon qui danse ; premier plan de feuilles flou.", body='''
        const Lv = ctx.layer('leaves'), Md = ctx.layer('mid'), Fr = ctx.layer('front'), boil = HFS.fx.boil(Md);
        sv('rect', { width: 1080, height: 1920, fill: '#14321f' }, Lv); sv('rect', { y: 1400, width: 1080, height: 520, fill: '#5a3a1e' }, Lv);
        const leaf = (p, x, y, s, r, c) => sv('path', { d: 'M 0 0 Q 120 -70 260 0 Q 120 70 0 0 Z', fill: c, stroke: '#0c1f12', 'stroke-width': 6, transform: `translate(${x},${y}) rotate(${r}) scale(${s})` }, p);
        const back = [...Array(14)].map((_, i) => leaf(Lv, (i * 97) % 1100 - 60, 500 + (i * 151) % 800, 1.4, (i * 47) % 360, ['#2f6b3a', '#3d8a49'][i % 2]));
        const drums = [-1, 1].map(s => { const g = sv('g', {}, Md); sv('rect', { x: -90, y: -160, width: 180, height: 240, rx: 30, fill: '#c9753a', stroke: '#2a1408', 'stroke-width': 8 }, g); const skin = sv('ellipse', { cy: -160, rx: 90, ry: 26, fill: '#f3e2b8', stroke: '#2a1408', 'stroke-width': 8 }, g); g.dataset.s = s; return [g, skin]; });
        const C = HFS.char(Md, { style: 'cartoon', scale: 1.1, track: [{ t: 0, act: 'dance', x: 540, y: 1440, speed: 1.3 }] });
        const front = [...Array(6)].map((_, i) => leaf(Fr, i * 220 - 80, i % 2 ? 1700 : 260, 3.2, i % 2 ? -30 : 160, '#0c2414'));
        sc.update(t => { const b = Math.max(ctx.pulse(t, 'hits', 9), sc.beat(t, 'kicks', 12) * .4); drums.forEach(([g, skin], i) => { g.setAttribute('transform', `translate(${540 + (i ? 300 : -300)},${1420}) scale(${1 + b * .06},${1 - b * .08})`); skin.setAttribute('ry', 26 - b * 10); });
          back.forEach((e, i) => e.style.transform = `translateY(${-b * 10 * (i % 3)}px)`); C.render(t); boil(t); });
        HFS.camera(sc, [{ el: Lv, depth: .3 }, { el: Md, depth: 1 }, { el: Fr, depth: 1.5, blur: 6 }], Object.assign({ preset: 'dollyIn', amount: .6, shake: t => sc.beat(t, 'kicks', 12) * 6 }, CFG.camera || {}));''')

T['crew_beats'] = dict(bg='#0c0c12', layers=L('bg', 'crew'), doc="aplats : trois silhouettes apparaissent une à une, chacune sur un kick, sous leur projecteur ; la dernière s'avance (zoom).", body='''
        const B = ctx.layer('bg'), Cw = ctx.layer('crew');
        sv('rect', { width: 1080, height: 1920, fill: '#0c0c12' }, B); sv('rect', { y: 1480, width: 1080, height: 440, fill: '#16161e' }, B);
        const times = [ctx.cue('guys', 0, .3), ctx.cue('guys', 1, .9), ctx.cue('guys', 2, 1.5)], tServe = ctx.cue('serve', 0, sc.dur * .8);
        const cones = [], guys = [270, 540, 810].map((x, i) => { const cone = sv('path', { d: `M ${x - 30} 200 L ${x + 30} 200 L ${x + 230} 1500 L ${x - 230} 1500 Z`, fill: '#fff2d8', opacity: 0 }, B); cones.push(cone);
          const g = sv('g', {}, Cw); const C = HFS.char(g, { style: i === 1 ? 'flat' : 'silhouette', scale: 1.05, facing: i === 2 ? -1 : 1, track: [{ t: 0, act: 'idle', x, y: 1490 }, { t: tServe, act: i === 1 || i === 2 ? 'reach' : 'idle' }] }); return [g, C]; });
        sc.update(t => guys.forEach(([g, C], i) => { const u = t - times[i], k = E.outBack(m.clamp(u / .25), 2.5); g.setAttribute('opacity', u >= 0 ? 1 : 0); C.render(t); g.style.transform = `translateY(${(1 - k) * 60}px)`; cones[i].setAttribute('opacity', u >= 0 ? .16 + .1 * Math.exp(-u * 6) : 0); }));
        HFS.camera(sc, [{ el: B, depth: .5 }, { el: Cw, depth: 1 }], Object.assign({ preset: 'crashZoom', at: .75 }, CFG.camera || {}));''')

T['color_split'] = dict(bg='#ffd23f', layers=L('split'), doc="graphique : l'écran se coupe en jaune / vert, la frontière ondule et bascule à chaque kick, formes qui roulent ; aplats francs.", body='''
        const S = ctx.layer('split'), Y = P.c1 || '#ffd23f', G = P.c2 || '#2ecc71';
        const crack = sv('path', { d: 'M 540 -50 L 500 400 L 600 700 L 470 1100 L 580 1500 L 520 1980', fill: 'none', stroke: '#111', 'stroke-width': 14, opacity: 0 }, S);
        const a = sv('path', { fill: Y }, S), b = sv('path', { fill: G }, S), dots = [...Array(10)].map((_, i) => sv('circle', { r: 30 + (i % 3) * 20, fill: i % 2 ? Y : G, stroke: '#111', 'stroke-width': 8 }, S));
        S.appendChild(crack);
        sc.update(t => { const k = sc.beat(t, 'kicks', 7), ty = ctx.cue('yellow', 0, null), tg = ctx.cue('green', 0, null), ang = Math.sin(t * 1.5) * 12 + k * 10;
          const tc = ctx.cue('crack', 0, 1e9), mid = ty == null ? 960 + Math.sin(t * 2) * 120 : (t < ty ? 960 + Math.sin(t * 2) * 80 : t < tg ? HFS.m.lerp(960, 2100, E.outExpo(m.clamp((t - ty) / .3))) : t < tc ? HFS.m.lerp(2100, -200, E.outExpo(m.clamp((t - tg) / .3))) : HFS.m.lerp(-200, 960, E.outBack(m.clamp((t - tc) / .35))));
          crack.setAttribute('opacity', t >= ctx.cue('crack', 0, 1e9) ? 1 : 0); crack.setAttribute('stroke-dasharray', '3000'); crack.setAttribute('stroke-dashoffset', 3000 * (1 - m.clamp((t - ctx.cue('crack', 0, 1e9)) / .25))); let d = 'M -100 -100 L 1180 -100 L 1180 ';
          const pts = []; for (let x = 1180; x >= -100; x -= 40) pts.push(`${x} ${mid + Math.tan(ang * Math.PI / 180) * (x - 540) + Math.sin(x / 90 + t * 6) * 30 * (1 + k)}`);
          a.setAttribute('d', d + pts.join(' L ') + ' Z'); b.setAttribute('d', 'M -100 2020 L 1180 2020 L ' + pts.join(' L ') + ' Z');
          dots.forEach((c, i) => { const x = ((i * 230 + t * (i % 2 ? 300 : -300)) % 1400 + 1400) % 1400 - 160; c.setAttribute('cx', x); c.setAttribute('cy', i % 2 ? 600 : 1400); }); });
        HFS.camera(sc, [{ el: S, depth: 1 }], Object.assign({ preset: 'roll', amount: .8 }, CFG.camera || {}));''')

T['kitchen_clock'] = dict(bg='#2b2633', layers=L('room', 'mid'), doc="aplats : cuisine de nuit, frigo qui s'ouvre sur des étagères vides (lumière froide), assiette vide, horloge dont les aiguilles s'emballent (pas le temps).", body='''
        const R = ctx.layer('room'), M = ctx.layer('mid');
        sv('rect', { width: 1080, height: 1920, fill: '#2b2633' }, R); sv('rect', { y: 1350, width: 1080, height: 570, fill: '#1f1b26' }, R);
        const clock = sv('g', { transform: 'translate(820,520)' }, R); sv('circle', { r: 130, fill: '#f4f1ea', stroke: '#111', 'stroke-width': 12 }, clock); for (let i = 0; i < 12; i++) sv('line', { x1: 0, y1: -105, x2: 0, y2: -88, stroke: '#111', 'stroke-width': 6, transform: `rotate(${i * 30})` }, clock);
        const hH = sv('line', { x1: 0, y1: 0, x2: 0, y2: -60, stroke: '#111', 'stroke-width': 12, 'stroke-linecap': 'round' }, clock), mH = sv('line', { x1: 0, y1: 0, x2: 0, y2: -100, stroke: '#e8452c', 'stroke-width': 7, 'stroke-linecap': 'round' }, clock);
        const fr = sv('g', { transform: 'translate(170,700)' }, M); sv('rect', { width: 360, height: 700, rx: 24, fill: '#dfe3ea', stroke: '#6a6d78', 'stroke-width': 6 }, fr); const inside = sv('rect', { x: 14, y: 14, width: 332, height: 672, fill: '#bfe4ff' }, fr);
        for (let i = 1; i < 4; i++) sv('line', { x1: 20, y1: i * 170, x2: 340, y2: i * 170, stroke: '#8fb0cc', 'stroke-width': 8 }, fr);
        const door = sv('rect', { width: 360, height: 700, rx: 24, fill: '#eef0f4', stroke: '#6a6d78', 'stroke-width': 6 }, fr);
        const cold = sv('path', { d: 'M 170 700 L 530 700 L 760 1500 L 0 1500 Z', fill: '#bfe4ff', opacity: 0 }, M);
        const plate = sv('ellipse', { cx: 740, cy: 1330, rx: 150, ry: 36, fill: '#f4f1ea', stroke: '#9aa3b5', 'stroke-width': 6 }, M);
        const shot2 = P.shot === 2, tSlam = ctx.cue('slam', 0, sc.dur * .8);
        const book = sv('g', {}, M); const bl = sv('rect', { x: -170, y: -110, width: 170, height: 220, fill: '#e8452c', stroke: '#111', 'stroke-width': 6 }, book), br = sv('rect', { x: 0, y: -110, width: 170, height: 220, fill: '#f4f1ea', stroke: '#111', 'stroke-width': 6 }, book); book.setAttribute('opacity', shot2 ? 1 : 0);
        if (shot2) { clock.setAttribute('transform', 'translate(540,700) scale(1.9)'); fr.setAttribute('opacity', .25); }
        sc.update(t => { const o = E.inOut(m.clamp((t - ctx.cue('open', 0, .3)) / .5)); if (shot2) { const ks = m.clamp((t - tSlam) / .12); br.setAttribute('transform', `scale(${1 - 2 * E.inCubic(ks)},1)`); book.setAttribute('transform', `translate(540,1250) rotate(${-6 + ks * 6})`); } door.setAttribute('transform', `translate(${o * 330},0) scale(${1 - o * .85},1)`); cold.setAttribute('opacity', o * .25);
          const sp = 1 + Math.pow(m.clamp(t / sc.dur), 2) * 40; mH.setAttribute('transform', `rotate(${t * 60 * sp})`); hH.setAttribute('transform', `rotate(${t * 5 * sp})`); plate.setAttribute('transform', `translate(0,${Math.sin(t * 30) * (t > sc.dur * .6 ? 3 : 0)})`); });
        HFS.camera(sc, [{ el: R, depth: .6 }, { el: M, depth: 1 }], Object.assign({ preset: 'pan', amount: .6 }, CFG.camera || {}));''')

T['ice3d'] = dict(bg='#06121e', layers=L('gl', 'cv:frost'), doc="3D : un glaçon géant transparent tourne sous une lumière froide, il fond lentement (gouttes), givre qui flotte ; la caméra tourne autour.", body='''
        const X = HFS.three(sc, document.getElementById('__ID__-gl'), { bg: 0x06121e, fog: [0x06121e, 6, 24], exposure: 1.25 }), T = X.T;
        X.add(new T.HemisphereLight(0x9fd8ff, 0x051018, .8)); const key = new T.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 4); X.add(key); const rim = new T.PointLight(0x3ff0ff, 3, 12, 2); rim.position.set(-3, 2, -3); X.add(rim);
        const ice = new T.Mesh(new T.BoxGeometry(2.2, 2.2, 2.2, 4, 4, 4), new T.MeshPhysicalMaterial({ color: 0xbfe8ff, roughness: .08, metalness: 0, transmission: .9, thickness: 1.5, transparent: true, opacity: .75, clearcoat: 1 })); ice.position.y = 1.6; X.add(ice);
        const edges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(2.21, 2.21, 2.21)), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6 })); ice.add(edges);
        const puddle = new T.Mesh(new T.CircleGeometry(1, 40), new T.MeshStandardMaterial({ color: 0x5fa8d8, roughness: .05, metalness: .6, transparent: true, opacity: .6 })); puddle.rotation.x = -Math.PI / 2; puddle.position.y = .01; X.add(puddle);
        const ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ color: 0x0a1a28, roughness: .4 })); ground.rotation.x = -Math.PI / 2; X.add(ground);
        X.update(t => { const melt = m.clamp(t / sc.dur) * .35; ice.scale.set(1 - melt * .3, 1 - melt, 1 - melt * .3); ice.position.y = 1.6 * (1 - melt) + .2; ice.rotation.y = t * .6; ice.rotation.x = Math.sin(t * .7) * .2; puddle.scale.setScalar(1 + melt * 3); });
        X.camMove('orbit', { center: [0, 1.3, 0], a0: -.4, a1: .9, r: t => 6 - t * .4, y: 2.4, fov0: 38, fov1: 32 });
        const fr = HFS.fx.particles(ctx.layer('frost'), { kind: 'snow', n: 90, colors: ['#e6f6ff'], seed: 9, size: 3 }); sc.update(t => fr(t));''')

T['balcony'] = dict(bg='#120e26', layers=L('sky', 'house', 'front'), doc="aplats nuit : balcon façon Roméo ; une rose est lancée vers le balcon, le personnage se retourne et croise les bras (refus), la rose retombe ; lune, étoiles.", body='''
        const S = ctx.layer('sky'), Hs = ctx.layer('house'), Fr = ctx.layer('front');
        sv('rect', { width: 1080, height: 1920, fill: '#120e26' }, S); sv('circle', { cx: 820, cy: 420, r: 110, fill: '#f4f1e1' }, S); for (let i = 0; i < 60; i++) sv('circle', { cx: (i * 137) % 1080, cy: (i * 89) % 900, r: 2 + i % 3, fill: '#fff', opacity: .7 }, S);
        sv('rect', { x: 260, y: 700, width: 560, height: 1300, fill: '#3a2a3e' }, Hs); sv('rect', { x: 380, y: 760, width: 320, height: 380, fill: '#ffcf7a' }, Hs);
        sv('rect', { x: 300, y: 1140, width: 480, height: 30, fill: '#1a1220' }, Hs); for (let x = 310; x < 780; x += 34) sv('rect', { x, y: 1170, width: 10, height: 110, fill: '#1a1220' }, Hs); sv('rect', { x: 300, y: 1280, width: 480, height: 20, fill: '#1a1220' }, Hs);
        const tR = ctx.cue('rose', 0, sc.dur * .45), shot1 = P.shot !== 2, tN = ctx.cue('outrage', 0, .3);
        const ch = sv('g', {}, Hs); const C = HFS.char(ch, { style: 'silhouette', scale: .62, track: shot1 ? [{ t: 0, act: 'idle', x: 540, y: 1140 }, { t: tN, act: 'wave', x: 540 }] : [{ t: 0, act: 'lookUp', x: 540, y: 1140, facing: 1 }, { t: tR, act: 'turn', from: 1, dur: .35 }, { t: tR + .35, act: 'idle', facing: -1 }] });
        if (shot1) Hs.style.transformOrigin = '540px 1000px';
        const rose = sv('g', {}, Fr); sv('path', { d: 'M 0 0 L 0 120', stroke: '#2f6b3a', 'stroke-width': 8 }, rose); sv('circle', { r: 26, fill: '#e8253c' }, rose); sv('path', { d: 'M -14 -6 Q 0 -30 14 -6', fill: '#b0182c' }, rose);
        sc.update(t => { C.render(t); rose.setAttribute('opacity', shot1 ? 0 : 1); const u = t - .2, T1 = tR - .2; let x, y, r; if (u < T1) { const k = m.clamp(u / T1); x = 140 + k * 360; y = 1800 - Math.sin(k * Math.PI * .9) * 700 - k * 100; r = k * 540; } else { const v = u - T1; x = 500 + v * 80; y = 1060 + 0.5 * 4200 * v * v; r = 540 + v * 600; } rose.setAttribute('transform', `translate(${x},${y}) rotate(${r})`); });
        HFS.camera(sc, [{ el: S, depth: .2 }, { el: Hs, depth: 1 }, { el: Fr, depth: 1.2 }], Object.assign({ preset: 'pedestalUp', amount: .5 }, CFG.camera || {}));''')

T['retro_phone'] = dict(bg='#f2c94c', layers=L('bg', 'ph'), doc="cartoon : vieux téléphone à cadran qui sonne en sautillant (squash & stretch), une main décroche le combiné, ondes sonores à chaque « allô ».", body='''
        const B = ctx.layer('bg'), Ph = ctx.layer('ph'), ink = '#1b1a17', boil = HFS.fx.boil(Ph);
        sv('rect', { width: 1080, height: 1920, fill: P.bg || '#f2c94c' }, B); for (let i = 0; i < 12; i++) sv('circle', { cx: 540, cy: 1150, r: 120 + i * 90, fill: 'none', stroke: '#e0b23a', 'stroke-width': 30 }, B);
        const body = sv('g', {}, Ph); sv('path', { d: 'M -190 120 L 190 120 L 150 -60 L -150 -60 Z', fill: '#e8253c', stroke: ink, 'stroke-width': 10 }, body); sv('circle', { cy: 40, r: 80, fill: '#f4f1ea', stroke: ink, 'stroke-width': 8 }, body);
        for (let i = 0; i < 10; i++) { const a = i / 10 * 5.3 + .5; sv('circle', { cx: Math.cos(a) * 52, cy: 40 + Math.sin(a) * 52, r: 12, fill: ink }, body); }
        const hs = sv('g', {}, Ph); sv('path', { d: 'M -200 -90 Q 0 -150 200 -90 L 220 -40 Q 160 -60 120 -50 L 100 -80 Q 0 -100 -100 -80 L -120 -50 Q -160 -60 -220 -40 Z', fill: '#e8253c', stroke: ink, 'stroke-width': 10 }, hs);
        const waves = [0, 1, 2].map(i => sv('path', { fill: 'none', stroke: ink, 'stroke-width': 10, 'stroke-linecap': 'round' }, Ph));
        const pick = ctx.cue('pick', 0, sc.dur * .35);
        sc.update(t => { const ring = t < pick, hop = ring ? Math.abs(Math.sin(t * 16)) : 0, sq = ring ? 1 - Math.max(0, Math.cos(t * 16)) * .12 : 1;
          body.setAttribute('transform', `translate(540,${1200 - hop * 40}) scale(${2 - sq + .0},${sq}) rotate(${ring ? Math.sin(t * 32) * 6 : 0})`);
          const k = E.outBack(m.clamp((t - pick) / .4)); hs.setAttribute('transform', `translate(${540 + k * 140},${1140 - hop * 40 - k * 360}) rotate(${-k * 35})`);
          waves.forEach((w, i) => { const u = ((t * 1.6 + i / 3) % 1), r = 60 + u * 240, cx = 540 + k * 300, cy = 760 - k * 0; w.setAttribute('d', `M ${cx - r} ${cy + 1180 - 760 - (k ? 400 : 0)} A ${r} ${r} 0 0 1 ${cx + r} ${cy + 1180 - 760 - (k ? 400 : 0)}`); w.setAttribute('opacity', (1 - u) * (ring || k > .9 ? 1 : 0)); });
          boil(t); });
        HFS.camera(sc, [{ el: B, depth: .3 }, { el: Ph, depth: 1 }], Object.assign({ preset: 'dollyIn', amount: .7, shake: t => (t < pick ? 3 : 0) }, CFG.camera || {}));''')

T['club'] = dict(bg='#07040f', layers=L('floor', 'cv:laser', 'crowd'), doc="néon : piste de danse, dalles lumineuses qui changent sur les kicks, lasers, stroboscope, silhouettes qui dansent ; la caméra tangue.", body='''
        const Fl = ctx.layer('floor'), Cr = ctx.layer('crowd'), cols = [P.accent || '#ff3fb4', '#3ff0ff', '#ffd23f', '#7a5cff'];
        sv('rect', { width: 1080, height: 1920, fill: '#07040f' }, Fl);
        const tiles = []; for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const y0 = 1250 + r * r * 20 + r * 60, w = 140 + r * 30, x0 = 540 + (c - 2.5) * w; tiles.push(sv('rect', { x: x0 - w / 2 + 4, y: y0, width: w - 8, height: 50 + r * 18, rx: 6, fill: cols[(r + c) % 4], opacity: .2 }, Fl)); }
        const lz = ctx.layer('laser').getContext('2d');
        const dancers = [140, 330, 540, 750, 940].map((x, i) => HFS.char(Cr, { style: 'silhouette', scale: .7 + (i === 2 ? .2 : 0), track: [{ t: 0, act: i % 2 ? 'dance' : 'jump', x, y: 1420 + (i === 2 ? 60 : 0), speed: 1 + i * .1, dur: .5, height: 120 }] }));
        sc.update(t => { const n = (HFS.audio.data.kicks || []).filter(x => x <= sc.t0 + t).length, b = sc.beat(t, 'kicks', 10);
          tiles.forEach((e, i) => e.setAttribute('opacity', ((i + n) % 3 === 0) ? .55 + b * .4 : .12));
          lz.clearRect(0, 0, 1080, 1920); lz.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const a = Math.sin(t * 1.3 + i) * .6 + (i - 2.5) * .25; lz.strokeStyle = cols[i % 4]; lz.globalAlpha = .55; lz.lineWidth = 6; lz.beginPath(); lz.moveTo(540, 120); lz.lineTo(540 + Math.sin(a) * 2400, 120 + Math.cos(a) * 2400); lz.stroke(); }
          lz.globalAlpha = 1; dancers.forEach((C, i) => { const tt = i % 2 ? t : (t % .5); C.render(tt); }); const st = ctx.since(t, 'strobe'); Fl.style.filter = (b > .8 || (st >= 0 && st < .6 && Math.floor(t * 16) % 2)) ? 'brightness(2.2)' : ''; });
        HFS.camera(sc, [{ el: Fl, depth: .7 }, { el: ctx.layer('laser'), depth: .5 }, { el: Cr, depth: 1 }], Object.assign({ preset: 'roll', amount: 1.4, shake: t => sc.beat(t, 'kicks', 12) * 8 }, CFG.camera || {}));''')

T['school'] = dict(bg='#ffd9a8', layers=L('sky', 'street', 'front'), doc="aplats matin : petit frère avec son cartable marche vers l'école, le bus scolaire passe, soleil qui se lève ; travelling qui le suit.", body='''
        const S = ctx.layer('sky'), St = ctx.layer('street'), Fr = ctx.layer('front');
        sv('rect', { width: 1080, height: 1920, fill: '#ffd9a8' }, S); const sun = sv('circle', { cx: 760, r: 130, fill: '#ffb03a' }, S);
        const sch = sv('g', {}, St); sv('rect', { x: 1300, y: 800, width: 900, height: 600, fill: '#e8a77a' }, sch); sv('path', { d: 'M 1250 800 L 1750 560 L 2250 800 Z', fill: '#b4553a' }, sch); for (let i = 0; i < 6; i++) sv('rect', { x: 1360 + i * 140, y: 900, width: 80, height: 110, fill: '#bfe4ff' }, sch); sv('rect', { x: 1700, y: 1180, width: 120, height: 220, fill: '#6a3a28' }, sch);
        sv('rect', { x: -500, y: 1400, width: 3500, height: 520, fill: '#8a8d96' }, St); sv('rect', { x: -500, y: 1400, width: 3500, height: 26, fill: '#c9ccd4' }, St);
        const kid = sv('g', {}, St); const C = HFS.char(kid, { style: 'flat', scale: .7, look: { top: '#3ddc97', top2: '#2bb37a', bottom: '#2b4c9a' }, track: [{ t: 0, act: 'walk', x: 200, y: 1410, speed: 1.3 }, { t: sc.dur, act: 'walk', x: 1500 }] });
        const bag = sv('rect', { width: 70, height: 90, rx: 14, fill: '#e8452c', stroke: '#8a1a10', 'stroke-width': 5 }, St);
        const bus = sv('g', {}, Fr); sv('rect', { x: 0, y: -260, width: 700, height: 260, rx: 30, fill: '#ffd23f', stroke: '#1b1a17', 'stroke-width': 8 }, bus); for (let i = 0; i < 5; i++) sv('rect', { x: 40 + i * 130, y: -220, width: 100, height: 90, rx: 10, fill: '#bfe4ff' }, bus); [130, 570].forEach(x => sv('circle', { cx: x, cy: 0, r: 56, fill: '#1b1a17' }, bus));
        sc.update(t => { C.render(t); const [hx] = [C.x]; bag.setAttribute('x', C.x - 75); bag.setAttribute('y', C.y - 330 * .7 + Math.sin(t * 8) * 4); sun.setAttribute('cy', 700 - t * 60);
          const tb = ctx.cue('bus', 0, 0); bus.setAttribute('transform', `translate(${2200 - Math.max(0, t - tb + 1.2) * 1100},${1830})`); });
        HFS.camera(sc, [{ el: S, depth: .2 }, { el: St, depth: 1 }, { el: Fr, depth: 1.2 }], Object.assign({ preset: 'static', follow: t => ({ x: -(C.x - 420) }) }, CFG.camera || {}));''')

T['bubble'] = dict(bg='#1a2a5a', layers=L('bg', 'cv:bub', 'mid'), doc="aplats rêveurs : le personnage flotte dans une grande bulle irisée, des bulles éclatent sur chaque kick, la ville en dessous s'éloigne ; caméra qui monte.", body='''
        const B = ctx.layer('bg'), M = ctx.layer('mid');
        const gr = sv('linearGradient', { id: '__ID__-g', x1: 0, y1: 0, x2: 0, y2: 1 }, B); [['0', '#1a2a5a'], ['1', '#c86a9a']].forEach(([o, c]) => sv('stop', { offset: o, 'stop-color': c }, gr)); sv('rect', { width: 1080, height: 1920, fill: 'url(#__ID__-g)' }, B);
        const city = sv('g', {}, B); for (let i = 0; i < 16; i++) { const hh = 160 + (i * 89) % 300; sv('rect', { x: i * 70, y: 1920 - hh, width: 64, height: hh, fill: '#2a1d40' }, city); }
        const bub = sv('g', {}, M); sv('circle', { r: 300, fill: '#bfe8ff', opacity: .12, stroke: '#ffffff', 'stroke-width': 6 }, bub); sv('path', { d: 'M -200 -150 A 250 250 0 0 1 -60 -260', fill: 'none', stroke: '#fff', 'stroke-width': 14, 'stroke-linecap': 'round', opacity: .8 }, bub);
        const inn = sv('g', {}, bub); const C = HFS.char(inn, { style: 'flat', scale: .7, look: { top: '#ff6aa8', top2: '#d84a88' }, track: [{ t: 0, act: 'sit', x: 0, y: 160 }] });
        const ctx2 = ctx.layer('bub').getContext('2d'), r = HFS.m.rng('b__ID__'), bs = [...Array(26)].map(() => [r() * 1080, 1900 + r() * 400, 20 + r() * 60, .5 + r()]);
        sc.update(t => { C.render(t); bub.setAttribute('transform', `translate(${540 + Math.sin(t) * 40},${980 - t * 40 + Math.sin(t * 1.7) * 20}) scale(${1 + sc.beat(t, 'kicks', 8) * .03})`); city.setAttribute('transform', `translate(0,${t * 60})`);
          ctx2.clearRect(0, 0, 1080, 1920); const n = (HFS.audio.data.kicks || []).filter(x => x <= sc.t0 + t).length;
          bs.forEach(([x, y0, rad, sp], i) => { const y = y0 - t * 300 * sp; const pop = (i + n) % 7 === 0 || (ctx.since(t, 'pops') >= 0 && ctx.since(t, 'pops') < .25 && i % 3 === ctx.count(t, 'pops') % 3); ctx2.globalAlpha = pop ? .9 : .35; ctx2.strokeStyle = '#ffffff'; ctx2.lineWidth = 4; ctx2.beginPath(); if (pop) { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; ctx2.moveTo(x + Math.cos(a) * rad * .6, y + Math.sin(a) * rad * .6); ctx2.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } } else ctx2.arc(x, y, rad, 0, 6.28); ctx2.stroke(); }); });
        HFS.camera(sc, [{ el: B, depth: .4 }, { el: ctx.layer('bub'), depth: .8 }, { el: M, depth: 1 }], Object.assign({ preset: 'pedestalUp', amount: .6 }, CFG.camera || {}));''')

T['stairwell_2d'] = dict(bg='#2a2e38', layers=L('wall', 'mid', 'front'), doc="aplats : palier d'immeuble de cité ; il appuie sur le bouton de l'ascenseur (« bloqué » : rubalise EN PANNE), haussement d'épaules (« ah bon ? »), puis il part vers l'escalier et monte (« escalier »).", body="""
        const Wl = ctx.layer('wall'), M = ctx.layer('mid'), Fr = ctx.layer('front');
        sv('rect', { width: 1080, height: 1920, fill: '#3a3f4c' }, Wl); for (let y = 300; y < 1500; y += 60) sv('line', { x1: 0, y1: y, x2: 1080, y2: y, stroke: '#343846', 'stroke-width': 3 }, Wl);
        sv('rect', { y: 1500, width: 1080, height: 420, fill: '#22252e' }, Wl);
        for (let i = 0; i < 14; i++) sv('rect', { x: 20 + (i * 71) % 300, y: 420 + Math.floor(i / 5) * 90, width: 60, height: 40, fill: '#6a6d78', opacity: .35 }, Wl);
        const door = sv('g', {}, M); sv('rect', { x: 80, y: 780, width: 380, height: 720, fill: '#8d919c', stroke: '#2a2e38', 'stroke-width': 10 }, door); sv('line', { x1: 270, y1: 780, x2: 270, y2: 1500, stroke: '#2a2e38', 'stroke-width': 8 }, door);
        const btn = sv('circle', { cx: 510, cy: 1100, r: 18, fill: '#444' }, M);
        const tape = sv('g', {}, M); [880, 1020].forEach((y, k) => { sv('rect', { x: 40, y, width: 460, height: 46, fill: '#ffd23f', transform: `rotate(${k ? 8 : -8} 270 ${y})` }, tape); const tx = sv('text', { x: 270, y: y + 36, 'text-anchor': 'middle', 'font-family': 'Anton', 'font-size': 38, fill: '#111', transform: `rotate(${k ? 8 : -8} 270 ${y})` }, tape); tx.textContent = 'EN PANNE · EN PANNE · EN PANNE'; });
        // escalier en dents de scie qui monte vers la droite
        let d = 'M 620 1500'; for (let i = 0; i < 9; i++) d += ` L ${620 + i * 52} ${1500 - i * 52} L ${672 + i * 52} ${1500 - i * 52}`; d += ' L 1120 1032 L 1120 1500 Z';
        sv('path', { d, fill: '#5a5e6a', stroke: '#2a2e38', 'stroke-width': 6 }, M); sv('path', { d: 'M 600 1420 L 1100 940', stroke: '#c9ccd4', 'stroke-width': 10 }, M);
        const tB = ctx.cue('blocked', 0, .5), tS = ctx.cue('shrug', 0, tB + .7), tE = ctx.cue('stairs', 0, sc.dur * .7);
        const g = sv('g', {}, M);
        const C = HFS.char(g, { style: 'flat', scale: .95, look: { top: '#1d1922', top2: '#141117', bottom: '#20232e' }, track: [{ t: 0, act: 'walk', x: 300, y: 1500 }, { t: Math.max(.3, tB - .35), act: 'reach', x: 460 }, { t: tS, act: 'lookUp', x: 460 }, { t: tS + .5, act: 'walk', x: 460 }, { t: tE, act: 'walk', x: 640 }, { t: sc.dur, act: 'walk', x: 1020, y: 1110 }] });
        sc.update(t => { C.render(t); const press = t >= tB; btn.setAttribute('fill', press ? (Math.floor(t * 6) % 2 ? '#ff3b1f' : '#5a1a10') : '#444'); tape.setAttribute('transform', `rotate(${Math.sin(t * 3) * 1.5} 270 950)`); });
        HFS.camera(sc, [{ el: Wl, depth: .5 }, { el: M, depth: 1 }, { el: Fr, depth: 1.3 }], Object.assign({ preset: 'static', follow: t => ({ x: -(C.x - 480) * .5, y: -(C.y - 1500) * .4 }) }, CFG.camera || {}));""")

T['hug_refuse'] = dict(bg='#1c2433', layers=L('bg', 'mid', 'cv:cold'), doc="aplats : elle ouvre les bras pour un câlin (« câlin »), lui recule et lève la main (refus), l'air se refroidit (givre qui monte), lumière bleue.", body="""
        const B = ctx.layer('bg'), M = ctx.layer('mid');
        sv('rect', { width: 1080, height: 1920, fill: '#1c2433' }, B); sv('rect', { y: 1450, width: 1080, height: 470, fill: '#141a26' }, B);
        const halo = sv('ellipse', { cx: 540, cy: 1100, rx: 520, ry: 600, fill: '#7fb8ff', opacity: .0 }, B);
        const tH = ctx.cue('hug', 0, .6);
        const g = sv('g', {}, M);
        const her = HFS.char(g, { style: 'flat', scale: .95, look: { top: '#ff6aa8', top2: '#d84a88', bottom: '#2a1d36', skin: '#a8714f' }, track: [{ t: 0, act: 'walk', x: 260, y: 1460 }, { t: Math.max(.2, tH - .2), act: 'dance', x: 420, speed: .01 }] });
        const him = HFS.char(g, { style: 'flat', scale: 1.0, facing: -1, look: { top: '#1d1922', top2: '#141117', bottom: '#20232e' }, track: [{ t: 0, act: 'idle', x: 700, y: 1460, facing: -1 }, { t: tH + .1, act: 'reach', x: 700, facing: -1 }, { t: tH + .5, act: 'walk', x: 700, facing: -1 }, { t: sc.dur, act: 'walk', x: 880, facing: -1 }] });
        const cold = HFS.fx.particles(ctx.layer('cold'), { kind: 'snow', n: 70, colors: ['#e6f6ff'], seed: 5, size: 3 });
        sc.update(t => { her.render(t); him.render(t); const k = m.clamp((t - tH) / .8); halo.setAttribute('opacity', k * .25); ctx.layer('cold').style.opacity = k; cold(t); });
        HFS.camera(sc, [{ el: B, depth: .5 }, { el: M, depth: 1 }, { el: ctx.layer('cold'), depth: 1.1 }], Object.assign({ preset: 'dollyIn', amount: .6 }, CFG.camera || {}));""")

T['drunk_walk'] = dict(bg='#0e0b1a', layers=L('city', 'mid'), doc="aplats nuit : le personnage, sac monogrammé à la main, titube sur le trottoir sous les lampadaires ; la caméra tangue et la vision se dédouble sur « pété ».", body="""
        const Cy = ctx.layer('city'), M = ctx.layer('mid');
        sv('rect', { x: -300, width: 1700, height: 1920, fill: '#0e0b1a' }, Cy); for (let i = 0; i < 22; i++) { const h = 250 + (i * 83) % 420; sv('rect', { x: -300 + i * 80, y: 1420 - h, width: 74, height: h, fill: '#1e1834' }, Cy); for (let k = 0; k < 6; k++) sv('rect', { x: -290 + i * 80 + (k % 2) * 34, y: 1420 - h + 30 + Math.floor(k / 2) * 60, width: 18, height: 26, fill: (i + k) % 3 ? '#2a2448' : '#ffcf7a' }, Cy); }
        sv('rect', { x: -300, y: 1420, width: 1700, height: 520, fill: '#16121f' }, Cy);
        for (let x = -100; x < 1300; x += 360) { sv('rect', { x, y: 700, width: 12, height: 720, fill: '#2a2440' }, Cy); sv('path', { d: `M ${x - 120} 1420 L ${x + 130} 1420 L ${x + 30} 720 L ${x - 20} 720 Z`, fill: '#ffd9a8', opacity: .12 }, Cy); }
        const ghost = sv('g', { opacity: 0 }, M), g = sv('g', {}, M);
        const look = { top: '#e9b949', top2: '#c99a2e', bottom: '#20232e' };
        const C = HFS.char(g, { style: 'flat', scale: 1.0, look, track: [{ t: 0, act: 'walk', x: 240, y: 1430, speed: .7 }, { t: sc.dur, act: 'walk', x: 760 }] });
        const C2 = HFS.char(ghost, { style: 'flat', scale: 1.0, look, track: [{ t: 0, act: 'walk', x: 240, y: 1430, speed: .7 }, { t: sc.dur, act: 'walk', x: 760 }] });
        const bag = sv('g', {}, M); sv('rect', { x: -40, y: -10, width: 80, height: 70, rx: 10, fill: '#7a5230', stroke: '#3a2414', 'stroke-width': 4 }, bag); sv('path', { d: 'M -24 -10 Q 0 -44 24 -10', fill: 'none', stroke: '#3a2414', 'stroke-width': 5 }, bag);
        const tP = ctx.cue('wasted', 0, sc.dur * .7);
        sc.update(t => { C.render(t); C2.render(t - .12); const [hx, hy] = C.handPos; bag.setAttribute('transform', `translate(${hx},${hy}) rotate(${Math.sin(t * 5) * 20})`);
          g.setAttribute('transform', `rotate(${Math.sin(t * 2.3) * 7} ${C.x} 1430)`); ghost.setAttribute('opacity', t > tP ? .45 : .0); ghost.setAttribute('transform', `translate(${18 + Math.sin(t * 7) * 10},0) rotate(${Math.sin(t * 2.3 + .5) * 7} ${C.x} 1430)`); });
        HFS.camera(sc, [{ el: Cy, depth: .5 }, { el: M, depth: 1 }], Object.assign({ preset: 'roll', amount: 2.2, follow: t => ({ x: -(C.x - 500) * .6 }), handheld: 1.5 }, CFG.camera || {}));""")

T['walk_home'] = dict(bg='#101423', layers=L('bld', 'mid'), doc="aplats nuit : il rentre au bâtiment, mains dans les poches ; la porte du hall s'ouvre (lumière jaune) sur « rentre », il y disparaît.", body="""
        const Bd = ctx.layer('bld'), M = ctx.layer('mid');
        sv('rect', { width: 1080, height: 1920, fill: '#101423' }, Bd); sv('rect', { x: 420, y: 300, width: 660, height: 1240, fill: '#2a2f45' }, Bd);
        for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) sv('rect', { x: 470 + c * 150, y: 360 + r * 120, width: 80, height: 70, fill: (r * 3 + c) % 4 ? '#1c2033' : '#ffcf7a' }, Bd);
        const hall = sv('rect', { x: 700, y: 1240, width: 220, height: 300, fill: '#ffcf7a' }, Bd), doorL = sv('rect', { x: 700, y: 1240, width: 110, height: 300, fill: '#3a3f58', stroke: '#111', 'stroke-width': 5 }, Bd), doorR = sv('rect', { x: 810, y: 1240, width: 110, height: 300, fill: '#3a3f58', stroke: '#111', 'stroke-width': 5 }, Bd);
        const beam = sv('path', { d: 'M 700 1540 L 920 1540 L 1080 1920 L 520 1920 Z', fill: '#ffcf7a', opacity: 0 }, Bd); sv('rect', { y: 1540, width: 1080, height: 380, fill: '#191c2c' }, Bd);
        const tO = ctx.cue('home', 0, .3), tPk = ctx.cue('pockets', 0, sc.dur * .7);
        const g = sv('g', {}, M);
        const C = HFS.char(g, { style: 'flat', scale: .95, look: { top: '#1d1922', top2: '#141117', bottom: '#20232e' }, track: [{ t: 0, act: 'walk', x: 120, y: 1550, speed: .9 }, { t: sc.dur * .95, act: 'walk', x: 800, y: 1545 }] });
        sc.update(t => { C.render(t); const o = E.inOut(m.clamp((t - tO) / .6)); doorL.setAttribute('transform', `translate(${-o * 100},0) scale(1,1)`); doorR.setAttribute('transform', `translate(${o * 100},0)`); beam.setAttribute('opacity', o * .25);
          g.setAttribute('opacity', 1 - m.clamp((C.x - 740) / 60)); });
        HFS.camera(sc, [{ el: Bd, depth: .7 }, { el: M, depth: 1 }], Object.assign({ preset: 'dollyIn', amount: .5, follow: t => ({ x: -(C.x - 540) * .3 }) }, CFG.camera || {}));""")

T['speaker'] = dict(bg='#0b0b10', layers=L('wall', 'spk', 'cv:fx'), doc="graphique : une enceinte géante dont les membranes pompent sur chaque « taga », ondes de choc, poussière qui saute ; néon vert.", body="""
        const Wl = ctx.layer('wall'), Sp = ctx.layer('spk'), G = P.accent || '#2ecc71';
        sv('rect', { width: 1080, height: 1920, fill: '#0b0b10' }, Wl); for (let i = 0; i < 12; i++) sv('rect', { x: 0, y: 300 + i * 120, width: 1080, height: 4, fill: G, opacity: .08 }, Wl);
        sv('rect', { x: 200, y: 640, width: 680, height: 1060, rx: 40, fill: '#17171f', stroke: '#2a2a36', 'stroke-width': 12 }, Sp);
        const cones = [[540, 900, 150], [540, 1390, 230]].map(([x, y, r]) => { const g = sv('g', { transform: `translate(${x},${y})` }, Sp); sv('circle', { r, fill: '#0e0e14', stroke: '#3a3a48', 'stroke-width': 14 }, g); const mem = sv('circle', { r: r * .72, fill: '#26262f' }, g); const cap = sv('circle', { r: r * .25, fill: '#3a3a48' }, g); return [g, mem, cap, r]; });
        const rings = [0, 1, 2].map(() => sv('circle', { cx: 540, cy: 1390, fill: 'none', stroke: G, 'stroke-width': 8 }, Sp));
        const fx = HFS.fx.particles(ctx.layer('fx'), { n: 70, colors: [G, '#ffffff'], seed: 12, size: 3 });
        sc.update(t => { const b = Math.max(ctx.pulse(t, 'taga', 10), sc.beat(t, 'kicks', 12) * .5);
          cones.forEach(([g, mem, cap, r]) => { mem.setAttribute('r', r * (.72 + b * .14)); cap.setAttribute('r', r * (.25 + b * .1)); });
          rings.forEach((c, i) => { const s = ctx.since(t, 'taga'); const u = s >= 0 ? m.clamp((s - i * .08) / .5) : 1; c.setAttribute('r', 240 + u * 600); c.setAttribute('opacity', (1 - u) * .8); });
          fx(t); ctx.layer('fx').style.transform = `translateY(${-b * 18}px)`; });
        HFS.camera(sc, [{ el: Wl, depth: .4 }, { el: Sp, depth: 1 }, { el: ctx.layer('fx'), depth: 1.2 }], Object.assign({ preset: 'dollyIn', amount: .4, shake: t => Math.max(ctx.pulse(t, 'taga', 14), 0) * 10 }, CFG.camera || {}));""")

for name, d in T.items():
    open(os.path.join(ROOT, 'templates', name + '.html'), 'w').write(SKEL.format(name=name, **d))
print(len(T), 'gabarits écrits')
