<script lang="ts">
  // Balance Scale: the Star Lab's calm toy, no clock. Mystery boxes (all the same) and some weights sit on
  // the left pan. Put weights on the right pan from the shelf (tap one there to take it back) and watch the
  // balance: it hangs toward the heavier side, and swings level when both sides weigh the same. Then say
  // what one box weighs. Five puzzles a round; the rules are in math/algebra/scale.ts.
  import { onDestroy, untrack } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { slipStars } from '../playground';
  import { SHELF, leftTotal, scaleChoices, scaleHow, scalePuzzles, tiltOf } from '../algebra/scale';
  import BalanceView from '../algebra/BalanceView.svelte';
  import Expr from '../skills/ui/Expr.svelte';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let corner: HTMLDivElement | undefined = $state();
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  // a new level remakes this whole round (the Playground keys it)
  const lv = untrack(() => level);
  const rng = mulberry32(Date.now() % 1e9);
  const puzzles = scalePuzzles(lv, rng);
  const t0 = performance.now();
  let i = $state(0);
  let right = $state<number[]>([]);
  let phase = $state<'weigh' | 'ask' | 'done'>('weigh');
  let picked = $state<number | null>(null);
  let slips = $state(0);
  let note = $state('');
  let choices = $state<number[]>([]);
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  const z = $derived(puzzles[i]);
  const sum = $derived(right.reduce((t, x) => t + x, 0));
  const L = $derived(leftTotal(z));
  const tilt = $derived(phase === 'weigh' ? tiltOf(L, sum) : 0);
  const lhs = $derived(`${Array(z.boxes).fill('□').join(' + ')}${z.left ? ` + ${z.left}` : ''}`);
  let vw = $state(1280);
  const bw = $derived(Math.min(560, vw - 40));

  function add(v: number) {
    if (phase !== 'weigh' || right.length >= 14) return;
    note = '';
    right = [...right, v].sort((a, b) => b - a);
    sfx.thunk(); sfx.pop();
    check();
  }
  function take(k: number) {
    if (phase !== 'weigh') return;
    right = right.filter((_, j) => j !== k);
    sfx.click();
    check();
  }
  function check() {
    const s = right.reduce((t, x) => t + x, 0);
    if (s === L) {
      phase = 'ask'; picked = null; sfx.twinkle(); pal?.cheer();
      choices = scaleChoices(z, rng);
      note = `Level! The right side weighs ${s}.`;
    } else if (s > L) { note = 'Too heavy! It tips your way. Tap a weight to take it off.'; pal?.oops(); }
  }
  function choose(v: number) {
    if (phase !== 'ask') return;
    picked = v;
    if (v === z.w) {
      phase = 'done'; sfx.cheer(); pal?.cheer();
      note = `Yes! ${scaleHow(z)}`;
      timers.push(setTimeout(() => {
        if (i + 1 >= puzzles.length) { ondone({ stars: slipStars(slips), ms: performance.now() - t0 }); return; }
        i++; right = []; phase = 'weigh'; picked = null; note = '';
      }, 1900));
    } else {
      slips++; sfx.miss(); pal?.oops();
      note = z.boxes > 1 ? `Not quite. ${z.left ? `Take the ${z.left} away first, then share` : 'Share'} ${z.left ? '' : `${L} `}between the ${z.boxes} boxes.` : z.left ? `Not quite. The box and ${z.left} make ${L}. Take the ${z.left} away.` : `Not quite. The box balances ${L}.`;
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    const n = Number(e.key);
    if (phase === 'weigh' && n >= 1 && n <= SHELF.length) { e.preventDefault(); add(SHELF[n - 1]); }
    else if (phase === 'weigh' && e.key === 'Backspace' && right.length) { e.preventDefault(); take(right.length - 1); }
    else if (phase === 'ask' && n >= 1 && n <= choices.length) { e.preventDefault(); choose(choices[n - 1]); }
  }
</script>

<svelte:window onkeydown={onKey} bind:innerWidth={vw} />

<div class="sc">
  <div class="top"><span class="dots">{#each puzzles as _, k}<i class:done={k < i || (k === i && phase === 'done')} class:now={k === i}></i>{/each}</span></div>
  <div class="row">
    <div class="main">
      <div class="eq"><Expr s="{lhs} = {phase === 'weigh' ? (sum || '?') : L}" /></div>
      <div class="lab" style:--bg="url({base}learn/ep/set-lab-soft.webp)">
        <BalanceView boxes={z.boxes} left={z.left} right={sum} rightW={right} {tilt} w={bw} reveal={phase === 'done' ? z.w : null} glowBoxes={phase !== 'weigh'}
          ontap={(side, kind, _v, k) => { if (side === 'right' && kind === 'weight') take(k); }} />
        {#if phase === 'weigh'}<span class="lean" class:l={tilt > 0.05} class:r={tilt < -0.05}>{tilt > 0.05 ? 'The box side is heavier' : tilt < -0.05 ? 'Your side is heavier' : 'Put weights on this side'}</span>{/if}
      </div>
      {#if note}{#key note}<p class="note" class:good={phase !== 'weigh'}>{note}</p>{/key}{/if}
      {#if phase === 'weigh'}
        <div class="shelf" role="group" aria-label="Weights to put on">
          {#each SHELF as v, k (v)}
            <button class="wt" onpointerdown={(e) => { e.preventDefault(); add(v); }} tabindex="-1" aria-label="Put on a weight of {v}">
              <img src="{base}math/algebra/weight.webp" alt="" style:height="{v === 5 ? 64 : v === 2 ? 54 : 46}px" /><b>{v}</b><span class="kbd">{k + 1}</span>
            </button>
          {/each}
        </div>
      {:else}
        <div class="ask">
          <span>One box weighs</span>
          {#each choices as c, k (c)}
            <button class="choice" class:right={phase === 'done' && c === z.w} class:wrong={picked === c && c !== z.w} disabled={phase === 'done'} onclick={() => choose(c)}><b>{c}</b><span class="kbd">{k + 1}</span></button>
          {/each}
        </div>
      {/if}
    </div>
    <div class="corner" bind:this={corner}></div>
  </div>
</div>

<style>
  .sc { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 980px; margin: 0 auto; }
  .top { display: flex; justify-content: center; }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e4ddff; box-shadow: inset 0 0 0 2px #c9b8ff; }
  .dots i.done { background: #8a5cf0; box-shadow: none; }
  .dots i.now { box-shadow: inset 0 0 0 3px #8a5cf0, 0 0 0 3px #efe9ff; }
  .row { display: flex; gap: 10px; align-items: stretch; }
  .main { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-width: 0; }
  .corner { width: 150px; flex: none; }
  .eq { font-size: 40px; background: #fff; border-radius: 20px; padding: 6px 22px; box-shadow: 0 0 0 3px #e4ddff, var(--shadow-sm); }
  .lab { position: relative; width: 100%; display: flex; justify-content: center; padding: 10px 0 4px; border-radius: 24px; background: linear-gradient(rgba(255, 255, 255, .25), rgba(255, 255, 255, .55)), var(--bg) center / cover; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .7), var(--shadow-sm); }
  .lean { position: absolute; right: 12px; top: 10px; font: 700 14px var(--font-body); color: #4b3a86; background: rgba(255, 255, 255, .9); border-radius: 99px; padding: 3px 10px; }
  .lean.l, .lean.r { color: #b54a1a; }
  .note { margin: 0; font: 600 18px var(--font-ui); color: #b54a1a; background: #fff3e6; border-radius: 99px; padding: 6px 16px; text-align: center; box-shadow: 0 0 0 2px #ffd0a8; animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); }
  .note.good { color: #fff; background: linear-gradient(#a98cff, #6c4fd8); box-shadow: none; }
  @keyframes pop { from { transform: scale(.9); opacity: 0; } }
  .shelf { display: flex; gap: 10px; background: rgba(255, 252, 245, .95); border-radius: 22px; padding: 8px 12px; box-shadow: var(--shadow-sm); }
  .wt { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 2px; width: 84px; height: 96px; border: 0; border-radius: 16px; background: #fff; box-shadow: 0 4px 0 #e6d9b8; cursor: pointer; padding: 4px; }
  .wt:active { transform: translateY(2px); box-shadow: 0 2px 0 #e6d9b8; }
  .wt img { object-fit: contain; filter: drop-shadow(0 3px 3px rgba(80, 50, 10, .3)); }
  .wt b { font: 600 18px var(--font-ui); color: var(--ink); }
  .wt .kbd { position: absolute; top: 4px; right: 6px; }
  .ask { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; font: 700 18px var(--font-body); color: var(--ink2); }
  .choice { position: relative; min-width: 76px; height: 64px; border: 0; border-radius: 18px; background: #fff; box-shadow: 0 0 0 3px #c9b8ff, 0 4px 0 #a98cff; cursor: pointer; font: 600 30px var(--font-ui); color: var(--ink); }
  .choice .kbd { position: absolute; top: 3px; right: 5px; }
  .choice.right { background: linear-gradient(#ffd36b, #f0a21b); color: #fff; box-shadow: 0 0 0 3px #fff3c4, 0 0 20px rgba(255, 200, 80, .8); }
  .choice.wrong { background: #fff0f3; color: #d6335c; box-shadow: 0 0 0 3px #ff8aa5; animation: nope .4s ease; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  @media (max-width: 760px) {
    .corner { display: none; }
    .eq { font-size: 30px; padding: 4px 16px; }
    .wt { width: 72px; height: 84px; }
    .wt .kbd, .choice .kbd { display: none; }
    .note { font-size: 15px; }
  }
</style>
