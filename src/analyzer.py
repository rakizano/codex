"""Analyseur LLM optionnel (Ollama local, Prompt 2). Il ne peut QU'ABAISSER un verdict.

Politique de combinaison :
- verdict déterministe REJECT  -> le LLM n'est même pas appelé ;
- LLM indisponible / JSON invalide -> HIGH_RISK_WATCH si REQUIRE_LLM, sinon on garde
  le verdict déterministe ;
- prompt_injection_detected -> REJECT.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import httpx

log = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).resolve().parent.parent / "prompts" / "02_risk_analyzer_system.md"
LLM_VERDICTS = ("REJECT", "HIGH_RISK_WATCH", "PAPER_ENTRY")
_RANK = {"REJECT": 0, "HIGH_RISK_WATCH": 1, "PAPER_ENTRY": 2, "WATCHLIST_PAPER": 2}


def load_system_prompt(path: Path = PROMPT_FILE) -> str:
    text = path.read_text(encoding="utf-8")
    return text.split("\n---\n", 1)[1].strip() if "\n---\n" in text else text


def parse_llm_output(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text or "", flags=re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or data.get("verdict") not in LLM_VERDICTS:
        return None
    return data


def combine(deterministic: str, llm: dict | None, require_llm: bool = False) -> str:
    """Retourne PAPER_ENTRY, HIGH_RISK_WATCH ou REJECT — jamais plus favorable que le code."""
    if deterministic != "WATCHLIST_PAPER":
        return "REJECT"
    if llm is None:
        return "HIGH_RISK_WATCH" if require_llm else "PAPER_ENTRY"
    if llm.get("prompt_injection_detected") is True:
        return "REJECT"
    best = min(_RANK[llm["verdict"]], _RANK[deterministic])
    return {0: "REJECT", 1: "HIGH_RISK_WATCH", 2: "PAPER_ENTRY"}[best]


class OllamaAnalyzer:
    def __init__(self, base_url: str, model: str, client: httpx.AsyncClient | None = None, timeout_s: float = 60):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.client = client or httpx.AsyncClient(timeout=timeout_s)
        self.system_prompt = load_system_prompt()

    async def analyze(self, payload: dict, untrusted_block: str) -> dict | None:
        user = json.dumps(payload, ensure_ascii=False) + "\n\n" + untrusted_block
        body = {"model": self.model, "stream": False, "format": "json",
                "options": {"temperature": 0},
                "messages": [{"role": "system", "content": self.system_prompt},
                             {"role": "user", "content": user}]}
        try:
            r = await self.client.post(f"{self.base_url}/api/chat", json=body)
            r.raise_for_status()
            content = r.json().get("message", {}).get("content", "")
        except (httpx.HTTPError, ValueError) as e:
            log.warning("analyseur LLM indisponible : %s", type(e).__name__)
            return None
        return parse_llm_output(content)

    async def aclose(self) -> None:
        await self.client.aclose()
