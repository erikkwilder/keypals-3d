<script lang="ts" module>
  /** a weight's worth as painted brass weights: tens, fives and ones, biggest first */
  export function weightsOf(v: number): number[] {
    const out: number[] = [];
    let left = Math.max(0, Math.round(v));
    for (const w of [10, 5, 1]) while (left >= w) { out.push(w); left -= w; }
    return out;
  }
</script>

<script lang="ts">
  // The Star Lab's golden balance, painted: a stand, a beam on its pivot and two pans hanging from its
  // ends. The left pan holds mystery boxes (a letter or a ? on each, or the number once it's found) and
  // weights; the right pan holds weights. It tips toward the heavier side (`tilt`, -1 to 1: positive is
  // the left side down) and swings back level, and the right side can be shared out into equal piles
  // (`groups`), one for each box. Taps on a weight or a box come back through `ontap`. Used by the balance
  // input, the pictures in questions, and the Balance Scale toy.
  import { scale } from 'svelte/transition';
  type Side = 'left' | 'right';
  type Props = {
    boxes: number; left: number; right: number;
    /** the letter on each box ('?' if none), or the number it's worth once found */
    letter?: string; reveal?: number | null;
    /** weights in a pan as given (the toy: what was put there); otherwise tens, fives and ones */
    leftW?: number[]; rightW?: number[];
    /** boxes on the right too (the toy's two-sided puzzles) */
    rightBoxes?: number;
    tilt?: number; groups?: number; w?: number;
    /** glow these: the boxes (the answer is them), or the weights you can take */
    glowBoxes?: boolean; glowWeights?: boolean;
    ontap?: (side: Side, kind: 'weight' | 'box', value: number, index: number) => void;
  };
  let { boxes, left, right, letter = '?', reveal = null, leftW, rightW, rightBoxes = 0, tilt = 0, groups = 0, w = 440, glowBoxes = false, glowWeights = false, ontap }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const art = (f: string) => `${base}math/algebra/${f}.webp`;

  // the picture's shape, in parts of its width
  // (the painted beam: its hooks are 86% of its width apart, a little below its pivot; the pan's ring is at
  // its top and its dish 80% of the way down)
  const H = 0.66, PIVOT_Y = 0.2, ARM = 0.34, BEAM_W = (ARM * 2) / 0.86, HOOK_DY = BEAM_W * 0.21 * 0.3, PAN_W = 0.33, PAN_H = PAN_W * (388 / 420), DISH = 0.8;
  const ang = $derived(-Math.max(-1, Math.min(1, tilt)) * 13);
  const rad = $derived((ang * Math.PI) / 180);
  /** where a pan's ring hangs: the end of the beam, turned with it */
  const hook = (s: Side) => {
    const px = (s === 'left' ? -1 : 1) * ARM * w, py = HOOK_DY * w;
    return { x: w / 2 + px * Math.cos(rad) - py * Math.sin(rad), y: PIVOT_Y * w + px * Math.sin(rad) + py * Math.cos(rad) - PAN_H * w * 0.03 };
  };
  const lw = $derived(leftW ?? weightsOf(left));
  const rw = $derived(rightW ?? weightsOf(right));
  /** the right side shared into piles, one per box */
  const piles = $derived.by(() => {
    if (groups < 2) return null;
    const each = Math.round(right / groups);
    return Array.from({ length: groups }, () => weightsOf(each));
  });
  const SIZE: Record<number, number> = { 10: 1, 5: 0.84, 2: 0.72, 1: 0.64 };
  const ws = $derived(w * 0.075);
  const bs = $derived(w * (boxes + rightBoxes > 4 ? 0.075 : 0.092));
</script>

{#snippet weight(v: number, side: Side, i: number)}
  <button class="wt" class:glow={glowWeights && side === 'left'} class:tap={!!ontap} tabindex="-1" transition:scale={{ duration: 260, start: 0.3 }}
    style:width="{ws * SIZE[v]}px" style:height="{ws * SIZE[v] * 1.05}px" onpointerdown={(e) => { if (ontap) { e.preventDefault(); ontap(side, 'weight', v, i); } }} aria-label="A weight of {v}">
    <img src={art('weight')} alt="" draggable="false" /><b style:font-size="{ws * SIZE[v] * 0.36}px">{v}</b>
  </button>
{/snippet}
{#snippet box(side: Side, i: number)}
  <button class="bx" class:glow={glowBoxes} class:tap={!!ontap} tabindex="-1" transition:scale={{ duration: 260, start: 0.3 }}
    style:width="{bs}px" style:height="{bs}px" onpointerdown={(e) => { if (ontap) { e.preventDefault(); ontap(side, 'box', 0, i); } }} aria-label="A mystery box">
    <img src={art('box')} alt="" draggable="false" />{#if reveal !== null || letter !== '?'}<b class:num={reveal !== null} style:font-size="{bs * (reveal !== null && String(reveal).length > 1 ? 0.34 : 0.42)}px">{reveal !== null ? reveal : letter}</b>{/if}
  </button>
{/snippet}

<div class="bv" style:width="{w}px" style:height="{w * H}px">
  <img class="stand" src={art('stand')} alt="" style:left="{w / 2}px" style:top="{PIVOT_Y * w - w * 0.03}px" style:height="{w * (H - PIVOT_Y) + w * 0.02}px" draggable="false" />
  <img class="beam" src={art('beam')} alt="" style:left="{w / 2}px" style:top="{PIVOT_Y * w}px" style:width="{BEAM_W * w}px" style:transform="translate(-50%, -50%) rotate({ang}deg)" draggable="false" />
  {#each ['left', 'right'] as const as s (s)}
    {@const h = hook(s)}
    <div class="pan" style:left="{h.x}px" style:top="{h.y}px" style:width="{PAN_W * w}px" style:height="{PAN_H * w}px">
      <img src={art('pan')} alt="" draggable="false" />
      <div class="load" style:bottom="{(1 - DISH) * PAN_H * w}px">
        {#if s === 'left'}
          {#each Array(boxes) as _, i (`b${i}`)}{@render box('left', i)}{/each}
          {#each lw as v, i (`w${i}-${v}`)}{@render weight(v, 'left', i)}{/each}
        {:else if piles}
          {#each piles as p, k (k)}<span class="pile" transition:scale={{ duration: 300, start: 0.5 }}>{#each p as v, i (`p${k}-${i}-${v}`)}{@render weight(v, 'right', i)}{/each}<em>{Math.round(right / groups)}</em></span>{/each}
        {:else}
          {#each Array(rightBoxes) as _, i (`rb${i}`)}{@render box('right', i)}{/each}
          {#each rw as v, i (`w${i}-${v}`)}{@render weight(v, 'right', i)}{/each}
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .bv { position: relative; flex: none; margin: 0 auto; }
  .stand { position: absolute; transform: translateX(-50%); filter: drop-shadow(0 6px 6px rgba(70, 40, 10, .25)); pointer-events: none; }
  .beam { position: absolute; transition: transform .7s cubic-bezier(.34, 1.45, .5, 1); filter: drop-shadow(0 4px 4px rgba(70, 40, 10, .25)); pointer-events: none; z-index: 2; }
  .pan { position: absolute; transform: translateX(-50%); transition: left .7s cubic-bezier(.34, 1.45, .5, 1), top .7s cubic-bezier(.34, 1.45, .5, 1); z-index: 1; }
  .pan > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: top; filter: drop-shadow(0 6px 6px rgba(70, 40, 10, .25)); pointer-events: none; }
  .load { position: absolute; left: -6%; right: -6%; display: flex; flex-wrap: wrap-reverse; justify-content: center; align-items: flex-end; gap: 1px 2px; z-index: 3; }
  .pile { display: inline-flex; align-items: flex-end; gap: 1px; padding: 0 3px 2px; margin: 0 2px; border-radius: 10px; background: rgba(255, 236, 170, .55); box-shadow: 0 0 0 2px rgba(230, 180, 60, .8); position: relative; }
  .pile em { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font: 600 15px var(--font-ui); font-style: normal; color: #fff; background: #6c4fd8; border-radius: 99px; padding: 0 7px; }
  .wt, .bx { position: relative; flex: none; border: 0; padding: 0; background: none; display: grid; place-items: center; }
  .wt img, .bx img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(60, 30, 5, .35)); pointer-events: none; }
  .wt b { position: absolute; left: 0; right: 0; top: 54%; text-align: center; line-height: 1; font-family: var(--font-ui); font-weight: 600; color: #5a3608; text-shadow: 0 1px 0 rgba(255, 240, 200, .8); pointer-events: none; }
  /* a letter or a found number covers the painted question mark, on a violet plate */
  .bx b { position: absolute; left: 22%; right: 22%; top: 26%; bottom: 18%; display: grid; place-items: center; border-radius: 22%; background: radial-gradient(circle at 50% 35%, #9b6cff, #5a2fc4); box-shadow: 0 0 0 2px #ffd36b, 0 0 10px rgba(255, 220, 120, .8); font-family: Georgia, serif; font-style: italic; font-weight: 700; color: #fff; text-shadow: 0 2px 0 #3d1f8a; pointer-events: none; }
  .bx b.num { font-family: var(--font-ui); font-style: normal; color: #ffe27a; }
  .tap { cursor: pointer; }
  .wt.glow img { filter: drop-shadow(0 0 6px #ffd84a) drop-shadow(0 0 3px #fff3b0); }
  .wt.glow { animation: bob 1.2s ease-in-out infinite; }
  .bx.glow img { filter: drop-shadow(0 0 8px #c9a6ff) drop-shadow(0 0 4px #fff); }
  @keyframes bob { 50% { transform: translateY(-3px); } }
</style>
