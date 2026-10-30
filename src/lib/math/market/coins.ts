// The Sky Market's coins as plain numbers (what each is worth, its size, its painting), for the Learn
// episodes' pages and checks; three/coinShapes.ts draws them in 3D from these.
export type CoinKind = 'penny' | 'nickel' | 'dime' | 'quarter' | 'dollar' | 'bill';
/** what each is worth, in cents */
export const CENTS: Record<CoinKind, number> = { penny: 1, nickel: 5, dime: 10, quarter: 25, dollar: 100, bill: 100 };
/** across, in board units (a quarter is 24.26 mm; the rest in proportion); a bill is long and flat */
export const COIN_D: Record<CoinKind, number> = { penny: 60, nickel: 67, dime: 56, quarter: 76, dollar: 83, bill: 160 };
/** the painted faces (and the bill), loaded by the episode */
export const COIN_FILES: Record<CoinKind, string> = { penny: 'math/money/penny.webp', nickel: 'math/money/nickel.webp', dime: 'math/money/dime.webp', quarter: 'math/money/quarter.webp', dollar: 'math/money/dollar.webp', bill: 'math/money/bill.webp' };
