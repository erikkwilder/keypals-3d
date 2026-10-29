<script lang="ts">
  // Learn: every trick as a short lesson with the buddy. The list shows what to learn next, the tricks
  // you've learned (watch them again any time) and every lesson by kind of math. Nothing is locked.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { STRANDS, MATH_LESSONS } from '../math/course';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { LESSON, LESSONS, boundsOf, coverOf, isLearned, nextToLearn, type Lesson } from '../math/learn';
  import LearnBoard from '../math/ui/LearnBoard.svelte';
  import LearnLesson from '../math/ui/LearnLesson.svelte';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const buddy = $derived(p.buddy);
  const learned = $derived(LESSONS.filter(l => isLearned(m, l.id)));
  const nextStop = $derived(nextMathLesson(m, m.strand ?? 'x'));
  const hero = $derived(nextToLearn(m, nextStop));
  let tall = $state(false);
  const open = $derived(game.learnId ? LESSON[game.learnId] ?? null : null);

  function watch(l: Lesson) { sfx.click(); game.learnId = l.id; }
  function close() { game.learnId = null; }
  /** the first stop that uses this trick, to practise it right after */
  function practiceStop(l: Lesson) {
    if (l.id === 'zero-one') return 'twins-1';
    const r = l.regions[0];
    return MATH_LESSONS.find(x => x.region === r && x.kind === 'meet')?.id ?? null;
  }
  function practise(l: Lesson) {
    const stop = practiceStop(l);
    game.learnId = null;
    if (stop) { game.setHome('math'); game.startMath(stop); }
  }
  function back() { if (open) close(); else game.go(game.learnBack === 'learn' ? 'map' : game.learnBack); }
  onMount(() => {
    const onR = () => { tall = innerWidth < 760 || innerHeight > innerWidth * 1.05; };
    onR(); addEventListener('resize', onR);
    return () => removeEventListener('resize', onR);
  });
</script>

<div class="screen learn" style:background-image="url({base}learn/{tall ? 'room-tall' : 'room'}.webp)">
  <div class="veil"></div>
  <Header title={open ? 'Learn a trick' : 'Learn'} sub={open ? undefined : `${learned.length} of ${LESSONS.length} tricks learned`} {back} />

  {#if open}
    {#key open.id}
      <div class="lessonwrap"><LearnLesson id={open.id} onclose={close} onpractice={practiceStop(open) ? () => practise(open) : undefined} /></div>
    {/key}
  {:else}
    <div class="list scroll">
      {#if hero}
        <section class="hero" style:--sc={STRANDS.find(s => s.op === hero.op)?.color}>
          <button class="hpic" onclick={() => watch(hero)} aria-label="Watch {hero.title}"><LearnBoard board={coverOf(hero)} view={boundsOf([coverOf(hero)])} {buddy} still /></button>
          <div class="htext">
            <small>{isLearned(m, hero.id) ? 'Watch again' : 'Next to learn'}</small>
            <h2>{hero.title}</h2>
            <p>{hero.blurb}</p>
            <div class="hrow">
              <Critter friend={buddy} size={58} round />
              <span class="hsay">{p.name}, I'll show you! It takes about two minutes.</span>
            </div>
            <button class="btn btn-primary btn-big" onclick={() => watch(hero)}><Icon name="play" size={26} /> Watch: {hero.title}</button>
          </div>
        </section>
      {/if}

      {#if learned.length}
        <section class="mine">
          <h3><Icon name="bulb" size={28} /> Your tricks <small>They help you in battles</small></h3>
          <div class="chips">
            {#each learned as l (l.id)}
              <button class="tchip" style:--sc={STRANDS.find(s => s.op === l.op)?.color} onclick={() => watch(l)}><Icon name="check" size={18} />{l.title}<Icon name="play" size={20} /></button>
            {/each}
          </div>
        </section>
      {/if}

      {#each STRANDS as st (st.op)}
        {@const ls = LESSONS.filter(l => l.op === st.op)}
        <section class="strand" style:--sc={st.color}>
          <h3><img src="{base}{st.art}" alt="" />{st.name}<small>{ls.filter(l => isLearned(m, l.id)).length} of {ls.length} learned</small></h3>
          <div class="grid">
            {#each ls as l (l.id)}
              {@const done = isLearned(m, l.id)}
              <article class="lcard" class:done>
                <button class="lpic" onclick={() => watch(l)} aria-label="Watch {l.title}"><LearnBoard board={coverOf(l)} view={boundsOf([coverOf(l)])} {buddy} still /></button>
                <div class="ltext">
                  <b>{l.title}</b>
                  <span>{l.blurb}</span>
                  <div class="lrow">
                    {#if done}<span class="pill ok"><Icon name="check" size={14} /> Learned</span>{:else}<span class="pill new">New</span>{/if}
                    <button class="btn small" class:btn-primary={!done} onclick={() => watch(l)}>{done ? 'Watch again' : 'Watch'}</button>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/each}
      <div class="endpad"></div>
    </div>
  {/if}
</div>

<style>
  .learn { display: flex; flex-direction: column; background-size: cover; background-position: center; background-color: #f3e6cf; }
  .veil { position: absolute; inset: 0; background: linear-gradient(rgba(255, 250, 240, .2), rgba(255, 248, 235, .55)); pointer-events: none; }
  .lessonwrap { position: relative; flex: 1; min-height: 0; display: flex; }
  .list { position: relative; flex: 1; min-height: 0; padding: 18px 22px; display: flex; flex-direction: column; gap: 18px; max-width: 1240px; width: 100%; margin: 0 auto; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: center; background: rgba(255, 255, 255, .95); border-radius: 30px; padding: 16px 20px; box-shadow: 0 0 0 4px rgba(255, 255, 255, .7), 0 24px 44px -26px rgba(40, 20, 80, .6); }
  .hpic, .lpic { display: block; width: 100%; aspect-ratio: 1.76; border: 0; padding: 4px; cursor: pointer; background: linear-gradient(#fffdf7, #fbf6ea); border-radius: 22px; box-shadow: inset 0 0 0 3px #f1e6cf; transition: transform .15s; }
  .hpic:hover, .lpic:hover { transform: translateY(-3px); }
  .hpic, .lpic { position: relative; overflow: hidden; }
  .hpic :global(.lb), .lpic :global(.lb) { position: absolute; left: 6px; top: 4px; width: calc(100% - 12px); height: calc(100% - 8px); }
  .htext small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .htext h2 { margin: 2px 0 4px; font-size: clamp(30px, 3.6vw, 44px); }
  .htext p { margin: 0 0 10px; font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .hrow { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .hsay { background: #f4f0fb; border-radius: 16px; padding: 8px 12px; font: 600 15px/1.3 var(--font-body); color: var(--ink2); }
  .hero .btn-primary { background: linear-gradient(color-mix(in srgb, var(--sc) 70%, #fff), var(--sc)); box-shadow: 0 5px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .mine, .strand { background: rgba(255, 255, 255, .92); border-radius: 26px; padding: 14px 16px 16px; box-shadow: 0 18px 36px -26px rgba(40, 20, 80, .55); }
  h3 { margin: 0 0 10px; display: flex; align-items: center; gap: 10px; font-size: 22px; flex-wrap: wrap; }
  h3 small { font: 700 14px var(--font-body); color: var(--muted); }
  h3 img { width: 64px; height: 38px; object-fit: cover; border-radius: 10px; box-shadow: 0 0 0 3px var(--sc); }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .tchip { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 8px 12px; border-radius: 999px; background: color-mix(in srgb, var(--sc) 14%, #fff); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sc) 40%, #fff); font: 600 16px var(--font-ui); color: var(--ink); }
  .tchip:hover { transform: translateY(-2px); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .lcard { display: flex; flex-direction: column; gap: 8px; background: #fff; border-radius: 22px; padding: 8px; box-shadow: 0 0 0 2px #efe9f8; }
  .lcard.done { box-shadow: 0 0 0 3px #b8edd5; }
  .ltext { display: flex; flex-direction: column; gap: 3px; padding: 0 4px 2px; }
  .ltext b { font: 600 19px var(--font-ui); }
  .ltext > span { font: 600 14px/1.3 var(--font-body); color: var(--muted); }
  .lrow { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
  .pill { display: inline-flex; align-items: center; gap: 3px; font: 800 12px var(--font-body); padding: 3px 10px; border-radius: 999px; }
  .pill.ok { background: #d9f7e8; color: #1f7a54; }
  .pill.new { background: #fff1c2; color: #8a5a00; }
  .btn.small { padding: 7px 16px; font-size: 16px; }
  .endpad { height: 30px; flex: none; }
  @media (max-width: 760px) {
    .list { padding: 10px; gap: 12px; }
    .hero { grid-template-columns: 1fr; padding: 12px; gap: 10px; }
    .htext h2 { font-size: 28px; }
    .hsay { font-size: 14px; }
    .hero .btn-big { width: 100%; font-size: 19px; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ltext b { font-size: 16px; }
    .ltext > span { display: none; }
    .lrow { flex-direction: column; align-items: stretch; }
    .pill { text-align: center; }
    h3 { font-size: 19px; }
  }
</style>
