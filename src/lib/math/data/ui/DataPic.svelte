<script lang="ts">
  // A data picture from the Chance Fair (math/data/pics.ts), drawn to scale: painted prizes in a jumble or
  // in a picture graph, bar graphs on a warm card with their lines, line and dot plots with stacked glossy
  // dots, histograms, box plots, number cards, block towers, spinners of equal parts, a glass jar of
  // marbles, dice and a tree of choices. `size` is about how tall it stands; it never grows wider than its
  // place. The drag-and-tap inputs (BarDrag, DotTap) draw on top of the same layouts.
  import { COLOR, PRIZE, barLayout, fracText, lineLayout, type DataPic } from '../pics';
  type Props = { d: DataPic; size?: number; hideBar?: boolean };
  let { d, size = 150, hideBar = true }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const uid = `dp${Math.random().toString(36).slice(2, 8)}`;
  const prize = (p: string) => `${base}math/data/prize-${p}.webp`;
  /** a little wobble for things in a jumble, the same every time for the same place */
  const wob = (i: number, k: number) => (((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;
  const MARBLE = (c: string) => COLOR[c as keyof typeof COLOR] ?? COLOR.blue;

  // ---- things ----
  const things = $derived.by(() => {
    if (d.kind !== 'things') return null;
    const n = d.items.length;
    if (d.sorted) {
      const kinds = [...new Set(d.items)], cell = 38;
      const rows = kinds.map(k => d.items.filter(x => x === k));
      const W = 20 + Math.max(...rows.map(r => r.length)) * cell, H = 12 + rows.length * (cell + 6);
      return { W, H, cell, at: rows.flatMap((r, ri) => r.map((p, i) => ({ p, x: 10 + i * cell, y: 8 + ri * (cell + 6), r: 0 }))) };
    }
    const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.9))), cell = 40, rows = Math.ceil(n / cols);
    return { W: 16 + cols * cell, H: 14 + rows * cell, cell, at: d.items.map((p, i) => ({ p, x: 8 + (i % cols) * cell + (wob(i, 1) - 0.5) * 10, y: 6 + Math.floor(i / cols) * cell + (wob(i, 2) - 0.5) * 8, r: (wob(i, 3) - 0.5) * 30 })) };
  });

  // ---- picture graph ----
  const pg = $derived.by(() => {
    if (d.kind !== 'picgraph') return null;
    const cell = 34, label = 104, top = d.title ? 30 : 8;
    const most = Math.max(...d.cats.map(c => Math.ceil(c.n / d.per)));
    const W = label + 14 + Math.max(5, most) * cell + 10, H = top + d.cats.length * (cell + 8) + 36;
    return { cell, label, top, W, H };
  });

  // ---- bars ----
  const bl = $derived(d.kind === 'bars' ? barLayout(d) : null);
  const barLines = $derived(d.kind === 'bars' ? Array.from({ length: Math.round(d.max / d.step) + 1 }, (_, i) => i * d.step) : []);

  // ---- line plots ----
  const ll = $derived.by(() => {
    if (d.kind !== 'line') return null;
    const L = lineLayout(d, 1);
    const counts = Array.from({ length: L.ticks }, () => 0);
    for (const v of d.marks) counts[L.tickOf(v)]++;
    return { ...lineLayout(d, Math.max(...counts)), counts };
  });
  const tickText = (t: number) => (d.kind === 'line' ? fracText(d.min + t / d.den, d.den) : '');

  // ---- histogram ----
  const hl = $derived.by(() => {
    if (d.kind !== 'hist') return null;
    const top = d.title ? 34 : 10, left = 40, bw = Math.min(64, 300 / d.bins.length), H = 236, bottom = H - 34;
    const max = Math.ceil(Math.max(...d.bins.map(b => b.n)) / d.step) * d.step + d.step;
    return { top, left, bw, H, bottom, max, W: left + d.bins.length * bw + 24, y: (v: number) => bottom - (v / max) * (bottom - top) };
  });

  // ---- box plot ----
  const bx = $derived.by(() => {
    if (d.kind !== 'box') return null;
    const top = d.title ? 30 : 8, left = 26, W = 420, len = W - left * 2, lineY = top + 92;
    return { top, left, W, H: lineY + 40, lineY, x: (v: number) => left + ((v - d.lo) / (d.hi - d.lo)) * len, minor: (d.five.some(v => v % d.step) ? d.step / 2 : 0) };
  });

  // ---- list ----
  const cards = $derived(d.kind === 'list' ? d.values.map(v => (d.den ? fracText(v, d.den) : String(v))) : []);
  const cw = $derived(Math.max(46, ...cards.map(c => c.length * 15 + 22)));

  // ---- towers ----
  const tw = $derived.by(() => {
    if (d.kind !== 'towers') return null;
    const b = 26, max = Math.max(...d.heights);
    return { b, W: 20 + d.heights.length * (b + 22), H: 18 + max * b + 8 };
  });
  const TOWER = ['#4a95f2', '#f0679f', '#ffc23d', '#5cc96a', '#a46cf0', '#ff9840'];

  // ---- spinner ----
  function wedge(i: number, n: number, r = 46) {
    if (n === 1) return `M50,54 m-${r},0 a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${r * 2},0`;
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const p = (a: number) => `${(50 + r * Math.cos(a)).toFixed(2)},${(54 + r * Math.sin(a)).toFixed(2)}`;
    return `M50,54 L${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${p(a1)} Z`;
  }

  // ---- bag (a glass jar of marbles) ----
  const jar = $derived.by(() => {
    if (d.kind !== 'bag') return null;
    const all = d.marbles.flatMap(m => Array.from({ length: m.n }, () => m.color));
    // mixed up the same way every time
    const order = all.map((c, i) => ({ c, k: wob(i, 7) })).sort((a, b) => a.k - b.k).map(x => x.c);
    const n = order.length, per = n <= 6 ? 3 : n <= 12 ? 4 : 5, r = n <= 6 ? 11 : n <= 12 ? 9.5 : 8;
    const rows = Math.ceil(n / per), W = 100, floor = 128;
    return { r, W, rows, at: order.map((c, i) => { const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per); return { c, x: 50 + (col - (inRow - 1) / 2) * r * 2.05 + (row % 2 ? r * 0.5 : 0) * (inRow < per ? 0 : 1) - (row % 2 ? r * 0.25 : 0), y: floor - r - row * r * 1.8 }; }) };
  });

  // ---- dice ----
  const PIPS: Record<number, [number, number][]> = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
  const faces = $derived(d.kind === 'dice' ? (d.faces.length ? d.faces : [1, 2, 3, 4, 5, 6]) : []);
  const allSix = $derived(d.kind === 'dice' && !d.faces.length);

  // ---- tree ----
  const tree = $derived.by(() => {
    if (d.kind !== 'tree') return null;
    const L = d.levels, leaves = L.reduce((t, l) => t * l.length, 1);
    const rowH = leaves > 12 ? 16 : leaves > 8 ? 19 : 24, H = leaves * rowH + 16;
    const W = 26 + L.length * 112 + 8;
    const nodes: { x: number; y: number; t: string; px: number; py: number; lv: number }[] = [];
    // a node's y is the middle of the leaves under it
    const under = (lv: number) => L.slice(lv + 1).reduce((t, l) => t * l.length, 1);
    function walk(lv: number, start: number, px: number, py: number) {
      L[lv].forEach((t, i) => {
        const s = start + i * under(lv), y = 8 + (s + under(lv) / 2) * rowH, x = 26 + lv * 112 + 8;
        nodes.push({ x, y, t, px, py, lv });
        if (lv + 1 < L.length) walk(lv + 1, s, x + 86, y);
      });
    }
    walk(0, 0, 10, H / 2);
    return { W, H, nodes, rowH, small: leaves > 8 };
  });

  // ---- results ----
  const res = $derived(d.kind === 'results' ? d : null);

  /** how tall it draws, by kind (a graph needs more room than a die) */
  const scale = $derived(({ things: 1, prize: 0.42, picgraph: 1.2, bars: 1.3, tally: 0.9, line: 1.2, hist: 1.3, box: 0.9, list: 0.36, towers: 0.95, spinner: 0.85, bag: 0.95, dice: 0.5, tree: 1.1, results: 0.7 } as Record<string, number>)[d.kind] ?? 1);
  const vb = $derived.by((): [number, number] => {
    switch (d.kind) {
      case 'things': return [things!.W, things!.H];
      case 'prize': return [40, 40];
      case 'picgraph': return [pg!.W, pg!.H];
      case 'bars': return [bl!.W, bl!.H];
      case 'tally': return [230, 22 + d.cats.length * 34];
      case 'line': return [ll!.W, ll!.H];
      case 'hist': return [hl!.W, hl!.H];
      case 'box': return [bx!.W, bx!.H];
      case 'list': return [cards.length * (cw + 8) + 4, 54];
      case 'towers': return [tw!.W, tw!.H];
      case 'spinner': return [100, 104];
      case 'bag': return [100, 150];
      case 'dice': return allSix ? [6 * 40 + 8, 44] : [faces.length * 58 + 6, 58];
      case 'tree': return [tree!.W, tree!.H];
      case 'results': return [210, 14 + (d.rows.length + (d.total ? 1 : 0)) * 28];
    }
  });
  const hpx = $derived(Math.round(size * scale));
  const wpx = $derived(Math.round((hpx * vb[0]) / vb[1]));
</script>

<svg class="dp {d.kind}" viewBox="0 0 {vb[0]} {vb[1]}" width={wpx} height={hpx} role="img" aria-label={d.kind}>
  <defs>
    <linearGradient id="{uid}card" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6" /><stop offset="1" stop-color="#fff3dc" /></linearGradient>
    <radialGradient id="{uid}gloss" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".85" /><stop offset=".35" stop-color="#fff" stop-opacity=".15" /><stop offset="1" stop-color="#000" stop-opacity=".18" /></radialGradient>
    <linearGradient id="{uid}bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".35" /><stop offset=".45" stop-color="#fff" stop-opacity="0" /><stop offset="1" stop-color="#000" stop-opacity=".12" /></linearGradient>
    <filter id="{uid}sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="#6b3d10" flood-opacity=".28" /></filter>
    <clipPath id="{uid}half"><rect x="0" y="0" width="0.5" height="1" /></clipPath>
  </defs>

  {#if d.kind === 'things' && things}
    {#each things.at as t, i (i)}
      <image href={prize(t.p)} x={t.x} y={t.y} width={things.cell - 2} height={things.cell - 2} transform="rotate({t.r} {t.x + things.cell / 2} {t.y + things.cell / 2})" filter="url(#{uid}sh)" />
    {/each}

  {:else if d.kind === 'prize'}
    <image href={prize(d.prize)} x="2" y="2" width="36" height="36" filter="url(#{uid}sh)" />

  {:else if d.kind === 'picgraph' && pg}
    <rect x="1" y="1" width={pg.W - 2} height={pg.H - 2} rx="14" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#if d.title}<text class="title" x={pg.W / 2} y="21">{d.title}</text>{/if}
    {#each d.cats as c, ri (ri)}
      {@const y = pg.top + ri * (pg.cell + 8)}
      <rect x="6" y={y - 2} width={pg.W - 12} height={pg.cell + 4} rx="8" fill={ri % 2 ? '#fff' : '#fff8ea'} />
      {#if c.prize}<image href={prize(c.prize)} x="8" y={y} width={pg.cell - 4} height={pg.cell - 4} />{/if}
      <text class="lbl" x="44" y={y + pg.cell / 2 + 5}>{c.name}</text>
      <line x1={pg.label + 4} y1={y - 2} x2={pg.label + 4} y2={y + pg.cell + 2} stroke="#e7cfa4" stroke-width="2" />
      {#each Array(Math.ceil(c.n / d.per)) as _, k (k)}
        {@const half = k === Math.ceil(c.n / d.per) - 1 && c.n % d.per !== 0}
        {#if c.prize}
          {#if half}
            <svg x={pg.label + 12 + k * pg.cell} y={y} width={pg.cell - 3} height={pg.cell - 3} viewBox="0 0 1 1" preserveAspectRatio="none"><image href={prize(c.prize)} x="0" y="0" width="1" height="1" clip-path="url(#{uid}half)" /></svg>
          {:else}
            <image href={prize(c.prize)} x={pg.label + 12 + k * pg.cell} y={y} width={pg.cell - 3} height={pg.cell - 3} filter="url(#{uid}sh)" />
          {/if}
        {/if}
      {/each}
    {/each}
    <!-- the key -->
    {@const ky = pg.H - 26}
    <rect x={pg.W / 2 - 90} y={ky - 4} width="180" height="26" rx="13" fill="#fff" stroke="#f3b44d" stroke-width="2" />
    {#if d.cats[0]?.prize}<image href={prize(d.cats[0].prize)} x={pg.W / 2 - 80} y={ky - 2} width="22" height="22" />{/if}
    <text class="key" x={pg.W / 2 + 14} y={ky + 14}>stands for {d.per}</text>

  {:else if d.kind === 'bars' && bl}
    <rect x="1" y="1" width={bl.W - 2} height={bl.H - 2} rx="14" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#if d.title}<text class="title" x={bl.W / 2} y="21">{d.title}</text>{/if}
    {#each barLines as v, li (li)}
      {#if bl.flip}
        <line x1={bl.left + bl.size(v)} y1={bl.top} x2={bl.left + bl.size(v)} y2={bl.bottom} class="grid" class:zero={v === 0} />
        {#if barLines.length <= 11 || li % 2 === 0}<text class="axis" x={bl.left + bl.size(v)} y={bl.bottom + 18}>{v}</text>{/if}
      {:else}
        <line x1={bl.left} y1={bl.bottom - bl.size(v)} x2={bl.W - 8} y2={bl.bottom - bl.size(v)} class="grid" class:zero={v === 0} />
        <text class="axis" x={bl.left - 8} y={bl.bottom - bl.size(v) + 5} text-anchor="end">{v}</text>
      {/if}
    {/each}
    {#each d.cats as c, i (i)}
      {@const col = COLOR[c.color ?? 'blue']}
      {@const empty = hideBar && d.hide === i}
      {#if bl.flip}
        {#if empty}<rect x={bl.left} y={bl.at(i) - bl.bar / 2} width={bl.len} height={bl.bar} rx="6" fill="none" stroke={col.hex} stroke-width="2" stroke-dasharray="5 5" opacity=".7" />
        {:else}<rect x={bl.left} y={bl.at(i) - bl.bar / 2} width={bl.size(c.n)} height={bl.bar} rx="6" fill={col.hex} stroke={col.deep} stroke-width="2" /><rect x={bl.left} y={bl.at(i) - bl.bar / 2} width={bl.size(c.n)} height={bl.bar} rx="6" fill="url(#{uid}bar)" />{/if}
        <text class="lbl end" x={bl.left - 8} y={bl.at(i) + 5}>{c.name}</text>
      {:else}
        {#if empty}<rect x={bl.at(i) - bl.bar / 2} y={bl.top} width={bl.bar} height={bl.len} rx="6" fill="none" stroke={col.hex} stroke-width="2" stroke-dasharray="5 5" opacity=".7" />
        {:else}<rect x={bl.at(i) - bl.bar / 2} y={bl.bottom - bl.size(c.n)} width={bl.bar} height={bl.size(c.n)} rx="6" fill={col.hex} stroke={col.deep} stroke-width="2" /><rect x={bl.at(i) - bl.bar / 2} y={bl.bottom - bl.size(c.n)} width={bl.bar} height={bl.size(c.n)} rx="6" fill="url(#{uid}bar)" />{/if}
        <text class="lbl mid" x={bl.at(i)} y={bl.bottom + 20}>{c.name}</text>
      {/if}
    {/each}

  {:else if d.kind === 'tally'}
    <rect x="1" y="1" width="228" height={20 + d.cats.length * 34} rx="12" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#each d.cats as c, i (i)}
      {@const y = 12 + i * 34}
      <text class="lbl" x="12" y={y + 21}>{c.name}</text>
      {#each Array(c.n) as _, k (k)}
        {@const g = Math.floor(k / 5)}
        {@const j = k % 5}
        {#if j < 4}<line x1={96 + g * 34 + j * 6} y1={y + 6} x2={96 + g * 34 + j * 6} y2={y + 28} stroke="#5b3416" stroke-width="3" stroke-linecap="round" />
        {:else}<line x1={92 + g * 34} y1={y + 24} x2={118 + g * 34} y2={y + 9} stroke="#c0392b" stroke-width="3" stroke-linecap="round" />{/if}
      {/each}
    {/each}

  {:else if d.kind === 'line' && ll}
    <rect x="1" y="1" width={ll.W - 2} height={ll.H - 2} rx="14" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#if d.title}<text class="title" x={ll.W / 2} y="21">{d.title}</text>{/if}
    <line x1={ll.left - 14} y1={ll.lineY} x2={ll.W - ll.left + 14} y2={ll.lineY} stroke="#5b3416" stroke-width="3" stroke-linecap="round" />
    {#each Array(ll.ticks) as _, t (t)}
      {@const whole = d.den === 1 || t % d.den === 0}
      <line x1={ll.x(t)} y1={ll.lineY - (whole ? 8 : 5)} x2={ll.x(t)} y2={ll.lineY + (whole ? 8 : 5)} stroke="#5b3416" stroke-width={whole ? 3 : 2} />
      <text class="tick" class:small={tickText(t).length > 3} class:faint={!whole && ll.gap < 40} x={ll.x(t)} y={ll.lineY + 28}>{tickText(t)}</text>
      {#each Array(ll.counts[t]) as _, k (k)}
        <circle cx={ll.x(t)} cy={ll.lineY - 14 - k * ll.dot * 2.1} r={ll.dot} fill="#ff7aa8" stroke="#c23d6c" stroke-width="1.5" />
        <circle cx={ll.x(t)} cy={ll.lineY - 14 - k * ll.dot * 2.1} r={ll.dot} fill="url(#{uid}gloss)" />
      {/each}
    {/each}

  {:else if d.kind === 'hist' && hl}
    <rect x="1" y="1" width={hl.W - 2} height={hl.H - 2} rx="14" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#if d.title}<text class="title" x={hl.W / 2} y="22">{d.title}</text>{/if}
    {#each Array(Math.round(hl.max / d.step) + 1) as _, i (i)}
      <line x1={hl.left} y1={hl.y(i * d.step)} x2={hl.W - 14} y2={hl.y(i * d.step)} class="grid" class:zero={i === 0} />
      <text class="axis" x={hl.left - 8} y={hl.y(i * d.step) + 5} text-anchor="end">{i * d.step}</text>
    {/each}
    {#each d.bins as b, i (i)}
      <rect x={hl.left + 4 + i * hl.bw} y={hl.y(b.n)} width={hl.bw} height={hl.bottom - hl.y(b.n)} fill={i % 2 ? '#4fb6a8' : '#5fc8b9'} stroke="#2a7f73" stroke-width="2" />
      <rect x={hl.left + 4 + i * hl.bw} y={hl.y(b.n)} width={hl.bw} height={hl.bottom - hl.y(b.n)} fill="url(#{uid}bar)" />
      <text class="axis mid" x={hl.left + 4 + i * hl.bw} y={hl.bottom + 18}>{b.lo}</text>
    {/each}
    <text class="axis mid" x={hl.left + 4 + d.bins.length * hl.bw} y={hl.bottom + 18}>{d.bins.at(-1)?.hi}</text>

  {:else if d.kind === 'box' && bx}
    {@const [mn, q1, md, q3, mx] = d.five}
    <rect x="1" y="1" width={bx.W - 2} height={bx.H - 2} rx="14" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#if d.title}<text class="title" x={bx.W / 2} y="21">{d.title}</text>{/if}
    <line x1={bx.x(mn)} y1={bx.top + 36} x2={bx.x(q1)} y2={bx.top + 36} stroke="#5b3416" stroke-width="3" />
    <line x1={bx.x(q3)} y1={bx.top + 36} x2={bx.x(mx)} y2={bx.top + 36} stroke="#5b3416" stroke-width="3" />
    <line x1={bx.x(mn)} y1={bx.top + 22} x2={bx.x(mn)} y2={bx.top + 50} stroke="#5b3416" stroke-width="3" />
    <line x1={bx.x(mx)} y1={bx.top + 22} x2={bx.x(mx)} y2={bx.top + 50} stroke="#5b3416" stroke-width="3" />
    <rect x={bx.x(q1)} y={bx.top + 12} width={bx.x(q3) - bx.x(q1)} height="48" rx="4" fill="#ffd36b" stroke="#c99410" stroke-width="2.5" />
    <rect x={bx.x(q1)} y={bx.top + 12} width={bx.x(q3) - bx.x(q1)} height="48" rx="4" fill="url(#{uid}bar)" />
    <line x1={bx.x(md)} y1={bx.top + 12} x2={bx.x(md)} y2={bx.top + 60} stroke="#c0392b" stroke-width="4" />
    <line x1={bx.left} y1={bx.lineY} x2={bx.W - bx.left} y2={bx.lineY} stroke="#5b3416" stroke-width="2.5" />
    {#each Array(Math.round((d.hi - d.lo) / d.step) + 1) as _, i (i)}
      <line x1={bx.x(d.lo + i * d.step)} y1={bx.lineY - 7} x2={bx.x(d.lo + i * d.step)} y2={bx.lineY + 7} stroke="#5b3416" stroke-width="2.5" />
      <text class="axis mid" x={bx.x(d.lo + i * d.step)} y={bx.lineY + 26}>{d.lo + i * d.step}</text>
      {#if bx.minor && i < (d.hi - d.lo) / d.step}<line x1={bx.x(d.lo + i * d.step + bx.minor)} y1={bx.lineY - 4} x2={bx.x(d.lo + i * d.step + bx.minor)} y2={bx.lineY + 4} stroke="#5b3416" stroke-width="1.5" />{/if}
    {/each}

  {:else if d.kind === 'list'}
    {#each cards as c, i (i)}
      <g transform="translate({4 + i * (cw + 8)} 4)">
        <rect width={cw} height="44" rx="10" fill="#fff" stroke="#f3b44d" stroke-width="2.5" filter="url(#{uid}sh)" />
        <text class="card" x={cw / 2} y="31">{c}</text>
      </g>
    {/each}

  {:else if d.kind === 'towers' && tw}
    <line x1="4" y1={tw.H - 7} x2={tw.W - 4} y2={tw.H - 7} stroke="#b98a5a" stroke-width="4" stroke-linecap="round" />
    {#each d.heights as h, i (i)}
      {#each Array(h) as _, k (k)}
        <rect x={14 + i * (tw.b + 22)} y={tw.H - 9 - (k + 1) * tw.b} width={tw.b - 1} height={tw.b - 1} rx="4" fill={TOWER[i % TOWER.length]} stroke="rgba(0,0,0,.2)" stroke-width="1.5" />
        <rect x={14 + i * (tw.b + 22) + 3} y={tw.H - 9 - (k + 1) * tw.b + 3} width={tw.b - 12} height="5" rx="2.5" fill="#fff" opacity=".45" />
      {/each}
    {/each}

  {:else if d.kind === 'spinner'}
    <circle cx="50" cy="56" r="49" fill="#7a4a1c" opacity=".25" />
    <circle cx="50" cy="54" r="49" fill="#ffe08a" stroke="#c99410" stroke-width="2" />
    {#each d.parts as c, i (i)}<path d={wedge(i, d.parts.length)} fill={COLOR[c].hex} stroke="#fff" stroke-width="1.6" stroke-linejoin="round" />{/each}
    <circle cx="50" cy="54" r="46" fill="url(#{uid}gloss)" opacity=".5" />
    <polygon points="50,40 45.5,58 54.5,58" fill="#3a2a1a" transform="rotate(28 50 54)" />
    <circle cx="50" cy="54" r="6" fill="#fff4cf" stroke="#c99410" stroke-width="2" />
    <polygon points="44,1 56,1 50,12" fill="#e0405a" stroke="#fff" stroke-width="1.5" />

  {:else if d.kind === 'bag' && jar}
    <!-- a glass jar of marbles -->
    <rect x="16" y="22" width="68" height="114" rx="18" fill="#e8f6ff" opacity=".55" stroke="#9fc9e6" stroke-width="2.5" />
    <rect x="22" y="12" width="56" height="14" rx="5" fill="#d9a35a" stroke="#9c6a2b" stroke-width="2" />
    {#each jar.at as m, i (i)}
      <circle cx={m.x} cy={m.y} r={jar.r} fill={MARBLE(m.c).hex} stroke={MARBLE(m.c).deep} stroke-width="1.4" />
      <circle cx={m.x} cy={m.y} r={jar.r} fill="url(#{uid}gloss)" />
    {/each}
    <rect x="22" y="30" width="7" height="90" rx="3.5" fill="#fff" opacity=".55" />

  {:else if d.kind === 'dice'}
    {#each faces as f, i (i)}
      {@const s = allSix ? 36 : 52}
      {@const x = 4 + i * (allSix ? 40 : 58)}
      <rect x={x} y="3" width={s} height={s} rx={s * 0.2} fill="#fff" stroke="#c9b9a6" stroke-width="2" filter="url(#{uid}sh)" />
      {#each PIPS[f] ?? [] as [px, py], k (k)}<circle cx={x + s * (0.25 + px * 0.25)} cy={3 + s * (0.25 + py * 0.25)} r={s * 0.085} fill={f === 1 ? '#e0405a' : '#2c2236'} />{/each}
    {/each}

  {:else if d.kind === 'tree' && tree}
    {#each tree.nodes as n, i (i)}
      <path d="M{n.px},{n.py} C{(n.px + n.x) / 2},{n.py} {(n.px + n.x) / 2},{n.y} {n.x - 2},{n.y}" fill="none" stroke="#b98a5a" stroke-width="2.5" />
    {/each}
    <circle cx="10" cy={tree.H / 2} r="6" fill="#f3b44d" />
    {#each tree.nodes as n, i (i)}
      <rect x={n.x - 2} y={n.y - tree.rowH * 0.42} width="84" height={tree.rowH * 0.84} rx="7" fill={n.lv === 0 ? '#ffe7f0' : n.lv === 1 ? '#e6f2ff' : '#eafbe9'} stroke="#e1c9a3" stroke-width="1.5" />
      <text class="node" class:small={tree.small} x={n.x + 40} y={n.y + (tree.small ? 4 : 5)}>{n.t}</text>
    {/each}

  {:else if res}
    <rect x="1" y="1" width="208" height={12 + (res.rows.length + (res.total ? 1 : 0)) * 28} rx="12" fill="url(#{uid}card)" stroke="#f0d9b0" stroke-width="2" />
    {#each res.rows as r, i (i)}
      {#if r.color}<circle cx="20" cy={20 + i * 28} r="8" fill={COLOR[r.color].hex} stroke={COLOR[r.color].deep} stroke-width="1.5" />{/if}
      <text class="lbl" x="36" y={26 + i * 28}>{r.name}</text>
      <text class="lbl end" x="196" y={26 + i * 28}>{r.n}</text>
    {/each}
    {#if res.total}
      <line x1="10" y1={8 + res.rows.length * 28} x2="200" y2={8 + res.rows.length * 28} stroke="#e1c9a3" stroke-width="2" />
      <text class="lbl b" x="36" y={26 + res.rows.length * 28}>Tries</text>
      <text class="lbl b end" x="196" y={26 + res.rows.length * 28}>{res.rows.reduce((t, r) => t + r.n, 0)}</text>
    {/if}
  {/if}
</svg>

<style>
  .dp { display: inline-block; max-width: 100%; height: auto; overflow: visible; vertical-align: middle; }
  .dp text { font-family: var(--font-ui); fill: #4a2c12; }
  .title { font-size: 15px; font-weight: 600; text-anchor: middle; fill: #8a4b12 !important; }
  .lbl { font-size: 14px; font-weight: 600; }
  .lbl.end { text-anchor: end; }
  .lbl.mid { text-anchor: middle; }
  .lbl.b { font-weight: 700; }
  .key { font-size: 13px; font-weight: 600; text-anchor: middle; }
  .axis { font-size: 12px; font-weight: 600; fill: #7a5a3a !important; }
  .axis.mid, .tick { text-anchor: middle; }
  .tick { font-size: 14px; font-weight: 600; }
  .tick.small { font-size: 11.5px; }
  .tick.faint { font-size: 10.5px; }
  .grid { stroke: #ead7b8; stroke-width: 1.5; }
  .grid.zero { stroke: #7a5a3a; stroke-width: 2.5; }
  .card { font-size: 22px; font-weight: 600; text-anchor: middle; }
  .node { font-size: 12.5px; font-weight: 600; text-anchor: middle; }
  .node.small { font-size: 10.5px; }
</style>
