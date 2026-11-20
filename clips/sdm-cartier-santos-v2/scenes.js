/* SDM — « Cartier Santos » (son TikTok, 60 s) — v2 : animation 2D cinéma nocturne, détaillée.
 * Règles de cadrage : personnages entre x≈130 et 900, pieds ≤ 1520 px, tête sous la zone de texte (≈ 760 px) ;
 * les sujets principaux sont marqués (data-key) et vérifiés automatiquement (render.mjs --framing).
 * Toutes les animations sont des fonctions pures de t.
 */
const C = { night: '#0b1226', night2: '#16203d', cite: '#1b2a4a', cite2: '#24365c', sodium: '#ffb35c', mag: '#ff4f9a', gold: '#e6c069',
  skinH: '#b9805e', skinF: '#e0a982', hood: '#1c2233', trench: '#d8b48a', wet: '#141b2e', white: '#f4f1ea', ink: '#07090f' };
const pm = (a, n) => ((a % n) + n) % n;
const HIM = o => Object.assign({ color: C.hood, shade: '#141927', hat: 'hood', hatColor: '#151a28', skin: C.skinH, shoe: '#e8e8e8', bodyWidth: 1.1 }, o);
const HER = o => Object.assign({ color: '#3a2a3a', shade: '#2a1e2a', coat: C.trench, hair: 'long', hairColor: '#3a2418', skin: C.skinF, shoe: '#2a1a1a', bodyWidth: .92 }, o);
const heartD = (cx, cy, r) => { const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`; return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`; };

// Rue de cité la nuit, en couches : ciel, tours lointaines floues, tours proches, sol mouillé avec reflets, réverbères, pluie
function street(S, o = {}) {
  const { E, h } = S;
  o = Object.assign({ sky: [C.night, C.night2, '#3a2c4f'], lamps: [150, 900], ground: 1500, rain: true, glow: C.sodium, seed: S.index + 1 }, o);
  S.layer(0).add(E.sky(o.sky));
  S.layer(.03).add(E.stars({ n: 50, seed: o.seed, area: [-200, -300, 1500, 900] }));
  S.layer(.12, { blur: 5 }).add(E.city({ y: o.ground - 140, color: '#26325a', seed: o.seed + 3, windows: '#ffd28a', lit: .35, minH: 400, maxH: 950, density: .7 }));
  S.layer(.35, { blur: 1.5 }).add(E.city({ y: o.ground - 20, color: '#141d36', seed: o.seed + 7, windows: o.glow, lit: .25, minH: 250, maxH: 650 }));
  const G = S.layer(.8);
  G.add(h('rect', { x: -800, y: o.ground, width: 2700, height: 900, fill: S.E.gradientDef([[0, '#232c48'], [1, C.wet]]) }));
  o.lamps.forEach(x => G.add(h('rect', { x: x - 40, y: o.ground + 4, width: 80, height: 420, fill: S.E.gradientDef([[0, o.glow, .45], [1, o.glow, 0]]), filter: 'url(#softblur)' })));
  o.lamps.forEach(x => S.layer(.8).add(E.lamp({ x, y: o.ground + 6, height: 760, color: '#0a0e1a', light: o.glow, cone: .3 })));
  if (o.rain) { S.layer(1).add(E.rain({ n: 150, angle: 9, color: '#c9d8ff', opacity: .28, seed: o.seed })); S.layer(.9).add(E.splashes({ y0: o.ground + 10, y1: 1900, seed: o.seed })); }
}
function bokehFront(S, colors) { S.layer(1.35, { blur: 7 }).add(S.E.bokeh({ n: 10, colors: colors || [C.sodium, C.mag, '#7fd6ff'], area: [-100, 1300, 1300, 700], opacity: .32, seed: S.index + 5 })); }
function room(S, wall = '#2a2238', floorY = 1420, floor = '#1e1828') {
  const { h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: wall }));
  S.layer(.05).add(h('rect', { x: -800, y: floorY, width: 2700, height: 1200, fill: floor }));
  const g = h('g', { opacity: .18 }); for (let x = -400; x < 1500; x += 140) g.appendChild(h('rect', { x, y: -800, width: 8, height: floorY + 800, fill: '#000' })); S.layer(.05).add(g);
}
// main stylisée (silhouette), orientée vers +x, origine au poignet
function handPath(h, fill, nails) {
  const g = h('g');
  g.appendChild(h('path', { d: 'M -120 -40 L 20 -46 Q 70 -60 120 -52 Q 140 -48 136 -36 Q 130 -28 100 -30 L 60 -28 Q 120 -24 150 -14 Q 162 -6 154 4 Q 146 10 120 6 L 70 2 Q 128 14 146 22 Q 154 32 144 40 Q 134 44 112 36 L 66 26 Q 108 42 118 50 Q 122 60 110 64 Q 96 64 60 50 Q 30 44 20 42 L -120 40 Z', fill }));
  if (nails) [[-52], [-12], [26], [56]].forEach(([y], i) => g.appendChild(h('ellipse', { cx: [134, 152, 142, 114][i], cy: [-44, -6, 32, 58][i], rx: 9, ry: 6, fill: nails })));
  return g;
}

/* s00 — La vie d'ma mère, bébé : à genoux sous la pluie */
CLIP.scene('s00', S => {
  const { E, h } = S; street(S, { lamps: [180, 880] });
  const L = S.layer(1);
  L.add(E.figure(HIM({ x: 400, y: 1500, s: 1.75, pose: 'kneel', action: 'breathe', anim: (a, t) => { a.ua1 = 72 + Math.sin(t * 1.5) * 3; a.la1 = 88; a.head = -22; } })));
  L.add(E.figure(HER({ x: 650, y: 1500, s: 1.8, pose: 'stand', action: 'idle', facing: -1, anim: (a, t) => { a.ua1 = 55; a.la1 = 75; a.head = 18 + Math.sin(t) * 4; } })));
  const glow = h('circle', { cx: 540, cy: 1080, r: 70, fill: C.sodium, opacity: .25, filter: 'url(#bigblur)' }); L.g.appendChild(glow);
  S.update(t => glow.setAttribute('opacity', .2 + .1 * Math.sin(t * 3)));
  bokehFront(S);
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -16, zoom: 1.07 }]], 'inOutSine');
});

/* s01 — j'peux être ton bébé : la voiture de nuit, lumières qui balaient */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#1f2a52', '#4a2f5c']));
  const far = E.city({ y: 1240, color: '#26325a', seed: 31, windows: '#ffd28a', lit: .35, maxH: 800, x0: -1400, x1: 3400 }); S.layer(.15, { blur: 4 }).add(far);
  const road = h('g'); road.appendChild(h('rect', { x: -2000, y: 1300, width: 6000, height: 900, fill: '#161c30' }));
  for (let i = -20; i < 60; i++) road.appendChild(h('rect', { x: i * 200, y: 1420, width: 110, height: 12, fill: '#e8d9a8', opacity: .7 }));
  const posts = h('g'); for (let i = -6; i < 20; i++) posts.appendChild(h('g', {}, [h('rect', { x: i * 520, y: 640, width: 14, height: 660, fill: '#0a0e1a' }), h('ellipse', { cx: i * 520 + 30, cy: 640, rx: 34, ry: 14, fill: C.sodium, filter: 'url(#glow)' })]));
  S.layer(.9).add(road); S.layer(.9).add(posts);
  const car = h('g');
  car.append(h('path', { d: 'M -330 40 Q -330 -40 -250 -60 L -140 -70 Q -80 -150 40 -158 Q 170 -156 230 -76 L 310 -60 Q 350 -40 345 40 Z', fill: '#2a2f45' }),
    h('path', { d: 'M -120 -72 Q -70 -138 40 -144 Q 150 -140 200 -76 Z', fill: '#0e1324' }),
    h('rect', { x: -10, y: -140, width: 10, height: 70, fill: '#2a2f45' }),
    h('path', { d: 'M -330 0 L 345 -4', stroke: '#5a6488', 'stroke-width': 4 }),
    h('ellipse', { cx: 335, cy: -22, rx: 18, ry: 9, fill: '#fff6d8', filter: 'url(#glow)' }), h('rect', { x: -336, y: -30, width: 14, height: 18, fill: '#ff6a5a' }));
  const heads = [[-60, '#151a28', C.skinH, false], [100, '#3a2418', C.skinF, true]].map(([x, hair, skin, long]) => { const g = h('g', { transform: `translate(${x},-98)` }, [h('circle', { r: 26, fill: skin }), h('path', { d: long ? 'M -28 -4 Q -30 -34 0 -32 Q 28 -32 26 -8 L 30 30 L -32 30 Z' : 'M -27 -2 Q -28 -32 2 -30 Q 26 -28 25 -8 Q 0 -18 -27 -2 Z', fill: hair })]); car.appendChild(g); return g; });
  const sweep = h('rect', { x: -130, y: -150, width: 60, height: 90, fill: '#fff2c8', opacity: .0 }); car.appendChild(sweep);
  const wheels = [-215, 225].map(x => { const w = h('g', {}, [h('circle', { r: 46, fill: '#05070d' }), h('circle', { r: 26, fill: '#3a4058' }), h('rect', { x: -4, y: -24, width: 8, height: 48, fill: '#05070d' })]); w.dataset.x = x; car.appendChild(w); return w; });
  const cg = h('g', { transform: 'translate(540,1250) scale(1.45)' }, [car]); S.layer(1).add(cg); S.key(cg, 'voiture');
  S.update(t => { const v = t * 850; road.setAttribute('transform', `translate(${-pm(v, 200)},0)`); posts.setAttribute('transform', `translate(${-pm(v, 520)},0)`); far.el.setAttribute('transform', `translate(${-v * .05},0)`);
    wheels.forEach(w => w.setAttribute('transform', `translate(${w.dataset.x},40) rotate(${v * 1.2})`)); car.setAttribute('transform', `translate(0,${Math.sin(t * 13) * 2})`);
    const sw = pm(v / 520, 1); sweep.setAttribute('x', 260 - sw * 520); sweep.setAttribute('opacity', Math.max(0, .35 - Math.abs(sw - .5) * .7));
    heads[1].setAttribute('transform', `translate(100,-98) rotate(${-8 + Math.sin(t * 2) * 6})`); heads[0].setAttribute('transform', `translate(-60,-98) rotate(${Math.sin(t * 1.3) * 3})`); });
  bokehFront(S);
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'linear');
});

/* s02 — Elle savait m'parler : sur le capot au-dessus de la ville */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#070b1c', '#1a2450', '#5a3a6a']));
  S.layer(.03).add(E.stars({ n: 120, seed: 41 }));
  S.layer(.1).add(E.moon({ x: 820, y: 860, r: 54, color: '#f4efe0', bg: '#2a2a5a' }));
  S.layer(.2, { blur: 4 }).add(E.city({ y: 1330, color: '#1d2850', seed: 42, windows: '#ffd28a', lit: .45, minH: 60, maxH: 260, density: 1.6 }));
  S.layer(.25, { blur: 3 }).add(E.fireflies({ n: 30, color: '#ffd28a', area: [0, 1150, 1080, 200], seed: 43 }));
  const L = S.layer(1);
  L.add(h('path', { d: 'M -200 1460 Q 300 1380 700 1420 Q 1000 1450 1300 1400 L 1300 2200 L -200 2200 Z', fill: '#0c1022' }));
  const car = h('g', {}, [h('path', { d: 'M 80 1420 Q 90 1330 200 1310 L 640 1300 Q 760 1300 820 1360 L 880 1420 Z', fill: '#262b40' }), h('ellipse', { cx: 860, cy: 1392, rx: 16, ry: 9, fill: '#fff6d8', filter: 'url(#glow)' })]);
  L.add(car); S.key(car, 'voiture', 'overlap');
  L.add(E.figure(HIM({ x: 380, y: 1440, s: 1.25, pose: 'sit', action: 'none', anim: (a, t) => { a.lean = -8 + Math.max(0, Math.sin(t * 7)) * 6 * (t > 1 ? 1 : 0); a.head = -10 + Math.sin(t * 7) * 4 * (t > 1 ? 1 : 0); a.ua1 = 20; a.la1 = 60; } })));
  L.add(E.figure(HER({ x: 600, y: 1440, s: 1.2, pose: 'sit', action: 'none', facing: -1, anim: (a, t) => { a.ua1 = 60 + Math.sin(t * 4) * 25; a.la1 = 120 + Math.sin(t * 5) * 20; a.head = 6 + Math.sin(t * 2) * 6; a.lean = 4; } })));
  S.camera([[0, { x: 40, y: 0, zoom: 1.05 }], [1, { x: -40, y: -10, zoom: 1.0 }]], 'inOutSine');
});

/* s03 — j'me mets à rêver : allongé sur le lit, nuages et lucioles */
CLIP.scene('s03', S => {
  const { E, h } = S; room(S, '#231d36', 1460, '#18142a');
  S.defs.appendChild(h('clipPath', { id: 'win03' }, [h('rect', { x: 560, y: 760, width: 380, height: 460 })]));
  const W_ = S.layer(.1, { 'clip-path': 'url(#win03)' }); W_.add(h('rect', { x: 560, y: 760, width: 380, height: 460, fill: '#0c1230' }));
  W_.add(E.clouds({ n: 4, y: 900, spread: 160, color: '#5a5aa8', opacity: .8, speed: 30, scale: .55 }));
  W_.add(E.moon({ x: 840, y: 840, r: 40, color: '#f4efe0', bg: '#0c1230' }));
  const frame = h('g', { fill: 'none', stroke: '#3a3050', 'stroke-width': 18 }, [h('rect', { x: 560, y: 760, width: 380, height: 460 }), h('line', { x1: 750, y1: 760, x2: 750, y2: 1220 })]); S.layer(.12).add(frame);
  const curtain = h('path', { fill: '#5a3a6a', opacity: .9 }); S.layer(.14).add(curtain);
  const L = S.layer(1);
  L.add(h('rect', { x: 80, y: 1300, width: 760, height: 120, rx: 18, fill: '#3a3456' })); L.add(h('rect', { x: 90, y: 1236, width: 230, height: 76, rx: 30, fill: '#e8e2f0' })); L.add(h('rect', { x: 80, y: 1420, width: 760, height: 90, fill: '#2a2440' }));
  const f = E.figure(HIM({ x: 0, y: 0, s: 1.35, pose: { lean: 0, head: -10, ua1: 160, la1: 175, ua2: 20, la2: 20, th1: 8, sh1: -10, th2: -6, sh2: -4 }, action: 'breathe', shadow: false }));
  const fg = h('g', { transform: 'translate(700,1290) rotate(-90)' }, [f.el]); L.g.appendChild(fg); S.items.push(f);
  L.add(E.fireflies({ n: 26, color: '#ffe6a8', area: [180, 760, 600, 500], seed: 44 }));
  S.update(t => { let d = 'M 560 760 L 640 760'; for (let y = 760; y <= 1220; y += 30) d += ` L ${640 + Math.sin(y / 60 + t * 1.6) * 14 - (y - 760) * .04} ${y}`; curtain.setAttribute('d', d + ' L 560 1220 Z'); });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s04 — Que j'prends sur moi : marche lente dans la brume */
CLIP.scene('s04', S => {
  const { E } = S; street(S, { lamps: [120, 620, 1120], sky: ['#0b1020', '#1d2440', '#3a3a58'], rain: false });
  S.layer(.6).add(E.fog({ y: 1250, height: 520, color: '#9aa6c8', opacity: .35, speed: 20 }));
  S.layer(1).add(E.figure(HIM({ s: 1.7, action: 'walk', speed: .5, pose: { lean: 14, head: 22 }, anim: a => { a.ua1 = 8; a.la1 = 30; a.ua2 = -4; a.la2 = 26; }, path: [[0, [260, 1500]], [2.4, [560, 1500]]] })));
  S.layer(1.1).add(E.fog({ y: 1480, height: 380, color: '#b8c2dc', opacity: .25, speed: 35 }));
  S.camera([[0, { x: 50, y: 0, zoom: 1.04 }], [1, { x: -40, y: 0, zoom: 1.04 }]], 'linear');
});

/* s05 — prendre des sous sur me : les billets passent d'une main à l'autre */
CLIP.scene('s05', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3a2a40'], [1, '#0a0810']], { cx: .5, cy: .6, r: .6 }));
  S.layer(.2).add(E.lightLeak({ color: C.sodium, opacity: .18, speed: 60 }));
  const L = S.layer(1);
  const hisHand = h('g', { transform: 'translate(250,1150) scale(1.6)' }, [handPath(h, C.skinH), h('rect', { x: -260, y: -48, width: 160, height: 96, fill: C.hood })]); L.g.appendChild(hisHand);
  const wallet = h('g', { transform: 'translate(350,1150) scale(1.5)' }, [h('rect', { x: -10, y: -70, width: 120, height: 140, rx: 10, fill: '#3a2418' }), h('rect', { x: -4, y: -64, width: 108, height: 6, fill: '#5a3a28' })]); L.g.appendChild(wallet);
  const herHand = h('g', {}, [h('g', { transform: 'scale(-1,1)' }, [handPath(h, C.skinF, '#c2185b'), h('rect', { x: -260, y: -48, width: 160, height: 96, fill: C.trench })])]); L.g.appendChild(herHand);
  S.key(hisHand, 'main', 'cut,ui'); S.key(herHand, 'main', 'cut,ui');
  const bills = [...Array(6)].map(() => { const b = h('g', {}, [h('rect', { x: -60, y: -30, width: 120, height: 60, rx: 5, fill: '#9fb98a' }), h('rect', { x: -52, y: -22, width: 104, height: 44, rx: 3, fill: 'none', stroke: '#5e7a4a', 'stroke-width': 3 }), h('ellipse', { rx: 14, ry: 18, fill: '#7a9a66' })]); L.g.appendChild(b); return b; });
  S.update(t => { herHand.setAttribute('transform', `translate(${860 - Math.min(1, t / .6) * 50},${1170 + Math.sin(t * 2) * 6}) scale(1.6)`);
    bills.forEach((b, i) => { const k = Math.min(1, Math.max(0, (t - .3 - i * .22) / .55)); const e = S.Ease.inOutCubic(k); const x = 400 + e * 300, y = 1130 - Math.sin(e * Math.PI) * 220 + i * 5; b.setAttribute('transform', `translate(${x},${y}) rotate(${-10 + e * 30 + i * 3}) scale(${1.4 + .15 * Math.sin(e * Math.PI)},${1.3 + .2 * Math.cos(t * 6 + i)})`); b.setAttribute('opacity', k > 0 ? 1 : 0); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s06 — Quand j'avais pas one sur moi : cage d'escalier, néon qui grésille */
CLIP.scene('s06', S => {
  const { E, h } = S; room(S, '#2a3038', 1500, '#1c2026');
  const st = h('g'); for (let i = 0; i < 7; i++) st.appendChild(h('rect', { x: 120 + i * 40, y: 1500 - i * 70, width: 900, height: 70, fill: i % 2 ? '#3a4048' : '#343a42' })); S.layer(.3).add(st);
  const tube = h('rect', { x: 340, y: 760, width: 400, height: 16, rx: 8, fill: '#d8f4ff' }), halo = h('rect', { x: 300, y: 720, width: 480, height: 100, fill: '#bfe8ff', opacity: .3, filter: 'url(#bigblur)' });
  S.layer(.2).add(halo); S.layer(.2).add(tube);
  const light = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#000', opacity: 0 });
  const L = S.layer(1);
  L.add(E.figure(HIM({ x: 520, y: 1430, s: 1.6, pose: 'sit', action: 'breathe', anim: (a, t) => { a.ua1 = 60; a.la1 = 100; a.ua2 = 50; a.la2 = 95; a.head = 30 + Math.sin(t * .8) * 4; a.lean = 18; } })));
  const wallet = h('g', { transform: 'translate(250,1420) rotate(-8) scale(1.9)' }, [h('rect', { x: -50, y: -18, width: 100, height: 36, rx: 6, fill: '#3a2418' }), h('rect', { x: -40, y: -26, width: 80, height: 10, rx: 3, fill: '#2a1a10' })]); L.g.appendChild(wallet); S.key(wallet, 'portefeuille');
  S.layer(1).add(light);
  S.update(t => { const fl = (S.noise(t * 9, 3) > .55 || (t % 1.7) < .08) ? .55 : 0; light.setAttribute('opacity', fl); tube.setAttribute('opacity', fl ? .3 : 1); halo.setAttribute('opacity', fl ? .05 : .3); });
  S.layer(1).add(E.dust({ color: '#d8f4ff', n: 40, area: [200, 760, 700, 700], seed: 61 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s07 — le huitième de tous ses mecs : boîte de nuit, faisceaux */
CLIP.scene('s07', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3a1440'], [1, '#07040c']], { cx: .5, cy: .55, r: .7 }));
  const beams = [0, 1, 2, 3].map(i => { const b = h('path', { d: 'M 0 0 L -90 1500 L 90 1500 Z', fill: [C.mag, '#7fd6ff', C.gold, C.mag][i], opacity: .16 }); const g = h('g', {}, [b]); S.layer(.1).add(g); return g; });
  S.layer(.3, { blur: 2 }).add(E.crowd({ n: 7, y: 1460, x0: 120, x1: 960, s: 1.05, color: '#140a1c', seed: 71, action: 'sway', depthRows: 1 }));
  S.layer(.3).add(E.fog({ y: 1250, height: 500, color: '#c88ae0', opacity: .18 }));
  S.layer(1).add(E.figure(HER({ x: 540, y: 1500, s: 1.75, pose: 'arms_up', action: 'dance', speed: .85 })));
  S.layer(1).add(E.fireflies({ n: 40, color: '#ffd6f0', area: [100, 700, 880, 800], seed: 72 }));
  const n8 = E.label('8', { x: 880, y: 1000, size: 150, color: C.mag, font: 'Montserrat', weight: 800, opacity: .85 }); n8.el.setAttribute('filter', 'url(#glow)'); S.layer(.25).add(n8);
  S.update(t => beams.forEach((g, i) => g.setAttribute('transform', `translate(${180 + i * 240},620) rotate(${Math.sin(t * 1.4 + i * 1.7) * 28})`)));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine', { shake: 2, shakeFreq: 5 });
});

/* s08 — foi et courage : sur le toit à l'aube */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#1a2050'], [.45, '#6a4a7a'], [.75, '#e88a6a'], [1, '#ffd08a']]));
  S.layer(.08).add(E.sun({ x: 760, y: 1300, r: 110, color: '#ffe0a0', glow: .7 }));
  S.layer(.18, { blur: 4 }).add(E.city({ y: 1420, color: '#4a3a5a', seed: 81, windows: '#ffd28a', lit: .15, maxH: 500 }));
  S.layer(.3).add(E.birds({ n: 6, x: 120, y: 980, speed: 60, color: '#2a2040', size: 18 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -200, y: 1500, width: 1500, height: 700, fill: '#241a30' })); L.add(h('rect', { x: -200, y: 1488, width: 1500, height: 16, fill: '#3a2c48' }));
  L.add(E.figure(HIM({ x: 420, y: 1500, s: 1.8, pose: 'lookup', action: 'breathe', facing: 1, anim: (a, t) => { a.head = -12 + Math.sin(t * .7) * 3; } })));
  S.layer(.9).add(E.lightLeak({ color: '#ffcf8a', opacity: .2, speed: 50 }));
  S.layer(1).add(E.dust({ color: '#ffe6b8', n: 40, drift: [30, -6], seed: 82 }));
  S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s09 — relation remplie de rage : dispute, lampe qui se balance, assiette brisée */
CLIP.scene('s09', S => {
  const { E, h } = S; room(S, '#3a2a28', 1500, '#241a18');
  const lampG = h('g'); lampG.append(h('line', { x1: 0, y1: -400, x2: 0, y2: 0, stroke: '#111', 'stroke-width': 4 }), h('path', { d: 'M -70 40 L 70 40 L 40 0 L -40 0 Z', fill: '#2a2220' }), h('ellipse', { cx: 0, cy: 44, rx: 30, ry: 10, fill: '#fff2c8', filter: 'url(#glow)' }));
  const cone = h('path', { fill: '#ffe2a0', opacity: .16 }); S.layer(.2).add(cone); S.layer(.2).add(h('g', { transform: 'translate(540,700)' }, [lampG]));
  S.layer(.25).add(h('rect', { x: 700, y: 1220, width: 320, height: 26, fill: '#5a4038' }));
  const L = S.layer(1);
  L.add(E.figure(HIM({ x: 330, y: 1500, s: 1.65, pose: 'point', action: 'tremble' })));
  L.add(E.figure(HER({ x: 760, y: 1500, s: 1.6, pose: 'point', action: 'tremble', facing: -1 })));
  const plate = h('g', {}, [h('ellipse', { rx: 44, ry: 12, fill: '#f0ece4' }), h('ellipse', { rx: 30, ry: 7, fill: '#d8d2c6' })]); L.g.appendChild(plate);
  const shards = [...Array(7)].map(() => { const p = h('path', { d: 'M -10 -4 L 12 -6 L 4 8 Z', fill: '#f0ece4' }); L.g.appendChild(p); return p; });
  S.update(t => { const a = Math.sin(t * 2.2) * 16; lampG.setAttribute('transform', `rotate(${a})`); const ex = 540 + Math.sin(a * Math.PI / 180) * 44; cone.setAttribute('d', `M ${ex - 30} 744 L ${ex - 400 + a * 8} 1520 L ${ex + 400 + a * 8} 1520 L ${ex + 30} 744 Z`);
    const k = Math.max(0, t - .6), y = Math.min(1500, 1210 + k * k * 1800); plate.setAttribute('transform', `translate(${800 - k * 60},${y}) rotate(${k * 300})`); plate.setAttribute('opacity', y >= 1500 ? 0 : 1);
    shards.forEach((p, i) => { const u = Math.max(0, k - .4); const a2 = i / 7 * Math.PI; p.setAttribute('transform', `translate(${770 - 60 + Math.cos(a2) * u * 300},${1500 - Math.sin(a2) * u * 260 + u * u * 500}) rotate(${u * 600 * (i % 2 ? 1 : -1)})`); p.setAttribute('opacity', u > 0 && u < 1 ? 1 : 0); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'linear', { shake: 3, shakeFreq: 6 });
});

/* s10 — que l'orage : éclairs sur les tours */
CLIP.scene('s10', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05070f', '#141a2c', '#2a3048']));
  S.layer(.08).add(E.clouds({ n: 6, y: 520, spread: 300, color: '#202638', opacity: 1, speed: 70, scale: 1.6 }));
  const bolts = [[380, .25], [700, 1.0]].map(([x, t0]) => { const b = h('path', { d: `M ${x} 520 L ${x - 50} 760 L ${x + 20} 770 L ${x - 60} 1080 L ${x + 30} 1090 L ${x - 40} 1300`, stroke: '#e8f2ff', 'stroke-width': 9, fill: 'none', filter: 'url(#glow)', opacity: 0 }); S.layer(.1).add(b); return [b, t0]; });
  const towers = E.city({ y: 1500, color: '#0d1222', seed: 101, windows: '#ffd28a', lit: .4, minH: 500, maxH: 900, density: .7 }); S.layer(.4).add(towers); S.key(towers, 'tours', 'cut');
  S.layer(1).add(E.rain({ n: 260, angle: 14, speed: 2600, color: '#c9d8ff', opacity: .45 }));
  const flash = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#dfe9ff', opacity: 0 }); S.layer(1).add(flash);
  S.update(t => { let f = 0; bolts.forEach(([b, t0]) => { const u = t - t0, on = u > 0 && u < .18; b.setAttribute('opacity', on ? 1 : 0); if (on) f = Math.max(f, 1 - u / .18); }); flash.setAttribute('opacity', f * .45); towers.el.setAttribute('opacity', t > 1.1 ? .55 : 1); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.1 }]], 'linear', { shake: 6, shakeFreq: 9 });
});

/* s11 — son blase en tatouage : avant-bras, le cœur se dessine */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3a3040'], [1, '#0c0a12']], { cx: .5, cy: .55, r: .65 }));
  S.layer(.1).add(h('ellipse', { cx: 540, cy: 1000, rx: 420, ry: 260, fill: '#ffe8c0', opacity: .12, filter: 'url(#bigblur)' }));
  const L = S.layer(1);
  const arm = h('path', { d: 'M 60 1360 Q 300 1260 560 1150 Q 760 1070 960 1060 L 980 1250 Q 760 1250 600 1310 Q 360 1420 80 1520 Z', fill: C.skinH }); L.g.appendChild(arm); S.key(arm, 'bras');
  L.g.appendChild(h('path', { d: 'M 120 1400 Q 380 1300 620 1210', stroke: '#a06a4a', 'stroke-width': 6, fill: 'none', opacity: .5 }));
  const tat = h('path', { d: heartD(560, 1225, 70), fill: 'none', stroke: '#1a1214', 'stroke-width': 9, 'stroke-linejoin': 'round' }); L.g.appendChild(tat);
  const machine = h('g', {}, [h('rect', { x: -22, y: -300, width: 44, height: 240, rx: 14, fill: '#3a3f52' }), h('rect', { x: -30, y: -200, width: 60, height: 70, rx: 10, fill: '#5a6078' }), h('rect', { x: -5, y: -60, width: 10, height: 60, fill: '#c8ccd8' })]); L.g.appendChild(machine);
  const mist = h('circle', { r: 30, fill: '#ffffff', opacity: .1, filter: 'url(#softblur)' }); L.g.appendChild(mist);
  let len = null;
  S.update(t => { if (!len) len = tat.getTotalLength(); const k = Math.min(1, Math.max(0, t / 1.4)); tat.setAttribute('stroke-dasharray', len); tat.setAttribute('stroke-dashoffset', len * (1 - k)); const p = tat.getPointAtLength(len * k); machine.setAttribute('transform', `translate(${p.x},${p.y + Math.sin(t * 70) * 2}) rotate(18)`); mist.setAttribute('cx', p.x); mist.setAttribute('cy', p.y); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s12 — se séparer d'son entourage : boulevard, sacs de luxe, potes qui partent */
CLIP.scene('s12', S => {
  const { E, h } = S; street(S, { lamps: [100, 980], rain: false, sky: ['#0b1020', '#1d2a50', '#3a3a6a'], glow: C.gold });
  const shops = h('g'); [[60, '#ffe2a0'], [420, '#ffd0e0'], [780, '#d8f0ff']].forEach(([x, c]) => shops.append(h('rect', { x, y: 1080, width: 300, height: 400, fill: c, opacity: .5 }), h('rect', { x: x + 20, y: 1100, width: 260, height: 360, fill: 'none', stroke: '#0a0e1a', 'stroke-width': 10 })));
  S.layer(.5).add(shops);
  for (let i = 0; i < 3; i++) S.layer(.6, { blur: 2.5 }).add(E.figure({ color: '#24345a', hat: 'cap', hatColor: '#1a2440', skin: '#9a6a4e', s: 1.0, action: 'walk', seed: 9, facing: -1, key: 'pote', keyAllow: 'cut,ui,overlap', path: [[0, [420 - i * 90, 1490]], [3.3, [120 - i * 90, 1490]]] }));
  S.layer(1).add(E.figure(HIM({ s: 1.6, action: 'walk', speed: .55, pose: { lean: -12 }, path: [[0, [420, 1510]], [3.3, [520, 1510]]] })));
  S.layer(1).add(E.figure(HER({ s: 1.6, action: 'walk', speed: .9, anim: a => { a.ua2 = -70; a.la2 = -80; }, path: [[0, [600, 1510]], [3.3, [720, 1510]]] })));
  const bags = h('g'); [[0, C.gold], [56, '#f0e6d8']].forEach(([dx, c]) => bags.appendChild(h('g', { transform: `translate(${dx},0)` }, [h('rect', { x: -30, y: 0, width: 60, height: 76, rx: 4, fill: c }), h('path', { d: 'M -16 0 Q 0 -32 16 0', stroke: '#2a1a10', 'stroke-width': 5, fill: 'none' })])));
  S.layer(1).g.appendChild(bags);
  S.update(t => bags.setAttribute('transform', `translate(${600 + 120 * Math.min(1, t / 3.3) + 70},${1300 + Math.sin(t * 6) * 6})`));
  bokehFront(S, [C.gold, '#ffffff', C.mag]);
  S.camera([[0, { x: 20, y: 0, zoom: 1.0 }], [1, { x: -30, y: 0, zoom: 1.04 }]], 'linear');
});

/* s13 — dans quel film on est : salle de cinéma */
CLIP.scene('s13', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0a0810' }));
  const scr = h('g'); S.layer(.3).add(scr); S.key(scr, 'écran');
  scr.append(h('rect', { x: 140, y: 780, width: 800, height: 450, fill: '#4a5a8a' }), h('rect', { x: 140, y: 780, width: 800, height: 450, fill: S.E.gradientDef([[0, '#8aa0d0'], [1, '#2a3058']]) }));
  const a = E.figure(HIM({ x: 440, y: 1210, s: .95, action: 'idle', key: false })), b = E.figure(HER({ x: 630, y: 1210, s: .92, action: 'sway', facing: -1, key: false }));
  scr.append(a.el, b.el); S.items.push(a, b);
  const beam = h('path', { d: 'M 560 -100 L 140 780 L 940 780 Z', fill: '#d8e8ff', opacity: .1 }); S.layer(.35).add(beam);
  S.layer(.36).add(E.dust({ color: '#ffffff', n: 60, area: [180, 0, 720, 780], drift: [4, 10], seed: 131 }));
  const F = S.layer(1);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) F.add(h('g', {}, [h('circle', { cx: 100 + i * 175 + r * 80, cy: 1380 + r * 90, r: 54, fill: r ? '#05040a' : '#0e0c16' }), h('rect', { x: 46 + i * 175 + r * 80, y: 1410 + r * 90, width: 108, height: 300, rx: 30, fill: r ? '#05040a' : '#0e0c16' })]));
  S.update(t => scr.setAttribute('opacity', .88 + .12 * Math.sin(t * 22) * Math.sin(t * 9)));
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s14 — attaché sans la connaître : poignets liés par un fil doré */
CLIP.scene('s14', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2a2040'], [1, '#07060c']], { cx: .5, cy: .6, r: .6 }));
  const L = S.layer(1);
  const left = h('g', { transform: 'translate(250,1180) rotate(-10)' }, [handPath(h, C.skinH), h('rect', { x: -260, y: -48, width: 160, height: 96, fill: C.hood })]);
  const right = h('g', { transform: 'translate(830,1210) rotate(190)' }, [handPath(h, C.skinF, '#c2185b'), h('rect', { x: -260, y: -48, width: 160, height: 96, fill: C.trench })]);
  L.g.append(left, right); S.key(left, 'main', 'cut,ui'); S.key(right, 'main', 'cut,ui');
  const thread = h('path', { fill: 'none', stroke: C.gold, 'stroke-width': 6, filter: 'url(#glow)' }); L.g.appendChild(thread);
  L.add(E.fireflies({ n: 30, color: C.gold, area: [200, 1050, 680, 300], seed: 141 }));
  S.update(t => { const sag = 70 + Math.sin(t * 2) * 25; thread.setAttribute('d', `M 200 1180 Q 540 ${1180 + sag * 2} 880 1210`); thread.setAttribute('stroke-width', 5 + Math.max(0, Math.sin(t * 5)) * 4); left.setAttribute('transform', `translate(${250 + Math.sin(t * 1.4) * 10},1180) rotate(-10)`); right.setAttribute('transform', `translate(${830 - Math.sin(t * 1.2) * 10},1210) rotate(190)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s15 — elle veut ci, elle veut ça : vitrine de luxe */
CLIP.scene('s15', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#141022' }));
  S.layer(.2).add(h('rect', { x: 100, y: 760, width: 880, height: 620, fill: '#2a2440' }));
  const items = [];
  [[440, 'watch'], [640, 'bag'], [835, 'shoe']].forEach(([x, kind], i) => {
    S.layer(.55).add(h('ellipse', { cx: x, cy: 990, rx: 120, ry: 250, fill: '#fff2c8', opacity: .14, filter: 'url(#softblur)' }));
    const g = h('g', { transform: `translate(${x},1200)` }, [h('rect', { x: -80, y: 0, width: 160, height: 180, fill: '#3a3456' })]);
    if (kind === 'watch') g.append(h('rect', { x: -20, y: -170, width: 40, height: 60, fill: C.gold }), h('rect', { x: -42, y: -112, width: 84, height: 84, rx: 16, fill: C.gold }), h('rect', { x: -30, y: -100, width: 60, height: 60, rx: 8, fill: '#f6f1e3' }), h('rect', { x: -20, y: -28, width: 40, height: 28, fill: C.gold }));
    if (kind === 'bag') g.append(h('path', { d: 'M -70 0 L -60 -110 L 60 -110 L 70 0 Z', fill: '#8a2a4a' }), h('path', { d: 'M -32 -110 Q 0 -170 32 -110', stroke: '#5a1a30', 'stroke-width': 8, fill: 'none' }));
    if (kind === 'shoe') g.append(h('path', { d: 'M -80 0 L -80 -30 Q -40 -40 0 -90 L 20 -90 Q 40 -40 80 -30 L 80 0 Z', fill: '#1a1a1a' }), h('rect', { x: 50, y: -40, width: 8, height: 40, fill: '#1a1a1a' }));
    g.setAttribute('transform', `translate(${x},1180) scale(1.1)`); S.layer(.6).add(g); S.key(g, kind); items.push(g);
  });
  S.layer(.62).add(h('rect', { x: 100, y: 760, width: 880, height: 620, fill: 'none', stroke: '#6a6080', 'stroke-width': 14 }));
  S.layer(.65).add(E.lightLeak({ color: '#ffffff', opacity: .12, speed: 90 }));
  S.layer(1).add(E.figure(HER({ x: 190, y: 1520, s: 1.35, pose: 'point', action: 'idle', key: 'elle' })));
  S.update(t => items.forEach((g, i) => g.setAttribute('opacity', Math.min(1, Math.max(.15, (t - i * .5) / .25)))));
  S.camera([[0, { x: 30, y: 0, zoom: 1.04 }], [1, { x: -20, y: 0, zoom: 1.0 }]], 'linear');
});

/* s16 — le bonheur : lever de soleil sur la banlieue */
CLIP.scene('s16', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#3a4a8a'], [.5, '#e88a7a'], [.8, '#ffc88a'], [1, '#fff0c0']]));
  S.layer(.06).add(E.sun({ x: 600, y: 1240, r: 150, color: '#fff0b8', glow: .9 }));
  S.layer(.1).add(E.rays({ x: 600, y: 1240, n: 18, color: '#fff6d8', opacity: .14, speed: 3 }));
  S.layer(.2, { blur: 3 }).add(E.city({ y: 1330, color: '#8a5a6a', seed: 161, windows: false, minH: 80, maxH: 380 }));
  S.layer(.4).add(E.hills({ y: 1430, color: '#5a3a4a', seed: 162, amp: 40 }));
  S.layer(.5).add(E.birds({ n: 7, x: 140, y: 1000, speed: 45, color: '#4a2a3a', size: 16 }));
  S.layer(1).add(E.figure(HIM({ x: 330, y: 1520, s: 1.5, pose: 'sit', action: 'breathe', color: '#2a1a28', hatColor: '#24162a', shade: '#1a1020', skin: '#3a2430', anim: a => { a.head = -14; } })));
  S.layer(1).add(E.dust({ color: '#fff0c8', n: 50, drift: [20, -8], seed: 163 }));
  S.layer(.95).add(E.lightLeak({ color: '#ffd08a', opacity: .2, speed: 40 }));
  S.camera([[0, { x: 0, y: 30, zoom: 1.08 }], [1, { x: 0, y: -20, zoom: 1.0 }]], 'outCubic');
});

/* s17 — pas dans la monnaie : pièces et billets emportés par le vent */
CLIP.scene('s17', S => {
  const { E, h } = S; street(S, { lamps: [200, 860], rain: false });
  const L = S.layer(1);
  const stuff = [...Array(18)].map((_, i) => { const g = i % 3 ? h('ellipse', { rx: 22, ry: 22, fill: C.gold, stroke: '#9c7a1f', 'stroke-width': 5 }) : h('rect', { x: -44, y: -22, width: 88, height: 44, rx: 4, fill: '#9fb98a' }); L.g.appendChild(g); return g; });
  const streaks = [...Array(8)].map(() => { const l = h('line', { stroke: '#ffffff', 'stroke-width': 3, opacity: .35, 'stroke-linecap': 'round' }); L.g.appendChild(l); return l; });
  S.update(t => { stuff.forEach((g, i) => { const ph = pm(t * .9 + i * .157, 1); const x = -80 + ph * 1240, y = 1460 - Math.sin(ph * Math.PI) * (160 + (i % 5) * 70) + (i % 4) * 14; g.setAttribute('transform', `translate(${x},${y}) rotate(${ph * 720 * (i % 2 ? 1 : -1)}) scale(1,${i % 3 ? Math.abs(Math.cos(t * 8 + i)) + .1 : 1})`); });
    streaks.forEach((l, i) => { const x = pm(t * 1400 + i * 260, 1500) - 200, y = 1150 + i * 45; S.set(l, { x1: x, y1: y, x2: x + 160, y2: y - 10 }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear', { shake: 3 });
});

/* s18 — J'l'élimine : le téléphone éclaire son visage */
CLIP.scene('s18', S => {
  const { E, h } = S; room(S, '#0e1220', 1500, '#0a0d18');
  const glow = h('ellipse', { cx: 600, cy: 1080, rx: 300, ry: 340, fill: '#7fb8ff', opacity: .16, filter: 'url(#bigblur)' }); S.layer(.3).add(glow);
  const L = S.layer(1);
  L.add(E.figure(HIM({ x: 420, y: 1500, s: 1.75, pose: 'stand', action: 'breathe', color: '#141a2a', anim: a => { a.ua1 = 40; a.la1 = 140; a.head = 22; } })));
  const ph = h('g', {}, [h('rect', { x: -44, y: -78, width: 88, height: 156, rx: 14, fill: '#05070d' }), h('rect', { x: -38, y: -70, width: 76, height: 140, rx: 8, fill: '#9fd0ff' })]);
  const card = h('g', {}, [h('rect', { x: -30, y: -30, width: 60, height: 56, rx: 6, fill: '#ffffff' }), h('circle', { cx: 0, cy: -10, r: 12, fill: '#c2185b' }), h('rect', { x: -20, y: 8, width: 40, height: 8, rx: 4, fill: '#9aa' })]);
  ph.appendChild(card); const pg = h('g', { transform: `translate(${420 + 1.75 * 120},${1500 - 1.75 * 300})` }, [ph]); L.g.appendChild(pg); S.key(pg, 'téléphone', 'overlap');
  S.update(t => { const k = Math.max(0, t - 1.2); card.setAttribute('transform', `translate(${-k * 160},0)`); card.setAttribute('opacity', Math.max(0, 1 - k * 3)); glow.setAttribute('opacity', .14 + .04 * Math.sin(t * 3)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});

/* s19 — j'l'assimile : profil derrière une vitre striée de pluie */
CLIP.scene('s19', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#1d2848']));
  S.layer(.1, { blur: 8 }).add(E.bokeh({ n: 22, colors: [C.sodium, C.mag, '#7fd6ff', '#ffffff'], area: [0, 600, 1080, 1000], size: [30, 80], opacity: .5, seed: 191 }));
  const L = S.layer(.6);
  const face = h('path', { d: 'M 1100 760 L 820 760 Q 650 780 625 950 Q 620 1030 585 1085 L 520 1180 Q 512 1200 545 1208 L 575 1212 Q 588 1236 572 1252 Q 562 1262 578 1270 L 598 1276 Q 588 1300 594 1322 Q 604 1352 650 1366 Q 712 1380 735 1430 L 760 1700 L 1100 1700 Z', fill: '#0e1220' });
  L.g.appendChild(face); S.key(face, 'visage', 'cut,ui');
  L.g.appendChild(h('path', { d: 'M 1100 720 Q 860 680 790 800 Q 840 760 1100 820 Z', fill: '#151a28' }));
  L.g.appendChild(h('path', { d: 'M 625 950 Q 600 1060 545 1110', stroke: '#7fb0ff', 'stroke-width': 5, fill: 'none', opacity: .55 }));
  const G = S.layer(1); G.add(h('rect', { x: -100, y: -100, width: 1300, height: 2200, fill: '#a8c4ff', opacity: .06 }));
  const drops = [...Array(26)].map((_, i) => { const d = h('path', { d: 'M 0 -10 Q 7 3 0 9 Q -7 3 0 -10 Z', fill: '#e8f0ff', opacity: .7 }); const tr = h('line', { stroke: '#e8f0ff', 'stroke-width': 2, opacity: .3 }); G.g.append(tr, d); return [d, tr, i]; });
  S.update(t => drops.forEach(([d, tr, i]) => { const x = (i * 131) % 1080, sp = .3 + (i % 5) * .12, ph = pm(t * sp + i * .37, 1), y = 300 + ph * 1500 + Math.sin(i) * 40; d.setAttribute('transform', `translate(${x + Math.sin(ph * 9 + i) * 6},${y})`); S.set(tr, { x1: x, y1: Math.max(300, y - 160), x2: x, y2: y - 10 }); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'inOutSine');
});

/* s20 — pas si vite : elle le rattrape par le bras */
CLIP.scene('s20', S => {
  const { E } = S; street(S, { lamps: [240, 940] });
  S.layer(1).add(E.figure(HIM({ s: 1.65, action: 'walk', speed: .9, path: [[0, [520, 1510]], [1.4, [660, 1510]]], anim: (a, t) => { a.ua2 = -60 - Math.min(1, t / .5) * 20; a.la2 = -70; } })));
  S.layer(1).add(E.figure(HER({ s: 1.6, action: 'walk', speed: 1.2, path: [[0, [250, 1510]], [1.4, [450, 1510]]], anim: a => { a.ua1 = 95; a.la1 = 92; a.lean = 10; } })));
  bokehFront(S);
  S.camera([[0, { x: -20, y: 0, zoom: 1.04 }], [1, { x: 30, y: 0, zoom: 1.02 }]], 'linear');
});

/* s21 — tu bouges pas, ton sang : gros plan de profil, regard intense */
CLIP.scene('s21', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#4a1a3a'], [1, '#08040a']], { cx: .35, cy: .55, r: .7 }));
  const L = S.layer(1);
  const g = h('g'); L.g.appendChild(g); S.key(g, 'visage', 'cut,ui');
  g.append(h('path', { d: 'M 1200 700 Q 860 600 700 760 Q 600 860 600 980 Q 598 1050 560 1110 L 500 1200 Q 492 1222 528 1230 L 556 1236 Q 568 1262 552 1276 Q 542 1286 560 1294 L 582 1300 Q 570 1326 578 1352 Q 590 1388 640 1404 Q 712 1420 740 1480 L 780 1760 L 1200 1760 Z', fill: C.skinF }),
    h('path', { d: 'M 556 1236 Q 572 1250 552 1262', stroke: '#6a1a3a', 'stroke-width': 12, fill: 'none', 'stroke-linecap': 'round' }),
    h('path', { d: 'M 1200 640 Q 820 540 660 760 Q 620 840 660 900 Q 760 760 900 760 Q 1000 820 1060 1100 L 1200 1300 Z', fill: '#3a2418' }));
  const eye = h('ellipse', { cx: 650, cy: 1010, rx: 26, ry: 12, fill: '#1a0e10' }); g.appendChild(eye);
  g.appendChild(h('path', { d: 'M 618 990 Q 650 975 684 992', stroke: '#1a0e10', 'stroke-width': 6, fill: 'none' }));
  const rim = h('path', { d: 'M 600 980 Q 598 1050 560 1110', stroke: C.mag, 'stroke-width': 7, fill: 'none', opacity: .7, filter: 'url(#glow)' }); g.appendChild(rim);
  S.update(t => { eye.setAttribute('ry', 12 * (1 - Math.max(0, Math.sin(t * 1.4)) * .5)); rim.setAttribute('opacity', .5 + .3 * Math.sin(t * 3)); });
  S.layer(1).add(E.dust({ color: '#ffb0d0', n: 30, seed: 211, opacity: .4 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: -20, y: 10, zoom: 1.07 }]], 'inOutSine');
});

/* s22 — j'ai pas assez bu : pleine lune, silhouette au vent, chauves-souris */
CLIP.scene('s22', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05030c', '#1a0b2e', '#3a1650']));
  S.layer(.03).add(E.stars({ n: 80, seed: 221 }));
  S.layer(.08).add(h('circle', { cx: 540, cy: 1060, r: 330, fill: '#f6f0d8' })); S.layer(.08).add(h('circle', { cx: 540, cy: 1060, r: 420, fill: '#f6f0d8', opacity: .15, filter: 'url(#bigblur)' }));
  S.layer(.3).add(E.city({ y: 1520, color: '#0a0612', seed: 222, windows: '#ff7ab0', lit: .1, minH: 120, maxH: 360 }));
  S.layer(1).add(E.figure(HER({ x: 540, y: 1430, s: 1.6, action: 'breathe', color: '#08040c', coat: '#08040c', hairColor: '#08040c', skin: '#08040c', shade: '#08040c', shoe: '#08040c', face: false, anim: (a, t) => { a.head = -8; } })));
  const BL = S.layer(.9); const bats = [...Array(7)].map(() => { const b = h('path', { fill: '#08040c' }); BL.g.appendChild(b); return b; });
  S.update(t => bats.forEach((b, i) => { const ph = pm(t * .3 + i / 7, 1), x = 80 + ph * 920, y = 820 + Math.sin(ph * 8 + i) * 120 + (i % 3) * 60, f = Math.sin(t * 15 + i) * 16; b.setAttribute('d', `M ${x - 36} ${y - f} Q ${x - 14} ${y - 8} ${x} ${y} Q ${x + 14} ${y - 8} ${x + 36} ${y - f} L ${x + 18} ${y + 8} L ${x} ${y + 3} L ${x - 18} ${y + 8} Z`); }));
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s23 — c'est fini : il s'éloigne dans la longue rue */
CLIP.scene('s23', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#1a2248', '#2a2a50']));
  S.layer(.2).add(E.road({ horizon: 1100, color: '#141a2c', line: '#e8d9a8', width: 1300, speed: 0 }));
  const lamps = h('g'); for (let i = 0; i < 6; i++) { const z = i / 6, y = 1100 + Math.pow(z + .15, 2) * 700, sc = .2 + z * 1.1; [-1, 1].forEach(s => lamps.appendChild(h('g', { transform: `translate(${540 + s * (40 + z * 560)},${y}) scale(${sc})` }, [h('rect', { x: -6, y: -600, width: 12, height: 600, fill: '#0a0e1a' }), h('ellipse', { cx: 0, cy: -600, rx: 40, ry: 18, fill: C.sodium, filter: 'url(#glow)' }), h('ellipse', { cx: 0, cy: 0, rx: 140, ry: 30, fill: C.sodium, opacity: .18 })]))); }
  S.layer(.3).add(lamps);
  const f = E.figure(HIM({ s: 1, action: 'walk', speed: .7, path: [[0, [540, 1500]]], key: 'personnage' })); const fg = h('g'); fg.appendChild(f.el); S.layer(1).g.appendChild(fg); S.items.push(f);
  S.update(t => { const k = Math.min(1, Math.max(0, t / 1.7)), y = 1500 - k * 260, sc = 1.6 - k * .9; fg.setAttribute('transform', `translate(540,${y}) scale(${sc}) translate(-540,-1500)`); });
  S.layer(.8).add(E.fog({ y: 1150, height: 300, color: '#9aa6c8', opacity: .2 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.05 }]], 'linear');
});

/* s24 — toute la semaine : quai de gare, trains qui passent */
CLIP.scene('s24', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#070b1c', '#1a2246']));
  const clock = E.clock({ x: 540, y: 860, r: 90, speed: 900, face: '#f4f1ea', rim: '#2a2a3a', hands: '#1a1a2a', numerals: false }); S.layer(.2).add(clock); S.key(clock, 'horloge');
  S.layer(.2).add(h('rect', { x: 532, y: 560, width: 16, height: 220, fill: '#2a2a3a' }));
  const train = h('g'); train.append(h('rect', { x: 0, y: 0, width: 2600, height: 300, fill: '#2a3048' }), ...[...Array(12)].map((_, i) => h('rect', { x: 60 + i * 210, y: 60, width: 150, height: 110, fill: '#ffe2a0', opacity: .9 })));
  const tg = h('g', { filter: 'url(#whipblur)' }); tg.appendChild(train); S.layer(.4).add(tg);
  S.layer(.6).add(h('rect', { x: -200, y: 1340, width: 1500, height: 900, fill: '#1c2234' })); S.layer(.6).add(h('rect', { x: -200, y: 1330, width: 1500, height: 18, fill: '#e8c060' }));
  const L = S.layer(1);
  L.add(h('g', {}, [h('rect', { x: 300, y: 1400, width: 480, height: 22, rx: 6, fill: '#3a4058' }), h('rect', { x: 330, y: 1420, width: 14, height: 100, fill: '#2a2f45' }), h('rect', { x: 736, y: 1420, width: 14, height: 100, fill: '#2a2f45' })]));
  L.add(E.figure(HIM({ x: 520, y: 1520, s: 1.35, pose: 'think', action: 'breathe' })));
  S.update(t => { const x = pm(t * 2600, 5200) - 2800; train.setAttribute('transform', `translate(${x},1040)`); });
  S.layer(1).add(E.dust({ color: '#ffe6b8', n: 30, seed: 241 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear');
});

/* s25 — est-ce que t'es sûr ? : le téléphone dans la main, la bulle arrive */
CLIP.scene('s25', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#1a2448'], [1, '#05070f']], { cx: .5, cy: .6, r: .7 }));
  S.layer(.1, { blur: 8 }).add(E.bokeh({ n: 16, colors: [C.mag, '#7fd6ff', C.sodium], area: [0, 700, 1080, 900], opacity: .4, seed: 251 }));
  const L = S.layer(1);
  const phone = h('g'); L.g.appendChild(phone); S.key(phone, 'téléphone');
  phone.append(h('rect', { x: 330, y: 780, width: 420, height: 760, rx: 50, fill: '#05070d' }), h('rect', { x: 350, y: 810, width: 380, height: 700, rx: 32, fill: '#121a30' }));
  const b0 = h('g', {}, [h('rect', { x: 520, y: 900, width: 190, height: 70, rx: 30, fill: '#2f6fed' })]);
  const b1 = h('g', {}, [h('rect', { x: 370, y: 1010, width: 250, height: 90, rx: 34, fill: '#3a2f45' }), h('rect', { x: 395, y: 1038, width: 160, height: 12, rx: 6, fill: '#ffffff', opacity: .7 }), h('rect', { x: 395, y: 1062, width: 110, height: 12, rx: 6, fill: '#ffffff', opacity: .5 })]);
  const dots = h('g', {}, [h('rect', { x: 370, y: 1130, width: 120, height: 60, rx: 28, fill: '#3a2f45' }), ...[0, 1, 2].map(i => h('circle', { cx: 400 + i * 30, cy: 1160, r: 8, fill: '#ffffff' }))]);
  phone.append(b0, b1, dots);
  phone.appendChild(h('g', { transform: 'translate(540,1640) rotate(-90)' }, [handPath(h, C.skinH)]));
  phone.appendChild(h('ellipse', { cx: 540, cy: 1150, rx: 300, ry: 420, fill: '#7fb8ff', opacity: .1, filter: 'url(#bigblur)' }));
  S.update(t => { const k = Math.min(1, Math.max(0, (t - .2) / .3)); b1.setAttribute('opacity', k); b1.setAttribute('transform', `translate(0,${(1 - k) * 30})`); [...dots.querySelectorAll('circle')].forEach((c, i) => c.setAttribute('cy', 1160 - Math.max(0, Math.sin(t * 9 - i)) * 9)); dots.setAttribute('opacity', t > .6 ? 1 : 0); phone.setAttribute('transform', `rotate(${Math.sin(t * 1.3) * 1.5} 540 1150)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.07 }]], 'inOutSine');
});
