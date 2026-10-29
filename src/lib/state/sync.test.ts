import { describe, expect, it } from 'vitest';
import { goneNote, planSync, type AccountPlayer, type LocalPlayer } from './sync';

const acct = (...ps: [string, number][]): AccountPlayer[] => ps.map(([code, updated]) => ({ code, name: code.toLowerCase(), updated }));

describe('players follow the grown-up on every computer', () => {
  it('brings every player in the account to a computer that does not have them', () => {
    const here: LocalPlayer[] = [{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }];
    const plan = planSync(here, acct(['MIA-1', 10], ['SAM-2', 20], ['ZOE-3', 30]), [], []);
    expect(plan.add).toEqual(['SAM-2', 'ZOE-3']);
    expect(plan.pull).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('catches up a player changed on another computer, and leaves one that is up to date', () => {
    const here: LocalPlayer[] = [{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }, { id: 'b', name: 'Sam', code: 'SAM-2', at: 20 }];
    const plan = planSync(here, acct(['MIA-1', 15], ['SAM-2', 20]), [], []);
    expect(plan.pull).toEqual(['MIA-1']);
    expect(plan.add).toEqual([]);
  });

  it('files a player made here (no code yet) under the account straight away, but never a test player', () => {
    const here: LocalPlayer[] = [{ id: 'new', name: 'Ava' }, { id: 'tester', name: 'Tester', localOnly: true }];
    const plan = planSync(here, acct(), [], []);
    expect(plan.file).toEqual(['new']);
  });

  it('files a player brought here by code that is not in the account yet', () => {
    const plan = planSync([{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }], acct(), [], []);
    expect(plan.link).toEqual(['MIA-1']);
  });

  it('deleted everywhere: every computer removes its copy', () => {
    const here: LocalPlayer[] = [{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }, { id: 'b', name: 'Sam', code: 'SAM-2', at: 20 }];
    const plan = planSync(here, acct(['SAM-2', 20]), [{ code: 'MIA-1', at: 99 }], []);
    expect(plan.remove).toEqual([{ id: 'a', name: 'Mia', code: 'MIA-1' }]);
    expect(plan.pull).toEqual([]);
    expect(plan.add).toEqual([]);
    expect(goneNote(plan.remove.map(r => r.name))).toBe("Mia's player was deleted by a grown-up.");
  });

  it('the tombstone beats an old copy played offline since (it is removed, never re-sent or re-filed)', () => {
    // the tablet was offline: it played Mia after the delete, and its copy still has Mia's code
    const tablet: LocalPlayer[] = [{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }];
    const plan = planSync(tablet, acct(), [{ code: 'MIA-1', at: 50 }], [], true);
    expect(plan.remove.map(r => r.id)).toEqual(['a']);
    expect(plan.link).toEqual([]);
    expect(plan.pull).toEqual([]);
    expect(plan.file).toEqual([]);
  });

  it('a deleted player is never brought back from the account list (even if a stale list still has it)', () => {
    const plan = planSync([], acct(['MIA-1', 10]), [{ code: 'MIA-1', at: 50 }], []);
    expect(plan.add).toEqual([]);
  });

  it('just this computer: it stays in the account but does not come back here', () => {
    const plan = planSync([{ id: 'b', name: 'Sam', code: 'SAM-2', at: 20 }], acct(['MIA-1', 10], ['SAM-2', 20]), [], ['MIA-1']);
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
    // another computer, without that choice, still gets it
    expect(planSync([], acct(['MIA-1', 10]), [], []).add).toEqual(['MIA-1']);
  });

  it('players saved with a code only (nobody signed in) keep working: caught up by code at start, nothing filed', () => {
    const here: LocalPlayer[] = [{ id: 'a', name: 'Mia', code: 'MIA-1', at: 10 }, { id: 'b', name: 'Sam' }];
    const atStart = planSync(here, null, [], [], true);
    expect(atStart.pull).toEqual(['MIA-1']);
    expect(atStart.file).toEqual([]);
    expect(atStart.link).toEqual([]);
    expect(atStart.add).toEqual([]);
    // the regular refresh leaves code-only players to the next start (code lookups are rate-limited)
    expect(planSync(here, null, [], [], false).pull).toEqual([]);
  });

  it('a gentle note names everyone who went', () => {
    expect(goneNote(['Mia', 'Sam'])).toBe("Mia's and Sam's players were deleted by a grown-up.");
    expect(goneNote(['Mia', 'Sam', 'Zoe'])).toBe("Mia's, Sam's and Zoe's players were deleted by a grown-up.");
    expect(goneNote([])).toBe('');
  });
});
