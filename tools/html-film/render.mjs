#!/usr/bin/env node
// HTML film page -> PNG frames (parallel headless Chromium) -> H.264 MP4.
// The film's folder (the nearest one above the page with a package.json) is served as a static site.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import {
  die, usage, checkFfmpeg, startServer, launchWorkers, resolvePage, filmUrl, seekAndCapture,
  pngSize, progressLine, averageSubframes, countFiles, startPipeEncoder,
} from './lib.mjs';

const USAGE = `usage: node render.mjs --page src/index.html --out build/name.mp4
  [--root <served dir; default: nearest folder above the page with a package.json>]
  [--width 1920] [--height 1080] [--scale 1]
  [--fps <page fps>] [--from 0] [--to <duration>] [--workers 6] [--query "a=1&b=2"]
  [--crf 16] [--maxrate <Mbps>] [--audio a.wav] [--keep-frames]
  [--subframes 1] [--shutter 0.5] [--chunk 60]
  [--reset display|far|none] [--no-sync-css-animations] [--color-scheme dark|light]`;

const { values: a } = parseArgs({
  options: {
    page: { type: 'string' }, out: { type: 'string' }, root: { type: 'string' },
    'color-scheme': { type: 'string', default: 'dark' },
    width: { type: 'string', default: '1920' }, height: { type: 'string', default: '1080' },
    scale: { type: 'string', default: '1' }, fps: { type: 'string' },
    from: { type: 'string', default: '0' }, to: { type: 'string' },
    workers: { type: 'string', default: '6' }, query: { type: 'string', default: '' },
    crf: { type: 'string', default: '16' }, audio: { type: 'string' },
    subframes: { type: 'string', default: '1' }, shutter: { type: 'string', default: '0.5' },
    reset: { type: 'string', default: 'display' },
    chunk: { type: 'string' }, maxrate: { type: 'string' },
    'keep-frames': { type: 'boolean', default: false },
    'no-sync-css-animations': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
});
usage(USAGE, { help: a.help, missing: !a.page || !a.out });

const width = +a.width, height = +a.height, scale = +a.scale, workers = Math.max(1, +a.workers);
const N = Math.max(1, Math.round(+a.subframes)), shutter = +a.shutter;
if (!(shutter > 0 && shutter <= 1)) die('--shutter must be in (0, 1]');
if (!['far', 'display', 'none'].includes(a.reset)) die('--reset must be far, display or none');
if (!['dark', 'light'].includes(a['color-scheme'])) die('--color-scheme must be dark or light');
const outFile = path.resolve(a.out);
const name = path.basename(outFile, path.extname(outFile));
const framesDir = path.join(path.dirname(outFile), `.frames-${name}`);
const subDir = path.join(framesDir, 'sub');
if (a.audio && !fs.existsSync(a.audio)) die(`audio file not found: ${a.audio}`);
const pad = (k) => String(k).padStart(6, '0') + '.png';

const errors = [];
const onError = (msg) => { errors.push(msg); process.stderr.write(`\n[page] ${msg}\n`); };

const { root, rel } = resolvePage(a.page, a.root);
await checkFfmpeg();
const server = await startServer(root);
let pool = null, encoder = null;
let exitCode = 0;
try {
  const url = filmUrl(server.origin, rel, a.query);
  pool = await launchWorkers(workers, { url, width, height, scale, onError, colorScheme: a['color-scheme'] });
  process.stderr.write(`browser: ${pool.version} (${pool.executablePath || 'playwright default'})\nserving: ${root}\nurl: ${url}\n`);
  const info = pool.pages[0].info;
  const fps = a.fps ? +a.fps : info.fps;
  if (!(fps > 0)) throw new Error(`invalid fps (${fps}); page __film.fps=${info.fps}`);
  const duration = info.duration;
  if (!(duration > 0)) throw new Error(`page __film.duration is ${duration} after ready`);
  const from = +a.from, to = a.to != null ? +a.to : duration;
  const first = Math.round(from * fps), end = Math.round(to * fps); // [first, end)
  const total = end - first;
  if (total <= 0) throw new Error(`empty frame range from=${from} to=${to}`);

  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  if (N > 1) fs.mkdirSync(subDir, { recursive: true });
  const expectW = Math.round(width * scale), expectH = Math.round(height * scale);
  // Chunked capture: capture `chunk` output frames' worth of (sub-)frames, average sub-frames
  // into framesDir (global numbering), pipe that chunk's frames to the already-running encoder
  // in order and delete them. Peak disk ~ chunk*N sub-frames + chunk final frames.
  const chunk = Math.max(1, a.chunk ? Math.round(+a.chunk) : 60);
  const nChunks = Math.ceil(total / chunk);
  process.stderr.write(`frames ${first}..${end - 1} (${total}) @ ${fps} fps` +
    (N > 1 ? ` x ${N} sub-frames (shutter ${shutter})` : '') + `, chunks of ${chunk} frames` +
    `, ${expectW}x${expectH}px, ${workers} workers, reset=${a.reset} -> ${framesDir}\n`);

  const MIN_FREE = 3 * 1024 ** 3;
  const checkDisk = () => {
    const st = fs.statfsSync(framesDir);
    const free = st.bavail * st.bsize;
    if (free < MIN_FREE) {
      throw new Error(`only ${(free / 1024 ** 3).toFixed(2)} GiB free on the output volume (< 3 GiB); ` +
        `stopping before the disk fills. Free space, or render a shorter --from/--to range.`);
    }
    return free;
  };

  // ---- encoder, started up front; frames are piped in chunk by chunk ----
  // PNG is full-range sRGB R'G'B'. Convert with the BT.709 matrix to limited (tv) range with
  // accurate rounding and full-res chroma filtering, then tag BT.709 (setparams makes the
  // tags stick; ffmpeg 8 otherwise writes primaries/trc as "unknown").
  const videoSecs = total / fps;
  const vf = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp,' +
    'format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709';
  const gop = String(Math.round(fps * 2));
  const args = ['-hide_banner', '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-'];
  if (a.audio) args.push('-i', a.audio);
  args.push('-map', '0:v:0', '-vf', vf,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', String(a.crf), '-pix_fmt', 'yuv420p',
    '-g', gop, '-keyint_min', gop, '-sc_threshold', '0',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-fps_mode', 'cfr', '-r', String(fps));
  if (a.maxrate) {
    const m = +a.maxrate;
    if (!(m > 0)) throw new Error('--maxrate must be a positive number of Mbit/s');
    args.push('-maxrate', `${m}M`, '-bufsize', `${2 * m}M`);
  }
  if (a.audio) args.push('-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-af', 'apad');
  args.push('-t', videoSecs.toFixed(6), '-movflags', '+faststart', outFile);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  process.stderr.write(`ffmpeg ${args.join(' ')}\n`);
  encoder = startPipeEncoder(args);
  let fed = 0;

  const jobsTotal = total * N;
  const opts = { syncCssAnimations: !a['no-sync-css-animations'], reset: a.reset };
  let done = 0, lastPrint = 0, maxSubFiles = 0, avgSecs = 0;
  const t0 = performance.now();
  for (let c = 0; c < nChunks; c++) {
    checkDisk();
    const c0 = c * chunk, cN = Math.min(chunk, total - c0); // output frames [c0, c0+cN) relative to first
    const jobs = cN * N;
    // job j in chunk -> output frame k0 = c0 + floor(j/N), sub-frame k = j%N
    // N=1: written straight to framesDir as the global frame number; N>1: chunk-local sub index
    const capPath = (j) => N > 1 ? path.join(subDir, pad(j)) : path.join(framesDir, pad(c0 + j));
    let next = 0;
    await Promise.all(pool.pages.map(async (ctx) => {
      while (!errors.length) {
        const j = next++;
        if (j >= jobs) return;
        const i = first + c0 + Math.floor(j / N), k = j % N;
        ctx.frame = N > 1 ? `${i}.${k}` : i;
        const png = await seekAndCapture(ctx, (i + (k * shutter) / N) / fps, opts)
          .catch((e) => { throw new Error(`frame ${ctx.frame}: ${e.message}`); });
        const { w: pw, h: ph } = pngSize(png);
        if (pw !== expectW || ph !== expectH) throw new Error(`frame ${ctx.frame}: captured ${pw}x${ph}, expected ${expectW}x${expectH}`);
        await fs.promises.writeFile(capPath(j), png);
        done++;
        const now = performance.now();
        if (now - lastPrint > 250 || done === jobsTotal) {
          lastPrint = now;
          const rate = done / ((now - t0) / 1000);
          progressLine(`capture ${done}/${jobsTotal}  ${rate.toFixed(1)} captures/s  chunk ${c + 1}/${nChunks}  eta ${((jobsTotal - done) / rate).toFixed(0)} s`);
        }
      }
    }));
    if (errors.length) throw new Error(`${errors.length} page error(s) during capture (first: ${errors[0]})`);
    const missing = [];
    for (let j = 0; j < jobs; j++) if (!fs.existsSync(capPath(j))) missing.push(j);
    if (missing.length) throw new Error(`chunk ${c + 1}: ${missing.length} capture(s) missing: ${missing.slice(0, 20).join(', ')}`);
    if (N > 1) {
      maxSubFiles = Math.max(maxSubFiles, countFiles(subDir, /\.png$/));
      const ta = performance.now();
      await averageSubframes(path.join(subDir, '%06d.png'), N, path.join(framesDir, '%06d.png'), c0);
      avgSecs += (performance.now() - ta) / 1000;
      for (let k = c0; k < c0 + cN; k++) {
        if (!fs.existsSync(path.join(framesDir, pad(k)))) throw new Error(`chunk ${c + 1}: averaged frame ${first + k} missing`);
      }
      fs.rmSync(subDir, { recursive: true, force: true });
      fs.mkdirSync(subDir);
    }
    // pipe this chunk's final frames to the encoder in order, then drop them from disk
    for (let k = c0; k < c0 + cN; k++) {
      const f = path.join(framesDir, pad(k));
      await encoder.write(await fs.promises.readFile(f));
      fed++;
      if (!a['keep-frames']) await fs.promises.unlink(f);
    }
  }
  const capSecs = (performance.now() - t0) / 1000;
  process.stderr.write(`\ncaptured ${done} images in ${capSecs.toFixed(1)} s = ${(done / capSecs).toFixed(1)} captures/s = ${(done / N / capSecs).toFixed(1)} output fps` +
    (N > 1 ? ` (incl. ${avgSecs.toFixed(1)} s averaging; max ${maxSubFiles} sub-frame files on disk at once)` : '') + '\n');
  await pool.close(); pool = null;
  if (N > 1) fs.rmSync(subDir, { recursive: true, force: true });
  if (fed !== total) throw new Error(`fed ${fed} frames to the encoder, expected ${total}`);
  const tFin = performance.now();
  const encErr = await encoder.finish();
  encoder = null;

  if (!a['keep-frames']) fs.rmSync(framesDir, { recursive: true, force: true });
  if (encErr) process.stderr.write(encErr);
  process.stderr.write(`encoded ${outFile}; encoder finished ${((performance.now() - tFin) / 1000).toFixed(1)} s after the last chunk\n`);
} catch (e) {
  process.stderr.write(`\nERROR: ${e.stack || e.message}\n`);
  exitCode = 1;
  if (encoder) { encoder.kill(); fs.rmSync(outFile, { force: true }); }
} finally {
  if (pool) await pool.close();
  await server.close();
}
process.exit(exitCode);
