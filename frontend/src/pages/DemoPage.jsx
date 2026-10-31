import SampleSessionButton from '../components/SampleSessionButton.jsx';
import { Tag } from '../components/ui.jsx';
import { usePageMeta } from '../hooks/usePageMeta.js';

const STEPS = [
  ['Run the analysis', 'Three sources are reviewed: an official notice, an education blog and a student forum thread.'],
  ['See an incomplete claim', 'Renewal conditions are not found in any of the sources reviewed.'],
  ['Compare two sources', 'The notice and the blog state different deadlines and amounts, shown side by side with both quotes.'],
  ['Check freshness', 'The blog was published over two years ago; the forum is undated and refers to an earlier cycle.'],
  ['Inspect the evidence', 'Open a citation to see the exact passage highlighted in the source.'],
  ['Work through the checklist', 'Mark an item done. The tool records that you checked it; it does not claim to have verified it.'],
  ['Export the report', 'Download the findings, evidence and checklist as Markdown, or open a printable version.'],
];

export default function DemoPage() {
  usePageMeta({
    title: 'Sample investigation',
    description: 'A guided, reproducible demonstration of Digital Dark Spot using clearly labelled simulated sources about a scholarship.',
    path: '/demo',
  });

  return (
    <div className="container prose-page demo-page">
      <p className="eyebrow">Sample investigation</p>
      <h1>See the whole workflow in two minutes</h1>
      <p className="lede">
        A student asks: <em>“What should I verify before applying for this scholarship?”</em> The sample session runs the real
        analysis on three short documents and walks you through what it finds.
      </p>
      <p className="row">
        <Tag tone="sample">Simulated sources</Tag>
        <span className="small muted">
          The scholarship, organisations and dates are invented for the demo. It works offline from external services and gives the
          same result each time.
        </span>
      </p>
      <ol className="steps demo-page-steps">
        {STEPS.map(([title, text], index) => (
          <li key={title}>
            <span className="step-num" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2 className="step-title">{title}</h2>
              <p>{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="row">
        <SampleSessionButton className="btn btn-primary btn-lg">Start the sample investigation</SampleSessionButton>
      </div>
      <p className="small muted">Each start creates a fresh copy, so you can reset the demo at any time.</p>
    </div>
  );
}
