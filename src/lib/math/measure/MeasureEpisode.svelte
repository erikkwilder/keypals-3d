<script lang="ts" module>
  /** the short reminder of each job (the coach's voice says it in full) */
  const TASK_WORDS: Record<string, string> = {
    watch: '', hand: 'Drag the glowing hand round the clock', nums: 'Tap each glowing number', slide: 'Slide it along the ruler to 0',
    mark: 'Tap the glowing mark', load: 'Drag the sack onto the scale', pour: 'Drag the water up to the line', tiles: 'Drag grass tiles into the glowing squares', sides: 'Tap each glowing side',
  };
  /** each card's picture: the brass alarm clock for the time tricks, the measuring bench and the garden for the others */
  const CARD_ART: Record<string, string> = { 'ms-oclock': 'math/measure/tile.webp', 'ms-fives': 'math/measure/tile.webp', 'ms-jump': 'math/measure/tile.webp', 'ms-zero': 'math/play-bench.webp', 'ms-marks': 'math/play-bench.webp', 'ms-rows': 'math/measure/region-build.webp' };
</script>

<script lang="ts">
  // A Time and measuring Learn episode (math/measure/episodes.ts) in the shared episode framework: the
  // Clockmaker's Workshop in 3D (three/episodeScene.ts: the table, your buddy, a Glimmer, the light and
  // the camera), with real measuring things on the table (three/measureKit.ts). The coach tells the
  // story (voice and words at the top). Each step is something your hands do: drag the clock's hands,
  // tap its numbers to count by fives, slide a crayon to 0, lift a sack onto the scale, pour water to a
  // mark, lay grass tiles in rows. Then the shortcut appears over what you just did. Then your buddy
  // has a go and gets it wrong: you spot it and fix it. Two of your own (setting the clock or filling
  // the jug yourself, or typing the number), and the trick's card is yours; the next day it comes back
  // for a quick check (`check`). It saves like every episode (learn.ts finishLesson, markChecked).
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Vector3 } from 'three';
  import { stage, type Controller } from '../../three/stage';
  import { EpisodeScene, type View } from '../../three/episodeScene';
  import { MeasureKit } from '../../three/measureKit';
  import { game } from '../../state/game.svelte';
  import { quietForLesson, sfx } from '../../audio/sound';
  import { hush, lineText, say } from '../../audio/voice.svelte';
  import { buddyLine } from '../../content/voice';
  import { danceOf } from '../../engine/profile';
  import { advView } from '../../adventure/state';
  import { FRIEND } from '../../art/cast';
  import { GLIMMER } from '../../adventure/glimmers';
  import { finishLesson, markChecked, type Board } from '../learn';
  import { SETS } from '../episodes';
  import { fixChoices, parseTime, type MeasureLesson, type MQ, type MTask } from './episodes';
  import NumPad from '../ui/NumPad.svelte';
  import CloseButton from '../../ui/CloseButton.svelte';
  import SpeechDock from '../ui/SpeechDock.svelte';
  import Confetti from '../../ui/Confetti.svelte';
  import Icon from '../../ui/Icon.svelte';
  import { mSfx } from './sounds';

  type Props = { lesson: MeasureLesson; check?: boolean; onclose: () => void };
  let { lesson, check = false, onclose }: Props = $props();

  const base = import.meta.env.BASE_URL;
  const place = SETS.clockshop;
  // (keyed by its lesson: these don't change while it's open)
  // svelte-ignore state_referenced_locally
  const L = lesson;
  const buddy = game.profile!.buddy;
  const pal = GLIMMER[L.star];
  const cardWords = L.card.replace(/^You won the .*? card! /, '');
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const CLEAR: Board = { cell: 48, dots: [], frames: [], plates: [], line: null, tags: [] };

  let sc = $state<EpisodeScene | null>(null);
  let kit = $state<MeasureKit | null>(null);
  let ctl: Controller | null = null;
  let before: Controller | null = null;
  let gone = false;
  let run = 0;

  type Phase = 'load' | 'intro' | 'step' | 'teach' | 'turn' | 'card' | 'check' | 'checked';
  let phase = $state<Phase>('load');
  let i = $state(0);
  let task = $state<MTask>({ kind: 'watch' });
  let stepDone = $state(false);
  let eqOn = $state(false);
  let line = $state('');
  let bubble = $state<string | null>(null);
  /** who spoke last: the speech band shows their words */
  let who = $state<'story' | 'buddy'>('story');
  let tsub = $state<'watch' | 'fix' | 'fixed'>('watch');
  let wrongOn = $state(false);
  let k = $state(0);
  let typed = $state('');
  let misses = $state(0);
  let shake = $state(0);
  let locked = $state(false);
  let burst = $state(0);
  let stuck = $state(false);
  let left = $state(0);
  let pinsNow = $state<{ id: string; text: string; kind: string }[]>([]);
  let result = $state<{ first: boolean; shells: number; eggs: number } | null>(null);
  let w = $state(1280), h = $state(800);
  /** how tall the bottom panel is now (on a phone the 3D work is framed above it) */
  let bottomH = $state(0);
  const narrow = $derived(w < 760);

  const step = $derived(L.steps[Math.min(i, L.steps.length - 1)]);
  const q = $derived<MQ>(check ? L.tries[2] : L.tries[Math.min(k, 1)]);
  const total = L.steps.length + 4;
  const at = $derived(phase === 'intro' || phase === 'load' ? -1 : phase === 'step' ? i : phase === 'teach' ? L.steps.length : phase === 'turn' ? L.steps.length + 1 + k : total - 1);
  const eqParts = $derived(step.eq.split(/(\[[^\]]+\])/).filter(Boolean).map(s => (s.startsWith('[') ? { lit: true, t: s.slice(1, -1) } : { lit: false, t: s })));
  const choices = fixChoices(L);
  const right = L.teach.q.ans;
  /** the buddy's words for a key (voice.ts BUDDY_WORDS), else what the lesson's data says */
  const buddyWords = (key: string, fallback = '') => lineText(buddyLine(buddy, key)) || fallback;
  /** room kept for the speech band (SpeechDock) under the top bar */
  const DOCK_H = { wide: 92, narrow: 74 };
  /** a turn's choices: its own, or (a time) the right one and the buddy-style slips */
  const qChoices = $derived(q.choices ?? []);

  // ---------- the voice ----------
  async function speak(lineId: string) {
    line = lineText(lineId); who = 'story';
    const t0 = performance.now();
    await Promise.race([say(lineId, { important: true, caption: false }), sleep(2500 + line.length * 95)]);
    if (game.settings.voice === false) await sleep(Math.max(0, Math.max(1600, line.length * 55) - (performance.now() - t0)));
  }

  /** The buddy says one of its lines in its own voice, talking with its hands as it does; `text` shows
   *  other words in its bubble than the recording's (a hint with this question's numbers). */
  async function buddySay(key: string, text?: string) {
    const words = text ?? buddyWords(key);
    bubble = words; who = 'buddy';
    sc?.talk(Math.max(1.4, words.length * 0.06));
    const t0 = performance.now();
    await Promise.race([say(buddyLine(buddy, key), { important: true, caption: false }), sleep(2500 + words.length * 95)]);
    if (game.settings.voice === false) await sleep(Math.max(0, Math.max(1600, words.length * 55) - (performance.now() - t0)));
  }

  // ---------- the story ----------
  async function intro() {
    const r = ++run;
    phase = 'intro';
    kit?.set(L.steps[0].at);
    sc?.shot('intro'); sc?.wave(); sc?.palDo('happy');
    await speak(`ep.${L.id}.intro`);
    await sleep(600);
    if (r === run && phase === 'intro') playStep(0);
  }
  async function playStep(n: number) {
    const s = sc, kt = kit; if (!s || !kt) return;
    const r = ++run;
    phase = 'step'; i = n; stepDone = false; eqOn = false; stuck = false; bubble = null;
    const st = L.steps[n];
    task = st.do;
    kt.set(st.at);
    if (st.do.kind === 'watch') {
      s.shot('wide');
      s.point(kt.overPoint(), 2.2);
      await speak(`ep.${L.id}.s${n}`);
      if (r !== run) return;
    } else {
      s.shot('board');
      const late = setTimeout(() => { if (r === run) stuck = true; }, 12000);
      const done = kt.arm(st.do);
      left = kt.left;
      void speak(`ep.${L.id}.s${n}`);
      s.present();
      await done;
      clearTimeout(late); stuck = false;
      if (r !== run) return;
      s.shot('wide');
      s.cheer(); s.palDo('happy'); s.burst(kt.overPoint(), 0.7);
      await sleep(450);
      if (r !== run) return;
    }
    eqOn = true; sfx.twinkle(); s.nod();
    stepDone = true;
  }
  function nextStep() {
    sfx.click();
    if (i < L.steps.length - 1) playStep(i + 1); else teach();
  }
  function showMe() { sfx.click(); stuck = false; kit?.finish(); }

  async function teach() {
    const s = sc, kt = kit; if (!s || !kt) return;
    const r = ++run;
    phase = 'teach'; tsub = 'watch'; wrongOn = false; eqOn = false; bubble = null; task = { kind: 'watch' };
    kt.clearPins(); kt.set(L.teach.q.at);
    s.shot('wide');
    await speak('ep.teach');
    if (r !== run) return;
    s.shot('buddy');
    // the buddy works it out loud (and gets it wrong)
    s.present(2.4);
    await buddySay(`${L.id}.try`, buddyWords(`${L.id}.try`, L.teach.says));
    if (r !== run) return;
    wrongOn = true; s.cheer(); sfx.pop();
    await sleep(1300);
    if (r !== run) return;
    tsub = 'fix'; s.shot('wide'); s.palDo('act'); s.think(2.4);
    await speak('ep.fix');
  }
  function pickFix(n: string) {
    if (tsub !== 'fix' || !sc) return;
    if (n === right) {
      const r = ++run;
      tsub = 'fixed'; sfx.cheer();
      sc.gasp(); setTimeout(() => { if (!gone) sc?.oops(); }, 900); sc.palDo('happy'); sc.burst(kit!.overPoint(), 1.2);
      // the buddy sees its mistake and thanks you, then the coach praises you
      void (async () => {
        await buddySay(`${L.id}.fixed`, buddyWords(`${L.id}.fixed`, L.teach.fixed));
        if (r !== run || gone) return;
        sc?.jump();
        await speak('ep.fixed');
      })();
    } else {
      shake++; sfx.miss(); sc.shrug(); void speak('ep.again');
    }
  }

  function setupQ(x: MQ) {
    const kt = kit!; kt.clearPins(); kt.set(x.at);
    kt.free = x.input === 'clock' ? 'clock' : x.input === 'pour' ? 'pour' : null;
    kt.freeSnap = x.input === 'clock' && parseTime(x.ans) % 5 ? 1 : 5;
  }
  function startTurn(n: number) {
    const s = sc; if (!s || !kit) return;
    ++run;
    phase = 'turn'; k = n; typed = ''; misses = 0; locked = false; bubble = null; eqOn = false; task = { kind: 'watch' };
    setupQ(L.tries[n]);
    s.shot('wide');
    void speak(n === 0 ? 'ep.turn' : 'ep.turn2');
  }
  async function startCheck() {
    const s = sc; if (!s || !kit) return;
    ++run;
    phase = 'check'; typed = ''; misses = 0; locked = false;
    setupQ(L.tries[2]);
    s.shot('wide'); s.wave(); s.palDo('happy');
    await speak('ep.check');
  }
  function digit(d: string) {
    if ((phase !== 'turn' && phase !== 'check') || locked || q.input !== 'num') return;
    if (typed.length >= q.ans.length) typed = '';
    typed += d;
    sfx.click();
    if (typed.length === q.ans.length) answer(typed);
  }
  function backspace() { if ((phase === 'turn' || phase === 'check') && !locked) typed = typed.slice(0, -1); }
  /** the clock or the jug: what the kid has made, as the answer's words */
  function done() {
    if (!kit || locked) return;
    if (q.input === 'clock') { const t = kit.clockNow; answer(t === parseTime(q.ans) ? q.ans : `${Math.floor(t / 60) || 12}:${String(t % 60).padStart(2, '0')}`); }
    else if (q.input === 'pour') answer(String(kit.jugNow));
  }
  function answer(given: string) {
    const s = sc;
    if (given === q.ans) {
      locked = true; typed = given;
      // (the buddy's cheer is said in full before the next question)
      const cheered = buddySay(`praise${(k + misses) % 5}`);
      sfx.star(k); mSfx.chime(); s?.cheer(); s?.palDo('happy'); s?.burst(kit!.overPoint(), 0.8);
      if (kit) kit.free = null;
      void Promise.all([cheered, sleep(1300)]).then(() => {
        if (gone) return;
        locked = false; typed = '';
        if (phase === 'check') checked();
        else if (k < 1) startTurn(k + 1);
        else card();
      });
    } else {
      misses++; shake++; sfx.miss(); s?.shrug();
      void buddySay(misses === 1 ? 'miss' : 'show', misses === 1 ? `Not quite. ${q.hidden}` : `Here's how: ${q.hint}`);
      setTimeout(() => { if (!locked) typed = ''; }, 500);
    }
  }
  function card() {
    const s = sc; if (!s || !kit) return;
    const r = ++run;
    phase = 'card'; bubble = null; eqOn = false;
    let res = { first: false, shells: 0, eggs: 0 };
    game.update(pp => { const x = finishLesson(pp, L.id); res = { first: x.first, shells: x.shells, eggs: x.eggsReady.length }; });
    result = res;
    kit.clearPins(); kit.set({}); s.show(CLEAR);
    s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party(); s.palDo('happy');
    sfx.complete(); mSfx.cuckoo(); burst++;
    void (async () => {
      await speak(`ep.${L.id}.card`);
      if (r !== run || !res.first) return;
      await sleep(300);
      if (r === run) await speak('ep.tomorrow');
    })();
  }
  function checked() {
    const s = sc; if (!s || !kit) return;
    ++run;
    phase = 'checked'; bubble = null;
    game.update(pp => markChecked(pp, L.id));
    kit.clearPins(); kit.set({});
    s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party();
    sfx.complete(); burst++;
    void speak('ep.checked');
  }
  function leave() { sfx.click(); onclose(); }

  function primary() {
    if (phase === 'intro') { ++run; playStep(0); }
    else if (phase === 'step' && stepDone) nextStep();
    else if (phase === 'teach' && tsub === 'fixed') { sfx.click(); startTurn(0); }
    else if ((phase === 'turn' || phase === 'check') && (q.input === 'clock' || q.input === 'pour')) done();
    else if (phase === 'card' || phase === 'checked') leave();
  }
  function onKey(e: KeyboardEvent) {
    if (game.sheet || game.settingsOpen) return;
    const mine = (fn: () => void) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if ((phase === 'turn' || phase === 'check') && q.input === 'num') {
      if (/^[0-9]$/.test(e.key)) return mine(() => digit(e.key));
      if (e.key === 'Backspace') return mine(backspace);
    }
    // choices are tapped (no 1, 2, 3 keys: they'd be confused with the answers)
    if (e.key === 'Enter' || e.key === ' ') return mine(primary);
    if (e.key === 'Escape') return mine(leave);
  }

  // ---------- the kid's hands: the measuring things first, then the table ----------
  function down(e: PointerEvent) {
    const used = kit?.pointer('down', e.clientX, e.clientY);
    if (!used) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) { if (kit?.pointer('move', e.clientX, e.clientY)) e.preventDefault(); }
  function up(e: PointerEvent) { kit?.pointer('up', e.clientX, e.clientY); }

  function pin(node: HTMLElement, at: () => Vector3 | null) {
    sc?.pin(node, at);
    return { update(n: () => Vector3 | null) { sc?.pin(node, n); }, destroy() { sc?.unpin(node); } };
  }

  // ---------- where the 3D picture goes on the page ----------
  function viewFor(): View {
    const H = h || 1;
    // (the speech band sits under the top bar: the 3D work is framed below it)
    const top = (narrow ? 58 + DOCK_H.narrow : 72 + DOCK_H.wide) / H;
    let bottom = 1 - (narrow ? 116 : 104) / H, right = 0.99;
    if (phase === 'turn' || phase === 'check') bottom = 1 - (q.input === 'num' ? (narrow ? 352 : 228) : (narrow ? 170 : 150)) / H;
    else if (phase === 'teach' && tsub !== 'watch') bottom = 1 - (narrow ? 196 : 150) / H;
    else if (phase === 'card' || phase === 'checked') { if (narrow) bottom = 0.5; else right = 0.5; }
    if (narrow && bottomH && phase !== 'card' && phase !== 'checked') bottom = Math.min(bottom, 1 - (bottomH + 14) / H);
    return { top, bottom, left: 0.01, right };
  }
  $effect(() => { void phase; void tsub; void w; void h; void narrow; void k; void bottomH; sc?.setView(viewFor()); });

  let unquiet = () => {};
  onMount(() => {
    unquiet = quietForLesson();
    addEventListener('keydown', onKey, true);
    const own = advView(game.profile!).glimmers[L.star];
    void EpisodeScene.create({ setId: 'clockshop', buddy, star: L.star, evolved: !!own?.evolved }).then(async s => {
      if (gone) { s.dispose(); return; }
      const kt = new MeasureKit(s);
      await kt.load();
      if (gone) { s.dispose(); return; }
      ctl = { fps: 60, update: (dt, t) => { s.update(dt, t); kt.update(dt, t); }, focus: () => s.focus(), dispose: () => {} };
      before = stage.swap(ctl); s.enter();
      if (import.meta.env.DEV) (window as unknown as { __mep: { sc: EpisodeScene; kit: MeasureKit } }).__mep = { sc: s, kit: kt };
      // for checking the episodes: where the story is, its own Enter, the fix and the answer
      if (import.meta.env.DEV) (window as unknown as { __epUi: object }).__epUi = { phase: () => phase, sub: () => tsub, done: () => stepDone, step: () => i, primary, fix: () => pickFix(right), solve: () => { if (!locked) answer(q.ans); }, finish: () => kit?.finish() };
      s.show(CLEAR, true); s.fit(kt.bounds()); kt.refit();
      kt.onChange = () => { left = kt.left; pinsNow = kt.pins.map(p => ({ id: p.id, text: p.text, kind: p.kind })); };
      s.setView(viewFor());
      sc = s; kit = kt;
      await tick();
      if (check) startCheck(); else intro();
    }).catch(e => console.error(e));
  });
  onDestroy(() => {
    gone = true; run++;
    hush(); unquiet();
    removeEventListener('keydown', onKey, true);
    if (sc) { const s = sc; sc = null; kit?.dispose(); kit = null; if (stage.current() === ctl) stage.swap(before); s.dispose(); }
  });
  const pinAt = (id: string) => () => kit?.pins.find(p => p.id === id)?.at() ?? null;
</script>

<!-- the buddy's answer to the teach question: over the work on a wide screen, in the bottom panel on a phone -->
{#snippet wrongEq()}<div class="eq wrong isq" class:docked={narrow} class:fixed={tsub === 'fixed'} class:shake={shake > 0 && tsub === 'fix'}><small class="qt">{L.teach.q.text}</small><span class="ans">{#if tsub === 'fixed'}<span class="lit">{right}</span>{:else}<s>{L.teach.wrong}</s>?{/if}</span></div>{/snippet}

<svelte:window bind:innerWidth={w} bind:innerHeight={h} />
<div class="ep" class:narrow style:--sc="#8a6bd6" style:--bg="url({base}{place.backdrop})">
  <div class="hit" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation"></div>
  <div class="vignette"></div>

  {#if phase === 'load'}
    <div class="loading"><div class="lcard"><small>{place.name}</small><b>{L.title}</b><span class="dots3"><i></i><i></i><i></i></span></div></div>
  {/if}

  {#if sc && kit}
    {#each pinsNow as p (p.id)}
      <div class="pin" use:pin={pinAt(p.id)}><span class="gold">{p.text}</span></div>
    {/each}
    {#if phase === 'step' && left > 0 && !stepDone && task.kind !== 'watch'}
      <div class="pin" use:pin={() => kit!.tryPoint()}><span class="try">Try it</span></div>
      <div class="pin" use:pin={() => kit!.handPoint()}><span class="hand"><i></i></span></div>
    {/if}
    {#if (phase === 'turn' || phase === 'check') && (q.input === 'clock' || q.input === 'pour') && !locked}
      <div class="pin" use:pin={() => kit!.tryPoint()}><span class="try">{q.input === 'clock' ? 'Drag the hands' : 'Drag the water'}</span></div>
    {/if}
    {#if eqOn && phase === 'step'}
      {#key i}<div class="pin" use:pin={() => kit!.overPoint()}><div class="eq">{#each eqParts as p}{#if p.lit}<span class="lit">{p.t}</span>{:else}<span>{p.t}</span>{/if}{/each}</div></div>{/key}
    {/if}
    {#if phase === 'teach' && wrongOn && !narrow}
      {#key shake}<div class="pin" use:pin={() => kit!.overPoint()}>{@render wrongEq()}</div>{/key}
    {/if}
  {/if}

  <div class="top">
    <CloseButton onclick={leave} label="Close the lesson" size={narrow ? 40 : 46} />
    {#if check}
      <div class="prog checkhead"><Icon name="bulb" size={22} /> Quick check: {L.title}</div>
    {:else}
      <div class="prog" aria-label="Part {Math.max(1, at + 1)} of {total}">
        {#each Array(total) as _, n}<img src="{base}{n >= L.steps.length ? 'learn/marble-c' : 'game/icon-star'}.webp" alt="" class:on={n < at} class:now={n === at} />{/each}
      </div>
    {/if}
    <div class="chip"><img src="{base}learn/tile.webp" alt="" /><span><small>{place.name}</small><b>{L.title}</b></span></div>
  </div>
  <!-- the words being said, in one place that never moves: the story's, or the buddy's own -->
  {#if phase !== 'load'}
    <SpeechDock text={who === 'buddy' && bubble ? bubble : line} buddy={who === 'buddy' && bubble ? buddy : null} {narrow}
      mood={who === 'buddy' && bubble && (phase === 'turn' || phase === 'check') ? (locked ? 'good' : misses > 0 ? 'oops' : null) : null} />
  {/if}

  <div class="bottom" bind:clientHeight={bottomH}>
    {#if phase === 'intro'}
      <div class="row"><span class="pill">{pal.name} and {FRIEND[buddy].name} need your help!</span><button class="btn btn-primary btn-big go" onclick={primary}>Let's go! <span class="kbd">enter</span></button></div>
    {:else if phase === 'step'}
      <div class="row">
        {#if !stepDone && task.kind !== 'watch'}
          <span class="pill task">{TASK_WORDS[task.kind]}</span>
          {#if stuck}<button class="btn ghostbtn" onclick={showMe}>Show me</button>{/if}
        {:else if stepDone}
          <span class="pill">{i < L.steps.length - 1 ? 'See the trick?' : "That's the trick!"}</span>
          <button class="btn btn-primary btn-big go" onclick={nextStep}>{i < L.steps.length - 1 ? 'Next' : "Your buddy's turn"} <span class="kbd">enter</span></button>
        {:else}
          <span class="pill">Watch and listen...</span>
        {/if}
      </div>
    {:else if phase === 'teach'}
      <div class="tcol">
      {#if narrow && wrongOn}<div class="dock">{#key shake}{@render wrongEq()}{/key}</div>{/if}
      {#if tsub === 'fix'}
        <div class="fix">
          <span class="pill task">Tap the right answer</span>
          <div class="choices">{#each choices as c}<button class="choice" onclick={() => pickFix(c)}>{c}</button>{/each}</div>
        </div>
      {:else if tsub === 'fixed'}
        <div class="row"><span class="pill">You fixed it!</span><button class="btn btn-primary btn-big go" onclick={primary}>My turn! <span class="kbd">enter</span></button></div>
      {:else}
        <div class="row"><span class="pill">Is your buddy right?</span></div>
      {/if}
      </div>
    {:else if phase === 'turn' || phase === 'check'}
      <div class="turn">
        {#key shake}<div class="ask" class:shake={shake > 0}>{#if phase === 'turn'}<small>Your turn {k + 1} of 2</small>{:else}<small>Quick check</small>{/if}<span class="qtx">{q.text}</span>{#if q.input === 'num'}<span class="box" class:good={locked}>{typed || ' '}</span>{/if}</div>{/key}
        {#if q.input === 'num'}
          <NumPad ondigit={digit} onback={backspace} compact={narrow} lit={null} />
        {:else if q.input === 'choice'}
          <div class="choices">{#each qChoices as c}<button class="choice" class:good={locked && c === q.ans} onclick={() => answer(c)}>{c}</button>{/each}</div>
        {:else}
          <button class="btn btn-primary btn-big go" disabled={locked} onclick={done}><Icon name="check" size={26} /> Done <span class="kbd">enter</span></button>
        {/if}
      </div>
    {/if}
  </div>

  {#if phase === 'card' || phase === 'checked'}
    <div class="cardside">
      <div class="card" style:--frame="url({base}learn/ep/card-frame.webp)">
        <div class="cin">
          <small>{phase === 'checked' ? 'Remembered!' : 'Trick card'}</small>
          <h2>{L.title}</h2>
          <div class="cpic"><img class="cart" class:contain={CARD_ART[L.id]?.endsWith('tile.webp')} src="{base}{CARD_ART[L.id] ?? 'math/measure/learn.webp'}" alt="" /></div>
          <p>{cardWords}</p>
        </div>
      </div>
      {#if phase === 'card'}
        <div class="prizes">
          {#if result?.shells}<span class="prize"><img src="{base}game/icon-shell.webp" alt="" /><b>+{result.shells}</b><small>shells</small></span>{/if}
          <span class="prize"><Icon name="bulb" size={34} /><b>Trick</b><small>for battles</small></span>
          <span class="prize"><img src="{base}game/egg-common.webp" alt="" /><b>{result?.eggs ? 'Ready!' : 'Grew'}</b><small>eggs</small></span>
          {#if result?.first}<span class="prize"><Icon name="clock" size={34} /><b>Tomorrow</b><small>quick check</small></span>{/if}
        </div>
      {/if}
      <div class="cbtns"><button class="btn btn-primary btn-big" onclick={leave}>More tricks <span class="kbd">enter</span></button></div>
    </div>
  {/if}
  <Confetti {burst} x={narrow ? 50 : 30} y={40} />
</div>


<style>
  .ep { position: fixed; inset: 0; z-index: 35; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .hit { position: absolute; inset: 0; touch-action: none; }
  /* a soft vignette, like a film frame */
  .vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0, 0, 0, 0) 60%, rgba(60, 30, 10, .28) 100%); }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--bg) center / cover; }
  .loading::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(6px); background: rgba(255, 240, 220, .2); }
  .lcard { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; background: rgba(255, 255, 255, .94); border-radius: 26px; padding: 18px 30px; box-shadow: var(--shadow); }
  .lcard small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--sc); }
  .lcard b { font: 600 28px var(--font-ui); color: var(--ink); }
  .dots3 { display: flex; gap: 6px; margin-top: 6px; }
  .dots3 i { width: 9px; height: 9px; border-radius: 50%; background: #ffc93a; animation: bob 1s ease-in-out infinite; }
  .dots3 i:nth-child(2) { animation-delay: .15s; } .dots3 i:nth-child(3) { animation-delay: .3s; }
  @keyframes bob { 50% { transform: translateY(-6px); } }

  /* pinned words: the scene moves .pin to the 3D point; the child sits above it */
  .pin { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 2; }
  .pin > * { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); white-space: nowrap; }
  .try { transform: translate(-50%, -100%); font: 700 16px var(--font-body); color: #4a3200; background: #fff3c4; padding: 6px 14px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd75e, 0 6px 14px rgba(120, 70, 0, .3); animation: tryb 1.4s ease-in-out infinite; }
  .try::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -7px; border: 7px solid transparent; border-top-color: #fff3c4; border-bottom: 0; }
  @keyframes tryb { 50% { transform: translate(-50%, calc(-100% - 5px)); } }
  /* the helping hand: a fingertip pressing and dragging */
  .hand { transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%; border: 4px solid rgba(255, 255, 255, .95); box-shadow: 0 0 0 3px rgba(255, 196, 60, .8), 0 4px 14px rgba(0, 0, 0, .3); display: grid; place-items: center; animation: press 2.2s ease-in-out infinite; }
  .hand i { width: 16px; height: 16px; border-radius: 50%; background: #fff; }
  @keyframes press { 0%, 100% { opacity: 0; scale: 1.3; } 10%, 80% { opacity: 1; scale: .85; } 90% { opacity: 0; } }
  .eq { font: 600 clamp(30px, 4.4vh, 46px)/1.15 var(--font-ui); color: #3a2400; background: linear-gradient(#fffaf0, #fff0c8); padding: 6px 22px; border-radius: 22px; box-shadow: 0 0 0 4px #ffd75e, 0 0 34px rgba(255, 200, 60, .85), 0 12px 24px rgba(90, 50, 0, .35); animation: eqin .5s cubic-bezier(.3, 1.5, .5, 1) both; white-space: pre; width: max-content; }
  .eq :global(.ft > span) { white-space: pre; }
  .eq .lit { display: inline-block; background: #ffc93a; color: #4a2f00; padding: 0 12px; border-radius: 12px; box-shadow: 0 4px 0 #e0a51c; margin: 0 2px; }
  .eq.wrong { box-shadow: 0 0 0 4px #ffb3c8, 0 12px 24px rgba(90, 20, 40, .3); }
  .eq.wrong s { color: #d63c5c; text-decoration-thickness: 4px; }
  /* a question (not a sum): the question small on top, the buddy's answer under it */
  .eq.isq { display: flex; flex-direction: column; align-items: center; padding-top: 4px; }
  .eq .qt { font: 600 18px/1.2 var(--font-ui); color: #7a6440; }
  .eq .ans { display: inline-flex; align-items: center; gap: 6px; }
  /* a fraction can't take a line through its text: a slash across it instead */
  .eq.wrong s:has(:global(.frac)) { position: relative; text-decoration: none; }
  .eq.wrong s:has(:global(.frac))::after { content: ''; position: absolute; left: -6px; right: -6px; top: 50%; height: 4px; margin-top: -2px; background: #d63c5c; border-radius: 2px; transform: rotate(-20deg); }
  /* (on a phone: in the bottom panel, over the choices) */
  .tcol { display: flex; flex-direction: column; align-items: center; }
  .dock { display: flex; justify-content: center; margin-bottom: 10px; }
  .eq.docked { position: static; transform: none; animation: eqpop .4s cubic-bezier(.3, 1.5, .5, 1) both; }
  @keyframes eqpop { from { opacity: 0; scale: .6; } }
  .eq.fixed { box-shadow: 0 0 0 4px #7fe0b0, 0 0 34px rgba(80, 220, 150, .7), 0 12px 24px rgba(0, 60, 30, .3); }
  @keyframes eqin { from { opacity: 0; transform: translate(-50%, -60%) scale(.6); } }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 12px 18px; z-index: 3; pointer-events: none; }
  .top > :global(*) { pointer-events: auto; }
  .prog { flex: 1; display: flex; justify-content: center; gap: 8px; background: rgba(255, 255, 255, .88); border-radius: 999px; padding: 8px 16px; max-width: 520px; margin: 0 auto; box-shadow: 0 6px 18px -8px rgba(60, 30, 10, .45); }
  .checkhead { flex: 0 1 auto; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: #8a5a00; }
  .prog img { width: 24px; height: 24px; object-fit: contain; filter: grayscale(1) opacity(.35); transition: filter .3s, transform .3s; }
  .prog img.on { filter: none; }
  .prog img.now { filter: drop-shadow(0 0 6px #ffd36b); transform: scale(1.3); }
  .chip { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .88); border-radius: 18px; padding: 4px 14px 4px 4px; box-shadow: 0 6px 18px -8px rgba(60, 30, 10, .45); }
  .chip img { width: 34px; height: 40px; object-fit: contain; }
  .chip small { display: block; font: 800 10px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .chip b { font: 600 17px/1.1 var(--font-ui); color: var(--ink); }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 18px 18px; z-index: 3; display: flex; justify-content: center; pointer-events: none; }
  .bottom > :global(*) { pointer-events: auto; }
  .row { display: flex; align-items: center; gap: 14px; justify-content: center; flex-wrap: wrap; }
  .pill { font: 700 18px var(--font-body); color: #fff; background: rgba(60, 36, 20, .72); backdrop-filter: blur(6px); padding: 12px 26px; border-radius: 999px; box-shadow: 0 8px 20px -8px rgba(0, 0, 0, .5); }
  .pill.task { background: rgba(70, 40, 10, .8); box-shadow: 0 0 0 3px rgba(255, 210, 90, .7), 0 8px 20px -8px rgba(0, 0, 0, .5); }
  .go { display: inline-flex; align-items: center; gap: 8px; animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.04); } }
  .ghostbtn { background: rgba(255, 255, 255, .9); }
  .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 11px; height: 22px; }
  .fix { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .choices { display: flex; gap: 14px; }
  .choice { position: relative; min-width: 110px; height: 84px; border: 0; border-radius: 24px; cursor: pointer; font: 600 40px var(--font-ui); color: var(--ink); background: linear-gradient(#fff, #fff4dc); box-shadow: 0 0 0 4px #ffd75e, 0 7px 0 #e0a51c, 0 14px 24px -8px rgba(90, 50, 0, .5); transition: transform .1s; }
  .choice:hover { transform: translateY(-3px); }
  .choice:active { transform: translateY(3px); }
  .turn { display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(1000px, 100%); }
  .ask { display: flex; align-items: center; gap: 12px; font: 600 clamp(32px, 5vh, 48px)/1.1 var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .95); padding: 8px 22px; border-radius: 24px; box-shadow: 0 12px 28px -12px rgba(60, 30, 10, .6); }
  .ask small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); max-width: 70px; line-height: 1.2; }
  .box { min-width: 1.6em; padding: 0 12px; border-radius: 16px; background: #f4f0fb; box-shadow: inset 0 0 0 3px #d9cff0; text-align: center; }
  .box.good { background: #d9f7e8; box-shadow: inset 0 0 0 3px #4fcf9f; }
  .shake { animation: shake .35s; }
  @keyframes shake { 20%, 60% { translate: -8px 0; } 40%, 80% { translate: 8px 0; } }

  .cardside { position: absolute; z-index: 4; right: 4%; top: 50%; translate: 0 -50%; width: min(430px, 44vw); display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .card { position: relative; width: min(320px, 100%); aspect-ratio: 512 / 700; background: var(--frame) center / 100% 100% no-repeat; filter: drop-shadow(0 18px 30px rgba(90, 50, 0, .45)); animation: flip .9s cubic-bezier(.3, 1.3, .5, 1) both; display: flex; }
  /* the parchment inside the golden frame */
  .card::before { content: ''; position: absolute; inset: 13% 11% 9%; border-radius: 10px; background: radial-gradient(ellipse at 50% 40%, #fffaf0, #f8e7c4 75%, #efd29c); box-shadow: inset 0 0 18px rgba(170, 110, 20, .35); z-index: -1; }
  @keyframes flip { from { transform: perspective(900px) rotateY(180deg) scale(.4); opacity: 0; } 60% { opacity: 1; } }
  .cin { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 26% 15% 16%; text-align: center; }
  .cin small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #a8700a; }
  .cin h2 { margin: 0; font: 600 clamp(22px, 2.6vw, 30px)/1.05 var(--font-ui); color: #4a2f00; }
  .cpic { position: relative; width: 100%; aspect-ratio: 1.6; }
  .cpic :global(.lb) { position: absolute; inset: 0; }
  .cart { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
  .cart.contain { object-fit: contain; filter: drop-shadow(0 6px 8px rgba(90, 50, 0, .3)); }
  .cin p { margin: 0; font: 600 14px/1.3 var(--font-body); color: #6b4a14; }
  .prizes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 86px; height: 88px; gap: 1px; border-radius: 20px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); color: #b07a10; }
  .prize img { width: 36px; height: 36px; object-fit: contain; }
  .prize b { font: 600 17px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 11px var(--font-body); color: var(--muted); }
  .cbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }

  /* phones: smaller words, the card over the bottom half */
  .narrow .top { padding: 8px 10px; gap: 8px; }
  .narrow .chip { display: none; }
  .narrow .prog { gap: 4px; padding: 6px 10px; }
  .narrow .prog img { width: 16px; height: 16px; }
  .narrow .bottom { padding: 0 10px 12px; }
  .narrow .pill { font-size: 15px; padding: 10px 16px; text-align: center; white-space: normal; }
  .narrow .go { font-size: 18px; padding: 12px 20px; }
  .narrow .kbd { display: none; }
  .narrow .choice { min-width: 92px; height: 70px; font-size: 32px; }
  .narrow .choices { gap: 10px; }
  .narrow .ask { font-size: 32px; padding: 6px 16px; }
  .narrow .eq { font-size: 26px; padding: 4px 14px; }
  .narrow .eq .qt { font-size: 14px; }
  .narrow .cardside { left: 0; right: 0; top: auto; bottom: 10px; translate: none; width: 100%; padding: 0 12px; gap: 8px; }
  .narrow .card { width: min(190px, 48vw); }
  .narrow .cin { gap: 2px; }
  .narrow .cin h2 { font-size: 17px; }
  .narrow .cin p { font-size: 11px; }
  .narrow .prize { width: 70px; height: 70px; } .narrow .prize img { width: 28px; height: 28px; } .narrow .prize b { font-size: 14px; }
  .narrow .cbtns .btn-big { font-size: 17px; padding: 12px 18px; }
  /* measuring: words pinned on the clock, the ruler, the fence (gold, like the trick) */
  .gold { font: 600 26px var(--font-ui); color: #4a2f00; background: linear-gradient(#fffaf0, #ffe9a8); padding: 2px 12px; border-radius: 14px; box-shadow: 0 0 0 3px #ffd75e, 0 6px 14px rgba(120, 70, 0, .3); animation: eqin .4s cubic-bezier(.3, 1.5, .5, 1) both; }
  .narrow .gold { font-size: 18px; padding: 1px 8px; }
  .qtx { font-size: .62em; max-width: 560px; white-space: normal; line-height: 1.15; }
  .choice.good { box-shadow: 0 0 0 4px #7fe0b0, 0 7px 0 #3fbf7a; }
  .turn .choices { flex-wrap: wrap; justify-content: center; }
  .narrow .qtx { font-size: .5em; }
</style>
