<script lang="ts">
  // The fraction pad: type the top number and it moves to the bottom by itself; type the bottom and it
  // checks by itself. So 3/4 is two taps (or drag a number straight into either box). A two-digit
  // number waits for its second digit when the answer has one (12/5), and a bottom 1 waits a moment in
  // case it's the start of 10 or 12. Tap a box in the question (or Top, Bottom, the arrow keys) to fix
  // it; Enter checks straight away.
  import { onDestroy } from 'svelte';
  import NumPad from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  type Props = { n: string; d: string; focus: 'n' | 'd'; disabled?: boolean; compact?: boolean;
    /** the right answer: only its number of digits is used, to know when a box is finished */
    want?: { n: number; d: number } | null;
    /** show how it works (the first few fraction questions) */
    hint?: boolean;
    onchange: (v: { n: string; d: string; focus: 'n' | 'd' }) => void; onsubmit: () => void; onfirst?: () => void };
  let { n, d, focus, disabled = false, compact = false, want = null, hint = false, onchange, onsubmit, onfirst }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { clearTimeout(timer); timer = undefined; };
  onDestroy(clear);
  $effect(() => { if (disabled) clear(); });

  function digit(x: string, slot: 'n' | 'd' = focus) {
    if (disabled) return;
    onfirst?.();
    clear();
    if (slot === 'n') {
      const nn = n.length >= 2 || (n === '0') ? x : n + x;
      onchange({ n: nn, d, focus: 'n' });
      afterTop(nn, d);
    } else {
      const dd = d.length >= 2 || d === '0' ? x : d + x;
      onchange({ n, d: dd, focus: 'd' });
      afterBottom(n, dd);
    }
  }
  /** The top is done: on to the bottom (or check, if the bottom's already there). */
  function afterTop(nn: string, dd: string) {
    const w = want ? String(want.n) : '';
    const done = () => { clear(); if (dd && dd !== '0' && finished(dd)) later(nn, dd, 250); else onchange({ n: nn, d: dd, focus: 'd' }); };
    if (nn.length >= 2) return done();
    if (w.length === 2 && nn === w[0]) return; // the answer's top has two digits: wait for the second
    timer = setTimeout(done, 380);
  }
  /** Is this a whole bottom number (not the start of a two-digit one)? */
  function finished(dd: string) {
    const w = want ? String(want.d) : '';
    if (dd.length >= 2) return true;
    if (w.length === 2 && dd === w[0]) return false;
    return true;
  }
  function afterBottom(nn: string, dd: string) {
    if (dd === '0' || !finished(dd)) return;
    if (!nn) { timer = setTimeout(() => onchange({ n: nn, d: dd, focus: 'n' }), 300); return; }
    // a lone 1 could be the start of 10 or 12: a moment longer
    later(nn, dd, dd === '1' && want && want.d !== 1 ? 1100 : 300);
  }
  function later(nn: string, dd: string, ms: number) {
    clear();
    timer = setTimeout(() => { if (!disabled && nn && dd && dd !== '0') onsubmit(); }, ms);
  }
  function back() {
    if (disabled) return;
    clear();
    if (focus === 'd' && d) onchange({ n, d: d.slice(0, -1), focus });
    else if (focus === 'd') onchange({ n, d, focus: 'n' });
    else onchange({ n: n.slice(0, -1), d, focus });
  }
  function go(f: 'n' | 'd') { clear(); onchange({ n, d, focus: f }); }
  const ready = $derived(!!n && !!d && d !== '0');
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key === '/' || e.key === 'ArrowDown' || e.key === 'Tab') { e.preventDefault(); go('d'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go('n'); }
    else if (e.key === 'Enter') { e.preventDefault(); clear(); if (ready) onsubmit(); else if (n && focus === 'n') go('d'); }
  }
  /** a number dragged into the top or bottom box */
  function drop(x: string, slot: string) { digit(x, slot === 'd' ? 'd' : slot === 'n' ? 'n' : focus); }
</script>

<svelte:window onkeydown={key} />

<div class="fpad" class:compact>
  {#if hint}
    <p class="hint"><Icon name="bulb" size={20} /><span>Type the top, then the bottom. {compact ? 'Or drag a number into a box.' : 'Arrow keys and Enter work too, or drag a number into a box.'}</span></p>
  {/if}
  <div class="row">
    <button class="mv" class:on={focus === 'n'} onpointerdown={(e) => { e.preventDefault(); go('n'); }} tabindex="-1"><Icon name="up" size={28} /><span>Top</span>{#if !compact}<kbd>↑</kbd>{/if}</button>
    <button class="mv" class:on={focus === 'd'} onpointerdown={(e) => { e.preventDefault(); go('d'); }} tabindex="-1"><Icon name="down" size={28} /><span>Bottom</span>{#if !compact}<kbd>↓</kbd>{/if}</button>
    <button class="ok" class:ready disabled={!ready || disabled} onpointerdown={(e) => { e.preventDefault(); clear(); if (ready && !disabled) onsubmit(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span>{#if !compact}<kbd>enter</kbd>{/if}</button>
  </div>
  <NumPad ondigit={(x) => digit(x)} onback={back} ondrop={drop} {disabled} {compact} />
</div>

<style>
  .fpad { display: flex; flex-direction: column; gap: 10px; width: min(1000px, 100%); margin: 0 auto; }
  .hint { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 auto; padding: 4px 14px; border-radius: 999px; background: #fff7dc; color: #6b5200; font: 700 14px/1.3 var(--font-body); box-shadow: inset 0 0 0 2px #ffe28a; text-align: center; }
  .row { display: flex; gap: 10px; justify-content: center; }
  .mv, .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #ece6f6; border-radius: 16px; padding: 6px 16px 6px 10px; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 4px 0 #d9cff0; font: 600 18px var(--font-ui); color: var(--ink2); cursor: pointer; touch-action: manipulation; }
  .mv.on { background: linear-gradient(#efe9ff, #e2d8ff); border-color: #a98cff; color: var(--ink); }
  kbd { font: 700 11px var(--font-body); padding: 1px 6px; border-radius: 6px; background: rgba(120, 90, 190, .1); color: var(--muted); }
  .ok { margin-left: 8px; color: var(--muted); }
  .ok.ready { background: linear-gradient(#7ee0a8, #3fbf7a); border-color: #3fbf7a; color: #fff; box-shadow: 0 4px 0 #2f9a60; }
  .ok.ready kbd { background: rgba(255, 255, 255, .25); color: #fff; }
  .ok:disabled { opacity: .6; cursor: default; }
  .compact .mv, .compact .ok { padding: 4px 10px 4px 6px; font-size: 15px; }
  .compact .hint { font-size: 12.5px; padding: 3px 10px; }
</style>
