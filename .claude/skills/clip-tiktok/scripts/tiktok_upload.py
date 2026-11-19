#!/usr/bin/env python3
"""Envoi d'un clip dans la boîte de réception (brouillons) TikTok via l'API officielle
« Content Posting API — Upload » (scope video.upload). La vidéo n'est PAS publiée :
TikTok envoie une notification ; le créateur l'ouvre, vérifie et appuie sur « Publier ».

Secrets lus dans l'environnement (jamais en argument) :
  TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REFRESH_TOKEN
Option de test : TIKTOK_API_BASE (défaut https://open.tiktokapis.com)

Commandes :
  auth-url --redirect-uri URI                    URL d'autorisation à ouvrir (une seule fois)
  exchange --code CODE --redirect-uri URI --out tokens.json
  refresh --out tokens.json                      nouveau jeton (le refresh_token TOURNE : le resauver)
  upload --tokens tokens.json --video clip.mp4 [--wait 300]
"""
import argparse
import json
import math
import os
import secrets
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get('TIKTOK_API_BASE', 'https://open.tiktokapis.com').rstrip('/')
AUTH = 'https://www.tiktok.com/v2/auth/authorize/'
SCOPES = 'user.info.basic,video.upload'
MB = 1024 * 1024
SINGLE_MAX = 64 * MB      # en dessous : un seul morceau
CHUNK = 10 * MB           # sinon morceaux de 10 Mo (bornes API : 5-64 Mo, dernier ≤ 128 Mo)


def env(name):
    v = os.environ.get(name)
    if not v:
        sys.exit(f'Variable d\'environnement manquante : {name}')
    return v


def call(method, url, data=None, headers=None, form=False):
    h = dict(headers or {})
    body = None
    if data is not None:
        if form:
            body = urllib.parse.urlencode(data).encode()
            h['Content-Type'] = 'application/x-www-form-urlencoded'
        elif isinstance(data, (bytes, bytearray)):
            body = bytes(data)
        else:
            body = json.dumps(data).encode()
            h['Content-Type'] = 'application/json; charset=UTF-8'
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw and raw[:1] in b'{[' else {})
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'raw': raw[:500].decode(errors='replace')}


def api_error(resp):
    err = resp.get('error') or {}
    if isinstance(err, dict) and err.get('code') not in (None, 'ok'):
        return f"{err.get('code')}: {err.get('message')} (log_id {err.get('log_id')})"
    if 'error' in resp and isinstance(resp['error'], str):  # format OAuth
        return f"{resp['error']}: {resp.get('error_description')}"
    return None


def save_tokens(resp, out):
    if 'access_token' not in resp:
        sys.exit('Réponse OAuth inattendue : ' + (api_error(resp) or json.dumps(resp)[:300]))
    with open(out, 'w') as f:
        json.dump(resp, f)
    os.chmod(out, 0o600)
    print(json.dumps({'ok': True, 'open_id': resp.get('open_id'), 'scope': resp.get('scope'),
                      'access_expires_in_s': resp.get('expires_in'), 'refresh_expires_in_s': resp.get('refresh_expires_in'),
                      'tokens_file': out}, indent=1))


def cmd_auth_url(a):
    q = {'client_key': env('TIKTOK_CLIENT_KEY'), 'scope': SCOPES, 'response_type': 'code',
         'redirect_uri': a.redirect_uri, 'state': secrets.token_urlsafe(12)}
    print(AUTH + '?' + urllib.parse.urlencode(q))


def cmd_exchange(a):
    code = urllib.parse.unquote(a.code.strip())  # code copié depuis la barre d'adresse (souvent encodé)
    st, r = call('POST', f'{BASE}/v2/oauth/token/', {
        'client_key': env('TIKTOK_CLIENT_KEY'), 'client_secret': env('TIKTOK_CLIENT_SECRET'),
        'code': code, 'grant_type': 'authorization_code', 'redirect_uri': a.redirect_uri}, form=True)
    save_tokens(r, a.out)


def cmd_refresh(a):
    st, r = call('POST', f'{BASE}/v2/oauth/token/', {
        'client_key': env('TIKTOK_CLIENT_KEY'), 'client_secret': env('TIKTOK_CLIENT_SECRET'),
        'grant_type': 'refresh_token', 'refresh_token': env('TIKTOK_REFRESH_TOKEN')}, form=True)
    save_tokens(r, a.out)


def plan_chunks(size):
    if size <= SINGLE_MAX:
        return size, 1
    return CHUNK, size // CHUNK  # nombre de morceaux = arrondi inférieur ; le dernier absorbe le reste


def cmd_upload(a):
    tok = json.load(open(a.tokens))['access_token']
    auth = {'Authorization': f'Bearer {tok}'}
    size = os.path.getsize(a.video)
    chunk, n = plan_chunks(size)
    st, r = call('POST', f'{BASE}/v2/post/publish/inbox/video/init/', {
        'source_info': {'source': 'FILE_UPLOAD', 'video_size': size, 'chunk_size': chunk, 'total_chunk_count': n}}, auth)
    if st != 200 or api_error(r):
        sys.exit(f'Échec init ({st}) : {api_error(r) or r}')
    pid, url = r['data']['publish_id'], r['data']['upload_url']
    with open(a.video, 'rb') as f:
        for i in range(n):
            start = i * chunk
            end = size - 1 if i == n - 1 else start + chunk - 1
            f.seek(start)
            data = f.read(end - start + 1)
            st, rr = call('PUT', url, data, {'Content-Type': 'video/mp4', 'Content-Length': str(len(data)),
                                             'Content-Range': f'bytes {start}-{end}/{size}'})
            if st not in (200, 201, 206):
                sys.exit(f'Échec envoi du morceau {i + 1}/{n} ({st}) : {rr}')
            print(f'morceau {i + 1}/{n} envoyé ({len(data) / MB:.1f} Mo, HTTP {st})')
    status, t0 = None, time.time()
    while time.time() - t0 < a.wait:
        st, s = call('POST', f'{BASE}/v2/post/publish/status/fetch/', {'publish_id': pid}, auth)
        if api_error(s):
            sys.exit(f'Échec statut : {api_error(s)}')
        status = s.get('data', {}).get('status')
        if status in ('SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE'):
            break
        if status == 'FAILED':
            sys.exit(f"TikTok a refusé la vidéo : {s.get('data', {}).get('fail_reason')}")
        time.sleep(a.poll)
    print(json.dumps({'publish_id': pid, 'status': status, 'video': os.path.basename(a.video), 'size_mb': round(size / MB, 1),
                      'message': 'Ouvrez TikTok : une notification vous invite à finaliser et publier la vidéo.'
                      if status == 'SEND_TO_USER_INBOX' else 'Statut final non confirmé dans le délai.'}, indent=1, ensure_ascii=False))
    return 0 if status in ('SEND_TO_USER_INBOX', 'PUBLISH_COMPLETE') else 3


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('auth-url'); p.add_argument('--redirect-uri', required=True)
    p = sub.add_parser('exchange'); p.add_argument('--code', required=True); p.add_argument('--redirect-uri', required=True); p.add_argument('--out', required=True)
    p = sub.add_parser('refresh'); p.add_argument('--out', required=True)
    p = sub.add_parser('upload'); p.add_argument('--tokens', required=True); p.add_argument('--video', required=True)
    p.add_argument('--wait', type=float, default=300); p.add_argument('--poll', type=float, default=5)
    a = ap.parse_args()
    return {'auth-url': cmd_auth_url, 'exchange': cmd_exchange, 'refresh': cmd_refresh, 'upload': cmd_upload}[a.cmd](a)


if __name__ == '__main__':
    sys.exit(main() or 0)
