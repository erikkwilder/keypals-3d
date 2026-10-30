// The answer a child just typed stays on screen for a moment after the last key. The game checks it the
// moment the last digit goes in and moves straight on (the question box goes away), so without this the
// last digit is never seen. A copy of the answer line, with every digit in it, sits exactly where it was,
// tinted green when it's right and red when it isn't, then fades; if the next question comes sooner, it
// fades as that one comes in. The pace of the game doesn't change.

type Held = { el: HTMLElement; anim: Animation; wait: number };
const held = new Set<Held>();

const TINT = {
  ok: { background: '#e3fbe9', boxShadow: 'inset 0 0 0 4px #3fbf73, 0 0 0 6px #d4f5de', color: '#127a3a' },
  bad: { background: '#ffe9ec', boxShadow: 'inset 0 0 0 4px #f05a6e, 0 0 0 6px #ffdce1', color: '#b02a48' },
};

/** Hold a copy of `el` (the line with the answer box) where it is. `text`: what goes in its `.box` (the
 *  digits typed, last one included); a typed word shows every letter done. `ms`: how long it stays. */
export function holdAnswer(el: HTMLElement | null | undefined, o: { text?: string; ok: boolean; ms?: number }) {
  if (!el?.isConnected || typeof document === 'undefined') return;
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const copy = el.cloneNode(true) as HTMLElement;
  copy.classList.remove('shake');
  copy.removeAttribute('id');
  const box = copy.querySelector<HTMLElement>('.box');
  if (box && o.text !== undefined) box.textContent = o.text;
  copy.querySelectorAll('span.next').forEach(s => { s.classList.remove('next'); s.classList.add('done'); });
  Object.assign(copy.style, {
    // (it may be a digit wider than the line was: never wrap, grow instead)
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: 'max-content', minWidth: `${r.width}px`, height: `${r.height}px`, margin: '0', whiteSpace: 'nowrap', flexWrap: 'nowrap',
    zIndex: '12', pointerEvents: 'none', fontSize: getComputedStyle(el).fontSize, boxSizing: 'border-box', justifyContent: getComputedStyle(el).justifyContent,
    // on a white card of its own, so it reads over the arena once its panel has gone
    background: 'rgba(255, 255, 255, .94)', borderRadius: '22px', boxShadow: '0 0 0 10px rgba(255, 255, 255, .94), 0 14px 30px -12px rgba(30, 20, 70, .5)',
  });
  const t = o.ok ? TINT.ok : TINT.bad;
  if (box) Object.assign(box.style, t);
  else copy.querySelectorAll<HTMLElement>('span').forEach(s => { s.style.color = t.color; });
  document.body.appendChild(copy);
  const wait = o.ms ?? 600;
  const anim = copy.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px) scale(.96)' }], { duration: 260, delay: wait, fill: 'forwards', easing: 'ease-in' });
  const h = { el: copy, anim, wait };
  held.add(h);
  anim.onfinish = () => { copy.remove(); held.delete(h); };
}

/** The next question has come in: anything still held fades now (quickly), out of its way. */
export function letGo() {
  for (const h of held) {
    const t = h.anim.currentTime === null ? 0 : Number(h.anim.currentTime);
    // still in its pause: start the fade now, a little quicker
    if (t < h.wait) { h.anim.cancel(); const a = h.el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-12px) scale(.96)' }], { duration: 200, fill: 'forwards', easing: 'ease-in' }); h.anim = a; a.onfinish = () => { h.el.remove(); held.delete(h); }; }
  }
}

/** Leaving the screen: everything held goes at once. */
export function dropHeld() { for (const h of held) { h.anim.cancel(); h.el.remove(); } held.clear(); }
