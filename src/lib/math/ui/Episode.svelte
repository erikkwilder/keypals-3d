<script lang="ts">
  // A Learn episode (math/episodes.ts): one trick as a little story in a real 3D place. The coach tells
  // it (voice and words at the top); your buddy and the place's Glimmer are there at the table. Each step
  // of the lesson is something your hands do: drag the glowing counters into the glowing places, tap
  // them away, tap the next number to hop. Then the shortcut appears over what you just did. Then your
  // buddy has a go and gets it wrong: you spot it and fix it. Two of your own, and the trick's card is
  // yours (it powers the Trick button in battles); the next day it comes back for a quick check
  // (`check`: just that one question). Over a math trip (`embedded`) it borrows the 3D stage the same way.
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Vector3 } from 'three';
  import { stage, type Controller } from '../../three/stage';
  import { EpisodeScene, type View } from '../../three/episodeScene';
  import { game } from '../../state/game.svelte';
  import { sfx } from '../../audio/sound';
  import { hush, lineText, say } from '../../audio/voice.svelte';
  import { danceOf } from '../../engine/profile';
  import { advView, teamOf } from '../../adventure/state';
  import { FRIEND } from '../../art/cast';
  import { GLIMMER } from '../../adventure/glimmers';
  import { boundsOf, finishLesson, markChecked, type Board } from '../learn';
  import { SETS, epLesson, taskFor, taskWords, type EpQ, type Task } from '../episodes';
  import { fracRight } from '../fracEpisodes';
  import LearnBoard from './LearnBoard.svelte';
  import NumPad from './NumPad.svelte';
  import FracText from './FracText.svelte';
  import Frac from '../skills/ui/Frac.svelte';
  import FractionPad from '../skills/ui/FractionPad.svelte';
  import CloseButton from '../../ui/CloseButton.svelte';
  import Confetti from '../../ui/Confetti.svelte';
  import Icon from '../../ui/Icon.svelte';

  type Props = { id: string; embedded?: boolean; check?: boolean; onclose: () => void; onpractice?: () => void; onwatch?: () => void };
  let { id, embedded = false, check = false, onclose, onpractice, onwatch }: Props = $props();

  const base = import.meta.env.BASE_URL;
  // (the episode is keyed by its lesson: these don't change while it's open)
  // svelte-ignore state_referenced_locally
  const lesson = epLesson(id)!, place = SETS[lesson.set];
  const buddy = game.profile!.buddy;
  // the Glimmer at the table: the player's own (the first on their team) when the story doesn't name the
  // place's one, else the place's
  const team = teamOf(advView(game.profile!));
  const placeStar = lesson.star ?? place.star;
  const named = lineText(`ep.${lesson.id}.intro`).includes(GLIMMER[placeStar].name);
  const starId = !named && team[0] ? team[0].id : placeStar;
  const pal = GLIMMER[starId];
  const cardWords = lineText(`ep.${lesson.id}.card`).replace(/^You won the .*? card! /, '');
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
  const CLEAR: Board = { cell: 48, dots: [], frames: [], plates: [], line: null, tags: [] };

  let sc = $state<EpisodeScene | null>(null);
  let before: Controller | null = null;
  let gone = false;
  /** every new part of the story bumps this; anything still waiting from an older part stops */
  let run = 0;

  type Phase = 'load' | 'intro' | 'step' | 'teach' | 'turn' | 'card' | 'check' | 'checked';
  let phase = $state<Phase>('load');
  let i = $state(0);
  let task = $state<Task>({ kind: 'watch' });
  let stepDone = $state(false);
  let eqOn = $state(false);
  /** the picture on the table now (its words are pinned over it) */
  let shown = $state<Board | null>(null);
  let hops = $state(0);
  let left = $state(0);
  let revealed = $state<Set<string>>(new Set());
  /** the coach's words now, and the buddy's */
  let line = $state('');
  let bubble = $state<string | null>(null);
  let tsub = $state<'watch' | 'fix' | 'fixed'>('watch');
  let wrongOn = $state(false);
  let k = $state(0);
  let typed = $state('');
  /** a fraction being typed: its top, its bottom, and which one the keys go to */
  let fn = $state(''), fd = $state(''), ff = $state<'n' | 'd'>('n');
  let misses = $state(0);
  let shake = $state(0);
  let locked = $state(false);
  let burst = $state(0);
  let stuck = $state(false);
  let result = $state<{ first: boolean; shells: number; eggs: number } | null>(null);
  let w = $state(1280), h = $state(800);
  const narrow = $derived(w < 760);

  const step = $derived(lesson.steps[Math.min(i, lesson.steps.length - 1)]);
  const q = $derived<EpQ>(check ? lesson.tries[2] : lesson.tries[Math.min(k, 1)]);
  const ans = $derived(q.ans);
  /** a question to work out ("What fraction is on the plate?") or a sum ("6 + 3"), and its answer after it */
  const asks = (x: EpQ) => /\?$/.test(x.text);
  const total = lesson.steps.length + 4;
  const at = $derived(phase === 'intro' || phase === 'load' ? -1 : phase === 'step' ? i : phase === 'teach' ? lesson.steps.length : phase === 'turn' ? lesson.steps.length + 1 + k : total - 1);
  /** "8 + 5 = [13]": the part in brackets lit up */
  const eqParts = $derived(step.eq.split(/(\[[^\]]+\])/).filter(Boolean).map(s => (s.startsWith('[') ? { lit: true, t: s.slice(1, -1) } : { lit: false, t: s })));
  const choices = lesson.teach.choices;
  const right = lesson.teach.q.ans;
  const PRAISE = ['Yes! You got it!', 'That\'s it!', 'Brilliant!', 'You did it!', 'Spot on!'];

  // ---------- the voice ----------
  /** The coach says a line (its words stay up); resolves when it's said. (A line cut off by another
   *  never says it ended, so it also gives up after the time it could possibly take.) */
  async function speak(lineId: string) {
    line = lineText(lineId);
    const t0 = performance.now();
    await Promise.race([say(lineId, { important: true, caption: false }), sleep(2500 + line.length * 95)]);
    // voice off: the words stay up long enough to read before the story moves on
    if (game.settings.voice === false) await sleep(Math.max(0, Math.max(1600, line.length * 55) - (performance.now() - t0)));
  }

  // ---------- the story ----------
  async function intro() {
    const r = ++run;
    phase = 'intro';
    sc?.shot('intro'); sc?.wave(); sc?.palDo('happy');
    await speak(`ep.${id}.intro`);
    await sleep(600);
    if (r === run && phase === 'intro') playStep(0);
  }
  async function playStep(n: number) {
    const s = sc; if (!s) return;
    const r = ++run;
    phase = 'step'; i = n; stepDone = false; eqOn = false; stuck = false; bubble = null;
    const prev = n === 0 ? null : lesson.steps[n - 1].board, next = lesson.steps[n].board;
    const t: Task = lesson.steps[n].do === 'watch' ? { kind: 'watch' } : taskFor(prev, next);
    task = t;
    if (n === 0) s.fitBoards(lesson.steps.map(x => x.board));
    if (t.kind === 'watch') {
      s.shot('wide');
      s.show(next); shown = next;
      s.point(undefined, 2.2);
      await speak(`ep.${id}.s${n}`);
      if (r !== run) return;
    } else {
      s.shot('board');
      const late = setTimeout(() => { if (r === run) stuck = true; }, 12000);
      const done = s.arm(t, next);
      left = s.left;
      void speak(`ep.${id}.s${n}`);
      s.present();
      await done;
      clearTimeout(late); stuck = false;
      if (r !== run) return;
      s.show(next); shown = next;
      s.shot('wide');
      await sleep(450);
      if (r !== run) return;
    }
    // the shortcut, over what was just done
    eqOn = true; sfx.twinkle(); s.nod();
    stepDone = true;
  }
  function nextStep() {
    sfx.click();
    if (i < lesson.steps.length - 1) playStep(i + 1); else teach();
  }
  function showMe() { sfx.click(); stuck = false; sc?.finish(); }

  async function teach() {
    const s = sc; if (!s) return;
    const r = ++run;
    phase = 'teach'; tsub = 'watch'; wrongOn = false; eqOn = false; bubble = null; task = { kind: 'watch' };
    const pic = lesson.teach.q.pic;
    s.fitBoards([pic]); s.show(pic); shown = pic;
    s.shot('wide');
    await speak('ep.teach');
    if (r !== run) return;
    s.shot('buddy');
    bubble = lesson.teach.says; s.talk(2.6); s.present(2.4);
    await sleep(2400);
    if (r !== run) return;
    // proud of its answer (it's wrong)
    wrongOn = true; s.cheer(); sfx.pop();
    await sleep(1300);
    if (r !== run) return;
    tsub = 'fix'; s.shot('wide'); s.palDo('act'); s.think(2.4);
    await speak('ep.fix');
  }
  function pickFix(n: string) {
    if (tsub !== 'fix' || !sc) return;
    if (n === right) {
      ++run;
      tsub = 'fixed'; sfx.cheer();
      sc.gasp(); setTimeout(() => { if (!gone) sc?.oops(); }, 900); sc.palDo('happy'); sc.burst(sc.over(), 1.2);
      bubble = lesson.teach.fixed;
      setTimeout(() => { if (!gone) sc?.jump(); }, 2500);
      void speak('ep.fixed');
    } else {
      shake++; sfx.miss(); sc.shrug(); void speak('ep.again');
    }
  }

  function startTurn(n: number) {
    const s = sc; if (!s) return;
    ++run;
    phase = 'turn'; k = n; typed = ''; fn = ''; fd = ''; ff = 'n'; misses = 0; locked = false; bubble = null; eqOn = false; task = { kind: 'watch' };
    const pic = lesson.tries[n].pic;
    s.fitBoards([pic]); s.show(pic); shown = pic;
    s.shot('wide');
    void speak(n === 0 ? 'ep.turn' : 'ep.turn2');
  }
  async function startCheck() {
    const s = sc; if (!s) return;
    const r = ++run;
    phase = 'check'; typed = ''; fn = ''; fd = ''; ff = 'n'; misses = 0; locked = false;
    const pic = lesson.tries[2].pic;
    s.fitBoards([pic]); s.show(pic); shown = pic;
    s.shot('wide'); s.wave(); s.palDo('happy');
    await speak('ep.check');
    if (r !== run) return;
  }
  function digit(d: string) {
    if ((phase !== 'turn' && phase !== 'check') || locked) return;
    if (typed.length >= ans.length) typed = '';
    typed += d;
    sfx.click();
    if (typed.length === ans.length) answer();
  }
  function backspace() { if ((phase === 'turn' || phase === 'check') && !locked) typed = typed.slice(0, -1); }
  /** the fraction pad's Check */
  function answerFrac() { if ((phase === 'turn' || phase === 'check') && !locked && fn && fd) { typed = `${fn}/${fd}`; answer(); } }
  function answer() {
    const s = sc;
    if (q.input === 'frac' ? fracRight(q, typed) : typed === ans) {
      locked = true;
      bubble = PRAISE[(k + misses) % PRAISE.length];
      sfx.star(k); s?.cheer(); s?.palDo('happy'); s?.burst(s.over(), 0.8);
      setTimeout(() => {
        if (gone) return;
        locked = false; typed = ''; fn = ''; fd = ''; ff = 'n';
        if (phase === 'check') checked();
        else if (k < 1) startTurn(k + 1);
        else card();
      }, 1200);
    } else {
      misses++; shake++; sfx.miss(); s?.shrug();
      bubble = misses === 1 ? `Not quite. ${q.input === 'frac' ? '' : 'Try the trick: '}${q.hidden}` : `Here's how: ${q.hint} Type ${ans}.`;
      setTimeout(() => { if (!locked) { typed = ''; fn = ''; fd = ''; ff = 'n'; } }, 500);
    }
  }
  function card() {
    const s = sc; if (!s) return;
    const r = ++run;
    phase = 'card'; bubble = null; eqOn = false;
    let res = { first: false, shells: 0, eggs: 0 };
    game.update(pp => { const x = finishLesson(pp, id); res = { first: x.first, shells: x.shells, eggs: x.eggsReady.length }; });
    result = res;
    // the table clears (the card shows the picture), and the friends celebrate together
    s.show(CLEAR); shown = null;
    s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party(); s.palDo('happy');
    sfx.complete(); burst++;
    void (async () => {
      await speak(`ep.${id}.card`);
      if (r !== run || !res.first) return;
      await sleep(300);
      if (r === run) await speak('ep.tomorrow');
    })();
  }
  function checked() {
    const s = sc; if (!s) return;
    ++run;
    phase = 'checked'; bubble = null;
    game.update(pp => markChecked(pp, id));
    s.show(CLEAR); shown = null;
    s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party();
    sfx.complete(); burst++;
    void speak('ep.checked');
  }
  function leave() { sfx.click(); onclose(); }

  /** Enter does the obvious next thing. */
  function primary() {
    if (phase === 'intro') { ++run; playStep(0); }
    else if (phase === 'step' && stepDone) nextStep();
    else if (phase === 'teach' && tsub === 'fixed') { sfx.click(); startTurn(0); }
    else if (phase === 'card' || phase === 'checked') leave();
  }
  function onKey(e: KeyboardEvent) {
    if (game.sheet || game.settingsOpen) return;
    const mine = (fn: () => void) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if ((phase === 'turn' || phase === 'check') && q.input === 'frac') {
      // (the fraction pad takes the keys itself)
      if (/^[0-9/]$/.test(e.key) || ['Backspace', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    }
    if (phase === 'turn' || phase === 'check') {
      if (/^[0-9]$/.test(e.key)) return mine(() => digit(e.key));
      if (e.key === 'Backspace') return mine(backspace);
    }
    if (phase === 'teach' && tsub === 'fix' && /^[1-3]$/.test(e.key)) return mine(() => pickFix(choices[+e.key - 1]));
    if (e.key === 'Enter' || e.key === ' ') return mine(primary);
    if (e.key === 'Escape') return mine(leave);
  }

  // ---------- the kid's hands: pointer events go to the 3D table ----------
  function down(e: PointerEvent) {
    if (!sc?.pointer('down', e.clientX, e.clientY)) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) { if (sc?.pointer('move', e.clientX, e.clientY)) e.preventDefault(); }
  function up(e: PointerEvent) { sc?.pointer('up', e.clientX, e.clientY); }

  /** Pin a page element to a 3D point (the scene moves it every frame). */
  function pin(node: HTMLElement, at: () => Vector3 | null) {
    sc?.pin(node, at);
    return { update(n: () => Vector3 | null) { sc?.pin(node, n); }, destroy() { sc?.unpin(node); } };
  }

  // ---------- where the 3D picture goes on the page ----------
  function viewFor(): View {
    const H = h || 1;
    const top = (narrow ? 58 : 72) / H;
    let bottom = 1 - (narrow ? 116 : 104) / H, right = 0.99;
    if (phase === 'turn' || phase === 'check') bottom = 1 - (narrow ? 352 : 228) / H;
    else if (phase === 'teach' && tsub !== 'watch') bottom = 1 - (narrow ? 196 : 150) / H;
    else if (phase === 'card' || phase === 'checked') { if (narrow) bottom = 0.5; else right = 0.5; }
    return { top, bottom, left: 0.01, right };
  }
  $effect(() => { void phase; void tsub; void w; void h; void narrow; sc?.setView(viewFor()); });

  onMount(() => {
    addEventListener('keydown', onKey, true);
    const own = advView(game.profile!).glimmers[starId];
    void EpisodeScene.create({ setId: lesson.set, buddy, star: starId, evolved: !!own?.evolved, frac: !lesson.cover }).then(async s => {
      if (gone) { s.dispose(); return; }
      before = stage.swap(s); s.enter();
      if (import.meta.env.DEV) (window as unknown as { __ep: EpisodeScene }).__ep = s;
      s.onChange = () => { hops = s.hopsDrawn; left = s.left; revealed = new Set(s.revealed); };
      s.setView(viewFor());
      sc = s;
      await tick();
      if (check) startCheck(); else intro();
    }).catch(e => console.error(e));
  });
  onDestroy(() => {
    gone = true; run++;
    hush();
    removeEventListener('keydown', onKey, true);
    if (sc) { const s = sc; sc = null; if (stage.current() === s) stage.swap(before); s.dispose(); }
  });

  /** the words on the table: while a label task waits, only the ones tapped open so far */
  const tagsNow = $derived(!shown ? [] : phase === 'step' && task.kind === 'label' && !stepDone ? lesson.steps[i].board.tags.filter(t => (task.kind === 'label' && !task.ids.includes(t.id)) || revealed.has(t.id)) : shown.tags);
  const ticks = $derived(shown?.line ? Array.from({ length: shown.line.to - shown.line.from + 1 }, (_, n) => shown!.line!.from + n) : []);
  const every = $derived(shown?.line && shown.line.to - shown.line.from > 12 ? 5 : 1);
</script>

<svelte:window bind:innerWidth={w} bind:innerHeight={h} />
<div class="ep" class:narrow style:--sc={lesson.color} style:--bg="url({base}{place.backdrop})">
  <!-- the 3D place is the stage behind the page; this layer passes the kid's touches to it -->
  <div class="hit" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation"></div>
  <div class="vignette"></div>

  {#if phase === 'load'}
    <div class="loading"><div class="lcard"><small>{place.name}</small><b>{lesson.title}</b><span class="dots3"><i></i><i></i><i></i></span></div></div>
  {/if}

  <!-- words pinned to the 3D things -->
  {#if sc && shown}
    {#each tagsNow as t (t.id + t.text)}
      <div class="pin" use:pin={() => sc!.tagPoint(t)}><span class="tag t-{t.c ?? 'ink'}" style:--fs={t.size ?? 30}>{#if /\d\/\d/.test(t.text)}<FracText text={t.text} size={Math.round((t.size ?? 30) * 0.8)} inline />{:else}{t.text}{/if}</span></div>
    {/each}
    {#if shown.line}
      {#each ticks as n (n)}
        {#if every === 1 || n % every === 0 || n === shown.line.at}
          <div class="pin" use:pin={() => sc!.tickPoint(n)}><span class="num" class:here={n === shown.line.at && task.kind !== 'hop'}>{#if shown.line.den && n % shown.line.den !== 0}<Frac n={n} d={shown.line.den} size={22} />{:else}{shown.line.den ? n / shown.line.den : n}{/if}</span></div>
        {/if}
      {/each}
      {#each shown.line.hops as hp, n (n)}
        {#if n < hops && hp.label}<div class="pin" use:pin={() => sc!.hopPoint(n)}><span class="hlab" class:back={hp.b < hp.a}><FracText text={hp.label} size={20} /></span></div>{/if}
      {/each}
    {/if}
    {#if phase === 'step' && left > 0 && !stepDone}
      <div class="pin" use:pin={() => sc!.tryPoint()}><span class="try">Try it</span></div>
      <div class="pin" use:pin={() => sc!.handPoint()}><span class="hand"><i></i></span></div>
    {/if}
    {#if eqOn && phase === 'step'}
      {#key i}<div class="pin" use:pin={() => sc!.over()}><div class="eq">{#each eqParts as p}{#if p.lit}<span class="lit"><FracText text={p.t} size={34} /></span>{:else}<span><FracText text={p.t} size={30} /></span>{/if}{/each}</div></div>{/key}
    {/if}
    {#if phase === 'teach' && wrongOn}
      {#key shake}<div class="pin" use:pin={() => sc!.over()}><div class="eq wrong" class:isq={asks(lesson.teach.q)} class:fixed={tsub === 'fixed'} class:shake={shake > 0 && tsub === 'fix'}>{#if asks(lesson.teach.q)}<small class="qt"><FracText text={lesson.teach.q.text} size={18} /></small>{:else}<FracText text={lesson.teach.q.text} size={30} /> = {/if}<span class="ans">{#if tsub === 'fixed'}<span class="lit"><FracText text={right} size={34} /></span>{:else}<s><FracText text={lesson.teach.wrong} size={30} /></s>?{/if}</span></div></div>{/key}
    {/if}
    <!-- one speech bubble, by the buddy: its own words when it has some, else the story's -->
    {#if bubble || (line && phase !== 'load')}
      {#key bubble ?? line}<div class="pin" use:pin={() => sc!.bubbleAt()}><div class="say" class:story={!bubble} class:oops={!!bubble && misses > 0 && !locked && (phase === 'turn' || phase === 'check')} class:good={!!bubble && locked}>{#if bubble}<b>{FRIEND[buddy].name}</b>{/if}<FracText text={bubble ?? line} size={20} inline /></div></div>{/key}
    {/if}
  {/if}

  <!-- the top: close, progress, and the coach telling the story -->
  <div class="top">
    <CloseButton onclick={leave} label={embedded ? 'Back to my trip' : 'Close the lesson'} size={narrow ? 40 : 46} />
    {#if check}
      <div class="prog checkhead"><Icon name="bulb" size={22} /> Quick check: {lesson.title}</div>
    {:else}
      <div class="prog" aria-label="Part {Math.max(1, at + 1)} of {total}">
        {#each Array(total) as _, n}<img src="{base}{n >= lesson.steps.length ? 'learn/marble-c' : 'game/icon-star'}.webp" alt="" class:on={n < at} class:now={n === at} />{/each}
      </div>
    {/if}
    <div class="chip"><img src="{base}learn/tile.webp" alt="" /><span><small>{place.name}</small><b>{lesson.title}</b></span></div>
  </div>
  <!-- while the buddy says its own words, the story's words stay as a subtitle -->
  {#if bubble && line && phase !== 'load'}
    {#key line}<div class="subtitle"><p>{line}</p></div>{/key}
  {/if}

  <!-- the bottom: what to do now -->
  <div class="bottom">
    {#if phase === 'intro'}
      <div class="row"><span class="pill">{pal.name} and {FRIEND[buddy].name} need your help!</span><button class="btn btn-primary btn-big go" onclick={primary}>Let's go! <span class="kbd">enter</span></button></div>
    {:else if phase === 'step'}
      <div class="row">
        {#if !stepDone && task.kind !== 'watch'}
          <span class="pill task">{taskWords(task, lesson.set, lesson.noun)}</span>
          {#if stuck}<button class="btn ghostbtn" onclick={showMe}>Show me</button>{/if}
        {:else if stepDone}
          <span class="pill">{i < lesson.steps.length - 1 ? 'See the trick?' : 'That\'s the trick!'}</span>
          <button class="btn btn-primary btn-big go" onclick={nextStep}>{i < lesson.steps.length - 1 ? 'Next' : 'Your buddy\'s turn'} <span class="kbd">enter</span></button>
        {:else}
          <span class="pill">Watch and listen...</span>
        {/if}
      </div>
    {:else if phase === 'teach'}
      {#if tsub === 'fix'}
        <div class="fix">
          <span class="pill task">Tap the right answer</span>
          <div class="choices">{#each choices as c, n}<button class="choice" onclick={() => pickFix(c)}><span class="kbd">{n + 1}</span><FracText text={c} size={30} /></button>{/each}</div>
        </div>
      {:else if tsub === 'fixed'}
        <div class="row"><span class="pill">You fixed it!</span><button class="btn btn-primary btn-big go" onclick={primary}>My turn! <span class="kbd">enter</span></button></div>
      {:else}
        <div class="row"><span class="pill">Is your buddy right?</span></div>
      {/if}
    {:else if phase === 'turn' || phase === 'check'}
      <div class="turn">
        {#key shake}<div class="ask" class:shake={shake > 0}>{#if phase === 'turn'}<small>Your turn {k + 1} of 2</small>{:else}<small>Quick check</small>{/if}<span><FracText text={q.text} size={34} />{asks(q) ? '' : ' ='}</span>{#if q.input === 'frac'}<span class="fbox" class:good={locked}><Frac n={fn} d={fd} size={34} focus={locked ? null : ff} /></span>{:else}<span class="box" class:good={locked}>{typed || ' '}</span>{/if}</div>{/key}
        {#if q.input === 'frac'}
          <FractionPad n={fn} d={fd} focus={ff} disabled={locked} compact={narrow} onchange={(v) => { fn = v.n; fd = v.d; ff = v.focus; sfx.click(); }} onsubmit={answerFrac} />
        {:else}
          <NumPad ondigit={digit} onback={backspace} compact={narrow} lit={null} />
        {/if}
      </div>
    {/if}
  </div>

  <!-- the trick card -->
  {#if phase === 'card' || phase === 'checked'}
    <div class="cardside">
      <div class="card" style:--frame="url({base}learn/ep/card-frame.webp)">
        <div class="cin">
          <small>{phase === 'checked' ? 'Remembered!' : 'Trick card'}</small>
          <h2>{lesson.title}</h2>
          <div class="cpic">{#if lesson.art}<img class="cart" src="{base}{lesson.art}" alt="" />{:else if lesson.cover}<LearnBoard board={lesson.cover} {buddy} view={boundsOf([lesson.cover])} still />{/if}</div>
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
      <div class="cbtns">
        {#if embedded}
          <button class="btn btn-primary btn-big" onclick={leave}>Back to my trip <span class="kbd">enter</span></button>
        {:else}
          {#if onpractice && phase === 'card'}<button class="btn btn-big" onclick={() => { sfx.click(); onpractice?.(); }}>Practise it now</button>{/if}
          <button class="btn btn-primary btn-big" onclick={leave}>More tricks <span class="kbd">enter</span></button>
        {/if}
      </div>
    </div>
  {/if}
  {#if phase === 'check' && misses >= 2 && onwatch}
    <button class="btn rewatch" onclick={() => { sfx.click(); onwatch?.(); }}><Icon name="play" size={22} /> Watch it again</button>
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
  /* words on the table: their board size times the table's scale on screen (never too small to read) */
  .tag { font-size: max(15px, calc(var(--fs) * var(--u, .8) * 1px)); font-family: var(--font-ui); font-weight: 600; paint-order: stroke; -webkit-text-stroke: 0; text-shadow: 0 2px 0 #fff, 0 -2px 0 #fff, 2px 0 0 #fff, -2px 0 0 #fff, 0 3px 8px rgba(80, 40, 10, .35); }
  .t-a { color: #1f6fd1; } .t-b { color: #d63c7c; } .t-c { color: #c97f00; } .t-ink { color: #2a1f45; }
  .num { transform: translate(-50%, 0); font: 600 17px var(--font-ui); color: #5a3a14; text-shadow: 0 1px 0 #fff8e8, 0 0 6px rgba(255, 248, 230, .9); }
  .num.here { font-size: 24px; color: #5a3fd0; }
  .hlab { font: 600 17px var(--font-ui); color: #b8551a; background: #fff8e8; padding: 1px 9px; border-radius: 10px; box-shadow: 0 3px 8px rgba(80, 40, 10, .25); }
  .hlab.back { color: #5a3fd0; }
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
  .eq.fixed { box-shadow: 0 0 0 4px #7fe0b0, 0 0 34px rgba(80, 220, 150, .7), 0 12px 24px rgba(0, 60, 30, .3); }
  @keyframes eqin { from { opacity: 0; transform: translate(-50%, -60%) scale(.6); } }
  .say { transform: translate(18px, -60%); white-space: normal; width: max-content; max-width: min(400px, 34vw); background: #fff; border-radius: 26px; padding: 12px 20px 14px; font: 600 22px/1.3 var(--font-ui); text-align: center; color: var(--ink); box-shadow: 0 0 0 3px #fff, 0 12px 26px -10px rgba(40, 20, 80, .55); animation: bub .35s cubic-bezier(.3, 1.4, .5, 1) both; }
  .say b { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .say::before { content: ''; position: absolute; left: -12px; top: 50%; margin-top: -10px; border: 10px solid transparent; border-right-color: #fff; border-left: 0; }
  .say.oops { box-shadow: 0 0 0 4px #ffc2d6, 0 12px 26px -10px rgba(40, 20, 80, .55); }
  .say.good { box-shadow: 0 0 0 4px #9be7c4, 0 12px 26px -10px rgba(40, 20, 80, .55); }
  @keyframes bub { from { opacity: 0; scale: .9; } }

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
  .say.story b { display: none; }
  .subtitle { position: absolute; left: 50%; top: 66px; transform: translateX(-50%); z-index: 3; max-width: min(720px, 92vw); background: rgba(40, 24, 12, .62); backdrop-filter: blur(4px); border-radius: 14px; padding: 6px 16px; pointer-events: none; animation: bub .3s ease-out both; }
  .subtitle p { margin: 0; font: 600 16px/1.35 var(--font-ui); color: #fff; text-align: center; }

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
  .choice .kbd { position: absolute; left: 8px; top: 6px; background: #f4ecd8; color: #8a6a3a; border-color: #e6d6b0; }
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
  .fbox { display: inline-grid; place-items: center; padding: 4px 8px; border-radius: 16px; background: #fff; }
  .fbox.good { box-shadow: 0 0 0 4px #7ed8a2; }
  .cin p { margin: 0; font: 600 14px/1.3 var(--font-body); color: #6b4a14; }
  .prizes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 86px; height: 88px; gap: 1px; border-radius: 20px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); color: #b07a10; }
  .prize img { width: 36px; height: 36px; object-fit: contain; }
  .prize b { font: 600 17px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 11px var(--font-body); color: var(--muted); }
  .cbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .rewatch { position: absolute; right: 18px; bottom: 360px; z-index: 4; display: inline-flex; gap: 6px; align-items: center; }

  /* phones: smaller words, the card over the bottom half */
  .narrow .top { padding: 8px 10px; gap: 8px; }
  .narrow .chip { display: none; }
  .narrow .prog { gap: 4px; padding: 6px 10px; }
  .narrow .prog img { width: 16px; height: 16px; }
  .narrow .subtitle { top: 54px; }
  .narrow .subtitle p { font-size: 13px; }
  .narrow .bottom { padding: 0 10px 12px; }
  .narrow .pill { font-size: 15px; padding: 10px 16px; text-align: center; white-space: normal; }
  .narrow .go { font-size: 18px; padding: 12px 20px; }
  .narrow .kbd { display: none; }
  .narrow .choice { min-width: 92px; height: 70px; font-size: 32px; }
  .narrow .choices { gap: 10px; }
  .narrow .ask { font-size: 32px; padding: 6px 16px; }
  .narrow .say { font-size: 15px; max-width: 58vw; padding: 8px 12px 10px; transform: translate(10px, -40%); }
  .narrow .num { font-size: 13px; }
  .narrow .num.here { font-size: 18px; }
  .narrow .eq { font-size: 26px; padding: 4px 14px; }
  .narrow .cardside { left: 0; right: 0; top: auto; bottom: 10px; translate: none; width: 100%; padding: 0 12px; gap: 8px; }
  .narrow .card { width: min(190px, 48vw); }
  .narrow .cin { gap: 2px; }
  .narrow .cin h2 { font-size: 17px; }
  .narrow .cin p { font-size: 11px; }
  .narrow .prize { width: 70px; height: 70px; } .narrow .prize img { width: 28px; height: 28px; } .narrow .prize b { font-size: 14px; }
  .narrow .cbtns .btn-big { font-size: 17px; padding: 12px 18px; }
  .narrow .rewatch { bottom: 370px; right: 10px; }
</style>
