<script lang="ts">
  // Build It: build the number with hundreds flats, tens rods and ones cubes. Ten ones trade up for a
  // ten (and ten tens for a hundred) right in front of you. Press Check when it's built. Six numbers.
  import { onDestroy } from 'svelte';
  import { mulberry32 } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { buildNumbers, slipStars } from '../playground';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  let corner: HTMLDivElement | undefined = $state();
  // the buddy about 100 pixels tall, whatever the corner's size
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  const nums = buildNumbers(level, mulberry32(Date.now() % 1e9));
  const hundreds = level >= 3;
  const t0 = performance.now();
  let i = $state(0);
  let h = $state(0), t = $state(0), o = $state(0);
  let slips = $state(0);
  let note = $state('');
  let ok = $state(false);
  let trade = $state(0);
  const target = $derived(nums[i]);
  const value = $derived(h * 100 + t * 10 + o);
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  function more(k: 'h' | 't' | 'o') {
    if (ok) return;
    note = ''; sfx.click();
    if (k === 'o') { o++; if (o === 10) { o = 0; t++; trade++; note = '10 ones make a ten!'; pal?.cheer(); } }
    if (k === 't') { t++; }
    if (k === 'h' && hundreds) h = Math.min(9, h + 1);
    if (t === 10) { if (hundreds) { t = 0; h = Math.min(9, h + 1); trade++; note = '10 tens make a hundred!'; } else t = 9; }
  }
  function less(k: 'h' | 't' | 'o') {
    if (ok) return;
    note = ''; sfx.click();
    if (k === 'o') o = Math.max(0, o - 1);
    if (k === 't') t = Math.max(0, t - 1);
    if (k === 'h') h = Math.max(0, h - 1);
  }
  function check() {
    if (ok) return;
    if (value === target) {
      ok = true; sfx.complete(); pal?.cheer();
      note = `Yes! ${hundreds ? `${h} hundred${h === 1 ? '' : 's'}, ` : ''}${t} ten${t === 1 ? '' : 's'} and ${o} one${o === 1 ? '' : 's'} make ${target}.`;
      timers.push(setTimeout(() => {
        if (i + 1 >= nums.length) { ondone({ stars: slipStars(slips), ms: performance.now() - t0 }); return; }
        i++; h = 0; t = 0; o = 0; ok = false; note = '';
      }, 1500));
    } else {
      slips++; sfx.miss(); pal?.oops();
      const T = Math.floor((target % 100) / 10), H = Math.floor(target / 100);
      note = `That's ${value}. ${target} has ${hundreds ? `${H} hundred${H === 1 ? '' : 's'}, ` : ''}${T} ten${T === 1 ? '' : 's'} and ${target % 10} one${target % 10 === 1 ? '' : 's'}.`;
    }
  }
  function onKey(e: KeyboardEvent) { if (e.key === 'Enter') { e.preventDefault(); check(); } }
</script>

<svelte:window onkeydown={onKey} />

<div class="bi">
  <div class="top">
    <span class="dots">{#each nums as _, k}<i class:done={k < i || (k === i && ok)} class:now={k === i}></i>{/each}</span>
  </div>
  <div class="ask"><span>Build</span><b>{target}</b></div>
  <div class="row">
  <div class="cols" class:three={hundreds}>
    {#if hundreds}
      <section class="col">
        <h4>Hundreds</h4>
        <div class="blocks flats">{#each Array(h) as _, k}<svg class="flat" style:--k={k} viewBox="0 0 50 50"><rect x="1" y="1" width="48" height="48" rx="3" fill="#ffb38a" stroke="#c96a3a" stroke-width="1.5" />{#each Array(9) as _, g}<line x1={5 * (g + 1)} x2={5 * (g + 1)} y1="1" y2="49" stroke="#c96a3a" stroke-width=".6" /><line y1={5 * (g + 1)} y2={5 * (g + 1)} x1="1" x2="49" stroke="#c96a3a" stroke-width=".6" />{/each}</svg>{/each}</div>
        <div class="btns"><button onclick={() => less('h')} aria-label="One hundred fewer">−</button><span>{h}</span><button onclick={() => more('h')} aria-label="One hundred more">+</button></div>
      </section>
    {/if}
    <section class="col">
      <h4>Tens</h4>
      <div class="blocks rods">{#key trade}{#each Array(t) as _, k}<svg class="rod" viewBox="0 0 10 100"><rect x="1" y="1" width="8" height="98" rx="2" fill="#9fd4ff" stroke="#3f8fc4" stroke-width="1.2" />{#each Array(9) as _, g}<line x1="1" x2="9" y1={10 * (g + 1)} y2={10 * (g + 1)} stroke="#3f8fc4" stroke-width=".8" />{/each}</svg>{/each}{/key}</div>
      <div class="btns"><button onclick={() => less('t')} aria-label="One ten fewer">−</button><span>{t}</span><button onclick={() => more('t')} aria-label="One ten more">+</button></div>
    </section>
    <section class="col">
      <h4>Ones</h4>
      <div class="blocks cubes">{#each Array(o) as _, k}<svg class="cube" viewBox="0 0 10 10"><rect x=".6" y=".6" width="8.8" height="8.8" rx="1.6" fill="#b9f0c8" stroke="#3f9a6a" stroke-width=".9" /></svg>{/each}</div>
      <div class="btns"><button onclick={() => less('o')} aria-label="One fewer">−</button><span>{o}</span><button onclick={() => more('o')} aria-label="One more">+</button></div>
    </section>
  </div>
  <!-- your buddy stands here on the island, cheering when a number's built -->
  <div class="corner" bind:this={corner}></div>
  </div>
  <div class="foot">
    <p class="note" class:good={ok}>{note || 'Add blocks with +, then press Check.'}</p>
    <button class="btn btn-primary check" onclick={check} disabled={ok}>Check <span class="kbd">enter</span></button>
  </div>
</div>

<style>
  .bi { width: min(980px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .dots { display: flex; gap: 6px; justify-content: center; }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; }
  .dots i.done { background: #ef7d2b; } .dots i.now { box-shadow: 0 0 0 3px #ef7d2b; }
  .ask { display: flex; align-items: center; justify-content: center; gap: 14px; font: 600 clamp(26px, 4vw, 40px) var(--font-ui); color: var(--ink2); }
  .ask b { font-size: clamp(48px, 8vw, 80px); color: #ef7d2b; line-height: 1; }
  .bud.yay { animation: yay .6s ease; }
  @keyframes yay { 40% { transform: translateY(-14px) rotate(8deg); } }
  .row { display: flex; gap: 12px; align-items: stretch; }
  .row .cols { flex: 1; }
  .corner { flex: 0 0 clamp(140px, 18vw, 220px); }
  .ask, .dots { background: rgba(255, 255, 255, .9); border-radius: 20px; padding: 2px 16px; align-self: center; box-shadow: var(--shadow-sm); }
  .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .cols.three { grid-template-columns: 1.3fr 1fr 1fr; }
  .col { background: #fff; border-radius: 22px; box-shadow: var(--shadow-sm); padding: 10px 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .col h4 { margin: 0; font: 600 18px var(--font-ui); color: var(--ink2); }
  .blocks { flex: 1; width: 100%; min-height: 150px; display: flex; flex-wrap: wrap; align-content: flex-end; justify-content: center; gap: 4px; padding: 6px; border-radius: 14px; background: #faf7f0; }
  .flat { width: 54px; height: 54px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.5); }
  .rod { width: 14px; height: 140px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.5); }
  .cubes { max-width: 160px; }
  .cube { width: 26px; height: 26px; animation: pop-in .25s cubic-bezier(.3, .8, .4, 1.5); }
  .btns { display: flex; align-items: center; gap: 10px; }
  .btns button { width: 52px; height: 52px; border-radius: 16px; border: 0; cursor: pointer; font: 600 30px/1 var(--font-ui); background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 4px 0 #d9cff0; color: var(--ink); touch-action: manipulation; }
  .btns button:active { transform: translateY(3px); box-shadow: 0 1px 0 #d9cff0; }
  .btns span { min-width: 30px; text-align: center; font: 600 28px var(--font-ui); }
  .foot { display: flex; align-items: center; gap: 12px; }
  .note { flex: 1; margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); background: #fff7d6; border-radius: 14px; padding: 10px 14px; }
  .note.good { background: #e2f7ee; color: #0f6a48; }
  .check { font-size: 22px; padding: 12px 22px; }
  @media (max-width: 600px) {
    .row { flex-direction: column-reverse; } .corner { flex: 0 0 110px; } .row .cols { flex: none; }
    .cols.three { grid-template-columns: 1fr 1fr 1fr; gap: 6px; }
    .col { padding: 8px 4px; border-radius: 16px; }
    .flat { width: 34px; height: 34px; }
    .rod { width: 10px; height: 100px; }
    .cube { width: 18px; height: 18px; }
    .blocks { min-height: 110px; }
    .btns { gap: 4px; } .btns button { width: 38px; height: 38px; font-size: 24px; } .btns span { font-size: 20px; min-width: 18px; }
    .foot { flex-direction: column; align-items: stretch; }
    .check .kbd { display: none; }
  }
</style>
