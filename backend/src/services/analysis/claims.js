import { FACETS } from './profiles.js';
import { splitSentences, keyTerms, stem, normalizeForMatch } from '../../utils/text.js';
import { findDates } from '../../utils/dates.js';

const CURRENCY = {
  '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', rupees: 'INR', rupee: 'INR',
  $: 'USD', usd: 'USD', 'us$': 'USD', dollars: 'USD',
  '€': 'EUR', eur: 'EUR', euros: 'EUR', '£': 'GBP', gbp: 'GBP', pounds: 'GBP',
};
const MULTIPLIER = { lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7, k: 1e3, thousand: 1e3, million: 1e6, mn: 1e6 };

export function findMoney(text) {
  const out = [];
  const prefix = /(₹|\brs\.?|\binr|us\$|\$|\busd|€|\beur|£|\bgbp)\s?(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)(?:\s?(lakhs?|lacs?|crores?|thousand|million|mn|k)\b)?(?:\s?\/-)?/gi;
  for (const m of text.matchAll(prefix)) {
    const currency = CURRENCY[m[1].toLowerCase()];
    const base = Number(m[2].replace(/,/g, ''));
    if (!currency || !Number.isFinite(base)) continue;
    const amount = base * (MULTIPLIER[(m[3] || '').toLowerCase()] || 1);
    out.push({ currency, amount, raw: m[0].trim(), index: m.index });
  }
  const suffix = /\b(\d{1,3}(?:,\d{2,3})+|\d+(?:\.\d+)?)\s?(lakhs?|lacs?|crores?)?\s?(rupees|inr|dollars|usd|euros|pounds)\b/gi;
  for (const m of text.matchAll(suffix)) {
    if (out.some((entry) => Math.abs(entry.index - m.index) < 4)) continue;
    const base = Number(m[1].replace(/,/g, ''));
    const amount = base * (MULTIPLIER[(m[2] || '').toLowerCase()] || 1);
    out.push({ currency: CURRENCY[m[3].toLowerCase()], amount, raw: m[0].trim(), index: m.index });
  }
  return out;
}

export function findAges(text) {
  const out = [];
  const range = /\b(?:aged?|between)\s+(\d{2})\s*(?:-|–|to|and)\s*(\d{2})\s*(?:years)?/gi;
  for (const m of text.matchAll(range)) out.push({ min: Number(m[1]), max: Number(m[2]), raw: m[0].trim(), index: m.index });
  const limit = /\b(?:below|under|not (?:more|older) than|maximum(?: age)?(?: of| is)?|upper age limit(?: of| is)?|up to|age limit(?: of| is)?)\s+(\d{2})\s*years?/gi;
  for (const m of text.matchAll(limit)) {
    if (out.some((entry) => Math.abs(entry.index - m.index) < 6)) continue;
    out.push({ min: null, max: Number(m[1]), raw: m[0].trim(), index: m.index });
  }
  const min = /\b(?:at least|minimum(?: age)?(?: of| is)?|above|over)\s+(\d{2})\s*years?/gi;
  for (const m of text.matchAll(min)) {
    if (out.some((entry) => Math.abs(entry.index - m.index) < 6)) continue;
    out.push({ min: Number(m[1]), max: null, raw: m[0].trim(), index: m.index });
  }
  return out;
}

export function findPercents(text) {
  const out = [];
  for (const m of text.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s?(%|percent\b|per cent\b)/gi)) {
    const value = Number(m[1]);
    if (value <= 100) out.push({ value, raw: m[0].trim(), index: m.index });
  }
  for (const m of text.matchAll(/\b(?:cgpa|gpa)\s*(?:of)?\s*(\d(?:\.\d{1,2})?)\b/gi)) {
    out.push({ value: Number(m[1]), scale: 'gpa', raw: m[0].trim(), index: m.index });
  }
  return out;
}

/** Page number containing a character offset (PDF sources keep page start offsets). */
function pageAt(pages, offset) {
  if (!pages?.length || offset < 0) return null;
  let page = null;
  for (const entry of pages) {
    if (entry.start <= offset) page = entry.page;
    else break;
  }
  return page;
}

const VALUE_FINDERS = { date: findDates, money: findMoney, age: findAges, percent: findPercents };

const MIN_LEN = 25;
const MAX_LEN = 420;
const MAX_CLAIMS_PER_SOURCE = 60;

/**
 * Extracts candidate claims from one source: verbatim sentences tagged with
 * facets and any comparable values they state. Nothing is paraphrased.
 */
export function extractClaims(source, facetKeys, question) {
  const terms = keyTerms(question).map(stem);
  const candidates = [];
  const sentences = splitSentences(source.text || '');

  const seen = new Set();
  sentences.forEach((sentence, position) => {
    if (sentence.length < MIN_LEN || sentence.length > MAX_LEN) return;
    const dedupeKey = normalizeForMatch(sentence.replace(/\[\d+\]/g, ''));
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    const facets = facetKeys.filter((key) => FACETS[key].pattern.test(sentence));
    if (!facets.length) return;

    const values = {};
    for (const key of facets) {
      const type = FACETS[key].valueType;
      if (type && !values[type]) {
        const found = VALUE_FINDERS[type](sentence);
        if (found.length) values[type] = found;
      }
    }
    const normalized = normalizeForMatch(sentence);
    const relevance = terms.filter((t) => normalized.includes(t)).length;
    candidates.push({ sentence, facets, values, relevance, position });
  });

  // Keep value-bearing and question-relevant sentences first, but always keep at
  // least a few sentences per facet so coverage is not lost to ranking.
  const scored = candidates
    .map((c) => ({ ...c, score: c.relevance * 2 + Object.keys(c.values).length * 3 + c.facets.length }))
    .sort((a, b) => b.score - a.score || a.position - b.position);

  const kept = [];
  const perFacet = {};
  for (const c of scored) {
    const needed = c.facets.some((f) => (perFacet[f] || 0) < 3);
    if (kept.length >= MAX_CLAIMS_PER_SOURCE && !needed) continue;
    kept.push(c);
    c.facets.forEach((f) => (perFacet[f] = (perFacet[f] || 0) + 1));
  }

  return kept
    .sort((a, b) => a.position - b.position)
    .map((c, i) => ({
      id: `${source.id}_c${i + 1}`,
      sourceId: source.id,
      text: c.sentence,
      facets: c.facets,
      values: c.values,
      relevance: c.relevance,
      position: c.position,
      page: source.pages ? pageAt(source.pages, (source.text || '').indexOf(c.sentence)) : null,
    }));
}
