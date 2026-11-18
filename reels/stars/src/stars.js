// Night-sky graphics: a vanishing starfield, glow sprites, constellations, and a light-travel diagram.
import * as THREE from 'three';
import { rng, clamp, lerp, expoOut, cubicOut, cubicIn, smooth, inv } from './lib.js';

// ---------------------------------------------------------------- starfield (stars at infinity, follow the camera)
const STAR_VS = /* glsl */`
attribute float aSize, aPhase, aJit; attribute vec3 aCol;
uniform float uTime, uOpacity, uKill, uWave, uRevive, uReviveDur, uPx; uniform vec3 uWaveDir;
varying vec3 vCol; varying float vA, vFlare, vBig;
void main(){
  vec3 dir = normalize(position);
  float d = acos(clamp(dot(dir, uWaveDir), -1., 1.)) / 3.14159 * .8 + aJit * .2;
  float k = uKill + d * uWave;
  float death = smoothstep(k, k + .08, uTime);
  float flare = exp(-pow((uTime - (k - .025)) / .045, 2.));
  float r = uRevive + d * uReviveDur;
  float rev = smoothstep(r, r + .3, uTime);
  float alive = max(1. - death, rev);
  float tw = .72 + .28 * sin(uTime * (1.3 + aPhase * 3.) + aPhase * 40.);
  vA = alive * tw * uOpacity; vFlare = flare * (1. - rev) * uOpacity; vCol = aCol; vBig = smoothstep(2.6, 4.5, aSize);
  gl_PointSize = aSize * uPx * (1. + vFlare * 3.) * step(.002, vA + vFlare);
  gl_Position = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.);
}`;
const STAR_FS = /* glsl */`
varying vec3 vCol; varying float vA, vFlare, vBig;
void main(){
  vec2 p = gl_PointCoord * 2. - 1.; float r2 = dot(p, p);
  float core = exp(-r2 * 14.), halo = exp(-r2 * 3.5) * .22;
  float spikes = (exp(-abs(p.x) * 40.) + exp(-abs(p.y) * 40.)) * exp(-sqrt(r2) * 2.5) * .5 * vBig;
  float i = (core + halo + spikes) * (vA + vFlare * 2.5);
  if(i < .003) discard;
  gl_FragColor = vec4(vCol * i, 1.);
}`;
export class Starfield {
  constructor(count = 7000) {
    const r = rng(42), R = 30000;
    const pos = new Float32Array(count * 3), size = new Float32Array(count), ph = new Float32Array(count), jit = new Float32Array(count), col = new Float32Array(count * 3);
    const temps = [[.7, .8, 1.25], [.9, .95, 1.1], [1.15, 1.1, 1.0], [1.25, 1.0, .78], [1.3, .85, .7]];
    const band = new THREE.Vector3(.3, 1, .2).normalize();
    for (let i = 0; i < count; i++) {
      let v;
      do {      // concentrate some stars along a milky band
        v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
      } while (v.lengthSq() > 1 || v.lengthSq() < .01 || (r() < .45 && Math.abs(v.clone().normalize().dot(band)) > .18));
      v.normalize().multiplyScalar(R); pos.set([v.x, v.y, v.z], i * 3);
      size[i] = 1.1 + Math.pow(r(), 9) * 4.2 + r() * .6;
      ph[i] = r(); jit[i] = r();
      const t = temps[Math.floor(Math.pow(r(), .8) * temps.length)];
      col.set(t.map((c) => c * (.55 + .45 * Math.min(1, size[i] / 3))), i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aJit', new THREE.BufferAttribute(jit, 1)); g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    this.u = { uTime: { value: 0 }, uOpacity: { value: 0 }, uKill: { value: 1e9 }, uWave: { value: .6 }, uRevive: { value: 1e9 }, uReviveDur: { value: .6 },
      uPx: { value: 1.6 }, uWaveDir: { value: new THREE.Vector3(0, 0, -1) } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: STAR_VS, fragmentShader: STAR_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false; this.points.renderOrder = -5;
    this.group = this.points;
  }
  // defaults every frame; shots override with set()
  reset(t, opacity, px) { Object.assign(this, { t, opacity, kill: 1e9, wave: .6, revive: 1e9, reviveDur: .6, dir: [0, 0, -1], px }); }
  set(o) { Object.assign(this, o); }
  apply() {
    const u = this.u; u.uTime.value = this.t; u.uOpacity.value = this.opacity; u.uKill.value = this.kill; u.uWave.value = this.wave;
    u.uRevive.value = this.revive; u.uReviveDur.value = this.reviveDur; u.uPx.value = this.px; u.uWaveDir.value.set(...this.dir).normalize();
    this.points.visible = this.opacity > .001;
  }
}

// ---------------------------------------------------------------- glow sprite (camera-facing, additive)
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.08, 'rgba(255,255,255,.9)'); gr.addColorStop(.22, 'rgba(255,255,255,.32)');
  gr.addColorStop(.5, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  // soft cross flare
  g.globalCompositeOperation = 'lighter';
  for (const [w, h] of [[256, 6], [6, 256]]) { const lg = g.createRadialGradient(128, 128, 0, 128, 128, 128); lg.addColorStop(0, 'rgba(255,255,255,.55)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(128 - w / 2, 128 - h / 2, w, h); }
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
export class Glow {
  constructor(color = '#ffffff') {
    this.mat = new THREE.SpriteMaterial({ map: getGlowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.base = new THREE.Color(color);
    this.group = new THREE.Sprite(this.mat); this.group.visible = false;
  }
  set({ pos, size = 1, color, intensity = 1 }) {
    if (intensity <= .001 || size <= 0) return;
    this.group.visible = true; this.group.position.set(...pos); this.group.scale.setScalar(size);
    if (color) this.base.set(color);
    this.mat.color.copy(this.base).multiplyScalar(Math.max(1, intensity));
    this.mat.opacity = Math.min(1, intensity);
  }
}

// ---------------------------------------------------------------- constellations (invented patterns)
const PATTERNS = [
  { at: [-5.2, 1.6], pts: [[0, 0], [1.1, .5], [2.3, .2], [3.1, 1.1], [2.6, 2.2], [1.4, 2.0], [1.1, .5]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]] },       // "the kite"
  { at: [-.8, 2.2], pts: [[0, 0], [.9, -.6], [1.9, -.4], [2.6, -1.3], [3.4, -1.0], [1.7, .7]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },                          // "the heron"
  { at: [3.0, .2], pts: [[0, 0], [.7, 1.2], [1.6, 1.6], [2.4, 1.0], [2.0, -.2], [1.0, -.6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]] },                   // "the crown"
  { at: [-3.4, -1.6], pts: [[0, 0], [1.2, .3], [2.2, -.2], [3.0, .5], [3.8, .1]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },                                             // "the river"
];
export class Constellations {
  constructor() {
    this.group = new THREE.Group(); this.lines = []; this.stars = [];
    const r = rng(17);
    const lineMat = () => new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    for (const P of PATTERNS) {
      const S = P.pts.map(([x, y]) => [x + P.at[0], y + P.at[1]]);
      for (const [a, b] of P.lines) {
        const [ax, ay] = S[a], [bx, by] = S[b], len = Math.hypot(bx - ax, by - ay);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, .028).translate(.5, 0, 0), lineMat());
        m.position.set(ax, ay, 0); m.rotation.z = Math.atan2(by - ay, bx - ax);
        this.group.add(m);
        this.lines.push({ m, len, base: [ax, ay], rot: m.rotation.z, k: this.lines.length, drift: [(r() - .5) * 2, (r() - .5) * 2], spin: (r() - .5) * 2 });
      }
      for (const [x, y] of S) {
        const g = new Glow('#e8f0ff'); this.group.add(g.group);
        this.stars.push({ g, x, y, s: .35 + r() * .35, drift: [(r() - .5) * 1.5, (r() - .5) * 1.5] });
      }
    }
    this.group.visible = false;
  }
  // draw: 0..1 lines draw in; brk: 0..1 break apart and fade
  set({ pos, rot = [0, 0, 0], scale = 1, draw = 1, brk = 0, t = 0 }) {
    this.group.visible = true; this.group.position.set(...pos); this.group.rotation.set(...rot); this.group.scale.setScalar(scale);
    const n = this.lines.length, b = cubicOut(brk), fade = 1 - smooth(clamp(brk * 1.4));
    this.lines.forEach((L) => {
      const d = clamp(draw * 1.6 - L.k / n * .6);
      L.m.scale.x = L.len * expoOut(d) * (1 - b * .4);
      L.m.position.set(L.base[0] + L.drift[0] * b, L.base[1] + L.drift[1] * b - b * b * .8, 0);
      L.m.rotation.z = L.rot + L.spin * b;
      L.m.material.opacity = .55 * fade * (d > 0 ? 1 : 0);
      L.m.visible = d > 0 && fade > .01;
    });
    this.stars.forEach((S, i) => {
      S.g.set({ pos: [S.x + S.drift[0] * b, S.y + S.drift[1] * b - b * b * .6, .01], size: S.s * (1 + .15 * Math.sin(t * 3 + i)), intensity: fade * clamp(draw * 3) });
      S.g.group.visible = fade > .01 && draw > 0;
    });
  }
}

// ---------------------------------------------------------------- light-travel diagram
const SHELL_FS = /* glsl */`
uniform float opacity; uniform vec3 color; varying vec3 vN, vW;
void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(1. - abs(dot(normalize(vN), v)), 7.);
  gl_FragColor = vec4(color * rim * opacity * 1.6, 1.); }`;
export class LightPath {
  constructor(makePlanetMat) {
    this.group = new THREE.Group();
    this.star = new Glow('#ffe9c4'); this.group.add(this.star.group);
    this.pulse = new Glow('#fff4dc'); this.group.add(this.pulse.group);
    this.trail = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(-.5, 0, 0), new THREE.MeshBasicMaterial({ map: trailTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: '#ffe6b8' }));
    this.group.add(this.trail);
    this.dashes = [];
    const dg = new THREE.PlaneGeometry(.22, .035);
    for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(dg, new THREE.MeshBasicMaterial({ color: '#bcd0ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); this.group.add(m); this.dashes.push(m); }
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.ShaderMaterial({ uniforms: { opacity: { value: 0 }, color: { value: new THREE.Color('#ffd9a0') } },
      vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: SHELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.group.add(this.shell);
    this.pu = { sunDir: { value: new THREE.Vector3(-1, .3, .4).normalize() }, time: { value: 0 }, opacity: { value: 1 }, frost: { value: 0 }, sunMul: { value: 1 } };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), makePlanetMat(this.pu));
    this.group.add(this.earth);
    this.group.visible = false;
  }
  // a, b: world points (star, earth); p: pulse progress 0..1; star: 0..1 star brightness; shell: 0..1 wavefront progress
  set({ a, b, p = -1, star = 1, starSize = 3, shell = -1, earthSize = .9, t = 0, dashes = 1, camera }) {
    this.group.visible = true;
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), D = B.clone().sub(A), L = D.length(), dir = D.clone().normalize();
    this.star.set({ pos: a, size: starSize * (1 + .05 * Math.sin(t * 7)), intensity: star * 1.6 });
    this.star.group.visible = star > .01;
    this.earth.position.copy(B); this.earth.scale.setScalar(earthSize); this.earth.rotation.y = t * .15;
    this.pu.sunDir.value.copy(dir).multiplyScalar(-1).normalize(); this.pu.time.value = t;
    // dashed path with a slow flow
    this.dashes.forEach((m, i) => {
      const k = ((i + t * 1.2) % this.dashes.length) / this.dashes.length;
      const s = k * (L - earthSize * 1.3);
      m.position.copy(A).addScaledVector(dir, s + .3); m.quaternion.copy(camera.quaternion);
      const sp = this.#screenAngle(A, B, camera); m.rotateZ(sp);
      m.material.opacity = .35 * dashes * Math.min(1, k * 8) * Math.min(1, (1 - k) * 8);
      m.visible = dashes > .01;
    });
    this.pulse.group.visible = false; this.trail.visible = false;
    if (p >= 0 && p <= 1) {
      const P = A.clone().addScaledVector(dir, p * (L - earthSize));
      this.pulse.set({ pos: P.toArray(), size: 1.3, intensity: 2.2 });
      this.trail.visible = true; this.trail.position.copy(P); this.trail.quaternion.copy(camera.quaternion);
      this.trail.rotateZ(this.#screenAngle(A, B, camera)); this.trail.scale.set(Math.min(4, p * L), .45, 1);
    }
    this.shell.visible = shell > 0 && shell < 1.15;
    if (this.shell.visible) {
      this.shell.position.copy(A); this.shell.scale.setScalar(Math.max(.01, shell * L));
      this.shell.material.uniforms.opacity.value = .9 * (1 - shell * .55) * (1 - smooth(clamp((shell - .9) / .25)));
    }
  }
  #screenAngle(A, B, camera) {
    const a = A.clone().project(camera), b = B.clone().project(camera);
    return Math.atan2((b.y - a.y) * 9, (b.x - a.x) * 16);
  }
}
function trailTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.9)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 32);
  const v = g.createLinearGradient(0, 0, 0, 32); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0, 0, 256, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
