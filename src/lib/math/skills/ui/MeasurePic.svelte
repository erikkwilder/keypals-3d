<script lang="ts">
  // The measuring pictures (skills/measure.ts MeasPic): a painted brass clock with its hands, a digital
  // time, things lying on a wooden ruler, things on squared paper with a row of cubes, a kitchen scale
  // with its needle, a glass jug with water and its marks, a garden of grass squares with a fence, a box
  // of cubes, and a little table. The painted pieces are public/math/measure/*.webp; the numbers, marks
  // and hands are drawn over them, so they're exact and always sharp.
  import type { MeasPic, Thing } from '../measure';
  import { timeText } from '../measure';
  type Props = { m: MeasPic; size?: number };
  let { m, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const art = (n: string) => `${base}math/measure/${n}.webp`;
  const uid = `mp${Math.random().toString(36).slice(2, 8)}`;
  /** each thing's painting: its width over its height (the paintings are cropped to the thing) */
  const ASPECT: Record<Thing, number> = { pencil: 520 / 88, crayon: 520 / 108, caterpillar: 520 / 183, brush: 520 / 128, carrot: 520 / 190, key: 520 / 168, feather: 520 / 176, spoon: 520 / 143 };
  /** how thick a thing lies on a ruler or in a row, for a length of 1 (so a long pencil isn't a fat log) */
  const thick = (t: Thing, len: number, unitPx: number) => Math.min(unitPx * 1.15, (len * unitPx) / ASPECT[t]);

  // ---- the clock: the hands' angles (degrees from 12, clockwise) ----
  const hourDeg = (h: number, mm: number) => ((h % 12) + mm / 60) * 30;
  const minDeg = (mm: number) => mm * 6;
  const hand = (deg: number, len: number, w: number, cx: number, cy: number) => {
    const a = (deg * Math.PI) / 180, tx = cx + Math.sin(a) * len, ty = cy - Math.cos(a) * len;
    const bx = cx - Math.sin(a) * len * 0.16, by = cy + Math.cos(a) * len * 0.16;
    const nx = Math.cos(a) * w, ny = Math.sin(a) * w;
    return `M${bx + nx},${by + ny} L${tx + nx * 0.35},${ty + ny * 0.35} L${tx},${ty} L${tx - nx * 0.35},${ty - ny * 0.35} L${bx - nx},${by - ny} Z`;
  };
  // ---- squares (area and perimeter) ----
  const shapeBox = $derived.by(() => {
    if (m.kind !== 'shape') return null;
    const xs = m.rects.flatMap(r => [r.x, r.x + r.w]), ys = m.rects.flatMap(r => [r.y, r.y + r.h]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    return { x0: Math.min(...xs), y0: Math.min(...ys), w, h };
  });
  const cells = $derived.by(() => {
    if (m.kind !== 'shape') return [] as { x: number; y: number }[];
    const out: { x: number; y: number }[] = [], seen = new Set<string>();
    for (const r of m.rects) for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) {
      const k = `${x},${y}`;
      if (seen.has(k) || (m.cut && x >= m.cut.x && x < m.cut.x + m.cut.w && y >= m.cut.y && y < m.cut.y + m.cut.h)) continue;
      seen.add(k); out.push({ x, y });
    }
    return out;
  });
  /** the outline of the squares: every unit edge with grass on one side only */
  const edges = $derived.by(() => {
    const has = new Set(cells.map(c => `${c.x},${c.y}`)), out: [number, number, number, number][] = [];
    for (const { x, y } of cells) {
      if (!has.has(`${x},${y - 1}`)) out.push([x, y, x + 1, y]);
      if (!has.has(`${x},${y + 1}`)) out.push([x, y + 1, x + 1, y + 1]);
      if (!has.has(`${x - 1},${y}`)) out.push([x, y, x, y + 1]);
      if (!has.has(`${x + 1},${y}`)) out.push([x + 1, y, x + 1, y + 1]);
    }
    return out;
  });
  /** a side's words sit outside the shape, by the middle of the side */
  function sideAt(s: { x1: number; y1: number; x2: number; y2: number }, u: number, ox: number, oy: number) {
    const mx = (s.x1 + s.x2) / 2, my = (s.y1 + s.y2) / 2, has = new Set(cells.map(c => `${c.x},${c.y}`));
    if (s.y1 === s.y2) { const above = has.has(`${Math.floor(mx)},${s.y1 - 1}`); return { x: ox + mx * u, y: oy + s.y1 * u + (above ? 1 : -1) * u * 0.42, anchor: 'middle' }; }
    const left = has.has(`${s.x1 - 1},${Math.floor(my)}`);
    return { x: ox + s.x1 * u + (left ? 1 : -1) * u * 0.18, y: oy + my * u + u * 0.12, anchor: left ? 'start' : 'end' };
  }
  // ---- a box of cubes: an oblique view (depth goes up and to the right) ----
  const DX = 0.5, DY = 0.36;
  const boxCubes = $derived.by(() => {
    if (m.kind !== 'box') return [] as { x: number; y: number; z: number }[];
    const out: { x: number; y: number; z: number }[] = [];
    // back to front, bottom to top, left to right: each cube drawn over the ones behind it
    for (let z = m.w - 1; z >= 0; z--) for (let y = 0; y < m.h; y++) for (let x = 0; x < m.l; x++) {
      // only the ones you can see: the top layer, the front row and the right end
      if (y === m.h - 1 || z === 0 || x === m.l - 1) out.push({ x, y, z });
    }
    return out;
  });
</script>

{#if m.kind === 'clock'}
  {@const S = Math.round(size * 1.1)}
  <svg class="mp" viewBox="0 0 512 508" width={S} height={S * 508 / 512} role="img" aria-label="A clock showing {timeText(m.h, m.m)}">
    <image href={art('clockface')} x="0" y="0" width="512" height="508" />
    {#each Array(60) as _, i (i)}
      {@const a = (i * 6 * Math.PI) / 180}
      {@const big = i % 5 === 0}
      <line x1={255 + Math.sin(a) * (big ? 150 : 158)} y1={252 - Math.cos(a) * (big ? 150 : 158)} x2={255 + Math.sin(a) * 170} y2={252 - Math.cos(a) * 170} stroke={big ? '#4a3418' : '#9a8460'} stroke-width={big ? 7 : 3} stroke-linecap="round" />
    {/each}
    {#each Array(12) as _, i (i)}
      {@const n = i + 1}
      {@const a = (n * 30 * Math.PI) / 180}
      {#if m.face === 'all' || (m.face === 'quarters' && n % 3 === 0)}
        <text x={255 + Math.sin(a) * 122} y={252 - Math.cos(a) * 122 + 17} text-anchor="middle" class="cn">{n}</text>
      {/if}
    {/each}
    <path d={hand(hourDeg(m.h, m.m), 88, 13, 255, 252)} fill="#2c3e66" stroke="#1b2645" stroke-width="3" stroke-linejoin="round" />
    <path d={hand(minDeg(m.m), 140, 9, 255, 252)} fill="#e0503a" stroke="#9c2a18" stroke-width="3" stroke-linejoin="round" />
    <circle cx="255" cy="252" r="15" fill="#f2c14e" stroke="#8a5a14" stroke-width="4" />
  </svg>
{:else if m.kind === 'time'}
  <span class="dig" style:--s="{size}px" aria-label={timeText(m.h, m.m)}><b>{timeText(m.h, m.m)}</b>{#if m.ap}<small>{m.ap}</small>{/if}</span>
{:else if m.kind === 'thing'}
  <img class="thing" src={art(m.thing)} alt="" style:width="{Math.round(size * 0.62)}px" />
{:else if m.kind === 'ruler'}
  {@const W = Math.round(size * 2.7)}
  {@const pad = 18}
  {@const u = (W - pad - 50) / m.len}
  {@const rows = m.items.length}
  {@const top = rows * u * 1.25 + 8}
  {@const RH = Math.max(46, u * 1.4)}
  <svg class="mp" viewBox="0 0 {W} {top + RH + 4}" width={W} height={top + RH + 4} role="img" aria-label="A ruler">
    <defs><pattern id="{uid}w" patternUnits="userSpaceOnUse" width="700" height="69"><image href="{base}learn/plank.webp" width="1400" height="137" x="-300" y="-30" /></pattern></defs>
    {#each m.items as it, i (i)}
      {@const len = it.to - it.from}
      {@const h = thick(it.thing, len, u)}
      <image href={art(it.thing)} x={pad + it.from * u} y={top - 6 - (rows - i) * u * 1.2 + (u * 1.2 - h) / 2} width={len * u} height={h} preserveAspectRatio="none" />
      <line x1={pad + it.to * u} x2={pad + it.to * u} y1={top - 6 - (rows - i) * u * 1.2 + u * 0.6} y2={top + 4} stroke="#ff5a7a" stroke-width="2" stroke-dasharray="4 4" opacity=".75" />
      {#if it.from > 0}<line x1={pad + it.from * u} x2={pad + it.from * u} y1={top - 6 - (rows - i) * u * 1.2 + u * 0.6} y2={top + 4} stroke="#ff5a7a" stroke-width="2" stroke-dasharray="4 4" opacity=".75" />{/if}
    {/each}
    <rect x="2" y={top} width={W - 4} height={RH} rx="8" fill="url(#{uid}w)" stroke="#a8763c" stroke-width="3" />
    <rect x="2" y={top} width={W - 4} height={RH} rx="8" fill="#ffe7b0" opacity=".35" />
    {#each Array(m.len * m.ticks + 1) as _, i (i)}
      {@const whole = i % m.ticks === 0}
      {@const n = i / m.ticks}
      <line x1={pad + n * u} x2={pad + n * u} y1={top} y2={top + (whole ? (n % 5 === 0 && m.unit === 'cm' ? RH * 0.42 : RH * 0.32) : RH * 0.2)} stroke="#4a2e10" stroke-width={whole ? 2.4 : 1.6} />
      {#if whole}<text x={pad + n * u} y={top + RH - 8} text-anchor="middle" class="rn" style:font-size="{Math.min(20, Math.max(12, u * 0.62))}px">{n}</text>{/if}
    {/each}
    <text x={W - 10} y={top + RH - 10} text-anchor="end" class="ru">{m.unit === 'cm' ? 'cm' : 'in'}</text>
  </svg>
{:else if m.kind === 'lengths'}
  {@const W = Math.round(size * 2.5)}
  {@const u = (W - 8) / m.max}
  {@const rows = m.items.length + (m.units ? 1 : 0)}
  {@const H = rows * u * 1.3 + 8}
  <svg class="mp" viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label="Things to compare">
    <rect x="0" y="0" width={W} height={H} rx="10" fill="#fffdf5" stroke="#e8dcc2" stroke-width="2" />
    {#if m.grid}
      {#each Array(m.max + 1) as _, i (i)}<line x1={4 + i * u} x2={4 + i * u} y1="4" y2={H - 4} stroke="#b7d3f0" stroke-width="1.5" />{/each}
      {#each Array(rows * 2 + 1) as _, j (j)}<line x1="4" x2={W - 4} y1={4 + j * u * 0.65} y2={4 + j * u * 0.65} stroke="#d8e7f7" stroke-width="1" />{/each}
    {:else}
      <line x1="4" x2="4" y1="4" y2={H - 4} stroke="#ff8aa5" stroke-width="3" stroke-dasharray="6 5" />
    {/if}
    {#each m.items as it, i (i)}
      {@const h = thick(it.thing, it.len, u)}
      <image href={art(it.thing)} x={4 + it.from * u} y={4 + i * u * 1.3 + (u * 1.3 - h) / 2} width={it.len * u} height={h} preserveAspectRatio="none" />
    {/each}
    {#if m.units}
      {@const n = m.items[0].len}
      {@const y = 4 + m.items.length * u * 1.3 + u * 0.15}
      {#each Array(n) as _, i (i)}
        {#if m.units === 'cube'}<image href={art('cube')} x={4 + i * u} y={y} width={u} height={u} />
        {:else}<rect x={4 + i * u + 2} y={y + u * 0.3} width={u - 4} height={u * 0.4} rx={u * 0.2} fill="none" stroke="#7d8da6" stroke-width={Math.max(3, u * 0.08)} /><rect x={4 + i * u + u * 0.18} y={y + u * 0.4} width={u * 0.6} height={u * 0.2} rx={u * 0.1} fill="none" stroke="#9fb0c8" stroke-width={Math.max(2, u * 0.05)} />{/if}
      {/each}
    {/if}
  </svg>
{:else if m.kind === 'scale'}
  {@const S = Math.round(size * 1.3)}
  {@const cx = 229.5}
  {@const cy = 333}
  {@const R = 104}
  {@const sweep = 300}
  {@const deg = (v: number) => -sweep / 2 + (v / m.max) * sweep}
  {@const at = (v: number, r: number) => [cx + Math.sin((deg(v) * Math.PI) / 180) * r, cy - Math.cos((deg(v) * Math.PI) / 180) * r]}
  {@const tip = at(m.value, R - 8)}
  <svg class="mp" viewBox="0 0 463 512" width={S} height={S * 512 / 463} role="img" aria-label="A scale">
    <image href={art('scale')} x="0" y="0" width="463" height="512" />
    <text x={cx} y="50" text-anchor="middle" class="load">{m.load}</text>
    {#each Array(m.max / m.step + 1) as _, i (i)}
      {@const v = i * m.step}
      {@const big = v % m.label === 0}
      {@const a = at(v, R - (big ? 18 : 12))}
      {@const b = at(v, R - 2)}
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#3b3f52" stroke-width={big ? 4 : 2} stroke-linecap="round" />
      {#if big}{@const t = at(v, R - 40)}<text x={t[0]} y={t[1] + 11} text-anchor="middle" class="sn" style:font-size="{String(v).length > 3 ? 25 : 32}px">{v}</text>{/if}
    {/each}
    <text x={cx} y={cy + 58} text-anchor="middle" class="su">{m.unit}</text>
    <line x1={cx} y1={cy} x2={tip[0]} y2={tip[1]} stroke="#e0283f" stroke-width="6" stroke-linecap="round" />
    <circle cx={cx} cy={cy} r="11" fill="#e0283f" stroke="#8c1020" stroke-width="3" />
  </svg>
{:else if m.kind === 'jug'}
  {@const S = Math.round(size * 1.25)}
  {@const y0 = 398}
  {@const y1 = 82}
  {@const yOf = (v: number) => y0 - (v / m.max) * (y0 - y1)}
  <svg class="mp" viewBox="0 0 512 466" width={S} height={S * 466 / 512} role="img" aria-label="A jug of water">
    <defs><clipPath id="{uid}j"><path d="M76,{y1 - 30} L372,{y1 - 30} L370,{y0} Q368,{y0 + 6} 360,{y0 + 6} L86,{y0 + 6} Q78,{y0 + 6} 76,{y0} Z" /></clipPath>
      <linearGradient id="{uid}wg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff" /><stop offset="1" stop-color="#2f8fe0" /></linearGradient></defs>
    <image href={art('jug')} x="0" y="0" width="512" height="466" />
    {#if m.value > 0}
      <g clip-path="url(#{uid}j)">
        <rect x="60" y={yOf(m.value)} width="330" height={y0 - yOf(m.value) + 10} fill="url(#{uid}wg)" opacity=".72" />
        <ellipse cx="224" cy={yOf(m.value)} rx="150" ry="9" fill="#d6f2ff" opacity=".95" />
        <rect x="300" y={yOf(m.value) + 14} width="22" height={Math.max(0, y0 - yOf(m.value) - 24)} rx="11" fill="#fff" opacity=".28" />
      </g>
    {/if}
    {#each Array(m.max / m.step + 1) as _, i (i)}
      {@const v = i * m.step}
      {@const big = v % m.label === 0}
      {#if v > 0}
        <line x1="88" x2={big ? 158 : 130} y1={yOf(v)} y2={yOf(v)} stroke="#21507d" stroke-width={big ? 6 : 4} stroke-linecap="round" />
        {#if big}<text x="168" y={yOf(v) + 13} class="jn" style:font-size="{String(v).length > 3 ? 36 : 42}px">{v}</text>{/if}
      {/if}
    {/each}
    <text x="300" y="440" text-anchor="middle" class="ju">{m.unit}</text>
  </svg>
{:else if m.kind === 'shape' && shapeBox}
  {@const maxW = size * 2}
  {@const maxH = size * 1.3}
  {@const u = Math.max(12, Math.min(maxW / (shapeBox.w + 1.6), maxH / (shapeBox.h + 1.2), size * 0.42))}
  {@const ox = u * 0.9}
  {@const oy = u * 0.7}
  {@const W = shapeBox.w * u + ox * 2}
  {@const H = shapeBox.h * u + oy * 2}
  <svg class="mp" viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label="A garden of squares">
    <defs><pattern id="{uid}g" patternUnits="userSpaceOnUse" width={u * 3} height={u * 3}><image href={art('grass')} width={u * 3} height={u * 3} /></pattern></defs>
    {#each cells as c (c.x + ',' + c.y)}<rect x={ox + c.x * u} y={oy + c.y * u} width={u} height={u} fill="url(#{uid}g)" />{/each}
    {#if m.grid === true}
      {#each cells as c (c.x + ',' + c.y)}<rect x={ox + c.x * u + 1} y={oy + c.y * u + 1} width={u - 2} height={u - 2} fill="none" stroke="#f4ffe8" stroke-width="1.6" opacity=".9" />{/each}
    {:else if m.grid === 'edge'}
      {#each cells.filter(c => c.y === 0 || c.x === 0) as c (c.x + ',' + c.y)}<rect x={ox + c.x * u + 1} y={oy + c.y * u + 1} width={u - 2} height={u - 2} fill="none" stroke="#f4ffe8" stroke-width="1.6" />{/each}
    {/if}
    {#if m.cut}<rect x={ox + m.cut.x * u} y={oy + m.cut.y * u} width={m.cut.w * u} height={m.cut.h * u} fill="#f6efe2" stroke="#c9b48f" stroke-width="2" stroke-dasharray="6 5" />{/if}
    {#each edges as [x1, y1, x2, y2], i (i)}
      <line x1={ox + x1 * u} y1={oy + y1 * u} x2={ox + x2 * u} y2={oy + y2 * u} stroke={m.fence ? '#8a5a2b' : '#4d7a2a'} stroke-width={m.fence ? Math.max(4, u * 0.16) : 3} stroke-linecap="round" />
    {/each}
    {#if m.fence}{#each edges as [x1, y1], i (i)}<circle cx={ox + x1 * u} cy={oy + y1 * u} r={Math.max(3, u * 0.12)} fill="#c58a4a" stroke="#6b4320" stroke-width="1.5" />{/each}{/if}
    {#each m.sides as s, i (i)}
      {#if s.text}{@const p = sideAt(s, u, ox, oy)}<text x={p.x} y={p.y} text-anchor={p.anchor as 'start' | 'middle' | 'end'} class="sd" style:font-size="{Math.max(13, Math.min(20, u * 0.5))}px">{s.text}</text>{/if}
    {/each}
  </svg>
{:else if m.kind === 'box'}
  {@const span = m.l + m.w * DX}
  {@const tall = m.h + m.w * DY}
  {@const u = Math.min((size * 1.7) / (span + 1.4), (size * 1.25) / (tall + 0.8), size * 0.34)}
  {@const ox = u * 0.9}
  {@const W = span * u + ox * 2.4}
  {@const H = tall * u + u * 1.1}
  {@const by = H - u * 0.55}
  {@const P = (x: number, y: number, z: number) => [ox + (x + z * DX) * u, by - (y + z * DY) * u]}
  {@const poly = (pts: number[][]) => pts.map(p => p.join(',')).join(' ')}
  <svg class="mp" viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label="A box">
    {#if m.cubes}
      {#each boxCubes as c (c.x + ',' + c.y + ',' + c.z)}
        <polygon points={poly([P(c.x, c.y + 1, c.z), P(c.x + 1, c.y + 1, c.z), P(c.x + 1, c.y + 1, c.z + 1), P(c.x, c.y + 1, c.z + 1)])} fill="#9fd6ff" stroke="#2b6aa8" stroke-width="1.5" stroke-linejoin="round" />
        <polygon points={poly([P(c.x + 1, c.y, c.z), P(c.x + 1, c.y, c.z + 1), P(c.x + 1, c.y + 1, c.z + 1), P(c.x + 1, c.y + 1, c.z)])} fill="#2f86d6" stroke="#2b6aa8" stroke-width="1.5" stroke-linejoin="round" />
        <polygon points={poly([P(c.x, c.y, c.z), P(c.x + 1, c.y, c.z), P(c.x + 1, c.y + 1, c.z), P(c.x, c.y + 1, c.z)])} fill="#56aaf0" stroke="#2b6aa8" stroke-width="1.5" stroke-linejoin="round" />
        <rect x={P(c.x, c.y, c.z)[0] + u * 0.14} y={P(c.x, c.y + 1, c.z)[1] + u * 0.12} width={u * 0.3} height={u * 0.1} rx={u * 0.05} fill="#fff" opacity=".35" />
      {/each}
    {:else}
      <polygon points={poly([P(0, m.h, 0), P(m.l, m.h, 0), P(m.l, m.h, m.w), P(0, m.h, m.w)])} fill="#f3cf8e" stroke="#9a6a2c" stroke-width="2.5" stroke-linejoin="round" />
      <polygon points={poly([P(m.l, 0, 0), P(m.l, 0, m.w), P(m.l, m.h, m.w), P(m.l, m.h, 0)])} fill="#c98f45" stroke="#9a6a2c" stroke-width="2.5" stroke-linejoin="round" />
      <polygon points={poly([P(0, 0, 0), P(m.l, 0, 0), P(m.l, m.h, 0), P(0, m.h, 0)])} fill="#e3ac5e" stroke="#9a6a2c" stroke-width="2.5" stroke-linejoin="round" />
      <line x1={P(m.l / 2, m.h, 0)[0]} y1={P(m.l / 2, m.h, 0)[1]} x2={P(m.l / 2, m.h, m.w)[0]} y2={P(m.l / 2, m.h, m.w)[1]} stroke="#b88a4a" stroke-width="5" opacity=".6" />
    {/if}
    {#if m.labels}
      {@const fs = Math.max(13, Math.min(20, u * 0.55))}
      <text x={P(m.l / 2, 0, 0)[0]} y={P(0, 0, 0)[1] + fs + 4} text-anchor="middle" class="sd" style:font-size="{fs}px">{m.labels[0]}</text>
      <text x={P(m.l, 0, m.w / 2)[0] + 8} y={P(m.l, 0, m.w / 2)[1] + 4} text-anchor="start" class="sd" style:font-size="{fs}px">{m.labels[1]}</text>
      <text x={P(0, m.h / 2, 0)[0] - 8} y={P(0, m.h / 2, 0)[1] + 6} text-anchor="end" class="sd" style:font-size="{fs}px">{m.labels[2]}</text>
    {/if}
  </svg>
{:else if m.kind === 'table'}
  <table class="tb" style:--s="{size}px">
    <thead><tr><th>{m.head[0]}</th><th>{m.head[1]}</th></tr></thead>
    <tbody>{#each m.rows as r, i (i)}<tr>{#each r as c, j (j)}<td class:gap={c === '?'}>{c}</td>{/each}</tr>{/each}</tbody>
  </table>
{/if}

<style>
  .mp { display: block; overflow: visible; filter: drop-shadow(0 6px 8px rgba(60, 40, 10, .18)); }
  .cn { font: 600 44px var(--font-ui); fill: #3a2a12; }
  .rn { font-family: var(--font-ui); font-weight: 600; fill: #3a220a; }
  .ru { font: 700 16px var(--font-body); fill: #6b4318; }
  .load { font: 600 34px var(--font-ui); fill: #2c4a43; paint-order: stroke; stroke: #fff; stroke-width: 6px; }
  .sn { font-family: var(--font-ui); font-weight: 600; fill: #23283a; }
  .su { font: 600 24px var(--font-ui); fill: #5a6070; }
  .jn { font-family: var(--font-ui); font-weight: 600; fill: #1b4a78; paint-order: stroke; stroke: #fff; stroke-width: 7px; }
  .ju { font: 600 40px var(--font-ui); fill: #1b4a78; paint-order: stroke; stroke: #fff; stroke-width: 7px; }
  .sd { font-family: var(--font-ui); font-weight: 600; fill: #3b2a14; paint-order: stroke; stroke: #fffdf5; stroke-width: 4px; }
  .thing { display: block; height: auto; filter: drop-shadow(0 3px 3px rgba(60, 40, 10, .25)); }
  .dig { display: inline-flex; align-items: baseline; gap: calc(var(--s) * .06); padding: calc(var(--s) * .07) calc(var(--s) * .16); border-radius: calc(var(--s) * .14);
    background: linear-gradient(#2c3a5a, #1c2640); box-shadow: inset 0 0 0 3px #e9b54a, inset 0 0 0 6px #8a5d1a, 0 4px 0 #6b4512; }
  .dig b { font: 600 calc(var(--s) * .4)/1 var(--font-ui); color: #a8ffd2; text-shadow: 0 0 10px rgba(120, 255, 190, .6); letter-spacing: .02em; }
  .dig small { font: 700 calc(var(--s) * .17)/1 var(--font-body); color: #ffe39a; }
  .tb { border-collapse: separate; border-spacing: 0; border-radius: 14px; overflow: hidden; box-shadow: 0 0 0 3px #e2c38a, 0 6px 10px rgba(60, 40, 10, .15); background: #fffdf5; }
  .tb th { background: #8a6bd6; color: #fff; font: 600 calc(var(--s) * .13) var(--font-ui); padding: 6px 14px; }
  .tb td { font: 600 calc(var(--s) * .16) var(--font-ui); color: var(--ink); text-align: center; padding: 4px 14px; border-top: 2px solid #f0e4c8; }
  .tb td.gap { color: #a98cff; background: #f4efff; }
</style>
