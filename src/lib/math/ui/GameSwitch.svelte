<script lang="ts">
  // Home's game choice: Typing or Math. The choice is remembered for each player.
  import { game } from '../../state/game.svelte';
  import { sfx } from '../../audio/sound';

  const now = $derived(game.homeGame);
  function pick(g: 'typing' | 'math') {
    if (g === now) return;
    sfx.click();
    game.setHome(g);
  }
</script>

<div class="switch" role="tablist" aria-label="Which game">
  <button role="tab" aria-selected={now === 'typing'} class:on={now === 'typing'} onclick={() => pick('typing')}>
    <svg viewBox="0 0 32 24" aria-hidden="true"><rect x="2" y="3" width="28" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2.4" /><path d="M7 9h2M12 9h2M17 9h2M22 9h3M8 15h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
    <span>Typing</span>
  </button>
  <button role="tab" aria-selected={now === 'math'} class:on={now === 'math'} onclick={() => pick('math')}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
    <span>Math</span>
  </button>
</div>

<style>
  .switch { display: flex; gap: 4px; padding: 4px; background: var(--bg2); border-radius: 999px; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .12); flex: none; }
  button { display: flex; align-items: center; gap: 7px; border: 0; background: transparent; border-radius: 999px; padding: 7px 14px 7px 11px; font: 600 18px var(--font-ui); color: var(--muted); cursor: pointer; transition: background .15s, color .15s, transform .15s; }
  button:hover { color: var(--ink); }
  button.on { background: linear-gradient(var(--primary-hi), var(--primary)); color: #fff; box-shadow: 0 3px 0 var(--primary-edge); }
  svg { width: 22px; height: 22px; flex: none; }
  @media (max-width: 560px) { button { padding: 6px 10px 6px 8px; font-size: 15px; } svg { width: 18px; height: 18px; } }
</style>
