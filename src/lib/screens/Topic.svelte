<script lang="ts">
  // One topic (Math › Fractions, Typing › Home Row Island): the one top bar (← Math | Fractions, with the
  // trail and grades under it); what's next in this topic with one Continue; the four ways as big tiles,
  // the same pictures and colours everywhere (Learn, Practice: its islands map, Play: its game, Adventure:
  // its world), each opening that screen for this topic; and a small row: Show What You Know (skip ahead)
  // and this topic's garden bed. A way with nothing yet is a soft "Coming soon" tile, never hidden.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { SUBJECT } from '../subjects';
  import { topicExtras, topicNext, topicWays } from '../nav';
  import { AREA } from '../math/skills/registry';
  import { REGION, type RegionId } from '../engine/course';
  import type { AreaId } from '../math/skills/types';
  import Bar from '../ui/Bar.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const sid = $derived(SUBJECT[game.subject] ? game.subject : 'math');
  const tid = $derived(game.topic ?? SUBJECT[sid].chips[0].id);
  const chip = $derived(SUBJECT[sid].chips.find(c => c.id === tid) ?? SUBJECT[sid].chips[0]);
  const blurb = $derived(sid === 'math' ? AREA[tid as AreaId]?.blurb ?? '' : REGION[tid as RegionId]?.blurb ?? '');
  const next = $derived(topicNext(sid, tid, p));
  const ways = $derived(topicWays(sid, tid, p));
  const extras = $derived(topicExtras(sid, tid));
</script>

<div class="screen topicpage" style:--tc={chip.color}>
  <Bar />
  <div class="body scroll">
    <section class="next">
      <span class="art" style:background-image="url({base}{chip.art})"></span>
      <div class="tx">
        <small>Next in {chip.name}</small>
        <b>{next.label}</b>
        {#if blurb}<span>{blurb}</span>{/if}
      </div>
      <button class="btn btn-primary go" onclick={next.go}><img src="{base}icons/play.webp" alt="" />Continue</button>
    </section>

    <div class="ways">
      {#each ways as w (w.id)}
        <button class="way" class:soon={w.soon} style:--wc={w.color} style:--wt={w.tint} onclick={w.go}>
          <img src="{base}{w.icon}" alt="" />
          <b>{w.name}</b>
          <small>{w.line}</small>
        </button>
      {/each}
    </div>

    {#if extras.length}
      <nav class="extras" aria-label="More for {chip.name}">
        {#each extras as x (x.id)}
          <button class="xlink" onclick={x.go}><img src="{base}{x.icon}" alt="" />{x.name}</button>
        {/each}
      </nav>
    {/if}
  </div>
</div>

<style>
  .topicpage { display: flex; flex-direction: column; background: linear-gradient(color-mix(in srgb, var(--tc) 10%, #fff), #fbf9ff 45%, #f7fbff); }
  .body { flex: 1; min-height: 0; padding: 16px 24px 28px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .body > * { width: min(1100px, 100%); }
  .next { display: flex; align-items: center; gap: 16px; padding: 12px 16px 12px 12px; border-radius: 24px; background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--tc) 35%, #fff), 0 14px 28px -20px rgba(60, 40, 110, .55); }
  .art { flex: none; width: 120px; height: 84px; border-radius: 16px; background: center / cover no-repeat; }
  .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .tx small { font: 800 13px var(--font-body); color: color-mix(in srgb, var(--tc) 75%, #000); text-transform: none; }
  .tx b { font: 600 24px/1.15 var(--font-ui); color: var(--ink); }
  .tx span { font: 600 14px/1.3 var(--font-body); color: var(--muted); }
  .go { flex: none; display: inline-flex; align-items: center; gap: 8px; font-size: 22px; padding: 12px 22px 12px 14px; }
  .go img { width: 30px; height: 30px; object-fit: contain; filter: brightness(10); }

  .ways { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .way { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; cursor: pointer; padding: 18px 10px 16px; border-radius: 26px; background: var(--wt); box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--wc) 30%, #fff), 0 6px 0 color-mix(in srgb, var(--wc) 25%, #fff); transition: transform .15s; text-align: center; }
  .way:hover, .way:focus-visible { transform: translateY(-3px); box-shadow: inset 0 0 0 3px var(--wc), 0 8px 0 color-mix(in srgb, var(--wc) 35%, #fff); }
  .way img { width: 96px; height: 96px; object-fit: contain; filter: drop-shadow(0 6px 6px rgba(60, 30, 90, .2)); }
  .way b { font: 600 26px var(--font-ui); color: color-mix(in srgb, var(--wc) 75%, #000); }
  .way small { font: 700 14px/1.3 var(--font-body); color: var(--ink2); }
  .way.soon { opacity: .62; box-shadow: inset 0 0 0 3px #ece8f2; background: #f8f6fb; }
  .way.soon img { filter: grayscale(.8); }
  .way.soon b { color: var(--muted); }

  .extras { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .xlink { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 14px 4px 5px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px #e6def5; font: 600 16px var(--font-ui); color: var(--ink); }
  .xlink img { width: 30px; height: 30px; object-fit: contain; }
  .xlink:hover { box-shadow: inset 0 0 0 2px #c9b8ff; }

  @media (max-height: 760px) and (min-width: 600px) { .way img { width: 76px; height: 76px; } .way { padding: 12px 8px 12px; } .body { gap: 12px; padding-top: 12px; } }
  @media (max-width: 760px) {
    .ways { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }
  @media (max-width: 600px) {
    .body { padding: 10px 12px 20px; gap: 12px; }
    .next { flex-wrap: wrap; gap: 10px; padding: 10px; }
    .art { width: 76px; height: 56px; }
    .tx b { font-size: 19px; }
    .tx span { display: none; }
    .go { width: 100%; justify-content: center; font-size: 20px; }
    .way img { width: 64px; height: 64px; }
    .way b { font-size: 21px; }
    .way small { font-size: 12.5px; }
  }
</style>
