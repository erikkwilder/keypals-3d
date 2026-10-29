<script lang="ts">
  // The fraction pad: the number pad, plus a key to move between the top and the bottom number and a
  // Check key. Tap the top or bottom box in the question to type there; on a keyboard, digits type, the /
  // (or down arrow, Tab) moves to the bottom, Enter checks.
  import NumPad from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  type Props = { n: string; d: string; focus: 'n' | 'd'; disabled?: boolean; compact?: boolean;
    onchange: (v: { n: string; d: string; focus: 'n' | 'd' }) => void; onsubmit: () => void; onfirst?: () => void };
  let { n, d, focus, disabled = false, compact = false, onchange, onsubmit, onfirst }: Props = $props();
  function digit(x: string) {
    if (disabled) return;
    onfirst?.();
    if (focus === 'n') { if (n.length < 2) onchange({ n: n + x, d, focus }); }
    else if (d.length < 2) onchange({ n, d: d + x, focus });
  }
  function back() {
    if (disabled) return;
    if (focus === 'd' && d) onchange({ n, d: d.slice(0, -1), focus });
    else if (focus === 'd') onchange({ n, d, focus: 'n' });
    else onchange({ n: n.slice(0, -1), d, focus });
  }
  const ready = $derived(!!n && !!d && d !== '0');
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key === '/' || e.key === 'ArrowDown' || e.key === 'Tab') { e.preventDefault(); onchange({ n, d, focus: 'd' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onchange({ n, d, focus: 'n' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (ready) onsubmit(); else if (n && focus === 'n') onchange({ n, d, focus: 'd' }); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="fpad" class:compact>
  <div class="row">
    <button class="mv" class:on={focus === 'n'} onpointerdown={(e) => { e.preventDefault(); onchange({ n, d, focus: 'n' }); }} tabindex="-1"><Icon name="up" size={28} /><span>Top</span></button>
    <button class="mv" class:on={focus === 'd'} onpointerdown={(e) => { e.preventDefault(); onchange({ n, d, focus: 'd' }); }} tabindex="-1"><Icon name="down" size={28} /><span>Bottom</span></button>
    <button class="ok" class:ready disabled={!ready || disabled} onpointerdown={(e) => { e.preventDefault(); if (ready && !disabled) onsubmit(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
  </div>
  <NumPad ondigit={digit} onback={back} {disabled} {compact} />
</div>

<style>
  .fpad { display: flex; flex-direction: column; gap: 10px; width: min(1000px, 100%); margin: 0 auto; }
  .row { display: flex; gap: 10px; justify-content: center; }
  .mv, .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #ece6f6; border-radius: 16px; padding: 6px 16px 6px 10px; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 4px 0 #d9cff0; font: 600 18px var(--font-ui); color: var(--ink2); cursor: pointer; touch-action: manipulation; }
  .mv.on { background: linear-gradient(#efe9ff, #e2d8ff); border-color: #a98cff; color: var(--ink); }
  .ok { margin-left: 8px; color: var(--muted); }
  .ok.ready { background: linear-gradient(#7ee0a8, #3fbf7a); border-color: #3fbf7a; color: #fff; box-shadow: 0 4px 0 #2f9a60; }
  .ok:disabled { opacity: .6; cursor: default; }
  .compact .mv, .compact .ok { padding: 4px 10px 4px 6px; font-size: 15px; }
</style>
