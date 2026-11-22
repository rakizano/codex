#!/usr/bin/env bash
# Phase de test sur votre propre ordinateur (macOS / Linux) : gratuit, rien à louer.
# Usage : bash scripts/start_paper.sh        (Ctrl+C pour arrêter ; relançable à tout moment)
# Le bot reste en PAPER (aucun wallet) et redémarre tout seul en cas de coupure réseau.
set -u
cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
mkdir -p data
export EXECUTION_MODE=PAPER

# Empêche la mise en veille pendant que le bot tourne (macOS : caffeinate, Linux : systemd-inhibit).
KEEP_AWAKE=()
if command -v caffeinate >/dev/null 2>&1; then KEEP_AWAKE=(caffeinate -i)
elif systemd-inhibit --what=idle true >/dev/null 2>&1; then KEEP_AWAKE=(systemd-inhibit --what=idle:sleep --why=paper-bot)
fi

trap 'echo; echo "Arrêt. Bilan : .venv/bin/python scripts/run_bot.py report"; exit 0' INT
while true; do
  ${KEEP_AWAKE[@]+"${KEEP_AWAKE[@]}"} .venv/bin/python scripts/run_bot.py run 2>&1 | tee -a data/bot.log
  echo "Le bot s'est arrêté ; redémarrage dans 30 s (Ctrl+C pour quitter)"
  sleep 30
done
