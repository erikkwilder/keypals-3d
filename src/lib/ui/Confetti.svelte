<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  type Props = { burst: number; count?: number; x?: number; y?: number; spread?: number; colors?: string[] };
  let { burst, count = 36, x = 50, y = 55, spread = 1, colors = ['#ff8fbf', '#b79cf2', '#79c4f2', '#4fcf9f', '#ffd95e', '#ffb3d1'] }: Props = $props();
  type Piece = { id: number; dx: number; dy: number; rot: number; c: string; w: number; h: number; round: boolean; delay: number };
  let pieces = $state<Piece[]>([]);
  let n = 0;
  $effect(() => {
    if (!burst) return;
    const batch: Piece[] = Array.from({ length: count }, () => {
      const a = Math.random() * Math.PI * 2, d = (90 + Math.random() * 260) * spread;
      return { id: n++, dx: Math.cos(a) * d, dy: Math.sin(a) * d - 120 * spread, rot: Math.random() * 720 - 360, c: colors[Math.floor(Math.random() * colors.length)], w: 8 + Math.random() * 8, h: 6 + Math.random() * 10, round: Math.random() < 0.3, delay: Math.random() * 80 };
    });
    untrack(() => (pieces = [...pieces, ...batch]));
    const ids = new Set(batch.map(b => b.id));
    timers.push(setTimeout(() => (pieces = pieces.filter(p => !ids.has(p.id))), 1700));
  });
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));
</script>

<div class="confetti" aria-hidden="true">
  {#each pieces as p (p.id)}
    <i style:left="{x}%" style:top="{y}%" style:background={p.c} style:width="{p.w}px" style:height="{p.h}px" style:border-radius={p.round ? '50%' : '3px'}
      style:--dx="{p.dx}px" style:--dy="{p.dy}px" style:--rot="{p.rot}deg" style:animation-delay="{p.delay}ms"></i>
  {/each}
</div>

<style>
  .confetti { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 30; }
  i { position: absolute; display: block; animation: conf 1.5s cubic-bezier(.2, .7, .3, 1) forwards; }
  @keyframes conf {
    0% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
    70% { opacity: 1; }
    100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy) + 260px)) rotate(var(--rot)); opacity: 0; }
  }
</style>
