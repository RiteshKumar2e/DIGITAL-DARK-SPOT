import { Link } from 'react-router-dom';
import { Tag } from '../components/ui.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';

const EXAMPLE_QUESTION = 'What should I verify before applying for this scholarship?';

const DEMO_STEPS = [
  ['Review the sources', 'An official notice, an education blog and a student forum thread are retrieved and read.'],
  ['Extract eligibility and application details', 'Sentences about eligibility, amounts, deadlines and documents are kept word for word, with their source.'],
  ['Find missing renewal conditions', 'No source says whether the scholarship continues after the first year.', 'Potential gap'],
  ['Compare document requirements', 'The notice asks for an income certificate; the blog mentions salary slips or an ITR.', 'Document lists differ'],
  ['Check the deadline’s cycle', 'The forum’s closing date belongs to an earlier cycle and has already passed.', 'Possibly outdated'],
  ['Produce a checklist', 'Confirm the current deadline, the official document list, the renewal policy and the application link.'],
];

const WORKFLOW = [
  ['Collect', 'Ask your question, then add sources: web pages, PDF documents, pasted text, or search results when search is enabled. Each source is retrieved on the server and shows whether it could be read.'],
  ['Investigate', 'Statements are extracted word for word. The analysis checks which topics no source covers, where sources state different values, and which sources look dated.'],
  ['Verify', 'Every finding links to its evidence and becomes a prioritised checklist item. Export the report when you are done.'],
];

const CAPABILITIES = [
  ['Multi-source review', 'Up to ten web pages, PDF documents or pasted texts per session, each with its retrieval status, declared dates and an official-domain signal.'],
  ['Structured extraction', 'Statements are grouped by topic (eligibility, deadline, amount, documents, renewal…) in a coverage table across sources.'],
  ['Potential gap detection', 'Topics your research type needs that no reviewed source mentions are listed as “not found in the sources reviewed”, with the search scope.'],
  ['Conflict identification', 'Different dates, amounts, age or income limits and document lists are shown side by side, with likely explanations such as a different cycle.'],
  ['Freshness warnings', 'Old publication dates, passed deadlines and undated pages are flagged, and the reason for each warning is stated.'],
  ['Source-linked evidence', 'Every quote opens the original text with the passage highlighted, a page number for PDFs, and a link to the live page.'],
  ['Prioritised verification and export', 'High-priority items cover blockers such as eligibility, deadlines and conflicts. The full report exports as Markdown or a printable page.'],
  ['Transparent uncertainty', 'Evidence strength reflects how much text was actually reviewed. AI suggestions, when enabled, are labelled and quote-checked.'],
];

export default function HomePage() {
  usePageMeta({
    title: null,
    description:
      'Digital Dark Spot compares information across the sources you collect, uncovers potential gaps, conflicting claims and outdated details, and tells you what to verify next.',
    path: '/',
  });

  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">AI-assisted research intelligence</p>
            <h1 id="hero-heading">
              Find what the sources <span className="underline-mark">leave out</span>.
            </h1>
            <p className="lede">
              Compare evidence, uncover missing details, flag conflicting claims, and know what to verify next.
            </p>
            <div className="hero-actions">
              <Link to="/research" className="btn btn-primary btn-lg">
                Start a research session
              </Link>
              <Link to="/demo" className="btn btn-secondary btn-lg">
                Explore a sample investigation
              </Link>
            </div>
            <p className="small muted">No account needed. Findings are prompts to verify, not verdicts.</p>
          </div>
          <figure className="hero-figure">
            <img
              src="/images/app-preview.webp"
              width="1200"
              height="900"
              alt="The Digital Dark Spot workspace showing a sample scholarship session: sources on the left, and a possible contradiction between two deadlines with both quotes side by side."
              fetchPriority="high"
              decoding="async"
            />
            <figcaption className="small muted">
              The real workspace, running the sample session. <Tag tone="sample">Simulated sources</Tag>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="section container problem" aria-labelledby="problem-heading">
        <div className="problem-grid">
          <div className="section-intro">
            <p className="eyebrow">The information-gap problem</p>
            <h2 id="problem-heading">Search finds pages. Summaries condense them. Neither tells you what is missing.</h2>
          </div>
          <ul className="problem-list">
            <li>
              <strong>Incomplete.</strong> Eligibility is explained, but renewal conditions or the full document list are not.
            </li>
            <li>
              <strong>Contradictory.</strong> An official notice and a blog give different deadlines or amounts.
            </li>
            <li>
              <strong>Outdated.</strong> A forum answer describes last year’s application cycle, with no date on the page.
            </li>
          </ul>
        </div>
      </section>

      <section id="demo" tabIndex={-1} className="section demo" aria-labelledby="demo-heading">
        <div className="container demo-grid">
          <div className="demo-intro">
            <p className="eyebrow">Walkthrough</p>
            <h2 id="demo-heading">One question, followed through the product</h2>
            <p className="demo-question">“{EXAMPLE_QUESTION}”</p>
            <p className="small muted">
              The findings on the right are what the sample session produces. Its three sources are simulated documents written
              for demonstration, not real pages.
            </p>
            <div className="row">
              <Link to="/demo" className="btn btn-primary">
                Explore the sample investigation
              </Link>
              <Link to={`/research?q=${encodeURIComponent(EXAMPLE_QUESTION)}`} className="btn btn-ghost">
                Use this question with your own sources
              </Link>
            </div>
          </div>
          <ol className="demo-steps">
            {DEMO_STEPS.map(([title, text, tag], index) => (
              <li key={title}>
                <span className="demo-num" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>
                    {title} {tag && <Tag tone={tag === 'Possibly outdated' ? 'medium' : 'high'}>{tag}</Tag>}
                  </h3>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="how-it-works" tabIndex={-1} className="section container" aria-labelledby="how-heading">
        <div className="section-intro">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading">Collect, investigate, verify</h2>
        </div>
        <ol className="steps">
          {WORKFLOW.map(([title, text], index) => (
            <li key={title}>
              <span className="step-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="capabilities" tabIndex={-1} className="section capabilities" aria-labelledby="cap-heading">
        <div className="container cap-grid">
          <div className="section-intro">
            <p className="eyebrow">Capabilities</p>
            <h2 id="cap-heading">Built to show what search and summaries leave out</h2>
            <p className="muted">
              A summary condenses what is there. Digital Dark Spot also reports what is not there, where sources disagree, and
              how current they are.
            </p>
          </div>
          <dl className="cap-list">
            {CAPABILITIES.map(([title, text]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="trust" tabIndex={-1} className="section container trust" aria-labelledby="trust-heading">
        <div className="section-intro">
          <p className="eyebrow">Trust and transparency</p>
          <h2 id="trust-heading">It tells you what it checked, and what it could not</h2>
        </div>
        <div className="trust-grid">
          <div className="stack">
            <p>
              Findings describe the sources you added, nothing more. A potential gap means the topic was{' '}
              <strong>not found in the sources reviewed</strong>. It may still exist elsewhere. Pages that could not be retrieved
              are listed with the reason and are never counted as reviewed.
            </p>
            <p>Every label in the workspace tells you where a piece of text came from:</p>
            <ul className="label-legend">
              <li><Tag tone="source">Source text</Tag> Copied word for word from a retrieved source.</li>
              <li><Tag tone="ai">AI-generated, unverified</Tag> Written by a language model, when AI review is enabled.</li>
              <li><Tag tone="sample">Simulated</Tag> Demonstration content that is not real.</li>
              <li><Tag tone="info">Date unavailable</Tag> The page declares no date, so its currency is unknown.</li>
            </ul>
          </div>
          <aside className="limits" aria-labelledby="limits-heading">
            <h3 id="limits-heading">What it does not do</h3>
            <ul>
              <li>It does not search the web. It reviews the sources you add.</li>
              <li>It cannot read pages behind logins, paywalls or bot protection.</li>
              <li>It does not decide what is true or give legal, financial or admissions advice.</li>
            </ul>
            <Link to="/method">Read the full method and its limits</Link>
          </aside>
        </div>
      </section>

      <section className="section final-cta" aria-labelledby="final-heading">
        <div className="container final-cta-inner">
          <h2 id="final-heading">Have a decision to make? Check your sources first.</h2>
          <Link to="/research" className="btn btn-primary btn-lg">
            Start a research session
          </Link>
        </div>
      </section>
    </>
  );
}
