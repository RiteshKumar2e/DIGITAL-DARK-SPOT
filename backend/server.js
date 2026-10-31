import { createApp } from './src/app.js';
import { config, aiConfigured } from './src/config/index.js';
import { loadStore, purgeExpired, flushStore } from './src/services/store.service.js';

await loadStore();
const purged = await purgeExpired();
if (purged) console.log(`[store] removed ${purged} expired session(s)`);
setInterval(() => purgeExpired().catch(() => {}), 60 * 60 * 1000).unref();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[api] Digital Dark Spot API listening on http://localhost:${config.port}`);
  console.log(`[api] allowed origins: ${config.allowedOrigins.join(', ')}`);
  console.log(`[api] AI review: ${aiConfigured() ? `enabled (Groq, ${config.ai.model})` : 'not configured (rule-based analysis only)'}`);
});

async function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  await flushStore();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
