// Tiny animation helpers: damped springs and one shared frame loop.

export class Spring {
  x: number;
  v = 0;
  target: number;
  constructor(x = 0, public k = 170, public c = 18) {
    this.x = x;
    this.target = x;
  }
  step(dt: number) {
    // small fixed sub-steps: stiff springs blow up if one step is long (thumbnails step at half rate)
    const n = Math.max(1, Math.ceil(dt / 0.012));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = this.k * (this.target - this.x) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  kick(v: number) { this.v += v; }
  set(x: number) { this.x = x; this.target = x; this.v = 0; }
}

type Tick = (dt: number, t: number) => void;
const ticks = new Set<Tick>();
let raf = 0;
let last = 0;

function loop(t: number) {
  const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016);
  last = t;
  for (const f of ticks) f(dt, t);
  raf = ticks.size ? requestAnimationFrame(loop) : 0;
}

/** Run `f` every frame until the returned function is called. */
export function onFrame(f: Tick): () => void {
  ticks.add(f);
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
  return () => { ticks.delete(f); };
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
