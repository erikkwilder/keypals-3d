// Where the keyboard goes when what it was on goes away. Pressing a button that changes the screen or the step
// (New player's "That's my buddy!", the grown-up check, "Make the class", "Add 3 students") takes that button off
// the page or turns it off, and the browser puts focus on the page itself: a keyboard player had to Tab from the
// top again, and a screen reader didn't say that anything had changed. Now focus goes to the heading of what came
// on screen (the new screen's title, the step's question), or to the heading just above the change. Only when
// focus was lost: a screen that puts it somewhere itself (the name box, the class-code box) keeps it there, and
// nothing is moved on a screen the keys play (a typing lesson, a math trip, a Learn episode, the games).

/** the screen on now is played with the keys: nothing is moved there, so every key does what it did */
export type Plays = () => boolean;
let plays: Plays = () => false;

const HEADINGS = 'h1, h2, h3';
/** how long a screen has to put focus somewhere itself first (Svelte's autofocus; the grown-up check's number box,
 *  50 ms after the hold) */
export const WAIT = 120;
/** after this long, lost focus stays lost (a screen that comes very late doesn't pull focus to it) */
export const GIVE_UP = 10_000;

/** Nothing has the keyboard: focus is on the page itself. */
export function lost(doc: Pick<Document, 'activeElement' | 'body' | 'documentElement'>): boolean {
  const a = doc.activeElement;
  return !a || a === doc.body || a === doc.documentElement;
}

const up = (el: Element | null, f: (e: Element) => boolean) => { for (let e = el; e; e = e.parentElement) if (f(e)) return true; return false; };

/** What had the keyboard can't have it now: off the page, turned off, behind a dialog, or not shown. */
export function gone(el: Element | null): boolean {
  if (!el) return false;
  if (!el.isConnected || (el as HTMLButtonElement).disabled === true) return true;
  return up(el, e => e.hasAttribute('inert')) || el.getClientRects().length === 0;
}

const shown = (h: Element) => h.getClientRects().length > 0 && !up(h, e => e.hasAttribute('inert') || e.getAttribute('aria-hidden') === 'true');
const headingsIn = (el: Element): Element[] => [...(el.matches(HEADINGS) ? [el] : []), ...el.querySelectorAll(HEADINGS)].filter(shown);
/** the first of the highest kind (an h1 before any h2) */
const best = (hs: Element[]) => (hs.reduce<Element | null>((b, h) => (!b || h.tagName < b.tagName ? h : b), null) as HTMLElement | null);

/** Where focus lands after a change took it away. `added`: what the change put on the page; `at`: where it
 *  happened (the first thing added, or the element that changed).
 *  1. the heading of what came: the first of the highest kind (a new screen's title, a step's question);
 *  2. a change that only took something away (a dialog closing): the heading in what's left there;
 *  3. else the heading just above the change ("Add students", over the button that turned off). */
export function landingSpot(added: Element[], at: Element | null, root: Element): HTMLElement | null {
  const own = added.flatMap(headingsIn);
  if (own.length) return best(own);
  if (!at) return null;
  if (!added.length) { const inside = headingsIn(at); if (inside.length) return best(inside); }
  const above = [...root.querySelectorAll(HEADINGS)].filter(h => shown(h) && (h.compareDocumentPosition(at) & 4) !== 0); // 4: at comes after h
  return (above[above.length - 1] as HTMLElement | undefined) ?? null;
}

/** Focus `h` for now: it takes focus only while it has it, and shows the ring only when the keyboard brought it
 *  (app.css, [data-landed]); a tap or a click never leaves a ring on a heading. */
function put(h: HTMLElement, key: boolean) {
  const mine = !h.hasAttribute('tabindex');
  if (mine) h.setAttribute('tabindex', '-1');
  h.setAttribute('data-landed', key ? 'key' : 'tap');
  h.addEventListener('blur', () => { h.removeAttribute('data-landed'); if (mine) h.removeAttribute('tabindex'); }, { once: true });
  h.focus({ preventScroll: true });
}

/** Keeps the keyboard somewhere useful as things change inside `root` (the game's <main>). Returns the stop. */
export function keepFocus(root: HTMLElement, playsNow: Plays): () => void {
  plays = playsNow;
  const doc = root.ownerDocument;
  let last: Element | null = lost(doc) ? null : doc.activeElement; // what had the keyboard last
  let keyed = false; // the last thing pressed was a key (not a tap or a click)
  let added: Element[] = [], at: Element | null = null, since = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { added = []; at = null; since = 0; if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const waiting = () => lost(doc) && gone(last) && !plays();
  const land = () => {
    timer = undefined;
    if (!waiting()) return clear();
    const live = added.filter(a => a.isConnected);
    const h = landingSpot(live, live[0] ?? (at?.isConnected ? at : null), root);
    if (h) put(h, keyed); // (nothing yet, a screen still loading: the next change tries again)
  };
  const mo = new MutationObserver(records => {
    if (!waiting()) return clear();
    const now = Date.now();
    if (!since) since = now;
    else if (now - since > GIVE_UP) return;
    for (const r of records) {
      if (!at && r.target.nodeType === 1) at = r.target as Element;
      for (const n of r.addedNodes) if (n.nodeType === 1) added.push(n as Element);
    }
    timer ??= setTimeout(land, WAIT);
  });
  const onFocus = (e: Event) => { last = e.target as Element; clear(); };
  const onKey = () => { keyed = true; };
  const onPointer = () => { keyed = false; };
  doc.addEventListener('focusin', onFocus, true);
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('pointerdown', onPointer, true);
  mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'inert'] });
  return () => {
    mo.disconnect();
    doc.removeEventListener('focusin', onFocus, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('pointerdown', onPointer, true);
    clear();
    plays = () => false;
  };
}

/** Everything but `node` and what holds it made inert (each of its ancestors' other children, up to <body>).
 *  Returns what it marked, to be let go. */
export function inertOthers(node: Element): Element[] {
  const marked: Element[] = [];
  for (let el: Element = node; el.parentElement; el = el.parentElement) {
    for (const s of el.parentElement.children) if (s !== el && !s.hasAttribute('inert')) { s.setAttribute('inert', ''); marked.push(s); }
    if (el.parentElement.tagName === 'BODY') break;
  }
  return marked;
}

/** the elements that hold `n`, nearest first */
const chainOf = (n: Element) => { const c: Element[] = []; for (let e = n.parentElement; e; e = e.parentElement) c.push(e); return c; };

/** `use:holdFocus` on a dialog over the screen (the login cards, the menu, the music, the settings sheet): while
 *  it's open everything behind it is inert, so Tab can't wander into the page behind and a screen reader stays
 *  in it; the keyboard goes into it; and when it closes the keyboard goes back to the button that opened it
 *  ("Print login cards"). Not on a screen the keys play: there that button would take the next Space or Enter. */
export function holdFocus(node: HTMLElement) {
  const doc = node.ownerDocument;
  const a = doc.activeElement;
  const opener = a && !lost(doc) && !node.contains(a) ? (a as HTMLElement) : null;
  const box = (node.matches('[role="dialog"]') ? node : node.querySelector<HTMLElement>('[role="dialog"]')) ?? node;
  if (!box.hasAttribute('tabindex')) box.setAttribute('tabindex', '-1');
  box.setAttribute('data-holds', ''); // (no ring round the whole dialog: app.css)
  let marked: Element[] = [], open = true;
  const hold = () => {
    for (const el of marked) el.removeAttribute('inert');
    marked = inertOthers(node);
    if (!node.contains(doc.activeElement)) box.focus({ preventScroll: true });
  };
  hold();
  // A card opened from a button on a results screen (the treasure, the egg, the shells: ui/RewardTap.svelte) is
  // moved to the end of the page (ui/portal.ts) just after this runs, and the move takes focus off it: once it's
  // where it stays, hold again from there.
  const was = chainOf(node);
  queueMicrotask(() => { const now = chainOf(node); if (open && node.isConnected && (now.length !== was.length || now.some((e, i) => e !== was[i]))) hold(); });
  return {
    destroy() {
      open = false;
      for (const el of marked) el.removeAttribute('inert');
      const back = () => { if (opener && lost(doc) && !gone(opener) && !plays()) opener.focus({ preventScroll: true }); };
      // (the dialog may still be on the page, with focus in it: back once it's gone)
      if (node.contains(doc.activeElement)) queueMicrotask(back);
      else back();
    },
  };
}
