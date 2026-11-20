/* SDM — « Cartier Santos » (son TikTok fourni, 60 s) — version PIXEL ART / jeu vidéo rétro
 * Le moteur pixellise tout le décor (fx.pixelate = 9 px, palette posterisée) : formes épaisses,
 * aplats francs. Lui = sprite cyan à capuche, elle = sprite magenta. Animations pures en t.
 */
const K = { night: '#1a1033', violet: '#3b2a6b', violet2: '#5a3f9a', cyan: '#29d3ff', cyanD: '#1580a8', mag: '#ff4fd8', magD: '#a12a8c',
  gold: '#ffd23f', goldD: '#c08a12', green: '#3ddc84', greenD: '#1e8a4f', beton: '#5c5470', white: '#f8f8f8', ink: '#0d0d0d', brick: '#7a4b3a', brickD: '#56322a' };
const pm = (a, n) => ((a % n) + n) % n;
const hero = (E, o) => E.figure(Object.assign({ color: K.cyan, shade: K.cyanD, hat: 'hood', hatColor: K.cyanD, outline: K.ink, outlineWidth: 7, bodyWidth: 1.15 }, o));
const girl = (E, o) => E.figure(Object.assign({ color: K.mag, shade: K.magD, hair: 'long', hairColor: K.magD, outline: K.ink, outlineWidth: 7, bodyWidth: 1.0 }, o));
const heartD = (cx, cy, r) => { const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`; return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`; };
function nightSky(S, stops) { S.layer(0).add(S.E.sky(stops || [K.night, K.violet, K.violet2])); S.layer(.05).add(S.E.stars({ n: 70, color: K.white, seed: S.index + 1 })); }
function ground(S, y = 1480, d = 1) { // sol en briques
  const { h } = S; const g = h('g'); g.appendChild(h('rect', { x: -1200, y, width: 3500, height: 1200, fill: K.brick }));
  for (let r = 0; r < 12; r++) for (let c = -12; c < 40; c++) g.appendChild(h('rect', { x: c * 108 + (r % 2) * 54, y: y + r * 54, width: 100, height: 46, fill: r ? K.brickD : '#9a6650', opacity: r ? .55 : 1 }));
  S.layer(d).add(g); return g;
}
function coin(h) { const g = h('g'); const e = h('ellipse', { rx: 34, ry: 34, fill: K.gold, stroke: K.goldD, 'stroke-width': 10 }); g.appendChild(e); return { g, spin: t => e.setAttribute('rx', Math.max(6, 34 * Math.abs(Math.cos(t * 5)))) }; }
// HUD : cœurs + compteur de pièces (fonctions de t)
function hud(S, hearts = () => 3, coins = () => 99) {
  const { h } = S; const g = h('g', { transform: 'translate(110,170)' });
  const hs = [0, 1, 2].map(i => { const p = h('path', { d: heartD(i * 75, 0, 30), fill: K.mag, stroke: K.ink, 'stroke-width': 7 }); g.appendChild(p); return p; });
  const c = h('ellipse', { cx: 560, cy: -2, rx: 26, ry: 26, fill: K.gold, stroke: K.ink, 'stroke-width': 7 }); g.appendChild(c);
  const txt = h('text', { x: 600, y: 18, 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 56, fill: K.white, stroke: K.ink, 'stroke-width': 3 }); g.appendChild(txt);
  S.layer(0).add(g);
  S.update(t => { const n = hearts(t); hs.forEach((p, i) => p.setAttribute('fill', i < n ? K.mag : '#3a3550')); txt.textContent = '× ' + String(Math.max(0, Math.round(coins(t)))).padStart(2, '0'); });
}

/* s00 — La vie d'ma mère, bébé : à genoux, cœurs */
CLIP.scene('s00', S => {
  const { E, h } = S; nightSky(S);
  S.layer(.3).add(E.city({ y: 1480, color: '#2a1d4f', seed: 3, windows: K.gold, lit: .3, minH: 300, maxH: 700, density: .8 }));
  ground(S); hud(S);
  const L = S.layer(1);
  L.add(E.lamp({ x: 860, y: 1480, height: 640, color: K.ink, light: K.gold, cone: .3 }));
  L.add(hero(E, { x: 380, y: 1480, s: 1.1, pose: 'kneel', action: 'breathe', anim: a => { a.ua1 = 60; a.la1 = 120; } }));
  L.add(girl(E, { x: 680, y: 1480, s: 1.1, pose: 'stand', action: 'idle', facing: -1 }));
  const hearts = [0, 1, 2, 3].map(() => { const p = h('path', { d: heartD(0, 0, 30), fill: K.mag, stroke: K.ink, 'stroke-width': 7 }); L.g.appendChild(p); return p; });
  S.update(t => hearts.forEach((p, i) => { const ph = pm(t * .6 + i / 4, 1); p.setAttribute('transform', `translate(${470 + Math.sin(ph * 7 + i) * 60 + ph * 120},${1080 - ph * 500})`); p.setAttribute('opacity', 1 - ph); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});

/* s01 — j'peux être ton bébé : voiture en défilement latéral */
CLIP.scene('s01', S => {
  const { E, h } = S; nightSky(S, [K.night, '#2b1d5a', '#6a3f9a']);
  S.layer(.08).add(E.moon({ x: 820, y: 420, r: 70, color: K.white, bg: '#21164a' }));
  const far = E.city({ y: 1300, color: '#2a1d4f', seed: 11, windows: K.cyan, lit: .2, maxH: 600, x0: -1400, x1: 3000 }); S.layer(.2).add(far);
  const road = h('g'); road.appendChild(h('rect', { x: -2000, y: 1340, width: 6000, height: 900, fill: '#2b2738' }));
  for (let i = -20; i < 60; i++) road.appendChild(h('rect', { x: i * 160, y: 1450, width: 90, height: 16, fill: K.gold }));
  const lamps = h('g'); for (let i = -6; i < 20; i++) lamps.appendChild(h('g', {}, [h('rect', { x: i * 420, y: 820, width: 18, height: 520, fill: K.ink }), h('rect', { x: i * 420 - 20, y: 800, width: 70, height: 26, fill: K.gold })]));
  S.layer(1).add(road); S.layer(1).add(lamps);
  const car = h('g', {}, [h('rect', { x: -230, y: -110, width: 460, height: 110, rx: 30, fill: K.cyan, stroke: K.ink, 'stroke-width': 9 }), h('path', { d: 'M -130 -110 L -80 -190 L 110 -190 L 160 -110 Z', fill: K.cyanD, stroke: K.ink, 'stroke-width': 9 }),
    h('rect', { x: -60, y: -175, width: 70, height: 55, fill: '#bff1ff' }), h('rect', { x: 30, y: -175, width: 70, height: 55, fill: '#bff1ff' }),
    h('circle', { cx: -50, cy: -150, r: 22, fill: K.cyanD }), h('circle', { cx: 65, cy: -150, r: 22, fill: K.magD }), h('rect', { x: 205, y: -90, width: 28, height: 24, fill: K.gold })]);
  const wheels = [-140, 140].map(x => { const w = h('g', {}, [h('circle', { r: 48, fill: K.ink }), h('rect', { x: -8, y: -36, width: 16, height: 72, fill: K.beton })]); w.dataset.x = x; car.appendChild(w); return w; });
  S.layer(1).add(h('g', { transform: 'translate(540,1430)' }, [car]));
  S.update(t => { const v = t * 900; road.setAttribute('transform', `translate(${-pm(v, 160)},0)`); lamps.setAttribute('transform', `translate(${-pm(v, 420)},0)`); far.el.setAttribute('transform', `translate(${-v * .08},0)`); wheels.forEach(w => w.setAttribute('transform', `translate(${w.dataset.x},0) rotate(${v})`)); car.setAttribute('transform', `translate(0,${Math.abs(Math.sin(t * 14)) * -6})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'linear');
});

/* s02 — Elle savait m'parler : bulles de dialogue */
CLIP.scene('s02', S => {
  const { E, h } = S; nightSky(S, [K.night, K.violet]);
  ground(S); hud(S);
  const L = S.layer(1);
  L.add(hero(E, { x: 330, y: 1480, s: 1.15, action: 'idle' }));
  L.add(girl(E, { x: 750, y: 1480, s: 1.1, action: 'sway', facing: -1 }));
  const bub = (x, y, c) => { const g = h('g', { transform: `translate(${x},${y})` }, [h('rect', { x: -130, y: -90, width: 260, height: 160, rx: 20, fill: K.white, stroke: K.ink, 'stroke-width': 10 }), h('path', { d: 'M -20 68 L 0 120 L 30 68 Z', fill: K.white, stroke: K.ink, 'stroke-width': 10 }), h('rect', { x: -22, y: 60, width: 50, height: 14, fill: K.white }), h('path', { d: heartD(0, -10, 40), fill: c })]); L.g.appendChild(g); return g; };
  const b1 = bub(380, 900, K.cyan), b2 = bub(720, 820, K.mag), b3 = bub(380, 900, K.mag);
  S.update(t => { const ph = Math.floor(t / .7) % 3; [b1, b2, b3].forEach((b, i) => b.setAttribute('opacity', i === ph ? 1 : 0)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s03 — j'me mets à rêver : banc, bulle de rêve */
CLIP.scene('s03', S => {
  const { E, h } = S; nightSky(S, ['#120a28', K.night, K.violet]);
  ground(S);
  const L = S.layer(1);
  L.add(h('g', {}, [h('rect', { x: 260, y: 1340, width: 420, height: 30, fill: K.brick, stroke: K.ink, 'stroke-width': 8 }), h('rect', { x: 290, y: 1370, width: 24, height: 110, fill: K.ink }), h('rect', { x: 630, y: 1370, width: 24, height: 110, fill: K.ink })]));
  const sl = hero(E, { x: 0, y: 0, s: 1.0, pose: { lean: 0, head: 0, ua1: 170, la1: 170, ua2: 160, la2: 170, th1: 5, sh1: 0, th2: -5, sh2: 0 }, action: 'breathe' });
  L.g.appendChild(h('g', { transform: 'translate(470,1330) rotate(-90) translate(0,0)' }, [sl.el])); S.items.push(sl);
  const dream = h('g'); L.g.appendChild(dream);
  [[620, 1220, 20], [680, 1140, 32]].forEach(([x, y, r]) => dream.appendChild(h('circle', { cx: x, cy: y, r, fill: K.white, stroke: K.ink, 'stroke-width': 7 })));
  dream.appendChild(h('ellipse', { cx: 620, cy: 820, rx: 340, ry: 250, fill: K.white, stroke: K.ink, 'stroke-width': 10 }));
  const castle = h('g', { fill: K.violet2, stroke: K.ink, 'stroke-width': 8 }, [h('rect', { x: 470, y: 760, width: 300, height: 170 }), h('rect', { x: 440, y: 690, width: 80, height: 240 }), h('rect', { x: 720, y: 690, width: 80, height: 240 }), h('path', { d: 'M 440 690 L 480 620 L 520 690 Z', fill: K.mag }), h('path', { d: 'M 720 690 L 760 620 L 800 690 Z', fill: K.mag }), h('rect', { x: 590, y: 840, width: 60, height: 90, fill: K.ink })]);
  dream.appendChild(castle);
  const big = h('path', { d: heartD(620, 640, 60), fill: K.mag, stroke: K.ink, 'stroke-width': 8 }); dream.appendChild(big);
  const zz = h('text', { 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 70, fill: K.white, stroke: K.ink, 'stroke-width': 4 }); zz.textContent = 'z'; L.g.appendChild(zz);
  S.update(t => { big.setAttribute('transform', `translate(0,${Math.sin(t * 3) * 14})`); dream.setAttribute('opacity', Math.min(1, t * 2)); const ph = pm(t * .8, 1); S.set(zz, { x: 400 + ph * 60, y: 1250 - ph * 120, opacity: 1 - ph }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -30, zoom: 1.06 }]], 'inOutSine');
});

/* s04 — Que j'prends sur moi : il porte une pile de caisses */
CLIP.scene('s04', S => {
  const { E, h } = S; nightSky(S);
  S.layer(.3).add(E.city({ y: 1480, color: '#2a1d4f', seed: 21, windows: K.gold, lit: .2, maxH: 600 }));
  ground(S); hud(S, () => 3, () => 99);
  const L = S.layer(1);
  const m = hero(E, { s: 1.1, action: 'walk', speed: .45, pose: { lean: 22, head: 10, ua1: 150, la1: 175, ua2: 150, la2: 175, th1: 0, sh1: 0, th2: 0, sh2: 0 }, anim: a => { a.ua1 = 160; a.la1 = 178; a.ua2 = 155; a.la2 = 178; a.lean = 22; }, path: [[0, [260, 1480]], [2.4, [560, 1480]]] });
  L.add(m);
  const crates = h('g'); [[0, 0], [10, -110], [-12, -220], [6, -330]].forEach(([dx, dy], i) => crates.appendChild(h('g', { transform: `translate(${dx},${dy})` }, [h('rect', { x: -70, y: -100, width: 140, height: 100, fill: '#b07a3a', stroke: K.ink, 'stroke-width': 9 }), h('path', { d: 'M -70 -100 L 70 0 M 70 -100 L -70 0', stroke: '#7a4f22', 'stroke-width': 8 })])));
  L.g.appendChild(crates);
  const sweat = h('path', { d: 'M 0 -14 Q 9 2 0 8 Q -9 2 0 -14 Z', fill: K.cyan }); L.g.appendChild(sweat);
  S.update(t => { const x = 260 + 300 * Math.min(1, t / 2.4); const wob = Math.sin(t * 3) * 4; crates.setAttribute('transform', `translate(${x + 40},${1480 - 1.1 * 420}) rotate(${wob})`); const ph = pm(t * 1.5, 1); sweat.setAttribute('transform', `translate(${x - 40},${1480 - 1.1 * 330 + ph * 60})`); sweat.setAttribute('opacity', 1 - ph); });
  S.camera([[0, { x: 40, y: 0, zoom: 1.05 }], [1, { x: -40, y: 0, zoom: 1.05 }]], 'linear', { shake: 3, shakeFreq: 4 });
});

/* s05 — prendre des sous sur me : les pièces passent de lui à elle */
CLIP.scene('s05', S => {
  const { E, h } = S; nightSky(S, [K.night, K.violet]);
  ground(S); hud(S, () => 3, t => 99 - Math.min(1, t / 2) * 60);
  const L = S.layer(1);
  L.add(hero(E, { x: 280, y: 1480, s: 1.1, pose: 'sad', action: 'breathe' }));
  L.add(girl(E, { x: 800, y: 1480, s: 1.1, pose: 'arms_up', action: 'dance', facing: -1 }));
  const coins = [...Array(10)].map(() => { const c = coin(h); L.g.appendChild(c.g); return c; });
  S.update(t => coins.forEach((c, i) => { const ph = pm(t * .9 + i / 10, 1); const x = 330 + ph * 430, y = 1150 - Math.sin(ph * Math.PI) * 380; c.g.setAttribute('transform', `translate(${x},${y})`); c.spin(t + i); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'inOutSine');
});

/* s06 — pas one sur moi : poches vides, compteur à zéro */
CLIP.scene('s06', S => {
  const { E, h } = S; nightSky(S, ['#0d0820', K.night]);
  ground(S); hud(S, () => 3, () => 0);
  const L = S.layer(1);
  L.add(hero(E, { x: 540, y: 1480, s: 1.5, pose: 'stand', action: 'none', anim: (a, t) => { a.ua1 = 30; a.la1 = 70; a.ua2 = -30; a.la2 = -70; a.head = 15 + Math.sin(t * 3) * 5; } }));
  [[-1, 400], [1, 680]].forEach(([s, x]) => L.add(h('path', { d: `M ${x - 40} 1180 L ${x + 40} 1180 L ${x + 30 * s} 1260 Z`, fill: K.white, stroke: K.ink, 'stroke-width': 8 })));
  const fly = h('g', {}, [h('circle', { r: 12, fill: K.ink }), h('ellipse', { cx: -10, cy: -14, rx: 12, ry: 8, fill: K.white }), h('ellipse', { cx: 10, cy: -14, rx: 12, ry: 8, fill: K.white })]); L.g.appendChild(fly);
  S.update(t => fly.setAttribute('transform', `translate(${540 + Math.sin(t * 2.3) * 220},${900 + Math.sin(t * 4.1) * 80})`));
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s07 — le huitième de tous ses mecs : la file des 8 */
CLIP.scene('s07', S => {
  const { E, h } = S; nightSky(S);
  ground(S, 1500);
  const L = S.layer(1);
  L.add(girl(E, { x: 120, y: 1500, s: .95, action: 'idle' }));
  for (let i = 0; i < 8; i++) {
    const me = i === 7, x = 260 + i * 100;
    L.add((me ? hero : (E2, o) => E2.figure(Object.assign({ color: '#8a85a8', shade: '#6a6588', hat: 'cap', hatColor: '#6a6588', outline: K.ink, outlineWidth: 6 }, o)))(E, { x, y: 1500, s: .78, action: 'idle', facing: -1, seed: i + 1 }));
    const tag = h('g', { transform: `translate(${x},${1500 - .78 * 430})` }, [h('rect', { x: -32, y: -38, width: 64, height: 60, fill: me ? K.gold : K.white, stroke: K.ink, 'stroke-width': 7 })]);
    const n = h('text', { x: 0, y: 12, 'text-anchor': 'middle', 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 44, fill: K.ink }); n.textContent = i + 1; tag.appendChild(n); L.g.appendChild(tag);
  }
  const arrow = h('path', { d: 'M -30 0 L 30 0 L 0 40 Z', fill: K.gold, stroke: K.ink, 'stroke-width': 6 }); L.g.appendChild(arrow);
  S.update(t => arrow.setAttribute('transform', `translate(960,${1500 - .78 * 430 - 110 + Math.abs(Math.sin(t * 5)) * -24})`));
  S.camera([[0, { x: -80, y: 0, zoom: 1.12 }], [1, { x: 60, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s08 — foi et courage : bouclier face au château */
CLIP.scene('s08', S => {
  const { E, h } = S; nightSky(S, ['#0d0820', '#2b1050', '#5a2a6a']);
  const L0 = S.layer(.4);
  L0.add(h('g', { fill: '#140c2a', stroke: K.ink, 'stroke-width': 8 }, [h('rect', { x: 330, y: 560, width: 420, height: 600 }), h('rect', { x: 260, y: 460, width: 130, height: 700 }), h('rect', { x: 690, y: 460, width: 130, height: 700 }), ...[0, 1, 2, 3].map(i => h('rect', { x: 260 + i * 40, y: 420, width: 26, height: 40 })), ...[0, 1, 2, 3].map(i => h('rect', { x: 690 + i * 40, y: 420, width: 26, height: 40 })), h('rect', { x: 500, y: 900, width: 80, height: 260, fill: '#3a2050' })]));
  L0.add(h('g', { fill: K.mag }, [h('rect', { x: 300, y: 600, width: 40, height: 50 }), h('rect', { x: 730, y: 600, width: 40, height: 50 })]));
  for (let i = 0; i < 6; i++) S.layer(.7).add(h('rect', { x: 340 - i * 50, y: 1160 + i * 60, width: 400 + i * 100, height: 60, fill: '#4a3a6a', stroke: K.ink, 'stroke-width': 7 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -500, y: 1520, width: 2100, height: 600, fill: '#2b2040' }));
  L.add(hero(E, { x: 470, y: 1530, s: 1.15, pose: 'stand', action: 'breathe', anim: a => { a.ua1 = 70; a.la1 = 80; a.lean = 6; } }));
  L.add(h('g', { transform: `translate(${470 + 1.15 * 120},${1530 - 1.15 * 270})` }, [h('path', { d: 'M -60 -70 L 60 -70 L 60 10 Q 0 90 -60 10 Z', fill: K.gold, stroke: K.ink, 'stroke-width': 9 }), h('path', { d: heartD(0, -20, 26), fill: K.mag })]));
  S.camera([[0, { x: 0, y: 60, zoom: 1.0 }], [1, { x: 0, y: -40, zoom: 1.1 }]], 'inOutSine');
});

/* s09 — relation remplie de rage : niveau orage, cœurs brisés */
CLIP.scene('s09', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#0a0614', '#1f1638', '#3a2f55']));
  S.layer(.1).add(E.clouds({ n: 6, y: 350, spread: 260, color: '#2b2440', opacity: 1, speed: 80, scale: 1.4 }));
  ground(S); hud(S, t => t < 1 ? 2 : 1, () => 12);
  const L = S.layer(1);
  L.add(hero(E, { x: 360, y: 1480, s: 1.05, pose: 'point', action: 'tremble' }));
  L.add(girl(E, { x: 720, y: 1480, s: 1.0, pose: 'point', action: 'tremble', facing: -1 }));
  const halves = [0, 1].map(i => { const p = h('path', { d: heartD(540, 900, 70), fill: K.mag, stroke: K.ink, 'stroke-width': 8 }); const id = 'hh' + S.index + i; S.defs.appendChild(h('clipPath', { id }, [h('rect', { x: i ? 540 : 300, y: 700, width: 240, height: 400 })])); const g = h('g', { 'clip-path': `url(#${id})` }, [p]); const w = h('g'); w.appendChild(g); L.g.appendChild(w); return w; });
  L.add(E.rain({ n: 160, angle: 14, speed: 2600, color: '#9fb7ff', opacity: .6, len: 50 }));
  S.update(t => { const k = Math.min(1, Math.max(0, (t - .4) / .8)); halves[0].setAttribute('transform', `translate(${-k * 70},${k * k * 120}) rotate(${-k * 20} 540 960)`); halves[1].setAttribute('transform', `translate(${k * 70},${k * k * 120}) rotate(${k * 20} 540 960)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear', { shake: 6, shakeFreq: 7 });
});

/* s10 — que l'orage : l'éclair frappe */
CLIP.scene('s10', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#05030c', '#140c26']));
  const L = S.layer(1);
  const cloud = h('g', { fill: '#3a3456', stroke: K.ink, 'stroke-width': 10 }, [[260, 620, 170], [480, 540, 220], [720, 610, 180], [560, 700, 200], [360, 720, 160]].map(([x, y, r]) => h('circle', { cx: x, cy: y, r })));
  L.g.appendChild(cloud);
  const bolt = h('path', { d: 'M 520 760 L 440 1050 L 540 1050 L 460 1420 L 700 980 L 590 980 L 660 760 Z', fill: K.gold, stroke: K.ink, 'stroke-width': 10 }); L.g.appendChild(bolt);
  L.add(h('rect', { x: -500, y: 1440, width: 2100, height: 700, fill: '#1e1834' }));
  const flash = h('rect', { x: -600, y: -600, width: 2300, height: 3200, fill: K.white, opacity: 0 }); L.g.appendChild(flash);
  S.update(t => { const on = (t > .25 && t < .55) || (t > 1.0 && t < 1.15); bolt.setAttribute('opacity', on ? 1 : 0); flash.setAttribute('opacity', on ? .35 : 0); cloud.setAttribute('transform', `translate(${Math.sin(t * 2) * 20},0)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.1 }]], 'linear', { shake: 8, shakeFreq: 10 });
});

/* s11 — son blase en tatouage : le tatouage se dessine pixel par pixel */
CLIP.scene('s11', S => {
  const { E, h } = S; S.layer(0).add(E.rect({ x: -800, y: -800, width: 2700, height: 3600, fill: '#2b1d4f' }));
  const L = S.layer(1);
  L.add(h('path', { d: 'M -100 1500 Q 300 1350 600 1050 Q 760 900 1000 820 L 1200 900 L 1200 1300 Q 900 1200 760 1350 Q 500 1600 -100 1800 Z', fill: '#c98a6a', stroke: K.ink, 'stroke-width': 12 }));
  const dots = []; const pts = []; for (let a = 0; a < Math.PI * 2; a += .2) { const x = 16 * Math.pow(Math.sin(a), 3), y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); pts.push([620 + x * 9, 1150 + y * 9]); }
  pts.forEach(([x, y]) => { const r = h('rect', { x: x - 10, y: y - 10, width: 20, height: 20, fill: K.ink }); L.g.appendChild(r); dots.push(r); });
  const needle = h('g', {}, [h('rect', { x: -14, y: -260, width: 28, height: 220, rx: 8, fill: K.beton, stroke: K.ink, 'stroke-width': 7 }), h('rect', { x: -4, y: -40, width: 8, height: 40, fill: K.white })]); L.g.appendChild(needle);
  S.update(t => { const n = Math.max(0, Math.floor(Math.min(1, t / 1.3) * dots.length)); dots.forEach((d, i) => d.setAttribute('opacity', i < n ? 1 : 0)); const p = pts[Math.min(pts.length - 1, n)]; needle.setAttribute('transform', `translate(${p[0]},${p[1] + Math.sin(t * 60) * 4}) rotate(20)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.1 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s12 — se séparer d'son entourage : les potes partent, elle le tire */
CLIP.scene('s12', S => {
  const { E, h } = S; nightSky(S);
  S.layer(.3).add(E.city({ y: 1480, color: '#2a1d4f', seed: 31, windows: K.gold, lit: .25, maxH: 600 }));
  ground(S); hud(S, () => 1, () => 5);
  const L = S.layer(1);
  for (let i = 0; i < 3; i++) L.add(E.figure({ color: K.green, shade: K.greenD, hat: 'cap', hatColor: K.greenD, outline: K.ink, outlineWidth: 6, s: .9, action: 'walk', seed: 9, facing: -1, path: [[0, [330 - i * 110, 1480]], [3.3, [-200 - i * 110, 1480]]] }));
  L.add(hero(E, { s: 1.0, action: 'walk', speed: .6, pose: { lean: -14 }, path: [[0, [560, 1480]], [3.3, [650, 1480]]] }));
  L.add(girl(E, { s: 1.0, action: 'walk', speed: 1, path: [[0, [740, 1480]], [3.3, [860, 1480]]] }));
  const bags = h('g'); [[0, K.gold], [70, K.cyan]].forEach(([dx, c]) => bags.appendChild(h('g', { transform: `translate(${dx},0)` }, [h('rect', { x: -30, y: 0, width: 60, height: 70, fill: c, stroke: K.ink, 'stroke-width': 7 }), h('path', { d: 'M -16 0 Q 0 -30 16 0', stroke: K.ink, 'stroke-width': 7, fill: 'none' })]))); L.g.appendChild(bags);
  S.update(t => bags.setAttribute('transform', `translate(${740 + 120 * t / 3.3 + 70},${1300})`));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: -30, y: 0, zoom: 1.04 }]], 'linear');
});

/* s13 — dans quel film on est : cinéma rétro */
CLIP.scene('s13', S => {
  const { E, h } = S; S.layer(0).add(E.rect({ x: -800, y: -800, width: 2700, height: 3600, fill: '#10091f' }));
  const L = S.layer(.6);
  L.add(h('rect', { x: 120, y: 620, width: 840, height: 560, fill: '#3b2a6b', stroke: K.gold, 'stroke-width': 14 }));
  const scr = h('g'); L.g.appendChild(scr);
  scr.appendChild(h('rect', { x: 134, y: 634, width: 812, height: 532, fill: '#6a5fb0' }));
  const a = hero({ figure: S.E.figure }, { x: 440, y: 1150, s: .9, action: 'sway', outline: K.ink }), b = girl({ figure: S.E.figure }, { x: 640, y: 1150, s: .85, action: 'sway', facing: -1 });
  scr.append(a.el, b.el); S.items.push(a, b);
  scr.appendChild(h('path', { d: heartD(540, 760, 50), fill: K.mag, stroke: K.ink, 'stroke-width': 7 }));
  const F = S.layer(1);
  F.add(h('rect', { x: -400, y: 1400, width: 1900, height: 800, fill: '#1a1033' }));
  for (let i = 0; i < 7; i++) F.add(h('g', {}, [h('circle', { cx: 80 + i * 150, cy: 1430, r: 62, fill: K.ink }), h('rect', { x: 20 + i * 150, y: 1460, width: 120, height: 200, rx: 30, fill: K.ink })]));
  const beam = h('path', { d: 'M 540 -100 L 140 640 L 940 640 Z', fill: '#bff1ff', opacity: .12 }); S.layer(.7).add(beam);
  S.update(t => { scr.setAttribute('opacity', .85 + .15 * Math.sin(t * 25)); });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s14 — attaché sans la connaître : chaîne et cadenas cœur */
CLIP.scene('s14', S => {
  const { E, h } = S; nightSky(S, [K.night, '#2b1050']);
  ground(S); hud(S, () => 1, () => 3);
  const L = S.layer(1);
  L.add(hero(E, { x: 300, y: 1480, s: 1.15, pose: 'sad', action: 'tremble' }));
  L.add(girl(E, { x: 800, y: 1480, s: 1.1, action: 'idle', facing: -1 }));
  const links = [...Array(9)].map(() => { const e = h('ellipse', { rx: 34, ry: 20, fill: 'none', stroke: '#b9b4cf', 'stroke-width': 12 }); L.g.appendChild(e); return e; });
  const lock = h('g', {}, [h('path', { d: 'M -26 -40 Q 0 -90 26 -40', stroke: '#b9b4cf', 'stroke-width': 12, fill: 'none' }), h('path', { d: heartD(0, 0, 50), fill: K.gold, stroke: K.ink, 'stroke-width': 8 }), h('rect', { x: -6, y: -10, width: 12, height: 24, fill: K.ink })]); L.g.appendChild(lock);
  S.update(t => { const sag = 90 + Math.sin(t * 2) * 15; links.forEach((e, i) => { const u = (i + .5) / links.length; const x = 380 + u * 340, y = 1180 + Math.sin(u * Math.PI) * sag; e.setAttribute('transform', `translate(${x},${y}) rotate(${i % 2 ? 90 : 0})`); }); lock.setAttribute('transform', `translate(550,${1180 + sag + 40}) rotate(${Math.sin(t * 3) * 8})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});

/* s15 — elle veut ci, elle veut ça : la vitrine */
CLIP.scene('s15', S => {
  const { E, h } = S; S.layer(0).add(E.rect({ x: -800, y: -800, width: 2700, height: 3600, fill: '#2b1d4f' }));
  const L = S.layer(1);
  L.add(h('rect', { x: 80, y: 560, width: 920, height: 900, fill: '#bff1ff', stroke: K.ink, 'stroke-width': 14 }));
  L.add(h('rect', { x: 80, y: 1300, width: 920, height: 40, fill: K.beton }));
  const item = (x, y, body, price) => { const g = h('g', { transform: `translate(${x},${y})` }, [...body, h('rect', { x: 30, y: -150, width: 110, height: 56, fill: K.white, stroke: K.ink, 'stroke-width': 6 })]); const p = h('text', { x: 85, y: -110, 'text-anchor': 'middle', 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 34, fill: K.ink }); p.textContent = price; g.appendChild(p); L.g.appendChild(g); return g; };
  const its = [item(250, 1150, [h('rect', { x: -80, y: -110, width: 160, height: 120, fill: K.mag, stroke: K.ink, 'stroke-width': 8 }), h('path', { d: 'M -40 -110 Q 0 -180 40 -110', stroke: K.ink, 'stroke-width': 8, fill: 'none' })], '999'),
    item(540, 1230, [h('path', { d: 'M -90 0 L -90 -60 L 0 -60 L 40 -20 L 90 -20 L 90 0 Z', fill: K.gold, stroke: K.ink, 'stroke-width': 8 })], '650'),
    item(820, 1150, [h('rect', { x: -60, y: -60, width: 120, height: 120, rx: 18, fill: K.gold, stroke: K.ink, 'stroke-width': 8 }), h('rect', { x: -38, y: -38, width: 76, height: 76, fill: K.white }), h('rect', { x: -26, y: -150, width: 52, height: 90, fill: K.goldD }), h('rect', { x: -26, y: 60, width: 52, height: 90, fill: K.goldD })], '9999')];
  const hand = h('path', { d: 'M 0 0 L 120 -40 L 130 -20 L 30 20 Z', fill: K.mag, stroke: K.ink, 'stroke-width': 7 }); L.g.appendChild(hand);
  S.update(t => { its.forEach((g, i) => { const k = Math.min(1, Math.max(0, (t - i * .55) / .2)); g.setAttribute('opacity', k); }); const target = Math.max(0, Math.min(2, Math.floor(t / .55))); hand.setAttribute('transform', `translate(${[150, 440, 720][target]},${1420})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'linear');
});

/* s16 — on m'a juré qu'le bonheur : lever de soleil, coffre aux cœurs */
CLIP.scene('s16', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#ff9fd8', '#ffd28a', '#ffe9a8']));
  S.layer(.1).add(E.sun({ x: 540, y: 1150, r: 200, color: K.gold, glow: .4 }));
  S.layer(.3).add(E.hills({ y: 1250, color: K.green, seed: 4, amp: 60 })); S.layer(.5).add(E.hills({ y: 1380, color: K.greenD, seed: 7, amp: 40 }));
  const L = S.layer(1);
  L.add(h('rect', { x: 400, y: 1240, width: 280, height: 160, fill: '#b07a3a', stroke: K.ink, 'stroke-width': 10 }));
  const lid = h('g', {}, [h('path', { d: 'M 0 0 L 280 0 L 280 -60 Q 140 -130 0 -60 Z', fill: '#c98a4a', stroke: K.ink, 'stroke-width': 10 })]); L.g.appendChild(lid);
  const hs = [0, 1, 2, 3, 4].map(i => { const p = h('path', { d: heartD(0, 0, 34), fill: K.mag, stroke: K.ink, 'stroke-width': 7 }); L.g.appendChild(p); return p; });
  S.update(t => { const o = Math.min(1, t / .6); lid.setAttribute('transform', `translate(400,1240) rotate(${-o * 60})`); hs.forEach((p, i) => { const ph = pm(t * .8 + i / 5, 1); p.setAttribute('transform', `translate(${540 + Math.sin(i * 2 + ph * 4) * 120},${1220 - ph * 500})`); p.setAttribute('opacity', o * (1 - ph)); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s17 — pas dans la monnaie : la montagne de pièces s'effondre */
CLIP.scene('s17', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#0d0820', '#1a1033']));
  const L = S.layer(1);
  L.add(h('ellipse', { cx: 540, cy: 1450, rx: 300, ry: 70, fill: K.ink }));
  const cs = [...Array(28)].map((_, i) => { const c = h('ellipse', { rx: 40, ry: 16, fill: i % 2 ? K.gold : '#ffe066', stroke: K.ink, 'stroke-width': 7 }); L.g.appendChild(c); return [c, i]; });
  S.update(t => cs.forEach(([c, i]) => { const row = Math.floor(i / 4), col = i % 4; const x0 = 420 + col * 80 + (row % 2) * 40, y0 = 1380 - row * 28; const fall = Math.max(0, t - .35 - (7 - row) * .04); const x = x0 + (col - 1.5) * fall * 60, y = y0 + fall * fall * 500; c.setAttribute('transform', `translate(${x},${Math.min(y, 1500)})`); c.setAttribute('opacity', y > 1440 ? 0 : 1); }));
  S.camera([[0, { x: 0, y: -60, zoom: 1.1 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inCubic', { shake: 4 });
});

/* s18 — J'l'élimine : elle clignote et disparaît */
CLIP.scene('s18', S => {
  const { E, h } = S; nightSky(S, ['#0d0820', K.violet]);
  ground(S); hud(S, () => 2, () => 5);
  const L = S.layer(1);
  L.add(hero(E, { x: 320, y: 1480, s: 1.15, pose: 'point', action: 'idle' }));
  const g = girl(E, { x: 0, y: 0, s: 1.15, action: 'idle', facing: -1 }); const gg = h('g', { transform: 'translate(760,1480)' }); gg.appendChild(g.el); L.g.appendChild(gg); S.items.push(g);
  g.el.parentNode.removeChild(g.el); const holder = h('g'); holder.appendChild(g.el); gg.appendChild(holder);
  const parts = [...Array(24)].map((_, i) => { const r = h('rect', { width: 22, height: 22, fill: i % 2 ? K.mag : K.white }); L.g.appendChild(r); return r; });
  S.update(t => { g.update(t); g.el.setAttribute('transform', g.el.getAttribute('transform')); const blink = t > .5 && t < 1.8 ? (Math.floor(t * 12) % 2) : 0; holder.setAttribute('opacity', t >= 1.8 ? 0 : blink ? .15 : 1); const k = Math.max(0, t - 1.8); parts.forEach((r, i) => { const a = i / 24 * Math.PI * 2; S.set(r, { x: 760 + Math.cos(a) * k * 400, y: 1250 + Math.sin(a) * k * 400 + k * k * 300, opacity: t < 1.8 ? 0 : Math.max(0, 1 - k) }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'inOutSine');
});

/* s19 — j'l'assimile : blocs qui tombent, ligne qui s'efface */
CLIP.scene('s19', S => {
  const { E, h } = S; S.layer(0).add(E.rect({ x: -800, y: -800, width: 2700, height: 3600, fill: '#140c26' }));
  const L = S.layer(1); const C = 110, X0 = 210, Y0 = 1460;
  L.add(h('rect', { x: X0 - 20, y: 600, width: C * 6 + 40, height: Y0 - 600 + 20, fill: 'none', stroke: K.violet2, 'stroke-width': 14 }));
  const fixed = [[0, 0, K.cyan], [1, 0, K.cyan], [2, 0, K.mag], [4, 0, K.gold], [5, 0, K.green], [0, 1, K.green], [5, 1, K.mag], [4, 1, K.gold]];
  const cells = fixed.map(([c, r, col]) => { const e = h('rect', { x: X0 + c * C, y: Y0 - (r + 1) * C, width: C - 8, height: C - 8, fill: col, stroke: K.ink, 'stroke-width': 7 }); L.g.appendChild(e); return [e, r]; });
  const piece = h('g', {}, [h('rect', { x: 0, y: 0, width: C - 8, height: C - 8, fill: K.mag, stroke: K.ink, 'stroke-width': 7 }), h('rect', { x: 0, y: -C, width: C - 8, height: C - 8, fill: K.mag, stroke: K.ink, 'stroke-width': 7 })]); L.g.appendChild(piece);
  const flash = h('rect', { x: X0, y: Y0 - C, width: C * 6, height: C, fill: K.white, opacity: 0 }); L.g.appendChild(flash);
  S.update(t => { const k = Math.min(1, t / 1.1); const y = 620 + Math.floor(k * 8) / 8 * (Y0 - C - 620); piece.setAttribute('transform', `translate(${X0 + 3 * C},${y})`); const clear = t > 1.2; flash.setAttribute('opacity', clear && t < 1.5 ? (Math.floor(t * 16) % 2) : 0); cells.forEach(([e, r]) => e.setAttribute('opacity', clear && r === 0 && t > 1.5 ? 0 : 1)); if (t > 1.5) piece.setAttribute('transform', `translate(${X0 + 3 * C},${Y0 - C + C})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.04 }]], 'linear');
});

/* s20 — pas si vite : course et capuche attrapée */
CLIP.scene('s20', S => {
  const { E, h } = S; nightSky(S);
  const city = E.city({ y: 1480, color: '#2a1d4f', seed: 41, windows: K.gold, lit: .25, maxH: 600, x0: -1500, x1: 3500 }); S.layer(.3).add(city);
  const gr = ground(S);
  const L = S.layer(1);
  const lines = [...Array(8)].map((_, i) => { const l = h('rect', { width: 160, height: 12, fill: K.white, opacity: .8 }); L.g.appendChild(l); return l; });
  L.add(hero(E, { x: 600, y: 1480, s: 1.1, action: 'run', speed: 1.3 }));
  L.add(girl(E, { x: 400, y: 1480, s: 1.05, action: 'run', speed: 1.3, anim: a => { a.ua1 = 100; a.la1 = 95; } }));
  S.update(t => { city.el.setAttribute('transform', `translate(${-t * 300},0)`); gr.setAttribute('transform', `translate(${-pm(t * 1100, 216)},0)`); lines.forEach((l, i) => { S.set(l, { x: pm(900 - t * 1600 + i * 290, 1300) - 150, y: 1100 + (i % 4) * 70 }); }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear', { shake: 3, shakeFreq: 12 });
});

/* s21 — tu bouges pas : tout est en pause */
CLIP.scene('s21', S => {
  const { E, h } = S; nightSky(S, ['#1a1033', '#3b2a6b']);
  ground(S); hud(S, () => 2, () => 5);
  const L = S.layer(1);
  L.add(hero(E, { x: 380, y: 1480, s: 1.15, action: 'none', pose: { lean: 14, head: 0, ua1: 50, la1: 70, ua2: -50, la2: -30, th1: 35, sh1: -20, th2: -30, sh2: -40 } }));
  L.add(girl(E, { x: 760, y: 1480, s: 1.1, action: 'none', pose: 'point', facing: -1 }));
  const fl = h('g', { fill: K.white }); for (let i = 0; i < 40; i++) fl.appendChild(h('rect', { x: (i * 271) % 1080, y: 500 + (i * 137) % 900, width: 12, height: 12 })); L.g.appendChild(fl);
  const pause = h('g', { opacity: .9 }, [h('rect', { x: -120, y: -150, width: 80, height: 300, fill: K.white, stroke: K.ink, 'stroke-width': 10 }), h('rect', { x: 40, y: -150, width: 80, height: 300, fill: K.white, stroke: K.ink, 'stroke-width': 10 })]); L.g.appendChild(pause);
  const dim = h('rect', { x: -600, y: -600, width: 2300, height: 3200, fill: K.ink, opacity: .25 }); L.g.insertBefore(dim, pause);
  S.update(t => pause.setAttribute('transform', `translate(540,1000) scale(${1 + Math.max(0, .3 - t) * 2})`));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear');
});

/* s22 — ton sang, j'ai pas assez bu : silhouette ailée sous la lune */
CLIP.scene('s22', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#05030c', '#1a0b2e', '#3a1650']));
  S.layer(.05).add(E.stars({ n: 60, color: K.white, seed: 222 }));
  S.layer(.1).add(h('circle', { cx: 540, cy: 900, r: 330, fill: '#f6f0d8' }));
  const L = S.layer(1);
  const wings = [-1, 1].map(s => { const w = h('path', { d: `M 0 0 Q ${s * 180} -160 ${s * 380} -60 Q ${s * 300} -10 ${s * 320} 60 Q ${s * 230} 20 ${s * 200} 90 Q ${s * 130} 40 0 60 Z`, fill: K.ink }); L.g.appendChild(w); return [w, s]; });
  L.add(girl(E, { x: 540, y: 1300, s: 1.25, action: 'breathe', color: K.ink, shade: K.ink, hairColor: K.ink, outline: K.magD }));
  const bats = [...Array(6)].map(() => { const b = h('path', { fill: K.ink }); L.g.appendChild(b); return b; });
  L.add(h('rect', { x: -500, y: 1290, width: 2100, height: 800, fill: '#140a22' }));
  S.update(t => { wings.forEach(([w, s]) => w.setAttribute('transform', `translate(540,${1000}) rotate(${s * Math.sin(t * 3) * 10})`)); bats.forEach((b, i) => { const ph = pm(t * .35 + i / 6, 1), x = 100 + ph * 900, y = 500 + Math.sin(ph * 9 + i) * 120 + i * 40, f = Math.sin(t * 16 + i) * 18; b.setAttribute('d', `M ${x - 40} ${y - f} L ${x} ${y} L ${x + 40} ${y - f} L ${x + 20} ${y + 10} L ${x} ${y + 4} L ${x - 20} ${y + 10} Z`); }); });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});

/* s23 — c'est fini : fin de partie, cœur brisé */
CLIP.scene('s23', S => {
  const { E, h } = S; S.layer(0).add(E.sky(['#05030c', '#140c26']));
  ground(S); hud(S, () => 0, () => 0);
  const L = S.layer(1);
  const hp = [0, 1].map(i => { const id = 'gh' + i; S.defs.appendChild(h('clipPath', { id }, [h('rect', { x: i ? 540 : 340, y: 600, width: 200, height: 400 })])); const g = h('g', {}, [h('g', { 'clip-path': `url(#${id})` }, [h('path', { d: heartD(540, 820, 110), fill: '#7a2a6a', stroke: K.ink, 'stroke-width': 10 })])]); L.g.appendChild(g); return g; });
  L.add(hero(E, { s: 1.0, action: 'walk', speed: .6, facing: 1, pose: 'sad', path: [[0, [420, 1480]], [1.7, [700, 1480]]] }));
  L.add(E.label('GAME OVER', { x: 540, y: 1180, size: 90, color: K.white, font: 'Pixelify Sans', weight: 700, opacity: .9 }));
  const dim = h('rect', { x: -600, y: -600, width: 2300, height: 3200, fill: K.ink, opacity: 0 }); L.g.appendChild(dim);
  S.update(t => { hp[0].setAttribute('transform', `translate(-30,0) rotate(-12 540 900)`); hp[1].setAttribute('transform', `translate(30,0) rotate(12 540 900)`); dim.setAttribute('opacity', Math.min(.35, t * .2)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s24 — toute la semaine : soleil et lune défilent, 7 cases cochées */
CLIP.scene('s24', S => {
  const { E, h } = S;
  const sky = h('rect', { x: -800, y: -800, width: 2700, height: 3600 }); S.layer(0).add(sky);
  const sun = h('circle', { r: 70, fill: K.gold, stroke: K.ink, 'stroke-width': 8 }), moon = h('circle', { r: 55, fill: K.white, stroke: K.ink, 'stroke-width': 8 }); S.layer(.1).add(sun); S.layer(.1).add(moon);
  S.layer(.3).add(E.city({ y: 1500, color: '#2a1d4f', seed: 51, windows: K.gold, lit: .2, maxH: 500, flicker: false }));
  const L = S.layer(1);
  L.add(h('rect', { x: -500, y: 1440, width: 2100, height: 800, fill: '#3a2f55' }));
  L.add(hero(E, { x: 540, y: 1560, s: 1.0, pose: 'think', action: 'breathe' }));
  const boxes = [...Array(7)].map((_, i) => { const g = h('g', { transform: `translate(${130 + i * 120},${1700})` }, [h('rect', { x: -45, y: -45, width: 90, height: 90, fill: K.white, stroke: K.ink, 'stroke-width': 8 })]); const ck = h('path', { d: 'M -25 0 L -5 22 L 28 -24', stroke: K.green, 'stroke-width': 14, fill: 'none' }); g.appendChild(ck); L.g.appendChild(g); return ck; });
  S.update(t => { const d = Math.max(0, t) / S.dur * 7, f = pm(d, 1), a = f * Math.PI; const day = f < .5; sky.setAttribute('fill', day ? '#7fc8ff' : K.night); S.set(sun, { cx: 100 + f * 2 * 880, cy: 1200 - Math.sin(f * 2 * Math.PI / 2) * 800, opacity: day ? 1 : 0 }); S.set(moon, { cx: 100 + (f - .5) * 2 * 880, cy: 1200 - Math.sin((f - .5) * 2 * Math.PI / 2) * 800, opacity: day ? 0 : 1 }); boxes.forEach((c, i) => c.setAttribute('opacity', i < Math.floor(d) + 1 ? 1 : 0)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.04 }]], 'linear');
});

/* s25 — est-ce que t'es sûr ? : écran de téléphone, « continue ? » */
CLIP.scene('s25', S => {
  const { E, h } = S; S.layer(0).add(E.rect({ x: -800, y: -800, width: 2700, height: 3600, fill: '#1a1033' }));
  const L = S.layer(1);
  L.add(h('rect', { x: 230, y: 560, width: 620, height: 1000, rx: 50, fill: K.ink }));
  L.add(h('rect', { x: 260, y: 620, width: 560, height: 880, rx: 20, fill: '#2b2440' }));
  const b1 = h('g', {}, [h('rect', { x: 290, y: 1000, width: 360, height: 110, rx: 30, fill: K.mag, stroke: K.ink, 'stroke-width': 8 }), h('rect', { x: 320, y: 1035, width: 220, height: 20, fill: K.white }), h('rect', { x: 320, y: 1065, width: 140, height: 18, fill: K.white })]); L.g.appendChild(b1);
  const q = h('text', { x: 700, y: 1100, 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 120, fill: K.gold, stroke: K.ink, 'stroke-width': 5 }); q.textContent = '?'; L.g.appendChild(q);
  const cont = h('g', {}, [h('rect', { x: 300, y: 1250, width: 480, height: 150, fill: K.ink, stroke: K.white, 'stroke-width': 8 })]); L.g.appendChild(cont);
  const ct = h('text', { x: 540, y: 1352, 'text-anchor': 'middle', 'font-family': 'Pixelify Sans', 'font-weight': 700, 'font-size': 70, fill: K.white }); cont.appendChild(ct);
  S.update(t => { const k = Math.min(1, t / .25); b1.setAttribute('transform', `translate(0,${(1 - k) * 60})`); b1.setAttribute('opacity', k); q.setAttribute('opacity', Math.floor(t * 4) % 2 ? 1 : .3); ct.textContent = 'CONTINUE ? ' + Math.max(0, 9 - Math.floor(t * 2)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.08 }]], 'inOutSine');
});
