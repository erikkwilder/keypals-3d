<script lang="ts">
  // A painted fraction picture: a cherry pie cut into equal slices (the eaten ones show the plate), or a
  // chocolate bar cut into equal pieces sitting in a wooden tray (an empty place shows the tray's floor).
  // The paintings are cut by exact slice shapes, so the parts are truly equal. The tray is painted from a
  // little above, so the chocolate pieces are drawn the same way: each one a block standing on the tray's
  // floor (wider at the front, like the floor), with its front edge showing and the tray's front rim drawn
  // over it, so it sits down in the dish.
  import type { FracPic } from '../types';
  type Props = { pic: FracPic; size?: number };
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
  // the tray painting is 800 x 183; its floor (measured from the painting) runs from the back wall at
  // y 48 to the front rim at y 146, and is a little wider at the front
  const TW = 800, TH = 183;
  const BACK = { y: 50, l: 52, r: 740 }, FRONT = { y: 146, l: 42, r: 760 }, T = 15;
  const gap = 5;
  const at = (k: number, edge: typeof BACK) => edge.l + (edge.r - edge.l) * k;
  /** piece i's footprint on the floor (back-left, back-right, front-right, front-left) */
  function foot(i: number) {
    const k0 = i / pic.parts, k1 = (i + 1) / pic.parts, g0 = i === 0 ? 0 : gap / 2, g1 = i === pic.parts - 1 ? 0 : gap / 2;
    return { bl: at(k0, BACK) + g0, br: at(k1, BACK) - g1, fl: at(k0, FRONT) + g0, fr: at(k1, FRONT) - g1 };
  }
  const pts = (xs: [number, number][]) => xs.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const top = (i: number) => { const f = foot(i); return pts([[f.bl, BACK.y - T], [f.br, BACK.y - T], [f.fr, FRONT.y - T], [f.fl, FRONT.y - T]]); };
  const front = (i: number) => { const f = foot(i); return pts([[f.fl, FRONT.y - T], [f.fr, FRONT.y - T], [f.fr, FRONT.y + 4], [f.fl, FRONT.y + 4]]); };
  const floor = (i: number) => { const f = foot(i); return pts([[f.bl, BACK.y], [f.br, BACK.y], [f.fr, FRONT.y], [f.fl, FRONT.y]]); };
  const shadow = (i: number) => { const f = foot(i); return pts([[f.bl + 4, BACK.y + 3], [f.br + 8, BACK.y + 3], [f.fr + 10, FRONT.y], [f.fl + 4, FRONT.y]]); };
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
  <!-- a chocolate bar in a wooden tray: the tray, a soft shadow and the empty places' outlines on its floor,
       the pieces (a glossy top and a darker front edge), then the tray's front rim over them -->
  <svg class="fp" viewBox="0 0 {TW} {TH}" width={size * 1.6} height={size * 1.6 * TH / TW} role="img" aria-label="{pic.filled} of {pic.parts} pieces">
    <defs>
      <clipPath id="{uid}b">{#each Array(pic.filled) as _, i}<polygon points={top(i)} />{/each}</clipPath>
      <clipPath id="{uid}rim"><rect x="0" y={FRONT.y - 1} width={TW} height={TH - FRONT.y + 1} /></clipPath>
      <linearGradient id="{uid}fe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b3a1c" /><stop offset="1" stop-color="#3f200d" /></linearGradient>
    </defs>
    <image href={art('tray')} x="0" y="0" width={TW} height={TH} preserveAspectRatio="none" />
    {#each Array(pic.parts) as _, i}
      {#if i < pic.filled}<polygon points={shadow(i)} fill="rgba(60, 30, 10, .28)" />
      {:else}<polygon points={floor(i)} fill="rgba(255, 255, 255, .08)" stroke="rgba(110, 60, 20, .45)" stroke-width="3" stroke-dasharray="10 8" stroke-linejoin="round" />{/if}
    {/each}
    {#each Array(pic.filled) as _, i}<polygon points={front(i)} fill="url(#{uid}fe)" />{/each}
    <image href={art('bar')} x={FRONT.l} y={BACK.y - T - 4} width={FRONT.r - FRONT.l} height={FRONT.y - BACK.y + 8} preserveAspectRatio="none" clip-path="url(#{uid}b)" />
    {#each Array(pic.filled) as _, i}<polygon points={top(i)} fill="none" stroke="rgba(255, 220, 190, .45)" stroke-width="2.5" stroke-linejoin="round" />{/each}
    <image href={art('tray')} x="0" y="0" width={TW} height={TH} preserveAspectRatio="none" clip-path="url(#{uid}rim)" />
  </svg>
{/if}

<style>
  .fp { display: block; filter: drop-shadow(0 6px 10px rgba(60, 40, 110, .18)); }
  .set { display: grid; grid-template-columns: repeat(var(--cols), var(--cs)); gap: 4px 8px; padding: 8px 12px; border-radius: 22px; background: radial-gradient(circle at 50% 40%, #fff8ee, #f6ead8); box-shadow: inset 0 0 0 3px #f0dcc0, 0 6px 14px rgba(60, 40, 110, .12); }
  .set img { width: var(--cs); height: var(--cs); object-fit: contain; filter: grayscale(1) brightness(1.08) opacity(.5); transition: filter .3s, transform .3s; }
  .set img.on { filter: drop-shadow(0 0 8px rgba(255, 140, 190, .75)) drop-shadow(0 4px 4px rgba(80, 30, 60, .2)); transform: translateY(-3px) scale(1.04); }
</style>
