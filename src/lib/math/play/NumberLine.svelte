<script lang="ts">
  // Number Line Hop: a number appears; tap where it goes on the line, and your buddy hops there. Then
  // the real spot shows with a flag and how far off you were. Eight numbers a round, no clock.
  import { onDestroy } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import Critter from '../../ui/Critter.svelte';
  import { lineNumbers, linePoints, lineSpec, lineStars } from '../playground';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 1 | 2 | 3; ms: number }) => void };
  let { level, buddy, ondone }: Props = $props();
  const spec = lineSpec(level);
  const nums = lineNumbers(level, mulberry32(Date.now() % 1e9));
  const t0 = performance.now();
  let i = $state(0);
  let points = $state(0);
  let placed = $state<number | null>(null);
  let got = $state<0 | 1 | 2 | 3>(0);
  let hop = $state(0);
  let at = $state(0); // where the buddy stands, 0..1
  let svg: SVGSVGElement | undefined = $state();
  const PAD = 40, W = 1000;
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
    at = v / spec.max; hop++;
    if (got >= 2) sfx.star(got - 1); else if (got === 1) sfx.pop(); else sfx.miss();
    timers.push(setTimeout(next, 1700));
  }
  function next() {
    if (i + 1 >= nums.length) { ondone({ stars: lineStars(points, nums.length * 3), ms: performance.now() - t0 }); return; }
    i++; placed = null;
  }
  const word = $derived(placed === null ? '' : placed === target ? 'Spot on!' : got === 3 ? `So close! Just ${Math.abs(placed - target)} away.` : got >= 1 ? `Close: ${Math.abs(placed - target)} away.` : `It goes here. You were ${Math.abs(placed - target)} away.`);
</script>

<div class="nl">
  <div class="dots">{#each nums as _, k}<i class:done={k < i || (k === i && placed !== null)} class:now={k === i}></i>{/each}</div>
  <p class="ask">Where does <b>{target}</b> go?</p>
  <!-- the whole strip takes the tap, not only the thin line: easier for small fingers -->
  <div class="track" onpointerdown={tap} role="presentation">
    <div class="buddy" style:left="{(PAD + at * (W - 2 * PAD)) / W * 100}%">{#key hop}<span class="hop"><Critter friend={buddy} size={86} /></span>{/key}</div>
    <svg bind:this={svg} viewBox="0 0 {W} 150" class="line" class:locked={placed !== null} role="slider" aria-label="Number line from 0 to {spec.max}" aria-valuemin={0} aria-valuemax={spec.max} aria-valuenow={placed ?? 0} tabindex="-1">
      <rect x="0" y="0" width={W} height="150" fill="transparent" />
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
  .dots { display: flex; gap: 6px; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; }
  .dots i.done { background: #4fcf98; } .dots i.now { box-shadow: 0 0 0 3px #7c5cf5; }
  .ask { margin: 6px 0 0; font: 600 clamp(28px, 5vw, 46px) var(--font-ui); color: var(--ink); }
  .ask b { color: #3fa7e0; font-size: 1.25em; }
  .track { position: relative; width: 100%; padding-top: 100px; padding-bottom: 20px; touch-action: none; cursor: crosshair; }
  .buddy { position: absolute; top: 0; transform: translateX(-50%); transition: left .7s cubic-bezier(.4, 0, .3, 1); pointer-events: none; }
  .hop { display: block; animation: hop .7s ease-in-out; }
  @keyframes hop { 0% { transform: translateY(0); } 45% { transform: translateY(-42px); } 100% { transform: translateY(0); } }
  .line { width: 100%; height: auto; cursor: crosshair; touch-action: none; display: block; }
  .line.locked { cursor: default; }
  .line:focus { outline: none; }
  .lab { font: 600 30px var(--font-ui); fill: #3b2d55; }
  .flab { font: 700 22px var(--font-ui); fill: #ef7d2b; }
  .pin { animation: drop .35s cubic-bezier(.3, .8, .4, 1.5); }
  .flag { animation: drop .45s .25s cubic-bezier(.3, .8, .4, 1.5) both; }
  @keyframes drop { from { opacity: 0; transform-box: fill-box; } to { opacity: 1; } }
  .word { margin: 4px 0 0; min-height: 34px; font: 600 26px var(--font-ui); color: var(--ink2); opacity: 0; transition: opacity .25s; }
  .word.show { opacity: 1; } .word.good { color: #1f9a6a; }
  @media (max-width: 600px) { .track { padding-top: 70px; } .buddy :global(.critter-host) { width: 60px !important; height: 60px !important; } .lab { font-size: 38px; } .word { font-size: 19px; } }
</style>
