/* STYLE H — VOXEL CINÉMATOGRAPHIQUE
 * Personnages cubiques, décor géométrique, tapis rouge, projecteurs, architecture stylisée,
 * ambiance nocturne, typographie dorée élégante, caméra en travelling.
 * Gabarit : voxel.red_carpet (réussite, gloire, se présenter, « c'est moi »)
 * params : word3d (mot des paroles affiché en lettres d'or dans le décor), accent
 */
(function () {
  const C = window.CLIP;
  C.template('voxel.red_carpet', (S, P) => {
    const X = C.three(S, { bg: 0x05040a, fog: [0x05040a, 14, 46], exposure: 1.15 });
    const T = X.T, K = C.K3;
    X.add(new T.HemisphereLight(0x302848, 0x000000, .45));
    const ground = new T.Mesh(new T.BoxGeometry(60, .4, 120), new T.MeshStandardMaterial({ color: 0x14121c, roughness: .6, flatShading: true })); ground.position.set(0, -.2, -40); ground.receiveShadow = true; X.add(ground);
    const carpet = new T.Mesh(new T.BoxGeometry(3.2, .08, 120), new T.MeshStandardMaterial({ color: 0xb3121f, roughness: .7, flatShading: true })); carpet.position.set(0, .04, -40); carpet.receiveShadow = true; X.add(carpet);
    // escaliers + portique au bout
    const stone = new T.MeshStandardMaterial({ color: 0x2a2632, roughness: .8, flatShading: true }), gold = new T.MeshStandardMaterial({ color: 0xd9a63a, roughness: .25, metalness: .9, emissive: 0x3a2400, flatShading: true });
    for (let i = 0; i < 6; i++) { const st = new T.Mesh(new T.BoxGeometry(14 - i, .35, 1.2), stone); st.position.set(0, .17 + i * .35, -26 - i * 1.2); st.receiveShadow = true; X.add(st); }
    for (const x of [-6, -3.5, 3.5, 6]) { const c = new T.Mesh(new T.BoxGeometry(1, 9, 1), stone); c.position.set(x, 6.4, -33); c.castShadow = true; X.add(c); const cap = new T.Mesh(new T.BoxGeometry(1.4, .4, 1.4), gold); cap.position.set(x, 11, -33); X.add(cap); }
    const fr = new T.Mesh(new T.BoxGeometry(14, 1.2, 1.4), stone); fr.position.set(0, 11.8, -33); X.add(fr);
    // potelets dorés + cordons
    for (let z = 6; z > -24; z -= 2.6) [-1, 1].forEach(sgn => { const p = new T.Mesh(new T.BoxGeometry(.18, 1, .18), gold); p.position.set(sgn * 2.1, .5, z); p.castShadow = true; X.add(p);
      const rope = new T.Mesh(new T.BoxGeometry(.06, .06, 2.6), new T.MeshStandardMaterial({ color: 0x7a0c14, roughness: .6 })); rope.position.set(sgn * 2.1, .82, z - 1.3); X.add(rope); });
    // foule voxel derrière les cordons + flashs de photographes (sur les temps)
    const r = C.rng(S.id), flashes = [], crowd = [];
    for (let z = 4; z > -22; z -= 1.3) [-1, 1].forEach(sgn => { const hu = K.voxelHuman(T, { color: [0x1c1a24, 0x24202e, 0x15141a][Math.floor(r() * 3)] }); hu.position.set(sgn * (2.9 + r() * 1.4), 0, z + r() * .6); hu.rotation.y = sgn * -Math.PI / 2 + (r() - .5) * .4; hu.userData.ph = r() * 9; X.add(hu); crowd.push(hu);
      if (r() < .45) { const f = new T.Mesh(new T.BoxGeometry(.22, .16, .1), new T.MeshBasicMaterial({ color: 0xffffff })); f.position.set(hu.position.x - sgn * .3, 1.55, hu.position.z); f.userData.ph = r() * 20; X.add(f); flashes.push(f); } });
    const flashLight = new T.PointLight(0xffffff, 0, 12, 2); X.add(flashLight);
    // la star voxel
    const star = K.voxelHuman(T, { color: 0xf2efe6, headMaterial: new T.MeshStandardMaterial({ color: 0x8a5a3a, flatShading: true }), hair: 0x15100c }); X.add(star);
    const suit = new T.Mesh(new T.BoxGeometry(.42, .62, .3), new T.MeshStandardMaterial({ color: 0x101014, roughness: .5, flatShading: true })); suit.position.y = .3; star.userData.hips.add(suit);
    // projecteurs balayants
    const spots = [-1, 1].map(sgn => { const v = K.volumetric(T, { color: 0xfff0c8, length: 22, radius: 3, intensity: .3, power: 2.5, shadow: sgn < 0 }); v.position.set(sgn * 9, 18, -14); X.add(v); return v; });
    const key = K.volumetric(T, { color: 0xffe6b0, length: 9, radius: 1.8, intensity: .42, power: 4 }); X.add(key);
    // lettres d'or (mot des paroles) au fronton
    if (P.word3d) { const tp = K.textPlane(T, String(P.word3d).toUpperCase(), { font: P.font3d || 'Cinzel', fontSize: 240, height: 2.6, gradient: [[0, '#fff3c4'], [.5, '#e9b949'], [1, '#9a6a12']] }); tp.position.set(0, 13.9, -32.2); X.add(tp); }
    // confettis d'or
    const pg = new T.BufferGeometry(), n = 260, pp = new Float32Array(n * 3), b0 = [];
    for (let i = 0; i < n; i++) { b0.push([(r() - .5) * 14, r() * 14, -r() * 30 + 4, r()]); }
    pg.setAttribute('position', new T.BufferAttribute(pp, 3)); X.add(new T.Points(pg, new T.PointsMaterial({ color: 0xffd36a, size: .07, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false })));
    const dur = S.dur, zAt = t => 4 - t * 1.6;
    X.update(t => {
      const z = zAt(t); star.position.set(0, 0, z); star.pose({ walk: t * 6, amt: 1, headYaw: Math.sin(t * 1.4) * .5, raiseR: t > dur * .5 ? Math.min(1, (t - dur * .5) * 3) * .7 : 0, wave: t * 9 });
      key.position.set(0, 9, z);
      spots.forEach((v, i) => { v.rotation.z = Math.sin(t * .9 + i * 2) * .5; v.rotation.x = -.3 + Math.cos(t * .7 + i) * .15; });
      let fl = 0; flashes.forEach(f => { const on = C.noise(t * 7 + f.userData.ph, 5) > .55 || S.beat(t, 14) > .6 && f.userData.ph % 3 < 1; f.material.color.setScalar(on ? 1 : .08); if (on) fl += 1; });
      flashLight.intensity = Math.min(3, fl * .35); flashLight.position.set(Math.sin(t * 13) * 3, 2, z - 1);
      crowd.forEach(hu => hu.pose({ headYaw: Math.sin(t * 1.2 + hu.userData.ph) * .4, raiseR: Math.max(0, Math.sin(t * 2 + hu.userData.ph)) * .5 }));
      for (let i = 0; i < n; i++) { const [x, y, zz, w] = b0[i]; pp[i * 3] = x + Math.sin(t * 2 + i) * .2; pp[i * 3 + 1] = ((y - t * (.6 + w)) % 14 + 14) % 14; pp[i * 3 + 2] = zz; } pg.attributes.position.needsUpdate = true;
    });
    X.camMove('follow', { subject: t => new T.Vector3(0, 0, zAt(t)), offset: [3.4, 2.0, 7.4], look: [-.4, 1.4, -4], ease: 'linear' });
    S.key(X.el, 'scène 3D', 'cut,ui,text');
  });
})();
