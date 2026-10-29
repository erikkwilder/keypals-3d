<script lang="ts">
  // Your Glimmers: every one you've cheered up or hatched, in its card, and the ones still out there as
  // dark shapes. Tap one to see it in 3D on its stone, read its power, and put it on your team (two
  // battle beside your buddy).
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { GlimmerShow } from '../three/glimmerShow';
  import { ELEMENT, GLIMMER, GLIMMERS, RARITY, RARITIES, type GlimmerId } from '../adventure/glimmers';
  import { advOf, owns, xpNeed, MAX_LEVEL, advView } from '../adventure/state';
  import Header from '../ui/Header.svelte';
  import GlimmerCard from '../ui/GlimmerCard.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const sorted = [...GLIMMERS].sort((x, y) => RARITIES.indexOf(x.rarity) - RARITIES.indexOf(y.rarity));
  const firstOwned = (sorted.find(g => owns(advView(game.profile!), g.id)) ?? sorted[0]).id;
  let sel = $state<GlimmerId>(firstOwned);
  let scene: GlimmerShow | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  const g = $derived(GLIMMER[sel]);
  const mine = $derived(a.glimmers[sel]);
  const inTeam = $derived(a.team.indexOf(sel));

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
    if (owns(a, sel)) sc.show(sel);
    requestAnimationFrame(onResize);
    // seen: no more "new" dots
    game.update(pp => { advOf(pp).fresh = []; });
  });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  function pick(id: GlimmerId) {
    sel = id; sfx.pop();
    if (owns(a, id)) scene?.show(id); else game.say(`${RARITY[GLIMMER[id].rarity].name}. Find it in battles or eggs!`);
  }
  function setTeam(slot: number) {
    game.update(pp => { const ad = advOf(pp); const other = ad.team.indexOf(sel); if (other >= 0) ad.team[other] = null; ad.team[slot] = sel; });
    sfx.badge(); scene?.poke();
  }
  function leaveTeam() { game.update(pp => { const ad = advOf(pp); const i = ad.team.indexOf(sel); if (i >= 0) ad.team[i] = null; }); sfx.pop(); }
  const fresh = $derived(new Set(a.fresh));
</script>

<div class="screen gl">
  <Header title="Glimmers" back={() => game.go('adventure')} sub="{GLIMMERS.filter(x => owns(a, x.id)).length} of {GLIMMERS.length} found" />
  <div class="body">
    <div class="stagebox" bind:this={stageEl}>
      {#if !owns(a, sel)}<div class="unknown"><GlimmerCard id={sel} width={200} locked /></div>{/if}
    </div>
    <div class="side">
      <div class="info card r-{g.rarity}">
        <div class="ih">
          <img src="{base}game/icon-{g.element}.webp" alt={ELEMENT[g.element].name} />
          <div><small style:color={RARITY[g.rarity].color}>{RARITY[g.rarity].name} · {ELEMENT[g.element].name}</small><h2>{owns(a, sel) ? g.name : '???'}</h2></div>
          {#if mine}<span class="lv">Level {mine.level}</span>{/if}
        </div>
        {#if mine}
          <p class="pw"><b>{g.power.name}:</b> {g.power.text(mine.level)}</p>
          <p class="qk">{g.quirk}</p>
          {#if mine.level < MAX_LEVEL}<div class="xp"><div class="bar"><i style:width="{(mine.xp / xpNeed(mine.level)) * 100}%"></i></div><span>{mine.xp}/{xpNeed(mine.level)} to level {mine.level + 1}</span></div>{/if}
          <div class="teamrow">
            {#each [0, 1] as slot}
              <button class="slot" class:on={a.team[slot] === sel} onclick={() => setTeam(slot)}>
                {#if a.team[slot] && owns(a, a.team[slot]!)}<img src="{base}game/glimmers/{a.team[slot]}.webp" alt="" />{:else}<span class="empty">+</span>{/if}
                <small>{a.team[slot] === sel ? 'On the team' : `Team spot ${slot + 1}`}</small>
              </button>
            {/each}
            {#if inTeam >= 0}<button class="btn" onclick={leaveTeam}>Take off the team</button>{/if}
          </div>
        {:else}
          <p class="pw">Not found yet. {g.champion ? 'It is the Champion at the end of an island.' : 'It can be inside any Grumble, or hatch from an egg.'}</p>
        {/if}
      </div>
      <div class="grid scroll">
        {#each sorted as x (x.id)}
          <button class="cell" class:on={sel === x.id} onclick={() => pick(x.id)}>
            <GlimmerCard id={x.id} width={118} level={a.glimmers[x.id]?.level} locked={!owns(a, x.id)} fresh={fresh.has(x.id)} />
          </button>
        {/each}
      </div>
    </div>
  </div>
</div>

<style>
  .gl { display: flex; flex-direction: column; background: transparent; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(380px, 1.1fr); gap: 18px; padding: 16px 20px; }
  .stagebox { position: relative; min-height: 0; }
  .unknown { position: absolute; inset: 0; display: grid; place-items: center; }
  .side { min-height: 0; display: flex; flex-direction: column; gap: 12px; }
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
  .teamrow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
  .slot { display: flex; align-items: center; gap: 8px; border: 3px dashed #d9cff0; background: #faf8fe; border-radius: 18px; padding: 4px 12px 4px 4px; cursor: pointer; }
  .slot.on { border-style: solid; border-color: var(--primary-hi); background: #f3eeff; }
  .slot img, .slot .empty { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; object-position: center 35%; display: grid; place-items: center; font: 600 26px var(--font-ui); color: #b8acd6; background: #fff; }
  .slot small { font: 700 13px var(--font-body); color: var(--ink2); }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 10px; align-content: start; padding: 4px; }
  .cell { border: 0; background: none; padding: 3px; border-radius: 16px; cursor: pointer; display: grid; place-items: center; transition: transform .15s; }
  .cell:hover { transform: translateY(-3px); }
  .cell.on { background: rgba(255, 255, 255, .7); box-shadow: 0 0 0 3px var(--primary-hi); }
  @media (max-width: 760px) {
    .body { grid-template-columns: 1fr; grid-template-rows: 34vh 1fr; padding: 10px; gap: 10px; }
    .ih h2 { font-size: 24px; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); }
  }
</style>
