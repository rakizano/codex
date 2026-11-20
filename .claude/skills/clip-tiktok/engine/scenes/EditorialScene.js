/* STYLE B — MOTION DESIGN ÉDITORIAL
 * Papier crème texturé, graphiques animés, barres et formes géométriques, typographie grasse,
 * mots surlignés, apparitions progressives, illustrations minimalistes : une infographie haut de gamme.
 * Gabarit : editorial.chart (argent, prix, chiffres, comparer, coût, santé)
 * params : accent (couleur de la barre vedette), ink, motif: 'ecg' | 'coins' | 'arrow', bars (nb)
 */
(function () {
  const C = window.CLIP;
  C.template('editorial.chart', (S, P) => {
    const { h, E } = S, ink = P.ink || '#1b1a17', acc = P.accent || '#e9a23b', paper = P.paper || '#f2e8d5';
    const ramp = (t, a, d) => C.clamp((t - a) / d);
    S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: paper }));
    // texture papier : fibres + grain
    const fib = h('g', { opacity: .35 }); const r = S.rng; for (let i = 0; i < 260; i++) { const x = r() * 1200 - 60, y = r() * 2000 - 40, a = r() * 6.28, l = 6 + r() * 26; fib.appendChild(h('line', { x1: x, y1: y, x2: x + Math.cos(a) * l, y2: y + Math.sin(a) * l, stroke: r() < .5 ? '#d8c9ab' : '#fffaf0', 'stroke-width': 1.4 })); } S.layer(0).add(fib);
    const G = S.layer(.3); for (let y = 760; y <= 1400; y += 80) G.add(h('line', { x1: 110, y1: y, x2: 970, y2: y, stroke: ink, 'stroke-width': 1.5, opacity: .12 }));
    // formes géométriques
    const circ = h('circle', { cx: 860, cy: 820, r: 120, fill: 'none', stroke: acc, 'stroke-width': 18, 'stroke-dasharray': '40 22' }); S.layer(.4).add(circ);
    const sq = [0, 1, 2].map(i => { const e = h('rect', { width: 46, height: 46, fill: i === 1 ? acc : ink }); S.layer(.5).add(e); return e; });
    const tri = h('path', { d: 'M 0 -40 L 36 26 L -36 26 Z', fill: 'none', stroke: ink, 'stroke-width': 8 }); S.layer(.45).add(tri);
    // diagramme en barres
    const n = P.bars || 6, base = 1400, bw = 96, gap = 46, x0 = 150, vals = P.values || [.28, .4, .35, .58, .7, .95], bars = [];
    const B = S.layer(.7); B.add(h('line', { x1: 120, y1: base, x2: 980, y2: base, stroke: ink, 'stroke-width': 6, 'stroke-linecap': 'round' }));
    for (let i = 0; i < n; i++) { const hi = i === n - 1; const e = h('rect', { x: x0 + i * (bw + gap), width: bw, fill: hi ? acc : ink, rx: 6 }); B.add(e); bars.push([e, vals[i % vals.length], hi]);
      B.add(h('rect', { x: x0 + i * (bw + gap), y: base + 18, width: bw, height: 14, rx: 7, fill: ink, opacity: .25 })); }
    S.key(B.g, 'graphique');
    const trend = h('path', { fill: 'none', stroke: acc, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 });
    const head = h('path', { d: 'M -26 -18 L 8 0 L -26 18', fill: 'none', stroke: acc, 'stroke-width': 10, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); B.g.append(trend, head);
    // motif illustratif minimaliste
    let motif = null;
    if (P.motif === 'ecg') { motif = h('path', { d: 'M 110 760 L 360 760 L 400 700 L 440 840 L 480 640 L 520 800 L 560 760 L 980 760', fill: 'none', stroke: '#c8323c', 'stroke-width': 8, 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }); S.layer(.6).add(motif); }
    if (P.motif === 'coins') { motif = h('g'); for (let i = 0; i < 7; i++) motif.appendChild(h('ellipse', { cx: 820, cy: 1360 - i * 26, rx: 70, ry: 20, fill: acc, stroke: ink, 'stroke-width': 5 })); S.layer(.8).add(motif); }
    S.update(t => {
      const D = S.dur;
      bars.forEach(([e, v, hi], i) => { const k = S.Ease.outBack(ramp(t, .1 + i * .09, .45)), hh = Math.max(0, k) * v * 560 * (1 + (hi ? S.beat(t, 8) * .04 : 0)); S.set(e, { y: base - hh, height: hh }); });
      const pts = bars.map(([e, v], i) => [x0 + i * (bw + gap) + bw / 2, base - v * 560 - 50]);
      trend.setAttribute('d', 'M ' + pts.map(p => p.join(' ')).join(' L ')); const kt = ramp(t, .5, D * .5); trend.setAttribute('stroke-dashoffset', 1 - kt);
      const q = Math.min(pts.length - 1, Math.floor(kt * (pts.length - 1))), qq = kt * (pts.length - 1) - q, a = pts[q], b = pts[Math.min(q + 1, pts.length - 1)];
      head.setAttribute('transform', `translate(${a[0] + (b[0] - a[0]) * qq},${a[1] + (b[1] - a[1]) * qq}) rotate(${Math.atan2(b[1] - a[1], b[0] - a[0]) * 57.3})`); head.setAttribute('opacity', kt > .02 ? 1 : 0);
      circ.setAttribute('transform', `rotate(${t * 40} 860 820)`); circ.setAttribute('opacity', S.Ease.outCubic(ramp(t, 0, .4)));
      sq.forEach((e, i) => { const k = S.Ease.outExpo(ramp(t, .2 + i * .15, .5)); S.set(e, { x: 130 + i * 62 - (1 - k) * 400, y: 1480 }); e.setAttribute('transform', `rotate(${(1 - k) * -90} ${130 + i * 62 + 23} 1503)`); });
      tri.setAttribute('transform', `translate(${940 - S.Ease.outCubic(ramp(t, .3, .6)) * 60},1500) rotate(${t * 60})`);
      if (P.motif === 'ecg') motif.setAttribute('stroke-dashoffset', 1 - ramp(t, 0, D * .7));
      if (P.motif === 'coins') [...motif.children].forEach((c, i) => c.setAttribute('opacity', t > .2 + i * .12 ? 1 : 0));
    });
    S.camera([[0, { x: 0, y: 20, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.05, rot: -.6 }]], 'inOutSine', { handheld: 0 });
  });
})();
