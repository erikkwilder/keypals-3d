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
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { IslandScene, type Out } from '../three/islandScene';
  import { sfx } from '../audio/sound';
  import { advView } from '../adventure/state';
  import { GLIMMER, type GlimmerId } from '../adventure/glimmers';
  import { dressOf } from '../adventure/wardrobe';
  import { ITEM, ITEMS, KINDS, type ItemKind } from '../island/catalog';
  import {
    GROWTH, MAX_OUT, buyAndPlace, checkVisitor, familyOf, fits, footprint, freeSpot, giftWords, growthOf, heartNews, heartedToday, invitesOf, islandOf,
    islandView, leaveHeart, move, outOf, putAway, seeHearts, setOut, storage, storedOf, visitDue, visitorNow, whereToMeet, type Result, type Rot, type Visit,
  } from '../island/save';
  import { isClassLogin } from '../state/classHere';
  import type { Profile } from '../engine/profile';
  import Critter from '../ui/Critter.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import MenuButton from '../ui/MenuButton.svelte';
  import Icon from '../ui/Icon.svelte';

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
  let bottomEl: HTMLElement | undefined = $state();
  let narrow = $state(innerWidth < 760 || innerHeight < 520);
  let trayOpen = $state(!(innerWidth < 760 || innerHeight < 520));
  let thumbs = $state<Record<string, string>>({});
  function viewOf() {
    const t = topEl?.getBoundingClientRect(), b = bottomEl?.getBoundingClientRect();
    const top = (t ? t.bottom + 4 : 70) / innerHeight, bottom = (b ? b.top - 4 : innerHeight - 140) / innerHeight;
    return { top, bottom: Math.max(top + 0.25, bottom), left: 0, right: 1 };
  }
  function onResize() { narrow = innerWidth < 760 || innerHeight < 520; if (scene) scene.view = viewOf(); }
  $effect(() => { void trayOpen; void placing; void selected; void visiting; requestAnimationFrame(onResize); });

  const outsOf = (p: Profile): Out[] => { const a = advView(p); return outOf(p).map(id => ({ id, level: a.glimmers[id]?.level ?? 1, evolved: !!a.glimmers[id]?.evolved })); };

  async function build(o: Profile | null) {
    loading = true;
    const p = o ?? game.profile!;
    if (!o) game.update(pp => { islandOf(pp); });
    const s = islandView(p), g = growthOf(p);
    const grewFrom = !o && s.grown < g.stage ? GROWTH[s.grown].r : undefined;
    try {
      const sc = await IslandScene.create({ save: s, r: g.r, buddy: me.buddy, dress: dressOf(me), view: viewOf(), grewFrom });
      if (disposed || (o?.id ?? null) !== (owner?.id ?? null)) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      sc.onLanded = () => { const v = visitorNow(islandView(me)); if (v && !owner) { card = { kind: 'visitor', v }; } };
      await sc.setOut(outsOf(p));
      if (!o) {
        if (grewFrom) { say(`Your island grew! ${g.met} Glimmers met.`, 5000); sfx.levelUp(2); }
        if (s.grown !== g.stage) game.update(pp => { islandOf(pp).grown = g.stage; });
        const news = heartNews(s);
        if (news) { hearts = news; setTimeout(() => sc.hearts(), 900); }
        lookForVisitor(true);
      } else say(`${o.name}'s island. Have a look round, and leave a heart!`, 5000);
      void sc.thumbs(ITEMS.map(i => i.id), (id, url) => { thumbs[id] = url; });
    } catch (e) { console.error(e); }
    loading = false;
  }
  onMount(() => {
    addEventListener('resize', onResize);
    viewEl?.addEventListener('wheel', onWheel, { passive: false });
    void build(null);
    raf = requestAnimationFrame(follow);
    visitTimer = setInterval(() => lookForVisitor(true), 30000);
  });
  onDestroy(() => {
    disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(driveRaf); clearInterval(visitTimer); clearTimeout(sayTimer);
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
  const shown = $derived(kind === 'storage' ? stored.map(s => s.item) : ITEMS.filter(i => i.kind === kind && !i.gift));
  const ghostOk = $derived(placing ? fits(isl, grow.r, ITEM[placing.item], placing.x, placing.z, placing.rot, placing.uid ?? undefined) : false);
  const placingCost = $derived(placing && !placing.uid && storedOf(isl, placing.item) < 1 ? ITEM[placing.item].price : 0);
  function ghost() { if (scene && placing) scene.setGhost({ item: placing.item, x: placing.x, z: placing.z, rot: placing.rot, ok: ghostOk, hide: placing.uid }); }
  $effect(() => { void ghostOk; ghost(); });
  function pickItem(id: string) {
    if (visiting) return;
    const it = ITEM[id];
    const have = storedOf(isl, id) > 0;
    if (!have && shells < it.price) { sfx.nope(); say(`You need ${fmt(it.price - shells)} more shells for the ${it.name}. Practice and battles earn shells!`); return; }
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
    game.update(pp => { r = pl.uid ? move(pp, pl.uid, pl.x, pl.z, pl.rot) : buyAndPlace(pp, pl.item, pl.x, pl.z, pl.rot); });
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
  let sheet = $state<null | 'glimmers' | 'family' | 'postcards'>(null);
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
    const h = scene.pick(x, y);
    if (h?.kind === 'glimmer') { scene.poke(h.id); sfx.pop(); tag = { id: h.id, until: performance.now() + 2800, x: 0, y: 0 }; return; }
    if (h?.kind === 'visitor' && shownVisit) { card = { kind: 'visitor', v: shownVisit }; sfx.pop(); return; }
    if (h?.kind === 'buddy') { scene.cheer(); sfx.pop(); say(['Hi!', 'I love it here!', 'What shall we build?', 'Wheee!'][Math.floor(Math.random() * 4)], 2000); return; }
    if (h?.kind === 'item' && !visiting) { choose(selected === h.uid ? null : h.uid); sfx.click(); return; }
    if (selected) { choose(null); return; }
    if (scene.walkTo(x, y)) { hinted = true; sfx.click(); }
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
    if (placing && (e.key === 'r' || e.key === 'R')) { turn(); return; }
    if (placing && e.key === 'Enter') { confirmPlace(); return; }
    if (e.key !== 'Escape') return;
    if (card) thanks(); else if (sheet) sheet = null; else if (placing) cancelPlace(); else if (selected) choose(null); else if (owner) void goHome(); else game.go(game.home);
  }
  function keyUp(e: KeyboardEvent) { const d = KEYDIR[e.code]; if (d) held.delete(d); }

  const visitorsSeen = $derived(isl.postcards.length);
  const lastVisitor = $derived(isl.visits.length ? isl.visits[isl.visits.length - 1].id : null);
</script>

<svelte:window onkeydown={onKey} onkeyup={keyUp} onblur={() => { held.clear(); stick = null; }} />

<div class="isle" class:narrow class:visiting>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="view" bind:this={viewEl} onpointerdown={pdown} onpointermove={pmove} onpointerup={pup} onpointercancel={(e) => ptrs.delete(e.pointerId)} oncontextmenu={(e) => e.preventDefault()}></div>

  <header class="top" bind:this={topEl}>
    <NavTile size={narrow ? 'bar' : 'sm'} tone="sky" kind="home" label="Home" onclick={() => game.go('hub')} />
    <div class="title">
      <img src="{base}island/tile.webp" alt="" />
      <div><b>{visiting ? `${owner?.name}'s ${narrow ? 'island' : 'Sky Island'}` : 'My Sky Island'}</b>
        <small>{grow.next ? `Size ${grow.stage + 1} · meet ${grow.next.met} Glimmers to grow it (${grow.met} so far)` : `Size ${grow.stage + 1} · as big as it gets!`}</small></div>
    </div>
    <span class="sp"></span>
    {#if !visiting && !narrow}
      <button class="pill visitors" onclick={() => { sheet = 'postcards'; sfx.pop(); }} title="Visitors and their postcards">
        {#if lastVisitor}<img class="vf" src={face(lastVisitor)} alt="" />{:else}<img class="vf" src="{base}icons/mail.webp" alt="" />{/if}
        <span>Visitors: <b>{visitorsSeen}</b></span>
      </button>
    {/if}
    {#if narrow && !visiting}<span class="pill shells sm"><img src="{base}game/icon-shell.webp" alt="" /><b>{fmt(shells)}</b></span>{/if}
    <MenuButton size={narrow ? 34 : 40} />
  </header>

  <!-- the round buttons on the left: your Glimmers, family, postcards -->
  <nav class="side" aria-label="Island">
    {#if !visiting}
      <button class="round" onclick={() => { sheet = 'glimmers'; sfx.pop(); }} title="Your Glimmers on the island">
        {#if out[0]}<img src={face(out[0], !!advView(me).glimmers[out[0]]?.evolved)} alt="" />{:else}<img src="{base}game/icon-grump.webp" alt="" />{/if}
        <span>Glimmers</span><em>{out.length}</em>
      </button>
      {#if family.length}
        <button class="round" onclick={() => { sheet = 'family'; sfx.pop(); }} title="Visit family's islands"><img src="{base}icons/players.webp" alt="" /><span>Family</span></button>
      {/if}
      {#if narrow}
        <button class="round" onclick={() => { sheet = 'postcards'; sfx.pop(); }} title="Visitors and their postcards">
          <img src={lastVisitor ? face(lastVisitor) : `${base}icons/mail.webp`} alt="" /><span>Visitors</span><em>{visitorsSeen}</em>
        </button>
      {/if}
    {:else}
      <button class="round home" onclick={goHome} title="Back to my island"><img src="{base}island/tile.webp" alt="" /><span>My island</span></button>
    {/if}
  </nav>

  {#if said}<div class="say" class:low={!!placing}><Critter friend={me.buddy} look={me.settings.look} size={narrow ? 38 : 48} round /><p>{said}</p></div>{/if}
  {#if loading}<div class="loadpill">Floating up to the island…</div>{/if}
  {#if hearts && !visiting}
    <div class="hearts card">
      <img src="{base}icons/heart.webp" alt="" />
      <p><b>{hearts.text}</b><span>Family can visit your island from theirs.</span></p>
      <button class="btn small" onclick={closeHearts}>Yay!</button>
    </div>
  {/if}

  {#if tag}<div class="tag" style:left="{tag.x}px" style:top="{tag.y}px">{GLIMMER[tag.id].name}<small>Level {advView(who).glimmers[tag.id]?.level ?? 1}</small></div>{/if}
  {#if visitorAt && !card}<button class="vtag" style:left="{visitorAt.x}px" style:top="{visitorAt.y}px" onclick={() => { if (shownVisit) card = { kind: 'visitor', v: shownVisit }; sfx.pop(); }}><Icon name="gift" size={22} />A visitor!</button>{/if}

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

  {#if !hinted && !loading && !placing && !selected}
    <p class="hint">{touchy ? 'Drag to look round · pinch to zoom · tap the grass to walk' : 'Drag to look round · scroll to zoom · walk with the arrow keys'}</p>
  {/if}
  {#if looking && !placing}<button class="backview" onclick={backToIsland}><img src="{base}island/tile.webp" alt="" />See the whole island</button>{/if}

  <footer class="bottom" bind:this={bottomEl}>
    {#if placing}
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
          <div class="tray card">
            <div class="tabs" role="tablist">
              {#each KINDS as k (k.id)}<button role="tab" aria-selected={kind === k.id} class:on={kind === k.id} onclick={() => { kind = k.id; sfx.click(); }}>{k.name}</button>{/each}
              <button role="tab" aria-selected={kind === 'storage'} class:on={kind === 'storage'} onclick={() => { kind = 'storage'; sfx.click(); }}>Storage{#if stored.length}<em>{stored.reduce((t, s) => t + s.n, 0)}</em>{/if}</button>
              {#if narrow}<button class="tclose" onclick={() => (trayOpen = false)} aria-label="Close the catalogue"><Icon name="down" size={20} /></button>{/if}
            </div>
            <div class="cards">
              {#each shown as it (it.id)}
                {@const have = storedOf(isl, it.id)}
                {@const short = !have && shells < it.price}
                <button class="item" class:short class:dream={it.dream} onclick={() => pickItem(it.id)} title={it.blurb}>
                  <span class="pic">{#if thumbs[it.id]}<img src={thumbs[it.id]} alt="" />{:else}<i class="wait"></i>{/if}</span>
                  <span class="nm">{it.name}</span>
                  {#if have}<span class="price have">{have} in storage</span>
                  {:else}<span class="price"><img src="{base}game/icon-shell.webp" alt="" />{fmt(it.price)}</span>{/if}
                  {#if it.habitat}<span class="hab" title="A Glimmer home"><img src="{base}game/icon-{it.habitat}.webp" alt="" /></span>{/if}
                </button>
              {:else}
                <p class="empty">{kind === 'storage' ? 'Nothing in storage. Things you put away (and visitors\' presents) wait here.' : ''}</p>
              {/each}
            </div>
          </div>
        {:else}
          <span class="sp"></span>
          <button class="btn btn-primary build" onclick={() => { trayOpen = true; sfx.pop(); }}><img src="{base}game/icon-shell.webp" alt="" />Build</button>
        {/if}
        {#if !narrow}<span class="pill shells big"><img src="{base}game/icon-shell.webp" alt="" /><b>{fmt(shells)}</b></span>{/if}
      </div>
    {/if}
  </footer>

  {#if card?.kind === 'visitor'}
    {@const v = card.v}
    {@const g = GLIMMER[v.id]}
    <div class="overlay" role="presentation" onclick={thanks}>
      <div class="vcard card" role="dialog" aria-label="A visitor" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <img class="paint" src="{base}game/glimmers/{v.id}.webp" alt="" />
        <h2>{v.met ? `${g.name} came to visit!` : `${an(g.name)} ${g.name} is visiting!`}</h2>
        <p class="where">{whereToMeet(me, v.id)}</p>
        <div class="gift"><Icon name="gift" size={34} /><p>It brought you <b>{giftWords(v.gift, v.id)}</b>{v.gift.kind === 'deco' ? '. It goes in your storage.' : v.gift.kind === 'postcard' ? '. It goes with your postcards.' : '!'}</p></div>
        <button class="btn btn-primary" onclick={thanks}>{opened ? 'OK' : 'Thank you!'}</button>
      </div>
    </div>
  {/if}

  {#if sheet}
    <div class="overlay" role="presentation" onclick={() => (sheet = null)}>
      <div class="sheet card" role="dialog" tabindex="-1" onclick={(e) => e.stopPropagation()}>
        <button class="x close" onclick={() => (sheet = null)} aria-label="Close"><Icon name="close" size={22} /></button>
        {#if sheet === 'glimmers'}
          <h2>Who lives on your island?</h2>
          <p class="muted">Up to {MAX_OUT} at a time: {out.length} now. They play by the home of their kind.</p>
          <div class="faces">
            {#each owned as id (id)}
              {@const on = out.includes(id)}
              <button class="gface" class:on onclick={() => toggleOut(id)} title={GLIMMER[id].name}>
                <img src={face(id, !!advView(me).glimmers[id]?.evolved)} alt="" /><span>{GLIMMER[id].name}</span>{#if on}<i><Icon name="check" size={18} /></i>{/if}
              </button>
            {:else}<p class="muted">Meet Glimmers in Adventure and they can live here.</p>{/each}
          </div>
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

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 12px 16px; pointer-events: none; }
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

  .say { position: absolute; left: 50%; top: 92px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; background: #fff; border-radius: 22px; padding: 6px 18px 6px 6px; max-width: min(620px, 86vw); box-shadow: 0 0 0 3px #ffd36b, 0 12px 28px -12px rgba(60, 40, 20, .55); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); pointer-events: none; z-index: 5; }
  .say p { margin: 0; font: 700 16px/1.3 var(--font-body); color: var(--ink); }
  .loadpill { position: absolute; left: 50%; top: 45%; transform: translateX(-50%); background: rgba(255, 255, 255, .92); padding: 10px 22px; border-radius: 999px; font: 600 18px var(--font-ui); color: var(--ink2); box-shadow: var(--shadow-sm); }
  .hint { position: absolute; left: 50%; top: 92px; transform: translateX(-50%); margin: 0; pointer-events: none; font: 700 13px var(--font-body); color: #fff; background: rgba(70, 45, 20, .5); padding: 5px 14px; border-radius: 999px; white-space: nowrap; }
  .say ~ .hint { display: none; }
  .backview { position: absolute; left: 50%; top: 140px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 16px 4px 4px; border-radius: 999px; background: #fff; font: 600 15px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px #ffd34d, 0 8px 20px -10px rgba(30, 20, 60, .6); white-space: nowrap; }
  .backview img { width: 34px; height: 34px; border-radius: 50%; }

  .hearts { position: absolute; right: 16px; top: 96px; display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 12px; max-width: 360px; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.4); box-shadow: 0 0 0 3px #ff9fc6, var(--shadow); }
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
  .trayrow { display: flex; align-items: flex-end; gap: 14px; width: 100%; max-width: 1220px; pointer-events: none; }
  .trayrow > * { pointer-events: auto; }
  .tray { flex: 1; min-width: 0; padding: 8px 10px 10px; border-radius: 26px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 4px rgba(255, 255, 255, .55), 0 18px 40px -18px rgba(80, 50, 30, .6); }
  .tabs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 0 2px 6px; align-items: center; }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs button { flex: none; border: 0; background: transparent; border-radius: 999px; padding: 5px 12px; font: 600 15px var(--font-ui); color: var(--ink2); cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
  .tabs button.on { background: #fff1cc; color: #7a4a00; box-shadow: inset 0 0 0 2px #ffd36b; }
  .tabs em { font: 800 11px var(--font-body); font-style: normal; color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 6px; }
  .tabs .tclose { margin-left: auto; background: #f2eef8; padding: 4px; }
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
  .narrow .top { padding: 8px 10px; gap: 8px; }
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
  .narrow .say { top: 150px; max-width: 92vw; }
  .narrow .say.low { top: auto; bottom: 120px; }
  .narrow .hint { top: auto; bottom: 140px; white-space: normal; text-align: center; max-width: 86vw; }
  .narrow .backview { top: 150px; }
  .narrow .hearts { left: 10px; right: 10px; top: 150px; max-width: none; }
  .narrow .bottom { padding: 0 8px 8px; }
  .narrow .tray { border-radius: 22px; padding: 6px 6px 8px; }
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
</style>
