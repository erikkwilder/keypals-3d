<script lang="ts">
  // A special egg arrives (the 100-Glimmer ladder, adventure/ladder.ts): a goal was met, so its egg comes
  // with a moment: light, the egg wobbling in, "A Milestone egg! Something special is inside." and what
  // was done to earn it. Hatch it goes to the eggs (it's warm already: it hatches straight away).
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { GLIMMER, RARITY, rarityRank } from '../adventure/glimmers';
  import { SEASON_OF, SOURCES } from '../adventure/ladder';
  import { WORLD_PIN } from '../adventure/worlds';
  import { CALM_SCREENS, moment, nextMoment } from '../adventure/ladderMoment.svelte';
  import Confetti from './Confetti.svelte';

  const base = import.meta.env.BASE_URL;
  const n = $derived(moment.queue[0] ?? null);
  const show = $derived(!!n && CALM_SCREENS.has(game.screen) && !game.modalOpen && !!game.profile);
  let burst = $state(0);
  let shownId = '';
  $effect(() => {
    if (!show || !n || shownId === n.egg.id) return;
    shownId = n.egg.id;
    sfx.reveal(rarityRank(GLIMMER[n.id].rarity)); burst++;
  });
  const SEASON_EGG: Record<string, string> = { autumn: 'An Autumn egg!', winter: 'A Winter egg!', spring: 'A Spring egg!', summer: 'A Summer egg!', newyear: 'A New Year egg!', birthday: 'A Birthday egg!' };
  const title = $derived(!n ? '' : n.source === 'season' ? SEASON_EGG[SEASON_OF[n.id] ?? ''] ?? 'A Season egg!'
    : n.source === 'native' && GLIMMER[n.id].world ? `A World egg from ${WORLD_PIN[GLIMMER[n.id].world!]?.name ?? 'a math world'}!` : `A ${SOURCES[n.source].egg}!`);
  function hatchIt() { sfx.click(); nextMoment(); game.go('eggs'); }
  function later() { sfx.click(); nextMoment(); }
</script>

{#if show && n}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="lm" onclick={later}>
    <div class="box" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title} tabindex="-1" style:--rc={RARITY[GLIMMER[n.id].rarity].color}>
      <div class="rays"></div>
      <div class="glow"></div>
      <img class="egg" src="{base}game/egg-{n.source}.webp" alt="" />
      <p class="kick">Something special is inside.</p>
      <h2>{title}</h2>
      <p class="why">{n.done}</p>
      <div class="row">
        <button class="btn btn-primary big" onclick={hatchIt}>Hatch it!</button>
        <button class="btn" onclick={later}>Later</button>
      </div>
      {#if moment.queue.length > 1}<small class="more">and {moment.queue.length - 1} more special egg{moment.queue.length > 2 ? 's' : ''}!</small>{/if}
    </div>
    <Confetti {burst} count={70} x={50} y={35} spread={1.4} />
  </div>
{/if}

<style>
  .lm { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; background: radial-gradient(circle at 50% 40%, rgba(255, 236, 170, .35), rgba(40, 28, 70, .55) 70%); animation: fade .3s ease; }
  @keyframes fade { from { opacity: 0; } }
  .box { position: relative; overflow: hidden; width: min(440px, 94vw); max-height: 94vh; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 22px 22px 18px; border-radius: 30px;
    background: linear-gradient(#fffdf6, #fff4e0); box-shadow: 0 0 0 4px #fff, 0 0 0 7px color-mix(in srgb, var(--rc) 60%, #ffd36b), 0 24px 60px -20px rgba(40, 20, 80, .6); animation: pop .6s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes pop { from { transform: scale(.5) rotate(-4deg); opacity: 0; } }
  .rays { position: absolute; left: 50%; top: 32%; width: 900px; height: 900px; margin: -450px 0 0 -450px; background: repeating-conic-gradient(from 0deg, rgba(255, 210, 90, .26) 0 9deg, transparent 9deg 20deg); animation: spin 16s linear infinite; pointer-events: none; mask: radial-gradient(circle, #000 20%, transparent 60%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 60%); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .glow { position: absolute; left: 50%; top: 30%; width: 260px; height: 260px; margin: -130px 0 0 -130px; border-radius: 50%; background: radial-gradient(circle, #fff 0%, color-mix(in srgb, var(--rc) 45%, #ffe9a8) 40%, transparent 70%); filter: blur(6px); animation: breathe 1.8s ease-in-out infinite; pointer-events: none; }
  @keyframes breathe { 50% { transform: scale(1.12); opacity: .85; } }
  .egg { position: relative; height: min(220px, 30vh); filter: drop-shadow(0 14px 18px rgba(60, 30, 0, .35)); transform-origin: 50% 92%; animation: drop .9s cubic-bezier(.2, 1.5, .4, 1) both, wob 1.6s 1s ease-in-out infinite; }
  @keyframes drop { from { transform: translateY(-120%) scale(.6); } }
  @keyframes wob { 0%, 60%, 100% { transform: rotate(0); } 70% { transform: rotate(-7deg); } 80% { transform: rotate(7deg); } 90% { transform: rotate(-4deg); } }
  .kick { position: relative; margin: 4px 0 0; font: 800 15px var(--font-body); color: var(--muted); }
  h2 { position: relative; margin: 0; font-size: 34px; color: #b06d00; text-shadow: 0 2px 0 #fff; }
  .why { position: relative; margin: 0; font: 700 18px/1.35 var(--font-body); color: var(--ink2); }
  .row { position: relative; display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
  .big { font-size: 22px; padding: 12px 28px; }
  .more { position: relative; font: 800 13px var(--font-body); color: var(--muted); }
  @media (max-width: 600px) { h2 { font-size: 28px; } .why { font-size: 16px; } }
</style>
