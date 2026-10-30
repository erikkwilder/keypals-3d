<script lang="ts">
  // A brass thermometer with a glass tube: the red line stands at `at` (or isn't there yet: null), a mark
  // every `step`, numbers every `label`, 0 drawn strong and the part below zero frosty blue. Used as a
  // picture (IntPic) and, with `onset`, as the input you drag (ThermoInput): pressing or dragging on it
  // moves the red line to the nearest mark.
  type Props = { min: number; max: number; at: number | null; step: number; label: number; height?: number; onset?: (v: number) => void; glow?: boolean };
  let { min, max, at, step, label, height = 200, onset, glow = false }: Props = $props();
  const uid = `th${Math.random().toString(36).slice(2, 8)}`;
  // the drawing's own units: 120 wide, 300 tall; the scale runs from y 24 (max) to y 236 (min)
  const TOP = 24, BOT = 236;
  const Y = (v: number) => BOT - ((v - min) / (max - min)) * (BOT - TOP);
  const ticks = $derived(Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => +(min + i * step).toFixed(6)));
  const isLabel = (v: number) => Math.abs(v / label - Math.round(v / label)) < 1e-6;
  const txt = (v: number) => (v < 0 ? `−${-v}` : String(v));
  let svg: SVGSVGElement | undefined = $state();
  let dragging = false;
  function setFrom(clientY: number) {
    if (!svg || !onset) return;
    const r = svg.getBoundingClientRect(), y = ((clientY - r.top) / r.height) * 300;
    const v = min + ((BOT - y) / (BOT - TOP)) * (max - min);
    const snapped = Math.max(min, Math.min(max, Math.round(v / step) * step));
    onset(+snapped.toFixed(6));
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg bind:this={svg} class="th" class:live={!!onset} class:glow viewBox="0 0 120 300" width={height * 0.4} {height} role="img" aria-label={at === null ? 'A thermometer' : `A thermometer at ${txt(at)} degrees`}
  onpointerdown={(e) => { if (!onset) return; dragging = true; (e.currentTarget as Element).setPointerCapture(e.pointerId); setFrom(e.clientY); }}
  onpointermove={(e) => { if (dragging) setFrom(e.clientY); }} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
  <defs>
    <linearGradient id="{uid}brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9822a" /><stop offset=".35" stop-color="#f3d27a" /><stop offset=".7" stop-color="#d9a441" /><stop offset="1" stop-color="#9c6a1e" /></linearGradient>
    <linearGradient id="{uid}glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e8f4ff" /><stop offset=".4" stop-color="#ffffff" /><stop offset="1" stop-color="#cfe4f7" /></linearGradient>
    <linearGradient id="{uid}red" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c81e3a" /><stop offset=".45" stop-color="#ff5a6e" /><stop offset="1" stop-color="#b3142f" /></linearGradient>
    <radialGradient id="{uid}bulb" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#ff9aa6" /><stop offset=".45" stop-color="#ef3550" /><stop offset="1" stop-color="#9e0e26" /></radialGradient>
    <linearGradient id="{uid}cold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfeaff" /><stop offset="1" stop-color="#9ccdf6" /></linearGradient>
    <linearGradient id="{uid}warm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2d6" /><stop offset="1" stop-color="#ffe2b0" /></linearGradient>
  </defs>
  <!-- the brass plate, warm above zero and frosty below -->
  <rect x="8" y="4" width="104" height="292" rx="26" fill="url(#{uid}brass)" />
  <rect x="16" y="12" width="88" height={Math.max(0, Y(0) - 12)} rx="18" fill="url(#{uid}warm)" />
  <rect x="16" y={Y(0)} width="88" height={Math.max(0, 254 - Y(0))} rx="0" fill="url(#{uid}cold)" />
  <rect x="16" y="246" width="88" height="42" rx="18" fill="url(#{uid}cold)" />
  <!-- the glass tube and the bulb -->
  <rect x="30" y="14" width="18" height="250" rx="9" fill="url(#{uid}glass)" stroke="#9fb9d3" stroke-width="1.5" />
  {#if at !== null}
    <rect x="34" y={Y(at)} width="10" height={Math.max(0, 262 - Y(at))} rx="5" fill="url(#{uid}red)" />
    <!-- the top of the red line: a little marker you can see (and drag) -->
    <rect x="25" y={Y(at) - 3} width="28" height="6" rx="3" fill="#fff" stroke="#c81e3a" stroke-width="2" />
  {/if}
  <circle cx="39" cy="270" r="17" fill="url(#{uid}bulb)" stroke="#8a1022" stroke-width="1.5" />
  <circle cx="33" cy="264" r="5" fill="#fff" opacity=".55" />
  <!-- the marks and numbers -->
  {#each ticks as v (v)}
    {@const big = isLabel(v)}
    <line x1="52" y1={Y(v)} x2={big ? 66 : 60} y2={Y(v)} stroke={v === 0 ? '#1f5f9e' : '#6b4a1e'} stroke-width={v === 0 ? 3.5 : big ? 2.2 : 1.4} stroke-linecap="round" />
    {#if big}<text x="69" y={Y(v) + 5} class="lab" class:zero={v === 0} class:minus={v < 0}>{txt(v)}</text>{/if}
  {/each}
  <text x="98" y="22" class="unit">°</text>
</svg>

<style>
  .th { display: block; filter: drop-shadow(0 6px 10px rgba(60, 40, 10, .25)); touch-action: none; user-select: none; }
  .th.live { cursor: ns-resize; }
  .th.glow { filter: drop-shadow(0 0 10px rgba(255, 210, 107, .9)) drop-shadow(0 6px 10px rgba(60, 40, 10, .25)); }
  .lab { font: 700 15px var(--font-ui); fill: #5b3416; }
  .lab.minus { fill: #1f5f9e; }
  .lab.zero { font-size: 17px; fill: #1f5f9e; }
  .unit { font: 700 16px var(--font-ui); fill: #5b3416; }
</style>
