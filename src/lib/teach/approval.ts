// "Your classes are on": a teacher who waited for us (a plain Gmail account) is told once, the next time she
// opens her teacher page after an admin said yes (the server gives the yes's time: deploy/site/classes.js).
// Nothing is emailed. Which yes was shown is kept on this computer, so she isn't told again here.
const KEY = 'kp-teach-classes-on';
const DAY = 86400000;
/** Tell her? An admin's yes after waiting, in the last 30 days, and not shown on this computer yet. */
export function classesOnNote(t: { status?: string; approvedAt?: number } | null | undefined, seen: string | null, now = Date.now()): boolean {
  return !!t?.approvedAt && t.status === 'approved' && now - t.approvedAt < 30 * DAY && seen !== String(t.approvedAt);
}
export function seenNote(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } }
export function markNoteSeen(at: number) { try { localStorage.setItem(KEY, String(at)); } catch { /* not kept: she may be told again */ } }
