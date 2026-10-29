<script lang="ts">
  // A question line from its parts: numbers, fractions, signs, painted fraction pictures and the gap
  // where the answer goes. What's being typed shows in the gap (a number, or a fraction's top and bottom);
  // a question with no gap of its own (a picture to name) gets one at the end while it's being answered.
  import type { Part } from '../types';
  import Frac from './Frac.svelte';
  import FractionPic from './FractionPic.svelte';
  import BlocksPic from './BlocksPic.svelte';
  type Fill = { kind: 'number'; text: string } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null };
  type Props = { parts: Part[]; fill?: Fill | null; size?: number; picSize?: number; done?: boolean };
  let { parts, fill = null, size = 56, picSize = 150, done = false }: Props = $props();
  const gap = $derived(parts.some(p => p.t === 'blank' || (p.t === 'frac' && (p.n === null || p.d === null))));
</script>

<span class="sp" class:done style:--fs="{size}px">
  {#each parts as p, i (i)}
    {#if p.t === 'text'}<span class="tx">{p.s}</span>
    {:else if p.t === 'num'}<span class="n">{p.n >= 1000 ? p.n.toLocaleString('en-US') : p.n}</span>
    {:else if p.t === 'op'}<span class="op" class:word={p.s.length > 1}>{p.s}</span>
    {:else if p.t === 'pic'}<FractionPic pic={p.pic} size={picSize} />
    {:else if p.t === 'blocks'}<BlocksPic b={p.b} size={picSize} />
    {:else if p.t === 'frac'}
      <Frac n={p.n ?? (fill?.kind === 'number' ? fill.text : null)} d={p.d ?? (fill?.kind === 'number' ? fill.text : null)} size={size * 0.82} focus={(p.n === null || p.d === null) && !done ? (p.n === null ? 'n' : 'd') : null} />
    {:else if p.t === 'blank'}
      {#if fill?.kind === 'fraction'}<Frac n={fill.n} d={fill.d} size={size * 0.82} focus={done ? null : fill.focus} />
      {:else if done && !fill}<span class="n">?</span>
      {:else}<span class="box">{fill?.kind === 'number' ? fill.text : ''}</span>{/if}
    {/if}
  {/each}
  {#if !gap && fill}
    <span class="op">=</span>
    {#if fill.kind === 'fraction'}<Frac n={fill.n} d={fill.d} size={size * 0.82} focus={done ? null : fill.focus} />
    {:else}<span class="box">{fill.text}</span>{/if}
  {/if}
</span>

<style>
  .sp { display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: calc(var(--fs) * .28); font: 600 var(--fs)/1 var(--font-ui); color: var(--ink); }
  .op { color: var(--primary); }
  .op.word { font-size: calc(var(--fs) * .5); color: var(--muted); }
  .tx { font-size: calc(var(--fs) * .5); }
  .box { min-width: calc(var(--fs) * 1.4); padding: 4px 12px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; min-height: calc(var(--fs) * 1.1); display: grid; place-items: center; }
</style>
