#!/usr/bin/env python3
"""Voix off locale et gratuite.

Usage: tts.py <episode_dir> [--engine piper|espeak] [--voice NAME] [--audition]

- piper : modèle .onnx local (ex. ~/voices/fr_FR-tom-medium.onnx)  -> qualité recommandée
- espeak: espeak-ng + MBROLA (fr1/fr4) -> voix provisoire, toujours disponible

Produit dans <episode>/build/ : voice.wav, timeline.json (segments + mots), captions.srt
Le minutage des mots est réparti proportionnellement dans chaque segment ;
si faster-whisper et un modèle sont disponibles, `align.py` le remplace par un alignement réel.
"""
import argparse, json, os, re, subprocess, sys, wave, shutil

SR = 22050
PAUSE = 0.35  # silence entre segments (s)


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def synth(text, out, engine, voice, speed):
    if engine == "piper":
        model = os.path.expanduser(voice)
        p = subprocess.run([sys.executable, "-m", "piper", "-m", model, "-f", out,
                            "--length-scale", str(1 / speed)], input=text.encode(),
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        if p.returncode:
            sys.exit(p.stderr.decode())
    else:
        tmp = out + ".raw.wav"
        run(["espeak-ng", "-v", voice, "-s", str(int(150 * speed)), "-p", "45", "-w", tmp, text])
        # normalise format + léger EQ pour adoucir la voix MBROLA
        run(["ffmpeg", "-y", "-i", tmp, "-ar", str(SR), "-ac", "1",
             "-af", "highpass=f=70,lowpass=f=7500,acompressor=threshold=-18dB:ratio=3,volume=1.4", out])
        os.remove(tmp)


def duration(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def words_of(text):
    return re.findall(r"\S+", text)


def srt_time(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--engine", default=None)
    ap.add_argument("--voice", default=None)
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--audition", action="store_true", help="3 auditions sur le hook")
    a = ap.parse_args()

    cfg_path = os.path.join(os.path.dirname(__file__), "..", "config", "voice.json")
    cfg = json.load(open(cfg_path)) if os.path.exists(cfg_path) else {}
    engine = a.engine or cfg.get("engine", "espeak")
    voice = a.voice or cfg.get("voice", "mb-fr1")
    speed = a.speed if a.speed != 1.0 else cfg.get("speed", 1.0)
    if engine == "piper" and not os.path.exists(os.path.expanduser(voice)):
        print(f"[tts] modèle Piper absent ({voice}) -> repli espeak", file=sys.stderr)
        engine, voice = "espeak", "mb-fr1"

    script = json.load(open(os.path.join(a.episode, "script.json")))
    build = os.path.join(a.episode, "build"); os.makedirs(build, exist_ok=True)

    if a.audition:
        hook = script["segments"][0].get("tts", script["segments"][0]["text"])
        for name in cfg.get("auditions", ["mb-fr1", "mb-fr6", "mb-fr4"]):
            eng = "piper" if name.endswith(".onnx") else "espeak"; name = os.path.expanduser(name)
            out = os.path.join(build, f"audition_{os.path.basename(name)}.wav")
            synth(hook, out, eng, name, speed); print(out)
        return

    parts, timeline, t = [], [], 0.0
    silence = os.path.join(build, "_sil.wav")
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", str(PAUSE), silence])
    for i, seg in enumerate(script["segments"]):
        out = os.path.join(build, f"seg_{i:02}_{seg['id']}.wav")
        synth(seg.get("tts", seg["text"]), out, engine, voice, speed)
        d = duration(out)
        ws = words_of(seg["text"]); total = sum(len(w) + 1 for w in ws); cur = t; words = []
        for w in ws:
            wd = d * (len(w) + 1) / total
            words.append({"w": w, "start": round(cur, 3), "end": round(cur + wd, 3)}); cur += wd
        timeline.append({**seg, "start": round(t, 3), "end": round(t + d, 3), "words": words})
        parts += [out, silence]; t += d + PAUSE

    lst = os.path.join(build, "_concat.txt")
    open(lst, "w").write("".join(f"file '{os.path.abspath(p)}'\n" for p in parts))
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "pcm_s16le", os.path.join(build, "voice.wav")])

    meta = {"engine": engine, "voice": voice, "duration": round(t, 3), "segments": timeline}
    json.dump(meta, open(os.path.join(build, "timeline.json"), "w"), ensure_ascii=False, indent=1)

    # SRT par groupes de ~4 mots
    lines, n = [], 1
    for seg in timeline:
        ws = seg["words"]
        for k in range(0, len(ws), 4):
            g = ws[k:k + 4]
            lines.append(f"{n}\n{srt_time(g[0]['start'])} --> {srt_time(g[-1]['end'])}\n{' '.join(x['w'] for x in g)}\n"); n += 1
    open(os.path.join(build, "captions.srt"), "w").write("\n".join(lines))
    print(f"[tts] {engine}/{voice} durée voix = {t:.1f}s")


if __name__ == "__main__":
    main()
