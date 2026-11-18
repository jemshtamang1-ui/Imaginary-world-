// Shared Playwright launcher for bake / frames / render workers.
const { chromium } = require('playwright');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--force-color-profile=srgb', '--hide-scrollbars'];
const PORT = process.env.PORT || 8123;
async function openReel({ w = 1920, h = 1080, query = '' } = {}) {
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://localhost:${PORT}/?render=1&w=${w}&h=${h}${query}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000, polling: 200 });
  return { browser, page };
}
async function frame(page, t) {
  await page.evaluate((t) => window.__render(t), t);
  return page.screenshot({ type: 'png', animations: 'disabled', caret: 'initial' });
}
module.exports = { chromium, ARGS, PORT, openReel, frame };
