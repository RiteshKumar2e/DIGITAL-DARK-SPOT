import { useRef } from 'react';
import Overview from './Overview.jsx';
import Checklist from './Checklist.jsx';
import { ContradictionList, FreshnessList, GapList } from './FindingCards.jsx';

export const TAB_FOR_TYPE = { gap: 'gaps', contradiction: 'conflicts', freshness: 'freshness' };

/** Accessible tabs (WAI-ARIA tabs pattern with arrow-key navigation). */
export default function Findings({ session, activeTab, setActiveTab, onChecklistChange, onGoToFinding }) {
  const { analysis, checklist } = session;
  const tabRefs = useRef({});
  const open = checklist.filter((i) => !i.done).length;
  const realConflicts = analysis.contradictions.length;
  const freshnessCount = analysis.freshness.filter((f) => f.severity !== 'info').length;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'gaps', label: 'Gaps', count: analysis.gaps.length },
    { key: 'conflicts', label: 'Conflicts', count: realConflicts },
    { key: 'freshness', label: 'Freshness', count: freshnessCount },
    { key: 'checklist', label: 'Checklist', count: open },
  ];

  function onKeyDown(event, index) {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    let next = null;
    if (event.key in keys) next = (index + keys[event.key] + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(tabs[next].key);
    tabRefs.current[tabs[next].key]?.focus();
  }

  return (
    <div className="findings">
      <div className="tabs" role="tablist" aria-label="Analysis results">
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(el) => (tabRefs.current[tab.key] = el)}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            className="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(e) => onKeyDown(e, index)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="tab-count">
                {tab.count}
                {tab.key === 'checklist' && <span className="visually-hidden"> open</span>}
              </span>
            )}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} className="tab-panel" tabIndex={0}>
        {activeTab === 'overview' && <Overview analysis={analysis} onGoToFinding={onGoToFinding} />}
        {activeTab === 'gaps' && <GapList gaps={analysis.gaps} aiGaps={analysis.ai?.additionalGaps} />}
        {activeTab === 'conflicts' && <ContradictionList items={analysis.contradictions} aiReviews={analysis.ai?.contradictionReviews} />}
        {activeTab === 'freshness' && (
          <FreshnessList items={analysis.freshness} timeline={analysis.timeline} thresholdMonths={analysis.freshnessThresholdMonths || 12} />
        )}
        {activeTab === 'checklist' && (
          <Checklist sessionId={session.id} items={checklist} onItemsChange={onChecklistChange} onGoToFinding={onGoToFinding} />
        )}
      </div>
    </div>
  );
}
