import { describe, expect, it } from 'vitest';
import { Counter, deviceType, isoWeek, localDay, minutesBucket, playerCounts, sinceBucket, summarize, type Batch, type Row } from './counts';
import { newProfile } from '../engine/profile';

const at = (s: string) => new Date(s).getTime();

describe('counting visits: the batches carry no identifiers', () => {
  it('a batch is the date and a list of {e, k, n}: nothing else, and nothing about the player', () => {
    const sent: Batch[] = [];
    const c = new Counter(b => sent.push(b));
    const mia = newProfile('Mia', 'dino');
    mia.cloud = { code: 'TIGER-MOON-RAIN-42', at: 1 };
    // a whole visit: opening, Mia's first visit, screens, a game
    c.add('open', 'computer');
    for (const x of playerCounts(undefined, mia.createdAt, Date.now()).counts) c.add(x.e, x.k, x.n);
    c.add('screen', 'hub'); c.add('screen', 'map'); c.add('screen', 'hub');
    c.add('game', 'math-trip'); c.add('subject', 'math'); c.add('area', 'math:twins'); c.add('game_min', '3-5'); c.add('stars', 'math:2'); c.add('play_sec', '', 214);
    c.add('signin', 'google');
    expect(c.flush(at('2026-10-29T10:00:00'))).toBe(true);
    expect(sent.length).toBe(1);
    const body = sent[0];
    expect(Object.keys(body).sort()).toEqual(['counts', 'day']);
    expect(body.day).toBe('2026-10-29');
    for (const x of body.counts) {
      expect(Object.keys(x).sort()).toEqual(['e', 'k', 'n']);
      expect(typeof x.n).toBe('number');
      expect(x.k).toMatch(/^[a-z0-9:+._<-]{0,40}$/);
    }
    const text = JSON.stringify(body);
    for (const secret of [mia.name, mia.id, mia.cloud.code, 'Mia', 'dino']) expect(text).not.toContain(secret);
    // repeats are added up, not sent one by one
    expect(body.counts.find(x => x.e === 'screen' && x.k === 'hub')!.n).toBe(2);
  });

  it('sends at most every 30 seconds, and straight away when the page is going away', () => {
    const sent: Batch[] = [];
    const c = new Counter(b => sent.push(b), 30000);
    c.add('screen', 'hub');
    expect(c.flush(1000)).toBe(true);
    c.add('screen', 'map');
    expect(c.flush(20000)).toBe(false);
    expect(c.flush(31001)).toBe(true);
    c.add('screen', 'arcade');
    expect(c.flush(32000, true)).toBe(true);
    expect(c.flush(90000)).toBe(false); // nothing waiting: nothing sent
    expect(sent.map(b => b.counts.map(x => x.k))).toEqual([['hub'], ['map'], ['arcade']]);
  });

  it('only known events, and keys cut down to short plain words', () => {
    const sent: Batch[] = [];
    const c = new Counter(b => sent.push(b));
    c.add('name' as never, 'Mia');
    c.add('screen', 'Some Screen <b>');
    c.add('screen', 'x', 0);
    c.flush(0, true);
    expect(sent[0].counts).toEqual([{ e: 'screen', k: 'some-screen-<b-', n: 1 }]);
  });
});

describe('daily, weekly and monthly players without ids', () => {
  it('first visit today, this week and this month; then nothing more that day', () => {
    const created = at('2026-09-01T09:00:00');
    const first = playerCounts(undefined, created, at('2026-10-29T09:00:00'));
    expect(first.counts.map(c => `${c.e}:${c.k}`)).toEqual(['player_day:', 'back:31+', 'player_week:', 'player_month:']);
    const again = playerCounts(first.seen, created, at('2026-10-29T18:00:00'));
    expect(again.counts).toEqual([]);
    // the next day, same week (Thursday to Friday)
    const friday = playerCounts(first.seen, created, at('2026-10-30T09:00:00'));
    expect(friday.counts.map(c => c.e)).toEqual(['player_day', 'back']);
    // a new month
    const nov = playerCounts(friday.seen, created, at('2026-11-02T09:00:00'));
    expect(nov.counts.map(c => c.e)).toEqual(['player_day', 'back', 'player_week', 'player_month']);
  });

  it('a new player is counted as new once, and "back after 1, 7, 30 days" are exact', () => {
    const created = at('2026-10-29T09:00:00');
    expect(playerCounts(undefined, created, at('2026-10-29T09:05:00')).counts.map(c => c.e)).toContain('player_new');
    expect(playerCounts({ d: '2026-10-28' }, created, at('2026-10-29T09:05:00')).counts.map(c => c.e)).not.toContain('player_new');
    expect(playerCounts(undefined, created, at('2026-10-30T09:00:00')).counts.find(c => c.e === 'back')!.k).toBe('1');
    expect([1, 2, 6, 7, 8, 30, 31].map(sinceBucket)).toEqual(['1', '2-6', '2-6', '7', '8-29', '30', '31+']);
  });

  it('weeks, minutes and devices', () => {
    expect(isoWeek(at('2026-10-29T12:00:00'))).toBe('2026-W44');
    expect(isoWeek(at('2027-01-01T12:00:00'))).toBe('2026-W53');
    expect(localDay(at('2026-10-29T23:30:00'))).toBe('2026-10-29');
    expect([30, 90, 240, 500, 900, 2000].map(minutesBucket)).toEqual(['<1', '1-2', '3-5', '6-10', '11-20', '20+']);
    expect(deviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 390, 5)).toBe('phone');
    expect(deviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 1024, 5)).toBe('tablet');
    expect(deviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 900, 0)).toBe('computer');
  });
});

describe('the Admin numbers', () => {
  it('adds up daily players, new players, minutes, coming back and the top lists', () => {
    const rows: Row[] = [
      { day: '2026-10-28', event: 'player_new', key: '', n: 4 },
      { day: '2026-10-28', event: 'player_day', key: '', n: 10 },
      { day: '2026-10-28', event: 'player_week', key: '', n: 10 },
      { day: '2026-10-28', event: 'player_month', key: '', n: 10 },
      { day: '2026-10-29', event: 'player_day', key: '', n: 7 },
      { day: '2026-10-29', event: 'player_week', key: '', n: 2 },
      { day: '2026-10-29', event: 'back', key: '1', n: 3 },
      { day: '2026-10-29', event: 'play_sec', key: '', n: 600 },
      { day: '2026-10-29', event: 'game', key: 'math-trip', n: 5 },
      { day: '2026-10-29', event: 'game', key: 'typing-lesson', n: 9 },
      { day: '2026-10-29', event: 'open', key: 'phone', n: 2 },
      { day: '2026-10-29', event: 'country', key: 'US', n: 2 },
    ];
    const s = summarize(rows, '2026-10-29');
    expect(s.days.length).toBe(30);
    expect(s.days[29]).toBe('2026-10-29');
    expect(s.today).toBe(7);
    expect(s.week).toBe(12);
    expect(s.month).toBe(10);
    expect(s.newPlayers).toBe(4);
    expect(s.minutes[29]).toBe(10);
    expect(s.retention[0]).toEqual({ after: 1, back: 3, started: 4 });
    expect(s.top.game.map(g => g.key)).toEqual(['typing-lesson', 'math-trip']);
    expect(s.top.country).toEqual([{ key: 'US', n: 2 }]);
    expect(s.top.device).toEqual([{ key: 'phone', n: 2 }]);
  });
});
