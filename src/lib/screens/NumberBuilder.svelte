<script lang="ts">
  // Number Builder: the place value arcade game in the crystal cave workshop. An order card shows a
  // number (47, "two hundred and five", 300 + 40 + 5, "10 more than 243"); build it on the mat with
  // hundreds flats, tens rods and ones cubes, then press Build. Ten ones on the mat snap into a rod (ten
  // rods into a flat). 100 seconds a round: combos, a quick bonus, three stars, a best score and today's
  // challenge. The rules and scoring are in math/place/builder.ts.
  //
  // The same mat with no clock is the Playground's Block Table: build any number and read it back, trade
  // ten cubes for a rod (or break a rod into ten cubes), or ask for a number to build.
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
  import { BuilderScene, type Kind } from '../three/builderScene';
  import type { Profile } from '../engine/profile';
  import type { Blocks } from '../math/skills/types';
  import { words, commas } from '../math/skills/place';
  import { ROUND_MS, STAR_AT, applyBuild, builderOf, builderOpen, comboMult, dailyBestOf, dailySeed, kindsFor, levelsFor, orderMaker, orderScore, starsFor, toBlocks, valueOf, type BuildOrder, type BuildOutcome } from '../math/place/builder';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import PrizeRow from '../arcade/ui/PrizeRow.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const toy = builderOpen.toy;

  const KINDS: Kind[] = ['h', 't', 'o'];
  const NAME: Record<Kind, [string, string]> = { h: ['hundred', 'hundreds'], t: ['ten', 'tens'], o: ['one', 'ones'] };
  const IMG: Record<Kind, string> = { h: 'hundred', t: 'ten', o: 'one' };
  const KEY: Record<Kind, string> = { h: 'H', t: 'T', o: 'O' };
  const say1 = (k: Kind, n: number) => `${n === 1 ? 'one' : words(n)} ${NAME[k][n === 1 ? 0 : 1]}`;

  let phase = $state<'menu' | 'play' | 'done'>(toy ? 'play' : 'menu');
  let daily = $state(false);
  let b = $state<Blocks>({ h: 0, t: 0, o: 0 });
  let order = $state<BuildOrder | null>(null);
  let score = $state(0), combo = $state(0), bestCombo = $state(0), built = $state(0);
  let left = $state(ROUND_MS);
  let msg = $state<{ text: string; kind: 'good' | 'oops' | 'tip'; key: number } | null>(null);
  let pop = $state<{ text: string; key: number } | null>(null);
  let trays = $state<Record<Kind, { x: number; y: number }> | null>(null);
  let tall = $state(false);
  let outcome = $state<BuildOutcome | null>(null);
  let burst = $state(0);
  let busy = $state(false);
  let goal = $state<number | null>(null);
  let canvas: HTMLCanvasElement | undefined = $state();
  let scene: BuilderScene | null = null;
  let answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[] = [];
  let nextOrder = orderMaker(1, ['two']);
  let added: Kind[] = [];
  let tries = 0;
  let t0 = 0, raf = 0, orderAt = 0;
  /** the Pause card (ui/PauseButton.svelte): the round's clock stops while it's open */
  let held = 0;
  function hold() { if (phase === 'play' && !held) held = performance.now(); }
  function unhold() { if (!held) return; const d = performance.now() - held; t0 += d; orderAt += d; held = 0; }
  let disposed = false;

  const rec = $derived(builderOf(p));
  const todayBest = $derived(dailyBestOf(p));
  const value = $derived(valueOf(b));

  onMount(() => {
    // this game draws its own 3D: the shared stage rests meanwhile
    stage.use(null);
    if (canvas) BuilderScene.create(canvas).then(s => { if (disposed) s.dispose(); else { scene = s; if (import.meta.env.DEV) (window as unknown as { __builder: BuilderScene }).__builder = s; raf = requestAnimationFrame(tick); } });
    addEventListener('resize', onResize);
    if (toy) say('Tap a bin to put blocks on the mat. Ten ones make a ten!');
    // for checking by hand: __nb.card() is the card now, __nb.fill() puts its number on the mat, __nb.finish() ends the round
    if (import.meta.env.DEV) (window as unknown as { __nb: unknown }).__nb = { card: () => order && { ask: order.ask, card: order.card, target: order.target }, fill: () => { if (order) { b = toBlocks(order.target); scene?.set(b.h, b.t, b.o); } }, finish };
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); removeEventListener('resize', onResize); scene?.dispose(); scene = null; musicEnergy(0.5); });
  function onResize() { scene?.resize(); }

  function say(text: string, kind: 'good' | 'oops' | 'tip' = 'tip') { msg = { text, kind, key: Date.now() }; }

  function start(isDaily: boolean) {
    sfx.whoosh();
    daily = isDaily;
    const seed = isDaily ? dailySeed(Date.now()) : Math.floor(Math.random() * 1e9);
    nextOrder = orderMaker(seed, kindsFor(p), levelsFor(p));
    score = 0; combo = 0; bestCombo = 0; built = 0; answers = [];
    left = ROUND_MS; outcome = null; msg = null; busy = false;
    phase = 'play';
    startMusic('cliffs');
    t0 = performance.now();
    newOrder();
    say('Build the number on the card, then press Build!');
  }

  /** The next card; the mat clears (or starts with the number for a "10 more" card). */
  function newOrder() {
    order = nextOrder();
    tries = 0; added = [];
    // the last card's line ("371 is three hundreds...") goes: it was about that card, not this one
    if (answers.length) clearOldLine(() => msg, () => (msg = null));
    b = toBlocks(order.start);
    scene?.set(b.h, b.t, b.o);
    orderAt = performance.now();
  }

  function tick(now: number) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!scene) return;
    trays = { h: scene.trayAt('h'), t: scene.trayAt('t'), o: scene.trayAt('o') };
    tall = scene.tall;
    if (toy || phase !== 'play') return;
    if (held) return;
    left = Math.max(0, ROUND_MS - (now - t0));
    if (left <= 0) finish();
  }

  /** A block goes on the mat. In the game ten of a kind trade straight away; at the Block Table you trade. */
  function add(k: Kind) {
    if (phase !== 'play' || !scene || busy) return;
    if (k === 'h' && b.h >= 9) { sfx.nope(); say('Nine hundreds is the most this mat holds.', 'oops'); return; }
    if (toy && b[k] >= 19) { sfx.nope(); say(`That's a lot of ${NAME[k][1]}! Trade ten of them first.`, 'oops'); return; }
    scene.add(k); b[k]++; added.push(k);
    sfx.plop(k === 'h' ? 0 : k === 't' ? 2 : 4, 1);
    if (!toy) settle();
    else if (k !== 'h' && b[k] === 10) say(`Ten ${NAME[k][1]}! Trade them for a ${k === 'o' ? 'ten' : 'hundred'}.`);
    else if (goal !== null) checkGoal();
  }
  /** In the game: ten ones snap into a rod, then ten rods into a flat. */
  function settle() {
    const k: 'o' | 't' | null = b.o >= 10 ? 'o' : b.t >= 10 && b.h < 9 ? 't' : null;
    if (!k) return;
    busy = true;
    setTimeout(() => {
      if (disposed || !scene) return;
      trade(k, true);
      setTimeout(() => { busy = false; settle(); }, 720);
    }, 300);
  }
  function trade(k: 'o' | 't', auto = false) {
    if (!scene || b[k] < 10 || (k === 't' && b.h >= 9)) return;
    scene.trade(k);
    b[k] -= 10; b[k === 'o' ? 't' : 'h']++;
    added = added.filter(x => x !== k);
    sfx.merge(k === 'o' ? 1 : 3, 1);
    say(k === 'o' ? 'Ten ones make one ten!' : 'Ten tens make one hundred!', 'good');
    if (!auto) { busy = true; setTimeout(() => { busy = false; if (goal !== null) checkGoal(); }, 720); }
  }
  /** At the Block Table: a rod breaks into ten ones (a flat into ten rods). */
  function split(k: 't' | 'h') {
    if (!scene || busy || b[k] < 1) return;
    const down = k === 't' ? 'o' : 't';
    if (b[down] > 9) { sfx.nope(); say(`Trade some ${NAME[down][1]} first: the tray is full.`, 'oops'); return; }
    scene.split(k);
    b[k]--; b[down] += 10;
    sfx.crack();
    say(k === 't' ? 'One ten is ten ones!' : 'One hundred is ten tens!', 'good');
    busy = true; setTimeout(() => { busy = false; }, 500);
  }
  function remove(k: Kind) {
    if (phase !== 'play' || !scene || busy || b[k] < 1) return;
    scene.remove(k); b[k]--;
    const i = added.lastIndexOf(k); if (i >= 0) added.splice(i, 1);
    sfx.pop();
    if (toy && goal !== null) checkGoal();
  }
  /** Backspace: the last block you added comes off (or the smallest on the mat). */
  function undo() {
    const k = added.at(-1) ?? KINDS.slice().reverse().find(x => b[x] > 0);
    if (k) remove(k);
  }
  function clear() {
    if (!scene || busy) return;
    sfx.whoosh();
    b = toy ? { h: 0, t: 0, o: 0 } : toBlocks(order?.start ?? 0); added = [];
    scene.set(b.h, b.t, b.o);
  }
  function onPointer(e: PointerEvent) {
    if (phase !== 'play' || !scene) return;
    const k = scene.tap(e.clientX, e.clientY);
    if (k) remove(k);
  }

  /** What's different between the mat and the card, in words ("one more ten, two fewer ones"). */
  function diffText(o: BuildOrder): string {
    const want = toBlocks(o.target);
    let have = { ...b };
    while (have.o >= 10) { have.o -= 10; have.t++; }
    while (have.t >= 10) { have.t -= 10; have.h++; }
    const parts = KINDS.map(k => {
      const d = want[k] - have[k];
      return d === 0 ? '' : `${Math.abs(d) === 1 ? 'one' : words(Math.abs(d))} ${d > 0 ? 'more' : 'fewer'} ${NAME[k][Math.abs(d) === 1 ? 0 : 1]}`;
    }).filter(Boolean);
    return parts.join(' and ');
  }

  function build() {
    if (toy || phase !== 'play' || !scene || !order || busy) return;
    const o = order, ok = value === o.target, ms = performance.now() - orderAt;
    if (!tries) answers.push({ key: o.key, ok, thinkMs: ms, rung: o.rung });
    if (ok) {
      const pts = orderScore(o, combo, ms);
      score += pts; combo++; bestCombo = Math.max(bestCombo, combo); built++;
      musicEnergy(Math.min(1, 0.4 + combo * 0.08));
      pop = { text: `+${pts}`, key: Date.now() };
      combo >= 3 ? sfx.perfect() : sfx.cheer();
      scene.cheer();
      const tb = toBlocks(o.target);
      say(`${commas(o.target)} is ${KINDS.filter(k => tb[k]).map(k => say1(k, tb[k])).join(', ') || 'zero'}!`, 'good');
      if (starsFor(score) > starsFor(score - pts)) { burst++; sfx.star(starsFor(score) - 1); }
      busy = true;
      setTimeout(() => { if (disposed || phase !== 'play') return; busy = false; newOrder(); }, 1150);
    } else {
      tries++; combo = 0;
      sfx.nope(); scene.shake();
      say(tries > 1 ? `You built ${commas(value)}. Try ${diffText(o)}.` : `That's ${commas(value)}. Not quite: try again!`, 'oops');
    }
  }

  function finish() {
    if (phase !== 'play' || toy) return;
    phase = 'done'; busy = false;
    sfx.complete();
    const out = applyBuild($state.snapshot(game.profile!) as Profile, { score, built, bestCombo, ms: ROUND_MS, at: Date.now(), daily, answers });
    game.replaceProfile(out.profile);
    outcome = out; burst++;
    for (let i = 0; i < out.stars; i++) setTimeout(() => sfx.star(i), 400 + i * 300);
    musicEnergy(0.5);
    scene?.set(0, 0, 0); b = { h: 0, t: 0, o: 0 };
  }

  /** The Block Table's "give me a number": no clock, a cheer when the mat matches. */
  function askGoal() {
    sfx.click();
    const big = value > 99 || Math.random() < 0.5;
    goal = big ? 100 + Math.floor(Math.random() * 900) : 11 + Math.floor(Math.random() * 89);
    say(`Can you build ${commas(goal)}?`);
    checkGoal();
  }
  function checkGoal() {
    if (goal === null || value !== goal) return;
    sfx.perfect(); scene?.cheer(); burst++;
    say(`You built ${commas(goal)}! ${words(goal)[0].toUpperCase()}${words(goal).slice(1)}.`, 'good');
    goal = null;
  }

  /** where it was opened from (the Arcade, the Playground or a math page): Back goes there, and the
   *  game's cards offer the Arcade too */
  const exits = exitsOf('place');
  const backTo = exits.backTo;
  function quit() {
    sfx.click();
    if (!toy && phase === 'play') { phase = 'menu'; msg = null; order = null; scene?.set(0, 0, 0); b = { h: 0, t: 0, o: 0 }; return; }
    builderOpen.toy = false;
    exits.back();
  }
  // (for checking the end card quickly: __gameEnd() ends the round now)
  if (import.meta.env.DEV) (window as unknown as { __gameEnd: () => void }).__gameEnd = finish;
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (phase === 'done' && e.key === 'Enter' && endEnter(game.profile, 'game:builder')) { e.preventDefault(); return; }
    const key = e.key.toLowerCase();
    if (phase === 'play') {
      const k = ({ h: 'h', t: 't', o: 'o', '1': 'h', '2': 't', '3': 'o' } as Record<string, Kind>)[key];
      if (k) { e.preventDefault(); add(k); return; }
      if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); undo(); return; }
      if (!toy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); build(); }
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); start(daily); }
  }
  const secs = $derived(Math.ceil(left / 1000));
  const meter = $derived(Math.min(1, score / STAR_AT[2]));
  const cardSmall = $derived(!!order && order.card.length > 14);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen builder" class:tall style:background-image="url({base}arcade/bg-builder.webp)">
  <canvas class="three" bind:this={canvas} onpointerdown={onPointer}></canvas>

  <PauseButton onpause={hold} onresume={unhold} />
  <div class="top">
    <div class="title"><img src="{base}math/place/ten.webp" alt="" /><b>{toy ? 'Block Table' : 'Number Builder'}</b>{#if daily}<small>Today's challenge</small>{/if}</div>
    {#if phase === 'play' && !toy}
      <div class="score"><small>Score</small><b>{score}</b></div>
      <div class="meter" title="Stars at {STAR_AT.join(', ')}">
        <i style:width="{meter * 100}%"></i>
        {#each STAR_AT as s}<img class:on={score >= s} style:left="{(s / STAR_AT[2]) * 100}%" src="{base}game/icon-star.webp" alt="" />{/each}
      </div>
      {#if combo > 1}{#key combo}<div class="combo">Combo ×{comboMult(combo)}</div>{/key}{/if}
      <div class="clock" class:low={secs <= 15} style:--k={left / ROUND_MS}><span>{secs}</span></div>
    {/if}
  </div>

  <!-- the order card (the game) or what's on the mat (the Block Table) -->
  {#if phase === 'play' && !toy && order}
    {#key order}
      <div class="order" class:small={cardSmall}>
        <small>{order.ask}</small>
        <b>{order.card}</b>
      </div>
    {/key}
  {:else if toy}
    <div class="order readout">
      <small>On the mat</small>
      <b>{commas(value)}</b>
      <span class="words">{value ? words(value) : 'zero'}</span>
      <span class="sum">{#each KINDS as k, i}{#if i}<i>+</i>{/if}<span class="k-{k}">{b[k] * (k === 'h' ? 100 : k === 't' ? 10 : 1)}</span>{/each}</span>
    </div>
  {/if}

  {#if msg && phase === 'play'}{#key msg.key}<div class="msg {msg.kind}">{msg.text}</div>{/key}{/if}
  {#if pop}{#key pop.key}<div class="pop">{pop.text}</div>{/key}{/if}

  {#if phase === 'play' && trays}
    <!-- a bin of blocks under each tray: tap to put one on the mat; the count of each kind shows here -->
    {#each KINDS as k}
      <div class="bin k-{k}" style:left="{trays[k].x}px" style:top="{trays[k].y}px">
        <button class="add" onclick={() => add(k)} disabled={busy} aria-label="Add a {NAME[k][0]}">
          <img src="{base}math/place/{IMG[k]}.webp" alt="" />
          <span class="n"><b>{b[k]}</b> {NAME[k][b[k] === 1 ? 0 : 1]}</span>
          <span class="plus">+</span>
          {#if !tall}<span class="kbd">{KEY[k]}</span>{/if}
        </button>
        <button class="minus" onclick={() => remove(k)} disabled={!b[k] || busy} aria-label="Take a {NAME[k][0]} off">−</button>
      </div>
    {/each}

    <div class="acts-bar">
      <button class="btn ghost" onclick={clear} disabled={busy}><Icon name="reset" size={18} /> Clear</button>
      {#if toy}
        {#if b.o >= 10}<button class="btn trade" onclick={() => trade('o')} disabled={busy}>Trade 10 ones for a ten</button>{/if}
        {#if b.t >= 10 && b.h < 9}<button class="btn trade" onclick={() => trade('t')} disabled={busy}>Trade 10 tens for a hundred</button>{/if}
        {#if b.t > 0 && b.o < 10}<button class="btn" onclick={() => split('t')} disabled={busy}>Break a ten</button>{/if}
        {#if b.h > 0 && b.t < 10}<button class="btn" onclick={() => split('h')} disabled={busy}>Break a hundred</button>{/if}
        <button class="btn btn-primary" onclick={askGoal}>{goal !== null ? `Build ${commas(goal)}` : 'Give me a number'}</button>
      {:else}
        <button class="btn btn-primary buildb" onclick={build} disabled={busy}>Build! {#if !tall}<span class="kbd">enter</span>{/if}</button>
      {/if}
    </div>
  {/if}

  {#if phase === 'menu'}
    <div class="sheetbg">
      <div class="card start">
        <img class="hero" src="{base}arcade/cab-builder.webp" alt="" />
        <h1>Number Builder</h1>
        <p class="lead">The Geode Mole needs numbers built! Read each card and build it on the mat with hundreds, tens and ones. 100 seconds, as many as you can.</p>
        <ol class="how">
          <li><span><b class="mini">347</b></span>The card shows the number to build.</li>
          <li><span><img src="{base}math/place/ten.webp" alt="" /></span>Tap a bin to add a block. Tap a block on the mat to take it off.</li>
          <li><span><Icon name="bolt" size={24} /></span>Right in a row makes a combo. Quick ones score more.</li>
        </ol>
        <div class="bests">
          <div><small>Best</small><b>{rec.best}</b><Stars n={rec.stars} size={20} /></div>
          <div><small>Today's challenge</small><b>{todayBest || '—'}</b><span class="tiny">Same cards all day</span><span class="tiny bonus">Beat {STAR_AT[1]} for {DAILY_SHELLS} bonus shells</span></div>
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
        <h1>{o.stars === 3 ? 'Master Builder!' : o.stars === 2 ? 'Great building!' : o.stars === 1 ? 'Time is up!' : 'Nearly a star!'}</h1>
        {#if daily}<p class="sub">Today's challenge</p>{/if}
        <div class="big-score">{score}</div>
        <Stars n={o.stars} size={58} animate />
        {#if o.newBest && score > 0}<div class="ribbon">New best score!</div>{:else if daily && o.newDaily}<div class="ribbon">Best today!</div>{/if}
        <div class="facts">
          <div><b>{built}</b><small>numbers built</small></div>
          <div><b>{bestCombo}</b><small>best combo</small></div>
          <div><b>{o.best}</b><small>best score</small></div>
        </div>
        <PrizeRow {o} buddy={p.buddy} />
        <div class="acts">
          <GameEndButtons activity="game:builder" {exits} {daily} onagain={start} before={() => (builderOpen.toy = false)} />
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
</div>

<style>
  .builder { background-size: cover; background-position: center 62%; background-color: #e9c48e; user-select: none; -webkit-user-select: none; }
  .three { position: absolute; inset: 0; width: 100%; height: 100%; touch-action: manipulation; cursor: pointer; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 10px 14px; z-index: 5; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 46px; height: 46px; border-radius: 50%; border: 0; background: #fff; box-shadow: var(--shadow-sm); display: grid; place-items: center; cursor: pointer; }
  .title { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .92); border-radius: 999px; padding: 4px 16px 4px 6px; box-shadow: var(--shadow-sm); }
  .title img { width: 40px; height: 40px; object-fit: contain; transform: rotate(-30deg); }
  .title b { font: 600 22px var(--font-ui); color: #2d6fb8; }
  .title small { font: 800 11px var(--font-body); color: #a86a00; text-transform: uppercase; letter-spacing: .05em; }
  .score { display: flex; flex-direction: column; align-items: center; background: #fff; border-radius: 18px; padding: 2px 16px 4px; box-shadow: var(--shadow-sm); min-width: 92px; }
  .score small { font: 800 10px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 28px/1 var(--font-ui); color: var(--ink); }
  .meter { position: relative; flex: 1; max-width: 280px; height: 16px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #fff, var(--shadow-sm); }
  .meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #8fd8ff, #5a9cff); transition: width .4s; }
  .meter img { position: absolute; top: 50%; width: 30px; height: 30px; transform: translate(-50%, -50%); filter: grayscale(1) opacity(.6); transition: filter .3s, transform .3s; }
  .meter img.on { filter: none; transform: translate(-50%, -50%) scale(1.15); }
  .combo { font: 600 20px var(--font-ui); color: #fff; background: linear-gradient(#6ab8ff, #2d6fb8); padding: 4px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 6px 14px rgba(20, 60, 140, .35); animation: bump .35s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { from { transform: scale(1.5); } }
  .clock { margin-left: auto; width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#4fcf9f calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); box-shadow: var(--shadow-sm); }
  .clock span { width: 48px; height: 48px; border-radius: 50%; background: #fff; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--ink); }
  .clock.low { background: conic-gradient(#ff7a5c calc(var(--k) * 360deg), rgba(255, 255, 255, .6) 0); animation: tickle 1s ease-in-out infinite; }
  @keyframes tickle { 50% { transform: scale(1.07); } }

  /* the order card: a paper ticket pinned up in the workshop */
  .order { position: absolute; left: 50%; top: 78px; transform: translateX(-50%) rotate(-1.5deg); z-index: 4; display: flex; flex-direction: column; align-items: center; gap: 0; min-width: 200px; max-width: min(92vw, 560px); padding: 8px 26px 12px; border-radius: 16px; background: linear-gradient(#fffdf6, #fff3d9); box-shadow: 0 0 0 4px #fff, 0 0 0 7px #ffd36b, 0 14px 30px rgba(60, 30, 10, .35); text-align: center; animation: deal .45s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  @keyframes deal { from { transform: translate(-50%, -40px) rotate(-8deg); opacity: 0; } }
  .order small { font: 800 12px var(--font-body); color: #a86a00; text-transform: uppercase; letter-spacing: .06em; }
  .order b { font: 600 64px/1.05 var(--font-ui); color: #2b2350; }
  .order.small b { font-size: 34px; line-height: 1.15; padding-top: 4px; }
  .readout { transform: translateX(-50%); animation: none; box-shadow: 0 0 0 4px #fff, 0 14px 30px rgba(60, 30, 10, .3); }
  .readout b { font-size: 56px; }
  .words { font: 700 18px var(--font-body); color: var(--ink2); }
  .sum { display: flex; gap: 6px; align-items: center; margin-top: 4px; font: 600 20px var(--font-ui); }
  .sum i { font-style: normal; color: var(--muted); }
  .sum .k-h { color: #2f8a55; } .sum .k-t { color: #2d6fb8; } .sum .k-o { color: #c7861a; }

  .msg { position: absolute; left: 50%; top: 196px; transform: translateX(-50%); z-index: 6; font: 600 20px var(--font-ui); padding: 8px 20px; border-radius: 999px; background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); max-width: min(92vw, 640px); text-align: center; animation: drop .35s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; }
  .readout ~ .msg { top: 236px; }
  .msg.good { background: linear-gradient(#5fe0a6, #2fb57a); color: #fff; }
  .msg.oops { background: #fff3e6; color: #b54a1a; box-shadow: 0 0 0 3px #ffb47a; }
  @keyframes drop { from { transform: translate(-50%, -16px); opacity: 0; } }
  .pop { position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%); z-index: 6; font: 600 46px var(--font-ui); color: #ffe27a; -webkit-text-stroke: 6px #2d4fa0; paint-order: stroke fill; text-shadow: 0 6px 18px rgba(0, 0, 0, .35); animation: rise 1.1s ease-out forwards; pointer-events: none; white-space: nowrap; }
  @keyframes rise { from { transform: translate(-50%, -20%) scale(.7); opacity: 0; } 20% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } to { transform: translate(-50%, -160%); opacity: 0; } }

  /* a bin of blocks under each tray */
  .bin { position: absolute; z-index: 5; transform: translate(-50%, 6px); display: flex; align-items: flex-start; gap: 4px; }
  .add { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 132px; padding: 6px 8px 8px; border: 0; border-radius: 20px; cursor: pointer; background: linear-gradient(#fff, #f3ecdf); box-shadow: 0 5px 0 var(--bc), 0 10px 20px rgba(60, 30, 10, .3); transition: transform .1s; }
  .add:hover { transform: translateY(-3px); }
  .add:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--bc), 0 6px 12px rgba(60, 30, 10, .3); }
  .add img { height: 54px; width: 100%; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(0, 0, 0, .2)); }
  .k-t .add img { transform: rotate(-60deg) scale(1.1); }
  .add .n { font: 700 14px var(--font-body); color: var(--ink2); white-space: nowrap; }
  .add .n b { font: 600 24px var(--font-ui); color: var(--bc); vertical-align: -2px; }
  .add .plus { position: absolute; right: -6px; top: -6px; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--bc); color: #fff; font: 600 24px/1 var(--font-ui); box-shadow: 0 0 0 3px #fff; }
  .add .kbd { position: absolute; left: 6px; top: 6px; }
  .minus { width: 34px; height: 34px; margin-top: 30px; border: 0; border-radius: 50%; background: #fff; color: var(--ink2); font: 600 24px/1 var(--font-ui); cursor: pointer; box-shadow: 0 3px 0 #d8cbb6, 0 6px 12px rgba(60, 30, 10, .25); }
  .minus:disabled { opacity: .45; cursor: default; }
  .bin.k-h { --bc: #2f8a55; } .bin.k-t { --bc: #2d6fb8; } .bin.k-o { --bc: #c7861a; }

  .acts-bar { position: absolute; right: 18px; bottom: 18px; z-index: 5; display: flex; flex-direction: column-reverse; gap: 10px; align-items: stretch; max-width: 300px; }
  .tall .acts-bar { right: auto; left: 50%; transform: translateX(-50%); flex-direction: row; flex-wrap: wrap; justify-content: center; align-items: center; width: max-content; max-width: 96vw; }
  .acts-bar .btn { box-shadow: var(--shadow-sm); }
  .trade { background: linear-gradient(#ffe48a, #ffc93c); animation: glowt 1.2s ease-in-out infinite; }
  @keyframes glowt { 50% { box-shadow: 0 0 0 4px #fff, 0 0 26px rgba(255, 200, 60, .9); } }
  .buildb { font-size: 26px; padding: 14px 40px; border-radius: 22px; }

  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(30, 30, 60, .3); display: grid; place-items: center; padding: 16px; animation: fade .25s; }
  @keyframes fade { from { opacity: 0; } }
  .card.start, .card.done { width: min(560px, 94vw); padding: 22px 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; max-height: 92vh; overflow: auto; animation: popin .35s cubic-bezier(.3, .8, .4, 1.4); }
  @keyframes popin { from { transform: scale(.9); opacity: 0; } }
  .hero { height: 170px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 12px rgba(20, 50, 120, .3)); }
  .start h1, .done h1 { margin: 0; font-size: 38px; color: #2d6fb8; }
  .lead { margin: 0; font: 600 17px/1.4 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; }
  .how li { display: flex; align-items: center; gap: 12px; font: 600 16px var(--font-body); color: var(--ink); background: #eef6ff; border-radius: 14px; padding: 6px 12px 6px 6px; }
  .how li > span { flex: none; width: 46px; height: 46px; border-radius: 12px; background: #fff; display: grid; place-items: center; box-shadow: 0 0 0 2px #cfe4ff; }
  .how img { width: 40px; height: 40px; object-fit: contain; transform: rotate(-50deg); }
  .mini { font: 600 18px var(--font-ui); color: #2b2350; }
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
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(90deg, #5ab0ff, #7ad9a6); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, var(--shadow-sm); }
  .facts { display: flex; gap: 10px; width: 100%; }
  .facts > div { flex: 1; background: #eef6ff; border-radius: 14px; padding: 8px; display: flex; flex-direction: column; }
  .facts b { font: 600 26px var(--font-ui); }
  .facts small { font: 700 13px var(--font-body); color: var(--muted); }

  /* a phone */
  @media (max-width: 760px) {
    .top { gap: 6px; padding: 8px; flex-wrap: wrap; }
    .title { padding: 3px 12px 3px 3px; } .title small { display: none; } .title img { width: 30px; height: 30px; } .title b { font-size: 17px; }
    .builder:not(.tall) .title b { display: none; }
    .back { width: 38px; height: 38px; }
    .score { min-width: 64px; padding: 2px 10px; } .score b { font-size: 22px; }
    .meter { order: 9; flex-basis: 100%; max-width: none; margin: 4px 14px 0; }
    .clock { width: 50px; height: 50px; } .clock span { width: 38px; height: 38px; font-size: 18px; }
    .combo { font-size: 15px; padding: 3px 10px; }
    .order { top: 112px; padding: 6px 18px 8px; min-width: 150px; }
    .order b { font-size: 48px; }
    .order.small b { font-size: 24px; }
    .readout { top: 60px; } .readout b { font-size: 40px; } .words { font-size: 14px; } .sum { font-size: 16px; }
    .msg { top: 216px; font-size: 15px; padding: 6px 14px; }
    .readout ~ .msg { top: 214px; }
    .bin { gap: 0; flex-direction: column; align-items: center; }
    .add { width: 104px; padding: 4px 4px 6px; border-radius: 16px; }
    .add img { height: 40px; }
    .add .n { font-size: 12px; } .add .n b { font-size: 20px; }
    .add .plus { width: 26px; height: 26px; font-size: 20px; }
    .minus { position: absolute; left: -8px; bottom: -8px; margin: 0; width: 32px; height: 32px; z-index: 1; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(60, 30, 10, .3); }
    .pop { top: 44%; }
    .acts-bar { bottom: 12px; gap: 6px; }
    .acts-bar .btn { font-size: 15px; padding: 8px 12px; }
    .buildb { font-size: 22px !important; padding: 12px 30px !important; }
    .hero { height: 120px; }
    .start h1, .done h1 { font-size: 30px; }
    .lead { font-size: 15px; }
    .how li { font-size: 14px; }
  }
  /* the one Pause button sits top left on every activity: the title chip starts after it */
  .top { padding-left: 76px; }
  @media (max-width: 600px) { .top { padding-left: 62px; } }
</style>
