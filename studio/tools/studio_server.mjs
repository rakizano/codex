#!/usr/bin/env node
/* Interface de pilotage du studio (locale, sans dépendance) : node tools/studio_server.mjs [--port 4321]
 * puis ouvrir http://localhost:4321
 *  GET  /api/state              storyboard + bibliothèques (scènes, typographie, transitions, caméras) + analyse audio
 *  PUT  /api/storyboard         enregistre le storyboard modifié
 *  POST /api/audio              (corps = fichier audio) → assets/audio/sound.m4a puis analyse (tools/audio_analyzer.py)
 *  POST /api/lyrics             (corps JSON : lyrics_sound.json, ou { text: "ligne\nligne", times: [..] }) → input/lyrics_sound.json
 *  POST /api/direct             relance le Visual Director (storyboard.json régénéré)
 *  POST /api/build              compile storyboard → compositions HyperFrames
 *  POST /api/snapshot?at=1.2,3  images HyperFrames à ces instants (prévisualisation d'une séquence)
 *  POST /api/render             rendu MP4 HyperFrames (tâche de fond) ; GET /api/job pour suivre
 *  GET  /files/<chemin>         fichiers du projet (images d'aperçu, rendus)
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.argv[process.argv.indexOf('--port') + 1] || 0) || 4321;
const ENV = Object.assign({}, process.env, { DO_NOT_TRACK: '1', HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_NO_UPDATE_CHECK: '1' });
const HF = ['--yes', 'hyperframes@0.9.72'];
let job = { name: null, running: false, log: '', out: null };

const J = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
const run = (cmd, args, name) => new Promise(resolve => {
  job = { name, running: true, log: '', out: null };
  const p = spawn(cmd, args, { cwd: ROOT, env: ENV });
  p.stdout.on('data', d => { job.log += d; }); p.stderr.on('data', d => { job.log += d; });
  p.on('close', code => { job.running = false; job.code = code; resolve(code); });
});
const readJ = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/' || u.pathname === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(path.join(ROOT, 'ui/index.html'))); }
    if (u.pathname === '/api/state') {
      const sb = fs.existsSync(path.join(ROOT, 'storyboard.json')) ? readJ('storyboard.json') : null;
      return J(res, 200, { storyboard: sb, templates: readJ('config/visual-presets.json').templates, animations: readJ('config/animation-presets.json'), transitions: readJ('config/transition-presets.json'),
        cameras: ['static', 'dollyIn', 'dollyOut', 'truckLeft', 'truckRight', 'pedestalUp', 'pedestalDown', 'pan', 'tilt', 'orbit', 'crashZoom', 'slowZoom', 'roll', 'rackFocus', 'firstPerson'],
        audio: fs.existsSync(path.join(ROOT, 'config/audio.json')) ? readJ('config/audio.json') : null, job });
    }
    if (u.pathname === '/api/storyboard' && req.method === 'PUT') { const sb = JSON.parse(await body(req)); fs.writeFileSync(path.join(ROOT, 'storyboard.json'), JSON.stringify(sb, null, 1)); return J(res, 200, { ok: true }); }
    if (u.pathname === '/api/audio' && req.method === 'POST') { const b = await body(req); const tmp = path.join(ROOT, 'assets/audio/upload.bin'); fs.writeFileSync(tmp, b);
      await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vn', '-c:a', 'aac', '-b:a', '192k', 'assets/audio/sound.m4a'], 'import audio'); fs.rmSync(tmp);
      const code = await run('python3', ['tools/audio_analyzer.py', 'assets/audio/sound.m4a', '--out', 'config/audio.json', '--hf'], 'analyse audio'); return J(res, 200, { ok: code === 0, log: job.log.slice(-2000) }); }
    if (u.pathname === '/api/lyrics' && req.method === 'POST') { const d = JSON.parse(await body(req));
      let L = d; if (d.text) { const lines = d.text.split('\n').map(s => s.trim()).filter(Boolean); const times = d.times || lines.map((_, i) => i * 2.5); L = { lines: lines.map((t, i) => ({ t: times[i], end: times[i + 1] ?? times[i] + 2.5, text: t })) }; }
      fs.writeFileSync(path.join(ROOT, 'input/lyrics_sound.json'), JSON.stringify(L, null, 1)); return J(res, 200, { ok: true, lines: L.lines.length }); }
    if (u.pathname === '/api/direct' && req.method === 'POST') { const D = readJ('config/project.json').duration; const code = await run('python3', ['tools/visual_director.py', '--duration', String(D)], 'visual director'); return J(res, 200, { ok: code === 0, log: job.log }); }
    if (u.pathname === '/api/build' && req.method === 'POST') { const code = await run('python3', ['tools/build.py'], 'compilation'); return J(res, 200, { ok: code === 0, log: job.log }); }
    if (u.pathname === '/api/snapshot' && req.method === 'POST') { const at = u.searchParams.get('at') || '1';
      const code = await run('npx', [...HF, 'snapshot', '--at', at], 'aperçu'); const m = job.log.match(/(\.hyperframes\/artifacts\/snapshots\/[^\s]+\/contact-sheet[^\s]*\.jpg)/g) || job.log.match(/(\/[^\s]+contact-sheet[^\s]*\.jpg)/g) || [];
      return J(res, 200, { ok: code === 0, images: m.map(p => '/files/' + path.relative(ROOT, path.resolve(ROOT, p))), log: job.log.slice(-1500) }); }
    if (u.pathname === '/api/render' && req.method === 'POST') { if (job.running) return J(res, 409, { error: 'une tâche tourne déjà' });
      fs.mkdirSync(path.join(ROOT, 'renders'), { recursive: true }); const out = 'renders/clip.mp4';
      run('npx', [...HF, 'render', '--quality', u.searchParams.get('quality') || 'looks', '-o', out], 'rendu').then(() => { job.out = '/files/' + out; }); return J(res, 202, { started: true }); }
    if (u.pathname === '/api/job') return J(res, 200, job);
    if (u.pathname.startsWith('/files/')) { const f = path.resolve(ROOT, decodeURIComponent(u.pathname.slice(7))); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.json': 'application/json' }[ext] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res); }
    res.writeHead(404); res.end('404');
  } catch (e) { J(res, 500, { error: String(e) }); }
});
server.listen(PORT, () => console.log(`Studio : http://localhost:${PORT}`));
