/* ==========================================================================
 * Couche 3D (Three.js r149, local, gratuit) intégrée au moteur SVG existant.
 *  - Un seul WebGLRenderer partagé ; chaque scène 3D recopie son rendu dans un
 *    <canvas> 2D placé dans un <foreignObject> → compatible avec les calques,
 *    transitions (masques, découpes), flous et effets du moteur.
 *  - Tout est une fonction PURE du temps t (rendu image par image déterministe).
 * API :
 *   const X = CLIP.three(S, { bg, fog: [couleur, near, far], exposure, shadows, depth })
 *   X.T (THREE), X.scene, X.camera, X.update(fn(t, p)), X.add(obj)
 *   X.camMove(preset, opts)  — dolly | truck | pan | tilt | orbit | crane | follow | static
 *   CLIP.K3.human(T, opts) / CLIP.K3.voxelHuman(T, opts)  — personnages riggés (marche, regard, demi-tour, gestes)
 *   CLIP.K3.volumetric(T, opts) — cône de lumière volumétrique (+ SpotLight)
 *   CLIP.K3.textPlane(T, text, opts) — typographie XXL dans le décor 3D
 *   CLIP.K3.lowpolyCity / lowpolyCar / streetLight / windowsTexture
 * ========================================================================== */
(function () {
  const C = window.CLIP;
  const W = 1080, H = 1920;
  let R = null;
  function renderer() {
    if (R) return R;
    R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true, powerPreference: 'high-performance' });
    R.setPixelRatio(1); R.setSize(W, H, false);
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
    return R;
  }
  const ease = {
    linear: k => k, inOut: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
    out: k => 1 - Math.pow(1 - k, 3), in: k => k * k * k,
  };
  const lerp = (a, b, k) => a + (b - a) * k, clamp = k => Math.max(0, Math.min(1, k));
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

  C.three = function (S, o = {}) {
    const T = THREE;
    const fo = S.h('foreignObject', { x: 0, y: 0, width: W, height: H });
    const cv = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    cv.width = W; cv.height = H; cv.style.display = 'block'; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    fo.appendChild(cv);
    const L = S.layer(o.depth ?? 0); L.g.appendChild(fo);
    const ctx2d = cv.getContext('2d');
    const scene = new T.Scene();
    if (o.bg) scene.background = new T.Color(o.bg);
    if (o.fog) scene.fog = new T.Fog(o.fog[0], o.fog[1], o.fog[2]);
    const camera = new T.PerspectiveCamera(o.fov || 38, W / H, .05, 600);
    camera.position.set(0, 1.6, 8); camera.lookAt(0, 1.2, 0);
    const ups = [];
    const X = {
      T, scene, camera, el: fo, canvas: cv, layer: L, _cam: null,
      add(...objs) { objs.forEach(ob => scene.add(ob)); return objs[0]; },
      update(fn) { ups.push(fn); },
      // Mouvements de caméra réutilisables (CameraMotion)
      camMove(preset, c = {}) { X._cam = { preset, c }; },
    };
    function applyCam(t, p) {
      if (!X._cam) return;
      const { preset, c } = X._cam, e = (ease[c.ease || 'inOut'])(clamp(p));
      const tgt = c.target ? (typeof c.target === 'function' ? c.target(t) : v3(c.target)) : new T.Vector3(0, 1.2, 0);
      let pos;
      switch (preset) {
        case 'dolly': pos = v3(c.from).lerp(v3(c.to), e); break;                         // avant / arrière
        case 'truck': pos = v3(c.from).lerp(v3(c.to), e); break;                         // travelling latéral (from/to décalés en x)
        case 'crane': pos = v3(c.from).lerp(v3(c.to), e); break;                         // montée / descente
        case 'pan': { pos = v3(c.pos); const a = lerp(c.a0 || -.3, c.a1 || .3, e); const d = c.dist || 10; tgt.set(pos.x + Math.sin(a) * d, c.ty ?? pos.y, pos.z - Math.cos(a) * d); break; }
        case 'tilt': { pos = v3(c.pos); const a = lerp(c.a0 || -.2, c.a1 || .4, e); tgt.set(c.tx ?? pos.x, pos.y + Math.tan(a) * 10, pos.z - 10); break; }
        case 'orbit': { const a = lerp(c.a0 || 0, c.a1 || 1, e), r = c.r || 6; const cc = c.center ? v3(c.center) : tgt; pos = new T.Vector3(cc.x + Math.sin(a) * r, c.y ?? 1.8, cc.z + Math.cos(a) * r); if (!c.target) tgt.copy(cc); break; }
        case 'follow': { const f = c.subject(t); pos = f.clone().add(v3(c.offset || [0, 2.2, 6])); tgt.copy(f).add(v3(c.look || [0, .8, -3])); break; }
        default: pos = v3(c.pos || [0, 1.6, 8]);
      }
      if (c.shake) { pos.x += C.noise(t * 6, 31) * c.shake; pos.y += C.noise(t * 6, 32) * c.shake; }
      if (c.handheld !== 0) { const hh = c.handheld ?? .6; pos.x += C.noise(t * .7, 41) * .04 * hh; pos.y += C.noise(t * .6, 42) * .03 * hh; }
      camera.position.copy(pos); camera.lookAt(tgt);
      if (c.fov0 && c.fov1) { camera.fov = lerp(c.fov0, c.fov1, e); camera.updateProjectionMatrix(); }   // zoom cinématique
      if (c.roll) camera.rotation.z += lerp(c.roll[0], c.roll[1], e) * Math.PI / 180;
    }
    S.items.push({
      el: fo, update(t, p) {
        const r = renderer();
        for (const f of ups) f(t, p);
        applyCam(t, p);
        r.toneMappingExposure = o.exposure ?? 1;
        r.setClearColor(o.bg || 0x000000, o.bg ? 1 : 0);
        r.render(scene, camera);
        ctx2d.clearRect(0, 0, W, H); ctx2d.drawImage(r.domElement, 0, 0);
      }
    });
    return X;
  };

  /* --------------------------- kit 3D --------------------------- */
  const K3 = {};
  // Personnage humain minimaliste riggé (Character 3D) — capsules lisses ; voxel: true → cubes
  K3.human = function (T, o = {}) {
    const voxel = !!o.voxel;
    const mat = o.material || new T.MeshStandardMaterial({ color: o.color ?? 0x111114, roughness: o.roughness ?? .55, metalness: o.metalness ?? .05,
      emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1, flatShading: voxel });
    const mk = (r, len, m2) => { const g = voxel ? new T.BoxGeometry(r * 2.1, len + r * 2, r * 2.1) : new T.CapsuleGeometry(r, len, 6, 14); const m = new T.Mesh(g, m2 || mat); m.castShadow = true; m.receiveShadow = true; return m; };
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const hips = new T.Group(); hips.position.y = .95; body.add(hips);
    const torso = mk(.17, .42); torso.position.y = .33; torso.scale.set(1.22, 1, .74); hips.add(torso);
    const chest = new T.Group(); chest.position.y = .3; hips.add(chest);
    const neck = new T.Group(); neck.position.y = .36; chest.add(neck);
    const head = voxel ? new T.Mesh(new T.BoxGeometry(.27, .29, .27), o.headMaterial || mat) : new T.Mesh(new T.SphereGeometry(.125, 24, 18), o.headMaterial || mat);
    head.position.y = .14; head.castShadow = true; neck.add(head);
    if (o.hair) { const hm = new T.MeshStandardMaterial({ color: o.hair, roughness: .8, flatShading: voxel }); const hh = voxel ? new T.Mesh(new T.BoxGeometry(.29, .1, .29), hm) : new T.Mesh(new T.SphereGeometry(.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hm); hh.position.y = voxel ? .18 : .16; neck.add(hh); }
    const limb = (x, y, r1, l1, r2, l2, parent) => {
      const a = new T.Group(); a.position.set(x, y, 0); parent.add(a);
      const up = mk(r1, l1); up.position.y = -l1 / 2 - r1 * .5; a.add(up);
      const j = new T.Group(); j.position.y = -l1 - r1; a.add(j);
      const lo = mk(r2, l2); lo.position.y = -l2 / 2 - r2 * .5; j.add(lo);
      return { a, j, lo };
    };
    const armL = limb(-.215, .2, .062, .22, .052, .22, chest), armR = limb(.215, .2, .062, .22, .052, .22, chest);
    const legL = limb(-.1, 0, .08, .34, .066, .36, hips), legR = limb(.1, 0, .08, .34, .066, .36, hips);
    [legL, legR].forEach(l => { const f = new T.Mesh(new T.BoxGeometry(.11, .07, .24), mat); f.position.set(0, -.44, .06); f.castShadow = true; l.j.add(f); });
    root.userData = { hips, chest, neck, head, armL, armR, legL, legR, body, mat };
    root.traverse(m => { if (m.isMesh) m.castShadow = true; });
    /* pose(t-state) : { walk: phase (rad), amt 0..1, yaw (corps), headYaw, headPitch, raiseL, raiseR (0..1), wave, lean } */
    root.pose = (s = {}) => {
      const u = root.userData, a = s.amt ?? 0, ph = s.walk ?? 0, run = s.run ? 1.7 : 1;
      u.hips.position.y = .95 + Math.abs(Math.sin(ph)) * .035 * a * run - (s.crouch || 0) * .25;
      u.legL.a.rotation.x = Math.sin(ph) * .55 * a * run; u.legR.a.rotation.x = -Math.sin(ph) * .55 * a * run;
      u.legL.j.rotation.x = Math.max(0, -Math.cos(ph)) * .9 * a * run + (s.crouch || 0) * 1.2; u.legR.j.rotation.x = Math.max(0, Math.cos(ph)) * .9 * a * run + (s.crouch || 0) * 1.2;
      if (s.crouch) { u.legL.a.rotation.x -= s.crouch * .9; u.legR.a.rotation.x -= s.crouch * .9; }
      const sw = Math.sin(ph) * .45 * a * run;
      u.armL.a.rotation.x = -sw - (s.raiseL || 0) * 2.6; u.armR.a.rotation.x = sw - (s.raiseR || 0) * 2.6;
      u.armL.a.rotation.z = -.08 - (s.openL || 0) * 1.2; u.armR.a.rotation.z = .08 + (s.openR || 0) * 1.2;
      u.armL.j.rotation.x = -.25 - a * .35 - (s.bendL || 0); u.armR.j.rotation.x = -.25 - a * .35 - (s.bendR || 0) + (s.wave ? Math.sin(s.wave) * .5 - .6 : 0);
      u.chest.rotation.y = -Math.sin(ph) * .08 * a; u.chest.rotation.x = (s.lean || 0) + .04 * a * run;
      u.neck.rotation.y = s.headYaw || 0; u.neck.rotation.x = s.headPitch || 0;
      u.body.rotation.y = s.yaw || 0;
    };
    root.pose({});
    return root;
  };
  K3.voxelHuman = (T, o = {}) => K3.human(T, Object.assign({ voxel: true }, o));

  // Cône de lumière volumétrique (shader additif) + vraie SpotLight
  K3.volumetric = function (T, o = {}) {
    const g = new T.Group();
    const h = o.length || 9, r = o.radius || 2.2, col = new T.Color(o.color ?? 0xfff2d8);
    const geo = new T.CylinderGeometry(o.top ?? .08, r, h, 64, 20, true); geo.translate(0, -h / 2, 0);
    const mat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uColor: { value: col }, uInt: { value: o.intensity ?? .55 }, uLen: { value: h } },
      vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 uColor; uniform float uInt; uniform float uLen; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float k = 1. - clamp(vY/uLen,0.,1.); float e = pow(abs(dot(vN,vV)), 2.0); gl_FragColor = vec4(uColor * uInt * k*k * e, 1.); }',
    });
    const cone = new T.Mesh(geo, mat); g.add(cone);
    const spot = new T.SpotLight(col, o.power ?? 3.2, h * 1.6, Math.atan(r / h) * 1.15, .55, 1.2);
    spot.castShadow = o.shadow !== false; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0008;
    spot.position.set(0, 0, 0); const tgt = new T.Object3D(); tgt.position.set(0, -h, 0); g.add(tgt); spot.target = tgt; g.add(spot);
    g.userData = { cone, spot, mat, tgt };
    g.setIntensity = k => { mat.uniforms.uInt.value = (o.intensity ?? .55) * k; spot.intensity = (o.power ?? 3.2) * k; };
    return g;
  };
  // Typographie XXL dans le décor 3D (texture canvas)
  K3.textPlane = function (T, text, o = {}) {
    const cv = document.createElement('canvas'); const fs = o.fontSize || 220, font = `${o.weight || ''} ${fs}px '${o.font || 'Anton'}'`;
    const c0 = cv.getContext('2d'); c0.font = font; const w = Math.ceil(c0.measureText(text).width + fs * .4);
    cv.width = w; cv.height = Math.ceil(fs * 1.35); const c = cv.getContext('2d'); c.font = font; c.textBaseline = 'middle';
    if (o.gradient) { const gr = c.createLinearGradient(0, 0, 0, cv.height); o.gradient.forEach(([k, col]) => gr.addColorStop(k, col)); c.fillStyle = gr; } else c.fillStyle = o.color || '#fff';
    if (o.stroke) { c.lineWidth = o.strokeWidth || 10; c.strokeStyle = o.stroke; c.strokeText(text, fs * .2, cv.height / 2); }
    c.fillText(text, fs * .2, cv.height / 2);
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
    const hgt = o.height || 1, mat = new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: T.DoubleSide });
    const m = new T.Mesh(new T.PlaneGeometry(hgt * cv.width / cv.height, hgt), mat);
    m.userData.mat = mat; return m;
  };
  // Texture de façade (fenêtres allumées / éteintes)
  K3.windowsTexture = function (T, { cols = 6, rows = 12, lit = .4, seed = 1, color = '#ffcf7a', wall = '#1a1d2b' } = {}) {
    const cv = document.createElement('canvas'); cv.width = cols * 32; cv.height = rows * 32; const c = cv.getContext('2d');
    c.fillStyle = wall; c.fillRect(0, 0, cv.width, cv.height); const r = C.rng('win' + seed);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { c.fillStyle = r() < lit ? color : '#0b0c12'; c.fillRect(x * 32 + 8, y * 32 + 8, 16, 18); }
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.magFilter = T.NearestFilter; return tex;
  };
  // Petite ville low-poly le long d'une route (axe z)
  K3.lowpolyCity = function (T, o = {}) {
    const g = new T.Group(), r = C.rng('city' + (o.seed || 1)), len = o.length || 160;
    const road = new T.Mesh(new T.PlaneGeometry(o.roadWidth || 8, len), new T.MeshStandardMaterial({ color: o.road || 0x15161d, roughness: .35, metalness: .3 }));
    road.rotation.x = -Math.PI / 2; road.position.z = -len / 2 + 20; road.receiveShadow = true; g.add(road);
    const side = new T.Mesh(new T.PlaneGeometry(80, len), new T.MeshStandardMaterial({ color: o.ground || 0x0d0e14, roughness: .9 }));
    side.rotation.x = -Math.PI / 2; side.position.set(0, -.01, -len / 2 + 20); side.receiveShadow = true; g.add(side);
    const dashM = new T.MeshBasicMaterial({ color: o.line || 0xf2e6b0 });
    for (let z = 18; z > -len + 20; z -= 5) { const d = new T.Mesh(new T.PlaneGeometry(.18, 2.2), dashM); d.rotation.x = -Math.PI / 2; d.position.set(0, .01, z); g.add(d); }
    const pal = o.palette || [0x2a2f45, 0x3a3350, 0x232838, 0x40354a];
    for (let z = 16; z > -len + 20; z -= 7 + r() * 4) for (const sgn of [-1, 1]) {
      const w = 4 + r() * 4, hgt = 4 + r() * (o.maxH || 22), d = 5 + r() * 3;
      const tex = K3.windowsTexture(T, { cols: Math.max(2, Math.round(w)), rows: Math.max(3, Math.round(hgt / 1.6)), lit: .25 + r() * .35, seed: Math.floor(r() * 1e6) });
      const m = new T.Mesh(new T.BoxGeometry(w, hgt, d), [0, 1, 2, 3, 4, 5].map(i => new T.MeshStandardMaterial({ color: pal[Math.floor(r() * pal.length)], roughness: .8, flatShading: true,
        map: (i === 0 || i === 1 || i === 4) ? tex : null, emissive: 0xffffff, emissiveMap: (i === 0 || i === 1 || i === 4) ? tex : null, emissiveIntensity: (i === 0 || i === 1 || i === 4) ? .9 : 0 })));
      m.position.set(sgn * ((o.roadWidth || 8) / 2 + 2.5 + w / 2 + r() * 2), hgt / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    return g;
  };
  K3.streetLight = function (T, o = {}) {
    const g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0x22232b, roughness: .6 });
    const pole = new T.Mesh(new T.CylinderGeometry(.07, .09, 5.5, 8), m); pole.position.y = 2.75; g.add(pole);
    const arm = new T.Mesh(new T.BoxGeometry(1.4, .08, .08), m); arm.position.set((o.dir || 1) * .7, 5.45, 0); g.add(arm);
    const bulb = new T.Mesh(new T.SphereGeometry(.16, 12, 8), new T.MeshBasicMaterial({ color: o.color || 0xffcf7a })); bulb.position.set((o.dir || 1) * 1.35, 5.35, 0); g.add(bulb);
    if (o.light !== false) { const pl = new T.PointLight(o.color || 0xffcf7a, o.power ?? 1.6, 14, 1.6); pl.position.copy(bulb.position); g.add(pl); }
    return g;
  };
  K3.lowpolyCar = function (T, o = {}) {
    const g = new T.Group(), body = new T.MeshStandardMaterial({ color: o.color ?? 0xd8262f, roughness: .35, metalness: .45, flatShading: true });
    const dark = new T.MeshStandardMaterial({ color: 0x0c0d12, roughness: .4, metalness: .2, flatShading: true });
    const b = new T.Mesh(new T.BoxGeometry(1.9, .55, 4.2), body); b.position.y = .55; b.castShadow = true; g.add(b);
    const cab = new T.Mesh(new T.CylinderGeometry(.75, 1.05, .55, 4, 1), dark); cab.rotation.y = Math.PI / 4; cab.scale.set(1.25, 1, 1.9); cab.position.set(0, 1.08, -.2); cab.castShadow = true; g.add(cab);
    const wheels = []; for (const [x, z] of [[-.95, 1.35], [.95, 1.35], [-.95, -1.35], [.95, -1.35]]) { const w = new T.Mesh(new T.CylinderGeometry(.36, .36, .3, 10), dark); w.rotation.z = Math.PI / 2; w.position.set(x, .36, z); g.add(w); wheels.push(w); }
    const hl = new T.MeshBasicMaterial({ color: 0xfff6dc }), tl = new T.MeshBasicMaterial({ color: 0xff2a2a });
    for (const x of [-.65, .65]) { const a = new T.Mesh(new T.BoxGeometry(.35, .14, .05), hl); a.position.set(x, .62, -2.11); g.add(a); const b2 = new T.Mesh(new T.BoxGeometry(.35, .12, .05), tl); b2.position.set(x, .66, 2.11); g.add(b2); }
    const beam = new T.SpotLight(0xfff2d0, 4, 40, .45, .5, 1.3); beam.position.set(0, .7, -2.2); const tg = new T.Object3D(); tg.position.set(0, 0, -14); g.add(tg); beam.target = tg; beam.castShadow = false; g.add(beam);
    g.userData = { wheels }; return g;
  };
  // Contre-jour : halo de fond + lumières de découpe (pour lire des silhouettes noires sur fond noir)
  K3.backdrop = function (T, o = {}) {
    const g = new T.Group(), cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
    const gr = c.createRadialGradient(128, 150, 0, 128, 150, 128); gr.addColorStop(0, o.color || '#3a4a7a'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding;
    const pl = new T.Mesh(new T.PlaneGeometry(o.w || 60, o.h || 34), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, toneMapped: false })); pl.position.set(0, (o.h || 34) * .32, o.z ?? -22); g.add(pl);
    [-1, 1].forEach(sgn => { const d = new T.DirectionalLight(o.rim || 0x8aa6ff, o.rimPower ?? 1.4); d.position.set(sgn * 6, 7, (o.z ?? -22) * .6); g.add(d); });
    return g;
  };
  C.K3 = K3;
})();
