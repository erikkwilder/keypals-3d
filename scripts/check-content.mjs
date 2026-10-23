#!/usr/bin/env node
// Content checker for Fancy Ant Typing.
// Run: node scripts/check-content.mjs
// Reads src/lib/content/words.ts and src/lib/content/sentences.ts as text,
// evaluates their data literals, and checks every word and line against the
// rules the game relies on. Exits 1 on any failure. Node built-ins only.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORDS_FILE = join(ROOT, 'src/lib/content/words.ts');
const SENTENCES_FILE = join(ROOT, 'src/lib/content/sentences.ts');

const failures = [];
const fail = (msg) => failures.push(msg);
const MAX_SHOWN = 12;

// ---------------------------------------------------------------- loading

// The content files hold only data. Drop `export type X = {...};` blocks,
// turn `export const NAME: Type =` into `const NAME =`, then evaluate.
function loadTs(file, names) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch (err) {
    console.error(`Could not read ${file}: ${err.message}`);
    process.exit(1);
  }
  src = src.replace(/export\s+type\s+\w+\s*=\s*\{[\s\S]*?\n\};?/g, '');
  src = src.replace(/export\s+const\s+(\w+)\s*(?::\s*[^=]+?)?\s*=/g, 'const $1 =');
  try {
    return new Function(`"use strict";\n${src}\nreturn { ${names.join(', ')} };`)();
  } catch (err) {
    console.error(`Could not evaluate ${file}: ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- blocklist

// Whole-word (or whole-phrase) matches, case-insensitive.
const BLOCKLIST = [
  // violence and weapons
  'kill', 'kills', 'killed', 'killing', 'killer', 'murder', 'gun', 'guns', 'shoot', 'shooting',
  'shot', 'stab', 'knife', 'knives', 'sword', 'bullet', 'rifle', 'pistol', 'bomb', 'bombs',
  'war', 'wars', 'weapon', 'weapons', 'fight', 'punch', 'attack', 'blood', 'bloody',
  'die', 'dies', 'died', 'dying', 'dead', 'death', 'grave', 'corpse', 'skull',
  // scary and gross
  'ghost', 'zombie', 'monster', 'demon', 'devil', 'hell', 'vomit', 'puke', 'poop', 'pee',
  'fart', 'snot', 'booger',
  // drugs, alcohol, smoking
  'drunk', 'beer', 'wine', 'vodka', 'whiskey', 'rum', 'alcohol', 'drug', 'drugs', 'weed',
  'cigarette', 'cigar', 'smoke', 'smoking', 'tobacco', 'vape',
  // body and romance
  'sex', 'sexy', 'kiss', 'kissing', 'naked', 'butt', 'boob', 'boobs', 'ass', 'breast',
  // insults
  'stupid', 'idiot', 'dumb', 'moron', 'loser', 'ugly', 'fat', 'jerk', 'freak', 'lame',
  'hate', 'hates', 'hated', 'shut up', 'crap', 'damn', 'sucks',
  // religion and politics
  'god', 'jesus', 'allah', 'pray', 'church', 'president', 'election', 'vote',
  // letter strings the home and top rows make easy to type by accident
  'fag', 'jap', 'isis', 'rape', 'hag', 'slag', 'shag', 'tit', 'tits', 'piss', 'shit', 'hoe',
];
const BLOCK_RES = BLOCKLIST.map((w) => [w, new RegExp(`(?<![a-z])${w.replace(/ /g, '\\s+')}(?![a-z])`, 'i')]);

function blockHits(text) {
  return BLOCK_RES.filter(([, re]) => re.test(text)).map(([w]) => w);
}

// ---------------------------------------------------------------- words

const { WORDS_KIDS, WORDS_GROWN } = loadTs(WORDS_FILE, ['WORDS_KIDS', 'WORDS_GROWN']);

const HOME_ROW = /^[asdfghjkl]+$/;
const TOP_AND_HOME = /^[qwertyuiopasdfghjkl]+$/;

function checkWordList(name, list, min) {
  if (!Array.isArray(list)) {
    fail(`${name} is not an array`);
    return new Set();
  }
  const bad = list.filter((w) => typeof w !== 'string' || !/^[a-z]{2,10}$/.test(w));
  if (bad.length) fail(`${name}: ${bad.length} words not lowercase a-z length 2-10: ${bad.slice(0, MAX_SHOWN).join(', ')}`);
  const seen = new Set();
  const dupes = new Set();
  for (const w of list) (seen.has(w) ? dupes : seen).add(w);
  if (dupes.size) fail(`${name}: ${dupes.size} duplicate words: ${[...dupes].slice(0, MAX_SHOWN).join(', ')}`);
  if (list.length < min) fail(`${name}: ${list.length} words, need at least ${min}`);
  const blocked = list.filter((w) => blockHits(w).length);
  if (blocked.length) fail(`${name}: blocked words: ${blocked.join(', ')}`);
  return seen;
}

const kidsSet = checkWordList('WORDS_KIDS', WORDS_KIDS, 2400);
const grownSet = checkWordList('WORDS_GROWN', WORDS_GROWN, 1100);
const across = [...grownSet].filter((w) => kidsSet.has(w));
if (across.length) fail(`WORDS_GROWN repeats ${across.length} words from WORDS_KIDS: ${across.slice(0, MAX_SHOWN).join(', ')}`);

const homeOnly = WORDS_KIDS.filter((w) => HOME_ROW.test(w));
const topHome = WORDS_KIDS.filter((w) => TOP_AND_HOME.test(w));
if (homeOnly.length < 30) fail(`WORDS_KIDS: only ${homeOnly.length} home-row-only words, need 30`);
if (topHome.length < 300) fail(`WORDS_KIDS: only ${topHome.length} top-and-home-row words, need 300`);

// ---------------------------------------------------------------- pools

const { POOLS } = loadTs(SENTENCES_FILE, ['POOLS']);

const SYMBOLS = /^[A-Za-z0-9 ,.'"?!\-():;@#&%+=/*]+$/;
// A sentence ends at . ! or ? (plus any closing quote or bracket) when the
// text ends or the next word starts with a capital or digit. So `"Wow!" said
// Dot.` is one sentence, and `zip! went the tongue` does not split.
const sentencesIn = (s) =>
  (s.match(/[.!?]+["')]*(?=$|\s+["'(]*(?:\.\.\.)?[A-Z0-9])/g) || []).length;
const wordsIn = (s) => s.split(' ').length;

const SPEC = [
  { id: 'home', kind: 'phrase', audience: 'all', chars: /^[asdfghjkl; ]+$/, min: 50, words: [2, 6] },
  { id: 'top', kind: 'sentence', audience: 'all', chars: /^[qwertyuiopasdfghjkl ]+$/, min: 70, words: [3, 9] },
  { id: 'bottom', kind: 'sentence', audience: 'all', chars: /^[a-z ,.]+$/, min: 70,
    extra: (s) => (s.endsWith('.') ? null : 'does not end with a period') },
  { id: 'capitals', kind: 'sentence', audience: 'all', chars: /^[A-Za-z ,.]+$/, min: 60,
    extra: (s) => (/^[A-Z]/.test(s) ? null : 'does not start with a capital') },
  { id: 'numbers', kind: 'sentence', audience: 'all', chars: /^[A-Za-z0-9 ,.]+$/, min: 50,
    extra: (s) => (/[0-9]/.test(s) ? null : 'has no digits') },
  { id: 'symbols', kind: 'sentence', audience: 'all', chars: SYMBOLS, min: 50,
    extra: (s) => (/[,.'"?!\-():;@#&%+=/*]/.test(s) ? null : 'has no symbols') },
  { id: 'stories-kids', kind: 'story', audience: 'kids', chars: SYMBOLS, min: 30, length: [120, 260],
    extra: (s) => { const n = sentencesIn(s); return n >= 2 && n <= 4 ? null : `has ${n} sentences, want 2-4`; } },
  { id: 'facts-kids', kind: 'fact', audience: 'kids', chars: SYMBOLS, min: 50, length: [20, 200],
    extra: (s) => (sentencesIn(s) === 1 && /[.!]$/.test(s) ? null : 'is not one sentence ending in . or !') },
  { id: 'stories-grown', kind: 'story', audience: 'grown', chars: SYMBOLS, min: 20, length: [200, 400] },
];

const poolSummary = [];
if (!Array.isArray(POOLS)) {
  fail('POOLS is not an array');
} else {
  const ids = POOLS.map((p) => p.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) fail(`POOLS: duplicate pool ids: ${dupIds.join(', ')}`);
  for (const p of POOLS) {
    if (!SPEC.find((s) => s.id === p.id)) fail(`POOLS: unexpected pool id "${p.id}"`);
  }
  for (const spec of SPEC) {
    const pool = POOLS.find((p) => p.id === spec.id);
    if (!pool) { fail(`pool "${spec.id}" is missing`); continue; }
    const where = `pool "${spec.id}"`;
    if (pool.kind !== spec.kind) fail(`${where}: kind is "${pool.kind}", want "${spec.kind}"`);
    if (pool.audience !== spec.audience) fail(`${where}: audience is "${pool.audience}", want "${spec.audience}"`);
    if (!Array.isArray(pool.lines)) { fail(`${where}: lines is not an array`); continue; }

    const problems = [];
    const seen = new Set();
    for (const line of pool.lines) {
      const why = [];
      if (typeof line !== 'string') { problems.push(`non-string line: ${JSON.stringify(line)}`); continue; }
      if (!spec.chars.test(line)) {
        const badChars = [...new Set([...line].filter((c) => !spec.chars.test(c)))];
        why.push(`bad characters ${JSON.stringify(badChars.join(''))}`);
      }
      if (/^\s|\s$/.test(line)) why.push('leading or trailing space');
      if (/\s{2,}/.test(line)) why.push('double space');
      if (seen.has(line)) why.push('duplicate line');
      seen.add(line);
      if (spec.words) {
        const n = wordsIn(line);
        if (n < spec.words[0] || n > spec.words[1]) why.push(`${n} words, want ${spec.words[0]}-${spec.words[1]}`);
      }
      if (spec.length) {
        const n = line.length;
        if (n < spec.length[0] || n > spec.length[1]) why.push(`${n} characters, want ${spec.length[0]}-${spec.length[1]}`);
      }
      if (spec.extra) { const e = spec.extra(line); if (e) why.push(e); }
      const hits = blockHits(line);
      if (hits.length) why.push(`blocked word(s): ${hits.join(', ')}`);
      if (why.length) problems.push(`${why.join('; ')} :: ${line}`);
    }
    if (pool.lines.length < spec.min) fail(`${where}: ${pool.lines.length} lines, need at least ${spec.min}`);
    for (const pr of problems.slice(0, MAX_SHOWN)) fail(`${where}: ${pr}`);
    if (problems.length > MAX_SHOWN) fail(`${where}: ...and ${problems.length - MAX_SHOWN} more problems`);

    const lens = pool.lines.map((l) => l.length);
    poolSummary.push({
      id: spec.id,
      lines: pool.lines.length,
      min: spec.min,
      chars: lens.length ? `${Math.min(...lens)}-${Math.max(...lens)}` : '-',
      ok: problems.length === 0 && pool.lines.length >= spec.min,
    });
  }
}

// ---------------------------------------------------------------- report

console.log('Fancy Ant Typing content check\n');
console.log('Words');
console.log(`  WORDS_KIDS   ${String(WORDS_KIDS.length).padStart(5)}  (home row only: ${homeOnly.length}, top + home rows only: ${topHome.length})`);
console.log(`  WORDS_GROWN  ${String(WORDS_GROWN.length).padStart(5)}`);
console.log('\nPools');
for (const p of poolSummary) {
  console.log(`  ${p.ok ? 'ok  ' : 'FAIL'} ${p.id.padEnd(14)} ${String(p.lines).padStart(4)} lines (min ${p.min}), ${p.chars} chars`);
}
if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nAll content checks passed.');
