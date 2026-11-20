/* STYLE G — DESSIN PASTEL / NARRATION ILLUSTRÉE
 * Papier blanc cassé, illustrations au crayon qui se dessinent progressivement, aplats pastel qui
 * apparaissent ensuite, nuages, bâtiments, petit personnage, traits volontairement irréguliers.
 * Gabarit : pastel.storm (douleur, mal, peur, empirer, tristesse, pluie, souvenir)
 * params : worsen (bool : le nuage grossit et s'assombrit), palette
 */
(function () {
  const C = window.CLIP;
  C.template('pastel.storm', (S, P) => {
    const { h } = S, pencil = '#4a4650', paper = '#f8f3ea';
    const pal = Object.assign({ sky: '#cfe2f3', rose: '#f6cdd3', leaf: '#d6e8c4', sand: '#f3e2b8', cloud: '#e6e8f0', storm: '#8d93ab' }, P.palette || {});
    S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: paper }));
    const grain = h('g', { opacity: .22 }); const r = S.rng; for (let i = 0; i < 380; i++) grain.appendChild(h('circle', { cx: r() * 1100, cy: r() * 1950, r: .7 + r() * 1.2, fill: '#b8b0a0' })); S.layer(0).add(grain);
    const W_ = S.layer(.3), D = S.layer(.5); S.boil(D, 'wobble', 6);
    const draws = [], fills = [];
    const pen = (d, t0, dur, extra) => { const e = h('path', Object.assign({ d, fill: 'none', stroke: pencil, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }, extra || {})); D.add(e); draws.push([e, t0, dur]); return e; };
    const wash = (d, col, t0) => { const e = h('path', { d, fill: col, opacity: 0 }); W_.add(e); fills.push([e, t0]); return e; };
    // ciel + colline
    wash('M -50 300 L 1130 300 L 1130 1380 L -50 1380 Z', pal.sky, .2);
    wash('M -50 1380 Q 300 1300 600 1360 T 1130 1340 L 1130 1990 L -50 1990 Z', pal.leaf, .5);
    pen('M -30 1380 Q 300 1300 600 1360 T 1120 1340', 0, .5);
    // maisons
    const houses = [[110, 1180, 150, 200, pal.rose], [290, 1230, 130, 150, pal.sand], [690, 1160, 170, 220, pal.rose], [890, 1220, 140, 160, pal.sand]];
    houses.forEach(([x, y, w, hh, col], i) => { const d = `M ${x} ${y + hh} L ${x} ${y} L ${x + w / 2} ${y - w * .45} L ${x + w} ${y} L ${x + w} ${y + hh}`;
      wash(d + ' Z', col, .5 + i * .12); pen(d, .1 + i * .12, .45); pen(`M ${x + w * .3} ${y + hh} L ${x + w * .3} ${y + hh * .55} L ${x + w * .55} ${y + hh * .55} L ${x + w * .55} ${y + hh}`, .3 + i * .12, .25, { 'stroke-width': 3 });
      pen(`M ${x + w * .62} ${y + 30} l 34 0 l 0 34 l -34 0 Z`, .35 + i * .12, .2, { 'stroke-width': 3 }); });
    // petit personnage au parapluie qui marche
    const guy = h('g'); D.add(guy); S.key(guy, 'personnage', 'overlap');
    const um = h('path', { d: 'M -70 -150 Q 0 -230 70 -150 Q 46 -160 24 -150 Q 0 -162 -24 -150 Q -46 -160 -70 -150 Z', fill: pal.rose, stroke: pencil, 'stroke-width': 4 });
    guy.append(um, h('path', { d: 'M 0 -150 L 0 -60', stroke: pencil, 'stroke-width': 4 }), h('circle', { cx: 0, cy: -100, r: 18, fill: paper, stroke: pencil, 'stroke-width': 4 }),
      h('path', { d: 'M 0 -82 L 0 -30', stroke: pencil, 'stroke-width': 4 }));
    const legs = h('path', { fill: 'none', stroke: pencil, 'stroke-width': 4, 'stroke-linecap': 'round' }); guy.appendChild(legs);
    // nuage qui grossit et s'assombrit (« qui semble empirer »)
    const cloud = h('g'); S.layer(.55).add(cloud); S.key(cloud, 'nuage', 'text');
    const cl = 'M -220 40 Q -260 -40 -170 -60 Q -150 -150 -50 -120 Q 10 -200 100 -130 Q 200 -160 210 -60 Q 290 -30 230 40 Z';
    const cfill = h('path', { d: cl, fill: pal.cloud }); const cline = h('path', { d: cl, fill: 'none', stroke: pencil, 'stroke-width': 4, pathLength: 1, 'stroke-dasharray': 1 }); cloud.append(cfill, cline);
    const rain = [...Array(26)].map((_, i) => { const e = h('path', { stroke: '#7d94c4', 'stroke-width': 4, 'stroke-linecap': 'round' }); S.layer(.56).add(e); return [e, i]; });
    const bolt = h('path', { d: 'M 40 60 L 0 160 L 40 160 L -10 280', fill: 'none', stroke: '#e8b830', 'stroke-width': 9, 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': 1 }); cloud.appendChild(bolt);
    S.update(t => {
      const Dd = S.dur;
      draws.forEach(([e, t0, d]) => e.setAttribute('stroke-dashoffset', 1 - S.Ease.inOutSine(C.clamp((t - t0) / d))));
      fills.forEach(([e, t0]) => e.setAttribute('opacity', .85 * S.Ease.outCubic(C.clamp((t - t0) / .5))));
      const g = P.worsen === false ? 0 : S.Ease.inOutSine(C.clamp(t / Dd));
      cloud.setAttribute('transform', `translate(${540 + Math.sin(t * .8) * 20},${860 + g * 40}) scale(${.8 + g * .55})`);
      cfill.setAttribute('fill', S.mix(pal.cloud, pal.storm, g)); cline.setAttribute('stroke-dashoffset', 1 - C.clamp(t / .6));
      rain.forEach(([e, i]) => { const st = .35 + (i % 9) * .05, u = ((t - st) * 1.6 + i * .37) % 1; const x = 380 + (i * 47) % 360 + u * -20, y = 960 + u * 420; const on = t > st && g > .25;
        e.setAttribute('d', `M ${x} ${y} l -8 ${34}`); e.setAttribute('opacity', on ? .8 : 0); });
      bolt.setAttribute('stroke-dashoffset', 1 - C.clamp((t - Dd * .75) / .15)); bolt.setAttribute('opacity', t > Dd * .75 ? 1 - C.clamp((t - Dd * .9) / .2) : 0);
      const gx = 420 + t * 70, step = Math.sin(t * 9); guy.setAttribute('transform', `translate(${gx},${1380 - Math.abs(step) * 6})`); legs.setAttribute('d', `M 0 -30 L ${-14 * step} 0 M 0 -30 L ${14 * step} 0`);
      um.setAttribute('transform', `rotate(${Math.sin(t * 2) * 6} 0 -150)`);
    });
    S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 30, y: -10, zoom: 1.05 }]], 'inOutSine', { handheld: 0 });
  });
})();
