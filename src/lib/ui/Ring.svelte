<script lang="ts">
  type Props = { value: number; size?: number; color?: string; track?: string; width?: number };
  let { value, size = 32, color = 'var(--primary)', track = '#e8e1f5', width = 5 }: Props = $props();
  const r = $derived((size - width) / 2);
  const c = $derived(2 * Math.PI * r);
</script>

<svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true" style="flex:none">
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={track} stroke-width={width} />
  <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke={color} stroke-width={width} stroke-linecap="round"
    stroke-dasharray={c} stroke-dashoffset={c * (1 - Math.max(0, Math.min(1, value)))} transform="rotate(-90 {size / 2} {size / 2})" style="transition: stroke-dashoffset .6s ease" />
  {#if value >= 1}<path d="M{size * .32},{size * .52} l{size * .12},{size * .12} l{size * .24},{size * -.26}" fill="none" stroke={color} stroke-width={width * .8} stroke-linecap="round" stroke-linejoin="round" />{/if}
</svg>
