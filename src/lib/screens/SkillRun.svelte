<script lang="ts">
  // A skill trip in 3D (fractions and every area after): the question at the top (numbers, fractions,
  // painted pictures), your buddy on the course, and the right input at the bottom: the number pad, the
  // fraction pad, big choices, a number line or a grid. It runs exactly like a facts trip: every answer
  // moves the buddy on (the last one over the finish line), quick right answers climb the speed steps, a
  // new kind of question comes with its trick first, a miss shows in red for a moment, then the answer and
  // its trick, and comes back a few questions later. No clock.
  import EggBadge from '../ui/EggBadge.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { mulberry32 } from '../engine/rng';
  import { danceOf, outfitOf, type Profile } from '../engine/profile';
  import { rideName, RIDES, type RideEvent } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { FRIEND } from '../art/cast';
  import { sfx, startMusic, unlockAudio, musicEnergy } from '../audio/sound';
  import { stage } from '../three/stage';
  import { RunScene } from '../three/runScene';
  import { STRIDE } from '../math/course';
  import { speedOf } from '../math/facts';
  import { FactMeter, mathGoal, mathStars, tripStats } from '../math/meter';
  import { mathOf } from '../math/progress';
  import { SKILL } from '../math/skills/registry';
  import { makeAt, pitch, TARGET } from '../math/skills/ability';
  import { AREA } from '../math/skills/registry';
  import { SKILL_EPISODES, SKILL_LESSON, SKILL_REGION, tempoOf } from '../math/skills/course';
  import { FRAC_LESSON } from '../math/fracEpisodes';
  import { SHAPE_LESSON } from '../math/shapes/episodes';
  import { RATIO_LESSON } from '../math/ratioEpisodes';
  import { NEG_LESSON } from '../math/integers/episodes';
  import { DATA_LESSON } from '../math/data/episodes';
  import { isLearned } from '../math/learn';
  import Episode from '../math/ui/Episode.svelte';
  import { SkillTripPicker, type SkillPick } from '../math/skills/picker';
  import { applySkillRun, type SkillResult } from '../math/skills/progress';
  import { answerParts, shortText } from '../math/skills/text';
  import { asChoices, choiceChance, typedAs, CHOICE_RIGHT } from '../math/skills/choices';
  import type { Answer } from '../math/skills/types';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';
  import SkillInput from '../math/skills/ui/SkillInput.svelte';
  import { WRONG_MS } from '../math/ui/NumPad.svelte';
  import RideLadder from '../ui/RideLadder.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Stars from '../ui/Stars.svelte';
  import Icon from '../ui/Icon.svelte';

  const profile = $state.snapshot(game.profile!) as Profile;
  const S = profile.settings;
  const grown = S.grown;
  const m = mathOf(profile);
  const lesson = SKILL_LESSON[game.skillLessonId] ?? SKILL_LESSON['frac-a-1'];
  /** a stop that meets a new idea: its Learn episode, to watch first */
  const introEp = lesson.kind === 'meet' ? (lesson.learn.map(k => SKILL_EPISODES[k]).find(e => e && (FRAC_LESSON[e] || SHAPE_LESSON[e] || RATIO_LESSON[e] || NEG_LESSON[e] || DATA_LESSON[e])) ?? null) : null;
  const area = AREA[lesson.area];
  const regionName = lesson.region === 'start' ? area.name : SKILL_REGION[lesson.region].name;
  const tempo = tempoOf(lesson.area);
  const picker = new SkillTripPicker({ lesson, mem: m.skills ?? {}, now: Date.now(), math: m, grown: !!grown });
  // some questions are asked as choices (likely mistakes to pick from): often while a kind is new
  const mix = mulberry32(Date.now() % 1e9);
  /** this question was turned into choices */
  let choiced = false;
  let calm = $state(!!m.calm);
  const meter = new FactMeter(grown, !!m.calm);
  const record = m.lessons[lesson.id];
  const goal = mathGoal(lesson.goal, grown, S.easy);
  const starAt = [Math.ceil(goal * 0.3), Math.ceil(goal * 0.6), goal];
  const buddy = FRIEND[profile.buddy];
  const STRETCH = STRIDE[lesson.move];
  // one stretch per question to the finish line (a miss brought back shares the way out a little finer)
  const stretches = picker.length;
  // the Meet card's example: the first new kind of question, pitched easy for this child (a teach: 90%)
  // (a seeded source, never a constant one: generators draw again until two numbers differ)
  const example = lesson.learn[0] ? makeAt(SKILL[lesson.learn[0]], mulberry32(37), SKILL[lesson.learn[0]].subs[Math.min(2, SKILL[lesson.learn[0]].subs.length - 1)].id, pitch(m, lesson.learn[0], TARGET.teach, { grown: !!grown })) : null;

  let phase = $state<'intro' | 'play' | 'paused' | 'done'>('intro');
  const replaying = game.quickStart;
  let pick = $state<SkillPick | null>(null);
  const item = $derived(pick?.item ?? null);
  /** ask: answer it. learn: a new kind, its trick shown first. fix: after a miss, answer it again with the answer shown. */
  let mode = $state<'ask' | 'learn' | 'fix'>('ask');
  let feedback = $state<'right' | 'fast' | 'wrong' | null>(null);
  let marked = $state<{ id: string; ok: boolean } | null>(null);
  let fill = $state<{ kind: 'number'; text: string; bad?: boolean } | { kind: 'fraction'; n: string; d: string; focus: 'n' | 'd' | null; bad?: boolean } | null>(null);
  let shake = $state(0);
  let tier = $state(0), best = $state(0), progress = $state(0), trip = $state(0);
  let liveFpm = $state(0), liveAcc = $state(100), streak = $state(0);
  let streakPop = $state<{ text: string; n: number } | null>(null);
  let banner = $state<{ tier: number; n: number; down: boolean } | null>(null);
  let bubble = $state<string | null>(null);
  let bubbleXY = $state({ x: 0.45, y: 0.5 });
  let burst = $state(0);
  let doneBanner = $state(false);
  let loading = $state(true);
  let w = $state(1280), h = $state(800);
  const compact = $derived(w < 700);
  let qEl: HTMLDivElement | undefined = $state();
  let padEl: HTMLDivElement | undefined = $state();
  let helpEl: HTMLDivElement | undefined = $state();
  let scene: RunScene | null = null;
  let raf = 0, napped = false, shownAt = 0, firstAt: number | null = null, missThink = 0, steps = 0, lastInput = 0, lastHud = 0;
  let busy = false;
  const results: SkillResult[] = [];
  let eggWarm = $state(0);
  let timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  let bannerTimer: ReturnType<typeof setTimeout> | undefined;
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  const showHelp = $derived(phase === 'play' && !!item && (mode === 'learn' || mode === 'fix'));
  const skill = $derived(item ? SKILL[item.skill] : null);

  function begin() { phase = 'play'; startMusic(lesson.world); sfx.whoosh(); nextQ(); }
  function nextQ() {
    const pk = picker.next();
    if (!pk) { finish(); return; }
    const stage = m.skills?.[pk.item.key]?.stage ?? 0;
    const ch = mix() < choiceChance(stage, lesson.kind) ? asChoices(pk.item, mix) : null;
    choiced = !!ch;
    pick = ch ? { ...pk, item: ch } : pk; feedback = null; marked = null; firstAt = null; busy = false;
    clearTimeout(markTimer);
    shownAt = performance.now(); meter.shown(shownAt);
    mode = pk.reason === 'new' ? 'learn' : 'ask';
    if (mode === 'learn') say(`New one! ${pk.item.trick?.name ?? SKILL[pk.item.skill].name}.`, 1800);
  }
  function say(msg: string, ms = 1500) { bubble = msg; clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => (bubble = null), ms); }
  function first() { const t = performance.now(); lastInput = t; if (firstAt === null) firstAt = t; unlockAudio(); }

  let markTimer: ReturnType<typeof setTimeout> | undefined;
  /** An answer: true if it's right. A wrong one stays a moment (the input shows it red, then clears it). */
  function answer(a: Answer): boolean | undefined {
    if (phase !== 'play' || !item || !skill || busy) return;
    const t = performance.now();
    // a question asked as choices: the right choice (its own check might look for a typed answer)
    const ok = choiced ? a.kind === 'choice' && a.id === CHOICE_RIGHT : skill.check(item, a);
    if (a.kind === 'choice') { marked = { id: a.id, ok }; clearTimeout(markTimer); if (!ok) markTimer = setTimeout(() => { marked = null; }, WRONG_MS); }
    const base = { id: item.id, key: item.key, label: shortText(item), rung: item.rung, choice: choiced };
    if (mode === 'ask') {
      const thinkMs = (firstAt ?? t) - shownAt;
      if (ok) {
        const speed = speedOf({ ok, thinkMs, fastMs: skill.fastMs });
        // picking from choices counts as right, but only a typed answer grows a bloom
        results.push({ ...base, ok: true, speed: choiced && speed === 'fast' ? 'slow' : speed, thinkMs, ms: t - shownAt, intro: false });
        eggWarm++;
        picker.answer(true, thinkMs);
        meter.push(true, (t - shownAt) / tempo);
        stepOn(speed === 'fast');
      } else {
        picker.answer(false, thinkMs);
        missThink = thinkMs;
        mode = 'fix'; feedback = 'wrong'; shake++; streak = 0;
        sfx.miss(); scene?.key(false, steps);
        say(['Nearly! Have a look.', 'Not quite. Here it is.', "That's a tricky one!"][results.length % 3], 1600);
        // a fresh try: what was typed (or the choice) shows red a moment, then clears
        firstAt = null;
      }
    } else if (ok) {
      const fix = mode === 'fix';
      results.push(fix ? { ...base, ok: false, speed: 'miss', thinkMs: missThink, ms: t - shownAt, intro: false } : { ...base, ok: true, speed: 'slow', thinkMs: (firstAt ?? t) - shownAt, ms: t - shownAt, intro: true });
      if (fix) meter.push(false, (t - shownAt) / tempo);
      stepOn(false, fix);
    } else {
      shake++; sfx.slip();
    }
    return ok;
  }
  function stepOn(quick: boolean, fixed = false) {
    busy = true; steps++;
    // its share of the rest of the way, the way the buddy goes (a miss coming back makes the trip longer)
    const left = picker.left;
    trip = left ? trip + (1 - trip) / (left + 1) : 1;
    scene?.key(true, steps, left);
    feedback = quick ? 'fast' : 'right';
    if (quick) scene?.hop();
    sfx.key(quick ? 'RI' : 'LI');
    if (!fixed && mode === 'ask') { streak++; if (streak === 5 || streak === 10 || streak === 15) streakPop = { text: `${streak} in a row!`, n: (streakPop?.n ?? 0) + 1 }; }
    // the last answer carries the buddy over the finish line straight away
    if (picker.done) finish();
    else later(fixed ? 520 : 420, nextQ);
  }
  function onRide(ev: RideEvent) {
    tier = ev.tier; best = meter.best;
    banner = { tier: ev.tier, n: (banner?.n ?? 0) + 1, down: ev.type === 'down' };
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => (banner = null), ev.type === 'up' ? 1500 : 900);
    musicEnergy(ev.tier / 5); scene?.setTier(ev.tier);
    if (ev.type === 'up') burst++;
  }
  let keepScene = false;
  function finish() {
    if (phase === 'done') return;
    // (the last answer stays up, green, while the buddy dashes over the line)
    phase = 'done'; trip = 1;
    const stats = tripStats(results);
    const finished = picker.done;
    const stars = mathStars(stats, goal, finished);
    const outcome = applySkillRun($state.snapshot(game.profile!) as Profile, { lessonId: lesson.id, results, stats, stars, bestRide: meter.best, finished, at: Date.now(), napped });
    game.replaceProfile(outcome.profile);
    game.skillLast = { ...outcome, lessonId: lesson.id, stats, results: [...results], stars, bestRide: meter.best, finished };
    let cheered = false;
    const cheer = () => { if (cheered) return; cheered = true; sfx.complete(); burst++; doneBanner = true; };
    let gone = false;
    const toResults = () => { if (!gone) { gone = true; cheer(); keepScene = true; game.go('skillResults'); } };
    if (scene) { scene.onCrossed = cheer; scene.finish(); scene.onCelebrated = toResults; later(5000, cheer); later(12000, toResults); }
    else { cheer(); later(1500, toResults); }
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    unlockAudio();
    if (game.modalOpen) return;
    if (phase === 'intro') { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); begin(); } else if (e.key === 'Escape') leave(); return; }
    if (phase === 'paused') { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); phase = 'play'; } return; }
    if (phase === 'play' && e.key === 'Escape') { phase = 'paused'; napped = true; }
  }
  function onBlur() { if (phase === 'play') { phase = 'paused'; napped = true; } }
  function leave() { phase = 'done'; game.go('map'); }
  function restart() { game.startSkill(lesson.id, true); }
  function setCalm(on: boolean) { calm = on; game.update(pp => { pp.math = { ...mathOf(pp), calm: on }; }); }

  function frame(t: number) {
    if (phase === 'play') {
      const ev = meter.update(t);
      if (ev) onRide(ev);
      if (t - lastHud > 150) {
        lastHud = t;
        progress = meter.progress();
        const st = tripStats(results);
        liveFpm = Math.round(st.fpm);
        liveAcc = results.some(r => !r.intro) ? Math.round(st.acc * 100) : 100;
        if (item && t - Math.max(shownAt, lastInput) > 20000 && !bubble) say('Take your time. No rush!', 2500);
      }
    }
    if (scene) { scene.paused = phase === 'paused'; const p = scene.screen(); bubbleXY = { x: p.x, y: Math.max(p.y, scene.view.top + 40 / innerHeight) }; }
    raf = requestAnimationFrame(frame);
  }
  function updateView() {
    if (!scene) return;
    const H = innerHeight;
    const top = qEl ? qEl.getBoundingClientRect().bottom / H : 0.3;
    const low = compact && helpEl ? helpEl : padEl;
    const bottom = low ? low.getBoundingClientRect().top / H : 0.85;
    scene.view = { top: top + 0.01, bottom: Math.max(top + 0.16, bottom - 0.01), left: 0, right: 1 };
  }
  $effect(() => { void w; void h; void showHelp; void item; requestAnimationFrame(updateView); });
  // dev checks answer the trip from the browser
  if (import.meta.env.DEV) (window as unknown as { __skill: object }).__skill = { item: () => item, mode: () => mode, phase: () => phase, answer: (a: Answer) => answer(a), begin: () => begin() };

  onMount(() => {
    RunScene.create({ buddy: profile.buddy, outfit: outfitOf(profile), dance: danceOf(profile), length: stretches, region: lesson.world, move: lesson.move, keyLen: STRETCH, pace: { window: 18, full: 6, stop: 12, lead: 0.3 } })
      .then(sc => { scene = sc; stage.use(sc); updateView(); loading = false; })
      .catch(err => { console.error(err); loading = false; });
    game.quickStart = false;
    if (replaying) later(300, () => { if (phase === 'intro') begin(); });
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    raf = requestAnimationFrame(frame);
    startMusic(lesson.world);
    // (dev only, for checking the adaptive questions: the current question, the trip so far, and answering it)
    if (import.meta.env.DEV) (window as unknown as { __skill: unknown }).__skill = { item: () => item, mode: () => mode, phase: () => phase, begin, answer, asked: () => picker.served.map(x => ({ id: x.item.id, rung: x.item.rung, reason: x.reason })) };
  });
  onDestroy(() => {
    if (!keepScene) stage.use(null);
    window.removeEventListener('keydown', onKey); window.removeEventListener('blur', onBlur);
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); clearTimeout(bannerTimer); clearTimeout(bubbleTimer); clearTimeout(markTimer);
  });
</script>

<div class="mrun" class:compact class:learning={!!game.learnOverlay} bind:clientWidth={w} bind:clientHeight={h}>
  <div class="stage">
    {#if bubble && phase === 'play' && !showHelp}<div class="bubble" style:left="{bubbleXY.x * innerWidth}px" style:top="{bubbleXY.y * innerHeight}px">{bubble}</div>{/if}
    {#if loading}<div class="loading">Getting the island ready…</div>{/if}
    <div class="hud">
      <button class="btn btn-icon pause" aria-label="Pause" onclick={() => (phase = phase === 'play' ? 'paused' : phase)}><Icon name="pause" size={32} /></button>
      <div class="title"><div class="region">{regionName}</div><div class="lesson">{lesson.title}</div></div>
      <div class="trail">
        <div class="bar"><div class="fill" style:width="{trip * 100}%"></div></div>
        <div class="flag"><Icon name="finish" size={26} /></div>
        <div class="me" style:left="{trip * 100}%"><Critter friend={profile.buddy} size={34} round /></div>
      </div>
      <EggBadge warm={eggWarm} />
      {#if !calm}
        <div class="live"><div><b>{liveFpm}</b> a minute</div><div><b>{liveAcc}</b>%</div></div>
        <div class="ladder"><RideLadder {tier} {progress} {best} blocked={false} record={record?.bestRide ?? 0} move={lesson.move} /></div>
      {/if}
    </div>

    <div class="qwrap" bind:this={qEl}>
      {#if item && phase !== 'intro'}
        <div class="ask">{item.ask}</div>
        {#key shake}
          <div class="q" class:right={feedback === 'right'} class:fast={feedback === 'fast'} class:wrong={feedback === 'wrong' && mode === 'fix'} class:shake={shake > 0 && feedback !== 'right' && feedback !== 'fast'}>
            <SkillPrompt parts={item.prompt} {fill} size={compact ? 46 : 74} picSize={compact ? 120 : 190} done={feedback === 'right' || feedback === 'fast'} onpick={(w) => { if (fill?.kind === 'fraction') fill = { ...fill, focus: w }; }} />
          </div>
        {/key}
        {#if streakPop}{#key streakPop.n}<div class="streak">{streakPop.text}</div>{/key}{/if}
      {/if}
    </div>

    {#if showHelp && item}
      <div class="help" class:fix={mode === 'fix'} bind:this={helpEl}>
        <div class="hhead">
          <Critter friend={profile.buddy} size={compact ? 40 : 54} round />
          <div><small>{mode === 'fix' ? `${buddy.name} shows you` : `New · ${item.trick?.name ?? skill?.name}`}</small><span class="ans"><SkillPrompt parts={answerParts(item)} size={compact ? 26 : 34} picSize={60} /></span></div>
        </div>
        <p>{mode === 'fix' ? item.explain : (item.trick?.say ?? item.explain)}</p>
        {#if mode === 'learn'}<p class="small">{item.explain}</p>{/if}
        <div class="typeit">{item.input !== 'choice' ? 'Put in the answer to go on' : typedAs(item) ? 'Tap it or type it to go on' : 'Tap the right one to go on'}</div>
      </div>
    {/if}

    <div class="announce">
      {#if banner}
        {#key banner.n}
          <div class="banner" class:down={banner.down}>
            {#if !banner.down}<div class="rays"></div>{/if}
            <svg class="bicon" viewBox="0 0 48 48">{@html rideIcon(banner.tier, '#fff', lesson.move)}</svg>
            <div class="bword">{banner.down ? 'Easy does it' : rideName(banner.tier, lesson.move) + '!'}</div>
            {#if !banner.down}<div class="bsub">{banner.tier === RIDES.length - 1 ? 'Top speed!' : 'Quick and right to go higher'}</div>{/if}
          </div>
        {/key}
      {/if}
      {#if doneBanner}<div class="banner finish"><div class="rays"></div><div class="bword">Finished!</div></div>{/if}
    </div>
    <Confetti {burst} x={24} y={60} />
  </div>

  <div class="padwrap" bind:this={padEl}>
    {#if item && phase !== 'intro'}
      <SkillInput {item} disabled={phase !== 'play' || feedback === 'right' || feedback === 'fast'} {compact} {marked} bind:fill onanswer={answer} onfirst={first} />
    {:else}
      <div class="padspace"></div>
    {/if}
  </div>

  {#if phase === 'intro' && !replaying}
    <div class="overlay">
      <div class="card intro">
        <div class="where">{regionName}{lesson.region !== 'start' ? ` · Stop ${lesson.n}` : ''}</div>
        <h1>{lesson.title}</h1>
        {#if example}
          <div class="meet">
            <div class="mpic"><SkillPrompt parts={example.prompt} size={40} picSize={150} /></div>
            <div class="msay"><b>{example.trick?.name ?? SKILL[example.skill].name}</b><span>{lesson.blurb}</span></div>
          </div>
        {:else}
          <div class="meetbuddy"><Critter friend={profile.buddy} size={110} mood="dance" /></div>
          <p class="blurb">{lesson.blurb}</p>
        {/if}
        {#if introEp}<button class="watchl" onclick={() => { sfx.click(); game.learnOverlay = introEp; }}><img src="{import.meta.env.BASE_URL}learn/tile.webp" alt="" /><span><b>{isLearned(mathOf(profile), introEp) ? 'Watch the lesson again' : 'Watch the lesson first'}</b><small>{(FRAC_LESSON[introEp] ?? SHAPE_LESSON[introEp] ?? RATIO_LESSON[introEp] ?? NEG_LESSON[introEp] ?? DATA_LESSON[introEp]).title}: {buddy.name} shows you how</small></span></button>{/if}
        {#if !calm}
          <div class="goals">{#each starAt as s, i}<div class="goal"><Stars n={i + 1} of={i + 1} size={20} /><span>score {s}</span></div>{/each}</div>
          <p class="howscore">Your score is right answers a minute. Quick, right answers move you up the speed steps. No clock, so take the time you need.</p>
        {:else}
          <p class="howscore">Calm mode: no rides and no speed. Just you, {buddy.name} and the questions.</p>
        {/if}
        {#if record}<div class="best muted">Your best: <Stars n={record.stars} of={3} size={16} /> · score {record.bestScore} · top speed: {rideName(record.bestRide, lesson.move)}</div>{/if}
        <div class="tiles">
          <NavTile size="md" tone="sky" kind="home" label="Home" onclick={leave} />
          <NavTile size="lg" tone="mint" kind="play" label="Start" hotkey="space" onclick={() => { unlockAudio(); begin(); }} />
        </div>
        <div class="pills"><label class="pill"><input type="checkbox" checked={calm} onchange={(e) => setCalm((e.currentTarget as HTMLInputElement).checked)} /> Calm mode (no rides, no speed)</label></div>
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
  {#if game.learnOverlay}
    <!-- a Learn episode over the trip: the trip waits underneath, and gets its 3D view back after -->
    <div class="learnlay">
      {#key game.learnOverlay}<Episode id={game.learnOverlay} embedded onclose={() => (game.learnOverlay = null)} />{/key}
    </div>
  {/if}
</div>

<style>
  .mrun.learning > :global(:not(.learnlay)) { visibility: hidden; }
  .learnlay { position: fixed; inset: 0; z-index: 60; }
  .watchl { display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; text-align: left; margin: 8px auto 0; background: linear-gradient(#fffaf0, #ffefc6); border-radius: 18px; padding: 6px 16px 6px 6px; box-shadow: 0 0 0 3px #ffd36b, 0 4px 0 #e6bd63; transition: transform .15s; }
  .watchl:hover { transform: translateY(-2px); }
  .watchl img { width: 40px; height: 48px; object-fit: contain; }
  .watchl b { display: block; font: 600 18px var(--font-ui); color: #6b4300; }
  .watchl small { display: block; font: 600 13px var(--font-body); color: #8a6a2a; }
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
  .flag { position: absolute; right: 0; top: 50%; margin-top: -13px; }
  .me { position: absolute; top: -6px; margin-left: -17px; transition: left .25s; }
  .live { flex: none; display: flex; gap: 12px; font: 600 14px/1 var(--font-body); color: var(--muted); background: rgba(255, 255, 255, .9); padding: 9px 12px; border-radius: 14px; box-shadow: var(--shadow-sm); border: var(--panel-border); white-space: nowrap; }
  .live b { font: 600 20px/1 var(--font-ui); color: var(--ink); }
  .ladder { flex: none; }
  .qwrap { position: absolute; left: 0; right: 0; top: clamp(70px, 10%, 96px); display: flex; flex-direction: column; align-items: center; z-index: 5; min-height: 10px; gap: 8px; }
  .ask { font: 600 20px var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .92); padding: 5px 16px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .q { display: flex; align-items: center; padding: clamp(10px, 1.8vh, 18px) clamp(22px, 3vw, 40px); background: #fff; border-radius: 34px; box-shadow: var(--shadow); border: var(--panel-border); transition: box-shadow .2s, background .2s; }
  .q.shake { animation: wiggle .35s ease; }
  .q.right { box-shadow: 0 0 0 6px #bdeed6, var(--shadow); }
  .q.fast { box-shadow: 0 0 0 6px var(--mint), 0 0 30px rgba(79, 207, 152, .6), var(--shadow); }
  .q.wrong { box-shadow: 0 0 0 6px #f7c6d9, var(--shadow); }
  .streak { font: 600 26px/1 var(--font-ui); color: #fff; text-shadow: 0 3px 0 var(--primary-edge), 0 0 18px rgba(124, 92, 245, .6); animation: streak 1.2s ease forwards; pointer-events: none; }
  @keyframes streak { 0% { transform: scale(.5); opacity: 0; } 20% { transform: scale(1.15); opacity: 1; } 70% { opacity: 1; } 100% { transform: translateY(-30px); opacity: 0; } }
  .help { position: absolute; z-index: 7; right: 3%; top: calc(clamp(70px, 10%, 96px) + 52px); width: min(360px, 30vw); background: #fff; border-radius: 26px; box-shadow: var(--shadow); border: var(--panel-border); padding: 14px 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); }
  .help.fix { box-shadow: 0 0 0 5px #f7c6d9, var(--shadow); }
  .hhead { display: flex; align-items: center; gap: 10px; align-self: stretch; }
  .hhead small { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .ans { display: block; margin-top: 4px; }
  .help p { margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); text-align: center; }
  .help p.small { font-size: 14px; color: var(--muted); }
  .typeit { font: 700 15px var(--font-body); color: var(--muted); background: var(--bg2); padding: 5px 14px; border-radius: 999px; }
  .announce { position: absolute; left: 0; right: 0; bottom: 0; top: 40%; overflow: hidden; pointer-events: none; z-index: 8; }
  .banner { position: absolute; left: 55%; right: 0; top: 0; bottom: 10%; justify-content: center; display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: banner 1.5s cubic-bezier(.3, .8, .3, 1) forwards; }
  .banner.down { animation-duration: .9s; }
  .banner.finish { animation: banner-stay .5s cubic-bezier(.3, .8, .3, 1.3) forwards; left: 50%; bottom: 30%; }
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
  .padspace { height: clamp(56px, 8.5vh, 76px); }
  .overlay { position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(40, 28, 70, .32); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: fade-up .25s ease; padding: 16px; }
  .card.intro, .card.pausecard { width: min(760px, 100%); max-height: 100%; overflow: auto; padding: 24px 28px 20px; text-align: center; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.3); }
  .where { font: 800 12px/1 var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .intro h1 { font-size: clamp(30px, 5vh, 44px); margin: 6px 0 10px; }
  .meet { display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: wrap; margin: 4px 0; }
  .msay { display: flex; flex-direction: column; text-align: left; max-width: 320px; gap: 4px; }
  .msay b { font: 600 26px var(--font-ui); color: var(--primary-edge); }
  .msay span { font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
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
  .compact .hud { top: 8px; left: 8px; right: 8px; gap: 8px; flex-wrap: wrap; }
  .compact .title { padding: 5px 10px; }
  .compact .lesson { font-size: 15px; }
  .compact .region { display: none; }
  .compact .trail { order: 5; flex: 1 1 100%; height: 28px; }
  .compact .me { top: -10px; }
  .compact .live { padding: 6px 8px; gap: 8px; font-size: 12px; }
  .compact .live b { font-size: 16px; }
  .compact .ladder { display: none; }
  .compact .qwrap { top: 92px; }
  .compact .ask { font-size: 15px; }
  .compact .q { border-radius: 24px; padding: 8px 14px; }
  .compact .help { left: 8px; right: 8px; width: auto; top: auto; bottom: 8px; padding: 10px 12px; gap: 4px; }
  .compact .help p { font-size: 14px; }
  .compact .padwrap { padding: 8px 10px 10px; }
  .compact .announce { top: 45%; }
  .compact .banner { left: 30%; }
  .compact .bword { font-size: 34px; }
</style>
