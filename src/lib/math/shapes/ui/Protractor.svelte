<script lang="ts">
  // Measure an angle: the angle sits on the table with a protractor over it. Drag round the picture (or
  // use the turn buttons, or the arrow keys) to turn the protractor until its flat edge lies along one side
  // of the angle; it clicks into place and glows. Then read the number where the other side crosses, on the
  // row that starts at 0, and type it.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import NumPad from '../../ui/NumPad.svelte';
  import type { CustomInputProps } from '../../skills/ui/SkillInput.svelte';
  import ProtractorArt from './ProtractorArt.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  type Spec = { deg: number; from: number; aligned: boolean; left: boolean; step: number };
  const spec = $derived(item.custom?.spec as Spec);
  const W = 360, H = 360, C = { x: 180, y: 180 }, R = 140;
  /** where the protractor's 0 points, and the two places it lines up with a side */
  const fits = $derived([spec.from, spec.from + spec.deg - 180]);
  let turn = $state(0);
  let text = $state('');
  let bad = $state(false);
  $effect(() => { void item.id; turn = spec.aligned ? (spec.left ? spec.from + spec.deg - 180 : spec.from) : spec.from + 40 + (spec.deg % 7) * 9; text = ''; });
  const norm = (d: number) => ((d % 360) + 540) % 360 - 180;
  const lined = $derived(fits.some(f => Math.abs(norm(turn - f)) < 0.01));
  function setTurn(t: number) {
    const near = fits.find(f => Math.abs(norm(t - f)) < 5);
    const was = lined;
    turn = near !== undefined ? near : t;
    if (near !== undefined && !was) sfx.pop();
  }
  // ---- turning by dragging round the middle ----
  let svg: SVGSVGElement | undefined = $state();
  let grab: number | null = null;
  const angleAt = (e: PointerEvent) => { const r = svg!.getBoundingClientRect(), x = ((e.clientX - r.left) * W) / r.width - C.x, y = ((e.clientY - r.top) * H) / r.height - C.y; return (Math.atan2(-y, x) * 180) / Math.PI; };
  function down(e: PointerEvent) { if (disabled || !svg) return; onfirst(); grab = angleAt(e) - turn; (e.currentTarget as Element).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (grab === null) return; setTurn(angleAt(e) - grab); }
  function up() { grab = null; }
  function nudge(d: number) { if (disabled) return; onfirst(); setTurn(turn + d); }
  // ---- the angle's two sides ----
  const ray = (d: number) => [C.x + Math.cos((d * Math.PI) / 180) * R * 1.12, C.y - Math.sin((d * Math.PI) / 180) * R * 1.12];
  const a = $derived(ray(spec.from)), b = $derived(ray(spec.from + spec.deg));
  const arcD = $derived.by(() => { const n = 20, rr = 30; return `M${C.x},${C.y} ` + Array.from({ length: n + 1 }, (_, j) => { const t = ((spec.from + (spec.deg * j) / n) * Math.PI) / 180; return `L${C.x + Math.cos(t) * rr},${C.y - Math.sin(t) * rr}`; }).join(' ') + ' Z'; });
  // ---- typing the number ----
  function digit(d: string) { if (disabled) return; onfirst(); if (bad) { bad = false; text = ''; } if (text.length < 3) text += d; sfx.click(); }
  function back() { if (!disabled) { bad = false; text = text.slice(0, -1); } }
  function check() {
    if (disabled || !text) return;
    const ok = onanswer({ kind: 'number', value: Number(text) });
    if (ok === false) { bad = true; setTimeout(() => { if (bad) { bad = false; text = ''; } }, 700); }
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(e.shiftKey ? 1 : 5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(e.shiftKey ? -1 : -5); }
  }
  const every = $derived(spec.step >= 30 ? 30 : 10);
</script>

<svelte:window onkeydown={key} />

<div class="pr" class:compact>
  <div class="stage">
    <svg bind:this={svg} viewBox="0 0 {W} {H}" class="pic" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="img" aria-label="An angle with a protractor to turn">
      <rect x="0" y="0" width={W} height={H} rx="20" fill="#fffaf0" />
      <path d={arcD} fill="#b9a0ff" fill-opacity=".35" />
      <line x1={C.x} y1={C.y} x2={a[0]} y2={a[1]} stroke="#5a3d8a" stroke-width="7" stroke-linecap="round" />
      <line x1={C.x} y1={C.y} x2={b[0]} y2={b[1]} stroke="#5a3d8a" stroke-width="7" stroke-linecap="round" />
      <line x1={C.x} y1={C.y} x2={a[0]} y2={a[1]} stroke="#c9b8ff" stroke-width="2.5" stroke-linecap="round" />
      <line x1={C.x} y1={C.y} x2={b[0]} y2={b[1]} stroke="#c9b8ff" stroke-width="2.5" stroke-linecap="round" />
      <ProtractorArt cx={C.x} cy={C.y} r={R} {turn} both={!spec.aligned || spec.left} {every} tick={spec.step >= 30 ? 10 : 5} glow={lined} />
    </svg>
    <div class="turns">
      <button class="tb" {disabled} onpointerdown={(e) => { e.preventDefault(); nudge(5); }} tabindex="-1" aria-label="Turn the protractor left"><Icon name="turnleft" size={22} /></button>
      <span class="hint" class:ok={lined}>{lined ? 'Lined up! Read the number' : 'Drag to turn it'}</span>
      <button class="tb" {disabled} onpointerdown={(e) => { e.preventDefault(); nudge(-5); }} tabindex="-1" aria-label="Turn the protractor right"><Icon name="turnright" size={22} /></button>
    </div>
  </div>
  <div class="type">
    <div class="box" class:bad>{text || ' '}<small>°</small></div>
    <NumPad ondigit={digit} onback={back} {disabled} compact={true} />
    <button class="ok" disabled={!text || disabled} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1"><Icon name="check" size={24} /><span>Check</span></button>
  </div>
</div>

<style>
  .pr { display: flex; align-items: center; justify-content: center; gap: 16px; width: 100%; flex-wrap: wrap; }
  .stage { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .pic { width: min(340px, 92vw); height: auto; touch-action: none; cursor: grab; border-radius: 20px; box-shadow: 0 4px 0 #e6d9c2, 0 6px 16px rgba(80, 50, 10, .12); }
  .pic:active { cursor: grabbing; }
  .turns { display: flex; align-items: center; gap: 10px; }
  .tb { width: 44px; height: 44px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; color: var(--ink); }
  .hint { font: 700 15px var(--font-body); color: var(--muted); min-width: 170px; text-align: center; }
  .hint.ok { color: #2f9a60; }
  .type { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .box { min-width: 110px; padding: 4px 14px; border-radius: 18px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; text-align: center; font: 600 40px var(--font-ui); color: var(--ink); }
  .box small { font-size: 26px; color: var(--muted); }
  .box.bad { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 6px #ffe0e8; }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 8px; }
  .compact .pic { width: min(230px, 56vw); }
  .compact .box { font-size: 30px; min-width: 90px; }
  .compact .tb { width: 36px; height: 36px; }
  .compact .hint { font-size: 13px; min-width: 130px; }
</style>
