// Kinetic type. Each group is { out, x, y, align, anchor, scrim, lines } in stage fractions.
// Line markup (space-separated tokens):
//   *word*   italic serif (Instrument Serif)     =word=  roman serif
//   #word#   heavy grotesk (Inter Tight 800)     plain   Inter
//   +word    accent colour (once per beat)       ^word   punch: scales in from 1.35x
//   word@1.23  explicit time (only when there is no words.json)
// Lines may be objects { text, size } to override the font size of every word in the line.
// Word times come from words.json: each displayed word is matched, in order, to the next spoken word.
import { clamp, inv, expoOut, cubicIn, rgba } from './lib.js';

const norm = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '').replace(/'/g, '');
export const IN_DUR = .55, LEAD = .05, OUT_DUR = .45;

export function parseToken(tok) {
  const o = { style: 'sans', accent: false, punch: false, t: null };
  let s = tok;
  for (;;) { if (s[0] === '+') { o.accent = true; s = s.slice(1); } else if (s[0] === '^') { o.punch = true; s = s.slice(1); } else break; }
  const at = s.match(/@(\d+(\.\d+)?)$/); if (at) { o.t = parseFloat(at[1]); s = s.slice(0, at.index); }
  const wrap = { '*': 'serif', '#': 'heavy', '=': 'roman' };
  if (wrap[s[0]] && s.endsWith(s[0]) && s.length > 2) { o.style = wrap[s[0]]; s = s.slice(1, -1); }
  o.text = s;
  return o;
}

export function bindTimes(groups, words) {
  let cur = 0;
  for (const g of groups) for (const line of g.lines) for (const w of line.words) {
    if (w.t != null) continue;
    if (!words) throw new Error(`no words.json and no @time for "${w.text}"`);
    const target = norm(w.text);
    let found = -1;
    for (let k = cur; k < Math.min(words.length, cur + 12); k++) if (norm(words[k].w) === target) { found = k; break; }
    if (found < 0) throw new Error(`text word "${w.text}" not found near spoken "${words.slice(cur, cur + 6).map((x) => x.w).join(' ')}"`);
    w.t = words[found].t0; cur = found + 1;
  }
}

export class TextLayer {
  constructor(root, specs, words) {
    this.root = root;
    this.groups = specs.map((s) => ({ ...s, lines: s.lines.map((l) => {
      const L = typeof l === 'string' ? { text: l } : l;
      return { ...L, words: L.text.split(/\s+/).filter(Boolean).map(parseToken) };
    }) }));
    bindTimes(this.groups, words);
    for (const g of this.groups) {
      g.first = Math.min(...g.lines.flatMap((l) => l.words.map((w) => w.t)));
      g.last = Math.max(...g.lines.flatMap((l) => l.words.map((w) => w.t)));
      if (g.out == null) g.out = g.last + 1.6;
      g.scrimEl = document.createElement('div'); g.scrimEl.className = 'scrim'; root.appendChild(g.scrimEl);
      g.el = document.createElement('div'); g.el.className = 'tgroup ' + (g.align || 'left'); root.appendChild(g.el);
      for (const l of g.lines) {
        const le = document.createElement('div'); le.className = 'tline'; g.el.appendChild(le);
        if (l.gap != null) le.style.gap = l.gap;
        for (const w of l.words) {
          const span = document.createElement('span');
          span.className = `word ${w.style}${w.accent ? ' accent' : ''}${g.dark ? ' dark' : ''}`;
          span.textContent = w.text;
          if (l.size) span.style.fontSize = l.size + 'px';
          le.appendChild(span); w.el = span;
        }
      }
    }
  }
  layout(W, H) {               // call once fonts are loaded
    this.W = W; this.H = H;
    for (const g of this.groups) {
      g.el.style.left = g.x * W + 'px'; g.el.style.top = g.y * H + 'px';
      g.w = g.el.offsetWidth; g.h = g.el.offsetHeight;
    }
  }
  // cues for the sound designer: punch words get impacts
  punches() { return this.groups.flatMap((g) => g.lines.flatMap((l) => l.words.filter((w) => w.punch).map((w) => ({ t: w.t, text: w.text })))); }

  update(t, pal, fx) {
    const shadow = rgba(pal.scrim, .42);
    for (const g of this.groups) {
      const live = t >= g.first - LEAD - .02 && t < g.out + OUT_DUR;
      g.el.style.display = live ? '' : 'none'; g.scrimEl.style.display = live ? '' : 'none';
      if (!live) continue;
      const q = cubicIn(inv(g.out, g.out + OUT_DUR, t));
      const ax = g.align === 'center' ? -50 : g.align === 'right' ? -100 : 0;
      const ay = g.anchor === 'middle' ? -50 : g.anchor === 'bottom' ? -100 : 0;
      g.el.style.transform = `translate(${ax}%, ${ay}%) translateY(${-q * 46}px)`;
      g.el.style.filter = q > 0 ? `blur(${q * 16}px)` : 'none';
      g.el.style.opacity = String(1 - q);
      g.el.style.setProperty('--shadow', shadow);
      // feathered scrim behind the group keeps white type legible over bright cloud
      const sIn = expoOut(inv(g.first - LEAD, g.first + .5, t));
      const sw = g.w * 1.25 + 260, sh = g.h * 1.25 + 200;
      const left = g.x * this.W + (ax / 100) * g.w + g.w / 2 - sw / 2;
      const top = g.y * this.H + (ay / 100) * g.h + g.h / 2 - sh / 2 - q * 46;
      Object.assign(g.scrimEl.style, { left: left + 'px', top: top + 'px', width: sw + 'px', height: sh + 'px',
        background: `radial-gradient(closest-side, ${rgba(pal.scrim, .30 * (g.scrim ?? 1))}, ${rgba(pal.scrim, .12 * (g.scrim ?? 1))} 55%, transparent)`,
        opacity: String(sIn * (1 - q)) });
      for (const l of g.lines) for (const w of l.words) {
        const p = inv(w.t - LEAD, w.t - LEAD + IN_DUR, t), e = expoOut(p);
        const s = w.punch ? 1.35 - .35 * e : 1;
        w.el.style.opacity = String(Math.min(1, e * 1.15));
        w.el.style.transform = `translateY(${(1 - e) * 26}px) scale(${s})`;
        w.el.style.filter = e < .999 ? `blur(${(1 - e) * 16}px)` : 'none';
      }
    }
  }
}
