/* HFS — CameraController (2D), TransitionEngine, effets (particules, lumière, distorsion)
 * Caméra 2D : des calques avec une profondeur (0 = fond immobile, 1 = plan principal, >1 = premier plan) ;
 *   la caméra (x, y, zoom, rot, ry, focus) est appliquée à chaque calque avec parallaxe et flou de profondeur.
 * Transitions : chaque scène a une entrée (in) et une sortie (out) ; build.py fait chevaucher les scènes
 *   de la durée de la transition, la scène entrante est au-dessus. Les transitions peuvent viser un
 *   élément du décor (zoom À TRAVERS un objet, objet qui devient le monde suivant…).
 */
(function () {
  const HFS = window.HFS, { clamp, lerp, noise, hash } = HFS.m, Ez = HFS.ease;
  const W = 1080, H = 1920;
  // ------------------------------------------------------------------ caméra 2D
  const PRESETS = {
    static: () => [[0, {}], [1, {}]],
    dollyIn: (o) => [[0, { zoom: 1 }], [1, { zoom: 1 + .18 * (o.amount ?? 1) }]],
    dollyOut: (o) => [[0, { zoom: 1 + .2 * (o.amount ?? 1) }], [1, { zoom: 1 }]],
    truckLeft: (o) => [[0, { x: 140 * (o.amount ?? 1) }], [1, { x: -140 * (o.amount ?? 1) }]],
    truckRight: (o) => [[0, { x: -140 * (o.amount ?? 1) }], [1, { x: 140 * (o.amount ?? 1) }]],
    pedestalUp: (o) => [[0, { y: -160 * (o.amount ?? 1) }], [1, { y: 160 * (o.amount ?? 1) }]],
    pedestalDown: (o) => [[0, { y: 160 * (o.amount ?? 1) }], [1, { y: -160 * (o.amount ?? 1) }]],
    pan: (o) => [[0, { ry: -8 * (o.amount ?? 1), x: 60 }], [1, { ry: 8 * (o.amount ?? 1), x: -60 }]],
    tilt: (o) => [[0, { rx: 8 * (o.amount ?? 1), y: -60 }], [1, { rx: -6 * (o.amount ?? 1), y: 40 }]],
    orbit: (o) => [[0, { ry: -18 * (o.amount ?? 1), x: 220 }], [1, { ry: 18 * (o.amount ?? 1), x: -220 }]],
    crashZoom: (o) => [[0, { zoom: 1 }], [o.at ?? .5, { zoom: 1 }], [Math.min(1, (o.at ?? .5) + .06), { zoom: 1.55 }], [1, { zoom: 1.6 }]],
    slowZoom: () => [[0, { zoom: 1 }], [1, { zoom: 1.08 }]],
    roll: (o) => [[0, { rot: -4 * (o.amount ?? 1) }], [1, { rot: 4 * (o.amount ?? 1) }]],
    rackFocus: () => [[0, { focus: 0 }], [1, { focus: 1 }]],
    firstPerson: () => [[0, { zoom: 1, fp: 0 }], [1, { zoom: 1.35, fp: 1 }]],
  };
  const keyAt = (keys, p, ease) => { if (p <= keys[0][0]) return keys[0][1]; for (let i = 0; i < keys.length - 1; i++) { const [a, A] = keys[i], [b, B] = keys[i + 1]; if (p <= b) { const k = (ease || Ez.inOut)((p - a) / Math.max(1e-6, b - a)), o = {}; for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) o[key] = lerp(A[key] ?? DEF[key], B[key] ?? DEF[key], k); return o; } } return keys[keys.length - 1][1]; };
  const DEF = { x: 0, y: 0, zoom: 1, rot: 0, rx: 0, ry: 0, focus: -1, fp: 0 };
  /* HFS.camera(sc, [{el, depth}], { preset: 'dollyIn', amount, keys, ease, handheld, shake, follow(t)→{x,y}, focusBlur }) */
  HFS.camera = function (sc, layers, o = {}) {
    const keys = o.keys || (PRESETS[o.preset || 'slowZoom'] || PRESETS.slowZoom)(o);
    const ease = Ez[o.ease || 'inOut'] || Ez.inOut;
    const cam = { state: Object.assign({}, DEF), keys };
    sc.update(t => {
      const p = clamp(t / sc.dur), c = Object.assign({}, DEF, keyAt(keys, p, ease));
      if (o.follow) { const f = o.follow(t); c.x += f.x || 0; c.y += f.y || 0; }
      const hh = o.handheld ?? .6; c.x += noise(t * .8, 11) * 7 * hh + noise(t * 2.6, 12) * 2 * hh; c.y += noise(t * .7, 13) * 6 * hh; c.rot += noise(t * .5, 14) * .35 * hh;
      if (o.shake) { const s = typeof o.shake === 'function' ? o.shake(t) : o.shake; c.x += noise(t * 30, 21) * s; c.y += noise(t * 30, 22) * s; }
      if (c.fp) c.y += Math.sin(t * 9) * 8 * c.fp;       // balancement de marche (caméra subjective)
      cam.state = c;
      for (const L of layers) {
        const d = L.depth ?? 1, z = 1 + (c.zoom - 1) * d;
        L.el.style.transformOrigin = '540px 960px';
        L.el.style.transform = `perspective(1400px) translate(${(c.x * d).toFixed(1)}px,${(c.y * d).toFixed(1)}px) rotateY(${(c.ry * d).toFixed(2)}deg) rotateX(${(c.rx * d).toFixed(2)}deg) rotate(${(c.rot * d).toFixed(2)}deg) scale(${z.toFixed(4)})`;
        if (c.focus >= 0 || L.blur) { const fb = (o.focusBlur ?? 10) * Math.abs(d - (c.focus >= 0 ? lerp(o.focusFrom ?? .3, o.focusTo ?? 1, c.focus) : 1)); L.el.style.filter = (L.blur || fb > .4) ? `blur(${((L.blur || 0) + (c.focus >= 0 ? fb : 0)).toFixed(1)}px)` : ''; }
      }
    });
    return cam;
  };
  HFS.camera.presets = Object.keys(PRESETS);

  // ------------------------------------------------------------------ transitions
  function overlay(sc, z = 900) { return HFS.el('div', { class: 'hfs-ov', style: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: z, opacity: 0 } }, sc.stage.parentNode); }
  const IN = {
    cut: () => {},
    zoomIn: (sc, o, k) => ({ s: lerp(o.from ?? 1.9, 1, Ez.outCubic(k)), blur: (1 - k) * 16 }),
    zoomOut: (sc, o, k) => ({ s: lerp(o.from ?? .45, 1, Ez.outCubic(k)), blur: (1 - k) * 8 }),
    flyThrough: (sc, o, k) => ({ s: lerp(.15, 1, Ez.outExpo(k)), blur: (1 - k) * 20, o: clamp(k * 3) }),
    whip: (sc, o, k) => ({ x: (o.dir === 'left' ? -1 : 1) * (1 - Ez.outExpo(k)) * W * 1.05, blurX: (1 - k) * 40 }),
    rotate: (sc, o, k) => ({ r: (1 - Ez.outBack(k, 1.2)) * (o.angle ?? 90), s: lerp(.6, 1, Ez.outCubic(k)) }),
    perspective: (sc, o, k) => ({ ry: (1 - Ez.outCubic(k)) * -75, o: clamp(k * 2) }),
    motionBlur: (sc, o, k) => ({ blur: (1 - k) * 30, o: clamp(k * 2) }),
    iris: (sc, o, k) => ({ clip: `circle(${(Ez.inOutCubic(k) * 125).toFixed(2)}% at ${o.x ?? 540}px ${o.y ?? 960}px)` }),
    shape: (sc, o, k) => { const r = Ez.inOutCubic(k) * 2400, n = o.points ?? 5, cx = o.x ?? 540, cy = o.y ?? 960, pts = []; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.283 - 1.57 + k * 1.2, rr = i % 2 ? r * .45 : r; pts.push(`${(cx + Math.cos(a) * rr).toFixed(0)}px ${(cy + Math.sin(a) * rr).toFixed(0)}px`); } return { clip: `polygon(${pts.join(',')})` }; },
    liquid: (sc, o, k) => { const r = Ez.inOutCubic(k) * 1500, cx = o.x ?? 540, cy = o.y ?? 1800, pts = []; for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; const rr = r * (1 + .18 * Math.sin(a * 5 + k * 9) + .1 * Math.sin(a * 9 - k * 13)); pts.push(`${(cx + Math.cos(a) * rr).toFixed(0)}px ${(cy + Math.sin(a) * rr).toFixed(0)}px`); } return { clip: `polygon(${pts.join(',')})` }; },
    glitch: (sc, o, k, t) => { const on = k < 1; const sl = Math.floor(t * 30); const y0 = hash(sl, 3) * 1920, hh = 60 + hash(sl, 4) * 300; return { x: on ? (hash(sl, 5) - .5) * 120 * (1 - k) : 0, clip: on && k < .85 ? `inset(${(y0 / 19.2).toFixed(1)}% 0 ${(100 - (y0 + hh) / 19.2).toFixed(1)}% 0)` : null, o: k < .2 ? (sl % 2) : 1, hue: (1 - k) * 90 }; },
    split: (sc, o, k) => ({ clip: `inset(${((1 - Ez.inOutCubic(k)) * 50).toFixed(2)}% 0 ${((1 - Ez.inOutCubic(k)) * 50).toFixed(2)}% 0)` }),
    objectFill: (sc, o, k) => ({}),                                    // l'objet a rempli l'écran dans la scène précédente : on démarre plein cadre
    flash: (sc, o, k) => ({}),
    particles: (sc, o, k) => ({}),
  };
  const OUT = {
    cut: () => {},
    zoomThrough: (sc, o, k) => ({ s: lerp(1, o.to ?? 14, Ez.inExpo(k)), ox: o.x ?? 540, oy: o.y ?? 960, blur: Ez.inCubic(k) * 10 }),   // la caméra plonge à travers un point / un objet
    whip: (sc, o, k) => ({ x: (o.dir === 'left' ? 1 : -1) * Ez.inExpo(k) * W * 1.05, blurX: k * 40 }),
    rotate: (sc, o, k) => ({ r: Ez.inCubic(k) * -(o.angle ?? 90), s: lerp(1, .6, Ez.inCubic(k)) }),
    perspective: (sc, o, k) => ({ ry: Ez.inCubic(k) * 75 }),
    motionBlur: (sc, o, k) => ({ blur: k * 30 }),
    fall: (sc, o, k) => ({ y: Ez.inQuad(k) * H, r: k * 6 }),
    shrink: (sc, o, k) => ({ s: lerp(1, .05, Ez.inCubic(k)), ox: o.x ?? 540, oy: o.y ?? 960 }),
    glitch: IN.glitch,
    objectFill: () => ({}), flash: () => ({}), particles: () => ({}),
  };
  /* sc.transitionIn('iris', {dur, x, y}) ; sc.transitionOut('zoomThrough', {dur, x, y, color}) */
  HFS.transitions = {
    IN, OUT, kinds: { in: Object.keys(IN), out: Object.keys(OUT) },
    apply(sc, side, kind, o = {}) {
      const dur = o.dur ?? .45, fn = (side === 'in' ? IN : OUT)[kind] || IN.cut;
      let ov = null, cv = null;
      if (kind === 'flash') { ov = overlay(sc); ov.style.background = o.color || '#ffffff'; }
      if (kind === 'objectFill') { ov = overlay(sc); ov.style.background = o.color || '#000'; }
      if (kind === 'particles') { cv = HFS.el('canvas', { width: W, height: H, style: { position: 'absolute', inset: '0', zIndex: 900, pointerEvents: 'none' } }, sc.stage.parentNode); }
      const st = { k: 1 };
      sc.update(t => {
        const dl = side === 'in' ? (o.delay || 0) : 0, k = side === 'in' ? clamp((t - dl) / Math.max(.01, dur - dl)) : clamp((t - (sc.dur - dur)) / dur), active = side === 'in' ? k < 1 : k > 0;
        const T = active ? (fn(sc, o, k, t) || {}) : {};
        if (side === 'in' && t < dl) T.o = 0;   // la scène entrante reste invisible tant que la sortante n'a pas fini son geste
        st[side] = T; st.k = k;
        if (kind === 'flash' && ov) ov.style.opacity = side === 'in' ? (1 - Ez.outCubic(k)) : Ez.inCubic(k);
        if (kind === 'objectFill' && ov) { if (side === 'out') { const r = o.rect || [440, 860, 200, 200], e = Ez.inOutCubic(k); const x = lerp(r[0], 0, e), y = lerp(r[1], 0, e), w = lerp(r[2], W, e), h = lerp(r[3], H, e); ov.style.opacity = k > 0 ? 1 : 0; ov.style.clipPath = `inset(${y}px ${W - x - w}px ${H - y - h}px ${x}px round ${lerp(o.radius ?? 40, 0, e)}px)`; } else ov.style.opacity = 1 - Ez.inOutCubic(k); }
        if (cv) { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, W, H); const kk = side === 'in' ? 1 - k : k; if (kk > 0) { ctx.fillStyle = o.color || '#ffffff'; const cell = 36; for (let y = 0; y < H; y += cell) for (let x = 0; x < W; x += cell) { const r = clamp(kk * 2.2 - hash(x * 7 + y, 9)) * cell * .75; if (r > .5) { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, r, 0, 6.283); ctx.fill(); } } } }
      });
      sc._trans = sc._trans || []; sc._trans.push(st);
      if (!sc._transApplied) { sc._transApplied = true;
        sc.after(() => { const A = Object.assign({}, ...sc._trans.map(s => s.in || {}), ...sc._trans.map(s => s.out || {})); const el = sc.stage; const s = A.s ?? 1;
          el.style.transformOrigin = `${A.ox ?? 540}px ${A.oy ?? 960}px`;
          el.style.transform = `perspective(1600px) translate(${(A.x || 0).toFixed(1)}px,${(A.y || 0).toFixed(1)}px) rotateY(${(A.ry || 0).toFixed(1)}deg) rotate(${(A.r || 0).toFixed(1)}deg) scale(${s.toFixed(4)})`;
          el.style.clipPath = A.clip || ''; el.style.opacity = A.o ?? 1;
          const f = []; if (A.blur > .3) f.push(`blur(${A.blur.toFixed(1)}px)`); if (A.hue) f.push(`hue-rotate(${A.hue.toFixed(0)}deg) saturate(2)`); el.style.filter = f.join(' ');
          if (A.blurX > .5) el.style.filter += ` url(#hfs-hblur)`; });
      }
    },
  };
  // flou horizontal (filet de mouvement) partagé
  HFS.ensureDefs = () => { if (document.getElementById('hfs-defs')) return; const s = HFS.svg('svg', { id: 'hfs-defs', width: 0, height: 0, style: 'position:absolute' }, document.body);
    const d = HFS.svg('defs', {}, s); const f = HFS.svg('filter', { id: 'hfs-hblur', x: '-20%', y: '0', width: '140%', height: '100%' }, d); HFS.svg('feGaussianBlur', { stdDeviation: '18 0' }, f);
    for (let i = 0; i < 3; i++) { const b = HFS.svg('filter', { id: 'hfs-boil' + i }, d); HFS.svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '.03', numOctaves: 2, seed: i * 7 + 3, result: 'n' }, b); HFS.svg('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 6 }, b); } };

  // ------------------------------------------------------------------ effets
  HFS.fx = {
    /* particules déterministes sur un <canvas> : kind = dust | sparks | confetti | rain | snow | bokeh | bills */
    particles(canvas, o = {}) {
      const ctx = canvas.getContext('2d'), n = o.n ?? 80, r = HFS.m.rng(o.seed ?? 7), P = [];
      for (let i = 0; i < n; i++) P.push({ x: r() * W, y: r() * H, s: .4 + r() * .9, ph: r() * 10, c: (o.colors || ['#ffffff'])[i % (o.colors || ['#fff']).length], a: r() * 6.28 });
      return t => {
        ctx.clearRect(0, 0, W, H);
        for (const p of P) {
          let x = p.x, y = p.y, sz = (o.size ?? 4) * p.s, al = o.alpha ?? .8;
          switch (o.kind) {
            case 'rain': y = (p.y + t * 2400 * p.s) % (H + 200) - 100; x = p.x - (y - p.y) * .12; ctx.strokeStyle = p.c; ctx.globalAlpha = al * .7; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 40 * p.s); ctx.stroke(); continue;
            case 'snow': y = (p.y + t * 120 * p.s) % H; x = p.x + Math.sin(t + p.ph) * 30; break;
            case 'sparks': { const T0 = o.at ?? 0, u = t - T0 - p.ph * .02; if (u < 0 || u > 1.2) continue; const v = 600 + p.s * 900; x = (o.x ?? 540) + Math.cos(p.a) * v * u; y = (o.y ?? 960) + Math.sin(p.a) * v * u + 1400 * u * u; al *= 1 - u / 1.2; break; }
            case 'confetti': { y = (p.y + t * 380 * p.s) % (H + 100) - 50; x = p.x + Math.sin(t * 2 + p.ph) * 60; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4 + p.ph); ctx.fillStyle = p.c; ctx.globalAlpha = al; ctx.fillRect(-sz, -sz * .5, sz * 2, sz); ctx.restore(); continue; }
            case 'bokeh': x = p.x + Math.sin(t * .3 + p.ph) * 40; y = p.y + Math.cos(t * .25 + p.ph) * 30; sz *= 9; al *= .35; break;
            case 'bills': { const u = (t * .45 * p.s + p.ph) % 1; y = -100 + u * (H + 200); x = p.x + Math.sin(u * 9 + p.ph) * 90; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(u * 7 + p.ph) * 1.2); ctx.scale(1, Math.cos(u * 11 + p.ph)); ctx.fillStyle = '#8fd18a'; ctx.globalAlpha = .95; ctx.fillRect(-46, -22, 92, 44); ctx.strokeStyle = '#2f6b2a'; ctx.lineWidth = 3; ctx.strokeRect(-40, -16, 80, 32); ctx.restore(); continue; }
            default: y = (p.y - t * 30 * p.s) % H; if (y < 0) y += H; x = p.x + Math.sin(t * .6 + p.ph) * 20; al *= .5 + .5 * Math.sin(t * 2 + p.ph);
          }
          ctx.globalAlpha = Math.max(0, al); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(x, y, sz, 0, 6.283); ctx.fill();
        }
        ctx.globalAlpha = 1;
      };
    },
    /* rayons lumineux tournants (CSS) */
    rays(el, o = {}) { el.style.background = `repeating-conic-gradient(from 0deg at ${o.x ?? 50}% ${o.y ?? 40}%, ${o.color || 'rgba(255,240,200,.18)'} 0deg 6deg, transparent 6deg 18deg)`; el.style.mixBlendMode = 'screen'; return t => { el.style.transform = `rotate(${(t * (o.speed ?? 6)).toFixed(2)}deg) scale(2)`; }; },
    /* trait « vivant » (dessin à la main) : change de graine 12 fois par seconde, comme une animation faite main */
    boil(el, fps = 12) { HFS.ensureDefs(); return t => { el.style.filter = `url(#hfs-boil${Math.floor(t * fps) % 3})`; }; },
  };
})();
