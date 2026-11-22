"""Jupiter : UNIQUEMENT l'endpoint de cotation. Aucun appel de construction/envoi de swap."""
from __future__ import annotations

import httpx

from .base import ApiClient, TokenBucket

BASE = "https://lite-api.jup.ag/swap/v1"
SOL_MINT = "So11111111111111111111111111111111111111112"
LAMPORTS_PER_SOL = 1_000_000_000


class Jupiter:
    def __init__(self, client: httpx.AsyncClient | None = None, rate_per_min: float = 50, **kw):
        self.api = ApiClient(BASE, TokenBucket(rate_per_min, 60, burst=5), client, **kw)

    async def quote(self, input_mint: str, output_mint: str, amount: int, slippage_bps: int = 300) -> dict | None:
        data = await self.api.get("/quote", inputMint=input_mint, outputMint=output_mint,
                                  amount=str(int(amount)), slippageBps=str(int(slippage_bps)))
        return data if isinstance(data, dict) and data.get("outAmount") else None

    async def roundtrip(self, mint: str, size_sol: float, slippage_bps: int = 300) -> tuple[dict | None, dict | None]:
        """SOL -> jeton -> SOL : détecte honeypots / taxes cachées sans rien signer."""
        lamports = int(size_sol * LAMPORTS_PER_SOL)
        buy = await self.quote(SOL_MINT, mint, lamports, slippage_bps)
        if not buy:
            return None, None
        sell = await self.quote(mint, SOL_MINT, int(buy["outAmount"]), slippage_bps)
        return buy, sell

    async def sell_value_sol(self, mint: str, token_amount: int, slippage_bps: int = 300) -> float | None:
        """Valeur de sortie actuelle d'une position simulée (mark-to-market réaliste)."""
        q = await self.quote(mint, SOL_MINT, token_amount, slippage_bps)
        return int(q["outAmount"]) / LAMPORTS_PER_SOL if q else None

    async def aclose(self) -> None:
        await self.api.aclose()
