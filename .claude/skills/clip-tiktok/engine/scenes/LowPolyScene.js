/* STYLE E — LOW-POLY / VOXEL 3D
 * Environnements géométriques, voitures et bâtiments low-poly, routes de nuit, éclairage urbain,
 * reflets et ombres, caméra qui suit le sujet, typographie XXL en perspective dans le décor.
 * Gabarit : lowpoly.night_drive (voiture, argent, sortir, rouler, jour de paye)
 * params : word3d (mot des paroles en lettres XXL au bord de la route), carColor, props: ['bills']
 */
(function () {
  const C = window.CLIP;
  C.template('lowpoly.night_drive', (S, P) => {
    const X = C.three(S, { bg: 0x0a0b18, fog: [0x0a0b18, 18, 75], exposure: 1.25 });
    const T = X.T, K = C.K3;
    X.add(new T.HemisphereLight(0x3a4870, 0x05050a, .55));
    const moon = new T.DirectionalLight(0x8aa0ff, .6); moon.position.set(-10, 20, 5); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15 }); X.add(moon);
    X.add(K.lowpolyCity(T, { seed: S.index + 3, length: 200, maxH: 26 }));
    const lights = []; for (let z = 10; z > -170; z -= 16) [-1, 1].forEach((sgn, j) => { const l = K.streetLight(T, { dir: -sgn, light: (z / 16) % 2 === 0 && j === 0 }); l.position.set(sgn * 5.2, 0, z - j * 8); X.add(l); lights.push(l); });
    const car = K.lowpolyCar(T, { color: C.three && P.carColor ? parseInt(P.carColor.replace('#', ''), 16) : 0xd8262f }); X.add(car);
    // lettres XXL au bord de la route (mot des paroles)
    if (P.word3d) { const tp = K.textPlane(T, String(P.word3d).toUpperCase(), { font: P.font3d || 'Anton', fontSize: 260, height: 5.2, color: P.wordColor || '#ffd23f', stroke: '#1a1020', strokeWidth: 14 });
      tp.position.set(-9.5, 3.2, -46); tp.rotation.y = .75; X.add(tp); const glow = new T.PointLight(0xffd23f, 2.5, 14, 2); glow.position.set(-7, 3, -44); X.add(glow); }
    // billets qui s'envolent de la voiture
    const bills = [];
    if ((P.props || []).includes('bills')) { const bm = new T.MeshStandardMaterial({ color: 0x7fc47a, emissive: 0x1a3a18, roughness: .6, side: T.DoubleSide });
      for (let i = 0; i < 40; i++) { const b = new T.Mesh(new T.PlaneGeometry(.42, .2), bm); b.userData = { ph: i * .37, sx: (Math.sin(i * 12.9) * .5), sp: .8 + (i % 5) * .15 }; X.add(b); bills.push(b); } }
    const zAt = t => 6 - t * 9.5;
    X.update(t => {
      const z = zAt(t); car.position.set(.0 + Math.sin(t * .8) * .25, 0, z); car.rotation.y = Math.cos(t * .8) * .03;
      car.userData.wheels.forEach(w => { w.rotation.x = -t * 25; });
      bills.forEach((b, i) => { const u = ((t * b.userData.sp + b.userData.ph) % 1.6); b.position.set(car.position.x + b.userData.sx * 2 + Math.sin(u * 6 + i) * .6 * u, 1.1 + u * 2.4, z + 1.8 + u * 7); b.rotation.set(u * 9 + i, u * 7, u * 5); });
    });
    X.camMove('follow', { subject: t => new T.Vector3(0, 0, zAt(t)), offset: [P.side ?? 3.4, 3.4, 11], look: [0, .8, -8], ease: 'linear', handheld: .3 });
    S.key(X.el, 'scène 3D', 'cut,ui,text');
  });
})();
