<script lang="ts">
  import EggBadge from '../ui/EggBadge.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { game, type LastRun } from '../state/game.svelte';
  import { LESSON, MOVE_ICON, MOVE_WORD, REGION, lessonMove, newCharsFor } from '../engine/course';
  import { generate } from '../engine/textgen';
  import { Session } from '../engine/session';
  import { RIDES, RideMeter, rideName, type RideEvent } from '../engine/rides';
  import { computeStats, ghostWords, lessonGoal, starScores, starsFor } from '../engine/scoring';
  import { applyRun, danceOf, knownFor, outfitOf } from '../engine/profile';
  import { mastery, weakMap } from '../engine/mastery';
  import { LAYOUT_LIST, detectLayout, fingerFor, shiftFor } from '../engine/layouts';
  import { FINGER_COLOR, FINGER_NAME, type Finger } from '../art/cast';
  import { rideIcon } from '../art/vehicles';
  import { WORDS_GROWN, WORDS_KIDS } from '../content/words';
  import { POOLS } from '../content/sentences';
  import { melodyNote, musicEnergy, resetMelody, sfx, startMusic, unlockAudio } from '../audio/sound';
  import { stage } from '../three/stage';
  import { RunScene, courseKeyLen } from '../three/runScene';
  import { say, hush } from '../audio/voice.svelte';
  import Caption from '../ui/Caption.svelte';
  import FingerCoach from '../ui/FingerCoach.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import TileArt from '../ui/TileArt.svelte';
  import { homeDemo, lessonDemo, type DemoStep } from '../engine/demos';
  import { lessonTitle } from '../engine/course';
  import TextRibbon from '../ui/TextRibbon.svelte';
  import Keyboard from '../ui/Keyboard.svelte';
  import Hands from '../ui/Hands.svelte';
  import RideLadder from '../ui/RideLadder.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Stars from '../ui/Stars.svelte';

  const profile = $state.snapshot(game.profile!) as import('../engine/profile').Profile;
  const S = profile.settings;
  const look = S.look;
  const grown = S.grown;
  const lesson = LESSON[game.lessonId];
  const region = REGION[lesson.region];
  // the trail with its speed rides, or a climb, a swim or a sled run (engine/course.ts lessonMove)
  const move = lessonMove(lesson);
  const MOVE_LINE = { run: 'Run the trail: type fast and clean to ride a skateboard, a bike, a car, even a rocket!', climb: 'Climb the cliff: every right key pulls you higher. Type fast and clean to climb quicker!', swim: 'Swim across the bay: every right key is a stroke. Type fast and clean to swim like a dolphin!', slide: 'Sled down the mountain: every right key is a push. Type fast and clean to go full avalanche!' }[move];
  const layout = game.layout;
  const known = knownFor(profile, lesson, layout);
  const fresh = newCharsFor(lesson, layout);
  const weak = weakMap(profile.keys, known, grown);
  const text = generate({
    lesson, layout, known, fresh, weak, grown,
    seed: Math.floor(Math.random() * 1e9),
    words: grown ? WORDS_KIDS.concat(WORDS_GROWN) : WORDS_KIDS,
    pools: POOLS,
    custom: profile.customText,
  });
  const session = new Session(text, { timeLimitMs: lesson.kind === 'sprint' ? 60000 : lesson.kind === 'final' ? 120000 : undefined });
  // dev checks type the lesson from the browser
  if (import.meta.env.DEV) (window as unknown as { __runText: string }).__runText = text;
  const ride = new RideMeter(grown);
  const record = profile.lessons[lesson.id];
  const outfit = outfitOf(profile);
  let napped = false;
  const masteryMap: Record<string, number> = Object.fromEntries(Object.entries(profile.keys).map(([ch, k]) => [ch, mastery(k, grown)]));
  const freshShown = fresh.filter(ch => ch !== ' ').slice(0, 8);

  let phase = $state<'intro' | 'typing' | 'paused' | 'done'>('intro');
  // a replay never shows the intro card
  const replaying = game.quickStart;
  // finger demos: the home-row tutorial before the first lesson, a reach demo when new keys arrive
  const reachSteps = lessonDemo(lesson, layout);
  const seenDemos = new Set(profile.demosSeen ?? []);
  let demo = $state<{ steps: DemoStep[]; title: string; id: string } | null>(null);
  function watch(kind: 'home' | 'lesson') {
    hush();
    demo = kind === 'lesson' && reachSteps.length
      ? { steps: reachSteps, title: 'Watch how', id: `lesson:${lesson.id}` }
      : { steps: homeDemo(layout), title: 'Home row', id: 'home' };
  }
  function demoDone() {
    // watched or skipped once: this lesson won't show a demo by itself again
    const ids = [demo?.id, `lesson:${lesson.id}`].filter((v): v is string => !!v && !seenDemos.has(v));
    demo = null;
    if (ids.length) { ids.forEach(i => seenDemos.add(i)); game.update(pp => { pp.demosSeen = [...new Set([...(pp.demosSeen ?? []), ...ids])]; }); }
  }
  function autoDemo(): 'home' | 'lesson' | null {
    const mode = S.demos ?? 'auto';
    if (mode === 'off') return null;
    if (seenDemos.has(`lesson:${lesson.id}`) && mode !== 'always') return null;
    if (lesson.id === 'village-1' && !seenDemos.has('home')) return 'home';
    if (reachSteps.length) return 'lesson';
    return null;
  }
  let pos = $state(0);
  const missed = new SvelteSet<number>();
  let tier = $state(0);
  let best = $state(0);
  let progress = $state(0);
  let liveScore = $state(0);
  let liveAcc = $state(100);
  let bonusLevel = $state(0);
  let bonusPop = $state<{ n: number; x: number } | null>(null);
  let lastBonusPop = 0;
  let sleepy = $state(false);
  let flash = $state<{ ch: string; ok: boolean; n: number }>({ ch: '', ok: true, n: 0 });
  let shake = $state(0);
  let banner = $state<{ tier: number; n: number; down: boolean } | null>(null);
  let streakPop = $state<{ text: string; n: number } | null>(null);
  let bubble = $state<string | null>(null);
  let burst = $state(0);
  let doneBanner = $state(false);
  let keyboardOn = $state(S.keyboard);
  let handsOn = $state(S.hands);
  let timeLeft = $state(lesson.kind === 'final' ? 120 : 60);
  let stageH = $state(600);
  let stageW = $state(1000);
  let scene: RunScene | null = null;
  let loading = $state(true);
  let ribbonEl: HTMLDivElement | undefined = $state();
  let panelEl: HTMLDivElement | undefined = $state();
  let bubbleXY = $state({ x: 0.45, y: 0.5 });
  let keyboardEverShown = S.keyboard;
  let handsEverShown = S.hands;
  let errorsInRow = 0;
  let lastKeyT = 0;
  let raf = 0;
  // Animal Typing's ghost: a see-through racer at three-star pace (or your best, once you have one
  // that beats it). Clean typing earns about a quarter on top of raw speed, so it runs a bit slower
  // than the goal score itself.
  const ghostScore = Math.max(lessonGoal(lesson, grown, S.easy), record?.bestScore ?? 0);
  const ghostCps = (ghostScore / 1.25) * 5 / 60;
  let lastT = performance.now();
  let lastHud = 0;
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

  const cur = $derived(text[pos] ?? '');
  const finger = $derived<Finger | null>(cur ? fingerFor(layout, cur) : null);
  const shiftFinger = $derived<Finger | null>(cur && shiftFor(layout, cur) ? (shiftFor(layout, cur) === 'ShiftLeft' ? 'LP' : 'RP') : null);
  // Animal Typing's recipe: the score is speed plus a clean-typing bonus, stars are shares of a goal score
  const goalScore = lessonGoal(lesson, grown, S.easy);
  const [star1, star2] = starScores(goalScore);

  function begin() {
    hush();
    phase = 'typing';
    keyboardEverShown = keyboardOn;
    handsEverShown = handsOn;
    resetMelody(S.tune);
    startMusic(lesson.region);
    sfx.whoosh();
  }

  function leave() {
    phase = 'done';
    game.go('map');
  }

  function restart() {
    game.startLesson(lesson.id, true);
  }

  function onRide(ev: RideEvent) {
    tier = ev.tier;
    best = ride.best;
    banner = { tier: ev.tier, n: (banner?.n ?? 0) + 1, down: ev.type === 'down' };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner = null), ev.type === 'up' ? 1500 : 900);
    musicEnergy(ev.tier / 5);
    scene?.setTier(ev.tier);
    // no sound for changing rides (it pulled attention from typing); the banner and confetti are enough
    if (ev.type === 'up') burst++;
  }

  function bubbleSay(msg: string, ms = 1400) {
    bubble = msg;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (bubble = null), ms);
  }

  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    unlockAudio();
    if (demo || game.modalOpen) return;
    if (phase === 'intro') {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
      else if (e.key === 'Escape') leave();
      return;
    }
    if (phase === 'paused') {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); phase = 'typing'; }
      return;
    }
    if (phase !== 'typing') return;
    if (e.key === 'Escape') { phase = 'paused'; napped = true; return; }
    if (e.key.length !== 1 || e.repeat || e.isComposing) return;
    e.preventDefault();
    if (document.activeElement instanceof HTMLButtonElement || document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    checkLayout(e);
    const t = performance.now();
    const r = session.press(e.key, t);
    ride.push(r.ok, t);
    lastKeyT = t;
    sleepy = false;
    flash = { ch: e.key, ok: r.ok, n: flash.n + 1 };
    if (r.ok) {
      errorsInRow = 0;
      pos = session.pos;
      scene?.key(true, session.pos);
      if (S.melody) melodyNote(); else sfx.key(fingerFor(layout, r.expected));
      if (r.expected === ' ') scene?.hop();
      const st = session.streak;
      // shown, not heard: a sound here pulled attention from typing
      if (st === 10 || st === 25 || st === 50 || st === 100 || (st > 100 && st % 50 === 0)) streakPop = { text: `${st} in a row!`, n: (streakPop?.n ?? 0) + 1 };
      if (r.done) finish();
    } else {
      missed.add(session.pos);
      errorsInRow++;
      scene?.key(false, session.pos);
      sfx.slip();
      shake++;
      if (errorsInRow >= 2) {
        const want = cur === ' ' ? 'space' : cur;
        bubbleSay(finger ? `Try ${want} with your ${FINGER_NAME[finger]}!` : `Try ${want}!`);
      } else bubbleSay('Oops, try again!', 900);
    }
  }

  const samples: { code: string; key: string }[] = [];
  let layoutHinted = false;
  function checkLayout(e: KeyboardEvent) {
    if (layoutHinted || !/^Key[A-Z]$/.test(e.code)) return;
    samples.push({ code: e.code, key: e.key });
    if (samples.length < 12 || samples.length % 4) return;
    const d = detectLayout(samples);
    if (d && d !== layout.id) {
      layoutHinted = true;
      game.say(`Your keyboard looks like ${LAYOUT_LIST.find(l => l.id === d)?.name}. You can switch in Settings.`, 5000);
    }
  }

  function onBlur() { if (phase === 'typing' && session.startT !== null) { phase = 'paused'; napped = true; } }

  function finish() {
    if (phase === 'done') return;
    phase = 'done';
    const stats = computeStats(session, { grown });
    const finished = session.pos >= text.length;
    const stars = starsFor(stats, lesson, grown, finished, S.easy);
    // build on the profile as it is now, so changes made during the lesson (settings, the sound
    // setup, demos watched) survive; `profile` is the copy taken when the lesson started
    const outcome = applyRun($state.snapshot(game.profile!) as import('../engine/profile').Profile, {
      lessonId: lesson.id, stats, stars, bestRide: ride.best,
      keyboardHidden: !keyboardEverShown, handsHidden: !handsEverShown, finished, at: Date.now(), napped,
    }, layout);
    game.replaceProfile(outcome.profile);
    // the race against the ghost: it set off with your first key at its own steady pace
    let ghost: LastRun['ghost'];
    if (S.ghost !== false && ghostCps > 0) {
      const mine = stats.durationMs / 1000, theirs = text.length / ghostCps;
      ghost = finished ? { beat: mine <= theirs, by: Math.abs(theirs - mine), finished } : { beat: session.pos > mine * ghostCps, by: 0, finished };
      ghostLine = ghostWords(ghost);
    }
    game.last = {
      ...outcome, lessonId: lesson.id, text, wpm: stats.wpm, score: stats.score, bonusMs: stats.bonusMs, acc: stats.acc, stars, bestRide: ride.best,
      durationMs: stats.durationMs, errors: stats.errors, maxStreak: stats.maxStreak, finished, ghost,
    };
    // the cheer waits until the buddy is through the gate (fast typing can leave them a little way back)
    let cheered = false;
    const cheer = () => { if (cheered) return; cheered = true; sfx.complete(); burst++; doneBanner = true; };
    // the buddy runs through the gate and dances; the results come after the dance
    let gone = false;
    const toResults = () => { if (!gone) { gone = true; cheer(); keepScene = true; game.go('results'); } };
    if (scene) { scene.onCrossed = cheer; scene.finish(); scene.onCelebrated = toResults; setTimeout(cheer, 5000); setTimeout(toResults, 12000); }
    else { cheer(); setTimeout(toResults, 1500); }
  }
  let keepScene = false;
  let ghostLine = $state<string | null>(null);

  function frame(t: number) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (phase === 'typing') {
      const ev = ride.update(t);
      if (ev) onRide(ev);
      if (session.tick(t)) finish();
      const started = session.startT !== null;
      const idle = t - lastKeyT;
      if (started && idle > 7000) { sleepy = true; napped = true; }
      if (t - lastHud > 120) {
        lastHud = t;
        progress = ride.progress();
        // the running score, and a little "time saved" pop each time clean typing earns back half a second
        const live = computeStats(session, { grown });
        liveScore = live.score;
        bonusLevel = ride.bonusLevel();
        if (live.bonusMs - lastBonusPop >= 500) { lastBonusPop = Math.floor(live.bonusMs / 500) * 500; bonusPop = { n: (bonusPop?.n ?? 0) + 1, x: Math.random() * 30 - 15 }; }
        const tries = session.pos + session.errors;
        liveAcc = tries ? Math.round((100 * session.pos) / tries) : 100;
        if (session.timeLimitMs && session.startT !== null) timeLeft = Math.max(0, Math.ceil((session.timeLimitMs - (t - session.startT)) / 1000));
      }
    }
    void dt;
    if (scene) {
      scene.paused = phase === 'paused';
      // keep the speech bubble (it sits above the point) below the letters
      if (t - lastHud < 20) { const p = scene.screen(); bubbleXY = { x: p.x, y: Math.max(p.y, scene.view.top + 56 / innerHeight) }; }
    }
    raf = requestAnimationFrame(frame);
  }

  async function speakIntro() {
    // the lesson lines name QWERTY keys; other layouts hear the finger moves instead
    if (layout.id !== 'qwerty' && reachSteps.length) { for (const st of reachSteps) await say(st.line, { important: true }); return; }
    await say(`lesson.${lesson.id}`, { important: true });
  }

  function startIntro() {
    const auto = autoDemo();
    if (auto) setTimeout(() => { if (phase === 'intro') watch(auto); }, 450);
    else setTimeout(() => { if (phase === 'intro') speakIntro(); }, 500);
  }
  function toggleVoice(k: 'voice') {
    const on = game.settings[k] === false;
    game.update(pp => { pp.settings[k] = on; });
    if (!on) hush();
    sfx.click();
  }

  /** Tell the 3D scene which part of the screen is open between the letters and the keyboard. */
  function updateView() {
    if (!scene) return;
    const H = innerHeight;
    const top = ribbonEl ? ribbonEl.getBoundingClientRect().bottom / H : 0.35;
    const bottom = panelEl ? panelEl.getBoundingClientRect().top / H : 0.96;
    scene.view = { top: top + 0.01, bottom: Math.max(top + 0.18, bottom - 0.01), left: 0, right: 1 };
  }
  $effect(() => { void keyboardOn; void handsOn; void stageH; void stageW; requestAnimationFrame(updateView); });

  onMount(() => {
    RunScene.create({ buddy: profile.buddy, outfit, dance: danceOf(profile), length: text.length, ghostCps: S.ghost !== false ? ghostCps : undefined, region: lesson.region, move, keyLen: move === 'run' ? undefined : courseKeyLen(move, text.length) })
      .then(sc => { scene = sc; stage.use(sc); updateView(); loading = false; })
      .catch(err => { console.error(err); loading = false; });
    // the very first lesson asks how things should sound before anyone starts talking
    game.quickStart = false;
    if (replaying) setTimeout(() => { if (phase === 'intro') begin(); }, 300);
    else if (!profile.soundSetup) setTimeout(() => game.openSheet('setup', startIntro), 300);
    else startIntro();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    raf = requestAnimationFrame(frame);
    startMusic(lesson.region);
  });
  onDestroy(() => {
    if (!keepScene) stage.use(null);
    hush();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    cancelAnimationFrame(raf);
    clearTimeout(bannerTimer);
    clearTimeout(bubbleTimer);
  });

</script>

<div class="run" class:no-kb={!keyboardOn && !handsOn} class:compact={stageW < 700}>
  <div class="stage" bind:clientHeight={stageH} bind:clientWidth={stageW}>
    {#if bubble}
      <!-- the point is a share of the window; the stage is shorter (the keyboard sits below), so place it in pixels -->
      <div class="bubble" style:left="{bubbleXY.x * innerWidth}px" style:top="{bubbleXY.y * innerHeight}px">{bubble}</div>
    {/if}
    {#if bonusPop}{#key bonusPop.n}<div class="tpop" style:left="{bubbleXY.x * innerWidth + bonusPop.x}px" style:top="{bubbleXY.y * innerHeight + 40}px">⏱ −0.5s</div>{/key}{/if}
    {#if loading}<div class="loading">{move === 'climb' ? 'Getting the cliff ready…' : move === 'swim' ? 'Getting the bay ready…' : move === 'slide' ? 'Getting the slope ready…' : 'Getting the island ready…'}</div>{/if}

    <div class="hud">
      <button class="btn btn-icon pause" aria-label="Pause" onclick={() => (phase = phase === 'typing' ? 'paused' : phase)}>
        <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="2" fill="currentColor" /></svg>
      </button>
      <div class="title">
        <div class="region">{region.name}</div>
        <div class="lesson">{lessonTitle(lesson, layout)}</div>
      </div>
      <div class="trail">
        <div class="bar"><div class="fill" style:width="{(pos / text.length) * 100}%"></div></div>
        <div class="flag">🏁</div>
        <div class="me" style:left="{(pos / text.length) * 100}%"><Critter friend={profile.buddy} size={38} round /></div>
      </div>
      <div class="live">
        {#if lesson.kind === 'sprint' || lesson.kind === 'final'}<div class="clock" class:low={timeLeft <= 10}>{timeLeft}s</div>{/if}
        <div class="sc"><b>{liveScore}</b> score</div>
        <div><b>{liveAcc}</b>%</div>
        {#if bonusLevel > 0}<div class="tb" title="Clean typing earns back time">⏱ ×{bonusLevel}</div>{/if}
      </div>
      <EggBadge warm={Math.floor(pos / 5)} />
      <RideLadder {tier} {progress} {best} blocked={false} record={record?.bestRide ?? 0} {move} />
    </div>

    <div class="ribbon-wrap" bind:this={ribbonEl}>
      <TextRibbon {text} {pos} {missed} {look} {layout} {shake} />
    </div>

    <!-- announcements live below the letter bar and are clipped to that zone, so they never cover letters -->
    <div class="announce">
    {#if streakPop}
      {#key streakPop.n}<div class="streak">{streakPop.text}</div>{/key}
    {/if}

    {#if banner}
      {#key banner.n}
        <div class="banner" class:down={banner.down}>
          {#if !banner.down}<div class="rays"></div>{/if}
          <svg class="bicon" viewBox="0 0 48 48">{@html rideIcon(banner.tier, '#fff', move)}</svg>
          <div class="bword">{banner.down ? (move === 'run' ? 'Whoa, slow down' : 'Easy does it') : rideName(banner.tier, move) + '!'}</div>
          {#if !banner.down}<div class="bsub">{banner.tier === RIDES.length - 1 ? 'Top speed!' : 'Keep it clean to go higher'}</div>{/if}
        </div>
      {/key}
    {/if}
    {#if doneBanner}
      <div class="banner finish">
        <div class="rays"></div>
        <div class="bword">{session.pos >= text.length ? 'Finished!' : "Time's up!"}</div>
        {#if ghostLine}<div class="bsub ghostline">👻 {ghostLine}</div>{/if}
      </div>
    {/if}
    </div>
    <Confetti {burst} x={24} y={68} />
  </div>

  {#if keyboardOn || handsOn}
    <div class="panel" bind:this={panelEl}>
      <div class="side">{#if handsOn}<Hands side="left" active={finger && (finger.startsWith('L') || finger === 'TH') ? finger : null} also={shiftFinger === 'LP' ? 'LP' : null} {look} />{/if}</div>
      <div class="center">
        {#if keyboardOn}
          <Keyboard {layout} next={phase === 'intro' ? '' : cur} {look} hints={S.hints} mastery={masteryMap} {flash} />
        {:else}
          <div class="nopeek">No peeking! Your fingers know the way.</div>
        {/if}
      </div>
      <div class="side">{#if handsOn}<Hands side="right" active={finger && (finger.startsWith('R') || finger === 'TH') ? finger : null} also={shiftFinger === 'RP' ? 'RP' : null} {look} />{/if}</div>
    </div>
  {/if}

  {#if phase === 'intro' && !replaying}
    <div class="overlay">
      <div class="card intro">
        <div class="where">{region.name} · Lesson {lesson.n}<span class="mv mv-{move}">{MOVE_ICON[move]} {MOVE_WORD[move]}</span></div>
        <h1>{lessonTitle(lesson, layout)}</h1>
        {#if freshShown.length}
          <div class="newkeys">
            <span class="muted">New keys</span>
            {#each freshShown as ch}
              {@const f = fingerFor(layout, ch)}
              <div class="nk">
                <span class="kbd big" style:--fc={f ? FINGER_COLOR[f] : undefined} class:tinted={!!f}>{ch}</span>
                {#if f}<span class="fname">{FINGER_NAME[f]}</span>{/if}
              </div>
            {/each}
          </div>
          {#if lesson.kind === 'drill'}<p class="blurb">Just these {freshShown.length === 1 ? 'key' : 'keys'} this time, until your fingers know them by heart.</p>{/if}
          {#if lesson.blurb}<p class="blurb">{lesson.blurb}</p>{/if}
        {:else}
          <div class="meet small">
            <Critter friend={profile.buddy} size={120} mood="dance" />
          </div>
          {#if lesson.blurb}<p class="blurb">{lesson.blurb}</p>{/if}
        {/if}
        <p class="moveline mv-{move}">{MOVE_LINE}</p>
        <div class="goals">
          <div class="goal"><Stars n={1} of={1} size={22} /><span>score {star1}</span></div>
          <div class="goal"><Stars n={2} of={2} size={22} /><span>score {star2}</span></div>
          <div class="goal"><Stars n={3} of={3} size={22} /><span>score {goalScore}</span></div>
        </div>
        <p class="howscore">Your score is your speed plus a bonus for clean typing. Keep a streak going to earn time back!</p>
        {#if record}
          <div class="best muted">Your best: <Stars n={record.stars} of={3} size={16} /> · score {record.bestScore ?? Math.round(record.bestWpm)} · {move === 'run' ? 'ride' : 'top speed'}: {rideName(record.bestRide, move)}{#if record.platinum} · platinum!{/if}</div>
        {/if}
        <div class="tiles">
          <NavTile size="md" tone="sky" kind="home" label="Home" onclick={leave} />
          <NavTile size="md" tone="lilac" kind="demo" label="Watch how" onclick={() => watch(reachSteps.length ? 'lesson' : 'home')} />
          {#if record}<NavTile size="md" tone="sky" kind="chart" label="Progress" onclick={() => game.openChart(lesson.id)} />{/if}
          <NavTile size="lg" tone="mint" kind="play" label="Start" hotkey="space" onclick={() => { unlockAudio(); begin(); }} />
        </div>
        <div class="pills">
          <label class="pill"><input type="checkbox" checked={game.settings.voice !== false} onchange={() => toggleVoice('voice')} /> Coach voice</label>
          <button class="pill" onclick={speakIntro}><TileArt kind="sfx" size={24} /> Hear it again</button>
          <label class="pill"><input type="checkbox" bind:checked={keyboardOn} /> Keyboard</label>
          <label class="pill"><input type="checkbox" bind:checked={handsOn} onchange={() => (handsEverShown ||= handsOn)} /> Hands</label>
        </div>
      </div>
    </div>
  {/if}

  {#if demo}<FingerCoach steps={demo.steps} title={demo.title} {layout} {look} onDone={demoDone} />{/if}
<Caption />

  {#if phase === 'paused'}
    <div class="overlay">
      <div class="card pausecard">
        <Critter friend={profile.buddy} size={110} mood="sleep" />
        <h2>Taking a breather</h2>
        <div class="tiles">
          <NavTile size="lg" tone="mint" kind="play" label="Keep going" hotkey="esc" onclick={() => (phase = 'typing')} />
          <NavTile size="lg" tone="butter" kind="redo" label="Start over" onclick={restart} />
          <NavTile size="lg" tone="sky" kind="home" label="Home" onclick={leave} />
          <NavTile size="lg" tone="lilac" kind="settings" label="Settings" onclick={() => game.openSettings()} />
        </div>
        <div class="pills">
          <label class="pill"><input type="checkbox" bind:checked={keyboardOn} onchange={() => (keyboardEverShown ||= keyboardOn)} /> Keyboard</label>
          <label class="pill"><input type="checkbox" bind:checked={handsOn} /> Hands</label>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .run { position: absolute; inset: 0; display: flex; flex-direction: column; background: transparent; }
  .stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .loading { position: absolute; left: 0; right: 0; top: 55%; text-align: center; font: 600 20px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(40, 30, 80, .4); }
  .bubble {
    position: absolute; z-index: 4; white-space: nowrap; transform: translate(10%, -120%);
    background: #fff; padding: 9px 14px; border-radius: 16px; font: 600 17px/1.1 var(--font-ui); color: var(--ink);
    box-shadow: var(--shadow); animation: pop-in .25s cubic-bezier(.3, .8, .4, 1.5); border: var(--panel-border);
  }
  .hud { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; align-items: center; gap: 14px; z-index: 6; }
  .pause { flex: none; }
  .title { flex: none; background: rgba(255, 255, 255, .9); padding: 7px 14px; border-radius: 16px; box-shadow: var(--shadow-sm); border: var(--panel-border); }
  .region { font: 700 11px/1.2 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .lesson { font: 600 18px/1.15 var(--font-ui); }
  .trail { position: relative; flex: 1; height: 40px; min-width: 120px; }
  .bar { position: absolute; left: 0; right: 26px; top: calc(50% - 6px); height: 12px; background: rgba(255, 255, 255, .85); border-radius: 999px; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, var(--mint), #8fe0c0); border-radius: 999px; transition: width .15s; }
  .flag { position: absolute; right: 0; top: 50%; margin-top: -13px; font-size: 22px; }
  .me { position: absolute; top: -8px; margin-left: -17px; transition: left .15s; }
  .live { flex: none; display: flex; gap: 12px; font: 600 14px/1 var(--font-body); color: var(--muted); background: rgba(255, 255, 255, .9); padding: 9px 12px; border-radius: 14px; box-shadow: var(--shadow-sm); border: var(--panel-border); }
  .live b { font: 600 20px/1 var(--font-ui); color: var(--ink); }
  .howscore { margin: 8px 0 0; font: 600 13.5px var(--font-body); color: var(--muted); }
  .live .tb { font: 800 13px/1 var(--font-body); color: #0f4a36; background: var(--mint); padding: 4px 8px; border-radius: 999px; align-self: center; animation: appear .2s ease; }
  .tpop { position: absolute; z-index: 5; pointer-events: none; font: 700 22px var(--font-ui); color: #2f9e6e; text-shadow: 0 2px 0 #fff, 0 0 10px rgba(255, 255, 255, .9); animation: tpop 1.1s ease-out forwards; }
  @keyframes tpop { 0% { transform: translateY(10px) scale(.6); opacity: 0; } 20% { transform: translateY(0) scale(1.1); opacity: 1; } 100% { transform: translateY(-46px) scale(1); opacity: 0; } }
  .clock { font: 600 20px/1 var(--font-ui); color: var(--primary); }
  .clock.low { color: #e05a8f; animation: wiggle .5s infinite; }
  .ribbon-wrap { position: absolute; left: 0; right: 0; margin: 0 auto; top: clamp(76px, 13%, 110px); width: min(1400px, 95%); height: clamp(140px, 26%, 220px); z-index: 4; }
  .announce { position: absolute; left: 0; right: 0; bottom: 0; top: calc(clamp(76px, 13%, 110px) + clamp(140px, 26%, 220px) + 12px); overflow: hidden; pointer-events: none; z-index: 8; }
  .streak { position: absolute; left: 2%; width: 34%; text-align: center; top: 10%; z-index: 7; font: 600 30px/1 var(--font-ui); color: #fff; text-shadow: 0 3px 0 var(--primary-edge), 0 0 18px rgba(124, 92, 245, .6); animation: streak 1.2s ease forwards; pointer-events: none; }
  @keyframes streak { 0% { transform: scale(.5); opacity: 0; } 20% { transform: scale(1.15); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-40px); opacity: 0; } }
  .banner { position: absolute; left: 58%; right: 0; top: 0; bottom: 12%; justify-content: center; z-index: 8; display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: banner 1.5s cubic-bezier(.3, .8, .3, 1) forwards; }
  .banner.down { animation-duration: .9s; }
  .banner.finish { animation: banner-stay .5s cubic-bezier(.3, .8, .3, 1.3) forwards; }
  .banner.finish { left: 55%; right: 0; bottom: 30%; }
  @keyframes banner-stay { 0% { transform: scale(.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .banner.finish .rays { top: 50%; margin-top: -260px; }
  .announce:has(.finish) { overflow: visible; }
  .bicon { width: clamp(56px, 10vh, 92px); height: clamp(56px, 10vh, 92px); padding: clamp(10px, 1.7vh, 16px); border-radius: 50%; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); box-shadow: 0 0 0 6px #fff, 0 16px 30px -10px rgba(124, 92, 245, .7); position: relative; z-index: 1; }
  .banner.down .bicon { background: #b8aed0; width: 60px; height: 60px; padding: 10px; }
  .bword { margin-top: 10px; font: 700 clamp(38px, 7vh, 64px)/1 var(--font-ui); color: #fff; text-shadow: 0 5px 0 var(--primary-edge), 0 0 30px rgba(124, 92, 245, .55); letter-spacing: .02em; position: relative; z-index: 1; }
  .banner.down .bword { font-size: 32px; text-shadow: 0 3px 0 #8a80a6; }
  .bsub.ghostline { margin-top: 10px; font-size: 17px; }
  .bsub { font: 700 16px/1 var(--font-body); color: var(--ink); background: #fff; padding: 6px 12px; border-radius: 999px; margin-top: 8px; position: relative; z-index: 1; }
  .rays { position: absolute; top: -214px; left: calc(50% - 260px); width: 520px; height: 520px; background: repeating-conic-gradient(rgba(255, 255, 255, .55) 0 10deg, rgba(255, 255, 255, 0) 10deg 20deg); border-radius: 50%; mask: radial-gradient(circle, #000 20%, transparent 68%); animation: spin 6s linear infinite; }
  @keyframes banner { 0% { transform: scale(.3); opacity: 0; } 15% { transform: scale(1.1); opacity: 1; } 25% { transform: scale(1); } 80% { opacity: 1; } 100% { transform: scale(1.05) translateY(-20px); opacity: 0; } }

  /* phones (as the math trips): the bar wraps with the trail on a row of its own, the speed ladder shows in
     the banners, and the keyboard gets the whole width (no hands) */
  .compact .hud { top: 8px; left: 8px; right: 8px; gap: 6px 8px; flex-wrap: wrap; }
  .compact .title { padding: 5px 10px; }
  .compact .region { display: none; }
  .compact .lesson { font-size: 15px; }
  .compact .trail { order: 5; flex: 1 1 100%; height: 28px; min-width: 0; }
  .compact .me { top: -10px; }
  .compact .live { padding: 6px 8px; gap: 8px; font-size: 12px; margin-left: auto; }
  .compact .live b { font-size: 16px; }
  .compact .hud :global(.ladder) { display: none; }
  .compact .ribbon-wrap { top: 100px; width: calc(100% - 16px); }
  .compact .announce { top: calc(100px + clamp(140px, 26%, 220px) + 12px); }
  /* the banners sit at the top of the picture, small, so they never cover the buddy */
  .compact .banner, .compact .banner.finish { left: 0; right: 0; top: 4px; bottom: auto; justify-content: flex-start; }
  .compact .bicon, .compact .rays { display: none; }
  .compact .bword { font-size: 32px; margin-top: 0; }
  .compact .bsub { font-size: 13px; padding: 4px 10px; margin-top: 4px; }
  .compact .panel { grid-template-columns: minmax(0, 1fr); padding: 8px 8px 10px; }
  .compact .side { display: none; }
  .panel { flex: none; height: clamp(190px, 30vh, 300px); display: grid; grid-template-columns: minmax(90px, 1fr) minmax(0, 4.2fr) minmax(90px, 1fr); align-items: center; gap: 10px; padding: 12px 18px 16px; background: linear-gradient(#fff, var(--bg2)); border-top: var(--panel-border); box-shadow: 0 -10px 30px -20px rgba(60, 40, 110, .3); }
  .side { height: 100%; display: grid; place-items: center; padding-top: 10px; }
  .side :global(.hand) { width: min(100%, 170px); }
  .center { height: 100%; min-width: 0; }
  .nopeek { height: 100%; display: grid; place-items: center; font: 600 22px var(--font-ui); color: var(--muted); }

  .overlay { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(40, 28, 70, .32); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .25s ease; padding: 20px; }
  .card.intro, .card.pausecard { width: min(820px, 100%); max-height: 100%; overflow: auto; padding: 26px 30px 22px; text-align: center; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.3); }
  .where { font: 800 12px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  /* the way this lesson moves: the trail, or a climb, a swim or a sled run, in that course's colour */
  .mv { display: inline-block; margin-left: 8px; padding: 3px 9px 3px 7px; border-radius: 999px; letter-spacing: .04em; color: #fff; background: var(--mvc, var(--primary)); vertical-align: middle; }
  .mv-run { --mvc: #7c5cf5; --mvbg: #f1ecff; }
  .mv-climb { --mvc: #e0752a; --mvbg: #fff1e4; }
  .mv-swim { --mvc: #1f9a8c; --mvbg: #e2f7f3; }
  .mv-slide { --mvc: #4a7fd8; --mvbg: #e7f0ff; }
  .moveline { margin: 4px auto 10px; max-width: 600px; padding: 7px 14px; border-radius: 14px; background: var(--mvbg); color: var(--ink2); font: 700 14.5px/1.35 var(--font-body); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--mvc) 22%, transparent); }
  .intro h1 { font-size: clamp(32px, 5vh, 46px); margin: 6px 0 12px; }
  .meet { display: flex; justify-content: center; gap: 18px; flex-wrap: wrap; margin: 6px 0 4px; }
  .meet.small { align-items: flex-end; gap: 6px; }
  .friend { width: 200px; display: flex; flex-direction: column; align-items: center; animation: fade-up .4s ease both; }
  .say { margin-top: 4px; background: var(--bg2); border-radius: 16px; padding: 10px 12px; font: 600 14.5px/1.35 var(--font-body); color: var(--ink2); position: relative; }
  .say::before { content: ''; position: absolute; top: -8px; left: calc(50% - 8px); border: 8px solid transparent; border-top: 0; border-bottom-color: var(--bg2); }
  .newkeys { display: flex; justify-content: center; align-items: flex-end; gap: 14px; flex-wrap: wrap; margin: 4px 0; }
  .newkeys > span { align-self: center; font-weight: 700; }
  .nk { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .kbd.big { min-width: 58px; height: 58px; font: 600 30px/1 var(--font-ui); border-radius: 14px; }
  .kbd.tinted { box-shadow: inset 0 -5px 0 var(--fc), 0 0 0 3px var(--fc); }
  .fname { font: 700 12px var(--font-body); color: var(--muted); max-width: 90px; text-align: center; }
  .blurb { font-size: 17px; color: var(--ink2); margin: 10px auto 4px; max-width: 560px; }
  .goals { display: flex; justify-content: center; gap: 10px; margin: 16px 0 8px; flex-wrap: wrap; }
  .goal { display: flex; align-items: center; gap: 8px; background: var(--bg2); padding: 8px 12px; border-radius: 14px; font: 700 14px/1 var(--font-body); color: var(--ink2); }
  .best { font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tiles { display: flex; justify-content: center; align-items: flex-end; gap: 14px; margin-top: 18px; flex-wrap: wrap; }
  .pills { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 6px; border-radius: 999px; border: 2px solid #e4dcf2; background: #faf8fd; font: 700 14px var(--font-body); color: var(--ink2); cursor: pointer; }
  .pill input { accent-color: var(--primary); width: 16px; height: 16px; margin: 0 2px 0 6px; }
  .pausecard h2 { font-size: 30px; margin: 4px 0 6px; }
  .pausecard { display: flex; flex-direction: column; align-items: center; }
</style>
