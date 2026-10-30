<script lang="ts">
  // The big "Next on my path" button on an end card (path/next.ts): the next thing's picture, and its name.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { KIND_ICON, KIND_NAME } from './units';
  import { startPathNext, type PathNext } from './next';

  type Props = { next: PathNext; hotkey?: string; compact?: boolean };
  let { next, hotkey, compact = false }: Props = $props();
  const base = import.meta.env.BASE_URL;
  function go() { sfx.click(); if (game.profile) startPathNext(game.profile, next); }
</script>

<button class="pn" class:compact onclick={go} title="Next on my path: {next.item.name}">
  <img src="{base}{KIND_ICON[next.item.kind]}" alt="" />
  <span class="tx"><small>Next on my path · {KIND_NAME[next.item.kind]}</small><b>{next.item.name}</b></span>
  {#if hotkey}<span class="kbd">{hotkey}</span>{/if}
</button>

<style>
  .pn { position: relative; display: flex; align-items: center; gap: 12px; min-width: 0; max-width: 100%; padding: 12px 22px 12px 12px; border: 0; border-radius: 26px; cursor: pointer; text-align: left; color: #0f4a36; background: linear-gradient(180deg, #8ff0c4, #4fcf98); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .6), 0 6px 0 #2f9f70, 0 16px 26px -14px rgba(20, 90, 60, .6); transition: transform .14s, box-shadow .14s; animation: pn-in .45s cubic-bezier(.3, .8, .4, 1.4) both; }
  .pn:hover { transform: translateY(-3px); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .6), 0 9px 0 #2f9f70, 0 20px 30px -14px rgba(20, 90, 60, .6); }
  .pn:active { transform: translateY(3px); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .6), 0 2px 0 #2f9f70; }
  img { width: 64px; height: 64px; object-fit: contain; flex: none; filter: drop-shadow(0 3px 4px rgba(0, 60, 30, .25)); }
  .tx { display: flex; flex-direction: column; min-width: 0; }
  small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; opacity: .85; }
  b { font: 600 24px/1.1 var(--font-ui); color: #0b3a2a; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .kbd { position: absolute; top: -9px; right: 12px; font: 800 11px var(--font-body); color: var(--ink2); background: #fff; border-radius: 8px; padding: 2px 7px; box-shadow: 0 2px 0 #d6cceb; }
  .compact { padding: 8px 16px 8px 8px; gap: 8px; border-radius: 22px; }
  .compact img { width: 46px; height: 46px; }
  .compact b { font-size: 19px; }
  @keyframes pn-in { from { opacity: 0; transform: translateY(10px) scale(.92); } }
</style>
