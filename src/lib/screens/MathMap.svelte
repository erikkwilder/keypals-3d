<script lang="ts">
  // Math home: the Times Trail. One region per table, each on one of the islands, four stops each:
  // meet the table, practise, mix, and the checkpoint run (open from the start, to test out). The other
  // areas of K-8 math (fractions first) sit beside the four fact strands with regions of their own.
  import { onMount, tick } from 'svelte';
  import { game } from '../state/game.svelte';
  import { bookView, outfitOf, palOf, todayMs } from '../engine/profile';
  import { DANCES } from '../engine/rewards';
  import { levelFromXp, STICKERS } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { rideName } from '../engine/rides';
  import { rideIcon } from '../art/vehicles';
  import { sfx } from '../audio/sound';
  import { MATH_LESSONS, MOVE_NAME, PLACEMENTS, STRANDS, STRAND, groupFacts, moveOf, regionsOf, type MathLesson, type MathRegion } from '../math/course';
  import { opSign } from '../math/facts';
  import type { Op } from '../math/facts';
  import { ALL_GARDEN_IDS, mathMovedOn, mathOf, mathPassed, mathRegionOpen, mathStarsTotal, mathUnlocked, nextMathLesson, stageCounts } from '../math/progress';
  import { factId } from '../math/facts';
  import NavTile from '../ui/NavTile.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Ring from '../ui/Ring.svelte';
  import Icon from '../ui/Icon.svelte';
  import TileArt from '../ui/TileArt.svelte';
  import { isLearnStop, isLearned, lessonForStop, LESSONS, type Lesson } from '../math/learn';
  import { AREA, AREAS, SKILL } from '../math/skills/registry';
  import { SKILL_LESSONS, SKILL_PLACEMENTS, nextSkillLesson, skillMovedOn, skillPassed, skillRegionOpen, skillRegionsOf, skillUnlocked, type SkillLesson, type SkillRegion } from '../math/skills/course';
  import { keyStage } from '../math/skills/progress';
  import type { AreaId } from '../math/skills/types';
  import { MARKET_LESSON, MARKET_LESSONS } from '../math/market/episodes';
  import MarketEpisode from '../math/market/MarketEpisode.svelte';

  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const look = $derived(p.settings.look);
  // which part of math is showing: one strand, or (null) the five big cards to choose from
  let op = $state<Op | null>(game.mathOp);
  // or one of the other areas (fractions...): its own regions and lessons
  let area = $state<AreaId | null>(game.mathOp ? null : game.mathArea);
  const showing = $derived(op !== null || area !== null);
  const AREA_TABS = AREAS.filter(a => a.live && !a.op);
  const SOON = AREAS.filter(a => !a.live);
  const skillRegions = $derived(area ? skillRegionsOf(area) : []);
  const skillPlacement = $derived(area ? SKILL_PLACEMENTS[area] : undefined);
  const nextSkill = $derived(nextSkillLesson(m, area ?? 'fractions'));
  const areaStars = (a: AreaId) => SKILL_LESSONS.filter(l => l.area === a).reduce((t, l) => t + (m.lessons[l.id]?.stars ?? 0), 0);
  const areaDone = (a: AreaId) => skillRegionsOf(a).filter(r => skillPassed(m, r.lessons.at(-1)!.id)).length;
  const areaFresh = (a: AreaId) => !SKILL_LESSONS.some(l => l.area === a && m.lessons[l.id]);
  /** a skill region's kinds of question (skill and sub) in bloom, of all of them */
  const regionKeys = (r: SkillRegion) => r.skills.flatMap(id => SKILL[id].subs.map(sb => `${id}:${sb.id}`));
  const keysBloomed = (r: SkillRegion) => regionKeys(r).filter(k => keyStage(m, k) === 3).length;
  const strand = $derived(STRAND[op ?? 'x']);
  const regions = $derived(op ? regionsOf(op) : []);
  const placement = $derived(PLACEMENTS[op ?? 'x']);
  const next = $derived(nextMathLesson(m, op ?? m.strand ?? 'x'));
  const strandStars = (o: Op) => MATH_LESSONS.filter(l => l.op === o).reduce((a, l) => a + (m.lessons[l.id]?.stars ?? 0), 0);
  const strandDone = (o: Op) => regionsOf(o).filter(r => mathPassed(m, r.lessons.at(-1)!.id)).length;
  const playStars = $derived(Object.values(m.play ?? {}).reduce((a, r) => a + (r?.stars ?? []).reduce((x, y) => x + (y ?? 0), 0), 0));
  const stars = $derived(mathStarsTotal(m));
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const dancesOpen = $derived(DANCES.filter(d => d.level <= levelFromXp(palOf(p).xp).level).length);
  const fresh = $derived(m.totals.trips === 0);
  // Learn: the lesson to watch before the next stop (if it's a new trick not learned yet)
  const learnedCount = $derived(LESSONS.filter(l => isLearned(m, l.id)).length);
  const learnNext = $derived.by(() => { if (!op || !isLearnStop(next)) return null; const l = lessonForStop(next); return l && !isLearned(m, l.id) ? l : null; });
  function watch(l: Lesson) { sfx.click(); game.openLearn(l.id, 'map'); }
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
  function pickStrand(o: Op | null) { if (o === op && !area) return; sfx.click(); op = o; game.mathOp = o; area = null; game.mathArea = null; if (o) game.update(pp => { pp.math = { ...mathOf(pp), strand: o }; }); scroller?.scrollTo({ top: 0 }); }
  function pickArea(a: AreaId) { if (a === area) return; sfx.click(); area = a; game.mathArea = a; op = null; game.mathOp = null; scroller?.scrollTo({ top: 0 }); }
  function startSkill(l: SkillLesson) {
    if (!skillUnlocked(m, l)) { sfx.nope(); game.say(l.n > 1 ? 'Finish the stop before this one first!' : 'Pass the checkpoint before this one to open it!'); return; }
    sfx.click();
    game.startSkill(l.id);
  }

  function start(l: MathLesson) {
    if (!mathUnlocked(m, l)) {
      sfx.nope();
      game.say(l.n > 1 ? 'Finish the stop before this one first!' : 'Pass the checkpoint before this one to open it!');
      return;
    }
    sfx.click();
    game.startMath(l.id);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if ((e.key === 'Enter' || e.key === ' ') && op) { e.preventDefault(); start(next); }
    else if ((e.key === 'Enter' || e.key === ' ') && area) { e.preventDefault(); startSkill(nextSkill); }
    if (e.key === 'Escape') { if (showing) pickStrand(null); else game.go('hub'); }
  }
  onMount(async () => {
    await tick();
    const nx = area ? nextSkill : next;
    const reg = nx.region === 'start' ? null : scroller?.querySelector(`[data-region="${nx.region}"]`) as HTMLElement | null;
    if (reg && scroller && nx.n !== 1) scroller.scrollTo({ top: Math.max(0, reg.offsetTop - scroller.offsetTop - 16), behavior: 'instant' as ScrollBehavior });
  });
</script>

<svelte:window onkeydown={onKey} />

{#if game.learnOverlay && MARKET_LESSON[game.learnOverlay]}<MarketEpisode lesson={MARKET_LESSON[game.learnOverlay]} onclose={() => (game.learnOverlay = null)} />{/if}

<div class="screen map" bind:clientWidth={sw}>
  <header class="bar">
    <NavTile size={tile} tone="sky" kind="home" label="Home" title="Home: pick Typing or Math" onclick={() => game.go('hub')} />
    <h1 class="subj">Math</h1>
    <div class="pill stars"><Stars n={1} of={1} size={20} /> <b>{stars}</b></div>
    <div class="pill goal" title="Today's practice goal (typing and math together)">
      <Ring value={Math.min(1, today / goalMs)} size={30} color="var(--mint)" />
      <span><b>{Math.floor(today / 60000)}</b>/{p.settings.dailyGoalMin} min today</span>
    </div>
    <div class="spacer"></div>
    <div class="navs">
      <NavTile size={tile} tone="butter" label="Learn" title="Learn: your buddy shows you each trick" badge={learnedCount || ''} onclick={() => game.openLearn(null, 'map')}>
        {#snippet art()}<img class="learnart" src="{import.meta.env.BASE_URL}learn/tile.webp" alt="" style:height={tile === 'sm' ? '40px' : '64px'} />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="mint" label="Garden" title="Fact Garden: every fact you know" badge={blooms || ''} onclick={() => game.go('garden')}>
        {#snippet art()}<TileArt kind="garden" size={tile === 'sm' ? 40 : 62} />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="lilac" label="Arcade" title="Arcade: quick score games on your facts" onclick={() => game.go('arcade')}>
        {#snippet art()}<img class="learnart" src="{import.meta.env.BASE_URL}icons/arcade.webp" alt="" style:height={tile === 'sm' ? '40px' : '62px'} />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="pink" label="Keypals" title="Keypals: pick your buddy and outfits" onclick={() => game.openCloset('outfits')}>
        {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={tile === 'sm' ? 40 : 62} round />{/snippet}
      </NavTile>
      <NavTile size={tile} tone="lilac" kind="dances" label="Dances" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />
      <NavTile size={tile} tone="butter" kind="stickers" label="Stickers" badge={STICKERS.filter(s => bookView(p).stickers[s.id]).length || ''} onclick={() => game.openStickers('stickers')} />
      <NavTile size={tile} tone="sky" kind="medals" label="Medals" badge={MEDALS.filter(m => (bookView(p).medals[m.id] ?? 0) > 0).length || ''} onclick={() => game.openStickers('medals')} />
    </div>
    <FancyAntButton variant="round" />
    <GearButton size={44} />
  </header>

  {#if showing}
    <!-- the strands stay in reach: a row of picture tabs that never scrolls away -->
    <nav class="sbar" aria-label="Which kind of math">
      <button class="sall" onclick={() => pickStrand(null)} title="All of math"><Icon name="map" /><span>All math</span></button>
      {#each STRANDS as st (st.op)}
        <button class="stab" class:on={st.op === op} style:--sc={st.color} onclick={() => pickStrand(st.op)} aria-pressed={st.op === op}>
          <img src="{import.meta.env.BASE_URL}{st.art}" alt="" /><span>{st.name}</span>
        </button>
      {/each}
      {#each AREA_TABS as a (a.id)}
        <button class="stab" class:on={a.id === area} style:--sc={a.color} onclick={() => pickArea(a.id)} aria-pressed={a.id === area}>
          <img src="{import.meta.env.BASE_URL}{a.art}" alt="" /><span>{a.name}</span>
        </button>
      {/each}
      <button class="stab" style:--sc="#f2a63a" onclick={() => { sfx.click(); game.go('playground'); }}>
        <img src="{import.meta.env.BASE_URL}math/strand-playground.webp" alt="" /><span>Playground</span>
      </button>
    </nav>
  {/if}

  <div class="scroller scroll" bind:this={scroller}>
    {#if !showing}
      <section class="choose">
        <h1>What kind of math?</h1>
        <div class="cards">
          {#each STRANDS as st (st.op)}
            {@const nx = nextMathLesson(m, st.op)}
            <article class="scard" style:--sc={st.color}>
              <button class="sart" onclick={() => pickStrand(st.op)} aria-label="Open {st.name}">
                <img src="{import.meta.env.BASE_URL}{st.art}" alt="" />
                <span class="sname2"><span class="sg">{opSign(st.op)}</span>{st.name}</span>
              </button>
              <div class="sinfo">
                <p>{st.blurb}</p>
                <div class="sstat"><span><Stars n={1} of={1} size={15} /><b>{strandStars(st.op)}</b> stars</span><span><b>{strandDone(st.op)}</b>/{regionsOf(st.op).length} islands</span></div>
                <div class="sact"><button class="btn btn-primary" onclick={() => start(nx)}>Play: {nx.title}</button><button class="btn ghost" onclick={() => pickStrand(st.op)}>Map</button></div>
              </div>
            </article>
          {/each}
          {#each AREA_TABS as a (a.id)}
            {@const nx = nextSkillLesson(m, a.id)}
            <article class="scard" style:--sc={a.color}>
              <button class="sart" onclick={() => pickArea(a.id)} aria-label="Open {a.name}">
                <img src="{import.meta.env.BASE_URL}{a.art}" alt="" />
                <span class="sname2"><span class="sg sgt">{skillRegionsOf(a.id)[0]?.chip ?? ''}</span>{a.name}</span>
              </button>
              <div class="sinfo">
                <p>{a.blurb}</p>
                <div class="sstat"><span><Stars n={1} of={1} size={15} /><b>{areaStars(a.id)}</b> stars</span><span><b>{areaDone(a.id)}</b>/{skillRegionsOf(a.id).length} islands</span><span>Grades {a.grades}</span></div>
                <div class="sact"><button class="btn btn-primary" onclick={() => startSkill(nx)}>Play: {nx.title}</button><button class="btn ghost" onclick={() => pickArea(a.id)}>Map</button></div>
              </div>
            </article>
          {/each}
          <article class="scard" style:--sc="#f2a63a">
            <button class="sart" onclick={() => { sfx.click(); game.go('playground'); }} aria-label="Open the Number Playground">
              <img src="{import.meta.env.BASE_URL}math/strand-playground.webp" alt="" />
              <span class="sname2"><span class="sg"><Icon name="star" size={28} /></span>Number Playground</span>
            </button>
            <div class="sinfo">
              <p>Calm games with no clock: number lines, bubbles that make ten, and building with blocks.</p>
              <div class="sstat"><span><Stars n={1} of={1} size={15} /><b>{playStars}</b> stars</span></div>
              <div class="sact"><button class="btn btn-primary" onclick={() => { sfx.click(); game.go('playground'); }}>Play</button></div>
            </div>
          </article>
        </div>
        {#if SOON.length}
          <div class="soonrow"><b>Coming next</b>{#each SOON as a (a.id)}<span class="soonchip" style:--sc={a.color}>{a.name}<small>Grades {a.grades}</small></span>{/each}</div>
        {/if}
        <p class="movenote">Every kind of math has all four ways to move: run the trail, climb the cliff, swim the bay and sled the slope.</p>
      </section>
    {:else if area}
    {@const ar = AREA[area]}
    <section class="intro">
      <div class="hello">
        <h1 style:color={ar.color}>{ar.name}</h1>
        <p>{ar.blurb}</p>
      </div>
      {#if skillPlacement}
        <button class="placement" class:done={skillPassed(m, skillPlacement.id) || (m.lessons[skillPlacement.id]?.finishes ?? 0) > 0} onclick={() => startSkill(skillPlacement!)}>
          <span class="pdisc"><Icon name="flag" /></span>
          <span class="ptext"><b>{skillPlacement.title}</b><small>Know some {ar.name.toLowerCase()} already? A quick mix shows where to start.</small></span>
        </button>
      {/if}
      {#if area === 'fractions'}
        <!-- the fractions arcade game (an Arcade hub can list it too: screen 'pizza') -->
        <button class="placement arcade" onclick={() => { sfx.click(); game.go('pizza'); }}>
          <img src="{import.meta.env.BASE_URL}math/pizza/tile.webp" alt="" />
          <span class="ptext"><b>Pizza Rush</b><small>Arcade: serve fraction pizzas to hungry Glimmers.{(m.arcade?.['pizza-rush']?.best ?? 0) > 0 ? ` Best: ${m.arcade!['pizza-rush'].best}` : ''}</small></span>
        </button>
      {:else if area === 'decimals'}
        <!-- the money arcade game (the Arcade hub has its cabinet too: screen 'market') -->
        <button class="placement arcade" onclick={() => { sfx.click(); game.go('market'); }}>
          <img src="{import.meta.env.BASE_URL}math/market/tile.webp" alt="" />
          <span class="ptext"><b>Market Dash</b><small>Arcade: pay and give change to Glimmer shoppers.{(m.arcade?.['market-dash']?.best ?? 0) > 0 ? ` Best: ${m.arcade!['market-dash'].best}` : ''}</small></span>
        </button>
        <!-- the money Learn episodes, at the sky market (open over the map: game.learnOverlay) -->
        <div class="learnrow">
          <span class="lrh"><Icon name="book" size={20} /> Learn it</span>
          {#each MARKET_LESSONS as l (l.id)}
            <button class="lchip" class:done={isLearned(m, l.id)} onclick={() => { sfx.click(); game.learnOverlay = l.id; }}>{l.title}{#if isLearned(m, l.id)} <Icon name="check" size={16} />{/if}</button>
          {/each}
        </div>
      {/if}
    </section>

    {#each skillRegions as r, ri (r.id)}
      {@const open = skillRegionOpen(m, r.id)}
      {@const done = r.lessons.filter(l => skillMovedOn(m, l)).length}
      <section class="region" class:locked={!open} data-region={r.id}>
        <div class="art" style:background-image="url({import.meta.env.BASE_URL}regions/{r.world}.webp)"></div>
        <div class="rhead">
          <div class="rname">
            <span class="tbl" style:background={ar.color}>{r.chip}</span>
            <div><h2>{r.name}</h2><p>{r.blurb}</p></div>
          </div>
          <div class="count" title="Kinds of question in bloom">{keysBloomed(r)}/{regionKeys(r).length} <Icon name="bloom" size={17} /></div>
        </div>
        <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d={pathD(r.lessons.length)} fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85" />
          <path d={pathD(r.lessons.length)} fill="none" stroke="rgba(120,90,190,.35)" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        </svg>
        {#each r.lessons as l, i (l.id)}
          {@const pos = nodePos(i, r.lessons.length)}
          {@const unlocked = skillUnlocked(m, l)}
          {@const rec = m.lessons[l.id]}
          {@const isNext = l.id === nextSkill.id}
          <button class="node" class:locked={!unlocked} class:next={isNext} class:done={skillMovedOn(m, l)} class:check={l.kind === 'check'}
            style:left="{pos.x}%" style:top="{pos.y}%" onclick={() => startSkill(l)} title={l.title}>
            <span class="disc">{#if !unlocked}<Icon name="lock" />{:else}<Icon name={KIND_ICON[l.kind] ?? 'book'} />{/if}</span>
            {#if rec && rec.bestRide > 0}<span class="ride" title="Best: {rideName(rec.bestRide, l.move)}"><svg viewBox="0 0 48 48">{@html rideIcon(rec.bestRide, '#fff', l.move)}</svg></span>{/if}
            <span class="lbl">{l.title}</span>
            <span class="mv" title="{MOVE_NAME[l.move]}"><Icon name={l.move} size={15} /> {MOVE_NAME[l.move]}</span>
            <Stars n={rec?.stars ?? 0} size={14} />
            {#if isNext}<span class="buddy"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={64} mood="dance" /></span>{/if}
          </button>
        {/each}
        {#if !open}<div class="lockveil"><Icon name="lock" /> Pass {skillRegions[ri - 1]?.name} to open</div>{/if}
        {#if done === r.lessons.length}<div class="donebadge">Done!</div>{/if}
      </section>
    {/each}
    {:else}
    <section class="intro">
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
          <div class="learns">
            {#each r.lessons.filter(isLearnStop) as st (st.id)}
              {@const ll = lessonForStop(st)}
              {#if ll}
                {@const got = isLearned(m, ll.id)}
                <button class="learnchip" class:got onclick={() => watch(ll)} title="Watch the lesson: {ll.title}">
                  <img src="{import.meta.env.BASE_URL}learn/tile.webp" alt="" />
                  <span><small>{#if got}<Icon name="check" size={13} /> Learned{:else}Learn it first{/if}</small><b>{ll.title}</b></span>
                </button>
              {/if}
            {/each}
          </div>
          <div class="count" title="Facts in bloom">{bloomed(r)}/{regionFacts(r).length} <Icon name="bloom" size={17} /></div>
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
            {#if rec && rec.bestRide > 0}<span class="ride" title="Best: {rideName(rec.bestRide, moveOf(l))}"><svg viewBox="0 0 48 48">{@html rideIcon(rec.bestRide, '#fff', moveOf(l))}</svg></span>{/if}
            <span class="lbl">{l.title}</span>
            <span class="mv" title="{MOVE_NAME[moveOf(l)]}"><Icon name={moveOf(l)} size={15} /> {MOVE_NAME[moveOf(l)]}</span>
            <Stars n={rec?.stars ?? 0} size={14} />
            {#if isNext}<span class="buddy"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={64} mood="dance" /></span>{/if}
          </button>
        {/each}
        {#if !open}<div class="lockveil"><Icon name="lock" /> Pass {regions[ri - 1]?.name} to open</div>{/if}
        {#if done === r.lessons.length}<div class="donebadge">Done!</div>{/if}
      </section>
    {/each}
    {/if}
    <div class="endpad"></div>
  </div>

  {#if area}
  <div class="go">
    <button class="btn btn-primary btn-big" onclick={() => startSkill(nextSkill)}>
      {areaFresh(area) ? 'Start' : 'Keep going'}: {nextSkill.title} <span class="kbd">enter</span>
    </button>
  </div>
  {:else if op}
  <div class="go">
    {#if learnNext}<button class="btn btn-big learnfirst" onclick={() => watch(learnNext!)}><img src="{import.meta.env.BASE_URL}learn/tile.webp" alt="" />Learn it first</button>{/if}
    <button class="btn btn-primary btn-big" onclick={() => start(next)}>
      {fresh ? 'Start' : 'Keep going'}: {next.title} <span class="kbd">enter</span>
    </button>
  </div>
  {/if}
</div>

<style>
  .sbar { flex: none; display: flex; gap: 8px; padding: 8px 16px; background: rgba(255, 255, 255, .9); border-bottom: var(--panel-border); overflow-x: auto; z-index: 4; scrollbar-width: none; }
  .sbar::-webkit-scrollbar { display: none; }
  .sall, .stab { flex: none; display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; border-radius: 16px; padding: 4px 12px 4px 4px; background: var(--bg2); font: 600 17px var(--font-ui); color: var(--ink2); transition: transform .12s, box-shadow .12s; }
  .sall { padding: 8px 14px; }
  .stab img { width: 74px; height: 44px; object-fit: cover; border-radius: 12px; }
  .stab:hover, .sall:hover { transform: translateY(-2px); }
  .stab.on { background: var(--sc); color: #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .choose { max-width: 1280px; margin: 0 auto; padding: 4px 0 30px; }
  .choose h1 { font-size: 34px; margin: 4px 0 14px; text-align: center; }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
  .scard { background: #fff; border-radius: 26px; overflow: hidden; box-shadow: 0 16px 36px -22px rgba(60, 40, 110, .55), 0 0 0 4px #fff; display: flex; flex-direction: column; transition: transform .15s; }
  .scard:hover { transform: translateY(-4px); }
  .sart { position: relative; border: 0; padding: 0; cursor: pointer; aspect-ratio: 16 / 8; overflow: hidden; background: #dfe9f5; }
  .sart img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s; }
  .scard:hover .sart img { transform: scale(1.05); }
  .sname2 { position: absolute; left: 12px; bottom: 10px; display: flex; align-items: center; gap: 8px; font: 600 26px var(--font-ui); color: #fff; text-shadow: 0 2px 10px rgba(0, 0, 0, .45); }
  .sg { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--sc); font-size: 26px; box-shadow: 0 0 0 3px #fff; text-shadow: none; }
  .sinfo { padding: 12px 16px 16px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
  .sinfo p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .sstat { display: flex; gap: 8px; flex-wrap: wrap; }
  .sstat span { display: flex; align-items: center; gap: 4px; background: var(--bg2); border-radius: 999px; padding: 3px 10px; font: 700 13px var(--font-body); color: var(--ink2); }
  .sstat b { font: 600 16px var(--font-ui); color: var(--ink); }
  .sact { display: flex; gap: 8px; margin-top: auto; }
  .sact .btn-primary { flex: 1; background: linear-gradient(color-mix(in srgb, var(--sc) 70%, #fff), var(--sc)); box-shadow: 0 5px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .ghost { background: var(--bg2); color: var(--ink); box-shadow: none; }
  .sgt { width: auto; min-width: 40px; padding: 0 8px; border-radius: 999px; font-size: 20px; }
  .soonrow { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin: 18px 0 0; }
  .soonrow b { font: 600 18px var(--font-ui); color: var(--ink2); margin-right: 4px; }
  .soonchip { display: inline-flex; flex-direction: column; align-items: center; background: #fff; border-radius: 16px; padding: 5px 12px; box-shadow: inset 0 -3px 0 color-mix(in srgb, var(--sc) 45%, #fff); font: 600 15px var(--font-ui); color: var(--ink2); }
  .soonchip small { font: 700 11px var(--font-body); color: var(--muted); }
  .movenote { text-align: center; font: 600 15px var(--font-body); color: var(--muted); margin: 16px 0 0; }
  .mv { display: inline-flex; align-items: center; gap: 3px; font: 700 11px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); border-radius: 999px; padding: 1px 7px 1px 3px; margin-top: 2px; }
  @media (max-width: 1000px) { .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .cards { grid-template-columns: 1fr; gap: 12px; } .choose h1 { font-size: 24px; margin-bottom: 8px; } .sname2 { font-size: 21px; } .sart { aspect-ratio: 16 / 7; } .stab img { width: 52px; height: 34px; } .stab { font-size: 14px; } .sbar { padding: 6px 8px; gap: 5px; } }
  .strands { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; margin-bottom: 4px; }
  .strands button { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 8px 16px 8px 8px; border-radius: 999px; background: rgba(255, 255, 255, .85); box-shadow: var(--shadow-sm); font: 600 18px var(--font-ui); color: var(--ink2); transition: transform .12s; }
  .strands button:hover { transform: translateY(-2px); }
  .strands button.on { background: var(--sc); color: #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .ssign { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font: 600 26px/1 var(--font-ui); background: var(--sc); color: #fff; }
  .strands button.on .ssign { background: rgba(255, 255, 255, .25); }
  .strands .pgbtn { --sc: #f2a63a; margin-left: auto; background: linear-gradient(135deg, #fff7e0, #ffe9f3); }
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
  .placement.arcade { background: linear-gradient(#fff8ec, #ffe9c4); box-shadow: 0 0 0 3px #ffb44d, var(--shadow-sm); padding: 6px 18px 6px 6px; }
  .placement.arcade img { flex: none; width: 66px; height: 66px; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(120, 50, 10, .3)); }
  .placement.arcade b { color: #c0392b; }
  .learnrow { flex: 1 1 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .lrh { display: inline-flex; align-items: center; gap: 4px; font: 800 13px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-right: 4px; }
  .lchip { display: inline-flex; align-items: center; gap: 4px; border: 0; cursor: pointer; font: 700 14px var(--font-body); color: #6b3d10; background: #fff6df; border-radius: 999px; padding: 6px 12px; box-shadow: inset 0 0 0 2px #f0d38a; }
  .lchip.done { background: #e2f7ee; color: #0f6a48; box-shadow: inset 0 0 0 2px #9fdcbf; }
  .ptext { display: flex; flex-direction: column; }
  .ptext b { font: 600 20px var(--font-ui); }
  .ptext small { font: 600 14px/1.3 var(--font-body); color: var(--muted); }
  .region { position: relative; flex: none; height: clamp(300px, 44vh, 400px); border-radius: 28px; overflow: hidden; box-shadow: var(--shadow); border: var(--panel-border); }
  .region .art { position: absolute; inset: 0; background: linear-gradient(#bfe3f7, #dff3d6) center / cover no-repeat; }
  .region.locked .art { filter: grayscale(.7) brightness(1.05); opacity: .7; }
  .rhead { position: absolute; left: 16px; top: 14px; right: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; z-index: 2; pointer-events: none; }
  .rname { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, .92); padding: 8px 16px 8px 8px; border-radius: 18px; box-shadow: var(--shadow-sm); min-width: 0; }
  .tbl { flex: none; display: flex; align-items: center; justify-content: center; word-spacing: -.12em; min-width: 54px; height: 54px; padding: 0 10px; white-space: nowrap; border-radius: 16px; font: 600 22px var(--font-ui); color: #fff; background: linear-gradient(135deg, var(--primary-hi), var(--pink)); }
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
  .go { position: absolute; bottom: 22px; left: 0; right: 0; margin: 0 auto; width: max-content; max-width: calc(100vw - 32px); z-index: 6; display: flex; gap: 10px; justify-content: center; }
  .learnfirst { display: flex; align-items: center; gap: 8px; background: linear-gradient(#fffaf0, #ffe9b8); color: #6b4300; box-shadow: 0 5px 0 #e0b45c; }
  .learnfirst img { width: 34px; height: 40px; object-fit: contain; margin: -6px 0; }
  .learnart { width: auto; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 40, 10, .25)); }
  .learns { flex: 1; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; min-width: 0; }
  .learnchip { pointer-events: auto; display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; text-align: left; background: rgba(255, 249, 232, .96); border-radius: 16px; padding: 4px 12px 4px 4px; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); transition: transform .15s; }
  .learnchip:hover { transform: translateY(-2px); }
  .learnchip img { width: 34px; height: 40px; object-fit: contain; }
  .learnchip small { display: block; font: 800 11px var(--font-body); color: #a86a00; }
  .learnchip b { font: 600 16px/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; }
  .learnchip.got { background: rgba(240, 252, 246, .96); box-shadow: 0 0 0 3px #9be7c4, var(--shadow-sm); }
  .learnchip.got small { color: #1f7a54; }
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
  @media (max-width: 760px) {
    /* phones: just the little easel (yellow ring: still to learn, green: learned) */
    .learnchip { padding: 4px; border-radius: 14px; }
    .learnchip img { width: 30px; height: 34px; }
    .learnchip span { display: none; }
    .learns { flex: none; gap: 4px; }
    .learnfirst img { display: none; }
    .go { gap: 6px; }
  }

  /* phones: two header rows, as on the home page and the typing map: Home, the title, your stars and the gear
     on top, then the picture tiles with their words (one row of eight ran off a 360 or 390 phone) */
  @media (max-width: 760px) {
    .bar { flex-wrap: wrap; gap: 6px 8px; padding: 6px 10px 8px; }
    .bar .pill.goal, .bar > :global(button.round) { display: none; }
    .bar .pill.stars { padding: 4px 10px; }
    .bar > :global(.tile) { flex: none; padding: 2px; }
    .bar > :global(.tile .lbl) { display: none; }
    .subj { font-size: 22px; margin: 0 0 0 2px; }
    .navs { gap: 4px; }
    .navs :global(.tile) { flex-direction: column; gap: 1px; padding: 4px 2px 5px; }
    .navs :global(.tile .lbl) { font-size: 12.5px; white-space: nowrap; }
  }
</style>
