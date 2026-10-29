<script lang="ts">
  // A friendly tip pointing at something on screen (the first battle, the first visit to the map). It sits
  // above or below its target with a bouncing arrow; "Got it" closes it, or the game moves it on.
  import { onDestroy, onMount } from 'svelte';
  type Props = { text: string; at: string | null; button?: string; onok?: () => void; place?: 'above' | 'below' | 'auto' };
  let { text, at, button, onok, place = 'auto' }: Props = $props();
  let box = $state<{ x: number; y: number; below: boolean } | null>(null);
  let raf = 0;
  function measure() {
    const el = at ? document.querySelector(at) : null;
    if (!el) { box = null; raf = requestAnimationFrame(measure); return; }
    const r = el.getBoundingClientRect();
    const below = place === 'below' || (place === 'auto' && r.top < innerHeight * 0.38);
    box = { x: Math.min(innerWidth - 170, Math.max(170, r.left + r.width / 2)), y: below ? r.bottom + 14 : r.top - 14, below };
    raf = requestAnimationFrame(measure);
  }
  onMount(measure);
  onDestroy(() => cancelAnimationFrame(raf));
</script>

{#if box || !at}
  <div class="coach" class:below={box?.below} class:free={!at} style:left={box ? `${box.x}px` : '50%'} style:top={box ? `${box.y}px` : '40%'}>
    <p>{text}</p>
    {#if button}<button class="btn btn-primary" onclick={onok}>{button}</button>{/if}
    {#if at}<span class="arrow"></span>{/if}
  </div>
{/if}

<style>
  .coach { position: fixed; z-index: 40; transform: translate(-50%, -100%); width: min(340px, 86vw); background: #fff; border-radius: 22px; padding: 14px 16px; box-shadow: 0 0 0 4px #ffd36b, 0 18px 40px -14px rgba(40, 20, 80, .6); display: flex; flex-direction: column; gap: 10px; align-items: flex-start; animation: in .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: auto; }
  .coach.below { transform: translate(-50%, 0); }
  .coach.free { transform: translate(-50%, -50%); }
  p { margin: 0; font: 600 18px/1.35 var(--font-ui); color: var(--ink); }
  .btn { align-self: flex-end; padding: 8px 18px; }
  .arrow { position: absolute; left: 50%; bottom: -18px; width: 0; height: 0; margin-left: -12px; border: 12px solid transparent; border-top-color: #ffd36b; animation: bob .8s ease-in-out infinite; }
  .below .arrow { bottom: auto; top: -18px; border-top-color: transparent; border-bottom-color: #ffd36b; }
  @keyframes bob { 50% { translate: 0 5px; } }
  @keyframes in { from { opacity: 0; scale: .8; } }
</style>
