<script lang="ts">
  import { GAME_NAME } from '../config';
  import { FINGER_COLOR } from '../art/cast';
  import { LAYOUTS, fingerFor } from '../engine/layouts';
  import { game } from '../state/game.svelte';

  type Props = { size?: number; animate?: boolean };
  let { size = 64, animate = true }: Props = $props();
  const words = GAME_NAME.split(' ');
  const look = $derived(game.settings.look);
  function color(ch: string) {
    const f = fingerFor(LAYOUTS.qwerty, ch.toLowerCase());
    void look;
    return FINGER_COLOR[f ?? 'TH'];
  }
</script>

<h1 class="logo" style:--sz="{size}px" aria-label={GAME_NAME}>
  {#each words as w, wi}
    <span class="word">
      {#each [...w] as ch, ci}
        <span class="cap" class:animate style:--c={color(ch)} style:animation-delay="{(wi * 6 + ci) * 0.09}s" aria-hidden="true">{ch}</span>
      {/each}
    </span>
  {/each}
</h1>

<style>
  .logo { display: flex; flex-wrap: wrap; justify-content: center; gap: calc(var(--sz) * .35); margin: 0; font: 700 var(--sz)/1 'Fredoka', var(--font-ui); }
  :global([data-look='ink']) .logo { font-family: 'Bagel Fat One', 'Fredoka'; font-weight: 400; }
  :global([data-look='paper']) .logo { font-family: 'Fraunces', serif; }
  :global([data-look='geo']) .logo { font-family: 'Lexend', sans-serif; }
  .word { display: flex; gap: calc(var(--sz) * .08); }
  .cap {
    display: grid; place-items: center;
    width: calc(var(--sz) * 1.06); height: calc(var(--sz) * 1.12);
    border-radius: calc(var(--sz) * .26);
    background: var(--c);
    background: linear-gradient(#fff, color-mix(in srgb, var(--c) 70%, #fff));
    color: var(--ink);
    box-shadow: 0 calc(var(--sz) * .1) 0 #b9a8e0, 0 calc(var(--sz) * .2) calc(var(--sz) * .3) calc(var(--sz) * -.12) rgba(50, 30, 90, .45);
    box-shadow: 0 calc(var(--sz) * .1) 0 color-mix(in srgb, var(--c) 70%, #6b5a9a), 0 calc(var(--sz) * .2) calc(var(--sz) * .3) calc(var(--sz) * -.12) rgba(50, 30, 90, .45);
    text-transform: capitalize;
  }
  :global([data-look='ink']) .cap { border: 4px solid #2a1b3d; box-shadow: 4px 6px 0 #2a1b3d; background: var(--c); }
  :global([data-look='paper']) .cap { border-radius: 8px; background: var(--c); box-shadow: 0 4px 6px rgba(70, 55, 35, .3); }
  :global([data-look='geo']) .cap { background: var(--c); box-shadow: none; }
  .cap.animate { animation: press 3.2s ease-in-out infinite; }
  @keyframes press {
    0%, 70%, 100% { transform: translateY(0); }
    76% { transform: translateY(calc(var(--sz) * .08)); box-shadow: 0 calc(var(--sz) * .02) 0 color-mix(in srgb, var(--c) 70%, #6b5a9a); }
    84% { transform: translateY(calc(var(--sz) * -.06)); }
  }
</style>
