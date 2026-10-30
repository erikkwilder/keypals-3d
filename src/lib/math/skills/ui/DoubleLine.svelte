<script lang="ts">
  // A double number line: two painted planks, one over the other, that count the same mix (cups of juice
  // up top, fruit below) tick for tick. `read`: one tick's number below is a glowing gap: type it.
  // `place`: drag the pin along the bottom plank (or tap it, or the arrow keys) to where the asked number
  // goes; it snaps to the ticks and keeps its number to itself; Check (or Enter) answers.
  import { onDestroy } from 'svelte';
  import NumPad, { WRONG_MS } from '../../ui/NumPad.svelte';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import type { Answer } from '../types';
  import type { DnlSpec } from '../ratios';
  import { FRUIT } from '../ratioPic';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const spec = $derived(item.custom!.spec as DnlSpec);
  const send = (a: Answer) => (onanswer as (a: Answer) => unknown)(a);
  const fmt = (v: number) => String(Math.round(v * 100) / 100);
  const left = (k: number) => `calc(30px + (100% - 60px) * ${k / spec.n})`;
  /** the same place, measured across both lines (the fruit pictures take the first `off` pixels) */
  const off = $derived(compact ? 52 : 84);
  const across = (k: number) => `calc(${off + 30}px + (100% - ${off + 60}px) * ${k / spec.n})`;
  const art = (f: DnlSpec['top']['f']) => (f === 'cup' ? 'math/ratios/tile.webp' : `math/ratios/fruit/${f}.webp`);
  const word = (f: DnlSpec['top']['f']) => (f === 'cup' ? 'cups' : FRUIT[f].many);

  // ---- read: type the gap ----
  const want = $derived(item.answer.kind === 'number' ? item.answer.value : 0);
  let text = $state('');
  let bad = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // ---- place: the pin's tick ----
  let at = $state<number | null>(null);
  let el: HTMLDivElement | undefined = $state();
  let dragging = false;
  $effect(() => { void item.id; text = ''; bad = false; at = null; clearTimeout(timer); });
  onDestroy(() => clearTimeout(timer));

  function wrong(clear: () => void) { bad = true; clearTimeout(timer); timer = setTimeout(() => { bad = false; clear(); }, WRONG_MS); }
  function checkRead() { if (!text || disabled) return; if (send({ kind: 'number', value: Number(text) }) === false) wrong(() => (text = '')); }
  function digit(d: string) {
    if (disabled || spec.mode !== 'read') return;
    if (bad) { clearTimeout(timer); bad = false; text = ''; }
    onfirst();
    if (text.length >= String(want).length) text = '';
    text += d;
    if (text.length === String(want).length) checkRead();
  }
  function back() { if (bad) { bad = false; text = ''; return; } text = text.slice(0, -1); }
  function setFromX(x: number) {
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(1, (x - r.left - off - 30) / (r.width - off - 60)));
    onfirst();
    at = Math.round(k * spec.n);
  }
  function checkPlace() { if (at === null || disabled) return; if (send({ kind: 'point', x: Math.round(at * spec.bot.step * 1000) / 1000 }) === false) wrong(() => {}); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (spec.mode === 'place') {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); onfirst(); at = Math.max(0, Math.min(spec.n, (at ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))); }
      else if (e.key === 'Enter') { e.preventDefault(); checkPlace(); }
      return;
    }
    if (e.repeat) return;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    const d = /^[0-9]$/.test(e.key) ? e.key : m ? m[1] : null;
    if (d) { e.preventDefault(); digit(d); }
    else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); }
    else if (e.key === 'Enter') { e.preventDefault(); checkRead(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="dl" class:compact>
  <div class="row">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="lines" bind:this={el} class:place={spec.mode === 'place'}
      onpointerdown={(e) => { if (spec.mode !== 'place') return; dragging = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setFromX(e.clientX); }}
      onpointermove={(e) => { if (dragging) setFromX(e.clientX); }} onpointerup={() => (dragging = false)}>
      {#each [spec.top, spec.bot] as lane, li (li)}
        <div class="lane" class:bot={li === 1}>
          <span class="who"><img src="{base}{art(lane.f)}" alt="" /><small>{word(lane.f)}</small></span>
          <div class="plank" style:background-image="url({base}learn/plank.webp)"></div>
          {#each Array(spec.n + 1) as _, k (k)}
            {@const gap = li === 1 && spec.mode === 'read' && k === spec.at}
            {@const v = k * lane.step}
            <span class="tick" class:big={k === 0} class:hot={(li === 0 && k === spec.at && spec.mode === 'read') || (li === 1 && spec.mode === 'place' && at === k)} style:left={left(k)}>
              {#if gap}<b class="gapbox" class:bad class:typed={!!text} data-drop="num">{text || '?'}</b>
              {:else if lane.show.includes(k)}<b>{fmt(v)}</b>{/if}
            </span>
          {/each}
        </div>
      {/each}
      {#if spec.mode === 'place' && at !== null}<span class="pin" class:bad style:left={across(at)}><img src="{base}learn/pin.webp" alt="" /></span>{/if}
      <span class="link" style:left={across(spec.at)} class:show={spec.mode === 'read'}></span>
    </div>
    {#if spec.mode === 'place'}
      <button class="ok" disabled={at === null || disabled} onpointerdown={(e) => { e.preventDefault(); checkPlace(); }} tabindex="-1"><Icon name="check" size={28} /><span>Check</span></button>
    {/if}
  </div>
  {#if spec.mode === 'read'}<NumPad ondigit={digit} onback={back} {disabled} {compact} />{/if}
</div>

<style>
  .dl { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .row { display: flex; align-items: center; gap: 14px; width: min(1000px, 100%); }
  .lines { position: relative; flex: 1; display: flex; flex-direction: column; gap: 34px; padding: 10px 0 28px; touch-action: none; }
  .lines.place { cursor: pointer; }
  .lane { position: relative; height: 34px; margin-left: 84px; }
  .who { position: absolute; left: -84px; top: 50%; transform: translateY(-50%); width: 78px; display: flex; flex-direction: column; align-items: center; }
  .who img { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 3px 2px rgba(60, 30, 10, .3)); }
  .who small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .plank { position: absolute; left: 14px; right: 14px; top: 8px; height: 18px; border-radius: 10px; background-size: 100% 100%; box-shadow: 0 4px 0 #b88a55; }
  .tick { position: absolute; top: 2px; width: 4px; height: 30px; margin-left: -2px; border-radius: 2px; background: #5b3416; }
  .tick.big { height: 34px; top: 0; }
  .tick b { position: absolute; left: 50%; transform: translateX(-50%); top: -26px; font: 600 19px var(--font-ui); color: #5b3416; white-space: nowrap; }
  .bot .tick b { top: 36px; }
  .tick.hot { background: #f07a3a; box-shadow: 0 0 0 3px #ffe2c4; }
  .gapbox { min-width: 44px; padding: 0 8px; border-radius: 12px; background: #fff; color: var(--muted) !important; text-align: center; box-shadow: inset 0 0 0 3px #ffb347, 0 0 16px rgba(255, 179, 71, .9); animation: glow 1.3s ease-in-out infinite; }
  .gapbox.typed { color: var(--ink) !important; }
  .gapbox.bad { color: #d6335c !important; background: #fff0f3; box-shadow: inset 0 0 0 3px #ff8aa5; animation: nope .4s ease; }
  @keyframes glow { 50% { box-shadow: inset 0 0 0 3px #ffb347, 0 0 26px rgba(255, 179, 71, 1); } }
  @keyframes nope { 20%, 60% { transform: translateX(calc(-50% - 6px)); } 40%, 80% { transform: translateX(calc(-50% + 6px)); } }
  .link { position: absolute; top: 44px; height: 34px; width: 0; border-left: 3px dashed rgba(240, 122, 58, .7); margin-left: -1px; opacity: 0; }
  .link.show { opacity: 1; }
  .pin { position: absolute; bottom: 2px; margin-left: -22px; width: 44px; transition: left .12s ease-out; pointer-events: none; }
  .pin img { width: 44px; display: block; filter: drop-shadow(0 4px 4px rgba(60, 30, 10, .35)); transform: translateY(-34px); }
  .pin.bad { animation: wob .4s ease; }
  @keyframes wob { 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .row { flex-direction: column; gap: 6px; }
  .compact .lines { width: 100%; gap: 30px; }
  .compact .lane { margin-left: 52px; }
  .compact .who { left: -52px; width: 48px; }
  .compact .who img { width: 30px; height: 30px; }
  .compact .who small { display: none; }
  .compact .tick b { font-size: 15px; }
</style>
