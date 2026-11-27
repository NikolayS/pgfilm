#!/usr/bin/env node
// Grab PNG stills of the film at given times, optionally a labelled contact sheet.
// A poster is a still: --t 0 --scale 2. Stills go to --out (default: build/stills).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  FFMPEG, usage, checkFfmpeg, startServer, launchWorkers, resolvePage, filmUrl, seekAndCapture,
  run, progressLine, averageSubframes, fmtT,
} from './lib.mjs';

const USAGE = `usage: node still.mjs --page src/index.html (--t 0.5,3,7.25 | --every 1.0) [--sheet] [--cols 4]
  [--root <served dir; default: nearest folder above the page with a package.json>]
  [--width 1920] [--height 1080] [--scale 1]
  [--query "a=1"] [--out build/stills] [--workers 4] [--subframes 1] [--shutter 0.5]
  [--fps <page fps>] [--reset display|far|none] [--color-scheme dark|light]`;

const { values: a } = parseArgs({
  options: {
    page: { type: 'string' }, t: { type: 'string' }, every: { type: 'string' }, root: { type: 'string' },
    'color-scheme': { type: 'string', default: 'dark' },
    sheet: { type: 'boolean', default: false }, cols: { type: 'string', default: '4' },
    width: { type: 'string', default: '1920' }, height: { type: 'string', default: '1080' },
    scale: { type: 'string', default: '1' }, query: { type: 'string', default: '' },
    out: { type: 'string', default: 'build/stills' }, workers: { type: 'string', default: '4' },
    subframes: { type: 'string', default: '1' }, shutter: { type: 'string', default: '0.5' },
    fps: { type: 'string' }, reset: { type: 'string', default: 'display' },
    help: { type: 'boolean', short: 'h' },
  },
});
usage(USAGE, { help: a.help, missing: !a.page || (!a.t && !a.every) });

const width = +a.width, height = +a.height, scale = +a.scale;
const N = Math.max(1, Math.round(+a.subframes)), shutter = +a.shutter;
const outDir = path.resolve(a.out);
fs.mkdirSync(outDir, { recursive: true });

const errors = [];
const onError = (msg) => { errors.push(msg); process.stderr.write(`\n[page] ${msg}\n`); };
const { root, rel } = resolvePage(a.page, a.root);
if (a.sheet || N > 1) await checkFfmpeg();
const server = await startServer(root);
let pool = null, exitCode = 0;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgfilm-still-'));
try {
  const url = filmUrl(server.origin, rel, a.query);
  const explicit = a.t ? a.t.split(',').map((s) => s.trim()).filter(Boolean).map(Number) : null;
  if (explicit && explicit.some((x) => !Number.isFinite(x))) throw new Error(`bad --t list: ${a.t}`);
  const nWorkers = Math.max(1, Math.min(+a.workers, explicit ? explicit.length * N : +a.workers));
  pool = await launchWorkers(nWorkers, { url, width, height, scale, onError, colorScheme: a['color-scheme'] });
  const { fps: pageFps, duration } = pool.pages[0].info;
  const fps = a.fps ? +a.fps : pageFps;

  let times = explicit;
  if (!times) {
    const step = +a.every;
    if (!(step > 0)) throw new Error('--every must be > 0');
    times = [];
    for (let k = 0; k * step < duration - 1e-9; k++) times.push(+(k * step).toFixed(6));
  }
  const names = times.map((t) => fmtT(t) + '.png');

  // jobs: still s, sub-frame k -> capture index s*N + k
  const jobs = times.length * N;
  const capDir = N > 1 ? path.join(tmp, 'sub') : outDir;
  fs.mkdirSync(capDir, { recursive: true });
  const capName = (j) => N > 1 ? String(j).padStart(6, '0') + '.png' : names[j];
  let next = 0, done = 0;
  const t0 = performance.now();
  await Promise.all(pool.pages.map(async (ctx) => {
    while (!errors.length) {
      const j = next++;
      if (j >= jobs) return;
      const s = Math.floor(j / N), k = j % N;
      ctx.frame = `t=${times[s]}${N > 1 ? ` sub ${k}` : ''}`;
      const png = await seekAndCapture(ctx, times[s] + (k * shutter) / N / fps, { reset: a.reset })
        .catch((e) => { throw new Error(`${ctx.frame}: ${e.message}`); });
      await fs.promises.writeFile(path.join(capDir, capName(j)), png);
      progressLine(`still ${++done}/${jobs}`);
    }
  }));
  process.stderr.write(`\n${done} captures in ${((performance.now() - t0) / 1000).toFixed(1)} s\n`);
  if (errors.length) throw new Error(`${errors.length} page error(s) (first: ${errors[0]})`);

  // label renderer for the sheet uses the same browser before we close it
  let labelFor = null;
  if (a.sheet) {
    const lp = await pool.pages[0].context.newPage();
    // labels are drawn by the browser (not every ffmpeg build has drawtext)
    await lp.setContent(`<style>html,body{margin:0;background:transparent}
      #l{display:inline-block;font:600 20px/1 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(0,0,0,.72);padding:6px 9px;border-radius:5px}</style>
      <span id="l"></span>`, { waitUntil: 'load' });
    labelFor = async (text, file) => {
      await lp.evaluate((s) => { document.getElementById('l').textContent = s; }, text);
      await lp.locator('#l').screenshot({ path: file, omitBackground: true, scale: 'css' });
    };
    for (let s = 0; s < times.length; s++) await labelFor(`${times[s].toFixed(2)} s`, path.join(tmp, `label-${s}.png`));
  }
  await pool.close(); pool = null;

  if (N > 1) {
    const avgDir = path.join(tmp, 'avg');
    fs.mkdirSync(avgDir);
    await averageSubframes(path.join(capDir, '%06d.png'), N, path.join(avgDir, '%06d.png'));
    for (let s = 0; s < times.length; s++) {
      fs.renameSync(path.join(avgDir, String(s).padStart(6, '0') + '.png'), path.join(outDir, names[s]));
    }
  }
  for (const n of names) if (!fs.existsSync(path.join(outDir, n))) throw new Error(`missing still ${n}`);
  process.stderr.write(`wrote ${names.length} stills to ${outDir}\n`);

  if (a.sheet) {
    // cells: still scaled to 480 px wide, with the timestamp in a strip underneath
    const cellDir = path.join(tmp, 'cells');
    fs.mkdirSync(cellDir);
    for (let s = 0; s < times.length; s++) {
      await run(FFMPEG, ['-v', 'error', '-y', '-i', path.join(outDir, names[s]), '-i', path.join(tmp, `label-${s}.png`),
        '-filter_complex', '[0:v]scale=480:-2:flags=lanczos,pad=iw:ih+40:0:0:color=0x202631[c];[c][1:v]overlay=4:H-h-4',
        path.join(cellDir, String(s).padStart(6, '0') + '.png')], { quiet: true });
    }
    const cols = Math.max(1, +a.cols), maxRows = 8, perSheet = cols * maxRows; // more cells: sheet-1.jpg, sheet-2.jpg, ...
    const sheets = Math.ceil(times.length / perSheet);
    for (let sh = 0; sh < sheets; sh++) {
      const count = Math.min(perSheet, times.length - sh * perSheet);
      const rows = Math.ceil(count / cols);
      const file = path.join(outDir, sheets > 1 ? `sheet-${sh + 1}.jpg` : 'sheet.jpg');
      await run(FFMPEG, ['-v', 'error', '-y', '-start_number', String(sh * perSheet), '-i', path.join(cellDir, '%06d.png'),
        '-vf', `trim=end_frame=${count},tile=${cols}x${rows}:padding=6:margin=6:color=0x202631`,
        '-update', '1', '-frames:v', '1', '-q:v', '3', file], { quiet: true });
      process.stderr.write(`wrote ${file} (${count} cells)\n`);
    }
  }
} catch (e) {
  process.stderr.write(`\nERROR: ${e.stack || e.message}\n`);
  exitCode = 1;
} finally {
  if (pool) await pool.close();
  await server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
process.exit(exitCode);
