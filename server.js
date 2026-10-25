#!/usr/bin/env node
// Local web UI for dxlight: GET / serves the page, POST /api takes the same args as the CLI
// as a JSON array, e.g. ["effect", "1", "ff0000", "50"]. Bound to localhost only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { open, run } = require('./dxlight');

const PORT = +process.env.PORT || 4321;
let dev = null;

async function exec(args) {
  dev ??= open();
  const done = run(dev, args);
  if (args[0] === 'pulse' || args[0] === 'cycle') done.catch(e => { console.error(e.message); dev = null; }); // keeps running
  else await done;
}

http.createServer((req, res) => {
  const file = req.url.split('?')[0]; // ignore cache-busting query strings
  const asset = { '/': 'text/html', '/liquid-glass.css': 'text/css', '/liquid-glass.js': 'text/javascript', '/res/logo.svg': 'image/svg+xml' }[file];
  if (req.method === 'GET' && asset) {
    res.writeHead(200, { 'Content-Type': `${asset}; charset=utf-8` });
    return fs.createReadStream(path.join(__dirname, file === '/' ? 'index.html' : file)).pipe(res);
  }
  if (req.method !== 'POST' || req.url !== '/api') { res.writeHead(404); return res.end(); }
  // JSON content type forces a CORS preflight (never answered), so other websites can't drive the strip
  if (req.headers['content-type'] !== 'application/json') { res.writeHead(415); return res.end(); }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', async () => {
    try {
      const args = JSON.parse(body);
      if (!Array.isArray(args) || !args.every(a => typeof a === 'string')) throw new Error('expected array of strings');
      // 'quit' shuts the server down; the strip keeps whatever it's showing (a software effect stops)
      if (args[0] === 'quit') return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}', () => process.exit(0));
      await exec(args);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    } catch (e) {
      try { dev?.close(); } catch {}
      dev = null; // reopen next time (strip unplugged, etc.)
      res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(PORT, '127.0.0.1', () => console.log(`Backlit UI: http://localhost:${PORT}`));
