import { Link } from 'react-router-dom';
import NewResearchForm from '../components/NewResearchForm.jsx';
import RecentSessions from '../components/RecentSessions.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';

const STEPS = [
  ['Ask', 'Write the question you need answered, as specifically as you can.'],
  ['Collect', 'Add the pages you found: official notices, news, blogs, forums. You can also paste text from PDFs.'],
  ['Review', 'Each source is retrieved and read. Statements about eligibility, dates, amounts and other key facts are extracted word for word.'],
  ['Verify', 'You get potential gaps, possible conflicts and freshness warnings, each linked to its evidence, plus a prioritised checklist.'],
];

export default function HomePage() {
  usePageMeta({
    title: null,
    description:
      'Digital Dark Spot reviews the sources you collect and shows potential information gaps, conflicting claims and outdated details, with the evidence behind each finding.',
    path: '/',
  });

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Information gap detection</p>
            <h1>
              Find what your sources <span className="underline-mark">leave out</span>.
            </h1>
            <p className="lede">
              Scholarship pages, job notifications and government notices are often incomplete, contradictory or out of date.
              Digital Dark Spot reads the sources you collect and shows you what is missing, what disagrees and what to verify
              next.
            </p>
            <ul className="hero-points">
              <li>Every finding links to the exact sentence it is based on.</li>
              <li>Missing information is reported as “not found in the sources reviewed”, never as fact.</li>
              <li>Pages that could not be retrieved are listed, not silently skipped.</li>
            </ul>
          </div>
          <div className="hero-form panel">
            <h2 className="panel-title">Start a research session</h2>
            <NewResearchForm />
          </div>
        </div>
      </section>

      <section className="container steps-section" aria-labelledby="steps-heading">
        <h2 id="steps-heading">How a review works</h2>
        <ol className="steps">
          {STEPS.map(([title, text], index) => (
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
        <p className="small muted">
          Want the details?{' '}
          <Link to="/method">Read exactly how gaps, conflicts and freshness are detected, and the limits of each check.</Link>
        </p>
      </section>

      <div className="container home-lower">
        <RecentSessions />
        <aside className="limits" aria-labelledby="limits-heading">
          <h2 id="limits-heading">What it does not do</h2>
          <ul>
            <li>It does not search the web for you. It reviews only the sources you add.</li>
            <li>It cannot read pages behind logins, paywalls or bot protection.</li>
            <li>It does not decide what is true. It shows where sources are silent, disagree or look dated.</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
