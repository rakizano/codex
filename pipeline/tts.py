#!/usr/bin/env python3
"""Voix off locale et gratuite.

Usage: tts.py <episode_dir> [--engine kokoro|piper|espeak] [--voice NAME] [--speed X] [--audition]

Moteurs (du meilleur au plus simple) :
- kokoro : Kokoro-82M (ONNX, Apache-2.0), voix FR `ff_siwis`. Mélange possible :
           "ff_siwis:0.8,im_nicola:0.2". Modèles : pipeline/setup_voices.sh (GitHub).
- piper  : modèle .onnx local (voix Piper)
- espeak : espeak-ng + MBROLA (secours, robotique)

Améliorations de naturel :
- synthèse PHRASE PAR PHRASE (meilleure prosodie, minutage plus précis) ;
- pauses selon la ponctuation (, : … . ?) et `pause_before` par segment (respiration avant une révélation) ;
- `music_break` (s) après un segment : silence de voix où la musique joue seule ;
- chaîne de traitement « studio » : passe-haut, chaleur, présence, dé-essage, compression douce, petite pièce.

Produit dans <episode>/build/ : voice.wav, timeline.json (segments + mots), captions.srt
"""
import argparse, json, os, re, subprocess, sys, wave
import numpy as np

SR = 44100
GAP = {",": 0.12, ";": 0.2, ":": 0.28, "…": 0.4, ".": 0.32, "!": 0.32, "?": 0.42}
SEG_PAUSE = 0.45
POLISH = ("highpass=f=75,"
          "equalizer=f=180:t=q:w=1:g=2,"        # chaleur
          "equalizer=f=350:t=q:w=1.2:g=-2.5,"   # désempâte
          "equalizer=f=3200:t=q:w=1.5:g=2.5,"   # présence / intelligibilité
          "deesser=i=0.35:m=0.5:f=0.5,"
          "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2,"
          "aecho=0.85:0.6:22|37:0.05|0.03")      # petite pièce, très discrète
HERE = os.path.dirname(os.path.abspath(__file__))
_kokoro = None


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def kokoro():
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        d = os.path.expanduser(os.environ.get("VOICES_DIR", "~/voices"))
        _kokoro = Kokoro(f"{d}/kokoro-v1.0.onnx", f"{d}/voices-v1.0.bin")
    return _kokoro


def kokoro_style(spec):
    """'ff_siwis' ou 'ff_siwis:0.8,im_nicola:0.2' -> nom ou vecteur de style mélangé."""
    if ":" not in spec:
        return spec
    k = kokoro(); parts = [p.split(":") for p in spec.split(",")]
    tot = sum(float(w) for _, w in parts)
    return sum(k.get_voice_style(n) * (float(w) / tot) for n, w in parts)


def write_wav(path, x, sr):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((x * 32767).astype("<i2").tobytes())


def synth_raw(text, out, engine, voice, speed):
    """Synthèse brute d'une phrase -> wav (format natif du moteur)."""
    if engine == "kokoro":
        s, sr = kokoro().create(text, voice=kokoro_style(voice), speed=speed, lang="fr-fr")
        write_wav(out, s, sr)
    elif engine == "piper":
        p = subprocess.run([sys.executable, "-m", "piper", "-m", os.path.expanduser(voice), "-f", out,
                            "--length-scale", str(1 / speed)], input=text.encode(),
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if p.returncode:
            sys.exit(p.stderr.decode())
    else:
        run(["espeak-ng", "-v", voice, "-s", str(int(150 * speed)), "-p", "45", "-w", out, text])


def to_pcm(src, dst, polish=True):
    """Convertit en 44.1 kHz mono, retire les silences de bord, applique la chaîne studio."""
    af = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
    if polish:
        af += "," + POLISH
    run(["ffmpeg", "-y", "-i", src, "-ar", str(SR), "-ac", "1", "-af", af, dst])


def duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def sentences(text):
    """Découpe en phrases/propositions en gardant la ponctuation finale."""
    parts = re.findall(r"[^.!?…:]+[.!?…:]*", text)
    return [p.strip() for p in parts if p.strip()]


def silence(path, secs):
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{max(0.01, secs):.3f}", path])


def srt_time(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def resolve(a, cfg):
    engine = a.engine or cfg.get("engine", "espeak")
    voice = a.voice or cfg.get("voice", "mb-fr1")
    speed = a.speed or cfg.get("speed", 1.0)
    d = os.path.expanduser(os.environ.get("VOICES_DIR", "~/voices"))
    if engine == "kokoro" and not os.path.exists(f"{d}/kokoro-v1.0.onnx"):
        print("[tts] Kokoro absent -> repli piper", file=sys.stderr); engine, voice = "piper", cfg.get("piper_voice", "")
    if engine == "piper" and not os.path.exists(os.path.expanduser(voice)):
        print(f"[tts] modèle Piper absent ({voice}) -> repli espeak", file=sys.stderr); engine, voice = "espeak", "mb-fr1"
    return engine, voice, speed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--engine"); ap.add_argument("--voice"); ap.add_argument("--speed", type=float)
    ap.add_argument("--audition", action="store_true", help="auditions sur le hook (config auditions)")
    ap.add_argument("--raw", action="store_true", help="sans chaîne de traitement (comparaison)")
    a = ap.parse_args()

    cfg_path = os.path.join(HERE, "..", "config", "voice.json")
    cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
    engine, voice, speed = resolve(a, cfg)
    script = json.load(open(os.path.join(a.episode, "script.json")))
    build = os.path.join(a.episode, "build"); os.makedirs(build, exist_ok=True)
    tmp = os.path.join(build, "_tmp.wav")

    if a.audition:
        hook = script["segments"][0].get("tts", script["segments"][0]["text"])
        for spec in cfg.get("auditions", []):
            eng, name = spec.split("|", 1) if "|" in spec else ("piper" if spec.endswith(".onnx") else "espeak", spec)
            safe = re.sub(r"[^\w.-]+", "_", os.path.basename(name))
            out = os.path.join(build, f"audition_{eng}_{safe}.wav")
            synth_raw(hook, tmp, eng, name, speed); to_pcm(tmp, out, not a.raw); print(out)
        return

    parts, timeline, t, k = [], [], 0.0, 0
    for i, seg in enumerate(script["segments"]):
        pb = seg.get("pause_before", 0)
        if pb and i:
            p = os.path.join(build, f"_pb{i}.wav"); silence(p, pb); parts.append(p); t += pb
        seg_start = t
        spoken = sentences(seg.get("tts", seg["text"])); shown = sentences(seg["text"])
        if len(spoken) != len(shown):  # sécurité : minutage au niveau segment
            spoken, shown = [seg.get("tts", seg["text"])], [seg["text"]]
        words = []
        for sp, sh in zip(spoken, shown):
            out = os.path.join(build, f"s_{k:03}.wav"); k += 1
            synth_raw(sp, tmp, engine, voice, speed); to_pcm(tmp, out, not a.raw)
            d = duration(out); ws = re.findall(r"\S+", sh)
            tot = sum(len(w) + 2 for w in ws); cur = t
            for w in ws:
                wd = d * (len(w) + 2) / tot
                words.append({"w": w, "start": round(cur, 3), "end": round(cur + wd, 3)}); cur += wd
            parts.append(out); t += d
            g = GAP.get(sh.strip()[-1], 0.1)
            gp = os.path.join(build, f"g_{k:03}.wav"); silence(gp, g); parts.append(gp); t += g
        timeline.append({**seg, "start": round(seg_start, 3), "end": round(t, 3), "words": words})
        gap = SEG_PAUSE + seg.get("music_break", 0)
        sp_ = os.path.join(build, f"_seg{i}.wav"); silence(sp_, gap); parts.append(sp_); t += gap

    lst = os.path.join(build, "_concat.txt")
    open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", os.path.join(build, "voice.wav")])
    for f in os.listdir(build):
        if re.match(r"^(s_|g_|_pb|_seg|_tmp)", f): os.remove(os.path.join(build, f))

    breaks = [{"at": s["end"] + SEG_PAUSE * 0.5, "dur": s.get("music_break", 0)} for s in timeline if s.get("music_break")]
    meta = {"engine": engine, "voice": voice, "duration": round(t, 3), "music_breaks": breaks, "segments": timeline}
    json.dump(meta, open(os.path.join(build, "timeline.json"), "w"), ensure_ascii=False, indent=1)

    lines, n = [], 1
    for seg in timeline:
        ws = seg["words"]
        for j in range(0, len(ws), 4):
            g = ws[j:j + 4]
            lines.append(f"{n}\n{srt_time(g[0]['start'])} --> {srt_time(g[-1]['end'])}\n{' '.join(x['w'] for x in g)}\n"); n += 1
    open(os.path.join(build, "captions.srt"), "w").write("\n".join(lines))
    print(f"[tts] {engine}/{voice} durée voix = {t:.1f}s")


if __name__ == "__main__":
    main()
