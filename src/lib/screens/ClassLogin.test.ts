// The class login's steps with a school Google account, read from the screen's source (it needs the whole
// game to run): a first name the class list has already comes first as "Is this you?", with "I'm new" below
// the list; a pupil waiting for her teacher's yes is told so, then and on a reload or a later visit; the class
// code goes with her through Google, so she lands back on her class.
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

describe('the class code on the way through Google', () => {
  it('goes with her, and brings her back to her class', () => {
    expect(src).toMatch(/const kept = classState\.loginCode \? null : codeBackFromGoogle\(\);/);
    expect(src).toMatch(/let code = \$state\(classState\.loginCode \? [^;]* : kept \? showClassCode\(kept\) : ''\);/);
    expect(between('async function fromGoogle', 'function arrived')).toMatch(/step = 'code';\s*\/\/[^\n]*\n\s*if \(kept\) await find\(\);/);
    // every way to Google from this screen takes the code along
    expect(src.match(/studentGoogle\(code\)/g)?.length).toBe(2);
    expect(src.match(/studentGoogleDev\((devName|w\.name), code\)/g)?.length).toBe(2);
    expect(src).not.toMatch(/studentGoogle(Dev)?\((devName|w\.name)?\)/);
    const student = readFileSync(new URL('../teach/student.svelte.ts', import.meta.url), 'utf8');
    expect(student).toMatch(/export function studentGoogle\(classCode = ''\) \{ keepCodeForGoogle\(classCode\); location\.href = 'api\/auth\/google\/student'; \}/);
    expect(student).toMatch(/export function studentGoogleDev\(name: string, classCode = ''\) \{ keepCodeForGoogle\(classCode\);/);
  });
});

describe("a class that won't take her Google account", () => {
  it('is asked before the list or "I\'m new" shows; its own words show with a way back, and no list', () => {
    expect(between('async function find', 'onMount(() =>')).toMatch(/const no = ticket \? await refusal\(ticket\) : null;\s*look = l;\s*if \(no\) \{ refused = no; step = 'refused'; return; \}\s*step = 'name'/);
    // only a refusal counts (403, 409, 410: the server's words); not asked (no internet, too many tries), the list shows as before
    expect(between('async function refusal', 'onMount(() =>')).toMatch(/await googleCheck\(t, cleanClassCode\(code\)\); return null;[\s\S]*\[403, 409, 410\]\.includes\(err\.status\) \? err\.message : null/);
    const step = between("{:else if step === 'refused'", "{:else if step === 'waiting'}");
    expect(step).toMatch(/<p class="msg" role="alert">\{refused\}<\/p>/);
    expect(step).toMatch(/backToCode\(\); \}\}>Go back<\/button>/);
    expect(step).not.toMatch(/class="names"|newMe|I'm new|pickName/);
    // the way back leaves this sign-in behind; the class code stays, to sign in with another account or use the pictures
    expect(between('function backToCode', 'function back()')).toMatch(/ticket = null; gname = null;[^\n]*step = 'code'; \}/);
    expect(between('function back()', '</script>')).toMatch(/else if \(step === 'refused'\) backToCode\(\);/);
    const student = readFileSync(new URL('../teach/student.svelte.ts', import.meta.url), 'utf8');
    expect(student).toMatch(/export const googleCheck = \(ticket: string, classCode: string\) => send<\{ ok: true \}>\('\/class\/google\/check', 'POST', \{ ticket, code: classCode \}\);/);
  });
});

describe("Google sign-in on the class's own page", () => {
  it('shows when the class allows it, the class code going along, as under the code box', () => {
    const box = between('{#snippet googleBox()}', '{/snippet}');
    expect(box).toMatch(/\{#if cloud\.google \|\| dev\}/);
    expect(box).toMatch(/\{#if cloud\.google\}<button class="btn btn-big gbtn" onclick=\{\(\) => \{ sfx\.click\(\); studentGoogle\(code\); \}\}>Sign in with Google<\/button>/);
    expect(between("{:else if step === 'code'}", "{:else if step === 'name'")).toMatch(/\{#if !ticket\}\{@render googleBox\(\)\}\{\/if\}/);
    // on the list, below the names: not back from Google already, nobody here waiting (that has its own button), and the class allows it
    const step = between("{:else if step === 'name'", "{:else if step === 'pics'");
    expect(step.indexOf('{@render googleBox()}')).toBeGreaterThan(step.indexOf('<div class="names">'));
    expect(step).toMatch(/\{#if !ticket && !waits\.length && look\.class\.google\}\{@render googleBox\(\)\}\{\/if\}/);
    const student = readFileSync(new URL('../teach/student.svelte.ts', import.meta.url), 'utf8');
    expect(student).toMatch(/export type ClassLook = \{ class: \{ name: string; grade: number; teacher: string; google\?: boolean \}/);
  });
});
