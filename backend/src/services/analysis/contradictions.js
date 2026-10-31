import { FACETS } from './profiles.js';
import { findYears } from '../../utils/dates.js';

const COMPARABLE = ['deadline', 'amount', 'fee', 'age', 'income', 'marks'];
const MAX_FINDINGS = 12;

const PERIODS = [
  ['monthly', /\b(per month|monthly|a month|\/month|p\.m\.)\b/i],
  ['yearly', /\b(per annum|per year|annual(?:ly)?|yearly|a year|p\.a\.)\b/i],
  ['one-time', /\b(one[- ]time|lump ?sum|once)\b/i],
];
const CATEGORIES = /\b(sc|st|obc|ews|pwd|pwbd|general category|women|female|girls|male|international|domestic|undergraduate|postgraduate|ug|pg|ph\.?d|masters?|bachelors?|class \d+|tier \d|level \d|category [a-z])\b/gi;

const periodOf = (text) => PERIODS.filter(([, re]) => re.test(text)).map(([name]) => name);
const categoriesOf = (text) => [...new Set((text.match(CATEGORIES) || []).map((m) => m.toLowerCase()))];

function formatValue(type, value) {
  if (type === 'date') return value.raw;
  if (type === 'money') return value.raw;
  if (type === 'age') return value.raw;
  return value.raw;
}

function valuesDiffer(type, a, b) {
  switch (type) {
    case 'date':
      return a.precision === b.precision && a.iso !== b.iso;
    case 'money':
      // Different currencies are reported as not comparable rather than skipped silently.
      if (a.currency !== b.currency) return true;
      return Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount, 1) > 0.005;
    case 'age':
      return (a.max !== null && b.max !== null && a.max !== b.max) || (a.min !== null && b.min !== null && a.min !== b.min);
    case 'percent':
      return (a.scale || 'pct') === (b.scale || 'pct') && a.value !== b.value;
    default:
      return false;
  }
}

// Years a claim refers to: stated in the sentence, otherwise the years in the
// source's heading (e.g. "Scholarship 2026-27"), otherwise none.
function contextYears(claim, source) {
  const own = findYears(claim.text);
  if (own.length) return { years: own, fromHeading: false };
  const heading = (source?.text || '').slice(0, 200).split('\n')[0];
  return { years: findYears(`${source?.title || ''} ${heading}`), fromHeading: true };
}

// A numeric date such as 05/06/2026 read the other way round (month-first).
function swappedIso(value) {
  const [y, m, d] = value.iso.split('-');
  return `${y}-${d}-${m}`;
}

function classify(type, claimA, claimB, valueA, valueB, srcA, srcB) {
  const reasons = [];
  let classification = 'possible_conflict';

  if (type === 'money' && valueA.currency !== valueB.currency) {
    return {
      classification: 'not_comparable',
      reasons: [
        `The amounts are in different currencies (${valueA.currency} and ${valueB.currency}), so they cannot be compared without an exchange rate and context.`,
        'They may describe different programmes, countries or applicant groups.',
      ],
    };
  }

  if (type === 'date') {
    const yA = Number(valueA.iso.slice(0, 4));
    const yB = Number(valueB.iso.slice(0, 4));
    if (yA !== yB) {
      classification = 'different_cycle';
      reasons.push(`The dates fall in different years (${yA} and ${yB}), so the sources may describe different application cycles.`);
    }
    if ((valueA.ambiguous || valueB.ambiguous) && classification === 'possible_conflict') {
      classification = 'inconclusive';
      const sameWhenSwapped = (valueA.ambiguous && swappedIso(valueA) === valueB.iso) || (valueB.ambiguous && swappedIso(valueB) === valueA.iso);
      reasons.push('At least one date is written in a numeric format (such as 05/06/2026) that can be read day-first or month-first.');
      if (sameWhenSwapped) reasons.push('Read the other way round, the two dates are the same, so this may not be a disagreement at all.');
    } else if (valueA.ambiguous || valueB.ambiguous) {
      reasons.push('At least one date is written in a numeric format (such as 05/06/2026) that can be read day-first or month-first.');
    }
  } else {
    const a = contextYears(claimA, srcA);
    const b = contextYears(claimB, srcB);
    if (a.years.length && b.years.length && !a.years.some((y) => b.years.includes(y))) {
      classification = 'different_cycle';
      const how = a.fromHeading || b.fromHeading ? ' (judged partly from the source headings)' : '';
      reasons.push(`The statements refer to different years${how}: ${a.years.join(', ')} vs ${b.years.join(', ')}.`);
    }
  }

  if (type === 'money') {
    const pA = periodOf(claimA.text);
    const pB = periodOf(claimB.text);
    if (pA.length && pB.length && !pA.some((p) => pB.includes(p))) {
      classification = 'unit_difference';
      reasons.push(`One figure appears to be ${pA.join('/')} and the other ${pB.join('/')}.`);
    }
  }

  const cA = categoriesOf(claimA.text);
  const cB = categoriesOf(claimB.text);
  if ((cA.length || cB.length) && cA.join() !== cB.join()) {
    if (classification === 'possible_conflict') classification = 'scope_difference';
    reasons.push(`The statements may apply to different groups (${cA.join(', ') || 'unspecified'} vs ${cB.join(', ') || 'unspecified'}).`);
  }

  reasons.push('One of the sources may be outdated, unofficial, or describe a different scheme or edition.');
  return { classification, reasons };
}

function explain(classification, label, a, b) {
  if (classification === 'possible_conflict') {
    return `The two sources state different values for ${label} (${a} vs ${b}), and no obvious difference in scope was detected.`;
  }
  if (classification === 'inconclusive') {
    return `The sources give ${a} and ${b} for ${label}, but the written format is ambiguous, so it cannot be established whether they disagree.`;
  }
  if (classification === 'not_comparable') {
    return `The sources give ${a} and ${b} for ${label}. These cannot be compared directly, so no conflict is claimed.`;
  }
  return `The two sources state different values for ${label} (${a} vs ${b}), but this may be explained by a difference in scope rather than a true contradiction.`;
}

/**
 * Compares claims that state a single comparable value for the same facet in
 * two different sources. Only explicit, differing values are reported, and each
 * is classified cautiously: a difference is not treated as proof of a conflict.
 */
export function detectContradictions({ claims, sourcesById, facetKeys }) {
  const findings = [];
  const seenPairs = new Set();

  for (const facet of COMPARABLE.filter((f) => facetKeys.includes(f))) {
    const type = FACETS[facet].valueType;
    const usable = claims
      .filter((c) => c.facets.includes(facet) && c.values[type]?.length === 1)
      .filter((c) => (type === 'date' ? c.values.date[0].precision === 'day' : true));

    const pairs = [];
    for (let i = 0; i < usable.length; i += 1) {
      for (let j = i + 1; j < usable.length; j += 1) {
        const a = usable[i];
        const b = usable[j];
        if (a.sourceId === b.sourceId) continue;
        const va = a.values[type][0];
        const vb = b.values[type][0];
        if (!valuesDiffer(type, va, vb)) continue;
        // Skip the pair if these two sources agree elsewhere on one of these values.
        const agreeing = usable.some(
          (c) => c.sourceId === b.sourceId && c.id !== b.id && !valuesDiffer(type, va, c.values[type][0]),
        );
        if (agreeing) continue;
        pairs.push({ a, b, va, vb, score: a.relevance + b.relevance });
      }
    }

    pairs.sort((x, y) => y.score - x.score);
    for (const { a, b, va, vb } of pairs) {
      const key = `${facet}|${[a.sourceId, b.sourceId].sort().join('|')}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);

      const srcA = sourcesById[a.sourceId];
      const srcB = sourcesById[b.sourceId];
      const { classification, reasons } = classify(type, a, b, va, vb, srcA, srcB);
      findings.push({
        id: `con_${facet}_${findings.length + 1}`,
        facet,
        subject: FACETS[facet].label,
        classification,
        claimA: { claimId: a.id, sourceId: a.sourceId, text: a.text, value: formatValue(type, va), sourceDate: srcA?.dateInfo?.best || null },
        claimB: { claimId: b.id, sourceId: b.sourceId, text: b.text, value: formatValue(type, vb), sourceDate: srcB?.dateInfo?.best || null },
        explanation: explain(classification, FACETS[facet].label.toLowerCase(), formatValue(type, va), formatValue(type, vb)),
        possibleReasons: reasons,
        recommendation: 'Check the issuing organisation’s official, most recently updated page to see which value currently applies.',
      });
      if (findings.length >= MAX_FINDINGS) return findings;
    }
  }
  const order = { possible_conflict: 0, scope_difference: 1, unit_difference: 2, inconclusive: 3, not_comparable: 4, different_cycle: 5 };
  return findings.sort((x, y) => order[x.classification] - order[y.classification]);
}

// Document types recognised when comparing required-document lists.
const DOCUMENT_TYPES = [
  ['income certificate', /\bincome certificate\b/i],
  ['income tax return (ITR)', /\b(income tax returns?|itr)\b/i],
  ['salary slips', /\bsalary slips?\b/i],
  ['mark sheet / transcript', /\b(mark ?sheets?|transcripts?|grade cards?)\b/i],
  ['admission letter', /\b(admission letter|offer letter|proof of admission)\b/i],
  ['fee receipt', /\bfee receipts?\b/i],
  ['bonafide certificate', /\bbona ?fide certificate\b/i],
  ['Aadhaar card', /\baadhaa?r\b/i],
  ['passport', /\bpassport(?![- ]size)\b/i],
  ['photograph', /\b(photograph|passport[- ]size photo)\b/i],
  ['caste / category certificate', /\b(caste|category|community) certificate\b/i],
  ['domicile certificate', /\b(domicile|residence) certificate\b/i],
  ['bank account details', /\b(bank (?:account )?details|bank passbook|cancelled cheque)\b/i],
  ['recommendation letter', /\b(recommendation letters?|letters? of recommendation|reference letters?)\b/i],
  ['disability certificate', /\bdisability certificate\b/i],
];

/**
 * Compares the documents each source asks for. Reported only when two sources
 * both describe required documents and each names something the other omits,
 * which is a difference worth checking rather than a proven contradiction.
 */
export function detectDocumentDifferences({ claims, sourcesById, facetKeys }) {
  if (!facetKeys.includes('documents')) return [];
  const bySource = new Map();
  for (const claim of claims) {
    if (!claim.facets.includes('documents')) continue;
    const found = DOCUMENT_TYPES.filter(([, re]) => re.test(claim.text)).map(([name]) => name);
    if (!found.length) continue;
    const entry = bySource.get(claim.sourceId) || { docs: new Map() };
    for (const doc of found) if (!entry.docs.has(doc)) entry.docs.set(doc, claim);
    bySource.set(claim.sourceId, entry);
  }
  const ids = [...bySource.keys()];
  const findings = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = bySource.get(ids[i]);
      const b = bySource.get(ids[j]);
      const onlyA = [...a.docs.keys()].filter((d) => !b.docs.has(d));
      const onlyB = [...b.docs.keys()].filter((d) => !a.docs.has(d));
      if (!onlyA.length || !onlyB.length) continue;
      const claimA = a.docs.get(onlyA[0]);
      const claimB = b.docs.get(onlyB[0]);
      findings.push({
        id: `con_documents_${findings.length + 1}`,
        facet: 'documents',
        subject: 'Required documents',
        classification: 'list_difference',
        claimA: { claimId: claimA.id, sourceId: ids[i], text: claimA.text, value: onlyA.join(', '), sourceDate: sourcesById[ids[i]]?.dateInfo?.best || null },
        claimB: { claimId: claimB.id, sourceId: ids[j], text: claimB.text, value: onlyB.join(', '), sourceDate: sourcesById[ids[j]]?.dateInfo?.best || null },
        explanation: `The sources list different documents. Only one mentions ${onlyA.join(', ')}; only the other mentions ${onlyB.join(', ')}.`,
        possibleReasons: [
          'One source may give a partial list or a summary.',
          'The requirement may have changed between application cycles.',
          'Different documents may be accepted as alternatives (for example, different forms of income proof).',
        ],
        recommendation: 'Get the complete, current document list from the official notice or application portal.',
      });
    }
  }
  return findings.slice(0, 4);
}
