<script lang="ts">
  // The gradebook: students down the side, class work across, each cell the score coloured by where it
  // stands (done, started, late, not started), with a spreadsheet download.
  import { teach } from '../teacher.svelte';
  import { STATUS_NAME, dueText, gradebookCsv, isFor, progressOf, type Assignment, type Progress, type Status } from '../assignments';
  import type { Kid } from '../reports';
  import { saveTextFile } from '../../state/platform';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  const work = $derived(c.assignments.filter(a => !a.archived));
  const now = Date.now();
  const grid = $derived(kids.map(k => ({ k, cells: work.map(a => (isFor(a, k.id) ? (k.profile ? progressOf(k.profile, a, now) : null) : undefined)) })));
  const COLORS: Record<Status, string> = { done: '#c9f1dd', started: '#fff0b8', late: '#ffd6cf', 'not started': '#efedf3' };
  const INK: Record<Status, string> = { done: '#0f5a3c', started: '#6a5200', late: '#9a2a1a', 'not started': '#6d6680' };
  const avg = (cells: (Progress | null | undefined)[]) => { const xs = cells.filter((x): x is Progress => !!x).map(x => x.score); return xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length) : null; };
  function download() {
    const csv = gradebookCsv(kids, work, (sid: string, a: Assignment) => { const k = kids.find(x => x.id === sid); return k?.profile ? progressOf(k.profile, a, now) : null; });
    void saveTextFile(`${c.class.name.replace(/[^\w]+/g, '-').toLowerCase()}-gradebook.csv`, csv);
  }
</script>

<div class="tp">
  <div class="top">
    <div><h3>Gradebook</h3><p class="muted">Scores out of 100, by each assignment's scoring. Tap a name for that student's page.</p></div>
    <button class="btn" disabled={!work.length} onclick={download}>Download spreadsheet (CSV)</button>
  </div>
  <div class="legend">{#each Object.keys(COLORS) as s (s)}<span style:background={COLORS[s as Status]} style:color={INK[s as Status]}>{STATUS_NAME[s as Status]}</span>{/each}<span class="na">— not assigned</span></div>
  {#if !work.length}
    <p class="muted">No class work yet: make some on the Class work tab.</p>
  {:else}
    <!-- a phone: one block a student, nothing runs off the side -->
    <div class="bykid">
      {#each grid as row (row.k.id)}
        <div class="kid">
          <div class="kh"><button class="namebtn" onclick={() => (teach.studentId = row.k.id)}>{row.k.name}</button><b>{avg(row.cells) ?? '—'}</b></div>
          {#each row.cells as pr, i (work[i].id)}
            {#if pr !== undefined}<p><span>{work[i].title}</span><em style:background={COLORS[pr?.status ?? 'not started']} style:color={INK[pr?.status ?? 'not started']}>{pr?.score ?? 0}</em></p>{/if}
          {/each}
        </div>
      {/each}
    </div>
    <div class="scrollx">
      <table class="tt gb">
        <thead>
          <tr><th class="nm">Student</th>{#each work as a (a.id)}<th title={a.title}><span class="at">{a.title}</span><small>{dueText(a.due)}</small></th>{/each}<th>Average</th></tr>
        </thead>
        <tbody>
          {#each grid as row (row.k.id)}
            <tr>
              <td class="nm"><button class="namebtn" onclick={() => (teach.studentId = row.k.id)}>{row.k.name}</button></td>
              {#each row.cells as pr, i (work[i].id)}
                {#if pr === undefined}<td class="cell na">—</td>
                {:else if pr === null}<td class="cell"><span class="sc" style:background={COLORS['not started']} style:color={INK['not started']}>0</span></td>
                {:else}
                  <td class="cell" title="{STATUS_NAME[pr.status]} · {Math.round(pr.done * 100)}% of the goal{pr.acc !== null ? ` · ${Math.round(pr.acc * 100)}% right` : ''}">
                    <span class="sc" style:background={COLORS[pr.status]} style:color={INK[pr.status]}>{pr.score}<small>{STATUS_NAME[pr.status]}</small></span>
                  </td>
                {/if}
              {/each}
              <td class="cell"><b>{avg(row.cells) ?? '—'}</b></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .legend { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 12px; }
  .legend span { font: 800 12px var(--font-body); padding: 3px 10px; border-radius: 99px; }
  .legend .na { color: #7a7092; }
  .scrollx { overflow-x: auto; }
  .gb th { white-space: normal; vertical-align: bottom; min-width: 110px; max-width: 160px; }
  .gb th .at { display: block; text-transform: none; letter-spacing: 0; font: 800 13px/1.25 var(--font-body); color: #2b2140; }
  .gb th small { font: 700 11px var(--font-body); text-transform: none; letter-spacing: 0; }
  .gb .nm { position: sticky; left: 0; background: #fff; min-width: 120px; }
  .cell { text-align: center; }
  .sc { display: inline-flex; flex-direction: column; align-items: center; min-width: 74px; padding: 4px 8px; border-radius: 10px; font: 600 18px var(--font-ui); line-height: 1.1; }
  .sc small { font: 800 10.5px var(--font-body); }
  .na { color: #b8b0c8; }
  .bykid { display: none; }
  @media (max-width: 760px) {
    .scrollx { display: none; }
    .bykid { display: flex; flex-direction: column; gap: 8px; }
    .kid { padding: 8px 0; border-top: 1px solid #f0ecf7; }
    .kh { display: flex; justify-content: space-between; align-items: center; }
    .kid p { display: flex; justify-content: space-between; gap: 10px; margin: 4px 0 0; align-items: center; }
    .kid p span { min-width: 0; overflow-wrap: anywhere; }
    .kid em { font: 800 13px var(--font-body); font-style: normal; padding: 2px 10px; border-radius: 8px; }
  }
</style>
