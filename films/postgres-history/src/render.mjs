// Render the film: node render.mjs [--stills 3,40,90] [--from s --to s] [--half]
import { Canvas, FontLibrary } from 'skia-canvas'
import { spawn } from 'child_process'
import fs from 'fs'
import { W, H, FPS, THEMES, clamp, lerp, ease, rng, mono, spaced, EVENTS } from './lib.mjs'
import { SCENES, REC } from './scenes.mjs'

FontLibrary.use('Cinzel', ['assets/fonts/Cinzel.ttf'])
FontLibrary.use('Garamond', ['assets/fonts/EBGaramond.ttf', 'assets/fonts/EBGaramond-Italic.ttf'])
FontLibrary.use('Mono', ['assets/fonts/JetBrainsMono.ttf'])

const perYear = { 1996: 876, 1997: 1698, 1998: 1744, 1999: 1788, 2000: 2535, 2001: 3061, 2002: 2654, 2003: 2416, 2004: 2548, 2005: 2419, 2006: 2152, 2007: 2188, 2008: 1652, 2009: 1388, 2010: 1801, 2011: 2029, 2012: 1605, 2013: 1368, 2014: 1745, 2015: 1817, 2016: 2086, 2017: 2469, 2018: 2122, 2019: 2130, 2020: 2179, 2021: 2276, 2022: 2485, 2023: 2210, 2024: 2722, 2025: 2816, 2026: 2505 }
const D = { perYear }
const commitsAt = y => { let s = 0; for (const k in perYear) { const yy = +k; if (yy + 1 <= y) s += perYear[k]; else if (yy <= y) s += perYear[k] * (y - yy) } return Math.round(s) }

// ---------- timeline ----------
let t = 0
for (const s of SCENES) { s.bd = 60 / s.bpm; s.beats = s.bars * 4; s.t0 = t; s.dur = s.beats * s.bd; t += s.dur }
const TAIL = 2.5, TOTAL = t + TAIL, NF = Math.ceil(TOTAL * FPS)

// ---------- textures ----------
function noiseCanvas(seed, w, h, a) { const c = new Canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), R = rng(seed)
  for (let i = 0; i < w * h; i++) { const v = R() * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = a } x.putImageData(img, 0, 0); return c }
const GRAIN = [1, 2, 3, 4, 5, 6].map(s => noiseCanvas(s, 960, 540, 255))
const paperTex = (() => { const c = new Canvas(W, H), x = c.getContext('2d'), R = rng(77)
  for (let i = 0; i < 900; i++) { const px = R() * W, py = R() * H, r = 20 + R() * 160; const g = x.createRadialGradient(px, py, 0, px, py, r); const a = R() * 0.05
    g.addColorStop(0, `rgba(120,90,50,${a})`); g.addColorStop(1, 'rgba(120,90,50,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2) }
  x.strokeStyle = 'rgba(90,70,40,0.05)'; x.lineWidth = 1; for (let i = 0; i < 1400; i++) { const px = R() * W, py = R() * H, a = R() * 6.28, l = 4 + R() * 18; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke() }
  return c })()
const STARS = (() => { const R = rng(99); return Array.from({ length: 420 }, () => [R() * W, R() * H, R() * 1.4 + 0.2, R() * 6.28]) })()

function background(c, th, name, time) {
  const g = c.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, W * 0.72); g.addColorStop(0, th.bg0); g.addColorStop(1, th.bg1)
  c.fillStyle = g; c.fillRect(0, 0, W, H)
  if (name === 'paper') c.drawImage(paperTex, 0, 0)
  else for (const [x, y, r, p] of STARS) { c.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 1.3 + p)); c.fillStyle = name === 'blue' ? '#cfe6ff' : '#fff3dc'; c.fillRect(x, y, r, r) }
  c.globalAlpha = 1
}

const PARTS = (() => { const R = rng(1234); return Array.from({ length: 140 }, () => [R() * W, R() * H, 0.3 + R() * 1.2, R() * 6.28, 8 + R() * 30]) })()
function particles(c, theme, time) {
  for (const [x0, y0, r, p, sp] of PARTS) {
    const y = ((y0 - time * sp) % H + H) % H, x = x0 + Math.sin(time * 0.7 + p) * 18
    const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time * 2 + p))
    c.fillStyle = theme === 'paper' ? `rgba(90,70,40,${a * 0.35})` : theme === 'blue' ? `rgba(150,205,255,${a})` : `rgba(255,205,120,${a})`
    c.beginPath(); c.arc(x, y, r * (theme === 'paper' ? 1.4 : 1.8), 0, 7); c.fill()
  }
}

function hud(c, th, s, S, f) {
  const col = th.dim, br = 30
  c.strokeStyle = th.dim; c.lineWidth = 1.5
  for (const [x, y, dx, dy] of [[56, 56, 1, 1], [W - 56, 56, -1, 1], [56, H - 56, 1, -1], [W - 56, H - 56, -1, -1]]) { c.beginPath(); c.moveTo(x + dx * br, y); c.lineTo(x, y); c.lineTo(x, y + dy * br); c.stroke() }
  mono(c, s.chap, 96, 88, 21, col, 6, 'left', 600)
  mono(c, 'POSTGRES · 1970—2026', W - 96, 88, 21, col, 6, 'right', 600)
  mono(c, `♩ = ${s.bpm}    ${String(f).padStart(5, '0')}`, W - 96, 118, 16, th.faint.replace(/[\d.]+\)$/, '0.4)'), 4, 'right')
  // year
  let year = null
  if (s.year) year = s.cards ? s.cards[Math.min(s.cards.length - 1, Math.floor(S.b / 2))][2] : Math.floor(lerp(s.year[0], s.year[1] + 0.999, S.u))
  if (s.id === 'mandala') year = null
  const chartY = s.chart ? 1996 + 31 * ease(S.b / 8) : null
  if (s.chart) year = Math.min(2026, Math.floor(chartY))
  mono(c, 'ANNO', 96, H - 128, 15, col, 6)
  mono(c, s.yearText || (year ? String(year) : (s.act === 4 && !s.year ? '∞' : '—')), 96, H - 86, 38, th.ink, 4, 'left', 500)
  // timeline 1965..2030
  const x0 = 610, x1 = 1310, yy = H - 68, Y0 = 1965, Y1 = 2030, X = y => x0 + (y - Y0) / (Y1 - Y0) * (x1 - x0)
  c.fillStyle = th.faint; c.fillRect(x0, yy, x1 - x0, 2)
  for (let y = 1970; y <= 2020; y += 10) { c.fillStyle = col; c.fillRect(X(y), yy - 6, 1.5, 12); mono(c, String(y), X(y), yy - 16, 15, col, 2, 'center') }
  const yv = year ?? (s.id === 'mandala' ? lerp(1970, 2026, clamp(S.u * 1.5)) : 1965)
  c.fillStyle = th.accent; c.fillRect(x0, yy, X(yv) - x0, 2.5)
  c.beginPath(); c.moveTo(X(yv) - 7, yy - 18); c.lineTo(X(yv) + 7, yy - 18); c.lineTo(X(yv), yy - 8); c.fill()
  // commits meter
  const yf = s.year ? lerp(s.year[0], s.year[1] + 1, S.u) : 0
  const cm = s.id === 'commits' ? null : s.act === 4 || (s.act === 3 && !s.year) ? 65484 : Math.min(65484, commitsAt(s.cards ? year + 0.5 : yf))
  mono(c, 'COMMITS', W - 96, H - 128, 15, col, 6, 'right')
  const shown = cm === null ? Math.min(65484, commitsAt(chartY)) : cm
  mono(c, Math.round(shown).toLocaleString('en-US'), W - 96, H - 86, 38, th.ink, 4, 'right', 500)
  const mx0 = W - 360, mx1 = W - 96; c.fillStyle = th.faint; c.fillRect(mx0, H - 66, mx1 - mx0, 2); c.fillStyle = th.accent; c.fillRect(mx0, H - 66, (mx1 - mx0) * clamp(shown / 65484), 3)
}

function post(c, th, name, f, s, S, time) {
  // vignette
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, name === 'paper' ? 'rgba(60,40,15,0.42)' : 'rgba(0,0,0,0.7)'); c.fillStyle = v; c.fillRect(0, 0, W, H)
  // grain
  c.globalCompositeOperation = 'overlay'; c.globalAlpha = name === 'paper' ? 0.10 : 0.07; c.drawImage(GRAIN[f % 6], 0, 0, W, H)
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1
  // cut flash on hits
  const since = S.t
  if ((s.hit || s.impact) && since < 0.35) { c.fillStyle = name === 'paper' ? `rgba(255,250,235,${0.55 * (1 - since / 0.35)})` : `rgba(255,225,170,${0.35 * (1 - since / 0.35)})`; c.fillRect(0, 0, W, H) }
  // flicker
  const fl = 0.02 * Math.sin(time * 23) * Math.sin(time * 7.1); c.fillStyle = fl > 0 ? `rgba(255,255,255,${fl})` : `rgba(0,0,0,${-fl})`; c.fillRect(0, 0, W, H)
  // fade in/out
  const fin = clamp(time / 0.6), fout = clamp((TOTAL - time) / 2.2)
  if (fin < 1 || fout < 1) { c.fillStyle = `rgba(0,0,0,${1 - Math.min(fin, fout)})`; c.fillRect(0, 0, W, H) }
}

function sceneAt(time) { for (const s of SCENES) if (time < s.t0 + s.dur) return s; return SCENES[SCENES.length - 1] }

const canvas = new Canvas(W, H), c = canvas.getContext('2d')
function frame(f) {
  const time = f / FPS, s = sceneAt(time + 0.5 / FPS), lt = Math.max(0, Math.min(time - s.t0, s.dur + TAIL))  // cut on the frame nearest the beat
  const S = { t: lt, b: lt / s.bd, u: clamp(lt / s.dur), t0: s.t0, bd: s.bd }
  const th = THEMES[s.theme]
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.shadowColor = 'transparent'
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'
  // shake on impacts
  const sh = s.impact && S.t < 0.5 ? (1 - S.t / 0.5) * 9 : 0
  background(c, th, s.theme, time)
  // pulse on the same beats the score puts kicks/taiko on
  const kb = s.quiet || s.id.startsWith('open') || s.riser ? [] : s.act === 1 ? [0, 2] : [0, 1, 2, 3]
  let ph = 9; const bb = S.b % 4, bar0 = Math.floor(S.b / 4)
  if (kb.length && !(s.id === 'end' && bar0 >= 2)) for (const k of kb) { const d = (bb - k + 4) % 4; if (d * s.bd < ph) ph = d * s.bd }
  const pz = ph < 1 ? Math.exp(-ph / 0.08) : 0
  particles(c, s.theme, time)
  const push = 1 + 0.035 * ease(S.u) + 0.012 * pz
  c.save(); c.translate(W / 2, H / 2); c.scale(push, push); c.translate(-W / 2, -H / 2)
  if (sh) c.translate(Math.sin(f * 12.9) * sh, Math.cos(f * 7.7) * sh)
  const weave = 0.6; c.translate(Math.sin(time * 5.3) * weave, Math.cos(time * 4.1) * weave)
  s.draw(c, th, S, D)
  c.restore()
  if (pz && s.theme !== 'paper') { c.fillStyle = `rgba(255,220,160,${0.06 * pz})`; c.fillRect(0, 0, W, H) }
  if (s.hit && s.theme !== 'paper' && S.t < 0.3) { const k = 1 - S.t / 0.3, g = c.createLinearGradient(0, H * 0.5 - 60, 0, H * 0.5 + 60)
    g.addColorStop(0, 'rgba(255,230,180,0)'); g.addColorStop(0.5, `rgba(255,236,200,${0.5 * k})`); g.addColorStop(1, 'rgba(255,230,180,0)'); c.fillStyle = g; c.fillRect(0, H * 0.5 - 60, W, 120) }
  hud(c, th, s, S, f)
  post(c, th, s.theme, f, s, S, time)
}

// ---------- timeline export for music ----------
{ const dummy = new Canvas(W, H).getContext('2d')
  for (const s of SCENES) { try { s.draw(dummy, THEMES[s.theme], { t: 0, b: 0, u: 0, t0: s.t0, bd: s.bd, record: true }, D) } catch (e) { } }
  REC.on = true
  for (const s of SCENES) { if (!s.type) continue; REC.prev = {}
    for (let f = Math.floor(s.t0 * FPS); f < Math.ceil((s.t0 + s.dur) * FPS); f++) { const lt = f / FPS - s.t0; REC.t = f / FPS
      try { s.draw(dummy, THEMES[s.theme], { t: lt, b: lt / s.bd, u: clamp(lt / s.dur), t0: s.t0, bd: s.bd }, D) } catch (e) { } } }
  REC.on = false
  fs.mkdirSync('build', { recursive: true }); fs.writeFileSync('build/timeline.json', JSON.stringify({ total: TOTAL, scenes: SCENES.map(s => ({ id: s.id, t0: s.t0, dur: s.dur, bpm: s.bpm, bars: s.bars, act: s.act,
    hit: !!s.hit, impact: !!s.impact, riser: !!s.riser, quiet: !!s.quiet, climax: !!s.climax, end: !!s.end, montage: !!s.montage, big: !!s.big,
    type: s.type ? [s.t0 + s.type[0] * s.bd, s.t0 + s.type[1] * s.bd] : null })), events: EVENTS, typing: REC.ev }, null, 1)) }

const args = process.argv.slice(2), arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null }
console.log(`total ${TOTAL.toFixed(2)}s, ${NF} frames; scenes:`, SCENES.map(s => `${s.id}@${s.t0.toFixed(1)}`).join(' '))
if (arg('--stills')) {
  fs.mkdirSync('build/stills', { recursive: true })
  for (const ts of arg('--stills').split(',')) { const f = Math.round(parseFloat(ts) * FPS); frame(f); await canvas.toFile(`build/stills/s_${ts}.jpg`, { quality: 0.85 }) }
  process.exit(0)
}
const from = Math.round((+arg('--from') || 0) * FPS), to = Math.min(NF, Math.round((+(arg('--to') || TOTAL)) * FPS))
const out = arg('--out') || 'build/video.mp4'
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] })
const t0 = Date.now()
for (let f = from; f < to; f++) {
  frame(f); const buf = await canvas.toBuffer('raw')
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r))
  if (f % 150 === 0) console.log(`frame ${f}/${to}  ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log('done', out)
