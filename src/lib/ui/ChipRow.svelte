<script lang="ts">
  // The parts of a subject as a row of picture chips: All, then Plus, Minus, Times... (or Home row, Top
  // row... for typing). The same chips on every tab of a subject's page, so a part is easy to follow
  // from Learn to Practice to Games to Adventure. The row scrolls sideways when it doesn't fit.
  import type { Chip } from '../subjects';
  import { sfx } from '../audio/sound';

  type Props = { chips: Chip[]; chip: string; onpick: (id: string) => void; label?: string };
  let { chips, chip, onpick, label = 'Which part' }: Props = $props();
  const base = import.meta.env.BASE_URL;
  function pick(id: string) { if (id === chip) return; sfx.click(); onpick(id); }
</script>

<nav class="cr" aria-label={label}>
  <button class="chip all" class:on={chip === 'all'} aria-pressed={chip === 'all'} onclick={() => pick('all')}>All</button>
  {#each chips as c (c.id)}
    <button class="chip" class:on={c.id === chip} aria-pressed={c.id === chip} style:--cc={c.color} onclick={() => pick(c.id)}>
      <img src="{base}{c.art}" alt="" /><span>{c.name}</span>
    </button>
  {/each}
</nav>

<style>
  .cr { flex: none; position: relative; z-index: 4; display: flex; gap: 6px; padding: 2px 16px 8px; overflow-x: auto; scrollbar-width: none; }
  .cr::-webkit-scrollbar { display: none; }
  .chip { --cc: #7c5cf5; flex: none; display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 3px 12px 3px 3px; border-radius: 999px; background: rgba(255, 255, 255, .92);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cc) 30%, #fff); font: 600 15.5px var(--font-ui); color: var(--ink2); transition: transform .12s; }
  .chip:hover { transform: translateY(-2px); }
  .chip img { width: 46px; height: 30px; object-fit: cover; border-radius: 999px; }
  .chip.all { padding: 7px 16px; }
  .chip.on { background: var(--cc); color: #fff; box-shadow: 0 3px 0 color-mix(in srgb, var(--cc) 70%, #000); }
  .chip.all.on { background: var(--ink); box-shadow: 0 3px 0 #000; }
  .chip:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 2px; }
  @media (max-width: 759px) { .cr { padding: 2px 8px 6px; gap: 5px; } .chip { font-size: 14px; } .chip img { width: 36px; height: 26px; } }
</style>
