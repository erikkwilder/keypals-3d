<script lang="ts">
  // A subject's name and its four ways to play as big picture tabs: Learn, Practice, Games, Adventure.
  // The same tabs, pictures and colours on every subject's page (subjects.ts), and the same ones Home
  // shows on each subject's card.
  import type { Snippet } from 'svelte';
  import { WAYS, wayCount, type Subject, type WayId } from '../subjects';
  import { sfx } from '../audio/sound';
  import { game } from '../state/game.svelte';
  import { pathView } from '../path/launch';

  type Props = { subject: Subject; way: WayId; onpick: (w: WayId) => void; right?: Snippet };
  let { subject, way, onpick, right }: Props = $props();
  const base = import.meta.env.BASE_URL;
  function pick(w: WayId) { if (w === way) return; sfx.click(); onpick(w); }
  // My path for this subject: the units in order, what's done and what's next (screens/MyPath.svelte)
  function path() { sfx.click(); pathView.subject = subject.id; game.go('path'); }
</script>

<div class="wb" style:--sc={subject.color}>
  <div class="subj">
    <img src="{base}{subject.icon}" alt="" />
    <h1>{subject.name}</h1>
    {#if right}<span class="rt">{@render right()}</span>{/if}
    <button class="pathbtn sm" onclick={path} title="My path: what's next in {subject.name}"><img src="{base}icons/path.webp" alt="" />My path</button>
  </div>
  <div class="tabs" role="tablist" aria-label="Ways to play {subject.name}">
    {#each WAYS as w (w.id)}
      {@const n = wayCount(subject, w.id)}
      <button class="tab" class:on={w.id === way} class:soon={!n} role="tab" aria-selected={w.id === way} style:--wc={w.color} style:--wd={w.dark} style:--wt={w.tint} onclick={() => pick(w.id)}>
        <img src="{base}{w.icon}" alt="" />
        <span class="tx"><b>{w.name}</b><small>{n ? w.line : 'Coming soon'}</small></span>
      </button>
    {/each}
  </div>
  <button class="pathbtn lg" onclick={path} title="My path: what's next in {subject.name}"><img src="{base}icons/path.webp" alt="" /><span class="tx"><b>My path</b><small>What's next</small></span></button>
</div>

<style>
  .wb { flex: none; position: relative; z-index: 4; display: flex; align-items: center; gap: 14px; padding: 10px 16px 8px; }
  .subj { flex: none; display: flex; align-items: center; gap: 8px; }
  .subj img { width: 48px; height: 48px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 110, .25)); }
  h1 { margin: 0; font-size: 34px; color: color-mix(in srgb, var(--sc) 80%, #000); }
  .rt { display: flex; align-items: center; gap: 6px; margin-left: 4px; }
  .tabs { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; max-width: 980px; }
  .tab { display: flex; align-items: center; gap: 8px; min-width: 0; border: 0; cursor: pointer; text-align: left; padding: 6px 12px 6px 6px; border-radius: 20px; font: inherit;
    background: #fff; box-shadow: inset 0 0 0 3px var(--wt), 0 4px 0 color-mix(in srgb, var(--wc) 35%, #fff); transition: transform .12s, box-shadow .12s; }
  .tab:hover { transform: translateY(-2px); }
  .tab:focus-visible { outline: 4px solid var(--primary-hi); outline-offset: 2px; }
  .tab img { flex: none; width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 90, .22)); transition: transform .2s; }
  .tab:hover img { transform: scale(1.08) rotate(-4deg); }
  .tx { display: flex; flex-direction: column; min-width: 0; }
  .tx b { font: 600 22px/1.1 var(--font-ui); color: var(--wd); }
  .tx small { font: 700 12.5px/1.2 var(--font-body); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tab.on { background: linear-gradient(color-mix(in srgb, var(--wc) 72%, #fff), var(--wc)); box-shadow: 0 5px 0 var(--wd), 0 12px 20px -12px var(--wd); }
  .tab.on b, .tab.on small { color: #fff; }
  .tab.soon:not(.on) { opacity: .75; }
  /* My path: beside the four ways (on a phone, by the subject's name) */
  .pathbtn { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; font: inherit; background: linear-gradient(#fff8e0, #ffefc0); border-radius: 20px; box-shadow: inset 0 0 0 3px #ffd36b, 0 4px 0 #e8b94a; transition: transform .12s; }
  .pathbtn:hover { transform: translateY(-2px); }
  .pathbtn img { flex: none; object-fit: contain; }
  .pathbtn.lg { flex: none; padding: 6px 14px 6px 6px; }
  .pathbtn.lg img { width: 50px; height: 50px; }
  .pathbtn.lg b { color: #8a5a00; }
  .pathbtn.sm { display: none; margin-left: auto; padding: 3px 12px 3px 4px; font: 600 16px var(--font-ui); color: #8a5a00; border-radius: 999px; }
  .pathbtn.sm img { width: 30px; height: 30px; }

  /* short laptop screens: a slimmer row */
  @media (max-height: 800px) and (min-width: 760px) {
    .wb { padding: 6px 14px 4px; }
    .subj img { width: 38px; height: 38px; }
    h1 { font-size: 28px; }
    .tab { padding: 4px 10px 4px 4px; border-radius: 16px; }
    .tab img { width: 38px; height: 38px; }
    .tx b { font-size: 19px; }
    .tx small { font-size: 11.5px; }
    .pathbtn.lg { padding: 4px 10px 4px 4px; border-radius: 16px; }
    .pathbtn.lg img { width: 38px; height: 38px; }
  }
  @media (max-width: 1100px) { .tx small { display: none; } }
  /* phones: the name on its own row, the four tabs under it, picture over word */
  @media (max-width: 759px) {
    .wb { flex-direction: column; align-items: stretch; gap: 6px; padding: 6px 8px 4px; }
    .subj img { width: 32px; height: 32px; }
    h1 { font-size: 24px; }
    .tabs { gap: 6px; }
    .tab { flex-direction: column; gap: 0; padding: 4px 2px 5px; text-align: center; border-radius: 16px; }
    .tab img { width: 34px; height: 34px; }
    .tx { align-items: center; }
    .tx b { font-size: 15px; }
    .subj { width: 100%; }
    .pathbtn.lg { display: none; }
    .pathbtn.sm { display: flex; }
  }
</style>
