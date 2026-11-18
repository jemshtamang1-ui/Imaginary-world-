// The continuous 3D world: sky, cloud sea, cumulus cards, planet (space beat), lights.
import * as THREE from 'three';
import { rng } from './lib.js';

const NOISE = /* glsl */`
float h2(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float n2(vec2 x){ vec2 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(h2(i),h2(i+vec2(1,0)),f.x), mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x), f.y); }
float fbm2(vec2 p, int oct){ float a=.5, s=0.; mat2 r = mat2(.8,.6,-.6,.8);
  for(int i=0;i<6;i++){ if(i>=oct) break; s += a*n2(p); p = r*p*2.02 + 3.7; a *= .5; } return s; }
`;

const SKY_FS = /* glsl */`
uniform vec3 top, horizon, below, sunCol, sunDir; uniform float sunSize, glow, stars, sunMul;
varying vec3 vDir;
float hs(vec3 p){ p = fract(p*vec3(443.897,441.423,437.195)); p += dot(p, p.yzx+19.19); return fract((p.x+p.y)*p.z); }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 c = mix(horizon, top, pow(clamp(h, 0., 1.), .5));
  c = mix(c, below, smoothstep(0., -.08, h));
  float s = max(dot(d, sunDir), 0.);
  c += sunCol * glow * sunMul * (pow(s, 6.) * .18 + pow(s, 48.) * .45 + pow(s, 600.) * 1.2);
  c += sunCol * smoothstep(1. - sunSize, 1. - sunSize * .5, s) * 12. * sunMul * step(.00025, sunSize);
  if(stars > 0.){                                            // faint milky band; point stars come from Starfield
    float b = exp(-abs(dot(d, normalize(vec3(.3,1.,.2)))) * 7.);
    c += vec3(.03,.035,.07) * stars * b;
  }
  gl_FragColor = vec4(c, 1.);
}`;

const SEA_FS = /* glsl */`
uniform vec3 lit, shadow, fogCol, sunCol, sunDir; uniform float time, fogDensity, hide;
varying vec3 vW;
${NOISE}
void main(){
  if(hide > .5) discard;
  float dist = length(vW - cameraPosition);
  vec2 p = vW.xz * .0011 + vec2(time * .006, time * .002);
  int oct = dist < 3000. ? 6 : dist < 9000. ? 4 : 3;
  float h = fbm2(p, oct);
  float e = .015;
  float hx = fbm2(p + vec2(e, 0.), oct), hz = fbm2(p + vec2(0., e), oct);
  float k = mix(14., 3., smoothstep(2000., 14000., dist));
  vec3 n = normalize(vec3((h - hx) * k / e * .02, 1., (h - hz) * k / e * .02));
  float lam = clamp(dot(n, sunDir) * .6 + .4, 0., 1.);
  float b = smoothstep(.3, .8, h);                       // billow tops are brighter, troughs carry shadow
  float cav = smoothstep(.55, .25, h);
  vec3 c = mix(shadow, lit, clamp(lam * .5 + b * .7, 0., 1.));
  c *= 1. - cav * .12;
  vec3 v = normalize(vW - cameraPosition);
  float f = 1. - exp(-dist * fogDensity);
  float glint = pow(max(dot(v, sunDir), 0.), 10.);
  c = mix(c, fogCol, f) + sunCol * glint * .18 * f;
  gl_FragColor = vec4(c, 1.);
}`;

const CLOUD_VS = /* glsl */`
attribute vec4 iPos;   // xyz = centre of card base area, w = size
attribute vec4 iMisc;  // x = tile, y = brightness, z = drift speed, w = alpha mult
uniform float time, cols, rows; uniform vec3 sunDir;
varying vec2 vUvA, vUvB; varying vec3 vW; varying float vB, vSide, vNear, vA;
void main(){
  vec3 c = iPos.xyz + vec3(time * iMisc.z, 0., 0.);
  vec3 toCam = cameraPosition - c; toCam.y = 0.;
  vec3 fwd = normalize(toCam + vec3(1e-4, 0., 0.));
  vec3 right = normalize(cross(vec3(0., 1., 0.), fwd));
  vec3 w = c + right * position.x * iPos.w + vec3(0., 1., 0.) * position.y * iPos.w;
  vW = w;
  vec2 tile = vec2(mod(iMisc.x, cols), rows - 1. - floor(iMisc.x / cols));
  vUvA = (uv + tile) / vec2(cols, rows);
  vUvB = (vec2(1. - uv.x, uv.y) + tile) / vec2(cols, rows);
  vec3 sh = normalize(vec3(sunDir.x, 0., sunDir.z) + 1e-4);
  vSide = smoothstep(-.3, .3, dot(right, sh));
  vNear = smoothstep(.35, .9, length(cameraPosition - c) / iPos.w);
  vB = iMisc.y; vA = iMisc.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.);
}`;
const CLOUD_FS = /* glsl */`
uniform sampler2D atlas; uniform vec3 lit, shadow, fogCol, sunCol, sunDir; uniform float fogDensity, silver, opacity;
varying vec2 vUvA, vUvB; varying vec3 vW; varying float vB, vSide, vNear, vA;
void main(){
  vec4 tx = mix(texture2D(atlas, vUvB), texture2D(atlas, vUvA), vSide);
  float a = tx.a * vNear * vA * opacity;
  if(a < .004) discard;
  float l = pow(tx.r, 1.1);
  vec3 c = shadow * (.78 + .32 * tx.g) + (lit - shadow * (.78 + .32 * tx.g)) * l;
  vec3 v = normalize(vW - cameraPosition);
  float back = pow(max(dot(v, sunDir), 0.), 5.);
  c += sunCol * back * (1. - tx.a) * 1.6 * silver;
  c *= vB;
  float f = 1. - exp(-length(vW - cameraPosition) * fogDensity * .9);
  c = mix(c, fogCol, f);
  gl_FragColor = vec4(c, a);
}`;

const PLANET_VS = /* glsl */`varying vec3 vN, vW, vP; void main(){ vN = normalize(mat3(modelMatrix)*normal); vP = position; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const PLANET_FS = /* glsl */`
uniform vec3 sunDir; uniform float time, opacity, frost, sunMul;
varying vec3 vN, vW, vP;
${NOISE}
void main(){
  vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  float sphereU = atan(vP.z, vP.x), sphereV = vP.y / length(vP);
  vec2 q = vec2(sphereU * 3., sphereV * 3.);
  float land = smoothstep(.52, .56, fbm2(q * 1.3 + 2., 5));
  float cl = smoothstep(.5, .8, fbm2(q * 2.5 + vec2(time*.01, 0.), 5));
  vec3 base = mix(vec3(.02,.09,.22), vec3(.16,.26,.12), land);
  float ice = smoothstep(0., .12, frost * 1.35 - (1. - abs(sphereV)) * .9 + (fbm2(q * 2. + 7., 4) - .5) * .5);
  base = mix(base, vec3(.78, .87, .97) * (.7 + .45 * fbm2(q * 7. + 3., 4)), ice);
  base = mix(base, vec3(.95), cl * .85 * (1. - ice * .6));
  float dl = dot(n, sunDir);
  float day = smoothstep(-.08, .25, dl) * sunMul;
  vec3 c = base * day * 1.6 + base * vec3(.05, .07, .12) * (1. - sunMul) * (.4 + ice);
  float fr = pow(1. - max(dot(n, v), 0.), 3.);
  c += mix(vec3(.25,.55,1.2), vec3(.6,.75,1.), ice) * fr * (smoothstep(-.25, .3, dl) * sunMul + (1. - sunMul) * .12) * 1.8;
  gl_FragColor = vec4(c, opacity);
}`;
const ATMO_FS = /* glsl */`
uniform vec3 sunDir; uniform float opacity, sunMul; varying vec3 vN, vW, vP;
void main(){ vec3 n = normalize(vN); vec3 v = normalize(cameraPosition - vW);
  float rim = pow(1. - abs(dot(n, v)), 2.5);
  float lit = smoothstep(-.3, .35, dot(n, sunDir)) * sunMul + (1. - sunMul) * .1;
  gl_FragColor = vec4(vec3(.35,.62,1.25) * rim * lit * 2.2, rim * lit * opacity); }`;

// planet material for other props (e.g. the mini Earth in the light-travel diagram)
export function makePlanetMat(uniforms) {
  return new THREE.ShaderMaterial({ uniforms, vertexShader: PLANET_VS, fragmentShader: PLANET_FS, transparent: true });
}

export class World {
  constructor(scene, atlasTex, atlasInfo) {
    this.scene = scene;
    const col = () => new THREE.Color();
    this.u = {
      top: { value: col() }, horizon: { value: col() }, below: { value: col() }, sunCol: { value: col() },
      sunDir: { value: new THREE.Vector3(0, .2, 1) }, sunSize: { value: .0015 }, glow: { value: 1 }, stars: { value: 0 },
      lit: { value: col() }, shadow: { value: col() }, fogCol: { value: col() }, fogDensity: { value: .00008 },
      seaLit: { value: col() }, seaShadow: { value: col() }, time: { value: 0 }, silver: { value: .5 },
      hide: { value: 0 }, opacity: { value: 1 }, planetOpacity: { value: 0 }, sunMul: { value: 1 }, frost: { value: 0 }, planetSun: { value: 1 },
    };
    const u = this.u;
    // sky
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50000, 48, 24), new THREE.ShaderMaterial({
      uniforms: { top: u.top, horizon: u.horizon, below: u.below, sunCol: u.sunCol, sunDir: u.sunDir, sunSize: u.sunSize, glow: u.glow, stars: u.stars, sunMul: u.sunMul },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix*viewMatrix*vec4(position + cameraPosition, 1.); gl_Position = p.xyww; }`,
      fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false }));
    sky.renderOrder = -10; sky.frustumCulled = false; scene.add(sky);
    // sea
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: { lit: u.seaLit, shadow: u.seaShadow, fogCol: u.fogCol, sunCol: u.sunCol, sunDir: u.sunDir, time: u.time, fogDensity: u.fogDensity, hide: u.hide },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: SEA_FS }));
    scene.add(this.sea);
    // cumulus cards + sea puffs (one instanced mesh, sorted back-to-front every frame)
    this.cards = this.#layout(atlasInfo);
    const n = this.cards.length;
    const geo = new THREE.InstancedBufferGeometry();
    geo.copy(new THREE.PlaneGeometry(1, 1).translate(0, .5, 0));
    geo.instanceCount = n;
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.iMisc = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.iPos); geo.setAttribute('iMisc', this.iMisc);
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: { atlas: { value: atlasTex }, cols: { value: atlasInfo.cols }, rows: { value: atlasInfo.rows }, time: u.time,
        lit: u.lit, shadow: u.shadow, fogCol: u.fogCol, sunCol: u.sunCol, sunDir: u.sunDir, fogDensity: u.fogDensity, silver: u.silver, opacity: u.opacity },
      vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false });
    this.clouds = new THREE.Mesh(geo, this.cloudMat);
    this.clouds.frustumCulled = false; this.clouds.renderOrder = 1;
    scene.add(this.clouds);
    // planet for the space beat
    const pu = { sunDir: u.sunDir, time: u.time, opacity: u.planetOpacity, frost: u.frost, sunMul: u.planetSun };
    this.planet = new THREE.Group();
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(6000, 128, 64), new THREE.ShaderMaterial({ uniforms: pu, vertexShader: PLANET_VS, fragmentShader: PLANET_FS, transparent: true })));
    this.planet.add(new THREE.Mesh(new THREE.SphereGeometry(6260, 128, 64), new THREE.ShaderMaterial({ uniforms: pu, vertexShader: PLANET_VS, fragmentShader: ATMO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide })));
    this.planet.position.set(0, -6400, -9000);
    this.planet.visible = false;
    scene.add(this.planet);
    // lights for props
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4); scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbcd4ff, 0xe8eef8, 1.3); scene.add(this.hemi);
    this.order = new Uint16Array(n).map((_, i) => i);
    this.d2 = new Float32Array(n);
  }

  #layout(info) {
    const r = rng(7), cards = [];
    const kinds = info.kinds;
    const pick = (kind) => { let i; do { i = Math.floor(r() * info.count); } while (kind != null && kinds[i] !== kind && r() < .9); return i; };
    // towering cumulus, spread across a big disc, denser in a band 2-9 km out
    for (let i = 0; i < 90; i++) {
      const a = r() * Math.PI * 2, d = 1800 + Math.pow(r(), .8) * 16000;
      const size = 1100 + r() * 2600;
      cards.push({ x: Math.cos(a) * d, y: -size * .22, z: Math.sin(a) * d, s: size, tile: pick(r() < .5 ? 2 : 1), b: .94 + r() * .1, v: (r() - .5) * 6, a: 1 });
    }
    // low heaps and sea puffs give the floor volume
    // clustered, so the floor reads as rolling banks rather than scattered tufts
    for (let k = 0; k < 70; k++) {
      const a = r() * Math.PI * 2, d = 400 + Math.pow(r(), .6) * 12000;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, n = 3 + Math.floor(r() * 6), spread = 300 + d * .06;
      for (let i = 0; i < n; i++) {
        const size = (300 + r() * 600) * (d / 7000 + .5);
        cards.push({ x: cx + (r() - .5) * spread * 2, y: -size * (.36 + r() * .06), z: cz + (r() - .5) * spread, s: size, tile: pick(r() < .75 ? 0 : 1), b: .95 + r() * .08, v: (r() - .5) * 4, a: 1 });
      }
    }
    return cards;
  }

  // p: blended palette object (from palettes.js)
  update(t, camera, p) {
    const u = this.u, C = (c, hex) => c.set(hex);
    C(u.top.value, p.skyTop); C(u.horizon.value, p.horizon); C(u.below.value, p.below); C(u.sunCol.value, p.sun);
    C(u.lit.value, p.cloudLit); C(u.shadow.value, p.cloudShadow); C(u.fogCol.value, p.fog);
    C(u.seaLit.value, p.seaLit); C(u.seaShadow.value, p.seaShadow);
    const az = p.sunAz * Math.PI / 180, el = p.sunEl * Math.PI / 180;
    u.sunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    u.sunSize.value = p.sunSize; u.glow.value = p.glow; u.stars.value = p.stars; u.fogDensity.value = p.fogDensity;
    u.silver.value = p.silver; u.time.value = t;
    const space = p.space;
    u.hide.value = space > .5 ? 1 : 0;
    u.opacity.value = 1 - space;
    this.clouds.visible = space < .99;
    const fx = this.fx || {};
    u.sunMul.value = fx.sunMul ?? 1; u.frost.value = fx.frost ?? 0; u.planetSun.value = fx.planetSun ?? 1;
    const pm = fx.planetMul ?? 1;
    this.planet.visible = space * pm > .01; u.planetOpacity.value = space * pm;
    this.sun.color.set(p.sun); this.sun.position.copy(camera.position).addScaledVector(u.sunDir.value, 100); this.sun.target.position.copy(camera.position);
    this.hemi.color.set(p.skyTop).lerp(new THREE.Color('#ffffff'), .45); this.hemi.groundColor.set(p.seaShadow).lerp(new THREE.Color(p.cloudLit), .5);
    this.#sort(camera);
  }

  #sort(camera) {
    const { cards, order, d2 } = this, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (let i = 0; i < cards.length; i++) { const c = cards[i]; const dx = c.x - cx, dy = c.y + c.s * .4 - cy, dz = c.z - cz; d2[i] = dx * dx + dy * dy + dz * dz; }
    order.sort((a, b) => d2[b] - d2[a]);
    const P = this.iPos.array, M = this.iMisc.array;
    for (let k = 0; k < order.length; k++) {
      const c = cards[order[k]];
      P[k * 4] = c.x; P[k * 4 + 1] = c.y; P[k * 4 + 2] = c.z; P[k * 4 + 3] = c.s;
      M[k * 4] = c.tile; M[k * 4 + 1] = c.b; M[k * 4 + 2] = c.v; M[k * 4 + 3] = c.a;
    }
    this.iPos.needsUpdate = true; this.iMisc.needsUpdate = true;
  }
}
