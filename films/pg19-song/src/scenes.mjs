// Scene table + lyric layer for "Must Be Reliable". All times are seconds on the audio clock of the chosen take.
// Cuts are placed on vocal onsets (line starts, from assets/words.json) or on downbeats (assets/beats.json).
import fs from 'fs'
import { W, H, FPS, clamp, lerp, ease, easeOut, easeIn, easeOutBack, rng, fq, THEMES, PAL, rgba, font, mw, tracked, mono, glowText, typed,
  poly, seg, slonik, LINES, line, lineT0, lineLast, lineEnd, wordT, bar, BEAT, BAR, energy, sinceBeat, sinceDown, sinceHit, COMMITS, TOTAL } from './lib.mjs'

const O = PAL.orange
const HEAP = fs.readFileSync(new URL('../assets/heapam_excerpt.txt', import.meta.url), 'utf8').split('\n')
const REMIX = JSON.parse(fs.readFileSync(new URL('../assets/remix_events.json', import.meta.url), 'utf8'))

// ───────────── recording (QA): first frame each lyric word / card / scene-word becomes visible ─────────────
export const REC = { on: false, f: 0, words: {}, marks: {} }
const seen = (key) => { if (REC.on && !(key in REC.words)) REC.words[key] = REC.f }
const mark = (key) => { if (REC.on && !(key in REC.marks)) REC.marks[key] = REC.f }
const widx = new Map(); { let i = 0; for (const id in LINES) for (const w of LINES[id]) widx.set(w, i++) }

// ───────────── CVE counter spine ─────────────
// 0 → 5 on "Five" (Feb 12) → 16 on "eleven" (May 14) → 44 across the first "forty-four" (Aug 13 total); frozen in the bridge.
const T5 = wordT('1.1', 0), T16 = wordT('1.2', 2), T44a = wordT('3.0', 0), T44b = lineEnd('3.0')
export function cveAt(t) {
  if (t < T5) return { v: 0, asof: '2026-01-01' }
  if (t < T16) return { v: Math.round(lerp(0, 5, easeOut((t - T5) / 0.2))), asof: '2026-02-12 · 18.2' }
  if (t < T44a) return { v: Math.round(lerp(5, 16, easeOut((t - T16) / 0.2))), asof: '2026-05-14 · 18.4' }
  return { v: Math.round(lerp(16, 44, ease((t - T44a) / (T44b - T44a)))), asof: '2026-08-13 · 18.6' }
}
const TF0 = lineT0('10.0'), TF1 = lineLast('10.7')
export function openItemsAt(t) { return Math.round(lerp(176, 9, 1 - Math.pow(1 - clamp((t - TF0) / (TF1 - TF0)), 2.2))) }

// ───────────── lyric layer ─────────────
// A group shows its lines as a rolling stack: the current line at (x, y), up to `stack-1` previous lines above it, dimmed.
// A word is visible from the frame nearest its vocal onset (fq), so word-sync error <= half a frame.
const ACC = new Set(['heap', 'overflow', 'Five', 'eleven,', 'record', 'smile', 'scanner', 'ghosts', 'climbing', 'Climbing,',
  'forty-four', 'down', 'burning', 'more', 'twenty-eight', 'most', 'regression', 'three', 'curl', 'worm', 'Sixty-six', 'thousand',
  'maintainer', 'reliable', 'reliable,', 'Seven', 'hundred', 'sixty-two', 'fix', 'Thirty', 'Nine', 'Repack', 'parallel',
  'Three', 'still', 'here', 'never', 'town', 'October', 'find'])
const NOACC = { '3.2': ['Seven'], '6.2': ['Seven'], '4.1': ['now'], '10.3': ['still'], '10.7': [], '11.1': [] }
function isAcc(id, w) {
  if (NOACC[id]?.includes(w.w)) return false
  if (w.w === 'down' && !id.startsWith('3.') && !id.startsWith('6.')) return false
  if (w.w === 'town' && id !== '10.7') return false
  if (w.w === 'Seven' && id !== '9.0') return false
  if (w.w === 'three' && id !== '4.3') return false
  if (w.w === 'Three' && id !== '10.4') return false
  if (w.w === 'hundred' && id === '9.1') return false
  if (w.w === 'here' && id !== '10.5') return false
  if (w.w === 'still' && id !== '10.5') return false
  return ACC.has(w.w)
}
export const GROUPS = []
function G(lines, t1, o) { const g = { lines, t0: lineT0(lines[0]), t1, stack: 2, style: 'grotesk', size: 62, x: 150, y: 985, align: 'left', maxW: 1500, ...o }; GROUPS.push(g); return g }
function drawLine(c, th, id, g, t, x, y, alpha, size) {
  const ws = LINES[id]; font(c, g.style, size)
  const sp = size * (g.style === 'grotesk' ? 0.26 : g.style === 'mono' ? 0.6 : 0.28)
  const text = ws.map(w => w.w).join(' '); const total = mw(c, text) + (ws.length - 1) * (sp - mw(c, ' '))
  let cx = g.align === 'center' ? x - total / 2 : x
  for (const w of ws) {
    const s = w.w, ww = mw(c, s), tw = fq(w.t)
    if (t + 1e-6 >= tw) {
      const k = clamp((t - tw) / (3 / FPS)); const acc = isAcc(id, w)
      c.save(); c.globalAlpha = alpha * (0.45 + 0.55 * k)
      const dy = (1 - easeOut(k)) * size * 0.14
      c.fillStyle = acc ? th.acc : th.ink
      if (acc && th.dark) { c.shadowColor = th.acc; c.shadowBlur = 22 * alpha }
      c.fillText(s, cx, y + dy); c.restore()
      if (alpha > 0.5) seen(widx.get(w))
    }
    cx += ww + sp
  }
}
export function lyrics(c, th, t) {
  for (const g of GROUPS) {
    if (t < g.t0 - 0.001 || t >= g.t1) continue
    const started = g.lines.filter(id => t + 1e-6 >= fq(lineT0(id)))
    if (g.scrim !== false && started.length) {  // lower-third band: soft scrim so captions never fight the picture
      const sg = c.createLinearGradient(0, 770, 0, 900); const col = th.dark ? '11,10,9' : '241,232,213'
      sg.addColorStop(0, `rgba(${col},0)`); sg.addColorStop(1, `rgba(${col},0.88)`); c.fillStyle = sg; c.fillRect(0, 770, W, 130); c.fillStyle = `rgba(${col},0.88)`; c.fillRect(0, 900, W, H - 900) }
    const vis = started.slice(-g.stack)
    let size = g.size
    font(c, g.style, size)
    for (const id of g.lines) { const txt = LINES[id].map(w => w.w).join(' '); const wd = mw(c, txt); if (wd > g.maxW) size = Math.min(size, Math.floor(g.size * g.maxW / wd)) }
    const lh = size * 1.22
    vis.forEach((id, i) => {
      const age = vis.length - 1 - i                   // 0 = current line
      const tNew = vis.length > 1 ? fq(lineT0(vis[vis.length - 1])) : -9
      const y = g.y - age * lh
      const alpha = age === 0 ? 1 : lerp(0.6, g.dimPrev ?? 0.3, easeOut((t - tNew) / 0.12))
      const x = g.x
      if (g.box && age === 0) { c.save(); c.globalAlpha = 0.9; c.fillStyle = th.dark ? 'rgba(11,10,9,0.72)' : 'rgba(241,232,213,0.8)'; c.fillRect(x - 24, y - size * 0.95, g.maxW + 48, size * 1.35); c.restore() }
      drawLine(c, th, id, g, t, x, y, alpha * (g.alpha ?? 1), size)
    })
  }
}

// ───────────── shared visual pieces ─────────────
function dateline(c, th, s, t, t0, { x = 150, y = 150, align = 'left' } = {}) {
  const n = clamp((t - t0) / 0.5) * s.length; c.save(); font(c, 'mono', 18, 600); c.fillStyle = th.dim; c.fillText(s.slice(0, Math.floor(n)), align === 'right' ? x - mw(c, s) : x, y); c.restore()
}
function tag(c, th, s, x, y, { size = 22, col, fill, alpha = 1, pad = 10 } = {}) {
  c.save(); c.globalAlpha *= alpha; font(c, 'mono', size, 600); const w = mw(c, s) + pad * 2, h = size * 1.6
  if (fill) { c.fillStyle = fill; c.fillRect(x, y - h * 0.72, w, h) }
  c.strokeStyle = col || th.faint; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y - h * 0.72 + 0.5, w, h)
  c.fillStyle = col || th.ink; c.fillText(s, x + pad, y); c.restore(); return w
}
export function psqlBox(c, th, t, n, t0, tRes, { x = 560, y = 250, rows = 0, result = null, w = 800, alpha = 1 } = {}) {
  if (t < t0) return
  c.save(); c.globalAlpha *= alpha * clamp((t - t0) / 0.15)
  const h = result && t >= tRes ? 250 : 150
  c.fillStyle = th.dark ? 'rgba(20,18,16,0.92)' : 'rgba(233,222,200,0.95)'; c.fillRect(x, y, w, h)
  c.strokeStyle = th.faint; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, w, h)
  c.fillStyle = th.acc; c.fillRect(x, y, 6, h)
  mono(c, 'psql (19beta' + n + ')', x + 26, y + 30, 15, th.dim, { weight: 600 })
  mono(c, 'PROMPT 01', x + w - 20, y + 30, 13, th.dim, { align: 'right' })
  const q = `SELECT hope FROM pg19_beta${n};`
  font(c, 'mono', 30, 500); c.fillStyle = th.dim; c.fillText('psql=#', x + 26, y + 82)
  const qx = x + 26 + mw(c, 'psql=# ')
  const chars = clamp((t - t0 - 0.12) / 0.9) * q.length
  const blink = Math.floor(t * 2.2) % 2 === 0
  const endX = typed(c, q, qx, y + 82, 30, th.ink, chars, { cursor: t < tRes, blink })
  // "hope" is the key word
  if (chars > 11) { font(c, 'mono', 30, 500); const hx = qx + mw(c, 'SELECT '); c.fillStyle = th.acc; c.fillText('hope', hx, y + 82) }
  if (t >= tRes) {
    const k = clamp((t - tRes) / (2 / FPS))
    c.globalAlpha *= 0.4 + 0.6 * k
    if (result) {
      mono(c, '       hope', x + 26, y + 124, 26, th.ink); mono(c, '──────────────────', x + 26, y + 152, 26, th.dim)
      mono(c, ' ' + result, x + 26, y + 186, 26, th.acc, { weight: 700 }); mono(c, '(1 row)', x + 26, y + 226, 26, th.acc, { weight: 700 })
    } else mono(c, `(${rows} rows)`, x + 26, y + 124, 26, th.dim)
    mark(`psql_beta${n}`)
  }
  c.restore()
}
function strike(c, x1, x2, y, u, col, w = 4) { c.save(); c.strokeStyle = col; c.lineWidth = w; seg(c, x1, y, x2, y, easeOut(u)); c.restore() }
function barChart(c, th, t, bars, { x0 = 560, y0 = 700, bw = 150, gap = 70, hmax = 420, vmax = 44 } = {}) {
  bars.forEach((b, i) => {
    if (t < b.t) return
    const u = b.grow ? easeIn(clamp((t - b.t) / b.grow)) : easeOutBack(clamp((t - b.t) / 0.35))
    const hgt = hmax * b.v / vmax * u, x = x0 + i * (bw + gap)
    c.fillStyle = b.acc ? th.acc : th.ink; c.globalAlpha = b.acc ? 1 : 0.85
    if (b.acc && th.dark) { c.shadowColor = th.acc; c.shadowBlur = 30 }
    c.fillRect(x, y0 - hgt, bw, hgt); c.shadowBlur = 0; c.globalAlpha = 1
    const ly = Math.max(b.acc ? 330 : 120, y0 - hgt - 24)
    if (b.acc) { c.save(); font(c, 'grotesk', 220); c.fillStyle = th.acc; c.shadowColor = th.acc; c.shadowBlur = 40; tracked(c, String(Math.round(b.v * clamp(u))), x + bw / 2, ly, 0, 'center'); c.restore() }
    else mono(c, String(Math.round(b.v * clamp(u))), x + bw / 2, ly, 64, th.ink, { align: 'center', weight: 800 })
    mono(c, b.label, x + bw / 2, y0 + 50, 30, b.acc ? th.acc : th.dim, { align: 'center', weight: 700 })
  })
  c.fillStyle = th.faint; c.fillRect(x0 - 30, y0, bars.length * (bw + gap) + 20, 2)
}
function skyline(c, th, t, { y = 900, col, win = null, seed = 5, alpha = 1 } = {}) {
  const R = rng(seed); let x = 0; c.save(); c.globalAlpha *= alpha
  while (x < W) { const w = 60 + R() * 120, h = 90 + R() * 260; c.fillStyle = col; c.fillRect(x, y - h, w - 6, h + 200)
    if (win) for (let yy = y - h + 20; yy < y - 10; yy += 26) for (let xx = x + 12; xx < x + w - 20; xx += 22) if (R() < 0.28) { c.fillStyle = win; c.fillRect(xx, yy, 8, 12) }
    x += w }
  c.restore()
}
function embers(c, th, t, n, { y0 = 900, spread = W, col = O, seed = 11, speed = 60 } = {}) {
  const R = rng(seed)
  for (let i = 0; i < n; i++) {
    const x0 = R() * spread, ph = R() * 10, sp = speed * (0.6 + R()), sz = 1.5 + R() * 3.5
    const yy = y0 - ((t * sp + ph * 80) % 700), xx = x0 + Math.sin(t * 1.3 + ph) * 26
    const a = clamp((yy - (y0 - 700)) / 700) * (0.5 + 0.5 * Math.sin(t * 7 + ph * 3))
    c.fillStyle = rgba(col, a); c.beginPath(); c.arc(xx, yy, sz, 0, 7); c.fill()
  }
}
function ghost(c, x, y, s, col, a) {
  c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = 2; c.beginPath()
  c.moveTo(x - s, y + s); c.lineTo(x - s, y - s * 0.2); c.arc(x, y - s * 0.2, s, Math.PI, 0); c.lineTo(x + s, y + s)
  for (let i = 0; i < 4; i++) { const xx = x + s - (i + 0.5) * s / 2; c.lineTo(xx, y + s - (i % 2 ? 0 : s * 0.3)) }
  c.lineTo(x - s, y + s); c.stroke(); c.fillStyle = col; c.fillRect(x - s * 0.45, y - s * 0.35, s * 0.2, s * 0.3); c.fillRect(x + s * 0.25, y - s * 0.35, s * 0.2, s * 0.3); c.restore()
}
const CVE_FEB = ['2003', '2004', '2005', '2006', '2007']
const CVE_MAY = ['6472', '6473', '6474', '6475', '6476', '6477', '6478', '6479', '6575', '6637', '6638']
const CVE_AUG = ['6464', '6469', '6470', '6471', '14662', '14663', '14664', '14666', '14668', '14669', '14670', '14671', '14672', '14673',
  '14676', '14677', '14678', '14679', '14680', '14681', '15741', '15742', '16238', '16239', '16241', '18024', '18408', '19385']
const ALL44 = [...CVE_FEB, ...CVE_MAY, ...CVE_AUG]

// ───────────── burst cards (hook hits) ─────────────
// Each card: a hard cut to one word, inverted cream/black alternately; an orange frame precedes the first card and DOOR.
export function burstCards(pre) {
  const L0 = LINES[pre + '.0'], L1 = LINES[pre + '.1']
  const f0 = L0[0], f1 = L0[1], k0 = L1[0], k1 = L1[1], at = L1[2], door = L1[4]
  // "FOUR" lands mid-word, but never later than 0.5 s + 1 frame before the next cut (readability); if there's no room,
  // both halves show at once. The two "knocking"s share one card: the second knock flips it cream/black and shakes it,
  // so the word never leaves the screen (the vocals are only 0.5 s apart).
  const split = (w, next) => { const sp = Math.min(w.t + (w.e - w.t) * 0.5, next - 0.5 - 2 / FPS); return sp <= w.t + 1 / FPS ? null : sp }
  const merge = k0.t - f1.t < 0.6   // no room for a readable cut before "Knocking": flip in place instead
  return [
    { t: f0.t, split: split(f0, merge ? k0.t : f1.t), words: ['FORTY', 'FOUR'], inv: false, flash: true, flipAt: merge ? f1.t : null, key: pre + '.0.0' },
    ...(merge ? [] : [{ t: f1.t, split: split(f1, k0.t), words: ['FORTY', 'FOUR'], inv: true, key: pre + '.0.1' }]),
    { t: k0.t, words: ['KNOCKING'], inv: false, flipAt: k1.t, small: { s: 'AT THE', t: at.t }, key: pre + '.1.0' },
    { t: door.t, words: ['DOOR'], inv: false, flash: true, door: true, key: pre + '.1.4' },
  ]
}
function drawCard(c, t, cards, i, tEnd) {
  const cd = cards[i], flipped = cd.flipAt && t + 1e-6 >= fq(cd.flipAt), lt = t - fq(flipped ? cd.flipAt : cd.t)
  const inv = cd.inv !== !!flipped
  const bg = inv ? PAL.cream : PAL.black, ink = inv ? PAL.black : PAL.cream
  if (flipped) mark('flip_' + cd.key)
  if (cd.flash && lt < 2 / FPS) { c.fillStyle = O; c.fillRect(0, 0, W, H); mark('flash_' + cd.key); return { bg: O, ink: PAL.black } }
  c.fillStyle = bg; c.fillRect(0, 0, W, H)
  mark('card_' + cd.key)
  const two = cd.words.length === 2
  const size = two ? 400 : cd.words[0].length > 5 ? 330 : 520
  font(c, 'grotesk', size)
  const sx = (cd.shake || flipped) ? Math.sin(lt * 60) * 14 * clamp(1 - lt / 0.25) : 0
  const x = 140 + sx
  cd.words.forEach((w, j) => {
    const tw = j === 0 || cd.split == null ? fq(cd.t) : fq(cd.split)
    if (t + 1e-6 < tw) return
    const y = two ? (j === 0 ? 470 : 860) : 700
    const k = clamp((t - Math.max(tw, fq(flipped ? cd.flipAt : cd.t))) / (5 / FPS))
    // motion echo on entry (like a smeared type slam)
    for (let e = 3; e >= 1; e--) { c.globalAlpha = (1 - k) * 0.22 * e / 3; c.fillStyle = ink; c.fillText(w, x, y + e * 44 * (1 - k)) }
    c.globalAlpha = 1; c.fillStyle = (cd.door || (two && j === 1 && cd.inv === false && i === 0)) ? (cd.door ? ink : ink) : ink
    const ww = mw(c, w)
    const sc = cd.words[0].length > 5 ? Math.min(1, (W - 280) / ww) : Math.min(1, (W - 280) / ww)
    c.save(); c.translate(x, y); c.scale(sc, 1); c.fillText(w, 0, 0); c.restore()
    if (REC.on) mark(`cardword_${cd.key}_${j}`)
  })
  if (cd.small && t >= fq(cd.small.t)) mono(c, cd.small.s, 150, 260, 40, ink, { weight: 700 })
  if (cd.door) { // a door frame opening behind the word: thin orange outline
    const u = easeOut(lt / 0.8); c.save(); c.strokeStyle = O; c.lineWidth = 5; c.shadowColor = O; c.shadowBlur = 24
    const dx = 1380, dy = 200, dw = 330, dh = 700
    c.strokeRect(dx, dy, dw, dh)
    c.beginPath(); c.moveTo(dx, dy); c.lineTo(dx + dw * (1 - 0.55 * u), dy + 60 * u); c.lineTo(dx + dw * (1 - 0.55 * u), dy + dh - 60 * u); c.lineTo(dx, dy + dh); c.stroke()
    c.restore()
  }
  // tiny HUD on cards
  mono(c, `HOOK ${String(i + 1).padStart(2, '0')}/0${cards.length}`, W - 150, 150, 16, ink, { align: 'right', alpha: 0.6 })
  return { bg, ink }
}
export function cardsAt(cards, t, tEnd) { let i = -1; for (let k = 0; k < cards.length; k++) if (t + 1e-6 >= fq(cards[k].t)) i = k; return i }

// ───────────── scenes ─────────────
const B = bar
const S = []
const add = (id, t0, t1, o) => S.push({ id, t0, t1, ...o })

// INTRO: one cursor, the first commit, 30 years
add('intro', 0, B(6), { theme: 'dark', bg: 'void', sec: 'INTRO', hud: 0,
  draw(c, th, t) {
    const x = 240, y = 400, blink = Math.floor(t * 1.6) % 2 === 0
    const cmd = "git log --reverse --format='%h %ad %s' | head -1"
    const tc = fq(wordT('0.0', 0))
    font(c, 'mono', 28, 500); c.fillStyle = th.dim; c.fillText('$', x, y)
    const n = clamp((t - tc) / 2.6) * cmd.length
    typed(c, cmd, x + 36, y, 28, th.ink, n, { cursor: t < fq(wordT('0.1', 0)), blink })
    const tv = fq(wordT('0.1', 0))
    if (t >= tv) {
      font(c, 'mono', 28, 500); const out = 'd31084e9d1 1996-07-09 06:22 Postgres95 1.01 Distribution - '
      c.fillStyle = th.ink; c.fillText(out, x, y + 56); const ox = x + mw(c, out)
      if (t >= fq(wordT('0.1', 1))) { c.save(); c.fillStyle = th.acc; c.shadowColor = th.acc; c.shadowBlur = 18; c.fillText('Virgin Sources', ox, y + 56); c.restore() }
      mono(c, 'Author: Marc G. Fournier   ·   1 commit', x, y + 100, 20, th.dim)
      mark('first_commit')
    }
    const tt = fq(wordT('0.2', 0))
    if (t >= tt) { // 30 years: a line with 31 year ticks
      const u = ease((t - tt) / 1.6), x0 = 240, x1 = 1680, yy = 640
      c.strokeStyle = th.dim; c.lineWidth = 2; seg(c, x0, yy, x1, yy, u)
      for (let i = 0; i <= 30; i++) { const xi = x0 + (x1 - x0) * i / 30; if ((xi - x0) / (x1 - x0) > u) break
        c.fillStyle = i === 30 ? th.acc : th.dim; c.fillRect(xi - 1, yy - (i % 10 === 4 ? 16 : 9), 2, i % 10 === 4 ? 32 : 18) }
      mono(c, '1996', x0, yy + 44, 20, th.dim); if (u > 0.98) mono(c, '2026', x1, yy + 44, 20, th.acc, { align: 'right', weight: 700 })
    }
  } })

// VERSE 1 — "advisory" wireframe style
add('heap', B(6), lineT0('1.1'), { theme: 'dark', bg: 'grid', sec: 'VERSE 1',
  draw(c, th, t) {
    dateline(c, th, 'FEB 12 2026  ·  pgcrypto', t, B(6))
    const x0 = 150, y0 = 380, cw = 50, n = 32, tw = fq(wordT('1.0', 0)), tov = fq(wordT('1.0', 5))
    mono(c, 'chunk A · 16 bytes', x0, y0 - 30, 18, th.dim); mono(c, 'chunk B · next', x0 + 16 * cw + 10, y0 - 30, 18, th.dim)
    const rate = 16 / (tov - tw) // fill chunk A exactly by "overflow"
    const filled = t < tw ? 0 : Math.min(n, Math.floor((t - tw) * rate) + (t >= tov ? Math.floor((t - tov) * 22) : 0))
    for (let i = 0; i < n; i++) {
      const x = x0 + i * cw + (i >= 16 ? 10 : 0), over = i >= 16 && i < filled
      c.strokeStyle = over ? th.acc : th.faint; c.lineWidth = over ? 2 : 1.2; c.strokeRect(x, y0, cw - 6, 76)
      font(c, 'mono', 24, 600); c.fillStyle = i < filled ? (over ? th.acc : th.ink) : th.faint
      c.fillText(i < filled ? '41' : (i >= 16 ? 'c3' : '00'), x + 7, y0 + 48)
    }
    // boundary marker
    c.fillStyle = t >= tov ? th.acc : th.dim; c.fillRect(x0 + 16 * cw + 1, y0 - 12, 4, 84)
    if (t >= tov) { const k = easeOut((t - tov) / 0.3)
      c.save(); c.globalAlpha = k; mono(c, 'heap overflow', x0 + 16 * cw + 18, y0 + 170, 64, th.acc, { weight: 800 }); c.restore()
      mono(c, 'CVE-2026-2005 · CVSS 8.8', x0 + 16 * cw + 18, y0 + 220, 24, th.dim, { alpha: k }) }
  } })
add('patch5', lineT0('1.1'), lineT0('1.2'), { theme: 'dark', bg: 'grid', sec: 'VERSE 1',
  draw(c, th, t) {
    dateline(c, th, '2026-02-12 · 18.2 · 17.8 · 16.12 · 15.16 · 14.21', t, lineT0('1.1'))
    const rows = [['2003', '4.3', 'oidvector memory disclosure'], ['2004', '8.8', 'intarray code execution'], ['2005', '8.8', 'pgcrypto heap overflow'],
      ['2006', '8.8', 'multibyte length code execution'], ['2007', '8.2', 'pg_trgm overflow']]
    const t5 = fq(wordT('1.1', 0)), tfix = fq(wordT('1.1', 5)), tgo = fq(wordT('1.1', 7))
    rows.forEach((r, i) => {
      const ts = t5 + i * BEAT / 4; if (t < ts) return
      const k = easeOut((t - ts) / 0.15), leave = easeIn((t - tgo - i * 0.05) / 0.5)
      const y = 280 + i * 78 - leave * 500, a = k * (1 - leave)
      c.save(); c.globalAlpha = a
      mono(c, `CVE-2026-${r[0]}`, 250, y, 34, th.ink, { weight: 700 })
      c.fillStyle = th.faint; c.fillRect(640, y - 20, 200, 14); c.fillStyle = parseFloat(r[1]) >= 8 ? th.acc : th.ink; c.fillRect(640, y - 20, 200 * parseFloat(r[1]) / 10, 14)
      mono(c, r[1], 860, y, 24, th.dim, { weight: 700 }); mono(c, r[2], 940, y, 24, th.dim)
      if (t >= tfix + i * 0.06) mono(c, '✓ fixed', 1440, y, 24, th.ink, { weight: 700, alpha: clamp((t - tfix - i * 0.06) / 0.1) })
      c.restore()
    })
    if (t >= t5) mark('five_rows')
  } })
add('may11', lineT0('1.2'), lineT0('1.3'), { theme: 'dark', bg: 'grid', sec: 'VERSE 1',
  draw(c, th, t) {
    dateline(c, th, '2026-05-14 · 18.4 · 17.10 · 16.14 · 15.18 · 14.23', t, lineT0('1.2'))
    const t11 = fq(wordT('1.2', 2)), trec = fq(wordT('1.2', 4)), twhile = fq(wordT('1.2', 7))
    CVE_MAY.forEach((id, i) => { const ts = t11 + i * BEAT / 8; if (t < ts) return
      const col = i % 4, row = Math.floor(i / 4); tag(c, th, 'CVE-2026-' + id, 250 + col * 330, 300 + row * 90, { size: 26, alpha: easeOut((t - ts) / 0.1) }) })
    if (t >= trec) { const k = easeOutBack((t - trec) / 0.3); c.save(); c.translate(1480, 600); c.rotate(-0.1); c.scale(k, k)
      c.strokeStyle = th.acc; c.lineWidth = 5; c.strokeRect(-190, -70, 380, 120); font(c, 'grotesk', 64); c.fillStyle = th.acc; tracked(c, 'RECORD', 0, 12, 4, 'center')
      mono(c, '11 in one release', 0, 90, 20, th.acc, { align: 'center', weight: 700 }); c.restore() }
    if (t >= twhile) mono(c, '(until August)', 1480, 740, 20, th.dim, { align: 'center', alpha: clamp((t - twhile) / 0.3) })
  } })
add('minor', lineT0('1.3'), lineT0('1.4'), { theme: 'dark', bg: 'grid', sec: 'VERSE 1',
  draw(c, th, t) {
    dateline(c, th, 'MINOR RELEASE · 2026-05-14', t, lineT0('1.3'))
    const tr = fq(wordT('1.3', 4)), ts = fq(wordT('1.3', 9))
    if (t >= fq(wordT('1.3', 0))) { font(c, 'grotesk', 300); c.fillStyle = th.ink; c.fillText('18.4', 230, 560) }
    if (t >= tr) ['17.10', '16.14', '15.18', '14.23'].forEach((v, i) => mono(c, v, 250 + i * 150, 650, 30, th.dim, { weight: 600, alpha: easeOut((t - tr - i * 0.06) / 0.15) }))
    // forced smile: a face whose mouth is a flat line that barely bends
    const cx = 1420, cy = 430, R = 170
    if (t >= tr) { c.save(); c.strokeStyle = th.ink; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke()
      c.fillStyle = th.ink; c.fillRect(cx - 62, cy - 50, 16, 40); c.fillRect(cx + 46, cy - 50, 16, 40)
      const bend = t >= ts ? easeOutBack((t - ts) / 0.4) * 22 : 0
      c.strokeStyle = t >= ts ? th.acc : th.ink; if (t >= ts) { c.shadowColor = th.acc; c.shadowBlur = 20 }
      c.beginPath(); c.moveTo(cx - 80, cy + 60); c.quadraticCurveTo(cx, cy + 60 + bend * 2, cx + 80, cy + 60 - bend * 0.4); c.stroke(); c.restore() }
  } })
function codeView(c, th, t, t0, { scan = true, ghosts = false } = {}) {
  const x = 260, y0 = 230, lh = 30
  mono(c, 'src/backend/access/heap/heapam.c @ REL_19_BETA4  ·  L1434–1480', x, 180, 18, th.dim, { weight: 600 })
  const beam = scan ? y0 + ((t - t0) * 190) % (17 * lh) : 9999
  HEAP.slice(0, 17).forEach((L, i) => {
    const y = y0 + i * lh, read = y < beam
    mono(c, String(1434 + i).padStart(4), x - 70, y, 18, th.faint)
    mono(c, L, x, y, 21, read ? th.ink : th.dim, { alpha: read ? 0.9 : 0.35 })
  })
  if (scan) { const g = c.createLinearGradient(0, beam - 50, 0, beam + 4); g.addColorStop(0, rgba(O, 0)); g.addColorStop(1, rgba(O, 0.28)); c.fillStyle = g; c.fillRect(x - 80, beam - 50, 1400, 54)
    c.fillStyle = O; c.shadowColor = O; c.shadowBlur = 20; c.fillRect(x - 80, beam, 1400, 2.5); c.shadowBlur = 0
    mono(c, `lines read: ${String(Math.min(9999, Math.floor((t - t0) * 190 / lh * 11))).padStart(4, '0')}`, 1660, 180, 18, th.acc, { align: 'right', weight: 700 }) }
  if (ghosts) {
    // highlight a few tokens (illustrative: no claim that these lines contain bugs)
    const hl = [[13, 'unlikely'], [14, 'ereport'], [16, 'errmsg_internal']]
    hl.forEach(([li, tok], k) => { const ts = t0 + 0.35 + k * 0.55; if (t < ts) return
      const L = HEAP[li]; font(c, 'mono', 21, 500); const xi = x + mw(c, L.slice(0, L.indexOf(tok))), wi = mw(c, tok), y = y0 + Math.min(li, 16) * lh
      c.strokeStyle = O; c.lineWidth = 2; c.strokeRect(xi - 4, y - 22, wi + 8, 30)
      ghost(c, xi + wi + 40, y - 30 - (t - ts) * 40, 16, O, clamp(1 - (t - ts) / 2.5)) })
  }
}
add('scanner', lineT0('1.4'), lineT0('1.5'), { theme: 'dark', bg: 'grid', sec: 'VERSE 1', lyricBox: true, draw(c, th, t) { codeView(c, th, t, lineT0('1.4')) } })
add('ghosts', lineT0('1.5'), B(18), { theme: 'dark', bg: 'grid', sec: 'VERSE 1', draw(c, th, t) { codeView(c, th, t, lineT0('1.5'), { scan: false, ghosts: true }) } })

// PRE-CHORUS — the counter in the middle, the recurring prompt
function counterStage(c, th, t, t0, pre, beta) {
  const cv = cveAt(t).v
  if (beta) psqlBox(c, th, t, beta, t0 + 0.1, t0 + 1.35, { x: 560, y: 120 })
  // chart: cumulative 2026 CVEs by release date
  const x0 = 560, x1 = 1360, y0 = 820, y1 = 520, X = m => x0 + (x1 - x0) * m / 12, Y = v => y0 - (y0 - y1) * v / 44
  c.strokeStyle = th.faint; c.lineWidth = 1; seg(c, x0, y0, x1, y0); 'JFMAMJJASOND'.split('').forEach((m, i) => mono(c, m, X(i + 0.5), y0 + 30, 16, th.dim, { align: 'center' }))
  const pts = [[0, 0], [1.4, 0], [1.4, 5], [4.45, 5], [4.45, 16]]; if (pre === 2) pts.push([7.4, 16], [7.4, 44], [8.8, 44])
  const u = ease((t - lineT0(pre === 1 ? '2.0' : '5.0')) / 3.2)
  c.strokeStyle = th.acc; c.lineWidth = 3; c.shadowColor = th.acc; c.shadowBlur = 14; poly(c, pts.map(([m, v]) => [X(m), Y(v)]), u); c.shadowBlur = 0
  // big number
  const bump = LINES[pre === 1 ? '2.1' : '5.1'].concat(LINES[pre === 1 ? '2.0' : '5.0'].slice(-1)).reduce((a, w) => a + (t >= fq(w.t) ? Math.exp(-(t - fq(w.t)) / 0.12) : 0), 0)
  font(c, 'mono', 250 * (1 + 0.06 * bump), 700); c.save(); c.fillStyle = th.acc; c.shadowColor = th.acc; c.shadowBlur = 40 + 30 * bump
  tracked(c, String(cv), 1600, 780, 0, 'right'); c.restore()
  mono(c, 'CVEs · 2026', 1600, 830, 20, th.dim, { align: 'right', weight: 600 })
}
add('pre1', B(18), lineT0('3.0'), { theme: 'dark', bg: 'rings', sec: 'PRE-CHORUS', counterBig: true, draw(c, th, t) { counterStage(c, th, t, B(18), 1, 1) } })

// CHORUS (twice): bursts → chart → slonik → burning town → diff → 44
function chorus(n, pre, tBurstEnd, tEnd) {
  const L = k => `${pre}.${k}`, cards = burstCards(pre)
  add('burst' + n, lineT0(L(0)), tBurstEnd, { theme: 'dark', bg: 'card', sec: 'CHORUS', card: cards,
    draw(c, th, t) { const i = cardsAt(cards, t); if (i >= 0) this._ink = drawCard(c, t, cards, i) } })
  add('chart' + n, tBurstEnd, lineT0(L(3)), { theme: 'dark', bg: 'grid', sec: 'CHORUS',
    draw(c, th, t) {
      const w = LINES[L(2)]
      barChart(c, th, t, [{ label: '2023', v: 7, t: fq(w[0].t) }, { label: '2024', v: 7, t: fq(w[0].t) + BEAT / 4 }, { label: '2025', v: 7, t: fq(w[1].t) },
        { label: '2026', v: 44, t: fq(w[5].t), acc: true, grow: 0.9 }], { x0: 300, y0: 720, bw: 270, gap: 110, hmax: 7 * 28, vmax: 7 })
      mono(c, 'PostgreSQL CVEs per year · postgresql.org/support/security', 1620, 250, 16, th.dim, { align: 'right' })
    } })
  add('slonik' + n, lineT0(L(3)), lineT0(L(4)), { theme: 'dark', bg: 'grid', sec: 'CHORUS',
    draw(c, th, t) { const t0 = lineT0(L(3)); slonik(c, 960, 430, 560, ease((t - t0) / 1.5), { color: th.ink, width: 3.5, eyeColor: th.acc }) } })
  add('town' + n, lineT0(L(4)), lineT0(L(5)), { theme: 'dark', bg: 'void', sec: 'CHORUS',
    draw(c, th, t) {
      const t0 = lineT0(L(4)), tb = fq(LINES[L(4)][5].t)
      const g = c.createLinearGradient(0, 600, 0, H); g.addColorStop(0, rgba(O, 0)); g.addColorStop(1, rgba(O, t >= tb ? 0.22 * n : 0.05)); c.fillStyle = g; c.fillRect(0, 600, W, H - 600)
      skyline(c, th, t, { y: 930, col: '#16130f', win: t >= tb ? rgba(O, 0.8) : rgba(PAL.cream, 0.18) })
      if (t >= tb) embers(c, th, t, 60 * n, { y0: 900 })
      c.save(); c.strokeStyle = th.ink; c.lineWidth = 4; c.shadowColor = th.ink; c.shadowBlur = 10; seg(c, 0, 480, W, 480, ease((t - t0) / 0.45)); c.restore()
      mono(c, 'HOLD', 150, 460, 16, th.dim, { weight: 700 })
    } })
  add('diff' + n, lineT0(L(5)), lineT0(L(6)), { theme: 'dark', bg: 'grid', sec: 'CHORUS',
    draw(c, th, t) {
      const w = LINES[L(5)], tf = fq(w[3].t), tm = fq(w[6].t)
      mono(c, '@@ -1 +1 @@  what we need', 420, 330, 26, th.dim, { weight: 600 })
      if (t >= tf) { mono(c, '- faster', 420, 500, 120, th.ink, { weight: 700, alpha: 0.5 }); font(c, 'mono', 120, 700); strike(c, 420, 420 + mw(c, '- faster'), 460, (t - tf) / 0.25, th.ink, 6) }
      if (t >= tm) { c.save(); c.globalAlpha = clamp((t - tm) / (2 / FPS)); font(c, 'mono', 120, 700); c.fillStyle = th.acc; c.shadowColor = th.acc; c.shadowBlur = 30; c.fillText('+ more', 420, 680); c.restore() }
    } })
  add('wall44_' + n, lineT0(L(6)), tEnd, { theme: 'dark', bg: 'grid', sec: 'CHORUS', noLyric: true,
    draw(c, th, t) {
      const t0 = fq(lineT0(L(6)))
      font(c, 'mono', 22, 600)
      ALL44.forEach((id, i) => { const col = i % 4, row = Math.floor(i / 4), ts = t0 + 0.5 + i * 0.09
        if (t < ts) return; c.fillStyle = rgba(PAL.cream, 0.18 + 0.1 * energy(t)); c.fillText('CVE-2026-' + id, 150 + col * 440, 190 + row * 66) })
      const k = clamp((t - t0) / (3 / FPS)), z = 1 + 0.05 * ease((t - t0) / 8)
      c.save(); c.translate(960, 560); c.scale(z * (1.12 - 0.12 * easeOut(k)), z * (1.12 - 0.12 * easeOut(k))); font(c, 'grotesk', 640)
      c.fillStyle = O; c.shadowColor = O; c.shadowBlur = 60; tracked(c, '44', 0, 230, 0, 'center'); c.restore()
      seen(widx.get(LINES[L(6)][0])); mark('big44_' + n)
      mono(c, 'CVEs fixed in 2026 · 5 + 11 + 28', 960, 930, 22, th.dim, { align: 'center', weight: 600 })
    } })
}
chorus(1, '3', lineT0('3.2'), B(36))

// VERSE 2 — newsroom style (rules, datelines, halftone)
add('beta2', B(36), lineT0('4.0'), { theme: 'dark', bg: 'news', sec: 'VERSE 2', draw(c, th, t) { dateline(c, th, '19beta2 · released 2026-07-16', t, B(36)); psqlBox(c, th, t, 2, B(36) + 0.2, B(36) + 1.5, { x: 560, y: 380 }) } })
add('aug28', lineT0('4.0'), lineT0('4.1'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    dateline(c, th, '2026-08-13 · 18.6 · 17.11 · 16.15 · 15.19 · 14.24', t, lineT0('4.0'))
    const t28 = fq(wordT('4.0', 2))
    if (t >= t28) { const fl = clamp(1 - (t - t28) / 0.25); CVE_AUG.forEach((id, i) => { const col = i % 7, row = Math.floor(i / 7)
      tag(c, th, 'CVE-2026-' + id, 150 + col * 236, 290 + row * 92, { size: 19, col: fl > 0 ? O : th.ink, fill: fl > 0.5 ? rgba(O, 0.25 * fl) : null }) }); mark('aug28') }
  } })
add('most', lineT0('4.1'), lineT0('4.2'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.1')), tm = fq(wordT('4.1', 1))
    ;[['FEB 12', 5], ['MAY 14', 11], ['AUG 13', 28]].forEach(([d, v], i) => { const u = easeOut((t - t0 - i * 0.15) / 0.5); if (u <= 0) return
      const y = 330 + i * 150; mono(c, d, 250, y + 40, 28, th.dim, { weight: 700 }); c.fillStyle = i === 2 ? th.acc : th.ink; c.fillRect(430, y, 1100 * v / 28 * u, 56)
      mono(c, String(v), 450 + 1100 * v / 28 * u, y + 42, 36, i === 2 ? th.acc : th.ink, { weight: 700 }) })
    if (t >= tm) mono(c, 'MOST EVER FIXED IN A SINGLE RELEASE', 430, 760, 30, th.acc, { weight: 800, alpha: clamp((t - tm) / 0.2) })
  } })
add('r185', lineT0('4.2'), lineT0('4.3'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.2')), tn = fq(wordT('4.2', 1)), tr = fq(wordT('4.2', 4))
    font(c, 'grotesk', 190); const vs = ['18.4', '18.5', '18.6'], xs = [200, 760, 1320]
    vs.forEach((v, i) => { c.fillStyle = i === 1 ? th.dim : th.ink; c.globalAlpha = i === 2 && t < tr ? 0.25 : 1; c.fillText(v, xs[i], 560); c.globalAlpha = 1 })
    mono(c, '→', 640, 520, 60, th.dim); mono(c, '→', 1200, 520, 60, th.dim)
    if (t >= tn) { font(c, 'grotesk', 190); strike(c, 740, 760 + mw(c, '18.5') + 20, 490, (t - tn) / 0.3, th.acc, 10); mono(c, 'never shipped', 770, 640, 30, th.acc, { weight: 700 }) }
    if (t >= tr) mono(c, 'regression', 770, 690, 30, th.dim, { alpha: clamp((t - tr) / 0.2) })
  } })
add('beta3', lineT0('4.3'), lineT0('4.4'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.3'))
    psqlBox(c, th, t, 3, t0, t0 + 1.1, { x: 560, y: 240 })
    const ts = fq(wordT('4.3', 7))
    if (t >= ts) { const k = easeOut((t - ts) / 0.25); tag(c, th, '18.6', 700, 620, { size: 34, alpha: k }); tag(c, th, '19beta3', 880, 620, { size: 34, alpha: k })
      mono(c, 'same day · 2026-08-13', 700, 710, 26, th.acc, { weight: 700, alpha: k }) }
  } })
add('curl', lineT0('4.4'), lineT0('4.5'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.4')), tsh = fq(wordT('4.4', 3)), td = fq(wordT('4.4', 6))
    mono(c, 'curl', 960, 300, 60, th.ink, { align: 'center', weight: 800 })
    c.strokeStyle = th.ink; c.lineWidth = 3; c.strokeRect(560, 360, 800, 300); font(c, 'grotesk', 120); c.fillStyle = th.ink; tracked(c, 'BOUNTY', 960, 560, 6, 'center')
    const u = clamp((t - tsh) / (td - tsh + 0.2)) // rolling shutter
    c.fillStyle = '#1c1916'; c.fillRect(560, 360, 800, 300 * easeOut(u)); c.fillStyle = th.faint; for (let y = 360; y < 360 + 300 * easeOut(u); y += 18) c.fillRect(560, y, 800, 2)
    if (t >= td) { const k = easeOutBack((t - td) / 0.3); c.save(); c.translate(960, 510); c.rotate(-0.08); c.scale(k, k); c.strokeStyle = th.acc; c.lineWidth = 6; c.strokeRect(-220, -70, 440, 120)
      font(c, 'grotesk', 80); c.fillStyle = th.acc; tracked(c, 'CLOSED', 0, 20, 6, 'center'); c.restore(); mono(c, 'HackerOne bug bounty · ended Jan 2026', 960, 740, 22, th.dim, { align: 'center' }) }
  } })
const WORM = (() => { const R = rng(21); const n = []; for (let i = 0; i < 34; i++) n.push([220 + R() * 1480, 250 + R() * 520]); return n })()
add('worm', lineT0('4.5'), lineT0('4.6'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.5')), tw = fq(wordT('4.5', 1))
    dateline(c, th, 'npm · 2026-08-04', t, t0)
    c.strokeStyle = th.faint; c.lineWidth = 1
    for (let i = 0; i < WORM.length; i++) for (let j = i + 1; j < WORM.length; j++) if (Math.hypot(WORM[i][0] - WORM[j][0], WORM[i][1] - WORM[j][1]) < 230) seg(c, ...WORM[i], ...WORM[j])
    const path = [...WORM].sort((a, b) => a[0] - b[0]).filter((_, i) => i % 2 === 0)
    const u = clamp((t - tw) / 2.4), hit = Math.floor(u * (path.length - 1))
    WORM.forEach(([x, y]) => { c.fillStyle = th.dim; c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill() })
    path.forEach(([x, y], i) => { if (i <= hit && t >= tw) { c.fillStyle = th.acc; c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill() } })
    if (t >= tw) { c.save(); c.strokeStyle = th.acc; c.lineWidth = 4; c.shadowColor = th.acc; c.shadowBlur = 18; poly(c, path, u); c.restore() }
    mono(c, 'keyv', path[1][0] + 16, path[1][1] - 16, 22, th.ink, { weight: 700 }); mono(c, 'cacheable', path[3][0] + 16, path[3][1] - 16, 22, th.ink, { weight: 700 })
  } })
add('fcst', lineT0('4.6'), lineT0('4.7'), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.6')), tk = fq(wordT('4.6', 1))
    const v = t < tk ? Math.round(66 * easeOut((t - t0) / Math.max(0.1, tk - t0))) : 66
    font(c, 'mono', 250, 700); c.fillStyle = t >= tk ? th.acc : th.ink; if (t >= tk) { c.shadowColor = th.acc; c.shadowBlur = 40 }
    tracked(c, '≈' + v + (t >= tk ? ',000' : ''), 960, 560, 0, 'center'); c.shadowBlur = 0
    mono(c, 'CVEs forecast for 2026, all software · FIRST (2026-06-15)', 960, 680, 24, th.dim, { align: 'center' })
  } })
add('maint', lineT0('4.7'), B(52), { theme: 'dark', bg: 'news', sec: 'VERSE 2',
  draw(c, th, t) {
    const t0 = fq(lineT0('4.7')), R = rng(3)
    for (let i = 0; i < 60; i++) { const x0 = 300 + (i % 12) * 100, y0 = 300 + Math.floor(i / 12) * 90, go = t0 + R() * 3.2, u = easeIn((t - go) / 0.9)
      c.fillStyle = th.ink; c.globalAlpha = 1 - u; c.fillRect(x0 + u * 1600, y0, 14, 26); c.globalAlpha = 1 }
    mono(c, '(a mood, not a statistic)', W - 150, 760, 16, th.dim, { align: 'right' })
  } })
add('pre2', B(52), lineT0('6.0'), { theme: 'dark', bg: 'rings', sec: 'PRE-CHORUS', counterBig: true, draw(c, th, t) { counterStage(c, th, t, B(52), 2, 0) } })
chorus(2, '6', wordT('6.2', 2), B(70))

// BRIDGE — black, one cursor; reverted features typed, then struck with their revert commits
const REV = COMMITS.reverts
const BR = [
  { id: '7.0', s: '-- PostgreSQL 19 Beta 4 · 2026-09-24', hdr: true },
  { id: '7.1', s: 'SQL/PGQ property graphs', h: REV['Property graphs'].h, gone: 2 },
  { id: '7.2', s: 'online data checksums', h: REV['Online checksums'].h, gone: 2 },
  { id: '7.3', s: 'UPDATE/DELETE FOR PORTION OF', h: REV['For portion of'].h, gone: 3 },
  { id: '7.4', s: 'ALTER TABLE … MERGE/SPLIT PARTITIONS', h: REV['Merge and split partitions'].h, gone: 4 },
]
const SRC = 'postgresql.org/about/news/postgresql-19-beta-4-released-3386/'
const TICKS = REMIX.ticks
function bridgeList(c, th, t, alpha = 1) {
  const x = 300, y0 = 330, lh = 92
  let cur = [x, y0]
  BR.forEach((b, i) => {
    const ts = fq(lineT0(b.id)); if (t < ts) return
    const tg = b.gone != null ? fq(wordT(b.id, b.gone)) : ts + 1.2
    const rate = b.s.length / Math.max(0.35, tg - ts - 0.08)
    const n = Math.min(b.s.length, (t - ts) * rate), y = y0 + i * lh
    c.save(); c.globalAlpha = alpha
    const ex = typed(c, b.s, x, y, b.hdr ? 26 : 40, b.hdr ? th.dim : th.ink, n, { weight: b.hdr ? 500 : 600 })
    cur = [ex, y]
    if (b.gone != null && t >= tg) {
      font(c, 'mono', 40, 600); strike(c, x - 8, x + mw(c, b.s) + 8, y - 13, (t - tg) / 0.18, th.acc, 5)
      mono(c, 'revert ' + b.h, 1640, y - 4, 24, th.acc, { align: 'right', weight: 700, alpha: clamp((t - tg) / 0.15) }); mark('gone_' + b.id)
    }
    c.restore()
  })
  return cur
}
// the cursor blinks on the clock ticks of the remixed bridge
const tickOn = t => TICKS.some(k => t >= k && t < k + 2 * BEAT * 0.5)
add('bridge', B(70), wordT('8.0', 0), { theme: 'dark', bg: 'void', sec: 'BRIDGE', hudDim: true, noLyric: true,
  draw(c, th, t) {
    const [cx, cy] = bridgeList(c, th, t)
    const blink = t < TICKS[0] ? Math.floor(t * 2) % 2 === 0 : tickOn(t)
    c.fillStyle = th.ink; if (blink) c.fillRect(cx + 6, cy - 34, 22, 42)
    const ts = fq(lineT0('7.5'))
    if (t >= ts) { const n = clamp((t - ts) / 1.6) * SRC.length; typed(c, SRC, 300, 880, 22, th.dim, n); mark('src_typed') }
  } })
add('quote', wordT('8.0', 0), B(82), { theme: 'dark', bg: 'void', sec: 'BRIDGE', hudDim: true,
  draw(c, th, t) {
    const tq = fq(wordT('8.0', 6)) + 0.35
    if (t < B(82) - 1.5) {
      mono(c, SRC, 960, 880, 18, th.dim, { align: 'center', alpha: 0.7 })
      if (t >= tq) { c.save(); c.globalAlpha = clamp((t - tq) / 0.6) * 0.8; font(c, 'roman', 28); c.fillStyle = th.dim
        tracked(c, '“The PostgreSQL community strongly believes that, first and foremost, PostgreSQL must be reliable.”', 960, 820, 0, 'center'); c.restore() }
    }
    const tp = B(82) - 1.5
    if (t >= tp) { psqlBox(c, th, t, 4, tp, 9e9, { x: 560, y: 380, alpha: 1 }) }
  } })

// BUILD — commit wall of REL_19_BETA1..BETA4, "fix" lit orange
const WALL = COMMITS.commits
add('build', B(82), lineT0('10.0'), { theme: 'dark', bg: 'wall', sec: 'BUILD', noLyricUntil: lineT0('9.0'),
  draw(c, th, t) {
    const t0 = B(82), tRes = B(82)
    // payoff first: (1 row)
    if (t < lineT0('9.0') + 0.4) psqlBox(c, th, t, 4, t0 - 1.5, tRes, { x: 560, y: 380, result: 'must be reliable', alpha: 1 - clamp((t - lineT0('9.0')) / 0.4) })
    if (t < lineT0('9.0') - 0.3) return
    const tf = fq(wordT('9.1', 6)), tc = fq(lineT0('9.2')), tn = fq(lineT0('9.3'))
    const vis = clamp((t - lineT0('9.0') + 0.3) / 1.2), sp = 30 + 70 * energy(t)
    font(c, 'mono', 15, 500)
    const cols = 5, cw = 360, lh = 22, off = ((t - t0) * sp)
    for (let col = 0; col < cols; col++) for (let r = -1; r < 50; r++) {
      const k = (col * 157 + r + Math.floor(off / lh)) % WALL.length, cm = WALL[k], y = 60 + r * lh - (off % lh)
      const s = (cm.h + ' ' + cm.s).slice(0, 44), fx = cm.fix_subj
      c.globalAlpha = vis * (t >= tf ? (fx ? 0.85 : 0.1) : 0.32)
      c.fillStyle = th.ink; const x = 40 + col * (cw + 20); c.fillText(s, x, y)
      if (fx && t >= tf) { const i = s.toLowerCase().indexOf('fix'); if (i >= 0) { const xi = x + mw(c, s.slice(0, i)); c.fillStyle = O; c.globalAlpha = vis; c.fillText(s.slice(i, i + 3), xi, y) } }
    }
    c.globalAlpha = 1
    // counters panel
    const panel = (big, lab, col, a) => { c.save(); c.globalAlpha = a; c.fillStyle = 'rgba(11,10,9,0.86)'; c.fillRect(120, 250, 760, 330)
      font(c, 'mono', 200, 700); c.fillStyle = col; if (col === O) { c.shadowColor = O; c.shadowBlur = 40 } c.fillText(big, 150, 460); c.shadowBlur = 0; mono(c, lab, 156, 540, 22, th.dim, { weight: 600 }); c.restore() }
    const t762 = fq(lineT0('9.0')), tEnd = fq(lineLast('9.0'))
    if (t < fq(lineT0('9.1'))) panel(String(Math.round(762 * ease((t - t762) / (tEnd - t762)))), 'commits · REL_19_BETA1..REL_19_BETA4', th.ink, clamp((t - t762) / 0.2))
    else if (t < tc) panel(t >= tf ? '439' : String(Math.round(439 * ease((t - fq(lineT0('9.1'))) / (tf - fq(lineT0('9.1')))))), 'of them mention "fix"', O, 1)
    else if (t < tn) { panel('30', 'committers', th.ink, 1)
      const names = [...new Set(WALL.map(x => x.c))]; const cnt = {}; WALL.forEach(x => cnt[x.c] = (cnt[x.c] || 0) + 1); names.sort((a, b) => cnt[b] - cnt[a])
      names.forEach((nm, i) => { const ts = tc + i * 0.045; if (t < ts) return; mono(c, nm, 980 + (i % 3) * 300, 280 + Math.floor(i / 3) * 34, 20, th.ink, { weight: 600, alpha: 0.9 }) }) }
    else { panel('9', 'open items left · PG19', O, 1)
      for (let i = 0; i < 9; i++) { const ts = tn + 0.3 + i * 0.08; if (t < ts) continue; c.strokeStyle = th.ink; c.lineWidth = 2.5; c.strokeRect(1000, 270 + i * 40, 26, 26); c.fillStyle = th.faint; c.fillRect(1050, 280 + i * 40, 300 + ((i * 97) % 280), 8) } }
  } })

// FINAL CHORUS — dawn: the palette flips to the light theme
add('reliable', lineT0('10.0'), lineT0('10.1'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS', flip: true,
  draw(c, th, t) { const t0 = fq(lineT0('10.0')); slonik(c, 1340, 450, 600, ease((t - t0) / 1.8), { color: th.ink, width: 4.5, eyeColor: th.acc }) } })
add('cut', lineT0('10.1'), lineT0('10.2'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.1')), tc = fq(wordT('10.1', 1)), tk = fq(wordT('10.1', 5))
    const kept = ['REPACK (CONCURRENTLY)', 'parallel autovacuum', 'WAIT FOR LSN', 'pg_plan_advice', 'sequence replication']
    const cut = ['SQL/PGQ', 'online checksums', 'FOR PORTION OF', 'MERGE/SPLIT PARTITIONS', 'GROUP BY ALL']
    mono(c, 'CUT', 1100, 250, 20, th.dim, { weight: 700 }); mono(c, 'KEPT', 250, 250, 20, th.dim, { weight: 700 })
    cut.forEach((s, i) => { const y = 320 + i * 70; mono(c, s, 1100, y, 32, th.dim, { alpha: 0.6 }); if (t >= tc) { font(c, 'mono', 32, 500); strike(c, 1095, 1105 + mw(c, s), y - 11, (t - tc - i * 0.05) / 0.2, th.dim, 3) } })
    kept.forEach((s, i) => { const y = 320 + i * 70; if (t >= tk + i * 0.06) mono(c, '✓ ' + s, 250, y, 32, th.ink, { weight: 700, alpha: clamp((t - tk - i * 0.06) / 0.1) }) })
    c.save(); c.strokeStyle = th.acc; c.lineWidth = 3; c.setLineDash([14, 10]); seg(c, 980, 220, 980, 220 + 520 * clamp((t - tc) / 0.6)); c.restore()
    if (t >= tc) mono(c, '✂', 980, 230 + 520 * clamp((t - tc) / 0.6), 40, th.acc, { align: 'center' })
  } })
add('repack', lineT0('10.2'), lineT0('10.3'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.2')), tv = fq(wordT('10.2', 2)), R = rng(9)
    mono(c, 'REPACK (CONCURRENTLY) orders;', 150, 230, 26, th.ink, { weight: 700 })
    const cols = 12, rows = 6, s = 26
    const live = []; for (let i = 0; i < cols * rows; i++) live.push(R() > 0.42)
    const u = clamp((t - t0) / 2.2), nl = live.filter(Boolean).length
    for (let i = 0; i < cols * rows; i++) { const x = 150 + (i % cols) * (s + 4), y = 270 + Math.floor(i / cols) * (s + 4)
      c.fillStyle = live[i] ? th.ink : th.faint; c.globalAlpha = live[i] ? 1 - 0.6 * u : 1; c.fillRect(x, y, s, s); c.globalAlpha = 1 }
    // compacted copy grows while new rows keep arriving (orange = concurrent writes)
    let k = 0; for (let i = 0; i < Math.floor(u * nl) + Math.floor(u * 6); i++) { const x = 150 + (k % cols) * (s + 4), y = 530 + Math.floor(k / cols) * (s + 4); c.fillStyle = i >= nl ? th.acc : th.ink; c.fillRect(x, y, s, s); k++ }
    mono(c, 'old heap', 150, 490, 18, th.dim); mono(c, 'new heap (compact) · writes keep flowing', 150, 760, 18, th.dim)
    if (t >= tv) { mono(c, 'autovacuum_max_parallel_workers = 4', 1000, 230, 24, th.ink, { weight: 700, alpha: clamp((t - tv) / 0.2) })
      for (let w = 0; w < 4; w++) { const y = 300 + w * 110; mono(c, `worker ${w + 1}`, 1000, y + 24, 18, th.dim); c.fillStyle = th.faint; c.fillRect(1140, y, 600, 36)
        const p = clamp((t - tv - w * 0.07) / 1.6); c.fillStyle = th.acc; c.fillRect(1140, y, 600 * p, 36) } }
  } })
add('thirty', lineT0('10.3'), lineT0('10.4'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.3')), x0 = 200, x1 = 1720, y = 640
    c.strokeStyle = th.ink; c.lineWidth = 3; seg(c, x0, y, x1, y, ease((t - t0) / 1.2))
    for (let i = 0; i <= 30; i++) { const ts = t0 + i * 0.05; if (t < ts) break; const x = x0 + (x1 - x0) * i / 30
      c.fillStyle = i === 30 ? th.acc : th.ink; c.fillRect(x - 2, y - 30, 4, 30); if (i % 5 === 0) mono(c, String(1996 + i), x, y + 40, 18, th.dim, { align: 'center' }) }
    font(c, 'grotesk', 360); c.fillStyle = th.acc; c.globalAlpha = clamp((t - t0) / (3 / FPS)); tracked(c, '30', 960, 520, 0, 'center'); c.globalAlpha = 1
    mono(c, 'd31084e9d1 · 1996-07-09', x0, y + 90, 20, th.dim); mono(c, 'REL_19_BETA4 · 2026', x1, y + 90, 20, th.dim, { align: 'right' })
  } })
add('hands', lineT0('10.4'), lineT0('10.5'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.4')), N = 302, cols = 34
    for (let i = 0; i < N; i++) { const ts = t0 + (i / N) * 2.6; if (t < ts) break; const x = 330 + (i % cols) * 38, y = 250 + Math.floor(i / cols) * 44
      c.fillStyle = i === N - 1 ? th.acc : th.ink; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill() }
    mono(c, `${Math.min(N, Math.floor(clamp((t - t0) / 2.6) * N))} people · Author: / Co-authored-by: · master · 2026`, 330, 720, 22, th.dim, { weight: 600 })
  } })
add('still', lineT0('10.5'), lineT0('10.6'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.5')), q = "SELECT current_date - date '1996-07-09';"
    c.fillStyle = 'rgba(21,18,15,0.04)'; c.fillRect(460, 300, 1000, 330); c.fillStyle = th.acc; c.fillRect(460, 300, 6, 330)
    font(c, 'mono', 28, 500); c.fillStyle = th.dim; c.fillText('psql=#', 490, 370)
    typed(c, q, 490 + mw(c, 'psql=# '), 370, 28, th.ink, clamp((t - t0) / 1.1) * q.length)
    if (t >= t0 + 1.3) { mono(c, ' ?column?', 490, 430, 28, th.ink); mono(c, '──────────', 490, 466, 28, th.dim); mono(c, '    11036', 490, 510, 28, th.acc, { weight: 800 }); mono(c, '(1 row)', 490, 560, 28, th.dim) }
    mono(c, 'days since the first commit · as of 2026-09-26', 490, 700, 18, th.dim)
  } })
add('neverdown', lineT0('10.6'), lineT0('10.7'), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) { const t0 = fq(lineT0('10.6')); slonik(c, 960, 430, 600, ease((t - t0) / 0.9), { color: th.ink, width: 5, fill: th.ink, eyeColor: '#f1e8d5' }) } })
add('ourtown', lineT0('10.7'), B(106), { theme: 'light', bg: 'dawn', sec: 'FINAL CHORUS',
  draw(c, th, t) {
    const t0 = fq(lineT0('10.7')), u = ease((t - t0) / 4)
    const g = c.createRadialGradient(960, 900 - 260 * u, 20, 960, 900 - 260 * u, 520); g.addColorStop(0, rgba(O, 0.95)); g.addColorStop(0.18, rgba(O, 0.6)); g.addColorStop(1, rgba(O, 0))
    c.fillStyle = g; c.fillRect(0, 0, W, H)
    skyline(c, th, t, { y: 930, col: th.ink, win: rgba('#f1e8d5', 0.6), seed: 5 })
    c.save(); c.strokeStyle = th.ink; c.lineWidth = 4; seg(c, 0, 480, W, 480, ease((t - t0) / 0.45)); c.restore()
    mono(c, 'HOLD', 150, 460, 16, th.dim, { weight: 700 })
  } })

// OUTRO — calendar, a prompt, then a tiny COMMIT
add('outro', B(106), TOTAL, { theme: 'light', bg: 'dawn', sec: 'OUTRO',
  draw(c, th, t) {
    const t0 = fq(lineT0('11.0')), tt = fq(lineT0('11.1')), tcm = fq(lineT0('11.2')), fade = clamp((t - (tt + 2.6)) / 1.2)
    if (t >= t0 && fade < 1) { c.save(); c.globalAlpha = 1 - fade
      mono(c, 'OCTOBER 2026', 560, 260, 22, th.ink, { weight: 700 }); 'MTWTFSS'.split('').forEach((d, i) => mono(c, d, 580 + i * 120, 310, 18, th.dim, { align: 'center' }))
      for (let d = 1; d <= 31; d++) { const idx = d + 2, x = 580 + (idx % 7) * 120, y = 370 + Math.floor(idx / 7) * 70
        const early = d <= 10 && t >= fq(wordT('11.0', 2)); if (early) { c.fillStyle = rgba(th.acc, 0.16); c.fillRect(x - 50, y - 38, 100, 56) }
        mono(c, String(d), x, y, 26, early ? th.acc : th.ink, { align: 'center', weight: early ? 800 : 500 }) }
      mono(c, 'release candidate: "early October"', 560, 790, 22, th.dim)
      if (t >= tt) mono(c, 'test it → postgresql.org/developer/beta', 560, 835, 22, th.ink, { weight: 700, alpha: clamp((t - tt) / 0.2) })
      c.restore() }
    // fade to black, then the tiny COMMIT
    if (fade > 0) { c.fillStyle = `rgba(11,10,9,${fade})`; c.fillRect(0, 0, W, H) }
    if (t >= tcm - 0.9) {
      const s = 'COMMIT;', n = clamp((t - (tcm - 0.9)) / 0.7) * s.length
      font(c, 'mono', 20, 500); c.fillStyle = 'rgba(239,230,211,0.45)'; const px = 960 - mw(c, 'psql=# COMMIT;') / 2
      c.fillText('psql=# ', px, 900); typed(c, s, px + mw(c, 'psql=# '), 900, 20, 'rgba(239,230,211,0.7)', n)
      if (t >= tcm) { mono(c, 'COMMIT', 960, 940, 20, PAL.cream, { align: 'center', weight: 700 }); seen(widx.get(LINES['11.2'][0])); mark('commit') }
    }
  } })

export const SCENES = S

// ───────────── lyric groups ─────────────
G(['0.0', '0.1', '0.2', '0.3'], B(6), { style: 'serif', size: 60, stack: 1, x: 960, y: 900, align: 'center', dimPrev: 0 })
G(['1.0', '1.1', '1.2', '1.3', '1.4', '1.5'], B(18), { size: 60 })
G(['2.0', '2.1'], lineT0('3.0'), { style: 'mono', size: 34, x: 560, y: 960, stack: 2, maxW: 1100 })
G(['3.2', '3.3', '3.4', '3.5'], lineT0('3.6'), { size: 66, x: 960, align: 'center', y: 960 })
G(['4.0', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'], B(52), { size: 58 })
G(['5.0', '5.1'], lineT0('6.0'), { style: 'mono', size: 34, x: 560, y: 960, stack: 2, maxW: 1100 })
G(['6.2', '6.3', '6.4', '6.5'], lineT0('6.6'), { size: 66, x: 960, align: 'center', y: 960 })
G(['8.0'], B(82) - 1.5, { style: 'serif', size: 84, x: 960, y: 560, align: 'center', stack: 1, maxW: 1600 })
G(['9.0', '9.1', '9.2', '9.3'], lineT0('10.0'), { size: 56, y: 960, box: true, maxW: 1560 })
G(['10.0', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7'], B(106), { size: 64, y: 960 })
G(['11.0', '11.1'], lineLast('11.1') + 2.8, { style: 'serif', size: 56, x: 960, y: 1000, align: 'center', stack: 1 })
