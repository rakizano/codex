# Référence du moteur (engine/engine.js)

Cadre : 1080×1920 px. Zone de sécurité TikTok (texte et sujets clés) : x 70→900, y 230→1440.
En dessous de y≈1450 : légende + barre musique TikTok ; à droite de x≈910 : boutons. Les décors
peuvent déborder partout (sols, ciels), mais rien d'important ne doit s'y trouver.

## Écrire une scène

```js
CLIP.scene('s03', S => {
  const { E, h, kf, Ease, noise, rng, mix, clamp, lerp, smooth } = S;
  S.layer(0).add(E.sky(['#0f0d24', '#2a2452', '#c45a3c']));      // profondeur 0 = immobile
  S.layer(0.3).add(E.mountains({ y: 1250, color: '#3a2a3e', seed: 4 }));
  const L = S.layer(1);                                            // profondeur 1 = suit la caméra
  const m = E.figure({ x: 300, y: 1500, s: .9, action: 'walk', path: [[0, [200, 1500]], [3, [500, 1500]]] });
  L.add(m);
  const g = h('g', { fill: '#fff' }); L.g.appendChild(g);           // SVG libre
  S.update((t, p) => { g.setAttribute('opacity', p); });           // t = s locales, p = 0..1
  S.camera([[0, { x: 0, y: 0, zoom: 1 }], [1, { x: -40, y: 0, zoom: 1.12, rot: 2 }]], 'inOutSine', { shake: 0 });
});
```

- `S.layer(depth, attrs?)` → `{ g, depth, add(...items) }`. Parallaxe : un calque de profondeur d
  subit d×(déplacement caméra) et un zoom 1+(zoom−1)×d.
- `S.update(fn(t, p, S))` : animation libre, **pure en t** (t peut être négatif ou > durée pendant les transitions).
- `S.camera(keys, ease, {shake, shakeFreq})` : keys `[[p, {x, y, zoom, rot}], ...]`, p = progression 0..1.
- `S.boil(layer, 'rough'|'wobble', fps)` : trait « vivant » façon dessin animé à la main.
- `S.layer(depth, { blur: px })` : flou de profondeur de champ (plans éloignés 3-6 px, premier plan bokeh 6-8 px).
- `S.camera(keys, ease, { handheld: 0..2 })` : caméra portée subtile (1 par défaut, 0 pour un plan fixe).
- `S.key(item, 'nom', 'cut,ui,text,overlap')` : marque un sujet principal pour le contrôle de cadrage ; le 3e argument
  déclare une exception voulue (avant-bras qui entre par le bord, gros plan de visage, personnage tenant un objet…).
- `S.beat(t)` : impulsion 0..1 sur les pulsations (`storyboard.beats`), 0 si aucune.
- `S.dur`, `S.start`, `S.end`, `S.sb` (entrée du storyboard), `S.rng()` (aléatoire déterministe), `S.defs`.
- Un « item » est `{ el, update?(t, p) }`. `layer.add` accepte un item ou un élément SVG.
- Helpers : `h(tag, attrs, children)` crée du SVG ; `kf(t, [[t0, v0], [t1, v1]], ease)` interpole nombres,
  tableaux ou objets ; `noise(x, seed)` bruit lisse −1..1 ; `mix(c1, c2, k)` mélange de couleurs ;
  `Ease.*` (linear, inOutSine, outBack, outExpo, inOutCubic, outElastic…). `CLIP.mod(a, n)` modulo positif.
- Filtres partagés : `url(#glow)`, `url(#softblur)`, `url(#bigblur)`, `url(#rough0..2)`, `url(#wobble0..2)`, `url(#paper)`.

## Bibliothèque E.* (toutes animées quand c'est pertinent)

| Élément | Options principales |
|---|---|
| `E.sky(stops, {horizontal})` | dégradé plein cadre surdimensionné ; stops = couleurs ou `[offset, couleur]` |
| `E.radial(stops, {cx, cy, r, opacity})` | dégradé radial ; stop `[offset, couleur, opacité]` |
| `E.gradientDef(stops, vertical)` | renvoie `url(#id)` à utiliser comme fill |
| `E.sun({x,y,r,color,glow,pulse})` · `E.moon({x,y,r,color,phase,bg})` | astres avec halo |
| `E.stars({n,color,seed,area,twinkle})` | étoiles scintillantes |
| `E.clouds({n,y,spread,color,opacity,speed,scale,blur})` | nuages qui dérivent |
| `E.ridge/mountains/hills({y,amp,freq,color,seed,rough})` · `E.ground({y,color})` | reliefs procéduraux |
| `E.city({y,color,seed,minH,maxH,windows,lit,density,flicker})` | skyline, fenêtres qui clignotent |
| `E.sea({y,color,light,layers,amp,speed})` | vagues animées |
| `E.road({horizon,color,line,width,speed})` · `E.grid({horizon,color,bg,speed})` | route / grille rétro en perspective qui défile |
| `E.rain`, `E.snow`, `E.dust`, `E.fireflies`, `E.particles({n,color,size,area,drift,wobble,glow,twinkle})` | atmosphère |
| `E.rays({x,y,n,color,opacity,speed})` · `E.fog({y,height,color,opacity,speed})` | lumière, brume |
| `E.bokeh({n,colors,area,size,opacity})` · `E.splashes({y0,y1,n,color})` · `E.lightLeak({color,opacity,speed})` | profondeur, pluie au sol, voile lumineux |
| `E.tree({x,y,height,color,seed,depth,sway,leaves})` | arbre procédural qui ondule |
| `E.birds({n,x,y,speed,color,size})` | vol d'oiseaux qui battent des ailes |
| `E.clock({x,y,r,face,rim,hands,speed,start,numerals,roman,warp,ticking})` | horloge (warp = déformée) |
| `E.hourglass({x,y,s,glass,sand,frame,dur})` · `E.eye({x,y,r,iris,blinkEvery,look})` | objets symboliques |
| `E.spiral`, `E.rings`, `E.blob({x,y,r,color,wobble})` | formes psychédéliques / organiques |
| `E.lamp({x,y,height,color,light})` · `E.window({x,y,w,h,frame,glass})` | décor urbain / intérieur |
| `E.image(href, {x,y,w,h,from,to,dur})` | image raster (Ken Burns) si un visuel est fourni |
| `E.label(txt, {x,y,size,color,font,rotate,spacing})` | texte de décor (enseigne, graffiti) |
| `E.raw(svgString)` → `{el, q(sel), qa(sel)}` | n'importe quel SVG écrit à la main |
| `E.figure({...})` | personnage riggé (voir ci-dessous) · `E.crowd({n,y,s,color,action})` foule |

### Personnage `E.figure`
`{x, y (= pieds), s (échelle; 1 ≈ 350 px de haut), color, shade, outline, pose, action, speed, facing (1|-1),
hair ('long'|'bun'), hairColor, hat ('bowler'|'cap'|'hood'), hatColor, coat (true|couleur), bodyWidth, path, pathEase, anim(a, t)}`
- `pose` : stand, sad, sit, hug, reach, arms_up, lookup, kneel, fall, point, think — ou un objet d'angles
  `{lean, head, ua1, la1, ua2, la2, th1, sh1, th2, sh2}` (degrés, 0 = membre vers le bas, + = vers l'avant).
- `action` : idle, breathe, walk, run, sway, dance, float, tremble, reach, none.
- `path` : `[[t, [x, y]], ...]` pour déplacer le personnage ; `anim(a, t)` modifie les angles à chaque image.
- Repères utiles (s = échelle) : hanches à y − 176·s ; tête à y − 354·s ; main tendue (pose point) ≈ (x + 138·s, y − 286·s).
- Détails (actifs par défaut, `detail: false` pour les couper) : mains, chaussures (`shoe`), œil qui cligne (`face: false`
  pour une silhouette), ombre au sol (`shadow`, `shadowOpacity`), mèches et pans de manteau qui suivent le mouvement.
  `skin` colore tête et mains ; `hair: 'short'|'long'|'bun'`.
- Cadrage : chaque personnage est un sujet clé (`key: 'nom'`, `key: false` pour un figurant, `keyAllow: 'cut,ui,overlap'`).

## Typographie (storyboard → scenes[].lyrics[])
`{ text, red, start, end, song_t, pos, align, enter, emphasis, exit, size, width, rotate, follow, sing, words, typo:{...} }`
- `text` : paroles exactes ; `/` = retour à la ligne. `red` : mot (ou liste) affiché en rouge.
- `pos` : top (330) | upper (560) | center (860) | lower (1150) | bottom (1330) | `[x, y]`. Recalage automatique dans la zone de sécurité.
- `align` : left | center | right. `rotate` (deg). `follow` : 0..1, le texte suit la caméra (intégration 2.5D).
- `enter` (mot par mot) : pop, rise, drop, slide, blur, stamp, type, split, mask, drift, line.
- `emphasis` (mot rouge) : grow, late, shake, pulse, slidein, drop, reveal, glow, scramble, breathe, shrink, none.
- `exit` : fade, up, down, blur, zoom, shrink, none (`exitDur`).
- Timing des mots : réparti par syllabes sur `sing` secondes (défaut ≈ 0,2-0,24 s/syllabe) ; `words: [t...]` pour imposer.
- `style.typo` (défauts globaux) : font, color, red, size, redScale, redFont, weight, italic, case ('upper'|'none'|'lower'),
  spacing (em), lineHeight, shadow, redShadow, stroke, redStroke, box / redBox (étiquettes éditoriales), wordIn, sylDur, drift.

## Transitions (storyboard → scenes[].transition = entrée de la scène)
`{type, dur, align ('center'|'before'|'after'), ease, ...}`
cut · fade · dip {color} · flash · wipe {dir} · diagonal {angle} · iris {x,y} · ink {seed} · radial {x,y,ccw,color: aiguille visible} ·
shape {shape: diamond|star|hex|heart|triangle|square, rotate, color} · blinds {n, dir: vertical|horizontal} ·
push {dir} · slide {dir} · zoom · spin · whip {dir} · glitch · bar {dir, color, width, slant}.

## Effets globaux (style.fx) et fin
`grain` (0..0.15), `vignette` (0..0.8), `grade` (filtre CSS : "contrast(1.1) saturate(1.2) hue-rotate(-8deg)"),
`scanlines`, `halftone`, `tint` + `tintOpacity` + `tintBlend`, `paper`,
`pixelate` (taille d'un « pixel » en px, ex. 9 → mosaïque nette des illustrations ; le texte HTML reste net — prendre une police pixel
comme Pixelify Sans / Silkscreen / Press Start 2P) et `posterize` (niveaux par canal, ex. 6 → palette rétro). Avec `pixelate`,
dessiner des formes épaisses (traits ≥ 10 px, personnages s ≥ 0,8, `outline` noir 6-8 px) : les détails plus fins disparaissent.
Le rendu est environ 2× plus lent. `storyboard.outro = {dur, color, text: true}` : fondu final.
