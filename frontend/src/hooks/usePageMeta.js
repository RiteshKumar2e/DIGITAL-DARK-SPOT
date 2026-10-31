import { useEffect } from 'react';

const SITE_NAME = 'Digital Dark Spot';
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(path) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!SITE_URL || path === null) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = `${SITE_URL}${path}`;
}

/**
 * Sets per-route title, description, social tags and indexing rules.
 * Private pages (research sessions, 404) pass noindex.
 */
export function usePageMeta({ title, description, path = null, noindex = false }) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Find what your sources leave out`;
    document.title = fullTitle;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', fullTitle);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    if (SITE_URL && path !== null) setMeta('property', 'og:url', `${SITE_URL}${path}`);
    setCanonical(noindex ? null : path);
  }, [title, description, path, noindex]);
}
