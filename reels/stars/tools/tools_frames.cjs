// Render review stills. Usage: node tools/tools_frames.cjs 0.6,4.2,7.9 work/review/fr_ [w] [h]
const fs = require('fs'), path = require('path');
const { openReel, frame } = require('./lib.cjs');
(async () => {
  const times = process.argv[2].split(',').map(Number), prefix = process.argv[3] || 'work/review/fr_';
  const w = Number(process.argv[4] || 1920), h = Number(process.argv[5] || 1080);
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  const { browser, page } = await openReel({ w, h });
  for (const t of times) {
    const t0 = Date.now();
    const buf = await frame(page, t);
    const out = `${prefix}${t.toFixed(2).padStart(6, '0')}.png`;
    fs.writeFileSync(out, buf);
    console.log(out, ((Date.now() - t0) / 1000).toFixed(2) + 's');
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
