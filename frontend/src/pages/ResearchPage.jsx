import { useSearchParams } from 'react-router-dom';
import NewResearchForm from '../components/NewResearchForm.jsx';
import RecentSessions from '../components/RecentSessions.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';

export default function ResearchPage() {
  const [params] = useSearchParams();
  const initial = (params.get('q') || '').slice(0, 500);
  usePageMeta({
    title: 'Research workspace',
    description: 'Start a research session: enter your question, add the sources you found, and review potential gaps, conflicts and outdated details.',
    path: '/research',
  });

  return (
    <div className="container research-start">
      <header className="research-start-head">
        <p className="eyebrow">Research workspace</p>
        <h1>Start a research session</h1>
        <p className="lede">
          Write your question, then add the pages you found on the next screen. The analysis checks them for missing,
          conflicting and outdated information and turns the results into a checklist.
        </p>
      </header>
      <div className="research-start-grid">
        <section className="panel" aria-labelledby="new-session-heading">
          <h2 id="new-session-heading" className="panel-title">
            Your question
          </h2>
          <NewResearchForm initialQuestion={initial} key={initial} />
        </section>
        <div className="stack">
          <RecentSessions />
          <aside className="limits" aria-labelledby="limits-heading">
            <h2 id="limits-heading">Before you start</h2>
            <ul>
              <li>It reviews only the sources you add. It does not search the web for you.</li>
              <li>Pages behind logins, paywalls or bot protection cannot be retrieved. Paste their text instead.</li>
              <li>Do not paste personal or sensitive information. Anyone with a session link can open it.</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
