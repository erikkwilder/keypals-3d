// The class login's steps with a school Google account, read from the screen's source (it needs the whole
// game to run): a first name the class list has already comes first as "Is this you?", with "I'm new" below
// the list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sameName } from '../teach/names';

const src = readFileSync(new URL('./ClassLogin.svelte', import.meta.url), 'utf8');
const between = (from: string, to: string) => src.slice(src.indexOf(from), src.indexOf(to));

describe('back from Google with a first name the list has already', () => {
  it('names are compared as the server compares them', () => {
    expect(sameName('Maria', ' maria ')).toBe(true);
    expect(sameName('Maria', 'MARIA')).toBe(true);
    expect(sameName('Maria L.', 'Maria')).toBe(false);
    expect(sameName('Maria', 'Mariana')).toBe(false);
    expect(sameName('', '')).toBe(false);
  });
  it('asks "Is this you?" above the list instead of offering "I\'m new" first, and keeps "I\'m new" below it', () => {
    expect(src).toMatch(/const mine = \$derived\(ticket && gname && look \? look\.students\.find\(s => sameName\(s\.name, gname!\)\)/);
    const step = between("{:else if step === 'name'", "{:else if step === 'pics'");
    const list = step.indexOf('<div class="names">');
    const top = step.slice(0, list), bottom = step.slice(list);
    expect(top).toMatch(/\{#if mine\}\s*<p class="lead isyou">Is this you\? Tap \{mine\.name\}, then your two pictures\.<\/p>\s*\{:else if ticket\}\s*\{@render newMe\(true\)\}/);
    expect(bottom).toMatch(/\{#if mine\}\{@render newMe\(false\)\}\{\/if\}/);
    // the server's answer to "I'm new" shows under it
    expect(src.indexOf('{#if msg}')).toBeGreaterThan(src.indexOf('{@render newMe(false)}'));
  });
});
