<script lang="ts">
  // The Smoothie Lab: a calm toy, no clock. A glass of smoothie stands on the bench with its recipe card (or
  // just its colour); tap fruit into the big jug and watch the colour change, then Pour to see if it matches.
  // Any mix in the same ratio is the same colour: 2 to 3 matches 4 to 6. Six glasses a round. The rules are
  // in math/ratios/lab.ts; the colours are Smoothie Stand's own (math/ratios/stand.ts mixColor).
  import { onDestroy, untrack } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { slipStars } from '../playground';
  import { GLASSES, JUG_MAX, labMatch, labNudge, labOrders } from '../ratios/lab';
  import { mixColor } from '../ratios/stand';
  import { FRUIT } from '../skills/ratioPic';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let corner: HTMLDivElement | undefined = $state();
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  const lv = untrack(() => level);
  const orders = labOrders(lv, mulberry32(Date.now() % 1e9));
  const t0 = performance.now();
  let i = $state(0);
  let have = $state<[number, number]>([0, 0]);
  let slips = $state(0), tries = $state(0);
  let note = $state('');
  let ok = $state(false);
  let pouring = $state(false);
  let drops = $state<{ f: string; k: number; x: number }[]>([]);
  let kk = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  const o = $derived(orders[i]);
  const names = $derived([FRUIT[o.fruits[0]].many, FRUIT[o.fruits[1]].many] as [string, string]);
  const target = $derived(mixColor(o.ratio, o.fruits));
  const mine = $derived(mixColor(have, o.fruits));
  const level01 = $derived((have[0] + have[1]) / JUG_MAX);
  const showCard = $derived(o.card !== 'none' || tries >= 2);
  const img = (f: string) => `${base}math/ratios/fruit/${f}.webp`;

  function add(n: 0 | 1) {
    if (ok || pouring) return;
    if (have[0] + have[1] >= JUG_MAX) { sfx.nope(); note = 'The jug is full! Take some out, or Clear.'; return; }
    have = n === 0 ? [have[0] + 1, have[1]] : [have[0], have[1] + 1];
    drops = [...drops.slice(-10), { f: o.fruits[n], k: kk++, x: 25 + ((kk * 37) % 50) }];
    sfx.fruitIn(have[0] + have[1]); note = '';
  }
  function take(n: 0 | 1) { if (ok || pouring || !have[n]) return; have = n === 0 ? [have[0] - 1, have[1]] : [have[0], have[1] - 1]; sfx.pop(); }
  function clearJug() { if (ok || pouring) return; have = [0, 0]; drops = []; sfx.whoosh(); }
  function pour() {
    if (ok || pouring) return;
    if (!have[0] && !have[1]) { sfx.nope(); note = 'Tap some fruit into the jug first!'; return; }
    if (labMatch(o, have)) {
      ok = true; pouring = true; sfx.blend(); pal?.cheer();
      timers.push(setTimeout(() => { sfx.pour(); sfx.cheer(); pouring = false; }, 900));
      note = o.card === 'percent' ? `${have[0]} of ${have[0] + have[1]} is ${o.pct}%. Same colour!` : `${have[0]} : ${have[1]} is the same mix as ${o.ratio[0]} : ${o.ratio[1]}. Same colour!`;
      timers.push(setTimeout(() => {
        if (i + 1 >= GLASSES) { ondone({ stars: slipStars(slips), ms: performance.now() - t0 }); return; }
        i++; have = [0, 0]; drops = []; ok = false; tries = 0; note = '';
      }, 2300));
    } else {
      slips++; tries++; sfx.miss(); pal?.oops();
      note = labNudge(o, have, names);
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === '1') { e.preventDefault(); add(0); }
    else if (e.key === '2') { e.preventDefault(); add(1); }
    else if (e.key === 'Backspace') { e.preventDefault(); take(have[1] ? 1 : 0); }
    else if (e.key === 'Enter') { e.preventDefault(); pour(); }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="lab">
  <div class="top"><span class="dots">{#each Array(GLASSES) as _, k}<i class:done={k < i || (k === i && ok)} class:now={k === i}></i>{/each}</span></div>
  <div class="row">
    <div class="main">
      <div class="bench" style:background-image="radial-gradient(ellipse at 50% 30%, rgba(255, 246, 220, .75), rgba(120, 70, 20, .35)), url({base}learn/ep/tex-juice.webp)">
        <!-- the glass to match, and its card -->
        <div class="want">
          <div class="glass small" style:--c={target}><span class="liq" style:height="86%"><i class="foam"></i></span><span class="straw"></span><img class="garnish" src={img(o.fruits[0])} alt="" /></div>
          <div class="card" class:hidden={!showCard}>
            {#if o.card === 'percent'}
              <span class="pc"><b>{o.pct}%</b><img src={img(o.fruits[0])} alt={names[0]} /></span><small>the rest</small><img class="sm" src={img(o.fruits[1])} alt={names[1]} />
            {:else if showCard}
              <span class="rc"><b>{o.ratio[0]}</b><img src={img(o.fruits[0])} alt={names[0]} /><i>:</i><b>{o.ratio[1]}</b><img src={img(o.fruits[1])} alt={names[1]} /></span>
              {#if o.first !== undefined}<small>use {o.first} {names[0]}</small>{/if}
            {:else}
              <span class="rc q"><img src={img(o.fruits[0])} alt={names[0]} /><i>?</i><img src={img(o.fruits[1])} alt={names[1]} /></span><small>match the colour</small>
            {/if}
          </div>
        </div>
        <!-- the big jug: its colour is your mix -->
        <div class="jugwrap">
          <div class="glass big" class:pouring class:ok style:--c={mine}>
            <span class="liq" style:height="{Math.max(0, Math.min(1, level01)) * 88}%"><i class="foam"></i></span>
            {#each drops as d (d.k)}<img class="drop" src={img(d.f)} alt="" style:left="{d.x}%" />{/each}
            <span class="count">{have[0]} : {have[1]}</span>
          </div>
          {#if ok}<div class="sparkle" aria-hidden="true">{#each Array(10) as _, s (s)}<i style:--a="{s * 36}deg"></i>{/each}</div>{/if}
        </div>
      </div>
      <div class="fruits">
        {#each [0, 1] as const as n (n)}
          <div class="fb">
            <button class="add" onclick={() => add(n)} disabled={ok} aria-label="Add a {FRUIT[o.fruits[n]].one}">
              <img src={img(o.fruits[n])} alt="" /><span class="cnt" class:zero={!have[n]}>{have[n]}</span><b>{names[n]}</b><span class="k">{n + 1}</span>
            </button>
            <button class="minus" onclick={() => take(n)} disabled={!have[n] || ok} aria-label="Take a {FRUIT[o.fruits[n]].one} out">−</button>
          </div>
        {/each}
        <button class="btn clearb" onclick={clearJug} disabled={ok || (!have[0] && !have[1])}>Clear</button>
      </div>
    </div>
    <div class="corner" bind:this={corner}></div>
  </div>
  <div class="foot">
    <p class="note" class:good={ok}>{note || (o.card === 'none' ? 'Mix and look: is your jug the same colour as the glass?' : o.card === 'percent' ? `${o.pct}% of the fruit is ${names[0]}. Any size jug!` : o.first !== undefined ? `Use ${o.first} ${names[0]}. How many ${names[1]} keep the same mix?` : 'Any size works: the same mix makes the same colour.')}</p>
    <button class="btn btn-primary pourb" onclick={pour} disabled={ok}>Pour <span class="kbd">enter</span></button>
  </div>
</div>

<style>
  .lab { width: min(980px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; justify-content: center; }
  .dots { display: flex; gap: 6px; justify-content: center; background: rgba(255, 255, 255, .9); border-radius: 20px; padding: 6px 14px; box-shadow: var(--shadow-sm); }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #f2e3e8; }
  .dots i.done { background: #ef5f8a; } .dots i.now { box-shadow: 0 0 0 3px #ef5f8a; }
  .row { display: flex; gap: 12px; align-items: stretch; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .corner { flex: 0 0 clamp(140px, 18vw, 220px); }
  .bench { display: flex; align-items: flex-end; justify-content: center; gap: clamp(20px, 6vw, 70px); width: 100%; padding: 18px 18px 22px; border-radius: 26px; background-size: 100% 100%, 256px; background-blend-mode: soft-light, normal; box-shadow: inset 0 3px 0 rgba(255, 255, 255, .3), 0 6px 0 #9c6a38, var(--shadow-sm); }
  .want { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .glass { position: relative; border-radius: 10px 10px 34px 34px; background: linear-gradient(90deg, rgba(255, 255, 255, .55), rgba(255, 255, 255, .25) 30%, rgba(255, 255, 255, .15) 70%, rgba(255, 255, 255, .5)); box-shadow: inset 0 0 0 4px rgba(255, 255, 255, .85), inset 0 -10px 18px rgba(0, 0, 0, .06), 0 10px 16px rgba(80, 40, 10, .25); overflow: hidden; }
  .glass.small { width: 96px; height: 150px; }
  .glass.big { width: clamp(170px, 24vw, 230px); height: clamp(240px, 32vw, 300px); border-radius: 16px 16px 48px 48px; }
  .liq { position: absolute; left: 6px; right: 6px; bottom: 6px; border-radius: 6px 6px 28px 28px; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 82%, #000), var(--c) 30%, color-mix(in srgb, var(--c) 70%, #fff) 60%, var(--c)); transition: height .35s cubic-bezier(.3, 1.4, .5, 1), background .5s; }
  .big .liq { border-radius: 10px 10px 40px 40px; }
  .foam { position: absolute; left: 0; right: 0; top: -6px; height: 12px; border-radius: 50%; background: color-mix(in srgb, var(--c) 45%, #fff); }
  .straw { position: absolute; right: 18px; top: -20px; width: 10px; height: 110px; border-radius: 5px; background: repeating-linear-gradient(180deg, #fff 0 10px, #ef5f8a 10px 20px); transform: rotate(12deg); }
  .garnish { position: absolute; left: -4px; top: -8px; width: 44px; height: 44px; object-fit: contain; transform: rotate(-18deg); }
  .glass.small { overflow: visible; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fffaf0; border-radius: 16px; padding: 6px 12px; box-shadow: 0 0 0 3px #ffd0dd, var(--shadow-sm); }
  .card.hidden { opacity: 1; }
  .rc, .pc { display: flex; align-items: center; gap: 2px; }
  .rc b, .pc b { font: 600 28px var(--font-ui); color: var(--ink); }
  .rc i { font: 600 26px var(--font-ui); font-style: normal; color: #ef5f8a; margin: 0 4px; }
  .rc img, .pc img { width: 40px; height: 40px; object-fit: contain; }
  .rc.q i { font-size: 30px; color: var(--muted); }
  .card small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .card .sm { width: 28px; height: 28px; object-fit: contain; }
  .jugwrap { position: relative; }
  .drop { position: absolute; top: 18%; width: 40px; height: 40px; object-fit: contain; transform: translateX(-50%); animation: plunk .7s cubic-bezier(.5, 0, .6, 1) forwards; pointer-events: none; }
  @keyframes plunk { 0% { transform: translate(-50%, -140%) rotate(0); opacity: 1; } 60% { transform: translate(-50%, 120%) rotate(160deg); opacity: 1; } 100% { transform: translate(-50%, 160%) rotate(220deg) scale(.4); opacity: 0; } }
  .count { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); font: 600 22px var(--font-ui); color: #6b3d10; background: rgba(255, 255, 255, .88); padding: 2px 12px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .glass.pouring { animation: tip .9s ease-in-out; }
  @keyframes tip { 30% { transform: rotate(-10deg); } 60% { transform: rotate(8deg); } }
  .glass.ok { box-shadow: inset 0 0 0 4px #fff, 0 0 0 5px #7ee0a8, 0 0 34px rgba(80, 220, 150, .7); }
  .sparkle { position: absolute; left: 50%; top: 40%; pointer-events: none; }
  .sparkle i { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: radial-gradient(#fff, #ffd36b); transform: rotate(var(--a)) translateY(0); animation: burst .9s ease-out forwards; }
  @keyframes burst { to { transform: rotate(var(--a)) translateY(-130px); opacity: 0; } }
  .fruits { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; justify-content: center; }
  .fb { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .add { position: relative; display: flex; flex-direction: column; align-items: center; border: 0; cursor: pointer; background: #fff; border-radius: 20px; padding: 6px 16px 4px; min-width: 116px; box-shadow: 0 4px 0 #f2c9a0, var(--shadow-sm); transition: transform .1s; touch-action: manipulation; }
  .add:active:not(:disabled) { transform: translateY(2px) scale(.97); }
  .add img { width: 62px; height: 62px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(80, 50, 10, .3)); }
  .add b { font: 700 14px var(--font-body); color: var(--ink2); text-transform: capitalize; }
  .cnt { position: absolute; top: 2px; right: 6px; min-width: 32px; height: 32px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font: 600 20px var(--font-ui); color: #fff; background: #ef5f8a; box-shadow: 0 0 0 3px #fff; }
  .cnt.zero { background: #d8c9cf; }
  .k { position: absolute; top: 4px; left: 8px; font: 700 11px var(--font-body); color: var(--muted); }
  .minus { width: 46px; height: 32px; border: 0; border-radius: 12px; background: #fff; box-shadow: 0 3px 0 #e6d6c2; font: 600 24px/1 var(--font-ui); color: var(--ink2); cursor: pointer; }
  .minus:disabled, .add:disabled { opacity: .55; cursor: default; }
  .clearb { align-self: center; }
  .foot { display: flex; align-items: center; gap: 12px; }
  .note { flex: 1; margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); background: #fff2f5; border-radius: 14px; padding: 10px 14px; }
  .note.good { background: #e2f7ee; color: #0f6a48; }
  .pourb { font-size: 22px; padding: 12px 26px; }
  @media (max-width: 600px) {
    .row { flex-direction: column-reverse; } .corner { flex: 0 0 90px; }
    .bench { gap: 18px; padding: 12px 10px 14px; }
    .glass.small { width: 70px; height: 110px; }
    .straw { height: 80px; }
    .garnish { width: 32px; height: 32px; }
    .glass.big { width: 150px; height: 200px; }
    .rc b, .pc b { font-size: 22px; } .rc img, .pc img { width: 30px; height: 30px; }
    .add { min-width: 0; width: 104px; padding: 4px 8px 2px; } .add img { width: 46px; height: 46px; } .k { display: none; }
    .foot { flex-direction: column; align-items: stretch; }
    .pourb .kbd { display: none; }
  }
</style>
