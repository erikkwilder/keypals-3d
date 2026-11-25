// The class login's steps with a school Google account, read from the screen's source (it needs the whole
// game to run): a first name the class list has already comes first as "Is this you?", with "I'm new" below
// the list; a pupil waiting for her teacher's yes is told so, then and on a reload or a later visit.
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

describe("waiting for the teacher's yes", () => {
  it('says so where the buttons were, and the used sign-in is not sent again', () => {
    const fn = between('function toWaiting(', '/** join with Google');
    expect(fn).toMatch(/ticket = null/);
    expect(fn).toMatch(/if \(look && waitName\) noteWaiting\(code, waitName\)/);
    const step = between("{:else if step === 'waiting'}", "{:else if step === 'going'}");
    expect(step).toContain("You're on the list. Your teacher needs to say yes first.");
    expect(step).not.toMatch(/<button/);
    // both answers lead there: "I'm new" in a class open to any account, and Google again
    expect(between('async function joinNew', 'function pickName')).toMatch(/if \(err\.body\?\.pending\) \{ toWaiting\(/);
    expect(between('async function fromGoogle', 'function arrived')).toMatch(/if \('waiting' in r\) \{ toWaiting\(r\.name\)/);
  });
  it('on a later visit to the class, or a reload, she reads that she waits, with Google to check again', () => {
    const step = between("{:else if step === 'name'", "{:else if step === 'pics'");
    expect(step).toMatch(/\{#if !ticket && waits\.length\}[\s\S]*\{w\.name\}, you're waiting for your teacher's yes\.[\s\S]*Sign in with Google/);
    expect(between('async function find', 'onMount(() =>')).toMatch(/waits = ticket \? \[\] : waitingIn\(code\);\s*showingWaiting\(waits\.length \? code : null\)/);
    const boot = readFileSync(new URL('../teach/student.svelte.ts', import.meta.url), 'utf8');
    expect(boot).toMatch(/const waitingClass = linked \? null : backToWaiting\(\);\s*if \(waitingClass\) \{ classState\.loginCode = waitingClass; game\.go\('classLogin'\); \}/);
  });
  it('forgets her when she gets in, or when Google says she is not waiting', () => {
    expect(between('async function fromGoogle', 'function arrived')).toMatch(/forgetWaiting\(\[r\.in\.name\]\)[\s\S]*forgetWaiting\(\[gname\]\)/);
    expect(between('async function joinNew', 'function pickName')).toMatch(/forgetWaiting\(\[pl\.name, gname\]\)/);
    expect(between('async function tap', 'function back')).toMatch(/forgetWaiting\(\[who!\.name, gname\], ticket \? null : code\);\s*arrived\(\)/);
  });
});
