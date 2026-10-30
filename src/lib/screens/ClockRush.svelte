<script lang="ts">
  // Clock Rush: the measuring arcade game in the great clockwork hall (rules and scoring in
  // math/measure/rush.ts). Clocks ride in on spinning brass gears: read a big clock and tap its time,
  // catch the clock that shows the ticket's time as three roll along the gear belt, drag a clock's hands
  // to the ticket's time, or work out when the toy train gets in. A ring round each one runs down as it
  // ticks; answer before it rings. Right ones in a row build a combo, quick ones a bonus; 100 seconds,
  // three stars, a best score and today's challenge.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import type { Profile } from '../engine/profile';
  import { FRIEND } from '../art/cast';
  import type { Answer } from '../math/skills/types';
  import { ROUND_MS, STAR_AT, applyRush, comboMult, dailyBestOf, dailySeed, levelsFor, orderMaker, orderScore, rightAnswer, rushOf, skillsFor, starsFor, type Order, type RushOutcome } from '../math/measure/rush';
  import { timeText } from '../math/skills/measure';
  import { mSfx } from '../math/measure/sounds';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';
  import SkillInput from '../math/skills/ui/SkillInput.svelte';
  import MeasurePic from '../math/skills/ui/MeasurePic.svelte';
  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let order = $state<Order | null>(null);
  let n = $state(0);
  let waited = $state(0);
  let tries = 0;
  let wrongIds = $state<string[]>([]);
  let leaving = $state<'right' | 'miss' | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), doneN = $state(0), missed = 0;
  let left = $state(ROUND_MS);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number } | null>(null);
  let outcome = $state<RushOutcome | null>(null);
  let burst = $state(0);
  let shake = $state(0);
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let next = orderMaker(1, ['ms-hour']);
  let t0 = 0, last = 0, raf = 0, orderAt = 0;
  let disposed = false;
  let w = $state(1280);
  const compact = $derived(w < 760);

  const rec = $derived(rushOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const patience = $derived(order ? Math.max(0, 1 - waited / order.patienceMs) : 0);
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  const mood = $derived<'' | 'joy' | 'dance' | 'idle'>(leaving === 'miss' ? '' : combo >= 3 ? 'dance' : leaving === 'right' ? 'joy' : 'idle');

  onMount(() => { stage.use(null); addEventListener('resize', onResize); onResize(); });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); musicEnergy(0.5); });
  function onResize() { w = innerWidth; }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }
  function start(isDaily: boolean) {
    sfx.whoosh(); mSfx.gears();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    next = orderMaker(seed, skillsFor(p), levelsFor(p));
    score = 0; combo = 0; bestCombo = 0; doneN = 0; missed = 0; answers = []; n = 0;
    left = ROUND_MS; outcome = null; msg = null; order = null; leaving = null;
    phase = 'play';
    startMusic('ridge');
    t0 = performance.now(); last = t0;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    setTimeout(newOrder, 400);
    say('Clocks are coming! Answer before they ring.');
  }
  function newOrder() {
    if (phase !== 'play') return;
    order = next(); n++; waited = 0; tries = 0; wrongIds = []; leaving = null;
    orderAt = performance.now();
    mSfx.gears();
    if (order.kind === 'catch' && n <= 4) say(`Tap the clock that says ${timeText(order.target![0], order.target![1])}!`);
    else if (order.kind === 'set' && n <= 6) say('Drag the hands, then tap Done!');
    else if (order.kind === 'train') say('All aboard! When does the train get in?');
  }
  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (phase !== 'play') return;
    const dt = now - last; last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (order && !leaving) {
      waited += dt;
      if (waited >= order.patienceMs) {
        // it ticked past: it rings and rolls away (only the combo is lost)
        mSfx.ring(); combo = 0; missed++; musicEnergy(0.45);
        if (!tries) answers.push({ key: order.item.key, ok: false, thinkMs: order.patienceMs, rung: order.rung });
        say(`Too late! ${order.item.explain}`, 'oops');
        leaving = 'miss';
        setTimeout(newOrder, 1400);
      }
    }
    if (left <= 0) finish();
  }

  function submit(a: Answer, id?: string): boolean {
    if (phase !== 'play' || !order || leaving) return false;
    const o = order, ms = performance.now() - orderAt, ok = rightAnswer(o, a);
    if (!tries) answers.push({ key: o.item.key, ok, thinkMs: ms, rung: o.rung });
    tries++;
    if (ok) {
      const pts = orderScore(o, combo, ms);
      score += pts; combo++; bestCombo = Math.max(bestCombo, combo); doneN++;
      musicEnergy(Math.min(1, 0.45 + combo * 0.08));
      pop = { text: `+${pts}`, key: Date.now() };
      mSfx.chime(); sfx.star(Math.min(2, combo - 1));
      if (combo >= 3) sfx.perfect();
      if (starsFor(score) > starsFor(score - pts)) burst++;
      say(combo >= 3 ? `${combo} in a row! Combo ×${comboMult(combo)}` : pick(['Right on time!', 'Tick-tock, you got it!', 'Spot on!', 'Brilliant!']), 'good');
      leaving = 'right';
      setTimeout(newOrder, 900);
      return true;
    }
    combo = 0; shake++; sfx.miss();
    if (id) wrongIds = [...wrongIds, id];
    say(tries > 1 ? (o.item.explain) : o.item.trick?.say ?? 'Look again!', 'oops');
    return false;
  }
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; order = null;
    sfx.complete(); mSfx.cuckoo();
    const out = applyRush($state.snapshot(game.profile!) as Profile, { score, done: doneN, missed, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
  }
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; order = null; msg = null; return; }
    game.mathArea = 'measure'; game.mathOp = null; game.setHome('math'); game.go('map');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); quit(); return; }
    if (phase === 'play' && order && (order.kind === 'read' || order.kind === 'train' || order.kind === 'catch') && /^[1-4]$/.test(e.key)) {
      const ids = order.kind === 'catch' ? order.clocks!.map(c => c.id) : order.item.choices!.map(c => c.id);
      const id = ids[Number(e.key) - 1]; if (id && !wrongIds.includes(id)) submit({ kind: 'choice', id }, id);
    } else if (phase !== 'play' && e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  /** the clocks on the belt roll from the right, sit a moment, and roll off to the left as time runs out */
  const beltX = $derived(order?.kind === 'catch' ? (leaving ? -40 : 30 - patience * 30) : 0);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen rush" class:compact style:background-image="url({base}math/measure/bg-clock.webp)">
  <!-- big brass gears turning at the sides of the hall -->
  <img class="gearbg g1" src="{base}math/measure/gear.webp" alt="" />
  <img class="gearbg g2" src="{base}math/measure/gear.webp" alt="" />
  <img class="gearbg g3" src="{base}math/measure/gear.webp" alt="" />

  <div class="top">
    <button class="back" onclick={quit} aria-label={phase === 'play' ? 'Stop the round' : 'Back to Measurement and time'}><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/measure/tile.webp" alt="" /><b>Clock Rush</b>{#if daily}<small>Today's challenge</small>{/if}</div>
    {#if phase === 'play'}
      <div class="score"><small>Score</small><b>{score}</b></div>
      <div class="meter" title="Stars at {STAR_AT.join(', ')}">
        <i style:width="{meter * 100}%"></i>
        {#each STAR_AT as s}<img class:on={score >= s} style:left="{(s / STAR_AT[2]) * 100}%" src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
      {#if combo > 1}{#key combo}<div class="combo">Combo ×{comboMult(combo)}</div>{/key}{/if}
      <div class="clock" class:low={secs <= 15} style:--k={left / ROUND_MS}><span>{secs}</span></div>
    {/if}
  </div>

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop">{pop.text}</div>{/key}{/if}

  {#if phase === 'play' && order}
    {#key n}
      <div class="stagebox" class:right={leaving === 'right'} class:miss={leaving === 'miss'}>
        {#if order.kind === 'read'}
          <div class="ask">What time is it?</div>
          <div class="ride" style:--pat={patience}>
            <img class="gear spin" src="{base}math/measure/gear.webp" alt="" />
            <span class="ring"></span>
            {#key shake}<div class="bigclock" class:shake={shake > 0}><MeasurePic m={(order.item.prompt[0] as { t: 'meas'; m: import('../math/skills/measure').MeasPic }).m} size={compact ? 170 : 230} /></div>{/key}
          </div>
          <div class="btns">
            {#each order.item.choices! as c, i (c.id)}
              <button class="tbtn" class:wrong={wrongIds.includes(c.id)} disabled={wrongIds.includes(c.id)} onclick={() => submit({ kind: 'choice', id: c.id }, c.id)}><SkillPrompt parts={c.parts} size={compact ? 30 : 40} picSize={compact ? 70 : 92} />{#if !compact}<span class="kbd">{i + 1}</span>{/if}</button>
            {/each}
          </div>
        {:else if order.kind === 'catch'}
          <div class="ticket"><small>Catch the clock that says</small><MeasurePic m={{ kind: 'time', h: order.target![0], m: order.target![1] }} size={compact ? 100 : 130} /></div>
          <div class="belt" style:--x="{beltX}%">
            <div class="track"></div>
            {#each order.clocks! as c, i (c.id)}
              <button class="cart" class:wrong={wrongIds.includes(c.id)} class:hit={leaving === 'right' && c.id === (order.item.answer as { id: string }).id} disabled={wrongIds.includes(c.id)} style:--i={i} onclick={() => submit({ kind: 'choice', id: c.id }, c.id)} aria-label="Clock {i + 1}">
                <MeasurePic m={{ kind: 'clock', h: c.h, m: c.m, face: (order.item.prompt[0] as { t: 'meas'; m: { face: 'all' | 'quarters' | 'none' } }).m.face }} size={compact ? 92 : 150} />
                <img class="gear spin small" src="{base}math/measure/gear.webp" alt="" />
                {#if !compact}<span class="kbd">{i + 1}</span>{/if}
              </button>
            {/each}
          </div>
          <div class="fuse"><i style:width="{patience * 100}%"></i></div>
        {:else if order.kind === 'set'}
          <div class="ask">{order.item.ask}</div>
          <div class="ticket wide"><SkillPrompt parts={order.item.prompt} size={compact ? 30 : 40} picSize={compact ? 90 : 120} /></div>
          <div class="setbox" class:shake={shake > 0}>
            <SkillInput item={order.item} {compact} disabled={!!leaving} onanswer={(a) => submit(a)} />
          </div>
          <div class="fuse"><i style:width="{patience * 100}%"></i></div>
        {:else}
          <div class="trainrow">
            <img class="train" src="{base}math/measure/train.webp" alt="" />
            <div class="trip">
              <span class="tq">{order.item.ask}</span>
              <SkillPrompt parts={order.item.prompt} size={compact ? 28 : 36} picSize={compact ? 80 : 110} />
            </div>
          </div>
          <div class="btns">
            {#each order.item.choices! as c, i (c.id)}
              <button class="tbtn tix" class:wrong={wrongIds.includes(c.id)} disabled={wrongIds.includes(c.id)} onclick={() => submit({ kind: 'choice', id: c.id }, c.id)}><SkillPrompt parts={c.parts} size={compact ? 30 : 40} picSize={compact ? 70 : 92} />{#if !compact}<span class="kbd">{i + 1}</span>{/if}</button>
            {/each}
          </div>
          <div class="fuse"><i style:width="{patience * 100}%"></i></div>
        {/if}
      </div>
    {/key}
    <div class="host"><Critter friend={p.buddy} size={compact ? 74 : 170} {mood} /></div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}arcade/cab-clock.webp" alt="" />
        <h1>Clock Rush</h1>
        <p class="lead">The clockwork hall is ticking! Clocks ride in on spinning gears. Deal with each one before it rings.</p>
        <ol class="how">
          <li><span><MeasurePic m={{ kind: 'clock', h: 3, m: 30, face: 'all' }} size={36} /></span>A big clock lands: tap the time it shows.</li>
          <li><span><MeasurePic m={{ kind: 'time', h: 7, m: 20 }} size={40} /></span>Three clocks roll by: catch the one the ticket says.</li>
          <li><span><img src="{base}math/measure/train.webp" alt="" /></span>The train leaves and rides a while: when does it get in?</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Quick ones score more.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same clocks all day</span></div>
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
        <h1>{o.stars === 3 ? 'Master Clockmaker!' : o.stars === 2 ? 'Right on time!' : o.stars === 1 ? 'Tick-tock, well done!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{doneN}</b><small>clocks done</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <div class="xp">
          <span>{FRIEND[p.buddy].name} <Icon name="heart" size={16} /> +{o.xp.gained} XP</span>
          {#if o.shells}<span><img src="{base}game/icon-shell.webp" alt="" /> +{o.shells} shells</span>{/if}
          {#each o.stickers as s}<span><Icon name="sticker" size={16} /> {s.name}</span>{/each}
        </div>
        <div class="acts">
          <button class="btn" onclick={quit}>Back to Measuring</button>
          {#if !daily}<button class="btn" onclick={() => start(true)}>Today's challenge</button>{/if}
          <button class="btn btn-primary big" onclick={() => start(daily)}>Play again <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} colors={['#ffd36b', '#e9b54a', '#8a6bd6', '#79c4f2', '#4fcf9f', '#ff8fbf']} />
</div>

<style>
  .rush { background-size: cover; background-position: center 45%; background-color: #e9c48a; user-select: none; -webkit-user-select: none; overflow: hidden; }
  .gearbg { position: absolute; pointer-events: none; opacity: .9; filter: drop-shadow(0 10px 18px rgba(80, 40, 0, .35)); animation: turn 14s linear infinite; }
  .g1 { width: 300px; left: -110px; bottom: -90px; }
  .g2 { width: 180px; left: 140px; bottom: -70px; animation-direction: reverse; animation-duration: 9s; }
  .g3 { width: 260px; right: -90px; top: 110px; animation-duration: 18s; }
  @keyframes turn { to { transform: rotate(360deg); } }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #8a5a10; }
  .title small { font: 800 11px var(--font-body); color: #6b4fc4; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffe08a, #d9a441); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#a98cff, #6b4fc4); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(70, 40, 140, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#d9a441 calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .msg { position: absolute; left: 50%; top: 80px; transform: translateX(-50%); z-index: 6; font: 600 19px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 720px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#b9a2ff, #7c5cf5); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; border-radius: 22px; }
  @keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 7; font: 600 48px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #8a5a10, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  .stagebox { position: absolute; left: 0; right: 0; top: 130px; bottom: 20px; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; animation: arrive .55s cubic-bezier(.3, 1.3, .5, 1) both; }
  @keyframes arrive { from { transform: translateX(60%) rotate(4deg); opacity: 0; } }
  .stagebox.right { animation: gone .8s ease-in forwards; }
  @keyframes gone { 30% { transform: scale(1.06); } to { transform: translateY(-40%) scale(.6); opacity: 0; } }
  .stagebox.miss { animation: away 1.2s ease-in forwards; }
  @keyframes away { 20% { transform: rotate(-3deg); } to { transform: translateX(-80%) rotate(-8deg); opacity: 0; } }
  .ask { font: 600 28px var(--font-ui); color: #fff; text-shadow: 0 2px 0 rgba(90, 50, 0, .6), 0 4px 16px rgba(60, 30, 0, .5); }
  .ride { position: relative; display: grid; place-items: center; }
  .ride .gear { position: absolute; width: 130%; max-width: 360px; z-index: -1; top: 52%; opacity: .95; }
  .spin { animation: turn 6s linear infinite; }
  .ring { position: absolute; inset: -14px; border-radius: 50%; background: conic-gradient(#ffd36b calc(var(--pat) * 360deg), rgba(255, 255, 255, .25) 0); -webkit-mask: radial-gradient(circle, transparent 64%, #000 65%); mask: radial-gradient(circle, transparent 64%, #000 65%); filter: drop-shadow(0 0 10px rgba(255, 210, 100, .9)); }
  .bigclock { position: relative; filter: drop-shadow(0 18px 20px rgba(60, 30, 0, .45)); animation: bob 2.4s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-6px) rotate(1deg); } }
  .shake { animation: shake .35s; }
  @keyframes shake { 20%, 60% { translate: -10px 0; } 40%, 80% { translate: 10px 0; } }
  .btns { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .tbtn { position: relative; border: 0; cursor: pointer; border-radius: 24px; padding: 10px 16px; background: linear-gradient(#fffaf0, #ffe9b8); box-shadow: 0 0 0 4px #e9b54a, 0 7px 0 #b0801c, 0 14px 24px -8px rgba(90, 50, 0, .5); transition: transform .1s; display: grid; place-items: center; min-width: 140px; }
  .tbtn:hover:not(:disabled) { transform: translateY(-3px); }
  .tbtn:active:not(:disabled) { transform: translateY(3px); }
  .tbtn.wrong { filter: grayscale(.8); opacity: .5; animation: shake .35s; }
  .tbtn .kbd { position: absolute; left: 8px; top: 6px; }
  .tix { background: linear-gradient(#fffdf3, #f6e6c4); box-shadow: 0 0 0 4px #c98f45, 0 7px 0 #8a5a2b, 0 14px 24px -8px rgba(90, 50, 0, .5); }
  .ticket { display: flex; align-items: center; gap: 14px; background: linear-gradient(#fffdf3, #f6e6c4); border-radius: 22px; padding: 8px 18px 8px 20px; box-shadow: 0 0 0 4px #c98f45, 0 10px 24px -8px rgba(90, 50, 0, .55); }
  .ticket small { font: 700 17px var(--font-body); color: #6b4318; max-width: 140px; line-height: 1.2; }
  .ticket.wide { padding: 6px 18px; }
  .belt { position: relative; width: min(1100px, 96vw); height: 260px; }
  .track { position: absolute; left: -10%; right: -10%; bottom: 18px; height: 34px; border-radius: 18px; background: repeating-linear-gradient(90deg, #8a5a2b 0 26px, #a87038 26px 52px); box-shadow: inset 0 4px 0 rgba(255, 255, 255, .25), 0 8px 16px rgba(60, 30, 0, .4); animation: roll 1.2s linear infinite; }
  @keyframes roll { to { background-position: 52px 0; } }
  .cart { position: absolute; bottom: 30px; left: calc(var(--x) + 8% + var(--i) * 30%); border: 0; background: none; padding: 0; cursor: pointer; display: grid; place-items: center; transition: left .25s linear, transform .15s; animation: bounce 1.6s calc(var(--i) * .2s) ease-in-out infinite; }
  .cart:hover:not(:disabled) { transform: scale(1.06); }
  .cart .gear.small { position: absolute; width: 60%; bottom: -26px; z-index: -1; }
  .cart.wrong { filter: grayscale(.9) brightness(.9); opacity: .55; }
  .cart.hit { filter: drop-shadow(0 0 24px #ffe066); }
  .cart .kbd { position: absolute; top: 0; left: 0; }
  @keyframes bounce { 50% { translate: 0 -8px; } }
  .fuse { width: min(520px, 80vw); height: 12px; border-radius: 999px; background: rgba(255, 255, 255, .6); box-shadow: 0 0 0 3px #fff; overflow: hidden; }
  .fuse i { display: block; height: 100%; background: linear-gradient(90deg, #ff7a5c, #ffd36b); border-radius: 999px; }
  .setbox { background: rgba(255, 252, 244, .92); border-radius: 26px; padding: 12px 20px; box-shadow: 0 12px 30px -10px rgba(60, 30, 0, .5); }
  .trainrow { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; justify-content: center; }
  .train { width: 260px; filter: drop-shadow(0 12px 14px rgba(60, 30, 0, .4)); animation: chug .5s ease-in-out infinite, arrive .9s cubic-bezier(.3, 1.2, .5, 1) both; }
  @keyframes chug { 50% { translate: 0 -3px; } }
  .trip { display: flex; flex-direction: column; align-items: center; gap: 8px; background: rgba(255, 252, 244, .94); border-radius: 24px; padding: 10px 18px; box-shadow: 0 0 0 4px #c98f45, 0 12px 26px -10px rgba(60, 30, 0, .55); max-width: 640px; }
  .tq { font: 600 19px/1.25 var(--font-ui); color: var(--ink); text-align: center; }
  .host { position: absolute; left: 28px; bottom: 18px; z-index: 5; pointer-events: none; filter: drop-shadow(0 8px 10px rgba(60, 30, 0, .35)); }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(60, 40, 10, .3); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 150px; height: 190px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(120, 80, 10, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #8a5a10; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #fff8ec; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 50px; height: 50px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #ffe2b0; overflow: hidden; }
  .how img { width: 44px; height: 44px; object-fit: contain; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff6df; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #6b4fc4; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #a98cff, #e9b54a); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #fff8ec; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }
  .xp { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .xp span { display: inline-flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 5px 12px; font: 700 14px var(--font-body); color: var(--ink2); }
  .xp img { width: 20px; height: 20px; }

  /* a phone */
  .compact .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
  .compact .title { padding: 3px; } .compact .title b, .compact .title small { display: none; } .compact .title img { width: 32px; height: 32px; }
  .compact .back { width: 38px; height: 38px; }
  .compact .score { min-width: 64px; padding: 2px 10px; } .compact .score b { font-size: 22px; }
  .compact .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
  .compact .clock { width: 50px; height: 50px; } .compact .clock span { width: 38px; height: 38px; font-size: 18px; }
  .compact .combo { font-size: 15px; padding: 3px 10px; }
  .compact .msg { top: 108px; font-size: 15px; }
  .compact .stagebox { top: 150px; gap: 12px; padding: 0 10px; }
  .compact .ask { font-size: 22px; }
  .compact .btns { gap: 10px; }
  .compact .tbtn { min-width: 96px; padding: 8px 10px; }
  .compact .belt { height: 190px; }
  .compact .cart { left: calc(var(--x) + 2% + var(--i) * 33%); }
  .compact .train { width: 170px; }
  .compact .tq { font-size: 16px; }
  .compact .host { display: none; }
  .compact .gearbg { opacity: .55; }
  .compact .hero { width: 110px; height: 140px; }
  .compact .start h1, .compact .done h1 { font-size: 30px; }
  .compact .lead { font-size: 15px; }
  .compact .how li { font-size: 14px; }
</style>
