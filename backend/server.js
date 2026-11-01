import { createApp } from './src/app.js';
import { config, aiConfigured } from './src/config/index.js';
import { loadStore, purgeExpired, flushStore } from './src/services/store.service.js';
import { validateEnv } from './src/config/validateEnv.js';
import { searchStatus } from './src/services/search.service.js';

const envCheck = validateEnv();
for (const warning of envCheck.warnings) console.warn(`[config] warning: ${warning}`);
if (envCheck.errors.length) {
  for (const error of envCheck.errors) console.error(`[config] error: ${error}`);
  process.exit(1);
}

await loadStore();
const purged = await purgeExpired();
if (purged) console.log(`[store] removed ${purged} expired session(s)`);
setInterval(() => purgeExpired().catch(() => {}), 60 * 60 * 1000).unref();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[api] Digital Dark Spot API listening on http://localhost:${config.port}`);
  console.log(`[api] allowed origins: ${config.allowedOrigins.join(', ')}`);
  console.log(`[api] AI analysis: ${aiConfigured() ? `enabled (Groq, ${config.ai.model}); rule engine is the fallback` : 'not configured (rule engine only)'}`);
  const search = searchStatus();
  console.log(`[api] Web search: ${search.configured ? `enabled (${search.provider})` : 'not configured (manual sources only)'}`);
});

async function shutdown(signal) {
  console.log(`[api] ${signal} received, shutting down`);
  server.close();
  await flushStore();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
