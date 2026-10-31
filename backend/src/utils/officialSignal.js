/**
 * Flags domains that are reserved for government, intergovernmental or
 * academic publishers. This is a signal about the publisher, never a claim
 * that the page is current or correct, and the reason is always shown.
 */
const RULES = [
  [/(^|\.)(gov|nic)\.in$/, 'government', 'The .gov.in / .nic.in domains are reserved for Indian government bodies.'],
  [/(^|\.)gov$/, 'government', 'The .gov domain is reserved for US government bodies.'],
  [/(^|\.)gov\.[a-z]{2}$/, 'government', 'A .gov.<country> domain is normally reserved for that country’s government bodies.'],
  [/(^|\.)(gc\.ca|europa\.eu|mil)$/, 'government', 'This domain is reserved for government or EU institutions.'],
  [/(^|\.)int$/, 'intergovernmental', 'The .int domain is reserved for intergovernmental organisations.'],
  [/(^|\.)edu$/, 'academic', 'The .edu domain is reserved for accredited US educational institutions.'],
  [/(^|\.)(ac|edu)\.[a-z]{2}$/, 'academic', 'An .ac.<country> or .edu.<country> domain is normally reserved for academic institutions.'],
];

export function officialSignal(domain) {
  if (!domain || typeof domain !== 'string') return null;
  const host = domain.toLowerCase();
  for (const [pattern, level, reason] of RULES) {
    if (pattern.test(host)) {
      return {
        level,
        reason: `${reason} This indicates the publisher type only; it does not show that the page is current or complete.`,
      };
    }
  }
  return null;
}
