<script lang="ts" module>
  import type { MedalWin, XpInfo } from '../engine/profile';
  import type { StickerDef } from '../engine/stickers';
  import type { Reward } from '../engine/rewards';
  /** What the end of any run (a typing lesson, a math trip) shows: the same layout for every game. */
  export type ResultsRun = {
    stars: number; treasure: number; newBestTreasure: boolean; bestRide: number;
    medals: MedalWin[]; rewards: Reward[]; stickers: StickerDef[]; xp: XpInfo;
    /** buddies who joined the team with this run */
    buddies?: import('../art/cast').FriendId[];
    /** Adventure eggs this practice warmed until ready to hatch */
    eggsReady?: import('../adventure/glimmers').Rarity[];
    /** Adventure shells this practice earned */
    shells?: number;
  };
  /** One of the four chips under the score: speed, accuracy, goal, top ride. */
  export type ResultsChip = { icon: 'clock' | 'target' | 'trophy' | 'ride'; value: string | number; label: string; badge?: string | false };
</script>

<script lang="ts">
  // The end of a run, for every game: the buddy on the best ride with the treasure the score found (sun
  // rays, sparkles, the row of all ten), the medals and keepsakes in the corner card, and the card with
  // the score ring, stars, four chips, friendship and the buttons. Each game brings its words and numbers
  // and can add a block of its own (math shows every fact of the trip).
  import { onDestroy, onMount, type Snippet } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { game } from '../state/game.svelte';
  import { RIDES, rideName, type Move } from '../engine/rides';
  import { danceOf, outfitOf, palOf, setLook } from '../engine/profile';
  import { MEDAL_TIERS } from '../engine/stickers';
  import { FRIEND } from '../art/cast';
  import { TREASURES } from '../engine/rewards';
  import { rideIcon } from '../art/vehicles';
  import { renderMedal, TIER_LOOK } from '../art/stickerArt';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { RunScene } from '../three/runScene';
  import Critter from './Critter.svelte';
  import Stars from './Stars.svelte';
  import Confetti from './Confetti.svelte';
  import StickerCard from './StickerCard.svelte';
  import NavTile from './NavTile.svelte';
  import GearButton from './GearButton.svelte';
  import Icon from './Icon.svelte';

  type Props = {
    run: ResultsRun;
    title: string; sub: string; word: string;
    score: number; goalScore: number; passed: boolean;
    chips: ResultsChip[];
    /** treasure thresholds, and where the score comes from ("in a lesson") */
    treasureAt: number[]; treasureWhere: string;
    /** under the ride banner when no ride was reached ("Type faster to reach") */
    rideHint: string;
    goalText?: string; openedText?: string | null; nextTitle: string;
    makeScene: () => Promise<RunScene>;
    onretry: () => void; onnext: () => void; onhome: () => void;
    /** the first small button: Progress for typing, the Fact Garden for math */
    progress: { label: string; tone?: 'lilac' | 'pink' | 'mint' | 'sky' | 'butter'; kind?: 'chart'; art?: Snippet; onclick: () => void };
    badges?: Snippet; ringExtra?: Snippet; extra?: Snippet;
    /** how the buddy travelled (the math courses name and draw their speed steps their own way) */
    move?: Move;
  };
  let { run, title, sub, word, score, goalScore, passed, chips, treasureAt, treasureWhere, rideHint, goalText = '', openedText = null, nextTitle,
    makeScene, onretry, onnext, onhome, progress, badges, ringExtra, extra, move = 'run' }: Props = $props();

  const p = game.profile!;
  const look = p.settings.look;
  const buddy = p.buddy;
  const pal = palOf(p);

  let starsShown = $state(0);
  let showStats = $state(false);
  let showXp = $state(false);
  let showButtons = $state(false);
  let burst = $state(0);
  let bigBurst = $state(0);
  const scoreT = new Tween(0, { duration: 1200, easing: cubicOut });
  const xpFill = new Tween(0, { duration: 900, easing: cubicOut });
  let xpLevel = $state(run.xp.before.level);
  let levelPop = $state(0);
  let earnedShown = $state(0);
  let wearing = $state<string | null>(null);
  let dancingNow = $state<string | null>(null);
  let scene: RunScene | null = null;
  let rootEl: HTMLDivElement | undefined = $state();
  let heroEl: HTMLDivElement | undefined = $state();
  let bannerEl: HTMLDivElement | undefined = $state();
  let heroH = $state(800);
  let heroW = $state(1280);
  let gridW = $state(560);
  // phones: the buddy on top, then the card, then the rewards, one column that scrolls
  const narrow = $derived(heroW < 860);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  // everything this run earned, shown together: medals, then outfits and dances, then stickers
  // medals come every time you do the thing ("this run"); the rest are once-only ("new")
  type Earned =
    | { kind: 'outfit' | 'dance'; id: string; name: string; rarity: string }
    | { kind: 'medal'; m: MedalWin }
    | { kind: 'sticker'; def: StickerDef }
    | { kind: 'buddy'; id: import('../art/cast').FriendId }
    | { kind: 'egg'; rarity: import('../adventure/glimmers').Rarity }
    | { kind: 'shells'; n: number };
  const thisRun: Earned[] = run.medals.map(m => ({ kind: 'medal' as const, m }));
  const fresh: Earned[] = [
    ...(run.shells ? [{ kind: 'shells' as const, n: run.shells }] : []),
    ...(run.eggsReady ?? []).map(rarity => ({ kind: 'egg' as const, rarity })),
    ...(run.buddies ?? []).map(id => ({ kind: 'buddy' as const, id })),
    ...run.rewards.map(r => ({ kind: r.kind, id: r.id, name: r.name, rarity: r.rarity })),
    ...run.stickers.map(def => ({ kind: 'sticker' as const, def })),
  ];
  const earned: Earned[] = [...thisRun, ...fresh];
  // a medal or sticker tapped on this screen, shown big with its description
  let detail = $state<Earned | null>(null);
  function show(e: Earned) { detail = e; sfx.pop(); }
  // a treasure tapped in the row under the prize: any of the ten, found or not
  let tdetail = $state<number | null>(null);
  function showTreasure(i: number) { tdetail = i; sfx.pop(); }
  const treasureBest = $derived(game.profile ? palOf(game.profile).treasureBest : -1);
  function nextTier(count: number) {
    const n = MEDAL_TIERS.find(t => t.at > count);
    return n ? { text: `${count}/${n.at}`, title: `${count} of ${n.at} to ${n.name}` } : { text: `×${count}`, title: `Won ${count} times` };
  }
  // pick the biggest tile size that still fits every reward in the panel
  // the panel's own height cap (39%) minus its padding and section titles
  const panelH = $derived(Math.max(140, heroH * 0.39 - 34 - (thisRun.length ? 32 : 0) - (fresh.length ? 32 : 0)));
  const cellGuess = $derived.by(() => {
    if (narrow) return 64;
    const gap = 10;
    for (let s = 120; s > 46; s -= 4) {
      const cols = Math.max(1, Math.floor((gridW + gap) / (s + gap)));
      // names can run to two lines; medals carry their progress under that
      const h = Math.ceil(thisRun.length / cols) * (s + 62 + gap) + Math.ceil(fresh.length / cols) * (s + 46 + gap);
      if (h <= panelH) return s;
    }
    return 46;
  });
  // and if it still doesn't fit once drawn (long names), shrink the tiles until it does: no scroll bar
  let shrink = $state(0);
  let earnedEl: HTMLDivElement | undefined = $state();
  const cell = $derived(Math.max(40, cellGuess - shrink));
  $effect(() => {
    void cell; void heroH; void gridW;
    requestAnimationFrame(() => { if (!narrow && earnedEl && earnedEl.scrollHeight > earnedEl.clientHeight + 1 && cell > 40) shrink += 4; });
  });
  const best = run.bestRide;
  const treasure = run.treasure;
  const tsrc = (i: number) => `${import.meta.env.BASE_URL}treasures/${TREASURES[i].id}.webp`;
  // the prize: a big treasure that pops up beside your buddy, with a celebration
  let prizeOn = $state(false);
  let prizeSettled = $state(false);
  let prizeBurst = $state(0);
  let prizeBox = $state({ x: 30, y: 30, size: 200 });
  let prizeRaf = 0;
  const nextT = treasure + 1 < TREASURES.length ? { name: TREASURES[treasure + 1].name, at: treasureAt[treasure + 1] } : null;
  function trackPrize() {
    if (scene && heroEl && rootEl) {
      const b = scene.screenBox(), r = heroEl.getBoundingClientRect(), box = rootEl.getBoundingClientRect();
      const hPx = Math.max(80, (b.bottom - b.top) * innerHeight);
      const size = narrow ? Math.min(r.width * 0.36, r.height * 0.5) : Math.min(r.width * 0.38, Math.max(150, hPx * 0.78));
      // to the right of the buddy, at head height, so its banner and prize row stay clear of the ride banner below
      let x = narrow ? r.right - size * 0.62 : b.x * innerWidth + hPx * 0.38 + size * 0.5;
      x = Math.min(r.right - size * 0.5 - 8, x);
      let y = narrow ? r.top + size * 0.62 : Math.max(r.top + size * 0.55, b.top * innerHeight + hPx * 0.12);
      // keep the prize, its ribbon and its row of treasures clear of the speed banner under the buddy
      if (!narrow && bannerEl) y = Math.max(size * 0.55 + 8, Math.min(y, bannerEl.getBoundingClientRect().top - size * 0.5 - 118));
      // in the screen's own space, which scrolls on a phone
      prizeBox = { x: x - box.left + rootEl.scrollLeft, y: y - box.top + rootEl.scrollTop, size };
    }
    prizeRaf = requestAnimationFrame(trackPrize);
  }
  const ringC = 2 * Math.PI * 64;

  /** The 3D view uses the hero area (it moves when a phone scrolls). */
  function updateView() {
    if (!scene || !heroEl) return;
    const r = heroEl.getBoundingClientRect();
    scene.view = { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth };
  }
  $effect(() => { void heroW; void heroH; void narrow; requestAnimationFrame(updateView); });

  onMount(() => {
    // the run's scene carries on (the buddy has just danced at the gate); if it isn't there, make one
    const cur = stage.current();
    const ready = cur instanceof RunScene ? Promise.resolve(cur) : makeScene().then(sc => { sc.pos = sc.goal = sc.finishS; stage.use(sc); return sc; });
    ready.then(sc => { scene = sc; sc.onCelebrated = null; sc.results(best); updateView(); trackPrize(); });
    let t = 250;
    at(t, () => (scoreT.target = score));
    for (let i = 0; i < 3; i++) { at(t + 300 + i * 330, () => { starsShown = i + 1; if (i < run.stars) sfx.star(i); }); }
    t += 1300;
    if (treasure >= 0) {
      at(t, () => { prizeOn = true; prizeBurst++; sfx.treasure(treasure); scene?.cheer(); });
      at(t + 1400, () => (prizeSettled = true));
      t += 900;
    }
    at(t, () => { showStats = true; if (passed) burst++; });
    at(t + 200, () => (showButtons = true));
    t += 500;
    // XP: fill through every level gained
    const xb = run.xp.before, xa = run.xp.after;
    at(t, () => { showXp = true; xpFill.set(xb.into / xb.need, { duration: 0 }); });
    t += 250;
    for (let L = xb.level; L < xa.level; L++) {
      at(t, () => (xpFill.target = 1));
      t += 900;
      at(t, () => { xpLevel = L + 1; levelPop++; bigBurst++; sfx.levelUp(3); xpFill.set(0, { duration: 0 }); });
      t += 700;
    }
    at(t, () => (xpFill.target = xa.into / xa.need));
    t += 600;
    earned.forEach((e, i) => {
      at(t, () => {
        earnedShown = i + 1;
        if (e.kind === 'outfit' || e.kind === 'dance' || e.kind === 'buddy' || e.kind === 'egg') { sfx.complete(); burst++; }
        else if (e.kind === 'medal') sfx.badge();
        else sfx.pop();
      });
      t += e.kind === 'outfit' || e.kind === 'dance' || e.kind === 'buddy' || e.kind === 'egg' ? 650 : 180;
    });
  });
  onDestroy(() => { timers.forEach(clearTimeout); cancelAnimationFrame(prizeRaf); stage.use(null); });

  function wear(id: string) {
    game.update(pp => setLook(pp, buddy, { outfit: id }));
    wearing = id;
    trying = null;
    scene?.me.wear(id, (o) => import('../three/outfits3d').then(m => m.makeOutfit(o)));
    sfx.pop();
  }
  // a closer look at something new, without wearing it, dancing it for good or switching buddies
  let peek = $state<Earned | null>(null);
  let trying = $state<{ id: string; name: string } | null>(null);
  function peekAt(e: Earned) { peek = e; sfx.pop(); }
  /** Put an outfit on the 3D buddy just to see it (nothing is saved). */
  function tryOn(id: string, name: string) {
    trying = { id, name }; peek = null;
    scene?.me.wear(id, (o) => import('../three/outfits3d').then(m => m.makeOutfit(o)));
    scene?.cheer();
    sfx.pop();
  }
  function takeOff() {
    trying = null;
    scene?.me.wear(heroOutfit, (o) => import('../three/outfits3d').then(m => m.makeOutfit(o)));
    sfx.pop();
  }
  /** Dance now, on the 3D buddy; `keep` makes it the celebration at the finish from now on. */
  function dance(id: string, keep = false) {
    if (keep) game.update(pp => setLook(pp, buddy, { dance: id }));
    dancingNow = id;
    scene?.dance(id);
    sfx.pop();
  }
  const myDance = $derived(game.profile ? danceOf(game.profile, buddy) : danceOf(p));
  const opened = performance.now();
  function onKey(e: KeyboardEvent) {
    if (detail || tdetail !== null || peek) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); detail = null; tdetail = null; peek = null; } return; }
    if (performance.now() - opened < 1200 || game.modalOpen) return;
    if (e.key === 'Enter') { e.preventDefault(); passed ? onnext() : onretry(); }
    if (e.key === ' ') { e.preventDefault(); onretry(); }
    if (e.key === 'Escape') onhome();
  }
  const heroOutfit = $derived(wearing ?? (game.profile ? outfitOf(game.profile, buddy) : 'none'));
  const scoreHue = run.stars >= 3 ? 'gold' : run.stars === 2 ? 'mint' : run.stars === 1 ? 'sky' : 'lilac';
  const big = $derived(narrow ? 'md' : 'lg');
</script>

<svelte:window onkeydown={onKey} />

<div class="screen results" class:narrow bind:this={rootEl} bind:clientHeight={heroH} bind:clientWidth={heroW} onscroll={updateView}>

  <div class="corner"><GearButton size={40} /></div>

  {#if prizeOn}
    <div class="prize" class:settled={prizeSettled} style:left="{prizeBox.x}px" style:top="{prizeBox.y}px" style:--sz="{prizeBox.size}px">
      <div class="prays"></div>
      <div class="pglow"></div>
      <img src={tsrc(treasure)} alt={TREASURES[treasure].name} />
      {#each Array(10) as _, i}<i class="spark" style:--a="{i * 36}deg" style:--d="{(i % 3) * 0.12}s"></i>{/each}
      <div class="pribbon"><small>{run.newBestTreasure ? 'New best!' : 'You found'}</small><b>{run.newBestTreasure ? TREASURES[treasure].name + '!' : 'a ' + TREASURES[treasure].name + '!'}</b></div>
      <div class="pladder">
        <div class="pdots">{#each TREASURES as tr, i}<button class:got={i <= treasure} class:now={i === treasure} title={tr.name} aria-label={tr.name} onclick={() => showTreasure(i)}><img src={tsrc(i)} alt="" /></button>{/each}</div>
        {#if nextT}<div class="pnext">Score {nextT.at} for a {nextT.name}</div>{:else}<div class="pnext">The best treasure there is!</div>{/if}
      </div>
    </div>
    <Confetti burst={prizeBurst} count={70 + treasure * 8} x={(prizeBox.x / Math.max(1, heroW)) * 100} y={(prizeBox.y / Math.max(1, heroH)) * 100} spread={1.3} />
  {/if}

  <div class="hero" class:full={!earned.length}>
    <div class="ridepic" bind:this={heroEl}></div>
    <button class="dancebtn" onclick={() => dance(myDance)}>♪ Dance!</button>

    <div class="ridebanner" class:top={best >= 4} bind:this={bannerEl}>
      <span class="rbicon"><svg viewBox="0 0 48 48">{@html rideIcon(best, '#fff', move)}</svg></span>
      <span class="rbtext"><small>{best > 0 ? 'You reached' : rideHint}</small><b>{best > 0 ? `${rideName(best, move)}!` : `${rideName(1, move)}!`}</b></span>
    </div>
    <div class="ladder">
      {#each RIDES as r, i (r.id)}
        <span class="rung" class:got={i <= best} class:now={i === best}><svg viewBox="0 0 48 48">{@html rideIcon(i, i <= best ? '#fff' : '#cbc2de', move)}</svg></span>
      {/each}
    </div>
  </div>

  {#if earned.length}
    <div class="earned card" bind:this={earnedEl}>
      {#snippet tile(e: Earned, i: number)}
        <div class="item" class:shown={i < earnedShown}>
          {#if e.kind === 'outfit'}
            <button class="ipic outfit tap rar-{e.rarity}" onclick={() => peekAt(e)} title="Take a look"><img class="othumb" src="{import.meta.env.BASE_URL}outfits/{e.id}.webp" alt="" /></button>
            <button class="wear" onclick={() => wear(e.id)} disabled={heroOutfit === e.id}>{heroOutfit === e.id ? 'Wearing' : 'Wear it'}</button>
          {:else if e.kind === 'dance'}
            <button class="ipic outfit dance tap rar-{e.rarity}" onclick={() => dance(e.id)} title="See it danced"><span class="note">♪</span><span class="dname">{e.name}</span></button>
            <button class="wear" onclick={() => dance(e.id, true)} disabled={myDance === e.id && dancingNow === e.id}>{myDance === e.id ? 'My dance!' : 'Dance it'}</button>
          {:else if e.kind === 'medal'}
            <button class="ipic medal tap" onclick={() => show(e)} title="What's this?">{@html renderMedal(e.m, e.m.tier)}</button>
            <span class="iname">{e.m.name}</span>
            {#if e.m.tierUp && e.m.count > 1}<em class="tier" style:background={TIER_LOOK[e.m.tier].pill} style:color={TIER_LOOK[e.m.tier].ink}>{TIER_LOOK[e.m.tier].name}!</em>{:else}{@const nt = nextTier(e.m.count)}<span class="count" title={nt.title}>{nt.text}</span>{/if}
          {:else if e.kind === 'shells'}
            <button class="ipic outfit tap shellsgot" onclick={() => game.go('adventure')} title="Spend shells in the Adventure shop"><img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /></button>
            <span class="iname">+{e.n} shells</span>
            <span class="count">for Adventure</span>
          {:else if e.kind === 'egg'}
            <button class="ipic outfit tap eggready" onclick={() => game.go('eggs')} title="Hatch it in Adventure"><img src="{import.meta.env.BASE_URL}game/egg-{e.rarity}.webp" alt="" /></button>
            <span class="iname">Egg ready!</span>
            <button class="wear" onclick={() => game.go('eggs')}>Hatch it</button>
          {:else if e.kind === 'buddy'}
            <button class="ipic outfit newbud tap" onclick={() => peekAt(e)} title="Meet {FRIEND[e.id].name}"><Critter friend={e.id} size={cell} round /></button>
            <span class="iname">{FRIEND[e.id].name} joined!</span>
            <button class="wear" onclick={() => { game.update(pp => { pp.buddy = e.id; }); sfx.complete(); }} disabled={game.profile?.buddy === e.id}>{game.profile?.buddy === e.id ? 'Your buddy' : 'Play as'}</button>
          {:else if e.kind === "sticker"}
            <div class="ipic"><StickerCard def={e.def} friend={buddy} {look} outfit={heroOutfit} size={cell} onpick={() => show(e)} /></div>
            <span class="iname">{e.def.name}</span>
          {/if}
        </div>
      {/snippet}
      <div class="ewidth" bind:clientWidth={gridW}></div>
      {#if thisRun.length}
        <div class="ehead"><b>This run</b><span class="muted">medals you can win every time</span></div>
        <div class="egrid" style:--s="{cell}px">{#each thisRun as e, i (i)}{@render tile(e, i)}{/each}</div>
      {/if}
      {#if fresh.length}
        <div class="ehead"><b>New for {FRIEND[buddy].name}</b>{#if trying}<span class="trying">Trying on <b>{trying.name}</b><button class="wear" onclick={() => wear(trying!.id)}>Wear it</button><button class="wear off" onclick={takeOff}>Take it off</button></span>{:else}<span class="muted">outfits, dances, stickers and buddies to keep</span>{/if}</div>
        <div class="egrid" style:--s="{cell}px">{#each fresh as e, i (i)}{@render tile(e, thisRun.length + i)}{/each}</div>
      {/if}
    </div>
  {/if}

  <div class="card panel" class:more={!!extra}>
    <h1>{title}</h1>
    <p class="sub">{sub}</p>
    {@render badges?.()}

    <div class="scorerow">
      <div class="score {scoreHue}">
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r="64" fill="none" stroke="#efeaf8" stroke-width="16" />
          <circle class="ring" cx="80" cy="80" r="64" fill="none" stroke-width="16" stroke-linecap="round" stroke-dasharray={ringC} stroke-dashoffset={ringC * (1 - Math.min(1, scoreT.current / Math.max(1, goalScore)))} transform="rotate(-90 80 80)" />
        </svg>
        <div class="num"><b>{Math.round(scoreT.current)}</b><span>score</span></div>
        {@render ringExtra?.()}
      </div>
      <div class="side">
        <Stars n={Math.min(starsShown, run.stars)} of={3} size={narrow ? 44 : 58} animate />
        <div class="word" class:show={showStats}>{word}</div>
      </div>
    </div>

    <div class="chips" class:show={showStats}>
      {#each chips as c}
        <div class="chip">
          {#if c.icon === 'ride'}<span class="ci rd"><svg viewBox="0 0 48 48" width="22" height="22">{@html rideIcon(best, '#fff', move)}</svg></span>
          {:else}<span class="ci {c.icon}"><Icon name={c.icon} size={20} /></span>{/if}
          <b>{c.value}</b><small>{c.label}</small>{#if c.badge}<em>{c.badge}</em>{/if}
        </div>
      {/each}
    </div>

    {#if extra && showStats}<div class="extra">{@render extra()}</div>{/if}

    {#if showXp}
      <div class="xp">
        <div class="xptop"><span class="lv">{FRIEND[buddy].name} · ♥ Friendship {xpLevel}</span><span class="gain">+{run.xp.gained} XP</span></div>
        <div class="xbar"><i style:width="{xpFill.current * 100}%"></i></div>
        {#if levelPop}{#key levelPop}<div class="lvup">Friendship ♥ {xpLevel}!</div>{/key}{/if}
      </div>
    {/if}

    <!-- a short window with a game's own block: the goal line gives way so the buttons stay in view -->
    {#if goalText && showButtons && !(extra && !narrow && heroH < 1000)}<p class="goal">{goalText}</p>{/if}

    <div class="tiles" class:show={showButtons}>
      <NavTile size={big} tone="sky" kind="home" label="Home" hotkey={narrow ? undefined : 'esc'} onclick={onhome} />
      {#if passed}<NavTile size={big} tone="butter" kind="redo" label="Try again" hotkey={narrow ? undefined : 'space'} onclick={onretry} />{/if}
      <NavTile size={big} tone="mint" kind={passed ? 'play' : 'redo'} label={passed ? 'Next' : 'Try again'} hotkey={narrow ? undefined : passed ? 'enter' : 'space'} title={passed ? `Next: ${nextTitle}` : 'Try again'} onclick={passed ? onnext : onretry} />
    </div>
    <div class="tiles small" class:show={showButtons}>
      <NavTile size="sm" tone={progress.tone ?? 'lilac'} kind={progress.kind} art={progress.art} label={progress.label} onclick={progress.onclick} />
      <NavTile size="sm" tone="butter" kind="stickers" label="Stickers" onclick={() => game.openStickers('stickers')} />
      <NavTile size="sm" tone="sky" kind="medals" label="Medals" onclick={() => game.openStickers('medals')} />
      <NavTile size="sm" tone="lilac" kind="dances" label="Dances" onclick={() => game.openCloset('dances')} />
      <NavTile size="sm" tone="pink" label="Keypals" onclick={() => game.openCloset('outfits')}>
        {#snippet art()}<Critter friend={buddy} size={40} round />{/snippet}
      </NavTile>
    </div>
  </div>

  {#if openedText && showButtons}
    <div class="opened">{openedText}</div>
  {/if}
  {#if detail && (detail.kind === 'medal' || detail.kind === 'sticker')}
    {@const d = detail}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dmodal" onclick={() => (detail = null)}>
      <div class="dcard card" onclick={(ev) => ev.stopPropagation()}>
        {#if d.kind === 'medal'}
          {@const nt = MEDAL_TIERS.find(t => t.at > d.m.count)}
          <div class="dart">{@html renderMedal(d.m, d.m.tier)}</div>
          <span class="dkind">Medal{#if d.m.tier >= 0} · <b style:color={TIER_LOOK[d.m.tier].ink === '#fff' ? 'var(--primary)' : TIER_LOOK[d.m.tier].ink}>{TIER_LOOK[d.m.tier].name}</b>{/if}</span>
          <h3>{d.m.name}</h3>
          <p class="ddesc">{d.m.desc}</p>
          <p class="dmore">You've won it {d.m.count === 1 ? 'once' : `${d.m.count} times`} with {FRIEND[buddy].name}.{' '}{#if nt}Win it {nt.at - d.m.count} more {nt.at - d.m.count === 1 ? 'time' : 'times'} for {nt.name}.{:else}That's the top tier!{/if}</p>
        {:else}
          <div class="dart"><StickerCard def={d.def} friend={buddy} {look} outfit={heroOutfit} size={220} /></div>
          <span class="dkind">Sticker · <b class="rar-{d.def.rarity}">{d.def.rarity}</b></span>
          <h3>{d.def.name}</h3>
          <p class="ddesc">{d.def.desc}</p>
          <p class="dmore">It's in {FRIEND[buddy].name}'s sticker book now.</p>
        {/if}
        <button class="btn btn-primary" onclick={() => (detail = null)}>OK</button>
      </div>
    </div>
  {/if}
  {#if peek && (peek.kind === 'outfit' || peek.kind === 'buddy')}
    {@const d = peek}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dmodal" onclick={() => (peek = null)}>
      <div class="dcard card" onclick={(ev) => ev.stopPropagation()}>
        {#if d.kind === 'outfit'}
          <div class="dart"><img class="obig" src="{import.meta.env.BASE_URL}outfits/{d.id}.webp" alt="" /></div>
          <span class="dkind">Outfit · <b class="rar-{d.rarity}">{d.rarity}</b></span>
          <h3>{d.name}</h3>
          <p class="ddesc">New for {FRIEND[buddy].name}. Try it on to see how it looks; you can wear it any time from the Keypals screen.</p>
          <div class="tnav">
            <button class="btn" onclick={() => tryOn(d.id, d.name)}>Try it on</button>
            <button class="btn btn-primary" onclick={() => { wear(d.id); peek = null; }}>Wear it</button>
          </div>
        {:else if d.kind === 'buddy'}
          <div class="dart bud"><Critter friend={d.id} size={240} /></div>
          <span class="dkind">New Keypal</span>
          <h3>{FRIEND[d.id].name} joined your team!</h3>
          <p class="ddesc">{FRIEND[d.id].quirk}</p>
          <p class="dmore">{FRIEND[d.id].name} starts their own friendship, outfits, stickers and medals when you play together.</p>
          <div class="tnav">
            <button class="btn" onclick={() => (peek = null)}>Not now</button>
            <button class="btn btn-primary" onclick={() => { game.update(pp => { pp.buddy = d.id; }); sfx.complete(); peek = null; }} disabled={game.profile?.buddy === d.id}>{game.profile?.buddy === d.id ? 'Your buddy' : `Play as ${FRIEND[d.id].name}`}</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
  {#if tdetail !== null}
    {@const i = tdetail}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dmodal" onclick={() => (tdetail = null)}>
      <div class="dcard card" onclick={(ev) => ev.stopPropagation()}>
        <div class="dart tart"><img src={tsrc(i)} alt="" /></div>
        <span class="dkind">Treasure · {i + 1} of {TREASURES.length}</span>
        <h3>{TREASURES[i].name}</h3>
        <p class="ddesc">{TREASURES[i].desc}</p>
        <p class="dmore">Score {treasureAt[i]} or more {treasureWhere} to find one.{' '}{#if i === treasure}You found one this time!{:else if i <= treasureBest}{FRIEND[buddy].name} has found one before.{:else}Not found yet. You can do it!{/if}</p>
        <div class="tnav">
          <button class="btn" disabled={i === 0} onclick={() => showTreasure(i - 1)} aria-label="Previous treasure">‹</button>
          <button class="btn btn-primary" onclick={() => (tdetail = null)}>OK</button>
          <button class="btn" disabled={i === TREASURES.length - 1} onclick={() => showTreasure(i + 1)} aria-label="Next treasure">›</button>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={60} x={50} y={30} spread={1.4} />
  <Confetti burst={bigBurst} count={90} x={25} y={35} spread={1.8} />
</div>

<style>
  .results { background: transparent; }
  .dancebtn { position: absolute; left: 60px; top: 2%; z-index: 8; font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(135deg, #b98cff, #ff7ab8); border: 0; border-radius: 999px; padding: 10px 18px; box-shadow: 0 0 0 4px #fff, 0 10px 24px -10px rgba(124, 92, 245, .7); cursor: pointer; }
  /* the prize beside the buddy */
  .prize { position: absolute; z-index: 7; width: var(--sz); height: var(--sz); transform: translate(-50%, -50%); pointer-events: none; }
  .prize > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 12px 18px rgba(60, 40, 110, .35)); animation: prize-in .9s cubic-bezier(.2, .9, .3, 1.4) both, prize-bob 2.4s 1s ease-in-out infinite; }
  .prays { position: absolute; left: -45%; top: -45%; width: 190%; height: 190%; border-radius: 50%; background: repeating-conic-gradient(rgba(255, 245, 200, .75) 0 9deg, rgba(255, 245, 200, 0) 9deg 18deg); mask: radial-gradient(circle, #000 12%, transparent 62%); -webkit-mask: radial-gradient(circle, #000 12%, transparent 62%); animation: spin 9s linear infinite, prays-in .8s ease both; }
  .pglow { position: absolute; left: -15%; top: -15%; width: 130%; height: 130%; border-radius: 50%; background: radial-gradient(circle, rgba(255, 252, 230, .95), rgba(255, 236, 150, .55) 35%, transparent 68%); animation: glow-pulse 1.6s ease-in-out infinite alternate; }
  .spark { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px; margin: -7px; background: #fff; clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); transform: rotate(var(--a)) translateY(calc(var(--sz) * -0.62)) scale(0); animation: spark 1.6s var(--d) ease-out infinite; }
  .pribbon { position: absolute; left: 50%; top: calc(100% - 6px); transform: translateX(-50%); white-space: nowrap; display: flex; flex-direction: column; align-items: center; padding: 6px 20px 8px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, #f7b733, #ff6fae); box-shadow: 0 0 0 4px #fff, 0 10px 24px -10px rgba(200, 80, 120, .7); animation: pop-in .5s .45s cubic-bezier(.3, .8, .4, 1.5) both; }
  .pribbon small { font: 800 11px var(--font-body); letter-spacing: .1em; text-transform: uppercase; opacity: .95; }
  .pribbon b { font: 600 clamp(22px, 3.2vh, 32px)/1.05 var(--font-ui); }
  .pladder { position: absolute; left: 50%; top: calc(100% + 60px); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; opacity: 0; transition: opacity .5s; }
  .prize.settled .pladder { opacity: 1; pointer-events: auto; }
  .pdots { display: flex; gap: 3px; background: rgba(255, 255, 255, .92); padding: 4px 8px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  /* each treasure in the row can be tapped to see what it is */
  .pdots button { width: 30px; height: 30px; padding: 0; border: 0; border-radius: 50%; background: transparent; display: grid; place-items: center; cursor: pointer; transition: transform .15s; }
  .pdots button:hover { transform: scale(1.25); }
  .pdots button img { width: 24px; height: 24px; object-fit: contain; opacity: .35; filter: grayscale(1); }
  .pdots button.got img { opacity: 1; filter: none; }
  .pdots button.now { background: #fff3c4; box-shadow: 0 0 0 2px #f2c94c; }
  .dart.tart img { width: 170px; height: 170px; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(60, 40, 110, .3)); }
  .tnav { display: flex; gap: 10px; align-items: center; }
  .tnav .btn:not(.btn-primary) { font-size: 22px; padding: 6px 14px; }
  .pnext { font: 700 13px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  @keyframes prize-in { 0% { transform: translateY(40%) scale(0) rotate(-30deg); opacity: 0; } 55% { transform: translateY(-12%) scale(1.25) rotate(8deg); opacity: 1; } 100% { transform: none; } }
  @keyframes prize-bob { 50% { transform: translateY(-5%) rotate(-3deg); } }
  @keyframes prays-in { from { opacity: 0; transform: scale(.3); } to { opacity: 1; } }
  @keyframes glow-pulse { to { transform: scale(1.12); opacity: .8; } }
  @keyframes spark { 0% { transform: rotate(var(--a)) translateY(calc(var(--sz) * -0.3)) scale(0); opacity: 1; } 60% { opacity: 1; } 100% { transform: rotate(var(--a)) translateY(calc(var(--sz) * -0.7)) scale(1.1); opacity: 0; } }
  .othumb { width: 90%; height: 90%; object-fit: contain; }
  .ipic.tap { border: 0; background: none; padding: 0; cursor: pointer; transition: transform .15s; }
  .ipic.tap:hover { transform: translateY(-3px) scale(1.05); }
  .dmodal { position: absolute; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(40, 28, 70, .4); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .2s ease; }
  .dcard { width: min(400px, 92vw); padding: 22px 26px 20px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); }
  .dart { width: 220px; height: 220px; display: grid; place-items: center; }
  .dart :global(svg) { width: 100%; height: 100%; }
  .dkind { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .dkind b { text-transform: capitalize; }
  .dkind .rar-rare { color: #2f6fb8; } .dkind .rar-epic { color: #7a4fd0; } .dkind .rar-legendary { color: #8a6400; }
  .dcard h3 { font-size: 28px; margin: 0; }
  .ddesc { margin: 2px 0; font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .dmore { margin: 0 0 10px; font: 600 14px/1.35 var(--font-body); color: var(--muted); }
  .dance { display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #efe4ff, #ffe4f1) !important; }
  .note { font-size: calc(var(--s) * 0.42); line-height: 1; color: #9b6bff; }
  .dname { font: 700 12px/1.1 var(--font-body); color: var(--ink2); text-align: center; padding: 0 4px; }
  .corner { position: absolute; top: 16px; left: 18px; z-index: 8; }
  .hero { position: absolute; left: 2.5%; width: 44%; top: 2%; height: 55%; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; pointer-events: none; }
  .hero.full { height: 94%; }
  .hero > * { pointer-events: auto; }
  .hero .ridepic { pointer-events: none; }
  .ewidth { width: 100%; height: 0; }
  /* the ride's drawing has room around it for tricks: pull the banner up under the vehicle */
  .ridepic { position: absolute; left: 0; right: 0; top: 0; bottom: 96px; }
  .ridebanner { margin-top: 0; display: flex; align-items: center; gap: 12px; padding: 8px 22px 8px 8px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); box-shadow: 0 0 0 5px #fff, 0 12px 30px -10px rgba(124, 92, 245, .7); animation: pop-in .55s .5s cubic-bezier(.3, .8, .4, 1.5) both; }
  .ridebanner.top { background: linear-gradient(135deg, #7c5cf5, #ff6fae, #58b4f0); background-size: 200% 200%; animation: pop-in .55s .5s cubic-bezier(.3, .8, .4, 1.5) both, holo 3s linear infinite; }
  @keyframes holo { to { background-position: 200% 0; } }
  .rbicon { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; background: rgba(255, 255, 255, .25); }
  .rbicon svg { width: 38px; height: 38px; }
  .rbtext { display: flex; flex-direction: column; line-height: 1; }
  .rbtext small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; opacity: .9; }
  .rbtext b { font: 600 clamp(26px, 3.8vh, 36px)/1.05 var(--font-ui); }
  .ladder { display: flex; flex-wrap: wrap; justify-content: center; max-width: 100%; gap: 4px; margin-top: 8px; animation: fade-up .4s .9s ease both; }
  .rung { display: grid; place-items: center; width: clamp(24px, 2.4vw, 32px); height: clamp(24px, 2.4vw, 32px); border-radius: 50%; background: rgba(255, 255, 255, .85); box-shadow: inset 0 0 0 2px #e6dff3; }
  .rung svg { width: 66%; height: 66%; }
  .rung.got { background: linear-gradient(135deg, var(--primary-hi), var(--primary)); box-shadow: none; }
  .rung.now { transform: scale(1.22); box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--primary-hi); }

  .earned { position: absolute; left: 2.5%; bottom: 2.5%; width: 44%; max-height: 39%; overflow-y: auto; scrollbar-width: none; z-index: 6; padding: 12px 16px 14px; display: flex; flex-direction: column; animation: pop-in .45s cubic-bezier(.3, .8, .4, 1.3); }
  .earned::-webkit-scrollbar { display: none; }
  .ehead { display: flex; align-items: baseline; gap: 10px; margin: 2px 0 6px; }
  .egrid + .ehead { margin-top: 10px; }
  .ehead b { font: 600 22px var(--font-ui); }
  .ehead span { font: 700 13px var(--font-body); }
  .egrid { flex: none; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
  .ehead { flex: none; }
  .item { width: var(--s); display: flex; flex-direction: column; align-items: center; gap: 3px; opacity: 0; transform: scale(.4) rotate(-12deg); transition: opacity .3s, transform .45s cubic-bezier(.3, .8, .4, 1.5); }
  .item.shown { opacity: 1; transform: none; }
  .ipic { width: var(--s); height: var(--s); display: grid; place-items: center; }
  .ipic.medal :global(svg) { width: 76%; height: 88%; animation: swing 2.6s ease-in-out infinite; transform-origin: 50% 0; }
  .ipic.outfit { border-radius: 22px; background: radial-gradient(circle, #fff 40%, #f3edff); box-shadow: inset 0 0 0 3px #ece6f6; }
  .ipic.newbud { box-shadow: inset 0 0 0 3px #ffd36b, 0 0 20px rgba(255, 210, 110, .8); animation: swing 2.6s ease-in-out infinite; }
  .ipic.outfit.rar-rare { box-shadow: inset 0 0 0 3px #b9dbf7; }
  .ipic.outfit.rar-epic, .ipic.outfit.rar-legendary { box-shadow: inset 0 0 0 3px #d9b8ff, 0 0 18px rgba(200, 150, 255, .6); }
  @keyframes swing { 0%, 100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
  .iname { font: 700 12px/1.15 var(--font-body); color: var(--ink2); text-align: center; }
  .tier { font: 800 11px var(--font-body); font-style: normal; color: #fff; padding: 2px 8px; border-radius: 999px; animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.6); }
  .count { font: 700 11px var(--font-body); color: var(--muted); white-space: nowrap; }
  .wear { border: 0; border-radius: 999px; padding: 3px 9px; font: 800 11px var(--font-body); white-space: nowrap; background: var(--mint); color: #0f4a36; cursor: pointer; }
  .wear:disabled { background: #eee8f7; color: var(--muted); cursor: default; }
  .shellsgot img { width: 80%; height: 80%; object-fit: contain; }
  .eggready img { width: 86%; height: 86%; object-fit: contain; animation: eggwob .7s ease-in-out infinite; }
  @keyframes eggwob { 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
  .wear.off { background: #fff; color: var(--ink2); box-shadow: inset 0 0 0 2px #e6dff5; }
  .ehead .trying { display: inline-flex; align-items: center; gap: 6px; font: 600 13px var(--font-body); color: var(--ink2); background: #f4effc; border-radius: 999px; padding: 3px 4px 3px 12px; }
  .ehead .trying b { font: inherit; font-weight: 800; }
  .trying .wear { font-size: 12px; padding: 4px 10px; }
  .obig { width: 200px; height: 200px; object-fit: contain; }
  .dart.bud { height: 250px; display: grid; place-items: end center; }

  .panel { position: absolute; right: 3%; top: 0; bottom: 0; margin: auto 0; height: max-content; width: min(600px, 50vw); max-height: 95%; overflow-y: auto; z-index: 5; padding: 18px 24px 18px; text-align: center; animation: pop-in .45s cubic-bezier(.3, .8, .4, 1.3); }
  h1 { font-size: clamp(30px, 4.6vh, 44px); }
  .sub { margin: 2px 0 6px; font: 700 15px var(--font-body); color: var(--muted); }
  .scorerow { display: flex; align-items: center; justify-content: center; gap: 22px; margin: 4px 0 10px; }
  .score { position: relative; width: clamp(130px, 19vh, 176px); height: clamp(130px, 19vh, 176px); }
  .score svg { width: 100%; height: 100%; display: block; }
  .ring { stroke: var(--ring); }
  .score.gold { --ring: #eccf2e; } .score.mint { --ring: #4fcf98; } .score.sky { --ring: #58b4f0; } .score.lilac { --ring: #a48bff; }
  .num { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .num b { font: 600 clamp(48px, 7.4vh, 68px)/1 var(--font-ui); color: var(--ink); }
  .num span { font: 800 12px var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .word { font: 600 30px var(--font-ui); color: var(--primary-edge); opacity: 0; transform: scale(.6); transition: all .4s cubic-bezier(.3, .8, .4, 1.6); }
  .word.show { opacity: 1; transform: none; }
  .chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; opacity: 0; transform: translateY(8px); transition: all .35s ease; }
  .chips.show { opacity: 1; transform: none; }
  .chip { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px 7px; border-radius: 18px; background: var(--bg2); }
  .ci { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; color: #fff; }
  .ci.clock { background: #58b4f0; } .ci.target { background: #4fcf98; } .ci.trophy { background: #ecc92f; } .ci.rd { background: linear-gradient(135deg, var(--primary-hi), var(--pink)); }
  .chip b { font: 600 22px/1.1 var(--font-ui); }
  .chip small { font: 700 11.5px/1.15 var(--font-body); color: var(--muted); }
  .chip em { position: absolute; top: -8px; right: -4px; font: 800 11px/1 var(--font-body); font-style: normal; color: #fff; background: var(--pink); padding: 4px 7px; border-radius: 999px; transform: rotate(8deg); }
  .extra { margin-top: 10px; text-align: left; animation: fade-up .35s ease; }
  /* a game with its own block gets a slightly smaller score ring, so the card still fits */
  .panel.more .score { width: clamp(116px, 15.5vh, 160px); height: clamp(116px, 15.5vh, 160px); }
  .panel.more .num b { font-size: clamp(42px, 6.2vh, 60px); }
  .panel.more .scorerow { margin: 2px 0 8px; }
  .xp { position: relative; margin-top: 12px; animation: fade-up .35s ease; }
  .xptop { display: flex; justify-content: space-between; font: 800 13px var(--font-body); margin-bottom: 5px; }
  .xptop .lv { color: var(--primary-edge); }
  .xptop .gain { color: var(--mint-edge); }
  .xbar { height: 16px; border-radius: 999px; background: var(--bg2); overflow: hidden; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); }
  .xbar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary-hi), var(--pink), var(--lemon)); background-size: 200% 100%; animation: xpflow 2s linear infinite; }
  @keyframes xpflow { to { background-position: -200% 0; } }
  .lvup { position: absolute; left: 0; right: 0; margin: 0 auto; width: max-content; top: -14px; font: 700 26px var(--font-ui); color: #fff; background: linear-gradient(135deg, var(--primary), var(--pink)); padding: 6px 18px; border-radius: 999px; box-shadow: 0 0 0 4px #fff, var(--shadow); animation: lvup 1.4s cubic-bezier(.3, .8, .3, 1) forwards; pointer-events: none; }
  @keyframes lvup { 0% { transform: scale(.3); opacity: 0; } 20% { transform: scale(1.15); opacity: 1; } 75% { opacity: 1; } 100% { transform: translateY(-26px); opacity: 0; } }
  .goal { margin: 12px 0 0; font: 600 14.5px/1.35 var(--font-body); color: var(--ink2); background: #fff7d6; border-radius: 14px; padding: 8px 14px; animation: fade-up .35s ease; }
  .tiles { display: flex; justify-content: center; align-items: flex-end; gap: 12px; margin-top: 14px; opacity: 0; transform: translateY(10px); transition: all .35s ease; pointer-events: none; }
  .tiles.small { gap: 8px; margin-top: 10px; }
  /* five small buttons share the panel's width: picture over the word */
  .tiles.small :global(.tile) { flex: 1 1 0; min-width: 0; flex-direction: column; gap: 2px; padding: 6px 4px 7px; }
  .tiles.small :global(.tile .lbl) { font-size: 15px; white-space: nowrap; }
  .tiles.show { opacity: 1; transform: none; pointer-events: auto; }
  .opened { position: absolute; top: 18px; left: 0; right: 0; margin: 0 auto; width: max-content; z-index: 7; font: 600 24px var(--font-ui); background: var(--lemon); color: var(--ink); padding: 10px 20px; border-radius: 999px; box-shadow: var(--shadow); animation: pop-in .5s cubic-bezier(.3, .8, .4, 1.5); }

  /* phones and narrow windows: one column that scrolls, the buddy and prize on top, then the card, then the rewards */
  .narrow { overflow-y: auto; display: flex; flex-direction: column; }
  .narrow .hero { position: relative; order: 0; left: auto; top: auto; width: 100%; height: 42vh; flex: none; padding-bottom: 8px; }
  .narrow .hero.full { height: 42vh; }
  .narrow .ridepic { bottom: 70px; }
  .narrow .dancebtn { left: 58px; top: 12px; font-size: 15px; padding: 7px 13px; }
  .narrow .ehead { flex-wrap: wrap; row-gap: 0; }
  .narrow .rbicon { width: 42px; height: 42px; } .narrow .rbicon svg { width: 30px; height: 30px; }
  .narrow .ridebanner { padding: 6px 16px 6px 6px; }
  .narrow .ladder { margin-top: 6px; }
  .narrow .pribbon { left: auto; right: -2px; transform: none; padding: 4px 12px 6px; }
  .narrow .pribbon b { font-size: 18px; }
  .narrow .pladder { display: none; }
  .narrow .panel { position: relative; order: 1; right: auto; top: auto; bottom: auto; margin: 0 10px 10px; width: auto; max-height: none; overflow: visible; flex: none; padding: 14px 12px; }
  .narrow .earned { position: relative; order: 2; left: auto; bottom: auto; width: auto; max-height: none; overflow: visible; flex: none; margin: 0 10px 16px; }
  .narrow h1 { font-size: 28px; }
  .narrow .scorerow { gap: 12px; }
  .narrow .score { width: 112px; height: 112px; }
  .narrow .num b { font-size: 40px; }
  .narrow .word { font-size: 20px; text-align: center; }
  .narrow .chips { gap: 5px; }
  .narrow .chip { padding: 6px 2px; border-radius: 14px; }
  .narrow .chip b { font-size: 17px; }
  .narrow .chip small { font-size: 10px; }
  .narrow .ci { width: 28px; height: 28px; }
  .narrow .tiles { gap: 8px; }
  .narrow .tiles :global(.tile) { flex: 1 1 0; min-width: 0; }
  .narrow .tiles.small { gap: 4px; }
  .narrow .tiles.small :global(.tile .lbl) { font-size: 12px; }
  .narrow .corner { top: 10px; left: 10px; }
  .narrow .opened { font-size: 18px; top: 10px; }
</style>
