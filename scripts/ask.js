import { loadEnv, getConfig } from '../src/config.js';
import { chat } from '../src/gateway.js';

loadEnv();
const prompt = process.argv.slice(2).join(' ') || 'Say hello in one sentence.';
try {
  const { reply, cached } = await chat(getConfig(), [{ role: 'user', content: prompt }]);
  console.log(reply + (cached ? '\n(served from gateway cache)' : ''));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
