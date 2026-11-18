// Render frames [start, end) at fps and pipe them straight into an intermediate H.264 segment
// (no PNGs on disk). Usage: node tools/render_worker.cjs <start> <end> <fps> <out.mp4> [w] [h]
const { spawn } = require('child_process');
const { openReel, frame } = require('./lib.cjs');
(async () => {
  const [start, end, fps] = process.argv.slice(2, 5).map(Number), out = process.argv[5];
  const w = Number(process.argv[6] || 1920), h = Number(process.argv[7] || 1080);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const { browser, page } = await openReel({ w, h });
  const t0 = Date.now();
  for (let f = start; f < end; f++) {
    const buf = await frame(page, f / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((f - start) % 60 === 59) {
      const done = f - start + 1, rate = (Date.now() - t0) / 1000 / done;
      console.log(`[${out}] ${done}/${end - start} frames, ${rate.toFixed(2)}s/frame, ~${Math.round(rate * (end - f - 1))}s left`);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
