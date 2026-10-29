<script lang="ts">
  // The Island Shop: one shop for the whole game, opened from Home, the Adventure map and the Wardrobe.
  // Things to wear (every slot, filtered by where it goes and by what it's like) and the Adventure's
  // eggs and treats, all for shells. Tap a thing to try it on your buddy (nothing changes until you
  // buy it or wear it); what you buy is yours for every buddy.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { FRIEND } from '../art/cast';
  import { GLIMMER, RARITY } from '../adventure/glimmers';
  import { advView, buy, EGG_ODDS, ISLAND, SHOP, teamOf } from '../adventure/state';
  import { SLOT_NAME, WEAR_SLOTS, type WearSlot } from '../adventure/gear';
  import { CATALOG, CAT, VIBES, bestFriendship, buyItem, howText, ownsItem, wearItem, wornIn, type CatalogItem, type Vibe } from '../adventure/wardrobe';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShowScene } from '../three/showScene';
  import Header from '../ui/Header.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import Turntable from '../ui/Turntable.svelte';

  const base = import.meta.env.BASE_URL;
  const narrow = innerWidth < 760;
  const p = $derived(game.profile!);
  const who = game.profile!.buddy;
  const adv = $derived(advView(p));
  const team = $derived(teamOf(adv).map(t => t.id));
  let tab = $state<'wear' | 'eggs'>('wear');
  let slot = $state<WearSlot | 'all'>((game.shopSlot as WearSlot) ?? 'all');
  let vibe = $state<Vibe | 'all'>('all');
  let sel = $state<CatalogItem | null>(null);
  let burst = $state(0);
  const RAR_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  // what's for sale first (cheapest first), then friendship gifts and Champion prizes
  const list = $derived(CATALOG
    .filter(c => (slot === 'all' || c.slot === slot) && (vibe === 'all' || c.vibe === vibe))
    .sort((a, b) => (a.how === 'shop' ? 0 : 1) - (b.how === 'shop' ? 0 : 1) || (a.price ?? 0) - (b.price ?? 0) || RAR_ORDER.indexOf(a.rarity) - RAR_ORDER.indexOf(b.rarity)));

  // ---------- the buddy on show, trying things on ----------
  let scene: ShowScene | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    // the buddy stands above the try-on card at the bottom of this area
    const card = innerWidth < 760 ? 150 : 165;
    return r ? { top: r.top / innerHeight, bottom: Math.max(r.top + 120, r.bottom - card) / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.2, bottom: 0.75, left: 0, right: 0.4 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const sc = await ShowScene.create({ buddies: [who], view: viewOf(), spot: 10, fromSave: true });
    if (disposed) { sc.dispose(); return; }
    scene = sc; stage.use(sc); sc.select(who);
    requestAnimationFrame(onResize); setTimeout(onResize, 400);
  });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });

  /** Tap a thing: try it on (the buddy's real look comes back when you pick something else or leave). */
  function tryOn(c: CatalogItem) {
    sel = c; sfx.pop();
    if (!scene) return;
    // (compare ids: a $state value is a proxy, never === the plain item)
    void scene.redress(who).then(() => { if (sel?.id !== c.id) return; if (c.slot === 'head') { scene?.char(who)?.nudgeHat(null); void scene?.wear(who, c.id); } else void scene?.wearGear(who, c.slot, c.id); });
  }
  function buyIt(c: CatalogItem) {
    let r: { ok: boolean; why?: string } = { ok: false };
    game.update(pp => { r = buyItem(pp, who, c.id); });
    if (!r.ok) { sfx.nope(); if (r.why) game.say(r.why); return; }
    burst++; sfx.buy();
    void scene?.redress(who);
    game.say(`The ${c.name} is yours! ${FRIEND[who].name} has it on, and every buddy can wear it.`);
  }
  function wearIt(c: CatalogItem) {
    game.update(pp => { wearItem(pp, who, c.slot, c.id); });
    void scene?.redress(who);
    burst++; sfx.equip();
  }
  function buyThing(id: string) {
    let r: ReturnType<typeof buy> = { ok: false };
    game.update(pp => { r = buy(pp, id, id === 'treat' ? (team[0] ?? undefined) : undefined); });
    const res = r as ReturnType<typeof buy>;
    if (res.ok) { sfx.buy(); burst++; game.say(id === 'treat' ? `${GLIMMER[team[0]].name} grew a level!` : `Your new egg is ${res.where === 'nest' ? 'waiting in the nest' : 'in the incubator: practice to hatch it'}.`); }
    else { sfx.nope(); game.say(res.why ?? 'Not now.'); }
  }
  const island = (id: string) => ISLAND[id as keyof typeof ISLAND]?.name ?? id;
  const mineCount = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
</script>

<div class="screen shop">
  <Header title="Island Shop" sub={narrow ? undefined : 'Things to wear for every buddy, eggs and treats'} back={() => { sfx.click(); game.go(game.shopBack); }}>
    {#snippet right()}<span class="wallet"><img src="{base}game/icon-shell.webp" alt="" /><b>{adv.shells}</b> shells</span>{/snippet}
  </Header>
  <div class="body">
    <div class="stagebox" bind:this={stageEl}>
      <Confetti {burst} count={50} x={50} y={45} />
      <Turntable scene={() => scene} el={stageEl} top />
      {#if sel && tab === 'wear'}
        {@const mine = ownsItem(p, sel.id)}
        {@const on = wornIn(p, who, sel.slot) === sel.id}
        <div class="tryon card" style:--rc={RARITY[sel.rarity].color}>
          <img src="{base}{sel.icon}" alt="" />
          <div class="tt">
            <small>{RARITY[sel.rarity].name} · {SLOT_NAME[sel.slot]}{sel.power ? '' : ' · just for fun'}</small>
            <b>{sel.name}</b>
            <span>{sel.power ? `In battles: ${sel.text}` : sel.text}</span>
          </div>
          <div class="act">
            {#if on}<em class="have"><Icon name="check" size={14} /> {FRIEND[who].name} has it on</em>
            {:else if mine}<button class="btn btn-primary" onclick={() => wearIt(sel!)}>Wear it</button>
            {:else if sel.how === 'shop'}<button class="btn btn-primary buy" disabled={adv.shells < (sel.price ?? 0)} onclick={() => buyIt(sel!)}><img src="{base}game/icon-shell.webp" alt="" />{adv.shells < (sel.price ?? 0) ? `${(sel.price ?? 0) - adv.shells} more` : `Buy: ${sel.price}`}</button>
            {:else if sel.how === 'friendship'}<em class="gift"><Icon name="heart" size={14} /> Friendship {sel.level} with any buddy (best: {bestFriendship(p)})</em>
            {:else}<em class="champ"><Icon name="trophy" size={14} /> {howText(sel, island)}</em>{/if}
          </div>
        </div>
      {:else if tab === 'wear'}
        <p class="hint">Tap anything to try it on {FRIEND[who].name}.</p>
      {/if}
    </div>
    <div class="side">
      <div class="tabs">
        <button class:on={tab === 'wear'} onclick={() => { tab = 'wear'; sfx.pop(); }}><img src="{base}outfits/party_hat.webp" alt="" /><span>Things to wear</span><em>{mineCount}/{CATALOG.length}</em></button>
        <button class:on={tab === 'eggs'} onclick={() => { tab = 'eggs'; sel = null; void scene?.redress(who); sfx.pop(); }}><img src="{base}game/egg-rare.webp" alt="" /><span>Eggs and treats</span></button>
      </div>
      {#if tab === 'wear'}
        <div class="filters">
          <div class="chips">
            <button class:on={slot === 'all'} onclick={() => { slot = 'all'; sfx.pop(); }}>All</button>
            {#each WEAR_SLOTS as s (s)}<button class:on={slot === s} onclick={() => { slot = s; sfx.pop(); }}>{SLOT_NAME[s]}</button>{/each}
          </div>
          <div class="chips vibes">
            <button class:on={vibe === 'all'} onclick={() => { vibe = 'all'; sfx.pop(); }}>Any vibe</button>
            {#each VIBES as v (v.id)}<button class:on={vibe === v.id} onclick={() => { vibe = v.id; sfx.pop(); }}>{v.name}</button>{/each}
          </div>
        </div>
        <div class="grid scroll">
          {#each list as c (c.id)}
            {@const mine = ownsItem(p, c.id)}
            <button class="it" class:sel={sel?.id === c.id} class:mine style:--rc={RARITY[c.rarity].color} onclick={() => tryOn(c)}>
              <span class="rar">{RARITY[c.rarity].name}</span>
              <img src="{base}{c.icon}" alt="" loading="lazy" />
              <b>{c.name}</b>
              <span class="where">{SLOT_NAME[c.slot]}{#if c.power} · <Icon name="shield" size={12} />{/if}</span>
              {#if mine}<em class="have"><Icon name="check" size={13} /> Yours</em>
              {:else if c.how === 'shop'}<em class="price"><img src="{base}game/icon-shell.webp" alt="" />{c.price}</em>
              {:else if c.how === 'friendship'}<em class="gift"><Icon name="heart" size={13} /> {c.level}</em>
              {:else}<em class="champ"><Icon name="trophy" size={14} /> Prize</em>{/if}
            </button>
          {:else}
            <p class="none">Nothing like that yet. Try another vibe!</p>
          {/each}
        </div>
      {:else}
        <div class="eggs scroll">
          {#each SHOP as it (it.id)}
            <div class="egg card">
              <img src="{base}game/{it.egg ? `egg-${it.egg}` : 'icon-star'}.webp" alt="" />
              <div><b>{it.name}</b><span>{it.text}{it.id === 'treat' && team[0] ? ` (for ${GLIMMER[team[0]].name})` : ''}</span></div>
              <button class="btn btn-primary" disabled={adv.shells < it.price || (it.id === 'treat' && !team[0])} onclick={() => buyThing(it.id)}><img src="{base}game/icon-shell.webp" alt="" />{it.price}</button>
            </div>
          {/each}
          <p class="muted small">An egg hatches into a new Glimmer as you practice. Eggs from battles: {EGG_ODDS}</p>
        </div>
      {/if}
      <p class="foot">Shells come from practice and battles. Nothing here costs real money.</p>
    </div>
  </div>
</div>

<style>
  .shop { display: flex; flex-direction: column; background: transparent; }
  .wallet { display: inline-flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 4px 14px 4px 6px; border-radius: 999px; box-shadow: inset 0 0 0 2px #ffe3a0; }
  .wallet img { width: 28px; height: 28px; object-fit: contain; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(420px, 1.25fr); gap: 18px; padding: 16px 20px; }
  .stagebox { position: relative; min-height: 0; }
  .hint { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); margin: 0; white-space: nowrap; font: 600 16px var(--font-ui); color: var(--ink2); background: rgba(255, 255, 255, .92); padding: 6px 16px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .tryon { position: absolute; left: 50%; bottom: 10px; transform: translateX(-50%); width: min(460px, 96%); display: grid; grid-template-columns: 64px 1fr; gap: 6px 12px; align-items: center; padding: 10px 14px; box-shadow: 0 0 0 3px var(--rc), var(--shadow); }
  .tryon > img { width: 64px; height: 64px; object-fit: contain; grid-row: span 2; }
  .tryon .tt { display: flex; flex-direction: column; min-width: 0; }
  .tryon small { font: 800 11px var(--font-body); color: var(--rc); text-transform: uppercase; letter-spacing: .04em; }
  .tryon b { font: 600 20px var(--font-ui); }
  .tryon .tt span { font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .tryon .act { grid-column: 2; display: flex; justify-content: flex-end; }
  .buy { display: inline-flex; align-items: center; gap: 6px; }
  .buy img, .egg .btn img { width: 20px; height: 20px; object-fit: contain; }
  .side { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
  .tabs { display: flex; gap: 8px; }
  .tabs button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 19px var(--font-ui); padding: 6px 12px; border-radius: 18px; border: 3px solid transparent; background: rgba(255, 255, 255, .85); cursor: pointer; color: var(--ink2); box-shadow: var(--shadow-sm); }
  .tabs button img { width: 36px; height: 36px; object-fit: contain; }
  .tabs button em { font: 800 12px var(--font-body); font-style: normal; background: var(--bg2); padding: 3px 8px; border-radius: 999px; }
  .tabs button.on { background: #fff; border-color: var(--primary-hi); color: var(--ink); }
  .filters { display: flex; flex-direction: column; gap: 6px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chips button { border: 0; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); padding: 5px 12px; border-radius: 999px; box-shadow: inset 0 0 0 2px #e4ddf3; }
  .chips button.on { background: var(--primary); color: #fff; box-shadow: none; }
  .vibes button.on { background: #ff8fb8; }
  .grid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; align-content: start; padding: 4px 2px 8px; }
  .it { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 6px 8px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px var(--rc), var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .it:hover { transform: translateY(-3px); }
  .it.sel { box-shadow: 0 0 0 4px var(--primary-hi), 0 0 18px rgba(124, 92, 245, .35); }
  .it > img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .it b { font: 600 15px/1.1 var(--font-ui); color: var(--ink); }
  .it .where { font: 700 11px var(--font-body); color: var(--muted); display: inline-flex; align-items: center; gap: 3px; }
  .it .rar { position: absolute; top: 5px; left: 50%; transform: translateX(-50%); font: 800 10px var(--font-body); color: #fff; background: var(--rc); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .it em, .tryon em { margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .price { background: #fff3d6; color: #7a5300; }
  .price img { width: 16px; height: 16px; object-fit: contain; }
  .have { background: #2fbf73; color: #fff; }
  .gift { background: #ffe4f0; color: #b02a6a; }
  .champ { background: #fff1c2; color: #8a6400; }
  .none { grid-column: 1 / -1; text-align: center; font: 600 16px var(--font-body); color: var(--muted); }
  .eggs { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 8px; }
  .egg { display: grid; grid-template-columns: 60px 1fr auto; gap: 12px; align-items: center; padding: 8px 14px; }
  .egg > img { width: 60px; height: 60px; object-fit: contain; }
  .egg b { display: block; font: 600 18px var(--font-ui); }
  .egg span { font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .egg .btn { display: inline-flex; align-items: center; gap: 6px; }
  .small { font-size: 12px; }
  .foot { margin: 0; font: 600 13px var(--font-body); color: var(--muted); text-align: center; }
  @media (max-width: 760px) {
    .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: 44vh 1fr; padding: 8px 10px; gap: 8px; }
    .side { min-width: 0; }
    .tabs button { font-size: 15px; } .tabs button img { width: 28px; height: 28px; } .tabs button em { display: none; }
    .chips button { font-size: 12px; padding: 4px 9px; }
    .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .it > img { width: 52px; height: 52px; }
    .it b { font-size: 13px; }
    .tryon { grid-template-columns: 48px 1fr; padding: 8px 10px; }
    .tryon > img { width: 48px; height: 48px; }
    .tryon b { font-size: 17px; } .tryon .tt span { font-size: 12px; }
    .hint { font-size: 13px; }
    .wallet { font-size: 15px; }
  }
</style>
