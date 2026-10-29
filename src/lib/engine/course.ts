// The course: seven regions shaped like the keyboard. Each new pair of keys gets a lesson of its
// own that uses only those two keys, so they're mastered before anything else joins in; then a
// "mix" lesson puts them together with everything learned before. Letters and row punctuation are
// taught by physical key (so every layout gets them in the right order); digits, capitals and
// symbols are taught by character.

import type { Code, Layout } from './layouts';
import { LEFT_FINGERS } from './layouts';

export type RegionId = 'village' | 'treetops' | 'burrows' | 'cliffs' | 'ridge' | 'shores' | 'road';
/** drill: only the lesson's new keys; mix: the last few new keys with everything known so far */
export type LessonKind = 'drill' | 'mix' | 'intro' | 'words' | 'sentences' | 'checkpoint' | 'review' | 'final' | 'story' | 'facts' | 'weak' | 'sprint' | 'custom';

export type Lesson = {
  id: string;
  region: RegionId;
  n: number; // 1-based within region
  title: string;
  kind: LessonKind;
  codes?: Code[]; // new physical keys
  chars?: string[]; // new characters (digits, symbols)
  shift?: 'right' | 'left'; // capitals for letters typed by this hand
  /** only the capitals of these keys (a Shift lesson split by row); all of the hand's when missing */
  shiftCodes?: Code[];
  /** mix lessons: the keys to practise most (the newest ones) */
  focus?: Code[];
  /** mix lessons taught by character (digits) */
  focusChars?: string[];
  pool?: string; // sentence pool id
  len: number; // target characters for kids (grown-ups get more)
  speed: number; // kids wpm for the second star
  pass: number; // accuracy needed to pass (0..1)
  practice?: boolean; // Open Road modes
  requires?: string; // lesson that must be passed first (Open Road)
  blurb?: string;
};

export type Region = {
  id: RegionId;
  name: string;
  blurb: string;
  lessons: Lesson[];
};

function L(region: RegionId, n: number, title: string, kind: LessonKind, rest: Partial<Lesson> = {}): Lesson {
  return { id: `${region}-${n}`, region, n, title, kind, len: 90, speed: 10, pass: 0.9, ...rest };
}
const D = (region: RegionId, n: number, a: string, b: string, codes: Code[], rest: Partial<Lesson> = {}) =>
  L(region, n, `${a} and ${b}`, 'drill', { codes, len: 90, speed: 7, pass: 0.85, ...rest });
const M = (region: RegionId, n: number, title: string, focus: Code[], rest: Partial<Lesson> = {}) =>
  L(region, n, title, 'mix', { focus, len: 96, speed: 8, pass: 0.85, ...rest });
/** A region's review: everything learned so far, older keys and known capitals, digits and punctuation
 * mixed back in (new lessons get ids of their own so saved progress keeps its meaning). */
const R = (region: RegionId, n: number, title: string, rest: Partial<Lesson> = {}) =>
  L(region, n, title, 'review', { id: `${region}-rev`, len: 240, speed: 13, pass: 0.9, blurb: 'Everything so far, mixed together.', ...rest });
// the Shift lessons, split by hand and row
const RH_HOME: Code[] = ['KeyH', 'KeyJ', 'KeyK', 'KeyL'];
const RH_REACH: Code[] = ['KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'KeyN', 'KeyM'];
const LH_HOME: Code[] = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'];
const LH_REACH: Code[] = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB'];

export const REGIONS: Region[] = [
  {
    id: 'village', name: 'Home Row Island', blurb: 'Where every finger lives.',
    lessons: [
      D('village', 1, 'F', 'J', ['KeyF', 'KeyJ', 'Space'], { blurb: 'Find the bumps on F and J. That is home base.' }),
      D('village', 2, 'D', 'K', ['KeyD', 'KeyK'], {}),
      M('village', 3, 'F J D K', ['KeyD', 'KeyK'], { blurb: 'Four keys together. Pointer and middle fingers.' }),
      D('village', 4, 'S', 'L', ['KeyS', 'KeyL'], {}),
      D('village', 5, 'A', ';', ['KeyA', 'Semicolon'], {}),
      M('village', 6, 'The Whole Home Row', ['KeyS', 'KeyL', 'KeyA', 'Semicolon'], { len: 80, speed: 9 }),
      D('village', 7, 'G', 'H', ['KeyG', 'KeyH'], { blurb: 'Pointer fingers reach in for G and H, then hop back home.' }),
      L('village', 8, 'Home Row Words', 'words', { len: 90, speed: 10, pass: 0.88 }),
      L('village', 9, 'Island Parade', 'checkpoint', { pool: 'home', len: 110, speed: 10, pass: 0.9, blurb: 'Show the whole island what you can do!' }),
    ],
  },
  {
    id: 'treetops', name: 'Top Row Treetops', blurb: 'Reach up into the leaves.',
    lessons: [
      D('treetops', 1, 'E', 'I', ['KeyE', 'KeyI'], {}),
      D('treetops', 2, 'R', 'U', ['KeyR', 'KeyU'], {}),
      M('treetops', 3, 'E I R U', ['KeyE', 'KeyI', 'KeyR', 'KeyU'], { len: 80, speed: 9 }),
      D('treetops', 4, 'T', 'Y', ['KeyT', 'KeyY'], {}),
      D('treetops', 5, 'W', 'O', ['KeyW', 'KeyO'], {}),
      M('treetops', 6, 'T Y W O', ['KeyT', 'KeyY', 'KeyW', 'KeyO'], { len: 84, speed: 10 }),
      D('treetops', 7, 'Q', 'P', ['KeyQ', 'KeyP'], {}),
      L('treetops', 8, 'Treetop Words', 'words', { len: 100, speed: 12 }),
      L('treetops', 9, 'Branch Sentences', 'sentences', { pool: 'top', len: 110, speed: 12 }),
      R('treetops', 10, 'Treetop Review'),
      L('treetops', 11, 'Canopy Run', 'checkpoint', { id: 'treetops-10', pool: 'top', len: 130, speed: 13, blurb: 'A race through the whole treetop trail.' }),
    ],
  },
  {
    id: 'burrows', name: 'Bottom Row Burrows', blurb: 'Down into the cozy tunnels.',
    lessons: [
      D('burrows', 1, 'C', ',', ['KeyC', 'Comma'], {}),
      D('burrows', 2, 'V', 'M', ['KeyV', 'KeyM'], {}),
      M('burrows', 3, 'C , V M', ['KeyC', 'Comma', 'KeyV', 'KeyM'], { len: 84, speed: 11 }),
      D('burrows', 4, 'B', 'N', ['KeyB', 'KeyN'], {}),
      D('burrows', 5, 'X', '.', ['KeyX', 'Period'], {}),
      M('burrows', 6, 'B N X .', ['KeyB', 'KeyN', 'KeyX', 'Period'], { len: 90, speed: 12 }),
      D('burrows', 7, 'Z', '/', ['KeyZ', 'Slash'], {}),
      L('burrows', 8, 'Burrow Words', 'words', { len: 120, speed: 14 }),
      L('burrows', 9, 'Tunnel Talk', 'sentences', { pool: 'bottom', len: 130, speed: 14 }),
      R('burrows', 10, 'Burrow Review'),
      L('burrows', 11, 'Lantern Run', 'checkpoint', { id: 'burrows-10', pool: 'bottom', len: 150, speed: 15, blurb: 'Every letter, all the way through the tunnels.' }),
    ],
  },
  {
    id: 'cliffs', name: 'Capital Cliffs', blurb: 'Big letters need the Shift key.',
    lessons: [
      L('cliffs', 1, 'Big H J K L', 'intro', { shift: 'right', shiftCodes: RH_HOME, len: 100, speed: 12, blurb: 'Hold Shift with your LEFT pinky, then type a right-hand home key.' }),
      L('cliffs', 2, 'Big Letters, Right Reach', 'intro', { id: 'cliffs-1b', shift: 'right', shiftCodes: RH_REACH, len: 110, speed: 12, blurb: 'Left pinky on Shift, right hand reaches up and down.' }),
      L('cliffs', 3, 'Big A S D F G', 'intro', { id: 'cliffs-2', shift: 'left', shiftCodes: LH_HOME, len: 100, speed: 12, blurb: 'Hold Shift with your RIGHT pinky, then type a left-hand home key.' }),
      L('cliffs', 4, 'Big Letters, Left Reach', 'intro', { id: 'cliffs-2b', shift: 'left', shiftCodes: LH_REACH, len: 110, speed: 12, blurb: 'Right pinky on Shift, left hand reaches up and down.' }),
      L('cliffs', 5, 'Names and Places', 'words', { id: 'cliffs-3', len: 120, speed: 14 }),
      L('cliffs', 6, 'Cliff Sentences', 'sentences', { id: 'cliffs-4', pool: 'capitals', len: 140, speed: 15 }),
      L('cliffs', 7, 'Apostrophes', 'intro', { id: 'cliffs-5', codes: ['Quote'], len: 100, speed: 13, pass: 0.85 }),
      R('cliffs', 8, 'Cliff Review'),
      L('cliffs', 9, 'Summit Run', 'checkpoint', { id: 'cliffs-6', pool: 'capitals', len: 160, speed: 16 }),
    ],
  },
  {
    id: 'ridge', name: 'Number Ridge', blurb: 'Climb the top row of numbers.',
    lessons: [
      L('ridge', 1, '4 and 5', 'drill', { chars: ['4', '5'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 2, '6 and 7', 'drill', { chars: ['6', '7'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 3, '4 5 6 7', 'mix', { focusChars: ['4', '5', '6', '7'], len: 80, speed: 10 }),
      L('ridge', 4, '3 and 8', 'drill', { chars: ['3', '8'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 5, '2 and 9', 'drill', { chars: ['2', '9'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 6, '1 and 0', 'drill', { chars: ['1', '0'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 7, 'Counting Sentences', 'sentences', { pool: 'numbers', len: 140, speed: 14 }),
      R('ridge', 8, 'Ridge Review', { speed: 12 }),
      L('ridge', 9, 'Peak Run', 'checkpoint', { id: 'ridge-8', pool: 'numbers', len: 160, speed: 15 }),
    ],
  },
  {
    id: 'shores', name: 'Symbol Shores', blurb: 'Question marks, quotes and shells.',
    lessons: [
      L('shores', 1, '? and !', 'drill', { chars: ['?', '!'], len: 56, speed: 8, pass: 0.85 }),
      L('shores', 2, 'Quotes and Dashes', 'intro', { chars: ['"', '-'], len: 100, speed: 12 }),
      L('shores', 3, 'Parentheses and Colons', 'intro', { chars: ['(', ')', ':'], len: 100, speed: 12 }),
      L('shores', 4, '@ # & %', 'intro', { chars: ['@', '#', '&', '%'], len: 100, speed: 12 }),
      L('shores', 5, 'Shell Sentences', 'sentences', { pool: 'symbols', len: 140, speed: 14 }),
      R('shores', 6, 'Shore Review'),
      L('shores', 7, 'Lighthouse Run', 'checkpoint', { id: 'shores-6', pool: 'symbols', len: 170, speed: 15 }),
      // the end of the course: two minutes of real reading, a stated target, a certificate
      L('shores', 8, 'Graduation Test', 'final', { id: 'shores-grad', pool: 'stories-kids', len: 900, speed: 15, pass: 0.93, blurb: 'Two minutes of real typing. Reach the target and you graduate!' }),
    ],
  },
  {
    id: 'road', name: 'The Open Road', blurb: 'Free play: stories, facts, sprints and your own words.',
    lessons: [
      L('road', 1, 'Story Time', 'story', { pool: 'stories-kids', len: 200, speed: 15, practice: true, requires: 'cliffs-6', blurb: 'A little adventure to type.' }),
      L('road', 2, 'Fun Facts', 'facts', { pool: 'facts-kids', len: 180, speed: 15, practice: true, requires: 'cliffs-6', blurb: 'Type something amazing.' }),
      L('road', 3, 'Tricky Keys', 'weak', { len: 140, speed: 14, practice: true, requires: 'village-9', blurb: 'Made just for you, from the keys that trip you up.' }),
      L('road', 4, 'Speed Sprint', 'sprint', { len: 400, speed: 16, practice: true, requires: 'village-9', blurb: 'One minute. How far can you go?' }),
      L('road', 5, 'My Words', 'custom', { len: 200, speed: 12, practice: true, requires: 'burrows-10', blurb: 'Spelling list? Paste it in and practice it.' }),
    ],
  },
];

export const ALL_LESSONS: Lesson[] = REGIONS.flatMap(r => r.lessons);
export const LESSON: Record<string, Lesson> = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l]));
export const REGION: Record<RegionId, Region> = Object.fromEntries(REGIONS.map(r => [r.id, r])) as Record<RegionId, Region>;

export function lessonIndex(id: string): number { return ALL_LESSONS.findIndex(l => l.id === id); }

/** How the buddy travels in a typing lesson: the trail with its speed rides (walk ... rocket), or a
 *  climb up a cliff, a swim across a bay or a sled run. Every other lesson in a region is on the trail,
 *  starting with the first; the ones between go round the three courses, starting with the one that
 *  suits the region (the Cliffs climb first, the snowy Ridge sleds, the Shores swim). The region's big
 *  race, the Graduation Test and the Open Road stay on the trail. */
export type TypingMove = 'run' | 'climb' | 'slide' | 'swim';
const COURSES: TypingMove[] = ['climb', 'swim', 'slide'];
const FIRST_COURSE: Record<RegionId, TypingMove> = { village: 'climb', treetops: 'swim', burrows: 'slide', cliffs: 'climb', ridge: 'slide', shores: 'swim', road: 'climb' };
const onTrail = (l: Lesson) => l.practice || l.kind === 'checkpoint' || l.kind === 'final';
export function lessonMove(l: Lesson): TypingMove {
  if (onTrail(l)) return 'run';
  const k = (REGION[l.region]?.lessons ?? []).filter(x => !onTrail(x)).findIndex(x => x.id === l.id);
  if (k < 0 || k % 2 === 0) return 'run';
  return COURSES[(COURSES.indexOf(FIRST_COURSE[l.region]) + (k - 1) / 2) % 3];
}
export const MOVE_WORD: Record<TypingMove, string> = { run: 'Run', climb: 'Climb', swim: 'Swim', slide: 'Sled' };
export const MOVE_ICON: Record<TypingMove, string> = { run: '🏃', climb: '🧗', swim: '🏊', slide: '🛷' };

const LETTER = /\p{L}/u;

/** Characters a lesson introduces, on this layout. */
export function newCharsFor(lesson: Lesson, layout: Layout): string[] {
  const out: string[] = [];
  for (const code of lesson.codes ?? []) {
    if (code === 'Space') { out.push(' '); continue; }
    const k = layout.byCode.get(code);
    if (k && k.base && !layout.dead.has(k.base)) out.push(k.base);
  }
  for (const ch of lesson.chars ?? []) if (layout.chars.has(ch)) out.push(ch);
  if (lesson.shift) for (const ch of capitalsOf(lesson, layout)) if (known0(lesson, layout).has(ch.toLowerCase())) out.push(ch);
  return out;
}

/** The capital letters a Shift lesson teaches on this layout: its keys' shifted letters, or every
 * capital typed by that hand. */
function capitalsOf(lesson: Lesson, layout: Layout): string[] {
  const out: string[] = [];
  if (lesson.shiftCodes) {
    for (const code of lesson.shiftCodes) { const k = layout.byCode.get(code); if (k && LETTER.test(k.shift) && k.shift.toLowerCase() !== k.shift) out.push(k.shift); }
    return out;
  }
  const wantLeft = lesson.shift === 'left';
  for (const [ch, info] of layout.chars) if (info.shift && LETTER.test(ch) && ch.toLowerCase() !== ch && LEFT_FINGERS.has(info.finger) === wantLeft) out.push(ch);
  return out;
}

/** A lesson's name on this layout: lessons named after their keys use the keys this keyboard really has. */
export function lessonTitle(lesson: Lesson, layout: Layout): string {
  if (layout.id === 'qwerty') return lesson.title;
  const keys = (codes?: Code[]) => (codes ?? []).filter(c => c !== 'Space').map(c => layout.byCode.get(c)?.base ?? '').filter(Boolean).map(ch => ch.toUpperCase());
  if (lesson.kind === 'drill' && lesson.codes) { const k = keys(lesson.codes); if (k.length === 2) return `${k[0]} and ${k[1]}`; }
  if (lesson.kind === 'mix' && lesson.focus && /^([^ ]+ ){1,4}[^ ]+$/.test(lesson.title) && lesson.title.length <= 9) return keys(lesson.focus).join(' ');
  if (lesson.shiftCodes && lesson.shiftCodes.length <= 5) return 'Big ' + keys(lesson.shiftCodes).join(' ');
  return lesson.title;
}

// letters known before a lesson, used when picking which capitals to teach
function known0(lesson: Lesson, layout: Layout): Set<string> {
  const idx = lessonIndex(lesson.id);
  return knownChars(ALL_LESSONS[Math.max(0, idx - 1)].id, layout);
}

const knownCache = new Map<string, Set<string>>();

/** Every character the player has met up to and including this lesson. */
export function knownChars(lessonId: string, layout: Layout): Set<string> {
  const key = layout.id + ':' + lessonId;
  const hit = knownCache.get(key);
  if (hit) return hit;
  const idx = lessonIndex(lessonId);
  const set = new Set<string>([' ']);
  for (let i = 0; i <= idx; i++) {
    const l = ALL_LESSONS[i];
    if (l.region === 'road') continue;
    for (const code of l.codes ?? []) {
      const k = layout.byCode.get(code);
      if (k && k.base && !layout.dead.has(k.base)) set.add(k.base);
    }
    for (const ch of l.chars ?? []) if (layout.chars.has(ch)) set.add(ch);
    if (l.shift) for (const ch of capitalsOf(l, layout)) if (set.has(ch.toLowerCase())) set.add(ch);
  }
  knownCache.set(key, set);
  return set;
}
