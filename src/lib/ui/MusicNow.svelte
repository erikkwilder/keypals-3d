<script lang="ts">
  // The music, wherever it's offered (the Pause card, the music button on the top bar, the Menu): the
  // station's picture, what's playing now, Next song, and Pick music (the station picker,
  // ui/MusicPicker.svelte). `onpick` runs first (a card that closes before the picker opens over it).
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { musicNow, onMusic, resumeMusic, sfx, skipTrack, unlockAudio, type NowPlaying } from '../audio/sound';
  import { STATION } from '../audio/stations';

  type Props = { onpick?: () => void; compact?: boolean };
  let { onpick, compact = false }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let now = $state<NowPlaying>(musicNow());
  let unsub = () => {};
  onMount(() => { unsub = onMusic(n => (now = n)); });
  onDestroy(() => unsub());
  const musicOff = $derived(game.settings.music === false || game.settings.sound === false);
  function next() { unlockAudio(); sfx.click(); if (game.settings.music === false) game.update(pp => { pp.settings.music = true; }); resumeMusic(); skipTrack(); }
  function pick() { sfx.click(); onpick?.(); game.openMusic(); }
</script>

<div class="music" class:off={musicOff} class:compact>
  <img class="st" src="{base}icons/music/{now.station}.webp" alt="" />
  <div class="nt">
    {#if musicOff}<b>{game.quiet ? 'Your teacher turned this off' : 'Music is off'}</b>
    {:else}<small>Now playing · {STATION[now.station]?.name ?? ''}</small><b>{now.title ?? '...'}</b>{/if}
  </div>
  <div class="mb">
    <button class="btn" disabled={game.quiet} onclick={next}><img src="{base}icons/play.webp" alt="" />Next song</button>
    <button class="btn" disabled={game.quiet} onclick={pick}><img src="{base}icons/music.webp" alt="" />Pick music</button>
  </div>
</div>

<style>
  .music { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 20px; background: linear-gradient(135deg, #fff4fb, #f1f6ff); border: 3px solid #f3dcf0; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; }
  .st { width: 48px; height: 48px; object-fit: contain; }
  .off .st { filter: grayscale(.9) opacity(.55); }
  .nt { min-width: 0; display: flex; flex-direction: column; text-align: left; }
  .nt small { font: 700 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .nt b { font: 600 18px/1.15 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb { grid-column: 1 / -1; display: flex; gap: 8px; }
  .btn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; padding: 8px 10px; white-space: nowrap; }
  .btn img { width: 26px; height: 26px; object-fit: contain; }
  .compact { padding: 8px 10px; }
  .compact .st { width: 40px; height: 40px; }
  .compact .btn { font-size: 16px; padding: 6px 8px; }
</style>
