/* STYLE D — NÉON / INTERFACE SOCIALE
 * Fond bleu nuit, silhouettes humaines lumineuses, néon cyan, bokeh coloré, bulles de commentaires,
 * emojis (dessinés en vectoriel, sans police emoji), notifications, réactions de live.
 * Gabarits : neon.live   (amis, compter, abonnés, rencontre, « enchanté »)
 *            neon.reject (réseaux sociaux, refuser, bloquer, mépris)
 * Aucune parole inventée : les bulles contiennent des icônes et des traits, pas de texte.
 */
(function () {
  const C = window.CLIP;
  const CY = '#3ff0ff', MG = '#ff3fb4';
  function icon(h, kind, s = 1) {
    const g = h('g', { transform: `scale(${s})` });
    if (kind === 'heart') g.appendChild(h('path', { d: 'M 0 18 C -30 -4 -18 -30 0 -14 C 18 -30 30 -4 0 18 Z', fill: '#ff3f6c' }));
    if (kind === 'fire') g.append(h('path', { d: 'M 0 22 C -22 18 -24 -4 -6 -24 C -4 -8 6 -10 4 -22 C 22 -6 24 18 0 22 Z', fill: '#ff8a2a' }), h('path', { d: 'M 0 18 C -10 14 -8 2 0 -6 C 8 4 10 14 0 18 Z', fill: '#ffd23f' }));
    if (kind === 'laugh') g.append(h('circle', { r: 22, fill: '#ffd23f' }), h('path', { d: 'M -12 -6 q 4 -6 8 0 M 4 -6 q 4 -6 8 0', stroke: '#5a3a00', 'stroke-width': 3, fill: 'none' }), h('path', { d: 'M -12 4 Q 0 20 12 4 Z', fill: '#5a3a00' }));
    if (kind === 'clap') g.append(h('path', { d: 'M -14 18 L -20 -10 Q -18 -20 -10 -14 L -2 6 L 6 -18 Q 14 -24 16 -12 L 10 18 Z', fill: '#ffcf8a' }));
    if (kind === 'plus') g.append(h('circle', { r: 24, fill: CY }), h('path', { d: 'M -10 0 L 10 0 M 0 -10 L 0 10', stroke: '#06101e', 'stroke-width': 6, 'stroke-linecap': 'round' }));
    return g;
  }
  function base(S, P) {
    const { h, E } = S;
    S.layer(0).add(E.radial([[0, '#0d1d45'], [.6, '#071026'], [1, '#03060f']], { cx: .5, cy: .55, r: .8 }));
    S.layer(.1, { blur: 4 }).add(E.bokeh({ n: 26, colors: [CY, MG, '#6a5cff', '#2a8cff'], area: [-60, 300, 1200, 1500], size: [30, 110], opacity: .38 }));
    const grid = h('g', { opacity: .18 }); for (let i = -10; i <= 10; i++) grid.appendChild(h('line', { x1: 540 + i * 60, y1: 1350, x2: 540 + i * 260, y2: 2000, stroke: CY, 'stroke-width': 2 })); for (let k = 0; k < 7; k++) grid.appendChild(h('line', { x1: -200, y1: 1350 + k * k * 14, x2: 1300, y2: 1350 + k * k * 14, stroke: CY, 'stroke-width': 2 }));
    S.layer(.3).add(grid);
  }
  const neonFig = (S, o) => { const f = S.E.flat(Object.assign({ view: 'front', key: false, shadow: false, rim: CY, look: { skin: '#0b2235', top: '#071a2c', rib: '#0b2235', strings: CY, bottom: '#06121f', shoe: CY, hair: '#071a2c', hat: '#071a2c', hatRib: '#0b2235', gold: CY } }, o));
    f.el.style.filter = `drop-shadow(0 0 6px ${o.glow || CY}) drop-shadow(0 0 18px ${o.glow || CY})`; return f; };
  function liveUI(S) {
    const { h } = S, g = h('g', { transform: 'translate(720,250)' });
    g.append(h('rect', { width: 120, height: 52, rx: 12, fill: '#ff2d55' }), h('circle', { cx: 26, cy: 26, r: 8, fill: '#fff' }), h('rect', { x: 44, y: 18, width: 58, height: 16, rx: 8, fill: '#fff' }),
      h('rect', { x: 132, width: 70, height: 52, rx: 12, fill: 'rgba(255,255,255,.18)' }), h('circle', { cx: 152, cy: 26, r: 9, fill: 'none', stroke: '#fff', 'stroke-width': 4 }));
    S.layer(1.2).add(g); return g;
  }
  function bubbles(S, n, y0) {
    const { h } = S, out = [], kinds = ['heart', 'fire', 'laugh', 'clap'];
    for (let i = 0; i < n; i++) { const g = h('g'); g.append(h('rect', { x: 0, y: -34, width: 360, height: 68, rx: 34, fill: 'rgba(10,30,60,.75)', stroke: CY, 'stroke-width': 2 }), h('circle', { cx: 34, cy: 0, r: 22, fill: ['#6a5cff', MG, '#2a8cff', '#ffb02a'][i % 4] }),
      h('rect', { x: 70, y: -16, width: 150 + (i * 37) % 90, height: 12, rx: 6, fill: 'rgba(255,255,255,.75)' }), h('rect', { x: 70, y: 6, width: 90 + (i * 53) % 80, height: 10, rx: 5, fill: 'rgba(255,255,255,.4)' }));
      const ic = icon(h, kinds[i % 4], .9); ic.setAttribute('transform', 'translate(320,0) scale(.9)'); g.appendChild(ic); S.layer(1.1).add(g); out.push(g); }
    return out;
  }
  function reactions(S, n) { const { h } = S, out = [], kinds = ['heart', 'fire', 'laugh', 'heart', 'clap'];
    for (let i = 0; i < n; i++) { const g = h('g'); g.appendChild(icon(h, kinds[i % 5], 1.2)); S.layer(1.15).add(g); out.push([g, i * .37 % 1, (i * 71) % 100 / 100]); } return out; }

  C.template('neon.live', (S, P) => {
    const { h } = S; base(S, P); const ui = liveUI(S);
    const Dm = S.dur * .6, a = neonFig(S, { who: 'him', s: .52, arms: 'down', path: [[0, [200, 1500]], [Dm, [415, 1500]]], pathEase: 'inOutCubic', action: 'walk', anim: (q, t) => { if (t > Dm - .2) { q.armR = 70; q.liftL = q.liftR = q.bob = 0; } } }),
      b = neonFig(S, { who: 'her', s: .5, arms: 'down', glow: MG, rim: MG, path: [[0, [880, 1500]], [Dm, [665, 1500]]], pathEase: 'inOutCubic', action: 'walk', anim: (q, t) => { if (t > Dm - .2) { q.armL = 70; q.liftL = q.liftR = q.bob = 0; } } });
    S.layer(.8).add(a, b); S.key(a, 'silhouette 1', 'overlap'); S.key(b, 'silhouette 2', 'overlap');
    const spark = h('g'); const rays = [...Array(14)].map((_, i) => { const l = h('line', { stroke: i % 2 ? CY : MG, 'stroke-width': 6, 'stroke-linecap': 'round' }); spark.appendChild(l); return l; }); S.layer(.9).add(spark);
    const ring = h('circle', { fill: 'none', stroke: '#fff', 'stroke-width': 6 }); S.layer(.9).add(ring);
    const bub = bubbles(S, 5), rx = reactions(S, 16);
    const counter = h('g', { transform: 'translate(540,1180)' }); const digits = [...Array(4)].map((_, i) => { const r = h('g', { transform: `translate(${(i - 1.5) * 70},0)` }); counter.appendChild(r); return r; }); S.layer(1).add(counter);
    const seg = (h, n) => { const M = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd' }[n], P2 = { a: 'M -18 -40 L 18 -40', b: 'M 22 -36 L 22 -4', c: 'M 22 4 L 22 36', d: 'M -18 40 L 18 40', e: 'M -22 4 L -22 36', f: 'M -22 -36 L -22 -4', g: 'M -18 0 L 18 0' };
      return [...M].map(k => h('path', { d: P2[k], stroke: CY, 'stroke-width': 9, 'stroke-linecap': 'round', filter: 'url(#glow)' })); };
    S.update(t => {
      const D = S.dur, meet = S.Ease.inOutCubic(C.clamp(t / (D * .6)));
      const hit = C.clamp((t - D * .6) / .5); rays.forEach((l, i) => { const an = i / 14 * 6.28, r0 = 30 + hit * 120, r1 = r0 + 40 * (1 - hit); S.set(l, { x1: 540 + Math.cos(an) * r0, y1: 1200 + Math.sin(an) * r0, x2: 540 + Math.cos(an) * r1, y2: 1200 + Math.sin(an) * r1, opacity: hit > 0 && hit < 1 ? 1 - hit : 0 }); });
      S.set(ring, { cx: 540, cy: 1200, r: 20 + hit * 260, opacity: hit > 0 && hit < 1 ? (1 - hit) * .8 : 0 });
      bub.forEach((g, i) => { const k = S.Ease.outBack(C.clamp((t - .15 - i * .38) / .35)), y = 1240 - i * 0 - (t - .15 - i * .38) * 60; g.setAttribute('transform', `translate(${80},${1300 - (bub.length - i) * 0 - Math.max(0, (t - .15 - i * .38)) * 0 + (i - (Math.floor((t - .15) / .38))) * 86}) scale(${Math.max(0, k)})`); g.setAttribute('opacity', k > 0 ? 1 : 0); });
      rx.forEach(([g, ph, xr]) => { const u = (t * .6 + ph) % 1; g.setAttribute('transform', `translate(${830 + xr * 60 + Math.sin(u * 9 + xr * 6) * 26},${1420 - u * 900}) scale(${.6 + u * .6})`); g.setAttribute('opacity', (1 - u) * (t > .2 ? 1 : 0)); });
      const val = Math.floor(9900 * S.Ease.inOutCubic(C.clamp(t / D))) + Math.floor(t * 7); const str = String(val % 10000).padStart(4, '0');
      digits.forEach((d, i) => { d.innerHTML = ''; seg(h, +str[i]).forEach(p => d.appendChild(p)); });
      counter.setAttribute('transform', `translate(540,1180) scale(${1 + S.beat(t, 10) * .08})`); counter.setAttribute('opacity', 1 - hit);
      ui.setAttribute('opacity', .9 + .1 * Math.sin(t * 6));
    });
    S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: -20, zoom: 1.07 }]], 'inOutSine', { handheld: .6 });
  });

  C.template('neon.reject', (S, P) => {
    const { h } = S; base(S, P); liveUI(S);
    const card = h('g'), L = h('g'), R = h('g'); card.append(L, R); S.layer(1).add(card); S.key(card, 'carte profil', 'cut');
    const half = (g, clipX) => { const id = 'cl' + Math.random().toString(36).slice(2); S.defs.appendChild(h('clipPath', { id }, [h('rect', { x: clipX[0], y: -400, width: clipX[1], height: 800 })]));
      const c = h('g', { 'clip-path': `url(#${id})` }); c.append(h('rect', { x: -300, y: -330, width: 600, height: 660, rx: 40, fill: 'rgba(8,24,48,.92)', stroke: CY, 'stroke-width': 5 }), h('circle', { cy: -160, r: 92, fill: '#13325a', stroke: CY, 'stroke-width': 5 }),
        h('circle', { cy: -185, r: 34, fill: CY, opacity: .55 }), h('path', { d: 'M -60 -100 Q 0 -150 60 -100 Z', fill: CY, opacity: .55 }), h('rect', { x: -170, y: -30, width: 340, height: 30, rx: 15, fill: 'rgba(255,255,255,.85)' }), h('rect', { x: -120, y: 26, width: 240, height: 20, rx: 10, fill: 'rgba(255,255,255,.4)' }));
      const btn = icon(h, 'plus', 1.6); btn.setAttribute('transform', 'translate(0,190) scale(1.6)'); c.appendChild(btn); g.appendChild(c); };
    half(L, [-310, 310]); half(R, [0, 310]);
    const X = h('path', { d: 'M -150 -150 L 150 150 M 150 -150 L -150 150', stroke: '#ff2d55', 'stroke-width': 44, 'stroke-linecap': 'round', filter: 'url(#glow)', pathLength: 1, 'stroke-dasharray': 1 }); card.appendChild(X);
    const crack = h('path', { d: 'M 0 -330 L 18 -200 L -16 -80 L 22 40 L -10 180 L 6 330', fill: 'none', stroke: '#fff', 'stroke-width': 6 }); card.appendChild(crack);
    const spit = h('g'); spit.append(h('path', { d: 'M 0 -26 Q 30 -6 22 18 Q 0 34 -22 18 Q -30 -6 0 -26 Z', fill: '#d8f6ff', stroke: '#06101e', 'stroke-width': 4 })); S.layer(1.05).add(spit);
    const drops = [...Array(10)].map(() => { const e = h('circle', { r: 8, fill: '#d8f6ff', stroke: '#06101e', 'stroke-width': 3 }); S.layer(1.05).add(e); return e; });
    const toasts = [0, 1, 2].map(i => { const g = h('g'); g.append(h('rect', { x: 0, y: 0, width: 520, height: 96, rx: 24, fill: 'rgba(20,40,80,.85)', stroke: MG, 'stroke-width': 3 }), h('circle', { cx: 48, cy: 48, r: 26, fill: MG }), h('rect', { x: 92, y: 30, width: 280, height: 14, rx: 7, fill: '#fff' }), h('rect', { x: 92, y: 56, width: 180, height: 12, rx: 6, fill: 'rgba(255,255,255,.5)' })); S.layer(1.1).add(g); return g; });
    S.update(t => {
      const D = S.dur, kIn = S.Ease.outBack(C.clamp(t / .4)), kx = C.clamp((t - D * .32) / .25), kSpit = C.clamp((t - D * .5) / .3), kBreak = S.Ease.inCubic(C.clamp((t - D * .62) / .6));
      const shake = kx > 0 && kx < 1 ? Math.sin(t * 80) * 10 : 0;
      card.setAttribute('transform', `translate(${540 + shake},${1080}) scale(${.6 + .4 * kIn})`);
      X.setAttribute('stroke-dashoffset', 1 - kx); crack.setAttribute('opacity', kBreak > 0 ? 1 : 0);
      L.setAttribute('transform', `translate(${-kBreak * 160},${kBreak * kBreak * 900}) rotate(${-kBreak * 40})`); R.setAttribute('transform', `translate(${kBreak * 160},${kBreak * kBreak * 900}) rotate(${kBreak * 40})`);
      X.setAttribute('opacity', 1 - kBreak);
      const sx = -100 + kSpit * 640, sy = 1300 - Math.sin(kSpit * Math.PI) * 360 - kSpit * 220; spit.setAttribute('transform', `translate(${sx},${sy}) rotate(${kSpit * 400})`); spit.setAttribute('opacity', kSpit > 0 && kSpit < 1 ? 1 : 0);
      const sp = C.clamp((t - D * .5 - .3) / .5); drops.forEach((e, i) => { const an = i / 10 * 6.28; S.set(e, { cx: 540 + Math.cos(an) * sp * 220, cy: 1080 + Math.sin(an) * sp * 220 + sp * sp * 120, opacity: sp > 0 && sp < 1 ? 1 - sp : 0 }); });
      toasts.forEach((g, i) => { const k = S.Ease.outExpo(C.clamp((t - .3 - i * .5) / .4)), out = C.clamp((t - 1.6 - i * .5) / .3); g.setAttribute('transform', `translate(${300 + (1 - k) * 700},${1470 + i * 110})`); g.setAttribute('opacity', k * (1 - out)); });
    });
    S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [.6, { x: 0, y: 0, zoom: 1.04 }], [1, { x: 0, y: 30, zoom: .98, rot: 1.5 }]], 'inOutSine', { handheld: .8 });
  });
})();
