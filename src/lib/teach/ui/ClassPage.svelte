<script lang="ts">
  // One class: its code and login cards up top, then tabs: this week, students, class work, the
  // gradebook, skills, standards, the class's boards, and class rules. A student's own page opens over it.
  import { teach, act, loadProfiles, type Tab } from '../teacher.svelte';
  import { showClassCode } from '../names';
  import type { Kid } from '../reports';
  import OverviewTab from './OverviewTab.svelte';
  import RosterTab from './RosterTab.svelte';
  import WorkTab from './WorkTab.svelte';
  import GradebookTab from './GradebookTab.svelte';
  import SkillsTab from './SkillsTab.svelte';
  import StandardsTab from './StandardsTab.svelte';
  import BoardsTab from './BoardsTab.svelte';
  import SettingsTab from './SettingsTab.svelte';
  import StudentPage from './StudentPage.svelte';
  import PrintCards from './PrintCards.svelte';

  const c = $derived(teach.current!);
  const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
  const active = $derived(c.students.filter(s => s.status === 'active'));
  const waiting = $derived(c.students.filter(s => s.status === 'pending').length);
  const kids = $derived<Kid[]>(active.map(s => ({ id: s.id, name: s.name, profile: teach.profiles[s.id] ?? null })));
  const TABS: { id: Tab; name: string }[] = [
    { id: 'overview', name: 'This week' }, { id: 'students', name: 'Students' }, { id: 'work', name: 'Class work' }, { id: 'gradebook', name: 'Gradebook' },
    { id: 'skills', name: 'Skills' }, { id: 'standards', name: 'Standards' }, { id: 'boards', name: 'Boards' }, { id: 'settings', name: 'Class rules' },
  ];
  function go(t: Tab) { teach.tab = t; teach.studentId = null; teach.msg = null; }
</script>

<div class="teachui">
  <section class="chead">
    <div class="ct">
      <h2>{c.class.name}{#if c.class.archived}<em>Archived</em>{/if}</h2>
      <span>Grade {GRADES[c.class.grade]} · {active.length} student{active.length === 1 ? '' : 's'}</span>
    </div>
    <div class="ccode"><span>Class code</span><b>{showClassCode(c.class.code)}</b></div>
    <button class="btn" disabled={!active.length} onclick={() => (teach.printing = true)}>Print login cards</button>
  </section>

  <nav class="tabs" aria-label="Class pages">
    {#each TABS as t (t.id)}
      <button class:on={teach.tab === t.id && !teach.studentId} onclick={() => go(t.id)}>{t.name}{#if t.id === 'students' && waiting}<i>{waiting}</i>{/if}</button>
    {/each}
    <span class="sp"></span>
    {#if teach.profilesBusy}<span class="loading">Loading progress…</span>{:else}<button class="refresh" onclick={() => act(() => loadProfiles(true))} title="Fetch everyone's latest progress">Refresh</button>{/if}
  </nav>
  {#if teach.msg}<p class="msg" role="status">{teach.msg}</p>{/if}

  {#if teach.studentId}
    <StudentPage {kids} />
  {:else if teach.tab === 'overview'}<OverviewTab {kids} />
  {:else if teach.tab === 'students'}<RosterTab />
  {:else if teach.tab === 'work'}<WorkTab {kids} />
  {:else if teach.tab === 'gradebook'}<GradebookTab {kids} />
  {:else if teach.tab === 'skills'}<SkillsTab {kids} />
  {:else if teach.tab === 'standards'}<StandardsTab {kids} />
  {:else if teach.tab === 'boards'}<BoardsTab />
  {:else if teach.tab === 'settings'}<SettingsTab />
  {/if}
  {#if teach.printing}<PrintCards />{/if}
</div>

<style>
  .chead { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; background: #fff; border: 1px solid #e8e2f3; border-radius: 16px; padding: 16px 20px; margin-bottom: 12px; }
  .ct { flex: 1; min-width: 200px; }
  .ct h2 { margin: 0; font: 600 28px var(--font-ui); display: flex; align-items: center; gap: 10px; }
  .ct h2 em { font: 800 12px var(--font-body); font-style: normal; background: #efedf3; color: #6d6680; padding: 3px 10px; border-radius: 99px; }
  .ct span { font: 700 14px var(--font-body); color: #7a7092; }
  .ccode { display: flex; flex-direction: column; align-items: flex-start; }
  .ccode span { font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .08em; color: #7a7092; }
  .ccode b { font: 600 24px var(--font-ui); background: #fff4cf; border: 2px solid #f2d88a; border-radius: 10px; padding: 0 12px; }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; border-bottom: 2px solid #e8e2f3; margin-bottom: 14px; }
  .tabs button { border: 0; background: none; padding: 10px 14px; font: 800 14.5px var(--font-body); color: #6d6680; cursor: pointer; border-bottom: 3px solid transparent; margin-bottom: -2px; display: inline-flex; align-items: center; gap: 6px; }
  .tabs button:hover { color: #2b2140; }
  .tabs button.on { color: #2b2140; border-bottom-color: #7c5cf5; }
  .tabs i { font-style: normal; background: #f08a3c; color: #fff; border-radius: 99px; padding: 0 7px; font-size: 12px; }
  .tabs .sp { flex: 1; }
  .loading { font: 700 13px var(--font-body); color: #7a7092; }
  .refresh { font-weight: 700 !important; color: #6a4fe0 !important; }
  .msg { font: 700 14.5px var(--font-body); color: #6a4fe0; margin: 0 0 10px; }
  /* shared by every tab */
  .teachui :global(.tp) { background: #fff; border: 1px solid #e8e2f3; border-radius: 16px; padding: 16px 20px; margin-bottom: 14px; }
  .teachui :global(.tp h3) { margin: 0 0 6px; font: 600 21px var(--font-ui); color: #2b2140; }
  .teachui :global(.tp p), .teachui :global(.tp li) { font: 600 14.5px/1.5 var(--font-body); color: #4a4061; }
  .teachui :global(.tp .muted), .teachui :global(.muted) { color: #7a7092; }
  .teachui :global(.tt) { width: 100%; border-collapse: collapse; font: 600 14px/1.35 var(--font-body); color: #2b2140; }
  .teachui :global(.tt th) { text-align: left; font: 800 11.5px var(--font-body); text-transform: uppercase; letter-spacing: .05em; color: #7a7092; padding: 8px; border-bottom: 2px solid #ece6f6; white-space: nowrap; }
  .teachui :global(.tt td) { padding: 8px; border-bottom: 1px solid #f0ecf7; vertical-align: middle; }
  .teachui :global(.tt tr:hover td) { background: #fbfaff; }
  .teachui :global(.row) { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .teachui :global(.sbtn) { border: 1px solid #ddd5ee; background: #fff; border-radius: 10px; padding: 6px 11px; font: 700 13.5px var(--font-body); color: #3b3157; cursor: pointer; }
  .teachui :global(.sbtn:hover) { background: #f6f2ff; }
  .teachui :global(.sbtn.warn) { color: #b4232c; border-color: #f1c6c9; }
  .teachui :global(.namebtn) { background: none; border: 0; padding: 0; font: 700 15px var(--font-body); color: #4b34c9; cursor: pointer; text-align: left; }
  .teachui :global(.namebtn:hover) { text-decoration: underline; }
  .teachui :global(input), .teachui :global(select), .teachui :global(textarea) { font: 600 15px var(--font-body); padding: 8px 11px; border-radius: 10px; border: 1.5px solid #d8cfee; background: #fff; color: #2b2140; }
  .teachui :global(.stat) { display: flex; flex-direction: column; background: #f8f6fc; border-radius: 14px; padding: 12px 16px; min-width: 150px; }
  .teachui :global(.stat b) { font: 600 30px var(--font-ui); color: #2b2140; }
  .teachui :global(.stat span) { font: 700 13px var(--font-body); color: #7a7092; }
  .teachui :global(.chip) { display: inline-block; padding: 2px 9px; border-radius: 99px; font: 800 12px var(--font-body); white-space: nowrap; }
  @media (max-width: 700px) {
    .ct h2 { font-size: 22px; }
    .tabs button { padding: 8px 9px; font-size: 13.5px; }
    .teachui :global(.tp) { padding: 14px; }
    .teachui :global(.tt th) { white-space: normal; padding: 6px 4px; }
    .teachui :global(.tt td) { padding: 6px 4px; overflow-wrap: anywhere; }
  }
  /* a phone: a table marked "stack" turns into blocks, one a row, so nothing runs off the side */
  @media (max-width: 760px) {
    .teachui :global(.tt.stack thead) { display: none; }
    .teachui :global(.tt.stack tr) { display: block; padding: 8px 0; border-bottom: 1px solid #f0ecf7; }
    .teachui :global(.tt.stack td) { display: block; padding: 3px 0; border: 0; overflow-wrap: anywhere; }
    .teachui :global(.tt.stack td[data-l]::before) { content: attr(data-l) ': '; font-weight: 800; color: #7a7092; }
  }
</style>
