<script lang="ts">
  // Market Dash: the money arcade game at a stall on the floating bazaar. Three Glimmer shoppers wait at
  // the counter, each with a bubble: what they want and its price tag, and what they hand over when they
  // want change. The glowing one is at the front. Tap coins from the bank into the tray (tap one in the
  // tray to take it back), then Pay. Two minutes a round: combos, a quick bonus, three stars, a best score
  // and today's challenge. The rules and scoring are in math/market/dash.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { AREA } from '../math/skills/registry';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { MarketScene } from '../three/marketScene';
  import { mulberry32, shuffle } from '../engine/rng';
  import type { Profile } from '../engine/profile';
  import { GLIMMERS, type GlimmerId } from '../adventure/glimmers';
  import { BANK, GOODS, ROUND_MS, STAR_AT, applyDash, comboMult, dailyBestOf, dailySeed, dashOf, kindsFor, levelsFor, oneWay, orderMaker, orderScore, servedRight, starsFor, type DashOutcome, type Order } from '../math/market/dash';
  import { COIN_ART, COIN_NAME, moneyText } from '../math/skills/decimals';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  /** the most coins the tray holds */
  const TRAY_MAX = 18;

  type Cust = { id: GlimmerId; key: string; order: Order; n: number; tries: number; waited: number; leaving: boolean };
  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let slots = $state<(Cust | null)[]>([null, null, null]);
  let active = $state<number | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), served = $state(0), missed = 0;
  let left = $state(ROUND_MS);
  let tray = $state(0), count = $state(0);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number } | null>(null);
  let heads = $state<({ x: number; y: number } | null)[]>([null, null, null]);
  let outcome = $state<DashOutcome | null>(null);
  let burst = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: MarketScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let nextOrder = orderMaker(1, ['exact']);
  let faces: GlimmerId[] = [];
  let arrivals = 0;
  let t0 = 0, last = 0, raf = 0, activeAt = 0;
  let disposed = false;

  const rec = $derived(dashOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const order = $derived(active !== null ? slots[active]?.order ?? null : null);

  onMount(() => {
    // this game draws its own 3D (the market stall isn't an island): the shared stage rests meanwhile
    stage.use(null);
    if (canvas) MarketScene.create(canvas).then(s => { if (disposed) s.dispose(); else { scene = s; if (import.meta.env.DEV) (window as unknown as { __market: MarketScene }).__market = s; raf = requestAnimationFrame(tick); } });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }
  const syncTray = () => { tray = scene?.total ?? 0; count = scene?.count ?? 0; };

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    nextOrder = orderMaker(seed, kindsFor(p), levelsFor(p));
    // the shoppers: every Glimmer but the Champions, in a shuffled line (today's is the same for everyone)
    faces = shuffle(mulberry32(seed ^ 0x51ed27), GLIMMERS.filter(g => g.rarity !== 'legendary' && g.rarity !== 'mythic').map(g => g.id));
    arrivals = 0; changeTips = 0;
    score = 0; combo = 0; bestCombo = 0; served = 0; missed = 0; answers = [];
    left = ROUND_MS; outcome = null; msg = null; active = null;
    slots = [null, null, null];
    scene?.clear(); syncTray();
    phase = 'play';
    startMusic('village');
    t0 = performance.now(); last = t0;
    // the first shopper walks up straight away, the others just behind
    arrive(1); setTimeout(() => arrive(0), 500); setTimeout(() => arrive(2), 1000);
    say('Tap coins to make the price, then Pay!');
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

  /** The next shopper at the counter: whoever has waited longest. */
  function pickActive() {
    if (phase !== 'play') return;
    if (active !== null && slots[active] && !slots[active]!.leaving) return;
    let best: number | null = null;
    slots.forEach((c, i) => { if (c && !c.leaving && (best === null || c.n < slots[best]!.n)) best = i; });
    active = best;
    if (best === null) return;
    const o = slots[best]!.order;
    activeAt = performance.now();
    // the first couple of change orders get a word, once the last message has been read
    if (o.paid !== null && changeTips < 2) {
      changeTips++;
      const at = best;
      setTimeout(() => { if (phase === 'play' && active === at) say(`They pay ${moneyText(o.paid!)} for ${GOODS[o.good].name} at ${moneyText(o.price)}. Give the change!`); }, served + missed ? 1100 : 0);
    }
  }
  let changeTips = 0;

  function leave(slot: number, happy: boolean) {
    const c = slots[slot]; if (!c) return;
    c.leaving = true;
    if (active === slot) active = null;
    setTimeout(() => { if (slots[slot] === c) { slots[slot] = null; syncCustomers(); } }, happy ? 900 : 600);
    // a new shopper comes into the empty place a moment later
    setTimeout(() => arrive(slot), happy ? 1800 : 1400);
    setTimeout(pickActive, happy ? 600 : 400);
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    heads = [0, 1, 2].map(i => scene!.headAt(i));
    if (phase !== 'play') return;
    const dt = now - last; last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (active !== null) {
      const c = slots[active];
      if (c && !c.leaving) {
        c.waited += dt;
        if (c.waited >= c.order.patienceMs) {
          // waited too long: it wanders off (only the combo is lost) and the coins go back to the bank
          sfx.fizzle(); scene.sad(active); combo = 0; missed++;
          scene.clear(); syncTray();
          say('Too slow, that one wandered off. Here comes the next!', 'oops');
          leave(active, false);
        }
      }
    }
    if (left <= 0) finish();
  }

  function add(v: number) {
    if (phase !== 'play' || !scene) return;
    if (scene.count >= TRAY_MAX) { sfx.nope(); say('The tray is full! Tap a coin to take it back.', 'oops'); return; }
    sfx.coin(v);
    scene.addCoin(v); syncTray();
  }
  function onPointer(e: PointerEvent) {
    if (phase !== 'play' || !scene) return;
    const v = scene.takeAt(e.clientX, e.clientY);
    if (v !== null) { sfx.pop(); syncTray(); }
  }
  function takeLast() { if (scene?.takeLast() != null) { sfx.pop(); syncTray(); } }
  function clearTray() { if (phase !== 'play' || !scene || !scene.count) return; sfx.whoosh(); scene.clear(); syncTray(); }

  function pay() {
    if (phase !== 'play' || !scene || active === null) return;
    const c = slots[active]; if (!c || c.leaving) return;
    if (!scene.count) { sfx.nope(); say(c.order.paid === null ? 'Tap coins into the tray first!' : 'Put the change in the tray first!'); return; }
    const o = c.order, have = scene.total, ok = servedRight(o, have), ms = performance.now() - activeAt;
    if (!c.tries) answers.push({ key: o.key, ok, thinkMs: ms, rung: o.rung });
    if (ok) {
      const pts = orderScore(o, combo, ms);
      score += pts; combo++; bestCombo = Math.max(bestCombo, combo); served++;
      musicEnergy(Math.min(1, 0.4 + combo * 0.08));
      pop = { text: `+${pts}`, key: Date.now() };
      sfx.till();
      if (combo >= 3) sfx.perfect();
      scene.pay(active); syncTray();
      scene.cheer(active);
      // say the sum: the price made, or counting up from the price to what they paid
      say(o.paid === null ? `${moneyText(o.price)}, just right!` : `${moneyText(o.price)} + ${moneyText(o.want)} = ${moneyText(o.paid)}. Right change!`, 'good');
      if (starsFor(score) > starsFor(score - pts)) { burst++; sfx.star(starsFor(score) - 1); }
      leave(active, true);
    } else {
      c.tries++; combo = 0;
      sfx.nope(); scene.shake(); scene.sad(active);
      const short = have < o.want;
      say(c.tries > 1 ? `One way: ${oneWay(o)}.` : o.paid === null ? `That's ${moneyText(have)}, ${short ? 'not enough' : 'too much'} for ${moneyText(o.price)}.` : `That's ${moneyText(have)}. Count up from ${moneyText(o.price)} to ${moneyText(o.paid)}.`, 'oops');
    }
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; active = null;
    sfx.complete();
    const out = applyDash($state.snapshot(game.profile!) as Profile, { score, served, missed, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
    slots = [null, null, null]; syncCustomers();
    scene?.clear(); syncTray();
  }

  /** opened from the Arcade, Back goes there; otherwise to the area's map */
  const fromArcade = game.gameFrom === 'arcade';
  game.gameFrom = 'map';
  const backTo = fromArcade ? 'the Arcade' : AREA.decimals.name;
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; slots = [null, null, null]; syncCustomers(); active = null; msg = null; scene?.clear(); syncTray(); return; }
    if (fromArcade) { game.go('arcade'); return; }
    game.mathArea = 'decimals'; game.mathOp = null; game.setHome('math'); game.go('map');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); quit(); }
    if (phase === 'play') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pay(); }
      else if (e.key === 'Backspace') { e.preventDefault(); takeLast(); }
      else if (/^[1-4]$/.test(e.key)) add(BANK[Number(e.key) - 1]);
    } else if (e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const patience = (c: Cust | null) => (c ? Math.max(0, 1 - c.waited / c.order.patienceMs) : 0);
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  /** what a shopper hands over, as coins or a bill */
  const handed = (cents: number) => (cents >= 100 ? ['bill'] : Array(Math.round(cents / 25)).fill('quarter'));
</script>

<svelte:window onkeydown={onKey} />

<div class="screen dash" style:background-image="url({base}math/market/shop.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={onPointer}></canvas>

  <!-- the bubbles over each shopper's head: what they want, its price, and what they hand over -->
  {#each slots as c, i (i)}
    {#if c && heads[i] && phase === 'play'}
      {@const isOn = i === active}
      {@const o = c.order}
      <div class="bubble" class:on={isOn} class:leaving={c.leaving} style:left="clamp(var(--edge), {heads[i]!.x}px, calc(100% - var(--edge)))" style:top="max({heads[i]!.y}px, var(--btop))" style:--pat={patience(c)}>
        <div class="bin">
          <img class="good" src="{base}math/market/{GOODS[o.good].a}.webp" alt={GOODS[o.good].name} />
          <span class="tag">{moneyText(o.price)}</span>
          {#if o.paid !== null}
            <span class="paid"><small>pays</small>{#each handed(o.paid) as a, k (k)}<img class:bill={a === 'bill'} src="{base}math/money/{a}.webp" alt="" />{/each}<b>{moneyText(o.paid)}</b></span>
          {/if}
        </div>
        {#if isOn && !c.leaving}<span class="ring" aria-hidden="true"></span>{/if}
      </div>
    {/if}
  {/each}

  <div class="top">
    <button class="back" onclick={quit} aria-label={phase === 'play' ? 'Stop the round' : `Back to ${backTo}`}><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/market/tile.webp" alt="" /><b>Market Dash</b>{#if daily}<small>Today's challenge</small>{/if}</div>
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

  {#if phase === 'play'}
    <div class="bottom">
      <div class="bank" role="group" aria-label="Coins">
        {#each BANK as v, k (v)}
          <button class="coin" onclick={() => add(v)} aria-label="Add a {COIN_NAME[v]}, {moneyText(v)}">
            <img src="{base}math/money/{COIN_ART[v]}.webp" alt="" style:--s={v === 25 ? 1 : v === 5 ? 0.88 : v === 1 ? 0.8 : 0.74} />
            <b>{moneyText(v)}</b><span class="kbd">{k + 1}</span>
          </button>
        {/each}
      </div>
      <div class="paybar">
        <div class="have" class:none={!count} class:over={!!order && tray > order.want}><span>Tray</span> <b>{moneyText(tray)}</b></div>
        <button class="btn clear" disabled={!count} onclick={clearTray}>Clear</button>
        <button class="btn btn-primary pay" disabled={active === null || !count} onclick={pay}>Pay <span class="kbd">enter</span></button>
      </div>
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/market/tile.webp" alt="" />
        <h1>Market Dash</h1>
        <p class="lead">The bazaar is busy! Shoppers want treats and toys. Pay the price in coins, or give the right change. Two minutes, as many shoppers as you can.</p>
        <ol class="how">
          <li><span class="pricetag">35¢</span>The glowing bubble is the next shopper. Read the price.</li>
          <li><span><img src="{base}math/money/quarter.webp" alt="" /></span>Tap coins into the tray to make it. Tap a coin in the tray to take it back.</li>
          <li><span><img src="{base}math/money/bill.webp" alt="" /></span>If they pay with more, give the change: count up to what they paid.</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Quick ones score more.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same shoppers all day</span></div>
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
        <h1>{o.stars === 3 ? 'Market Champion!' : o.stars === 2 ? 'Great trading!' : o.stars === 1 ? 'Stall closed!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{served}</b><small>shoppers served</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <PrizeRow {o} buddy={p.buddy} />
        <div class="acts">
          <button class="btn" onclick={quit}>Back to {backTo}</button>
          {#if !daily}<button class="btn" onclick={() => start(true)}>Today's challenge</button>{/if}
          <button class="btn btn-primary big" onclick={() => start(daily)}>Play again <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .dash { --btop: 200px; --edge: 70px; background-size: cover; background-position: center 40%; background-color: #f4d7a0; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #b7791f; }
  .title small { font: 800 11px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffe08a, #e6a817); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#4fcf9f, #23966a); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(20, 110, 70, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .bubble { position: absolute; z-index: 3; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none; transition: opacity .3s, transform .3s; }
  .bin { position: relative; display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 22px; padding: 4px 12px 4px 6px; box-shadow: 0 6px 16px rgba(80, 40, 10, .3); opacity: .82; }
  .bin::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 18px; height: 18px; background: #fff; transform: translateX(-50%) rotate(45deg); border-radius: 3px; }
  .bubble.on .bin { opacity: 1; padding: 6px 16px 6px 8px; box-shadow: 0 0 0 4px #ffd36b, 0 0 30px rgba(255, 210, 107, .9), 0 8px 20px rgba(80, 40, 10, .35); animation: glowb 1.4s ease-in-out infinite; }
  @keyframes glowb { 50% { box-shadow: 0 0 0 5px #ffd36b, 0 0 42px rgba(255, 210, 107, 1), 0 8px 20px rgba(80, 40, 10, .35); } }
  .bubble.leaving { opacity: 0; transform: translate(-50%, calc(-100% - 40px)); }
  .good { width: 38px; height: 38px; object-fit: contain; position: relative; z-index: 1; }
  .bubble.on .good { width: 54px; height: 54px; }
  .tag { position: relative; z-index: 1; font: 600 20px var(--font-ui); color: #6b3d10; background: #fff3c9; border: 2px dashed #d9a441; border-radius: 10px; padding: 1px 9px; }
  .bubble.on .tag { font-size: 28px; padding: 2px 12px; }
  .paid { position: relative; z-index: 1; display: flex; align-items: center; gap: 2px; padding-left: 6px; margin-left: 2px; border-left: 2px solid #f0e2c8; }
  .paid small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-right: 3px; }
  .paid img { width: 22px; height: 22px; object-fit: contain; }
  .paid img.bill { width: 38px; height: 22px; }
  .paid b { font: 600 16px var(--font-ui); color: #2f7d5b; margin-left: 3px; }
  .bubble.on .paid img { width: 30px; height: 30px; }
  .bubble.on .paid img.bill { width: 54px; height: 30px; }
  .bubble.on .paid b { font-size: 22px; }
  .ring { position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%); width: 120px; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #4fcf9f calc(var(--pat) * 100%), rgba(255, 255, 255, .7) 0); box-shadow: 0 0 0 2px #fff; }

  .msg { position: absolute; left: 50%; top: 84px; transform: translateX(-50%); z-index: 6; font: 600 20px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 640px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 6; font: 600 40px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #b7791f, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 10px 14px 16px; pointer-events: none; }
  .bottom > * { pointer-events: auto; }
  .bank { display: flex; gap: 8px; background: rgba(255, 250, 238, .94); border-radius: 24px; padding: 8px 10px; box-shadow: var(--shadow-sm); }
  .coin { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0; border: 0; cursor: pointer; background: #fff; border-radius: 18px; padding: 6px 10px 4px; min-width: 76px; box-shadow: 0 4px 0 #e6cf9e; transition: transform .1s; }
  .coin:hover { transform: translateY(-2px); }
  .coin:active { transform: translateY(2px); box-shadow: 0 2px 0 #e6cf9e; }
  .coin img { width: calc(56px * var(--s)); height: calc(56px * var(--s)); margin: calc(28px * (1 - var(--s))) 0; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(80, 50, 10, .3)); }
  .coin b { font: 600 18px var(--font-ui); color: var(--ink); }
  .coin .kbd { position: absolute; top: 4px; right: 6px; }
  .paybar { display: flex; align-items: center; gap: 10px; }
  .have { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border-radius: 20px; padding: 6px 16px; box-shadow: var(--shadow-sm); font: 700 16px var(--font-body); color: var(--ink2); min-height: 56px; }
  .have b { font: 600 28px var(--font-ui); color: #2f7d5b; min-width: 2.4em; }
  .have.none { opacity: .85; }
  .have.over b { color: #c4571b; }
  .clear { font-size: 18px; padding: 12px 18px; border-radius: 18px; }
  .pay { font-size: 26px; padding: 14px 34px; border-radius: 22px; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(60, 40, 10, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 150px; height: 150px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(120, 80, 10, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #b7791f; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #fff8ec; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #ffe2b0; }
  .how img { width: 38px; height: 38px; object-fit: contain; }
  .how .pricetag { font: 600 17px var(--font-ui); color: #6b3d10; background: #fff3c9; box-shadow: 0 0 0 2px #d9a441; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff6df; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #4fcf9f, #e6a817); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #fff8ec; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* a phone */
  @media (max-width: 760px) {
    .dash { --btop: 230px; --edge: 84px; }
    .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
    .title { padding: 3px; } .title b, .title small { display: none; } .title img { width: 32px; height: 32px; }
    .back { width: 38px; height: 38px; }
    .score { min-width: 64px; padding: 2px 10px; } .score b { font-size: 22px; }
    .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
    .clock { width: 50px; height: 50px; } .clock span { width: 38px; height: 38px; font-size: 18px; }
    .combo { font-size: 15px; padding: 3px 10px; }
    .msg { top: 112px; font-size: 16px; }
    .bin { gap: 4px; padding: 3px 8px 3px 4px; }
    .good { width: 30px; height: 30px; }
    .bubble.on .good { width: 42px; height: 42px; }
    .tag { font-size: 16px; padding: 0 6px; }
    .bubble.on .tag { font-size: 22px; padding: 1px 8px; }
    .paid small { display: none; }
    .paid b { display: none; }
    .bank { gap: 6px; padding: 6px; border-radius: 20px; }
    .coin { min-width: 0; width: 76px; padding: 4px 4px 2px; border-radius: 14px; }
    .coin img { width: calc(48px * var(--s)); height: calc(48px * var(--s)); margin: calc(24px * (1 - var(--s))) 0; }
    .coin b { font-size: 16px; }
    .coin .kbd { display: none; }
    .paybar { gap: 6px; }
    .have { min-height: 50px; padding: 4px 12px; font-size: 14px; }
    .have b { font-size: 22px; }
    .clear { font-size: 16px; padding: 10px 12px; }
    .pay { font-size: 22px; padding: 12px 20px; }
    .pay .kbd { display: none; }
    .hero { width: 110px; height: 110px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; }
  }
</style>
