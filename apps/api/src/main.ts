import { resolveDataSource, loadEnvFile } from './env.js';
import { createApp } from './server.js';

loadEnvFile();

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535');
}

const source = resolveDataSource();
const app = createApp();
app.listen(port, '0.0.0.0', () => {
  if (source.mode === 'sample') {
    console.log(`Planner API on http://127.0.0.1:${port} (synthetic sample)`);
  } else {
    console.log(`Planner API on http://127.0.0.1:${port} (Shopify ${source.domain}, read-only)`);
  }
});
