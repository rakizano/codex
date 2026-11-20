/* SDM — « Cartier Santos » — scènes illustrées
 * Univers : roman graphique nocturne de cité. Lui = bleu nuit, elle = rose néon, l'argent = or.
 * Toutes les animations sont des fonctions pures de t (secondes locales).
 */
const C = {
  night: '#05080f', petrol: '#0b1626', cite: '#13304a', beton: '#5b6470', sodium: '#ff8a2a', pink: '#ff3d8b',
  gold: '#d4af37', goldD: '#9c7a1f', goldL: '#f3dc8a', white: '#f4f1ea', him: '#0c1726', her: '#1a0b18',
};
const posmod = (a, n) => ((a % n) + n) % n;
const him = (E, o) => E.figure(Object.assign({ color: C.him, hat: 'hood', hatColor: C.him, bodyWidth: 1.1, outline: '#3d6f9e', outlineWidth: 2.5 }, o));
const her = (E, o) => E.figure(Object.assign({ color: C.her, hair: 'long', hairColor: C.her, outline: C.pink, outlineWidth: 3, bodyWidth: .85 }, o));

// Tour HLM avec fenêtres (quelques-unes allumées, une éventuellement rose)
function tower(S, { x, y, w, h: hh, color = '#0f2236', lit = .25, seed = 1, win = C.sodium, pinkAt = null, cols = null }) {
  const { h, rng } = S; const r = rng; const g = h('g');
  g.appendChild(h('rect', { x, y: y - hh, width: w, height: hh + 1200, fill: color }));
  const nc = cols || Math.max(3, Math.floor(w / 70)), cw = w / nc, wins = [];
  for (let row = 0; y - hh + 40 + row * 90 < y - 30; row++) for (let c = 0; c < nc; c++) {
    const wx = x + c * cw + cw * .22, wy = y - hh + 40 + row * 90;
    const isPink = pinkAt && pinkAt[0] === row && pinkAt[1] === c;
    const on = isPink || r() < lit;
    const el = h('rect', { x: wx, y: wy, width: cw * .56, height: 52, fill: isPink ? C.pink : on ? win : '#081320', opacity: on ? 1 : .9 });
    g.appendChild(el); if (on && !isPink) wins.push([el, r() * 50]);
    if (isPink) g.appendChild(h('rect', { x: wx - 30, y: wy - 30, width: cw * .56 + 60, height: 112, fill: C.pink, opacity: .35, filter: 'url(#softblur)' }));
  }
  return { el: g, update: t => wins.forEach(([el, ph], i) => { if (i % 9 === 0) el.setAttribute('opacity', S.noise(t * 2 + ph, 3) > .55 ? .25 : 1); }) };
}
function heartPath(cx, cy, r) {
  const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`;
  return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`;
}
function gearPath(r, teeth) {
  let d = ''; for (let i = 0; i < teeth * 2; i++) { const a0 = i / (teeth * 2) * Math.PI * 2, a1 = (i + 1) / (teeth * 2) * Math.PI * 2, rr = i % 2 ? r : r * 1.22; d += (i ? ' L ' : 'M ') + `${Math.cos(a0) * rr} ${Math.sin(a0) * rr} L ${Math.cos(a1) * rr} ${Math.sin(a1) * rr}`; } return d + ' Z';
}
// Montre carrée en or (sans logo) : boîtier, lunette à vis, cadran romain, bracelet
function watch(S, x, y, s = 1) {
  const { h } = S; const g = h('g'); const hands = h('g');
  for (let i = 0; i < 4; i++) { g.appendChild(h('rect', { x: -88, y: -270 + i * 38, width: 176, height: 34, rx: 6, fill: i % 2 ? C.goldD : C.gold })); g.appendChild(h('rect', { x: -88, y: 124 + i * 38, width: 176, height: 34, rx: 6, fill: i % 2 ? C.gold : C.goldD })); }
  g.appendChild(h('rect', { x: -134, y: -134, width: 268, height: 268, rx: 46, fill: C.goldD }));
  g.appendChild(h('rect', { x: -128, y: -128, width: 256, height: 256, rx: 42, fill: C.gold }));
  g.appendChild(h('rect', { x: -100, y: -100, width: 200, height: 200, rx: 26, fill: C.goldL }));
  g.appendChild(h('rect', { x: -86, y: -86, width: 172, height: 172, rx: 18, fill: '#f6f1e3' }));
  [[-114, -114], [0, -114], [114, -114], [114, 0], [114, 114], [0, 114], [-114, 114], [-114, 0]].forEach(([a, b]) => { g.appendChild(h('circle', { cx: a, cy: b, r: 7, fill: C.goldD })); g.appendChild(h('line', { x1: a - 4, y1: b - 4, x2: a + 4, y2: b + 4, stroke: C.goldL, 'stroke-width': 2 })); });
  [['XII', 0, -58], ['III', 60, 6], ['VI', 0, 72], ['IX', -60, 6]].forEach(([tx, a, b]) => { const e = h('text', { x: a, y: b, 'text-anchor': 'middle', 'font-size': 22, 'font-family': 'serif', fill: '#222' }); e.textContent = tx; g.appendChild(e); });
  g.appendChild(h('rect', { x: 132, y: -16, width: 22, height: 32, rx: 6, fill: C.gold }));
  g.appendChild(h('circle', { cx: 156, cy: 0, r: 9, fill: '#1d3a8a' }));
  const hh = h('path', { d: 'M -5 10 L 0 -50 L 5 10 Z', fill: '#1d3a8a' }), mh = h('path', { d: 'M -4 12 L 0 -74 L 4 12 Z', fill: '#1d3a8a' });
  hands.append(hh, mh, h('circle', { r: 6, fill: '#1d3a8a' })); g.appendChild(hands);
  g.appendChild(h('path', { d: 'M -128 -60 L -60 -128 L -20 -128 L -128 -20 Z', fill: '#fff', opacity: .18 }));
  const wrap = h('g', { transform: `translate(${x},${y}) scale(${s})` }, [g]);
  return { el: wrap, inner: g, update: t => { mh.setAttribute('transform', `rotate(${t * 30 + 50})`); hh.setAttribute('transform', `rotate(${t * 2.5 + 310})`); } };
}
function bill(h) {
  return h('g', {}, [h('rect', { x: -70, y: -34, width: 140, height: 68, rx: 6, fill: '#c9b458' }), h('rect', { x: -62, y: -26, width: 124, height: 52, rx: 4, fill: 'none', stroke: '#7d6a1c', 'stroke-width': 3 }), h('ellipse', { rx: 18, ry: 22, fill: '#9c8a2c' })]);
}
const nightSky = (S, d = 0, stops) => S.layer(d).add(S.E.sky(stops || [C.night, C.petrol, C.cite]));

/* s00 — c'est fini : toit de tour, téléphone qui tombe */
CLIP.scene('s00', S => {
  const { E, h } = S;
  nightSky(S, 0, [[0, C.night], [.6, C.petrol], [1, '#2e2a4a']]);
  S.layer(.05).add(E.stars({ n: 70, seed: 3 }));
  S.layer(.1).add(E.moon({ x: 830, y: 420, r: 60, color: C.white, bg: '#080e1c' }));
  S.layer(.3).add(E.city({ y: 1330, color: '#0f2236', seed: 7, windows: C.sodium, lit: .3, maxH: 500 }));
  S.layer(.5).add(E.city({ y: 1420, color: '#0a1726', seed: 9, windows: '#ffb066', lit: .2, maxH: 380 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1480, width: 3000, height: 900, fill: '#1b2633' }));
  L.add(h('rect', { x: -1000, y: 1470, width: 3000, height: 18, fill: '#2b3a4d' }));
  L.add(h('g', { stroke: '#2b3a4d', 'stroke-width': 6 }, [h('line', { x1: 860, y1: 1475, x2: 860, y2: 1200 }), h('line', { x1: 820, y1: 1250, x2: 900, y2: 1250 }), h('line', { x1: 830, y1: 1300, x2: 890, y2: 1300 })]));
  L.add(him(E, { x: 470, y: 1480, s: 1.35, action: 'breathe', pose: { lean: 6, head: 18, ua1: 25, la1: 30 } }));
  const ph = h('g', {}, [h('rect', { x: -14, y: -24, width: 28, height: 48, rx: 5, fill: '#111' }), h('rect', { x: -11, y: -20, width: 22, height: 38, rx: 3, fill: '#5ab0ff' })]);
  L.g.appendChild(ph);
  S.update(t => { const u = Math.max(0, t - .7); ph.setAttribute('transform', `translate(${470 + 95 + u * 60},${1480 - 1.35 * 250 + 4.9 * 160 * u * u}) rotate(${u * 400})`); ph.setAttribute('opacity', u > 1.2 ? 0 : 1); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: -20, y: 20, zoom: 1.1 }]], 'inOutSine');
});

/* s01 — toute la semaine : calendrier barré jour après jour */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#152435' }));
  const st = h('g', { opacity: .25 }); for (let x = -400; x < 1500; x += 80) st.appendChild(h('rect', { x, y: -800, width: 30, height: 3600, fill: '#22374e' })); S.layer(0).add(st);
  S.layer(.2).add(E.radial([[0, C.sodium, .35], [1, C.sodium, 0]], { cx: .3, cy: .6, r: .45 }));
  const L = S.layer(.6);
  L.add(h('rect', { x: 150, y: 640, width: 780, height: 440, rx: 10, fill: C.white }));
  L.add(h('rect', { x: 150, y: 640, width: 780, height: 80, rx: 10, fill: C.cite }));
  const days = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'], X = [];
  days.forEach((d, i) => {
    const bx = 170 + (i % 4) * 190, by = 740 + Math.floor(i / 4) * 170;
    L.add(h('rect', { x: bx, y: by, width: 170, height: 150, fill: '#e6e0d2' }));
    const t_ = h('text', { x: bx + 85, y: by + 38, 'text-anchor': 'middle', 'font-family': 'Bebas Neue', 'font-size': 34, fill: C.cite }); t_.textContent = d; L.add(t_);
    const x1 = h('path', { d: `M ${bx + 25} ${by + 55} L ${bx + 145} ${by + 135} M ${bx + 145} ${by + 55} L ${bx + 25} ${by + 135}`, stroke: C.sodium, 'stroke-width': 12, 'stroke-linecap': 'round', fill: 'none' });
    L.add(x1); X.push(x1);
  });
  const D = S.layer(1);
  D.add(h('rect', { x: -200, y: 1430, width: 1500, height: 40, fill: '#2b1d14' }));
  D.add(h('rect', { x: -200, y: 1470, width: 1500, height: 600, fill: '#0a121d' }));
  D.add(him(E, { x: 540, y: 1700, s: 1.1, pose: 'think', action: 'breathe', anim: (a, t) => { a.ua2 = 40; a.la2 = 150; a.head = 35; a.lean = 18; } }));
  S.update(t => X.forEach((x, i) => { const L_ = 340, k = Math.min(1, Math.max(0, (t - .15 - i * .32) / .25)); x.setAttribute('stroke-dasharray', L_); x.setAttribute('stroke-dashoffset', L_ * (1 - k)); }));
  S.camera([[0, { x: 0, y: 20, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s02 — « est-ce que t'es sûr ? » : conversation sur téléphone */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#1b1030', '#2a0f2a']));
  const bok = h('g', { filter: 'url(#bigblur)' }); [[150, 700, C.sodium], [900, 600, C.pink], [800, 1500, '#5ab0ff'], [200, 1400, C.sodium], [600, 300, C.pink]].forEach(([x, y, c]) => bok.appendChild(h('circle', { cx: x, cy: y, r: 120, fill: c, opacity: .45 }))); S.layer(.2).add(bok);
  const L = S.layer(1); const ph = h('g'); L.g.appendChild(ph);
  ph.append(h('rect', { x: 270, y: 560, width: 540, height: 960, rx: 60, fill: '#0a0a0e' }), h('rect', { x: 292, y: 584, width: 496, height: 912, rx: 44, fill: '#0f1420' }),
    h('rect', { x: 292, y: 584, width: 496, height: 100, rx: 44, fill: '#161d2d' }), h('circle', { cx: 350, cy: 634, r: 26, fill: C.pink }), h('rect', { x: 395, y: 622, width: 150, height: 22, rx: 11, fill: '#3a4560' }));
  const bub = [];
  const mk = (x, y, w, c, right) => { const g = h('g', {}, [h('rect', { x, y, width: w, height: 84, rx: 34, fill: c }), h('rect', { x: x + 26, y: y + 26, width: w * .62, height: 14, rx: 7, fill: '#fff', opacity: .7 }), h('rect', { x: x + 26, y: y + 50, width: w * .4, height: 12, rx: 6, fill: '#fff', opacity: .5 })]); ph.appendChild(g); bub.push([g, right]); return g; };
  mk(480, 740, 280, '#2f6fed', true); mk(480, 850, 240, '#2f6fed', true); mk(320, 980, 300, '#3a2f45', false);
  const dots = h('g'); [0, 1, 2].forEach(i => dots.appendChild(h('circle', { cx: 360 + i * 30, cy: 1132, r: 10, fill: C.pink }))); ph.appendChild(h('rect', { x: 320, y: 1094, width: 140, height: 76, rx: 34, fill: '#3a2f45' })); ph.appendChild(dots);
  S.update(t => {
    bub.forEach(([g, r], i) => { const k = Math.min(1, Math.max(0, (t + .4 - i * .45) / .2)); g.setAttribute('opacity', k); g.setAttribute('transform', `translate(0,${(1 - k) * 30})`); });
    [...dots.children].forEach((c, i) => c.setAttribute('cy', 1132 - Math.max(0, Math.sin(t * 9 - i)) * 10));
    ph.setAttribute('transform', `rotate(${-4 + Math.sin(t * 1.5) * 1.5} 540 1040)`);
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.12 }], [1, { x: 0, y: -20, zoom: 1.0 }]], 'outCubic');
});

/* s03 — « dommage » : elle à sa fenêtre rose */
CLIP.scene('s03', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: C.cite }));
  const bricks = h('g', { stroke: '#0f2236', 'stroke-width': 3 }); for (let y = -200; y < 2200; y += 60) bricks.appendChild(h('line', { x1: -500, y1: y, x2: 1600, y2: y })); S.layer(.3).add(bricks);
  const L = S.layer(1);
  L.add(h('rect', { x: 230, y: 640, width: 620, height: 760, fill: '#0a1420' }));
  L.add(h('rect', { x: 260, y: 670, width: 560, height: 700, fill: E.gradientDef([[0, '#ff7ab0'], [1, '#b0185a']]) }));
  L.add(her(E, { x: 560, y: 1520, s: 1.5, outline: '#ffd0e4', pose: 'stand', action: 'none', anim: (a, t) => { const k = Math.sin(Math.min(1, t / .5) * Math.PI); a.ua1 = 30 + k * 60; a.la1 = 140; a.ua2 = -30 - k * 60; a.la2 = -140; a.head = -10 + k * 15; } }));
  const cur = h('path', { fill: '#7a0f3c', opacity: .9 }); L.g.appendChild(cur);
  L.add(h('rect', { x: 230, y: 1380, width: 620, height: 30, fill: '#0a1420' }));
  S.update(t => { let d = 'M 260 670 L 380 670'; for (let y = 670; y <= 1370; y += 35) d += ` L ${380 + Math.sin(y / 60 + t * 4) * 18 - (y - 670) * .05} ${y}`; cur.setAttribute('d', d + ' L 260 1370 Z'); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'outCubic');
});

/* s04 — « pour qu'tu montes » : montée le long de la façade jusqu'à la fenêtre rose */
CLIP.scene('s04', S => {
  const { E, h } = S;
  nightSky(S, .1, [[0, C.night], [1, '#1b2a4a']]);
  S.layer(.15).add(E.stars({ n: 80, seed: 5, area: [-300, -1200, 1700, 2400] }));
  const L = S.layer(1);
  L.add(tower(S, { x: 140, y: 2600, w: 800, h: 3300, color: '#10233a', lit: .18, seed: 4, cols: 6, pinkAt: [2, 4] }));
  S.camera([[0, { x: 0, y: -1500, zoom: 1.0 }], [1, { x: 0, y: 220, zoom: 1.15 }]], 'inOutCubic');
});

/* s05 — mon cœur est navré : radiographie, cœur qui se fissure */
CLIP.scene('s05', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#06141c' }));
  const grid = h('g', { stroke: '#0f3342', 'stroke-width': 2 }); for (let i = -10; i < 40; i++) { grid.appendChild(h('line', { x1: i * 60, y1: -400, x2: i * 60, y2: 2400 })); grid.appendChild(h('line', { x1: -400, y1: i * 60, x2: 1500, y2: i * 60 })); } S.layer(.2).add(grid);
  const L = S.layer(1); const cy = '#7fd6ff';
  L.add(h('path', { d: 'M 120 1700 Q 140 1000 300 880 Q 420 820 470 700 L 610 700 Q 660 820 780 880 Q 940 1000 960 1700 Z', fill: '#0b2a3a', stroke: cy, 'stroke-width': 5, opacity: .9 }));
  L.add(h('circle', { cx: 540, cy: 560, r: 130, fill: '#0b2a3a', stroke: cy, 'stroke-width': 5 }));
  const ribs = h('g', { stroke: cy, 'stroke-width': 7, fill: 'none', opacity: .5 }); for (let i = 0; i < 6; i++) { ribs.appendChild(h('path', { d: `M 540 ${960 + i * 75} Q ${360} ${930 + i * 75} ${300 + i * 6} ${1030 + i * 75}` })); ribs.appendChild(h('path', { d: `M 540 ${960 + i * 75} Q ${720} ${930 + i * 75} ${780 - i * 6} ${1030 + i * 75}` })); } ribs.appendChild(h('line', { x1: 540, y1: 900, x2: 540, y2: 1420 })); L.add(ribs);
  const glow = h('path', { d: heartPath(560, 1120, 140), fill: C.pink, filter: 'url(#bigblur)', opacity: .6 }), hp = h('path', { d: heartPath(560, 1120, 130), fill: C.pink });
  const crack = h('path', { d: 'M 560 1005 L 535 1060 L 580 1100 L 540 1150 L 575 1200 L 560 1245', stroke: C.white, 'stroke-width': 9, fill: 'none', 'stroke-linejoin': 'round' });
  L.g.append(glow, hp, crack);
  S.update(t => {
    const beat = Math.exp(-((t % .55) * 9)), s = 1 + beat * .1 * (t < .8 ? 1 : .3);
    hp.setAttribute('transform', `translate(560,1120) scale(${s}) translate(-560,-1120)`);
    const k = Math.min(1, Math.max(0, (t - .55) / .3)); crack.setAttribute('stroke-dasharray', 320); crack.setAttribute('stroke-dashoffset', 320 * (1 - k));
    hp.setAttribute('fill', S.mix(C.pink, '#5a1530', Math.min(1, Math.max(0, (t - .8) / .4)))); glow.setAttribute('opacity', .6 * (1 - Math.min(1, Math.max(0, (t - .8) / .4))));
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -30, zoom: 1.1 }]], 'inOutSine');
});

/* s06 — retourner sa veste : marionnette tirée par une main rose */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2a1630'], [1, C.night]], { cx: .5, cy: .6, r: .6 }));
  S.layer(.3).add(h('path', { d: 'M 400 -100 L 680 -100 L 900 1700 L 180 1700 Z', fill: E.gradientDef([[0, '#ffd0e4', .25], [1, '#ffd0e4', 0]]) }));
  const L = S.layer(1);
  const hand = h('path', { d: 'M 260 120 Q 300 330 360 380 L 390 560 Q 400 590 420 560 L 430 400 L 470 620 Q 485 650 500 620 L 500 410 L 545 640 Q 560 670 575 640 L 570 410 L 620 600 Q 635 630 650 600 L 640 380 Q 760 330 820 120 Z', fill: C.pink });
  const handG = h('g', {}, [hand]); L.g.appendChild(handG);
  const strings = h('g', { stroke: '#ffd0e4', 'stroke-width': 3, opacity: .8 }); const sl = [0, 1, 2, 3].map(() => { const l = h('line'); strings.appendChild(l); return l; }); L.g.appendChild(strings);
  const fig = him(E, { x: 0, y: 0, s: 1.25, pose: 'stand', action: 'none', anim: (a, t) => { a.ua1 = 120 + Math.sin(t * 6) * 25; a.la1 = 150; a.ua2 = -120 + Math.sin(t * 6 + 2) * 25; a.la2 = -150; a.th1 = Math.sin(t * 5) * 18; a.th2 = -Math.sin(t * 5) * 18; a.head = Math.sin(t * 4) * 12; } });
  const fg = h('g'); fg.appendChild(fig.el); L.g.appendChild(fg);
  S.update(t => {
    const hx = Math.sin(t * 1.8) * 30, hy = Math.sin(t * 2.4) * 15;
    handG.setAttribute('transform', `translate(${hx},${hy})`);
    fig.update(t);
    const turn = Math.cos(t * 3.2), bob = Math.sin(t * 6) * 12;
    fig.el.setAttribute('transform', `translate(540,${1520 + bob}) scale(${1.25 * (Math.abs(turn) < .15 ? .15 * Math.sign(turn || 1) : turn)},1.25) translate(0,-176)`);
    const tips = [[400, 580], [490, 640], [565, 660], [640, 620]], targets = [[540 - 150 * turn, 1000 + bob], [540 - 30 * turn, 920 + bob], [540 + 40 * turn, 940 + bob], [540 + 150 * turn, 1000 + bob]];
    sl.forEach((l, i) => S.set(l, { x1: tips[i][0] + hx, y1: tips[i][1] + hy, x2: targets[i][0], y2: targets[i][1] }));
  });
  S.camera([[0, { x: 0, y: 20, zoom: 1.05 }], [1, { x: 0, y: -20, zoom: 1.0 }]], 'inOutSine');
});

/* s07 — ma bouche a dit non : profil géant en ombre chinoise */
CLIP.scene('s07', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#0b1626'], [.6, '#1d4e89'], [1, '#5ab0ff']], { horizontal: true }));
  S.layer(.2).add(E.rays({ x: 150, y: 1000, n: 10, color: '#9fd2ff', opacity: .12, speed: 6 }));
  const L = S.layer(1); const face = h('path', { fill: '#03060c' }); L.g.appendChild(face);
  S.update(t => {
    const o = Math.max(0, Math.sin(t * 11)) * 26 * (t < 1.2 ? 1 : .3);
    face.setAttribute('d', `M 1200 520 L 820 520 Q 620 540 590 760 Q 585 860 540 930 L 450 1060 Q 440 1085 480 1095 L 520 1100 Q 535 1130 515 1150 Q 500 1160 520 1172 L 545 1178 L 545 ${1182 + o} L 520 ${1188 + o} Q 505 ${1200 + o} 525 ${1214 + o} Q 545 ${1230 + o} 530 ${1262 + o} Q 520 ${1320 + o} 600 ${1340 + o} Q 680 ${1350 + o} 720 1420 L 760 1700 L 1200 1700 Z`);
  });
  S.camera([[0, { x: 30, y: 0, zoom: 1.08 }], [1, { x: -10, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s08 — mon cœur voulait dire oui : cœur géant qui bat */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#5a0f30'], [1, '#12030a']], { cx: .5, cy: .55, r: .65 }));
  S.layer(.4).add(E.rings({ x: 540, y: 1060, n: 7, gap: 110, color: C.pink, width: 8, speed: 220, opacity: .5 }));
  const L = S.layer(1);
  const glow = h('path', { d: heartPath(540, 1060, 330), fill: C.pink, filter: 'url(#bigblur)', opacity: .55 }), hp = h('path', { d: heartPath(540, 1060, 300), fill: C.pink }), hl = h('path', { d: 'M 360 900 Q 380 820 460 810', stroke: '#ffd0e4', 'stroke-width': 22, 'stroke-linecap': 'round', fill: 'none', opacity: .7 });
  L.g.append(glow, hp, hl);
  S.update(t => { const p = t % .5, b = Math.exp(-p * 12) + .6 * Math.exp(-Math.max(0, p - .14) * 14) * (p > .14 ? 1 : 0); const s = 1 + b * .09; [hp, hl, glow].forEach(e => e.setAttribute('transform', `translate(540,1060) scale(${s}) translate(-540,-1060)`)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'linear', { shake: 3, shakeFreq: 8 });
});

/* s09 — mon cerveau : engrenages dans la tête */
CLIP.scene('s09', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#0f2236', '#13304a']));
  const L = S.layer(1); const cy = '#7fd6ff';
  L.add(h('path', { d: 'M 300 1050 Q 220 760 330 560 Q 470 330 700 380 Q 900 430 900 650 Q 905 760 860 830 L 900 900 Q 905 930 870 935 L 860 1000 Q 850 1050 780 1040 L 740 1100 L 740 1180 L 360 1180 Z', fill: '#0b1d2e', stroke: cy, 'stroke-width': 6 }));
  const gears = [[520, 640, 95, 12, 1], [680, 590, 60, 9, -1.6], [650, 780, 70, 10, 1.3], [430, 830, 55, 8, -1.8]].map(([x, y, r, n, sp]) => { const g = h('path', { d: gearPath(r, n), fill: sp > 0 ? C.sodium : C.gold, stroke: '#0b1d2e', 'stroke-width': 4 }); const w = h('g', {}, [g, h('circle', { cx: 0, cy: 0, r: r * .35, fill: '#0b1d2e' })]); L.g.appendChild(w); return [w, x, y, sp]; });
  const q = [0, 1, 2, 3].map(i => { const e = h('text', { 'font-family': 'Bebas Neue', 'font-size': 90 + i * 15, fill: C.white, 'text-anchor': 'middle' }); e.textContent = '?'; L.g.appendChild(e); return e; });
  S.update(t => { gears.forEach(([w, x, y, sp]) => w.setAttribute('transform', `translate(${x},${y}) rotate(${t * 90 * sp + noiseJ(t, sp)})`)); q.forEach((e, i) => { const ph = posmod(t * .5 + i / 4, 1); S.set(e, { x: 330 + i * 140 + Math.sin(ph * 6 + i) * 30, y: 520 - ph * 300, opacity: Math.sin(ph * Math.PI) }); }); });
  function noiseJ(t, sp) { return S.noise(t * 5, sp) * 15; }
  S.camera([[0, { x: 0, y: -20, zoom: 1.0, rot: -2 }], [1, { x: 0, y: 10, zoom: 1.08, rot: 2 }]], 'inOutSine');
});

/* s10 — relation remplie de rage : orage, dispute au balcon */
CLIP.scene('s10', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05070d', '#141c2c', '#25334a']));
  S.layer(.1).add(E.clouds({ n: 6, y: 300, spread: 300, color: '#1b2536', opacity: .95, speed: 60, scale: 1.6 }));
  const bolt = h('path', { d: 'M 260 -50 L 330 300 L 270 310 L 380 640 L 320 650 L 450 1000', stroke: '#e8f2ff', 'stroke-width': 10, fill: 'none', filter: 'url(#glow)', opacity: 0 }); S.layer(.15).add(bolt);
  S.layer(.3).add(E.city({ y: 1350, color: '#0b1220', seed: 21, windows: C.sodium, lit: .15, maxH: 450 }));
  const L = S.layer(1);
  L.add(h('rect', { x: 80, y: 1150, width: 1000, height: 900, fill: '#162231' }));
  L.add(h('rect', { x: 80, y: 1400, width: 920, height: 26, fill: '#2b3a4d' }));
  const rail = h('g', { stroke: '#2b3a4d', 'stroke-width': 8 }); for (let x = 100; x < 1000; x += 60) rail.appendChild(h('line', { x1: x, y1: 1250, x2: x, y2: 1400 })); rail.appendChild(h('line', { x1: 80, y1: 1250, x2: 1000, y2: 1250 }));
  L.add(him(E, { x: 360, y: 1400, s: 1.1, pose: 'point', action: 'tremble' }));
  L.add(her(E, { x: 720, y: 1400, s: 1.0, pose: 'point', action: 'tremble', facing: -1 }));
  L.add(rail);
  S.layer(1).add(E.rain({ n: 260, angle: 16, speed: 2400, color: '#c9d7ea', opacity: .45 }));
  const flash = h('rect', { x: -500, y: -500, width: 2100, height: 2900, fill: '#dfe9ff', opacity: 0 }); S.layer(1).add(flash);
  S.update(t => { const f = [.35, 1.9, 3.1].reduce((m, a) => Math.max(m, t >= a && t < a + .25 ? 1 - (t - a) / .25 : 0), 0); bolt.setAttribute('opacity', f > .4 ? 1 : 0); flash.setAttribute('opacity', f * .45); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.05 }], [1, { x: -20, y: 0, zoom: 1.12 }]], 'inOutSine', { shake: 6, shakeFreq: 6 });
});

/* s11 — j'm'en suis pas remis : vue de dessus, allongé au sol */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#1c2430' }));
  const pl = h('g', { stroke: '#151b25', 'stroke-width': 4 }); for (let x = -600; x < 1700; x += 110) pl.appendChild(h('line', { x1: x, y1: -800, x2: x, y2: 2800 })); S.layer(0).add(pl);
  const lightP = h('path', { fill: C.sodium, opacity: .22 }); S.layer(.5).add(lightP);
  const L = S.layer(1);
  const f = him(E, { x: 0, y: 0, s: 1.4, pose: 'fall', action: 'breathe' }); const fg = h('g', { transform: 'translate(560,1080) rotate(-75)' }, [f.el]); L.g.appendChild(fg); S.items.push(f);
  f.el.setAttribute('data', 'x');
  L.add(h('g', { transform: 'translate(820,1350) rotate(25)' }, [h('rect', { x: -24, y: -44, width: 48, height: 88, rx: 8, fill: '#111' }), h('rect', { x: -19, y: -38, width: 38, height: 74, rx: 5, fill: '#5ab0ff', opacity: .8 })]));
  L.add(h('circle', { cx: 260, cy: 760, r: 34, fill: '#d8d2c0' }));
  S.update(t => { const s = t * 30; lightP.setAttribute('d', `M ${200 + s} 600 L ${650 + s} 600 L ${780 + s} 1400 L ${330 + s} 1400 Z`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.15, rot: -3 }], [1, { x: 0, y: 0, zoom: 1.0, rot: 3 }]], 'inOutSine');
});

/* s12 — plus l'sommeil : chambre, réveil 03:47, stores */
CLIP.scene('s12', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#0e1a2b' }));
  const stripes = h('g', { fill: '#7fb0e0', opacity: .16 }); for (let i = 0; i < 9; i++) stripes.appendChild(h('path', { d: `M ${-200} ${300 + i * 90} L 1300 ${150 + i * 90} L 1300 ${190 + i * 90} L -200 ${340 + i * 90} Z` })); S.layer(.2).add(stripes);
  const L = S.layer(1);
  L.add(h('rect', { x: -100, y: 1290, width: 820, height: 160, rx: 20, fill: '#22324a' }));
  L.add(h('rect', { x: -100, y: 1250, width: 260, height: 70, rx: 30, fill: '#cfd8e6' }));
  L.add(h('rect', { x: -100, y: 1440, width: 820, height: 600, fill: '#141f30' }));
  L.add(h('rect', { x: 780, y: 1250, width: 220, height: 220, fill: '#1b2638' }));
  L.add(h('rect', { x: 800, y: 1160, width: 180, height: 90, rx: 10, fill: '#050a12' }));
  const clk = h('text', { x: 890, y: 1228, 'text-anchor': 'middle', 'font-family': 'monospace', 'font-weight': 700, 'font-size': 58, fill: C.pink }); clk.textContent = '03:47'; L.add(clk);
  L.add(h('circle', { cx: 890, cy: 1205, r: 120, fill: C.pink, opacity: .15, filter: 'url(#bigblur)' }));
  L.add(him(E, { x: 520, y: 1470, s: 1.15, pose: 'sit', action: 'breathe', pose: { lean: 12, head: 25, ua1: 30, la1: 70, ua2: 20, la2: 60, th1: 85, sh1: -85, th2: 80, sh2: -80 } }));
  S.update(t => { clk.textContent = Math.floor(t * 1.4) % 2 ? '03 47' : '03:47'; stripes.setAttribute('transform', `translate(${t * 40},0)`); });
  S.camera([[0, { x: 20, y: 0, zoom: 1.0 }], [1, { x: -20, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s13 — plusieurs res-ve : il flotte dans un ciel de rêve */
CLIP.scene('s13', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#140a30'], [.6, '#3d1f6e'], [1, '#a23a7a']]));
  S.layer(.05).add(E.stars({ n: 160, seed: 13, color: '#ffe6f4' }));
  S.layer(.15).add(E.moon({ x: 800, y: 760, r: 90, color: '#ffe6f4', phase: .35, bg: '#2a1550' }));
  S.layer(.3).add(E.clouds({ n: 6, y: 1500, spread: 300, color: '#c46aa0', opacity: .6, speed: 12, scale: 1.5, blur: true }));
  const L = S.layer(1);
  const pillows = [0, 1, 2, 3].map(i => { const g = h('rect', { x: -80, y: -45, width: 160, height: 90, rx: 40, fill: '#f4e8f4' }); L.g.appendChild(g); return g; });
  L.add(him(E, { x: 520, y: 1380, s: 1.0, action: 'float', speed: .7, color: '#1a1240', hatColor: '#1a1240' }));
  L.add(E.fireflies({ n: 30, color: '#ffe6f4', area: [100, 800, 880, 800] }));
  S.update(t => pillows.forEach((p, i) => p.setAttribute('transform', `translate(${[220, 820, 260, 860][i] + Math.sin(t + i) * 25},${[1000, 1150, 1450, 1500][i] + Math.cos(t * .8 + i) * 30}) rotate(${t * 20 * (i % 2 ? 1 : -1) + i * 30})`)));
  S.camera([[0, { x: 0, y: 30, zoom: 1.0, rot: -3 }], [1, { x: 0, y: -30, zoom: 1.06, rot: 3 }]], 'inOutSine');
});

/* s14 — tout va bien : sa story, cœurs et paillettes */
CLIP.scene('s14', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#ff7ab0'], [1, '#3a0a24']], { cx: .5, cy: .55, r: .7 }));
  const L = S.layer(1);
  L.add(h('rect', { x: 180, y: 580, width: 720, height: 1000, rx: 40, fill: '#ffb3d1', stroke: C.white, 'stroke-width': 10 }));
  L.add(E.radial([[0, '#fff0f6', .9], [1, '#ffb3d1', 0]], { x: 180, y: 580, w: 720, h: 1000, cx: .5, cy: .45, r: .5 }));
  [0, 1, 2].forEach(i => L.add(h('rect', { x: 210 + i * 225, y: 610, width: 210, height: 8, rx: 4, fill: C.white, opacity: i ? .5 : 1 })));
  L.add(her(E, { x: 540, y: 1520, s: 1.4, action: 'sway', speed: .8, pose: { lean: 0, head: -10, ua1: 160, la1: 200, ua2: -30, la2: -70, th1: 6, sh1: 0, th2: -6, sh2: 0 } }));
  L.add(E.particles({ n: 40, color: C.white, size: [3, 7], area: [200, 600, 680, 960], drift: [0, -30], glow: true, twinkle: 6 }));
  const hearts = [0, 1, 2, 3, 4, 5].map(i => { const p = h('path', { d: heartPath(0, 0, 34), fill: i % 2 ? C.white : C.pink }); L.g.appendChild(p); return p; });
  S.update(t => hearts.forEach((p, i) => { const ph = posmod(t * .55 + i / 6, 1); p.setAttribute('transform', `translate(${820 + Math.sin(ph * 8 + i) * 40},${1500 - ph * 800}) scale(${.6 + ph * .6})`); p.setAttribute('opacity', 1 - ph); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s15 — nouvelle relation : boulevard illuminé, main dans la main */
CLIP.scene('s15', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#1a1236', '#3a1a3a']));
  S.layer(.3).add(E.city({ y: 1300, color: '#160f2a', seed: 31, windows: '#ffd28a', lit: .4, maxH: 600 }));
  const L = S.layer(.7); const bulbs = [];
  [500, 700].forEach((y0, k) => { const p = h('path', { d: `M -200 ${y0} Q 540 ${y0 + 200} 1280 ${y0}`, stroke: '#2a2040', 'stroke-width': 3, fill: 'none' }); L.g.appendChild(p); for (let i = 0; i <= 24; i++) { const u = i / 24, x = -200 + u * 1480, y = y0 + 4 * 200 * u * (1 - u) * .5 * 2 * .5; const b = h('circle', { cx: x, cy: y0 + 400 * u * (1 - u), r: 9, fill: k ? C.gold : '#ffe6a0', filter: 'url(#glow)' }); L.g.appendChild(b); bulbs.push([b, i]); } });
  const G = S.layer(1);
  G.add(h('rect', { x: -1000, y: 1480, width: 3080, height: 800, fill: '#120c20' }));
  G.add(her(E, { s: 1.45, action: 'walk', speed: .85, seed: 3, path: [[0, [200, 1560]], [3, [470, 1560]]] }));
  G.add(E.figure({ s: 1.6, color: '#2a2040', outline: C.gold, outlineWidth: 2.5, action: 'walk', speed: .85, seed: 3, hat: 'cap', hatColor: '#2a2040', path: [[0, [360, 1560]], [3, [630, 1560]]] }));
  S.update(t => bulbs.forEach(([b, i]) => b.setAttribute('opacity', .55 + .45 * Math.sin(t * 5 + i))));
  S.camera([[0, { x: 60, y: 0, zoom: 1.05 }], [1, { x: -60, y: 0, zoom: 1.05 }]], 'linear');
});

/* s16 — la vie qu'elle rêvait : coucher de soleil, palmiers, yacht */
CLIP.scene('s16', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#2a1a4a'], [.45, C.pink], [.7, C.sodium], [1, '#ffd28a']]));
  S.layer(.1).add(E.sun({ x: 540, y: 1150, r: 190, color: '#ffe0a0', glow: .7 }));
  S.layer(.2).add(E.sea({ y: 1240, color: '#2a1a4a', light: '#ff8aa8', layers: 4, amp: 10, speed: 1.2 }));
  const yacht = h('path', { d: 'M -90 0 L 90 0 L 70 22 L -70 22 Z M -50 0 L -40 -24 L 40 -24 L 50 0 Z M -20 -24 L -14 -42 L 20 -42 L 26 -24 Z', fill: '#f4f1ea' }); S.layer(.25).add(yacht);
  const L = S.layer(1); const fronds = [];
  [[90, 1700, 1], [990, 1750, -1]].forEach(([x, y, sgn]) => {
    L.add(h('path', { d: `M ${x} ${y} Q ${x + sgn * 60} ${y - 400} ${x + sgn * 120} ${y - 800}`, stroke: '#1a0d1e', 'stroke-width': 34, fill: 'none', 'stroke-linecap': 'round' }));
    const top = h('g', { transform: `translate(${x + sgn * 120},${y - 800})` }); L.g.appendChild(top);
    for (let i = 0; i < 7; i++) top.appendChild(h('path', { d: `M 0 0 Q ${Math.cos(i / 7 * Math.PI * 2) * 160} ${Math.sin(i / 7 * Math.PI * 2) * 60 - 80} ${Math.cos(i / 7 * Math.PI * 2) * 300} ${Math.sin(i / 7 * Math.PI * 2) * 100 + 60}`, stroke: '#1a0d1e', 'stroke-width': 28, fill: 'none', 'stroke-linecap': 'round' }));
    fronds.push([top, x + sgn * 120, y - 800]);
  });
  L.add(E.birds({ n: 5, x: 300, y: 820, speed: 40, color: '#2a1a4a', size: 18 }));
  S.update(t => { yacht.setAttribute('transform', `translate(${380 + t * 35},${1238 + Math.sin(t * 2) * 3})`); fronds.forEach(([g, x, y], i) => g.setAttribute('transform', `translate(${x},${y}) rotate(${Math.sin(t * 1.6 + i) * 4})`)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.12 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic');
});

/* s17 — pas l'homme capable : arrêt de bus sous la pluie, le bus passe */
CLIP.scene('s17', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#0f2236']));
  S.layer(.3).add(E.city({ y: 1280, color: '#0c1a2a', seed: 41, windows: C.sodium, lit: .2, maxH: 600 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1460, width: 3080, height: 800, fill: '#0d1622' }));
  L.add(h('rect', { x: -1000, y: 1440, width: 3080, height: 22, fill: '#2b3a4d' }));
  L.add(h('g', {}, [h('rect', { x: 330, y: 900, width: 460, height: 22, fill: '#2b3a4d' }), h('rect', { x: 340, y: 920, width: 10, height: 525, fill: '#2b3a4d' }), h('rect', { x: 770, y: 920, width: 10, height: 525, fill: '#2b3a4d' }), h('rect', { x: 350, y: 930, width: 420, height: 380, fill: '#7fb0e0', opacity: .12 }), h('rect', { x: 700, y: 950, width: 60, height: 140, fill: C.sodium, opacity: .8 })]));
  L.add(him(E, { x: 520, y: 1445, s: 1.0, pose: 'sad', action: 'breathe' }));
  const bus = h('g', {}, [h('rect', { x: 0, y: 0, width: 1100, height: 420, rx: 26, fill: '#1d4e89' }), ...[0, 1, 2, 3, 4].map(i => h('rect', { x: 60 + i * 200, y: 50, width: 160, height: 150, rx: 10, fill: '#ffe2a0', opacity: .85 })), h('circle', { cx: 160, cy: 420, r: 60, fill: '#05080f' }), h('circle', { cx: 900, cy: 420, r: 60, fill: '#05080f' })]);
  const busG = h('g', { filter: 'url(#whipblur)' }, [bus]); S.layer(1).add(busG);
  S.layer(1).add(E.rain({ n: 200, angle: 8, color: '#bcd', opacity: .4 }));
  S.update(t => { const x = -1300 + Math.max(0, t - .7) * 2600; bus.setAttribute('transform', `translate(${x},1020)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.07 }]], 'inOutSine');
});

/* s18 — celui qui déboule : phares qui foncent vers la caméra */
CLIP.scene('s18', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, '#0b1626', '#1b2a4a']));
  S.layer(.2).add(E.city({ y: 1000, color: '#0a1220', seed: 51, windows: C.sodium, lit: .25, maxH: 400 }));
  S.layer(.6).add(E.road({ horizon: 1000, color: '#11151c', line: C.sodium, speed: 4 }));
  const streaks = h('g', { stroke: '#ffd28a', 'stroke-linecap': 'round' }); const sl = [...Array(14)].map(() => { const l = h('line', { 'stroke-width': 4 }); streaks.appendChild(l); return l; }); S.layer(.8).add(streaks);
  const L = S.layer(1); const hl = [0, 1].map(() => { const g = h('g', {}, [h('circle', { r: 1, fill: '#fff6d8', filter: 'url(#glow)' }), h('circle', { r: 1, fill: '#fff', opacity: .25, filter: 'url(#bigblur)' })]); L.g.appendChild(g); return g; });
  S.update(t => {
    const k = Math.min(1, Math.max(0, t / 2.2)), z = Math.pow(k, 2.2), sep = 30 + z * 500, y = 1010 + z * 380, r = 8 + z * 120;
    hl.forEach((g, i) => { g.setAttribute('transform', `translate(${540 + (i ? 1 : -1) * sep / 2},${y})`); g.children[0].setAttribute('r', r); g.children[1].setAttribute('r', r * 3); });
    sl.forEach((l, i) => { const a = i / 14 * Math.PI * 2, ph = posmod(t * 2.2 + i * .37, 1), r0 = 120 + ph * 900; S.set(l, { x1: 540 + Math.cos(a) * r0, y1: 1000 + Math.sin(a) * r0 * .7, x2: 540 + Math.cos(a) * (r0 + 160 * ph), y2: 1000 + Math.sin(a) * (r0 + 160 * ph) * .7, opacity: ph }); });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.12 }]], 'inCubic', { shake: 4, shakeFreq: 12 });
});

/* s19 — en Féfé' : voiture de sport en bas de chez elle */
CLIP.scene('s19', S => {
  const { E, h } = S;
  nightSky(S, 0);
  S.layer(.2).add(tower(S, { x: 120, y: 1350, w: 840, h: 1100, color: '#10233a', lit: .2, seed: 61, cols: 6, pinkAt: [3, 4] }));
  S.layer(.4).add(E.lamp({ x: 120, y: 1520, height: 700, color: '#0a0f18', light: '#ffc27a' }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1500, width: 3080, height: 800, fill: '#0b111a' }));
  const car = h('g', {}, [
    h('path', { d: 'M -330 40 Q -320 -20 -240 -40 L -110 -60 Q -40 -130 80 -128 Q 190 -122 250 -60 L 330 -40 Q 360 -20 350 40 Z', fill: '#07090d' }),
    h('path', { d: 'M -90 -62 Q -30 -116 70 -114 Q 160 -110 210 -62 Z', fill: '#1b2638' }),
    h('path', { d: 'M -330 10 L 350 0', stroke: C.gold, 'stroke-width': 4 }),
    h('circle', { cx: -200, cy: 40, r: 52, fill: '#05070a', stroke: C.gold, 'stroke-width': 8 }), h('circle', { cx: 230, cy: 40, r: 52, fill: '#05070a', stroke: C.gold, 'stroke-width': 8 }),
    h('ellipse', { cx: 335, cy: -18, rx: 26, ry: 10, fill: '#fff6d8', filter: 'url(#glow)' }),
  ]);
  const beam = h('path', { d: 'M 340 -20 L 1400 -260 L 1400 260 Z', fill: E.gradientDef([[0, '#fff6d8', .5], [1, '#fff6d8', 0]], false) });
  const cg = h('g', {}, [beam, car]); L.g.appendChild(cg);
  S.update(t => { const k = S.Ease.outExpo(Math.min(1, Math.max(0, t / 1.1))); cg.setAttribute('transform', `translate(${-500 + k * 960},${1530}) rotate(${(1 - k) * -1.5})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.1 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'outCubic', { shake: 2 });
});

/* s19b — break instrumental : écrin, montre carrée en or */
CLIP.scene('s19b', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2a1426'], [1, '#07040a']], { cx: .5, cy: .55, r: .6 }));
  S.layer(.2).add(h('path', { d: 'M 430 -100 L 650 -100 L 980 1800 L 100 1800 Z', fill: E.gradientDef([[0, C.goldL, .35], [1, C.goldL, 0]]) }));
  S.layer(.3).add(E.rays({ x: 540, y: 980, n: 16, color: C.gold, opacity: .1, speed: 8 }));
  const L = S.layer(1);
  L.add(h('rect', { x: 230, y: 1220, width: 620, height: 260, rx: 24, fill: '#3a0f22' }));
  L.add(h('rect', { x: 270, y: 1240, width: 540, height: 70, rx: 18, fill: '#1a050f' }));
  const lid = h('g', {}, [h('rect', { x: 230, y: -90, width: 620, height: 90, rx: 24, fill: '#4a1430' }), h('rect', { x: 230, y: -14, width: 620, height: 14, fill: C.gold })]); L.g.appendChild(lid);
  const w = watch(S, 540, 1000, 1.25); L.g.appendChild(w.el);
  L.add(E.particles({ n: 60, color: C.goldL, size: [2, 6], area: [150, 500, 780, 1000], drift: [5, -25], glow: true, twinkle: 5 }));
  S.update(t => {
    const open = S.Ease.inOutCubic(Math.min(1, t / 1.6));
    lid.setAttribute('transform', `translate(0,1230) rotate(${-open * 70} 230 0)`);
    const rise = S.Ease.outCubic(Math.min(1, Math.max(0, (t - .8) / 2))), sc = 1.2 * (.4 + .6 * rise);
    const turn = Math.cos(Math.max(0, t - 2.2) * .9);
    w.el.setAttribute('transform', `translate(540,${1300 - rise * 360}) scale(${sc * (.3 + .7 * Math.abs(turn))},${sc})`);
    w.el.setAttribute('opacity', Math.min(1, t / .8));
    w.update(t);
  });
  S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: -40, zoom: 1.14 }]], 'inOutSine');
});

/* s20 — j'peux pas vivre sans toi : à genoux sous le réverbère */
CLIP.scene('s20', S => {
  const { E, h } = S;
  nightSky(S, 0, [C.night, '#0b1626', '#15253a']);
  S.layer(.3).add(E.city({ y: 1300, color: '#0b1828', seed: 71, windows: C.sodium, lit: .15, maxH: 500 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1460, width: 3080, height: 800, fill: '#0c1420' }));
  L.add(h('ellipse', { cx: 540, cy: 1480, rx: 420, ry: 40, fill: '#ffc27a', opacity: .18 }));
  L.add(E.lamp({ x: 520, y: 1470, height: 900, color: '#05080f', light: '#ffc27a', cone: .35 }));
  L.add(him(E, { x: 380, y: 1470, s: 1.15, pose: 'kneel', action: 'breathe', anim: (a, t) => { a.ua1 = 70 + Math.sin(t * 2) * 6; a.la1 = 95; a.head = -18; } }));
  L.add(her(E, { x: 700, y: 1470, s: 1.15, pose: 'stand', action: 'idle', facing: -1, anim: (a, t) => { a.head = -30 - Math.min(1, t) * 25; a.lean = -4; } }));
  S.layer(1).add(E.rain({ n: 120, angle: 6, color: '#ffe2b0', opacity: .3 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s21 — « que si tu… » : elle de dos, doigt levé, contre-jour rose */
CLIP.scene('s21', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#ffb3d1'], [.4, C.pink], [1, '#2a0616']], { cx: .55, cy: .5, r: .6 }));
  const L = S.layer(1);
  const hair = h('path', { fill: C.her }); L.g.appendChild(hair);
  L.add(h('circle', { cx: 540, cy: 980, r: 190, fill: C.her }));
  L.add(h('path', { d: 'M 120 1700 Q 160 1300 420 1240 L 660 1240 Q 920 1300 960 1700 Z', fill: C.her }));
  const arm = h('g', {}, [h('path', { d: 'M 0 0 L 30 -380 L 90 -380 L 70 0 Z', fill: C.her }), h('rect', { x: 34, y: -560, width: 44, height: 200, rx: 22, fill: C.her }), h('circle', { cx: 56, cy: -360, r: 62, fill: C.her })]);
  const armG = h('g'); armG.appendChild(arm); L.g.appendChild(armG);
  S.update(t => {
    let d = 'M 340 920 Q 360 760 540 760 Q 720 760 740 920'; for (let y = 920; y <= 1480; y += 40) d += ` L ${740 + Math.sin(y / 70 + t * 3) * 14 + (y - 920) * .12} ${y}`; d += ' L 330 1480'; for (let y = 1480; y >= 920; y -= 40) d += ` L ${340 - Math.sin(y / 70 + t * 3 + 1) * 14 - (y - 920) * .12} ${y}`;
    hair.setAttribute('d', d + ' Z');
    const k = S.Ease.outBack(Math.min(1, t / .5)); armG.setAttribute('transform', `translate(800,${1600 - k * 300}) rotate(${8 + Math.sin(t * 6) * 3})`);
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'outCubic');
});

/* s22 — une Cartier Santos : la montre en or, géante */
CLIP.scene('s22', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3a2a08'], [1, '#0a0602']], { cx: .5, cy: .6, r: .65 }));
  S.layer(.2).add(E.rays({ x: 540, y: 1080, n: 18, color: C.gold, opacity: .16, speed: 10 }));
  const L = S.layer(1); const w = watch(S, 540, 1080, 1.7); L.g.appendChild(w.el);
  const tag = h('g', {}, [h('line', { x1: 0, y1: 0, x2: 0, y2: 120, stroke: C.white, 'stroke-width': 3 }), h('path', { d: 'M -60 120 L 60 120 L 60 220 L -60 220 Z', fill: C.white }), h('circle', { cx: 0, cy: 138, r: 7, fill: '#3a2a08' })]);
  const tt = h('text', { x: 0, y: 200, 'text-anchor': 'middle', 'font-family': 'Bebas Neue', 'font-size': 52, fill: '#3a2a08' }); tt.textContent = '€€€€'; tag.appendChild(tt);
  const tagG = h('g'); tagG.appendChild(tag); L.g.appendChild(tagG);
  L.add(E.particles({ n: 50, color: C.goldL, size: [2, 6], area: [100, 600, 880, 1000], drift: [0, -20], glow: true, twinkle: 6 }));
  S.update(t => { w.update(t * 3); w.el.setAttribute('transform', `translate(540,1080) rotate(${Math.sin(t * 1.5) * 5}) scale(${1.7 * (1 + Math.exp(-t * 4) * .3)})`); tagG.setAttribute('transform', `translate(820,1250) rotate(${Math.sin(t * 3) * 14})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'outCubic');
});

/* s23 — tout le temps qu'on passe : banc, jour→nuit en accéléré */
CLIP.scene('s23', S => {
  const { E, h } = S;
  const sky = h('rect', { x: -1000, y: -1000, width: 3080, height: 4000 }); S.layer(0).add(sky);
  const sun = h('circle', { r: 70, fill: '#ffe0a0' }), moon = h('circle', { r: 55, fill: C.white }); S.layer(.1).add(sun); S.layer(.1).add(moon);
  S.layer(.3).add(E.city({ y: 1350, color: '#0f2236', seed: 81, windows: C.sodium, lit: .25, maxH: 500, flicker: false }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1450, width: 3080, height: 800, fill: '#1b2633' }));
  const shadow = h('path', { fill: '#000', opacity: .35 }); L.g.appendChild(shadow);
  L.add(h('g', { fill: '#2b1d14' }, [h('rect', { x: 270, y: 1340, width: 540, height: 22, rx: 6 }), h('rect', { x: 270, y: 1280, width: 540, height: 18, rx: 6 }), h('rect', { x: 300, y: 1360, width: 16, height: 100 }), h('rect', { x: 764, y: 1360, width: 16, height: 100 })]));
  L.add(him(E, { x: 450, y: 1500, s: .95, pose: 'sit', action: 'breathe' }));
  L.add(her(E, { x: 640, y: 1500, s: .9, pose: 'sit', action: 'breathe', facing: -1 }));
  S.update(t => {
    const k = Math.min(1, Math.max(0, t / S.dur)); const a = k * Math.PI;
    sky.setAttribute('fill', k < .5 ? S.mix('#7fb0e0', C.sodium, k * 2) : S.mix(C.sodium, C.petrol, (k - .5) * 2));
    S.set(sun, { cx: 100 + k * 1000, cy: 1300 - Math.sin(a) * 700, opacity: 1 - Math.max(0, k - .6) * 2.5 });
    S.set(moon, { cx: -200 + k * 900, cy: 1300 - Math.sin(Math.max(0, k - .4) / .6 * Math.PI / 2) * 900, opacity: Math.max(0, (k - .5) * 2) });
    const sx = (k - .5) * -900; shadow.setAttribute('d', `M 270 1460 L 810 1460 L ${810 + sx} 1560 L ${270 + sx} 1560 Z`);
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.05 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'linear');
});

/* s24 — sérieux sur l'dossier : tampon qui s'abat, feuilles qui s'envolent */
CLIP.scene('s24', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#1a2738' }));
  S.layer(.2).add(E.radial([[0, '#ffe2b0', .3], [1, '#ffe2b0', 0]], { cx: .5, cy: .7, r: .5 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -200, y: 1350, width: 1500, height: 900, fill: '#3a2618' }));
  for (let i = 0; i < 7; i++) L.add(h('rect', { x: 290 + (i % 2) * 10, y: 1330 - i * 34, width: 500, height: 30, rx: 4, fill: i % 2 ? '#d9c79a' : '#c9b582', stroke: '#8a7650', 'stroke-width': 2 }));
  L.add(h('rect', { x: 300, y: 1094, width: 480, height: 20, fill: '#e8dcc0' }));
  const stamp = h('g', {}, [h('rect', { x: -26, y: -260, width: 52, height: 160, rx: 20, fill: '#2b1d14' }), h('ellipse', { cx: 0, cy: -270, rx: 50, ry: 30, fill: '#2b1d14' }), h('rect', { x: -110, y: -100, width: 220, height: 70, rx: 10, fill: '#3b4a60' }), h('rect', { x: -110, y: -34, width: 220, height: 34, fill: C.sodium })]);
  const stG = h('g'); stG.appendChild(stamp); L.g.appendChild(stG);
  const sheets = [...Array(8)].map(() => { const r = h('rect', { x: -60, y: -80, width: 120, height: 160, fill: '#efe6d2' }); L.g.appendChild(r); return r; });
  const mark = h('rect', { x: 430, y: 1100, width: 220, height: 0, fill: C.sodium, opacity: .85 }); L.g.appendChild(mark);
  S.update(t => {
    const hits = [.5, 1.6, 2.6], last = hits.filter(x => x <= t).pop();
    let y; const per = t % 1.05; y = 1094 - (1 - Math.min(1, Math.abs(Math.sin(per / 1.05 * Math.PI)))) * 0 - Math.sin(per / 1.05 * Math.PI) * 380;
    stG.setAttribute('transform', `translate(540,${y}) rotate(${Math.sin(t * 3) * 3})`);
    mark.setAttribute('height', t > .5 ? 14 : 0);
    sheets.forEach((r, i) => { const u = last != null ? t - last : -1, ph = u >= 0 ? u + i * .02 : -1; const a = i / 8 * Math.PI - Math.PI; r.setAttribute('transform', ph < 0 ? 'translate(-500,-500)' : `translate(${540 + Math.cos(a) * ph * 700},${1080 + Math.sin(a) * ph * 600 + ph * ph * 300}) rotate(${ph * 300 * (i % 2 ? 1 : -1)})`); r.setAttribute('opacity', ph < 0 ? 0 : Math.max(0, 1 - ph * .9)); });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'inOutSine', { shake: 2, shakeFreq: 10 });
});

/* s25 — l'argent ça compte pas : pluie de billets, lui sous un parapluie */
CLIP.scene('s25', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([C.night, C.petrol, C.cite]));
  S.layer(.3).add(E.city({ y: 1350, color: '#0b1828', seed: 91, windows: C.gold, lit: .2, maxH: 500 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1470, width: 3080, height: 800, fill: '#0c1420' }));
  L.add(him(E, { x: 540, y: 1480, s: 1.15, pose: 'stand', action: 'breathe', anim: a => { a.ua1 = 150; a.la1 = 175; } }));
  L.add(h('g', { transform: `translate(${540 + 20},${1480 - 1.15 * 470})` }, [h('path', { d: 'M -230 0 Q -210 -200 0 -230 Q 210 -200 230 0 Q 175 -30 115 0 Q 58 -30 0 0 Q -58 -30 -115 0 Q -175 -30 -230 0 Z', fill: '#0a0f18', stroke: C.gold, 'stroke-width': 3 }), h('line', { x1: 0, y1: 0, x2: 0, y2: 220, stroke: '#0a0f18', 'stroke-width': 10 })]));
  const bills = [...Array(26)].map(() => { const b = bill(h); L.g.appendChild(b); return b; });
  S.update(t => bills.forEach((b, i) => { const ph = posmod(t * .55 + i * .61803, 1), x = posmod(i * 137, 1000) + 40 + Math.sin(ph * 8 + i) * 50; let y = -200 + ph * 1900; if (Math.abs(x - 560) < 230 && y > 700) y = 700 + (y - 700) * .1; b.setAttribute('transform', `translate(${x},${y}) rotate(${ph * 500 + i * 40}) scale(${.7 + (i % 3) * .2},${Math.cos(ph * 12 + i) * .8})`); b.setAttribute('opacity', Math.abs(x - 560) < 230 && y >= 700 ? 0 : 1); }));
  S.camera([[0, { x: 0, y: -30, zoom: 1.0 }], [1, { x: 0, y: 10, zoom: 1.07 }]], 'inOutSine');
});

/* s26 — à quel point j't'ai aimée : polaroid qui se décolore et tombe */
CLIP.scene('s26', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#5a3a22' }));
  const dots = h('g', { fill: '#4a2e1a' }); const r = S.rng; for (let i = 0; i < 400; i++) dots.appendChild(h('circle', { cx: r() * 1600 - 260, cy: r() * 2400 - 200, r: r() * 6 + 2 })); S.layer(0).add(dots);
  const L = S.layer(1);
  const photoSky = h('rect', { x: -230, y: -260, width: 460, height: 460 });
  const pol = h('g', {}, [h('rect', { x: -260, y: -290, width: 520, height: 640, fill: '#f4f1ea' }), photoSky, h('circle', { cx: 0, cy: 80, r: 110, fill: '#ffe0a0', opacity: .9 }), h('rect', { x: -230, y: 120, width: 460, height: 80, fill: '#2a1a2a' })]);
  const f1 = him(E, { x: -60, y: 175, s: .5, action: 'idle' }), f2 = her(E, { x: 60, y: 175, s: .48, action: 'idle', facing: -1, outline: null });
  pol.append(f1.el, f2.el); S.items.push(f1, f2);
  const gray = h('rect', { x: -230, y: -260, width: 460, height: 460, fill: '#888', opacity: 0, style: 'mix-blend-mode:saturation' }); pol.appendChild(gray);
  const pin = h('circle', { cx: 540, cy: 700, r: 24, fill: C.pink }); const polG = h('g'); polG.appendChild(pol); L.g.append(polG, pin);
  S.update(t => {
    const fade = Math.min(1, t / 2.2); photoSky.setAttribute('fill', S.mix('#ff8aa8', '#8a8590', fade)); gray.setAttribute('opacity', fade);
    const u = Math.max(0, t - 1.6);
    polG.setAttribute('transform', `translate(${540 + Math.sin(u * 3) * 80 * Math.min(1, u)},${1080 + u * u * 500}) rotate(${-4 + Math.sin(u * 4) * 25 * Math.min(1, u * 2)}) scale(1.3)`);
    pin.setAttribute('opacity', u > 0 ? 0 : 1);
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.05 }], [1, { x: 0, y: 40, zoom: 1.0 }]], 'inOutSine');
});

/* s27 — j'lui souhaite le meilleur : il s'éloigne à l'aube */
CLIP.scene('s27', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#0b1626'], [.55, '#3a4a6a'], [.85, '#c98a7a'], [1, '#ffcf9a']]));
  S.layer(.2).add(tower(S, { x: 560, y: 1460, w: 420, h: 1150, color: '#13233a', lit: .05, seed: 101, cols: 3, pinkAt: [4, 2] }));
  S.layer(.3).add(E.city({ y: 1460, color: '#101d30', seed: 103, windows: '#ffd28a', lit: .05, maxH: 350, x1: 560 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -1000, y: 1460, width: 3080, height: 800, fill: '#141f30' }));
  const m = him(E, { s: 1.0, action: 'walk', speed: .7, pose: { lean: 4, head: 10, ua1: 10, la1: 40, ua2: -5, la2: 30, th1: 0, sh1: 0, th2: 0, sh2: 0 }, facing: -1, path: [[0, [520, 1470]], [2.4, [200, 1470]]] });
  L.add(m);
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: 20, y: 0, zoom: 1.0 }]], 'linear');
});

/* s28 — souhaite-moi la richesse : elle dans l'or, pluie de pièces */
CLIP.scene('s28', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#f3dc8a'], [.45, C.gold], [1, '#3a2a08']], { cx: .5, cy: .62, r: .7 }));
  S.layer(.2).add(E.rays({ x: 540, y: 1100, n: 20, color: '#fff3c4', opacity: .2, speed: 12 }));
  const L = S.layer(1);
  L.add(h('ellipse', { cx: 540, cy: 1500, rx: 520, ry: 120, fill: C.goldD }));
  for (let i = 0; i < 18; i++) L.add(h('ellipse', { cx: 140 + (i * 53) % 800, cy: 1460 + (i % 3) * 22, rx: 46, ry: 14, fill: i % 2 ? C.goldL : C.gold, stroke: C.goldD, 'stroke-width': 3 }));
  const g = her(E, { x: 540, y: 1470, s: 1.45, pose: 'reach', action: 'reach', color: '#2a1a05', hairColor: '#2a1a05', outline: '#fff3c4', speed: 1.4 });
  L.add(g);
  const wr = h('g', {}, [h('rect', { x: -22, y: -22, width: 44, height: 44, rx: 9, fill: C.gold, stroke: '#fff3c4', 'stroke-width': 4 }), h('circle', { r: 50, fill: '#fff3c4', opacity: .5, filter: 'url(#bigblur)' })]); L.g.appendChild(wr);
  const coins = [...Array(30)].map((_, i) => { const c = h('ellipse', { rx: 26, ry: 26, fill: i % 2 ? C.goldL : C.gold, stroke: C.goldD, 'stroke-width': 4 }); L.g.appendChild(c); return c; });
  S.update(t => {
    const k = S.Ease.inOutSine(Math.min(1, t * 1.4 / 2.5)); wr.setAttribute('transform', `translate(${540 + 30 * k},${1470 - 1.45 * (220 + 190 * k)})`);
    coins.forEach((c, i) => { const ph = posmod(t * .7 + i * .61803, 1); S.set(c, { cx: posmod(i * 211, 1000) + 40, cy: -100 + ph * 1650, ry: 26 * Math.abs(Math.cos(t * 6 + i)) + 3 }); });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.1 }]], 'inOutSine');
});
