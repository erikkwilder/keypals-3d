// Glimmer Drop: drop Glimmer eggs into a tall cloud jar. Each egg cracks open into a round Glimmer; two of
// the same that bump together pop and merge into the next, bigger Glimmer in the chain, and merges set off
// more merges (chains score more). Now and then a gust of wind nudges everything. Keep the jar from filling
// past the line. The physics is 2D (matter-js); the screen draws it.
//
// Everything here is plain logic with no drawing, so it can be tested: the screen calls drop(), step()
// every frame, and reads the balls and the events step() returns.
import Matter from 'matter-js';
import { mulberry32, type Rng } from '../engine/rng';
import type { GlimmerId, Rarity } from '../adventure/glimmers';

/** The chain, smallest to biggest: each merge makes the next one. Radii in jar units (the jar is JAR.w wide). */
export const CHAIN: { id: GlimmerId; name: string; r: number; egg: Rarity }[] = [
  { id: 'sproutbun', name: 'Sprout Bunny', r: 17, egg: 'common' },
  { id: 'puddlepup', name: 'Puddle Pup', r: 23, egg: 'common' },
  { id: 'sunsnail', name: 'Sunny Snail', r: 30, egg: 'uncommon' },
  { id: 'bubbleocto', name: 'Bubble Octopus', r: 37, egg: 'uncommon' },
  { id: 'mushmouse', name: 'Mushroom Mouse', r: 46, egg: 'rare' },
  { id: 'popcornpuff', name: 'Popcorn Puffling', r: 56, egg: 'rare' },
  { id: 'frostowl', name: 'Frost Owl', r: 67, egg: 'epic' },
  { id: 'cactuskit', name: 'Cactus Kitten', r: 79, egg: 'epic' },
  { id: 'stormlamb', name: 'Thundercloud Lamb', r: 92, egg: 'legendary' },
  { id: 'cometcat', name: 'Comet Cat', r: 106, egg: 'legendary' },
  { id: 'phoenixchick', name: 'Phoenix Chick', r: 121, egg: 'mythic' },
];
export const TOP = CHAIN.length - 1;
/** the jar inside: width, height, and the line you mustn't fill past (from the top) */
export const JAR = { w: 430, h: 640, line: 96 };
/** eggs you can be given: the first five of the chain, small ones more often */
const DROP_WEIGHTS = [30, 26, 20, 14, 10];
/** points for making each one (making the biggest from two of them: a Glimmer party) */
export const pointsFor = (tier: number) => Math.round(((tier * (tier + 1)) / 2) * 10);
export const PARTY_POINTS = 1000;
/** merges this close together make a chain */
export const CHAIN_GAP = 0.9;
/** seconds over the line before the jar is full (a warning shows first) */
export const OVER_WARN = 0.35, OVER_FULL = 2.6;
/** how long a dropped egg stays an egg */
export const EGG_TIME = 0.22;

/** `egg`: still an egg (it cracks open just after it's let go); `armed`: counts for the line (it has landed) */
export type Ball = { id: number; tier: number; body: Matter.Body; born: number; egg: boolean; armed: boolean; squash: number; grow: number; merging: boolean };
export type DropEvent =
  | { k: 'drop'; tier: number; x: number }
  | { k: 'crack'; id: number; x: number; y: number; tier: number }
  | { k: 'land'; id: number; x: number; y: number; force: number }
  | { k: 'merge'; tier: number; x: number; y: number; points: number; chain: number }
  | { k: 'party'; x: number; y: number; points: number }
  | { k: 'gustWarn'; dir: -1 | 1 }
  | { k: 'gust'; dir: -1 | 1 }
  | { k: 'warn'; on: boolean }
  | { k: 'full' };

/** A day's jar: everyone in the family gets the same eggs in the same order (and the same winds). */
export function daySeed(dayKey: string) { return [...`jar${dayKey}`].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7) >>> 0; }

export class DropGame {
  readonly engine: Matter.Engine;
  readonly balls: Ball[] = [];
  private rng: Rng;
  private nextId = 1;
  score = 0;
  /** the egg in the cloud now, and the one after it */
  hold: number; next: number;
  /** where the egg will drop (jar units, its centre) */
  aim = JAR.w / 2;
  /** seconds since the start (game time) */
  t = 0;
  /** you can drop again after this */
  private readyAt = 0;
  chain = 0; private lastMerge = -9;
  best = { chain: 0, tier: 0, merges: 0 };
  over = 0; warning = false; done = false;
  /** wind: next gust time, the warning before it, the gust itself */
  private gustAt: number; gust: { dir: -1 | 1; warnUntil: number; until: number } | null = null;
  private pending: [Ball, Ball][] = [];
  private events: DropEvent[] = [];

  constructor(seed: number) {
    this.rng = mulberry32(seed);
    this.engine = Matter.Engine.create({ gravity: { x: 0, y: 1, scale: 0.0016 }, positionIterations: 8, velocityIterations: 6 });
    const W = JAR.w, H = JAR.h, T = 200;
    const wall = (x: number, y: number, w: number, h: number) => Matter.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.2, restitution: 0.1, label: 'wall' });
    // floor, walls (tall enough that nothing ever goes over them sideways)
    Matter.Composite.add(this.engine.world, [wall(W / 2, H + T / 2, W + T * 2, T), wall(-T / 2, H / 2 - 200, T, H + 600), wall(W + T / 2, H / 2 - 200, T, H + 600)]);
    this.hold = this.pick(); this.next = this.pick();
    this.gustAt = 30 + this.rng() * 12;
    Matter.Events.on(this.engine, 'collisionStart', e => this.touch(e.pairs, true));
    Matter.Events.on(this.engine, 'collisionActive', e => this.touch(e.pairs, false));
  }

  private pick(): number {
    // keep small eggs coming while the jar only has small ones (the first few drops)
    const top = Math.max(2, Math.min(4, 1 + Math.floor(this.balls.length / 3)));
    const ws = DROP_WEIGHTS.slice(0, top + 1), sum = ws.reduce((a, b) => a + b, 0);
    let r = this.rng() * sum;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; }
    return 0;
  }
  ballOf(b: Matter.Body) { return this.balls.find(x => x.body === b); }

  private touch(pairs: Matter.Pair[], first: boolean) {
    for (const p of pairs) {
      const a = this.ballOf(p.bodyA), b = this.ballOf(p.bodyB);
      // a new egg lands: it counts for the line from now on, and squashes a little
      for (const x of [a, b]) if (x && !x.armed && first) { x.armed = true; }
      if (first) {
        const speed = Math.abs((p.bodyA.velocity.y - p.bodyB.velocity.y)) + Math.abs(p.bodyA.velocity.x - p.bodyB.velocity.x);
        for (const x of [a, b]) if (x) { x.squash = Math.min(0.35, x.squash + speed * 0.03); if (speed > 2.5) this.events.push({ k: 'land', id: x.id, x: x.body.position.x, y: x.body.position.y, force: speed }); }
      }
      if (!a || !b || a.tier !== b.tier || a.merging || b.merging) continue;
      a.merging = b.merging = true;
      this.pending.push([a, b]);
    }
  }

  /** Move the cloud (jar units); the egg stays inside the jar. */
  setAim(x: number) { const r = CHAIN[this.hold].r; this.aim = Math.max(r + 2, Math.min(JAR.w - r - 2, x)); }
  canDrop() { return !this.done && this.t >= this.readyAt; }
  /** Let go of the egg. */
  drop(): boolean {
    if (!this.canDrop()) return false;
    const tier = this.hold, r = CHAIN[tier].r;
    const x = Math.max(r + 2, Math.min(JAR.w - r - 2, this.aim));
    this.add(tier, x, JAR.line - r - 30, false);
    this.events.push({ k: 'drop', tier, x });
    this.hold = this.next; this.next = this.pick();
    this.readyAt = this.t + 0.5;
    return true;
  }

  private add(tier: number, x: number, y: number, born: boolean): Ball {
    const r = CHAIN[tier].r;
    // a ball made by a merge starts small and grows (so it doesn't fling its neighbours)
    const start = born ? 0.55 : 1;
    const body = Matter.Bodies.circle(x, y, r * start, { restitution: 0.12, friction: 0.08, frictionStatic: 0.4, frictionAir: 0.004, density: 0.0012, label: 'ball' });
    Matter.Composite.add(this.engine.world, body);
    const ball: Ball = { id: this.nextId++, tier, body, born: this.t, egg: !born, armed: born, squash: born ? 0.3 : 0, grow: start, merging: false };
    this.balls.push(ball);
    return ball;
  }
  private remove(b: Ball) {
    Matter.Composite.remove(this.engine.world, b.body);
    const i = this.balls.indexOf(b); if (i >= 0) this.balls.splice(i, 1);
  }

  /** Advance the game by dt seconds; returns what happened. */
  step(dt: number): DropEvent[] {
    if (this.done) return this.flush();
    dt = Math.min(dt, 1 / 30);
    this.t += dt;
    // physics in small steps
    const n = Math.ceil(dt / (1 / 120));
    for (let i = 0; i < n; i++) Matter.Engine.update(this.engine, (dt / n) * 1000);
    // merges found while stepping
    for (const [a, b] of this.pending.splice(0)) {
      if (!this.balls.includes(a) || !this.balls.includes(b)) continue;
      const x = (a.body.position.x + b.body.position.x) / 2, y = (a.body.position.y + b.body.position.y) / 2;
      const vx = (a.body.velocity.x + b.body.velocity.x) / 2, vy = (a.body.velocity.y + b.body.velocity.y) / 2;
      this.remove(a); this.remove(b);
      this.chain = this.t - this.lastMerge < CHAIN_GAP ? this.chain + 1 : 1;
      this.lastMerge = this.t;
      this.best.merges++; this.best.chain = Math.max(this.best.chain, this.chain);
      const mult = 1 + (this.chain - 1) * 0.5;
      if (a.tier === TOP) {
        const pts = Math.round(PARTY_POINTS * mult);
        this.score += pts;
        this.events.push({ k: 'party', x, y, points: pts });
        continue;
      }
      const tier = a.tier + 1, pts = Math.round(pointsFor(tier) * mult);
      this.score += pts;
      this.best.tier = Math.max(this.best.tier, tier);
      const nb = this.add(tier, x, y, true);
      Matter.Body.setVelocity(nb.body, { x: vx * 0.5, y: Math.min(vy, 0) * 0.5 });
      this.events.push({ k: 'merge', tier, x, y, points: pts, chain: this.chain });
    }
    for (const b of this.balls) {
      // newly made ones grow to full size
      if (b.grow < 1) { const g = Math.min(1, b.grow + dt * 5); Matter.Body.scale(b.body, g / b.grow, g / b.grow); b.grow = g; }
      b.squash *= Math.exp(-dt * 7);
      // a dropped egg cracks open just after it's let go; it counts for the line once it lands (or soon)
      if (b.egg && this.t - b.born >= EGG_TIME) { b.egg = false; this.events.push({ k: 'crack', id: b.id, x: b.body.position.x, y: b.body.position.y, tier: b.tier }); }
      if (!b.armed && this.t - b.born > 1.4) b.armed = true;
    }
    this.wind(dt);
    // the line: anything settled above it for too long fills the jar
    const above = this.balls.some(b => b.armed && b.body.position.y - CHAIN[b.tier].r * b.grow < JAR.line && Math.abs(b.body.velocity.y) < 1.2);
    this.over = above ? this.over + dt : Math.max(0, this.over - dt * 2);
    const warn = this.over > OVER_WARN;
    if (warn !== this.warning) { this.warning = warn; this.events.push({ k: 'warn', on: warn }); }
    if (this.over > OVER_FULL) { this.done = true; this.events.push({ k: 'full' }); }
    return this.flush();
  }

  private wind(dt: number) {
    if (!this.gust && this.t >= this.gustAt) {
      const dir: -1 | 1 = this.rng() < 0.5 ? -1 : 1;
      this.gust = { dir, warnUntil: this.t + 1.6, until: this.t + 1.6 + 1.2 };
      this.events.push({ k: 'gustWarn', dir });
    }
    if (this.gust) {
      if (this.t >= this.gust.warnUntil && this.t - dt < this.gust.warnUntil) this.events.push({ k: 'gust', dir: this.gust.dir });
      if (this.t >= this.gust.warnUntil && this.t < this.gust.until) {
        for (const b of this.balls) Matter.Body.applyForce(b.body, b.body.position, { x: this.gust.dir * b.body.mass * 0.00022, y: 0 });
      }
      if (this.t >= this.gust.until) { this.gust = null; this.gustAt = this.t + 22 + this.rng() * 12; }
    }
  }
  private flush() { return this.events.splice(0); }
  /** End the round now (play time's up): what's in the jar stays scored. */
  stop() { this.done = true; }
}
