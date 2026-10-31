/**
 * Facets are the kinds of information a research question usually needs.
 * Each facet has a keyword pattern (used to tag sentences in sources) and an
 * optional value type (used for cross-source comparison).
 *
 * Detection is keyword-based: a facet counts as "covered" when a retrieved
 * sentence matches its pattern. This is deliberately transparent so every
 * finding can show the exact search scope behind it.
 */
export const FACETS = {
  eligibility: {
    label: 'Eligibility criteria',
    pattern: /\b(eligib\w*|who can apply|open to|must be (?:a|an|enrolled|registered|resident|citizen)|applicants? (?:must|should)|criteria|qualif(?:y|ies|ied|ication)s?)\b/i,
  },
  deadline: {
    label: 'Deadline / last date',
    pattern: /\b(deadline|last date|closing date|closes on|apply (?:by|before)|due (?:date|by)|submissions? (?:close|due)|applications? (?:close[ds]?|closing|must be received)|closed on|accepted (?:till|until))\b/i,
    valueType: 'date',
  },
  amount: {
    label: 'Benefit amount / pay',
    pattern: /\b(stipend|award(?:ed)? (?:of|amount)|scholarship amount|grant of|worth|financial assistance|amount of|salary|pay scale|remuneration|ctc|per month|per annum|monthly|annually)\b/i,
    valueType: 'money',
  },
  fee: {
    label: 'Fees and charges',
    pattern: /\b(application fee|registration fee|exam(?:ination)? fee|processing fee|service charge|fees? (?:of|is|are)|charges?)\b/i,
    valueType: 'money',
  },
  documents: {
    label: 'Required documents',
    pattern: /\b(documents?|certificates?|transcripts?|mark ?sheets?|proof of|id proof|identity proof|aadhaar|passport|photograph|recommendation letters?|letters? of recommendation|upload|attach)\b/i,
  },
  age: {
    label: 'Age limit',
    pattern: /\b(age limit|years of age|years old|aged|age (?:of|between|below|under|above)|maximum age|minimum age|upper age)\b/i,
    valueType: 'age',
  },
  income: {
    label: 'Income limit',
    pattern: /\b(family income|annual income|household income|income (?:limit|ceiling|criteria|certificate)|income of|earning)\b/i,
    valueType: 'money',
  },
  marks: {
    label: 'Minimum marks / grades',
    pattern: /\b(minimum (?:marks|percentage|grade|gpa|cgpa)|aggregate|cgpa|gpa|percentage of marks|marks? in|% marks|percent marks|scored?)\b/i,
    valueType: 'percent',
  },
  selection: {
    label: 'Selection process',
    pattern: /\b(selection|shortlist\w*|interview|written test|entrance (?:test|exam)|merit list|evaluation|assessment|screening)\b/i,
  },
  renewal: {
    label: 'Renewal / continuation',
    pattern: /\b(renew\w*|continuation|continue to receive|continued (?:support|funding)|subsequent years?|each year of study|re-?apply|extension|tenable for|for the (?:entire|full) (?:duration|course)|until (?:the )?completion)\b/i,
  },
  howToApply: {
    label: 'How to apply',
    pattern: /\b(how to apply|apply online|application (?:form|portal|process|link)|register (?:on|at)|registration (?:link|portal)|submit (?:an|the|your) application|online portal|steps? to apply|apply (?:through|via|at))\b/i,
  },
  contact: {
    label: 'Official contact',
    pattern: /\b(contact|helpline|help desk|email|e-mail|phone|toll[- ]free|grievance|queries)\b/i,
  },
  vacancies: {
    label: 'Number of vacancies / awards',
    pattern: /\b(vacanc(?:y|ies)|posts?|number of (?:awards|scholarships|seats|positions)|seats|openings)\b/i,
  },
  duration: {
    label: 'Duration / validity',
    pattern: /\b(duration|valid (?:for|till|until)|validity|tenure|period of|for a period of)\b/i,
  },
  processingTime: {
    label: 'Processing time',
    pattern: /\b(processing time|within \d+ (?:working )?days|takes? \d+ (?:working )?days|turnaround|will be (?:processed|issued) within)\b/i,
  },
  process: {
    label: 'Procedure / steps',
    pattern: /\b(step \d|procedure|process|visit (?:the|your)|submit|fill (?:in|out)|apply at)\b/i,
  },
  methodology: {
    label: 'Methodology',
    pattern: /\b(method\w*|study design|randomi[sz]ed|cohort|survey|meta-analysis|systematic review|experiment\w*|qualitative|quantitative)\b/i,
  },
  sample: {
    label: 'Sample size / population',
    pattern: /\b(participants|sample (?:size|of)|respondents|patients|subjects|n ?= ?\d+|population)\b/i,
  },
  findings: {
    label: 'Key findings / results',
    pattern: /\b(results?|found that|findings?|concluded?|conclusion|showed that|demonstrat\w+|significant\w*)\b/i,
  },
  limitations: {
    label: 'Limitations',
    pattern: /\b(limitations?|caveats?|bias(?:es)?|confound\w*|further research|generali[sz]ab\w*)\b/i,
  },
  funding: {
    label: 'Funding / conflicts of interest',
    pattern: /\b(funded by|funding|grant (?:from|number)|sponsor\w*|conflicts? of interest|competing interests?|disclosures?)\b/i,
  },
  peerReview: {
    label: 'Peer-review / publication status',
    pattern: /\b(peer[- ]reviewed|preprint|published in|journal|accepted for publication|retracted|retraction|doi)\b/i,
  },
  requirements: {
    label: 'Requirements',
    pattern: /\b(require\w*|must|mandatory|necessary|needed|prerequisite)\b/i,
  },
  dates: {
    label: 'Key dates / timeline',
    pattern: /\b(date|schedule|timeline|starts? on|begins?|from \d|effective from|announced on)\b/i,
    valueType: 'date',
  },
  cost: {
    label: 'Cost',
    pattern: /\b(cost|price|fees?|charges?|free of cost|payable)\b/i,
    valueType: 'money',
  },
  authority: {
    label: 'Responsible authority / official source',
    pattern: /\b(ministry|department|government|official|authority|board|commission|council|issued by|notified by)\b/i,
  },
};

const facet = (key, importance, why, check) => ({ key, importance, why, check });

/**
 * Importance: "critical" items block a decision, "important" items affect it,
 * "useful" items improve confidence.
 */
export const PROFILES = {
  scholarship: {
    label: 'Scholarship or grant',
    detect: /\b(scholarships?|fellowships?|grants?|bursar(?:y|ies)|stipend|financial aid|fee waiver)\b/i,
    facets: [
      facet('eligibility', 'critical', 'Determines whether you can apply at all.', 'Confirm every eligibility condition on the official scholarship page or notification.'),
      facet('deadline', 'critical', 'Missing the current deadline usually means waiting a full cycle.', 'Find the deadline for the current application cycle on the official portal.'),
      facet('amount', 'important', 'Tells you what the scholarship actually covers.', 'Confirm the award amount and what it covers (tuition, maintenance, one-time or recurring).'),
      facet('documents', 'critical', 'Incomplete documents are a common reason for rejection.', 'Get the complete document checklist, including format and attestation requirements.'),
      facet('income', 'important', 'Many scholarships cap family income.', 'Check whether an income limit applies and which certificate is accepted as proof.'),
      facet('selection', 'important', 'Explains how candidates are chosen.', 'Confirm the selection method (merit, test, interview) and timeline.'),
      facet('renewal', 'important', 'Determines whether funding continues after the first year.', 'Check renewal conditions such as minimum grades or attendance.'),
      facet('howToApply', 'important', 'You need the correct channel to submit an application.', 'Locate the official application portal or form.'),
      facet('contact', 'useful', 'Needed to resolve questions before the deadline.', 'Note an official helpline or email for queries.'),
    ],
  },
  job: {
    label: 'Job or recruitment',
    detect: /\b(jobs?|recruitment|vacanc(?:y|ies)|hiring|post of|positions?|careers?|internships?|employment|notification for)\b/i,
    facets: [
      facet('eligibility', 'critical', 'Educational and experience requirements decide eligibility.', 'Verify required qualifications and experience in the official notification.'),
      facet('age', 'critical', 'Age limits and relaxations are strictly applied in many recruitments.', 'Confirm the age limit, the cut-off date it is calculated on, and any relaxation.'),
      facet('deadline', 'critical', 'Applications after the last date are not accepted.', 'Confirm the last date to apply in the official notification.'),
      facet('fee', 'important', 'You may need to pay before the deadline.', 'Confirm the application fee and any category-wise exemptions.'),
      facet('selection', 'important', 'Shows what stages you must prepare for.', 'Confirm the stages of selection and the syllabus or criteria.'),
      facet('amount', 'important', 'Pay determines whether the role meets your needs.', 'Confirm the pay scale or salary in the official notification.'),
      facet('vacancies', 'useful', 'Indicates competition and category-wise availability.', 'Check the number of vacancies and their distribution.'),
      facet('documents', 'important', 'Document verification can disqualify candidates.', 'List the certificates required at application and verification stages.'),
      facet('howToApply', 'important', 'Unofficial channels may be fraudulent.', 'Apply only through the employer’s official site or portal.'),
    ],
  },
  research: {
    label: 'Research or literature review',
    detect: /\b(study|studies|research(?:ers)?|literature|papers?|evidence|meta-analysis|trial|journal|systematic review|efficacy|effect of|impact of)\b/i,
    facets: [
      facet('methodology', 'critical', 'Study design determines how much weight a result deserves.', 'Check the study design and whether it fits the claim being made.'),
      facet('sample', 'important', 'Small or narrow samples limit generalisation.', 'Find the sample size and population studied.'),
      facet('findings', 'critical', 'The core result you are relying on.', 'Read the results section directly rather than secondary summaries.'),
      facet('limitations', 'important', 'Authors’ own caveats show where results may not hold.', 'Look for a limitations section or reviewer commentary.'),
      facet('funding', 'useful', 'Funding sources can indicate potential conflicts of interest.', 'Check funding and conflict-of-interest statements.'),
      facet('peerReview', 'important', 'Preprints and retracted papers need extra caution.', 'Confirm publication status, and check for corrections or retractions.'),
      facet('dates', 'useful', 'Newer studies may supersede older ones.', 'Check publication dates and look for more recent work on the topic.'),
    ],
  },
  publicService: {
    label: 'Public service or government process',
    detect: /\b(passport|aadhaar|pan card|licen[cs]e|certificate|ration card|visa|permit|registration|government|municipal|scheme|yojana|pension|subsidy|tax|ministry|department)\b/i,
    facets: [
      facet('eligibility', 'critical', 'Determines whether the service applies to you.', 'Confirm eligibility on the department’s official website.'),
      facet('documents', 'critical', 'Missing documents cause rejected or delayed applications.', 'Get the official list of required documents and accepted formats.'),
      facet('fee', 'important', 'Unexpected charges are common with unofficial agents.', 'Confirm the official fee and accepted payment methods.'),
      facet('process', 'important', 'You need to know the correct steps and office.', 'Confirm the official procedure (online portal or office visit).'),
      facet('processingTime', 'useful', 'Helps plan around deadlines.', 'Check the stated processing time and how to track status.'),
      facet('duration', 'useful', 'Some documents expire and need renewal.', 'Check validity period and renewal rules.'),
      facet('contact', 'useful', 'Needed for grievances or follow-up.', 'Note the official helpline or grievance channel.'),
      facet('authority', 'important', 'Only the issuing authority’s information is authoritative.', 'Identify the responsible department and use its official source.'),
    ],
  },
  general: {
    label: 'General research',
    detect: null,
    facets: [
      facet('requirements', 'important', 'Requirements and conditions shape any decision.', 'Confirm requirements against an authoritative source.'),
      facet('dates', 'important', 'Dates show whether information is current.', 'Look for a current date, deadline or timeline.'),
      facet('cost', 'useful', 'Cost is often part of the decision.', 'Check whether costs or fees apply.'),
      facet('process', 'useful', 'Explains what you need to do next.', 'Find the official procedure or next steps.'),
      facet('authority', 'important', 'Primary sources are more reliable than summaries.', 'Identify the original or official source of this information.'),
      facet('contact', 'useful', 'Lets you resolve remaining questions directly.', 'Find an official contact for follow-up questions.'),
    ],
  },
};

export const PROFILE_KEYS = Object.keys(PROFILES);

export function detectProfile(question) {
  // Order matters: more specific profiles first.
  for (const key of ['scholarship', 'job', 'publicService', 'research']) {
    if (PROFILES[key].detect.test(question)) return key;
  }
  return 'general';
}
