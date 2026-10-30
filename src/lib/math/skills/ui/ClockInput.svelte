<script lang="ts">
  // Set the clock: drag the long (minute) hand round and the short (hour) hand follows it, like a real
  // clock (past 12 the hour goes up); or drag the short hand to another hour. The long hand snaps to
  // the question's step (every half hour, five minutes or one minute). The gentle rungs show the time
  // in numbers under the clock as it moves; on the easiest the long hand stays on 12 and only the short
  // hand moves. Arrow keys work too: left and right move the long hand, up and down the hour. Then Done.
  import { sfx } from '../../../audio/sound';
  import { mSfx } from '../../measure/sounds';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  import { timeText, type ClockSpec } from '../measure';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const spec = $derived((item.custom?.spec ?? { face: 'all', snap: 5, start: 0, show: true }) as ClockSpec);
  /** minutes past 12 o'clock, 0..719 */
  let t = $state(0);
  let held = $state<'minute' | 'hour' | null>(null);
  let moved = $state(false);
  $effect(() => { void item.id; t = spec.start; held = null; moved = false; });
  const h = $derived(Math.floor(t / 60) % 12), mm = $derived(t % 60);
  const hourDeg = $derived((t / 720) * 360), minDeg = $derived(mm * 6);
  const S = $derived(compact ? 200 : 270);
  let svg: SVGSVGElement | undefined = $state();
  const CX = 255, CY = 252;

  function hand(deg: number, len: number, w: number) {
    const a = (deg * Math.PI) / 180, tx = CX + Math.sin(a) * len, ty = CY - Math.cos(a) * len;
    const bx = CX - Math.sin(a) * len * 0.16, by = CY + Math.cos(a) * len * 0.16;
    const nx = Math.cos(a) * w, ny = Math.sin(a) * w;
    return `M${bx + nx},${by + ny} L${tx + nx * 0.35},${ty + ny * 0.35} L${tx},${ty} L${tx - nx * 0.35},${ty - ny * 0.35} L${bx - nx},${by - ny} Z`;
  }
  /** the pointer as an angle from 12 (degrees, clockwise) and a distance from the middle (clock units) */
  function polar(e: PointerEvent) {
    const r = svg!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 512 - CX, y = ((e.clientY - r.top) / r.height) * 508 - CY;
    return { deg: ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360, d: Math.hypot(x, y) };
  }
  const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  function down(e: PointerEvent) {
    if (disabled || !svg) return;
    e.preventDefault();
    const p = polar(e);
    if (p.d > 200) return;
    // the hand nearest the finger (the short one when close to the middle and near both)
    const dm = gap(p.deg, minDeg), dh = gap(p.deg, hourDeg);
    held = spec.lock === 'minute' ? 'hour' : dh < 25 && (p.d < 105 || dh + 8 < dm) ? 'hour' : 'minute';
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    onfirst();
    drag(e);
  }
  function drag(e: PointerEvent) {
    if (!held || disabled) return;
    const p = polar(e);
    if (held === 'minute') {
      const snap = spec.snap;
      const m2 = (Math.round(p.deg / 6 / snap) * snap) % 60;
      if (m2 === mm) return;
      // past 12 going round: the hour goes up (or back down)
      let hh = h;
      if (mm - m2 > 30) hh = (hh + 1) % 12; else if (m2 - mm > 30) hh = (hh + 11) % 12;
      set(hh * 60 + m2);
    } else {
      // the short hand: to the hour it points nearest (keeping the minutes)
      const hh = Math.floor(((p.deg - (mm / 60) * 30 + 15 + 360) % 360) / 30) % 12;
      if (hh === h) return;
      set(hh * 60 + mm);
    }
  }
  function set(v: number) { t = ((v % 720) + 720) % 720; moved = true; mSfx.tick(); }
  function up() { held = null; }
  function done() { if (!disabled) { sfx.click(); onanswer({ kind: 'number', value: t }); } }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return;
    const st = spec.lock === 'minute' ? 60 : spec.snap;
    if (e.key === 'ArrowRight') { e.preventDefault(); onfirst(); set(t + st); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); onfirst(); set(t - st); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onfirst(); set(t + 60); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); onfirst(); set(t - 60); }
    else if (e.key === 'Enter') { e.preventDefault(); done(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ci" class:compact>
  <svg bind:this={svg} viewBox="0 0 512 508" width={S} height={S * 508 / 512} role="slider" aria-label="Clock hands" aria-valuenow={t} aria-valuetext={timeText(h || 12, mm)} tabindex="-1"
    onpointerdown={down} onpointermove={drag} onpointerup={up} onpointercancel={up} class:held>
    <image href="{base}math/measure/clockface.webp" x="0" y="0" width="512" height="508" />
    {#each Array(60) as _, i (i)}
      {@const a = (i * 6 * Math.PI) / 180}
      {@const big = i % 5 === 0}
      <line x1={CX + Math.sin(a) * (big ? 150 : 158)} y1={CY - Math.cos(a) * (big ? 150 : 158)} x2={CX + Math.sin(a) * 170} y2={CY - Math.cos(a) * 170} stroke={big ? '#4a3418' : '#9a8460'} stroke-width={big ? 7 : 3} stroke-linecap="round" />
    {/each}
    {#each Array(12) as _, i (i)}
      {@const n = i + 1}
      {@const a = (n * 30 * Math.PI) / 180}
      {#if spec.face === 'all' || (spec.face === 'quarters' && n % 3 === 0)}<text x={CX + Math.sin(a) * 122} y={CY - Math.cos(a) * 122 + 17} text-anchor="middle" class="cn">{n}</text>{/if}
    {/each}
    <!-- a soft glow on the hand that can be dragged -->
    {#if !disabled}
      {#if spec.lock !== 'minute'}<path d={hand(minDeg, 140, 9)} fill="none" stroke="#ffe36b" stroke-width="22" stroke-linejoin="round" opacity={held === 'minute' ? 0.9 : 0.45} class="glow" />{/if}
      <path d={hand(hourDeg, 88, 13)} fill="none" stroke="#9fe0ff" stroke-width="22" stroke-linejoin="round" opacity={held === 'hour' ? 0.9 : spec.lock === 'minute' ? 0.6 : 0.3} class="glow" />
    {/if}
    <path d={hand(hourDeg, 88, 13)} fill="#2c3e66" stroke="#1b2645" stroke-width="3" stroke-linejoin="round" />
    <path d={hand(minDeg, 140, 9)} fill="#e0503a" stroke="#9c2a18" stroke-width="3" stroke-linejoin="round" />
    <circle cx={CX} cy={CY} r="15" fill="#f2c14e" stroke="#8a5a14" stroke-width="4" />
  </svg>
  <div class="side">
    {#if spec.show}<span class="read" class:on={moved}>{timeText(h || 12, mm)}</span>{/if}
    <span class="tip">{spec.lock === 'minute' ? 'Drag the short hand' : 'Drag the hands'}</span>
    <button class="ok" disabled={disabled || !moved} onpointerdown={(e) => { e.preventDefault(); done(); }} tabindex="-1"><Icon name="check" size={28} /><span>Done</span></button>
  </div>
</div>

<style>
  .ci { display: flex; align-items: center; justify-content: center; gap: 22px; width: 100%; touch-action: none; user-select: none; }
  svg { display: block; cursor: grab; filter: drop-shadow(0 10px 14px rgba(60, 40, 10, .25)); touch-action: none; }
  svg.held { cursor: grabbing; }
  .cn { font: 600 44px var(--font-ui); fill: #3a2a12; pointer-events: none; }
  .glow { animation: glow 1.4s ease-in-out infinite; pointer-events: none; }
  @keyframes glow { 50% { opacity: .2; } }
  .side { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .read { font: 600 34px var(--font-ui); color: #a8ffd2; background: linear-gradient(#2c3a5a, #1c2640); padding: 4px 16px; border-radius: 14px; box-shadow: inset 0 0 0 3px #e9b54a, 0 4px 0 #6b4512; text-shadow: 0 0 10px rgba(120, 255, 190, .6); opacity: .55; transition: opacity .2s; }
  .read.on { opacity: 1; }
  .tip { font: 700 14px var(--font-body); color: var(--muted); }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 20px 10px 14px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact { gap: 12px; }
  .compact .read { font-size: 26px; }
  .compact .ok { font-size: 19px; padding: 8px 14px 8px 10px; }
</style>
