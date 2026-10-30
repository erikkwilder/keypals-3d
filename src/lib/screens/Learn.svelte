<script lang="ts">
  // Learn: every trick as a short episode in a 3D place (math/ui/Episode.svelte). Your 3D buddy stands
  // on the island beside the list (above it on a phone) and says what's next; the list shows a trick
  // that's due its quick check, what to learn next, the tricks you've learned (watch them again any
  // time) and every episode by kind of math, each in its own place with its Glimmer. Nothing is locked.
  import { onDestroy, onMount, tick } from 'svelte';
  import { stage } from '../three/stage';
  import { LearnScene } from '../three/learnScene';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { STRANDS, MATH_LESSONS } from '../math/course';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { LESSONS, checkDueId, isLearned, nextToLearn, type Lesson } from '../math/learn';
  import { SETS, epLesson, isEpisode, setOf } from '../math/episodes';
  import { FRAC_LESSONS, type FracLesson } from '../math/fracEpisodes';
  import { SHAPE_LESSONS } from '../math/shapes/episodes';
  import { RATIO_COLOR, RATIO_LESSONS } from '../math/ratioEpisodes';
  import { DATA_COLOR, DATA_LESSONS } from '../math/data/episodes';
  import { ALG_LESSONS } from '../math/algebra/episodes';
  import { SKILL_LESSONS } from '../math/skills/course';
  import { GLIMMER } from '../adventure/glimmers';
  import { glimmerArt } from '../adventure/evolve';
  import { FRIEND } from '../art/cast';
  import Episode from '../math/ui/Episode.svelte';
  import Header from '../ui/Header.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  // (an absolute address: a relative url() in a CSS variable breaks on the built site)
  const boardArt = new URL(`${base}learn/board.webp`, document.baseURI).href;
  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const buddy = $derived(p.buddy);
  const learned = $derived(LESSONS.filter(l => isLearned(m, l.id)));
  const pv = LESSONS.filter(l => l.area === 'place');
  const nextStop = $derived(nextMathLesson(m, m.strand ?? 'x'));
  const hero = $derived(nextToLearn(m, nextStop));
  const dueId = $derived(checkDueId(m, isEpisode));
  const due = $derived(dueId ? epLesson(dueId) : null);
  let tall = $state(false);
  const open = $derived(game.learnId && isEpisode(game.learnId) ? game.learnId : null);
  /** the open episode is just its next-day quick check (a subject page can open one that way) */
  let checking = $state(game.learnCheck);
  game.learnCheck = false;
  /** opened straight onto an episode (from the Math page's Learn tab): closing it goes back there */
  const direct = !!game.learnId;
  // the 3D buddy, for the list and the lessons
  let scene = $state<LearnScene | null>(null);
  let spotEl: HTMLDivElement | undefined = $state();
  let listEl: HTMLDivElement | undefined = $state();
  let gone = false;
  const hello = $derived(due ? `${p.name}, do you remember ${due.title}? Quick check!` : hero ? (isLearned(m, hero.id) ? `Want to see ${hero.title} again? Tap Watch!` : `${p.name}, I'll show you a trick: ${hero.title}! It takes about two minutes.`) : 'Pick a trick to watch!');

  function watch(l: { id: string }) { sfx.click(); checking = false; game.learnId = l.id; }
  function quickCheck(l: { id: string }) { sfx.click(); checking = true; game.learnId = l.id; }
  function close() { game.learnId = null; checking = false; if (direct) game.go(game.learnBack === 'learn' ? 'map' : game.learnBack); }
  /** the first stop that uses this trick, to practise it right after (a fraction idea: the fractions
   *  stop that meets its skill; a place value lesson names its own practice lesson) */
  function practiceStop(id: string) {
    const f = [...FRAC_LESSONS, ...SHAPE_LESSONS, ...RATIO_LESSONS, ...DATA_LESSONS, ...ALG_LESSONS].find(x => x.id === id);
    if (f) return SKILL_LESSONS.find(x => x.kind === 'meet' && x.learn.includes(f.skill))?.id ?? null;
    if (id === 'zero-one') return 'twins-1';
    const l = LESSONS.find(x => x.id === id);
    if (l?.practice) return l.practice;
    const r = l?.regions[0];
    return MATH_LESSONS.find(x => x.region === r && x.kind === 'meet')?.id ?? null;
  }
  function practise(id: string) {
    const stop = practiceStop(id);
    game.learnId = null;
    if (!stop) return;
    game.setHome('math');
    if (FRAC_LESSONS.some(x => x.id === id) || SHAPE_LESSONS.some(x => x.id === id) || RATIO_LESSONS.some(x => x.id === id) || DATA_LESSONS.some(x => x.id === id) || ALG_LESSONS.some(x => x.id === id) || LESSONS.find(x => x.id === id)?.practice) game.startSkill(stop); else game.startMath(stop);
  }
  const fracLearned = $derived(FRAC_LESSONS.filter(l => isLearned(m, l.id)));
  const shapeLearned = $derived(SHAPE_LESSONS.filter(l => isLearned(m, l.id)));
  const ratioLearned = $derived(RATIO_LESSONS.filter(l => isLearned(m, l.id)));
  const dataLearned = $derived(DATA_LESSONS.filter(l => isLearned(m, l.id)));
  const algLearned = $derived(ALG_LESSONS.filter(l => isLearned(m, l.id)));
  const fracSet = (l: FracLesson) => SETS[l.set];
  function back() { if (open) close(); else game.go(game.learnBack === 'learn' ? 'map' : game.learnBack); }
  onMount(() => {
    const onR = () => { tall = innerWidth < 760 || innerHeight > innerWidth * 1.05; };
    onR(); addEventListener('resize', onR);
    void LearnScene.create({ buddy, region: 'village', view: { top: 0.2, bottom: 0.85, left: 0, right: 0.3 } }).then(async sc => {
      if (gone) { sc.dispose(); return; }
      // (an episode that opened first keeps the stage; the buddy takes it back when the episode closes)
      scene = sc;
      if (!game.learnId) stage.use(sc);
      await tick();
      sc.area(spotEl ?? null); sc.board(listEl ?? null); sc.wave();
    }).catch(e => console.error(e));
    return () => removeEventListener('resize', onR);
  });
  onDestroy(() => { gone = true; if (scene && stage.current() === scene) stage.use(null); else scene?.dispose(); });
  // back from a lesson: the buddy stands beside the list again and points at it
  $effect(() => { if (!open && scene) tick().then(() => { if (scene && stage.current() !== scene) stage.use(scene); scene?.area(spotEl ?? null); scene?.board(listEl ?? null); }); });
</script>

<div class="screen learn" class:tall style:--board="url({boardArt})">
  {#if open}
    {#key `${open}-${checking}`}
      <Episode id={open} check={checking} onclose={close} onpractice={practiceStop(open) ? () => practise(open) : undefined} onwatch={() => { checking = false; }} />
    {/key}
  {:else}
  <div class="veil"></div>
  <Header title="Learn" sub={`${learned.length + fracLearned.length + shapeLearned.length + ratioLearned.length + dataLearned.length} of ${LESSONS.length + FRAC_LESSONS.length + SHAPE_LESSONS.length + RATIO_LESSONS.length + DATA_LESSONS.length} tricks learned`} {back} />
    <div class="room">
    <div class="side">
      {#key hello}<div class="bubble"><p>{hello}</p></div>{/key}
      <!-- the 3D buddy stands here (drawn by the stage behind the page) -->
      <div class="spot" bind:this={spotEl} aria-hidden="true"></div>
    </div>
    <div class="list scroll" bind:this={listEl}>
      {#if due}
        {@const ds = SETS[due.set]}
        <section class="due" style:--sc={due.color}>
          <img class="dglim" src="{base}{glimmerArt(ds.star)}" alt="" />
          <div class="dtext"><small>Quick check</small><b>Do you remember {due.title}?</b><span>One question, and the trick is yours for good.</span></div>
          <button class="btn btn-primary" onclick={() => quickCheck(due)}><Icon name="bulb" size={22} /> Check it</button>
        </section>
      {/if}
      {#if hero}
        {@const hs = setOf(hero.id)}
        <section class="hero" style:--sc={STRANDS.find(s => s.op === hero.op)?.color}>
          <button class="hpic" style:--set="url({base}{hs.backdrop})" onclick={() => watch(hero)} aria-label="Watch {hero.title}">
            <img class="pface" src="{base}portraits/{buddy}-head.png" alt="" />
            <img class="gface" src="{base}{glimmerArt(hs.star)}" alt="" />
            <span class="play"><Icon name="play" size={34} /></span>
            <span class="where">{hs.name}</span>
          </button>
          <div class="htext">
            <small>{isLearned(m, hero.id) ? 'Watch again' : 'Next to learn'}</small>
            <h2>{hero.title}</h2>
            <p>{GLIMMER[hs.star].name} and {FRIEND[buddy].name} need your help. {hero.blurb}</p>
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

      <!-- fractions: the pie, the pizza, the chocolate bar, the cupcakes and the plank -->
      <section class="strand" style:--sc="#ef8a4b">
        <h3><img src="{base}learn/frac/card-pie.webp" alt="" />Fractions<small>{fracLearned.length} of {FRAC_LESSONS.length} learned</small></h3>
        <div class="grid">
          {#each FRAC_LESSONS as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const fs = fracSet(l)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}{l.art})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(l.star ?? fs.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{fs.name}</span>
              </button>
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

      <!-- shapes and angles: crystal tiles in the workshop at Shape Peaks -->
      <section class="strand" style:--sc="#2fb3a0">
        <h3><img src="{base}learn/shapes/card-sides.webp" alt="" />Shapes and angles<small>{shapeLearned.length} of {SHAPE_LESSONS.length} learned</small></h3>
        <div class="grid">
          {#each SHAPE_LESSONS as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const fs = fracSet(l)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}{l.art})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(l.star ?? fs.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{fs.name}</span>
              </button>
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

      <!-- ratios and percents: Mushroom Mouse's juice bar in the Juice Jungle (math/ratioEpisodes.ts) -->
      <section class="strand" style:--sc={RATIO_COLOR}>
        <h3><img src="{base}learn/ratio/card-fruit.webp" alt="" />Ratios and percents<small>{ratioLearned.length} of {RATIO_LESSONS.length} learned</small></h3>
        <div class="grid">
          {#each RATIO_LESSONS as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const fs = fracSet(l)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}{l.art})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(l.star ?? fs.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{fs.name}</span>
              </button>
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

      <!-- data and chance: the fair booth (sorting, bar graphs, line plots, the mean, the median, chance, two at once) -->
      <section class="strand" style:--sc={DATA_COLOR}>
        <h3><img src="{base}learn/data/card-bars.webp" alt="" />Data and chance<small>{dataLearned.length} of {DATA_LESSONS.length} learned</small></h3>
        <div class="grid">
          {#each DATA_LESSONS as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const fs = fracSet(l)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}{l.art})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(l.star ?? fs.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{fs.name}</span>
              </button>
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

      <!-- expressions and equations: the golden balance, weights and mystery boxes in the Star Lab -->
      <section class="strand" style:--sc="#6c5ce7">
        <h3><img src="{base}math/algebra/tile.webp" alt="" />Expressions and equations<small>{algLearned.length} of {ALG_LESSONS.length} learned</small></h3>
        <div class="grid">
          {#each ALG_LESSONS as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const fs = fracSet(l)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}learn/ep/set-lab.webp)" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(l.star ?? fs.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{fs.name}</span>
              </button>
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

      {#each STRANDS as st (st.op)}
        {@const ls = LESSONS.filter(l => l.op === st.op && !l.area)}
        <section class="strand" style:--sc={st.color}>
          <h3><img src="{base}{st.art}" alt="" />{st.name}<small>{ls.filter(l => isLearned(m, l.id)).length} of {ls.length} learned</small></h3>
          <div class="grid">
            {#each ls as l (l.id)}
              {@const done = isLearned(m, l.id)}
              {@const ls2 = setOf(l.id)}
              <article class="lcard" class:done>
                <button class="lpic" style:--set="url({base}{ls2.backdrop})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                  <img class="gface" src="{base}{glimmerArt(ls2.star)}" alt="" />
                  <span class="play small"><Icon name="play" size={24} /></span>
                  <span class="where">{ls2.name}</span>
                </button>
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
      <!-- place value: the Crystal Cave Workshop's lessons (math/placeLessons.ts) -->
      <section class="strand" style:--sc="#2d6fb8">
        <h3><img src="{base}math/area-place.webp" alt="" />Place value<small>{pv.filter(l => isLearned(m, l.id)).length} of {pv.length} learned</small></h3>
        <div class="grid">
          {#each pv as l (l.id)}
            {@const done = isLearned(m, l.id)}
            {@const ls2 = setOf(l.id)}
            <article class="lcard" class:done>
              <button class="lpic" style:--set="url({base}{ls2.backdrop})" onclick={() => watch(l)} aria-label="Watch {l.title}">
                <img class="gface" src="{base}{glimmerArt(ls2.star)}" alt="" />
                <span class="play small"><Icon name="play" size={24} /></span>
                <span class="where">{ls2.name}</span>
              </button>
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
      <div class="endpad"></div>
    </div>
    </div>
  {/if}
</div>

<style>
  /* the island and the buddy are the 3D stage behind the page; the cards sit on it */
  .learn { display: flex; flex-direction: column; background: transparent; }
  .veil { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(255, 250, 240, 0) 22%, rgba(255, 248, 235, .35) 60%); pointer-events: none; }
  .room { position: relative; flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(220px, 30%) minmax(0, 1fr); gap: 12px; }
  .side { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; padding: 10px 6px 18px 18px; }
  .spot { width: 100%; height: min(58dvh, 460px); }
  .bubble { position: relative; max-width: 300px; background: #fff; border-radius: 24px; padding: 12px 16px; box-shadow: 0 0 0 3px #fff, 0 14px 30px -14px rgba(40, 20, 80, .55); animation: bubble .35s cubic-bezier(.3, 1.4, .5, 1) both; }
  .bubble::after { content: ''; position: absolute; left: 50%; bottom: -14px; margin-left: -12px; border: 12px solid transparent; border-top-color: #fff; border-bottom: 0; }
  .bubble p { margin: 0; font: 600 18px/1.35 var(--font-ui); color: var(--ink); text-align: center; }
  @keyframes bubble { from { opacity: 0; transform: translateY(8px) scale(.94); } }
  .list { position: relative; min-height: 0; padding: 18px 22px 18px 4px; display: flex; flex-direction: column; gap: 18px; max-width: 1000px; width: 100%; }
  .hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 20px; align-items: center; background: rgba(255, 255, 255, .95); border-radius: 30px; padding: 16px 20px; box-shadow: 0 0 0 4px rgba(255, 255, 255, .7), 0 24px 44px -26px rgba(40, 20, 80, .6); }
  /* each lesson's picture on its painted board (the frame keeps its size, the paper stretches) */
  /* each episode's picture: its painted place, its Glimmer (and on the big one, your buddy) */
  .hpic, .lpic { position: relative; display: block; width: 100%; aspect-ratio: 1.76; padding: 0; cursor: pointer; border: 0; border-radius: 20px; overflow: hidden; background: var(--set) center 30% / cover; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .6), 0 10px 18px -10px rgba(90, 60, 20, .5); transition: transform .15s; }
  .hpic:hover, .lpic:hover { transform: translateY(-3px); }
  .hpic::after, .lpic::after { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(0, 0, 0, 0) 55%, rgba(50, 25, 5, .45)); }
  .gface { position: absolute; right: 4%; bottom: 4%; width: 34%; aspect-ratio: 1; object-fit: contain; z-index: 1; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, .35)); }
  .pface { position: absolute; left: 4%; bottom: 4%; width: 30%; aspect-ratio: 1; object-fit: contain; z-index: 1; filter: drop-shadow(0 6px 8px rgba(0, 0, 0, .35)); }
  .play { position: absolute; left: 50%; top: 46%; translate: -50% -50%; z-index: 1; display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: rgba(255, 255, 255, .92); color: var(--sc); box-shadow: 0 0 0 5px rgba(255, 255, 255, .4), 0 8px 18px rgba(0, 0, 0, .3); }
  .play.small { width: 44px; height: 44px; left: 12%; top: 16%; }
  .where { position: absolute; left: 10px; top: 8px; z-index: 1; font: 800 11px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: #fff; text-shadow: 0 1px 3px rgba(0, 0, 0, .6); }
  .lpic .where { left: auto; right: 10px; }
  .due { display: flex; align-items: center; gap: 14px; background: linear-gradient(100deg, #fff7dc, #fff); border-radius: 26px; padding: 10px 16px; box-shadow: 0 0 0 3px #ffd75e, 0 18px 36px -26px rgba(40, 20, 80, .55); }
  .dglim { width: 70px; height: 70px; object-fit: contain; flex: none; }
  .dtext { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .dtext small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #b07a10; }
  .dtext b { font: 600 22px var(--font-ui); color: var(--ink); }
  .dtext span { font: 600 14px var(--font-body); color: var(--muted); }
  .htext small { font: 800 12px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .htext h2 { margin: 2px 0 4px; font-size: clamp(30px, 3.6vw, 44px); }
  .htext p { margin: 0 0 10px; font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
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
    /* phones: the buddy and what it says in a band at the top, the list under it */
    .room { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); gap: 0; }
    .side { flex-direction: row-reverse; align-items: center; justify-content: flex-start; padding: 6px 10px 0; }
    .spot { width: 96px; height: 120px; flex: none; }
    .bubble { flex: 1; max-width: none; padding: 9px 12px; }
    .bubble::after { left: auto; right: -12px; top: 50%; bottom: auto; margin: -10px 0 0; border: 10px solid transparent; border-left-color: #fff; border-right: 0; }
    .bubble p { font-size: 15px; text-align: left; }
    .veil { background: linear-gradient(rgba(255, 250, 240, 0) 10%, rgba(255, 248, 235, .35) 40%); }
    .list { padding: 10px; gap: 12px; }
    .hero { grid-template-columns: 1fr; padding: 12px; gap: 10px; }
    .htext h2 { font-size: 28px; }
    .hero .btn-big { width: 100%; font-size: 19px; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ltext b { font-size: 16px; }
    .ltext > span { display: none; }
    .lrow { flex-direction: column; align-items: stretch; }
    .pill { text-align: center; }
    h3 { font-size: 19px; }
  }
</style>
