import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const ORIGIN = 'https://benppruden.github.io';
function env(run) {
  return { GATEWAY_ID: 'gw', MODEL: '@cf/test', ALLOWED_ORIGINS: ORIGIN, AI: { run } };
}
function post(body, origin = ORIGIN) {
  return new Request('https://w.example/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
  });
}

test('routes the chat through the gateway and allows the Pages origin', async () => {
  const calls = [];
  const res = await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }),
    env(async (...a) => { calls.push(a); return { response: 'hello' }; }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { reply: 'hello' });
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(calls[0][0], '@cf/test');
  assert.deepEqual(calls[0][2], { gateway: { id: 'gw' } });
});

test('does not grant CORS to other origins', async () => {
  const res = await worker.fetch(new Request('https://w.example/api/chat', {
    method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env(async () => ({})));
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null);
});

test('rejects bad or oversized input', async () => {
  const e = env(async () => { throw new Error('should not be called'); });
  assert.equal((await worker.fetch(post({ messages: [] }), e)).status, 400);
  assert.equal((await worker.fetch(post({ messages: [{ role: 'system', content: 'x' }] }), e)).status, 400);
  assert.equal((await worker.fetch(post({ messages: [{ role: 'user', content: 'x'.repeat(9000) }] }), e)).status, 413);
});

test('reports model errors as 502', async () => {
  const res = await worker.fetch(post({ messages: [{ role: 'user', content: 'hi' }] }),
    env(async () => { throw new Error('boom'); }));
  assert.equal(res.status, 502);
});
