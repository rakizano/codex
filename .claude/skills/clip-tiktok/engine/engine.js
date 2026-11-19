/* =====================================================================
 * CLIP ENGINE — moteur d'animation déterministe pour clips TikTok 9:16
 * ---------------------------------------------------------------------
 * - Rendu SVG (illustrations) + HTML (typographie) dans Chromium.
 * - Chaque image est une fonction PURE du temps T (secondes depuis le
 *   début du passage) : CLIP.renderAt(T). Aucun état accumulé, ce qui
 *   permet un rendu parallèle par segments.
 * - Les scènes sont écrites par chanson dans scenes.js via
 *   CLIP.scene(id, S => { ... }) et pilotées par storyboard.json.
 * ===================================================================== */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const W = 1080, H = 1920;
  // Zone de sécurité TikTok (boutons à droite, légende + barre musique en bas)
  const SAFE = { left: 70, right: 900, top: 230, bottom: 1440 };

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  function h(tag, attrs, children) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    if (children) for (const c of [].concat(children)) if (c) el.appendChild(c.el || c);
    return el;
  }
  function set(el, attrs) { for (const k in attrs) el.setAttribute(k, attrs[k]); return el; }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const rad = d => d * Math.PI / 180;
  const mod = (a, n) => ((a % n) + n) % n; // modulo toujours positif (t peut être < 0 pendant les transitions)
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
    const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.int = (lo, hi) => Math.floor(lo + r() * (hi - lo + 1));
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    return r;
  }
  // Bruit 1D lisse déterministe (value noise)
  function noise(x, seed = 0) {
    const i = Math.floor(x), f = x - i;
    const v = n => { let t = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return t - Math.floor(t); };
    const u = f * f * (3 - 2 * f);
    return lerp(v(i), v(i + 1), u) * 2 - 1;
  }
  const Ease = {
    linear: k => k,
    inQuad: k => k * k, outQuad: k => k * (2 - k), inOutQuad: k => k < .5 ? 2 * k * k : -1 + (4 - 2 * k) * k,
    inCubic: k => k * k * k, outCubic: k => (--k) * k * k + 1,
    inOutCubic: k => k < .5 ? 4 * k * k * k : (k - 1) * (2 * k - 2) * (2 * k - 2) + 1,
    inExpo: k => k === 0 ? 0 : Math.pow(2, 10 * (k - 1)), outExpo: k => k === 1 ? 1 : 1 - Math.pow(2, -10 * k),
    inOutExpo: k => k === 0 ? 0 : k === 1 ? 1 : k < .5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
    outBack: k => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    inBack: k => { const c = 1.70158; return (c + 1) * k * k * k - c * k * k; },
    outElastic: k => k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (2 * Math.PI) / 3) + 1,
    inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    outSine: k => Math.sin(k * Math.PI / 2),
  };
  const ease = e => typeof e === 'function' ? e : (Ease[e] || Ease.inOutCubic);
  // Interpolation par images-clés : keys = [[t, valeur|tableau|objet], ...]
  function kf(t, keys, e) {
    const E = ease(e);
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t <= t1) {
        const k = E((t - t0) / (t1 - t0 || 1));
        if (typeof v0 === 'number') return lerp(v0, v1, k);
        if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], k));
        const o = {}; for (const key in v0) o[key] = lerp(v0[key], v1[key] != null ? v1[key] : v0[key], k); return o;
      }
    }
    return keys[keys.length - 1][1];
  }
  function hex2rgb(c) { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mixColor(a, b, k) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], k)).toString(16).padStart(2, '0')).join(''); }

  /* ------------------------------------------------------------------ */
  /* Scène DOM                                                           */
  /* ------------------------------------------------------------------ */
  let svg, defs, world, overlay, lyricsDiv, fxDiv, dipRect;
  let uid = 0; const nid = p => (p || 'id') + (++uid);
  const sceneBuilders = {};
  let SB = null, CFG = null, built = [], currentT = 0;
  let beats = [];

  function initDOM() {
    document.body.innerHTML = '';
    const stage = document.createElement('div'); stage.id = 'stage';
    svg = h('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, id: 'svg' });
    defs = h('defs'); svg.appendChild(defs);
    world = h('g', { id: 'world' }); svg.appendChild(world);
    overlay = h('g', { id: 'overlay' }); svg.appendChild(overlay);
    dipRect = h('rect', { x: -10, y: -10, width: W + 20, height: H + 20, fill: '#000', opacity: 0 }); overlay.appendChild(dipRect);
    stage.appendChild(svg);
    fxDiv = document.createElement('div'); fxDiv.id = 'fx';
    lyricsDiv = document.createElement('div'); lyricsDiv.id = 'lyrics';
    const grain = document.createElement('div'); grain.id = 'grain';
    document.body.append(stage, fxDiv, lyricsDiv, grain);
    buildSharedDefs();
  }

  function buildSharedDefs() {
    // Filtres "trait vivant" (boil) façon animation dessinée à la main
    for (let i = 0; i < 3; i++) {
      defs.appendChild(h('filter', { id: 'rough' + i, x: '-5%', y: '-5%', width: '110%', height: '110%' }, [
        h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: 2, seed: 7 + i * 13, result: 'n' }),
        h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 7, xChannelSelector: 'R', yChannelSelector: 'G' })]));
      defs.appendChild(h('filter', { id: 'wobble' + i, x: '-10%', y: '-10%', width: '120%', height: '120%' }, [
        h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.012', numOctaves: 2, seed: 3 + i * 29, result: 'n' }),
        h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 22, xChannelSelector: 'R', yChannelSelector: 'G' })]));
    }
    defs.appendChild(h('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, [
      h('feGaussianBlur', { stdDeviation: 18, result: 'b' }),
      h('feMerge', {}, [h('feMergeNode', { in: 'b' }), h('feMergeNode', { in: 'SourceGraphic' })])]));
    defs.appendChild(h('filter', { id: 'softblur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, [h('feGaussianBlur', { stdDeviation: 10 })]));
    defs.appendChild(h('filter', { id: 'bigblur', x: '-30%', y: '-30%', width: '160%', height: '160%' }, [h('feGaussianBlur', { stdDeviation: 40 })]));
    defs.appendChild(h('filter', { id: 'paper', x: 0, y: 0, width: '100%', height: '100%' }, [
      h('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: 3, seed: 2, result: 'n' }),
      h('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0.35 0' })]));
    defs.appendChild(h('filter', { id: 'whipblur', x: '-20%', y: '-5%', width: '140%', height: '110%' }, [h('feGaussianBlur', { id: 'whipdev', stdDeviation: '0 0' })]));
  }

  /* ------------------------------------------------------------------ */
  /* Grain animé + vignette + étalonnage                                 */
  /* ------------------------------------------------------------------ */
  const grainTiles = [];
  function buildFX(fx) {
    fx = Object.assign({ grain: 0.06, vignette: 0.45, scanlines: 0, halftone: 0, grade: '', tint: null, tintOpacity: 0.0, tintBlend: 'soft-light', paper: 0 }, fx || {});
    CFG.fx = fx;
    const g = document.getElementById('grain');
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d'); const img = ctx.createImageData(256, 256); const r = rng(1000 + i);
      for (let p = 0; p < img.data.length; p += 4) { const v = r() * 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255; }
      ctx.putImageData(img, 0, 0); grainTiles.push(c.toDataURL());
    }
    g.style.opacity = fx.grain;
    let bg = '';
    if (fx.vignette > 0) bg += `radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,${fx.vignette}) 100%)`;
    fxDiv.style.background = bg;
    if (fx.scanlines > 0) {
      const s = document.createElement('div'); s.className = 'fxlayer';
      s.style.background = `repeating-linear-gradient(0deg, rgba(0,0,0,${fx.scanlines}) 0px, rgba(0,0,0,${fx.scanlines}) 2px, transparent 2px, transparent 5px)`;
      fxDiv.appendChild(s);
    }
    if (fx.halftone > 0) {
      const s = document.createElement('div'); s.className = 'fxlayer';
      s.style.background = `radial-gradient(circle, rgba(0,0,0,${fx.halftone}) 1.4px, transparent 1.8px)`; s.style.backgroundSize = '9px 9px'; s.style.mixBlendMode = 'multiply';
      fxDiv.appendChild(s);
    }
    if (fx.tint) {
      const s = document.createElement('div'); s.className = 'fxlayer'; s.style.background = fx.tint; s.style.opacity = fx.tintOpacity || 0.25; s.style.mixBlendMode = fx.tintBlend;
      fxDiv.appendChild(s);
    }
    if (fx.scrimTop > 0) { const d = document.createElement('div'); d.className = 'fxlayer'; d.style.background = `linear-gradient(180deg, rgba(0,0,0,${fx.scrimTop}) 0%, rgba(0,0,0,${fx.scrimTop * .65}) 24%, rgba(0,0,0,0) 46%)`; fxDiv.appendChild(d); }
    if (fx.scrimBottom > 0) { const d = document.createElement('div'); d.className = 'fxlayer'; d.style.background = `linear-gradient(0deg, rgba(0,0,0,${fx.scrimBottom}) 0%, rgba(0,0,0,0) 40%)`; fxDiv.appendChild(d); }
    if (fx.paper > 0) { overlay.appendChild(h('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#paper)', opacity: fx.paper })); }
    if (fx.grade) document.getElementById('stage').style.filter = fx.grade;
    // Pixel art : échantillonne un point par cellule de N px puis l'étale (mosaïque nette),
    // et réduit éventuellement la palette (posterize). Le texte (HTML) reste net.
    if (fx.pixelate) {
      const N = fx.pixelate, r = Math.floor(N / 2);
      const kids = [
        h('feFlood', { x: r, y: r, width: 1, height: 1, 'flood-color': '#000', result: 'dot' }),
        h('feComposite', { in: 'dot', in2: 'dot', operator: 'over', width: N, height: N, result: 'cell' }),
        h('feTile', { in: 'cell', result: 'grid' }),
        h('feComposite', { in: 'SourceGraphic', in2: 'grid', operator: 'in', result: 'samples' }),
        h('feMorphology', { in: 'samples', operator: 'dilate', radius: r, result: 'pix' }),
      ];
      if (fx.posterize) {
        const lv = fx.posterize, vals = Array.from({ length: lv }, (_, i) => (i / (lv - 1)).toFixed(3)).join(' ');
        kids.push(h('feComponentTransfer', { in: 'pix' }, ['R', 'G', 'B'].map(c => h('feFunc' + c, { type: 'discrete', tableValues: vals }))));
      }
      defs.appendChild(h('filter', { id: 'pixelate', x: 0, y: 0, width: W, height: H, filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' }, kids));
      world.setAttribute('filter', 'url(#pixelate)');
      overlay.setAttribute('filter', 'url(#pixelate)');
    }
  }
  function updateGrain(T) {
    const g = document.getElementById('grain'); const f = Math.floor(T * 24);
    g.style.backgroundImage = `url(${grainTiles[f % 4]})`;
    g.style.backgroundPosition = `${(f * 37) % 256}px ${(f * 91) % 256}px`;
  }

  /* ------------------------------------------------------------------ */
  /* Bibliothèque d'éléments illustrés (E.*)                             */
  /* Chaque fabrique retourne { el, update?(t, p) }                      */
  /* ------------------------------------------------------------------ */
  const E = {};
  const item = (el, update) => ({ el, update });

  E.raw = function (markup) {
    const g = h('g'); g.innerHTML = markup;
    const it = item(g); it.q = sel => g.querySelector(sel); it.qa = sel => [...g.querySelectorAll(sel)]; return it;
  };
  E.group = function (attrs, children) { return item(h('g', attrs, children)); };

  E.rect = (a) => item(h('rect', a));
  E.circle = (a) => item(h('circle', a));
  E.path = (d, a) => item(h('path', Object.assign({ d }, a)));

  // Dégradé plein cadre (surdimensionné pour encaisser zooms/pans)
  E.sky = function (stops, opts = {}) {
    const id = nid('sky');
    const grad = h('linearGradient', { id, x1: 0, y1: 0, x2: opts.horizontal ? 1 : 0, y2: opts.horizontal ? 0 : 1 },
      stops.map((c, i) => Array.isArray(c) ? h('stop', { offset: c[0], 'stop-color': c[1] }) : h('stop', { offset: i / (stops.length - 1), 'stop-color': c })));
    defs.appendChild(grad);
    return item(h('rect', { x: -W, y: -H * 0.6, width: W * 3, height: H * 2.2, fill: `url(#${id})` }));
  };
  E.radial = function (stops, opts = {}) {
    const id = nid('rad');
    const grad = h('radialGradient', { id, cx: opts.cx ?? 0.5, cy: opts.cy ?? 0.5, r: opts.r ?? 0.6 },
      stops.map((c, i) => Array.isArray(c) ? h('stop', { offset: c[0], 'stop-color': c[1], 'stop-opacity': c[2] ?? 1 }) : h('stop', { offset: i / (stops.length - 1), 'stop-color': c })));
    defs.appendChild(grad);
    return item(h('rect', { x: opts.x ?? -W, y: opts.y ?? -H * 0.6, width: opts.w ?? W * 3, height: opts.h ?? H * 2.2, fill: `url(#${id})`, opacity: opts.opacity ?? 1 }));
  };
  E.gradientDef = function (stops, vertical = true) {
    const id = nid('g');
    defs.appendChild(h('linearGradient', { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 },
      stops.map((c, i) => Array.isArray(c) ? h('stop', { offset: c[0], 'stop-color': c[1], 'stop-opacity': c[2] ?? 1 }) : h('stop', { offset: i / (stops.length - 1), 'stop-color': c }))));
    return `url(#${id})`;
  };

  E.sun = function ({ x = 540, y = 700, r = 160, color = '#ffd27a', glow = 0.6, pulse = 0.02 } = {}) {
    const halo = h('circle', { cx: x, cy: y, r: r * 2.2, fill: color, opacity: glow * 0.35, filter: 'url(#bigblur)' });
    const disc = h('circle', { cx: x, cy: y, r, fill: color });
    const g = h('g', {}, [halo, disc]);
    return item(g, t => { const s = 1 + Math.sin(t * 2) * pulse; set(disc, { r: r * s }); set(halo, { r: r * 2.2 * (1 + Math.sin(t * 1.3) * pulse * 2) }); });
  };
  E.moon = function ({ x = 700, y = 500, r = 110, color = '#f4f1e1', phase = 0.35, bg = '#0b1030' } = {}) {
    const g = h('g', {}, [h('circle', { cx: x, cy: y, r: r * 1.8, fill: color, opacity: .12, filter: 'url(#bigblur)' }), h('circle', { cx: x, cy: y, r, fill: color }), h('circle', { cx: x + r * phase * 2, cy: y - r * .1, r: r * .95, fill: bg })]);
    return item(g);
  };
  E.stars = function ({ n = 120, color = '#fff', seed = 1, area = [-200, -300, W + 400, H * 0.7], twinkle = 1 } = {}) {
    const r = rng(seed), g = h('g'), list = [];
    for (let i = 0; i < n; i++) {
      const c = h('circle', { cx: area[0] + r() * area[2], cy: area[1] + r() * area[3], r: r.range(1, 3.6), fill: color });
      g.appendChild(c); list.push([c, r() * 10, r.range(1, 4)]);
    }
    return item(g, t => { for (const [c, ph, sp] of list) c.setAttribute('opacity', 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(ph + t * sp * twinkle))); });
  };
  E.clouds = function ({ n = 5, y = 400, spread = 300, color = '#fff', opacity = 0.9, speed = 20, seed = 2, scale = 1, blur = false } = {}) {
    const r = rng(seed), g = h('g', { opacity }), list = [];
    for (let i = 0; i < n; i++) {
      const cg = h('g'); const w = r.range(180, 340) * scale;
      for (let j = 0; j < 6; j++) cg.appendChild(h('circle', { cx: (j / 5 - .5) * w, cy: -Math.sin(j / 5 * Math.PI) * w * .22 + r.range(-10, 10), r: w * r.range(.16, .26), fill: color }));
      cg.appendChild(h('rect', { x: -w * .55, y: -4, width: w * 1.1, height: w * .18, rx: w * .09, fill: color }));
      if (blur) cg.setAttribute('filter', 'url(#softblur)');
      g.appendChild(cg); list.push([cg, r.range(-300, W + 300), y + r.range(-spread / 2, spread / 2), r.range(.6, 1.4)]);
    }
    return item(g, t => { for (const [cg, x0, y0, k] of list) { const x = mod(x0 + t * speed * k + 400, W + 800) - 400; cg.setAttribute('transform', `translate(${x},${y0})`); } });
  };
  // Crêtes procédurales (montagnes, collines, dunes)
  E.ridge = function ({ y = 1300, amp = 220, freq = 3, color = '#223', seed = 3, rough = 0.35, bottom = H + 600, smoothness = 1 } = {}) {
    let d = `M ${-W} ${bottom} L ${-W} ${y}`;
    for (let x = -W; x <= 2 * W; x += 18) {
      const u = x / W * freq;
      const v = noise(u, seed) * amp + noise(u * 4, seed + 7) * amp * rough * 0.5 / smoothness + noise(u * 13, seed + 3) * amp * rough * 0.12 / smoothness;
      d += ` L ${x} ${y + v}`;
    }
    d += ` L ${2 * W} ${bottom} Z`;
    return item(h('path', { d, fill: color }));
  };
  E.mountains = (o = {}) => E.ridge(Object.assign({ amp: 300, freq: 2.2, rough: .6 }, o));
  E.hills = (o = {}) => E.ridge(Object.assign({ amp: 90, freq: 1.4, rough: .1, smoothness: 3 }, o));
  E.ground = ({ y = 1500, color = '#222', h: hh = H } = {}) => item(h('rect', { x: -W, y, width: 3 * W, height: hh + 800, fill: color }));

  E.city = function ({ y = 1400, color = '#141826', seed = 4, minH = 150, maxH = 650, windows = '#ffd98a', lit = 0.35, density = 1, flicker = true, x0 = -400, x1 = W + 400 } = {}) {
    const r = rng(seed), g = h('g'), wins = [];
    let x = x0;
    while (x < x1) {
      const bw = r.range(70, 170) / density, bh = r.range(minH, maxH);
      g.appendChild(h('rect', { x, y: y - bh, width: bw + 1, height: bh + 1200, fill: color }));
      if (r() < .25) g.appendChild(h('rect', { x: x + bw * .4, y: y - bh - 40, width: 6, height: 40, fill: color }));
      if (windows) {
        for (let wy = y - bh + 22; wy < y - 20; wy += 34) for (let wx = x + 12; wx < x + bw - 18; wx += 26) {
          if (r() < lit) { const c = h('rect', { x: wx, y: wy, width: 12, height: 18, fill: windows }); g.appendChild(c); wins.push([c, r() * 100, r()]); }
        }
      }
      x += bw + r.range(0, 8);
    }
    return item(g, t => { if (!flicker) return; for (const [c, ph, k] of wins) if (k < .08) c.setAttribute('opacity', noise(t * 3 + ph, 1) > .3 ? .2 : 1); });
  };
  E.sea = function ({ y = 1350, color = '#1b3b5a', light = '#5f8fb5', layers = 4, amp = 18, speed = 1, seed = 5 } = {}) {
    const g = h('g'), paths = [];
    for (let i = 0; i < layers; i++) { const p = h('path', { fill: mixColor(light, color, i / Math.max(1, layers - 1)) }); g.appendChild(p); paths.push(p); }
    return item(g, t => {
      paths.forEach((p, i) => {
        const yy = y + i * 70, a = amp * (1 + i * .5); let d = `M ${-W} ${H + 800} L ${-W} ${yy}`;
        for (let x = -W; x <= 2 * W; x += 30) d += ` L ${x} ${yy + Math.sin(x / (120 + i * 40) + t * speed * (1.4 - i * .2) + i) * a + noise(x / 300 + t * .3, seed + i) * a}`;
        p.setAttribute('d', d + ` L ${2 * W} ${H + 800} Z`);
      });
    });
  };
  E.road = function ({ horizon = 1000, color = '#2a2a2e', line = '#f2e6c9', width = 1500, speed = 1.2 } = {}) {
    const cx = W / 2, g = h('g');
    g.appendChild(h('path', { d: `M ${cx - 20} ${horizon} L ${cx + 20} ${horizon} L ${cx + width} ${H + 400} L ${cx - width} ${H + 400} Z`, fill: color }));
    const dashes = []; for (let i = 0; i < 12; i++) { const d = h('path', { fill: line }); g.appendChild(d); dashes.push(d); }
    return item(g, t => {
      dashes.forEach((d, i) => {
        const z0 = mod(i / 12 + t * speed * .15, 1), z1 = z0 + .035;
        const yy = z => horizon + Math.pow(z, 2.2) * (H + 400 - horizon), ww = z => 3 + Math.pow(z, 2.2) * 40;
        d.setAttribute('d', `M ${cx - ww(z0)} ${yy(z0)} L ${cx + ww(z0)} ${yy(z0)} L ${cx + ww(z1)} ${yy(z1)} L ${cx - ww(z1)} ${yy(z1)} Z`);
      });
    });
  };
  E.rain = function ({ n = 160, angle = 12, speed = 1800, color = '#bcd', len = 60, opacity = .5, seed = 6 } = {}) {
    const r = rng(seed), g = h('g', { opacity, stroke: color, 'stroke-width': 2.2, 'stroke-linecap': 'round' }), drops = [];
    for (let i = 0; i < n; i++) { const l = h('line'); g.appendChild(l); drops.push([l, r() * (W + 600) - 300, r() * H, r.range(.7, 1.3)]); }
    const dx = Math.sin(rad(angle)), dy = Math.cos(rad(angle));
    return item(g, t => { for (const [l, x0, y0, k] of drops) { const y = mod(y0 + t * speed * k, H + 200) - 100; const x = x0 - y * dx; set(l, { x1: x, y1: y, x2: x - dx * len * k, y2: y - dy * len * k }); } });
  };
  E.particles = function ({ n = 60, color = '#fff', size = [2, 6], area = [0, 0, W, H], drift = [10, -30], wobble = 30, seed = 7, opacity = .8, glow = false, twinkle = 0 } = {}) {
    const r = rng(seed), g = h('g', { opacity }), ps = [];
    if (glow) g.setAttribute('filter', 'url(#glow)');
    for (let i = 0; i < n; i++) { const c = h('circle', { r: r.range(size[0], size[1]), fill: color }); g.appendChild(c); ps.push([c, r(), r(), r() * 10, r.range(.5, 1.5)]); }
    return item(g, t => {
      for (const [c, u, v, ph, k] of ps) {
        const x = area[0] + (((u * area[2] + t * drift[0] * k + noise(t * .5 + ph, 2) * wobble) % area[2]) + area[2]) % area[2];
        const y = area[1] + (((v * area[3] + t * drift[1] * k) % area[3]) + area[3]) % area[3];
        set(c, { cx: x, cy: y }); if (twinkle) c.setAttribute('opacity', 0.5 + 0.5 * Math.sin(t * twinkle * k + ph));
      }
    });
  };
  // Bokeh : lumières floues qui dérivent (premier plan hors mise au point)
  E.bokeh = function ({ n = 14, colors = ['#ffd27a', '#ff6aa8', '#7fd6ff'], area = [0, 0, W, H], size = [30, 90], seed = 21, opacity = .35, drift = [8, -6] } = {}) {
    const r = rng(seed), g = h('g', { opacity, filter: 'url(#softblur)' }), ps = [];
    for (let i = 0; i < n; i++) { const c = h('circle', { r: r.range(size[0], size[1]), fill: r.pick(colors) }); g.appendChild(c); ps.push([c, r(), r(), r() * 10, r.range(.5, 1.4)]); }
    return item(g, t => { for (const [c, u, v, ph, k] of ps) set(c, { cx: area[0] + mod(u * area[2] + t * drift[0] * k, area[2]), cy: area[1] + mod(v * area[3] + t * drift[1] * k, area[3]), opacity: .6 + .4 * Math.sin(t * .8 * k + ph) }); });
  };
  // Éclaboussures de pluie au sol (petits anneaux qui s'ouvrent)
  E.splashes = function ({ y0 = 1480, y1 = 1900, n = 26, color = '#cfe3ff', seed = 22, opacity = .6 } = {}) {
    const r = rng(seed), g = h('g', { fill: 'none', stroke: color, 'stroke-width': 2.5, opacity }), ps = [];
    for (let i = 0; i < n; i++) { const e = h('ellipse'); g.appendChild(e); ps.push([e, r() * W, r.range(y0, y1), r(), r.range(.4, .9)]); }
    return item(g, t => { for (const [e, x, y, ph, per] of ps) { const k = mod(t / per + ph, 1); set(e, { cx: x, cy: y, rx: 4 + k * 26, ry: 1 + k * 6, opacity: 1 - k }); } });
  };
  // Voile lumineux chaud qui traverse l'image lentement (light leak)
  E.lightLeak = function ({ color = '#ffb35c', opacity = .22, speed = 40, y = 500 } = {}) {
    const fill = E.gradientDef([[0, color, 0], [.5, color, 1], [1, color, 0]], false);
    const r_ = h('rect', { y: -400, width: 700, height: H + 800, fill, opacity, transform: 'rotate(18)' });
    return item(h('g', { style: 'mix-blend-mode:screen' }, [r_]), t => r_.setAttribute('x', mod(t * speed, W + 1400) - 900));
  };
  E.snow = (o = {}) => E.particles(Object.assign({ n: 120, drift: [15, 90], wobble: 40, size: [2, 7] }, o));
  E.dust = (o = {}) => E.particles(Object.assign({ n: 50, drift: [6, -12], size: [1.5, 4], opacity: .5 }, o));
  E.fireflies = (o = {}) => E.particles(Object.assign({ n: 40, color: '#ffe68a', drift: [8, -10], size: [3, 6], glow: true, twinkle: 3 }, o));
  E.rays = function ({ x = 540, y = 600, n = 14, color = '#fff', opacity = .15, len = 2200, width = 7, speed = 4 } = {}) {
    const g = h('g', { opacity });
    for (let i = 0; i < n; i++) { const a = i / n * 360; g.appendChild(h('path', { d: `M 0 0 L ${len} ${-len * Math.tan(rad(width / 2))} L ${len} ${len * Math.tan(rad(width / 2))} Z`, fill: color, transform: `rotate(${a})` })); }
    const wrap = h('g', {}, [g]);
    return item(wrap, t => g.setAttribute('transform', `translate(${x},${y}) rotate(${t * speed})`));
  };
  E.fog = function ({ y = 1300, height = 500, color = '#fff', opacity = .35, speed = 15 } = {}) {
    const fill = E.gradientDef([[0, color, 0], [.5, color, 1], [1, color, 0]]);
    const g = h('g', { opacity }), bands = [];
    for (let i = 0; i < 3; i++) { const b = h('ellipse', { rx: W * .9, ry: height / 2, fill, filter: 'url(#bigblur)' }); g.appendChild(b); bands.push([b, i]); }
    return item(g, t => { for (const [b, i] of bands) set(b, { cx: mod(i * 700 + t * speed * (1 + i * .3), W + 1400) - 700 + W / 2 - 300, cy: y + i * 40 }); });
  };
  E.tree = function ({ x = 540, y = 1500, height = 500, color = '#1a1410', seed = 8, depth = 7, sway = 2, leaves = null, leafSize = 40 } = {}) {
    const r = rng(seed), g = h('g'), branches = [];
    function br(x0, y0, len, ang, d, parent) {
      const node = h('g', { transform: `translate(${x0},${y0}) rotate(${ang})` });
      node.appendChild(h('path', { d: `M ${-len * .05 * d / depth * 1.4} 0 L 0 ${-len} L ${len * .05 * d / depth * 1.4} 0 Z`, fill: color, stroke: color, 'stroke-width': Math.max(1.5, d * 1.6), 'stroke-linejoin': 'round' }));
      parent.appendChild(node); branches.push([node, x0, y0, ang, d, r() * 10]);
      if (d > 0) {
        const k = r.int(2, 3);
        for (let i = 0; i < k; i++) br(0, -len * r.range(.7, 1), len * r.range(.62, .8), r.range(-38, 38), d - 1, node);
      } else if (leaves) {
        node.appendChild(h('circle', { cx: 0, cy: -len, r: leafSize * r.range(.6, 1.2), fill: leaves, opacity: .9 }));
      }
    }
    br(x, y, height * .32, 0, depth, g);
    return item(g, t => { for (const [n, x0, y0, a, d, ph] of branches) n.setAttribute('transform', `translate(${x0},${y0}) rotate(${a + Math.sin(t * 1.3 + ph) * sway * (1 - d / depth + .2)})`); });
  };
  E.birds = function ({ n = 7, x = 200, y = 500, dx = 60, speed = 90, color = '#111', size = 22, seed = 9 } = {}) {
    const r = rng(seed), g = h('g', { fill: 'none', stroke: color, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }), bs = [];
    for (let i = 0; i < n; i++) { const p = h('path'); g.appendChild(p); bs.push([p, (i % 2 ? 1 : -1) * Math.ceil(i / 2) * dx * .5 + r.range(-15, 15), Math.ceil(i / 2) * dx * .55 + r.range(-15, 15), r() * 6, r.range(.8, 1.2)]); }
    return item(g, t => {
      for (const [p, ox, oy, ph, k] of bs) {
        const bx = x + t * speed + ox, by = y + oy + Math.sin(t * 2 + ph) * 8, f = Math.sin(t * 9 * k + ph) * size * .6, s = size * k;
        p.setAttribute('d', `M ${bx - s} ${by - f} Q ${bx - s * .4} ${by - f * .2} ${bx} ${by} Q ${bx + s * .4} ${by - f * .2} ${bx + s} ${by - f}`);
      }
    });
  };
  E.clock = function ({ x = 540, y = 800, r = 220, face = '#f3ead2', rim = '#2b2118', hands = '#1b1410', speed = 1, numerals = true, roman = true, warp = 0, start = 0, ticking = true } = {}) {
    const g = h('g', { transform: `translate(${x},${y})` });
    g.appendChild(h('circle', { r: r * 1.08, fill: rim }));
    g.appendChild(h('circle', { r, fill: face }));
    const R = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let i = 0; i < 60; i++) {
      const a = rad(i * 6), big = i % 5 === 0, r0 = r * (big ? .84 : .9);
      g.appendChild(h('line', { x1: Math.sin(a) * r0, y1: -Math.cos(a) * r0, x2: Math.sin(a) * r * .95, y2: -Math.cos(a) * r * .95, stroke: rim, 'stroke-width': big ? r * .025 : r * .01 }));
      if (big && numerals) { const t = h('text', { x: Math.sin(a) * r * .68, y: -Math.cos(a) * r * .68 + r * .055, 'text-anchor': 'middle', 'font-size': r * .15, fill: rim, 'font-family': 'serif' }); t.textContent = roman ? R[i / 5] : (i / 5 || 12); g.appendChild(t); }
    }
    const hh = h('line', { x1: 0, y1: r * .1, x2: 0, y2: -r * .48, stroke: hands, 'stroke-width': r * .055, 'stroke-linecap': 'round' });
    const mh = h('line', { x1: 0, y1: r * .12, x2: 0, y2: -r * .75, stroke: hands, 'stroke-width': r * .035, 'stroke-linecap': 'round' });
    const sh = h('line', { x1: 0, y1: r * .18, x2: 0, y2: -r * .82, stroke: '#b3261e', 'stroke-width': r * .012 });
    g.append(hh, mh, sh, h('circle', { r: r * .045, fill: hands }));
    if (warp) g.setAttribute('filter', 'url(#wobble0)');
    return item(g, t => {
      const s = start + t * speed; const sec = ticking ? Math.floor(s) + Ease.outElastic(clamp(mod(s, 1) * 4)) : s;
      sh.setAttribute('transform', `rotate(${sec * 6})`); mh.setAttribute('transform', `rotate(${s * .1 + 90})`); hh.setAttribute('transform', `rotate(${s * .1 / 12 + 300})`);
      if (warp) g.setAttribute('filter', `url(#wobble${mod(Math.floor(t * 6), 3)})`);
    });
  };
  E.hourglass = function ({ x = 540, y = 800, s = 1, glass = '#e8f0f0', sand = '#d9a441', frame = '#3b2a1a', dur = 10 } = {}) {
    const g = h('g', { transform: `translate(${x},${y}) scale(${s})` });
    const id = nid('hg');
    defs.appendChild(h('clipPath', { id }, [h('path', { d: 'M -110 -200 L 110 -200 L 12 0 L 110 200 L -110 200 L -12 0 Z' })]));
    const top = h('rect', { x: -120, width: 240, fill: sand }), bot = h('rect', { x: -120, width: 240, fill: sand }), stream = h('rect', { x: -3, y: 0, width: 6, height: 200, fill: sand });
    g.append(h('path', { d: 'M -110 -200 L 110 -200 L 12 0 L 110 200 L -110 200 L -12 0 Z', fill: glass, opacity: .35 }), h('g', { 'clip-path': `url(#${id})` }, [top, bot, stream]),
      h('rect', { x: -140, y: -225, width: 280, height: 26, rx: 8, fill: frame }), h('rect', { x: -140, y: 200, width: 280, height: 26, rx: 8, fill: frame }),
      h('rect', { x: -130, y: -205, width: 14, height: 410, fill: frame }), h('rect', { x: 116, y: -205, width: 14, height: 410, fill: frame }));
    return item(g, t => { const k = clamp(t / dur); set(top, { y: -200 + 200 * k * .9 + 10, height: 200 * (1 - k * .9) }); set(bot, { y: 200 - 200 * k * .85, height: 200 * k * .85 }); });
  };
  E.eye = function ({ x = 540, y = 800, r = 200, iris = '#3a6e8f', white = '#f4efe6', line = '#111', blinkEvery = 3.5, look = [0, 0] } = {}) {
    const g = h('g', { transform: `translate(${x},${y})` }); const id = nid('eye');
    const lid = h('path', { fill: line });
    defs.appendChild(h('clipPath', { id }, [h('path', { id: id + 'p', d: '' })]));
    const clipP = defs.querySelector(`#${id}p`);
    const ir = h('g', { 'clip-path': `url(#${id})` }, [h('rect', { x: -r * 1.2, y: -r, width: r * 2.4, height: r * 2, fill: white })]);
    const irisG = h('g', {}, [h('circle', { r: r * .42, fill: iris }), h('circle', { r: r * .2, fill: '#000' }), h('circle', { cx: r * .1, cy: -r * .12, r: r * .07, fill: '#fff' })]);
    ir.appendChild(irisG); const outline = h('path', { fill: 'none', stroke: line, 'stroke-width': r * .06, 'stroke-linejoin': 'round' });
    g.append(ir, outline, lid);
    return item(g, t => {
      const ph = mod(t, blinkEvery) / blinkEvery, open = ph > .94 ? Math.abs(Math.cos((ph - .94) / .06 * Math.PI)) : 1;
      const o = r * .6 * open, d = `M ${-r} 0 Q 0 ${-o * 1.6} ${r} 0 Q 0 ${o * 1.6} ${-r} 0 Z`;
      clipP.setAttribute('d', d); outline.setAttribute('d', d);
      irisG.setAttribute('transform', `translate(${look[0] * r * .3 + noise(t * .7, 3) * r * .08},${look[1] * r * .2 + noise(t * .6, 9) * r * .05})`);
    });
  };
  E.spiral = function ({ x = 540, y = 800, turns = 6, r = 600, color = '#fff', width = 16, speed = 30, opacity = 1 } = {}) {
    let d = ''; for (let i = 0; i <= turns * 80; i++) { const a = i / 80 * Math.PI * 2, rr = i / (turns * 80) * r; d += (i ? ' L ' : 'M ') + (Math.cos(a) * rr).toFixed(1) + ' ' + (Math.sin(a) * rr).toFixed(1); }
    const p = h('path', { d, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', opacity });
    const g = h('g', {}, [p]);
    return item(g, t => g.setAttribute('transform', `translate(${x},${y}) rotate(${t * speed})`));
  };
  E.rings = function ({ x = 540, y = 800, n = 8, gap = 90, color = '#fff', width = 6, speed = 60, opacity = .6 } = {}) {
    const g = h('g', { fill: 'none', stroke: color, 'stroke-width': width, opacity }), cs = [];
    for (let i = 0; i < n; i++) { const c = h('circle', { cx: x, cy: y }); g.appendChild(c); cs.push(c); }
    return item(g, t => cs.forEach((c, i) => { const rr = Math.max(0, mod(i * gap + t * speed, n * gap)); set(c, { r: rr, opacity: 1 - rr / (n * gap) }); }));
  };
  // Sol en grille perspective (synthwave / rétro-futur)
  E.grid = function ({ horizon = 1100, color = '#ff2bd6', bg = null, speed = 1, lines = 22, opacity = .9 } = {}) {
    const g = h('g', { stroke: color, 'stroke-width': 3, opacity });
    if (bg) g.appendChild(h('rect', { x: -W, y: horizon, width: 3 * W, height: H, fill: bg, stroke: 'none' }));
    for (let i = -lines; i <= lines; i++) g.appendChild(h('line', { x1: W / 2 + i * 8, y1: horizon, x2: W / 2 + i * 260, y2: H + 300 }));
    const hs = []; for (let i = 0; i < 14; i++) { const l = h('line', { x1: -W, x2: 2 * W }); g.appendChild(l); hs.push(l); }
    return item(g, t => hs.forEach((l, i) => { const z = mod((i / 14) + t * speed * .2, 1), y = horizon + Math.pow(z, 2.5) * (H + 300 - horizon); set(l, { y1: y, y2: y }); }));
  };
  E.blob = function ({ x = 540, y = 800, r = 250, color = '#e33', points = 9, wobble = .18, speed = 1, seed = 11, opacity = 1 } = {}) {
    const p = h('path', { fill: color, opacity });
    return item(p, t => {
      const pts = []; for (let i = 0; i < points; i++) { const a = i / points * Math.PI * 2, rr = r * (1 + noise(t * speed + i * 1.7, seed) * wobble); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      let d = ''; for (let i = 0; i < points; i++) { const p0 = pts[i], p1 = pts[(i + 1) % points], m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]; d += (i ? ' Q ' : `M ${(pts[points - 1][0] + p0[0]) / 2} ${(pts[points - 1][1] + p0[1]) / 2} Q `) + `${p0[0]} ${p0[1]} ${m[0]} ${m[1]}`; }
      p.setAttribute('d', d + ' Z');
    });
  };
  E.lamp = function ({ x = 300, y = 1500, height = 700, color = '#111', light = '#ffe2a0', cone = .25 } = {}) {
    const fill = E.gradientDef([[0, light, .7], [1, light, 0]]);
    const coneEl = h('path', { d: `M ${x + 60} ${y - height + 20} L ${x - 160} ${y} L ${x + 300} ${y} Z`, fill, opacity: cone });
    const g = h('g', {}, [coneEl, h('rect', { x: x - 7, y: y - height, width: 14, height, fill: color }), h('path', { d: `M ${x} ${y - height} Q ${x + 10} ${y - height - 40} ${x + 60} ${y - height - 10}`, stroke: color, 'stroke-width': 12, fill: 'none' }),
      h('ellipse', { cx: x + 60, cy: y - height + 8, rx: 26, ry: 14, fill: light, filter: 'url(#glow)' })]);
    return item(g, t => coneEl.setAttribute('opacity', cone * (0.85 + 0.15 * (noise(t * 6, 4) > .7 ? 0 : 1))));
  };
  E.window = function ({ x = 340, y = 500, w = 400, h: hh = 560, frame = '#2a1f1a', glass = '#9fc3d9', bars = true } = {}) {
    const g = h('g', {}, [h('rect', { x: x - 20, y: y - 20, width: w + 40, height: hh + 40, fill: frame }), h('rect', { x, y, width: w, height: hh, fill: glass })]);
    if (bars) g.append(h('rect', { x: x + w / 2 - 8, y, width: 16, height: hh, fill: frame }), h('rect', { x, y: y + hh / 2 - 8, width: w, height: 16, fill: frame }));
    return item(g);
  };
  E.image = function (href, { x = 0, y = 0, w = W, h: hh = H, from = { s: 1, x: 0, y: 0 }, to = { s: 1.12, x: -30, y: -20 }, dur = 4, opacity = 1, preserve = 'xMidYMid slice' } = {}) {
    const img = h('image', { href, x, y, width: w, height: hh, preserveAspectRatio: preserve, opacity });
    const g = h('g', {}, [img]);
    return item(g, t => { const k = Ease.inOutSine(clamp(t / dur)); const s = lerp(from.s, to.s, k); g.setAttribute('transform', `translate(${x + w / 2 + lerp(from.x, to.x, k)},${y + hh / 2 + lerp(from.y, to.y, k)}) scale(${s}) translate(${-x - w / 2},${-y - hh / 2})`); });
  };
  // Mot / texte décoratif intégré au décor (graffiti, enseigne, affiche)
  E.label = function (txt, { x = 540, y = 800, size = 80, color = '#fff', font = null, anchor = 'middle', rotate = 0, weight = 700, opacity = 1, spacing = 0 } = {}) {
    const t = h('text', { x, y, 'font-size': size, fill: color, 'text-anchor': anchor, 'font-weight': weight, transform: `rotate(${rotate} ${x} ${y})`, opacity, 'letter-spacing': spacing, 'font-family': font || (CFG && CFG.typo && CFG.typo.font) || 'sans-serif' });
    t.textContent = txt; return item(t);
  };

  /* --- Personnage riggé ---------------------------------------------- */
  // Angles en degrés : 0 = membre vers le bas ; positif = vers l'avant (sens du regard).
  const POSES = {
    stand: { lean: 0, head: 0, ua1: 6, la1: -4, ua2: -6, la2: -4, th1: 3, sh1: 0, th2: -3, sh2: 0 },
    sad: { lean: 10, head: 28, ua1: 4, la1: 0, ua2: -2, la2: 0, th1: 2, sh1: 0, th2: -2, sh2: 0 },
    sit: { lean: -4, head: 6, ua1: 25, la1: 55, ua2: 18, la2: 50, th1: 88, sh1: -88, th2: 80, sh2: -84 },
    hug: { lean: 18, head: 30, ua1: 40, la1: 95, ua2: 35, la2: 100, th1: 95, sh1: -150, th2: 100, sh2: -150 },
    reach: { lean: -6, head: -25, ua1: 165, la1: 170, ua2: -10, la2: -5, th1: 2, sh1: 0, th2: -4, sh2: 0 },
    arms_up: { lean: -4, head: -20, ua1: 160, la1: 170, ua2: -160, la2: -170, th1: 5, sh1: 0, th2: -5, sh2: 0 },
    lookup: { lean: -8, head: -35, ua1: 4, la1: 0, ua2: -4, la2: 0, th1: 3, sh1: 0, th2: -3, sh2: 0 },
    kneel: { lean: 6, head: 22, ua1: 10, la1: 10, ua2: -5, la2: 5, th1: 85, sh1: -85, th2: -5, sh2: -90 },
    fall: { lean: 30, head: -20, ua1: 130, la1: 150, ua2: -120, la2: -140, th1: 40, sh1: -30, th2: -30, sh2: -40 },
    point: { lean: 0, head: -5, ua1: 90, la1: 90, ua2: -6, la2: -4, th1: 3, sh1: 0, th2: -3, sh2: 0 },
    think: { lean: 4, head: 12, ua1: 30, la1: 150, ua2: 10, la2: 70, th1: 3, sh1: 0, th2: -3, sh2: 0 },
  };
  E.POSES = POSES;
  E.figure = function (o = {}) {
    o = Object.assign({ x: 540, y: 1500, s: 1, color: '#111', shade: null, outline: null, outlineWidth: 6, pose: 'stand', action: 'idle', facing: 1, speed: 1, hair: null, coat: false, hat: null, path: null, seed: 1, bodyWidth: 1 }, o);
    const sh = o.shade || o.color, L = { torso: 120, neck: 20, head: 38, ua: 72, la: 66, th: 88, sh: 88 }, sw = 26 * o.bodyWidth;
    const st = (c, w) => ({ fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const root = h('g', { 'data-key': o.key || 'personnage' }), body = h('g'); root.appendChild(body);
    const ol = o.outline;
    const mk = (c, w) => { const g = h('g'); if (ol) g.appendChild(h('path', st(ol, w + o.outlineWidth * 2))); g.appendChild(h('path', st(c, w))); return g; };
    const armB = mk(sh, sw * .8), legB = mk(sh, sw), torso = h('path', { fill: o.color, stroke: ol || o.color, 'stroke-width': ol ? o.outlineWidth : 1, 'stroke-linejoin': 'round' }),
      legF = mk(o.color, sw), armF = mk(o.color, sw * .8), headG = h('g'), coatP = o.coat ? h('path', { fill: o.coat === true ? o.color : o.coat, stroke: ol || 'none', 'stroke-width': ol ? o.outlineWidth : 0 }) : null;
    headG.appendChild(h('circle', { r: L.head, fill: o.skin || o.color, stroke: ol || 'none', 'stroke-width': ol ? o.outlineWidth : 0 }));
    if (o.hair === 'short') headG.appendChild(h('path', { d: `M ${-L.head * 1.02} ${L.head * .1} Q ${-L.head * 1.1} ${-L.head * 1.15} ${L.head * .15} ${-L.head * 1.05} Q ${L.head * .9} ${-L.head * .95} ${L.head * .95} ${-L.head * .35} Q ${L.head * .3} ${-L.head * .55} ${-L.head * .35} ${-L.head * .2} Q ${-L.head * .55} ${L.head * .4} ${-L.head * 1.02} ${L.head * .1} Z`, fill: o.hairColor || '#1a1410' }));
    if (o.hair === 'long') headG.appendChild(h('path', { d: `M ${-L.head} -6 Q ${-L.head * 1.3} ${L.head * 2} ${-L.head * .2} ${L.head * 2.4} L ${L.head * .3} ${L.head * .3} Q 0 ${-L.head * 1.4} ${-L.head} -6 Z`, fill: o.hairColor || o.color }));
    if (o.hair === 'bun') headG.appendChild(h('circle', { cx: -L.head * .7, cy: -L.head * .8, r: L.head * .45, fill: o.hairColor || o.color }));
    if (o.hat === 'bowler') headG.append(h('ellipse', { cx: 0, cy: -L.head * .55, rx: L.head * 1.35, ry: L.head * .22, fill: o.hatColor || o.color }), h('path', { d: `M ${-L.head * .85} ${-L.head * .5} Q 0 ${-L.head * 2.1} ${L.head * .85} ${-L.head * .5} Z`, fill: o.hatColor || o.color }));
    if (o.hat === 'cap') headG.append(h('path', { d: `M ${-L.head} ${-L.head * .2} Q 0 ${-L.head * 1.7} ${L.head} ${-L.head * .2} Z`, fill: o.hatColor || o.color }), h('rect', { x: 0, y: -L.head * .35, width: L.head * 1.5, height: L.head * .25, rx: 6, fill: o.hatColor || o.color }));
    if (o.hat === 'hood') headG.appendChild(h('path', { d: `M ${-L.head * 1.25} ${L.head * .9} Q ${-L.head * 1.5} ${-L.head * 1.5} ${L.head * .3} ${-L.head * 1.35} Q ${L.head * 1.4} ${-L.head * 1.1} ${L.head * 1.1} ${L.head * .2} Z`, fill: o.hatColor || o.color }));
    // détails : ombre au sol, mains, chaussures, œil (clignement), mèches secondaires
    const det = o.detail !== false;
    const skin = o.skin || null;
    const shadow = det && o.shadow !== false ? h('ellipse', { cx: 0, cy: 0, rx: 70, ry: 13, fill: '#000', opacity: o.shadowOpacity ?? .28 }) : null;
    if (shadow) root.insertBefore(shadow, body);
    const handF = det ? h('circle', { r: sw * .42, fill: skin || o.color, stroke: ol || 'none', 'stroke-width': ol ? o.outlineWidth * .7 : 0 }) : null;
    const handB = det ? h('circle', { r: sw * .38, fill: skin ? mixColor(skin, '#000000', .25) : sh }) : null;
    const shoeF = det ? h('path', { fill: o.shoe || mixColor(o.color, '#000000', .45) }) : null;
    const shoeB = det ? h('path', { fill: o.shoe ? mixColor(o.shoe, '#000000', .3) : mixColor(sh, '#000000', .45) }) : null;
    const eye = det && o.face !== false ? h('ellipse', { rx: L.head * .13, ry: L.head * .16, fill: o.eyeColor || (o.skin ? '#1a1214' : ol ? ol : mixColor(o.color, '#ffffff', .75)) }) : null;
    const strands = det && o.hair === 'long' ? [0, 1, 2].map(() => h('path', { fill: 'none', stroke: o.hairColor || o.color, 'stroke-width': L.head * .28, 'stroke-linecap': 'round' })) : [];
    if (shoeB) body.appendChild(shoeB);
    body.append(armB);
    if (handB) body.appendChild(handB);
    body.append(legB);
    if (coatP) body.appendChild(coatP);
    body.append(torso, legF);
    if (shoeF) body.appendChild(shoeF);
    body.append(headG);
    strands.forEach(st_ => headG.insertBefore(st_, headG.firstChild));
    if (eye) headG.appendChild(eye);
    body.append(armF);
    if (handF) body.appendChild(handF);
    const P = (base, a, l) => [base[0] + Math.sin(rad(a)) * l, base[1] + Math.cos(rad(a)) * l];
    const setLimb = (g, pts) => { const d = `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]} L ${pts[2][0]} ${pts[2][1]}`; for (const p of g.children) p.setAttribute('d', d); };
    const r = rng(o.seed);
    const ph0 = r() * 10;
    function anglesAt(t) {
      const base = Object.assign({}, typeof o.pose === 'string' ? POSES[o.pose] : Object.assign({}, POSES.stand, o.pose));
      const a = Object.assign({}, base); let bob = 0, rot = 0; const sp = o.speed, T = t * sp + ph0;
      switch (o.action) {
        case 'walk': {
          const c = T * 5.2; a.th1 = Math.sin(c) * 26; a.th2 = -Math.sin(c) * 26; a.sh1 = -Math.max(0, Math.sin(c + 1.6)) * 38; a.sh2 = -Math.max(0, -Math.sin(c + 1.6)) * 38;
          a.ua1 = -Math.sin(c) * 22 + base.ua1 * .3; a.ua2 = Math.sin(c) * 22; a.la1 = a.ua1 + 18; a.la2 = a.ua2 + 18; bob = Math.abs(Math.cos(c)) * -7; a.lean += 4; break;
        }
        case 'run': {
          const c = T * 9; a.th1 = Math.sin(c) * 48; a.th2 = -Math.sin(c) * 48; a.sh1 = -60 - Math.sin(c + 1.5) * 40; a.sh2 = -60 + Math.sin(c + 1.5) * 40;
          a.ua1 = -Math.sin(c) * 50; a.ua2 = Math.sin(c) * 50; a.la1 = a.ua1 + 90; a.la2 = a.ua2 + 90; bob = Math.abs(Math.cos(c)) * -16; a.lean = 16; break;
        }
        case 'idle': { a.lean += Math.sin(T * 1.6) * 1.5; a.head += Math.sin(T * .9) * 3; a.ua1 += Math.sin(T * 1.6) * 3; a.ua2 -= Math.sin(T * 1.6) * 3; bob = Math.sin(T * 1.6) * 2; break; }
        case 'sway': { a.lean += Math.sin(T * 2) * 6; a.head += Math.sin(T * 2 + 1) * 8; a.ua1 += Math.sin(T * 2) * 15; a.ua2 += Math.sin(T * 2) * 15; break; }
        case 'dance': { const c = T * 6; a.ua1 = 140 + Math.sin(c) * 30; a.la1 = a.ua1 + 30; a.ua2 = -140 - Math.sin(c + 1) * 30; a.la2 = a.ua2 - 30; a.lean = Math.sin(c) * 10; a.head = Math.sin(c + .5) * 15; a.th1 = 10 + Math.sin(c) * 10; a.th2 = -10 + Math.sin(c) * 10; bob = Math.abs(Math.sin(c)) * -14; break; }
        case 'float': { rot = Math.sin(T * .6) * 14 + t * 6 * sp; a.ua1 = 70 + Math.sin(T) * 25; a.ua2 = -70 - Math.sin(T * 1.1) * 25; a.la1 = a.ua1 + 20; a.la2 = a.ua2 - 20; a.th1 = 25 + Math.sin(T * .8) * 15; a.th2 = -20 - Math.sin(T * .7) * 15; a.sh1 = -30; a.sh2 = -10; bob = Math.sin(T * 1.1) * 18; break; }
        case 'breathe': { bob = Math.sin(T * 1.2) * 3; a.lean += Math.sin(T * 1.2) * 2; break; }
        case 'tremble': { a.lean += noise(T * 14, 1) * 3; a.head += noise(T * 12, 2) * 6; a.ua1 += noise(T * 15, 3) * 6; a.ua2 += noise(T * 13, 4) * 6; break; }
        case 'reach': { const k = Ease.inOutSine(clamp((t * sp) / 2.5)); a.ua1 = lerp(base.ua1, 165, k); a.la1 = lerp(base.la1, 172, k); a.head = lerp(base.head, -30, k); a.lean = lerp(base.lean, -6, k); break; }
        case 'none': break;
      }
      if (o.anim) o.anim(a, t); // personnalisation libre
      return { a, bob, rot };
    }
    function pose(t) {
      const { a, bob, rot } = anglesAt(t);
      const hip = [0, 0];
      const neck = [Math.sin(rad(a.lean)) * L.torso, -Math.cos(rad(a.lean)) * L.torso];
      const shoulder = [neck[0] * .92, neck[1] * .92 + 6];
      const headC = [neck[0] + Math.sin(rad(a.lean + a.head * .5)) * (L.neck + L.head), neck[1] - Math.cos(rad(a.lean + a.head * .5)) * (L.neck + L.head)];
      const e1 = P(shoulder, a.ua1, L.ua), h1 = P(e1, a.la1, L.la), e2 = P(shoulder, a.ua2, L.ua), h2 = P(e2, a.la2, L.la);
      const k1 = P(hip, a.th1, L.th), f1 = P(k1, a.th1 + a.sh1, L.sh), k2 = P(hip, a.th2, L.th), f2 = P(k2, a.th2 + a.sh2, L.sh);
      setLimb(armF, [shoulder, e1, h1]); setLimb(armB, [shoulder, e2, h2]); setLimb(legF, [hip, k1, f1]); setLimb(legB, [hip, k2, f2]);
      if (handF) { set(handF, { cx: h1[0], cy: h1[1] }); set(handB, { cx: h2[0], cy: h2[1] }); }
      if (shoeF) {
        const shoe = (f, ang) => { const ca = Math.cos(rad(ang * .3)), sa = Math.sin(rad(ang * .3)); const L2 = sw * 1.6, Hh = sw * .55; return `M ${f[0] - sw * .45} ${f[1] - Hh * .4} L ${f[0] + L2 * ca} ${f[1] + L2 * sa - Hh * .2} Q ${f[0] + L2 * ca + 6} ${f[1] + L2 * sa + Hh * .5} ${f[0] + L2 * ca - 4} ${f[1] + L2 * sa + Hh * .6} L ${f[0] - sw * .55} ${f[1] + Hh * .6} Z`; };
        shoeF.setAttribute('d', shoe(f1, a.th1 + a.sh1)); shoeB.setAttribute('d', shoe(f2, a.th2 + a.sh2));
      }
      if (eye) { const ph = (t * .37 + ph0 * .1) % 1, blink = ph > .965 ? Math.abs(Math.cos((ph - .965) / .035 * Math.PI)) : 1; set(eye, { cx: L.head * .45, cy: -L.head * .08, ry: L.head * .16 * Math.max(.08, blink) }); }
      if (strands.length) strands.forEach((st_, i) => { const sway = noise(t * 1.3 + i * 2.1, ph0 + i) * 14 - (o.action === 'walk' || o.action === 'run' ? 12 : 0); const x0 = -L.head * (.55 + i * .18); st_.setAttribute('d', `M ${x0} ${-L.head * .2} Q ${x0 - 10 + sway * .4} ${L.head * 1.1} ${x0 - 6 + sway} ${L.head * (2.0 + i * .15)}`); });
      if (shadow) { set(shadow, { cy: (L.th + L.sh) - bob, rx: 70 + bob * .8, opacity: (o.shadowOpacity ?? .28) * (1 + bob / 40) }); }
      const tw = sw * .95, nx = Math.cos(rad(a.lean)), ny = Math.sin(rad(a.lean));
      torso.setAttribute('d', `M ${-tw * nx} ${-tw * ny + 4} L ${tw * nx} ${tw * ny + 4} L ${shoulder[0] + tw * 1.05 * nx} ${shoulder[1] + tw * ny} Q ${neck[0]} ${neck[1] - 14} ${shoulder[0] - tw * 1.05 * nx} ${shoulder[1] - tw * ny} Z`);
      if (coatP) { const mv = (o.action === 'walk' || o.action === 'run') ? 1 : .35, fl = noise(t * 2.2, ph0) * 10 * mv, fl2 = noise(t * 2.5, ph0 + 3) * 10 * mv; coatP.setAttribute('d', `M ${shoulder[0] - tw * 1.1} ${shoulder[1]} L ${shoulder[0] + tw * 1.1} ${shoulder[1]} L ${tw * 2.1 + fl} ${L.th * .95} Q ${0} ${L.th * 1.02 + fl2 * .5} ${-tw * 2.1 - fl2 - mv * 8} ${L.th * .95} Z`); }
      headG.setAttribute('transform', `translate(${headC[0]},${headC[1]}) rotate(${a.head * .6})`);
      let x = o.x, y = o.y;
      if (o.path) { const pp = kf(t, o.path, o.pathEase || 'linear'); x = pp[0]; y = pp[1]; }
      // le personnage a l'origine aux hanches ; o.y = position des pieds
      const footY = L.th + L.sh;
      root.setAttribute('transform', `translate(${x},${y}) scale(${o.s * o.facing},${o.s}) rotate(${rot}) translate(0,${-footY + bob})`);
    }
    return item(root, pose);
  };
  E.crowd = function ({ n = 14, y = 1600, x0 = -50, x1 = W + 50, s = .55, color = '#0d0d10', seed = 12, action = 'sway', depthRows = 2 } = {}) {
    const r = rng(seed), g = h('g'), figs = [];
    for (let row = depthRows - 1; row >= 0; row--) for (let i = 0; i < n; i++) {
      const f = E.figure({ x: lerp(x0, x1, (i + r() * .6) / n), y: y + row * 60, s: s * (1 + row * .15) * r.range(.85, 1.1), color: row ? color : mixColor(color, '#000000', .3), action: r() < .3 ? 'idle' : action, seed: r.int(1, 1e6), facing: r() < .5 ? 1 : -1, pose: r() < .2 ? 'arms_up' : 'stand', hair: r() < .3 ? 'long' : null });
      g.appendChild(f.el); figs.push(f);
    }
    return item(g, t => figs.forEach(f => f.update(t)));
  };

  /* ------------------------------------------------------------------ */
  /* Contexte de scène                                                   */
  /* ------------------------------------------------------------------ */
  function makeScene(sb, index) {
    const root = h('g', { class: 'scene', 'data-id': sb.id, style: 'display:none' });
    const inner = h('g'); root.appendChild(inner);
    world.appendChild(root);
    const S = {
      id: sb.id, index, sb, start: sb.start, end: sb.end, dur: sb.end - sb.start,
      W, H, SAFE, root, inner, defs, E, h, set, kf, Ease, ease, noise, rng: rng(sb.id), mix: mixColor, clamp, lerp, smooth,
      palette: (CFG && CFG.palette) || {}, layers: [], items: [], updaters: [],
      cam: { keys: [[0, { x: 0, y: 0, zoom: 1, rot: 0 }]], ease: 'inOutSine', shake: 0, shakeFreq: 9, handheld: 1 },
      textFollow: 0, filterBoil: null,
      layer(depth = 1, attrs) { attrs = Object.assign({}, attrs); const blur = attrs.blur; delete attrs.blur; const g = h('g', attrs); if (blur) g.setAttribute('filter', `url(#${blurFilter(blur)})`); inner.appendChild(g); const L = { g, depth, add: (...its) => { for (const it of its) { g.appendChild(it.el || it); if (it.update) S.items.push(it); } return its[0]; } }; S.layers.push(L); return L; },
      add(...its) { if (!S._default) S._default = S.layer(1); return S._default.add(...its); },
      raw(markup, depth = 1) { const it = E.raw(markup); S.layer(depth).add(it); return it; },
      // keys: [[p, {x,y,zoom,rot}], ...] avec p = progression 0..1 de la scène
      camera(keys, e, opts = {}) { S.cam.keys = keys; if (e) S.cam.ease = e; Object.assign(S.cam, opts); },
      update(fn) { S.updaters.push(fn); },
      boil(layer, kind = 'rough', fps = 8) { layer.boil = { kind, fps }; },
      beat(t, decay = 6) { return beatPulse(S.start + t, decay); },
      // marque un sujet principal pour le contrôle de cadrage ; allow : 'cut' (débord voulu), 'text', 'ui'
      key(it, name = 'objet', allow = '') { const el = it.el || it; el.setAttribute('data-key', name); if (allow) el.setAttribute('data-key-allow', allow); return it; },
    };
    return S;
  }
  const blurCache = {};
  function blurFilter(px) { const id = 'dof' + String(px).replace('.', '_'); if (!blurCache[id]) { defs.appendChild(h('filter', { id, x: '-10%', y: '-10%', width: '120%', height: '120%' }, [h('feGaussianBlur', { stdDeviation: px })])); blurCache[id] = 1; } return id; }
  function beatPulse(T, decay) { if (!beats.length) return 0; let lo = 0, hi = beats.length - 1, b = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (beats[m] <= T) { b = m; lo = m + 1; } else hi = m - 1; } if (b < 0) return 0; return Math.exp(-(T - beats[b]) * decay); }

  function applyCamera(S, t) {
    const p = t / S.dur;
    const c = kf(p, S.cam.keys, S.cam.ease);
    let sx = 0, sy = 0;
    if (S.cam.shake) { sx = noise(t * S.cam.shakeFreq, 1) * S.cam.shake; sy = noise(t * S.cam.shakeFreq, 2) * S.cam.shake; }
    if (S.cam.handheld) { sx += noise(t * .7, 11) * S.cam.handheld * 6 + noise(t * 2.3, 12) * S.cam.handheld; sy += noise(t * .6, 13) * S.cam.handheld * 5 + noise(t * 2.1, 14) * S.cam.handheld; }
    S._cam = { x: c.x + sx, y: c.y + sy, zoom: c.zoom, rot: c.rot || 0 };
    for (const L of S.layers) {
      const d = L.depth, z = 1 + (c.zoom - 1) * d;
      L.g.setAttribute('transform', `translate(${W / 2 + (c.x + sx) * d},${H / 2 + (c.y + sy) * d}) rotate(${(c.rot || 0) * d}) scale(${z}) translate(${-W / 2},${-H / 2})`);
      if (L.boil) L.g.setAttribute('filter', `url(#${L.boil.kind}${mod(Math.floor((S.start + t) * L.boil.fps), 3)})`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Transitions                                                         */
  /* ------------------------------------------------------------------ */
  function makeMask(kind, opts) {
    const id = nid('m');
    const m = h('mask', { id, maskUnits: 'userSpaceOnUse', x: -W, y: -H, width: 3 * W, height: 3 * H });
    const shapes = h('g', { fill: '#fff' });
    if (kind === 'ink') { const fid = nid('inkf'); defs.appendChild(h('filter', { id: fid, x: '-50%', y: '-50%', width: '200%', height: '200%' }, [h('feTurbulence', { type: 'fractalNoise', baseFrequency: .018, numOctaves: 3, seed: opts.seed || 4, result: 'n' }), h('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 260, xChannelSelector: 'R', yChannelSelector: 'G' })])); shapes.setAttribute('filter', `url(#${fid})`); }
    m.appendChild(h('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H, fill: '#000' }));
    m.appendChild(shapes); defs.appendChild(m);
    return { id, shapes };
  }
  const SHAPES = {
    diamond: 'M 0 -1 L 1 0 L 0 1 L -1 0 Z',
    star: (() => { let d = ''; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? .45 : 1; d += (i ? ' L ' : 'M ') + (Math.cos(a) * r).toFixed(3) + ' ' + (Math.sin(a) * r).toFixed(3); } return d + ' Z'; })(),
    hex: (() => { let d = ''; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; d += (i ? ' L ' : 'M ') + Math.cos(a).toFixed(3) + ' ' + Math.sin(a).toFixed(3); } return d + ' Z'; })(),
    heart: 'M 0 .35 C -1.2 -.4 -.6 -1.1 0 -.55 C .6 -1.1 1.2 -.4 0 .35 Z',
    triangle: 'M 0 -1 L .95 .7 L -.95 .7 Z',
    square: 'M -1 -1 L 1 -1 L 1 1 L -1 1 Z',
  };
  const DIRV = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  function prepTransition(tr) {
    const type = tr.type || 'fade';
    const st = { type, dur: tr.dur ?? .5, opts: tr };
    if (['wipe', 'iris', 'ink', 'shape', 'blinds', 'diagonal', 'bar', 'radial'].includes(type)) {
      st.mask = makeMask(type, tr);
      const s = st.mask.shapes;
      if (type === 'wipe' || type === 'diagonal' || type === 'bar') { st.el = h('rect', { x: -W, y: -H, width: 3 * W, height: 3 * H }); s.appendChild(st.el); }
      if (type === 'iris' || type === 'ink') { st.el = h('circle', { cx: tr.x ?? W / 2, cy: tr.y ?? H / 2, r: 0 }); s.appendChild(st.el); }
      if (type === 'shape') { st.el = h('path', { d: SHAPES[tr.shape || 'diamond'] || tr.shape }); s.appendChild(st.el); }
      if (type === 'radial') { st.el = h('path'); s.appendChild(st.el); }
      if (type === 'blinds') { st.els = []; const n = tr.n || 8; for (let i = 0; i < n; i++) { const r = h('rect'); s.appendChild(r); st.els.push(r); } }
    }
    if (type === 'radial' && tr.color) { st.hand = h('rect', { x: -6, y: -2 * Math.hypot(W, H), width: 12, height: 2 * Math.hypot(W, H), fill: tr.color, opacity: 0 }); overlay.insertBefore(st.hand, dipRect); }
    if (type === 'bar' || type === 'shape') { st.bar = h('path', { fill: tr.color || '#e10600', opacity: 0 }); overlay.insertBefore(st.bar, dipRect); }
    return st;
  }
  function applyTransition(st, k, outS, inS) {
    const o = st.opts, E_ = ease(o.ease || 'inOutCubic'), e = E_(k);
    const O = outS ? outS.root : null, I = inS.root;
    const show = (el, v) => el && (el.style.display = v ? '' : 'none');
    show(O, true); show(I, true);
    switch (st.type) {
      case 'cut': show(O, k < .5); show(I, k >= .5); break;
      case 'fade': I.setAttribute('opacity', e); break;
      case 'dip': case 'flash': {
        const peak = st.type === 'flash' ? .25 : .5; const a = k < peak ? k / peak : 1 - (k - peak) / (1 - peak);
        dipRect.setAttribute('fill', o.color || (st.type === 'flash' ? '#fff' : '#000')); dipRect.setAttribute('opacity', Ease.inOutSine(clamp(a)));
        show(O, k < peak); show(I, k >= peak); break;
      }
      case 'wipe': {
        const [dx, dy] = DIRV[o.dir || 'right'];
        set(st.el, dx ? { x: dx > 0 ? -3 * W + e * 3 * W - W * 0 : W + (1 - e) * 2 * W - 2 * W * 0, y: -H } : { x: -W, y: dy > 0 ? -3 * H + e * 3 * H : H - e * 3 * H + H * 0 });
        if (dx > 0) set(st.el, { x: -3 * W + e * 3 * W }); else if (dx < 0) set(st.el, { x: W - e * 2 * W }); else if (dy > 0) set(st.el, { y: -3 * H + e * 3 * H }); else set(st.el, { y: H - e * 2 * H });
        I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      case 'diagonal': {
        const a = o.angle ?? 20; const off = lerp(-2.2 * W, 0.1 * W, e);
        set(st.el, { x: off - W, y: -H, transform: `rotate(${a} ${W / 2} ${H / 2})` });
        I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      case 'iris': case 'ink': st.el.setAttribute('r', (st.type === 'ink' ? Math.pow(e, 1.6) : e) * 1.25 * Math.hypot(W, H)); I.setAttribute('mask', `url(#${st.mask.id})`); break;
      case 'shape': {
        const sc = e * Math.hypot(W, H) * 1.3, rot = (o.rotate ?? 90) * e;
        st.el.setAttribute('transform', `translate(${o.x ?? W / 2},${o.y ?? H / 2}) rotate(${rot}) scale(${sc})`);
        // contour coloré qui précède la révélation
        st.bar.setAttribute('d', SHAPES[o.shape || 'diamond'] || o.shape); st.bar.setAttribute('transform', `translate(${o.x ?? W / 2},${o.y ?? H / 2}) rotate(${rot}) scale(${sc * 1.08 + 30})`);
        st.bar.setAttribute('opacity', o.color ? (k < 1 ? 1 : 0) : 0);
        I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      case 'radial': {
        // balayage angulaire façon aiguille d'horloge, depuis midi, sens horaire (o.ccw pour l'inverse)
        const cx = o.x ?? W / 2, cy = o.y ?? H / 2, R = 2 * Math.hypot(W, H), ang = e * 360 * (o.ccw ? -1 : 1);
        let d = `M ${cx} ${cy} L ${cx} ${cy - R}`;
        const steps = Math.max(2, Math.ceil(Math.abs(ang) / 10));
        for (let i = 1; i <= steps; i++) { const a2 = rad(ang * i / steps); d += ` L ${cx + Math.sin(a2) * R} ${cy - Math.cos(a2) * R}`; }
        st.el.setAttribute('d', d + ' Z');
        if (st.hand) { st.hand.setAttribute('opacity', k > 0 && k < 1 ? 1 : 0); st.hand.setAttribute('transform', `translate(${cx},${cy}) rotate(${ang})`); }
        I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      case 'blinds': {
        const n = st.els.length, vert = (o.dir || 'vertical') === 'vertical';
        st.els.forEach((r, i) => { const kk = clamp(e * 1.6 - i / n * .6); if (vert) set(r, { x: i * W / n, y: -10, width: W / n * kk + 1, height: H + 20 }); else set(r, { x: -10, y: i * H / n, width: W + 20, height: H / n * kk + 1 }); });
        I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      case 'push': case 'slide': {
        const [dx, dy] = DIRV[o.dir || 'left'];
        if (O && st.type === 'push') O.setAttribute('transform', `translate(${dx * e * W},${dy * e * H})`);
        if (O && st.type === 'slide') O.setAttribute('opacity', 1 - e * .5);
        I.setAttribute('transform', `translate(${-dx * (1 - e) * W},${-dy * (1 - e) * H})`); break;
      }
      case 'zoom': {
        if (O) { O.setAttribute('transform', `translate(${W / 2},${H / 2}) scale(${1 + e * 1.8}) translate(${-W / 2},${-H / 2})`); O.setAttribute('opacity', 1 - smooth(.3, .9, k)); }
        I.setAttribute('transform', `translate(${W / 2},${H / 2}) scale(${.55 + .45 * e}) translate(${-W / 2},${-H / 2})`); I.setAttribute('opacity', smooth(.15, .7, k));
        if (O) world.appendChild(O); break;
      }
      case 'spin': {
        if (O) { O.setAttribute('transform', `rotate(${e * 120} ${W / 2} ${H / 2}) translate(${W / 2},${H / 2}) scale(${1 + e}) translate(${-W / 2},${-H / 2})`); O.setAttribute('opacity', 1 - e); }
        I.setAttribute('transform', `rotate(${-(1 - e) * 120} ${W / 2} ${H / 2}) translate(${W / 2},${H / 2}) scale(${.4 + .6 * e}) translate(${-W / 2},${-H / 2})`); I.setAttribute('opacity', e); break;
      }
      case 'whip': {
        const [dx] = DIRV[o.dir || 'left']; const blur = Math.sin(k * Math.PI) * 60;
        document.getElementById('whipdev').setAttribute('stdDeviation', `${blur} 0`);
        const tgt = k < .5 ? O : I;
        show(O, k < .5); show(I, k >= .5);
        if (tgt) { tgt.setAttribute('filter', 'url(#whipblur)'); tgt.setAttribute('transform', `translate(${k < .5 ? dx * Ease.inCubic(k * 2) * W * .7 : -dx * (1 - Ease.outCubic((k - .5) * 2)) * W * .7},0)`); }
        break;
      }
      case 'glitch': {
        const f = Math.floor(k * 14), r = rng(f + 77);
        const cur = k < .55 ? O : I; show(O, k < .55 || r() < .25); show(I, k >= .55 || r() < .25);
        if (cur) cur.setAttribute('transform', `translate(${(r() - .5) * 120 * Math.sin(k * Math.PI)},${(r() - .5) * 30})`);
        document.getElementById('stage').style.filter = (CFG.fx.grade || '') + ` hue-rotate(${(r() - .5) * 120 * Math.sin(k * Math.PI)}deg)`;
        st._glitch = true; break;
      }
      case 'bar': {
        // bande graphique inclinée qui traverse l'écran ; la scène suivante est révélée derrière elle
        const dir = o.dir || 'right', band = (o.width ?? .28) * W, slant = o.slant ?? 260;
        const horiz = dir === 'right' || dir === 'left', span = horiz ? W : H;
        const edge = lerp(-band - slant, span + band + slant, e);
        const pos = (dir === 'right' || dir === 'down') ? edge : span - edge;
        if (horiz) {
          const sgn = dir === 'right' ? 1 : -1;
          // masque : tout ce qui est "derrière" la bande
          const d = sgn > 0 ? `M -2000 -100 L ${pos - band / 2 + slant / 2} -100 L ${pos - band / 2 - slant / 2} ${H + 100} L -2000 ${H + 100} Z`
                            : `M 3000 -100 L ${pos + band / 2 + slant / 2} -100 L ${pos + band / 2 - slant / 2} ${H + 100} L 3000 ${H + 100} Z`;
          st.mask.shapes.innerHTML = `<path d="${d}" fill="#fff"/>`;
          st.bar.setAttribute('d', `M ${pos - band / 2 + slant / 2} -100 L ${pos + band / 2 + slant / 2} -100 L ${pos + band / 2 - slant / 2} ${H + 100} L ${pos - band / 2 - slant / 2} ${H + 100} Z`);
        } else {
          const sgn = dir === 'down' ? 1 : -1;
          const d = sgn > 0 ? `M -100 -3000 L ${W + 100} -3000 L ${W + 100} ${pos - band / 2 - slant / 2} L -100 ${pos - band / 2 + slant / 2} Z`
                            : `M -100 4000 L ${W + 100} 4000 L ${W + 100} ${pos + band / 2 - slant / 2} L -100 ${pos + band / 2 + slant / 2} Z`;
          st.mask.shapes.innerHTML = `<path d="${d}" fill="#fff"/>`;
          st.bar.setAttribute('d', `M -100 ${pos - band / 2 + slant / 2} L ${W + 100} ${pos - band / 2 - slant / 2} L ${W + 100} ${pos + band / 2 - slant / 2} L -100 ${pos + band / 2 + slant / 2} Z`);
        }
        st.bar.setAttribute('opacity', 1); I.setAttribute('mask', `url(#${st.mask.id})`); break;
      }
      default: I.setAttribute('opacity', e);
    }
  }
  function resetScene(S) {
    const r = S.root; r.removeAttribute('opacity'); r.removeAttribute('transform'); r.removeAttribute('mask'); r.removeAttribute('filter');
  }

  /* ------------------------------------------------------------------ */
  /* Typographie cinétique                                               */
  /* ------------------------------------------------------------------ */
  const POS = { top: 330, upper: 560, center: 860, middle: 860, lower: 1150, bottom: 1330 };
  function vowelsCount(w) { const m = w.toLowerCase().match(/[aeiouyàâäéèêëîïôöùûüœæ]+/g); return Math.max(1, m ? m.length : 1); }
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9']/g, '');

  function buildChunk(ch, sbScene, sceneIdx) {
    const ty = Object.assign({}, CFG.typo, sbScene.typo || {}, ch.typo || {});
    const div = document.createElement('div'); div.className = 'chunk';
    const box = document.createElement('div'); box.className = 'box'; div.appendChild(box);
    const upper = ty.case !== 'none' && ty.case !== 'lower';
    const lines = (ch.text.includes('/') ? ch.text.split('/') : [ch.text]).map(s => s.trim()).filter(Boolean);
    const redTargets = [].concat(ch.red || []).map(norm);
    const words = [];
    Object.assign(box.style, {
      fontFamily: `'${ty.font}', sans-serif`, color: ty.color, fontWeight: ty.weight || 400, textAlign: ch.align || ty.align || 'center',
      lineHeight: ty.lineHeight || 1.0, letterSpacing: (ty.spacing || 0) + 'em', fontStyle: ty.italic ? 'italic' : 'normal',
      textTransform: ty.case === 'lower' ? 'lowercase' : upper ? 'uppercase' : 'none',
    });
    if (ty.shadow) box.style.textShadow = ty.shadow;
    if (ty.stroke) box.style.webkitTextStroke = ty.stroke;
    let redFound = false;
    lines.forEach((ln, li) => {
      const L = document.createElement('div'); L.className = 'line'; box.appendChild(L);
      const toks = [];
      ln.split(/\s+/).forEach(tok => {
        // élision (l'sommeil, qu'l'argent) : seul le mot plein peut passer en rouge
        const m = tok.match(/^(.*['’])([^'’]+)$/);
        if (m && !redFound && redTargets.includes(norm(m[2])) && !redTargets.includes(norm(tok))) toks.push([m[1], true], [m[2], false]);
        else toks.push([tok, false]);
      });
      toks.forEach(([wtxt, glued], wi) => {
        const w = document.createElement('span'); w.className = 'word';
        const isRed = !glued && !redFound && redTargets.length && redTargets.includes(norm(wtxt));
        if (isRed) { w.classList.add('red'); w.style.color = ty.red || '#e10600'; w.style.fontSize = (ty.redScale || 1.25) + 'em'; if (ty.redFont) w.style.fontFamily = `'${ty.redFont}'`; if (ty.redShadow) w.style.textShadow = ty.redShadow; if (ty.redStroke) w.style.webkitTextStroke = ty.redStroke; }
        if (ty.box) { w.style.background = ty.box; w.style.padding = '0.02em 0.18em'; w.style.margin = '0.04em'; if (isRed && ty.redBox) { w.style.background = ty.redBox; w.style.color = ty.redOnBox || '#fff'; } }
        const chars = [];
        if ((ch.enter || ty.enter) === 'type' || (ch.enter || ty.enter) === 'split' || (isRed && (ch.emphasis || ty.emphasis) === 'scramble')) {
          for (const c of wtxt) { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; w.appendChild(s); chars.push(s); }
        } else w.textContent = wtxt;
        L.appendChild(w); if (!glued) L.appendChild(document.createTextNode(' '));
        words.push({ el: w, txt: wtxt, red: isRed, line: li, chars, syl: vowelsCount(wtxt) });
        if (isRed) redFound = true;
      });
    });
    if (redTargets.length && !redFound) console.warn('RED_WORD_NOT_FOUND', sbScene.id, ch.red, ch.text);
    lyricsDiv.appendChild(div);
    // Mise en page : taille auto-ajustée dans la zone de sécurité
    const maxW = ch.width || ty.width || (SAFE.right - SAFE.left);
    let size = ch.size || ty.size || 128;
    box.style.fontSize = size + 'px'; box.style.width = maxW + 'px';
    box.style.whiteSpace = 'nowrap';
    let widest = Math.max(...[...box.children].map(l => l.scrollWidth));
    if (widest > maxW) { size = Math.floor(size * maxW / widest * .98); box.style.fontSize = size + 'px'; }
    const maxH = ch.maxHeight || ty.maxHeight || 760;
    if (box.scrollHeight > maxH) { size = Math.floor(size * maxH / box.scrollHeight); box.style.fontSize = size + 'px'; }
    const align = ch.align || ty.align || 'center';
    let x = SAFE.left, y;
    const pos = ch.pos || ty.pos || 'center';
    if (Array.isArray(pos)) { x = pos[0]; y = pos[1]; } else y = POS[pos] ?? 860;
    const bh = box.offsetHeight;
    // recalage automatique dans la zone de sécurité TikTok (marge pour l'agrandissement du mot rouge)
    let top = y - bh / 2; const m = size * .18;
    if (!ch.free) top = Math.min(Math.max(top, SAFE.top + m), SAFE.bottom - bh - m);
    div.style.left = x + 'px'; div.style.top = top + 'px';
    div.style.width = maxW + 'px';
    div.dataset.align = align;
    // Timing des mots : proportionnel aux syllabes, sur la fenêtre de chant
    const s0 = ch.start, s1 = ch.end;
    const singDur = ch.sing ?? Math.min((s1 - s0) * .85, words.reduce((a, w) => a + w.syl, 0) * (ch.sylDur || ty.sylDur || .2) + .15);
    let acc = 0; const tot = words.reduce((a, w) => a + w.syl, 0);
    words.forEach((w, i) => { w.t = ch.words && ch.words[i] != null ? ch.words[i] : s0 + singDur * (acc / tot); acc += w.syl; });
    return { div, box, words, ch, ty, size, sceneIdx, rot: ch.rotate ?? ty.rotate ?? 0, enter: ch.enter || ty.enter || 'rise', emphasis: ch.emphasis || ty.emphasis || 'grow', exit: ch.exit || ty.exit || 'fade', follow: ch.follow ?? ty.follow ?? 0.0 };
  }

  function wordState(C, w, t, idx) {
    const u = t - w.t; let o = 1, x = 0, y = 0, s = 1, r = 0, blur = 0, clip = null;
    const D = C.ty.wordIn || .28;
    const k = clamp(u / D);
    switch (C.enter) {
      case 'pop': o = clamp(u / .08); s = u < 0 ? .4 : lerp(.4, 1, Ease.outBack(k)); break;
      case 'rise': o = Ease.outQuad(k); y = (1 - Ease.outCubic(k)) * 70; break;
      case 'drop': o = clamp(u / .1); y = -(1 - Ease.outBack(k)) * 90; break;
      case 'slide': { const dir = w.line % 2 ? 1 : -1; o = Ease.outQuad(k); x = dir * (1 - Ease.outExpo(k)) * 220; break; }
      case 'blur': o = Ease.outQuad(k); blur = (1 - k) * 22; s = lerp(1.15, 1, Ease.outCubic(k)); break;
      case 'stamp': o = clamp(u / .05); s = lerp(2.4, 1, Ease.outExpo(clamp(u / .22))); r = (1 - clamp(u / .22)) * (idx % 2 ? 6 : -6); break;
      case 'type': o = u >= 0 ? 1 : 0; break;
      case 'split': o = clamp(u / .15); break;
      case 'mask': o = u >= 0 ? 1 : 0; clip = 100 - Ease.outCubic(k) * 100; break;
      case 'drift': o = Ease.inOutSine(clamp(u / .6)); x = (1 - Ease.outCubic(clamp(u / 1.2))) * 40; break;
      case 'line': default: o = Ease.outQuad(k); y = (1 - Ease.outCubic(k)) * 40;
    }
    return { o, x, y, s, r, blur, clip, u };
  }

  function renderChunk(C, t, S) {
    const ch = C.ch;
    const pre = C.ty.preroll ?? .12;
    const visible = t >= ch.start - pre - .3 && t <= ch.end + .02;
    C.div.style.display = visible ? '' : 'none';
    if (!visible) return;
    // sortie
    const exitD = ch.exitDur ?? C.ty.exitDur ?? .22, ek = clamp((t - (ch.end - exitD)) / exitD);
    let go = 1, gx = 0, gy = 0, gs = 1, gb = 0;
    switch (C.exit) {
      case 'fade': go = 1 - ek; break;
      case 'up': go = 1 - ek; gy = -Ease.inCubic(ek) * 80; break;
      case 'down': go = 1 - ek; gy = Ease.inCubic(ek) * 80; break;
      case 'blur': go = 1 - ek; gb = ek * 20; break;
      case 'zoom': go = 1 - ek; gs = 1 + Ease.inCubic(ek) * .5; break;
      case 'shrink': go = 1 - ek; gs = 1 - Ease.inCubic(ek) * .4; break;
      case 'none': break;
    }
    const cam = S && S._cam ? S._cam : { x: 0, y: 0 };
    const fl = C.follow;
    const drift = C.ty.drift ?? 0; // dérive lente globale (px/s)
    const lt = t - ch.start;
    C.div.style.opacity = go;
    C.div.style.transform = `translate(${gx + cam.x * fl + drift * lt * (C.ty.driftX ?? 0)}px,${gy + cam.y * fl - drift * lt * (C.ty.driftY ?? 1)}px) rotate(${C.rot}deg) scale(${gs})`;
    C.div.style.filter = gb ? `blur(${gb}px)` : '';
    C.words.forEach((w, i) => {
      let st = wordState(C, w, t, i);
      let extra = '';
      if (w.red) {
        const em = C.emphasis; const u = t - w.t;
        switch (em) {
          case 'grow': st.s *= 1 + Ease.outCubic(clamp(u / Math.max(.6, ch.end - w.t))) * .18; break;
          case 'late': { const d = C.ty.lateDelay ?? .3; const uu = u - d; st = wordState(C, Object.assign({}, w, { t: w.t + d }), t, i); st.s *= uu < 0 ? 1 : lerp(1.6, 1, Ease.outBack(clamp(uu / .35))); break; }
          case 'shake': st.x += noise(t * 30, 1) * 4; st.y += noise(t * 30, 2) * 4; st.r += noise(t * 20, 3) * 1.5; break;
          case 'pulse': st.s *= 1 + (S ? S.beat(t - S.start, 7) : 0) * .12 + Math.max(0, Math.sin(u * 7)) * (beats.length ? 0 : .05); break;
          case 'slidein': { const k = Ease.outExpo(clamp((u) / .5)); st.x += (1 - k) * 600; st.o = Math.min(st.o, k * 3); break; }
          case 'drop': { const k = Ease.outBack(clamp(u / .45)); st.y += -(1 - k) * 400; st.o = clamp(u / .1); break; }
          case 'reveal': st.clip = 100 - Ease.inOutCubic(clamp(u / .55)) * 100; break;
          case 'glow': extra = `drop-shadow(0 0 ${8 + 22 * Ease.outCubic(clamp(u / .8))}px ${C.ty.red || '#e10600'})`; break;
          case 'scramble': {
            const GL = '#%&@$*!?<>/\\'; const done = clamp(u / .5);
            w.chars.forEach((c, j) => { const n = j / w.chars.length; c.textContent = done >= n ? w.txt[j] : GL[Math.floor((t * 30 + j * 7)) % GL.length]; });
            break;
          }
          case 'breathe': st.s *= 1 + Math.sin(u * 3) * .04; break;
          case 'shrink': st.s *= 1 - Ease.inOutSine(clamp((u - .3) / Math.max(.8, ch.end - w.t - .4))) * .35; break;
          case 'none': break;
        }
        if (C.ty.redTilt) st.r += C.ty.redTilt;
      }
      // apparition caractère par caractère
      if (w.chars.length && (C.enter === 'type' || C.enter === 'split')) {
        const per = C.enter === 'type' ? .04 : .03;
        w.chars.forEach((c, j) => {
          const uu = st.u - j * per;
          if (C.enter === 'type') c.style.opacity = uu >= 0 ? 1 : 0;
          else { const k = Ease.outCubic(clamp(uu / .3)); c.style.opacity = k; c.style.display = 'inline-block'; c.style.transform = `translate(${(1 - k) * (j % 2 ? 30 : -30)}px,${(1 - k) * (j % 3 - 1) * 40}px)`; }
        });
      }
      const el = w.el;
      el.style.opacity = st.o;
      el.style.transform = `translate(${st.x}px,${st.y}px) scale(${st.s}) rotate(${st.r}deg)`;
      el.style.filter = (st.blur ? `blur(${st.blur}px)` : '') + extra;
      el.style.clipPath = st.clip != null ? `inset(0 ${st.clip}% 0 0)` : '';
    });
  }

  /* ------------------------------------------------------------------ */
  /* Scène image HD (générée) : mouvement de caméra lent + atmosphère    */
  /* storyboard.scenes[] : image, motion (push|pull|left|right|rise|fall),*/
  /* overlay ([rain|dust|snow|fireflies|fog|sparks]), overlayColor        */
  /* ------------------------------------------------------------------ */
  const MOTIONS = {
    push: [{ s: 1.0, x: 0, y: 0 }, { s: 1.13, x: 0, y: -24 }], pull: [{ s: 1.14, x: 0, y: -10 }, { s: 1.0, x: 0, y: 0 }],
    left: [{ s: 1.1, x: 46, y: 0 }, { s: 1.1, x: -46, y: 0 }], right: [{ s: 1.1, x: -46, y: 0 }, { s: 1.1, x: 46, y: 0 }],
    rise: [{ s: 1.1, x: 0, y: 60 }, { s: 1.1, x: 0, y: -60 }], fall: [{ s: 1.1, x: 0, y: -60 }, { s: 1.1, x: 0, y: 60 }],
  };
  function imageScene(S) {
    const sb = S.sb, m = MOTIONS[sb.motion] || MOTIONS[Object.keys(MOTIONS)[S.index % 6]];
    S.layer(1).add(E.image(sb.image, { x: -36, y: -64, w: 1152, h: 2048, from: m[0], to: m[1], dur: S.dur + .9 }));
    const col = sb.overlayColor || '#ffffff';
    for (const o of [].concat(sb.overlay || [])) {
      if (o === 'rain') S.layer(1).add(E.rain({ n: 180, angle: 10, color: col, opacity: .35, seed: S.index + 1 }));
      if (o === 'snow') S.layer(1).add(E.snow({ color: col, opacity: .8, seed: S.index + 1 }));
      if (o === 'dust') S.layer(1).add(E.dust({ color: col, n: 70, opacity: .55, seed: S.index + 1 }));
      if (o === 'fireflies' || o === 'sparks') S.layer(1).add(E.fireflies({ color: o === 'sparks' ? (sb.overlayColor || '#ffcf6a') : col, n: 45, seed: S.index + 1 }));
      if (o === 'fog') S.layer(1).add(E.fog({ y: 1400, color: col, opacity: .25 }));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Assemblage                                                          */
  /* ------------------------------------------------------------------ */
  let chunks = [];
  function load(storyboard) {
    SB = storyboard;
    CFG = Object.assign({ typo: {}, fx: {}, palette: {} }, storyboard.style || {});
    CFG.typo = Object.assign({ font: 'Anton', color: '#ffffff', red: '#e10600', size: 130, enter: 'rise', emphasis: 'grow', exit: 'fade', lineHeight: 1.0 }, CFG.typo);
    beats = (storyboard.beats || []).slice().sort((a, b) => a - b);
    initDOM();
    buildFX(CFG.fx);
    if (CFG.background) document.body.style.background = CFG.background;
    built = SB.scenes.map((sb, i) => {
      const S = makeScene(sb, i);
      const b = sceneBuilders[sb.id] || (sb.image ? imageScene : null);
      if (!b) throw new Error('Scene builder missing: ' + sb.id);
      b(S);
      if (S._default && S.layers.indexOf(S._default) < 0) S.layers.push(S._default);
      S.trans = prepTransition(Object.assign({ type: i === 0 ? 'cut' : 'fade', dur: .5 }, sb.transition || {}));
      if (i === 0 && !(sb.transition && sb.transition.type)) S.trans.dur = 0;
      return S;
    });
    chunks = [];
    SB.scenes.forEach((sb, i) => (sb.lyrics || []).forEach(ch => chunks.push(buildChunk(ch, sb, i))));
    if (window.CLIP_AFTER_LOAD) window.CLIP_AFTER_LOAD();
  }

  // Fenêtre de transition autour d'une frontière : align = 'center' | 'before' | 'after'
  function transWindow(S) {
    const d = S.trans.dur, al = S.trans.opts.align || 'center';
    const a = al === 'before' ? S.start - d : al === 'after' ? S.start : S.start - d / 2;
    return [a, a + d];
  }

  function renderAt(T) {
    currentT = T;
    updateGrain(T);
    dipRect.setAttribute('opacity', 0);
    for (const S of built) { if (S.trans.bar) S.trans.bar.setAttribute('opacity', 0); if (S.trans.hand) S.trans.hand.setAttribute('opacity', 0); }
    document.getElementById('stage').style.filter = CFG.fx.grade || '';
    document.getElementById('whipdev').setAttribute('stdDeviation', '0 0');
    const N = built.length;
    const vis = new Array(N).fill(false);
    let activeTrans = null;
    for (let i = 0; i < N; i++) {
      const S = built[i];
      const [a, b] = transWindow(S);
      const next = built[i + 1];
      const endB = next ? transWindow(next)[1] : Infinity;
      const startA = i === 0 ? -Infinity : a;
      if (T >= startA && T < endB) vis[i] = true;
      if (i > 0 && T >= a && T < b && S.trans.dur > 0) activeTrans = i;
    }
    for (let i = 0; i < N; i++) {
      const S = built[i]; resetScene(S);
      S.root.style.display = vis[i] ? '' : 'none';
      if (!vis[i]) continue;
      const t = T - S.start;
      applyCamera(S, t);
      for (const it of S.items) it.update(t, t / S.dur);
      for (const fn of S.updaters) fn(t, t / S.dur, S);
    }
    // ordre d'empilement : scène entrante au-dessus
    if (activeTrans != null) {
      const S = built[activeTrans], P = built[activeTrans - 1];
      world.appendChild(S.root);
      const [a, b] = transWindow(S);
      applyTransition(S.trans, clamp((T - a) / (b - a)), P, S);
    } else {
      for (let i = 0; i < N; i++) if (vis[i]) world.appendChild(built[i].root);
    }
    // texte
    for (const C of chunks) renderChunk(C, T, built[C.sceneIdx]);
    // fondu de sortie global (optionnel)
    if (SB.outro && SB.outro.dur) {
      const D = SB.passage.duration, k = clamp((T - (D - SB.outro.dur)) / SB.outro.dur);
      if (k > 0) { dipRect.setAttribute('fill', SB.outro.color || '#000'); dipRect.setAttribute('opacity', Math.max(+dipRect.getAttribute('opacity'), Ease.inOutSine(k) * (SB.outro.max ?? 1))); lyricsDiv.style.opacity = 1 - (SB.outro.text ? Ease.inOutSine(k) : 0); }
      else lyricsDiv.style.opacity = 1;
    }
  }

  function textRects() {
    return chunks.map(C => {
      const prev = C.div.style.display; C.div.style.display = '';
      const r = C.box.getBoundingClientRect(); const reds = C.words.filter(w => w.red).map(w => w.txt);
      C.div.style.display = prev;
      return { scene: SB.scenes[C.sceneIdx].id, text: C.ch.text, start: C.ch.start, end: C.ch.end, red: reds, fontSize: C.size, x: r.left, y: r.top, w: r.width, h: r.height };
    });
  }

  function framingAt(T) {
    renderAt(T);
    const out = [];
    const texts = chunks.filter(C => C.div.style.display !== 'none' && +C.div.style.opacity > .5).map(C => C.box.getBoundingClientRect());
    built.forEach(S => {
      if (S.root.style.display === 'none') return;
      const t = T - S.start; if (t < 0 || t > S.dur) return;
      S.root.querySelectorAll('[data-key]').forEach(el => {
        let op = 1, n = el; while (n && n !== S.root) { const o = n.getAttribute && n.getAttribute('opacity'); if (o != null) op *= +o; if (n.style && n.style.display === 'none') op = 0; n = n.parentNode; }
        if (op < .2) return;
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        out.push({ scene: S.id, t: +t.toFixed(2), key: el.getAttribute('data-key'), allow: el.getAttribute('data-key-allow') || '',
          x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
          text: texts.map(q => ({ x: q.left, y: q.top, w: q.width, h: q.height })) });
      });
    });
    return out;
  }

  window.CLIP = {
    mod, W, H, SAFE, E, Ease, kf, noise, rng, h, set, mixColor, clamp, lerp, smooth,
    scene(id, builder) { sceneBuilders[id] = builder; },
    load, renderAt, textRects, framingAt,
    duration: () => SB ? SB.passage.duration : 0,
  };
})();
