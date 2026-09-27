// Shared helpers + timing data for "Must Be Reliable".
import fs from 'fs'
export const W = 1920, H = 1080, FPS = 30

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3)
export const easeIn = t => Math.pow(clamp(t), 3)
export const easeOutBack = t => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
// quantize a time to the frame that shows it (nearest frame): the word-sync contract
export const fq = t => Math.round(t * FPS) / FPS

// ---------- palette: near-black, cream, one orange ----------
export const PAL = { black: '#0b0a09', cream: '#efe6d3', orange: '#ff5a1c', orangeDeep: '#e8480f' }
export const THEMES = {
  dark:  { bg: '#0b0a09', bg2: '#141210', ink: '#efe6d3', dim: 'rgba(239,230,211,0.55)', faint: 'rgba(239,230,211,0.13)', ghost: 'rgba(239,230,211,0.06)', acc: '#ff5a1c', dark: true },
  light: { bg: '#f1e8d5', bg2: '#e6d8bd', ink: '#15120f', dim: 'rgba(21,18,15,0.58)', faint: 'rgba(21,18,15,0.14)', ghost: 'rgba(21,18,15,0.06)', acc: '#ec4a10', dark: false },
}
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})` }

// ---------- data ----------
const A = p => JSON.parse(fs.readFileSync(new URL('../assets/' + p, import.meta.url), 'utf8'))
export const WORDS = A('words.json'), BEATS = A('beats.json'), COMMITS = A('commits.json')
export const LINES = {}
for (const w of WORDS) (LINES[w.line] ||= []).push(w)
export const line = id => LINES[id]
export const lineT0 = id => LINES[id][0].t
export const lineLast = id => LINES[id][LINES[id].length - 1].t
export const lineEnd = id => LINES[id][LINES[id].length - 1].e
export const wordT = (id, i) => LINES[id][i].t
export const TOTAL = 208.15
export const BEAT = BEATS.period, BAR = BEAT * 4, DB0 = BEATS.downbeats[0]
export const bar = n => DB0 + n * BAR            // time of downbeat n (bar 0 = song start)
export const beatN = n => DB0 + n * BEAT
export function beatPhase(t) { const x = (t - DB0) / BEAT; return x - Math.floor(x) }   // 0 at each beat
export function barPos(t) { return (t - DB0) / BAR }
export function energy(t) {  // 0..1 loudness follower (half-beat resolution, smoothed)
  const L = BEATS.loud_halfbeat_db, st = BEATS.loud_step, i = t / st, a = Math.floor(i), f = i - a
  const g = k => L[clamp(k, 0, L.length - 1)] ?? -60
  const db = lerp(g(a), g(a + 1), f) * 0.6 + (g(a - 1) + g(a + 2)) * 0.2
  return clamp((db + 34) / 20)
}
const HITS = BEATS.hits
export function sinceHit(t) { let lo = 0, hi = HITS.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (HITS[m] <= t) { r = m; lo = m + 1 } else hi = m - 1 } return r < 0 ? 99 : t - HITS[r] }
export function sinceBeat(t) { const x = (t - DB0) / BEAT; return (x - Math.floor(x)) * BEAT }
export function sinceDown(t) { const x = (t - DB0) / BAR; return (x - Math.floor(x)) * BAR }

// ---------- text ----------
export function font(c, kind, size, weight = 400) {
  c.font = kind === 'grotesk' ? `400 ${size}px Grotesk` : kind === 'serif' ? `italic 400 ${size}px Serif` : kind === 'roman' ? `400 ${size}px Serif` : `${weight} ${size}px Mono`
}
export const mw = (c, s) => c.measureText(s).width
export function tracked(c, s, x, y, sp = 0, align = 'left') {
  if (!sp) { const w = mw(c, s); c.fillText(s, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y); return w }
  const ws = [...s].map(ch => mw(c, ch)); const w = ws.reduce((a, b) => a + b + sp, -sp)
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
  ;[...s].forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp }); return w
}
export function mono(c, s, x, y, size, color, { align = 'left', weight = 500, sp = 0, alpha = 1 } = {}) {
  c.save(); c.globalAlpha *= alpha; font(c, 'mono', size, weight); c.fillStyle = color; const w = tracked(c, s, x, y, sp, align); c.restore(); return w
}
export function glowText(c, s, x, y, color, blur, align = 'left') {
  c.save(); c.fillStyle = color; c.shadowColor = color; c.shadowBlur = blur; tracked(c, s, x, y, 0, align); c.shadowBlur = blur * 0.35; tracked(c, s, x, y, 0, align); c.restore()
}
// typed text: n chars of s, optional block cursor
export function typed(c, s, x, y, size, color, n, { cursor = false, blink = 1, weight = 500 } = {}) {
  font(c, 'mono', size, weight); c.fillStyle = color; const vis = s.slice(0, Math.max(0, Math.floor(n))); c.fillText(vis, x, y)
  const cx = x + mw(c, vis)
  if (cursor && blink) c.fillRect(cx + 2, y - size * 0.82, size * 0.56, size * 1.0)
  return cx
}

// ---------- geometry ----------
export function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L }
export function poly(c, pts, u = 1) {
  if (u <= 0 || pts.length < 2) return
  let rem = polyLen(pts) * clamp(u); c.beginPath(); c.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (d >= rem) { const f = rem / d; c.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); break }
    c.lineTo(pts[i][0], pts[i][1]); rem -= d
  }
  c.stroke()
}
export const seg = (c, x1, y1, x2, y2, u = 1) => poly(c, [[x1, y1], [x2, y2]], u)

// ---------- slonik (PostgreSQL elephant, from assets/slonik.svg) ----------
function svgPolys(d, steps = 14) {
  const tk = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g); let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0
  const out = []; let cur = null; const num = () => parseFloat(tk[i++])
  const cubic = (x1, y1, x2, y2, x3, y3) => { for (let s = 1; s <= steps; s++) { const t = s / steps, m = 1 - t
    cur.push([m*m*m*x + 3*m*m*t*x1 + 3*m*t*t*x2 + t*t*t*x3, m*m*m*y + 3*m*m*t*y1 + 3*m*t*t*y2 + t*t*t*y3]) } lcx = x2; lcy = y2; x = x3; y = y3 }
  while (i < tk.length) {
    if (/[a-zA-Z]/.test(tk[i])) cmd = tk[i++]
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0
    if (C === 'M') { x = ox + num(); y = oy + num(); sx = x; sy = y; cur = [[x, y]]; out.push(cur); cmd = rel ? 'l' : 'L' }
    else if (C === 'L') { x = ox + num(); y = oy + num(); cur.push([x, y]) }
    else if (C === 'C') { const a = [num(), num(), num(), num(), num(), num()]; cubic(ox + a[0], oy + a[1], ox + a[2], oy + a[3], ox + a[4], oy + a[5]) }
    else if (C === 'S') { const a = [num(), num(), num(), num()]; cubic(2 * x - lcx, 2 * y - lcy, ox + a[0], oy + a[1], ox + a[2], oy + a[3]) }
    else if (C === 'Z') { cur.push([sx, sy]); x = sx; y = sy }
    else i++
  }
  return out
}
const svg = fs.readFileSync(new URL('../assets/slonik.svg', import.meta.url), 'utf8')
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1])
const SL = { outline: svgPolys(ds[1]), lines: ds.slice(2, 8).flatMap(d => svgPolys(d)).concat(svgPolys(ds[10] || '')), eyes: [svgPolys(ds[8])[0], svgPolys(ds[9])[0]] }
export function slonik(c, cx, cy, h, u = 1, { color, width = 3, fill = null, eye = 1, eyeColor } = {}) {
  const s = h / 445, ox = cx - 216 * s, oy = cy - 222 * s, T = p => p.map(([x, y]) => [ox + x * s, oy + y * s])
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'
  if (fill && u > 0.6) { c.globalAlpha *= clamp((u - 0.6) / 0.4); c.fillStyle = fill; c.beginPath(); for (const pl of SL.outline) { const p = T(pl); c.moveTo(p[0][0], p[0][1]); for (const q of p) c.lineTo(q[0], q[1]) } c.fill(); c.globalAlpha = 1 }
  c.strokeStyle = color; c.lineWidth = width
  for (const pl of SL.outline) poly(c, T(pl), u)
  if (fill) c.strokeStyle = eyeColor || color
  SL.lines.forEach((pl, i) => poly(c, T(pl), clamp(u * 1.4 - 0.25 - i * 0.03)))
  if (u > 0.8) { c.globalAlpha = clamp((u - 0.8) / 0.2) * eye; c.fillStyle = eyeColor || color
    for (const e of SL.eyes) { const p = T(e); c.beginPath(); p.forEach((q, j) => j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.fill() } }
  c.restore()
}
