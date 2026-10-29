// "Don't count my visits": a switch on the Grown-ups screen, kept per computer. With it on (or with the
// browser's Do Not Track or Global Privacy Control turned on) this computer sends nothing by itself: no
// visit counts (counts.ts) and no automatic problem reports (reports.ts). Ideas, votes and problems a
// grown-up sends on purpose still go.
const NO_COUNT = 'kp-no-count';

/** The browser asks not to be tracked (Do Not Track, or Global Privacy Control). */
export function browserSaysNo(nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean } = typeof navigator === 'undefined' ? {} : (navigator as never)): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}
export function countingOff(): boolean {
  try { return localStorage.getItem(NO_COUNT) === '1'; } catch { return false; }
}
export function setCountingOff(off: boolean) {
  try { if (off) localStorage.setItem(NO_COUNT, '1'); else localStorage.removeItem(NO_COUNT); } catch { /* private window */ }
}
/** May this computer send counts and automatic reports? */
export const mayCount = () => !countingOff() && !browserSaysNo();
