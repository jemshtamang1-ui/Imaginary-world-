// Global transition effects. Each effect is { t, type, dur, ...opts } in the director's `fx` list.
// evalFx(t, list) folds every active effect into one state object that main.js applies to
// post (whip/zoom blur), the #frame wrapper (shake, punch zoom, CRT) and the overlay layers.
import { clamp, inv, expoOut, expoIn, cubicOut, cubicIn, smooth, bump, drift, env } from './lib.js';

export function evalFx(t, list) {
  const s = { flash: 0, flashColor: '#ffffff', whipX: 0, whipY: 0, zoom: 0, scale: 1, tx: 0, ty: 0, rot: 0,
    crtX: 1, crtY: 1, crtGlow: 0, dark: 0, typeBlurX: 0, wipes: [], bloomBoost: 0 };
  for (const e of list) {
    const d = e.dur ?? .4;
    if (t < e.t - d - 1 || t > e.t + d + 2) continue;
    switch (e.type) {
      case 'flash': {           // burst centred on the cut: fast attack, slower decay
        const a = env(t, e.t, e.attack ?? .06, d);
        if (a > s.flash) { s.flash = a * (e.amount ?? 1); s.flashColor = e.color ?? '#ffffff'; }
        break;
      }
      case 'whip': {            // directional blur + slide, peaks at the cut
        const a = env(t, e.t, d * .5, d * .5), dir = e.dir ?? 1;
        s.whipX += dir * a * (e.amount ?? 260); s.typeBlurX += a * 40; break;
      }
      case 'rush': {            // zoom blur rush into the cut
        const a = env(t, e.t, d * .7, d * .3);
        s.zoom += a * (e.amount ?? .12); s.scale *= 1 + a * .06; s.bloomBoost += a * .4; break;
      }
      case 'shake': {           // impact shake, decays over dur
        const p = inv(e.t, e.t + d, t); if (p <= 0 || p >= 1) break;
        const a = (1 - cubicOut(p)) * (e.amount ?? 14);
        s.tx += drift(t, 11, a, 22); s.ty += drift(t, 23, a, 25); s.rot += drift(t, 31, a * .0012, 18);
        s.scale *= 1 + a * .0035; break;            // overscan so frame edges never show
      }
      case 'punch': {           // quick zoom-in punch that settles
        const p = inv(e.t, e.t + d, t); if (p <= 0 || p >= 1) break;
        s.scale *= 1 + (e.amount ?? .05) * (1 - expoOut(p)); break;
      }
      case 'crt': {             // collapse to a line, then a dot, then darkness
        const p = inv(e.t, e.t + d, t);
        if (t >= e.t + d) { if (t < e.t + d + (e.hold ?? .08)) { s.crtY = 0; s.crtX = 0; s.dark = 1; } break; }   // follow with a 'dark' effect to hold longer
        if (p <= 0) break;
        const a = clamp(p / .55), b = clamp((p - .55) / .45);
        s.crtY = Math.max(.004, 1 - expoIn(a) * .996); s.crtX = 1 - cubicIn(b); s.crtGlow = Math.max(s.crtGlow, a); break;
      }
      case 'dark': {            // hold black (e.g. after CRT) until e.t + dur, then fade up over e.fade
        const f = e.fade ?? .3;
        if (t >= e.t && t < e.t + d) s.dark = Math.max(s.dark, 1);
        else if (t >= e.t + d && t < e.t + d + f) s.dark = Math.max(s.dark, 1 - smooth(inv(e.t + d, e.t + d + f, t)));
        break;
      }
      case 'fadeout': {         // fade to black (or e.color) over dur and hold
        if (t >= (e.until ?? Infinity)) break;   // release at e.until (e.g. the next shot's start)
        const a = smooth(inv(e.t, e.t + d, t)); if (a > s.dark) s.dark = a; break;
      }
      case 'wipe': {            // foreground cloud bank sweeping across, fully covering at e.t
        const p = inv(e.t - d, e.t + d, t);
        if (p > 0 && p < 1) s.wipes.push({ p, dir: e.dir ?? 1, img: e.img ?? 0 }); break;
      }
    }
  }
  return s;
}
