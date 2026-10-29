<script lang="ts">
  // Adventure: the painted map of the sky islands. Each island has battles, a practice stop and a
  // Champion at the end. Your eggs warm in the nest in the corner; shells, your team and the shop are at
  // the top. Grown-ups decide how play time works (Grown-ups page): when it runs out, practice earns more.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { FRIEND } from '../art/cast';
  import { GLIMMER, GLIMMERS, RARITIES, RARITY } from '../adventure/glimmers';
  import { advOf, canPass, cleared, collectStop, currentNode, ISLAND, ISLANDS, NODES, nodeOpen, playLeft, practiceDone, reachStop, SHOP, buy, EGG_ODDS, PLAY_RULES, type MapNode, owns, advView } from '../adventure/state';
  import { SPOTS } from '../adventure/mapSpots';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import Confetti from '../ui/Confetti.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  let tall = $state(innerWidth < 760 || innerHeight > innerWidth * 1.1);
  const spots = $derived(SPOTS[tall ? 'tall' : 'wide']);
  const cur = $derived(currentNode(a));
  let open = $state<MapNode | null>(null);
  let shop = $state(false);
  let burst = $state(0);
  const play = $derived(playLeft(p));
  const egg0 = $derived(a.incubator.find(e => !!e) ?? null);
  const ready = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const team = $derived(a.team.filter(t => t && owns(a, t)) as import('../adventure/glimmers').GlimmerId[]);
  const met = $derived(GLIMMERS.filter(g => owns(a, g.id)).length);

  onMount(() => {
    const onR = () => (tall = innerWidth < 760 || innerHeight > innerWidth * 1.1);
    addEventListener('resize', onR);
    // a practice stop reached: the next practice session finishes it
    game.update(pp => { const ad = advOf(pp), c = currentNode(ad); if (c?.kind === 'practice') reachStop(ad, c.id); });
    return () => removeEventListener('resize', onR);
  });

  function tap(n: MapNode) {
    if (!nodeOpen(a, n)) { sfx.miss(); game.say('Clear the stops before this one first.'); return; }
    open = n; sfx.pop();
  }
  function setSubject(s: 'math' | 'typing') { game.update(pp => { advOf(pp).subject = s; }); sfx.click(); }
  function fight(n: MapNode) {
    if (!play.open) { sfx.miss(); return; }
    game.battleNode = n.id; game.battleKey++; game.go('battle');
  }
  function collect(n: MapNode) {
    let r: ReturnType<typeof collectStop> = null;
    game.update(pp => { r = collectStop(pp, n.id); });
    if (r) { burst++; sfx.complete(); game.say(`+${(r as { shells: number }).shells} shells! Your eggs got warmer too.`); open = null; }
  }
  function goPractice(kind: 'math' | 'typing') {
    if (kind === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); const m = mathOf(p); game.startMath(nextMathLesson(m).id); }
  }
  function buyIt(id: string) {
    let r: ReturnType<typeof buy> = { ok: false };
    game.update(pp => { r = buy(pp, id, id === 'treat' ? (team[0] ?? undefined) : undefined); });
    const res = r as ReturnType<typeof buy>;
    if (res.ok) { sfx.badge(); burst++; game.say(id === 'treat' ? `${GLIMMER[team[0]].name} grew a level!` : `Your egg is ${res.where === 'nest' ? 'in the nest' : 'warming in the incubator'}.`); }
    else { sfx.miss(); game.say(res.why ?? 'Not now.'); }
  }
  const kindName = { battle: 'Battle', practice: 'Practice stop', champion: 'Champion' };
  // dotted path through each island's stops, and between islands
  const pathD = $derived(NODES.map((n, i) => `${i ? 'L' : 'M'}${spots[n.id][0]} ${spots[n.id][1]}`).join(' '));
</script>

<div class="screen adv" class:tall>
  <Header title="Adventure" back={() => game.go('hub')} sub="{met} of {GLIMMERS.length} Glimmers">
    {#snippet right()}
      <span class="chip shells" title="Shells"><img src="{base}game/icon-shell.webp" alt="" />{a.shells}</span>
      {#if play.left !== null}<span class="chip time" class:low={play.left < 3} title={PLAY_RULES[a.settings.rule].text}>⏱ {Math.max(0, Math.floor(play.left))} min</span>{/if}
    {/snippet}
  </Header>

  <div class="mapwrap">
    <div class="map" style:background-image="url({base}game/map-{tall ? 'tall' : 'wide'}.webp)" style:aspect-ratio={tall ? '1024 / 1536' : '1672 / 941'}>
      <svg class="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={pathD} /></svg>
      {#each NODES as n (n.id)}
        {@const done = n.kind === 'practice' ? cleared(a, n.id) : cleared(a, n.id)}
        {@const ok = nodeOpen(a, n)}
        {@const here = cur?.id === n.id}
        <button class="node {n.kind}" class:done class:here class:locked={!ok} style:left="{spots[n.id][0]}%" style:top="{spots[n.id][1]}%" onclick={() => tap(n)} aria-label="{ISLAND[n.island].name}: {kindName[n.kind]}">
          <img src="{base}game/node-{!ok ? 'lock' : n.kind}.webp" alt="" draggable="false" />
          {#if done && n.kind !== 'practice'}<span class="tick">✓</span>{/if}
          {#if n.kind === 'practice' && practiceDone(a, n.id) && !cleared(a, n.id)}<span class="gift">🎁</span>{/if}
          {#if here}<span class="me"><Critter friend={p.buddy} size={tall ? 34 : 46} round /></span>{/if}
          {#if n.kind === 'champion' && ok && !done}<span class="crown">Champion</span>{/if}
        </button>
      {/each}
      {#each ISLANDS as isl, i}
        {@const first = spots[`${isl.id}-0`]}
        <span class="iname" style:left="{first[0]}%" style:top="{first[1] + (tall ? 5.5 : 9)}%">{isl.name}</span>
        {void i}
      {/each}
    </div>
  </div>

  <!-- the incubator in the corner -->
  <button class="nest" onclick={() => game.go('eggs')} aria-label="Your eggs">
    <img class="nimg" src="{base}game/nest.webp" alt="" />
    {#if egg0}
      <img class="egg" class:wob={egg0.have >= egg0.need} src="{base}game/egg-{egg0.rarity}.webp" alt="" />
      <svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" /><circle class="fg" cx="20" cy="20" r="17" style:stroke-dasharray="{(egg0.have / egg0.need) * 106.8} 200" /></svg>
      <span class="ct">{egg0.have >= egg0.need ? 'Hatch!' : `${egg0.have} / ${egg0.need}`}</span>
    {:else}<span class="ct">No eggs yet</span>{/if}
    {#if ready}<span class="badge">{ready}</span>{/if}
  </button>

  <div class="dock">
    <button class="dk" onclick={() => game.go('glimmers')}>
      <span class="teamfaces">{#each team as t}<img src="{base}game/glimmers/{t}.webp" alt="" />{:else}<img src="{base}game/icon-star.webp" alt="" />{/each}</span>
      <b>Team</b></button>
    <button class="dk" onclick={() => game.go('eggs')}><img src="{base}game/egg-rare.webp" alt="" /><b>Eggs</b>{#if ready}<em>{ready}</em>{/if}</button>
    <button class="dk" onclick={() => { shop = true; sfx.pop(); }}><img src="{base}game/icon-shell.webp" alt="" /><b>Shop</b></button>
  </div>

  {#if !play.open}
    <div class="closed card">
      <h2>Adventure is resting</h2>
      <p>{play.why}</p>
      <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math practice</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing practice</button></div>
    </div>
  {/if}

  {#if open}
    {@const n = open}
    {@const isl = ISLAND[n.island]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheetbg" onclick={() => (open = null)}>
      <div class="sheet card" onclick={(e) => e.stopPropagation()}>
        <div class="sh"><img src="{base}game/node-{n.kind}.webp" alt="" /><div><small>{isl.name}</small><h2>{n.kind === 'battle' ? `Battle ${n.n + 1}` : kindName[n.kind]}</h2></div></div>
        {#if n.kind === 'practice'}
          {#if practiceDone(a, n.id) && !cleared(a, n.id)}
            <p>You practised! Collect your reward: 20 shells, and your eggs get warmer.</p>
            <button class="btn btn-primary big" onclick={() => collect(n)}>Collect reward 🎁</button>
          {:else if cleared(a, n.id)}
            <p>Done! Practice any time to warm your eggs and earn play time.</p>
          {:else}
            <p>Finish any practice (a math trip, a typing lesson or a playground game) to clear this stop. Practice also warms your eggs{a.settings.rule === 'balanced' ? ' and earns Adventure time' : ''}.</p>
            {#if a.settings.rule === 'open'}<p class="muted">You can go past it for now; it stays here with its reward.</p>{/if}
            <div class="row"><button class="btn btn-primary" onclick={() => goPractice('math')}>Math trip</button><button class="btn btn-primary" onclick={() => goPractice('typing')}>Typing lesson</button><button class="btn" onclick={() => game.go('playground')}>Playground</button></div>
          {/if}
        {:else}
          {#if n.kind === 'champion'}
            <div class="champ"><GlimmerCard id={isl.champion} width={120} locked={!owns(a, isl.champion)} /><p>A huge storm hangs over {isl.name}. Inside it: a Legendary Glimmer. Cheer it up and it joins your team, with a Rare or better egg.</p></div>
          {:else}
            <p>Something is glowing inside this Grumble. What you might find here:</p>
            <div class="odds">{#each RARITIES.filter(r => isl.odds[r]) as r}<span class="od" style:--c={RARITY[r].color}><i></i>{RARITY[r].name} <b>{isl.odds[r]}%</b></span>{/each}</div>
            <p class="muted small">A Perfect Cheer can make it shimmer into a rarer one. You might find an egg, too.</p>
          {/if}
          <div class="subj"><span>Battle with</span>
            <button class:on={a.subject === 'math'} onclick={() => setSubject('math')}>Math</button>
            <button class:on={a.subject === 'typing'} onclick={() => setSubject('typing')}>Typing</button></div>
          {#if !canPass(a, n) || !play.open}<p class="muted">{play.why}</p>{/if}
          <button class="btn btn-primary big" disabled={!play.open} onclick={() => fight(n)}>{cleared(a, n.id) ? 'Battle again' : 'Battle!'}</button>
        {/if}
      </div>
    </div>
  {/if}

  {#if shop}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheetbg" onclick={() => (shop = false)}>
      <div class="sheet card shopbox" onclick={(e) => e.stopPropagation()}>
        <div class="sh"><img src="{base}game/icon-shell.webp" alt="" /><div><small>You have {a.shells} shells</small><h2>Island Shop</h2></div></div>
        <div class="items">
          {#each SHOP as it}
            <div class="item">
              <img src="{base}game/{it.egg ? `egg-${it.egg}` : 'icon-star'}.webp" alt="" />
              <b>{it.name}</b><span>{it.text}{it.id === 'treat' && team[0] ? ` (for ${GLIMMER[team[0]].name})` : ''}</span>
              <button class="btn btn-primary" disabled={a.shells < it.price || (it.id === 'treat' && !team[0])} onclick={() => buyIt(it.id)}><img src="{base}game/icon-shell.webp" alt="" />{it.price}</button>
            </div>
          {/each}
        </div>
        <p class="muted small">Egg odds from battles: {EGG_ODDS} Everything here is bought with shells you earn, never with money.</p>
      </div>
    </div>
  {/if}
  <Confetti {burst} count={60} x={50} y={40} />
</div>

<style>
  .adv { display: flex; flex-direction: column; background: linear-gradient(#bfe3ff, #fbe8d6); overflow: hidden; }
  .chip { display: flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); background: #fff; border-radius: 999px; padding: 4px 12px 4px 4px; box-shadow: var(--shadow-sm); }
  .chip img { width: 30px; height: 30px; }
  .chip.time { padding: 6px 12px; font-size: 15px; }
  .chip.time.low { background: #fff0f2; color: #b02a48; }
  .mapwrap { flex: 1; min-height: 0; display: grid; place-items: center; overflow: auto; }
  .map { position: relative; width: min(100%, calc((100vh - 74px) * 1.777)); background-size: cover; background-position: center; }
  .tall .map { width: 100%; }
  .path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .path path { fill: none; stroke: rgba(255, 255, 255, .85); stroke-width: .45; stroke-dasharray: .9 .9; vector-effect: non-scaling-stroke; stroke-width: 4; stroke-linecap: round; filter: drop-shadow(0 1px 1px rgba(80, 50, 20, .4)); }
  .node { position: absolute; transform: translate(-50%, -60%); width: clamp(44px, 4.6vw, 70px); aspect-ratio: 1; border: 0; padding: 0; background: none; cursor: pointer; transition: transform .15s; }
  .node img { width: 100%; height: 100%; filter: drop-shadow(0 6px 6px rgba(60, 30, 10, .4)); }
  .node.champion { width: clamp(60px, 6.4vw, 96px); }
  .node:hover { transform: translate(-50%, -66%) scale(1.08); }
  .node.done img { filter: drop-shadow(0 4px 4px rgba(60, 30, 10, .35)) saturate(.75); }
  .node.here img { animation: here 1.2s ease-in-out infinite; }
  @keyframes here { 50% { transform: translateY(-6px); filter: drop-shadow(0 12px 10px rgba(60, 30, 10, .35)) drop-shadow(0 0 14px #fff); } }
  .node.locked { opacity: .9; }
  .tick { position: absolute; right: -4px; top: -4px; width: 24px; height: 24px; border-radius: 50%; background: #2fbf73; color: #fff; font: 800 14px/24px var(--font-body); box-shadow: 0 0 0 3px #fff; }
  .gift { position: absolute; right: -8px; top: -10px; font-size: 22px; animation: here 1s ease-in-out infinite; }
  .me { position: absolute; left: 50%; bottom: 88%; transform: translateX(-50%); filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .35)); pointer-events: none; }
  .crown { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); font: 800 11px var(--font-body); color: #7a5200; background: #fff3c4; padding: 2px 8px; border-radius: 999px; box-shadow: 0 0 0 2px #ffd36b; white-space: nowrap; }
  .iname { position: absolute; transform: translateX(-50%); font: 600 clamp(13px, 1.4vw, 19px) var(--font-ui); color: #fff; text-shadow: 0 2px 6px rgba(60, 30, 10, .8); white-space: nowrap; pointer-events: none; }

  .nest { position: absolute; left: 14px; top: 84px; width: 150px; height: 120px; border: 0; background: none; cursor: pointer; z-index: 4; }
  .nimg { position: absolute; left: 0; bottom: 6px; width: 150px; filter: drop-shadow(0 6px 8px rgba(60, 30, 10, .35)); }
  .egg { position: absolute; left: 50%; bottom: 30px; width: 58px; transform: translateX(-50%); filter: drop-shadow(0 4px 6px rgba(0, 0, 0, .3)); }
  .egg.wob { animation: wob .6s ease-in-out infinite; }
  @keyframes wob { 25% { transform: translateX(-50%) rotate(-10deg); } 75% { transform: translateX(-50%) rotate(10deg); } }
  .ring { position: absolute; right: 6px; top: 2px; width: 44px; height: 44px; transform: rotate(-90deg); }
  .ring circle { fill: rgba(255, 255, 255, .85); stroke: #e9e2f6; stroke-width: 4; }
  .ring .fg { fill: none; stroke: #ffb52e; stroke-linecap: round; }
  .nest .ct { position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%); font: 600 14px var(--font-ui); background: #fff; color: var(--ink); padding: 2px 10px; border-radius: 999px; box-shadow: var(--shadow-sm); white-space: nowrap; }
  .badge { position: absolute; right: 0; top: 0; min-width: 24px; height: 24px; border-radius: 999px; background: var(--pink, #ef6fa6); color: #fff; font: 800 13px/24px var(--font-body); box-shadow: 0 0 0 3px #fff; }

  .dock { position: absolute; right: 16px; bottom: 16px; display: flex; gap: 10px; z-index: 4; }
  .dk { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; width: 92px; padding: 8px 6px; border-radius: 22px; border: 0; background: rgba(255, 255, 255, .94); box-shadow: 0 10px 24px -12px rgba(40, 20, 80, .6); cursor: pointer; }
  .dk > img { width: 46px; height: 46px; object-fit: contain; }
  .dk b { font: 600 16px var(--font-ui); color: var(--ink); }
  .dk em { position: absolute; right: 4px; top: 4px; min-width: 22px; height: 22px; border-radius: 999px; background: var(--pink, #ef6fa6); color: #fff; font: 800 12px/22px var(--font-body); font-style: normal; }
  .teamfaces { display: flex; height: 46px; align-items: center; }
  .teamfaces img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 2px #fff; }
  .teamfaces img + img { margin-left: -12px; }

  .closed { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 6; padding: 22px 26px; text-align: center; width: min(460px, 92vw); }
  .closed h2 { margin: 0 0 6px; } .closed p { font-weight: 600; color: var(--ink2); }
  .row { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .sheetbg { position: absolute; inset: 0; z-index: 10; background: rgba(40, 28, 70, .35); display: grid; place-items: center; animation: fade .2s; }
  @keyframes fade { from { opacity: 0; } }
  .sheet { width: min(520px, 94vw); padding: 18px 22px 20px; display: flex; flex-direction: column; gap: 10px; animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); max-height: 90vh; overflow: auto; }
  @keyframes pop { from { transform: scale(.9); opacity: 0; } }
  .sh { display: flex; align-items: center; gap: 12px; }
  .sh img { width: 60px; height: 60px; }
  .sh small { font: 800 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .sh h2 { margin: 0; font-size: 28px; }
  .sheet p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .small { font-size: 13px !important; }
  .big { font-size: 22px; padding: 12px 22px; }
  .champ { display: flex; gap: 14px; align-items: center; }
  .odds { display: flex; flex-wrap: wrap; gap: 6px; }
  .od { display: flex; align-items: center; gap: 6px; font: 700 13px var(--font-body); background: #f6f3fb; border-radius: 999px; padding: 4px 10px; }
  .od i { width: 12px; height: 12px; border-radius: 50%; background: var(--c); box-shadow: 0 0 6px var(--c); }
  .subj { display: flex; align-items: center; gap: 6px; font: 700 14px var(--font-body); color: var(--ink2); }
  .subj button { border: 0; border-radius: 999px; padding: 8px 16px; font: 600 16px var(--font-ui); background: #f1ecfb; color: var(--ink2); cursor: pointer; }
  .subj button.on { background: var(--primary); color: #fff; }
  .items { display: flex; flex-direction: column; gap: 8px; }
  .item { display: grid; grid-template-columns: 56px 1fr auto; grid-template-rows: auto auto; column-gap: 12px; align-items: center; background: #faf8fe; border-radius: 18px; padding: 8px 12px; }
  .item > img { grid-row: span 2; width: 56px; height: 56px; object-fit: contain; }
  .item b { font: 600 18px var(--font-ui); } .item span { font: 600 13px var(--font-body); color: var(--muted); grid-column: 2; }
  .item .btn { grid-row: 1 / span 2; grid-column: 3; display: flex; align-items: center; gap: 4px; }
  .item .btn img { width: 22px; height: 22px; }

  .tall :global(.hd .tt span) { display: none; }
  .tall .chip { font-size: 15px; padding: 2px 8px 2px 2px; } .tall .chip img { width: 24px; height: 24px; } .tall .chip.time { padding: 4px 8px; font-size: 13px; }
  .tall .nest { top: auto; bottom: 92px; left: 8px; width: 112px; height: 96px; }
  .tall .nimg { width: 112px; }
  .tall .egg { width: 44px; bottom: 24px; }
  .tall .dock { left: 8px; right: 8px; bottom: 8px; justify-content: flex-end; }
  .tall .dk { width: 76px; padding: 6px 4px; }
  .tall .dk > img, .tall .teamfaces { height: 34px; width: auto; }
  .tall .teamfaces img { width: 32px; height: 32px; }
  .tall .mapwrap { place-items: start center; }
</style>
