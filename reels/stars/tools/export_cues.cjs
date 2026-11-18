// Write the sound cue list (cuts, punches, director cues) to work/cues.json for sound.py.
const fs = require('fs');
const { openReel } = require('./lib.cjs');
(async () => {
  const { browser, page } = await openReel();
  const data = await page.evaluate(() => ({ meta: window.__meta, cues: window.__cues() }));
  fs.mkdirSync('work', { recursive: true });
  fs.writeFileSync('work/cues.json', JSON.stringify(data, null, 1));
  console.log(`work/cues.json: ${data.cues.length} cues, duration ${data.meta.duration}s`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
