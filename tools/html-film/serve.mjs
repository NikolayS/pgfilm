#!/usr/bin/env node
// Live preview: serve the film's folder the same way render.mjs does and print the page URL.
// Film pages show a scrubber when they are not being captured.
import { parseArgs } from 'node:util';
import { die, usage, startServer, resolvePage, filmUrl } from './lib.mjs';

const USAGE = 'usage: node serve.mjs --page src/index.html [--root <served dir; default: nearest folder above the page with a package.json>] [--port 8787] [--query "t=12.5"]';

const { values: a } = parseArgs({
  options: {
    page: { type: 'string' }, root: { type: 'string' },
    port: { type: 'string', default: '8787' }, query: { type: 'string', default: '' },
    help: { type: 'boolean', short: 'h' },
  },
});
usage(USAGE, { help: a.help, missing: !a.page });
const { root, rel } = resolvePage(a.page, a.root);
const server = await startServer(root, +a.port).catch((e) => die(`cannot listen on port ${a.port}: ${e.message}`));
process.stdout.write(`${filmUrl(server.origin, rel, a.query)}\n(serving ${root}; Ctrl+C to stop)\n`);
