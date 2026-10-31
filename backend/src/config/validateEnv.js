import { config } from './index.js';

/**
 * Checks configuration at startup. Problems that would break the server are
 * returned as errors; questionable but workable settings are warnings.
 * Secret values are never printed.
 */
export function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errors.push(`PORT must be a number between 1 and 65535.`);

  for (const origin of config.allowedOrigins) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin) warnings.push(`FRONTEND_ORIGIN "${origin}" should be an origin only (scheme, host and port, no path or trailing slash).`);
      if (config.isProduction && url.protocol !== 'https:') warnings.push(`FRONTEND_ORIGIN "${origin}" is not HTTPS in production.`);
    } catch {
      errors.push(`FRONTEND_ORIGIN contains an invalid URL: "${origin}".`);
    }
  }

  if (config.sessionRetentionDays < 1) errors.push('SESSION_RETENTION_DAYS must be at least 1.');

  const provider = (env.SEARCH_PROVIDER || '').toLowerCase();
  if (provider && !['tavily', 'brave'].includes(provider)) warnings.push(`SEARCH_PROVIDER "${provider}" is not supported (use "tavily" or "brave"). Web search is disabled.`);
  if (provider === 'tavily' && !config.search.tavilyKey) warnings.push('SEARCH_PROVIDER is "tavily" but TAVILY_API_KEY is empty. Web search is disabled.');
  if (provider === 'brave' && !config.search.braveKey) warnings.push('SEARCH_PROVIDER is "brave" but BRAVE_SEARCH_API_KEY is empty. Web search is disabled.');

  if (config.ai.apiKey && !/^gsk_/.test(config.ai.apiKey)) warnings.push('GROQ_API_KEY does not look like a Groq key (expected to start with "gsk_").');

  return { errors, warnings };
}
