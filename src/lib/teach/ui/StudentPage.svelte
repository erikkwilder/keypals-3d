<script lang="ts">
  // One student's page: time and accuracy week by week, their skills, every piece of class work, and
  // what they played lately.
  import { teach } from '../teacher.svelte';
  import { studentReport, type Kid } from '../reports';
  import { LEVEL_COLOR } from '../level';
  import { STATUS_NAME, dueText, goalText, partName, type Status } from '../assignments';
  import { MATH_LESSON } from '../../math/course';
  import { SKILL_LESSON } from '../../math/skills/course';
  import { LESSON as TYPING } from '../../engine/course';
  import { ARCADE } from '../../arcade/arcade';
  import PicturePass from './PicturePass.svelte';
  import Critter from '../../ui/Critter.svelte';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const s = $derived(teach.current!.students.find(x => x.id === teach.studentId)!);
  const kid = $derived<Kid>(kids.find(k => k.id === teach.studentId) ?? { id: s?.id ?? '', name: s?.name ?? '', profile: null });
  const r = $derived(studentReport(kid, teach.current!.assignments.filter(a => !a.archived)));
  const maxMin = $derived(Math.max(10, ...r.weeks.map(w => w.minutes)));
  const COLORS: Record<Status, string> = { done: '#c9f1dd', started: '#fff0b8', late: '#ffd6cf', 'not started': '#efedf3' };
  const what = (l: string, k: string) => (k === 'typing' ? TYPING[l]?.title : k === 'arcade' ? ARCADE[l as keyof typeof ARCADE]?.name : k === 'learn' ? `Learn: ${partName({ what: 'learn' }, l)}` : k === 'battle' ? 'Adventure battle' : SKILL_LESSON[l]?.title ?? MATH_LESSON[l]?.title) ?? (l.startsWith('class-') ? 'Class work trip' : l);
  const when = (t: number) => new Date(t).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
</script>

{#if s}
  <div class="tp head">
    <button class="sbtn" onclick={() => (teach.studentId = null)}>← Back to the class</button>
    <div class="who">
      <Critter friend={(kid.profile?.buddy ?? s.buddy ?? 'dino') as import('../../art/cast').FriendId} size={64} round still />
      <div><h3>{s.name}</h3><span class="muted">{s.home ? 'Player linked from home' : 'Class player'}{kid.profile ? ` · ${r.learned} Learn episodes watched` : ' · hasn\'t logged in yet'}</span></div>
      <div class="pw"><span class="muted">Pictures</span><PicturePass pics={s.pics} size={38} /></div>
    </div>
  </div>

  <div class="two">
    <div class="tp">
      <h3>Week by week</h3>
      <div class="chart">
        {#each r.weeks as w (w.week)}
          <div class="col" title="{w.minutes} min · {w.right} right{w.acc !== null ? ` · ${Math.round(w.acc * 100)}%` : ''}">
            <span class="acc">{w.acc === null ? '' : `${Math.round(w.acc * 100)}%`}</span>
            <div class="bar" style:height="{(w.minutes / maxMin) * 100}%"></div>
            <span class="lbl">{new Date(`${w.week}T12:00`).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}</span>
          </div>
        {/each}
      </div>
      <p class="muted small">Bars: minutes practised each week (from Monday). Above them: accuracy.</p>
      <table class="tt">
        <thead><tr><th>Week of</th><th>Minutes</th><th>Right answers</th><th>Accuracy</th></tr></thead>
        <tbody>{#each [...r.weeks].reverse().slice(0, 4) as w (w.week)}<tr><td>{w.week}</td><td>{w.minutes}</td><td>{w.right}</td><td>{w.acc === null ? '—' : `${Math.round(w.acc * 100)}%`}</td></tr>{/each}</tbody>
      </table>
    </div>
    <div class="tp">
      <h3>Skills</h3>
      {#if !r.skills.length}<p class="muted">No math skills started yet.</p>{:else}
        <table class="tt">
          <tbody>{#each r.skills as k (k.id)}<tr><td>{k.name}<br /><span class="muted">{k.area} · {k.standard}</span></td><td><span class="chip" style:background={LEVEL_COLOR[k.level].bg} style:color={LEVEL_COLOR[k.level].ink}>{LEVEL_COLOR[k.level].label}</span></td></tr>{/each}</tbody>
        </table>
      {/if}
    </div>
  </div>

  <div class="tp">
    <h3>Class work</h3>
    {#if !r.work.length}<p class="muted">No class work for {s.name} yet.</p>{:else}
      <table class="tt">
        <thead><tr><th>Class work</th><th>Goal</th><th>Due</th><th>Progress</th><th>Accuracy</th><th>Score</th><th>Status</th></tr></thead>
        <tbody>
          {#each r.work as { a, pr } (a.id)}
            <tr>
              <td><b>{a.title}</b><br /><span class="muted">{pr.parts.map(x => `${x.done ? '✓ ' : ''}${x.name}`).join(', ')}</span></td>
              <td>{goalText(a)}</td><td>{dueText(a.due)}</td>
              <td><div class="pbar"><i style:width="{pr.done * 100}%"></i></div>{Math.round(pr.done * 100)}%</td>
              <td>{pr.acc === null ? '—' : `${Math.round(pr.acc * 100)}%`}</td>
              <td><b>{pr.score}</b></td>
              <td><span class="chip" style:background={COLORS[pr.status]}>{STATUS_NAME[pr.status]}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if r.recent.length}
    <div class="tp">
      <h3>Lately</h3>
      <table class="tt">
        <tbody>{#each r.recent as e (e.at)}<tr><td>{when(e.at)}</td><td>{what(e.l, e.k)}</td><td>{Math.max(1, Math.round(e.ms / 60000))} min</td><td>{e.n ? `${e.r} of ${e.n} right` : ''}</td><td>{e.st ? '★'.repeat(e.st) : ''}</td></tr>{/each}</tbody>
      </table>
    </div>
  {/if}
{/if}

<style>
  .head { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .who { display: flex; align-items: center; gap: 14px; width: 100%; }
  .who h3 { margin: 0; font-size: 28px !important; }
  .pw { margin-left: auto; display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
  .two { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
  .chart { display: flex; align-items: flex-end; gap: 10px; height: 150px; padding: 6px 4px 0; border-bottom: 2px solid #ece6f6; }
  .col { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
  .bar { width: 100%; min-height: 3px; background: #b79cf2; border-radius: 6px 6px 2px 2px; }
  .acc { font: 800 11px var(--font-body); color: #0f5a3c; }
  .lbl { font: 700 11px var(--font-body); color: #7a7092; transform: translateY(18px); }
  .small { margin-top: 24px !important; font-size: 13px !important; }
  .pbar { width: 90px; height: 9px; border-radius: 99px; background: #efedf3; overflow: hidden; display: inline-block; margin-right: 6px; vertical-align: middle; }
  .pbar i { display: block; height: 100%; background: #4fcf9f; }
  @media (max-width: 900px) { .two { grid-template-columns: 1fr; } .who { flex-wrap: wrap; } .pw { margin-left: 0; align-items: flex-start; } }
</style>
