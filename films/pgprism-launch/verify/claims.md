# On-screen factual claims — verification ledger

Checked 2026-11-27 against pgPrism commit `651f5b9` (version `0.1.0-beta.1`), which is the build vendored in
`src/vendor/pgprism.iife.js` (byte-identical to `dist/pgprism.iife.js` at that commit and to the file served at
`https://pgprism.dev/pgprism.iife.js` on that day).

"script" in the last column means `node verify/check.mjs` re-derives the value from the vendored bundle and the
sample plan and fails the build when it no longer matches. Everything else was checked by hand and has to be
re-checked when the library or the film changes.

| # | Beat | Claim as shown on screen | Evidence | Checked by |
|---|---|---|---|---|
| 1 | all | The component in every shot is the real library drawing a real plan | `src/film.js` mounts `window.pgprism.renderPlan` on `src/data/plans.js`; nothing in the card is a mock-up | reading the source |
| 2 | all | The plan is public | `https://explain.depesz.com/s/Uto3s`, listed on the site's public history; tables `movie`, `casts`, `actor` are a teaching schema | script (link present); page opened by hand |
| 3 | hook, buffers | Buffers: 737 MiB | 94,380 blocks × 8 KiB = 737.3 MiB (`shared hit=76 read=94304`) | script |
| 4 | embed | "737 MiB to find one row" (blog page) | the root node returns `rows=1.00`; total as in 3 | script (total); plan text (rows) |
| 5 | embed | Tiles "391 ms", "737 MiB", "9" (dashboard page) | `Execution Time: 390.922 ms`; 3; 6 | script |
| 6 | embed | "Root cause: three seq scans, 737 MiB read" (report page) | three `Parallel Seq Scan` nodes read 94,304 of the 94,380 blocks | script (node count) |
| 7 | embed | The four host pages (`blog.acme.dev`, `docs.acme.dev`, `ops.acme.dev`, a report file) | invented for the film; no real site is shown | — (illustration) |
| 8 | tiny | 0 dependencies | `package.json` of pgPrism has no `dependencies` and no `peerDependencies` | by hand |
| 9 | tiny | 37 KiB gzipped | `gzip -9` of the vendored bundle: 37,870 bytes = 36.98 KiB | script |
| 10 | tiny | 1 script tag; "or `<pg-plan>`, or npm" | README quick start: script tag with auto-attach, `<pg-plan>` element, `npm install pgprism` | by hand |
| 11 | tiny | "No framework. No build step. No backend." | the bundle is one IIFE file with its styles inside; it runs in the page | by hand |
| 12 | buffers | "I/O as real sizes: KiB, MiB, GiB." | `formatBlocks` in the bundle; the Buffers column in the shot | script (737 MiB, 561 MiB) |
| 13 | buffers | Pill "76% in one node" | `Parallel Seq Scan on casts c` reads 71,792 of 94,380 blocks = 76.07% | script |
| 14 | findings | "9 findings in this plan. 6 are high." | `analyzePlan(...).diagnostics`: 9 entries, 6 with severity `high`, 3 `med` | script |
| 15 | findings, jump | Finding "Shared reads: 561 MiB" on the `casts` scan | 71,792 blocks × 8 KiB = 560.9 MiB; the finding's node is that scan | script |
| 16 | jump | "Every finding links to its plan node." | every diagnostic carries the `nodeId` of a node in the plan; the click in the film is a real click on the finding's node button | script |
| 17 | views | "Table. Tree. Flame." | real clicks on the component's view tabs | reading the source |
| 18 | views | "Text or JSON plans. Postgres 15–19." | README "Supported Postgres 15–19 features"; parser tests cover text and JSON | by hand |
| 19 | copy | The clipboard card is real `formatForLLM` output | `buildClip()` in `src/film.js` calls `pgprism.formatForLLM` on the same plan | reading the source |
| 20 | setup | `<script src="https://pgprism.dev/pgprism.iife.js" data-auto-attach></script>` turns a `<pre>` plan into the component | URL returned HTTP 200 (130,275 bytes) on 2026-11-27; the tag is the README's "zero-config auto-attach" mode, typed in full on screen | by hand |
| 21 | end card | `pgprism.dev`, `github.com/NikolayS/pgprism`, `npm install pgprism` | site and repository are live; npm has `pgprism@0.1.0-alpha.1` (the film shows the newer `0.1.0-beta.1` build) | by hand |
| 22 | end card | Chips: zero dependencies · 37 KiB gzip · Apache-2.0 · Postgres 15–19 | 8; 9; `LICENSE` and `package.json` say Apache-2.0; 18 | script (37 KiB); by hand |

Not a factual claim: the tagline "EXPLAIN plans, refracted." and the beat headlines.
