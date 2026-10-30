<script lang="ts">
  // An algebra picture in a question: a table of x and y on a white card, the same points as a graph on
  // squared paper with the straight line through them, a number line with a ray (RayLine), or the
  // painted balance (BalanceView). `size` is the question's picture size; the wide ones are twice it.
  import type { AlgPic } from '../algebra';
  import { fm } from '../algebra';
  import RayLine from './RayLine.svelte';
  import BalanceView from '../../algebra/BalanceView.svelte';
  type Props = { pic: AlgPic; size?: number };
  let { pic, size = 150 }: Props = $props();

  // ---- the graph: whole-number squares, both axes from 0 (or below, for a line that goes under) ----
  const g = $derived.by(() => {
    if (pic.kind !== 'graph') return null;
    const xs = pic.xs, ys = pic.ys;
    const x1 = Math.max(...xs) + 1, y0 = Math.min(0, ...ys), y1 = Math.max(...ys);
    // a step on the y axis so there are 4 to 8 lines
    const span = Math.max(1, y1 - y0), step = [1, 2, 5, 10, 20].find(s => span / s <= 8) ?? 50;
    const top = Math.ceil(y1 / step) * step + step, bot = Math.floor(y0 / step) * step;
    const W = size * 2, Hh = size * 1.5, L = 34, B = 26, T = 8, R = 10;
    const X = (x: number) => L + (x / x1) * (W - L - R), Y = (y: number) => T + ((top - y) / (top - bot)) * (Hh - T - B);
    const xt = Array.from({ length: x1 + 1 }, (_, i) => i).filter(x => x1 <= 10 || x % 2 === 0);
    const yt: number[] = []; for (let v = bot; v <= top; v += step) yt.push(v);
    // the line runs across the whole grid
    const m = (ys[1] - ys[0]) / (xs[1] - xs[0]), b = ys[0] - m * xs[0];
    return { W, Hh, X, Y, xt, yt, x1, top, bot, line: [X(0), Y(b), X(x1), Y(m * x1 + b)] as const, pts: xs.map((x, i) => [X(x), Y(ys[i])] as const) };
  });
</script>

{#if pic.kind === 'table'}
  <span class="tbl" style:--fs="{Math.max(18, size * 0.17)}px">
    <span class="row x"><b><i>x</i></b>{#each pic.xs as v, i (i)}<span>{fm(v)}</span>{/each}</span>
    <span class="row y"><b><i>y</i></b>{#each pic.ys as v, i (i)}<span>{fm(v)}</span>{/each}</span>
  </span>
{:else if pic.kind === 'graph' && g}
  <svg class="graph" width={g.W} height={g.Hh} viewBox="0 0 {g.W} {g.Hh}" role="img" aria-label="A graph of a straight line">
    <rect x="0" y="0" width={g.W} height={g.Hh} rx="14" fill="#fff" />
    {#each g.xt as x (x)}<line x1={g.X(x)} x2={g.X(x)} y1={g.Y(g.top)} y2={g.Y(g.bot)} stroke="#e4ddff" stroke-width="1.5" />{/each}
    {#each g.yt as y (y)}<line x1={g.X(0)} x2={g.X(g.x1)} y1={g.Y(y)} y2={g.Y(y)} stroke="#e4ddff" stroke-width="1.5" />{/each}
    <line x1={g.X(0)} x2={g.X(0)} y1={g.Y(g.top)} y2={g.Y(g.bot)} stroke="#5b4a8a" stroke-width="2.5" />
    <line x1={g.X(0)} x2={g.X(g.x1)} y1={g.Y(0)} y2={g.Y(0)} stroke="#5b4a8a" stroke-width="2.5" />
    {#each g.xt as x (x)}<text x={g.X(x)} y={g.Y(Math.max(0, g.bot)) + 18} text-anchor="middle" class="lab">{x}</text>{/each}
    {#each g.yt as y (y)}<text x={g.X(0) - 6} y={g.Y(y) + 5} text-anchor="end" class="lab">{fm(y)}</text>{/each}
    <line x1={g.line[0]} y1={g.line[1]} x2={g.line[2]} y2={g.line[3]} stroke="#8a63f2" stroke-width="4" stroke-linecap="round" opacity=".85" />
    {#each g.pts as [px, py], i (i)}<circle cx={px} cy={py} r="7" fill="#ffc83d" stroke="#fff" stroke-width="3" />{/each}
  </svg>
{:else if pic.kind === 'ray'}
  <span class="ray" style:width="{Math.max(300, size * 2.6)}px"><RayLine min={pic.min} max={pic.max} at={pic.at} closed={pic.op === 'ge' || pic.op === 'le'} dir={pic.op === 'gt' || pic.op === 'ge' ? 'right' : 'left'} small /></span>
{:else if pic.kind === 'balance'}
  <BalanceView boxes={pic.boxes} left={pic.left} right={pic.right} letter={pic.letter ?? '?'} w={size * 2.2} />
{/if}

<style>
  .tbl { display: inline-flex; flex-direction: column; background: #fff; border-radius: 16px; box-shadow: 0 0 0 3px #e4ddff, var(--shadow-sm); overflow: hidden; font: 600 var(--fs)/1 var(--font-ui); }
  .row { display: flex; }
  .row > * { min-width: calc(var(--fs) * 2.1); padding: calc(var(--fs) * .4) calc(var(--fs) * .3); text-align: center; }
  .row > b { background: #efe9ff; color: #6c4fd8; }
  .row i { font-family: Georgia, serif; font-style: italic; }
  .row.x { border-bottom: 2px solid #e4ddff; }
  .row > span + span, .row > b + span { border-left: 2px solid #f1edff; }
  .graph { display: block; border-radius: 14px; box-shadow: 0 0 0 3px #e4ddff, var(--shadow-sm); }
  .lab { font: 600 14px var(--font-ui); fill: #5b4a8a; }
  .ray { display: inline-block; max-width: 92vw; }
</style>
