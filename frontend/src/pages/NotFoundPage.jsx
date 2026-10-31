import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta.js';
import { LogoMark } from '../components/Logo.jsx';

export default function NotFoundPage() {
  usePageMeta({ title: 'Page not found', description: 'This page does not exist.', noindex: true });
  return (
    <div className="container not-found">
      <LogoMark size={72} />
      <p className="eyebrow">Error 404</p>
      <h1>This page is a dark spot.</h1>
      <p className="lede">The address may be mistyped, or the page may have moved. Research sessions use long private links, so check the full link.</p>
      <div className="row">
        <Link to="/" className="btn btn-primary">Start a research session</Link>
        <Link to="/method" className="btn btn-secondary">How it works</Link>
      </div>
    </div>
  );
}
