// Rendu image par image d'une page Bang Motion (window.OPENER.seek) -> MP4 1080x1920 30 fps, audio mixé.
// Usage: node pipeline/render_html.cjs <index.html> <sortie.mp4> [fps]
// Pas d'enregistrement d'écran : chaque image est positionnée sur la timeline puis capturée (aucune image perdue).
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
const [,, page_, out, fpsArg] = process.argv;
const FPS = Number(fpsArg || 30);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
const url = pathToFileURL(path.resolve(page_)).href + '?clean=1';
const audio = path.join(path.dirname(path.resolve(page_)), 'mix.wav');
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction('window.OPENER && window.OPENER.ready', null, { timeout: 120000 });
await page.evaluate(() => document.fonts.ready);
const DUR = await page.evaluate(() => window.OPENER.DURATION);
const total = Math.ceil(DUR * FPS);
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let i = 0; i < total; i++) {
  await page.evaluate(async (t) => { window.OPENER.seek(t); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.log(`  image ${i}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log(`[render] ${out} (${total} images, ${DUR}s)`);
})();
