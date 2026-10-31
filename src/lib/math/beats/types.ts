// A beat lesson: the kind of Learn episode that plays like a short silent film and stops for the child.
// The script is a small program (a lesson's `play`): it tells the world what to act out and asks the child
// for answers, and whatever the child answers is what happens next. The player (BeatEpisode.svelte) is the
// same for every lesson: the 3D place, the words, the number pad and choices, the card. The world is what's
// on the table for this kind of lesson (a crate of cubes: three/crateKit.ts). Scripts and worlds only meet
// through these two small interfaces, so a test can play a script with a pretend child and a pretend world.
import type { Vector3 } from 'three';
import type { SetId } from '../episodes';
import type { GlimmerId } from '../../adventure/glimmers';
import type { EpisodeScene } from '../../three/episodeScene';

export type BuddyMove = 'wave' | 'cheer' | 'jump' | 'gasp' | 'oops' | 'shrug' | 'nod' | 'clap' | 'think' | 'point' | 'present' | 'talk';
export type PalMove = 'hop' | 'happy' | 'act' | 'sad';
export type Choice<T extends string = string> = { id: T; text: string };

/** What a script can ask of the player. */
export interface Teller {
  /** the coach says one line (its words stay up); done when it's said. `n` fills {n} in the words on screen */
  say(id: string, n?: number): Promise<void>;
  /** wait for a number from the child (it's what the world then acts out); `line` is said as it opens */
  num(prompt: string, line?: string, n?: number): Promise<number>;
  /** wait for a tap on one of these */
  pick<T extends string>(prompt: string, choices: Choice<T>[], line?: string): Promise<T>;
  /** the child's hands do a job in the world; "Show me" appears if they get stuck */
  hands(words: string, job: () => Promise<void>, showMe: () => void): Promise<void>;
  /** a button for the child to go on when they've looked long enough */
  go(label: string): Promise<void>;
  wait(ms: number): Promise<void>;
  /** the buddy and the Glimmer acting */
  buddy(m: BuddyMove): void;
  pal(m: PalMove): void;
  /** a thought over a friend's head (null: gone) */
  thought(who: 'buddy' | 'pal', text: string | null): void;
  /** the child's own bet, on show beside theirs */
  myBet(text: string | null): void;
  /** where the lesson has got to (the stars at the top) */
  beat(n: number): void;
}

/** Words pinned to a point in the 3D world. */
export type Pin = { id: string; text: string; at: () => Vector3; kind: 'edge' | 'tick' | 'count' | 'word' | 'sum';
  /** which line's colour */ c?: 'a' | 'b' | 'c' | 'ink';
  /** a sum's numbers, each in its line's colour, and the words under them */
  parts?: { t: string; c?: 'a' | 'b' | 'c' }[]; under?: string[] };

/** What the player needs from any world. */
export interface World {
  pins: Pin[];
  onChange: (() => void) | null;
  /** the table's part for the work, in board units */
  bounds(): { x: number; y: number; w: number; h: number };
  /** call after the scene fits the bounds */
  refit(): void;
  load(): Promise<void>;
  update(dt: number, t: number): void;
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean;
  /** where a hand's hint is now, and where the child should start (null: nothing to touch) */
  handPoint(): Vector3 | null;
  /** where a drag runs on the screen, drawn as an arrow (null: nothing to drag) */
  dragPath(): { a: { x: number; y: number }; b: { x: number; y: number } } | null;
  tryPoint(): Vector3 | null;
  dispose(): void;
}

/** What a lesson remembers about one child (saved with their math; shown on the card and the next day). */
export type Notes = Record<string, number>;

export type BeatLesson<W extends World = World> = {
  id: string; title: string; blurb: string; set: SetId; star: GlimmerId; color: string;
  /** the card's painted picture */
  art: string;
  /** how many stars across the top */
  beats: number;
  world(sc: EpisodeScene): Promise<W>;
  /** the lesson; what it returns is kept with the child, and shapes the card */
  play(t: Teller, w: W): Promise<Notes>;
  /** the next day's check, with what was kept */
  check(t: Teller, w: W, notes: Notes | null): Promise<void>;
  /** the card's words, from what this child did */
  card(notes: Notes): string[];
};
