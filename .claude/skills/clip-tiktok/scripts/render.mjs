#!/usr/bin/env node
/**
 * Rendu image par image d'un projet de clip (storyboard.json + scenes.js)
 * via Chromium headless (Playwright) puis encodage H.264 avec FFmpeg.
 *
 * Usage :
 *   node render.mjs --project <dossier> [--out video_finale.mp4] [--workers 4]
 *   node render.mjs --project <dossier> --stills 0.5,3.2,7 [--outdir stills]
 *   node render.mjs --project <dossier> --scene-stills   (1 image au milieu de chaque scène)
 *   node render.mjs --project <dossier> --rects          (positions du texte -> text_rects.json)
 *   node render.mjs --project <dossier> --preview        (rendu rapide 540x960, 15 fps)
 */
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENGINE = path.resolve(HERE, '../engine');

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) {
    if (!a[i].startsWith('--')) continue;
    const k = a[i].slice(2), v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
    o[k] = v;
  }
  return o;
}
const A = args();
if (!A.project) { console.error('--project requis'); process.exit(1); }
const PROJ = path.resolve(A.project);
const sb = JSON.parse(fs.readFileSync(path.join(PROJ, 'storyboard.json'), 'utf8'));
const FPS = A.preview ? 15 : (sb.fps || 30);
const DUR = sb.passage.duration;
const NFRAMES = Math.round(DUR * FPS);
const SCALE = A.preview ? 0.5 : 1;

function buildHTML() {
  const fontsCss = fs.existsSync(path.join(PROJ, 'fonts.css')) ? fs.readFileSync(path.join(PROJ, 'fonts.css'), 'utf8') : '';
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>${fontsCss}</style>
<link rel="stylesheet" href="file://${ENGINE}/engine.css">
<script src="file://${ENGINE}/engine.js"></script>
<script src="file://${path.join(PROJ, 'scenes.js')}"></script>
</head><body><script>window.__SB = ${JSON.stringify(sb)};</script></body></html>`;
  const dir = path.join(PROJ, 'build');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, 'index.html');
  fs.writeFileSync(f, html);
  return f;
}

async function openPage(browser, htmlFile) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: SCALE });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto('file://' + htmlFile);
  await page.evaluate(async () => {
    // charger explicitement toutes les @font-face AVANT la mise en page du texte
    await Promise.all([...document.fonts].map(f => f.load().catch(() => null)));
    await document.fonts.ready;
    CLIP.load(window.__SB);
    await document.fonts.ready;
  });
  const fontCheck = await page.evaluate(() => {
    const fams = new Set(); document.querySelectorAll('.chunk .box').forEach(b => fams.add(getComputedStyle(b).fontFamily.split(',')[0].replace(/['"]/g, '').trim()));
    return [...fams].map(f => ({ f, ok: document.fonts.check(`40px "${f}"`) }));
  });
  const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/['"]/g, '')));
  for (const fc of fontCheck) if (!loaded.includes(fc.f)) errors.push(`warning: police "${fc.f}" non chargée (fallback utilisé). Lancer fonts.py.`);
  return { page, errors };
}

function ffmpegSeg(out) {
  const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', A.preview ? 'veryfast' : 'medium', '-crf', A.preview ? '26' : '16', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-r', String(FPS), '-an', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  return p;
}

async function renderRange(browser, html, f0, f1, out, tag) {
  const { page, errors } = await openPage(browser, html);
  const ff = ffmpegSeg(out);
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate(T => CLIP.renderAt(T), f / FPS);
    const buf = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) process.stdout.write(`[${tag}] ${f - f0}/${f1 - f0} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  return errors;
}

async function main() {
  const html = buildHTML();
  const browser = await chromium.launch();
  try {
    if (A.stills || A['scene-stills']) {
      const outdir = path.resolve(A.outdir || path.join(PROJ, 'stills'));
      fs.mkdirSync(outdir, { recursive: true });
      const { page, errors } = await openPage(browser, html);
      let times;
      if (A['scene-stills']) times = sb.scenes.map(s => { const lyr = (s.lyrics || [])[0]; const t = lyr ? Math.min(s.end - .05, Math.max(lyr.start + 0.9, (s.start + s.end) / 2)) : (s.start + s.end) / 2; return +t.toFixed(3); });
      else times = String(A.stills).split(',').map(Number);
      const files = [];
      for (const [i, T] of times.entries()) {
        await page.evaluate(T => CLIP.renderAt(T), T);
        const f = path.join(outdir, `still_${String(i).padStart(2, '0')}_${T.toFixed(2)}s.png`);
        await page.screenshot({ path: f, type: 'png' }); files.push(f);
      }
      console.log(JSON.stringify({ stills: files, errors }, null, 1));
      return;
    }
    if (A.rects) {
      const { page, errors } = await openPage(browser, html);
      const rects = await page.evaluate(() => CLIP.textRects());
      fs.writeFileSync(path.join(PROJ, 'build', 'text_rects.json'), JSON.stringify({ rects, errors }, null, 1));
      console.log(JSON.stringify({ n: rects.length, errors }, null, 1));
      return;
    }
    const workers = Math.max(1, Math.min(+A.workers || Math.max(1, os.cpus().length), 8));
    const out = path.resolve(A.out || path.join(PROJ, A.preview ? 'preview.mp4' : 'video_finale.mp4'));
    const segDir = path.join(PROJ, 'build', 'segs'); fs.rmSync(segDir, { recursive: true, force: true }); fs.mkdirSync(segDir, { recursive: true });
    const per = Math.ceil(NFRAMES / workers), jobs = [], segs = [];
    console.log(`Rendu ${NFRAMES} images @${FPS}fps (${DUR.toFixed(2)}s) sur ${workers} workers…`);
    const t0 = Date.now();
    for (let w = 0; w < workers; w++) {
      const f0 = w * per, f1 = Math.min(NFRAMES, f0 + per); if (f0 >= f1) break;
      const seg = path.join(segDir, `seg_${w}.mp4`); segs.push(seg);
      jobs.push(renderRange(browser, html, f0, f1, seg, 'w' + w));
    }
    const errs = [...new Set((await Promise.all(jobs)).flat())];
    fs.writeFileSync(path.join(segDir, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
    await new Promise((res, rej) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(segDir, 'list.txt'), '-c', 'copy', '-movflags', '+faststart', '-an', out], { stdio: 'inherit' }).on('close', c => c === 0 ? res() : rej(new Error('concat ' + c))));
    fs.rmSync(segDir, { recursive: true, force: true });
    console.log(JSON.stringify({ out, frames: NFRAMES, seconds: ((Date.now() - t0) / 1000).toFixed(1), errors: errs }, null, 1));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exit(1); });
