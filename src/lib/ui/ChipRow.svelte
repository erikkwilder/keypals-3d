<script lang="ts">
  // The parts of a subject as a row of picture chips: All, then Plus, Minus, Times... (or Home row, Top
  // row... for typing). The same chips on every tab of a subject's page, so a part is easy to follow
  // from Learn to Practice to Games to Adventure. The row scrolls sideways when it doesn't fit: the edge
  // that has more chips past it fades out, and on a computer an arrow there scrolls it along (a mouse
  // wheel does too). The chip picked always scrolls into sight.
  import { onMount, tick } from 'svelte';
  import type { Chip } from '../subjects';
  import { sfx } from '../audio/sound';
  import Icon from './Icon.svelte';

  type Props = { chips: Chip[]; chip: string; onpick: (id: string) => void; label?: string };
  let { chips, chip, onpick, label = 'Which part' }: Props = $props();
  const base = import.meta.env.BASE_URL;
  function pick(id: string) { if (id === chip) return; sfx.click(); onpick(id); }

  let row = $state<HTMLElement | null>(null);
  /** more chips past the left edge, or the right */
  let moreL = $state(false), moreR = $state(false);
  function measure() {
    if (!row) return;
    moreL = row.scrollLeft > 4;
    moreR = row.scrollLeft + row.clientWidth < row.scrollWidth - 4;
  }
  function slide(dir: -1 | 1) {
    if (!row) return;
    sfx.click();
    row.scrollBy({ left: dir * Math.max(160, row.clientWidth * 0.6), behavior: 'smooth' });
  }
  /** a mouse wheel turned up and down moves the row sideways */
  function wheel(e: WheelEvent) {
    if (!row || !(moreL || moreR) || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    e.preventDefault();
    row.scrollLeft += e.deltaY;
  }
  // the chip picked (here, or from a card's link) comes into sight
  $effect(() => {
    const id = chip;
    void tick().then(() => {
      const el = row?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(id)}"]`);
      if (!row || !el) return;
      const l = el.offsetLeft - row.offsetLeft, pad = 56;
      if (l < row.scrollLeft + pad) row.scrollTo({ left: Math.max(0, l - pad), behavior: 'smooth' });
      else if (l + el.offsetWidth > row.scrollLeft + row.clientWidth - pad) row.scrollTo({ left: l + el.offsetWidth - row.clientWidth + pad, behavior: 'smooth' });
    });
  });
  onMount(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (row) { ro.observe(row); for (const c of row.children) ro.observe(c); }
    return () => ro.disconnect();
  });
</script>

<div class="crw" class:fadeL={moreL} class:fadeR={moreR}>
  <nav class="cr" aria-label={label} bind:this={row} onscroll={measure} onwheel={wheel}>
    <button class="chip all" class:on={chip === 'all'} aria-pressed={chip === 'all'} data-chip="all" onclick={() => pick('all')}>All</button>
    {#each chips as c (c.id)}
      <button class="chip" class:on={c.id === chip} aria-pressed={c.id === chip} data-chip={c.id} style:--cc={c.color} onclick={() => pick(c.id)}>
        <img src="{base}{c.art}" alt="" /><span>{c.name}</span>
      </button>
    {/each}
  </nav>
  {#if moreL}<button class="arrow l" aria-label="More to the left" tabindex="-1" onclick={() => slide(-1)}><Icon name="left" size={26} /></button>{/if}
  {#if moreR}<button class="arrow r" aria-label="More to the right" tabindex="-1" onclick={() => slide(1)}><Icon name="right" size={26} /></button>{/if}
</div>

<style>
  .crw { flex: none; position: relative; z-index: 4; min-width: 0; }
  .cr { display: flex; gap: 6px; padding: 2px 16px 8px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .cr::-webkit-scrollbar { display: none; }
  /* the edge with more chips past it fades out */
  .crw.fadeR .cr { mask-image: linear-gradient(to right, #000 calc(100% - 90px), transparent calc(100% - 8px)); }
  .crw.fadeL .cr { mask-image: linear-gradient(to left, #000 calc(100% - 90px), transparent calc(100% - 8px)); }
  .crw.fadeL.fadeR .cr { mask-image: linear-gradient(to right, transparent 8px, #000 90px, #000 calc(100% - 90px), transparent calc(100% - 8px)); }
  .chip { --cc: #7c5cf5; flex: none; display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 3px 12px 3px 3px; border-radius: 999px; background: rgba(255, 255, 255, .92);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--cc) 30%, #fff); font: 600 15.5px var(--font-ui); color: var(--ink2); transition: transform .12s; }
  .chip:hover { transform: translateY(-2px); }
  .chip img { width: 46px; height: 30px; object-fit: cover; border-radius: 999px; }
  .chip.all { padding: 7px 16px; }
  .chip.on { background: var(--cc); color: #fff; box-shadow: 0 3px 0 color-mix(in srgb, var(--cc) 70%, #000); }
  .chip.all.on { background: var(--ink); box-shadow: 0 3px 0 #000; }
  .chip:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 2px; }
  .arrow { position: absolute; top: 0; width: 40px; height: 40px; display: grid; place-items: center; border: 0; padding: 0; cursor: pointer; border-radius: 50%;
    background: #fff; box-shadow: 0 2px 8px rgba(40, 30, 90, .22), inset 0 0 0 2px #e4ecfb; transition: transform .12s; }
  .arrow:hover { transform: scale(1.08); }
  .arrow.l { left: 6px; }
  .arrow.r { right: 6px; }
  @media (max-width: 759px) { .cr { padding: 2px 8px 6px; gap: 5px; } .chip { font-size: 14px; } .chip img { width: 36px; height: 26px; } }
  /* on a phone a finger swipes the row: the fade is enough, no arrows */
  @media (max-width: 759px), (pointer: coarse) { .arrow { display: none; } }
</style>
