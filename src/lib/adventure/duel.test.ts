import { describe, expect, it } from 'vitest';
import { answerOf } from '../math/facts';
import { newDuel, duelPlay, duelFinale, duelRain, ghostMove, guestPool, progress, cur, type SideSetup, type Duel } from './duel';
import { newRivals, rollWeek, rivalsFor, styleOf, noteStats, newStats, UP_AT, weekKey, type GhostCopy } from './ghosts';
import { FINALE_AT } from './battle';
import { newProfile } from '../engine/profile';

const words = ['cat', 'dog', 'sun', 'happy', 'rocket', 'garden', 'planet', 'adventure', 'butterfly', 'tree', 'jump', 'kite', 'bubble', 'friend', 'island', 'castle'];
const side = (name: string, level: Parameters<typeof guestPool>[0], subject: 'math' | 'typing' = 'math', extra: Partial<SideSetup> = {}): SideSetup => ({
  name, buddy: 'dino', kind: 'guest', subject, pool: guestPool(level, subject, words), role: 'heart', gear: null, team: [], outfit: 'none', dance: 'dance_hiphop', ...extra,
});
/** answer the card with the biggest (or smallest) answer, right */
function playRight(d: Duel, small = false) {
  const s = cur(d);
  const c = s.b.cards.filter(c => c.fact).sort((x, y) => (answerOf(y.fact!) - answerOf(x.fact!)) * (small ? -1 : 1))[0];
  return duelPlay(d, c.id, { ok: true, value: answerOf(c.fact!), thinkMs: 2000, fact: c.fact });
}

describe('Family Duel', () => {
  it('sizes each cheer bar to its own questions, so little sums and big times tables are a fair race', () => {
    const d = newDuel(side('Mia', 'little'), side('Dad', 'grown'), 'embernewt', 7);
    const [a, b] = d.sides;
    expect(b.b.foe.max).toBeGreaterThan(a.b.foe.max * 5);
    // about seven good cards each
    const avg = (s: typeof a) => s.pool.subject === 'math' ? s.pool.facts.reduce((t, x) => t + answerOf(x.f), 0) / s.pool.facts.length : 1;
    expect(a.b.foe.max / avg(a)).toBeGreaterThan(5);
    expect(b.b.foe.max / avg(b)).toBeGreaterThan(5);
  });
  it('takes turns, and a wrong answer passes the turn too', () => {
    const d = newDuel(side('Mia', 'little'), side('Dad', 'grown'), 'puddlepup', 3);
    expect(d.turn).toBe(0);
    playRight(d);
    expect(d.turn).toBe(1);
    const c = cur(d).b.cards[0];
    const ev = duelPlay(d, c.id, { ok: false, value: 0, thinkMs: 2000, fact: c.fact });
    expect(ev.some(e => e.k === 'turn')).toBe(true);
    expect(d.turn).toBe(0);
  });
  it('three right in a row sends a rain cloud; blocking it keeps your cheer, missing it costs a little', () => {
    const d = newDuel(side('Mia', 'plus'), side('Dad', 'plus'), 'puddlepup', 11);
    let sent = false, dadTurns = 0;
    for (let i = 0; i < 6 && !sent; i++) {
      if (d.turn === 0) sent = playRight(d, true).some(e => e.k === 'sendRain');
      else if (dadTurns++ === 0) playRight(d, true);
      else { const c = cur(d).b.cards[0]; duelPlay(d, c.id, { ok: false, value: 0, thinkMs: 1000, fact: c.fact }); }
    }
    expect(sent).toBe(true);
    expect(d.phase).toBe('rain');
    const before = cur(d).b.foe.grump;
    const ev = duelRain(d, false, 9000);
    expect(ev[0].k).toBe('rainHit');
    expect(cur(d).b.foe.grump).toBeGreaterThan(before);
    expect(d.phase).toBe('pick');
  });
  it('fills the Finale after five right, and the first to cheer it all the way up wins', () => {
    const d = newDuel(side('Mia', 'plus'), side('Dad', 'plus'), 'puddlepup', 5);
    let guard = 0;
    while (d.phase !== 'won' && guard++ < 200) {
      if (d.phase === 'rain') duelRain(d, true, 100);
      else if (d.phase === 'finale') duelFinale(d);
      else if (d.turn === 0) playRight(d, true);
      else { const c = cur(d).b.cards[0]; duelPlay(d, c.id, { ok: false, value: 0, thinkMs: 1000, fact: c.fact }); }
    }
    expect(d.winner).toBe(0);
    expect(progress(d.sides[0])).toBe(1);
    expect(d.sides[0].finales).toBeGreaterThanOrEqual(1);
    expect(FINALE_AT).toBe(5);
  });
  it('a Pebble Tortoise on the team blocks the first rain cloud by itself', () => {
    const d = newDuel(side('Mia', 'plus'), side('Dad', 'plus', 'math', { team: [{ id: 'pebbletort', level: 1 }] }), 'puddlepup', 9);
    let saw = false;
    for (let i = 0; i < 8 && !saw; i++) {
      if (d.phase === 'finale') { duelFinale(d); continue; }
      if (d.turn === 0) saw = playRight(d).some(e => e.k === 'rainBlocked' && e.by === 'Pebble Shell');
      else { const c = cur(d).b.cards[0]; duelPlay(d, c.id, { ok: false, value: 0, thinkMs: 1000, fact: c.fact }); }
    }
    expect(saw).toBe(true);
  });
  it('typing guests get words of their length', () => {
    const many = [...words, ...'ant bee cow egg fan hat ink jam kid log map net owl pig'.split(' ')];
    const p = guestPool('little', 'typing', many);
    expect(p.subject === 'typing' && p.words.every(w => w.length <= 4)).toBe(true);
    const g = guestPool('grown', 'typing', many);
    expect(g.subject === 'typing' && g.words.includes('butterfly')).toBe(true);
  });
});

describe('Rival Ghosts', () => {
  it('a ghost plays like its player: a careful one is right far more often', () => {
    let careful = 0, careless = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const d1 = newDuel(side('Me', 'plus'), side('Ghost', 'plus', 'math', { kind: 'ghost', ghost: { acc: 0.95, thinkMs: 3000, big: 0.5 } }), 'puddlepup', seed);
      d1.turn = 1; if (ghostMove(d1)!.answer.ok) careful++;
      const d2 = newDuel(side('Me', 'plus'), side('Ghost', 'plus', 'math', { kind: 'ghost', ghost: { acc: 0.5, thinkMs: 3000, big: 0.5 } }), 'puddlepup', seed);
      d2.turn = 1; if (ghostMove(d2)!.answer.ok) careless++;
    }
    expect(careful).toBeGreaterThan(careless + 10);
  });
  it('remembers how you play, fading old games', () => {
    const s = newStats();
    noteStats(s, { answers: 10, right: 9, thinkMs: 30000 });
    expect(styleOf(s).acc).toBeCloseTo(0.9);
    expect(styleOf(s).thinkMs).toBe(3000);
  });
  it('moves up a league after a good week and keeps last week\'s you', () => {
    const t0 = new Date(2026, 9, 26, 12).getTime();
    const r = newRivals(1, t0);
    r.points = UP_AT;
    const me: GhostCopy = { buddy: 'dino', outfit: 'none', dance: 'x', team: [], subject: 'math', stats: { answers: 20, right: 16, thinkMs: 60000, big: 2, picks: 5 } };
    expect(rollWeek(r, me, t0 + 2 * 86400000)).toBe(false);
    expect(rollWeek(r, me, t0 + 8 * 86400000)).toBe(true);
    expect(r.league).toBe(1);
    expect(r.points).toBe(0);
    expect(r.past?.stats.answers).toBe(20);
    expect(weekKey(t0)).not.toBe(r.week);
  });
  it('offers family first, then island rivals made by the game', () => {
    const me = newProfile('Mia', 'dino'), sis = newProfile('Ava', 'koala');
    const copy = (p: typeof me): GhostCopy | null => p.id === sis.id ? { buddy: 'koala', outfit: 'none', dance: 'x', team: [], subject: 'math', stats: { answers: 30, right: 24, thinkMs: 120000, big: 3, picks: 8 } } : null;
    const list = rivalsFor(me, [me, sis], newRivals(2), copy);
    expect(list).toHaveLength(3);
    expect(list[0].kind).toBe('family');
    expect(list[0].name).toBe('Ava');
    expect(list.slice(1).every(r => r.kind === 'island')).toBe(true);
  });
});
