import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { loadEnv, getConfig } from './config.js';
import { chat } from './gateway.js';

export function makeServer(cfg) {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(await readFile(new URL('../public/index.html', import.meta.url)));
      }
      if (req.method === 'POST' && req.url === '/api/chat') {
        let body = '';
        for await (const chunk of req) body += chunk;
        const { messages } = JSON.parse(body || '{}');
        if (!Array.isArray(messages) || !messages.length) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'messages must be a non-empty array' }));
        }
        const result = await chat(cfg, messages);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      }
      res.writeHead(404).end('Not found');
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadEnv();
  const cfg = getConfig();
  const port = Number(process.env.PORT) || 3000;
  makeServer(cfg).listen(port, () =>
    console.log(`Chat app on http://localhost:${port} (gateway: ${cfg.gatewayId}, model: ${cfg.model})`));
}
