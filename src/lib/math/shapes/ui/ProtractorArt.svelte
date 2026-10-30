<script lang="ts">
  // A clear plastic protractor, drawn inside an SVG at (cx, cy), radius r, turned `turn` degrees
  // (counter-clockwise; 0: its flat edge along the bottom, its outside numbers 0 on the right). The outside
  // row counts 0 to 180 going round to the left; the inside row (`both`) counts the other way, so an angle
  // opening either way can be read from 0. Labels every `every` degrees, ticks every `tick`.
  type Props = { cx: number; cy: number; r: number; turn: number; both?: boolean; every?: number; tick?: number; glow?: boolean };
  let { cx, cy, r, turn, both = true, every = 10, tick = 5, glow = false }: Props = $props();
  const rad = (d: number) => (d * Math.PI) / 180;
  const at = (d: number, rr: number) => [cx + Math.cos(rad(d + turn)) * rr, cy - Math.sin(rad(d + turn)) * rr];
  const ticks = $derived(Array.from({ length: Math.floor(180 / tick) + 1 }, (_, i) => i * tick));
  const labels = $derived(Array.from({ length: Math.floor(180 / every) + 1 }, (_, i) => i * every));
  const arc = (rr: number) => { const a = at(0, rr), b = at(180, rr); return `M${a[0]},${a[1]} A${rr},${rr} 0 0 0 ${b[0]},${b[1]}`; };
  const edge = $derived.by(() => { const a = at(0, r * 1.04), b = at(180, r * 1.04); return { a, b }; });
</script>

<g class="pro" class:glow>
  <path d="{arc(r * 1.04)} L{edge.a[0]},{edge.a[1]} Z" fill="rgba(210, 240, 255, .42)" stroke={glow ? '#ffc93d' : '#5b8fc7'} stroke-width={glow ? r * 0.025 : r * 0.012} />
  <path d={arc(r * 0.62)} fill="none" stroke="#5b8fc7" stroke-width={r * 0.008} opacity=".7" />
  {#each ticks as d (d)}
    {@const long = d % every === 0}
    {@const a = at(d, r * 1.02)}
    {@const b = at(d, r * (long ? 0.9 : 0.95))}
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#2f5f96" stroke-width={long ? r * 0.011 : r * 0.007} />
  {/each}
  {#each labels as d (d)}
    {@const o = at(d, r * 0.82)}
    <text x={o[0]} y={o[1]} class="num" font-size={r * 0.085} text-anchor="middle" dominant-baseline="central" transform="rotate({-(d + turn - 90)} {o[0]} {o[1]})">{d}</text>
    {#if both}
      {@const n = at(d, r * 0.7)}
      <text x={n[0]} y={n[1]} class="num in" font-size={r * 0.07} text-anchor="middle" dominant-baseline="central" transform="rotate({-(d + turn - 90)} {n[0]} {n[1]})">{180 - d}</text>
    {/if}
  {/each}
  <line x1={edge.a[0]} y1={edge.a[1]} x2={edge.b[0]} y2={edge.b[1]} stroke="#2f5f96" stroke-width={r * 0.012} />
  <circle {cx} {cy} r={r * 0.03} fill="#d6335c" stroke="#fff" stroke-width={r * 0.01} />
</g>

<style>
  .num { font-family: var(--font-ui); font-weight: 600; fill: #1d4a80; }
  .num.in { fill: #c4571b; }
  .glow { filter: drop-shadow(0 0 6px rgba(255, 201, 61, .9)); }
</style>
