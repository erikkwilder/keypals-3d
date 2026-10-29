<script lang="ts">
  // The Admin numbers: how many play and what they play, from the daily totals (counts.ts, no identifiers).
  // Last 30 days: players each day, new players, weekly and monthly players, coming back, minutes played,
  // and the top games, screens, subjects, devices and countries.
  import { call } from '../state/cloud.svelte';
  import { summarize, type Row, type Summary } from '../state/counts';

  let s = $state<Summary | null>(null);
  let msg = $state<string | null>(null);
  async function load() {
    msg = null;
    try { const r = await call<{ today: string; rows: Row[] }>('/admin/stats'); s = summarize(r.rows, r.today); }
    catch (e) { msg = (e as Error).message; }
  }
  $effect(() => { void load(); });
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const LABEL: Record<string, string> = { game: 'Top games', screen: 'Top screens', subject: 'Subjects', area: 'Areas', device: 'Devices', country: 'Countries', stars: 'Stars at the end (subject:stars)', game_min: 'Game length (minutes)', signin: 'Grown-up sign-ins' };
  const LISTS = ['game', 'screen', 'subject', 'area', 'device', 'country', 'game_min', 'stars', 'signin'] as const;
</script>

{#snippet bars(title: string, values: number[], unit: string)}
  {@const max = Math.max(1, ...values)}
  <figure class="chart">
    <figcaption>{title}</figcaption>
    <div class="plot" role="img" aria-label="{title}: {values.map((v, i) => `${short(s!.days[i])} ${v}`).join(', ')}">
      {#each values as v, i (i)}
        <div class="col" title="{short(s!.days[i])}: {fmt(v)} {unit}"><div class="bar" style:height="{(v / max) * 100}%"></div></div>
      {/each}
    </div>
    <div class="axis"><span>{short(s!.days[0])}</span><span>max {fmt(max)}</span><span>{short(s!.days[s!.days.length - 1])}</span></div>
  </figure>
{/snippet}

<div class="dash">
  <div class="top"><p class="muted small">Counted without knowing who anyone is: a player is counted once a day, week and month on each computer. Last 30 days.</p><button class="link" onclick={load}>Refresh</button></div>
  {#if msg}<p class="msg">{msg}</p>{/if}
  {#if s}
    <div class="tiles">
      <div class="tile"><b>{fmt(s.today)}</b><span>players today</span></div>
      <div class="tile"><b>{fmt(s.week)}</b><span>players this week</span></div>
      <div class="tile"><b>{fmt(s.month)}</b><span>players this month</span></div>
      <div class="tile"><b>{fmt(s.newPlayers)}</b><span>new players</span></div>
      <div class="tile"><b>{fmt(s.minutesTotal)}</b><span>minutes played</span></div>
      <div class="tile"><b>{fmt(s.visits)}</b><span>visits (game opened)</span></div>
    </div>
    <div class="charts">
      {@render bars('Players each day', s.daily, 'players')}
      {@render bars('New players each day', s.fresh, 'new players')}
      {@render bars('Minutes played each day', s.minutes, 'minutes')}
    </div>
    <div class="lists">
      <div class="list">
        <h5>Coming back</h5>
        <table><tbody>
          {#each s.retention as r (r.after)}<tr><td>after {r.after} day{r.after === 1 ? '' : 's'}</td><td class="num">{pct(r.back, r.started)}</td><td class="muted">{fmt(r.back)} of {fmt(r.started)}</td></tr>{/each}
        </tbody></table>
      </div>
      <div class="list">
        <h5>Weekly and monthly players</h5>
        <table><tbody>
          {#each s.weeks as w (w.week)}<tr><td>{w.week}</td><td class="num">{fmt(w.n)}</td></tr>{/each}
          {#each s.months as m (m.month)}<tr><td>{m.month}</td><td class="num">{fmt(m.n)}</td></tr>{/each}
        </tbody></table>
      </div>
      {#each LISTS as id (id)}
        {@const items = s.top[id].slice(0, 10)}
        {@const max = Math.max(1, ...items.map(x => x.n))}
        <div class="list">
          <h5>{LABEL[id]}</h5>
          {#if !items.length}<p class="muted small">None yet.</p>{/if}
          <table><tbody>
            {#each items as x (x.key)}<tr title="{x.key || '(none)'}: {fmt(x.n)}"><td class="k">{x.key || '(none)'}</td><td class="meter"><span style:width="{(x.n / max) * 100}%"></span></td><td class="num">{fmt(x.n)}</td></tr>{/each}
          </tbody></table>
        </div>
      {/each}
    </div>
  {:else if !msg}<p class="muted small">Adding up...</p>{/if}
</div>

<style>
  .dash { display: flex; flex-direction: column; gap: 12px; }
  .top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
  .link { border: 0; background: none; color: var(--primary); font: 700 14px var(--font-body); cursor: pointer; }
  .tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .tile { background: #fff; border: 2px solid var(--line); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; }
  .tile b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tile span { font: 700 12px var(--font-body); color: var(--muted); }
  .charts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .chart { margin: 0; background: #fff; border: 2px solid var(--line); border-radius: 14px; padding: 10px 12px; }
  figcaption, h5 { font: 700 14px var(--font-body); color: var(--ink); margin: 0 0 6px; }
  .plot { height: 110px; display: flex; align-items: flex-end; gap: 2px; border-bottom: 1px solid var(--line); }
  .col { flex: 1; height: 100%; display: flex; align-items: flex-end; }
  .col:hover .bar { background: var(--primary-edge); }
  .bar { width: 100%; min-height: 1px; background: var(--primary); border-radius: 4px 4px 0 0; }
  .axis { display: flex; justify-content: space-between; font: 700 11px var(--font-body); color: var(--muted); margin-top: 4px; }
  .lists { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .list { background: #fff; border: 2px solid var(--line); border-radius: 14px; padding: 10px 12px; min-width: 0; }
  table { width: 100%; border-collapse: collapse; font: 600 13px var(--font-body); color: var(--ink2); }
  td { padding: 3px 0; }
  td.k { max-width: 0; width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 6px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); padding-left: 6px; width: 1%; white-space: nowrap; }
  td.meter span { display: block; height: 8px; border-radius: 0 4px 4px 0; background: var(--primary-hi); }
  .msg { color: #c0396f; font-weight: 700; margin: 0; }
  .small { font-size: 13px; margin: 0; }
  @media (max-width: 760px) {
    .tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .charts, .lists { grid-template-columns: 1fr; }
  }
</style>
