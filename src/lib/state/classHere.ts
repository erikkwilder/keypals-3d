// Players who logged in through a class on this computer (class code and two pictures: teach/student.svelte.ts).
// They belong to their class: saving online keeps them saved by their code, but a grown-up signed in here
// (a teacher at a classroom computer, a parent at home) never files them under their own account, and
// their save chip says "Saved with your class". "Done for today" takes them off this computer again.
const HERE = 'kp-class-here';

export function classHereCodes(): string[] {
  try { const v = JSON.parse(localStorage.getItem(HERE) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
}
export function setClassHere(codes: string[]) {
  try { localStorage.setItem(HERE, JSON.stringify([...new Set(codes)])); } catch { /* private window: nothing to remember */ }
}
/** Logged in through a class on this computer? */
export const isClassLogin = (p: { cloud?: { code: string } } | null | undefined) => !!p?.cloud && classHereCodes().includes(p.cloud.code);
