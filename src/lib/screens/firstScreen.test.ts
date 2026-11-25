// The first New player screen fits a 1366x768 laptop with Google sign-in on, as on the live site: it was
// 43 px too tall ("For teachers" at y 754-781 of 768), so the screen scrolled. "Sign in with Google" and
// "Already play on another computer?" and "I'm in a class" now sit side by side where they fit
// (NewPlayer.svelte .ways).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const src = read('./NewPlayer.svelte');

describe('the first New player screen', () => {
  it('puts Google sign-in, the save code and the class login side by side when Google sign-in shows', () => {
    expect(src).toMatch(/<div class="ways" class:pair>\s*<GoogleSignIn \/>[^\n]*\n\s*<SaveCodeForm \/>\s*<ClassEntry \/>[^\n]*\n\s*<\/div>/);
    expect(src).toMatch(/\.ways\.pair \{ display: flex; flex-wrap: wrap; justify-content: center;/);
  });

  it('pairs them only when Google sign-in shows (the same rule as GoogleSignIn.svelte)', () => {
    expect(src).toMatch(/const pair = \$derived\(cloud\.online && cloud\.google && !cloud\.account\);/);
    expect(read('../ui/GoogleSignIn.svelte')).toContain('{#if cloud.online && cloud.google && !cloud.account}');
  });

  it('is laid out as before when Google sign-in is off: the wrapper is not a box of its own', () => {
    expect(src).toMatch(/\.ways \{ display: contents; \}/);
  });

  it('leaves their own space above them out of the row, so the buttons line up', () => {
    expect(read('../ui/SaveCodeForm.svelte')).toMatch(/\.codebtn \{ margin-top: 18px; \}/);
    expect(read('../ui/ClassEntry.svelte')).toMatch(/\.ce \{[^}]*margin-top: 18px; \}/);
    expect(src).toMatch(/\.ways\.pair :global\(\.codebtn\), \.ways\.pair :global\(\.elsewhere\), \.ways\.pair :global\(\.ce\) \{ margin-top: 0; \}/);
  });
});
