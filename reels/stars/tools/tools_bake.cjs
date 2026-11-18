// Bakes 12 cumulus cards into assets/cloud_XX.png. Needs `node server.mjs 8123` running.
// Usage: node tools/tools_bake.cjs [count=12] [first=0]
const fs = require('fs'), path = require('path');
const { chromium, ARGS, PORT } = require('./lib.cjs');
(async () => {
  const count = Number(process.argv[2] || 12), first = Number(process.argv[3] || 0);
  const browser = await chromium.launch({ args: ARGS });
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto(`http://localhost:${PORT}/tools/bake.html`);
  await page.waitForFunction(() => window.ready === true);
  fs.mkdirSync('assets', { recursive: true });
  for (let i = first; i < first + count; i++) {
    const t0 = Date.now();
    const url = await page.evaluate((i) => window.bake(i), i);
    const out = path.join('assets', `cloud_${String(i).padStart(2, '0')}.png`);
    fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
    console.log(out, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await browser.close();
})();
