// Time-of-day grades. Colours are sRGB hex; the world converts them to linear.
// sunAz/sunEl in degrees (az 0 = +z toward camera default, 90 = +x).
import { lerp, mixHex } from './lib.js';

export const PALETTES = {
  morning: { skyTop: '#4a82d4', horizon: '#d3e3f3', below: '#e3ebf4', sun: '#fff1da', sunAz: 70, sunEl: 14, sunSize: .0016, glow: 1,
    cloudLit: '#ffffff', cloudShadow: '#9db2d6', fog: '#d8e5f2', fogDensity: .00007, seaLit: '#f8fbff', seaShadow: '#94abd2',
    scrim: '#0d2252', exposure: 1.0, stars: 0, space: 0, silver: .6 , sat: 1.06, contrast: 1.06 },
  midday: { skyTop: '#1f5fcc', horizon: '#b9d5f3', below: '#dde8f5', sun: '#ffffff', sunAz: 60, sunEl: 48, sunSize: .0012, glow: .7,
    cloudLit: '#ffffff', cloudShadow: '#a6b9d9', fog: '#cfe0f4', fogDensity: .000065, seaLit: '#ffffff', seaShadow: '#aec0dd',
    scrim: '#0a2156', exposure: 1.0, stars: 0, space: 0, silver: .3 , sat: 1.05, contrast: 1.06 },
  dream: { skyTop: '#7a93e8', horizon: '#f9dfe8', below: '#f4e3ee', sun: '#fff3f6', sunAz: 80, sunEl: 20, sunSize: .0016, glow: 1,
    cloudLit: '#fff8fb', cloudShadow: '#b6aedc', fog: '#f1dfea', fogDensity: .00006, seaLit: '#fff6fa', seaShadow: '#c9b8dc',
    scrim: '#33215a', exposure: 1.02, stars: 0, space: 0, silver: .6 , sat: 1.06, contrast: 1.07 },
  golden: { skyTop: '#3d64b4', horizon: '#ffcf96', below: '#f8d0a8', sun: '#ffb35e', sunAz: 192, sunEl: 4, sunSize: .0026, glow: 2.0,
    cloudLit: '#ffe6c2', cloudShadow: '#b8949c', fog: '#f8cb9e', fogDensity: .00007, seaLit: '#ffe9cc', seaShadow: '#b496a2',
    scrim: '#4a2412', exposure: 1.0, stars: 0, space: 0, silver: 1.2 , sat: 1.18, contrast: 1.14 },
  space: { skyTop: '#01030a', horizon: '#060b1e', below: '#000000', sun: '#ffffff', sunAz: 110, sunEl: 8, sunSize: .0014, glow: .5,
    cloudLit: '#ffffff', cloudShadow: '#8091b8', fog: '#0a1430', fogDensity: .00002, seaLit: '#ffffff', seaShadow: '#8a9ac0',
    scrim: '#000000', exposure: 1.0, stars: 1, space: 1, silver: 0 , sat: 1.05, contrast: 1.05 },
};

// night grades for star stories
Object.assign(PALETTES, {
  night: { skyTop: '#02040e', horizon: '#18265a', below: '#0c1434', sun: '#c9d6ff', sunAz: 158, sunEl: 26, sunSize: .0007, glow: .25,
    cloudLit: '#8494c8', cloudShadow: '#1c2756', fog: '#141f48', fogDensity: .00006, seaLit: '#5d6fa8', seaShadow: '#162050',
    scrim: '#000000', exposure: 1.0, stars: 1, space: 0, silver: .5, sat: 1.08, contrast: 1.08 },
  empty: { skyTop: '#010205', horizon: '#0a1028', below: '#060a1a', sun: '#8090c0', sunAz: 200, sunEl: 22, sunSize: .0001, glow: 0,
    cloudLit: '#3c4672', cloudShadow: '#0e1430', fog: '#0a1028', fogDensity: .00007, seaLit: '#2c3762', seaShadow: '#0b1128',
    scrim: '#000000', exposure: 1.0, stars: 0, space: 0, silver: 0, sat: 1.0, contrast: 1.1 },
  void: { skyTop: '#000000', horizon: '#02030a', below: '#000000', sun: '#ffffff', sunAz: 110, sunEl: 8, sunSize: .0001, glow: 0,
    cloudLit: '#ffffff', cloudShadow: '#8091b8', fog: '#02030a', fogDensity: .00002, seaLit: '#ffffff', seaShadow: '#8a9ac0',
    scrim: '#000000', exposure: 1.0, stars: 1, space: 1, silver: 0, sat: 1.05, contrast: 1.05 },
  sunbeat: { skyTop: '#3e66b8', horizon: '#ffd29a', below: '#f8d0a8', sun: '#ffbc6a', sunAz: 192, sunEl: 7, sunSize: .006, glow: 2.4,
    cloudLit: '#ffe8c6', cloudShadow: '#b8949c', fog: '#f8cb9e', fogDensity: .00007, seaLit: '#ffe9cc', seaShadow: '#b496a2',
    scrim: '#4a2412', exposure: 1.0, stars: 0, space: 0, silver: 1.3, sat: 1.15, contrast: 1.12 },
});

PALETTES.earth = { ...PALETTES.void, sunAz: -55, sunEl: 18 };

export function blendPalette(a, b, t) {
  const A = typeof a === 'string' ? PALETTES[a] : a, B = typeof b === 'string' ? PALETTES[b] : b;
  if (t <= 0) return A; if (t >= 1) return B;
  const out = {};
  for (const k in A) out[k] = typeof A[k] === 'string' ? mixHex(A[k], B[k], t) : lerp(A[k], B[k], t);
  return out;
}
