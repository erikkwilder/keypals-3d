// Keyboard layouts. Physical keys (KeyboardEvent.code) carry the finger; a layout says
// which character each physical key makes. The course is written in physical keys, so
// every layout gets the whole course.

import type { Finger } from '../art/cast';

export type Code = string;

export type KeyDef = {
  code: Code;
  row: number; // 0 numbers, 1 top, 2 home, 3 bottom, 4 space
  finger: Finger;
  base: string;
  shift: string;
  width?: number; // in key units
  special?: 'tab' | 'caps' | 'enter' | 'backspace' | 'shiftL' | 'shiftR' | 'space';
};

export type LayoutId = 'qwerty' | 'dvorak' | 'colemak' | 'workman' | 'qwertz' | 'azerty';

export type Layout = {
  id: LayoutId;
  name: string;
  rows: KeyDef[][];
  dead: Set<string>;
  /** char -> how to make it */
  chars: Map<string, { code: Code; shift: boolean; finger: Finger }>;
  byCode: Map<Code, KeyDef>;
};

const ROW_CODES: Code[][] = [
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash'],
];

const ROW_FINGERS: Finger[][] = [
  ['LP', 'LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP', 'RP'],
  ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP', 'RP', 'RP'],
  ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP'],
  ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'],
];

type Spec = { id: LayoutId; name: string; base: string[]; shift: string[]; dead?: string };

// Each string lines up with ROW_CODES. [...str] keeps non-ASCII characters whole.
const SPECS: Spec[] = [
  { id: 'qwerty', name: 'QWERTY',
    base: ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'],
    shift: ['~!@#$%^&*()_+', 'QWERTYUIOP{}|', 'ASDFGHJKL:"', 'ZXCVBNM<>?'] },
  { id: 'dvorak', name: 'Dvorak',
    base: ['`1234567890[]', "',.pyfgcrl/=\\", 'aoeuidhtns-', ';qjkxbmwvz'],
    shift: ['~!@#$%^&*(){}', '"<>PYFGCRL?+|', 'AOEUIDHTNS_', ':QJKXBMWVZ'] },
  { id: 'colemak', name: 'Colemak',
    base: ['`1234567890-=', 'qwfpgjluy;[]\\', "arstdhneio'", 'zxcvbkm,./'],
    shift: ['~!@#$%^&*()_+', 'QWFPGJLUY:{}|', 'ARSTDHNEIO"', 'ZXCVBKM<>?'] },
  { id: 'workman', name: 'Workman',
    base: ['`1234567890-=', 'qdrwbjfup;[]\\', "ashtgyneoi'", 'zxmcvkl,./'],
    shift: ['~!@#$%^&*()_+', 'QDRWBJFUP:{}|', 'ASHTGYNEOI"', 'ZXMCVKL<>?'] },
  { id: 'qwertz', name: 'QWERTZ (German)',
    base: ['^1234567890ß´', 'qwertzuiopü+#', 'asdfghjklöä', 'yxcvbnm,.-'],
    shift: ['°!"§$%&/()=?`', "QWERTZUIOPÜ*'", 'ASDFGHJKLÖÄ', 'YXCVBNM;:_'], dead: '^´`°' },
  { id: 'azerty', name: 'AZERTY (French)',
    base: ['²&é"\'(-è_çà)=', 'azertyuiop^$*', 'qsdfghjklmù', 'wxcvbn,;:!'],
    shift: ['~1234567890°+', 'AZERTYUIOP¨£µ', 'QSDFGHJKLM%', 'WXCVBN?./§'], dead: '^¨' },
];

function build(spec: Spec): Layout {
  const rows: KeyDef[][] = ROW_CODES.map((codes, r) => {
    const b = [...spec.base[r]], s = [...spec.shift[r]];
    return codes.map((code, i) => ({ code, row: r, finger: ROW_FINGERS[r][i], base: b[i] ?? '', shift: s[i] ?? '' }));
  });
  // wide keys for the on-screen keyboard
  rows[0].push({ code: 'Backspace', row: 0, finger: 'RP', base: '', shift: '', width: 2, special: 'backspace' });
  rows[1].unshift({ code: 'Tab', row: 1, finger: 'LP', base: '', shift: '', width: 1.5, special: 'tab' });
  rows[1][rows[1].length - 1].width = 1.5;
  rows[2].unshift({ code: 'CapsLock', row: 2, finger: 'LP', base: '', shift: '', width: 1.75, special: 'caps' });
  rows[2].push({ code: 'Enter', row: 2, finger: 'RP', base: '', shift: '', width: 2.25, special: 'enter' });
  rows[3].unshift({ code: 'ShiftLeft', row: 3, finger: 'LP', base: '', shift: '', width: 2.25, special: 'shiftL' });
  rows[3].push({ code: 'ShiftRight', row: 3, finger: 'RP', base: '', shift: '', width: 2.75, special: 'shiftR' });
  const space: KeyDef = { code: 'Space', row: 4, finger: 'TH', base: ' ', shift: ' ', width: 6.25, special: 'space' };
  rows.push([space]);

  const dead = new Set([...(spec.dead ?? '')]);
  const chars = new Map<string, { code: Code; shift: boolean; finger: Finger }>();
  const byCode = new Map<Code, KeyDef>();
  for (const row of rows) for (const k of row) {
    byCode.set(k.code, k);
    if (k.base && !dead.has(k.base) && !chars.has(k.base)) chars.set(k.base, { code: k.code, shift: false, finger: k.finger });
  }
  for (const row of rows) for (const k of row) {
    if (k.shift && !dead.has(k.shift) && !chars.has(k.shift)) chars.set(k.shift, { code: k.code, shift: true, finger: k.finger });
  }
  return { id: spec.id, name: spec.name, rows, dead, chars, byCode };
}

export const LAYOUTS: Record<LayoutId, Layout> = Object.fromEntries(SPECS.map(s => [s.id, build(s)])) as Record<LayoutId, Layout>;
export const LAYOUT_LIST = SPECS.map(s => ({ id: s.id, name: s.name }));

export const LEFT_FINGERS = new Set<Finger>(['LP', 'LR', 'LM', 'LI']);

/** Which shift key a capital needs: the opposite hand from the letter. */
export function shiftFor(layout: Layout, ch: string): 'ShiftLeft' | 'ShiftRight' | null {
  const info = layout.chars.get(ch);
  if (!info || !info.shift) return null;
  return LEFT_FINGERS.has(info.finger) ? 'ShiftRight' : 'ShiftLeft';
}

export function fingerFor(layout: Layout, ch: string): Finger | null {
  if (ch === ' ') return 'TH';
  return layout.chars.get(ch)?.finger ?? null;
}

/**
 * Guess the OS layout from what physical keys produced. Returns a layout id when the
 * samples clearly match one layout (and only one), else null.
 */
export function detectLayout(samples: { code: string; key: string }[]): LayoutId | null {
  const letters = samples.filter(s => /^Key[A-Z]$/.test(s.code) && s.key.length === 1);
  if (letters.length < 6) return null;
  const scores = SPECS.map(spec => {
    const L = LAYOUTS[spec.id];
    let hit = 0;
    for (const s of letters) {
      const k = L.byCode.get(s.code);
      if (k && (k.base === s.key || k.shift === s.key)) hit++;
    }
    return { id: spec.id, rate: hit / letters.length };
  }).sort((a, b) => b.rate - a.rate);
  if (scores[0].rate >= 0.9 && (scores[1]?.rate ?? 0) < scores[0].rate) return scores[0].id;
  return null;
}
