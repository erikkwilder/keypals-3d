<script lang="ts">
  // The parts of a subject as picture chips: All, then Plus, Minus, Times... (or Home row, Top row... for
  // typing). The same chips on every tab of a subject's page, so a part is easy to follow from Learn to
  // Practice to Games to Adventure. Every chip shows at once: on a computer they wrap onto a second row
  // when there are many (nothing hides off the side), and on a phone one button shows the part picked and
  // opens "Pick a topic", every part as a picture tile, two by two.
  import { onDestroy } from 'svelte';
  import type { Chip } from '../subjects';
  import { sfx } from '../audio/sound';
  import CloseButton from './CloseButton.svelte';

  type Props = { chips: Chip[]; chip: string; onpick: (id: string) => void; label?: string };
  let { chips, chip, onpick, label = 'Which part' }: Props = $props();
  const base = import.meta.env.BASE_URL;
  function pick(id: string) { sheet = false; if (id === chip) return; sfx.click(); onpick(id); }

  let w = $state(1280);
  const phone = $derived(w < 760);
  const cur = $derived(chips.find(c => c.id === chip) ?? null);
  /** the phone's "Pick a topic" sheet */
  let sheet = $state(false);
  function openSheet() { sfx.pop(); sheet = true; }
  function onKey(e: KeyboardEvent) { if (sheet && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); sheet = false; } }
  $effect(() => { if (sheet) { window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true); } });
  onDestroy(() => window.removeEventListener('keydown', onKey, true));
</script>

<svelte:window bind:innerWidth={w} />

{#if !phone}
  <nav class="cr" aria-label={label}>
    <button class="chip all" class:on={chip === 'all'} aria-pressed={chip === 'all'} data-chip="all" onclick={() => pick('all')}>All</button>
    {#each chips as c (c.id)}
      <button class="chip" class:on={c.id === chip} aria-pressed={c.id === chip} data-chip={c.id} style:--cc={c.color} onclick={() => pick(c.id)}>
        <img src="{base}{c.art}" alt="" /><span>{c.name}</span>
      </button>
    {/each}
  </nav>
{:else}
  <div class="one">
    <button class="now" style:--cc={cur?.color ?? '#2a1b3d'} onclick={openSheet} aria-haspopup="dialog">
      {#if cur}<img src="{base}{cur.art}" alt="" />{:else}<span class="allpic">All</span>{/if}
      <span class="nt"><small>{label}</small><b>{cur?.name ?? `All ${chips.length} topics`}</b></span>
      <span class="change">Pick a topic</span>
    </button>
  </div>
  {#if sheet}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sbg" onclick={() => (sheet = false)}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Pick a topic" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <div class="sh"><h2>Pick a topic</h2><CloseButton onclick={() => (sheet = false)} label="Close" size={38} /></div>
        <div class="grid">
          <button class="tile all" class:on={chip === 'all'} onclick={() => pick('all')}><span class="allpic big">All</span><b>All of them</b></button>
          {#each chips as c (c.id)}
            <button class="tile" class:on={c.id === chip} style:--cc={c.color} onclick={() => pick(c.id)}><img src="{base}{c.art}" alt="" /><b>{c.name}</b></button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* a computer: every chip in sight, wrapping onto a second row when there are many */
  .cr { flex: none; position: relative; z-index: 4; display: flex; flex-wrap: wrap; gap: 6px; padding: 2px 16px 8px; }
  .chip { --cc: #7c5cf5; flex: none; display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 3px 12px 3px 3px; border-radius: 999px; background: rgba(255, 255, 255, .92);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cc) 30%, #fff); font: 600 15.5px var(--font-ui); color: var(--ink2); transition: transform .12s; }
  .chip:hover { transform: translateY(-2px); }
  .chip img { width: 46px; height: 30px; object-fit: cover; border-radius: 999px; }
  .chip.all { padding: 7px 16px; }
  .chip.on { background: var(--cc); color: #fff; box-shadow: 0 3px 0 color-mix(in srgb, var(--cc) 70%, #000); }
  .chip.all.on { background: var(--ink); box-shadow: 0 3px 0 #000; }
  .chip:focus-visible, .now:focus-visible, .tile:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 2px; }
  /* short laptop screens: slimmer chips, so two rows take little room */
  @media (max-height: 800px) {
    .cr { gap: 5px; padding-bottom: 6px; }
    .chip { font-size: 14.5px; padding: 2px 10px 2px 2px; }
    .chip img { width: 40px; height: 26px; }
    .chip.all { padding: 5px 14px; }
  }

  /* a phone: one button with the part picked, opening the picture tiles */
  .one { flex: none; position: relative; z-index: 4; padding: 2px 8px 6px; }
  .now { --cc: #2a1b3d; width: 100%; display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 4px 6px 4px 4px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--cc) 40%, #fff), 0 3px 0 color-mix(in srgb, var(--cc) 30%, #fff); text-align: left; }
  .now img { width: 50px; height: 34px; object-fit: cover; border-radius: 999px; flex: none; }
  .allpic { flex: none; display: grid; place-items: center; width: 50px; height: 34px; border-radius: 999px; background: var(--ink); color: #fff; font: 600 15px var(--font-ui); }
  .nt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nt small { font: 800 10.5px var(--font-body); letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
  .nt b { font: 600 17px/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .change { flex: none; font: 600 14px var(--font-ui); color: #fff; background: var(--primary); padding: 7px 12px; border-radius: 999px; box-shadow: 0 3px 0 var(--primary-edge, #4b33b8); }
  .sbg { position: fixed; inset: 0; z-index: 60; background: rgba(36, 24, 70, .45); display: flex; align-items: flex-end; animation: fade .18s ease; }
  @keyframes fade { from { opacity: 0; } }
  .sheet { width: 100%; max-height: 86dvh; overflow: auto; overscroll-behavior: contain; background: #fff; border-radius: 26px 26px 0 0; padding: 12px 12px 18px; box-shadow: 0 -10px 40px rgba(30, 10, 70, .35); animation: up .22s cubic-bezier(.3, .8, .4, 1.2); }
  @keyframes up { from { transform: translateY(40px); opacity: 0; } }
  .sh { display: flex; align-items: center; justify-content: space-between; padding: 0 2px 8px; }
  .sh h2 { margin: 0; font-size: 22px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .tile { --cc: #7c5cf5; display: flex; flex-direction: column; align-items: stretch; gap: 4px; border: 0; cursor: pointer; padding: 5px 5px 7px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cc) 30%, #fff), 0 3px 0 color-mix(in srgb, var(--cc) 25%, #fff); }
  .tile img { width: 100%; height: 62px; object-fit: cover; border-radius: 14px; }
  .tile b { font: 600 15px/1.15 var(--font-ui); color: var(--ink); text-align: center; }
  .tile .allpic.big { width: 100%; height: 62px; border-radius: 14px; font-size: 22px; }
  .tile.on { background: var(--cc); box-shadow: 0 3px 0 color-mix(in srgb, var(--cc) 70%, #000); }
  .tile.all.on { background: var(--ink); }
  .tile.on b { color: #fff; }
</style>
