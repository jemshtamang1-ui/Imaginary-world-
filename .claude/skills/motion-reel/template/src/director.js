// Worked example: "Imaginary World" channel teaser (14.6 s, 7 shots).
// Structure to keep when you write your own film:
//   shots: [{ name, t0, t1, palette, cam(lt, sp, t) -> {pos, look, fov, roll}, run(ctx, lt, sp, t) }]
//   fx:    global transitions [{ t, type: flash|whip|rush|wipe|shake|punch|crt|dark|fadeout, dur, ... }]
//   texts: kinetic type groups (see text.js for the markup)
//   cues:  extra sound cues (whooshes for cuts and impacts for ^punch words are added automatically)
import { lerp, clamp, inv, expoOut, cubicOut, cubicIn, cubicInOut, sineInOut, quintOut, smooth, bump, env, roundRect, ahead } from './director-kit.js';

export function build({ words }) {
  const shots = [], fx = [], texts = [], cues = [];
  const at = (w, n = 0) => { const hits = words.filter((x) => x.w.toLowerCase().replace(/[^a-z']/g, '') === w); return hits[n].t0; };

  // ---------------------------------------------------------------- 1. "What if the sky had a floor?"  (morning)
  const s1 = { name: 'floor', t0: 0, t1: 2.62, palette: 'morning',
    cam: move({ pos: [0, 150, 900], look: [300, 260, -3000], fov: 42 }, { pos: [60, 175, 560], look: [360, 300, -3000], fov: 40 }) };
  shots.push(s1);
  texts.push({ x: .075, y: .2, out: 2.45, lines: [{ text: 'What if the sky', size: 66 }, { text: 'had a +*floor?*' }] });
  fx.push({ t: at('floor'), type: 'punch', amount: .035, dur: .6 });
  cues.push({ t: at('floor'), type: 'impact', amount: .45 });

  // ---------------------------------------------------------------- 2. "A whole world above the clouds."  (midday, island)
  const c2a = { pos: [-900, 320, -200], look: [-1400, 340, -3200], fov: 40 }, c2b = { pos: [-960, 330, -330], look: [-1500, 360, -3200], fov: 38 };
  const s2 = { name: 'world', t0: 2.62, t1: 5.02, palette: 'midday', cam: move(c2a, c2b),
    run({ props, near }, lt, sp, t) {
      const e = expoOut(inv(0, 1.2, lt));
      props.island.set({ pos: near( 3.6, -1.2 - (1 - e) * 3, -13), rot: [.05, -.6, 0], scale: 1.05, t });
    } };
  shots.push(s2);
  fx.push({ t: s2.t0, type: 'whip', dir: 1, dur: .32, amount: 320 });
  texts.push({ x: .07, y: .26, out: 4.8, lines: [{ text: 'A whole', size: 60 }, { text: '+*world*', size: 290 }, { text: 'above the clouds.', size: 60 }] });

  // ---------------------------------------------------------------- 3. "Type a dream..."  (dream, glass prompt)
  const s3 = { name: 'dream', t0: 5.02, t1: 7.22, palette: 'dream',
    cam: move({ pos: [1500, 210, 800], look: [1700, 330, -2600], fov: 40 }, { pos: [1520, 290, 700], look: [1720, 360, -2600], fov: 40 }),
    run({ ui, W, H }, lt, sp, t) {
      const typeA = 5.55, typeB = 6.85, press = 7.0;
      ui.prompt({ x: W / 2, y: H * .66, w: 1120, inP: inv(5.1, 5.6, t), outP: inv(7.12, 7.22, t), text: 'a lighthouse on a cloud',
        typed: inv(typeA, typeB, t), press: bump(inv(press, press + .18, t)), t });
    } };
  shots.push(s3);
  fx.push({ t: s3.t0, type: 'flash', dur: .35, color: '#ffffff' });
  texts.push({ x: .5, y: .19, align: 'center', out: 7.0, lines: [{ text: 'Type a +*dream...*' }] });
  cues.push({ t: 5.12, type: 'pop' }, { t: 5.55, type: 'typing', dur: 1.3 }, { t: 7.0, type: 'click' });

  // ---------------------------------------------------------------- 4. "and watch it build."  (laptop, pill, swarm)
  const c4a = { pos: [600, 260, 2200], look: [700, 300, -1000], fov: 38 }, c4b = { pos: [620, 250, 2140], look: [690, 295, -1000], fov: 36 };
  const s4 = { name: 'build', t0: 7.22, t1: 8.72, palette: ['dream', 'midday'], cam: move(c4a, c4b, cubicOut),
    run({ props, ui, W, H, near }, lt, sp, t) {
      const e = expoOut(inv(7.22, 7.9, t));
      const lp = near( 3.1, -1.6 - (1 - e) * 1.5, -10);
      const prog = cubicInOut(inv(7.35, 7.95, t));
      props.laptop.set({ pos: lp, rot: [.12, -.5 + (1 - e) * .5, 0], scale: 1, open: expoOut(inv(7.25, 7.75, t)), draw: (g, w, h) => drawRenderScreen(g, w, h, prog, t) });
      props.swarm.set({ origin: [lp[0] - .3, lp[1] + 1.1, lp[2]], toward: near(0, 0, 2), p: inv(7.95, 9.2, t) });
      ui.pill({ x: W * .075, y: H * .8, anchor: 'left', inP: inv(7.3, 7.7, t), outP: inv(8.4, 8.6, t), label: 'Building', progress: prog });
    } };
  shots.push(s4);
  fx.push({ t: s4.t0, type: 'rush', dur: .3, amount: .14 });
  fx.push({ t: at('build'), type: 'shake', dur: .45, amount: 12 }, { t: at('build'), type: 'flash', dur: .25, amount: .35, attack: .02 });
  texts.push({ x: .075, y: .2, out: 8.55, lines: [{ text: 'and watch it', size: 60 }, { text: '^#build.#', size: 200 }] });
  cues.push({ t: 7.3, type: 'pop' }, { t: 7.95, type: 'swarm', dur: 1.0 });

  // ---------------------------------------------------------------- 5. "Some things shouldn't exist."  (icon cracks, shatters)
  const c5a = { pos: [-2200, 240, 1600], look: [-2600, 330, -1500], fov: 40 }, c5b = { pos: [-2160, 250, 1450], look: [-2560, 335, -1500], fov: 38 };
  const exist = at('exist');
  const s5 = { name: 'exist', t0: 8.72, t1: 10.85, palette: ['dream', 'golden'], paletteEase: (x) => x * .6, cam: move(c5a, c5b),
    run({ props, near }, lt, sp, t) {
      const e = expoOut(inv(8.8, 9.4, t));
      props.icon.set({ pos: near( 2.9, .1, -10), rot: [.1 + (1 - e) * .8, -.35 + (1 - e) * 2.4 + Math.sin(t * 1.3) * .05, .04], scale: .95 * (.6 + .4 * e),
        crack: cubicIn(inv(9.45, exist, t)), shatter: inv(exist, exist + 1.4, t) });
    } };
  shots.push(s5);
  fx.push({ t: s5.t0, type: 'wipe', dir: 1, dur: .32, img: 0 });
  fx.push({ t: exist, type: 'flash', dur: .3, color: '#fff3e2', amount: .8, attack: .02 }, { t: exist, type: 'shake', dur: .5, amount: 16 });
  texts.push({ x: .07, y: .25, out: 10.35, lines: [{ text: 'Some things', size: 60 }, { text: "*shouldn't*", size: 230 }, { text: '^+#exist.#', size: 120 }] });
  cues.push({ t: 9.45, type: 'crack', dur: exist - 9.45 }, { t: exist, type: 'shatter' });

  // ---------------------------------------------------------------- 6. "Until now."  (space, planet limb)
  const s6 = { name: 'now', t0: 10.85, t1: 12.25, palette: 'space',
    cam: move({ pos: [0, 0, 600], look: [1500, -300, -9000], fov: 44, roll: -.06 }, { pos: [0, 30, 0], look: [1400, -200, -9000], fov: 42, roll: -.02 }) };
  shots.push(s6);
  fx.push({ t: 10.55, type: 'crt', dur: .3 }, { t: 10.85, type: 'dark', dur: .05, fade: .3, sound: false });
  texts.push({ x: .5, y: .34, align: 'center', anchor: 'middle', out: 11.8, scrim: 0, lines: [{ text: 'Until', size: 60 }, { text: '^+*now.*', size: 260 }] });
  cues.push({ t: 12.25, type: 'riser', dur: 1.3 }, { t: 10.55, type: 'score', level: .12 });

  // ---------------------------------------------------------------- 7. "Imaginary World."  (golden hour title)
  const s7 = { name: 'title', t0: 12.25, t1: 14.6, palette: 'golden', bloom: .42,
    cam: move({ pos: [0, 130, 1200], look: [-600, 230, -3000], fov: 42 }, { pos: [0, 300, 700], look: [-600, 250, -3000], fov: 40 }, quintOut) };
  shots.push(s7);
  fx.push({ t: s7.t0, type: 'flash', dur: .5, color: '#fff1dc' }, { t: s7.t0, type: 'rush', dur: .25, amount: .1, sound: false });
  fx.push({ t: 14.1, type: 'fadeout', dur: .5 });
  texts.push({ x: .5, y: .48, align: 'center', anchor: 'middle', out: 14.6, scrim: 2.2, lines: [{ text: '=Imaginary=', size: 230 }, { text: '+*World.*', size: 270 }] });
  cues.push({ t: s7.t0, type: 'score', level: 1 }, { t: 5.02, type: 'score', level: .6 }, { t: 7.22, type: 'score', level: .85 }, { t: s7.t0, type: 'impact', amount: 1.1 }, { t: s7.t0 + .05, type: 'shimmer', dur: 2 });

  return { title: 'Imaginary World teaser', duration: 14.6, fps: 60, shots, fx, texts, cues };
}

// ---------------------------------------------------------------- helpers
// camera move between two poses
function move(a, b, ease = sineInOut) {
  return (lt, sp) => { const e = ease(sp); return {
    pos: a.pos.map((v, i) => lerp(v, b.pos[i], e)), look: a.look.map((v, i) => lerp(v, b.look[i], e)),
    fov: lerp(a.fov ?? 40, b.fov ?? 40, e), roll: lerp(a.roll ?? 0, b.roll ?? 0, e) }; };
}
// the laptop's live screen: an invented app building the typed scene
function drawRenderScreen(g, w, h, p, t) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f5f2ff'); gr.addColorStop(1, '#e4ecff');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = '#10162a'; g.font = '600 34px Inter'; g.fillText('Daydream Studio', 56, 72);
  g.fillStyle = 'rgba(16,22,42,.45)'; g.font = '500 26px Inter'; g.fillText('a lighthouse on a cloud', 56, 116);
  // preview frame
  const x = 56, y = 150, pw = w - 112, ph = h - 230;
  g.save(); roundRect(g, x, y, pw, ph, 26); g.clip();
  const sky = g.createLinearGradient(0, y, 0, y + ph); sky.addColorStop(0, '#7fb0ff'); sky.addColorStop(1, '#ffd9c2');
  g.fillStyle = sky; g.fillRect(x, y, pw, ph);
  const reveal = y + ph * (1 - p);                                   // scene builds bottom-up
  g.fillStyle = '#fff';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(x + 160 + i * 150, y + ph - 70 + Math.sin(i * 1.7) * 18, 90, 0, 7); g.fill(); }
  g.fillStyle = '#fbfbf7'; g.fillRect(x + pw / 2 - 26, y + ph - 330, 52, 230);
  g.fillStyle = '#FF6A40'; g.fillRect(x + pw / 2 - 28, y + ph - 250, 56, 34);
  g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(x + pw / 2, y + ph - 350, 26, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,244,196,.35)'; g.beginPath(); g.moveTo(x + pw / 2, y + ph - 350); g.lineTo(x + pw, y + ph - 470 + Math.sin(t * 3) * 30); g.lineTo(x + pw, y + ph - 300); g.fill();
  // unbuilt part: wireframe grid
  g.fillStyle = '#eef1fa'; g.fillRect(x, y, pw, Math.max(0, reveal - y));
  g.strokeStyle = 'rgba(16,22,42,.08)'; g.lineWidth = 2;
  for (let gx = x; gx < x + pw; gx += 48) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx, reveal); g.stroke(); }
  for (let gy = y; gy < reveal; gy += 48) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x + pw, gy); g.stroke(); }
  g.fillStyle = '#FF6A40'; g.fillRect(x, reveal - 3, pw, 6);
  g.restore();
  g.fillStyle = 'rgba(16,22,42,.5)'; g.font = '600 24px Inter'; g.fillText(`${Math.round(p * 100)}%`, 56, h - 36);
}
