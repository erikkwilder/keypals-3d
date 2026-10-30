<script lang="ts">
  // Adventure: the painted map of a world (the sky islands, or Fraction Falls). Each island has battles, a
  // practice stop and a Champion at the end. Your buddy stands on the next stop; your team, eggs and the
  // shop are in the corner; the big World map button (how many worlds are open, and "New world!" when one
  // opens) shows every world of the subject Adventure was opened from: the typing worlds from Typing, the
  // math worlds on their painted picture from Math, with a tab for each.
  // The first visit starts with a short story (four pictures), then a tip pointing at the first battle.
  import CloseButton from '../ui/CloseButton.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx, setPlaceStation } from '../audio/sound';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { nextToLearn } from '../math/learn';
  import { FRIEND } from '../art/cast';
  import { ALL_GLIMMERS, GLIMMER, GLIMMER_TOTAL, RARITIES, RARITY, glimmersOf, type GlimmerId, type Rarity } from '../adventure/glimmers';
  import { advOf, advView, canPass, cleared, collectStop, currentNode, ISLAND, islandsOf, markSeen, nodesOf, nodeOpen, playLeft, practiceDone, reachStop, SHOP, buy, EGG_ODDS, PLAY_RULES, worldOpen, type MapNode, type WorldId, owns } from '../adventure/state';
  import { SPOTS } from '../adventure/mapSpots';
  import { DuelScene } from '../three/duelScene';
  import { WORLD_PIN, TYPING_SOON, lastWorld, mapOf, stationOf, worldSubject, worldsFor, type WorldPin, type WorldSubject } from '../adventure/worlds';
  import { nextSkillLesson } from '../math/skills/course';
  import { AREA } from '../math/skills/registry';
  import { openTopicMap } from '../nav';
    import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import Coach from '../ui/Coach.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  // WALK: the walking map layer
  import MapWalker from '../ui/MapWalker.svelte';

  const base = import.meta.env.BASE_URL;
  // Learn: the next trick not learned yet, offered on a practice stop
  const learnTip = $derived.by(() => { const pr = game.profile; if (!pr) return null; const mm = mathOf(pr); return nextToLearn(mm, nextMathLesson(mm, mm.totals.trips ? (mm.strand ?? 'x') : '+')); });
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  let tall = $state(innerWidth < 760 || innerHeight > innerWidth * 1.1);
  const kind = $derived(tall ? 'tall' : 'wide');
  const spots = $derived(SPOTS[kind]);
  // the world on show: the last one looked at (back from a battle lands on the same world)
  // (a world of another subject, or not open yet: the Sky Islands, which every subject has)
  const startWorld: WorldId = lastWorld.id !== 'sky' && (!worldOpen(game.profile!, lastWorld.id) || !WORLD_PIN[lastWorld.id]?.subjects.includes(worldSubject.id)) ? 'sky' : lastWorld.id;
  lastWorld.id = startWorld;
  let world = $state<WorldId>(startWorld);
  /** whose worlds: the subject Adventure was opened from (the world map's tab) */
  let subj = $state<WorldSubject>(worldSubject.id);
  let tab = $state<WorldSubject>(worldSubject.id);
  const SUBJ_NAME: Record<WorldSubject, string> = { typing: 'Typing', math: 'Math' };
  const liveOpen = (s: WorldSubject) => worldsFor(s).filter(w => w.map && worldOpen(p, w.id as WorldId));
  const nOpen = $derived(liveOpen(subj).length);
  const nAll = $derived(subj === 'typing' ? worldsFor('typing').length + TYPING_SOON.length : worldsFor('math').length);
  /** worlds open now and never visited: "New world!" on the button */
  const fresh = $derived(liveOpen(subj).filter(w => w.id !== 'sky' && !a.seen?.includes(`world-${w.id}`)));
  /** the first time a world opens, a tip points at the World map */
  const nudge = $derived(fresh.find(w => !a.seen?.includes(`nudge-${w.id}`)) ?? null);
  function nudged() { const ids = fresh.map(w => `nudge-${w.id}`); game.update(pp => { for (const id of ids) markSeen(pp, id); }); }
  let picker = $state(false);
  let locked = $state<WorldPin | null>(null);
  let wscroll: HTMLDivElement | undefined = $state();
  const wmap = $derived(mapOf(world));
  const nodes = $derived(nodesOf(world));
  const islands = $derived(islandsOf(world));
  const cur = $derived(currentNode(a, world));
  let open = $state<MapNode | null>(null);
  let burst = $state(0);
  const play = $derived(playLeft(p));
  const ready = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const eggs = $derived(a.incubator.filter(e => !!e).length + a.nest.length);
  const team = $derived(a.team.filter(t => t && owns(a, t)) as GlimmerId[]);
  const met = $derived(ALL_GLIMMERS.filter(g => owns(a, g.id)).length);
  const faces = $derived<GlimmerId[]>(team.length ? team : ['puddlepup']);

  // the map covers the screen without stretching; it only shrinks back if covering would hide a stop
  let wrap: HTMLDivElement | undefined = $state();
  let box = $state({ w: 0, h: 0, x: 0, y: 0 });
  function fit() {
    if (!wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight, [iw, ih] = wmap.size[kind];
    const here = nodes.map(n => spots[n.id]);
    const xs = here.map(s => s[0] / 100), ys = here.map(s => s[1] / 100);
    const m = 0.05, minX = Math.min(...xs) - m, maxX = Math.max(...xs) + m, minY = Math.min(...ys) - m * 1.6, maxY = Math.max(...ys) + m;
    const cover = Math.max(W / iw, H / ih), contain = Math.min(W / iw, H / ih);
    // the largest size that still shows every stop, centred
    const lim = (view: number, lo: number, hi: number) => Math.min(lo > 0 ? view / (1 - 2 * lo) : Infinity, hi < 1 ? view / (2 * hi - 1) : Infinity);
    const sMax = Math.min(lim(W, minX, maxX) / iw, lim(H, minY, maxY) / ih);
    const s = Math.max(contain, Math.min(cover, sMax));
    box = { w: iw * s, h: ih * s, x: (W - iw * s) / 2, y: (H - ih * s) / 2 };
  }

  // the first visit: the story, then a tip at the first battle
  let intro = $state(-1);
  let mapTip = $state(false);
  const SLIDES = [
    { img: 'intro-story', title: 'Storms made the Glimmers grumpy!', text: 'Glimmers are little island creatures with special powers. A storm cloud is raining on each one. Cheer one up with your answers, and it joins your team!' },
    { img: 'intro-battle', title: 'How battles work', text: 'Tap a card and answer it: every right answer cheers it up. When it sends rain, answer the quick one to block it. Your buddy and your team help.' },
    { img: 'intro-practice', title: 'Practice hatches eggs', text: 'Every right answer in math and typing practice makes your eggs grow. When an egg is full, it hatches into a new Glimmer! Practice earns shells for the shop too.' },
    { img: 'intro-glimmers', title: 'Find them all', text: `${GLIMMER_TOTAL} Glimmers live in Keypals, and each island has its own. Some are easy to find, some are very rare, and some come from big goals. Cheer up each island's Champion to open the next island.` },
    { img: 'intro-duel', title: 'Play with your family', text: 'Take turns with a grown-up or a friend in a Family Duel, or battle someone\'s ghost in Rival Ghosts. Whoever cheers up the Glimmer first wins it!' },
  ];

  onMount(() => {
    const onR = () => { tall = innerWidth < 760 || innerHeight > innerWidth * 1.1; requestAnimationFrame(fit); };
    addEventListener('resize', onR);
    const ro = new ResizeObserver(fit); if (wrap) ro.observe(wrap);
    fit();
    // a practice stop reached: the next practice session finishes it
    reach(world);
    // build the arena of the next battle while the map is up, so a battle opens without a blank moment
    { const c = currentNode(advView(game.profile!), world); if (c) DuelScene.warm(ISLAND[c.island].region); }
    const seen = new Set(advView(game.profile!).seen ?? []);
    if (!seen.has('intro')) intro = 0;
    else if (!seen.has('map1') && !advView(game.profile!).battles) mapTip = true;
    return () => { removeEventListener('resize', onR); ro.disconnect(); };
  });
  $effect(() => { void kind; void world; requestAnimationFrame(fit); });

  /** A practice stop reached: the next practice session finishes it. */
  function reach(w: WorldId) {
    const c = currentNode(advView(game.profile!), w);
    if (c?.kind === 'practice' && advView(game.profile!).stopAt[c.id] === undefined) game.update(pp => reachStop(advOf(pp), c.id));
  }
  function openWorlds() {
    picker = true; locked = null; tab = subj; sfx.pop();
    if (nudge) nudged();
    // on a phone the world picture is wider than the screen: start with this world in the middle
    requestAnimationFrame(() => { if (wscroll) wscroll.scrollLeft = wscroll.scrollWidth * WORLD_PIN[world].at[0] / 100 - wscroll.clientWidth / 2; });
  }
  function pickWorld(w: WorldPin) {
    if (!w.map) { sfx.click(); game.say(`${w.name} is coming soon: ${w.blurb.toLowerCase()}`); return; }
    const id = w.id as WorldId;
    if (!worldOpen(p, id)) { sfx.pop(); locked = w; return; }
    sfx.pop(); picker = false; open = null;
    // a world picked on a tab: that subject's worlds from now on (the Sky Islands answer with it too)
    if (subj !== tab) { subj = tab; worldSubject.id = tab; }
    if (id === 'sky' && a.subject !== tab) game.update(pp => { advOf(pp).subject = tab; });
    if (id === world) return;
    world = id; lastWorld.id = id;
    setPlaceStation(stationOf(id));
    reach(id);
    if (id !== 'sky' && !a.seen?.includes(`world-${id}`)) { game.say(`Welcome to ${w.name}! ${w.blurb}`); game.update(pp => markSeen(pp, `world-${id}`)); }
  }
  function startArea(w: WorldPin) {
    game.setHome('math'); game.mathOp = null; game.mathArea = w.area ?? null;
    const l = w.area ? nextSkillLesson(mathOf(p), w.area) : null;
    if (l) game.startSkill(l.id); else if (w.area) openTopicMap('math', w.area);
  }

  function nextSlide() {
    sfx.pop();
    if (intro < SLIDES.length - 1) { intro++; return; }
    intro = -1;
    game.update(pp => markSeen(pp, 'intro'));
    if (!advView(game.profile!).battles) mapTip = true;
  }
  function tap(n: MapNode) {
    if (!nodeOpen(a, n)) { sfx.nope(); game.say('Finish the stops before this one first.'); return; }
    if (mapTip) { mapTip = false; game.update(pp => markSeen(pp, 'map1')); }
    open = n; oddsOpen = null; sfx.pop();
  }
  function setSubject(s: 'math' | 'typing') { game.update(pp => { advOf(pp).subject = s; }); sfx.click(); }
  function fight(n: MapNode) {
    if (!play.open) { sfx.nope(); return; }
    game.battleNode = n.id; game.battleKey++; game.go('battle');
  }
  function collect(n: MapNode) {
    let r: ReturnType<typeof collectStop> = null;
    game.update(pp => { r = collectStop(pp, n.id); });
    if (r) { burst++; sfx.complete(); game.say(`+${(r as { shells: number }).shells} shells! Your eggs grew a little too.`); open = null; }
  }
  function goPractice(k: 'math' | 'typing') {
    // a math world's practice stop: a trip of its own area
    const area = ISLAND[open?.island ?? 'meadow'].area;
    if (k === 'math' && area) { game.setHome('math'); game.mathOp = null; game.mathArea = area; game.startSkill(nextSkillLesson(mathOf(p), area).id); return; }
    if (k === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p)).id); }
  }
  const kindName = { battle: 'Battle', practice: 'Practice stop', champion: 'Champion' };
  const pathD = $derived(nodes.map((n, i) => `${i ? 'L' : 'M'}${spots[n.id][0]} ${spots[n.id][1]}`).join(' '));
  // the chances card on a battle stop: every kind, in order, with its chance (0% too), so nothing is hidden
  let oddsOpen = $state<Rarity | null>(null);
  const pctText = (n: number) => `${n >= 1 ? Math.round(n * 10) / 10 : n}%`;
  function oddsNote(r: Rarity, n: number): string {
    if (!n) return r === 'legendary' ? 'Not in battles here. Only from a Champion, or an egg.' : 'Not in battles here.';
    if (n < 1) return `About 1 in ${Math.round(100 / n)} wins.`;
    return n >= 50 ? 'Most of the time.' : n >= 20 ? 'Quite often.' : n >= 8 ? 'Sometimes.' : 'Not often.';
  }
</script>

<div class="screen adv" class:tall>
  <Header />

  <div class="mapwrap" bind:this={wrap} style:--bg="url({new URL(`${base}${wmap[kind]}`, document.baseURI).href})">
    <div class="backdrop"></div>
    <!-- WALK: the map you walk round with your buddy (trails, stops, finds, the 3D buddy): ui/MapWalker.svelte -->
    <MapWalker {world} {kind} {tall} paused={!!open || picker || intro >= 0} onopen={tap} />
  </div>

  <!-- the dock of three: the World map (every world), your Glimmers, your eggs. Family Duel and Rival
       Ghosts are in the Arcade's Play together; the Shop is in My stuff. -->
  <div class="dock">
    <button class="worldbtn" class:hasnew={fresh.length > 0} onclick={openWorlds} title="Every {SUBJ_NAME[subj].toLowerCase()} world of Adventure" aria-label="World map: {nOpen} of {nAll} {SUBJ_NAME[subj].toLowerCase()} worlds open{fresh.length ? ', a new world is open' : ''}">
      <img src="{base}game/worlds-wide.webp" alt="" />
      <span class="wbt"><small>{SUBJ_NAME[subj]} worlds · {WORLD_PIN[world].name}</small><b>World map</b><em>{nOpen} of {nAll} open{play.left !== null ? ` · ${Math.max(0, Math.floor(play.left))} min of play left` : ''}</em></span>
      {#if fresh.length}<span class="newb">{fresh.length === 1 ? 'New world!' : `${fresh.length} new worlds!`}</span>{/if}
    </button>
    <NavTile label="Glimmers" tone="lilac" badge={a.fresh.length ? 'New' : undefined} title="Your Glimmers and your team" onclick={() => { game.glimmerTab = 'team'; game.visit('glimmers'); }}>
      {#snippet art()}<span class="faces">{#each faces as t}<img class:ghost={!team.length} src="{base}game/glimmers/face/{t}{a.glimmers[t]?.evolved ? '-evo' : ''}.webp" alt="" />{/each}</span>{/snippet}
    </NavTile>
    <NavTile label="Eggs" tone="butter" badge={ready ? `${ready} ready!` : eggs ? eggs : undefined} title="Your eggs hatch when you practice" onclick={() => game.visit('eggs')}>
      {#snippet art()}<img class="tileimg" src="{base}game/egg-{a.incubator.find(e => e)?.rarity ?? 'rare'}.webp" alt="" />{/snippet}
    </NavTile>
  </div>

  {#if !play.open}
    <div class="closed card">
      <h2>Adventure is resting</h2>
      <p>{play.why}</p>
      <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math practice</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing practice</button></div>
    </div>
  {/if}

  {#if mapTip && cur && !picker}<Coach text="Tap here for your first battle!" at=".node.here" place="below" />
  {:else if nudge && !picker && !open && intro < 0}<Coach text="A new world is open: {nudge.name}! Tap the World map to go there." at=".worldbtn" place="below" button="Got it" onok={nudged} />{/if}

  {#if open}
    {@const n = open}
    {@const isl = ISLAND[n.island]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheetbg" onclick={() => (open = null)}>
      <div class="sheet card" onclick={(e) => e.stopPropagation()}>
        <div class="sh"><img src="{base}game/node-{n.kind}.webp" alt="" /><div><small>{isl.name}</small><h2>{n.kind === 'battle' ? `Battle ${n.n + 1}` : kindName[n.kind]}</h2></div><span class="x"><CloseButton onclick={() => (open = null)} size={38} /></span></div>
        {#if n.kind === 'practice'}
          {#if practiceDone(a, n.id) && !cleared(a, n.id)}
            <p>You practised! Here's your reward: 20 shells, and your eggs grow a little.</p>
            <button class="btn btn-primary big" onclick={() => collect(n)}>Collect reward <Icon name="gift" size={28} /></button>
          {:else if cleared(a, n.id)}
            <p>Done! Practice any time: it makes your eggs grow and earns shells{a.settings.rule === 'balanced' ? ' and Adventure time' : ''}.</p>
          {:else}
            <p>Do one practice: a math trip, a typing lesson or a playground game. Then come back here for a reward.</p>
            <p class="muted">Practice also makes your eggs grow{a.settings.rule === 'balanced' ? ' and earns more Adventure time' : ''}.{a.settings.rule === 'open' ? ' You can skip ahead for now: the reward waits here.' : ''}</p>
            <div class="row"><button class="btn" class:btn-primary={subj !== 'typing'} onclick={() => goPractice('math')}>Math trip</button><button class="btn" class:btn-primary={subj === 'typing'} onclick={() => goPractice('typing')}>Typing lesson</button><button class="btn" onclick={() => game.go('playground')}>Playground</button></div>
            {#if learnTip}<button class="learnlink" onclick={() => game.openLearn(learnTip!.id)}><img src="{base}learn/tile.webp" alt="" /><span><small>A new trick to learn</small><b>{learnTip.title}</b></span><em>Learn it <Icon name="play" size={16} /></em></button>{/if}
          {/if}
        {:else}
          {#if n.kind === 'champion'}
            <div class="champ"><GlimmerCard id={isl.champion} width={112} locked={!owns(a, isl.champion)} /><p><b>{owns(a, isl.champion) ? GLIMMER[isl.champion].name : `A ${RARITY[GLIMMER[isl.champion].rarity].name} Glimmer`}</b> is the grumpiest one on {isl.name}, under the biggest storm cloud. Cheer it up and it joins your team. You also get a special egg{isl.world === 'sky' && isl.id !== 'bay' ? ', and the next island opens' : ''}.</p></div>
          {:else}
            <p>{cleared(a, n.id) ? 'You won here! Play again to meet more Glimmers.' : 'A grumpy Glimmer is waiting here. Cheer it up with your answers and it joins your team!'}</p>
            <div class="odds">
              <h3>Who you might meet here</h3>
              <p class="oddsnote">Win a battle here and a Glimmer comes to you. These are the chances of each kind.</p>
              <div class="oddrow">
                {#each RARITIES as r}
                  {@const pc = isl.odds[r] ?? 0}
                  <button class="odd" class:none={!pc} class:on={oddsOpen === r} style:--c={RARITY[r].color} onclick={() => { oddsOpen = oddsOpen === r ? null : r; sfx.pop(); }} aria-label="{RARITY[r].name}: {pctText(pc)}">
                    <img src="{base}game/egg-{r}.webp" alt="" /><b>{pctText(pc)}</b><span>{RARITY[r].name}</span>
                  </button>
                {/each}
              </div>
              {#if oddsOpen}
                {@const r = oddsOpen}
                {@const pc = isl.odds[r] ?? 0}
                <div class="oddwho" style:--c={RARITY[r].color}><p><b>{RARITY[r].name}: {pctText(pc)}.</b> {oddsNote(r, pc)}</p>{#if pc}<span class="ofaces">{#each glimmersOf(r).filter(g => !g.champion) as g}<GlimmerCard id={g.id} width={40} locked={!owns(a, g.id)} />{/each}</span>{/if}</div>
              {:else}
                <p class="oddtip">{!isl.odds.legendary ? 'Legendary is 0% here: those only come from a Champion, or an egg. ' : ''}Tap an egg to see who it could be.</p>
              {/if}
              <p class="eggline">You might win an egg too: after about 3 in 10 wins, and always after a Perfect Cheer. An egg can hatch any kind, even Legendary.</p>
            </div>
          {/if}
          <div class="teamline"><span>Your team</span>{#each team as t}<span class="tm"><img src="{base}game/glimmers/face/{t}{a.glimmers[t]?.evolved ? '-evo' : ''}.webp" alt="" />{GLIMMER[t].name}</span>{:else}<em>No Glimmers yet: win this battle for your first!</em>{/each}{#if met > 0}<button class="linky" onclick={() => { game.glimmerTab = 'team'; game.visit('glimmers'); }}>Change team</button>{/if}</div>
          {#if isl.area}<p class="areanote">{WORLD_PIN[isl.world]?.blurb ?? isl.blurb}{isl.mischief ? ` Watch out: ${isl.mischief.name.toLowerCase()}!` : ''}</p>
          {:else}<div class="subj"><span>Answer with</span>
            <button class:on={a.subject === 'math'} onclick={() => setSubject('math')}>Math</button>
            <button class:on={a.subject === 'typing'} onclick={() => setSubject('typing')}>Typing</button></div>{/if}
          {#if !canPass(a, n) || !play.open}<p class="muted">{play.why}</p>{/if}
          <button class="btn btn-primary big" disabled={!play.open} onclick={() => fight(n)}>{cleared(a, n.id) ? 'Play again' : 'Start the battle!'}</button>
        {/if}
      </div>
    </div>
  {/if}

  {#if picker}
    <div class="worlds" class:narrow={tall} role="dialog" aria-label="World map">
      <div class="wtop">
        <h2>World map</h2>
        <div class="wtabs" role="tablist" aria-label="Whose worlds">
          {#each (['typing', 'math'] as const) as s (s)}
            <button role="tab" aria-selected={tab === s} class:on={tab === s} onclick={() => { if (tab !== s) { tab = s; locked = null; sfx.pop(); } }}><img src="{base}game/icon-{s}.webp" alt="" />{SUBJ_NAME[s]}<em>{liveOpen(s).length}</em></button>
          {/each}
        </div>
        <p>{tab === 'math' ? 'Each world is a kind of math. More are on the way!' : 'Type the words to cheer up the Glimmers. More typing worlds are coming!'}</p>
        <span class="x"><CloseButton onclick={() => (picker = false)} size={40} /></span>
      </div>
      {#if tab === 'typing'}
        <!-- the typing worlds: the Sky Islands for now, and cards for the ones still to come -->
        <div class="tworlds">
          {#each worldsFor('typing') as w (w.id)}
            <button class="tw live" class:here={w.id === world && subj === 'typing'} onclick={() => pickWorld(w)}>
              <span class="twpic" style:background-image="url({base}{w.map?.wide ?? 'game/worlds-wide.webp'})">{#if w.id === world}<span class="twme"><Critter friend={p.buddy} size={tall ? 56 : 72} mood="idle" /></span>{/if}</span>
              <b>{w.name}</b><small>{w.id === world && subj === 'typing' ? 'You are here' : 'Go!'}</small>
            </button>
          {/each}
          {#each TYPING_SOON as t (t.name)}
            <div class="tw soon"><span class="twpic" style:background-image="url({base}game/worlds-wide.webp)"><span class="twlock"><Icon name="lock" size={34} /></span></span><b>{t.name}</b><small>{t.blurb}</small></div>
          {/each}
        </div>
      {:else}
      <div class="wscroll" bind:this={wscroll}>
        <div class="wpic">
          <img class="wimg" src="{base}game/worlds-wide.webp" alt="" draggable="false" />
          {#each worldsFor('math') as w (w.id)}{#if w.art}<img class="wart" src="{base}{w.art.src}" alt="" draggable="false" style:left="{w.art.at[0]}%" style:top="{w.art.at[1]}%" style:width="{w.art.w}%" />{/if}{/each}
          {#each worldsFor('math') as w (w.id)}
            {@const live = !!w.map}
            {@const ok = live && worldOpen(p, w.id as WorldId)}
            <button class="pin" class:live class:shut={live && !ok} class:here={w.id === world} style:left="{w.at[0]}%" style:top="{w.at[1]}%" onclick={() => pickWorld(w)} aria-label="{w.name}: {live ? (ok ? 'open' : 'locked') : 'coming soon'}">
              {#if w.id === world}<span class="pme"><Critter friend={p.buddy} size={tall ? 44 : 56} mood="idle" /></span>{/if}
              <b>{#if live && !ok}<Icon name="lock" size={16} />{/if}{w.name}</b>
              <small>{!live ? 'Coming soon' : !ok ? 'Locked' : w.id === world ? 'You are here' : w.id !== 'sky' && !a.seen?.includes(`world-${w.id}`) ? 'New!' : 'Go!'}</small>
            </button>
          {/each}
        </div>
      </div>
      {/if}
      {#if locked}
        {@const w = locked}
        {@const an = w.area ? AREA[w.area].name : "Math"}
        <div class="wlock card">
          <img src="{base}{w.art?.src ?? 'math/pizza/tile.webp'}" alt="" />
          <div><h3>{w.name} opens with {an}</h3><p>Do your first {an} trip in Math, then come back: every battle card here is {w.area === 'fractions' ? 'a fraction' : `about ${an.toLowerCase()}`}.</p></div>
          <div class="row"><button class="btn" onclick={() => (locked = null)}>Not now</button><button class="btn btn-primary" onclick={() => startArea(w)}>Start {an}</button></div>
        </div>
      {/if}
    </div>
  {/if}

  {#if intro >= 0}
    {@const sl = SLIDES[intro]}
    <div class="introbg">
      <div class="introcard card">
        {#key intro}<div class="pic" style:background-image="url({base}game/{sl.img}.webp)"></div>{/key}
        <div class="it">
          <h2>{sl.title}</h2>
          <p>{sl.text}</p>
          <div class="dots">{#each SLIDES as _, i}<i class:on={i === intro}></i>{/each}</div>
          <div class="row end">
            {#if intro > 0}<button class="btn" onclick={() => intro--}>Back</button>{/if}
            <button class="btn btn-primary big" onclick={nextSlide}>{intro < SLIDES.length - 1 ? 'Next' : `Let's go, ${FRIEND[p.buddy].name}!`}</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={60} x={50} y={40} />
</div>

<style>
  .adv { display: flex; flex-direction: column; background: #cfe6fb; overflow: hidden; }
  .chip { display: flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; box-shadow: var(--shadow-sm); border: 0; color: var(--ink); }
  .chip img { width: 30px; height: 30px; object-fit: contain; }
  .chip.help { width: 40px; height: 40px; justify-content: center; padding: 0; font-size: 22px; color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b; }
  .chip.time { padding: 4px 12px 4px 6px; font-size: 15px; }
  .chip.time.low { background: #fff0f2; color: #b02a48; }
  .mapwrap { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  /* WALK: the map, its stops and the buddy are drawn by ui/MapWalker.svelte */
  .backdrop { position: absolute; inset: -40px; background: var(--bg) center / cover; filter: blur(22px) saturate(1.1); }
  @keyframes hop { 50% { translate: 0 -6px; } }

  /* the World map: big, in the corner of every map, with how many worlds are open and a badge for a new one */
  .worldbtn { position: absolute; left: 14px; top: 12px; z-index: 3; display: flex; align-items: center; gap: 12px; border: 0; cursor: pointer; background: linear-gradient(#fff, #fff8e4); border-radius: 24px; padding: 7px 20px 7px 7px; box-shadow: 0 0 0 4px #ffc93d, 0 6px 0 #e0a21c, 0 16px 30px -12px rgba(60, 40, 0, .55); text-align: left; transition: transform .15s; }
  .worldbtn:hover { transform: translateY(-2px) scale(1.03); }
  .worldbtn:active { transform: translateY(4px); box-shadow: 0 0 0 4px #ffc93d, 0 2px 0 #e0a21c; }
  .worldbtn img { width: 116px; height: 66px; object-fit: cover; border-radius: 17px; box-shadow: 0 0 0 3px #fff; }
  .wbt { display: flex; flex-direction: column; }
  .worldbtn small { display: block; font: 800 11.5px var(--font-body); letter-spacing: .05em; text-transform: uppercase; color: #a86a00; }
  .worldbtn b { font: 600 27px/1.05 var(--font-ui); color: var(--ink); }
  .worldbtn em { font: 700 13.5px var(--font-body); font-style: normal; color: var(--ink2); }
  .worldbtn.hasnew { animation: callout 1.8s ease-in-out infinite; }
  @keyframes callout { 50% { box-shadow: 0 0 0 4px #ffc93d, 0 6px 0 #e0a21c, 0 0 0 12px rgba(255, 201, 61, .35), 0 16px 30px -12px rgba(60, 40, 0, .55); } }
  .newb { position: absolute; top: -16px; right: -22px; padding: 4px 11px; border-radius: 999px; background: linear-gradient(#ff7aa8, #e2468f); color: #fff; font: 600 15px var(--font-ui); box-shadow: 0 3px 0 #a8246a, 0 0 0 3px #fff; transform: rotate(6deg); white-space: nowrap; }
  :global(:root[data-motion='reduced']) .worldbtn.hasnew { animation: none; }
  .areanote { background: #e8f6ff; border-radius: 14px; padding: 8px 12px; color: #1c5fd1 !important; }

  .worlds { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; background: linear-gradient(#2a2160, #3b2f7a); animation: fade .25s; }
  .wtop { display: flex; align-items: center; gap: 14px; padding: 10px 16px; color: #fff; }
  .wtop h2 { margin: 0; font-size: 28px; color: #fff; }
  .wtabs { display: flex; gap: 6px; padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, .14); }
  .wtabs button { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 14px 4px 4px; border-radius: 999px; background: transparent; color: #fff; font: 600 18px var(--font-ui); }
  .wtabs button img { width: 34px; height: 34px; object-fit: contain; }
  .wtabs button em { font: 800 12px var(--font-body); font-style: normal; background: rgba(255, 255, 255, .25); border-radius: 999px; padding: 1px 8px; }
  .wtabs button.on { background: #fff; color: var(--ink); box-shadow: 0 3px 0 #ffc93d; }
  .wtabs button.on em { background: #ffe9a8; color: #7a5200; }
  /* the typing worlds, as big cards */
  .tworlds { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; padding: 8px 24px 24px; align-content: center; width: 100%; max-width: 1240px; margin: 0 auto; }
  .tw { display: flex; flex-direction: column; gap: 6px; border: 0; padding: 10px 10px 14px; border-radius: 26px; background: #fff; text-align: center; font: inherit; box-shadow: 0 0 0 4px #ffd36b, 0 14px 30px -12px rgba(0, 0, 0, .5); }
  .tw.live { cursor: pointer; transition: transform .15s; }
  .tw.live:hover { transform: translateY(-3px); }
  .tw.here { box-shadow: 0 0 0 5px var(--primary), 0 0 30px rgba(255, 255, 255, .6); }
  .twpic { position: relative; display: block; aspect-ratio: 16 / 9; border-radius: 18px; background-size: cover; background-position: center; }
  .twme { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%); filter: drop-shadow(0 6px 5px rgba(40, 20, 10, .45)); animation: hop 1.1s ease-in-out infinite; }
  .tw b { font: 600 24px var(--font-ui); color: var(--ink); }
  .tw small { font: 700 14px/1.35 var(--font-body); color: var(--muted); }
  .tw.live small { font: 800 13px var(--font-body); text-transform: uppercase; letter-spacing: .05em; color: var(--primary); }
  .tw.soon { background: rgba(255, 255, 255, .82); box-shadow: 0 0 0 3px #c9c2e0, 0 14px 30px -12px rgba(0, 0, 0, .5); }
  .tw.soon .twpic { filter: grayscale(.85) brightness(.75); }
  .twlock { position: absolute; inset: 0; display: grid; place-items: center; }
  .wtop p { margin: 0; font: 600 15px var(--font-body); color: #d9d2ff; }
  .wscroll { flex: 1; min-height: 0; overflow: auto; container-type: size; display: grid; place-items: center; padding: 0 0 12px; }
  .wpic { position: relative; width: min(calc(100cqw - 32px), calc((100cqh - 12px) * 16 / 9)); aspect-ratio: 16 / 9; border-radius: 22px; overflow: hidden; box-shadow: 0 10px 40px rgba(0, 0, 0, .4); }
  .wimg { width: 100%; height: 100%; display: block; }
  /* an island painted onto the world picture (a world added after the picture was made) */
  .wart { position: absolute; transform: translate(-50%, -50%); pointer-events: none; filter: drop-shadow(0 12px 18px rgba(60, 40, 110, .25)); }
  .pin { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; border: 0; cursor: pointer; background: rgba(255, 255, 255, .78); border-radius: 16px; padding: 4px 12px 5px; box-shadow: 0 4px 12px rgba(40, 20, 80, .3); transition: transform .15s; }
  .pin b { display: flex; align-items: center; gap: 4px; font: 600 clamp(13px, 1.4vw, 19px) var(--font-ui); color: var(--ink2); white-space: nowrap; }
  .pin small { font: 800 clamp(10px, .9vw, 12px) var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .pin.live { background: #fff; box-shadow: 0 0 0 3px #ffd36b, 0 6px 16px rgba(40, 20, 80, .35); }
  .pin.live b { color: var(--ink); font-size: clamp(15px, 1.7vw, 23px); }
  .pin.live small { color: #a86a00; }
  .pin.here { box-shadow: 0 0 0 4px var(--primary), 0 0 24px #fff; }
  .pin.here small { color: var(--primary); }
  .pin.shut { box-shadow: 0 0 0 3px #c9c2e0, 0 6px 16px rgba(40, 20, 80, .35); }
  .pin:hover { transform: translate(-50%, -50%) scale(1.06); }
  .pme { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); pointer-events: none; animation: hop 1.1s ease-in-out infinite; filter: drop-shadow(0 6px 5px rgba(40, 20, 10, .45)); }
  .wlock { position: absolute; left: 50%; bottom: 24px; transform: translateX(-50%); width: min(560px, 92vw); display: grid; grid-template-columns: auto 1fr; gap: 10px 14px; align-items: center; padding: 14px 18px; animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); }
  .wlock img { width: 72px; height: 72px; object-fit: contain; }
  .wlock h3 { margin: 0 0 4px; font-size: 20px; }
  .wlock p { margin: 0; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .wlock .row { grid-column: 1 / -1; justify-content: flex-end; }
  /* a phone: the world picture is as tall as the screen and slides sideways */
  .worlds.narrow .wscroll { display: block; place-items: normal; padding: 0 0 8px; }
  .worlds.narrow .wpic { width: auto; height: calc(100cqh - 8px); border-radius: 0; }
  .worlds.narrow .wtop p { display: none; }
  .tall .worldbtn { gap: 8px; padding: 5px 12px 5px 5px; border-radius: 18px; }
  .tall .worldbtn img { width: 64px; height: 40px; border-radius: 12px; }
  .tall .worldbtn b { font-size: 19px; } .tall .worldbtn small { font-size: 9.5px; } .tall .worldbtn em { font-size: 11.5px; }
  .tall .newb { font-size: 12.5px; top: -10px; right: -10px; padding: 3px 8px; }
  .worlds.narrow .wtop { flex-wrap: wrap; gap: 8px; }
  .worlds.narrow .wtop h2 { font-size: 22px; }
  .worlds.narrow .wtabs button { font-size: 15px; padding: 3px 10px 3px 3px; } .worlds.narrow .wtabs button img { width: 28px; height: 28px; }
  .worlds.narrow .tworlds { grid-template-columns: 1fr; padding: 6px 14px 18px; gap: 14px; }

  .dock { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; z-index: 4; padding: 8px; border-radius: 30px; background: rgba(255, 255, 255, .8); box-shadow: 0 14px 30px -18px rgba(40, 20, 80, .6); }
  .dock .worldbtn { position: relative; left: auto; top: auto; }
  .dock :global(.tile) { width: 112px; height: 112px; }
  .faces { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
  .faces img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 3px #fff, 0 4px 8px rgba(40, 20, 80, .3); }
  .faces img + img { margin-left: -14px; }
  .faces img.ghost { filter: grayscale(1) brightness(.6); opacity: .7; }
  /* the picture fills the tile's picture box exactly (a tall egg sized itself taller and covered the word) */
  .tileimg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(40, 20, 80, .3)); }

  .closed { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; padding: 22px 26px; text-align: center; width: min(460px, 92vw); }
  .closed h2 { margin: 0 0 6px; } .closed p { font-weight: 600; color: var(--ink2); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .learnlink { display: flex; align-items: center; gap: 10px; width: 100%; margin-top: 10px; border: 0; cursor: pointer; text-align: left; background: linear-gradient(#fffaf0, #ffefc6); border-radius: 18px; padding: 6px 14px 6px 6px; box-shadow: 0 0 0 3px #ffd36b; }
  .learnlink img { width: 38px; height: 46px; object-fit: contain; }
  .learnlink span { flex: 1; }
  .learnlink small { display: block; font: 800 11px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: #a86a00; }
  .learnlink b { font: 600 18px var(--font-ui); color: var(--ink); }
  .learnlink em { display: inline-flex; align-items: center; gap: 4px; font: 700 14px var(--font-body); font-style: normal; color: #6b4300; background: #ffd36b; padding: 5px 12px; border-radius: 999px; }
  .row.end { justify-content: flex-end; }
  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(40, 28, 70, .35); display: grid; place-items: center; animation: fade .2s; }
  @keyframes fade { from { opacity: 0; } }
  .sheet { width: min(560px, 94vw); padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 10px; animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); max-height: 90vh; overflow: auto; }
  @keyframes pop { from { transform: scale(.9); opacity: 0; } }
  .sh { display: flex; align-items: center; gap: 12px; }
  .sh img { width: 60px; height: 60px; object-fit: contain; }
  .sh small { font: 800 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .sh h2 { margin: 0; font-size: 28px; }
  .x { margin-left: auto; display: grid; }
  .sheet p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .sheet h3 { margin: 4px 0 0; font-size: 18px; }
  .small { font-size: 13px !important; }
  .big { font-size: 22px; padding: 12px 22px; }
  .champ { display: flex; gap: 14px; align-items: center; }
  /* the chances card: every kind of Glimmer in order, its egg and its chance (0% too); tap one for who */
  .odds { display: flex; flex-direction: column; gap: 6px; background: #faf8fe; border-radius: 18px; padding: 10px 12px; box-shadow: inset 0 0 0 2px #ece6f6; }
  .odds h3 { margin: 0; font-size: 20px; }
  .sheet .oddsnote { font-size: 15px; line-height: 1.3; }
  .oddrow { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
  .odd { display: flex; flex-direction: column; align-items: center; gap: 1px; border: 0; cursor: pointer; font: inherit; background: #fff; border-radius: 14px; padding: 6px 2px 5px; box-shadow: inset 0 -4px 0 var(--c), 0 2px 6px -3px rgba(40, 20, 80, .3); transition: transform .12s; }
  .odd:hover { transform: translateY(-2px); }
  .odd.on { box-shadow: 0 0 0 3px var(--c), inset 0 -4px 0 var(--c); }
  .odd img { width: 30px; height: 38px; object-fit: contain; }
  .odd b { font: 600 19px/1.1 var(--font-ui); color: var(--ink); }
  .odd span { font: 700 11px/1.1 var(--font-body); color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .odd.none { background: #f1eff5; box-shadow: inset 0 -4px 0 #d7d2e2; }
  .odd.none img { filter: grayscale(.85) opacity(.5); }
  .odd.none b { color: #9a93ad; }
  .oddwho { display: flex; flex-direction: column; gap: 4px; background: #fff; border-radius: 12px; padding: 6px 10px; box-shadow: inset 4px 0 0 var(--c); }
  .sheet .oddwho p, .sheet .oddtip, .sheet .eggline { font-size: 14px; line-height: 1.3; }
  .ofaces { display: flex; flex-wrap: wrap; gap: 3px; }
  .linky { align-self: flex-start; border: 0; background: none; padding: 0; font: 700 13px var(--font-body); color: var(--muted); text-decoration: underline; cursor: pointer; }
  .teamline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 700 14px var(--font-body); color: var(--ink2); background: #f6f2ff; border-radius: 14px; padding: 6px 10px; }
  .teamline .tm { display: flex; align-items: center; gap: 4px; font: 600 15px var(--font-ui); color: var(--ink); }
  .teamline img { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 2px #fff; }
  .teamline em { font-style: normal; color: var(--muted); }
  .subj { display: flex; align-items: center; gap: 6px; font: 700 14px var(--font-body); color: var(--ink2); }
  .subj button { border: 0; border-radius: 999px; padding: 8px 16px; font: 600 16px var(--font-ui); background: #f1ecfb; color: var(--ink2); cursor: pointer; }
  .subj button.on { background: var(--primary); color: #fff; }

  .introbg { position: absolute; inset: 0; z-index: 30; background: rgba(30, 20, 60, .55); display: grid; place-items: center; padding: 16px; animation: fade .3s; }
  .introcard { width: min(880px, 96vw); overflow: hidden; display: grid; grid-template-columns: 1.15fr 1fr; padding: 0; }
  .pic { min-height: 360px; background-size: cover; background-position: center; animation: fade .4s; }
  .it { padding: 26px 26px 22px; display: flex; flex-direction: column; gap: 12px; justify-content: center; }
  .it h2 { margin: 0; font-size: 30px; line-height: 1.1; }
  .it p { margin: 0; font: 600 18px/1.45 var(--font-body); color: var(--ink2); }
  .dots { display: flex; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: #e3dcf2; }
  .dots i.on { background: var(--primary); width: 24px; border-radius: 999px; }

  .tall :global(.hd .tt span) { display: none; }
  /* phone header holds back, title, help, shells, time and the menu compass on one row */
  .tall :global(.hd) { gap: 8px; padding: 10px 10px; } .tall :global(.hd .rt) { gap: 6px; } .tall :global(.hd h1) { font-size: 22px; } .tall :global(.hd .tt) { min-width: 0; }
  @media (max-width: 380px) { .tall :global(.hd h1) { font-size: 19px; } .tall :global(.hd) { gap: 6px; padding: 10px 8px; } }
  .tallbtns { display: flex; gap: 5px; }
  .tallbtns :global(.menu), .tallbtns :global(.help) { padding: 2px; border-width: 2px; }
  .tall .chip { font-size: 15px; padding: 2px 8px 2px 2px; } .tall .chip img { width: 24px; height: 24px; } .tall .chip.time { padding: 4px 8px; font-size: 13px; }
  /* phone header: smaller painted icons so the title keeps its room */
  .tall .chip.time { gap: 3px; padding: 4px 7px 4px 4px; } .tall .chip.time :global(.ico) { width: 16px; height: 16px; } .tall .chip.help :global(.ico) { width: 22px; height: 22px; } .tall .chip.time .mn { display: none; } .tall .chip.help { width: 32px; height: 32px; font-size: 18px; padding: 0; }
  .tall .dock { position: static; transform: none; flex: none; justify-content: center; gap: 8px; padding: 8px 8px 10px; border-radius: 0; background: rgba(255, 255, 255, .92); border-top: var(--panel-border); box-shadow: none; }
  .tall .dock { gap: 6px; padding: 8px 6px 10px; }
  .tall .dock :global(.tile) { width: calc((100vw - 36px) / 5); max-width: 96px; min-width: 0; height: 84px; padding: 6px 2px; gap: 2px; }
  /* on a phone the picture box shrinks so the picture and its word both fit the shorter tile */
  .tall .dock :global(.tile .pic) { width: 46px !important; height: 46px !important; }
  .tall .faces img { width: 34px; height: 34px; }
  .tall .faces img + img { margin-left: -12px; }
  .tall .oddrow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tall .odd img { width: 26px; height: 32px; } .tall .odd span { font-size: 12px; }
  .tall .introcard { grid-template-columns: 1fr; }
  .tall .pic { min-height: 210px; }
  .tall .it { padding: 16px 18px; } .tall .it h2 { font-size: 24px; } .tall .it p { font-size: 16px; }
</style>
