/* HFS.kt — KineticText / FallingText / ImpactText / MorphingText
 * Typographie cinétique : chaque mot ou lettre est une « unité » animée par 3 couches composées :
 *   in   (apparition, à partir de l'instant où le mot est chanté)
 *   emph (mise en valeur du mot important, calée sur un impact musical : kick, snare…)
 *   out  (sortie physique)
 * Toutes les couches sont des fonctions pures de (u = temps écoulé, unité, contexte) → transform.
 * Physique crédible : chute avec gravité, rebonds amortis, écrasement au contact, projections balistiques.
 *
 * const k = HFS.kt.mount(el, { text: "LES MAINS / DANS LA MERDE", words: [...], important: 'MERDE', impact: 1.2,
 *                               preset: 'heavySentence', intensity: 1, speed: 1, outAt: 2.4, ground: 1300 });
 * sc.update(t => k.render(t));
 */
(function () {
  const HFS = window.HFS, { clamp, lerp, hash, noise } = HFS.m, Ez = HFS.ease, P = HFS.phys;
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9']/g, '');
  const W = 1080, H = 1920;

  // ------------------------------------------------------------------ couches « in »
  const IN = {
    none: () => ({}),
    fade: (u, U, c) => ({ o: clamp(u / (.25 / c.V)) }),
    blurIn: (u, U, c) => { const k = clamp(u / (.2 / c.V)); return { o: k, blur: (1 - k) * 14 * c.I }; },
    growTiny: (u, U, c) => { const k = Ez.outExpo(clamp(u / (.55 / c.V))); return { o: clamp(u / .06), s: lerp(.02, 1, k) }; },          // minuscule → normal
    growBrutal: (u, U, c) => { const k = clamp(u / (.16 / c.V)); return { o: u >= 0 ? 1 : 0, s: k < 1 ? lerp(.05, 1.35 * c.I, Ez.outCubic(k)) : 1 + (.35 * c.I) * Math.exp(-(u - .16) * 9) * Math.cos((u - .16) * 22) }; },
    flyAcross: (u, U, c) => { const k = Ez.outExpo(clamp(u / (.7 / c.V))), d = U.i % 2 ? 1 : -1; return { o: clamp(u / .08), x: d * (1 - k) * 1300, s: lerp(.25, 1, k), blur: (1 - k) * 10 }; }, // traverse en prenant de l'ampleur
    towardCamera: (u, U, c) => { const k = clamp(u / (.45 / c.V)); return { o: clamp(u / .08), s: k < 1 ? lerp(.04, 1.6 * c.I, Ez.inExpo(k)) : lerp(1.6 * c.I, 1, Ez.outCubic(clamp((u - .45 / c.V) / .25))), blur: (1 - k) * 6 }; }, // arrive de loin et fonce vers la caméra
    fromFar: (u, U, c) => { const k = Ez.outCubic(clamp(u / (.6 / c.V))); return { o: k, s: lerp(.1, 1, k), y: (1 - k) * -120, rx: (1 - k) * 50 }; },
    dropBounce: (u, U, c) => { const d = P.drop(u, U.dropH, 6500 * c.V * c.V, .45 * c.I); const q = P.squash(d.impact, d.n); return { o: u >= -.4 ? 1 : 0, y: d.y, sy: 1 - q * .35 * c.I, sx: 1 + q * .3 * c.I }; },
    letterFall: (u, U, c) => { const d = P.drop(u, U.dropH * (1 + hash(U.i, 3) * .5), 7000, .38 + hash(U.i, 4) * .15); const q = P.squash(d.impact, d.n); return { o: u >= -.6 ? 1 : 0, y: d.y, r: d.n === 0 ? (hash(U.i, 5) - .5) * 70 * (d.y / -U.dropH) : (hash(U.i, 6) - .5) * 14 * Math.exp(-d.impact * 3) , sy: 1 - q * .4, sx: 1 + q * .35 }; },
    heavyDrop: (u, U, c) => { const d = P.drop(u, U.dropH, 9000, .18); const q = P.squash(d.impact, d.n, .2); return { o: u >= -.4 ? 1 : 0, y: d.y, sy: 1 - q * .5 * c.I, sx: 1 + q * .4 * c.I, shake: d.n >= 1 && d.impact < .25 && d.impact >= 0 ? (1 - d.impact / .25) * 22 * c.I : 0 }; }, // une phrase qui tombe comme un objet lourd
    splat: (u, U, c) => { const d = P.drop(u, U.dropH, 8000, 0); const k = d.n ? clamp(d.impact / .5) : 0; const flat = d.n ? (k < .15 ? k / .15 : 1 - Ez.outElastic((k - .15) / .85, 1, .5)) : 0; return { o: u >= -.4 ? 1 : 0, y: d.y, sy: 1 - flat * .7 * c.I, sx: 1 + flat * .9 * c.I }; }, // s'écrase au sol
    roll: (u, U, c) => { const k = Ez.outCubic(clamp(u / (.8 / c.V))), d = U.i % 2 ? 1 : -1, dist = (1 - k) * 900; return { o: clamp(u / .1), x: d * dist, r: d * dist / (U.h * .5) * 57.3 }; }, // roule jusqu'à sa place
    tumble: (u, U, c) => { const k = clamp(u / (.5 / c.V)); return { o: clamp(u / .05), r: (1 - Ez.outBack(k, 2)) * -95, y: (1 - Ez.outCubic(k)) * -60, ox: 'left bottom' }; }, // bascule
    slideStop: (u, U, c) => { const k = clamp(u / (.5 / c.V)); const s = U.i % 2 ? 1 : -1; return { o: clamp(u / .06), x: s * (1 - Ez.outBack(k, 2.6)) * 700, sk: s * (1 - Ez.outCubic(k)) * -25 }; }, // glisse et freine
    stackDrop: (u, U, c) => { const d = P.drop(u, U.dropH + U.stackY, 7000, .3); const q = P.squash(d.impact, d.n); return { o: u >= -.5 ? 1 : 0, y: d.y, sy: 1 - q * .3, sx: 1 + q * .25, r: d.n ? (hash(U.i, 9) - .5) * 6 : 0 }; }, // les mots s'empilent
    stretchX: (u, U, c) => { const k = clamp(u / (.45 / c.V)); return { o: clamp(u / .05), sx: 1 + (1 - Ez.outElastic(k)) * 2.2 * c.I, sy: 1 - (1 - Ez.outElastic(k)) * .6 }; },
    stretchY: (u, U, c) => { const k = clamp(u / (.45 / c.V)); return { o: clamp(u / .05), sy: 1 + (1 - Ez.outElastic(k)) * 2.6 * c.I, sx: 1 - (1 - Ez.outElastic(k)) * .55, oy: 'bottom' }; },
    squashStretch: (u, U, c) => { const k = clamp(u / (.6 / c.V)); const w = Math.sin(k * Math.PI * 3) * (1 - k); return { o: clamp(u / .05), sy: 1 + w * .7 * c.I, sx: 1 - w * .45 * c.I, y: -Math.abs(Math.sin(k * Math.PI * 1.5)) * (1 - k) * 160 }; },
    rotateIn: (u, U, c) => { const k = clamp(u / (.5 / c.V)); return { o: clamp(u / .1), r: (1 - Ez.outBack(k, 1.8)) * (U.i % 2 ? 180 : -180), s: lerp(.3, 1, Ez.outCubic(k)) }; },
    skewIn: (u, U, c) => { const k = clamp(u / (.4 / c.V)); return { o: clamp(u / .08), sk: (1 - Ez.outElastic(k, 1, .5)) * -45 * c.I, x: (1 - Ez.outExpo(k)) * 300 }; },
    compress: (u, U, c) => { const k = clamp(u / (.35 / c.V)); return { o: clamp(u / .05), sx: lerp(.05, 1, Ez.outBack(k, 2.2)), sy: lerp(2.2, 1, Ez.outCubic(k)) }; },
    elastic: (u, U, c) => ({ o: clamp(u / .05), s: Ez.outElastic(clamp(u / (.9 / c.V)), 1, .3) }),
    typewriter: (u) => ({ o: u >= 0 ? 1 : 0 }),
    pop: (u, U, c) => { const k = clamp(u / (.3 / c.V)); return { o: clamp(u / .05), s: u < 0 ? .3 : lerp(.3, 1, Ez.outBack(k, 2.4)) }; },
    rebuild: (u, U, c) => { const k = Ez.outCubic(clamp(u / (.55 / c.V))), a = hash(U.i, 11) * 6.283, R = 500 + hash(U.i, 12) * 600; return { o: clamp(u / .1), x: Math.cos(a) * R * (1 - k), y: Math.sin(a) * R * (1 - k), r: (1 - k) * (hash(U.i, 13) - .5) * 540, s: lerp(.3, 1, k) }; }, // reconstruction
    maskReveal: (u, U, c) => { const k = Ez.inOutCubic(clamp(u / (.4 / c.V))); return { clip: (1 - k) * 100, y: (1 - k) * 30 }; },
    sideIn: (u, U, c) => { const k = Ez.outExpo(clamp(u / (.45 / c.V))); return { o: clamp(u / .06), x: (U.line % 2 ? 1 : -1) * (1 - k) * 1100 }; },
    crossScreen: (u, U, c) => { const T = .9 / c.V, k = clamp(u / T); const x = k < .6 ? lerp(-1300, 160, Ez.outCubic(k / .6)) : lerp(160, 0, Ez.inOut((k - .6) / .4)); return { o: clamp(u / .06), x, blur: k < .5 ? 8 : 0 }; },
    burst: (u, U, c) => { const k = clamp(u / .25); return { o: k, s: lerp(1.6, 1, Ez.outBack(k)), spark: u >= 0 && u < .5 ? u / .5 : -1 }; }, // apparaît dans une explosion de particules
    materialize3D: (u, U, c) => { const k = Ez.outCubic(clamp(u / (.6 / c.V))); return { o: clamp(u / .15), rx: (1 - k) * 88, z: (1 - k) * -600, depth: k }; },
    slotRoll: (u, U, c) => ({ o: u >= 0 ? 1 : 0, slot: clamp(u / (.45 / c.V)) }), // les lettres défilent comme une machine à sous
    behind: (u, U, c) => { const k = Ez.outCubic(clamp(u / (.5 / c.V))); return { o: clamp(u / .1), y: (1 - k) * 260 }; }, // surgit de derrière (le personnage est placé devant dans la scène)
  };
  // ------------------------------------------------------------------ couches « emph » (ui = temps depuis l'impact)
  const EMPH = {
    none: () => ({}),
    giant: (ui, U, c) => { if (ui < 0) return {}; const f = Math.min(9, (W * .92) / Math.max(40, U.w)); const k1 = clamp(ui / .12), k2 = clamp((ui - .55) / .35); const s = lerp(1, f, Ez.outExpo(k1)) * (1 - Ez.inOutCubic(k2)) + lerp(1, 1.25, Ez.inOutCubic(k2)) * Ez.inOutCubic(k2); return { s, front: k1 > 0 && k2 < 1, center: Ez.outExpo(k1) * (1 - Ez.inOutCubic(k2)) }; }, // grossit brutalement jusqu'à occuper l'écran
    letterOverflow: (ui, U, c) => { if (ui < 0 || !U.big) return {}; const k = Ez.inExpo(clamp(ui / .5)); return { s: lerp(1, 30, k), front: true }; }, // une lettre devient si grande qu'elle sort du cadre
    punch: (ui, U, c) => { if (ui < 0) return {}; return { s: 1 + .45 * c.I * Math.exp(-ui * 7) * Math.cos(ui * 18), shake: Math.exp(-ui * 10) * 10 }; },
    shake: (ui) => (ui < 0 ? {} : { shake: 9 }),
    colorFlash: (ui, U, c) => (ui < 0 ? {} : { color: ui % .18 < .09 ? c.accent : c.accent2 }),
    jelly: (ui, U, c) => { if (ui < 0) return {}; const b = c.beat(c.now); return { sx: 1 + b * .25, sy: 1 - b * .18 }; },
    wobble: (ui) => (ui < 0 ? {} : { r: Math.sin(ui * 14) * 8 * Math.exp(-ui * 2), sk: Math.cos(ui * 11) * 6 * Math.exp(-ui * 2) }),
    stretchBeat: (ui, U, c) => { if (ui < 0) return {}; const b = c.beat(c.now); return { sy: 1 + b * .5, oy: 'bottom' }; },
    glow: (ui, U, c) => (ui < 0 ? {} : { glow: clamp(ui / .3) }),
  };
  // ------------------------------------------------------------------ couches « out » (uo = temps depuis le début de la sortie)
  const OUT = {
    none: () => ({}),
    fade: (uo) => ({ o: 1 - clamp(uo / .2) }),
    blurOut: (uo) => { const k = clamp(uo / .2); return { o: 1 - k, blur: k * 12 }; },
    explode: (uo, U, c) => { if (uo < 0) return {}; const a = hash(U.i, 21) * 6.283, v = 900 + hash(U.i, 22) * 1400, b = P.ballistic(uo, Math.cos(a) * v, Math.sin(a) * v - 900, 4200); return { x: b.x, y: b.y, r: uo * (hash(U.i, 23) - .5) * 1600, o: 1 - clamp((uo - .5) / .3), s: 1 + uo * .5 }; }, // lettres qui explosent
    disperse: (uo, U, c) => { if (uo < 0) return {}; const k = Ez.inCubic(clamp(uo / .9)); return { x: k * (500 + hash(U.i, 31) * 700), y: -k * (200 + hash(U.i, 32) * 500) + noise(uo * 3 + U.i, 2) * 60, r: k * (hash(U.i, 33) - .5) * 400, o: 1 - clamp((uo - .3) / .6), blur: k * 6 }; }, // emportées par le vent
    fallOff: (uo, U, c) => { if (uo < 0) return {}; const d = uo - hash(U.i, 41) * .15; if (d < 0) return {}; return { y: .5 * 5200 * d * d, r: d * (hash(U.i, 42) - .5) * 300 }; },
    collapse: (uo, U, c) => { if (uo < 0) return {}; const d = P.drop(uo - hash(U.i, 51) * .12, 0.001, 6000, .3); const fall = Math.max(0, U.groundGap) * Ez.inQuad(clamp((uo - hash(U.i, 51) * .12) / .35)); return { y: fall, r: clamp(uo / .4) * (hash(U.i, 52) - .5) * 160 }; }, // s'effondrent en tas au sol
    zoomThrough: (uo) => { const k = Ez.inExpo(clamp(uo / .35)); return { s: 1 + k * 25, o: 1 - clamp((uo - .25) / .1) }; },
    slideOut: (uo, U) => { const k = Ez.inCubic(clamp(uo / .3)); return { x: (U.line % 2 ? -1 : 1) * k * 1300, blur: k * 10 }; },
    rollAway: (uo, U) => { const k = Ez.inQuad(clamp(uo / .6)); return { x: k * 1200, r: k * 1200 / (U.h * .5) * 57.3 }; },
    sink: (uo, U, c) => { if (uo < 0) return {}; const k = Ez.inCubic(clamp((uo - U.i * .03) / .45)); return { y: k * 500, sy: 1 - k * .3, clipB: k * 100 }; }, // s'enfonce dans le sol
  };

  // ------------------------------------------------------------------ montage du texte
  HFS.kt = {
    IN, EMPH, OUT,
    presets: {},           // remplis par presets.js
    mount(el, cfg) {
      const P0 = Object.assign({}, cfg.preset && HFS.kt.presets[cfg.preset] || {}, cfg);
      const c = { I: P0.intensity ?? 1, V: P0.speed ?? 1, accent: P0.accent || '#ff2e4d', accent2: P0.accent2 || '#ffd23f', beat: () => 0, now: 0 };
      const unit = P0.unit || 'word';
      const lines = String(P0.text).split('/').map(s => s.trim()).filter(Boolean);
      el.innerHTML = ''; el.style.perspective = '1100px';
      const box = HFS.el('div', { class: 'kt-box', style: { position: 'relative', display: 'inline-block', transformStyle: 'preserve-3d' } }, el);
      const impWords = [].concat(P0.important || []).map(norm);
      let wi = 0; const words = [], units = [];
      lines.forEach((ln, li) => {
        const L = HFS.el('div', { class: 'kt-line', style: { whiteSpace: 'nowrap', transformStyle: 'preserve-3d' } }, box);
        if (P0.lineStyles) Object.assign(L.style, P0.lineStyles[li % P0.lineStyles.length]);
        ln.split(/\s+/).forEach(w => {
          const ws = HFS.el('span', { class: 'kt-w', 'data-layout-allow-overlap': '', 'data-layout-allow-overflow': '', style: { display: 'inline-block', whiteSpace: 'nowrap', transformStyle: 'preserve-3d', marginRight: '.22em' } }, L);
          const imp = impWords.length && impWords.includes(norm(w.replace(/^.*['’]/, ''))) || impWords.includes(norm(w));
          if (imp) { ws.classList.add('kt-imp'); if (P0.impStyle) Object.assign(ws.style, P0.impStyle); }
          const W0 = { el: ws, txt: w, i: wi, line: li, imp, t: P0.together && P0.words ? P0.words[0] : (P0.words && P0.words[wi] != null) ? P0.words[wi] : (P0.start || 0) + wi * .18 };
          if (unit === 'letter' || P0.in === 'typewriter' || P0.in === 'slotRoll' || P0.emph === 'letterOverflow') {
            [...w].forEach((ch, j) => { const cs = HFS.el('span', { class: 'kt-c', text: ch, 'data-layout-allow-overlap': '', 'data-layout-allow-overflow': '', style: { display: 'inline-block', transformStyle: 'preserve-3d' } }, ws); W0.letters = W0.letters || []; W0.letters.push({ el: cs, ch, j }); });
          } else ws.textContent = w;
          words.push(W0); wi++;
        });
      });
      // mesure UNE fois, au premier rendu où le bloc est visible (offsets : indépendants des transformations)
      const ground = P0.ground ?? (H * .74), stag = (P0.stagger ?? .035) / c.V;
      const offIn = e => { let x = 0, y = 0, n = e; while (n && n !== document.body && !(n.dataset && n.dataset.compositionId)) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return [x, y]; };
      words.forEach(W0 => { const add = (e, t, letter) => units.push({ el: e, t, i: units.length, line: W0.line, imp: W0.imp, letter, word: W0, w: 0, h: 0, cx: 0, cy: 0, dropH: 900, groundGap: 300, stackY: 0 });
        if (W0.letters) W0.letters.forEach((Lt, j) => add(Lt.el, W0.t + j * stag, true)); else add(W0.el, W0.t, false); });
      { const imp = words.find(w => w.imp); if (imp && imp.letters) { const L = imp.letters[Math.floor(imp.letters.length / 2)]; const U = units.find(u => u.el === L.el); if (U) U.big = true; } }
      let measured = false;
      const measure = () => { if (measured || !box.offsetWidth) return; measured = true;
        units.forEach(U => { const [x, y] = offIn(U.el); U.w = U.el.offsetWidth; U.h = U.el.offsetHeight; U.cx = x + U.w / 2; U.cy = y + U.h / 2; U.dropH = Math.max(320, y + U.h + 160); U.groundGap = ground - (y + U.h); });
        if (P0.layout === 'stack') { let acc = 0; units.forEach(U => { U.stackY = acc; acc += U.h * .9; }); }
        sparks.forEach(([s, U]) => { const [bx, by] = offIn(box); s.style.left = (U.cx - bx) + 'px'; s.style.top = (U.cy - by) + 'px'; });
      };
      // particules d'apparition (burst)
      const sparks = [];
      if (P0.in === 'burst') units.forEach(U => { for (let k = 0; k < 8; k++) { const s = HFS.el('i', { style: { position: 'absolute', left: '0px', top: '0px', width: '10px', height: '10px', borderRadius: '50%', background: k % 2 ? c.accent : c.accent2, opacity: 0 } }, box); sparks.push([s, U, k]); } });
      const GLY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@';
      const fin = { in: IN[P0.in || 'fade'] || IN.fade, emph: EMPH[P0.emph || 'none'] || EMPH.none, out: OUT[P0.out || 'none'] || OUT.none };
      const impact = P0.impact ?? null, outAt = P0.outAt ?? 1e9;
      return {
        units, words, box, cfg: P0,
        setBeat(fn) { c.beat = fn; },
        render(t, extra = {}) {
          measure(); c.now = t;
          let shakeX = 0, shakeY = 0;
          for (const U of units) {
            const a = fin.in(t - U.t, U, c) || {}, e = U.imp && impact != null ? (fin.emph(t - impact, U, c) || {}) : {}, o = fin.out(t - outAt, U, c) || {};
            const T = { x: (a.x || 0) + (e.x || 0) + (o.x || 0), y: (a.y || 0) + (o.y || 0) + (e.y || 0) - (P0.layout === 'stack' ? U.stackY : 0) * 0, s: (a.s ?? 1) * (e.s ?? 1) * (o.s ?? 1), sx: (a.sx ?? 1) * (e.sx ?? 1) * (o.sx ?? 1), sy: (a.sy ?? 1) * (e.sy ?? 1) * (o.sy ?? 1),
              r: (a.r || 0) + (e.r || 0) + (o.r || 0), rx: a.rx || 0, sk: (a.sk || 0) + (e.sk || 0), o: Math.min(a.o ?? 1, o.o ?? 1), blur: Math.max(a.blur || 0, o.blur || 0), z: a.z || 0 };
            const sh = (a.shake || 0) + (e.shake || 0); if (sh) { shakeX += noise(t * 40, 1) * sh; shakeY += noise(t * 40, 2) * sh; }
            if (e.center) { T.x += (W / 2 - U.cx) * e.center; T.y += (H * .45 - U.cy) * e.center; }
            U.el.style.transformOrigin = a.ox || (a.oy || e.oy ? `center ${a.oy || e.oy}` : 'center center');
            U.el.style.transform = `translate3d(${T.x.toFixed(1)}px,${T.y.toFixed(1)}px,${T.z.toFixed(1)}px) rotate(${T.r.toFixed(2)}deg) rotateX(${T.rx.toFixed(1)}deg) skewX(${T.sk.toFixed(1)}deg) scale(${(T.s * T.sx).toFixed(3)},${(T.s * T.sy).toFixed(3)})`;
            U.el.style.opacity = T.o; U.el.style.filter = T.blur > .3 ? `blur(${T.blur.toFixed(1)}px)` : (e.glow ? `drop-shadow(0 0 ${12 + 30 * e.glow}px ${c.accent})` : '');
            U.el.style.zIndex = e.front ? 50 : '';
            U.el.style.color = e.color || '';
            if (a.clip != null) U.el.style.clipPath = `inset(0 ${a.clip.toFixed(1)}% 0 0)`; else if (o.clipB != null) U.el.style.clipPath = `inset(0 0 ${o.clipB.toFixed(1)}% 0)`; else U.el.style.clipPath = '';
            if (a.slot != null && U.letter) U.el.textContent = a.slot >= 1 ? U.word.letters.find(l => l.el === U.el).ch : GLY[Math.floor((t * 30 + U.i * 7)) % GLY.length];
          }
          for (const [s, U, k] of sparks) { const u = t - U.t; const on = u >= 0 && u < .5; const an = k / 8 * 6.283 + U.i; const d = Ez.outCubic(clamp(u / .5)) * (90 + 40 * hash(k, U.i)); s.style.opacity = on ? 1 - u / .5 : 0; s.style.transform = `translate(${Math.cos(an) * d}px,${Math.sin(an) * d}px)`; }
          box.style.transform = (shakeX || shakeY) ? `translate(${shakeX.toFixed(1)}px,${shakeY.toFixed(1)}px)` : '';
          return { shakeX, shakeY };
        },
      };
    },
    // relief 3D en CSS (empilement d'ombres) pour les textes 2D « extrudés »
    extrude(color = '#3a0008', depth = 14, angle = 60, glow) { const a = angle * Math.PI / 180, out = []; for (let i = 1; i <= depth; i++) out.push(`${(Math.cos(a) * i).toFixed(1)}px ${(Math.sin(a) * i).toFixed(1)}px 0 ${color}`); out.push(`${(Math.cos(a) * depth * 2).toFixed(1)}px ${(Math.sin(a) * depth * 2.4).toFixed(1)}px 22px rgba(0,0,0,.45)`); if (glow) out.push(`0 0 30px ${glow}`); return out.join(','); },
  };
  /* Texte d'une scène : position (zone sûre TikTok : x 120→888, y 288→1248), taille ajustée à la largeur
     (mesure par canvas, sans lecture de mise en page), synchro sur les kicks, rendu à chaque image. */
  HFS.sceneText = function (sc, el, T) {
    if (!T || !T.text) return null;
    const POS = { top: 320, upper: 470, center: 720, lower: 960 };
    const font = T.font || 'Anton', weight = T.weight || 400, maxW = T.width || 680;
    const lines = String(T.text).split('/').map(x => x.trim());
    const cv = document.createElement('canvas').getContext('2d'); let size = T.size || 130;
    const widest = sz => { cv.font = `${weight} ${sz}px '${font}'`; return Math.max(...lines.map(l => cv.measureText(T.case === 'none' ? l : l.toUpperCase()).width + (l.split(' ').length - 1) * sz * .22)); };
    while (size > 40 && widest(size) > maxW) size -= 4;
    if (size * (T.lineHeight || 1.02) * lines.length > (T.maxHeight || 620)) size = Math.floor((T.maxHeight || 620) / ((T.lineHeight || 1.02) * lines.length));
    const pos = Array.isArray(T.pos) ? T.pos : [T.align === 'center' ? 530 - maxW / 2 : (T.x ?? 150), POS[T.pos || 'top'] ?? 320];
    Object.assign(el.style, { position: 'absolute', left: pos[0] + 'px', top: pos[1] + 'px', width: maxW + 'px', fontFamily: `'${font}', sans-serif`, fontWeight: weight, fontSize: size + 'px', lineHeight: T.lineHeight || 1.02,
      color: T.color || '#fff', textAlign: T.align || 'left', textTransform: T.case === 'none' ? 'none' : 'uppercase', letterSpacing: (T.spacing || 0) + 'em', textShadow: T.extrude ? HFS.kt.extrude(T.extrude.color, T.extrude.depth, T.extrude.angle, T.extrude.glow) : (T.shadow || '0 6px 24px rgba(0,0,0,.45)'), zIndex: T.z ?? 40 });
    const local = Object.assign({}, T, { words: (T.words || []).map(x => x - sc.t0), impact: T.impact != null ? T.impact - sc.t0 : null, outAt: T.outAt != null ? T.outAt - sc.t0 : sc.dur - .3, ground: T.ground ?? 1250 });
    const k = HFS.kt.mount(el, local);
    k.setBeat(now => sc.beat(now, T.beatKind || 'kicks', 9));
    sc.update(t => k.render(t));
    return k;
  };
  HFS.ready = cb => (document.fonts && document.fonts.ready ? document.fonts.ready.then(cb) : cb());
})();
