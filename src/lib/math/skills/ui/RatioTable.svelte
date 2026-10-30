<script lang="ts">
  // A ratio table on a wooden tray: a row for each fruit (its painted picture at the start), a column for
  // each batch, and one gap that glows. Type the missing number (the pad or the keys): it checks itself once
  // it has as many digits as the answer; a wrong one goes red, then clears for another go.
  import { onDestroy } from 'svelte';
  import NumPad, { WRONG_MS } from '../../ui/NumPad.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import type { Answer } from '../types';
  import type { TableSpec } from '../ratios';
  import { FRUIT } from '../ratioPic';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const spec = $derived(item.custom!.spec as TableSpec);
  const want = $derived(item.answer.kind === 'number' ? item.answer.value : 0);
  let text = $state('');
  let bad = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => { void item.id; text = ''; bad = false; clearTimeout(timer); });
  onDestroy(() => clearTimeout(timer));
  const send = (a: Answer) => (onanswer as (a: Answer) => unknown)(a);

  function check() {
    if (!text || disabled) return;
    if (send({ kind: 'number', value: Number(text) }) === false) {
      bad = true; clearTimeout(timer);
      timer = setTimeout(() => { bad = false; text = ''; }, WRONG_MS);
    }
  }
  function digit(d: string) {
    if (disabled) return;
    if (bad) { clearTimeout(timer); bad = false; text = ''; }
    onfirst();
    if (text.length >= String(want).length) text = '';
    text += d;
    if (text.length === String(want).length) check();
  }
  function back() { if (bad) { bad = false; text = ''; return; } text = text.slice(0, -1); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    const d = /^[0-9]$/.test(e.key) ? e.key : m ? m[1] : null;
    if (d) { e.preventDefault(); digit(d); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="rt" class:compact>
  <div class="tray" style:background-image="url({base}learn/tray.webp)" style:--cols={spec.cols.length}>
    {#each [0, 1] as row (row)}
      <span class="head"><img src="{base}math/ratios/fruit/{spec.fruits[row]}.webp" alt="" /><small>{FRUIT[spec.fruits[row]].many}</small></span>
      {#each spec.cols as c, ci (ci)}
        {@const gap = spec.gap[0] === ci && spec.gap[1] === row}
        {#if gap}
          <span class="cell gap" class:bad class:typed={!!text} data-drop="num">{text || '?'}</span>
        {:else}
          <span class="cell" style:background-image="url({base}learn/tag.webp)">{c[row]}</span>
        {/if}
      {/each}
    {/each}
  </div>
  <NumPad ondigit={digit} onback={back} {disabled} {compact} />
</div>

<style>
  .rt { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .tray { display: grid; grid-template-columns: auto repeat(var(--cols), minmax(64px, 92px)); align-items: center; gap: 10px 12px; padding: 18px 26px 20px; background-size: 100% 100%; filter: drop-shadow(0 6px 10px rgba(80, 50, 20, .25)); }
  .head { display: flex; align-items: center; gap: 6px; padding-right: 6px; }
  .head img { width: 46px; height: 46px; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(60, 30, 10, .3)); }
  .head small { font: 800 13px var(--font-body); color: #fff6e4; text-shadow: 0 1px 2px rgba(60, 30, 10, .6); text-transform: capitalize; }
  .cell { display: grid; place-items: center; height: 54px; background-size: 100% 100%; font: 600 28px var(--font-ui); color: #5b3416; }
  .gap { border-radius: 16px; background: #fff; color: var(--muted); box-shadow: inset 0 0 0 4px #ffb347, 0 0 0 5px #fff1d6, 0 0 22px rgba(255, 179, 71, .8); animation: glow 1.3s ease-in-out infinite; }
  .gap.typed { color: var(--ink); }
  .gap.bad { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 6px #ffe0e8; animation: nope .4s ease; }
  @keyframes glow { 50% { box-shadow: inset 0 0 0 4px #ffb347, 0 0 0 7px #fff1d6, 0 0 32px rgba(255, 179, 71, 1); } }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .compact .tray { grid-template-columns: auto repeat(var(--cols), minmax(46px, 64px)); gap: 6px 6px; padding: 12px 14px 14px; }
  .compact .head small { display: none; }
  .compact .head img { width: 36px; height: 36px; }
  .compact .cell { height: 42px; font-size: 22px; }
</style>
