<script lang="ts">
  // What stands at the door of a place when a grown-up or teacher said so (rules.ts): the place's time is
  // up today ("That's enough island time today. Your island will be here tomorrow!"), or the path comes
  // first. Kind words, who set it (the right person: your teacher or your grown-up), the place's own
  // picture, and a way to the path or Home.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { STOP, type Door } from './rules';

  /** `onback`: this door stands in front of Free play, over the Journey trail: back to the trail */
  type Props = { door: Door; onback?: () => void };
  let { door, onback }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const stop = $derived(door.kind === 'time' ? STOP[door.place] : null);
  const title = $derived(stop ? stop.title : door.kind === 'path' && door.keep === 'only' ? 'Today is a path day!' : 'First, your path!');
  const who = $derived(door.from === 'class' ? 'Your teacher' : 'Your grown-up');
  const line = $derived(stop ? stop.line : door.kind === 'path' && door.keep === 'only'
    ? `${who} put the path on for today. It has Learn, practice, games and battles in it.`
    : `Do ${door.kind === 'path' && door.left === 1 ? '1 more thing' : `${door.kind === 'path' ? door.left : 1} more things`} on your path, then everything opens.`);
  const said = $derived(door.kind === 'time' ? `${who} set this limit.` : door.keep === 'first' ? `${who} asked for the path first.` : '');
  const art = $derived(stop ? stop.art : 'icons/path.webp');
</script>

<div class="screen door">
  <div class="card box">
    <img class="art" class:wide={art.startsWith('island/')} src="{base}{art}" alt="" />
    <h1>{title}</h1>
    <p>{line}</p>
    {#if door.kind === 'time' && door.earned}<p class="small">Practice earns more time here: every minute of practice adds a minute.</p>{/if}
    {#if said}<p class="small said">{said}</p>{/if}
    <div class="row">
      {#if onback}<button class="btn btn-primary btn-big" onclick={() => { sfx.click(); onback?.(); }}><img src="{base}icons/path.webp" alt="" />Back to the trail</button>
      {:else}<button class="btn btn-primary btn-big" onclick={() => { sfx.click(); game.go('path'); }}><img src="{base}icons/path.webp" alt="" />Go to my path</button>{/if}
      <button class="btn btn-big" onclick={() => { sfx.click(); game.go('hub'); }}><img src="{base}game/icon-home.webp" alt="" />Home</button>
    </div>
  </div>
</div>

<style>
  .door { display: grid; place-items: center; padding: 16px; background: radial-gradient(circle at 20% 15%, #fff1d6 0, transparent 45%), radial-gradient(circle at 80% 85%, #e2f3ff 0, transparent 50%), var(--bg); }
  .box { width: min(560px, 100%); padding: 26px 26px 22px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; border-radius: 30px; }
  .art { width: 140px; height: 140px; object-fit: contain; filter: drop-shadow(0 8px 10px rgba(40, 20, 80, .25)); }
  .art.wide { width: 240px; height: 150px; object-fit: cover; border-radius: 22px; }
  h1 { margin: 6px 0 0; font-size: 32px; color: #3d2a86; }
  p { margin: 0; font: 600 19px/1.4 var(--font-body); color: var(--ink2); }
  .small { font-size: 15px; color: var(--muted); }
  .row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
  .row .btn { display: inline-flex; align-items: center; gap: 8px; }
  .row img { width: 34px; height: 34px; object-fit: contain; }
  @media (max-width: 600px) { h1 { font-size: 25px; } p { font-size: 16.5px; } .art { width: 110px; height: 110px; } .row .btn { width: 100%; justify-content: center; } }
</style>
