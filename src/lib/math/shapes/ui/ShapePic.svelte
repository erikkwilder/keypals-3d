<script lang="ts">
  // A shapes picture (math/shapes/fig.ts) as crystal tiles: each shape is its colour, the painted crystal
  // texture over it, a soft shine from the top left and a darker rim, sitting on a soft shadow. Right
  // angles get their little squares, equal sides their ticks, parallel sides their arrows, angles their
  // arcs and sizes; boxes are drawn in 3D from little cubes; solids are their paintings. Every size is in
  // the picture's own grid units, so it scales to any size crisp.
  import type { Fig, FigAngle, FigBox, FigCircle, FigPoly } from '../fig';
  import { HUE_RGB } from '../fig';
  import type { P } from '../geo';
  type Props = { fig: Fig; size?: number };
  let { fig, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const uid = `sp${Math.random().toString(36).slice(2, 8)}`;
  const PAD = 0.7;
  const big = $derived(Math.max(fig.w, fig.h));
  /** line widths and mark sizes follow the picture's size */
  const sw = $derived(big / 70);
  const k = $derived(big * 0.055);
  const vbW = $derived(fig.w + PAD * 2), vbH = $derived(fig.h + PAD * 2);
  const W = $derived(Math.round((size * vbW) / Math.max(vbW, vbH))), H = $derived(Math.round((size * vbH) / Math.max(vbW, vbH)));
  const fs = $derived(Math.max(0.55, big * 0.085));

  const pts = (ps: P[]) => ps.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ');
  const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const centre = (ps: P[]): P => [ps.reduce((t, p) => t + p[0], 0) / ps.length, ps.reduce((t, p) => t + p[1], 0) / ps.length];
  const unit = (a: P, b: P): P => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  /** the little square in a right-angled corner */
  function rightBox(ps: P[], i: number, s = k): P[] {
    const v = ps[i], a = unit(v, ps[(i + ps.length - 1) % ps.length]), b = unit(v, ps[(i + 1) % ps.length]);
    return [v, [v[0] + a[0] * s, v[1] + a[1] * s], [v[0] + (a[0] + b[0]) * s, v[1] + (a[1] + b[1]) * s], [v[0] + b[0] * s, v[1] + b[1] * s]];
  }
  /** tick marks across the middle of side i */
  function ticks(ps: P[], i: number, n: number): [P, P][] {
    const a = ps[i], b = ps[(i + 1) % ps.length], u = unit(a, b), nrm: P = [-u[1], u[0]], m = mid(a, b), gap = k * 0.45;
    return Array.from({ length: n }, (_, j) => { const o = (j - (n - 1) / 2) * gap, c: P = [m[0] + u[0] * o, m[1] + u[1] * o]; return [[c[0] - nrm[0] * k * 0.5, c[1] - nrm[1] * k * 0.5], [c[0] + nrm[0] * k * 0.5, c[1] + nrm[1] * k * 0.5]] as [P, P]; });
  }
  /** arrowheads along side i (parallel sides) */
  function arrows(ps: P[], i: number, n: number): P[][] {
    const a = ps[i], b = ps[(i + 1) % ps.length], u = unit(a, b), nrm: P = [-u[1], u[0]], m = mid(a, b), s = k * 0.55;
    return Array.from({ length: n }, (_, j) => { const c: P = [m[0] + u[0] * (j - (n - 1) / 2) * s * 1.2, m[1] + u[1] * (j - (n - 1) / 2) * s * 1.2]; return [[c[0] - u[0] * s + nrm[0] * s * 0.7, c[1] - u[1] * s + nrm[1] * s * 0.7], c, [c[0] - u[0] * s - nrm[0] * s * 0.7, c[1] - u[1] * s - nrm[1] * s * 0.7]]; });
  }
  /** where words go beside side i: out from the middle of the shape */
  function sideSpot(ps: P[], i: number): P {
    const a = ps[i], b = ps[(i + 1) % ps.length], m = mid(a, b), c = centre(ps), u = unit(a, b);
    let nrm: P = [-u[1], u[0]];
    if ((m[0] - c[0]) * nrm[0] + (m[1] - c[1]) * nrm[1] < 0) nrm = [-nrm[0], -nrm[1]];
    return [m[0] + nrm[0] * fs * 0.85, m[1] + nrm[1] * fs * 0.85];
  }
  /** an arc in corner i, and where its words go (inside, along the middle of the corner) */
  function cornerArc(ps: P[], i: number): { d: string; at: P } {
    const v = ps[i], a = unit(v, ps[(i + ps.length - 1) % ps.length]), b = unit(v, ps[(i + 1) % ps.length]);
    const r = k * 1.3;
    const a0 = Math.atan2(a[1], a[0]), a1 = Math.atan2(b[1], b[0]);
    // the short way round, inside the corner
    let d = a1 - a0; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const steps = 14, path = Array.from({ length: steps + 1 }, (_, j) => { const t = a0 + (d * j) / steps; return `${(v[0] + Math.cos(t) * r).toFixed(3)},${(v[1] + Math.sin(t) * r).toFixed(3)}`; });
    const bis = a0 + d / 2, rr = r + fs * 0.95;
    return { d: `M${path.join(' L')}`, at: [v[0] + Math.cos(bis) * rr, v[1] + Math.sin(bis) * rr] };
  }
  // ---- angles (rays from a point; degrees counter-clockwise from the right, as on a protractor) ----
  const rad = (d: number) => (d * Math.PI) / 180;
  const ray = (g: FigAngle, d: number): P => [g.at[0] + Math.cos(rad(d)) * g.len, g.at[1] - Math.sin(rad(d)) * g.len];
  function angleArc(g: FigAngle): string {
    const r = g.len * (g.to - g.from > 200 ? 0.22 : 0.3), n = 24;
    return `M${Array.from({ length: n + 1 }, (_, j) => { const t = rad(g.from + ((g.to - g.from) * j) / n); return `${(g.at[0] + Math.cos(t) * r).toFixed(3)},${(g.at[1] - Math.sin(t) * r).toFixed(3)}`; }).join(' L')}`;
  }
  function angleSquare(g: FigAngle): P[] {
    const s = g.len * 0.16, a: P = [Math.cos(rad(g.from)), -Math.sin(rad(g.from))], b: P = [Math.cos(rad(g.to)), -Math.sin(rad(g.to))];
    return [g.at, [g.at[0] + a[0] * s, g.at[1] + a[1] * s], [g.at[0] + (a[0] + b[0]) * s, g.at[1] + (a[1] + b[1]) * s], [g.at[0] + b[0] * s, g.at[1] + b[1] * s]];
  }
  function angleText(g: FigAngle): P {
    const span = g.to - g.from, m = rad(g.from + span / 2), r = g.len * (span < 40 ? 0.62 : span > 200 ? 0.38 : 0.5);
    return [g.at[0] + Math.cos(m) * r, g.at[1] - Math.sin(m) * r];
  }
  // ---- boxes of cubes, drawn from a little above and to the front ----
  function boxGeo(b: FigBox) {
    const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
    const raw = (i: number, j: number, z: number): P => [(i - j) * c30, (i + j) * s30 - z];
    const corners = [raw(0, 0, 0), raw(b.l, 0, 0), raw(0, b.w, 0), raw(b.l, b.w, 0), raw(0, 0, b.h), raw(b.l, 0, b.h), raw(0, b.w, b.h), raw(b.l, b.w, b.h)];
    const x0 = Math.min(...corners.map(p => p[0])), x1 = Math.max(...corners.map(p => p[0])), y0 = Math.min(...corners.map(p => p[1])), y1 = Math.max(...corners.map(p => p[1]));
    // fit inside the picture with room for the words, centred
    const u = Math.min((fig.w * 0.78) / (x1 - x0), (fig.h * 0.78) / (y1 - y0));
    const ox = fig.w / 2 - ((x0 + x1) / 2) * u, oy = fig.h / 2 - ((y0 + y1) / 2) * u;
    const at = (i: number, j: number, z: number): P => { const [x, y] = raw(i, j, z); return [ox + x * u, oy + y * u]; };
    const top = [at(0, 0, b.h), at(b.l, 0, b.h), at(b.l, b.w, b.h), at(0, b.w, b.h)];
    const left = [at(0, b.w, 0), at(b.l, b.w, 0), at(b.l, b.w, b.h), at(0, b.w, b.h)];
    const right = [at(b.l, 0, 0), at(b.l, b.w, 0), at(b.l, b.w, b.h), at(b.l, 0, b.h)];
    const lines: [P, P][] = [];
    if (b.cubes) {
      for (let i = 1; i < b.l; i++) lines.push([at(i, 0, b.h), at(i, b.w, b.h)], [at(i, b.w, 0), at(i, b.w, b.h)]);
      for (let j = 1; j < b.w; j++) lines.push([at(0, j, b.h), at(b.l, j, b.h)], [at(b.l, j, 0), at(b.l, j, b.h)]);
      for (let z = 1; z < b.h; z++) lines.push([at(0, b.w, z), at(b.l, b.w, z)], [at(b.l, 0, z), at(b.l, b.w, z)]);
    }
    const l0 = mid(at(0, b.w, 0), at(b.l, b.w, 0)), l1 = mid(at(b.l, b.w, 0), at(b.l, 0, 0)), l2 = mid(at(b.l, 0, 0), at(b.l, 0, b.h));
    return { top, left, right, lines, lab: [[l0[0] - fs * 0.45, l0[1] + fs * 1.0], [l1[0] + fs * 0.6, l1[1] + fs * 0.95], [l2[0] + fs * 0.75, l2[1] + fs * 0.3]] as P[] };
  }
  const closed = $derived((fig.polys ?? []).filter(p => !p.open));
  const open = $derived((fig.polys ?? []).filter(p => p.open));
  const hue = (p: { hue?: keyof typeof HUE_RGB }) => HUE_RGB[p.hue ?? 'teal'];
  const showLabel = (p: FigPoly) => !!p.label && p.label.length <= 4;
  const circ = (c: FigCircle) => c;
</script>

<svg class="sp" viewBox="{-PAD} {-PAD} {vbW} {vbH}" width={W} height={H} role="img" aria-label="A shapes picture">
  <defs>
    <pattern id="{uid}t" patternUnits="userSpaceOnUse" width={big * 0.6} height={big * 0.6}><image href="{base}math/shapes/crystal.webp" width={big * 0.6} height={big * 0.6} preserveAspectRatio="none" /></pattern>
    <linearGradient id="{uid}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6" /><stop offset=".42" stop-color="#fff" stop-opacity=".08" /><stop offset="1" stop-color="#1b1040" stop-opacity=".16" /></linearGradient>
    <filter id="{uid}d" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy={big * 0.012} stdDeviation={big * 0.012} flood-color="#3a2a60" flood-opacity=".28" /></filter>
  </defs>

  {#if fig.grid === 'squares' || fig.grid === 'axes'}
    <g class="grid">
      <rect x="0" y="0" width={fig.w} height={fig.h} rx={sw * 3} fill="#fffaf0" />
      {#each Array(Math.floor(fig.w) + 1) as _, i}<line x1={i} y1="0" x2={i} y2={fig.h} stroke={fig.grid === 'axes' && i === fig.w / 2 ? '#6b4a2a' : '#e3d6bf'} stroke-width={fig.grid === 'axes' && i === fig.w / 2 ? sw * 1.6 : sw * 0.7} />{/each}
      {#each Array(Math.floor(fig.h) + 1) as _, j}<line x1="0" y1={j} x2={fig.w} y2={j} stroke={fig.grid === 'axes' && j === fig.h / 2 ? '#6b4a2a' : '#e3d6bf'} stroke-width={fig.grid === 'axes' && j === fig.h / 2 ? sw * 1.6 : sw * 0.7} />{/each}
      {#if fig.grid === 'axes'}
        {#each Array(Math.floor(fig.w) + 1) as _, i}{#if i !== fig.w / 2 && i % 2 === 0}<text x={i} y={fig.h / 2 + fs * 0.75} class="ax" font-size={fs * 0.55} text-anchor="middle">{i - fig.w / 2}</text>{/if}{/each}
        {#each Array(Math.floor(fig.h) + 1) as _, j}{#if j !== fig.h / 2 && j % 2 === 0}<text x={fig.w / 2 - fs * 0.3} y={j + fs * 0.2} class="ax" font-size={fs * 0.55} text-anchor="end">{fig.h / 2 - j}</text>{/if}{/each}
      {/if}
    </g>
  {:else if fig.grid === 'dots'}
    {#each Array(Math.floor(fig.w) + 1) as _, i}{#each Array(Math.floor(fig.h) + 1) as _, j}<circle cx={i} cy={j} r={sw * 1.3} fill="#c9b48e" />{/each}{/each}
  {/if}

  {#if fig.solid}
    <image href="{base}math/shapes/solid-{fig.solid}.webp" x={fig.w * 0.04} y={fig.h * 0.04} width={fig.w * 0.92} height={fig.h * 0.92} preserveAspectRatio="xMidYMid meet" filter="url(#{uid}d)" />
  {/if}

  {#each closed as p, pi (pi)}
    {@const c = hue(p)}
    <g filter="url(#{uid}d)">
      <polygon points={pts(p.pts)} fill={c.fill} />
      <polygon points={pts(p.pts)} fill="url(#{uid}t)" class="tex" />
      <polygon points={pts(p.pts)} fill="url(#{uid}s)" />
      <polygon points={pts(p.pts)} fill="none" stroke={c.edge} stroke-width={sw * 1.5} stroke-linejoin="round" />
    </g>
    {#each p.parts ?? [] as q, qi (qi)}<polygon points={pts(q.pts)} fill={HUE_RGB[q.hue].fill} stroke={HUE_RGB[q.hue].edge} stroke-width={sw} stroke-linejoin="round" />{/each}
    {#each p.cuts ?? [] as [a, b], ci (ci)}<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c.deep} stroke-width={sw * 1.2} stroke-linecap="round" />{/each}
    {#each p.right ?? [] as i (i)}<polygon points={pts(rightBox(p.pts, i))} fill="#fff" fill-opacity=".55" stroke={c.deep} stroke-width={sw} />{/each}
    {#each Object.entries(p.ticks ?? {}) as [i, n] (i)}{#each ticks(p.pts, +i, n) as [a, b], ti (ti)}<line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c.deep} stroke-width={sw * 1.3} stroke-linecap="round" />{/each}{/each}
    {#each Object.entries(p.arrows ?? {}) as [i, n] (i)}{#each arrows(p.pts, +i, n) as ar, ai (ai)}<polyline points={pts(ar)} fill="none" stroke={c.deep} stroke-width={sw * 1.3} stroke-linecap="round" stroke-linejoin="round" />{/each}{/each}
    {#each Object.entries(p.arcs ?? {}) as [i, t] (i)}
      {@const a = cornerArc(p.pts, +i)}
      <path d={a.d} fill="none" stroke={c.deep} stroke-width={sw * 1.2} />
      <text x={a.at[0]} y={a.at[1] + fs * 0.32} class="lab" font-size={fs * 0.85} text-anchor="middle">{t}</text>
    {/each}
    {#each Object.entries(p.sideText ?? {}) as [i, t] (i)}
      {#if t}{@const at = sideSpot(p.pts, +i)}<text x={at[0]} y={at[1] + fs * 0.32} class="lab side" class:q={t === '?'} font-size={fs} text-anchor="middle">{t}</text>{/if}
    {/each}
    {#if showLabel(p)}{@const m = centre(p.pts)}<text x={m[0]} y={m[1] + fs * 0.36} class="lab big" class:q={p.label === '?'} font-size={fs * 1.15} text-anchor="middle">{p.label}</text>{/if}
  {/each}

  {#each open as p, pi (pi)}
    {@const c = hue(p)}
    <polyline points={pts(p.pts)} fill="none" stroke={p.dash ? c.edge : c.edge} stroke-width={p.dash ? sw * 1.4 : sw * 2.6} stroke-linecap="round" stroke-dasharray={p.dash ? `${sw * 4} ${sw * 3}` : undefined} opacity={p.hue === 'pale' && !p.dash ? 0.9 : 1} />
    {#if !p.dash && p.hue !== 'pale'}<polyline points={pts(p.pts)} fill="none" stroke="#fff" stroke-width={sw * 0.8} stroke-linecap="round" opacity=".55" />{/if}
  {/each}

  {#each fig.circles ?? [] as cc, ci (ci)}
    {@const g = circ(cc)}
    {@const c = hue(g)}
    <g filter="url(#{uid}d)">
      <circle cx={g.c[0]} cy={g.c[1]} r={g.r} fill={c.fill} />
      <circle cx={g.c[0]} cy={g.c[1]} r={g.r} fill="url(#{uid}t)" class="tex" />
      <circle cx={g.c[0]} cy={g.c[1]} r={g.r} fill="url(#{uid}s)" />
      <circle cx={g.c[0]} cy={g.c[1]} r={g.r} fill="none" stroke={c.edge} stroke-width={sw * 1.5} />
    </g>
    {#if g.radius !== undefined}
      <line x1={g.c[0]} y1={g.c[1]} x2={g.c[0] + g.r * 0.866} y2={g.c[1] - g.r * 0.5} stroke={c.deep} stroke-width={sw * 1.6} stroke-linecap="round" />
      <circle cx={g.c[0]} cy={g.c[1]} r={sw * 1.8} fill={c.deep} />
      <text x={g.c[0] + g.r * 0.43} y={g.c[1] - g.r * 0.25 - fs * 0.35} class="lab" font-size={fs} text-anchor="middle">{g.radius}</text>
    {/if}
    {#if g.diameter !== undefined}
      <line x1={g.c[0] - g.r} y1={g.c[1]} x2={g.c[0] + g.r} y2={g.c[1]} stroke={c.deep} stroke-width={sw * 1.6} stroke-linecap="round" />
      <circle cx={g.c[0]} cy={g.c[1]} r={sw * 1.8} fill={c.deep} />
      <text x={g.c[0]} y={g.c[1] - fs * 0.4} class="lab" font-size={fs} text-anchor="middle">{g.diameter}</text>
    {/if}
  {/each}

  {#each fig.boxes ?? [] as b, bi (bi)}
    {@const g = boxGeo(b)}
    {@const c = hue(b)}
    <g filter="url(#{uid}d)" stroke={c.deep} stroke-width={sw * 1.1} stroke-linejoin="round">
      <polygon points={pts(g.left)} fill={c.fill} /><polygon points={pts(g.left)} fill="url(#{uid}t)" class="tex" stroke="none" /><polygon points={pts(g.left)} fill="#000" fill-opacity=".08" stroke="none" />
      <polygon points={pts(g.right)} fill={c.fill} /><polygon points={pts(g.right)} fill="url(#{uid}t)" class="tex" stroke="none" /><polygon points={pts(g.right)} fill="#000" fill-opacity=".22" stroke="none" />
      <polygon points={pts(g.top)} fill={c.fill} /><polygon points={pts(g.top)} fill="url(#{uid}t)" class="tex" stroke="none" /><polygon points={pts(g.top)} fill="#fff" fill-opacity=".3" stroke="none" />
      {#each g.lines as [a, q], li (li)}<line x1={a[0]} y1={a[1]} x2={q[0]} y2={q[1]} stroke-width={sw * 0.8} />{/each}
    </g>
    {#if b.labels}{#each b.labels as t, li (li)}<text x={g.lab[li][0]} y={g.lab[li][1]} class="lab side" font-size={fs} text-anchor="middle">{t}</text>{/each}{/if}
  {/each}

  {#each fig.angles ?? [] as g, gi (gi)}
    {@const c = hue(g)}
    {@const a = ray(g, g.from)}
    {@const b = ray(g, g.to)}
    {#if g.right}<polygon points={pts(angleSquare(g))} fill={c.fill} fill-opacity=".5" stroke={c.deep} stroke-width={sw} />
    {:else if g.arc !== false}<path d={`${angleArc(g)} L${g.at[0]},${g.at[1]} Z`} fill={c.fill} fill-opacity=".38" stroke="none" /><path d={angleArc(g)} fill="none" stroke={c.edge} stroke-width={sw * 1.3} />{/if}
    <line x1={g.at[0]} y1={g.at[1]} x2={a[0]} y2={a[1]} stroke="#5a3d8a" stroke-width={sw * 2.6} stroke-linecap="round" />
    <line x1={g.at[0]} y1={g.at[1]} x2={b[0]} y2={b[1]} stroke="#5a3d8a" stroke-width={sw * 2.6} stroke-linecap="round" />
    <line x1={g.at[0]} y1={g.at[1]} x2={a[0]} y2={a[1]} stroke="#b9a6ff" stroke-width={sw * 0.9} stroke-linecap="round" />
    <line x1={g.at[0]} y1={g.at[1]} x2={b[0]} y2={b[1]} stroke="#b9a6ff" stroke-width={sw * 0.9} stroke-linecap="round" />
    <circle cx={g.at[0]} cy={g.at[1]} r={sw * 2} fill="#5a3d8a" />
    {#if g.text}{@const t = angleText(g)}<text x={t[0]} y={t[1] + fs * 0.32} class="lab" class:q={g.text === '?'} font-size={fs * 0.92} text-anchor="middle">{g.text}</text>{/if}
  {/each}

  {#each fig.dots ?? [] as d, di (di)}
    <circle cx={d.at[0]} cy={d.at[1]} r={sw * 2.6} fill={HUE_RGB[d.hue ?? 'gold'].fill} stroke={HUE_RGB[d.hue ?? 'gold'].deep} stroke-width={sw * 0.9} />
    {#if d.text}<text x={d.at[0] + fs * 0.6} y={d.at[1] - fs * 0.4} class="lab" font-size={fs * 0.9}>{d.text}</text>{/if}
  {/each}
  {#each fig.texts ?? [] as t, ti (ti)}<text x={t.at[0]} y={t.at[1] + fs * 0.32} class="lab side" class:q={t.text === '?'} font-size={fs * (t.size ?? 1)} text-anchor="middle">{t.text}</text>{/each}
</svg>

<style>
  .sp { display: block; overflow: visible; flex: none; }
  .tex { mix-blend-mode: multiply; opacity: .85; }
  .lab { font-family: var(--font-ui); font-weight: 600; fill: #3b2a66; paint-order: stroke; stroke: #fff; stroke-width: .16px; stroke-linejoin: round; }
  .lab.side { fill: #2a2050; }
  .lab.big { fill: #fff; stroke: rgba(40, 20, 80, .55); stroke-width: .14px; }
  .lab.q { fill: #d6335c; }
  .ax { font-family: var(--font-ui); font-weight: 600; fill: #8a6a48; }
</style>
