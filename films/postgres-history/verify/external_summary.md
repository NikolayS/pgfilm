# External-evidence verification summary

Scope: claims requiring evidence outside the Postgres git repo (repo-verifiable claims handled by a separate agent). Full citations, exact quotes, and proposed fixes are in `external_citations.json`.

## Counts by verdict

- ACCURATE: 15 (#1, #4, #6, #8, #9, #15, #19, #21, #36, #37, #41, #44, #45, #48, #57, #64) — 16 actually, see list below
- IMPRECISE: 5 (#3, #20, #42, #47, #65)
- INACCURATE: 2 (#13, #53)
- UNSUPPORTED: 1 (#5)

(Total items assessed: 24 — one claim, #52, is counted under ACCURATE.)

Full ACCURATE list: #1, #4, #6, #8, #9, #15, #19, #21, #36, #37, #41, #44, #45, #48, #52, #57, #64 (17 items)
IMPRECISE: #3, #20, #42, #47, #65 (5 items)
INACCURATE: #13, #53 (2 items)
UNSUPPORTED: #5 (1 item)

## Every non-ACCURATE item, with the exact fix

**#3 — "Information Retrieval" section heading (IMPRECISE).** It's the CACM subject *department* label (edited by P. Baxendale) printed above the title, not a section inside Codd's paper's own outline. Fix: caption it "CACM department: Information Retrieval" or drop the label.

**#5 — supplier/part/project/quantity relation as Codd's Fig. 1 (UNSUPPORTED).** Could not confirm from a readable extraction of the 1970 paper that this specific 4-attribute "supply" relation is literally Fig. 1. This pairing is closely associated with Codd/Date teaching material and System R, but wasn't independently pinned to the 1970 CACM paper itself in this pass (PDF text extraction failed twice). Fix: verify against the actual paper figure before airing, or caption the example as "illustrative, not verbatim from the paper."

**#13 — POSTQUEL time-travel syntax `retrieve (e.salary) from e in emp["1985"]` (INACCURATE).** Real POSTQUEL bracket-qualifies the relation reference directly, e.g. `retrieve (EMP.salary) from EMP [T] where EMP.name = "Sam"` — it doesn't use a `from e in emp[...]` construction (that mixes in an idiom POSTQUEL didn't use this way). The later SQL-era Postgres time-travel syntax (v6.x) was `SELECT ... FROM cities['epoch','now'] WHERE ...`, single-quoted bounds, not `["1985"]`. Fix: use `retrieve (EMP.salary) from EMP[T] where EMP.name = "Sam"`-style syntax, or clearly label the shown syntax as illustrative/simplified.

**#20 — "elephants remember" attributed with Yang's exact 1997 wording (IMPRECISE).** Yang's actual line (per the official PostgreSQL wiki) is "elephants can remember" (Agatha Christie reference), not "elephants never forget." The fuller "big, strong, reliable, and never forgets" phrasing is from a different, later (1998) contributor, Dan Delaney — don't merge the two quotes/dates. Fix: if quoting directly, use "elephants can remember," 1997, Yang.

**#42 — "thousands" of extensions (IMPRECISE).** Best documented total (PGXN maintainer David Wheeler, May 2025) is ~1,000–1,200 known extensions across all registries, with PGXN itself hosting ~390–400. "Thousands" (2,000+) isn't supported. Fix: "over a thousand of them" or similar.

**#47 — SO 2025 "most admired / most desired / most used" (IMPRECISE).** Confirmed "most used" (58.2% vs MySQL 39.6%). Could not re-confirm "most admired" and "most desired" as separate superlatives in this pass (the fetched page surfaced used/want-to-use figures, not the admired/desired composite table). Fix: re-check the admired/desired chart on survey.stackoverflow.co/2025/technology directly before keeping all three superlatives on screen; "most used" is solid as-is.

**#53 — "First publicly known AI-written Postgres feature" (INACCURATE).** The source tweet poses this as a question — "1st time in @PostgreSQL?" — not an assertion. Presenting it as a flat superlative fact overclaims relative to the primary source, and no independent priority search was done to confirm it. Fix: hedge to match the source, e.g. "Possibly the first publicly disclosed AI-assisted Postgres commit — the author himself asked '1st time in Postgres?'"

**#65 — "The world's most advanced open source relational database" as "the tagline" (IMPRECISE).** postgresql.org's current page title / canonical tagline is "The world's most advanced open source database" (no "relational"). The longer "...relational database" wording does appear verbatim in live body copy elsewhere on the homepage (a PG19 testing call-to-action, checked Sept 26 2026), so it's not fabricated — just not the primary tagline. Fix: use the actual current title wording if calling it "the tagline," or caption the longer phrase as "wording used on postgresql.org" rather than "the tagline."

## Notable positive confirmations worth flagging to the team

- **#43 DB-Engines DBMS of the Year** — film's list (2017, 2018, 2020, 2023) is exactly right and complete for PostgreSQL. Important: 2024 went to **Snowflake**, not PostgreSQL, and DB-Engines has published **no "DBMS of the Year 2025" award** as of Sept 26 2026 (their most recent blog posts are Q1/Q3 2025 ranking roundups, not an annual award). Do not extend the on-screen list past 2023.
- **#15 "Postgres95 terminal monitor"** — verbatim confirmed in `src/bin/monitor/monitor.c` of the Postgres95 1.01 "virgin sources" commit (`d31084e9`): `"Welcome to the POSTGRES95 terminal monitor\n"`.
- **#52/#53 tweet** — full exact text recovered: *"Let me confess. I implemented this feature using by @AnthropicAI Claude Sonnet 3.7 a few months ago: [MR link]. It wasn't true "vibe coding", when you don't look at the code. I did look at the code, carefully. So I call this "vibe hacking". 1st time in @PostgreSQL?"* Posted 2025-05-30T00:21:19Z.
- **#64 hackers threads** — all five subjects and years check out against archived message IDs.
- **#45 pgvector v0.1.0** — tag commit dated 2021-04-20 via GitHub API.
- **#41 extensions** — all twelve named projects are real and independently confirmed on GitHub / their own sites.

## Access limitations encountered

- `dl.acm.org`, `amturing.acm.org`/`awards.acm.org`, and `dba.stackexchange.com` block automated fetching (403/Cloudflare). Substituted converging secondary sources (multiple independent PDF mirrors, CCC Blog's ACM press-release mirror) rather than leaving these unverified — flagged in each citation's notes.
- PDF text extraction failed for both Codd's 1970 paper and Stonebraker & Rowe's "Design of Postgres" ERL report (binary/compressed streams not decodable by the fetch tool), which is why #2 and #5 rest on secondary corroboration rather than a fresh direct-quote extraction. Recommend a human (or OCR-capable tool) spot-check of the actual PDF figures for #5 before air.
- `archives.postgresql.org/pgsql-hackers/1997-04/msg00094.php` (the primary Yang message) now 404s; relied on the PostgreSQL wiki's own quoted excerpt of that message plus a secondary retelling (LearnSQL) that agree.
