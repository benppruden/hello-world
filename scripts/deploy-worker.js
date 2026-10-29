// Deploys worker/index.js through the Cloudflare API (no wrangler needed).
// Token needs Workers Scripts: Edit in addition to the gateway permissions.
import { readFile } from 'node:fs/promises';
import { loadEnv, getConfig } from '../src/config.js';

loadEnv();
const cfg = getConfig();
const name = process.env.WORKER_NAME || 'ai-gateway-chat';
const origins = process.env.ALLOWED_ORIGINS || 'https://benppruden.github.io';
const api = `${cfg.apiBase}/accounts/${cfg.accountId}/workers`;
const auth = { Authorization: `Bearer ${cfg.apiToken}` };

async function call(url, init) {
  const res = await fetch(url, { ...init, headers: { ...auth, ...init.headers } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(`${init.method} ${url} failed (${res.status}): ${(data.errors || []).map((e) => e.message).join('; ')}`);
  }
  return data.result;
}

const form = new FormData();
form.append('metadata', JSON.stringify({
  main_module: 'index.js',
  compatibility_date: '2026-10-01',
  bindings: [
    { type: 'ai', name: 'AI' },
    { type: 'plain_text', name: 'GATEWAY_ID', text: cfg.gatewayId },
    { type: 'plain_text', name: 'MODEL', text: cfg.model },
    { type: 'plain_text', name: 'ALLOWED_ORIGINS', text: origins },
  ],
}));
const code = await readFile(new URL('../worker/index.js', import.meta.url));
form.append('index.js', new Blob([code], { type: 'application/javascript+module' }), 'index.js');

try {
  await call(`${api}/scripts/${name}`, { method: 'PUT', body: form });
  await call(`${api}/scripts/${name}/subdomain`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: true }),
  });
  const { subdomain } = await call(`${api}/subdomain`, { method: 'GET' });
  console.log(`Deployed: https://${name}.${subdomain}.workers.dev/api/chat`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
