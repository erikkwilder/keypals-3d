// A small QR code maker for the printed login cards (no package needed): bytes, error correction level
// M (a smudged or creased card still scans), versions 1 to 10 (up to 213 bytes: a class link is about
// 45). It follows the QR standard (ISO/IEC 18004) the way most small encoders do; qr.test.ts checks it
// against matrices made by a reference encoder.

// version: [error correction codewords per block, [blocks, data codewords each]...] for level M
const BLOCKS: [number, [number, number][]][] = [
  [0, []],
  [10, [[1, 16]]], [16, [[1, 28]]], [26, [[1, 44]]], [18, [[2, 32]]], [24, [[2, 43]]],
  [16, [[4, 27]]], [18, [[4, 31]]], [22, [[2, 38], [2, 39]]], [22, [[3, 36], [2, 37]]], [26, [[4, 43], [1, 44]]],
];
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const dataCodewords = (v: number) => BLOCKS[v][1].reduce((t, [n, k]) => t + n * k, 0);
export const QR_MAX_VERSION = 10;

// ---------- Reed-Solomon over GF(256) ----------
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function generator(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}
function ecc(data: number[], degree: number): number[] {
  const g = generator(degree);
  const out = new Array(degree).fill(0);
  for (const d of data) {
    const f = d ^ out[0];
    out.shift(); out.push(0);
    for (let j = 0; j < degree; j++) out[j] ^= mul(g[j + 1], f);
  }
  return out;
}

// ---------- the bits ----------
function codewords(bytes: Uint8Array, v: number): number[] {
  const bits: number[] = [];
  const put = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  const cap = dataCodewords(v) * 8;
  put(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataCodewords(v); pad ^= 0xec ^ 0x11) data.push(pad);
  // split into blocks, add each block's error correction, then interleave
  const [ecLen, groups] = BLOCKS[v];
  const blocks: number[][] = [], ecs: number[][] = [];
  let at = 0;
  for (const [n, k] of groups) for (let i = 0; i < n; i++) { const b = data.slice(at, at + k); at += k; blocks.push(b); ecs.push(ecc(b, ecLen)); }
  const out: number[] = [];
  const longest = Math.max(...blocks.map(b => b.length));
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecLen; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

// ---------- the picture ----------
class Grid {
  readonly size: number;
  readonly dark: boolean[][];
  readonly fixed: boolean[][];
  constructor(readonly v: number) {
    this.size = 17 + 4 * v;
    this.dark = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.fixed = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  /** x: column, y: row */
  set(x: number, y: number, d: boolean) { this.dark[y][x] = d; this.fixed[y][x] = true; }
  functionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) { this.set(6, i, i % 2 === 0); this.set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [s - 4, 3], [3, s - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= s || y >= s) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(x, y, dist !== 2 && dist !== 4);
      }
    }
    const pos = ALIGN[this.v], n = pos.length;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    this.format(0);
    if (this.v >= 7) {
      let rem = this.v;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const bits = (this.v << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const d = ((bits >>> i) & 1) === 1, a = s - 11 + (i % 3), b = Math.floor(i / 3);
        this.set(a, b, d); this.set(b, a, d);
      }
    }
  }
  /** the format information: level M (00) and the mask, with its own error correction */
  format(mask: number) {
    const data = (0b00 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) === 1;
    const s = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(i));
    this.set(8, 7, bit(6)); this.set(8, 8, bit(7)); this.set(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(i));
    this.set(8, s - 8, true);
  }
  place(words: number[]) {
    let i = 0;
    const s = this.size, total = words.length * 8;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? s - 1 - vert : vert;
        if (!this.fixed[y][x] && i < total) { this.dark[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
  }
  mask(m: number) {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      if (this.fixed[y][x]) continue;
      const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
        ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][m];
      if (inv) this.dark[y][x] = !this.dark[y][x];
    }
  }
  /** how hard this mask makes the code to read (lower is better) */
  penalty(): number {
    const s = this.size, d = this.dark;
    let p = 0;
    const lines: boolean[][] = [];
    for (let y = 0; y < s; y++) lines.push(d[y]);
    for (let x = 0; x < s; x++) lines.push(d.map(r => r[x]));
    const finder = [true, false, true, true, true, false, true];
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= s; i++) {
        if (i < s && line[i] === line[i - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      for (let i = 0; i + 7 <= s; i++) {
        if (!finder.every((f, k) => line[i + k] === f)) continue;
        const lightBefore = i >= 4 && [1, 2, 3, 4].every(k => !line[i - k]);
        const lightAfter = i + 11 <= s && [7, 8, 9, 10].every(k => !line[i + k]);
        if (lightBefore || lightAfter) p += 40;
      }
    }
    for (let y = 0; y < s - 1; y++) for (let x = 0; x < s - 1; x++) { const c = d[y][x]; if (c === d[y][x + 1] && c === d[y + 1][x] && c === d[y + 1][x + 1]) p += 3; }
    const dark = d.reduce((t, r) => t + r.filter(Boolean).length, 0), total = s * s;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }
}

/** The smallest version that holds this many bytes (null: too long). */
export function qrVersionFor(bytes: number): number | null {
  for (let v = 1; v <= QR_MAX_VERSION; v++) if (4 + (v < 10 ? 8 : 16) + bytes * 8 <= dataCodewords(v) * 8) return v;
  return null;
}

/** A QR code for some text: rows of dark (true) and light modules, without the quiet border. */
export function qrMatrix(text: string, opts: { mask?: number; version?: number } = {}): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const v = opts.version ?? qrVersionFor(bytes.length);
  if (!v) throw new Error('Too long for a QR code here.');
  const words = codewords(bytes, v);
  const g = new Grid(v);
  g.functionPatterns();
  g.place(words);
  let best = opts.mask ?? -1;
  if (best < 0) {
    let low = Infinity;
    for (let m = 0; m < 8; m++) { g.mask(m); g.format(m); const pen = g.penalty(); if (pen < low) { low = pen; best = m; } g.mask(m); }
  }
  g.mask(best); g.format(best);
  return g.dark.map(r => [...r]);
}

/** The dark modules as one SVG path (one unit per module), for a viewBox of the size plus the border. */
export function qrPath(m: boolean[][], border = 4): string {
  let d = '';
  m.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + border} ${y + border}h1v1h-1z`; }));
  return d;
}
