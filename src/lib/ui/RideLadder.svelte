<script lang="ts">
  // The ride ladder in the lesson's top bar. Twelve rides are too many to show at once, so it shows
  // the ride you're on, the next one with a ring that fills as you get closer, and a strip of dots
  // for where you are on the whole ladder.
  import { RIDES } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';

  type Props = { tier: number; progress: number; best: number; record?: number; blocked?: boolean };
  let { tier, progress, best, record = 0, blocked = false }: Props = $props();
  const COLORS = ['#b8aed0', '#ff8fbf', '#4fcf9f', '#79c4f2', '#b79cf2', '#ff8fbf', '#79c4f2', '#4fcf9f', '#b79cf2', '#79c4f2', '#ff8fbf', '#e8cf2a'];
  const LABEL = ['#7d7398', '#d9467f', '#1f9a6a', '#2f86c2', '#7a55cc', '#d9467f', '#2f86c2', '#1f9a6a', '#7a55cc', '#2f86c2', '#d9467f', '#8a7600'];
  const R = 21, C = 2 * Math.PI * R;
  const next = $derived(RIDES[tier + 1]);
</script>

<div class="ladder" aria-label="Ride: {RIDES[tier].name}">
  <div class="label">
    {#if blocked}<span class="now warn">Fewer slips to level up!</span>{:else}<span class="now" style:color={LABEL[tier]}>{RIDES[tier].verb}!</span>{/if}
  </div>
  <div class="box">
    <div class="pair">
      {#key tier}
        <div class="rung on" title={RIDES[tier].name}><svg class="icon" viewBox="0 0 48 48">{@html rideIcon(tier, COLORS[tier])}</svg></div>
      {/key}
      {#if next}
        <span class="arrow">›</span>
        <div class="rung next" title="Next: {next.name}">
          <svg class="ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r={R} fill="none" stroke="#ece6f7" stroke-width="4" /><circle cx="24" cy="24" r={R} fill="none" stroke={COLORS[tier + 1]} stroke-width="4" stroke-linecap="round" stroke-dasharray={C} stroke-dashoffset={C * (1 - progress)} transform="rotate(-90 24 24)" /></svg>
          <svg class="icon" viewBox="0 0 48 48">{@html rideIcon(tier + 1, '#cfc7e2')}</svg>
        </div>
      {/if}
    </div>
    <div class="dots" aria-hidden="true">
      {#each RIDES as r, i (r.id)}
        <i class:got={i <= best} class:on={i === tier} class:rec={i === record && record > 0} style:--c={COLORS[i]} title={r.name}></i>
      {/each}
    </div>
  </div>
</div>

<style>
  .ladder { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .label { font: 600 17px/1 var(--font-ui); height: 24px; }
  .now { background: #fff; padding: 3px 10px; border-radius: 999px; box-shadow: var(--shadow-sm); white-space: nowrap; }
  .now.warn { color: #d9467f; animation: wiggle .6s ease-in-out infinite; display: inline-block; }
  .box { display: flex; flex-direction: column; align-items: center; gap: 5px; background: rgba(255, 255, 255, .9); padding: 6px 10px 7px; border-radius: 22px; box-shadow: var(--shadow-sm); border: var(--panel-border); }
  .pair { display: flex; align-items: center; gap: 6px; }
  .arrow { font: 700 20px/1 var(--font-ui); color: #c9bfe0; }
  .rung { position: relative; width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; }
  .rung .icon { width: 27px; height: 27px; }
  .rung.on { width: 46px; height: 46px; background: #fff; box-shadow: 0 6px 14px -6px rgba(60, 40, 110, .45); animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.5); }
  .rung.on .icon { width: 32px; height: 32px; animation: float-y 1s ease-in-out infinite; }
  .rung .ring { position: absolute; top: -1px; left: -1px; width: 42px; height: 42px; }
  .dots { display: flex; gap: 3px; }
  .dots i { width: 8px; height: 8px; border-radius: 50%; background: #e6e0f1; }
  .dots i.got { background: var(--c); opacity: .55; }
  .dots i.on { opacity: 1; transform: scale(1.35); box-shadow: 0 0 0 2px #fff; }
  .dots i.rec { outline: 2px solid var(--star); outline-offset: 1px; }
</style>
