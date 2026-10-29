<script lang="ts">
  // A lesson's progress chart, like Animal Typing's: every try's speed and score, the goal line for
  // three stars, and the ride ladder up the side at the scores each ride needs.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { LESSON, REGION, lessonMove } from '../engine/course';
  import { lessonGoal, platinumScore, starScores } from '../engine/scoring';
  import { RIDE_SCORE, rideName } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import TileArt from './TileArt.svelte';
  import Stars from './Stars.svelte';

  const p = game.profile!;
  const id = game.chartLesson!;
  const lesson = LESSON[id];
  const grown = p.settings.grown;
  const goal = lessonGoal(lesson, grown, p.settings.easy);
  const [one, two] = starScores(goal);
  const plat = platinumScore(goal);
  const rec = p.lessons[id];
  // the last 20 tries; tries from before scores existed fall back to speed
  const tries = p.history.filter(h => h.lessonId === id).slice(-20).map(h => ({ wpm: Math.round(h.wpm), score: Math.round(h.score ?? h.wpm), stars: h.stars, ride: h.ride }));
  const best = rec?.bestScore ?? Math.max(0, ...tries.map(t => t.score));
  const avg = rec?.attempts && rec.scoreSum ? Math.round(rec.scoreSum / rec.attempts) : tries.length ? Math.round(tries.reduce((a, t) => a + t.score, 0) / tries.length) : 0;
  const th = grown ? RIDE_SCORE.grown : RIDE_SCORE.kids;

  // chart geometry
  const W = 660, H = 330, L = 44, R = 70, T = 14, B = 34;
  const top = Math.ceil(Math.max(goal * 1.6, ...tries.map(t => t.score * 1.12), 40) / 10) * 10;
  const step = top > 120 ? 40 : top > 60 ? 20 : 10;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const n = Math.max(3, tries.length);
  const x = (i: number) => L + (n === 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - Math.min(v, top) / top) * (H - T - B);
  const line = (key: 'wpm' | 'score') => tries.map((t, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(t[key]).toFixed(1)}`).join(' ');
  const rides = th.map((v, i) => ({ v, i })).filter(r => r.i > 0 && r.v <= top);

  function onKey(e: KeyboardEvent) {
    e.stopImmediatePropagation();
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); game.closeChart(); }
  }
  onMount(() => window.addEventListener('keydown', onKey, true));
  onDestroy(() => window.removeEventListener('keydown', onKey, true));
</script>

<div class="wrap" role="dialog" aria-label="Progress chart for {lesson.title}">
  <div class="sheet card">
    <div class="head">
      <TileArt kind="chart" size={48} />
      <div class="tt">
        <span class="muted">{REGION[lesson.region].name}</span>
        <h2>{lesson.title}</h2>
      </div>
      <button class="x" aria-label="Close" onclick={() => game.closeChart()}><TileArt kind="close" size={40} /></button>
    </div>

    {#if tries.length}
      <div class="legend"><span class="sw sp"></span> Speed <span class="sw sc"></span> Score <span class="sw gl"></span> Goal (3 stars)</div>
      <svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Speed and score for each try">
        {#each ticks as v (v)}
          <line x1={L} x2={W - R + 8} y1={y(v)} y2={y(v)} class="grid" />
          <text x={L - 8} y={y(v) + 5} class="ylab">{v}</text>
        {/each}
        {#each tries as _, i (i)}<text x={x(i)} y={H - 10} class="xlab">{i + 1}</text>{/each}
        <text x={(L + W - R) / 2} y={H + 2} class="xt">try</text>
        <line x1={L} x2={W - R + 8} y1={y(goal)} y2={y(goal)} class="goal" />
        {#if plat <= top}<line x1={L} x2={W - R + 8} y1={y(plat)} y2={y(plat)} class="plat" /><text x={L + 4} y={y(plat) - 6} class="platlab">platinum {plat}</text>{/if}
        <path d={line('wpm')} class="lsp" />
        <path d={line('score')} class="lsc" />
        {#each tries as t, i (i)}
          <circle cx={x(i)} cy={y(t.wpm)} r="7" class="dsp" />
          {#if t.stars >= 3}
            <circle cx={x(i)} cy={y(t.score)} r="11" class="d3" /><path d="M{x(i) - 5},{y(t.score)} l3.5,3.5 l6.5,-7" class="chk" />
          {:else}
            <circle cx={x(i)} cy={y(t.score)} r="9" class="dsc" />
          {/if}
        {/each}
        <!-- the ride ladder up the right side, at the live score each ride needs -->
        {#each rides as r (r.i)}
          <g transform="translate({W - R + 16 + (r.i % 2) * 26} {y(r.v) - 12})"><title>{rideName(r.i, lessonMove(lesson))}: {r.v}</title><svg width="24" height="24" viewBox="0 0 48 48">{@html rideIcon(r.i, '#8a7cb8', lessonMove(lesson))}</svg></g>
        {/each}
      </svg>
    {:else}
      <p class="empty">Play this lesson to start its chart. Every try adds a point for your speed and your score.</p>
    {/if}

    <div class="stats">
      <div><span class="muted">Goal</span><b>{goal}</b><Stars n={3} of={3} size={14} /></div>
      <div><span class="muted">Average</span><b>{avg}</b></div>
      <div><span class="muted">High score</span><b>{best}</b>{#if rec?.platinum}<em>✦ platinum</em>{/if}</div>
      <div><span class="muted">Stars at</span><b class="small">{one} · {two} · {goal}</b></div>
    </div>
  </div>
</div>

<style>
  .wrap { position: fixed; inset: 0; z-index: 85; display: grid; place-items: center; padding: 16px; background: rgba(60, 40, 110, .32); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
  .sheet { width: min(760px, 100%); max-height: calc(100vh - 32px); overflow: auto; padding: 18px 22px 20px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.3); }
  .head { display: flex; align-items: center; gap: 12px; }
  .tt { display: flex; flex-direction: column; }
  .tt .muted { font: 700 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; }
  .tt h2 { font-size: 26px; }
  .x { margin-left: auto; background: none; border: 0; cursor: pointer; padding: 0; align-self: flex-start; }
  .legend { display: flex; align-items: center; gap: 8px; margin: 12px 0 4px; font: 700 13px var(--font-body); color: var(--ink2); flex-wrap: wrap; }
  .sw { display: inline-block; width: 18px; height: 6px; border-radius: 3px; margin-left: 8px; }
  .sw.sp { background: #8f9cf7; } .sw.sc { background: #efd21c; } .sw.gl { background: #5fcf9f; }
  .chart { width: 100%; height: auto; display: block; overflow: visible; }
  .grid { stroke: #ece6f6; stroke-width: 1.5; }
  .ylab { font: 700 13px var(--font-body); fill: #8a80a6; text-anchor: end; }
  .xlab { font: 700 13px var(--font-body); fill: #8a80a6; text-anchor: middle; }
  .xt { font: 700 12px var(--font-body); fill: #b2a8c8; text-anchor: middle; }
  .goal { stroke: #5fcf9f; stroke-width: 5; opacity: .55; }
  .plat { stroke: #b8a4f5; stroke-width: 2.5; stroke-dasharray: 6 6; }
  .platlab { font: 800 11px var(--font-body); fill: #8a74d8; }
  .lsp { fill: none; stroke: #8f9cf7; stroke-width: 5; stroke-linejoin: round; stroke-linecap: round; }
  .lsc { fill: none; stroke: #efd21c; stroke-width: 7; stroke-linejoin: round; stroke-linecap: round; }
  .dsp { fill: #6f7ff0; stroke: #fff; stroke-width: 2.5; }
  .dsc { fill: #efd21c; stroke: #fff; stroke-width: 3; }
  .d3 { fill: #4fcf98; stroke: #fff; stroke-width: 3; }
  .chk { fill: none; stroke: #fff; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
  .empty { margin: 24px 0; text-align: center; font: 600 16px var(--font-body); color: var(--muted); }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
  .stats div { display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--bg2); border-radius: 16px; padding: 8px 4px; }
  .stats span { font: 700 12px var(--font-body); }
  .stats b { font: 600 26px/1 var(--font-ui); color: var(--ink); }
  .stats b.small { font-size: 17px; padding: 4px 0; }
  .stats em { font: 800 11px var(--font-body); font-style: normal; color: #7c5cf5; }
  @media (max-width: 560px) { .stats { grid-template-columns: repeat(2, 1fr); } }
</style>
