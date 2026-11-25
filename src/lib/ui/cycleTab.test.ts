// While a game plays (a math trip, a skill trip, an Arcade round), Tab goes round its own controls instead of
// leaving the page, which pauses it: a child who moves by Tab and presses one switch could otherwise not finish.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cycleTab } from './focusKeeper';

type Opts = { tabIndex?: number; disabled?: boolean; rects?: number; hidden?: boolean; inert?: boolean };
type El = { name: string; tabIndex: number; focus: () => void; matches: (s: string) => boolean; getClientRects: () => { length: number }; closest: (s: string) => El | null; checkVisibility: () => boolean };
function room(spec: (string | [string, Opts])[]) {
  let at: El | null = null;
  const els: El[] = spec.map(s => {
    const [name, o] = typeof s === 'string' ? [s, {} as Opts] : s;
    const el: El = {
      name, tabIndex: o.tabIndex ?? 0,
      focus: () => { at = el; },
      matches: (sel: string) => sel === ':disabled' && !!o.disabled,
      getClientRects: () => ({ length: o.rects ?? 1 }),
      closest: (sel: string) => (sel === '[inert]' && o.inert ? el : null),
      checkVisibility: () => !o.hidden,
    };
    return el;
  });
  const root = { querySelectorAll: () => els } as unknown as Element;
  const doc = { get activeElement() { return at as unknown as Element; } };
  return { root, doc, focus: (n: string) => els.find(e => e.name === n)!.focus(), at: () => at?.name ?? null };
}
function key(shiftKey = false, used = false) {
  let prevented = used;
  return { e: { key: 'Tab', shiftKey, get defaultPrevented() { return prevented; }, preventDefault: () => { prevented = true; } }, prevented: () => prevented };
}

describe('Tab goes round a game instead of leaving the page', () => {
  it('from the last control, Tab goes to the first', () => {
    const r = room(['Pause', '1', '2', 'Erase']); r.focus('Erase');
    const k = key();
    expect(cycleTab(r.root, k.e, r.doc)).toBe(true);
    expect([r.at(), k.prevented()]).toEqual(['Pause', true]);
  });
  it('from the first, Shift-Tab goes to the last', () => {
    const r = room(['Pause', '1', '2', 'Erase']); r.focus('Pause');
    const k = key(true);
    expect(cycleTab(r.root, k.e, r.doc)).toBe(true);
    expect(r.at()).toBe('Erase');
  });
  it("anywhere else Tab is the browser's own (it moves on as usual)", () => {
    const r = room(['Pause', '1', '2', 'Erase']); r.focus('1');
    const k = key();
    expect(cycleTab(r.root, k.e, r.doc)).toBe(false);
    expect([r.at(), k.prevented()]).toEqual(['1', false]);
  });
  it("the round's ends are the controls Tab stops on: not tabindex -1, turned off, not shown or behind a dialog", () => {
    const r = room(['Pause', '1', 'Erase', ['skip', { tabIndex: -1 }], ['off', { disabled: true }], ['none', { rects: 0 }], ['hid', { hidden: true }], ['behind', { inert: true }]]);
    r.focus('Erase');
    expect(cycleTab(r.root, key().e, r.doc)).toBe(true);
    expect(r.at()).toBe('Pause');
  });
  it('a Tab a screen already used is left alone (the fraction pad: from the top box to the bottom one)', () => {
    const r = room(['Pause', '1', 'Erase']); r.focus('Erase');
    expect(cycleTab(r.root, key(false, true).e, r.doc)).toBe(false);
    expect(r.at()).toBe('Erase');
  });
  it('with one control, Tab stays on it', () => {
    const r = room(['Pause']); r.focus('Pause');
    expect(cycleTab(r.root, key().e, r.doc)).toBe(true);
    expect(r.at()).toBe('Pause');
  });
  it('other keys are left alone', () => {
    const r = room(['Pause', '1']); r.focus('1');
    const k = { key: 'Enter', shiftKey: false, defaultPrevented: false, preventDefault: () => { throw new Error('no'); } };
    expect(cycleTab(r.root, k, r.doc)).toBe(false);
  });
  it('the math trip, the skill trip and the Arcade use it while they play', () => {
    const src = (f: string) => readFileSync(new URL(`../screens/${f}`, import.meta.url), 'utf8');
    expect(src('MathRun.svelte')).toMatch(/if \(phase !== 'play'\) return;\n[^\n]*\n\s*if \(runEl && cycleTab\(runEl, e\)\) return;/);
    expect(src('MathRun.svelte')).toContain('class="mrun" class:compact class:learning={!!game.learnOverlay} bind:clientWidth={w} bind:clientHeight={h} bind:this={runEl}');
    expect(src('SkillRun.svelte')).toMatch(/if \(phase === 'play' && runEl\) cycleTab\(runEl, e\);/);
    expect(src('SkillRun.svelte')).toContain('bind:this={runEl}>');
    expect(src('ArcadePlay.svelte')).toMatch(/if \(phase === 'play' && rootEl\) cycleTab\(rootEl, e\);/);
    expect(src('ArcadePlay.svelte')).toContain('<div class="aplay g-{id}" class:compact bind:clientWidth={w} bind:this={rootEl}>');
  });
  it('a window that loses focus pauses an Arcade round with the Pause card, as it does a trip (not just a stopped round)', () => {
    const src = (f: string) => readFileSync(new URL(`../screens/${f}`, import.meta.url), 'utf8');
    expect(src('ArcadePlay.svelte')).toContain("function onBlur() { if (phase === 'play' && !game.pause) { pause(); game.openPause(resume); } }");
    expect(src('MathRun.svelte')).toContain("function onBlur() { if (phase === 'play' && !game.pause) { pauseNow(); game.openPause(resumeNow); } }");
  });
});
