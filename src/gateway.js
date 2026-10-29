// Calls a Workers AI model through Cloudflare AI Gateway, using the gateway's
// OpenAI-compatible endpoint. The gateway adds logging, caching, analytics and
// rate limiting on top of the model call.
export async function chat(cfg, messages, { skipCache = false } = {}) {
  const url = `${cfg.gatewayBase}/${cfg.accountId}/${cfg.gatewayId}/compat/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiToken}`,
  };
  if (skipCache) headers['cf-aig-skip-cache'] = 'true';

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: `workers-ai/${cfg.model}`, messages }),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const detail = data?.error?.message || data?.errors?.[0]?.message || JSON.stringify(data?.error ?? data);
    throw new Error(`AI Gateway error ${res.status}: ${detail}`);
  }
  return {
    reply: data.choices?.[0]?.message?.content ?? '',
    cached: res.headers.get('cf-aig-cache-status') === 'HIT',
    usage: data.usage,
  };
}

// Creates the gateway through the Cloudflare API. Returns 'created' or 'exists'.
export async function createGateway(cfg) {
  const res = await fetch(`${cfg.apiBase}/accounts/${cfg.accountId}/ai-gateway/gateways`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiToken}` },
    body: JSON.stringify({
      id: cfg.gatewayId,
      collect_logs: true,
      cache_ttl: 300,
      cache_invalidate_on_update: true,
      rate_limiting_interval: 60,
      rate_limiting_limit: 50,
      rate_limiting_technique: 'sliding',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success !== false) return 'created';
  const msg = (data.errors || []).map((e) => e.message).join('; ');
  if (/already exists/i.test(msg)) return 'exists';
  throw new Error(`Could not create gateway (${res.status}): ${msg || JSON.stringify(data)}`);
}
