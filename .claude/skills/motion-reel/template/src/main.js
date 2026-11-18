// Engine entry. Builds the world from director.js and exposes:
//   window.__ready  true once fonts, textures and the director are loaded
//   window.__render(t)  draws the frame at time t (seconds); pure function of t
//   window.__meta  { duration, fps, w, h }      window.__cues()  sound cue list
// Preview in a browser: http://localhost:8123/?t=3  (space = pause, arrows = seek, , . = frame step)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from './world.js';
import { Post } from './post.js';
import { evalFx } from './fx.js';
import { TextLayer } from './text.js';
import { Glass } from './glass.js';
import { Props } from './props.js';
import { blendPalette, PALETTES } from './palettes.js';
import { clamp, rng, drift, ahead } from './lib.js';

const q = new URLSearchParams(location.search);
const W = Number(q.get('w') || 1920), H = Number(q.get('h') || 1080), RENDER = q.has('render');
const root = document.documentElement;
root.style.setProperty('--W', W + 'px'); root.style.setProperty('--H', H + 'px');
const stage = document.getElementById('stage'), frameEl = document.getElementById('frame');
const flashEl = document.getElementById('flash'), grainEl = document.getElementById('grain');
const typeEl = document.getElementById('type'), uiEl = document.getElementById('ui'), wipeEl = document.getElementById('wipe');
const whipBlur = document.getElementById('whipBlur');
if (!RENDER) { const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`; }; addEventListener('resize', fit); fit(); }

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, W / H, .3, 140000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
scene.environmentIntensity = .55;

const loadTex = (url) => new Promise((res, rej) => new THREE.TextureLoader().load(url, res, undefined, rej));
const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// grain: one random tile, jittered per frame
{
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256), r = rng(1);
  for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  g.putImageData(img, 0, 0); grainEl.style.backgroundImage = `url(${c.toDataURL()})`;
}

const [atlasTex, atlasInfo, words] = await Promise.all([loadTex('assets/clouds_atlas.png'), getJSON('assets/clouds_atlas.json'), getJSON('words.json')]);
atlasTex.colorSpace = THREE.NoColorSpace; atlasTex.generateMipmaps = true; atlasTex.anisotropy = 4;
await Promise.all(['500 56px Inter', '800 150px "Inter Tight"', 'italic 200px "Instrument Serif"', '200px "Instrument Serif"', '600 30px Inter', '400 30px Inter'].map((f) => document.fonts.load(f)));
await document.fonts.ready;

const world = new World(scene, atlasTex, atlasInfo);
const post = new Post(renderer, scene, camera, W, H);
const props = new Props(scene);
const ui = new Glass(uiEl);
const D = (await import('./director.js')).build({ words, W, H, THREE, props, scene });
const text = new TextLayer(typeEl, D.texts, words);
text.layout(W, H);
const wipeImgs = [0, 1, 2].map((i) => { const im = new Image(); im.src = `assets/wipe_${i}.png`; im.className = 'wipeimg'; im.style.display = 'none'; wipeEl.appendChild(im); return im; });
await Promise.all(wipeImgs.map((im) => im.decode().catch(() => {})));

const tmpLook = new THREE.Vector3();
function shotAt(t) { let s = D.shots[0]; for (const x of D.shots) if (t >= x.t0) s = x; return s; }

function renderAt(t) {
  const shot = shotAt(t), lt = t - shot.t0, sp = clamp(lt / (shot.t1 - shot.t0));
  const pal = typeof shot.palette === 'function' ? shot.palette(sp, lt) : Array.isArray(shot.palette)
    ? blendPalette(shot.palette[0], shot.palette[1], (shot.paletteEase || ((x) => x))(sp)) : PALETTES[shot.palette || 'midday'];
  // camera: the shot gives position/look; we add a gentle handheld drift so nothing is ever locked off
  const c = shot.cam(lt, sp, t);
  const hh = c.handheld ?? 1;
  camera.position.set(c.pos[0] + drift(t, 1, .06 * hh), c.pos[1] + drift(t, 2, .05 * hh), c.pos[2] + drift(t, 3, .06 * hh));
  camera.fov = c.fov ?? 40; camera.updateProjectionMatrix();
  tmpLook.set(c.look[0] + drift(t, 4, .1 * hh), c.look[1] + drift(t, 5, .08 * hh), c.look[2]);
  camera.up.set(0, 1, 0); camera.lookAt(tmpLook); camera.rotateZ((c.roll ?? 0) + drift(t, 6, .004 * hh));
  camera.updateMatrixWorld();
  props.begin(); ui.begin();
  // near(x, y, z): a point in front of the camera for props. Props are ~10 units away while the camera
  // travels hundreds of units for cloud parallax, so they ride with the camera, sliding back by a small
  // fraction of its travel to read as objects hanging in the same space.
  const c0 = shot.cam(0, 0, shot.t0);
  const near = (x, y, z, parallax = .012) => ahead(c, x, y, z).map((v, i) => v - (c.pos[i] - c0.pos[i]) * parallax);
  shot.run?.({ props, ui, camera, THREE, W, H, pal, shot, near }, lt, sp, t);
  ui.end();
  world.update(t, camera, pal);
  renderer.toneMappingExposure = pal.exposure;
  const f = evalFx(t, D.fx);
  post.set({ whipX: f.whipX, zoom: f.zoom, bloom: (shot.bloom ?? .32) + f.bloomBoost, sat: pal.sat ?? 1, contrast: pal.contrast ?? 1 });
  text.update(t, pal, f);
  // DOM-level effects
  frameEl.style.transform = `translate(${f.tx}px, ${f.ty}px) rotate(${f.rot}rad) scale(${f.scale * f.crtX}, ${f.scale * f.crtY})`;
  frameEl.style.filter = f.crtGlow > 0 ? `brightness(${1 + f.crtGlow * 2.5})` : 'none';
  frameEl.style.opacity = f.crtX <= 0 || f.crtY <= 0 ? '0' : '1';
  whipBlur.setAttribute('stdDeviation', `${f.typeBlurX.toFixed(1)} 0`);
  const tf = f.typeBlurX > .5 ? 'url(#whip)' : '';
  typeEl.style.filter = tf; uiEl.style.filter = tf;
  flashEl.style.background = f.dark > 0 && f.flash < f.dark ? '#000' : f.flashColor;
  flashEl.style.opacity = String(Math.max(f.flash, f.dark));
  wipeImgs.forEach((im) => (im.style.display = 'none'));
  for (const w of f.wipes) {             // cloud bank sweeps across; fully covers the frame at p = .5
    const im = wipeImgs[w.img % 3], iw = W * 2.2, ih = H * 1.6;
    const x = w.dir > 0 ? W - (W + iw) * w.p : -iw + (W + iw) * w.p;
    Object.assign(im.style, { display: '', width: iw + 'px', height: ih + 'px', left: '0px', top: (H - ih) / 2 + 'px',
      transform: `translateX(${x}px) scale(${1 + Math.abs(w.p - .5) * .3})`, filter: `blur(${Math.abs(w.p - .5) * 20}px)` });
  }
  const fr = Math.floor(t * 60); grainEl.style.backgroundPosition = `${(fr * 73) % 256}px ${(fr * 151) % 256}px`;
  post.draw();
  return shot;
}

function cues() {
  const out = [...(D.cues || [])];
  for (const e of D.fx) {                // every hidden cut gets a whoosh, every flash a hit
    if (e.sound === false) continue;
    if (e.type === 'whip' || e.type === 'rush' || e.type === 'wipe') out.push({ t: e.t, type: 'whoosh', dur: (e.dur ?? .4) * 1.4, amount: e.type === 'rush' ? 1 : .8 });
    if (e.type === 'crt') out.push({ t: e.t, type: 'crt', dur: e.dur ?? .5 });
  }
  for (const p of text.punches()) out.push({ t: p.t, type: 'impact', amount: 1 });
  return out.sort((a, b) => a.t - b.t);
}

window.__render = (t) => { renderAt(t); return true; };
window.__cues = cues;
window.__meta = { duration: D.duration, fps: D.fps || 60, w: W, h: H, title: D.title };
window.__dbg = { props, camera, scene, world, D };
window.__ready = true;

if (!RENDER) {
  const hud = document.getElementById('hud');
  let t = Number(q.get('t') || 0), playing = true, last = performance.now();
  addEventListener('keydown', (e) => {
    if (e.key === ' ') playing = !playing;
    if (e.key === 'ArrowRight') t += 1; if (e.key === 'ArrowLeft') t = Math.max(0, t - 1);
    if (e.key === '.') { playing = false; t += 1 / 60; } if (e.key === ',') { playing = false; t = Math.max(0, t - 1 / 60); }
  });
  const loop = (now) => {
    if (playing) t += (now - last) / 1000; last = now;
    if (t > D.duration) t = 0;
    const s = renderAt(t);
    hud.textContent = `${t.toFixed(2)}s  shot ${D.shots.indexOf(s) + 1}/${D.shots.length} ${s.name || ''}`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
