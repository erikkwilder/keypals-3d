<script lang="ts">
  // The skills grid: students down the side, math skills across, each cell the student's working level
  // on that skill (the game's adaptive ability, as on the grown-ups' skills report: getting started,
  // comfortable, strong, stretching), coloured, with its little six-step ladder.
  import { teach } from '../teacher.svelte';
  import { skillsForGrade, skillsGrid, type Kid } from '../reports';
  import { LEVELS, LEVEL_COLOR, atLeast } from '../level';
  import { AREAS, SKILL } from '../../math/skills/registry';
  import { LIVE_SKILLS } from '../assignments';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  let show = $state<string>('grade');
  const assigned = $derived([...new Set(c.assignments.filter(a => !a.archived && a.what === 'skills').flatMap(a => a.skills))]);
  const skills = $derived(show === 'grade' ? skillsForGrade(c.class.grade) : show === 'assigned' ? assigned : LIVE_SKILLS.filter(s => s.area === show).map(s => s.id));
  const grid = $derived(skillsGrid(kids, skills));
  const comfy = (i: number) => grid.filter(r => atLeast(r.levels[i])).length;
</script>

<div class="tp">
  <div class="top">
    <div><h3>Skills</h3><p class="muted">Where each student is working on each skill: how hard the game's questions are for them now (it aims for about 8 in 10 right, and steps up as they grow). The ladder shows the step of six.</p></div>
    <label class="pick">Show
      <select bind:value={show}>
        <option value="grade">Skills near grade {c.class.grade === 0 ? 'K' : c.class.grade}</option>
        <option value="assigned" disabled={!assigned.length}>Skills in class work</option>
        {#each AREAS.filter(a => a.live) as a (a.id)}<option value={a.id}>{a.name}</option>{/each}
      </select>
    </label>
  </div>
  <div class="legend">{#each LEVELS as l (l)}<span style:background={LEVEL_COLOR[l].bg} style:color={LEVEL_COLOR[l].ink}>{LEVEL_COLOR[l].label}</span>{/each}</div>
  {#if !skills.length || !kids.length}
    <p class="muted">Nothing to show yet.</p>
  {:else}
    <div class="scrollx">
      <table class="tt grid">
        <thead>
          <tr><th class="nm">Student</th>{#each skills as id (id)}<th title="{SKILL[id]?.name}: {SKILL[id]?.plain}"><span class="sk">{SKILL[id]?.short ?? SKILL[id]?.name}</span><small>{SKILL[id]?.standard}</small></th>{/each}</tr>
        </thead>
        <tbody>
          {#each grid as row (row.id)}
            <tr>
              <td class="nm"><button class="namebtn" onclick={() => (teach.studentId = row.id)}>{row.name}</button></td>
              {#each row.levels as l, i (skills[i])}<td class="cell" title="{row.name}: {SKILL[skills[i]]?.name}, {LEVEL_COLOR[l].label.toLowerCase()}{row.rungs[i] ? ` (step ${row.rungs[i]} of 6: ${LEVEL_COLOR[l].hint})` : ''}"><span style:background={LEVEL_COLOR[l].bg} style:color={LEVEL_COLOR[l].ink}>{#if row.rungs[i]}<i class="lad" aria-hidden="true">{#each [1, 2, 3, 4, 5, 6] as k (k)}<b class:on={k <= row.rungs[i]} style:height="{4 + k * 2}px"></b>{/each}</i>{/if}</span></td>{/each}
            </tr>
          {/each}
          <tr class="sum"><td class="nm">Comfortable or more</td>{#each skills as id, i (id)}<td class="cell">{comfy(i)}/{grid.length}</td>{/each}</tr>
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .pick { display: flex; flex-direction: column; gap: 4px; font: 800 12px var(--font-body); color: #7a7092; text-transform: uppercase; letter-spacing: .05em; }
  .legend { display: flex; gap: 8px; margin: 4px 0 12px; }
  .legend span { font: 800 12px var(--font-body); padding: 3px 10px; border-radius: 99px; }
  .scrollx { overflow-x: auto; }
  .grid th { white-space: normal !important; vertical-align: bottom; min-width: 64px; max-width: 96px; width: 80px; text-align: center; }
  .grid th .sk { display: block; white-space: normal; overflow-wrap: break-word; hyphens: auto; text-transform: none; letter-spacing: 0; font: 800 12px/1.2 var(--font-body); color: #2b2140; }
  .grid th small { font: 700 10px ui-monospace, monospace; letter-spacing: 0; text-transform: none; }
  .nm { position: sticky; left: 0; background: #fff; min-width: 110px; text-align: left !important; }
  .cell { text-align: center; padding: 4px !important; }
  .cell span { display: inline-grid; place-items: center; width: 100%; min-width: 44px; height: 30px; border-radius: 8px; font: 800 15px var(--font-body); }
  .lad { display: inline-flex; align-items: flex-end; gap: 2px; height: 18px; }
  .lad b { width: 4px; border-radius: 2px; background: rgba(255, 255, 255, .75); }
  .lad b.on { background: currentColor; }
  .sum td { font: 800 12.5px var(--font-body); color: #6d6680; }
</style>
