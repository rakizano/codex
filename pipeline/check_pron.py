#!/usr/bin/env python3
"""Affiche la prononciation (IPA espeak-ng, même phonémiseur que Piper) des mots à majuscule
et des champs `tts` d'un script, pour repérer les noms propres mal prononcés sans écouter.
Usage: check_pron.py episodes/<slug>"""
import json, re, subprocess, sys
d = json.load(open(sys.argv[1] + "/script.json"))
seen = set()
for s in d["segments"]:
    src = s.get("tts", s["text"])
    for w in re.findall(r"\b[A-ZÀ-Ý][\w'’-]+(?:\s[A-ZÀ-Ý][\w-]+)*", src):
        if w in seen or w.split("'")[0] in ("Le", "La", "Les", "Et", "Dans", "Mais", "Alors", "Tu", "Pas", "Celle", "Dis-moi", "Écoute", "Sorti", "D"): continue
        seen.add(w)
        ipa = subprocess.run(["espeak-ng", "-q", "--ipa", "-v", "fr", w], capture_output=True, text=True).stdout.strip()
        print(f"{s['id']:<9} {w:<28} {ipa}")
