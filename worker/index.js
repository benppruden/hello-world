// Cloudflare Worker backend for the GitHub Pages chat page.
// Uses the Workers AI binding routed through AI Gateway, so no API token is stored.
const MAX_MESSAGES = 20;
const MAX_CHARS = 8000;

function cors(origin, allowed) {
  const ok = allowed.split(',').map((s) => s.trim()).includes(origin);
  return ok ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  } : { 'Vary': 'Origin' };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export default {
  async fetch(req, env) {
    const headers = cors(req.headers.get('Origin') || '', env.ALLOWED_ORIGINS || '');
    const { pathname } = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST' || pathname !== '/api/chat') return json({ error: 'Not found' }, 404, headers);

    let messages;
    try { ({ messages } = await req.json()); } catch { return json({ error: 'Invalid JSON' }, 400, headers); }
    const valid = Array.isArray(messages) && messages.length > 0 && messages.length <= MAX_MESSAGES &&
      messages.every((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string');
    if (!valid) return json({ error: `messages must be 1-${MAX_MESSAGES} user/assistant messages` }, 400, headers);
    if (messages.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) {
      return json({ error: 'Conversation too long; refresh the page to start over' }, 413, headers);
    }

    try {
      const out = await env.AI.run(env.MODEL, { messages, max_tokens: 512 }, { gateway: { id: env.GATEWAY_ID } });
      return json({ reply: out.response ?? '' }, 200, headers);
    } catch (err) {
      return json({ error: `AI Gateway error: ${err.message}` }, 502, headers);
    }
  },
};
