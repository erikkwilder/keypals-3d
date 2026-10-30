<script lang="ts">
  // For checking (dev hook #measure-pics): a question of every measurement skill and sub at a few rungs,
  // with its picture and its input, on one scrolling page.
  import { mulberry32 } from '../../engine/rng';
  import { MEASURE_SKILLS } from '../skills/measure';
  import SkillPrompt from '../skills/ui/SkillPrompt.svelte';
  import SkillInput from '../skills/ui/SkillInput.svelte';
  import type { Item } from '../skills/types';
  let { onclose }: { onclose?: () => void } = $props();
  let rung = $state(3), seed = $state(1), only = $state('');
  const items = $derived(MEASURE_SKILLS.filter(s => !only || s.id === only).flatMap(s => s.subs.map(sb => s.make(mulberry32(seed * 31 + sb.id.length), sb.id, rung))));
  let picked = $state<Item | null>(null);
</script>

<div class="pg">
  <header>
    <b>Measurement pictures</b>
    <label>Rung <input type="range" min="1" max="6" bind:value={rung} /> {rung}</label>
    <button onclick={() => seed++}>New ones</button>
    <select bind:value={only}><option value="">All skills</option>{#each MEASURE_SKILLS as s (s.id)}<option value={s.id}>{s.id}</option>{/each}</select>
    <button onclick={() => onclose?.()}>Close</button>
  </header>
  <div class="grid">
    {#each items as it (it.id + it.key)}
      <button class="card" onclick={() => (picked = it)}>
        <small>{it.key} · rung {rung}</small>
        <span class="ask">{it.ask}</span>
        <SkillPrompt parts={it.prompt} size={46} picSize={150} />
      </button>
    {/each}
  </div>
  {#if picked}
    <div class="try">
      <div class="q"><span class="ask">{picked.ask}</span><SkillPrompt parts={picked.prompt} size={60} picSize={190} /></div>
      <SkillInput item={picked} onanswer={(a) => { const ok = JSON.stringify(a) === JSON.stringify(picked!.answer) || (a.kind === 'number' && picked!.answer.kind === 'number' && Math.abs(a.value - picked!.answer.value) < 1e-9); alert(ok ? 'Right!' : `Not quite: ${JSON.stringify(a)}`); return ok; }} />
      <button onclick={() => (picked = null)}>Back</button>
    </div>
  {/if}
</div>

<style>
  .pg { position: fixed; inset: 0; z-index: 200; background: #f6f1ff; overflow: auto; font: 600 14px var(--font-body); }
  header { position: sticky; top: 0; display: flex; gap: 14px; align-items: center; padding: 10px 16px; background: #fff; box-shadow: 0 2px 8px rgba(0, 0, 0, .1); z-index: 2; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 14px; padding: 14px; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #fff; border: 0; border-radius: 18px; padding: 12px; box-shadow: 0 4px 12px rgba(60, 40, 110, .12); cursor: pointer; }
  .ask { font: 600 18px var(--font-ui); color: var(--ink); text-align: center; }
  small { color: var(--muted); }
  .try { position: fixed; inset: 0; background: #fbf8ff; z-index: 3; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 20px; }
  .q { display: flex; flex-direction: column; align-items: center; gap: 12px; }
</style>
