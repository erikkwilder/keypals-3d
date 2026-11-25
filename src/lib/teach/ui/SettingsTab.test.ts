// How students sign in, on a class's Settings tab, read from the source (the tab needs the teacher's page to
// run): the words follow the setting, so a class with Google sign-in off doesn't tell students to use it.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./SettingsTab.svelte', import.meta.url), 'utf8');
const part = src.slice(src.indexOf('<h3>How students sign in</h3>'), src.indexOf('<h3 class="group">This class</h3>'));

describe('how students sign in', () => {
  it('off: the class code, their name and their two pictures, and that Google sign-in is off', () => {
    const off = part.slice(part.indexOf("{#if set.google === 'off'}"), part.indexOf('{:else}'));
    expect(off).toContain('<p class="muted">Students log in with the class code, then tap their name and their two pictures. Google sign-in is off for this class.</p>');
    expect(off).not.toContain('Sign in with Google');
  });
  it('on: as before, tap "Sign in with Google" and type the class code once', () => {
    const on = part.slice(part.indexOf('{:else}'), part.indexOf('<label class="chk">'));
    expect(on).toContain('Students with a school Google account can also tap "Sign in with Google", type the class code once, and from then on Google takes them straight in, on any computer.');
    // the count after them keeps its space (a space at the start of an {#if} is dropped)
    expect(on).toMatch(/never their email\.\{#if googleOnes\}\{' '\}\{googleOnes\} student/);
  });
});
