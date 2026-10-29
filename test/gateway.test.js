import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { chat, createGateway } from '../src/gateway.js';
import { makeServer } from '../src/server.js';

// Local stand-in for Cloudflare so the request format can be checked offline.
let mock, base, seen = [];
before(async () => {
  mock = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    seen.push({ url: req.url, headers: req.headers, body: body && JSON.parse(body) });
    if (req.url.endsWith('/compat/chat/completions')) {
      if (req.headers.authorization !== 'Bearer good') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Authentication error' } }));
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'cf-aig-cache-status': 'MISS' });
      return res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Hi there!' } }] }));
    }
    if (req.url.endsWith('/ai-gateway/gateways')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, result: { id: 'gw' } }));
    }
    res.writeHead(404).end();
  });
  await new Promise((r) => mock.listen(0, r));
  base = `http://127.0.0.1:${mock.address().port}`;
});
after(() => mock.close());

const cfg = (token = 'good') => ({ accountId: 'acct', apiToken: token, gatewayId: 'gw',
  model: '@cf/meta/llama-3.1-8b-instruct-fp8', gatewayBase: base, apiBase: base });

test('chat sends the right request and returns the reply', async () => {
  seen = [];
  const out = await chat(cfg(), [{ role: 'user', content: 'hello' }]);
  assert.equal(out.reply, 'Hi there!');
  assert.equal(out.cached, false);
  assert.equal(seen[0].url, '/acct/gw/compat/chat/completions');
  assert.equal(seen[0].body.model, 'workers-ai/@cf/meta/llama-3.1-8b-instruct-fp8');
});

test('chat surfaces gateway errors', async () => {
  await assert.rejects(chat(cfg('bad'), [{ role: 'user', content: 'x' }]), /401: Authentication error/);
});

test('createGateway posts to the account gateways endpoint', async () => {
  seen = [];
  assert.equal(await createGateway(cfg()), 'created');
  assert.equal(seen[0].url, '/accounts/acct/ai-gateway/gateways');
  assert.equal(seen[0].body.id, 'gw');
});

test('web server relays chat through the gateway', async () => {
  const app = makeServer(cfg());
  await new Promise((r) => app.listen(0, r));
  const r = await fetch(`http://127.0.0.1:${app.address().port}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });
  assert.equal((await r.json()).reply, 'Hi there!');
  app.close();
});
