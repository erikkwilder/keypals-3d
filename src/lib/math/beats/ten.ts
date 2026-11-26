// The arithmetic of Make Ten (tenLesson.ts) with no pictures in it: what any number of "more" a child gives
// means on a ten frame that already holds some counters, and the two wrong ideas the friends bring, each as a
// function, so the world can act them out and the test can check them without a screen.
//
// Where the wrong ideas come from. The buddy's: asked "how many more make 10?", a young child often answers
// with a number that is in the question, here the 10 itself (Carpenter, Fennema, Franke, Levi and Empson,
// Children's Mathematics: Cognitively Guided Instruction, on "join, change unknown" problems: a child who
// cannot yet model the missing part gives back one of the given numbers). The Glimmer's: on a ten frame whose
// top row is not full, a child counts the empty bottom row and misses the empty places beside the counters
// (seen in ten-frame work in class; written here from experience, not from the vault's research notes, which
// the builder did not read: the lead should check it against them).

/** a ten frame's places: two rows of five */
export const TEN = 10, ROW = 5;

/** the number that makes 10 with `have` */
export const partner = (have: number) => TEN - have;

/** What `more` counters mean on a frame that holds `have`: it is full with none left over, some places are
 *  still empty, or some counters have no place. */
export type Meaning = { kind: 'full' } | { kind: 'short'; missing: number } | { kind: 'over'; extra: number };
export function meaning(more: number, have: number): Meaning {
  const need = partner(have);
  return more === need ? { kind: 'full' } : more < need ? { kind: 'short', missing: need - more } : { kind: 'over', extra: more - need };
}

/** The places (0 to 4 the top row from the left, 5 to 9 the bottom row) that are empty when the first `have`
 *  are full, in the order new counters go into them: top row first, or the bottom row first. */
export function emptyPlaces(have: number, from: 'top' | 'bottom' = 'top'): number[] {
  const all = Array.from({ length: TEN - have }, (_, i) => have + i);
  return from === 'top' ? all : [...all.filter(p => p >= ROW), ...all.filter(p => p < ROW)];
}

/** The buddy's idea: the tray holds 10, so it needs 10 more (the whole given back as the missing part). */
export const wholeIdea = (_have: number) => TEN;
/** The Glimmer's idea: count only the bottom row's empty places. */
export const bottomRowIdea = (have: number) => Math.min(ROW, TEN - have);
