<script lang="ts">
  // Make a shape on the dot grid: tap pegs one after another and a glowing band stretches from peg to peg;
  // tap the first peg again (or Done) to close it into a shape. Tap the last peg to take it back. While you
  // build, the band says how many sides you have. Done sends the shape; any shape that follows the rule is
  // right (math/shapes/rules.ts).
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import { clean, type P } from '../geo';
  import { encodePts, ruleShort, type GridRule } from '../rules';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived(item.custom?.spec as { cols: number; rows: number; rule: GridRule });
  const S = 52, PAD = 30;
  const W = $derived((spec.cols - 1) * S + PAD * 2), H = $derived((spec.rows - 1) * S + PAD * 2);
  let pts = $state<P[]>([]);
  let closed = $state(false);
  let bad = $state(false);
  $effect(() => { void item.id; pts = []; closed = false; bad = false; });
  const X = (p: P) => PAD + p[0] * S, Y = (p: P) => PAD + p[1] * S;
  const same = (a: P, b: P) => a[0] === b[0] && a[1] === b[1];
  function tap(p: P) {
    if (disabled) return;
    onfirst();
    if (bad) { bad = false; closed = false; }
    if (closed) { closed = false; }
    if (pts.length >= 3 && same(p, pts[0])) { closed = true; sfx.twinkle(); return; }
    if (pts.length && same(p, pts[pts.length - 1])) { pts = pts.slice(0, -1); sfx.click(); return; }
    if (pts.some(q => same(q, p))) { sfx.nope(); return; }
    pts = [...pts, p]; sfx.pop();
  }
  function undo() { if (disabled) return; bad = false; if (closed) closed = false; else pts = pts.slice(0, -1); sfx.click(); }
  function clear() { if (disabled) return; bad = false; closed = false; pts = []; sfx.whoosh(); }
  function done() {
    if (disabled || pts.length < 3) return;
    closed = true;
    const ok = onanswer({ kind: 'choice', id: encodePts(pts) });
    if (ok === false) { bad = true; }
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey) return;
    if (e.key === 'Enter') { e.preventDefault(); done(); }
    else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
  }
  const sides = $derived(pts.length >= 3 ? clean(pts).length : Math.max(0, pts.length - 1));
  const pegs = $derived(Array.from({ length: spec.cols * spec.rows }, (_, i) => [i % spec.cols, Math.floor(i / spec.cols)] as P));
</script>

<svelte:window onkeydown={key} />

<div class="dg" class:compact>
  <svg viewBox="0 0 {W} {H}" class="board" role="img" aria-label="A dot grid: tap pegs to make a shape">
    <rect x="4" y="4" width={W - 8} height={H - 8} rx="22" fill="#e9b97a" stroke="#b9823f" stroke-width="5" />
    <rect x="12" y="12" width={W - 24} height={H - 24} rx="16" fill="#f3cf98" opacity=".7" />
    {#if pts.length >= 3 && closed}
      <polygon points={pts.map(p => `${X(p)},${Y(p)}`).join(' ')} fill={bad ? '#ff8aa5' : '#5fd6c4'} fill-opacity=".45" />
    {/if}
    {#if pts.length >= 2}
      <polyline points={(closed ? [...pts, pts[0]] : pts).map(p => `${X(p)},${Y(p)}`).join(' ')} fill="none" stroke={bad ? '#d6335c' : '#1fb5a3'} stroke-width="8" stroke-linejoin="round" stroke-linecap="round" class="band" />
      <polyline points={(closed ? [...pts, pts[0]] : pts).map(p => `${X(p)},${Y(p)}`).join(' ')} fill="none" stroke="#c9fff6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
    {/if}
    {#each pegs as p (p.join())}
      {@const on = pts.findIndex(q => same(q, p))}
      <g class="peg" role="button" tabindex="-1" aria-label="Peg {p[0]}, {p[1]}" onpointerdown={(e) => { e.preventDefault(); tap(p); }}>
        <circle cx={X(p)} cy={Y(p)} r="22" fill="transparent" />
        <circle cx={X(p)} cy={Y(p) + 2} r="9" fill="#8a5a24" opacity=".5" />
        <circle cx={X(p)} cy={Y(p)} r={on >= 0 ? 10 : 8} fill={on === 0 && pts.length >= 3 && !closed ? '#ffd36b' : on >= 0 ? '#ffe9a8' : '#fff4dc'} stroke={on >= 0 ? '#e0a020' : '#c9a06a'} stroke-width="3" class:first={on === 0 && pts.length >= 3 && !closed} />
      </g>
    {/each}
  </svg>
  <div class="side">
    <span class="rule">{ruleShort(spec.rule)}</span>
    <span class="count">{pts.length < 2 ? 'Tap the pegs' : closed ? `${sides} sides` : pts.length >= 3 ? `${pts.length} corners · tap the first peg to close` : `${pts.length} corners`}</span>
    <div class="btns">
      <button class="mini" disabled={disabled || !pts.length} onpointerdown={(e) => { e.preventDefault(); undo(); }} tabindex="-1" aria-label="Take back the last peg"><Icon name="replay" size={20} /></button>
      <button class="mini" disabled={disabled || !pts.length} onpointerdown={(e) => { e.preventDefault(); clear(); }} tabindex="-1" aria-label="Start again"><Icon name="erase" size={20} /></button>
    </div>
    <button class="ok" disabled={disabled || pts.length < 3} onpointerdown={(e) => { e.preventDefault(); done(); }} tabindex="-1"><Icon name="check" size={24} /><span>Done</span></button>
  </div>
</div>

<style>
  .dg { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; flex-wrap: wrap; }
  .board { width: min(320px, 86vw); height: auto; touch-action: none; filter: drop-shadow(0 6px 10px rgba(110, 70, 20, .25)); }
  .peg { cursor: pointer; }
  .first { animation: blink 1s ease-in-out infinite; }
  @keyframes blink { 50% { fill: #fff; } }
  .band { filter: drop-shadow(0 0 6px rgba(60, 220, 200, .8)); }
  .side { display: flex; flex-direction: column; align-items: center; gap: 8px; max-width: 220px; text-align: center; }
  .rule { font: 600 20px var(--font-ui); color: #1f7a6c; }
  .count { font: 700 14px var(--font-body); color: var(--muted); }
  .btns { display: flex; gap: 8px; }
  .mini { width: 44px; height: 44px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; color: var(--ink); }
  .mini:disabled { opacity: .5; cursor: default; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 8px; }
  .compact .board { width: min(230px, 60vw); }
  .compact .rule { font-size: 16px; } .compact .count { font-size: 12px; }
  .compact .mini { width: 38px; height: 38px; }
</style>
