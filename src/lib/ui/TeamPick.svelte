<script lang="ts">
  // "Put Fern Fox on your team", right where a new Glimmer joins you (a battle's win card, an egg's hatch
  // card): one tap when there's room; when both places are taken it asks who makes room, with their faces,
  // and that one stays yours (only the team changes). Glimmers on the team say so.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { glimmerName, type GlimmerId } from '../adventure/glimmers';
  import { advOf, advView, putOnTeam, teamGap } from '../adventure/state';
  import Icon from './Icon.svelte';

  let { id }: { id: GlimmerId } = $props();
  const base = import.meta.env.BASE_URL;
  const a = $derived(advView(game.profile!));
  const onTeam = $derived(a.team.includes(id));
  const nameOf = (g: GlimmerId) => glimmerName(g, !!a.glimmers[g]?.evolved);
  const face = (g: GlimmerId) => `${base}game/glimmers/face/${g}${a.glimmers[g]?.evolved ? '-evo' : ''}.webp`;
  /** the two on the team (asked who makes room) */
  let asking = $state(false);
  function put(slot: number) {
    game.update(pp => putOnTeam(advOf(pp), id, slot));
    sfx.equip(); asking = false;
  }
  function start() {
    const gap = teamGap(a);
    if (gap >= 0) put(gap); else { sfx.pop(); asking = true; }
  }
</script>

<!-- (the keys stay here: Enter on these buttons mustn't also press the win card's own Enter) -->
<div class="tp" role="group" aria-label="Your team" onkeydown={(e) => e.stopPropagation()}>
  {#if onTeam}
    <p class="on"><Icon name="check" size={20} /> On your team</p>
  {:else if asking}
    <p class="ask">Your team is full. Who should make room for {nameOf(id)}?</p>
    <div class="who">
      {#each a.team as t, slot (slot)}
        {#if t}<button class="mate" onclick={() => put(slot)}><img src={face(t)} alt="" /><span>Swap {nameOf(t)}</span></button>{/if}
      {/each}
    </div>
    <button class="never" onclick={() => { sfx.click(); asking = false; }}>Keep my team</button>
  {:else}
    <button class="btn put" onclick={start}>Put {nameOf(id)} on your team</button>
  {/if}
</div>

<style>
  .tp { margin-top: 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .on { margin: 0; display: inline-flex; align-items: center; gap: 5px; font: 600 17px var(--font-ui); color: #157a52; }
  .ask { margin: 0; font: 600 16px/1.25 var(--font-ui); color: var(--ink); }
  .who { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .mate { display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 16px 4px 4px; border: 0; border-radius: 999px; cursor: pointer; background: #fff; box-shadow: inset 0 0 0 3px #d9cff5, 0 3px 0 #d9cff5; font: 600 16px var(--font-ui); color: var(--ink); transition: transform .14s; }
  .mate:hover, .mate:focus-visible { transform: translateY(-2px); box-shadow: inset 0 0 0 3px #7c5cf5, 0 3px 0 #7c5cf5; }
  .mate img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 35%; background: #eef; }
  .never { border: 0; background: none; padding: 6px 10px; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); text-decoration: underline; text-underline-offset: 3px; }
</style>
