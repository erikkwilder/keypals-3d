<script lang="ts">
  // A painted fraction picture: a cherry pie cut into equal slices (the eaten ones show the plate), or a
  // chocolate bar cut into equal pieces (the empty ones show the wooden tray). The paintings are cut by
  // exact slice shapes, so the parts are truly equal.
  import type { Pic } from '../types';
  type Props = { pic: Pic; size?: number };
  let { pic, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const uid = `fp${Math.random().toString(36).slice(2, 8)}`;
  const art = (n: string) => `${base}math/frac/${n}.webp`;
  // pie slices: start at the top, clockwise
  function slice(i: number, n: number, r = 48) {
    if (n === 1) return `M50,50 m-${r},0 a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`;
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const p = (a: number) => `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`;
    return `M50,50 L${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${p(a1)} Z`;
  }
  const W = 200, H = 60;
  const segW = $derived((W - 8) / pic.parts);
</script>

{#if pic.kind === 'pie'}
  <svg class="fp" viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="{pic.filled} of {pic.parts} slices">
    <defs>
      <clipPath id="{uid}f">{#each Array(pic.parts) as _, i}{#if i < pic.filled}<path d={slice(i, pic.parts)} />{/if}{/each}</clipPath>
    </defs>
    <image href={art('plate')} x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" />
    <image href={art('pie')} x="1" y="1" width="98" height="98" preserveAspectRatio="xMidYMid slice" clip-path="url(#{uid}f)" />
    {#each Array(pic.parts) as _, i}<path d={slice(i, pic.parts)} fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" opacity=".95" />{/each}
  </svg>
{:else if pic.kind === 'set'}
  <!-- a set: painted cupcakes in rows, the counted ones pink and glowing, the rest grey -->
  {@const cols = pic.parts <= 4 ? pic.parts : Math.ceil(pic.parts / 2)}
  <span class="set" role="img" aria-label="{pic.filled} of {pic.parts} cupcakes are pink" style:--cols={cols} style:--cs="{Math.round(size * (pic.parts <= 4 ? 0.62 : 0.5))}px">
    {#each Array(pic.parts) as _, i}<img class:on={i < pic.filled} src={art('cupcake')} alt="" draggable="false" />{/each}
  </span>
{:else}
  <svg class="fp" viewBox="0 0 {W} {H}" width={size * 1.6} height={size * 1.6 * H / W} role="img" aria-label="{pic.filled} of {pic.parts} pieces">
    <defs>
      <clipPath id="{uid}b">{#each Array(pic.filled) as _, i}<rect x={4 + i * segW + 1} y="6" width={segW - 2} height={H - 12} rx="3" />{/each}</clipPath>
    </defs>
    <image href={art('tray')} x="0" y="0" width={W} height={H} preserveAspectRatio="none" />
    <image href={art('bar')} x="4" y="5" width={W - 8} height={H - 10} preserveAspectRatio="none" clip-path="url(#{uid}b)" />
    {#each Array(pic.parts - 1) as _, i}<line x1={4 + (i + 1) * segW} y1="7" x2={4 + (i + 1) * segW} y2={H - 7} stroke="#fff" stroke-width="1.6" opacity=".9" />{/each}
  </svg>
{/if}

<style>
  .fp { display: block; filter: drop-shadow(0 6px 10px rgba(60, 40, 110, .18)); }
  .set { display: grid; grid-template-columns: repeat(var(--cols), var(--cs)); gap: 4px 8px; padding: 8px 12px; border-radius: 22px; background: radial-gradient(circle at 50% 40%, #fff8ee, #f6ead8); box-shadow: inset 0 0 0 3px #f0dcc0, 0 6px 14px rgba(60, 40, 110, .12); }
  .set img { width: var(--cs); height: var(--cs); object-fit: contain; filter: grayscale(1) brightness(1.08) opacity(.5); transition: filter .3s, transform .3s; }
  .set img.on { filter: drop-shadow(0 0 8px rgba(255, 140, 190, .75)) drop-shadow(0 4px 4px rgba(80, 30, 60, .2)); transform: translateY(-3px) scale(1.04); }
</style>
