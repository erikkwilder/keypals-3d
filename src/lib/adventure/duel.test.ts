import { describe, expect, it } from 'vitest';
import { answerOf } from '../math/facts';
import { newDuel, duelPlay, duelFinale, duelRain, ghostMove, guestPool, progress, cur, DUEL_BAR, DUEL_CARD, type SideSetup, type Duel } from './duel';
import { newRivals, rollWeek, rivalsFor, styleOf, noteStats, newStats, UP_AT, weekKey, type GhostCopy } from './ghosts';
import { FINALE_AT, powered, typePower } from './battle';
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
  it('typing: slips lower a word\'s fill the same way as in a battle, and enough of them fill nothing', () => {
    const d = newDuel(side('Mia', 'little', 'typing'), side('Dad', 'grown', 'typing'), 'embernewt', 3);
    const a = d.sides[0], c = a.b.cards[0], len = c.word!.length;
    const ev = duelPlay(d, c.id, { ok: true, value: len, slips: 2, thinkMs: 2000 });
    const cast = ev.find(e => e.k === 'cast');
    expect(cast && cast.k === 'cast' && cast.slips).toBe(2);
    expect(a.b.foe.grump).toBe(DUEL_BAR - powered(DUEL_CARD, typePower(len, 2)));
    expect(DUEL_BAR - a.b.foe.grump).toBeLessThan(DUEL_CARD);
    // Dad mashes: nothing fills, and it counts as a miss
    const b = d.sides[1], cb = b.b.cards[0];
    const ev2 = duelPlay(d, cb.id, { ok: true, value: cb.word!.length, slips: 9, thinkMs: 2000 });
    expect(ev2.find(e => e.k === 'cast')).toMatchObject({ ok: false, value: 0, power: 0 });
    expect(b.b.foe.grump).toBe(DUEL_BAR);
  });
  it('every right answer fills the same amount on bars of the same size, whatever the level', () => {
    const d = newDuel(side('Mia', 'little'), side('Dad', 'grown'), 'embernewt', 7);
    const [a, b] = d.sides;
    expect(a.b.foe.max).toBe(DUEL_BAR);
    expect(b.b.foe.max).toBe(DUEL_BAR);
    playRight(d, true);
    expect(a.b.foe.grump).toBe(DUEL_BAR - DUEL_CARD);
    playRight(d);
    expect(b.b.foe.grump).toBe(DUEL_BAR - DUEL_CARD);
  });
  it('two players who get everything right tie, whatever their level (the second gets a last turn)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const d = newDuel(side('Mia', 'little'), side('Dad', 'grown'), 'puddlepup', seed);
      let lastTurn = false, guard = 0;
      while (d.phase !== 'won' && guard++ < 200) {
        const ev = d.phase === 'rain' ? duelRain(d, true, 100) : d.phase === 'finale' ? duelFinale(d) : playRight(d);
        if (ev.some(e => e.k === 'lastTurn')) lastTurn = true;
      }
      expect(lastTurn).toBe(true);
      expect(d.tie).toBe(true);
    }
  });
  it('one slip is enough for the other to win; going second and filling first wins outright', () => {
    const play = (slipBy: 0 | 1, slips: number) => {
      const d = newDuel(side('Mia', 'plus'), side('Dad', 'times'), 'puddlepup', 21);
      let left = slips, guard = 0;
      while (d.phase !== 'won' && guard++ < 200) {
        if (d.phase === 'rain') duelRain(d, true, 100);
        else if (d.phase === 'finale') duelFinale(d);
        else if (d.turn === slipBy && left > 0 && d.turns > 2) { left--; const c = cur(d).b.cards[0]; duelPlay(d, c.id, { ok: false, value: 0, thinkMs: 1000, fact: c.fact }); }
        else playRight(d);
      }
      return d;
    };
    const a = play(1, 1);
    expect(a.winner).toBe(0); expect(a.tie).toBe(false);
    const b = play(0, 2);
    expect(b.winner).toBe(1); expect(b.tie).toBe(false); expect(b.filled).toBe(null);
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
