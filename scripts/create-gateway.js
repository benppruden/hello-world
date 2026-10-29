import { loadEnv, getConfig } from '../src/config.js';
import { createGateway } from '../src/gateway.js';

loadEnv();
const cfg = getConfig();
try {
  const status = await createGateway(cfg);
  console.log(status === 'created' ? `Created gateway "${cfg.gatewayId}".` : `Gateway "${cfg.gatewayId}" already exists.`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
