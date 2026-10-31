export const PROFILE_OPTIONS = [
  { value: 'auto', label: 'Detect from my question' },
  { value: 'scholarship', label: 'Scholarship or grant' },
  { value: 'job', label: 'Job or recruitment' },
  { value: 'publicService', label: 'Public service or government process' },
  { value: 'research', label: 'Research or literature review' },
  { value: 'general', label: 'General research' },
];

export const PRIORITY = {
  high: { label: 'High priority', tone: 'high' },
  medium: { label: 'Medium priority', tone: 'medium' },
  low: { label: 'Low priority', tone: 'low' },
};

export const IMPORTANCE = {
  critical: { label: 'Critical', tone: 'high' },
  important: { label: 'Important', tone: 'medium' },
  useful: { label: 'Useful', tone: 'low' },
};

export const GAP_KIND = {
  missing: 'Not found in sources reviewed',
  unspecified: 'Mentioned without specifics',
  single_source: 'Only one source',
  question_term: 'Question not fully covered',
  scope_mismatch: 'Outside your stated scope',
};

export const CONTRADICTION_CLASS = {
  possible_conflict: { label: 'Possible contradiction', tone: 'high' },
  list_difference: { label: 'Document lists differ', tone: 'high' },
  scope_difference: { label: 'May differ in scope', tone: 'medium' },
  unit_difference: { label: 'May use different units', tone: 'medium' },
  different_cycle: { label: 'May be a different cycle', tone: 'low' },
};

export const AI_ASSESSMENT = {
  likely_conflict: 'AI reading: likely a real conflict',
  likely_scope_difference: 'AI reading: likely a difference in scope',
  unclear: 'AI reading: unclear from the text',
};

export const FRESHNESS_SEVERITY = {
  high: { label: 'Needs checking', tone: 'high' },
  medium: { label: 'Possibly outdated', tone: 'medium' },
  info: { label: 'Date not established', tone: 'info' },
};

export const SOURCE_STATUS = {
  retrieving: { label: 'Retrieving', tone: 'info' },
  retrieved: { label: 'Retrieved', tone: 'ok' },
  failed: { label: 'Not retrieved', tone: 'error' },
};

export const SCOPE_LEVEL = {
  limited: 'Limited evidence',
  moderate: 'Moderate evidence',
  broader: 'Broader evidence',
};
