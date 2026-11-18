// Floating 3D props. Every prop is hidden at the start of each frame (begin) and the active shot's
// run() shows and poses it, so the whole film stays a pure function of time.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, clamp, inv, expoOut, cubicIn, cubicOut, lerp } from './lib.js';

function canvasTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { c, g: c.getContext('2d'), tex };
}
export function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// ---------------------------------------------------------------- laptop
export class Laptop {
  constructor() {
    this.group = new THREE.Group();
    const alu = new THREE.MeshStandardMaterial({ color: '#d9dde4', metalness: .55, roughness: .38 });
    const dark = new THREE.MeshStandardMaterial({ color: '#23262d', metalness: .2, roughness: .7 });
    const base = new THREE.Mesh(new RoundedBoxGeometry(3.2, .14, 2.2, 4, .06), alu);
    base.position.y = .07; this.group.add(base);
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.05).rotateX(-Math.PI / 2), dark);
    kb.position.set(0, .141, -.28); this.group.add(kb);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .62).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9ced6', metalness: .4, roughness: .3 }));
    pad.position.set(0, .141, .62); this.group.add(pad);
    this.hinge = new THREE.Group(); this.hinge.position.set(0, .14, -1.08); this.group.add(this.hinge);
    const lid = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.1, .08, 4, .04), alu);
    lid.position.set(0, 1.05, -.04); this.hinge.add(lid);
    const bezel = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 1.98), new THREE.MeshBasicMaterial({ color: '#0b0c10' }));
    bezel.position.set(0, 1.05, .002); this.hinge.add(bezel);
    this.scr = canvasTex(1280, 800);
    // MeshBasicMaterial: the screen is self-lit and never picks up environment glare
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.92, 1.825), new THREE.MeshBasicMaterial({ map: this.scr.tex, toneMapped: false }));
    screen.position.set(0, 1.07, .004); this.hinge.add(screen);
    this.group.visible = false;
  }
  // open: 0 closed .. 1 open (~108deg). draw(g, w, h) paints the live screen.
  set({ pos, rot = [0, 0, 0], scale = 1, open = 1, draw }) {
    this.group.visible = true;
    this.group.position.set(...pos); this.group.rotation.set(...rot); this.group.scale.setScalar(scale);
    this.hinge.rotation.x = lerp(Math.PI / 2, -0.32, open);
    if (draw) { draw(this.scr.g, 1280, 800); this.scr.tex.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- paper card
export class PaperCard {
  constructor(w = 3.2, h = 2) {
    this.group = new THREE.Group();
    const paper = new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: .85 });
    this.group.add(new THREE.Mesh(new RoundedBoxGeometry(w, h, .03, 3, .012), paper));
    this.face = canvasTex(1024, Math.round(1024 * h / w));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w * .98, h * .98), new THREE.MeshStandardMaterial({ map: this.face.tex, roughness: .8 }));
    f.position.z = .016; this.group.add(f);
    this.group.visible = false; this.drawn = null;
  }
  set({ pos, rot = [0, 0, 0], scale = 1, draw, key = 'default' }) {
    this.group.visible = true;
    this.group.position.set(...pos); this.group.rotation.set(...rot); this.group.scale.setScalar(scale);
    if (draw && this.drawn !== key) { draw(this.face.g, this.face.c.width, this.face.c.height); this.face.tex.needsUpdate = true; this.drawn = key; }
  }
}

// ---------------------------------------------------------------- card swarm
// A burst of thumbnail cards that erupt from a point and stream past the camera.
export class Swarm {
  constructor(count = 46, thumbs = defaultThumbs()) {
    this.group = new THREE.Group();
    const geo = new RoundedBoxGeometry(1.6, 1.0, .03, 2, .012);
    const mats = thumbs.map((draw) => { const t = canvasTex(320, 200); draw(t.g, 320, 200); return [new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6 }), new THREE.MeshBasicMaterial({ map: t.tex })]; });
    const r = rng(99);
    this.cards = [];
    for (let i = 0; i < count; i++) {
      const m = mats[i % mats.length];
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, m[0]));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.56, .96), m[1]); face.position.z = .017; g.add(face);
      this.group.add(g);
      const a = r() * Math.PI * 2, spread = .25 + r() * .9;
      this.cards.push({ g, delay: r() * .45, dir: new THREE.Vector3(Math.cos(a) * spread, Math.sin(a) * spread * .7 + .15, 1).normalize(),
        speed: 18 + r() * 14, spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).multiplyScalar(5), scale: .7 + r() * .6 });
    }
    this.group.visible = false;
  }
  // origin: world pos; toward: world pos the cards stream toward (usually the camera); p: 0..1 over the burst
  set({ origin, toward, p }) {
    if (p <= 0 || p >= 1) return;
    this.group.visible = true;
    const o = new THREE.Vector3(...origin), fwd = new THREE.Vector3(...toward).sub(o).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), fwd);
    for (const c of this.cards) {
      const lp = clamp((p - c.delay) / (1 - c.delay) );
      c.g.visible = lp > 0 && lp < 1;
      if (!c.g.visible) continue;
      const d = expoOut(lp) * .25 * c.speed + lp * c.speed * .9;
      const dir = c.dir.clone().applyQuaternion(q);
      c.g.position.copy(o).addScaledVector(dir, d);
      c.g.lookAt(c.g.position.clone().add(dir));   // face the viewer, then tumble
      c.g.rotateX(c.spin.x * lp); c.g.rotateY(c.spin.y * lp); c.g.rotateZ(c.spin.z * lp);
      c.g.scale.setScalar(c.scale * Math.min(1, lp * 6));
    }
  }
}
export function defaultThumbs() {
  // Original "imaginary" thumbnails: simple painted scenes.
  const sky = (g, w, h, a, b) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
  const disc = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  return [
    (g, w, h) => { sky(g, w, h, '#6aa0ff', '#cfe6ff'); disc(g, 230, 60, 30, '#fff6d8'); g.fillStyle = '#5b4a3a'; g.beginPath(); g.moveTo(90, 120); g.lineTo(200, 120); g.lineTo(150, 185); g.fill(); g.fillStyle = '#5fb86a'; g.fillRect(85, 108, 120, 14); },
    (g, w, h) => { sky(g, w, h, '#1b1f4a', '#6b4aa8'); disc(g, 160, 100, 60, '#f3e9ff'); disc(g, 185, 85, 52, '#2b2a5e'); },
    (g, w, h) => { sky(g, w, h, '#ffb37a', '#ffe2c4'); g.fillStyle = '#2b6fb3'; g.fillRect(0, 130, w, 70); g.fillStyle = '#fff'; g.fillRect(150, 40, 16, 90); disc(g, 158, 40, 14, '#FF6A40'); },
    (g, w, h) => { sky(g, w, h, '#8fd3ff', '#e9f7ff'); for (let i = 0; i < 5; i++) disc(g, 40 + i * 60, 140 - (i % 2) * 20, 40, '#ffffff'); disc(g, 160, 70, 22, '#ffd36b'); },
    (g, w, h) => { sky(g, w, h, '#0e2a3a', '#1f7a7a'); g.fillStyle = '#ff8fb1'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(50 + i * 38, 120 + Math.sin(i) * 30, 14, 26, i, 0, 7); g.fill(); } },
    (g, w, h) => { sky(g, w, h, '#f6d2e8', '#c7d4ff'); g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.beginPath(); g.arc(160, 210, 130, Math.PI, 0); g.stroke(); g.strokeStyle = '#FF6A40'; g.beginPath(); g.arc(160, 210, 110, Math.PI, 0); g.stroke(); },
    (g, w, h) => { sky(g, w, h, '#ffe7a8', '#ff9f6b'); g.fillStyle = '#3a2a4a'; g.beginPath(); g.moveTo(0, 200); g.lineTo(90, 90); g.lineTo(160, 160); g.lineTo(230, 70); g.lineTo(320, 200); g.fill(); },
    (g, w, h) => { sky(g, w, h, '#a9e4c9', '#e6fff3'); g.fillStyle = '#2f5d50'; g.fillRect(140, 60, 40, 110); disc(g, 160, 60, 50, '#4fa37f'); disc(g, 160, 35, 12, '#fff'); },
  ];
}

// ---------------------------------------------------------------- shatter icon
// A rounded-square icon pre-fractured into Voronoi shards. crack: gaps open and glow; shatter: shards fly.
function clipPoly(poly, nx, ny, c) { // keep side where nx*x+ny*y <= c
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = nx * a[0] + ny * a[1] - c, db = nx * b[0] + ny * b[1] - c;
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
export class ShatterIcon {
  constructor({ size = 2, sites = 22, seed = 5, draw = defaultIcon } = {}) {
    this.group = new THREE.Group();
    const r = rng(seed), half = size / 2, rad = size * .22;
    const outline = [];
    for (let q = 0; q < 4; q++) { const cx = (q === 0 || q === 3 ? 1 : -1) * (half - rad), cy = (q < 2 ? 1 : -1) * (half - rad);
      for (let k = 0; k <= 8; k++) { const a = (q * 90 + k * 90 / 8) * Math.PI / 180; outline.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } }
    // sites cluster toward the impact point (slightly off-centre) for a natural fracture
    const pts = [];
    for (let i = 0; i < sites; i++) { const a = r() * 7, d = Math.pow(r(), .75) * half * 1.1; pts.push([.15 * half + Math.cos(a) * d, .1 * half + Math.sin(a) * d]); }
    const face = canvasTex(512, 512); draw(face.g, 512, 512);
    const capMat = new THREE.MeshStandardMaterial({ map: face.tex, roughness: .35, metalness: .05 });
    const sideMat = new THREE.MeshStandardMaterial({ color: '#f2f2f6', roughness: .4 });
    this.shards = [];
    for (let i = 0; i < pts.length; i++) {
      let poly = outline.slice();
      for (let j = 0; j < pts.length && poly.length; j++) { if (i === j) continue;
        const [ax, ay] = pts[i], [bx, by] = pts[j], nx = bx - ax, ny = by - ay;
        poly = clipPoly(poly, nx, ny, nx * (ax + bx) / 2 + ny * (ay + by) / 2); }
      if (poly.length < 3) continue;
      const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
      const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x - cx, y - cy)));
      const geo = new THREE.ExtrudeGeometry(shape, { depth: size * .14, bevelEnabled: true, bevelThickness: .012, bevelSize: .01, bevelSegments: 1 });
      geo.translate(0, 0, -size * .07);
      // map cap UVs back to the icon face
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (pos.getX(k) + cx + half) / size, (pos.getY(k) + cy + half) / size);
      const m = new THREE.Mesh(geo, [capMat, sideMat]);
      const piv = new THREE.Group(); piv.add(m); this.group.add(piv);
      const out = new THREE.Vector3(cx, cy, 0).normalize();
      this.shards.push({ piv, cx, cy, out, z: .6 + r() * 1.6, spin: new THREE.Vector3(r() - .5, r() - .5, r() - .5).normalize(), w: 4 + r() * 8, sp: .7 + r() * .8 });
    }
    // coral glow behind the cracks
    const gt = canvasTex(256, 256), gg = gt.g.createRadialGradient(128 + 20, 128 - 14, 0, 128, 128, 128);
    gg.addColorStop(0, 'rgba(255,190,150,1)'); gg.addColorStop(.35, 'rgba(255,106,64,.9)'); gg.addColorStop(1, 'rgba(255,106,64,0)');
    gt.g.fillStyle = gg; gt.g.fillRect(0, 0, 256, 256);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.1, size * 1.1), new THREE.MeshBasicMaterial({ map: gt.tex, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
    this.glow.position.z = -size * .03; this.group.add(this.glow);
    this.group.visible = false;
  }
  set({ pos, rot = [0, 0, 0], scale = 1, crack = 0, shatter = 0 }) {
    this.group.visible = true;
    this.group.position.set(...pos); this.group.rotation.set(...rot); this.group.scale.setScalar(scale);
    const gap = cubicOut(crack) * .03;
    this.glow.material.opacity = crack * (1 - clamp(shatter * 8));
    this.glow.visible = shatter < .125;
    for (const s of this.shards) {
      const e = shatter;
      s.piv.position.set(s.cx * (1 + gap * 2) + s.out.x * e * 4.5 * s.sp, s.cy * (1 + gap * 2) + s.out.y * e * 4.5 * s.sp - e * e * 1.2, s.z * e * 3.5);
      s.piv.setRotationFromAxisAngle(s.spin, e * s.w + crack * .04);
      s.piv.scale.setScalar(1 - e * .25);
    }
  }
}
function defaultIcon(g, w, h) {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#7fb2ff'); gr.addColorStop(1, '#3d5bd9');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.95)';  // an original glyph: a cloud with a door
  g.beginPath(); g.arc(200, 300, 70, 0, 7); g.arc(275, 255, 90, 0, 7); g.arc(350, 300, 66, 0, 7); g.fill();
  g.fillRect(200, 300, 150, 66);
  g.fillStyle = '#FF6A40'; roundRect(g, 252, 286, 46, 80, 23); g.fill();
}

// ---------------------------------------------------------------- floating island
export class Island {
  constructor(seed = 3) {
    this.group = new THREE.Group();
    const r = rng(seed);
    const rockGeo = new THREE.ConeGeometry(2.2, 3.2, 11, 5).rotateX(Math.PI).translate(0, -1.6, 0);
    const p = rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = 1 + (r() - .5) * .28 * (y < -.05 ? 1 : 0);
      p.setXYZ(i, p.getX(i) * k, y + (y < -.05 ? (r() - .5) * .25 : 0), p.getZ(i) * k);
    }
    rockGeo.computeVertexNormals();
    this.group.add(new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ color: '#8a7360', roughness: .95, flatShading: true })));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.2, .32, 11), new THREE.MeshStandardMaterial({ color: '#7cc56f', roughness: .8, flatShading: true }));
    top.position.y = .05; this.group.add(top);
    const leaf = new THREE.MeshStandardMaterial({ color: '#3f9a5a', roughness: .8, flatShading: true });
    const trunk = new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: .9 });
    for (let i = 0; i < 6; i++) {
      const a = r() * 7, d = .6 + r() * 1.3, s = .6 + r() * .5, tr = new THREE.Group();
      const tk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .4 * s, 6), trunk); tk.position.y = .2 * s; tr.add(tk);
      const cn = new THREE.Mesh(new THREE.ConeGeometry(.32 * s, .9 * s, 7), leaf); cn.position.y = .75 * s; tr.add(cn);
      tr.position.set(Math.cos(a) * d, .21, Math.sin(a) * d); this.group.add(tr);
    }
    // a tiny lighthouse
    const lh = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(.18, .26, 1.4, 16), new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: .5 }));
    tower.position.y = .7; lh.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.215, .225, .22, 16), new THREE.MeshStandardMaterial({ color: '#FF6A40', roughness: .5 }));
    band.position.y = .75; lh.add(band);
    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff4cf', toneMapped: false }));
    this.lamp.position.y = 1.55; lh.add(this.lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.24, .3, 16), new THREE.MeshStandardMaterial({ color: '#30384a', roughness: .5 }));
    cap.position.y = 1.8; lh.add(cap);
    lh.position.set(-.4, .2, .3); this.group.add(lh);
    // small rocks orbiting below
    this.bits = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(.18 + r() * .2, 0), new THREE.MeshStandardMaterial({ color: '#8a7360', flatShading: true })); this.group.add(m); this.bits.push({ m, a: r() * 7, d: 2.4 + r(), y: -1 - r() * 2, s: .3 + r() * .4 }); }
    this.group.visible = false;
  }
  set({ pos, rot = [0, 0, 0], scale = 1, t = 0, lamp = 1 }) {
    this.group.visible = true;
    this.group.position.set(pos[0], pos[1] + Math.sin(t * 1.1) * .12, pos[2]);
    this.group.rotation.set(rot[0], rot[1] + t * .08, rot[2]); this.group.scale.setScalar(scale);
    this.lamp.material.color.setScalar(.6 + lamp * 1.8);
    for (const b of this.bits) b.m.position.set(Math.cos(b.a + t * b.s) * b.d, b.y + Math.sin(t + b.a) * .15, Math.sin(b.a + t * b.s) * b.d);
  }
}

export class Props {
  constructor(scene) {
    this.laptop = new Laptop();
    this.card = new PaperCard();
    this.swarm = new Swarm();
    this.icon = new ShatterIcon();
    this.island = new Island();
    this.all = [this.laptop, this.card, this.swarm, this.icon, this.island];
    for (const p of this.all) scene.add(p.group);
  }
  begin() { for (const p of this.all) p.group.visible = false; }
  add(scene, name, prop) { this[name] = prop; this.all.push(prop); scene.add(prop.group); }
}
