import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const origin = 'https://patternly.it';
const pages = {
  'index.html': { path: '/', title: 'Patternly — Build confidence through practice', description: 'Prepare for technical interviews and cloud certifications with practice questions and clear explanations.' },
  'privacy.html': { path: '/privacy', title: 'Privacy policy — Patternly', description: 'Read how Patternly handles personal data and how to contact us about privacy.' },
  'terms.html': { path: '/terms', title: 'Terms of service — Patternly', description: 'Read the terms for using Patternly, the independent technical interview and certification practice tool.' },
};

export function publicSitePlugin(legal, localTest) {
  let root;
  let output;
  return {
    name: 'patternly-public-site',
    apply: 'build',
    configResolved(config) { root = config.root; output = resolve(root, config.build.outDir); },
    transformIndexHtml(html, context) {
      const page = pages[context.filename.split('/').pop()];
      if (!page) return html;
      const tags = [
        { tag: 'link', attrs: { rel: 'canonical', href: origin + page.path } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        ...Object.entries({ 'og:type': 'website', 'og:site_name': 'Patternly', 'og:title': page.title, 'og:description': page.description, 'og:url': origin + page.path, 'og:image': origin + '/social-preview.png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': 'Patternly — Build confidence through practice' }).map(([property, content]) => ({ tag: 'meta', attrs: { property, content } })),
        ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': page.title, 'twitter:description': page.description, 'twitter:image': origin + '/social-preview.png', ...(localTest ? { robots: 'noindex, nofollow' } : {}) }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content } })),
      ];
      if (!html.includes('name="description"')) tags.push({ tag: 'meta', attrs: { name: 'description', content: page.description } });
      return { html, tags };
    },
    async closeBundle() {
      const server = await createServer({ configFile: false, root, appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, define: { __PATTERNLY_PUBLIC_LEGAL__: JSON.stringify(legal) }, server: { middlewareMode: true } });
      try {
        const { PublicPage } = await server.ssrLoadModule('/src/pages/PublicPage.jsx');
        const { PublicLegalPage } = await server.ssrLoadModule('/src/pages/PublicLegalPage.jsx');
        for (const name of Object.keys(pages)) {
          const component = name === 'index.html' ? createElement(PublicPage) : createElement(PublicLegalPage, { document: name === 'privacy.html' ? 'privacyPolicy' : 'termsOfService' });
          const html = await readFile(resolve(output, name), 'utf8');
          if (!html.includes('<div id="root"></div>')) throw new Error(`Prerender root missing in ${name}.`);
          await writeFile(resolve(output, name), html.replace('<div id="root"></div>', () => `<div id="root">${renderToString(component)}</div>`));
        }
        await writeFile(resolve(output, 'robots.txt'), localTest ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
        await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.values(pages).map(({ path }) => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>\n`);
      } finally { await server.close(); }
    },
  };
}
