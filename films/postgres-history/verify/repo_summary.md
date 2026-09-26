# Postgres-history video — repo-verifiable claims report

Checkout: `~/github/postgres`, branch `master`, HEAD `1051099a9045fe4d6c81eeea33dcd24cd2ba7fd4` (2026-08-27).
Some evidence for versions not yet on `origin` (18, 19) was pulled from the `upstream` remote (`upstream/REL_18_STABLE`, `upstream/REL_19_STABLE`), which is checked out read-only exactly like `origin` — no branch was created or checked out.

Full machine-readable citations: `~/pgfilm/verify/repo_citations.json` (75 entries; some claims have multiple sub-citations, e.g. `12`, `12b`, `12c`, `12d`).

Every file-based citation was mechanically re-verified independently: `git show <commit_sha>:<path> | sed -n '<start>,<end>p'` and confirmed the `quote` is an exact substring. **62/62 file-based citations passed** on this second, independent pass (script re-run, zero mismatches). The remaining 13 entries are either commit-metadata citations (subject lines / author-committer fields, not file bodies) or derived `git log`/`git shortlog` counts, which were validated by re-running the exact commands quoted in each entry's `note`.

The internal pgBSdetector validator could not be run standalone (it needs its service bundle and policy config), so the same check it performs — re-reading each cited file at the pinned commit and byte-comparing the quote — was done directly with `git show`.

## Counts by verdict

| Verdict | Count |
|---|---|
| ACCURATE | 68 |
| IMPRECISE | 4 |
| UNSUPPORTED (by the repo) | 2 |
| INACCURATE | 1 |
| **Total** | **75** JSON rows covering ~41 distinct on-screen claims (several claims needed multiple sub-citations, e.g. `12`/`12b`/`12c`/`12d`, `40-*` per-version rows, `58-*` PG19 feature rows)

## Non-ACCURATE items — details and fixes

### #10 — "POSTGRES = post-Ingres" — **UNSUPPORTED (by the repo)**
`git grep -ni "post-ingres|post ingres|postingres"` across all of HEAD returns **zero hits**. `doc/src/sgml/history.sgml` never states this etymology; it only says PostgreSQL "is derived from the POSTGRES package written at UC Berkeley." This is true and well known, but it is **not repo-verifiable** — it needs a citation to `postgresql.org/docs/current/history.html` or a Stonebraker-era source instead. Keep the claim, change the citation from "repo" to "postgresql.org".

### #14 — "Andrew Yu and Jolly Chen added SQL → Postgres95 (1994/1995)" — **IMPRECISE**
`history.sgml` (HEAD, lines 100–107) confirms: *"In 1994, Andrew Yu and Jolly Chen added an SQL language interpreter to POSTGRES... Postgres95 was subsequently released..."* — the **1994** date is solid and repo-sourced. The **1995** Postgres95 public-release year is **not** verifiable from this repo: git history begins at commit `d31084e9` (1996-07-09), already labeled "Postgres95 1.01" — there is no earlier commit pinning a 1995 release date. Fix: keep "1994" as repo-cited; source "1995" externally (postgresql.org history page) if you keep both years on screen.

### #27 — "Readers never block writers" — **IMPRECISE**
`doc/src/sgml/mvcc.sgml` (HEAD, lines 61–62) says: *"...reading never blocks writing **and writing never blocks reading**."* — the guarantee is bidirectional; the on-screen text as drafted states only half of it. Fix: change to **"Readers never block writers, and writers never block readers."**

### #54 — pg_dump/pg_restore `--no-policies` help strings — **INACCURATE** (restore string)
Verified against `REL_18_0` (`3d6a828938a5fa0444275d3d2f67b64ec3199eb7`):
- `pg_dump.c:1313` → `"do not dump row security policies"` — matches claim, ACCURATE.
- `pg_restore.c:563` → `"do not restore row security policies"` — the claim's on-screen text says **"do not restore row *level* security policies"**, with an extra word "level" that isn't in the actual `--help` output. Fix: drop "level" — the restore string mirrors the dump string exactly, just "row security policies", not "row level security policies".

### #62 — "1996 core: Fournier, Momjian, Lockhart, Mikheev" — **IMPRECISE**
First-commit dates by author on HEAD:
- Marc G. Fournier: **1996-07-09** (the very first commit)
- Bruce Momjian: **1996-09-25**
- Vadim B. Mikheev: **1996-10-18**
- Thomas G. Lockhart: **1997-04-27**

Lockhart's first commit is in **1997**, not 1996 — about 7 months after the "1996 core" framing implies. All four are genuinely part of the earliest committer cohort (see the top-30 list, claim #61), so the individual names are fine; just don't pin "1996" specifically to Lockhart. Fix: say "1996–97 core team" or drop the year qualifier.

### #65 — "The world's most advanced open source relational database" — **UNSUPPORTED (by the repo)**
This exact tagline does **not** appear anywhere in the repo. Closest matches:
- `doc/src/sgml/history.sgml:17` — *"...PostgreSQL is now the most advanced open-source database available anywhere."* (missing "world's", "relational")
- `README.md` — *"PostgreSQL is an advanced object-relational database management system..."* (missing "world's", "most", "open source")

The familiar marketing tagline lives on postgresql.org, not in this repository. Fix: cite postgresql.org for this one, or swap in the repo's own wording.

## Notable ACCURATE findings worth flagging anyway

- **#16** (first commit): exact match — `d31084e9d1118b25fd16580d9d8c2924b5740dff`, Marc G. Fournier, `scrappy@hub.org`, 1996-07-09, "Postgres95 1.01 Distribution - Virgin Sources".
- **#22/#23/#25** (Tom Lane): first commit `502769d0de...` 1998-10-01 ("Change HPUX loader flags to trap null pointer derefs"); exactly **16,871** commits by `git shortlog -sn`; most recent commit `8aa49d34e9...` 2026-08-23 — still committing.
- **#51** (pg_dump `--no-policies` authorship): commit `cd3c45125d2d92e86ad7530b162562a23d063c26`, 2025-03-16. Git's `author`/`committer` metadata fields are both **Tom Lane** — this is normal Postgres practice (the committer applies the patch under their own git identity). The true author is credited in the **commit-message trailer**: `"Author: Nikolay Samokhvalov <nik@postgres.ai>"`. So "Author Nikolay Samokhvalov, committed by Tom Lane" is the correct community-standard reading — just be aware it relies on the message trailer, not the raw git author field, if anyone fact-checks by only looking at `git blame`/`git log --format=%an`.
- **#58** (`WAIT FOR LSN`): the SQL *command* is named `WAIT` (`doc/src/sgml/ref/wait.sgml`), but its literal syntax is `WAIT FOR LSN '<lsn>' [...]` — so "WAIT FOR LSN" as shown on screen is accurate as a syntax fragment, not a command name; no fix needed, just don't call it "the WAIT FOR LSN command" if precision matters (it's "the WAIT command").
- **#57/#58** (PG19): confirmed via `upstream/REL_19_STABLE` tip `b73d13c32c834a2c8e1c60cb92f79530376cedf1` ("Stamp 19beta4.", 2026-09-21) and `doc/src/sgml/release-19.sgml` — REPACK (+ CONCURRENTLY), sequence replication, WAIT FOR LSN, parallel autovacuum, pg_plan_advice all present.
- **#59/#60/#61** (commit counts): `git log --oneline | wc -l` on HEAD = **65196**; per-year breakdown captured in the JSON (`claim_id: 60`) as ground truth for the chart — the ledger didn't specify exact on-screen numbers, so whoever builds the chart should match this table (or recompute at final HEAD before render); top-30 `git shortlog -sn` list matches the claimed list exactly, endpoints Tom Lane 16,871 / Stephen Frost 279.

## #15 — Postgres95 "terminal monitor" / `monitor` program — **ACCURATE** (bonus, not on the required list but easy to pin)
`src/bin/monitor/monitor.c` is present in the very first commit `d31084e9` (1996-07-09), header comment: *"POSTGRES Terminal Monitor"*. Current `history.sgml` (HEAD, lines 135–140) also confirms psql *"largely superseded the old `monitor` program."*

## Claims not covered here (out of repo scope, no action taken)
#1–9, #13 (POSTQUEL time-travel syntax predates this git history entirely — Berkeley POSTGRES code isn't in this repository, only Postgres95-onward), #17, #19–21, #35–38, #41–49, #52–53, #63–64, #66–67. These rely on external docs, papers, or non-repo sources per the ledger's own evidence column, or weren't in the explicit repo-verifiable list — flag if you want any of them pulled from the repo too.
