<script lang="ts">
  // A money Learn episode at the sky market (math/market/episodes.ts): the painted market set, the
  // stall's Glimmer and your buddy at the counter, and the coach telling the story. The steps show their
  // picture and sum (Next moves on); then the buddy has a go and gets it wrong, you fix it, you try three
  // of your own, and you win the card. It saves the trick like any episode (learn.ts finishLesson).
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../../state/game.svelte';
  import { quietForLesson, sfx } from '../../audio/sound';
  import { say, hush } from '../../audio/voice.svelte';
  import { outfitOf } from '../../engine/profile';
  import { finishLesson } from '../learn';
  import { GLIMMER } from '../../adventure/glimmers';
  import { glimmerArt } from '../../adventure/evolve';
  import { FRIEND } from '../../art/cast';
  import Critter from '../../ui/Critter.svelte';
  import Icon from '../../ui/Icon.svelte';
  import MoneyPic from '../skills/ui/MoneyPic.svelte';
  import FractionPic from '../skills/ui/FractionPic.svelte';
  import { MARKET_SET, type MarketLesson, type MarketQ } from './episodes';
  import type { Pic } from '../skills/types';

  type Props = { lesson: MarketLesson; onclose: () => void };
  let { lesson, onclose }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  type Phase = 'intro' | 'step' | 'teach' | 'fix' | 'try' | 'card';
  let phase = $state<Phase>('intro');
  let step = $state(0), tryN = $state(0);
  let line = $state('');
  let typed = $state('');
  let feedback = $state<{ ok: boolean; text: string } | null>(null);
  let slips = $state(0);
  let fixedOk = $state(false);
  let won = $state<{ first: boolean; shells: number } | null>(null);
  let wide = $state(true);

  const L = $derived(lesson);
  const star = $derived(GLIMMER[L.star]);
  const q = $derived<MarketQ | null>(phase === 'teach' || phase === 'fix' ? L.teach.q : phase === 'try' ? L.tries[tryN] : null);
  const pic = $derived<Pic | null>(phase === 'step' ? L.steps[step].pic : q?.pic ?? null);
  const eq = $derived(phase === 'step' ? L.steps[step].eq : '');
  /** the sum with its [lit] parts */
  const eqParts = $derived(eq.split(/(\[[^\]]*\])/).filter(Boolean).map(s => (s.startsWith('[') ? { lit: true, t: s.slice(1, -1) } : { lit: false, t: s })));
  /** how an answer reads: cents for coin questions, the choice's words for comparing */
  const show = (x: string, qq: MarketQ) => (qq.input === 'choice' ? (qq.choices ?? [])[['a', 'same', 'b'].indexOf(x)] ?? x : qq.input === 'num' ? `${x}¢` : x);
  // the fix buttons in a fixed order per episode (not always the right one first)
  const fixOrder = $derived.by(() => { const xs = [L.teach.q.ans, L.teach.wrong, L.teach.decoy]; const k = L.id.length % 3; return [...xs.slice(k), ...xs.slice(0, k)]; });

  /** The coach says a line (it stays up as text too). */
  function speak(id: string, text: string) { line = text; say(id, { important: true, caption: false }).catch(() => {}); }
  // the music hushes while the lesson plays (the coach's voice and the sounds carry on)
  let unquiet = () => {};
  onMount(() => { unquiet = quietForLesson(); speak(`ep.${L.id}.intro`, L.intro); fit(); addEventListener('resize', fit); });
  onDestroy(() => { hush(); unquiet(); removeEventListener('resize', fit); });
  function fit() { wide = innerWidth > 760; }

  function next() {
    sfx.click(); feedback = null;
    if (phase === 'intro') { phase = 'step'; step = 0; speak(`ep.${L.id}.s0`, L.steps[0].say); return; }
    if (phase === 'step' && step + 1 < L.steps.length) { step++; speak(`ep.${L.id}.s${step}`, L.steps[step].say); return; }
    if (phase === 'step') { phase = 'teach'; speak('ep.teach', 'Now your buddy will try one. Watch carefully. Is it right?'); return; }
    if (phase === 'teach') { phase = 'fix'; speak('ep.fix', "Hmm, that's not right! Tap the right answer to help."); return; }
    if (phase === 'fix' && fixedOk) { phase = 'try'; tryN = 0; typed = ''; speak('ep.turn', 'Your turn! Use the trick.'); return; }
    if (phase === 'try' && feedback === null && tryN + 1 < L.tries.length) return;
  }
  function fix(x: string) {
    if (fixedOk) return;
    if (x === L.teach.q.ans) { fixedOk = true; sfx.complete(); speak('ep.fixed', 'You spotted the mistake and fixed it! Explaining is the best way to learn.'); feedback = { ok: true, text: L.teach.fixed }; }
    else { sfx.nope(); speak('ep.again', 'Not that one. Look at the picture and try again.'); }
  }
  function answer(x: string) {
    const qq = L.tries[tryN];
    if (!qq || feedback?.ok) return;
    const ok = qq.input === 'choice' ? x === qq.ans : x !== '' && Math.abs(Number(x) - Number(qq.ans)) < 1e-9;
    if (ok) {
      sfx.complete();
      feedback = { ok: true, text: `Yes! ${show(qq.ans, qq)}.` };
      setTimeout(() => {
        feedback = null; typed = '';
        if (tryN + 1 < L.tries.length) { tryN++; speak('ep.turn2', 'One more!'); }
        else finish();
      }, 1300);
    } else {
      slips++; sfx.nope();
      feedback = { ok: false, text: slips > 2 ? `${qq.hint} It's ${show(qq.ans, qq)}.` : qq.hint };
    }
  }
  function finish() {
    phase = 'card';
    speak(`ep.${L.id}.card`, L.card);
    let out: { first: boolean; shells: number } | null = null;
    game.update(pp => { const r = finishLesson(pp, L.id); out = { first: r.first, shells: r.shells }; });
    won = out;
    sfx.star(0); setTimeout(() => sfx.star(1), 300); setTimeout(() => sfx.star(2), 600);
  }
  function pad(k: string) {
    if (phase !== 'try' || feedback?.ok) return;
    feedback = null; sfx.click();
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k === '.') { if (!typed.includes('.')) typed = (typed || '0') + '.'; }
    else if (typed.length < 6) typed = typed === '0' ? k : typed + k;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose(); return; }
    if (phase === 'try' && L.tries[tryN].input !== 'choice') {
      if (/^[0-9]$/.test(e.key) || e.key === '.') { e.preventDefault(); pad(e.key); return; }
      if (e.key === 'Backspace') { e.preventDefault(); pad('⌫'); return; }
      if (e.key === 'Enter') { e.preventDefault(); answer(typed); return; }
    }
    if (e.key === 'Enter' && (phase === 'intro' || phase === 'step' || phase === 'teach' || (phase === 'fix' && fixedOk))) { e.preventDefault(); next(); }
  }
  const dots = $derived(['intro', ...L.steps.map((_, i) => `s${i}`), 'teach', 'try0', 'try1', 'try2', 'card']);
  const at = $derived(phase === 'intro' ? 0 : phase === 'step' ? 1 + step : phase === 'teach' || phase === 'fix' ? 1 + L.steps.length : phase === 'try' ? 2 + L.steps.length + tryN : dots.length - 1);
</script>

<svelte:window onkeydown={onKey} />

<div class="ep" style:background-image="url({base}{MARKET_SET.backdrop})" role="dialog" aria-label={L.title}>
  <header>
    <span class="name"><img src="{base}math/money/quarter.webp" alt="" /><b>{L.title}</b><small>{MARKET_SET.name}</small></span>
    <span class="dots">{#each dots as _, k}<i class:done={k < at} class:now={k === at}></i>{/each}</span>
    <button class="x" onclick={() => { sfx.click(); onclose(); }} aria-label="Close"><Icon name="close" size={22} /></button>
  </header>

  <!-- the board: in the open middle of the painted market -->
  <div class="board">
    {#if phase === 'card'}
      <div class="card-won">
        <span class="cframe">
          <img class="cart" src="{base}{MARKET_SET.backdrop}" alt="" />
          <img class="cstar" src="{base}{glimmerArt(L.star)}" alt="" />
          <b>{L.title}</b>
        </span>
        <p>{L.blurb}</p>
        {#if won?.shells}<span class="shells"><img src="{base}game/icon-shell.webp" alt="" /> +{won.shells} shells</span>{/if}
      </div>
    {:else}
      {#if q}<p class="qtext">{q.text}</p>{/if}
      {#if pic}
        <div class="pic">{#if pic.kind === 'coins' || pic.kind === 'grid'}<MoneyPic {pic} size={wide ? 300 : 230} />{:else}<FractionPic {pic} size={wide ? 300 : 230} />{/if}</div>
      {:else if phase === 'intro'}
        <img class="hero" src="{base}{glimmerArt(L.star)}" alt={star.name} />
      {/if}
      {#if eq}<p class="eq">{#each eqParts as s, k (k)}{#if s.lit}<mark>{s.t}</mark>{:else}{s.t}{/if}{/each}</p>{/if}
      {#if phase === 'teach' || phase === 'fix'}
        <div class="buddy-go"><span class="who">{FRIEND[p.buddy].name}:</span> “{L.teach.says}”</div>
      {/if}
    {/if}
  </div>

  <!-- the counter: the stall's Glimmer, the coach's words and what you do, and your buddy -->
  <div class="counter">
    <img class="star" src="{base}{glimmerArt(L.star)}" alt={star.name} />
    <div class="talk">
      <p class="line">{line}</p>
      {#if feedback}<p class="fb" class:ok={feedback.ok}>{feedback.text}</p>{/if}
      <div class="acts">
        {#if phase === 'fix'}
          {#if fixedOk}<button class="btn btn-primary" onclick={next}>My turn <span class="kbd">enter</span></button>
          {:else}{#each fixOrder as x (x)}<button class="btn pick" onclick={() => fix(x)}>{show(x, L.teach.q)}</button>{/each}{/if}
        {:else if phase === 'try'}
          {@const qq = L.tries[tryN]}
          {#if qq.input === 'choice'}
            {#each ['a', 'same', 'b'] as x (x)}<button class="btn pick" disabled={feedback?.ok} onclick={() => answer(x)}>{show(x, qq)}</button>{/each}
          {:else}
            <div class="typed" class:empty={!typed}>{typed || '?'}{#if qq.input === 'num'}<small>¢</small>{/if}</div>
            <div class="pad">
              {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9', qq.input === 'decimal' ? '.' : '', '0', '⌫'] as k, j (j)}
                {#if k}<button class="key" onclick={() => pad(k)}>{k}</button>{:else}<span></span>{/if}
              {/each}
            </div>
            <button class="btn btn-primary" disabled={!typed || feedback?.ok} onclick={() => answer(typed)}>Check <span class="kbd">enter</span></button>
          {/if}
        {:else if phase === 'card'}
          <button class="btn btn-primary" onclick={() => { sfx.click(); onclose(); }}>Done</button>
        {:else}
          <button class="btn btn-primary" onclick={next}>{phase === 'teach' ? 'Is it right?' : 'Next'} <span class="kbd">enter</span></button>
        {/if}
      </div>
    </div>
    <div class="bud"><Critter friend={p.buddy} accessory={outfitOf(p)} size={wide ? 120 : 76} mood={phase === 'card' ? 'dance' : phase === 'teach' ? 'joy' : 'idle'} /></div>
  </div>
</div>

<style>
  .ep { position: fixed; inset: 0; z-index: 60; display: flex; flex-direction: column; background-color: #f6dfb0; background-size: cover; background-position: center 30%; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  header { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
  .name { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .name img { width: 36px; height: 36px; }
  .name b { font: 600 22px var(--font-ui); color: #b7791f; }
  .name small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .dots { display: flex; gap: 5px; margin: 0 auto; background: rgba(255, 255, 255, .85); border-radius: 999px; padding: 6px 10px; }
  .dots i { width: 11px; height: 11px; border-radius: 50%; background: #e6dcc6; }
  .dots i.done { background: #e6a817; } .dots i.now { box-shadow: 0 0 0 3px #e6a817; background: #fff; }
  .x { width: 44px; height: 44px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }

  .board { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 0 16px; }
  .qtext { margin: 0; font: 600 24px var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .94); border-radius: 18px; padding: 6px 18px; box-shadow: var(--shadow-sm); text-align: center; }
  .pic { background: rgba(255, 253, 246, .9); border-radius: 26px; padding: 14px 18px; box-shadow: 0 12px 30px -16px rgba(90, 50, 10, .5); animation: pop .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes pop { from { transform: scale(.92); opacity: 0; } }
  .hero { width: min(240px, 50vw); height: min(300px, 62vw); object-fit: cover; border-radius: 26px; box-shadow: 0 0 0 6px #fff, 0 16px 30px -12px rgba(90, 50, 10, .55); animation: pop .4s cubic-bezier(.3, .8, .4, 1.4); }
  .eq { margin: 0; font: 600 34px var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .94); border-radius: 18px; padding: 4px 20px; box-shadow: var(--shadow-sm); white-space: pre-wrap; text-align: center; }
  .eq mark { background: #ffe08a; color: #6b3d10; border-radius: 8px; padding: 0 6px; }
  .buddy-go { font: 600 19px/1.35 var(--font-body); color: var(--ink); background: #fff; border-radius: 18px; padding: 8px 16px; box-shadow: 0 0 0 3px #ffb47a, var(--shadow-sm); max-width: 560px; text-align: center; }
  .who { color: #c4571b; }

  .card-won { display: flex; flex-direction: column; align-items: center; gap: 10px; animation: pop .5s cubic-bezier(.3, .8, .4, 1.5); }
  .cframe { position: relative; width: 240px; height: 320px; border-radius: 22px; overflow: hidden; background: #fff; box-shadow: 0 0 0 6px #ffd36b, 0 0 40px rgba(255, 210, 107, .9), 0 16px 30px -10px rgba(90, 50, 10, .5); display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding-bottom: 14px; }
  .cart { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .cstar { position: relative; width: 150px; height: 150px; object-fit: contain; margin-bottom: 18px; filter: drop-shadow(0 8px 10px rgba(0, 0, 0, .3)); }
  .cframe b { position: relative; font: 600 24px var(--font-ui); color: #6b3d10; background: #fff3c9; border-radius: 12px; padding: 2px 12px; }
  .card-won p { margin: 0; font: 600 17px/1.35 var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .94); border-radius: 14px; padding: 6px 14px; max-width: 420px; text-align: center; }
  .shells { display: inline-flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); background: #fff8e6; border-radius: 999px; padding: 4px 14px 4px 6px; }
  .shells img { width: 26px; height: 26px; }

  .counter { flex: none; display: flex; align-items: flex-end; gap: 12px; padding: 0 16px 16px; }
  .star { width: 104px; height: 128px; object-fit: cover; border-radius: 18px; box-shadow: 0 0 0 4px #fff, 0 8px 16px -6px rgba(60, 30, 5, .45); }
  .talk { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; background: rgba(255, 255, 255, .96); border-radius: 22px; padding: 12px 16px; box-shadow: 0 10px 24px -12px rgba(60, 30, 5, .5); }
  .line { margin: 0; font: 600 19px/1.4 var(--font-body); color: var(--ink); }
  .fb { margin: 0; font: 700 16px/1.35 var(--font-body); color: #b54a1a; background: #fff3e6; border-radius: 12px; padding: 6px 12px; }
  .fb.ok { color: #0f6a48; background: #e2f7ee; }
  .acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; justify-content: flex-end; }
  .pick { font-size: 22px; min-width: 96px; }
  .typed { min-width: 110px; font: 600 32px var(--font-ui); color: var(--ink); background: #fff8ea; border-radius: 14px; padding: 2px 14px; text-align: center; box-shadow: inset 0 0 0 2px #f0dcb4; }
  .typed.empty { color: #c9b48c; }
  .typed small { font-size: 22px; margin-left: 2px; }
  .pad { display: grid; grid-template-columns: repeat(6, 44px); gap: 6px; }
  .key { height: 44px; border: 0; border-radius: 12px; background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 3px 0 #d9cff0; font: 600 22px var(--font-ui); color: var(--ink); cursor: pointer; touch-action: manipulation; }
  .key:active { transform: translateY(2px); box-shadow: 0 1px 0 #d9cff0; }
  .bud { flex: none; }

  @media (max-width: 760px) {
    header { padding: 8px; gap: 6px; }
    .name small, .name b { display: none; } .name { padding: 3px; }
    .x { width: 38px; height: 38px; }
    .qtext { font-size: 18px; }
    .eq { font-size: 24px; padding: 4px 12px; }
    .buddy-go { font-size: 15px; }
    .counter { padding: 0 8px 10px; gap: 6px; }
    .star { position: absolute; left: 10px; bottom: calc(100% + 4px); width: 58px; height: 70px; border-radius: 12px; box-shadow: 0 0 0 3px #fff; }
    .counter { position: relative; }
    .bud { position: absolute; right: 4px; bottom: calc(100% - 6px); }
    .talk { padding: 10px 12px; }
    .line { font-size: 15px; }
    .pad { grid-template-columns: repeat(6, 1fr); width: 100%; }
    .acts { justify-content: center; }
    .acts .kbd { display: none; }
    .pick { font-size: 18px; min-width: 0; flex: 1; }
    .cframe { width: 190px; height: 250px; } .cstar { width: 120px; height: 120px; }
  }
</style>
