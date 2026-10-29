<script lang="ts">
  // The incubator: three warm nests. Eggs come from battles (and the shop), and they hatch from right
  // answers in practice: every math answer, every five typed letters, every playground game. A ready egg
  // wobbles; tap Hatch and it cracks open, and the Glimmer inside stands on its stone in a beam of light.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { GlimmerShow } from '../three/glimmerShow';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { GLIMMER, RARITY, rarityRank } from '../adventure/glimmers';
  import { advOf, hatch, EGG_ODDS, type Hatch, advView } from '../adventure/state';
  import Header from '../ui/Header.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import Confetti from '../ui/Confetti.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  let scene: GlimmerShow | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  let cracking = $state(-1); let cracks = $state(0);
  let got = $state<Hatch | null>(null);
  let burst = $state(0);

  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.15, bottom: 0.6, left: 0.2, right: 0.8 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const sc = await GlimmerShow.create(viewOf(), 'village');
    if (disposed) { sc.dispose(); return; }
    scene = sc; stage.use(sc);
    requestAnimationFrame(onResize);
  });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  async function doHatch(slot: number) {
    if (cracking >= 0) return;
    cracking = slot; cracks = 0; got = null;
    for (let i = 1; i <= 3; i++) { await wait(520); cracks = i; sfx.crack(); }
    await wait(450);
    let h: Hatch | null = null;
    game.update(pp => { h = hatch(pp, slot); });
    cracking = -1;
    const res = h as Hatch | null;
    if (!res) return;
    got = res;
    sfx.reveal(rarityRank(res.rarity)); burst++;
    scene?.show(res.id, true);
  }
  function goPractice(kind: 'math' | 'typing') {
    if (kind === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p)).id); }
  }
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
</script>

<div class="screen eggs" class:showing={!!got}>
  <Header title="Eggs" back={() => game.go('adventure')} sub="They hatch into new Glimmers" />
  <div class="stagebox" bind:this={stageEl}></div>

  <div class="nests">
    {#each a.incubator as e, i}
      <div class="slot" class:ready={e && e.have >= e.need} class:cracking={cracking === i}>
        <img class="nimg" src="{base}game/nest.webp" alt="" />
        {#if e}
          <div class="eggw">
            <img class="egg r-{e.rarity}" src="{base}game/egg-{e.rarity}.webp" alt="{RARITY[e.rarity].name} egg" />
            {#if cracking === i}<svg class="cr" viewBox="0 0 100 120"><path d="M50 10 L44 34 L56 46 L46 66" style:opacity={cracks >= 1 ? 1 : 0} /><path d="M56 46 L70 58 L64 78" style:opacity={cracks >= 2 ? 1 : 0} /><path d="M46 66 L30 74 L36 96 M64 78 L58 100" style:opacity={cracks >= 3 ? 1 : 0} /></svg>{/if}
          </div>
          <div class="lab">
            <b style:color={RARITY[e.rarity].color}>{RARITY[e.rarity].name} egg</b>
            {#if e.have >= e.need}<button class="btn btn-primary hatch" onclick={() => doHatch(i)} disabled={cracking >= 0}>Hatch!</button>
            {:else}<div class="bar"><i style:width="{(e.have / e.need) * 100}%"></i></div><span>{e.need - e.have} more right answers to hatch</span>{/if}
          </div>
        {:else}<div class="lab"><span>Empty nest</span></div>{/if}
      </div>
    {/each}
  </div>
  {#if a.nest.length}
    <div class="waiting"><span>Waiting in the nest:</span>{#each a.nest as e}<img src="{base}game/egg-{e.rarity}.webp" alt="{RARITY[e.rarity].name} egg" title="{RARITY[e.rarity].name} egg" />{/each}</div>
  {/if}
  <div class="how card">
    <p><b>Eggs hatch into new Glimmers!</b> Warm them up by practicing: every right answer on a math trip, every word typed in a typing lesson, and every playground game counts. When an egg's bar is full, tap Hatch.</p>
    <p class="muted">You get eggs from battles (always from a Perfect Cheer or a Champion) and from the shop.</p>
    <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math practice</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing practice</button><button class="btn" onclick={() => game.go('playground')}>Playground</button></div>
    <p class="muted small">Eggs from battles: {EGG_ODDS}</p>
  </div>

  {#if got}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hatched r-{got.rarity}" onclick={() => (got = null)}>
      <div class="rt"><small>It hatched!</small><b>{RARITY[got.rarity].name}</b></div>
      <div class="flip"><GlimmerCard id={got.id} width={190} level={got.level} shine /></div>
      <div class="msg card"><h2>{GLIMMER[got.id].name}{got.isNew ? ' joined your team!' : ''}</h2><p>{got.isNew ? `${GLIMMER[got.id].power.name}: ${GLIMMER[got.id].power.text(1)}` : `You have one already: stardust! ${GLIMMER[got.id].name} is level ${got.level}.`}</p><small>Tap to close</small></div>
    </div>
  {/if}
  <Confetti {burst} count={90} x={50} y={30} spread={1.6} />
</div>

<style>
  .eggs { display: flex; flex-direction: column; background: transparent; }
  .stagebox { flex: 1; min-height: 160px; }
  .nests { display: flex; gap: 18px; justify-content: center; padding: 0 16px; flex-wrap: wrap; }
  .slot { position: relative; width: 230px; display: flex; flex-direction: column; align-items: center; background: rgba(255, 255, 255, .9); border-radius: 26px; padding: 10px 10px 14px; box-shadow: 0 14px 30px -16px rgba(40, 20, 80, .55); }
  .nimg { width: 190px; margin-top: 70px; }
  .eggw { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); width: 108px; }
  .egg { width: 108px; filter: drop-shadow(0 8px 10px rgba(0, 0, 0, .3)); }
  .ready .egg { animation: wobble .7s ease-in-out infinite; }
  .ready { box-shadow: 0 0 0 4px #ffd36b, 0 0 30px #ffd36b; }
  .cracking .egg { animation: shake .18s linear infinite; }
  @keyframes wobble { 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }
  @keyframes shake { 25% { transform: translateX(-4px) rotate(-4deg); } 75% { transform: translateX(4px) rotate(4deg); } }
  .cr { position: absolute; inset: 0; width: 100%; height: 100%; }
  .cr path { fill: none; stroke: #3a2a1a; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; transition: opacity .1s; filter: drop-shadow(0 0 3px #fff); }
  .lab { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 100%; }
  .lab b { font: 600 18px var(--font-ui); }
  .lab span { font: 700 13px var(--font-body); color: var(--muted); }
  .bar { width: 80%; height: 12px; border-radius: 999px; background: var(--bg2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ffb52e, #ff7ab8); }
  .hatch { font-size: 20px; animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.06); } }
  .waiting { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 10px; font: 700 14px var(--font-body); color: var(--ink2); }
  .waiting img { width: 40px; }
  .how { margin: 12px auto 16px; width: min(760px, 94vw); padding: 12px 18px; display: flex; flex-direction: column; gap: 8px; }
  .how p { margin: 0; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .small { font-size: 12px !important; }
  .showing .nests, .showing .how, .showing .waiting { opacity: 0; pointer-events: none; transition: opacity .3s; }
  .hatched { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 10px; padding-bottom: 6vh; background: linear-gradient(transparent 40%, rgba(30, 20, 60, .5)); cursor: pointer; }
  .rt { text-align: center; animation: pop .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  .rt small { display: block; font: 600 22px var(--font-ui); color: #fff; text-shadow: 0 2px 8px rgba(0, 0, 0, .5); }
  .rt b { font: 600 clamp(46px, 8vw, 84px)/1 var(--font-ui); color: var(--rc); -webkit-text-stroke: 3px #fff; paint-order: stroke; text-shadow: 0 6px 0 rgba(0, 0, 0, .25), 0 0 40px var(--rc); }
  .r-common { --rc: #7d8494; } .r-uncommon { --rc: #3fbf73; } .r-rare { --rc: #2f8ef0; } .r-epic { --rc: #a061f0; } .r-legendary { --rc: #f0b21f; } .r-mythic { --rc: #ff5fb0; }
  .flip { animation: flip .9s .2s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes flip { from { opacity: 0; transform: perspective(800px) rotateY(180deg) scale(.5); } }
  @keyframes pop { from { opacity: 0; transform: scale(.4); } }
  .msg { padding: 10px 18px; text-align: center; max-width: 520px; }
  .msg h2 { margin: 0; font-size: 24px; } .msg p { margin: 4px 0; font-weight: 600; color: var(--ink2); } .msg small { color: var(--muted); font-weight: 700; }
  @media (max-width: 760px) {
    .slot { width: 30%; min-width: 104px; padding: 6px 4px 10px; border-radius: 18px; }
    .nimg { width: 100%; margin-top: 46px; }
    .eggw, .egg { width: 64px; }
    .lab b { font-size: 13px; text-align: center; } .lab span { font-size: 11px; text-align: center; }
    .nests { gap: 6px; padding: 0 6px; }
    .hatch { font-size: 15px; padding: 6px 10px; }
  }
</style>
