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
        The server fetches each public web page or PDF link you add, follows up to five redirects (each one re-checked), and
        extracts the readable text. You can also upload PDF files, whose text is extracted page by page so findings cite page
        numbers. Scanned PDFs without a text layer are reported as unreadable; no OCR is performed. Pages behind logins, paywalls
        or bot protection are not retrieved, and neither are private or internal network addresses. When web search is enabled,
        results are only snippets: a result becomes evidence only after you add it and its full page is retrieved. A source that
        cannot be read is shown as “Not retrieved” with the reason, and it is never counted as reviewed.
      </p>

      <h2>2. Extraction</h2>
      <p>
        The text is split into sentences. Sentences that mention a topic relevant to your research type, such as eligibility,
        deadlines, amounts, documents or renewal, are kept <strong>word for word</strong>. Dates, amounts, ages and percentages
        are read from those sentences. Nothing is paraphrased at this stage.
      </p>

      <h2>3. AI analysis first, rule engine as fallback</h2>
      <p>
        When the server has an AI provider configured (Groq), a language model reads the full text of every reviewed source and
        reports gaps and conflicting values, each with quotes. Every quote is then checked against the source: it must appear{' '}
        <strong>word for word</strong> in the source it cites, and any number in a stated value must appear in that quote.
        Anything that fails the check is dropped. Text inside sources is treated as data, never as instructions. These findings are
        labelled <Tag tone="ai">AI finding, quote verified</Tag>.
      </p>
      <p>
        If the AI is not configured, fails (an error, a timeout or a rate limit), returns a malformed reply, or returns nothing that
        can be matched to the source text, a keyword rule engine produces the findings instead. The Overview tab always says which
        one was used, and why. The rule engine gives the same result every time; the AI can differ slightly between runs.
      </p>

      <h2>4. Potential gaps</h2>
      <p>
        For each research type there is a list of information people usually need. If no reviewed source covers a topic, it is
        reported as <em>“not found in the sources reviewed”</em>. The rule engine also shows the wording it looked for, and checks a
        time period or place you set in the research scope, so a question about 2027 answered only by 2025 pages is flagged. A gap
        is a reason to look further, not proof that the information does not exist: it may be on a page you have not added.
      </p>

      <h2>5. Conflicting values</h2>
      <p>
        When two sources state different values for the same item (for example a deadline or an amount), the pair is shown side by
        side with both quotes. Differences that are probably explained by a different year or cycle, unit (monthly vs yearly) or
        group of people are labelled as such, rather than as contradictions.
      </p>

      <h2>6. Freshness</h2>
      <p>
        Freshness is always computed directly from the text, not by the AI, because it depends on exact date arithmetic.
        Publication and update dates are taken only from what the source declares: page metadata, structured data, or PDF
        document properties. They are kept separate from dates mentioned in the text, years inferred from it, and the retrieval
        time. The freshness threshold depends on the research type: 12 months for scholarships, jobs and public services, 24 for
        general research and 60 for academic research. Sources beyond it, stated deadlines that have passed, and undated pages that
        only mention older years are flagged. If no date is declared, the source is marked “Publication date not established”. That
        does not mean it is outdated.
      </p>

      <h2>7. Investigation quality and official domains</h2>
      <p>
        The overview lists factors that affect how far the findings can be relied on: how many sources were reviewed, how many
        independent publishers, topics covered, critical gaps, single-source topics, recent dates and official-domain sources. There
        is deliberately no single score. A source is marked as an official or academic domain only when its domain is reserved for
        such publishers (for example .gov.in, .nic.in, .edu, .ac.in). That describes the publisher type, not whether the page is
        current or correct.
      </p>

      <h2>Labels you will see</h2>
      <ul className="label-legend">
        <li><Tag tone="source">Source text</Tag> A sentence copied from a retrieved source.</li>
        <li><Tag tone="ai">AI finding, quote verified</Tag> Found by a language model; its quotes were matched in the source, but its judgement is not verified.</li>
        <li><Tag tone="sample">Simulated</Tag> Demonstration content that is not real.</li>
        <li><Tag tone="high">Possible contradiction</Tag> Different explicit values with no obvious difference in scope.</li>
        <li><Tag tone="info">Date not established</Tag> The source declares no publication or update date.</li>
        <li><Tag tone="ok">Marked done by you</Tag> You ticked a checklist item. The tool has not verified it.</li>
      </ul>

      <p><Link to="/" className="btn btn-primary">Start a research session</Link></p>
    </article>
  );
}
