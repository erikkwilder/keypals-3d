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

/** A picture that goes with a line: acted out when the narrator reaches `at` seconds into the line. */
export type Cue = [at: number, act: () => void | Promise<unknown>];

/** What a script can ask of the player. */
export interface Teller {
  /** the coach says one line (its words stay up); done when it's said. `n`, `m` and `k` fill {n}, {m} and {k}
   *  in the words on screen (the voice says the line's spoken form, which has none of them) */
  say(id: string, n?: number, m?: number, k?: number): Promise<void>;
  /** the coach says one line while the picture shows what it says (rule 37: a child never sits watching a still
   *  screen while the narrator talks). Each cue is acted out when the narrator reaches its second of the line, by
   *  the clip's own clock, so a paused lesson's pictures wait with its words; with the voice off, by the lesson's
   *  clock. Done when the line is said and every picture has finished: the story never runs ahead of the picture */
  sayWith(id: string, cues: Cue[], n?: number, m?: number, k?: number): Promise<void>;
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
  /** a tick written large: a numeral a young child has to read off a thing */ big?: boolean;
  /** which line's colour ('yes', 'no': a tick's green and a cross's red) */ c?: 'a' | 'b' | 'c' | 'ink' | 'yes' | 'no';
  /** a tick the narrator is talking about right now: a ring round it (it doesn't change size, so no card moves) */ hot?: boolean;
  /** a sum's numbers, each in its line's colour, and the words under them */
  parts?: { t: string; c?: 'a' | 'b' | 'c'; /** being said right now */ hot?: boolean }[]; under?: string[] };

/** What the player needs from any world. */
export interface World {
  pins: Pin[];
  onChange: (() => void) | null;
  /** a short word to be heard right now, by its voice line's id (a count word as a cookie is touched); the
   *  player sets it. It doesn't change the words on screen */
  onWord?: ((id: string) => void) | null;
  /** the short words it may say through onWord (the count words), by their voice lines' ids: the player keeps
   *  them on this computer with the lesson's lines, so they're heard if the connection drops (audio/keep.ts) */
  words?: readonly string[];
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
  /** the lesson is over and the card is coming, with the two friends close up: anything big left on the table
   *  that would loom in front of them goes (a balance) */
  clearForCard?(): void;
  dispose(): void;
}

/** What a lesson remembers about one child (saved with their math; shown on the card and the next day). */
export type Notes = Record<string, number>;

export type BeatLesson<W extends World = World> = {
  id: string; title: string; blurb: string; set: SetId; star: GlimmerId; color: string;
  /** the card's painted picture */
  art: string;
  /** its spoken lines are ep.<voice>.… (its id when not given) */
  voice?: string;
  /** how many stars across the top */
  beats: number;
  /** false: the lesson never asks for a number, so the page keeps no room for the number keys */
  keys?: boolean;
  world(sc: EpisodeScene): Promise<W>;
  /** the lesson; what it returns is kept with the child, and shapes the card */
  play(t: Teller, w: W): Promise<Notes>;
  /** the next day's check, with what was kept */
  check(t: Teller, w: W, notes: Notes | null): Promise<void>;
  /** the card's words, from what this child did */
  card(notes: Notes): string[];
};
