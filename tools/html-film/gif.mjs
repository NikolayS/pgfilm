#!/usr/bin/env node
// Cut a small looping GIF (for a README) out of a rendered MP4: one ffmpeg pass that builds
// a palette from the clip itself and applies it with ordered dithering.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { FFMPEG, die, usage, checkFfmpeg, run } from './lib.mjs';

const USAGE = `usage: node gif.mjs --in build/film.mp4 --out build/demo.gif
  [--from 0] [--to <end of file>] [--width 600] [--fps 15] [--colors 160]`;

const { values: a } = parseArgs({
  options: {
    in: { type: 'string' }, out: { type: 'string' },
    from: { type: 'string', default: '0' }, to: { type: 'string' },
    width: { type: 'string', default: '600' }, fps: { type: 'string', default: '15' },
    colors: { type: 'string', default: '160' },
    help: { type: 'boolean', short: 'h' },
  },
});
usage(USAGE, { help: a.help, missing: !a.in || !a.out });
if (!fs.existsSync(a.in)) die(`input not found: ${a.in}`);
const from = +a.from, to = a.to != null ? +a.to : null;
if (!(from >= 0) || (to != null && !(to > from))) die('--from/--to: need 0 <= from < to');
const colors = Math.round(+a.colors);
if (!(colors >= 2 && colors <= 256)) die('--colors must be 2..256');

await checkFfmpeg();
fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
// stats_mode=diff + diff_mode=rectangle: the palette and the per-frame updates follow what
// moves, so a mostly static UI stays small and its flat areas do not shimmer.
const vf = `fps=${+a.fps},scale=${+a.width}:-1:flags=lanczos,split[a][b];` +
  `[a]palettegen=max_colors=${colors}:stats_mode=diff[p];` +
  '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle';
const args = ['-hide_banner', '-y', '-loglevel', 'error'];
if (from > 0) args.push('-ss', String(from));
if (to != null) args.push('-t', String(to - from));
args.push('-i', a.in, '-vf', vf, '-loop', '0', a.out);
await run(FFMPEG, args);
const bytes = fs.statSync(a.out).size;
process.stderr.write(`wrote ${a.out} (${(bytes / 1024 / 1024).toFixed(2)} MiB)\n`);
