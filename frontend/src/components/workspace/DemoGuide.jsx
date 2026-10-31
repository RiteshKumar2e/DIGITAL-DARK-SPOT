import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { researchApi } from '../../services/researchApi.js';
import { rememberSession } from '../../hooks/useRecentSessions.js';

/**
 * Guided walkthrough for the sample investigation. Every step acts on the
 * real workspace; nothing here is pre-rendered.
 */
export default function DemoGuide({ session, analyzing, onAnalyze, setActiveTab, goToFinding, openSource }) {
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);
  const { analysis } = session;
  const ready = Boolean(analysis);

  const gap = analysis?.gaps.find((g) => g.facet === 'renewal') || analysis?.gaps[0];
  const conflict = analysis?.contradictions.find((c) => c.classification === 'possible_conflict');
  const claim = conflict && analysis.claims.find((c) => c.id === conflict.claimA.claimId);

  async function reset() {
    setResetting(true);
    try {
      const { session: fresh } = await researchApi.createDemoSession();
      rememberSession(fresh);
      navigate(`/research/${fresh.id}`, { replace: true });
    } finally {
      setResetting(false);
    }
  }

  const steps = [
    { label: 'Run the analysis on three sources', action: onAnalyze, actionLabel: ready ? 'Run again' : analyzing ? 'Analysing…' : 'Run analysis', always: true },
    { label: 'An incomplete claim: renewal conditions not found', action: () => gap && goToFinding('gap', gap.id), actionLabel: 'Show gap' },
    { label: 'Two sources with different deadlines', action: () => conflict && goToFinding('contradiction', conflict.id), actionLabel: 'Show conflict' },
    { label: 'An outdated and an undated source', action: () => setActiveTab('freshness'), actionLabel: 'Show freshness' },
    { label: 'Inspect the evidence behind the deadline', action: () => claim && openSource(claim.sourceId, claim.text), actionLabel: 'Open evidence' },
    { label: 'Work through the prioritised checklist', action: () => setActiveTab('checklist'), actionLabel: 'Open checklist' },
    { label: 'Export the research report', action: () => document.querySelector('.export-bar')?.scrollIntoView({ block: 'center' }), actionLabel: 'Go to export' },
  ];

  return (
    <section className="demo-guide" aria-labelledby="demo-guide-heading">
      <div className="row space-between">
        <h2 id="demo-guide-heading">Guided demo</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={resetting}>
          {resetting ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
      <ol className="demo-guide-steps">
        {steps.map((step) => (
          <li key={step.label}>
            <span>{step.label}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={step.action} disabled={(!ready && !step.always) || (step.always && analyzing)}>
              {step.actionLabel}
            </button>
          </li>
        ))}
      </ol>
      {!ready && <p className="small muted">Start with step 1; the other steps unlock after the analysis runs.</p>}
    </section>
  );
}
