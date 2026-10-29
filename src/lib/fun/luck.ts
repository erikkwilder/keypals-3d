// The little surprises: how rare each one is, and a small memory for them on this device. Nothing here
// touches progress or rewards; it's all just for fun.
const KEY = 'keypals-fun';
let all = false;
let seasonOverride: Season | null = null;
export type Season = 'pumpkins' | 'snow';
export function forceAll(on: boolean, season: Season | null = null) { all = on; seasonOverride = season; }
// dev builds only: localStorage 'keypals-eggs-all' = '1' (or 'pumpkins' / 'snow' for a season too) makes
// every surprise happen, so each can be checked. #eggs-all sets it (see state/dev.ts).
if (import.meta.env.DEV) { try { const v = localStorage.getItem('keypals-eggs-all'); if (v) forceAll(true, v === 'pumpkins' || v === 'snow' ? v : null); } catch { /* fine */ } }
export const everything = () => all;
/** true once in 1/p times (always with #eggs-all) */
export function chance(p: number) { return all || Math.random() < p; }

type Mem = Record<string, number | string>;
function read(): Mem { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Mem; } catch { return {}; } }
export function recall<T extends number | string>(k: string, d: T): T { const v = read()[k]; return (v ?? d) as T; }
export function remember(k: string, v: number | string) { try { const m = read(); m[k] = v; localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* private mode: it just won't remember */ } }

/** Pumpkins in the last days of October, snow in December and the first week of January. */
export function season(now = new Date()): Season | null {
  if (seasonOverride) return seasonOverride;
  const m = now.getMonth(), d = now.getDate();
  if ((m === 9 && d >= 20) || (m === 10 && d <= 2)) return 'pumpkins';
  if (m === 11 || (m === 0 && d <= 6)) return 'snow';
  return null;
}
