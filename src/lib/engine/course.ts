// The course: seven regions shaped like the keyboard. Each new pair of keys gets a lesson of its
// own that uses only those two keys, so they're mastered before anything else joins in; then a
// "mix" lesson puts them together with everything learned before. Letters and row punctuation are
// taught by physical key (so every layout gets them in the right order); digits, capitals and
// symbols are taught by character.

import type { Code, Layout } from './layouts';
import { LEFT_FINGERS } from './layouts';

export type RegionId = 'village' | 'treetops' | 'burrows' | 'cliffs' | 'ridge' | 'shores' | 'road';
/** drill: only the lesson's new keys; mix: the last few new keys with everything known so far */
export type LessonKind = 'drill' | 'mix' | 'intro' | 'words' | 'sentences' | 'checkpoint' | 'story' | 'facts' | 'weak' | 'sprint' | 'custom';

export type Lesson = {
  id: string;
  region: RegionId;
  n: number; // 1-based within region
  title: string;
  kind: LessonKind;
  codes?: Code[]; // new physical keys
  chars?: string[]; // new characters (digits, symbols)
  shift?: 'right' | 'left'; // capitals for letters typed by this hand
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
  /** the coach's spoken intro (clips in public/voice are named for v1's lessons) */
  voice?: string;
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

export const REGIONS: Region[] = [
  {
    id: 'village', name: 'Home Row Island', blurb: 'Where every finger lives.',
    lessons: [
      D('village', 1, 'F', 'J', ['KeyF', 'KeyJ', 'Space'], { voice: 'lesson.village-1', blurb: 'Find the bumps on F and J. That is home base.' }),
      D('village', 2, 'D', 'K', ['KeyD', 'KeyK'], { voice: 'lesson.village-2' }),
      M('village', 3, 'F J D K', ['KeyD', 'KeyK'], { blurb: 'Four keys together. Pointer and middle fingers.' }),
      D('village', 4, 'S', 'L', ['KeyS', 'KeyL'], { voice: 'lesson.village-3' }),
      D('village', 5, 'A', ';', ['KeyA', 'Semicolon'], { voice: 'lesson.village-4' }),
      M('village', 6, 'The Whole Home Row', ['KeyS', 'KeyL', 'KeyA', 'Semicolon'], { len: 80, speed: 9, voice: 'lesson.village-5' }),
      D('village', 7, 'G', 'H', ['KeyG', 'KeyH'], { voice: 'lesson.village-6', blurb: 'Pointer fingers reach in for G and H, then hop back home.' }),
      L('village', 8, 'Home Row Words', 'words', { len: 90, speed: 10, pass: 0.88, voice: 'lesson.village-7' }),
      L('village', 9, 'Island Parade', 'checkpoint', { pool: 'home', len: 110, speed: 10, pass: 0.9, voice: 'lesson.village-8', blurb: 'Show the whole island what you can do!' }),
    ],
  },
  {
    id: 'treetops', name: 'Top Row Treetops', blurb: 'Reach up into the leaves.',
    lessons: [
      D('treetops', 1, 'E', 'I', ['KeyE', 'KeyI'], { voice: 'lesson.treetops-1' }),
      D('treetops', 2, 'R', 'U', ['KeyR', 'KeyU'], { voice: 'lesson.treetops-2' }),
      M('treetops', 3, 'E I R U', ['KeyE', 'KeyI', 'KeyR', 'KeyU'], { len: 80, speed: 9 }),
      D('treetops', 4, 'T', 'Y', ['KeyT', 'KeyY'], { voice: 'lesson.treetops-3' }),
      D('treetops', 5, 'W', 'O', ['KeyW', 'KeyO'], { voice: 'lesson.treetops-4' }),
      M('treetops', 6, 'T Y W O', ['KeyT', 'KeyY', 'KeyW', 'KeyO'], { len: 84, speed: 10 }),
      D('treetops', 7, 'Q', 'P', ['KeyQ', 'KeyP'], { voice: 'lesson.treetops-5' }),
      L('treetops', 8, 'Treetop Words', 'words', { len: 100, speed: 12, voice: 'lesson.treetops-6' }),
      L('treetops', 9, 'Branch Sentences', 'sentences', { pool: 'top', len: 110, speed: 12, voice: 'lesson.treetops-7' }),
      L('treetops', 10, 'Canopy Run', 'checkpoint', { pool: 'top', len: 130, speed: 13, voice: 'lesson.treetops-9', blurb: 'A race through the whole treetop trail.' }),
    ],
  },
  {
    id: 'burrows', name: 'Bottom Row Burrows', blurb: 'Down into the cozy tunnels.',
    lessons: [
      D('burrows', 1, 'C', ',', ['KeyC', 'Comma'], { voice: 'lesson.burrows-1' }),
      D('burrows', 2, 'V', 'M', ['KeyV', 'KeyM'], { voice: 'lesson.burrows-2' }),
      M('burrows', 3, 'C , V M', ['KeyC', 'Comma', 'KeyV', 'KeyM'], { len: 84, speed: 11 }),
      D('burrows', 4, 'B', 'N', ['KeyB', 'KeyN'], { voice: 'lesson.burrows-3' }),
      D('burrows', 5, 'X', '.', ['KeyX', 'Period'], { voice: 'lesson.burrows-4' }),
      M('burrows', 6, 'B N X .', ['KeyB', 'KeyN', 'KeyX', 'Period'], { len: 90, speed: 12 }),
      D('burrows', 7, 'Z', '/', ['KeyZ', 'Slash'], { voice: 'lesson.burrows-5' }),
      L('burrows', 8, 'Burrow Words', 'words', { len: 120, speed: 14, voice: 'lesson.burrows-6' }),
      L('burrows', 9, 'Tunnel Talk', 'sentences', { pool: 'bottom', len: 130, speed: 14, voice: 'lesson.burrows-7' }),
      L('burrows', 10, 'Lantern Run', 'checkpoint', { pool: 'bottom', len: 150, speed: 15, voice: 'lesson.burrows-8', blurb: 'Every letter, all the way through the tunnels.' }),
    ],
  },
  {
    id: 'cliffs', name: 'Capital Cliffs', blurb: 'Big letters need the Shift key.',
    lessons: [
      L('cliffs', 1, 'Big Letters, Right Hand', 'intro', { shift: 'right', len: 100, speed: 13, voice: 'lesson.cliffs-1', blurb: 'Hold Shift with your LEFT pinky and type a right-hand letter.' }),
      L('cliffs', 2, 'Big Letters, Left Hand', 'intro', { shift: 'left', len: 100, speed: 13, voice: 'lesson.cliffs-2', blurb: 'Hold Shift with your RIGHT pinky and type a left-hand letter.' }),
      L('cliffs', 3, 'Names and Places', 'words', { len: 120, speed: 14, voice: 'lesson.cliffs-3' }),
      L('cliffs', 4, 'Cliff Sentences', 'sentences', { pool: 'capitals', len: 140, speed: 15, voice: 'lesson.cliffs-4' }),
      D('cliffs', 5, "'", '"', ['Quote'], { title: 'Apostrophes', kind: 'intro', len: 100, speed: 13, voice: 'lesson.cliffs-5' }),
      L('cliffs', 6, 'Summit Run', 'checkpoint', { pool: 'capitals', len: 160, speed: 16, voice: 'lesson.cliffs-6' }),
    ],
  },
  {
    id: 'ridge', name: 'Number Ridge', blurb: 'Climb the top row of numbers.',
    lessons: [
      L('ridge', 1, '4 and 5', 'drill', { chars: ['4', '5'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 2, '6 and 7', 'drill', { chars: ['6', '7'], len: 56, speed: 8, pass: 0.85 }),
      L('ridge', 3, '4 5 6 7', 'mix', { focusChars: ['4', '5', '6', '7'], len: 80, speed: 10, voice: 'lesson.ridge-1' }),
      L('ridge', 4, '3 and 8', 'drill', { chars: ['3', '8'], len: 56, speed: 8, pass: 0.85, voice: 'lesson.ridge-2' }),
      L('ridge', 5, '2 and 9', 'drill', { chars: ['2', '9'], len: 56, speed: 8, pass: 0.85, voice: 'lesson.ridge-3' }),
      L('ridge', 6, '1 and 0', 'drill', { chars: ['1', '0'], len: 56, speed: 8, pass: 0.85, voice: 'lesson.ridge-4' }),
      L('ridge', 7, 'Counting Sentences', 'sentences', { pool: 'numbers', len: 140, speed: 14, voice: 'lesson.ridge-5' }),
      L('ridge', 8, 'Peak Run', 'checkpoint', { pool: 'numbers', len: 160, speed: 15, voice: 'lesson.ridge-6' }),
    ],
  },
  {
    id: 'shores', name: 'Symbol Shores', blurb: 'Question marks, quotes and shells.',
    lessons: [
      L('shores', 1, '? and !', 'drill', { chars: ['?', '!'], len: 56, speed: 8, pass: 0.85, voice: 'lesson.shores-1' }),
      L('shores', 2, 'Quotes and Dashes', 'intro', { chars: ['"', '-'], len: 100, speed: 12, voice: 'lesson.shores-2' }),
      L('shores', 3, 'Brackets and Colons', 'intro', { chars: ['(', ')', ':'], len: 100, speed: 12, voice: 'lesson.shores-3' }),
      L('shores', 4, '@ # & %', 'intro', { chars: ['@', '#', '&', '%'], len: 100, speed: 12, voice: 'lesson.shores-4' }),
      L('shores', 5, 'Shell Sentences', 'sentences', { pool: 'symbols', len: 140, speed: 14, voice: 'lesson.shores-5' }),
      L('shores', 6, 'Lighthouse Run', 'checkpoint', { pool: 'symbols', len: 170, speed: 15, voice: 'lesson.shores-6' }),
    ],
  },
  {
    id: 'road', name: 'The Open Road', blurb: 'Free play: stories, facts, sprints and your own words.',
    lessons: [
      L('road', 1, 'Story Time', 'story', { pool: 'stories-kids', len: 200, speed: 15, practice: true, requires: 'cliffs-6', blurb: 'A little adventure to type.' }),
      L('road', 2, 'Fun Facts', 'facts', { pool: 'facts-kids', len: 180, speed: 15, practice: true, requires: 'cliffs-6', voice: 'lesson.road-2', blurb: 'Type something amazing.' }),
      L('road', 3, 'Tricky Keys', 'weak', { len: 140, speed: 14, practice: true, requires: 'village-9', voice: 'lesson.road-3', blurb: 'Made just for you, from the keys that trip you up.' }),
      L('road', 4, 'Speed Sprint', 'sprint', { len: 400, speed: 16, practice: true, requires: 'village-9', voice: 'lesson.road-4', blurb: 'One minute. How far can you go?' }),
      L('road', 5, 'My Words', 'custom', { len: 200, speed: 12, practice: true, requires: 'burrows-10', voice: 'lesson.road-5', blurb: 'Spelling list? Paste it in and practice it.' }),
    ],
  },
];

export const ALL_LESSONS: Lesson[] = REGIONS.flatMap(r => r.lessons);
export const LESSON: Record<string, Lesson> = Object.fromEntries(ALL_LESSONS.map(l => [l.id, l]));
export const REGION: Record<RegionId, Region> = Object.fromEntries(REGIONS.map(r => [r.id, r])) as Record<RegionId, Region>;

export function lessonIndex(id: string): number { return ALL_LESSONS.findIndex(l => l.id === id); }

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
  if (lesson.shift) {
    const wantLeft = lesson.shift === 'left';
    for (const [ch, info] of layout.chars) {
      if (!info.shift || !LETTER.test(ch) || ch.toLowerCase() === ch) continue;
      if (LEFT_FINGERS.has(info.finger) === wantLeft && known0(lesson, layout).has(ch.toLowerCase())) out.push(ch);
    }
  }
  return out;
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
    if (l.shift) {
      const wantLeft = l.shift === 'left';
      for (const [ch, info] of layout.chars) {
        if (info.shift && LETTER.test(ch) && ch.toLowerCase() !== ch && LEFT_FINGERS.has(info.finger) === wantLeft && set.has(ch.toLowerCase())) set.add(ch);
      }
    }
  }
  knownCache.set(key, set);
  return set;
}
