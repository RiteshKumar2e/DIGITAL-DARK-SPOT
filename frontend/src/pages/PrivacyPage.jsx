import { usePageMeta } from '../hooks/usePageMeta.js';
import { Alert } from '../components/ui.jsx';
import { useRecentSessions } from '../hooks/useRecentSessions.js';

export default function PrivacyPage() {
  const { sessions, clear } = useRecentSessions();
  usePageMeta({
    title: 'Privacy policy',
    description: 'What Digital Dark Spot stores, what it sends to third parties, and how to delete your research sessions.',
    path: '/privacy',
  });

  return (
    <article className="container prose-page">
      <p className="eyebrow">Privacy</p>
      <h1>Privacy policy</h1>
      <Alert tone="warning" title="DRAFT: REVIEW REQUIRED">
        This policy describes how the software behaves as built. It has not been reviewed by a lawyer. The operator name,
        contact details, hosting location and legal basis must be completed before public launch.
      </Alert>

      <h2>Who operates this service</h2>
      <p>[Operator name and contact email: DRAFT, to be completed by the operator.]</p>

      <h2>What you submit and what is stored</h2>
      <ul>
        <li><strong>Research question, research type and optional scope</strong> (situation, location, time period) you enter.</li>
        <li><strong>Sources:</strong> the web addresses you add and the text retrieved from them (up to about 60,000 characters per source), text you paste, and the text extracted from PDF files you upload. Uploaded PDF files themselves are not stored: only their file name, page count and extracted text are kept.</li>
        <li><strong>Analysis results and checklist</strong> including which items you marked as done.</li>
      </ul>
      <p>
        This is stored on the server in a session identified by a long random link. There are no accounts. Anyone who has the
        session link can open it, so do not share the link if your research is private, and do not paste personal or sensitive
        information into a session.
      </p>

      <h2>How long it is kept</h2>
      <p>
        Sessions that have not been changed for the retention period set by the operator (30 days by default) are deleted
        automatically. You can delete a session immediately with “Delete this session” in the workspace.
      </p>

      <h2>Retrieving web pages</h2>
      <p>
        When you add a link, our server requests that page from the website that hosts it. That website will see a request from
        our server, not from your device.
      </p>

      <h2>Web search</h2>
      <p>
        If the operator has enabled web search, the search terms you type are sent to the configured search provider (Tavily or
        Brave Search) to return results. Their terms and privacy policies apply. Search results are not stored unless you add one as
        a source. [Operator to confirm which provider is used: DRAFT.]
      </p>

      <h2>AI processing</h2>
      <p>
        If the operator has enabled AI review, your question, scope and the extracted source text (including text from uploaded PDFs) are sent
        to Groq, Inc. for processing when you run an analysis. Each analysis shows whether AI review was used. Groq’s own terms and privacy policy apply to that
        processing. [Operator to confirm the data processing terms with Groq: DRAFT.]
      </p>

      <h2>Cookies, analytics and local storage</h2>
      <p>
        This site sets <strong>no cookies</strong> and uses <strong>no analytics or advertising trackers</strong>. Your browser’s
        local storage keeps a list of the sessions you opened on this device (link, question and date) so you can return to them.
        This list never leaves your device.
      </p>
      <p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={clear} disabled={!sessions.length}>
          {sessions.length ? `Clear the list on this device (${sessions.length})` : 'The list on this device is empty'}
        </button>
      </p>

      <h2>Server logs and security</h2>
      <p>
        The server keeps short-lived technical logs (for example errors) and uses your IP address in memory to limit request rates.
        Research questions and source text are not written to logs. The hosting provider may keep its own access logs. [Hosting
        provider and region: DRAFT.]
      </p>

      <h2>Your choices</h2>
      <p>
        You can delete any session at any time, and export its report before doing so. For other requests about your data, contact the operator. [Contact details and the
        applicable data protection rights: DRAFT, review required.]
      </p>
    </article>
  );
}
