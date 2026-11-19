#!/usr/bin/env python3
"""Explainer 9:16 style Bang Motion « buku sketsa vintage » (gaya 4) pour L'Envers du Son.

Usage: bang_sketch.py <episode_dir>
Lit script.json, build/timeline.json, build/beats.json ; écrit <episode>/web/index.html (+ gsap.min.js, mix.wav).
Rendu MP4 : node pipeline/render_html.mjs <episode>/web/index.html <sortie.mp4> (Playwright, image par image).

Règles Bang Motion appliquées (.claude/skills/bang-motion) :
- rig kolase : #world plus grand que le cadre ; caméra into → settle → look → home puis DIAM ; le texte n'apparaît
  qu'APRÈS le zoom arrière ; push-through entre scènes (pas de section qui fade) ; coupes calées sur le beat.
- 3 à 5 éléments par scène qui s'accumulent par phrase ; une grande phrase + un label max ; anotations dessinées.
- assets vivants (flottement ±25 px / 1,5 s + rotation), flou de mouvement directionnel, sortie rapide.
- lisibilité mobile : corps ≥ 44 px, labels ≥ 34 px, titres ≥ 100 px ; zone sûre TikTok.
- gravures SVG ORIGINALES (pas de pochette, pas de photo protégée, pas de visage réel).
"""
import json, os, shutil, sys, html

ep = sys.argv[1].rstrip('/')
here = os.path.dirname(os.path.abspath(__file__))
sc = json.load(open(f"{ep}/script.json"))
tl = json.load(open(f"{ep}/build/timeline.json"))
bt = json.load(open(f"{ep}/build/beats.json"))
VO = float(os.environ.get("VOICE_OFFSET", 0.6))
DUR = round(VO + tl["duration"] + 2.6, 2)
web = f"{ep}/web"; os.makedirs(web, exist_ok=True)
shutil.copy(os.path.join(here, "..", "video", "node_modules", "gsap", "dist", "gsap.min.js"), f"{web}/gsap.min.js")
shutil.copy(f"{ep}/build/mix.wav", f"{web}/mix.wav")

segs = tl["segments"]
cuts = [0.0] + [c for c in bt.get("cuts", [])][:len(segs) - 1]
DATA = {"dur": DUR, "vo": VO, "cuts": cuts, "beats": bt.get("beats", []),
        "segs": [{"id": s["id"], "scene": s["scene"], "start": s["start"] + VO, "end": s["end"] + VO,
                  "words": [{"w": w["w"], "t": round(w["start"] + VO, 3), "e": round(w["end"] + VO, 3)} for w in s["words"]]} for s in segs]}

# --- position de chaque scène dans le grand monde (zigzag) ---
POS = [(0, 0), (1, 0), (2, 0), (2, 1), (1, 1), (0, 1), (0, 2), (1, 2), (2, 2), (3, 2)]
def org(i):
    x, y = POS[i % len(POS)]; return x * 1500, y * 2300

# ---------------- gravures SVG ----------------
INK, INK2, RUST, GOLD = "#2E2115", "#5B4634", "#9A3B22", "#B8862B"
DEFS = f'''<pattern id="hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="9" stroke="{INK}" stroke-width="2.2"/></pattern>
<pattern id="hatch2" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="7" stroke="{INK}" stroke-width="1.6"/></pattern>
<pattern id="cross" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V10M0 0H10" stroke="{INK}" stroke-width="1.6"/></pattern>'''

def person(x, y, h, pose="adult"):
    """Silhouette gravée générique (aucun visage réel)."""
    s = h / 300
    body = {"child": "M-30 0 C-34 -60 -30 -120 0 -126 C30 -120 34 -60 30 0 Z",
            "adult": "M-46 0 C-52 -110 -46 -200 0 -210 C46 -200 52 -110 46 0 Z",
            "old": "M-48 0 C-56 -100 -40 -190 6 -196 C48 -186 54 -100 46 0 Z"}[pose]
    head = {"child": (0, -160, 34), "adult": (0, -248, 36), "old": (10, -232, 36)}[pose]
    return (f'<g transform="translate({x},{y}) scale({s})"><path d="{body}" fill="url(#hatch)" stroke="{INK}" stroke-width="4"/>'
            f'<circle cx="{head[0]}" cy="{head[1]}" r="{head[2]}" fill="url(#cross)" stroke="{INK}" stroke-width="4"/></g>')

def photo(year, pose, tone="old", w=440, h=560):
    bg = "#E4D3AE" if tone == "old" else "#F2EAD6"
    inner = (f'<rect x="28" y="28" width="{w-56}" height="{h-130}" fill="{bg}" stroke="{INK}" stroke-width="5"/>'
             # fenêtre + arbre : LE MÊME DÉCOR dans les deux photos
             f'<rect x="{w*0.52}" y="70" width="{w*0.32}" height="190" fill="none" stroke="{INK}" stroke-width="5"/>'
             f'<line x1="{w*0.68}" y1="70" x2="{w*0.68}" y2="260" stroke="{INK}" stroke-width="4"/><line x1="{w*0.52}" y1="165" x2="{w*0.84}" y2="165" stroke="{INK}" stroke-width="4"/>'
             f'<circle cx="{w*0.6}" cy="140" r="34" fill="url(#hatch2)" stroke="{INK}" stroke-width="3"/>'
             f'<line x1="28" y1="{h-170}" x2="{w-28}" y2="{h-170}" stroke="{INK}" stroke-width="4"/>'
             + person(w * 0.3, h - 170, {"child": 230, "adult": 330, "old": 320}[pose], pose))
    return (f'<svg viewBox="0 0 {w} {h}" width="100%" height="100%"><defs>{DEFS}</defs>'
            f'<rect x="6" y="6" width="{w-12}" height="{h-12}" fill="#FBF6EA" stroke="{INK2}" stroke-width="3"/>{inner}'
            f'<text x="{w/2}" y="{h-36}" text-anchor="middle" font-family="Caveat, \'EB Garamond\', serif" font-style="italic" font-size="52" fill="{RUST}">{year}</text></svg>')

def clock(size=400, style="wall", speed=1.0, cls=""):
    r = 170; c = 200
    ticks = "".join(f'<line x1="{c}" y1="{c-r+8}" x2="{c}" y2="{c-r+(26 if k%5==0 else 16)}" stroke="{INK}" stroke-width="{5 if k%5==0 else 2.5}" transform="rotate({k*6} {c} {c})"/>' for k in range(60))
    rom = ["XII","I","II","III","IIII","V","VI","VII","VIII","IX","X","XI"]
    import math
    nums = "".join(f'<text x="{c+128*math.sin(k*math.pi/6):.1f}" y="{c-128*math.cos(k*math.pi/6)+11:.1f}" text-anchor="middle" font-family="Cinzel,serif" font-size="30" fill="{INK}">{rom[k]}</text>' for k in range(12))
    deco = ""
    if style == "alarm":
        deco = (f'<path d="M70 70 a70 70 0 0 1 100 -40" fill="url(#hatch)" stroke="{INK}" stroke-width="5"/>'
                f'<path d="M330 70 a70 70 0 0 0 -100 -40" fill="url(#hatch)" stroke="{INK}" stroke-width="5"/>'
                f'<line x1="120" y1="360" x2="90" y2="398" stroke="{INK}" stroke-width="9"/><line x1="280" y1="360" x2="310" y2="398" stroke="{INK}" stroke-width="9"/>')
    elif style == "mantel":
        deco = f'<path d="M20 230 Q200 -40 380 230 L380 398 L20 398 Z" fill="none" stroke="{INK}" stroke-width="6"/><rect x="40" y="370" width="320" height="26" fill="url(#hatch2)" stroke="{INK}" stroke-width="4"/>'
    elif style == "pocket":
        deco = f'<circle cx="{c}" cy="14" r="16" fill="none" stroke="{INK}" stroke-width="6"/>'
    face = (f'<circle cx="{c}" cy="{c}" r="{r+14}" fill="url(#hatch2)" stroke="{INK}" stroke-width="6"/>'
            f'<circle cx="{c}" cy="{c}" r="{r}" fill="#F7EEDA" stroke="{INK}" stroke-width="4"/>{ticks}{nums}'
            f'<g class="hh {cls}" data-speed="{speed/12:.4f}" style="transform-origin:{c}px {c}px"><path d="M{c-7} {c} L{c} {c-92} L{c+7} {c} Z" fill="{INK}"/></g>'
            f'<g class="mh {cls}" data-speed="{speed:.4f}" style="transform-origin:{c}px {c}px"><path d="M{c-5} {c} L{c} {c-140} L{c+5} {c} Z" fill="{INK}"/></g>'
            f'<g class="sh {cls}" data-speed="{speed*60:.4f}" style="transform-origin:{c}px {c}px"><line x1="{c}" y1="{c+30}" x2="{c}" y2="{c-150}" stroke="{RUST}" stroke-width="3"/></g>'
            f'<circle cx="{c}" cy="{c}" r="10" fill="{RUST}"/>')
    return f'<svg viewBox="0 0 400 400" width="{size}" height="{size}" overflow="visible"><defs>{DEFS}</defs>{deco}{face}</svg>'

def calendar(day="12", word="LUNDI", w=180):
    return (f'<svg viewBox="0 0 180 210" width="{w}" height="{w*210/180:.0f}"><defs>{DEFS}</defs>'
            f'<rect x="6" y="6" width="168" height="198" fill="#FBF6EA" stroke="{INK}" stroke-width="5"/>'
            f'<rect x="6" y="6" width="168" height="48" fill="url(#hatch)" stroke="{INK}" stroke-width="5"/>'
            f'<text x="90" y="44" text-anchor="middle" font-family="Cinzel,serif" font-size="28" font-weight="700" fill="#FBF6EA" stroke="{INK}" stroke-width="1">{word}</text>'
            f'<text x="90" y="160" text-anchor="middle" font-family="\'Playfair Display\',serif" font-weight="900" font-size="96" fill="{INK}">{day}</text></svg>')

def bust():
    return (f'<svg viewBox="0 0 420 520" width="100%" height="100%"><defs>{DEFS}</defs>'
            f'<ellipse cx="210" cy="260" rx="196" ry="246" fill="#F2E7CC" stroke="{INK}" stroke-width="8"/>'
            f'<ellipse cx="210" cy="260" rx="176" ry="226" fill="none" stroke="{INK}" stroke-width="3"/>'
            f'<path d="M110 470 C120 380 150 350 190 340 C150 310 140 250 160 200 C180 150 250 140 280 180 C300 210 298 250 290 270 L306 300 L290 304 C290 330 270 345 250 350 C300 360 320 400 320 470 Z" fill="url(#cross)" stroke="{INK}" stroke-width="5"/></svg>')

def shopfront():
    return (f'<svg viewBox="0 0 620 520" width="100%" height="100%"><defs>{DEFS}</defs>'
            f'<rect x="10" y="90" width="600" height="420" fill="#F4EAD2" stroke="{INK}" stroke-width="7"/>'
            f'<rect x="10" y="10" width="600" height="90" fill="url(#hatch)" stroke="{INK}" stroke-width="7"/>'
            f'<rect x="90" y="26" width="440" height="58" fill="#FBF6EA" stroke="{INK}" stroke-width="4"/>'
            f'<text x="310" y="68" text-anchor="middle" font-family="Cinzel,serif" font-weight="700" font-size="40" letter-spacing="6" fill="{INK}">ANTIQUITÉS</text>'
            f'<rect x="50" y="140" width="330" height="330" fill="none" stroke="{INK}" stroke-width="6"/><rect x="420" y="160" width="150" height="350" fill="url(#hatch2)" stroke="{INK}" stroke-width="6"/>'
            f'<circle cx="545" cy="340" r="9" fill="{INK}"/></svg>')

def taperec():
    return (f'<svg viewBox="0 0 420 300" width="100%" height="100%"><defs>{DEFS}</defs>'
            f'<rect x="10" y="60" width="400" height="230" rx="18" fill="#F4EAD2" stroke="{INK}" stroke-width="7"/>'
            f'<g class="reel" data-speed="40" style="transform-origin:120px 150px"><circle cx="120" cy="150" r="70" fill="url(#hatch2)" stroke="{INK}" stroke-width="5"/><circle cx="120" cy="150" r="14" fill="{INK}"/><path d="M120 86V214M56 150H184" stroke="{INK}" stroke-width="5"/></g>'
            f'<g class="reel" data-speed="40" style="transform-origin:300px 150px"><circle cx="300" cy="150" r="70" fill="url(#hatch2)" stroke="{INK}" stroke-width="5"/><circle cx="300" cy="150" r="14" fill="{INK}"/><path d="M300 86V214M236 150H364" stroke="{INK}" stroke-width="5"/></g>'
            f'<rect x="150" y="236" width="120" height="30" fill="url(#hatch)" stroke="{INK}" stroke-width="4"/><path d="M60 60 L120 10 L300 10 L360 60" fill="none" stroke="{INK}" stroke-width="5"/></svg>')

def phone():
    return (f'<svg viewBox="0 0 360 700" width="100%" height="100%"><defs>{DEFS}</defs>'
            f'<rect x="8" y="8" width="344" height="684" rx="46" fill="#F4EAD2" stroke="{INK}" stroke-width="8"/>'
            f'<rect x="32" y="70" width="296" height="560" rx="14" fill="#FBF6EA" stroke="{INK}" stroke-width="4"/>'
            f'<rect x="140" y="28" width="80" height="14" rx="7" fill="{INK}"/></svg>')

# ---------------- scènes ----------------
def esc(s): return html.escape(s, quote=False)
els = []
def put(i, x, y, w, h, inner, eid, cls="cut", extra=""):
    ox, oy = org(i)
    els.append(f'<div class="{cls}" id="{eid}" style="left:{ox+x}px;top:{oy+y}px;width:{w}px;height:{h}px;{extra}">{inner}</div>')
def text(i, x, y, content, eid, cls, extra=""):
    ox, oy = org(i)
    els.append(f'<div class="{cls}" id="{eid}" style="left:{ox+x}px;top:{oy+y}px;{extra}">{content}</div>')
def anno(i, x, y, w, h, d, eid):
    ox, oy = org(i)
    els.append(f'<svg class="anno" id="{eid}" style="position:absolute;left:{ox+x}px;top:{oy+y}px;width:{w}px;height:{h}px;overflow:visible" viewBox="0 0 {w} {h}"><path d="{d}"/></svg>')

SCENES = {}
def scene(name):
    def deco(f): SCENES[name] = f; return f
    return deco

@scene("photos")
def _(i):
    text(i, 60, 150, "TIKTOK", f"g{i}", "ghost", "font-size:250px")
    put(i, 70, 420, 440, 560, photo("1996", "child"), f"s{i}a", extra="transform-origin:50% 50%")
    put(i, 570, 470, 440, 560, photo("2026", "adult", "new"), f"s{i}b")
    anno(i, 470, 640, 140, 80, "M10 40 C50 0 90 0 130 40 M110 20 L130 40 L108 58", f"s{i}r")
    text(i, 70, 1110, 'Avant, <span class="hl"><i></i>aujourd\'hui</span>', f"s{i}l", "line t")
    text(i, 74, 1050, "UNE TENDANCE TIKTOK", f"s{i}n", "name")

@scene("decor")
def _(i):
    put(i, 60, 300, 440, 560, photo("1996", "child"), f"s{i}a", extra="transform:rotate(-4deg)")
    put(i, 580, 300, 440, 560, photo("2026", "old", "new"), f"s{i}b", extra="transform:rotate(3deg)")
    anno(i, 320, 330, 470, 260, "M30 120 C80 30 200 10 240 60 C280 10 400 30 440 120", f"s{i}r")
    text(i, 380, 300, "même fenêtre", f"s{i}h", "hand")
    text(i, 70, 1000, 'Le décor <span class="hl"><i></i>reste</span>', f"s{i}l", "line t")
    text(i, 74, 1130, "… et nous, on vieillit", f"s{i}h2", "hand", "font-size:56px")

@scene("title")
def _(i):
    text(i, 40, 120, "1973", f"g{i}", "ghost")
    put(i, 290, 330, 500, 500, clock(500, "mantel", 0.6), f"s{i}a")
    text(i, 0, 900, "« Time »", f"s{i}l", "line t", "width:1080px;text-align:center;font-size:180px")
    text(i, 0, 1140, "PINK FLOYD · THE DARK SIDE OF THE MOON", f"s{i}n", "name", "width:1080px;text-align:center;font-size:30px;letter-spacing:.1em")
    text(i, 250, 1230, "pas seulement des souvenirs", f"s{i}h", "hand")

@scene("waters")
def _(i):
    text(i, 600, 160, "29", f"g{i}", "ghost", "font-size:420px")
    put(i, 90, 300, 420, 520, bust(), f"s{i}a")
    text(i, 96, 840, "ROGER WATERS · 29 ANS", f"s{i}n", "name")
    text(i, 110, 890, "illustration", f"s{i}c", "cred")
    put(i, 600, 560, 380, 300, calendar("…", "PLUS TARD", 380), f"s{i}b")
    text(i, 70, 1010, 'Se <span class="hl"><i></i>préparer</span> à vivre', f"s{i}l", "line t")
    text(i, 600, 900, "… plus tard", f"s{i}h", "hand")

@scene("clock")
def _(i):
    put(i, 140, 260, 800, 800, clock(800, "wall", 3.0, "fast"), f"s{i}a")
    text(i, 70, 1110, 'Minute après <span class="hl"><i></i>minute</span>', f"s{i}l", "line t", "font-size:96px")
    text(i, 640, 230, "déjà sa vie", f"s{i}h", "hand")

@scene("days")
def _(i):
    for k in range(12):
        put(i, 90 + (k % 4) * 230, 230 + (k // 4) * 250, 180, 210, calendar("12", "LUNDI"), f"s{i}d{k}", "cut day")
    text(i, 600, 1000, "à demain", f"s{i}h", "hand")
    anno(i, 590, 1010, 290, 60, "M0 34 L270 26", f"s{i}r")
    text(i, 70, 1100, 'Des années <span class="hl"><i></i>passent</span>', f"s{i}l", "line t", "font-size:92px")

@scene("shop")
def _(i):
    put(i, 230, 200, 620, 520, shopfront(), f"s{i}a")
    styles = ["alarm", "mantel", "pocket", "wall", "alarm", "wall", "mantel", "alarm", "pocket"]
    for k in range(9):
        put(i, 80 + (k % 3) * 320, 760 + (k // 3) * 200, 190, 190, clock(190, styles[k], 0.4 + 0.3 * k), f"s{i}c{k}", "cut clk")
    put(i, 600, 470, 300, 214, taperec(), f"s{i}b")
    text(i, 70, 1370, "ALAN PARSONS · INGÉNIEUR DU SON", f"s{i}n", "name", "font-size:32px")
    text(i, 580, 690, "une par une", f"s{i}h", "hand")

@scene("compare")
def _(i):
    put(i, 330, 220, 420, 816, phone(), f"s{i}a")
    put(i, 372, 330, 168, 214, photo("1996", "child", "old", 440, 560), f"s{i}p1", "cut mini")
    put(i, 540, 330, 168, 214, photo("2026", "adult", "new", 440, 560), f"s{i}p2", "cut mini")
    text(i, 70, 1110, 'On <span class="hl"><i></i>compare</span>', f"s{i}l", "line t")
    text(i, 420, 600, "avant · après", f"s{i}h", "hand", "font-size:50px")

@scene("question")
def _(i):
    put(i, 240, 200, 600, 600, clock(600, "wall", 1.0, "stop"), f"s{i}a")
    text(i, 70, 900, 'Ta <span class="hl"><i></i>vraie vie</span>', f"s{i}l", "line t", "font-size:120px")
    text(i, 70, 1040, "a-t-elle commencé ?", f"s{i}l2", "line t it")
    text(i, 560, 820, "elle tourne déjà", f"s{i}h", "hand")

for i, s in enumerate(segs):
    SCENES[s["scene"]](i)

ORIGINS = [org(i) for i in range(len(segs))]
page = f'''<!doctype html>
<html lang="fr">
<!-- Fait avec le skill Bang Motion (Bang Tutorial, MIT) — style « buku sketsa vintage », adapté 9:16 pour L'Envers du Son -->
<head><meta charset="utf-8"><title>{esc(sc["title"])} — L'Envers du Son</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Cinzel:wght@600;700&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>
:root{{--ink:{INK};--ink2:{INK2};--rust:{RUST};--gold:{GOLD};--paper:#EFE4CC}}
html,body{{margin:0;height:100%;background:#0a0a0a;overflow:hidden}}
#stage{{position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;background:var(--paper);font-family:"EB Garamond",Georgia,serif;color:var(--ink)}}
#world{{position:absolute;left:0;top:0;width:10px;height:10px;transform-origin:0 0;will-change:transform}}
#filters{{position:fixed;width:0;height:0;opacity:0;pointer-events:none}}
.t{{position:absolute;opacity:0}}
.w{{display:inline-block;white-space:nowrap;margin:0 .1em;opacity:0;will-change:transform,opacity}}
.paper{{position:absolute;left:-3000px;top:-3000px;width:12000px;height:12000px;background:var(--paper);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.012' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .42 0 0 0 0 .25 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .35 0 0 0 0 .28 0 0 0 0 .2 0 0 0 .5 0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E");background-size:800px 800px,300px 300px}}
.cut{{position:absolute;opacity:0;will-change:transform,filter;mix-blend-mode:multiply}}
.line{{position:absolute;left:70px;width:940px;font-family:"Playfair Display",serif;font-weight:900;font-size:108px;line-height:1;letter-spacing:-.01em;color:var(--ink);opacity:0}}
.line.it{{font-family:"EB Garamond",serif;font-style:italic;font-weight:500;font-size:80px;color:var(--ink2)}}
.hl{{position:relative;display:inline-block;padding:0 .08em}}
.hl i{{position:absolute;left:0;right:0;top:.62em;bottom:0;background:rgba(184,134,43,.45);transform:scaleX(0);transform-origin:0 50%;z-index:-1}}
.name{{position:absolute;font-family:"Cinzel",serif;font-weight:600;font-size:36px;letter-spacing:.14em;color:var(--ink);opacity:0;white-space:nowrap}}
.cred{{position:absolute;font-style:italic;font-size:30px;color:var(--ink2);opacity:0}}
.hand{{position:absolute;font-family:Caveat,"EB Garamond",serif;font-weight:600;font-size:64px;color:var(--rust);opacity:0;white-space:nowrap;transform:rotate(-3deg)}}
.ghost{{position:absolute;font-family:"Playfair Display",serif;font-weight:900;font-size:340px;line-height:.85;letter-spacing:-.04em;color:rgba(154,59,34,.2);white-space:nowrap;opacity:0}}
.anno *{{fill:none;stroke:var(--rust);stroke-width:6;stroke-linecap:round;stroke-linejoin:round}}
.vig{{position:absolute;inset:0;pointer-events:none;background:radial-gradient(75% 60% at 50% 45%,transparent 55%,rgba(60,40,20,.34) 100%)}}
#cap{{position:absolute;left:60px;right:60px;top:1450px;text-align:center;font-family:"EB Garamond",serif;font-style:italic;font-weight:500;font-size:58px;line-height:1.15;color:var(--ink)}}
#cap span{{background:rgba(251,246,234,.86);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:4px 16px;border-radius:6px}}
#cap b{{color:var(--rust);font-weight:600}}
#brand{{position:absolute;left:60px;top:70px;font-family:"Cinzel",serif;font-weight:700;font-size:30px;letter-spacing:.2em;color:var(--ink2)}}
#prog{{position:absolute;left:60px;top:116px;width:960px;height:5px;background:rgba(46,33,21,.15)}}#prog i{{display:block;height:100%;width:0;background:var(--rust)}}
#note{{position:absolute;left:50%;top:1460px;transform:translateX(-50%);font-family:Caveat,serif;font-size:58px;color:var(--rust);opacity:0;white-space:nowrap}}
</style></head>
<body>
<svg id="filters"><defs></defs></svg>
<div id="stage">
  <div id="world"><div class="paper"></div>
  {"".join(els)}
  </div>
  <div class="vig"></div>
  <div id="brand">L'ENVERS DU SON</div><div id="prog"><i></i></div>
  <div id="note">♪ écoute ♪</div>
  <div id="cap"></div>
</div>
<audio id="vo" src="mix.wav" preload="auto"></audio>
<script src="gsap.min.js"></script>
<script>
const D={json.dumps(DATA, ensure_ascii=False)};
const ORIG={json.dumps(ORIGINS)};
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const DUR=D.dur;
/* flou de mouvement directionnel (Bang Motion techniques §2) */
const defs=$('#filters defs');let fc=0;
function makeBlur(){{const id='mb'+(fc++),NS='http://www.w3.org/2000/svg';const f=document.createElementNS(NS,'filter');f.id=id;f.setAttribute('x','-70%');f.setAttribute('y','-70%');f.setAttribute('width','240%');f.setAttribute('height','240%');const g=document.createElementNS(NS,'feGaussianBlur');g.setAttribute('stdDeviation','0 0');f.appendChild(g);defs.appendChild(f);return {{url:`url(#${{id}})`,node:g}};}}
function blurTween(tl,targets,at,from,to,dur,{{ease='power3.out',ax=1,ay=.08}}={{}}){{const b=makeBlur(),o={{v:from}};tl.set(targets,{{filter:b.url}},at);tl.to(o,{{v:to,duration:dur,ease,onUpdate(){{b.node.setAttribute('stdDeviation',`${{(o.v*ax).toFixed(2)}} ${{(o.v*ay).toFixed(2)}}`);}}}},at);tl.set(targets,{{filter:'none'}},at+dur);}}
const VERT={{ax:.1,ay:1}},HORZ={{ax:1,ay:.1}};
$$('.line').forEach(el=>{{const out=[];el.childNodes.forEach(n=>{{if(n.nodeType===3){{n.textContent.split(/\\s+/).filter(Boolean).forEach(w=>{{const s=document.createElement('span');s.className='w';s.textContent=w;out.push(s);}});}}else{{const s=document.createElement('span');s.className='w';s.appendChild(n.cloneNode(true));out.push(s);}}}});el.textContent='';out.forEach(s=>el.appendChild(s));}});
const tl=gsap.timeline({{paused:true}});const rig=$('#world');
const say=(sel,at,{{dur=.6,st=.08}}={{}})=>{{const el=$(sel);if(!el)return;const ws=$$('.w',el);tl.set(el,{{opacity:1}},at);
  tl.fromTo(ws,{{opacity:0,yPercent:60,scaleY:1.25}},{{opacity:1,yPercent:0,scaleY:1,duration:dur,ease:'power4.out',stagger:st,immediateRender:false}},at);
  blurTween(tl,el,at,22,0,dur+st*ws.length,VERT);
  $$('.hl i',el).forEach((h,k)=>tl.fromTo(h,{{scaleX:0}},{{scaleX:1,duration:.45,ease:'power3.out',immediateRender:false}},at+st*ws.length+.2+k*.2));}};
const unsay=(sel,at)=>{{const el=$(sel);if(!el)return;const ws=$$('.w',el);tl.to(ws,{{opacity:0,yPercent:-50,duration:.3,ease:'power2.in',stagger:.02}},at);blurTween(tl,el,at,0,30,.4,{{ease:'power2.in',...VERT}});tl.set(el,{{opacity:0}},at+.45);}};
const fly=(sel,at,{{from={{x:0,y:120,rotate:0,scale:.94}},dur=.9,float=true}}={{}})=>{{const el=typeof sel==='string'?$(sel):sel;if(!el)return;
  tl.fromTo(el,{{opacity:0,...from}},{{opacity:1,x:0,y:0,rotate:0,scale:1,duration:dur,ease:'power4.out',immediateRender:false}},at);
  blurTween(tl,el,at,34,0,dur*.7,Math.abs(from.x||0)>Math.abs(from.y||0)?HORZ:VERT);
  if(float)tl.to(el,{{y:-24,rotate:1.5,scale:1.04,duration:1.4+((at*7)%1)*.4,ease:'sine.inOut',yoyo:true,repeat:Math.ceil(DUR/1.4)}},at+dur);}};
const flyOut=(sel,at,{{to={{x:0,y:-640,rotate:-8,scale:1.1}},dur=.45}}={{}})=>{{const el=typeof sel==='string'?$(sel):sel;if(!el)return;tl.to(el,{{opacity:0,...to,duration:dur,ease:'power2.in',overwrite:'auto'}},at);}};
const draw=(sel,at,dur=.7)=>{{const p=$(sel);if(!p)return;tl.set(p,{{opacity:0}},0);tl.set(p,{{opacity:1}},at);const o={{v:0}};tl.to(o,{{v:1,duration:dur,ease:'power2.inOut',onUpdate(){{p.style.clipPath=`inset(-300px ${{(1-o.v)*100}}% -300px -300px)`;}}}},at);}};
const label=(sel,at)=>{{const e=$(sel);if(e)tl.fromTo(e,{{opacity:0,y:16}},{{opacity:1,y:0,duration:.45,ease:'power3.out',immediateRender:false}},at);}};
const unlabel=(sel,at)=>{{const e=$(sel);if(e)tl.to(e,{{opacity:0,duration:.25}},at);}};
const ghost=(sel,at)=>{{const e=$(sel);if(e)tl.fromTo(e,{{opacity:0,y:50}},{{opacity:1,y:0,duration:1.3,ease:'power2.out',immediateRender:false}},at);}};
/* caméra (rig kolase) */
const C={{x:540,y:960,z:1}};
function applyCam(){{rig.style.transform=`translate(${{540-C.x*C.z}}px,${{960-C.y*C.z}}px) scale(${{C.z}})`;}}
const look=(at,x,y,z,dur=1.4,ease='sine.inOut')=>tl.to(C,{{x,y,z,duration:dur,ease,onUpdate:applyCam}},at);
const home=(i,at,dur=1.1)=>look(at,ORIG[i][0]+540,ORIG[i][1]+880,1,dur,'power2.inOut');
const into=(cutAt,x,y,z)=>tl.to(C,{{x,y,z,duration:.9,ease:'power2.in',onUpdate:applyCam}},cutAt-.9);
const settle=(cutAt,x,y,z)=>tl.to(C,{{x,y,z:z*.94,duration:1.1,ease:'power3.out',onUpdate:applyCam}},cutAt);
const breath=(a,b,z)=>tl.to(C,{{z,duration:Math.max(.1,b-a),ease:'sine.inOut',onUpdate:applyCam}},a);
const at=(i,x,y)=>[ORIG[i][0]+x,ORIG[i][1]+y];
const wt=(i,needle)=>{{const s=D.segs[i];const w=s.words.find(w=>w.w.toLowerCase().replace(/[^a-zà-ÿ0-9]/g,'').startsWith(needle));return w?w.t:s.start+1;}};

/* ---------- chorégraphie : par scène, focus A (gros plan) → glisse vers B → zoom arrière → texte ---------- */
const N=D.segs.length;
const CUT=i=>i===0?0:D.cuts[i];
const END=i=>i<N-1?D.cuts[i+1]:DUR;
const SC={{
 photos:(i,T,E)=>{{tl.set(C,{{x:at(i,290,700)[0],y:at(i,290,700)[1],z:1.65,onUpdate:applyCam}},0);ghost(`#g${{i}}`,.2);fly(`#s${{i}}a`,.15,{{from:{{x:-200,y:0,rotate:-8,scale:.9}}}});
   look(wt(i,'même')-.3,...at(i,790,750),1.55,1.2);fly(`#s${{i}}b`,wt(i,'même')-.2,{{from:{{x:300,y:0,rotate:8,scale:.9}}}});
   home(i,wt(i,'pink')-.4);draw(`#s${{i}}r`,wt(i,'pink')+.8,.6);say(`#s${{i}}l`,wt(i,'pink')+.8);label(`#s${{i}}n`,wt(i,'pink')+1.3);}},
 decor:(i,T,E)=>{{fly(`#s${{i}}a`,T+.05,{{from:{{x:0,y:200,rotate:-10,scale:.9}}}});look(T+.7,...at(i,800,580),1.4,1.1);fly(`#s${{i}}b`,T+.6,{{from:{{x:260,y:0,rotate:10,scale:.9}}}});
   home(i,wt(i,'décor')-.6);draw(`#s${{i}}r`,wt(i,'décor')+.6);label(`#s${{i}}h`,wt(i,'décor')+.8);say(`#s${{i}}l`,wt(i,'décor')+.4);label(`#s${{i}}h2`,wt(i,'vieillit')-.1);}},
 title:(i,T,E)=>{{ghost(`#g${{i}}`,T+.1);fly(`#s${{i}}a`,T+.05,{{from:{{x:0,y:0,rotate:-30,scale:.5}}}});home(i,T+.9,1.2);
   say(`#s${{i}}l`,wt(i,'time')-.1,{{dur:.8,st:.12}});label(`#s${{i}}n`,wt(i,'time')+.6);label(`#s${{i}}h`,wt(i,'souvenirs')-.2);}},
 waters:(i,T,E)=>{{ghost(`#g${{i}}`,T+.2);fly(`#s${{i}}a`,T+.05,{{from:{{x:-240,y:0,rotate:-6,scale:.9}}}});
   look(wt(i,'années')-.3,...at(i,790,710),1.45,1.1);fly(`#s${{i}}b`,wt(i,'années')-.2,{{from:{{x:0,y:300,rotate:12,scale:.8}}}});
   home(i,wt(i,'préparer')-1.4);label(`#s${{i}}n`,wt(i,'préparer')-.25);label(`#s${{i}}c`,wt(i,'préparer'));say(`#s${{i}}l`,wt(i,'préparer')-.1);label(`#s${{i}}h`,wt(i,'tard')-.2);}},
 clock:(i,T,E)=>{{fly(`#s${{i}}a`,T+.02,{{from:{{x:0,y:0,rotate:-90,scale:.4}},float:false}});home(i,T+.6,1.4);say(`#s${{i}}l`,wt(i,'minute')-.2);label(`#s${{i}}h`,wt(i,'vivre'));}},
 days:(i,T,E)=>{{$$(`[id^="s${{i}}d"]`).forEach((d,k)=>fly(d,T+.05+k*.12,{{from:{{x:0,y:160,rotate:(k%2?6:-6),scale:.6}},dur:.6}}));
   home(i,T+.3,1.0);label(`#s${{i}}h`,wt(i,'demain')-.1);draw(`#s${{i}}r`,wt(i,'demain')+.4,.5);say(`#s${{i}}l`,wt(i,'années')-.4);}},
 shop:(i,T,E)=>{{fly(`#s${{i}}a`,T+.05,{{from:{{x:0,y:220,rotate:0,scale:.9}}}});
   $$(`[id^="s${{i}}c"]`).forEach((d,k)=>fly(d,wt(i,'horloges')-.3+k*.14,{{from:{{x:(k%2?160:-160),y:80,rotate:(k%2?14:-14),scale:.5}},dur:.6}}));
   look(wt(i,'alan')-.3,...at(i,700,640),1.18,1.0);fly(`#s${{i}}b`,wt(i,'alan')-.2,{{from:{{x:280,y:0,rotate:8,scale:.8}}}});
   home(i,wt(i,'séparément')-.6,1.1);label(`#s${{i}}h`,wt(i,'séparément')+.6);label(`#s${{i}}n`,wt(i,'séparément')+.7);}},
 compare:(i,T,E)=>{{fly(`#s${{i}}a`,T+.05,{{from:{{x:0,y:400,rotate:-6,scale:.9}}}});fly(`#s${{i}}p1`,wt(i,'ancienne')-.2,{{from:{{x:-120,y:0,rotate:-10,scale:.6}},dur:.6}});
   fly(`#s${{i}}p2`,wt(i,'aujourd')-.2,{{from:{{x:120,y:0,rotate:10,scale:.6}},dur:.6}});home(i,T+.8,1.2);say(`#s${{i}}l`,wt(i,'comparer')-.1);label(`#s${{i}}h`,wt(i,'aujourd')+.4);}},
 question:(i,T,E)=>{{fly(`#s${{i}}a`,T+.05,{{from:{{x:0,y:0,rotate:30,scale:.6}},float:false}});home(i,T+.6,1.2);label(`#s${{i}}h`,wt(i,'dérangeante'));
   say(`#s${{i}}l`,wt(i,'vraie')-.3);say(`#s${{i}}l2`,wt(i,'commence')-.4);}},
}};
for(let i=0;i<N;i++){{
  const T=CUT(i),E=END(i),s=D.segs[i];
  (SC[s.scene]||(()=>{{}}))(i,T,E);
  if(i<N-1){{ /* sortie rapide + push-through vers le 1er objet de la scène suivante */
    const ids=$$(`[id^="s${{i}}"],#g${{i}}`);const X=(E-s.end>1.0)?E-.5:Math.min(E-.3,Math.max(E-.7,s.end+.05));   /* long blanc (moment musical) : la scène reste à l'écran */   /* sortie APRÈS le dernier mot, avant la coupe */
    ids.forEach(e=>e.classList.contains('line')?unsay('#'+e.id,X-.05):flyOut(e,X,{{to:{{x:0,y:-420,rotate:-6,scale:1.15}},dur:.4}}));
    const n=i+1;into(E,ORIG[n][0]+540,ORIG[n][1]+700,1.6);settle(E,ORIG[n][0]+540,ORIG[n][1]+760,1.55);
  }}
}}
tl.to({{}},{{duration:.01}},DUR);

/* éléments vivants déterministes (fonctions de t) : aiguilles, bobines, sous-titres, progression, moment musical */
const LIVE=$$('.hh,.mh,.sh,.reel');
function live(t){{
  LIVE.forEach(el=>{{const sp=+el.dataset.speed;let tt=t;
    if(el.classList.contains('stop')){{const q=D.segs[N-1].words.find(w=>w.w.toLowerCase().startsWith('commence'));if(q&&t>q.t)tt=q.t;}}
    const a=el.classList.contains('sh')?Math.floor(tt*2)*6:el.classList.contains('reel')?tt*sp*6:tt*sp*36;   // trotteuse par à-coups (tic-tac)
    el.style.transform=`rotate(${{a}}deg)`;}});
  // sous-titres : groupes de 5 mots, mot courant en rouille
  let html='';for(const s of D.segs){{const ws=s.words;const k=ws.findIndex(w=>t>=w.t&&t<w.e+.2);if(k>=0){{const g=Math.floor(k/5)*5;html='<span>'+ws.slice(g,g+5).map((w,j)=>g+j===k?`<b>${{w.w}}</b>`:w.w).join(' ')+'</span>';break;}}}}
  $('#cap').innerHTML=html;
  $('#prog i').style.width=(Math.min(1,t/DUR)*100)+'%';
  const br=(window.BREAKS||[]).find(b=>t>=b[0]-.1&&t<=b[1]+.1);$('#note').style.opacity=br?1:0;
}}
window.BREAKS={json.dumps(bt.get("breaks", []))};
tl.eventCallback('onUpdate',()=>live(tl.time()));
window.OPENER={{W:1080,H:1920,DURATION:DUR,tl,ready:false,seek(t){{tl.pause(t,false);applyCam();live(t);}}}};
const q=new URLSearchParams(location.search),vo=$('#vo');
function fit(){{const s=Math.min(innerWidth/1080,innerHeight/1920);$('#stage').style.transform=q.has('clean')?'none':`translate(${{(innerWidth-1080*s)/2}}px,${{(innerHeight-1920*s)/2}}px) scale(${{s}})`;$('#stage').style.transformOrigin='0 0';}}
addEventListener('resize',fit);fit();
document.fonts.ready.then(()=>{{applyCam();live(0);window.OPENER.ready=true;if(q.has('clean'))return;
  const go=()=>{{tl.play(0);vo.currentTime=0;vo.play().catch(()=>{{}});}};vo.play().then(()=>{{vo.currentTime=0;tl.play(0);}}).catch(()=>{{addEventListener('pointerdown',go,{{once:true}});}});}});
</script></body></html>'''
open(f"{web}/index.html", "w").write(page)
print(f"[bang-sketch] {web}/index.html — {len(segs)} scènes, {DUR}s")
