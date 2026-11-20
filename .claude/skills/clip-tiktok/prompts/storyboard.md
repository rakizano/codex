# Écrire le storyboard et les scènes

## Principes de narration (grammaire de la vidéo de référence décrite par l'utilisateur)
- **Les paroles font naître les images** : chaque phrase (ou demi-phrase si elle est longue) = un nouveau tableau.
  L'image illustre le SENS de la phrase (littéral, métaphorique ou ironique), pas un décor générique.
- Continuité : un personnage, un lieu ou un objet récurrent relie les tableaux ; mais chaque scène change
  au moins deux de : décor, cadrage (plan large / moyen / gros plan / plongée / contre-plongée), situation,
  personnage, palette locale, échelle.
- Rythme : alterner plans larges et gros plans ; scènes calmes et scènes denses ; positions du texte.
- Le texte est un élément de composition : le placer dans l'espace négatif (ciel, mur, sol), jamais sur le
  visage ou le sujet principal ; varier top/upper/lower/bottom, alignements gauche/centre, rotations légères.
- Mot rouge : le mot porteur d'émotion ou de sens (verbe d'action, objet-symbole, émotion, nom propre clé).
  Son emphase raconte quelque chose (SHORTER rétrécit, DEATH arrive en retard, SCRIBBLED tremble).
- Toujours du mouvement : caméra + au moins un élément vivant (personnage, particules, objet) par scène.
- Fin : une image qui résonne (respiration, éloignement, arrêt) + `outro` (fondu) sur la dernière note.

## Fiche par scène (storyboard.json → scenes[])
```json
{ "id": "s04", "start": 14.34, "end": 18.42,
  "lyrics": [{ "text": "Plans that / either come / to naught", "red": "naught", "start": 14.46, "end": 18.4,
               "song_t": 331.65, "pos": "top", "align": "left", "enter": "rise", "emphasis": "reveal" }],
  "visual": "Plan d'architecte bleu d'une maison idéale qui se dessine puis se désagrège en poussière.",
  "camera": "plongée zénithale, dérive", "animation": "tracés qui apparaissent puis se dissolvent",
  "transition": { "type": "blinds", "dur": 0.6, "n": 9 } }
```
- Les temps sont relatifs au début du passage. Les scènes sont contiguës (0 → durée).
- `transition` = transition d'ENTRÉE de la scène, centrée sur `start` par défaut (0,4-0,8 s ; cut = accent).
- Plusieurs segments de paroles dans une scène sont possibles (`lyrics` = liste) pour un débit rapide,
  mais la scène doit alors évoluer visuellement (caméra, transformation) entre les segments.
- Scènes instrumentales (intro/pont) : pas de paroles, mais une image forte et un mouvement marqué.

## Checklist avant rendu
- [ ] Chaque scène a une `visual` distincte et une illustration correspondante dans scenes.js.
- [ ] Mots rouges variés et pertinents ; pas toujours le dernier mot.
- [ ] Positions du texte variées et lisibles (contraste, ombre, pas de sujet derrière).
- [ ] Transitions variées, synchronisées sur la musique (début des phrases, accents, silences).
- [ ] Revue des images fixes faite avec l'outil Read, défauts corrigés.
