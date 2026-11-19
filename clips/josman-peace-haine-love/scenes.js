/* Josman — « Peace, Haine, Love » (son TikTok, 60 s) — affiches de nuit où la lumière est le personnage principal.
 * AUCUN VISAGE : personnages de dos (E.person back:true). Identité par la coiffure et les vêtements :
 *   LUI = petites tresses + blouson bordeaux à manches crème + baskets blanches
 *   ELLE = longues tresses à perles dorées + veste satin émeraude
 *   FRÈRES = sweats noirs + casquettes
 * S.sb.marks[i] = début du i-ème morceau de phrase (temps local). Animations pures en t.
 */
const K = { night: '#0a0c18', night2: '#141a30', bord: '#6e1a2a', creme: '#efe2c8', emer: '#0f6b4a', blue: '#3a7bff', sodium: '#ffb35c', gold: '#e3b955', skin: '#7a4a32', skinF: '#8a5a3e', ink: '#08070c' };
const ramp = (t, a, d) => Math.max(0, Math.min(1, (t - a) / d));
const mark = (S, i) => (S.sb.marks || [0])[Math.min(i, (S.sb.marks || [0]).length - 1)];
const HIM = o => Object.assign({ back: true, hair: 'twists', outfit: 'bomber', look: { skin: K.skin, top: K.bord, sleeve: K.creme, rib: K.creme, bottom: '#1a1820', shoe: '#f4f1ea', hair: '#120c08' } }, o);
const HER = o => Object.assign({ back: true, hair: 'braids', outfit: 'satin', look: { skin: K.skinF, top: K.emer, bottom: '#1a1a22', shoe: '#1a1214', hair: '#140c08', accent2: K.gold } }, o);
const BRO = o => Object.assign({ back: true, hat: 'cap', hair: 'short', outfit: 'hoodie', look: { skin: '#5a3424', top: '#0e0e12', hat: '#0e0e12', bottom: '#0e0e12', shoe: '#e8e4dc' } }, o);
const heartD = (cx, cy, r) => { const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`; return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`; };
function handPath(h, fill, sleeve, cuff) {
  const g = h('g');
  g.appendChild(h('path', { d: 'M -120 -40 L 20 -46 Q 70 -60 120 -52 Q 140 -48 136 -36 Q 130 -28 100 -30 L 60 -28 Q 120 -24 150 -14 Q 162 -6 154 4 Q 146 10 120 6 L 70 2 Q 128 14 146 22 Q 154 32 144 40 Q 134 44 112 36 L 66 26 Q 108 42 118 50 Q 122 60 110 64 Q 96 64 60 50 Q 30 44 20 42 L -120 40 Z', fill }));
  if (sleeve) g.append(h('rect', { x: -330, y: -56, width: 230, height: 112, rx: 20, fill: sleeve }), h('rect', { x: -120, y: -56, width: 26, height: 112, rx: 8, fill: cuff || K.bord }));
  return g;
}
function cityNight(S, d, y, color, seed, win, lit = .3, blur = 0) { return S.layer(d, blur ? { blur } : undefined).add(S.E.city({ y, color, seed, windows: win, lit, minH: 250, maxH: 820, density: .8 })); }

/* s00 — intro : ses tresses et son col à contre-jour d'un néon */
CLIP.scene('s00', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#120a14' }));
  const neon = h('g', {}, [h('rect', { x: 180, y: 560, width: 720, height: 150, rx: 75, fill: 'none', stroke: '#ff3d8b', 'stroke-width': 14, filter: 'url(#glow)' }), h('rect', { x: 230, y: 610, width: 620, height: 50, rx: 25, fill: 'none', stroke: '#7fd6ff', 'stroke-width': 9, filter: 'url(#glow)' })]);
  const halo = h('ellipse', { cx: 540, cy: 640, rx: 520, ry: 260, fill: '#ff3d8b', opacity: .25, filter: 'url(#bigblur)' });
  S.layer(.2).g.append(halo, neon);
  S.layer(1).add(E.person(HIM({ x: 520, y: 3150, s: 4.6, action: 'breathe', key: 'lui (tresses)', keyAllow: 'cut,ui' })));
  S.layer(1.1).add(E.flare({ x: 760, y: 600, color: '#ff8ab8', opacity: .45 }));
  S.update(t => { const f = (S.noise(t * 11, 3) > .45 || t < .25) ? 1 : .3; neon.setAttribute('opacity', f); halo.setAttribute('opacity', .25 * f); });
  S.camera([[0, { x: 0, y: 40, zoom: 1.08 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s01 — Putain encore un soir… : chambre, téléphone, bandes de stores */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#10131f' }));
  S.layer(.1).add(E.blindsLight({ y: 640, hgt: 760, color: '#ffd7a0', opacity: .26, speed: 300 }));
  S.layer(.15).add(h('rect', { x: -800, y: 1420, width: 2700, height: 800, fill: '#0b0d16' }));
  const L = S.layer(1);
  L.add(h('rect', { x: 120, y: 1290, width: 840, height: 140, rx: 20, fill: '#262a3e' }), h('rect', { x: 120, y: 1240, width: 260, height: 70, rx: 30, fill: '#d8dbe6' }), h('rect', { x: 120, y: 1420, width: 840, height: 100, fill: '#1a1d2c' }));
  L.add(E.person(HIM({ x: 600, y: 1520, s: 1.35, pose: 'sit', action: 'breathe', anim: (a, t) => { a.lean = 16; a.head = 26; a.ua1 = 60; a.la1 = 120; } })));
  const glow = h('ellipse', { cx: 720, cy: 1120, rx: 160, ry: 200, fill: '#9fd0ff', opacity: .25, filter: 'url(#bigblur)' }); L.g.appendChild(glow);
  S.update(t => glow.setAttribute('opacity', .2 + .08 * Math.sin(t * 4)));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: -20, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s02 — relation tombée à l'eau : le polaroid d'elle coule */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05121c', '#0a2232', '#04080e']));
  const caus = h('g', { style: 'mix-blend-mode:screen' }), waves = [...Array(9)].map(() => { const p = h('path', { fill: 'none', stroke: '#6fd0e0', 'stroke-width': 5, opacity: .25 }); caus.appendChild(p); return p; }); S.layer(.2).add(caus);
  const pol = h('g'); S.layer(1).g.appendChild(pol); S.key(pol, 'polaroid');
  pol.append(h('rect', { x: -170, y: -210, width: 340, height: 420, fill: '#efe9dc' }), h('rect', { x: -146, y: -186, width: 292, height: 300, fill: '#1a1428' }));
  const her = E.person(HER({ x: 0, y: 180, s: .62, action: 'sway', key: false })); pol.appendChild(her.el); S.items.push(her);
  S.defs.appendChild(h('clipPath', { id: 'polc02' }, [h('rect', { x: -146, y: -186, width: 292, height: 300 })])); her.el.setAttribute('clip-path', 'url(#polc02)');
  const ripple = [0, 1, 2].map(() => { const e = h('ellipse', { fill: 'none', stroke: '#bfefff', 'stroke-width': 4 }); S.layer(1).g.appendChild(e); return e; });
  const bubbles = E.particles({ n: 30, color: '#bfefff', size: [3, 8], drift: [0, -80], area: [300, 700, 480, 900], opacity: .6, seed: 22 }); S.layer(1).add(bubbles);
  S.update(t => { waves.forEach((p, i) => { let d = `M -100 ${600 + i * 130}`; for (let x = -100; x <= 1200; x += 60) d += ` L ${x} ${600 + i * 130 + Math.sin(x / 90 + t * 2 + i) * 18}`; p.setAttribute('d', d); });
    const k = ramp(t, 0, 2.6); pol.setAttribute('transform', `translate(${540 + Math.sin(t * 2) * 40},${860 + k * 480}) rotate(${-8 + Math.sin(t * 1.6) * 14}) scale(${1 - k * .15})`); pol.setAttribute('opacity', 1 - ramp(t, 2.2, .4) * .5);
    ripple.forEach((e, i) => { const u = ((t * .7 + i / 3) % 1 + 1) % 1; S.set(e, { cx: 540, cy: 780, rx: 40 + u * 360, ry: 8 + u * 60, opacity: (1 - u) * .7 }); }); });
  S.camera([[0, { x: 0, y: -40, zoom: 1.0 }], [1, { x: 0, y: 40, zoom: 1.06 }]], 'inOutSine');
});

/* s03 — J'réponds plus trop aux appels : le téléphone qui vibre illumine le plafond */
CLIP.scene('s03', S => {
  const { E, h } = S;
  const ceil = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0c0e18' }); S.layer(0).add(ceil);
  const flood = h('ellipse', { cx: 540, cy: 700, rx: 700, ry: 520, fill: '#7fb8ff', opacity: 0, filter: 'url(#bigblur)' }); S.layer(.1).add(flood);
  const L = S.layer(1);
  L.add(h('path', { d: 'M -100 1200 L 1180 1200 L 1300 1900 L -220 1900 Z', fill: '#2a1c14' }));
  const phone = h('g'); L.g.appendChild(phone); S.key(phone, 'téléphone');
  phone.append(h('rect', { x: -80, y: -150, width: 160, height: 300, rx: 22, fill: '#05070d' }), h('rect', { x: -68, y: -136, width: 136, height: 272, rx: 14, fill: '#2f6fed', id: 'scr03' }));
  const cash = h('g', {}, [...[0, 1, 2, 3].map(i => h('rect', { x: -110, y: -i * 14, width: 220, height: 60, rx: 6, fill: i % 2 ? '#c9b458' : '#d8c46a', stroke: '#7d6a1c', 'stroke-width': 3 })), h('rect', { x: -14, y: -50, width: 28, height: 70, fill: K.gold })]);
  cash.setAttribute('transform', 'translate(770,1420)'); L.g.appendChild(cash); S.key(cash, 'liasse');
  L.add(E.spotlight({ x: 770, y: 900, angle: 0, len: 600, width: 260, color: K.gold, opacity: .25, dust: 10 }));
  const hand = h('g'); hand.appendChild(handPath(h, K.skin, K.creme, K.bord)); L.g.appendChild(hand); S.key(hand, 'main', 'cut');
  S.update(t => { const ring = (t % .8) < .45, k = ramp(t, 1.4, .5);
    phone.setAttribute('transform', `translate(${380 + (ring && k < 1 ? Math.sin(t * 90) * 6 : 0)},1420) rotate(${-12 + k * 12})`);
    document.getElementById('scr03').setAttribute('fill', ring ? '#5aa0ff' : '#1a2a5a'); flood.setAttribute('opacity', ring ? .35 * (1 - k * .5) : .08);
    hand.setAttribute('transform', `translate(${-120 + Math.min(1, t / 1.4) * 380},${1430 - k * 60}) rotate(${-6 + k * 4}) scale(.9)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 20, zoom: 1.08 }]], 'inOutSine');
});

/* s04 — Loyauté qui s'fait la belle et l'honneur qui s'fait la malle : les frères partent vers la lumière */
CLIP.scene('s04', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0c0a10' }));
  const C = h('g'); S.layer(.1).g.appendChild(C);
  for (let i = 0; i < 6; i++) { const k = i / 6; C.appendChild(h('path', { d: `M ${100 + k * 340} ${600 + k * 300} L ${980 - k * 340} ${600 + k * 300} L ${980 - (k + 1 / 6) * 340} ${600 + (k + 1 / 6) * 300} L ${100 + (k + 1 / 6) * 340} ${600 + (k + 1 / 6) * 300} Z`, fill: i % 2 ? '#16131c' : '#1c1824' })); }
  const door = h('rect', { x: 440, y: 900, width: 200, height: 380, fill: '#fff6dc', filter: 'url(#glow)' }); C.appendChild(door);
  const beam = h('path', { d: 'M 440 1280 L 640 1280 L 1000 1900 L 80 1900 Z', fill: '#fff2c8', opacity: .3 }); S.layer(.15).add(beam);
  const g = S.layer(1);
  const b1 = E.person(BRO({ s: 1.2, action: 'walk', speed: .8, seed: 3, path: [[0, [360, 1600]], [2.4, [470, 1330]]], key: 'frère', keyAllow: 'overlap' })), b2 = E.person(BRO({ s: 1.15, action: 'walk', speed: .8, seed: 5, path: [[0, [700, 1640]], [2.4, [610, 1340]]], key: 'frère 2', keyAllow: 'overlap' }));
  g.add(b1); g.add(b2);
  const case_ = h('g', {}, [h('rect', { x: -50, y: -70, width: 100, height: 70, rx: 8, fill: '#3a2a20' }), h('rect', { x: -14, y: -84, width: 28, height: 16, rx: 6, fill: 'none', stroke: '#3a2a20', 'stroke-width': 6 })]); g.g.appendChild(case_);
  S.update(t => { const m1 = mark(S, 1), k = ramp(t, 0, 2.4); case_.setAttribute('transform', `translate(${680 - k * 100},${1640 - k * 290}) scale(${1 - k * .3})`);
    const close = ramp(t, m1 + .5, .5); door.setAttribute('width', 200 * (1 - close)); beam.setAttribute('opacity', .3 * (1 - close)); [b1, b2].forEach(b => b.el.setAttribute('opacity', 1 - close)); case_.setAttribute('opacity', 1 - close); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});

/* s05 — le blues qui fait mal / perdu le goût : bar bleu néon qui s'éteint */
CLIP.scene('s05', S => {
  const { E, h } = S;
  const bg = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(bg);
  const neon = h('path', { d: 'M 260 640 Q 380 560 500 640 T 740 640 T 900 600', fill: 'none', stroke: K.blue, 'stroke-width': 14, 'stroke-linecap': 'round', filter: 'url(#glow)' });
  const halo = h('ellipse', { cx: 560, cy: 640, rx: 520, ry: 280, fill: K.blue, opacity: .3, filter: 'url(#bigblur)' }); S.layer(.1).g.append(halo, neon);
  const shelf = h('g'); for (let i = 0; i < 9; i++) shelf.appendChild(h('rect', { x: 150 + i * 90, y: 820 - (i % 3) * 20, width: 40, height: 120 + (i % 3) * 20, rx: 10, fill: ['#3a5a9a', '#2a4a7a', '#5a7ab0'][i % 3], opacity: .8 })); S.layer(.2).add(shelf);
  const L = S.layer(1);
  L.add(h('rect', { x: -100, y: 1260, width: 1300, height: 50, fill: '#1a2440' }), h('rect', { x: -100, y: 1310, width: 1300, height: 700, fill: '#0c1224' }));
  L.add(h('rect', { x: 470, y: 1380, width: 120, height: 22, rx: 10, fill: '#2a3658' }), h('rect', { x: 520, y: 1400, width: 20, height: 170, fill: '#1e2846' }), h('ellipse', { cx: 530, cy: 1572, rx: 70, ry: 12, fill: '#1e2846' }));
  L.add(E.person(HIM({ x: 540, y: 1560, s: 1.3, pose: 'sit', action: 'breathe', anim: a => { a.lean = 22; a.head = 30; a.ua1 = 80; a.la1 = 100; a.ua2 = 70; a.la2 = 95; } })));
  const glass = h('g', {}, [h('path', { d: 'M -26 0 L 26 0 L 20 -80 L -20 -80 Z', fill: '#9fc0ff', opacity: .5 }), h('rect', { x: -20, y: -40, width: 40, height: 38, fill: '#c98a3a', opacity: .8 })]); glass.setAttribute('transform', 'translate(820,1262) scale(1.7)'); L.g.appendChild(glass); S.key(glass, 'verre', 'overlap');
  S.update(t => { const m1 = mark(S, 1), k = ramp(t, m1, .9), f = k < 1 && S.noise(t * 14, 2) > .3 ? 1 : (k >= 1 ? 0 : .2);
    neon.setAttribute('opacity', (1 - k) * f + .05); halo.setAttribute('opacity', .3 * (1 - k) * f); bg.setAttribute('fill', S.mix('#0d1838', '#0c0c10', k));
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s06 — à contre-sens : les phares arrivent en traînées et découpent sa silhouette */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#06070e', '#121628', '#20203a']));
  S.layer(.2).add(E.road({ horizon: 1050, color: '#12141e', line: '#d8c890', width: 1300, speed: -2 }));
  const L = S.layer(.9); const lights = [...Array(10)].map((_, i) => { const g = h('g', {}, [h('circle', { r: 1, fill: '#fff6d8', filter: 'url(#glow)' }), h('circle', { r: 1, fill: '#fff6d8', filter: 'url(#glow)' })]); L.g.appendChild(g); return g; });
  const streaks = [...Array(12)].map(() => { const l = h('line', { stroke: '#ffe6b0', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .5 }); L.g.appendChild(l); return l; });
  S.layer(1).add(E.person(HIM({ x: 520, y: 1520, s: 1.45, action: 'walk', speed: .8, rim: '#fff2cc' })));
  S.update(t => { lights.forEach((g, i) => { const z = Math.pow((((t * .5 + i / 10) % 1) + 1) % 1, 2.2), y = 1060 + z * 700, sep = 20 + z * 320, r = 3 + z * 40, x = 540 + (i % 2 ? 1 : -1) * z * 160;
      g.children[0].setAttribute('cx', x - sep / 2); g.children[1].setAttribute('cx', x + sep / 2); [...g.children].forEach(c => { c.setAttribute('cy', y); c.setAttribute('r', r); }); g.setAttribute('opacity', Math.min(1, z * 3)); });
    streaks.forEach((l, i) => { const a = (i / 12 - .5) * 2.2, ph = (((t * 1.5 + i * .37) % 1) + 1) % 1, r0 = 80 + ph * 1100; S.set(l, { x1: 540 + Math.sin(a) * r0, y1: 1050 + Math.cos(a) * r0 * .5, x2: 540 + Math.sin(a) * (r0 + 180), y2: 1050 + Math.cos(a) * (r0 + 180) * .5, opacity: ph * .6 }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'linear', { shake: 2, shakeFreq: 8 });
});

/* s07 — tous les chemins mènent à Rome / à la mort : arches au couchant, soleil qui rougit */
CLIP.scene('s07', S => {
  const { E, h } = S;
  const sky = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(sky);
  const sun = h('circle', { cx: 540, cy: 1040, r: 170 }); S.layer(.05).add(sun);
  const rays = E.rays({ x: 540, y: 1040, n: 20, color: '#fff2c8', opacity: .14, speed: 4 }); S.layer(.06).add(rays);
  const arches = h('g'); for (let i = 0; i < 5; i++) arches.appendChild(h('path', { d: `M ${160 + i * 170} 1180 L ${160 + i * 170} 1040 A 70 70 0 0 1 ${300 + i * 170} 1040 L ${300 + i * 170} 1180 L ${330 + i * 170} 1180 L ${330 + i * 170} 960 L ${130 + i * 170} 960 L ${130 + i * 170} 1180 Z`, fill: '#2a1418' })); arches.appendChild(h('rect', { x: 120, y: 930, width: 880, height: 40, fill: '#2a1418' }));
  S.layer(.2).add(arches); S.key(arches, 'arches');
  const roads = h('g'); [-1, -.5, 0, .5, 1].forEach(k => roads.appendChild(h('path', { d: `M ${540 + k * 40} 1190 L ${540 + k * 40 + 18} 1190 L ${540 + k * 900 + 60} 1950 L ${540 + k * 900 - 60} 1950 Z`, fill: '#3a2420' }))); S.layer(.4).add(roads);
  S.layer(.38).add(h('rect', { x: -800, y: 1180, width: 2700, height: 800, fill: '#1a0e10' }));
  S.update(t => { const k = ramp(t, mark(S, 1), .8); sky.setAttribute('fill', S.mix('#e88a4a', '#3a0a10', k)); sun.setAttribute('fill', S.mix('#ffd88a', '#c0181a', k)); rays.el.setAttribute('opacity', 1 - k * .7); roads.setAttribute('opacity', 1 - k * .7); });
  S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s08 — que le ciel me laisse une chance : le rayon de lumière perce les nuages */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a0e1c', '#1a2238', '#2a3048']));
  const clouds = E.clouds({ n: 7, y: 440, spread: 300, color: '#2a3048', opacity: 1, speed: 40, scale: 1.7 }); S.layer(.08).add(clouds);
  cityNight(S, .25, 1560, '#0e1220', 81, '#ffd28a', .25, 2);
  const L = S.layer(.8); L.add(h('rect', { x: 200, y: 1500, width: 680, height: 600, fill: '#0b0e1a' }), h('rect', { x: 180, y: 1488, width: 720, height: 18, fill: '#2a3048' }));
  const beam = E.spotlight({ x: 600, y: 120, angle: 6, len: 1450, width: 380, color: '#fff6dc', opacity: .55, dust: 40 }); S.layer(.7).add(beam);
  S.layer(1).add(E.person(HIM({ x: 520, y: 1500, s: 1.3, pose: 'lookup', action: 'breathe', rim: '#fff2cc' })));
  S.layer(1).add(E.rain({ n: 160, angle: 8, color: '#c9d8ff', opacity: .3 }));
  S.update(t => { const k = ramp(t, .5, 1.2); beam.el.setAttribute('opacity', k); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: -30, zoom: 1.0 }]], 'inOutSine');
});

/* s09 — J'la saisirai à bras l'corps : il attrape la boule de lumière, la caméra s'élève */
CLIP.scene('s09', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a1430', '#3a2a6a', '#c86a5a']));
  S.layer(.05).add(E.stars({ n: 100, seed: 91 }));
  S.layer(.2, { blur: 3 }).add(E.mountains({ y: 1420, color: '#2a1e40', seed: 92, amp: 160 }));
  S.layer(.4).add(E.hills({ y: 1500, color: '#140e22', seed: 93, amp: 60 }));
  const orb = h('g', {}, [h('circle', { r: 110, fill: '#ffe6a0', opacity: .35, filter: 'url(#bigblur)' }), h('circle', { r: 34, fill: '#fff6dc', filter: 'url(#glow)' })]); S.layer(1).g.appendChild(orb); S.key(orb, 'lumière', 'overlap');
  S.layer(1).add(E.person(HIM({ x: 460, y: 1520, s: 1.35, pose: 'reach', action: 'reach', speed: 1.4 })));
  S.layer(1).add(E.fireflies({ n: 30, color: '#ffe6a0', area: [200, 800, 700, 700], seed: 94 }));
  S.update(t => { const k = ramp(t, 0, 1.6); orb.setAttribute('transform', `translate(${560 + (1 - k) * 160},${1010 - (1 - k) * 60 + Math.sin(t * 3) * 10})`); });
  S.camera([[0, { x: 0, y: -60, zoom: 1.12 }], [1, { x: 0, y: 80, zoom: 1.0 }]], 'inOutSine');
});

/* s10 — la flore, la faune : jungle en parallaxe, rayons, cerf */
CLIP.scene('s10', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a2a1c', '#145a3a', '#8ac87a']));
  S.layer(.08).add(E.rays({ x: 600, y: 300, n: 14, color: '#fff6c8', opacity: .16, speed: 3 }));
  const leaf = (x, y, s, rot, c) => h('path', { d: 'M 0 0 Q 120 -60 260 0 Q 120 60 0 0 Z M 10 0 L 250 0', transform: `translate(${x},${y}) rotate(${rot}) scale(${s})`, fill: c, stroke: c, 'stroke-width': 2 });
  const back = h('g'); for (let i = 0; i < 14; i++) back.appendChild(leaf((i * 97) % 1100 - 40, 900 + (i * 53) % 600, 1.2 + (i % 3) * .4, (i * 47) % 360, '#1e5a3a')); S.layer(.2, { blur: 3 }).add(back);
  const deer = h('g', { transform: 'translate(780,1330)' }, [h('path', { d: 'M -70 0 L -60 -90 Q -20 -110 40 -100 L 60 -150 L 70 -150 L 66 -96 Q 80 -90 70 -60 L 60 0 L 50 0 L 46 -60 L -30 -60 L -40 0 Z', fill: '#0e2a1c' }), h('path', { d: 'M 60 -150 L 40 -200 M 52 -175 L 30 -185 M 68 -150 L 90 -195 M 80 -172 L 100 -178', stroke: '#0e2a1c', 'stroke-width': 7 })]);
  S.layer(.35).add(deer); S.key(deer, 'cerf');
  S.layer(.45).add(E.birds({ n: 5, x: 120, y: 900, speed: 60, color: '#0e2a1c', size: 16 }));
  S.layer(.6).add(E.person(HIM({ x: 300, y: 1500, s: 1.05, pose: 'lookup', action: 'breathe' })));
  S.layer(.6).add(h('rect', { x: -800, y: 1500, width: 2700, height: 600, fill: '#0b2016' }));
  const front = h('g'); for (let i = 0; i < 8; i++) front.appendChild(leaf((i * 160) - 100, i % 2 ? 1700 : 260, 2.6, i % 2 ? -30 - i * 8 : 160 + i * 6, '#071a10')); S.layer(1.2, { blur: 2 }).add(front);
  S.layer(1).add(E.fireflies({ n: 40, color: '#e8ff9a', seed: 101 }));
  S.update(t => { front.setAttribute('transform', `translate(${Math.sin(t * .8) * 14},0)`); deer.setAttribute('transform', `translate(780,1330) rotate(${Math.sin(t * 1.5) * 2})`); });
  S.camera([[0, { x: 60, y: 0, zoom: 1.06 }], [1, { x: -60, y: 0, zoom: 1.06 }]], 'linear');
});

/* s11 — J'ai longtemps crié ma haine : le cri, ondes de choc, puis le silence */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#1a0608', '#3a0e10', '#120406']));
  cityNight(S, .2, 1560, '#0e0608', 111, '#ff7a5a', .25, 2);
  const rings = [...Array(6)].map(() => { const e = h('ellipse', { fill: 'none', stroke: '#ffb08a', 'stroke-width': 6 }); S.layer(.5).g.appendChild(e); return e; });
  S.layer(.8).add(h('rect', { x: 200, y: 1500, width: 680, height: 600, fill: '#0a0406' }));
  S.layer(1).add(E.person(HIM({ x: 520, y: 1500, s: 1.4, pose: 'arms_up', action: 'none', rim: '#ff9a7a', anim: (a, t) => { a.ua1 = -40; a.la1 = -30; a.ua2 = -60; a.la2 = -50; a.lean = -16; a.head = -30; } })));
  S.update(t => rings.forEach((e, i) => { const u = (((t - .2) * .9 + i / 6) % 1 + 1) % 1, on = t < 1.9 ? 1 : 0; S.set(e, { cx: 540, cy: 860, rx: 40 + u * 700, ry: 20 + u * 340, opacity: (1 - u) * .7 * on }); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'linear', { shake: 5, shakeFreq: 12 });
});

/* s12 — le cœur dans la paume, rempli d'hématomes */
CLIP.scene('s12', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2a1020'], [1, '#07040a']], { cx: .5, cy: .6, r: .6 }));
  const L = S.layer(1);
  const hand = h('g', { transform: 'translate(560,1310) rotate(-90) scale(1.5)' }); hand.appendChild(handPath(h, K.skin, K.creme, K.bord)); L.g.appendChild(hand); S.key(hand, 'main', 'cut,ui');
  const glow = h('circle', { cx: 560, cy: 1050, r: 210, fill: '#ff5a7a', opacity: .3, filter: 'url(#bigblur)' }), heart = h('path', { d: heartD(560, 1060, 140), fill: '#d4304a' });
  const bruises = [[510, 1010, 34], [610, 1050, 26], [560, 1110, 22], [500, 1080, 16]].map(([x, y, r]) => h('ellipse', { cx: x, cy: y, rx: r, ry: r * .8, fill: '#5a2a6a', opacity: .75 }));
  const hg = h('g'); hg.append(glow, heart, ...bruises); L.g.appendChild(hg); S.key(hg, 'cœur');
  S.update(t => { const p = t % .62, b = Math.exp(-p * 12) + .6 * (p > .16 ? Math.exp(-(p - .16) * 14) : 0); hg.setAttribute('transform', `translate(560,1060) scale(${1 + b * .07}) translate(-560,-1060)`); glow.setAttribute('opacity', .2 + b * .2); });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s13 — dans tous mes atomes : sa silhouette se dissout en particules */
CLIP.scene('s13', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#14204a'], [1, '#04050c']], { cx: .5, cy: .6, r: .7 }));
  const him = E.person(HIM({ x: 540, y: 1520, s: 1.5, action: 'breathe', rim: '#9fd0ff' })); S.layer(1).add(him);
  const r = S.rng; const atoms = [...Array(90)].map(() => { const c = h('circle', { r: 2 + r() * 5, fill: r() < .5 ? '#9fd0ff' : '#ffd28a', filter: 'url(#glow)' }); S.layer(1).g.appendChild(c); return [c, r() * 6.28, 60 + r() * 380, .4 + r() * 1.2, r() * 900]; });
  S.update(t => { const k = ramp(t, .4, 1.6); him.el.setAttribute('opacity', 1 - k * .85);
    atoms.forEach(([c, a0, rr, sp, y0]) => { const a = a0 + t * sp; const cx = 540 + Math.cos(a) * rr * k, cy = 1520 - y0 * .7 + Math.sin(a) * rr * .45 * k - k * 120; S.set(c, { cx, cy, opacity: k }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -40, zoom: 1.1 }]], 'inOutSine');
});

/* s14 — Personne viendra avec moi dans ma tombe : seul dans le cercle de lumière, la foule s'efface */
CLIP.scene('s14', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#06060a' }));
  const crowd = E.crowd({ n: 7, y: 1440, x0: 40, x1: 1040, s: .95, color: '#16161e', seed: 141, action: 'idle', depthRows: 2 }); S.layer(.3, { blur: 1.5 }).add(crowd);
  S.layer(.5).add(E.spotlight({ x: 540, y: 0, len: 1600, width: 600, color: '#f2f0ff', opacity: .38, dust: 40 }));
  S.layer(.6).add(h('ellipse', { cx: 540, cy: 1530, rx: 300, ry: 60, fill: '#f2f0ff', opacity: .25, filter: 'url(#softblur)' }));
  S.layer(1).add(E.person(HIM({ x: 540, y: 1530, s: 1.35, action: 'breathe', pose: 'sad' })));
  S.layer(1.1).add(E.fog({ y: 1560, height: 260, color: '#8a8aa8', opacity: .25 }));
  S.update(t => crowd.el.setAttribute('opacity', 1 - ramp(t, .4, 1.4)));
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s15 — croqué mais pas avalé la pomme : douche de lumière sur la main */
CLIP.scene('s15', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#08080a' }));
  S.layer(.2).add(E.spotlight({ x: 540, y: 0, len: 1500, width: 520, color: '#fff6e0', opacity: .32, dust: 30 }));
  const L = S.layer(1);
  const hand = h('g', { transform: 'translate(500,1380) rotate(-70) scale(1.4)' }); hand.appendChild(handPath(h, K.skin, K.creme, K.bord)); L.g.appendChild(hand); S.key(hand, 'main', 'cut,ui');
  const apple = h('g'); apple.append(h('circle', { cx: -40, cy: 0, r: 90, fill: '#6aa83a' }), h('circle', { cx: 40, cy: 0, r: 90, fill: '#7ab84a' }), h('path', { d: 'M 60 -60 Q 110 -20 70 40 Q 100 20 120 -10 L 130 -70 Z', fill: '#f4ecd0' }), h('path', { d: 'M 0 -86 Q 6 -120 20 -130', stroke: '#3a2a10', 'stroke-width': 8, fill: 'none' }), h('ellipse', { cx: 30, cy: -128, rx: 22, ry: 10, fill: '#3a8a2a' }), h('ellipse', { cx: -60, cy: -30, rx: 18, ry: 30, fill: '#fff', opacity: .25 }));
  L.g.appendChild(apple); S.key(apple, 'pomme');
  S.update(t => apple.setAttribute('transform', `translate(560,1080) rotate(${Math.sin(t * 1.2) * 5}) scale(${1 + Math.sin(t * 2) * .01})`));
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.1 }]], 'inOutSine');
});

/* s16 — Cercle fermé, je n'vais pas rentrer dans la ronde : vue du dessus */
CLIP.scene('s16', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#14100c' }));
  S.layer(.1).add(h('circle', { cx: 540, cy: 1030, r: 420, fill: '#ffe2a0', opacity: .22, filter: 'url(#bigblur)' }));
  const ring = h('g'); S.layer(.5).g.appendChild(ring); S.key(ring, 'ronde', 'overlap');
  const n = 9, people = [];
  for (let i = 0; i < n; i++) { const g = h('g'); g.append(h('ellipse', { rx: 46, ry: 32, fill: '#2a2218' }), h('circle', { r: 26, fill: '#120e0a' }), h('path', { d: 'M -46 0 L -80 0 M 46 0 L 80 0', stroke: '#2a2218', 'stroke-width': 14, 'stroke-linecap': 'round' })); ring.appendChild(g); people.push(g); }
  const me = h('g'); me.append(h('ellipse', { rx: 54, ry: 36, fill: K.bord }), h('path', { d: 'M -54 0 L -76 20 M 54 0 L 76 20', stroke: K.creme, 'stroke-width': 20, 'stroke-linecap': 'round' }), h('circle', { r: 30, fill: '#120c08' }));
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; me.appendChild(h('line', { x1: Math.cos(a) * 24, y1: Math.sin(a) * 24, x2: Math.cos(a) * 42, y2: Math.sin(a) * 42, stroke: '#120c08', 'stroke-width': 10, 'stroke-linecap': 'round' })); }
  S.layer(1).g.appendChild(me); S.key(me, 'lui');
  S.update(t => { people.forEach((g, i) => { const a = i / n * Math.PI * 2 + t * .9; g.setAttribute('transform', `translate(${540 + Math.cos(a) * 290},${1030 + Math.sin(a) * 290}) rotate(${a * 180 / Math.PI + 90}) scale(1.5)`); });
    me.setAttribute('transform', `translate(${760 - Math.min(1, t / 2) * 40},${1420}) rotate(-60) scale(1.7)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0, rot: 0 }], [1, { x: 0, y: 0, zoom: 1.06, rot: 4 }]], 'inOutSine');
});

/* s17 — comme sur le ring / ma paire de gants : projecteurs qui se resserrent */
CLIP.scene('s17', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#07070c' }));
  const spots = [-24, 0, 24].map((a, i) => { const sp = E.spotlight({ x: 0, y: 0, angle: 0, len: 1700, width: 520, color: '#f6f2ff', opacity: .3, dust: 25, seed: 170 + i }); const w = h('g', {}, [sp.el]); S.layer(.2).add({ el: w, update: sp.update }); return w; });
  const R = S.layer(.6);
  R.add(h('path', { d: 'M -100 1380 L 1180 1380 L 1300 1900 L -220 1900 Z', fill: '#2a2a3a' }));
  [1150, 1220, 1290].forEach(y => R.add(h('line', { x1: -100, y1: y, x2: 1180, y2: y + 40, stroke: '#c8c8d8', 'stroke-width': 8 })));
  R.add(h('rect', { x: 120, y: 1080, width: 24, height: 340, fill: '#8a1a2a' }));
  const glove = (x, y, c) => h('g', { transform: `translate(${x},${y})` }, [h('ellipse', { rx: 36, ry: 44, fill: c }), h('rect', { x: -22, y: 34, width: 44, height: 30, rx: 8, fill: '#f4f1ea' })]);
  S.layer(1).add(E.person(HIM({ x: 540, y: 1560, s: 1.35, action: 'idle', pose: { lean: 8, head: 10, ua1: 90, la1: 160, ua2: 70, la2: 150, th1: 10, sh1: 0, th2: -10, sh2: 0 } })));
  const gl = h('g', {}, [h('path', { d: 'M 300 1190 Q 310 1240 300 1270 M 360 1196 Q 370 1250 360 1280', stroke: '#f4f1ea', 'stroke-width': 4, fill: 'none' }), glove(300, 1300, '#c0182a'), glove(362, 1310, '#a01424')]); S.layer(1).g.appendChild(gl); S.key(gl, 'gants'); S.update(t => gl.setAttribute('transform', `rotate(${Math.sin(t * 2) * 3} 330 1190)`));
  S.layer(1.1).add(E.dust({ n: 60, color: '#ffffff', opacity: .35, seed: 171 }));
  S.update(t => { const k = ramp(t, mark(S, 1), .8); spots.forEach((w, i) => { const a0 = [-24, 0, 24][i], a = a0 * (1 - k) + (i === 1 ? 0 : (i === 0 ? -6 : 6)) * k; w.setAttribute('transform', `translate(${(200 + i * 340) * (1 - k) + 540 * k},0) rotate(${a})`); w.setAttribute('opacity', i === 1 ? 1 : 1 - k * .8); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'inOutSine', { shake: 1.5 });
});

/* s18 — J'me bats pour mes frères de sang : épaule contre épaule face à la ville */
CLIP.scene('s18', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a0a14', '#1a1430', '#4a2a3a']));
  cityNight(S, .2, 1460, '#120e1c', 181, '#ffb35c', .35, 3);
  S.layer(.6).add(h('rect', { x: -800, y: 1500, width: 2700, height: 600, fill: '#0a0810' }));
  const L = S.layer(1);
  L.add(E.person(BRO({ x: 180, y: 1520, s: 1.12, action: 'breathe', seed: 2, rim: '#ffb35c', key: 'frère 1' })));
  L.add(E.person(BRO({ x: 380, y: 1520, s: 1.18, action: 'breathe', seed: 4, rim: '#ffb35c', hat: 'beanie', key: 'frère 2' })));
  L.add(E.person(HIM({ x: 600, y: 1520, s: 1.25, action: 'breathe', rim: '#ffd28a' })));
  L.add(E.person(BRO({ x: 810, y: 1520, s: 1.14, action: 'breathe', seed: 6, rim: '#ffb35c', key: 'frère 3' })));
  S.layer(1.2).add(E.flare({ x: 900, y: 1150, color: '#ffb35c', opacity: .5, drift: 80 }));
  S.camera([[0, { x: 40, y: 0, zoom: 1.06 }], [1, { x: -40, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s19 — J'peux pas perdre de temps : course dans un tunnel de lumières, ombre d'aiguille */
CLIP.scene('s19', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0a0c14' }));
  const hand = h('rect', { x: -16, y: -900, width: 32, height: 900, fill: '#000', opacity: .35 }); S.layer(.1).g.appendChild(h('g', { transform: 'translate(540,1100)' }, [hand]));
  const T = S.layer(.5); const lamps = [...Array(14)].map(() => { const g = h('g', {}, [h('rect', { x: -60, y: -8, width: 120, height: 16, rx: 8, fill: '#ffe6b0', filter: 'url(#glow)' })]); T.g.appendChild(g); return g; });
  S.layer(1).add(E.person(HIM({ x: 520, y: 1520, s: 1.35, action: 'run', speed: 1.2 })));
  S.update(t => { hand.setAttribute('transform', `rotate(${t * 120})`); lamps.forEach((g, i) => { const z = Math.pow((((t * .9 + i / 14) % 1) + 1) % 1, 2); const side = i % 2 ? 1 : -1; g.setAttribute('transform', `translate(${540 + side * (40 + z * 600)},${700 + z * 300}) scale(${.2 + z * 1.6})`); g.setAttribute('opacity', Math.min(1, z * 4)); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'linear', { shake: 3, shakeFreq: 10 });
});

/* s20 — Les sentiments qui s'envolent : elle sur le pont au couchant */
CLIP.scene('s20', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#2a1a4a', '#c85a6a', '#ffb06a']));
  S.layer(.05).add(E.sun({ x: 540, y: 1180, r: 140, color: '#ffe0a0', glow: .8 }));
  S.layer(.2).add(E.sea({ y: 1300, color: '#3a2a4a', light: '#ffb08a', layers: 3, amp: 10 }));
  const L = S.layer(.8); L.add(h('rect', { x: -800, y: 1440, width: 2700, height: 40, fill: '#1a1020' })); for (let x = -40; x < 1120; x += 70) L.add(h('rect', { x, y: 1360, width: 10, height: 90, fill: '#1a1020' })); L.add(h('rect', { x: -800, y: 1350, width: 2700, height: 14, fill: '#1a1020' }));
  S.layer(1).add(E.person(HER({ x: 470, y: 1460, s: 1.3, action: 'idle', rim: '#ffd0a0' })));
  const hearts = [...Array(10)].map((_, i) => { const p = h('path', { d: heartD(0, 0, 22), fill: i % 2 ? '#f4ecd8' : '#ffb0c0' }); S.layer(1).g.appendChild(p); return p; });
  S.layer(1).add(E.birds({ n: 6, x: 300, y: 900, speed: 70, color: '#2a1a2a', size: 18 }));
  S.layer(1.1).add(E.lightLeak({ color: '#ffd08a', opacity: .22, speed: 60 }));
  S.update(t => hearts.forEach((p, i) => { const ph = (((t * .25 + i / 10) % 1) + 1) % 1; p.setAttribute('transform', `translate(${520 + Math.sin(ph * 7 + i) * 160 + ph * 140},${1060 - ph * 760}) rotate(${Math.sin(t * 2 + i) * 30}) scale(${1 - ph * .4})`); p.setAttribute('opacity', 1 - ph); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: 0, y: -40, zoom: 1.0 }]], 'inOutSine');
});
