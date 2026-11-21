/* HFS.boot — amorçage commun d'une scène générée depuis le storyboard (SceneTemplates).
 * HFS.boot('s03', CFG, (sc, ctx) => { … décor, personnages, objets, caméra … });
 *   ctx = { stage, txt, layer(name), cfg } ; texte, transitions d'entrée/sortie et enregistrement de la
 *   timeline sont faits ici, APRÈS le chargement des polices (puis la timeline est enregistrée en dernier). */
(function () {
  const HFS = window.HFS;
  HFS.boot = function (id, CFG, build) {
    // précharge les polices utilisées AVANT toute mesure (sinon la mesure se fait sur la police de secours)
    const fams = (CFG.fonts || []).map(f => document.fonts.load(`80px '${f}'`).catch(() => null));
    Promise.all(fams).then(() => HFS.ready(() => {
      HFS.ensureDefs();
      const sc = HFS.scene(id, { dur: CFG.dur, t0: CFG.t0 });
      const stage = document.getElementById(id + '-stage'), txt = document.getElementById(id + '-txt');
      const Q = CFG.cues || {};
      const ctx = { stage, txt, cfg: CFG, P: CFG.params || {}, Q, layer: n => document.getElementById(id + '-' + n),
        // repères synchronisés sur les mots chantés (temps locaux) : ctx.cue('panne', 0, repli) ; ctx.since(t, 'gars') ; ctx.count(t, 'bulle')
        cue: (name, i = 0, fb = null) => (Q[name] && Q[name][i] != null ? Q[name][i] : fb),
        since: (t, name) => { const a = (Q[name] || []).filter(x => x <= t); return a.length ? t - a[a.length - 1] : -1; },
        count: (t, name) => (Q[name] || []).filter(x => x <= t).length,
        pulse: (t, name, decay = 8) => { const a = (Q[name] || []).filter(x => x <= t); return a.length ? Math.exp(-(t - a[a.length - 1]) * decay) : 0; } };
      build(sc, ctx);
      ctx.kt = HFS.sceneText(sc, txt, CFG.text);
      if (CFG.tin && CFG.tin.kind && CFG.tin.kind !== 'cut') HFS.transitions.apply(sc, 'in', CFG.tin.kind, CFG.tin);
      if (CFG.tout && CFG.tout.kind && CFG.tout.kind !== 'cut') HFS.transitions.apply(sc, 'out', CFG.tout.kind, Object.assign({}, CFG.tout, ctx.outTarget ? ctx.outTarget() : {}));
      sc.finish();
    }));
  };
})();
