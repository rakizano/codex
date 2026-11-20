/* STYLE A — 3D CINÉMATOGRAPHIQUE
 * Humains minimalistes 3D, silhouettes noires + personnage principal lumineux, éclairage volumétrique,
 * projecteurs et ombres longues, architecture, brouillard, profondeur de champ.
 * Gabarits : cinematic.spotlight_crowd (solitude, exclusion, être différent)
 *            cinematic.duo_night       (amour, complicité, deux personnes)
 * params : accent (couleur hex de la lumière principale), crowd (nb), mood ('cold'|'warm'|'pink')
 */
(function () {
  const C = window.CLIP;
  const hex = s => parseInt(String(s || '#ffffff').replace('#', ''), 16);

  function stage(X, o = {}) {
    const T = X.T;
    const floor = new T.Mesh(new T.PlaneGeometry(120, 120), new T.MeshStandardMaterial({ color: o.floor ?? 0x0b0c10, roughness: .28, metalness: .55 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; X.add(floor);
    X.add(new T.HemisphereLight(o.sky ?? 0x2a3350, 0x000000, o.amb ?? .35));
    // architecture : colonnade + architrave au fond
    const m = new T.MeshStandardMaterial({ color: o.arch ?? 0x17181e, roughness: .85 });
    for (let x = -15; x <= 15; x += 3) { const p = new T.Mesh(new T.CylinderGeometry(.45, .55, 13, 16), m); p.position.set(x, 6.5, o.archZ ?? -16); p.castShadow = true; p.receiveShadow = true; X.add(p); }
    const beam = new T.Mesh(new T.BoxGeometry(34, 1.6, 1.8), m); beam.position.set(0, 13.4, o.archZ ?? -16); X.add(beam);
    return floor;
  }
  function dust(X, n, box, color) {
    const T = X.T, g = new T.BufferGeometry(), pos = new Float32Array(n * 3), r = C.rng('dust' + n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * box[0]; pos[i * 3 + 1] = r() * box[1]; pos[i * 3 + 2] = (r() - .5) * box[2]; }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color: color ?? 0xfff2d8, size: .035, transparent: true, opacity: .7, blending: T.AdditiveBlending, depthWrite: false }));
    const base = pos.slice(); X.add(pts);
    X.update(t => { for (let i = 0; i < n; i++) { pos[i * 3 + 1] = (base[i * 3 + 1] + t * .12) % box[1]; pos[i * 3] = base[i * 3] + Math.sin(t * .5 + i) * .05; } g.attributes.position.needsUpdate = true; });
    return pts;
  }

  /* Seul au milieu d'une foule sombre, éclairé par un projecteur */
  C.template('cinematic.spotlight_crowd', (S, P) => {
    const X = C.three(S, { bg: 0x040508, fog: [0x040508, 9, 34], exposure: 1.15 });
    const T = X.T, K = C.K3, accent = hex(P.accent || '#ffe2b8');
    stage(X, { sky: 0x1a2030, amb: .22 }); X.add(K.backdrop(T, { color: P.haze || '#2c3a66', rim: 0x9db4ff, rimPower: 1.6 }));
    const r = C.rng(S.id + 'crowd'), crowd = [];
    const N = P.crowd || 30;
    for (let i = 0; i < N; i++) {
      const a = r() * Math.PI * 2, d = 1.7 + Math.sqrt(r()) * 7; const x = Math.cos(a) * d, z = Math.sin(a) * d - 1;
      if (Math.abs(x) < 1.1 && z > -1.5 && z < 6) continue;   // couloir libre devant le héros
      const hu = K.human(T, { color: 0x09090b, roughness: .7 }); hu.position.set(x, 0, z); hu.scale.setScalar(.92 + r() * .16);
      hu.userData.yaw0 = r() * Math.PI * 2; hu.userData.ph = r() * 10; X.add(hu); crowd.push(hu);
    }
    const hero = K.human(T, { color: 0xffffff, emissive: accent, emissiveIntensity: 1.25, roughness: .3 }); X.add(hero);
    const hl = new T.PointLight(accent, 1.4, 5, 2); hl.position.y = 1.3; hero.add(hl);
    const spot = K.volumetric(T, { color: accent, length: 10, radius: 2.4, intensity: .5, power: 4 }); X.add(spot);
    [-1, 1].forEach(sgn => { const back = K.volumetric(T, { color: 0x9fb8ff, length: 18, radius: 3.4, intensity: .16, power: 1.2, shadow: false }); back.position.set(sgn * 7, 13, -12); back.rotation.z = sgn * .55; back.rotation.x = -.35; X.add(back); });
    dust(X, 260, [6, 9, 6], accent);
    const dur = S.dur;
    const heroAt = t => { const k = Math.min(1, t / (dur * .65)); return new T.Vector3(0, 0, -2.6 + 3.2 * (1 - Math.pow(1 - k, 2))); };
    X.update(t => {
      const p = heroAt(t); hero.position.copy(p);
      const walking = t < dur * .65; const ph = t * 7.2;
      hero.pose({ walk: ph, amt: walking ? 1 : Math.max(0, 1 - (t - dur * .65) * 4), headYaw: walking ? 0 : Math.sin((t - dur * .65) * 2.2) * .6, headPitch: -.05 });
      spot.position.set(p.x, 10, p.z);
      crowd.forEach((hu, i) => { const look = Math.atan2(p.x - hu.position.x, p.z - hu.position.z); const turn = C.clamp((t - .3 - (i % 7) * .08) / .7);
        hu.pose({ yaw: hu.userData.yaw0 + (((look - hu.userData.yaw0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * turn * .85, headYaw: Math.sin(t * .8 + hu.userData.ph) * .15, lean: Math.sin(t * 1.1 + hu.userData.ph) * .02 }); });
    });
    X.camMove(P.camera || 'dolly', { from: [1.2, 1.1, 13], to: [0, 1.6, 8.2], target: t => heroAt(t).clone().setY(1.25), fov0: 42, fov1: 34, ease: 'out' });
    S.key(X.el, 'scène 3D', 'cut,ui,text');
  });

  /* Deux personnes qui marchent ensemble sous les réverbères */
  C.template('cinematic.duo_night', (S, P) => {
    const X = C.three(S, { bg: 0x07050c, fog: [0x07050c, 7, 40], exposure: 1.2 });
    const T = X.T, K = C.K3, accent = hex(P.accent || '#ff6aa8');
    const floor = new T.Mesh(new T.PlaneGeometry(60, 200), new T.MeshStandardMaterial({ color: 0x0c0a12, roughness: .18, metalness: .7 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -60; floor.receiveShadow = true; X.add(floor);
    X.add(new T.HemisphereLight(0x302040, 0x000000, .3));
    for (let z = 4; z > -90; z -= 9) [-1, 1].forEach(sgn => { const v = K.volumetric(T, { color: sgn < 0 ? accent : 0xffd9a8, length: 6.2, radius: 1.8, intensity: .38, power: 2.4, shadow: z > -10 && sgn < 0 });
      v.position.set(sgn * 3.4, 6, z); X.add(v); const pole = new T.Mesh(new T.CylinderGeometry(.06, .08, 6, 8), new T.MeshStandardMaterial({ color: 0x1a1820 })); pole.position.set(sgn * 3.9, 3, z); X.add(pole); });
    const a = K.human(T, { color: 0x111018, emissive: 0x220a18, roughness: .4 }), b = K.human(T, { color: 0xffffff, emissive: accent, emissiveIntensity: .9, hair: 0x1a1014 });
    b.scale.setScalar(.93); X.add(a, b);
    const glow = new T.PointLight(accent, 2, 6, 2); glow.position.y = 1.4; b.add(glow);
    const dur = S.dur, speed = 1.25;
    const posAt = t => -t * speed;
    X.update(t => { const z = posAt(t), ph = t * 6.5; a.position.set(-.38, 0, z); b.position.set(.36, 0, z + .05);
      a.pose({ walk: ph, amt: 1, openR: .35, raiseR: .15, bendR: .2, headYaw: .25 + Math.sin(t) * .1 }); b.pose({ walk: ph + .25, amt: 1, headYaw: -.3 + Math.sin(t * 1.2) * .1, lean: .03 }); });
    X.camMove('follow', { subject: t => new T.Vector3(0, 0, posAt(t)), offset: [1.8, 1.6, 5.4], look: [0, 1.1, -2], ease: 'linear' });
    S.key(X.el, 'scène 3D', 'cut,ui,text');
  });
})();
