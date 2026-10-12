// Rebuild deterministic public artwork using the installed Chrome and brand SVG.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
const mark = await readFile(new URL('../assets/brand/mark/patternly-mark-mint.svg', import.meta.url), 'utf8');
await writeFile(new URL('../public/favicon.svg', import.meta.url), mark);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [size, file] of [[32, 'favicon-32.png'], [180, 'apple-touch-icon.png']]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0;background:#0c1324;display:grid;place-items:center;width:100vw;height:100vh}svg{width:75%;height:75%}</style>${mark}`);
    await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
  }
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<style>body{margin:0;background:#0c1324;color:#edf4ff;font-family:Arial,sans-serif;padding:76px;box-sizing:border-box}header{display:flex;align-items:center;gap:20px;font-size:34px;font-weight:bold}svg{width:54px;height:54px}h1{font-size:72px;line-height:1.1;letter-spacing:-3px;margin:64px 0 24px;max-width:960px}em{font-style:normal;color:#5eead4}p{font-size:26px;color:#becbdf}</style><header>${mark}Patternly</header><h1>Build <em>confidence</em><br>through practice.</h1><p>Technical interviews · Cloud certifications</p>`);
  await page.screenshot({ path: new URL('../public/social-preview.png', import.meta.url).pathname });
} finally { await browser.close(); }
