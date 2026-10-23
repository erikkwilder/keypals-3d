// Builds the text for a lesson from the characters the player knows, leaning on the new
// keys and on the keys they find hard. Real words come first; made-up letter strings are
// only used while too few letters are known to make words.

import type { Lesson } from './course';
import type { Layout } from './layouts';
import { mulberry32, pick, shuffle, weighted, type Rng } from './rng';

export type SentencePool = { id: string; kind: string; audience: 'kids' | 'all' | 'grown'; lines: string[] };

export type GenCtx = {
  lesson: Lesson;
  layout: Layout;
  known: Set<string>;
  fresh: string[];
  weak?: Map<string, number>; // char -> 0..1 (1 = very weak)
  grown?: boolean;
  seed: number;
  words: string[];
  pools: SentencePool[];
  custom?: string;
  /** mix lessons: the keys to practise most */
  focus?: string[];
};

const CREW_NAMES = ['Dino', 'Chee', 'Momo', 'Kiki'];
const PLACES = ['Home', 'Row', 'Island', 'Treetops', 'Burrows', 'Capital', 'Cliffs', 'Number', 'Ridge', 'Symbol', 'Shores', 'Open', 'Road', 'Sky'];
const CONTRACTIONS = ["don't", "it's", "can't", "let's", "that's", "you're", "we're", "isn't", "won't", "she's", "he's", "what's", "there's", "dino's", "momo's", "kiki's", "chee's"];

export const fits = (s: string, known: Set<string>) => { for (const ch of s) if (!known.has(ch)) return false; return true; };
const isLetter = (ch: string) => /\p{L}/u.test(ch);

/**
 * How many letters a lesson asks for. Short and repetitive, like Animal Typing's kids lessons
 * (30 to 100 letters): quick rounds, quick wins, and another go is never far away.
 */
export function targetLength(lesson: Lesson, grown?: boolean) {
  return Math.max(40, Math.round(lesson.len * (grown ? 0.9 : 0.55)));
}

function clean(s: string, known: Set<string>): string {
  let out = '';
  for (const ch of s.replace(/\s+/g, ' ')) if (known.has(ch)) out += ch;
  return out.replace(/ {2,}/g, ' ').trim();
}

function joinUntil(parts: Iterable<string>, L: number): string {
  let s = '';
  for (const p of parts) {
    if (!p) continue;
    s = s ? s + ' ' + p : p;
    if (s.length >= L) break;
  }
  return s;
}

type Ctx2 = GenCtx & { rng: Rng; L: number; letters: string[]; freshLetters: string[] };

function charWeight(c: Ctx2, ch: string) {
  const w = c.weak?.get(ch) ?? 0;
  return (c.freshLetters.includes(ch) ? 4 : 1) + 3 * w;
}

function pseudoWord(c: Ctx2, minLen = 2, maxLen = 5): string {
  const len = minLen + Math.floor(c.rng() * (maxLen - minLen + 1));
  const pool = c.letters;
  const ws = pool.map(ch => charWeight(c, ch));
  let s = '';
  for (let i = 0; i < len; i++) {
    let ch = weighted(c.rng, pool, ws);
    let guard = 0;
    while (s.length >= 2 && s[s.length - 1] === ch && s[s.length - 2] === ch && guard++ < 8) ch = weighted(c.rng, pool, ws);
    s += ch;
  }
  if (c.freshLetters.length && ![...s].some(ch => c.freshLetters.includes(ch))) {
    const i = Math.floor(c.rng() * s.length);
    s = s.slice(0, i) + pick(c.rng, c.freshLetters) + s.slice(i + 1);
  }
  return s;
}

function realWords(c: Ctx2): string[] {
  return c.words.filter(w => fits(w, c.known));
}

function wordStream(c: Ctx2, count: number, opts: { needFresh?: boolean; weakBoost?: number } = {}): string[] {
  const cands = realWords(c);
  const kids = !c.grown;
  const usable = cands.filter(w => (kids ? w.length <= 8 : true));
  const list = usable.length >= 12 ? usable : cands;
  const out: string[] = [];
  if (list.length < 12) {
    // too few real words yet: mostly made-up strings, sprinkled with whatever words exist
    for (let i = 0; i < count; i++) out.push(list.length && c.rng() < 0.35 ? pick(c.rng, list) : pseudoWord(c));
    return out;
  }
  const weakBoost = opts.weakBoost ?? 2;
  const weights = list.map(w => {
    let x = 1;
    let fresh = false;
    for (const ch of w) {
      if (c.freshLetters.includes(ch)) fresh = true;
      x += (c.weak?.get(ch) ?? 0) * weakBoost;
    }
    if (fresh) x += opts.needFresh ? 8 : 4;
    if (kids && w.length <= 5) x += 1;
    return x;
  });
  let last = '';
  for (let i = 0; i < count; i++) {
    let w = weighted(c.rng, list, weights);
    if (w === last) w = weighted(c.rng, list, weights);
    out.push(w);
    last = w;
  }
  return out;
}

/** Dress plain words for later regions: capitals, numbers, punctuation the player knows. */
function dress(c: Ctx2, words: string[]): string[] {
  const k = c.known;
  const hasCaps = [...k].some(ch => isLetter(ch) && ch !== ch.toLowerCase());
  const digits = [...k].filter(ch => /[0-9]/.test(ch));
  const names = CREW_NAMES.concat(PLACES).filter(n => fits(n, k));
  return words.map(w => {
    const r = c.rng();
    if (hasCaps && r < 0.22) {
      const cap = w[0].toUpperCase() + w.slice(1);
      if (fits(cap, k)) return cap;
    }
    if (hasCaps && names.length && r < 0.3) return pick(c.rng, names);
    if (digits.length && r > 0.86) return Array.from({ length: 1 + Math.floor(c.rng() * 2) }, () => pick(c.rng, digits)).join('');
    return w;
  });
}

const SYMBOL_MAKERS: Record<string, (c: Ctx2, w: () => string) => string | null> = {
  '?': (_c, w) => w() + '?',
  '!': (_c, w) => w() + '!',
  '"': (_c, w) => `"${w()}"`,
  '-': (_c, w) => `${w()}-${w()}`,
  '(': (_c, w) => `(${w()})`,
  ')': (_c, w) => `(${w()})`,
  ':': (_c, w) => `${w()}:`,
  ';': (_c, w) => `${w()};`,
  ',': (_c, w) => `${w()},`,
  '.': (_c, w) => `${w()}.`,
  '/': (_c, w) => `${w()}/${w()}`,
  '@': (_c, w) => `@${w()}`,
  '#': (c) => `#${1 + Math.floor(c.rng() * 9)}`,
  '&': (_c, w) => `${w()} & ${w()}`,
  '%': (c) => `${10 * (1 + Math.floor(c.rng() * 9))}%`,
  "'": (c) => { const ok = CONTRACTIONS.filter(x => fits(x, c.known)); return ok.length ? pick(c.rng, ok) : null; },
};

function introText(c: Ctx2): string {
  const parts: string[] = [];
  const fresh = c.fresh.filter(ch => ch !== ' ');
  const letters = fresh.filter(isLetter);
  const lowerFresh = letters.filter(ch => ch === ch.toLowerCase());
  const capsFresh = letters.filter(ch => ch !== ch.toLowerCase());
  const digitFresh = fresh.filter(ch => /[0-9]/.test(ch));
  const symFresh = fresh.filter(ch => !isLetter(ch) && !/[0-9]/.test(ch));
  const plain = () => { const ws = wordStream(c, 1); return ws[0] ?? pseudoWord(c); };

  // warm-up: each new key on its own, then pairs
  for (const ch of lowerFresh) parts.push(ch.repeat(3));
  if (lowerFresh.length >= 2) {
    const [a, b] = lowerFresh;
    parts.push(a + b, b + a, a + a + b + b, a + b + a, b + a + b);
  }
  for (const ch of digitFresh) parts.push(ch.repeat(2));
  if (digitFresh.length >= 2) for (let i = 0; i < 4; i++) parts.push(shuffle(c.rng, digitFresh).slice(0, 2 + Math.floor(c.rng() * 2)).join(''));
  for (const ch of capsFresh.slice(0, 6)) parts.push(ch + ch.toLowerCase());
  for (const ch of symFresh) { const m = SYMBOL_MAKERS[ch]; const s = m?.(c, plain); if (s) parts.push(s); }

  // then practice until the lesson is long enough
  const seen = new Set<string>();
  let guard = 0;
  while (joinUntil(parts, Infinity).length < c.L && guard++ < 200) {
    const r = c.rng();
    if (capsFresh.length) {
      const words = wordStream(c, 1)[0];
      const capped = words ? words[0].toUpperCase() + words.slice(1) : '';
      if (capped && fits(capped, c.known) && capsFresh.includes(capped[0])) { parts.push(capped); continue; }
      const nm = CREW_NAMES.concat(PLACES).filter(n => fits(n, c.known) && capsFresh.includes(n[0]));
      if (nm.length && r < 0.5) { parts.push(pick(c.rng, nm)); continue; }
      parts.push(pick(c.rng, capsFresh) + pseudoWord(c, 1, 3));
      continue;
    }
    if (digitFresh.length) {
      if (r < 0.55) parts.push(Array.from({ length: 1 + Math.floor(c.rng() * 3) }, () => pick(c.rng, digitFresh)).join(''));
      else parts.push(plain());
      continue;
    }
    if (symFresh.length) {
      const ch = pick(c.rng, symFresh);
      const s = r < 0.6 ? SYMBOL_MAKERS[ch]?.(c, plain) : plain();
      if (s) parts.push(s);
      continue;
    }
    const words = wordStream(c, 1, { needFresh: true })[0];
    const real = words && lowerFresh.some(ch => words.includes(ch));
    if (real && (r < 0.55 || seen.size > 6)) { parts.push(words); seen.add(words); }
    else parts.push(pseudoWord(c, 2, 4));
  }
  return joinUntil(parts, c.L);
}

function poolLines(c: Ctx2, preferred?: string): string[] {
  const aud = c.grown ? ['grown', 'all'] : ['kids', 'all'];
  const first = c.pools.filter(p => p.id === preferred);
  const rest = c.pools.filter(p => p.id !== preferred && aud.includes(p.audience) && (p.kind === 'sentence' || p.kind === 'phrase'));
  const a = first.flatMap(p => p.lines).filter(l => fits(l, c.known));
  const b = rest.flatMap(p => p.lines).filter(l => fits(l, c.known));
  return [...shuffle(c.rng, a), ...shuffle(c.rng, b)];
}

function sentencesText(c: Ctx2, L = c.L): string {
  const lines = poolLines(c, c.lesson.pool);
  if (lines.length < 2) return joinUntil(dress(c, wordStream(c, 200)), L);
  return joinUntil(lines, L);
}

function storyText(c: Ctx2, poolId: string, single: boolean): string {
  const pool = c.pools.find(p => p.id === poolId);
  const lines = shuffle(c.rng, (pool?.lines ?? []).filter(l => fits(l, c.known)));
  if (!lines.length) return sentencesText(c);
  if (single) return lines[0];
  return joinUntil(lines, c.L);
}

function weakText(c: Ctx2): string {
  const weak = [...(c.weak ?? new Map()).entries()].filter(([ch, w]) => w > 0.15 && c.known.has(ch) && ch !== ' ').sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!weak.length) return joinUntil(dress(c, wordStream(c, 200)), c.L);
  const focus = new Map(weak);
  const c2: Ctx2 = { ...c, weak: focus, freshLetters: weak.map(([ch]) => ch).filter(isLetter) };
  const parts: string[] = [];
  const words = wordStream(c2, 200, { weakBoost: 12, needFresh: true });
  for (let i = 0; i < words.length && joinUntil(parts, Infinity).length < c.L; i++) {
    if (i % 5 === 4 && c2.freshLetters.length >= 1) parts.push(pseudoWord(c2, 2, 3));
    else parts.push(words[i]);
  }
  return joinUntil(parts, c.L);
}

function customText(c: Ctx2): string {
  const raw = (c.custom ?? '').replace(/\s+/g, ' ').trim();
  const usable = [...raw].filter(ch => ch === ' ' || c.layout.chars.has(ch)).join('').replace(/ {2,}/g, ' ').trim();
  if (!usable) return joinUntil(wordStream(c, 200), c.L);
  if (usable.length >= 60) return usable.length > 600 ? usable.slice(0, 600).replace(/\s+\S*$/, '') : usable;
  const words = usable.split(' ');
  const parts: string[] = [];
  while (joinUntil(parts, Infinity).length < Math.max(80, usable.length * 2)) parts.push(...shuffle(c.rng, words));
  return joinUntil(parts, Math.max(80, usable.length * 2));
}

/**
 * A drill uses only the lesson's new keys (two letters, a couple of digits, or two symbols): first each
 * on its own, then pairs, then little groups of both, so they're mastered before anything joins them.
 */
function drillText(c: Ctx2): string {
  const keys = c.fresh.filter(ch => ch !== ' ');
  if (!keys.length) return joinUntil(wordStream(c, 200), c.L);
  const [a, b = a] = keys;
  const parts: string[] = [];
  const isSym = !isLetter(a) && !/[0-9]/.test(a);
  // warm-up
  for (const k of keys) parts.push(k.repeat(isSym ? 2 : 3));
  parts.push(a + b, b + a, a + a + b, b + b + a, a + b + a, b + a + b);
  // then groups of two to five, leaning toward switching between the two keys
  let guard = 0;
  while (joinUntil(parts, Infinity).length < c.L && guard++ < 300) {
    const len = 2 + Math.floor(c.rng() * (isSym ? 2 : 4));
    let g = '';
    for (let i = 0; i < len; i++) {
      const prev = g[g.length - 1];
      const pool = keys.length > 2 ? keys : [a, b];
      let ch = pick(c.rng, pool);
      if (prev && ch === prev && c.rng() < 0.55) ch = pool.find(k => k !== prev) ?? ch;
      g += ch;
    }
    parts.push(g);
  }
  return joinUntil(parts, c.L);
}

/** The keys a mix lesson practises most, on this layout. */
export function focusOf(lesson: Lesson, layout: Layout): string[] {
  const out: string[] = [];
  for (const code of lesson.focus ?? []) { const k = layout.byCode.get(code); if (k?.base && !layout.dead.has(k.base)) out.push(k.base); }
  return out.concat(lesson.focusChars ?? []);
}

/** A mix: everything known so far, with the newest keys turning up most. */
function mixText(c: Ctx2, focus: string[]): string {
  const c2: Ctx2 = { ...c, freshLetters: focus.filter(isLetter) };
  const others = focus.filter(ch => !isLetter(ch));
  const parts: string[] = [];
  const words = wordStream(c2, 300, { needFresh: true });
  for (let i = 0; i < words.length && joinUntil(parts, Infinity).length < c.L; i++) {
    // digits and punctuation in focus get their own little groups
    if (others.length && i % 3 === 2) parts.push(Array.from({ length: 2 + Math.floor(c.rng() * 2) }, () => pick(c.rng, others)).join(''));
    else if (c2.freshLetters.length && i % 4 === 3) parts.push(pseudoWord(c2, 2, 4));
    else parts.push(words[i]);
  }
  return joinUntil(parts, c.L);
}

export function generate(ctx: GenCtx): string {
  const rng = mulberry32(ctx.seed);
  const known = ctx.lesson.kind === 'custom'
    ? new Set<string>([...ctx.layout.chars.keys(), ' '])
    : ctx.known;
  const letters = [...known].filter(ch => isLetter(ch) && ch === ch.toLowerCase());
  const c: Ctx2 = {
    ...ctx, known, rng, L: targetLength(ctx.lesson, ctx.grown), letters,
    freshLetters: ctx.fresh.filter(ch => isLetter(ch) && ch === ch.toLowerCase()),
  };
  let text: string;
  switch (ctx.lesson.kind) {
    case 'drill': text = drillText(c); break;
    case 'mix': text = mixText(c, ctx.focus ?? focusOf(ctx.lesson, ctx.layout)); break;
    case 'intro': text = introText(c); break;
    case 'words': text = joinUntil(dress(c, wordStream(c, 300)), c.L); break;
    case 'sentences': text = sentencesText(c); break;
    case 'checkpoint': {
      const half = Math.round(c.L / 2);
      const a = joinUntil(dress(c, wordStream(c, 200)), half);
      const b = sentencesText(c, c.L - a.length);
      text = rng() < 0.5 ? a + ' ' + b : b + ' ' + a;
      break;
    }
    case 'story': text = storyText(c, ctx.grown ? 'stories-grown' : 'stories-kids', true); break;
    case 'facts': text = storyText(c, 'facts-kids', false); break;
    case 'weak': text = weakText(c); break;
    case 'sprint': text = joinUntil(dress(c, wordStream(c, 400)), c.L); break;
    case 'custom': text = customText(c); break;
    default: text = joinUntil(wordStream(c, 200), c.L);
  }
  const out = clean(text, known);
  return out || clean(joinUntil([...known].filter(isLetter).map(ch => ch.repeat(3)), c.L), known) || 'f j f j';
}
