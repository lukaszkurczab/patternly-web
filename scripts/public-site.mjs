import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createElement } from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { publicPages, publicPageFile, publicOrigin as origin } from '../src/publicPages.js';

function metadataTags(page, pages, localTest) {
  const tags = [
    { tag: 'meta', attrs: { name: 'description', content: page.description } },
    { tag: 'link', attrs: { rel: 'canonical', href: origin + page.path } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
    { tag: 'link', attrs: { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' } },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
    ...Object.entries({ 'og:type': 'website', 'og:site_name': 'Patternly', 'og:title': page.title, 'og:description': page.description, 'og:url': origin + page.path, 'og:image': origin + '/social-preview.png', 'og:image:width': '1200', 'og:image:height': '630', 'og:image:alt': 'Patternly — Build confidence through practice' }).map(([property, content]) => ({ tag: 'meta', attrs: { property, content } })),
    ...Object.entries({ 'twitter:card': 'summary_large_image', 'twitter:title': page.title, 'twitter:description': page.description, 'twitter:image': origin + '/social-preview.png', ...(localTest || !page.indexable ? { robots: 'noindex, nofollow' } : {}) }).map(([name, content]) => ({ tag: 'meta', attrs: { name, content } })),
  ];
  if (page.kind === 'legal' && page.indexable) {
    for (const alternative of pages.filter((candidate) => candidate.kind === 'legal' && candidate.document === page.document && candidate.indexable)) {
      tags.push({ tag: 'link', attrs: { rel: 'alternate', hrefLang: alternative.locale, href: origin + alternative.path } });
    }
  }
  return tags;
}

function pageShell(html, page) {
  return html.replace(/<html\s+lang="[^"]*"/u, `<html lang="${page.locale}"`)
    .replace(/<title>[^<]*<\/title>/u, () => renderToStaticMarkup(createElement('title', null, page.title)))
    .replace(/<meta\b[^>]*(?:name="(?:description|robots|twitter:[^"]+)"|property="og:[^"]+")[^>]*\/?\s*>/gu, '')
    .replace(/<link\b[^>]*rel="(?:canonical|alternate|icon|apple-touch-icon)"[^>]*\/?\s*>/gu, '');
}

export function publicSitePlugin(legal, localTest) {
  let root;
  let output;
  const pages = publicPages(legal);
  return {
    name: 'patternly-public-site',
    apply: 'build',
    configResolved(config) { root = config.root; output = resolve(root, config.build.outDir); },
    transformIndexHtml(html, context) {
      const page = pages.find((candidate) => candidate.locale === 'en' && candidate.template === context.filename.split('/').pop());
      if (!page) return html;
      return { html: pageShell(html, page), tags: metadataTags(page, pages, localTest) };
    },
    async closeBundle() {
      const server = await createServer({ configFile: false, root, appType: 'custom', logLevel: 'error', esbuild: { jsx: 'automatic' }, define: { __PATTERNLY_PUBLIC_LEGAL__: JSON.stringify(legal) }, server: { middlewareMode: true } });
      try {
        const { PublicPage } = await server.ssrLoadModule('/src/pages/PublicPage.jsx');
        const { PublicTrackPage } = await server.ssrLoadModule('/src/pages/PublicTrackPage.jsx');
        const { PublicLegalPage } = await server.ssrLoadModule('/src/pages/PublicLegalPage.jsx');
        const templates = Object.fromEntries(await Promise.all([...new Set(pages.map((page) => page.template))].map(async (name) => [name, await readFile(resolve(output, name), 'utf8')])));
        for (const page of pages) {
          const component = page.kind === 'home' ? createElement(PublicPage) : page.kind === 'track' ? createElement(PublicTrackPage, { page }) : createElement(PublicLegalPage, { document: page.document, initialLocale: page.locale });
          let html = pageShell(templates[page.template], page);
          if (!html.includes('<div id="root"></div>')) throw new Error(`Prerender root missing for ${page.path}.`);
          const tags = metadataTags(page, pages, localTest).map(({ tag, attrs }) => renderToStaticMarkup(createElement(tag, attrs))).join('\n');
          html = html.replace('</head>', () => `${tags}\n</head>`).replace('<div id="root"></div>', () => `<div id="root">${renderToString(component)}</div>`);
          const destination = resolve(output, publicPageFile(page));
          await mkdir(dirname(destination), { recursive: true });
          await writeFile(destination, html);
        }
        await writeFile(resolve(output, 'robots.txt'), localTest ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
        await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.filter((page) => page.indexable).map(({ path }) => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>\n`);
      } finally { await server.close(); }
    },
  };
}
