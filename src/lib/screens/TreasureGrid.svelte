<script lang="ts">
  // Treasure Grid: the negative numbers arcade game on a treasure cove. The map's grid is drawn in the
  // sand of a dig pit; a clue card says where the chest is (coordinates, a walk from a flag, or a mirror
  // over an axis). Tap a crossing to mark it (its pair shows beside it), tap it again or press Dig. A
  // chest bursts out of the sand, or a sonar ping says what was right; the tide rolls in from the sea
  // while you think. Two minutes a round: combos, a quick bonus, three stars, a best score and today's
  // challenge. The rules and scoring are in math/integers/treasure.ts.
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
  import { TreasureScene } from '../three/treasureScene';
  import type { Profile } from '../engine/profile';
  import { ROUND_MS, STAR_AT, applyTreasure, boardFor, clueMaker, clueScore, clueShort, clueText, comboMult, dailyBestOf, dailySeed, howTo, kindsFor, levelFor, pairText, sonar, starsFor, treasureOf, type Clue, type Pt, type TreasureOutcome } from '../math/integers/treasure';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);

  let phase = $state<'menu' | 'play' | 'done'>('menu');
  let daily = $state(false);
  let clue = $state<Clue | null>(null);
  let clueN = $state(0);
  let sel = $state<Pt | null>(null);
  let selAt = $state<{ x: number; y: number } | null>(null);
  let tries = 0, lastDug: Pt | undefined;
  let score = $state(0), combo = $state(0), bestCombo = $state(0), found = $state(0), washed = 0;
  let left = $state(ROUND_MS);
  let tideLeft = $state(1);
  let busy = $state(false);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number; x: number; y: number } | null>(null);
  let outcome = $state<TreasureOutcome | null>(null);
  let burst = $state(0);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: TreasureScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let nextClue = clueMaker(1, boardFor(game.profile!), ['point']);
  let t0 = 0, last = 0, raf = 0, clueAt = 0, beeped = 0;
  /** the Pause card (ui/PauseButton.svelte): the round's clock stops while it's open */
  let held = 0;
  function hold() { if (phase === 'play' && !held) held = performance.now(); }
  function unhold() { if (!held) return; const d = performance.now() - held; t0 += d; last += d; clueAt += d; held = 0; }
  let disposed = false;
  let w = $state(1280), h = $state(800);
  const narrow = $derived(w < 760);

  const rec = $derived(treasureOf(p));
  const todayBest = $derived(dailyBestOf(p));

  onMount(() => {
    // this game draws its own 3D (the cove isn't an island world): the shared stage rests meanwhile
    stage.use(null);
    if (canvas) TreasureScene.create(canvas, game.profile!.buddy).then(s => {
      if (disposed) { s.dispose(); return; }
      scene = s;
      s.setBoard(boardFor(game.profile!));
      s.setView(viewFor());
      if (import.meta.env.DEV) (window as unknown as { __treasure: TreasureScene }).__treasure = s;
      raf = requestAnimationFrame(tick);
    });
    addEventListener('resize', onResize);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); scene?.setView(viewFor()); }
  /** where the pit goes on the screen: under the top bar and the clue card, over the Dig button */
  function viewFor() {
    const H = innerHeight || 1, W = innerWidth || 1;
    return narrow ? { top: 188 / H, bottom: 1 - 104 / H, left: 0.02, right: 0.98 } : { top: 168 / H, bottom: 1 - 96 / H, left: W > 1100 ? 0.2 : 0.1, right: W > 1100 ? 0.8 : 0.9 };
  }
  $effect(() => { void phase; void w; void h; scene?.setView(viewFor()); });

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    const board = boardFor(p);
    scene?.setBoard(board);
    scene?.setView(viewFor());
    nextClue = clueMaker(seed, board, kindsFor(p), levelFor(p, board));
    score = 0; combo = 0; bestCombo = 0; found = 0; washed = 0; answers = []; clueN = 0;
    left = ROUND_MS; outcome = null; msg = null;
    phase = 'play';
    startMusic('shores');
    t0 = performance.now(); last = t0;
    newClue();
    say(board.xMin < 0 ? 'Read the clue, tap the spot on the map, then Dig!' : 'Across first, then up. Tap the spot, then Dig!');
  }

  function newClue() {
    if (phase !== 'play') return;
    clue = nextClue(); clueN++;
    // the last clue's line goes (the first clue keeps the how-to tip)
    if (clueN > 1) clearOldLine(() => msg, () => (msg = null));
    tries = 0; lastDug = undefined; busy = false; sel = null; beeped = 0;
    scene?.clear(); scene?.select(null); scene?.setClue(clue);
    clueAt = performance.now();
    sfx.sparkle();
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    selAt = sel ? scene.screenOf(sel, 0.05) : null;
    if (phase !== 'play') return;
    if (held) return;
    last = now;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (clue && !busy) {
      const k = (now - clueAt) / clue.tideMs;
      tideLeft = Math.max(0, 1 - k);
      scene.tide(k);
      // the last few seconds tick
      const s = Math.ceil((clue.tideMs - (now - clueAt)) / 1000);
      if (s <= 3 && s > 0 && s !== beeped) { beeped = s; sfx.countBeep(s); }
      if (k >= 1) washAway();
    }
    if (left <= 0) finish();
  }

  /** The tide reached the chest: it's lost (only the combo goes), and the next clue comes. */
  function washAway() {
    if (!clue || busy) return;
    busy = true;
    if (!tries) answers.push({ key: clue.key, ok: false, thinkMs: clue.tideMs, rung: clue.rung });
    washed++; combo = 0;
    sfx.splashSmall(1.4);
    scene?.washed(clue.at); scene?.select(clue.at);
    say(`The tide got there first! It was at ${pairText(clue.at)}.`, 'oops');
    setTimeout(newClue, 1900);
  }

  const same = (a: Pt | null, b: Pt) => !!a && a.x === b.x && a.y === b.y;
  function onPointer(e: PointerEvent) {
    if (phase !== 'play' || !scene || busy) return;
    const q = scene.pick(e.clientX, e.clientY);
    if (!q) return;
    if (same(sel, q)) { dig(); return; }
    sel = q; scene.select(q); sfx.click();
  }
  function onMove(e: PointerEvent) { if (phase === 'play' && scene && e.pointerType === 'mouse') scene.hover(scene.pick(e.clientX, e.clientY)); }

  function dig() {
    if (phase !== 'play' || !scene || !clue || busy) return;
    if (!sel) { sfx.nope(); say('Tap a spot on the map first!'); return; }
    const c = clue, at = sel, ms = performance.now() - clueAt, ok = same(at, c.at);
    if (!tries) answers.push({ key: c.key, ok, thinkMs: ms, rung: c.rung });
    sfx.thunk(2);
    if (ok) {
      busy = true;
      const pts = clueScore(c, combo, ms, tries === 0);
      score += pts; found++;
      if (tries === 0) { combo++; bestCombo = Math.max(bestCombo, combo); }
      musicEnergy(Math.min(1, 0.4 + combo * 0.08));
      scene.dig(at, true);
      setTimeout(() => { sfx.treasure(Math.min(8, combo)); if (combo >= 2) sfx.ding(combo); }, 260);
      const s = scene.screenOf(at, 0.4);
      pop = { text: `+${pts}`, key: Date.now(), x: s.x, y: s.y };
      say(tries === 0 ? `Treasure! ${pairText(c.at)}${combo >= 3 ? `, ${combo} in a row!` : '!'}` : `Found it at ${pairText(c.at)}!`, 'good');
      if (starsFor(score) > starsFor(score - pts)) { burst++; setTimeout(() => sfx.star(starsFor(score) - 1), 500); }
      sel = null; scene.select(null);
      setTimeout(newClue, 1500);
    } else {
      tries++; combo = 0;
      const sn = sonar(c, at, lastDug);
      lastDug = at;
      scene.dig(at, false, sn.heat);
      setTimeout(() => (sn.heat > 0.6 ? sfx.nearMiss() : sfx.miss()), 120);
      say(tries >= 2 ? `${sn.text} ${howTo(c)}` : sn.text, 'oops');
      sel = null; scene.select(null);
    }
  }

  function moveSel(dx: number, dy: number) {
    if (phase !== 'play' || !scene || busy) return;
    const b = boardFor(p), cur = sel ?? { x: Math.max(b.xMin, Math.min(b.xMax, 0)), y: Math.max(b.yMin, Math.min(b.yMax, 0)) };
    sel = { x: Math.max(b.xMin, Math.min(b.xMax, cur.x + dx)), y: Math.max(b.yMin, Math.min(b.yMax, cur.y + dy)) };
    scene.select(sel); sfx.click();
  }

  function finish() {
    if (phase !== 'play') return;
    phase = 'done'; clue = null; busy = true;
    sfx.timeUp();
    const out = applyTreasure($state.snapshot(game.profile!) as Profile, { score, found, washed, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 500 + i * 300);
    if (out.newBest && score > 0) setTimeout(() => sfx.newBest(), 1400);
    musicEnergy(0.5);
    sel = null; scene?.select(null); scene?.setClue(null); scene?.clear();
  }

  /** where it was opened from: Back goes there, and its cards offer the Arcade too */
  const exits = exitsOf('integers');
  const backTo = exits.backTo;
  function quit() {
    sfx.click();
    if (phase === 'play') { phase = 'menu'; clue = null; busy = false; msg = null; sel = null; scene?.select(null); scene?.setClue(null); scene?.clear(); return; }
    exits.back();
  }
  // (for checking the end card quickly: __gameEnd() ends the round now)
  if (import.meta.env.DEV) (window as unknown as { __gameEnd: () => void }).__gameEnd = finish;
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (phase === 'done' && e.key === 'Enter' && endEnter(game.profile, 'game:treasure')) { e.preventDefault(); return; }
    if (phase === 'play') {
      const d: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      if (d[e.key]) { e.preventDefault(); moveSel(...d[e.key]); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dig(); }
    } else if (e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  /** the clue's words, with its pairs picked out */
  const clueParts = $derived(clue ? clueText(clue).split(/(\(−?\d+, −?\d+\))/).filter(Boolean) : []);
</script>

<svelte:window onkeydown={onKey} bind:innerWidth={w} bind:innerHeight={h} />

<div class="screen tg" class:narrow style:background-image="url({base}math/integers/beach.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={onPointer} onpointermove={onMove}></canvas>

  {#if sel && selAt && phase === 'play'}
    <div class="seltag" style:left="{selAt.x}px" style:top="{selAt.y}px">{pairText(sel)}<small>tap again to dig</small></div>
  {/if}

  <PauseButton onpause={hold} onresume={unhold} />
  <div class="top">
    <div class="title"><img src="{base}math/integers/tile.webp" alt="" /><b>Treasure Grid</b>{#if daily}<small>Today's challenge</small>{/if}</div>
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

  {#if phase === 'play' && clue}
    {#key clueN}
      <div class="clue" class:urgent={tideLeft < 0.3}>
        <span class="cn"><small>Clue</small><b>{clueN}</b></span>
        <p>{#each clueParts as s}{#if /^\(/.test(s)}<span class="pair">{s}</span>{:else}{s}{/if}{/each}</p>
        <span class="tide" title="The tide is coming"><i style:width="{tideLeft * 100}%"></i><em>Tide</em></span>
      </div>
    {/key}
  {/if}

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop" style:left="{pop.x}px" style:top="{pop.y}px">{pop.text}</div>{/key}{/if}

  {#if phase === 'play'}
    <div class="bottom">
      <span class="hint">{sel ? `Dig at ${pairText(sel)}?` : clue ? clueShort(clue) : ''}</span>
      <button class="btn btn-primary dig" disabled={!sel || busy} onclick={dig}><img src="{base}math/integers/tile.webp" alt="" />Dig! <span class="kbd">enter</span></button>
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}math/integers/tile.webp" alt="" />
        <h1>Treasure Grid</h1>
        <p class="lead">Chests are buried all over the treasure map! Read each clue, find the spot on the grid and dig, before the tide rolls in.</p>
        <ol class="how">
          <li><span class="pricetag">(3, −2)</span>The first number goes across, the second goes up or down. Minus is left or down.</li>
          <li><span><Icon name="target" size={26} /></span>Tap the spot to mark it, then tap again or press Dig.</li>
          <li><span class="wave"></span>Missed? The sonar ping tells you what was right. The tide keeps coming!</li>
          <li><span><Icon name="bolt" size={24} /></span>First-try digs in a row make a combo. Quick ones score more.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same clues all day</span><span class="tiny bonus">Beat {STAR_AT[1]} for {DAILY_SHELLS} bonus shells</span></div>
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
        <h1>{o.stars === 3 ? 'Treasure Champion!' : o.stars === 2 ? 'Great digging!' : o.stars === 1 ? 'The tide is in!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{found}</b><small>chests found</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <PrizeRow {o} buddy={p.buddy} />
        <div class="acts">
          <GameEndButtons activity="game:treasure" {exits} {daily} onagain={start} />
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .tg { background-size: cover; background-position: center 40%; background-color: #f3dcae; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 4px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; }
  .title b { font: 600 22px var(--font-ui); color: #1f6fa8; }
  .title small { font: 800 11px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #8fe3ff, #2f9ed8); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#ffcf4a, #e69a17); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(160, 90, 10, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  /* the clue card: an old scroll under the top bar */
  .clue { position: absolute; left: 50%; top: 74px; transform: translateX(-50%); z-index: 6; display: flex; align-items: center; gap: 14px; width: min(760px, 94vw); padding: 10px 16px 10px 10px;
    border-radius: 22px; background: linear-gradient(#fff9ea, #f6e4bd); box-shadow: 0 0 0 3px #e2c088, 0 10px 24px rgba(90, 60, 20, .28); animation: unroll .45s cubic-bezier(.3, .8, .4, 1.3); }
  @keyframes unroll { from { transform: translateX(-50%) scaleX(.4); opacity: 0; } }
  .clue.urgent { box-shadow: 0 0 0 3px #7fd0f3, 0 0 26px rgba(63, 170, 230, .7), 0 10px 24px rgba(90, 60, 20, .28); }
  .cn { flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(#ffd56b, #e69a17); color: #fff; box-shadow: 0 3px 0 #b8720e; }
  .cn small { font: 800 10px var(--font-body); text-transform: uppercase; letter-spacing: .06em; }
  .cn b { font: 600 24px/1 var(--font-ui); }
  .clue p { flex: 1; margin: 0; font: 600 22px/1.25 var(--font-ui); color: #4a2e10; }
  .pair { display: inline-block; white-space: nowrap; padding: 0 8px; margin: 0 2px; border-radius: 10px; background: #fff; color: #1f5f9e; box-shadow: inset 0 0 0 2px #bfe0f5; font-size: 1.1em; }
  .tide { flex: none; position: relative; width: 84px; height: 30px; border-radius: 999px; background: #e9f6fd; overflow: hidden; box-shadow: inset 0 0 0 2px #fff, 0 0 0 2px #9fd7f2; }
  .tide i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #bfeaff, #3fb2e3); transition: width .2s linear; }
  .tide em { position: absolute; inset: 0; display: grid; place-items: center; font: 800 11px var(--font-body); color: #0d4f7a; font-style: normal; text-transform: uppercase; letter-spacing: .08em; }

  .seltag { position: absolute; z-index: 4; transform: translate(-50%, calc(-100% - 18px)); pointer-events: none; display: flex; flex-direction: column; align-items: center; font: 600 24px var(--font-ui); color: #1f5f9e; background: #fff; border-radius: 14px; padding: 2px 12px 3px; box-shadow: 0 0 0 3px #ffd36b, 0 6px 14px rgba(0, 0, 0, .2); white-space: nowrap; }
  .seltag small { font: 700 11px var(--font-body); color: var(--muted); }

  .msg { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 6; font: 600 19px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 720px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, 16px); opacity: 0; } }
  .pop { position: absolute; z-index: 6; transform: translate(-50%, -50%); font: 600 46px var(--font-ui); color: #ffd84d; -webkit-text-stroke: 2px #7a4a00; paint-order: stroke fill; text-shadow: 0 3px 0 #7a4a00, 0 6px 18px rgba(0, 0, 0, .35); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } to { transform: translate(-50%, -200%); opacity: 0; } }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px 14px 16px; pointer-events: none; }
  .bottom > * { pointer-events: auto; }
  .hint { font: 600 18px var(--font-ui); color: #4a2e10; background: rgba(255, 249, 234, .94); border-radius: 18px; padding: 10px 16px; box-shadow: var(--shadow-sm); }
  .dig { display: flex; align-items: center; gap: 8px; font-size: 26px; padding: 10px 28px 10px 12px; border-radius: 22px; }
  .dig img { width: 42px; height: 42px; object-fit: contain; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(20, 50, 80, .28); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { width: 150px; height: 140px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(120, 80, 10, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #1f6fa8; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #eef8fd; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; min-width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #bfe0f5; padding: 0 4px; }
  .how .pricetag { font: 600 15px var(--font-ui); color: #1f5f9e; }
  .how .wave { background: radial-gradient(circle, #ff8a5c 0 18%, transparent 19% 32%, #ffb07a 33% 40%, transparent 41% 54%, #9fd7f2 55% 62%, transparent 63%), #fff; }
  .bests { display: flex; gap: 10px; width: 100%; }
  .bests > div { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #eef8fd; border-radius: 16px; padding: 8px; }
  .bests small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .bests b { font: 600 26px var(--font-ui); color: var(--ink); }
  .tiny { font: 600 12px var(--font-body); color: var(--muted); }
  .tiny.bonus { color: #a86a00; font-weight: 700; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px; }
  .big { font-size: 22px; padding: 12px 26px; }
  .sub { margin: -6px 0 0; font: 800 12px var(--font-body); color: #2f7d5b; text-transform: uppercase; letter-spacing: .06em; }
  .big-score { font: 600 64px/1 var(--font-ui); color: var(--ink); }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #3fb2e3, #e6a817); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #eef8fd; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* a short screen: the start card's pictures smaller, so its buttons stay in sight */
  @media (max-height: 800px) {
    .hero { width: 96px; height: 84px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; padding: 3px 10px 3px 4px; }
    .how li > span { min-width: 38px; height: 38px; }
    .card.start, .card.done { gap: 7px; padding: 16px 22px; }
  }
  /* a phone */
  .narrow .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
  .narrow .title { padding: 3px; } .narrow .title b, .narrow .title small { display: none; } .narrow .title img { width: 32px; height: 32px; }
  .narrow .back { width: 38px; height: 38px; }
  .narrow .score { min-width: 64px; padding: 2px 10px; } .narrow .score b { font-size: 22px; }
  .narrow .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
  .narrow .clock { width: 50px; height: 50px; } .narrow .clock span { width: 38px; height: 38px; font-size: 18px; }
  .narrow .combo { font-size: 15px; padding: 3px 10px; }
  .narrow .clue { top: 92px; gap: 8px; padding: 8px 10px 8px 8px; }
  .narrow .cn { width: 42px; height: 42px; border-radius: 12px; } .narrow .cn b { font-size: 18px; } .narrow .cn small { font-size: 8px; }
  .narrow .clue p { font-size: 16px; }
  .narrow .tide { width: 52px; height: 24px; } .narrow .tide em { font-size: 9px; }
  .narrow .msg { font-size: 15px; bottom: 84px; }
  .narrow .hint { display: none; }
  .narrow .dig { font-size: 22px; } .narrow .dig .kbd { display: none; }
  .narrow .seltag { font-size: 20px; }
  .narrow .hero { width: 110px; height: 100px; }
  .narrow .start h1, .narrow .done h1 { font-size: 30px; }
  .narrow .lead { font-size: 15px; }
  .narrow .how li { font-size: 14px; }
  /* the one Pause button sits top left on every activity: the title chip starts after it */
  .top { padding-left: 76px; }
  @media (max-width: 600px) { .top { padding-left: 62px; } }
</style>
