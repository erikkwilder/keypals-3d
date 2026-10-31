<script lang="ts">
  // The Shop's Island and Glimmers sections: the same page as Wear (screens/Closet.svelte), in the same place
  // in the game's 3D world. On the left the stage, where the thing you picked stands and turns as a real
  // model (a thing for My Sky Island on a patch of ground, an egg in its nest, a Glimmer enjoying a treat),
  // with the same card under it saying what it is and what you have, and Buy. On the right the picture tiles
  // and the cards. The cards and tiles here copy Wear's sizes on purpose: if one changes, change both.
  // Island things go into the island's storage, to put out on My Sky Island (its build tray sells the very
  // same things at the very same prices); special paints are for its blocks. Glimmers has the eggs and the
  // treats, five things on bigger cards. Every purchase goes in "What I earned" (as shells spent).
  import { onDestroy, onMount, tick } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView, teamOf } from '../adventure/state';
  import { GLIMMER, RARITY, type GlimmerId } from '../adventure/glimmers';
  import { KINDS } from '../island/catalog';
  import { GROUP_NAME, buyShop, careHave, careText, eggsHeld, groupsOf, haveOf, many, onIslandOf, paintColour, sectionOf, type Group, type Section, type ShopEntry } from './shop';
  import { drawThumbs } from '../three/islandThumbs';
  import { BlockKit } from '../three/islandBlocks';
  import { PropKit } from '../island/props3d';
  import { stage } from '../three/stage';
  import { ShowScene, type OnShow } from '../three/showScene';
  import { eggInNest, groundPatch, islandThing, treatTime } from '../three/shopThings';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import Turntable from '../ui/Turntable.svelte';

  let { section }: { section: Exclude<Section, 'wear'> } = $props();
  const base = import.meta.env.BASE_URL;
  const ISLAND_GREEN = '#2fbf73';
  const p = $derived(game.profile!);
  const adv = $derived(advView(p));
  const shells = $derived(adv.shells);
  const fmt = (n: number) => n.toLocaleString('en-US');
  const all = $derived(sectionOf(section));
  const groups = $derived(groupsOf(section));
  const firstGlimmer = $derived<GlimmerId | null>(teamOf(adv)[0]?.id ?? null);
  const isCare = $derived(section === 'care');

  // ---------- which things: the tiles, and Sort and filter ----------
  type Show = 'all' | 'mine' | 'notyet' | 'afford';
  type Sort = 'kind' | 'cheap' | 'pricey';
  const SHOWS: { id: Show; name: string }[] = [{ id: 'all', name: 'Everything' }, { id: 'mine', name: 'Mine' }, { id: 'notyet', name: 'Not mine yet' }, { id: 'afford', name: 'I can buy' }];
  const SORTS: { id: Sort; name: string }[] = [{ id: 'kind', name: 'By kind' }, { id: 'cheap', name: 'Cheapest' }, { id: 'pricey', name: 'Priciest' }];
  let group = $state<Group | 'all'>('all');
  let showing = $state<Show>('all');
  let sort = $state<Sort>('kind');
  let filtersOpen = $state(false);
  const shows = (e: ShopEntry) => {
    const mine = haveOf(p, e.key) > 0;
    return showing === 'all' || (showing === 'mine' && mine) || (showing === 'notyet' && !mine) || (showing === 'afford' && (e.price ?? 0) <= shells && !(mine && !many(e)));
  };
  // (the catalogue's own order: homes first, then trees, water and so on)
  const ORDER: Record<Sort, (a: ShopEntry, b: ShopEntry) => number> = { kind: () => 0, cheap: (a, b) => (a.price ?? 0) - (b.price ?? 0), pricey: (a, b) => (b.price ?? 0) - (a.price ?? 0) };
  const list = $derived(isCare ? all : all.filter(e => (group === 'all' || e.group === group) && shows(e)).sort(ORDER[sort]));
  const rail = $derived<(Group | 'all')[]>(['all', ...groups]);
  // the tiles keep to one short word, like Wear's
  const TILE: Partial<Record<Group | 'all', string>> = { all: 'All', paint: 'Paints', habitat: 'Glimmers', dream: 'Dreams', ...Object.fromEntries(KINDS.filter(k => k.id !== 'habitat' && k.id !== 'dream').map(k => [k.id, k.short])) };
  /** a tile's picture: the first thing on that shelf */
  const tilePic = (g: Group | 'all') => (g === 'all' ? `${base}island/tile.webp` : (thumbs[all.find(e => e.group === g)?.thumb ?? ''] ?? null));

  // ---------- the stage ----------
  let sel = $state.raw<ShopEntry | null>(null);
  let burst = $state(0);
  let thumbs = $state<Record<string, string>>({});
  let stageEl: HTMLDivElement | undefined = $state();
  let scene = $state.raw<ShowScene | null>(null);
  let patch = $state.raw<Awaited<ReturnType<typeof groundPatch>> | null>(null);
  let kits: Promise<{ kit: PropKit; blk: BlockKit }> | null = null;
  let disposed = false;
  const kitsNow = () => (kits ??= Promise.all([PropKit.load(), BlockKit.load()]).then(([kit, blk]) => ({ kit, blk })));
  /** where the thing stands: above the card, exactly as the buddy does on Wear */
  function viewOf() {
    const r = stageEl?.getBoundingClientRect(), card = innerWidth < 760 ? 96 : innerHeight < 820 ? 124 : 150;
    return r ? { top: r.top / innerHeight, bottom: Math.max(r.top + 120, r.bottom - card) / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.2, bottom: 0.95, left: 0, right: 0.45 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }

  // (a new section: every shelf, and the first thing on show)
  let was: Section | null = null;
  $effect(() => {
    const s = section;
    if (s === was) return;
    was = s; group = 'all'; showing = 'all'; filtersOpen = false; sel = null;
    if (s === 'island') void drawPics();
  });
  async function drawPics() {
    const ids = sectionOf('island').map(e => e.thumb).filter((x): x is string => !!x);
    for (let i = 0; i < 40 && !stage.renderer; i++) await new Promise(res => setTimeout(res, 100));
    const { kit, blk } = await kitsNow();
    if (!disposed) await drawThumbs(kit, blk, ids, (id, url) => { if (!disposed) thumbs[id] = url; }, 168, () => !disposed);
  }
  // something is always on show, like the buddy on Wear: the thing you picked, or the first on the shelf
  $effect(() => { const l = list; if (!sel || !l.some(e => e.key === sel?.key)) sel = l[0] ?? null; });
  let putN = 0;
  async function putOnStage(e: ShopEntry | null) {
    const n = ++putN, sc = scene, ground = patch?.root;
    if (!sc || !ground) return;
    let t: OnShow | null = null;
    try {
      if (e?.section === 'island') { const { kit, blk } = await kitsNow(); const th = islandThing(e, kit, blk); t = th && { ...th, ground, angle: -0.5 }; }
      else if (e?.egg) t = { ...(await eggInNest(e.pic!)), ground };
      else if (e) t = { ...(await treatTime(e.id === 'treat' ? 'star' : 'biscuit', firstGlimmer)), ground };
    } catch { t = null; }
    if (n !== putN || disposed) { t?.dispose?.(); return; }
    sc.put(t);
  }
  $effect(() => { const e = sel; if (scene && patch) void putOnStage(e); });

  onMount(() => {
    addEventListener('resize', onResize);
    void (async () => {
      const [sc, ground] = await Promise.all([ShowScene.create({ buddies: [], view: viewOf(), spot: 10 }), groundPatch()]);
      if (disposed) { sc.dispose(); ground.dispose(); return; }
      scene = sc; patch = ground;
      // (going to another section the old scene runs on until the new one takes over: no flash of white)
      sc.onGone = () => { ground.dispose(); void kits?.then(k => { k.kit.dispose(); k.blk.dispose(); }); };
      stage.use(sc);
      // the layout may still be settling: measure the stage area again in a moment
      requestAnimationFrame(onResize); setTimeout(onResize, 400);
    })();
  });
  onDestroy(() => {
    disposed = true; putN++;
    removeEventListener('resize', onResize);
    if (scene && stage.current() === scene && game.screen !== 'shop') stage.use(null);
  });

  // ---------- the card under the stage ----------
  const picOf = (e: ShopEntry) => (e.pic ? `${base}${e.pic}` : e.thumb ? thumbs[e.thumb] ?? null : null);
  function pick(e: ShopEntry) { sel = e; sfx.pop(); }
  function setGroup(g: Group | 'all') { if (g === group) return; group = g; sel = null; sfx.pop(); void tick().then(onResize); }
  /** the colour of a thing's card: an egg's rarity, gold for what's worth saving up for, the section's own */
  const rimOf = (e: ShopEntry) => (e.egg ? RARITY[e.egg].color : e.dream ? '#ffc94d' : e.section === 'care' ? '#ff8fbf' : ISLAND_GREEN);
  const pillOf = (e: ShopEntry) => (e.egg ? RARITY[e.egg].name : e.group === 'treats' ? 'Treat' : e.dream ? 'Dream' : TILE[e.group] ?? GROUP_NAME[e.group]);
  /** what you have of it */
  function haveLine(e: ShopEntry): string {
    if (e.section === 'care') return careHave(p, e);
    const n = haveOf(p, e.key);
    if (e.group === 'paint') return n ? 'Yours! Build with them in Blocks on My Sky Island.' : 'Yours for every block you build, once you buy them.';
    if (!n) return 'It waits in your storage on My Sky Island.';
    const on = onIslandOf(p, e.key);
    return `You have ${n}: ${on} on your island, ${n - on} in storage.`;
  }
  const owned = (e: ShopEntry) => !many(e) && haveOf(p, e.key) > 0;
  const blocked = (e: ShopEntry) => e.id === 'treat' && !firstGlimmer;

  function buy(e: ShopEntry) {
    let r: ReturnType<typeof buyShop> = { ok: false };
    game.update(pp => { r = buyShop(pp, e.key); }, { bought: [e.key] });
    const res = r as ReturnType<typeof buyShop>;
    if (!res.ok) { sfx.nope(); game.say(res.why ?? 'Not now.'); return; }
    sfx.buy(); burst++;
    if (e.group === 'paint') game.say(`${e.name} are yours! Build with them on My Sky Island.`, 3600);
    else if (e.section === 'island') game.say(`The ${e.name} is in your storage. Put it on My Sky Island!`, 3600);
    else if (e.id === 'island-treats') game.say('Three treats! Give them to your Glimmers on My Sky Island.', 3600);
    else if (e.id === 'treat') game.say(`${firstGlimmer ? GLIMMER[firstGlimmer].name : 'Your Glimmer'} grew a level!`, 3600);
    else game.say(`Your new egg is ${res.where === 'nest' ? 'waiting in the nest' : 'in a warm nest: practise to hatch it'}.`, 3600);
  }
  /** to the island (back to it, when that's where the Shop was opened from), the thing ready to put out */
  function toIsland(e: ShopEntry | null) {
    sfx.click();
    game.islandPlace = e && e.section === 'island' && e.group !== 'paint' ? e.id : null;
    if (game.backTo()?.screen === 'island') game.back(); else game.visit('island');
  }
  function toEggs() { sfx.click(); if (game.backTo()?.screen === 'eggs') game.back(); else game.visit('eggs'); }
  function toGlimmers() { sfx.click(); if (game.backTo()?.screen === 'glimmers') game.back(); else game.visit('glimmers'); }
  const warm = $derived(adv.incubator.filter(Boolean).length);
  const eggsNow = $derived(warm + adv.nest.length);
  const glimmersNow = $derived(Object.keys(adv.glimmers).length);
  const treatsNow = $derived(haveOf(p, 'care:island-treats'));
  const held = (e: ShopEntry) => (e.egg ? eggsHeld(p, e.egg).warm + eggsHeld(p, e.egg).waiting : haveOf(p, e.key));
</script>

<div class="body">
  <div class="left">
    <div class="wholine">
      {#if isCare}
        <span class="whochip"><img src="{base}game/egg-rare.webp" alt="" /><b>My Glimmers</b></span>
        <button class="btn chgbtn" onclick={toEggs}><img src="{base}game/egg-common.webp" alt="" />See my eggs</button>
      {:else}
        <span class="whochip"><img src="{base}island/tile.webp" alt="" /><b>My Sky Island</b></span>
        <button class="btn chgbtn" onclick={() => toIsland(null)}><img src="{base}island/card.webp" alt="" />Go there</button>
      {/if}
    </div>
    <div class="stagebox" bind:this={stageEl}>
      <Confetti {burst} count={50} x={50} y={45} />
      <Turntable scene={() => scene} el={stageEl} top />
      {#if sel}
        {@const e = sel}
        {@const pic = picOf(e)}
        {@const n = haveOf(p, e.key)}
        <div class="tryon card" style:--rc={rimOf(e)}>
          {#if pic}<img src={pic} alt="" />{:else}<i class="wait"></i>{/if}
          <div class="tt">
            <small>{GROUP_NAME[e.group]}{e.dream ? ' · worth saving up for' : ''}</small>
            <b>{e.name}</b>
            <span>{e.section === 'care' ? careText(e, firstGlimmer).line : e.blurb}</span>
            <i class="keepline" class:yes={n > 0}>{#if n > 0}<Icon name="check" size={14} /> {/if}{haveLine(e)}</i>
          </div>
          <div class="act">
            {#if owned(e)}<em class="have"><Icon name="check" size={14} /> Yours</em>
            {:else}
              <button class="btn btn-primary buy" disabled={shells < (e.price ?? 0) || blocked(e)} onclick={() => buy(e)}>
                <img src="{base}game/icon-shell.webp" alt="" />{shells < (e.price ?? 0) ? `${fmt((e.price ?? 0) - shells)} more` : `Buy: ${fmt(e.price ?? 0)}`}
              </button>
            {/if}
            {#if e.section === 'island' && n > 0}<button class="btn" onclick={() => toIsland(e)}>{e.group === 'paint' ? 'Build with them' : 'Put it on my island'}</button>{/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
  <div class="side">
    <p class="sidehead">{isCare ? 'Eggs hatch into new Glimmers as you practise. Treats make your Glimmers happy.' : 'Tap anything to see it, then buy it. Put it out on My Sky Island.'}</p>
    {#if isCare}
      <!-- five things need no filters: these tiles say what you have, and take you to it -->
      <div class="rail few">
        <div class="rw"><button class="rb" onclick={toEggs}><span class="rpic"><img src="{base}game/egg-common.webp" alt="" /></span><span class="count"><b>{eggsNow} {eggsNow === 1 ? 'egg' : 'eggs'}</b><small>Warm nests: {warm} of 3</small></span></button></div>
        <div class="rw"><button class="rb" onclick={toGlimmers}><span class="rpic"><img src="{base}game/icon-star.webp" alt="" /></span><span class="count"><b>{glimmersNow} {glimmersNow === 1 ? 'Glimmer' : 'Glimmers'}</b><small>Your friends so far</small></span></button></div>
        <div class="rw"><button class="rb" onclick={() => toIsland(null)}><span class="rpic"><img src="{base}island/treat.webp" alt="" /></span><span class="count"><b>{treatsNow} {treatsNow === 1 ? 'treat' : 'treats'}</b><small>In your bag on the island</small></span></button></div>
      </div>
      <div class="biggrid scroll">
        {#each list as e (e.key)}
          {@const n = held(e)}
          {@const c = careText(e, firstGlimmer)}
          <button class="it big" class:treat={!e.egg} class:sel={sel?.key === e.key} style:--rc={rimOf(e)} onclick={() => pick(e)}>
            <span class="rar">{pillOf(e)}</span>
            {#if n > 0}<span class="hasn" title="You have {n}">{n}</span>{/if}
            <img src={picOf(e)} alt="" loading="lazy" />
            <b>{e.name}</b>
            <span class="gets">{c.gets}</span>
            <span class="then">{c.then}</span>
            <em class="price"><img src="{base}game/icon-shell.webp" alt="" />{fmt(e.price ?? 0)}</em>
          </button>
        {/each}
      </div>
    {:else}
      <div class="rail" role="tablist" aria-label="Shelves">
        {#each rail as g (g)}
          {@const pic = tilePic(g)}
          <div class="rw">
            <button class="rb" role="tab" aria-selected={group === g} class:on={group === g} title={g === 'all' ? 'Everything' : GROUP_NAME[g]} onclick={() => setGroup(g)}>
              <span class="rpic">{#if pic}<img src={pic} alt="" />{/if}</span>
              <small>{TILE[g] ?? GROUP_NAME[g as Group]}</small>
            </button>
          </div>
        {/each}
      </div>
      <div class="sortbar">
        <button class="btn sfbtn" class:on={filtersOpen} aria-expanded={filtersOpen} onclick={() => { filtersOpen = !filtersOpen; sfx.pop(); }}><Icon name="swap" size={18} /> Sort and filter</button>
        <span class="sfnow">{SHOWS.find(x => x.id === showing)?.name} · {SORTS.find(x => x.id === sort)?.name}</span>
      </div>
      {#if filtersOpen}
        <div class="filters">
          <div class="chips shows">{#each SHOWS as s (s.id)}<button class:on={showing === s.id} onclick={() => { showing = s.id; sfx.pop(); }}>{s.name}</button>{/each}</div>
          <div class="chips sorts"><span class="sortby">Sort:</span>{#each SORTS as o (o.id)}<button class:on={sort === o.id} onclick={() => { sort = o.id; sfx.pop(); }}>{o.name}</button>{/each}</div>
        </div>
      {/if}
      <div class="sgrid scroll">
        {#each list as e (e.key)}
          {@const pic = picOf(e)}
          {@const n = haveOf(p, e.key)}
          <button class="it" class:sel={sel?.key === e.key} class:short={!owned(e) && shells < (e.price ?? 0)} style:--rc={rimOf(e)} onclick={() => pick(e)}>
            <span class="rar">{pillOf(e)}</span>
            {#if e.group === 'paint'}<span class="swatch" style:--pc="#{(paintColour(e) ?? 0xffffff).toString(16).padStart(6, '0')}"></span>{/if}
            {#if pic}<img src={pic} alt="" loading="lazy" />{:else}<i class="wait"></i>{/if}
            <b>{e.name}</b>
            {#if owned(e)}<em class="have"><Icon name="check" size={13} /> Yours</em>
            {:else}
              {#if n > 0}<span class="where">You have {n}</span>{/if}
              <em class="price"><img src="{base}game/icon-shell.webp" alt="" />{fmt(e.price ?? 0)}</em>
            {/if}
          </button>
        {:else}
          <p class="none">Nothing here yet.</p>
        {/each}
      </div>
    {/if}
    <p class="foot">Shells come from practice and battles. Nothing here costs real money.</p>
  </div>
</div>

<style>
  /* the page: the same as Wear's (Closet.svelte), size for size */
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(400px, 1.15fr); gap: 18px; padding: 14px 20px; }
  .left { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
  .stagebox { position: relative; flex: 1; min-height: 0; }
  .side { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .wholine { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; flex: none; }
  .whochip { display: inline-flex; align-items: center; gap: 8px; padding: 4px 16px 4px 4px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 2px #e6def5, 0 6px 16px -8px rgba(40, 20, 80, .45); }
  .whochip img { width: 40px; height: 40px; object-fit: contain; }
  .whochip b { font: 600 24px/1 var(--font-ui); color: var(--ink); white-space: nowrap; }
  .chgbtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px 6px 8px; font-size: 17px; white-space: nowrap; }
  .chgbtn img { width: 28px; height: 28px; object-fit: contain; }
  .sidehead { margin: 0; align-self: center; font: 700 16px/1.3 var(--font-body); color: var(--ink2); text-align: center; flex: none; background: rgba(255, 255, 255, .9); padding: 4px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  /* the tiles */
  .rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; flex: none; }
  .rw { position: relative; display: grid; min-width: 0; }
  .rb { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 2px 4px; border-radius: 16px; border: 3px solid transparent; background: rgba(255, 255, 255, .92); cursor: pointer; box-shadow: var(--shadow-sm); font: inherit; min-width: 0; }
  .rb.on { border-color: #ffb627; background: #fff; }
  .rb small { font: 800 11px var(--font-body); color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .rpic { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: radial-gradient(circle at 50% 40%, #fff, #f1ecfb); box-shadow: inset 0 0 0 2px var(--rc, #e4ddf3); }
  .rpic img { width: 38px; height: 38px; object-fit: contain; }
  /* (Glimmers: what you have, a picture and a number) */
  .few .rpic { flex: none; }
  .few .rb { flex-direction: row; justify-content: flex-start; gap: 10px; padding: 5px 12px 5px 6px; text-align: left; }
  .count { display: flex; flex-direction: column; min-width: 0; }
  .count b { font: 600 18px/1.1 var(--font-ui); color: var(--ink); white-space: nowrap; }
  /* sort and filter */
  .sortbar { display: flex; align-items: center; gap: 10px; flex: none; }
  .sfbtn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; font-size: 15px; }
  .sfbtn.on { background: var(--primary); color: #fff; }
  .sfnow { font: 700 13px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .85); padding: 4px 10px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .filters { display: flex; flex-direction: column; gap: 6px; flex: none; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chips button { border: 0; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); padding: 5px 12px; border-radius: 999px; box-shadow: inset 0 0 0 2px #e4ddf3; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .chips button.on { background: var(--primary); color: #fff; box-shadow: none; }
  .shows button.on { background: #2fbf73; }
  .sorts button.on { background: #ffc94d; color: #5a3d00; }
  .sortby { align-self: center; font: 800 13px var(--font-body); color: var(--ink2); white-space: nowrap; background: rgba(255, 255, 255, .7); padding: 4px 8px; border-radius: 999px; }
  /* the cards */
  .sgrid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; align-content: start; padding: 4px 2px 8px; }
  .it { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 6px 8px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px var(--rc), var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .it:hover { transform: translateY(-3px); }
  .it.sel { box-shadow: 0 0 0 4px var(--primary-hi), 0 0 18px rgba(124, 92, 245, .35); }
  .it > img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .it.short > img { opacity: .6; }
  .it > .wait { width: 64px; height: 64px; }
  .it b { font: 600 15px/1.1 var(--font-ui); color: var(--ink); }
  .it .where { font: 700 11px var(--font-body); color: #1f8f55; display: inline-flex; align-items: center; gap: 3px; }
  .it .rar { position: absolute; top: 5px; left: 50%; transform: translateX(-50%); font: 800 10px var(--font-body); color: #fff; background: var(--rc); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .it em { margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .price { background: #fff3d6; color: #7a5300; }
  .price img { width: 16px; height: 16px; object-fit: contain; }
  .have { background: #2fbf73; color: #fff; }
  .swatch { position: absolute; right: 8px; top: 8px; width: 20px; height: 20px; border-radius: 50%; background: var(--pc); box-shadow: 0 0 0 2px #fff, 0 2px 6px rgba(0, 0, 0, .25); }
  .wait { display: block; width: 64px; height: 64px; border-radius: 50%; background: #efe9f8; animation: pulse 1.2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .45; } }
  .none { grid-column: 1 / -1; margin: 0; text-align: center; font: 600 16px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .92); padding: 10px; border-radius: 16px; }
  /* Glimmers: five things, so bigger cards: three eggs across, the two treats under them, filling the side */
  .biggrid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(max-content, 1fr)); gap: 12px; padding: 4px 2px 8px; }
  .it.big { grid-column: span 2; gap: 3px; padding: 22px 10px 12px; }
  .it.big.treat { grid-column: span 3; }
  .it.big > img { width: 104px; height: 104px; }
  .it.big b { font-size: 21px; }
  .it.big .gets { font: 800 14px/1.25 var(--font-body); color: var(--ink); }
  .it.big .then { font: 600 13px/1.25 var(--font-body); color: var(--ink2); }
  .it.big em { margin-top: auto; font-size: 14px; padding: 4px 14px; }
  .hasn { position: absolute; top: 8px; right: 8px; min-width: 26px; height: 26px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; display: grid; place-items: center; font: 800 13px var(--font-body); color: #fff; background: #2fbf73; box-shadow: 0 0 0 2px #fff; }
  /* the card under the stage: Wear's try-on card */
  .tryon { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); z-index: 3; width: min(480px, 98%); display: grid; grid-template-columns: 64px 1fr; gap: 6px 12px; align-items: center; padding: 10px 14px; box-shadow: 0 0 0 3px var(--rc), var(--shadow); }
  .tryon > img { width: 64px; height: 64px; object-fit: contain; grid-row: span 2; }
  .tryon > .wait { grid-row: span 2; }
  .tryon .tt { display: flex; flex-direction: column; min-width: 0; }
  .tryon small { font: 800 11px var(--font-body); color: var(--ink2); text-transform: uppercase; letter-spacing: .04em; }
  .tryon b { font: 600 20px var(--font-ui); }
  .tryon .tt span { font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .tryon .act { grid-column: 2; display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tryon .act .btn { padding: 6px 14px; font-size: 15px; }
  .keepline { display: inline-flex; align-items: center; gap: 4px; font: 700 13px/1.25 var(--font-body); font-style: normal; color: var(--ink2); }
  .keepline.yes { color: #1f8f55; }
  .tryon em { font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .buy { display: inline-flex; align-items: center; gap: 6px; }
  .buy img { width: 20px; height: 20px; object-fit: contain; }
  /* (on its own chip: readable over the 3D scene) */
  .foot { margin: 0; align-self: center; flex: none; font: 600 13px/1.3 var(--font-body); color: var(--ink2); text-align: center; background: rgba(255, 255, 255, .94); padding: 4px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  @media (max-height: 820px) and (min-width: 761px) {
    .body { padding: 10px 20px; gap: 14px; }
    .sidehead { font-size: 14px; padding: 2px 12px; }
    .rpic { width: 38px; height: 38px; } .rpic img { width: 32px; height: 32px; }
    .rb { padding: 3px 2px 2px; } .rb small { font-size: 10px; }
    .sgrid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
    .it { padding: 15px 4px 5px; gap: 1px; } .it > img { width: 44px; height: 44px; } .it > .wait { width: 44px; height: 44px; } .it b { font-size: 14px; } .it em { margin-top: 2px; padding: 2px 8px; }
    .biggrid { gap: 8px; }
    .it.big { padding: 18px 6px 6px; } .it.big > img { width: 72px; height: 72px; } .it.big b { font-size: 18px; } .it.big .gets { font-size: 13px; } .it.big .then { font-size: 12px; }
    .tryon { padding: 8px 12px; } .tryon > img { width: 52px; height: 52px; } .tryon b { font-size: 18px; }
    .foot { display: none; }
  }
  @media (max-width: 1100px) and (min-width: 761px) { .body { grid-template-columns: minmax(0, .85fr) minmax(400px, 1.15fr); } }
  @media (max-width: 760px) {
    .whochip b { font-size: 20px; } .whochip img { width: 34px; height: 34px; } .chgbtn { font-size: 15px; padding: 2px 12px 2px 6px; } .chgbtn img { width: 24px; height: 24px; }
    .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); padding: 8px 10px; gap: 8px; }
    .left { gap: 6px; }
    .stagebox { flex: none; height: 36vh; }
    /* phones: the whole panel under the stage scrolls, so the pieces never squash to nothing */
    .side { overflow-y: auto; padding-bottom: 16px; }
    .sgrid, .biggrid { flex: none; overflow: visible; }
    .sidehead { font-size: 13px; }
    .rail { grid-auto-flow: row; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-columns: auto; padding: 2px 0 0; }
    .rail.few { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .few .rb { flex-direction: column; gap: 0; padding: 4px 2px; text-align: center; } .count { align-items: center; } .count small { white-space: normal; font-size: 10px; line-height: 1.1; }
    .rpic { width: 40px; height: 40px; } .rpic img { width: 34px; height: 34px; }
    .sgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .it > img { width: 52px; height: 52px; } .it > .wait { width: 52px; height: 52px; }
    .it b { font-size: 13px; }
    .biggrid { gap: 8px; grid-template-rows: none; }
    .hasn { top: 22px; right: 4px; min-width: 22px; height: 22px; font-size: 12px; }
    .it.big { padding: 18px 4px 8px; } .it.big > img { width: 64px; height: 64px; } .it.big b { font-size: 15px; } .it.big .gets { font-size: 12px; } .it.big .then { font-size: 11px; }
    .tryon { grid-template-columns: 44px 1fr; padding: 6px 10px; gap: 4px 10px; }
    .tryon > img { width: 44px; height: 44px; }
    .tryon > .wait { width: 44px; height: 44px; }
    .tryon b { font-size: 16px; } .tryon .tt span { display: none; }
    .keepline { font-size: 12px; }
    .chips button { font-size: 12px; padding: 4px 9px; }
  }
</style>
