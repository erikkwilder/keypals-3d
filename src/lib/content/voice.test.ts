// The Learn lines follow the writing guide at the top of voice.ts: what the voice reads is plain words a
// five-year-old can follow (no digits, signs, colons or shouted words), and every buddy line is recorded in
// every buddy voice.
import { describe, expect, it } from 'vitest';
import { BUDDY_LINES, BUDDY_VOICE, BUDDY_VOICES, LEARN_LINES, buddyLine } from './voice';
import { BUDDIES } from '../art/cast';

describe('Learn lines, written for the ear', () => {
  it('every spoken form is words only', () => {
    const bad: string[] = [];
    for (const l of LEARN_LINES) {
      const s = l.said ?? l.text;
      // (x is a letter in algebra; "OK" and "I" are fine in capitals)
      if (/\d|[+−×÷=/:;()<>%$&[\]→]|\b(?!OK\b|I\b)[A-Z]{2,}\b/.test(s)) bad.push(`${l.id}: ${s}`);
    }
    expect(bad).toEqual([]);
  });
  it('lines stay short: one or two ideas', () => {
    for (const l of LEARN_LINES) expect((l.said ?? l.text).split(/\s+/).length, l.id).toBeLessThanOrEqual(36);
  });
  it('each buddy line is in every buddy voice, and every buddy has a voice', () => {
    const ids = new Set(BUDDY_LINES.map(l => l.id));
    for (const l of BUDDY_LINES) for (const v of BUDDY_VOICES) expect(ids.has(l.id.replace(/^bv\.[^.]+\./, `bv.${v}.`)), l.id).toBe(true);
    for (const f of BUDDIES) { expect(BUDDY_VOICE[f.id], f.id).toBeTruthy(); expect(ids.has(buddyLine(f.id, 'praise0'))).toBe(true); }
  });
});
