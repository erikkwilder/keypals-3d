<script lang="ts">
  // A fact as a picture of dots, drawn the way its trick works: doubles as two rows, tens as bars of
  // ten, fives as half of the tens, fours as a double that's doubled again. Times 1 is one row, and
  // times 0 is an empty plate.
  import { trickFor } from '../course';
  import type { Fact } from '../facts';

  type Props = { fact: Fact; size?: number };
  let { fact, size = 220 }: Props = $props();
  const op = $derived(fact.op ?? 'x');
  // plus and minus: dots in rows of ten (a ten frame), the second number pink, or crossed out when taken
  // away; divide: the dots dealt into equal rows, one row lit up
  const tens = $derived.by(() => {
    if (op === '+') return Array.from({ length: fact.a + fact.b }, (_, i) => (i < fact.a ? 'a' : 'b'));
    if (op === '-') return Array.from({ length: fact.a }, (_, i) => (i < fact.a - fact.b ? 'a' : 'gone'));
    return [];
  });
  const tcell = $derived(Math.max(10, Math.floor((size - 8) / 10)));
  const tr = $derived(trickFor(fact));
  const a = $derived(tr.a);
  // rows of `a` dots; for the tens it's `a` bars of ten (drawn as columns)
  const layout = $derived.by(() => {
    switch (tr.table) {
      case 2: return { rows: 2, cols: a, fade: 0, split: 1 };
      case 4: return { rows: 4, cols: a, fade: 0, split: 2 };
      case 5: return { rows: 10, cols: a, fade: 5, split: 5 };
      case 10: return { rows: 10, cols: a, fade: 0, split: 0, bars: true };
      case 1: return { rows: 1, cols: a, fade: 0, split: 0 };
      default: return { rows: 0, cols: 0, fade: 0, split: 0 };
    }
  });
  const gap = 4;
  const cell = $derived(Math.max(6, Math.min(26, Math.floor((size - 8) / Math.max(layout.cols, layout.rows, 1)))));
  const w = $derived(Math.max(1, layout.cols) * cell + 8);
  const h = $derived(Math.max(1, layout.rows) * cell + (layout.split ? gap * 2 : 0) + 8);
  const COLORS = ['#7c5cf5', '#ef6fa6', '#3fa7e0', '#2fa898'];
</script>

{#if op === '+' || op === '-'}
  {@const rows = Math.max(1, Math.ceil(tens.length / 10))}
  <svg viewBox="0 0 {10 * tcell + 8} {rows * tcell + 8 + (rows > 1 ? 4 : 0)}" width={10 * tcell + 8} height={rows * tcell + 8} aria-hidden="true">
    {#each tens as k, i}
      {@const cx = 4 + (i % 10) * tcell + tcell / 2 + ((i % 10) >= 5 ? 2 : 0)}
      {@const cy = 4 + Math.floor(i / 10) * (tcell + 4) + tcell / 2}
      <circle {cx} {cy} r={tcell * 0.36} fill={k === 'a' ? '#7c5cf5' : k === 'b' ? '#ef6fa6' : '#e6e0f2'} />
      {#if k === 'gone'}<path d="M{cx - tcell * 0.3} {cy - tcell * 0.3}L{cx + tcell * 0.3} {cy + tcell * 0.3}M{cx + tcell * 0.3} {cy - tcell * 0.3}L{cx - tcell * 0.3} {cy + tcell * 0.3}" stroke="#ef6fa6" stroke-width="2.4" stroke-linecap="round" />{/if}
    {/each}
  </svg>
{:else if op === '/'}
  {@const q = fact.b ? fact.a / fact.b : 0}
  {@const c = Math.max(8, Math.min(24, Math.floor((size - 8) / Math.max(q, fact.b, 1))))}
  <svg viewBox="0 0 {Math.max(1, q) * c + 8} {fact.b * c + 8}" width={Math.max(1, q) * c + 8} height={fact.b * c + 8} aria-hidden="true">
    {#each Array(fact.b) as _, r}
      {#if r === 0}<rect x="1" y={3 + r * c} width={Math.max(1, q) * c + 6} height={c + 2} rx="6" fill="#fff3c4" />{/if}
      {#each Array(q) as _, k}<circle cx={4 + k * c + c / 2} cy={4 + r * c + c / 2} r={c * 0.36} fill={r === 0 ? '#ef7d2b' : '#2fa898'} />{/each}
    {/each}
  </svg>
{:else if tr.table === 0}
  <svg viewBox="0 0 120 70" width={size * 0.55} height={size * 0.32} aria-hidden="true">
    <ellipse cx="60" cy="38" rx="52" ry="24" fill="#fff" stroke="#d9cff0" stroke-width="3" />
    <ellipse cx="60" cy="38" rx="34" ry="14" fill="none" stroke="#ece6f6" stroke-width="2" />
  </svg>
{:else}
  <svg viewBox="0 0 {w} {h}" width={Math.min(size, w)} height={Math.min(size, w) * (h / w)} aria-hidden="true">
    {#each Array(layout.rows) as _, r}
      {@const y = 4 + r * cell + cell / 2 + (layout.split && r >= layout.split ? gap * 2 : 0)}
      {#each Array(layout.cols) as _, c}
        {@const faded = layout.fade > 0 && r >= layout.fade}
        <circle cx={4 + c * cell + cell / 2} cy={y} r={cell * 0.36}
          fill={faded ? '#e6e0f2' : layout.bars ? COLORS[c % 2] : COLORS[layout.split && r >= layout.split ? 1 : 0]} />
      {/each}
    {/each}
    {#if layout.split}
      <line x1="2" x2={w - 2} y1={4 + layout.split * cell + gap} y2={4 + layout.split * cell + gap} stroke="#cbbfe6" stroke-width="2" stroke-dasharray="4 4" />
    {/if}
  </svg>
{/if}
