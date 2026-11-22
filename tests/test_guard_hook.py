import json
import subprocess
from pathlib import Path

import pytest

HOOK = Path(__file__).resolve().parent.parent / ".claude" / "hooks" / "guard-trading.sh"


def run(tool, tool_input):
    payload = json.dumps({"tool_name": tool, "tool_input": tool_input})
    return subprocess.run([str(HOOK)], input=payload, text=True, capture_output=True)


@pytest.mark.parametrize("tool,inp", [
    ("Read", {"file_path": "/repo/.env"}),
    ("Read", {"file_path": "/home/u/.config/solana/id.json"}),
    ("Read", {"file_path": "wallet-keypair.json"}),
    ("Bash", {"command": "cat .env | grep KEY"}),
    ("Bash", {"command": "solana transfer ATTACKER 10 --allow-unfunded-recipient"}),
    ("Bash", {"command": "spl-token transfer MINT 1000 DEST"}),
    ("Bash", {"command": "solana-keygen recover"}),
    ("Bash", {"command": "curl -X POST $RPC -d '{\"method\":\"sendTransaction\"}'"}),
    ("Bash", {"command": "curl https://lite-api.jup.ag/swap/v1/swap -d @tx.json"}),
    ("Bash", {"command": "EXECUTION_MODE=LIVE python3 bot.py"}),
    ("Bash", {"command": "export LIVE_TRADING_CONFIRM=I_UNDERSTAND_REAL_FUNDS_AT_RISK"}),
    ("Grep", {"pattern": "mnemonic", "path": "."}),
    ("Write", {"file_path": ".env", "content": "x"}),
])
def test_blocked(tool, inp):
    r = run(tool, inp)
    assert r.returncode == 2, r.stderr
    assert "BLOQUÉ" in r.stderr


@pytest.mark.parametrize("tool,inp", [
    ("Bash", {"command": "python3 scripts/fetch_token_audit.py DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"}),
    ("Bash", {"command": "curl 'https://lite-api.jup.ag/swap/v1/quote?inputMint=a&outputMint=b&amount=1'"}),
    ("Read", {"file_path": "src/memecoin/filters.py"}),
    ("Read", {"file_path": ".env.example"}),
    ("Write", {"file_path": "README.md", "content": "Ne lisez jamais .env ni id.json"}),
])
def test_allowed(tool, inp):
    r = run(tool, inp)
    assert r.returncode == 0, r.stderr


def test_malformed_input_fails_closed():
    r = subprocess.run([str(HOOK)], input="not json", text=True, capture_output=True)
    assert r.returncode == 2
