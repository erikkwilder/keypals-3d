<script lang="ts">
  // Sound and voice switches, reachable from every screen. The first time a player starts a
  // lesson it opens by itself so they can choose before anyone starts talking.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import type { Settings } from '../engine/profile';
  import { outfitOf } from '../engine/profile';
  import { hush, say } from '../audio/voice.svelte';
  import { sfx } from '../audio/sound';
  import TileArt, { type ArtKind } from './TileArt.svelte';
  import Critter from './Critter.svelte';
  import NavTile from './NavTile.svelte';
  import { engineLabel } from '../polyfills';
  import { STATION } from '../audio/stations';

  const mode = $derived(game.sheet ?? 'settings');
  const p = $derived(game.profile);
  const s = $derived(game.settings);
  const inLesson = $derived(game.screen === 'run');

  type Row = { key: 'voice' | 'sound' | 'music'; label: string; sub: string; art?: ArtKind };
  const ROWS: Row[] = [
    { key: 'voice', label: 'Coach voice', sub: 'Talks you through each lesson', art: 'coach' },
    { key: 'sound', label: 'Sound effects', sub: 'Taps, pops and sparkles', art: 'sfx' },
    { key: 'music', label: 'Music', sub: 'Songs while you play', art: 'music' },
  ];
  const isOn = (k: Row['key']) => s[k] !== false;

  function toggle(k: Row['key']) {
    const on = !isOn(k);
    game.update(pp => { (pp.settings as Settings)[k] = on; });
    if (!on && k === 'voice') hush();
    // a little taste of what you just switched on
    if (on && k === 'voice') say('coach.nice', { important: true });
    if (on && k === 'sound') setTimeout(() => sfx.pop(), 30);
  }
  function setDemos(on: boolean) { game.update(pp => { pp.settings.demos = on ? 'auto' : 'off'; }); sfx.click(); }

  function close() {
    if (mode === 'setup') game.update(pp => { pp.soundSetup = true; });
    game.closeSheet();
  }
  function more() { game.closeSheet(); game.go('settings'); }

  function onKey(e: KeyboardEvent) {
    // the sheet owns the keyboard while it's open
    e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); close(); }
  }
  onMount(() => window.addEventListener('keydown', onKey, true));
  onDestroy(() => window.removeEventListener('keydown', onKey, true));
</script>

<div class="wrap" role="dialog" aria-label={mode === 'setup' ? 'Sound setup' : 'Settings'}>
  <div class="sheet card">
    <div class="head">
      <TileArt kind={mode === 'setup' ? 'sfx' : 'settings'} size={52} />
      <div>
        <h2>{mode === 'setup' ? 'How should Keypals sound?' : 'Settings'}</h2>
        <p class="muted">{mode === 'setup' ? 'Tap to switch things on or off. You can change this any time with the gear button.' : 'Tap a card to switch it on or off.'}</p>
      </div>
      {#if mode !== 'setup'}<button class="x" aria-label="Close" onclick={close}><TileArt kind="close" size={40} /></button>{/if}
    </div>

    <div class="grid">
      {#each ROWS as r (r.key)}
        {@const on = isOn(r.key)}
        <button class="opt" class:on onclick={() => toggle(r.key)} aria-pressed={on}>
          <span class="pic">
            {#if r.art}<TileArt kind={r.art} size={70} off={!on} />
            {:else if p}<span class="pal" class:off={!on}><Critter friend={p.buddy} look={s.look} accessory={outfitOf(p)} size={74} lite /><span class="bub">hi!</span></span>{/if}
          </span>
          <span class="txt"><b>{r.label}</b><small>{r.sub}</small></span>
          <span class="sw" class:on><i></i><em>{on ? 'On' : 'Off'}</em></span>
        </button>
      {/each}
    </div>

    <button class="opt wide pickmusic" onclick={() => { sfx.click(); game.openMusic(); }}>
      <span class="pic"><img src="{import.meta.env.BASE_URL}icons/music/{s.musicStation && s.musicStation !== 'auto' ? s.musicStation : 'happy'}.webp" alt="" width="62" height="62" /></span>
      <span class="txt"><b>Pick your music</b><small>{s.musicStation && s.musicStation !== 'auto' ? STATION[s.musicStation].name : 'Auto'}: calm, happy, adventure, rock, electronic, retro and more</small></span>
      <span class="go"><TileArt kind="play" size={34} /></span>
    </button>

    <label class="vol">
      <TileArt kind="sfx" size={30} />
      <input type="range" min="0" max="1" step="0.05" value={s.volume} oninput={(e) => game.update(pp => { pp.settings.volume = +e.currentTarget.value; })} aria-label="Volume" />
      <span class="muted">Volume</span>
    </label>

    {#if mode !== 'setup'}
      <button class="opt wide" class:on={s.demos !== 'off'} onclick={() => setDemos(s.demos === 'off')} aria-pressed={s.demos !== 'off'}>
        <span class="pic"><TileArt kind="demo" size={56} off={s.demos === 'off'} /></span>
        <span class="txt"><b>Finger demos</b><small>The coach shows the moves before new keys</small></span>
        <span class="sw" class:on={s.demos !== 'off'}><i></i><em>{s.demos !== 'off' ? 'On' : 'Off'}</em></span>
      </button>
    {/if}

    <div class="actions">
      {#if mode !== 'setup' && !inLesson}<NavTile size="sm" kind="settings" label="More settings" onclick={more} />{/if}
      <div class="grow"></div>
      <NavTile size="sm" tone="mint" kind="play" label={mode === 'setup' ? "Let's play!" : 'Done'} onclick={close} />
    </div>
    <p class="ver">Keypals {__APP_VERSION__} · {engineLabel()}</p>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(60, 40, 110, .32); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
  .sheet { width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 20px 22px 18px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.3); }
  .head { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .head h2 { font-size: 28px; }
  .head p { margin: 2px 0 0; font-weight: 600; }
  .x { margin-left: auto; background: none; border: 0; cursor: pointer; padding: 0; align-self: flex-start; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .opt { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 22px; border: 3px solid #e4dcf2; background: #f8f6fc; cursor: pointer; text-align: left; font: inherit; color: var(--ink); transition: transform .12s, border-color .2s, background .2s; }
  .opt:hover { transform: translateY(-2px); }
  .opt.on { border-color: #bfeedb; background: #f2fff9; }
  .opt.wide { width: 100%; margin-top: 12px; }
  .pickmusic { border-color: #e2d8ff; background: #f6f2ff; }
  .pickmusic .go { flex: none; }
  .pic { flex: none; display: grid; place-items: center; width: 74px; height: 74px; }
  .pal { position: relative; transition: filter .2s; }
  .pal.off { filter: grayscale(.9) opacity(.55); }
  .bub { position: absolute; top: -4px; right: -14px; background: #fff; border: 2px solid #ddd0fb; border-radius: 12px; padding: 1px 7px; font: 800 13px var(--font-body); }
  .txt { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .txt b { font: 600 20px/1.1 var(--font-ui); }
  .txt small { font: 600 13px/1.25 var(--font-body); color: var(--muted); }
  .sw { flex: none; position: relative; width: 66px; height: 34px; border-radius: 999px; background: #d9d2e6; transition: background .2s; }
  .sw i { position: absolute; top: 4px; left: 4px; width: 26px; height: 26px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(50, 30, 90, .25); transition: left .2s cubic-bezier(.3, .8, .4, 1.4); }
  .sw em { position: absolute; top: 50%; transform: translateY(-50%); right: 9px; font: 800 12px var(--font-body); font-style: normal; color: #fff; }
  .sw.on { background: #5fcf9f; }
  .sw.on i { left: 36px; }
  .sw.on em { right: auto; left: 9px; }
  .vol { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding: 8px 14px; border-radius: 18px; background: #f8f6fc; font-weight: 700; }
  .vol input { flex: 1; accent-color: var(--primary); height: 28px; }
  .actions { display: flex; align-items: center; gap: 12px; margin-top: 16px; }
  .grow { flex: 1; }
  .ver { margin: 12px 0 0; text-align: center; font: 700 11px var(--font-body); color: #b2a8c8; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
</style>
