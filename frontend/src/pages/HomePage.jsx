import { Link } from 'react-router-dom';
import SampleSessionButton from '../components/SampleSessionButton.jsx';
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
  ['Define the question', 'State what you need to decide, as specifically as you can. The type of research decides which kinds of information are checked.'],
  ['Collect sources', 'Add the pages you found: official notices, news, blogs, forums. Paste text from PDFs or pages that block automated access.'],
  ['Analyse', 'Each page is retrieved and read on the server. Relevant sentences, dates, amounts and document names are extracted exactly as written.'],
  ['Review gaps and conflicts', 'See which topics no source covers, where sources state different values, and which pages look dated.'],
  ['Inspect the evidence', 'Open any finding to see the sentence it is based on, highlighted in the full retrieved text of its source.'],
  ['Work through the checklist', 'Every finding becomes a prioritised verification task you can tick off. Progress is saved with the session.'],
];

const CAPABILITIES = [
  ['Multi-source review', 'Up to ten pages or pasted texts per session, each with its retrieval status, word count and declared dates.'],
  ['Structured extraction', 'Statements are grouped by topic (eligibility, deadline, amount, documents, renewal…) in a coverage table across sources.'],
  ['Potential gap detection', 'Topics your research type needs that no reviewed source mentions are listed as “not found in the sources reviewed”, with the search scope.'],
  ['Conflict identification', 'Different dates, amounts, age or income limits and document lists are shown side by side, with likely explanations such as a different cycle.'],
  ['Freshness warnings', 'Old publication dates, passed deadlines and undated pages are flagged, and the reason for each warning is stated.'],
  ['Source-linked evidence', 'Every quote opens the original text with the passage highlighted, plus a link to the live page.'],
  ['Prioritised verification', 'High-priority items cover blockers such as eligibility, deadlines and conflicts; each explains why it matters.'],
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
              Find what’s <span className="underline-mark">missing</span> from the information you trust.
            </h1>
            <p className="lede">
              Compare information across sources, uncover unanswered questions, identify conflicting claims, and discover what to
              verify next.
            </p>
            <div className="hero-actions">
              <Link to="/research" className="btn btn-primary btn-lg">
                Start Research
              </Link>
              <Link to="/#how-it-works" className="btn btn-secondary btn-lg">
                See How It Works
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
              <SampleSessionButton className="btn btn-primary">Open the sample session</SampleSessionButton>
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
          <h2 id="how-heading">From question to checklist in six steps</h2>
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
            Start Research
          </Link>
        </div>
      </section>
    </>
  );
}
