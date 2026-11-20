/* HFS.char — CharacterController / CharacterAnimations / CharacterLibrary (2D, SVG)
 * Personnage articulé (vue de profil) : bassin, torse, tête, bras (2 segments), jambes (2 segments), pieds,
 * vêtement qui flotte (animation secondaire), ombre dynamique. Styles : flat | silhouette | cartoon | sketch.
 * Actions (fonctions pures du temps) : idle, walk, run, jump, dance, wave, reach, pickUp, hold, turn, lookUp, sit.
 * Piste : [{ t: 0, act: 'walk', x: 200 }, { t: 1.6, act: 'pickUp', x: 620 }, { t: 2.2, act: 'hold' }]
 *   → entre deux clés, le personnage se déplace (x, y) et l'action courante s'anime ; les changements d'action
 *     sont fondus sur 0,15 s (pas de saut de pose).
 * La main renvoie sa position (handPos) : un objet peut la suivre (le personnage attrape un objet).
 */
(function () {
  const HFS = window.HFS, { clamp, lerp, noise } = HFS.m, Ez = HFS.ease;
  const D2R = Math.PI / 180;
  const LOOKS = {
    flat: { skin: '#c98f6b', top: '#2b4c9a', top2: '#223d7c', bottom: '#20232e', shoe: '#f1efe8', hair: '#1c140f', outline: null },
    silhouette: { skin: '#0b0b0e', top: '#0b0b0e', top2: '#0b0b0e', bottom: '#0b0b0e', shoe: '#0b0b0e', hair: '#0b0b0e', outline: null },
    cartoon: { skin: '#f2c29a', top: '#ff5a3c', top2: '#d8452c', bottom: '#2d3a8c', shoe: '#ffffff', hair: '#3a2416', outline: '#1a1a1a' },
    sketch: { skin: '#fbf6ee', top: '#fbf6ee', top2: '#efe7da', bottom: '#fbf6ee', shoe: '#fbf6ee', hair: '#2b2b2b', outline: '#2b2b2b' },
  };
  // ------------------------------------------------------------------ poses (angles en degrés ; 0 = membre vers le bas, + = vers l'avant)
  const ACT = {
    idle: (u) => ({ lean: 2 + Math.sin(u * 2.2) * 1.2, head: Math.sin(u * .9) * 3, ua1: 6, la1: 10, ua2: -6, la2: 8, th1: 3, sh1: 0, th2: -3, sh2: 0, bob: Math.sin(u * 2.2) * 2 }),
    walk: (u, o) => { const p = u * 6.2 * (o.speed || 1), s = Math.sin(p); return { lean: 5, head: -2, th1: s * 28, sh1: Math.max(0, -Math.cos(p)) * 42, th2: -s * 28, sh2: Math.max(0, Math.cos(p)) * 42, ua1: -s * 26, la1: 18, ua2: s * 26, la2: 18, bob: -Math.abs(Math.sin(p)) * 9 }; },
    run: (u, o) => { const p = u * 10 * (o.speed || 1), s = Math.sin(p); return { lean: 16, head: -8, th1: s * 50, sh1: Math.max(0, -Math.cos(p)) * 95 + 10, th2: -s * 50, sh2: Math.max(0, Math.cos(p)) * 95 + 10, ua1: -s * 60, la1: 80, ua2: s * 60, la2: 80, bob: -Math.abs(Math.sin(p)) * 22 }; },
    jump: (u, o) => { const T = o.dur || .9, k = clamp(u / T); const crouch = k < .2 ? Math.sin(k / .2 * Math.PI / 2) : k > .85 ? Math.sin((1 - k) / .15 * Math.PI / 2) : 0; const air = k > .2 && k < .85 ? Math.sin((k - .2) / .65 * Math.PI) : 0;
      return { lean: 8 + crouch * 14, head: -6, th1: 30 * crouch + 40 * air, sh1: 70 * crouch + 60 * air, th2: 20 * crouch + 10 * air, sh2: 60 * crouch + 30 * air, ua1: -40 * crouch + 150 * air, la1: 10, ua2: -30 * crouch + 140 * air, la2: 10, bob: crouch * 40 - air * (o.height ?? 260) }; },
    dance: (u, o) => { const p = u * 6.5 * (o.speed || 1), b = Math.sin(p), c = Math.cos(p * .5); return { lean: b * 6, head: b * 8, th1: 10 + b * 14, sh1: 20 - b * 14, th2: -10 + b * 14, sh2: 20 + b * 14, ua1: 140 + c * 30, la1: 30 + b * 30, ua2: 60 - c * 40, la2: 60, bob: -Math.abs(b) * 16, hip: b * 14 }; },
    wave: (u) => ({ lean: 0, head: 4, th1: 4, sh1: 0, th2: -4, sh2: 0, ua1: 150, la1: 20 + Math.sin(u * 12) * 25, ua2: -4, la2: 6, bob: Math.sin(u * 2) * 2 }),
    reach: (u) => { const k = Ez.outBack(clamp(u / .4)); return { lean: 12 * k, head: -6, th1: 6, sh1: 2, th2: -6, sh2: 4, ua1: 88 * k, la1: 8, ua2: 10, la2: 14, bob: 0 }; },
    pickUp: (u, o) => { const T = o.dur || .7, k = clamp(u / T), dn = Math.sin(k * Math.PI); return { lean: 10 + 48 * dn, head: 10 * dn, th1: 6 + 40 * dn, sh1: 60 * dn, th2: -6 + 20 * dn, sh2: 30 * dn, ua1: 40 + 30 * dn - 30 * (k > .5 ? (k - .5) * 2 : 0), la1: 20 + 40 * (1 - dn), ua2: 10, la2: 14, bob: dn * 60 }; },
    hold: (u) => ({ lean: 3, head: 18 + Math.sin(u * 1.5) * 3, th1: 3, sh1: 0, th2: -3, sh2: 0, ua1: 55, la1: 95, ua2: -4, la2: 8, bob: Math.sin(u * 2.2) * 2 }),   // tient un objet devant lui (ex. regarde son téléphone)
    lookUp: (u) => ({ lean: -6, head: -32, th1: 3, sh1: 0, th2: -3, sh2: 0, ua1: 8, la1: 6, ua2: -8, la2: 6, bob: 0 }),
    sit: (u) => ({ lean: 6, head: 6, th1: 90, sh1: -90, th2: 85, sh2: -85, ua1: 30, la1: 50, ua2: 20, la2: 50, bob: 85 }),
    turn: (u, o) => Object.assign(ACT.idle(u), { flip: clamp(u / (o.dur || .35)) }),   // demi-tour (écrasement horizontal pendant la rotation)
  };
  const L0 = { thigh: 92, shin: 92, ua: 74, la: 68, torso: 150, neck: 18, head: 40 };

  HFS.char = function (parent, o = {}) {
    const look = Object.assign({}, LOOKS[o.style || 'flat'], o.look || {});
    const S = o.scale ?? 1, svg = HFS.svg;
    const root = svg('g', { class: 'hfs-char' }, parent);
    const shadow = svg('ellipse', { rx: 70, ry: 14, fill: '#000', opacity: .28 }, root);
    const body = svg('g', {}, root);
    const line = (w, col) => svg('path', { fill: 'none', stroke: col, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, body);
    const out = (w) => look.outline ? line(w + 9, look.outline) : null;
    const dark = c => c;
    // ordre : membres arrière, torse, tête, membres avant
    const bl = [out(28), line(28, dark(look.bottom)), out(26), line(26, look.top2)], ba = [out(22), line(22, look.top2)];
    const bshoe = svg('path', { fill: look.shoe, stroke: look.outline || 'none', 'stroke-width': 5 }, body);
    const torsoO = out(60), torso = line(60, look.top);
    const coat = svg('path', { fill: look.top2, stroke: look.outline || 'none', 'stroke-width': 5 }, body);   // pan de vêtement qui flotte
    const headO = look.outline ? svg('circle', { r: L0.head + 5, fill: look.outline }, body) : null;
    const head = svg('circle', { r: L0.head, fill: look.skin }, body);
    const hair = svg('path', { fill: look.hair }, body);
    const fl = [out(28), line(28, look.bottom)];
    const fshoe = svg('path', { fill: look.shoe, stroke: look.outline || 'none', 'stroke-width': 5 }, body);
    const fa = [out(22), line(22, look.top)], hand = svg('circle', { r: 13, fill: look.skin, stroke: look.outline || 'none', 'stroke-width': 4 }, body);
    const eye = o.face ? svg('circle', { r: 5, fill: '#111' }, body) : null;
    if (o.style === 'sketch') body.setAttribute('stroke-dasharray', '0');
    const P = (p, a, l) => [p[0] + Math.sin(a * D2R) * l, p[1] + Math.cos(a * D2R) * l];
    const seg = (a, b, c) => `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} L ${b[0].toFixed(1)} ${b[1].toFixed(1)}` + (c ? ` L ${c[0].toFixed(1)} ${c[1].toFixed(1)}` : '');
    const track = (o.track || [{ t: 0, act: o.act || 'idle', x: o.x ?? 540, y: o.y ?? 1500 }]).map(k => Object.assign({ x: undefined, y: undefined }, k));
    // positions définies : on complète les x / y manquants par la valeur précédente
    let lx = o.x ?? 540, ly = o.y ?? 1500; track.forEach(k => { if (k.x == null) k.x = lx; if (k.y == null) k.y = ly; lx = k.x; ly = k.y; });
    const C = { root, handPos: [0, 0], facing: o.facing ?? 1, x: track[0].x, y: track[0].y };
    const poseAt = (t) => {
      let i = 0; while (i < track.length - 1 && t >= track[i + 1].t) i++;
      const K = track[i], N = track[i + 1];
      const u = t - K.t, A = (ACT[K.act] || ACT.idle)(u, K);
      let pose = A;
      if (i > 0 && u < .15) { const prev = track[i - 1], B = (ACT[prev.act] || ACT.idle)(t - prev.t, prev), k = u / .15; pose = {}; for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) pose[key] = lerp(B[key] ?? 0, A[key] ?? 0, Ez.inOut(k)); }
      let x = K.x, y = K.y;
      if (N && (N.x !== K.x || N.y !== K.y)) { const k = clamp((t - K.t) / (N.t - K.t)); const e = K.act === 'walk' || K.act === 'run' ? k : Ez.inOut(k); x = lerp(K.x, N.x, e); y = lerp(K.y, N.y, e); }
      let facing = K.facing ?? C.facing; if (K.act === 'turn') facing = (K.from ?? C.facing) * Math.cos(pose.flip * Math.PI);
      return { pose, x, y, facing, vx: N ? (N.x - K.x) / Math.max(.1, N.t - K.t) : 0 };
    };
    C.render = (t) => {
      const { pose: a, x, y, facing, vx } = poseAt(t);
      const hip = [0, -(L0.thigh + L0.shin) + (a.bob || 0)];
      const sh = P(hip, 180 - (a.lean || 0), L0.torso), nk = P(sh, 180 - (a.lean || 0) - (a.head || 0) * .3, L0.neck), hd = P(nk, 180 - (a.lean || 0) - (a.head || 0), L0.head * .9);
      const leg = (th, s) => { const knee = P(hip, th, L0.thigh); const foot = P(knee, th - s, L0.shin); return [knee, foot]; };
      const arm = (ua, la) => { const e = P(sh, ua, L0.ua), h = P(e, ua + la, L0.la); return [e, h]; };
      const [k1, f1] = leg(a.th1, a.sh1), [k2, f2] = leg(a.th2, a.sh2), [e1, h1] = arm(a.ua1, a.la1), [e2, h2] = arm(a.ua2, a.la2);
      fl.forEach(p => p && p.setAttribute('d', seg(hip, k1, f1))); bl.slice(0, 2).forEach(p => p && p.setAttribute('d', seg(hip, k2, f2)));
      ba.forEach(p => p && p.setAttribute('d', seg(sh, e2, h2))); fa.forEach(p => p && p.setAttribute('d', seg(sh, e1, h1)));
      bl.slice(2).forEach(p => p && p.setAttribute('d', ''));
      [torsoO, torso].forEach(p => p && p.setAttribute('d', seg(hip, sh)));
      const shoe = f => `M ${f[0] - 14} ${f[1] - 6} q 0 -16 22 -14 l 26 4 q 12 4 10 16 l -58 0 z`;
      fshoe.setAttribute('d', shoe(f1)); bshoe.setAttribute('d', shoe(f2));
      // pan de vêtement : traîne derrière, proportionnel à la vitesse (animation secondaire)
      const sway = clamp(Math.abs(vx) / 400) * 30 + noise(t * 3, 5) * 6, cb = P(hip, 180 - (a.lean || 0), 20);
      coat.setAttribute('d', `M ${cb[0] - 30} ${cb[1]} L ${cb[0] + 30} ${cb[1]} L ${cb[0] - 34 - sway} ${cb[1] + 70} L ${cb[0] - 50 - sway * 1.4} ${cb[1] + 64} Z`);
      head.setAttribute('cx', hd[0]); head.setAttribute('cy', hd[1]); if (headO) { headO.setAttribute('cx', hd[0]); headO.setAttribute('cy', hd[1]); }
      hair.setAttribute('d', `M ${hd[0] - 40} ${hd[1] + 2} A 40 40 0 0 1 ${hd[0] + 40} ${hd[1] - 4} Q ${hd[0] + 10} ${hd[1] - 22} ${hd[0] - 40} ${hd[1] + 2} Z`);
      if (eye) { eye.setAttribute('cx', hd[0] + 18); eye.setAttribute('cy', hd[1] - 4); }
      hand.setAttribute('cx', h1[0]); hand.setAttribute('cy', h1[1]);
      const sc = S;
      root.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${(sc * facing).toFixed(3)},${sc})`);
      shadow.setAttribute('cx', 0); shadow.setAttribute('cy', 0); shadow.setAttribute('rx', 70 - Math.max(0, -(a.bob || 0)) * .12); shadow.setAttribute('opacity', .28 * (1 - clamp(-(a.bob || 0) / 400)));
      C.handPos = [x + h1[0] * sc * facing, y + h1[1] * sc]; C.x = x; C.y = y; C.headPos = [x + hd[0] * sc * facing, y + hd[1] * sc];
    };
    if (o.style === 'sketch') { const b = HFS.fx.boil(body); const r0 = C.render; C.render = t => { r0(t); b(t); }; }
    return C;
  };
  HFS.char.actions = Object.keys(ACT);
  HFS.char.looks = LOOKS;
})();
