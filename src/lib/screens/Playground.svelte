<script lang="ts">
  // The Number Playground: three calm math games (no clock, no rides): pick a game and a level, play a
  // round on one of the islands with your 3D buddy hopping, cheering and dancing beside the numbers, and
  // the end card shows the stars, the friendship it earned and anything new for your team.
  import { game } from '../state/game.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { danceOf, outfitOf, palOf, type Profile } from '../engine/profile';
  import { stage } from '../three/stage';
  import { PlayScene } from '../three/playScene';
  import type { PlayBuddy } from '../math/play/buddy';
  import type { RegionId } from '../engine/course';
  import { FRIEND } from '../art/cast';
  import { sfx } from '../audio/sound';
  import { PLAY_GAMES, PLAY_GAME, applyPlay, playNextLevel, playOf, playUnlocked, type PlayGame, type PlayOutcome } from '../math/playground';
  import NumberLine from '../math/play/NumberLine.svelte';
  import Bubbles from '../math/play/Bubbles.svelte';
  import BuildIt from '../math/play/BuildIt.svelte';
  import Stall from '../math/play/Stall.svelte';
  import Sketch from '../math/play/Sketch.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import MenuButton from '../ui/MenuButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import { builderOpen } from '../math/place/builder';

  const p = $derived(game.profile!);
  let playing = $state<{ g: PlayGame; level: number; key: number } | null>(null);
  let done = $state<{ stars: 0 | 1 | 2 | 3; out: PlayOutcome; g: PlayGame; level: number } | null>(null);
  let burst = $state(0);
  let k = 0;
  // the 3D island and buddy behind each game
  const WORLD: Record<PlayGame, RegionId> = { line: 'village', bonds: 'shores', build: 'burrows', stall: 'treetops', sketch: 'ridge' };
  let scene: PlayScene | null = null;
  let areaEl: HTMLElement | null = null;
  let areaOpts: { span?: number; feetAt?: number } = {};
  let pending: { sx: number; now: boolean } | null = null;
  const viewOf = (el: HTMLElement) => { const r = el.getBoundingClientRect(); return { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth }; };
  function fit() { if (scene && areaEl) { scene.setView(viewOf(areaEl)); if (areaOpts.span) scene.span = areaOpts.span; if (areaOpts.feetAt != null) scene.feetAt = areaOpts.feetAt; } }
  async function openWorld(g: PlayGame) {
    const old = scene; scene = null;
    const sc = await PlayScene.create({ buddy: p.buddy, outfit: outfitOf(p), region: WORLD[g], view: { top: 0.4, bottom: 0.9, left: 0.6, right: 0.95 }, spot: 40 });
    if (!playing || playing.g !== g) { sc.dispose(); return; }
    scene = sc; fit(); stage.use(sc);
    if (pending) { requestAnimationFrame(() => { scene?.hopToScreen(pending!.sx, pending!.now); pending = null; }); }
    if (old && old !== sc) old.dispose();
  }
  const pal: PlayBuddy = {
    area(el, opts = {}) { areaEl = el; areaOpts = opts; fit(); },
    hop(sx, now = false) { if (scene) { fit(); scene.hopToScreen(sx, now); } else pending = { sx, now }; },
    cheer() { scene?.cheer(); },
    oops() { scene?.oops(); },
  };
  function onResize() { requestAnimationFrame(fit); }
  // a game picked on the Math page's Games tab starts straight away, at its next level
  onMount(() => {
    const g = game.playPick as PlayGame | null;
    game.playPick = null;
    if (g && PLAY_GAME[g]) start(g, playNextLevel(p, g));
  });
  /** back to the Math page, on its Games tab (the playground's toys are math games) */
  function toMath() { sfx.click(); game.setHome('math'); game.way = { ...game.way, math: 'games' }; game.go('map'); }
  onDestroy(() => { if (scene && stage.current() === scene) stage.use(null); scene?.dispose(); });

  function start(g: PlayGame, level: number) {
    if (!playUnlocked(p, g, level)) { sfx.nope(); game.say('Get a star on the level before to open this one!'); return; }
    sfx.click(); done = null; const same = playing?.g === g; playing = { g, level, key: ++k };
    if (!same || !scene) openWorld(g);
  }
  function finished(r: { stars: 0 | 1 | 2 | 3; ms: number }) {
    if (!playing) return;
    const out = applyPlay($state.snapshot(game.profile!) as Profile, { game: playing.g, level: playing.level, stars: r.stars, ms: r.ms, at: Date.now() });
    game.replaceProfile(out.profile);
    done = { stars: r.stars, out, g: playing.g, level: playing.level };
    playing = null; burst++;
    scene?.dance(danceOf(game.profile!));
    for (let i = 0; i < r.stars; i++) setTimeout(() => sfx.star(i), 300 + i * 300);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Escape') { if (playing || done) { backToGames(); } else toMath(); }
    if (done && e.key === 'Enter') { e.preventDefault(); const n = done.level < 5 && playUnlocked(p, done.g, done.level + 1) ? done.level + 1 : done.level; start(done.g, n); }
  }
  const WHAT: Record<PlayGame, string> = {
    line: 'Learns: where numbers sit, estimating, tens and hundreds.',
    bonds: 'Learns: number bonds, pairs that make 5, 10, 20 and 100.',
    build: 'Learns: place value, hundreds, tens and ones, trading ten for one.',
    stall: 'Learns: coins and money, counting up to make change.',
    sketch: 'Learns: the coordinate grid, all four quadrants, and flipping over an axis.',
  };
  function openBlocks() { sfx.click(); builderOpen.toy = true; builderOpen.from = 'playground'; game.go('builder'); }
  function backToGames() { playing = null; done = null; if (scene && stage.current() === scene) stage.use(null); scene?.dispose(); scene = null; }
  // each game's painted picture (number line with a hopping frog, bubbles, place-value blocks)
  const ART: Record<PlayGame, 'line' | 'bubbles' | 'blocks' | null> = { line: 'line', bonds: 'bubbles', build: 'blocks', stall: null, sketch: null };
</script>

<svelte:window onkeydown={onKey} onresize={onResize} />

<div class="screen pg" class:world={!!playing || !!done} style:background-image={playing || done ? null : `linear-gradient(rgba(236, 244, 255, .9), rgba(250, 246, 255, .94)), url(${import.meta.env.BASE_URL}math/strand-playground.webp)`}>
  <header class="bar">
    <NavTile size="sm" tone="sky" kind="home" label="Home" onclick={() => game.go('hub')} />
    <h1>{playing ? PLAY_GAME[playing.g].name : 'Number Playground'}</h1>
    <div class="spacer"></div>
    {#if playing}<button class="btn ghost" onclick={backToGames}>Back to games</button>
    {:else}<button class="btn ghost withimg" onclick={toMath}><img src="{import.meta.env.BASE_URL}icons/arcade.webp" alt="" />Math games</button>{/if}
    <MenuButton size={36} />
  </header>

  <div class="body scroll">
    {#if playing}
      {#key playing.key}
        <div class="stage">
          <p class="lvl">Level {playing.level} · {PLAY_GAME[playing.g].levels[playing.level - 1].title} <span>{PLAY_GAME[playing.g].levels[playing.level - 1].hint}</span></p>
          {#if playing.g === 'line'}<NumberLine level={playing.level} buddy={p.buddy} ondone={finished} {pal} />
          {:else if playing.g === 'bonds'}<Bubbles level={playing.level} buddy={p.buddy} ondone={finished} {pal} />
          {:else if playing.g === 'stall'}<Stall level={playing.level} buddy={p.buddy} ondone={finished} {pal} />
          {:else if playing.g === 'sketch'}<Sketch level={playing.level} buddy={p.buddy} ondone={finished} {pal} />
          {:else}<BuildIt level={playing.level} buddy={p.buddy} ondone={finished} {pal} />{/if}
        </div>
      {/key}
    {:else}
      <div class="hello">
        <Critter friend={p.buddy} accessory={outfitOf(p)} size={96} mood="idle" />
        <p>No clock here: take your time. Every round still counts for you and {FRIEND[p.buddy].name}.</p>
      </div>
      <div class="games">
        {#each PLAY_GAMES as g (g.id)}
          {@const rec = playOf(p, g.id)}
          {@const nxt = playNextLevel(p, g.id)}
          <section class="game" style:--gc={g.color}>
            <button class="gpic" onclick={() => start(g.id, nxt)} aria-label="Play {g.name}">
              <img src="{import.meta.env.BASE_URL}math/play-{g.id === 'bonds' ? 'bubbles' : g.id}.webp" alt="" />
              <span class="gname"><span class="gart">{#if ART[g.id]}<Icon name={ART[g.id]!} size={40} />{:else}<img class="gcoin" src="{import.meta.env.BASE_URL}{g.id === 'sketch' ? 'game/icon-star.webp' : 'math/money/quarter.webp'}" alt="" />{/if}</span>{g.name}</span>
            </button>
            <p class="gblurb">{g.blurb} <span class="what">{WHAT[g.id]}</span></p>
            <div class="levels">
              {#each g.levels as l (l.n)}
                {@const open = playUnlocked(p, g.id, l.n)}
                <button class="lv" class:locked={!open} class:next={l.n === nxt} onclick={() => start(g.id, l.n)} title={l.hint}>
                  <span class="ln">{#if open}{l.n}{:else}<Icon name="lock" />{/if}</span>
                  <span class="lt">{l.title}</span>
                  <Stars n={rec.stars[l.n - 1] ?? 0} size={14} />
                </button>
              {/each}
            </div>
            <button class="btn btn-primary play" onclick={() => start(g.id, nxt)}>Play level {nxt}</button>
          </section>
        {/each}
        <!-- the Block Table: a calm 3D place value mat with no levels and no clock (screen 'builder', toy mode) -->
        <section class="game toy" style:--gc="#2d6fb8">
          <button class="gpic" onclick={openBlocks} aria-label="Open the Block Table">
            <img src="{import.meta.env.BASE_URL}math/play-blocks.webp" alt="" />
          </button>
          <div class="tbody">
            <h2>Block Table</h2>
            <p class="gblurb">Build any number with hundreds, tens and ones, and see it written out. Trade ten cubes for a rod, or break a rod into ten cubes. <span class="what">Learns: tens and ones, hundreds, trading.</span></p>
            <button class="btn btn-primary play" onclick={openBlocks}>Open the Block Table</button>
          </div>
        </section>
      </div>
    {/if}
  </div>

  {#if done}
    {@const g = PLAY_GAME[done.g]}
    {@const canNext = done.level < 5 && playUnlocked(game.profile!, done.g, done.level + 1)}
    <div class="veil">
      <div class="card endc">
        <Critter friend={p.buddy} accessory={outfitOf(p)} size={110} mood="dance" />
        <h2>{done.stars === 3 ? 'Brilliant!' : done.stars === 2 ? 'Great work!' : done.stars === 1 ? 'Round done!' : 'Nearly!'}</h2>
        <p class="sub">{g.name} · level {done.level}</p>
        <Stars n={done.stars} of={3} size={54} animate />
        {#if done.out.opened}<p class="open">Level {done.out.opened} is open!</p>{:else if done.stars === 0}<p class="open">A few more right for a star. Have another go!</p>{/if}
        <div class="xp">
          <div class="xptop"><span>{FRIEND[p.buddy].name} · <Icon name="heart" size={16} /> Friendship {done.out.xp.after.level}</span><b>+{done.out.xp.gained} XP</b></div>
          <div class="xbar"><i style:width="{(done.out.xp.after.into / done.out.xp.after.need) * 100}%"></i></div>
        </div>
        {#if done.out.rewards.length || done.out.stickers.length || done.out.medals.length || done.out.buddies.length}
          <div class="news">
            {#each done.out.medals as m}<span class="chip"><Icon name="medal" size={18} /> {m.name}</span>{/each}
            {#each done.out.rewards as r}<span class="chip"><Icon name={r.kind === 'dance' ? 'dance' : 'hanger'} dance={r.id} size={18} /> New {r.kind}: {r.name}</span>{/each}
            {#each done.out.stickers as s}<span class="chip"><Icon name="sticker" size={18} /> Sticker: {s.name}</span>{/each}
            {#each done.out.buddies as b}<span class="chip new"><Icon name="popper" size={18} /> {FRIEND[b].name} joined your team!</span>{/each}
          </div>
        {/if}
        <div class="acts">
          <button class="btn ghost" onclick={backToGames}>All games</button>
          <button class="btn" onclick={() => start(done!.g, done!.level)}>Again</button>
          {#if canNext}<button class="btn btn-primary" onclick={() => start(done!.g, done!.level + 1)}>Next level <span class="kbd">enter</span></button>{/if}
        </div>
      </div>
      <Confetti {burst} count={70} x={50} y={30} spread={1.4} />
    </div>
  {/if}
</div>

<style>
  .pg { display: flex; flex-direction: column; background-color: #eef4ff; background-size: cover; background-position: center; }
  .pg.world { background: transparent; }
  .bar { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); z-index: 3; }
  .bar h1 { font-size: 28px; margin: 0; }
  .spacer { flex: 1; }
  .ghost { background: var(--bg2); color: var(--ink); box-shadow: none; }
  .withimg { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px 6px 6px; }
  .withimg img { width: 32px; height: 32px; object-fit: contain; }
  .body { flex: 1; min-height: 0; padding: 18px 22px 28px; }
  .hello { display: flex; align-items: center; gap: 14px; justify-content: center; margin-bottom: 12px; }
  .hello p { margin: 0; font: 600 19px/1.35 var(--font-body); background: #fff; padding: 10px 16px; border-radius: 18px; box-shadow: var(--shadow-sm); max-width: 560px; }
  .games { display: grid; grid-template-columns: repeat(auto-fit, minmax(270px, 1fr)); gap: 18px; max-width: 1240px; margin: 0 auto; }
  .game { background: #fff; border-radius: 26px; box-shadow: 0 14px 34px -22px rgba(60, 40, 110, .5); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .game { padding: 0 0 16px; overflow: hidden; }
  .game > :not(.gpic) { margin-left: 16px; margin-right: 16px; }
  .gpic { position: relative; border: 0; padding: 0; cursor: pointer; aspect-ratio: 16 / 8; overflow: hidden; background: #dfe9f5; }
  .gpic img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s; }
  .toy { grid-column: 1 / -1; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); align-items: center; padding: 0; }
  .toy > .gpic { height: 100%; aspect-ratio: auto; min-height: 170px; }
  .toy .tbody { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 16px 0; }
  .toy h2 { margin: 0; font: 600 26px var(--font-ui); color: var(--gc); }
  .toy .play { align-self: flex-start; }
  .game:hover .gpic img { transform: scale(1.05); }
  .gname { position: absolute; left: 12px; bottom: 10px; display: flex; align-items: center; gap: 8px; font: 600 25px var(--font-ui); color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .5); }
  .gpic .gcoin { width: 36px; height: 36px; object-fit: contain; }
  .gart { flex: none; display: grid; place-items: center; width: 50px; height: 46px; border-radius: 12px; background: color-mix(in srgb, var(--gc) 22%, #fff); box-shadow: 0 0 0 3px #fff; }
  .gblurb { margin: 0; font: 600 14.5px/1.4 var(--font-body); color: var(--ink2); }
  .what { display: block; margin-top: 4px; color: var(--muted); font-size: 13px; }
  .levels { display: flex; flex-direction: column; gap: 6px; }
  .lv { display: flex; align-items: center; gap: 10px; border: 0; border-radius: 14px; background: var(--bg2); padding: 6px 10px; cursor: pointer; text-align: left; transition: transform .12s; }
  .lv:hover { transform: translateX(3px); }
  .lv.next { box-shadow: inset 0 0 0 3px var(--gc); background: #fff; }
  .lv.locked { opacity: .55; }
  .ln { width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--gc); color: #fff; font: 600 17px var(--font-ui); flex: none; }
  .locked .ln { background: #cfc7e2; }
  .lt { flex: 1; font: 700 15px var(--font-body); color: var(--ink); }
  .play { background: linear-gradient(color-mix(in srgb, var(--gc) 70%, #fff), var(--gc)); box-shadow: 0 5px 0 color-mix(in srgb, var(--gc) 70%, #000); font-size: 20px; }
  .stage { display: flex; flex-direction: column; gap: 6px; }
  .world .bar { background: rgba(255, 255, 255, .85); }
  .lvl { margin: 0 auto; font: 700 15px var(--font-body); color: var(--ink2); background: #fff; padding: 6px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .lvl span { color: var(--muted); margin-left: 6px; }
  .veil { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(40, 28, 70, .35); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); padding: 12px; }
  .endc { width: min(460px, 94vw); padding: 18px 22px 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.4); }
  .endc h2 { margin: 0; font-size: 34px; }
  .sub { margin: 0; font: 700 15px var(--font-body); color: var(--muted); }
  .open { margin: 0; font: 600 18px var(--font-ui); background: var(--lemon); padding: 4px 14px; border-radius: 999px; }
  .xp { width: 100%; margin-top: 6px; }
  .xptop { display: flex; justify-content: space-between; font: 800 13px var(--font-body); color: var(--primary-edge); margin-bottom: 4px; }
  .xptop b { color: var(--mint-edge); }
  .xbar { height: 14px; border-radius: 999px; background: var(--bg2); overflow: hidden; }
  .xbar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary-hi), var(--pink), var(--lemon)); transition: width .8s ease; }
  .news { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
  .chip { display: inline-flex; align-items: center; gap: 4px; font: 700 13px var(--font-body); background: #f6f1ff; border-radius: 999px; padding: 4px 10px; }
  .chip.new { background: #fff3c4; }
  .acts { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
  @media (max-width: 900px) { .bar :global(.tile .lbl) { display: none; } .games { grid-template-columns: 1fr; } .body { padding: 10px 10px 20px; } .bar { padding: 8px 10px; } .bar h1 { font-size: 20px; } .hello p { font-size: 15px; } .hello :global(.critter-host) { width: 64px !important; height: 64px !important; } .toy { grid-template-columns: 1fr; } .toy > .gpic { aspect-ratio: 16 / 8; min-height: 0; } .toy .tbody { padding: 0; } }
</style>
