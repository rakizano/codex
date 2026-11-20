#!/usr/bin/env python3
"""Ajoute la musique originale à un clip, exactement au passage du storyboard.

  python3 add_music.py <projet> --audio <fichier audio du morceau complet> [--offset 0.0] [--no-align]

- Coupe le morceau de passage.start à passage.end (temps de la chanson originale).
- Vérifie que le fichier audio correspond à la version utilisée (durée ±2 s) ; sinon refuse,
  car les timestamps ne seraient plus valables (sauf --force).
- Si work/lyrics.json existe, mesure le décalage global paroles↔voix (audio_analyze.py) et
  le corrige seulement s'il est net (|décalage| > 0,15 s et pic z > 3).
- Fondu d'entrée 30 ms / sortie 400 ms, AAC 192 kb/s 44,1 kHz, vidéo copiée sans réencodage.
Sortie : <projet>/video_avec_musique.mp4
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
                                capture_output=True, text=True, check=True).stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('project')
    ap.add_argument('--audio', required=True)
    ap.add_argument('--offset', type=float, default=None, help='décalage manuel (s) ajouté au début du passage')
    ap.add_argument('--no-align', action='store_true')
    ap.add_argument('--force', action='store_true', help='accepter une durée audio différente de la version')
    a = ap.parse_args()
    P = a.project
    sb = json.load(open(os.path.join(P, 'storyboard.json')))
    pa, so = sb['passage'], sb['song']
    video = os.path.join(P, 'video_finale.mp4')
    vd, ad = dur(video), dur(a.audio)
    report = {'audio_file': os.path.basename(a.audio), 'audio_duration': round(ad, 3), 'version_duration': so['version_duration']}
    diff = ad - so['version_duration']
    if abs(diff) > 2.0 and not a.force:
        print(json.dumps({'error': f"Le fichier audio dure {ad:.1f} s alors que la version synchronisée dure {so['version_duration']:.1f} s : "
                                   "ce n'est probablement pas la même version (radio edit, live, remaster…). Fournir la version album ou utiliser --force.",
                          **report}, ensure_ascii=False, indent=1))
        return 2
    off = 0.0
    lyr = os.path.join(P, 'work', 'lyrics.json')
    if a.offset is not None:
        off = a.offset
        report['offset_source'] = 'manuel'
    elif not a.no_align and os.path.exists(lyr):
        work = os.path.join(P, 'work')
        subprocess.run([sys.executable, os.path.join(HERE, 'audio_analyze.py'), a.audio, '--out', work, '--lyrics', lyr],
                       check=True, capture_output=True)
        A = json.load(open(os.path.join(work, 'audio.json')))
        lo = A.get('lyrics_offset', {})
        report['measured_offset'] = lo
        if abs(lo.get('best_offset_s', 0)) > 0.15 and lo.get('peak_z', 0) > 3:
            off = lo['best_offset_s']
            report['offset_source'] = 'mesuré sur l\'audio'
        else:
            report['offset_source'] = 'aucun (pas de décalage net mesuré)'
    start = pa['start'] + off
    out = os.path.join(P, 'video_avec_musique.mp4')
    D = pa['duration']
    af = f'afade=t=in:st=0:d=0.03,afade=t=out:st={max(0, D - 0.4):.3f}:d=0.4,apad=whole_dur={D:.3f}'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-ss', f'{start:.3f}', '-t', f'{D:.3f}', '-i', a.audio,
                    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k', '-ar', '44100',
                    '-t', f'{vd:.3f}', '-movflags', '+faststart', out], check=True)
    od = dur(out)
    report.update({'applied_offset_s': round(off, 3), 'song_start_used': round(start, 3), 'output': out, 'output_duration': round(od, 3),
                   'video_duration': round(vd, 3)})
    json.dump(report, open(os.path.join(P, 'work', 'music_report.json'), 'w'), indent=1, ensure_ascii=False)
    print(json.dumps(report, indent=1, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
