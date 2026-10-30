<script lang="ts">
  // The Typing page: the four ways to play typing as big tabs (Learn, Practice, Games, Adventure, from
  // subjects.ts) with the islands as chips under them (Home row, Top row...). Practice is the map: each
  // island's lessons on a trail. Learn is the lessons that bring new keys (the finger coach shows each
  // reach first); Games and Adventure are pages of picture cards (ui/WayPane.svelte).
  import { onMount, tick } from 'svelte';
  import { game } from '../state/game.svelte';
  import { outfitOf } from '../engine/profile';
  import { MOVE_WORD, REGIONS, lessonMove, lessonTitle, type Lesson } from '../engine/course';
  import { isUnlocked, nextLesson, passed, regionUnlocked, totalStars } from '../engine/profile';
  import { rideName } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { sfx } from '../audio/sound';
  import TopBar from '../ui/TopBar.svelte';
  import WaysBar from '../ui/WaysBar.svelte';
  import ChipRow from '../ui/ChipRow.svelte';
  import WayPane from '../ui/WayPane.svelte';
  import { SUBJECT, wayCount, type WayId } from '../subjects';
  import { chipOf, setChip, wayOf } from '../nav';

  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Icon from '../ui/Icon.svelte';

  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const next = $derived(nextLesson(p));
  const stars = $derived(totalStars(p));
  let scroller: HTMLDivElement | undefined = $state();
  const S = SUBJECT.typing;
  // which way to play is showing (Practice unless picked), and which island (a chip: 'all', or a region)
  let way = $state<WayId>(wayOf('typing'));
  let chip = $state(chipOf('typing'));
  const regions = $derived(chip === 'all' ? REGIONS : REGIONS.filter(r => r.id === chip));
  function pickWay(w: WayId) { way = w; game.way = { ...game.way, typing: w }; scroller?.scrollTo({ top: 0 }); }
  function pickChip(id: string) { chip = id; setChip('typing', id); scroller?.scrollTo({ top: 0 }); }

  const PRACTICE_ICON: Record<string, 'book' | 'bulb' | 'target' | 'clock' | 'pencil'> = { story: 'book', facts: 'bulb', weak: 'target', sprint: 'clock', custom: 'pencil' };

  function nodePos(i: number, n: number) {
    const x = 7 + (i * 86) / Math.max(1, n - 1);
    const y = i % 2 ? 64 : 38;
    return { x, y };
  }
  function pathD(n: number) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const { x, y } = nodePos(i, n);
      if (i === 0) d += `M${x},${y}`;
      else {
        const prev = nodePos(i - 1, n);
        const mx = (prev.x + x) / 2;
        d += ` C${mx},${prev.y} ${mx},${y} ${x},${y}`;
      }
    }
    return d;
  }
  function start(l: Lesson) {
    if (!isUnlocked(p, l)) {
      sfx.nope();
      game.say(l.requires ? 'Keep going on the trail to open this one!' : 'Finish the lesson before this one first!');
      return;
    }
    sfx.click();
    if (l.kind === 'custom' && !p.customText.trim()) {
      game.say('Ask a grown-up to add your words in Grown-ups first!');
      return;
    }
    game.startLesson(l.id);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if ((e.key === 'Enter' || e.key === ' ') && way === 'practice') { e.preventDefault(); start(next); }
    if (e.key === 'Escape') { if (chip !== 'all') pickChip('all'); else game.go('hub'); }
  }
  onMount(async () => {
    await tick();
    const el = chip === 'all' ? scroller?.querySelector(`[data-region="${next.region}"]`) as HTMLElement | null : null;
    if (el && scroller) scroller.scrollTo({ top: Math.max(0, el.offsetTop - scroller.offsetTop - 16), behavior: 'instant' as ScrollBehavior });
  });
</script>

<svelte:window onkeydown={onKey} />

<div class="screen map">
  <TopBar />
  <WaysBar subject={S} {way} onpick={pickWay}>
    {#snippet right()}<span class="pill stars" title="Typing stars"><Stars n={1} of={1} size={20} /> <b>{stars}</b></span>{/snippet}
  </WaysBar>
  {#if wayCount(S, way)}<ChipRow chips={S.chips} {chip} onpick={pickChip} label="Which island" />{/if}

  <div class="scroller scroll" bind:this={scroller}>
    {#if way !== 'practice'}
      <WayPane subject={S} {way} {chip} />
    {:else}
    {#each regions as r (r.id)}
      {@const ri = REGIONS.indexOf(r)}
      {@const open = regionUnlocked(p, r.id)}
      {@const done = r.lessons.filter(l => passed(p, l.id)).length}
      <section class="region" class:locked={!open} data-region={r.id}>
        <div class="art" style:background-image="url({import.meta.env.BASE_URL}regions/{r.id}.webp)"></div>
        <div class="rhead">
          <div>
            <h2>{r.name}</h2>
            <p>{r.blurb}</p>
          </div>
          <div class="count">{done}/{r.lessons.length}</div>
        </div>
        <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={pathD(r.lessons.length)} fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85" />
          <path d={pathD(r.lessons.length)} fill="none" stroke="rgba(120,90,190,.35)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        {#each r.lessons as l, i (l.id)}
          {@const pos = nodePos(i, r.lessons.length)}
          {@const unlocked = isUnlocked(p, l)}
          {@const rec = p.lessons[l.id]}
          {@const isNext = l.id === next.id}
          {@const mv = lessonMove(l)}
          <button class="node" class:locked={!unlocked} class:next={isNext} class:done={passed(p, l.id)} class:practice={l.practice} class:check={l.kind === 'checkpoint'}
            style:left="{pos.x}%" style:top="{pos.y}%" onclick={() => start(l)} title={lessonTitle(l, game.layout)}>
            <span class="disc">
              {#if !unlocked}<Icon name="lock" />
              {:else if l.practice}<Icon name={PRACTICE_ICON[l.kind] ?? 'book'} />
              {:else if l.kind === 'checkpoint'}<Icon name="flag" />
              {:else}{l.n}{/if}
            </span>
            {#if rec && rec.bestRide > 0}<span class="ride" title="Best: {rideName(rec.bestRide, mv)}"><svg viewBox="0 0 48 48">{@html rideIcon(rec.bestRide, '#fff', mv)}</svg></span>{/if}
            <span class="lbl">{lessonTitle(l, game.layout)}</span>
            {#if !l.practice}<span class="mv mv-{mv}" title="{MOVE_WORD[mv]}"><Icon name={mv} size={15} /> {MOVE_WORD[mv]}</span>{/if}
            {#if !l.practice}<span class="starplate" class:none={!(rec?.stars)} title="{rec?.stars ?? 0} of 3 stars"><Stars n={rec?.stars ?? 0} size={17} /></span>{#if rec?.platinum}<span class="plat" title="Platinum"><Icon name="gem" size={16} /></span>{/if}{/if}
            {#if isNext}<span class="buddy"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={70} mood="dance" /></span>{/if}
          </button>
        {/each}
        {#if !open}<div class="lockveil"><Icon name="lock" /> Finish {REGIONS[ri - 1]?.name} to open</div>{/if}
      </section>
    {/each}
    {/if}
    <div class="endpad"></div>
  </div>

  {#if way === 'practice'}
  <div class="go">
    <button class="btn btn-primary btn-big" onclick={() => start(next)}>
      {passed(p, 'village-1') ? 'Keep going' : 'Start your adventure'}: {lessonTitle(next, game.layout)} <span class="kbd">enter</span>
    </button>
  </div>
  {/if}
</div>

<style>
  .map { display: flex; flex-direction: column; background: linear-gradient(#cfe9fa, #eaf6ff 60%, #f3f9ff); }
  .pill { display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, .9); padding: 5px 12px; border-radius: 999px; font: 700 15px var(--font-body); color: var(--ink2); white-space: nowrap; }
  .pill b { font: 600 19px var(--font-ui); color: var(--ink); }
  .scroller { flex: 1; min-height: 0; padding: 8px 22px 120px; display: flex; flex-direction: column; gap: 22px; }
  .region { position: relative; flex: none; height: clamp(300px, 46vh, 420px); border-radius: 28px; overflow: hidden; box-shadow: var(--shadow); border: var(--panel-border); }
  .region .art { position: absolute; inset: 0; background: linear-gradient(#bfe3f7, #dff3d6) center / cover no-repeat; }
  .region.locked .art { filter: grayscale(.7) brightness(1.05); opacity: .7; }
  .rhead { position: absolute; left: 18px; top: 14px; right: 18px; display: flex; justify-content: space-between; align-items: flex-start; z-index: 2; pointer-events: none; }
  .rhead > div:first-child { background: rgba(255, 255, 255, .9); padding: 10px 16px; border-radius: 18px; box-shadow: var(--shadow-sm); }
  .rhead h2 { font-size: 26px; }
  .rhead p { margin: 2px 0 0; font: 600 14px var(--font-body); color: var(--muted); }
  .count { background: rgba(255, 255, 255, .9); padding: 8px 14px; border-radius: 999px; font: 600 18px var(--font-ui); }
  .path { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
  .node { position: absolute; transform: translate(-50%, -30%); z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: 0; cursor: pointer; padding: 0; width: 110px; }
  .disc { width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; font: 600 26px/1 var(--font-ui); color: var(--ink); background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 5px 0 #d9cff0, 0 10px 18px -8px rgba(60, 40, 110, .5); border: 4px solid #fff; transition: transform .15s; }
  .node:hover .disc { transform: translateY(-3px) scale(1.05); }
  .node.done .disc { background: linear-gradient(#a8f0cf, var(--mint)); box-shadow: 0 5px 0 var(--mint-edge), 0 10px 18px -8px rgba(40, 120, 90, .5); color: #0f4a36; }
  .node.check .disc { width: 72px; height: 72px; background: linear-gradient(#fff3b8, var(--lemon)); box-shadow: 0 5px 0 #e2c63a, 0 10px 18px -8px rgba(150, 110, 20, .5); }
  .node.check.done .disc { background: linear-gradient(#fff0a0, var(--star)); }
  .node.practice .disc { background: linear-gradient(#e9e0ff, var(--lilac)); box-shadow: 0 5px 0 #8f75d6; color: #fff; }
  .node.next .disc { animation: pulse-ring 1.4s ease-out infinite; background: linear-gradient(var(--primary-hi), var(--primary)); color: #fff; box-shadow: 0 5px 0 var(--primary-edge); }
  .node.locked .disc { background: #ece8f3; color: #b4abc7; box-shadow: 0 4px 0 #d8d2e3; }
  .node.locked .lbl { opacity: .6; }
  /* the stars won at a stop, on a solid plaque so they read on any painting */
  .starplate { display: inline-flex; align-items: center; padding: 2px 7px 3px; margin-top: 2px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 2px #ffd34d, 0 3px 0 #e8b92c, 0 6px 12px -4px rgba(40, 20, 60, .45); }
  .starplate.none { box-shadow: 0 0 0 2px #e6e0f0, 0 3px 0 #d6cfe4, 0 6px 12px -4px rgba(40, 20, 60, .35); }
  .starplate :global(img:not(.on)) { filter: grayscale(1) brightness(.85) opacity(.55); }
  .lbl { font: 700 13px/1.15 var(--font-body); color: var(--ink); background: rgba(255, 255, 255, .88); padding: 3px 8px; border-radius: 10px; margin-top: 4px; max-width: 120px; text-align: center; }
  /* how the lesson moves (the trail, or a climb, a swim or a sled run), as on the math map */
  .mv { display: inline-flex; align-items: center; gap: 3px; font: 700 11px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 1px 7px 1px 3px; margin-top: 2px; }
  .mv-climb { color: #b4561a; } .mv-swim { color: #13786c; } .mv-slide { color: #2f63bd; }
  .ride { position: absolute; top: -6px; right: 18px; width: 28px; height: 28px; border-radius: 50%; background: var(--primary); display: grid; place-items: center; box-shadow: 0 0 0 3px #fff; }
  .ride svg { width: 18px; height: 18px; }
  .buddy { position: absolute; left: -46px; top: -30px; pointer-events: none; }
  .lockveil { position: absolute; inset: 0; z-index: 4; display: flex; align-items: center; justify-content: center; gap: 10px; font: 600 22px var(--font-ui); color: var(--ink2); background: rgba(250, 248, 255, .35); }
  .endpad { height: 40px; flex: none; }
  .go { position: absolute; bottom: 22px; left: 0; right: 0; margin: 0 auto; width: max-content; z-index: 6; }
  .go .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 11px; height: 22px; }
  .plat { position: absolute; right: 6px; top: 2px; font: 800 13px/1 var(--font-body); color: #7c5cf5; text-shadow: 0 0 6px #fff, 0 0 2px #fff; }

  @media (max-width: 760px) {
    /* the lesson stops: smaller, and the regions taller so the two rows of stops don't run into each other;
       only the climb, swim and sled stops keep their chip (the trail is the usual way) */
    .scroller { padding: 6px 12px 110px; gap: 16px; }
    .region { height: 480px; }
    .rhead h2 { font-size: 21px; }
    .node { width: 70px; }
    .disc { width: 48px; height: 48px; font-size: 21px; border-width: 3px; }
    .node.check .disc { width: 56px; height: 56px; }
    .lbl { font-size: 11px; max-width: 68px; padding: 2px 4px; }
    .mv { font-size: 10px; padding: 1px 5px; }
    .mv-run { display: none; }
    .starplate { padding: 1px 5px 2px; }
    .starplate :global(.stars) { --sz: 13px !important; }
    .ride { width: 22px; height: 22px; top: -6px; right: 4px; }
    .ride svg { width: 14px; height: 14px; }
    .buddy { display: none; }
  }
</style>
