// Scene table. Each scene is a whole number of bars at its tempo; music.py reads the same timeline.
import fs from 'fs'
import { W, H, clamp, lerp, ease, easeOut, easeOutBack, rng, mono, title, headline, caption, poly, line, rectP, circP,
  slonik, globe, flatMap, mapXY, CITIES, ortho, spaced } from './lib.mjs'

const RX = 1350, RY = 500 // centre of right-hand illustration

// typed text block, n chars revealed
export const REC = { on: false, t: 0, prev: {}, ev: [] }
function typed(c, lines, x, y, size, color, n, { font = 'Mono', lh = 1.5, weight = 400, cursor = true, t = 0 } = {}) {
  if (REC.on) { const txt = lines.join('\n'), vis = Math.max(0, Math.min(n, txt.length)), key = x + ',' + y, pv = REC.prev[key] || 0
    if (vis > pv) { const k = txt.slice(pv, vis).replace(/\s/g, '').length; if (k) REC.ev.push({ t: REC.t, n: k }) } REC.prev[key] = Math.max(pv, vis) }
  c.font = `${weight} ${size}px ${font}`; c.fillStyle = color; let left = n, cy = y, last = [x, y]
  for (const L of lines) { if (left <= 0) break; const s = L.slice(0, left); c.fillText(s, x, cy); last = [x + c.measureText(s).width, cy]; left -= L.length + 1; cy += size * lh }
  if (cursor && Math.floor(t * 2.5) % 2 === 0) c.fillRect(last[0] + 3, last[1] - size * 0.8, size * 0.55, size * 0.95)
}
function paperSheet(c, th, x, y, w, h, rot = 0) {
  c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(rot)
  c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = 30; c.shadowOffsetY = 12
  c.fillStyle = '#f6efdd'; c.fillRect(-w / 2, -h / 2, w, h); c.shadowColor = 'transparent'
  c.strokeStyle = 'rgba(80,60,30,0.25)'; c.lineWidth = 1; c.strokeRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1)
  c.restore()
}
function box(c, x, y, w, h, stroke, fill, lw = 2) { c.lineWidth = lw; if (fill) { c.fillStyle = fill; c.fillRect(x, y, w, h) } c.strokeStyle = stroke; c.strokeRect(x, y, w, h) }
function glowDot(c, x, y, r, col, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, col); g.addColorStop(0.25, col.replace(/[\d.]+\)$/, `${0.35 * a})`)); g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 4, 0, 7); c.fill(); c.globalAlpha = a; c.fillStyle = '#fff8e8'; c.beginPath(); c.arc(x, y, r * 0.6, 0, 7); c.fill(); c.globalAlpha = 1
}
const PG19_FEATS = ['REPACK CONCURRENTLY', 'SEQUENCE REPLICATION', 'WAIT FOR LSN', 'PARALLEL AUTOVACUUM', 'PG_PLAN_ADVICE'], PG19_CAPTION = '19 · IN BETA · SEPTEMBER 2026'
const FUTURE_QS = ['THREADS?', '64-BIT XIDS?', 'DIRECT I/O?', 'AGENTS AS DBAS?']
const FUTURE_THREADS = [["Let's make PostgreSQL multi-threaded", '2023', 0], ["Re: Let's make PostgreSQL multi-threaded", '', 1], ["Re: Let's make PostgreSQL multi-threaded", '', 2],
  ['Add 64-bit XIDs into PostgreSQL 15', '2022', 0], ['Re: Add 64-bit XIDs into PostgreSQL 15', '', 1],
  ['Asynchronous and "direct" IO support for PostgreSQL', '2021', 0], ['Re: Asynchronous and "direct" IO support', '', 1],
  ['[Proposal] Table-level Transparent Data Encryption', '2018', 0], ['Re: [Proposal] Table-level TDE and KMS', '', 1],
  ['Built-in connection pooler', '2019', 0], ['Re: Built-in connection pooler', '', 1], ["Re: Let's make PostgreSQL multi-threaded", '', 1]]
const COMMITTERS = [['Tom Lane', 16885], ['Bruce Momjian', 14113], ['Peter Eisentraut', 6596], ['Robert Haas', 2628], ['Michael Paquier', 2624], ['Alvaro Herrera', 1950], ['Heikki Linnakangas', 1932], ['Andres Freund', 1552], ['Marc G. Fournier', 1491], ['Thomas G. Lockhart', 1078], ['Andrew Dunstan', 1009], ['Magnus Hagander', 928], ['Fujii Masao', 833], ['Michael Meskes', 766], ['Amit Kapila', 724], ['Thomas Munro', 642], ['Neil Conway', 616], ['David Rowley', 602], ['Noah Misch', 557], ['Alexander Korotkov', 536], ['Peter Geoghegan', 531], ['Daniel Gustafsson', 526], ['Vadim B. Mikheev', 519], ['Nathan Bossart', 499], ['Tatsuo Ishii', 453], ['Simon Riggs', 453], ['Jeff Davis', 439], ['Teodor Sigaev', 399], ['Tomas Vondra', 367], ['Stephen Frost', 279]]
const ALLPEOPLE = JSON.parse(fs.readFileSync(new URL('../assets/people.json', import.meta.url), 'utf8'))
const GOLD = a => `rgba(242,196,107,${a})`, BLUE = a => `rgba(111,178,240,${a})`

function montageDraw(c, th, S) {
      const N = this.cards.length, i = Math.min(N - 1, Math.floor(S.b / 2)), lb = S.b - i * 2, [v, f] = this.cards[i]
      const alt = i % 2 === 1
      if (alt) { c.globalAlpha = clamp(lb / 0.15); c.fillStyle = this.altBg || '#16130f'; c.fillRect(0, 0, W, H); c.globalAlpha = 1 }
      const dk = th.aberr === 'screen', ink = alt ? '#f2e8d3' : th.ink, acc = alt ? '#f2c46b' : th.accent
      const s = 1 + (1 - easeOut(lb / 0.5)) * 0.12
      c.save(); c.translate(W / 2, 520); c.scale(s, s)
      const tt = { ...th, aberr: alt || dk ? 'screen' : 'multiply', glow: alt || dk ? 'x' : null }
      title(c, tt, v, 0, -40, 300, acc, { align: 'center', weight: 900, sp: 10, ab: 3 + 14 * (1 - clamp(lb / 0.4)), glow: alt || dk ? 30 : 0 })
      c.font = '700 70px Cinzel'; const fw = [...f].reduce((a, ch) => a + c.measureText(ch).width + 8, 0), fs = Math.min(70, 70 * 1500 / fw)
      title(c, tt, f, 0, 110, fs, ink, { align: 'center', weight: 700, sp: 8, glow: alt || dk ? 12 : 0 })
      if (this.cards[i][3] && lb > 0.25) { c.globalAlpha = clamp((lb - 0.25) / 0.25); mono(c, this.cards[i][3], 0, 205, 24, acc, 4, 'center', 700); c.globalAlpha = 1 }
      c.restore()
      c.strokeStyle = alt ? 'rgba(242,232,211,0.25)' : th.faint; c.lineWidth = 1; for (let k = 0; k < N; k++) { c.fillStyle = k <= i ? acc : (alt ? 'rgba(242,232,211,0.2)' : th.faint); c.fillRect(W / 2 - N * 26 + k * 52, 790, 40, 5) }
      mono(c, this.foot ? this.foot(i) : `RELEASE ${v}  ·  ${this.cards[i][2]}`, W / 2, 850, 22, alt || dk ? 'rgba(242,232,211,0.7)' : th.dim, 6, 'center')
}

export const SCENES = [
  // ───────────── ACT I · RELATIO ─────────────
  { id: 'open1', bars: 2, bpm: 120, act: 1, chap: 'PROLOGVS', theme: 'dark', year: null,
    draw(c, th, S) {
      const u = ease(S.b / 6)
      slonik(c, th, W / 2, 470, 520, u, { color: GOLD(0.95), width: 2.5, glow: 18 })
      if (S.b > 2) { const a = clamp((S.b - 2) / 1.5)
        title(c, th, 'ELEPHANTS', W / 2, 850, 64, th.ink, { align: 'center', alpha: a, glow: 12, sp: 10 })
        title(c, th, 'REMEMBER.', W / 2, 950, 96, th.accent, { align: 'center', alpha: clamp((S.b - 4) / 1.2), glow: 30, sp: 8, weight: 900 }) }
    } },
  { id: 'open2', bars: 2, bpm: 120, act: 1, chap: 'PROLOGVS', theme: 'dark', year: null, hit: true,
    draw(c, th, S) {
      const z = 1 + S.u * 0.25
      c.save(); c.translate(1340, 520); c.scale(z, z); slonik(c, th, 0, 0, 640, 1, { color: GOLD(0.9), width: 2.2, glow: 22 }); c.restore()
      headline(c, th, S, ['THIS ONE', '!*REMEMBERS*', '!*EVERYTHING.*'], { y: 300, big: 104 })
    } },
  { id: 'codd', bars: 2, bpm: 120, act: 1, chap: 'I · RELATIO', theme: 'paper', year: [1970, 1970], hit: true, type: [0.5, 7],
    draw(c, th, S) {
      headline(c, th, S, ['FIRST,', '!*A PAPER.*'], { y: 360 })
      caption(c, th, S, 'E. F. CODD · IBM SAN JOSE · CACM · JUNE 1970', 112, 640)
      const x = 1000, y = 150, w = 720, h = 800; paperSheet(c, th, x, y, w, h, -0.02)
      c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(-0.02); c.translate(-w / 2, -h / 2)
      const n = Math.floor(clamp((S.b - 0.5) / 6.5) * 420)
      c.fillStyle = th.ink; c.textAlign = 'center'
      c.textAlign = 'left'
      typed(c, ['A Relational Model of Data for', 'Large Shared Data Banks'], 70, 150, 38, th.ink, n, { font: 'Garamond', weight: 600, lh: 1.3, cursor: false })
      typed(c, ['E. F. CODD', 'IBM Research Laboratory, San Jose, California'], 70, 280, 23, th.ink, n - 60, { font: 'Garamond', cursor: false })
      const body = ['Future users of large data banks must be protected', 'from having to know how the data is organized in', 'the machine (the internal representation). A prompt-', 'ing service which supplies such information is not a', 'satisfactory solution. Activities of users at termi-', 'nals and most application programs should remain', 'unaffected when the internal representation of data', 'is changed and even when some aspects of the exter-', 'nal representation are changed.']
      typed(c, body, 70, 370, 25, th.ink, n - 110, { font: 'Garamond', cursor: true, t: S.t, lh: 1.45 })
      c.restore()
      if (S.b > 5.5) { c.strokeStyle = th.hot; c.lineWidth = 3; const a = ease((S.b - 5.5) / 1.2)
        c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(-0.02); c.translate(-w / 2, -h / 2); c.font = '600 38px Garamond'
        const t1 = c.measureText('A Relational Model of Data for').width, t2 = c.measureText('Large Shared Data Banks').width
        poly(c, [[70, 162], [70 + t1, 162]], a); poly(c, [[70, 211], [70 + t2, 211]], clamp(a * 1.5 - 0.5)); c.restore() }
    } },
  { id: 'relation', bars: 2, bpm: 120, act: 1, chap: 'I · RELATIO', theme: 'paper', year: [1970, 1972],
    draw(c, th, S) {
      headline(c, th, S, ['DATA IS', '!*RELATIONS.*'], { y: 360 })
      caption(c, th, S, 'TUPLES · ATTRIBUTES · DOMAINS · KEYS', 112, 640)
      const cols = ['supplier', 'part', 'project', 'qty'], rows = [['S1', 'P1', 'J1', '200'], ['S1', 'P1', 'J4', '700'], ['S2', 'P3', 'J1', '400'], ['S2', 'P3', 'J2', '200'], ['S3', 'P4', 'J3', '500'], ['S4', 'P6', 'J7', '300']]
      const x0 = 960, y0 = 250, cw = 190, rh = 78
      c.strokeStyle = th.ink; c.lineWidth = 2.5
      poly(c, rectP(x0, y0, cw * 4, rh * 7), ease(S.b / 2.5))
      c.lineWidth = 1.2; for (let i = 1; i < 4; i++) line(c, x0 + cw * i, y0, x0 + cw * i, y0 + rh * 7, ease((S.b - 0.5 - i * 0.2) / 2))
      c.lineWidth = 2.5; line(c, x0, y0 + rh, x0 + cw * 4, y0 + rh, ease((S.b - 1) / 1))
      c.font = '700 26px Garamond'; c.fillStyle = th.accent
      cols.forEach((s, i) => { if (S.b > 1.2 + i * 0.2) c.fillText(s, x0 + 24 + i * cw, y0 + 50) })
      c.font = '400 28px Mono'
      rows.forEach((r, j) => { const bt = 2 + j * 0.55; if (S.b < bt) return; const a = clamp((S.b - bt) / 0.3)
        c.globalAlpha = a; c.fillStyle = th.ink; r.forEach((v, i) => c.fillText(v, x0 + 24 + i * cw, y0 + rh * (j + 1) + 50)); c.globalAlpha = 1
        c.strokeStyle = th.faint; c.lineWidth = 1; line(c, x0, y0 + rh * (j + 2), x0 + cw * 4, y0 + rh * (j + 2)) })
      if (S.b > 5.5) { const a = ease((S.b - 5.5) / 1); c.strokeStyle = th.hot; c.lineWidth = 3; poly(c, rectP(x0 - 8, y0 + rh * 3 - 6, cw * 4 + 16, rh + 12), a) }
      mono(c, 'R( supplier, part, project, qty )', x0, y0 + rh * 7 + 60, 22, th.dim, 3)
    } },
  { id: 'ingres', bars: 2, bpm: 120, act: 1, chap: 'I · RELATIO', theme: 'paper', year: [1973, 1974], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['THEN,', '!*BERKELEY.*'], { y: 360 })
      caption(c, th, S, 'INGRES · MICHAEL STONEBRAKER · EUGENE WONG · 1973', 112, 640)
      const u = S.b / 6, cx = RX + 60, base = 900, tw = 110, top = 330
      c.strokeStyle = th.ink; c.lineWidth = 2.2
      // Sather Tower
      poly(c, [[cx - tw / 2, base], [cx - tw / 2, top], [cx + tw / 2, top], [cx + tw / 2, base]], ease(u * 1.3))
      poly(c, [[cx - tw / 2 - 12, top], [cx + tw / 2 + 12, top], [cx + tw / 2 + 12, top - 110], [cx - tw / 2 - 12, top - 110], [cx - tw / 2 - 12, top]], ease(u * 1.3 - 0.2))
      poly(c, [[cx - tw / 2 - 18, top - 110], [cx, top - 250], [cx + tw / 2 + 18, top - 110]], ease(u * 1.3 - 0.35))
      line(c, cx, top - 250, cx, top - 285, ease(u * 1.3 - 0.5))
      c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { poly(c, [[cx - 40 + i * 30, top - 20], [cx - 40 + i * 30, top - 85], [cx - 28 + i * 30, top - 95], [cx - 16 + i * 30, top - 85], [cx - 16 + i * 30, top - 20]], ease(u * 1.5 - 0.4)) }
      c.strokeStyle = th.faint; for (let y = top + 40; y < base; y += 36) line(c, cx - tw / 2, y, cx + tw / 2, y, ease(u * 2 - 0.6))
      c.strokeStyle = th.accent; c.lineWidth = 3; poly(c, circP(cx, top - 55, 22, 40), ease(u * 2 - 0.9))
      // hills + trees
      c.strokeStyle = th.dim; c.lineWidth = 1.5
      poly(c, Array.from({ length: 60 }, (_, i) => [900 + i * 16, 700 - Math.sin(i / 7) * 60 - Math.sin(i / 3.1) * 14 - i * 1.2]), ease(u * 1.2))
      c.strokeStyle = th.ink; c.lineWidth = 2; line(c, 880, base, 1850, base, ease(u * 2))
      const R = rng(4); for (let i = 0; i < 9; i++) { const x = 940 + i * 100 + R() * 40; if (Math.abs(x - cx) < 110) continue; const h = 70 + R() * 70
        poly(c, [[x, base], [x, base - h * 0.4]], ease(u * 1.5 - 0.3)); poly(c, circP(x, base - h * 0.4 - 32, 30 + R() * 14, 30), ease(u * 1.6 - 0.5)) }
      mono(c, 'BERKELEY, CALIFORNIA', cx, base + 50, 20, th.dim, 5, 'center')
    } },
  { id: 'quel', bars: 2, bpm: 120, act: 1, chap: 'I · RELATIO', theme: 'paper', year: [1975, 1979], type: [0.3, 6.5],
    draw(c, th, S) {
      headline(c, th, S, ['WE LEARNED', 'TO *ASK.*'], { y: 360 })
      caption(c, th, S, 'QUEL · THE INGRES QUERY LANGUAGE', 112, 640)
      const x = 960, y = 250, w = 800, h = 500
      c.fillStyle = 'rgba(43,36,29,0.06)'; c.fillRect(x, y, w, h); c.strokeStyle = th.ink; c.lineWidth = 2; poly(c, rectP(x, y, w, h), ease(S.b / 1.5))
      for (let i = 0; i < 12; i++) { c.fillStyle = th.faint; c.beginPath(); c.arc(x + 22, y + 30 + i * 38, 7, 0, 7); c.fill(); c.beginPath(); c.arc(x + w - 22, y + 30 + i * 38, 7, 0, 7); c.fill() }
      const n = Math.floor(clamp((S.b - 0.3) / 6.2) * 140)
      typed(c, ['* range of e is employee', '* retrieve (e.name, e.dept)', '    where e.salary > 10000', '* \\g', '', 'Executing . . .'], x + 70, y + 90, 34, th.ink, n, { t: S.t })
    } },
  { id: 'post', bars: 3, bpm: 120, act: 1, chap: 'II · POSTGRES', theme: 'paper', year: [1986, 1986], hit: true, big: true,
    draw(c, th, S) {
      const b = S.b
      if (b < 4) { title(c, th, 'THEN, WHAT COMES', W / 2, 420, 64, th.ink, { align: 'center', alpha: clamp(b / 0.5), sp: 6 })
        title(c, th, 'AFTER INGRES?', W / 2, 600, 120, th.accent, { align: 'center', alpha: clamp((b - 1) / 0.5), weight: 900, sp: 6, ab: 3 + 8 * clamp(1 - (b - 1)) }) }
      else { const p = easeOutBack((b - 4) / 0.8), w = lerp(1.25, 1, clamp((b - 4) / 0.5))
        c.save(); c.translate(W / 2, 560); c.scale(w, w)
        title(c, th, 'POSTGRES', 0, 0, 230, th.ink, { align: 'center', weight: 900, sp: 14, ab: 4 + 16 * clamp(1 - (b - 4) * 2) })
        c.restore()
        if (b > 4.6) { const a = clamp((b - 4.6) / 0.6); c.globalAlpha = a
          mono(c, 'POST  ·  INGRES', W / 2, 680, 26, th.accent, 20, 'center', 700); c.globalAlpha = 1 }
        caption(c, th, S, '"THE DESIGN OF POSTGRES" · STONEBRAKER & ROWE · SIGMOD 1986', W / 2 - 440, 780, 4.8) }
    } },
  { id: 'types', bars: 2, bpm: 120, act: 1, chap: 'II · POSTGRES', theme: 'paper', year: [1987, 1989],
    draw(c, th, S) {
      headline(c, th, S, ['TYPES. RULES.', '!*TIME TRAVEL.*'], { y: 340, big: 100 })
      caption(c, th, S, 'POSTGRES v1 · 1989 · EXTENSIBLE TYPES · NO-OVERWRITE STORAGE', 112, 640)
      // stacked row versions receding in time
      const n = 6
      for (let i = n - 1; i >= 0; i--) { const bt = 0.5 + (n - 1 - i) * 0.6; if (S.b < bt) continue; const a = easeOut((S.b - bt) / 0.6)
        const x = 960 + i * 50, y = 400 - i * 40, w = 560, h = 64
        c.globalAlpha = a; c.fillStyle = '#f5eddb'; c.fillRect(x, y, w, h); c.globalAlpha = a * (i === 0 ? 1 : 0.35 + 0.1 * (n - i)); c.strokeStyle = i === 0 ? th.accent : th.ink; c.lineWidth = i === 0 ? 3 : 1.5; c.strokeRect(x, y, w, h)
        c.fillStyle = th.ink; c.font = '400 20px Mono'; c.fillText(`EMP "Sam" salary = ${10000 + (n - i) * 2500}`, x + 20, y + 29)
        c.fillStyle = th.dim; c.font = '400 18px Mono'; c.textAlign = 'right'; c.fillText(`valid ${1988 - i} → ${i === 0 ? 'now' : 1989 - i}`, x + w - 20, y + 29); c.textAlign = 'left'
        c.globalAlpha = 1 }
      if (S.b > 4.6) { const a = clamp((S.b - 4.6) / 0.8); c.globalAlpha = a; mono(c, 'retrieve (EMP.salary) from EMP [T] where EMP.name = "Sam"', 960, 860, 22, th.hot, 1); c.globalAlpha = 1 }
    } },
  { id: 'pg95', bars: 2, bpm: 120, act: 1, chap: 'II · POSTGRES', theme: 'paper', year: [1994, 1995], type: [0.8, 6],
    draw(c, th, S) {
      headline(c, th, S, ['TWO STUDENTS', 'ADDED *SQL.*'], { y: 360 })
      caption(c, th, S, 'ANDREW YU · JOLLY CHEN · POSTGRES95', 112, 640)
      const x = 960, y = 260, w = 820, h = 500
      c.fillStyle = '#1a1712'; c.fillRect(x, y, w, h); c.strokeStyle = th.ink; c.lineWidth = 3; c.strokeRect(x - 14, y - 14, w + 28, h + 28)
      const n = Math.floor(clamp((S.b - 0.8) / 5.2) * 150)
      c.shadowColor = 'rgba(255,190,90,0.7)'; c.shadowBlur = 8
      typed(c, ['$ monitor demo', 'Welcome to the POSTGRES95 terminal monitor', '', '* SELECT name, dept', '* FROM employee', '* WHERE salary > 10000;', '', 'Go ', '* '], x + 34, y + 58, 25, '#ffc978', n, { t: S.t, lh: 1.42 })
      c.shadowBlur = 0
    } },
  { id: 'release', bars: 2, bpm: 120, act: 1, chap: 'III · COMMVNITAS', theme: 'paper', year: [1996, 1996], hit: true, type: [3.4, 7.5],
    draw(c, th, S) {
      headline(c, th, S, ['THEN WE', '!*SET IT FREE.*'], { y: 360, big: 104 })
      caption(c, th, S, 'FIRST COMMIT · MARC G. FOURNIER · 1996-07-09', 112, 640)
      globe(c, th, RX + 60, 470, 300, -60 + S.t * 8, 20, { u: ease(S.b / 3) })
      const R = rng(9); c.strokeStyle = th.accent; c.lineWidth = 1.6
      for (let i = 0; i < 26; i++) { const a0 = R() * 6.28, d = 0.5 + R() * 1.8, bt = 1 + R() * 3; const p = clamp((S.b - bt) / d); if (p <= 0) continue
        const x1 = RX + 60, y1 = 470, x2 = x1 + Math.cos(a0) * 420, y2 = y1 + Math.sin(a0) * 360
        poly(c, [[x1, y1], [lerp(x1, x2, 0.5) + 60, lerp(y1, y2, 0.5) - 80], [x2, y2]], p)
        if (p > 0.95) { c.fillStyle = th.accent; c.fillRect(x2 - 10, y2 - 7, 20, 14) } }
      const n = Math.floor(clamp((S.b - 3.4) / 3) * 70)
      c.fillStyle = 'rgba(239,229,207,0.85)'; if (n > 0) c.fillRect(960, 860, 880, 50)
      typed(c, ['d31084e9  Postgres95 1.01 Distribution - Virgin Sources'], 975, 895, 23, th.ink, n, { t: S.t })
    } },

  // ───────────── ACT II · COMMUNITAS ─────────────
  { id: 'license', bars: 2, bpm: 132, act: 2, chap: 'III · COMMVNITAS', theme: 'paper', year: [1996, 1997], hit: true, impact: true,
    draw(c, th, S) {
      headline(c, th, S, ['NO COMPANY.', '!*NO OWNER.*'], { y: 360 })
      caption(c, th, S, 'THE POSTGRESQL LICENSE', 112, 640)
      paperSheet(c, th, 980, 200, 760, 640, 0.015)
      const txt = ['PostgreSQL Database Management System', '', 'Permission to use, copy, modify, and', 'distribute this software and its docu-', 'mentation for any purpose, without fee,', 'and without a written agreement is', 'hereby granted, provided that the above', 'copyright notice and this paragraph', 'and the following two paragraphs appear', 'in all copies.']
      c.save(); c.translate(1040, 290); c.rotate(0.015)
      txt.forEach((s, i) => { c.font = i === 0 ? '700 28px Garamond' : 'italic 400 29px Garamond'; c.fillStyle = th.ink; c.globalAlpha = clamp((S.b - 0.3 - i * 0.25) / 0.4); c.fillText(s, 0, i * 48) })
      c.globalAlpha = 1
      if (S.b > 4) { const a = ease((S.b - 4) / 1.2); c.strokeStyle = th.hot; c.lineWidth = 4; c.globalAlpha = 0.8; c.font = 'italic 400 29px Garamond'
        const w1 = c.measureText(txt[2]).width, x2 = c.measureText('mentation for any purpose, ').width, w2 = c.measureText('without fee,').width
        poly(c, [[0, 2 * 48 + 10], [w1, 2 * 48 + 10]], a); poly(c, [[x2, 4 * 48 + 10], [x2 + w2, 4 * 48 + 10]], clamp(a * 1.4 - 0.4)) }
      c.restore()
    } },
  { id: 'slonik', bars: 2, bpm: 132, act: 2, chap: 'III · COMMVNITAS', theme: 'paper', year: [1997, 1997],
    draw(c, th, S) {
      headline(c, th, S, ['IT GOT', 'A *FACE.*'], { y: 360 })
      caption(c, th, S, 'SLONIK · RUSSIAN FOR "LITTLE ELEPHANT" · 1997', 112, 640)
      const u = ease(S.b / 5)
      slonik(c, th, RX + 40, 500, 620, u, { color: th.ink, width: 3.5, fill: '#336791' })
      if (S.b > 5.5) { const a = clamp((S.b - 5.5) / 1); c.globalAlpha = a; title(c, th, '"elephants can remember" — david yang, 1997', RX + 40, 900, 34, th.accent, { font: 'Garamond', weight: 400, align: 'center', sp: 1, ab: 0 }); c.globalAlpha = 1 }
    } },
  { id: 'tomlane', bars: 2, bpm: 132, act: 2, chap: 'III · COMMVNITAS', theme: 'paper', year: [1998, 1998], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['THEN CAME', '!*TOM LANE.*'], { y: 360 })
      caption(c, th, S, 'FIRST COMMIT 1998-10-01 · STILL COMMITTING', 112, 640)
      const u = ease((S.b - 0.5) / 6), n = Math.round(16885 * u), cx = RX + 60
      title(c, th, n.toLocaleString('en-US'), cx, 470, 170, th.accent, { align: 'center', weight: 900, sp: 4, ab: 2 })
      mono(c, 'COMMITS', cx, 540, 26, th.ink, 12, 'center', 700)
      // one in four: 65k commits as a strip of cells, his share inked
      const cols = 40, rows = 8, cw = 18, x0 = cx - cols * cw / 2, y0 = 620
      for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const idx = r * cols + k, his = (idx % 4) === 0
        const a = clamp((S.b - 1 - idx * 0.012) / 0.3); if (a <= 0) continue; c.globalAlpha = a
        c.fillStyle = his && S.b > 4 ? th.hot : th.faint; c.fillRect(x0 + k * cw, y0 + r * cw, cw - 4, cw - 4) }
      c.globalAlpha = 1
      if (S.b > 4) { c.globalAlpha = clamp((S.b - 4) / 0.5); mono(c, 'ONE IN EVERY FOUR COMMITS IN POSTGRES HISTORY', cx, y0 + rows * cw + 50, 21, th.hot, 3, 'center', 700); c.globalAlpha = 1 }
    } },
  { id: 'mvcc', bars: 2, bpm: 132, act: 2, chap: 'IV · MVCC', theme: 'paper', year: [1999, 1999], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['READERS NEVER', '!*BLOCK WRITERS.*'], { y: 340, big: 96 })
      caption(c, th, S, '6.5 · MVCC · VADIM MIKHEEV · 1999', 112, 640)
      const x0 = 1130, y0 = 240
      mono(c, 'xmin   xmax   row', x0 + 30, y0 - 20, 22, th.dim, 3)
      const vers = [['100', '205', "'Mike',  10000"], ['205', '311', "'Mike',  12500"], ['311', '—', "'Mike',  15000"]]
      vers.forEach((v, i) => { const bt = 0.4 + i * 1.3; if (S.b < bt) return; const a = easeOut((S.b - bt) / 0.5), y = y0 + i * 110
        c.globalAlpha = a; box(c, x0, y, 660, 80, i === 2 ? th.accent : th.ink, i < 2 ? 'rgba(43,36,29,0.05)' : 'rgba(47,95,143,0.08)', i === 2 ? 3 : 1.5)
        c.font = '400 26px Mono'; c.fillStyle = th.ink; c.fillText(v[0], x0 + 30, y + 50); c.fillText(v[1], x0 + 170, y + 50); c.fillText(v[2], x0 + 300, y + 50)
        if (i < 2 && S.b > bt + 1.2) { c.strokeStyle = th.dim; c.lineWidth = 2; line(c, x0 + 10, y + 40, x0 + 650, y + 40, ease((S.b - bt - 1.2) / 0.5)) }
        c.globalAlpha = 1 })
      // reader & writer lanes
      const ly = 640; c.lineWidth = 2
      c.strokeStyle = th.accent; line(c, x0, ly, x0 + 660, ly, ease(S.b / 6)); mono(c, 'READER  · snapshot', x0, ly - 16, 20, th.accent, 3)
      c.strokeStyle = th.hot; line(c, x0, ly + 90, x0 + 660, ly + 90, ease((S.b - 0.5) / 6)); mono(c, 'WRITER  · UPDATE', x0, ly + 74, 20, th.hot, 3)
      const px = x0 + 660 * ease(S.b / 6); glowDot(c, px, ly, 5, 'rgba(47,95,143,1)'); glowDot(c, x0 + 660 * ease((S.b - 0.5) / 6), ly + 90, 5, 'rgba(168,50,42,1)')
    } },
  { id: 'wal', bars: 2, bpm: 132, act: 2, chap: 'V · DVRABILITAS', theme: 'paper', year: [2001, 2001],
    draw(c, th, S) {
      headline(c, th, S, ['WRITE', '!*AHEAD.*'], { y: 360 })
      caption(c, th, S, '7.1 · WRITE-AHEAD LOG · 2001', 112, 640)
      if (S.b > 1.5) { c.globalAlpha = clamp((S.b - 1.5) / 0.5); mono(c, 'WAL · VADIM MIKHEEV', 112, 690, 22, th.accent, 3, 'left', 700); mono(c, 'TOAST · JAN WIECK', 112, 728, 22, th.accent, 3, 'left', 700); c.globalAlpha = 1 }
      const off = S.t * 150
      c.save(); c.beginPath(); c.rect(880, 0, W - 880, H); c.clip()
      for (let i = 0; i < 7; i++) { const x = 900 + i * 180 - (off % 180), y = 330, seg = i + Math.floor(off / 180)
        box(c, x, y, 160, 220, th.ink, 'rgba(43,36,29,0.04)', 2)
        mono(c, (seg + 1).toString(16).toUpperCase().padStart(8, '0'), x + 80, y + 250, 18, th.dim, 1, 'center')
        for (let r = 0; r < 9; r++) { const R = rng(seg * 31 + r)(); c.fillStyle = r === 8 ? th.hot : th.faint; c.fillRect(x + 14, y + 16 + r * 22, 132 * (0.35 + R * 0.65), 12) } }
      c.restore()
      c.fillStyle = th.bg0 ? 'rgba(0,0,0,0)' : ''; c.strokeStyle = th.accent; c.lineWidth = 3
      poly(c, [[1300, 250], [1300, 610]]); mono(c, 'INSERT LSN', 1300, 235, 20, th.accent, 3, 'center')
      mono(c, '00000001' + '00000000' + (0x40 + Math.floor(S.t * 3)).toString(16).toUpperCase().padStart(8, '0'), 1300, 680, 22, th.ink, 3, 'center')
      c.strokeStyle = th.ink; c.lineWidth = 2; const dy = 780
      poly(c, [[1000, dy], [1600, dy]], ease(S.b / 3)); for (let i = 0; i < 4; i++) { const bt = 2 + i; if (S.b > bt) { const q = clamp((S.b - bt) / 0.7); glowDot(c, lerp(1000, 1600, q), dy, 4, 'rgba(168,50,42,1)', 1 - q * 0.5) } }
      mono(c, 'fsync()', 1640, dy + 6, 22, th.hot, 3)
    } },
  { id: 'montage', bars: 4, bpm: 132, act: 2, chap: 'VI · MATVRITAS', theme: 'paper', year: [2005, 2011], montage: true,
    cards: [['8.0', 'POINT-IN-TIME RECOVERY', 2005, 'SIMON RIGGS'], ['8.1', 'AUTOVACUUM', 2005, 'ALVARO HERRERA'], ['8.3', 'XML', 2008, 'NIKOLAY SAMOKHVALOV · PAVEL STEHULE · PETER EISENTRAUT'], ['8.3', 'FULL TEXT SEARCH', 2008, 'TEODOR SIGAEV · OLEG BARTUNOV'], ['8.4', 'WINDOW FUNCTIONS', 2009, 'HITOSHI HARADA'], ['9.0', 'STREAMING REPLICATION', 2010, 'FUJII MASAO · HEIKKI LINNAKANGAS'], ['9.0', 'HOT STANDBY', 2010, 'SIMON RIGGS · HEIKKI LINNAKANGAS'], ['9.1', 'SYNCHRONOUS REPLICATION', 2011, 'SIMON RIGGS · FUJII MASAO']],
    draw: montageDraw },
  { id: 'replicas', bars: 2, bpm: 132, act: 2, chap: 'VII · REPLICATIO', theme: 'paper', year: [2010, 2010], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['THEN IT', '!*MULTIPLIED.*'], { y: 360 })
      caption(c, th, S, 'STREAMING · HOT STANDBY · CASCADING REPLICAS', 112, 640)
      const P = [1350, 250]; const lv = [[[1100, 520], [1350, 520], [1600, 520]], [[980, 800], [1150, 800], [1270, 800], [1430, 800], [1550, 800], [1720, 800]]]
      c.lineWidth = 2
      lv[0].forEach((q, i) => { c.strokeStyle = th.accent; line(c, P[0], P[1] + 40, q[0], q[1] - 40, ease((S.b - 0.8 - i * 0.2) / 0.8)) })
      lv[1].forEach((q, i) => { const pa = lv[0][Math.floor(i / 2)]; c.strokeStyle = th.dim; line(c, pa[0], pa[1] + 40, q[0], q[1] - 30, ease((S.b - 2.5 - i * 0.15) / 0.7)) })
      const node = (q, r, bt, lab, main) => { if (S.b < bt) return; const a = easeOutBack((S.b - bt) / 0.5); c.save(); c.translate(q[0], q[1]); c.scale(a, a)
        c.fillStyle = main ? '#336791' : '#f5eddb'; c.strokeStyle = th.ink; c.lineWidth = 2.5; c.beginPath(); c.ellipse(0, -r * 0.6, r, r * 0.3, 0, 0, 7); c.fill(); c.stroke()
        c.fillRect(-r, -r * 0.6, r * 2, r * 1.2); c.beginPath(); c.moveTo(-r, -r * 0.6); c.lineTo(-r, r * 0.6); c.moveTo(r, -r * 0.6); c.lineTo(r, r * 0.6); c.stroke()
        c.beginPath(); c.ellipse(0, r * 0.6, r, r * 0.3, 0, 0, Math.PI); c.stroke(); c.restore()
        if (lab) mono(c, lab, q[0] + r + 14, q[1] + 6, 19, th.dim, 3, 'left', 600) }
      node(P, 44, 0.2, 'PRIMARY', true); lv[0].forEach((q, i) => node(q, 34, 1.4 + i * 0.2, 'STANDBY')); lv[1].forEach((q, i) => node(q, 24, 3 + i * 0.15, null))
      for (let k = 0; k < 3; k++) { const q = (S.b * 0.9 + k * 0.33) % 1; lv[0].forEach(d => { if (S.b > 2) glowDot(c, lerp(P[0], d[0], q), lerp(P[1] + 40, d[1] - 40, q), 3, 'rgba(47,95,143,1)') }) }
    } },
  { id: 'json', bars: 2, bpm: 132, act: 2, chap: 'VIII · DOCVMENTA', theme: 'paper', year: [2012, 2014],
    draw(c, th, S) {
      headline(c, th, S, ['IT LEARNED', '!*JSON.*'], { y: 360, big: 140 })
      caption(c, th, S, '9.2 · JSON · 9.4 · JSONB · DECEMBER 2014', 112, 640)
      if (S.b > 2) { c.globalAlpha = clamp((S.b - 2) / 0.5); mono(c, 'JSON · ROBERT HAAS', 112, 690, 21, th.accent, 3, 'left', 700); mono(c, 'JSONB · BARTUNOV · SIGAEV · KOROTKOV', 112, 726, 21, th.accent, 3, 'left', 700); c.globalAlpha = 1 }
      const lines = ['SELECT doc->\'user\'->>\'name\'', '  FROM events', ' WHERE doc @> \'{"type":"signup"}\';', '', '{', '  "type": "signup",', '  "user": { "name": "slonik",', '            "tags": ["sql","nosql"] },', '  "ts": "2014-12-18"', '}']
      lines.forEach((s, i) => { const bt = 0.4 + i * 0.42; if (S.b < bt) return; c.globalAlpha = clamp((S.b - bt) / 0.3)
        c.font = `${i < 3 ? 500 : 400} 30px Mono`; c.fillStyle = i < 3 ? th.accent : th.ink; c.fillText(s, 980, 280 + i * 50); c.globalAlpha = 1 })
      if (S.b > 1) { c.globalAlpha = 0.08 + 0.04 * Math.sin(S.t * 3); c.font = '900 620px Garamond'; c.fillStyle = th.accent; c.fillText('{ }', 900, 820); c.globalAlpha = 1 }
    } },
  { id: 'turing', bars: 2, bpm: 132, act: 2, chap: 'IX · HONOR', theme: 'dark', year: [2015, 2015], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['ITS CREATOR WON', '!*THE TURING*', '!*AWARD.*'], { y: 290 })
      caption(c, th, S, 'MICHAEL STONEBRAKER · ACM A.M. TURING AWARD 2014', 112, 740)
      const cx = RX + 80, cy = 500, r = 280, u = ease(S.b / 3)
      const g = c.createRadialGradient(cx - 80, cy - 90, 20, cx, cy, r); g.addColorStop(0, 'rgba(255,220,150,0.95)'); g.addColorStop(0.6, 'rgba(200,140,50,0.9)'); g.addColorStop(1, 'rgba(90,55,15,0.95)')
      c.save(); c.globalAlpha = clamp((S.b - 1) / 1.5); c.shadowColor = 'rgba(242,196,107,0.8)'; c.shadowBlur = 80; c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); c.restore()
      c.strokeStyle = GOLD(0.95); c.lineWidth = 2.5; poly(c, circP(cx, cy, r + 14, 160), u); c.lineWidth = 1.2; poly(c, circP(cx, cy, r - 36, 160), u)
      if (S.b > 1.8) { c.save(); c.globalAlpha = clamp((S.b - 1.8) / 1); c.translate(cx, cy); c.rotate(S.t * 0.05)
        c.font = '600 22px Cinzel'; c.fillStyle = 'rgba(70,40,5,0.9)'; const s = 'A · M · TURING AWARD · ASSOCIATION FOR COMPUTING MACHINERY · '
        ;[...s].forEach((ch, i) => { c.save(); c.rotate(i / s.length * Math.PI * 2); c.fillText(ch, -6, -r + 34); c.restore() }); c.restore()
        c.globalAlpha = clamp((S.b - 2.2) / 1); const ink = 'rgba(70,40,5,0.9)'
        c.strokeStyle = ink; c.lineWidth = 1.5; line(c, cx - 130, cy - 70, cx + 130, cy - 70); line(c, cx - 130, cy + 88, cx + 130, cy + 88)
        c.fillStyle = ink; c.textAlign = 'center'; c.font = '700 40px Cinzel'; c.fillText('MICHAEL', cx, cy - 12); c.font = '800 44px Cinzel'; c.fillText('STONEBRAKER', cx, cy + 44)
        c.font = '700 30px Cinzel'; c.fillText('MMXIV', cx, cy + 140); c.font = '600 20px Cinzel'; c.fillText('ACM', cx, cy - 100); c.textAlign = 'left'; c.globalAlpha = 1 }
    } },

  // ───────────── ACT III · UBIQUE ─────────────
  { id: 'cloud', bars: 2, bpm: 150, act: 3, chap: 'X · VBIQVE', theme: 'dark', year: [2015, 2019], hit: true, impact: true,
    draw(c, th, S) {
      flatMap(c, th, 0, 60, W, 1150, { color: 'rgba(242,232,211,0.18)', u: ease(S.b / 2) })
      const R = rng(5)
      CITIES.forEach(([lo, la], i) => { const bt = 0.6 + R() * 4; if (S.b < bt) return; const [x, y] = mapXY(lo, la, 0, 60, W, 1150); const a = clamp((S.b - bt) / 0.3)
        glowDot(c, x, y, 3.5 + 2 * Math.sin(S.t * 4 + i), 'rgba(242,196,107,1)', a) })
      c.strokeStyle = GOLD(0.35); c.lineWidth = 1.2
      for (let i = 0; i < 30; i++) { const a = CITIES[Math.floor(R() * CITIES.length)], b = CITIES[Math.floor(R() * CITIES.length)], bt = 2 + R() * 3.5
        const [x1, y1] = mapXY(...a, 0, 60, W, 1150), [x2, y2] = mapXY(...b, 0, 60, W, 1150); const mx = (x1 + x2) / 2, my = Math.min(y1, y2) - Math.abs(x1 - x2) * 0.25
        const pts = Array.from({ length: 30 }, (_, k) => { const t = k / 29; return [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2] })
        poly(c, pts, ease((S.b - bt) / 1)) }
      c.fillStyle = 'rgba(4,5,7,0.55)'; c.fillRect(70, 250, 820, 420)
      headline(c, th, S, ['THEN IT RAN', '!*EVERYWHERE.*'], { y: 330, big: 104 })
      caption(c, th, S, 'EVERY CLOUD · EVERY CONTINENT · EVERY STACK', 112, 620)
    } },
  { id: 'montage2', bars: 7, bpm: 150, act: 3, chap: 'XI · MATVRITAS II', theme: 'dark', year: [2014, 2025], montage: true, altBg: '#0b1d30',
    cards: [['9.4', 'LOGICAL DECODING', 2014, 'ANDRES FREUND'], ['9.5', 'UPSERT', 2016, 'PETER GEOGHEGAN · HEIKKI LINNAKANGAS · ANDRES FREUND'], ['9.6', 'PARALLEL QUERY', 2016, 'ROBERT HAAS · AMIT KAPILA · DAVID ROWLEY'], ['10', 'LOGICAL REPLICATION', 2017, 'PETR JELINEK'], ['10', 'DECLARATIVE PARTITIONING', 2017, 'AMIT LANGOTE'], ['12', 'GENERATED COLUMNS', 2019, 'PETER EISENTRAUT'], ['13', 'B-TREE DEDUPLICATION', 2020, 'ANASTASIA LUBENNIKOVA · PETER GEOGHEGAN'], ['15', 'MERGE', 2022, 'SIMON RIGGS · PAVAN DEOLASEE · ÁLVARO HERRERA'], ['16', 'DECODING ON STANDBYS', 2023, 'BERTRAND DROUVOT · ANDRES FREUND · AMIT KHANDEKAR'], ['17', 'INCREMENTAL BACKUP', 2024, 'ROBERT HAAS · JAKUB WARTAK · TOMAS VONDRA'], ['17', 'FAILOVER SLOTS', 2024, 'HOU ZHIJIE · SHVETA MALIK · AJIN CHERIAN'], ['18', 'UUIDv7', 2025, 'ANDREY BORODIN'], ['18', 'SKIP SCAN', 2025, 'PETER GEOGHEGAN']],
    draw: montageDraw },
  { id: 'platform', bars: 2, bpm: 150, act: 3, chap: 'XII · PLATFORMA', theme: 'dark', year: [2020, 2023], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['IT BECAME', '!*A PLATFORM.*'], { y: 360 })
      caption(c, th, S, 'CREATE EXTENSION · OVER A THOUSAND OF THEM', 112, 640)
      const cx = RX + 60, cy = 500
      slonik(c, th, cx, cy, 230, ease(S.b / 2), { color: GOLD(1), width: 2.5, glow: 20 })
      const ext = ['postgis', 'pgvector', 'timescaledb', 'citus', 'pg_stat_statements', 'pg_cron', 'postgres_fdw', 'pg_trgm', 'pgaudit', 'pg_partman', 'hypopg', 'plpgsql']
      ext.forEach((e, i) => { const bt = 0.5 + i * 0.5; if (S.b < bt) return; const p = easeOut((S.b - bt) / 0.4)
        const a = i / ext.length * Math.PI * 2 - Math.PI / 2 + S.t * 0.08, r = lerp(620, 330, p) + (i % 2) * 40
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.82
        c.globalAlpha = p; c.strokeStyle = GOLD(0.35); c.lineWidth = 1; line(c, cx + Math.cos(a) * 140, cy + Math.sin(a) * 120, x, y)
        c.font = '600 22px Mono'; const w = c.measureText(e).width + 28
        c.fillStyle = 'rgba(20,16,8,0.9)'; c.fillRect(x - w / 2, y - 22, w, 40); c.strokeStyle = GOLD(0.9); c.lineWidth = 1.5; c.strokeRect(x - w / 2, y - 22, w, 40)
        c.fillStyle = th.ink; c.textAlign = 'center'; c.fillText(e, x, y + 6); c.textAlign = 'left'; c.globalAlpha = 1 })
    } },
  { id: 'awards', bars: 2, bpm: 150, act: 3, chap: 'XI · GLORIA', theme: 'dark', year: [2017, 2023],
    draw(c, th, S) {
      headline(c, th, S, ['DBMS OF', '!*THE YEAR.*'], { y: 360 })
      caption(c, th, S, 'DB-ENGINES · 2017 · 2018 · 2020 · 2023', 112, 640)
      ;['2017', '2018', '2020', '2023'].forEach((y, i) => { const bt = 1 + i * 1.1; if (S.b < bt) return; const p = clamp((S.b - bt) / 0.35), s = lerp(2.2, 1, easeOut(p))
        const x = 1080 + (i % 2) * 380, yy = 330 + Math.floor(i / 2) * 330
        c.save(); c.translate(x, yy); c.rotate(-0.08 + i * 0.05); c.scale(s, s); c.globalAlpha = p
        c.strokeStyle = GOLD(0.95); c.lineWidth = 4; c.shadowColor = GOLD(0.8); c.shadowBlur = 20; c.beginPath(); c.arc(0, 0, 140, 0, 7); c.stroke(); c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 122, 0, 7); c.stroke()
        c.shadowBlur = 0; title(c, th, y, 0, 26, 76, th.accent, { align: 'center', weight: 900, glow: 20, ab: 0 }); mono(c, 'DBMS OF THE YEAR', 0, -42, 14, th.ink, 2, 'center'); mono(c, 'DB-ENGINES', 0, 78, 18, th.dim, 5, 'center')
        c.restore() })
    } },
  { id: 'vector', bars: 2, bpm: 150, act: 3, chap: 'XII · SENSVS', theme: 'blue', year: [2021, 2024],
    draw(c, th, S) {
      headline(c, th, S, ['THEN IT LEARNED', '!*MEANING.*'], { y: 360 })
      caption(c, th, S, 'PGVECTOR · ORDER BY embedding <-> $1 LIMIT 5', 112, 640)
      const R = rng(11), cx = RX + 40, cy = 480, rot = S.t * 0.35, pts = []
      const cl = [[0.5, 0.3, 0.2], [-0.5, -0.2, 0.4], [0.1, -0.5, -0.5], [-0.3, 0.5, -0.3]]
      for (let i = 0; i < 360; i++) { const k = cl[i % 4], g = () => (R() + R() + R() - 1.5) * 0.35
        let [x, y, z] = [k[0] + g(), k[1] + g(), k[2] + g()]; const X = x * Math.cos(rot) - z * Math.sin(rot), Z = x * Math.sin(rot) + z * Math.cos(rot)
        const p = 1 / (1.8 - Z * 0.5); pts.push([cx + X * 760 * p, cy + y * 760 * p, Z, i % 4]) }
      const q = pts[0]
      pts.forEach((p, i) => { const a = clamp((S.b - 0.2 - i * 0.01) / 0.3); if (a <= 0) return; c.globalAlpha = a * (0.4 + 0.3 * (p[2] + 1))
        c.fillStyle = p[3] === 0 ? '#9fd4ff' : 'rgba(200,225,255,0.8)'; c.beginPath(); c.arc(p[0], p[1], 3 + 1.5 * p[2], 0, 7); c.fill() }); c.globalAlpha = 1
      if (S.b > 3) { const nn = pts.filter(p => p[3] === 0).map(p => [p, Math.hypot(p[0] - q[0], p[1] - q[1])]).sort((a, b) => a[1] - b[1]).slice(1, 6)
        nn.forEach(([p], i) => { c.strokeStyle = 'rgba(242,196,107,0.85)'; c.lineWidth = 1.5; line(c, q[0], q[1], p[0], p[1], ease((S.b - 3 - i * 0.15) / 0.5)); glowDot(c, p[0], p[1], 3, 'rgba(242,196,107,1)', clamp((S.b - 3.3 - i * 0.15) / 0.3)) })
        glowDot(c, q[0], q[1], 6, 'rgba(242,196,107,1)') }
    } },
  { id: 'branching', bars: 2, bpm: 150, act: 3, chap: 'XIII · RAMI', theme: 'blue', year: [2020, 2025], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['DATABASES THAT', '!*BRANCH*', '!*LIKE CODE.*'], { y: 290, big: 104 })
      caption(c, th, S, 'THIN CLONES · COPY-ON-WRITE · BRANCHING', 112, 700)
      const y0 = 520, x0 = 980, x1 = 1830
      c.strokeStyle = BLUE(0.9); c.lineWidth = 4; line(c, x0, y0, x1, y0, ease(S.b / 1.5))
      mono(c, 'main', x0, y0 - 22, 20, th.accent, 3, 'left', 700)
      const br = [[1120, -1, 'dev'], [1260, 1, 'ci-test'], [1400, -1, 'pr-4812'], [1540, 1, 'agent-7'], [1660, -1, 'staging']]
      br.forEach(([bx, dir, name], i) => { const bt = 1 + i * 0.9; if (S.b < bt) return; const p = ease((S.b - bt) / 0.7)
        const pts = Array.from({ length: 24 }, (_, k) => { const t = k / 23; return [bx + t * 150, y0 + dir * 230 * (1 - Math.cos(t * Math.PI / 2))] })
        c.strokeStyle = GOLD(0.85); c.lineWidth = 2.5; poly(c, pts, p)
        glowDot(c, bx, y0, 5, 'rgba(242,196,107,1)')
        if (p > 0.9) { const [ex, ey] = pts[23]; const a = clamp((p - 0.9) / 0.1)
          c.globalAlpha = a; c.fillStyle = 'rgba(10,20,34,0.95)'; c.strokeStyle = GOLD(0.9); c.lineWidth = 2
          c.beginPath(); c.ellipse(ex, ey - 16, 30, 9, 0, 0, 7); c.fill(); c.stroke(); c.fillRect(ex - 30, ey - 16, 60, 34); c.beginPath(); c.moveTo(ex - 30, ey - 16); c.lineTo(ex - 30, ey + 18); c.moveTo(ex + 30, ey - 16); c.lineTo(ex + 30, ey + 18); c.stroke(); c.beginPath(); c.ellipse(ex, ey + 18, 30, 9, 0, 0, Math.PI); c.stroke()
          mono(c, name, ex, ey + dir * 56 + (dir > 0 ? 8 : 0), 19, th.ink, 2, 'center', 600); c.globalAlpha = 1 } })
      for (let k = 0; k < 6; k++) { const x = x0 + 60 + k * 140; if (S.b > 0.5 + k * 0.2) glowDot(c, x, y0, 4, 'rgba(111,178,240,1)') }
    } },
  { id: 'survey', bars: 2, bpm: 150, act: 3, chap: 'XI · GLORIA', theme: 'dark', year: [2025, 2025], hit: true,
    draw(c, th, S) {
      headline(c, th, S, ['THE DATABASE', 'DEVELOPERS USE', '!*MOST.*'], { y: 300, big: 120 })
      caption(c, th, S, 'STACK OVERFLOW DEVELOPER SURVEY 2025', 112, 680)
      const bars = [['PostgreSQL', 58.2], ['MySQL', 39.6]]
      bars.forEach(([n, v], i) => { const y = 380 + i * 170, bt = 0.8 + i * 0.4, e = ease((S.b - bt) / 1.4), w = 470 * v / 60 * e
        c.fillStyle = i === 0 ? GOLD(0.95) : 'rgba(242,232,211,0.25)'; if (i === 0) { c.shadowColor = GOLD(0.9); c.shadowBlur = 30 } c.fillRect(1100, y, w, 90); c.shadowBlur = 0
        mono(c, n, 1070, y + 56, 24, i === 0 ? th.accent : th.dim, 2, 'right', i === 0 ? 700 : 500)
        if (e > 0.05) title(c, th, (v * e).toFixed(1) + '%', 1100 + w + 24, y + 70, 64, i === 0 ? th.accent : th.dim, { weight: 900, glow: i === 0 ? 24 : 0, ab: 0 }) })
      mono(c, 'PROFESSIONAL DEVELOPERS USING IT', 1100, 780, 19, th.dim, 3)
    } },
  { id: 'agents', bars: 2, bpm: 150, act: 3, chap: 'XII · SENSVS', theme: 'blue', year: [2025, 2025], hit: true, type: [0.4, 7.6],
    draw(c, th, S) {
      headline(c, th, S, ['THEN THE MACHINES', '!*ASKED IT.*'], { y: 360 })
      caption(c, th, S, 'AI AGENTS · 2025 · STILL SPEAKING SQL', 112, 640)
      const x = 980, y = 220, w = 840, h = 640
      c.fillStyle = 'rgba(3,8,14,0.8)'; c.fillRect(x, y, w, h); c.strokeStyle = BLUE(0.5); c.lineWidth = 1.5; c.strokeRect(x, y, w, h)
      ;[0, 1, 2].forEach(i => { c.fillStyle = BLUE(0.4); c.beginPath(); c.arc(x + 24 + i * 22, y + 22, 6, 0, 7); c.fill() })
      const n = Math.floor(clamp((S.b - 0.4) / 7) * 520)
      typed(c, ['> agent: which customers churned last quarter?', '', 'postgres=# WITH q AS (', '  SELECT customer_id, max(ts) AS last_seen', '    FROM events GROUP BY 1)', 'SELECT c.name, q.last_seen', '  FROM customers c JOIN q USING (customer_id)', ' WHERE q.last_seen < now() - interval \'90 days\'', ' ORDER BY q.last_seen;', '', '  name      |       last_seen', '------------+------------------------', ' acme corp  | 2025-03-02 11:04:52+00', ' initech    | 2025-02-17 09:31:08+00', '(2 rows)'], x + 30, y + 80, 23, '#bfe0ff', n, { t: S.t, lh: 1.55 })
    } },
  { id: 'aicode', bars: 2, bpm: 150, act: 3, chap: 'XIV · SENSVS', theme: 'blue', year: [2025, 2025], hit: true, type: [0.3, 5.2],
    draw(c, th, S) {
      headline(c, th, S, ['THEN AI WROTE', '!*A FEATURE.*'], { y: 330 })
      caption(c, th, S, 'PG_DUMP --NO-POLICIES · CODE BY CLAUDE', 112, 620)
      if (S.b > 2.5) { c.globalAlpha = clamp((S.b - 2.5) / 0.5); mono(c, 'AUTHOR N. SAMOKHVALOV · COMMITTED BY TOM LANE', 112, 668, 20, th.ink, 2, 'left', 500)
        mono(c, 'AI-WRITTEN, AS DISCLOSED BY ITS AUTHOR · PG18', 112, 712, 20, th.accent, 2, 'left', 700); c.globalAlpha = 1 }
      const x = 960, y = 260, w = 860, h = 420
      c.fillStyle = '#05080c'; c.fillRect(x, y, w, h); c.strokeStyle = BLUE(0.5); c.lineWidth = 1.5; c.strokeRect(x, y, w, h)
      const L = ['$ pg_dump --help | grep policies', '  --no-policies                do not dump row security policies', '$ pg_dumpall --help | grep policies', '  --no-policies                do not dump row security policies', '$ pg_restore --help | grep policies', '  --no-policies                do not restore row security policies']
      const n = Math.floor(clamp((S.b - 0.3) / 4.9) * L.join('\n').length)
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip()
      typed(c, L, x + 24, y + 60, 19, '#d8e6f2', n, { t: S.t, lh: 1.9 })
      // highlight "policies" in red over revealed text
      c.font = '400 19px Mono'; let left = n
      L.forEach((s, i) => { const vis = s.slice(0, Math.max(0, left)); left -= s.length + 1; let k = -1
        while ((k = vis.indexOf('policies', k + 1)) >= 0) { if (k + 8 > vis.length) break; c.fillStyle = '#ff5a5a'; c.fillText('policies', x + 24 + c.measureText(s.slice(0, k)).width, y + 60 + i * 19 * 1.9) } })
      c.restore()
      if (S.b > 5.3) { const p = clamp((S.b - 5.3) / 0.25), sc = lerp(1.8, 1, easeOut(p)); c.save(); c.translate(x + w - 250, y + h - 70); c.rotate(-0.08); c.scale(sc, sc); c.globalAlpha = p
        c.strokeStyle = GOLD(0.95); c.lineWidth = 3; c.strokeRect(-210, -40, 420, 72); mono(c, 'cd3c45125d2 · COMMITTED', 0, 8, 22, th.hot, 3, 'center', 700); c.restore() }
    } },
  { id: 'aio', bars: 2, bpm: 150, act: 3, chap: 'XIII · CELERITAS', theme: 'blue', year: [2025, 2025],
    draw(c, th, S) {
      headline(c, th, S, ['IT NEVER', '!*STOPPED.*'], { y: 360 })
      caption(c, th, S, '18 · ASYNCHRONOUS I/O · SEPTEMBER 2025', 112, 640)
      if (S.b > 2) { c.globalAlpha = clamp((S.b - 2) / 0.5); mono(c, 'ANDRES FREUND · THOMAS MUNRO', 112, 690, 21, th.accent, 3, 'left', 700); mono(c, 'NAZIR BILAL YAVUZ · MELANIE PLAGEMAN', 112, 726, 21, th.accent, 3, 'left', 700); c.globalAlpha = 1 }
      const ring = (cx, cy, r, dir, label, col) => { c.strokeStyle = col; c.lineWidth = 2; poly(c, circP(cx, cy, r, 120), ease(S.b / 2)); poly(c, circP(cx, cy, r - 60, 120), ease(S.b / 2 - 0.2))
        for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + dir * S.t * 1.6, full = (i + Math.floor(S.t * 6)) % 3 !== 0
          c.save(); c.translate(cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30)); c.rotate(a); c.fillStyle = full ? col : 'rgba(0,0,0,0)'; c.strokeStyle = col; c.lineWidth = 1.2; c.fillRect(-20, -9, 40, 18); c.strokeRect(-20, -9, 40, 18); c.restore() }
        mono(c, label, cx, cy + 8, 22, th.ink, 4, 'center', 700) }
      ring(1180, 470, 220, 1, 'SQ', BLUE(0.9)); ring(1600, 470, 220, -1, 'CQ', GOLD(0.9))
      mono(c, 'io_method = io_uring', 1390, 820, 24, th.accent, 3, 'center')
      mono(c, 'submit ─────────▶ complete', 1390, 870, 20, th.dim, 3, 'center')
    } },
  { id: 'pg19', bars: 2, bpm: 150, act: 3, chap: 'XV · PRAESENS', theme: 'dark', year: [2026, 2026], hit: true,
    feats: PG19_FEATS,
    draw(c, th, S) {
      headline(c, th, S, ['AND NOW,', '!*NINETEEN.*'], { y: 360 })
      caption(c, th, S, PG19_CAPTION, 112, 640)
      const cx = RX + 80, p = easeOutBack(S.b / 0.7)
      c.save(); c.translate(cx, 330); c.scale(p, p); title(c, th, '19', 0, 120, 300, th.accent, { align: 'center', weight: 900, glow: 50, ab: 3 + 10 * clamp(1 - S.b * 2) }); c.restore()
      this.feats.forEach((f, i) => { const bt = 1.5 + i * 0.75; if (S.b < bt) return; const a = easeOut((S.b - bt) / 0.35), y = 560 + i * 62
        c.globalAlpha = a; c.fillStyle = GOLD(0.9); c.fillRect(cx - 330, y - 18, 10, 10)
        mono(c, f, cx - 300 + (1 - a) * 30, y - 4, 26, th.ink, 3, 'left', 600); c.globalAlpha = 1 })
    } },
  { id: 'commits', bars: 3, bpm: 150, act: 3, chap: 'XIV · MEMORIA', theme: 'dark', year: [1996, 2026], hit: true, chart: true,
    draw(c, th, S, D) {
      const years = Object.keys(D.perYear).map(Number), maxv = Math.max(...Object.values(D.perYear))
      const u = ease(S.b / 8), x0 = 960, x1 = 1830, yb = 820, hmax = 520
      let cum = 0, shown = 0; const bw = (x1 - x0) / years.length
      years.forEach((y, i) => { const f = clamp(u * years.length - i); const v = D.perYear[y]; cum += v * (f >= 1 ? 1 : 0); shown += v * f
        const h = v / maxv * hmax * f; c.fillStyle = GOLD(0.25 + 0.7 * (i / years.length)); c.fillRect(x0 + i * bw + 2, yb - h, bw - 4, h)
        if (y % 5 === 0 || y === 1996) mono(c, String(y), x0 + i * bw + bw / 2, yb + 30, 19, th.dim, 1, 'center') })
      c.strokeStyle = th.faint; c.lineWidth = 1; line(c, x0, yb, x1, yb)
      const n = Math.round(shown)
      title(c, th, n.toLocaleString('en-US'), 110, 520, 150, th.accent, { weight: 900, glow: 40, sp: 4, ab: 2 })
      title(c, th, 'COMMITS.', 110, 640, 70, th.ink, { weight: 700, sp: 8, glow: 10 })
      title(c, th, 'THIRTY YEARS.', 110, 330, 64, th.ink, { weight: 700, sp: 6, alpha: clamp(S.b / 0.5), glow: 10 })
      caption(c, th, S, 'git log · postgres.git · 1996-07-09 → TODAY', 112, 720, 2)
    } },

  // ───────────── FINALE ─────────────
  { id: 'people', bars: 4, bpm: 150, act: 3, chap: 'XV · HOMINES', theme: 'dark', year: null, yearText: '1970—',  hit: true,
    draw(c, th, S) {
      // the wall: everyone named in the history, size by credits, sweeping in
      if (!this.wall) { for (let f = 1; f > 0.3; f *= 0.96) { const rows = []; let x = 90, y = 140, rowH = 0
          ALLPEOPLE.forEach(([n, k], i) => { const sz = Math.max(7, Math.round(f * (i < 60 ? 21 : i < 200 ? 16 : i < 500 ? 13 : 10))); c.font = `${i < 200 ? 500 : 400} ${sz}px Garamond`
            const w = c.measureText(n).width; if (x + w > 1860) { x = 90; y += rowH + 3; rowH = 0 } rows.push([n, x, y + sz, sz, i]); x += w + sz * 0.8; rowH = Math.max(rowH, sz) })
          this.wall = rows; this.wallH = y; if (y + rowH <= 905) break } }
      const sweep = (S.b - 0.2) / 7, span = Math.max(1, this.wallH - 150)
      for (const [n, x, y, sz, i] of this.wall) { const a = clamp((sweep - (y - 150) / span * 0.8 - x / 1920 * 0.2) * 4); if (a <= 0) continue
        c.globalAlpha = a * (i < 60 ? 0.55 : i < 200 ? 0.42 : 0.32); c.font = `${i < 200 ? 500 : 400} ${sz}px Garamond`; c.fillStyle = i < 60 ? '#f2dca8' : '#e8dcc2'; c.fillText(n, x, y) }
      c.globalAlpha = 1
      const vg = c.createRadialGradient(1330, 540, 80, 1330, 540, 620); vg.addColorStop(0, 'rgba(4,5,7,0.82)'); vg.addColorStop(1, 'rgba(4,5,7,0)'); c.fillStyle = vg; c.fillRect(700, 100, 1220, 880)
      const C = COMMITTERS, max = C[0][1], R = rng(8)
      // constellation of committers, size by commits
      if (!this.pos) { const boxes = []; this.pos = C.map(([name, n], i) => { const sz = Math.round(16 + 34 * Math.sqrt(n / max)); c.font = `${sz > 30 ? 700 : 500} ${sz}px Garamond`
          const w = c.measureText(name).width + 26, h = sz + (i < 12 ? 30 : 12)
          for (let k = 0; k < 4000; k++) { const a = k * 0.37, r = k * 1.6, x = 1330 + Math.cos(a) * r, y = 520 + Math.sin(a) * r * 0.62
            const bx = [x - w / 2, y - sz * 0.9, x + w / 2, y - sz * 0.9 + h + sz * 0.3]
            if (bx[0] < 790 || bx[2] > 1880 || bx[1] < 150 || bx[3] > 920) continue
            if (boxes.some(o => !(bx[2] < o[0] || bx[0] > o[2] || bx[3] < o[1] || bx[1] > o[3]))) continue
            boxes.push(bx); return [x, y] } return [1330, 520] }) }
      const pos = this.pos
      c.strokeStyle = GOLD(0.12); c.lineWidth = 1
      pos.forEach((p, i) => { if (i && S.b > 2 + i * 0.1) { const q = pos[Math.floor(R() * i)]; line(c, p[0], p[1], q[0], q[1], ease((S.b - 2 - i * 0.1) / 0.6)) } })
      C.forEach(([name, n], i) => { const bt = 0.3 + i * 0.22; if (S.b < bt) return; const a = easeOut((S.b - bt) / 0.35), [x, y] = pos[i]
        const sz = Math.round(16 + 34 * Math.sqrt(n / max))
        c.globalAlpha = a; glowDot(c, x, y - sz * 0.9, 2 + sz / 14, 'rgba(242,196,107,1)', 0.8)
        c.font = `${sz > 30 ? 700 : 500} ${sz}px Garamond`; c.fillStyle = i < 3 ? th.accent : th.ink; c.textAlign = 'center'
        if (i < 3) { c.shadowColor = GOLD(0.8); c.shadowBlur = 18 } c.fillText(name, x, y + sz * 0.35); c.shadowBlur = 0
        if (i < 12) mono(c, n.toLocaleString('en-US'), x, y + sz * 0.35 + 22, 15, th.dim, 2, 'center')
        c.textAlign = 'left'; c.globalAlpha = 1 })
      c.fillStyle = 'rgba(4,5,7,0.9)'; c.shadowColor = 'rgba(4,5,7,0.9)'; c.shadowBlur = 40; c.fillRect(70, 230, 700, 620); c.shadowBlur = 0
      headline(c, th, S, ['BUILT BY', '!*PEOPLE.*'], { y: 260 })
      const rows = [['PIONEERS', 'CODD · STONEBRAKER · WONG · ROWE'], ['POSTGRES95', 'ANDREW YU · JOLLY CHEN'], ['FIRST CORE TEAM', 'FOURNIER · MOMJIAN · LOCKHART · MIKHEEV']]
      rows.forEach(([k, v], i) => { const bt = 2.5 + i * 1; if (S.b < bt) return; c.globalAlpha = clamp((S.b - bt) / 0.4)
        mono(c, k, 112, 560 + i * 62, 17, th.accent, 5, 'left', 700); mono(c, v, 112, 588 + i * 62, 20, th.ink, 2, 'left', 500); c.globalAlpha = 1 })
      caption(c, th, S, `${ALLPEOPLE.length.toLocaleString('en-US')} PEOPLE NAMED IN THE GIT HISTORY`, 112, 790, 5)
    } },
  { id: 'future', bars: 3, bpm: 150, act: 3, chap: 'XVI · FVTVRVM', theme: 'blue', year: null, yearText: 'NEXT', hit: true,
    threads: FUTURE_THREADS, qs: FUTURE_QS,
    draw(c, th, S) {
      // big faint questions behind
      this.qs.forEach((q, i) => { const bt = 1 + i * 2.5; if (S.b < bt) return; const a = clamp((S.b - bt) / 0.3) * clamp((bt + 2.5 - S.b) / 0.6)
        title(c, th, q, RX + 40, 420 + (i % 2) * 260, 120, 'rgba(124,192,255,0.13)', { align: 'center', weight: 900, alpha: a, ab: 0, glow: 0 }) })
      // mailing-list threads scrolling up
      const x = 980, top = 200, rowH = 64, off = S.t * 42
      c.save(); c.beginPath(); c.rect(x - 10, top - 10, 880, 700); c.clip()
      c.fillStyle = 'rgba(3,7,13,0.78)'; c.fillRect(x - 10, top - 10, 880, 700)
      this.threads.forEach((t, i) => { const y = top + 40 + i * rowH - off + 200; if (y < top - 40 || y > top + 720) return
        const a = clamp((S.b - 0.3 - i * 0.35) / 0.4); if (a <= 0) return; c.globalAlpha = a
        mono(c, t[0].length > 50 ? t[0].slice(0, 49) + '…' : t[0], x + t[2] * 34, y, 22, t[2] ? th.dim : th.ink, 1, 'left', t[2] ? 400 : 600)
        mono(c, t[1], x + 860, y, 16, th.dim, 2, 'right'); c.globalAlpha = 1 })
      c.restore()
      c.fillStyle = 'rgba(3,7,13,0.55)'; c.fillRect(70, 250, 830, 480)
      headline(c, th, S, ['THE FUTURE IS', '!*DEBATED*', '!*IN PUBLIC.*'], { y: 270, big: 108 })
      if (S.b > 3) { c.globalAlpha = clamp((S.b - 3) / 0.5); title(c, th, 'fiercely, but politely.', 112, 640, 40, th.ink, { font: 'Garamond', weight: 400, sp: 1, ab: 0, glow: 8 }); c.globalAlpha = 1 }
      caption(c, th, S, 'PGSQL-HACKERS · COMMITFEST · ANYONE CAN JOIN', 112, 710)
    } },
  { id: 'nobody', bars: 2, bpm: 150, act: 4, chap: 'XV · FINIS', theme: 'dark', year: [2026, 2026], impact: true, quiet: true,
    draw(c, th, S) {
      title(c, th, 'NOBODY', W / 2, 470, 90, th.ink, { align: 'center', sp: 20, alpha: clamp(S.b / 1), glow: 12 })
      title(c, th, 'OWNS IT.', W / 2, 640, 150, th.accent, { align: 'center', weight: 900, sp: 12, alpha: clamp((S.b - 2) / 1), glow: 40 })
    } },
  { id: 'everybody', bars: 2, bpm: 150, act: 4, chap: 'XV · FINIS', theme: 'dark', year: [2026, 2026], riser: true,
    draw(c, th, S) {
      const R = rng(21); for (let i = 0; i < 220; i++) { const [lo, la] = CITIES[i % CITIES.length]; const x = mapXY(lo + (R() - 0.5) * 20, la + (R() - 0.5) * 12, 0, 60, W, 1150); const bt = R() * 7
        if (S.b > bt) glowDot(c, x[0], x[1], 2.2, 'rgba(242,196,107,1)', clamp((S.b - bt) / 0.5) * 0.7) }
      c.fillStyle = 'rgba(4,5,7,0.5)'; c.fillRect(0, 380, W, 330)
      title(c, th, 'EVERYBODY', W / 2, 470, 90, th.ink, { align: 'center', sp: 20, alpha: clamp(S.b / 1), glow: 12 })
      title(c, th, 'RUNS IT.', W / 2, 640, 150, th.accent, { align: 'center', weight: 900, sp: 12, alpha: clamp((S.b - 2) / 1), glow: 40 })
    } },
  { id: 'mandala', bars: 4, bpm: 150, act: 4, chap: 'XV · FINIS', theme: 'dark', year: [1970, 2026], yearText: '∞', hit: true, impact: true, climax: true,
    draw(c, th, S) {
      const cx = W / 2, cy = 590, u = ease(S.b / 3)
      const glow = c.createRadialGradient(cx, cy, 0, cx, cy, 520); glow.addColorStop(0, GOLD(0.35 + 0.1 * Math.sin(S.t * 4))); glow.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = glow; c.fillRect(0, 0, W, H)
      ;[250, 330, 410].forEach((r, k) => { c.strokeStyle = GOLD(0.6 - k * 0.15); c.lineWidth = 1.5; poly(c, circP(cx, cy, r, 180, S.t * (k % 2 ? -0.1 : 0.1)), u) })
      const ring = ['RELATIONS', 'INGRES', 'POSTGRES', 'SQL', 'MVCC', 'WAL', 'REPLICATION', 'JSONB', 'PARALLEL', 'PARTITIONS', 'PGVECTOR', 'ASYNC I/O']
      // labels set glyph-by-glyph along the arc; lower-half words run the other way so they stay upright
      c.font = '600 21px Mono'; c.fillStyle = th.ink; c.textAlign = 'center'
      ring.forEach((s, i) => { if (S.b < 1 + i * 0.2) return; c.globalAlpha = clamp((S.b - 1 - i * 0.2) / 0.4)
        const th0 = i / ring.length * Math.PI * 2 + S.t * 0.12, up = Math.cos(th0) >= 0, R = up ? 364 : 378
        const ws = [...s].map(ch => c.measureText(ch).width + 5), tot = ws.reduce((p, q) => p + q, 0) - 5
        let acc = -tot / 2
        ;[...s].forEach((ch, k) => { const mid = acc + ws[k] / 2 - 2.5, ang = th0 + (up ? 1 : -1) * mid / R; acc += ws[k]
          c.save(); c.translate(cx + Math.sin(ang) * R, cy - Math.cos(ang) * R); c.rotate(up ? ang : ang + Math.PI); c.fillText(ch, 0, up ? 7 : 7); c.restore() }) })
      c.globalAlpha = 1; c.textAlign = 'left'
      c.save(); c.translate(cx, cy); c.rotate(-S.t * 0.2)
      for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; glowDot(c, Math.cos(a) * 290, Math.sin(a) * 290, 2.5, 'rgba(242,196,107,1)', clamp((S.b - 2 - i * 0.05) / 0.3)) }
      c.restore()
      slonik(c, th, cx, cy, 380, ease(S.b / 4), { color: GOLD(1), width: 3, glow: 30 })
      if (S.b > 8) { const a = clamp((S.b - 8) / 1.2)
        title(c, th, 'AND IT\'S JUST GETTING STARTED.', cx, 160, 36, th.accent, { align: 'center', alpha: a, sp: 8, glow: 20 }) }
    } },
  { id: 'end', bars: 6, bpm: 150, act: 4, chap: 'XV · FINIS', theme: 'dark', year: [2026, 2026], end: true, type: [0.3, 3.6],
    draw(c, th, S) {
      const b = S.b
      if (b < 6.5) { const n = Math.floor(clamp((b - 0.3) / 2.5) * 30); c.globalAlpha = clamp((6.5 - b) / 0.5)
        c.shadowColor = GOLD(0.8); c.shadowBlur = 16; typed(c, ['postgres=# SELECT * FROM future;'], 560, 560, 44, th.accent, n, { t: S.t }); c.shadowBlur = 0; c.globalAlpha = 1 }
      else { const a = clamp((b - 6.5) / 1.2) * clamp((23.5 - b) / 3)
        slonik(c, th, W / 2, 380, 300, clamp((b - 6.5) / 2.5), { color: GOLD(1), width: 2.5, glow: 24 })
        title(c, th, 'POSTGRES', W / 2, 700, 160, th.ink, { align: 'center', weight: 900, sp: 22, alpha: a, glow: 30 })
        c.globalAlpha = a; mono(c, 'THE WORLD\'S MOST ADVANCED OPEN SOURCE RELATIONAL DATABASE', W / 2, 790, 22, th.dim, 6, 'center')
        mono(c, '1986 · 1996 · 2026 · ∞', W / 2, 850, 22, th.accent, 10, 'center', 700); c.globalAlpha = 1 }
    } },
]
