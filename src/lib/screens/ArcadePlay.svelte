<script lang="ts" module>
  /** the game last finished this visit: playing it again skips the how-to card */
  let lastDone: string | null = null;
</script>

<script lang="ts">
  // An Arcade round: the start card (how to play, the star scores, your best, today's challenge), a 3-2-1
  // countdown, then the game with the score, the combo and the clock across the top, and the results
  // when time is up. The game itself (its 3D world, its controls, its question card) is one of
  // arcade/ui/SkySlalom, GlimmerCatch or TowerStack; this screen keeps the score and pays out.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import type { Profile } from '../engine/profile';
  import { ARCADE, applyArcade, dailyGoal, dailySeed, DAILY_SHELLS, FactDeck, recordOf, seeded, starsFor, type Answered, type ArcadeOutcome } from '../arcade/arcade';
  import { mathPool } from '../adventure/state';
  import { mathOf } from '../math/progress';
  import { FAST_MS, type Fact } from '../math/facts';
  import { sfx, unlockAudio } from '../audio/sound';
  import type { ArcadeHud, Phase } from '../arcade/ui/hud';
  import SkySlalom from '../arcade/ui/SkySlalom.svelte';
  import GlimmerCatch from '../arcade/ui/GlimmerCatch.svelte';
  import TowerStack from '../arcade/ui/TowerStack.svelte';
  import ArcadeResults from '../arcade/ui/ArcadeResults.svelte';
  import { exitsOf } from '../arcade/exits';
  import MusicButton from '../ui/MusicButton.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import Stars from '../ui/Stars.svelte';
  import Icon from '../ui/Icon.svelte';

  const id = game.arcadeGame, daily = game.arcadeDaily, G = ARCADE[id];
  const p0 = $state.snapshot(game.profile!) as Profile;
  const mp = mathPool(p0), pool = mp.subject === 'math' ? mp.facts : [];
  const rng = seeded(daily ? dailySeed(id) : Math.floor(Math.random() * 2 ** 31));
  const deck = new FactDeck(pool, rng, mp.subject === 'math' ? mp.theta : undefined);
  const fastMs = mathOf(p0).fastMs ?? FAST_MS;
  const rec = recordOf(p0, id);
  const again = lastDone === id;
  /** where the round was opened from: the pause card and the results offer the Arcade, and that page too */
  const exits = exitsOf();

  let phase = $state<Phase>('loading');
  let score = $state(0);
  let scoreBump = $state(0);
  let combo = $state(0);
  let bestCombo = $state(0);
  let left = $state(G.secs);
  /** seconds played (time added by good play doesn't change it) */
  let elapsed = $state(0);
  let held = 0; // seconds the clock waits (a game's how-to)
  let timePop = $state<{ n: number; text: string } | null>(null);
  let count = $state(3);
  let pops = $state<{ n: number; text: string; label: string; x: number; y: number; big: boolean; side: number }[]>([]);
  let popN = 0;
  let outcome = $state<ArcadeOutcome | null>(null);
  let w = $state(1280);
  const compact = $derived(w < 700);
  const progress = $derived(Math.max(0, Math.min(1, elapsed / G.secs)));
  const answered: Answered[] = [];
  let raf = 0, last = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  const hud: ArcadeHud = {
    answer(f: Fact, ok: boolean, thinkMs: number) { answered.push({ f, ok, thinkMs: Math.round(thinkMs) }); },
    score(points, at, label = '') {
      if (phase !== 'play' && phase !== 'ending') return;
      score += points;
      if (at) {
        const n = ++popN;
        // a side pop (Sky Slalom) is small and quick, and only one shows at a time
        const side = at.side ?? 0;
        pops = [...pops.slice(-5).filter(p => !(side && p.side)), { n, text: points ? `+${points}` : '', label, x: at.x, y: at.y, big: points >= 300, side }];
        later(side ? 950 : 1300, () => (pops = pops.filter(p => p.n !== n)));
      }
      if (points >= 50) scoreBump++;
    },
    combo(n) { combo = n; bestCombo = Math.max(bestCombo, n); },
    addTime(secs) {
      if (phase !== 'play' || !G.maxSecs) return;
      left = Math.min(99, left + secs);
      const n = (timePop?.n ?? 0) + 1;
      timePop = { n, text: `+${Math.round(secs * 10) / 10}s` };
      later(900, () => { if (timePop?.n === n) timePop = null; });
    },
    hold(secs) { held = Math.max(held, secs); },
    end() { if (phase === 'play') finish(); },
  };

  function ready() { phase = again ? 'count' : 'intro'; if (again) countdown(); }
  function begin() { unlockAudio(); if (phase === 'intro') { phase = 'count'; countdown(); } }
  function countdown() {
    count = 3; sfx.countBeep(3);
    later(700, () => { count = 2; sfx.countBeep(2); });
    later(1400, () => { count = 1; sfx.countBeep(1); });
    later(2100, () => { count = 0; sfx.countBeep(0); phase = 'play'; });
    later(2700, () => (count = -1));
  }
  function finish() {
    if (phase !== 'play' && phase !== 'paused') return;
    phase = 'ending';
    sfx.timeUp();
    // a moment for the last points (Tower Stack's height bonus) and the buddy's cheer, then the results
    later(2300, settle);
  }
  function settle() {
    const p = $state.snapshot(game.profile!) as Profile;
    const out = applyArcade(p, { id, score, ms: Math.round(elapsed * 1000), at: Date.now(), answered, daily });
    game.replaceProfile(out.profile);
    outcome = out;
    lastDone = id;
    phase = 'done';
    if (out.newBest) later(900, () => sfx.newBest());
  }
  function pause() { if (phase === 'play') phase = 'paused'; }
  function resume() { if (phase === 'paused') { phase = 'play'; last = 0; } }
  /** out of the round: to the Arcade, or back to the page it was opened from */
  function leave(to: () => void = exits.back) { timers.forEach(clearTimeout); to(); }

  function frame(t: number) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
    if (phase === 'play' && held > 0) held = Math.max(0, held - dt);
    else if (phase === 'play') { left = Math.max(0, left - dt); elapsed += dt; if (left <= 0 || (G.maxSecs && elapsed >= G.maxSecs)) finish(); }
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || game.modalOpen) return;
    unlockAudio();
    if (phase === 'intro') { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); } else if (e.key === 'Escape') leave(); return; }
    if (phase === 'paused') { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); resume(); } return; }
    if (phase === 'play' && e.key === 'Escape') { e.preventDefault(); pause(); }
  }
  function onBlur() { pause(); }

  onMount(() => {
    // for checking the results quickly: __arcade.finish() ends the round now
    if (import.meta.env.DEV) (window as unknown as { __arcade: unknown }).__arcade = { finish, add: (n: number) => (score += n) };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    raf = requestAnimationFrame(frame);
  });
  onDestroy(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
  });

  const clock = $derived(`${Math.floor(Math.ceil(left) / 60)}:${String(Math.ceil(left) % 60).padStart(2, '0')}`);
  const nextStar = $derived(G.stars.find(s => s > score) ?? null);
  const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<div class="aplay g-{id}" class:compact bind:clientWidth={w}>
  {#if id === 'slalom'}<SkySlalom {deck} {rng} buddy={p0.buddy} {fastMs} {phase} {progress} {elapsed} {compact} {hud} onready={ready} />
  {:else if id === 'catch'}<GlimmerCatch {deck} {rng} buddy={p0.buddy} {fastMs} {phase} {progress} {elapsed} {compact} {hud} onready={ready} />
  {:else}<TowerStack {deck} {rng} buddy={p0.buddy} {fastMs} {phase} {progress} {elapsed} {compact} {hud} onready={ready} />{/if}

  {#if phase === 'loading'}<div class="loading"><img src="{import.meta.env.BASE_URL}{G.art}" alt="" /><span>Getting {G.name} ready…</span></div>{/if}

  {#if phase !== 'loading' && phase !== 'done'}
    <div class="hud">
      <div class="lft">
        <button class="btn btn-icon pausebtn" aria-label="Pause" onclick={pause} disabled={phase !== 'play'}><Icon name="pause" size={compact ? 26 : 32} /></button>
        <div class="col">
          {#key scoreBump}<div class="score" class:bump={scoreBump > 0}><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" /><b>{fmt(score)}</b></div>{/key}
          {#if combo >= 2}{#key combo}<div class="combo"><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" />×{combo} combo!</div>{/key}{/if}
        </div>
      </div>
      <div class="rgt">
        <div class="clock" class:low={left <= 10 && phase === 'play'}><Icon name="clock" size={compact ? 22 : 28} /><b>{clock}</b>{#if timePop}{#key timePop.n}<span class="tpop">{timePop.text}</span>{/key}{/if}</div>
        <MusicButton size={compact ? 30 : 38} />
      </div>
    </div>
    {#if !compact && nextStar && phase === 'play'}<div class="nextstar"><Stars n={0} of={1} size={16} /> next star at {fmt(nextStar)}</div>{/if}
  {/if}

  {#each pops as p (p.n)}
    <div class="pop" class:big={p.big && !p.side} class:side={p.side} style:--dx="{p.side * 46}px" style:left="{p.x * 100}%" style:top="{p.y * 100}%">
      {#if p.text}<b>{p.text}</b>{/if}{#if p.label}<span>{p.label}</span>{/if}
    </div>
  {/each}

  {#if phase === 'count' && count >= 0}
    {#key count}<div class="count" class:go={count === 0}>{count === 0 ? 'Go!' : count}</div>{/key}
  {/if}
  {#if phase === 'ending'}<div class="timesup"><div class="rays"></div><b>{left <= 0 ? "Time's up!" : 'Round over!'}</b></div>{/if}

  {#if phase === 'intro'}
    <div class="overlay">
      <div class="card intro">
        <img class="cab" src="{import.meta.env.BASE_URL}{G.art}" alt="" />
        <div class="body">
          <div class="where">{daily ? "Today's challenge" : 'Arcade'} · {G.learns}</div>
          <h1>{G.name}</h1>
          <p class="blurb">{G.blurb}</p>
          <ul class="how">{#each G.how as line, i}<li><span>{i + 1}</span>{line}</li>{/each}</ul>
          <div class="goals">{#each G.stars as s, i}<div class="goal"><Stars n={i + 1} of={i + 1} size={18} /><span>{fmt(s)}</span></div>{/each}</div>
          {#if daily}<div class="dailyline"><img src="{import.meta.env.BASE_URL}icons/daily.webp" alt="" />Beat <b>{fmt(dailyGoal(id))}</b> today for <b>{DAILY_SHELLS}</b> bonus shells. Everyone gets the same course today!</div>{/if}
          <div class="best muted">{rec.plays ? `Your best: ${fmt(rec.best)}` : 'First go! Every answer counts as practice.'} · {G.maxSecs ? `${Math.round(G.secs)} seconds to start: right answers add time` : `${Math.round(G.secs)} seconds`}</div>
          <div class="tiles">
            <NavTile size="md" tone="sky" kind="close" label="Back" onclick={() => leave()} />
            <NavTile size="lg" tone="mint" kind="play" label="Start" hotkey="space" onclick={begin} />
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if phase === 'paused'}
    <div class="overlay">
      <div class="card pausecard">
        <h2>Paused</h2>
        <p class="muted">Score {fmt(score)} · {clock} left</p>
        <div class="tiles">
          <NavTile size="lg" tone="mint" kind="play" label="Keep going" hotkey="esc" onclick={resume} />
          <NavTile size="lg" tone="butter" kind="redo" label="Start over" onclick={() => game.playArcade(id, daily)} />
          <NavTile size="lg" tone="lilac" label="Back to the Arcade" onclick={() => leave(exits.toArcade)}>
            {#snippet art()}<img class="tileart" src="{import.meta.env.BASE_URL}icons/arcade.webp" alt="" style:height="80px" />{/snippet}
          </NavTile>
          {#if exits.other}{@const o = exits.other}<NavTile size="lg" tone="sky" kind={o.label === 'Home' ? 'home' : 'map'} label={o.text} onclick={() => leave(o.go)} />{/if}
        </div>
      </div>
    </div>
  {/if}

  {#if phase === 'done' && outcome}
    <ArcadeResults {outcome} game={G} {daily} {answered} {bestCombo} {compact}
      onagain={() => game.playArcade(id, daily)} onarcade={exits.toArcade} other={exits.other} onhome={() => game.go('hub')} />
  {/if}
</div>

<style>
  .aplay { position: absolute; inset: 0; overflow: hidden; }
  .loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: linear-gradient(#bfe3ff, #fdf3ff); z-index: 10; }
  .loading img { height: min(40vh, 300px); filter: drop-shadow(0 16px 20px rgba(40, 30, 90, .25)); animation: bob 1.6s ease-in-out infinite; }
  .loading span { font: 600 22px var(--font-ui); color: var(--ink); }
  @keyframes bob { 50% { transform: translateY(-10px); } }

  .hud { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: flex-start; z-index: 8; pointer-events: none; }
  .hud > * { pointer-events: auto; }
  .lft { display: flex; gap: 10px; align-items: flex-start; }
  .col { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .score { display: flex; align-items: center; gap: 8px; padding: 6px 18px 6px 8px; border-radius: 20px; background: rgba(255, 255, 255, .95); box-shadow: 0 8px 20px -10px rgba(40, 30, 90, .45); }
  .score img { width: 38px; height: 38px; object-fit: contain; }
  .score b { font: 600 30px/1 var(--font-ui); color: var(--ink); font-variant-numeric: tabular-nums; min-width: 2ch; }
  .score.bump { animation: bump .3s cubic-bezier(.3, .8, .4, 1.6); }
  @keyframes bump { 40% { transform: scale(1.12); } }
  .combo { display: flex; align-items: center; gap: 6px; padding: 5px 16px 5px 8px; border-radius: 999px; color: #fff; font: 600 20px/1 var(--font-ui);
    background: linear-gradient(135deg, #8b5cf6, #c04ee8); box-shadow: 0 0 0 3px rgba(255, 255, 255, .8), 0 6px 18px -6px rgba(140, 60, 220, .7); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.6); }
  .combo img { width: 26px; height: 26px; object-fit: contain; }
  .rgt { display: flex; gap: 10px; align-items: center; }
  .clock { display: flex; align-items: center; gap: 6px; padding: 6px 14px 6px 8px; border-radius: 20px; background: rgba(255, 255, 255, .95); box-shadow: 0 8px 20px -10px rgba(40, 30, 90, .45); }
  .clock b { font: 600 26px/1 var(--font-ui); color: var(--ink); font-variant-numeric: tabular-nums; }
  .clock.low { background: #fff0f4; box-shadow: 0 0 0 3px #ffb3c9; animation: tick 1s ease-in-out infinite; }
  .clock.low b { color: #c0265a; }
  .clock { position: relative; }
  .tpop { position: absolute; right: 6px; top: 100%; margin-top: 4px; font: 700 18px/1 var(--font-ui); color: #1a8a4a; background: #eafff2; padding: 4px 9px; border-radius: 999px; box-shadow: 0 0 0 2px #9be6b8; animation: tpop .9s ease-out forwards; white-space: nowrap; }
  @keyframes tpop { 0% { transform: translateY(-6px) scale(.6); opacity: 0; } 20% { transform: translateY(0) scale(1.1); opacity: 1; } 75% { opacity: 1; } 100% { transform: translateY(8px); opacity: 0; } }
  @keyframes tick { 50% { transform: scale(1.06); } }
  .nextstar { position: absolute; left: 16px; top: 132px; display: flex; align-items: center; gap: 6px; font: 700 13px var(--font-body); color: #fff; text-shadow: 0 1px 4px rgba(20, 30, 70, .7); z-index: 7; pointer-events: none; }

  .pop { position: absolute; z-index: 9; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 4px; pointer-events: none; animation: rise 1.3s cubic-bezier(.2, .8, .3, 1) forwards; }
  .pop b { font: 700 42px/1 var(--font-ui); color: #ffd84a; -webkit-text-stroke: 2px #8a4a00; paint-order: stroke fill; text-shadow: 0 4px 0 #b86a00, 0 0 18px rgba(255, 200, 60, .7); }
  .pop.big b { font-size: 60px; }
  .pop span { font: 600 20px/1 var(--font-ui); color: var(--ink); background: #fff; padding: 5px 12px; border-radius: 999px; box-shadow: var(--shadow-sm); white-space: nowrap; }
  /* Sky Slalom's pops: beside the sled, small, sliding out and down (never up over the gates ahead) */
  .pop.side { animation: aside .95s cubic-bezier(.2, .8, .3, 1) forwards; gap: 2px; }
  .pop.side b { font-size: 30px; -webkit-text-stroke-width: 1.5px; text-shadow: 0 3px 0 #b86a00; }
  .pop.side span { font-size: 14px; padding: 3px 9px; }
  @keyframes aside { 0% { transform: translate(-50%, -50%) scale(.5); opacity: 0; } 15% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; } 65% { opacity: 1; } 100% { transform: translate(calc(-50% + var(--dx)), -10%) scale(.9); opacity: 0; } }
  @keyframes rise { 0% { transform: translate(-50%, -30%) scale(.4); opacity: 0; } 15% { transform: translate(-50%, -60%) scale(1.15); opacity: 1; } 30% { transform: translate(-50%, -70%) scale(1); } 80% { opacity: 1; } 100% { transform: translate(-50%, -150%) scale(.95); opacity: 0; } }

  .count { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); z-index: 12; font: 700 clamp(120px, 26vh, 220px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 6px var(--primary-edge); paint-order: stroke fill;
    text-shadow: 0 10px 0 var(--primary-edge), 0 0 50px rgba(124, 92, 245, .6); animation: countin .7s cubic-bezier(.3, .8, .4, 1.4) forwards; pointer-events: none; }
  .count.go { color: #ffe066; -webkit-text-stroke-color: #b85a00; text-shadow: 0 10px 0 #b85a00, 0 0 60px rgba(255, 200, 60, .8); animation: goin .6s cubic-bezier(.3, .8, .4, 1.4) forwards; }
  @keyframes countin { 0% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } 30% { transform: translate(-50%, -50%) scale(1); opacity: 1; } 80% { opacity: 1; } 100% { transform: translate(-50%, -50%) scale(.8); opacity: 0; } }
  @keyframes goin { 0% { transform: translate(-50%, -50%) scale(.3); opacity: 0; } 40% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(1.4); opacity: 0; } }
  .timesup { position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%); z-index: 12; pointer-events: none; display: grid; place-items: center; }
  .timesup b { position: relative; font: 700 clamp(56px, 10vh, 96px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 4px var(--primary-edge); paint-order: stroke fill; text-shadow: 0 7px 0 var(--primary-edge); white-space: nowrap; animation: pop-in .5s cubic-bezier(.3, .8, .4, 1.4); }
  .rays { position: absolute; width: 520px; height: 520px; background: repeating-conic-gradient(rgba(255, 255, 255, .5) 0 10deg, rgba(255, 255, 255, 0) 10deg 20deg); border-radius: 50%; mask: radial-gradient(circle, #000 20%, transparent 68%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 68%); animation: spin 6s linear infinite; }

  .overlay { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(40, 28, 70, .3); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .25s ease; padding: 16px; }
  .card.intro { width: min(820px, 100%); max-height: 100%; overflow: auto; display: flex; gap: 22px; align-items: center; padding: 22px 28px 20px; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.3); }
  .cab { width: 230px; flex: none; filter: drop-shadow(0 14px 16px rgba(40, 30, 90, .25)); }
  .body { flex: 1; min-width: 0; text-align: left; }
  .where { font: 800 12px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .intro h1 { font-size: clamp(32px, 5vh, 46px); margin: 6px 0 6px; }
  .blurb { margin: 0 0 10px; font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .how { list-style: none; margin: 0 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .how li { display: flex; align-items: center; gap: 10px; font: 700 16px var(--font-body); color: var(--ink); }
  .how li span { flex: none; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: var(--primary); color: #fff; font: 600 16px var(--font-ui); }
  .goals { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
  .goal { display: flex; align-items: center; gap: 6px; background: var(--bg2); padding: 6px 10px; border-radius: 12px; font: 700 14px/1 var(--font-body); color: var(--ink2); }
  .dailyline { display: flex; align-items: center; gap: 8px; margin: 6px 0; padding: 6px 12px 6px 6px; border-radius: 14px; background: #fff6d8; box-shadow: inset 0 0 0 2px #ffd36b; font: 700 14px/1.3 var(--font-body); color: #6b4300; }
  .dailyline img { width: 34px; height: 34px; object-fit: contain; flex: none; }
  .best { font-size: 14px; margin-top: 4px; }
  .tiles { display: flex; justify-content: flex-start; align-items: flex-end; gap: 14px; margin-top: 14px; flex-wrap: wrap; }
  .pausecard { padding: 24px 28px 20px; text-align: center; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.3); }
  .pausecard h2 { font-size: 34px; margin: 0; }
  .pausecard .tiles { justify-content: center; }
  .tileart { width: auto; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 40, 10, .25)); }

  .compact .hud { top: 8px; left: 8px; right: 8px; }
  .compact .score { padding: 4px 12px 4px 6px; }
  .compact .score img { width: 28px; height: 28px; }
  .compact .score b { font-size: 22px; }
  .compact .combo { font-size: 15px; padding: 4px 10px 4px 6px; }
  .compact .combo img { width: 20px; height: 20px; }
  .compact .clock { padding: 4px 10px 4px 6px; }
  .compact .clock b { font-size: 20px; }
  .compact .pop b { font-size: 32px; }
  .compact .pop.big b { font-size: 44px; }
  .compact .pop span { font-size: 16px; }
  .compact .pop.side b { font-size: 24px; }
  .compact .pop.side span { font-size: 12px; }
  .compact .card.intro { flex-direction: column; gap: 6px; padding: 16px 18px; text-align: center; }
  .compact .cab { width: 120px; }
  .compact .body { text-align: center; }
  .compact .how li { font-size: 14.5px; }
  .compact .goals, .compact .tiles { justify-content: center; }
  .compact .intro h1 { font-size: 30px; }
  .compact .blurb { font-size: 15px; }
</style>
