<script lang="ts">
  // Number Line Hop: a number appears; tap where it goes on the line, and your buddy hops there along
  // the island trail. Then the real spot shows with a flag and how far off you were. Eight numbers a
  // round, no clock.
  import { onDestroy } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { FirstTries, lineNumbers, linePoints, lineSpec, lineStars } from '../playground';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number; answers: boolean[] }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const spec = lineSpec(level);
  const nums = lineNumbers(level, mulberry32(Date.now() % 1e9));
  const t0 = performance.now();
  let i = $state(0);
  let points = $state(0);
  const firsts = new FirstTries();
  let placed = $state<number | null>(null);
  let got = $state<0 | 1 | 2 | 3>(0);
  let svg: SVGSVGElement | undefined = $state();
  let track: HTMLDivElement | undefined = $state();
  /** a value's place across the window (a fraction), for the buddy to hop to */
  function screenX(v: number) { const r = svg?.getBoundingClientRect(); return r ? (r.left + (xOf(v) / W) * r.width) / innerWidth : 0.5; }
  $effect(() => {
    if (!track || !pal) return;
    // the buddy's feet on top of the number line's board, wherever the layout puts it
    const r = track.getBoundingClientRect(), sr = svg?.getBoundingClientRect();
    const feetAt = sr && r.height ? (sr.top + sr.height * (BOARD_TOP / 150) - r.top) / r.height : 0.8;
    pal.area(track, { span: 8 * Math.max(0.6, r.width / 1000), feetAt });
    // start at 0, the line's left end
    const t = setTimeout(() => pal.hop(screenX(0), true), 80);
    return () => clearTimeout(t);
  });
  const PAD = 40, W = 1000, BOARD_TOP = 36;
  const xOf = (v: number) => PAD + (v / spec.max) * (W - 2 * PAD);
  const ticks = Array.from({ length: spec.max / spec.step + 1 }, (_, k) => k * spec.step);
  const minor = level >= 3 && level <= 4 ? Array.from({ length: spec.max / 5 + 1 }, (_, k) => k * 5) : [];
  const target = $derived(nums[i]);
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  function tap(e: PointerEvent) {
    if (placed !== null || !svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const snap = level === 5 ? 10 : 1;
    const v = Math.max(0, Math.min(spec.max, Math.round((((x - PAD) / (W - 2 * PAD)) * spec.max) / snap) * snap));
    placed = v;
    got = linePoints(target, v, spec.max);
    points += got;
    // (a close one says nothing either way: only near-exact ones and clear misses move the level)
    if (got >= 2) firsts.hit(); else if (got === 0) { firsts.miss(); firsts.hit(); }
    pal?.hop(screenX(v));
    timers.push(setTimeout(() => { if (got >= 2) pal?.cheer(); else if (got === 0) pal?.oops(); }, 750));
    if (got >= 2) sfx.star(got - 1); else if (got === 1) sfx.pop(); else sfx.miss();
    timers.push(setTimeout(next, 1700));
  }
  function next() {
    if (i + 1 >= nums.length) { ondone({ stars: lineStars(points, nums.length * 3), ms: performance.now() - t0, answers: firsts.answers }); return; }
    i++; placed = null;
  }
  const word = $derived(placed === null ? '' : placed === target ? 'Spot on!' : got === 3 ? `So close! Just ${Math.abs(placed - target)} away.` : got >= 1 ? `Close: ${Math.abs(placed - target)} away.` : `It goes here. You were ${Math.abs(placed - target)} away.`);
</script>

<div class="nl">
  <div class="dots">{#each nums as _, k}<i class:done={k < i || (k === i && placed !== null)} class:now={k === i}></i>{/each}</div>
  <p class="ask">Where does <b>{target}</b> go?</p>
  <!-- the whole strip takes the tap, not only the thin line: easier for small fingers -->
  <div class="track" bind:this={track} onpointerdown={tap} role="presentation">
    <svg bind:this={svg} viewBox="0 0 {W} 150" class="line" class:locked={placed !== null} role="slider" aria-label="Number line from 0 to {spec.max}" aria-valuemin={0} aria-valuemax={spec.max} aria-valuenow={placed ?? 0} tabindex="-1">
      <rect x="0" y="0" width={W} height="150" fill="transparent" />
      <!-- a solid board behind the ticks, so the grass and the island don't flicker through them;
           the buddy hops along its top edge -->
      <rect x={PAD - 34} y={BOARD_TOP + 6} width={W - 2 * PAD + 68} height={148 - BOARD_TOP - 6} rx="22" fill="rgba(50, 34, 90, .22)" />
      <rect x={PAD - 34} y={BOARD_TOP} width={W - 2 * PAD + 68} height={148 - BOARD_TOP - 6} rx="22" fill="#fffdf6" stroke="#e8dcc0" stroke-width="3" />
      <line x1={PAD} x2={W - PAD} y1="70" y2="70" stroke="#fff" stroke-width="15" stroke-linecap="round" opacity=".85" />
      <line x1={PAD} x2={W - PAD} y1="70" y2="70" stroke="#7c5cf5" stroke-width="7" stroke-linecap="round" />
      {#each minor as v}<line x1={xOf(v)} x2={xOf(v)} y1="62" y2="78" stroke="#c9bdf0" stroke-width="3" />{/each}
      {#each ticks as v}<line x1={xOf(v)} x2={xOf(v)} y1="52" y2="88" stroke="#7c5cf5" stroke-width="4" stroke-linecap="round" />{/each}
      {#each spec.labels as v}<text x={xOf(v)} y="124" text-anchor="middle" class="lab">{v}</text>{/each}
      {#if placed !== null}
        <g class="pin" transform="translate({xOf(placed)} 70)"><circle r="13" fill={got >= 2 ? '#4fcf98' : got === 1 ? '#f7c548' : '#ef6fa6'} stroke="#fff" stroke-width="4" /></g>
        <g class="flag" transform="translate({xOf(target)} 70)"><line y1="0" y2="-58" stroke="#3b2d55" stroke-width="4" /><path d="M0 -58h34l-9 10 9 10H0z" fill="#ef7d2b" /><text x="17" y="-66" text-anchor="middle" class="flab">{target}</text></g>
      {/if}
    </svg>
  </div>
  <p class="word" class:good={got >= 2} class:show={placed !== null}>{word || '·'}</p>
</div>

<style>
  .nl { width: min(1100px, 100%); margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .dots { display: flex; gap: 6px; background: rgba(255, 255, 255, .85); padding: 5px 9px; border-radius: 999px; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; }
  .dots i.done { background: #4fcf98; } .dots i.now { box-shadow: 0 0 0 3px #7c5cf5; }
  .ask { margin: 6px 0 0; font: 600 clamp(28px, 5vw, 46px) var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .9); padding: 4px 22px; border-radius: 22px; box-shadow: var(--shadow-sm); }
  .ask b { color: #3fa7e0; font-size: 1.25em; }
  /* see-through: the island and your buddy show behind the line */
  .track { position: relative; width: 100%; padding-top: clamp(150px, 26vh, 230px); padding-bottom: 10px; touch-action: none; cursor: crosshair; }
  .line { width: 100%; height: auto; cursor: crosshair; touch-action: none; display: block; }
  .line.locked { cursor: default; }
  .line:focus { outline: none; }
  .lab { font: 600 30px var(--font-ui); fill: #3b2d55; paint-order: stroke; stroke: #fff; stroke-width: 8px; }
  .flab { font: 700 22px var(--font-ui); fill: #ef7d2b; }
  .pin { animation: drop .35s cubic-bezier(.3, .8, .4, 1.5); }
  .flag { animation: drop .45s .25s cubic-bezier(.3, .8, .4, 1.5) both; }
  @keyframes drop { from { opacity: 0; transform-box: fill-box; } to { opacity: 1; } }
  .word { margin: 4px 0 0; min-height: 34px; font: 600 26px var(--font-ui); color: var(--ink2); opacity: 0; transition: opacity .25s; background: rgba(255, 255, 255, .9); padding: 2px 16px; border-radius: 16px; }
  .word.show { opacity: 1; } .word.good { color: #1f9a6a; }
  @media (max-width: 600px) { .track { padding-top: 160px; } .lab { font-size: 38px; } .word { font-size: 19px; } }
</style>
