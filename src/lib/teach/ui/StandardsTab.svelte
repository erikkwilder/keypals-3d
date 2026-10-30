<script lang="ts">
  // The standards view: every Common Core standard Keypals covers, with how many students work at each
  // level on it (a student's level on a standard is their lowest on its skills). Open one to see the names.
  import { teach } from '../teacher.svelte';
  import { standardsReport, type Kid } from '../reports';
  import { LEVELS, LEVEL_COLOR } from '../level';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  let onlyNear = $state(true);
  const rows = $derived(standardsReport(kids).filter(r => !onlyNear || r.skills.some(s => Math.abs(s.grade - c.class.grade) <= 1)));
  let open = $state<string | null>(null);
</script>

<div class="tp">
  <div class="top">
    <div><h3>Common Core standards</h3><p class="muted">How the class stands on each standard the game covers.</p></div>
    <label class="ck"><input type="checkbox" bind:checked={onlyNear} /> Only standards near grade {c.class.grade === 0 ? 'K' : c.class.grade}</label>
  </div>
  <div class="legend">{#each LEVELS as l (l)}<span style:background={LEVEL_COLOR[l].bg} style:color={LEVEL_COLOR[l].ink}>{LEVEL_COLOR[l].label}</span>{/each}</div>
  <table class="tt">
    <thead><tr><th>Standard</th><th>Skills in Keypals</th><th class="w">Class</th><th></th></tr></thead>
    <tbody>
      {#each rows as r (r.code)}
        {@const n = Math.max(1, kids.length)}
        <tr>
          <td class="code">{r.code}</td>
          <td>{r.skills.map(s => s.name).join(', ')} <span class="muted">({r.skills[0]?.area})</span></td>
          <td class="w">
            <div class="stack">{#each [...LEVELS].reverse() as l (l)}<i style:width="{(r.counts[l] / n) * 100}%" style:background={LEVEL_COLOR[l].bg} title="{LEVEL_COLOR[l].label}: {r.counts[l]}"></i>{/each}</div>
            <span class="muted">{[...LEVELS].reverse().filter(l => r.counts[l]).map(l => `${r.counts[l]} ${LEVEL_COLOR[l].label.toLowerCase()}`).join(' · ')}</span>
          </td>
          <td><button class="sbtn" onclick={() => (open = open === r.code ? null : r.code)}>{open === r.code ? 'Hide' : 'Names'}</button></td>
        </tr>
        {#if open === r.code}
          <tr class="names"><td></td><td colspan="3">
            {#each [...LEVELS].reverse() as l (l)}
              {@const who = r.students.filter(s => s.level === l)}
              {#if who.length}<p><span class="chip" style:background={LEVEL_COLOR[l].bg} style:color={LEVEL_COLOR[l].ink}>{LEVEL_COLOR[l].label}</span> {who.map(s => s.name).join(', ')}</p>{/if}
            {/each}
          </td></tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .ck { font: 700 14px var(--font-body); color: #4a4061; display: flex; gap: 6px; align-items: center; }
  .legend { display: flex; gap: 8px; margin: 4px 0 12px; }
  .legend span { font: 800 12px var(--font-body); padding: 3px 10px; border-radius: 99px; }
  .code { font: 700 13px ui-monospace, monospace; white-space: nowrap; }
  .w { width: 34%; }
  .stack { display: flex; height: 14px; border-radius: 99px; overflow: hidden; background: #efedf3; margin-bottom: 3px; }
  .stack i { display: block; height: 100%; }
  .names p { margin: 4px 0; }
</style>
