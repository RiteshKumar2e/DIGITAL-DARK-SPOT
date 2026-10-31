/**
 * Demonstration mode. These documents are SIMULATED: the scholarship, the
 * organisations and the pages do not exist. They are written so that the
 * analysis has something realistic to find (a conflict, a stale page, an
 * undated page and a missing topic). Every sample source is labelled as
 * simulated in the API response and in the interface.
 */
export function buildDemoSources(now = new Date()) {
  const y = now.getUTCFullYear();
  return [
    {
      title: 'Simulated: "Sunrise Merit Scholarship" official notice',
      label: 'Simulated official notice',
      published: { value: `${y}-07-01`, origin: 'Sample data (simulated date)', raw: `${y}-07-01` },
      modified: { value: `${y}-08-14`, origin: 'Sample data (simulated date)', raw: `${y}-08-14` },
      text: `Sunrise Merit Scholarship ${y}-${String(y + 1).slice(2)}
The Sunrise Education Trust invites applications for the Sunrise Merit Scholarship for the academic year ${y}-${String(y + 1).slice(2)}.
Eligibility: Applicants must be enrolled in the first year of a full-time undergraduate degree at a recognised college in India.
Applicants must have scored a minimum of 75% marks in the Class 12 examination.
The annual family income of the applicant must be below ₹2.5 lakh from all sources.
The scholarship amount is ₹60,000 per year, paid directly to the student in two instalments.
The last date to submit the online application is 31 December ${y}.
Required documents: Class 12 mark sheet, income certificate issued by a competent authority, college admission letter, Aadhaar card, and a passport-size photograph.
Selection will be based on merit, followed by a telephone interview for shortlisted candidates.
How to apply: Register on the Trust's online application portal and submit the application form with all documents uploaded in PDF format.
For queries, contact the scholarship help desk by email.`,
    },
    {
      title: 'Simulated: education blog summary of the scholarship',
      label: 'Simulated blog post',
      published: { value: `${y - 2}-09-05`, origin: 'Sample data (simulated date)', raw: `${y - 2}-09-05` },
      modified: null,
      text: `Sunrise Merit Scholarship: everything you need to know
The Sunrise Merit Scholarship is one of the most popular private scholarships for undergraduate students.
Students who have just joined a full-time undergraduate course can apply.
The scholarship amount is ₹50,000 per year for selected students.
The deadline to apply is 15 December ${y}, so make sure you apply early.
Selection is merit based and shortlisted students are interviewed.
For income proof, upload your parents' salary slips or the latest income tax return (ITR), along with your mark sheet.
Many students also ask about coaching support, but the Trust has not shared details on this.`,
    },
    {
      title: 'Simulated: student forum FAQ thread',
      label: 'Simulated forum thread',
      published: null,
      modified: null,
      text: `FAQ thread: Sunrise Merit Scholarship (${y - 3}-${String(y - 2).slice(2)} cycle)
Question: What is the income limit for the scholarship?
Answer: For the ${y - 3}-${String(y - 2).slice(2)} cycle the annual family income limit was ₹3 lakh.
Question: When do applications close?
Answer: Applications closed on 30 September ${y - 2} last time.
Question: Is there an application fee?
Answer: I did not pay any application fee when I applied.
Question: What happens after selection?
Answer: Selected students get an email from the help desk and have to send their bank details.`,
    },
  ];
}

export const DEMO_QUESTION =
  'What should I verify before applying for the Sunrise Merit Scholarship, including eligibility, the current deadline, documents and whether it can be renewed?';

export const DEMO_CONTEXT = { situation: 'First-year undergraduate student', location: 'India', period: 'Current academic year' };
