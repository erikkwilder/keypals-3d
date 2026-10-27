<script lang="ts" module>
  export type ArtKind = 'play' | 'redo' | 'map' | 'settings' | 'stickers' | 'medals' | 'coach' | 'sfx' | 'music' | 'demo' | 'players' | 'close' | 'chart' | 'dances' | 'outfits' | 'home';
</script>

<script lang="ts">
  // Little illustrations for the big buttons, so kids can tell what a button does without reading.
  type Props = { kind: ArtKind; size?: number; off?: boolean };
  let { kind, size = 64, off = false }: Props = $props();
</script>

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
  {:else if kind === 'settings'}
    <g transform="translate(50 50)">
      <path d="M-7 -40h14l3 11 8 4 10-6 10 10-6 10 4 8 11 3v14l-11 3-4 8 6 10-10 10-10-6-8 4-3 11h-14l-3-11-8-4-10 6-10-10 6-10-4-8-11-3v-14l11-3 4-8-6-10 10-10 10 6 8-4z" fill="#b9a2f5" />
      <circle r="17" fill="#fff" />
      <circle r="9" fill="#d9ccfb" />
    </g>
    <path d="M83 14l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffe97a" />
  {:else if kind === 'stickers'}
    <g transform="rotate(-12 38 50)">
      <path d="M38 14l9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3z" fill="#fff" stroke="#fff" stroke-width="10" stroke-linejoin="round" />
      <path d="M38 14l9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3z" fill="#ffe25e" />
      <circle cx="32" cy="44" r="3" fill="#4a3a5a" /><circle cx="44" cy="44" r="3" fill="#4a3a5a" />
      <path d="M33 52q5 4 10 0" fill="none" stroke="#4a3a5a" stroke-width="2.6" stroke-linecap="round" />
    </g>
    <g transform="rotate(14 70 66)">
      <path d="M70 88s-24-14-24-30c0-8 6-13 12-13 5 0 9 3 12 7 3-4 7-7 12-7 6 0 12 5 12 13 0 16-24 30-24 30z" fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round" />
      <path d="M70 88s-24-14-24-30c0-8 6-13 12-13 5 0 9 3 12 7 3-4 7-7 12-7 6 0 12 5 12 13 0 16-24 30-24 30z" fill="#ff8fbf" />
      <path d="M84 50l8 8-9 1z" fill="#ffe0ee" />
    </g>
  {:else if kind === 'medals'}
    <path d="M30 8h16l8 30H38z" fill="#8fc4f5" />
    <path d="M70 8H54l-8 30h16z" fill="#ff9cc6" />
    <circle cx="50" cy="62" r="28" fill="#e6cc45" />
    <circle cx="50" cy="60" r="28" fill="#ffe25e" />
    <circle cx="50" cy="60" r="20" fill="#fff09a" />
    <path d="M50 46l4.5 9.5 10.5 1.5-7.5 7.5 2 10.5L50 70l-9.5 5 2-10.5-7.5-7.5 10.5-1.5z" fill="#e8c52c" />
  {:else if kind === 'home'}
    <path d="M50 14L10 48h12v36h56V48h12z" fill="#ff8fbf" />
    <path d="M22 48h56v36H22z" fill="#c3e5fb" />
    <path d="M50 14L10 48h80z" fill="#ff7fb0" />
    <path d="M66 20h10v18l-10-8z" fill="#e870a6" />
    <path d="M42 84V62a8 8 0 0 1 16 0v22z" fill="#ffe25e" />
    <circle cx="54" cy="73" r="2" fill="#c9a20f" />
    <rect x="28" y="56" width="10" height="10" rx="2" fill="#fff" /><rect x="62" y="56" width="10" height="10" rx="2" fill="#fff" />
    <path d="M10 84h80" stroke="#7fe0b4" stroke-width="6" stroke-linecap="round" />
  {:else if kind === 'dances'}
    <circle cx="50" cy="52" r="40" fill="#c99bff" />
    <circle cx="50" cy="48" r="40" fill="#dcbcff" />
    <path d="M40 66V30l30-8v36" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
    <ellipse cx="33" cy="67" rx="10" ry="8" fill="#fff" transform="rotate(-20 33 67)" />
    <ellipse cx="63" cy="59" rx="10" ry="8" fill="#fff" transform="rotate(-20 63 59)" />
    <path d="M40 38l30-8" stroke="#fff" stroke-width="7" stroke-linecap="round" />
    <path d="M84 16l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffe97a" />
    <path d="M16 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ff9cc6" />
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

<style>
  .art { display: block; overflow: visible; transition: transform .2s cubic-bezier(.3, .8, .4, 1.5), filter .2s; }
  .art.off { filter: grayscale(.9) opacity(.55); }
</style>
