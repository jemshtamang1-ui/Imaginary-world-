// Frosted-glass UI "characters": prompt bar, progress pill, comment cards.
// Call begin() each frame, then the components the active shot needs, then end().
import { clamp, expoOut, cubicIn, inv, lerp } from './lib.js';

const SEND = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;

// shared entrance/exit: rise in from below with a soft scale, sink + fade out
function pose(el, { x, y, anchor = 'center', inP = 1, outP = 0, scale = 1, extra = '' }) {
  const e = expoOut(clamp(inP)), o = cubicIn(clamp(outP));
  const ty = (1 - e) * 70 + o * 40, s = scale * (.94 + .06 * e) * (1 - o * .04);
  const ax = anchor === 'center' ? '-50%' : anchor === 'right' ? '-100%' : '0';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.transform = `translate(${ax}, -50%) translateY(${ty}px) scale(${s}) ${extra}`;
  el.style.opacity = String(clamp(e * 1.4) * (1 - o));
  el.style.filter = o > 0 ? `blur(${o * 10}px)` : (e < 1 ? `blur(${(1 - e) * 8}px)` : 'none');
}

export class Glass {
  constructor(root) { this.root = root; this.els = {}; this.used = new Set(); }
  #el(key, cls, html) {
    let el = this.els[key];
    if (!el) { el = document.createElement('div'); el.className = 'glass ' + cls; el.innerHTML = html; this.root.appendChild(el); this.els[key] = el; }
    this.used.add(key); el.style.display = '';
    return el;
  }
  begin() { this.used.clear(); }
  end() { for (const k in this.els) if (!this.used.has(k)) this.els[k].style.display = 'none'; }

  // typed: 0..1 fraction of `text` revealed; press: 0..1 bump on the send button
  prompt({ key = 'prompt', x, y, w = 1100, inP = 1, outP = 0, text = '', typed = 1, placeholder = 'Describe anything…', press = 0, caret = true, t = 0 }) {
    const el = this.#el(key, 'prompt', `<div class="txt"></div><div class="send">${SEND}</div>`);
    el.style.width = w + 'px';
    const n = Math.round(text.length * clamp(typed));
    const shown = text.slice(0, n);
    const blink = typed >= 1 ? (Math.floor(t * 2.2) % 2 === 0) : true;
    el.firstChild.innerHTML = (n ? escape(shown) : `<span class="ph">${escape(placeholder)}</span>`) + (caret && blink ? '<span class="caret"></span>' : '');
    const btn = el.lastChild;
    btn.style.transform = `scale(${1 - .14 * press})`;
    btn.style.background = press > .01 ? 'var(--accent)' : (n === text.length && n > 0 ? '#10162a' : 'rgba(16,22,42,.35)');
    pose(el, { x, y, inP, outP });
  }
  // progress 0..1, label left of bar
  pill({ key = 'pill', x, y, inP = 1, outP = 0, label = 'Rendering', progress = 0, anchor = 'center' }) {
    const el = this.#el(key, 'pill', `<span class="dot"></span><span class="lbl"></span><span class="bar"><i></i></span><span class="pct"></span>`);
    el.querySelector('.lbl').textContent = label;
    el.querySelector('.bar i').style.width = (clamp(progress) * 100).toFixed(2) + '%';
    el.querySelector('.pct').textContent = Math.round(clamp(progress) * 100) + '%';
    pose(el, { x, y, inP, outP, anchor });
  }
  card({ key = 'card', x, y, inP = 1, outP = 0, name = 'Mira', handle = '@mira.makes', text = '', likes = '', avatar = ['#FFB38A', '#FF6A40'], anchor = 'center', tilt = 0 }) {
    const el = this.#el(key, 'card', `<div class="who"><div class="av"></div><span class="nm"></span><span class="handle"></span></div><div class="body"></div><div class="likes"></div>`);
    el.querySelector('.av').style.background = `linear-gradient(135deg, ${avatar[0]}, ${avatar[1]})`;
    el.querySelector('.nm').textContent = name; el.querySelector('.handle').textContent = handle;
    el.querySelector('.body').textContent = text;
    el.querySelector('.likes').innerHTML = likes ? `<b>♥</b> ${escape(likes)}` : '';
    pose(el, { x, y, inP, outP, anchor, extra: `rotate(${tilt}deg)` });
  }
}
const escape = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
