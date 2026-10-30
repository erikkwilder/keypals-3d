<script lang="ts">
  // The Menu (the three lines on the top bar of every screen): the music (what's playing, next song, pick a
  // station: the note on the bar opens the same, and on a phone this is where it is), music and sounds on or off, then
  // go anywhere, by level (Home, Typing, Math, Arcade, Adventure, My Sky Island, My stuff, My path), then
  // Settings, Ideas and help, Grown-ups, For teachers and About. No scores here: how you're doing is in My
  // stuff › My progress. A tap outside it, or Esc, closes it.
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { menuMore, menuPlaces, type MenuItem } from '../nav';
  import CloseButton from './CloseButton.svelte';
  import QuickToggles from './QuickToggles.svelte';
  import MusicNow from './MusicNow.svelte';

  const base = import.meta.env.BASE_URL;
  const places = menuPlaces();
  const more = menuMore();
  /** the place showing now (marked in the list) */
  const here = $derived(game.screen === 'subject' ? game.subject : game.screen);
  function go(t: MenuItem) { sfx.click(); game.closeMenu(); t.go(); }
  function close() { sfx.click(); game.closeMenu(); }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }
  onMount(() => { sfx.pop(); window.addEventListener('keydown', onKey, true); });
  onDestroy(() => window.removeEventListener('keydown', onKey, true));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="gm" transition:fade={{ duration: 140 }} onclick={close}>
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menu" tabindex="-1">
    <header class="top">
      <img class="cmp" src="{base}icons/hamburger.svg" alt="" />
      <h2>Menu</h2>
      <CloseButton onclick={close} label="Close the menu" size={42} />
    </header>
    <MusicNow compact onpick={() => game.closeMenu()} />
    <QuickToggles />
    <h3>Go to</h3>
    <nav class="places" aria-label="Go to">
      {#each places as t (t.id)}
        <button class="place" class:here={here === t.id} onclick={() => go(t)}><img src="{base}{t.icon}" alt="" /><span>{t.name}</span></button>
      {/each}
    </nav>
    <nav class="more" aria-label="More">
      {#each more as t (t.id)}
        <button class="row" onclick={() => go(t)}><img src="{base}{t.icon}" alt="" /><span>{t.name}</span></button>
      {/each}
    </nav>
  </div>
</div>

<style>
  .gm { position: fixed; inset: 0; z-index: 80; display: flex; justify-content: flex-end; background: rgba(36, 24, 70, .4); backdrop-filter: blur(4px); }
  .panel { width: min(420px, 100%); height: 100%; overflow: auto; overscroll-behavior: contain; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; padding: 14px 18px 20px; background: #fff; box-shadow: -20px 0 50px -30px rgba(30, 10, 70, .6); animation: slide .2s ease-out; }
  @keyframes slide { from { transform: translateX(30px); opacity: 0; } }
  .top { display: flex; align-items: center; gap: 10px; }
  .cmp { width: 40px; height: 40px; object-fit: contain; }
  .top h2 { flex: 1; margin: 0; font-size: 28px; }
  h3 { margin: 4px 0 -4px; font: 700 14px var(--font-body); color: var(--muted); }
  .places { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .place { display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; text-align: left; padding: 8px 10px; border-radius: 18px; background: #f7f4fd; box-shadow: inset 0 0 0 2px #ece6f6; font: 600 18px var(--font-ui); color: var(--ink); }
  .place img { width: 44px; height: 44px; object-fit: contain; flex: none; }
  .place:hover { box-shadow: inset 0 0 0 2px #c9b8ff; }
  .place.here { background: #fff8e6; box-shadow: inset 0 0 0 3px #ffc93d; }
  .more { display: flex; flex-direction: column; gap: 2px; padding-top: 8px; border-top: 2px dashed #ece6f6; }
  .row { display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; text-align: left; padding: 6px 8px; border-radius: 14px; background: none; font: 600 17px var(--font-ui); color: var(--ink); }
  .row img { width: 34px; height: 34px; object-fit: contain; flex: none; }
  .row:hover { background: #f5f2fb; }
  @media (max-width: 600px) { .panel { width: 100%; padding: 12px 14px 18px; } .place { font-size: 16px; } .place img { width: 38px; height: 38px; } }
</style>
