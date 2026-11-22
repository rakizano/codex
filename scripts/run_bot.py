#!/usr/bin/env python3
"""Point d'entrée du bot (mode PAPER uniquement). Voir `src/bot.py`."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from bot import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
