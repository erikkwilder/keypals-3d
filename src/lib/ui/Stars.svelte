<script lang="ts">
  type Props = { n: number; of?: number; size?: number; animate?: boolean };
  let { n, of = 3, size = 24, animate = false }: Props = $props();
</script>

<span class="stars" style:--sz="{size}px">
  {#each Array(of) as _, i}
    <svg viewBox="0 0 24 24" class:on={i < n} class:animate style:animation-delay="{i * 220}ms" aria-hidden="true">
      <path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" stroke-linejoin="round" />
    </svg>
  {/each}
</span>

<style>
  .stars { display: inline-flex; gap: calc(var(--sz) * .08); vertical-align: middle; }
  svg { width: var(--sz); height: var(--sz); fill: #e9e3f4; stroke: #d6cde8; stroke-width: 1.4; overflow: visible; }
  svg.on { fill: var(--star); stroke: var(--star-edge); filter: drop-shadow(0 2px 0 var(--star-edge)); }
  svg.on.animate { animation: star-in .55s cubic-bezier(.3, .8, .4, 1.6) both; }
  @keyframes star-in { 0% { transform: scale(0) rotate(-60deg); } 100% { transform: scale(1) rotate(0); } }
</style>
