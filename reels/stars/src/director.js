// "What if every star disappeared?" — Imaginary World, 66.9 s, 18 shots, cut to vo.wav (words.json).
import { lerp, clamp, inv, expoOut, cubicOut, cubicIn, cubicInOut, sineInOut, quintOut, smooth, bump, env } from './director-kit.js';
import { blendPalette } from './palettes.js';

export function build({ words }) {
  const shots = [], fx = [], texts = [], cues = [];
  const norm = (s) => s.toLowerCase().replace(/[^a-z']/g, '');
  const w = (word, after = 0) => { const h = words.find((x) => norm(x.w) === word && x.t0 >= after - .01); if (!h) throw new Error('no word ' + word + ' after ' + after); return h.t0; };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const score = (t, level) => cues.push({ t, type: 'score', level });

  // ---------------------------------------------------------------- 1. "Hey, have you ever looked at the night sky"
  shots.push({ name: 'night sky', t0: 0, t1: 2.55, palette: 'night',
    cam: move({ pos: [0, 150, 900], look: [0, 520, -3000], fov: 44 }, { pos: [0, 230, 700], look: [0, 1250, -3000], fov: 42 }, cubicInOut) });
  texts.push({ x: .5, y: .45, align: 'center', anchor: 'middle', out: .78, lines: [{ text: '*Hey,*', size: 230 }] });
  texts.push({ x: .075, y: .2, out: 2.38, lines: [{ text: 'Have you ever looked at', size: 58 }, { text: 'the night +*sky*', size: 230 }] });
  score(0, .4);

  // ---------------------------------------------------------------- 2. "and wondered what would happen if every single star suddenly disappeared?"
  shots.push({ name: 'stars', t0: 2.55, t1: 6.85, palette: 'void',
    cam: (lt, sp) => { const a = -.25 + sp * .28; return { pos: [0, 0, 0], look: [Math.sin(a) * 9000, 2200 + sp * 600, -Math.cos(a) * 9000], fov: 46 - sp * 4, roll: -.08 + sp * .05 }; },
    run({ world, props, near }, lt, sp, t) {
      world.fx.planetMul = 0;
      props.glowA.set({ pos: near(5.5, 2.2, -30), size: 4.5, intensity: 1.2 });
      props.glowB.set({ pos: near(8.5, -3.5, -40), size: 3, intensity: .9 });
    } });
  fx.push({ t: 2.55, type: 'rush', dur: .32, amount: .14 });
  texts.push({ x: .075, y: .2, out: 6.72, lines: [{ text: 'and wondered what would happen if', size: 56 }, { text: 'every single +*star*', size: 220 }, { text: 'suddenly disappeared?', size: 56 }] });
  fx.push({ t: w('disappeared', 5), type: 'punch', amount: .025, dur: .5 });

  // ---------------------------------------------------------------- 3. "I mean every star. Gone. Just like that."
  const gone = w('gone', 8);
  shots.push({ name: 'gone', t0: 6.85, t1: 10.9, palette: 'void',
    cam: (lt, sp) => ({ pos: [0, 0, 0], look: [Math.sin(.6 + sp * .12) * 9000, 1200, -Math.cos(.6 + sp * .12) * 9000], fov: 44 - sp * 6, roll: .04 - sp * .03 }),
    run({ world, stars, props, near }, lt, sp, t) {
      world.fx.planetMul = 0;
      stars.set({ kill: gone - .32, wave: .5, dir: [.6, .1, -.8] });
      const g = 1 - smooth(inv(gone - .3, gone + .05, t));
      props.glowA.set({ pos: near(-4, 2.5, -30), size: 5 * (1 + bump(inv(gone - .45, gone - .2, t)) * .8), intensity: g * 1.4 });
    } });
  fx.push({ t: 6.85, type: 'whip', dir: -1, dur: .3, amount: 300 });
  fx.push({ t: gone, type: 'flash', dur: .35, amount: .55, attack: .02 }, { t: gone, type: 'shake', dur: .5, amount: 14 });
  texts.push({ x: .5, y: .2, align: 'center', out: gone - .25, lines: [{ text: 'I mean every +*star.*', size: 120 }] });
  texts.push({ x: .5, y: .5, align: 'center', anchor: 'middle', out: 10.3, scrim: 0, lines: [{ text: '^+*Gone.*', size: 320 }, { text: 'Just like that.', size: 60 }] });
  cues.push({ t: gone, type: 'riser', dur: 1.5, gain: .8 });
  score(gone, .12);

  // ---------------------------------------------------------------- 4. "At first, you might think the universe had gone completely dark."
  shots.push({ name: 'dark', t0: 10.9, t1: 15.0, palette: 'empty',
    cam: move({ pos: [-1200, 210, 0], look: [-1500, 760, -3000], fov: 42 }, { pos: [-1240, 240, -260], look: [-1540, 800, -3000], fov: 40 }) });
  fx.push({ t: 10.45, type: 'dark', dur: .5, fade: .7, sound: false });
  texts.push({ x: .075, y: .22, out: 14.65, lines: [{ text: 'At first, you might think', size: 56 }, { text: 'the universe had gone', size: 56 }, { text: 'completely +*dark.*', size: 230 }] });

  // ---------------------------------------------------------------- 5. "But wait, here's the crazy part."
  const wait = w('wait', 15);
  shots.push({ name: 'wait', t0: 15.0, t1: 17.6, palette: 'empty',
    cam: move({ pos: [900, 200, -900], look: [1300, 900, -4000], fov: 42 }, { pos: [920, 260, -1000], look: [1320, 1050, -4000], fov: 38 }, cubicOut),
    run({ stars }, lt, sp, t) { stars.set({ opacity: 1, kill: -100, revive: wait, reviveDur: .7, dir: [0, .4, -1] }); } });
  fx.push({ t: 15.0, type: 'whip', dir: 1, dur: .3, amount: 300 });
  fx.push({ t: wait, type: 'flash', dur: .3, amount: .35, color: '#cfe0ff', attack: .02 });
  texts.push({ x: .5, y: .3, align: 'center', out: 15.85, lines: [{ text: 'But ^#wait.#', size: 170 }] });
  texts.push({ x: .5, y: .3, align: 'center', out: 17.4, lines: [{ text: "here's the crazy", size: 60 }, { text: '+*part.*', size: 260 }] });
  cues.push({ t: wait, type: 'shimmer', dur: 1.6, gain: .8 });
  score(wait, .5);

  // ---------------------------------------------------------------- 6. "We wouldn't notice it immediately."
  shots.push({ name: 'notice', t0: 17.6, t1: 19.85, palette: 'night',
    cam: move({ pos: [-300, 220, -1800], look: [200, 980, -5000], fov: 42 }, { pos: [-260, 250, -1950], look: [240, 1050, -5000], fov: 40 }),
    run({ ui, W, H }, lt, sp, t) {
      ui.stat({ key: 'sky', x: W * .74, y: H * .52, dark: true, inP: inv(17.75, 18.25, t), outP: inv(19.55, 19.8, t), label: 'Stars visible tonight', value: fmt(9096), sub: 'Nothing has changed… yet' });
    } });
  fx.push({ t: 17.6, type: 'flash', dur: .3, amount: .7, color: '#dfe8ff' });
  texts.push({ x: .075, y: .3, out: 19.6, lines: [{ text: "We wouldn't notice it", size: 58 }, { text: '+*immediately.*', size: 200 }] });
  cues.push({ t: 17.8, type: 'pop' });

  // ---------------------------------------------------------------- 7. "You see, light takes time to travel through space."
  const light1 = w('light', 20);
  shots.push({ name: 'light travel', t0: 19.85, t1: 22.95, palette: 'void',
    cam: move({ pos: [0, 0, 0], look: [0, 0, -1000], fov: 40 }, { pos: [40, 6, -30], look: [44, 4, -1000], fov: 38 }),
    run({ world, props, near, camera }, lt, sp, t) {
      world.fx.planetMul = 0;
      const e = expoOut(inv(19.9, 20.6, t));
      props.light.set({ a: near(-7, -1.8, -16), b: near(6.6, -2.3, -14), p: cubicInOut(inv(light1, 22.9, t)) * .62, star: e, starSize: 3.4, earthSize: .95 * e, t, dashes: inv(20.2, 21.0, t), camera });
    } });
  fx.push({ t: 19.85, type: 'rush', dur: .3, amount: .12 });
  texts.push({ x: .075, y: .12, out: 22.75, lines: [{ text: 'You see, +*light*', size: 190 }, { text: 'takes time to travel through space.', size: 56 }] });

  // ---------------------------------------------------------------- 8. "Some stars are so far away that their light takes hundreds or even thousands of years to reach us."
  const hundreds = w('hundreds', 25), thousands = w('thousands', 26);
  shots.push({ name: 'years', t0: 22.95, t1: 28.6, palette: 'void',
    cam: move({ pos: [0, 0, 0], look: [-300, 120, -1000], fov: 44 }, { pos: [60, 4, -40], look: [-200, 110, -1000], fov: 40 }),
    run({ world, props, near, camera, ui, W, H }, lt, sp, t) {
      world.fx.planetMul = 0;
      props.light.set({ a: near(-8.5, -3.2, -22), b: near(8.2, -3.8, -19), p: inv(23.0, 28.6, t) * .45, star: 1, starSize: 3, earthSize: .7, t, dashes: 1, camera });
      const yrs = t < hundreds ? 8 * inv(23.3, hundreds, t) : t < thousands ? lerp(100, 900, cubicOut(inv(hundreds, thousands, t))) : lerp(1000, 4300, cubicOut(inv(thousands, 28.1, t)));
      ui.stat({ key: 'years', x: W * .925, y: H * .22, anchor: 'right', dark: true, inP: inv(23.2, 23.7, t), outP: inv(28.35, 28.6, t), label: 'Light travel time', value: fmt(yrs), unit: 'years', progress: yrs / 4300 });
    } });
  fx.push({ t: 22.95, type: 'whip', dir: -1, dur: .28, amount: 260 });
  texts.push({ x: .075, y: .2, out: hundreds - .5, lines: [{ text: 'Some stars are so', size: 58 }, { text: '+*far* *away*', size: 220 }] });
  texts.push({ x: .075, y: .2, out: 28.42, lines: [{ text: '#hundreds#', size: 120 }, { text: 'or even', size: 56 }, { text: '+#thousands#', size: 120 }, { text: 'of years to reach us.', size: 56 }] });
  cues.push({ t: 23.25, type: 'pop' });

  // ---------------------------------------------------------------- 9. "So even if those stars disappeared, we could still see their light traveling towards Earth."
  const dis2 = w('disappeared', 29.5), earth = w('earth', 32.5);
  shots.push({ name: 'wavefront', t0: 28.6, t1: 33.95, palette: 'void',
    cam: move({ pos: [0, 0, 0], look: [0, -40, -1000], fov: 42 }, { pos: [-30, 4, -40], look: [-30, -30, -1000], fov: 40 }),
    run({ world, props, near, camera }, lt, sp, t) {
      world.fx.planetMul = 0;
      const A = near(-7.2, -2.0, -17), B = near(6.4, -2.4, -14);
      const st = 1 - smooth(inv(dis2 - .05, dis2 + .12, t));
      props.light.set({ a: A, b: B, shell: cubicIn(inv(28.65, earth, t)) * .95 + .05 * inv(earth, earth + .5, t), star: st * (1 + bump(inv(dis2 - .35, dis2, t)) * .6), starSize: 3.2, earthSize: .95, t, dashes: .6, camera });
      props.glowA.set({ pos: A, size: 9 * expoOut(inv(dis2, dis2 + .5, t)), intensity: (1 - inv(dis2, dis2 + .6, t)) * 1.4 * (t > dis2 ? 1 : 0) });
      props.glowB.set({ pos: B, size: 4, intensity: env(t, earth, .1, .9) * 1.6 });
    } });
  fx.push({ t: 28.6, type: 'flash', dur: .3, amount: .4, color: '#fff3dc' });
  fx.push({ t: dis2, type: 'punch', amount: .03, dur: .5 });
  texts.push({ x: .075, y: .12, out: 30.42, lines: [{ text: 'So even if those stars', size: 58 }, { text: '+*disappeared,*', size: 200 }] });
  texts.push({ x: .075, y: .12, out: 33.72, lines: [{ text: 'we could still see their +*light*', size: 190 }, { text: 'traveling towards Earth.', size: 56 }] });
  cues.push({ t: dis2, type: 'impact', amount: .5 }, { t: earth, type: 'shimmer', dur: 1.2, gain: .6 });

  // ---------------------------------------------------------------- 10. "But imagine the moment that final light disappears."
  const dis3 = w('disappears', 36);
  shots.push({ name: 'final light', t0: 33.95, t1: 37.6, palette: 'void',
    cam: move({ pos: [0, 0, 700], look: [1500, -300, -9000], fov: 44, roll: -.06 }, { pos: [0, 40, 0], look: [1400, -150, -9000], fov: 41, roll: -.03 }),
    run({ world, stars, props, near }, lt, sp, t) {
      stars.set({ opacity: .9, kill: dis3 - 1.6, wave: 1.2, dir: [-1, .3, -.5] });
      const lastOn = 1 - smooth(inv(dis3 - .02, dis3 + .14, t));
      props.glowA.set({ pos: near(5.8, 3.2, -30), size: 3.2 * (1 + bump(inv(dis3 - .4, dis3, t)) * 1.2) * (1 + .06 * Math.sin(t * 9)), intensity: lastOn * 1.5 });
    } });
  fx.push({ t: 33.95, type: 'whip', dir: 1, dur: .3, amount: 280 });
  fx.push({ t: dis3, type: 'flash', dur: .25, amount: .25, attack: .02 });
  texts.push({ x: .075, y: .18, out: 37.42, lines: [{ text: 'But imagine the moment that', size: 56 }, { text: '+*final* *light*', size: 200 }, { text: 'disappears.', size: 56 }] });
  cues.push({ t: dis3, type: 'impact', amount: .35 });
  score(dis3, .25);

  // ---------------------------------------------------------------- 11. "No stars, no constellations, just an endless, terrifying black sky."
  const noStars = w('no', 37.5), noCon = w('constellations', 38.8), just = w('just', 40.3);
  shots.push({ name: 'black sky', t0: 37.6, t1: 43.85, palette: 'void',
    cam: move({ pos: [0, 0, 0], look: [0, 600, -9000], fov: 40 }, { pos: [0, 0, 0], look: [0, 560, -9000], fov: 52 }, sineInOut),
    run({ world, stars, props, near }, lt, sp, t) {
      world.fx.planetMul = 0;
      stars.set({ opacity: .55, kill: noStars - .1, wave: .5, dir: [0, .1, -1] });
      props.constellations.set({ pos: near(.2, -1.3, -14), scale: 1.05, draw: inv(37.62, noStars + .5, t), brk: inv(noCon + .1, noCon + 1.4, t), t });
    } });
  fx.push({ t: 37.6, type: 'flash', dur: .25, amount: .3, color: '#cfe0ff' });
  texts.push({ x: .5, y: .1, align: 'center', out: 40.25, lines: [{ text: '^#No# #stars,#', size: 110 }, { text: 'no constellations,', size: 60 }] });
  texts.push({ x: .5, y: .5, align: 'center', anchor: 'middle', out: 43.62, scrim: 0, lines: [{ text: 'just an endless,', size: 58 }, { text: '*terrifying*', size: 240 }, { text: '+#black# #sky.#', size: 130 }] });
  cues.push({ t: just, type: 'drone', dur: 3.4 });
  score(just, .08);

  // ---------------------------------------------------------------- 12. "And here's something even crazier. Our Sun is a star too."
  const sun = w('sun', 46);
  shots.push({ name: 'sun', t0: 43.85, t1: 47.95, palette: 'sunbeat', bloom: .45,
    cam: move({ pos: [0, 120, 1300], look: [-650, 300, -3000], fov: 42 }, { pos: [0, 260, 820], look: [-650, 330, -3000], fov: 38 }, quintOut) });
  fx.push({ t: 43.85, type: 'flash', dur: .6, color: '#fff1dc' }, { t: 43.85, type: 'rush', dur: .3, amount: .12, sound: false });
  texts.push({ x: .075, y: .2, out: 45.55, lines: [{ text: "And here's something even", size: 58 }, { text: '+*crazier.*', size: 230 }] });
  texts.push({ x: .075, y: .2, out: 47.78, lines: [{ text: 'Our +*Sun*', size: 250 }, { text: 'is a star too.', size: 60 }] });
  cues.push({ t: 43.85, type: 'riser', dur: 1.6 }, { t: 43.85, type: 'impact', amount: 1 }, { t: 43.9, type: 'shimmer', dur: 2.4 }, { t: sun, type: 'impact', amount: .4 });
  score(43.85, .9);

  // ---------------------------------------------------------------- 13. "If the Sun disappeared as well,"
  const dis4 = w('disappeared', 48.5);
  shots.push({ name: 'sun out', t0: 47.95, t1: 50.0, palette: (sp, lt) => blendPalette('sunbeat', 'empty', smooth(inv(dis4, dis4 + 1.0, 47.95 + lt))), bloom: .45,
    cam: move({ pos: [1600, 180, 600], look: [960, 330, -3000], fov: 40 }, { pos: [1580, 200, 450], look: [940, 320, -3000], fov: 37 }),
    run({ world }, lt, sp, t) {
      world.fx.sunMul = t < dis4 ? 1 + .8 * cubicIn(inv(dis4 - .6, dis4, t)) : 1.8 * (1 - expoOut(inv(dis4, dis4 + .18, t)));
    } });
  fx.push({ t: 47.95, type: 'whip', dir: 1, dur: .3, amount: 300 });
  fx.push({ t: dis4 + .04, type: 'flash', dur: .4, amount: .9, attack: .03 }, { t: dis4, type: 'shake', dur: .6, amount: 16 });
  texts.push({ x: .075, y: .2, out: 49.72, scrim: 2, lines: [{ text: 'If the Sun', size: 58 }, { text: '+*disappeared*', size: 220 }, { text: 'as well,', size: 58 }] });
  cues.push({ t: dis4, type: 'riser', dur: .9, gain: .7 });
  score(dis4, .2);

  // ---------------------------------------------------------------- 14. "Earth would lose its main source of light and heat."
  const earthL = 50.08;
  shots.push({ name: 'earth dims', t0: 50.0, t1: 52.85, palette: 'earth',
    cam: move({ pos: [-1800, -3500, 7600], look: [-6200, -6100, -9000], fov: 40 }, { pos: [-1500, -3650, 6900], look: [-6000, -6150, -9000], fov: 39 }),
    run({ world, stars }, lt, sp, t) {
      stars.set({ opacity: .25 * (1 - inv(50.2, 52.6, t)) });
      world.fx.planetSun = 1 - .93 * smooth(inv(50.5, 52.5, t));
    } });
  fx.push({ t: 50.0, type: 'dark', dur: .02, fade: .45, sound: false });
  texts.push({ x: .075, y: .22, out: 52.62, lines: [{ text: 'Earth would lose its', size: 58 }, { text: 'main source of', size: 58 }, { text: '*light* and +*heat.*', size: 200 }] });
  cues.push({ t: 50.08, type: 'whoosh', dur: .7, amount: .6 });

  // ---------------------------------------------------------------- 15. "Temperatures would begin falling, and life as we know it would face a disaster."
  const disaster = w('disaster', 56);
  shots.push({ name: 'freeze', t0: 52.85, t1: 57.45, palette: 'earth',
    cam: move({ pos: [-2400, -3000, 11500], look: [-7800, -6000, -9000], fov: 40 }, { pos: [-2200, -3100, 10200], look: [-7600, -6100, -9000], fov: 38 }),
    run({ world, ui, W, H }, lt, sp, t) {
      world.fx.planetSun = .4 - .15 * inv(53, 57.4, t); world.fx.frost = smooth(inv(53.0, 57.3, t)) * .74;
      const temp = lerp(15, -73, cubicInOut(inv(53.1, 57.2, t)));
      ui.stat({ key: 'temp', x: W * .075, y: H * .8, anchor: 'left', dark: true, inP: inv(53.0, 53.5, t), outP: inv(57.15, 57.4, t), label: 'Average surface temperature', value: `${temp > 0 ? '+' : temp < -0.5 ? '−' : ''}${Math.abs(Math.round(temp))}`, unit: '°C', progress: inv(-73, 15, temp) });
    } });
  fx.push({ t: 52.85, type: 'rush', dur: .3, amount: .1 });
  fx.push({ t: disaster, type: 'shake', dur: .5, amount: 14 }, { t: disaster, type: 'flash', dur: .25, amount: .3, color: '#dbe8ff', attack: .02 });
  texts.push({ x: .075, y: .14, out: 54.35, lines: [{ text: 'Temperatures would begin', size: 58 }, { text: '+*falling,*', size: 220 }] });
  texts.push({ x: .075, y: .14, out: 57.2, lines: [{ text: 'and life as we know it', size: 58 }, { text: 'would face a', size: 58 }, { text: '^#disaster.#', size: 150 }] });
  cues.push({ t: 53.1, type: 'drone', dur: 4.2, gain: .6 }, { t: 53.05, type: 'pop' });
  score(52.85, .35);

  // ---------------------------------------------------------------- 16. "So let me ask you."
  shots.push({ name: 'ask', t0: 57.45, t1: 59.1, palette: 'night',
    cam: move({ pos: [2400, 200, 1400], look: [2000, 900, -2000], fov: 40 }, { pos: [2400, 230, 1250], look: [2000, 960, -2000], fov: 37 }) });
  fx.push({ t: 57.3, type: 'dark', dur: .1, fade: .45, sound: false });
  texts.push({ x: .5, y: .5, align: 'center', anchor: 'middle', out: 58.95, lines: [{ text: 'So let me', size: 60 }, { text: '+*ask* *you.*', size: 250 }] });
  score(57.45, .45);

  // ---------------------------------------------------------------- 17. "Would you be able to sleep peacefully, knowing that the entire universe above you had gone dark?"
  const dark2 = w('dark', 63.5), had = w('had', 63.3);
  const c17a = { pos: [-600, 230, 2600], look: [-700, 700, -1000], fov: 40 }, c17b = { pos: [-610, 260, 2450], look: [-710, 760, -1000], fov: 38 };
  shots.push({ name: 'sleep', t0: 59.1, t1: 64.9, palette: (sp, lt) => blendPalette('night', 'empty', smooth(inv(had, dark2 + .6, 59.1 + lt))), cam: move(c17a, c17b),
    run({ props, stars, near }, lt, sp, t) {
      stars.set({ kill: had + .05, wave: .7, dir: [0, .5, -1] });
      props.island.set({ pos: near(3.6, -1.35, -14), rot: [.06, -.5, 0], scale: 1.0, t, lamp: 1 - smooth(inv(dark2, dark2 + .2, t)) });
      props.glowA.set({ pos: near(3.6 - .4 * .87, -1.35 + 1.56, -14 + .2), size: 1.6, intensity: (1 - smooth(inv(dark2, dark2 + .2, t))) * 1.1 });
    } });
  fx.push({ t: 59.1, type: 'whip', dir: -1, dur: .3, amount: 280 });
  texts.push({ x: .075, y: .16, out: 60.98, lines: [{ text: 'Would you be able to', size: 58 }, { text: '+*sleep* *peacefully,*', size: 180 }] });
  texts.push({ x: .075, y: .16, out: 64.45, lines: [{ text: 'knowing that the entire', size: 58 }, { text: 'universe above you', size: 58 }, { text: 'had gone +*dark?*', size: 220 }] });
  fx.push({ t: 64.4, type: 'fadeout', dur: .5, until: 64.9 });
  cues.push({ t: dark2, type: 'impact', amount: .45 });
  score(dark2, .1);

  // ---------------------------------------------------------------- 18. end card
  shots.push({ name: 'end card', t0: 64.9, t1: 66.9, palette: 'void',
    cam: move({ pos: [0, 0, 0], look: [0, 900, -9000], fov: 42 }, { pos: [0, 0, 0], look: [0, 960, -9000], fov: 39 }),
    run({ world, stars }, lt, sp, t) { world.fx.planetMul = 0; stars.set({ opacity: .8, kill: -100, revive: 65.0, reviveDur: 1.2 }); } });
  fx.push({ t: 64.9, type: 'dark', dur: .05, fade: .5, sound: false }, { t: 66.35, type: 'fadeout', dur: .5 });
  texts.push({ x: .5, y: .5, align: 'center', anchor: 'middle', out: 66.9, lines: [{ text: '=Imaginary=@65.15', size: 200 }, { text: '+*World.*@65.4', size: 240 }] });
  cues.push({ t: 65.1, type: 'shimmer', dur: 1.8 });
  score(64.9, .55);

  return { title: 'What if every star disappeared?', duration: 66.9, fps: 60, mood: 'dark', shots, fx, texts, cues };
}

function move(a, b, ease = sineInOut) {
  return (lt, sp) => { const e = ease(sp); return {
    pos: a.pos.map((v, i) => lerp(v, b.pos[i], e)), look: a.look.map((v, i) => lerp(v, b.look[i], e)),
    fov: lerp(a.fov ?? 40, b.fov ?? 40, e), roll: lerp(a.roll ?? 0, b.roll ?? 0, e) }; };
}
