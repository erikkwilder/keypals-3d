<script lang="ts">
  // My Sky Island: your own floating island, built with shells. The catalogue along the bottom has homes,
  // trees and flowers, water, paths and fences, lights and fun things, a home for each kind of Glimmer and a
  // few dream things to save up for; tap one, put it where it fits (tap a square or drag it), turn it, and
  // it's yours. Tap something on the island to move it, turn it or put it back in storage. Your buddy
  // potters about (walk it with the keys, the stick or a tap), up to eight of your Glimmers live there, and
  // what you build brings visitors: now and then one floats down with a little present, sometimes one you
  // haven't met yet (it says where to find it). Meeting more Glimmers makes the island grow. Family on this
  // computer can visit each other's islands and leave a heart. It's where rewards live: it never uses play
  // time. The save and its rules are in island/save.ts, the 3D in three/islandScene.ts.
  //
  // Blocks: the catalogue's Blocks tab has the pieces and the paint box; tap the grass or the side or top of a
  // block to put one there (Build), or Paint, Turn or Take away what's there, and Undo (island/blocks.ts).
  // Secrets: ten to find (island/secrets.ts), the Island secrets list shows them, each found one is a little
  // moment. Your Glimmers: tap one to pet it, give it a treat or throw it a ball; now and then one makes a
  // wish (island/play.ts). Photo: the buttons hide and a picture of the island is saved to the computer.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { IslandScene, type Out } from '../three/islandScene';
  import { sfx } from '../audio/sound';
  import { advOf, advView } from '../adventure/state';
  import { GLIMMER, type GlimmerId } from '../adventure/glimmers';
  import { FRIEND } from '../art/cast';
  import { ROOM_LOOK } from '../three/islandRoom';
  import { HABITAT_OF } from '../island/catalog';
  import { dressOf } from '../adventure/wardrobe';
  import { ITEM, ITEMS, KINDS, type ItemKind } from '../island/catalog';
  import {
    GROWTH, MAX_OUT, buyAndPlace, checkVisitor, familyOf, fits, footprint, freeSpot, giftWords, growthOf, heartNews, heartedToday, invitesOf, islandOf,
    islandView, leaveHeart, move, outOf, putAway, seeHearts, setOut, storage, storedOf, visitDue, visitorNow, whereToMeet, type Result, type Rot, type Visit,
  } from '../island/save';
  import { isClassLogin } from '../state/classHere';
  import type { Profile } from '../engine/profile';
  import Critter from '../ui/Critter.svelte';
  import Bar from '../ui/Bar.svelte';
  import Icon from '../ui/Icon.svelte';
  import BlockTray from '../island/BlockTray.svelte';
  import SecretsSheet from '../island/SecretsSheet.svelte';
  import { FIRST_PAINT, MAX_BLOCKS, PAINTS, SHAPE, blockCount, blockList, canPlace, ctxOf, paintBlock, placeBlock, removeBlock, turnBlock, undoOp, type BuildResult, type Op, type ShapeId } from '../island/blocks';
  import { BOTTLE_NOTE, NOTE_WORDS, SECRET, SECRETS, bottlePond, busyCells, darkness, foundCount, foundOf, findSecret, keepOutOf, noteFrom, openedToday, rainToday, sparkleSpot, type SecretId } from '../island/secrets';
  import { WANTS, canWish, dig, feed, fetched, grantWish, heartsOf, newWish, pet, wishAtWell, wishWords, type Wish, type WellGift } from '../island/play';
  import { buyShop, islandEntry, islandShelf, paintEntry } from '../shop/shop';
  import { islandDev } from '../island/dev';
  import { mulberry32 } from '../engine/rng';
  import { dayKey } from '../engine/profile';

  const base = import.meta.env.BASE_URL;
  const me = $derived(game.profile!);
  /** whose island this is: null, your own; a brother's or sister's while you visit (read only) */
  let owner = $state<Profile | null>(null);
  const visiting = $derived(owner !== null);
  const who = $derived(owner ?? me);
  const isl = $derived(islandView(who));
  const grow = $derived(growthOf(who));
  const shells = $derived(advView(me).shells);
  const fmt = (n: number) => n.toLocaleString('en-US');
  const an = (name: string) => (/^[aeiou]/i.test(name) ? 'An' : 'A');
  const face = (id: GlimmerId, evo = false) => `${base}game/glimmers/face/${id}${evo ? '-evo' : ''}.webp`;
  const family = $derived(familyOf(game.save.profiles, me.id, isClassLogin));

  // ---------- the 3D island ----------
  let scene: IslandScene | null = null;
  let disposed = false;
  let loading = $state(true);
  let viewEl: HTMLDivElement | undefined = $state();
  let topEl: HTMLElement | undefined = $state();
  let sideEl: HTMLElement | undefined = $state();
  let bottomEl: HTMLElement | undefined = $state();
  let narrow = $state(innerWidth < 760 || innerHeight < 520);
  let trayOpen = $state(!(innerWidth < 760 || innerHeight < 520));
  let thumbs = $state<Record<string, string>>({});
  /** taking a photo: the buttons hide */
  let photo = $state(false);
  function viewOf() {
    if (photo) return { top: 0.04, bottom: narrow ? 0.84 : 0.86, left: 0, right: 1 };
    // (on a phone the round buttons sit in a row under the bar: the island goes below them)
    const t = (narrow ? sideEl : null)?.getBoundingClientRect() ?? topEl?.getBoundingClientRect(), b = bottomEl?.getBoundingClientRect();
    const top = (t ? t.bottom + 4 : 70) / innerHeight, bottom = (b ? b.top - 4 : innerHeight - 140) / innerHeight;
    return { top, bottom: Math.max(top + 0.25, bottom), left: 0, right: 1 };
  }
  /** how far up the bottom bar reaches (the Dig button sits over it) */
  let barUp = $state(220);
  function onResize() {
    narrow = innerWidth < 760 || innerHeight < 520; if (scene) scene.view = viewOf();
    const b = bottomEl?.getBoundingClientRect(); if (b) barUp = Math.round(innerHeight - b.top + 16);
  }
  $effect(() => { void trayOpen; void placing; void selected; void visiting; void photo; void mode; requestAnimationFrame(onResize); });

  const outsOf = (p: Profile): Out[] => { const a = advView(p); return outOf(p).map(id => ({ id, level: a.glimmers[id]?.level ?? 1, evolved: !!a.glimmers[id]?.evolved })); };

  async function build(o: Profile | null) {
    loading = true;
    const p = o ?? game.profile!;
    if (!o && !game.profile!.island?.started) game.update(pp => { islandOf(pp); });
    const s = islandView(p), g = growthOf(p);
    const grewFrom = !o && s.grown < g.stage ? GROWTH[s.grown].r : undefined;
    try {
      const sc = await IslandScene.create({ save: s, r: g.r, buddy: me.buddy, dress: dressOf(me), view: viewOf(), grewFrom, caveOpen: foundOf(s, 'cave') });
      if (disposed || (o?.id ?? null) !== (owner?.id ?? null)) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      if (import.meta.env.DEV) (window as unknown as { __sky: unknown }).__sky = { placeBlocks: devBlocks, scene: sc };
      sc.onLanded = () => { const v = visitorNow(islandView(me)); if (v && !owner) { card = { kind: 'visitor', v }; } };
      sc.onReach = reached;
      sc.onInside = onInside;
      sc.onFetched = (id) => {
        let j: ReturnType<typeof fetched> | null = null;
        game.update(pp => { j = fetched(pp, id); });
        say(`${GLIMMER[id].name} brought the ball back!`, 2600);
        if ((j as ReturnType<typeof fetched> | null)?.note) noteNow(id);
      };
      await sc.setOut(outsOf(p));
      if (!o) {
        if (grewFrom) { say(`Your island grew! ${g.met} Glimmers met.`, 5000); sfx.levelUp(2); }
        if (s.grown !== g.stage) game.update(pp => { islandOf(pp).grown = g.stage; });
        const news = heartNews(s);
        if (news) { hearts = news; setTimeout(() => sc.hearts(), 900); }
        lookForVisitor(true);
        setupSecrets(sc);
        // from the Shop's "Put it on my island": ready to put it out
        const want = game.islandPlace;
        if (want) { game.islandPlace = null; later(() => { if (storedOf(islandView(me), want) > 0) { mode = 'things'; kind = 'storage'; pickItem(want); } }, 400); }
      } else say(`${o.name}'s island. Have a look round, and leave a heart!`, 5000);
      void sc.thumbs([...ITEMS.map(i => i.id), ...PAINTS.filter(x => x.kind !== 'plain').map(x => `block:cube:${x.id}`), ...SHAPES_IDS.map(id => `block:${id}:${paint}`)], (id, url) => { thumbs[id] = url; });
    } catch (e) { console.error(e); }
    loading = false;
  }
  onMount(() => {
    addEventListener('resize', onResize);
    viewEl?.addEventListener('wheel', onWheel, { passive: false });
    void build(null);
    raf = requestAnimationFrame(follow);
    visitTimer = setInterval(() => { lookForVisitor(true); void askWish(); }, 30000);
  });
  onDestroy(() => {
    disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(driveRaf); clearInterval(visitTimer); clearTimeout(sayTimer);
    for (const t of timers) clearTimeout(t);
    removeEventListener('resize', onResize); viewEl?.removeEventListener('wheel', onWheel);
    if (scene && stage.current() === scene) stage.use(null);
  });

  // ---------- the buddy's words, and labels that follow things ----------
  let said = $state<string | null>(null);
  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string, ms = 3600) { said = text; clearTimeout(sayTimer); sayTimer = setTimeout(() => (said = null), ms); }
  let raf = 0;
  let tag = $state<{ id: GlimmerId; until: number; x: number; y: number } | null>(null);
  let visitorAt = $state<{ x: number; y: number } | null>(null);
  let selAt = $state<{ x: number; y: number } | null>(null);
  function follow() {
    if (scene) {
      const r = viewEl?.getBoundingClientRect();
      if (tag) { const at = scene.screenOf({ glimmer: tag.id }, 0.95); if (!at || performance.now() > tag.until) tag = null; else tag = { ...tag, x: at.x * innerWidth - (r?.left ?? 0), y: at.y * innerHeight - (r?.top ?? 0) }; }
      const va = shownVisit && !opened ? scene.screenOf({ visitor: true }, 1.05) : null;
      visitorAt = va ? { x: va.x * innerWidth, y: va.y * innerHeight } : null;
      const sa = selected && !placing ? scene.screenOf({ uid: selected }) : null;
      selAt = sa ? { x: sa.x * innerWidth, y: sa.y * innerHeight } : null;
      if (gcard) { const at = scene.screenOf({ glimmer: gcard.id }, 1.05); if (!at || performance.now() > gcard.until) endTalk(); else { gcard.x = at.x * innerWidth; gcard.y = at.y * innerHeight; } }
      const mb = msgsEl?.getBoundingClientRect(); msgsBottom = mb && mb.height > 4 ? mb.bottom : 92;
      // what's close to do (one hint over the buddy's head)
      const n = canMove() && !gcard && !blocking ? scene.near() : null;
      if ((n?.kind ?? null) !== (near?.kind ?? null) || n?.label !== near?.label) near = n ? { kind: n.kind, label: n.label } : null;
      const ba = n ? scene.buddyScreen() : null;
      nearAt = ba ? { x: ba.x * innerWidth, y: ba.y * innerHeight } : null;
      if (busy !== scene.busy) busy = scene.busy;
      // the Wishing Well's "Make a wish", and digging where the grass sparkles
      const well = !owner && !blocking && !placing && !photo && canWish(isl) ? Object.entries(isl.placed).find(([, pl]) => pl.item === 'well')?.[0] : undefined;
      const wv = well ? scene.thingAt(well) : null, ws = wv ? scene.screenAt(wv.setY(2.15)) : null;
      wellAt = ws && well ? { uid: well, x: ws.x * innerWidth, y: ws.y * innerHeight } : null;
      canDig = !owner && !photo && !digging && scene.onSparkle;
    }
    raf = requestAnimationFrame(follow);
  }

  // ---------- visitors ----------
  let card = $state<{ kind: 'visitor'; v: Visit } | null>(null);
  let shownVisit = $state<Visit | null>(null);
  let opened = $state(true);
  let visitTimer: ReturnType<typeof setInterval> | undefined;
  const openedKey = () => `keypals-island-opened-${me.id}`;
  function openedAt(): number { try { return Number(localStorage.getItem(openedKey()) ?? 0); } catch { return 0; } }
  /** the thing on the island a visitor of an element came for (its home first) */
  function nearFor(id: GlimmerId): string | null {
    const el = GLIMMER[id].element;
    let best: string | null = null, bn = 0;
    for (const pl of Object.values(isl.placed)) { const n = ITEM[pl.item]?.invites?.[el] ?? 0; if (n > bn) { bn = n; best = pl.item; } }
    return best;
  }
  function lookForVisitor(arriving: boolean) {
    if (owner || !scene || placing) return;
    let v: Visit | null = null;
    if (visitDue(islandView(me), Date.now())) game.update(pp => { v = checkVisitor(pp); });
    const now = v ?? visitorNow(islandView(me));
    if (!now || shownVisit?.at === now.at) return;
    shownVisit = now;
    opened = openedAt() >= now.at;
    void scene.setVisitor({ id: now.id, near: nearFor(now.id), present: !opened }, arriving && !!v);
    if (!v && !opened) card = null;
  }
  function thanks() {
    const v = card?.v;
    card = null;
    if (!v) return;
    if (!opened) { opened = true; try { localStorage.setItem(openedKey(), String(v.at)); } catch { /* fine */ } scene?.openPresent(); sfx.cheer(); }
    if (v.gift.kind === 'deco') say(`The ${ITEM[v.gift.item]?.name ?? 'present'} is in your storage. Put it anywhere!`);
  }

  // ---------- building ----------
  let kind = $state<ItemKind | 'storage'>('home');
  let placing = $state<{ item: string; x: number; z: number; rot: Rot; uid: string | null } | null>(null);
  let selected = $state<string | null>(null);
  const stored = $derived(storage(isl));
  // the tray is a window onto the Shop's Island section: the same things at the same prices (shop/shop.ts)
  const shown = $derived(kind === 'storage' ? stored.map(s => s.item) : islandShelf(kind).map(e => ITEM[e.id]));
  /** a thing's price: the Shop's */
  const priceOf = (id: string) => islandEntry(id)?.price ?? ITEM[id].price;
  const ghostOk = $derived(placing ? fits(isl, grow.r, ITEM[placing.item], placing.x, placing.z, placing.rot, placing.uid ?? undefined) : false);
  const placingCost = $derived(placing && !placing.uid && storedOf(isl, placing.item) < 1 ? priceOf(placing.item) : 0);
  function ghost() { if (scene && placing) scene.setGhost({ item: placing.item, x: placing.x, z: placing.z, rot: placing.rot, ok: ghostOk, hide: placing.uid }); }
  $effect(() => { void ghostOk; ghost(); });
  function pickItem(id: string) {
    if (visiting) return;
    const it = ITEM[id];
    const have = storedOf(isl, id) > 0;
    if (!have && shells < priceOf(id)) { sfx.nope(); say(`You need ${fmt(priceOf(id) - shells)} more shells for the ${it.name}. Practice and battles earn shells!`); return; }
    const spot = freeSpot(isl, grow.r, it, 0, { x: 0.5, z: 1.5 });
    if (!spot) { sfx.nope(); say('No room left! Your island grows when you meet more Glimmers.'); return; }
    sfx.click();
    selected = null; scene?.select(null);
    placing = { item: id, x: spot.x, z: spot.z, rot: 0, uid: null };
    scene?.setBuilding(true);
    ghost();
    if (narrow) trayOpen = false;
  }
  function turn() {
    if (!placing) return;
    const it = ITEM[placing.item], rot = ((placing.rot + 1) % 4) as Rot;
    const f0 = footprint(it, placing.rot), cx = placing.x + (f0.w - 1) / 2, cz = placing.z + (f0.d - 1) / 2, f = footprint(it, rot);
    let x = Math.round(cx - (f.w - 1) / 2), z = Math.round(cz - (f.d - 1) / 2);
    if (!fits(isl, grow.r, it, x, z, rot, placing.uid ?? undefined)) { const s = freeSpot(isl, grow.r, it, rot, { x: cx, z: cz }, placing.uid ?? undefined); if (s) ({ x, z } = s); }
    placing = { ...placing, x, z, rot }; sfx.click();
  }
  function moveGhostTo(px: number, pz: number) {
    if (!placing) return;
    const f = footprint(ITEM[placing.item], placing.rot), x = Math.round(px - (f.w - 1) / 2), z = Math.round(pz - (f.d - 1) / 2);
    if (x !== placing.x || z !== placing.z) placing = { ...placing, x, z };
  }
  function cancelPlace() { placing = null; scene?.setGhost(null); scene?.setBuilding(false); sfx.click(); }
  function confirmPlace() {
    const pl = placing;
    if (!pl) return;
    let r = { ok: false, why: '' } as Result;
    const hadInvites = Object.values(invitesOf(isl)).some(n => n > 0);
    // (buying here is the Shop's buying: it goes in "What I earned" with what it bought)
    const buying = !pl.uid && placingCost > 0;
    game.update(pp => { r = pl.uid ? move(pp, pl.uid, pl.x, pl.z, pl.rot) : buyAndPlace(pp, pl.item, pl.x, pl.z, pl.rot); }, buying ? { bought: [islandEntry(pl.item).key] } : undefined);
    if (!r.ok) { sfx.nope(); say(r.why); return; }
    placing = null;
    scene?.setGhost(null); scene?.setBuilding(false);
    scene?.sync(islandView(me));
    if (pl.uid) { sfx.click(); scene?.cheerAt(pl.uid); }
    else {
      sfx.buy();
      const it = ITEM[pl.item];
      say(it.habitat ? `${it.name}! ${GLIMMER_WORD[it.habitat]} Glimmers will love it. Maybe one will visit...` : it.invites ? `The ${it.name} might bring visitors!` : `A new ${it.name}!`);
      // the first thing that invites anyone: a visitor comes along soon after
      if (!hadInvites && it.invites) setTimeout(() => lookForVisitor(true), 4000);
    }
    afterBuild();
  }
  const GLIMMER_WORD: Record<string, string> = { sun: 'Sun', frost: 'Ice', tide: 'Water', stone: 'Stone', leaf: 'Leaf' };
  function choose(uid: string | null) { selected = uid; scene?.select(uid); }
  function startMove() { const pl = selected ? isl.placed[selected] : null; if (!pl || !selected) return; placing = { item: pl.item, x: pl.x, z: pl.z, rot: pl.rot, uid: selected }; selected = null; scene?.setBuilding(true); ghost(); sfx.click(); }
  function turnPlaced() {
    const uid = selected, pl = uid ? isl.placed[uid] : null; if (!uid || !pl) return;
    const it = ITEM[pl.item], rot = ((pl.rot + 1) % 4) as Rot, f0 = footprint(it, pl.rot), f = footprint(it, rot);
    const cx = pl.x + (f0.w - 1) / 2, cz = pl.z + (f0.d - 1) / 2;
    let spot: { x: number; z: number } | null = { x: Math.round(cx - (f.w - 1) / 2), z: Math.round(cz - (f.d - 1) / 2) };
    if (!fits(isl, grow.r, it, spot.x, spot.z, rot, uid)) spot = freeSpot(isl, grow.r, it, rot, { x: cx, z: cz }, uid);
    if (!spot) { sfx.nope(); say('No room to turn it here.'); return; }
    const s = spot;
    game.update(pp => { move(pp, uid, s.x, s.z, rot); });
    scene?.sync(islandView(me)); scene?.select(uid); sfx.click();
  }
  function store() {
    const uid = selected; if (!uid) return;
    const name = ITEM[isl.placed[uid]?.item]?.name ?? 'It';
    game.update(pp => { putAway(pp, uid); });
    choose(null); scene?.sync(islandView(me)); sfx.pop();
    say(`${name} is in your storage.`);
  }

  // ---------- the Glimmers ----------
  let sheet = $state<null | 'glimmers' | 'family' | 'postcards' | 'secrets'>(null);
  const owned = $derived((Object.keys(advView(me).glimmers) as GlimmerId[]).filter(id => GLIMMER[id] && !GLIMMER[id].pending && advView(me).glimmers[id]));
  const out = $derived(outOf(me));
  function toggleOut(id: GlimmerId) {
    const cur = outOf(me);
    const next = cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_OUT ? null : [...cur, id];
    if (!next) { sfx.nope(); say(`Up to ${MAX_OUT} Glimmers can live on the island at once.`); return; }
    game.update(pp => setOut(pp, next));
    void scene?.setOut(outsOf(me)); sfx.pop();
  }

  // ---------- family ----------
  let hearts = $state<{ hearts: { name: string; buddy: import('../art/cast').FriendId }[]; text: string } | null>(null);
  function closeHearts() { hearts = null; game.update(pp => seeHearts(pp)); }
  async function visit(p: Profile) { sheet = null; placing = null; choose(null); card = null; shownVisit = null; owner = p; sfx.whoosh(); await build(p); }
  async function goHome() { owner = null; card = null; shownVisit = null; sfx.whoosh(); await build(null); }
  const hearted = $derived(owner ? heartedToday(owner, me.id) : false);
  function leave() {
    const o = owner ? game.save.profiles.find(x => x.id === owner!.id) : null;
    if (!o) return;
    if (!leaveHeart(o, me)) { say(`You left ${o.name} a heart today already. Come back tomorrow!`); return; }
    o.updatedAt = Date.now();
    game.persist(); game.onProfileChange?.();
    owner = o;
    scene?.hearts();
    say(`You left a heart for ${o.name}! They'll see it next time they visit their island.`, 4500);
  }
  const summary = (p: Profile) => { const s = islandView(p); const n = Object.keys(s.placed).length; return `${n} thing${n === 1 ? '' : 's'} built · ${s.postcards.length} visitor${s.postcards.length === 1 ? '' : 's'}`; };

  // ---------- building with blocks ----------
  const SHAPES_IDS = Object.keys(SHAPE) as ShapeId[];
  let mode = $state<'things' | 'blocks'>('things');
  let tool = $state<'build' | 'paint' | 'turn' | 'remove'>('build');
  let shape = $state<ShapeId>('cube');
  let paint = $state(FIRST_PAINT);
  /** extra quarter turns for the next piece (the R key) */
  let turnK = $state(0);
  let undos: Op[] = [];
  let undoN = $state(0);
  const blocking = $derived(trayOpen && mode === 'blocks' && !visiting && !placing && !photo);
  const nBlocks = $derived(blockCount(isl.blocks));
  let wasBlocking = false;
  $effect(() => { const on = blocking; if (!scene || placing || on === wasBlocking) return; wasBlocking = on; scene.setBuilding(on); if (!on) { scene.ghostBlock(null); scene.markBlock(null); } });
  /** what building needs (inside game.update) */
  const ctxFor = (pp: Profile) => { const s = islandOf(pp), r = growthOf(pp).r; return ctxOf(s, r, keepOutOf(r)); };
  function setShape(sh: ShapeId) { shape = sh; tool = 'build'; turnK = 0; sfx.click(); refreshHover(); }
  function setPaint(pn: number) {
    paint = pn; if (tool !== 'paint') tool = tool === 'build' ? 'build' : 'paint'; sfx.click();
    void scene?.thumbs(SHAPES_IDS.map(id => `block:${id}:${pn}`), (id, url) => { thumbs[id] = url; });
    refreshHover();
  }
  /** a special paint not found yet: how to get it, and buying it */
  let lockedPaint = $state<number | null>(null);
  function unlockPaint() {
    const pd = lockedPaint === null ? null : PAINTS[lockedPaint];
    if (!pd?.special) return;
    const e = paintEntry(pd.id);
    let r: ReturnType<typeof buyShop> = { ok: false };
    game.update(pp => { r = buyShop(pp, e.key); }, { bought: [e.key] });
    const res = r as ReturnType<typeof buyShop>;
    if (!res.ok) { sfx.nope(); say(res.why ?? 'Not now.'); return; }
    sfx.buy(); lockedPaint = null; setPaint(pd.id);
    say(`${pd.name} blocks are yours! Build with them as much as you like.`);
  }
  function blockTap(x: number, y: number) {
    if (!scene) return;
    const aim = scene.blockAim(x, y, shape, paint, turnK);
    let r: BuildResult = { ok: false, why: '' };
    if (tool === 'build') {
      const b = aim.place;
      if (!b) { sfx.nope(); return; }
      game.update(pp => { r = placeBlock(islandOf(pp), ctxFor(pp), b); });
      if ((r as BuildResult).ok) scene.popBlock(b);
    } else {
      const k = aim.key;
      if (!k) { sfx.nope(); return; }
      game.update(pp => { const s = islandOf(pp); r = tool === 'remove' ? removeBlock(s, k) : tool === 'paint' ? paintBlock(s, ctxFor(pp), k, paint) : turnBlock(s, k); });
      if ((r as BuildResult).ok && tool === 'remove' && aim.on) scene.puffBlock(aim.on);
    }
    const res = r as BuildResult;
    if (!res.ok) { sfx.nope(); if (res.why) say(res.why, 2600); return; }
    undos.push(res.op); if (undos.length > 80) undos.shift(); undoN = undos.length;
    scene.sync(islandView(me));
    if (tool === 'remove') sfx.whoosh(); else if (tool === 'build') sfx.pop(); else sfx.click();
    hinted = true;
    afterBuild();
    refreshHover();
  }
  function undo() {
    const op = undos.pop(); undoN = undos.length;
    if (!op) return;
    let ok = false;
    game.update(pp => { ok = undoOp(islandOf(pp), op); });
    if (ok) { scene?.sync(islandView(me)); sfx.click(); refreshHover(); } else { sfx.nope(); say('That can\'t be undone now.'); }
  }
  /** the see-through piece under the mouse */
  let lastHover: { x: number; y: number } | null = null;
  function hover(x: number, y: number) {
    lastHover = { x, y };
    if (!blocking || !scene) return;
    const aim = scene.blockAim(x, y, shape, paint, turnK);
    if (tool === 'build') {
      scene.markBlock(null);
      if (aim.place) { const r = growthOf(me).r; scene.ghostBlock(aim.place, canPlace(isl.blocks, ctxOf(isl, r, keepOutOf(r)), aim.place).ok); } else scene.ghostBlock(null);
    } else { scene.ghostBlock(null); scene.markBlock(aim.on, tool === 'remove' ? 0xff6b6b : tool === 'paint' ? PAINTS[paint].color : 0xffd34d); }
  }
  function refreshHover() { if (lastHover && !touchy) hover(lastHover.x, lastHover.y); }
  function setTool(t: typeof tool) { tool = t; sfx.click(); refreshHover(); }
  /** After building: is a Glimmer's wish there now? */
  function afterBuild() {
    let g: ReturnType<typeof grantWish> = null;
    game.update(pp => { g = grantWish(pp); });
    const w = g as ReturnType<typeof grantWish>;
    if (w) {
      scene?.wishGranted(w.id); sfx.levelUp(1);
      say(`${GLIMMER[w.id].name} loves it! Its wish came true.`, 4200);
      if (w.note) setTimeout(() => noteNow(w.id), 2500);
    }
    // a new pond: a bottle may wash up in it
    const pond = bottlePond(islandView(me));
    if (pond && !bottleShown) { bottleShown = true; later(() => scene?.showBottle(bottlePond(islandView(me))), islandDev.rain ? 3000 : 25000); }
  }
  /** (development: put blocks down from the console, as a test builds) */
  function devBlocks(list: import('../island/blocks').Block[]) {
    let n = 0;
    game.update(pp => { for (const b of list) if (placeBlock(islandOf(pp), ctxFor(pp), b).ok) n++; });
    scene?.sync(islandView(me)); afterBuild();
    return n;
  }

  // ---------- talking with the Glimmers ----------
  // Walk up to one and press E (or tap it): it says something (what it wishes for, what it's doing, how it
  // feels) and you pick what to do: pet it, play ball, give it a treat. Short words a six-year-old can read.
  let gcard = $state<{ id: GlimmerId; until: number; x: number; y: number; line: string; happy: boolean } | null>(null);
  /** the messages at the top: the talk card goes under its Glimmer rather than over them */
  let msgsEl: HTMLDivElement | undefined = $state();
  let msgsBottom = $state(92);
  const TALK_MS = 20000;
  /** what a Glimmer says when you come to talk */
  function lineFor(id: GlimmerId): string {
    const w = isl.wish?.id === id ? isl.wish : null;
    if (w) return `I wish for ${WANTS[w.want].words}! Can you build it?`;
    const mood = scene?.moodOf(id);
    if (mood === 'nap') return 'Zzz... Oh! Hi! I was having a little nap.';
    if (mood === 'swim') return 'Splash! The water is lovely.';
    if (mood === 'warm') return 'Mmm, the sun is so warm here.';
    if (mood === 'sit') return 'This is a good spot to sit.';
    if (mood === 'perch') return 'I can see the whole island from up here!';
    const home = ITEM[HABITAT_OF[GLIMMER[id].element]];
    const hasHome = Object.values(isl.placed).some(pl => pl.item === home.id);
    const h = heartsOf(isl, id), r = Math.random();
    if (!hasHome && r < 0.4) return `I would love a ${home.name} one day.`;
    if (h >= 4) return `You are my best friend, ${FRIEND[me.buddy].name}!`;
    if (h >= 2) return r < 0.5 ? 'I am so happy you came to see me!' : 'I like it here on your island.';
    return r < 0.5 ? 'Hello! Do you want to play?' : 'Hi! Will you be my friend?';
  }
  /** Start talking to a Glimmer (walked up and pressed E, or tapped it). */
  function talkTo(id: GlimmerId) {
    if (selected) choose(null);
    scene?.talkTo(id);
    gcard = { id, until: performance.now() + TALK_MS, x: gcard?.x ?? 0, y: gcard?.y ?? 0, line: lineFor(id), happy: false };
  }
  function endTalk() { gcard = null; scene?.endTalk(); }
  function keepCard() { if (gcard) gcard.until = performance.now() + TALK_MS; }
  function petGlimmer() {
    const g = gcard; if (!g) return;
    keepCard();
    let j: ReturnType<typeof pet> | null = null;
    game.update(pp => { j = pet(pp, g.id); });
    scene?.poke(g.id); sfx.giggle();
    g.line = ['Hee hee! That tickles!', 'Aww, I love pets!', 'More, more!'][Math.floor(Math.random() * 3)]; g.happy = true;
    if ((j as ReturnType<typeof pet> | null)?.note) noteNow(g.id);
  }
  function giveTreat() {
    const g = gcard; if (!g) return;
    keepCard();
    let r: ReturnType<typeof feed> | null = null;
    game.update(pp => { r = feed(pp, g.id); });
    const res = r as ReturnType<typeof feed> | null;
    if (!res?.ok) { sfx.nope(); return; }
    scene?.feedFx(g.id);
    g.line = 'Yum! Thank you! That was so good.'; g.happy = true;
    if (res.note) setTimeout(() => noteNow(g.id), 2200);
  }
  /** No treats: they're in the Shop's Care section (one place sells each thing; Back comes back here) */
  function getTreats() { sfx.click(); game.openShop(null, 'care'); }
  /** the whole Island section in the Shop (Back comes back here) */
  function toShop() { sfx.click(); if (placing) cancelPlace(); game.openShop(null, 'island'); }
  function playBall() {
    const g = gcard; if (!g) return;
    if (scene?.throwBall(g.id)) { endTalk(); say(`Fetch, ${GLIMMER[g.id].name}!`, 2000); } else sfx.nope();
  }

  // ---------- jumping, and E for what's close: talk, swing, climb, go in, get off ----------
  /** what the buddy can do where it is (the hint over its head; a button on a touch screen) */
  let near = $state<{ kind: string; label: string } | null>(null);
  let nearAt = $state<{ x: number; y: number } | null>(null);
  /** in a house: which kind (its room's name) */
  let inside = $state<string | null>(null);
  let busy = $state<'swing' | 'tree' | 'inside' | null>(null);
  const canMove = () => !!scene && !placing && !photo && !moment && !card && !sheet && lockedPaint === null && !roomNote;
  function doJump() { if (!canMove()) return; if (scene!.jump()) hinted = true; }
  function doAct() {
    if (!canMove()) return;
    if (gcard) { endTalk(); return; }
    const n = scene!.act();
    if (!n) return;
    hinted = true;
    if (n.kind === 'talk') {
      if (visiting) { tag = { id: n.id, until: performance.now() + 2800, x: 0, y: 0 }; sfx.pop(); }
      else { sfx.pop(); talkTo(n.id); }
    } else if (n.kind === 'note') showRoomNote();
    else if (n.kind === 'swing') say('Wheee! Press E or move to get off.', 2600);
    else if (n.kind === 'tree') say('Up we go!', 1800);
  }
  /** the house's little secret: a note from one of your Glimmers */
  let roomNote = $state<{ from: GlimmerId | null; text: string } | null>(null);
  const NOTES = [
    'I love your cosy house! Can I come for tea?',
    'I hid this note just for you. You are a great friend!',
    'Your bed looks so comfy. Can I nap here one day?',
    'Thank you for my home on the island. It is the best!',
    'Let us play ball later. I will be by the pond!',
  ];
  function showRoomNote() {
    const o = out, day = Number(dayKey(Date.now()).replace(/\D/g, '')) || 0;
    const from = o.length ? o[day % o.length] : null;
    roomNote = { from, text: NOTES[(day + (inside?.length ?? 0)) % NOTES.length] };
    sfx.twinkle();
  }
  function onInside(item: string | null) {
    inside = item;
    if (item) { choose(null); endTalk(); if (narrow) trayOpen = false; say(`Welcome to ${ROOM_LOOK[item]?.name ?? 'your house'}! Walk out of the door to go back.`, 4200); }
    else say('Back outside!', 1800);
  }
  function goOutside() { sfx.click(); scene?.getOff(); }
  // wishes: now and then a Glimmer living here thinks of something it would love
  async function askWish() {
    if (owner || !scene || photo) return;
    if (isl.wish) return;
    let w: Wish | null = null;
    game.update(pp => { w = newWish(pp, Date.now(), mulberry32(Date.now() % 2147483647)); });
    if (w) await showWish(w, true);
  }
  const picId = (pic: string) => (pic.startsWith('block:') ? `${pic}:${FIRST_PAINT}` : pic);
  async function showWish(w: Wish, announce: boolean) {
    const id = picId(WANTS[w.want].pic);
    await scene?.thumbs([id], (k, url) => { thumbs[k] = url; });
    scene?.setWish(w.id, thumbs[id] ?? null);
    if (announce) { say(wishWords(w), 5200); sfx.twinkle(); }
  }

  // ---------- secrets ----------
  let moment = $state<{ id: SecretId; extra?: string; gift?: string } | null>(null);
  let canDig = $state(false), digging = $state(false);
  let wellAt = $state<{ uid: string; x: number; y: number } | null>(null);
  let bottleShown = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (f: () => void, ms: number) => { timers.push(setTimeout(() => { if (!disposed) f(); }, ms)); };
  /** Found one: its moment (false if it was found before). */
  function found(id: SecretId, extra?: string): boolean {
    let ok = false;
    game.update(pp => { ok = findSecret(pp, islandOf(pp), id); });
    if (ok) showMoment(id, extra);
    return ok;
  }
  function showMoment(id: SecretId, extra?: string, gift?: string) {
    void scene?.thumbs([SECRET[id].keepsake], (k, url) => { thumbs[k] = url; });
    moment = { id, extra, gift }; sfx.levelUp(2); scene?.cheer();
  }
  /** the secrets on the island today: the sparkle, a bottle, a note, night, rain */
  function setupSecrets(sc: IslandScene) {
    game.update(pp => openedToday(islandOf(pp)));
    const s = islandView(me), day = dayKey(Date.now()), r = growthOf(me).r;
    const spot = sparkleSpot(me.id, s, r, busyCells(ctxOf(s, r).things, blockList(s.blocks)), day);
    sc.showSparkle(spot ? { x: spot.i, z: spot.j } : null);
    const pond = bottlePond(s);
    if (pond) { bottleShown = true; later(() => scene?.showBottle(bottlePond(islandView(me))), 12000); }
    const nf = noteFrom(s, outOf(me));
    if (nf) sc.showNote(nf);
    if (s.wish) later(() => { const w = islandView(me).wish; if (w) void showWish(w, false); }, 1500);
    else later(() => void askWish(), 40000);
    // the evening: stars, fireflies, glowing windows
    const dark = islandDev.night ? 1 : islandDev.day ? 0 : darkness(new Date());
    sc.setWeather({ dark, now: true });
    if (dark > 0.6) later(() => found('night'), 2600);
    // some days it rains, and then there's a rainbow
    if (islandDev.rain || rainToday(me.id, s, day)) later(() => {
      scene?.setWeather({ rain: 1 }); say('Pitter patter... it\'s raining on your island!', 3600);
      later(() => { scene?.setWeather({ rain: 0 }); scene?.rainbow(true); sfx.twinkle(); later(() => scene?.rainbow(false), 90000); }, islandDev.rain ? 9000 : 22000);
    }, islandDev.rain ? 2500 : 20000);
  }
  function noteNow(id: GlimmerId) { if (!foundOf(islandView(me), 'note')) { scene?.showNote(id); say(`${GLIMMER[id].name} left something for you!`, 3600); sfx.twinkle(); } }
  /** the buddy got somewhere secret */
  function reached(what: 'cave' | 'skyrock' | 'whale') {
    if (owner) return;
    if (what === 'cave') { scene?.secrets.openCave(); found('cave'); }
    else if (what === 'skyrock') found('skyrock');
    else { void scene?.secrets.whale(() => {}); if (!foundOf(islandView(me), 'whale')) later(() => found('whale'), 3800); else say('Look! The Sky Whale!', 3000); }
  }
  function digNow() {
    if (!scene || digging) return;
    let r: ReturnType<typeof dig> = null;
    game.update(pp => { r = dig(pp); });
    const res = r as ReturnType<typeof dig>;
    if (!res) return;
    digging = true;
    scene.dig(res.first, () => { digging = false; if (res.first) showMoment('chest'); else say('You dug up a Glimmer treat!', 3000); });
  }
  function wishWell() {
    const w = wellAt; if (!w || !scene) return;
    wellAt = null;
    scene.wishFx(w.uid, () => {
      let r: ReturnType<typeof wishAtWell> = null;
      game.update(pp => { r = wishAtWell(pp, Date.now(), mulberry32(Date.now() % 2147483647)); });
      const res = r as ReturnType<typeof wishAtWell>;
      if (!res) return;
      const words = giftWordsWell(res.gift);
      if (res.first) showMoment('well', undefined, words); else say(`The well gave you ${words}! Come back tomorrow for another wish.`, 4200);
    });
  }
  const giftWordsWell = (g: WellGift) => (g.kind === 'treat' ? 'a Glimmer treat' : g.kind === 'shells' ? `${g.n} shells` : `a ${ITEM[g.item]?.name ?? 'present'}`);

  // ---------- a photo ----------
  let shot = $state<string | null>(null);
  let flash = $state(false);
  function startPhoto() {
    if (placing) cancelPlace();
    photo = true; sheet = null; gcard = null; selected = null; scene?.select(null); scene?.frame(); sfx.click();
  }
  function endPhoto() { photo = false; shot = null; sfx.click(); }
  async function takePhoto() {
    const url = scene?.snapshot();
    if (!url) return;
    flash = true; setTimeout(() => (flash = false), 320); sfx.pop();
    const img = new Image();
    await new Promise<void>(res => { img.onload = () => res(); img.src = url; });
    // a tall phone screen: just the part round the island (no taller than 4 by 5)
    let sx = 0, sy = 0, sw = img.width, sh = img.height;
    if (sh > sw * 1.25) { sh = Math.round(sw * 1.25); const c = scene?.islandOnScreen(); sy = Math.max(0, Math.min(img.height - sh, Math.round((c?.y ?? 0.5) * img.height - sh * 0.5))); }
    // a white frame with the island's name and the day underneath
    const pad = Math.round(sw * 0.025), cap = Math.round(Math.max(48, sw * 0.06));
    const cv = document.createElement('canvas'); cv.width = sw + pad * 2; cv.height = sh + pad * 2 + cap;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#fffdf6'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(img, sx, sy, sw, sh, pad, pad, sw, sh);
    g.fillStyle = '#4a3218'; g.font = `600 ${Math.round(cap * 0.46)}px Fredoka, "Baloo 2", sans-serif`; g.textBaseline = 'middle';
    g.fillText(`${me.name}'s Sky Island`, pad * 1.4, sh + pad + cap * 0.55);
    g.fillStyle = '#9a7a52'; g.font = `600 ${Math.round(cap * 0.3)}px Fredoka, "Baloo 2", sans-serif`; g.textAlign = 'right';
    g.fillText(new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), cv.width - pad * 1.4, sh + pad + cap * 0.55);
    const out = cv.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a'); a.href = out; a.download = `my-sky-island-${dayKey(Date.now())}.jpg`; document.body.appendChild(a); a.click(); a.remove();
    shot = out;
  }

  // ---------- the camera and walking ----------
  // one finger or the mouse: look round (or, while placing, drag the thing); two fingers, a right-drag or
  // shift-drag: slide; pinch or scroll: closer or further. A short tap picks.
  const ptrs = new Map<number, { x: number; y: number }>();
  let down = { x: 0, y: 0, t: 0, button: 0 }, moved = 0, pinch = 0, mid = { x: 0, y: 0 }, dragGhost = false;
  let hinted = $state(false);
  let looking = $state(false);
  const two = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  function pdown(e: PointerEvent) {
    if (e.target !== viewEl) return;
    viewEl!.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button }; moved = 0;
      dragGhost = false;
      if (placing && scene && e.button === 0) {
        const c = scene.cellAt(e.clientX, e.clientY), f = footprint(ITEM[placing.item], placing.rot);
        if (c && Math.hypot(c.x - (placing.x + (f.w - 1) / 2), c.z - (placing.z + (f.d - 1) / 2)) < Math.max(f.w, f.d) / 2 + 0.9) dragGhost = true;
      }
    }
    if (ptrs.size === 2) { const g = two(); pinch = g.d; mid = { x: g.x, y: g.y }; moved = 99; dragGhost = false; }
  }
  function pmove(e: PointerEvent) {
    const q = ptrs.get(e.pointerId);
    if (!q && e.pointerType === 'mouse' && e.target === viewEl) { hover(e.clientX, e.clientY); return; }
    if (!q || !scene) return;
    const dx = e.clientX - q.x, dy = e.clientY - q.y;
    q.x = e.clientX; q.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      if (moved < 7) return;
      if (dragGhost) { const c = scene.cellAt(e.clientX, e.clientY); if (c) moveGhostTo(c.x, c.z); return; }
      if (down.button === 2 || e.shiftKey) scene.pan(dx, dy); else scene.orbit(dx, dy);
    } else if (ptrs.size === 2) {
      const g = two();
      if (pinch > 0 && g.d > 0) scene.zoom(pinch / g.d);
      scene.pan(g.x - mid.x, g.y - mid.y);
      pinch = g.d; mid = { x: g.x, y: g.y };
    } else return;
    looking = true; hinted = true;
  }
  function pup(e: PointerEvent) {
    const tapped = ptrs.size === 1 && moved < 7 && performance.now() - down.t < 600 && down.button !== 2;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) moved = 99;
    if (tapped) tapAt(e.clientX, e.clientY);
    dragGhost = false;
  }
  function onWheel(e: WheelEvent) { e.preventDefault(); scene?.zoom(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004), e.clientX, e.clientY); looking = true; hinted = true; }
  function tapAt(x: number, y: number) {
    if (!scene) return;
    if (placing) { const c = scene.cellAt(x, y); if (c) { moveGhostTo(c.x, c.z); sfx.click(); } return; }
    if (blocking) { blockTap(x, y); return; }
    if (photo) return;
    const h = scene.pick(x, y);
    if (h?.kind === 'roomnote') { scene.readNote(); showRoomNote(); return; }
    if (h?.kind === 'glimmer' && !visiting) { sfx.pop(); talkTo(h.id); return; }
    if (h?.kind === 'glimmer') { scene.poke(h.id); sfx.pop(); tag = { id: h.id, until: performance.now() + 2800, x: 0, y: 0 }; return; }
    if (!visiting && h?.kind === 'bottle') { scene.showBottle(null); sfx.pop(); found('bottle', BOTTLE_NOTE); return; }
    if (!visiting && h?.kind === 'note') { const from = noteFrom(isl, outOf(me)); scene.showNote(null); sfx.pop(); found('note', NOTE_WORDS(from ? GLIMMER[from].name : 'your Glimmer')); return; }
    if (!visiting && h?.kind === 'rainbow') { if (!found('rainbow')) say('What a lovely rainbow!', 2400); sfx.twinkle(); return; }
    if (!visiting && h?.kind === 'butterfly') { if (!found('butterfly')) say('The golden butterfly!', 2400); sfx.twinkle(); return; }
    if (h?.kind === 'visitor' && shownVisit) { card = { kind: 'visitor', v: shownVisit }; sfx.pop(); return; }
    if (h?.kind === 'buddy') { scene.cheer(); sfx.pop(); say(['Hi!', 'I love it here!', 'What shall we build?', 'Wheee!'][Math.floor(Math.random() * 4)], 2000); return; }
    if (h?.kind === 'item' && !visiting) { choose(selected === h.uid ? null : h.uid); sfx.click(); return; }
    if (selected) { choose(null); return; }
    const wr = scene.walkTo(x, y);
    if (wr === 'ok') { hinted = true; sfx.click(); gcard = null; }
    else if (wr === 'noway') { sfx.nope(); say('I can\'t get up there! Build a ramp or some stairs.', 3000); }
  }
  function backToIsland() { scene?.frame(); looking = false; sfx.click(); }

  // the arrow keys or W A S D, and the stick on a phone or tablet
  type Dir = 'up' | 'down' | 'left' | 'right';
  const KEYDIR: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const held = new Set<Dir>();
  const touchy = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  let stick = $state<{ x: number; y: number } | null>(null);
  let stickEl: HTMLDivElement | undefined = $state();
  let driveRaf = 0;
  function driveTick() {
    let x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0), z = (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0);
    if (stick && Math.hypot(stick.x, stick.y) > 0.25) { x = stick.x; z = -stick.y; }
    scene?.steer(x, z);
    if (x || z) { hinted = true; driveRaf = requestAnimationFrame(driveTick); } else driveRaf = 0;
  }
  function startDrive() { if (!driveRaf) driveRaf = requestAnimationFrame(driveTick); }
  function stickAt(e: PointerEvent) {
    const r = stickEl!.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    stick = { x, y }; startDrive();
  }
  function stickDown(e: PointerEvent) { e.preventDefault(); stickEl!.setPointerCapture(e.pointerId); stickAt(e); }
  function stickMove(e: PointerEvent) { if (stick) stickAt(e); }
  function stickUp() { stick = null; }
  function onKey(e: KeyboardEvent) {
    const tagName = (e.target as HTMLElement | null)?.tagName;
    if (game.modalOpen || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA') return;
    const d = KEYDIR[e.code];
    if (d) { e.preventDefault(); held.add(d); startDrive(); return; }
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); doJump(); return; }
    if (e.code === 'KeyE' && !e.repeat && !e.metaKey && !e.ctrlKey) { e.preventDefault(); doAct(); return; }
    if (placing && (e.key === 'r' || e.key === 'R')) { turn(); return; }
    if (placing && e.key === 'Enter') { confirmPlace(); return; }
    if (blocking && (e.key === 'r' || e.key === 'R')) { turnK = (turnK + 1) % 4; sfx.click(); refreshHover(); return; }
    if (blocking && e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); undo(); return; }
    if (e.key !== 'Escape') return;
    if (roomNote) roomNote = null; else if (gcard) endTalk(); else if (busy && busy !== 'tree') goOutside(); else if (moment) moment = null; else if (photo) endPhoto(); else if (card) thanks(); else if (sheet) sheet = null; else if (lockedPaint !== null) lockedPaint = null; else if (placing) cancelPlace(); else if (blocking) trayOpen = narrow ? false : (mode = 'things', true); else if (selected) choose(null); else if (owner) void goHome(); else game.back();
  }
  function keyUp(e: KeyboardEvent) { const d = KEYDIR[e.code]; if (d) held.delete(d); }

  const visitorsSeen = $derived(isl.postcards.length);
  const lastVisitor = $derived(isl.visits.length ? isl.visits[isl.visits.length - 1].id : null);
</script>

<svelte:window onkeydown={onKey} onkeyup={keyUp} onblur={() => { held.clear(); stick = null; }} />

<div class="isle" class:narrow class:visiting class:photo class:blocking class:inside={!!inside}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="view" bind:this={viewEl} onpointerdown={pdown} onpointermove={pmove} onpointerup={pup} onpointercancel={(e) => ptrs.delete(e.pointerId)} oncontextmenu={(e) => e.preventDefault()}></div>

  <!-- the one top bar (its size under the title); visiting family, Back comes home to your island -->
  <div class="top" bind:this={topEl}>
    <Bar title={visiting ? `${owner?.name}'s Sky Island` : 'My Sky Island'} esc={false} back={visiting ? () => void goHome() : undefined}
      trail={grow.next ? `Size ${grow.stage + 1} · meet ${grow.next.met} Glimmers to grow it (${grow.met} so far)` : `Size ${grow.stage + 1} · as big as it gets!`} />
  </div>

  <!-- the round buttons on the left: your Glimmers, family, postcards -->
  <nav class="side" aria-label="Island" bind:this={sideEl}>
    {#if !visiting}
      <button class="round" onclick={() => { sheet = 'glimmers'; sfx.pop(); }} title="Your Glimmers on the island">
        {#if out[0]}<img src={face(out[0], !!advView(me).glimmers[out[0]]?.evolved)} alt="" />{:else}<img src="{base}game/icon-grump.webp" alt="" />{/if}
        <span>Glimmers</span><em>{out.length}</em>
      </button>
      {#if family.length}
        <button class="round" onclick={() => { sheet = 'family'; sfx.pop(); }} title="Visit family's islands"><img src="{base}icons/players.webp" alt="" /><span>Family</span></button>
      {/if}
      <button class="round" onclick={() => { sheet = 'postcards'; sfx.pop(); }} title="Visitors and their postcards">
        <img src={lastVisitor ? face(lastVisitor) : `${base}icons/mail.webp`} alt="" /><span>Visitors</span><em>{visitorsSeen}</em>
      </button>
      <button class="round" onclick={() => { sheet = 'secrets'; sfx.pop(); void scene?.thumbs(SECRETS.map(d => d.keepsake), (id, url) => { thumbs[id] = url; }); }} title="Island secrets">
        <img src="{base}island/map.webp" alt="" /><span>Secrets</span><em>{foundCount(isl)}/{SECRETS.length}</em>
      </button>
      <button class="round" onclick={startPhoto} title="Take a picture of your island"><img src="{base}island/camera.webp" alt="" /><span>Photo</span></button>
    {:else}
      <button class="round home" onclick={goHome} title="Back to my island"><img src="{base}island/tile.webp" alt="" /><span>My island</span></button>
    {/if}
  </nav>

  <!-- the island's messages, in one place: they stack, so none covers another -->
  <div class="msgs" class:low={!!placing && narrow} bind:this={msgsEl}>
    {#if said}<div class="say"><Critter friend={me.buddy} look={me.settings.look} size={narrow ? 38 : 48} round /><p>{said}</p></div>{/if}
    {#if hearts && !visiting}
      <div class="hearts card">
        <img src="{base}icons/heart.webp" alt="" />
        <p><b>{hearts.text}</b><span>Family can visit your island from theirs.</span></p>
        <button class="btn small" onclick={closeHearts}>Yay!</button>
      </div>
    {/if}
    {#if !said && !hinted && !loading && !placing && !selected && !(narrow && trayOpen) && !gcard && !inside}
      <p class="hint">{touchy ? 'Drag to look round · pinch to zoom · tap the grass to walk' : 'Walk with the arrow keys · Space to jump · E to talk, swing, climb or go in'}</p>
    {/if}
    {#if looking && !placing && !inside}<button class="backview" onclick={backToIsland}><img src="{base}island/tile.webp" alt="" />See the whole island</button>{/if}
  </div>
  {#if loading}<div class="loadpill">Floating up to the island…</div>{/if}
  <!-- what's close to do: a hint over the buddy (a button on a touch screen) -->
  {#if near && nearAt && !touchy && near.kind !== 'jump'}<div class="acthint" style:left="{nearAt.x}px" style:top="{nearAt.y}px"><kbd>E</kbd>{near.label}</div>{/if}
  {#if near && nearAt && !touchy && near.kind === 'jump'}<div class="acthint" style:left="{nearAt.x}px" style:top="{nearAt.y}px"><kbd>Space</kbd>Jump</div>{/if}

  {#if tag}<div class="tag" style:left="{tag.x}px" style:top="{tag.y}px">{GLIMMER[tag.id].name}<small>Level {advView(who).glimmers[tag.id]?.level ?? 1}</small></div>{/if}
  {#if visitorAt && !card}<button class="vtag" style:left="{visitorAt.x}px" style:top="{visitorAt.y}px" onclick={() => { if (shownVisit) card = { kind: 'visitor', v: shownVisit }; sfx.pop(); }}><Icon name="gift" size={22} />A visitor!</button>{/if}
  {#if wellAt && !card && !moment}<button class="vtag wish" style:left="{wellAt.x}px" style:top="{wellAt.y}px" onclick={wishWell}><Icon name="sparkle" size={22} />Make a wish</button>{/if}
  {#if canDig && !placing}<button class="digbtn" style:bottom="{barUp}px" onclick={digNow}><img src="{base}island/shovel.webp" alt="" />Dig here!</button>{/if}

  {#if gcard}
    {@const gl = GLIMMER[gcard.id]}
    <!-- talking with a Glimmer: what it says, and what you'd like to do -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- (over the Glimmer; under it when it's near the top of the screen) -->
    <div class="gcard card" class:below={gcard.y < msgsBottom + (narrow ? 270 : 250)} style:left="{Math.min(innerWidth - 150, Math.max(150, gcard.x))}px" style:top="{gcard.y}px" onpointerdown={keepCard}>
      <div class="gt"><img src={face(gcard.id, !!advView(me).glimmers[gcard.id]?.evolved)} alt="" /><span><b>{gl.name}</b><small>Level {advView(me).glimmers[gcard.id]?.level ?? 1}</small></span>
        <span class="h5" title="Friendship">{#each [0, 1, 2, 3, 4] as i (i)}<img class:off={i >= heartsOf(isl, gcard.id)} src="{base}icons/heart.webp" alt="" />{/each}</span>
        <button class="x" onclick={endTalk} aria-label="Close"><Icon name="close" size={18} /></button></div>
      {#key gcard.line}<p class="line" class:happy={gcard.happy}>{gcard.line}</p>{/key}
      <p class="about">{gl.quirk}</p>
      <div class="replies">
        <button class="rep" onclick={petGlimmer}><img src="{base}icons/heart.webp" alt="" />Pet</button>
        <button class="rep" onclick={playBall}><img src="{base}island/ball.webp" alt="" />Play ball</button>
        {#if isl.treats > 0}<button class="rep" onclick={giveTreat}><img src="{base}island/treat.webp" alt="" />Treat<em>{isl.treats}</em></button>{/if}
      </div>
      {#if isl.treats === 0}<button class="treatlink" onclick={getTreats}><img src="{base}island/treat.webp" alt="" />Treats are in the Shop</button>{/if}
    </div>
  {/if}

  {#if blocking}
    <div class="tools" role="toolbar" aria-label="Building">
      <button class="tool" class:on={tool === 'build'} onclick={() => setTool('build')}><img src="{base}icons/blocks.webp" alt="" /><span>Build</span></button>
      <button class="tool" class:on={tool === 'paint'} onclick={() => setTool('paint')}><img src="{base}island/brush.webp" alt="" /><span>Paint</span></button>
      <button class="tool" class:on={tool === 'turn'} onclick={() => setTool('turn')}><img src="{base}icons/turnright.webp" alt="" /><span>Turn</span></button>
      <button class="tool" class:on={tool === 'remove'} onclick={() => setTool('remove')}><img src="{base}icons/erase.webp" alt="" /><span>Take away</span></button>
      <button class="tool" disabled={!undoN} onclick={undo}><img class="flip" src="{base}icons/redo.webp" alt="" /><span>Undo</span></button>
      {#if narrow}<small class="bcount">{nBlocks}/{MAX_BLOCKS}</small>{/if}
    </div>
  {/if}

  {#if selected && !placing && selAt && isl.placed[selected]}
    {@const it = ITEM[isl.placed[selected].item]}
    <div class="selbar card" style:left="{Math.min(innerWidth - 150, Math.max(150, selAt.x))}px" style:top="{Math.max(narrow ? 250 : 210, selAt.y)}px">
      <b>{it.name}</b>
      <div class="row">
        <button class="act" onclick={startMove}><Icon name="swap" size={22} />Move</button>
        <button class="act" onclick={turnPlaced}><Icon name="turnright" size={22} />Turn</button>
        <button class="act" onclick={store}><Icon name="down" size={22} />Put away</button>
        <button class="x" onclick={() => choose(null)} aria-label="Close"><Icon name="close" size={20} /></button>
      </div>
    </div>
  {/if}


  {#if touchy && !placing && !photo && (!trayOpen || inside)}
    <div class="moves" style:bottom="{inside ? 96 : barUp}px">
      {#if near && near.kind !== 'jump' && !(inside && near.kind === 'off')}<button class="actbtn" onclick={doAct}>{near.label}</button>{/if}
      <button class="jumpbtn" onclick={doJump} aria-label="Jump"><Icon name="up" size={30} /><span>Jump</span></button>
    </div>
  {/if}

  <footer class="bottom" bind:this={bottomEl}>
    {#if inside}
      <div class="trayrow">
        {#if touchy}
          <div class="stick" bind:this={stickEl} onpointerdown={stickDown} onpointermove={stickMove} onpointerup={stickUp} onpointercancel={stickUp} onlostpointercapture={stickUp} role="presentation" aria-label="Walk">
            <span class="knob" style:transform="translate({(stick?.x ?? 0) * 30}px, {(stick?.y ?? 0) * 30}px)"></span>
          </div>
          <span class="sp"></span>
        {/if}
        <button class="btn btn-primary outbtn" onclick={goOutside}><img src="{base}island/tile.webp" alt="" />Go outside</button>
        {#if touchy}<span class="sp"></span>{/if}
      </div>
    {:else if placing}
      {@const it = ITEM[placing.item]}
      <div class="placebar card">
        <img class="pth" src={thumbs[it.id] ?? `${base}island/tile.webp`} alt="" />
        <div class="pt"><b>{it.name}</b><small>{ghostOk ? (narrow ? 'Tap a spot or drag it' : 'Tap a spot or drag it to move it') : "It doesn't fit there"}</small></div>
        <button class="act" onclick={turn} title="Turn (R)"><Icon name="turnright" size={24} />Turn</button>
        <button class="btn btn-primary ok" disabled={!ghostOk} onclick={confirmPlace}>
          <Icon name="check" size={22} />{placing.uid ? 'Move here' : placingCost ? 'Buy' : 'Place'}
          {#if placingCost}<span class="cost"><img src="{base}game/icon-shell.webp" alt="" />{fmt(placingCost)}</span>{/if}
        </button>
        <button class="x" onclick={cancelPlace} aria-label="Cancel"><Icon name="close" size={22} /></button>
      </div>
    {:else if visiting}
      <div class="visitbar">
        <button class="btn btn-primary big heart" disabled={hearted} onclick={leave}><img src="{base}icons/heart.webp" alt="" />{hearted ? 'Heart left today' : `Leave ${owner?.name} a heart`}</button>
        <button class="btn" onclick={goHome}>Back to my island</button>
      </div>
    {:else}
      <div class="trayrow">
        {#if touchy && !trayOpen}
          <div class="stick" bind:this={stickEl} onpointerdown={stickDown} onpointermove={stickMove} onpointerup={stickUp} onpointercancel={stickUp} onlostpointercapture={stickUp} role="presentation" aria-label="Walk">
            <span class="knob" style:transform="translate({(stick?.x ?? 0) * 30}px, {(stick?.y ?? 0) * 30}px)"></span>
          </div>
        {/if}
        {#if trayOpen}
          <div class="tray card" class:blk={mode === 'blocks'}>
            <div class="tabs" role="tablist">
              <span class="seg">
                <button class:on={mode === 'things'} onclick={() => { mode = 'things'; sfx.click(); }}><img src="{base}island/tile.webp" alt="" />Things</button>
                <button class:on={mode === 'blocks'} onclick={() => { mode = 'blocks'; sfx.click(); hinted = true; }}><img src="{base}icons/blocks.webp" alt="" />Blocks</button>
              </span>
              <button class="toshop" onclick={toShop} title="Everything for the island, in the Shop"><img src="{base}game/icon-shell.webp" alt="" />Shop</button>
              {#if mode === 'things'}
                {#each KINDS as k (k.id)}<button role="tab" aria-selected={kind === k.id} class:on={kind === k.id} onclick={() => { kind = k.id; sfx.click(); }}>{k.name}</button>{/each}
                <button role="tab" aria-selected={kind === 'storage'} class:on={kind === 'storage'} onclick={() => { kind = 'storage'; sfx.click(); }}>Storage{#if stored.length}<em>{stored.reduce((t, s) => t + s.n, 0)}</em>{/if}</button>
              {:else}
                <span class="bhint">{tool === 'build' ? (touchy ? 'Tap the grass or a block to build on it' : 'Click the grass or a block to build on it · R turns it') : tool === 'paint' ? 'Tap a block to paint it' : tool === 'turn' ? 'Tap a block to turn it' : 'Tap a block to take it away'}</span>
                {#if !narrow}<span class="bcount2" class:full={nBlocks >= MAX_BLOCKS}><b>{nBlocks}</b> of {MAX_BLOCKS} blocks</span>{/if}
              {/if}
              {#if narrow}<button class="tclose" onclick={() => (trayOpen = false)} aria-label="Close the catalogue"><Icon name="down" size={20} /></button>{/if}
            </div>
            {#if mode === 'blocks'}
              <BlockTray {shape} {paint} mats={isl.mats} {thumbs} {narrow} onshape={setShape} onpaint={setPaint} onlocked={(pn) => { lockedPaint = pn; sfx.pop(); }} />
            {:else}
            <div class="cards">
              {#each shown as it (it.id)}
                {@const have = storedOf(isl, it.id)}
                {@const short = !have && shells < priceOf(it.id)}
                <button class="item" class:short class:dream={it.dream} onclick={() => pickItem(it.id)} title={it.blurb}>
                  <span class="pic">{#if thumbs[it.id]}<img src={thumbs[it.id]} alt="" />{:else}<i class="wait"></i>{/if}</span>
                  <span class="nm">{it.name}</span>
                  {#if have}<span class="price have">{have} in storage</span>
                  {:else}<span class="price"><img src="{base}game/icon-shell.webp" alt="" />{fmt(priceOf(it.id))}</span>{/if}
                  {#if it.habitat}<span class="hab" title="A Glimmer home"><img src="{base}game/icon-{it.habitat}.webp" alt="" /></span>{/if}
                </button>
              {:else}
                <p class="empty">{kind === 'storage' ? 'Nothing in storage. Things you put away (and visitors\' presents) wait here.' : ''}</p>
              {/each}
            </div>
            {/if}
          </div>
        {:else}
          <span class="sp"></span>
          <button class="btn build blocksbtn" onclick={() => { trayOpen = true; mode = 'blocks'; sfx.pop(); }}><img src="{base}icons/blocks.webp" alt="" />Blocks</button>
          <button class="btn btn-primary build" onclick={() => { trayOpen = true; mode = 'things'; sfx.pop(); }}><img src="{base}game/icon-shell.webp" alt="" />Build</button>
        {/if}
        {#if !narrow}<span class="pill shells big"><img src="{base}game/icon-shell.webp" alt="" /><b>{fmt(shells)}</b></span>{/if}
      </div>
    {/if}
  </footer>

  {#if card?.kind === 'visitor'}
    {@const v = card.v}
    {@const g = GLIMMER[v.id]}
    <div class="overlay" role="presentation" onclick={thanks}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="vcard card" role="dialog" aria-label="A visitor" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <img class="paint" src="{base}game/glimmers/{v.id}.webp" alt="" />
        <h2>{v.met ? `${g.name} came to visit!` : `${an(g.name)} ${g.name} is visiting!`}</h2>
        <p class="where">{whereToMeet(me, v.id)}</p>
        <div class="gift"><Icon name="gift" size={34} /><p>It brought you <b>{giftWords(v.gift, v.id)}</b>{v.gift.kind === 'deco' ? '. It goes in your storage.' : v.gift.kind === 'postcard' ? '. It goes with your postcards.' : '!'}</p></div>
        <button class="btn btn-primary" onclick={thanks}>{opened ? 'OK' : 'Thank you!'}</button>
      </div>
    </div>
  {/if}

  {#if moment}
    {@const d = SECRET[moment.id]}
    <div class="overlay" role="presentation" onclick={() => (moment = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="mcard card" role="dialog" aria-label="A secret" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <div class="mpic"><img src={thumbs[d.keepsake] ?? `${base}island/map.webp`} alt="" /></div>
        <small class="kick">You found a secret!</small>
        <h2>{d.name}</h2>
        <p class="mfound">{moment.id === 'note' ? 'A Glimmer left you a note!' : d.found}</p>
        {#if moment.extra}<p class="letter">{moment.extra}</p>{/if}
        {#if moment.gift}<p class="mfound">Today the well gave you {moment.gift}.</p>{/if}
        <div class="gift"><img src="{base}icons/gift.webp" alt="" /><p>The <b>{ITEM[d.keepsake]?.name}</b> is in your storage to put on your island, and there's a new sticker in your sticker book.</p></div>
        <p class="mcount"><img src="{base}island/map.webp" alt="" />{foundCount(isl)} of {SECRETS.length} island secrets found</p>
        <button class="btn btn-primary" onclick={() => (moment = null)}>Yay!</button>
      </div>
    </div>
  {/if}

  {#if roomNote}
    {@const rn = roomNote}
    <div class="overlay" role="presentation" onclick={() => (roomNote = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="mcard card notecard" role="dialog" aria-label="A note" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <div class="mpic">{#if rn.from}<img src={face(rn.from)} alt="" />{:else}<img src="{base}icons/mail.webp" alt="" />{/if}</div>
        <small class="kick">A note on the bed!</small>
        <h2>{rn.from ? `From ${GLIMMER[rn.from].name}` : 'Welcome home!'}</h2>
        <p class="letter">{rn.from ? rn.text : 'This is your cosy house. Come back any time!'}</p>
        <button class="btn btn-primary" onclick={() => (roomNote = null)}>Aww, thank you!</button>
      </div>
    </div>
  {/if}

  {#if lockedPaint !== null}
    {@const pd = PAINTS[lockedPaint]}
    <div class="overlay" role="presentation" onclick={() => (lockedPaint = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="lcard card" role="dialog" aria-label="{pd.name} blocks" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <img class="lpic" src={thumbs[`block:cube:${pd.id}`] ?? `${base}icons/blocks.webp`} alt="" />
        <h2>{pd.name} blocks</h2>
        <p>One of your island's secrets gives them to you: <b>{SECRET[pd.special!.secret as SecretId].name.toLowerCase()}</b>. Or get them now and build with them as much as you like.</p>
        <div class="row">
          <button class="btn btn-primary" disabled={shells < pd.special!.price} onclick={unlockPaint}><img class="sh" src="{base}game/icon-shell.webp" alt="" />Get them for {pd.special!.price}</button>
          <button class="btn" onclick={() => (lockedPaint = null)}>Not now</button>
        </div>
      </div>
    </div>
  {/if}

  {#if photo}
    <div class="photobar">
      {#if !shot}<p class="phint">{touchy ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll to zoom'}</p>{/if}
      <div class="prow">
        <button class="pdone" onclick={endPhoto}><Icon name="close" size={24} />Done</button>
        <button class="shutter" onclick={takePhoto} aria-label="Take a picture"><img src="{base}island/camera.webp" alt="" /></button>
        <span class="pdone ghost"></span>
      </div>
    </div>
    {#if shot}
      <div class="shotwrap"><div class="shotcard card">
        <img src={shot} alt="" />
        <p><b>Saved!</b> Your picture is on this computer, in Downloads.</p>
        <div class="row"><button class="btn" onclick={() => (shot = null)}>Take another</button><button class="btn btn-primary" onclick={endPhoto}>Done</button></div>
      </div></div>
    {/if}
  {/if}
  {#if flash}<div class="flash"></div>{/if}

  {#if sheet}
    <div class="overlay" role="presentation" onclick={() => (sheet = null)}>
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div class="sheet card" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <button class="x close" onclick={() => (sheet = null)} aria-label="Close"><Icon name="close" size={22} /></button>
        {#if sheet === 'glimmers'}
          <h2>Who lives on your island?</h2>
          <p class="muted">Up to {MAX_OUT} at a time: {out.length} now. They play by the home of their kind.</p>
          <div class="faces">
            {#each owned as id (id)}
              {@const on = out.includes(id)}
              <button class="gface" class:on onclick={() => toggleOut(id)} title={GLIMMER[id].name}>
                <img src={face(id, !!advView(me).glimmers[id]?.evolved)} alt="" /><span>{GLIMMER[id].name}</span>
                {#if heartsOf(isl, id)}<span class="fh">{#each Array(heartsOf(isl, id)) as _, i (i)}<img src="{base}icons/heart.webp" alt="" />{/each}</span>{/if}
                {#if on}<i><Icon name="check" size={18} /></i>{/if}
              </button>
            {:else}<p class="muted">Meet Glimmers in Adventure and they can live here.</p>{/each}
          </div>
        {:else if sheet === 'secrets'}
          <SecretsSheet {isl} {thumbs} />
        {:else if sheet === 'family'}
          <h2>Visit family</h2>
          <p class="muted">Look round their islands and leave a heart.</p>
          <div class="fam">
            {#each family as f (f.id)}
              <button class="frow" onclick={() => visit(f)}><Critter friend={f.buddy} size={52} round /><span><b>{f.name}'s island</b><small>{summary(f)}</small></span><Icon name="next" size={24} /></button>
            {/each}
          </div>
        {:else}
          <h2>Visitors: {visitorsSeen}</h2>
          <p class="muted">Each Glimmer brings a postcard the first time it visits. What you build decides who comes.</p>
          <div class="posts">
            {#each [...isl.postcards].reverse() as id (id)}
              <div class="post"><img src="{base}game/glimmers/{id}.webp" alt="" /><b>{GLIMMER[id]?.name}</b><small>{advView(me).glimmers[id] ? 'Met' : whereToMeet(me, id)}</small></div>
            {:else}<p class="muted">No visitors yet. Build a Glimmer home, a pond, flowers or a lantern, and someone will come.</p>{/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .isle { position: fixed; inset: 0; pointer-events: none; font-family: var(--font-body); }
  .isle > :global(*) { pointer-events: auto; }
  .view { position: absolute; inset: 0; touch-action: none; cursor: grab; }
  .view:active { cursor: grabbing; }

  .top { position: absolute; left: 0; right: 0; top: 0; z-index: 6; pointer-events: none; }
  .top > :global(*) { pointer-events: auto; }
  .sp { flex: 1; }
  .title { display: flex; align-items: center; gap: 10px; background: rgba(255, 255, 255, .94); border-radius: 999px; padding: 6px 22px 6px 6px; box-shadow: 0 0 0 3px rgba(255, 255, 255, .6), 0 10px 26px -12px rgba(80, 50, 30, .5); min-width: 0; }
  .title img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: none; }
  .title b { display: block; font: 600 30px/1.05 var(--font-ui); color: var(--ink); white-space: nowrap; }
  .title small { display: block; font: 700 13px var(--font-body); color: #8a6a3a; white-space: nowrap; }
  .pill { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .94); border: 0; border-radius: 999px; padding: 6px 18px 6px 6px; font: 600 20px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px rgba(255, 255, 255, .6), 0 10px 26px -12px rgba(80, 50, 30, .5); }
  button.pill { cursor: pointer; }
  .pill .vf { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; background: #eaf6ff; }
  .pill.shells img { width: 40px; height: 40px; object-fit: contain; }
  .pill.shells.big { padding: 8px 22px 8px 10px; font-size: 30px; align-self: flex-end; margin-bottom: 4px; }
  .pill.shells.big img { width: 52px; height: 52px; }
  .pill.shells.sm { padding: 3px 12px 3px 4px; font-size: 17px; }
  .pill.shells.sm img { width: 30px; height: 30px; }

  .side { position: absolute; left: 16px; top: 104px; display: flex; flex-direction: column; gap: 12px; pointer-events: none; }
  .side > * { pointer-events: auto; }
  .round { position: relative; width: 82px; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: rgba(255, 255, 255, .92); border-radius: 22px; padding: 6px 4px 7px; cursor: pointer; font: 600 14px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px rgba(255, 255, 255, .55), 0 8px 18px -10px rgba(80, 50, 30, .55); }
  .round img { width: 52px; height: 52px; object-fit: contain; border-radius: 50%; }
  .round em { position: absolute; top: 2px; right: 6px; font: 800 12px var(--font-body); color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 7px; font-style: normal; }
  .round:hover { transform: translateY(-2px); }

  /* the messages: one column at the top, each under the last (nothing covers anything) */
  .msgs { position: absolute; left: 50%; top: 92px; transform: translateX(-50%); z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 8px; width: max-content; max-width: min(620px, 92vw); pointer-events: none; }
  .msgs > :global(*) { pointer-events: auto; }
  .msgs .say, .msgs .hint { pointer-events: none; }
  .say { display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 22px; padding: 6px 18px 6px 6px; max-width: 100%; box-sizing: border-box; box-shadow: 0 0 0 3px #ffd36b, 0 12px 28px -12px rgba(60, 40, 20, .55); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); }
  .say p { margin: 0; font: 700 16px/1.3 var(--font-body); color: var(--ink); }
  .loadpill { position: absolute; left: 50%; top: 45%; transform: translateX(-50%); background: rgba(255, 255, 255, .92); padding: 10px 22px; border-radius: 999px; font: 600 18px var(--font-ui); color: var(--ink2); box-shadow: var(--shadow-sm); }
  .hint { margin: 0; font: 700 13px var(--font-body); color: #fff; background: rgba(70, 45, 20, .5); padding: 5px 14px; border-radius: 999px; white-space: nowrap; }
  .backview { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 16px 4px 4px; border-radius: 999px; background: #fff; font: 600 15px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px #ffd34d, 0 8px 20px -10px rgba(30, 20, 60, .6); white-space: nowrap; }
  .backview img { width: 34px; height: 34px; border-radius: 50%; }

  .hearts { display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 12px; max-width: 360px; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); box-shadow: 0 0 0 3px #ff9fc6, var(--shadow); }
  .hearts img { width: 44px; height: 44px; }
  .hearts p { margin: 0; font: 700 14px var(--font-body); color: var(--ink2); }
  .hearts b { display: block; font: 600 17px var(--font-ui); color: var(--ink); }

  .tag { position: absolute; transform: translate(-50%, -100%); pointer-events: none; font: 600 17px var(--font-ui); color: var(--ink); background: #fff; padding: 3px 12px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd34d, 0 8px 18px -8px rgba(30, 20, 60, .5); white-space: nowrap; display: flex; gap: 6px; align-items: baseline; }
  .tag small { font: 700 12px var(--font-body); color: var(--muted); }
  .vtag { position: absolute; transform: translate(-50%, -100%); display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 14px 4px 8px; border-radius: 999px; background: #fff; font: 600 16px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px #ff9fc6, 0 8px 18px -8px rgba(30, 20, 60, .5); white-space: nowrap; animation: bob 1.4s ease-in-out infinite; }
  @keyframes bob { 50% { margin-top: -6px; } }

  .selbar { position: absolute; transform: translate(-50%, calc(-100% - 10px)); padding: 8px 10px 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; box-shadow: 0 0 0 3px #ffd34d, var(--shadow); }
  .selbar b { font: 600 17px var(--font-ui); color: var(--ink); }
  .row { display: flex; gap: 6px; align-items: center; }
  .act { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: #f6f1e8; border-radius: 14px; padding: 6px 10px; cursor: pointer; font: 700 12px var(--font-body); color: var(--ink2); min-width: 62px; }
  .act:hover { background: #fff1cc; }
  .x { border: 0; background: #f2eef8; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; cursor: pointer; flex: none; }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 16px 14px; display: flex; justify-content: center; pointer-events: none; }
  .bottom > :global(*) { pointer-events: auto; }
  .trayrow { display: flex; align-items: flex-end; justify-content: center; gap: 14px; width: 100%; max-width: 1220px; pointer-events: none; }
  .trayrow > * { pointer-events: auto; }
  .tray { flex: 0 1 auto; min-width: 0; padding: 8px 10px 10px; border-radius: 26px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 4px rgba(255, 255, 255, .55), 0 18px 40px -18px rgba(80, 50, 30, .6); }
  .tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 0 2px 6px; align-items: center; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs button { flex: none; border: 0; background: transparent; border-radius: 999px; padding: 5px 12px; font: 600 15px var(--font-ui); color: var(--ink2); cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
  .tabs button.on { background: #fff1cc; color: #7a4a00; box-shadow: inset 0 0 0 2px #ffd36b; }
  .tabs em { font: 800 11px var(--font-body); font-style: normal; color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 6px; }
  .tabs .tclose { margin-left: auto; background: #f2eef8; padding: 4px; }
  /* the whole Island section in the Shop, one tap away */
  .tabs .toshop { background: #eafaf1; color: #1f7a4a; box-shadow: inset 0 0 0 2px #9fe3bd; margin-right: 4px; }
  .tabs .toshop img { width: 20px; height: 20px; object-fit: contain; }
  .cards { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 4px; scroll-snap-type: x proximity; }
  .item { position: relative; flex: none; width: 128px; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: #fff; border-radius: 20px; padding: 6px 6px 8px; cursor: pointer; box-shadow: inset 0 0 0 2px #efe7da, 0 4px 10px -6px rgba(80, 50, 30, .35); scroll-snap-align: start; transition: transform .15s; }
  .item:hover { transform: translateY(-3px); box-shadow: inset 0 0 0 2px #ffd36b, 0 8px 16px -8px rgba(80, 50, 30, .45); }
  .item .pic { width: 100%; height: 84px; display: grid; place-items: center; background: radial-gradient(ellipse at 50% 80%, #e9f6dc 0%, #f7fbef 55%, #fff 75%); border-radius: 14px; }
  .item .pic img { width: 92px; height: 92px; object-fit: contain; margin-top: -6px; }
  .item .wait { width: 34px; height: 34px; border-radius: 50%; background: #efe7da; animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: .4; } }
  .item .nm { font: 600 14px/1.1 var(--font-ui); color: var(--ink); text-align: center; min-height: 2.2em; display: flex; align-items: center; }
  .item .price { display: flex; align-items: center; gap: 4px; font: 600 17px var(--font-ui); color: #7a4a00; }
  .item .price img { width: 24px; height: 24px; }
  .item .price.have { font: 700 13px var(--font-body); color: #2e8a55; }
  .item.short { opacity: .62; }
  .item.dream { box-shadow: inset 0 0 0 2px #e3cdfa, 0 4px 10px -6px rgba(80, 50, 30, .35); }
  .item.dream .pic { background: radial-gradient(ellipse at 50% 80%, #efe2ff 0%, #f8f2ff 55%, #fff 75%); }
  .item .hab { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; }
  .item .hab img { width: 100%; height: 100%; object-fit: contain; }
  .empty { margin: 8px; font: 700 14px var(--font-body); color: var(--muted); }
  .build { display: flex; align-items: center; gap: 8px; font-size: 20px; padding: 10px 22px 10px 12px; }
  .build img { width: 34px; height: 34px; }

  .placebar { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 24px; box-shadow: 0 0 0 4px rgba(255, 255, 255, .55), 0 18px 40px -18px rgba(80, 50, 30, .6); max-width: 100%; }
  .pth { width: 60px; height: 60px; object-fit: contain; }
  .pt { min-width: 0; }
  .pt b { display: block; font: 600 19px var(--font-ui); color: var(--ink); }
  .pt small { font: 700 13px var(--font-body); color: var(--muted); white-space: nowrap; }
  .ok { display: flex; align-items: center; gap: 6px; font-size: 18px; }
  .ok .cost { display: flex; align-items: center; gap: 3px; background: rgba(255, 255, 255, .25); border-radius: 999px; padding: 1px 8px 1px 3px; }
  .ok .cost img { width: 24px; height: 24px; }
  .visitbar { display: flex; gap: 12px; align-items: center; }
  .heart { display: flex; align-items: center; gap: 10px; font-size: 21px; }
  .heart img { width: 36px; height: 36px; }

  .stick { width: 110px; height: 110px; border-radius: 50%; background: radial-gradient(circle, rgba(255, 255, 255, .55), rgba(255, 255, 255, .3)); box-shadow: 0 0 0 3px rgba(255, 255, 255, .85), 0 8px 20px -8px rgba(40, 20, 60, .5); display: grid; place-items: center; touch-action: none; }
  .knob { width: 48px; height: 48px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fff, #ffe7a1 60%, #ffc93d); box-shadow: 0 4px 10px rgba(80, 50, 0, .45); pointer-events: none; }

  .overlay { position: fixed; inset: 0; background: rgba(60, 40, 30, .35); display: grid; place-items: center; z-index: 40; padding: 16px; animation: fade-up .2s ease; }
  .vcard { box-sizing: border-box; width: min(420px, calc(100vw - 32px)); padding: 18px 20px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 0 0 4px #ffd36b, var(--shadow); animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); }
  .vcard .paint { width: 150px; height: 200px; object-fit: cover; margin-top: -80px; border-radius: 18px; border: 5px solid #fff; box-shadow: 0 0 0 3px #ffd36b, 0 14px 26px -12px rgba(60, 40, 20, .55); transform: rotate(-2deg); }
  .vcard h2 { margin: 0; font: 600 25px/1.15 var(--font-ui); color: var(--ink); }
  .vcard .where { margin: 0; font: 700 16px var(--font-body); color: #2459a8; background: #eaf3ff; border-radius: 14px; padding: 8px 12px; }
  .gift { display: flex; align-items: center; gap: 10px; text-align: left; background: #fff6df; border-radius: 14px; padding: 8px 12px; width: 100%; }
  .gift p { margin: 0; font: 700 15px var(--font-body); color: var(--ink2); }
  .sheet { box-sizing: border-box; position: relative; width: min(720px, calc(100vw - 32px)); max-height: 86vh; overflow: auto; padding: 18px 20px 22px; }
  .sheet h2 { margin: 0 0 4px; font: 600 26px var(--font-ui); color: var(--ink); }
  .sheet .close { position: absolute; right: 12px; top: 12px; }
  .muted { margin: 0 0 12px; color: var(--muted); font: 700 14px var(--font-body); }
  .faces { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
  .gface { position: relative; border: 0; background: #f7f3fb; border-radius: 18px; padding: 8px 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; font: 600 13px/1.1 var(--font-ui); color: var(--ink2); text-align: center; }
  .gface img { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; opacity: .55; filter: saturate(.6); }
  .gface.on { background: #e6f8ef; box-shadow: inset 0 0 0 3px #4fcf9f; color: var(--ink); }
  .gface.on img { opacity: 1; filter: none; }
  .gface i { position: absolute; top: 4px; right: 6px; }
  .fam { display: flex; flex-direction: column; gap: 8px; }
  .frow { display: flex; align-items: center; gap: 12px; border: 0; background: #f7f3fb; border-radius: 18px; padding: 8px 14px 8px 8px; cursor: pointer; text-align: left; }
  .frow span { flex: 1; }
  .frow b { display: block; font: 600 19px var(--font-ui); color: var(--ink); }
  .frow small { font: 700 13px var(--font-body); color: var(--muted); }
  .posts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .post { background: linear-gradient(180deg, #fffaf0, #fff); border-radius: 16px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; box-shadow: inset 0 0 0 2px #f1e4c8, 0 6px 14px -10px rgba(80, 50, 30, .5); transform: rotate(-1.2deg); }
  .post:nth-child(2n) { transform: rotate(1.4deg); }
  .post img { width: 110px; height: 110px; object-fit: contain; }
  .post b { font: 600 16px var(--font-ui); color: var(--ink); }
  .post small { font: 700 12px/1.25 var(--font-body); color: var(--muted); }

  /* blocks */
  .seg { display: flex; flex: none; background: #f3ede2; border-radius: 999px; padding: 3px; gap: 2px; margin-right: 6px; }
  .tabs .seg button { padding: 4px 12px 4px 5px; font: 600 15px var(--font-ui); }
  .tabs .seg button img { width: 26px; height: 26px; object-fit: contain; }
  .tabs .seg button.on { background: #fff; color: var(--ink); box-shadow: 0 2px 6px -2px rgba(80, 50, 30, .35), inset 0 0 0 2px #ffd36b; }
  .bhint { flex: none; font: 700 14px var(--font-body); color: var(--ink2); white-space: nowrap; padding: 0 6px; }
  .bcount2 { flex: none; margin-left: auto; font: 700 13px var(--font-body); color: var(--muted); white-space: nowrap; padding-right: 6px; }
  .bcount2 b { color: var(--ink); font-size: 15px; }
  .bcount2.full b { color: #d4473b; }
  .blocksbtn { display: flex; align-items: center; gap: 6px; background: #fff; }
  .tools { position: absolute; right: 16px; top: 104px; display: flex; flex-direction: column; gap: 8px; z-index: 3; }
  .tool { width: 78px; display: flex; flex-direction: column; align-items: center; gap: 1px; border: 0; background: rgba(255, 255, 255, .94); border-radius: 18px; padding: 5px 4px 6px; cursor: pointer; font: 600 13px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px rgba(255, 255, 255, .55), 0 8px 18px -10px rgba(80, 50, 30, .55); }
  .tool img { width: 40px; height: 40px; object-fit: contain; }
  .tool img.flip { transform: scaleX(-1); }
  .tool.on { background: #fff3cf; box-shadow: 0 0 0 3px #ffb733, 0 8px 18px -10px rgba(200, 120, 0, .6); }
  .tool:disabled { opacity: .45; cursor: default; }
  .bcount { align-self: center; font: 800 12px var(--font-body); color: #fff; background: rgba(70, 45, 20, .55); border-radius: 999px; padding: 2px 8px; }
  .vtag.wish { box-shadow: 0 0 0 3px #ffd34d, 0 8px 18px -8px rgba(30, 20, 60, .5); }
  .digbtn { position: absolute; left: 50%; bottom: 210px; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 6px 22px 6px 8px; border-radius: 999px; background: linear-gradient(180deg, #ffe58a, #ffc93d); font: 600 22px var(--font-ui); color: #5a3a00; box-shadow: 0 0 0 4px #fff, 0 12px 24px -10px rgba(120, 70, 0, .6); animation: bob 1.1s ease-in-out infinite; z-index: 4; }
  .digbtn img { width: 52px; height: 52px; }
  /* a Glimmer you tapped */
  .gcard.below { transform: translate(-50%, 70px); }
  .gcard { position: absolute; transform: translate(-50%, calc(-100% - 14px)); width: 300px; box-sizing: border-box; padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 6px; box-shadow: 0 0 0 3px #ff9fc6, var(--shadow); z-index: 6; }
  .gt { display: flex; align-items: center; gap: 8px; }
  .gt img { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: #f3ecfb; }
  .gt span { flex: 1; min-width: 0; }
  .gt b { display: block; font: 600 17px/1.1 var(--font-ui); color: var(--ink); }
  .gt small { font: 700 12px var(--font-body); color: var(--muted); }
  .gt .x { width: 30px; height: 30px; }
  .gt .h5 { flex: none; } .gt .h5 img { width: 17px; height: 17px; border-radius: 0; background: none; }
  .h5 { display: flex; gap: 2px; justify-content: center; }
  .h5 img { width: 20px; height: 20px; }
  /* talking: what the Glimmer says, in a bubble, and what to do */
  .gcard .line { position: relative; margin: 2px 0 0; padding: 8px 12px; border-radius: 16px; background: #f4ecff; font: 700 17px/1.3 var(--font-body); color: var(--ink); text-align: center; animation: pop-in .25s cubic-bezier(.3, .8, .4, 1.4); }
  .gcard .line.happy { background: #ffe9f2; }
  .gcard .about { margin: 0; font: 600 13px/1.3 var(--font-body); color: var(--muted); text-align: center; }
  .replies { display: flex; gap: 6px; }
  .rep { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; cursor: pointer; padding: 6px 4px; border-radius: 14px; background: #fff4d6; box-shadow: inset 0 0 0 2px #ffd36b; font: 600 15px var(--font-ui); color: var(--ink); position: relative; white-space: nowrap; }
  .rep:hover { background: #ffecb3; }
  .rep img { width: 34px; height: 34px; object-fit: contain; }
  .rep em { position: absolute; top: 2px; right: 6px; font: 800 11px var(--font-body); font-style: normal; color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 6px; }
  .treatlink { align-self: center; display: inline-flex; align-items: center; gap: 4px; border: 0; background: none; cursor: pointer; font: 700 13px var(--font-body); color: #7a4a00; text-decoration: underline; }
  .treatlink img { width: 22px; height: 22px; }
  /* what's close to do, over the buddy's head */
  .acthint { position: absolute; transform: translate(-50%, -100%); pointer-events: none; z-index: 4; display: flex; align-items: center; gap: 6px; padding: 3px 12px 3px 4px; border-radius: 999px; background: rgba(255, 255, 255, .95); font: 600 16px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px #9fe3bd, 0 8px 18px -8px rgba(30, 20, 60, .5); white-space: nowrap; animation: pop-in .2s ease-out; }
  .acthint kbd { font: 800 13px var(--font-body); color: #1f7a4a; background: #eafaf1; border-radius: 8px; padding: 2px 7px; box-shadow: inset 0 -2px 0 #9fe3bd; }
  /* a touch screen: jump, and the thing to do */
  .moves { position: absolute; right: 16px; display: flex; align-items: flex-end; gap: 10px; z-index: 4; }
  .jumpbtn { width: 78px; height: 78px; border-radius: 50%; border: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; background: radial-gradient(circle at 40% 35%, #fff, #eafaf1); color: #1f7a4a; font: 600 14px var(--font-ui); box-shadow: 0 0 0 4px rgba(255, 255, 255, .7), 0 0 0 7px #9fe3bd, 0 10px 22px -10px rgba(30, 20, 60, .6); touch-action: manipulation; user-select: none; }
  .jumpbtn:active { transform: scale(.94); }
  .actbtn { height: 58px; padding: 0 22px; border-radius: 999px; border: 0; cursor: pointer; background: #fff; color: var(--ink); font: 600 19px var(--font-ui); box-shadow: 0 0 0 4px #ffd36b, 0 10px 22px -10px rgba(30, 20, 60, .6); white-space: nowrap; animation: pop-in .2s ease-out; touch-action: manipulation; }
  /* in a house: the way out, and nothing to build */
  .inside .side, .inside .tools, .inside .digbtn, .inside .vtag { display: none !important; }
  .outbtn { display: flex; align-items: center; gap: 8px; font-size: 20px; padding: 10px 22px 10px 10px; }
  .outbtn img { width: 40px; height: 40px; border-radius: 50%; }
  .notecard .mpic img { border-radius: 50%; }
  .h5 img.off { filter: grayscale(1) opacity(.3); }
  .wl { margin: 0; text-align: center; font: 700 14px var(--font-body); color: #7a3dc0; background: #f4ecff; border-radius: 12px; padding: 4px 8px; }
  .gcard .row { justify-content: center; }
  .gcard .act { flex: 1; flex-direction: row; justify-content: center; gap: 4px; font: 600 15px var(--font-ui); color: var(--ink); padding: 4px 8px; white-space: nowrap; }
  .gcard .buyt { font-size: 13px; padding: 4px 6px; }
  .gcard .buyt img:first-child { width: 30px; height: 30px; }
  .gcard .act img { width: 36px; height: 36px; }
  .gcard .act em { font: 800 12px var(--font-body); font-style: normal; color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 7px; }
  .gcard .buyt span { display: flex; align-items: center; gap: 1px; font: 700 13px var(--font-body); color: #7a4a00; }
  .gcard .buyt span img { width: 20px; height: 20px; }
  .fh { display: flex; gap: 1px; }
  .fh img { width: 14px; height: 14px; }
  /* a secret found */
  .mcard { box-sizing: border-box; width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto; padding: 12px 20px 18px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 0 0 4px #ffd36b, var(--shadow); animation: pop-in .4s cubic-bezier(.3, .8, .4, 1.4); }
  .mpic { flex: none; width: 140px; height: 140px; margin-top: 6px; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle, #fffbe8 0 45%, #ffe7a1 70%, #ffd36b 100%); box-shadow: 0 0 0 6px #fff, 0 0 40px 10px rgba(255, 211, 107, .7); animation: glowy 1.6s ease-in-out infinite; }
  .mpic img { width: 118px; height: 118px; object-fit: contain; }
  @keyframes glowy { 50% { box-shadow: 0 0 0 6px #fff, 0 0 60px 18px rgba(255, 211, 107, .85); } }
  .kick { font: 800 13px var(--font-body); letter-spacing: .06em; text-transform: uppercase; color: #c07a00; }
  .mcard h2 { margin: 0; font: 600 27px/1.1 var(--font-ui); color: var(--ink); }
  .mfound { margin: 0; font: 700 16px/1.35 var(--font-body); color: var(--ink2); }
  .letter { margin: 0; font: italic 600 16px/1.45 var(--font-body); color: #4a3218; background: repeating-linear-gradient(180deg, #fffdf4 0 26px, #efe4c8 26px 27px); border-radius: 10px; padding: 10px 14px; box-shadow: inset 0 0 0 2px #efe4c8; transform: rotate(-.8deg); text-align: left; }
  .mcount { display: flex; align-items: center; gap: 6px; margin: 0; font: 700 14px var(--font-body); color: var(--muted); }
  .mcount img { width: 28px; height: 28px; }
  .lcard { box-sizing: border-box; width: min(400px, calc(100vw - 32px)); padding: 18px 20px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; box-shadow: 0 0 0 4px #e3cdfa, var(--shadow); }
  .lpic { width: 110px; height: 110px; object-fit: contain; }
  .lcard h2 { margin: 0; font: 600 25px var(--font-ui); color: var(--ink); }
  .lcard p { margin: 0; font: 700 15px/1.35 var(--font-body); color: var(--ink2); }
  .lcard .row { gap: 10px; margin-top: 4px; }
  .lcard .btn { display: flex; align-items: center; gap: 6px; }
  .lcard .sh { width: 26px; height: 26px; }
  /* photo */
  .isle.photo > :global(*:not(.view):not(.photobar):not(.shotwrap):not(.flash)) { display: none !important; }
  .photobar { position: absolute; left: 0; right: 0; bottom: 18px; display: flex; flex-direction: column; align-items: center; gap: 10px; pointer-events: none; }
  .photobar > * { pointer-events: auto; }
  .phint { margin: 0; font: 700 14px var(--font-body); color: #fff; background: rgba(70, 45, 20, .5); padding: 5px 14px; border-radius: 999px; }
  .prow { display: flex; align-items: center; gap: 22px; }
  .pdone { width: 110px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; cursor: pointer; padding: 10px 14px; border-radius: 999px; background: rgba(255, 255, 255, .94); font: 600 17px var(--font-ui); color: var(--ink); box-shadow: 0 8px 18px -10px rgba(40, 20, 60, .6); }
  .pdone.ghost { visibility: hidden; }
  .shutter { width: 92px; height: 92px; border-radius: 50%; border: 0; cursor: pointer; display: grid; place-items: center; background: radial-gradient(circle at 40% 35%, #fff, #f1f1f1 60%, #d9d9d9); box-shadow: 0 0 0 6px rgba(255, 255, 255, .7), 0 0 0 10px rgba(255, 211, 107, .9), 0 14px 30px -10px rgba(40, 20, 60, .6); }
  .shutter img { width: 62px; height: 62px; }
  .shutter:active { transform: scale(.94); }
  .shotwrap { position: absolute; inset: 0 0 120px; display: grid; place-items: center; pointer-events: none; padding: 16px; }
  .shotcard { pointer-events: auto; box-sizing: border-box; width: min(520px, calc(100vw - 32px)); padding: 12px 12px 14px; display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; box-shadow: 0 0 0 4px #ffd36b, var(--shadow); animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); }
  .shotcard img { max-width: 100%; max-height: 52vh; object-fit: contain; border-radius: 10px; transform: rotate(-1deg); box-shadow: 0 10px 22px -12px rgba(40, 20, 60, .6); }
  .shotcard p { margin: 0; font: 700 15px var(--font-body); color: var(--ink2); }
  .shotcard .row { gap: 10px; }
  .flash { position: fixed; inset: 0; background: #fff; pointer-events: none; animation: flash .32s ease-out forwards; z-index: 60; }
  @keyframes flash { from { opacity: .95; } to { opacity: 0; } }

  /* short screens: a smaller catalogue, so the island keeps its room */
  @media (max-height: 800px) {
    .item { width: 112px; padding: 4px 4px 6px; border-radius: 16px; }
    .item .pic { height: 62px; }
    .item .pic img { width: 70px; height: 70px; }
    .item .nm { font-size: 13px; min-height: 2em; }
    .item .price { font-size: 15px; }
    .tabs button { font-size: 14px; padding: 4px 10px; }
    .pill.shells.big { font-size: 24px; padding: 6px 18px 6px 8px; }
    .pill.shells.big img { width: 40px; height: 40px; }
  }
  /* phones */

  .narrow .title { padding: 7px 12px; gap: 6px; }
  .narrow .title img { display: none; }
  .narrow .title b { font-size: 18px; white-space: nowrap; }
  .narrow .title { flex: 1; }
  .narrow .title small { display: none; }
  .narrow .pill.visitors { padding: 3px 10px 3px 3px; font-size: 15px; }
  .narrow .pill .vf { width: 30px; height: 30px; }
  .narrow .pill.visitors span { white-space: nowrap; }
  .narrow .side { left: 10px; top: 70px; flex-direction: row; gap: 8px; }
  .narrow .round { width: 64px; font-size: 12px; border-radius: 18px; }
  .narrow .round img { width: 38px; height: 38px; }
  .narrow .msgs { top: 150px; }
  .narrow .msgs.low { top: auto; bottom: 120px; }
  .narrow.blocking .msgs { max-width: calc(100vw - 150px); }
  .narrow .hint { white-space: normal; text-align: center; }
  .narrow .bottom { padding: 0 8px 8px; }
  .narrow .tray { flex: 1; border-radius: 22px; padding: 6px 6px 8px; }
  .narrow .tabs button { font-size: 14px; padding: 4px 10px; }
  .narrow .item { width: 104px; border-radius: 16px; }
  .narrow .item .pic { height: 66px; }
  .narrow .item .pic img { width: 74px; height: 74px; }
  .narrow .item .nm { font-size: 13px; }
  .narrow .item .price { font-size: 15px; }
  .narrow .placebar { gap: 6px; padding: 6px; flex-wrap: wrap; justify-content: center; }
  .narrow .pth { width: 44px; height: 44px; }
  .narrow .pt b { font-size: 16px; }
  .narrow .visitbar { flex-direction: column; width: 100%; }
  .narrow .visitbar .btn { width: 100%; justify-content: center; }
  .narrow .vcard .paint { width: 150px; height: 150px; margin-top: -50px; }
  .narrow .vcard h2 { font-size: 21px; }
  .narrow .tools { right: 8px; top: 146px; gap: 6px; }
  .narrow .tool { width: 60px; font-size: 11px; border-radius: 15px; padding: 3px 2px 4px; }
  .narrow .tool img { width: 32px; height: 32px; }
  .narrow .bhint { display: none; }
  .narrow .digbtn { bottom: 150px; font-size: 19px; }
  .narrow .digbtn img { width: 42px; height: 42px; }
  .narrow .gcard { width: 260px; }
  .narrow .gcard .line { font-size: 15px; }
  .narrow .rep { font-size: 13px; } .narrow .rep img { width: 28px; height: 28px; }
  .narrow .blocksbtn, .narrow .build { font-size: 17px; padding: 8px 14px 8px 8px; }
  .narrow .shutter { width: 80px; height: 80px; }
</style>
