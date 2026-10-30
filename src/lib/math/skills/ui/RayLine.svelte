<script lang="ts">
  // A number line for inequalities on the painted plank: a tick at every whole number, a dot (filled: the
  // number counts; open: it doesn't) and a glowing ray shaded from it one way, with an arrow at the end.
  // The ray input (RayInput) and the pictures in questions (AlgPic) both draw it. `ontap` gets the tick
  // nearest a touch (for putting the dot); `ondot` is a tap on the dot itself.
  type Props = { min: number; max: number; at: number | null; closed: boolean; dir: 'left' | 'right' | null; compact?: boolean; small?: boolean; ontap?: (n: number) => void; ondot?: () => void; el?: HTMLDivElement };
  let { min, max, at, closed, dir, compact = false, small = false, ontap, ondot, el = $bindable() }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const n = $derived(max - min);
  const pos = (v: number) => (v - min) / n;
  /** every number labelled on a short line; every second one (and the ends) on a long one */
  const labelled = (v: number) => n <= 12 || v % 2 === 0 || v === min || v === max;
  const fmt = (v: number) => (v < 0 ? `−${-v}` : String(v));
  let dragging = false;
  function nearest(clientX: number) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (clientX - r.left - 26) / (r.width - 52)));
    return Math.max(min + 1, Math.min(max - 1, Math.round(min + k * n)));
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="rl" class:compact class:small class:live={!!ontap} bind:this={el} style:background-image="url({base}learn/plank.webp)"
  onpointerdown={(e) => { if (!ontap) return; if ((e.target as HTMLElement).closest('.dot')) return; dragging = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const v = nearest(e.clientX); if (v !== null) ontap(v); }}
  onpointermove={(e) => { if (!dragging || !ontap) return; const v = nearest(e.clientX); if (v !== null && v !== at) ontap(v); }}
  onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
  {#if at !== null && dir}
    {@const a = pos(at)}
    <span class="shade {dir}" style:left={dir === 'right' ? `calc(26px + (100% - 52px) * ${a})` : '8px'} style:right={dir === 'left' ? `calc(26px + (100% - 52px) * ${1 - a})` : '8px'}></span>
  {/if}
  {#each Array(n + 1) as _, i (i)}
    {@const v = min + i}
    <span class="tick" class:big={v === 0 || i === 0 || i === n} style:left="calc(26px + (100% - 52px) * {pos(v)})">{#if labelled(v)}<b class:zero={v === 0}>{fmt(v)}</b>{/if}</span>
  {/each}
  {#if at !== null}
    <button class="dot" class:closed tabindex="-1" style:left="calc(26px + (100% - 52px) * {pos(at)})" onpointerdown={(e) => { if (ondot) { e.preventDefault(); e.stopPropagation(); ondot(); } }} aria-label={closed ? 'A filled dot' : 'An open dot'}></button>
  {/if}
</div>

<style>
  .rl { position: relative; width: 100%; height: 96px; border-radius: 18px; background-size: 100% 100%; box-shadow: 0 6px 0 #c9a77a; touch-action: none; user-select: none; }
  .rl.live { cursor: pointer; }
  .tick { position: absolute; top: 20px; width: 4px; height: 24px; margin-left: -2px; border-radius: 2px; background: #5b3416; }
  .tick.big { height: 34px; top: 15px; }
  .tick b { position: absolute; top: 38px; left: 50%; transform: translateX(-50%); font: 600 18px var(--font-ui); color: #5b3416; white-space: nowrap; }
  .tick b.zero { color: #3b2410; }
  .shade { position: absolute; top: 25px; height: 14px; border-radius: 8px; background: linear-gradient(#c3a8ff, #7b55f0); box-shadow: 0 0 14px rgba(150, 110, 255, .85), inset 0 2px 0 rgba(255, 255, 255, .5); }
  .shade::after { content: ''; position: absolute; top: 50%; width: 0; height: 0; border-top: 16px solid transparent; border-bottom: 16px solid transparent; transform: translateY(-50%); }
  .shade.right::after { right: -14px; border-left: 22px solid #7b55f0; }
  .shade.left::after { left: -14px; border-right: 22px solid #7b55f0; }
  .dot { position: absolute; top: 17px; width: 30px; height: 30px; margin-left: -15px; border-radius: 50%; border: 6px solid #6c4fd8; background: #fff; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(60, 30, 140, .35); padding: 0; cursor: pointer; z-index: 2; animation: pop .25s cubic-bezier(.3, 1.6, .5, 1); }
  .dot.closed { background: #6c4fd8; }
  @keyframes pop { from { transform: scale(.4); } }
  .small { height: 74px; }
  .small .tick { top: 14px; height: 18px; } .small .tick.big { top: 10px; height: 26px; }
  .small .tick b { top: 30px; font-size: 15px; }
  .small .shade { top: 17px; height: 11px; }
  .small .dot { top: 11px; width: 24px; height: 24px; margin-left: -12px; border-width: 5px; }
  .compact .tick b { font-size: 15px; }
</style>
