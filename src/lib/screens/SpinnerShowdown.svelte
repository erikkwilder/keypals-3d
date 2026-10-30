<script lang="ts">
  // Spinner Showdown: the Data and chance arcade game, at Popcorn Puffling's booth at the Chance Fair. The
  // big wheel spins to pick the kind of question (Count, Graphs, Likely?, Plots, Middle, Chance: the kinds
  // this player has met), then the question comes up on the card: graphs to read, bars to drag, chances to
  // write. Right ones win golden tickets that burst out of the wheel (more for harder ones, a combo for right
  // ones in a row, a bonus for quick ones). Every fourth is a Best Bet: pick the colour the wheel lands on
  // most, win tickets for the smart pick, then watch it really spin; the spins build a bar graph. Two
  // minutes, three stars, a best score and today's challenge. The rules are in math/data/showdown.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx, startMusic, musicEnergy, setPlaceStation } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShowdownScene } from '../three/showdownScene';
  import type { Profile } from '../engine/profile';
  import { SKILL } from '../math/skills/registry';
  import type { Answer } from '../math/skills/types';
  import { answerParts } from '../math/skills/text';
  import { BET_TICKETS, KINDS, ROUND_MS, STAR_AT, applyShowdown, challengeMaker, comboMult, dailyBestOf, dailySeed, poolFor, showdownOf, spinLand, starsFor, thetasFor, ticketsFor, type Challenge, type KindId, type ShowOutcome } from '../math/data/showdown';
  import { COLOR, type ColorId, type DataPic } from '../math/data/pics';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';
  import SkillInput from '../math/skills/ui/SkillInput.svelte';
  import DataPicView from '../math/data/ui/DataPic.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import { FRIEND } from '../art/cast';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  type Fill = { kind: 'number'; text: string; bad?: boolean } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null; bad?: boolean };

  let phase = $state<'menu' | 'play' | 'done'>('menu');
  /** where a challenge is: the wheel picking, the question, its answer explained, a bet, a bet's spin */
  let step = $state<'spin' | 'ask' | 'explain' | 'bet' | 'betspin' | 'won'>('spin');
  let daily = $state(false);
  let ch = $state<Challenge | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), right = $state(0), missed = 0, bets = 0;
  let left = $state(ROUND_MS);
  let fill = $state<Fill | null>(null);
  let marked = $state<{ id: string; ok: boolean } | null>(null);
  let tries = 0;
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number } | null>(null);
  let picked = $state<ColorId | null>(null);
  let landed = $state<ColorId | null>(null);
  /** the round's Best Bet spins, colour by colour (a bar graph of them) */
  let tally = $state<Partial<Record<ColorId, number>>>({});
  let outcome = $state<ShowOutcome | null>(null);
  let burst = $state(0);
  let w = $state(1280), h = $state(800);
  const narrow = $derived(w < 760 || h > w * 1.05);
  let canvas: HTMLCanvasElement | undefined = $state();
  let ticketEl: HTMLElement | undefined = $state();
  let scene: ShowdownScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let next = challengeMaker(1, {}, {});
  let pool: ReturnType<typeof poolFor> = {};
  let shownAt = 0, t0 = 0, last = 0, raf = 0;
  let paused = $state(0);
  /** each challenge bumps this; anything still waiting from an older one stops ($state wraps `ch`, so
   *  it can't be compared with the challenge itself) */
  let run = 0;
  let disposed = false;

  // (for checking: the challenge on the card)
  $effect(() => { if (import.meta.env.DEV) (window as unknown as { __showCh: unknown }).__showCh = ch ? { ...$state.snapshot(ch), step } : null; });
  const rec = $derived(showdownOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const item = $derived(ch?.kind === 'q' ? ch.item : null);

  onMount(() => {
    stage.use(null);
    setPlaceStation('world');
    if (canvas) ShowdownScene.create(canvas).then(s => {
      if (disposed) { s.dispose(); return; }
      scene = s; s.onTick = () => sfx.click();
      if (import.meta.env.DEV) (window as unknown as { __show: ShowdownScene }).__show = s;
      s.setParts(['red', 'blue', 'yellow', 'green', 'purple', 'orange'], ['Count', 'Graphs', 'Likely?', 'Plots', 'Middle', 'Chance']);
      raf = requestAnimationFrame(tick);
    });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); setPlaceStation(null); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }

  // ---------- a round ----------
  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    pool = poolFor(p);
    next = challengeMaker(seed, pool, thetasFor(p));
    score = 0; combo = 0; bestCombo = 0; right = 0; missed = 0; bets = 0; answers = [];
    tally = {}; left = ROUND_MS; outcome = null; msg = null; paused = 0;
    phase = 'play';
    startMusic('adventure');
    t0 = performance.now(); last = t0;
    say('The wheel picks a question. Get it right for tickets!');
    void nextChallenge();
  }

  /** the wheel's parts while it picks a kind: the kinds this player can be asked (at least four parts) */
  function kindWheel(): KindId[] {
    const ks = Object.keys(pool) as KindId[];
    const out: KindId[] = [];
    while (out.length < Math.max(4, ks.length)) out.push(ks[out.length % ks.length]);
    return out;
  }

  async function nextChallenge() {
    if (phase !== 'play') return;
    const c = next(), r = ++run;
    ch = c; tries = 0; marked = null; fill = null; picked = null; landed = null;
    if (c.kind === 'bet') {
      scene?.setParts(c.parts);
      step = 'bet';
      say('Best Bet! Which colour will it land on most?', 'tip');
      sfx.pop();
      return;
    }
    const ks = kindWheel();
    scene?.setParts(ks.map(k => KINDS[k].color), ks.map(k => KINDS[k].name));
    step = 'spin';
    sfx.whoosh();
    const spots = ks.map((k, i) => (k === c.on ? i : -1)).filter(i => i >= 0);
    await scene?.spinTo(spots[Math.floor(Math.random() * spots.length)] ?? 0, 1.4);
    if (phase !== 'play' || r !== run) return;
    sfx.ding(2); scene?.hop();
    step = 'ask';
    shownAt = performance.now();
  }

  /** an answer to the question on the card: false when wrong (the input shows it in red) */
  function onAnswer(a: Answer): boolean {
    if (phase !== 'play' || step !== 'ask' || ch?.kind !== 'q') return false;
    const c = ch, r = run, s = SKILL[c.item.skill], ok = s.check(c.item, a), ms = performance.now() - shownAt;
    if (!tries) answers.push({ key: c.key, ok, thinkMs: ms, rung: c.item.rung });
    if (a.kind === 'choice') marked = { id: a.id, ok };
    if (ok) {
      const quick = !tries && ms <= s.fastMs;
      const t = tries ? Math.round(c.points / 3) : ticketsFor(c.points, combo, quick);
      win(t, tries ? 'Got it!' : quick ? 'Quick and right!' : pickPraise());
      if (!tries) { combo++; bestCombo = Math.max(bestCombo, combo); }
      right++;
      step = 'won';
      setTimeout(() => { if (r === run) void nextChallenge(); }, 1100);
      return true;
    }
    tries++; combo = 0; missed++;
    sfx.nope(); scene?.sad();
    if (tries >= 2 || c.item.input === 'choice' || c.item.input === 'custom') {
      // show how, then go on: the clock waits while the card explains
      step = 'explain'; paused = performance.now();
    } else say(`Not quite. ${c.item.trick?.say ?? 'Try again!'}`, 'oops');
    return false;
  }
  const PRAISE = ['Right!', 'You got it!', 'Brilliant!', 'Spot on!', 'Yes!'];
  const pickPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
  function win(t: number, text: string) {
    const before = score;
    score += t;
    pop = { text: `+${t}`, key: Date.now() };
    say(`${text} +${t} tickets`, 'good');
    sfx.cheer(); if (combo >= 2) sfx.perfect();
    musicEnergy(Math.min(1, 0.4 + combo * 0.08));
    scene?.cheer();
    const r = ticketEl?.getBoundingClientRect(), cr = canvas?.getBoundingClientRect();
    if (r && cr) scene?.tickets_(Math.max(3, Math.round(t / 25)), { x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top });
    setTimeout(() => sfx.coin(25), 700);
    if (starsFor(score) > starsFor(before)) { burst++; sfx.star(starsFor(score) - 1); }
  }
  function goOn() {
    if (step !== 'explain') return;
    sfx.click();
    if (paused) { t0 += performance.now() - paused; paused = 0; }
    void nextChallenge();
  }

  // ---------- a Best Bet ----------
  const betColors = $derived(ch?.kind === 'bet' ? [...new Set(ch.parts)] : []);
  const partsOf = (c: ColorId) => (ch?.kind === 'bet' ? ch.parts.filter(x => x === c).length : 0);
  async function pickBet(c: ColorId) {
    if (phase !== 'play' || step !== 'bet' || ch?.kind !== 'bet') return;
    const b = ch, r = run;
    picked = c; bets++;
    const smart = b.best.includes(c);
    if (smart) { win(Math.round(BET_TICKETS * comboMult(combo)), 'Smart bet!'); combo++; bestCombo = Math.max(bestCombo, combo); }
    else { combo = 0; sfx.nope(); say(`${cap(b.best[0])} has the most parts: ${partsOf(b.best[0])} of ${b.parts.length}. That's the best bet.`, 'oops'); }
    step = 'betspin';
    await new Promise(r => setTimeout(r, smart ? 500 : 1300));
    if (r !== run || phase !== 'play') return;
    sfx.whoosh();
    const i = spinLand(b.parts, Math.random());
    await scene?.spinTo(i, 2.3);
    if (r !== run || phase !== 'play') return;
    landed = b.parts[i];
    tally = { ...tally, [landed]: (tally[landed] ?? 0) + 1 };
    sfx.ding(4);
    if (landed === c) { scene?.cheer(); say(`It landed on ${landed}! Just like you picked.`, 'good'); }
    else say(`It landed on ${landed}. ${smart ? 'Still the smart bet: it lands on yours most of the time.' : 'Chances, not sure things!'}`, 'tip');
    setTimeout(() => { if (r === run) void nextChallenge(); }, 1700);
  }
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  const tallyPic = $derived.by((): DataPic | null => {
    const cs = (Object.keys(tally) as ColorId[]).filter(c => (tally[c] ?? 0) > 0);
    if (!cs.length) return null;
    const max = Math.max(...cs.map(c => tally[c]!));
    return { kind: 'bars', cats: cs.map(c => ({ name: cap(c), n: tally[c]!, color: c })), step: 1, max: Math.max(4, max), title: 'Where it landed' };
  });

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (phase !== 'play') return;
    last = now;
    if (!paused) left = Math.max(0, ROUND_MS - (now - t0));
    if (left <= 0) finish();
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; ch = null; step = 'spin'; run++;
    sfx.complete();
    const out = applyShowdown($state.snapshot(game.profile!) as Profile, { score, right, missed, bets, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    scene?.party();
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
  }

  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; ch = null; msg = null; run++; return; }
    game.mathArea = 'data'; game.mathOp = null; game.setHome('math'); game.go('map');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); quit(); return; }
    if (phase === 'play' && step === 'explain' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); goOn(); return; }
    if (phase === 'play' && step === 'bet' && /^[1-4]$/.test(e.key)) { const c = betColors[Number(e.key) - 1]; if (c) { e.preventDefault(); void pickBet(c); } return; }
    if (phase !== 'play' && e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  const kindOn = $derived(ch?.kind === 'q' ? KINDS[ch.on] : null);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen show" class:narrow bind:clientWidth={w} bind:clientHeight={h} style:background-image="url({base}arcade/bg-fair.webp)">
  <canvas class="three" bind:this={canvas}></canvas>

  <div class="top">
    <button class="back" onclick={quit} aria-label={phase === 'play' ? 'Stop the round' : 'Back to Data and chance'}><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/data/tile.webp" alt="" /><b>Spinner Showdown</b>{#if daily}<small>Today's challenge</small>{/if}</div>
    {#if phase === 'play'}
      <div class="tix" bind:this={ticketEl}><img src="{base}math/data/prize-ticket.webp" alt="" /><b>{score}</b></div>
      <div class="meter" title="Stars at {STAR_AT.join(', ')} tickets">
        <i style:width="{meter * 100}%"></i>
        {#each STAR_AT as s}<img class:on={score >= s} style:left="{(s / STAR_AT[2]) * 100}%" src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
      {#if combo > 1}{#key combo}<div class="combo">Combo ×{comboMult(combo)}</div>{/key}{/if}
      <div class="clock" class:low={secs <= 15} class:held={!!paused} style:--k={left / ROUND_MS}><span>{secs}</span></div>
    {/if}
  </div>

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop">{pop.text}</div>{/key}{/if}

  {#if phase === 'play' && ch}
    <section class="card qcard" class:spin={step === 'spin'}>
      {#if ch.kind === 'bet'}
        <div class="kind" style:--kc={COLOR.yellow.hex}><img src="{base}math/data/prize-ticket.webp" alt="" />Best Bet</div>
        <h2>Which colour will the wheel land on most?</h2>
        <p class="hint">Pick the smart bet: the colour with the most parts. Tickets for the smart pick, wherever it lands.</p>
        <div class="bets">
          {#each betColors as c, i (c)}
            <button class="bet" class:picked={picked === c} class:best={step === 'betspin' && ch.best.includes(c)} class:landed={landed === c} style:--bc={COLOR[c].hex} style:--bd={COLOR[c].deep} disabled={step !== 'bet'} onclick={() => pickBet(c)}>
              <span class="sw"></span><b>{cap(c)}</b><small>{partsOf(c)} of {ch.parts.length} parts</small>{#if !narrow}<span class="kbd">{i + 1}</span>{/if}
            </button>
          {/each}
        </div>
        {#if tallyPic}<div class="tally"><DataPicView d={tallyPic} size={narrow ? 92 : 120} /></div>{/if}
      {:else if item}
        <div class="kind" style:--kc={COLOR[kindOn?.color ?? 'blue'].hex}>{kindOn?.name}</div>
        {#if step === 'spin'}
          <h2 class="spinning">Spinning…</h2>
        {:else}
          <h2>{item.ask}</h2>
          {#key item.id}
            <div class="prompt"><SkillPrompt parts={item.prompt} {fill} size={narrow ? 30 : 44} picSize={narrow ? 112 : 215} done={step === 'won' || step === 'explain'} /></div>
            {#if step === 'explain'}
              <div class="explain">
                <div class="ans"><small>The answer</small><SkillPrompt parts={answerParts(item)} size={narrow ? 26 : 32} picSize={narrow ? 70 : 90} done /></div>
                <p>{item.explain}</p>
                {#if item.trick}<p class="trick"><b>{item.trick.name}:</b> {item.trick.say}</p>{/if}
                <button class="btn btn-primary big" onclick={goOn}>Next <span class="kbd">enter</span></button>
              </div>
            {:else}
              <div class="input"><SkillInput {item} compact={narrow} {marked} bind:fill onanswer={onAnswer} disabled={step !== 'ask'} /></div>
            {/if}
          {/key}
        {/if}
      {/if}
    </section>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}arcade/cab-spinner.webp" alt="" />
        <h1>Spinner Showdown</h1>
        <p class="lead">Popcorn Puffling's booth at the Chance Fair! The wheel picks a question: graphs, counting, chances. Get them right to win golden tickets. Two minutes, as many as you can.</p>
        <ol class="how">
          <li><span><img src="{base}math/data/tile.webp" alt="" /></span>The wheel spins and picks what kind of question comes next.</li>
          <li><span><img src="{base}math/data/prize-ticket.webp" alt="" /></span>Right answers win tickets. Harder ones win more.</li>
          <li><span><Icon name="target" size={26} /></span>Best Bet: pick the colour with the most parts. The smart pick wins tickets, wherever it lands.</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Quick ones win extra.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same wheel all day</span></div>
        </div>
        <div class="acts">
          <button class="btn" onclick={quit}>Back</button>
          <button class="btn" onclick={() => start(true)}><Icon name="target" size={20} /> Today's challenge</button>
          <button class="btn btn-primary big" onclick={() => start(false)}>Play <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}

  {#if phase === 'done' && outcome}
    {@const o = outcome}
    <div class="sheetbg">
      <div class="card done">
        <h1>{o.stars === 3 ? 'Fair Champion!' : o.stars === 2 ? 'Great spinning!' : o.stars === 1 ? 'Booth closed!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score"><img src="{base}math/data/prize-ticket.webp" alt="" />{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{right}</b><small>right answers</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        {#if tallyPic}<div class="tally end"><small>Your Best Bet spins</small><DataPicView d={tallyPic} size={narrow ? 90 : 110} /></div>{/if}
        <div class="xp">
          <span>{FRIEND[p.buddy].name} <Icon name="heart" size={16} /> +{o.xp.gained} XP</span>
          {#if o.shells}<span><img src="{base}game/icon-shell.webp" alt="" /> +{o.shells} shells</span>{/if}
          {#each o.stickers as s}<span><Icon name="sticker" size={16} /> {s.name}</span>{/each}
        </div>
        <div class="acts">
          <button class="btn" onclick={quit}>Back to Data and chance</button>
          {#if !daily}<button class="btn" onclick={() => start(true)}>Today's challenge</button>{/if}
          <button class="btn btn-primary big" onclick={() => start(daily)}>Play again <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .show { background-size: cover; background-position: center 45%; background-color: #f7c9a8; user-select: none; -webkit-user-select: none; overflow: hidden; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #d6336c; }
  .title small { font: 800 11px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .05em; }
  .tix { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 18px; padding: 4px 14px 4px 6px; box-shadow: var(--shadow-sm), 0 0 0 3px #ffd36b; min-width: 110px; }
  .tix img { width: 52px; height: 30px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(120, 70, 0, .3)); }
  .tix b { font: 600 28px/1 var(--font-ui); color: #b7791f; }
  .meter { position: relative; flex: 1; max-width: 260px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ff9ad5, #e2468f); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#ff7ab8, #d6336c); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(160, 30, 90, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  .clock.held { opacity: .7; animation: none; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .msg { position: absolute; left: 25%; top: 84px; transform: translateX(-50%); z-index: 6; font: 600 19px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(46vw, 560px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
  .pop { position: absolute; left: 25%; top: 42%; transform: translate(-50%, -50%); z-index: 6; font: 600 46px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #b7791f, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  /* the question card: the right half on a wide screen, the bottom on a phone */
  .qcard { position: absolute; z-index: 4; right: 18px; top: 84px; bottom: 18px; width: min(600px, 50vw); display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 16px 18px; overflow: auto; background: rgba(255, 252, 245, .96); border-radius: 28px; box-shadow: 0 0 0 4px #fff, 0 0 0 8px #ffb3d1, 0 18px 40px rgba(120, 40, 60, .3); animation: cardin .35s cubic-bezier(.3, .8, .4, 1.3); }
  @keyframes cardin { from { transform: translateY(20px) scale(.96); opacity: 0; } }
  .qcard.spin { justify-content: center; }
  .kind { display: inline-flex; align-items: center; gap: 6px; font: 600 16px var(--font-ui); color: #fff; background: var(--kc); padding: 4px 16px; border-radius: 999px; box-shadow: 0 3px 0 rgba(0, 0, 0, .15), 0 0 0 3px #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, .3); }
  .kind img { width: 34px; height: 20px; object-fit: contain; }
  .qcard h2 { margin: 0; font: 600 22px/1.25 var(--font-ui); color: var(--ink); text-align: center; }
  .spinning { font-size: 34px !important; color: #d6336c !important; animation: wob .5s ease-in-out infinite alternate; }
  @keyframes wob { to { transform: rotate(-3deg) scale(1.05); } }
  .prompt { flex: 1; display: flex; justify-content: center; align-items: center; width: 100%; min-height: 0; }
  .input { width: 100%; }
  .hint { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); text-align: center; }
  .explain { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; background: #fff4e6; border-radius: 20px; padding: 12px 16px; box-shadow: 0 0 0 3px #ffd0a0; }
  .explain .ans { display: flex; align-items: center; gap: 10px; }
  .explain small { font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: #b54a1a; }
  .explain p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink); text-align: center; }
  .explain .trick { color: #2f6b4a; }
  .bets { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; width: 100%; }
  .bet { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; border: 3px solid #fff; border-radius: 22px; padding: 12px 8px; background: linear-gradient(#fff, #fff5ee); box-shadow: 0 5px 0 #f0d6c8, var(--shadow-sm); cursor: pointer; transition: transform .1s; }
  .bet:hover:not(:disabled) { transform: translateY(-3px); }
  .bet .sw { width: 54px; height: 54px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff 0 12%, var(--bc) 40%, var(--bd)); box-shadow: 0 4px 8px rgba(0, 0, 0, .25); }
  .bet b { font: 600 22px var(--font-ui); color: var(--bd); }
  .bet small { font: 700 13px var(--font-body); color: var(--muted); }
  .bet .kbd { position: absolute; top: 6px; right: 8px; }
  .bet.picked { border-color: var(--bc); box-shadow: 0 0 0 4px var(--bc), 0 8px 18px rgba(0, 0, 0, .2); }
  .bet.best { background: linear-gradient(#f2fff7, #d6f7e4); }
  .bet.landed { animation: land .6s ease; }
  @keyframes land { 30% { transform: scale(1.12) rotate(-3deg); } 60% { transform: scale(1.05) rotate(2deg); } }
  .bet:disabled { cursor: default; }
  .tally { margin-top: auto; display: flex; flex-direction: column; align-items: center; }
  .tally small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(80, 20, 50, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(580px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 170px; height: 190px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(120, 40, 60, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #d6336c; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #fff2f7; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #ffd0e2; }
  .how img { width: 40px; height: 40px; object-fit: contain; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff2f7; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { display: flex; align-items: center; gap: 10px; font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .big-score img { width: 90px; height: 54px; object-fit: contain; }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #ff7ab8, #e6a817); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #fff2f7; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }
  .xp { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .xp span { display: inline-flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 5px 12px; font: 700 14px var(--font-body); color: var(--ink2); }
  .xp img { width: 20px; height: 20px; }

  /* a phone (or anything tall): the wheel up top, the card underneath */
  .narrow .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
  .narrow .title { padding: 3px; } .narrow .title b, .narrow .title small { display: none; } .narrow .title img { width: 32px; height: 32px; }
  .narrow .back { width: 38px; height: 38px; }
  .narrow .tix { min-width: 0; padding: 2px 10px 2px 4px; } .narrow .tix img { width: 40px; height: 24px; } .narrow .tix b { font-size: 22px; }
  .narrow .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
  .narrow .clock { width: 50px; height: 50px; } .narrow .clock span { width: 38px; height: 38px; font-size: 18px; }
  .narrow .combo { font-size: 15px; padding: 3px 10px; }
  .narrow .msg { left: 50%; top: 104px; font-size: 15px; max-width: 92vw; }
  .narrow .pop { left: 50%; top: 26%; }
  .narrow .qcard { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: 62%; padding: 10px 10px 12px; border-radius: 22px; gap: 6px; }
  .narrow .qcard.spin { max-height: 20%; }
  .narrow .qcard h2 { font-size: 17px; }
  .narrow .bets { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .narrow .bet { padding: 8px 4px; border-radius: 16px; } .narrow .bet .sw { width: 40px; height: 40px; } .narrow .bet b { font-size: 17px; } .narrow .bet small { font-size: 11px; }
  .narrow .hero { width: 120px; height: 140px; }
  .narrow .start h1, .narrow .done h1 { font-size: 30px; }
  .narrow .lead { font-size: 15px; }
  .narrow .how li { font-size: 14px; }
</style>
