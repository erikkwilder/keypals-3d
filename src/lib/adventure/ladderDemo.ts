// Dev only (#book=demo, state/dev.ts): fill in a player's Glimmer Book halfway through a first year, so
// every kind of place shows: met ones (a few ladder ones too, as if their models were in), goals part way,
// a special egg waiting, a secret found, a season counting, the coming worlds' places.
import { dayKey, type Profile } from '../engine/profile';
import { GLIMMERS, type GlimmerId } from './glimmers';
import { advOf } from './state';
import { ladderOf, windowsOf } from './ladderSave';

export function ladderDemo(p: Profile) {
  const a = advOf(p), now = Date.now(), L = ladderOf(p, a);
  GLIMMERS.slice(0, 24).forEach((g, i) => { a.glimmers[g.id] ??= { level: 3 + (i % 6), xp: 0, got: now, evolved: i % 4 === 0 }; });
  for (const id of ['fireflyfawn', 'maplepanda', 'bookworm'] as GlimmerId[]) a.glimmers[id] ??= { level: 2, xp: 0, got: now };
  L.right = Math.max(L.right, 3400); L.days = Math.max(L.days, 37); L.lastDay = dayKey(now - 86_400_000);
  for (const w of windowsOf(dayKey(now), p.createdAt)) L.seasons[w] = Math.max(L.seasons[w] ?? 0, 3);
  if (!L.secrets.includes('hut')) L.secrets.push('hut');
  p.lessons.demo = { stars: 2, bestWpm: 17, bestAcc: 0.95, bestRide: 1, attempts: 1, passes: 1, lastAt: now };
  a.nodes['caves-0'] = Math.max(a.nodes['caves-0'] ?? 0, 7); a.nodes['caves-1'] = Math.max(a.nodes['caves-1'] ?? 0, 6);
  a.nodes['market-0'] = Math.max(a.nodes['market-0'] ?? 0, 3);
  // a Collection egg waiting in the nest (25 met)
  if (![...a.incubator, ...a.nest].some(e => e?.glimmer === 'gemmagpie')) a.nest.unshift({ id: 'egg-demo-gemmagpie', rarity: 'rare', need: 45, have: 45, got: now, glimmer: 'gemmagpie', kind: 'collection' });
  L.given.gemmagpie = dayKey(now);
}
