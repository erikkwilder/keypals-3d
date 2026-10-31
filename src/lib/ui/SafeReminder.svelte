<script lang="ts">
  // A gentle reminder, after a few days of play, that a player's progress lives only in this browser:
  // a grown-up can turn on saving online (Grown-ups screen). "Remind me later" hides it for a week.
  import { game } from '../state/game.svelte';
  import { needsSafety, remindLater, playDays } from '../state/cloud.svelte';
  import Critter from './Critter.svelte';

  let tick = $state(0);
  const who = $derived.by(() => { void tick; return game.save.profiles.filter(p => needsSafety(p)); });
  function later() { for (const p of who) remindLater(p); tick++; }
</script>

{#if who.length}
  {@const first = who[0]}
  <div class="safe card">
    <Critter friend={first.buddy} size={56} round />
    <div class="t">
      <b>Keep {who.length === 1 ? `${first.name}'s` : 'your'} progress safe</b>
      <span>{who.length === 1 ? `${first.name} has played on ${playDays(first)} days` : `${who.map(p => p.name).join(' and ')} have been playing`}. Right now it's saved only in this browser. A grown-up can turn on saving online so nothing is lost.</span>
    </div>
    <div class="b">
      <button class="btn btn-primary" onclick={() => game.openGrownups('saving')}>Grown-ups: turn it on</button>
      <button class="btn btn-ghost" onclick={later}>Remind me later</button>
    </div>
  </div>
{/if}

<style>
  .safe { margin-top: 18px; width: min(860px, 100%); display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: linear-gradient(135deg, #fffaf0, #f3fbff); box-shadow: 0 0 0 3px #ffe6a8, var(--shadow-sm); }
  .t { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .t b { font: 600 19px var(--font-ui); color: var(--ink); }
  .t span { font: 600 14px/1.4 var(--font-body); color: var(--ink2); }
  .b { display: flex; flex-direction: column; gap: 6px; }
  @media (max-width: 640px) { .safe { flex-wrap: wrap; } .b { flex-direction: row; flex-wrap: wrap; width: 100%; } }
</style>
