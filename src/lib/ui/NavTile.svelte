<script lang="ts">
  // A big picture button: an illustration on top, a short word underneath.
  import type { Snippet } from 'svelte';
  import TileArt, { type ArtKind } from './TileArt.svelte';
  import { sfx } from '../audio/sound';

  type Props = {
    label: string; kind?: ArtKind; art?: Snippet; size?: 'lg' | 'md' | 'sm';
    tone?: 'mint' | 'butter' | 'sky' | 'lilac' | 'pink' | 'plain'; badge?: string | number; hotkey?: string;
    title?: string; onclick: () => void;
  };
  let { label, kind, art, size = 'md', tone = 'plain', badge, hotkey, title, onclick }: Props = $props();
  const px = $derived(size === 'lg' ? 92 : size === 'md' ? 62 : 40);
</script>

<button class="tile {size} {tone}" {title} aria-label={title ?? label} onclick={() => { sfx.click(); onclick(); }}>
  <span class="gloss" aria-hidden="true"></span>
  <span class="pic" style:width="{px}px" style:height="{px}px">
    {#if art}{@render art()}{:else if kind}<TileArt {kind} size={px} />{/if}
  </span>
  <span class="lbl">{label}</span>
  {#if hotkey}<span class="kbd">{hotkey}</span>{/if}
  {#if badge !== undefined && badge !== ''}<span class="badge">{badge}</span>{/if}
</button>

<style>
  .tile {
    --edge: #ece6f6; --edge-d: #d6cceb; --bg: #fff;
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    background: linear-gradient(180deg, #fff 0%, #fff 38%, var(--bg) 100%); border: 3px solid var(--edge); border-radius: 26px; cursor: pointer;
    color: var(--ink); font: inherit;
    box-shadow: inset 0 3px 0 rgba(255, 255, 255, .95), inset 0 -10px 18px -12px var(--edge-d), 0 6px 0 var(--edge-d), 0 16px 26px -14px rgba(70, 40, 130, .45);
    transition: transform .14s, box-shadow .14s;
  }
  /* a shine that sweeps across on hover */
  .gloss { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
  .gloss::after { content: ''; position: absolute; top: 0; bottom: 0; left: -60%; width: 50%; background: linear-gradient(105deg, transparent, rgba(255, 255, 255, .8), transparent); transform: skewX(-12deg); transition: left .55s ease; }
  .tile:hover .gloss::after { left: 120%; }
  .tile:hover { transform: translateY(-3px); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .95), inset 0 -10px 18px -12px var(--edge-d), 0 9px 0 var(--edge-d), 0 20px 30px -14px rgba(70, 40, 130, .5); }
  .tile:hover .pic :global(.art) { transform: scale(1.1) rotate(-5deg); }
  .tile:active { transform: translateY(4px); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .95), 0 2px 0 var(--edge-d), 0 6px 12px -8px rgba(70, 40, 130, .35); }
  .tile:focus-visible { outline: 4px solid var(--primary-hi); outline-offset: 3px; }
  .pic { position: relative; display: grid; place-items: center; filter: drop-shadow(0 4px 3px rgba(60, 30, 110, .2)); }
  /* big buttons breathe a little so they feel alive */
  .lg .pic { animation: tile-bob 2.8s ease-in-out infinite; }
  @keyframes tile-bob { 50% { transform: translateY(-4px); } }
  .lbl { position: relative; font: 600 17px/1.1 var(--font-ui); text-align: center; white-space: nowrap; }
  .lg { min-width: 170px; padding: 16px 20px 14px; }
  .lg .lbl { font-size: 23px; }
  .md { min-width: 112px; padding: 10px 14px 10px; border-radius: 22px; }
  .sm { flex-direction: row; gap: 8px; padding: 6px 14px 6px 8px; border-radius: 18px; }
  .sm .lbl { font-size: 16px; }
  .kbd { position: absolute; top: 8px; right: 10px; font-size: 11px; }
  .badge { position: absolute; top: -8px; right: -6px; min-width: 26px; padding: 3px 8px; border-radius: 999px; background: var(--primary); color: #fff; font: 800 13px var(--font-body); box-shadow: 0 2px 0 rgba(60, 30, 140, .3); }
  .mint { --edge: #bfeedb; --edge-d: #8fd9b8; --bg: #e6fbf1; }
  .butter { --edge: #f6ecac; --edge-d: #e8d878; --bg: #fff8d4; }
  .sky { --edge: #c4e3fa; --edge-d: #94c8f0; --bg: #e7f4ff; }
  .lilac { --edge: #ddd0fb; --edge-d: #bba8f3; --bg: #f1ebff; }
  .pink { --edge: #ffd3e6; --edge-d: #ffacce; --bg: #ffeef6; }
  @media (prefers-reduced-motion: reduce) { .lg .pic { animation: none; } }
  :global(:root[data-motion='reduced']) .lg .pic { animation: none; }
</style>
