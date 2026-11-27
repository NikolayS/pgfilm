// pgPrism launch film (square, phone-first).
// One key property per beat: a big caption on top, a tight close-up of the real component below.
// Order: what it is -> embed it anywhere -> tiny -> features -> how to set it up -> where to get it.
// Everything on screen is a pure function of time: window.__film.seek(t) sets the state for second t.
(function () {
  'use strict';
  const SW = 1080, SH = 1080, FPS = 60;
  const CARD = { x: 36, y: 344, w: 1008, h: 700 };
  const S0 = CARD.w / 480;                 // 2.1: a 480 px-wide component fills the card (12 px text -> 25 px)
  const qs = new URLSearchParams(location.search);
  const CAPTURE = qs.has('capture') || navigator.webdriver === true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const stage = $('#stage'), lens = $('#lens'), sweepEl = $('#sweep'), clipEl = $('#clip'), cursorEl = $('#cursor');
  const PLAN = window.PLANS['movies-seq-scans'].plan;
  const HOT_NODE = /Parallel Seq Scan on casts/;   // reads 561 of the plan's 737 MiB
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const raf2 = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  gsap.config({ force3D: false, nullTargetWarn: false });
  gsap.ticker.lagSmoothing(0);

  // ------------------------------------------------------------------ stage
  let stageScale = 1;
  function fitStage() {
    const availH = innerHeight - (document.body.classList.contains('dev') ? 34 : 0);
    stageScale = Math.min(innerWidth / SW, availH / SH);
    stage.style.transform = `scale(${stageScale})`;
  }

  function drawBg() {
    const c = $('#bg'), g = c.getContext('2d'), W = c.width, H = c.height, k = W / SW;
    g.fillStyle = '#070a13'; g.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => {
      const gr = g.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    };
    glow(0, -40, 900, 'rgba(58,80,255,0.46)');
    glow(1100, 20, 680, 'rgba(150,72,255,0.34)');
    glow(1100, 1120, 860, 'rgba(255,104,40,0.42)');
    glow(-20, 1120, 700, 'rgba(22,190,170,0.26)');
    // fine static grain so the gradients don't band after H.264
    const n = g.getImageData(0, 0, W, H), d = n.data;
    let s = 1234567;
    for (let i = 0; i < d.length; i += 4) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const v = ((s >>> 24) / 255 - 0.5) * 6;
      d[i] += v; d[i + 1] += v; d[i + 2] += v;
    }
    g.putImageData(n, 0, 0);
  }

  // ------------------------------------------------------------------ pages inside the lens
  // A page is a block in its own px; view {x, y, s} puts page point (x, y) at the lens's top-left at scale s.
  const P = {}, PL = [];
  function addPage(name, w, s) {
    const wrap = document.createElement('div'); wrap.className = 'pgw pgw-' + name;
    const el = document.createElement('div'); el.className = 'pg'; el.style.width = w + 'px';
    wrap.appendChild(el); lens.insertBefore(wrap, sweepEl);
    const pg = { name, wrap, el, w, view: { x: 0, y: 0, s }, idx: PL.length };
    P[name] = pg; PL.push(pg);
    return pg;
  }
  function mount(pg, opts) {
    const host = document.createElement('div');
    pg.el.appendChild(host);
    pg.root = host;
    pg.handle = window.pgprism.renderPlan(host, PLAN, Object.assign({ theme: 'dark', useShadow: false }, opts));
  }
  // rect of el in the page's own px (pages are at identity while this runs)
  function rectIn(pg, el) {
    const a = pg.el.getBoundingClientRect(), r = el.getBoundingClientRect(), k = stageScale;
    return { x: (r.left - a.left) / k, y: (r.top - a.top) / k, w: r.width / k, h: r.height / k };
  }
  const mid = (r, fx = 0.5, fy = 0.5) => ({ x: r.x + r.w * fx, y: r.y + r.h * fy });
  const union = (a, b) => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
  // view that puts rect r at fraction (ax, ay) of the lens at scale s
  function viewOn(pg, r, s, ax = 0.5, ay = 0.5) {
    const vw = CARD.w / s, vh = CARD.h / s;
    const x = clamp(r.x + r.w / 2 - vw * ax, 0, Math.max(0, pg.w - vw));
    const y = Math.max(0, r.y + r.h / 2 - vh * ay);
    return { x, y, s };
  }
  const toStage = (v, pt) => ({ x: CARD.x + (pt.x - v.x) * v.s, y: CARD.y + (pt.y - v.y) * v.s });
  function ring(pg, r, pad = 3, cls = '') {
    const d = document.createElement('i');
    d.className = 'ring ' + cls;
    Object.assign(d.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px' });
    pg.el.appendChild(d);
    gsap.set(d, { autoAlpha: 0 });
    return d;
  }
  const byText = (root, sel, text) => $$(sel, root).find((x) => x.textContent.trim() === text);
  const rowOf = (root, label) => { const el = $$('*', root).find((x) => x.children.length === 0 && x.textContent.trim() === label); return el ? el.parentElement : null; };

  // ------------------------------------------------------------------ build: raw text, component states, setup file
  function buildRaw() {
    const pg = addPage('RAW', 480, S0);
    const width = 84, title = 'QUERY PLAN';
    const head = ' '.repeat(Math.floor((66 - title.length) / 2)) + title;
    pg.el.innerHTML = `<pre class="raw"><span class="hd">${head}</span>\n<span class="dim">${'-'.repeat(width)}</span>\n${PLAN.split('\n').map((l) => ' ' + esc(l)).join('\n')}</pre>`;
  }

  // The same component inside four kinds of page (mock sites; the embedded block is the real library).
  const HOSTS = [
    { cls: 'h-blog', theme: 'light', url: 'blog.acme.dev/737-mib-for-one-row',
      head: '<div class="h-kick">Acme Engineering</div><h3>737&nbsp;MiB to find one row</h3><p class="h-meta">Nov 24, 2026 · 6 min read</p>' },
    { cls: 'h-docs', theme: 'dark', url: 'docs.acme.dev/runbooks/slow-queries',
      head: '<div class="h-kick">Runbooks <i>›</i> Slow queries</div><h3>Step 3: read the plan</h3><p class="h-meta">Start with buffers, then the findings.</p>' },
    { cls: 'h-dash', theme: 'dark', url: 'ops.acme.dev/query-insights',
      head: '<div class="h-kick">Query insights</div><div class="h-tiles"><div><span>p95 latency</span><b>391 ms</b></div><div><span>Buffers per call</span><b>737 MiB</b></div><div><span>Findings</span><b>9</b></div></div>' },
    { cls: 'h-report', theme: 'light', url: 'reports/postmortem-2026-11-24.html',
      head: '<div class="h-kick">Postmortem · 2026-11-24</div><h3>Query latency regression</h3><p class="h-meta">Root cause: three seq scans, 737 MiB read</p>' },
  ];
  const HP = [];
  function buildHosts() {
    HOSTS.forEach((h, i) => {
      const pg = addPage('H' + (i + 1), 504, CARD.w / 504);
      pg.el.innerHTML = `<div class="host ${h.cls}"><div class="h-bar"><i></i><i></i><i></i><span class="h-url">${h.url}</span></div>`
        + `<div class="h-body">${h.head}<div class="h-embed"><span class="h-tag">&lt;pg-plan&gt;</span><div class="h-mount"></div></div></div></div>`;
      pg.root = $('.h-mount', pg.el);
      pg.handle = window.pgprism.renderPlan(pg.root, PLAN, { theme: h.theme, useShadow: false, view: 'table', showToolbar: false, showDiagnostics: false });
      pg.tag = $('.h-tag', pg.el);
      HP.push(pg);
    });
  }

  let n37El = null;
  function buildNums() {
    const pg = addPage('N', 1008, 1);
    pg.el.innerHTML = '<div class="nums">'
      + '<div class="nrow n1"><b>0</b><div><p class="l1">dependencies</p><p class="l2">nothing else to install</p></div></div>'
      + '<div class="nrow n2"><b><span id="n37">37</span><u>KiB</u></b><div><p class="l1">gzipped</p><p class="l2">one file, styles included</p></div></div>'
      + '<div class="nrow n3"><b>1</b><div><p class="l1">script tag</p><p class="l2">or <code>&lt;pg-plan&gt;</code>, or npm</p></div></div>'
      + '</div>';
    n37El = $('#n37', pg.el);
  }

  const SETUP_KEYS = [];        // keystrokes of the three typed lines
  let setupCaret, setupLines = [], typeTimes = [];
  function buildSetup() {
    const pg = addPage('S', 1008, 1);
    const tok = (cls, s) => `<span class="t-${cls}">${esc(s)}</span>`;
    const typed = [
      [['p', '<'], ['tag', 'script']],
      [['attr', 'src'], ['p', '='], ['str', '"https://pgprism.dev/pgprism.iife.js"']],
      [['attr', 'data-auto-attach'], ['p', '>'], ['p', '</'], ['tag', 'script'], ['p', '>']],
    ];
    const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
    const plan = PLAN.split('\n').slice(0, 7).map((l) => cut(l, 44));
    let html = '';
    typed.forEach((toks, li) => {
      const chars = toks.map(([cls, s]) => Array.from(s).map((ch) => `<span class="t-${cls} tc">${esc(ch)}</span>`).join('')).join('');
      html += `<span class="ln typed hot" data-li="${li}">${li ? '  ' : ''}${chars}</span>`;
    });
    html += `<span class="ln"> </span>`;
    html += `<span class="ln">${tok('p', '<')}${tok('tag', 'pre')}${tok('p', '>')}</span>`;
    html += plan.map((l) => `<span class="ln"><span class="t-plan">${esc(l) || ' '}</span></span>`).join('');
    pg.el.innerHTML = `<div class="code"><div class="tabbar"><i class="r"></i><i class="y"></i><i class="g"></i><b>report.html</b></div><div class="body">${html}</div></div>`;
    setupLines = $$('.ln.typed', pg.el);
    setupCaret = document.createElement('i'); setupCaret.className = 'caret';
    setupLines.forEach((ln, li) => {
      if (li) SETUP_KEYS.push({ nl: ln });
      for (const ch of $$('.tc', ln)) SETUP_KEYS.push({ el: ch, ch: ch.textContent });
    });
    // human-ish, deterministic keystroke times, normalised to 0..1
    let s = 42, acc = 0;
    const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
    typeTimes = SETUP_KEYS.map((k, i) => {
      let dt = 0.7 + rnd() * 0.75;
      if (k.nl) dt += 2.4;
      else if ('"=<'.includes(k.ch)) dt += 0.5;
      if (i > 14 && i < 50) dt *= 0.62;                 // the URL comes out in one run
      acc += dt;
      return acc;
    }).map((v) => v / acc);
  }
  function setTyped(p) {
    let n = 0;
    while (n < typeTimes.length && typeTimes[n] <= p) n++;
    if (p >= 1) n = SETUP_KEYS.length;
    let line = 0;
    SETUP_KEYS.forEach((k, i) => {
      const on = i < n;
      if (k.nl) { k.nl.style.display = on ? '' : 'none'; if (on) line++; } else k.el.style.display = on ? '' : 'none';
    });
    const ln = setupLines[line];
    if (setupCaret.parentNode !== ln || ln.lastChild !== setupCaret) ln.appendChild(setupCaret);
    setupLines.forEach((l, i) => l.classList.toggle('hot', i === line || p >= 1));
    return n;
  }

  function buildClip() {
    const md = window.pgprism.formatForLLM(PLAN).split('\n');
    const end = md.findIndex((l) => l.startsWith('## Top relations'));
    const lines = md.slice(0, end > 0 ? end : 14).filter((l, i, a) => !(l === '' && a[i - 1] === '')).slice(0, 9);
    const max = 58;
    $('#clip-body').innerHTML = lines.map((l) => {
      let t = esc(l.length > max ? l.slice(0, max - 1) + '…' : l);
      if (/^#/.test(l)) return `<span class="cl h">${t}</span>`;
      t = t.replace(/\[HIGH\]/, '<span class="hi">[HIGH]</span>').replace(/\[MED\]/, '<span class="md">[MED]</span>')
        .replace(/`([^`]*)(`|…$)/g, '<span class="c">`$1$2</span>');
      return `<span class="cl">${t || ' '}</span>`;
    }).join('');
  }

  const CAPS = [
    { id: 'c0', lines: ['EXPLAIN plans,', '<em class="spec">refracted.</em>'] },
    { id: 'cE', lines: ['Embed it anywhere.', '<span class="swap"><b>Blogs.</b><b>Docs.</b><b>Dashboards.</b><b>Reports.</b></span>'] },
    { id: 'cT', lines: ['<em>Tiny</em> by design.'], sub: 'No framework. No build step. No backend.' },
    { id: 'c1', lines: ['<em>BUFFERS</em> first.'], sub: 'I/O as real sizes: KiB, MiB, GiB.' },
    { id: 'c2', lines: ['Finds what’s wrong.'], sub: '9 findings in this plan. 6 are high.' },
    { id: 'c3', lines: ['Jump to the node.'], sub: 'Every finding links to its plan node.' },
    { id: 'c4', lines: ['<span class="w">Table.</span> <span class="w">Tree.</span> <span class="w">Flame.</span>'], sub: 'Text or JSON plans. Postgres 15–19.' },
    { id: 'c5', lines: ['Copy for <em>LLM.</em>'], sub: 'A Markdown brief for your coding agent.' },
    { id: 'c6', lines: ['<em>One</em> script tag.'], sub: 'Every <code>&lt;pre&gt;</code> plan on the page lights up.' },
  ];
  function buildCaps() {
    const host = $('#caps');
    for (const c of CAPS) {
      const el = document.createElement('div');
      el.className = 'cap'; el.id = c.id;
      el.innerHTML = `<h2 class="cap-h">${c.lines.map((l) => `<span class="ln"><span class="in">${l}</span></span>`).join('')}</h2>` + (c.sub ? `<p class="cap-s">${c.sub}</p>` : '');
      host.appendChild(el);
      const h = $('.cap-h', el);
      let fs = 88;
      while (fs > 56 && Math.max(...$$('.in', h).map((x) => x.getBoundingClientRect().width / stageScale)) > 988) { fs -= 2; h.style.fontSize = fs + 'px'; }
    }
  }

  // ------------------------------------------------------------------ per-frame state
  const state = { sw1: 0, sw2: 0, count: 1, typed: 0, copied: 0, curPg: 0, n37: 37 };
  const cur = { x: 240, y: 400, o: 0, k: 1 };
  let counters = [], copyLabel = null;
  let tl, D = 0;

  function applySweep(pg, p) {
    if (p <= 0 || p >= 1) { pg.wrap.style.clipPath = 'none'; return false; }
    const W = CARD.w, H = CARD.h, lean = 250;
    const x0 = -70 + (W + lean + 140) * p, xb = x0 - lean;
    pg.wrap.style.clipPath = `polygon(${x0.toFixed(2)}px 0px, ${W + 30}px 0px, ${W + 30}px ${H}px, ${xb.toFixed(2)}px ${H}px)`;
    sweepEl.style.transform = `translate(${x0.toFixed(2)}px, 0px) skewX(${(-Math.atan(lean / H) * 180 / Math.PI).toFixed(4)}deg)`;
    sweepEl.style.opacity = clamp(Math.min(p, 1 - p) * 14, 0, 1);
    return true;
  }

  function render(t) {
    for (const pg of PL) {
      const v = pg.view;
      pg.el.style.transform = `translate(${(-v.x * v.s).toFixed(3)}px, ${(-v.y * v.s).toFixed(3)}px) scale(${v.s.toFixed(5)})`;
    }
    // cursor rides on a page
    const cp = PL[Math.round(state.curPg)], cv = cp.view;
    cursorEl.style.transform = `translate(${(CARD.x + (cur.x - cv.x) * cv.s - 4.9).toFixed(2)}px, ${(CARD.y + (cur.y - cv.y) * cv.s - 4.1).toFixed(2)}px) scale(${cur.k})`;
    cursorEl.style.opacity = cur.o;
    // headline numbers count up when the plan renders
    for (const c of counters) {
      if (state.count >= 1) { c.node.nodeValue = c.full; continue; }
      let v = (c.value * state.count).toFixed(c.dec);
      if (c.comma) v = Number(v).toLocaleString('en-US', { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec });
      c.node.nodeValue = c.pre + v + c.post;
    }
    if (copyLabel) copyLabel.textContent = state.copied ? 'Copied' : 'Copy for LLM';
    if (n37El) n37El.textContent = String(Math.round(state.n37));
    // typing + caret
    setTyped(state.typed);
    const typing = state.typed > 0 && state.typed < 1;
    setupCaret.style.opacity = typing || mod(t, 1.06) < 0.56 ? 1 : 0;
    // refraction sweeps
    const a = applySweep(P.RAW, state.sw1), b = applySweep(P.S, state.sw2);
    if (!a && !b) sweepEl.style.opacity = 0;
  }
  function seek(t) {
    t = clamp(t, 0, D);
    tl.time(t, false);
    render(t);
  }

  // ------------------------------------------------------------------ timeline
  function buildTimeline() {
    const A = P.A, B = P.B, C = P.C, E = P.E, F = P.F, S = P.S, RAW = P.RAW, N = P.N;
    const tab = (pg, label) => byText(pg.root, '.pgp-toolbar [role="tablist"] .pgp-btn', label);

    // --- measure (pages at identity)
    const R = {};
    R.statBuf = rectIn(A, $$('.pgp-stat', A.root).find((x) => /^Buffers/.test(x.textContent.trim())));
    R.summary = rectIn(A, $('.pgp-summary', A.root));
    R.diag = rectIn(A, $('.pgp-diag', A.root));
    R.show = rectIn(A, $('.pgp-diag-head > span:last-child', A.root));
    R.aToolbar = rectIn(A, $('.pgp-toolbar', A.root));
    R.aTabTree = rectIn(A, tab(A, 'Tree'));
    const bRows = $$('.pgp-diag-row', B.root);
    R.bList = rectIn(B, $('.pgp-diag-list', B.root));
    const bPick = bRows.find((r) => /^Shared reads: 561 MiB/.test($('.pgp-diag-title', r).textContent.trim())) || bRows[0];
    R.bRow1 = rectIn(B, bPick);
    R.bTitle1 = rectIn(B, $('.pgp-diag-title', bPick));
    const bBtn1 = $('.pgp-btn', bPick);
    R.bBtn1 = rectIn(B, bBtn1);
    const cThs = $$('.pgp-table thead th', C.root), cRows = $$('.pgp-table tbody tr', C.root);
    R.cHead = rectIn(C, $('.pgp-table thead', C.root));
    R.cBufTh = rectIn(C, cThs[2]);
    const cHot = cRows.find((r) => HOT_NODE.test(r.textContent)) || cRows[0];
    R.cRow1 = rectIn(C, cHot);
    R.cBuf1 = rectIn(C, cHot.children[2]);
    R.cRowN = rectIn(C, cRows[cRows.length - 1]);
    const insp = $('.pgp-inspector', C.root);
    R.insp = rectIn(C, insp);
    const kv = (label) => { const l = $$('*', insp).find((x) => x.children.length === 0 && x.textContent.trim() === label); return { l, r: union(rectIn(C, l), rectIn(C, l.nextElementSibling)) }; };
    const est = kv('Self shared read');
    R.est = est.r;
    R.secRows = rectIn(C, est.l.closest('.pgp-insp-sec') || est.l.parentElement);
    R.eTabFlame = rectIn(E, tab(E, 'Flame'));
    const copyBtn = $('.pgp-toolbar .pgp-btn-action', F.root);
    R.copy = rectIn(F, copyBtn);
    copyLabel = $('span', copyBtn);
    window.__R = R;

    counters = $$('.pgp-stat-val', A.root).map((el) => {
      const node = Array.from(el.childNodes).find((n) => n.nodeType === 3 && /\d/.test(n.nodeValue));
      const m = node && node.nodeValue.match(/^(\s*)([\d,]*\.?\d+)([\s\S]*)$/);
      if (!m) return null;
      const dec = (m[2].split('.')[1] || '').length;
      return { node, full: node.nodeValue, pre: m[1], value: parseFloat(m[2].replace(/,/g, '')), dec, comma: m[2].includes(','), post: m[3] };
    }).filter(Boolean);

    // --- rings, pills
    const rg = {
      stat: ring(A, R.statBuf, 5),
      bufCol: ring(C, { x: R.cBufTh.x, y: R.cBufTh.y, w: R.cBufTh.w, h: R.cRowN.y + R.cRowN.h - R.cBufTh.y }, 0, 'soft'),
      row1: ring(B, { x: R.bRow1.x + 6, y: R.bRow1.y + 3, w: R.bRow1.w - 12, h: R.bRow1.h - 6 }, 0, 'soft'),
      est: ring(C, { x: R.est.x - 5, y: R.est.y - 2, w: R.est.w + 10, h: R.est.h + 4 }, 0, 'soft'),
    };
    const pill = (text, cls = '') => { const d = document.createElement('div'); d.className = 'pill ' + cls; d.textContent = text; $('#pills').appendChild(d); gsap.set(d, { autoAlpha: 0 }); return d; };

    // --- views
    const vTop = { x: 0, y: 0, s: S0 };
    const vStat = viewOn(A, R.statBuf, 3.7, 0.5, 0.44);
    const vBuf = { x: 0, y: R.cHead.y - 14, s: S0 };
    const vBufHot = { x: 0, y: Math.max(vBuf.y, R.cRow1.y + R.cRow1.h / 2 - (CARD.h / S0) * 0.6), s: S0 };
    const vDiag = { x: 0, y: R.diag.y - 64, s: S0 };
    const vList = { x: 0, y: R.bList.y - 44, s: S0 };
    const sI = CARD.w / (R.insp.w + 2);
    const vInsp0 = { x: R.insp.x - 1, y: R.insp.y - 2, s: sI };
    const vInsp1 = { x: R.insp.x - 1, y: R.est.y + R.est.h / 2 - (CARD.h / sI) * 0.56, s: sI };
    const vTabs = { x: 0, y: R.aToolbar.y - 12, s: S0 };

    // --- initial states
    gsap.set(PL.map((p) => p.wrap), { autoAlpha: 0 });
    gsap.set([A.wrap, RAW.wrap], { autoAlpha: 1 });
    RAW.wrap.style.zIndex = 3; S.wrap.style.zIndex = 3;
    gsap.set(clipEl, { autoAlpha: 0 });
    gsap.set('#end', { autoAlpha: 0 });
    gsap.set('.cap', { autoAlpha: 0 });
    gsap.set('#c0', { autoAlpha: 1 });
    Object.assign(B.view, vDiag); Object.assign(C.view, vBuf); Object.assign(E.view, vTabs); Object.assign(F.view, vTabs);

    tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    const marks = (window.__marks = {});
    const mark = (k, v) => { marks[k] = +v.toFixed(2); };

    const capIn = (id, at) => {
      const c = $('#' + id);
      tl.set(c, { autoAlpha: 1 }, at);
      tl.fromTo($$('.in', c), { yPercent: 118 }, { yPercent: 0, duration: 0.6, ease: 'power4.out', stagger: 0.09, immediateRender: false }, at);
      const s = $('.cap-s', c);
      if (s) tl.fromTo(s, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, at + 0.2);
    };
    const capOut = (id, at) => tl.to('#' + id, { autoAlpha: 0, y: -14, duration: 0.2, ease: 'power2.in' }, at);
    const nextCap = (from, to, at) => { capOut(from, at - 0.22); capIn(to, at); };
    const pgIn = (pg, at, dur = 0.34) => tl.fromTo(pg.wrap, { autoAlpha: 0, scale: 1.04 }, { autoAlpha: 1, scale: 1, duration: dur, ease: 'power3.out', immediateRender: false }, at);
    const pgOut = (pg, at, dur = 0.14) => tl.to(pg.wrap, { autoAlpha: 0, duration: dur, ease: 'power1.in' }, at);
    const swap = (a, b, at) => { tl.set(a.wrap, { autoAlpha: 0 }, at); tl.set(b.wrap, { autoAlpha: 1, scale: 1 }, at); };
    const camTo = (pg, v, at, dur = 0.85, ease = 'power3.inOut') => tl.to(pg.view, { x: v.x, y: v.y, s: v.s, duration: dur, ease }, at);
    const camSet = (pg, v, at) => tl.set(pg.view, { x: v.x, y: v.y, s: v.s }, at);
    const ringIn = (d, at) => tl.fromTo(d, { autoAlpha: 0, scale: 1.1 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'power3.out', immediateRender: false }, at);
    const ringOut = (d, at) => tl.to(d, { autoAlpha: 0, duration: 0.2, ease: 'power1.in' }, at);
    const moveTo = (pt, at, dur = 0.7, ease = 'power3.inOut') => tl.to(cur, { x: pt.x, y: pt.y, duration: dur, ease }, at);
    const curOn = (pg, pt, at) => { tl.set(state, { curPg: pg.idx }, at); tl.set(cur, { x: pt.x, y: pt.y }, at); tl.to(cur, { o: 1, duration: 0.2 }, at); };
    const curOff = (at) => tl.to(cur, { o: 0, duration: 0.18 }, at);
    const click = (at) => {
      tl.to(cur, { k: 0.82, duration: 0.07, ease: 'power1.in' }, at - 0.07);
      tl.to(cur, { k: 1, duration: 0.2, ease: 'power2.out' }, at);
      tl.fromTo('#ripple', { '--rs': 0.15, '--ro': 0.95 }, { '--rs': 1, '--ro': 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, at);
    };
    const hover = (el, at, props = { color: '#f4f6f9', borderColor: '#cbd5e1' }) => tl.set(el, props, at);

    // ===== 0. EXPLAIN plans, refracted. =====================================
    // Frame 0 is the cover (feeds use it as the thumbnail): both caption lines are up, the sweep is already
    // half-way across the card (rendered UI on the left, raw plan text on the right), and the numbers are final.
    // After a short hold the sweep finishes.
    let t = 0;
    const SW0 = 0.573, hold = 0.4, sweepDur = 1.1;
    tl.to(RAW.view, { y: 12, duration: hold + sweepDur, ease: 'none' }, 0);
    tl.fromTo(state, { sw1: SW0 }, { sw1: 1, duration: sweepDur, ease: 'power2.inOut' }, hold);
    tl.set(RAW.wrap, { autoAlpha: 0 }, hold + sweepDur);
    t = 2.2;

    // ===== 1. Embed it anywhere. ============================================
    // The same component slides through four kinds of page; the caption's second line names each.
    mark('embed', t);
    nextCap('c0', 'cE', t);
    const swapW = $$('#cE .swap b');
    gsap.set(swapW.slice(1), { yPercent: 115 });
    const slide = (a, b, at, dur = 0.6) => {
      tl.set(b.wrap, { autoAlpha: 1, scale: 1 }, at);
      tl.fromTo(b.wrap, { x: 1060 }, { x: 0, duration: dur, ease: 'power3.inOut', immediateRender: false }, at);
      tl.fromTo(a.wrap, { x: 0 }, { x: -1060, duration: dur, ease: 'power3.inOut', immediateRender: false }, at);
      tl.set(a.wrap, { autoAlpha: 0, x: 0 }, at + dur + 0.01);
    };
    const hostGap = 1.25;
    HP.forEach((h, i) => {
      const at = t + 0.05 + (i ? 0.2 + hostGap * i : 0);
      slide(i ? HP[i - 1] : A, h, at);
      if (i) {
        tl.to(swapW[i - 1], { yPercent: -115, duration: 0.5, ease: 'power3.inOut' }, at + 0.05);
        tl.fromTo(swapW[i], { yPercent: 115 }, { yPercent: 0, duration: 0.5, ease: 'power3.inOut', immediateRender: false }, at + 0.05);
      }
      tl.fromTo(h.tag, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.3 }, at + 0.45);
      tl.fromTo($$('.pgp-bar-fill', h.root), { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.6, stagger: 0.03, ease: 'power3.out' }, at + 0.4);
    });
    t += 0.25 + hostGap * 4;

    // ===== 2. Tiny by design. ===============================================
    mark('tiny', t);
    nextCap('cE', 'cT', t);
    pgOut(HP[HP.length - 1], t - 0.12);
    pgIn(N, t);
    tl.fromTo($$('.nrow', N.el), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.16, ease: 'power3.out' }, t + 0.05);
    tl.fromTo(state, { n37: 0 }, { n37: 37, duration: 0.8, ease: 'power2.out' }, t + 0.25);
    t += 2.5;

    // ===== 3. BUFFERS first. ================================================
    mark('buffers', t);
    nextCap('cT', 'c1', t);
    pgOut(N, t - 0.12);
    pgIn(A, t);
    camTo(A, vStat, t + 0.2, 0.85);
    ringIn(rg.stat, t + 0.85);
    let t2 = t + 1.9;
    ringOut(rg.stat, t2 - 0.3);
    pgOut(A, t2 - 0.12);
    pgIn(C, t2);
    tl.fromTo($$('.pgp-bar-fill', C.root), { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.7, stagger: 0.03, ease: 'power3.out' }, t2 + 0.15);
    ringIn(rg.bufCol, t2 + 0.45);
    camTo(C, vBufHot, t2 + 0.7, 0.8);
    const p1 = pill('76% in one node');
    const p1at = toStage(vBufHot, { x: R.cBuf1.x + R.cBuf1.w * 0.5, y: R.cBuf1.y + R.cBuf1.h });
    const p1w = p1.offsetWidth;
    gsap.set(p1, { x: p1at.x - p1w / 2, y: p1at.y + 20 });
    p1.style.setProperty('--px', (p1w / 2 - 10) + 'px');
    tl.fromTo(p1, { autoAlpha: 0, scale: 0.86, transformOrigin: '50% 0%' }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.8)', immediateRender: false }, t2 + 1.5);
    t = t2 + 2.7;

    // ===== 4. Finds what's wrong. ===========================================
    mark('findings', t);
    nextCap('c1', 'c2', t);
    tl.to(p1, { autoAlpha: 0, duration: 0.18 }, t - 0.3);
    ringOut(rg.bufCol, t - 0.3);
    pgOut(C, t - 0.12);
    camSet(A, vDiag, t - 0.1);
    pgIn(A, t);
    const showPt = mid(R.show, 0.5, 0.6);
    curOn(A, { x: showPt.x - 90, y: showPt.y + 190 }, t + 0.1);
    moveTo(showPt, t + 0.15, 0.75);
    let tc = t + 1.0;
    click(tc);
    swap(A, B, tc + 0.03);
    tl.set(state, { curPg: B.idx }, tc + 0.03);
    tl.fromTo(bRows, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.07, ease: 'power2.out' }, tc + 0.05);
    camTo(B, vList, tc + 0.3, 0.95);
    moveTo({ x: R.bBtn1.x + R.bBtn1.w * 0.5, y: R.bRow1.y + R.bRow1.h + 30 }, tc + 0.3, 0.9, 'power2.inOut');
    ringIn(rg.row1, tc + 1.15);
    t = tc + 2.5;

    // ===== 5. Jump to the node. =============================================
    mark('jump', t);
    nextCap('c2', 'c3', t);
    ringOut(rg.row1, t + 0.5);
    const btnPt = mid(R.bBtn1, 0.42, 0.6);
    moveTo(btnPt, t + 0.1, 0.6);
    hover(bBtn1, t + 0.6, { borderColor: '#ff7a33', color: '#f4f6f9' });
    tc = t + 0.9;
    click(tc);
    curOff(tc + 0.12);
    pgOut(B, tc + 0.1);
    camSet(C, vInsp0, tc);
    pgIn(C, tc + 0.16);
    camTo(C, vInsp1, tc + 0.8, 0.85, 'power3.inOut');
    ringIn(rg.est, tc + 1.6);
    t = tc + 2.8;

    // ===== 6. Table. Tree. Flame. ===========================================
    mark('views', t);
    nextCap('c3', 'c4', t);
    const words = $$('#c4 .w');
    const lit = (i, at) => tl.to(words[i], { color: '#f6f7f9', duration: 0.25 }, at);
    ringOut(rg.est, t - 0.3);
    pgOut(C, t - 0.12);
    camSet(A, vTabs, t - 0.1);
    pgIn(A, t);
    tl.fromTo($$('.pgp-bar-fill', A.root), { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.7, stagger: 0.03, ease: 'power3.out' }, t + 0.1);
    lit(0, t + 0.25);
    const treePt = mid(R.aTabTree, 0.5, 0.6);
    curOn(A, { x: treePt.x + 150, y: treePt.y + 170 }, t + 0.15);
    moveTo(treePt, t + 0.3, 0.65);
    hover(tab(A, 'Tree'), t + 0.86);
    tc = t + 1.08;
    click(tc);
    swap(A, E, tc + 0.03);
    tl.set(tab(A, 'Tree'), { clearProps: 'color,borderColor' }, tc + 0.04);
    tl.set(state, { curPg: E.idx }, tc + 0.03);
    lit(1, tc + 0.05);
    tl.fromTo($$('.pgp-tree-card', E.root), { autoAlpha: 0, x: -14 }, { autoAlpha: 1, x: 0, duration: 0.38, stagger: 0.06 }, tc + 0.04);
    tl.fromTo($$('.pgp-tree-bar-self, .pgp-tree-bar-child', E.root), { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.6, stagger: 0.02, ease: 'power3.out' }, tc + 0.2);
    const flamePt = mid(R.eTabFlame, 0.5, 0.6);
    moveTo({ x: flamePt.x + 60, y: flamePt.y + 120 }, tc + 0.25, 0.55, 'power2.inOut');
    moveTo(flamePt, tc + 0.86, 0.45);
    hover(tab(E, 'Flame'), tc + 1.24);
    tc = tc + 1.42;
    click(tc);
    swap(E, F, tc + 0.03);
    tl.set(state, { curPg: F.idx }, tc + 0.03);
    lit(2, tc + 0.05);
    tl.fromTo($$('.pgp-flame-row', F.root), { autoAlpha: 0, y: 7 }, { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.04 }, tc + 0.04);
    tl.fromTo($$('.pgp-flame-incl, .pgp-flame-excl', F.root), { scaleX: 0, transformOrigin: '0 50%' }, { scaleX: 1, duration: 0.8, stagger: 0.03, ease: 'power3.out' }, tc + 0.18);
    moveTo({ x: flamePt.x + 170, y: flamePt.y + 150 }, tc + 0.2, 0.7, 'power2.inOut');
    t = tc + 1.6;

    // ===== 7. Copy for LLM. =================================================
    mark('copy', t);
    nextCap('c4', 'c5', t);
    const copyPt = mid(R.copy, 0.4, 0.6);
    moveTo(copyPt, t + 0.1, 0.65);
    hover(copyBtn, t + 0.65, { borderColor: '#ff7a33', backgroundColor: 'rgba(255,122,51,0.16)' });
    tc = t + 0.92;
    click(tc);
    tl.set(state, { copied: 1 }, tc + 0.02);
    tl.fromTo(clipEl, { y: 90 }, { y: 0, duration: 0.5, ease: 'power3.out', immediateRender: false }, tc + 0.14);
    tl.fromTo(clipEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12, ease: 'none', immediateRender: false }, tc + 0.14);
    tl.fromTo('#clip-body .cl', { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.3, stagger: 0.055 }, tc + 0.3);
    curOff(tc + 0.5);
    t = tc + 2.25;

    // ===== 8. How to set it up: one script tag, and the page lights up. ====
    mark('setup', t);
    nextCap('c5', 'c6', t);
    tl.to(clipEl, { autoAlpha: 0, y: 40, duration: 0.2, ease: 'power1.in' }, t - 0.26);
    pgOut(F, t - 0.14);
    pgIn(S, t);
    const typeStart = t + 0.4, typeDur = 2.0;
    tl.fromTo(state, { typed: 0 }, { typed: 1, duration: typeDur, ease: 'none' }, typeStart);
    const tEnd = typeStart + typeDur;
    tl.to(setupLines, { backgroundColor: 'rgba(255,122,51,0.22)', duration: 0.18 }, tEnd + 0.1);
    tl.to(setupLines, { backgroundColor: 'rgba(255,255,255,0.04)', duration: 0.5, ease: 'power2.inOut' }, tEnd + 0.36);
    const ts = tEnd + 0.6;
    mark('use', ts);
    camSet(A, vTop, ts - 0.1);
    tl.set(A.wrap, { autoAlpha: 1, scale: 1 }, ts - 0.05);
    tl.fromTo(state, { sw2: 0 }, { sw2: 1, duration: 1.3, ease: 'power2.inOut', immediateRender: false }, ts);
    tl.set(S.wrap, { autoAlpha: 0 }, ts + 1.3);
    tl.fromTo(state, { count: 0 }, { count: 1, duration: 1.0, ease: 'power3.out', immediateRender: false }, ts + 0.4);
    t = ts + 2.3;

    // ===== 9. where to get it ==============================================
    mark('end', t);
    tl.to(['#card', '#caps', '#brand'], { autoAlpha: 0, duration: 0.28, ease: 'power1.in' }, t - 0.3);
    tl.set('#end', { autoAlpha: 1 }, t - 0.02);
    tl.fromTo('#end > *', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power3.out' }, t);
    tl.fromTo('.end-url', { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'back.out(1.6)' }, t + 0.24);
    t += 3.0;

    D = Math.round(t * FPS) / FPS;
    mark('duration', D);
    tl.set({}, {}, D);
  }

  // ------------------------------------------------------------------ boot
  async function boot() {
    if (!CAPTURE) document.body.classList.add('dev');
    fitStage();
    addEventListener('resize', fitStage);
    await Promise.all([
      document.fonts.load('400 14px "JetBrains Mono"'), document.fonts.load('500 14px "JetBrains Mono"'),
      document.fonts.load('600 14px "JetBrains Mono"'), document.fonts.load('700 14px "JetBrains Mono"'),
      document.fonts.load('800 60px "Inter"'), document.fonts.load('700 30px "Inter"'), document.fonts.load('500 16px "Inter"'),
    ]);
    await document.fonts.ready;
    drawBg();
    buildCaps();
    mount(addPage('A', 480, S0), { view: 'table' });
    mount(addPage('B', 480, S0), { view: 'table' });
    mount(addPage('C', 820, S0), { view: 'table' });
    mount(addPage('E', 480, S0), { view: 'tree' });
    mount(addPage('F', 480, S0), { view: 'flame' });
    buildHosts();
    buildNums();
    buildSetup();
    buildRaw();
    buildClip();
    await raf2();
    $('.pgp-diag-head', P.B.root).click();                       // B: findings expanded
    const cTrs = $$('.pgp-table tbody tr', P.C.root);
    (cTrs.find((r) => HOT_NODE.test(r.textContent)) || cTrs[0]).click();   // C: the hot node selected, inspector open
    await raf2();
    scrollTo(0, 0);
    buildTimeline();
    window.__film.duration = D;
    seek(0);
    if (!CAPTURE) devPlayer();
  }

  function devPlayer() {
    const scrub = $('#dev-scrub'), btn = $('#dev-play'), lbl = $('#dev-time');
    let playing = !qs.has('t'), t0 = performance.now(), base = parseFloat(qs.get('t') || '0');
    scrub.max = D;
    const show = (t) => { seek(t); scrub.value = t; lbl.textContent = t.toFixed(2) + ' / ' + D.toFixed(2) + ' s'; };
    const loop = (now) => { if (playing) show(mod(base + (now - t0) / 1000, D)); requestAnimationFrame(loop); };
    btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'pause' : 'play'; base = parseFloat(scrub.value); t0 = performance.now(); };
    scrub.oninput = () => { playing = false; btn.textContent = 'play'; show(parseFloat(scrub.value)); };
    if (!playing) { btn.textContent = 'play'; show(base); }
    requestAnimationFrame(loop);
  }

  window.__film = { fps: FPS, duration: 0, seek, ready: null };
  window.__film.ready = boot();
})();
