// Shared drawing helpers for the Postgres film.
import fs from 'fs'
export const W = 1920, H = 1080, FPS = 30

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, t) => a + (b - a) * t
export const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3)
export const easeOutBack = t => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2) }
export function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

export const THEMES = {
  paper: { bg0: '#efe5cf', bg1: '#d9cba9', ink: '#2b241d', dim: 'rgba(43,36,29,0.62)', cap: 'rgba(43,36,29,0.8)', faint: 'rgba(43,36,29,0.14)',
    accent: '#2f5f8f', hot: '#a8322a', glow: null, aberr: 'multiply' },
  dark: { bg0: '#141821', bg1: '#040507', ink: '#f2e8d3', dim: 'rgba(242,232,211,0.66)', cap: 'rgba(242,232,211,0.82)', faint: 'rgba(242,232,211,0.12)',
    accent: '#f2c46b', hot: '#6fb2f0', glow: 'rgba(242,196,107,0.85)', aberr: 'screen' },
  blue: { bg0: '#10263d', bg1: '#03070d', ink: '#e6f0fa', dim: 'rgba(230,240,250,0.66)', cap: 'rgba(230,240,250,0.82)', faint: 'rgba(170,210,250,0.14)',
    accent: '#7cc0ff', hot: '#f2c46b', glow: 'rgba(110,180,255,0.9)', aberr: 'screen' },
}

// ---------- text ----------
export function spaced(c, s, x, y, sp, align = 'left') {
  let w = 0; const ws = [...s].map(ch => { const m = c.measureText(ch).width; w += m + sp; return m }); w -= sp
  let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x
  const a = c.textAlign; c.textAlign = 'left'
  ;[...s].forEach((ch, i) => { c.fillText(ch, cx, y); cx += ws[i] + sp })
  c.textAlign = a; return w
}
export function mono(c, s, x, y, size, color, sp = 4, align = 'left', weight = 500) {
  c.font = `${weight} ${size}px Mono`; c.fillStyle = color; return spaced(c, s, x, y, sp, align)
}
// glyph run with chromatic aberration + optional glow
export function title(c, th, s, x, y, size, color, { weight = 800, sp = 2, ab = 2.2, alpha = 1, glow = 0, align = 'left', font = 'Cinzel' } = {}) {
  c.save(); c.globalAlpha = alpha; c.font = `${weight} ${size}px ${font}`
  if (ab > 0) {
    c.globalCompositeOperation = th.aberr
    c.fillStyle = th.aberr === 'screen' ? 'rgba(255,40,40,0.55)' : 'rgba(220,40,40,0.55)'; spaced(c, s, x - ab, y, sp, align)
    c.fillStyle = th.aberr === 'screen' ? 'rgba(40,200,255,0.55)' : 'rgba(30,170,190,0.55)'; spaced(c, s, x + ab, y, sp, align)
    c.globalCompositeOperation = 'source-over'
  }
  if (glow && th.glow) { c.shadowColor = color; c.shadowBlur = glow }
  c.fillStyle = color; const w = spaced(c, s, x, y, sp, align)
  if (glow && th.glow) { c.shadowBlur = glow * 2.2; c.globalAlpha = alpha * 0.5; spaced(c, s, x, y, sp, align) }
  c.restore(); return w
}

// Headline block: lines of words; *word* = accent. Words pop in on half-beats.
export const EVENTS = []
export function headline(c, th, S, lines, { x = 110, y = 400, size = 60, big = 118, start = 0, step = 0.5, gap = 0.9, accentColor, glow, maxW = 790 } = {}) {
  let k = 0, cy = y
  for (const line of lines) {
    const isBig = line.startsWith('!'); const L = isBig ? line.slice(1) : line
    let sz = isBig ? big : size
    { c.font = `${isBig ? 900 : 700} ${sz}px Cinzel`; const words = L.replace(/\*/g, '').split(' ')
      const lw = words.reduce((a, w) => a + [...w].reduce((b, ch) => b + c.measureText(ch).width + 2, 0), 0) + sz * 0.28 * (words.length - 1)
      if (lw > maxW) sz = Math.floor(sz * maxW / lw) }
    cy += sz * (isBig ? 1.0 : 1.05)
    let cx = x
    for (const raw of L.split(' ')) {
      const acc = raw.includes('*'); const w = raw.replace(/\*/g, '')
      const bt = start + k * step; k++
      if (S.record) EVENTS.push({ t: S.t0 + bt * S.bd, kind: acc ? 'accent' : 'word' })
      const p = clamp((S.b - bt) / 0.35)
      c.font = `${isBig ? 900 : 700} ${sz}px Cinzel`
      const ww = [...w].reduce((a, ch) => a + c.measureText(ch).width + 2, 0)
      if (p > 0) {
        const col = acc ? (accentColor || th.accent) : th.ink
        const sc = lerp(1.35, 1, easeOutBack(p)); c.save(); c.translate(cx, cy); c.scale(sc, sc)
        title(c, th, w, 0, (1 - easeOut(p)) * 14, sz, col, { weight: isBig ? 900 : 700, ab: 1.5 + 12 * (1 - p), alpha: easeOut(clamp(p * 1.6)), glow: glow ?? (th.glow ? (acc ? 26 : 10) : 0) })
        c.restore()
      }
      cx += ww + sz * 0.28
    }
    cy += sz * 0.12
  }
  return cy
}
export function caption(c, th, S, s, x, y, at = 1.5) {
  const n = Math.floor(clamp((S.b - at) / 1.5) * s.length)
  if (n > 0) mono(c, s.slice(0, n), x, y, 23, th.cap, 4, 'left', 600)
}

// ---------- geometry ----------
export function polyLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L }
export function poly(c, pts, u = 1, close = false) {
  if (u <= 0 || pts.length < 2) return
  const P = close ? [...pts, pts[0]] : pts
  const tot = polyLen(P); let rem = tot * clamp(u)
  c.beginPath(); c.moveTo(P[0][0], P[0][1])
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])
    if (d >= rem) { const f = rem / d; c.lineTo(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f); break }
    c.lineTo(P[i][0], P[i][1]); rem -= d
  }
  c.stroke()
}
export const line = (c, x1, y1, x2, y2, u = 1) => poly(c, [[x1, y1], [x2, y2]], u)
export function rectP(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]] }
export function circP(cx, cy, r, n = 90, a0 = -Math.PI / 2) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]) } return p }

// Minimal SVG path flattener (M, L, C, S, c, s, l, z) -> list of polylines
export function svgPolys(d, steps = 14) {
  const tk = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g); let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0
  const out = []; let cur = null; const num = () => parseFloat(tk[i++])
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let s = 1; s <= steps; s++) { const t = s / steps, m = 1 - t
      cur.push([m*m*m*x + 3*m*m*t*x1 + 3*m*t*t*x2 + t*t*t*x3, m*m*m*y + 3*m*m*t*y1 + 3*m*t*t*y2 + t*t*t*y3]) }
    lcx = x2; lcy = y2; x = x3; y = y3 }
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

// ---------- Slonik ----------
const svg = fs.readFileSync(new URL('../assets/slonik.svg', import.meta.url), 'utf8')
const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map(m => m[1])
export const SLONIK = {
  outline: svgPolys(ds[1]), lines: ds.slice(2, 8).flatMap(d => svgPolys(d)).concat(svgPolys(ds[10] || '')),
  eyes: [svgPolys(ds[8])[0], svgPolys(ds[9])[0]], fill: ds[1],
}
// draw slonik centred at cx,cy with height h. u = draw progress. mode 'line' | 'logo'
export function slonik(c, th, cx, cy, h, u = 1, { color, width = 3, fill = null, glow = 0, eye = 1 } = {}) {
  const s = h / 445, ox = cx - 216 * s, oy = cy - 222 * s
  const T = p => p.map(([x, y]) => [ox + x * s, oy + y * s])
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round'
  if (fill && u > 0.6) {
    c.globalAlpha = clamp((u - 0.6) / 0.4); c.translate(ox, oy); c.scale(s, s); c.fillStyle = fill
    const P = SLONIK.outline; c.beginPath(); for (const pl of P) { c.moveTo(pl[0][0], pl[0][1]); for (const q of pl) c.lineTo(q[0], q[1]) } c.fill()
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1
  }
  c.strokeStyle = color || th.ink; c.lineWidth = width
  if (glow) { c.shadowColor = color; c.shadowBlur = glow }
  for (const pl of SLONIK.outline) poly(c, T(pl), u)
  c.strokeStyle = fill ? '#fff' : (color || th.ink)
  SLONIK.lines.forEach((pl, i) => poly(c, T(pl), clamp(u * 1.4 - 0.25 - i * 0.03)))
  if (u > 0.8) { c.globalAlpha = clamp((u - 0.8) / 0.2) * eye; c.fillStyle = fill ? '#fff' : (color || th.ink)
    for (const e of SLONIK.eyes) { const p = T(e); c.beginPath(); p.forEach((q, j) => j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.fill() } }
  c.restore()
}

// ---------- globe / map ----------
const land = JSON.parse(fs.readFileSync(new URL('../assets/land.json', import.meta.url), 'utf8'))
export const LAND = land.features.flatMap(f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map(p => p[0]))
export function ortho(lon, lat, lon0, lat0) {
  const r = Math.PI / 180, φ = lat * r, λ = (lon - lon0) * r, φ0 = lat0 * r
  const x = Math.cos(φ) * Math.sin(λ), y = Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ)
  const z = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ)
  return [x, -y, z]
}
export function globe(c, th, cx, cy, R, lon0, lat0, { color, u = 1, grid = true } = {}) {
  c.save(); c.strokeStyle = color || th.ink
  c.lineWidth = 2; poly(c, circP(cx, cy, R, 120), u)
  if (grid) { c.globalAlpha = 0.25; c.lineWidth = 1
    for (let lon = -180; lon < 180; lon += 20) { const seg = []; for (let lat = -90; lat <= 90; lat += 5) { const [x, y, z] = ortho(lon, lat, lon0, lat0); if (z > 0) seg.push([cx + x * R, cy + y * R]); else if (seg.length) { poly(c, seg, u); seg.length = 0 } } poly(c, seg, u) }
    for (let lat = -60; lat <= 60; lat += 30) { const seg = []; for (let lon = -180; lon <= 180; lon += 5) { const [x, y, z] = ortho(lon, lat, lon0, lat0); if (z > 0) seg.push([cx + x * R, cy + y * R]); else if (seg.length) { poly(c, seg, u); seg.length = 0 } } poly(c, seg, u) } }
  c.globalAlpha = 0.9; c.lineWidth = 1.4
  for (const ring of LAND) { let seg = []; for (const [lo, la] of ring) { const [x, y, z] = ortho(lo, la, lon0, lat0); if (z > 0) seg.push([cx + x * R, cy + y * R]); else if (seg.length) { poly(c, seg, u); seg = [] } } if (seg.length) poly(c, seg, u) }
  c.restore()
}
export function mapXY(lon, lat, x0, y0, w, h) { return [x0 + (lon + 180) / 360 * w, y0 + (90 - lat) / 180 * h] }
export function flatMap(c, th, x0, y0, w, h, { color, u = 1 } = {}) {
  c.save(); c.strokeStyle = color || th.ink; c.lineWidth = 1.2
  for (const ring of LAND) { if (ring.some(q => q[1] < -60)) continue; poly(c, ring.map(([lo, la]) => mapXY(lo, la, x0, y0, w, h)), u) }
  c.restore()
}
export const CITIES = [[-122.4, 37.8], [-122.3, 47.6], [-118.2, 34], [-74, 40.7], [-77, 38.9], [-87.6, 41.9], [-96.8, 32.8], [-79.4, 43.7], [-99.1, 19.4], [-46.6, -23.5], [-58.4, -34.6], [-70.6, -33.4], [-0.1, 51.5], [2.35, 48.85], [13.4, 52.5], [8.7, 50.1], [4.9, 52.4], [18.1, 59.3], [-3.7, 40.4], [12.5, 41.9], [21, 52.2], [37.6, 55.75], [30.5, 50.45], [28.97, 41], [31.2, 30], [3.4, 6.5], [36.8, -1.3], [18.4, -33.9], [28, -26.2], [55.3, 25.2], [72.9, 19.1], [77.6, 12.97], [77.2, 28.6], [103.8, 1.35], [100.5, 13.75], [106.8, -6.2], [121.5, 31.2], [116.4, 39.9], [114.2, 22.3], [121.5, 25], [127, 37.5], [139.7, 35.7], [135.5, 34.7], [151.2, -33.9], [144.9, -37.8], [174.8, -36.8], [-43.2, -22.9], [-123.1, 49.3], [60.6, 56.8], [24.9, 60.2]]
