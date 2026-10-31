import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '../components/Logo.jsx';

const NAV = [
  { to: '/', label: 'New research', end: true },
  { to: '/method', label: 'How it works' },
  { to: '/privacy', label: 'Privacy' },
];

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const toggleRef = useRef(null);
  const mainRef = useRef(null);

  // Close the mobile menu and move focus to the page content on navigation.
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

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
                  <NavLink to={item.to} end={item.end}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <div className="footer-brand">
            <Logo />
            <p className="small muted">
              Findings are prompts for verification, not verified facts. Always confirm important details with the issuing
              organisation.
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="footer-links">
              <li>
                <Link to="/method">How it works</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of use</Link>
              </li>
            </ul>
          </nav>
          <p className="small muted footer-note">Built for the Shinchan Online Hackathon 2026. Not affiliated with the Crayon Shin-chan franchise.</p>
        </div>
      </footer>
    </>
  );
}
