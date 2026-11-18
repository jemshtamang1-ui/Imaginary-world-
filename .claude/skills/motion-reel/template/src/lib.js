// Pure helpers. Everything in the film is a function of time t, so no state lives here.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));          // 0..1 progress of x through [a,b]
export const smooth = (t) => t * t * (3 - 2 * t);
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const expoIn = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const cubicOut = (t) => 1 - Math.pow(1 - t, 3);
export const cubicIn = (t) => t * t * t;
export const cubicInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const quintOut = (t) => 1 - Math.pow(1 - t, 5);
export const sineInOut = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
export const backOut = (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
// p in [0,1] -> 0..1..0 bump
export const bump = (p) => Math.sin(Math.PI * clamp(p));
// attack/decay envelope around time c: rises over a, decays over d
export const env = (t, c, a, d) => (t < c - a || t > c + d ? 0 : t < c ? smooth(inv(c - a, c, t)) : 1 - cubicOut(inv(c, c + d, t)));

export function rng(seed) {                // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(i, seed) { let h = (i * 374761393 + seed * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// smooth 1-D value noise in [-1,1]
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = smooth(f);
  return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1;
}
// handheld drift: sum of octaves
export function drift(t, seed, amp = 1, freq = .35) {
  return (noise1(t * freq, seed) * .65 + noise1(t * freq * 2.3, seed + 7) * .35) * amp;
}
export function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join('');
}
export const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

// World position at (x right, y up, z forward when negative) in the frame of camera pose c = {pos, look}.
export function ahead(c, x, y, z) {
  const f = c.look.map((v, i) => v - c.pos[i]), fl = Math.hypot(...f); f.forEach((v, i) => (f[i] = v / fl));
  const r = [-f[2], 0, f[0]], rl = Math.hypot(...r); r.forEach((v, i) => (r[i] = v / rl));
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return [0, 1, 2].map((i) => c.pos[i] + r[i] * x + u[i] * y - f[i] * z);
}
