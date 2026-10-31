/**
 * Reproducible evaluation cases. Every source is a fixed fixture, so results
 * do not depend on live websites. Each case lists the findings it must
 * produce (`expect`) and findings it must NOT produce (`forbid`, to catch
 * false positives).
 */
export const NOW = new Date('2026-10-31T00:00:00Z');

export const EVAL_CASES = [
  {
    name: 'Conflicting deadlines in the same cycle',
    question: 'What is the deadline for the Lotus Scholarship 2026?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship 2026. Applications must be submitted online. The last date to apply is 30 November 2026. Eligibility: students enrolled in a degree course.', published: '2026-08-01' },
      { id: 'b', text: 'Lotus Scholarship 2026 update. Students are eligible if enrolled full time. The deadline to apply is 15 November 2026, so apply early.', published: '2026-08-20' },
    ],
    expect: [{ type: 'contradiction', facet: 'deadline', classification: 'possible_conflict' }],
    forbid: [{ type: 'contradiction', facet: 'deadline', classification: 'different_cycle' }],
  },
  {
    name: 'Different application years are not called a contradiction',
    question: 'When does the Lotus Scholarship close?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship 2026-27. Eligibility: enrolled degree students. The last date to apply is 30 November 2026.', published: '2026-08-01' },
      { id: 'b', text: 'Lotus Scholarship 2024-25. Eligibility: enrolled degree students. The last date to apply was 30 November 2024.', published: '2024-08-01' },
    ],
    expect: [{ type: 'contradiction', facet: 'deadline', classification: 'different_cycle' }],
    forbid: [{ type: 'contradiction', facet: 'deadline', classification: 'possible_conflict' }],
  },
  {
    name: 'Missing renewal conditions',
    question: 'What should I verify before applying, and can the Lotus Scholarship be renewed every year?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship. Eligibility: students must be enrolled in a recognised university. The scholarship amount is Rs. 40,000 per year. The last date to apply is 30 November 2026. Required documents: mark sheet and income certificate.', published: '2026-08-01' },
    ],
    expect: [{ type: 'gap', facet: 'renewal', kind: 'missing' }],
    // Generic words such as "verify" or "before" must not be reported as uncovered topics.
    forbid: [{ type: 'gap', facet: 'eligibility', kind: 'missing' }, { type: 'gap', kind: 'question_term' }],
  },
  {
    name: 'Conflicting required-document lists',
    question: 'Which documents are needed for the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship notice. Required documents: income certificate, Aadhaar card and mark sheet. Eligibility: enrolled students.', published: '2026-08-01' },
      { id: 'b', text: 'Lotus Scholarship guide. Documents needed: salary slips of parents, bank passbook and mark sheet. Eligibility: enrolled students.', published: '2026-08-15' },
    ],
    expect: [{ type: 'contradiction', facet: 'documents', classification: 'list_difference' }],
    forbid: [],
  },
  {
    name: 'Official source and older secondary source',
    question: 'What is the amount of the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [
      { id: 'a', domain: 'scholarships.gov.in', text: 'Lotus Scholarship official notice. Eligibility: students enrolled in a recognised university. The scholarship amount is Rs. 40,000 per year, paid in two instalments.', modified: '2026-09-01' },
      { id: 'b', domain: 'example-blog.com', text: 'Lotus Scholarship explained for students. Eligibility: students enrolled in a recognised university. The scholarship amount is Rs. 40,000 per year for each selected student.', published: '2023-03-01' },
    ],
    expect: [{ type: 'freshness', sourceId: 'b', kind: 'stale' }, { type: 'official', sourceId: 'a' }],
    forbid: [{ type: 'contradiction', facet: 'amount' }, { type: 'freshness', sourceId: 'a' }],
  },
  {
    name: 'Undated page',
    question: 'What are the eligibility rules for the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [{ id: 'a', text: 'Lotus Scholarship. Eligibility: applicants must be enrolled full time at a recognised college in India and must have passed class 12.' }],
    expect: [{ type: 'freshness', sourceId: 'a', kind: 'undated' }],
    forbid: [{ type: 'freshness', sourceId: 'a', kind: 'stale' }],
  },
  {
    name: 'Inaccessible URL is excluded from review',
    question: 'What are the eligibility rules for the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship. Eligibility: applicants must be enrolled full time at a recognised college and must have passed class 12.', published: '2026-08-01' },
      { id: 'dead', text: '', status: 'failed' },
    ],
    expect: [{ type: 'notReviewed', sourceId: 'dead' }],
    forbid: [],
  },
  {
    name: 'Question with no relevant coverage',
    question: 'What is the hostel allowance for the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [{ id: 'a', text: 'The city library opens at nine in the morning and closes at six in the evening on weekdays and earlier on weekends.' }],
    expect: [{ type: 'gap', kind: 'question_term' }, { type: 'gap', facet: 'eligibility', kind: 'missing' }],
    forbid: [{ type: 'contradiction' }],
  },
  {
    name: 'Consistent sources produce no contradiction',
    question: 'What is the deadline and amount for the Lotus Scholarship?',
    profile: 'scholarship',
    sources: [
      { id: 'a', text: 'Lotus Scholarship 2026. The last date to apply is 30 November 2026. The scholarship amount is Rs. 40,000 per year.', published: '2026-08-01' },
      { id: 'b', text: 'Lotus Scholarship 2026 summary. The deadline to apply is 30 November 2026. The scholarship amount is ₹40,000 per year.', published: '2026-08-10' },
    ],
    expect: [],
    forbid: [{ type: 'contradiction' }],
  },
  {
    name: 'Question year not covered by sources',
    question: 'What is the Lotus Scholarship deadline for 2027?',
    profile: 'scholarship',
    sources: [{ id: 'a', text: 'Lotus Scholarship 2025. The last date to apply was 30 November 2025. Eligibility: enrolled students.', published: '2025-08-01' }],
    expect: [{ type: 'gap', kind: 'scope_mismatch' }],
    forbid: [],
  },
];
