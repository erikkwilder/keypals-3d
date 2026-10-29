<script lang="ts" module>
  export type ArtKind = 'play' | 'redo' | 'map' | 'settings' | 'stickers' | 'medals' | 'coach' | 'sfx' | 'music' | 'demo' | 'players' | 'close' | 'chart' | 'dances' | 'outfits' | 'home';
</script>

<script lang="ts">
  // Little illustrations for the big buttons, so kids can tell what a button does without reading.
  type Props = { kind: ArtKind; size?: number; off?: boolean };
  let { kind, size = 64, off = false }: Props = $props();
  // these are painted pictures (in the style of the Adventure art); the rest are drawn below
  const PAINTED: Partial<Record<ArtKind, string>> = {
    home: 'game/icon-home.webp', dances: 'game/icon-dances.webp', stickers: 'game/icon-stickers.webp',
    medals: 'game/icon-medals.webp', settings: 'game/icon-settings.webp',
  };
  const painted = $derived(PAINTED[kind]);
</script>

{#if painted}
  <img class="art pt" class:off src="{import.meta.env.BASE_URL}{painted}" width={size} height={size} alt="" aria-hidden="true" draggable="false" />
{:else}
<svg class="art" class:off width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
  {#if kind === 'play'}
    <circle cx="50" cy="52" r="40" fill="#5fcf9f" />
    <circle cx="50" cy="48" r="40" fill="#7fe0b4" />
    <path d="M36 48h26M50 33l15 15-15 15" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
    <ellipse cx="34" cy="24" rx="12" ry="6" fill="#fff" opacity=".45" transform="rotate(-25 34 24)" />
  {:else if kind === 'redo'}
    <circle cx="50" cy="52" r="40" fill="#eed24c" />
    <circle cx="50" cy="48" r="40" fill="#ffe873" />
    <path d="M67 40a19 19 0 1 0 1 14" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" />
    <path d="M70 24v18H52" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />
    <ellipse cx="34" cy="24" rx="12" ry="6" fill="#fff" opacity=".45" transform="rotate(-25 34 24)" />
  {:else if kind === 'map'}
    <path d="M12 26l24-8 28 8 24-8v58l-24 8-28-8-24 8z" fill="#9fd3f7" />
    <path d="M36 18v58l28 8V26z" fill="#c3e5fb" />
    <path d="M12 26l24-8v58l-24 8z" fill="#86c3ef" />
    <path d="M20 66c10-4 12-18 24-16s14 14 26 6" fill="none" stroke="#ff8fbf" stroke-width="4" stroke-dasharray="1 7" stroke-linecap="round" />
    <path d="M70 18c-9 0-15 6-15 14 0 10 15 24 15 24s15-14 15-24c0-8-6-14-15-14z" fill="#ff7fb0" />
    <circle cx="70" cy="32" r="6" fill="#fff" />
  {:else if kind === 'outfits'}
    <path d="M50 10L24 76h52z" fill="#ff8fbf" />
    <path d="M50 10L37 43h26z" fill="#ffb3d3" />
    <path d="M30 61h40" stroke="#ffe25e" stroke-width="7" stroke-linecap="round" />
    <circle cx="44" cy="40" r="4" fill="#8fc4f5" /><circle cx="58" cy="54" r="4" fill="#7fe0b4" />
    <ellipse cx="50" cy="78" rx="34" ry="8" fill="#e870a6" />
    <circle cx="50" cy="10" r="8" fill="#ffe25e" />
  {:else if kind === 'coach'}
    <path d="M10 38l40-18 40 18-40 18z" fill="#7c5cf5" />
    <path d="M26 46v16c0 8 48 8 48 0V46l-24 11z" fill="#9a80fa" />
    <path d="M88 39v20" stroke="#ffe25e" stroke-width="4" stroke-linecap="round" /><circle cx="88" cy="62" r="5" fill="#ffe25e" />
    <path d="M30 80q8 6 16 0M40 88q10 7 20 0" fill="none" stroke="#b9a2f5" stroke-width="5" stroke-linecap="round" />
  {:else if kind === 'sfx'}
    <path d="M14 40h14l20-16v52L28 60H14z" fill="#7fc8f2" />
    <path d="M60 36a16 16 0 0 1 0 28M70 26a30 30 0 0 1 0 48" fill="none" stroke="#7fc8f2" stroke-width="7" stroke-linecap="round" />
    <path d="M84 12l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffe25e" />
  {:else if kind === 'music'}
    <path d="M38 70V22l40-8v48" fill="none" stroke="#ff8fbf" stroke-width="7" stroke-linejoin="round" />
    <ellipse cx="28" cy="72" rx="12" ry="9" fill="#ff8fbf" transform="rotate(-18 28 72)" />
    <ellipse cx="68" cy="64" rx="12" ry="9" fill="#ff8fbf" transform="rotate(-18 68 64)" />
    <path d="M38 32l40-8" stroke="#ff8fbf" stroke-width="7" />
  {:else if kind === 'demo'}
    <rect x="10" y="44" width="80" height="38" rx="9" fill="#e5dcf7" />
    {#each [0, 1, 2, 3, 4] as i}<rect x={16 + i * 14} y="52" width="10" height="9" rx="2.5" fill="#fff" />{/each}
    <rect x="30" y="67" width="40" height="8" rx="3" fill="#fff" />
    <path d="M58 58V24a6 6 0 0 1 12 0v22l12 4c5 2 7 6 6 11l-4 13H60z" fill="#fff7fb" stroke="#bea9e4" stroke-width="4" stroke-linejoin="round" />
    <circle cx="64" cy="26" r="4" fill="#7fe0b4" />
  {:else if kind === 'players'}
    <circle cx="36" cy="40" r="15" fill="#ffb3cf" /><path d="M12 82a24 24 0 0 1 48 0z" fill="#ffb3cf" />
    <circle cx="66" cy="44" r="13" fill="#9fd3f7" /><path d="M46 82a20 20 0 0 1 40 0z" fill="#9fd3f7" />
  {:else if kind === 'chart'}
    <rect x="12" y="14" width="76" height="70" rx="12" fill="#f3eeff" />
    <path d="M22 70 L40 52 L56 60 L78 30" fill="none" stroke="#efd21c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M22 76 L40 64 L56 68 L78 46" fill="none" stroke="#8f9cf7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="78" cy="30" r="7" fill="#5fcf9f" /><path d="M74.5 30l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" />
    <path d="M18 40 H84" stroke="#5fcf9f" stroke-width="3" stroke-dasharray="5 5" />
  {:else if kind === 'close'}
    <circle cx="50" cy="50" r="38" fill="#ece6f6" />
    <path d="M36 36l28 28M64 36L36 64" stroke="#8a7ca8" stroke-width="9" stroke-linecap="round" />
  {/if}
  {#if off}<path d="M16 84L84 16" stroke="#8a7ca8" stroke-width="9" stroke-linecap="round" /><path d="M16 84L84 16" stroke="#fff" stroke-width="3" stroke-linecap="round" />{/if}
</svg>
{/if}

<style>
  .art { display: block; overflow: visible; transition: transform .2s cubic-bezier(.3, .8, .4, 1.5), filter .2s; }
  .art.off { filter: grayscale(.9) opacity(.55); }
  .pt { object-fit: contain; user-select: none; }
</style>
