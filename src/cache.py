"""Cache clé/valeur SQLite avec TTL (utilisé notamment pour GeckoTerminal : 60 s)."""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path


class TTLCache:
    def __init__(self, path: str | Path = ":memory:"):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(str(path), check_same_thread=False)
        self._db.execute("CREATE TABLE IF NOT EXISTS cache (k TEXT PRIMARY KEY, v TEXT, exp REAL)")
        self._db.commit()

    def get(self, key: str, now: float | None = None):
        now = time.time() if now is None else now
        row = self._db.execute("SELECT v, exp FROM cache WHERE k=?", (key,)).fetchone()
        if not row or row[1] < now:
            return None
        return json.loads(row[0])

    def set(self, key: str, value, ttl_s: float, now: float | None = None) -> None:
        now = time.time() if now is None else now
        self._db.execute("REPLACE INTO cache (k, v, exp) VALUES (?, ?, ?)",
                         (key, json.dumps(value), now + ttl_s))
        self._db.commit()

    def close(self) -> None:
        self._db.close()
