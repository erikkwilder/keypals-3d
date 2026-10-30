<script lang="ts">
  // Smoothie Stand: the ratios arcade game at a jungle smoothie stand. Three Glimmer customers wait at the
  // counter, each with an order bubble: a recipe and how many cups ("2 strawberries for every 3 bananas, 3
  // cups!"), a recipe with one fruit already in the blender, or a percent mix. The glowing bubble is next.
  // Tap fruit into the blender (− takes one back), then Blend: right, and the smoothie pours into a glass
  // that slides to the customer; wrong, and the blender sputters with a hint. Two minutes a round: combos,
  // tips for quick ones, two rush hours of double points, three stars, a best score and today's challenge.
  // The rules and scoring are in math/ratios/stand.ts; the 3D in three/smoothieScene.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { AREA } from '../math/skills/registry';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { SmoothieScene } from '../three/smoothieScene';
  import { mulberry32, shuffle } from '../engine/rng';
  import type { Profile } from '../engine/profile';
  import { GLIMMERS, type GlimmerId } from '../adventure/glimmers';
  import { BLENDER_MAX, ROUND_MS, RUSH, STAR_AT, applyStand, comboMult, dailyBestOf, dailySeed, helpText, inRush, kindsFor, levelsFor, mixColor, orderMaker, orderScore, orderText, servedRight, standOf, starsFor, type Order, type StandOutcome } from '../math/ratios/stand';
  import { FRUIT } from '../math/skills/ratioPic';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  type Cust = { id: GlimmerId; key: string; order: Order; n: number; tries: number; waited: number; leaving: boolean };
  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let slots = $state<(Cust | null)[]>([null, null, null]);
  let active = $state<number | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), served = $state(0), tips = $state(0), missed = 0;
  let left = $state(ROUND_MS);
  let rush = $state(false);
  /** what's in the blender: the order's first fruit, its second */
  let have = $state<[number, number]>([0, 0]);
  let blending = $state(false);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip' | 'rush'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number; tip: boolean } | null>(null);
  let banner = $state<{ text: string; key: number } | null>(null);
  let heads = $state<({ x: number; y: number } | null)[]>([null, null, null]);
  let outcome = $state<StandOutcome | null>(null);
  let burst = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: SmoothieScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let nextOrder = orderMaker(1, ['scale']);
  let faces: GlimmerId[] = [];
  let arrivals = 0, fillTips = 0, pctTips = 0;
  let t0 = 0, last = 0, raf = 0, activeAt = 0;
  let disposed = false;

  const rec = $derived(standOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const order = $derived(active !== null ? slots[active]?.order ?? null : null);
  const elapsed = $derived(ROUND_MS - left);

  onMount(() => {
    stage.use(null);
    if (canvas) SmoothieScene.create(canvas).then(s => { if (disposed) s.dispose(); else { scene = s; if (import.meta.env.DEV) (window as unknown as { __smoothie: SmoothieScene }).__smoothie = s; raf = requestAnimationFrame(tick); } });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }
  function say(text: string, kind: 'good' | 'oops' | 'tip' | 'rush' = 'tip') { msg = { text, kind, key: Date.now() }; }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    nextOrder = orderMaker(seed, kindsFor(p), levelsFor(p));
    faces = shuffle(mulberry32(seed ^ 0x5eed5), GLIMMERS.filter(g => g.rarity !== 'legendary' && g.rarity !== 'mythic').map(g => g.id));
    arrivals = 0; fillTips = 0; pctTips = 0;
    score = 0; combo = 0; bestCombo = 0; served = 0; tips = 0; missed = 0; answers = [];
    left = ROUND_MS; outcome = null; msg = null; active = null; rush = false; blending = false;
    slots = [null, null, null];
    scene?.clear(); have = [0, 0];
    phase = 'play';
    startMusic('adventure');
    t0 = performance.now(); last = t0;
    arrive(1); setTimeout(() => arrive(0), 500); setTimeout(() => arrive(2), 1000);
    say('Read the order. Tap the fruit in, then Blend!');
  }

  function arrive(slot: number) {
    if (phase !== 'play' || slots[slot]) return;
    const id = faces[arrivals % faces.length];
    slots[slot] = { id, key: `${id}-${arrivals}`, order: nextOrder(), n: arrivals++, tries: 0, waited: 0, leaving: false };
    syncCustomers();
    if (active === null) setTimeout(pickActive, 650);
  }
  function syncCustomers() { scene?.setCustomers(slots.map(c => (c && !c.leaving ? c.id : null)), slots.map(c => (c && !c.leaving ? c.key : null))); }

  /** The next customer: whoever has waited longest. A "some fruit is in" order fills the blender with it. */
  function pickActive() {
    if (phase !== 'play') return;
    if (active !== null && slots[active] && !slots[active]!.leaving) return;
    let best: number | null = null;
    slots.forEach((c, i) => { if (c && !c.leaving && (best === null || c.n < slots[best]!.n)) best = i; });
    active = best;
    if (best === null) return;
    const o = slots[best]!.order;
    activeAt = performance.now();
    scene?.clear(); have = [0, 0];
    if (o.start[1]) { scene?.fill(o.fruits[1], o.start[1]); have = [0, o.start[1]]; }
    sfx.nextUp();
    if (o.kind === 'fill' && fillTips < 2) { fillTips++; say(`The ${FRUIT[o.fruits[1]].many} are in already. How many ${FRUIT[o.fruits[0]].many} keep the mix?`); }
    else if (o.kind === 'percent' && pctTips < 2) { pctTips++; say(`${o.pct}% of ${o.scoops} scoops are ${FRUIT[o.fruits[0]].one}. The rest are ${FRUIT[o.fruits[1]].one}.`); }
  }

  function leave(slot: number, happy: boolean) {
    const c = slots[slot]; if (!c) return;
    c.leaving = true;
    if (active === slot) active = null;
    const fast = inRush(performance.now() - t0);
    setTimeout(() => { if (slots[slot] === c) { slots[slot] = null; syncCustomers(); } }, happy ? 900 : 600);
    setTimeout(() => arrive(slot), fast ? 700 : happy ? 1800 : 1400);
    setTimeout(pickActive, happy ? 1300 : 400);
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    heads = [0, 1, 2].map(i => scene!.headAt(i));
    if (phase !== 'play') return;
    const dt = now - last; last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    const r = inRush(now - t0);
    if (r !== rush) {
      rush = r;
      if (r) { banner = { text: 'Rush hour! Double points!', key: now }; sfx.party(); scene.sparkle(); musicEnergy(1); }
      else { say('Rush hour is over. Nice and steady!'); musicEnergy(Math.min(1, 0.4 + combo * 0.08)); }
    }
    if (active !== null && !blending) {
      const c = slots[active];
      if (c && !c.leaving) {
        c.waited += dt;
        if (c.waited >= c.order.patienceMs) {
          sfx.fizzle(); scene.sad(active); combo = 0; missed++;
          scene.clear(); have = [0, 0];
          say('Too slow, that one wandered off. Here comes the next!', 'oops');
          leave(active, false);
        }
      }
    }
    if (left <= 0) finish();
  }

  function add(i: 0 | 1) {
    if (phase !== 'play' || !scene || !order || blending) return;
    if (have[0] + have[1] >= BLENDER_MAX) { sfx.nope(); say('The blender is full! Take some out.', 'oops'); return; }
    if (order.kind === 'fill' && i === 1) { sfx.nope(); say(`The ${FRUIT[order.fruits[1]].many} are in already!`, 'oops'); return; }
    scene.addFruit(order.fruits[i]);
    have = i === 0 ? [have[0] + 1, have[1]] : [have[0], have[1] + 1];
    sfx.fruitIn(have[0] + have[1]);
  }
  function take(i: 0 | 1) {
    if (phase !== 'play' || !scene || !order || blending || !have[i]) return;
    if (order.kind === 'fill' && i === 1) return;
    if (scene.takeFruit(order.fruits[i])) { have = i === 0 ? [have[0] - 1, have[1]] : [have[0], have[1] - 1]; sfx.pop(); }
  }
  function clearIt() {
    if (phase !== 'play' || !scene || !order || blending) return;
    sfx.whoosh(); scene.clear(); have = [0, 0];
    if (order.start[1]) { scene.fill(order.fruits[1], order.start[1]); have = [0, order.start[1]]; }
  }

  function blend() {
    if (phase !== 'play' || !scene || active === null || blending) return;
    const c = slots[active]; if (!c || c.leaving) return;
    const o = c.order;
    if (!have[0] && !have[1]) { sfx.nope(); say('Tap some fruit into the blender first!'); return; }
    const ok = servedRight(o, have), ms = performance.now() - activeAt;
    if (!c.tries) answers.push({ key: o.key, ok, thinkMs: ms, rung: o.rung });
    sfx.blend();
    if (ok) {
      blending = true;
      const slot = active, isRush = inRush(performance.now() - t0), tipped = ms <= 10_000;
      const pts = orderScore(o, combo, ms, isRush);
      scene.blend(mixColor(have, o.fruits), true, slot, () => {
        blending = false;
        score += pts; combo++; bestCombo = Math.max(bestCombo, combo); served++;
        if (tipped) tips++;
        musicEnergy(rush ? 1 : Math.min(1, 0.4 + combo * 0.08));
        pop = { text: `+${pts}`, key: Date.now(), tip: tipped };
        sfx.pour(); sfx.till();
        if (combo >= 3) sfx.perfect();
        scene?.cheer(slot);
        say(o.kind === 'percent' ? `${o.pct}% of ${o.scoops} is ${o.want[0]}. Yum!` : o.kind === 'fill' ? `${o.want[0]} : ${o.want[1]} is ${o.cups} lots of ${o.recipe[0]} : ${o.recipe[1]}. Just right!` : `${o.cups} ${o.cups === 1 ? 'cup' : 'cups'} of ${o.recipe[0]} : ${o.recipe[1]} is ${o.want[0]} : ${o.want[1]}. Delicious!`, 'good');
        if (starsFor(score) > starsFor(score - pts)) { burst++; sfx.star(starsFor(score) - 1); }
        have = [0, 0];
        leave(slot, true);
      });
    } else {
      c.tries++; combo = 0;
      scene.blend('#ffffff', false, null, () => {});
      sfx.nope(); scene.sad(active);
      const fewer = have[0] < o.want[0] || have[1] < o.want[1];
      say(c.tries > 1 ? helpText(o) : o.kind === 'percent' ? `Not quite. ${o.pct}% of ${o.scoops} scoops is how many ${FRUIT[o.fruits[0]].many}?` : `Not quite: ${fewer ? 'something is missing' : 'too much'}. Each cup is ${o.recipe[0]} ${FRUIT[o.fruits[0]].many} and ${o.recipe[1]} ${FRUIT[o.fruits[1]].many}.`, 'oops');
    }
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; active = null; rush = false;
    sfx.complete();
    const out = applyStand($state.snapshot(game.profile!) as Profile, { score, served, missed, bestCombo, tips, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    if (out.newBest && score > 0) setTimeout(() => sfx.newBest(), 1400);
    musicEnergy(0.5);
    slots = [null, null, null]; syncCustomers();
    scene?.clear(); have = [0, 0];
  }

  /** opened from the Arcade, Back goes there; otherwise to the area's map */
  const fromArcade = game.gameFrom === 'arcade';
  game.gameFrom = 'map';
  const backTo = fromArcade ? 'the Arcade' : AREA.ratios.name;
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; slots = [null, null, null]; syncCustomers(); active = null; msg = null; rush = false; scene?.clear(); have = [0, 0]; return; }
    if (fromArcade) { game.go('arcade'); return; }
    game.mathArea = 'ratios'; game.mathOp = null; game.setHome('math'); game.go('map');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); quit(); }
    if (phase === 'play') {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); blend(); }
      else if (e.key === 'Backspace') { e.preventDefault(); if (have[0]) take(0); else take(1); }
      else if (e.key === '1') add(0);
      else if (e.key === '2') add(1);
      else if (e.key === '!') take(0);
      else if (e.key === '@') take(1);
    } else if (e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const patience = (c: Cust | null) => (c ? Math.max(0, 1 - c.waited / c.order.patienceMs) : 0);
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  const fruitImg = (f: string) => `${base}math/ratios/fruit/${f}.webp`;
  const rushAt = RUSH.map(([a, b]) => [a / ROUND_MS, b / ROUND_MS]);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen stand" class:rush style:background-image="url({base}math/ratios/stand.webp)">
  <canvas class="three" bind:this={canvas}></canvas>

  <!-- the order bubbles over the customers' heads -->
  {#each slots as c, i (i)}
    {#if c && heads[i] && phase === 'play'}
      {@const isOn = i === active}
      {@const o = c.order}
      <div class="bubble" class:on={isOn} class:leaving={c.leaving} style:left="clamp(var(--edge), {heads[i]!.x}px, calc(100% - var(--edge)))" style:top="max({heads[i]!.y}px, var(--btop))" style:--pat={patience(c)} aria-label={orderText(o)}>
        <div class="bin">
          {#if o.kind === 'percent'}
            <span class="scoops"><b>{o.scoops}</b><small>scoops</small></span>
            <span class="pct"><b>{o.pct}%</b><img src={fruitImg(o.fruits[0])} alt={FRUIT[o.fruits[0]].many} /></span>
            <span class="rest"><small>rest</small><img src={fruitImg(o.fruits[1])} alt={FRUIT[o.fruits[1]].many} /></span>
          {:else}
            <span class="mix">
              <span class="fr"><b>{o.recipe[0]}</b><img src={fruitImg(o.fruits[0])} alt={FRUIT[o.fruits[0]].many} /></span>
              <i>:</i>
              <span class="fr"><b>{o.recipe[1]}</b><img src={fruitImg(o.fruits[1])} alt={FRUIT[o.fruits[1]].many} /></span>
            </span>
            {#if o.kind === 'fill'}
              <span class="inn"><small>in</small><b>{o.start[1]}</b><img src={fruitImg(o.fruits[1])} alt="" /></span>
            {:else}
              <span class="cups"><b>×{o.cups}</b><span class="cupimgs">{#each Array(o.cups) as _, k (k)}<img src="{base}math/ratios/tile.webp" alt="" />{/each}</span></span>
            {/if}
          {/if}
        </div>
        {#if isOn && !c.leaving}<span class="ring" aria-hidden="true"></span>{/if}
      </div>
    {/if}
  {/each}

  <div class="top">
    <button class="back" onclick={quit} aria-label={phase === 'play' ? 'Stop the round' : `Back to ${backTo}`}><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/ratios/tile.webp" alt="" /><b>Smoothie Stand</b>{#if daily}<small>Today's challenge</small>{/if}</div>
    {#if phase === 'play'}
      <div class="score"><small>Score</small><b>{score}</b></div>
      <div class="meter" title="Stars at {STAR_AT.join(', ')}">
        <i style:width="{meter * 100}%"></i>
        {#each STAR_AT as s}<img class:on={score >= s} style:left="{(s / STAR_AT[2]) * 100}%" src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
      {#if combo > 1}{#key combo}<div class="combo">Combo ×{comboMult(combo)}</div>{/key}{/if}
      {#if rush}<div class="rushchip">Rush hour ×2</div>{/if}
      <div class="clock" class:low={secs <= 15} style:--k={left / ROUND_MS}>
        <span>{secs}</span>
        {#each rushAt as [a, b], k (k)}<i class="rz" class:past={elapsed / ROUND_MS > b} style:--a="{a * 360}deg" style:--b="{b * 360}deg"></i>{/each}
      </div>
    {/if}
  </div>

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop">{pop.text}{#if pop.tip}<small><img src="{base}game/icon-shell.webp" alt="" /> tip!</small>{/if}</div>{/key}{/if}
  {#if banner && phase === 'play'}{#key banner.key}<div class="banner"><img src="{base}math/ratios/tile.webp" alt="" /><b>{banner.text}</b></div>{/key}{/if}

  {#if phase === 'play' && order}
    <div class="bottom">
      <div class="fruits" role="group" aria-label="Fruit">
        {#each [0, 1] as const as i (i)}
          {@const f = order.fruits[i]}
          {@const locked = order.kind === 'fill' && i === 1}
          <div class="fbtn" class:locked>
            <button class="add" onclick={() => add(i)} disabled={blending || locked} aria-label="Add a {FRUIT[f].one}">
              <img src={fruitImg(f)} alt="" />
              <span class="cnt" class:zero={!have[i]}>{have[i]}</span>
              <b>{FRUIT[f].many}</b>
              {#if !locked}<span class="kbd">{i + 1}</span>{/if}
            </button>
            {#if !locked}<button class="minus" onclick={() => take(i)} disabled={!have[i] || blending} aria-label="Take a {FRUIT[f].one} out">−</button>{:else}<span class="lockt">in already</span>{/if}
          </div>
        {/each}
      </div>
      <div class="actbar">
        <button class="btn clear" disabled={blending || (!have[0] && !(have[1] && order.kind !== 'fill'))} onclick={clearIt}>Clear</button>
        <button class="btn btn-primary blendb" disabled={active === null || blending || (!have[0] && !have[1])} onclick={blend}><img src="{base}math/ratios/tile.webp" alt="" />Blend! <span class="kbd">enter</span></button>
      </div>
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/ratios/tile.webp" alt="" />
        <h1>Smoothie Stand</h1>
        <p class="lead">The Juice Jungle is thirsty! Every Glimmer wants its smoothie mixed just right. Read the recipe, make it as big as they ask, and blend. Two minutes, as many smoothies as you can.</p>
        <ol class="how">
          <li><span class="mini"><b>2</b><img src={fruitImg('straw')} alt="" /><i>:</i><b>3</b><img src={fruitImg('banana')} alt="" /></span>The recipe: 2 strawberries for every 3 bananas.</li>
          <li><span class="mini"><b>×3</b><img src="{base}math/ratios/tile.webp" alt="" /></span>3 cups? Times both by 3: 6 strawberries, 9 bananas.</li>
          <li><span class="mini"><img src={fruitImg('mango')} alt="" /></span>Tap the fruit into the blender, then Blend!</li>
          <li><span class="mini"><Icon name="bolt" size={24} /></span>Quick ones get a tip. Rush hours score double!</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same customers all day</span></div>
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
        <h1>{o.stars === 3 ? 'Smoothie Champion!' : o.stars === 2 ? 'Super smoothies!' : o.stars === 1 ? 'Stand closed!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{served}</b><small>smoothies</small></div>
          <div><b>{tips}</b><small>tips</small></div>
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
  .stand { --btop: 210px; --edge: 90px; background-size: cover; background-position: center 45%; background-color: #f6d9a0; user-select: none; -webkit-user-select: none; }
  .stand::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(255, 120, 60, .0)); transition: background .6s; }
  .stand.rush::after { background: radial-gradient(ellipse at 50% 40%, transparent 50%, rgba(255, 110, 90, .28)); }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 6px; box-shadow: var(--shadow-sm); }
  .title img { width: 34px; height: 44px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #d4502a; }
  .title small { font: 800 11px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #ffb0c8, #f07a3a); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#4fcf9f, #23966a); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(20, 110, 70, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  .rushchip { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(#ff8a6b, #e0452a); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 0 20px rgba(255, 110, 60, .7); animation: throb .9s ease-in-out infinite; }
  @keyframes throb { 50% { transform: scale(1.08); } }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { position: relative; margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { position: relative; z-index: 1; width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  /* the rush hours, as red arcs round the clock (it counts down anticlockwise from the top) */
  .rz { position: absolute; inset: -4px; border-radius: 50%; background: conic-gradient(from calc(360deg - var(--b)), rgba(240, 80, 60, .9) 0 calc(var(--b) - var(--a)), transparent 0); -webkit-mask: radial-gradient(circle, transparent 33px, #000 34px); mask: radial-gradient(circle, transparent 33px, #000 34px); }
  .rz.past { opacity: .25; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .bubble { position: absolute; z-index: 3; transform: translate(-50%, calc(-100% - 10px)); pointer-events: none; transition: opacity .3s, transform .3s; }
  .bin { position: relative; display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 22px; padding: 6px 12px; box-shadow: 0 6px 16px rgba(80, 40, 10, .3); opacity: .8; transform: scale(.85); transform-origin: bottom center; transition: transform .25s; }
  .bin::after { content: ''; position: absolute; left: 50%; bottom: -9px; width: 18px; height: 18px; background: #fff; transform: translateX(-50%) rotate(45deg); border-radius: 3px; }
  .bubble.on .bin { opacity: 1; transform: scale(1.05); box-shadow: 0 0 0 4px #ffb0c8, 0 0 30px rgba(255, 140, 170, .9), 0 8px 20px rgba(80, 40, 10, .35); animation: glowb 1.4s ease-in-out infinite; }
  .stand.rush .bubble.on .bin { box-shadow: 0 0 0 4px #ff8a6b, 0 0 34px rgba(255, 110, 60, 1), 0 8px 20px rgba(80, 40, 10, .35); }
  @keyframes glowb { 50% { box-shadow: 0 0 0 5px #ffb0c8, 0 0 44px rgba(255, 140, 170, 1), 0 8px 20px rgba(80, 40, 10, .35); } }
  .bubble.leaving { opacity: 0; transform: translate(-50%, calc(-100% - 40px)); }
  .mix { position: relative; z-index: 1; display: flex; align-items: center; gap: 4px; background: #fff6e8; border-radius: 16px; padding: 2px 8px; box-shadow: inset 0 0 0 2px #ffd9b0; }
  .mix i { font: 600 26px var(--font-ui); color: #d4502a; font-style: normal; }
  .fr { display: flex; align-items: center; gap: 1px; }
  .fr b, .cups b, .inn b, .pct b, .scoops b { font: 600 26px var(--font-ui); color: var(--ink); }
  .fr img, .inn img, .pct img, .rest img { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(60, 30, 10, .25)); }
  .cups, .inn, .pct, .rest, .scoops { position: relative; z-index: 1; display: flex; align-items: center; gap: 3px; }
  .cups b { color: #d4502a; }
  .cupimgs { display: flex; }
  .cupimgs img { width: 18px; height: 28px; object-fit: contain; margin-left: -4px; }
  .inn { background: #e9f8ef; border-radius: 12px; padding: 0 6px; box-shadow: inset 0 0 0 2px #9fdcb8; }
  .inn small, .rest small, .scoops small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .scoops { flex-direction: column; gap: 0; line-height: 1; }
  .pct b { color: #d4502a; }
  .ring { position: absolute; left: 50%; bottom: -40px; transform: translateX(-50%); width: 120px; height: 10px; border-radius: 999px; background: linear-gradient(90deg, #4fcf9f calc(var(--pat) * 100%), rgba(255, 255, 255, .7) 0); box-shadow: 0 0 0 2px #fff; }

  .msg { position: absolute; left: 50%; top: 84px; transform: translateX(-50%); z-index: 6; font: 600 20px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 680px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 38%; transform: translate(-50%, -50%); z-index: 6; display: flex; flex-direction: column; align-items: center; font: 600 44px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #d4502a, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.2s ease-out forwards; pointer-events: none; white-space: nowrap; }
  .pop small { display: flex; align-items: center; gap: 4px; font-size: 22px; text-shadow: 0 2px 0 #2f9a60; }
  .pop small img { width: 24px; height: 24px; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }
  .banner { position: absolute; left: 50%; top: 34%; z-index: 7; display: flex; align-items: center; gap: 12px; padding: 12px 28px 12px 16px; border-radius: 999px; background: linear-gradient(#ff9f6b, #e0452a); box-shadow: 0 0 0 5px #fff, 0 12px 40px rgba(200, 60, 30, .5); animation: slam 2.4s cubic-bezier(.3, .8, .4, 1.2) forwards; pointer-events: none; }
  .banner img { width: 44px; height: 56px; object-fit: contain; }
  .banner b { font: 600 34px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #a8321a; white-space: nowrap; }
  @keyframes slam { 0% { transform: translate(-50%, -50%) scale(2.2) rotate(-6deg); opacity: 0; } 14% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; } 80% { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; } 100% { transform: translate(-50%, -90%) scale(.9) rotate(-3deg); opacity: 0; } }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: flex-end; justify-content: center; gap: 18px; padding: 10px 14px 16px; pointer-events: none; }
  .bottom > * { pointer-events: auto; }
  .fruits { display: flex; gap: 10px; background: rgba(255, 250, 238, .94); border-radius: 26px; padding: 8px 10px; box-shadow: var(--shadow-sm); }
  .fbtn { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .add { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0; border: 0; cursor: pointer; background: #fff; border-radius: 20px; padding: 6px 14px 4px; min-width: 112px; box-shadow: 0 4px 0 #f2c9a0; transition: transform .1s; }
  .add:hover:not(:disabled) { transform: translateY(-2px); }
  .add:active:not(:disabled) { transform: translateY(2px); box-shadow: 0 2px 0 #f2c9a0; }
  .add img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(80, 50, 10, .3)); }
  .add b { font: 700 14px var(--font-body); color: var(--ink2); text-transform: capitalize; }
  .cnt { position: absolute; top: 2px; right: 6px; min-width: 34px; height: 34px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; font: 600 22px var(--font-ui); color: #fff; background: #f07a3a; box-shadow: 0 0 0 3px #fff; }
  .cnt.zero { background: #cfc3b3; }
  .add .kbd { position: absolute; top: 4px; left: 6px; }
  .minus { width: 46px; height: 32px; border: 0; border-radius: 12px; background: #fff; box-shadow: 0 3px 0 #e6d6c2; font: 600 24px/1 var(--font-ui); color: var(--ink2); cursor: pointer; }
  .minus:disabled, .add:disabled { opacity: .55; cursor: default; }
  .locked .add { background: #e9f8ef; box-shadow: 0 4px 0 #9fdcb8; opacity: 1; }
  .lockt { font: 800 11px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .05em; height: 32px; display: grid; place-items: center; }
  .actbar { display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
  .clear { font-size: 18px; padding: 10px 18px; border-radius: 18px; }
  .blendb { display: flex; align-items: center; gap: 8px; font-size: 28px; padding: 12px 30px 12px 18px; border-radius: 24px; background: linear-gradient(#ff9fbf, #ef5f8a); border-color: #d84a76; box-shadow: 0 5px 0 #b8385e; }
  .blendb img { width: 30px; height: 40px; object-fit: contain; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(60, 40, 10, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(580px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 120px; height: 150px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(160, 60, 40, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #d4502a; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #fff4ec; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .mini { flex: none; min-width: 64px; height: 50px; padding: 0 6px; border-radius: 12px; background: #fff; display: flex; align-items: center; justify-content: center; gap: 1px; box-shadow: 0 0 0 2px #ffd9b0; }
  .mini b { font: 600 18px var(--font-ui); color: var(--ink); }
  .mini i { font: 600 18px var(--font-ui); font-style: normal; color: #d4502a; margin: 0 2px; }
  .mini img { width: 30px; height: 34px; object-fit: contain; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff4ec; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #ff8fb0, #f07a3a); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #fff4ec; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* short laptop screens */
  @media (max-height: 760px) and (min-width: 761px) {
    .stand { --btop: 170px; }
    .add img { width: 52px; height: 52px; }
    .blendb { font-size: 24px; padding: 10px 24px 10px 14px; }
  }
  /* a phone */
  @media (max-width: 760px) {
    .stand { --btop: 230px; --edge: 76px; background-position: 50% 40%; }
    .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
    .title { padding: 3px; } .title b, .title small { display: none; } .title img { width: 30px; height: 38px; }
    .back { width: 38px; height: 38px; }
    .score { min-width: 64px; padding: 2px 10px; } .score b { font-size: 22px; }
    .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
    .clock { width: 50px; height: 50px; } .clock span { width: 38px; height: 38px; font-size: 18px; }
    .rz { -webkit-mask: radial-gradient(circle, transparent 27px, #000 28px); mask: radial-gradient(circle, transparent 27px, #000 28px); }
    .combo, .rushchip { font-size: 15px; padding: 3px 10px; }
    .msg { top: 112px; font-size: 16px; }
    .bin { gap: 4px; padding: 4px 8px; }
    .fr b, .cups b, .inn b, .pct b, .scoops b { font-size: 20px; }
    .fr img, .inn img, .pct img, .rest img { width: 30px; height: 30px; }
    .mix i { font-size: 20px; }
    .cupimgs { display: none; }
    .bottom { flex-direction: column; align-items: center; gap: 8px; padding-bottom: 12px; }
    .actbar { flex-direction: row; }
    .add { min-width: 0; width: 118px; padding: 4px 8px 2px; }
    .add img { width: 50px; height: 50px; }
    .add .kbd { display: none; }
    .blendb { font-size: 22px; padding: 10px 22px 10px 14px; }
    .blendb .kbd { display: none; }
    .hero { width: 90px; height: 110px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; }
    .banner b { font-size: 24px; }
    .facts b { font-size: 20px; }
  }
</style>
