<script lang="ts">
  // The one Pause button every activity has (a trip, a lesson, a Learn episode, a game, a battle): round,
  // top left, in the same spot everywhere. It stops the activity's clock (onpause) and opens the one Pause
  // card (ui/PauseCard.svelte): Keep going (onresume), Back to where the activity was started from, Home.
  // Esc does the same as tapping it.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';

  type Props = { onpause?: () => void; onresume?: () => void; esc?: boolean; light?: boolean };
  let { onpause, onresume, esc = true, light = false }: Props = $props();
  function pause() {
    if (game.pause) return;
    sfx.click();
    onpause?.();
    game.openPause(() => onresume?.());
  }
  function onKey(e: KeyboardEvent) {
    if (!esc || e.key !== 'Escape' || game.modalOpen) return;
    e.preventDefault();
    pause();
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="pausebtn" class:light onclick={(e) => { (e.currentTarget as HTMLElement).blur(); pause(); }} aria-label="Pause" title="Pause" data-pause>
  <img src="{import.meta.env.BASE_URL}icons/pause.webp" alt="" draggable="false" />
</button>

<style>
  .pausebtn { position: fixed; top: 12px; left: 12px; z-index: 45; width: 54px; height: 54px; display: grid; place-items: center; padding: 0; border-radius: 50%; border: 2px solid #e6def5; background: rgba(255, 255, 255, .95); cursor: pointer; box-shadow: 0 4px 0 #e6def5, 0 8px 18px -10px rgba(40, 20, 80, .5); transition: transform .14s; }
  .pausebtn img { width: 36px; height: 36px; object-fit: contain; user-select: none; }
  .pausebtn:hover { transform: translateY(-2px); }
  .pausebtn:active { transform: translateY(2px); box-shadow: 0 1px 0 #e6def5; }
  @media (max-width: 600px) { .pausebtn { top: 8px; left: 8px; width: 46px; height: 46px; } .pausebtn img { width: 30px; height: 30px; } }
</style>
