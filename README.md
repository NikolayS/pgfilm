# pgfilm

Procedurally generated short films about Postgres: every frame is drawn by code, the music is synthesized from the same beat grid, and every on-screen claim is verified against primary sources.

[![Postgres history: 1970 → 2026 — watch on YouTube](films/postgres-history/assets/poster.jpg)](https://youtu.be/WUmvqHlWx_4)

| Film | Length | Folder | Watch |
|---|---|---|---|
| Postgres history: 1970 → 2026 | 2:42 | [films/postgres-history](films/postgres-history) | [YouTube](https://youtu.be/WUmvqHlWx_4) · [on X](https://x.com/samokhvalov/status/2103920825581842567) · [on LinkedIn](https://www.linkedin.com/posts/samokhvalov_this-one-is-about-postgres-40-years-1986-ugcPost-7509685236369252353-XYly/) · [download](https://github.com/NikolayS/pgfilm/releases/tag/postgres-history-2026-09-26) |
| pgPrism launch | 0:37 | [films/pgprism-launch](films/pgprism-launch) | not posted yet |

Each film is self-contained in `films/<name>/` (source, audio, assets, verification ledger, QA notes). Rendered videos are attached to GitHub Releases (they exceed git's file-size limits).

## Making a new film

There are two ways to draw frames here:

- **Canvas** — a Node renderer draws every frame and a synthesized score follows the same beat grid. See [films/postgres-history](films/postgres-history).
- **HTML** — the film is a web page that shows real UI and draws any second on request; [tools/html-film](tools/html-film) screenshots it frame by frame in headless Chromium and encodes with ffmpeg (deterministic output, motion blur, contact sheets, posters, GIFs). It comes with a starter page. See [films/pgprism-launch](films/pgprism-launch) for a full example.

For social launch videos there is a Claude Code skill, [`launch-film`](.claude/skills/launch-film/SKILL.md): the brief to get first, design rules for phone feeds (one idea per beat, big captions, the first frame as the cover), public-only sample data, the review loop, and the checklist before publishing. Open this repository in Claude Code and ask for a launch video.

## License

Copyright 2026 Nikolay Samokhvalov and contributors.

Licensed under the [Apache License 2.0](LICENSE). This covers the project's original source code, documentation, and generated film and audio content. Third-party assets and dependencies retain their own licenses; see each film's README for asset credits.
