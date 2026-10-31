// What belongs where: Settings can't lose anything or change a rule; every button that can lose something
// asks first; a parent's page and a teacher's page use the same card.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('Settings: can\'t lose anything, can\'t change a rule', () => {
  const s = src('./Settings.svelte');
  it('has nothing that deletes, signs in, or needs a grown-up', () => {
    for (const w of ['deleteEverywhere', 'deleteHereOnly', 'GrownupGate', 'openGrownups', 'cloud.svelte', 'dailyGoalMin', 'setHomeRules', 'pp.name']) expect(s, w).not.toContain(w);
  });
  it('no longer points at a button phones don\'t have', () => {
    expect(s).not.toContain('music button');
  });
  it('greys the sound switches when a class turned sound off', () => {
    expect(s).toContain('Your teacher turned this off');
    expect(s.match(/disabled=\{quiet\}/g)?.length).toBe(5);
  });
});

describe('Grown-ups: four rows', () => {
  const g = src('./Grownups.svelte');
  it('sign-in comes first, and Ideas, About and the teachers\' button have gone from it', () => {
    expect(g.indexOf("id: 'saving'")).toBeLessThan(g.indexOf("id: 'players'"));
    expect(g.indexOf("id: 'players'")).toBeLessThan(g.indexOf("id: 'time'"));
    expect(g.indexOf("id: 'time'")).toBeLessThan(g.indexOf("id: 'progress'"));
    for (const w of ["id: 'ideas'", "id: 'about'", "id: 'classes'", 'Keypals for teachers']) expect(g, w).not.toContain(w);
  });
  it('says nothing about minutes in the top bar', () => {
    expect(g).not.toContain('top bar');
  });
  it('a report opens My progress for any child', () => {
    expect(g).toContain('game.progressFor = p!.id');
    expect(g).not.toContain('p.id === game.profile?.id');
  });
});

describe('danger buttons ask first', () => {
  const g = src('./Grownups.svelte');
  it('load, account, deleting a player and stopping saving each open a question', () => {
    expect(g).toContain('if (clash.length) loadAsk =');
    expect(g).toContain('onclick={askDelete}>Delete my account');
    expect(g).toContain('You teach {myClasses.length');
    expect(g).toContain('onclick={() => (askDel = p.id)}');
    // nothing deletes straight from a first tap
    for (const w of ['onclick={removeHereOnly}', 'onclick={removeEverywhere}']) expect(g.indexOf(w), w).toBeGreaterThan(g.indexOf('{:else if classKid}'));
  });
  it('unlinking, new pictures and leaving a challenge ask too', () => {
    expect(src('../ui/ClassGrownups.svelte')).toContain('onclick={() => (asking = c.id)}>Unlink');
    expect(src('../teach/ui/RosterTab.svelte')).toContain('onclick={() => (picturing = s.id)}>New pictures');
    expect(src('../teach/ui/BoardsTab.svelte')).toContain('onclick={() => (leaving = true)}>Leave the challenge');
  });
});

describe('one set of words on both sides', () => {
  it('the parent\'s page and the class\'s page use the same card', () => {
    expect(src('./Grownups.svelte')).toContain('<RulesCard');
    expect(src('../teach/ui/SettingsTab.svelte')).toContain('<RulesCard');
    expect(src('../teach/ui/ClassPage.svelte')).toContain("name: 'Class rules'");
  });
  it('a teacher is told who keeps their family\'s rules, in the right words', () => {
    const t = src('../teach/ui/SettingsTab.svelte');
    expect(t).toContain("family's rules");
    expect(t).not.toContain('at home.');
  });
});

describe('class pages on a phone', () => {
  it('the tables that were too wide stack', () => {
    for (const f of ['WorkTab', 'StandardsTab', 'StudentPage', 'RosterTab']) expect(src(`../teach/ui/${f}.svelte`), f).toContain('tt stack');
    expect(src('../teach/ui/ClassPage.svelte')).toContain('.tt.stack thead');
  });
});
