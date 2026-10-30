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
  // through `fill`, so it shows in the gap: the box holds exactly what it shows. A wrong answer (when
  // `onanswer` says false) stays in the box in red for a moment, then the box clears for another go.
  // Choices that are all numbers (or all fractions) keep the pad under them: type one and it's picked.
  import { onDestroy } from 'svelte';
  import NumPad, { WRONG_MS } from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  import FractionPad from './FractionPad.svelte';
  import ChoiceInput from './ChoiceInput.svelte';
  import NumberLineInput from './NumberLineInput.svelte';
  import GridInput from './GridInput.svelte';
  import { choiceFor, choiceFractions, typedAs, typedChoice } from '../choices';
  type Fill = { kind: 'number'; text: string; bad?: boolean } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null; bad?: boolean };
  type Props = { item: Item; disabled?: boolean; compact?: boolean; marked?: { id: string; ok: boolean } | null;
    /** false: that was wrong (it shows in red, then clears) */
    onanswer: (a: Answer) => unknown; onfirst?: () => void; fill?: Fill | null; onkey?: (k: string) => void };
  let { item, disabled = false, compact = false, marked = null, onanswer, onfirst = () => {}, fill = $bindable(null), onkey }: Props = $props();

  /** what's typed with: the number pad, the fraction pad (choices of numbers or fractions too), or nothing */
  const pad = $derived<'number' | 'fraction' | null>(item.input === 'number' || item.input === 'fraction' ? item.input : typedAs(item));
  const choice = $derived(item.input === 'choice');
  const empty = (): Fill | null => (pad === 'number' ? { kind: 'number', text: '' } : pad === 'fraction' ? { kind: 'fraction', n: '', d: '', focus: 'n' } : null);
  let badTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => { void item.id; clearTimeout(badTimer); fill = empty(); });
  onDestroy(() => clearTimeout(badTimer));
  const bad = $derived(!!fill?.bad);
  /** Send an answer; a wrong one stays in the box, red, then the box clears by itself. */
  function send(a: Answer) {
    if (onanswer(a) !== false || !fill) return;
    if (fill.kind === 'number' ? !fill.text : !fill.n && !fill.d) return;
    fill = { ...fill, bad: true };
    clearTimeout(badTimer);
    badTimer = setTimeout(() => { if (fill?.bad) fill = empty(); }, WRONG_MS);
  }
  /** Typing over a wrong answer starts a new one. */
  function fresh() { if (fill?.bad) { clearTimeout(badTimer); fill = empty(); } }

  // ---- whole numbers (and decimals, negatives) ----
  const ans = $derived(item.answer.kind === 'number' ? item.answer.value : 0);
  const whole = $derived(choice || (item.answer.kind === 'number' && Number.isInteger(ans) && ans >= 0));
  const digits = $derived(String(ans).length);
  const text = $derived(fill?.kind === 'number' ? fill.text : '');
  function digit(d: string) {
    if (disabled || pad !== 'number') return;
    fresh();
    onfirst(); onkey?.(d);
    let t = text;
    if (d === '-' && t) return;
    if (d === '.' && t.includes('.')) return;
    // (a full box has just been checked: whatever comes next starts a new answer)
    if (!choice && whole && t.length >= digits) t = '';
    t += d; fill = { kind: 'number', text: t };
    if (choice) pickTyped(false);
    else if (whole && t.length === digits) send({ kind: 'number', value: Number(t) });
  }
  function back() { if (disabled || pad !== 'number') return; if (bad) { fresh(); return; } fill = { kind: 'number', text: text.slice(0, -1) }; }
  function submitNumber() {
    if (disabled || bad || !text || text === '-' || text === '.') return;
    if (choice) pickTyped(true); else send({ kind: 'number', value: Number(text) });
  }
  /** A typed number among choices: picks its choice once it can't be any other (or on Enter); a number no
   *  choice starts with is a wrong answer. */
  function pickTyped(enter: boolean) {
    const r = typedChoice(item, text, enter);
    if (r === 'wait') return;
    const id = r === 'pick' ? choiceFor(item, { kind: 'number', value: Number(text) }) : null;
    send(id ? { kind: 'choice', id } : { kind: 'number', value: Number(text) });
  }
  function key(e: KeyboardEvent) {
    if (pad !== 'number' || disabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    const d = /^[0-9]$/.test(e.key) ? e.key : m ? m[1] : null;
    if (d) { e.preventDefault(); digit(d); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); }
    else if ((e.key === '.' || e.key === ',') && !whole) { e.preventDefault(); digit('.'); }
    else if (e.key === '-' && !whole) { e.preventDefault(); digit('-'); }
    else if (e.key === 'Enter') { e.preventDefault(); submitNumber(); }
  }

  // ---- fractions ----
  const fr = $derived(fill?.kind === 'fraction' ? fill : { kind: 'fraction' as const, n: '', d: '', focus: 'n' as const, bad: false });
  function frChange(v: { n: string; d: string; focus: 'n' | 'd' }) { clearTimeout(badTimer); fill = { kind: 'fraction', ...v }; }
  function frSubmit() {
    if (bad || !fr.n || !fr.d || !(Number(fr.d) > 0)) return;
    const a: Answer = { kind: 'fraction', n: Number(fr.n), d: Number(fr.d) };
    const id = choice ? choiceFor(item, a) : null;
    send(id ? { kind: 'choice', id } : a);
  }
  // what the fraction pad goes by to know when a box is finished: the answer, or every choice
  const want = $derived(item.answer.kind === 'fraction' ? { n: item.answer.n, d: item.answer.d } : pad === 'fraction' ? choiceFractions(item) : null);
  // how the fraction pad works, shown the first few fraction questions on this device
  const HINT_KEY = 'kp-frac-hint';
  let hint = $state(false);
  $effect(() => {
    void item.id;
    if (item.input !== 'fraction') { hint = false; return; }
    try { const seen = Number(localStorage.getItem(HINT_KEY) ?? 0); hint = seen < 6; localStorage.setItem(HINT_KEY, String(seen + 1)); } catch { hint = true; }
  });
  const Custom = $derived(item.custom ? CUSTOM.get(item.custom.name) : undefined);
</script>

<svelte:window onkeydown={key} />

{#if item.input === 'choice' && item.choices}
  <div class="pick" class:compact>
    <ChoiceInput choices={item.choices} {disabled} {compact} slim={!!pad} {marked} onpick={(id) => { fresh(); onfirst(); send({ kind: 'choice', id }); }} />
    {#if pad === 'number'}
      <NumPad ondigit={digit} onback={back} {disabled} {compact} />
    {:else if pad === 'fraction'}
      <FractionPad n={bad ? '' : fr.n} d={bad ? '' : fr.d} focus={bad ? 'n' : (fr.focus ?? 'n')} {want} {disabled} {compact} onchange={frChange} onsubmit={frSubmit} {onfirst} />
    {/if}
  </div>
{:else if item.input === 'number'}
  <div class="num">
    <NumPad ondigit={digit} onback={back} {disabled} {compact} extra={whole ? [] : ['.', '-']} />
    {#if !whole}<button class="ok" disabled={!text || bad || disabled} onpointerdown={(e) => { e.preventDefault(); submitNumber(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>{/if}
  </div>
{:else if item.input === 'fraction'}
  <!-- typing over a wrong answer starts a new one: the pad sees empty boxes while it's red -->
  <FractionPad n={bad ? '' : fr.n} d={bad ? '' : fr.d} focus={bad ? 'n' : (fr.focus ?? 'n')} {want} {hint} {disabled} {compact} onchange={frChange} onsubmit={frSubmit} {onfirst} />
{:else if item.input === 'numberline' && item.line}
  <NumberLineInput line={item.line} {disabled} {compact} {onfirst} onanswer={(x) => onanswer({ kind: 'point', x })} />
{:else if item.input === 'grid' && item.grid}
  <GridInput grid={item.grid} {disabled} {compact} {onfirst} onanswer={(x, y) => onanswer({ kind: 'point', x, y })} />
{:else if Custom}
  <Custom {item} {disabled} {compact} {onanswer} {onfirst} />
{/if}

<style>
  .num { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
  .pick { display: flex; flex-direction: column; gap: 12px; width: 100%; }
  .pick.compact { gap: 8px; }
  /* under choices on a phone the pad's keys are a little shorter, so the question keeps its room */
  .pick.compact :global(.pad.compact .k) { height: clamp(40px, 5.6vh, 50px); }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
</style>
