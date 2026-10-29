// What an Arcade game tells the screen around it (the score, the combo, the fact memory), and what it
// is told (the round's phase and how far through it is).
import type { Fact } from '../../math/facts';
import type { FriendId } from '../../art/cast';
import type { Rng } from '../../engine/rng';
import type { FactDeck } from '../arcade';

export type Phase = 'loading' | 'intro' | 'count' | 'play' | 'paused' | 'ending' | 'done';
export type ArcadeHud = {
  /** an answer, for the fact memory */
  answer(f: Fact, ok: boolean, thinkMs: number): void;
  /** points scored; `at` is where on the screen (0..1 across and down) to pop "+N" (null: no pop), with a word */
  score(points: number, at?: { x: number; y: number } | null, label?: string): void;
  /** right ones in a row */
  combo(n: number): void;
  /** the round ends early (Tower Stack's third topple) */
  end(): void;
};
export type GameProps = {
  deck: FactDeck; rng: Rng; buddy: FriendId; fastMs: number;
  phase: Phase;
  /** how far through the round (0..1): the games speed up as it goes */
  progress: number;
  compact: boolean;
  hud: ArcadeHud;
  /** the 3D scene is ready */
  onready: () => void;
};
/** The combo multiplier: half as much again for every three right in a row, up to three times. */
export const mult = (combo: number) => Math.min(3, 1 + Math.floor(combo / 3) * 0.5);
