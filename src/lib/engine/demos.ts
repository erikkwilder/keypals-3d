// Finger demos: what the coach says and what the hands do, one step per spoken line.
// The home-row tutorial plays before the first lesson; a reach demo plays before lessons
// that bring new keys.

import type { Finger } from '../art/cast';
import type { Layout } from './layouts';
import { shiftFor } from './layouts';
import { newCharsFor, type Lesson } from './course';

export type DemoKey = { code: string; finger: Finger; ch: string; shift: 'ShiftLeft' | 'ShiftRight' | null };
export type DemoAct =
  | { a: 'enter' }
  | { a: 'float' }
  | { a: 'land'; fingers: Finger[] }
  | { a: 'thumbs' }
  | { a: 'wave' }
  | { a: 'pals' }
  | { a: 'blind'; keys: DemoKey[] }
  | { a: 'cheer' }
  | { a: 'reach'; keys: DemoKey[] };
export type DemoStep = { line: string; act: DemoAct };

/** Where each finger rests (physical key codes, the same on every layout). */
export const HOME_CODE: Record<Exclude<Finger, 'TH'>, string> = {
  LP: 'KeyA', LR: 'KeyS', LM: 'KeyD', LI: 'KeyF', RI: 'KeyJ', RM: 'KeyK', RR: 'KeyL', RP: 'Semicolon',
};
const LEFT: Finger[] = ['LP', 'LR', 'LM', 'LI'];
const RIGHT: Finger[] = ['RI', 'RM', 'RR', 'RP'];

function keyOf(layout: Layout, ch: string): DemoKey | null {
  if (ch === ' ') return { code: 'Space', finger: 'TH', ch: ' ', shift: null };
  const info = layout.chars.get(ch);
  if (!info) return null;
  return { code: info.code, finger: info.finger, ch, shift: info.shift ? shiftFor(layout, ch) : null };
}

export function homeDemo(layout: Layout): DemoStep[] {
  const k = (code: string) => {
    const d = layout.byCode.get(code)!;
    return { code, finger: d.finger, ch: d.base, shift: null } as DemoKey;
  };
  return [
    { line: 'coach.home.1', act: { a: 'enter' } },
    { line: 'coach.home.2', act: { a: 'float' } },
    { line: 'coach.home.3', act: { a: 'land', fingers: ['LI'] } },
    { line: 'coach.home.4', act: { a: 'land', fingers: ['LI', 'RI'] } },
    { line: 'coach.home.5', act: { a: 'land', fingers: [...LEFT, ...RIGHT] } },
    { line: 'coach.home.6', act: { a: 'thumbs' } },
    { line: 'coach.home.7', act: { a: 'wave' } },
    { line: 'coach.home.8', act: { a: 'pals' } },
    { line: 'coach.home.9', act: { a: 'blind', keys: [k('KeyF'), k('KeyJ'), k('KeyD'), k('KeyK')] } },
    { line: 'coach.home.10', act: { a: 'cheer' } },
  ];
}

/** Which way a finger travels from home to reach a key. */
export function reachDir(layout: Layout, key: DemoKey): 'home' | 'up' | 'down' | 'num' | 'in' {
  if (key.finger === 'TH') return 'home';
  const row = layout.byCode.get(key.code)?.row ?? 2;
  if (row === 0) return 'num';
  if (row === 1) return 'up';
  if (row === 3) return 'down';
  if (key.code === HOME_CODE[key.finger as Exclude<Finger, 'TH'>]) return 'home';
  return key.finger === 'LI' || key.finger === 'RI' ? 'in' : 'home';
}

/** The keys a lesson brings in, one per physical key, at most six. */
export function demoKeys(lesson: Lesson, layout: Layout): DemoKey[] {
  const seen = new Set<string>();
  const out: DemoKey[] = [];
  for (const ch of newCharsFor(lesson, layout)) {
    const key = keyOf(layout, ch);
    if (!key || key.code === 'Space') continue;
    const id = key.code + (key.shift ? '+' : '');
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
    if (out.length >= 6) break;
  }
  return out;
}

export function lessonDemo(lesson: Lesson, layout: Layout): DemoStep[] {
  const keys = demoKeys(lesson, layout);
  if (!keys.length) return [];
  // the lesson lines name QWERTY letters; other layouts get one line per finger move instead
  if (layout.id === 'qwerty') return [{ line: `lesson.${lesson.id}`, act: { a: 'reach', keys } }];
  const steps: DemoStep[] = [];
  const said = new Set<string>();
  for (const key of keys) {
    const line = key.shift && !said.has('shift') ? 'finger.shift' : `finger.${key.finger}.${reachDir(layout, key)}`;
    const group = steps.find(s => s.line === line);
    if (group && group.act.a === 'reach') { group.act.keys.push(key); continue; }
    said.add(key.shift ? 'shift' : line);
    steps.push({ line, act: { a: 'reach', keys: [key] } });
  }
  return steps;
}
