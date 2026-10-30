<script lang="ts">
  // Pizza Rush: the fractions arcade game in the pizza shop on the floating island. Three Glimmers wait
  // at the counter, each with an order bubble; the one with the glowing bubble is at the front. Cut the
  // pizza (or it comes cut), tap the slices, serve. Two minutes a round: combos, a quick bonus, three
  // stars, a best score and today's challenge. The rules and scoring are in math/pizza/rush.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { DAILY_SHELLS } from '../engine/settle';
  import { clearOldLine } from '../arcade/feedback';
  import { exitsOf } from '../arcade/exits';
  import ExitButtons from '../arcade/ui/ExitButtons.svelte';
  import PauseButton from '../ui/PauseButton.svelte';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { PizzaScene } from '../three/pizzaScene';
  import { mulberry32, shuffle } from '../engine/rng';
  import type { Profile } from '../engine/profile';
  import { GLIMMERS, type GlimmerId } from '../adventure/glimmers';
  import { CUTS, ROUND_MS, STAR_AT, applyRush, comboMult, cutsFor, dailyBestOf, dailySeed, fracText, kindsFor, levelsFor, orderMaker, orderScore, orderText, rushOf, servedRight, slicesNeeded, starsFor, type Order, type RushOutcome, PIZZAS } from '../math/pizza/rush';
  import Frac from '../math/skills/ui/Frac.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';
  import CloseButton from '../ui/CloseButton.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);

  type Cust = { id: GlimmerId; key: string; order: Order; n: number; tries: number; waited: number; leaving: boolean };
  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let slots = $state<(Cust | null)[]>([null, null, null]);
  let active = $state<number | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), served = $state(0), missed = 0;
  let left = $state(ROUND_MS);
  let picked = $state(0), cutInto = $state(1);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number } | null>(null);
  let heads = $state<({ x: number; y: number } | null)[]>([null, null, null]);
  let outcome = $state<RushOutcome | null>(null);
  let burst = $state(0);
  let cutPulse = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: PizzaScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let nextOrder = orderMaker(1, ['tap']);
  let faces: GlimmerId[] = [];
  let arrivals = 0;
  let t0 = 0, last = 0, raf = 0, activeAt = 0;
  /** the Pause card (ui/PauseButton.svelte): the round's clock stops while it's open */
  let held = 0;
  function hold() { if (phase === 'play' && !held) held = performance.now(); }
  function unhold() { if (!held) return; const d = performance.now() - held; t0 += d; last += d; activeAt += d; held = 0; }
  let disposed = false;

  const rec = $derived(rushOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const order = $derived(active !== null ? slots[active]?.order ?? null : null);
  const needCut = $derived(!!order && order.slices === null);

  onMount(() => {
    // this game draws its own 3D (the pizza shop isn't an island): the shared stage rests meanwhile
    stage.use(null);
    if (canvas) PizzaScene.create(canvas).then(s => { if (disposed) s.dispose(); else { scene = s; if (import.meta.env.DEV) (window as unknown as { __pizza: PizzaScene }).__pizza = s; raf = requestAnimationFrame(tick); } });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    nextOrder = orderMaker(seed, kindsFor(p), levelsFor(p));
    // the customers: every Glimmer but the Champions, in a shuffled line (today's is the same for everyone)
    faces = shuffle(mulberry32(seed ^ 0x9e3779b9), GLIMMERS.filter(g => g.rarity !== 'legendary' && g.rarity !== 'mythic').map(g => g.id));
    arrivals = 0;
    score = 0; combo = 0; bestCombo = 0; served = 0; missed = 0; answers = [];
    left = ROUND_MS; outcome = null; msg = null; active = null;
    slots = [null, null, null];
    phase = 'play';
    startMusic('cliffs');
    t0 = performance.now(); last = t0;
    // the first customer walks up straight away, the others just behind
    arrive(1); setTimeout(() => arrive(0), 500); setTimeout(() => arrive(2), 1000);
    say(kindsFor(p).length > 2 ? 'Serve the glowing order first!' : 'Tap the slices for the glowing order, then Serve!');
  }

  function arrive(slot: number) {
    if (phase !== 'play' || slots[slot]) return;
    const id = faces[arrivals % faces.length];
    const c: Cust = { id, key: `${id}-${arrivals}`, order: nextOrder(), n: arrivals++, tries: 0, waited: 0, leaving: false };
    slots[slot] = c;
    syncCustomers();
    if (active === null) setTimeout(pickActive, 650);
  }
  function syncCustomers() { scene?.setCustomers(slots.map(c => (c && !c.leaving ? c.id : null)), slots.map(c => (c && !c.leaving ? c.key : null))); }

  /** The next order at the counter: whoever has waited longest. */
  function pickActive() {
    if (phase !== 'play') return;
    if (active !== null && slots[active] && !slots[active]!.leaving) return;
    let best: number | null = null;
    slots.forEach((c, i) => { if (c && !c.leaving && (best === null || c.n < slots[best]!.n)) best = i; });
    active = best;
    if (best === null) return;
    // the last order's line goes (the first order keeps the how-to tip)
    if (served + missed) clearOldLine(() => msg, () => (msg = null));
    const o = slots[best]!.order;
    activeAt = performance.now(); sfx.nextUp();
    scene?.newPizza(o.slices ?? 1, o.pizza);
    cutInto = o.slices ?? 1; picked = 0;
    if (o.slices === null) { cutPulse++; say("How many slices? Cut the pizza!"); }
  }

  function leave(slot: number, happy: boolean) {
    const c = slots[slot]; if (!c) return;
    c.leaving = true;
    if (active === slot) active = null;
    setTimeout(() => { if (slots[slot] === c) { slots[slot] = null; syncCustomers(); } }, happy ? 900 : 600);
    // a new customer comes into the empty place a moment later
    setTimeout(() => arrive(slot), happy ? 1800 : 1400);
    setTimeout(pickActive, happy ? 600 : 400);
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    heads = [0, 1, 2].map(i => scene!.headAt(i));
    if (phase !== 'play') return;
    if (held) return;
    const dt = now - last; last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (active !== null) {
      const c = slots[active];
      if (c && !c.leaving) {
        c.waited += dt;
        if (c.waited >= c.order.patienceMs) {
          // waited too long: it wanders off (only the combo is lost)
          sfx.fizzle(); scene.sad(active); combo = 0; missed++;
          say('Too slow, that one wandered off. Here comes the next!', 'oops');
          leave(active, false);
        }
      }
    }
    if (left <= 0) finish();
  }

  function onPointer(e: PointerEvent) {
    if (phase !== 'play' || !scene || active === null) return;
    if (scene.cutInto <= 1) {
      if (scene.onPizza(e.clientX, e.clientY)) { sfx.nope(); cutPulse++; say('Cut it first: pick how many slices below.'); }
      return;
    }
    if (scene.tap(e.clientX, e.clientY)) { sfx.pop(); picked = scene.picked; }
  }
  function cut(n: number) {
    if (phase !== 'play' || !scene || active === null) return;
    sfx.slice();
    scene.setCut(n); cutInto = n; picked = 0;
  }

  function serve() {
    if (phase !== 'play' || !scene || active === null) return;
    const c = slots[active]; if (!c || c.leaving) return;
    if (scene.cutInto <= 1) { sfx.nope(); cutPulse++; say('Cut it first: pick how many slices below.'); return; }
    if (!picked) { sfx.nope(); say('Tap some slices first!'); return; }
    const o = c.order, ok = servedRight(o, scene.cutInto, picked), ms = performance.now() - activeAt;
    if (!c.tries) answers.push({ key: o.key, ok, thinkMs: ms, rung: o.rung });
    if (ok) {
      const pts = orderScore(o, combo, ms);
      score += pts; combo++; bestCombo = Math.max(bestCombo, combo); served++;
      musicEnergy(Math.min(1, 0.4 + combo * 0.08));
      pop = { text: `+${pts}`, key: Date.now() };
      combo >= 3 ? sfx.perfect() : sfx.cheer();
      scene.serve(active);
      scene.cheer(active);
      // say what was made: the sum, or that a different cut is the same amount
      const made = `${picked}/${scene.cutInto}`;
      say(`Yum! ${o.parts.length > 1 ? `${orderText(o)} = ${made}${picked === scene.cutInto ? ", a whole pizza!" : ""}` : scene.cutInto !== o.want.d ? `${made} is the same as ${fracText(o.want)}` : `${made}, just right`}`, 'good');
      picked = 0;
      if (starsFor(score) > starsFor(score - pts)) { burst++; sfx.star(starsFor(score) - 1); }
      leave(active, true);
    } else {
      c.tries++; combo = 0;
      sfx.nope(); scene.shake(); scene.sad(active);
      const need = slicesNeeded(o, scene.cutInto);
      const have = `${picked}/${scene.cutInto}`;
      say(need === null ? `That's ${have}. Try cutting it into ${cutsFor(o).find(x => x >= o.want.d) ?? cutsFor(o)[0]} slices instead.` : c.tries > 1 ? `Tap ${need} of the ${scene.cutInto} slices.` : `That's ${have}. Not quite: try again!`, 'oops');
    }
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; active = null;
    sfx.complete();
    const out = applyRush($state.snapshot(game.profile!) as Profile, { score, served, missed, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
    slots = [null, null, null]; syncCustomers();
  }

  /** where it was opened from: Back goes there, and its cards offer the Arcade too */
  const exits = exitsOf('fractions');
  const backTo = exits.backTo;
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; slots = [null, null, null]; syncCustomers(); active = null; msg = null; return; }
    exits.back();
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (phase === 'play' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); serve(); }
    if (phase === 'play' && needCut && CUTS.includes(Number(e.key) as (typeof CUTS)[number])) cut(Number(e.key));
    if (phase !== 'play' && e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  // the customer whose order is up gets the spotlight in 3D too
  $effect(() => { scene?.setActive(phase === 'play' ? active : null); });
  const patience = (c: Cust | null) => (c ? Math.max(0, 1 - c.waited / c.order.patienceMs) : 0);
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
</script>

<svelte:window onkeydown={onKey} />

<div class="screen rush" style:background-image="url({base}math/pizza/shop.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={onPointer}></canvas>

  <!-- the order bubbles, over each customer's head -->
  {#each slots as c, i (i)}
    {#if c && heads[i] && phase === 'play'}
      {@const isOn = i === active}
      <div class="bubble" class:on={isOn} class:leaving={c.leaving} style:left="clamp(66px, {heads[i]!.x}px, calc(100% - 66px))" style:top="max({heads[i]!.y}px, var(--btop))" style:--pat={patience(c)}>
        {#if isOn && !c.leaving}<div class="up"><img src="{base}icons/down.webp" alt="" /><span>Your order!</span></div>{/if}
        <div class="bin">
          {#each c.order.parts as f, j}{#if j}<span class="plus">+</span>{/if}<Frac n={f.n} d={f.d} size={isOn ? 44 : 24} />{/each}
          {#if isOn && !c.leaving && c.order.pizza}<small class="pz" class:funny={PIZZAS[c.order.pizza].funny}>{PIZZAS[c.order.pizza].name}</small>{/if}
        </div>
        {#if isOn && !c.leaving}<span class="ring" aria-hidden="true"></span>{:else if !c.leaving}<span class="wait">next</span>{/if}
      </div>
    {/if}
  {/each}

  <PauseButton onpause={hold} onresume={unhold} />
  <div class="top">
    <div class="title"><img src="{base}math/pizza/tile.webp" alt="" /><b>Pizza Rush</b>{#if daily}<small>Today's challenge</small>{/if}</div>
    {#if phase === 'play'}
      <div class="score"><small>Score</small><b>{score}</b></div>
      <div class="meter" title="Stars at {STAR_AT.join(', ')}">
        <i style:width="{meter * 100}%"></i>
        {#each STAR_AT as s, k}<img class:on={score >= s} style:left="{(s / STAR_AT[2]) * 100}%" src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
      {#if combo > 1}{#key combo}<div class="combo">Combo ×{comboMult(combo)}</div>{/key}{/if}
      <div class="clock" class:low={secs <= 15} style:--k={left / ROUND_MS}><span>{secs}</span></div>
    {/if}
  </div>

  {#if pop}{#key pop.key}<div class="pop">{pop.text}</div>{/key}{/if}

  {#if phase === 'play'}
    <div class="bottom">
      <!-- tips and feedback sit just above what you have and Serve (up top they hid the "Your order!" arrow) -->
      {#if msg}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
      {#if needCut}
        {#key cutPulse}
          <div class="cutter" class:pulse={cutPulse > 0}>
            <span class="clabel">Cut into</span>
            {#each CUTS as n}
              <button class="cut" class:on={cutInto === n} onclick={() => cut(n)} aria-label="Cut into {n} slices">
                <svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#f2b24a" stroke="#c77b2a" stroke-width="1.6" />{#each Array(n) as _, k}<line x1="0" y1="0" x2={Math.cos((k / n) * Math.PI * 2 - Math.PI / 2) * 11} y2={Math.sin((k / n) * Math.PI * 2 - Math.PI / 2) * 11} stroke="#7a3d12" stroke-width="1.3" />{/each}</svg>
                <b>{n}</b>
              </button>
            {/each}
          </div>
        {/key}
      {/if}
      <div class="servebar">
        <div class="have" class:none={!picked}>{#if cutInto > 1}<span>You have</span> <Frac n={picked} d={cutInto} size={34} />{:else}<span>A whole pizza</span>{/if}</div>
        <button class="btn btn-primary serve" disabled={active === null || cutInto <= 1 || !picked} onclick={serve}>Serve <span class="kbd">enter</span></button>
      </div>
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/pizza/tile.webp" alt="" />
        <h1>Pizza Rush</h1>
        <p class="lead">Glimmers are hungry! Read each order, cut the pizza, tap the slices and serve. Two minutes, as many orders as you can.</p>
        <ol class="how">
          <li><span><Frac n={3} d={4} size={26} /></span>The Glimmer in the spotlight, with the glowing bubble and the arrow, is the order to make now.</li>
          <li><span><svg viewBox="-12 -12 24 24" aria-hidden="true"><circle r="11" fill="#f2b24a" stroke="#c77b2a" stroke-width="1.6" />{#each Array(4) as _, k}<line x1="0" y1="0" x2={Math.cos((k / 4) * Math.PI * 2) * 11} y2={Math.sin((k / 4) * Math.PI * 2) * 11} stroke="#7a3d12" stroke-width="1.3" />{/each}</svg></span>Cut it if it's whole, then tap the slices.</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Quick ones score more.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same orders all day</span><span class="tiny bonus">Beat {STAR_AT[1]} for {DAILY_SHELLS} bonus shells</span></div>
        </div>
        <div class="acts">
          <ExitButtons {exits} />
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
        <h1>{o.stars === 3 ? 'Pizza Champion!' : o.stars === 2 ? 'Great service!' : o.stars === 1 ? 'Shop closed!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{served}</b><small>pizzas served</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <PrizeRow {o} buddy={p.buddy} />
        <div class="acts">
          <ExitButtons {exits} />
          {#if !daily}<button class="btn" onclick={() => start(true)}>Today's challenge</button>{/if}
          <button class="btn btn-primary big" onclick={() => start(daily)}>Play again <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .rush { --btop: 210px; background-size: cover; background-position: center 38%; background-color: #f6d9a8; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #c0392b; }
  .title small { font: 800 11px var(--font-body); color: #a86a00; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffd36b, #ff9f43); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#ff8a5c, #e8452c); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(200, 60, 20, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .bubble { position: absolute; z-index: 3; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none; transition: opacity .3s, transform .3s; }
  .bin { position: relative; display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 22px; padding: 6px 14px; box-shadow: 0 6px 16px rgba(80, 40, 10, .3); opacity: .6; transform: scale(.85); transform-origin: 50% 100%; filter: saturate(.6); }
  .bubble.on .bin { transform: none; filter: none; }
  .up { position: absolute; left: 50%; bottom: 100%; transform: translateX(-50%); margin-bottom: 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; animation: hop .7s ease-in-out infinite; }
  .up span { order: -1; font: 700 15px var(--font-ui); color: #fff; background: linear-gradient(#ffb43d, #ff7a1f); padding: 3px 12px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(200, 90, 20, .4); white-space: nowrap; }
  .up img { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(80, 40, 10, .3)); }
  @keyframes hop { 50% { transform: translateX(-50%) translateY(-8px); } }
  .wait { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 12px; font: 800 11px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: rgba(255, 255, 255, .95); background: rgba(80, 50, 30, .55); padding: 2px 8px; border-radius: 999px; }
  .bin::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 18px; height: 18px; background: #fff; transform: translateX(-50%) rotate(45deg); border-radius: 3px; }
  .bubble.on .bin { opacity: 1; padding: 8px 18px; box-shadow: 0 0 0 4px #ffd36b, 0 0 30px rgba(255, 210, 107, .9), 0 8px 20px rgba(80, 40, 10, .35); animation: glowb 1.4s ease-in-out infinite; }
  @keyframes glowb { 50% { box-shadow: 0 0 0 5px #ffd36b, 0 0 42px rgba(255, 210, 107, 1), 0 8px 20px rgba(80, 40, 10, .35); } }
  .bubble.leaving { opacity: 0; transform: translate(-50%, calc(-100% - 40px)); }
  .plus { font: 600 26px var(--font-ui); color: var(--ink2); }
  /* what kind of pizza the order is, under the fraction (the funny ones in a party colour) */
  .bin { flex-wrap: wrap; justify-content: center; }
  .pz { flex-basis: 100%; text-align: center; margin-top: 2px; font: 700 13px/1 var(--font-body); color: #a8501c; letter-spacing: .02em; }
  .pz.funny { color: #c2367a; }
  .bubble.on .plus { font-size: 34px; }
  .ring { position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%); width: 120px; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #4fcf9f calc(var(--pat) * 100%), rgba(255, 255, 255, .7) 0); box-shadow: 0 0 0 2px #fff; }

  .msg { position: relative; z-index: 6; font: 600 20px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 640px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translateY(12px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 6; font: 600 40px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #e8452c, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 14px 16px; pointer-events: none; }
  .bottom > * { pointer-events: auto; }
  .cutter { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border-radius: 22px; padding: 8px 12px; box-shadow: var(--shadow-sm); }
  .cutter.pulse { animation: pulse .6s ease-in-out 2; }
  @keyframes pulse { 50% { box-shadow: 0 0 0 5px #ffd36b, var(--shadow-sm); transform: scale(1.04); } }
  .clabel { font: 700 15px var(--font-body); color: var(--ink2); margin-right: 2px; }
  .cut { display: flex; align-items: center; gap: 4px; border: 0; cursor: pointer; background: #fff7ea; border-radius: 14px; padding: 5px 10px 5px 6px; box-shadow: 0 3px 0 #e8c79a; transition: transform .12s; }
  .cut:hover { transform: translateY(-2px); }
  .cut.on { background: #ffd36b; box-shadow: 0 3px 0 #d6a52e; }
  .cut svg { width: 34px; height: 34px; }
  .cut b { font: 600 22px var(--font-ui); color: var(--ink); }
  .servebar { display: flex; align-items: center; gap: 12px; }
  .have { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border-radius: 20px; padding: 6px 16px; box-shadow: var(--shadow-sm); font: 700 16px var(--font-body); color: var(--ink2); min-height: 56px; }
  .have.none { opacity: .85; }
  .serve { font-size: 26px; padding: 14px 34px; border-radius: 22px; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(60, 30, 20, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 150px; height: 150px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(120, 50, 10, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #c0392b; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #fff8ec; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #ffe2b0; }
  .how svg { width: 34px; height: 34px; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #f6f2ff; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .tiny.bonus { color: #a86a00; font-weight: 700; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #a86a00; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #ff7ab8, #ffb44d); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #fff8ec; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* a phone */
  @media (max-width: 760px) {
    .rush { --btop: 236px; }
    .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
    .title { padding: 3px; } .title b, .title small { display: none; } .title img { width: 32px; height: 32px; }
    .back { width: 38px; height: 38px; }
    .score { min-width: 64px; padding: 2px 10px; } .score b { font-size: 22px; }
    .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
    .clock { width: 50px; height: 50px; } .clock span { width: 38px; height: 38px; font-size: 18px; }
    .combo { font-size: 15px; padding: 3px 10px; }
    .msg { font-size: 16px; }
    .cutter { gap: 4px; padding: 6px 8px; flex-wrap: wrap; justify-content: center; }
    .clabel { flex-basis: 100%; text-align: center; font-size: 13px; }
    .cut { padding: 4px 7px 4px 4px; } .cut svg { width: 26px; height: 26px; } .cut b { font-size: 18px; }
    .serve { font-size: 22px; padding: 12px 22px; }
    .have { min-height: 50px; padding: 4px 12px; font-size: 14px; }
    .hero { width: 110px; height: 110px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; }
  }
  /* the one Pause button sits top left on every activity: the title chip starts after it */
  .top { padding-left: 76px; }
  @media (max-width: 600px) { .top { padding-left: 62px; } }
</style>
