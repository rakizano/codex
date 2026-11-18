# FreeLLM API → Claude Code (sur ton ordinateur)

[FreeLLM API](https://github.com/tashfeenahmed/freellmapi) est un petit serveur qui rassemble les offres gratuites de dizaines de fournisseurs d'IA (Groq, Gemini, OpenRouter, NVIDIA…) derrière une seule adresse. Quand un modèle atteint sa limite, il passe automatiquement au suivant.

Il doit tourner **sur ton ordinateur** (ou un serveur à toi) : les sessions Claude Code dans le cloud utilisent toujours les modèles d'Anthropic.

## 1. Installer le serveur

**Windows** : installe l'application depuis le [Microsoft Store](https://apps.microsoft.com/detail/9PBN6G8K2B7F).
**macOS** : télécharge le `.dmg` sur la [page des versions](https://github.com/tashfeenahmed/freellmapi/releases/latest).
**Linux / Docker** :

```bash
curl -fsSL https://freellmapi.co/install.sh | bash
```

Puis ouvre le tableau de bord : http://localhost:3001 (application de bureau : icône dans la barre des tâches → *Open Dashboard*).

## 2. Ajouter des clés gratuites

Page **Keys** du tableau de bord. Crée des clés gratuites (sans carte bancaire), par exemple :

- Groq : https://console.groq.com/keys
- Google Gemini : https://aistudio.google.com/apikey
- OpenRouter : https://openrouter.ai/keys
- NVIDIA NIM : https://build.nvidia.com

Plus tu ajoutes de fournisseurs, plus la bascule automatique a de choix. L'ordre se règle sur la page **Fallback Chain**.

Copie ensuite ta **clé unifiée** (`freellmapi-…`) en haut de la page Keys.

## 3. Brancher Claude Code

```bash
export FREELLMAPI_API_KEY=freellmapi-ta-cle-unifiee
npx freellmapi setup-claude --url http://localhost:3001 --dry-run   # montre ce qui va changer
npx freellmapi setup-claude --url http://localhost:3001            # applique (avec sauvegarde)
```

Ou, sans écrire la clé dans un fichier de config : `npx freellmapi launch` (lance Claude Code directement branché sur le serveur).

Pour revenir aux modèles Claude normaux : restaure la sauvegarde créée par `setup-claude`, ou lance simplement `claude` au lieu de `npx freellmapi launch`.

## À savoir

- Les modèles gratuits sont nettement moins bons que Claude pour coder, et les skills (Lemo-Opuscar, Ponytail…) marcheront moins bien avec eux.
- Les offres gratuites changent souvent ; certaines (Gemini hors UE, routes gratuites d'OpenRouter) peuvent utiliser tes requêtes pour l'entraînement : pas de données sensibles.
- Le projet se décrit lui-même comme destiné à l'expérimentation, pas à la production.
