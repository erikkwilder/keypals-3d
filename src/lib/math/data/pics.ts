// Data and chance: the pictures its questions are about. Every one is plain data (counts, values, colours)
// drawn by ui/DataPic.svelte: a jumble of fair prizes to sort, a picture graph, a bar graph, a tally, a line
// plot (dots over a number line, in wholes, halves, quarters or eighths), a histogram, a box plot, a list of
// numbers on cards, block towers to level out, a spinner of equal parts, a bag of marbles, dice, and a tree
// of two choices. The prizes are painted (public/math/data/prize-*.webp); the rest is drawn to scale.

/** The fair's prizes: the things kids sort, count and graph. */
export const PRIZES = ['balloon', 'duck', 'bear', 'candy', 'frog', 'wand', 'ticket', 'fish'] as const;
export type PrizeId = (typeof PRIZES)[number];
export const PRIZE: Record<PrizeId, { one: string; many: string }> = {
  balloon: { one: 'balloon', many: 'balloons' }, duck: { one: 'duck', many: 'ducks' }, bear: { one: 'teddy', many: 'teddies' },
  candy: { one: 'cotton candy', many: 'cotton candies' }, frog: { one: 'frog', many: 'frogs' }, wand: { one: 'star wand', many: 'star wands' },
  ticket: { one: 'ticket', many: 'tickets' }, fish: { one: 'goldfish', many: 'goldfish' },
};
export const prizeWord = (p: PrizeId, n: number) => (n === 1 ? PRIZE[p].one : PRIZE[p].many);

/** The colours of marbles, spinner parts and bars (a word a 6-year-old reads, and how it's painted). */
export const COLORS = ['red', 'blue', 'yellow', 'green', 'purple', 'orange'] as const;
export type ColorId = (typeof COLORS)[number];
export const COLOR: Record<ColorId, { hex: string; deep: string }> = {
  red: { hex: '#f25c5c', deep: '#b8323a' }, blue: { hex: '#4a95f2', deep: '#2a5fb8' }, yellow: { hex: '#ffcf3d', deep: '#c99410' },
  green: { hex: '#5cc96a', deep: '#2f8a3e' }, purple: { hex: '#a46cf0', deep: '#6a3cb8' }, orange: { hex: '#ff9840', deep: '#c0601a' },
};

/** One group in a graph: its name (a prize, or a word like "Mon"), its count, its picture or colour. */
export type Cat = { name: string; n: number; prize?: PrizeId; color?: ColorId };

export type DataPic =
  /** a jumble of prizes to sort and count (`sorted`: already in rows by kind) */
  | { kind: 'things'; items: PrizeId[]; sorted?: boolean }
  /** one prize on its own (in a choice) */
  | { kind: 'prize'; prize: PrizeId }
  /** a picture graph: a row of pictures per group; each picture stands for `per` (a half picture for half) */
  | { kind: 'picgraph'; cats: Cat[]; per: number; title?: string }
  /** a bar graph: lines every `step` up to `max`; `hide` is a bar left empty (to drag); `flip` lies them down */
  | { kind: 'bars'; cats: Cat[]; step: number; max: number; title?: string; hide?: number; flip?: boolean }
  /** a tally table */
  | { kind: 'tally'; cats: Cat[] }
  /** a line plot: a number line from `min` to `max` cut into `den` parts per whole, a dot over it for every
   *  value in `marks` (`unit`: what they measure, "inches") */
  | { kind: 'line'; min: number; max: number; den: number; marks: number[]; unit?: string; title?: string }
  /** a histogram: bars over ranges of numbers, side by side */
  | { kind: 'hist'; bins: { lo: number; hi: number; n: number }[]; step: number; title?: string }
  /** a box plot over a number line from `lo` to `hi` (labels every `step`) */
  | { kind: 'box'; five: [number, number, number, number, number]; lo: number; hi: number; step: number; title?: string }
  /** numbers on cards (`sorted`: in order; `den`: shown as fractions with that bottom, 1 1/2) */
  | { kind: 'list'; values: number[]; unit?: string; den?: number; sorted?: boolean }
  /** towers of blocks, side by side (the mean levels them out) */
  | { kind: 'towers'; heights: number[] }
  /** a spinner of equal parts, each a colour */
  | { kind: 'spinner'; parts: ColorId[] }
  /** a bag of marbles */
  | { kind: 'bag'; marbles: { color: ColorId; n: number }[] }
  /** dice showing faces (or a blank die for "a die": faces []) */
  | { kind: 'dice'; faces: number[] }
  /** a tree: every first choice branching into every second (and third) */
  | { kind: 'tree'; levels: string[][] }
  /** a table of results: what happened and how many times */
  | { kind: 'results'; rows: { name: string; n: number; color?: ColorId }[]; total?: boolean };

/** A fraction as text: 3/4, 1 1/2, 2. */
export function fracText(x: number, den: number): string {
  const n = Math.round(x * den), w = Math.floor(n / den), r = n % den;
  if (!r) return String(w);
  const g = gcd(r, den), t = `${r / g}/${den / g}`;
  return w ? `${w} ${t}` : t;
}
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

/** A data picture in a few words, for help cards, results and battle lists: "a bar graph", "3 red, 5 blue". */
export function dataText(d: DataPic): string {
  switch (d.kind) {
    case 'things': return `${d.items.length} prizes`;
    case 'prize': return PRIZE[d.prize].one;
    case 'picgraph': return 'a picture graph';
    case 'bars': return 'a bar graph';
    case 'tally': return 'a tally';
    case 'line': return d.title?.startsWith('Ribbon') ? 'a line plot' : 'a dot plot';
    case 'hist': return 'a histogram';
    case 'box': return 'a box plot';
    case 'list': return d.values.map(v => (d.den ? fracText(v, d.den) : String(v))).join(', ');
    case 'towers': return `towers ${d.heights.join(', ')}`;
    case 'spinner': return `a spinner of ${d.parts.length}`;
    case 'bag': return d.marbles.map(m => `${m.n} ${m.color}`).join(', ');
    case 'dice': return d.faces.length ? `dice ${d.faces.join(' and ')}` : 'a die';
    case 'tree': return d.levels.map(l => l.length).join(' × ');
    case 'results': return d.rows.map(r => `${r.name} ${r.n}`).join(', ');
  }
}

// ---------- where things go (shared by the picture and the inputs you drag and tap) ----------
/** A bar graph's layout in its own units: the plot area, each bar's middle, and a value's length. */
export function barLayout(d: Extract<DataPic, { kind: 'bars' }>) {
  const n = d.cats.length, title = d.title ? 26 : 6;
  if (d.flip) {
    const W = 380, left = 80, right = 18, top = title + 6, bar = 30, gap = 14;
    const len = W - left - right, bottom = top + n * (bar + gap), H = bottom + 28;
    return { W, H, flip: true as const, left, top, len, bottom, bar,
      at: (i: number) => top + gap / 2 + i * (bar + gap) + bar / 2, size: (v: number) => (v / d.max) * len };
  }
  const left = 40, right = 10, top = title + 8, H = 236, bottom = H - 30, len = bottom - top;
  const slot = Math.max(56, Math.min(78, 270 / n)), W = left + right + n * slot;
  return { W, H, flip: false as const, left, top, len, bottom, bar: slot * 0.62,
    at: (i: number) => left + slot * (i + 0.5), size: (v: number) => (v / d.max) * len };
}
/** A line plot's layout: the line's ends and each tick's x (tick t is min + t / den). */
export function lineLayout(d: { min: number; max: number; den: number; title?: string }, stackMax: number) {
  const ticks = (d.max - d.min) * d.den + 1;
  const gap = ticks > 10 ? 34 : 46, left = 30, W = left * 2 + (ticks - 1) * gap;
  const dot = Math.min(14, gap * 0.32), title = d.title ? 26 : 4;
  const lineY = title + 12 + Math.max(3, stackMax) * dot * 2.1 + 6, H = lineY + 44;
  return { W, H, ticks, gap, left, lineY, dot, x: (t: number) => left + t * gap, tickOf: (v: number) => Math.round((v - d.min) * d.den) };
}
