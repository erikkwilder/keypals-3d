// A battle with less motion (calm.ts): what moves there for its own sake stands still while nothing happens,
// and its attacks, hits and reactions play as ever. The scene needs WebGL, so these read its source, as
// fx.test.ts does; the clocks themselves are tested in calm.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const battle = src('./battleScene.ts');
/** a method's body: from its first line to its closing brace (two spaces in) */
const body = (s: string, start: string) => {
  const i = s.indexOf(start);
  expect(i, start).toBeGreaterThan(-1);
  return s.slice(i, s.indexOf('\n  }\n', i));
};
const update = body(battle, '  update(dt: number, t: number) {');

describe('a battle with less motion: the arena', () => {
  it('the banners wave and the torches flicker by the decorative clock, so with less motion they stand still', () => {
    expect(update).toContain('const dT = stage.decorT;');
    expect(update).toMatch(/for \(const b of this\.banners\) \{[^\n]*p\.setZ\(i, Math\.sin\(dT \* 2\.6 \+ y \* 4 \+ b\.id\) \* 0\.06 \* y\)/);
    expect(update).toContain('this.lights.forEach((l, i) => (l.intensity = 6 + Math.sin(dT * 13 + i * 2) * 0.8 + Math.sin(dT * 7.3 + i) * 0.6));');
    // neither goes by the stage's own clock any more
    const lines = update.split('\n').filter(l => /this\.banners\)|this\.lights\.forEach/.test(l));
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l).not.toMatch(/\bt \*/);
  });

  it("the faint shield's breathing while the block question is up goes by it too; its snap up doesn't", () => {
    const shield = body(battle, '  private updateShield(dt: number, dT: number) {');
    expect(update).toContain('this.updateShield(dt, dT);');
    expect(shield).toContain(': 0.78 + 0.04 * Math.sin(dT * 7);');
    expect(shield).toContain("this.shieldMode === 'up' ? 1 + 0.22 * Math.sin(Math.min(1, this.shieldAge / 0.28) * Math.PI)");
    // (and with less motion it has no flash, from before)
    expect(shield).toContain('const flash = calm.on ? 0 : this.shieldFlash;');
  });

  it('the fire bowls\' sparks and the floating motes are steady ones (none with less motion)', () => {
    expect(update).toContain('for (const f of this.fires) this.fx.emit({ steady: true, ');
    expect(update).toContain('this.moteT = 0.12; this.fx.emit({ steady: true, ');
  });
});

describe('a battle with less motion: the buddy, the Grumble and the team hold their pose while they only stand there', () => {
  it("the buddy's pose holds while it only stands there, as on the title; its moves keep it going", () => {
    expect(battle).toContain('private meHold = new IdleHold();');
    expect(update).toContain('me.update(this.meHold.step(dt, this.now <= this.busyUntil || me.busy, calm.on));');
    // each of its moves (a cast, a stumble, a cheer, the Finale's dance) keeps it busy for as long as it lasts
    expect(battle).toContain('const a = this.me.play(n, 0.2); a?.reset();\n    this.busyUntil = this.now + secs;');
  });

  it('each of the team goes by its own clock, held while it only stands there', () => {
    expect(battle).toContain('private teamClocks = [new HeldClock(), new HeldClock()];');
    expect(update).toContain('g.update(c.step(dt, t, g.busy, calm.on), c.t);');
  });

  it("the Grumble's cloud, its rain and its sulky sway go by its own clock; a hit, its stomp, its laugh and the cheer-up keep it going", () => {
    const up = body(src('./grumpyGlimmer.ts'), '  update(dt: number, t: number) {');
    expect(up).toContain('this.clock.step(dt, t, this.glimmer.busy || (this.bursting >= 0 && this.bursting < 1) || this.laughT > 0, calm.on), st = this.clock.t;');
    // every sway on the battle's own clock is gone but the anger mark's, which shows a hit
    const onT = up.split('\n').filter(l => /Math\.sin\(t \*/.test(l));
    expect(onT).toHaveLength(1);
    expect(onT[0]).toContain('this.markT > 0');
    // (the puffs breathing and drifting, three; the cloud bobbing, two)
    expect(up.match(/Math\.sin\(st \* /g)?.length).toBe(5);
    expect(up).toContain('const y = this.rainPos[i * 6 + 1] - sd * 3.4;');
    expect(up).toContain('this.glimmer.update(sd, st);');
    // now and then lightning for its own sake: none with less motion
    expect(up).toMatch(/if \(!calm\.on\) this\.fx\.lightning\(/);
    // what shows something stays on the battle's clock: its mood lifting, the cheer-up's burst, the anger mark
    expect(up).toContain('this.shown += (this.mood - this.shown) * Math.min(1, dt * 2.5);');
    expect(up).toContain('this.bursting = Math.min(1, this.bursting + dt * 1.6);');
    expect(up).toContain('this.markT = Math.max(0, this.markT - dt);');
  });

  it("a Glimmer is busy while a move plays, its own or its skeleton's", () => {
    expect(src('./glimmerModel.ts')).toContain("get busy() { return this.move !== 'idle' || !!this.anim?.acting; }");
  });
});

describe('a battle with less motion: the camera', () => {
  const cam = body(battle, '  private camera(dt: number) {');
  it("its slow sway round the arena goes by the decorative clock, as the title's does, so with less motion it holds", () => {
    expect(cam).toContain('const sway = Math.sin(stage.decorT * 0.25) * 0.12;');
    expect(update).toContain('this.camera(dt);');
  });

  it('with less motion the last of its ease lands, so it stands still at once; its moves for something ease as ever', () => {
    expect(cam).toContain('easeTo(this.camPos, wantPos, k, calm.on); easeTo(this.camAim, aim, k, calm.on);');
    expect(cam).not.toContain('.lerp(wantPos, k)');
    // the push in on a cast, close on the buddy for the Finale, onto the new Glimmer: as before
    expect(battle).toContain("this.shot = 'push'; this.shotUntil = this.now + 1.1;");
    expect(battle).toContain("this.shot = 'buddy'; this.shotUntil = this.now + 3.2;");
    expect(battle).toContain("this.shot = 'reveal'; this.shotUntil = this.now + 99;");
    // (and no shake with less motion, from before)
    expect(cam).toContain('shakeOf(this.shake)');
  });

  it('nothing in the battle sways by its own clock any more: every sway goes by the decorative clock', () => {
    expect(battle).not.toMatch(/Math\.sin\(t \*/);
  });
});
