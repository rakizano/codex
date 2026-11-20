/* STYLE C — CARTOON DESSINÉ À LA MAIN
 * Contours noirs irréguliers (trait « vivant »), décors dessinés, palette sépia / beige / crème,
 * personnages expressifs, objets anthropomorphes, gags, mouvements volontairement imparfaits.
 * Gabarit : cartoon.dig (salir, creuser, enterrer, galère, humour)
 * params : paper, ink
 */
(function () {
  const C = window.CLIP;
  C.template('cartoon.dig', (S, P) => {
    const { h } = S, ink = P.ink || '#22180f', paper = P.paper || '#efe0c2', sep = ['#c9a676', '#a77d4f', '#7b5634', '#e8d2a6'];
    const ramp = (t, a, d) => C.clamp((t - a) / d);
    S.layer(0).add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: paper }));
    const stains = S.layer(.05); const r = S.rng; for (let i = 0; i < 14; i++) stains.add(h('circle', { cx: r() * 1080, cy: r() * 1920, r: 40 + r() * 140, fill: '#d9c39a', opacity: .25 }));
    const D = S.layer(.6); S.boil(D, 'rough', 8);          // trait qui « bout » comme un dessin animé fait main
    const L = { stroke: ink, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    // décor : colline, clôture, soleil grimaçant
    D.add(h('path', Object.assign({ d: 'M -100 1330 Q 200 1290 420 1320 T 1180 1310 L 1180 2000 L -100 2000 Z', fill: sep[3] }, L)));
    for (let x = -40; x < 1120; x += 60) D.add(h('path', Object.assign({ d: `M ${x} 1400 l 14 -22 M ${x + 22} 1430 l 12 -18`, fill: 'none' }, L, { 'stroke-width': 4 })));
    for (let i = 0; i < 6; i++) D.add(h('path', Object.assign({ d: `M ${80 + i * 70} 1300 L ${84 + i * 70} 1200 L ${100 + i * 70} 1186 L ${112 + i * 70} 1202 L ${110 + i * 70} 1300`, fill: '#e8d2a6' }, L, { 'stroke-width': 5 })));
    const sun = h('g', { transform: 'translate(880,820)' }, [h('circle', Object.assign({ r: 70, fill: '#f0c26a' }, L)), h('path', Object.assign({ d: 'M -24 -8 l 12 0 M 14 -8 l 12 0 M -20 22 Q 0 10 22 24', fill: 'none' }, L, { 'stroke-width': 5 }))]);
    D.add(sun);
    // trou + monticule qui grandit
    const hole = h('ellipse', Object.assign({ cx: 400, cy: 1340, rx: 120, ry: 26, fill: '#3a2616' }, L)); D.add(hole);
    const mound = h('path', Object.assign({ fill: sep[1] }, L)); D.add(mound);
    // pelle anthropomorphe (yeux, bouche, sueur) + gants de dessin animé
    const shovel = h('g'); D.add(shovel); S.key(shovel, 'pelle');
    shovel.append(h('path', Object.assign({ d: 'M 0 -380 L 0 -40', fill: 'none' }, L, { 'stroke-width': 16, stroke: '#7b5634' })), h('path', Object.assign({ d: 'M 0 -380 L 0 -40', fill: 'none' }, L, { 'stroke-width': 4 })),
      h('path', Object.assign({ d: 'M -34 -400 L 34 -400 L 30 -370 L -30 -370 Z', fill: '#c9a676' }, L)),
      h('path', Object.assign({ d: 'M -70 -40 L 70 -40 Q 76 60 0 120 Q -76 60 -70 -40 Z', fill: '#b9b2a2' }, L)));
    const eyes = h('g'); eyes.append(h('ellipse', Object.assign({ cx: -26, cy: 6, rx: 20, ry: 24, fill: '#fff' }, L, { 'stroke-width': 5 })), h('ellipse', Object.assign({ cx: 26, cy: 6, rx: 20, ry: 24, fill: '#fff' }, L, { 'stroke-width': 5 })));
    const pupils = h('g'); pupils.append(h('circle', { cx: -22, cy: 12, r: 8, fill: ink }), h('circle', { cx: 30, cy: 12, r: 8, fill: ink }));
    const mouth = h('path', Object.assign({ fill: '#7a2a1a' }, L, { 'stroke-width': 5 })); shovel.append(eyes, pupils, mouth);
    const sweat = [0, 1].map(() => { const e = h('path', Object.assign({ d: 'M 0 0 Q 10 16 0 24 Q -10 16 0 0 Z', fill: '#bfe3ff' }, L, { 'stroke-width': 3 })); D.add(e); return e; });
    const glove = (x, y) => h('g', { transform: `translate(${x},${y})` }, [h('path', Object.assign({ d: 'M -34 -20 Q -40 -48 -12 -46 L 30 -44 Q 46 -36 40 -14 L 36 22 Q 10 36 -26 22 Z', fill: '#fff' }, L, { 'stroke-width': 6 })), h('path', Object.assign({ d: 'M -20 -8 L 24 -8 M -18 6 L 24 6', fill: 'none' }, L, { 'stroke-width': 4 }))]);
    const g1 = glove(0, -290), g2 = glove(0, -170); shovel.append(g1, g2);
    // mottes de terre en arc + mouche qui tourne (gag)
    const clumps = [...Array(9)].map(() => { const e = h('path', Object.assign({ fill: sep[2] }, L, { 'stroke-width': 4 })); D.add(e); return e; });
    const fly = h('g', {}, [h('ellipse', Object.assign({ rx: 9, ry: 7, fill: ink }, L, { 'stroke-width': 2 })), h('ellipse', { cx: -6, cy: -10, rx: 8, ry: 5, fill: '#fff', stroke: ink, 'stroke-width': 2, opacity: .9 }), h('ellipse', { cx: 6, cy: -10, rx: 8, ry: 5, fill: '#fff', stroke: ink, 'stroke-width': 2, opacity: .9 })]);
    const trail = h('path', { fill: 'none', stroke: ink, 'stroke-width': 3, 'stroke-dasharray': '6 10', opacity: .6 }); D.g.append(trail, fly);
    S.update(t => {
      const cyc = .82, ph = (t % cyc) / cyc;   // creuser : plonger → soulever → lancer
      const dig = ph < .4 ? S.Ease.inOutSine(ph / .4) : ph < .7 ? 1 - S.Ease.outBack((ph - .4) / .3) * .9 : .1 * (1 - (ph - .7) / .3);
      const rot = -18 + dig * 30 - (ph > .4 && ph < .7 ? (ph - .4) / .3 * 30 : 0), sq = 1 + (ph > .38 && ph < .46 ? -.08 : 0);
      shovel.setAttribute('transform', `translate(${470 + dig * -30},${1330 - (1 - dig) * 120}) rotate(${rot}) scale(${1 / sq},${sq})`);
      pupils.setAttribute('transform', `translate(${dig * -6},${dig * 8})`);
      mouth.setAttribute('d', dig > .6 ? 'M -18 46 Q 0 70 18 46 Q 0 54 -18 46 Z' : 'M -16 52 Q 0 40 16 52 Q 0 60 -16 52 Z');
      const m = Math.min(1, t / S.dur + .25); mound.setAttribute('d', `M ${640} 1330 Q ${760} ${1330 - 160 * m} ${880} 1330 Z`);
      hole.setAttribute('ry', 26 + m * 10);
      clumps.forEach((e, i) => { const u = ((t * 1.3 + i / 9) % 1); const x = 420 + u * 340, y = 1300 - Math.sin(u * Math.PI) * 300; e.setAttribute('d', `M ${x - 14} ${y} q 8 -16 22 -6 q 12 8 -2 16 q -14 6 -20 -10 Z`); e.setAttribute('opacity', u < .95 ? 1 : 0); });
      sweat.forEach((e, i) => { const u = ((t * 1.6 + i * .5) % 1); e.setAttribute('transform', `translate(${560 + i * 20 + u * 30},${1000 + u * 120})`); e.setAttribute('opacity', 1 - u); });
      const fx = 300 + Math.cos(t * 4) * 140 + Math.cos(t * 9) * 20, fy = 1080 + Math.sin(t * 5.3) * 70; fly.setAttribute('transform', `translate(${fx},${fy}) rotate(${Math.sin(t * 30) * 12})`);
      let d = ''; for (let k = 0; k < 14; k++) { const tt = t - k * .05; d += (k ? ' L ' : 'M ') + (300 + Math.cos(tt * 4) * 140 + Math.cos(tt * 9) * 20) + ' ' + (1080 + Math.sin(tt * 5.3) * 70); } trail.setAttribute('d', d);
      sun.setAttribute('transform', `translate(880,820) rotate(${Math.sin(t * 2) * 8}) scale(${1 + S.beat(t, 7) * .06})`);
    });
    S.camera([[0, { x: -20, y: 0, zoom: 1.02 }], [1, { x: 20, y: -10, zoom: 1.06 }]], 'inOutSine', { handheld: .5 });
  });
})();
