/* SDM — « Cartier Santos » v3 — affiches sérigraphiées animées (inspiration : edit de référence Josman – Goal)
 * 1 affiche par phrase ; S.sb.marks[i] = début du i-ème morceau de phrase (temps local) → événements visuels.
 * Personnages : E.person (profils anatomiques, vêtements, silhouettes avec liseré).
 * Cadrage : sujets marqués, vérifiés par render.mjs --framing. Animations pures en t.
 */
const K = { navy: '#1d2b4f', navy2: '#14203c', crim: '#b3261e', crimD: '#6e1612', brown: '#7a4a2e', brownD: '#4a2c1c', ochre: '#d89a4a', violet: '#4a2f6a',
  ivory: '#efe6d2', ink: '#0d0b10', skinH: '#b07a58', skinF: '#dca47e', gold: '#e3b955' };
const ramp = (t, a, d) => Math.max(0, Math.min(1, (t - a) / d));
const mark = (S, i) => (S.sb.marks || [0])[Math.min(i, (S.sb.marks || [0]).length - 1)];
const HIM = o => Object.assign({ outfit: 'hoodie', hat: 'hood', hair: 'short', look: { skin: K.skinH, top: '#20263a', bottom: '#171a26', shoe: '#ece8e0', hair: '#140e0a' } }, o);
const HER = o => Object.assign({ outfit: 'trench', hair: 'long', look: { skin: K.skinF, top: '#3a2a36', bottom: '#2a2030', coat: '#d6b48a', hair: '#3a2418', shoe: '#2a1a1a' } }, o);
const heartD = (cx, cy, r) => { const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`; return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`; };
function towers(S, d, y, color, seed, win, lit = .25, o = {}) { return S.layer(d, o.blur ? { blur: o.blur } : undefined).add(S.E.city(Object.assign({ y, color, seed, windows: win, lit, minH: 300, maxH: 800, density: .8 }, o))); }

/* s00 — La vie d'ma mère, bébé… : le polaroid se révèle */
CLIP.scene('s00', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#2a1c18' }));
  const grainWood = h('g', { opacity: .25 }); for (let i = 0; i < 26; i++) grainWood.appendChild(h('path', { d: `M -200 ${i * 90} Q 540 ${i * 90 + 30} 1300 ${i * 90 - 10}`, stroke: '#1a100c', 'stroke-width': 6, fill: 'none' })); S.layer(0).add(grainWood);
  S.layer(.2).add(E.radial([[0, '#ffcf8a', .35], [1, '#ffcf8a', 0]], { cx: .5, cy: .55, r: .5 }));
  const P = h('g'); S.layer(1).g.appendChild(P);
  P.append(h('rect', { x: 220, y: 640, width: 640, height: 780, fill: '#000', opacity: .35, filter: 'url(#softblur)', transform: 'translate(14,18)' }), h('rect', { x: 220, y: 640, width: 640, height: 780, fill: K.ivory, 'data-key': 'polaroid' }));
  const ph = h('g'); P.appendChild(ph); S.defs.appendChild(h('clipPath', { id: 'pol00' }, [h('rect', { x: 260, y: 680, width: 560, height: 560 })])); ph.setAttribute('clip-path', 'url(#pol00)');
  ph.append(h('rect', { x: 260, y: 680, width: 560, height: 560, fill: K.navy }), h('circle', { cx: 700, cy: 790, r: 70, fill: K.crim, opacity: .9 }));
  ph.appendChild(S.E.city({ y: 1080, color: K.navy2, seed: 3, windows: K.gold, lit: .3, minH: 80, maxH: 260, x0: 260, x1: 820 }).el);
  ph.append(h('path', { d: 'M 300 1180 Q 310 1110 400 1096 L 640 1090 Q 730 1090 780 1150 L 800 1180 Z', fill: K.crimD }), h('path', { d: 'M 430 1096 Q 470 1040 560 1036 Q 650 1040 690 1092 Z', fill: '#0e1426' }),
    h('circle', { cx: 520, cy: 1070, r: 22, fill: K.ink }), h('circle', { cx: 600, cy: 1072, r: 22, fill: K.ink }), h('path', { d: 'M 600 1050 Q 640 1080 610 1100 L 586 1096 Z', fill: K.ink }),
    h('circle', { cx: 360, cy: 1182, r: 30, fill: K.ink }), h('circle', { cx: 730, cy: 1182, r: 30, fill: K.ink }), h('rect', { x: 260, y: 1200, width: 560, height: 40, fill: '#0a0e1a' }));
  const dev = h('rect', { x: 260, y: 680, width: 560, height: 560, fill: '#f4efe4' }); ph.appendChild(dev);
  const heart = h('path', { d: heartD(540, 1330, 30), fill: K.crim }); P.appendChild(heart);
  S.update(t => { const k = ramp(t, .4, 2.6); dev.setAttribute('opacity', 1 - S.Ease.inOutSine(k)); const shake = Math.sin(t * 22) * 6 * (1 - k) * (t < 3 ? 1 : 0);
    P.setAttribute('transform', `rotate(${-4 + shake * .3} 540 1030) translate(${shake},0)`); heart.setAttribute('opacity', ramp(t, mark(S, 1), .3)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [.6, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 20, zoom: 1.22 }]], 'inOutSine', { handheld: .6 });
});

/* s01 — Elle savait m'parler… / j'me mets à rêver : deux balcons, puis le rêve */
CLIP.scene('s01', S => {
  const { E, h } = S;
  const sky = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(sky);
  const stars = E.stars({ n: 120, seed: 11, color: '#fff' }); S.layer(.03).add(stars);
  const shoot = h('line', { stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round' }); S.layer(.05).add(shoot);
  towers(S, .2, 1700, '#121a33', 12, '#ffd28a', .2, { blur: 3 });
  const L = S.layer(.7);
  const bldg = (x, w) => { const g = h('g', {}, [h('rect', { x, y: 1100, width: w, height: 900, fill: '#0f1630' }), h('rect', { x: x + (x < 540 ? w - 160 : 0), y: 1180, width: 160, height: 14, fill: '#2a3458' }), h('rect', { x: x + (x < 540 ? w - 170 : 0), y: 1194, width: 170, height: 70, fill: 'none', stroke: '#2a3458', 'stroke-width': 8 })]); L.g.appendChild(g); };
  bldg(-60, 420); bldg(720, 420);
  const glowA = h('circle', { cx: 330, cy: 930, r: 60, fill: '#9fd0ff', opacity: .35, filter: 'url(#bigblur)' }), glowB = h('circle', { cx: 760, cy: 930, r: 60, fill: '#9fd0ff', opacity: .35, filter: 'url(#bigblur)' }); L.g.append(glowA, glowB);
  L.add(E.person(HIM({ x: 270, y: 1180, s: 1.12, pose: 'think', action: 'idle', anim: (a, t) => { a.ua1 = 25; a.la1 = 160; a.head = -6 + Math.sin(t * 3) * 3; } })));
  L.add(E.person(HER({ x: 810, y: 1180, s: 1.1, facing: -1, action: 'none', anim: (a, t) => { a.ua1 = 25; a.la1 = 160; a.ua2 = 20 + Math.sin(t * 4) * 15; a.la2 = 60; a.head = -8 + Math.sin(t * 2.4) * 5; } })));
  S.update(t => { const k = ramp(t, mark(S, 1), 1.2); sky.setAttribute('fill', S.mix('#0d1430', '#3a1f5c', k)); stars.el.setAttribute('opacity', .4 + .6 * k);
    const u = ramp(t, mark(S, 1) + .4, .6); S.set(shoot, { x1: 900 - u * 600, y1: 300 + u * 220, x2: 980 - u * 600, y2: 270 + u * 220, opacity: u > 0 && u < 1 ? 1 : 0 });
    [glowA, glowB].forEach((g, i) => g.setAttribute('opacity', .25 + .12 * Math.sin(t * 5 + i))); });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [.5, { x: 0, y: 0, zoom: 1.02 }], [1, { x: 0, y: -60, zoom: 1.1 }]], 'inOutSine');
});

/* s02 — Que j'prends sur moi… / prendre des sous : salon brun, fumée, pièces qui s'envolent */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: K.brownD }));
  const wall = h('g'); for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) if ((i + j) % 2) wall.appendChild(h('rect', { x: 560 + i * 60, y: 700 + j * 60, width: 58, height: 58, fill: ['#a8642e', '#7a4a2e', '#c98a4a'][(i * 3 + j) % 3] }));
  S.layer(.15).add(wall); S.layer(.15).add(h('rect', { x: 100, y: 680, width: 30, height: 760, fill: '#c98a4a' })); for (let i = 0; i < 8; i++) S.layer(.15).add(h('rect', { x: 140 + i * 40, y: 680, width: 24, height: 760, fill: i % 2 ? '#d89a4a' : '#b07a3a' }));
  const lamp = h('g', {}, [h('path', { d: 'M 880 760 L 940 760 L 960 840 L 860 840 Z', fill: '#f2e6c8' }), h('rect', { x: 906, y: 840, width: 8, height: 160, fill: '#2a1a10' }), h('circle', { cx: 910, cy: 800, r: 90, fill: '#ffe0a0', opacity: .3, filter: 'url(#bigblur)' })]); S.layer(.2).add(lamp);
  const door = h('g'); S.layer(.25).g.appendChild(door);
  door.append(h('rect', { x: 360, y: 760, width: 200, height: 520, fill: '#1a0e08' }), h('rect', { x: 360, y: 760, width: 200, height: 520, fill: '#ffd28a', opacity: 0, id: 'doorlight02' }));
  const her = E.person(HER({ x: 460, y: 1280, s: .88, silhouette: '#120a06', action: 'idle', pose: 'point', key: 'elle' })); door.appendChild(her.el); S.items.push(her);
  const L = S.layer(1);
  L.add(h('path', { d: 'M 120 1300 Q 120 1200 220 1190 L 860 1190 Q 960 1200 960 1300 L 960 1480 L 120 1480 Z', fill: '#8a3a22' }), h('rect', { x: 160, y: 1330, width: 760, height: 160, rx: 20, fill: '#a8462a' }));
  const back = h('g', { transform: 'translate(540,1400)' }); L.g.appendChild(back); S.key(back, 'lui');
  back.setAttribute('data-key-allow', 'overlap'); back.append(h('path', { d: 'M -150 0 Q -160 -230 -60 -270 L 60 -270 Q 160 -230 150 0 Z', fill: '#e8d6a8' }), h('path', { d: 'M -150 -40 L 150 -40 M -150 -90 L 150 -90 M -150 -140 L 150 -140 M -140 -190 L 140 -190', stroke: '#c9b07a', 'stroke-width': 10 }),
    h('rect', { x: -34, y: -300, width: 68, height: 40, fill: K.skinH }), h('circle', { cx: 0, cy: -350, r: 68, fill: '#140e0a' }));
  const smoke = [...Array(6)].map((_, i) => { const c = h('circle', { fill: '#e8e0d8' }); L.g.appendChild(c); return c; });
  const coins = [...Array(8)].map(() => { const c = h('ellipse', { rx: 18, ry: 18, fill: K.gold, stroke: '#9c7a1f', 'stroke-width': 4 }); L.g.appendChild(c); return c; });
  S.update(t => { const m1 = mark(S, 1); document.getElementById('doorlight02').setAttribute('opacity', ramp(t, m1 - .2, .4) * .9); her.el.setAttribute('opacity', ramp(t, m1, .4));
    smoke.forEach((c, i) => { const ph = ((t * .35 + i / 6) % 1 + 1) % 1; S.set(c, { cx: 600 + Math.sin(ph * 6 + i) * 30 + ph * 40, cy: 1010 - ph * 380, r: 14 + ph * 40, opacity: (1 - ph) * .35 }); });
    coins.forEach((c, i) => { const u = ramp(t, m1 + .2 + i * .14, .9); const x = 600 + (460 - 600) * u, y = 1100 - Math.sin(u * Math.PI) * 260; S.set(c, { cx: x, cy: y, rx: 18 * Math.abs(Math.cos(t * 7 + i)) + 2, opacity: u > 0 && u < 1 ? 1 : 0 }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s03 — pas one sur moi / le huitième : réverbère froid, puis lune rouge et 8 silhouettes */
CLIP.scene('s03', S => {
  const { E, h } = S;
  const A = h('g'), B = h('g'); S.layer(0).g.append(A, B);
  A.append(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0e2a30' }), h('path', { d: 'M 480 600 L 600 600 L 900 1520 L 180 1520 Z', fill: '#bfe8e0', opacity: .18 }), h('rect', { x: 534, y: 560, width: 12, height: 960, fill: '#061416' }), h('ellipse', { cx: 540, cy: 590, rx: 50, ry: 16, fill: '#e8fff8' }));
  B.append(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#160c12' }), h('circle', { cx: 540, cy: 1040, r: 380, fill: K.crim }), h('circle', { cx: 540, cy: 1040, r: 470, fill: K.crim, opacity: .25, filter: 'url(#bigblur)' }));
  const L = S.layer(1);
  const g1 = h('g'); L.g.appendChild(g1);
  const him = E.person(HIM({ x: 540, y: 1500, s: 1.5, pose: 'stand', action: 'none', anim: (a, t) => { a.ua1 = -20; a.la1 = 10; a.ua2 = 20; a.la2 = -10; a.head = 18 + Math.sin(t * 2) * 3; } }));
  g1.appendChild(him.el); S.items.push(him);
  const pockets = [-1, 1].map(s => { const p = h('path', { d: `M ${540 + s * 70} 1120 l ${s * 40} 0 l ${-s * 10} 50 Z`, fill: '#e8e4dc' }); g1.appendChild(p); return p; });
  const g2 = h('g'); L.g.appendChild(g2);
  const eight = [];
  for (let i = 0; i < 8; i++) { const me = i === 7; const p = E.person({ x: 120 + i * 98, y: 1500, s: .78, facing: -1, action: 'idle', seed: i + 3, hat: me ? 'hood' : ['fedora', 'cap', 'beanie', 'fedora'][i % 4], outfit: me ? 'hoodie' : ['trench', 'jacket', 'hoodie', 'jacket'][i % 4], silhouette: '#0a0608', rim: me ? '#f6f2ea' : null, key: me ? 'lui (8e)' : false }); g2.appendChild(p.el); S.items.push(p); eight.push(p); }
  S.update(t => { const m1 = mark(S, 1), k = ramp(t, m1 - .1, .35); A.setAttribute('opacity', 1 - k); B.setAttribute('opacity', k); g1.setAttribute('opacity', 1 - k); g2.setAttribute('opacity', k);
    g1.querySelectorAll('[data-key]').forEach(e => e.setAttribute('data-key-allow', k > .5 ? 'overlap' : ''));
    eight.forEach((p, i) => p.el.setAttribute('opacity', ramp(t, m1 + i * .12, .2))); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [.3, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s04 — foi et courage / rage, orage : toit rouge, nuages, éclair, pluie */
CLIP.scene('s04', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0d1428', K.navy, '#2a3a66']));
  const clouds = E.clouds({ n: 6, y: 520, spread: 280, color: '#3a4670', opacity: .95, speed: 60, scale: 1.5 }); S.layer(.08).add(clouds);
  towers(S, .25, 1560, '#0e1630', 41, '#ffd28a', .3, { blur: 2 });
  const L = S.layer(.8);
  L.add(h('rect', { x: 260, y: 1250, width: 560, height: 700, fill: '#0b1124' }), h('rect', { x: 240, y: 1210, width: 600, height: 50, fill: K.crim }));
  L.add(E.person(HIM({ x: 420, y: 1215, s: .95, silhouette: '#0a0d18', action: 'breathe', key: 'lui' })));
  L.add(E.person(HER({ x: 640, y: 1215, s: .92, silhouette: '#0a0d18', facing: -1, action: 'breathe', key: 'elle' })));
  const bolt = h('path', { d: 'M 760 300 L 700 560 L 760 570 L 690 840 L 750 850 L 680 1180', stroke: '#f6f2ea', 'stroke-width': 9, fill: 'none', filter: 'url(#glow)', opacity: 0 }); S.layer(.1).add(bolt);
  const rain = E.rain({ n: 220, angle: 12, speed: 2400, color: '#c9d8ff', opacity: 0 }); S.layer(1).add(rain);
  const flash = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#e8eeff', opacity: 0 }); S.layer(1).add(flash);
  S.update(t => { const m1 = mark(S, 1), m2 = mark(S, 2); clouds.el.setAttribute('opacity', .4 + .6 * ramp(t, 0, m1));
    const f = [m1, m2].reduce((acc, a) => Math.max(acc, t >= a && t < a + .22 ? 1 - (t - a) / .22 : 0), 0); bolt.setAttribute('opacity', f > .3 ? 1 : 0); flash.setAttribute('opacity', f * .5);
    rain.el.setAttribute('opacity', .4 * ramp(t, m1, .5)); });
  S.camera([[0, { x: 0, y: 20, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine', { shake: 2 });
});

/* s05 — tatouage / entourage : l'avant-bras, puis panoramique vers la vitrine */
CLIP.scene('s05', S => {
  const { E, h } = S;
  const scene = h('g'); S.layer(1).g.appendChild(scene);
  // partie A (x 0..1080) : bras ; partie B (x 1080..2160) : vitrine
  scene.append(h('rect', { x: -400, y: -800, width: 1480, height: 3600, fill: '#2a1e1a' }), h('ellipse', { cx: 540, cy: 1060, rx: 460, ry: 300, fill: '#ffe2b0', opacity: .14, filter: 'url(#bigblur)' }));
  const arm = h('path', { d: 'M 40 1380 Q 300 1270 560 1160 Q 760 1080 980 1060 L 1000 1260 Q 760 1260 600 1320 Q 360 1430 60 1540 Z', fill: K.skinH }); scene.appendChild(arm);
  const tat = h('path', { d: heartD(560, 1230, 66), fill: 'none', stroke: '#140c0a', 'stroke-width': 8 }); scene.appendChild(tat);
  const needle = h('g', {}, [h('rect', { x: -20, y: -280, width: 40, height: 220, rx: 12, fill: '#3a3f52' }), h('rect', { x: -4, y: -60, width: 8, height: 60, fill: '#c8ccd8' })]); scene.appendChild(needle);
  scene.append(h('rect', { x: 1080, y: -800, width: 1480, height: 3600, fill: '#1a1428' }), h('rect', { x: 1140, y: 780, width: 960, height: 660, fill: '#3a2a50' }));
  [[1300, K.gold], [1620, '#e8d6c0'], [1900, '#8a2a4a']].forEach(([x, c]) => scene.append(h('ellipse', { cx: x, cy: 980, rx: 120, ry: 220, fill: '#fff2c8', opacity: .12, filter: 'url(#softblur)' }), h('rect', { x: x - 60, y: 1150, width: 120, height: 100, fill: c })));
  const friends = [0, 1, 2].map(i => { const p = E.person({ x: 1500 - i * 110, y: 1500, s: .8, facing: -1, action: 'walk', speed: .7, seed: 7 + i, silhouette: '#0c0a14', hat: ['cap', 'beanie', 'cap'][i], key: false }); scene.appendChild(p.el); S.items.push(p); return p; });
  const her = E.person(HER({ x: 1800, y: 1500, s: 1.25, action: 'walk', speed: .6, facing: 1, key: 'elle', keyAllow: 'cut' })); scene.appendChild(her.el); S.items.push(her);
  const bags = h('g', {}, [h('rect', { x: 0, y: 0, width: 70, height: 80, fill: K.gold }), h('rect', { x: 60, y: 10, width: 70, height: 80, fill: '#e8d6c0' })]); scene.appendChild(bags);
  let len = null;
  S.update(t => { if (!len) len = tat.getTotalLength(); const m1 = mark(S, 1), k = ramp(t, .1, m1 - .2); tat.setAttribute('stroke-dasharray', len); tat.setAttribute('stroke-dashoffset', len * (1 - k));
    const p = tat.getPointAtLength(len * k); needle.setAttribute('transform', `translate(${p.x},${p.y + Math.sin(t * 60) * 2}) rotate(16)`); needle.setAttribute('opacity', k < 1 ? 1 : 0);
    const pan = S.Ease.inOutCubic(ramp(t, m1 - .15, .7)); scene.setAttribute('transform', `translate(${-pan * 1080},0)`);
    friends.forEach((f, i) => f.el.setAttribute('transform', f.el.getAttribute('transform').replace(/translate\(([-\d.]+),/, (m0, x) => `translate(${+x - ramp(t, m1, 3) * 500},`)));
    bags.setAttribute('transform', `translate(1860,${1250 + Math.sin(t * 5) * 5})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.04 }]], 'linear');
});

/* s06 — dans quel film / attaché : pellicule qui défile puis s'enroule */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#1a1210' }));
  S.layer(.05).add(E.radial([[0, '#d89a4a', .35], [1, '#d89a4a', 0]], { cx: .5, cy: .55, r: .6 }));
  const strip = h('g'); S.layer(.5).g.appendChild(strip); S.key(strip, 'pellicule', 'cut');
  const FR = [];
  for (let i = 0; i < 8; i++) {
    const y = i * 340, g = h('g', { transform: `translate(0,${y})` });
    g.append(h('rect', { x: 300, y: 0, width: 480, height: 340, fill: '#0e0a08' }), h('rect', { x: 340, y: 30, width: 400, height: 280, fill: ['#1d2b4f', '#4a2f6a', '#7a4a2e', '#b3261e'][i % 4] }));
    for (let j = 0; j < 6; j++) g.append(h('rect', { x: 310, y: 14 + j * 56, width: 18, height: 26, rx: 4, fill: '#e8dcc8' }), h('rect', { x: 752, y: 14 + j * 56, width: 18, height: 26, rx: 4, fill: '#e8dcc8' }));
    const a = E.person(HIM({ x: 480, y: 300, s: .5, silhouette: '#0a0808', action: 'idle', seed: i, key: false })), b = E.person(HER({ x: 600, y: 300, s: .48, silhouette: '#0a0808', facing: -1, action: 'sway', seed: i + 9, key: false }));
    g.append(a.el, b.el); S.items.push(a, b); strip.appendChild(g); FR.push(g);
  }
  const WL = S.layer(1); const wraps = [...Array(5)].map(() => { const e = h('ellipse', { fill: 'none', stroke: '#0e0a08', 'stroke-width': 30 }); WL.g.appendChild(e); return e; });
  const hands = h('g', {}, [h('path', { d: 'M 360 1380 Q 470 1330 520 1350 L 520 1420 Q 470 1440 360 1440 Z', fill: K.skinH }), h('path', { d: 'M 720 1380 Q 610 1330 560 1350 L 560 1420 Q 610 1440 720 1440 Z', fill: K.skinH }), h('rect', { x: 200, y: 1370, width: 170, height: 80, fill: '#20263a' }), h('rect', { x: 710, y: 1370, width: 170, height: 80, fill: '#20263a' })]);
  WL.g.insertBefore(hands, wraps[0]); S.key(hands, 'poignets', 'overlap');
  S.update(t => { const m1 = mark(S, 1); const v = t * 260; strip.setAttribute('transform', `translate(0,${-(((v % 340) + 340) % 340) - 140})`);
    const k = ramp(t, m1, .8); strip.setAttribute('opacity', 1 - k * .7); hands.setAttribute('opacity', k);
    wraps.forEach((e, i) => { const kk = ramp(t, m1 + .2 + i * .15, .4); S.set(e, { cx: 540, cy: 1400, rx: 60 + i * 6, ry: 46 - i * 2, opacity: kk, transform: `rotate(${-20 + i * 10} 540 1400)` }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 30, zoom: 1.1 }]], 'inOutSine');
});

/* s07 — elle veut ci, ça / le bonheur pas dans la monnaie : vitrine qui s'allume, puis pièces dans le puits */
CLIP.scene('s07', S => {
  const { E, h } = S;
  const bg = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(bg);
  const win = h('g'); S.layer(.5).g.appendChild(win);
  win.append(h('rect', { x: 120, y: 760, width: 840, height: 640, fill: '#2a1f40' }), h('rect', { x: 120, y: 760, width: 840, height: 640, fill: 'none', stroke: '#5a4a7a', 'stroke-width': 14 }));
  const items = [[380, 'watch'], [590, 'bag'], [790, 'shoe']].map(([x, kind]) => {
    const g = h('g', { transform: `translate(${x},1300)` }, [h('ellipse', { cx: 0, cy: -230, rx: 100, ry: 230, fill: '#fff2c8', opacity: .16, filter: 'url(#softblur)' }), h('rect', { x: -70, y: 0, width: 140, height: 90, fill: '#3a2f55' })]);
    if (kind === 'watch') g.append(h('rect', { x: -18, y: -160, width: 36, height: 50, fill: K.gold }), h('rect', { x: -38, y: -112, width: 76, height: 76, rx: 14, fill: K.gold }), h('rect', { x: -27, y: -101, width: 54, height: 54, rx: 7, fill: K.ivory }), h('rect', { x: -18, y: -36, width: 36, height: 36, fill: K.gold }));
    if (kind === 'bag') g.append(h('path', { d: 'M -62 0 L -52 -100 L 52 -100 L 62 0 Z', fill: '#8a2a4a' }), h('path', { d: 'M -28 -100 Q 0 -150 28 -100', stroke: '#5a1a30', 'stroke-width': 7, fill: 'none' }));
    if (kind === 'shoe') g.append(h('path', { d: 'M -70 0 L -70 -26 Q -36 -34 0 -80 L 18 -80 Q 36 -36 70 -26 L 70 0 Z', fill: '#141018' }), h('rect', { x: 44, y: -34, width: 7, height: 34, fill: '#141018' }));
    win.appendChild(g); S.key(g, kind); return g; });
  const her = E.person(HER({ x: 150, y: 1530, s: 1.0, pose: 'point', action: 'idle', silhouette: '#0c0812', rim: '#e3b955' })); S.layer(1).add(her);
  const well = h('g', { opacity: 0 }, [h('ellipse', { cx: 540, cy: 1380, rx: 300, ry: 70, fill: '#000' }), h('ellipse', { cx: 540, cy: 1380, rx: 320, ry: 80, fill: 'none', stroke: '#3a4a7a', 'stroke-width': 10 })]); S.layer(1).add(well);
  const CL = S.layer(1); const coins = [...Array(12)].map(() => { const c = h('ellipse', { rx: 22, ry: 22, fill: K.gold, stroke: '#9c7a1f', 'stroke-width': 4 }); CL.g.appendChild(c); return c; });
  S.update(t => { const m1 = mark(S, 1), m2 = mark(S, 2); const k = ramp(t, m1, .6); bg.setAttribute('fill', S.mix('#1a1428', '#0a1022', k));
    items.forEach((g, i) => g.setAttribute('opacity', Math.min(ramp(t, .1 + i * .55, .25), 1 - k * .85)));
    her.el.setAttribute('opacity', 1 - k); well.setAttribute('opacity', ramp(t, m1 + .2, .4)); win.setAttribute('opacity', 1 - k * .6);
    coins.forEach((c, i) => { const u = ramp(t, m1 + .3 + i * .17, .9); const y = 700 + u * u * 690; S.set(c, { cx: 400 + (i * 53) % 280, cy: y, rx: 22 * Math.abs(Math.cos(t * 8 + i)) + 3, opacity: u > 0 && u < .98 ? 1 : 0 }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 20, zoom: 1.06 }]], 'inOutSine');
});

/* s08 — J'l'élimine… j'l'assimile : la partie d'échecs */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2a2530'], [1, '#08070a']], { cx: .5, cy: .5, r: .7 }));
  const B = h('g'); S.layer(.6).g.appendChild(B);
  for (let r = 0; r < 6; r++) { const y0 = 900 + r * 100, wt = 700 + r * 44, wb = 700 + (r + 1) * 44;
    for (let c = 0; c < 6; c++) { const xt0 = 540 - wt / 2 + c * wt / 6, xt1 = xt0 + wt / 6, xb0 = 540 - wb / 2 + c * wb / 6, xb1 = xb0 + wb / 6;
      B.appendChild(h('path', { d: `M ${xt0} ${y0} L ${xt1} ${y0} L ${xb1} ${y0 + 100} L ${xb0} ${y0 + 100} Z`, fill: (r + c) % 2 ? '#e8dcc8' : '#1a1418' })); } }
  B.appendChild(h('path', { d: 'M 172 1500 L 908 1500 L 930 1540 L 150 1540 Z', fill: '#3a2a20' }));
  const piece = (kind, fill) => { const g = h('g'); g.append(h('ellipse', { cx: 0, cy: 0, rx: 46, ry: 14, fill }), h('path', { d: 'M -30 0 Q -26 -60 -14 -110 L 14 -110 Q 26 -60 30 0 Z', fill }), h('circle', { cx: 0, cy: -124, r: 22, fill }));
    if (kind === 'queen') for (let i = -2; i <= 2; i++) g.appendChild(h('circle', { cx: i * 12, cy: -152, r: 7, fill: K.crim }));
    if (kind === 'king') g.append(h('rect', { x: -4, y: -178, width: 8, height: 36, fill }), h('rect', { x: -16, y: -166, width: 32, height: 8, fill })); return g; };
  const queen = piece('queen', '#e8dcc8'), king = piece('king', '#1a1418'); B.append(king, queen); S.key(queen, 'reine'); S.key(king, 'roi');
  const hand = h('g', {}, [h('path', { d: 'M -200 -20 L -40 -30 Q 0 -40 20 -20 Q 30 0 10 10 L -200 20 Z', fill: K.skinH }), h('rect', { x: -380, y: -36, width: 190, height: 70, fill: '#20263a' })]); S.layer(1).g.appendChild(hand);
  const shadow = h('ellipse', { rx: 0, ry: 0, fill: '#000', opacity: .8 }); B.insertBefore(shadow, king);
  S.update(t => { const m1 = mark(S, 1); const push = ramp(t, .6, .5), fall = S.Ease.outBounce ? 0 : 0;
    hand.setAttribute('transform', `translate(${380 + push * 120},${1080 - push * 10})`);
    const tip = S.Ease.inCubic(ramp(t, 1.0, .6)); queen.setAttribute('transform', `translate(${660 + tip * 60},${1110 + tip * 30}) rotate(${tip * 82})`);
    const ab = ramp(t, m1, 1.2); queen.setAttribute('opacity', 1 - ab); king.setAttribute('transform', `translate(470,1150) scale(${1 + ab * .25})`); S.set(shadow, { cx: 470 + ab * 80, cy: 1150, rx: ab * 220, ry: ab * 60 }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 30, zoom: 1.12 }]], 'inOutSine');
});

/* s09 — pas si vite / ton sang / pas assez bu : la rue cramoisie, puis les yeux dans le noir */
CLIP.scene('s09', S => {
  const { E, h } = S;
  const A = h('g'); S.layer(0).g.appendChild(A);
  A.append(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#2a0e10' }), h('path', { d: 'M 760 560 L 880 560 L 1180 1520 L 460 1520 Z', fill: '#ff7a5a', opacity: .18 }), h('rect', { x: 814, y: 540, width: 12, height: 1000, fill: '#0a0406' }), h('ellipse', { cx: 820, cy: 560, rx: 46, ry: 14, fill: '#ffb08a' }));
  A.appendChild(S.E.city({ y: 1500, color: '#1a0608', seed: 91, windows: '#ff8a6a', lit: .15, minH: 200, maxH: 600 }).el);
  const G = S.layer(1);
  const grp = h('g'); G.g.appendChild(grp);
  const him = E.person(HIM({ s: 1.35, action: 'walk', speed: .9, path: [[0, [540, 1520]], [1.6, [660, 1520]]], anim: (a, t) => { a.ua2 = -50; a.la2 = -60; } })); grp.appendChild(him.el); S.items.push(him);
  const her = E.person(HER({ s: 1.3, action: 'walk', speed: 1.2, path: [[0, [280, 1520]], [1.6, [470, 1520]]], anim: a => { a.ua1 = 95; a.la1 = 92; a.lean = 8; }, key: 'elle' })); grp.appendChild(her.el); S.items.push(her);
  const dark = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#050306', opacity: 0 }); G.g.appendChild(dark);
  const eyes = [[300, 900], [760, 820], [520, 1180], [180, 1280], [880, 1240], [620, 640]].map(([x, y], i) => { const g = h('g', { opacity: 0 }, [h('ellipse', { cx: x - 22, cy: y, rx: 14, ry: 8, fill: '#ffd36a', filter: 'url(#glow)' }), h('ellipse', { cx: x + 22, cy: y, rx: 14, ry: 8, fill: '#ffd36a', filter: 'url(#glow)' })]); G.g.appendChild(g); return g; });
  const bush = h('path', { d: 'M -100 1520 Q 60 1300 220 1420 Q 360 1260 540 1400 Q 700 1260 860 1420 Q 1000 1300 1180 1500 L 1180 2000 L -100 2000 Z', fill: '#0c0a10', opacity: 0 }); G.g.appendChild(bush);
  const moon = h('circle', { cx: 540, cy: 760, r: 160, fill: '#efe6d2', opacity: 0 }); G.g.insertBefore(moon, eyes[0]);
  S.update(t => { const m2 = mark(S, 2), k = ramp(t, m2 - .1, .3); dark.setAttribute('opacity', k); grp.setAttribute('opacity', 1 - k); bush.setAttribute('opacity', k); moon.setAttribute('opacity', k);
    grp.querySelectorAll('[data-key]').forEach(e => e.setAttribute('data-key-allow', k > .5 ? 'overlap,cut' : 'overlap'));
    eyes.forEach((g, i) => { const on = ramp(t, m2 + .1 + i * .18, .2); const ph = (t * .5 + i * .3) % 1, bl = ph > .94 ? .1 : 1; g.setAttribute('opacity', on * bl); }); });
  S.camera([[0, { x: -20, y: 0, zoom: 1.02 }], [.5, { x: 20, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine', { shake: 1.5 });
});

/* s10 — c'est fini / toute la semaine : la table à la fenêtre, lumière chaude puis froide, chaise vide */
CLIP.scene('s10', S => {
  const { E, h } = S;
  const bg = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(bg);
  const winL = h('rect', { x: 420, y: 600, width: 100, height: 520 }), winR = h('rect', { x: 560, y: 600, width: 100, height: 520 }), beam = h('path', { d: 'M 420 1120 L 660 1120 L 900 1560 L 180 1560 Z', opacity: .25 });
  S.layer(.1).g.append(winL, winR, beam);
  const L = S.layer(1);
  L.add(h('ellipse', { cx: 540, cy: 1300, rx: 150, ry: 26, fill: '#140c08' }), h('rect', { x: 532, y: 1300, width: 16, height: 210, fill: '#140c08' }), h('rect', { x: 470, y: 1500, width: 140, height: 14, fill: '#140c08' }));
  const chair = (x, f) => h('g', {}, [h('rect', { x: x - 50, y: 1330, width: 100, height: 14, fill: '#140c08' }), h('rect', { x: x + f * 40, y: 1160, width: 12, height: 350, fill: '#140c08' }), h('rect', { x: x - f * 46, y: 1340, width: 10, height: 170, fill: '#140c08' })]);
  L.g.append(chair(330, -1), chair(750, 1));
  L.add(E.person(HIM({ x: 330, y: 1500, s: 1.05, pose: 'sit', action: 'breathe', silhouette: '#140c08', anim: (a, t) => { a.ua1 = 70; a.la1 = 95; a.head = 14; } })));
  const her = E.person(HER({ x: 750, y: 1500, s: 1.0, pose: 'sit', facing: -1, action: 'breathe', silhouette: '#140c08' })); L.add(her);
  S.update(t => { const k = ramp(t, mark(S, 1), .9); bg.setAttribute('fill', S.mix('#6a3a1c', '#1c2a40', k)); [winL, winR].forEach(w => w.setAttribute('fill', S.mix('#ffd28a', '#cfe4ff', k))); beam.setAttribute('fill', S.mix('#ffd28a', '#cfe4ff', k));
    her.el.setAttribute('opacity', 1 - ramp(t, mark(S, 1) + .3, .8)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.07 }]], 'inOutSine');
});

/* s11 — est-ce que t'es sûr ? : le téléphone, la bulle arrive */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#1d2b4f'], [1, '#06080f']], { cx: .5, cy: .6, r: .7 }));
  const L = S.layer(1); const phone = h('g'); L.g.appendChild(phone); S.key(phone, 'téléphone');
  phone.append(h('rect', { x: 340, y: 780, width: 400, height: 720, rx: 46, fill: '#05070d' }), h('rect', { x: 360, y: 808, width: 360, height: 664, rx: 30, fill: '#121a30' }));
  const b1 = h('g', {}, [h('rect', { x: 380, y: 980, width: 250, height: 92, rx: 34, fill: '#3a2f45' }), h('rect', { x: 404, y: 1008, width: 150, height: 12, rx: 6, fill: '#fff', opacity: .75 }), h('rect', { x: 404, y: 1034, width: 100, height: 12, rx: 6, fill: '#fff', opacity: .5 })]);
  const dots = h('g', {}, [h('rect', { x: 380, y: 1100, width: 120, height: 60, rx: 28, fill: '#3a2f45' }), ...[0, 1, 2].map(i => h('circle', { cx: 410 + i * 30, cy: 1130, r: 8, fill: '#fff' }))]);
  phone.append(b1, dots, h('path', { d: 'M 420 1560 Q 400 1470 440 1440 L 640 1440 Q 690 1470 680 1560 Z', fill: K.skinH }));
  S.update(t => { const k = ramp(t, .15, .3); b1.setAttribute('opacity', k); b1.setAttribute('transform', `translate(0,${(1 - k) * 30})`); dots.setAttribute('opacity', t > .7 ? 1 : 0); [...dots.querySelectorAll('circle')].forEach((c, i) => c.setAttribute('cy', 1130 - Math.max(0, Math.sin(t * 9 - i)) * 9)); phone.setAttribute('transform', `rotate(${Math.sin(t * 1.3) * 1.5} 540 1140)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});
