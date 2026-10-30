<script lang="ts">
  // The incubator: three warm nests. Eggs come from battles (and the shop), and they hatch from right
  // answers in practice: every math answer, every five typed letters, every playground game. A ready egg
  // wobbles; tap Hatch and it rises into the light, wobbles harder and harder as cracks glow across it
  // (real eggshell cracks you can hear), then bursts: the shell flies apart in pieces cut from the egg's
  // own painting, light and sparkles pour out, and the Glimmer inside pops up on its stone in a beam of
  // light before its card flips in.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { GlimmerShow } from '../three/glimmerShow';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { RARITY } from '../adventure/glimmers';
  import { advOf, EGG_ODDS, type Egg, advView } from '../adventure/state';
  import { SOURCES } from '../adventure/ladder';
  import Header from '../ui/Header.svelte';
  import HatchMoment from '../ui/HatchMoment.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  let scene = $state.raw<GlimmerShow | null>(null);
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  /** the nest whose egg is hatching (ui/HatchMoment.svelte has the moment itself) */
  let cracking = $state(-1);

  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.15, bottom: 0.6, left: 0.2, right: 0.8 };
  }
  function onResize() { if (scene && cracking < 0) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const sc = await GlimmerShow.create(viewOf(), 'village');
    if (disposed) { sc.dispose(); return; }
    scene = sc; stage.use(sc);
    requestAnimationFrame(onResize);
  });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function doHatch(slot: number) { if (cracking < 0 && a.incubator[slot]) cracking = slot; }
  function closeHatched() { cracking = -1; if (scene) scene.view = viewOf(); }
  function goPractice(kind: 'math' | 'typing') {
    if (kind === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p)).id); }
  }
  // a special egg (the 100-Glimmer ladder): its own painting and name ("Milestone egg")
  const eggSrc = (e: Egg) => `${base}game/egg-${e.kind && e.glimmer ? e.kind : e.rarity}.webp`;
  const eggName = (e: Egg) => (e.kind && e.glimmer ? SOURCES[e.kind].egg : `${RARITY[e.rarity].name} egg`);
</script>

<div class="screen eggs" class:showing={cracking >= 0}>
  <Header />
  <div class="stagebox" bind:this={stageEl}></div>

  <div class="nests">
    {#each a.incubator as e, i}
      <div class="slot" class:ready={e && e.have >= e.need} class:cracking={cracking === i}>
        <!-- the egg sits down in the bowl: the nest, a soft shadow, the egg, then the nest's front rim
             again over the egg's bottom -->
        <div class="nestbox">
          <img class="nimg" src="{base}game/nest.webp" alt="" />
          {#if e}
            <i class="eshadow" class:gone={cracking === i}></i>
            <img class="egg r-{e.rarity}" class:gone={cracking === i} src={eggSrc(e)} alt={eggName(e)} />
            <img class="nfront" src="{base}game/nest.webp" alt="" aria-hidden="true" />
          {/if}
        </div>
        {#if e}
          <div class="lab">
            <b style:color={e.rarity === 'common' ? null : RARITY[e.rarity].color}>{eggName(e)}</b>
            {#if e.have >= e.need}<button class="btn btn-primary hatch" onclick={() => doHatch(i)} disabled={cracking >= 0}>Hatch!</button>
            {:else}<div class="bar"><i style:width="{(e.have / e.need) * 100}%"></i></div><span>{e.need - e.have} more right answers to hatch</span>{/if}
          </div>
        {:else}<div class="lab"><span>Empty nest</span></div>{/if}
      </div>
    {/each}
  </div>
  {#if a.nest.length}
    <div class="waiting"><span>Waiting in the nest:</span>{#each a.nest as e}<img src={eggSrc(e)} alt={eggName(e)} title={eggName(e)} />{/each}</div>
  {/if}
  <div class="how card">
    <div class="howpic" style:background-image="url({base}game/intro-practice.webp)"></div>
    <div class="howtext">
      <h3>How eggs hatch</h3>
      <ol>
        <li><b>Practice:</b> do a math trip, a typing lesson or a playground game.</li>
        <li><b>Every right answer</b> makes your eggs grow (all three at once).</li>
        <li><b>Bar full?</b> Tap <b>Hatch</b> and meet a new Glimmer!</li>
      </ol>
      <div class="row"><button class="btn" class:btn-primary={game.homeGame !== 'typing'} onclick={() => goPractice('math')}>Math practice</button><button class="btn" class:btn-primary={game.homeGame === 'typing'} onclick={() => goPractice('typing')}>Typing practice</button></div>
      <p class="muted small">You get eggs from battles (always from a Perfect Cheer or a Champion) and from the shop.</p>
    </div>
  </div>

  {#if cracking >= 0}<HatchMoment slot={cracking} {scene} onclose={closeHatched} />{/if}
</div>

<style>
  .eggs { display: flex; flex-direction: column; background: transparent; }
  .stagebox { flex: 1; min-height: 160px; }
  .nests { display: flex; gap: 18px; justify-content: center; padding: 0 16px; flex-wrap: wrap; }
  .slot { position: relative; width: 230px; display: flex; flex-direction: column; align-items: center; background: rgba(255, 255, 255, .9); border-radius: 26px; padding: 10px 10px 14px; box-shadow: 0 14px 30px -16px rgba(40, 20, 80, .55); }
  /* the nest picture is seen from above: its bowl's opening is an oval, and the egg stands in it with its
     bottom below the front rim (the rim is drawn again over it, cut along the oval's front edge) */
  .nestbox { position: relative; width: 190px; margin-top: 34px; }
  .nimg { display: block; width: 100%; }
  .nfront { position: absolute; inset: 0; width: 100%; pointer-events: none; clip-path: polygon(0.0% 37.6%, 21.5% 37.6%, 21.7% 40.2%, 22.5% 42.8%, 23.7% 45.3%, 25.4% 47.6%, 27.5% 49.8%, 30.0% 51.8%, 32.8% 53.5%, 36.0% 54.9%, 39.4% 56.1%, 43.0% 56.9%, 46.7% 57.4%, 50.5% 57.6%, 54.2% 57.4%, 58.0% 56.9%, 61.6% 56.1%, 65.0% 54.9%, 68.1% 53.5%, 71.0% 51.8%, 73.5% 49.8%, 75.6% 47.6%, 77.2% 45.3%, 78.5% 42.8%, 79.2% 40.2%, 79.4% 37.6%, 100.0% 37.6%, 100.0% 100.0%, 0.0% 100.0%); }
  .egg { position: absolute; left: 26.4%; bottom: 30%; width: 48%; transform-origin: 50% 94%; filter: drop-shadow(0 4px 5px rgba(60, 30, 0, .3)); }
  .eshadow { position: absolute; left: 50.5%; top: 55%; width: 46%; height: 13%; transform: translate(-50%, -50%); border-radius: 50%; background: radial-gradient(closest-side, rgba(70, 35, 0, .55), rgba(70, 35, 0, .25) 60%, rgba(70, 35, 0, 0)); pointer-events: none; }
  .ready .egg { animation: wobble .7s ease-in-out infinite; }
  .ready .eshadow { animation: shwob .7s ease-in-out infinite; }
  .ready { box-shadow: 0 0 0 4px #ffd36b, 0 0 30px #ffd36b; }
  .egg.gone, .eshadow.gone { opacity: 0; transition: opacity .2s; }
  /* rocking in the nest: it tips about its bottom, and its shadow slides a little the other way */
  @keyframes wobble { 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
  @keyframes shwob { 25% { transform: translate(-46%, -50%) scaleX(.94); } 75% { transform: translate(-54%, -50%) scaleX(.94); } }
  .lab { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .lab b { font: 600 18px var(--font-ui); color: var(--ink2); }
  .lab span { font: 700 13px var(--font-body); color: var(--muted); }
  .bar { width: 80%; height: 12px; border-radius: 999px; background: var(--bg2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ffb52e, #ff7ab8); }
  .hatch { font-size: 20px; animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.06); } }
  .waiting { display: flex; width: fit-content; align-items: center; justify-content: center; gap: 6px; margin: 10px auto 0; padding: 2px 14px 2px 16px; border-radius: 999px; background: rgba(255, 255, 255, .9); font: 700 14px var(--font-body); color: var(--ink2); }
  .waiting img { width: 40px; }
  .how { margin: 12px auto 16px; width: min(820px, 94vw); padding: 0; display: grid; grid-template-columns: 220px 1fr; overflow: hidden; }
  .howpic { background-size: cover; background-position: center; min-height: 170px; }
  .howtext { padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; }
  .howtext h3 { margin: 0; font-size: 22px; }
  .howtext ol { margin: 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; }
  .howtext li { font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .how p { margin: 0; font: 600 14px/1.4 var(--font-body); color: var(--ink2); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .small { font-size: 12px !important; }
  .showing .nests, .showing .how, .showing .waiting { opacity: 0; pointer-events: none; transition: opacity .3s; }
  /* a short laptop screen (1280 x 720): the nests and the how-to card closer together, so the card fits */
  @media (max-height: 800px) and (min-width: 761px) {
    .stagebox { min-height: 70px; }
    .nestbox { width: 160px; margin-top: 22px; }
    .slot { width: 210px; padding: 8px 10px 10px; }
    .waiting { margin-top: 6px; } .waiting img { width: 32px; }
    .how { margin: 8px auto 10px; grid-template-columns: 170px 1fr; }
    .howpic { min-height: 0; }
    .howtext { padding: 8px 16px; gap: 5px; }
    .howtext h3 { font-size: 19px; }
    .howtext li { font-size: 14.5px; line-height: 1.3; }
  }
  @media (max-width: 760px) {
    .slot { width: 30%; min-width: 104px; padding: 6px 4px 10px; border-radius: 18px; }
    .nestbox { width: 100%; margin-top: 22px; }
    .lab b { font-size: 13px; text-align: center; } .lab span { font-size: 11px; text-align: center; }
    .nests { gap: 6px; padding: 0 6px; }
    .hatch { font-size: 15px; padding: 6px 10px; }
    .how { grid-template-columns: 1fr; } .howpic { min-height: 130px; }
  }
</style>
