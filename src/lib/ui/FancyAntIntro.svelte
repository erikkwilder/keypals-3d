<script lang="ts" module>
  // Once a visit: a reload in the same tab goes straight to the game.
  const KEY = 'keypals-intro-seen';
  export function introDue(): boolean {
    try { return !sessionStorage.getItem(KEY); } catch { return true; }
  }
  function markSeen() { try { sessionStorage.setItem(KEY, '1'); } catch { /* private windows: it just plays again */ } }
</script>

<script lang="ts">
  // The FancyAnt film when the game opens: the ant flies in, lands, checks itself in the mirror and fixes
  // its bow tie (6.5 s, no sound, so it can start by itself). Any key or tap skips it. With reduced motion,
  // or if the film can't start (a phone saving power, a slow line), the last frame shows for a moment
  // instead. The film fills the whole screen at every size (cropped a little where the screen is a
  // different shape from the film), kept centred on the ant, so there are no bands at the edges.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  type Props = { onDone: () => void };
  let { onDone }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let leaving = $state(false);
  let still = $state(false);
  let named = $state(false);
  let video: HTMLVideoElement | undefined = $state();
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => timers.push(setTimeout(f, ms));

  function finish() {
    if (leaving) return;
    leaving = true;
    later(onDone, 420);
  }
  function showStill(hold: number) { still = true; named = true; later(finish, hold); }
  function onKey(e: KeyboardEvent) { e.stopImmediatePropagation(); e.preventDefault(); finish(); }

  onMount(() => {
    // it counts as seen once it has started: a reload part-way through goes straight to the game
    markSeen();
    window.addEventListener('keydown', onKey, true);
    const reduced = game.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { showStill(1800); return; }
    video?.play().catch(() => showStill(1800));
    // nothing moving after a second and a half: show the last frame and move on
    later(() => { if (!still && (!video || video.currentTime < 0.05)) showStill(1600); }, 1500);
    // never longer than the film and a breath
    later(finish, 8200);
  });
  onDestroy(() => { timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey, true); });
</script>

<div class="intro" class:leaving role="presentation" onclick={finish}>
  {#if still}
    <img class="film" src="{base}brand/intro-end.webp" alt="The FancyAnt ant straightens its bow tie in a mirror" />
  {:else}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video class="film" bind:this={video} muted playsinline autoplay preload="auto" poster="{base}brand/intro-poster.webp"
      onended={() => { named = true; later(finish, 1500); }} aria-label="The FancyAnt ant flies in and straightens its bow tie in a mirror">
      <source src="{base}brand/intro.webm" type="video/webm" />
      <source src="{base}brand/intro.mp4" type="video/mp4" />
    </video>
  {/if}
  <div class="name" class:in={named}><b>FancyAnt Games</b><small>presents</small></div>
  <div class="skip">Tap to skip</div>
</div>

<style>
  /* the film's own colours: pink wall above, blue floor below */
  .intro { position: fixed; inset: 0; z-index: 200; cursor: pointer; display: grid; place-items: center; overflow: hidden;
    background: linear-gradient(#f2cce0 0 50%, #b2def4 50% 100%); transition: opacity .42s ease; }
  .intro.leaving { opacity: 0; }
  /* the film fills the screen edge to edge; where the screen is a different shape it's cropped, kept on
     the ant (it lands just right of centre, with the mirror to its left) and on its antennae at the top */
  .film { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 54% 38%; display: block; }
  .name { position: absolute; left: 50%; bottom: 6%; translate: -50% 0; display: flex; flex-direction: column; align-items: center; gap: 2px; background: rgba(255, 255, 255, .88); padding: 10px 26px 9px; border-radius: 24px; box-shadow: 0 10px 30px -14px rgba(60, 30, 90, .5); white-space: nowrap; opacity: 0; transform: translateY(14px); transition: opacity .45s ease, transform .45s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .name.in { opacity: 1; transform: none; }
  .name b { font: 600 clamp(26px, 4vw, 40px)/1 var(--font-ui); color: #2b2140; text-shadow: 0 2px 0 rgba(255, 255, 255, .6); }
  .name small { font: 700 13px var(--font-body); letter-spacing: .22em; text-transform: uppercase; color: #4a3f66; }
  .skip { position: absolute; right: 16px; bottom: 14px; font: 700 13px var(--font-body); color: #4a3f66; background: rgba(255, 255, 255, .7); padding: 4px 12px; border-radius: 999px; pointer-events: none; }
</style>
