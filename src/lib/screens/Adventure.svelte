<script lang="ts">
  // Adventure: the painted map of the sky islands. Each island has battles, a practice stop and a
  // Champion at the end. Your buddy stands on the next stop; your team, eggs and the shop are in the corner.
  // The first visit starts with a short story (four pictures), then a tip pointing at the first battle.
  import CloseButton from '../ui/CloseButton.svelte';
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { nextToLearn } from '../math/learn';
  import { FRIEND } from '../art/cast';
  import { GLIMMER, GLIMMERS, RARITY, glimmersOf, type GlimmerId, type Rarity } from '../adventure/glimmers';
  import { advOf, advView, canPass, cleared, collectStop, currentNode, ISLAND, ISLANDS, markSeen, NODES, nodeOpen, playLeft, practiceDone, reachStop, SHOP, buy, EGG_ODDS, PLAY_RULES, type MapNode, owns } from '../adventure/state';
  import { SPOTS } from '../adventure/mapSpots';
    import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import Coach from '../ui/Coach.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  // Learn: the next trick not learned yet, offered on a practice stop
  const learnTip = $derived.by(() => { const pr = game.profile; if (!pr) return null; const mm = mathOf(pr); return nextToLearn(mm, nextMathLesson(mm, mm.totals.trips ? (mm.strand ?? 'x') : '+')); });
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  let tall = $state(innerWidth < 760 || innerHeight > innerWidth * 1.1);
  const IMG = { wide: [1672, 941], tall: [1024, 1536] } as const;
  const kind = $derived(tall ? 'tall' : 'wide');
  const spots = $derived(SPOTS[kind]);
  const cur = $derived(currentNode(a));
  let open = $state<MapNode | null>(null);
  let burst = $state(0);
  let chances = $state(false);
  const play = $derived(playLeft(p));
  const ready = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const eggs = $derived(a.incubator.filter(e => !!e).length + a.nest.length);
  const team = $derived(a.team.filter(t => t && owns(a, t)) as GlimmerId[]);
  const met = $derived(GLIMMERS.filter(g => owns(a, g.id)).length);
  const faces = $derived<GlimmerId[]>(team.length ? team : ['puddlepup']);

  // the map covers the screen without stretching; it only shrinks back if covering would hide a stop
  let wrap: HTMLDivElement | undefined = $state();
  let box = $state({ w: 0, h: 0, x: 0, y: 0 });
  function fit() {
    if (!wrap) return;
    const W = wrap.clientWidth, H = wrap.clientHeight, [iw, ih] = IMG[kind];
    const xs = Object.values(spots).map(s => s[0] / 100), ys = Object.values(spots).map(s => s[1] / 100);
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
    { img: 'intro-glimmers', title: 'Find them all', text: '14 Glimmers live on the islands. Some are easy to find, some are very rare. Cheer up each island\'s Champion to open the next island.' },
    { img: 'intro-duel', title: 'Play with your family', text: 'Take turns with a grown-up or a friend in a Family Duel, or battle someone\'s ghost in Rival Ghosts. Whoever cheers up the Glimmer first wins it!' },
  ];

  onMount(() => {
    const onR = () => { tall = innerWidth < 760 || innerHeight > innerWidth * 1.1; requestAnimationFrame(fit); };
    addEventListener('resize', onR);
    const ro = new ResizeObserver(fit); if (wrap) ro.observe(wrap);
    fit();
    // a practice stop reached: the next practice session finishes it
    game.update(pp => { const ad = advOf(pp), c = currentNode(ad); if (c?.kind === 'practice') reachStop(ad, c.id); });
    const seen = new Set(advView(game.profile!).seen ?? []);
    if (!seen.has('intro')) intro = 0;
    else if (!seen.has('map1') && !advView(game.profile!).battles) mapTip = true;
    return () => { removeEventListener('resize', onR); ro.disconnect(); };
  });
  $effect(() => { void kind; requestAnimationFrame(fit); });

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
    open = n; chances = false; sfx.pop();
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
    if (k === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p)).id); }
  }
  const kindName = { battle: 'Battle', practice: 'Practice stop', champion: 'Champion' };
  const pathD = $derived(NODES.map((n, i) => `${i ? 'L' : 'M'}${spots[n.id][0]} ${spots[n.id][1]}`).join(' '));
  const HOW_OFTEN: [string, Rarity][] = [['Often', 'common'], ['Sometimes', 'uncommon'], ['Not often', 'rare'], ['Hardly ever', 'epic'], ['Once in a blue moon', 'mythic']];
</script>

<div class="screen adv" class:tall>
  <Header title="Adventure" back={() => game.go('hub')} sub="{met} of {GLIMMERS.length} Glimmers found" gear={!tall}>
    {#snippet right()}
      <button class="chip help" onclick={() => { intro = 0; sfx.pop(); }} title="How Adventure works"><Icon name="help" size={28} /></button>
      <span class="chip shells" title="Shells: spend them in the shop"><img src="{base}game/icon-shell.webp" alt="" />{a.shells}</span>
      {#if play.left !== null}<span class="chip time" class:low={play.left < 3} title={PLAY_RULES[a.settings.rule].text}><Icon name="clock" size={20} /> {Math.max(0, Math.floor(play.left))}<span class="mn">&nbsp;min</span></span>{/if}
    {/snippet}
  </Header>

  <div class="mapwrap" bind:this={wrap} style:--bg="url({new URL(`${base}game/map-${kind}.webp`, document.baseURI).href})">
    <div class="backdrop"></div>
    <div class="map" style:width="{box.w}px" style:height="{box.h}px" style:left="{box.x}px" style:top="{box.y}px" style:background-image="url({base}game/map-{kind}.webp)">
      <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={pathD} /></svg>
      {#each NODES as n (n.id)}
        {@const done = cleared(a, n.id)}
        {@const ok = nodeOpen(a, n)}
        {@const here = cur?.id === n.id}
        <button class="node {n.kind}" class:done class:here class:locked={!ok} style:left="{spots[n.id][0]}%" style:top="{spots[n.id][1]}%" onclick={() => tap(n)} aria-label="{ISLAND[n.island].name}: {kindName[n.kind]}">
          <img src="{base}game/node-{!ok ? 'lock' : n.kind}.webp" alt="" draggable="false" />
          {#if done && n.kind !== 'practice'}<span class="tick"><Icon name="check" size={26} /></span>{/if}
          {#if n.kind === 'practice' && practiceDone(a, n.id) && !cleared(a, n.id)}<span class="gift"><Icon name="gift" size={30} /></span>{/if}
          {#if n.kind === 'champion' && ok && !done}<span class="crown">Champion</span>{/if}
        </button>
      {/each}
      {#if cur}
        <span class="me" style:left="{spots[cur.id][0]}%" style:top="{spots[cur.id][1]}%"><Critter friend={p.buddy} size={tall ? 54 : 84} mood="idle" /></span>
        <span class="next" style:left="{spots[cur.id][0]}%" style:top="{spots[cur.id][1]}%">Next!</span>
      {/if}
      {#each ISLANDS as isl}
        {@const first = spots[`${isl.id}-0`]}
        <span class="iname" style:left="{first[0]}%" style:top="{first[1] + (tall ? 5.5 : 9)}%">{isl.name}</span>
      {/each}
    </div>
  </div>

  <div class="dock">
    <NavTile label="Team" tone="lilac" badge={a.fresh.length ? 'New' : undefined} title="Your Glimmers and your team" onclick={() => game.go('glimmers')}>
      {#snippet art()}<span class="faces">{#each faces as t}<img class:ghost={!team.length} src="{base}game/glimmers/face/{t}{a.glimmers[t]?.evolved ? '-evo' : ''}.webp" alt="" />{/each}</span>{/snippet}
    </NavTile>
    <NavTile label="Eggs" tone="butter" badge={ready ? `${ready} ready!` : eggs ? eggs : undefined} title="Your eggs hatch when you practice" onclick={() => game.go('eggs')}>
      {#snippet art()}<img class="tileimg" src="{base}game/egg-{a.incubator.find(e => e)?.rarity ?? 'rare'}.webp" alt="" />{/snippet}
    </NavTile>
    <NavTile label="Shop" tone="mint" title="The Island Shop: things to wear, eggs and treats" onclick={() => game.openShop()}>
      {#snippet art()}<img class="tileimg" src="{base}game/icon-shell.webp" alt="" />{/snippet}
    </NavTile>
    {#if a.settings.versus !== false}
    <NavTile label="Duel" tone="sky" badge={a.seen?.includes('duel1') ? undefined : 'New'} title="Family Duel: take turns with someone on this screen" onclick={() => { game.duelMode = 'duel'; game.duelRival = null; game.duelKey++; game.go('duel'); }}>
      {#snippet art()}<img class="tileimg" src="{base}game/tile-duel.webp" alt="" />{/snippet}
    </NavTile>
    <NavTile label="Rivals" tone="pink" badge={a.seen?.includes('rivals1') ? undefined : 'New'} title="Rival Ghosts: battle someone's ghost" onclick={() => game.go('rivals')}>
      {#snippet art()}<img class="tileimg" src="{base}game/tile-rivals.webp" alt="" />{/snippet}
    </NavTile>
    {/if}
  </div>

  {#if !play.open}
    <div class="closed card">
      <h2>Adventure is resting</h2>
      <p>{play.why}</p>
      <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math practice</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing practice</button></div>
    </div>
  {/if}

  {#if mapTip && cur}<Coach text="Tap here for your first battle!" at=".node.here" place="below" />{/if}

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
            <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math trip</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing lesson</button><button class="btn" onclick={() => game.go('playground')}>Playground</button></div>
            {#if learnTip}<button class="learnlink" onclick={() => game.openLearn(learnTip!.id, 'adventure')}><img src="{base}learn/tile.webp" alt="" /><span><small>A new trick to learn</small><b>{learnTip.title}</b></span><em>Learn it <Icon name="play" size={16} /></em></button>{/if}
          {/if}
        {:else}
          {#if n.kind === 'champion'}
            <div class="champ"><GlimmerCard id={isl.champion} width={112} locked={!owns(a, isl.champion)} /><p><b>{owns(a, isl.champion) ? GLIMMER[isl.champion].name : 'A Legendary Glimmer'}</b> is the grumpiest one on {isl.name}, under the biggest storm cloud. Cheer it up and it joins your team. You also get a special egg, and the next island opens.</p></div>
          {:else}
            <p>{cleared(a, n.id) ? 'You won here! Play again to meet more Glimmers.' : 'A grumpy Glimmer is waiting here. Cheer it up with your answers and it joins your team!'}</p>
            <h3>Who might it be?</h3>
            <div class="who">
              {#each HOW_OFTEN.filter(([, r]) => isl.odds[r]) as [word, r]}
                <div class="whorow"><span class="ww" style:--c={RARITY[r].color}>{word}</span>{#each glimmersOf(r).filter(g => !g.champion) as g}<GlimmerCard id={g.id} width={50} locked={!owns(a, g.id)} />{/each}</div>
              {/each}
            </div>
            <button class="linky" onclick={() => (chances = !chances)}>{chances ? 'Hide' : 'Show'} the exact chances (for grown-ups)</button>
            {#if chances}<p class="muted small">{HOW_OFTEN.filter(([, r]) => isl.odds[r]).map(([, r]) => `${RARITY[r].name} ${isl.odds[r]}%`).join(' · ')}. An egg after 3 in 10 wins, and always after a Perfect Cheer.</p>{/if}
          {/if}
          <div class="teamline"><span>Your team</span>{#each team as t}<span class="tm"><img src="{base}game/glimmers/face/{t}{a.glimmers[t]?.evolved ? '-evo' : ''}.webp" alt="" />{GLIMMER[t].name}</span>{:else}<em>No Glimmers yet: win this battle for your first!</em>{/each}{#if met > 0}<button class="linky" onclick={() => game.go('glimmers')}>Change team</button>{/if}</div>
          <div class="subj"><span>Answer with</span>
            <button class:on={a.subject === 'math'} onclick={() => setSubject('math')}>Math</button>
            <button class:on={a.subject === 'typing'} onclick={() => setSubject('typing')}>Typing</button></div>
          {#if !canPass(a, n) || !play.open}<p class="muted">{play.why}</p>{/if}
          <button class="btn btn-primary big" disabled={!play.open} onclick={() => fight(n)}>{cleared(a, n.id) ? 'Play again' : 'Start the battle!'}</button>
        {/if}
      </div>
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
  .backdrop { position: absolute; inset: -40px; background: var(--bg) center / cover; filter: blur(22px) saturate(1.1); }
  .map { position: absolute; background-size: 100% 100%; box-shadow: 0 0 60px rgba(255, 255, 255, .25); }
  .path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .path path { fill: none; stroke: rgba(255, 255, 255, .9); stroke-dasharray: 1 1.2; vector-effect: non-scaling-stroke; stroke-width: 4; stroke-linecap: round; filter: drop-shadow(0 1px 1px rgba(80, 50, 20, .45)); }
  .node { position: absolute; transform: translate(-50%, -60%); width: clamp(48px, 4.4vw, 72px); aspect-ratio: 1; border: 0; padding: 0; background: none; cursor: pointer; transition: transform .15s; }
  .node img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 6px 6px rgba(60, 30, 10, .4)); }
  .node.champion { width: clamp(64px, 6vw, 98px); }
  .node:hover { transform: translate(-50%, -66%) scale(1.08); }
  .node.done img { filter: drop-shadow(0 4px 4px rgba(60, 30, 10, .35)) saturate(.8); }
  .node.here img { animation: glow 1.4s ease-in-out infinite; }
  @keyframes glow { 50% { filter: drop-shadow(0 0 14px #fff) drop-shadow(0 0 22px #ffd36b); } }
  .tick { position: absolute; right: -6px; top: -6px; line-height: 0; filter: drop-shadow(0 0 1.5px #fff) drop-shadow(0 0 1.5px #fff); }
  .gift { position: absolute; right: -10px; top: -14px; line-height: 0; animation: hop 1s ease-in-out infinite; }
  .me { position: absolute; transform: translate(-50%, -100%); margin-top: -18px; pointer-events: none; filter: drop-shadow(0 8px 6px rgba(40, 20, 10, .45)); animation: hop 1.1s ease-in-out infinite; }
  .next { position: absolute; transform: translate(-50%, 0); margin-top: 22px; font: 600 14px var(--font-ui); color: #fff; background: var(--primary); padding: 2px 10px; border-radius: 999px; box-shadow: 0 0 0 3px #fff; pointer-events: none; }
  @keyframes hop { 50% { translate: 0 -6px; } }
  .crown { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); font: 800 11px var(--font-body); color: #7a5200; background: #fff3c4; padding: 2px 8px; border-radius: 999px; box-shadow: 0 0 0 2px #ffd36b; white-space: nowrap; }
  .iname { position: absolute; transform: translateX(-50%); font: 600 clamp(14px, 1.5vw, 20px) var(--font-ui); color: #fff; text-shadow: 0 2px 6px rgba(60, 30, 10, .85); white-space: nowrap; pointer-events: none; }

  .dock { position: absolute; right: 16px; bottom: 16px; display: flex; gap: 12px; z-index: 4; }
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
  .who { display: flex; flex-direction: column; gap: 4px; }
  .whorow { display: flex; align-items: center; gap: 4px; }
  .ww { width: 120px; flex: none; font: 600 15px var(--font-ui); color: var(--ink); display: flex; align-items: center; gap: 6px; }
  .ww::before { content: ''; width: 10px; height: 10px; border-radius: 50%; background: var(--c); box-shadow: 0 0 6px var(--c); }
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
  .tall .chip { font-size: 15px; padding: 2px 8px 2px 2px; } .tall .chip img { width: 24px; height: 24px; } .tall .chip.time { padding: 4px 8px; font-size: 13px; }
  /* phone header: smaller painted icons so the title keeps its room */
  .tall .chip.time { gap: 3px; padding: 4px 7px 4px 4px; } .tall .chip.time :global(.ico) { width: 16px; height: 16px; } .tall .chip.help :global(.ico) { width: 22px; height: 22px; } .tall .chip.time .mn { display: none; } .tall .chip.help { width: 32px; height: 32px; font-size: 18px; padding: 0; }
  .tall .dock { position: static; flex: none; justify-content: center; gap: 8px; padding: 8px 8px 10px; background: rgba(255, 255, 255, .92); border-top: var(--panel-border); }
  .tall .dock { gap: 6px; padding: 8px 6px 10px; }
  .tall .dock :global(.tile) { width: calc((100vw - 36px) / 5); max-width: 96px; min-width: 0; height: 84px; padding: 6px 2px; gap: 2px; }
  /* on a phone the picture box shrinks so the picture and its word both fit the shorter tile */
  .tall .dock :global(.tile .pic) { width: 46px !important; height: 46px !important; }
  .tall .faces img { width: 34px; height: 34px; }
  .tall .faces img + img { margin-left: -12px; }
  .tall .ww { width: 92px; font-size: 13px; }
  .tall .introcard { grid-template-columns: 1fr; }
  .tall .pic { min-height: 210px; }
  .tall .it { padding: 16px 18px; } .tall .it h2 { font-size: 24px; } .tall .it p { font-size: 16px; }
</style>
