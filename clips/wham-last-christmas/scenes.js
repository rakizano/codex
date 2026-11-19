/* Wham! — « Last Christmas » (son TikTok fourni, 60 s) — scènes en papier découpé
 * Univers : carte de Noël pop-up années 80. Lui = vert sapin, elle = rose poudré, le cœur = rose.
 * Aucune couleur rouge dans les décors (réservée aux mots-clés). Animations pures en t.
 */
const P = { night: '#10324a', night2: '#1b4a66', snow: '#f6f2ea', frost: '#a9d3e6', mint: '#8fd3c1', pink: '#f2a7b8', pinkD: '#d77f97',
  gold: '#e9c46a', goldD: '#b8913a', pine: '#1f5e4a', pineD: '#123f31', wood: '#6b4a3a', warm: '#ffd98f' };
const pmod = (a, n) => ((a % n) + n) % n;
function cut(S) { // ombre portée « papier découpé »
  if (!document.getElementById('cutshadow')) S.defs.appendChild(S.h('filter', { id: 'cutshadow', x: '-10%', y: '-10%', width: '120%', height: '130%' }, [S.h('feDropShadow', { dx: 0, dy: 10, stdDeviation: 8, 'flood-color': '#06182a', 'flood-opacity': .35 })]));
  return 'url(#cutshadow)';
}
const him = (E, o) => E.figure(Object.assign({ color: P.pine, coat: P.pine, hat: 'cap', hatColor: P.pineD, bodyWidth: 1.05 }, o));
const her = (E, o) => E.figure(Object.assign({ color: P.pinkD, coat: P.pink, hair: 'long', hairColor: '#7a4a5a', bodyWidth: .9 }, o));
function heartD(cx, cy, r) { const p = (x, y) => `${(cx + x * r).toFixed(1)} ${(cy + y * r).toFixed(1)}`; return `M ${p(0, .55)} C ${p(-1.3, -.3)} ${p(-.65, -1.15)} ${p(0, -.5)} C ${p(.65, -1.15)} ${p(1.3, -.3)} ${p(0, .55)} Z`; }
function hills(S, d, y, color, seed, amp = 60) { const it = S.E.hills({ y, color, seed, amp }); it.el.setAttribute('filter', cut(S)); S.layer(d).add(it); return it; }
function pine(h, x, y, s, color = P.pine) {
  const g = h('g', { transform: `translate(${x},${y}) scale(${s})` });
  [[0, 200, 130], [-90, 160, 110], [-170, 120, 85]].forEach(([dy, w, hh]) => { g.appendChild(h('path', { d: `M ${-w / 2} ${dy} L 0 ${dy - hh * 1.4} L ${w / 2} ${dy} Z`, fill: color })); g.appendChild(h('path', { d: `M ${-w * .28} ${dy - hh * .55} L 0 ${dy - hh * 1.4} L ${w * .28} ${dy - hh * .55} Q 0 ${dy - hh * .4} ${-w * .28} ${dy - hh * .55} Z`, fill: P.snow })); });
  g.appendChild(h('rect', { x: -14, y: 0, width: 28, height: 40, fill: P.wood })); return g;
}
function house(h, x, y, w, hh, wall, lit = true) {
  const g = h('g');
  g.appendChild(h('rect', { x, y: y - hh, width: w, height: hh, fill: wall }));
  g.appendChild(h('path', { d: `M ${x - 20} ${y - hh} L ${x + w / 2} ${y - hh - w * .45} L ${x + w + 20} ${y - hh} Z`, fill: P.night2 }));
  g.appendChild(h('path', { d: `M ${x - 20} ${y - hh} L ${x + w / 2} ${y - hh - w * .45} L ${x + w + 20} ${y - hh} Q ${x + w / 2} ${y - hh - w * .3} ${x - 20} ${y - hh} Z`, fill: P.snow }));
  if (lit) { g.appendChild(h('rect', { x: x + w * .2, y: y - hh * .7, width: w * .25, height: hh * .3, fill: P.warm })); g.appendChild(h('rect', { x: x + w * .58, y: y - hh * .7, width: w * .25, height: hh * .3, fill: P.warm, opacity: .8 })); }
  return g;
}
function gift(h, s = 1) {
  return h('g', { transform: `scale(${s})` }, [h('rect', { x: -70, y: -60, width: 140, height: 120, rx: 8, fill: P.mint }), h('rect', { x: -12, y: -60, width: 24, height: 120, fill: P.gold }), h('rect', { x: -78, y: -78, width: 156, height: 30, rx: 6, fill: '#6fbfa9' }), h('rect', { x: -12, y: -78, width: 24, height: 30, fill: P.gold }),
    h('path', { d: 'M 0 -78 Q -40 -130 -50 -90 Q -45 -70 0 -78 Q 40 -130 50 -90 Q 45 -70 0 -78', fill: P.gold })]);
}
const snowy = (S, d = 1, o = {}) => S.layer(d).add(S.E.snow(Object.assign({ n: 110, color: P.snow, size: [2, 6], drift: [12, 70], opacity: .85, seed: S.index + 3 }, o)));

/* s00 — rely on : pont enneigé, main dans la main */
CLIP.scene('s00', S => {
  const { E, h } = S; cut(S);
  S.layer(0).add(E.sky([[0, '#0b2238'], [.7, P.night], [1, P.night2]]));
  S.layer(.05).add(E.stars({ n: 80, seed: 2, color: P.snow }));
  S.layer(.1).add(E.moon({ x: 800, y: 560, r: 70, color: P.snow, bg: '#0e2a42', phase: .25 }));
  hills(S, .25, 1150, '#2a5b7a', 4, 50);
  const V = S.layer(.4); [[120, 1160, 120, 130, '#3d6f8f'], [300, 1170, 150, 170, '#4a7d9c'], [700, 1160, 140, 150, '#3d6f8f'], [860, 1170, 110, 120, '#4a7d9c']].forEach(a => V.add(house(h, ...a))); V.g.setAttribute('filter', cut(S));
  const L = S.layer(1);
  L.add(h('path', { d: 'M -200 1450 Q 540 1200 1280 1450 L 1280 1500 Q 540 1260 -200 1500 Z', fill: P.snow, filter: cut(S) }));
  L.add(h('path', { d: 'M -200 1500 Q 540 1260 1280 1500 L 1280 2400 L -200 2400 Z', fill: '#e3eef3' }));
  const rail = h('g', { stroke: P.snow, 'stroke-width': 8 }); for (let x = -100; x < 1200; x += 80) { const y = 1450 - 250 * (1 - Math.pow((x - 540) / 740, 2)); rail.appendChild(h('line', { x1: x, y1: y, x2: x, y2: y - 70 })); } L.add(rail);
  L.add(E.lamp({ x: 860, y: 1260, height: 560, color: P.night, light: P.warm, cone: .3 }));
  L.add(him(E, { s: .85, action: 'walk', speed: .7, seed: 5, path: [[0, [330, 1215]], [4, [520, 1205]]] }));
  L.add(her(E, { s: .78, action: 'walk', speed: .7, seed: 5, path: [[0, [420, 1215]], [4, [610, 1205]]] }));
  snowy(S);
  S.camera([[0, { x: 30, y: 0, zoom: 1.05 }], [1, { x: -30, y: -10, zoom: 1.12 }]], 'inOutSine');
});

/* s01 — shoulder to cry on : le banc sous la neige */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, P.night], [1, '#2d6585']]));
  S.layer(.2).add(pine(h, 140, 1150, 1.3, '#2a5b7a')); S.layer(.2).add(pine(h, 930, 1180, 1.1, '#2a5b7a'));
  hills(S, .4, 1320, '#d5e6ee', 9, 30);
  const L = S.layer(1);
  L.add(h('rect', { x: -300, y: 1480, width: 1700, height: 900, fill: P.snow }));
  L.add(h('g', { filter: cut(S) }, [h('rect', { x: 260, y: 1340, width: 560, height: 24, rx: 8, fill: P.wood }), h('rect', { x: 260, y: 1270, width: 560, height: 22, rx: 8, fill: P.wood }), h('rect', { x: 290, y: 1360, width: 18, height: 130, fill: P.wood }), h('rect', { x: 772, y: 1360, width: 18, height: 130, fill: P.wood }), h('rect', { x: 255, y: 1262, width: 570, height: 10, rx: 5, fill: P.snow })]));
  L.add(him(E, { x: 470, y: 1530, s: .95, pose: 'sit', action: 'breathe', facing: 1 }));
  L.add(her(E, { x: 600, y: 1530, s: .88, pose: 'sit', action: 'breathe', facing: -1, anim: (a, t) => { a.lean = -22 + Math.sin(t * 2) * 2; a.head = -20; } }));
  const drops = [0, 1, 2].map(i => { const d = h('path', { d: 'M 0 -12 Q 8 2 0 8 Q -8 2 0 -12 Z', fill: P.frost }); L.g.appendChild(d); return d; });
  S.update(t => drops.forEach((d, i) => { const ph = pmod(t * .8 + i / 3, 1); d.setAttribute('transform', `translate(${598 + i * 4},${1185 + ph * 120})`); d.setAttribute('opacity', 1 - ph); }));
  snowy(S, 1, { n: 140, drift: [6, 50] });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.1 }]], 'inOutSine');
});

/* s02 — fire in his heart : cheminée, cœur qui brûle */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#3b2a3a' }));
  const wall = h('g', { opacity: .25 }); for (let x = -400; x < 1500; x += 120) wall.appendChild(h('rect', { x, y: -800, width: 60, height: 3600, fill: '#4b3646' })); S.layer(0).add(wall);
  S.layer(.2).add(E.radial([[0, P.warm, .55], [1, P.warm, 0]], { cx: .5, cy: .72, r: .45 }));
  const L = S.layer(.8);
  L.add(h('g', { filter: cut(S) }, [h('rect', { x: 230, y: 1050, width: 620, height: 420, fill: '#c9b8a6' }), h('rect', { x: 200, y: 1020, width: 680, height: 50, rx: 8, fill: P.snow }), h('rect', { x: 330, y: 1150, width: 420, height: 320, fill: '#2a1a22' })]));
  const flames = [0, 1, 2, 3].map(i => { const f = h('path', { fill: [P.gold, P.warm, '#f6a05a', P.gold][i] }); L.g.appendChild(f); return f; });
  [[350, 990], [520, 985], [700, 990]].forEach(([x, y]) => L.add(h('g', { transform: `translate(${x},${y})` }, [h('path', { d: 'M -18 30 L -14 -40 L 14 -40 L 18 30 Z', fill: P.mint }), h('rect', { x: -22, y: -46, width: 44, height: 12, fill: P.gold })])));
  const F = S.layer(1);
  F.add(him(E, { x: 540, y: 1900, s: 1.9, pose: 'stand', action: 'breathe', color: '#1a1420', coat: '#1a1420', hat: null }));
  const hg = h('path', { d: heartD(540, 1330, 70), fill: P.pink }), hglow = h('circle', { cx: 540, cy: 1320, r: 120, fill: P.gold, opacity: .4, filter: 'url(#bigblur)' });
  F.g.append(hglow, hg);
  S.update(t => {
    flames.forEach((f, i) => { const x0 = 400 + i * 90, n = S.noise(t * 4 + i, i); f.setAttribute('d', `M ${x0 - 50} 1470 Q ${x0 - 40 + n * 20} ${1330 - i * 10} ${x0 + n * 30} ${1230 + Math.sin(t * 7 + i) * 25} Q ${x0 + 40} ${1330} ${x0 + 50} 1470 Z`); });
    const s = 1 + Math.max(0, Math.sin(t * 6.5)) * .1; hg.setAttribute('transform', `translate(540,1330) scale(${s}) translate(-540,-1330)`); hglow.setAttribute('opacity', .3 + .2 * Math.sin(t * 6.5));
  });
  S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.08 }]], 'inOutSine');
});

/* s03 — a man undercover : l'homme caché derrière son journal */
CLIP.scene('s03', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#0b2238'], [1, P.night]]));
  const V = S.layer(.3); [[-40, 1300, 260, 520, '#24506d', true], [260, 1300, 220, 420, '#2d5f7d', true], [520, 1300, 300, 600, '#24506d', true], [860, 1300, 260, 460, '#2d5f7d', true]].forEach(a => V.add(house(h, ...a))); V.g.setAttribute('filter', cut(S));
  const L = S.layer(1);
  L.add(h('rect', { x: -300, y: 1300, width: 1700, height: 900, fill: '#dde9ef' }));
  L.add(E.lamp({ x: 260, y: 1320, height: 700, color: P.night, light: P.warm, cone: .35 }));
  L.add(him(E, { x: 600, y: 1470, s: 1.25, pose: 'stand', action: 'breathe', hat: 'bowler', hatColor: P.pineD, anim: a => { a.ua1 = 70; a.la1 = 110; a.ua2 = 60; a.la2 = 100; } }));
  const paper = h('g', { filter: cut(S) }, [h('rect', { x: -120, y: -90, width: 240, height: 180, fill: P.snow }), ...[0, 1, 2, 3, 4].map(i => h('rect', { x: -100, y: -70 + i * 30, width: i % 2 ? 90 : 200, height: 12, fill: '#9aa8b0' })), h('rect', { x: 10, y: -70, width: 90, height: 70, fill: '#c3ccd2' })]);
  const pg = h('g'); pg.appendChild(paper); L.g.appendChild(pg);
  const eyes = h('g', {}, [h('circle', { cx: -14, cy: 0, r: 5, fill: P.snow }), h('circle', { cx: 14, cy: 0, r: 5, fill: P.snow })]); L.g.appendChild(eyes);
  S.update(t => { const peek = Math.max(0, Math.sin(t * 2.4 - 1)) * 40; pg.setAttribute('transform', `translate(${640},${1470 - 1.25 * 330 + peek})`); eyes.setAttribute('transform', `translate(${606 + Math.sin(t * 3) * 4},${1470 - 1.25 * 395})`); eyes.setAttribute('opacity', peek > 15 ? 1 : 0); });
  snowy(S, 1, { n: 90 });
  S.camera([[0, { x: -20, y: 0, zoom: 1.08 }], [1, { x: 20, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s04 — tore me apart : le cœur de papier déchiré */
CLIP.scene('s04', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#24506d'], [1, '#081a2b']], { cx: .5, cy: .6, r: .65 }));
  S.layer(.2).add(E.snow({ n: 60, color: P.frost, opacity: .4, seed: 41 }));
  const L = S.layer(1); const cx = 540, cy = 1060, r = 300;
  const tear = 'M 540 900 L 520 950 L 560 1000 L 515 1050 L 565 1100 L 525 1150 L 560 1200 L 540 1260';
  ['left', 'right'].forEach((side, i) => {
    const id = 'half' + i; S.defs.appendChild(h('clipPath', { id }, [h('path', { d: side === 'left' ? `M -100 0 L 540 0 ${tear.replace('M 540 900', 'L 540 900')} L 540 1920 L -100 1920 Z` : `M 1200 0 L 540 0 ${tear.replace('M 540 900', 'L 540 900')} L 540 1920 L 1200 1920 Z` })]));
    const g = h('g', { 'clip-path': `url(#${id})` }, [h('path', { d: heartD(cx, cy, r), fill: P.pink }), h('path', { d: heartD(cx, cy, r * .8), fill: 'none', stroke: P.snow, 'stroke-width': 6, 'stroke-dasharray': '18 14', opacity: .7 })]);
    const w = h('g', { filter: cut(S) }, [g]); L.g.appendChild(w); S[side] = w;
  });
  S.update(t => { const k = S.Ease.inOutCubic(Math.min(1, Math.max(0, (t - .5) / 3))); S.left.setAttribute('transform', `translate(${-k * 170},${k * 60}) rotate(${-k * 14} 540 1260)`); S.right.setAttribute('transform', `translate(${k * 170},${k * 90}) rotate(${k * 16} 540 1260)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'inOutSine');
});

/* s05 — Ooh-hoo : aurore boréale */
CLIP.scene('s05', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#06142a'], [.6, P.night], [1, '#1d4a5e']]));
  S.layer(.05).add(E.stars({ n: 200, seed: 51, color: P.snow }));
  const A = S.layer(.15); const bands = [[P.mint, 650], [P.pink, 780], ['#9fd8ff', 900]].map(([c, y]) => { const p = h('path', { fill: c, opacity: .45, filter: 'url(#bigblur)' }); A.g.appendChild(p); return [p, y]; });
  const star = h('line', { stroke: P.snow, 'stroke-width': 5, 'stroke-linecap': 'round' }); S.layer(.1).add(star);
  hills(S, .4, 1300, '#cfe2ea', 13, 70); hills(S, .7, 1450, P.snow, 17, 50);
  S.layer(.8).add(pine(h, 180, 1500, .9, P.pineD)); S.layer(.8).add(pine(h, 880, 1520, 1.1, P.pineD));
  S.update(t => {
    bands.forEach(([p, y], i) => { let d = `M -200 ${y + 300}`; for (let x = -200; x <= 1300; x += 50) d += ` L ${x} ${y + Math.sin(x / 230 + t * (1 + i * .3) + i) * 80 + S.noise(x / 400 + t * .3, i) * 60}`; for (let x = 1300; x >= -200; x -= 50) d += ` L ${x} ${y - 180 + Math.sin(x / 200 + t + i) * 50}`; p.setAttribute('d', d + ' Z'); });
    const k = Math.min(1, Math.max(0, (t - .6) / .8)); star.setAttribute('x1', 900 - k * 600); star.setAttribute('y1', 300 + k * 260); star.setAttribute('x2', 900 - k * 600 + 90); star.setAttribute('y2', 300 + k * 260 - 40); star.setAttribute('opacity', k > 0 && k < 1 ? 1 : 0);
  });
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -30, zoom: 1.08 }]], 'inOutSine');
});

/* s06 — a real love : patinoire et guirlandes */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#0b2238'], [1, '#24506d']]));
  hills(S, .3, 1100, '#2a5b7a', 61, 40);
  const L = S.layer(.6); const bulbs = [];
  const p = h('path', { d: 'M -100 760 Q 540 980 1180 760', stroke: '#0b2238', 'stroke-width': 3, fill: 'none' }); L.g.appendChild(p);
  for (let i = 0; i <= 18; i++) { const u = i / 18, x = -100 + 1280 * u, y = 760 + 4 * 220 * u * (1 - u) * .5 * 2 * .5; const b = h('circle', { cx: x, cy: 760 + 880 * u * (1 - u) * .25 * 1, r: 10, fill: [P.gold, P.pink, P.mint][i % 3], filter: 'url(#glow)' }); L.g.appendChild(b); bulbs.push(b); }
  const R = S.layer(1);
  R.add(h('ellipse', { cx: 540, cy: 1420, rx: 760, ry: 260, fill: '#bfe0ec', filter: cut(S) }));
  R.add(h('ellipse', { cx: 540, cy: 1420, rx: 700, ry: 220, fill: '#d8eef5' }));
  const marks = h('path', { d: 'M 200 1420 Q 540 1300 880 1440', stroke: P.snow, 'stroke-width': 4, fill: 'none', opacity: .8 }); R.add(marks);
  const pair = h('g'); R.g.appendChild(pair);
  const a = him(E, { x: 0, y: 0, s: .9, pose: { lean: 18, head: -5, ua1: 60, la1: 80, ua2: -40, la2: -30, th1: 30, sh1: -20, th2: -25, sh2: 0 }, action: 'none', color: '#2e7a63', coat: '#2e7a63' });
  const b = her(E, { x: 120, y: 0, s: .85, pose: { lean: 18, head: -10, ua1: -60, la1: -40, ua2: 50, la2: 70, th1: -20, sh1: 0, th2: 35, sh2: -30 }, action: 'none', color: P.pinkD, coat: '#f7c3cf' });
  pair.append(a.el, b.el); a.update(0); b.update(0);
  S.update(t => { const ang = t * .9; pair.setAttribute('transform', `translate(${540 + Math.cos(ang) * 280},${1420 + Math.sin(ang) * 90}) scale(${Math.cos(ang) > 0 ? 1 : -1},1)`); a.update(t); b.update(t); bulbs.forEach((bb, i) => bb.setAttribute('opacity', .5 + .5 * Math.sin(t * 5 + i))); });
  snowy(S, 1, { n: 70 });
  S.camera([[0, { x: 0, y: 0, zoom: 1.05 }], [1, { x: 0, y: -10, zoom: 1.0 }]], 'inOutSine');
});

/* s07 — never fool me again : la boule à neige secouée */
CLIP.scene('s07', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2d6585'], [1, '#0b2238']], { cx: .5, cy: .6, r: .7 }));
  const L = S.layer(1); const G = h('g'); L.g.appendChild(G);
  const id = 'globeclip'; S.defs.appendChild(h('clipPath', { id }, [h('circle', { cx: 0, cy: 0, r: 300 })]));
  const inside = h('g', { 'clip-path': `url(#${id})` }, [h('rect', { x: -320, y: -320, width: 640, height: 640, fill: '#9fcde0' }), h('ellipse', { cx: 0, cy: 230, rx: 320, ry: 110, fill: P.snow })]);
  inside.appendChild(pine(h, -130, 210, .55, P.pine)); inside.appendChild(house(h, 40, 220, 150, 120, '#e9c46a'));
  const fig = her(E, { x: -20, y: 235, s: .42, action: 'idle' }); inside.appendChild(fig.el);
  const flakes = [...Array(70)].map((_, i) => { const c = h('circle', { r: 3 + (i % 3) * 2, fill: P.snow }); inside.appendChild(c); return c; });
  G.append(h('path', { d: 'M -220 250 L 220 250 L 260 420 L -260 420 Z', fill: P.wood, filter: cut(S) }), h('rect', { x: -270, y: 400, width: 540, height: 40, rx: 10, fill: '#5a3d30' }), inside,
    h('circle', { r: 300, fill: 'none', stroke: P.snow, 'stroke-width': 10, opacity: .7 }), h('path', { d: 'M -200 -150 Q -150 -230 -60 -260', stroke: '#fff', 'stroke-width': 20, 'stroke-linecap': 'round', fill: 'none', opacity: .5 }));
  S.update(t => {
    const shake = Math.sin(t * 14) * Math.exp(-((t % 1.4) * 3)) * 9; G.setAttribute('transform', `translate(540,${1060}) rotate(${shake})`);
    fig.update(t);
    flakes.forEach((c, i) => { const ph = pmod(t * .25 + i * .618, 1), sw = Math.sin(t * 3 + i) * 120 * Math.exp(-(t % 1.4) * 1.5); c.setAttribute('cx', ((i * 97) % 560) - 280 + sw); c.setAttribute('cy', -280 + ph * 520); });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'inOutSine');
});

/* s08 — I gave you my heart : le sapin, le paquet s'ouvre */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#1b3d55' }));
  S.layer(.1).add(E.radial([[0, P.warm, .35], [1, P.warm, 0]], { cx: .5, cy: .55, r: .5 }));
  const T = S.layer(.6); const tr = pine(h, 540, 1420, 2.6, P.pine); tr.setAttribute('filter', cut(S)); T.add(tr);
  const orn = [[440, 1180, P.gold], [640, 1230, P.pink], [520, 1000, P.mint], [380, 1360, P.pink], [700, 1380, P.gold], [600, 860, P.gold]].map(([x, y, c]) => { const o = h('circle', { cx: x, cy: y, r: 22, fill: c }); T.g.appendChild(o); return o; });
  const star = h('path', { d: 'M 0 -60 L 16 -18 L 60 -18 L 24 8 L 38 52 L 0 26 L -38 52 L -24 8 L -60 -18 L -16 -18 Z', fill: P.gold, filter: 'url(#glow)' }); const sg = h('g', { transform: 'translate(540,560)' }, [star]); T.g.appendChild(sg);
  const L = S.layer(1);
  L.add(h('rect', { x: -300, y: 1500, width: 1700, height: 900, fill: '#e3eef3' }));
  const box = h('g', { transform: 'translate(540,1470)' }); box.appendChild(h('rect', { x: -110, y: -100, width: 220, height: 160, rx: 8, fill: P.mint })); box.appendChild(h('rect', { x: -15, y: -100, width: 30, height: 160, fill: P.gold }));
  const lid = h('g', {}, [h('rect', { x: -125, y: -26, width: 250, height: 44, rx: 8, fill: '#6fbfa9' }), h('rect', { x: -15, y: -26, width: 30, height: 44, fill: P.gold })]); box.appendChild(lid); L.g.appendChild(box);
  const hp = h('path', { d: heartD(0, 0, 70), fill: P.pink }); const hg = h('g', {}, [h('circle', { r: 90, fill: P.pink, opacity: .35, filter: 'url(#bigblur)' }), hp]); L.g.appendChild(hg);
  S.update(t => {
    const o = S.Ease.outBack(Math.min(1, Math.max(0, (t - .4) / .6))); lid.setAttribute('transform', `translate(${o * 150},${-100 - o * 120}) rotate(${o * 35})`);
    const r = S.Ease.outCubic(Math.min(1, Math.max(0, (t - .8) / 2))); hg.setAttribute('transform', `translate(540,${1380 - r * 520}) scale(${.4 + r * .8 + Math.max(0, Math.sin(t * 6.5)) * .06})`); hg.setAttribute('opacity', Math.min(1, r * 4));
    orn.forEach((c, i) => c.setAttribute('opacity', .7 + .3 * Math.sin(t * 4 + i))); sg.setAttribute('transform', `translate(540,560) rotate(${Math.sin(t * 2) * 8}) scale(${1 + Math.sin(t * 6.5) * .05})`);
  });
  snowy(S, 1, { n: 50, opacity: .5 });
  S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: -40, zoom: 1.06 }]], 'inOutSine');
});

/* s09 — the very next day : la page « 24 DÉC » s'arrache */
CLIP.scene('s09', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#8fc3dc'], [.6, '#f7d9c4'], [1, '#fff1d6']]));
  S.layer(.1).add(E.sun({ x: 540, y: 1250, r: 140, color: '#ffe4a8', glow: .6 }));
  hills(S, .3, 1250, P.snow, 91, 50);
  const L = S.layer(1);
  const cal = (n, c) => { const g = h('g', { filter: cut(S) }, [h('rect', { x: -200, y: -230, width: 400, height: 460, rx: 14, fill: P.snow }), h('rect', { x: -200, y: -230, width: 400, height: 110, rx: 14, fill: c }), h('rect', { x: -200, y: -150, width: 400, height: 30, fill: c })]);
    const m = h('text', { x: 0, y: -150, 'text-anchor': 'middle', 'font-family': 'Righteous', 'font-size': 64, fill: P.snow }); m.textContent = 'DÉC'; g.appendChild(m);
    const d = h('text', { x: 0, y: 140, 'text-anchor': 'middle', 'font-family': 'Righteous', 'font-size': 220, fill: P.night }); d.textContent = n; g.appendChild(d); return g; };
  const back = h('g', { transform: 'translate(540,1000)' }, [cal('25', P.pine)]), front = h('g'); front.appendChild(cal('24', P.night2));
  L.g.append(h('rect', { x: 330, y: 760, width: 420, height: 16, rx: 8, fill: P.goldD }), back, front);
  S.update(t => { const k = S.Ease.inCubic(Math.min(1, Math.max(0, (t - .7) / 1.2))); front.setAttribute('transform', `translate(${540 + k * 300},${1000 + k * 600}) rotate(${k * 50}) scale(${1 - k * .2})`); front.setAttribute('opacity', 1 - Math.max(0, k - .7) / .3); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.05 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s10 — you gave it away : le paquet dévale sur une luge */
CLIP.scene('s10', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#9fcde0'], [1, '#e8f3f7']]));
  S.layer(.2).add(pine(h, 900, 1000, .8, '#5b8fa8')); S.layer(.2).add(pine(h, 120, 980, .7, '#5b8fa8'));
  const L = S.layer(1);
  L.add(h('path', { d: 'M -200 900 Q 300 950 600 1250 Q 900 1500 1300 1560 L 1300 2400 L -200 2400 Z', fill: P.snow, filter: cut(S) }));
  const sled = h('g', {}, [h('path', { d: 'M -110 40 L 110 40 Q 150 40 150 10', stroke: P.goldD, 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }), h('rect', { x: -100, y: 0, width: 200, height: 26, rx: 8, fill: P.wood }), h('g', { transform: 'translate(0,-55) scale(.7)' }, [gift(h, 1), h('path', { d: heartD(0, -150, 40), fill: P.pink })])]);
  const sg = h('g'); sg.appendChild(sled); L.g.appendChild(sg);
  const trail = h('path', { stroke: '#cfe2ea', 'stroke-width': 6, fill: 'none' }); L.g.insertBefore(trail, sg);
  const pathPt = u => { const x = -100 + u * 1300; const y = x < 600 ? 900 + 350 * Math.pow((x + 200) / 800, 2) * .98 : 1250 + (x - 600) * .45; return [x, y - 30]; };
  S.update(t => { const u = Math.min(1, Math.max(0, t / 2.6)); const k = S.Ease.inQuad(u); const [x, y] = pathPt(k), [x2, y2] = pathPt(Math.min(1, k + .01)); const a = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI; sg.setAttribute('transform', `translate(${x},${y}) rotate(${a}) scale(${1 - k * .3})`); let d = ''; for (let q = 0; q <= k; q += .02) { const [px, py] = pathPt(q); d += (d ? ' L ' : 'M ') + px + ' ' + (py + 34); } trail.setAttribute('d', d); });
  S.layer(1).add(E.snow({ n: 40, color: P.snow, opacity: .7, drift: [80, 40], seed: 101 }));
  S.camera([[0, { x: 60, y: 60, zoom: 1.08 }], [1, { x: -80, y: -40, zoom: 1.0 }]], 'inOutSine');
});

/* s11 — save me from tears : la larme devient flocon */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, P.night], [1, '#2d6585']]));
  S.layer(.1).add(E.snow({ n: 60, color: P.frost, opacity: .35, seed: 111 }));
  const L = S.layer(1);
  L.add(h('path', { d: 'M 1200 600 L 860 600 Q 640 620 600 840 Q 590 940 540 1010 L 470 1110 Q 460 1135 500 1145 L 530 1150 Q 545 1180 525 1200 Q 512 1212 530 1222 L 552 1232 Q 540 1262 548 1290 Q 560 1330 620 1350 Q 690 1365 720 1430 L 760 1800 L 1200 1800 Z', fill: P.pinkD, filter: cut(S) }));
  L.add(h('path', { d: 'M 1200 560 Q 900 520 800 640 Q 760 700 860 690 Q 1000 640 1200 700 Z', fill: '#7a4a5a' }));
  L.add(h('path', { d: 'M 600 960 Q 625 945 650 962', stroke: P.night, 'stroke-width': 7, fill: 'none', 'stroke-linecap': 'round' }));
  const tear = h('path', { d: 'M 0 -18 Q 12 4 0 14 Q -12 4 0 -18 Z', fill: P.frost }); const flake = h('g', { stroke: P.snow, 'stroke-width': 5, 'stroke-linecap': 'round' });
  for (let i = 0; i < 6; i++) { const a = i * 60 * Math.PI / 180; flake.appendChild(h('line', { x1: 0, y1: 0, x2: Math.cos(a) * 30, y2: Math.sin(a) * 30 })); flake.appendChild(h('line', { x1: Math.cos(a) * 18, y1: Math.sin(a) * 18, x2: Math.cos(a + .5) * 26, y2: Math.sin(a + .5) * 26 })); }
  L.g.append(tear, flake);
  S.update(t => { const k = Math.min(1, Math.max(0, (t - .3) / 1.6)); const y = 990 + k * 520, x = 625 - k * 40; tear.setAttribute('transform', `translate(${x},${y}) scale(${1 + k})`); tear.setAttribute('opacity', 1 - Math.min(1, Math.max(0, (k - .55) / .2))); flake.setAttribute('transform', `translate(${x},${y}) rotate(${t * 60}) scale(${Math.min(1.6, Math.max(0, (k - .5) / .25) * 1.6)})`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 30, zoom: 1.06 }]], 'inOutSine');
});

/* s12 — someone special : pas de porte, couronne, cadeau */
CLIP.scene('s12', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#24506d' }));
  const boards = h('g', { stroke: '#1d4560', 'stroke-width': 4 }); for (let y = -400; y < 2400; y += 70) boards.appendChild(h('line', { x1: -400, y1: y, x2: 1500, y2: y })); S.layer(0).add(boards);
  const D = S.layer(.5);
  D.add(h('g', { filter: cut(S) }, [h('rect', { x: 560, y: 560, width: 420, height: 900, rx: 10, fill: P.pine }), h('rect', { x: 590, y: 600, width: 360, height: 820, rx: 8, fill: '#2e7a63' }), h('circle', { cx: 900, cy: 1040, r: 14, fill: P.gold })]));
  const wreath = h('g', { transform: 'translate(770,820)' }); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; wreath.appendChild(h('circle', { cx: Math.cos(a) * 95, cy: Math.sin(a) * 95, r: 34, fill: i % 2 ? P.pine : '#2e7a63' })); } wreath.appendChild(h('path', { d: 'M -40 90 L 0 70 L 40 90 L 30 140 L 0 110 L -30 140 Z', fill: P.gold })); [0, 3, 7, 11, 15].forEach(i => { const a = i / 18 * Math.PI * 2; wreath.appendChild(h('circle', { cx: Math.cos(a) * 95, cy: Math.sin(a) * 95, r: 12, fill: P.pink })); }); D.g.appendChild(wreath);
  D.add(h('rect', { x: 480, y: 1460, width: 580, height: 40, fill: P.snow }));
  const L = S.layer(1);
  L.add(h('rect', { x: -300, y: 1490, width: 1700, height: 900, fill: '#e3eef3' }));
  L.add(E.radial([[0, P.warm, .5], [1, P.warm, 0]], { x: 300, y: 900, w: 700, h: 700, cx: .5, cy: .5, r: .5 }));
  const m = him(E, { x: 330, y: 1500, s: 1.15, pose: 'stand', action: 'none', facing: 1, anim: (a, t) => { a.ua1 = 70; a.la1 = 60; const knock = Math.max(0, Math.sin(t * 9)) * (t > 1.5 && t < 3 ? 1 : 0); a.ua2 = 80 + knock * 30; a.la2 = 100 - knock * 40; a.head = -5; } });
  L.add(m);
  const gb = h('g', {}, [gift(h, .55), h('path', { d: heartD(0, -80, 20), fill: P.pink })]); L.g.appendChild(gb);
  S.update(t => gb.setAttribute('transform', `translate(${330 + 1.15 * 120},${1500 - 1.15 * 230 + Math.sin(t * 2) * 4})`));
  snowy(S, 1, { n: 60, opacity: .7 });
  S.camera([[0, { x: 30, y: 0, zoom: 1.08 }], [1, { x: -10, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s13 — Last Christmas (2) : la boule dorée géante */
CLIP.scene('s13', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#24506d'], [1, '#081a2b']], { cx: .5, cy: .55, r: .7 }));
  S.layer(.2).add(E.fireflies({ n: 40, color: P.gold, area: [0, 300, 1080, 1500] }));
  const small = [[180, 700, 70, P.pink, 1.2], [900, 820, 80, P.mint, -1], [220, 1500, 60, P.mint, .8], [880, 1450, 90, P.pink, -1.3]].map(([x, y, r, c, sp]) => { const g = h('g', {}, [h('line', { x1: 0, y1: -600, x2: 0, y2: -r, stroke: P.snow, 'stroke-width': 3 }), h('rect', { x: -r * .25, y: -r * 1.15, width: r * .5, height: r * .25, fill: P.goldD }), h('circle', { r, fill: c }), h('path', { d: `M ${-r * .6} ${-r * .2} Q ${-r * .4} ${-r * .7} ${r * .1} ${-r * .7}`, stroke: '#fff', 'stroke-width': r * .12, fill: 'none', opacity: .5 })]); S.layer(.5).add(g); return [g, x, y, sp]; });
  const L = S.layer(1); const B = h('g', { filter: cut(S) }); L.g.appendChild(B);
  B.append(h('line', { x1: 0, y1: -900, x2: 0, y2: -300, stroke: P.snow, 'stroke-width': 4 }), h('rect', { x: -60, y: -330, width: 120, height: 60, rx: 10, fill: P.goldD }));
  const ball = h('g'); B.appendChild(ball);
  ball.append(h('circle', { r: 300, fill: P.gold }), h('circle', { r: 300, fill: E.gradientDef([[0, '#fff3c4', .7], [.5, P.gold, 0], [1, P.goldD, .6]]) }));
  const bands = h('g', { stroke: P.goldD, 'stroke-width': 10, fill: 'none', opacity: .7 }); ball.appendChild(bands);
  ball.append(h('path', { d: heartD(0, 30, 110), fill: P.pink, opacity: .9 }), h('path', { d: 'M -200 -120 Q -150 -230 -40 -260', stroke: '#fff', 'stroke-width': 28, 'stroke-linecap': 'round', fill: 'none', opacity: .55 }));
  S.update(t => { B.setAttribute('transform', `translate(540,${1040}) rotate(${Math.sin(t * 1.4) * 6})`); bands.innerHTML = ''; for (let i = 0; i < 3; i++) { const ph = pmod(t * .3 + i / 3, 1); const rx = 300 * Math.cos((ph - .5) * Math.PI); bands.appendChild(h('ellipse', { cx: 0, cy: 0, rx: Math.abs(rx), ry: 300 })); } small.forEach(([g, x, y, sp], i) => g.setAttribute('transform', `translate(${x},${y}) rotate(${Math.sin(t * sp + i) * 8})`)); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'inOutSine');
});

/* s14 — the very next day (2) : le réveil qui sonne */
CLIP.scene('s14', S => {
  const { E, h } = S;
  S.layer(0).add(E.rect({ x: -1000, y: -1000, width: 3080, height: 4000, fill: '#f3e3cf' }));
  const W = S.layer(.3); W.add(h('g', { filter: cut(S) }, [h('rect', { x: 560, y: 380, width: 420, height: 560, rx: 10, fill: P.snow }), h('rect', { x: 590, y: 410, width: 360, height: 500, fill: '#bfe0ec' }), h('rect', { x: 762, y: 410, width: 16, height: 500, fill: P.snow }), h('rect', { x: 590, y: 652, width: 360, height: 16, fill: P.snow })]));
  W.add(E.snow({ n: 40, color: P.snow, area: [590, 410, 360, 500], opacity: .9, seed: 141 }));
  const L = S.layer(1);
  L.add(h('rect', { x: -200, y: 1280, width: 1500, height: 60, fill: P.wood, filter: cut(S) })); L.add(h('rect', { x: -200, y: 1340, width: 1500, height: 900, fill: '#c9a98f' }));
  const clk = h('g'); L.g.appendChild(clk);
  clk.append(h('circle', { cx: -110, cy: -190, r: 60, fill: P.gold }), h('circle', { cx: 110, cy: -190, r: 60, fill: P.gold }), h('rect', { x: -6, y: -250, width: 12, height: 60, fill: P.goldD }),
    h('line', { x1: -140, y1: 160, x2: -180, y2: 230, stroke: P.night, 'stroke-width': 18, 'stroke-linecap': 'round' }), h('line', { x1: 140, y1: 160, x2: 180, y2: 230, stroke: P.night, 'stroke-width': 18, 'stroke-linecap': 'round' }),
    h('circle', { r: 200, fill: P.mint, filter: cut(S) }), h('circle', { r: 165, fill: P.snow }));
  for (let i = 0; i < 12; i++) { const a = i * 30 * Math.PI / 180; clk.appendChild(h('circle', { cx: Math.sin(a) * 135, cy: -Math.cos(a) * 135, r: i % 3 ? 6 : 11, fill: P.night })); }
  const hh = h('line', { x1: 0, y1: 0, x2: 0, y2: -80, stroke: P.night, 'stroke-width': 14, 'stroke-linecap': 'round', transform: 'rotate(210)' }), mh = h('line', { x1: 0, y1: 0, x2: 0, y2: -120, stroke: P.night, 'stroke-width': 9, 'stroke-linecap': 'round' }); clk.append(hh, mh, h('circle', { r: 12, fill: P.night }));
  const hammer = h('line', { x1: 0, y1: -250, x2: 0, y2: -215, stroke: P.night, 'stroke-width': 10 }); clk.appendChild(hammer);
  const waves = [0, 1, 2].map(i => { const p = h('path', { stroke: P.pinkD, 'stroke-width': 8, fill: 'none', 'stroke-linecap': 'round' }); L.g.appendChild(p); return p; });
  S.update(t => {
    const ring = t > .3, sh = ring ? Math.sin(t * 60) * 5 : 0; clk.setAttribute('transform', `translate(${380 + sh},${1050 + Math.abs(sh) * .6}) rotate(${sh * .8})`);
    hammer.setAttribute('transform', `rotate(${ring ? Math.sin(t * 60) * 30 : 0} 0 -190)`); mh.setAttribute('transform', `rotate(${t * 4})`);
    waves.forEach((p, i) => { const r = 250 + i * 60 + pmod(t * 120, 60); p.setAttribute('d', `M ${380 - r * .7} ${1050 - r * .7} A ${r} ${r} 0 0 1 ${380 + r * .7} ${1050 - r * .7}`); p.setAttribute('opacity', ring ? .6 - i * .15 : 0); });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05 }]], 'linear');
});

/* s15 — you gave it away (2) : le ballon-cœur s'envole */
CLIP.scene('s15', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#5b8fa8'], [.7, '#a9d3e6'], [1, '#e8f3f7']]));
  S.layer(.1).add(E.clouds({ n: 5, y: 500, color: P.snow, opacity: .8, speed: 18, seed: 151 }));
  const V = S.layer(.5); [[-60, 1600, 300, 380, '#3d6f8f'], [260, 1600, 260, 300, '#4a7d9c'], [540, 1600, 280, 420, '#3d6f8f'], [840, 1600, 260, 330, '#4a7d9c']].forEach(a => V.add(house(h, ...a, false))); V.g.setAttribute('filter', cut(S));
  const L = S.layer(1);
  const fig = her(E, { x: 360, y: 1640, s: 1.1, pose: 'reach', action: 'reach', speed: 1.2 }); L.add(fig);
  const bal = h('g', {}, [h('path', { d: 'M 0 60 Q 30 160 -10 260 Q -40 340 0 420', stroke: '#5a6b75', 'stroke-width': 3, fill: 'none' }), h('path', { d: heartD(0, 0, 90), fill: P.pink, filter: cut(S) }), h('path', { d: 'M -40 -20 Q -30 -55 0 -55', stroke: '#fff', 'stroke-width': 10, 'stroke-linecap': 'round', fill: 'none', opacity: .6 })]);
  const bg = h('g'); bg.appendChild(bal); L.g.appendChild(bg);
  S.update(t => { const k = Math.max(0, t - .4); bg.setAttribute('transform', `translate(${400 + k * 110 + Math.sin(t * 2) * 25},${1050 - k * k * 90 - k * 120}) rotate(${Math.sin(t * 1.7) * 10}) scale(${Math.max(.35, 1 - k * .2)})`); });
  S.camera([[0, { x: 0, y: 60, zoom: 1.0 }], [1, { x: -30, y: 200, zoom: 1.04 }]], 'inOutSine');
});

/* s16 — this year : feux d'artifice du Nouvel An */
CLIP.scene('s16', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#06142a'], [.7, P.night], [1, '#24506d']]));
  S.layer(.05).add(E.stars({ n: 120, seed: 161, color: P.snow }));
  const FW = S.layer(.15); const fws = [[300, 520, 0.2, P.gold], [760, 420, 1.0, P.pink], [540, 680, 1.8, P.mint], [220, 760, 2.6, P.pink], [840, 700, 3.2, P.gold]].map(([x, y, t0, c]) => { const g = h('g', { filter: 'url(#glow)' }); const rays = [...Array(18)].map(() => { const l = h('line', { stroke: c, 'stroke-width': 6, 'stroke-linecap': 'round' }); g.appendChild(l); return l; }); FW.g.appendChild(g); return [g, rays, x, y, t0]; });
  const V = S.layer(.5); [[-40, 1500, 260, 360, '#24506d'], [230, 1500, 220, 280, '#2d5f7d'], [460, 1500, 280, 420, '#24506d'], [760, 1500, 300, 320, '#2d5f7d']].forEach(a => V.add(house(h, ...a))); V.g.setAttribute('filter', cut(S));
  const L = S.layer(1);
  L.add(h('rect', { x: -300, y: 1500, width: 1700, height: 900, fill: '#dde9ef' }));
  L.add(her(E, { x: 540, y: 1640, s: 1.2, pose: 'lookup', action: 'breathe' }));
  snowy(S, 1, { n: 60, opacity: .6 });
  S.update(t => fws.forEach(([g, rays, x, y, t0]) => { const u = t - t0, k = Math.min(1, Math.max(0, u / 1.2)); rays.forEach((l, i) => { const a = i / rays.length * Math.PI * 2, r0 = 20 + k * 200, r1 = r0 + 40 * (1 - k * .5); S.set(l, { x1: x + Math.cos(a) * r0, y1: y + Math.sin(a) * r0 + k * k * 40, x2: x + Math.cos(a) * r1, y2: y + Math.sin(a) * r1 + k * k * 40 }); }); g.setAttribute('opacity', u < 0 ? 0 : 1 - Math.max(0, (k - .6) / .4)); }));
  S.camera([[0, { x: 0, y: 40, zoom: 1.08 }], [1, { x: 0, y: -20, zoom: 1.0 }]], 'inOutSine');
});
