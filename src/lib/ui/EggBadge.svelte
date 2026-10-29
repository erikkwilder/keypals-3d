<script lang="ts">
  // The egg warming while you practice: the first Adventure egg that isn't ready yet, with its ring
  // filling as you answer (`warm`: right answers so far this session). Hidden when there are no eggs.
  import { game } from '../state/game.svelte';
  import { advView } from '../adventure/state';
  import { RARITY } from '../adventure/glimmers';
  type Props = { warm: number };
  let { warm }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const egg = $derived(game.profile ? (advView(game.profile).incubator.find(e => e && e.have < e.need) ?? null) : null);
  const have = $derived(egg ? Math.min(egg.need, egg.have + warm) : 0);
  let bump = $state(0);
  let last = 0;
  $effect(() => { if (warm > last) { last = warm; bump++; } });
</script>

{#if egg}
  <div class="eb" title="Your {RARITY[egg.rarity].name} egg warms with every right answer">
    {#key bump}<img class:wob={bump > 0} class:ready={have >= egg.need} src="{base}game/egg-{egg.rarity}.webp" alt="" />{/key}
    <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" /><circle class="fg" cx="20" cy="20" r="17" style:stroke-dasharray="{(have / egg.need) * 106.8} 200" /></svg>
    <span>{have >= egg.need ? 'Ready!' : `${have}/${egg.need}`}</span>
  </div>
{/if}

<style>
  .eb { position: relative; display: flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 2px 10px 2px 2px; box-shadow: var(--shadow-sm); flex: none; }
  .eb img { width: 34px; height: 34px; object-fit: contain; position: relative; z-index: 1; }
  .eb img.wob { animation: wob .5s ease; }
  .eb img.ready { animation: wob .6s ease-in-out infinite; }
  svg { position: absolute; left: 0; top: 0; width: 38px; height: 38px; transform: rotate(-90deg); }
  circle { fill: none; stroke: #ece6f6; stroke-width: 3.5; }
  .fg { stroke: #ffb52e; stroke-linecap: round; transition: stroke-dasharray .3s; }
  span { font: 600 14px var(--font-ui); color: var(--ink); }
  @keyframes wob { 25% { transform: rotate(-14deg) scale(1.1); } 75% { transform: rotate(12deg); } }
</style>
