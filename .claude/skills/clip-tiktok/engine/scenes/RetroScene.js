/* STYLE F — OBJETS RÉTRO ANIMÉS
 * Objet physique stylisé (jouet électronique rétro générique), écran LCD gris-vert, boutons physiques qui
 * s'enfoncent, écriture qui se dessine (les paroles s'écrivent dans l'écran : chunk pos dans l'écran,
 * police LCD, enter 'type'), petite illustration pixel qui apparaît, texture plastique, lumière douce.
 * Gabarit : retro.toy (prix, jeu, souvenir, enfance, compter, dire)
 * params : body (couleur plastique), icon: 'tag' | 'diamond' | 'coin' | 'heart'
 * Zone écran (pour placer les paroles) : x 250 → 830, y 600 → 960.
 */
(function () {
  const C = window.CLIP;
  const ICONS = {
    tag: ['....######......', '...#......#.....', '..#..##....#....', '.#..#..#....#...', '#...#..#.....#..', '#....##.......#.', '#..............#', '.#............#.', '..#..........#..', '...#........#...', '....#......#....', '.....#....#.....', '......#..#......', '.......##.......'],
    diamond: ['....########....', '...#..#..#..#...', '..#..#....#..#..', '.##############.', '..#...#..#...#..', '...#...##...#...', '....#..##..#....', '.....#.##.#.....', '......####......', '.......##.......'],
    coin: ['.....######.....', '...##......##...', '..#....##....#..', '.#....####....#.', '.#...##.......#.', '.#....###.....#.', '.#......##....#.', '.#...####.....#.', '..#....##....#..', '...##......##...', '.....######.....'],
    heart: ['..###....###..', '.#####..#####.', '##############', '##############', '.############.', '..##########..', '...########...', '....######....', '.....####.....', '......##......'],
  };
  C.template('retro.toy', (S, P) => {
    const { h, E } = S, body = P.body || '#e8743b', dark = S.mix(body, '#000000', .35), lcd = '#a3ad8a', px = '#27321c';
    S.layer(0).add(E.radial([[0, '#efe9df'], [1, '#a8a196']], { cx: .5, cy: .45, r: .8 }));
    S.layer(.1).add(h('ellipse', { cx: 560, cy: 1700, rx: 420, ry: 60, fill: '#000', opacity: .22, filter: 'url(#bigblur)' }));
    const dev = h('g'); S.layer(.6).add(dev); S.key(dev, 'console', 'cut,ui');
    const grad = E.gradientDef([[0, S.mix(body, '#ffffff', .25)], [.5, body], [1, dark]], true);
    dev.append(h('rect', { x: -360, y: -600, width: 720, height: 1220, rx: 150, fill: dark }), h('rect', { x: -360, y: -616, width: 720, height: 1220, rx: 150, fill: grad }));
    const spk = h('g', { opacity: .18 }); const r = S.rng; for (let i = 0; i < 500; i++) spk.appendChild(h('circle', { cx: (r() - .5) * 700, cy: (r() - .5) * 1190 - 6, r: .8 + r() * 1.4, fill: r() < .5 ? '#fff' : '#555' })); dev.appendChild(spk);
    dev.append(h('rect', { x: -310, y: -560, width: 620, height: 470, rx: 26, fill: '#4b4d5a' }), h('circle', { cx: -270, cy: -330, r: 9, fill: '#e2263a', filter: 'url(#glow)' }));
    const scr = h('rect', { x: -290, y: -540, width: 580, height: 400, rx: 8, fill: lcd }); dev.appendChild(scr);
    const scan = h('g', { opacity: .08 }); for (let y = -540; y < -140; y += 6) scan.appendChild(h('line', { x1: -290, y1: y, x2: 290, y2: y, stroke: '#000', 'stroke-width': 2 })); dev.appendChild(scan);
    const pix = h('g'); dev.appendChild(pix); const grid = ICONS[P.icon || 'tag'], cells = [];
    grid.forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') { const e = h('rect', { x: 170 + x * 6, y: -528 + y * 6, width: 5.6, height: 5.6, fill: px }); pix.appendChild(e); cells.push([e, y]); } }));
    // croix directionnelle + boutons
    const pad = h('g', { transform: 'translate(-190,120)' }, [h('rect', { x: -32, y: -100, width: 64, height: 200, rx: 10, fill: '#2a2a30' }), h('rect', { x: -100, y: -32, width: 200, height: 64, rx: 10, fill: '#2a2a30' }), h('circle', { r: 18, fill: '#1a1a20' })]); dev.appendChild(pad);
    const btn = (x, y) => { const g = h('g', { transform: `translate(${x},${y})` }); g.append(h('circle', { r: 58, fill: '#7a1630' }), h('circle', { cy: -6, r: 58, fill: '#b3264a' }), h('ellipse', { cx: -16, cy: -26, rx: 22, ry: 12, fill: '#fff', opacity: .3 })); dev.appendChild(g); return g; };
    const A = btn(220, 70), B = btn(110, 190);
    const knob = h('g', { transform: 'translate(0,400)' }, [h('circle', { r: 70, fill: dark }), h('circle', { cy: -6, r: 70, fill: S.mix(body, '#ffffff', .15) }), h('rect', { x: -8, y: -66, width: 16, height: 46, rx: 8, fill: '#2a2a30' })]); dev.appendChild(knob);
    const grill = h('g'); for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) grill.appendChild(h('circle', { cx: -250 + i * 34, cy: 420 + j * 34, r: 9, fill: dark })); dev.appendChild(grill);
    const glare = h('rect', { x: -900, y: -700, width: 220, height: 1500, fill: '#fff', opacity: .12, transform: 'rotate(20)' }); dev.appendChild(glare);
    S.update(t => {
      dev.setAttribute('transform', `translate(540,${1100 + Math.sin(t * 1.4) * 10}) rotate(${-2 + Math.sin(t * .9) * 1.5})`);
      const rows = grid.length, k = C.clamp(t / (S.dur * .5)); cells.forEach(([e, y]) => e.setAttribute('opacity', y / rows <= k ? 1 : 0));
      const bA = S.beat(t, 12), bB = S.beat(t + .32, 12); A.setAttribute('transform', `translate(230,${60 + bA * 8})`); B.setAttribute('transform', `translate(90,${160 + bB * 8})`);
      pad.setAttribute('transform', `translate(-190,120) rotate(${Math.sin(t * 3) * 3})`); knob.setAttribute('transform', `translate(0,400) rotate(${t * 90})`);
      glare.setAttribute('x', -900 + ((t * 300) % 2200));
      scr.setAttribute('fill', S.mix(lcd, '#b7c29c', .3 + .3 * Math.sin(t * 2)));
    });
    S.camera([[0, { x: 0, y: 40, zoom: 1.0 }], [1, { x: 0, y: 0, zoom: 1.06, rot: 1 }]], 'inOutSine', { handheld: .4 });
  });
})();
