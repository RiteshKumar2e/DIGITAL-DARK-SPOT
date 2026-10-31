import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  port: intFromEnv('PORT', 4000),
  isProduction,
  trustProxy: intFromEnv('TRUST_PROXY', 0),
  allowedOrigins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  dataFile: process.env.DATA_FILE || path.resolve(here, '../../data/sessions.json'),
  sessionRetentionDays: intFromEnv('SESSION_RETENTION_DAYS', 30),

  limits: {
    maxSourcesPerSession: 10,
    maxQuestionLength: 500,
    minQuestionLength: 10,
    maxUrlLength: 2048,
    maxPastedTextLength: 60000,
    maxStoredTextLength: 60000,
    maxResponseBytes: 3 * 1024 * 1024,
    fetchTimeoutMs: 12000,
    maxRedirects: 5,
    maxPdfBytes: intFromEnv('MAX_PDF_MB', 10) * 1024 * 1024,
    maxPdfPages: 200,
    pdfTimeoutMs: 20000,
  },

  search: {
    provider: (process.env.SEARCH_PROVIDER || '').toLowerCase(),
    tavilyKey: process.env.TAVILY_API_KEY || '',
    braveKey: process.env.BRAVE_SEARCH_API_KEY || '',
    timeoutMs: 10000,
    maxResults: 8,
  },

  freshnessMonths: {
    scholarship: 12,
    job: 12,
    publicService: 12,
    general: 24,
    research: 60,
  },

  ai: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: 90000,
    maxSourceCharsPerSource: 6000,
    maxTotalSourceChars: 45000,
  },
};

export const aiConfigured = () => Boolean(config.ai.apiKey);
