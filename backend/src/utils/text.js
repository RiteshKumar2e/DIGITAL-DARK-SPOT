// Strips control characters and normalises whitespace in untrusted text.
export function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const normalizeForMatch = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const ABBREVIATIONS = new Set([
  'rs', 'no', 'nos', 'dr', 'mr', 'mrs', 'ms', 'st', 'vs', 'e.g', 'i.e', 'etc', 'approx', 'govt', 'dept',
  'prof', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'fig',
  'inc', 'ltd', 'co', 'u.s', 'p.a', 'max', 'min', 'sr', 'jr', 'vol', 'pp', 'al',
]);

/** Splits text into sentence-like units. Lines (list items, table rows) are kept separate. */
export function splitSentences(text) {
  const sentences = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let start = 0;
    const boundary = /[.!?](?:\[(?:\d+|[a-z]|citation needed)\])*["')\]]?\s+(?=[A-Z0-9"“(₹$€£])/g;
    let match;
    while ((match = boundary.exec(trimmed))) {
      const before = trimmed.slice(start, match.index);
      const lastWord = (before.match(/([A-Za-z.]+)$/) || [''])[0].toLowerCase().replace(/\.$/, '');
      if (ABBREVIATIONS.has(lastWord) || /^[A-Z]$/.test(lastWord)) continue;
      sentences.push(trimmed.slice(start, match.index + 1).trim());
      start = match.index + match[0].length;
    }
    const rest = trimmed.slice(start).trim();
    if (rest) sentences.push(rest);
  }
  // Very long units (run-on paragraphs, table rows) are split at semicolons.
  return sentences.flatMap((s) => (s.length > 420 ? s.split(/;\s+/).map((part) => part.trim()).filter(Boolean) : [s]));
}

const STOPWORDS = new Set(
  ('a an and are as at be been but by can could did do does for from had has have how i if in into is it its ' +
    'me my of on or our should so than that the their them then there these they this to was we were what when ' +
    'where which who whom why will with would you your about any all also am get got need needs want find know ' +
    'tell show give check information info details detail please regarding related latest current new more most ' +
    'some such other only same very just like make made between whether using use used while each per both via ' +
    'research question topic apply applying applicant applicants available official rules rule guidelines ' +
    'verify verified verification before after during sure still every whether currently going possible exactly ' +
    'look looking search searching able allowed someone anyone people person things thing kind type').split(' '),
);

/** Content words of a question, used to check whether sources address it. */
export function keyTerms(text) {
  const seen = new Set();
  return normalizeForMatch(text)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
    .filter((word) => (seen.has(word) ? false : seen.add(word)));
}

/** Crude stem: enough to match "renewal"/"renewed", "deadlines"/"deadline". */
export const stem = (word) => word.replace(/(ations?|ing|ed|es|s|al)$/, '').slice(0, Math.max(4, Math.min(word.length, 7)));

export const truncate = (value, max) => (value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value);
