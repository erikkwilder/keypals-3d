// What a screen reader hears on the first screens, the class login and the Learn list: what's picked says
// so, a picture inside a button that already says the name isn't read as well, the name box has a name,
// a wrong save code is read out, and each lesson's "Watch" says which lesson.
import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Critter from './Critter.svelte';
import PicturePick from './PicturePick.svelte';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const buttons = (html: string) => [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]);

describe('what\'s picked says so', () => {
  it('the class login\'s pictures: the one tapped is pressed, the others aren\'t', () => {
    const { body } = render(PicturePick, { props: { picked: [5], ontap: () => {} } });
    const pics = buttons(body);
    expect(pics.length).toBeGreaterThan(10);
    expect(pics.filter(b => b.includes('aria-pressed="true"'))).toHaveLength(1);
    expect(pics.filter(b => b.includes('aria-pressed="false"'))).toHaveLength(pics.length - 1);
    const none = buttons(render(PicturePick, { props: { picked: [], ontap: () => {} } }).body);
    expect(none.every(b => b.includes('aria-pressed="false"'))).toBe(true);
  });
  it('the kid and grown-up cards on New player', () => {
    const np = src('../screens/NewPlayer.svelte');
    expect(np).toContain('onclick={() => (grown = false)} aria-pressed={!grown}>');
    expect(np).toContain('onclick={() => (grown = true)} aria-pressed={grown}>');
    // (the buddies had it already)
    expect(np).toContain('aria-pressed={buddy === f.id}');
  });
});

describe('a name is read once', () => {
  it('a buddy\'s picture inside a button that says the name has no alt or tooltip', () => {
    const plain = render(Critter, { props: { friend: 'dino' } }).body;
    expect(plain).toContain('alt="Dino"');
    expect(plain).toContain('title="Dino"');
    const quiet = render(Critter, { props: { friend: 'dino', decorative: true } }).body;
    expect(quiet).toContain('alt=""');
    expect(quiet).not.toContain('title=');
    expect(quiet).not.toContain('Dino');
  });
  it('the buddies, the kid and grown-up cards, and the class login\'s names use it', () => {
    const np = src('../screens/NewPlayer.svelte');
    expect(np).toContain('quirkOnHover decorative />');
    expect(np).toContain('size={100} mood="dance" decorative />');
    expect(np).toContain('size={100} accessory="detective" decorative />');
    expect(src('../screens/ClassLogin.svelte')).toContain('size={58} round still decorative /><span>{s.name}</span>');
  });
});

describe('names and messages', () => {
  it('the name box is named, not only by its placeholder', () => {
    expect(src('../screens/NewPlayer.svelte')).toMatch(/<input class="name"[^>]*aria-label="Your name"/);
  });
  it('a wrong save code is read out, as the class login\'s message is', () => {
    expect(src('./SaveCodeForm.svelte')).toContain('<p class="err" role="alert">{msg}</p>');
    expect(src('../screens/ClassLogin.svelte')).toContain('<p class="msg" role="alert">{msg}</p>');
  });
  it('each lesson\'s "Watch" button says which lesson, in the same words as the picture before it', () => {
    const w = src('./WayPane.svelte');
    const name = 'aria-label="{verb(t, st.done, st.locked)}: {t.name}"';
    expect(w).toContain(`class="tpic"`);
    expect(w.split(name)).toHaveLength(3);
    expect(w).toContain(`<button class="btn small" onclick={() => openThing(subject, way, t)} ${name}>{verb(t, st.done, st.locked)}</button>`);
  });
});
