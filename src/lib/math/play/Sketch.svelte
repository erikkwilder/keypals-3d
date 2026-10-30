<script lang="ts">
  // Star Sketch: a chalkboard map in an ice cave, and the pairs of a picture listed beside it. Tap each
  // point in turn: a gold star lands there and a line of light joins it to the last, until the picture
  // appears. On the mirror levels half the picture is drawn already: flip each point over the axis. No
  // clock; a wrong tap says what was right. Two pictures a round. The pictures are in math/integers/sketch.ts.
  import { onDestroy, untrack } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { slipStars } from '../playground';
  import { SKETCH_LEVELS, pairOf, sketchHint, sketchRound, sketchTasks, type P } from '../integers/sketch';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let corner: HTMLDivElement | undefined = $state();
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  // a new level remakes this whole round (the Playground keys it), so the first level is the one to use
  const lv = untrack(() => level);
  const mirror = SKETCH_LEVELS[lv - 1].mirror;
  const pictures = sketchRound(lv, mulberry32(Date.now() % 1e9));
  const t0 = performance.now();
  let pi = $state(0), ti = $state(0);
  let placed = $state<P[]>([]);
  let slips = $state(0);
  let note = $state('');
  let flash = $state<{ at: P; k: number } | null>(null);
  let finished = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  const pic = $derived(pictures[pi]);
  const plan = $derived(sketchTasks(pic, mirror));
  const task = $derived(plan.tasks[ti] ?? null);
  const g = $derived(pic.grid);
  // the board's own units: a square per step, a margin for the numbers
  const S = 44, M = 34;
  const W = $derived((g.xMax - g.xMin) * S + 2 * M), H = $derived((g.yMax - g.yMin) * S + 2 * M);
  const X = (x: number) => M + (x - g.xMin) * S, Y = (y: number) => M + (g.yMax - y) * S;
  const same = (a: P, b: P) => a.x === b.x && a.y === b.y;
  const shown = (q: P) => plan.given.some(x => same(x, q)) || placed.some(x => same(x, q));
  /** the lines to draw: each stroke's neighbours, once both ends are on the board */
  const lines = $derived(pic.strokes.flatMap(s => {
    const n = s.pts.length, out: [P, P][] = [];
    for (let i = 0; i < n - (s.closed ? 0 : 1); i++) { const a = s.pts[i], b = s.pts[(i + 1) % n]; if (shown(a) && shown(b)) out.push([a, b]); }
    return out;
  }));
  const txt = (n: number) => (n < 0 ? `−${-n}` : String(n));
  let svg: SVGSVGElement | undefined = $state();

  function tap(e: PointerEvent) {
    if (!svg || !task || finished) return;
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * (W / r.width), sy = (e.clientY - r.top) * (H / r.height);
    const q = { x: Math.round((sx - M) / S + g.xMin), y: Math.round(g.yMax - (sy - M) / S) };
    if (q.x < g.xMin || q.x > g.xMax || q.y < g.yMin || q.y > g.yMax) return;
    if (same(q, task.at)) {
      placed = [...placed, q]; sfx.ding(Math.min(8, ti)); note = '';
      if (ti + 1 < plan.tasks.length) { ti++; return; }
      // the picture is done
      finished = true; sfx.complete(); pal?.cheer();
      note = `You drew ${pic.name}!`;
      timers.push(setTimeout(() => {
        if (pi + 1 >= pictures.length) { ondone({ stars: slipStars(slips), ms: performance.now() - t0 }); return; }
        pi++; ti = 0; placed = []; finished = false; note = '';
      }, 2200));
    } else {
      slips++; sfx.miss(); pal?.oops();
      flash = { at: q, k: Date.now() };
      note = sketchHint(task, q);
    }
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Enter' && finished) e.preventDefault(); }
</script>

<svelte:window onkeydown={onKey} />

<div class="sk">
  <div class="top"><span class="dots">{#each pictures as _, k}<i class:done={k < pi || (k === pi && finished)} class:now={k === pi}></i>{/each}</span></div>
  <div class="row">
    <div class="boardwrap" style:--paper="url({base}math/integers/paper.webp)">
      <svg bind:this={svg} viewBox="0 0 {W} {H}" class="board" onpointerdown={tap} role="img" aria-label="A drawing grid">
        <defs>
          <radialGradient id="skStar" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#fffbe0" /><stop offset=".35" stop-color="#ffd84d" /><stop offset="1" stop-color="#d9900f" /></radialGradient>
          <filter id="skGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect x="0" y="0" width={W} height={H} rx="22" fill="#24425f" />
        <rect x="6" y="6" width={W - 12} height={H - 12} rx="18" fill="#2c5275" />
        {#each Array(g.xMax - g.xMin + 1) as _, i (i)}
          {@const x = g.xMin + i}
          <line x1={X(x)} y1={M} x2={X(x)} y2={H - M} stroke={x === 0 ? '#e9f4ff' : 'rgba(220, 238, 255, .22)'} stroke-width={x === 0 ? 3 : 1.5} />
        {/each}
        {#each Array(g.yMax - g.yMin + 1) as _, j (j)}
          {@const y = g.yMin + j}
          <line x1={M} y1={Y(y)} x2={W - M} y2={Y(y)} stroke={y === 0 ? '#e9f4ff' : 'rgba(220, 238, 255, .22)'} stroke-width={y === 0 ? 3 : 1.5} />
        {/each}
        {#each Array(g.xMax - g.xMin + 1) as _, i (i)}
          {@const x = g.xMin + i}
          {#if x !== 0}<text x={X(x)} y={(g.yMin <= 0 ? Y(0) : H - M) + 20} text-anchor="middle" class="lab">{txt(x)}</text>{/if}
        {/each}
        {#each Array(g.yMax - g.yMin + 1) as _, j (j)}
          {@const y = g.yMin + j}
          {#if y !== 0}<text x={(g.xMin <= 0 ? X(0) : M) - 8} y={Y(y) + 6} text-anchor="end" class="lab">{txt(y)}</text>{/if}
        {/each}
        <text x={X(0) - 8} y={Y(0) + 20} text-anchor="end" class="lab">0</text>
        <!-- the mirror's line glows on the mirror levels -->
        {#if mirror === 'y'}<line x1={X(0)} y1={M - 6} x2={X(0)} y2={H - M + 6} stroke="#7fe0ff" stroke-width="7" opacity=".55" filter="url(#skGlow)" />{/if}
        {#if mirror === 'x'}<line x1={M - 6} y1={Y(0)} x2={W - M + 6} y2={Y(0)} stroke="#7fe0ff" stroke-width="7" opacity=".55" filter="url(#skGlow)" />{/if}
        <!-- the picture filled in, once it's done -->
        {#if finished}
          {#each pic.strokes.filter(s => s.closed) as s, k (k)}<polygon points={s.pts.map(q => `${X(q.x)},${Y(q.y)}`).join(' ')} fill={pic.color} opacity=".45" class="fill" />{/each}
        {/if}
        {#each lines as [a, b], k (k)}<line x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} stroke="#ffe27a" stroke-width="5" stroke-linecap="round" filter="url(#skGlow)" class="ln" />{/each}
        {#each plan.given as q, k (k)}<circle cx={X(q.x)} cy={Y(q.y)} r="9" fill="url(#skStar)" stroke="#fff" stroke-width="2.5" />{/each}
        {#each placed as q, k (k)}<circle cx={X(q.x)} cy={Y(q.y)} r="10" fill="url(#skStar)" stroke="#fff" stroke-width="3" class="pop" />{/each}
        <!-- the point a mirror task flips glows -->
        {#if task?.from && !finished}<circle cx={X(task.from.x)} cy={Y(task.from.y)} r="17" fill="none" stroke="#7fe0ff" stroke-width="3.5" class="pulse" />{/if}
        {#if flash}{#key flash.k}<circle cx={X(flash.at.x)} cy={Y(flash.at.y)} r="14" fill="none" stroke="#ff7a6b" stroke-width="4" class="flash" />{/key}{/if}
      </svg>
    </div>
    <div class="side">
      <div class="list" aria-label="The points to plot">
        {#each plan.tasks as t, k (k)}
          <span class="chip" class:done={k < ti || finished} class:now={k === ti && !finished}>{#if t.from}<small>flip</small>{pairOf(t.from)}{:else}{pairOf(t.at)}{/if}</span>
        {/each}
      </div>
      <!-- your buddy watches the stars land from here -->
      <div class="corner" bind:this={corner}></div>
    </div>
  </div>
  <p class="note" class:good={finished}>{note || (task ? (task.from ? `Flip ${pairOf(task.from)} over the ${task.axis}-axis. Tap where it lands.` : `Tap ${pairOf(task.at)}: across first, then up or down.`) : '')}</p>
</div>

<style>
  .sk { width: min(1040px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; justify-content: center; }
  .dots { display: flex; gap: 6px; justify-content: center; background: rgba(255, 255, 255, .9); border-radius: 20px; padding: 6px 14px; box-shadow: var(--shadow-sm); }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; }
  .dots i.done { background: #f2b51e; } .dots i.now { box-shadow: 0 0 0 3px #f2b51e; }
  .row { display: flex; gap: 14px; align-items: stretch; }
  .boardwrap { flex: 1; min-width: 0; display: grid; place-items: center; padding: 12px; border-radius: 28px; background: linear-gradient(rgba(150, 100, 50, .15), rgba(150, 100, 50, .15)), var(--paper) center / cover; box-shadow: 0 0 0 5px #a8784a, 0 0 0 9px #7a5232, 0 12px 26px rgba(40, 30, 10, .35); }
  .board { width: 100%; max-height: min(64vh, 620px); height: auto; cursor: crosshair; touch-action: none; }
  .lab { font: 700 17px var(--font-ui); fill: #cfe6ff; }
  .ln { animation: draw .45s ease-out; }
  @keyframes draw { from { opacity: 0; } }
  .pop { animation: pop .35s cubic-bezier(.3, 1.8, .5, 1); transform-box: fill-box; transform-origin: center; }
  @keyframes pop { from { transform: scale(2.2); opacity: .2; } }
  .fill { animation: fillin .8s ease-out; }
  @keyframes fillin { from { opacity: 0; } }
  .pulse { animation: pulse 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes pulse { 50% { transform: scale(1.25); opacity: .5; } }
  .flash { animation: flash .7s ease-out forwards; transform-box: fill-box; transform-origin: center; }
  @keyframes flash { to { transform: scale(1.8); opacity: 0; } }
  .side { flex: 0 0 clamp(170px, 22vw, 250px); display: flex; flex-direction: column; gap: 10px; }
  .list { display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start; background: rgba(255, 255, 255, .92); border-radius: 20px; padding: 10px; box-shadow: var(--shadow-sm); }
  .chip { display: inline-flex; align-items: center; gap: 4px; font: 600 18px var(--font-ui); color: #1f5f9e; background: #eef6fd; border-radius: 12px; padding: 3px 9px; white-space: nowrap; }
  .chip small { font: 800 10px var(--font-body); text-transform: uppercase; color: #3fa7c9; }
  .chip.done { background: #fff4c9; color: #8a5a00; text-decoration: line-through; text-decoration-color: rgba(138, 90, 0, .4); }
  .chip.now { background: linear-gradient(#ffe48a, #f2b51e); color: #5a3a00; box-shadow: 0 0 0 3px #fff, 0 0 18px rgba(242, 181, 30, .8); transform: scale(1.08); }
  .corner { flex: 1; min-height: 140px; }
  .note { margin: 0; font: 600 17px/1.35 var(--font-body); color: var(--ink2); background: #fff7d6; border-radius: 14px; padding: 10px 14px; text-align: center; }
  .note.good { background: #e2f7ee; color: #0f6a48; font-size: 20px; }
  @media (max-width: 700px) {
    .row { flex-direction: column; }
    .side { flex: 0 0 auto; flex-direction: row; }
    .list { flex: 1; flex-wrap: nowrap; overflow-x: auto; }
    .corner { flex: 0 0 90px; min-height: 90px; }
    .board { max-height: 52vh; }
    .chip { font-size: 16px; }
  }
</style>
