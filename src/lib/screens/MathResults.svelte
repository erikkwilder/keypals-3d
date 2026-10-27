<script lang="ts">
  // The end of a math trip: the buddy on the best ride with the treasure the score found, the score and
  // stars, every fact of the trip coloured by speed (green quick, yellow slow, pink missed), the facts
  // to practise with their answers, what grew in the garden, and the same rewards as a typing lesson.
  import { onDestroy, onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { game } from '../state/game.svelte';
  import { danceOf, palOf } from '../engine/profile';
  import { RIDES } from '../engine/rides';
  import { TREASURES } from '../engine/rewards';
  import { FRIEND } from '../art/cast';
  import { rideIcon } from '../art/vehicles';
  import { renderMedal } from '../art/stickerArt';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { RunScene } from '../three/runScene';
  import { MATH_LESSON, MATH_REGION, worldOf } from '../math/course';
  import { parseFact, answerOf } from '../math/facts';
  import { MATH_TREASURE, mathGoal } from '../math/meter';
  import { mathOf, nextMathLesson } from '../math/progress';
  import Flower from '../math/ui/Flower.svelte';
  import Stars from '../ui/Stars.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import StickerCard from '../ui/StickerCard.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import GearButton from '../ui/GearButton.svelte';

  const last = game.mathLast;
  const p = game.profile!;
  const look = p.settings.look;
  const grown = p.settings.grown;
  const buddy = p.buddy;
  const lesson = MATH_LESSON[last?.lessonId ?? 'twins-1'];
  const regionName = lesson.region === 'start' ? 'Times Trail' : MATH_REGION[lesson.region].name;
  const st = last?.stats;
  const goal = mathGoal(lesson.goal, grown, p.settings.easy);
  const passed = (last?.stars ?? 0) > 0;
  const m = mathOf(p);
  const next = nextMathLesson(m);
  const best = last?.bestRide ?? 0;
  const treasure = last?.treasure ?? -1;
  const tth = grown ? MATH_TREASURE.grown : MATH_TREASURE.kids;
  const tsrc = (i: number) => `${import.meta.env.BASE_URL}treasures/${TREASURES[i].id}.webp`;
  const nextT = treasure + 1 < TREASURES.length ? { name: TREASURES[treasure + 1].name, at: tth[treasure + 1] } : null;

  const title = !last ? '' : !passed ? (last.finished ? 'Keep going!' : 'Trip over') : st!.misses === 0 ? (last.stars === 3 ? 'Perfect trip!' : 'No misses!') : last.stars === 3 ? 'Three stars!' : last.stars === 2 ? 'Great job!' : 'Trip done!';
  const tested = last?.testedOut ?? [];
  const sub = !last ? '' : last.regionJustDone ? `${MATH_REGION[last.regionJustDone].name} complete!` : tested.length ? `You skipped ahead past the ${new Intl.ListFormat('en', { type: 'conjunction' }).format(tested.map(r => `${MATH_REGION[r].table}s`))}!` : `${lesson.title} · ${regionName}`;
  // every fact of the trip, in order, coloured by how it went
  const strip = (last?.results ?? []).map(r => ({ ...parseFact(r.id), kind: r.intro ? 'new' : r.speed }));
  const practise = [...new Set((last?.results ?? []).filter(r => !r.intro && !r.ok).map(r => r.id))].map(parseFact);
  const grew = last?.grew ?? { bloomed: [], budded: [], sprouted: [] };
  type Earned = { kind: 'medal'; m: NonNullable<typeof last>['medals'][number] } | { kind: 'reward'; id: string; name: string; rkind: 'outfit' | 'dance' } | { kind: 'sticker'; def: NonNullable<typeof last>['stickers'][number] };
  const earned: Earned[] = last ? [
    ...last.medals.map(m => ({ kind: 'medal' as const, m })),
    ...last.rewards.map(r => ({ kind: 'reward' as const, id: r.id, name: r.name, rkind: r.kind })),
    ...last.stickers.map(def => ({ kind: 'sticker' as const, def })),
  ] : [];

  // a first trip can win a lot at once: smaller tiles then, so nothing hides under the buttons
  const esz = earned.length > 12 ? 38 : earned.length > 8 ? 44 : 50;
  let w = $state(1280);
  let h = $state(800);
  const narrow = $derived(w < 860);
  let heroEl: HTMLDivElement | undefined = $state();
  let scene: RunScene | null = null;
  const scoreT = new Tween(0, { duration: 1100, easing: cubicOut });
  const xpFill = new Tween(0, { duration: 900, easing: cubicOut });
  let starsShown = $state(0);
  let prizeOn = $state(false);
  let showRest = $state(false);
  let burst = $state(0);
  let prizeBurst = $state(0);
  let xpLevel = $state(last?.xp.before.level ?? 1);
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  const ringC = 2 * Math.PI * 64;
  const scoreHue = (last?.stars ?? 0) >= 3 ? 'gold' : (last?.stars ?? 0) === 2 ? 'mint' : (last?.stars ?? 0) === 1 ? 'sky' : 'lilac';

  function updateView() {
    if (!scene || !heroEl) return;
    const r = heroEl.getBoundingClientRect();
    scene.view = { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth };
  }
  $effect(() => { void w; void h; requestAnimationFrame(updateView); });

  onMount(() => {
    if (!last) { game.go('map'); return; }
    const cur = stage.current();
    const ready = cur instanceof RunScene ? Promise.resolve(cur) : RunScene.create({ buddy, outfit: palOf(p).outfit, dance: danceOf(p), length: 20, region: worldOf(lesson), keyLen: 9 }).then(sc => { sc.pos = sc.goal = sc.finishS; stage.use(sc); return sc; });
    ready.then(sc => { scene = sc; sc.onCelebrated = null; sc.results(best); updateView(); });
    at(250, () => (scoreT.target = st!.score));
    for (let i = 0; i < 3; i++) at(550 + i * 330, () => { starsShown = i + 1; if (i < last.stars) sfx.star(i); });
    let t = 1600;
    if (treasure >= 0) { at(t, () => { prizeOn = true; prizeBurst++; sfx.treasure(treasure); scene?.cheer(); }); t += 900; }
    at(t, () => { showRest = true; if (passed) burst++; xpFill.set(last.xp.before.into / last.xp.before.need, { duration: 0 }); });
    t += 300;
    const xb = last.xp.before, xa = last.xp.after;
    for (let L = xb.level; L < xa.level; L++) {
      at(t, () => (xpFill.target = 1));
      t += 900;
      at(t, () => { xpLevel = L + 1; sfx.levelUp(3); burst++; xpFill.set(0, { duration: 0 }); });
      t += 500;
    }
    at(t, () => (xpFill.target = xa.into / xa.need));
  });
  onDestroy(() => { timers.forEach(clearTimeout); stage.use(null); });

  function retry() { game.startMath(lesson.id, true); }
  function goNext() { passed ? game.startMath(next.id) : retry(); }
  function home() { game.go('map'); }
  function tell(e: Earned) {
    sfx.pop();
    game.say(e.kind === 'medal' ? `${e.m.name}: ${e.m.desc}` : e.kind === 'sticker' ? `${e.def.name}: ${e.def.desc}` : `${e.name}: new ${e.rkind === 'outfit' ? 'outfit' : 'dance'} for ${FRIEND[buddy].name}! Try it in Keypals.`, 3600);
  }
  const opened = performance.now();
  function onKey(e: KeyboardEvent) {
    if (performance.now() - opened < 1200 || game.modalOpen) return;
    if (e.key === 'Enter') { e.preventDefault(); goNext(); }
    if (e.key === ' ') { e.preventDefault(); retry(); }
    if (e.key === 'Escape') home();
  }
  const fmt = (f: { a: number; b: number }) => `${f.a} × ${f.b}`;
</script>

<svelte:window onkeydown={onKey} />

{#if last && st}
  <div class="screen mres" class:narrow bind:clientWidth={w} bind:clientHeight={h}>
    <div class="corner"><GearButton size={40} /></div>

    <div class="hero">
      <div class="ridepic" bind:this={heroEl}></div>
      {#if prizeOn}
        <div class="prize">
          <div class="prays"></div>
          <img src={tsrc(treasure)} alt={TREASURES[treasure].name} />
          <div class="pribbon"><small>{last.newBestTreasure ? 'New best!' : 'You found'}</small><b>{last.newBestTreasure ? TREASURES[treasure].name + '!' : 'a ' + TREASURES[treasure].name + '!'}</b></div>
        </div>
        <Confetti burst={prizeBurst} count={60 + treasure * 8} x={70} y={30} spread={1.2} />
      {/if}
      <div class="ridebanner">
        <span class="rbicon"><svg viewBox="0 0 48 48">{@html rideIcon(best, '#fff')}</svg></span>
        <span class="rbtext"><small>{best > 0 ? 'You reached' : 'Quicker answers reach'}</small><b>{best > 0 ? `${RIDES[best].name}!` : `${RIDES[1].name}!`}</b></span>
      </div>
      {#if nextT && prizeOn}<div class="pnext">Score {nextT.at} for a {nextT.name}</div>{/if}
    </div>

    <div class="card panel">
      <h1>{title}</h1>
      <p class="sub">{sub}</p>

      <div class="scorerow">
        <div class="score {scoreHue}">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="64" fill="none" stroke="#efeaf8" stroke-width="16" />
            <circle class="ring" cx="80" cy="80" r="64" fill="none" stroke-width="16" stroke-linecap="round" stroke-dasharray={ringC} stroke-dashoffset={ringC * (1 - Math.min(1, scoreT.current / goal))} transform="rotate(-90 80 80)" />
          </svg>
          <div class="num"><b>{Math.round(scoreT.current)}</b><span>score</span></div>
        </div>
        <div class="side">
          <Stars n={Math.min(starsShown, last.stars)} of={3} size={narrow ? 40 : 52} animate />
          <div class="chips">
            <div class="chip"><b>{Math.round(st.fpm)}</b><small>right a minute</small></div>
            <div class="chip"><b>{Math.round(st.acc * 100)}%</b><small>right first time</small></div>
            <div class="chip"><b>{goal}</b><small>3-star goal{#if last.record.bestScore}{' · '}best {last.record.bestScore}{/if}</small>{#if last.newBestScore}<em>Record!</em>{/if}</div>
          </div>
        </div>
      </div>

      <div class="block" class:show={showRest}>
        <div class="bhead"><b>This trip</b><span class="legend"><i class="fast"></i>quick <i class="slow"></i>slow <i class="miss"></i>missed <i class="new"></i>new</span></div>
        <div class="strip">
          {#each strip as f, i (i)}<span class="fc {f.kind}" title={`${fmt(f)} = ${answerOf(f)}`}>{fmt(f)}</span>{/each}
        </div>
      </div>

      {#if practise.length}
        <div class="block" class:show={showRest}>
          <div class="bhead"><b>Facts to practise</b><span class="muted">they'll come back next time</span></div>
          <div class="practise">{#each practise as f}<span class="pf">{fmt(f)} = <b>{answerOf(f)}</b></span>{/each}</div>
        </div>
      {/if}

      {#if grew.bloomed.length || grew.budded.length || grew.sprouted.length}
        <div class="block grew" class:show={showRest}>
          {#if grew.bloomed.length}<span class="g"><Flower stage={3} size={30} hue={320} /><b>{grew.bloomed.length}</b> in bloom</span>{/if}
          {#if grew.budded.length}<span class="g"><Flower stage={2} size={30} hue={270} /><b>{grew.budded.length}</b> budding</span>{/if}
          {#if grew.sprouted.length}<span class="g"><Flower stage={1} size={30} /><b>{grew.sprouted.length}</b> sprouted</span>{/if}
        </div>
      {/if}

      <div class="block xp" class:show={showRest}>
        <div class="xptop"><span class="lv">{FRIEND[buddy].name} · ♥ Friendship {xpLevel}</span><span class="gain">+{last.xp.gained} XP</span></div>
        <div class="xbar"><i style:width="{xpFill.current * 100}%"></i></div>
      </div>

      {#if earned.length}
        <div class="block" class:show={showRest}>
          <div class="earned" style:--es="{esz}px">
            {#each earned as e, i (i)}
              <button class="ei" style:--d="{i * 90}ms" onclick={() => tell(e)} title="What's this?">
                {#if e.kind === 'medal'}<span class="epic">{@html renderMedal(e.m, e.m.tier)}</span><span class="en">{e.m.name}</span>
                {:else if e.kind === 'sticker'}<span class="epic"><StickerCard def={e.def} friend={buddy} {look} size={esz} /></span><span class="en">{e.def.name}</span>
                {:else if e.rkind === 'outfit'}<span class="epic outfit"><img src="{import.meta.env.BASE_URL}outfits/{e.id}.webp" alt="" /></span><span class="en">{e.name}</span>
                {:else}<span class="epic outfit"><span class="note">♪</span></span><span class="en">{e.name}</span>{/if}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="tiles" class:show={showRest}>
        <NavTile size={narrow ? 'sm' : 'md'} tone="sky" kind="home" label="Home" hotkey={narrow ? undefined : 'esc'} onclick={home} />
        {#if passed}<NavTile size={narrow ? 'sm' : 'md'} tone="butter" kind="redo" label="Again" hotkey={narrow ? undefined : 'space'} onclick={retry} />{/if}
        <NavTile size={narrow ? 'sm' : 'md'} tone="mint" kind={passed ? 'play' : 'redo'} label={passed ? 'Next' : 'Try again'} hotkey={narrow ? undefined : passed ? 'enter' : 'space'} title={passed ? `Next: ${next.title}` : 'Try again'} onclick={goNext} />
        <NavTile size={narrow ? 'sm' : 'md'} tone="pink" label="Garden" onclick={() => game.go('garden')}>
          {#snippet art()}<Flower stage={3} size={narrow ? 38 : 56} hue={320} />{/snippet}
        </NavTile>
      </div>
    </div>
    <Confetti {burst} count={60} x={50} y={30} spread={1.4} />
  </div>
{/if}

<style>
  .mres { background: transparent; }
  .corner { position: absolute; top: 16px; left: 18px; z-index: 8; }
  .hero { position: absolute; left: 2.5%; width: 44%; top: 3%; bottom: 3%; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; pointer-events: none; }
  .ridepic { position: absolute; left: 8%; right: 0; top: 36%; bottom: 110px; }
  .ridebanner { display: flex; align-items: center; gap: 12px; padding: 8px 22px 8px 8px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); box-shadow: 0 0 0 5px #fff, 0 12px 30px -10px rgba(124, 92, 245, .7); animation: pop-in .55s .5s cubic-bezier(.3, .8, .4, 1.5) both; }
  .rbicon { display: grid; place-items: center; width: 54px; height: 54px; border-radius: 50%; background: rgba(255, 255, 255, .25); }
  .rbicon svg { width: 38px; height: 38px; }
  .rbtext { display: flex; flex-direction: column; line-height: 1; }
  .rbtext small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; opacity: .9; }
  .rbtext b { font: 600 clamp(26px, 3.8vh, 36px)/1.05 var(--font-ui); }
  .pnext { margin-top: 12px; font: 700 13px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .92); padding: 4px 12px; border-radius: 999px; }
  .prize { position: absolute; right: 0; top: 8%; width: min(42%, 230px); aspect-ratio: 1; height: auto; }
  .prize > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 12px 18px rgba(60, 40, 110, .35)); animation: prize-in .9s cubic-bezier(.2, .9, .3, 1.4) both, prize-bob 2.4s 1s ease-in-out infinite; }
  .prays { position: absolute; left: -45%; top: -45%; width: 190%; height: 190%; border-radius: 50%; background: repeating-conic-gradient(rgba(255, 245, 200, .75) 0 9deg, rgba(255, 245, 200, 0) 9deg 18deg); mask: radial-gradient(circle, #000 12%, transparent 62%); -webkit-mask: radial-gradient(circle, #000 12%, transparent 62%); animation: spin 9s linear infinite; }
  .pribbon { position: absolute; left: 50%; top: calc(100% - 6px); transform: translateX(-50%); white-space: nowrap; display: flex; flex-direction: column; align-items: center; padding: 6px 18px 8px; border-radius: 999px; color: #fff; background: linear-gradient(135deg, #f7b733, #ff6fae); box-shadow: 0 0 0 4px #fff, 0 10px 24px -10px rgba(200, 80, 120, .7); animation: pop-in .5s .45s cubic-bezier(.3, .8, .4, 1.5) both; }
  .pribbon small { font: 800 11px var(--font-body); letter-spacing: .1em; text-transform: uppercase; }
  .pribbon b { font: 600 clamp(20px, 3vh, 28px)/1.05 var(--font-ui); }
  @keyframes prize-in { 0% { transform: translateY(40%) scale(0) rotate(-30deg); opacity: 0; } 55% { transform: translateY(-12%) scale(1.25) rotate(8deg); opacity: 1; } 100% { transform: none; } }
  @keyframes prize-bob { 50% { transform: translateY(-5%) rotate(-3deg); } }

  .panel { position: absolute; right: 3%; top: 0; bottom: 0; margin: auto 0; height: max-content; width: min(600px, 50vw); max-height: 95%; overflow-y: auto; z-index: 5; padding: 18px 24px; text-align: center; animation: pop-in .45s cubic-bezier(.3, .8, .4, 1.3); }
  h1 { font-size: clamp(30px, 4.6vh, 44px); margin: 0; }
  .sub { margin: 2px 0 8px; font: 700 15px var(--font-body); color: var(--muted); }
  .scorerow { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 4px 0 8px; }
  .score { position: relative; flex: none; width: clamp(120px, 17vh, 160px); height: clamp(120px, 17vh, 160px); }
  .score svg { width: 100%; height: 100%; display: block; }
  .ring { stroke: var(--ring); }
  .score.gold { --ring: #eccf2e; } .score.mint { --ring: #4fcf98; } .score.sky { --ring: #58b4f0; } .score.lilac { --ring: #a48bff; }
  .num { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .num b { font: 600 clamp(44px, 7vh, 62px)/1 var(--font-ui); }
  .num span { font: 800 12px var(--font-body); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
  .side { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
  .chips { display: flex; gap: 6px; }
  .chip { position: relative; display: flex; flex-direction: column; align-items: center; padding: 6px 8px; border-radius: 14px; background: var(--bg2); min-width: 0; }
  .chip b { font: 600 22px/1.1 var(--font-ui); }
  .chip small { font: 700 11px/1.15 var(--font-body); color: var(--muted); }
  .chip em { position: absolute; top: -9px; right: -6px; font: 800 11px/1 var(--font-body); font-style: normal; color: #fff; background: var(--pink); padding: 4px 7px; border-radius: 999px; transform: rotate(8deg); }
  .block { margin-top: 10px; opacity: 0; transform: translateY(8px); transition: opacity .35s, transform .35s; text-align: left; }
  .block.show { opacity: 1; transform: none; }
  .bhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
  .bhead b { font: 600 19px var(--font-ui); }
  .bhead .muted { font: 700 13px var(--font-body); }
  .legend { font: 700 12px var(--font-body); color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .legend i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; margin-left: 6px; }
  .strip { display: flex; flex-wrap: wrap; gap: 5px; }
  .fc { font: 700 13px var(--font-body); padding: 3px 7px; border-radius: 8px; white-space: nowrap; }
  .fast, .fc.fast { background: #c9f1dd; color: #0f5a3c; }
  .slow, .fc.slow { background: #fff0b8; color: #6a5200; }
  .miss, .fc.miss { background: #fbd3e2; color: #8a1f4a; }
  .new, .fc.new { background: #e6ddff; color: #4a2ea8; }
  .practise { display: flex; flex-wrap: wrap; gap: 6px; }
  .pf { font: 700 16px var(--font-body); background: #fff7d6; border-radius: 10px; padding: 4px 10px; }
  .pf b { font: 600 19px var(--font-ui); color: var(--primary-edge); }
  .grew { display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
  .g { display: flex; align-items: center; gap: 4px; font: 700 15px var(--font-body); color: var(--ink2); }
  .g b { font: 600 20px var(--font-ui); color: var(--ink); }
  .xptop { display: flex; justify-content: space-between; font: 800 13px var(--font-body); margin-bottom: 5px; }
  .xptop .lv { color: var(--primary-edge); }
  .xptop .gain { color: var(--mint-edge); }
  .xbar { height: 14px; border-radius: 999px; background: var(--bg2); overflow: hidden; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); }
  .xbar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary-hi), var(--pink), var(--lemon)); }
  .earned { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .ei { width: calc(var(--es) + 18px); display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: none; cursor: pointer; padding: 0; animation: pop-in .45s var(--d) cubic-bezier(.3, .8, .4, 1.5) both; }
  .epic { width: var(--es); height: var(--es); display: grid; place-items: center; }
  .epic :global(svg) { width: 100%; height: 100%; }
  .epic.outfit { border-radius: 16px; background: radial-gradient(circle, #fff 40%, #f3edff); box-shadow: inset 0 0 0 3px #ece6f6; }
  .epic.outfit img { width: 88%; height: 88%; object-fit: contain; }
  .note { font-size: 28px; color: #9b6bff; }
  .en { font: 700 11.5px/1.15 var(--font-body); color: var(--ink2); text-align: center; }
  /* the buttons stay in view at the bottom of the card even when its middle scrolls */
  .tiles { position: sticky; bottom: -18px; display: flex; justify-content: center; align-items: flex-end; gap: 12px; margin: 12px -24px -18px; padding: 10px 12px 14px; background: linear-gradient(rgba(255, 255, 255, 0), #fff 22%); opacity: 0; transition: opacity .35s; pointer-events: none; flex-wrap: wrap; z-index: 2; }
  .tiles.show { opacity: 1; pointer-events: auto; }

  /* phones: the buddy and treasure on top, the card scrolls underneath */
  .narrow { overflow-y: auto; }
  .narrow .hero { position: relative; left: auto; width: 100%; top: auto; bottom: auto; height: 38vh; padding-bottom: 10px; }
  .narrow .ridepic { bottom: 70px; }
  .narrow .prize { width: 34%; right: 4%; top: 4%; }
  .narrow .rbicon { width: 42px; height: 42px; } .narrow .rbicon svg { width: 30px; height: 30px; }
  .narrow .ridebanner { padding: 6px 16px 6px 6px; }
  .narrow .pnext { display: none; }
  .narrow .panel { position: relative; right: auto; top: auto; bottom: auto; margin: 0 10px 16px; width: auto; max-height: none; overflow: visible; padding: 14px 14px; }
  .narrow .scorerow { gap: 10px; }
  .narrow .score { width: 104px; height: 104px; }
  .narrow .num b { font-size: 40px; }
  .narrow .chips { gap: 4px; }
  .narrow .chip { padding: 5px 5px; }
  .narrow .chip b { font-size: 18px; }
  .narrow .chip small { font-size: 10px; }
  .narrow .corner { top: 10px; left: 10px; }
  .narrow .pribbon { left: auto; right: -4px; transform: none; padding: 4px 12px 6px; }
  .narrow .pribbon b { font-size: 18px; }
  .narrow .tiles { flex-wrap: nowrap; gap: 6px; margin: 10px -14px -14px; padding: 8px 8px 10px; bottom: 0; }
  .narrow .tiles :global(.tile) { flex: 1 1 0; min-width: 0; }
</style>
