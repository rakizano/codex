/* « Ligne 6, minuit » — introspection dans Paris depuis le métro aérien (Bir-Hakeim → tour Eiffel).
 * Mélange des deux références : vraie nuit filmée depuis la ligne 6 + animation Bir-Hakeim violette.
 * Personnage : E.flat 'him' (bonnet, locks, sweat noir, visage vierge). Aucune parole affichée (titre non identifié).
 * Toutes les animations sont des fonctions pures de t.
 */
const C = { night: '#0b0d1c', night2: '#151a33', gold: '#ffc04a', sodium: '#ffb35c', violet: '#7a3cff', plaque: '#1d3a8a', zinc: '#3a4252', stone: '#6a5844' };
const ramp = (t, a, d) => Math.max(0, Math.min(1, (t - a) / d));
const HIM = o => Object.assign({ who: 'him', view: 'back' }, o);

/* ---------- tour Eiffel : dentelle dorée, éclats de scintillement, phare tournant ---------- */
const EIFFEL_D = 'M -.19 0 Q -.14 -.09 -.125 -.165 L -.132 -.165 L -.132 -.186 L -.085 -.186 Q -.062 -.27 -.056 -.35 L -.07 -.35 L -.07 -.363 L -.046 -.363 Q -.024 -.6 -.013 -.84 L -.022 -.84 L -.022 -.873 L -.006 -.873 L -.003 -1 L .003 -1 L .006 -.873 L .022 -.873 L .022 -.84 L .013 -.84 Q .024 -.6 .046 -.363 L .07 -.363 L .07 -.35 L .056 -.35 Q .062 -.27 .085 -.186 L .132 -.186 L .132 -.165 L .125 -.165 Q .14 -.09 .19 0 L .118 0 Q .1 -.062 .088 -.09 Q 0 -.168 -.088 -.09 Q -.1 -.062 -.118 0 Z';
function eiffelHW(y) { // demi-largeur (unités normalisées) à la hauteur y (0 = sol, 1 = sommet)
  if (y < .165) return .19 - (.19 - .125) * (y / .165) - .02 * Math.sin(y / .165 * Math.PI);
  if (y < .186) return .132; if (y < .35) return .085 - (.085 - .056) * ((y - .186) / .164);
  if (y < .363) return .07; if (y < .84) return .046 - (.046 - .013) * Math.pow((y - .363) / .477, .8); if (y < .873) return .022; return .004;
}
function eiffel(S, { x = 540, y = 1300, H = 900, sparkle = () => 0, lit = () => 1, beacon = true, n = 170, seed = 3, halo = .2 } = {}) {
  const { E, h } = S, r = S.rng;
  const g = h('g', { transform: `translate(${x},${y})` });
  const haloEl = h('ellipse', { cx: 0, cy: -.42 * H, rx: .36 * H, ry: .62 * H, fill: '#ffb84a', opacity: halo, filter: 'url(#bigblur)' });
  const beams = [];
  if (beacon) for (let i = 0; i < 2; i++) { const b = h('path', { fill: '#eef3ff', opacity: .2, filter: 'url(#softblur)' }); g.appendChild(b); beams.push(b); }
  g.appendChild(haloEl);
  const body = h('g', { transform: `scale(${H})` }); g.appendChild(body);
  const fill = E.gradientDef([[0, '#fff1b8'], [.45, '#ffc451'], [1, '#d4801a']], true);
  const shape = h('path', { d: EIFFEL_D, fill }); body.appendChild(shape);
  const cid = 'eif' + Math.floor(r() * 1e9); S.defs.appendChild(h('clipPath', { id: cid }, [h('path', { d: EIFFEL_D })]));
  const lat = h('g', { 'clip-path': `url(#${cid})` }); body.appendChild(lat);
  let d = ''; for (let k = -30; k <= 30; k++) { const x0 = k * .016; d += `M ${x0 - .5} 0 L ${x0 + .5} -1 M ${x0 + .5} 0 L ${x0 - .5} -1 `; }
  lat.appendChild(h('path', { d, stroke: '#6a3a08', 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke', opacity: .55, fill: 'none' }));
  [[-.186, .012], [-.363, .009], [-.873, .006], [-.09, .004]].forEach(([yy, hh]) => lat.appendChild(h('rect', { x: -.3, y: yy, width: .6, height: hh, fill: '#fff6d0' })));
  const sp = h('g'); g.appendChild(sp); const dots = [];
  for (let i = 0; i < n; i++) { let yy = Math.pow(r(), 1.3); const hw = eiffelHW(yy); let xx = (r() * 2 - 1) * hw * .92; if (yy < .14 && Math.abs(xx) < .1 * (1 - yy / .14)) xx = Math.sign(xx || 1) * (.1 + r() * .06);
    const c = h('circle', { cx: xx * H, cy: -yy * H, r: (1.6 + r() * 2.6) * H / 900, fill: '#ffffff', filter: 'url(#glow)' }); sp.appendChild(c); dots.push([c, r() * 100]); }
  const top = h('circle', { cx: 0, cy: -H, r: 6 * H / 900, fill: '#fffbe8', filter: 'url(#glow)' }); g.appendChild(top);
  return { el: g, body: shape, update(t) {
    const L = lit(t), s = sparkle(t);
    body.setAttribute('opacity', .15 + .85 * L); haloEl.setAttribute('opacity', halo * L * (1 + .3 * s));
    dots.forEach(([c, ph]) => c.setAttribute('opacity', s * (S.noise(t * 9 + ph, seed) > .35 ? 1 : 0)));
    top.setAttribute('opacity', L);
    beams.forEach((b, i) => { const a = t * 1.1 + i * Math.PI, cx = Math.cos(a), len = 2600, w = 70, ty = -H * .99;
      b.setAttribute('d', `M 0 ${ty} L ${cx * len} ${ty + Math.sin(a) * 120 - 90 - w} L ${cx * len} ${ty + Math.sin(a) * 120 - 90 + w} Z`); b.setAttribute('opacity', .22 * L * (.35 + .65 * Math.abs(cx))); });
  } };
}

/* ---------- immeuble haussmannien ---------- */
function haussmann(S, { x = 0, y = 1500, w = 420, s = 1, lit = .45, seed = 1, awning = false, stone = '#5a4a3c', flick = true } = {}) {
  const { h } = S; let q = seed * 9301 + 49297; const rr = () => ((q = (q * 9301 + 49297) % 233280) / 233280);
  const g = h('g', { transform: `translate(${x},${y}) scale(${s})` }), wins = [];
  const fl = [130, 108, 104, 100, 96, 92], top = -fl.reduce((a, b) => a + b, 0);
  g.appendChild(h('rect', { x: 0, y: top, width: w, height: -top, fill: stone }));
  g.appendChild(h('rect', { x: w * .7, y: top, width: w * .3, height: -top, fill: '#000', opacity: .12 }));
  const cols = Math.max(2, Math.floor(w / 84)), cw = w / cols; let yy = 0;
  fl.forEach((fh, k) => { yy -= fh;
    g.appendChild(h('rect', { x: -4, y: yy - 3, width: w + 8, height: 6, fill: '#000', opacity: .25 }));
    for (let c = 0; c < cols; c++) {
      if (k === 0) { const on = rr() < .7; const e = h('rect', { x: c * cw + 8, y: yy + 26, width: cw - 16, height: fh - 30, fill: on ? '#ffd58a' : '#1c1a22' }); g.appendChild(e); continue; }
      const on = rr() < lit, tv = rr() < .08; const e = h('rect', { x: c * cw + cw * .26, y: yy + fh * .14, width: cw * .48, height: fh * .7, fill: on ? (tv ? '#8fb8ff' : '#ffcf7a') : '#221f2a' }); g.appendChild(e);
      if (on) { g.appendChild(h('rect', { x: c * cw + cw * .26, y: yy + fh * .14, width: cw * .48, height: fh * .7, fill: on ? '#ffe9b0' : 'none', opacity: .25, filter: 'url(#softblur)' })); wins.push([e, tv, rr() * 50]); }
      g.appendChild(h('line', { x1: c * cw + cw * .5, y1: yy + fh * .14, x2: c * cw + cw * .5, y2: yy + fh * .84, stroke: '#3a2c22', 'stroke-width': 3 }));
    }
    if (k === 1 || k === 4) { g.appendChild(h('rect', { x: 0, y: yy + fh - 30, width: w, height: 4, fill: '#120e10' }));
      g.appendChild(h('path', { d: Array.from({ length: Math.floor(w / 12) }, (_, i) => `M ${i * 12 + 6} ${yy + fh - 28} l 0 26`).join(' '), stroke: '#120e10', 'stroke-width': 2.5 })); }
  });
  const m = top - 120; g.appendChild(h('path', { d: `M -6 ${top} L ${w + 6} ${top} L ${w - 30} ${m} L 30 ${m} Z`, fill: C.zinc }));
  for (let c = 0; c < cols; c++) { const on = rr() < lit * .6; g.appendChild(h('path', { d: `M ${c * cw + cw * .32} ${top - 18} L ${c * cw + cw * .32} ${top - 70} Q ${c * cw + cw * .5} ${top - 92} ${c * cw + cw * .68} ${top - 70} L ${c * cw + cw * .68} ${top - 18} Z`, fill: on ? '#ffcf7a' : '#2a303c', stroke: '#4a5262', 'stroke-width': 4 })); }
  [.15, .55, .85].forEach(k => g.appendChild(h('rect', { x: w * k, y: m - 40, width: 26, height: 44, fill: '#4a3a30' })));
  if (awning) { const aw = h('g'); aw.appendChild(h('path', { d: `M -10 -96 L ${w + 10} -96 L ${w + 30} -40 ` + Array.from({ length: Math.ceil((w + 40) / 30) }, (_, i) => `Q ${w + 30 - i * 30 - 15} -24 ${w + 30 - (i + 1) * 30} -40`).join(' ') + ' Z', fill: '#c4182a' }));
    for (let i = 0; i < w / 26; i++) aw.appendChild(h('circle', { cx: i * 26 + 8, cy: -100, r: 4, fill: '#fff2c0', filter: 'url(#glow)' }));
    aw.appendChild(h('rect', { x: 0, y: -40, width: w, height: 40, fill: '#ffb35c', opacity: .5, filter: 'url(#softblur)' })); g.appendChild(aw); }
  return { el: g, update(t) { if (flick) wins.forEach(([e, tv, ph]) => { if (tv) e.setAttribute('opacity', .7 + .3 * S.noise(t * 6 + ph, 2)); }); } };
}
function rowOfBuildings(S, { y, s = 1, n = 6, seed = 1, lit = .45, awnings = true }) {
  const { h } = S, g = h('g'), items = []; let x = 0;
  for (let i = 0; i < n; i++) { const w = 360 + ((i * 97 + seed * 31) % 5) * 40; const b = haussmann(S, { x, y, w, s: 1, seed: seed * 10 + i, lit, awning: awnings && i % 2 === 0, stone: ['#5a4a3c', '#655242', '#4e4236'][i % 3] }); g.appendChild(b.el); items.push(b); x += w + 6; }
  return { el: g, width: x * s, update(t) { items.forEach(b => b.update(t)); }, scale: s };
}
/* reflets sur l'eau : traînées verticales tremblantes sous chaque lumière */
function reflections(S, { wl = 1300, lights = [], len = 420, seed = 5 }) {
  const { h } = S, g = h('g', { style: 'mix-blend-mode:screen' }), bars = [];
  lights.forEach(([x, col, w0], i) => { for (let k = 0; k < 14; k++) { const e = h('rect', { fill: col, height: 7 }); g.appendChild(e); bars.push([e, x, k, w0 || 30, i]); } });
  return { el: g, update(t) { bars.forEach(([e, x, k, w0, i]) => { const yy = wl + 6 + k * (len / 14), ww = w0 * (1 - k / 16) * (.5 + .5 * Math.abs(S.noise(t * 2 + k * .7 + i, seed)));
    S.set(e, { x: x - ww / 2 + S.noise(t * 1.5 + k * .4 + i * 3, seed + 1) * 14, y: yy, width: ww, opacity: (1 - k / 14) * .8 }); }); } };
}
/* rame de métro ligne 6 (blanche, bandeau bleu, fenêtres chaudes) */
function metroTrain(S, { cars = 3, s = 1 } = {}) {
  const { h } = S, g = h('g'); const cw = 420;
  for (let c = 0; c < cars; c++) { const x = c * (cw + 14);
    g.append(h('rect', { x, y: -130, width: cw, height: 130, rx: c === 0 ? 40 : 10, fill: '#dfe4ea' }), h('rect', { x, y: -44, width: cw, height: 16, fill: '#2b4fa8' }));
    for (let k = 0; k < 5; k++) g.appendChild(h('rect', { x: x + 26 + k * 78, y: -112, width: 58, height: 52, rx: 8, fill: '#ffe2a0' }));
    g.appendChild(h('rect', { x, y: -130, width: cw, height: 130, rx: 10, fill: '#ffe2a0', opacity: .18, filter: 'url(#bigblur)' }));
    g.append(h('circle', { cx: x + 90, cy: 6, r: 16, fill: '#111' }), h('circle', { cx: x + cw - 90, cy: 6, r: 16, fill: '#111' })); }
  g.appendChild(h('circle', { cx: 18, cy: -40, r: 9, fill: '#fff8e0', filter: 'url(#glow)' }));
  return g;
}
/* viaduc de Bir-Hakeim : tablier métro + colonnes de fonte + tablier bas + piles de pierre */
function viaduct(S, { y = 1050, low = 1210, color = '#1a1a26', lamp = '#ffcf7a' } = {}) {
  const { h } = S, g = h('g');
  g.appendChild(h('rect', { x: -400, y: low, width: 1900, height: 34, fill: color }));
  for (let i = -3; i < 16; i++) { const x = i * 96; g.append(h('rect', { x: x - 10, y, width: 7, height: low - y, fill: color }), h('rect', { x: x + 6, y, width: 7, height: low - y, fill: color }));
    if (i % 2 === 0) g.appendChild(h('circle', { cx: x + 2, cy: low - 10, r: 5, fill: lamp, filter: 'url(#glow)' })); }
  g.append(h('rect', { x: -400, y: y - 30, width: 1900, height: 30, fill: color }), h('path', { d: Array.from({ length: 70 }, (_, i) => `M ${-400 + i * 28} ${y - 30} l 14 30 l 14 -30`).join(' '), stroke: '#2a2a3a', 'stroke-width': 3, fill: 'none' }));
  [-150, 330, 810, 1290].forEach(x => g.appendChild(h('path', { d: `M ${x - 60} ${low + 34} L ${x + 60} ${low + 34} L ${x + 80} ${low + 260} L ${x - 80} ${low + 260} Z`, fill: '#2a2630' })));
  return g;
}
const txt = (h, attrs, str) => { const e = h('text', attrs); e.textContent = str; return e; };
const violetWash = (S, k) => { const r = S.h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: C.violet, opacity: 0, style: 'mix-blend-mode:color' }); S.layer(3).add(r); return r; };

/* s00 — tunnel → lumière */
CLIP.scene('s00', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#06070c' }));
  const T = S.layer(.5), lights = [...Array(16)].map((_, i) => { const e = h('rect', { rx: 6, fill: i % 4 === 0 ? '#9fd0ff' : '#fff2cc', filter: 'url(#glow)' }); T.g.appendChild(e); return [e, i]; });
  const end = h('ellipse', { cx: 540, cy: 960, rx: 60, ry: 80, fill: '#fff6dc', filter: 'url(#bigblur)' }); T.g.appendChild(end);
  S.update(t => { lights.forEach(([e, i]) => { const z = Math.pow(CLIP.mod(t * 1.4 + i / 16, 1), 2.2), side = i % 2 ? 1 : -1, w = 40 + z * 500;
    S.set(e, { x: 540 + side * (60 + z * 760) - w / 2, y: 960 - 40 - z * 700 + (i % 3) * z * 500, width: w, height: 8 + z * 30, opacity: Math.min(1, z * 3) }); });
    const k = ramp(t, 2.3, .6); S.set(end, { rx: 60 + k * 900, ry: 80 + k * 1300, opacity: .25 + k * .75 }); });
  S.camera([[0, { x: 0, y: 0, zoom: 1 }], [1, { x: 0, y: 0, zoom: 1.15 }]], 'inCubic', { shake: 3, shakeFreq: 14 });
});

/* s01 — quai Bir-Hakeim, plaque émaillée, néons qui virent au violet */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#1a1c24' }));
  const W_ = S.layer(.15);
  for (let r = 0; r < 20; r++) for (let c = 0; c < 18; c++) W_.add(h('rect', { x: -200 + c * 84 + (r % 2) * 42, y: 520 + r * 44, width: 80, height: 40, rx: 8, fill: '#d9dde2', opacity: .9 }));
  const neons = [0, 1].map(i => { const e = h('rect', { x: 60 + i * 520, y: 470, width: 440, height: 22, rx: 11, fill: '#f4fbff', filter: 'url(#glow)' }); W_.add(e); return e; });
  const sign = h('g', { transform: 'translate(540,960) rotate(-4)' }, [h('rect', { x: -470, y: -110, width: 940, height: 220, rx: 18, fill: '#f2efe4' }), h('rect', { x: -455, y: -96, width: 910, height: 140, rx: 10, fill: C.plaque }),
    txt(h, { x: 0, y: 12, 'text-anchor': 'middle', fill: '#fff', 'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 700, 'font-size': 104 }, 'Bir-Hakeim'),
    h('rect', { x: -455, y: 44, width: 910, height: 56, fill: '#7a5a2a' }), txt(h, { x: 230, y: 86, 'text-anchor': 'middle', fill: '#f6e2b0', 'font-family': 'Georgia, serif', 'font-style': 'italic', 'font-size': 40 }, 'Tour Eiffel')]);
  S.layer(.3).add(sign); S.key(sign, 'plaque Bir-Hakeim');
  const map = h('g', { transform: 'translate(120,820)' }, [h('rect', { width: 300, height: 380, fill: '#e8e2cc', stroke: '#2a2a2a', 'stroke-width': 8 }), h('path', { d: 'M 30 300 Q 120 120 270 60 M 40 80 Q 150 200 260 320 M 20 200 L 280 210', stroke: '#2b8a5a', 'stroke-width': 8, fill: 'none' }), h('circle', { cx: 150, cy: 190, r: 12, fill: '#c4182a' })]);
  S.layer(.6).add(h('rect', { x: -800, y: 1380, width: 2700, height: 700, fill: '#2a2a30' }), h('rect', { x: -800, y: 1380, width: 2700, height: 22, fill: '#e8d26a' }));
  const head = h('ellipse', { cx: 1080, cy: 1300, rx: 60, ry: 60, fill: '#fff6dc', filter: 'url(#bigblur)' }); S.layer(.7).add(head);
  S.layer(1).add(E.flat(HIM({ x: 560, y: 1640, s: .62, action: 'breathe', rim: '#c9a8ff', key: 'lui' })));
  const wash = violetWash(S);
  S.update(t => { neons.forEach((e, i) => e.setAttribute('opacity', S.noise(t * 12 + i * 5, 4) > .2 || t < .3 ? 1 : .25));
    const k = ramp(t, 1.2, .8); wash.setAttribute('opacity', .55 * k); const a = ramp(t, .3, 2.2); S.set(head, { cx: 1080 - a * 200, rx: 60 + a * 260, ry: 60 + a * 200, opacity: .3 + a * .7 }); });
  S.camera([[0, { x: 30, y: 0, zoom: 1.04 }], [1, { x: -30, y: 0, zoom: 1.0, rot: -1 }]], 'inOutSine', { handheld: 1.2 });
});

/* s02 — dans la rame : il tient la barre, Paris défile, son reflet dans la vitre */
CLIP.scene('s04', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0e1120' }));
  const cid = 'win02'; S.defs.appendChild(h('clipPath', { id: cid }, [h('rect', { x: 120, y: 640, width: 840, height: 640, rx: 60 })]));
  const view = h('g', { 'clip-path': `url(#${cid})` }); S.layer(.2).g.appendChild(view);
  view.appendChild(h('rect', { x: 0, y: 500, width: 1080, height: 900, fill: '#141a33' }));
  const row = rowOfBuildings(S, { y: 1720, seed: 2, n: 7 }); const rg = h('g'); rg.appendChild(row.el); view.appendChild(rg); S.items.push(row);
  const refl = E.flat({ who: 'him', view: 'front', x: 700, y: 1720, s: .55, key: false, shadow: false, action: 'none' }); refl.el.setAttribute('opacity', .16); view.appendChild(refl.el); S.items.push(refl);
  S.layer(.4).add(h('rect', { x: 100, y: 620, width: 880, height: 680, rx: 70, fill: 'none', stroke: '#c9ccd4', 'stroke-width': 40 }));
  S.layer(.4).add(h('rect', { x: -800, y: 1340, width: 2700, height: 900, fill: '#5a6070' }), h('rect', { x: -800, y: 1340, width: 2700, height: 20, fill: '#7a8090' }));
  S.layer(.45).add(h('rect', { x: 240, y: -100, width: 22, height: 2200, fill: '#d8dbe2' }));
  S.layer(1).add(E.flat(HIM({ view: 'front', x: 380, y: 1700, s: .7, arms: 'down', action: 'none', rim: '#ffd08a', key: 'lui', anim: (a, t) => { a.armL = 158; a.rot = Math.sin(t * 3.1) * 1.2; a.headTilt = 4 + Math.sin(t * 1.4) * 2; } })));
  S.update(t => rg.setAttribute('transform', `translate(${-CLIP.mod(t * 520, 1400)},0)`));
  S.camera([[0, { x: 0, y: 0, zoom: 1 }], [1, { x: 0, y: -20, zoom: 1.04 }]], 'linear', { shake: 2.5, shakeFreq: 7 });
});

/* s03 — façades vues du métro aérien, café illuminé */
CLIP.scene('s05', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0b0d1c', '#1a1f3a', '#2a2a44']));
  S.layer(.05).add(E.clouds({ n: 6, y: 260, spread: 260, color: '#2a2e48', opacity: .9, speed: 30, scale: 1.5 }));
  const far = rowOfBuildings(S, { y: 1250, seed: 5, n: 8, lit: .3, awnings: false }); const fg = h('g', { opacity: .55 }); fg.appendChild(far.el); S.layer(.3, { blur: 3 }).g.appendChild(fg); S.items.push(far);
  const near = rowOfBuildings(S, { y: 1680, seed: 7, n: 8 }); const ng = h('g'); ng.appendChild(near.el); S.layer(.7).g.appendChild(ng); S.items.push(near);
  S.layer(1.2, { blur: 6 }).add(h('rect', { x: -800, y: 1700, width: 2700, height: 400, fill: '#e8ecef', opacity: .8 }));
  S.update(t => { fg.setAttribute('transform', `translate(${-CLIP.mod(t * 160, 1500)},0) scale(.7) translate(0,500)`); ng.setAttribute('transform', `translate(${-CLIP.mod(t * 600, 1800) - 100},0) scale(1.15) translate(0,-200)`); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0, rot: -2 }], [1, { x: 0, y: -30, zoom: 1.05, rot: -1 }]], 'linear', { shake: 2, shakeFreq: 9 });
});

/* s04 — révélation de la tour entre les immeubles, phare qui balaie */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a0c18', '#1c2036', '#33324a']));
  S.layer(.03).add(E.clouds({ n: 7, y: 380, spread: 360, color: '#3a3a52', opacity: .85, speed: 25, scale: 1.8 }));
  const tw = eiffel(S, { x: 560, y: 1500, H: 1150, sparkle: t => t > 1.4 ? .6 : 0, seed: 4 }); S.layer(.15).add(tw); S.key(tw.body, 'tour Eiffel', 'ui');
  S.layer(.3).add(E.city({ y: 1520, color: '#0e1020', seed: 41, minH: 80, maxH: 220, lit: .3 }));
  const L1 = haussmann(S, { x: -380, y: 1900, w: 560, seed: 3, s: 1.1, awning: true }), R1 = haussmann(S, { x: 640, y: 1900, w: 600, seed: 9, s: 1.1 });
  const lg = h('g'), rg2 = h('g'); lg.appendChild(L1.el); rg2.appendChild(R1.el); S.layer(.8).g.append(lg, rg2); S.items.push(L1, R1);
  S.update(t => { const k = S.Ease.inOutCubic(ramp(t, .2, 1.4)); lg.setAttribute('transform', `translate(${-k * 260},0)`); rg2.setAttribute('transform', `translate(${k * 300},0)`); });
  S.camera([[0, { x: 0, y: 60, zoom: 1.1 }], [1, { x: 0, y: -20, zoom: 1.0 }]], 'outCubic');
});

/* s05 — le viaduc de Bir-Hakeim, la rame passe, la tour derrière, la Seine */
CLIP.scene('s03', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#090b16', '#161a30', '#2a2840']));
  S.layer(.02).add(E.stars({ n: 60, seed: 51 }));
  const tw = eiffel(S, { x: 780, y: 1240, H: 640, sparkle: t => .35 + .65 * (S.beat(t) > .5 ? 1 : 0), seed: 5 }); S.layer(.1).add(tw); S.key(tw.body, 'tour Eiffel', 'overlap,text');
  S.layer(.2).add(E.city({ y: 1250, color: '#0c0e1c', seed: 52, minH: 40, maxH: 140, lit: .3 }));
  S.layer(.25).add(h('rect', { x: -800, y: 1250, width: 2700, height: 900, fill: '#0b1020' }));
  const refl = reflections(S, { wl: 1250, lights: [[700, '#ffc04a', 70], [100, '#ffcf7a'], [300, '#ffb35c'], [480, '#fff2c0'], [880, '#ffcf7a'], [1000, '#ffb35c']], len: 520 }); S.layer(.3).add(refl);
  const V = S.layer(.6); V.add(viaduct(S, { y: 980, low: 1140 }));
  const train = metroTrain(S, { cars: 3 }); const tg = h('g'); tg.appendChild(train); V.g.appendChild(tg); S.key(tg, 'métro ligne 6', 'cut');
  const star = h('g', {}, [h('line', { x1: 0, y1: 0, x2: 260, y2: -90, stroke: '#fff', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .8, filter: 'url(#glow)' }), h('circle', { r: 7, fill: '#fff', filter: 'url(#glow)' })]); S.layer(.05).g.appendChild(star);
  S.update(t => { tg.setAttribute('transform', `translate(${1150 - t * 520},950)`); const k = ramp(t, 1.75, .8); star.setAttribute('transform', `translate(${900 - k * 700},${560 + k * 240})`); star.setAttribute('opacity', k > 0 && k < 1 ? Math.sin(k * Math.PI) : 0); });
  S.camera([[0, { x: 0, y: 0, zoom: 1.08 }], [1, { x: -30, y: 0, zoom: 1.0 }]], 'inOutSine');
});

/* s06 — introspection : de dos contre la vitre, gouttes, tour en bokeh */
CLIP.scene('s07', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#0c0f1e' }));
  const tw = eiffel(S, { x: 760, y: 1250, H: 900, sparkle: () => .5, beacon: false, seed: 6 }); S.layer(.1, { blur: 9 }).add(tw);
  S.layer(.15).add(E.bokeh({ n: 22, colors: ['#ffc04a', '#ffcf7a', '#9fd0ff'], area: [0, 900, 1080, 600], size: [20, 60], opacity: .45 }));
  const drops = [...Array(26)].map((_, i) => { const e = h('ellipse', { rx: 6, ry: 9, fill: '#dfe8ff', opacity: .5 }); S.layer(.5).g.appendChild(e); return [e, S.rng(), S.rng(), .3 + S.rng() * .8]; });
  S.layer(.5).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#aab8d8', opacity: .07 }));
  S.layer(1).add(E.flat(HIM({ x: 360, y: 2550, s: 2.1, action: 'breathe', rim: '#ffcf7a', key: 'lui (bonnet + locks)', keyAllow: 'cut,ui', anim: (a, t) => { a.headTilt = 6 + Math.sin(t * .9) * 2; } })));
  S.update(t => drops.forEach(([e, u, v, sp]) => { const y = CLIP.mod(v * 1900 + t * 140 * sp, 2100) - 100; S.set(e, { cx: u * 1080 + Math.sin(y / 90) * 6, cy: y }); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.05 }]], 'inOutSine', { handheld: .8 });
});

/* s07 — souvenir violet : polaroïd d'eux deux qui clignote puis se dissout */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3a1a6a'], [1, '#0a0614']], { cx: .5, cy: .5, r: .7 }));
  const pol = h('g'); S.layer(.8).g.appendChild(pol); S.key(pol, 'polaroïd');
  pol.append(h('rect', { x: -250, y: -300, width: 500, height: 600, fill: '#efe9dc' }));
  const cid = 'pol07'; S.defs.appendChild(h('clipPath', { id: cid }, [h('rect', { x: -220, y: -270, width: 440, height: 440 })]));
  const ph = h('g', { 'clip-path': `url(#${cid})` }); pol.appendChild(ph);
  ph.append(h('rect', { x: -220, y: -270, width: 440, height: 440, fill: '#2a2048' }), h('circle', { cx: 130, cy: -190, r: 44, fill: '#5a4a78' }));
  const sky = eiffel(S, { x: -140, y: 170, H: 300, sparkle: () => .4, beacon: false, seed: 7, halo: .1 }); ph.appendChild(sky.el); S.items.push(sky);
  const him = E.flat({ who: 'him', view: 'front', x: -60, y: 560, s: .6, key: false, shadow: false }), her = E.flat({ who: 'her', view: 'front', x: 105, y: 578, s: .57, key: false, shadow: false, headTilt: -12, action: 'sway' });
  ph.append(him.el, her.el); S.items.push(him, her);
  const dust = E.particles({ n: 80, color: '#e8d8ff', size: [2, 5], area: [290, 660, 500, 600], drift: [40, -120], opacity: .8, seed: 71 }); S.layer(.9).add(dust);
  const wash = violetWash(S);
  S.update(t => { const f = S.noise(t * 14, 9) > .1 ? 1 : .35, k = ramp(t, 1.5, 1);
    pol.setAttribute('transform', `translate(540,960) rotate(${-5 + Math.sin(t) * 2}) scale(${1 + t * .03})`); pol.setAttribute('opacity', f * (1 - k * .8)); dust.el.setAttribute('opacity', k); wash.setAttribute('opacity', .45); });
  S.camera([[0, { x: 0, y: 0, zoom: 1 }], [1, { x: 0, y: 0, zoom: 1.06 }]], 'linear', { handheld: 1 });
});

/* s08 — depuis le pont : tour à pleine puissance, bateau-mouche, reflets */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#0a0c1a', '#1a1d34', '#302c46']));
  S.layer(.03).add(E.clouds({ n: 6, y: 300, spread: 300, color: '#34344e', opacity: .8, speed: 30, scale: 1.6 }));
  const tw = eiffel(S, { x: 540, y: 1180, H: 980, sparkle: () => 1, seed: 8, halo: .3 }); S.layer(.12).add(tw); S.key(tw.body, 'tour Eiffel');
  S.layer(.2).add(E.tree({ x: 120, y: 1200, height: 260, color: '#0c1410', seed: 81 }), E.tree({ x: 960, y: 1200, height: 240, color: '#0c1410', seed: 82 }));
  S.layer(.25).add(h('rect', { x: -800, y: 1180, width: 2700, height: 30, fill: '#1a1a24' }), h('rect', { x: -800, y: 1210, width: 2700, height: 900, fill: '#0a0e1c' }));
  const lamps = [60, 200, 340, 740, 880, 1020].map(x => h('circle', { cx: x, cy: 1170, r: 7, fill: '#ffcf7a', filter: 'url(#glow)' })); S.layer(.25).g.append(...lamps);
  S.layer(.3).add(reflections(S, { wl: 1210, lights: [[540, '#ffc04a', 120], [60, '#ffcf7a'], [200, '#ffcf7a'], [340, '#ffcf7a'], [740, '#ffcf7a'], [880, '#ffcf7a'], [1020, '#ffcf7a']], len: 600 }));
  const boat = h('g', {}, [h('path', { d: 'M -200 0 L 200 0 L 170 40 L -180 40 Z', fill: '#1a1a24' }), h('rect', { x: -160, y: -50, width: 300, height: 50, rx: 10, fill: '#2a2a38' }), ...[...Array(9)].map((_, i) => h('rect', { x: -150 + i * 32, y: -40, width: 22, height: 28, rx: 4, fill: '#ffe2a0' })), h('rect', { x: -200, y: -60, width: 400, height: 100, fill: '#ffe2a0', opacity: .15, filter: 'url(#bigblur)' })]);
  S.layer(.5).g.appendChild(boat);
  S.update(t => boat.setAttribute('transform', `translate(${-150 + t * 120},1420)`));
  S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.06 }]], 'inOutSine');
});

/* s09 — montée le long de la dentelle de fer, éclats sur les temps */
CLIP.scene('s09', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05060e', '#11142a', '#1e2040']));
  S.layer(.05).add(E.stars({ n: 120, seed: 91 }));
  const tw = eiffel(S, { x: 540, y: 1950, H: 4200, sparkle: t => .5 + .5 * S.beat(t), seed: 9, n: 400, halo: .25 }); const tg = h('g'); tg.appendChild(tw.el); S.layer(.6).g.appendChild(tg); S.items.push(tw); S.key(tg, 'tour Eiffel', 'cut,ui');
  S.update(t => tg.setAttribute('transform', `translate(0,${S.Ease.inOutCubic(ramp(t, 0, 1.3)) * 3300})`));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'linear', { shake: 2 });
});

/* s10 — la bascule : sous le viaduc, colonnade en perspective, violet ; il marche seul */
CLIP.scene('s10', S => {
  const { E, h } = S;
  S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#120a24' }));
  const P = S.layer(.3), vx = 540, vy = 900;
  P.add(h('path', { d: `M -800 1900 L ${vx} ${vy} L 1880 1900 Z`, fill: '#1c1430' }));
  for (let i = 0; i < 14; i++) { const z = Math.pow(.8, i), x1 = vx - 700 * z, x2 = vx + 700 * z, yt = vy - 1100 * z, yb = vy + 1000 * z, w = 34 * z;
    P.add(h('rect', { x: x1 - w / 2, y: yt, width: w, height: yb - yt, fill: '#06040c' }), h('rect', { x: x2 - w / 2, y: yt, width: w, height: yb - yt, fill: '#06040c' }), h('circle', { cx: x1 + 40 * z, cy: yt + 320 * z, r: 14 * z + 2, fill: '#ffcf7a', filter: 'url(#glow)' }), h('circle', { cx: x2 - 40 * z, cy: yt + 320 * z, r: 14 * z + 2, fill: '#ffcf7a', filter: 'url(#glow)' })); }
  P.add(h('rect', { x: -800, y: -800, width: 2700, height: 1100 - 800 + 0, fill: '#06040c' }));
  P.add(h('ellipse', { cx: vx, cy: vy - 40, rx: 120, ry: 160, fill: '#ffd6a0', opacity: .45, filter: 'url(#bigblur)' }));
  const him = E.flat(HIM({ s: .5, action: 'walk', speed: .7, rim: '#ffd6a0', key: 'lui', path: [[0, [540, 1640]], [2.6, [540, 1480]]] })); S.layer(1).add(him);
  S.update(t => him.el.setAttribute('opacity', 1));
  const wash = violetWash(S); S.update(t => wash.setAttribute('opacity', .35));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -40, zoom: 1.1 }]], 'inOutSine');
});

/* s11 — avenue : traînées de phares, arbres, la tour au bout */
CLIP.scene('s11', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#090b16', '#171a2e', '#262440']));
  const tw = eiffel(S, { x: 540, y: 1000, H: 520, sparkle: () => .3, seed: 11, halo: .25 }); S.layer(.08).add(tw); S.key(tw.body, 'tour Eiffel');
  const road = h('path', { d: 'M 380 1010 L 700 1010 L 1500 1950 L -420 1950 Z', fill: '#16161e' }); S.layer(.2).add(road);
  for (let i = 0; i < 6; i++) { const z = Math.pow(.72, i); S.layer(.22).add(E.tree({ x: 540 - 520 * z - 40, y: 1010 + 900 * z, height: 520 * z + 80, color: '#0b120e', seed: 110 + i }), E.tree({ x: 540 + 520 * z + 40, y: 1010 + 900 * z, height: 520 * z + 80, color: '#0b120e', seed: 120 + i })); }
  const T = S.layer(.3), cars = [...Array(14)].map((_, i) => { const g = h('g', {}, [h('circle', { r: 1, fill: i % 2 ? '#fff6d8' : '#ff3a3a', filter: 'url(#glow)' }), h('circle', { r: 1, fill: i % 2 ? '#fff6d8' : '#ff3a3a', filter: 'url(#glow)' })]); T.g.appendChild(g); return [g, i]; });
  S.layer(.9).add(E.flat(HIM({ x: 760, y: 1560, s: .42, action: 'walk', speed: .7, rim: '#ffcf7a', key: 'lui' })));
  S.update(t => cars.forEach(([g, i]) => { const out = i % 2, u = CLIP.mod(t * (out ? .5 : .35) + i / 14, 1), z = out ? Math.pow(u, 2) : Math.pow(1 - u, 2), y = 1010 + z * 900, x = 540 + (out ? -1 : 1) * (30 + z * 340), sep = 6 + z * 120, r = 2 + z * 18;
    g.children[0].setAttribute('cx', x - sep / 2); g.children[1].setAttribute('cx', x + sep / 2); [...g.children].forEach(c => { c.setAttribute('cy', y); c.setAttribute('r', r); }); }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.06 }]], 'inOutSine', { handheld: 1 });
});

/* s12 — sa fenêtre allumée, il regarde la tour ; les autres fenêtres s'éteignent */
CLIP.scene('s12', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#080a14', '#141830', '#201e36']));
  S.layer(.05).add(E.stars({ n: 80, seed: 121 }));
  const b = haussmann(S, { x: 90, y: 2050, w: 900, s: 1.35, seed: 12, lit: .7, flick: false }); S.layer(.6).add(b);
  const win = h('g', { transform: 'translate(540,940)' }, [h('rect', { x: -110, y: -150, width: 220, height: 300, fill: '#ffcf7a' }), h('rect', { x: -110, y: -150, width: 220, height: 300, fill: '#fff2c0', opacity: .4, filter: 'url(#bigblur)' })]);
  const fig = E.flat({ who: 'him', view: 'back', x: 0, y: 330, s: .38, key: false, shadow: false, action: 'breathe' }); const fw = h('g'); fw.appendChild(fig.el); win.appendChild(fw); S.items.push(fig);
  S.defs.appendChild(h('clipPath', { id: 'w12' }, [h('rect', { x: -110, y: -150, width: 220, height: 300 })])); fw.setAttribute('clip-path', 'url(#w12)');
  win.appendChild(h('path', { d: 'M -110 -150 L 110 -150 L 110 150 L -110 150 Z M 0 -150 L 0 150 M -110 -20 L 110 -20', stroke: '#2a1e18', 'stroke-width': 10, fill: 'none' }));
  win.appendChild(h('path', { d: 'M -130 160 L 130 160 L 130 176 L -130 176 Z' + Array.from({ length: 13 }, (_, i) => ` M ${-120 + i * 20} 176 l 0 46`).join(''), stroke: '#120e10', 'stroke-width': 4, fill: '#120e10' }));
  S.layer(.62).add(win); S.key(win, 'sa fenêtre');
  const shade = h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: '#000', opacity: 0 }); S.layer(.61).add(shade);
  S.update(t => shade.setAttribute('opacity', .55 * ramp(t, .5, 1.8)));
  S.camera([[0, { x: 0, y: 60, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.1 }]], 'inOutSine');
});

/* s13 — minuit : dernier scintillement puis la tour s'éteint */
CLIP.scene('s13', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky(['#05060e', '#0e1124', '#1a1a32']));
  S.layer(.03).add(E.stars({ n: 160, seed: 131 }));
  const tw = eiffel(S, { x: 540, y: 1330, H: 1050, sparkle: t => t < 1.2 ? 1 : 0, lit: t => 1 - ramp(t, 1.2, .5) * .85, seed: 13 }); S.layer(.15).add(tw); S.key(tw.body, 'tour Eiffel');
  S.layer(.3).add(E.city({ y: 1360, color: '#0a0c18', seed: 132, minH: 60, maxH: 200, lit: .25 }));
  S.layer(.35).add(h('rect', { x: -800, y: 1360, width: 2700, height: 800, fill: '#080a14' }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.06 }], [1, { x: 0, y: 30, zoom: 1.0 }]], 'inOutSine');
});
