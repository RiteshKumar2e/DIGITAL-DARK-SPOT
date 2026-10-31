import { usePageMeta } from '../hooks/usePageMeta.js';
import { Alert } from '../components/ui.jsx';

export default function TermsPage() {
  usePageMeta({
    title: 'Terms of use',
    description: 'The intended use of Digital Dark Spot, your responsibilities, and the limits of automated and AI-assisted findings.',
    path: '/terms',
  });

  return (
    <article className="container prose-page">
      <p className="eyebrow">Terms</p>
      <h1>Terms of use</h1>
      <Alert tone="warning" title="DRAFT: REVIEW REQUIRED">
        These terms describe the product honestly but have not been legally reviewed. Operator details, liability provisions and
        governing law are intentionally left open and must be completed by the operator.
      </Alert>

      <h2>What the service is for</h2>
      <p>
        Digital Dark Spot helps you review sources you have collected and points out information that may be missing,
        conflicting or outdated. It is a research aid. It does not give legal, financial, medical, immigration or admissions advice.
      </p>

      <h2>Findings are not verified facts</h2>
      <p>
        Findings are produced automatically by keyword rules and, where enabled, by an AI model. They can be wrong or incomplete.
        “Not found in the sources reviewed” only describes the sources you added. Always confirm important details, such as
        deadlines, eligibility and fees, with the official issuing organisation before acting on them.
      </p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only add sources you are allowed to access, and do not use the service to get around logins, paywalls or access controls.</li>
        <li>Do not submit personal, confidential or sensitive information belonging to you or others.</li>
        <li>Do not use the service to overload websites or for automated bulk retrieval. Requests are rate limited.</li>
        <li>Respect the copyright of the sources. Quotes are shown to explain findings and remain the property of their owners.</li>
      </ul>

      <h2>Source attribution</h2>
      <p>
        Each finding links back to its source. When you share conclusions drawn from this service, cite the original sources, not
        Digital Dark Spot.
      </p>

      <h2>Availability</h2>
      <p>
        The service is provided as a hackathon project and may change, be unavailable or be discontinued without notice. Sessions
        are deleted after the retention period described in the privacy policy.
      </p>

      <h2>Operator, liability and governing law</h2>
      <p>[DRAFT: to be completed by the operator after legal review.]</p>
    </article>
  );
}
