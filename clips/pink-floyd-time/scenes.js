/* Pink Floyd — « Time » (dernier couplet) — scènes illustrées
 * Univers : surréalisme 70s, désert ocre, ciel indigo, l'homme au chapeau melon et les horloges.
 * Toutes les fonctions d'update sont pures en t (secondes locales de la scène).
 */
const PAL = {
  night: '#0f0d24', indigo: '#2a2452', violet: '#3a2f55', ochre: '#c98b4a', sand: '#e7c28e', bone: '#efe6d2',
  brass: '#a8834e', teal: '#1d3a42', ink: '#0b0912', dusk1: '#c45a3c', dusk2: '#e7a35e', brown: '#7a4524',
};
// L'homme au chapeau melon (personnage récurrent)
const man = (E, o) => E.figure(Object.assign({ color: PAL.ink, hat: 'bowler', coat: PAL.ink, bodyWidth: 1.05 }, o));

/* s00 — « Shorter of breath, » : profil, horloge-soleil, souffle */
CLIP.scene('s00', S => {
  const { E, h, kf } = S;
  S.layer(0).add(E.sky([[0, PAL.indigo], [.45, PAL.dusk1], [.7, PAL.dusk2], [1, PAL.sand]]));
  S.layer(0.15).add(E.clock({ x: 600, y: 1180, r: 330, face: '#f4d9a0', rim: PAL.brass, hands: '#5b3a1e', speed: 6, start: 40 }));
  S.layer(0.15).add(E.radial([[0, '#ffe2a8', .55], [1, '#ffe2a8', 0]], { cx: .5, cy: .6, r: .35 }));
  S.layer(0.3).add(E.hills({ y: 1270, color: PAL.ochre, seed: 3, amp: 60 }));
  S.layer(0.5).add(E.hills({ y: 1420, color: '#a86a36', seed: 8, amp: 80 }));
  S.layer(0.6).add(E.dust({ color: '#fff2d0', n: 40, area: [0, 700, 1080, 900] }));
  const L = S.layer(1);
  L.add(E.hills({ y: 1640, color: PAL.brown, seed: 14, amp: 50 }));
  const m = man(E, { x: 330, y: 2010, s: 2.6, action: 'breathe', pose: { lean: 4, head: 14 } });
  L.add(m);
  // souffle : bouffées de vapeur qui sortent de la bouche
  const vapor = h('g', { fill: '#fff6e6' }); L.g.appendChild(vapor);
  const puffs = [...Array(10)].map(() => { const c = h('circle'); vapor.appendChild(c); return c; });
  S.update(t => {
    puffs.forEach((c, i) => {
      const life = 1.4, ph = ((t + i * life / 10) % life + life) % life / life;
      const breathe = 0.5 + 0.5 * Math.sin(t * 2.4);
      c.setAttribute('cx', 432 + ph * 220 + Math.sin(ph * 6 + i) * 14);
      c.setAttribute('cy', 1092 - ph * 90);
      c.setAttribute('r', 8 + ph * 34);
      c.setAttribute('opacity', (1 - ph) * .35 * breathe);
    });
  });
  S.camera([[0, { x: 0, y: 0, zoom: 1.0 }], [1, { x: 30, y: -20, zoom: 1.09 }]], 'inOutSine');
});

/* s01 — « and one day closer to death » : sablier géant dans les dunes */
CLIP.scene('s01', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, PAL.night], [.4, PAL.indigo], [.75, PAL.dusk1], [1, PAL.dusk2]]));
  S.layer(0.1).add(E.sun({ x: 220, y: 1180, r: 70, color: '#ffd59a', glow: .5 }));
  S.layer(0.25).add(E.mountains({ y: 1230, color: '#5a3550', seed: 21, amp: 120 }));
  S.layer(0.45).add(E.hills({ y: 1330, color: '#b0743e', seed: 5, amp: 70 }));
  const L = S.layer(0.8);
  L.add(h('ellipse', { cx: 860, cy: 1560, rx: 520, ry: 40, fill: '#3a1f12', opacity: .45 })); // ombre portée
  L.add(E.hills({ y: 1520, color: PAL.ochre, seed: 11, amp: 40 }));
  L.add(E.hourglass({ x: 640, y: 1030, s: 2.15, glass: '#f6efe0', sand: PAL.sand, frame: '#3b2414', dur: 7 }));
  L.add(man(E, { s: .55, action: 'walk', speed: .8, path: [[0, [80, 1545]], [6, [330, 1545]]] }));
  S.layer(1).add(E.dust({ color: '#ffe9c4', n: 60, drift: [40, -6], area: [0, 1100, 1080, 600], opacity: .6 }));
  S.camera([[0, { x: 60, y: 0, zoom: 1.12 }], [1, { x: -50, y: 10, zoom: 1.0 }]], 'inOutSine');
});

/* s02 — « Every year is getting shorter » : calendriers qui s'envolent */
CLIP.scene('s02', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, PAL.night], [.6, PAL.indigo], [1, PAL.violet]]));
  S.layer(0.1).add(E.stars({ n: 140, seed: 4 }));
  S.layer(0.15).add(E.moon({ x: 820, y: 380, r: 80, color: PAL.bone, bg: '#171433' }));
  S.layer(0.4).add(E.hills({ y: 1480, color: '#1c1838', seed: 2, amp: 50 }));
  const L = S.layer(1);
  L.add(E.hills({ y: 1600, color: '#120f26', seed: 9, amp: 30 }));
  // banc
  L.add(h('g', { fill: '#120f26' }, [h('rect', { x: 560, y: 1500, width: 300, height: 18, rx: 4 }), h('rect', { x: 560, y: 1440, width: 300, height: 14, rx: 4 }),
    h('rect', { x: 580, y: 1500, width: 14, height: 110 }), h('rect', { x: 826, y: 1500, width: 14, height: 110 })]));
  L.add(man(E, { x: 700, y: 1655, s: .9, pose: 'sit', action: 'breathe', color: '#0a0818', coat: '#0a0818', facing: -1 }));
  // pages de calendrier (années) arrachées par le vent
  const pages = [];
  const g = h('g'); L.g.appendChild(g);
  for (let i = 0; i < 16; i++) {
    const p = h('g');
    p.appendChild(h('rect', { x: -55, y: -70, width: 110, height: 140, rx: 4, fill: PAL.bone }));
    p.appendChild(h('rect', { x: -55, y: -70, width: 110, height: 30, rx: 4, fill: i % 4 === 0 ? '#b3261e' : PAL.brass }));
    const tx = h('text', { x: 0, y: 40, 'text-anchor': 'middle', 'font-size': 54, 'font-family': 'DM Serif Display', fill: '#2a2018' }); tx.textContent = 1973 + i * 3;
    const tl = h('text', { x: 0, y: -48, 'text-anchor': 'middle', 'font-size': 16, 'font-family': 'DM Serif Display', fill: PAL.bone, 'letter-spacing': 3 }); tl.textContent = 'JAN';
    p.append(tx, tl); g.appendChild(p); pages.push(p);
  }
  S.update(t => {
    pages.forEach((p, i) => {
      const ph = (((t * .28 + i / 16) % 1) + 1) % 1;
      const x = 860 - ph * 260 + Math.sin(ph * 5 + i * 1.3) * 150; // couloir à droite, hors de la zone de texte
      const y = 1460 - ph * 1500 - Math.sin(i) * 40;
      const sc = (.9 + (i % 5) * .16) * (1 - ph * .3);
      const flip = Math.max(.18, Math.abs(Math.cos(ph * 6 + i))); // la page pivote sans jamais s'afficher en miroir
      p.setAttribute('transform', `translate(${x},${y}) rotate(${ph * 300 * (i % 2 ? 1 : -1)}) scale(${sc * flip},${sc})`);
      p.setAttribute('opacity', Math.min(1, ph * 8) * (1 - Math.max(0, ph - .85) / .15));
    });
  });
  S.camera([[0, { x: 0, y: -60, zoom: 1.08 }], [1, { x: 0, y: 110, zoom: 1.0 }]], 'inOutSine');
});

/* s03 — « Never seem to find the time » : île flottante dans un labyrinthe d'horloges */
CLIP.scene('s03', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#3d3370'], [.6, PAL.indigo], [1, PAL.night]], { cx: .5, cy: .4, r: .7 }));
  S.layer(0.05).add(E.stars({ n: 60, seed: 12, color: '#d9d0ff' }));
  const clocks = [
    [0.25, 150, 260, 90, 1.5], [0.25, 930, 420, 70, -2], [0.25, 1000, 1300, 85, 3], [0.25, 90, 1520, 60, -4],
    [0.55, 830, 700, 130, 8], [0.55, 210, 560, 110, -6], [0.55, 260, 1580, 120, 5],
    [1, 900, 1600, 170, 20], [1, 120, 860, 150, -15], [1, 620, 230, 120, 12],
  ];
  for (const [d, x, y, r, sp] of clocks) {
    S.layer(d).add(E.clock({ x, y, r, speed: sp, start: x + y, face: d < .5 ? '#cfc6e8' : PAL.bone, rim: d < .5 ? '#6a5f99' : PAL.brass, hands: '#1b1430', numerals: r > 100 }));
  }
  const L = S.layer(0.8);
  // île flottante
  L.add(h('path', { d: 'M 330 800 Q 540 770 760 800 Q 720 880 640 960 Q 560 1080 520 1010 Q 430 930 330 800 Z', fill: '#4a3a6a' }));
  L.add(h('path', { d: 'M 330 800 Q 540 770 760 800 Q 540 830 330 800 Z', fill: '#7a6a9a' }));
  const m = man(E, { x: 520, y: 803, s: .8, pose: 'point', action: 'idle' });
  L.add(m);
  // lanterne tenue à bout de bras (main ≈ x+138s, y-286s)
  const lantern = h('g'); L.g.appendChild(lantern);
  const glow = h('circle', { r: 110, fill: '#ffd98a', opacity: .3, filter: 'url(#bigblur)' });
  lantern.append(glow, h('line', { x1: 0, y1: 0, x2: 0, y2: 24, stroke: PAL.ink, 'stroke-width': 4 }), h('rect', { x: -14, y: 24, width: 28, height: 36, rx: 6, fill: '#ffe2a0', stroke: PAL.ink, 'stroke-width': 5 }));
  S.update(t => {
    const sw = Math.sin(t * 2.2) * 8;
    lantern.setAttribute('transform', `translate(${520 + 138 * .8},${803 - 286 * .8 + 4}) rotate(${sw})`);
    glow.setAttribute('opacity', .26 + .08 * Math.sin(t * 13) * Math.sin(t * 7));
  });
  S.layer(0.9).add(E.particles({ n: 30, color: '#ffe6a8', size: [2, 4], drift: [6, -20], area: [300, 500, 500, 600], glow: true, twinkle: 4 }));
  S.camera([[0, { x: 0, y: 0, zoom: 1.0, rot: -4 }], [.5, { x: 0, y: -20, zoom: 1.06, rot: 3 }], [1, { x: 0, y: -30, zoom: 1.1, rot: -2 }]], 'inOutSine');
});

/* s04 — « Plans that either come to naught » : plan d'architecte qui se dissout */
CLIP.scene('s04', S => {
  const { E, h, defs } = S;
  S.layer(0).add(E.rect({ x: -1080, y: -1920, width: 3240, height: 5760, fill: '#14365e' }));
  const grid = h('g', { stroke: '#5f8fc4', opacity: .35 });
  for (let x = -600; x < 1700; x += 60) grid.appendChild(h('line', { x1: x, y1: -800, x2: x, y2: 2800, 'stroke-width': x % 300 === 0 ? 3 : 1 }));
  for (let y = -800; y < 2800; y += 60) grid.appendChild(h('line', { x1: -600, y1: y, x2: 1700, y2: y, 'stroke-width': y % 300 === 0 ? 3 : 1 }));
  S.layer(0.3).add(grid);
  // filtre de désagrégation (déplacement croissant)
  const fid = 'dissolve_s04';
  const disp = h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 0, xChannelSelector: 'R', yChannelSelector: 'G' });
  defs.appendChild(h('filter', { id: fid, x: '-30%', y: '-30%', width: '160%', height: '160%' }, [h('feTurbulence', { type: 'fractalNoise', baseFrequency: .06, numOctaves: 2, seed: 5, result: 'n' }), disp]));
  const house = h('g', { fill: 'none', stroke: '#eaf2ff', 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', filter: `url(#${fid})` });
  const D = [
    'M 240 1350 L 240 980 L 840 980 L 840 1350 Z', 'M 200 1000 L 540 700 L 880 1000', 'M 650 820 L 650 700 L 720 700 L 720 880',
    'M 470 1350 L 470 1160 L 610 1160 L 610 1350', 'M 300 1050 L 420 1050 L 420 1140 L 300 1140 Z', 'M 360 1050 L 360 1140 M 300 1095 L 420 1095',
    'M 660 1050 L 780 1050 L 780 1140 L 660 1140 Z', 'M 720 1050 L 720 1140 M 660 1095 L 780 1095', 'M 160 1350 L 920 1350',
    'M 240 1420 L 840 1420 M 240 1400 L 240 1440 M 840 1400 L 840 1440', 'M 920 980 L 920 1350 M 900 980 L 940 980 M 900 1350 L 940 1350',
    'M 540 760 m -40 0 a 40 40 0 1 0 80 0 a 40 40 0 1 0 -80 0',
  ];
  const paths = D.map(d => { const p = h('path', { d }); house.appendChild(p); return p; });
  S.layer(0.8).add(house);
  const lab = E.label('PLAN N° 1 — LA MAISON', { x: 540, y: 1500, size: 34, color: '#eaf2ff', font: 'DM Serif Display', spacing: 6 }); S.layer(0.8).add(lab);
  const dust = E.particles({ n: 90, color: '#eaf2ff', size: [2, 5], drift: [30, -60], wobble: 50, area: [150, 650, 800, 900], opacity: 0 });
  S.layer(0.9).add(dust);
  let lens = null;
  S.update(t => {
    if (!lens) lens = paths.map(p => p.getTotalLength());
    paths.forEach((p, i) => {
      const k = Math.min(1, Math.max(0, (t - i * .1) / 1.1));
      p.setAttribute('stroke-dasharray', lens[i]); p.setAttribute('stroke-dashoffset', lens[i] * (1 - k));
    });
    const dz = Math.max(0, (t - 1.9) / 1.8);
    disp.setAttribute('scale', dz * dz * 160);
    house.setAttribute('opacity', 1 - Math.min(1, dz) * .85);
    lab.el.setAttribute('opacity', 1 - Math.min(1, dz));
    dust.el.setAttribute('opacity', Math.min(.9, dz * 1.4));
  });
  S.camera([[0, { x: 0, y: 30, zoom: 1.04, rot: -2 }], [1, { x: -20, y: -10, zoom: 1.14, rot: 1.5 }]], 'inOutSine');
});

/* s05 — « Or half a page of scribbled lines » : page griffonnée à la bougie */
CLIP.scene('s05', S => {
  const { E, h, rng } = S;
  S.layer(0).add(E.rect({ x: -1080, y: -1920, width: 3240, height: 5760, fill: '#3a2418' }));
  const wood = h('g', { stroke: '#2a180f', 'stroke-width': 3, fill: 'none', opacity: .7 });
  for (let i = 0; i < 40; i++) { let d = `M -200 ${i * 60 - 200}`; for (let x = -200; x < 1300; x += 60) d += ` L ${x} ${i * 60 - 200 + S.noise(x / 300 + i, 3) * 16}`; wood.appendChild(h('path', { d })); }
  S.layer(0.2).add(wood);
  const L = S.layer(0.7);
  const page = h('g', { transform: 'rotate(-5 540 1010)' });
  page.append(h('rect', { x: 238, y: 588, width: 620, height: 860, fill: '#000', opacity: .35, filter: 'url(#softblur)' }), h('rect', { x: 220, y: 570, width: 620, height: 860, fill: PAL.bone }));
  for (let y = 650; y < 1400; y += 52) page.appendChild(h('line', { x1: 250, y1: y, x2: 810, y2: y, stroke: '#9fb6c9', 'stroke-width': 2, opacity: .6 }));
  page.appendChild(h('line', { x1: 300, y1: 570, x2: 300, y2: 1430, stroke: '#d99090', 'stroke-width': 2 }));
  // lignes griffonnées : seulement la moitié de la page
  const r = rng, lines = [];
  for (let k = 0; k < 7; k++) {
    let d = '', x = 320, y = 640 + k * 52;
    const end = k === 6 ? 560 : 780 - r() * 80;
    d = `M ${x} ${y}`;
    while (x < end) { x += 9; d += ` L ${x.toFixed(1)} ${(y - 6 + Math.sin(x * .45 + k) * 9 + Math.sin(x * .13) * 5 - (Math.sin(x * .9) > .8 ? 16 : 0)).toFixed(1)}`; }
    const p = h('path', { d, fill: 'none', stroke: '#1c1830', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    page.appendChild(p); lines.push(p);
  }
  page.appendChild(h('ellipse', { cx: 700, cy: 1240, rx: 40, ry: 28, fill: '#1c1830', opacity: .85 })); // tache d'encre
  L.add(page);
  const pen = h('g', {}, [h('path', { d: 'M 0 0 L 22 -40 L 260 -330 L 285 -310 L 40 -20 Z', fill: '#e8dcc0' }), h('path', { d: 'M 0 0 L 10 -18 L 18 -12 Z', fill: '#1c1830' }), h('path', { d: 'M 150 -200 Q 260 -380 330 -470 Q 300 -330 200 -230 Z', fill: PAL.bone, opacity: .9 })]);
  S.layer(0.85).add(pen);
  // bougie
  const flame = h('path', { fill: '#ffcf6a' });
  const cG = h('g', {}, [h('circle', { cx: 900, cy: 400, r: 260, fill: '#ffb84d', opacity: .22, filter: 'url(#bigblur)' }), h('rect', { x: 870, y: 420, width: 60, height: 220, rx: 6, fill: '#efe2c4' }), h('line', { x1: 900, y1: 420, x2: 900, y2: 400, stroke: '#222', 'stroke-width': 4 }), flame]);
  S.layer(0.9).add(cG);
  let lens = null;
  S.update(t => {
    if (!lens) lens = lines.map(p => p.getTotalLength());
    const total = 3.6, per = total / lines.length;
    let tip = null;
    lines.forEach((p, i) => {
      const k = Math.min(1, Math.max(0, (t - i * per) / per));
      p.setAttribute('stroke-dasharray', lens[i]); p.setAttribute('stroke-dashoffset', lens[i] * (1 - k));
      if (k > 0 && k < 1) tip = p.getPointAtLength(lens[i] * k);
    });
    if (!tip) { const last = lines[lines.length - 1]; tip = last.getPointAtLength(lens[lens.length - 1] * (t > per * 6 ? 1 : 0)); }
    // la plume suit la pointe (dans le repère de la page tournée de -5°)
    const a = -5 * Math.PI / 180, cx = 540, cy = 1010;
    const px = cx + (tip.x - cx) * Math.cos(a) - (tip.y - cy) * Math.sin(a), py = cy + (tip.x - cx) * Math.sin(a) + (tip.y - cy) * Math.cos(a);
    pen.setAttribute('transform', `translate(${px},${py}) rotate(${Math.sin(t * 20) * 2})`);
    const f = 1 + S.noise(t * 8, 2) * .15;
    flame.setAttribute('d', `M 900 ${402} Q ${880 + S.noise(t * 5, 1) * 6} ${380} ${900 + S.noise(t * 6, 4) * 8} ${400 - 60 * f} Q ${920} ${380} 900 402 Z`);
  });
  S.camera([[0, { x: 0, y: -40, zoom: 1.1 }], [1, { x: 10, y: 30, zoom: 1.02 }]], 'inOutSine');
});

/* s06 — « Hanging on in quiet desperation » : suspendu à l'aiguille */
CLIP.scene('s06', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#06050f'], [.6, '#16123a'], [1, '#2c2250']]));
  S.layer(0.05).add(E.stars({ n: 80, seed: 31 }));
  S.layer(0.3).add(E.city({ y: 1700, color: '#1a1638', seed: 6, maxH: 700, windows: '#ffd98a', lit: .25 }));
  S.layer(0.6).add(E.city({ y: 1900, color: '#0e0b22', seed: 13, maxH: 520, windows: '#ffcf70', lit: .18 }));
  const L = S.layer(0.9);
  const C = [380, 700], R = 430;
  L.add(h('circle', { cx: C[0], cy: C[1], r: R + 80, fill: '#2b1f14' }));
  L.add(E.clock({ x: C[0], y: C[1], r: R, speed: 0, start: 0, ticking: false, face: '#e9dcbc', rim: '#2b1f14', hands: 'rgba(0,0,0,0)' }));
  L.add(h('circle', { cx: C[0], cy: C[1], r: R * .97, fill: '#ffe9a8', opacity: .12 }));
  const hourH = h('rect', { x: -16, y: -R * .5, width: 32, height: R * .58, rx: 10, fill: '#1b130c' });
  const minH = h('path', { d: `M -18 40 L 18 40 L 9 ${-R * .92} L -9 ${-R * .92} Z`, fill: '#1b130c' });
  const hands = h('g'); hands.append(hourH, minH, h('circle', { r: 30, fill: '#1b130c' })); L.g.appendChild(hands);
  const fig = man(E, { x: 0, y: 0, s: .78, pose: 'arms_up', action: 'none', anim: (a, t) => { a.th1 = 8 + Math.sin(t * 3.1) * 16; a.th2 = -8 - Math.sin(t * 2.7) * 16; a.sh1 = -10 - Math.max(0, Math.sin(t * 3.1)) * 30; a.sh2 = -6; a.head = -10 + Math.sin(t) * 5; } });
  const swing = h('g'); swing.appendChild(fig.el); L.g.appendChild(swing);
  S.update(t => {
    const ang = 96 + t * 2.4 + Math.max(0, Math.sin(t * 6)) * .6; // l'aiguille descend lentement
    hands.setAttribute('transform', `translate(${C[0]},${C[1]})`);
    minH.setAttribute('transform', `rotate(${ang})`); hourH.setAttribute('transform', `rotate(${-60})`);
    const tip = [C[0] + Math.sin(ang * Math.PI / 180) * R * .88, C[1] - Math.cos(ang * Math.PI / 180) * R * .88];
    fig.update(t);
    // les mains (≈ 248·s au-dessus des hanches) accrochées à la pointe ; pieds à +424·s
    fig.el.setAttribute('transform', `translate(${tip[0]},${tip[1] + 424 * .78}) scale(.78) translate(0,${-176})`);
    swing.setAttribute('transform', `rotate(${Math.sin(t * 1.6) * 7} ${tip[0]} ${tip[1]})`);
  });
  S.camera([[0, { x: 0, y: -40, zoom: 1.14, rot: 3 }], [1, { x: -20, y: 30, zoom: 1.04, rot: -1 }]], 'inOutSine', { shake: 3, shakeFreq: 3 });
});

/* s07 — « Is the English way » : file d'hommes identiques sous la bruine */
CLIP.scene('s07', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#5f666b'], [1, '#a3a8a6']]));
  S.layer(0.2).add(E.city({ y: 1250, color: '#7c8285', seed: 41, minH: 300, maxH: 700, windows: '#d8d2b8', lit: .08, flicker: false }));
  S.layer(0.4).add(E.city({ y: 1330, color: '#53595d', seed: 42, minH: 250, maxH: 560, windows: '#e6d9a8', lit: .12 }));
  S.layer(0.45).add(E.fog({ y: 1250, height: 260, color: '#c9cdcb', opacity: .45 }));
  const L = S.layer(1);
  L.add(E.ground({ y: 1480, color: '#2b2f33' }));
  L.add(E.rect({ x: -1080, y: 1480, width: 3240, height: 22, fill: '#6c7378' }));
  L.add(h('rect', { x: -1080, y: 1502, width: 3240, height: 300, fill: E.gradientDef([[0, '#9aa3a8', .25], [1, '#2b2f33', 0]]) }));
  const row = h('g'); L.g.appendChild(row);
  const men = [];
  for (let i = 0; i < 7; i++) {
    const m = man(E, { x: i * 210, y: 1490, s: .82, action: 'walk', speed: .9, seed: 7, color: '#15171a', coat: '#15171a' });
    const g = h('g'); g.appendChild(m.el);
    // parapluie
    g.appendChild(h('g', { transform: `translate(${i * 210 + 20},${1490 - 470 * .82})` }, [
      h('path', { d: 'M -120 0 Q -110 -110 0 -120 Q 110 -110 120 0 Q 90 -18 60 0 Q 30 -18 0 0 Q -30 -18 -60 0 Q -90 -18 -120 0 Z', fill: '#15171a' }),
      h('line', { x1: 0, y1: 0, x2: 0, y2: 150, stroke: '#15171a', 'stroke-width': 7 })]));
    row.appendChild(g); men.push([m, g]);
  }
  S.update(t => {
    row.setAttribute('transform', `translate(${-260 + t * 120},0)`);
    for (const [m, g] of men) { m.update(t); g.setAttribute('transform', `translate(0,${Math.abs(Math.cos((t * .9 + (7 * 0)) * 5.2)) * -3})`); }
  });
  S.layer(1).add(E.rain({ n: 220, angle: 10, color: '#e3e9ec', opacity: .38, len: 70 }));
  S.camera([[0, { x: 40, y: 0, zoom: 1.06 }], [1, { x: -90, y: 0, zoom: 1.0 }]], 'linear');
});

/* s08 — « The time is gone, the song is over » : disque-horloge qui s'arrête */
CLIP.scene('s08', S => {
  const { E, h } = S;
  S.layer(0).add(E.radial([[0, '#2c2550'], [1, '#07060f']], { cx: .5, cy: .55, r: .6 }));
  const beam = E.gradientDef([[0, '#fff3cf', .55], [1, '#fff3cf', 0]]);
  S.layer(0.3).add(h('path', { d: 'M 470 -100 L 610 -100 L 1000 1500 L 80 1500 Z', fill: beam, opacity: .35 }));
  const L = S.layer(0.85);
  const C = [540, 1110];
  L.add(h('ellipse', { cx: C[0], cy: C[1] + 30, rx: 430, ry: 410, fill: '#000', opacity: .5, filter: 'url(#softblur)' }));
  const disc = h('g');
  disc.appendChild(h('circle', { r: 400, fill: '#0b0a10' }));
  for (let r = 150; r < 395; r += 9) disc.appendChild(h('circle', { r, fill: 'none', stroke: r % 27 === 6 ? '#2a2838' : '#17161f', 'stroke-width': 2 }));
  disc.appendChild(h('path', { d: 'M -380 -60 A 386 386 0 0 1 -60 -380', fill: 'none', stroke: '#fff', 'stroke-width': 26, opacity: .07 }));
  L.g.appendChild(h('g', { transform: `translate(${C[0]},${C[1]})` }, [disc]));
  const lab = E.clock({ x: 0, y: 0, r: 140, speed: 0, ticking: false, face: PAL.bone, rim: '#b3261e', hands: PAL.ink, numerals: true, start: 0 });
  disc.appendChild(lab.el);
  const arm = h('g', {}, [h('circle', { cx: 0, cy: 0, r: 46, fill: '#8a8f99' }), h('rect', { x: -9, y: 0, width: 18, height: 560, rx: 9, fill: '#c3c7cf' }), h('rect', { x: -26, y: 540, width: 52, height: 70, rx: 8, fill: '#8a8f99' })]);
  L.g.appendChild(h('g', { transform: 'translate(950,560)' }, [arm]));
  S.layer(0.95).add(E.dust({ n: 70, color: '#fff3cf', area: [150, 0, 780, 1500], drift: [4, 10], size: [1.5, 3.5], opacity: .55 }));
  S.update(t => {
    const T0 = 2.5, w0 = 200; // deg/s, ~33 tours/min, décélération jusqu'à l'arrêt
    const tt = Math.min(Math.max(t, 0), T0);
    const ang = w0 * (tt - tt * tt / (2 * T0)) + (t < 0 ? w0 * t : 0);
    disc.setAttribute('transform', `rotate(${ang})`);
    lab.update(Math.max(0, 2.5 - t) * 30); // les aiguilles de l'étiquette ralentissent aussi
    const lift = Math.max(0, Math.min(1, (t - 2.4) / .6));
    arm.setAttribute('transform', `rotate(${28 - lift * 22})`);
  });
  S.camera([[0, { x: 0, y: 40, zoom: 1.0, rot: 4 }], [1, { x: 0, y: -10, zoom: 1.12, rot: -2 }]], 'inOutSine');
});

/* s09 — « Thought I'd something more to say » : l'homme s'éloigne dans le désert nocturne */
CLIP.scene('s09', S => {
  const { E, h } = S;
  S.layer(0).add(E.sky([[0, '#05040c'], [.55, '#1b1840'], [.75, PAL.violet], [1, '#6a4a5a']]));
  const stars = E.stars({ n: 220, seed: 77, area: [-300, -400, 1700, 1500] });
  S.layer(0.05).add(stars);
  S.layer(0.1).add(E.moon({ x: 800, y: 270, r: 62, color: PAL.bone, phase: .3, bg: '#0a0919' }));
  S.layer(0.25).add(E.hills({ y: 1240, color: '#3a2a3e', seed: 52, amp: 40 }));
  S.layer(0.45).add(E.hills({ y: 1330, color: '#4a3324', seed: 53, amp: 50 }));
  const L = S.layer(0.8);
  L.add(E.hills({ y: 1450, color: '#2e2018', seed: 54, amp: 35 }));
  const steps = h('g', { fill: '#170f0a' }); L.g.appendChild(steps);
  const prints = [...Array(16)].map((_, i) => { const e = h('ellipse', { rx: 9 - i * .3, ry: 4 - i * .1, opacity: 0 }); steps.appendChild(e); return e; });
  const pathK = [[0, [260, 1500]], [5.2, [700, 1330]]];
  const m = man(E, { s: .5, action: 'walk', speed: .7, path: pathK });
  const mg = h('g'); mg.appendChild(m.el); L.g.appendChild(mg);
  S.update(t => {
    m.update(t);
    const k = Math.min(1, Math.max(0, t / 5.2)), x = 260 + 440 * k, y = 1500 - 170 * k, sc = 1 - k * .55;
    mg.setAttribute('transform', `translate(${x},${y}) scale(${sc}) translate(${-x},${-y})`);
    prints.forEach((e, i) => {
      const kk = i / 16 * k; const px = 260 + 440 * kk, py = 1500 - 170 * kk + (i % 2 ? 6 : -6);
      e.setAttribute('cx', px); e.setAttribute('cy', py + 8); e.setAttribute('opacity', kk < k - .02 ? .8 : 0);
    });
    stars.el.setAttribute('opacity', Math.min(1, .3 + t / 3));
  });
  S.camera([[0, { x: 60, y: 60, zoom: 1.22 }], [1, { x: 0, y: 0, zoom: 1.0 }]], 'inOutSine');
});
