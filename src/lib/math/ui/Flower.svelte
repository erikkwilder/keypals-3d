<script lang="ts">
  // A fact's stage in the garden: nothing (a patch of soil), a sprout, a bud, or a flower in bloom.
  type Props = { stage: 0 | 1 | 2 | 3; size?: number; hue?: number };
  let { stage, size = 28, hue = 300 }: Props = $props();
</script>

<svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
  {#if stage === 0}
    <ellipse cx="20" cy="30" rx="9" ry="3.2" fill="#d9cfc2" />
  {:else if stage === 1}
    <ellipse cx="20" cy="33" rx="8" ry="2.6" fill="#d9cfc2" />
    <path d="M20 33V22" stroke="#4fae6e" stroke-width="2.6" stroke-linecap="round" />
    <path d="M20 25c-5 0-8-3-8-7 5 0 8 3 8 7zM20 23c4 0 7-3 7-6-4 0-7 2-7 6z" fill="#6cc98a" />
  {:else if stage === 2}
    <ellipse cx="20" cy="34" rx="8" ry="2.6" fill="#d9cfc2" />
    <path d="M20 34V18" stroke="#4fae6e" stroke-width="2.6" stroke-linecap="round" />
    <path d="M20 28c-4 0-7-2-7-5 4 0 7 2 7 5z" fill="#6cc98a" />
    <path d="M20 8c4 3 5 7 4 10-1 2-3 3-4 3s-3-1-4-3c-1-3 0-7 4-10z" fill="hsl({hue} 70% 72%)" stroke="hsl({hue} 55% 58%)" stroke-width="1.2" />
  {:else}
    <path d="M20 36V22" stroke="#4fae6e" stroke-width="2.6" stroke-linecap="round" />
    <path d="M20 31c-4 0-7-2-7-5 4 0 7 2 7 5z" fill="#6cc98a" />
    {#each [0, 72, 144, 216, 288] as a}
      <ellipse cx="20" cy="9.5" rx="5" ry="7" fill="hsl({hue} 72% 74%)" stroke="hsl({hue} 55% 60%)" stroke-width="1" transform="rotate({a} 20 17)" />
    {/each}
    <circle cx="20" cy="17" r="4.6" fill="#ffd34d" stroke="#e8b52a" stroke-width="1" />
  {/if}
</svg>
