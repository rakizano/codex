/* HFS — HyperFrames Studio : noyau
 * Tout est une fonction PURE du temps local de la scène (t) : chaque scène construit UNE timeline GSAP en pause,
 * et un seul tween « horloge » (onUpdate) appelle les fonctions de rendu. HyperFrames peut donc chercher
 * n'importe quelle image dans n'importe quel ordre : même timestamp → même image.
 */
(function () {
  const HFS = (window.HFS = window.HFS || {});
  // ---------------------------------------------------------------- maths
  const M = (HFS.m = {
    clamp: (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    lerp: (a, b, k) => a + (b - a) * k,
    mix: (a, b, k) => a + (b - a) * k,
    smooth: k => k * k * (3 - 2 * k),
    rng(seed) { let a = typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) : seed | 0;
      return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    hash(i, s = 1) { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); },
    noise(x, s = 0) { const i = Math.floor(x), f = x - i, a = M.hash(i, s) * 2 - 1, b = M.hash(i + 1, s) * 2 - 1, u = f * f * (3 - 2 * f); return a + (b - a) * u; },
  });
  // courbes (les mêmes noms que GSAP quand elles existent ; les nôtres sont des fonctions pures de k)
  const E = (HFS.ease = {
    linear: k => k, inQuad: k => k * k, outQuad: k => 1 - (1 - k) * (1 - k), inOut: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    inCubic: k => k * k * k, outCubic: k => 1 - Math.pow(1 - k, 3), inOutCubic: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    outExpo: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k), inExpo: k => k <= 0 ? 0 : Math.pow(2, 10 * k - 10),
    outBack: (k, s = 1.70158) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2),
    outElastic: (k, a = 1, p = .35) => k <= 0 ? 0 : k >= 1 ? 1 : a * Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI) / (p * 6.6)) + 1,
    // ressort fermé (rapport d'amortissement z, pulsation w) : position 0 → 1
    spring: (u, z = .45, w = 18) => { if (u <= 0) return 0; const wd = w * Math.sqrt(Math.max(1e-4, 1 - z * z)); return 1 - Math.exp(-z * w * u) * (Math.cos(wd * u) + (z * w / wd) * Math.sin(wd * u)); },
  });
  // ---------------------------------------------------------------- physique (formes fermées, donc déterministes)
  HFS.phys = {
    /* chute depuis la hauteur h (px) avec gravité g (px/s²) et restitution e : renvoie {y (≤0 = au-dessus du sol), v, impact (s depuis le dernier impact), n (nb d'impacts)} */
    drop(u, h, g = 6000, e = .42, maxB = 4) {
      if (u <= 0) return { y: -h, v: 0, impact: -1, n: 0 };
      let t0 = Math.sqrt(2 * h / g);
      if (u < t0) return { y: -h + .5 * g * u * u, v: g * u, impact: -1, n: 0 };
      let v = g * t0 * e, t = u - t0, n = 1;
      while (n <= maxB) { const T = 2 * v / g; if (t < T) return { y: -(v * t - .5 * g * t * t), v: v - g * t, impact: t, n }; t -= T; v *= e; n++; }
      return { y: 0, v: 0, impact: t + 99, n };
    },
    /* écrasement au contact : 0 → 1 → 0 sur ~0,12 s après un impact (intensité décroissante avec le n° de rebond) */
    squash(impact, n, dur = .14) { if (impact < 0 || impact > dur) return 0; const k = impact / dur; return Math.sin(k * Math.PI) * Math.pow(.55, n - 1); },
    /* projectile : position après u s, vitesse (vx, vy), gravité g */
    ballistic(u, vx, vy, g = 3000) { return { x: vx * u, y: vy * u + .5 * g * u * u }; },
  };
  // ---------------------------------------------------------------- audio (temps GLOBAUX, écrits par build.py dans window.HFS_AUDIO)
  HFS.audio = {
    get data() { return window.HFS_AUDIO || { beats: [], kicks: [], snares: [], onsets: [], bass: [], silences: [], rises: [] }; },
    /* impulsion 0..1 qui décroît après chaque événement du type demandé (kick, snare, beats, onsets) */
    pulse(tGlobal, kind = 'beats', decay = 8) { const a = HFS.audio.data[kind] || []; let last = -1; for (const x of a) { if (x <= tGlobal) last = x; else break; } return last < 0 ? 0 : Math.exp(-(tGlobal - last) * decay); },
    next(tGlobal, kind = 'kicks') { return (HFS.audio.data[kind] || []).find(x => x >= tGlobal); },
  };
  // ---------------------------------------------------------------- scène
  /* const sc = HFS.scene('s03', { dur: 2.6, t0: 3.72, stage: '#s03-stage' });
     sc.update(t => …) ; sc.in('zoom') ; sc.out('whip') ; sc.finish() */
  HFS.scene = function (id, o) {
    const sc = { id, dur: o.dur, t0: o.t0 || 0, ups: [], post: [], stage: o.stage ? document.querySelector(o.stage) : document.getElementById(id + '-stage'), root: document.getElementById(id + '-stage') ? document.getElementById(id + '-stage').parentNode : document.getElementById('root'),
      update(fn) { sc.ups.push(fn); return sc; }, after(fn) { sc.post.push(fn); return sc; },
      beat(t, kind = 'beats', decay = 8) { return HFS.audio.pulse(sc.t0 + t, kind, decay); },
      local(tGlobal) { return tGlobal - sc.t0; },
      finish() {
        const tl = gsap.timeline({ paused: true }), clock = { t: 0 };
        const run = t => { for (const f of sc.ups) f(t); for (const f of sc.post) f(t); };
        tl.to(clock, { t: sc.dur, duration: sc.dur, ease: 'none', onUpdate: () => run(clock.t) }, 0);
        run(0);
        window.__timelines = window.__timelines || {}; window.__timelines[id] = tl;
        return tl;
      },
    };
    HFS._scenes = HFS._scenes || {}; HFS._scenes[id] = sc;
    return sc;
  };
  // élément HTML utilitaire (aucun élément « temporisé » n'est créé par script : seulement des enfants décoratifs)
  HFS.el = (tag, attrs = {}, parent) => { const e = document.createElement(tag); for (const k in attrs) { if (k === 'style') Object.assign(e.style, attrs.style); else if (k === 'text') e.textContent = attrs.text; else e.setAttribute(k, attrs[k]); } if (parent) parent.appendChild(e); return e; };
  HFS.svg = (tag, attrs = {}, parent) => { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
})();
