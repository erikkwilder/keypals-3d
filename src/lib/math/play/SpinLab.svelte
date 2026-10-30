<script lang="ts">
  // Spin Lab: a calm Playground toy, no clock. Three experiments a round: pick what you think will come
  // up most, then spin the spinner (or roll the die, or two dice) one at a time or ten at once, and watch
  // the bar graph of what happened grow. A star for each smart pick (the most likely one), whatever the
  // spins then do. The rules are in math/data/lab.ts.
  import { onDestroy, untrack } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { EXPERIMENTS, experiment, labStars, smartPick, trial, type Experiment } from '../data/lab';
  import { COLOR, type ColorId, type DataPic } from '../data/pics';
  import DataPicView from '../data/ui/DataPic.svelte';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number; right?: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const lv = untrack(() => level);
  const rng = mulberry32(Date.now() % 1e9);
  const t0 = performance.now();
  let corner: HTMLDivElement | undefined = $state();
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });

  let n = $state(0);
  let ex = $state<Experiment>(experiment(lv, 0, rng));
  let pick = $state<number | null>(null);
  let counts = $state<number[]>([]);
  let spins = $state(0);
  let smart = $state(0);
  let rot = $state(0);
  let faces = $state<number[]>([3, 4]);
  let rollKey = $state(0);
  let busy = $state(false);
  let note = $state('');
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));
  $effect(() => { void n; untrack(() => { counts = ex.outcomes.map(() => 0); spins = 0; pick = null; busy = false; note = ''; }); });

  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const isColor = (o: string) => o in COLOR;
  const nameOf = (o: string) => (isColor(o) ? cap(o) : o);
  const done = $derived(spins >= ex.target);
  const graph = $derived.by((): DataPic => {
    const top = Math.max(1, ...counts);
    const step = top <= 8 ? 1 : top <= 16 ? 2 : 5;
    const max = Math.max(step * 4, Math.ceil(top / step) * step);
    return { kind: 'bars', cats: ex.outcomes.map((o, k) => ({ name: nameOf(o), n: counts[k] ?? 0, color: (isColor(o) ? o : k === pick ? 'orange' : 'blue') as ColorId })), step, max, title: ex.kind === 'spinner' ? 'Where it landed' : ex.kind === 'die' ? 'What it rolled' : 'The totals' };
  });
  const things = $derived(ex.kind === 'spinner' ? 'spins' : 'rolls');

  function choose(k: number) {
    if (pick !== null) return;
    pick = k; sfx.pop();
    if (smartPick(ex, k)) { smart++; pal?.cheer(); note = ex.ways.every(w => w === ex.ways[0]) ? 'Every one is as likely, so any pick is smart! Now spin and see.' : `Smart pick! ${nameOf(ex.outcomes[k])} has the most ways to happen. Now ${ex.kind === 'spinner' ? 'spin' : 'roll'} and see.`; }
    else { const b = ex.ways.indexOf(Math.max(...ex.ways)); note = `Let's see! (${nameOf(ex.outcomes[b])} has the most ways: ${ex.ways[b]} of ${ex.ways.reduce((t, x) => t + x, 0)}.)`; }
  }
  /** one spin or roll, its picture moving to show it */
  function once(fast: boolean) {
    const t = trial(ex, rng);
    if (ex.kind === 'spinner') {
      const parts = ex.parts!, step = 360 / parts.length;
      // the wheel turns so part t.part stops under the pointer at the top (a little way inside it)
      const want = (t.part! + 0.5) * step + (rng() - 0.5) * step * 0.6;
      const turns = fast ? 1 : 3;
      const cur = ((rot % 360) + 360) % 360;
      rot = rot - cur + turns * 360 + (360 - want);
    } else { faces = t.faces!; rollKey++; }
    return t.k;
  }
  function spin(times: number) {
    if (pick === null || busy || done) return;
    busy = true;
    const go = Math.min(times, ex.target - spins);
    const gap = go > 1 ? 260 : 1400;
    for (let i = 0; i < go; i++) {
      timers.push(setTimeout(() => {
        const k = once(go > 1);
        if (go === 1) sfx.whoosh(); else sfx.click();
        timers.push(setTimeout(() => {
          counts[k] = (counts[k] ?? 0) + 1; spins++;
          sfx.ding(Math.min(6, counts[k]));
          if (i === go - 1) { busy = false; if (spins >= ex.target) finishOne(); }
        }, go > 1 ? 200 : 1300));
      }, i * gap));
    }
  }
  function finishOne() {
    const top = Math.max(...counts), most = counts.map((c, k) => (c === top ? k : -1)).filter(k => k >= 0);
    const b = ex.ways.indexOf(Math.max(...ex.ways));
    note = `${most.map(k => nameOf(ex.outcomes[k])).join(' and ')} came up most: ${top} of ${spins}. ${ex.ways.every(w => w === ex.ways[0]) ? 'With lots of rolls, they all even out.' : most.includes(b) ? 'Just what the chances said!' : `The chances said ${nameOf(ex.outcomes[b])}: a few spins can surprise you. Lots of spins grow toward the chances.`}`;
    pal?.cheer(); sfx.complete();
  }
  function nextOne() {
    sfx.click();
    if (n + 1 >= EXPERIMENTS) { ondone({ stars: labStars(smart), ms: performance.now() - t0, right: smart * 3 }); return; }
    ex = experiment(lv, n + 1, rng); n++;
  }
  function wedge(i: number, k: number, r = 46) {
    const a0 = (i / k) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / k) * Math.PI * 2 - Math.PI / 2;
    const p = (a: number) => `${(50 + r * Math.cos(a)).toFixed(2)},${(52 + r * Math.sin(a)).toFixed(2)}`;
    return `M50,52 L${p(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0},1 ${p(a1)} Z`;
  }
  function key(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    if (pick === null) { const i = Number(e.key) - 1; if (i >= 0 && i < ex.outcomes.length && ex.outcomes.length <= 9) { e.preventDefault(); choose(i); } return; }
    if (e.key === ' ') { e.preventDefault(); spin(1); }
    else if (e.key === 'Enter') { e.preventDefault(); if (done) nextOne(); else spin(10); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="lab">
  <div class="steps">{#each Array(EXPERIMENTS) as _, i (i)}<span class:on={i === n} class:past={i < n}></span>{/each}</div>
  <div class="row">
    <div class="thing">
      {#if ex.kind === 'spinner'}
        <div class="wheel">
          <svg viewBox="0 0 100 104" class="disc" style:transform="rotate({rot}deg)">
            <circle cx="50" cy="52" r="49" fill="#ffe08a" stroke="#c99410" stroke-width="2" />
            {#each ex.parts ?? [] as c, i (i)}<path d={wedge(i, ex.parts!.length)} fill={COLOR[c].hex} stroke="#fff" stroke-width="1.4" />{/each}
            <circle cx="50" cy="52" r="7" fill="#fff4cf" stroke="#c99410" stroke-width="2" />
          </svg>
          <svg viewBox="0 0 20 20" class="ptr"><polygon points="2,2 18,2 10,16" fill="#e0405a" stroke="#fff" stroke-width="2" stroke-linejoin="round" /></svg>
        </div>
      {:else}
        {#key rollKey}<div class="dice" class:roll={rollKey > 0}><DataPicView d={{ kind: 'dice', faces: ex.kind === 'die' ? [faces[0]] : faces }} size={240} /></div>{/key}
      {/if}
      {#if pick !== null && !done}
        <div class="go">
          <button class="btn btn-primary big" disabled={busy} onclick={() => spin(1)}>{ex.kind === 'spinner' ? 'Spin' : 'Roll'} <span class="kbd">space</span></button>
          <button class="btn big" disabled={busy} onclick={() => spin(10)}>{ex.kind === 'spinner' ? 'Spin' : 'Roll'} 10 <span class="kbd">enter</span></button>
        </div>
        <p class="count">{spins} of {ex.target} {things}</p>
      {/if}
    </div>
    <div class="graph">
      {#if pick === null}
        <h3>Which will come up most?</h3>
        <div class="picks" class:many={ex.outcomes.length > 6}>
          {#each ex.outcomes as o, k (o)}
            <button class="pk" onclick={() => choose(k)} style:--pc={isColor(o) ? COLOR[o as ColorId].hex : '#4a95f2'}>
              {#if isColor(o)}<span class="sw"></span>{/if}<b>{nameOf(o)}</b>{#if ex.kind === 'spinner'}<small>{ex.ways[k]} of {ex.parts?.length} parts</small>{/if}
            </button>
          {/each}
        </div>
      {:else}
        <DataPicView d={graph} size={250} />
      {/if}
      {#if note}<p class="note">{note}</p>{/if}
      {#if done}<button class="btn btn-primary big" onclick={nextOne}>{n + 1 >= EXPERIMENTS ? 'Finish' : 'Next experiment'} <span class="kbd">enter</span></button>{/if}
    </div>
    <div class="corner" bind:this={corner} aria-hidden="true"></div>
  </div>
</div>

<style>
  .lab { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
  .steps { display: flex; gap: 8px; }
  .steps span { width: 34px; height: 10px; border-radius: 999px; background: #e9e1f5; }
  .steps span.on { background: #e85d9a; } .steps span.past { background: #f3a8c8; }
  .row { display: flex; align-items: center; justify-content: center; gap: 22px; flex-wrap: wrap; width: 100%; }
  .thing { display: flex; flex-direction: column; align-items: center; gap: 10px; }
  .wheel { position: relative; width: min(300px, 70vw); aspect-ratio: 1; }
  .disc { width: 100%; height: 100%; transition: transform 1.25s cubic-bezier(.15, .7, .2, 1); filter: drop-shadow(0 10px 14px rgba(120, 60, 20, .3)); }
  .ptr { position: absolute; left: 50%; top: -14px; width: 40px; transform: translateX(-50%); filter: drop-shadow(0 3px 2px rgba(0, 0, 0, .3)); }
  .dice { padding: 20px; }
  .dice.roll { animation: tumble .5s cubic-bezier(.3, .8, .4, 1.3); }
  @keyframes tumble { 0% { transform: translateY(-30px) rotate(-25deg) scale(.9); } 60% { transform: translateY(6px) rotate(8deg); } }
  .go { display: flex; gap: 10px; }
  .big { font-size: 22px; padding: 12px 22px; }
  .count { margin: 0; font: 700 15px var(--font-body); color: var(--muted); }
  .graph { display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(255, 255, 255, .92); border-radius: 26px; padding: 16px; box-shadow: var(--shadow-sm); min-width: min(420px, 92vw); max-width: 560px; }
  .graph h3 { margin: 0; font: 600 24px var(--font-ui); color: var(--ink); }
  .picks { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; width: 100%; }
  .picks.many { grid-template-columns: repeat(6, 1fr); }
  .pk { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 3px solid #fff; border-radius: 20px; padding: 10px 6px; background: linear-gradient(#fff, #f6f1ff); box-shadow: 0 5px 0 #e2d8f3; cursor: pointer; transition: transform .1s; }
  .pk:hover { transform: translateY(-3px); }
  .pk .sw { width: 44px; height: 44px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff 0 12%, var(--pc) 45%); box-shadow: 0 3px 6px rgba(0, 0, 0, .2); }
  .pk b { font: 600 22px var(--font-ui); color: var(--ink); }
  .pk small { font: 700 12px var(--font-body); color: var(--muted); }
  .note { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); text-align: center; max-width: 480px; }
  .corner { width: 170px; height: 220px; }
  @media (max-width: 760px) { .corner { display: none; } .row { gap: 12px; } .graph { padding: 10px; } .picks.many { grid-template-columns: repeat(4, 1fr); } }
</style>
