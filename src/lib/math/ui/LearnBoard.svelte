<script lang="ts">
  // A Learn lesson's picture: dots, ten frames, plates and a number line. Dots keep their ids from one
  // step to the next, so a dot slides to its new place; new dots pop in, dots taken away float off.
  // `still` draws it without any motion (the little pictures on the lesson cards).
  import { backOut, cubicIn } from 'svelte/easing';
  import { BW, BH, FC, type Board } from '../learn';
  import type { FriendId } from '../../art/cast';

  /** `view`: the part of the board to show (zoomed to fit); the whole board if not given */
  type Props = { board: Board; buddy: FriendId; still?: boolean; view?: { x: number; y: number; w: number; h: number } };
  let { board, buddy, still = false, view }: Props = $props();
  const vb = $derived(view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${BW} ${BH}`);
  const base = import.meta.env.BASE_URL;
  const r = $derived(board.cell * 0.38);

  // the number line: from its first number to its last, across the board
  const LX0 = 44, LX1 = BW - 44, LY = 236;
  const ln = $derived(board.line);
  const lx = (n: number) => (ln ? LX0 + ((n - ln.from) / Math.max(1, ln.to - ln.from)) * (LX1 - LX0) : 0);
  const ticks = $derived(ln ? Array.from({ length: ln.to - ln.from + 1 }, (_, i) => ln.from + i) : []);
  const every = $derived(ln && ln.to - ln.from > 12 ? 5 : 1);
  function arc(a: number, b: number) {
    const x1 = lx(a), x2 = lx(b), h = Math.min(90, 26 + Math.abs(x2 - x1) * 0.35);
    return `M${x1},${LY - 6} C${x1},${LY - h} ${x2},${LY - h} ${x2},${LY - 6}`;
  }
  const arcTop = (a: number, b: number) => LY - Math.min(90, 26 + Math.abs(lx(b) - lx(a)) * 0.35) * 0.75 - 18;

  function pop(_n: Element, { delay = 0 }: { delay?: number }) {
    return { delay: still ? 0 : delay * 1000 + 120, duration: still ? 0 : 420, css: (t: number) => `transform: scale(${backOut(t)}); opacity: ${Math.min(1, t * 2)}` };
  }
  function away(_n: Element) {
    return { duration: still ? 0 : 520, easing: cubicIn, css: (t: number) => `transform: translateY(${(1 - t) * -44}px) scale(${0.6 + t * 0.4}); opacity: ${t}` };
  }
</script>

<svg class="lb" class:still viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="A picture of the trick">
  <defs>
    <radialGradient id="lb-a" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#bfe3ff" /><stop offset=".45" stop-color="#4aa6ff" /><stop offset="1" stop-color="#1f6fd1" /></radialGradient>
    <radialGradient id="lb-b" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd6e6" /><stop offset=".45" stop-color="#ff74a8" /><stop offset="1" stop-color="#d63c7c" /></radialGradient>
    <radialGradient id="lb-c" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff4c2" /><stop offset=".45" stop-color="#ffc93a" /><stop offset="1" stop-color="#e79a09" /></radialGradient>
    <radialGradient id="lb-plate" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#ffffff" /><stop offset=".8" stop-color="#f3eefc" /><stop offset="1" stop-color="#ddd3f2" /></radialGradient>
    <filter id="lb-sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#2a1f45" flood-opacity=".28" /></filter>
    <clipPath id="lb-head"><circle cx="0" cy="0" r="25" /></clipPath>
  </defs>

  {#each board.plates as p (p.id)}
    <g transform="translate({p.x} {p.y})"><g class="in" in:pop={{ delay: 0 }}>
      <ellipse class="plate" class:empty={p.empty} rx={p.r} ry={p.r * 0.9} />
      <ellipse class="rim" rx={p.r * 0.72} ry={p.r * 0.64} />
    </g></g>
  {/each}

  {#each board.frames as f (f.id)}
    <g transform="translate({f.x} {f.y})"><g class="in" in:pop={{ delay: 0 }}>
      <rect class="frame" x="-6" y="-6" width={FC * 5 + 12} height={FC * 2 + 12} rx="14" />
      {#each Array(10) as _, i}<rect class="cell" x={(i % 5) * FC + 3} y={Math.floor(i / 5) * FC + 3} width={FC - 6} height={FC - 6} rx="9" />{/each}
    </g></g>
  {/each}

  {#if ln}
    <g class="nline">
      <line x1={LX0 - 18} y1={LY} x2={LX1 + 18} y2={LY} />
      {#each ticks as n (n)}
        <line class="tick" class:big={n % every === 0} x1={lx(n)} y1={LY - 9} x2={lx(n)} y2={LY + 9} />
        {#if n === ln.at || (n % every === 0 && Math.abs(n - ln.at) * 2 >= every)}<text class="tnum" class:here={n === ln.at} x={lx(n)} y={LY + 36}>{n}</text>{/if}
      {/each}
      {#each ln.hops as h, i (`${h.a}-${h.b}-${i}`)}
        <path class="hop" class:back={h.b < h.a} d={arc(h.a, h.b)} pathLength="1" />
        <g transform="translate({(lx(h.a) + lx(h.b)) / 2} {arcTop(h.a, h.b)})"><g class="in" in:pop={{ delay: 0.35 }}>
          <rect class="hlab" x="-26" y="-17" width="52" height="30" rx="15" /><text class="hlt" y="5">{h.label}</text>
        </g></g>
      {/each}
      <g class="me" style:transform="translate({lx(ln.at)}px, {LY - 40}px)">
        <circle r="28" class="mering" />
        <image href="{base}portraits/{buddy}-head.png" x="-25" y="-25" width="50" height="50" clip-path="url(#lb-head)" preserveAspectRatio="xMidYMid slice" />
        <path class="pin" d="M-7,26 L0,36 L7,26 Z" />
      </g>
    </g>
  {/if}

  {#each board.dots as d (d.id)}
    <g class="dot" style:transform="translate({d.x}px, {d.y}px)" style:transition-delay="{still ? 0 : d.d ?? 0}s">
      <g class="in" in:pop={{ delay: d.d ?? 0 }} out:away>
        {#if d.c === 'ghost'}
          <circle class="ghost" {r} />
        {:else}
          <circle {r} fill="url(#lb-{d.c})" filter="url(#lb-sh)" opacity={d.out ? 0.42 : 1} />
          <ellipse cx={-r * 0.32} cy={-r * 0.38} rx={r * 0.34} ry={r * 0.22} fill="#fff" opacity={d.out ? 0.3 : 0.75} />
          {#if d.out}<path class="cross" d="M{-r * 0.8},{-r * 0.8} L{r * 0.8},{r * 0.8} M{r * 0.8},{-r * 0.8} L{-r * 0.8},{r * 0.8}" />{/if}
        {/if}
      </g>
    </g>
  {/each}

  {#each board.tags as t (t.id + t.text)}
    <text class="tag t-{t.c ?? 'ink'}" x={t.x} y={t.y} font-size={t.size ?? 30} in:pop={{ delay: 0.25 }}>{t.text}</text>
  {/each}
</svg>

<style>
  .lb { display: block; width: 100%; height: 100%; overflow: visible; }
  .dot { transition: transform .75s cubic-bezier(.3, 1.25, .45, 1); }
  .still .dot, .still .me { transition: none; }
  .in { transform-box: fill-box; transform-origin: center; }
  .ghost { fill: rgba(255, 255, 255, .6); stroke: #b9acd9; stroke-width: 2.5; stroke-dasharray: 5 5; }
  .cross { stroke: #c2185b; stroke-width: 4; stroke-linecap: round; }
  .frame { fill: #fff8e6; stroke: #c99a5b; stroke-width: 5; }
  .cell { fill: #fffdf6; stroke: #ead8b8; stroke-width: 2; }
  .plate { fill: url(#lb-plate); stroke: #c9bde6; stroke-width: 3; }
  .plate.empty { stroke-dasharray: 10 8; fill: rgba(255, 255, 255, .55); }
  .rim { fill: none; stroke: rgba(160, 140, 210, .35); stroke-width: 2; }
  .nline line { stroke: #6b5a8e; stroke-width: 4; stroke-linecap: round; }
  .nline .tick { stroke-width: 2.5; opacity: .55; }
  .nline .tick.big { stroke-width: 3.5; opacity: 1; }
  .tnum { font: 600 22px var(--font-ui); fill: #5b4d7a; text-anchor: middle; }
  .tnum.here { font-size: 30px; fill: var(--primary-edge, #5a3fd0); }
  .hop { fill: none; stroke: #ff8a3d; stroke-width: 5; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw .6s .05s ease-out forwards; }
  .hop.back { stroke: #7c5cf5; }
  .still .hop { animation: none; stroke-dashoffset: 0; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .hlab { fill: #fff; stroke: #ffc8a3; stroke-width: 2.5; }
  .hlt { font: 600 19px var(--font-ui); fill: #c2541a; text-anchor: middle; }
  .me { transition: transform .6s cubic-bezier(.3, 1.5, .5, 1); }
  .mering { fill: #fff; stroke: #ffd36b; stroke-width: 4; filter: drop-shadow(0 3px 4px rgba(40, 20, 80, .3)); }
  .pin { fill: #ffd36b; }
  .tag { font-family: var(--font-ui); font-weight: 600; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 7px; stroke-linejoin: round; transform-box: fill-box; transform-origin: center; }
  .t-a { fill: #1f6fd1; } .t-b { fill: #d63c7c; } .t-c { fill: #d78a00; } .t-ink { fill: #2a1f45; }
</style>
