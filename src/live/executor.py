"""Exécution réelle des swaps — DÉSACTIVÉE par défaut.

Conditions cumulatives pour qu'un seul lamport bouge :
  1. EXECUTION_MODE=LIVE ;
  2. LIVE_TRADING_CONFIRM=I_UNDERSTAND_REAL_FUNDS_AT_RISK ;
  3. SOLANA_KEYPAIR_PATH pointant vers un wallet DÉDIÉ à faible solde ;
  4. taille <= LIVE_MAX_POSITION_SOL (0,05 SOL par défaut), slippage <= 300 bps ;
  5. coupe-circuit journalier non déclenché ;
  6. `simulateTransaction` sans erreur juste avant l'envoi.

Chaque transaction embarque un pourboire Jito et le compte read-only non
signataire `jitodontfront…` (atténuation du sandwich), puis part par le block
engine Jito. La clé privée n'est jamais journalisée ni transmise à un LLM.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import random
from dataclasses import dataclass
from pathlib import Path

import httpx
from solders.address_lookup_table_account import AddressLookupTable, AddressLookupTableAccount
from solders.hash import Hash
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.message import MessageV0
from solders.pubkey import Pubkey
from solders.system_program import TransferParams, transfer
from solders.transaction import VersionedTransaction

from config import LIVE, Settings
from fetchers.jupiter import LAMPORTS_PER_SOL, SOL_MINT
from tx_builder import JITO_DONT_FRONT, ExecutionDisabled, GuardrailViolation, TransactionBuilder

log = logging.getLogger(__name__)

CONFIRM_PHRASE = "I_UNDERSTAND_REAL_FUNDS_AT_RISK"
# Comptes de pourboire publiés par Jito (un est tiré au hasard à chaque transaction).
JITO_TIP_ACCOUNTS = (
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
)


@dataclass
class SwapResult:
    signature: str
    in_amount: int
    expected_out: int
    confirmed: bool


def load_keypair(path: str | Path) -> Keypair:
    """Charge un keypair au format JSON de solana-keygen (tableau de 64 octets)."""
    raw = json.loads(Path(path).expanduser().read_text())
    return Keypair.from_bytes(bytes(raw))


def _ix(d: dict) -> Instruction:
    return Instruction(Pubkey.from_string(d["programId"]), base64.b64decode(d["data"]),
                       [AccountMeta(Pubkey.from_string(a["pubkey"]), bool(a["isSigner"]), bool(a["isWritable"]))
                        for a in d["accounts"]])


def check_live_enabled(settings: Settings) -> None:
    if settings.execution_mode != LIVE:
        raise ExecutionDisabled("EXECUTION_MODE n'est pas LIVE")
    if settings.live_confirm != CONFIRM_PHRASE:
        raise ExecutionDisabled(f"LIVE_TRADING_CONFIRM doit valoir {CONFIRM_PHRASE}")
    if not settings.keypair_path:
        raise ExecutionDisabled("SOLANA_KEYPAIR_PATH manquant")


class LiveExecutor:
    def __init__(self, settings: Settings, rpc, jupiter, signer: Keypair,
                 client: httpx.AsyncClient, circuit_breaker=lambda: False,
                 confirm_attempts: int = 20, confirm_delay_s: float = 1.5, sleep=asyncio.sleep):
        check_live_enabled(settings)
        if not rpc.configured:
            raise ExecutionDisabled("un RPC (HELIUS_RPC_URL / CHAINSTACK_RPC_URL) est requis en LIVE")
        self.s, self.rpc, self.jup, self.signer, self.client = settings, rpc, jupiter, signer, client
        self.builder = TransactionBuilder(settings, circuit_breaker)
        self.confirm_attempts, self.confirm_delay_s, self._sleep = confirm_attempts, confirm_delay_s, sleep

    @property
    def pubkey(self) -> str:
        return str(self.signer.pubkey())

    # --- briques ----------------------------------------------------------------
    def _tip_instruction(self) -> Instruction:
        tip = transfer(TransferParams(from_pubkey=self.signer.pubkey(),
                                      to_pubkey=Pubkey.from_string(random.choice(JITO_TIP_ACCOUNTS)),
                                      lamports=self.s.jito_tip_lamports))
        # Le programme système ignore les comptes surnuméraires : on y accroche jitodontfront.
        return Instruction(tip.program_id, tip.data,
                           list(tip.accounts) + [AccountMeta(Pubkey.from_string(JITO_DONT_FRONT), False, False)])

    async def _lookup_tables(self, addresses: list[str]) -> list[AddressLookupTableAccount]:
        if not addresses:
            return []
        res = await self.rpc.call("getMultipleAccounts", [addresses, {"encoding": "base64"}])
        tables = []
        for addr, acc in zip(addresses, (res or {}).get("value") or []):
            if not acc:
                raise GuardrailViolation(f"table d'adresses introuvable : {addr}")
            table = AddressLookupTable.deserialize(base64.b64decode(acc["data"][0]))
            tables.append(AddressLookupTableAccount(Pubkey.from_string(addr), list(table.addresses)))
        return tables

    async def build_transaction(self, swap_ix: dict) -> VersionedTransaction:
        instructions = [_ix(i) for i in swap_ix.get("computeBudgetInstructions") or []]
        instructions += [_ix(i) for i in swap_ix.get("setupInstructions") or []]
        instructions.append(_ix(swap_ix["swapInstruction"]))
        if swap_ix.get("cleanupInstruction"):
            instructions.append(_ix(swap_ix["cleanupInstruction"]))
        instructions += [_ix(i) for i in swap_ix.get("otherInstructions") or []]
        instructions.append(self._tip_instruction())
        alts = await self._lookup_tables(swap_ix.get("addressLookupTableAddresses") or [])
        bh = await self.rpc.call("getLatestBlockhash", [{"commitment": "confirmed"}])
        msg = MessageV0.try_compile(self.signer.pubkey(), instructions, alts,
                                    Hash.from_string(bh["value"]["blockhash"]))
        return VersionedTransaction(msg, [self.signer])

    async def simulate(self, tx_b64: str) -> None:
        sim = await self.rpc.call("simulateTransaction", [tx_b64, {
            "encoding": "base64", "sigVerify": True, "commitment": "processed"}])
        TransactionBuilder.check_simulation(sim)

    async def send(self, tx_b64: str) -> str:
        body = {"jsonrpc": "2.0", "id": 1, "method": "sendTransaction",
                "params": [tx_b64, {"encoding": "base64"}]}
        r = await self.client.post(self.s.jito_url, json=body)
        data = r.json() if r.status_code == 200 else {}
        if "result" not in data:
            raise GuardrailViolation(f"envoi refusé par le block engine (HTTP {r.status_code})")
        return data["result"]

    async def wait_confirmation(self, signature: str) -> bool:
        for _ in range(self.confirm_attempts):
            res = await self.rpc.call("getSignatureStatuses", [[signature], {"searchTransactionHistory": False}])
            st = ((res or {}).get("value") or [None])[0]
            if st:
                if st.get("err") is not None:
                    raise GuardrailViolation(f"transaction {signature} échouée on-chain : {st['err']}")
                if st.get("confirmationStatus") in ("confirmed", "finalized"):
                    return True
            await self._sleep(self.confirm_delay_s)
        return False

    # --- swap complet ---------------------------------------------------------------
    async def swap(self, input_mint: str, output_mint: str, amount: int) -> SwapResult:
        plan = self.builder.plan_swap(input_mint, output_mint, amount)  # garde-fous communs
        if input_mint == SOL_MINT and amount > self.s.live_max_position_sol * LAMPORTS_PER_SOL:
            raise GuardrailViolation(f"taille {amount / LAMPORTS_PER_SOL} SOL > LIVE_MAX_POSITION_SOL")
        quote = await self.jup.quote(input_mint, output_mint, amount, plan.slippage_bps)
        if not quote:
            raise GuardrailViolation("aucun devis Jupiter")
        swap_ix = await self.jup.swap_instructions(quote, self.pubkey)
        if not swap_ix:
            raise GuardrailViolation("instructions de swap indisponibles")
        tx = await self.build_transaction(swap_ix)
        tx_b64 = base64.b64encode(bytes(tx)).decode()
        await self.simulate(tx_b64)
        signature = await self.send(tx_b64)
        log.warning("LIVE swap envoyé %s -> %s : %s", input_mint, output_mint, signature)
        confirmed = await self.wait_confirmation(signature)
        return SwapResult(signature, amount, int(quote["outAmount"]), confirmed)

    async def buy(self, mint: str, size_sol: float) -> SwapResult:
        size = min(size_sol, self.s.live_max_position_sol)
        return await self.swap(SOL_MINT, mint, int(size * LAMPORTS_PER_SOL))

    async def token_balance(self, mint: str) -> int:
        res = await self.rpc.call("getTokenAccountsByOwner",
                                  [self.pubkey, {"mint": mint}, {"encoding": "jsonParsed"}])
        total = 0
        for acc in (res or {}).get("value") or []:
            try:
                total += int(acc["account"]["data"]["parsed"]["info"]["tokenAmount"]["amount"])
            except (KeyError, TypeError, ValueError):
                continue
        return total

    async def sell_fraction(self, mint: str, fraction: float) -> SwapResult | None:
        """Vend `fraction` (0-1] du solde réel lu on-chain (prise de profit partielle)."""
        if not 0 < fraction <= 1:
            raise GuardrailViolation(f"fraction de vente invalide : {fraction}")
        balance = await self.token_balance(mint)
        amount = balance if fraction >= 1 else int(balance * fraction)
        if amount <= 0:
            return None
        return await self.swap(mint, SOL_MINT, amount)

    async def sell_all(self, mint: str) -> SwapResult | None:
        return await self.sell_fraction(mint, 1.0)


def build_live_executor(settings: Settings, rpc, jupiter, client: httpx.AsyncClient,
                        circuit_breaker=lambda: False) -> LiveExecutor:
    check_live_enabled(settings)
    return LiveExecutor(settings, rpc, jupiter, load_keypair(settings.keypair_path), client, circuit_breaker)
