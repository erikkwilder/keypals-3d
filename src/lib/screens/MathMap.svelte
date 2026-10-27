<script lang="ts">
  // Math home: the Times Trail. One region per table, each on one of the islands, four stops each:
  // meet the table, practise, mix, and the checkpoint run (open from the start, to test out).
  import { onMount, tick } from 'svelte';
  import { game } from '../state/game.svelte';
  import { outfitOf, palOf, todayMs } from '../engine/profile';
  import { DANCES } from '../engine/rewards';
  import { levelFromXp } from '../engine/stickers';
  import { RIDES } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { sfx } from '../audio/sound';
  import { PLACEMENTS, STRANDS, STRAND, groupFacts, regionsOf, type MathLesson, type MathRegion } from '../math/course';
  import type { Op } from '../math/facts';
  import { ALL_GARDEN_IDS, mathMovedOn, mathOf, mathPassed, mathRegionOpen, mathStarsTotal, mathUnlocked, nextMathLesson, stageCounts } from '../math/progress';
  import { factId } from '../math/facts';
  import Flower from '../math/ui/Flower.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Ring from '../ui/Ring.svelte';
  import Icon from '../ui/Icon.svelte';

  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const look = $derived(p.settings.look);
  // which strand is showing: the one played last (or picked here)
  let op = $state<Op>(mathOf(game.profile!).strand ?? 'x');
  const strand = $derived(STRAND[op]);
  const regions = $derived(regionsOf(op));
  const placement = $derived(PLACEMENTS[op]);
  const next = $derived(nextMathLesson(m, op));
  const stars = $derived(mathStarsTotal(m));
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const dancesOpen = $derived(DANCES.filter(d => d.level <= levelFromXp(palOf(p).xp).level).length);
  const fresh = $derived(m.totals.trips === 0);
  let scroller: HTMLDivElement | undefined = $state();
  let sw = $state(1280);
  const tile = $derived(sw < 760 ? 'sm' : 'md');

  const KIND_ICON: Record<string, 'bulb' | 'target' | 'flag' | 'book'> = { meet: 'bulb', practice: 'target', mix: 'book', check: 'flag', rules: 'bulb' };

  function nodePos(i: number, n: number) {
    return { x: 13 + (i * 74) / Math.max(1, n - 1), y: i % 2 ? 70 : 50 };
  }
  function pathD(n: number) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const { x, y } = nodePos(i, n);
      if (i === 0) d += `M${x},${y}`;
      else { const pr = nodePos(i - 1, n), mx = (pr.x + x) / 2; d += ` C${mx},${pr.y} ${mx},${y} ${x},${y}`; }
    }
    return d;
  }
  /** a region's facts in bloom, of all of them */
  const regionFacts = (r: MathRegion) => r.groups.flatMap(groupFacts);
  const bloomed = (r: MathRegion) => regionFacts(r).filter(f => (m.facts[factId(f)]?.stage ?? 0) === 3).length;
  function pickStrand(o: Op) { if (o === op) return; sfx.click(); op = o; game.update(pp => { pp.math = { ...mathOf(pp), strand: o }; }); scroller?.scrollTo({ top: 0 }); }

  function start(l: MathLesson) {
    if (!mathUnlocked(m, l)) {
      sfx.miss();
      game.say(l.n > 1 ? 'Finish the stop before this one first!' : 'Pass the checkpoint before this one to open it!');
      return;
    }
    sfx.click();
    game.startMath(l.id);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(next); }
    if (e.key === 'Escape') game.go('hub');
  }
  onMount(async () => {
    await tick();
    const reg = next.region === 'start' ? null : scroller?.querySelector(`[data-region="${next.region}"]`) as HTMLElement | null;
    if (reg && scroller && next.n !== 1) scroller.scrollTo({ top: Math.max(0, reg.offsetTop - scroller.offsetTop - 16), behavior: 'instant' as ScrollBehavior });
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="screen map" bind:clientWidth={sw}>
  <header class="bar">
    <NavTile size={tile} tone="sky" kind="home" label="Home" title="Home: pick Typing or Math" onclick={() => game.go('hub')} />
    <h1 class="subj">Math</h1>
    <div class="pill stars"><Stars n={1} of={1} size={20} /> <b>{stars}</b></div>
    <div class="pill goal" title="Today's practice goal (typing and math together)">
      <Ring value={Math.min(1, today / goalMs)} size={30} color="var(--mint)" />
      <span><b>{Math.floor(today / 60000)}</b>/{p.settings.dailyGoalMin} min</span>
    </div>
    <div class="spacer"></div>
    <div class="navs">
      <NavTile size={tile} tone="mint" label="Garden" title="Fact Garden: every fact you know" badge={blooms || ''} onclick={() => game.go('garden')}>
        {#snippet art()}<Flower stage={3} size={tile === 'sm' ? 38 : 58} hue={320} />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="pink" label="Keypals" title="Keypals: pick your buddy and outfits" onclick={() => game.openCloset('outfits')}>
        {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={tile === 'sm' ? 40 : 62} round />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="lilac" kind="dances" label="Dances" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />
      <NavTile size={tile} tone="sky" kind="medals" label="Medals" badge={palOf(p).medalsTotal || ''} onclick={() => game.openStickers('medals')} />
    </div>
    <FancyAntButton variant="round" />
    <GearButton size={44} />
  </header>

  <div class="scroller scroll" bind:this={scroller}>
    <section class="intro">
      <div class="strands" role="tablist" aria-label="Which kind of math">
        {#each STRANDS as st (st.op)}
          <button role="tab" aria-selected={st.op === op} class:on={st.op === op} style:--sc={st.color} onclick={() => pickStrand(st.op)}>
            <span class="ssign">{st.op === 'x' ? '×' : st.op === '-' ? '−' : st.op === '/' ? '÷' : '+'}</span><span class="sname">{st.name}</span>
          </button>
        {/each}
      </div>
      <div class="hello">
        <h1 style:color={strand.color}>{strand.name}</h1>
        <p>{strand.blurb}</p>
      </div>
      <button class="placement" class:done={mathPassed(m, placement.id) || (m.lessons[placement.id]?.finishes ?? 0) > 0} onclick={() => start(placement)}>
        <span class="pdisc"><Icon name="flag" /></span>
        <span class="ptext"><b>{placement.title}</b><small>{fresh ? 'Know some already? A quick mix shows where to start.' : 'A quick mix of everything. Skips you ahead.'}</small></span>
      </button>
    </section>

    {#each regions as r, ri (r.id)}
      {@const open = mathRegionOpen(m, r.id)}
      {@const done = r.lessons.filter(l => mathMovedOn(m, l)).length}
      <section class="region" class:locked={!open} data-region={r.id}>
        <div class="art" style:background-image="url({import.meta.env.BASE_URL}regions/{r.world}.webp)"></div>
        <div class="rhead">
          <div class="rname">
            <span class="tbl" style:background={strand.color}>{r.chip}</span>
            <div><h2>{r.name}</h2><p>{r.blurb}</p></div>
          </div>
          <div class="count" title="Facts in bloom">{bloomed(r)}/{regionFacts(r).length} <span class="flower">✿</span></div>
        </div>
        <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={pathD(r.lessons.length)} fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85" />
          <path d={pathD(r.lessons.length)} fill="none" stroke="rgba(120,90,190,.35)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        {#each r.lessons as l, i (l.id)}
          {@const pos = nodePos(i, r.lessons.length)}
          {@const unlocked = mathUnlocked(m, l)}
          {@const rec = m.lessons[l.id]}
          {@const isNext = l.id === next.id}
          <button class="node" class:locked={!unlocked} class:next={isNext} class:done={mathMovedOn(m, l)} class:check={l.kind === 'check'}
            style:left="{pos.x}%" style:top="{pos.y}%" onclick={() => start(l)} title={l.title}>
            <span class="disc">{#if !unlocked}<Icon name="lock" />{:else}<Icon name={KIND_ICON[l.kind] ?? 'book'} />{/if}</span>
            {#if rec && rec.bestRide > 0}<span class="ride" title="Best ride: {RIDES[rec.bestRide].name}"><svg viewBox="0 0 48 48">{@html rideIcon(rec.bestRide, '#fff')}</svg></span>{/if}
            <span class="lbl">{l.title}</span>
            <Stars n={rec?.stars ?? 0} size={14} />
            {#if isNext}<span class="buddy"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={64} mood="dance" /></span>{/if}
          </button>
        {/each}
        {#if !open}<div class="lockveil"><Icon name="lock" /> Pass {regions[ri - 1]?.name} to open</div>{/if}
        {#if done === r.lessons.length}<div class="donebadge">Done!</div>{/if}
      </section>
    {/each}
    <div class="endpad"></div>
  </div>

  <div class="go">
    <button class="btn btn-primary btn-big" onclick={() => start(next)}>
      {fresh ? 'Start' : 'Keep going'}: {next.title} <span class="kbd">enter</span>
    </button>
  </div>
</div>

<style>
  .strands { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; margin-bottom: 4px; }
  .strands button { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 8px 16px 8px 8px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: var(--shadow-sm); font: 600 18px var(--font-ui); color: var(--ink2); transition: transform .12s; }
  .strands button:hover { transform: translateY(-2px); }
  .strands button.on { background: var(--sc); color: #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .ssign { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 600 26px/1 var(--font-ui); background: var(--sc); color: #fff; }
  .strands button.on .ssign { background: rgba(255, 255, 255, .25); }
  @media (max-width: 760px) { .strands { gap: 5px; } .strands button { padding: 5px 9px 5px 5px; font-size: 13px; gap: 4px; } .ssign { width: 26px; height: 26px; font-size: 20px; } }
  .subj { font-size: 30px; margin: 0 4px; color: #d8641c; }
  @media (max-width: 760px) { .subj { font-size: 22px; } }
  .map { display: flex; flex-direction: column; background: linear-gradient(#cfe9fa, #eaf6ff 60%, #f3f9ff); }
  .bar { flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 10px 12px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); box-shadow: 0 6px 20px -16px rgba(60, 40, 110, .4); z-index: 5; }
  .me { display: flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; padding: 0 8px 0 0; border-radius: 16px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 22px var(--font-ui); }
  .pill { display: flex; align-items: center; gap: 7px; background: var(--bg2); padding: 6px 12px; border-radius: 999px; font: 700 15px var(--font-body); color: var(--ink2); white-space: nowrap; }
  .pill b { font: 600 20px var(--font-ui); color: var(--ink); }
  .spacer { flex: 1; }
  .navs { display: flex; gap: 10px; }
  .scroller { flex: 1; min-height: 0; padding: 18px 22px 120px; display: flex; flex-direction: column; gap: 22px; }
  .intro { flex: none; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .hello { flex: 1 1 320px; }
  .hello h1 { font-size: clamp(30px, 4vw, 42px); margin: 0; }
  .hello p { margin: 4px 0 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); max-width: 560px; }
  .placement { flex: 0 1 420px; display: flex; align-items: center; gap: 12px; text-align: left; background: #fff; border: var(--panel-border); border-radius: 22px; padding: 12px 18px 12px 12px; box-shadow: var(--shadow-sm); cursor: pointer; transition: transform .15s; }
  .placement:hover { transform: translateY(-2px); }
  .pdisc { flex: none; width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: linear-gradient(#ffe48a, var(--star)); box-shadow: 0 4px 0 #d6ae25; font-size: 24px; }
  .placement.done .pdisc { background: linear-gradient(#a8f0cf, var(--mint)); box-shadow: 0 4px 0 var(--mint-edge); }
  .ptext { display: flex; flex-direction: column; }
  .ptext b { font: 600 20px var(--font-ui); }
  .ptext small { font: 600 14px/1.3 var(--font-body); color: var(--muted); }
  .region { position: relative; flex: none; height: clamp(300px, 44vh, 400px); border-radius: 28px; overflow: hidden; box-shadow: var(--shadow); border: var(--panel-border); }
  .region .art { position: absolute; inset: 0; background: linear-gradient(#bfe3f7, #dff3d6) center / cover no-repeat; }
  .region.locked .art { filter: grayscale(.7) brightness(1.05); opacity: .7; }
  .rhead { position: absolute; left: 16px; top: 14px; right: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; z-index: 2; pointer-events: none; }
  .rname { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, .92); padding: 8px 16px 8px 8px; border-radius: 18px; box-shadow: var(--shadow-sm); min-width: 0; }
  .tbl { flex: none; display: grid; place-items: center; min-width: 54px; height: 54px; padding: 0 10px; white-space: nowrap; border-radius: 16px; font: 600 22px var(--font-ui); color: #fff; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); }
  .rname h2 { font-size: 24px; margin: 0; }
  .rname p { margin: 2px 0 0; font: 600 14px var(--font-body); color: var(--muted); }
  .count { flex: none; background: rgba(255, 255, 255, .92); padding: 8px 14px; border-radius: 999px; font: 600 18px var(--font-ui); white-space: nowrap; }
  .flower { color: #e86fb0; }
  .path { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
  .node { position: absolute; transform: translate(-50%, -30%); z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: 0; cursor: pointer; padding: 0; width: 120px; }
  .disc { width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; font-size: 26px; color: var(--ink); background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 5px 0 #d9cff0, 0 10px 18px -8px rgba(60, 40, 110, .5); border: 4px solid #fff; transition: transform .15s; }
  .node:hover .disc { transform: translateY(-3px) scale(1.05); }
  .node.done .disc { background: linear-gradient(#a8f0cf, var(--mint)); box-shadow: 0 5px 0 var(--mint-edge), 0 10px 18px -8px rgba(40, 120, 90, .5); color: #0f4a36; }
  .node.check .disc { width: 72px; height: 72px; background: linear-gradient(#fff3b8, var(--lemon)); box-shadow: 0 5px 0 #e2c63a, 0 10px 18px -8px rgba(150, 110, 20, .5); }
  .node.check.done .disc { background: linear-gradient(#fff0a0, var(--star)); }
  .node.next .disc { animation: pulse-ring 1.4s ease-out infinite; background: linear-gradient(var(--primary-hi), var(--primary)); color: #fff; box-shadow: 0 5px 0 var(--primary-edge); }
  .node.locked .disc { background: #ece8f3; color: #b4abc7; box-shadow: 0 4px 0 #d8d2e3; }
  .node.locked .lbl { opacity: .6; }
  .lbl { font: 700 13px/1.15 var(--font-body); color: var(--ink); background: rgba(255, 255, 255, .9); padding: 3px 8px; border-radius: 10px; margin-top: 4px; max-width: 124px; text-align: center; }
  .ride { position: absolute; top: -6px; right: 22px; width: 28px; height: 28px; border-radius: 50%; background: var(--primary); display: grid; place-items: center; box-shadow: 0 0 0 3px #fff; }
  .ride svg { width: 18px; height: 18px; }
  .buddy { position: absolute; left: -44px; top: -6px; pointer-events: none; }
  .lockveil { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; gap: 10px; font: 600 22px var(--font-ui); color: var(--ink2); background: rgba(250, 248, 255, .35); text-align: center; padding: 0 20px; }
  .donebadge { position: absolute; right: 16px; bottom: 14px; z-index: 4; font: 600 18px var(--font-ui); background: var(--mint); color: #0f4a36; padding: 6px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .soon { flex: none; margin: 0; text-align: center; font: 700 15px var(--font-body); color: var(--muted); }
  .endpad { height: 40px; flex: none; }
  .go { position: absolute; bottom: 22px; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 32px); z-index: 6; }
  .go .btn { max-width: 100%; }
  .go .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 11px; height: 22px; }

  @media (max-width: 760px) {
    .bar { padding: 8px 12px; gap: 8px; }
    .nm { font-size: 18px; }
    .navs :global(.tile .lbl) { font-size: 12px; }
    .navs { order: 10; width: 100%; justify-content: space-between; }
    .navs :global(.tile) { flex: 1 1 0; min-width: 0; padding: 4px 2px 6px; }
    .scroller { padding: 12px 12px 110px; gap: 16px; }
    .rname h2 { font-size: 19px; }
    .rname p { display: none; }
    .tbl { min-width: 42px; height: 42px; padding: 0 7px; font-size: 16px; border-radius: 12px; }
    .count { font-size: 15px; padding: 6px 10px; }
    .node { width: 84px; }
    .disc { width: 50px; height: 50px; font-size: 22px; }
    .node.check .disc { width: 58px; height: 58px; }
    .lbl { font-size: 11.5px; max-width: 86px; padding: 2px 5px; }
    .buddy { display: none; }
    .go .kbd { display: none; }
    .go .btn { font-size: 18px; padding: 12px 18px; white-space: normal; }
  }
  @media (max-width: 760px) { .pill.goal span { display: none; } }
</style>
