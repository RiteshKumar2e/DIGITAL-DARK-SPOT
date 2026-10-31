import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { Tag } from '../components/ui.jsx';

export default function MethodPage() {
  usePageMeta({
    title: 'How it works',
    description: 'How Digital Dark Spot retrieves sources and detects potential gaps, conflicting values and outdated information, and the limits of each check.',
    path: '/method',
  });

  return (
    <article className="container prose-page">
      <p className="eyebrow">Method</p>
      <h1>How Digital Dark Spot reviews your sources</h1>
      <p className="lede">
        Every check is designed so you can see what it is based on. This page explains each step and where it can go wrong.
      </p>

      <h2>1. Retrieval</h2>
      <p>
        The server fetches each public web page you add, follows up to five redirects, and extracts the readable text. Pages behind
        logins, paywalls or bot protection are not retrieved, and neither are private or internal network addresses. PDF files are
        not read yet; you can paste their text instead. A page that cannot be read is shown as “Not retrieved” with the reason,
        and it is never counted as reviewed.
      </p>

      <h2>2. Extraction</h2>
      <p>
        The text is split into sentences. Sentences that mention a topic relevant to your research type, such as eligibility,
        deadlines, amounts, documents or renewal, are kept <strong>word for word</strong>. Dates, amounts, ages and percentages
        are read from those sentences. Nothing is paraphrased at this stage.
      </p>

      <h2>3. Potential gaps</h2>
      <p>
        For each research type there is a list of information people usually need. If no reviewed source contains wording about
        a topic, it is reported as <em>“not found in the sources reviewed”</em>. Each gap shows the sources searched and the
        wording looked for. A gap is a reason to look further, not proof that the information does not exist: the sources may
        use different words, or it may be on a page you have not added.
      </p>

      <h2>4. Conflicting values</h2>
      <p>
        When two sources each state a single, explicit value for the same item (for example a deadline or an amount) and the
        values differ, the pair is shown side by side with both quotes. Differences that are probably explained by a different
        year or cycle, unit (monthly vs yearly) or group of people are labelled as such, rather than as contradictions.
      </p>

      <h2>5. Freshness</h2>
      <p>
        Publication and update dates are taken only from what the page declares in its metadata or structured data. Sources dated
        more than 12 months ago, stated deadlines that have passed, and undated pages that only mention older years are flagged.
        If no date is found, the source is marked “Date unavailable”. That does not mean it is outdated.
      </p>

      <h2>6. Optional AI review</h2>
      <p>
        If the server operator has configured an AI provider (Groq), the sources are also sent to a language model for a short
        summary, further gap suggestions and a second opinion on conflicts. Text inside sources is treated as data, not as
        instructions. Any key point the model returns must include a quote, and quotes that cannot be found word for word in the
        source are discarded. AI output is always labelled <Tag tone="ai">AI-generated</Tag>.
      </p>

      <h2>Labels you will see</h2>
      <ul className="label-legend">
        <li><Tag tone="source">Source text</Tag> A sentence copied from a retrieved source.</li>
        <li><Tag tone="ai">AI-generated, unverified</Tag> Written by a language model. Check it yourself.</li>
        <li><Tag tone="sample">Simulated</Tag> Demonstration content that is not real.</li>
        <li><Tag tone="high">Possible contradiction</Tag> Different explicit values with no obvious difference in scope.</li>
        <li><Tag tone="info">Date unavailable</Tag> No declared date was found.</li>
      </ul>

      <p><Link to="/" className="btn btn-primary">Start a research session</Link></p>
    </article>
  );
}
