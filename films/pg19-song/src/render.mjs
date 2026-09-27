// Render "Must Be Reliable".
//   node src/render.mjs --out build/video.mp4 [--jobs 6]     full film (parallel segments, then concat)
//   node src/render.mjs --stills 12,60.5                     preview frames -> build/stills/
//   node src/render.mjs --timeline                           only write build/timeline.json (cuts, lyric lines, cards)
import { Canvas, FontLibrary } from 'skia-canvas'
import { spawn } from 'child_process'
import fs from 'fs'
import { W, H, FPS, THEMES, PAL, clamp, lerp, ease, easeOut, rng, rgba, fq, mono, font, mw, TOTAL, BEAT, BAR, DB0, barPos, energy,
  sinceBeat, sinceDown, sinceHit, LINES, lineT0, lineLast, BEATS } from './lib.mjs'
import { SCENES, GROUPS, lyrics, REC, cveAt, openItemsAt, cardsAt } from './scenes.mjs'

const root = new URL('..', import.meta.url).pathname
FontLibrary.use('Grotesk', [root + 'assets/fonts/ArchivoBlack.ttf'])
FontLibrary.use('Serif', [root + 'assets/fonts/InstrumentSerif.ttf', root + 'assets/fonts/InstrumentSerif-Italic.ttf'])
FontLibrary.use('Mono', [root + 'assets/fonts/JetBrainsMono.ttf'])
const NF = Math.ceil(TOTAL * FPS)
const O = PAL.orange

// ---------- textures ----------
function noise(seed, w, h) { const c = new Canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), R = rng(seed)
  for (let i = 0; i < w * h; i++) { const v = R() * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255 } x.putImageData(img, 0, 0); return c }
const GRAIN = [1, 2, 3, 4, 5, 6, 7, 8].map(s => noise(s, 960, 540))
const SCAN = (() => { const c = new Canvas(W, H), x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.05)'; for (let y = 0; y < H; y += 3) x.fillRect(0, y, W, 1); return c })()
const HALFTONE = (() => { const c = new Canvas(W, H), x = c.getContext('2d'); for (let y = 0; y < H; y += 14) for (let xx = 0; xx < W; xx += 14) { const r = 2.6 * clamp(1 - Math.hypot(xx - W * 0.85, y - H * 0.2) / 900); if (r > 0.2) { x.fillStyle = 'rgba(239,230,211,0.07)'; x.beginPath(); x.arc(xx, y, r, 0, 7); x.fill() } } return c })()

function background(c, th, s, t, e) {
  c.fillStyle = th.bg; c.fillRect(0, 0, W, H)
  if (s.bg === 'grid') {
    const vx = 960, vy = 560, a = 0.05 + 0.11 * e
    c.strokeStyle = rgba(PAL.cream, a); c.lineWidth = 1
    for (let i = -24; i <= 24; i++) { c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + i * 170, H + 40); c.stroke() }
    const ph = ((t - DB0) / BEAT) % 1
    for (let k = 0; k < 14; k++) { const z = (k + 1 - ph) / 14, y = vy + (H + 40 - vy) * z * z; c.globalAlpha = z; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke() } c.globalAlpha = 1
    c.fillStyle = rgba(PAL.cream, 0.06 + 0.05 * e); for (let x = 96; x < W; x += 64) for (let y = 200; y < vy - 20; y += 64) c.fillRect(x, y, 1.5, 1.5)
  } else if (s.bg === 'rings') {
    const cx = 960, cy = 600, pulse = Math.exp(-sinceBeat(t) / 0.12)
    for (let k = 0; k < 22; k++) { const r = 60 + k * 46 + ((t * 18) % 46); c.strokeStyle = rgba(PAL.cream, (0.05 + 0.1 * e) * (1 - k / 22) + 0.05 * pulse * (k < 6)); c.lineWidth = 1.2
      c.beginPath(); for (let a = 0; a <= 64; a++) { const an = a / 64 * Math.PI * 2, rr = r * (1 + 0.035 * Math.sin(an * 3 + k * 0.7 + t * 0.6)); a ? c.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.62) : c.moveTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr * 0.62) } c.stroke() }
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, 380); g.addColorStop(0, rgba(O, 0.1 + 0.08 * pulse)); g.addColorStop(1, rgba(O, 0)); c.fillStyle = g; c.fillRect(0, 0, W, H)
  } else if (s.bg === 'news') {
    c.drawImage(HALFTONE, 0, 0); c.fillStyle = rgba(PAL.cream, 0.08); for (let y = 200; y < H - 100; y += 120) c.fillRect(96, y, W - 192, 1)
    for (let x = 96; x < W; x += 432) c.fillRect(x, 200, 1, H - 320)
  } else if (s.bg === 'dawn') {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f4ecdd'); g.addColorStop(1, '#ead6b6'); c.fillStyle = g; c.fillRect(0, 0, W, H)
    const r = c.createRadialGradient(960, H + 120, 50, 960, H + 120, 900); r.addColorStop(0, rgba(O, 0.2 + 0.1 * e)); r.addColorStop(1, rgba(O, 0)); c.fillStyle = r; c.fillRect(0, 0, W, H)
    c.fillStyle = 'rgba(21,18,15,0.07)'; for (let x = 96; x < W; x += 64) for (let y = 200; y < H - 120; y += 64) c.fillRect(x, y, 1.5, 1.5)
  }
}

function hud(c, th, s, t, f, ink) {
  const col = ink || th.ink, dim = ink ? ink : th.dim, A = s.hudDim ? 0.35 : 1
  c.save(); c.globalAlpha = A * (s.id === 'intro' ? clamp((t - lineT0('0.3')) / 1.2) : 1)
  if (c.globalAlpha <= 0) { c.restore(); return }
  c.strokeStyle = dim; c.lineWidth = 1.5
  for (const [x, y, dx, dy] of [[48, 48, 1, 1], [W - 48, 48, -1, 1], [48, H - 48, 1, -1], [W - 48, H - 48, -1, -1]]) { c.beginPath(); c.moveTo(x + dx * 34, y); c.lineTo(x, y); c.lineTo(x, y + dy * 34); c.stroke() }
  mono(c, 'PG19 · MUST BE RELIABLE', 96, 92, 15, col, { weight: 700, sp: 2 })
  mono(c, '§ ' + s.sec, 96, 116, 14, dim, { weight: 500, sp: 2, alpha: 0.8 })
  // CVE counter (the spine). Big version lives in the pre-chorus scenes.
  if (!s.counterBig) {
    const cv = cveAt(t), frozen = s.sec === 'BRIDGE', fin = s.theme === 'light'
    mono(c, 'POSTGRESQL CVEs · 2026' + (frozen ? '  ❚❚' : ''), W - 96, 92, 14, dim, { align: 'right', weight: 600, sp: 1 })
    c.save(); font(c, 'mono', 64, 700); c.fillStyle = ink ? col : O; c.globalAlpha *= fin ? 0.45 : 1
    if (!ink && th.dark && !frozen) { c.shadowColor = O; c.shadowBlur = 24 } const txt = String(cv.v); c.fillText(txt, W - 96 - mw(c, txt), 160); c.restore()
    mono(c, 'as of ' + cv.asof, W - 96, 186, 13, dim, { align: 'right', alpha: 0.8 })
    if (fin) { const oi = openItemsAt(t); mono(c, 'PG19 OPEN ITEMS', W - 300, 92, 14, dim, { align: 'right', weight: 600, sp: 1 })
      c.save(); font(c, 'mono', 64, 700); c.fillStyle = th.acc; const s2 = String(oi); c.fillText(s2, W - 300 - mw(c, s2), 160); c.restore()
      mono(c, '176 tracked · wiki 2026-09-26', W - 300, 186, 13, dim, { align: 'right', alpha: 0.8 }) }
  }
  // progress bar with section ticks
  const x0 = 96, x1 = W - 96, y = H - 58
  c.fillStyle = th.dark || ink ? rgba(ink === PAL.black ? '#0b0a09' : '#efe6d3', 0.18) : 'rgba(21,18,15,0.16)'; c.fillRect(x0, y, x1 - x0, 2)
  for (const b of BEATS.bounds) { const x = x0 + (x1 - x0) * b / TOTAL; c.fillStyle = dim; c.fillRect(x, y - 5, 1.5, 12) }
  c.fillStyle = ink ? col : th.acc; c.fillRect(x0, y, (x1 - x0) * t / TOTAL, 2.5)
  const mmss = v => `${String(Math.floor(v / 60)).padStart(2, '0')}:${(v % 60).toFixed(1).padStart(4, '0')}`
  mono(c, `${mmss(t)} / ${mmss(TOTAL)}`, x0, y - 16, 13, dim, { alpha: 0.8 })
  mono(c, `♩128 · BAR ${barPos(t).toFixed(1).padStart(5, '0')} · TAKE A · f${String(f).padStart(5, '0')}`, x1, y - 16, 13, dim, { align: 'right', alpha: 0.8 })
  c.restore()
}

const small = new Canvas(480, 270), sx = small.getContext('2d')
function post(c, th, s, t, f, e) {
  // bloom: blurred quarter-res copy, screened back (dark scenes only)
  if (th.dark && s.bg !== 'card') {
    sx.globalCompositeOperation = 'copy'; sx.filter = 'blur(6px)'; sx.drawImage(c.canvas, 0, 0, 480, 270); sx.filter = 'none'
    c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.28 + 0.25 * e; c.drawImage(small, 0, 0, W, H); c.restore()
  }
  // vignette
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.72)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, th.dark ? 'rgba(0,0,0,0.55)' : 'rgba(90,60,20,0.22)'); c.fillStyle = v; c.fillRect(0, 0, W, H)
  c.save(); c.globalCompositeOperation = 'overlay'; c.globalAlpha = th.dark ? 0.08 : 0.06; c.drawImage(GRAIN[f % 8], 0, 0, W, H); c.restore()
  c.drawImage(SCAN, 0, 0)
  // hit flash (choruses): tiny lift on strong drum hits
  if (s.sec === 'CHORUS' && s.bg !== 'card') { const h = Math.exp(-sinceHit(t) / 0.07); if (h > 0.02) { c.fillStyle = `rgba(255,236,210,${0.035 * h})`; c.fillRect(0, 0, W, H) } }
  // palette flip flash at the final chorus
  if (s.flip && t - s.t0 < 2 / FPS) { c.fillStyle = O; c.fillRect(0, 0, W, H) }
  const fin = clamp(t / 0.5); if (fin < 1) { c.fillStyle = `rgba(0,0,0,${1 - fin})`; c.fillRect(0, 0, W, H) }
}

function sceneAt(t) { for (const s of SCENES) if (t + 1e-6 >= fq(s.t0) && t < fq(s.t1) - 1e-6) return s; return SCENES[SCENES.length - 1] }
const canvas = new Canvas(W, H), c = canvas.getContext('2d')
function frame(f) {
  const t = f / FPS, s = sceneAt(t), th = THEMES[s.theme], e = energy(t)
  REC.f = f
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'transparent'; c.filter = 'none'
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'
  background(c, th, s, t, e)
  let ink = null
  if (s.card) { const r = s.draw(c, th, t); ink = s._ink?.ink || null }
  else {
    // camera: slow push + drift + a small push on each beat, scaled by loudness
    const lt = t - s.t0, dur = s.t1 - s.t0
    const z = 1 + 0.03 * ease(lt / Math.max(1, dur)) + 0.006 * e * Math.exp(-sinceBeat(t) / 0.1)
    c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2 + Math.sin(t * 0.31) * 7, -H / 2 + Math.cos(t * 0.23) * 5)
    s.draw(c, th, t); c.restore()
  }
  if (!s.noLyric) lyrics(c, th, t)
  hud(c, th, s, t, f, ink)
  post(c, th, s, t, f, e)
}

// ---------- timeline (for QA + README) ----------
function timeline() {
  const lines = []
  for (const g of GROUPS) g.lines.forEach((id, k) => {
    const ws = LINES[id], full = fq(ws[ws.length - 1].t) + 3 / FPS
    const nxt = g.lines[k + g.stack], removal = Math.min(nxt ? fq(lineT0(nxt)) : g.t1, g.t1)
    lines.push({ id, text: ws.map(w => w.w).join(' '), show: fq(ws[0].t), full, removal, hold: +(removal - full).toFixed(3) })
  })
  const cards = []
  for (const s of SCENES) if (s.card) s.card.forEach((cd, i) => { const next = s.card[i + 1] ? fq(s.card[i + 1].t) : fq(s.t1)
    const full = cd.split ? fq(cd.split) + 1 / FPS : fq(cd.t) + (cd.flash ? 2 / FPS : 0) + 1 / FPS
    cards.push({ key: cd.key, words: cd.words.join('/'), show: fq(cd.t), full, removal: next, hold: +(next - full).toFixed(3) }) })
  return { fps: FPS, total: TOTAL, frames: NF, scenes: SCENES.map(s => ({ id: s.id, t0: s.t0, t1: s.t1, cutFrame: Math.round(s.t0 * FPS), sec: s.sec, theme: s.theme })), lines, cards }
}

const args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
fs.mkdirSync(root + 'build', { recursive: true })
if (!arg('--from')) fs.writeFileSync(root + 'build/timeline.json', JSON.stringify(timeline(), null, 1))
if (args.includes('--timeline')) process.exit(0)
if (arg('--stills')) {
  const dir = arg('--dir') || root + 'build/stills'; fs.mkdirSync(dir, { recursive: true })
  for (const ts of arg('--stills').split(',')) { const f = Math.round(parseFloat(ts) * FPS); frame(f); await canvas.toFile(`${dir}/s_${String(ts).padStart(6, '0')}.jpg`, { quality: 0.88 }) }
  process.exit(0)
}
const jobs = +(arg('--jobs') || 0)
if (jobs > 1) {  // parallel: split into segments, render each in a child process, concat
  const out = arg('--out') || root + 'build/video.mp4', per = Math.ceil(NF / jobs), kids = []
  for (let k = 0; k < jobs; k++) { const a = k * per, b = Math.min(NF, (k + 1) * per); if (a >= b) break
    kids.push(new Promise(res => { const p = spawn(process.execPath, [new URL(import.meta.url).pathname, '--from', String(a), '--to', String(b), '--out', `${root}build/seg_${k}.mp4`, '--rec', `${root}build/rec_${k}.json`], { stdio: 'inherit' }); p.on('close', res) })) }
  await Promise.all(kids)
  fs.writeFileSync(root + 'build/segs.txt', kids.map((_, k) => `file 'seg_${k}.mp4'`).join('\n'))
  await new Promise(r => spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', root + 'build/segs.txt', '-c', 'copy', out], { stdio: 'inherit' }).on('close', r))
  const rec = { words: {}, marks: {} }
  kids.forEach((_, k) => { const r = JSON.parse(fs.readFileSync(`${root}build/rec_${k}.json`, 'utf8')); for (const K of ['words', 'marks']) for (const [x, v] of Object.entries(r[K])) rec[K][x] = Math.min(rec[K][x] ?? 1e9, v) })
  fs.writeFileSync(root + 'build/rec.json', JSON.stringify(rec)); console.log('done', out); process.exit(0)
}
const from = +(arg('--from') || 0), to = +(arg('--to') || NF), out = arg('--out') || root + 'build/video.mp4'
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-g', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] })
REC.on = true
const T0 = Date.now()
for (let f = from; f < to; f++) {
  frame(f); const buf = await canvas.toBuffer('raw')
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
  if ((f - from) % 300 === 0) console.log(`[${from}-${to}] frame ${f}  ${((Date.now() - T0) / 1000).toFixed(0)}s`)
}
ff.stdin.end(); await new Promise(r => ff.on('close', r))
if (arg('--rec')) fs.writeFileSync(arg('--rec'), JSON.stringify({ words: REC.words, marks: REC.marks }))
