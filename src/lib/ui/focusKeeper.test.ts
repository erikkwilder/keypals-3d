// Where the keyboard goes when the button it was on goes away with its screen or its step, and dialogs that keep
// the keyboard while they're open and give it back when they close (ui/focusKeeper.ts).
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GIVE_UP, WAIT, gone, holdFocus, keepFocus, landingSpot, lost } from './focusKeeper';

// a small page: elements in a tree, focus, events, and display: none (rects 0)
type Listener = (e: { target: El }) => void;
class Doc {
  activeElement: El | null = null;
  documentElement: El;
  body: El;
  ons: Record<string, Listener[]> = {};
  constructor() { this.documentElement = new El('html', this); this.body = new El('body', this); this.documentElement.append(this.body); this.activeElement = this.body; }
  addEventListener(t: string, f: Listener) { (this.ons[t] ??= []).push(f); }
  removeEventListener(t: string, f: Listener) { this.ons[t] = (this.ons[t] ?? []).filter(g => g !== f); }
  emit(t: string, target: El) { for (const f of this.ons[t] ?? []) f({ target }); }
  el(tag: string, attrs: Record<string, string> = {}, ...kids: El[]) { const e = new El(tag, this); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e.append(...kids); }
}
class El {
  nodeType = 1;
  tagName: string;
  parentElement: El | null = null;
  children: El[] = [];
  attrs = new Map<string, string>();
  disabled = false;
  rects = 1;
  ons: Record<string, (() => void)[]> = {};
  constructor(tag: string, public ownerDocument: Doc) { this.tagName = tag.toUpperCase(); }
  append(...kids: El[]) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
  remove() {
    const p = this.parentElement;
    if (!p) return;
    p.children = p.children.filter(c => c !== this);
    this.parentElement = null;
    const d = this.ownerDocument;
    if (d.activeElement && this.contains(d.activeElement)) d.activeElement = d.body; // (the browser puts focus on the page)
  }
  get isConnected() { let e: El = this; while (e.parentElement) e = e.parentElement; return e === this.ownerDocument.documentElement; }
  hasAttribute(n: string) { return this.attrs.has(n); }
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  getClientRects() { for (let e: El | null = this; e; e = e.parentElement) if (!e.rects) return { length: 0 }; return { length: 1 }; }
  matches(sel: string) {
    return sel.split(',').some(one => {
      const m = one.trim().match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      return m ? (m[2] === undefined ? this.attrs.has(m[1]) : this.attrs.get(m[1]) === m[2]) : this.tagName === one.trim().toUpperCase();
    });
  }
  all(): El[] { return this.children.flatMap(c => [c, ...c.all()]); }
  querySelectorAll(sel: string) { return this.all().filter(e => e.matches(sel)); }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
  contains(o: El) { return o === this || this.all().includes(o); }
  compareDocumentPosition(o: El) { const order = this.ownerDocument.documentElement.all(); return order.indexOf(o) > order.indexOf(this) ? 4 : 2; }
  addEventListener(t: string, f: () => void) { (this.ons[t] ??= []).push(f); }
  focus() {
    const d = this.ownerDocument, was = d.activeElement;
    if (was === this) return;
    if (was) { const fs = was.ons.blur ?? []; was.ons.blur = []; for (const f of fs) f(); }
    d.activeElement = this;
    d.emit('focusin', this);
  }
}
const asEl = (e: El) => e as unknown as Element;
const asHtml = (e: El) => e as unknown as HTMLElement;

// the page's changes, handed over by hand
class MO {
  static last: MO;
  constructor(public cb: (r: { target: El; addedNodes: El[] }[]) => void) { MO.last = this; }
  off = false;
  observe() {}
  disconnect() { this.off = true; }
  static fire(target: El, addedNodes: El[] = []) { if (!MO.last.off) MO.last.cb([{ target, addedNodes }]); }
}

let d: Doc;
beforeEach(() => { d = new Doc(); vi.useFakeTimers(); vi.stubGlobal('MutationObserver', MO); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('lost and gone', () => {
  it('focus is lost when it is on the page itself', () => {
    expect(lost(d as unknown as Document)).toBe(true);
    d.activeElement = null;
    expect(lost(d as unknown as Document)).toBe(true);
    d.activeElement = d.documentElement;
    expect(lost(d as unknown as Document)).toBe(true);
    const b = d.el('button');
    d.body.append(b);
    b.focus();
    expect(lost(d as unknown as Document)).toBe(false);
  });
  it('what had it is gone when it is off the page, turned off, behind a dialog or not shown', () => {
    const b = d.el('button'), box = d.el('div', {}, b);
    d.body.append(box);
    expect(gone(null)).toBe(false);
    expect(gone(asEl(b))).toBe(false);
    b.disabled = true;
    expect(gone(asEl(b))).toBe(true);
    b.disabled = false;
    box.setAttribute('inert', '');
    expect(gone(asEl(b))).toBe(true);
    box.removeAttribute('inert');
    box.rects = 0;
    expect(gone(asEl(b))).toBe(true);
    box.rects = 1;
    box.remove();
    expect(gone(asEl(b))).toBe(true);
  });
});

describe('where focus lands', () => {
  it('a new screen: its title, before any other heading on it', () => {
    const h1 = d.el('h1'), screen = d.el('div', {}, d.el('header', {}, h1), d.el('h2'));
    const main = d.el('main', {}, screen);
    d.body.append(main);
    expect(landingSpot([asEl(screen)], asEl(screen), asEl(main))).toBe(h1);
  });
  it('Home, whose top bar has the player and no title: its first heading ("Where to?")', () => {
    const where = d.el('h2'), screen = d.el('div', {}, d.el('header', {}, d.el('button')), where, d.el('h2'));
    const main = d.el('main', {}, screen);
    d.body.append(main);
    expect(landingSpot([asEl(screen)], asEl(screen), asEl(main))).toBe(where);
  });
  it("a new step: the step's own question, not the page's title above it", () => {
    const ask = d.el('h1'), step = d.el('div', {}, ask, d.el('button'));
    const page = d.el('div', {}, d.el('header', {}, d.el('h1')), step), main = d.el('main', {}, page);
    d.body.append(main);
    expect(landingSpot([asEl(step)], asEl(step), asEl(main))).toBe(ask);
  });
  it('not a heading that is hidden, hidden from screen readers, or behind a dialog', () => {
    const a = d.el('h1'), b = d.el('h1', { 'aria-hidden': 'true' }), c = d.el('h1'), ok = d.el('h2');
    a.rects = 0;
    const screen = d.el('div', {}, a, d.el('div', {}, b), d.el('div', { inert: '' }, c), ok), main = d.el('main', {}, screen);
    d.body.append(main);
    expect(landingSpot([asEl(screen)], asEl(screen), asEl(main))).toBe(ok);
  });
  it('a screen still loading (no heading yet, nothing above it): nowhere yet', () => {
    const loading = d.el('div', { role: 'status' }), main = d.el('main', {}, loading);
    d.body.append(main);
    expect(landingSpot([asEl(loading)], asEl(loading), asEl(main))).toBeNull();
  });
  it('a button that turned off ("Add 3 students"): the heading just above it', () => {
    const add = d.el('h3'), btn = d.el('button'), wait = d.el('h3');
    const main = d.el('main', {}, d.el('header', {}, d.el('h1')), d.el('div', {}, add, d.el('div', {}, btn)), d.el('div', {}, wait));
    d.body.append(main);
    expect(landingSpot([], asEl(btn), asEl(main))).toBe(add);
  });
  it('a list that grew: the heading above what came', () => {
    const list = d.el('h3'), row = d.el('li');
    const main = d.el('main', {}, d.el('h1'), d.el('div', {}, list, d.el('ul', {}, row)));
    d.body.append(main);
    expect(landingSpot([asEl(row)], asEl(row), asEl(main))).toBe(list);
  });
  it('a dialog that closed: the heading in what is left where it was', () => {
    const name = d.el('h2'), page = d.el('div', {}, d.el('section', {}, name)), main = d.el('main', {}, d.el('header', {}, d.el('h1')), page);
    d.body.append(main);
    expect(landingSpot([], asEl(page), asEl(main))).toBe(name);
  });
});

/** a page with a step on it and its button focused (New player: "That's my buddy!") */
function page(plays = () => false) {
  const btn = d.el('button'), step = d.el('div', {}, d.el('h1'), btn);
  const screen = d.el('div', {}, d.el('header', {}, d.el('h1')), step), main = d.el('main', {}, screen);
  d.body.append(main);
  btn.focus();
  const stop = keepFocus(asHtml(main), plays);
  return { btn, step, screen, main, stop };
}
/** the next step comes in place of the old one (a click took the button away with its step) */
function nextStep(p: ReturnType<typeof page>) {
  const ask = d.el('h1'), input = d.el('input'), step = d.el('div', {}, ask, input);
  p.step.remove();
  p.screen.append(step);
  MO.fire(p.screen, [step]);
  return { ask, input, step };
}

describe('keeping the keyboard', () => {
  it("the button went away with its step: focus goes to the new step's heading, focusable only while it has focus", () => {
    const p = page();
    const { ask } = nextStep(p);
    expect(d.activeElement).toBe(d.body);
    vi.advanceTimersByTime(WAIT);
    expect(d.activeElement).toBe(ask);
    expect(ask.getAttribute('tabindex')).toBe('-1');
    expect(ask.getAttribute('data-landed')).toBe('tap'); // (no key pressed: no ring)
    const other = d.el('button');
    p.main.append(other);
    other.focus();
    expect(ask.hasAttribute('tabindex')).toBe(false);
    expect(ask.hasAttribute('data-landed')).toBe(false);
  });
  it('shows the ring when a key brought it there, not after a tap or a click', () => {
    const p = page();
    d.emit('keydown', p.btn);
    const { ask } = nextStep(p);
    vi.advanceTimersByTime(WAIT);
    expect(ask.getAttribute('data-landed')).toBe('key');
  });
  it('leaves focus alone when the screen put it somewhere itself (the name box, the class-code box)', () => {
    const p = page();
    const { input } = nextStep(p);
    input.focus();
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(input);
  });
  it('moves nothing on a screen the keys play (a typing lesson)', () => {
    const p = page(() => true);
    nextStep(p);
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(d.body);
  });
  it('moves nothing when focus was not lost (only the page changed around it)', () => {
    const p = page();
    const row = d.el('p');
    p.screen.append(row);
    MO.fire(p.screen, [row]);
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(p.btn);
  });
  it('waits for a screen that is still loading, then goes to its title', () => {
    const p = page();
    const loading = d.el('div', { role: 'status' });
    p.screen.remove();
    p.main.append(loading);
    MO.fire(p.main, [loading]);
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(d.body);
    const title = d.el('h1'), next = d.el('div', {}, d.el('header', {}, title));
    loading.remove();
    p.main.append(next);
    MO.fire(p.main, [next]);
    vi.advanceTimersByTime(WAIT);
    expect(d.activeElement).toBe(title);
  });
  it('gives up on a screen that comes very late', () => {
    const p = page();
    const loading = d.el('div');
    p.screen.remove();
    p.main.append(loading);
    MO.fire(p.main, [loading]);
    vi.advanceTimersByTime(GIVE_UP + 1);
    const next = d.el('div', {}, d.el('h1'));
    p.main.append(next);
    MO.fire(p.main, [next]);
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(d.body);
  });
  it('"Add 3 students" turned off while it adds: the heading above it', () => {
    const add = d.el('h3'), btn = d.el('button'), main = d.el('main', {}, d.el('h1'), d.el('div', {}, add, btn));
    d.body.append(main);
    btn.focus();
    keepFocus(asHtml(main), () => false);
    btn.disabled = true;
    d.activeElement = d.body; // (the browser takes focus off a button that turns off)
    MO.fire(btn);
    vi.advanceTimersByTime(WAIT);
    expect(d.activeElement).toBe(add);
  });
  it('stops when told', () => {
    const p = page();
    p.stop();
    nextStep(p);
    vi.advanceTimersByTime(WAIT * 3);
    expect(d.activeElement).toBe(d.body);
  });
});

/** the class page with "Print login cards" focused, then the login cards opened over it */
function cards(plays = () => false) {
  const open = d.el('button'), tabs = d.el('nav', {}, d.el('button')), sheet = d.el('div', { role: 'dialog', tabindex: '-1' }, d.el('button'));
  const pbg = d.el('div', {}, sheet), cls = d.el('div', {}, open, tabs), main = d.el('main', {}, d.el('div', {}, cls)), canvas = d.el('canvas');
  d.body.append(canvas, main);
  open.focus();
  keepFocus(asHtml(main), plays);
  cls.append(pbg);
  const held = holdFocus(asHtml(pbg));
  return { open, tabs, sheet, pbg, cls, canvas, held };
}

describe('dialogs', () => {
  it('while the login cards are open, the page behind them is inert and the keyboard is in them', () => {
    const c = cards();
    expect(d.activeElement).toBe(c.sheet);
    expect(c.sheet.hasAttribute('data-holds')).toBe(true);
    expect(gone(asEl(c.tabs.children[0]))).toBe(true); // Tab can't reach the class tabs
    expect(c.open.hasAttribute('inert')).toBe(true);
    expect(c.canvas.hasAttribute('inert')).toBe(true);
    expect(c.pbg.hasAttribute('inert')).toBe(false);
  });
  it('when they close, the page is back and so is focus, on "Print login cards"', () => {
    const c = cards();
    c.pbg.remove();
    c.held.destroy();
    expect(c.open.hasAttribute('inert')).toBe(false);
    expect(c.tabs.hasAttribute('inert')).toBe(false);
    expect(c.canvas.hasAttribute('inert')).toBe(false);
    expect(d.activeElement).toBe(c.open);
  });
  it('also when the dialog is still on the page as it closes (focus goes back once it is gone)', async () => {
    const c = cards();
    c.held.destroy();
    c.pbg.remove();
    await Promise.resolve();
    expect(d.activeElement).toBe(c.open);
  });
  it('not when what opened it has gone too (a card that went to another page)', () => {
    const c = cards();
    c.open.remove();
    c.pbg.remove();
    c.held.destroy();
    expect(d.activeElement).toBe(d.body);
  });
  it('not on a screen the keys play: the button would take the next Space or Enter', () => {
    const c = cards(() => true);
    c.pbg.remove();
    c.held.destroy();
    expect(d.activeElement).toBe(d.body);
  });
  it('a card moved to the end of the page as it opens (a treasure on a results screen) holds from where it ends up', async () => {
    const chip = d.el('button'), card = d.el('div', { role: 'dialog' }, d.el('button')), tm = d.el('div', {}, card), layer = d.el('div', {}, tm);
    const results = d.el('div', {}, chip, layer), main = d.el('main', {}, results);
    d.body.append(main);
    chip.focus();
    keepFocus(asHtml(main), () => false);
    const held = holdFocus(asHtml(tm));
    // (ui/portal.ts moves the layer after the card's own hold has run, and the move takes focus off it)
    layer.remove(); d.body.append(layer);
    expect(d.activeElement).toBe(d.body);
    await Promise.resolve();
    expect(d.activeElement).toBe(card);
    expect(main.hasAttribute('inert')).toBe(true);
    expect(layer.hasAttribute('inert')).toBe(false);
    expect(chip.hasAttribute('inert')).toBe(false); // (let go of where it was: the whole page behind is inert now)
    tm.remove(); held.destroy();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(d.activeElement).toBe(chip);
  });
  it('a card opened from a dialog (a prize in the bonus round) lets go only of what it made inert', () => {
    const map = d.el('div', {}, d.el('button')), prize = d.el('button'), bonus = d.el('div', { role: 'dialog' }, prize), main = d.el('main', {}, map, bonus);
    d.body.append(main);
    keepFocus(asHtml(main), () => false);
    holdFocus(asHtml(bonus));
    expect(map.hasAttribute('inert')).toBe(true);
    prize.focus();
    const card = d.el('div', { role: 'dialog' }), layer = d.el('div', {}, card);
    d.body.append(layer);
    const held = holdFocus(asHtml(card));
    expect(main.hasAttribute('inert')).toBe(true);
    expect(d.activeElement).toBe(card);
    layer.remove(); held.destroy();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(map.hasAttribute('inert')).toBe(true); // (still behind the bonus round)
    expect(d.activeElement).toBe(prize);
  });
  it('a dialog with no focusable box of its own gets one to take the keyboard', () => {
    const btn = d.el('button'), wrap = d.el('div', { role: 'dialog' }, d.el('button'));
    d.body.append(d.el('main', {}, btn, wrap));
    btn.focus();
    holdFocus(asHtml(wrap));
    expect(d.activeElement).toBe(wrap);
    expect(wrap.getAttribute('tabindex')).toBe('-1');
  });
});

describe('the markup', () => {
  const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
  it('the game keeps focus on its <main>, and moves nothing while a run, a Learn episode or a game plays', () => {
    const app = src('../../App.svelte');
    expect(app).toContain('<main class="app" bind:this={appEl}>');
    expect(app).toContain('keepFocus(appEl, () => PLAYS.has(game.screen) || game.learnOverlay !== null)');
    const plays = app.match(/const PLAYS = new Set<Screen>\(\[([^\]]*)\]\)/)![1];
    for (const s of ['run', 'mathRun', 'skillRun', 'learn', 'playground', 'battle', 'duel', 'arcadePlay', 'pizza', 'balance']) expect(plays, s).toContain(`'${s}'`);
    for (const s of ['hub', 'newPlayer', 'grownups', 'teach', 'players', 'classLogin']) expect(plays, s).not.toContain(`'${s}'`);
  });
  it('a landed heading shows the ring only when a key brought it, and a dialog box none', () => {
    const css = src('../../app.css');
    expect(css).toContain('[data-landed]:focus, [data-holds]:focus { outline: none; }');
    expect(css).toContain("[data-landed='key']:focus { outline: 3px solid var(--primary-edge);");
  });
  it('the dialogs opened from a button hold focus and give it back', () => {
    for (const f of ['../teach/ui/PrintCards.svelte', './GlobalMenu.svelte', './MusicPicker.svelte', './LessonChart.svelte', './QuickSettings.svelte', './Popover.svelte']) expect(src(f), f).toMatch(/use:holdFocus/);
    expect(src('../../App.svelte')).toMatch(/<div class="settings-layer"[^>]*use:holdFocus>/);
    // (the Pause card goes back to the lesson's keys: no button may take them)
    expect(src('./PauseCard.svelte')).not.toMatch(/holdFocus/);
    // (the Menu button keeps focus, so it gets it back when the menu closes)
    expect(src('./Bar.svelte')).not.toMatch(/blur\(\); sfx\.click\(\); game\.openMenu/);
  });
  it('the cards over a results screen, a hatched egg, the bonus round, the stickers and the wardrobe hold focus too', () => {
    for (const [f, n] of [['./RunResults.svelte', 3], ['./HatchMoment.svelte', 1], ['./BonusRound.svelte', 1], ['./TreasureCard.svelte', 1], ['../screens/Stickers.svelte', 1], ['../screens/Closet.svelte', 2]] as const) expect(src(f).match(/use:holdFocus/g)?.length, f).toBe(n);
    // (the shells card is a Popover, which holds already)
    expect(src('./ShellsCard.svelte')).toContain('<Popover ');
    // with the page behind inert, each closes from the keyboard: Escape (and Enter on the egg's card, as over a results screen)
    expect(src('./HatchMoment.svelte')).toContain("if (!see) { if (got && (e.key === 'Escape' || e.key === 'Enter'))");
    for (const f of ['../screens/Stickers.svelte', '../screens/Closet.svelte']) expect(src(f), f).toContain("addEventListener('keydown', escOut, true)");
  });
});
