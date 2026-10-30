<script lang="ts">
  // A question line from its parts: numbers, fractions, signs, painted fraction pictures and the gap
  // where the answer goes. What's being typed shows in the gap (a number, or a fraction's top and bottom);
  // a question with no gap of its own (a picture to name) gets one at the end while it's being answered.
  // The gaps take numbers dragged from the pad, and (with `onpick`) a fraction's top or bottom box can be
  // tapped to type in it. A wrong answer (`bad`) shows in red for a moment before the box clears.
  import type { Part } from '../types';
  import Frac from './Frac.svelte';
  import FractionPic from './FractionPic.svelte';
  import BlocksPic from './BlocksPic.svelte';
  import MoneyPic from './MoneyPic.svelte';
  import MeasurePic from './MeasurePic.svelte';
  import ShapePic from '../../shapes/ui/ShapePic.svelte';
  import { moneyText } from '../decimals';
  type Fill = { kind: 'number'; text: string; bad?: boolean } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null; bad?: boolean };
  type Props = { parts: Part[]; fill?: Fill | null; size?: number; picSize?: number; done?: boolean; onpick?: ((w: 'n' | 'd') => void) | null };
  let { parts, fill = null, size = 56, picSize = 150, done = false, onpick = null }: Props = $props();
  // only a live answer takes drops and taps
  const live = $derived(!!fill && !done);
  const fracDrop = $derived(live && fill?.kind === 'fraction' ? { n: 'n', d: 'd' } : null);
  const bad = $derived(!!fill?.bad && !done);
  const gap = $derived(parts.some(p => p.t === 'blank' || (p.t === 'frac' && (p.n === null || p.d === null))));
</script>

<span class="sp" class:done style:--fs="{size}px">
  {#each parts as p, i (i)}
    {#if p.t === 'text'}<span class="tx">{p.s}</span>
    {:else if p.t === 'num'}<span class="n">{p.n >= 1000 ? p.n.toLocaleString('en-US') : p.n}</span>
    {:else if p.t === 'op'}<span class="op" class:word={p.s.length > 1}>{p.s}</span>
    {:else if p.t === 'pic'}{#if p.pic.kind === 'coins' || p.pic.kind === 'grid'}<MoneyPic pic={p.pic} size={picSize} />{:else}<FractionPic pic={p.pic} size={picSize} />{/if}
    {:else if p.t === 'money'}<span class="n money">{moneyText(p.cents, p.dollars)}</span>
    {:else if p.t === 'blocks'}<BlocksPic b={p.b} size={picSize} />
    {:else if p.t === 'meas'}<MeasurePic m={p.m} size={picSize} />
    {:else if p.t === 'fig'}<ShapePic fig={p.fig} size={picSize * 1.25} />
    {:else if p.t === 'frac'}
      <Frac n={p.n ?? (fill?.kind === 'number' ? fill.text : null)} d={p.d ?? (fill?.kind === 'number' ? fill.text : null)} size={size * 0.82} focus={(p.n === null || p.d === null) && !done && !bad ? (p.n === null ? 'n' : 'd') : null} bad={bad ? (p.n === null ? 'n' : p.d === null ? 'd' : null) : null}
        drop={live && fill?.kind === 'number' ? (p.n === null ? { n: 'num' } : p.d === null ? { d: 'num' } : null) : null} />
    {:else if p.t === 'blank'}
      {#if fill?.kind === 'fraction'}<Frac n={fill.n} d={fill.d} size={size * 0.82} focus={done || bad ? null : fill.focus} bad={bad ? 'both' : null} drop={fracDrop} {onpick} />
      {:else if done && !fill}<span class="n">?</span>
      {:else}<span class="box" class:bad data-drop={live ? 'num' : undefined}>{fill?.kind === 'number' ? fill.text : ''}</span>{/if}
    {/if}
  {/each}
  {#if !gap && fill}
    <span class="op">=</span>
    {#if fill.kind === 'fraction'}<Frac n={fill.n} d={fill.d} size={size * 0.82} focus={done || bad ? null : fill.focus} bad={bad ? 'both' : null} drop={fracDrop} {onpick} />
    {:else}<span class="box" class:bad data-drop={live ? 'num' : undefined}>{fill.text}</span>{/if}
  {/if}
</span>

<style>
  .sp { display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: calc(var(--fs) * .28); font: 600 var(--fs)/1 var(--font-ui); color: var(--ink); }
  .op { color: var(--primary); }
  .money { color: #b7791f; }
  .op.word { font-size: calc(var(--fs) * .5); color: var(--muted); }
  .tx { font-size: calc(var(--fs) * .5); }
  .box.bad { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 6px #ffe0e8; animation: nope .4s ease; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .box { min-width: calc(var(--fs) * 1.4); padding: 4px 12px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; min-height: calc(var(--fs) * 1.1); display: grid; place-items: center; }
</style>
