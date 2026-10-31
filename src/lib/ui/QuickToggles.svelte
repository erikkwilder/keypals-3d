<script lang="ts">
  // Music on or off, sounds on or off: the quick row at the top of the Menu and on the Pause card (the rest
  // is in Settings). Greyed when a class turned sound off (the music card above them says so).
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  const base = import.meta.env.BASE_URL;
  const s = $derived(game.settings);
  function flip(k: 'music' | 'sound') { game.update(p => { p.settings[k] = !p.settings[k]; }); sfx.click(); }
</script>

<div class="qt" role="group" aria-label="Music and sounds">
  <button class:off={!s.music} disabled={game.quiet} aria-pressed={s.music} onclick={() => flip('music')}><img src="{base}icons/music.webp" alt="" /><span>Music {s.music ? 'on' : 'off'}</span></button>
  <button class:off={!s.sound} disabled={game.quiet} aria-pressed={s.sound} onclick={() => flip('sound')}><img src="{base}icons/sfx.webp" alt="" /><span>Sounds {s.sound ? 'on' : 'off'}</span></button>
</div>

<style>
  .qt { display: flex; gap: 8px; flex-wrap: wrap; }
  button { display: inline-flex; align-items: center; gap: 6px; border: 2px solid #d8eede; cursor: pointer; padding: 4px 14px 4px 6px; border-radius: 999px; background: #f0fbf4; font: 600 16px var(--font-ui); color: var(--ink); }
  button img { width: 30px; height: 30px; object-fit: contain; }
  button.off { border-color: #e6e1ee; background: #f6f4f9; color: var(--muted); }
  button.off img { filter: grayscale(1); opacity: .6; }
  button:disabled { cursor: default; }
</style>
