<script lang="ts">
  // Balance Beam: the expressions and equations arcade game on the Star Lab's rooftop. Mystery boxes and
  // weights drop onto a golden seesaw; it starts to tip, and you type what one box weighs before it goes
  // over. Right: the boxes light up, the beam swings level, star dust, and a box lands on the Star Stack
  // (a bonus every 5 in a row). Wrong: a jolt, and the stack tumbles. 90 seconds: combos, a quick bonus,
  // three stars, a best score and today's challenge. The rules are in math/algebra/beam.ts.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { DAILY_SHELLS } from '../engine/settle';
  import { clearOldLine } from '../arcade/feedback';
  import { exitsOf } from '../arcade/exits';
  import ExitButtons from '../arcade/ui/ExitButtons.svelte';
  import GameEndButtons from '../path/GameEndButtons.svelte';
  import { endEnter } from '../path/next';
  import PauseButton from '../ui/PauseButton.svelte';
  import { sfx, startMusic, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { BalanceScene } from '../three/balanceScene';
  import { mulberry32 } from '../engine/rng';
  import type { Profile } from '../engine/profile';
  import { JOLT, ROUND_MS, STACK_EVERY, STAR_AT, applyBeam, beamOf, comboMult, dailyBestOf, dailySeed, kindsFor, levelsFor, puzzleHow, puzzleMaker, puzzleScore, puzzleText, starsFor, type BeamOutcome, type Puzzle } from '../math/algebra/beam';
  import Expr from '../math/skills/ui/Expr.svelte';
  import NumPad from '../math/ui/NumPad.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);

  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let z = $state<Puzzle | null>(null);
  let typed = $state(''), bad = $state(false), solved = $state(false);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), right = $state(0), tipped = 0;
  let left = $state(ROUND_MS), tip = $state(0);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number; big?: boolean } | null>(null);
  let outcome = $state<BeamOutcome | null>(null);
  let burst = $state(0);
  let w = $state(1280), h = $state(800);
  const narrow = $derived(w < 760);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: BalanceScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let next = puzzleMaker(1, ['add']);
  let dirRng = mulberry32(1);
  let dir: -1 | 1 = 1, jolt = 0, tries = 0, n = 0;
  let t0 = 0, last = 0, raf = 0, zAt = 0;
  /** the Pause card (ui/PauseButton.svelte): the round's clock stops while it's open */
  let held = 0;
  function hold() { if (phase === 'play' && !held) held = performance.now(); }
  function unhold() { if (!held) return; const d = performance.now() - held; t0 += d; last += d; zAt += d; held = 0; }
  let disposed = false;
  let stackTop = $state<{ x: number; y: number } | null>(null);

  const rec = $derived(beamOf(p));
  const todayBest = $derived(dailyBestOf(p));

  onMount(() => {
    // this game draws its own 3D (the terrace isn't an island): the shared stage rests meanwhile
    stage.use(null);
    if (canvas) BalanceScene.create(canvas).then(s => { if (disposed) s.dispose(); else { scene = s; if (import.meta.env.DEV) (window as unknown as { __beam: BalanceScene }).__beam = s; raf = requestAnimationFrame(tick); } });
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    next = puzzleMaker(seed, kindsFor(p), levelsFor(p));
    dirRng = mulberry32(seed ^ 0x2b7e15);
    score = 0; combo = 0; bestCombo = 0; right = 0; tipped = 0; n = 0; answers = [];
    left = ROUND_MS; outcome = null; msg = null;
    scene?.clear();
    phase = 'play';
    startMusic('ridge');
    t0 = performance.now(); last = t0;
    drop();
    say('Type what one box weighs, before it tips!');
  }
  function drop() {
    if (phase !== 'play') return;
    z = next(); n++;
    // the last puzzle's line goes (the first keeps the how-to tip)
    if (n > 1) clearOldLine(() => msg, () => (msg = null));
    typed = ''; bad = false; solved = false; tries = 0; jolt = 0; tip = 0;
    dir = dirRng() < 0.5 ? -1 : 1;
    zAt = performance.now() + 500;
    scene?.load(z.boxes, z.left, z.right);
    sfx.whoosh();
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    stackTop = phase === 'play' && combo > 0 ? scene.stackTop() : null;
    if (phase !== 'play' || !z) return;
    if (held) return;
    last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (!solved) {
      tip = Math.max(0, Math.min(1, (now - zAt) / z.tipMs + jolt));
      scene.setTip(dir * (tip < 0.75 ? tip * 0.55 : 0.41 + (tip - 0.75) * 2.36));
      if (tip >= 1) tipOver();
    }
    if (left <= 0) finish();
  }
  function tipOver() {
    if (!z) return;
    solved = true;
    if (!tries) answers.push({ key: z.key, ok: false, thinkMs: z.tipMs, rung: z.rung });
    combo = 0; tipped++;
    scene?.crash(); sfx.crash?.(); musicEnergy(0.4);
    say(`It tipped over! One box weighed ${z.ans}.`, 'oops');
    setTimeout(drop, 1300);
  }

  function digit(d: string) {
    if (phase !== 'play' || !z || solved || d === '.' || d === '-') return;
    bad = false;
    const want = String(z.ans).length;
    if (typed.length >= want) typed = '';
    typed += d; sfx.click();
    if (typed.length === want) submit();
  }
  function back() { if (!solved) { bad = false; typed = typed.slice(0, -1); } }
  function submit() {
    if (phase !== 'play' || !z || solved || !typed) return;
    const ok = Number(typed) === z.ans, ms = performance.now() - zAt;
    if (!tries) answers.push({ key: z.key, ok, thinkMs: ms, rung: z.rung });
    if (ok) {
      solved = true;
      const pts = puzzleScore(z, combo, ms);
      const was = score;
      score += pts; combo++; right++; bestCombo = Math.max(bestCombo, combo);
      musicEnergy(Math.min(1, 0.4 + combo * 0.08));
      const stacked = combo % STACK_EVERY === 0;
      pop = { text: stacked ? `Star Stack! +${pts}` : `+${pts}`, key: Date.now(), big: stacked };
      sfx.cheer(); sfx.twinkle();
      if (stacked) sfx.perfect();
      scene?.solve(z.ans);
      say(z.boxes === 1 ? `□ = ${z.ans}. Level!` : `x = ${z.ans}. Level!`, 'good');
      if (starsFor(score) > starsFor(was)) { burst++; sfx.star(starsFor(score) - 1); }
      setTimeout(drop, 1250);
    } else {
      tries++; combo = 0; bad = true;
      jolt += JOLT;
      scene?.wrong(); sfx.nope();
      say(tries > 1 ? puzzleHow(z) : `Not ${typed}. ${z.left ? `Take ${z.left} off both sides first.` : `Share ${z.right} between the ${z.boxes} boxes.`}`, 'oops');
      setTimeout(() => { if (bad) { typed = ''; bad = false; } }, 650);
    }
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; z = null;
    sfx.complete();
    const out = applyBeam($state.snapshot(game.profile!) as Profile, { score, solved: right, tipped, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
    scene?.clear();
  }
  /** where it was opened from: Back goes there, and its cards offer the Arcade too */
  const exits = exitsOf('algebra');
  const backTo = exits.backTo;
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; z = null; msg = null; scene?.clear(); return; }
    exits.back();
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (phase === 'done' && e.key === 'Enter' && endEnter(game.profile, 'game:balance')) { e.preventDefault(); return; }
    if (phase === 'play') {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); back(); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    } else if (e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  const letter = $derived(z && z.boxes > 1 ? 'x' : '□');
</script>

<svelte:window onkeydown={onKey} onresize={onResize} bind:innerWidth={w} bind:innerHeight={h} />

<div class="screen beam" class:narrow style:background-image="url({base}math/algebra/bg.webp)">
  <canvas class="three" bind:this={canvas}></canvas>

  <PauseButton onpause={hold} onresume={unhold} />
  <div class="top">
    <div class="title"><img src="{base}math/algebra/tile.webp" alt="" /><b>Balance Beam</b>{#if daily}<small>Today's challenge</small>{/if}</div>
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

  {#if phase === 'play' && z}
    {#key n}
      <div class="eq" class:solved class:danger={tip > 0.7 && !solved} style:--tip={tip}>
        <span class="line"><Expr s={puzzleText(z)} /></span>
        <span class="ask"><Expr s="{letter} =" /><span class="box" class:bad class:good={solved && !bad}>{solved && !typed ? z.ans : typed}</span></span>
        <span class="tipbar"><i></i></span>
      </div>
    {/key}
    {#if stackTop && combo > 0}<div class="stack" style:left="{stackTop.x}px" style:top="{stackTop.y}px">{#key combo}<b>{combo}</b>{/key}<small>{combo % STACK_EVERY === 0 ? 'Star Stack!' : `${STACK_EVERY - (combo % STACK_EVERY)} to a bonus`}</small></div>{/if}
  {/if}

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop" class:big={pop.big}>{pop.text}</div>{/key}{/if}

  {#if phase === 'play'}
    <div class="bottom">
      <div class="pad"><NumPad ondigit={digit} onback={back} compact={narrow} disabled={!z || solved} /></div>
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/algebra/tile.webp" alt="" />
        <h1>Balance Beam</h1>
        <p class="lead">Mystery boxes land on the Star Lab's golden seesaw. All the boxes weigh the same. Say what one weighs before it tips over!</p>
        <ol class="how">
          <li><span><img src="{base}math/algebra/box.webp" alt="" /></span>A box and weights on one side, weights on the other. It starts to tip!</li>
          <li><span class="sum"><Expr s="□ + 3 = 8" /></span>Take the same off both sides in your head. 8 take away 3: the box is 5.</li>
          <li><span><img src="{base}math/algebra/weight.webp" alt="" /></span>Type it fast. Two boxes? Share what's left between them.</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row builds the Star Stack: a bonus every 5!</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same puzzles all day</span><span class="tiny bonus">Beat {STAR_AT[1]} for {DAILY_SHELLS} bonus shells</span></div>
        </div>
        <div class="acts">
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
        <h1>{o.stars === 3 ? 'Star Lab Champion!' : o.stars === 2 ? 'Perfectly level!' : o.stars === 1 ? 'Nicely balanced!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{right}</b><small>boxes named</small></div>
          <div><b>{bestCombo}</b><small>tallest stack</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <PrizeRow {o} buddy={p.buddy} />
        <div class="acts">
          <GameEndButtons activity="game:balance" {exits} {daily} onagain={start} />
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .beam { background-size: cover; background-position: center 55%; background-color: #e9dcff; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 42px; height: 42px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #5b36c4; }
  .title small { font: 800 11px var(--font-body); color: #b7791f; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #c9a6ff, #8a5cf0, #ffd36b); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#a98cff, #6c4fd8); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(70, 40, 160, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#8a5cf0 calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  /* the puzzle: a glowing card over the beam, with a tip bar that fills as it goes over */
  .eq { position: absolute; left: 50%; top: 86px; transform: translateX(-50%); z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 26px 12px; border-radius: 26px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 4px #c9b0ff, 0 0 30px rgba(170, 130, 255, .6), 0 10px 24px rgba(50, 20, 120, .25); animation: land .45s cubic-bezier(.3, 1.5, .5, 1); }
  @keyframes land { from { transform: translate(-50%, -30px) scale(.8); opacity: 0; } }
  .eq.danger { box-shadow: 0 0 0 4px #ff9a7a, 0 0 30px rgba(255, 120, 90, .7), 0 10px 24px rgba(50, 20, 120, .25); animation: wob .4s ease-in-out infinite; }
  @keyframes wob { 50% { transform: translateX(-50%) rotate(-1.2deg); } }
  .eq.solved { box-shadow: 0 0 0 4px #ffd36b, 0 0 40px rgba(255, 210, 107, .9), 0 10px 24px rgba(50, 20, 120, .25); }
  .line { font-size: 46px; color: var(--ink); line-height: 1.05; }
  .ask { display: flex; align-items: center; gap: 10px; font-size: 34px; }
  .box { min-width: 76px; min-height: 52px; padding: 0 12px; border-radius: 16px; display: grid; place-items: center; font: 600 36px var(--font-ui); background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 6px #efe9ff; }
  .box.bad { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 6px #ffe0e8; animation: nope .4s ease; }
  .box.good { color: #fff; background: linear-gradient(#ffd36b, #f0a21b); box-shadow: inset 0 0 0 4px #fff3c4, 0 0 0 6px #ffe7a8; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .tipbar { width: 100%; height: 8px; border-radius: 99px; background: #efe9ff; overflow: hidden; }
  .tipbar i { display: block; height: 100%; width: calc(var(--tip) * 100%); border-radius: 99px; background: linear-gradient(90deg, #8a5cf0, #ff9a7a); }

  .stack { position: absolute; z-index: 3; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; pointer-events: none; }
  .stack b { font: 600 30px/1 var(--font-ui); color: #fff; text-shadow: 0 3px 0 #6c4fd8, 0 0 14px rgba(255, 210, 107, .9); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  .stack small { font: 800 11px var(--font-body); color: #fff; background: rgba(90, 50, 190, .8); border-radius: 99px; padding: 2px 8px; white-space: nowrap; }

  .msg { position: absolute; left: 50%; bottom: 196px; transform: translateX(-50%); z-index: 6; font: 600 20px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 640px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#a98cff, #6c4fd8); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, 16px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); z-index: 6; font: 600 44px var(--font-ui); color: #fff; text-shadow: 0 3px 0 #6c4fd8, 0 6px 18px rgba(0, 0, 0, .3); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  .pop.big { font-size: 56px; text-shadow: 0 3px 0 #b7791f, 0 0 24px rgba(255, 210, 107, .9); }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; justify-content: center; padding: 10px 14px 16px; pointer-events: none; }
  .pad { pointer-events: auto; background: rgba(255, 252, 245, .9); border-radius: 24px; padding: 8px 10px; box-shadow: var(--shadow-sm); }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(40, 20, 90, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 170px; height: 140px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(80, 40, 160, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #5b36c4; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #f5f1ff; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #ddd0ff; }
  .how li > span.sum { width: auto; padding: 0 8px; font-size: 18px; }
  .how img { width: 38px; height: 38px; object-fit: contain; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #f5f1ff; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .tiny.bonus { color: #a86a00; font-weight: 700; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #b7791f; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #8a5cf0, #e6a817); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #f5f1ff; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* a phone: the puzzle card a little smaller, the pad as a block at the bottom */
  .narrow .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
  .narrow .title { padding: 3px; } .narrow .title b, .narrow .title small { display: none; } .narrow .title img { width: 34px; height: 34px; }
  .narrow .back { width: 38px; height: 38px; }
  .narrow .score { min-width: 64px; padding: 2px 10px; } .narrow .score b { font-size: 22px; }
  .narrow .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
  .narrow .clock { width: 50px; height: 50px; } .narrow .clock span { width: 38px; height: 38px; font-size: 18px; }
  .narrow .combo { font-size: 15px; padding: 3px 10px; }
  .narrow .eq { top: 104px; padding: 8px 16px 10px; }
  .narrow .line { font-size: 34px; }
  .narrow .ask { font-size: 26px; }
  .narrow .box { min-width: 60px; min-height: 44px; font-size: 28px; }
  .narrow .msg { bottom: 268px; font-size: 15px; }
  .narrow .pop { font-size: 32px; } .narrow .pop.big { font-size: 34px; }
  .narrow .hero { width: 120px; height: 100px; }
  .narrow .start h1, .narrow .done h1 { font-size: 30px; }
  .narrow .lead { font-size: 15px; }
  .narrow .how li { font-size: 14px; }
  /* the one Pause button sits top left on every activity: the title chip starts after it */
  .top { padding-left: 76px; }
  @media (max-width: 600px) { .top { padding-left: 62px; } }
</style>
