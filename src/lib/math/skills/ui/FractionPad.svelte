<script lang="ts">
  // The fraction pad: type the top number and it moves to the bottom by itself; type the bottom and it
  // checks by itself, the way the number pad checks once there are as many digits as the answer. So 1/2 is
  // "1, 2" (or drag a number straight into either box). A top that can still grow into the answer's top
  // waits for its next digit (the 1 of 12/5); the bottom waits the same way, for the answer's bottom or the
  // one that makes an equal fraction with the top typed (10/20 for 1/2: go back up with the arrow to make
  // the top 10). Tap a box in the question (or Top, Bottom, the arrow keys) to fix it; Enter checks
  // straight away.
  import { onDestroy } from 'svelte';
  import NumPad from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  import { bottomDone, topDone, type Frac } from '../fracPad';
  type Props = { n: string; d: string; focus: 'n' | 'd'; disabled?: boolean; compact?: boolean;
    /** the right answer (or the choices): only their digits are used, to know when a box is finished */
    want?: Frac | Frac[] | null;
    /** show how it works (the first few fraction questions) */
    hint?: boolean;
    onchange: (v: { n: string; d: string; focus: 'n' | 'd' }) => void; onsubmit: () => void; onfirst?: () => void };
  let { n, d, focus, disabled = false, compact = false, want = null, hint = false, onchange, onsubmit, onfirst }: Props = $props();
  const wants = $derived(want ? (Array.isArray(want) ? want : [want]) : []);

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
      // (with no answer to go by, a moment's wait for a second digit)
      if (!wants.length && nn.length < 2) { onchange({ n: nn, d, focus: 'n' }); timer = setTimeout(() => onTo(nn, d), 380); }
      else if (!wants.length || topDone(nn, wants)) onTo(nn, d);
      else onchange({ n: nn, d, focus: 'n' });
    } else {
      const dd = d.length >= 2 || d === '0' ? x : d + x;
      onchange({ n, d: dd, focus: 'd' });
      if (!bottomDone(n, dd, wants)) return;
      // the top's still empty: fill it next
      if (!n) onchange({ n, d: dd, focus: 'n' });
      else onsubmit();
    }
  }
  /** The top is finished: on to the bottom, or check if the bottom's there and finished already. */
  function onTo(nn: string, dd: string) {
    clear();
    onchange({ n: nn, d: dd, focus: 'd' });
    if (nn && bottomDone(nn, dd, wants)) onsubmit();
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
