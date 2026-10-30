<script lang="ts">
  // This week at a glance: minutes, right answers, who played (and who hasn't yet), the class goal's
  // trophy, and "needs help" groups: who isn't comfortable yet on a skill in the class work.
  import { teach } from '../teacher.svelte';
  import { classWeekReport, needsHelp, type Kid } from '../reports';
  import { weekKey } from '../activity';
  import Trophy from './Trophy.svelte';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  const week = weekKey(Date.now());
  const wk = $derived(classWeekReport(kids, week));
  const help = $derived(needsHelp(kids, c.assignments));
  const goalRight = $derived(c.week.reduce((t, r) => t + r.right, 0));
  const mins = (ms: number) => Math.round(ms / 60000);
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
  const weekName = new Date(`${week}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
</script>

<div class="tp">
  <h3>This week <span class="muted wk">(since Monday, {weekName})</span></h3>
  {#if !kids.length}
    <p class="muted">Add students on the Students tab, then print their login cards.</p>
  {:else}
    <div class="stats">
      <div class="stat"><b>{wk.minutes}</b><span>minutes practised</span></div>
      <div class="stat"><b>{wk.right.toLocaleString('en-US')}</b><span>right answers</span></div>
      <div class="stat"><b>{wk.played} of {wk.total}</b><span>students played</span></div>
      {#if c.class.goal}
        <div class="tgoal"><Trophy right={goalRight} goal={c.class.goal} size={56} /><div><b>{Math.min(100, Math.round((goalRight / c.class.goal) * 100))}%</b><span>of the class goal ({c.class.goal.toLocaleString('en-US')})</span></div></div>
      {/if}
    </div>
    {#if wk.notPlayed.length}<p class="np"><b>Not played yet this week:</b> {wk.notPlayed.join(', ')}</p>{/if}
    <table class="tt">
      <thead><tr><th>Student</th><th>Minutes</th><th>Right answers</th><th>Accuracy</th></tr></thead>
      <tbody>
        {#each wk.rows as r (r.id)}
          <tr><td><button class="namebtn" onclick={() => (teach.studentId = r.id)}>{r.name}</button></td><td>{mins(r.ms)}</td><td>{r.right}</td><td>{pct(r.acc)}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<div class="tp">
  <h3>Needs help</h3>
  <p class="muted">Students not yet comfortable on a skill in the class work. Good for a small group or a quick check-in.</p>
  {#if !help.length}
    <p class="muted">{c.assignments.some(a => a.what === 'skills' && !a.archived) ? 'Everyone is comfortable on the assigned skills. Nice!' : 'Give some math skills as class work to see groups here.'}</p>
  {:else}
    <div class="groups">
      {#each help as g (g.skill)}
        <div class="grp">
          <b>{g.name}</b><span class="code">{g.standard}</span>
          <p class="plain">{g.plain}</p>
          <div class="bar"><i style:width="{(g.comfortable / Math.max(1, g.of)) * 100}%"></i></div>
          <span class="muted">{g.comfortable} of {g.of} comfortable</span>
          {#if g.growing.length}<p><span class="chip grow">Growing</span> {g.growing.join(', ')}</p>{/if}
          {#if g.notStarted.length}<p><span class="chip ns">Not started</span> {g.notStarted.join(', ')}</p>{/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wk { font: 700 14px var(--font-body); }
  .stats { display: flex; gap: 12px; flex-wrap: wrap; margin: 8px 0 12px; }
  .tgoal { display: flex; align-items: center; gap: 12px; background: #fffaf0; border: 1px solid #f2e3b4; border-radius: 14px; padding: 10px 16px; }
  .tgoal div { display: flex; flex-direction: column; }
  .tgoal b { font: 600 30px var(--font-ui); color: #2b2140; }
  .tgoal span { font: 700 13px var(--font-body); color: #7a7092; }
  .np { margin: 0 0 8px; }
  .groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  .grp { border: 1px solid #ece6f6; border-radius: 14px; padding: 12px 14px; background: #fcfbff; }
  .grp b { font: 600 18px var(--font-ui); margin-right: 8px; }
  .code { font: 700 12px ui-monospace, monospace; color: #7a7092; }
  .plain { font-size: 13px !important; color: #7a7092 !important; margin: 4px 0 8px; }
  .grp p { margin: 6px 0 0; }
  .bar { height: 8px; border-radius: 99px; background: #efedf3; overflow: hidden; margin: 6px 0 2px; }
  .bar i { display: block; height: 100%; background: #4fcf9f; }
  .grow { background: #fff0b8; color: #6a5200; }
  .ns { background: #efedf3; color: #6d6680; }
</style>
