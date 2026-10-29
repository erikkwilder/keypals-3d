<script lang="ts">
  // Pick your music: a station for every mood (calm, happy, adventure, rock, electronic, retro...), or
  // Auto, which changes with what you're doing. Tapping one switches the music straight away, with a
  // crossfade, wherever you are (in a lesson, a trip or a battle too), and it's remembered for this
  // player. "Keypals Originals" is the music the game makes itself, in a style you pick.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { MUSIC_STYLES, musicNow, onMusic, setMusicStation, setMusicStyle, sfx, skipTrack, unlockAudio, type MusicStyleId, type NowPlaying } from '../audio/sound';
  import { AUTO, STATIONS, STATION, type StationChoice } from '../audio/stations';
  import TileArt from './TileArt.svelte';
  import CloseButton from './CloseButton.svelte';

  const base = import.meta.env.BASE_URL;
  const art = (id: string) => `${base}icons/music/${id}.webp`;
  const s = $derived(game.settings);
  const choice = $derived<StationChoice>(s.musicStation ?? 'auto');
  let now = $state<NowPlaying>(musicNow());
  const off = $derived(s.music === false || s.sound === false);

  function pick(c: StationChoice) {
    unlockAudio();
    sfx.click();
    game.update(pp => { pp.settings.musicStation = c; if (pp.settings.music === false) pp.settings.music = true; });
    setMusicStation(c);
  }
  function style(id: MusicStyleId | 'mix') { sfx.click(); game.update(pp => { pp.settings.musicStyle = id; }); setMusicStyle(id); }
  function toggle() { game.update(pp => { pp.settings.music = pp.settings.music === false; }); }
  const close = () => game.closeMusic();
  function onKey(e: KeyboardEvent) {
    // the picker owns the keyboard while it's open (a lesson or battle underneath doesn't hear it)
    e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); }
  }
  let unsub: () => void = () => {};
  onMount(() => { window.addEventListener('keydown', onKey, true); unsub = onMusic(n => (now = n)); });
  onDestroy(() => { window.removeEventListener('keydown', onKey, true); unsub(); });
  const playingName = $derived(STATION[now.station]?.name ?? '');
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="wrap" role="dialog" aria-label="Pick your music" onclick={close}>
  <div class="sheet card" onclick={(e) => e.stopPropagation()}>
    <div class="head">
      <TileArt kind="music" size={56} />
      <div class="tt">
        <h2>Pick your music</h2>
        <p class="muted">Tap a station to hear it. It keeps playing everywhere until you pick another.</p>
      </div>
      <CloseButton onclick={close} size={44} />
    </div>

    <div class="now" class:off>
      <img src={art(now.station)} alt="" />
      <div class="nt">
        {#if off}<b>Music is off</b><small>Switch it on to hear your station</small>
        {:else}<small>Now playing{choice === 'auto' ? ' (Auto)' : ''} · {playingName}</small><b>{now.title ?? '...'}</b>{#if now.artist}<em>{now.artist}</em>{/if}{/if}
      </div>
      {#if !off}<button class="skip" onclick={() => { sfx.click(); skipTrack(); }} aria-label="Next song"><TileArt kind="play" size={30} /><span>Next song</span></button>{/if}
      <button class="sw" class:on={!off} onclick={toggle} aria-pressed={!off} aria-label="Music on or off"><i></i><em>{off ? 'Off' : 'On'}</em></button>
    </div>

    <div class="grid">
      <button class="st auto" class:on={choice === 'auto'} onclick={() => pick('auto')}>
        <span class="pics"><img src={art(AUTO.focus)} alt="" /><img src={art(AUTO.menu)} alt="" /><img src={art(AUTO.adventure)} alt="" /></span>
        <span class="sn"><b>Auto</b><small>Calm for lessons, happy on the menus, an adventure in Adventure</small></span>
      </button>
      {#each STATIONS as st (st.id)}
        <button class="st" class:on={choice === st.id} onclick={() => pick(st.id)}>
          <img src={art(st.id)} alt="" />
          <span class="sn"><b>{st.name}</b><small>{st.blurb}</small></span>
          {#if now.station === st.id && !off}<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>{/if}
        </button>
      {/each}
    </div>

    {#if now.station === 'originals'}
      <div class="styles">
        <b>Keypals Originals style</b>
        <div class="chips">
          {#each Object.entries(MUSIC_STYLES) as [id, st] (id)}<button class:on={(s.musicStyle ?? 'sunny') === id} onclick={() => style(id as MusicStyleId)}>{st.name}</button>{/each}
          <button class:on={s.musicStyle === 'mix'} onclick={() => style('mix')}>Mix</button>
        </div>
      </div>
    {/if}

    <label class="vol">
      <TileArt kind="sfx" size={30} />
      <input type="range" min="0" max="1" step="0.05" value={s.volume} oninput={(e) => game.update(pp => { pp.settings.volume = +e.currentTarget.value; })} aria-label="Volume" />
      <span class="muted">Volume</span>
    </label>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; z-index: 85; display: grid; place-items: center; padding: 16px; background: rgba(60, 40, 110, .32); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
  .sheet { width: min(880px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 18px 20px 16px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.3); }
  .head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .tt { flex: 1; min-width: 0; }
  .head h2 { font-size: 28px; margin: 0; }
  .head p { margin: 2px 0 0; font-weight: 600; }
  .now { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 20px; background: linear-gradient(135deg, #fff4fb, #f1f6ff); border: 3px solid #f3dcf0; margin-bottom: 12px; }
  .now img { width: 56px; height: 56px; object-fit: contain; flex: none; }
  .now.off img { filter: grayscale(.9) opacity(.55); }
  .nt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nt small { font: 700 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .nt b { font: 600 20px/1.15 var(--font-ui); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nt em { font: 600 13px var(--font-body); font-style: normal; color: var(--muted); }
  .skip { flex: none; display: flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; padding: 4px 12px 4px 6px; background: #fff; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink); box-shadow: var(--shadow-sm); }
  .sw { flex: none; position: relative; width: 66px; height: 34px; border-radius: 999px; background: #d9d2e6; border: 0; cursor: pointer; transition: background .2s; }
  .sw i { position: absolute; top: 4px; left: 4px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(50, 30, 90, .25); transition: left .2s cubic-bezier(.3, .8, .4, 1.4); }
  .sw em { position: absolute; top: 50%; transform: translateY(-50%); right: 9px; font: 800 12px var(--font-body); font-style: normal; color: #fff; }
  .sw.on { background: #5fcf9f; } .sw.on i { left: 36px; } .sw.on em { right: auto; left: 9px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .st { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 20px; border: 3px solid #e8e1f4; background: #faf8fe; cursor: pointer; text-align: left; font: inherit; color: var(--ink); transition: transform .12s, border-color .2s, background .2s; }
  .st:hover { transform: translateY(-2px); }
  .st.on { border-color: #9b7cf6; background: #f4efff; box-shadow: 0 0 0 3px #e2d8ff; }
  .st > img { width: 60px; height: 60px; object-fit: contain; flex: none; }
  .sn { display: flex; flex-direction: column; min-width: 0; }
  .sn b { font: 600 18px/1.1 var(--font-ui); }
  .sn small { font: 600 12.5px/1.25 var(--font-body); color: var(--muted); }
  .auto { grid-column: span 2; }
  .pics { display: flex; flex: none; }
  .pics img { width: 44px; height: 44px; object-fit: contain; margin-right: -8px; }
  .pics img:last-child { margin-right: 4px; }
  .eq { position: absolute; top: 8px; right: 10px; display: flex; gap: 2px; align-items: flex-end; height: 14px; }
  .eq i { width: 3px; background: #9b7cf6; border-radius: 2px; animation: eq .9s ease-in-out infinite; }
  .eq i:nth-child(2) { animation-delay: .2s; } .eq i:nth-child(3) { animation-delay: .4s; }
  @keyframes eq { 0%, 100% { height: 4px; } 50% { height: 14px; } }
  .styles { margin-top: 12px; padding: 10px 12px; border-radius: 18px; background: #f8f6fc; }
  .styles b { font: 600 16px var(--font-ui); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .chips button { border: 0; border-radius: 999px; padding: 5px 12px; background: #fff; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); box-shadow: inset 0 0 0 2px #e4def3; }
  .chips button.on { background: #9b7cf6; color: #fff; box-shadow: none; }
  .vol { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 8px 14px; border-radius: 18px; background: #f8f6fc; font-weight: 700; }
  .vol input { flex: 1; accent-color: var(--primary); height: 28px; }
  @media (max-width: 640px) {
    .sheet { padding: 14px 12px; }
    .head h2 { font-size: 22px; }
    .head p { font-size: 13px; }
    .grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .auto { grid-column: 1 / -1; }
    .st { flex-direction: column; align-items: center; text-align: center; padding: 8px 6px; gap: 4px; }
    .st > img { width: 52px; height: 52px; }
    .sn small { font-size: 11.5px; }
    .auto.st { flex-direction: row; text-align: left; }
    .skip span { display: none; }
    .now { flex-wrap: wrap; }
  }
</style>
