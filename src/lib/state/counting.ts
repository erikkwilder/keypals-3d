// Counting visits (counts.ts has the rules): the game opening, players' first visits of the day, week and
// month, screens opened, games finished, minutes played and grown-up sign-ins, sent as plain counts at
// most every 30 seconds and when the page is hidden. Nothing is sent when "Don't count my visits" is on
// (Grown-ups screen), when the browser asks not to be tracked (Do Not Track, Global Privacy Control), from
// the dev server, or where saving online isn't available.
import { game, type Screen } from './game.svelte';
import { Counter, deviceType, minutesBucket, playerCounts, type Batch, type EventName, type Seen } from './counts';
import { mayCount } from './privacy';
import type { Profile } from '../engine/profile';

const counter = new Counter(send);
function send(b: Batch, leaving: boolean) {
  const body = JSON.stringify(b);
  // leaving the page: the browser delivers it after the page is gone
  if (leaving && navigator.sendBeacon?.('api/count', new Blob([body], { type: 'text/plain' }))) return;
  void fetch('api/count', { method: 'POST', headers: { 'content-type': 'text/plain' }, body, keepalive: true }).catch(() => null);
}
let on = false;
/** count one thing (if counting is allowed here) */
export function count(e: EventName, k = '', n = 1) {
  if (!on) return;
  if (!mayCount()) { counter.clear(); return; }
  counter.add(e, k, n);
}

// ---------- players: first visit today / this week / this month, remembered per player on this computer ----------
const SEEN = 'kp-counted';
const counted = new Set<string>();
function loadSeen(): Record<string, Seen> { try { return JSON.parse(localStorage.getItem(SEEN) ?? '{}') ?? {}; } catch { return {}; } }
/** A player is playing (once a session each). */
export function countPlayer(p: Profile) {
  if (!on || counted.has(p.id) || !mayCount()) return;
  counted.add(p.id);
  const all = loadSeen();
  const r = playerCounts(all[p.id], p.createdAt, Date.now());
  for (const c of r.counts) counter.add(c.e, c.k, c.n);
  all[p.id] = r.seen;
  // forget players no longer on this computer
  for (const id of Object.keys(all)) if (!game.save.profiles.some(x => x.id === id)) delete all[id];
  try { localStorage.setItem(SEEN, JSON.stringify(all)); } catch { /* counted again next time: fine */ }
}

// ---------- screens and games ----------
type Kind = { kind: string; subject: string; area: string };
const head = (id: string | null | undefined) => (id ?? '').split('-')[0] || 'other';
/** What kind of game a screen is (null: not a game). */
function gameOf(s: Screen): Kind | null {
  switch (s) {
    case 'run': return { kind: 'typing-lesson', subject: 'typing', area: head(game.lessonId) };
    case 'mathRun': return { kind: 'math-trip', subject: 'math', area: head(game.mathLessonId) };
    case 'skillRun': return { kind: 'skill-trip', subject: 'math', area: head(game.skillLessonId) };
    case 'arcadePlay': return { kind: `arcade-${game.arcadeGame}`, subject: 'arcade', area: game.arcadeDaily ? 'daily' : 'free' };
    case 'battle': return { kind: 'battle', subject: 'adventure', area: head(game.battleNode) };
    case 'drop': return { kind: 'glimmer-drop', subject: 'arcade', area: 'drop' };
    case 'duel': return { kind: game.duelMode === 'rival' ? 'rival-ghost' : 'family-duel', subject: 'adventure', area: game.duelMode };
    case 'playground': case 'pizza': case 'builder': case 'market': case 'smoothie': case 'showdown': return { kind: s, subject: 'math', area: 'playground' };
    case 'garden': return { kind: 'fact-garden', subject: 'math', area: 'garden' };
    case 'learn': return { kind: 'learn', subject: 'math', area: head(game.learnId) };
    default: return null;
  }
}
const starsAfter = (next: Screen): number | null =>
  next === 'results' ? game.last?.stars ?? null : next === 'mathResults' ? game.mathLast?.stars ?? null : next === 'skillResults' ? game.skillLast?.stars ?? null : null;

/** the game being played: what it is, and how long it's been in view */
let stint: { kind: Kind; ms: number; since: number | null } | null = null;
const elapsed = (now: number) => (stint && stint.since !== null ? now - stint.since : 0);
let lastScreen: Screen | null = null;
/** The screen changed (App calls this on every change). */
export function countScreen(s: Screen) {
  if (!on || s === lastScreen) return;
  const now = Date.now();
  if (stint && lastScreen) {
    const ms = stint.ms + elapsed(now);
    count('play_sec', '', Math.round(elapsed(now) / 1000));
    // a game counts once it's been played for 15 seconds
    if (ms >= 15000) {
      const k = stint.kind, stars = starsAfter(s);
      count('game', k.kind); count('subject', k.subject); count('area', `${k.subject}:${k.area}`); count('game_min', minutesBucket(ms / 1000));
      if (stars !== null) count('stars', `${k.subject}:${stars}`);
    }
  }
  lastScreen = s;
  count('screen', s);
  const k = gameOf(s);
  stint = k ? { kind: k, ms: 0, since: document.visibilityState === 'visible' ? now : null } : null;
}

/** Start counting (once, when saving online is available). */
export function startCounting() {
  if (on || import.meta.env.DEV) return;
  on = true;
  count('open', deviceType(navigator.userAgent, Math.min(screen.width, screen.height), navigator.maxTouchPoints ?? 0));
  countScreen(game.screen);
  if (game.profile && !['title', 'players', 'newPlayer'].includes(game.screen)) countPlayer(game.profile);
  setInterval(() => counter.flush(Date.now()), 30000);
  document.addEventListener('visibilitychange', () => {
    const now = Date.now();
    if (document.visibilityState === 'hidden') {
      // the minutes so far count now (the page may not come back)
      if (stint && stint.since !== null) { count('play_sec', '', Math.round((now - stint.since) / 1000)); stint.ms += now - stint.since; stint.since = null; }
      if (mayCount()) counter.flush(now, true); else counter.clear();
    } else if (stint && stint.since === null) stint.since = now;
  });
  window.addEventListener('pagehide', () => { if (mayCount()) counter.flush(Date.now(), true); });
}
