#!/usr/bin/env python3
"""Note de qualité vocale prédite (DNSMOS, Microsoft ; modèles inclus dans le paquet pip `speechmos`).
Usage: voice_mos.py fichier1.wav [fichier2.wav ...]  -> classement (1 à 5, plus haut = mieux).
Sert à comparer voix et réglages SANS écouter ; ne remplace pas une écoute humaine (aveugle aux aigus > 8 kHz)."""
import glob, subprocess, sys, numpy as np
from speechmos import dnsmos
def load16(p):
    x=subprocess.run(["ffmpeg","-v","error","-i",p,"-ar","16000","-ac","1","-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(x,np.float32).copy()
rows=[]
for p in sys.argv[1:]:
    x=load16(p); x=x/max(1e-6,np.abs(x).max())*0.9
    r=dnsmos.run(x,16000)
    rows.append((r['ovrl_mos'],p.split('/')[-1][:56],r['sig_mos'],r['bak_mos']))
for o,t,s,b in sorted(rows,reverse=True): print(f"{t:<58} global {o:.2f}  voix {s:.2f}  fond {b:.2f}")
