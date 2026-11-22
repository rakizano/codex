@echo off
REM Phase de test sur votre propre PC Windows : gratuit, rien a louer.
REM Double-cliquez ce fichier. Le bot reste en PAPER (aucun wallet) et redemarre tout seul.
REM Pensez a desactiver la mise en veille (Parametres > Alimentation) pendant le test.
cd /d "%~dp0\.."
if not exist .venv (
  py -3 -m venv .venv || python -m venv .venv
  .venv\Scripts\pip install -q -r requirements.txt
)
if not exist data mkdir data
set EXECUTION_MODE=PAPER
:loop
.venv\Scripts\python scripts\run_bot.py run
echo Le bot s'est arrete ; redemarrage dans 30 s (fermez la fenetre pour quitter)
timeout /t 30 >nul
goto loop
