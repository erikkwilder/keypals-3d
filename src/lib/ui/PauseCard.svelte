<script lang="ts">
  // The one Pause card, for every activity (ui/PauseButton.svelte opens it): Keep going, Back to where
  // the activity was started from ("Back to Fractions", "Back to the Arcade"), and Home. Esc keeps going.
  // Under them, the music: what's playing, the next song, the station picker (ui/MusicPicker.svelte, over
  // this card), and music and sounds on or off.
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { game } from '../state/game.svelte';
  import { musicNow, onMusic, resumeMusic, sfx, skipTrack, unlockAudio, type NowPlaying } from '../audio/sound';
  import { STATION } from '../audio/stations';
  import { placeName } from '../nav';
  import QuickToggles from './QuickToggles.svelte';

  const base = import.meta.env.BASE_URL;
  const from = $derived(game.from);
  const over = $derived(game.pause?.back);
  const backName = $derived(over ? over.name : from ? placeName(from) : 'Home');
  const toHome = $derived(!over && (!from || from.screen === 'hub'));
  function keep() { sfx.click(); game.closePause(true); }
  function leave() { sfx.click(); const o = over; game.closePause(false); if (o) o.go(); else game.leaveActivity(); }
  function home() { sfx.click(); game.closePause(false); game.go('hub'); }
  // (the music picker, open over this card, has the keyboard to itself)
  function onKey(e: KeyboardEvent) { if (game.musicOpen) return; if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); keep(); } }
  let now = $state<NowPlaying>(musicNow());
  let unsub = () => {};
  onMount(() => { sfx.pop(); window.addEventListener('keydown', onKey, true); unsub = onMusic(n => (now = n)); });
  onDestroy(() => { window.removeEventListener('keydown', onKey, true); unsub(); });
  const musicOff = $derived(game.settings.music === false || game.settings.sound === false);
  function next() { unlockAudio(); sfx.click(); if (game.settings.music === false) game.update(pp => { pp.settings.music = true; }); resumeMusic(); skipTrack(); }
  function pick() { sfx.click(); game.openMusic(); }
</script>

<div class="pc" transition:fade={{ duration: 140 }}>
  <div class="card" role="dialog" aria-modal="true" aria-label="Paused">
    <img class="pi" src="{base}icons/pause.webp" alt="" />
    <h2>Paused</h2>
    <button class="btn btn-primary big" onclick={keep}><img src="{base}icons/play.webp" alt="" />Keep going</button>
    <div class="row">
      {#if !toHome}<button class="btn" onclick={leave}><img src="{base}icons/back.webp" alt="" />Back to {backName}</button>{/if}
      <button class="btn" onclick={home}><img src="{base}game/icon-home.webp" alt="" />Home</button>
    </div>
    <div class="music" class:off={musicOff}>
      <img class="st" src="{base}icons/music/{now.station}.webp" alt="" />
      <div class="nt">
        {#if musicOff}<b>Music is off</b>
        {:else}<small>Now playing · {STATION[now.station]?.name ?? ''}</small><b>{now.title ?? '...'}</b>{/if}
      </div>
      <div class="mb">
        <button class="btn" onclick={next}><img src="{base}icons/play.webp" alt="" />Next song</button>
        <button class="btn" onclick={pick}><img src="{base}icons/music.webp" alt="" />Pick music</button>
      </div>
    </div>
    <div class="qt"><QuickToggles /></div>
  </div>
</div>

<style>
  .pc { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 16px; background: rgba(36, 24, 70, .45); backdrop-filter: blur(5px); }
  .card { width: min(440px, 100%); display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 22px 22px 18px; border-radius: 28px; background: #fff; box-shadow: 0 30px 70px -30px rgba(30, 10, 70, .7); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.3); }
  .pi { width: 56px; height: 56px; object-fit: contain; }
  h2 { margin: 0; font-size: 30px; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
  .btn img { width: 30px; height: 30px; object-fit: contain; }
  .big { width: 100%; font-size: 24px; padding: 14px 18px; }
  .row { width: 100%; display: flex; flex-direction: column; gap: 8px; }
  .row .btn { width: 100%; white-space: normal; text-align: center; }
  .music { width: 100%; box-sizing: border-box; margin-top: 4px; padding: 10px 12px; border-radius: 20px; background: linear-gradient(135deg, #fff4fb, #f1f6ff); border: 3px solid #f3dcf0; display: grid; grid-template-columns: auto 1fr; gap: 6px 10px; align-items: center; }
  .music .st { width: 48px; height: 48px; object-fit: contain; }
  .music.off .st { filter: grayscale(.9) opacity(.55); }
  .nt { min-width: 0; display: flex; flex-direction: column; text-align: left; }
  .nt small { font: 700 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .nt b { font: 600 18px/1.15 var(--font-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mb { grid-column: 1 / -1; display: flex; gap: 8px; }
  .mb .btn { flex: 1; font-size: 17px; padding: 8px 10px; white-space: nowrap; }
  .mb .btn img { width: 26px; height: 26px; }
  .qt { padding-top: 10px; border-top: 2px dashed #ece6f6; width: 100%; display: flex; justify-content: center; }
  @media (max-width: 420px) { .row { flex-direction: column; } }
</style>
