// Learn episodes: each trick from learn.ts played as a short story in a real 3D place. The buddy and a
// Glimmer have a little problem; the kid solves it with their hands (dragging, tapping, hopping), sees the
// trick on top of what they just did, catches the buddy making a mistake and fixes it, tries two of
// their own, and wins the trick's card. The pictures are the lesson's own boards (learn.ts): what changes
// from one board to the next is what the kid's hands do (see taskFor).
import type { GlimmerId } from '../adventure/glimmers';
import { answerOf, factId, isRuleFact, type Fact } from './facts';
import { LESSON, LESSONS, askText, coverOf, hideAnswer, hintFor, lessonForFact, type Board, type Dot, type Lesson, type Step } from './learn';
import { factRung, groupFacts, MATH_REGION, STRAND } from './course';
import { rungFor, STRAND_SKILL, TARGET, thetaOf, type AbilityHome } from './skills/ability';
import { FRAC_LESSON, type EpQ } from './fracEpisodes';

export type SetId = 'kitchen' | 'dock' | 'picnic' | 'workshop' | 'garden' | 'cave';
/** what the counters are in each place */
export type TokenKind = 'cookie' | 'pearl' | 'berry' | 'block' | 'flower';

export const SETS: Record<SetId, {
  name: string;
  /** painted backdrop and the table's top (public/learn/ep/) */
  backdrop: string; table: string;
  /** the Glimmer who lives there and helps */
  star: GlimmerId;
  token: TokenKind;
  /** ten frames and plates: what they are here, and their colour */
  tray: { word: string; color: number; rim: number };
  plate: { word: string; color: number; rim: number };
  /** the light: the warm key light's colour, the sky light's, and the haze */
  key: number; sky: number; ground: number; haze: number;
}> = {
  kitchen: { name: 'The Bakery Kitchen', backdrop: 'learn/ep/set-kitchen.webp', table: 'learn/ep/tex-kitchen.webp', star: 'sproutbun', token: 'cookie',
    tray: { word: 'muffin tin', color: 0xb9c0cc, rim: 0x5a6274 }, plate: { word: 'plate', color: 0xfdf7ee, rim: 0x6f9fd8 }, key: 0xffd9a0, sky: 0xffe9c8, ground: 0x7a5236, haze: 0xf3c891 },
  dock: { name: 'The Sunny Dock', backdrop: 'learn/ep/set-dock.webp', table: 'learn/ep/tex-dock.webp', star: 'puddlepup', token: 'pearl',
    tray: { word: 'shell crate', color: 0xc99a62, rim: 0x8a6239 }, plate: { word: 'bucket', color: 0x5fb3d9, rim: 0x2f7aa3 }, key: 0xfff0d0, sky: 0xcfeaff, ground: 0x5b7a8c, haze: 0xbfe3f6 },
  picnic: { name: 'The Picnic Meadow', backdrop: 'learn/ep/set-picnic.webp', table: 'learn/ep/tex-picnic.webp', star: 'snowseal', token: 'berry',
    tray: { word: 'berry box', color: 0xd9b47a, rim: 0x9c7440 }, plate: { word: 'plate', color: 0xfffaf2, rim: 0xe0646d }, key: 0xfff0c8, sky: 0xe6f6ff, ground: 0x6e8a3c, haze: 0xe9f2c8 },
  workshop: { name: 'The Toy Workshop', backdrop: 'learn/ep/set-workshop.webp', table: 'learn/ep/tex-workshop.webp', star: 'pebbletort', token: 'block',
    tray: { word: 'block box', color: 0xc48a52, rim: 0x86572b }, plate: { word: 'bin', color: 0xe9c27a, rim: 0x9b6b2b }, key: 0xffd49a, sky: 0xffe6c4, ground: 0x6e4a2c, haze: 0xf0c48c },
  garden: { name: 'The Garden Shed', backdrop: 'learn/ep/set-garden.webp', table: 'learn/ep/tex-garden.webp', star: 'fernfox', token: 'flower',
    tray: { word: 'seed tray', color: 0xc8714a, rim: 0x8e4528 }, plate: { word: 'pot', color: 0xcf7650, rim: 0x8e4528 }, key: 0xfff0cc, sky: 0xeaffe6, ground: 0x5c7a3a, haze: 0xe4f3d2 },
  // place value: the Geode Mole's workshop in the Counting Caves (a hundred is a crate of blocks)
  cave: { name: 'The Crystal Cave Workshop', backdrop: 'learn/ep/set-cave.webp', table: 'learn/ep/tex-cave.webp', star: 'geodemole', token: 'block',
    tray: { word: 'block tray', color: 0x8fa6c9, rim: 0x4f6a96 }, plate: { word: 'crate', color: 0xb98a5a, rim: 0x7a5232 }, key: 0xffe2b8, sky: 0xcfe0ff, ground: 0x5a4a6a, haze: 0xc9d6f2 },
};

export type Episode = {
  id: string;
  set: SetId;
  /** the buddy's go at one (it gets it wrong in a way the trick fixes), and the wrong answer it gives */
  teach: { f: Fact; wrong: number; says: string };
  /** a second wrong choice for the "fix it" buttons (default: one off the other side) */
  decoy?: number;
};

const F = (a: number, b: number, op: Fact['op'] = 'x'): Fact => ({ a, b, op });

export const EPISODES: Episode[] = [
  { id: 'count-on', set: 'dock', teach: { f: F(6, 3, '+'), wrong: 8, says: '6 + 3? I count 6, 7, 8... so it\'s 8!' } },
  { id: 'doubles', set: 'kitchen', teach: { f: F(7, 8, '+'), wrong: 14, says: '7 + 8 is a near double. 7 + 7 is 14... so it\'s 14!' } },
  { id: 'make-ten', set: 'kitchen', teach: { f: F(5, 9, '+'), wrong: 15, says: '5 + 9? Plus 10 makes 15. Done: 15!' } },
  { id: 'bridge-ten', set: 'kitchen', teach: { f: F(8, 6, '+'), wrong: 16, says: '8 + 6? Move 2 over to make 10, and 6 more is 16!' } },
  { id: 'count-back', set: 'dock', teach: { f: F(9, 3, '-'), wrong: 7, says: '9 − 3? I count 9, 8, 7... so it\'s 7!' } },
  { id: 'doubles-back', set: 'picnic', teach: { f: F(18, 9, '-'), wrong: 8, says: '18 − 9? 9 + 9 is 18... so it\'s 8!' } },
  { id: 'ten-back', set: 'picnic', teach: { f: F(14, 9, '-'), wrong: 4, says: '14 − 9? Take away 10 first: 4. All done, 4!' } },
  { id: 'think-plus', set: 'garden', teach: { f: F(12, 5, '-'), wrong: 2, says: '12 − 5? 5 and 5 is 10, then 2 more. So it\'s 2!' }, decoy: 6 },
  { id: 'zero-one', set: 'picnic', teach: { f: F(9, 0), wrong: 9, says: '9 × 0? Nothing changes... so 9!' }, decoy: 1 },
  { id: 'times-2', set: 'workshop', teach: { f: F(8, 2), wrong: 10, says: '8 × 2? That\'s 8 + 2... 10!' }, decoy: 18 },
  { id: 'times-10', set: 'workshop', teach: { f: F(7, 10), wrong: 17, says: '7 × 10? Put a 1 on it... 17!' }, decoy: 71 },
  { id: 'times-5', set: 'workshop', teach: { f: F(8, 5), wrong: 80, says: '8 × 5? 8 × 10 is 80... so 80!' }, decoy: 45 },
  { id: 'times-4', set: 'garden', teach: { f: F(6, 4), wrong: 12, says: '6 × 4? Double 6 is 12. So 12!' }, decoy: 22 },
  { id: 'times-3', set: 'garden', teach: { f: F(7, 3), wrong: 14, says: '7 × 3? Double 7 is 14... 14!' }, decoy: 24 },
  { id: 'times-9', set: 'garden', teach: { f: F(6, 9), wrong: 59, says: '6 × 9? 6 × 10 is 60, take away 1: 59!' }, decoy: 56 },
  { id: 'times-6', set: 'workshop', teach: { f: F(7, 6), wrong: 36, says: '7 × 6? 7 × 5 is 35, and 1 more: 36!' }, decoy: 49 },
  { id: 'times-8', set: 'workshop', teach: { f: F(4, 8), wrong: 16, says: '4 × 8? Double is 8, double again is 16. Done: 16!' }, decoy: 36 },
  { id: 'times-7', set: 'workshop', teach: { f: F(3, 7), wrong: 17, says: '3 × 7? 3 × 5 is 15, and 2 more: 17!' }, decoy: 24 },
  { id: 'think-times', set: 'picnic', teach: { f: F(15, 5, '/'), wrong: 5, says: '15 shared into 5 plates? 5 each!' }, decoy: 4 },
  // place value (math/placeLessons.ts)
  { id: 'pv-make-ten', set: 'cave', teach: { f: { a: 10, b: 5, op: '+', text: '1 ten 5 ones' }, wrong: 6, says: '1 ten and 5 ones? 1 and 5 make 6!' }, decoy: 51 },
  { id: 'pv-tens-ones', set: 'cave', teach: { f: { a: 30, b: 4, op: '+', text: '3 tens 4 ones' }, wrong: 7, says: '3 tens and 4 ones? 3 and 4 make 7!' }, decoy: 43 },
  { id: 'pv-big-numbers', set: 'cave', teach: { f: { a: 300, b: 5, op: '+', text: '3 hundreds 5 ones' }, wrong: 35, says: '3 hundreds and 5 ones? A 3 and a 5... 35!' }, decoy: 350 },
  { id: 'pv-add-regroup', set: 'cave', teach: { f: F(38, 25, '+'), wrong: 513, says: '38 + 25? 8 + 5 is 13, and 3 + 2 is 5... 513!' }, decoy: 53 },
  { id: 'pv-sub-regroup', set: 'cave', teach: { f: F(52, 27, '-'), wrong: 35, says: '52 − 27? 7 take away 2 is 5, and 5 take away 2 is 3... 35!' }, decoy: 15 },
  { id: 'pv-rounding', set: 'cave', teach: { f: { a: 47, b: 10, op: '+', text: '47 → nearest 10', ans: 50 }, wrong: 40, says: '47 to the nearest ten? It starts with a 4... 40!' }, decoy: 45 },
];
export const EPISODE: Record<string, Episode> = Object.fromEntries(EPISODES.map(e => [e.id, e]));
export const episodeOf = (id: string): Episode => EPISODE[id] ?? { id, set: 'kitchen', teach: { f: LESSONS.find(l => l.id === id)!.tries[1], wrong: 0, says: '' } };
export const setOf = (id: string) => SETS[episodeOf(id).set];

/** The three answers to pick from when fixing the buddy's mistake: the right one, the buddy's, and one more. */
export function fixChoices(e: Episode): number[] {
  const right = answerOf(e.teach.f), wrong = e.teach.wrong;
  let decoy = e.decoy ?? (wrong < right ? right + (right - wrong) : right - (wrong - right));
  if (decoy === right || decoy === wrong || decoy < 0) decoy = right + 2;
  // a fixed order per episode (not always the right one first)
  const all = [right, wrong, decoy];
  const k = e.id.length % 3;
  return [...all.slice(k), ...all.slice(0, k)];
}

// ---------- what the kid's hands do between two pictures ----------

/** A step's job for the kid:
 *  - place: new counters wait in a basket; drag each to a glowing spot
 *  - move: these counters move (the trick's own move): drag each to a glowing spot
 *  - take: tap these counters to take them away
 *  - hop: tap the glowing number to hop there (one hop at a time)
 *  - tap: tap the glowing group to make it happen (a colour change, like covering half)
 *  - label: tap each glowing spot to see its words (counting the tens: 10, 20, 30...)
 *  - watch: just look and listen
 *  Big jobs (more than `HANDS` counters): the kid does the first few and the rest follow by themselves. */
export type Task =
  | { kind: 'place'; ids: string[]; by: number }
  | { kind: 'move'; ids: string[]; by: number }
  | { kind: 'take'; ids: string[]; by: number }
  | { kind: 'hop'; hops: { a: number; b: number; label: string }[] }
  | { kind: 'tap'; ids: string[] }
  | { kind: 'label'; ids: string[] }
  | { kind: 'watch' };
export const HANDS = 4;
const same = (a: Dot, b: Dot) => Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

export function taskFor(prev: Board | null, next: Board): Task {
  if (!prev) return { kind: 'watch' };
  // hops on the number line: the new ones, in order
  if (next.line && prev.line && next.line.hops.length > prev.line.hops.length && next.line.from === prev.line.from && next.line.to === prev.line.to) {
    return { kind: 'hop', hops: next.line.hops.slice(prev.line.hops.length) };
  }
  // a different kind of picture altogether: just watch it come in
  const kindOf = (b: Board) => (b.line ? 'line' : b.plates.length ? 'plates' : b.frames.length ? `frames${b.frames.length}` : 'dots');
  if (kindOf(prev) !== kindOf(next) && !(kindOf(prev) === 'plates' && next.plates.length)) return { kind: 'watch' };
  const before = new Map(prev.dots.map(d => [d.id, d]));
  const after = new Map(next.dots.map(d => [d.id, d]));
  // new counters (and a "ghost" place filled in counts as new)
  const placed = next.dots.filter(d => d.c !== 'ghost' && !d.out && (!before.has(d.id) || before.get(d.id)!.c === 'ghost')).map(d => d.id);
  // counters that move to a new place
  const moved = next.dots.filter(d => before.has(d.id) && before.get(d.id)!.c !== 'ghost' && !same(before.get(d.id)!, d)).map(d => d.id);
  // counters taken away (gone, or crossed out)
  const taken = prev.dots.filter(d => d.c !== 'ghost' && !d.out && (!after.has(d.id) || after.get(d.id)!.out)).map(d => d.id);
  // counters that only change colour (covering half: to ghost)
  const recolored = next.dots.filter(d => before.has(d.id) && before.get(d.id)!.c !== d.c && same(before.get(d.id)!, d) && before.get(d.id)!.c !== 'ghost').map(d => d.id);
  const by = (n: number) => Math.min(n, n > HANDS ? 3 : n);
  if (placed.length) return { kind: 'place', ids: placed, by: by(placed.length) };
  // the trick's own move is the gold one (Make Ten First: the 2 that fill the ten); the others just shuffle
  if (moved.length) {
    const gold = moved.filter(id => after.get(id)!.c === 'c');
    const ids = gold.length ? gold : moved;
    return { kind: 'move', ids, by: by(ids.length) };
  }
  if (taken.length) return { kind: 'take', ids: taken, by: by(taken.length) };
  if (recolored.length) return { kind: 'tap', ids: recolored };
  // nothing moves, only words appear: tap each one's spot to see it
  const had = new Set(prev.tags.map(t => t.id + t.text));
  const words = next.tags.filter(t => !had.has(t.id + t.text)).map(t => t.id);
  if (words.length && words.length <= 6) return { kind: 'label', ids: words };
  return { kind: 'watch' };
}

/** The words for a task's prompt chip (the voice line says what to do; this is the short reminder). */
export function taskWords(t: Task, setId: SetId, noun?: string): string {
  const s = SETS[setId], thing = noun ?? { cookie: 'cookies', pearl: 'pearls', berry: 'berries', block: 'blocks', flower: 'flowers' }[s.token];
  switch (t.kind) {
    case 'place': return t.ids.length > t.by ? `Drag ${t.by} ${thing} into place, and the rest follow!` : `Drag the ${thing} into the glowing spots`;
    case 'move': return t.ids.length > t.by ? `Drag ${t.by} over, and the rest follow!` : `Drag the glowing ${t.ids.length === 1 ? thing.replace(/s$|ies$/, m => (m === 'ies' ? 'y' : '')) : thing} over`;
    case 'take': return t.ids.length > t.by ? `Tap ${t.by} to take them away, and the rest go too` : `Tap the glowing ${thing} to take them away`;
    case 'hop': return 'Tap the glowing number to hop';
    case 'tap': return 'Tap the glowing ones';
    case 'label': return t.ids.length > 1 ? 'Tap each glowing spot' : 'Tap the glowing spot';
    default: return '';
  }
}

// ---------- one shape for every episode: the fact tricks and the fractions ----------
export type { EpQ } from './fracEpisodes';
/** What the episode plays: its steps, the buddy's mistake, three questions (two turns and the next day's
 *  check), and its card. */
export type EpLesson = {
  id: string; title: string; blurb: string; color: string; set: SetId; star?: GlimmerId;
  steps: Step[];
  tries: [EpQ, EpQ, EpQ];
  teach: { q: EpQ; wrong: string; says: string; choices: string[]; fixed: string };
  /** the card's picture: the lesson's own board, or a painted picture */
  cover: Board | null; art: string | null;
  /** what the counters are called in the prompts ("slices") */
  noun?: string;
};
const FRAC_COLOR = '#ef8a4b';
const NOUN: Record<string, string> = { 'frac-one-piece': 'squares', 'frac-take-away': 'squares', 'frac-times': 'squares', 'frac-of-a-set': 'cupcakes' };
/** How hard a trick's "your turn" questions should be for this child: their strand's ability, pitched to
 *  be easy (about 90% right: the idea is brand new), as a rung. Nothing for the fraction episodes (their
 *  questions come with their own painted pictures). */
export function teachRung(h: AbilityHome, id: string, now = Date.now()): number | undefined {
  const l = LESSON[id];
  return l && !l.area ? rungFor(thetaOf(h, STRAND_SKILL[l.op], now), TARGET.teach) : undefined;
}
/** A trick's three tries at a rung: the lesson's own (chosen to show the trick plainly) for children on
 *  the gentle rungs; from rung 3 the second try and the next day's check are facts of the same trick at
 *  the child's rung (the same picture and the same help, bigger numbers). The first stays the lesson's. */
function pitchedTries(l: Lesson, rung?: number): Fact[] {
  if (!rung || rung <= 2 || l.area) return l.tries;
  const groups = [...new Set(l.regions.flatMap(r => MATH_REGION[r]?.groups ?? []))];
  const own = new Set(l.tries.map(factId));
  const cands = groups.flatMap(groupFacts).filter(f => !isRuleFact(f) && !own.has(factId(f)) && lessonForFact(f).id === l.id && factRung(f) <= rung);
  if (cands.length < 2) return l.tries;
  const top = Math.max(...cands.map(factRung)), near = cands.filter(f => factRung(f) >= top - 1).sort((a, b) => factRung(b) - factRung(a) || answerOf(b) - answerOf(a));
  return [l.tries[0], near[0], near[Math.min(near.length - 1, 1 + (near.length >> 1))]];
}
/** The episode for a lesson id: a fact trick (learn.ts) or a fraction idea (fracEpisodes.ts); `rung`
 *  pitches a trick's own tries for the child (teachRung). */
export function epLesson(id: string, rung?: number): EpLesson | null {
  const f = FRAC_LESSON[id];
  if (f) {
    const all = [f.teach.q.ans, f.teach.wrong, f.teach.decoy], k = f.id.length % 3;
    return { id, title: f.title, blurb: f.blurb, color: FRAC_COLOR, set: f.set, star: f.star, steps: f.steps, tries: f.tries,
      teach: { q: f.teach.q, wrong: f.teach.wrong, says: f.teach.says, choices: [...all.slice(k), ...all.slice(0, k)], fixed: f.teach.fixed },
      cover: null, art: f.art, noun: NOUN[id] ?? 'slices' };
  }
  const l = LESSON[id];
  if (!l) return null;
  const e = episodeOf(id);
  const q = (fact: Fact): EpQ => { const hint = hintFor(l, fact); return { text: askText(fact), ans: String(answerOf(fact)), input: 'num', hint, hidden: hideAnswer(hint, fact), pic: l.pic(fact) }; };
  const tries = pitchedTries(l, rung);
  return { id, title: l.title, blurb: l.blurb, color: STRAND[l.op].color, set: e.set, steps: l.steps, tries: [q(tries[0]), q(tries[1]), q(tries[2])],
    teach: { q: q(e.teach.f), wrong: String(e.teach.wrong), says: e.teach.says, choices: fixChoices(e).map(String), fixed: `Oops! ${hintFor(l, e.teach.f)} Thank you!` },
    cover: coverOf(l), art: null };
}
export const isEpisode = (id: string) => !!FRAC_LESSON[id] || !!LESSON[id];

/** The lessons in order, with their episode. */
export const lessonWithEpisode = (l: Lesson) => ({ lesson: l, ep: episodeOf(l.id), set: setOf(l.id) });
