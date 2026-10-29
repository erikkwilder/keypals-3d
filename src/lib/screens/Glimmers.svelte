<script lang="ts">
  // Your Glimmers: every one you've cheered up or hatched, in its card, and the ones still out there as
  // dark shapes. Tap one to see it in 3D on its stone, read its power, and put it on your team (two
  // battle beside your buddy). At level 5 a Glimmer can evolve: tap Evolve and watch it grow up.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { GlimmerShow } from '../three/glimmerShow';
  import { ELEMENT, EVOLVE_AT, EVOLVE_BOOST, EVOLVED, GLIMMER, GLIMMERS, RARITY, RARITIES, glimmerName, rarityRank, type GlimmerId } from '../adventure/glimmers';
  import { advOf, owns, xpNeed, MAX_LEVEL, advView, markSeen } from '../adventure/state';
  import { canEvolve, evolve, levelsToEvolve } from '../adventure/evolve';
  import Header from '../ui/Header.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';
  import Coach from '../ui/Coach.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const sorted = [...GLIMMERS].sort((x, y) => RARITIES.indexOf(x.rarity) - RARITIES.indexOf(y.rarity));
  const firstOwned = (game.glimmerSel as GlimmerId | null) ?? (sorted.find(g => owns(advView(game.profile!), g.id)) ?? sorted[0]).id;
  game.glimmerSel = null;
  let sel = $state<GlimmerId>(firstOwned);
  /** adding to a full team: tap which one it replaces */
  let swapping = $state(false);
  const owned = $derived(sorted.filter(x => owns(a, x.id)));
  const missing = $derived(sorted.filter(x => !owns(a, x.id)));
  let scene: GlimmerShow | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  const g = $derived(GLIMMER[sel]);
  const mine = $derived(a.glimmers[sel]);
  const inTeam = $derived(a.team.indexOf(sel));
  /** a Glimmer's name as you know it (grown up once evolved) */
  const nameOf = (id: GlimmerId) => glimmerName(id, !!a.glimmers[id]?.evolved);
  const evo = (id: GlimmerId) => !!a.glimmers[id]?.evolved;
  const ready = (id: GlimmerId) => canEvolve(a, id);
  // the evolution: the scene plays, then the new card
  let evolving = $state<GlimmerId | null>(null);
  let grown = $state<GlimmerId | null>(null);
  async function doEvolve() {
    if (!scene || evolving || !ready(sel)) return;
    const id = sel;
    evolving = id; swapping = false; sfx.whoosh(); tipDone();
    let hs = 0; const hum = setInterval(() => sfx.evolveCharge(hs++), 700);
    await scene.evolve(id, () => {
      clearInterval(hum);
      game.update(pp => { evolve(pp, id); });
      sfx.evolve(rarityRank(GLIMMER[id].rarity));
    });
    clearInterval(hum);
    setTimeout(() => { evolving = null; grown = id; sfx.pop(); }, 1300);
  }
  // first time one is ready: a tip at the button
  const tipOn = $derived(!evolving && !grown && owns(a, sel) && ready(sel) && !(a.seen ?? []).includes('evolve1'));
  function tipDone() { if (!(a.seen ?? []).includes('evolve1')) game.update(pp => markSeen(pp, 'evolve1')); }
  // on a phone the cards scroll under the 3D view: when the one shown is ready, bring its Evolve row into sight
  let sideEl: HTMLDivElement | undefined = $state();
  let shownReady = '';
  $effect(() => {
    const id = sel, r = owns(a, id) && ready(id);
    if (!r || !sideEl || shownReady === id || sideEl.scrollHeight <= sideEl.clientHeight + 4) return;
    shownReady = id;
    requestAnimationFrame(() => {
      const row = sideEl?.querySelector('.evorow'); if (!row || !sideEl) return;
      const top = row.getBoundingClientRect().top - sideEl.getBoundingClientRect().top + sideEl.scrollTop - 150;
      sideEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    });
  });

  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.15, bottom: 0.7, left: 0, right: 0.45 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const sc = await GlimmerShow.create(viewOf(), 'treetops');
    if (disposed) { sc.dispose(); return; }
    scene = sc; stage.use(sc);
    if (owns(a, sel)) sc.show(sel, false, evo(sel));
    requestAnimationFrame(onResize);
    // seen: no more "new" dots
    game.update(pp => { advOf(pp).fresh = []; });
  });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function pick(id: GlimmerId) {
    if (evolving) return;
    sel = id; sfx.pop(); swapping = false;
    if (owns(a, id)) scene?.show(id, false, evo(id)); else game.say(`${RARITY[GLIMMER[id].rarity].name}. Find it in battles or eggs!`);
  }
  function setTeam(slot: number) {
    game.update(pp => { const ad = advOf(pp); const other = ad.team.indexOf(sel); if (other >= 0) ad.team[other] = null; ad.team[slot] = sel; });
    sfx.equip(); scene?.poke(); swapping = false;
    game.say(`${nameOf(sel)} is on your team!`);
  }
  function add() {
    const empty = a.team.findIndex(t => !t || !owns(a, t));
    if (empty >= 0) setTeam(empty); else { swapping = true; sfx.pop(); }
  }
  function leaveTeam() { game.update(pp => { const ad = advOf(pp); const i = ad.team.indexOf(sel); if (i >= 0) ad.team[i] = null; }); sfx.pop(); }
  const fresh = $derived(new Set(a.fresh));
  const RARE_WORDS: Record<string, string> = { common: 'easy to find', uncommon: 'a bit harder to find', rare: 'hard to find', epic: 'very hard to find', legendary: 'one of a kind', mythic: 'the rarest of all' };
</script>

<div class="screen gl">
  <Header title="Your Glimmers" back={() => game.go('adventure')} sub="{GLIMMERS.filter(x => owns(a, x.id)).length} of {GLIMMERS.length} found" />
  <div class="body">
    <div class="stagebox" bind:this={stageEl}>
      {#if !owns(a, sel)}<div class="unknown"><GlimmerCard id={sel} width={200} locked /></div>{/if}
      {#if evolving}<div class="evobanner"><b>What's happening?</b><span>{GLIMMER[evolving].name} is evolving!</span></div>{/if}
    </div>
    <div class="side" bind:this={sideEl}>
      <div class="teambox card" class:swapping>
        <h3>Your team <small>{swapping ? `Tap who ${nameOf(sel)} replaces` : 'These two come into every battle with you'}</small></h3>
        <div class="slots">
          {#each [0, 1] as slot}
            {@const t = a.team[slot] && owns(a, a.team[slot]!) ? a.team[slot] : null}
            <button class="slot" class:filled={!!t} onclick={() => (swapping ? setTeam(slot) : t ? pick(t) : null)}>
              {#if t}<GlimmerCard id={t} width={110} level={a.glimmers[t]?.level} evolved={evo(t)} ready={ready(t)} />{:else}<span class="empty">+<small>Empty</small></span>{/if}
              {#if swapping}<span class="swapin">Swap</span>{/if}
            </button>
          {/each}
          {#if !swapping && owned.length > 2}<p class="how">To change it: tap a Glimmer below, then <b>Add to team</b>.</p>{/if}
        </div>
      </div>
      <div class="info card r-{g.rarity}">
        <div class="ih">
          <img src="{base}game/icon-{g.element}.webp" alt={ELEMENT[g.element].name} />
          <div><small style:color={RARITY[g.rarity].color}>{RARITY[g.rarity].name} · {RARE_WORDS[g.rarity]}</small><h2>{owns(a, sel) ? nameOf(sel) : '???'}{#if mine?.evolved}<span class="evochip">★ Evolved</span>{/if}</h2></div>
          {#if mine}<span class="lv">Level {mine.level}</span>{/if}
        </div>
        {#if mine}
          <p class="pw"><b>In battles it helps you:</b> {g.power.text(mine.level + (mine.evolved ? EVOLVE_BOOST : 0))}</p>
          {#if mine.evolved}<p class="pw perk"><img src="{base}game/icon-star.webp" alt="" /><span><b>Grown-up power:</b> {EVOLVED[sel].perk}</span></p>{/if}
          {#if mine.level < MAX_LEVEL}<div class="xp"><div class="bar"><i style:width="{(mine.xp / xpNeed(mine.level)) * 100}%"></i></div><span>Level {mine.level + 1} after a few more battles</span></div>{/if}
          {#if !mine.evolved}
            <!-- before and after: now, an arrow, the grown-up form still a mystery -->
            <div class="evorow" class:go={ready(sel)}>
              <GlimmerCard id={sel} width={50} />
              <span class="arr">➜</span>
              <div class="mystery"><GlimmerCard id={sel} width={50} evolved locked /></div>
              {#if ready(sel)}
                <div class="evotext"><b>{g.name} is ready to grow up!</b><small>It gets a new look, a new name and a stronger power.</small></div>
                <button class="btn evolvebtn" onclick={doEvolve} disabled={!!evolving}>Evolve!</button>
              {:else}
                <div class="evotext"><b>Grows up at level {EVOLVE_AT}</b><small>{levelsToEvolve(a, sel)} more level{levelsToEvolve(a, sel) === 1 ? '' : 's'} to go. Win battles with it on your team.</small></div>
              {/if}
            </div>
          {/if}
          {#if inTeam >= 0}
            <div class="acts"><span class="onteam">✓ On your team</span><button class="btn" onclick={leaveTeam}>Take off</button></div>
          {:else}
            <div class="acts"><button class="btn btn-primary big" onclick={add}>Add {nameOf(sel)} to your team</button>{#if swapping}<button class="btn" onclick={() => (swapping = false)}>Cancel</button>{/if}</div>
          {/if}
        {:else}
          <p class="pw">Not found yet. {g.champion ? 'It\'s the Champion at the end of an island: cheer it up there.' : 'You might meet it grumpy in a battle, or it might hatch from an egg.'}</p>
        {/if}
      </div>
      <div class="grid scroll">
        <h4>Your Glimmers ({owned.length})</h4>
        <div class="cards">
          {#each owned as x (x.id)}
            <button class="cell" class:on={sel === x.id} class:team={a.team.includes(x.id)} onclick={() => pick(x.id)}>
              <GlimmerCard id={x.id} width={104} level={a.glimmers[x.id]?.level} fresh={fresh.has(x.id)} evolved={evo(x.id)} ready={ready(x.id)} />
              {#if a.team.includes(x.id)}<span class="tag">Team</span>{/if}
            </button>
          {/each}
        </div>
        {#if missing.length}<h4>Still to find ({missing.length})</h4>
        <div class="cards">
          {#each missing as x (x.id)}<button class="cell" class:on={sel === x.id} onclick={() => pick(x.id)}><GlimmerCard id={x.id} width={84} locked /></button>{/each}
        </div>{/if}
      </div>
    </div>
  </div>
  {#if grown}
    {@const gid = grown}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="evobg" onclick={() => (grown = null)}>
      <div class="evocard card" onclick={(e) => e.stopPropagation()}>
        <div class="evorays"></div>
        <p class="evohead">{GLIMMER[gid].name} grew up into</p>
        <h2>{EVOLVED[gid].name}!</h2>
        <div class="evopic"><GlimmerCard id={gid} width={190} level={a.glimmers[gid]?.level} evolved shine /></div>
        <p class="pw"><b>In battles it helps you:</b> {GLIMMER[gid].power.text((a.glimmers[gid]?.level ?? 1) + EVOLVE_BOOST)}</p>
        <p class="pw perk"><img src="{base}game/icon-star.webp" alt="" /><span><b>New grown-up power:</b> {EVOLVED[gid].perk}</span></p>
        <button class="btn btn-primary big" onclick={() => (grown = null)}>Hooray!</button>
      </div>
    </div>
  {/if}
  {#if tipOn}<Coach text="{g.name} is ready to grow up! Tap Evolve to watch it change." at=".evolvebtn" button="OK" onok={tipDone} />{/if}
</div>

<style>
  .gl { display: flex; flex-direction: column; background: transparent; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(380px, 1.1fr); gap: 18px; padding: 16px 20px; }
  .stagebox { position: relative; min-height: 0; }
  .unknown { position: absolute; inset: 0; display: grid; place-items: center; }
  .side { min-height: 0; display: flex; flex-direction: column; gap: 12px; }
  .intro { margin: 0; font: 600 15px/1.4 var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .88); border-radius: 16px; padding: 8px 14px; }
  .info { padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; }
  .ih { display: flex; align-items: center; gap: 12px; }
  .ih img { width: 52px; height: 52px; }
  .ih small { font: 800 13px var(--font-body); text-transform: uppercase; letter-spacing: .05em; }
  .ih h2 { margin: 0; font-size: 30px; }
  .lv { margin-left: auto; font: 600 16px var(--font-ui); background: var(--primary); color: #fff; padding: 4px 12px; border-radius: 999px; }
  .pw { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .qk { margin: 0; font: 600 14px var(--font-body); color: var(--muted); font-style: italic; }
  .xp { display: flex; align-items: center; gap: 10px; font: 700 12px var(--font-body); color: var(--muted); }
  .bar { flex: 1; height: 10px; border-radius: 999px; background: var(--bg2); overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ffb52e, #ff7ab8); }
  .teambox { padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; transition: box-shadow .2s; }
  .teambox.swapping { box-shadow: 0 0 0 4px #ffd36b, var(--shadow-sm); }
  .teambox h3 { margin: 0; font-size: 20px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .teambox h3 small { font: 700 13px var(--font-body); color: var(--muted); }
  .slots { display: flex; gap: 14px; align-items: center; }
  .how { margin: 0 0 0 6px; max-width: 220px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .slot { position: relative; border: 0; background: none; padding: 0; cursor: pointer; }
  .slot .empty { width: 110px; aspect-ratio: 394 / 600; border-radius: 14px; border: 3px dashed #d9cff0; display: flex; flex-direction: column; align-items: center; justify-content: center; font: 600 34px/1 var(--font-ui); color: #b8acd6; background: #faf8fe; }
  .slot .empty small { font: 700 12px var(--font-body); }
  .swapin { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); font: 800 13px var(--font-body); background: #ffd36b; color: #6a4300; padding: 4px 12px; border-radius: 999px; animation: pulse .9s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: translateX(-50%) scale(1.1); } }
  .acts { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
  .acts .big { font-size: 18px; padding: 10px 18px; }
  .onteam { font: 600 17px var(--font-ui); color: #1f9a6a; }
  .grid h4 { margin: 4px 0; font-size: 16px; color: var(--ink2); grid-column: 1 / -1; }
  .cards { display: flex; flex-wrap: wrap; gap: 8px 8px; row-gap: 14px; padding-bottom: 6px; }
  .cell { position: relative; }
  .cell .tag { position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%); font: 800 11px var(--font-body); background: #2fbf73; color: #fff; padding: 2px 9px; border-radius: 999px; box-shadow: 0 0 0 2px #fff; }
  .grid { flex: 1; min-height: 0; overflow: auto; padding: 8px 12px 12px; background: rgba(255, 255, 255, .86); border-radius: 22px; box-shadow: var(--shadow-sm); }
  .cell { border: 0; background: none; padding: 3px; border-radius: 16px; cursor: pointer; display: grid; place-items: center; transition: transform .15s; }
  .cell:hover { transform: translateY(-3px); }
  .cell.on { background: rgba(255, 255, 255, .7); box-shadow: 0 0 0 3px var(--primary-hi); }
  /* evolving */
  .evochip { display: inline-block; white-space: nowrap; margin-left: 10px; vertical-align: middle; font: 800 13px var(--font-body); color: #6a4300; background: linear-gradient(#ffe68a, #ffc93d); padding: 3px 10px; border-radius: 999px; }
  .perk { display: flex; align-items: center; gap: 8px; }
  .perk img { width: 26px; height: 26px; flex: none; }
  .evorow { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 18px; background: #faf8fe; }
  .evorow.go { background: linear-gradient(#fff8dc, #ffecb0); box-shadow: 0 0 0 2px #ffd36b; }
  .evorow .arr { font: 600 22px var(--font-ui); color: #c9a23a; }
  .mystery { position: relative; }
  .evotext { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .evotext b { font: 600 17px var(--font-ui); color: var(--ink); }
  .evotext small { font: 600 13px/1.35 var(--font-body); color: var(--ink2); }
  .evolvebtn { flex: none; font: 600 20px var(--font-ui); padding: 12px 22px; color: #5a3900; background: linear-gradient(#ffe68a, #ffc23a); box-shadow: 0 0 0 3px #fff, 0 0 18px #ffd36b; animation: evobtn 1.2s ease-in-out infinite; }
  @keyframes evobtn { 50% { box-shadow: 0 0 0 3px #fff, 0 0 30px #ffc23a; } }
  .evobanner { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); z-index: 20; white-space: nowrap; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 26px; border-radius: 24px; background: rgba(255, 255, 255, .92); box-shadow: 0 0 0 4px #ffd36b, var(--shadow-sm); text-align: center; pointer-events: none; }
  .evobanner b { font: 700 14px var(--font-body); color: var(--muted); }
  .evobanner span { font: 600 28px var(--font-ui); color: var(--ink); animation: evotext 0.8s ease-in-out infinite; }
  @keyframes evotext { 50% { color: #c98a00; } }
  .evobg { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: rgba(40, 28, 70, .45); padding: 16px; }
  .evocard { position: relative; overflow: hidden; width: min(440px, 94vw); max-height: 94vh; overflow-y: auto; padding: 18px 22px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
  .evorays { position: absolute; inset: -40%; background: repeating-conic-gradient(from 0deg, rgba(255, 214, 90, .22) 0 10deg, transparent 10deg 20deg); animation: rays 14s linear infinite; pointer-events: none; }
  @keyframes rays { to { transform: rotate(360deg); } }
  .evohead { position: relative; margin: 0; font: 700 16px var(--font-body); color: var(--muted); }
  .evocard h2 { position: relative; margin: 0; font-size: 34px; color: #c07a00; }
  .evopic { position: relative; animation: pop .7s cubic-bezier(.2, 1.4, .4, 1) both; }
  @keyframes pop { from { transform: scale(.4) rotate(-8deg); opacity: 0; } }
  .evocard .pw { position: relative; text-align: left; }
  .evocard .btn { position: relative; }
  @media (max-width: 760px) {
    .evorow { flex-wrap: wrap; }
    .evolvebtn { width: 100%; }
    .evobanner { top: 8px; padding: 6px 16px; } .evobanner span { font-size: 20px; }
    .body { grid-template-columns: 1fr; grid-template-rows: 30vh 1fr; padding: 10px; gap: 10px; }
    /* the team, the card and the list scroll together under the 3D view */
    .side { overflow-y: auto; padding-bottom: 12px; }
    .side > * { flex: none; }
    .grid { overflow: visible; }
    .ih h2 { font-size: 24px; }
    .slot .empty { width: 80px; }
  }
</style>
