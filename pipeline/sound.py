#!/usr/bin/env python3
"""Musique originale + bruitages 100 % procéduraux (aucun échantillon, aucun droit tiers).

Usage: sound.py <episode_dir>
Lit build/timeline.json et script.json (champ "music" optionnel) ; écrit :
  build/music_bed.wav  — beat hip-hop original arrangé selon le récit (stéréo 44.1 kHz)
  build/sfx.wav        — bruitages synchronisés aux scènes
  build/beats.json     — temps de chaque temps/mesure + énergie (pour les animations « au beat »)

Arrangement (automatique, d'après les scènes) :
  intro : piano électrique seul, filtré  →  le beat entre sur la question du hook
  FactReveal : drums coupés (tension), basse tenue  →  retour plein sur la scène suivante
  music_break : beat plein, sans ducking (moment « musique seule »)
  fin : drums out, accords qui s'éteignent
Ce n'est PAS une imitation du morceau raconté : tempo, accords et sons sont génériques et originaux.
"""
import json, os, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(11)


# ---------- outils DSP ----------
def lp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 4), len(x))


def hp(x, fc):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    return np.fft.irfft(X / np.sqrt(1 + (fc / f) ** 4), len(x))


def bp(x, lo, hi):
    return hp(lp(x, hi), lo)


def env(n, a, d, s=0.0, r=None):
    """ADSR simplifiée en échantillons (a, d en s ; maintien s jusqu'à la fin)."""
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    if r:
        e *= np.clip((n / SR - t) / r, 0, 1)
    return e


def note(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(buf, x, at, gain=1.0):
    s = int(at * SR)
    if s >= len(buf) or s + len(x) <= 0: return
    if s < 0: x, s = x[-s:], 0
    e = min(len(buf), s + len(x)); buf[s:e] += x[:e - s] * gain


def reverb(x, size=0.35, mix=0.18):
    """Réverbe légère par réponse impulsionnelle de bruit décroissant (convolution FFT)."""
    n = int(size * 3 * SR); ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / SR / size)
    ir = lp(ir, 5000); ir /= np.abs(ir).sum() ** 0.5 * 30
    L = len(x) + n; y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    return x * (1 - mix) + y * mix * 3


# ---------- instruments ----------
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t * 32); ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7); click = lp(rng.normal(0, 1, n), 3000) * np.exp(-t * 180) * 0.4
    return np.tanh((body + click) * 1.6)


def snare():
    n = int(0.35 * SR); t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * 185 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t * 28)
    noise = bp(rng.normal(0, 1, n), 1200, 9000) * np.exp(-t * 16)
    return reverb(0.6 * tone + noise * 0.9, 0.25, 0.25)


def hat(open_=False):
    n = int((0.3 if open_ else 0.06) * SR); t = np.arange(n) / SR
    return hp(rng.normal(0, 1, n), 7000) * np.exp(-t * (9 if open_ else 70)) * 0.5


def epiano(m, dur, vel=0.5):
    """Piano électrique type « FM » : porteuse + modulateur qui décroît, trémolo."""
    n = int(dur * SR); t = np.arange(n) / SR; fc = note(m)
    mod = np.sin(2 * np.pi * fc * 1.0 * t) * 1.8 * np.exp(-t * 3.5)
    x = np.sin(2 * np.pi * fc * t + mod) * env(n, 0.005, 1.4, 0.25, 0.25)
    x += 0.15 * np.sin(2 * np.pi * fc * 2 * t) * np.exp(-t * 6)
    return x * vel * (1 + 0.12 * np.sin(2 * np.pi * 4.5 * t))


def sub(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.tanh(1.4 * np.sin(2 * np.pi * note(m) * t)) * env(n, 0.01, 0.9, 0.55, 0.08) * 0.8


def crash():
    n = int(1.8 * SR); t = np.arange(n) / SR
    x = hp(rng.normal(0, 1, n), 5000) * np.exp(-t * 2.2) + bp(rng.normal(0, 1, n), 3000, 8000) * np.exp(-t * 6) * 0.5
    return x * 0.35


def snare_roll(beat_len, steps=6):
    """Roulement qui accélère et monte sur le dernier temps avant un changement de scène."""
    out = np.zeros(int(beat_len * 1.2 * SR))
    for i in range(steps):
        at = beat_len * (1 - (1 - i / steps) ** 1.4)
        add(out, snare(), at, 0.25 + 0.5 * i / steps)
    return out


# ---------- bruitages ----------
def whoosh(len_s=0.7, up=True):
    n = int(len_s * SR); t = np.arange(n) / SR; x = rng.normal(0, 1, n)
    k = t / len_s if up else 1 - t / len_s
    e = np.sin(np.pi * t / len_s) ** 2
    return (lp(x, 700) * (1 - k) + hp(x, 2500) * k) * e * 0.4


def riser(len_s=1.6):
    n = int(len_s * SR); t = np.arange(n) / SR
    f = 200 * 2 ** (t / len_s * 3); tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15
    return (hp(rng.normal(0, 1, n), 3000) * 0.25 + tone) * (t / len_s) ** 2


def scratch():
    n = int(0.45 * SR); t = np.arange(n) / SR
    speed = np.sin(2 * np.pi * 3.3 * t) * (1 - t / 0.45)
    ph = np.cumsum(220 * (1 + 2 * np.abs(speed))) / SR
    x = bp(rng.normal(0, 1, n), 400, 3500) * np.abs(speed) + 0.4 * np.sin(2 * np.pi * ph) * np.abs(speed)
    return x * 0.6


def needle_drop():
    n = int(0.6 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * 70 * t) * np.exp(-t * 25)
    crackle = np.zeros(n); idx = rng.integers(0, n, 40); crackle[idx] = rng.uniform(0.2, 0.6, 40)
    return thump * 0.7 + lp(crackle, 4000) + hp(rng.normal(0, 1, n), 4000) * 0.03 * np.exp(-t * 3)


def clink():
    n = int(0.9 * SR); t = np.arange(n) / SR
    x = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((2630, 6), (3910, 8), (5270, 11)))
    return x * 0.22


def pour(len_s=1.8):
    n = int(len_s * SR); t = np.arange(n) / SR
    g = np.zeros(n); idx = rng.integers(0, n, int(len_s * 90)); g[idx] = rng.uniform(0.2, 1, len(idx))
    bub = bp(g, 600, 2600 - 1200 * t[-1] / len_s)
    return (bub * 0.6 + bp(rng.normal(0, 1, n), 800, 4000) * 0.08) * np.minimum(1, t * 4) * np.minimum(1, (len_s - t) * 3)


def splash():
    n = int(1.6 * SR); t = np.arange(n) / SR
    body = lp(rng.normal(0, 1, n), 1800) * np.exp(-t * 4)
    drops = np.zeros(n); idx = rng.integers(int(0.1 * SR), n, 60); drops[idx] = rng.uniform(0.1, 0.5, 60)
    return reverb(body * 0.8 + bp(drops, 800, 4000), 0.4, 0.3)


def page_flip():
    n = int(0.35 * SR); t = np.arange(n) / SR
    return bp(rng.normal(0, 1, n), 1500, 7000) * np.sin(np.pi * t / 0.35) ** 3 * 0.5


def pop():
    n = int(0.12 * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * (500 + 900 * np.exp(-t * 40)) * t) * np.exp(-t * 35) * 0.35


def impact():
    n = int(1.4 * SR); t = np.arange(n) / SR
    return reverb(np.sin(2 * np.pi * 50 * t) * np.exp(-t * 3) + lp(rng.normal(0, 1, n), 350) * np.exp(-t * 7) * 0.6, 0.5, 0.25) * 0.8


def vinyl(dur):
    n = int(dur * SR); hiss = lp(rng.normal(0, 1, n), 5000) * 0.008
    pops = np.zeros(n); idx = rng.integers(0, n, int(dur * 5)); pops[idx] = rng.uniform(0.05, 0.3, len(idx))
    return hiss + lp(pops, 3500)


# ---------- arrangement ----------
def build_music(tl, music_cfg, voice_offset):
    bpm = music_cfg.get("bpm", 86); beat = 60 / bpm; bar = 4 * beat
    swing = music_cfg.get("swing", 0.56)
    root = music_cfg.get("root", 48)  # do
    # i - VI - III - VII (mineur), voicings originaux avec 7e/9e
    prog = music_cfg.get("progression", [[0, 3, 7, 10, 14], [-4, 0, 3, 7, 10], [3, 7, 10, 14, 17], [-2, 2, 5, 9, 12]])
    dur = voice_offset + tl["duration"] + 3.5
    n = int(dur * SR)
    keysL, keysR = np.zeros(n), np.zeros(n)
    drums, bass = np.zeros(n), np.zeros(n)

    segs = tl["segments"]
    def scene_at(t):
        tv = t - voice_offset
        for s in reversed(segs):
            if tv >= s["start"] - 0.3: return s
        return segs[0]
    hook = segs[0]
    q = [w for w in hook["words"] if w["w"].lower().startswith("mais")]
    drums_in = voice_offset + (q[0]["start"] if q else hook["end"])
    end_t = voice_offset + segs[-1]["start"]
    breaks = [(voice_offset + b["at"], voice_offset + b["at"] + b["dur"]) for b in tl.get("music_breaks", [])]

    beats = []; energy_per_beat = []
    # RACCORD : la grille est décalée pour que la 1re mesure de batterie tombe pile sur la question du hook
    phase = drums_in % bar
    nbars = int(dur / bar) + 2
    for b in range(nbars):
        t0 = phase + (b - 1) * bar; ch = prog[b % len(prog)]
        if t0 + bar < 0: continue
        sc = scene_at(t0 + 0.01)["scene"]
        tense = sc in ("FactReveal",)
        # accords : attaque sur le 1, rappel syncopé sur le « et » du 3
        for k, (off, vel) in enumerate(((0, 0.55), (2.5 * beat, 0.32))):
            for j, iv in enumerate(ch):
                x = epiano(root + 12 + iv, bar - off + 0.4, vel / len(ch) * 2.2)
                pan = (j / (len(ch) - 1)) * 0.6 + 0.2
                add(keysL, x, t0 + off + j * 0.008, 1 - pan); add(keysR, x, t0 + off + j * 0.008, pan)
        if t0 >= drums_in - 0.01 and t0 < end_t:
            add(bass, sub(root - 12 + ch[0], beat * 1.5), t0)
            add(bass, sub(root - 12 + ch[0], beat * 0.9), t0 + 2.5 * beat)
            if not tense:
                for st in (0, 2.75):      # kick : 1 et 3-et
                    add(drums, kick(), t0 + st * beat, 0.9)
                if b % 2: add(drums, kick(), t0 + 3.5 * beat, 0.55)
                for st in (1, 3):         # snare : 2 et 4
                    add(drums, snare(), t0 + st * beat, 0.75)
                for h in range(8):        # hats en croches swinguées
                    tt =t0 + (h // 2) * beat + (beat * swing if h % 2 else 0)
                    add(drums, hat(open_=(h == 7 and b % 4 == 3)), tt, 0.35 + 0.15 * rng.random() - (0.12 if h % 2 else 0))
        for k in range(4):
            if t0 < 0: beats.append(None); energy_per_beat.append(0); continue  # mesure entière retirée → 1er temps = index multiple de 4
            beats.append(round(t0 + k * beat, 3))
            energy_per_beat.append(1.0 if (t0 >= drums_in and t0 < end_t and not tense) else 0.35)

    # RACCORD des scènes : chaque coupe est calée sur le temps le plus proche ;
    # roulement de caisse claire avant la coupe + cymbale dessus (sauf entrée en tension)
    clean = [(bt, en) for bt, en in zip(beats, energy_per_beat) if bt is not None]
    beats = [b for b, _ in clean]; energy_per_beat = [e for _, e in clean]
    cuts = []
    for s_ in segs[1:]:
        want = voice_offset + s_["start"] - 0.25
        bt = min(beats, key=lambda x: abs(x - want))
        if abs(bt - want) > beat * 0.6: bt = want
        cuts.append(round(bt, 3))
        if drums_in <= bt < end_t + bar:
            if s_["scene"] != "FactReveal":
                add(drums, snare_roll(beat), bt - beat, 0.8)
            add(drums, crash(), bt, 0.9 if s_["scene"] != "FactReveal" else 0.5)
            add(bass, sub(root - 12 + prog[0][0], beat * 2), bt, 0.9)

    # intro filtrée : le piano « s'ouvre » quand le beat arrive
    keys = np.stack([keysL, keysR])
    cut = int(drums_in * SR)
    for c in range(2):
        keys[c, :cut] = lp(keys[c, :cut], 900) * 1.2
    # moments « musique seule » : tout le monde un peu plus fort
    lift = np.ones(n)
    for a, z in breaks:
        s, e = int(a * SR), int(z * SR); r = int(0.25 * SR)
        lift[s:e] = 2.4; lift[max(0, s - r):s] = np.linspace(1, 2.4, s - max(0, s - r)); lift[e:e + r] = np.linspace(2.4, 1, len(lift[e:e + r]))
    v = vinyl(dur)
    L = (keys[0] * 0.8 + drums + bass + v) * lift
    R = (keys[1] * 0.8 + drums + bass + np.roll(v, 777)) * lift
    fade = np.minimum(1, np.arange(n) / SR / 1.0) * np.minimum(1, (dur - np.arange(n) / SR) / 3.0)
    return np.stack([L * fade, R * fade]), {"bpm": bpm, "beats": beats, "energy": energy_per_beat, "drums_in": drums_in, "breaks": breaks, "cuts": cuts}


SFX_BY_SCENE = {
    "ArtistTitleCard": [(0.0, "needle_drop", 0.9)],
    "FamilyRoom": [("verres", "pour", 0.7), ("fêtes", "clink", 0.8)],
    "FactReveal": [(0.0, "page_flip", 1.0), ("choisir", "riser", 0.8), ("ivrogne", "impact", 0.9)],
    "TwoVoices": [("insistent", "pop", 1.0), ("remplissent", "pop", 1.0), ("autre", "impact", 0.5)],
    "PoolDive": [("plonger", "whoosh_down", 1.0), ("dedans", "splash", 1.0), ("noyer", "impact", 0.8)],
    "TikTokUsageContrast": [("Mais", "scratch", 0.9)],
    "EndQuestion": [(0.0, "needle_drop", 0.6)],
}
SFX = {"needle_drop": needle_drop, "pour": pour, "clink": clink, "page_flip": page_flip, "riser": riser,
       "impact": impact, "pop": pop, "whoosh_down": lambda: whoosh(0.6, False), "splash": splash, "scratch": scratch}


def word_time(seg, needle):
    for w in seg["words"]:
        if w["w"].lower().strip(".,:;!?«»").startswith(needle.lower()):
            return w["start"]
    return None


def write(path, st):
    st = st / max(1e-9, np.abs(st).max()) * 0.89
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st.T * 32767).astype("<i2").tobytes())


def main():
    ep = sys.argv[1]; vo = float(sys.argv[2]) if len(sys.argv) > 2 else 0.6
    tl = json.load(open(os.path.join(ep, "build", "timeline.json")))
    sc = json.load(open(os.path.join(ep, "script.json")))
    music, info = build_music(tl, sc.get("music", {}), vo)
    write(os.path.join(ep, "build", "music_bed.wav"), music)

    n = music.shape[1]; fx = np.zeros(n)
    hook = tl["segments"][0]
    q = word_time(hook, "mais")
    if q is not None: add(fx, scratch(), vo + q - 0.2, 0.8)
    for i, seg in enumerate(tl["segments"]):
        if i: add(fx, whoosh(), vo + seg["start"] - 0.45, 0.8)
        for when, name, g in SFX_BY_SCENE.get(seg["scene"], []):
            t = seg["start"] + when if isinstance(when, float) else word_time(seg, when)
            if t is None: continue
            if name == "riser": t -= 1.4
            add(fx, SFX[name](), vo + t, g)
    write(os.path.join(ep, "build", "sfx.wav"), np.stack([fx, fx]))
    json.dump(info, open(os.path.join(ep, "build", "beats.json"), "w"))
    print(f"[sound] beat {info['bpm']} BPM, {len(info['beats'])} temps, drums à {info['drums_in']:.1f}s, {len(info['breaks'])} break(s)")


if __name__ == "__main__":
    main()
