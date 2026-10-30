<script lang="ts">
  // Shape Shifter: the shapes and angles arcade game over the crystal peaks. A rule card says which
  // crystals to catch ("Triangles", "4 equal sides", "An obtuse angle"); crystal shapes drift down the sky.
  // Tap the ones that fit and they fly into the crystal basket; tap one that doesn't and it shatters (the
  // combo goes); let one that fits fall past and the combo goes too. Every few catches a new rule. Ninety
  // seconds a round: combos, three stars, a best score and today's challenge. The rules and scoring are in
  // math/shapes/shifter.ts; the 3D in three/shifterScene.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShifterScene } from '../three/shifterScene';
  import type { Profile } from '../engine/profile';
  import { RULE, ROUND_MS, RULE_CATCHES, RULE_MS, Round, STAR_AT, applyShifter, catchScore, comboMult, dailyBestOf, dailySeed, levelsFor, makePiece, rulesFor, shifterOf, starsFor, type Piece, type RuleId, type ShifterOutcome } from '../math/shapes/shifter';
  import { mulberry32 } from '../engine/rng';
  import ShapePic from '../math/shapes/ui/ShapePic.svelte';
  import type { Fig } from '../math/shapes/fig';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import { FRIEND } from '../art/cast';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);

  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), caught = $state(0), wrong = 0;
  let left = $state(ROUND_MS);
  let rule = $state<RuleId>('triangles');
  let ruleCatches = $state(0);
  let ruleKey = $state(0);
  let example = $state<Fig | null>(null);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pops = $state<{ text: string; x: number; y: number; key: number }[]>([]);
  let outcome = $state<ShifterOutcome | null>(null);
  let burst = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: ShifterScene | null = null;
  let round: Round | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  const pieces = new Map<number, Piece & { rule: RuleId; rung: number }>();
  let nextId = 1, lastLane = 0.5;
  let t0 = 0, raf = 0, nextSpawn = 0, ruleAt = 0, pauseUntil = 0;
  let disposed = false;

  const rec = $derived(shifterOf(p));
  const todayBest = $derived(dailyBestOf(p));

  onMount(() => {
    // this game draws its own 3D over the painted peaks: the shared stage rests meanwhile
    stage.use(null);
    if (canvas) ShifterScene.create(canvas).then(s => {
      if (disposed) { s.dispose(); return; }
      scene = s; s.onFell = fell;
      // (for checking: the crystals in the sky, whether each fits, and where it is)
      if (import.meta.env.DEV) (window as unknown as { __shifter: object }).__shifter = { scene: s, pieces: () => [...pieces.entries()].map(([id, pc]) => ({ id, fits: pc.fits, name: pc.name, at: s.screenOf(id) })) };
      raf = requestAnimationFrame(tick);
    });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }
  /** an example of what fits, for the rule card (naming rules show one; the rest are words) */
  function exampleFor(r: RuleId): Fig | null {
    const pc = makePiece(mulberry32(7 + r.length), r, true, 1);
    const pts = pc.pts.map(([x, y]) => [x * 3 + 5, y * 3 + 5] as [number, number]);
    return pc.round ? { w: 10, h: 10, circles: [{ c: [5, 5], r: 3.6, hue: 'gold' }] } : { w: 10, h: 10, polys: [{ pts, hue: 'gold' }] };
  }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    round = new Round(seed, rulesFor(p), levelsFor(p));
    score = 0; combo = 0; bestCombo = 0; caught = 0; wrong = 0; answers = []; pieces.clear();
    left = ROUND_MS; outcome = null; msg = null; pops = [];
    scene?.clear();
    phase = 'play';
    startMusic('adventure');
    t0 = performance.now(); nextSpawn = t0 + 900; pauseUntil = 0;
    showRule(round.rule, true);
  }
  function showRule(r: RuleId, first = false) {
    rule = r; ruleCatches = 0; ruleKey++; ruleAt = performance.now();
    example = exampleFor(r);
    if (!first) { sfx.twinkle(); scene?.cheer(); }
    say(RULE[r].say, 'tip');
  }
  function newRule() {
    if (!round) return;
    // the sky clears (the crystals were for the old rule), a moment's pause, then the new rule's
    for (const id of [...pieces.keys()]) scene?.shatter(id);
    pieces.clear();
    const now = performance.now();
    pauseUntil = now + 1300; nextSpawn = pauseUntil;
    showRule(round.nextRule());
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (phase !== 'play' || !scene || !round) return;
    const el = now - t0;
    left = Math.max(0, ROUND_MS - el);
    if (left <= 0) { finish(); return; }
    // faster as the round goes on
    const k = el / ROUND_MS, gap = 1250 - 450 * k, fall = 6600 - 2000 * k;
    if (now >= nextSpawn && now >= pauseUntil) {
      const pc = round.piece(), id = nextId++;
      lastLane = round.lane(lastLane);
      pieces.set(id, { ...pc, rule: round.rule, rung: round.rung });
      scene.spawn(id, pc.pts, pc.tint, lastLane, fall, pc.round);
      nextSpawn = now + gap;
    }
    if (now - ruleAt > RULE_MS && now >= pauseUntil) newRule();
  }

  function pop(text: string, at: { x: number; y: number } | null) {
    if (!at) return;
    const key = Date.now() + Math.random();
    pops = [...pops.slice(-4), { text, x: at.x, y: at.y, key }];
    setTimeout(() => { pops = pops.filter(x => x.key !== key); }, 1000);
  }
  function onPointer(e: PointerEvent) {
    if (phase !== 'play' || !scene) return;
    const id = scene.pickAt(e.clientX, e.clientY);
    if (id === null) return;
    const pc = pieces.get(id); if (!pc) return;
    const at = scene.screenOf(id), ms = scene.ageOf(id);
    pieces.delete(id);
    answers.push({ key: RULE[pc.rule].key, ok: pc.fits, thinkMs: ms, rung: pc.rung });
    if (pc.fits) {
      const pts = catchScore(combo);
      score += pts; combo++; caught++; ruleCatches++; bestCombo = Math.max(bestCombo, combo);
      scene.catchIt(id);
      sfx.catchPop(combo);
      musicEnergy(Math.min(1, 0.4 + combo * 0.07));
      pop(`+${pts}`, at);
      if (combo > 0 && combo % 5 === 0) { sfx.perfect(); scene.cheer(); say(`${combo} in a row!`, 'good'); }
      if (starsFor(score) > starsFor(score - pts)) { burst++; sfx.star(starsFor(score) - 1); }
      if (ruleCatches >= RULE_CATCHES) setTimeout(() => { if (phase === 'play') newRule(); }, 450);
    } else {
      combo = 0; wrong++;
      scene.shatter(id);
      sfx.crack(2);
      musicEnergy(0.4);
      say(`Not that one: ${pc.name}. ${cap(pc.why)}.`, 'oops');
    }
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  function fell(id: number) {
    const pc = pieces.get(id); if (!pc) return;
    pieces.delete(id);
    if (pc.fits && phase === 'play') { combo = 0; sfx.fizzle(); say(`One got away: ${pc.name}! Catch the ${RULE[pc.rule].word.toLowerCase()}.`, 'oops'); }
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done';
    sfx.timeUp(); sfx.complete();
    scene?.clear(); pieces.clear();
    const out = applyShifter($state.snapshot(game.profile!) as Profile, { score, caught, wrong, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
  }
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; scene?.clear(); pieces.clear(); msg = null; return; }
    game.mathArea = 'shapes'; game.mathOp = null; game.setHome('math'); game.go('map');
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); quit(); }
    else if (phase !== 'play' && e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
</script>

<svelte:window onkeydown={onKey} />

<div class="screen shifter" style:background-image="url({base}math/shapes/bg-shifter.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={onPointer}></canvas>

  {#each pops as pp (pp.key)}<div class="pop" style:left="{pp.x}px" style:top="{pp.y}px">{pp.text}</div>{/each}

  <div class="top">
    <button class="back" onclick={quit} aria-label={phase === 'play' ? 'Stop the round' : 'Back to Shapes and angles'}><Icon name="back" size={26} /></button>
    <div class="title"><img src="{base}math/shapes/tile.webp" alt="" /><b>Shape Shifter</b>{#if daily}<small>Today's challenge</small>{/if}</div>
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

  {#if phase === 'play'}
    {#key ruleKey}
      <div class="rule">
        {#if example && RULE[rule].skill === 'sh-name'}<span class="ex"><ShapePic fig={example} size={58} /></span>{/if}
        <span class="rtext"><small>Catch</small><b>{RULE[rule].word}</b></span>
        <span class="dots" aria-label="{ruleCatches} of {RULE_CATCHES} to the next rule">{#each Array(RULE_CATCHES) as _, i}<i class:on={i < ruleCatches}></i>{/each}</span>
      </div>
    {/key}
  {/if}
  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/shapes/tile.webp" alt="" />
        <h1>Shape Shifter</h1>
        <p class="lead">Crystal shapes are falling from the peaks! Catch the ones that fit the rule and fill your crystal basket. Ninety seconds, as many as you can.</p>
        <ol class="how">
          <li><span class="tagw">Catch</span>The card at the top says which shapes to catch.</li>
          <li><span><img src="{base}math/shapes/tile.webp" alt="" /></span>Tap a crystal that fits. Tap a wrong one and it shatters!</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Every {RULE_CATCHES} catches, a new rule.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same crystals all day</span></div>
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
        <h1>{o.stars === 3 ? 'Crystal Champion!' : o.stars === 2 ? 'Sparkling catching!' : o.stars === 1 ? 'Basket full!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{caught}</b><small>crystals caught</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <div class="xp">
          <span>{FRIEND[p.buddy].name} <Icon name="heart" size={16} /> +{o.xp.gained} XP</span>
          {#if o.shells}<span><img src="{base}game/icon-shell.webp" alt="" /> +{o.shells} shells</span>{/if}
          {#each o.stickers as s}<span><Icon name="sticker" size={16} /> {s.name}</span>{/each}
        </div>
        <div class="acts">
          <button class="btn" onclick={quit}>Back to Shapes</button>
          {#if !daily}<button class="btn" onclick={() => start(true)}>Today's challenge</button>{/if}
          <button class="btn btn-primary big" onclick={() => start(daily)}>Play again <span class="kbd">enter</span></button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .shifter { background-size: cover; background-position: center 40%; background-color: #cfe0ff; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }
  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #6f4ff0; }
  .title small { font: 800 11px var(--font-body); color: #1f9c8c; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #b9a0ff, #6f4ff0); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#4fd6c4, #1f9c8c); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(20, 110, 100, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#8b62f5 calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  .rule { position: absolute; left: 50%; top: 78px; transform: translateX(-50%); z-index: 4; display: flex; align-items: center; gap: 12px; padding: 8px 20px 8px 10px; border-radius: 26px; background: linear-gradient(#fffdf6, #f3ecff); box-shadow: 0 0 0 4px #fff, 0 0 0 8px rgba(155, 123, 240, .45), 0 10px 26px rgba(70, 40, 140, .3); animation: ruleIn .55s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  @keyframes ruleIn { from { transform: translateX(-50%) scale(.5) rotate(-6deg); opacity: 0; } }
  .ex { display: grid; place-items: center; }
  .rtext { display: flex; flex-direction: column; line-height: 1.05; }
  .rtext small { font: 800 12px var(--font-body); color: #1f9c8c; text-transform: uppercase; letter-spacing: .08em; }
  .rtext b { font: 600 32px var(--font-ui); color: #4a2eb5; white-space: nowrap; }
  .dots { display: flex; gap: 5px; margin-left: 4px; }
  .dots i { width: 13px; height: 13px; border-radius: 50%; background: #e6defa; box-shadow: inset 0 1px 2px rgba(60, 30, 120, .2); }
  .dots i.on { background: radial-gradient(circle at 35% 35%, #fff6c8, #ffc93d 60%, #e09a0e); box-shadow: 0 0 8px rgba(255, 200, 60, .9); }

  .msg { position: absolute; left: 50%; bottom: 26px; transform: translateX(-50%); z-index: 6; font: 600 19px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 640px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, 16px); opacity: 0; } }
  .pop { position: absolute; z-index: 6; transform: translate(-50%, -50%); font: 600 36px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #6f4ff0, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } to { transform: translate(-50%, -190%); opacity: 0; } }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(40, 30, 80, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 150px; height: 140px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(90, 60, 160, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #6f4ff0; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #f6f1ff; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #e2d8ff; }
  .how img { width: 38px; height: 38px; object-fit: contain; }
  .how .tagw { font: 600 13px var(--font-ui); color: #4a2eb5; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #f3eeff; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #1f9c8c; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #4fd6c4, #8b62f5); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #f6f1ff; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }
  .xp { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .xp span { display: inline-flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 5px 12px; font: 700 14px var(--font-body); color: var(--ink2); }
  .xp img { width: 20px; height: 20px; }

  @media (max-width: 760px) {
    .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
    .title { padding: 3px; } .title b, .title small { display: none; } .title img { width: 32px; height: 32px; }
    .back { width: 38px; height: 38px; }
    .score { min-width: 64px; padding: 2px 10px; } .score b { font-size: 22px; }
    .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
    .clock { width: 50px; height: 50px; } .clock span { width: 38px; height: 38px; font-size: 18px; }
    .combo { font-size: 15px; padding: 3px 10px; }
    .rule { top: 104px; padding: 6px 14px 6px 8px; gap: 8px; }
    .rtext b { font-size: 24px; }
    .dots i { width: 10px; height: 10px; }
    .msg { font-size: 15px; bottom: 16px; }
    .hero { width: 110px; height: 100px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; }
  }
</style>
