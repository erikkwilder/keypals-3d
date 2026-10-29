<script lang="ts">
  // A Learn lesson's picture, made of painted pieces: glass marbles to count (blue for the first number,
  // pink for the second, gold for the one that makes the trick work), wooden trays with ten cups for ten
  // frames, china plates for groups, and a wooden plank for the number line with a star trail for each
  // hop. Marbles keep their ids from one step to the next, so a marble rolls to its new place; new ones
  // pop in, ones taken away float off. `still` draws it without any motion (the lesson cards).
  import { backOut, cubicIn } from 'svelte/easing';
  import { BW, BH, FC, type Board } from '../learn';
  import type { FriendId } from '../../art/cast';

  /** `view`: the part of the board to show (zoomed to fit); the whole board if not given */
  type Props = { board: Board; buddy: FriendId; still?: boolean; view?: { x: number; y: number; w: number; h: number } };
  let { board, buddy, still = false, view }: Props = $props();
  const vb = $derived(view ? `${view.x} ${view.y} ${view.w} ${view.h}` : `0 0 ${BW} ${BH}`);
  const base = import.meta.env.BASE_URL;
  const art = (n: string) => `${base}learn/${n}.webp`;
  const r = $derived(board.cell * 0.4);

  // the number line: from its first number to its last, across the board
  const LX0 = 44, LX1 = BW - 44, LY = 236;
  const ln = $derived(board.line);
  const lx = (n: number) => (ln ? LX0 + ((n - ln.from) / Math.max(1, ln.to - ln.from)) * (LX1 - LX0) : 0);
  const ticks = $derived(ln ? Array.from({ length: ln.to - ln.from + 1 }, (_, i) => ln.from + i) : []);
  const every = $derived(ln && ln.to - ln.from > 12 ? 5 : 1);
  const arcH = (a: number, b: number) => Math.min(90, 26 + Math.abs(lx(b) - lx(a)) * 0.35);
  /** stars along a hop's arc (the same curve the old line drew), one about every 22 units */
  function trail(a: number, b: number) {
    const x1 = lx(a), x2 = lx(b), h = arcH(a, b), y0 = LY - 6, yc = LY - h;
    const n = Math.max(4, Math.round(Math.abs(x2 - x1) / 22));
    return Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n, u = 1 - t;
      return { x: u * u * u * x1 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x2, y: u * u * u * y0 + 3 * u * u * t * yc + 3 * u * t * t * yc + t * t * t * y0, d: i * 0.05, big: i === n };
    });
  }
  /** a hop's sign: over its arc, and always above the buddy's pin (which stands where hops land) */
  const arcTop = (a: number, b: number) => Math.min(LY - arcH(a, b) * 0.75 - 18, LY - 96);

  function pop(_n: Element, { delay = 0 }: { delay?: number }) {
    return { delay: still ? 0 : delay * 1000 + 120, duration: still ? 0 : 420, css: (t: number) => `transform: scale(${backOut(t)}); opacity: ${Math.min(1, t * 2)}` };
  }
  function away(_n: Element) {
    return { duration: still ? 0 : 520, easing: cubicIn, css: (t: number) => `transform: translateY(${(1 - t) * -44}px) scale(${0.6 + t * 0.4}); opacity: ${t}` };
  }
</script>

<svg class="lb" class:still viewBox={vb} preserveAspectRatio="xMidYMid meet" role="img" aria-label="A picture of the trick">
  <defs>
    <clipPath id="lb-head"><circle cx="0" cy="0" r="21" /></clipPath>
    <filter id="lb-sh" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="3" stdDeviation="2.4" flood-color="#5a3a12" flood-opacity=".3" /></filter>
  </defs>

  {#each board.plates as p (p.id)}
    <g transform="translate({p.x} {p.y})"><g class="in" in:pop={{ delay: 0 }}>
      <image href={art('plate')} x={-p.r} y={-p.r * 0.92} width={p.r * 2} height={p.r * 1.84} preserveAspectRatio="none" opacity={p.empty ? 0.55 : 1} filter="url(#lb-sh)" />
    </g></g>
  {/each}

  {#each board.frames as f (f.id)}
    <g transform="translate({f.x} {f.y})"><g class="in" in:pop={{ delay: 0 }}>
      <image href={art('tray')} x="-14" y="-12" width={FC * 5 + 28} height={FC * 2 + 24} preserveAspectRatio="none" filter="url(#lb-sh)" />
      {#each Array(10) as _, i}<image href={art('cup')} x={(i % 5) * FC + 3} y={Math.floor(i / 5) * FC + 3} width={FC - 6} height={FC - 6} />{/each}
    </g></g>
  {/each}

  {#if ln}
    <g class="nline">
      <image href={art('plank')} x={LX0 - 26} y={LY - 13} width={LX1 - LX0 + 52} height="26" preserveAspectRatio="none" filter="url(#lb-sh)" />
      {#each ticks as n (n)}
        {@const big = n % every === 0}
        <image href={art(big && every > 1 ? 'marble-c' : 'cup')} x={lx(n) - (big ? 8 : 6)} y={LY - (big ? 8 : 6)} width={big ? 16 : 12} height={big ? 16 : 12} />
        {#if n === ln.at || (big && Math.abs(n - ln.at) * 2 >= every)}<text class="tnum" class:here={n === ln.at} x={lx(n)} y={LY + 40}>{n}</text>{/if}
      {/each}
      {#each ln.hops as h, i (`${h.a}-${h.b}-${i}`)}
        <g class="trail" class:back={h.b < h.a}>
          {#each trail(h.a, h.b) as s, k (k)}<image class="star" style:animation-delay="{still ? 0 : s.d}s" href="{base}game/icon-star.webp" x={s.x - (s.big ? 9 : 6)} y={s.y - (s.big ? 9 : 6)} width={s.big ? 18 : 12} height={s.big ? 18 : 12} />{/each}
        </g>
        <g transform="translate({(lx(h.a) + lx(h.b)) / 2} {arcTop(h.a, h.b)})"><g class="in" in:pop={{ delay: 0.35 }}>
          <image href={art('tag')} x="-32" y="-19" width="64" height="32" preserveAspectRatio="none" />
          <text class="hlt" class:back={h.b < h.a} y="4">{h.label}</text>
        </g></g>
      {/each}
      <g class="me" style:transform="translate({lx(ln.at)}px, {LY - 48}px)">
        <image href="{base}portraits/{buddy}-head.png" x="-21" y="-21" width="42" height="42" clip-path="url(#lb-head)" preserveAspectRatio="xMidYMid slice" />
        <image href={art('pin')} x="-26" y="-26" width="46" height="52" />
      </g>
    </g>
  {/if}

  {#each board.dots as d (d.id)}
    <g class="dot" style:transform="translate({d.x}px, {d.y}px)" style:transition-delay="{still ? 0 : d.d ?? 0}s">
      <g class="in" in:pop={{ delay: d.d ?? 0 }} out:away>
        {#if d.c === 'ghost'}
          <image href={art('cup')} x={-r * 1.05} y={-r * 1.05} width={r * 2.1} height={r * 2.1} opacity=".75" />
        {:else}
          <image href={art(`marble-${d.c}`)} x={-r} y={-r} width={r * 2} height={r * 2} opacity={d.out ? 0.45 : 1} filter="url(#lb-sh)" />
          {#if d.out}<image href={art('cross')} x={-r * 0.95} y={-r * 0.95} width={r * 1.9} height={r * 1.9} />{/if}
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
  .tnum { font: 600 22px var(--font-ui); fill: #6b4a22; text-anchor: middle; paint-order: stroke; stroke: #fffaf0; stroke-width: 5px; }
  .tnum.here { font-size: 30px; fill: #5a3fd0; }
  /* each hop: a trail of stars that twinkles in from where it left to where it landed */
  .star { opacity: 0; animation: twinkle .32s cubic-bezier(.3, 1.6, .5, 1) forwards; transform-box: fill-box; transform-origin: center; }
  .still .star { animation: none; opacity: 1; }
  .trail.back .star { filter: hue-rotate(220deg) saturate(1.4); }
  @keyframes twinkle { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: scale(1); } }
  .hlt { font: 600 19px var(--font-ui); fill: #b8551a; text-anchor: middle; }
  .hlt.back { fill: #5a3fd0; }
  .me { transition: transform .6s cubic-bezier(.3, 1.5, .5, 1); }
  .tag { font-family: var(--font-ui); font-weight: 600; text-anchor: middle; paint-order: stroke; stroke: #fff; stroke-width: 7px; stroke-linejoin: round; transform-box: fill-box; transform-origin: center; }
  .t-a { fill: #1f6fd1; } .t-b { fill: #d63c7c; } .t-c { fill: #d78a00; } .t-ink { fill: #2a1f45; }
</style>
