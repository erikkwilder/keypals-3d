<script lang="ts">
  // A math trip in 3D: a fact at the top, your buddy on the island trail, a number pad at the bottom.
  // Type the answer (number row, number pad, the on-screen pad; French keyboards' digit keys too) and
  // it checks itself once there are as many digits as the answer has. Every answer moves the buddy one
  // stretch along the trail; quick, right answers climb the rides. A new fact comes with its trick to
  // copy; a miss shows the answer and its trick to type back, and the fact returns a few facts later.
  // No countdown, no buzzer.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { danceOf, outfitOf, type Profile } from '../engine/profile';
  import { rideName, RIDES, type RideEvent } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { FRIEND } from '../art/cast';
  import { sfx, startMusic, unlockAudio, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { RunScene } from '../three/runScene';
  import { MATH_LESSON, MATH_REGION, STRAND, TRICK, groupFacts, moveOf, STRIDE, trickOf, worldOf, type MathLesson } from '../math/course';
  /** A typical fact to show on a Meet card: the 6 of a times table, or the first not-so-easy fact of a group. */
  const exampleOf = (l: MathLesson) => (l.op === 'x' ? { a: 6, b: l.tables[0] } : (groupFacts(l.learn[0]).find(f => f.a > 2 && f.b > 1) ?? groupFacts(l.learn[0])[0]));
  import { answerOf, factId, opSign, speedOf, FAST_MS, type Fact } from '../math/facts';
  import { TripPicker, type Item } from '../math/picker';
  import { FactMeter, mathGoal, mathStars, tripStats, type FactResult } from '../math/meter';
  import { applyMathRun, mathOf } from '../math/progress';
  import NumPad from '../math/ui/NumPad.svelte';
  import DotPicture from '../math/ui/DotPicture.svelte';
  import RideLadder from '../ui/RideLadder.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Stars from '../ui/Stars.svelte';

  const profile = $state.snapshot(game.profile!) as Profile;
  const S = profile.settings;
  const grown = S.grown;
  const look = S.look;
  const m = mathOf(profile);
  const lesson = MATH_LESSON[game.mathLessonId] ?? MATH_LESSON['twins-1'];
  const regionName = lesson.region === 'start' ? STRAND[lesson.op].name : MATH_REGION[lesson.region].name;
  const fastMs = m.fastMs ?? FAST_MS;
  const picker = new TripPicker({ lesson, facts: m.facts, now: Date.now(), fastMs });
  let calm = $state(!!m.calm);
  const meter = new FactMeter(grown, !!m.calm);
  const record = m.lessons[lesson.id];
  const goal = mathGoal(lesson.goal, grown, S.easy);
  const starAt = [Math.ceil(goal * 0.3), Math.ceil(goal * 0.6), goal];
  const buddy = FRIEND[profile.buddy];
  // the trail: one stretch per fact, with room for a couple of misses brought back at the end
  const STRETCH = STRIDE[moveOf(lesson)];
  const stretches = picker.length + 2;

  let phase = $state<'intro' | 'play' | 'paused' | 'done'>('intro');
  const replaying = game.quickStart;
  let item = $state<Item | null>(null);
  /** ask: answer it. learn: a new fact, its trick shown, copy the answer. fix: after a miss, type the answer shown. */
  let mode = $state<'ask' | 'learn' | 'fix'>('ask');
  let typed = $state('');
  let feedback = $state<'right' | 'fast' | 'wrong' | null>(null);
  let shake = $state(0);
  let tier = $state(0);
  let best = $state(0);
  let progress = $state(0);
  let trip = $state(0);
  let liveFpm = $state(0);
  let liveAcc = $state(100);
  let streak = $state(0);
  let streakPop = $state<{ text: string; n: number } | null>(null);
  let banner = $state<{ tier: number; n: number; down: boolean } | null>(null);
  let bubble = $state<string | null>(null);
  let bubbleXY = $state({ x: 0.45, y: 0.5 });
  let burst = $state(0);
  let doneBanner = $state(false);
  let loading = $state(true);
  let lit = $state<string | null>(null);
  let w = $state(1280);
  let h = $state(800);
  const compact = $derived(w < 700);
  let qEl: HTMLDivElement | undefined = $state();
  let padEl: HTMLDivElement | undefined = $state();
  let helpEl: HTMLDivElement | undefined = $state();
  let scene: RunScene | null = null;
  let raf = 0;
  let napped = false;
  let shownAt = 0;
  let firstDigitAt: number | null = null;
  let missThink = 0;
  let steps = 0;
  let lastInput = 0;
  let lastHud = 0;
  const results: FactResult[] = [];
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;

  const fact = $derived<Fact | null>(item?.fact ?? null);
  const answer = $derived(fact ? answerOf(fact) : 0);
  const digits = $derived(String(answer).length);
  const trick = $derived(fact ? trickOf(fact) : null);
  const trickText = $derived(trick?.say ?? '');
  const sign = $derived(fact ? opSign(fact) : '×');
  const showHelp = $derived(phase === 'play' && (mode === 'learn' || mode === 'fix'));

  function begin() {
    phase = 'play';
    startMusic(worldOf(lesson));
    sfx.whoosh();
    nextFact();
  }

  function nextFact() {
    const it = picker.next();
    trip = picker.progress;
    if (!it) { finish(); return; }
    item = it;
    typed = '';
    feedback = null;
    firstDigitAt = null;
    shownAt = performance.now();
    meter.shown(shownAt);
    mode = it.reason === 'new' ? 'learn' : 'ask';
    if (mode === 'learn') say(`New one! ${trickOf(it.fact).name}.`, 1800);
  }

  function say(msg: string, ms = 1500) {
    bubble = msg;
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (bubble = null), ms);
  }

  function digit(d: string) {
    if (phase !== 'play' || !item || feedback === 'right' || feedback === 'fast') return;
    unlockAudio();
    const t = performance.now();
    lastInput = t;
    if (firstDigitAt === null) firstDigitAt = t;
    if (typed.length >= digits) return;
    typed += d;
    lit = d; later(110, () => (lit = null));
    sfx.click();
    if (typed.length === digits) check(t);
  }
  function back() {
    if (phase !== 'play' || !typed) return;
    typed = typed.slice(0, -1);
  }

  function check(t: number) {
    if (!item || !fact) return;
    const ok = Number(typed) === answer;
    const id = factId(fact);
    if (mode === 'ask') {
      const thinkMs = (firstDigitAt ?? t) - shownAt;
      if (ok) {
        const speed = speedOf({ ok, thinkMs, fastMs });
        results.push({ id, ok: true, speed, thinkMs, ms: t - shownAt, intro: false });
        picker.answer(true);
        meter.push(true, t - shownAt);
        stepOn(speed === 'fast');
      } else {
        // no buzzer: the answer and its trick show, the fact will come back
        picker.answer(false);
        missThink = thinkMs;
        mode = 'fix';
        typed = '';
        feedback = 'wrong';
        shake++;
        streak = 0;
        sfx.miss();
        scene?.key(false, steps);
        say(['Nearly! Have a look.', 'Not quite. Here it is.', "That's a tricky one!"][results.length % 3], 1600);
      }
    } else if (ok) {
      // a retyped answer after a miss, or a new fact copied from its trick
      const fix = mode === 'fix';
      results.push(fix
        ? { id, ok: false, speed: 'miss', thinkMs: missThink, ms: t - shownAt, intro: false }
        : { id, ok: true, speed: 'slow', thinkMs: (firstDigitAt ?? t) - shownAt, ms: t - shownAt, intro: true });
      if (fix) meter.push(false, t - shownAt);
      stepOn(false, fix);
    } else {
      typed = '';
      shake++;
      sfx.miss();
    }
  }

  /** The answer is in: the buddy moves on, then the next fact (well under half a second later). */
  function stepOn(quick: boolean, fixed = false) {
    steps++;
    scene?.key(true, steps);
    feedback = quick ? 'fast' : 'right';
    if (quick) scene?.hop();
    sfx.key(quick ? 'RI' : 'LI');
    if (!fixed && mode === 'ask') {
      streak++;
      if (streak === 5 || streak === 10 || streak === 15 || streak === 20) streakPop = { text: `${streak} in a row!`, n: (streakPop?.n ?? 0) + 1 };
    }
    later(fixed ? 380 : 260, nextFact);
  }

  function onRide(ev: RideEvent) {
    tier = ev.tier;
    best = meter.best;
    banner = { tier: ev.tier, n: (banner?.n ?? 0) + 1, down: ev.type === 'down' };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner = null), ev.type === 'up' ? 1500 : 900);
    musicEnergy(ev.tier / 5);
    scene?.setTier(ev.tier);
    if (ev.type === 'up') burst++;
  }

  function finish() {
    if (phase === 'done') return;
    phase = 'done';
    item = null;
    const stats = tripStats(results);
    const finished = picker.done;
    const stars = mathStars(stats, goal, finished);
    const outcome = applyMathRun($state.snapshot(game.profile!) as Profile, { lessonId: lesson.id, results, stats, stars, bestRide: meter.best, finished, at: Date.now(), napped });
    game.replaceProfile(outcome.profile);
    game.mathLast = { ...outcome, lessonId: lesson.id, stats, results: [...results], stars, bestRide: meter.best, finished };
    let cheered = false;
    const cheer = () => { if (cheered) return; cheered = true; sfx.complete(); burst++; doneBanner = true; };
    let gone = false;
    const toResults = () => { if (!gone) { gone = true; cheer(); keepScene = true; game.go('mathResults'); } };
    if (scene) { scene.onCrossed = cheer; scene.finish(); scene.onCelebrated = toResults; later(5000, cheer); later(12000, toResults); }
    else { cheer(); later(1500, toResults); }
  }
  let keepScene = false;

  // ---- keys: digits from the number row, the number pad, and French keyboards' digit keys ----
  function keyDigit(e: KeyboardEvent): string | null {
    if (/^[0-9]$/.test(e.key)) return e.key;
    const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
    return m ? m[1] : null;
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    unlockAudio();
    if (game.modalOpen) return;
    if (phase === 'intro') {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); }
      else if (e.key === 'Escape') leave();
      return;
    }
    if (phase === 'paused') {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); phase = 'play'; }
      return;
    }
    if (phase !== 'play') return;
    if (e.key === 'Escape') { phase = 'paused'; napped = true; return; }
    if (e.repeat || e.isComposing) return;
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); back(); return; }
    if (e.key === 'Enter' && typed) { e.preventDefault(); check(performance.now()); return; }
    const d = keyDigit(e);
    if (d !== null) { e.preventDefault(); digit(d); }
  }
  function onBlur() { if (phase === 'play') { phase = 'paused'; napped = true; } }

  function leave() { phase = 'done'; game.go('map'); }
  function restart() { game.startMath(lesson.id, true); }
  function setCalm(on: boolean) {
    calm = on;
    game.update(pp => { pp.math = { ...mathOf(pp), calm: on }; });
  }

  function frame(t: number) {
    if (phase === 'play') {
      const ev = meter.update(t);
      if (ev) onRide(ev);
      if (t - lastHud > 150) {
        lastHud = t;
        progress = meter.progress();
        const scored = results.filter(r => !r.intro);
        const st = tripStats(results);
        liveFpm = Math.round(st.fpm);
        liveAcc = scored.length ? Math.round(st.acc * 100) : 100;
        if (item && t - Math.max(shownAt, lastInput) > 15000 && !bubble) say('Take your time. No rush!', 2500);
      }
    }
    if (scene) {
      scene.paused = phase === 'paused';
      const p = scene.screen();
      bubbleXY = { x: p.x, y: Math.max(p.y, scene.view.top + 40 / innerHeight) };
    }
    raf = requestAnimationFrame(frame);
  }

  /** The 3D view uses the open band between the question and the pad. */
  function updateView() {
    if (!scene) return;
    const H = innerHeight;
    const top = qEl ? qEl.getBoundingClientRect().bottom / H : 0.3;
    // on a phone the help card sits over the bottom of the view: keep the buddy above it
    const low = compact && helpEl ? helpEl : padEl;
    const bottom = low ? low.getBoundingClientRect().top / H : 0.85;
    scene.view = { top: top + 0.01, bottom: Math.max(top + 0.16, bottom - 0.01), left: 0, right: 1 };
  }
  $effect(() => { void w; void h; void showHelp; requestAnimationFrame(updateView); });

  // dev checks answer the trip from the browser
  if (import.meta.env.DEV) (window as unknown as { __math: object }).__math = { answer: () => answer, mode: () => mode, phase: () => phase, fact: () => fact };

  onMount(() => {
    RunScene.create({ buddy: profile.buddy, outfit: outfitOf(profile), dance: danceOf(profile), length: stretches, region: worldOf(lesson), move: moveOf(lesson), keyLen: STRETCH, pace: { window: 14, full: 4, stop: 9, lead: 0.6 } })
      .then(sc => { scene = sc; stage.use(sc); updateView(); loading = false; })
      .catch(err => { console.error(err); loading = false; });
    game.quickStart = false;
    if (replaying) later(300, () => { if (phase === 'intro') begin(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    raf = requestAnimationFrame(frame);
    startMusic(worldOf(lesson));
  });
  onDestroy(() => {
    if (!keepScene) stage.use(null);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('blur', onBlur);
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout);
    clearTimeout(bannerTimer);
    clearTimeout(bubbleTimer);
  });
</script>

<div class="mrun" class:compact bind:clientWidth={w} bind:clientHeight={h}>
  <div class="stage">
    {#if bubble && phase === 'play' && !showHelp}
      <div class="bubble" style:left="{bubbleXY.x * innerWidth}px" style:top="{bubbleXY.y * innerHeight}px">{bubble}</div>
    {/if}
    {#if loading}<div class="loading">Getting the island ready…</div>{/if}

    <div class="hud">
      <button class="btn btn-icon pause" aria-label="Pause" onclick={() => (phase = phase === 'play' ? 'paused' : phase)}>
        <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="2" fill="currentColor" /></svg>
      </button>
      <div class="title">
        <div class="region">{regionName}</div>
        <div class="lesson">{lesson.title}</div>
      </div>
      <div class="trail">
        <div class="bar"><div class="fill" style:width="{trip * 100}%"></div></div>
        <div class="flag">🏁</div>
        <div class="me" style:left="{trip * 100}%"><Critter friend={profile.buddy} size={34} round /></div>
      </div>
      {#if !calm}
        <div class="live"><div><b>{liveFpm}</b> a minute</div><div><b>{liveAcc}</b>%</div></div>
        <div class="ladder"><RideLadder {tier} {progress} {best} blocked={false} record={record?.bestRide ?? 0} move={moveOf(lesson)} /></div>
      {/if}
    </div>

    <div class="qwrap" bind:this={qEl}>
      {#if fact && phase !== 'intro'}
        {#key shake}
          <div class="q" class:right={feedback === 'right'} class:fast={feedback === 'fast'} class:wrong={feedback === 'wrong' && mode === 'fix'} class:shake={shake > 0 && feedback !== 'right' && feedback !== 'fast'}>
            <span class="f">{fact.a}</span><span class="op">{sign}</span><span class="f">{fact.b}</span><span class="op">=</span>
            <span class="boxes">
              {#each Array(digits) as _, i}
                <span class="box" class:cur={i === typed.length && !feedback?.startsWith('r') && feedback !== 'fast'} class:filled={i < typed.length}>{typed[i] ?? ''}</span>
              {/each}
            </span>
          </div>
        {/key}
        {#if streakPop}{#key streakPop.n}<div class="streak">{streakPop.text}</div>{/key}{/if}
      {/if}
    </div>

    {#if showHelp && fact && trick}
      <div class="help" class:fix={mode === 'fix'} bind:this={helpEl}>
        <div class="hhead">
          <Critter friend={profile.buddy} size={compact ? 40 : 54} round />
          <div>
            <small>{mode === 'fix' ? `${buddy.name} shows you` : `New fact · ${trick.name}`}</small>
            <b>{fact.a} {sign} {fact.b} = {answer}</b>
          </div>
        </div>
        <div class="pic"><DotPicture {fact} size={compact ? 150 : 210} /></div>
        <p>{trickText}</p>
        <div class="typeit">Type <b>{answer}</b> to go on</div>
      </div>
    {/if}

    <div class="announce">
      {#if banner}
        {#key banner.n}
          <div class="banner" class:down={banner.down}>
            {#if !banner.down}<div class="rays"></div>{/if}
            <svg class="bicon" viewBox="0 0 48 48">{@html rideIcon(banner.tier, '#fff', moveOf(lesson))}</svg>
            <div class="bword">{banner.down ? 'Easy does it' : rideName(banner.tier, moveOf(lesson)) + '!'}</div>
            {#if !banner.down}<div class="bsub">{banner.tier === RIDES.length - 1 ? 'Top speed!' : 'Quick and right to go higher'}</div>{/if}
          </div>
        {/key}
      {/if}
      {#if doneBanner}
        <div class="banner finish"><div class="rays"></div><div class="bword">Finished!</div></div>
      {/if}
    </div>
    <Confetti {burst} x={24} y={60} />
  </div>

  <div class="padwrap" bind:this={padEl}>
    {#if phase !== 'intro'}<div class="hint">Type the answer with the number keys, or tap</div>{/if}
    <NumPad ondigit={digit} onback={back} disabled={phase !== 'play'} {lit} {compact} />
  </div>

  {#if phase === 'intro' && !replaying}
    <div class="overlay">
      <div class="card intro">
        <div class="where">{regionName}{lesson.region !== 'start' ? ` · Stop ${lesson.n}` : ''}</div>
        <h1>{lesson.title}</h1>
        {#if lesson.kind === 'meet'}
          {@const ex = exampleOf(lesson)}
          {@const tr = trickOf(ex)}
          <div class="meet">
            <div class="mpic"><DotPicture fact={ex} size={170} /></div>
            <div class="msay"><b>{tr.name}</b><span>{lesson.op === 'x' ? tr.say : lesson.blurb}</span></div>
          </div>
        {:else if lesson.kind === 'rules'}
          <div class="meet rules">
            <div class="rule"><b>× 1</b><span>{TRICK[1].say(7)}</span></div>
            <div class="rule"><b>× 0</b><span>{TRICK[0].say(7)}</span></div>
          </div>
        {:else}
          <div class="meetbuddy"><Critter friend={profile.buddy} size={110} mood="dance" /></div>
        {/if}
        {#if lesson.kind !== 'meet'}<p class="blurb">{lesson.blurb}</p>{/if}
        {#if !calm}
          <div class="goals">
            {#each starAt as s, i}<div class="goal"><Stars n={i + 1} of={i + 1} size={20} /><span>score {s}</span></div>{/each}
          </div>
          <p class="howscore">Your score is right answers a minute. Quick, right answers climb the rides. No clock, so take the time you need.</p>
        {:else}
          <p class="howscore">Calm mode: no rides and no speed. Just you, {buddy.name} and the facts.</p>
        {/if}
        {#if record}<div class="best muted">Your best: <Stars n={record.stars} of={3} size={16} /> · score {record.bestScore} · ride: {RIDES[record.bestRide].name}</div>{/if}
        <div class="tiles">
          <NavTile size="md" tone="sky" kind="home" label="Home" onclick={leave} />
          <NavTile size="lg" tone="mint" kind="play" label="Start" hotkey="space" onclick={() => { unlockAudio(); begin(); }} />
        </div>
        <div class="pills">
          <label class="pill"><input type="checkbox" checked={calm} onchange={(e) => setCalm((e.currentTarget as HTMLInputElement).checked)} /> Calm mode (no rides, no speed)</label>
        </div>
      </div>
    </div>
  {/if}

  {#if phase === 'paused'}
    <div class="overlay">
      <div class="card pausecard">
        <Critter friend={profile.buddy} size={110} mood="sleep" />
        <h2>Taking a breather</h2>
        <div class="tiles">
          <NavTile size="lg" tone="mint" kind="play" label="Keep going" hotkey="esc" onclick={() => (phase = 'play')} />
          <NavTile size="lg" tone="butter" kind="redo" label="Start over" onclick={restart} />
          <NavTile size="lg" tone="sky" kind="home" label="Home" onclick={leave} />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mrun { position: absolute; inset: 0; display: flex; flex-direction: column; background: transparent; }
  .stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  .loading { position: absolute; left: 0; right: 0; top: 55%; text-align: center; font: 600 20px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(40, 30, 80, .4); }
  .bubble { position: absolute; z-index: 4; white-space: nowrap; transform: translate(10%, -120%); background: #fff; padding: 9px 14px; border-radius: 16px; font: 600 17px/1.1 var(--font-ui); color: var(--ink); box-shadow: var(--shadow); animation: pop-in .25s cubic-bezier(.3, .8, .4, 1.5); border: var(--panel-border); }
  .hud { position: absolute; top: 14px; left: 16px; right: 16px; display: flex; align-items: center; gap: 14px; z-index: 6; }
  .pause { flex: none; }
  .title { flex: none; background: rgba(255, 255, 255, .9); padding: 7px 14px; border-radius: 16px; box-shadow: var(--shadow-sm); border: var(--panel-border); }
  .region { font: 700 11px/1.2 var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .lesson { font: 600 18px/1.15 var(--font-ui); }
  .trail { position: relative; flex: 1; height: 40px; min-width: 100px; }
  .bar { position: absolute; left: 0; right: 26px; top: calc(50% - 6px); height: 12px; background: rgba(255, 255, 255, .85); border-radius: 999px; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, var(--mint), #8fe0c0); border-radius: 999px; transition: width .25s; }
  .flag { position: absolute; right: 0; top: 50%; margin-top: -13px; font-size: 22px; }
  .me { position: absolute; top: -6px; margin-left: -17px; transition: left .25s; }
  .live { flex: none; display: flex; gap: 12px; font: 600 14px/1 var(--font-body); color: var(--muted); background: rgba(255, 255, 255, .9); padding: 9px 12px; border-radius: 14px; box-shadow: var(--shadow-sm); border: var(--panel-border); white-space: nowrap; }
  .live b { font: 600 20px/1 var(--font-ui); color: var(--ink); }
  .ladder { flex: none; }

  .qwrap { position: absolute; left: 0; right: 0; top: clamp(74px, 11%, 100px); display: flex; flex-direction: column; align-items: center; z-index: 5; min-height: 10px; }
  .q { display: flex; align-items: center; gap: clamp(10px, 1.6vw, 22px); padding: clamp(10px, 2vh, 22px) clamp(22px, 3vw, 44px); background: #fff; border-radius: 34px; box-shadow: var(--shadow); border: var(--panel-border); font: 600 clamp(54px, 10vh, 112px)/1 var(--font-ui); color: var(--ink); transition: box-shadow .2s, background .2s; }
  .q .op { color: var(--primary); font-size: .8em; }
  .q.shake { animation: wiggle .35s ease; }
  .q.right { box-shadow: 0 0 0 6px #bdeed6, var(--shadow); }
  .q.fast { box-shadow: 0 0 0 6px var(--mint), 0 0 30px rgba(79, 207, 152, .6), var(--shadow); }
  .q.wrong { box-shadow: 0 0 0 6px #f7c6d9, var(--shadow); }
  .boxes { display: flex; gap: 10px; }
  .box { width: .78em; height: 1.08em; display: grid; place-items: center; border-radius: 18px; border: 4px solid #e2daf3; background: #faf8fd; color: var(--primary-edge); }
  .box.cur { border-color: var(--primary); box-shadow: 0 0 0 5px #e7defe; animation: caret 1.1s ease-in-out infinite; }
  .box.filled { border-color: #cfc3ee; background: #fff; }
  .q.right .box, .q.fast .box { border-color: var(--mint); color: #0f6a48; }
  @keyframes caret { 50% { box-shadow: 0 0 0 9px #efe9ff; } }
  .streak { margin-top: 10px; font: 600 26px/1 var(--font-ui); color: #fff; text-shadow: 0 3px 0 var(--primary-edge), 0 0 18px rgba(124, 92, 245, .6); animation: streak 1.2s ease forwards; pointer-events: none; }
  @keyframes streak { 0% { transform: scale(.5); opacity: 0; } 20% { transform: scale(1.15); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-30px); opacity: 0; } }

  .help { position: absolute; z-index: 7; right: 3%; top: calc(clamp(74px, 11%, 100px) + 42px); width: min(340px, 30vw); background: #fff; border-radius: 26px; box-shadow: var(--shadow); border: var(--panel-border); padding: 14px 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); }
  .help.fix { box-shadow: 0 0 0 5px #f7c6d9, var(--shadow); }
  .hhead { display: flex; align-items: center; gap: 10px; align-self: stretch; }
  .hhead small { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .hhead b { font: 600 30px/1.05 var(--font-ui); }
  .pic { display: grid; place-items: center; min-height: 40px; }
  .help p { margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); text-align: center; }
  .typeit { font: 700 15px var(--font-body); color: var(--muted); background: var(--bg2); padding: 5px 14px; border-radius: 999px; }
  .typeit b { font: 600 20px var(--font-ui); color: var(--primary-edge); }

  .announce { position: absolute; left: 0; right: 0; bottom: 0; top: 40%; overflow: hidden; pointer-events: none; z-index: 8; }
  .banner { position: absolute; left: 55%; right: 0; top: 0; bottom: 10%; justify-content: center; display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: banner 1.5s cubic-bezier(.3, .8, .3, 1) forwards; }
  .banner.down { animation-duration: .9s; }
  .banner.finish { animation: banner-stay .5s cubic-bezier(.3, .8, .3, 1.3) forwards; left: 50%; bottom: 30%; }
  /* the finish sunburst shows whole, centred on the word (the strip clips the ride banners as they slide) */
  .announce:has(.finish) { overflow: visible; }
  .banner.finish .rays { top: 50%; margin-top: -260px; }
  @keyframes banner-stay { 0% { transform: scale(.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .bicon { width: clamp(56px, 10vh, 92px); height: clamp(56px, 10vh, 92px); padding: clamp(10px, 1.7vh, 16px); border-radius: 50%; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); box-shadow: 0 0 0 6px #fff, 0 16px 30px -10px rgba(124, 92, 245, .7); position: relative; z-index: 1; }
  .banner.down .bicon { background: #b8aed0; width: 60px; height: 60px; padding: 10px; }
  .bword { margin-top: 10px; font: 700 clamp(34px, 7vh, 64px)/1 var(--font-ui); color: #fff; text-shadow: 0 5px 0 var(--primary-edge), 0 0 30px rgba(124, 92, 245, .55); position: relative; z-index: 1; }
  .banner.down .bword { font-size: 30px; text-shadow: 0 3px 0 #8a80a6; }
  .bsub { font: 700 16px/1 var(--font-body); color: var(--ink); background: #fff; padding: 6px 12px; border-radius: 999px; margin-top: 8px; position: relative; z-index: 1; }
  .rays { position: absolute; top: -214px; left: calc(50% - 260px); width: 520px; height: 520px; background: repeating-conic-gradient(rgba(255, 255, 255, .55) 0 10deg, rgba(255, 255, 255, 0) 10deg 20deg); border-radius: 50%; mask: radial-gradient(circle, #000 20%, transparent 68%); -webkit-mask: radial-gradient(circle, #000 20%, transparent 68%); animation: spin 6s linear infinite; }
  @keyframes banner { 0% { transform: scale(.3); opacity: 0; } 15% { transform: scale(1.1); opacity: 1; } 25% { transform: scale(1); } 80% { opacity: 1; } 100% { transform: scale(1.05) translateY(-20px); opacity: 0; } }

  .padwrap { flex: none; position: relative; z-index: 6; padding: 10px 18px 16px; background: linear-gradient(rgba(255, 255, 255, .92), var(--bg2)); border-top: var(--panel-border); box-shadow: 0 -10px 30px -20px rgba(60, 40, 110, .3); }
  .hint { text-align: center; margin: -2px 0 8px; font: 700 13px var(--font-body); color: var(--muted); }

  .overlay { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(40, 28, 70, .32); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .25s ease; padding: 16px; }
  .card.intro, .card.pausecard { width: min(760px, 100%); max-height: 100%; overflow: auto; padding: 24px 28px 20px; text-align: center; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.3); }
  .where { font: 800 12px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .intro h1 { font-size: clamp(30px, 5vh, 44px); margin: 6px 0 10px; }
  .meet { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; margin: 4px 0; }
  .msay { display: flex; flex-direction: column; text-align: left; max-width: 300px; gap: 4px; }
  .msay b { font: 600 26px var(--font-ui); color: var(--primary-edge); }
  .msay span { font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .meet.rules { gap: 12px; }
  .rule { flex: 1 1 240px; display: flex; flex-direction: column; gap: 4px; background: var(--bg2); border-radius: 18px; padding: 12px 16px; }
  .rule b { font: 600 32px var(--font-ui); color: var(--primary); }
  .rule span { font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .meetbuddy { display: flex; justify-content: center; }
  .blurb { font-size: 17px; color: var(--ink2); margin: 10px auto 4px; max-width: 560px; }
  .goals { display: flex; justify-content: center; gap: 10px; margin: 14px 0 6px; flex-wrap: wrap; }
  .goal { display: flex; align-items: center; gap: 8px; background: var(--bg2); padding: 8px 12px; border-radius: 14px; font: 700 14px/1 var(--font-body); color: var(--ink2); }
  .howscore { margin: 8px auto 0; max-width: 560px; font: 600 13.5px/1.35 var(--font-body); color: var(--muted); }
  .best { font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .tiles { display: flex; justify-content: center; align-items: flex-end; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
  .pills { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 6px; border-radius: 999px; border: 2px solid #e4dcf2; background: #faf8fd; font: 700 14px var(--font-body); color: var(--ink2); cursor: pointer; }
  .pill input { accent-color: var(--primary); width: 16px; height: 16px; margin: 0 2px 0 6px; }
  .pausecard { display: flex; flex-direction: column; align-items: center; }
  .pausecard h2 { font-size: 30px; margin: 4px 0 6px; }

  /* phones and narrow windows: the question on top, the trick card under it, a calculator pad */
  .compact .hud { top: 8px; left: 8px; right: 8px; gap: 8px; flex-wrap: wrap; }
  .compact .title { padding: 5px 10px; }
  .compact .lesson { font-size: 15px; }
  .compact .region { display: none; }
  .compact .trail { order: 5; flex: 1 1 100%; height: 28px; }
  .compact .me { top: -10px; }
  .compact .live { padding: 6px 8px; gap: 8px; font-size: 12px; }
  .compact .live b { font-size: 16px; }
  .compact .ladder { display: none; }
  .compact .qwrap { top: 96px; }
  .compact .q { font-size: clamp(40px, 8vh, 62px); border-radius: 24px; padding: 8px 18px; gap: 10px; }
  .compact .box { border-radius: 12px; border-width: 3px; }
  .compact .help { left: 8px; right: 8px; width: auto; top: auto; bottom: 8px; padding: 10px 12px; gap: 4px; flex-direction: column; }
  .compact .hhead b { font-size: 24px; }
  .compact .help p { font-size: 14px; }
  .compact .padwrap { padding: 8px 10px 10px; }
  .compact .hint { display: none; }
  .compact .announce { top: 45%; }
  .compact .banner { left: 30%; }
  .compact .bword { font-size: 34px; }
</style>
