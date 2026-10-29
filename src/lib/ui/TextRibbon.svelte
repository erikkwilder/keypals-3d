<script lang="ts">
  import type { Look } from '../art/cast';
  import { FINGER_COLOR } from '../art/cast';
  import type { Layout } from '../engine/layouts';
  import { fingerFor } from '../engine/layouts';

  /** `gold`: a golden letter (a little surprise), or -1 */
  type Props = { text: string; pos: number; missed: Set<number>; look: Look; layout: Layout; shake: number; showFriend?: boolean; gold?: number };
  let { text, pos, missed, look, layout, shake, showFriend = true, gold = -1 }: Props = $props();

  const WINDOW_BACK = 28, WINDOW_FWD = 70;
  const start = $derived(Math.max(0, pos - WINDOW_BACK));
  const chars = $derived([...text.slice(start, pos + WINDOW_FWD)]);
  const cur = $derived(text[pos] ?? '');
  const finger = $derived(cur ? fingerFor(layout, cur) : null);
  const color = $derived(FINGER_COLOR[finger ?? 'TH']);

  let track: HTMLDivElement | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let shift = $state(0);
  let curLeft = $state(0);

  $effect(() => {
    void pos; void chars;
    if (!track || !box) return;
    const el = track.children[pos - start] as HTMLElement | undefined;
    const anchor = box.clientWidth * 0.32;
    if (el) {
      shift = anchor - (el.offsetLeft + el.offsetWidth / 2);
      curLeft = anchor;
    }
  });

  let shaking = $state(false);
  $effect(() => {
    if (!shake) return;
    shaking = false;
    requestAnimationFrame(() => (shaking = true));
    const t = setTimeout(() => (shaking = false), 380);
    return () => clearTimeout(t);
  });
</script>

<div class="outer" class:shaking>
<div class="ribbon" bind:this={box}>
  <div class="track" bind:this={track} style:transform="translateX({shift}px)">
    {#each chars as ch, i (start + i)}
      {@const idx = start + i}
      <span class="ch" class:done={idx < pos} class:cur={idx === pos} class:miss={missed.has(idx) && idx < pos} class:sp={ch === ' '} class:gold={idx === gold && !missed.has(idx)}
        style:--fc={idx === pos ? color : undefined}>{ch === ' ' ? ' ' : ch}</span>
    {/each}
  </div>
  <div class="fade left"></div>
  <div class="fade right"></div>
</div>
</div>

<style>
  .outer { position: relative; height: 100%; }
  .ribbon {
    position: relative; overflow: hidden; height: 100%;
    background: rgba(255, 255, 255, .92);
    border-radius: 26px;
    box-shadow: 0 18px 40px -20px rgba(50, 30, 90, .45), inset 0 -4px 0 rgba(120, 90, 200, .08);
    border: var(--panel-border);
  }
  :global([data-look='ink']) .ribbon { box-shadow: 5px 6px 0 #2a1b3d; }
  :global([data-look='paper']) .ribbon { border-radius: 10px; }
  .track {
    position: absolute; left: 0; top: 50%; margin-top: calc(-.38em - 5px);
    white-space: pre; display: flex; align-items: baseline;
    font: 600 clamp(58px, 11vh, 112px)/1 var(--font-type);
    color: var(--ink);
    transition: transform .14s cubic-bezier(.3, .7, .3, 1);
  }
  :global([data-look='ink']) .track { font-family: 'Bagel Fat One', var(--font-type); font-weight: 400; }
  .ch { display: inline-block; padding: 6px 1px; min-width: .32em; text-align: center; border-radius: 12px; transition: color .15s, opacity .15s; }
  .ch.sp { min-width: .42em; }
  .ch.done { opacity: .28; }
  /* a golden letter: gold and shimmering until it's typed */
  .ch.gold:not(.done) { color: #e0a100; text-shadow: 0 0 14px rgba(255, 210, 60, .9), 0 2px 0 #b07800; animation: goldglow 1.2s ease-in-out infinite; }
  @keyframes goldglow { 50% { text-shadow: 0 0 24px rgba(255, 220, 90, 1), 0 2px 0 #b07800; transform: translateY(-3px); } }
  .ch.miss { color: #e05a8f; opacity: .55; }
  .ch.cur {
    background: var(--fc); color: var(--ink);
    padding: 6px 7px; margin: 0 2px;
    box-shadow: 0 8px 18px -8px var(--fc), inset 0 -4px 0 rgba(0, 0, 0, .08);
    animation: cur-bob 1.2s ease-in-out infinite;
  }
  .ch.cur.sp { min-width: 1.1em; background: repeating-linear-gradient(90deg, var(--fc) 0 6px, transparent 6px 9px); background-size: 100% 6px; background-repeat: no-repeat; background-position: bottom 6px center; box-shadow: none; }
  :global([data-look='ink']) .ch.cur { border: 3px solid #2a1b3d; box-shadow: 3px 3px 0 #2a1b3d; }
  @keyframes cur-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .buddy { position: absolute; top: 2px; transform: translate(-50%, -70%); pointer-events: none; animation: appear .2s ease; z-index: 2; }
  .fade { position: absolute; top: 0; bottom: 0; width: 70px; pointer-events: none; }
  .fade.left { left: 0; background: linear-gradient(90deg, rgba(255, 255, 255, .95), rgba(255, 255, 255, 0)); }
  .fade.right { right: 0; background: linear-gradient(270deg, rgba(255, 255, 255, .95), rgba(255, 255, 255, 0)); }
  .shaking { animation: rib-shake .36s ease; }
  @keyframes rib-shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
</style>
