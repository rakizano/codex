#!/usr/bin/env python3
"""Génère les livrables texte à partir du storyboard :
  synchronisation.txt       où placer la musique originale dans TikTok / CapCut
  direction_artistique.txt  univers, palette, typographie, style, animation

  python3 finalize.py <projet> [--audio-json <work>/audio.json]
"""
import argparse
import json
import os


def fmt(t):
    m, s = divmod(t, 60)
    return f'{int(m)}:{s:06.3f}'


def mmss(t):
    m, s = divmod(round(t), 60)
    return f'{int(m)}:{int(s):02d}'


def clean(txt):
    return ' '.join(txt.replace('/', ' ').split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--audio-json')
    a = ap.parse_args()
    P = a.project
    sb = json.load(open(os.path.join(P, 'storyboard.json')))
    so, pa = sb['song'], sb['passage']
    audio = json.load(open(a.audio_json)) if a.audio_json and os.path.exists(a.audio_json) else None
    L = []
    L.append(f"TITRE      : {so['title']}")
    L.append(f"ARTISTE    : {so['artist']}")
    L.append(f"VERSION    : {so.get('album') or '?'} — durée de la version : {mmss(so['version_duration'])} ({so['version_duration']:.0f} s)")
    L.append('')
    ts = sb.get('tiktok_sound')
    if ts:
        L.append('SON TIKTOK UTILISÉ (clip calé dessus, de sa 1re à sa dernière seconde)')
        L.append(f"  Source   : {ts['source']}")
        L.append(f"  Durée    : {ts['duration_s']:.2f} s  (= durée exacte de video_finale.mp4)")
        L.append(f"  Passage de la chanson contenu dans le son : {fmt(ts['song_start_s'])} → {fmt(ts['song_end_s'])} (vitesse ×{ts['speed']:.3f})")
        L.append('')
        L.append('PLACER LA MUSIQUE')
        L.append('  ' + ts['instruction'])
        L.append('')
    else:
        L.append('PASSAGE UTILISÉ DANS LA CHANSON ORIGINALE')
        L.append(f"  Début    : {pa['start_fmt']}   ({pa['start']:.2f} s)")
        L.append(f"  Fin      : {pa['end_fmt']}   ({pa['end']:.2f} s)")
        L.append(f"  Durée    : {pa['duration']:.2f} s  (= durée exacte de video_finale.mp4)")
        L.append('')
        L.append('PLACER LA MUSIQUE')
        L.append(f"  TikTok : importer video_finale.mp4 > « Ajouter un son » > chercher « {so['title']} {so['artist']} »")
        L.append(f"           (version album, durée {mmss(so['version_duration'])}) > icône ciseaux « Couper »")
        L.append(f"           > faire glisser l'onde pour que le son démarre à {pa['start_fmt'][:-1]} ({pa['start']:.2f} s).")
        L.append(f"  CapCut : piste audio sous la vidéo à 0:00, puis couper le début du morceau à {pa['start_fmt']} ;")
        L.append(f"           la vidéo et la musique se terminent ensemble à {pa['end_fmt']}.")
        L.append(f"  Repère d'écoute : la 1re phrase chantée « {clean(next((ly['text'] for s in sb['scenes'] for ly in s.get('lyrics', [])), ''))} »")
        first = next((ly for s in sb['scenes'] for ly in s.get('lyrics', [])), None)
        if first:
            L.append(f"           commence à {fmt(first['song_t'])} dans la chanson = {first['start']:.2f} s dans la vidéo.")
        L.append('  Attention : TikTok propose parfois des versions raccourcies/accélérées ; choisir la version album.')
        L.append('')
    L.append('FIABILITÉ DES TIMESTAMPS')
    L.append(f"  Méthode  : paroles synchronisées LRCLIB, médiane de {so['n_sources']} source(s) concordante(s)")
    L.append(f"  Écart médian entre sources : {so.get('sync_spread_median_s')} s — confiance : {so['sync_confidence']}")
    for n in so.get('notes', []):
        L.append(f'  Note : {n}')
    if ts:
        L.append("  Synchronisation vérifiée sur l'audio du son TikTok (reconnaissance des paroles chantées).")
    elif audio:
        L.append(f"  Audio analysé : {audio['file']} (durée {audio['duration']:.2f} s, écart vs version {audio.get('lyrics_duration_diff_s')} s)")
        lo = audio.get('lyrics_offset')
        if lo:
            L.append(f"  Décalage LRC estimé par l'audio : {lo['best_offset_s']} s (z={lo['peak_z']}, {lo['interpretation']})")
    else:
        L.append("  Aucun fichier audio fourni : les timestamps n'ont PAS été vérifiés sur le signal audio.")
        L.append("  Si la synchro semble décalée dans TikTok, décaler le son de ±0,2 s suffit en général.")
    L.append('  Le timing mot par mot à l\'intérieur d\'une phrase est ESTIMÉ (répartition syllabique).')
    L.append('')
    L.append('PAROLES ET TIMESTAMPS (' + ('son TikTok' if ts else 'chanson') + ' | vidéo)')
    for s in sb['scenes']:
        for ly in s.get('lyrics', []):
            L.append(f"  {fmt(ly['song_t'])} | {ly['start']:6.2f}s  [{s['id']}]  {clean(ly['text'])}   (mot rouge : {ly.get('red')})")
    open(os.path.join(P, 'synchronisation.txt'), 'w').write('\n'.join(L) + '\n')

    d = sb.get('direction', {})
    D = [f"DIRECTION ARTISTIQUE — {so['artist']} « {so['title']} »", '']
    labels = [('concept', 'CONCEPT / NARRATION'), ('universe', 'UNIVERS VISUEL'), ('palette', 'PALETTE'), ('typography', 'TYPOGRAPHIE'),
              ('graphic_style', 'STYLE GRAPHIQUE'), ('animation_principles', "PRINCIPES D'ANIMATION"), ('transitions', 'TRANSITIONS & MONTAGE'),
              ('references', 'INFLUENCES')]
    for k, lab in labels:
        v = d.get(k)
        if not v:
            continue
        D.append(lab)
        if isinstance(v, dict):
            for kk, vv in v.items():
                D.append(f'  {kk:<14} {vv}')
        else:
            D.append('  ' + str(v))
        D.append('')
    D.append('DÉCOUPAGE (scène → image)')
    for s in sb['scenes']:
        txt = ' / '.join(clean(ly['text']) for ly in s.get('lyrics', [])) or '(instrumental)'
        D.append(f"  {s['id']} {s['start']:5.2f}-{s['end']:5.2f}s  {txt}")
        D.append(f"       image : {s.get('visual')}")
        if s.get('transition', {}).get('type'):
            D.append(f"       transition d'entrée : {s['transition']['type']}")
    open(os.path.join(P, 'direction_artistique.txt'), 'w').write('\n'.join(D) + '\n')
    print('OK synchronisation.txt + direction_artistique.txt')


if __name__ == '__main__':
    main()
