import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Public, indexable routes. Research sessions are private and never listed.
const PUBLIC_ROUTES = ['/', '/research', '/demo', '/method', '/privacy', '/terms'];

/**
 * Emits sitemap.xml and a robots.txt that references it, but only when the
 * deployment URL is known (VITE_SITE_URL). Without it, the static robots.txt
 * from /public is used and no sitemap is generated, so no domain is invented.
 */
function seoFiles(siteUrl) {
  return {
    name: 'dds-seo-files',
    apply: 'build',
    generateBundle() {
      if (!siteUrl) {
        this.warn('VITE_SITE_URL is not set: sitemap.xml was not generated.');
        return;
      }
      const base = siteUrl.replace(/\/$/, '');
      const today = new Date().toISOString().slice(0, 10);
      const urls = PUBLIC_ROUTES.map((path) => `  <url><loc>${base}${path}</loc><lastmod>${today}</lastmod></url>`).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\nDisallow: /research/\n\nSitemap: ${base}/sitemap.xml\n`,
      });
    },
  };
}

/** Fills in absolute canonical / Open Graph URLs in index.html when the site URL is known. */
function siteUrlInHtml(siteUrl) {
  const base = (siteUrl || '').replace(/\/$/, '');
  return {
    name: 'dds-site-url',
    transformIndexHtml(html) {
      if (!base) return html.replace(/\s*<!--site-url-->[\s\S]*?<!--\/site-url-->/g, '');
      return html.replace(/%SITE_URL%/g, base).replace(/<!--\/?site-url-->/g, '');
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (command === 'build' && mode === 'production' && (!env.VITE_API_BASE_URL || /localhost|127\.0\.0\.1/.test(env.VITE_API_BASE_URL))) {
    console.warn('\n[warning] VITE_API_BASE_URL is not set to a public backend URL. This build will call ' + (env.VITE_API_BASE_URL || 'http://localhost:4000') + '.\n          Set it before building for deployment.\n');
  }
  return {
    plugins: [react(), siteUrlInHtml(env.VITE_SITE_URL), seoFiles(env.VITE_SITE_URL)],
    server: { port: 5173, strictPort: true },
    preview: { port: 4173 },
  };
});
