// No two word cards on a Learn page cover each other, at any size (docs/lesson-rules.md, rule 20b). Cards sit
// on points in the 3D world, so where they land depends on the screen, the numbers in them and what's moving.
// Rather than place each one by hand, every frame's boxes go through here and are pushed the shortest way
// apart. Fixed boxes (the narrator's card, the child's guess, the keys) never move; a heavy card (a number on
// an edge, the big count, the sum) gives way less than a light one (a thought, a word).
export type Card = { x: number; y: number; w: number; h: number;
  /** 0: never moves. 1: an ordinary card. Between: gives way less */
  give: number };

const GAP = 6, ROUNDS = 10;

/** How far to move each card so that none overlap, staying on the page. */
export function separate(cards: Card[], page: { w: number; h: number }): { dx: number; dy: number }[] {
  const at = cards.map(c => ({ ...c }));
  for (let round = 0; round < ROUNDS; round++) {
    let touching = false;
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
      const a = at[i], b = at[j], total = a.give + b.give;
      if (!total) continue;
      const over = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP, down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
      if (over <= 0 || down <= 0) continue;
      touching = true;
      // the shortest way apart
      const sideways = over < down, by = sideways ? over : down;
      let sign = sideways ? Math.sign(a.x + a.w / 2 - (b.x + b.w / 2)) || 1 : Math.sign(a.y + a.h / 2 - (b.y + b.h / 2)) || 1;
      // (not into the page's edge: a card pushed up against the top came straight back and was pushed again,
      // over and over; it goes the other way, where there's room)
      const off = (c: Card, d: number) => c.give > 0 && (sideways ? c.x + d < 2 || c.x + c.w + d > page.w - 2 : c.y + d < 2 || c.y + c.h + d > page.h - 2);
      const blocked = (sg: number) => off(a, (by * a.give) / total * sg) || off(b, -(by * b.give) / total * sg);
      if (blocked(sign) && !blocked(-sign)) sign = -sign;
      const ka = (by * a.give) / total * sign, kb = (by * b.give) / total * sign;
      if (sideways) { a.x += ka; b.x -= kb; } else { a.y += ka; b.y -= kb; }
    }
    for (const c of at) if (c.give) { c.x = Math.max(2, Math.min(page.w - c.w - 2, c.x)); c.y = Math.max(2, Math.min(page.h - c.h - 2, c.y)); }
    if (!touching) break;
  }
  return at.map((c, i) => ({ dx: c.x - cards[i].x, dy: c.y - cards[i].y }));
}

/** a card that gives way, at its own place, with how far it was moved last frame (none yet: it's new) */
export type Free = Card & { nx?: number; ny?: number };
/** how far back toward its own place a card drifts each frame */
const RELAX = 0.12;
/** two cards closer than the gap between cards */
const touch = (a: Card, b: Card) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP > 0;
/** One frame of the word cards: where each free card goes now, as how far from its own place. Each starts from where
 *  it was, drifts a little back toward its own place where there's room for it, and is pushed apart from there only
 *  if something moved into it: it keeps the way it went, stays still once clear, and goes home when there's room.
 *  Pushed apart from its own place every frame, a card by another flipped between two ways apart as the picture
 *  moved, and shook. Erik, 2026-11-25: "some of the word bubbles that are up towards the top get kind of jittery...
 *  a word bubble... that almost gets close to the word bubble of the narration, those... start to jitter." A new card
 *  starts in the clear. */
export function settleCards(fixed: Card[], free: Free[], page: { w: number; h: number }): { nx: number; ny: number }[] {
  const at = free.map(c => ({ ...c, x: c.x + (c.nx ?? 0), y: c.y + (c.ny ?? 0) }));
  // (only into room that's free: drifting into a neighbour it would be pushed out again, and in a crowd the way out
  // could change from one frame to the next)
  at.forEach((c, i) => {
    const f = free[i];
    if (f.nx === undefined || (!f.nx && !f.ny)) return;
    const back = { ...c, x: f.x + f.nx * (1 - RELAX), y: f.y + (f.ny ?? 0) * (1 - RELAX) };
    if (!fixed.some(o => touch(o, back)) && !at.some((o, j) => j !== i && touch(o, back))) at[i] = back;
  });
  const moves = separate([...fixed, ...at], page).slice(fixed.length);
  return at.map((c, i) => ({ nx: c.x + moves[i].dx - free[i].x, ny: c.y + moves[i].dy - free[i].y }));
}
