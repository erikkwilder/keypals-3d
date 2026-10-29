<script lang="ts" module>
  // Custom inputs an area brings (clock hands, shapes...): registered by name, given the item's spec.
  import type { Component } from 'svelte';
  import type { Answer, Item } from '../types';
  export type CustomInputProps = { item: Item; disabled: boolean; compact: boolean; onanswer: (a: Answer) => void; onfirst: () => void };
  const CUSTOM = new Map<string, Component<CustomInputProps>>();
  export function registerInput(name: string, c: Component<CustomInputProps>) { CUSTOM.set(name, c); }
  // the inputs the areas bring
  import CoinTray from './CoinTray.svelte';
  registerInput('coins', CoinTray);
</script>

<script lang="ts">
  // How an item is answered, chosen by its input kind: the number pad (whole numbers check themselves
  // once there are enough digits; decimals and negatives use Check), the fraction pad, choices, a number
  // line, a coordinate grid, or a custom input. What's being typed is shared with the question line
  // through `fill`, so it shows in the gap.
  import NumPad from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  import FractionPad from './FractionPad.svelte';
  import ChoiceInput from './ChoiceInput.svelte';
  import NumberLineInput from './NumberLineInput.svelte';
  import GridInput from './GridInput.svelte';
  type Fill = { kind: 'number'; text: string } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null };
  type Props = { item: Item; disabled?: boolean; compact?: boolean; marked?: { id: string; ok: boolean } | null;
    onanswer: (a: Answer) => void; onfirst?: () => void; fill?: Fill | null; onkey?: (k: string) => void };
  let { item, disabled = false, compact = false, marked = null, onanswer, onfirst = () => {}, fill = $bindable(null), onkey }: Props = $props();

  // ---- whole numbers (and decimals, negatives) ----
  const ans = $derived(item.answer.kind === 'number' ? item.answer.value : 0);
  const whole = $derived(item.answer.kind === 'number' && Number.isInteger(ans) && ans >= 0);
  const digits = $derived(String(ans).length);
  let text = $state('');
  $effect(() => { void item.id; text = ''; fill = item.input === 'number' ? { kind: 'number', text: '' } : item.input === 'fraction' ? { kind: 'fraction', n: '', d: '', focus: 'n' } : null; });
  function digit(d: string) {
    if (disabled) return;
    onfirst(); onkey?.(d);
    if (d === '-' && text) return;
    if (d === '.' && text.includes('.')) return;
    if (whole && text.length >= digits) return;
    text += d; fill = { kind: 'number', text };
    if (whole && text.length === digits) onanswer({ kind: 'number', value: Number(text) });
  }
  function back() { if (disabled) return; text = text.slice(0, -1); fill = { kind: 'number', text }; }
  function submitNumber() { if (!disabled && text && text !== '-' && text !== '.') onanswer({ kind: 'number', value: Number(text) }); }
  function key(e: KeyboardEvent) {
    if (item.input !== 'number' || disabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    const d = /^[0-9]$/.test(e.key) ? e.key : m ? m[1] : null;
    if (d) { e.preventDefault(); digit(d); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); }
    else if ((e.key === '.' || e.key === ',') && !whole) { e.preventDefault(); digit('.'); }
    else if (e.key === '-' && !whole) { e.preventDefault(); digit('-'); }
    else if (e.key === 'Enter') { e.preventDefault(); submitNumber(); }
  }

  // ---- fractions ----
  const fr = $derived(fill?.kind === 'fraction' ? fill : { kind: 'fraction' as const, n: '', d: '', focus: 'n' as const });
  function frChange(v: { n: string; d: string; focus: 'n' | 'd' }) { fill = { kind: 'fraction', ...v }; }
  function frSubmit() { if (fr.n && fr.d && Number(fr.d) > 0) onanswer({ kind: 'fraction', n: Number(fr.n), d: Number(fr.d) }); }
  const Custom = $derived(item.custom ? CUSTOM.get(item.custom.name) : undefined);
</script>

<svelte:window onkeydown={key} />

{#if item.input === 'number'}
  <div class="num">
    <NumPad ondigit={digit} onback={back} {disabled} {compact} extra={whole ? [] : ['.', '-']} />
    {#if !whole}<button class="ok" disabled={!text || disabled} onpointerdown={(e) => { e.preventDefault(); submitNumber(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>{/if}
  </div>
{:else if item.input === 'fraction'}
  <FractionPad n={fr.n} d={fr.d} focus={fr.focus ?? 'n'} {disabled} {compact} onchange={frChange} onsubmit={frSubmit} {onfirst} />
{:else if item.input === 'choice' && item.choices}
  <ChoiceInput choices={item.choices} {disabled} {compact} {marked} onpick={(id) => { onfirst(); onanswer({ kind: 'choice', id }); }} />
{:else if item.input === 'numberline' && item.line}
  <NumberLineInput line={item.line} {disabled} {compact} {onfirst} onanswer={(x) => onanswer({ kind: 'point', x })} />
{:else if item.input === 'grid' && item.grid}
  <GridInput grid={item.grid} {disabled} {compact} {onfirst} onanswer={(x, y) => onanswer({ kind: 'point', x, y })} />
{:else if Custom}
  <Custom {item} {disabled} {compact} {onanswer} {onfirst} />
{/if}

<style>
  .num { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
</style>
