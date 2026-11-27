// Shared helpers for render.mjs, still.mjs and serve.mjs: static server, browser launch,
// film page loading, deterministic seek + capture, motion blur, streaming encoder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

export const FFMPEG = process.env.FFMPEG || 'ffmpeg';

export function die(msg) {
  process.stderr.write(`\nERROR: ${msg}\n`);
  process.exit(1);
}

/** --help prints the usage and succeeds; a missing required argument prints it and fails. */
export function usage(text, { help, missing }) {
  if (help) { process.stdout.write(text + '\n'); process.exit(0); }
  if (missing) { process.stderr.write(text + '\n'); process.exit(2); }
}

// ---------- static server ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.map': 'application/json',
};

export function startServer(root, port = 0) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    let p;
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (p === '/favicon.ico') { res.writeHead(204).end(); return; }
    let file = path.join(root, p);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) { file = path.join(file, 'index.html'); }
      fs.readFile(file, (err2, buf) => {
        if (err2) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
        res.writeHead(200, {
          'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(buf);
      });
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ origin: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) });
    });
  });
}

// ---------- browser ----------
const CHROME_ARGS = [
  '--force-color-profile=srgb',
  '--hide-scrollbars',
  '--font-render-hinting=none',
  '--disable-lcd-text',
  '--run-all-compositor-stages-before-draw',
  '--disable-partial-raster', // re-raster whole tiles: no stale AA pixels from the previous frame
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-ipc-flooding-protection',
  '--disable-features=Translate,PaintHolding,BackForwardCache',
  '--autoplay-policy=no-user-gesture-required',
  '--mute-audio',
  '--no-first-run',
  '--no-default-browser-check',
];

// Where Playwright keeps downloaded browsers on this OS.
function playwrightCacheDirs() {
  const dirs = [];
  const env = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (env && env !== '0') dirs.push(env);
  const home = os.homedir();
  if (process.platform === 'darwin') dirs.push(path.join(home, 'Library/Caches/ms-playwright'));
  else if (process.platform === 'win32') dirs.push(path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'ms-playwright'));
  else dirs.push(path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright'));
  return dirs;
}

// Prefer an explicit CHROME_PATH, then the newest cached Playwright headless shell (whatever
// playwright-core version downloaded it), then an installed Chrome/Chromium.
function findExecutable() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const exe = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
  for (const cache of playwrightCacheDirs()) {
    let revs = [];
    try {
      revs = fs.readdirSync(cache).filter((d) => /^chromium_headless_shell-\d+$/.test(d))
        .sort((x, y) => Number(y.split('-')[1]) - Number(x.split('-')[1]));
    } catch {}
    for (const rev of revs) {
      let subs = [];
      try { subs = fs.readdirSync(path.join(cache, rev)); } catch {}
      for (const sub of subs) {
        const file = path.join(cache, rev, sub, exe);
        if (fs.existsSync(file)) return file;
      }
    }
  }
  const installed = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'],
  }[process.platform] || [];
  for (const file of installed) if (fs.existsSync(file)) return file;
  return undefined; // let playwright try its own default
}

export async function launchBrowser() {
  const executablePath = findExecutable();
  const args = [...CHROME_ARGS, ...(process.env.CHROME_EXTRA_ARGS || '').split(' ').filter(Boolean)];
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true, args });
  } catch (e) {
    throw new Error(`could not start a browser (${executablePath || 'playwright default'}): ${e.message.split('\n')[0]}\n` +
      'Install one with `npx playwright-core install chromium-headless-shell`, or set CHROME_PATH to a Chrome/Chromium binary.');
  }
  return { browser, executablePath, version: browser.version() };
}

/** Fail early, with a readable message, when ffmpeg is missing. */
export async function checkFfmpeg() {
  try { await run(FFMPEG, ['-version'], { quiet: true }); }
  catch (e) { die(`cannot run ffmpeg ("${FFMPEG}"): ${e.message.split('\n')[0]}\nInstall ffmpeg (with libx264) or set FFMPEG=/path/to/ffmpeg.`); }
}

// ---------- film page ----------
/**
 * The film's folder is served as a static site (on 127.0.0.1, for the length of the run), so
 * the page can load its scripts, fonts and node_modules by relative URL. By default that
 * folder is the nearest one above the page that has a package.json: films/<name>/ for
 * films/<name>/src/index.html. --root overrides it. A home directory or a filesystem root
 * is never served.
 */
export function resolvePage(pageArg, rootArg) {
  const page = path.resolve(pageArg);
  if (!fs.existsSync(page) || !fs.statSync(page).isFile()) die(`page not found: ${page}`);
  let root = rootArg ? path.resolve(rootArg) : path.dirname(page);
  if (!rootArg) {
    for (let d = root; ; d = path.dirname(d)) {
      if (fs.existsSync(path.join(d, 'package.json'))) { root = d; break; }
      if (d === path.dirname(d)) break;
    }
  }
  if (root === path.parse(root).root || root === os.homedir()) {
    die(`refusing to serve ${root}; pass --root <the film's folder>`);
  }
  const rel = path.relative(root, page);
  if (rel.startsWith('..') || path.isAbsolute(rel)) die(`${page} is outside the served directory ${root}`);
  return { root, rel };
}

export function filmUrl(origin, rel, query) {
  const q = (query || '').replace(/^\?/, '');
  return `${origin}/${rel.split(path.sep).map(encodeURIComponent).join('/')}${q ? '?' + q : ''}`;
}

/**
 * Open a page for the film, wait for __film + ready. `ctx.frame` is updated by the caller
 * so errors can be reported with the frame they happened on.
 */
export async function openFilm(browser, { url, width, height, scale, label = '', onError, colorScheme = 'dark' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme,
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const ctx = { frame: null, page, context, width, height, scale };
  const where = () => `${label}${ctx.frame == null ? '(load)' : `frame ${ctx.frame}`}`;
  // Errors while the page loads stop the run right away (a missing script would otherwise
  // only show up as "__film not set" half a minute later).
  const loadErrors = [];
  const report = (msg) => { if (!ctx.info) loadErrors.push(msg); onError(msg); };
  const failLoad = () => {
    if (!loadErrors.length) return;
    const hint = loadErrors.some((m) => m.includes('/node_modules/'))
      ? "\nA file under node_modules is missing: run `npm ci` in the film's folder." : '';
    throw new Error(`the page did not load cleanly: ${loadErrors[0]}${loadErrors.length > 1 ? ` (+${loadErrors.length - 1} more)` : ''}${hint}`);
  };
  page.on('console', (m) => {
    if (m.type() === 'error') report(`console.error @ ${where()}: ${m.text()}`);
    else if (m.type() === 'warning') process.stderr.write(`\n[page warn @ ${where()}] ${m.text()}\n`);
  });
  page.on('pageerror', (e) => report(`uncaught exception @ ${where()}: ${e.stack || e.message}`));
  page.on('requestfailed', (r) => report(`request failed @ ${where()}: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.status() >= 400) report(`HTTP ${r.status()} @ ${where()}: ${r.url()}`); });
  page.on('crash', () => report(`page crashed @ ${where()}`));

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  failLoad();
  await page.waitForFunction(() => window.__film && typeof window.__film.seek === 'function', null, { timeout: 30000 })
    .catch(() => { failLoad(); throw new Error(`window.__film not set by ${url} within 30 s`); });
  const info = await page.evaluate(async () => {
    await window.__film.ready;
    await document.fonts.ready;
    return {
      fps: window.__film.fps, duration: window.__film.duration,
      iw: window.innerWidth, ih: window.innerHeight, dpr: window.devicePixelRatio,
      fonts: [...document.fonts].map((f) => `${f.family} ${f.style} ${f.weight}: ${f.status}`),
    };
  });
  failLoad();
  if (info.iw !== width || info.ih !== height || info.dpr !== scale) {
    throw new Error(`viewport mismatch: page sees ${info.iw}x${info.ih}@${info.dpr}, wanted ${width}x${height}@${scale}`);
  }
  const failedFonts = info.fonts.filter((f) => /error$/.test(f));
  if (failedFonts.length) onError(`fonts failed to load: ${failedFonts.join('; ')}`);
  ctx.info = info;
  ctx.cdp = await context.newCDPSession(page);
  return ctx;
}

/**
 * Put the page in the state for time t, wait until it has painted, return PNG bytes.
 *
 * reset: Chromium does not always fully re-render an element whose transform changed by only
 * ~0.01 px since the last painted frame (seen with gsap translate/translate3d on ease tails
 * and between motion-blur sub-frames): the captured anti-aliasing then depends on which
 * frame the page painted before, i.e. on worker count/order. A reset paints an unrelated
 * state first, so output is bit-identical regardless of worker count:
 *   'display' (CLI default): display:none on <html> for one painted frame. Cheapest on heavy
 *       pages, but ResizeObserver/IntersectionObserver fire and CSS animations restart
 *       (re-pinned below) - use 'far' if the page reacts to being hidden.
 *   'far': seek to t + duration/2 and paint that. Relies only on seek() being pure, but
 *       costs a full extra seek+paint (2x on canvas-heavy sections).
 *   'none': fastest; rare +-1 AA differences between worker counts.
 *
 * Also pins CSS/Web Animations to the same clock (pause + currentTime = t), so stray CSS
 * animations render deterministically instead of following wall-clock time.
 */
export async function seekAndCapture(ctx, t, { syncCssAnimations = true, reset = 'display', timeoutMs = 60000 } = {}) {
  const work = ctx.page.evaluate(async ({ t, sync, reset }) => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const film = window.__film;
    const go = async (time) => {
      await film.seek(time);
      if (sync) for (const a of document.getAnimations()) { a.pause(); a.currentTime = time * 1000; }
    };
    if (reset === 'display') {
      document.documentElement.style.display = 'none';
      await raf(); await raf();
      document.documentElement.style.display = '';
    } else if (reset === 'far' && film.duration > 0) {
      await go((t + film.duration / 2) % film.duration);
      await raf(); await raf();
    }
    await go(t);
    // Two animation frames: style/layout/paint of the new state are committed.
    await raf(); await raf();
  }, { t, sync: syncCssAnimations, reset });
  let timer;
  await Promise.race([
    work,
    new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`seek(${t}) timed out after ${timeoutMs} ms`)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
  // CDP capture directly: byte-identical to page.screenshot(), but lets us ask for fast zlib.
  // Our CDP session does not inherit Playwright's device-metrics override, so the clip must
  // carry the device scale explicitly (without it a scale-2 page comes back at 1x).
  const { data } = await ctx.cdp.send('Page.captureScreenshot', {
    format: 'png', optimizeForSpeed: true, captureBeyondViewport: false, fromSurface: true,
    clip: { x: 0, y: 0, width: ctx.width, height: ctx.height, scale: ctx.scale },
  });
  return Buffer.from(data, 'base64');
}

export function pngSize(buf) {
  // IHDR: width at byte 16, height at byte 20 (big endian)
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

// ---------- process helpers ----------
export function run(cmd, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (!quiet) process.stderr.write(d); });
    p.on('error', reject);
    p.on('close', (code) => code === 0 ? resolve({ out, err })
      : reject(new Error(`${cmd} exited ${code}\n${err.slice(-3000)}`)));
  });
}

export function progressLine(s) {
  if (process.stderr.isTTY) process.stderr.write(`\r\x1b[2K${s}`);
  else process.stderr.write(s + '\n');
}

export function fmtT(t) {
  return 't' + t.toFixed(3).padStart(8, '0'); // t0003.000
}

// ---------- worker pool ----------
/**
 * One browser process per worker, one film page each. Separate processes were ~40% faster
 * than N pages in one browser (independent compositor/GPU pipelines).
 */
export async function launchWorkers(n, { url, width, height, scale, onError, colorScheme }) {
  const browsers = await Promise.all(Array.from({ length: n }, () => launchBrowser()));
  const close = () => Promise.all(browsers.map((b) => b.browser.close().catch(() => {})));
  try {
    const pages = await Promise.all(browsers.map((b, w) =>
      openFilm(b.browser, { url, width, height, scale, label: n > 1 ? `w${w} ` : '', onError, colorScheme })));
    return { pages, close, version: browsers[0].version, executablePath: browsers[0].executablePath };
  } catch (e) { await close(); throw e; }
}

export function countFiles(dir, re) {
  return fs.readdirSync(dir).filter((f) => re.test(f)).length;
}

// ---------- motion blur ----------
// Averaging happens in linear light on 16-bit RGB: lutrgb (exact 65536-entry tables) maps
// sRGB code -> linear, tmix averages, lutrgb maps back to sRGB. swscale's 8->16 bit widening
// is NOT v*257 or v<<8 (ffmpeg 8: 1->256, 128->32767, 255->65283), so the LUTs are built
// from M = what 255 widens to (probed at runtime): code = round(val*255/M) on the way in,
// and on the way out we emit exactly round(code*M/255), which swscale narrows back exactly.
// A self-test on a 256-level ramp must come back bit-identical before we touch real frames,
// so static pixels are guaranteed unchanged by the blur pass.
const lin = (c) => `if(lte(${c}\\,0.04045)\\,${c}/12.92\\,pow((${c}+0.055)/1.055\\,2.4))`;
const enc = (l) => `if(lte(${l}\\,0.0031308)\\,12.92*${l}\\,1.055*pow(${l}\\,1/2.4)-0.055)`;

let blurChainCache = null;
async function blurChain(N) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pgfilm-blur-'));
  try {
    const ramp = Buffer.alloc(256 * 3);
    for (let x = 0; x < 256; x++) ramp.fill(x, x * 3, x * 3 + 3);
    fs.writeFileSync(path.join(tmp, 'ramp.rgb'), ramp);
    const raw = ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '256x1'];
    if (!blurChainCache) {
      await run(FFMPEG, [...raw, '-i', path.join(tmp, 'ramp.rgb'), '-vf', 'format=rgb48le', '-f', 'rawvideo', '-pix_fmt', 'rgb48le', path.join(tmp, 'w.raw')], { quiet: true });
      const M = fs.readFileSync(path.join(tmp, 'w.raw')).readUInt16LE(255 * 6);
      const code = `(round(val*255/${M})/255)`;
      const toLinear = `round(65535*${lin(code)})`;
      const toSrgb = `round(round(255*${enc('(val/65535)')})*${M}/255)`;
      blurChainCache = { toLinear, toSrgb };
    }
    const { toLinear, toSrgb } = blurChainCache;
    const lut = (e) => `lutrgb=r=${e}:g=${e}:b=${e}`;
    const vf = ['format=rgb48le', lut(toLinear),
      `tmix=frames=${N}:weights=${Array(N).fill('1').join(' ')}`,
      `select=not(mod(n+1\\,${N}))`,
      lut(toSrgb), 'format=rgb24'].join(',');
    // self-test: N identical ramp frames must average back to the identical ramp
    await run(FFMPEG, [...raw, '-stream_loop', String(N - 1), '-i', path.join(tmp, 'ramp.rgb'), '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'rgb24', path.join(tmp, 'out.rgb')], { quiet: true });
    const out = fs.readFileSync(path.join(tmp, 'out.rgb'));
    if (out.length !== ramp.length || !out.equals(ramp)) {
      const bad = []; for (let x = 0; x < 256; x++) if (out[x * 3] !== x) bad.push(`${x}->${out[x * 3]}`);
      throw new Error(`motion-blur LUT self-test failed (static pixels would change): ${bad.slice(0, 10).join(' ')} len=${out.length}`);
    }
    return vf;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/**
 * Average each consecutive group of N sub-frame PNGs (inPattern, numbered from 0) into one
 * output PNG (outPattern, numbered from outStart), equal weights, in linear light.
 * tmix=frames=N averages the current frame with the N-1 before it; select keeps only
 * n = N-1, 2N-1, ... so each kept frame is exactly one complete, disjoint group.
 */
export async function averageSubframes(inPattern, N, outPattern, outStart = 0) {
  const vf = await blurChain(N);
  await run(FFMPEG, ['-hide_banner', '-y', '-loglevel', 'error',
    '-framerate', '60', '-start_number', '0', '-i', inPattern,
    '-vf', vf, '-fps_mode', 'passthrough', '-start_number', String(outStart), outPattern], { quiet: true });
}

// ---------- streaming encoder ----------
/**
 * Spawn ffmpeg reading PNGs from stdin (-f image2pipe). write(buf) respects backpressure;
 * finish() closes stdin and resolves when ffmpeg exits 0 (rejects with its stderr otherwise).
 */
export function startPipeEncoder(args) {
  const p = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '', exited = null;
  p.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
  const exit = new Promise((resolve) => p.on('close', (code, sig) => { exited = { code, sig }; resolve(exited); }));
  p.stdin.on('error', () => {}); // EPIPE surfaces via the exit code below
  const fail = () => new Error(`ffmpeg encoder exited (${exited.code ?? exited.sig}) early:\n${err.slice(-3000)}`);
  return {
    async write(buf) {
      if (exited) throw fail();
      if (!p.stdin.write(buf)) {
        await Promise.race([new Promise((r) => p.stdin.once('drain', r)), exit]);
        if (exited) throw fail();
      }
    },
    async finish() {
      p.stdin.end();
      const { code, sig } = await exit;
      if (code !== 0) throw new Error(`ffmpeg exited ${code ?? sig}:\n${err.slice(-3000)}`);
      return err;
    },
    kill() { if (!exited) p.kill('SIGKILL'); },
  };
}
