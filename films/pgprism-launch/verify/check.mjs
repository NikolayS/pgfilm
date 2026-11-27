#!/usr/bin/env node
// Re-derives the numbers the film puts on screen from the files it is built from: the vendored
// pgPrism bundle and the sample plan. Run before rendering (build.sh does); a failed check means
// a caption, pill or tile in src/film.js no longer matches what the component will draw.
import fs from 'node:fs';
import vm from 'node:vm';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const film = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(film, rel), 'utf8');

// The bundle is a browser IIFE; its parser and analysis run fine without a DOM.
const sandbox = { console };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
vm.runInNewContext(read('src/vendor/pgprism.iife.js') + ';this.pgprism = pgprism;', sandbox);
vm.runInNewContext(read('src/data/plans.js'), sandbox);
const P = sandbox.pgprism;
const filmJs = read('src/film.js'), html = read('src/index.html');

const key = /window\.PLANS\['([^']+)'\]\.plan/.exec(filmJs)[1];
const sample = sandbox.PLANS[key];
const parsed = P.parsePlan(sample.plan);
const analysis = P.analyzePlan(parsed);
const nodes = [];
(function walk(n) { nodes.push(n); (n.plans || []).forEach(walk); })(parsed.plan);
const hotRe = new RegExp(/const HOT_NODE = \/(.+?)\/;/.exec(filmJs)[1]);
const hot = nodes.filter((n) => hotRe.test(n.displayTitle));
const diags = analysis.diagnostics;
const high = diags.filter((d) => d.severity === 'high').length;
const gzipKiB = zlib.gzipSync(fs.readFileSync(path.join(film, 'src/vendor/pgprism.iife.js')), { level: 9 }).length / 1024;
const hotRead = hot.length === 1 ? hot[0].exclusiveBuffers.shared.read : NaN;
const hotShare = Math.round((hot.length === 1 ? hot[0].exclusiveBufferBlocks : NaN) / analysis.totalBufferBlocks * 100);
const seqScans = nodes.filter((n) => /Seq Scan/.test(n.nodeType)).length;

let failed = 0;
const check = (what, ok, got) => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${got === undefined ? '' : `  [${got}]`}`);
};
const shown = (text) => filmJs.includes(text) || html.includes(text);

check(`plan "${key}" has a public source link`, /^https:\/\/explain\.depesz\.com\/s\/\w+$/.test(sample.source || ''), sample.source);
check('Buffers stat reads "737 MiB", and the film says 737 MiB', P.formatBlocks(analysis.totalBufferBlocks) === '737 MiB' && shown('737&nbsp;MiB') && shown('737 MiB'), P.formatBlocks(analysis.totalBufferBlocks));
check('execution time rounds to the "391 ms" tile', Math.round(parsed.executionTimeMs) === 391 && shown('391 ms'), parsed.executionTimeMs);
check('caption "9 findings in this plan. 6 are high."', diags.length === 9 && high === 6 && shown('9 findings in this plan. 6 are high.'), `${diags.length} findings, ${high} high`);
check('findings tile on the dashboard page shows 9', diags.length === 9 && shown('<span>Findings</span><b>9</b>'));
check('HOT_NODE matches exactly one plan node', hot.length === 1, hot.map((n) => n.displayTitle).join(' | '));
check('the picked finding "Shared reads: 561 MiB" exists and belongs to that node',
  diags.some((d) => d.title === 'Shared reads: 561 MiB' && hot.length === 1 && d.nodeId === hot[0].id) && shown('Shared reads: 561 MiB'), P.formatBlocks(hotRead));
check('every finding carries the node it is about', diags.every((d) => nodes.some((n) => n.id === d.nodeId)));
check('pill "76% in one node"', hotShare === 76 && shown('76% in one node'), `${hotShare}%`);
check('"three seq scans" on the report page', seqScans === 3 && shown('three seq scans'), `${seqScans} seq scan nodes`);
check('"37 KiB" gzipped is the size of the vendored bundle', Math.round(gzipKiB) === 37 && shown('<span id="n37">37</span>') && shown('37 KiB gzip'), `${gzipKiB.toFixed(2)} KiB`);
check('the plan parses as EXPLAIN (ANALYZE, BUFFERS)', parsed.isAnalyze && parsed.hasBuffers);

console.log(failed ? `\n${failed} check(s) failed` : '\nall on-screen numbers match the plan and the bundle');
process.exit(failed ? 1 : 0);
