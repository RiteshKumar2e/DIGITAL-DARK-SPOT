const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Formats 'YYYY-MM-DD', 'YYYY-MM' or a full ISO timestamp for display. */
export function formatDate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}$/.test(value)) return monthFormatter.format(new Date(`${value}-01T00:00:00Z`));
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dateFormatter.format(new Date(`${value}T00:00:00Z`));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date);
}

export const formatNumber = (n) => new Intl.NumberFormat('en-IN').format(n || 0);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Only http(s) links are rendered as clickable anchors. */
export function safeHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}
