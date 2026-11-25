// The six buddies on New player, sized to the screen's width: six in a row where six 110 px buddies fit,
// otherwise three to a row; 110 px wherever they fit, 80 px on a phone (as they were at 390 and 360 wide),
// and smaller only where even that doesn't fit (320 wide). `width` is New player's width; `phone` is its
// max-width: 440px rule, which narrows its padding at the sides (NewPlayer.svelte).
export type BuddyFit = { cols: 3 | 6; size: number; gap: number; padX: number };

/** each buddy's border, at each side (NewPlayer.svelte .buddy) */
export const BUDDY_BORDER = 3;

export function buddyFit(width: number, phone = width <= 440): BuddyFit {
  const side = phone ? 16 : 30; // New player's padding, at each side
  const gap = phone ? 8 : 10;
  const padX = phone ? 4 : 8; // each buddy's padding, at each side
  const edge = 2 * (padX + BUDDY_BORDER);
  const room = width - 2 * side;
  const cols = 6 * (110 + edge) + 5 * gap <= room ? 6 : 3;
  const fits = Math.floor((room - (cols - 1) * gap) / cols - edge);
  return { cols, size: Math.max(40, Math.min(phone ? 80 : 110, fits)), gap, padX };
}

/** How wide the row of buddies is, in px. */
export const rowWidth = (f: BuddyFit) => f.cols * (f.size + 2 * (f.padX + BUDDY_BORDER)) + (f.cols - 1) * f.gap;
