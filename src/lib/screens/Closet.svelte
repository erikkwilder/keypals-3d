<script lang="ts">
  // Keypals and the Island Shop: one place with two sides, the same buddy on the turntable and the same
  // row of spots on the buddy (head, face, neck, back, hand, feet, vibes, colour).
  // - My things: what you have. Put it on, take it off, move it ("Move it" nudges it into place on this
  //   buddy), and the finish-line dances. Everything you have is yours, so any buddy can wear it, and each
  //   buddy keeps its own look. Dances unlock as each buddy's own friendship grows.
  // - Shop: everything there is, with how to get it. Tap a thing to try it on (nothing changes until you
  //   buy it or wear it); what you buy is yours for every buddy. Eggs and treats for Adventure are here too.
  // Anything you own and have on can be moved from either side; a thing you're only trying on can't (buy
  // it first). Buddies not on the team yet show in shadowy grey with what brings them in. Tapping a thing
  // on the buddy itself picks it up to move, too.
  import { onDestroy, onMount, tick } from 'svelte';
  import { Raycaster, Vector2 } from 'three';
  import { game } from '../state/game.svelte';
  import { BUDDIES, FRIEND, type FriendId } from '../art/cast';
  import { DANCES as ALL_DANCES, forBuddy, type Reward } from '../engine/rewards';
  import { palOf, setLook } from '../engine/profile';
  import { levelFromXp } from '../engine/stickers';
  import { joinProgress, onTeam, UNLOCKS } from '../engine/team';
  import { BUDDY_ROLE, GLIMMER, RARITY, ROLE } from '../adventure/glimmers';
  import { advView, buy, EGG_ODDS, ISLAND, markSeen, SHOP, teamOf } from '../adventure/state';
  import { NO_NUDGE, SETS, SET_IDS, SLOT_NAME, WEAR_SLOTS, setItems, setsOn, lookView, type Nudge, type SetId, type WearSlot } from '../adventure/gear';
  import { CATALOG, CAT, VIBES, bestFriendship, buyItem, howText, nudgeItem, nudgeOf, ownsItem, wearItem, wornIn, type CatalogItem, type Vibe } from '../adventure/wardrobe';
  import { highlightWorn, nudgeGear, wornAt } from '../three/gear3d';
  import { colourSoon } from '../adventure/colours';
  import Coach from '../ui/Coach.svelte';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShowScene } from '../three/showScene';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import TileArt from '../ui/TileArt.svelte';
  import CloseButton from '../ui/CloseButton.svelte';
  import Turntable from '../ui/Turntable.svelte';

  type Side = 'mine' | 'shop';
  /** a spot on the buddy, or (on one side only) everything, the dances or the eggs */
  type Cat = WearSlot | 'all' | 'dances' | 'eggs';
  let { start = 'mine' }: { start?: Side } = $props();

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  // svelte-ignore state_referenced_locally
  let side = $state<Side>(start);
  let who = $state<FriendId>(game.profile!.buddy);
  // svelte-ignore state_referenced_locally
  let cat = $state<Cat>(start === 'shop' ? ((game.shopSlot as WearSlot | null) ?? 'all') : game.closetTab === 'dances' ? 'dances' : 'head');
  const isSlot = (c: Cat): c is WearSlot => (WEAR_SLOTS as string[]).includes(c);
  const pal = $derived(palOf(p, who));
  const lvl = $derived(levelFromXp(pal.xp));
  const adv = $derived(advView(p));
  const look = $derived(lookView(adv, who));
  const setsWorn = $derived(setsOn(look));
  const joined = $derived(onTeam(p, who));
  const join = $derived(joinProgress(p, who));
  const team = $derived(teamOf(adv).map(t => t.id));
  const wearTip = $derived(side === 'mine' && joined && isSlot(cat) && !adv.seen.includes('wardrobe1'));
  // a few dances bump into some buddies' heads or hats: those buddies don't get them
  const DANCES = $derived(forBuddy(ALL_DANCES, who));
  const dancesOpen = $derived(DANCES.filter(d => !locked(d)).length);
  const ownedCount = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
  const onSlot = (sl: WearSlot) => wornIn(p, who, sl);
  // the row of spots: the Shop starts with everything and ends with the eggs; My things ends with the dances
  const rail = $derived<Cat[]>(side === 'shop' ? ['all', ...WEAR_SLOTS, 'eggs'] : [...WEAR_SLOTS, 'dances']);
  const CAT_NAME: Record<Cat, string> = { ...SLOT_NAME, all: 'All', dances: 'Dances', eggs: 'Eggs' };
  /** the picture on a spot's button: what's on it, or (faded) the first thing that goes there */
  const slotPic = (s: WearSlot) => { const id = onSlot(s); return id ? { src: CAT[id]?.icon, on: true } : { src: CATALOG.find(c => c.slot === s)?.icon, on: false }; };
  let burst = $state(0);
  let shake = $state<string | null>(null);
  let setPeek = $state<SetId | null>(null);
  let scene: ShowScene | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  const RAR = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
  const island = (id: string) => ISLAND[id as keyof typeof ISLAND]?.name ?? id;

  // ---------- the buddy on show ----------
  async function show(id: FriendId) {
    const old = scene;
    const sc = await ShowScene.create({ buddies: [id], view: viewOf(), spot: 10, fromSave: true, shadowed: onTeam(game.profile!, id) ? [] : [id] });
    if (disposed || who !== id) { sc.dispose(); return; }
    scene = sc;
    stage.use(sc);
    // the layout may still be settling: measure the stage area again in a moment
    requestAnimationFrame(onResize); setTimeout(onResize, 400);
    if (old && old !== sc) old.dispose();
    sc.select(id);
  }
  function viewOf() {
    const r = stageEl?.getBoundingClientRect();
    // the buddy stands above the try-on card (the Shop) or the little hint (My things) at the bottom
    const card = side === 'shop' ? (innerWidth < 760 ? 96 : innerHeight < 820 ? 124 : 150) : 34;
    return r ? { top: r.top / innerHeight, bottom: Math.max(r.top + 120, r.bottom - card) / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.2, bottom: 0.95, left: 0, right: 0.45 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }
  const relayout = () => void tick().then(onResize);

  function pick(id: FriendId) {
    if (id === who) return;
    leaveMove(() => {
      who = id; sel = null;
      if (cat === 'colour' && colourSoon(id)) cat = 'head';
      sfx.pop(); show(id);
    });
  }
  const soonNote = () => { sfx.pop(); game.say(`${FRIEND[who].name}'s colours are coming soon! Every other buddy can wear yours.`); };
  function locked(r: Reward) { return r.level > lvl.level; }
  function nope(r: Reward) {
    shake = r.id; setTimeout(() => (shake = null), 400); sfx.nope();
    game.say(`Reach friendship ${r.level} with ${FRIEND[who].name} to unlock ${r.name}!`);
  }
  function dance(r: Reward) {
    if (locked(r)) return nope(r);
    game.update(pp => setLook(pp, who, { dance: r.id }));
    scene?.dance(who, r.id);
    sfx.pop();
  }
  function makeBuddy() { if (!joined) return; game.update(pp => { pp.buddy = who; }); burst++; sfx.equip(); scene?.dance(who, pal.dance); }

  // ---------- the two sides, and the spots ----------
  let lastMine: Cat = 'head';
  function setSide(s: Side) {
    if (s === side) return;
    leaveMove(() => {
      if (s === 'shop') { lastMine = cat; if (cat === 'dances') cat = 'all'; }
      else { dropTryOn(); if (cat === 'all' || cat === 'eggs') cat = lastMine === 'dances' || isSlot(lastMine) ? lastMine : 'head'; }
      side = s;
      sfx.pop(); relayout();
    });
  }
  function setCat(c: Cat) {
    if (c === cat) return;
    cat = c;
    game.closetTab = c === 'dances' ? 'dances' : 'outfits';
    if (c === 'eggs') dropTryOn();
    sfx.pop();
  }

  // ---------- My things ----------
  const mineFor = $derived(isSlot(cat) ? CATALOG.filter(c => c.slot === cat && ownsItem(p, c.id)) : []);
  function tapMine(c: CatalogItem) {
    const on = onSlot(c.slot) === c.id;
    game.update(pp => { wearItem(pp, who, c.slot, on ? null : c.id); });
    void scene?.redress(who);
    if (on) sfx.pop(); else { burst++; sfx.equip(); }
  }
  function takeOff(sl: WearSlot) {
    game.update(pp => { wearItem(pp, who, sl, null); });
    if (sel?.slot === sl) sel = null;
    void scene?.redress(who);
    sfx.pop();
  }

  // ---------- the Shop ----------
  let sel = $state<CatalogItem | null>(null);
  let vibe = $state<Vibe | 'all'>('all');
  const RAR_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  // which things to show, and in what order
  type Show = 'all' | 'mine' | 'notyet' | 'afford' | 'gift' | 'prize';
  type Sort = 'cheap' | 'pricey' | 'new' | 'rare';
  const SHOWS: { id: Show; name: string; icon?: 'check' | 'heart' | 'trophy' }[] = [
    { id: 'all', name: 'Everything' }, { id: 'mine', name: 'Mine', icon: 'check' }, { id: 'notyet', name: 'Not mine yet' },
    { id: 'afford', name: 'I can buy' }, { id: 'gift', name: 'Friendship gifts', icon: 'heart' }, { id: 'prize', name: 'Champion prizes', icon: 'trophy' },
  ];
  const SORTS: { id: Sort; name: string }[] = [{ id: 'cheap', name: 'Cheapest' }, { id: 'pricey', name: 'Priciest' }, { id: 'new', name: 'Newest' }, { id: 'rare', name: 'Rarest' }];
  let showing = $state<Show>('all');
  // a short screen (an older laptop): the sort and filter rows open from one button
  const shortQ = typeof matchMedia === 'function' ? matchMedia('(max-height: 820px) and (min-width: 761px)') : null;
  let short = $state(!!shortQ?.matches);
  let filtersOpen = $state(false);
  const onShort = () => { short = !!shortQ?.matches; };
  let sort = $state<Sort>('cheap');
  const shows = (c: CatalogItem) => {
    const mine = ownsItem(p, c.id);
    return showing === 'all' || (showing === 'mine' && mine) || (showing === 'notyet' && !mine)
      || (showing === 'afford' && !mine && c.how === 'shop' && (c.price ?? 0) <= adv.shells)
      || (showing === 'gift' && c.how === 'friendship') || (showing === 'prize' && c.how === 'champion');
  };
  // (the catalog grows at the end, so later means newer; things for sale come before gifts and prizes)
  const age = new Map(CATALOG.map((c, i) => [c.id, i]));
  const rank = (c: CatalogItem) => RAR_ORDER.indexOf(c.rarity);
  const forSale = (a: CatalogItem, b: CatalogItem) => (a.how === 'shop' ? 0 : 1) - (b.how === 'shop' ? 0 : 1);
  const ORDER: Record<Sort, (a: CatalogItem, b: CatalogItem) => number> = {
    cheap: (a, b) => forSale(a, b) || (a.price ?? 0) - (b.price ?? 0) || rank(a) - rank(b),
    pricey: (a, b) => forSale(a, b) || (b.price ?? 0) - (a.price ?? 0) || rank(b) - rank(a),
    new: (a, b) => age.get(b.id)! - age.get(a.id)!,
    rare: (a, b) => rank(b) - rank(a) || (b.price ?? 0) - (a.price ?? 0),
  };
  const list = $derived(CATALOG
    .filter(c => (cat === 'all' || c.slot === cat) && (vibe === 'all' || c.vibe === vibe) && shows(c))
    .sort(ORDER[sort]));

  /** Tap a thing in the Shop: try it on (the buddy's real look comes back when you pick something else or leave). */
  function tryOn(c: CatalogItem) {
    sel = c; sfx.pop();
    if (c.slot === 'colour' && colourSoon(who)) game.say(`${FRIEND[who].name}'s colours are coming soon! Every other buddy can wear this one.`);
    if (!scene) return;
    // (compare ids: a $state value is a proxy, never === the plain item)
    void scene.redress(who).then(() => { if (sel?.id !== c.id) return; if (c.slot === 'head') { scene?.char(who)?.nudgeHat(null); void scene?.wear(who, c.id); } else void scene?.wearGear(who, c.slot, c.id); });
  }
  /** Back to the buddy's real look (leaving the Shop side, opening the eggs, moving something). */
  function dropTryOn() { if (!sel) return; sel = null; return scene?.redress(who); }
  function buyIt(c: CatalogItem) {
    let r: { ok: boolean; why?: string } = { ok: false };
    game.update(pp => { r = buyItem(pp, who, c.id); });
    if (!r.ok) { sfx.nope(); if (r.why) game.say(r.why); return; }
    burst++; sfx.buy();
    void scene?.redress(who);
    game.say(`The ${c.name} is yours! ${FRIEND[who].name} has it on. Tap Move it to put it just where you want.`, 3600);
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

  // ---------- Move it: nudge a worn thing into place on this buddy ----------
  let moving = $state<{ slot: WearSlot; id: string; n: Nudge; was: Nudge } | null>(null);
  const same = (a: Nudge, b: Nudge) => (['x', 'y', 'z', 's', 'r'] as const).every(k => Math.abs(a[k] - b[k]) < 1e-6);
  /** something has been moved since Move it opened (the big button says Save, not Done) */
  const changed = $derived(!!moving && !same(moving.n, moving.was));
  // (a colour isn't a thing on the buddy: nothing to move)
  const movable = (sl: WearSlot) => sl !== 'colour' && !!onSlot(sl);
  const wearsAny = $derived(WEAR_SLOTS.some(s => s !== 'colour' && !!look.on[s]) || !!onSlot('head'));
  async function startMove(sl: WearSlot) {
    const id = onSlot(sl);
    if (!id || sl === 'colour' || !joined) return;
    // whatever is only being tried on comes off first: what you move is what you have on
    await dropTryOn();
    const n = nudgeOf(p, who, id);
    moving = { slot: sl, id, n, was: { ...n } };
    if (isSlot(cat) || side === 'mine') cat = sl;
    sfx.pop();
    // phones: the Move it card is under the buddy, so bring it into view
    void tick().then(() => document.querySelector('.closet .mover')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  // the thing being moved glows a little on the buddy
  const movingSlot = $derived(moving?.slot ?? null);
  $effect(() => {
    const s = movingSlot, c = scene?.char(who);
    if (!s || !c) return;
    highlightWorn(c, s);
    return () => highlightWorn(c, null);
  });
  // tap a thing on the buddy (a tap, not a drag to turn) to pick it up and move it
  let tapAt: { x: number; y: number; t: number } | null = null;
  function stageDown(e: PointerEvent) { tapAt = e.target === stageEl ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; }
  function stageUp(e: PointerEvent) {
    const d = tapAt; tapAt = null;
    if (!d || !joined || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return;
    const c = scene?.char(who);
    if (!c) return;
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), stage.camera);
    ray.camera = stage.camera;
    const hit = wornAt(c, ray);
    if (!hit || hit.slot === 'colour') {
      // a tap on the buddy itself: a tickle (it squirms and giggles)
      if (!c.acting && ray.intersectObject(c.model, true).length) { c.tickle(); sfx.giggle(); }
      return;
    }
    // something only tried on in the Shop can't be moved: buy it first (yours but not on: put it on)
    if (!ownsItem(p, hit.id)) { sfx.nope(); game.say(`Buy the ${CAT[hit.id]?.name ?? 'thing'} to keep it and move it.`); return; }
    if (onSlot(hit.slot) !== hit.id) { const it = CAT[hit.id]; if (it) wearIt(it); }
    if (moving?.slot === hit.slot) return;
    leaveMove(() => void startMove(hit.slot));
  }
  const STEP = 0.012;
  function nudge(d: Partial<Nudge>, k = 1) {
    if (!moving) return;
    const n = moving.n, lim = (v: number) => Math.max(-0.35, Math.min(0.35, v));
    const next: Nudge = {
      x: lim(n.x + (d.x ?? 0) * STEP * k), y: lim(n.y + (d.y ?? 0) * STEP * k), z: lim(n.z + (d.z ?? 0) * STEP * k),
      s: Math.max(0.4, Math.min(2.5, n.s * (d.s ? Math.pow(1.06, d.s) : 1))), r: n.r + (d.r ?? 0) * 0.15,
    };
    moving = { ...moving, n: next };
    live(next);
    sfx.click();
  }
  function live(n: Nudge | null) {
    const c = scene?.char(who);
    if (!c || !moving) return;
    if (moving.slot === 'head') c.nudgeHat(n); else nudgeGear(c, moving.slot, n ?? NO_NUDGE);
  }
  /** Save (something moved) or Done (nothing did): either way Move it closes. */
  function finishMove() {
    if (!moving) return;
    const m = moving;
    if (changed) { game.update(pp => nudgeItem(pp, who, m.id, m.n)); burst++; sfx.equip(); } else sfx.pop();
    moving = null;
  }
  function resetMove() {
    if (!moving) return;
    moving = { ...moving, n: { ...NO_NUDGE } };
    live(NO_NUDGE);
    sfx.pop();
  }
  /** Put it back where it was saved and close Move it. */
  function undoMove() {
    if (!moving) return;
    live(moving.was);
    moving = null;
  }
  // leaving Move it with changes not saved: ask first ("Keep your changes?"), then go on
  let asking = $state<(() => void) | null>(null);
  function leaveMove(then: () => void) {
    if (!moving) return then();
    if (!changed) { moving = null; return then(); }
    sfx.pop();
    asking = then;
  }
  function answer(keep: boolean) {
    const then = asking;
    asking = null;
    if (keep) finishMove(); else undoMove();
    then?.();
  }
  // hold a button to keep nudging
  let holdTimer = 0;
  function hold(d: Partial<Nudge>) { nudge(d); clearInterval(holdTimer); holdTimer = window.setInterval(() => nudge(d), 90); }
  function release() { clearInterval(holdTimer); }

  function back() {
    leaveMove(() => { if (game.screen === 'shop') game.go(game.shopBack); else game.go(game.home); });
  }

  onMount(() => { shortQ?.addEventListener('change', onShort); show(who); addEventListener('resize', onResize); addEventListener('pointerup', release); stageEl?.addEventListener('pointerdown', stageDown); stageEl?.addEventListener('pointerup', stageUp); });
  onDestroy(() => { shortQ?.removeEventListener('change', onShort); disposed = true; clearInterval(holdTimer); removeEventListener('resize', onResize); removeEventListener('pointerup', release); stageEl?.removeEventListener('pointerdown', stageDown); stageEl?.removeEventListener('pointerup', stageUp); if (scene && stage.current() === scene) stage.use(null); });
</script>

<div class="screen closet" class:shopside={side === 'shop'}>
  <Header title={side === 'shop' ? 'Island Shop' : 'Keypals'} sub={side === 'shop' ? 'Try things on, then buy them' : 'Your buddies and everything you have'} {back}>
    {#snippet right()}<span class="wallet"><img src="{base}game/icon-shell.webp" alt="" /><b>{adv.shells}</b> shells</span>{/snippet}
  </Header>
  <div class="crew">
    {#each BUDDIES as f (f.id)}
      {@const mine = onTeam(p, f.id)}
      <button class="mate" class:on={who === f.id} class:locked={!mine} onclick={() => pick(f.id)} title={mine ? f.name : `${f.name}: ${UNLOCKS[f.id]?.how}`}>
        <span class="pic"><Critter friend={f.id} size={64} round /></span>
        <span class="nm">{f.name}</span>
        {#if !mine}<span class="lk"><Icon name="lock" /></span>{/if}
        {#if p.buddy === f.id}<span class="me">buddy</span>{/if}
      </button>
    {/each}
  </div>
  <div class="body">
    <div class="left">
      <div class="who card">
        <div class="whotop">
          <h2>{FRIEND[who].name}</h2>
          {#if joined}
            <div class="xp"><span class="lvl"><Icon name="heart" size={15} /> Friendship {lvl.level}</span><div class="bar"><i style:width="{(lvl.into / lvl.need) * 100}%"></i></div><span class="muted">{lvl.into}/{lvl.need} XP</span></div>
            {#if p.buddy !== who}<button class="btn btn-primary playwith" onclick={makeBuddy}>Play with {FRIEND[who].name}</button>{/if}
          {/if}
        </div>
        {#if joined}
          <p class="quirk">{FRIEND[who].quirk}</p>
          <p class="advline"><img src="{base}game/icon-star.webp" alt="" /><span><b>In Adventure, {ROLE[BUDDY_ROLE[who]].name}:</b> {ROLE[BUDDY_ROLE[who]].text}</span></p>
        {:else}
          <p class="joins"><Icon name="lock" /> Joins your team when you: <b>{UNLOCKS[who]?.how}</b></p>
          <div class="xp"><div class="bar"><i style:width="{join.share * 100}%"></i></div><span class="muted">{join.text}</span></div>
        {/if}
      </div>
      <div class="stagebox" bind:this={stageEl}>
        <Confetti {burst} count={50} x={50} y={45} />
        <Turntable scene={() => scene} el={stageEl} top />
        {#if side === 'shop' && sel && cat !== 'eggs' && joined && !moving}
          {@const s = sel}
          {@const mine = ownsItem(p, s.id)}
          {@const on = wornIn(p, who, s.slot) === s.id}
          <div class="tryon card" style:--rc={RARITY[s.rarity].color}>
            <img src="{base}{s.icon}" alt="" />
            <div class="tt">
              <small>{RARITY[s.rarity].name} · {SLOT_NAME[s.slot]}{s.power ? '' : ' · just for fun'}</small>
              <b>{s.name}</b>
              <span>{s.power ? `In battles: ${s.text}` : s.text}</span>
            </div>
            <div class="act">
              {#if on}<em class="have"><Icon name="check" size={14} /> {FRIEND[who].name} has it on</em>{#if s.slot !== 'colour'}<button class="btn movebtn" onclick={() => startMove(s.slot)}><Icon name="hand" size={18} /> Move it</button>{/if}
              {:else if mine}<button class="btn btn-primary" onclick={() => wearIt(s)}>Wear it</button>
              {:else if s.how === 'shop'}<span class="keepline">Buy it to keep it and move it.</span><button class="btn btn-primary buy" disabled={adv.shells < (s.price ?? 0)} onclick={() => buyIt(s)}><img src="{base}game/icon-shell.webp" alt="" />{adv.shells < (s.price ?? 0) ? `${(s.price ?? 0) - adv.shells} more` : `Buy: ${s.price}`}</button>
              {:else if s.how === 'friendship'}<em class="gift"><Icon name="heart" size={14} /> Friendship {s.level} with any buddy (best: {bestFriendship(p)})</em>
              {:else}<em class="champ"><Icon name="trophy" size={14} /> {howText(s, island)}</em>{/if}
            </div>
          </div>
        {:else if side === 'shop' && joined && cat !== 'eggs' && !moving}
          <p class="hint">Tap anything to try it on {FRIEND[who].name}.</p>
        {:else if side === 'mine' && joined && wearsAny && !moving && cat !== 'dances'}
          <p class="hint taphint"><Icon name="hand" size={18} /> Tap something {FRIEND[who].name} has on to move it</p>
        {/if}
      </div>
    </div>
    <div class="side">
      {#if joined && moving}
        {@const c = CAT[moving.id]}
        <!-- Move it: big buttons to nudge the thing into place (hold to keep going) -->
        <div class="mover card">
          <div class="mvhead"><img src="{base}{c?.icon}" alt="" /><b>Move the {c?.name ?? 'thing'}</b><CloseButton size={36} label={changed ? 'Close (asks first)' : 'Close'} onclick={() => leaveMove(() => {})} /></div>
          <div class="mvgrid">
            <span></span><button class="mv" onpointerdown={() => hold({ y: 1 })} aria-label="Up"><Icon name="up" size={36} /><small>Up</small></button><span></span>
            <button class="mv" onpointerdown={() => hold({ x: -1 })} aria-label="Left"><Icon name="left" size={36} /><small>Left</small></button>
            <button class="mv mid" onpointerdown={() => hold({ z: 1 })} aria-label="Closer"><Icon name="closer" size={36} /><small>Closer</small></button>
            <button class="mv" onpointerdown={() => hold({ x: 1 })} aria-label="Right"><Icon name="right" size={36} /><small>Right</small></button>
            <span></span><button class="mv" onpointerdown={() => hold({ y: -1 })} aria-label="Down"><Icon name="down" size={36} /><small>Down</small></button><button class="mv" onpointerdown={() => hold({ z: -1 })} aria-label="Further"><Icon name="further" size={36} /><small>Further</small></button>
          </div>
          <div class="mvrow">
            <button class="mv wide" onpointerdown={() => hold({ s: -1 })} aria-label="Smaller"><Icon name="smaller" size={36} /><small>Smaller</small></button>
            <button class="mv wide" onpointerdown={() => hold({ s: 1 })} aria-label="Bigger"><Icon name="bigger" size={36} /><small>Bigger</small></button>
            <button class="mv wide" onpointerdown={() => hold({ r: -1 })} aria-label="Turn left"><Icon name="turnleft" size={36} /><small>Turn left</small></button>
            <button class="mv wide" onpointerdown={() => hold({ r: 1 })} aria-label="Turn right"><Icon name="turnright" size={36} /><small>Turn right</small></button>
          </div>
          <div class="mvbtns">
            <button class="btn resetbtn" onclick={resetMove}><Icon name="reset" size={20} /> Reset</button>
            <button class="btn btn-primary savebtn" class:save={changed} onclick={finishMove}>{#if changed}<Icon name="check" size={20} /> Save{:else}Done{/if}</button>
          </div>
          <p class="mvnote">Just for {FRIEND[who].name}: every other buddy keeps its own fit.</p>
        </div>
      {:else}
        <div class="sides" role="tablist">
          <button role="tab" aria-selected={side === 'mine'} class:on={side === 'mine'} onclick={() => setSide('mine')}><TileArt kind="outfits" size={40} /><span>My things</span><em>{ownedCount}</em></button>
          <button role="tab" aria-selected={side === 'shop'} class:on={side === 'shop'} class="shopbtn" onclick={() => setSide('shop')}><img src="{base}game/icon-shell.webp" alt="" /><span>Shop</span></button>
        </div>
        <p class="sidehead">{side === 'shop' ? 'Try on anything. Buy it to keep it and move it.' : cat === 'dances' ? `Pick the dance ${FRIEND[who].name} does at the finish line.` : 'Put your things on, take them off, and move them.'}</p>
        {#if joined || side === 'shop'}
          <div class="rail" class:wide={rail.length > 9}>
            {#each rail as r (r)}
              {@const soon = r === 'colour' && colourSoon(who)}
              <div class="rw">
                <button class="rb" class:on={cat === r} class:soon onclick={() => (soon && side === 'mine' ? soonNote() : setCat(r))}>
                  {#if r === 'all'}<span class="rpic"><img src="{base}outfits/party_hat.webp" alt="" /></span>
                  {:else if r === 'dances'}<span class="rpic"><TileArt kind="dances" size={40} /></span>
                  {:else if r === 'eggs'}<span class="rpic"><img src="{base}game/egg-rare.webp" alt="" /></span>
                  {:else}
                    {@const sp = slotPic(r)}
                    <span class="rpic" class:empty={!sp.on} style:--rc={sp.on && onSlot(r) ? RARITY[CAT[onSlot(r)!]?.rarity ?? 'common'].color : null}>{#if soon}<img src="{base}colours/colour_rainbow.webp" alt="" />{:else if sp.src}<img src="{base}{sp.src}" alt="" />{/if}</span>
                  {/if}
                  <small>{CAT_NAME[r]}</small>
                </button>
                {#if soon && side === 'mine'}<em class="soonpill">soon</em>{/if}
                {#if joined && isSlot(r) && movable(r)}<button class="gmv" onclick={() => startMove(r)} title="Move the {CAT[onSlot(r)!]?.name}" aria-label="Move the {CAT[onSlot(r)!]?.name}"><Icon name="hand" size={15} /></button>{/if}
              </div>
            {/each}
          </div>
        {/if}
        {#if !joined && side === 'mine'}
          <div class="card soon"><p>When {FRIEND[who].name} joins your team, they start their own friendship and dances, and they can wear everything you have.</p></div>
        {:else if !joined && cat !== 'eggs'}
          <div class="card soon"><p>{FRIEND[who].name} isn't on your team yet. Pick a buddy on your team to try things on.</p></div>
        {:else if side === 'mine' && cat === 'dances'}
          <div class="grid scroll">
            {#each DANCES as d (d.id)}
              {@const lk = locked(d)}
              <button class="of dance rar-{d.rarity}" class:on={pal.dance === d.id} class:locked={lk} class:shake={shake === d.id} onclick={() => dance(d)}>
                <div class="thumb dpic"><Icon name="dance" dance={d.id} size={64} /></div>
                <b>{d.name}</b>
                {#if !lk}<span class="rar {d.rarity}">{pal.dance === d.id ? 'My finish dance' : RAR[d.rarity]}</span>
                {:else}<span class="lock" title="Unlocks at friendship {d.level}"><Icon name="lock" size={13} /> <Icon name="heart" size={13} /> {d.level}</span>{/if}
              </button>
            {/each}
          </div>
          <p class="countline">{dancesOpen} of {DANCES.length} dances open for {FRIEND[who].name}. More come with friendship.</p>
        {:else if side === 'mine' && isSlot(cat)}
          {@const sl = cat}
          <div class="gearpane scroll">
            {#if onSlot(sl)}
              {@const cur = CAT[onSlot(sl)!]}
              <div class="wearing">
                <span><b>{cur?.name}</b> is on.</span>
                {#if sl !== 'colour'}<button class="btn movebtn" onclick={() => startMove(sl)}><Icon name="hand" size={18} /> Move it</button>{/if}
                <button class="btn" onclick={() => takeOff(sl)}>Take off</button>
              </div>
            {/if}
            <div class="gitems">
              {#each mineFor as c (c.id)}
                {@const wearing = onSlot(c.slot) === c.id}
                <button class="gtile" class:wearing style:--rc={RARITY[c.rarity].color} onclick={() => tapMine(c)}>
                  <span class="grar">{RARITY[c.rarity].name}</span>
                  <img src="{base}{c.icon}" alt="" />
                  <b>{c.name}</b>
                  <span class="gpow">{#if c.power}<Icon name="shield" size={14} /> {/if}{c.text}</span>
                  {#if wearing}<em class="gst on"><Icon name="check" size={14} /> Wearing</em>{:else}<em class="gst">Tap to wear</em>{/if}
                </button>
              {/each}
              <button class="gtile more" onclick={() => setSide('shop')}>
                <img src="{base}game/icon-shell.webp" alt="" />
                <b>{mineFor.length ? 'Get more' : `No ${CAT_NAME[sl].toLowerCase()} things yet`}</b>
                <em class="gst buy">Go to the Shop</em>
              </button>
            </div>
            {#if sl === 'hand' || sl === 'back' || sl === 'feet'}
            <div class="gsets">
              {#each SET_IDS as sid (sid)}
                {@const done = setsWorn.includes(sid)}
                <button class="gset" class:done onclick={() => { setPeek = sid; sfx.pop(); }}>
                  <span class="gsicons">{#each setItems(sid) as it}<img class:off={look.on[it.slot] !== it.id} src="{base}gear/{it.id}.webp" alt="" />{/each}</span>
                  <span class="gsname"><b>{SETS[sid].name}</b><small>{#if done}<Icon name="check" size={12} /> Bonus on!{:else}{setItems(sid).filter(i => look.on[i.slot] === i.id).length} of 3 on{/if}</small></span>
                </button>
              {/each}
            </div>
            {/if}
          </div>
        {:else if cat === 'eggs'}
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
        {:else}
          {#if short}
            <!-- short screens: sort and filter fold away behind one button, so two full rows of things show -->
            <div class="sortbar">
              <button class="btn sfbtn" class:on={filtersOpen} aria-expanded={filtersOpen} onclick={() => { filtersOpen = !filtersOpen; sfx.pop(); }}><Icon name="swap" size={18} /> Sort and filter</button>
              <span class="sfnow">{SHOWS.find(x => x.id === showing)?.name} · {SORTS.find(x => x.id === sort)?.name}{vibe !== 'all' ? ` · ${VIBES.find(v => v.id === vibe)?.name}` : ''}</span>
            </div>
          {/if}
          {#if !short || filtersOpen}
          <div class="filters">
            <div class="chips shows">
              {#each SHOWS as s (s.id)}<button class:on={showing === s.id} onclick={() => { showing = s.id; sfx.pop(); }}>{#if s.id === 'afford'}<img src="{base}game/icon-shell.webp" alt="" />{:else if s.icon}<Icon name={s.icon} size={14} />{/if}{s.name}</button>{/each}
            </div>
            <div class="chips sorts">
              <span class="sortby">Sort:</span>
              {#each SORTS as o (o.id)}<button class:on={sort === o.id} onclick={() => { sort = o.id; sfx.pop(); }}>{o.name}</button>{/each}
            </div>
            <div class="chips vibes">
              <button class:on={vibe === 'all'} onclick={() => { vibe = 'all'; sfx.pop(); }}>Any vibe</button>
              {#each VIBES as v (v.id)}<button class:on={vibe === v.id} onclick={() => { vibe = v.id; sfx.pop(); }}>{v.name}</button>{/each}
            </div>
          </div>
          {/if}
          <div class="sgrid scroll">
            {#each list as c (c.id)}
              {@const mine = ownsItem(p, c.id)}
              {@const on = wornIn(p, who, c.slot) === c.id}
              <button class="it" class:sel={sel?.id === c.id} class:mine style:--rc={RARITY[c.rarity].color} onclick={() => tryOn(c)}>
                <span class="rar">{RARITY[c.rarity].name}</span>
                <img src="{base}{c.icon}" alt="" loading="lazy" />
                <b>{c.name}</b>
                <span class="where">{SLOT_NAME[c.slot]}{#if c.power} · <Icon name="shield" size={12} />{/if}</span>
                {#if on}<em class="have"><Icon name="check" size={13} /> Wearing</em>
                {:else if mine}<em class="have">Yours</em>
                {:else if c.how === 'shop'}<em class="price"><img src="{base}game/icon-shell.webp" alt="" />{c.price}</em>
                {:else if c.how === 'friendship'}<em class="gift"><Icon name="heart" size={13} /> {c.level}</em>
                {:else}<em class="champ"><Icon name="trophy" size={14} /> Prize</em>{/if}
              </button>
            {:else}
              <p class="none">{showing === 'afford' ? `Nothing here for ${adv.shells} shells yet. Practice and battles earn more!` : showing === 'mine' ? 'None of these are yours yet.' : 'Nothing like that here. Try another chip!'}</p>
            {/each}
          </div>
          <p class="foot">Shells come from practice and battles. Nothing here costs real money.</p>
        {/if}
      {/if}
    </div>
  </div>

  {#if wearTip}<Coach text="New! Pick a spot on your buddy, then tap a thing to put it on. Everything you have works on every buddy, and Move it puts it just where you want it." at=".rail .rb.on" button="Got it" onok={() => game.update(pp => markSeen(pp, 'wardrobe1'))} />{/if}

  {#if setPeek}
    {@const sid = setPeek}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gbg" onclick={() => (setPeek = null)}>
      <div class="gcard card setcard" onclick={(e) => e.stopPropagation()}>
        <div class="setpics">{#each setItems(sid) as it}<img class:off={look.on[it.slot] !== it.id} src="{base}gear/{it.id}.webp" alt="" />{/each}</div>
        <div class="gtext">
          <h3>{SETS[sid].name}</h3>
          <p><b>Wear all three:</b> {SETS[sid].text}</p>
          <ul>{#each setItems(sid) as it}<li class:on={look.on[it.slot] === it.id}>{#if look.on[it.slot] === it.id}<Icon name="check" size={14} />{:else}○{/if} {it.name} <span class="muted">({SLOT_NAME[it.slot].toLowerCase()}{ownsItem(p, it.id) ? '' : `: ${howText(CAT[it.id], island)}`})</span></li>{/each}</ul>
        </div>
        <button class="btn gclose" onclick={() => (setPeek = null)}>OK</button>
      </div>
    </div>
  {/if}

  {#if asking && moving}
    {@const c = CAT[moving.id]}
    <!-- leaving Move it with changes: keep them, or put the thing back -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gbg" onclick={() => (asking = null)}>
      <div class="gcard card askcard" onclick={(e) => e.stopPropagation()}>
        <img class="gbig" src="{base}{c?.icon}" alt="" />
        <div class="gtext">
          <h3>Keep your changes?</h3>
          <p>You moved the {c?.name ?? 'thing'}.</p>
          <div class="askbtns">
            <button class="btn btn-primary" onclick={() => answer(true)}><Icon name="check" size={18} /> Yes, save it</button>
            <button class="btn" onclick={() => answer(false)}>No, put it back</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .closet { display: flex; flex-direction: column; background: transparent; }
  .wallet { display: inline-flex; align-items: center; gap: 6px; font: 600 18px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 4px 14px 4px 6px; border-radius: 999px; box-shadow: inset 0 0 0 2px #ffe3a0; }
  .wallet img { width: 28px; height: 28px; object-fit: contain; }
  .crew { display: flex; gap: 8px; padding: 8px 20px; overflow-x: auto; background: rgba(255, 255, 255, .85); border-bottom: var(--panel-border); flex: none; }
  .mate { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; width: 88px; padding: 4px 4px 6px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); }
  .mate.on { border-color: var(--primary-hi); }
  .mate .nm { font: 600 15px var(--font-ui); }
  /* not on the team yet: the real buddy in shadowy black and white */
  .mate.locked .pic :global(img) { filter: grayscale(1) brightness(.5) contrast(1.25); }
  .mate.locked .pic :global(.critter-host) { background: radial-gradient(circle at 50% 35%, #e9e9ef, #b9bccb); }
  .mate.locked .nm { color: var(--muted); }
  .mate .lk { position: absolute; top: 48px; right: 12px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgba(48, 36, 80, .8); box-shadow: 0 0 0 2px #fff; }
  .mate .me { position: absolute; top: 4px; right: 4px; font: 800 9px var(--font-body); background: var(--mint); color: #0f4a36; padding: 2px 5px; border-radius: 999px; }
  .joins { margin: 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .soon { padding: 16px 18px; }
  .soon p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(400px, 1.15fr); gap: 18px; padding: 14px 20px; }
  .left { min-height: 0; display: flex; flex-direction: column; gap: 10px; }
  .stagebox { position: relative; flex: 1; min-height: 0; }
  .side { min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px; }
  .who { padding: 10px 16px; display: flex; flex-direction: column; gap: 6px; }
  .whotop { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .who h2 { font-size: 28px; }
  .whotop .xp { flex: 1; min-width: 200px; }
  .xp { display: flex; align-items: center; gap: 10px; font: 700 13px var(--font-body); }
  .lvl { background: var(--primary); color: #fff; padding: 3px 10px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px; }
  .bar { flex: 1; height: 12px; border-radius: 999px; background: var(--bg2); overflow: hidden; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); border-radius: 999px; transition: width .6s ease; }
  .quirk { margin: 0; color: var(--muted); font-weight: 600; }
  .advline { margin: 0; display: flex; gap: 8px; align-items: center; font: 600 14px/1.35 var(--font-body); color: var(--ink2); background: #f6f2ff; border-radius: 14px; padding: 6px 10px; }
  .advline img { width: 26px; height: 26px; object-fit: contain; flex: none; }
  .playwith { padding: 6px 14px; font-size: 15px; }
  /* the two sides: My things and the Shop, one tap apart */
  .sides { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 4px; border-radius: 22px; background: rgba(255, 255, 255, .88); box-shadow: inset 0 0 0 2px #e4ddf3, var(--shadow-sm); flex: none; }
  .sides button { display: flex; align-items: center; justify-content: center; gap: 10px; font: 600 22px var(--font-ui); padding: 6px 12px; border-radius: 18px; border: 0; background: transparent; cursor: pointer; color: var(--ink2); }
  .sides button img { width: 38px; height: 38px; object-fit: contain; }
  .sides button em { font: 800 13px var(--font-body); font-style: normal; background: var(--bg2); color: var(--ink2); padding: 3px 9px; border-radius: 999px; }
  .sides button.on { background: #fff; color: var(--ink); box-shadow: 0 0 0 3px var(--primary-hi), var(--shadow-sm); }
  .sides button.on em { background: var(--primary); color: #fff; }
  .sides button.shopbtn.on { box-shadow: 0 0 0 3px #ffc94d, var(--shadow-sm); }
  .sidehead { margin: 0; align-self: center; font: 700 16px/1.3 var(--font-body); color: var(--ink2); text-align: center; flex: none; background: rgba(255, 255, 255, .9); padding: 4px 14px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  /* the spots on the buddy (the same row on both sides) */
  .rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 6px; flex: none; }
  .rw { position: relative; display: grid; min-width: 0; }
  .rb { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px 2px 4px; border-radius: 16px; border: 3px solid transparent; background: rgba(255, 255, 255, .92); cursor: pointer; box-shadow: var(--shadow-sm); font: inherit; min-width: 0; }
  .rb.on { border-color: var(--primary-hi); background: #fff; }
  .shopside .rb.on { border-color: #ffb627; }
  .rb small { font: 800 11px var(--font-body); color: var(--ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .rpic { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; background: radial-gradient(circle at 50% 40%, #fff, #f1ecfb); box-shadow: inset 0 0 0 2px var(--rc, #e4ddf3); }
  .rpic img { width: 38px; height: 38px; object-fit: contain; }
  .rpic :global(img.art) { width: 38px; height: 38px; }
  .rpic.empty img { filter: grayscale(.85) opacity(.45); }
  .rb.soon .rpic img { filter: grayscale(1) opacity(.45); }
  .rb.soon small { color: var(--muted); }
  .soonpill { position: absolute; top: -5px; right: -4px; pointer-events: none; font: 800 10px var(--font-body); font-style: normal; color: #fff; background: #9b8cc9; padding: 2px 7px; border-radius: 999px; box-shadow: 0 0 0 2px #fff; }
  /* a little Move it button on every spot with something of yours on it */
  .gmv { position: absolute; top: -5px; right: -4px; width: 26px; height: 26px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; color: #5a3d00; background: linear-gradient(135deg, #ffe58a, #ffc94d); box-shadow: 0 0 0 2px #fff, var(--shadow-sm); }
  .gmv:active { transform: translateY(1px); }
  .hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 3; margin: 0; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none; font: 600 16px var(--font-ui); color: var(--ink2); background: rgba(255, 255, 255, .92); padding: 6px 16px; border-radius: 999px; box-shadow: var(--shadow-sm); }
  .taphint { font: 700 14px var(--font-body); color: #5a3d00; background: rgba(255, 244, 214, .95); box-shadow: 0 0 0 2px #ffd36b, var(--shadow-sm); }
  /* the Shop's try-on card, under the buddy */
  .tryon { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); z-index: 3; width: min(480px, 98%); display: grid; grid-template-columns: 64px 1fr; gap: 6px 12px; align-items: center; padding: 10px 14px; box-shadow: 0 0 0 3px var(--rc), var(--shadow); }
  .tryon > img { width: 64px; height: 64px; object-fit: contain; grid-row: span 2; }
  .tryon .tt { display: flex; flex-direction: column; min-width: 0; }
  .tryon small { font: 800 11px var(--font-body); color: var(--rc); text-transform: uppercase; letter-spacing: .04em; }
  .tryon b { font: 600 20px var(--font-ui); }
  .tryon .tt span { font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .tryon .act { grid-column: 2; display: flex; justify-content: flex-end; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tryon .act .btn { padding: 6px 14px; font-size: 15px; }
  .keepline { font: 700 13px var(--font-body); color: var(--ink2); }
  .tryon em { font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .buy { display: inline-flex; align-items: center; gap: 6px; }
  .buy img, .egg .btn img { width: 20px; height: 20px; object-fit: contain; }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; align-content: start; padding: 4px; overflow: auto; }
  .countline { margin: 0; font: 600 13px var(--font-body); color: var(--muted); text-align: center; }
  .of { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); font: 600 14px var(--font-ui); color: var(--ink); }
  .of.on { border-color: var(--primary-hi); background: #faf7ff; }
  .of.locked { opacity: .55; filter: grayscale(.6); }
  .of.shake { animation: wiggle .35s ease; }
  .thumb { width: 88px; height: 88px; display: grid; place-items: center; }
  .thumb.dpic { border-radius: 50%; background: radial-gradient(circle at 50% 40%, #fff, #f3eaff); }
  .resetbtn { display: inline-flex; align-items: center; gap: 6px; }
  .gsname small { display: inline-flex; align-items: center; gap: 3px; }
  .movebtn { display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #ffe58a, #ffc94d) !important; color: #5a3d00 !important; }
  .rar { font: 800 11px var(--font-body); padding: 2px 8px; border-radius: 999px; background: var(--bg2); color: var(--ink2); }
  .rar.rare { background: #dcecff; color: #2f6fb8; }
  .rar.epic { background: #efe2ff; color: #7a4fd0; }
  .rar.legendary { background: #fff1c2; color: #8a6400; }
  .lock { display: flex; align-items: center; gap: 4px; font: 800 12px var(--font-body); color: var(--muted); }
  /* My things: what's on this spot, and your things for it */
  .gearpane { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px 2px 8px; }
  .gitems { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
  .gtile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 6px 6px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px var(--rc, #e4ddf3), var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .gtile:hover { transform: translateY(-3px); }
  .gtile.wearing { background: linear-gradient(180deg, #fff, #eefcf4); box-shadow: 0 0 0 3px #2fbf73, 0 0 18px rgba(47, 191, 115, .35); }
  .gtile > img { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .gtile.more { justify-content: center; padding-top: 10px; background: linear-gradient(180deg, #fffaf0, #fff3d6); box-shadow: 0 0 0 2px #ffd36b, var(--shadow-sm); }
  .gtile b { font: 600 17px/1.1 var(--font-ui); color: var(--ink); }
  .gpow { font: 600 12px/1.25 var(--font-body); color: var(--ink2); }
  .grar { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); font: 800 10px var(--font-body); color: #fff; background: var(--rc); padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .gst { margin-top: auto; font: 800 12px var(--font-body); font-style: normal; color: var(--ink2); background: var(--bg2); padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .gst.on { background: #2fbf73; color: #fff; }
  .gst.buy { background: #ffc94d; color: #5a3d00; }
  /* (div: the gear tiles use .wearing too) */
  div.wearing { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: rgba(255, 255, 255, .92); border-radius: 16px; padding: 6px 8px 6px 14px; box-shadow: var(--shadow-sm); font: 600 15px var(--font-body); color: var(--ink2); }
  div.wearing span { flex: 1; min-width: 120px; }
  div.wearing .btn { padding: 6px 14px; font-size: 15px; }
  /* Move it takes the place of the side panel, so the buddy stays in full view */
  .mover { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 0 0 3px #ffd36b, var(--shadow); }
  .mvhead { display: flex; align-items: center; gap: 8px; font: 600 17px var(--font-ui); }
  .mvhead b { flex: 1; }
  .mvhead img { width: 36px; height: 36px; object-fit: contain; }
  .mvgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .mvrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .mv { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 64px; border: 0; border-radius: 14px; background: #f4f0ff; font: 600 22px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: inset 0 -3px 0 #ddd3f7; touch-action: none; user-select: none; }
  .mv:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #ddd3f7; background: #ebe4ff; }
  .mv small { font: 800 11px var(--font-body); color: var(--ink2); margin-top: 2px; }
  .mv.mid { background: #fff4d6; color: #b07b00; }
  .mvbtns { display: flex; gap: 8px; justify-content: space-between; }
  .mvbtns .btn { padding: 8px 16px; font-size: 16px; }
  .savebtn { min-width: 120px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .savebtn.save { background: #2fbf73; box-shadow: 0 4px 0 #1f8f55; }
  .mvnote { margin: 0; font: 600 12px var(--font-body); color: var(--muted); text-align: center; }
  .gsets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .gset { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 4px 6px; border-radius: 16px; border: 3px solid transparent; background: rgba(255, 255, 255, .9); cursor: pointer; font: inherit; box-shadow: var(--shadow-sm); }
  .gset.done { border-color: #ffd36b; background: #fffaf0; box-shadow: 0 0 14px rgba(255, 200, 80, .45); }
  .gsicons { display: flex; }
  .gsicons img, .setpics img { width: 28px; height: 28px; object-fit: contain; }
  .gsicons img.off, .setpics img.off { filter: grayscale(1) opacity(.4); }
  .gsname { display: flex; flex-direction: column; align-items: flex-start; text-align: left; }
  .gsname b { font: 600 14px var(--font-ui); }
  .gsname small { font: 700 11px var(--font-body); color: var(--muted); }
  /* the Shop: filters and things */
  .filters { display: flex; flex-direction: column; gap: 6px; flex: none; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chips button { border: 0; cursor: pointer; font: 700 14px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .9); padding: 5px 12px; border-radius: 999px; box-shadow: inset 0 0 0 2px #e4ddf3; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
  .chips button.on { background: var(--primary); color: #fff; box-shadow: none; }
  .chips button img { width: 18px; height: 18px; object-fit: contain; margin: -2px 0; }
  .vibes button.on { background: #ff8fb8; }
  .shows button.on { background: #2fbf73; }
  .sorts button.on { background: #ffc94d; color: #5a3d00; }
  .sortbar { display: flex; align-items: center; gap: 10px; flex: none; }
  .sfbtn { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; font-size: 15px; }
  .sfbtn.on { background: var(--primary); color: #fff; }
  .sfnow { font: 700 13px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .85); padding: 4px 10px; border-radius: 999px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .sortby { align-self: center; font: 800 13px var(--font-body); color: var(--ink2); white-space: nowrap; background: rgba(255, 255, 255, .7); padding: 4px 8px; border-radius: 999px; }
  .sgrid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; align-content: start; padding: 4px 2px 8px; }
  .it { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 6px 8px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px var(--rc), var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .it:hover { transform: translateY(-3px); }
  .it.sel { box-shadow: 0 0 0 4px var(--primary-hi), 0 0 18px rgba(124, 92, 245, .35); }
  .it > img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .it b { font: 600 15px/1.1 var(--font-ui); color: var(--ink); }
  .it .where { font: 700 11px var(--font-body); color: var(--muted); display: inline-flex; align-items: center; gap: 3px; }
  .it .rar { position: absolute; top: 5px; left: 50%; transform: translateX(-50%); font: 800 10px var(--font-body); color: #fff; background: var(--rc); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .it em { margin-top: 4px; font: 800 12px var(--font-body); font-style: normal; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
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
  .foot { margin: 0; font: 600 13px var(--font-body); color: var(--muted); text-align: center; flex: none; }
  .gbg { position: fixed; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; padding: 16px; }
  .gcard { width: min(520px, 94vw); padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; box-shadow: 0 0 0 4px var(--rc, #fff), var(--shadow); }
  .gbig { width: 110px; height: 110px; object-fit: contain; }
  .gtext h3 { margin: 0 0 4px; font-size: 24px; }
  .gtext p { margin: 0 0 6px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .gclose { grid-column: 1 / -1; justify-self: end; }
  .askcard { box-shadow: 0 0 0 4px #ffd36b, var(--shadow); }
  .askbtns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .askbtns .btn { display: inline-flex; align-items: center; gap: 6px; }
  .setpics { display: flex; flex-direction: column; gap: 6px; }
  .setpics img { width: 56px; height: 56px; }
  .gtext ul { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font: 600 14px var(--font-body); color: var(--muted); }
  .gtext li.on { color: #1f9a6a; }
  /* short screens: the buddy card keeps just the name, friendship and the button */
  @media (max-height: 820px) and (min-width: 761px) {
    .crew { padding: 5px 20px; } .mate { width: 76px; padding: 3px 3px 4px; } .mate .nm { font-size: 14px; } .mate .pic :global(.critter-host) { width: 48px !important; height: 48px !important; } .mate .lk { top: 32px; }
    .who { padding: 8px 14px; gap: 4px; }
    .who h2 { font-size: 24px; }
    .quirk, .advline { display: none; }
    .body { padding: 10px 20px; gap: 14px; }
    .sides button { font-size: 19px; padding: 4px 10px; } .sides button img, .sides button :global(img.art) { width: 32px; height: 32px; }
    .sidehead { font-size: 14px; }
    .rpic { width: 38px; height: 38px; } .rpic img, .rpic :global(img.art) { width: 32px; height: 32px; }
    .gtile { padding: 16px 4px 6px; } .gtile > img { width: 48px; height: 48px; } .gtile b { font-size: 15px; } .gpow { font-size: 11px; }
    .mv { min-height: 52px; }
    /* the Shop's chips each keep to one row that slides sideways, so the things get the room */
    .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
    .chips::-webkit-scrollbar { display: none; }
    .chips button { font-size: 13px; padding: 4px 10px; }
    .filters { gap: 4px; }
    .foot { display: none; }
    .sidehead { font-size: 14px; padding: 2px 12px; }
    .rb { padding: 3px 2px 2px; } .rb small { font-size: 10px; }
    .sgrid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); }
    .it { padding: 15px 4px 5px; gap: 1px; } .it > img { width: 44px; height: 44px; } .it b { font-size: 14px; } .it em { margin-top: 2px; padding: 2px 8px; }
    .sides button { padding: 2px 10px; } .sides button img, .sides button :global(img.art) { width: 28px !important; height: 28px !important; }
    .tryon { padding: 8px 12px; } .tryon > img { width: 52px; height: 52px; } .tryon b { font-size: 18px; }
  }
  @media (max-width: 1100px) and (min-width: 761px) {
    .body { grid-template-columns: minmax(0, .85fr) minmax(400px, 1.15fr); }
    .whotop .xp { min-width: 160px; } .xp .muted { display: none; }
  }
  @media (max-width: 760px) {
    .crew { padding: 6px 10px; gap: 6px; } .mate { width: 70px; } .mate .nm { font-size: 13px; } .mate .pic :global(.critter-host) { width: 48px !important; height: 48px !important; } .mate .lk { top: 30px; right: 6px; }
    .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); padding: 8px 10px; gap: 8px; }
    .left { gap: 6px; }
    .who { padding: 6px 10px; } .who h2 { font-size: 20px; } .quirk, .advline { display: none; }
    .whotop { gap: 8px; } .whotop .xp { min-width: 0; } .xp .muted { display: none; } .playwith { padding: 4px 10px; font-size: 13px; }
    .joins { font-size: 13px; }
    .stagebox { flex: none; height: 36vh; }
    /* phones: the whole panel under the buddy scrolls, so the pieces never squash to nothing */
    .side { overflow-y: auto; padding-bottom: 16px; }
    .gearpane, .grid, .sgrid, .eggs { flex: none; overflow: visible; }
    .sides button { font-size: 17px; gap: 6px; padding: 4px 6px; } .sides button img, .sides button :global(img.art) { width: 30px; height: 30px; } .sides button em { display: none; }
    .sidehead { font-size: 13px; }
    .rail { grid-auto-columns: 62px; overflow-x: auto; padding: 6px 4px 2px; margin: -6px -4px 0; scrollbar-width: none; }
    .rail::-webkit-scrollbar { display: none; }
    .rpic { width: 40px; height: 40px; } .rpic img, .rpic :global(img.art) { width: 34px; height: 34px; }
    .mover { padding: 8px; gap: 6px; }
    .mv { min-height: 50px; font-size: 18px; } .mv :global(img) { width: 30px; height: 30px; }
    .gitems { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .gtile { padding: 20px 4px 8px; }
    .gtile > img { width: 52px; height: 52px; }
    .gtile b { font-size: 14px; }
    .gpow { font-size: 11px; }
    .chips button { font-size: 12px; padding: 4px 9px; }
    /* phones: each row of chips slides sideways instead of piling up over the things */
    .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); }
    .chips::-webkit-scrollbar { display: none; }
    .sgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .it > img { width: 52px; height: 52px; }
    .it b { font-size: 13px; }
    .tryon { grid-template-columns: 44px 1fr; padding: 6px 10px; gap: 4px 10px; }
    .tryon > img { width: 44px; height: 44px; }
    .tryon b { font-size: 16px; } .tryon .tt span { display: none; }
    .keepline { font-size: 12px; }
    .hint { font-size: 13px; padding: 4px 12px; }
    .wallet { font-size: 15px; }
    .gcard { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .askbtns { justify-content: center; }
    .gset { flex-direction: column; gap: 2px; }
    .gsname { align-items: center; text-align: center; }
  }
</style>
