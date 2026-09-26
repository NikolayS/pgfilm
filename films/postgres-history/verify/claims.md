# On-screen factual claims — verification ledger

Status: UNVERIFIED unless marked. Evidence must be primary where possible (repo git history, release notes on REL_N_STABLE, postgresql.org docs/announcements, original papers, ACM).

| # | Scene | Claim as shown on screen | Evidence to check |
|---|---|---|---|
| 1 | codd | E. F. Codd, "A Relational Model of Data for Large Shared Data Banks" | CACM 13(6), June 1970, doi 10.1145/362384.362685 |
| 2 | codd | Codd at IBM San Jose (paper header "IBM Research Laboratory, San Jose, California") | paper header |
| 3 | codd | Section heading "Information Retrieval" on the paper | CACM section label |
| 4 | codd | Opening sentence "Future users of large data banks must be protected from having to know how the data is organized in the machine (the internal representation)…" | paper text, verbatim |
| 5 | relation | Supplier/part/project/quantity relation example (S1 P1 J1 200 …) | Codd 1970 Fig. 1 "supply (supplier part project quantity)" — values illustrative |
| 6 | ingres | Ingres at UC Berkeley, Stonebraker & Wong, 1973 | Ingres history |
| 7 | ingres | Sather Tower drawn as Berkeley landmark | — (illustration) |
| 8 | quel | QUEL was the Ingres query language; syntax `range of e is employee` / `retrieve (…) where …` | Ingres QUEL docs |
| 9 | post | "The Design of POSTGRES", Stonebraker & Rowe, SIGMOD 1986 | ACM DL |
| 10 | post | POSTGRES = "post-Ingres" | postgresql.org/docs/current/history.html |
| 11 | types | POSTGRES v1 released 1989 | history.html |
| 12 | types | POSTGRES featured extensible types, rules, no-overwrite storage, time travel | Stonebraker papers / history.html |
| 13 | types | Time-travel query syntax `retrieve (e.salary) from e in emp["1985"]` | POSTQUEL docs — syntax must be real or labeled illustrative |
| 14 | pg95 | Andrew Yu and Jolly Chen added SQL → Postgres95 (1994/1995) | history.html |
| 15 | pg95 | "Postgres95 terminal monitor" / `monitor` program | Postgres95 1.01 sources (src/bin/monitor) |
| 16 | release | First commit d31084e9, Marc G. Fournier, 1996-07-09, "Postgres95 1.01 Distribution - Virgin Sources" | repo git log |
| 17 | release | Chapter framing "then we set it free" 1996 | — |
| 18 | license | PostgreSQL License text quoted ("Permission to use, copy, modify, and distribute this software and its documentation for any purpose, without fee, and without a written agreement is hereby granted, provided that the above copyright notice and this paragraph and the following two paragraphs appear in all copies.") | COPYRIGHT file in repo, verbatim |
| 19 | license | "No company. No owner." | postgresql.org/about |
| 20 | slonik | Slonik = Russian for "little elephant"; mascot from 1997 | history of logo |
| 21 | slonik | "because elephants remember" (reason for the elephant) | David Yang 1997 proposal |
| 22 | tomlane | Tom Lane first commit 1998-10-01 | repo git log |
| 23 | tomlane | Tom Lane 16,871 commits | repo git log (as of checkout date) |
| 24 | tomlane | "One in every four commits in Postgres history" (16,871 / 65,196 = 25.9%) | arithmetic |
| 25 | tomlane | "Still committing" | recent commits by Tom Lane |
| 26 | mvcc | 6.5 introduced MVCC, 1999, Vadim Mikheev | release-6-5 notes |
| 27 | mvcc | "Readers never block writers" | MVCC docs (and writers don't block readers) |
| 28 | wal | 7.1 introduced WAL and TOAST, 2001 | release-7-1 notes |
| 29 | montage | 8.0 (2005): savepoints, PITR, native Windows | release-8-0 |
| 30 | montage | 8.1 (2005): autovacuum (integrated), two-phase commit | release-8-1 |
| 31 | montage | 8.3 (2008): HOT updates | release-8-3 |
| 32 | montage | 8.4 (2009): window functions, WITH RECURSIVE | release-8-4 |
| 33 | replicas | 9.0 (2010): streaming replication, hot standby | release-9-0 |
| 34 | json | 9.2 (2012) JSON type; 9.4 JSONB, December 2014 | release notes |
| 35 | json | JSONB operators shown: `->`, `->>`, `@>` | docs |
| 36 | turing | Michael Stonebraker, ACM A.M. Turing Award 2014 | amturing.acm.org |
| 37 | turing | "Its creator won the Turing Award" (Stonebraker created POSTGRES) | ACM citation |
| 38 | cloud | "Every cloud · every continent" | — framing |
| 39 | ten | 10 (2017): logical replication, declarative partitioning, SCRAM; version numbering changed after 9.6 | release-10 |
| 40 | montage2 | 12 generated columns (2019); 13 B-tree deduplication (2020); 14 pipeline mode (2021); 15 MERGE (2022); 16 logical decoding on standbys (2023); 17 incremental backup, JSON_TABLE (2024); 18 skip scan (2025) | release-N notes |
| 41 | platform | Extensions shown exist: postgis, pgvector, timescaledb, citus, pg_stat_statements, pg_cron, postgres_fdw, pg_trgm, pgaudit, pg_partman, hypopg, plpgsql | each project |
| 42 | platform | "CREATE EXTENSION · thousands of them" | count of known extensions (PGXN etc.) |
| 43 | awards | DB-Engines DBMS of the Year: 2017, 2018, 2020, 2023 | db-engines.com blog |
| 44 | vector | pgvector; `ORDER BY embedding <-> $1 LIMIT 5` | pgvector README |
| 45 | vector | year range 2021–2024 (pgvector first release 2021) | pgvector tags |
| 46 | branching | "Databases that branch like code · serverless · copy-on-write · instant clones" (2022–2025) | — framing, industry |
| 47 | survey | Stack Overflow 2025: most admired, most desired, most used | survey.stackoverflow.co/2025 |
| 48 | survey | PostgreSQL 58.2%, MySQL 39.6% — professional developers | SO 2025 primary data |
| 49 | agents | "AI agents · 2025 · still speaking SQL" | framing |
| 50 | aicode | PG18 pg_dump/pg_dumpall/pg_restore --no-policies; commit cd3c45125d2 (2025-03-16) | repo git log |
| 51 | aicode | Author Nikolay Samokhvalov, committed by Tom Lane | commit trailer / committer field |
| 52 | aicode | Code written by Claude (Sonnet 3.7) | author's public post 2025-05-29 |
| 53 | aicode | "First publicly known AI-written Postgres feature" | author's claim (posed as question) — needs hedge? |
| 54 | aicode | Help strings shown ("do not dump row security policies", "do not restore row level security policies") | pg_dump/pg_restore --help in 18 |
| 55 | aio | 18 (September 2025): asynchronous I/O, io_uring, UUIDv7 | release-18 / press kit |
| 56 | aio | `io_method = io_uring` GUC | docs |
| 57 | pg19 | 19 in beta, September 2026 | postgresql.org news |
| 58 | pg19 | PG19 features: REPACK CONCURRENTLY, sequence replication, WAIT FOR LSN, parallel autovacuum, pg_plan_advice | release-19.sgml |
| 59 | commits | 65,196 commits; since 1996-07-09; "thirty years" | repo git log |
| 60 | commits | per-year commit chart values | repo git log |
| 61 | people | Top-30 committers and counts (Tom Lane 16,871 … Stephen Frost 279) | repo git log (author field) |
| 62 | people | Pioneers: Codd, Stonebraker, Wong, Rowe; Postgres95: Yu, Chen; 1996 core: Fournier, Momjian, Lockhart, Mikheev | history.html |
| 63 | people | "+ thousands of contributors" | release-notes acknowledgments |
| 64 | future | Thread subjects and years: "Let's make PostgreSQL multi-threaded" (2023); "Add 64-bit XIDs into PostgreSQL 15" (2022); 'Asynchronous and "direct" IO support for PostgreSQL' (2021); "[Proposal] Table-level Transparent Data Encryption (TDE) and Key Management Service (KMS)" (2018); "Built-in connection pooler" (2019) | pgsql-hackers archives |
| 65 | end | "The world's most advanced open source relational database" | postgresql.org tagline |
| 66 | end | "1986 · 1996 · 2026" | POSTGRES paper / first commit / now |
| 67 | HUD | Chapter years / timeline markers per scene | derived from above |

## Verification outcome (2026-09-26)

Method: pgBSdetector citation format — repo claims pinned to commit SHA + path + line range + exact quote, each re-checked with `git show <sha>:<path>` (62/62 byte-exact matches); external claims quoted from primary pages (verify/external_citations.json). Details: verify/repo_summary.md, verify/external_summary.md.

Fixed after verification:
- #3 removed "Information Retrieval" (CACM department label, not part of the paper)
- #13 POSTQUEL time travel now the published form: `retrieve (EMP.salary) from EMP [T] where EMP.name = "Sam"`
- #15 Postgres95 monitor transcript now matches monitor.c in d31084e9 (`* ` prompt, `Go` on `;`); invented result table removed
- #20 Slonik quote now Yang's actual 1997 words: "elephants can remember"
- #42 "thousands of extensions" → "over a thousand"
- #47 "most admired / most desired" removed (not confirmable from primary data); only "most used" (58.2% vs 39.6%, SO 2025) kept
- #53 "first publicly known AI-written feature" → "AI-written, as disclosed by its author" (author's post poses "1st time?" as a question)
- #54 pg_restore help string corrected to released PG18 text: "do not restore row security policies"
- #62 "1996 core" → "first core team" (Lockhart's first commit is 1997-04-27)
- Neon statistic removed (vendor claim; also per request)
- Montage cards re-selected and each checked against upstream REL_N_STABLE release-N.sgml

Accepted with external source (not in repo): #10 post-Ingres naming, #14 Postgres95 1995, #65 tagline (postgresql.org homepage).
Accepted as illustrative (no factual claim on screen): #5 relation example, MVCC xmin/xmax values, WAL segment names, agent SQL, branch names.
Counts shown: 65,484 commits (upstream/master 3c5d9d914fa, 2026-09-26); Tom Lane 16,885 (25.8%); 1,532 people named in authorship/credit trailers.
