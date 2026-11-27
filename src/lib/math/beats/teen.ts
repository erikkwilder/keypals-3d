// The arithmetic of Ten and Some More (teenLesson.ts) with no pictures in it: what any number a child gives
// for "how many buns in all?" means when one marshmallow is put on each bun, and the two wrong ideas the
// friends bring, each as a function, so the world can act them out and the test can check them without a screen.
//
// Where the wrong ideas come from. The buddy's: a child reads a teen number's digits each at face value, so one
// full tray and five more is "1 and 5", which makes 6 (Kamii's interviews on the 1 in 16, in Young Children
// Reinvent Arithmetic; Ross 1989 on what children think each digit stands for; it is also the old lesson's own
// wrong idea). The Glimmer's: English says the ones first in a teen number ("six-teen"), so a child who writes
// what is heard in the order it is heard writes 61 (Fuson and Kwon on English number words; the old lesson's
// decoy was 51). Both are written here from memory of that work, not from the vault's research notes, which
// the builder did not read: the lead should check them against the notes.

/** a full tray's buns */
export const TEN = 10;

/** What `n` marshmallows mean on `buns` buns, one put on each: every bun has one and none is left, some buns
 *  have none, or some marshmallows have no bun. */
export type Meaning = { kind: 'right' } | { kind: 'few'; bare: number } | { kind: 'over'; spare: number };
export function meaning(n: number, buns: number): Meaning {
  return n === buns ? { kind: 'right' } : n < buns ? { kind: 'few', bare: buns - n } : { kind: 'over', spare: n - buns };
}

/** how many buns are on the second tray when the first is full */
export const rest = (buns: number) => buns - TEN;

/** The buddy's idea: the full tray counted as 1, so 1 and the rest. */
export const unitIdea = (buns: number) => 1 + rest(buns);
/** The Glimmer's idea: the number written in the order it is heard, the ones first and then the 1. */
export const heardIdea = (buns: number) => rest(buns) * 10 + 1;
