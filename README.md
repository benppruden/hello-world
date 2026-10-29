# Cloudflare AI Gateway chat app

A small chat app (Node 18+, no dependencies) that runs Cloudflare **Workers AI** models through **Cloudflare AI Gateway**, so every request gets logging, analytics, caching and rate limiting.

## 1. Create your Cloudflare account (you do this; ~3 minutes)
1. Sign up at https://dash.cloudflare.com/sign-up and confirm your email. The free plan includes Workers AI and AI Gateway.
2. **Account ID:** on the dashboard home, open your account; the Account ID is in the right sidebar (or in the URL after `dash.cloudflare.com/`).
3. **API token:** My Profile → API Tokens → Create Token → Custom token, with these permissions:
   - Account · Workers AI · Read
   - Account · AI Gateway · Edit

## 2. Configure and run
```bash
cp .env.example .env        # paste your Account ID and API token
npm run setup-gateway       # creates the gateway (or create it in the dashboard: AI → AI Gateway)
npm run ask -- "What is an AI gateway?"   # quick terminal test
npm start                   # chat UI at http://localhost:3000
npm test                    # offline tests against a local mock
```

## How it works
`src/gateway.js` calls the gateway's OpenAI-compatible endpoint:
```
POST https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/compat/chat/completions
Authorization: Bearer {api_token}
{ "model": "workers-ai/@cf/meta/llama-3.1-8b-instruct-fp8", "messages": [...] }
```
Change models with `CLOUDFLARE_MODEL` (see the Workers AI model catalog). Requests, cost and cache hits appear in the dashboard under AI → AI Gateway → your gateway → Logs.

The same endpoint works with other providers (e.g. `openai/gpt-4o-mini`, `anthropic/...`) if you add that provider's key, so the app can switch providers without code changes.

## Public version: GitHub Pages + Cloudflare Worker

The chat page is published at https://benppruden.github.io/hello-world/ (the `gh-pages` branch).
GitHub Pages only serves static files, so the page sends chat requests to a small Cloudflare
Worker (`worker/index.js`) at https://ai-gateway-chat.benppruden.workers.dev/api/chat.

- The Worker calls the model with the Workers AI binding, routed through the `my-app-gateway`
  gateway, so no API token is stored in the page or the Worker.
- It only answers browsers on `https://benppruden.github.io` (CORS), caps conversations at
  20 messages / 8,000 characters and replies at 512 tokens.
- Anyone with the link can chat, and usage is billed to your Cloudflare account. The gateway's
  rate limit (50 requests per minute) is the spending cap.

Redeploy the Worker after changing it (the token also needs **Workers Scripts: Edit**):

```bash
npm run deploy-worker
```

To update the published page, copy `public/index.html` to the `gh-pages` branch and set its
`chat-api` meta tag to the Worker URL.
