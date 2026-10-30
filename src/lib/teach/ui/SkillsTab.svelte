<script lang="ts">
  // The skills grid: students down the side, math skills across, each cell coloured by the student's
  // working level on that skill (not started, growing, comfortable).
  import { teach } from '../teacher.svelte';
  import { skillsForGrade, skillsGrid, type Kid } from '../reports';
  import { LEVELS, LEVEL_COLOR } from '../level';
  import { AREAS, SKILL } from '../../math/skills/registry';
  import { LIVE_SKILLS } from '../assignments';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  let show = $state<string>('grade');
  const assigned = $derived([...new Set(c.assignments.filter(a => !a.archived && a.what === 'skills').flatMap(a => a.skills))]);
  const skills = $derived(show === 'grade' ? skillsForGrade(c.class.grade) : show === 'assigned' ? assigned : LIVE_SKILLS.filter(s => s.area === show).map(s => s.id));
  const grid = $derived(skillsGrid(kids, skills));
  const count = (i: number, l: string) => grid.filter(r => r.levels[i] === l).length;
</script>

<div class="tp">
  <div class="top">
    <div><h3>Skills</h3><p class="muted">Each student's working level on each skill: comfortable means answered right and quickly on different days.</p></div>
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
              {#each row.levels as l, i (skills[i])}<td class="cell" title="{row.name}: {SKILL[skills[i]]?.name}, {LEVEL_COLOR[l].label.toLowerCase()}"><span style:background={LEVEL_COLOR[l].bg} style:color={LEVEL_COLOR[l].ink}>{l === 'comfortable' ? '✓' : l === 'growing' ? '~' : ''}</span></td>{/each}
            </tr>
          {/each}
          <tr class="sum"><td class="nm">Comfortable</td>{#each skills as id, i (id)}<td class="cell">{count(i, 'comfortable')}/{grid.length}</td>{/each}</tr>
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
  .cell span { display: inline-grid; place-items: center; width: 100%; min-width: 44px; height: 28px; border-radius: 8px; font: 800 15px var(--font-body); }
  .sum td { font: 800 12.5px var(--font-body); color: #6d6680; }
</style>
