<script lang="ts">
  import Icon from '../../ui/Icon.svelte';
  import { sfx } from '../../audio/sound';
  // The on-screen number pad: one row on a wide screen, a calculator block on a phone. The keyboard's
  // number row and number pad work too; this is for touch and for anyone who'd rather tap.
  // `extra`: a decimal point and a minus key, for decimals and negative numbers (they type '.' and '-')
  // Tap a key to type it, or drag it into an answer box (anything marked data-drop, or an answer .box):
  // it follows your finger, the box glows as you get close, and it snaps in. `ondrop` says which box
  // (a fraction's top or bottom); without it a drop types the number, like a tap.
  type Props = { ondigit: (d: string) => void; onback: () => void; disabled?: boolean; lit?: string | null; compact?: boolean; extra?: ('.' | '-')[];
    ondrop?: (d: string, slot: string) => void };
  let { ondigit, onback, disabled = false, lit = null, compact = false, extra = [], ondrop }: Props = $props();
  const ROW = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const GRID = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0'];
  const keys = $derived(compact ? [...GRID, ...extra] : [...ROW, ...extra, 'back']);

  // ---- tap or drag (each finger on its own, so quick two-thumb typing works) ----
  type Press = { k: string; x: number; y: number; moved: boolean };
  const presses = new Map<number, Press>();
  let ghost = $state<{ k: string; x: number; y: number; landing: boolean } | null>(null);
  let over: Element | null = null;
  const NEAR = 44;

  function down(k: string, e: PointerEvent) {
    e.preventDefault();
    if (disabled) return;
    if (k === 'back') { onback(); return; }
    presses.set(e.pointerId, { k, x: e.clientX, y: e.clientY, moved: false });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    const p = presses.get(e.pointerId);
    if (!p) return;
    if (!p.moved && (e.clientX - p.x) ** 2 + (e.clientY - p.y) ** 2 > 12 * 12) { p.moved = true; sfx.click(); }
    if (p.moved) { ghost = { k: p.k, x: e.clientX, y: e.clientY, landing: false }; hover(targetAt(e.clientX, e.clientY)); }
  }
  function up(e: PointerEvent) {
    const p = presses.get(e.pointerId);
    if (!p) return;
    presses.delete(e.pointerId);
    if (!p.moved) { if (!disabled) ondigit(p.k); return; }
    const t = targetAt(e.clientX, e.clientY);
    hover(null);
    if (!t || disabled) { ghost = null; return; }
    // snap into the box, then type it there
    const r = t.getBoundingClientRect();
    ghost = { k: p.k, x: r.left + r.width / 2, y: r.top + r.height / 2, landing: true };
    setTimeout(() => (ghost = null), 170);
    sfx.pop();
    const slot = t.getAttribute('data-drop') ?? 'num';
    if (ondrop) ondrop(p.k, slot); else ondigit(p.k);
  }
  function cancel(e: PointerEvent) { presses.delete(e.pointerId); hover(null); ghost = null; }
  /** The answer box under the finger, or the nearest one within a thumb's width. */
  function targetAt(x: number, y: number): Element | null {
    let best: Element | null = null, bd = NEAR;
    for (const el of document.querySelectorAll('[data-drop], .box')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      const d = Math.hypot(dx, dy);
      if (d < bd || (d === 0 && best === null)) { bd = d; best = el; }
    }
    return best;
  }
  function hover(el: Element | null) {
    if (over === el) return;
    over?.classList.remove('drop-over');
    over = el;
    el?.classList.add('drop-over');
  }
</script>

<div class="pad" class:compact class:ext={extra.length > 0} class:disabled role="group" aria-label="Number pad" style:--cols={11 + extra.length}>
  {#each keys as k (k)}
    <button class="k" class:back={k === 'back'} class:lit={lit === k} class:zero={compact && k === '0'} class:x={k === '.' || k === '-'} aria-label={k === 'back' ? 'Delete' : k}
      onpointerdown={(e) => down(k, e)} onpointermove={move} onpointerup={up} onpointercancel={cancel} tabindex="-1">
      {#if k === 'back'}<Icon name="erase" size={40} />{:else if k === '-'}−{:else}{k}{/if}
    </button>
  {/each}
</div>
{#if ghost}<div class="ghost" class:landing={ghost.landing} style:left="{ghost.x}px" style:top="{ghost.y}px" aria-hidden="true">{ghost.k === '-' ? '−' : ghost.k}</div>{/if}

<style>
  .pad { display: grid; grid-template-columns: repeat(var(--cols, 11), minmax(0, 1fr)); gap: 10px; width: min(1000px, 100%); margin: 0 auto; touch-action: none; user-select: none; -webkit-user-select: none; }
  .k { height: clamp(56px, 8.5vh, 76px); border-radius: 18px; border: 3px solid #ece6f6; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 5px 0 #d9cff0; font: 600 clamp(26px, 4vh, 36px)/1 var(--font-ui); color: var(--ink); cursor: grab; display: grid; place-items: center; transition: transform .06s, box-shadow .06s, background .15s; -webkit-tap-highlight-color: transparent; touch-action: none; }
  .k:active, .k.lit { transform: translateY(4px); box-shadow: 0 1px 0 #d9cff0; background: linear-gradient(#efe9ff, #e2d8ff); }
  .k.back { color: var(--muted); cursor: pointer; }
  .k.back :global(.ico) { width: 40px; height: 40px; }
  .disabled .k { opacity: .5; cursor: default; }
  .compact { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: min(420px, 100%); }
  .compact .k { height: clamp(46px, 7.2vh, 60px); border-radius: 16px; }
  .compact .k.back { order: 10; }
  .compact .k.zero { order: 11; grid-column: span 2; }
  .compact .k.x { order: 12; }
  .compact.ext .k.zero { grid-column: auto; }
  /* the tile in your finger, and the box it's about to land in */
  .ghost { position: fixed; z-index: 90; width: 64px; height: 64px; margin: -40px 0 0 -32px; border-radius: 18px; display: grid; place-items: center; pointer-events: none;
    font: 600 38px/1 var(--font-ui); color: var(--ink); background: linear-gradient(#fff, #efe9ff); border: 3px solid #a98cff;
    box-shadow: 0 0 0 6px rgba(169, 140, 255, .25), 0 14px 26px -8px rgba(60, 30, 140, .45); transform: rotate(-4deg) scale(1.08); }
  .ghost.landing { margin: -32px 0 0 -32px; transform: scale(.6); opacity: 0; transition: left .15s ease-out, top .15s ease-out, transform .17s ease-in, opacity .17s ease-in; }
  :global(.drop-over) { box-shadow: inset 0 0 0 4px #ffb400, 0 0 0 7px rgba(255, 196, 60, .45), 0 0 22px rgba(255, 180, 0, .6) !important; transition: box-shadow .12s; }
</style>
