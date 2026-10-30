// Counting how many people play and what they play, without knowing who anyone is. The game decides
// everything on the device and sends only counts: "one more player today", "the Arcade opened twice",
// "a math trip of 3-5 minutes with 2 stars". No names, save codes, ids, addresses or browser strings, and
// nothing that stays the same from one batch to the next. The server adds them into daily totals
// (worker.js "counts"). This file is the part that can be tested; counting.ts wires it to the game.
//
// Daily, weekly and monthly players are counted without ids: each computer remembers, per player, the
// last day, week and month it counted them, and sends "one more" only the first time in each. Coming
// back (retention) works the same way: on a player's first visit of a day the device sends how many days
// it has been since the player started, in a few buckets.

export const EVENTS = [
  'open', // the game opened; key: phone | tablet | computer
  'player_day', 'player_week', 'player_month', 'player_new', // a player's first visit today / this week / this month / ever
  'back', // a player's first visit today; key: days since they started (0, 1, 2-6, 7, 8-29, 30, 31+)
  'screen', // a screen opened; key: its name
  'game', 'subject', 'area', 'game_min', 'stars', // a game finished: its kind, subject, area, minutes bucket, stars
  'play_sec', // seconds spent in games (n is the seconds)
  'signin', // a grown-up signed in; key: google | microsoft
] as const;
export type EventName = (typeof EVENTS)[number];
export type Count = { e: EventName; k: string; n: number };
/** What goes to the server: the device's date and the counts. Nothing else. */
export type Batch = { day: string; counts: Count[] };

const pad = (n: number) => String(n).padStart(2, '0');
/** this computer's date, YYYY-MM-DD */
export const localDay = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** the ISO week, YYYY-Www */
export function isoWeek(t: number): string {
  const d = new Date(t); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  const w = 1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${pad(w)}`;
}
const dayNumber = (day: string) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86400000);
/** days since a player started, in buckets (exact for 1, 7 and 30: the retention days) */
export function sinceBucket(days: number): string {
  return days <= 0 ? '0' : days === 1 ? '1' : days < 7 ? '2-6' : days === 7 ? '7' : days < 30 ? '8-29' : days === 30 ? '30' : '31+';
}
export function minutesBucket(sec: number): string {
  const m = sec / 60;
  return m < 1 ? '<1' : m < 3 ? '1-2' : m < 6 ? '3-5' : m < 11 ? '6-10' : m < 21 ? '11-20' : '20+';
}
/** a key: short, plain letters and numbers (a screen or game name, a bucket) */
export const cleanKey = (k: string) => String(k).toLowerCase().replace(/[^a-z0-9:+._<-]+/g, '-').slice(0, 40);

/** What this computer remembers about one player for counting: the last day, week and month counted. */
export type Seen = { d?: string; w?: string; m?: string };
/** A player's first visit today / this week / this month (and ever, on this computer, if they started today). */
export function playerCounts(seen: Seen | undefined, createdAt: number, now: number): { counts: Count[]; seen: Seen } {
  const day = localDay(now), week = isoWeek(now), month = day.slice(0, 7);
  const s = { ...(seen ?? {}) };
  const counts: Count[] = [];
  if (s.d !== day) {
    const since = Math.max(0, dayNumber(day) - dayNumber(localDay(createdAt || now)));
    counts.push({ e: 'player_day', k: '', n: 1 }, { e: 'back', k: sinceBucket(since), n: 1 });
    if (since === 0 && !s.d) counts.push({ e: 'player_new', k: '', n: 1 });
    s.d = day;
  }
  if (s.w !== week) { counts.push({ e: 'player_week', k: '', n: 1 }); s.w = week; }
  if (s.m !== month) { counts.push({ e: 'player_month', k: '', n: 1 }); s.m = month; }
  return { counts, seen: s };
}

/** phone, tablet or computer, from the screen and the browser string (only the answer is sent) */
export function deviceType(ua: string, minSide: number, touch: number): 'phone' | 'tablet' | 'computer' {
  if (/iPhone|iPod|Android.*Mobile|Mobile.*Firefox|Windows Phone/i.test(ua) || (touch > 0 && minSide < 600)) return 'phone';
  if (/iPad|Tablet|Android|Silk|Kindle/i.test(ua) || (touch > 1 && /Macintosh/.test(ua))) return 'tablet';
  return 'computer';
}

/** Collects counts on the device, adds up repeats, and sends them at most every `everyMs` (and when the
 *  page is hidden, by the caller). */
export class Counter {
  private q = new Map<string, Count>();
  private last = -Infinity;
  constructor(private send: (b: Batch, leaving: boolean) => void, private everyMs = 30000) {}
  add(e: EventName, k = '', n = 1) {
    if (!(EVENTS as readonly string[]).includes(e) || !(n > 0)) return;
    const key = cleanKey(k), id = `${e}\u0000${key}`;
    const c = this.q.get(id);
    if (c) c.n += Math.round(n); else this.q.set(id, { e, k: key, n: Math.round(n) });
  }
  get size() { return this.q.size; }
  /** Send what's waiting, if it's been long enough since the last send (or the page is going away). */
  flush(now: number, leaving = false) {
    if (!this.q.size || (!leaving && now - this.last < this.everyMs)) return false;
    const counts = [...this.q.values()].filter(c => c.n > 0);
    this.q.clear();
    this.last = now;
    if (counts.length) this.send({ day: localDay(now), counts }, leaving);
    return true;
  }
  /** "Don't count my visits" was turned on: forget what's waiting. */
  clear() { this.q.clear(); }
}

// ---------- the Admin numbers, from the server's daily totals ----------
export type Row = { day: string; event: string; key: string; n: number };
export type Summary = {
  days: string[];
  daily: number[]; fresh: number[]; minutes: number[]; opens: number[];
  today: number; week: number; month: number; newPlayers: number; minutesTotal: number; visits: number;
  weeks: { week: string; n: number }[]; months: { month: string; n: number }[];
  retention: { after: number; back: number; started: number }[];
  top: Record<'game' | 'screen' | 'subject' | 'area' | 'device' | 'country' | 'stars' | 'game_min' | 'signin', { key: string; n: number }[]>;
};
/** The last `span` days (ending `today`, YYYY-MM-DD) of daily totals, ready to draw. */
export function summarize(rows: Row[], today: string, span = 30): Summary {
  const t = dayNumber(today);
  const dayAt = (i: number) => new Date((t - i) * 86400000).toISOString().slice(0, 10);
  const days = Array.from({ length: span }, (_, i) => dayAt(span - 1 - i));
  const inSpan = new Set(days);
  const sum = (event: string, day?: string, key?: string) => rows.reduce((a, r) => a + (r.event === event && (day === undefined || r.day === day) && (key === undefined || r.key === key) ? r.n : 0), 0);
  const per = (event: string) => days.map(d => sum(event, d));
  const daily = per('player_day'), fresh = per('player_new'), opens = per('open');
  const minutes = days.map(d => Math.round(sum('play_sec', d) / 60));
  const weekOf = (d: string) => isoWeek(new Date(`${d}T12:00:00`).getTime());
  const group = (event: string, by: (d: string) => string) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.event === event) m.set(by(r.day), (m.get(by(r.day)) ?? 0) + r.n);
    return m;
  };
  const wk = group('player_week', weekOf), mo = group('player_month', d => d.slice(0, 7));
  const weeks = [...wk.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-5).map(([week, n]) => ({ week, n }));
  const months = [...mo.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-3).map(([month, n]) => ({ month, n }));
  // back after N days: players on their Nth day who came back, of the players who started N days before
  const retention = [1, 7, 30].map(after => {
    let back = 0, started = 0;
    for (const d of days) {
      const startDay = new Date((dayNumber(d) - after) * 86400000).toISOString().slice(0, 10);
      const s = sum('player_new', startDay);
      if (!s) continue;
      started += s; back += sum('back', d, String(after));
    }
    return { after, back, started };
  });
  const rank = (event: string) => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.event === event && inSpan.has(r.day)) m.set(r.key, (m.get(r.key) ?? 0) + r.n);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({ key, n }));
  };
  return {
    days, daily, fresh, minutes, opens,
    today: daily[daily.length - 1] ?? 0,
    week: wk.get(weekOf(today)) ?? 0,
    month: mo.get(today.slice(0, 7)) ?? 0,
    newPlayers: fresh.reduce((a, b) => a + b, 0),
    minutesTotal: minutes.reduce((a, b) => a + b, 0),
    visits: opens.reduce((a, b) => a + b, 0),
    weeks, months, retention,
    top: { game: rank('game'), screen: rank('screen'), subject: rank('subject'), area: rank('area'), device: rank('open'), country: rank('country'), stars: rank('stars'), game_min: rank('game_min'), signin: rank('signin') },
  };
}
