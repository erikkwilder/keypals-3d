<script lang="ts">
  // Stars earned, as the painted gold star (one not won yet is a faded grey one).
  import { gameIconUrl } from '../art/icons';
  type Props = { n: number; of?: number; size?: number; animate?: boolean };
  let { n, of = 3, size = 24, animate = false }: Props = $props();
  const src = gameIconUrl('star');
</script>

<span class="stars" style:--sz="{size}px">
  {#each Array(of) as _, i}
    <img {src} alt="" class:on={i < n} class:animate style:animation-delay="{i * 220}ms" aria-hidden="true" draggable="false" />
  {/each}
</span>

<style>
  .stars { display: inline-flex; gap: calc(var(--sz) * .06); vertical-align: middle; }
  img { width: var(--sz); height: var(--sz); object-fit: contain; filter: grayscale(1) brightness(1.25) opacity(.45); user-select: none; }
  img.on { filter: drop-shadow(0 1px 1px rgba(150, 90, 0, .35)); }
  img.on.animate { animation: star-in .55s cubic-bezier(.3, .8, .4, 1.6) both; }
  @keyframes star-in { 0% { transform: scale(0) rotate(-60deg); } 100% { transform: scale(1) rotate(0); } }
</style>
