import { aiConfigured, config } from '../config/index.js';
import { ENGINE_VERSION } from '../services/analysis/index.js';
import { searchStatus } from '../services/search.service.js';

export function health(req, res) {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    engine: ENGINE_VERSION,
    ai: { configured: aiConfigured(), provider: aiConfigured() ? 'groq' : null, model: aiConfigured() ? config.ai.model : null },
    search: searchStatus(),
    limits: { maxSources: config.limits.maxSourcesPerSession, maxPdfMb: Math.round(config.limits.maxPdfBytes / 1048576) },
  });
}
