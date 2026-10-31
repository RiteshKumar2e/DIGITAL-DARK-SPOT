import { findYears, toEndDate, monthsBetween } from '../../utils/dates.js';

/**
 * Summarises the date evidence for one source. Only dates the page declares
 * (metadata, structured data, <time>) are used as publication/update dates.
 */
export function sourceDateInfo(source, now = new Date()) {
  const currentYear = now.getUTCFullYear();
  const years = findYears(source.text || '').filter((y) => y <= currentYear + 2);
  const best = source.modified || source.published || null;
  return {
    published: source.published || null,
    modified: source.modified || null,
    serverDate: source.serverDate || null,
    retrievedAt: source.retrievedAt || null,
    best,
    latestYearMentioned: years.length ? Math.max(...years) : null,
  };
}

const formatMonths = (months) => (months >= 24 ? `${Math.floor(months / 12)} years` : `${Math.round(months)} months`);

export function detectFreshness({ sources, claims, now = new Date(), staleMonths = 12 }) {
  const warnings = [];
  const currentYear = now.getUTCFullYear();

  for (const source of sources) {
    const info = source.dateInfo;
    if (info.best && toEndDate(info.best.value).getTime() - now.getTime() > 2 * 24 * 60 * 60 * 1000) {
      warnings.push({
        id: `fresh_${source.id}_future`,
        sourceId: source.id,
        kind: 'future_date',
        severity: 'medium',
        title: 'Declared date is in the future',
        explanation: `The source declares the date ${info.best.value} (${info.best.origin}), which is after the analysis date. The date may be wrong or refer to a planned publication, so the source's freshness cannot be assessed.`,
        evidence: { date: info.best.value, origin: info.best.origin },
      });
    } else if (info.best) {
      const months = monthsBetween(toEndDate(info.best.value), now);
      const which = source.modified ? 'last updated' : 'published';
      if (months > staleMonths * 2) {
        warnings.push({
          id: `fresh_${source.id}_old`,
          sourceId: source.id,
          kind: 'stale',
          severity: 'high',
          title: `Source ${which} more than ${formatMonths(months)} ago`,
          explanation: `The source declares that it was ${which} on ${info.best.value} (${info.best.origin}). That is well beyond the ${staleMonths}-month freshness threshold for this type of research, so requirements, dates and amounts may have changed.`,
          evidence: { date: info.best.value, origin: info.best.origin },
        });
      } else if (months > staleMonths) {
        warnings.push({
          id: `fresh_${source.id}_aging`,
          sourceId: source.id,
          kind: 'aging',
          severity: 'medium',
          title: `Source ${which} about ${formatMonths(months)} ago`,
          explanation: `The source declares that it was ${which} on ${info.best.value} (${info.best.origin}), beyond the ${staleMonths}-month freshness threshold for this type of research. Check that it reflects the current cycle.`,
          evidence: { date: info.best.value, origin: info.best.origin },
        });
      }
    } else {
      const latest = info.latestYearMentioned;
      const oldYears = latest !== null && latest < currentYear - 1;
      warnings.push({
        id: `fresh_${source.id}_undated`,
        sourceId: source.id,
        kind: oldYears ? 'old_years' : 'undated',
        severity: oldYears ? 'medium' : 'info',
        title: oldYears ? `Publication date not established; most recent year mentioned is ${latest}` : 'Publication date not established',
        explanation: oldYears
          ? `The source declares no publication or update date. The latest year mentioned in its text is ${latest} (an inferred year, not a publication date), which suggests it may not describe the current period. This is an indicator, not proof.`
          : 'The source declares no publication or update date, so its currency cannot be assessed. This does not mean it is outdated.',
        evidence: { date: null, origin: null, latestYearMentioned: latest, serverDate: info.serverDate },
      });
    }
  }

  // Deadlines stated in the text that have already passed.
  const seen = new Set();
  for (const claim of claims) {
    if (!claim.facets.includes('deadline') || !claim.values.date) continue;
    for (const date of claim.values.date) {
      const key = `${claim.sourceId}|${date.iso}`;
      if (seen.has(key)) continue;
      if (toEndDate(date.iso) < now) {
        seen.add(key);
        warnings.push({
          id: `fresh_${claim.id}_${date.iso}`,
          sourceId: claim.sourceId,
          claimId: claim.id,
          kind: 'past_deadline',
          severity: 'high',
          title: `A stated deadline (${date.raw}) has already passed`,
          explanation: 'This may describe a previous cycle, or the deadline may have been extended. A passed date does not by itself show that the source is wrong. Look for the current cycle’s dates.',
          evidence: { date: date.iso, origin: 'Stated in source text', quote: claim.text },
        });
      }
    }
  }

  const order = { high: 0, medium: 1, info: 2 };
  return warnings.sort((a, b) => order[a.severity] - order[b.severity]);
}
