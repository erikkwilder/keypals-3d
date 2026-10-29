<script lang="ts">
  // Money and decimal pictures: a row of painted island coins (a shell penny, a turtle nickel, a fish dime,
  // a whale quarter, a sun dollar, a dollar bill), each its real size against the others, or a chocolate
  // slab of 100 squares with some eaten (hundredths).
  import type { Pic } from '../types';
  type Props = { pic: Extract<Pic, { kind: 'coins' } | { kind: 'grid' }>; size?: number };
  let { pic, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const ART: Record<number, string> = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter', 100: 'dollar', [-100]: 'bill' };
  /** each coin's width against a quarter's (the real coins' sizes) */
  const REL: Record<number, number> = { 1: 0.8, 5: 0.88, 10: 0.74, 25: 1, 100: 1.08, [-100]: 1.6 };
  const uid = `mp${Math.random().toString(36).slice(2, 8)}`;
  const coinW = $derived(Math.round(size * (pic.kind === 'coins' && pic.coins.length > 5 ? 0.38 : 0.46)));
</script>

{#if pic.kind === 'coins'}
  <span class="coins" role="img" aria-label="{pic.coins.length} coins" style:--cw="{coinW}px">
    {#each pic.coins as c, i (i)}
      <img src="{base}math/money/{ART[c]}.webp" alt="" draggable="false" style:width="{Math.round(coinW * REL[c])}px" style:--r="{((i * 37) % 13) - 6}deg" />
    {/each}
  </span>
{:else}
  <!-- 100 squares of chocolate: the eaten ones show the wooden tray -->
  {@const cell = 10}
  <svg class="slab" viewBox="0 0 108 108" width={size} height={size} role="img" aria-label="{pic.filled} of 100 squares">
    <defs>
      <clipPath id="{uid}c">{#each Array(pic.filled) as _, i}<rect x={4 + (i % 10) * cell + 0.5} y={4 + Math.floor(i / 10) * cell + 0.5} width={cell - 1} height={cell - 1} rx="1.2" />{/each}</clipPath>
    </defs>
    <image href="{base}math/frac/tray.webp" x="0" y="0" width="108" height="108" preserveAspectRatio="none" />
    <image href="{base}math/frac/bar.webp" x="4" y="4" width="100" height="100" preserveAspectRatio="none" clip-path="url(#{uid}c)" />
    {#each Array(9) as _, i}
      <line x1={4 + (i + 1) * cell} y1="4" x2={4 + (i + 1) * cell} y2="104" stroke="#fff" stroke-width="0.6" opacity=".75" />
      <line x1="4" y1={4 + (i + 1) * cell} x2="104" y2={4 + (i + 1) * cell} stroke="#fff" stroke-width="0.6" opacity=".75" />
    {/each}
  </svg>
{/if}

<style>
  .coins { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px; max-width: calc(var(--cw) * 4.6); padding: 10px 14px; border-radius: 22px; background: radial-gradient(circle at 50% 40%, #fffaf0, #f4e7cf); box-shadow: inset 0 0 0 3px #ecd6ae, 0 6px 14px rgba(60, 40, 110, .12); }
  .coins img { height: auto; transform: rotate(var(--r)); filter: drop-shadow(0 4px 4px rgba(70, 45, 10, .28)); }
  .slab { display: block; filter: drop-shadow(0 6px 10px rgba(60, 40, 110, .18)); }
</style>
