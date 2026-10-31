const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';

const pad = (n) => String(n).padStart(2, '0');
const monthNum = (name) => MONTHS[name.toLowerCase()] ?? MONTHS[name.toLowerCase().slice(0, 3)];

function validDay(year, month, day) {
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Finds explicit calendar dates in a sentence. Each result:
 * { iso: 'YYYY-MM-DD' | 'YYYY-MM', precision: 'day'|'month', raw, ambiguous, index }
 * Numeric dates like 05/06/2025 are read day-first and flagged ambiguous when both
 * parts are 12 or below.
 */
export function findDates(text) {
  const results = [];
  const taken = [];
  const overlaps = (start, end) => taken.some(([s, e]) => start < e && end > s);
  const push = (match, entry) => {
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end)) return;
    taken.push([start, end]);
    results.push({ ...entry, raw: match[0].trim(), index: start });
  };

  const patterns = [
    // 2025-03-15
    [/\b(19|20)(\d{2})-(\d{1,2})-(\d{1,2})\b/g, (m) => {
      const y = Number(m[1] + m[2]); const mo = Number(m[3]); const d = Number(m[4]);
      return validDay(y, mo, d) ? { iso: `${y}-${pad(mo)}-${pad(d)}`, precision: 'day', ambiguous: false } : null;
    }],
    // 15 March 2025, 15th of March, 2025
    [new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\.?,?\\s+((?:19|20)\\d{2})\\b`, 'gi'), (m) => {
      const d = Number(m[1]); const mo = monthNum(m[2]); const y = Number(m[3]);
      return validDay(y, mo, d) ? { iso: `${y}-${pad(mo)}-${pad(d)}`, precision: 'day', ambiguous: false } : null;
    }],
    // March 15, 2025
    [new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+((?:19|20)\\d{2})\\b`, 'gi'), (m) => {
      const mo = monthNum(m[1]); const d = Number(m[2]); const y = Number(m[3]);
      return validDay(y, mo, d) ? { iso: `${y}-${pad(mo)}-${pad(d)}`, precision: 'day', ambiguous: false } : null;
    }],
    // 15/03/2025, 15-03-2025, 15.03.2025
    [/\b(\d{1,2})[/.-](\d{1,2})[/.-]((?:19|20)\d{2})\b/g, (m) => {
      let d = Number(m[1]); let mo = Number(m[2]); const y = Number(m[3]);
      let ambiguous = d <= 12 && mo <= 12 && d !== mo;
      if (mo > 12 && d <= 12) { [d, mo] = [mo, d]; ambiguous = false; }
      return validDay(y, mo, d) ? { iso: `${y}-${pad(mo)}-${pad(d)}`, precision: 'day', ambiguous } : null;
    }],
    // March 2025
    [new RegExp(`\\b(${MONTH_RE})\\.?,?\\s+((?:19|20)\\d{2})\\b`, 'gi'), (m) => {
      const mo = monthNum(m[1]); const y = Number(m[2]);
      return mo && y >= 1950 && y <= 2100 ? { iso: `${y}-${pad(mo)}`, precision: 'month', ambiguous: false } : null;
    }],
  ];

  for (const [regex, build] of patterns) {
    for (const match of text.matchAll(regex)) {
      const entry = build(match);
      // An invalid date (e.g. 31 February) still claims its span so it is not re-read at month precision.
      if (entry) push(match, entry);
      else taken.push([match.index, match.index + match[0].length]);
    }
  }
  return results.sort((a, b) => a.index - b.index);
}

/** Explicit four-digit years (1990-2099), including academic ranges such as 2024-25. */
export function findYears(text) {
  const years = new Set();
  for (const match of text.matchAll(/\b(199\d|20\d{2})(?:\s?[-–/]\s?(\d{2,4}))?\b/g)) {
    const start = Number(match[1]);
    years.add(start);
    if (match[2]) {
      const tail = match[2].length === 2 ? Number(String(start).slice(0, 2) + match[2]) : Number(match[2]);
      if (tail === start + 1) years.add(tail);
    }
  }
  return [...years];
}

/** Parses metadata date strings (ISO 8601 or RFC 2822). Returns 'YYYY-MM-DD' or null. */
export function normalizeMetaDate(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso && validDay(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    const found = findDates(trimmed).find((d) => d.precision === 'day');
    return found ? found.iso : null;
  }
  const date = new Date(parsed);
  const year = date.getUTCFullYear();
  if (year < 1990 || year > 2100) return null;
  return `${year}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Compares a 'YYYY-MM-DD' or 'YYYY-MM' value to now; month precision uses the month's last day. */
export function toEndDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  if (d) return new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  return new Date(Date.UTC(y, m, 0, 23, 59, 59));
}

export function monthsBetween(earlier, later) {
  return (later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
