import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';
import ContactLinks from '../components/ContactLinks.jsx';

const NAV = [
  { to: '/#how-it-works', label: 'How it works', hash: true },
  { to: '/demo', label: 'Sample investigation' },
  { to: '/method', label: 'Method' },
  { to: '/research', label: 'Research workspace', end: true },
];

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const toggleRef = useRef(null);
  const mainRef = useRef(null);

  // Close the mobile menu on navigation; scroll to an in-page section when the
  // link has a hash, otherwise move to the top and focus the new page.
  useEffect(() => {
    setMenuOpen(false);
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
        return;
      }
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.hash, location.key]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="brand-link" aria-label="Digital Dark Spot home">
            <Logo />
          </Link>
          <button
            ref={toggleRef}
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-icon" aria-hidden="true" />
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <nav id="site-nav" className={`site-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main">
            <ul>
              {NAV.map((item) => (
                <li key={item.to}>
                  {item.hash ? (
                    <Link to={item.to}>{item.label}</Link>
                  ) : (
                    <NavLink to={item.to} end={item.end}>
                      {item.label}
                    </NavLink>
                  )}
                </li>
              ))}
              <li>
                {/* Stays on the current page and scrolls to the footer contact links. */}
                <Link to={{ pathname: location.pathname, hash: '#contact' }}>Contact</Link>
              </li>
              <li className="nav-cta">
                <Link to="/research" className="btn btn-primary btn-sm">
                  Start research
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer" id="contact" tabIndex={-1}>
        <div className="container site-footer-inner">
          <Link to="/" className="brand-link footer-logo" aria-label="Digital Dark Spot home">
            <Logo />
          </Link>
          <nav aria-label="Footer">
            <ul className="footer-links">
              <li>
                <Link to="/research">Research</Link>
              </li>
              <li>
                <Link to="/demo">Sample</Link>
              </li>
              <li>
                <Link to="/method">Method</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy</Link>
              </li>
              <li>
                <Link to="/terms">Terms</Link>
              </li>
            </ul>
          </nav>
          <ContactLinks />
        </div>
        <p className="container footer-note small muted">Findings are prompts for verification, not verified facts.</p>
      </footer>
    </>
  );
}
