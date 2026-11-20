/* STYLE Z — « ZINE » COLLAGE NOIR & BLANC (style maison de l'utilisateur, d'après sa vidéo de référence)
 * Fond papier blanc à forte vignette tramée (halftone), images N&B tramées (silhouettes, porte, cité),
 * éléments découpés collés (billets génériques…) en stop-motion, barres noires, typographie rouge / noir /
 * jaune (étiquettes en escalier, lettres de rançon, sérif rouge en relief, machine à écrire, condensé géant).
 * Gabarits : zine.blank · zine.door · zine.cite · zine.collage · zine.spot
 * params : variant, bars (bool), items ('bills' | 'mixed'), dark (bool)
 */
(function () {
  const C = window.CLIP;
  const step = (t, fps = 12) => Math.floor(t * fps) / fps;   // mouvement saccadé façon stop-motion
  function paper(S, o = {}) {
    const { h, E } = S;
    const L = S.layer(0);
    L.add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: o.dark ? '#5a5a5a' : '#f6f4f0' }));
    // vignette elliptique calée sur le cadre 1080×1920 (puis tramée en points)
    const gid = 'zv' + S.index, st = o.dark ? [[0, '#ffffff'], [.35, '#9a9a9a'], [1, '#2a2a2a']] : [[0, '#ffffff'], [.6, '#fcfbf9'], [.86, '#b4b1ac'], [1, '#4e4d4a']];
    S.defs.appendChild(h('radialGradient', { id: gid, cx: .5, cy: o.cy ?? .48, r: o.r ?? .7 }, st.map(([k, c]) => h('stop', { offset: k, 'stop-color': c }))));
    L.add(h('rect', { x: -800, y: -800, width: 2700, height: 3600, fill: st[st.length - 1][1] }), h('rect', { x: -60, y: -60, width: 1200, height: 2040, fill: `url(#${gid})` }));
    S.halftone(o.cell || 9, L.g);
    return L;
  }
  function bars(S, n = 2) {
    const { h } = S, B = S.layer(1.4), els = [];
    for (let i = 0; i < n; i++) { const e = h('rect', { height: 170 + i * 60, fill: i % 2 ? '#8c8c8c' : '#0d0d0d' }); B.add(e); els.push(e); }
    S.update(t => els.forEach((e, i) => { const k = S.Ease.inOutCubic(C.clamp((step(t) - .1 - i * .18) / .5)), out = S.Ease.inCubic(C.clamp((step(t) - S.dur + .55 - i * .1) / .4));
      S.set(e, { x: -1200 + k * 1240 + out * 1300, y: i ? 1500 : 150, width: 1100 }); }));
  }
  // billet générique (pas une reproduction de vraie monnaie) : cadre, guilloches, gros chiffre
  function bill(h, v, col) {
    const g = h('g'); const c = col || ['#d98a4a', '#9cc28a', '#7fb0d8'][v % 3];
    g.append(h('rect', { x: -170, y: -90, width: 340, height: 180, rx: 8, fill: '#f3ead6', stroke: '#2a2a2a', 'stroke-width': 2 }),
      h('rect', { x: -160, y: -80, width: 320, height: 160, rx: 4, fill: c, opacity: .55 }),
      h('path', { d: Array.from({ length: 9 }, (_, i) => `M -150 ${-60 + i * 15} Q 0 ${-90 + i * 15} 150 ${-60 + i * 15}`).join(' '), stroke: '#5a3a1a', 'stroke-width': 1.5, fill: 'none', opacity: .5 }),
      h('circle', { cx: 80, cy: 0, r: 52, fill: 'none', stroke: '#5a3a1a', 'stroke-width': 3, opacity: .6 }),
      h('rect', { x: -150, y: -70, width: 60, height: 140, fill: '#fff', opacity: .35 }));
    const tx = h('text', { x: -40, y: 26, 'font-family': 'Anton, sans-serif', 'font-size': 92, fill: '#3a2414', 'text-anchor': 'middle' }); tx.textContent = String([50, 20, 10][v % 3]); g.appendChild(tx);
    g.setAttribute('filter', 'url(#softshadow)'); return g;
  }
  function ensureShadow(S) { if (!document.getElementById('softshadow')) S.defs.appendChild(S.h('filter', { id: 'softshadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, [S.h('feDropShadow', { dx: 8, dy: 12, stdDeviation: 8, 'flood-color': '#000', 'flood-opacity': .35 })])); }

  /* Fond papier tramé seul (scènes typographiques) + barres noires en option */
  C.template('zine.blank', (S, P) => { paper(S, P); if (P.bars !== false) bars(S, 2); S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.04 }]], 'linear', { handheld: 0 }); });

  function door(S, P) {
    const { h, E } = S, D = S.layer(.6);
    D.add(h('rect', { x: 330, y: 380, width: 420, height: 1200, fill: '#e8e6e2' }), h('rect', { x: 370, y: 430, width: 340, height: 1150, fill: E.gradientDef([[0, '#8a8a8a'], [.5, '#6a6a6a'], [1, '#4a4a4a']], true) }),
      h('circle', { cx: 540, cy: 640, r: 22, fill: '#fafafa' }), h('rect', { x: 395, y: 1000, width: 40, height: 16, fill: '#eaeaea' }));
    D.add(h('ellipse', { cx: 540, cy: 1000, rx: 260, ry: 500, fill: '#9a9a9a', opacity: .35, filter: 'url(#bigblur)' }));
    S.halftone(P.cell || 9, D.g);
    const fig = E.person({ x: 560, y: 1610, s: 2.35, silhouette: '#050505', action: P.action || 'sway', speed: .8, pose: P.pose || 'stand', key: P.key === false ? false : 'silhouette', keyAllow: 'cut,ui' });
    S.layer(.8).add(fig);
  }
  /* Silhouette noire devant une porte, contre-jour, tout en trame */
  C.template('zine.door', (S, P) => {
    paper(S, P); door(S, P);
    S.camera([[0, { x: 0, y: 30, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.08 }]], 'inOutSine', { handheld: .3 });
  });

  /* La cité en N&B tramé (3D) : tours, fenêtres, arbres, ciel couvert, lent travelling */
  C.template('zine.cite', (S, P) => {
    const X = C.three(S, { bg: 0xd9d9d9, fog: [0xd9d9d9, 30, 120], exposure: 1.05 }); const T = X.T, K = C.K3;
    X.add(new T.HemisphereLight(0xffffff, 0x444444, 1.1)); const sun = new T.DirectionalLight(0xffffff, .8); sun.position.set(-20, 30, 20); X.add(sun);
    const g = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x777777, roughness: 1 })); g.rotation.x = -Math.PI / 2; X.add(g);
    const r = C.rng(S.id);
    for (let i = 0; i < 9; i++) { const w = 10 + r() * 14, hh = 20 + r() * 32, d = 8;
      const tex = K.windowsTexture(T, { cols: Math.round(w / 1.4), rows: Math.round(hh / 2.2), lit: .5, color: '#d8d8d8', wall: '#4a4a4a', seed: i + 7 });
      const m = new T.Mesh(new T.BoxGeometry(w, hh, d), new T.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: .9 })); m.position.set(-70 + i * 17 + r() * 4, hh / 2, -60 - r() * 30); X.add(m); }
    for (let i = 0; i < 26; i++) { const tr = new T.Mesh(new T.SphereGeometry(3 + r() * 3, 8, 6), new T.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1, flatShading: true })); tr.position.set(-80 + i * 6.5, 3 + r() * 2, -28 - r() * 10); tr.scale.y = 1.3; X.add(tr); }
    X.camMove('truck', { from: [-12, 6, 30], to: [12, 7, 30], target: t => new T.Vector3(-12 + t * 4, 14, -60), ease: 'linear' });
    S.halftone(P.cell || 8, X.layer.g);
    S.key(X.el, 'cité', 'cut,ui,text');
  });

  /* Collage : billets découpés qui tombent en stop-motion, sur papier ou devant la silhouette */
  C.template('zine.collage', (S, P) => {
    const { h, E } = S; ensureShadow(S);
    paper(S, P);
    if (P.base === 'door') door(S, { key: false });
    const items = [], Cg = S.layer(1);
    for (let i = 0; i < (P.n || 7); i++) { const b = bill(h, i); Cg.add(b); items.push([b, i]); }
    S.key(Cg.g, 'collage', 'cut,overlap,text');
    S.update(t => { const tq = step(t, 12);
      items.forEach(([b, i]) => { const t0 = .1 + i * .16, k = C.clamp((tq - t0) / .35), e = S.Ease.outBack(k);
        const x = 540 + Math.sin(i * 2.1) * 230, y = 1080 + Math.cos(i * 1.7) * 200 - i * 14, x0 = i % 2 ? 1500 : -400, y0 = 300 + i * 90;
        b.setAttribute('transform', `translate(${x0 + (x - x0) * e},${y0 + (y - y0) * e}) rotate(${(i * 23 % 40) - 20 + (1 - k) * 90}) scale(${1.25 - i * .03})`); b.setAttribute('opacity', k > 0 ? 1 : 0); }); });
    S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.05, rot: -1 }]], 'linear', { handheld: 0 });
  });

  /* Projecteur tramé sur fond gris sombre + liasses posées */
  C.template('zine.spot', (S, P) => {
    const { h } = S; ensureShadow(S); paper(S, { dark: true, cy: .55, r: .5, cell: 10 });
    const st = S.layer(.9); const stack = h('g'); st.add(stack); S.key(stack, 'liasses', 'text');
    for (let i = 0; i < 9; i++) { const b = bill(h, i % 3, '#cfcfcf'); b.setAttribute('transform', `translate(${540 + (i % 3 - 1) * 150 + Math.sin(i) * 20},${1120 - Math.floor(i / 3) * 34}) rotate(${(i * 17 % 24) - 12}) scale(.95)`); stack.appendChild(b); }
    S.halftone(7, st.g);
    S.update(t => stack.setAttribute('transform', `translate(0,${step(t, 8) * -6})`));
    S.camera([[0, { x: 0, y: 20, zoom: 1.0 }], [1, { x: 0, y: -10, zoom: 1.07 }]], 'inOutSine', { handheld: 0 });
  });
})();
