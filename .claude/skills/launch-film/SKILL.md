---
name: launch-film
description: Make a short social launch video (X, LinkedIn, a README GIF) for a product, library or feature as a deterministic HTML film rendered to MP4 with tools/html-film. Use this whenever someone asks for a launch video, promo clip, product demo video, teaser, social video or animated README GIF, wants a film like the pgPrism one for another project, or wants to re-cut, re-render or change the first frame, captions or sample data of a film under films/, even if they only say "make a video for <repo>".
---

# Launch film

A launch film here is a web page: it shows the real product, drives it with real clicks, and draws any second
`t` on request. `tools/html-film` turns that page into an MP4. The result is 20–40 seconds, square, silent, and
readable on a phone.

This skill lives in the pgfilm repository (github.com/NikolayS/pgfilm). Paths below are relative to its root; if
you are not in a checkout, clone it first.

- `tools/html-film/` — renderer, stills, contact sheets, GIF, preview server, starter page. Read its `README.md`
  for the page contract and every command.
- `films/pgprism-launch/` — a complete film made with this workflow. Read its `README.md` and `src/film.js`
  before building a new one; most of what you need is a pattern there.

Films drawn on a canvas with a synthesized score (`films/postgres-history`) are a different pipeline. Use this
one when the point is to show real UI.

## 1. Get the brief before designing anything

A film that looks good but misses what the owner cares about gets rejected, and each re-cut costs hours. Settle
these first, asking the owner where the repository does not answer:

- **What it is, in one line**, and who it is for.
- **The three to five key properties, in the owner's words.** Ask specifically what makes it easy to adopt
  (embeds anywhere, tiny, zero dependencies, one command). Those properties are often the real pitch and are
  easy to leave out, because they are not features you can click on. Each one needs its own beat.
- **Where it will be posted.** X and LinkedIn feeds mean square, muted autoplay and phone screens.
- **Reference videos.** If the owner names an account or a video, study it yourself: download it, extract frames
  at full size, look at them, and read the text of the posts. Write down how many things are on screen, how big
  the text is relative to the frame, how long it runs, how it opens and how it ends. A summary from someone else
  plus thumbnail-sized contact sheets is not enough; that mistake produced a quiet product walkthrough where the
  reference was three huge words over one object.
- **What data it will show** (see section 3).

## 2. Design for a phone in a feed

Taste for dense web pages does not transfer. Judge every frame at the size of a phone screen.

- **Square, 1080x1080 stage.** It fills the feed on both X and LinkedIn. Other shapes only on request.
- **One idea per beat.** A beat is a huge caption plus one close-up. Headline at least 80 px on the 1080 px
  stage, sub-caption at least 34 px, and UI text in the close-up at least about 24 px, which usually means
  drawing the product at twice its natural size or more. Smaller text is unreadable on a phone.
- **Show the real product drawing real data,** not a mock-up. Mount the actual component, click its actual
  buttons.
- **Point at what the caption names** with a ring, a pill or a lit word. Viewers do not search a frame.
- **Few objects.** A brand row, a caption, one card. If a frame needs explaining, it has too much in it.
- **Frame 0 is the cover.** Feeds show it as the thumbnail before anyone presses play, so frame 0 must already
  be the best-looking frame: name, tagline, the product in colour, numbers at their final values. No fade from
  black and no plain-text opening. If the hook is a reveal, start the film in the middle of it.
- **Silent by default.** Feeds autoplay muted; every beat has to work without sound.
- **Order:** what it is → why it is easy to adopt → what it does (three to five beats) → how to set it up →
  end card with name, URL, install command and a few fact chips. Setup goes last: nobody wants instructions
  before they want the thing.
- **20 to 40 seconds.** Leave each caption on screen long enough to read twice (about 2 s for a short one).
- **Every number on screen is a fact about the data shown.** "9 findings", "76% in one node", "37 KiB" must be
  re-derivable (section 6).

## 3. Sample data must already be public

Whatever the film shows ends up in a public repository, a video and a GIF, and cannot be pulled back.

- Check where a sample came from before building on it. Real-looking identifiers (odd table or function names,
  UUIDs, query IDs, hostnames, local paths) mean it came from someone's real system.
- A sample from internal or client work is replaced with a public one, not renamed: structure and numbers still
  identify it, and a rename has to be repeated across fixtures, screenshots, GIFs and old renders.
- For Postgres plans, `https://explain.depesz.com/history` lists plans people published. Most still show
  somebody's real schema, so take only plans on teaching or benchmark schemas (IMDB-style `movie`/`actor`,
  pgbench, TPC-H, Pagila) or on synthetic tables (`t1`, `t2`). Keep the source URL next to the sample and show
  it in the film's README.
- Mock host pages use invented names (`acme.dev`).

## 4. Build the page

Scaffold `films/<name>/` like `films/pgprism-launch/`: `package.json`, `src/index.html`, `src/fonts.css`,
`build.sh`, `verify/`, `README.md`. The `package.json` is required even when it lists nothing: the renderer serves
the nearest folder above the page that has one. Fonts and any animation library go in it as npm dependencies and
are never committed. Start from `tools/html-film/template/index.html` for something simple, or copy the reference
film when you need a camera over a live component. The template uses system fonts to stay dependency-free; a
real film replaces them with bundled webfonts (see `src/fonts.css` in the reference film), or the output changes
from machine to machine.

The contract is `window.__film = { fps, duration, ready, seek(t) }` and one rule: everything visible is a pure
function of `t`. The renderer seeks in any order from several browsers, so CSS transitions, timers, wall-clock
time and unseeded randomness all produce broken frames. With GSAP, build one paused timeline and call
`tl.time(t)`.

Patterns worth copying from `films/pgprism-launch/src/film.js`:

- **A fixed stage and a card.** The stage is always 1080x1080 CSS px; the card is a window onto "pages", each
  with its own camera `{x, y, s}`.
- **One real instance per UI state.** A component that repaints itself on click cannot be scrubbed backwards.
  Mount one instance per state (list, panel open, row selected, other view) at load time and cut between them
  at the moment of the click.
- **Measure, do not hard-code.** Camera targets and ring positions come from `getBoundingClientRect()` of the
  element the caption names, taken after fonts load. They survive a new build of the product.
- **Beat marks.** Record each beat's start time while building the timeline (`window.__marks`); stills and
  reviews are addressed by those times.
- **A probe page** (`src/probe.html`) that renders one instance at a given width and state and reports element
  boxes makes framing work fast.

Things that have gone wrong before:

- Media queries follow the viewport, not the card, so a component's phone layout does not apply inside the film.
- A component mounted without Shadow DOM inherits film CSS. Check the component's unprefixed class names before
  naming your own (a film rule called `.num` once restyled the product).
- Large soft gradients band after H.264. Draw the background on a canvas with a little static grain.
- A missing font silently becomes a fallback. Use `font-display: block`, load each weight in `ready`, and keep
  the font files in npm packages.
- The renderer aborts on any `console.error`, failed request or HTTP error. Fix the cause; do not silence it.

## 5. Review loop

This is most of the work. After each change, look before you render.

```bash
cd films/<name>; T=../../tools/html-film      # once: npm ci here and in $T
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --scale 0.5 --every 1 --sheet --out build/review
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --t <beat times> --out build/stills
node $T/render.mjs --page src/index.html --width 1080 --height 1080 --out build/draft.mp4     # draft, no motion blur
```

- Open the contact sheet, then one full-size still per beat. Look at them yourself.
- Phone test: view a still scaled down to about 360 px wide. Can you read the caption? Can you tell what is
  highlighted? If not, the beat is not done.
- Look at frame 0 on its own, as a thumbnail.
- Tick every key property from the brief against a beat. A property with no beat is a missing beat.
- Then render the draft (about a minute for 40 s of film) and watch the timing.
- Show the owner a draft early. The 1080 file is small enough to send; 2160 masters usually are not.

## 6. Keep a ledger of on-screen claims

Write `verify/claims.md`: one row per factual claim on screen, with its evidence. Put the numeric ones in a
script (`verify/check.mjs` in the reference film runs the product's own analysis on the sample and compares it
with the captions) and run that script at the top of `build.sh`, so a changed sample or a new product build
cannot ship a wrong number. Check that URLs and install commands on the end card work today.

## 7. Render and hand over

```bash
cd films/<name>; T=../../tools/html-film
./build.sh            # share 1080x1080 + master 2160x2160 (8 sub-frames of motion blur) + poster
```

A 2160x2160 render of a 37 s film takes about 20 minutes with 6 workers on a recent laptop; tell the owner the
estimate before starting, and run long renders in the background.

Deliverables:

- `build/<name>-1080x1080.mp4` — the file to post on X and LinkedIn.
- `build/<name>-2160x2160.mp4` — master.
- Poster: frame 0 at 2x, for custom thumbnails:
  `node $T/still.mjs --page src/index.html --width 1080 --height 1080 --scale 2 --t 0 --out build/poster`.
- README GIF: `node $T/gif.mjs --in build/<name>-1080x1080.mp4 --out build/demo.gif --to 10` (the hook plus the
  first property beats; aim under 4 MiB). It belongs in the product's repository, not in this one.
- Post text, if asked: one line saying what it is, then three to five short property lines that carry a number
  or a before → after (`hit=16636 → 130 MiB`), "No X. No Y." where true, then the link. Short and plain. Draft
  it for the owner; do not post it.

## 8. Before anything is committed or published

- Search the film folder for local paths, personal names and anything from internal work, and read the contact
  sheet once more for the same.
- Commit source only. Everything rendered stays in `build/`, which is git-ignored (so is `*.mp4`). Rendered
  videos go to a GitHub Release, and only after the owner has posted or approved, because a Release publishes
  the video.
- Never post, publish a Release or push on the owner's behalf without being asked.
- Delete or clearly mark superseded renders. An old cut with the wrong sample in an output folder gets posted
  by accident.
- Add the film to the table in the top-level `README.md`; fill in the "Watch" links once the posts exist.
