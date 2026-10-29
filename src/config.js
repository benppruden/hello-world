import { readFileSync, existsSync } from 'node:fs';

// Load .env without extra dependencies. Real environment variables win.
export function loadEnv(path = '.env') {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function getConfig(env = process.env) {
  const cfg = {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN,
    gatewayId: env.CLOUDFLARE_GATEWAY_ID || 'my-app-gateway',
    model: env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8',
    gatewayBase: env.CLOUDFLARE_GATEWAY_BASE || 'https://gateway.ai.cloudflare.com/v1',
    apiBase: env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4',
  };
  const missing = [['CLOUDFLARE_ACCOUNT_ID', cfg.accountId], ['CLOUDFLARE_API_TOKEN', cfg.apiToken]]
    .filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  return cfg;
}
