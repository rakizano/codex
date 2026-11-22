#!/usr/bin/env bash
# Hook PreToolUse déterministe : bloque (exit 2 + motif sur stderr) tout appel d'outil
# qui toucherait aux secrets ou pourrait signer/envoyer une transaction.
# Fail-closed : toute erreur d'analyse bloque l'appel.
set -u

block() { echo "guard-trading: BLOQUÉ — $1" >&2; exit 2; }

command -v jq >/dev/null 2>&1 || block "jq introuvable (fail-closed)"

input="$(cat)" || block "lecture stdin impossible"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)" || block "JSON invalide"
[ -n "$tool" ] || block "tool_name absent"

# Pour les outils d'écriture, seul le chemin compte (le contenu peut légitimement citer
# ".env" dans de la doc). Pour les autres, on inspecte tous les champs texte.
case "$tool" in
  Write|Edit|MultiEdit|NotebookEdit) filter='[.tool_input.file_path // .tool_input.notebook_path // empty] | join("\n")' ;;
  *) filter='[.tool_input // {} | .. | strings] | join("\n")' ;;
esac
payload="$(printf '%s' "$input" | jq -r "$filter" 2>/dev/null)" || block "tool_input illisible"
lower="$(printf '%s' "$payload" | tr '[:upper:]' '[:lower:]')"

# 1. Secrets : .env, keypairs, mnémoniques
secret_re='(^|[/[:space:]"'"'"'=])\.env($|[.[:space:]"'"'"'])|id\.json|keypair[^/[:space:]]*\.json|mnemonic|seed[_-]?phrase|private[_-]?key|\.config/solana'
# Le gabarit public .env.example reste autorisé : on le retire avant la recherche.
scrubbed="$(printf '%s' "$lower" | sed 's/\.env\.example//g')"
if printf '%s' "$scrubbed" | grep -Eq "$secret_re"; then
  block "accès à un secret (.env / keypair / mnémonique) interdit"
fi

# 2. Signature / envoi de transactions (seulement pour les commandes shell et le web)
if [ "$tool" = "Bash" ] || [ "$tool" = "WebFetch" ]; then
  tx_re='solana[[:space:]]+transfer|spl-token[[:space:]]+transfer|solana-keygen|sendtransaction|sendrawtransaction|sendbundle|/swap/v1/swap([^-]|$)|/swap-instructions|execution_mode=live|live_trading_confirm|i_understand_real_funds_at_risk|--live([^-a-z]|$)'
  if printf '%s' "$lower" | grep -Eq "$tx_re"; then
    block "signature/envoi de transaction interdit (mode PAPER uniquement)"
  fi
fi

exit 0
