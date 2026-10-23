<script lang="ts">
  // A two-second hello from the FancyAnt ant when the game opens. Any key or click skips it.
  import { onDestroy, onMount } from 'svelte';
  type Props = { onDone: () => void };
  let { onDone }: Props = $props();
  let leaving = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function finish() {
    if (leaving) return;
    leaving = true;
    clearTimeout(timer);
    setTimeout(onDone, 380);
  }
  function onKey(e: KeyboardEvent) { e.stopImmediatePropagation(); e.preventDefault(); finish(); }
  onMount(() => {
    timer = setTimeout(finish, 2300);
    window.addEventListener('keydown', onKey, true);
  });
  onDestroy(() => { clearTimeout(timer); window.removeEventListener('keydown', onKey, true); });
</script>

<div class="intro" class:leaving role="presentation" onclick={finish}>
  <div class="stage">
    <div class="glow"></div>
    <img class="ant" src="brand/ant.png" alt="The FancyAnt ant" width="180" height="273" />
    <div class="shadow"></div>
  </div>
  <div class="name">FancyAnt Games</div>
  <div class="presents">presents</div>
</div>

<style>
  .intro { position: fixed; inset: 0; z-index: 200; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
    background: radial-gradient(circle at 50% 42%, #ffffff 0%, #f3edff 45%, #e6dcfb 100%); transition: opacity .38s ease; }
  .intro.leaving { opacity: 0; }
  .stage { position: relative; width: 220px; height: 300px; display: grid; place-items: end center; }
  .glow { position: absolute; left: 50%; top: 46%; width: 300px; height: 300px; margin: -150px 0 0 -150px; border-radius: 50%; background: radial-gradient(circle, rgba(164, 139, 255, .35), transparent 65%); animation: glow 2.3s ease-out both; }
  /* drops in, squashes on landing, then gives a little wave of a wiggle */
  .ant { position: relative; width: 180px; height: auto; transform-origin: 50% 100%; animation: drop .9s cubic-bezier(.3, .9, .4, 1) both, wiggle 1s .95s ease-in-out both; }
  .shadow { position: absolute; bottom: -6px; left: 50%; width: 120px; height: 18px; margin-left: -60px; border-radius: 50%; background: rgba(60, 40, 110, .18); animation: shadow .9s cubic-bezier(.3, .9, .4, 1) both; }
  .name { font: 600 34px/1 var(--font-ui); color: var(--ink); margin-top: 18px; animation: rise .5s .7s cubic-bezier(.3, .8, .4, 1.4) both; }
  .presents { font: 700 14px var(--font-body); letter-spacing: .2em; text-transform: uppercase; color: var(--muted); animation: rise .5s .9s ease both; }
  @keyframes drop { 0% { transform: translateY(-120vh) scaleY(1.1); } 62% { transform: translateY(0) scaleY(1.05); } 74% { transform: translateY(0) scale(1.12, .86); } 86% { transform: translateY(-14px) scale(.97, 1.04); } 100% { transform: none; } }
  @keyframes wiggle { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 55% { transform: rotate(5deg); } 80% { transform: rotate(-2deg); } }
  @keyframes shadow { 0% { transform: scale(.2); opacity: 0; } 62%, 100% { transform: none; opacity: 1; } }
  @keyframes glow { 0% { transform: scale(.4); opacity: 0; } 60% { opacity: 1; } 100% { transform: scale(1.1); opacity: .9; } }
  @keyframes rise { from { transform: translateY(14px); opacity: 0; } }
  :global(:root[data-motion='reduced']) .ant, :global(:root[data-motion='reduced']) .shadow, :global(:root[data-motion='reduced']) .glow { animation: none; }
</style>
