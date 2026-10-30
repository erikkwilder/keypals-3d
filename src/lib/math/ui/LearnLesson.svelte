<script lang="ts">
  // One Learn lesson: your 3D buddy talks you through the trick while the picture moves (Next / Back),
  // pointing at the board as it explains; then three questions of your own with the picture still there
  // to help (a cheer when you get one, a kind shrug when you don't); then the finish: a dance, the trick
  // saved, shells the first time, and your eggs grow a little. On the Learn screen the buddy comes from
  // there (`pal`); over a math trip the lesson borrows the 3D stage and gives it back when it closes.
  import CloseButton from '../../ui/CloseButton.svelte';
  import { onDestroy, onMount, tick } from 'svelte';
  import { stage, type Controller } from '../../three/stage';
  import { LearnScene, type LearnBuddy } from '../../three/learnScene';
  import { danceOf } from '../../engine/profile';
  import TileArt from '../../ui/TileArt.svelte';
  import { game } from '../../state/game.svelte';
  import { quietForLesson, sfx } from '../../audio/sound';
  import { advView, markSeen } from '../../adventure/state';
  import { FRIEND } from '../../art/cast';
  import { STRAND } from '../course';
  import { answerOf } from '../facts';
  import { LESSON, askText, boundsOf, coverOf, finishLesson, hideAnswer, hintFor, LEARN_SHELLS } from '../learn';
  import LearnBoard from './LearnBoard.svelte';
  import NumPad from './NumPad.svelte';
  import Confetti from '../../ui/Confetti.svelte';
  import Coach from '../../ui/Coach.svelte';
  import Icon from '../../ui/Icon.svelte';

  type Props = { id: string; embedded?: boolean; pal?: LearnBuddy | null; onclose: () => void; onpractice?: () => void };
  let { id, embedded = false, pal = null, onclose, onpractice }: Props = $props();
  const base = import.meta.env.BASE_URL;
  // (an absolute address: a relative url() in a CSS variable breaks on the built site)
  const boardArt = new URL(`${base}learn/board.webp`, document.baseURI).href;
  const lesson = $derived(LESSON[id]);
  const strand = $derived(STRAND[lesson.op]);
  const buddy = $derived(game.profile!.buddy);

  let phase = $state<'watch' | 'try' | 'done'>('watch');
  let i = $state(0);
  let k = $state(0);
  let typed = $state('');
  let misses = $state(0);
  let said = $state<string | null>(null);
  let shake = $state(0);
  let hop = $state(0);
  let burst = $state(0);
  let locked = $state(false);
  let result = $state<{ first: boolean; shells: number; eggs: number } | null>(null);
  let info = $state<'what' | 'shells' | 'eggs' | 'trick' | null>(null);
  let w = $state(1280);
  const narrow = $derived(w < 760);
  let coach = $state(!new Set(advView(game.profile!).seen ?? []).has('learn1'));
  // the 3D buddy: the Learn screen's, or (over a trip) one of the lesson's own
  let spotEl: HTMLDivElement | undefined = $state();
  let paperEl: HTMLDivElement | undefined = $state();
  let own: LearnScene | null = null;
  let before: Controller | null = null;
  let gone = false;
  const me = (): LearnBuddy | null => pal ?? own;

  const step = $derived(lesson.steps[Math.min(i, lesson.steps.length - 1)]);
  const fact = $derived(lesson.tries[Math.min(k, 2)]);
  const ans = $derived(String(answerOf(fact)));
  const board = $derived(phase === 'try' ? lesson.pic(fact) : step.board);
  // the picture is zoomed to the part it uses: the same for every watch step, so nothing jumps
  const watchView = $derived(boundsOf(lesson.steps.map(s => s.board)));
  const view = $derived(phase === 'try' ? boundsOf([board]) : watchView);
  let vh = $state(900);
  const total = $derived(lesson.steps.length + 3);
  const at = $derived(phase === 'watch' ? i : phase === 'try' ? lesson.steps.length + k : total);
  const PRAISE = ['Yes! You got it!', 'That\'s it!', 'Brilliant!', 'You did it!', 'Spot on!'];
  const speech = $derived(
    phase === 'watch' ? step.say
    : phase === 'try' ? (said ?? (k === 0 ? `Your turn! Use the trick: what is ${askText(fact)}?` : `Now this one: ${askText(fact)}?`))
    : `You learned ${lesson.title}! It's saved in your tricks.`,
  );
  /** "8 + 5 = [13]": the part in brackets lit up */
  const eqParts = $derived(step.eq.split(/(\[[^\]]+\])/).filter(Boolean).map(s => (s.startsWith('[') ? { lit: true, t: s.slice(1, -1) } : { lit: false, t: s })));

  function next() {
    if (phase === 'watch') {
      sfx.pop();
      if (coach) closeCoach();
      if (i < lesson.steps.length - 1) { i++; explain(); }
      else { phase = 'try'; k = 0; typed = ''; said = null; misses = 0; hop++; me()?.wave(); }
    } else if (phase === 'done') leave();
  }
  function back() { if (phase === 'watch' && i > 0) { sfx.click(); i--; explain(); } }
  /** a new step: the buddy points at the board while it says it, then nods */
  function explain() { const b = me(); b?.point(2.2); setTimeout(() => { if (!gone) b?.nod(); }, 2300); }
  function closeCoach() { coach = false; game.update(pp => markSeen(pp, 'learn1')); }

  function digit(d: string) {
    if (phase !== 'try' || locked) return;
    if (typed.length >= ans.length) typed = '';
    typed += d;
    sfx.click();
    if (typed.length === ans.length) check();
  }
  function backspace() { if (phase === 'try' && !locked) typed = typed.slice(0, -1); }
  function check() {
    if (typed === ans) {
      locked = true;
      said = PRAISE[(k + misses) % PRAISE.length];
      hop++; sfx.star(k); me()?.cheer();
      setTimeout(() => {
        locked = false; typed = ''; misses = 0; said = null;
        if (k < 2) k++;
        else finish();
      }, 1100);
    } else {
      misses++; shake++; sfx.miss(); me()?.shrug();
      const t = hintFor(lesson, fact);
      said = misses === 1 ? `Not quite. Try the trick: ${hideAnswer(t, fact)}` : `Here's how: ${t} Type ${ans}.`;
      setTimeout(() => { if (!locked) typed = ''; }, 500);
    }
  }
  function finish() {
    let r = { first: false, shells: 0, eggs: 0 };
    game.update(pp => { const x = finishLesson(pp, id); r = { first: x.first, shells: x.shells, eggs: x.eggsReady.length }; });
    result = r;
    phase = 'done'; burst++; sfx.complete(); hop++;
    me()?.dance(danceOf(game.profile!));
  }
  function leave() { sfx.click(); onclose(); }

  function onKey(e: KeyboardEvent) {
    if (game.sheet || game.settingsOpen) return;
    if (info) { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); info = null; } return; }
    const mine = (fn: () => void) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (phase === 'try') {
      if (/^[0-9]$/.test(e.key)) return mine(() => digit(e.key));
      if (e.key === 'Backspace') return mine(backspace);
    }
    if (e.key === 'Enter' || e.key === ' ' || (e.key === 'ArrowRight' && phase === 'watch')) return mine(next);
    if (e.key === 'ArrowLeft') return mine(back);
    if (e.key === 'Escape') return mine(leave);
  }
  // a lesson opened over a math trip owns the keyboard until it closes
  /** the buddy's here: show it where to stand, say hello, and start explaining */
  let greeted = false;
  function greet(b: LearnBuddy) {
    b.area(spotEl ?? null); b.board(paperEl ?? null);
    if (greeted) return;
    greeted = true; b.wave(); setTimeout(() => { if (!gone) explain(); }, 900);
  }
  // the music hushes while the lesson plays (the buddy's lines and the sounds carry on)
  let unquiet = () => {};
  onMount(() => {
    unquiet = quietForLesson();
    addEventListener('keydown', onKey, true);
    if (!embedded) return;
    // over a trip: borrow the stage for the lesson's own buddy, and give it back after
    void LearnScene.create({ buddy, region: 'village', view: { top: 0.2, bottom: 0.8, left: 0.02, right: 0.28 } }).then(async sc => {
      if (gone) { sc.dispose(); return; }
      own = sc; before = stage.swap(sc); sc.hideOthers();
      await tick();
      greet(sc);
    }).catch(e => console.error(e));
  });
  // on the Learn screen the buddy may still be loading when the lesson opens: greet it when it comes
  $effect(() => { const b = pal; if (b) tick().then(() => { if (!gone) greet(b); }); });
  onDestroy(() => {
    gone = true;
    unquiet();
    removeEventListener('keydown', onKey, true);
    if (own) { if (stage.current() === own) stage.swap(before); own.dispose(); own = null; }
  });
  // the board moves between watching, trying and the finish: tell the buddy where it is now
  $effect(() => { void phase; void paperEl; tick().then(() => me()?.board(paperEl ?? null)); });
</script>

<svelte:window bind:innerHeight={vh} />
<div class="lesson" class:narrow class:done={phase === 'done'} bind:clientWidth={w} style:--sc={strand.color} style:--board="url({boardArt})">
  <div class="side">
    {#key speech}<div class="bubble" class:right={locked} class:oops={phase === 'try' && misses > 0 && !locked}><p>{speech}</p></div>{/key}
    <!-- the 3D buddy stands here (drawn by the stage behind the page) -->
    <div class="spot" bind:this={spotEl} aria-hidden="true"></div>
  </div>

  <div class="boardcard">
    <div class="top">
      <button class="chip" onclick={() => { info = 'what'; sfx.pop(); }} title="What is this?"><img src="{base}learn/tile.webp" alt="" /><span><small>Learn</small><b>{lesson.title}</b></span></button>
      <div class="dots" aria-label="Step {Math.min(at + 1, total)} of {total}">
        {#each Array(total) as _, n}<img src="{base}{n >= lesson.steps.length ? 'learn/marble-c' : 'game/icon-star'}.webp" alt="" class:on={n < at} class:now={n === at} />{/each}
      </div>
      <CloseButton onclick={leave} label={embedded ? 'Back to my trip' : 'Close the lesson'} size={42} />
    </div>

    {#if phase !== 'done'}
      <div class="paper" class:trying={phase === 'try'} bind:this={paperEl}>
        <LearnBoard {board} {buddy} {view} />
        {#if phase === 'try'}<span class="yourturn">Your turn {k + 1} of 3</span>{/if}
      </div>
      {#if phase === 'watch'}
        {#key i}<div class="eq">{#each eqParts as p}{#if p.lit}<span class="lit">{p.t}</span>{:else}<span>{p.t}</span>{/if}{/each}</div>{/key}
        <div class="ctl">
          <button class="btn ghost" onclick={back} disabled={i === 0}>‹ Back</button>
          <button class="btn btn-primary btn-big nextbtn" onclick={next}><TileArt kind="play" size={30} />{i < lesson.steps.length - 1 ? 'Next' : 'My turn!'} <span class="kbd">enter</span></button>
        </div>
      {:else}
        {#key shake}<div class="eq ask" class:shake={shake > 0}><span>{askText(fact)} =</span><span class="box" class:good={locked}>{typed || ' '}</span></div>{/key}
        <NumPad ondigit={digit} onback={backspace} compact={narrow} lit={null} />
      {/if}
    {:else}
      <div class="finish">
        <img class="ftile" src="{base}learn/tile.webp" alt="" />
        <h2>You learned {lesson.title}!</h2>
        <div class="paper small" bind:this={paperEl}><LearnBoard board={coverOf(lesson)} {buddy} view={boundsOf([coverOf(lesson)])} still /></div>
        <div class="prizes">
          {#if result?.shells}<button class="prize" onclick={() => (info = 'shells')}><img src="{base}game/icon-shell.webp" alt="" /><b>+{result.shells}</b><small>shells</small></button>{/if}
          <button class="prize" onclick={() => (info = 'trick')}><span class="bulb"><Icon name="bulb" size={42} /></span><b>Saved</b><small>trick</small></button>
          <button class="prize" onclick={() => (info = 'eggs')}><img src="{base}game/egg-common.webp" alt="" /><b>{result?.eggs ? 'Ready!' : 'Grew'}</b><small>eggs</small></button>
        </div>
        <p class="tapnote">Tap a prize to see what it's for</p>
        <div class="ctl">
          {#if embedded}
            <button class="btn btn-primary btn-big" onclick={leave}>Back to my trip <span class="kbd">enter</span></button>
          {:else}
            {#if onpractice}<button class="btn btn-big" onclick={() => { sfx.click(); onpractice?.(); }}>Practise it now</button>{/if}
            <button class="btn btn-primary btn-big" onclick={leave}>More tricks <span class="kbd">enter</span></button>
          {/if}
        </div>
      </div>
    {/if}
  </div>
  <Confetti {burst} x={60} y={40} />

  {#if info}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="infobg" onclick={() => (info = null)}>
      <div class="infobox" onclick={(e) => e.stopPropagation()}>
        {#if info === 'what'}
          <img class="ibig" src="{base}learn/tile.webp" alt="" />
          <div><h3>A Learn lesson</h3><p>{FRIEND[buddy].name} shows you a trick with a moving picture. Then you try three. Learned tricks come with you: in battles, a Trick button helps on cards like these.</p></div>
        {:else if info === 'shells'}
          <img class="ibig" src="{base}game/icon-shell.webp" alt="" />
          <div><h3>Shells</h3><p>Adventure money! Spend them in the Island Shop. A new trick gives {LEARN_SHELLS} shells the first time you learn it.</p></div>
        {:else if info === 'eggs'}
          <img class="ibig" src="{base}game/egg-common.webp" alt="" />
          <div><h3>Your eggs grew</h3><p>A lesson counts as practice: your three right answers made your Adventure eggs grow.</p></div>
        {:else}
          <span class="ibig bulbbig"><Icon name="bulb" size={72} /></span>
          <div><h3>Trick saved</h3><p>It's in your tricks now. In a battle, tap Trick on a card like these and {FRIEND[buddy].name} gives you a hint.</p></div>
        {/if}
        <button class="btn btn-primary" onclick={() => (info = null)}>OK</button>
      </div>
    </div>
  {/if}
  {#if coach && phase === 'watch' && i === 0}<Coach text="Watch the picture move, then tap Next. After the trick, you try three!" at=".nextbtn" button="Got it" onok={closeCoach} />{/if}
</div>

<style>
  .lesson { position: relative; height: 100%; width: 100%; max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 22px; align-items: center; padding: 14px 24px 18px; }
  .side { display: flex; flex-direction: column; align-items: center; gap: 10px; align-self: center; }
  .bubble { position: relative; background: #fff; border-radius: 24px; padding: 14px 18px; box-shadow: 0 0 0 3px #fff, 0 14px 30px -14px rgba(40, 20, 80, .55); animation: bubble .35s cubic-bezier(.3, 1.4, .5, 1) both; }
  .bubble::after { content: ''; position: absolute; left: 50%; bottom: -16px; margin-left: -14px; border: 14px solid transparent; border-top-color: #fff; border-bottom: 0; }
  .bubble.oops { box-shadow: 0 0 0 4px #ffc2d6, 0 14px 30px -14px rgba(40, 20, 80, .55); }
  .bubble.right { box-shadow: 0 0 0 4px #9be7c4, 0 14px 30px -14px rgba(40, 20, 80, .55); }
  .bubble p { margin: 0; font: 600 21px/1.35 var(--font-ui); color: var(--ink); text-align: center; }
  @keyframes bubble { from { opacity: 0; transform: translateY(8px) scale(.94); } }
  /* where the 3D buddy stands: an empty box the stage frames the buddy into */
  .spot { width: 100%; height: clamp(240px, 46dvh, 420px); }

  .boardcard { min-width: 0; background: rgba(255, 255, 255, .96); border-radius: 30px; padding: 12px 18px 16px; box-shadow: 0 0 0 4px rgba(255, 255, 255, .7), 0 26px 50px -26px rgba(40, 20, 80, .6); display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; align-items: center; gap: 12px; }
  .chip { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; background: color-mix(in srgb, var(--sc) 14%, #fff); border-radius: 18px; padding: 4px 14px 4px 4px; box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sc) 35%, #fff); text-align: left; }
  .chip img { width: 40px; height: 46px; object-fit: contain; }
  .chip small { display: block; font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .chip b { font: 600 21px/1.1 var(--font-ui); color: var(--ink); }
  .dots { flex: 1; display: flex; justify-content: center; gap: 7px; flex-wrap: wrap; }
  /* the steps: a star for each picture, a gold marble for each of your three; grey until reached */
  .dots img { width: 20px; height: 20px; object-fit: contain; filter: grayscale(1) opacity(.35); transition: filter .3s, transform .3s; }
  .dots img.on { filter: none; }
  .dots img.now { filter: drop-shadow(0 0 6px #ffd36b); transform: scale(1.4); }

  /* the board: painted cream paper in a honey-wood frame (the frame keeps its size, the paper stretches) */
  .paper { position: relative; aspect-ratio: 1.76; width: min(100%, calc((100dvh - 330px) * 1.76)); margin: 0 auto; border: 16px solid transparent; border-image: var(--board) 64 fill / 16px stretch; padding: 0; box-sizing: border-box; filter: drop-shadow(0 8px 10px rgba(90, 60, 20, .22)); }
  /* the picture fills the paper (absolute, so a tall picture can't stretch the box) */
  .paper { min-height: 0; overflow: hidden; }
  .paper :global(.lb) { position: absolute; left: 6px; top: 4px; width: calc(100% - 12px); height: calc(100% - 8px); }
  .paper.trying { width: min(100%, calc((100dvh - 420px) * 1.76)); }
  /* the finish picture shrinks on short screens so the buttons under it still fit */
  .paper.small { width: min(100%, 420px, calc((100dvh - 500px) * 1.76)); min-width: 220px; }
  .yourturn { position: absolute; left: 4px; top: 2px; z-index: 1; font: 700 13px var(--font-body); background: #ffc93a; color: #5a3b00; padding: 3px 12px; border-radius: 999px; }
  .eq { text-align: center; font: 600 clamp(28px, 4.2vh, 42px)/1.2 var(--font-ui); color: var(--ink); animation: bubble .3s ease-out both; white-space: pre-wrap; }
  .eq .lit { display: inline-block; background: #ffc93a; color: #4a2f00; padding: 0 14px; border-radius: 14px; box-shadow: 0 4px 0 #e0a51c; margin: 0 2px; }
  .eq.ask { display: flex; align-items: center; justify-content: center; gap: 12px; font-size: clamp(34px, 5vh, 50px); }
  .box { min-width: 1.6em; padding: 0 12px; border-radius: 16px; background: #f4f0fb; box-shadow: inset 0 0 0 3px #d9cff0; text-align: center; }
  .box.good { background: #d9f7e8; box-shadow: inset 0 0 0 3px #4fcf9f; }
  .shake { animation: shake .35s; }
  @keyframes shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
  .ctl { display: flex; gap: 12px; justify-content: space-between; align-items: center; }
  .ctl .btn-primary { margin-left: auto; }
  .nextbtn { display: inline-flex; align-items: center; gap: 8px; }
  .ghost { background: var(--bg2); color: var(--ink2); box-shadow: none; }
  .ghost:disabled { opacity: .35; }
  .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 11px; height: 22px; }

  .finish { display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
  .ftile { width: clamp(48px, 9dvh, 92px); animation: bubble .5s cubic-bezier(.3, 1.6, .5, 1) both; }
  .finish h2 { margin: 0; font-size: clamp(28px, 4vh, 40px); color: var(--ink); }
  .prizes { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100px; height: 108px; gap: 2px; border: 0; border-radius: 22px; background: #fff; cursor: pointer; box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); transition: transform .15s; }
  .prize:hover { transform: translateY(-3px); }
  .prize img { width: 46px; height: 46px; object-fit: contain; }
  .prize .bulb { display: grid; place-items: center; height: 46px; }
  .prize b { font: 600 21px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 12px var(--font-body); color: var(--muted); }
  .tapnote { margin: 0; font: 700 14px var(--font-body); color: var(--muted); }
  .finish .ctl { width: 100%; justify-content: center; }
  .finish .ctl .btn-primary { margin-left: 0; }

  .infobg { position: fixed; inset: 0; z-index: 45; background: rgba(40, 28, 70, .4); display: grid; place-items: center; }
  .infobox { width: min(520px, 92vw); background: #fff; border-radius: 26px; padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; box-shadow: var(--shadow); }
  .infobox h3 { margin: 0 0 4px; font-size: 22px; }
  .infobox p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .infobox > .btn { grid-column: 1 / -1; justify-self: end; }
  .ibig { width: 90px; height: 96px; object-fit: contain; }
  .bulbbig { display: grid; place-items: center; }

  /* phones: the buddy and what it says on one row, the picture under it, the pad at the bottom */
  .narrow { grid-template-columns: 1fr; align-content: start; gap: 10px; padding: 10px 10px 12px; }
  .narrow .side { flex-direction: row-reverse; align-items: stretch; gap: 8px; }
  .narrow .spot { width: 104px; height: 128px; flex: none; }
  .narrow .bubble { align-self: center; }
  .narrow .bubble { flex: 1; padding: 10px 14px; }
  .narrow .bubble::after { left: -14px; top: 50%; bottom: auto; margin: -12px 0 0; border: 12px solid transparent; border-right-color: #fff; border-left: 0; }
  .narrow .bubble p { font-size: 17px; text-align: left; }
  .narrow .boardcard { padding: 10px 10px 12px; border-radius: 24px; gap: 8px; }
  .narrow .chip b { font-size: 17px; } .narrow .chip img { width: 32px; height: 36px; }
  .narrow .top { flex-wrap: wrap; row-gap: 6px; }
  .narrow .dots { order: 3; flex-basis: 100%; gap: 5px; } .narrow .dots img { width: 16px; height: 16px; }
  .narrow .paper { width: 100%; aspect-ratio: 1.15; border-width: 11px; border-image-width: 11px; }
  /* your turn on a phone: a shorter picture so the number pad fits under it */
  .narrow .paper.trying { width: 100%; aspect-ratio: 2; }
  .narrow .eq.ask { font-size: 34px; }
  .narrow .paper.small { aspect-ratio: 1.6; }
  .narrow .ctl .btn-big { font-size: 18px; padding: 12px 18px; }
  .narrow .kbd { display: none; }
  .narrow .infobox { grid-template-columns: 1fr; justify-items: center; text-align: center; }
  .narrow { overflow-y: auto; }
  .narrow .ftile { width: 56px; }
  .narrow .finish { gap: 8px; }
  .narrow .finish h2 { font-size: 24px; }
  .narrow .paper.small { aspect-ratio: 2.2; }
  .narrow .prize { width: 84px; height: 88px; } .narrow .prize img { width: 36px; height: 36px; } .narrow .prize b { font-size: 18px; }
  .narrow .finish .ctl { flex-wrap: wrap; }
</style>
