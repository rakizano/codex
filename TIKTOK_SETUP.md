# Clips → brouillons TikTok, avec la musique (configuration depuis un iPad)

Une fois configuré, le circuit est entièrement automatique :

```
/clip-tiktok Artiste – Titre   +  le fichier audio du morceau joint dans la conversation
        │
        ▼  Claude : clip animé → ajout de la musique au bon timestamp → push GitHub
        ▼  GitHub Actions : envoi dans votre boîte de réception TikTok (API officielle)
        ▼  TikTok : notification « Votre vidéo est prête » → vous ouvrez → « Publier »
```

Rien n'est publié sans vous : la vidéo arrive comme brouillon à finaliser (API TikTok
« Content Posting – Upload », scope `video.upload`).

---

## 1. Créer l'application TikTok (une fois, ~15 min, gratuit)

Dans Safari : **developers.tiktok.com** → se connecter avec votre compte TikTok.

1. **Manage apps → Connect an app** (type individuel). Donnez un nom (ex. « Mes clips »).
2. Dans l'app, **Add products** : ajoutez **Login Kit** et **Content Posting API**.
3. **Scopes** : cochez `user.info.basic` et `video.upload`.
4. **Login Kit → Redirect URI** (plateforme *Web*) : `https://github.com/rakizano/codex`
5. **Sandbox** : créez un sandbox, puis **Sandbox settings → Target users** → ajoutez votre compte
   TikTok. Le mode sandbox suffit pour envoyer sur votre propre compte, sans audit de l'app.
6. Notez la **Client key** et le **Client secret** du sandbox.

> Si TikTok exige une « review » pour `video.upload` sur votre compte, il faudra soumettre l'app
> (URL de site, conditions d'utilisation, politique de confidentialité, vidéo de démo). Je peux
> préparer ces pages et la vidéo de démo si besoin.

## 2. Préparer GitHub (une fois, ~5 min)

Dans Safari : **github.com** (connecté).

1. **Jeton d'accès** : avatar → *Settings* → *Developer settings* → *Personal access tokens* →
   *Fine-grained tokens* → *Generate new token* :
   - Repository access : **Only select repositories → rakizano/codex**
   - Permissions → Repository permissions → **Secrets : Read and write**
   - Expiration : 1 an. Copiez le jeton.
2. Dépôt **rakizano/codex** → *Settings* → *Secrets and variables* → *Actions* →
   *New repository secret*, créez :
   | Nom | Valeur |
   |---|---|
   | `TIKTOK_CLIENT_KEY` | Client key TikTok |
   | `TIKTOK_CLIENT_SECRET` | Client secret TikTok |
   | `GH_PAT` | le jeton GitHub de l'étape 1 |
   (`TIKTOK_REFRESH_TOKEN` sera créé automatiquement à l'étape 3.)
3. **Fusionner la branche** `claude/tiktok-music-clip-generator-7jaecq` dans `main`
   (GitHub n'affiche les workflows lançables à la main que sur la branche principale).
   Demandez-le simplement à Claude : « ouvre la pull request ».

## 3. Connecter votre compte TikTok (une fois ; à refaire si le jeton expire, ~1 an)

1. Ouvrez ce lien dans Safari en remplaçant `VOTRE_CLIENT_KEY` :
   ```
   https://www.tiktok.com/v2/auth/authorize/?client_key=VOTRE_CLIENT_KEY&scope=user.info.basic,video.upload&response_type=code&redirect_uri=https%3A%2F%2Fgithub.com%2Frakizano%2Fcodex&state=clip
   ```
2. Autorisez. Safari arrive sur la page GitHub du dépôt avec une adresse du type
   `https://github.com/rakizano/codex?code=XXXXXXXX&scopes=…&state=clip`.
   Copiez la valeur après `code=` jusqu'au `&` (le code expire vite : enchaînez).
3. GitHub → onglet **Actions** → **TikTok — connexion du compte** → *Run workflow* →
   collez le code → *Run workflow*. Résultat attendu : « ✅ Compte TikTok connecté ».

## 4. À chaque clip

1. Dans une session Claude (environnement **codex**) :
   `/clip-tiktok Artiste – Titre` **et joignez le fichier audio du morceau** (bouton trombone).
   - Il faut un fichier **sans DRM** de la **version album** : achat iTunes Store (m4a), Bandcamp,
     Qobuz, Amazon MP3… Les titres en streaming (Apple Music, Spotify, Deezer) ne sont pas exportables.
   - Pour un clip déjà fait : « ajoute la musique à clips/sdm-cartier-santos » + le fichier.
2. Claude ajoute la musique au timestamp exact (et recale automatiquement si l'audio est décalé),
   puis pousse `video_avec_musique.mp4` sur GitHub.
3. GitHub Actions l'envoie à TikTok (2-3 min). Sur l'iPad/iPhone : **notification TikTok** →
   ouvrir → (légende, hashtags) → **Publier**.

Suivi : GitHub → Actions → **TikTok — envoi en brouillon** (résumé ✅/❌ par vidéo).
Renvoyer un clip à la main : *Run workflow* avec le nom du dossier (ex. `sdm-cartier-santos`).

---

## ⚠️ Droits musicaux — à lire

Une musique **intégrée au fichier** est vue par TikTok comme un « son original » contenant une
œuvre protégée : TikTok peut **couper le son**, limiter la diffusion ou bloquer la vidéo, et le
morceau ne sera pas crédité ni cliquable. La solution la plus sûre reste d'envoyer la version
muette (`TIKTOK_UPLOAD_SILENT=true` dans *Settings → Secrets and variables → Actions → Variables*)
et d'ajouter le son officiel depuis la bibliothèque TikTok dans le brouillon (timestamp indiqué
dans `synchronisation.txt`). Les deux circuits sont disponibles ; le choix vous appartient.

## Ce qui a été testé

- Ajout de la musique : testé sur des pistes de synthèse (recalage automatique précis à ±0,02 s,
  refus d'une version de durée différente).
- Client TikTok : testé contre un serveur local qui reproduit l'API (OAuth, rotation du jeton,
  envoi en 1 ou 13 morceaux avec contrôle d'intégrité, statut `SEND_TO_USER_INBOX`).
- **Pas encore testé contre le vrai TikTok** : il faut vos identifiants. Si le premier envoi
  échoue, le résumé de l'action affiche le message exact de TikTok ; donnez-le à Claude.
