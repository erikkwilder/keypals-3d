// Hover labels for picture buttons: put `use:tips` on a bar of buttons and each button's title shows as
// a little label under it while the mouse is over it (straight away, not the browser's slow one). On a
// touch screen a long press shows it instead, and that press doesn't also tap the button. Every button
// keeps an accessible name: its title becomes its aria-label if it has none.

let bubble: HTMLDivElement | null = null;
let hideT = 0;

function el() {
  if (bubble) return bubble;
  bubble = document.createElement('div');
  bubble.className = 'kp-tip';
  bubble.setAttribute('role', 'tooltip');
  Object.assign(bubble.style, {
    position: 'fixed', zIndex: '200', pointerEvents: 'none', maxWidth: '240px', padding: '6px 12px', borderRadius: '12px',
    background: '#2a1b3d', color: '#fff', font: '600 14px/1.25 var(--font-ui, sans-serif)', textAlign: 'center',
    boxShadow: '0 8px 20px -8px rgba(30, 10, 60, .6)', opacity: '0', transition: 'opacity .12s', whiteSpace: 'normal',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(bubble);
  return bubble;
}

function show(target: HTMLElement, text: string) {
  clearTimeout(hideT);
  const b = el();
  b.textContent = text;
  const r = target.getBoundingClientRect();
  b.style.opacity = '1';
  // under the button, or above it near the bottom of the screen; kept on the screen
  const w = b.offsetWidth, h = b.offsetHeight;
  const x = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2));
  const y = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
  b.style.left = `${x}px`; b.style.top = `${y}px`;
}
export function hideTip(ms = 0) {
  clearTimeout(hideT);
  hideT = window.setTimeout(() => { if (bubble) bubble.style.opacity = '0'; }, ms);
}

/** the label for a button: its title (kept aside while the label shows, so the browser's own doesn't too) */
function textOf(b: HTMLElement) {
  if (b.title) { b.dataset.tip = b.title; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', b.title); b.removeAttribute('title'); }
  return b.dataset.tip ?? '';
}

export function tips(node: HTMLElement) {
  let press = 0, pressed: HTMLElement | null = null, swallow = false;
  const target = (e: Event) => (e.target as HTMLElement | null)?.closest?.('button, a, [data-tip], [title]') as HTMLElement | null;
  // every button gets its accessible name now (a screen reader needs it before any hover)
  const name = () => node.querySelectorAll<HTMLElement>('[title]').forEach(textOf);
  name();
  const mo = new MutationObserver(name);
  mo.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

  function over(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const t = target(e);
    if (!t || !node.contains(t)) return;
    const text = textOf(t);
    if (text) show(t, text);
  }
  function out(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    const t = target(e), to = (e.relatedTarget as HTMLElement | null)?.closest?.('button, a, [data-tip], [title]');
    if (t && to === t) return;
    hideTip();
  }
  function down(e: PointerEvent) {
    if (e.pointerType !== 'touch') { hideTip(); return; }
    const t = target(e);
    if (!t) return;
    pressed = t; swallow = false;
    clearTimeout(press);
    press = window.setTimeout(() => { const text = textOf(t); if (text) { show(t, text); swallow = true; } }, 450);
  }
  function up() { clearTimeout(press); if (swallow) hideTip(1400); }
  // a long press only shows the label: the tap that ends it doesn't press the button
  function click(e: MouseEvent) { if (swallow && pressed && pressed.contains(e.target as Node)) { e.preventDefault(); e.stopImmediatePropagation(); } swallow = false; pressed = null; }
  function focus(e: FocusEvent) { const t = target(e); if (t && (t as HTMLElement).matches(':focus-visible')) { const text = textOf(t); if (text) show(t, text); } }
  const blur = () => hideTip();
  const menu = (e: Event) => { if (pressed) e.preventDefault(); };

  node.addEventListener('pointerover', over);
  node.addEventListener('pointerout', out);
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  node.addEventListener('click', click, true);
  node.addEventListener('focusin', focus);
  node.addEventListener('focusout', blur);
  node.addEventListener('contextmenu', menu);
  return {
    destroy() {
      mo.disconnect(); clearTimeout(press); hideTip();
      node.removeEventListener('pointerover', over);
      node.removeEventListener('pointerout', out);
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.removeEventListener('click', click, true);
      node.removeEventListener('focusin', focus);
      node.removeEventListener('focusout', blur);
      node.removeEventListener('contextmenu', menu);
    },
  };
}
