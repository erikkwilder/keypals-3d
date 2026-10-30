<script lang="ts">
  // Today, at the top of Home and of My path: a short, friendly line about where you are ("2 of 3 things
  // done today · 10 of 20 minutes · Unit 2: almost done"), a dot for each of today's path things, and one
  // big Continue button that starts the next thing on the path. A teacher's unit comes first.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { KIND_ICON, KIND_NAME } from './units';
  import { todayLine } from './progress';
  import { nextFor, playerRules } from './player.svelte';
  import { pathHolds } from './rules';
  import { startItem, pathView } from './launch';

  type Props = { compact?: boolean; onPage?: boolean; subject?: string };
  let { compact = false, onPage = false, subject }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const rules = $derived(playerRules(p));
  const next = $derived(nextFor(p, subject));
  const t = $derived(todayLine(p, rules.goal, next));
  const holds = $derived(pathHolds(p, rules));
  const dots = $derived(Array.from({ length: Math.max(t.goal, Math.min(t.done, 8)) }, (_, i) => i < t.done));
  function go() { if (next) startItem(p, next.unit.unit, next.item); }
  function openPath() { sfx.click(); if (subject) pathView.subject = subject; game.go('path'); }
</script>

<section class="today" class:compact class:page={onPage} aria-label="Today">
  <img class="cal" src="{base}icons/daily.webp" alt="" />
  <div class="tx">
    <h2>Today</h2>
    <p>{t.line}</p>
    <div class="dots" aria-hidden="true">{#each dots as d, i (i)}<i class:on={d}></i>{/each}</div>
    {#if holds}<small class="note">{rules.keep === 'only' ? 'Today is a path day: your path and what it starts.' : `Your path comes first today. Then everything opens!`}</small>{/if}
  </div>
  <div class="acts">
    {#if next}
      <button class="btn btn-primary go" onclick={go}>
        <img src="{base}{KIND_ICON[next.item.kind]}" alt="" />
        <span><small>{t.done === 0 && t.min === 0 ? 'Start' : 'Continue'} · {KIND_NAME[next.item.kind]}{next.teacher ? ` for ${next.teacher}` : ''}</small><b>{next.item.name}</b></span>
      </button>
    {:else}
      <p class="fin">You finished the whole path. Play anything you like!</p>
    {/if}
    {#if !onPage}<button class="btn mp" onclick={openPath}><img src="{base}icons/path.webp" alt="" />My path</button>{/if}
  </div>
</section>

<style>
  .today { box-sizing: border-box; width: 100%; max-width: 1500px; display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 24px; background: #fff; box-shadow: 0 0 0 3px #ffe2a8, 0 14px 28px -20px rgba(60, 40, 110, .55); }
  .cal { width: 58px; height: 58px; object-fit: contain; flex: none; }
  .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  h2 { margin: 0; font-size: 22px; color: #8a5a00; }
  .tx p { margin: 0; font: 700 15.5px/1.35 var(--font-body); color: var(--ink2); }
  .dots { display: flex; gap: 6px; margin-top: 2px; }
  .dots i { width: 16px; height: 16px; border-radius: 50%; background: #f1ecf8; box-shadow: inset 0 0 0 2px #e2d9f1; }
  .dots i.on { background: linear-gradient(#7fe0a8, #2fb36e); box-shadow: 0 2px 0 #23905a; }
  .note { font: 800 13px var(--font-body); color: #a8246a; }
  .acts { display: flex; align-items: center; gap: 10px; flex: none; }
  .go { display: flex; align-items: center; gap: 10px; text-align: left; padding: 8px 18px 8px 10px; max-width: 360px; }
  .go img { width: 40px; height: 40px; object-fit: contain; flex: none; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, .2)); }
  .go span { display: flex; flex-direction: column; min-width: 0; }
  .go small { font: 700 13px var(--font-body); opacity: .92; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .go b { font: 600 21px/1.15 var(--font-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mp { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px 8px 8px; font-size: 17px; }
  .mp img { width: 34px; height: 34px; object-fit: contain; }
  .fin { margin: 0; font: 700 15px var(--font-body); color: #17704a; max-width: 260px; }
  .page { box-shadow: 0 0 0 3px #ffe2a8, 0 10px 22px -18px rgba(60, 40, 110, .5); }
  @media (max-width: 860px) {
    .today { flex-wrap: wrap; }
    .acts { width: 100%; }
    .go { flex: 1; max-width: none; }
  }
  .compact { padding: 10px 12px; gap: 10px; }
  .compact .cal { width: 44px; height: 44px; }
  .compact h2 { font-size: 19px; }
  .compact .tx p { font-size: 13.5px; }
  .compact .go b { font-size: 18px; }
  .compact .go img { width: 32px; height: 32px; }
  .compact .mp { font-size: 15px; padding: 6px 10px 6px 6px; }
  .compact .mp img { width: 28px; height: 28px; }
</style>
