<script lang="ts">
  // Keypals: pick your buddy, dress them up, and choose the dance they do at the finish line. The
  // Wardrobe has every slot (head, face, neck, back, hand, feet): everything you have is yours, so any
  // buddy can wear it, and each buddy keeps its own look. Tap a thing you're wearing and "Move it" to
  // nudge it into place on this buddy. Dances unlock as each buddy's own friendship grows. Buddies not on
  // the team yet show in shadowy grey with what brings them in. Tapping a thing on the buddy itself
  // picks it up to move, too.
  import { onDestroy, onMount, tick } from 'svelte';
  import { Raycaster, Vector2 } from 'three';
  import { game } from '../state/game.svelte';
  import { BUDDIES, FRIEND, type FriendId } from '../art/cast';
  import { DANCES as ALL_DANCES, forBuddy, type Reward } from '../engine/rewards';
  import { palOf, setLook } from '../engine/profile';
  import { levelFromXp } from '../engine/stickers';
  import { joinProgress, onTeam, UNLOCKS } from '../engine/team';
  import { BUDDY_ROLE, RARITY, ROLE } from '../adventure/glimmers';
  import { advView, ISLAND, markSeen } from '../adventure/state';
  import { ITEM, NO_NUDGE, SETS, SET_IDS, SLOT_NAME, WEAR_SLOTS, setItems, setsOn, lookView, type Nudge, type SetId, type WearSlot } from '../adventure/gear';
  import { CATALOG, CAT, bestFriendship, buyItem, howText, nudgeItem, nudgeOf, ownsItem, wearItem, wornIn, type CatalogItem } from '../adventure/wardrobe';
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
  import Turntable from '../ui/Turntable.svelte';

  const p = $derived(game.profile!);
  let who = $state<FriendId>(game.profile!.buddy);
  const pal = $derived(palOf(p, who));
  const lvl = $derived(levelFromXp(pal.xp));
  let tab = $state<'wear' | 'dances'>(game.closetTab === 'dances' ? 'dances' : 'wear');
  // the wardrobe: the slot being dressed, and a thing (or set) shown big with what it does and how to get it
  let slot = $state<WearSlot>('head');
  let peek = $state<CatalogItem | null>(null);
  let setPeek = $state<SetId | null>(null);
  const base = import.meta.env.BASE_URL;
  const adv = $derived(advView(p));
  const look = $derived(lookView(adv, who));
  const setsWorn = $derived(setsOn(look));
  const wearTip = $derived(tab === 'wear' && !adv.seen.includes('wardrobe1'));
  // a few dances bump into some buddies' heads or hats: those buddies don't get them
  const DANCES = $derived(forBuddy(ALL_DANCES, who));
  const dancesOpen = $derived(DANCES.filter(d => !locked(d)).length);
  const ownedCount = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
  // what's on each slot, and the things for the chosen slot: yours first, then the rest by how to get them
  const onSlot = (sl: WearSlot) => wornIn(p, who, sl);
  const forSlot = $derived(CATALOG.filter(c => c.slot === slot).map(c => ({ c, mine: ownsItem(p, c.id) })).sort((a, b) => Number(b.mine) - Number(a.mine)));
  let burst = $state(0);
  let shake = $state<string | null>(null);
  let scene: ShowScene | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  const RAR = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

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
    return r ? { top: r.top / innerHeight, bottom: r.bottom / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.2, bottom: 0.95, left: 0, right: 0.45 };
  }
  function onResize() { if (scene) scene.view = viewOf(); }

  function pick(id: FriendId) { if (id === who) return; who = id; moving = null; if (slot === 'colour' && colourSoon(id)) slot = 'head'; sfx.pop(); show(id); }
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
  // ---------- the wardrobe ----------
  function tapItem(c: CatalogItem) {
    if (!ownsItem(p, c.id)) { peek = c; sfx.pop(); return; }
    const on = onSlot(c.slot) === c.id;
    game.update(pp => { wearItem(pp, who, c.slot, on ? null : c.id); });
    moving = null;
    void scene?.redress(who);
    if (on) sfx.pop(); else { burst++; sfx.equip(); }
  }
  function takeOff(sl: WearSlot) {
    game.update(pp => { wearItem(pp, who, sl, null); });
    moving = null;
    void scene?.redress(who);
    sfx.pop();
  }
  function buy(c: CatalogItem) {
    let r: { ok: boolean; why?: string } = { ok: false };
    game.update(pp => { r = buyItem(pp, who, c.id); });
    if (!r.ok) { sfx.nope(); if (r.why) game.say(r.why); return; }
    void scene?.redress(who);
    peek = null; burst++; sfx.buy();
    game.say(`The ${c.name} is yours! ${FRIEND[who].name} has it on.`);
  }
  function setTab(t: 'wear' | 'dances') { tab = t; game.closetTab = t === 'wear' ? 'outfits' : 'dances'; moving = null; sfx.pop(); }
  const island = (id: string) => ISLAND[id as keyof typeof ISLAND]?.name ?? id;
  const joined = $derived(onTeam(p, who));
  const join = $derived(joinProgress(p, who));
  function makeBuddy() { if (!joined) return; game.update(pp => { pp.buddy = who; }); burst++; sfx.equip(); scene?.dance(who, pal.dance); }

  // ---------- Move it: nudge a worn thing into place on this buddy ----------
  let moving = $state<{ slot: WearSlot; id: string; n: Nudge } | null>(null);
  // (a colour isn't a thing on the buddy: nothing to move)
  const movable = (sl: WearSlot) => sl !== 'colour' && !!onSlot(sl);
  const wearsAny = $derived(WEAR_SLOTS.some(s => s !== 'colour' && !!look.on[s]));
  function startMove(sl: WearSlot = slot) {
    const id = onSlot(sl);
    if (!id || sl === 'colour') return;
    if (moving) cancelMove();
    slot = sl;
    moving = { slot: sl, id, n: nudgeOf(p, who, id) };
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
    if (!hit || hit.slot === 'colour') return;
    if (tab !== 'wear') setTab('wear');
    startMove(hit.slot);
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
  function saveMove() {
    if (!moving) return;
    const m = moving;
    game.update(pp => nudgeItem(pp, who, m.id, m.n));
    moving = null; burst++; sfx.equip();
  }
  function resetMove() {
    if (!moving) return;
    moving = { ...moving, n: { ...NO_NUDGE } };
    live(NO_NUDGE);
    sfx.pop();
  }
  function cancelMove() {
    if (!moving) return;
    const saved = nudgeOf(p, who, moving.id);
    live(saved);
    moving = null;
  }
  // hold a button to keep nudging
  let holdTimer = 0;
  function hold(d: Partial<Nudge>) { nudge(d); clearInterval(holdTimer); holdTimer = window.setInterval(() => nudge(d), 90); }
  function release() { clearInterval(holdTimer); }

  onMount(() => { show(who); addEventListener('resize', onResize); addEventListener('pointerup', release); stageEl?.addEventListener('pointerdown', stageDown); stageEl?.addEventListener('pointerup', stageUp); });
  onDestroy(() => { disposed = true; clearInterval(holdTimer); removeEventListener('resize', onResize); removeEventListener('pointerup', release); stageEl?.removeEventListener('pointerdown', stageDown); stageEl?.removeEventListener('pointerup', stageUp); if (scene && stage.current() === scene) stage.use(null); });
</script>

<div class="screen closet">
  <Header title="Keypals" sub="Pick your buddy, dress them up, and choose their finish-line dance." />
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
    <div class="stagebox" bind:this={stageEl}>
      <Confetti {burst} count={50} x={50} y={45} />
      <Turntable scene={() => scene} el={stageEl} />
      {#if joined && wearsAny && !moving && tab === 'wear'}<p class="taphint"><Icon name="hand" size={18} /> Tap something you're wearing to move it</p>{/if}
    </div>
    <div class="side">
      <div class="who card">
        <h2>{FRIEND[who].name}</h2>
        {#if joined}
          <div class="xp"><span class="lvl"><Icon name="heart" size={15} /> Friendship {lvl.level}</span><div class="bar"><i style:width="{(lvl.into / lvl.need) * 100}%"></i></div><span class="muted">{lvl.into}/{lvl.need} XP</span></div>
          <p class="quirk">{FRIEND[who].quirk}</p>
          <p class="advline"><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" /><span><b>In Adventure, {ROLE[BUDDY_ROLE[who]].name}:</b> {ROLE[BUDDY_ROLE[who]].text}</span></p>
          {#if p.buddy !== who}<button class="btn btn-primary" onclick={makeBuddy}>Play with {FRIEND[who].name}</button>{/if}
          <p class="keep">Everything you wear is yours: any buddy can put it on. Each buddy keeps its own look, friendship and dances.</p>
        {:else}
          <p class="joins"><Icon name="lock" /> Joins your team when you: <b>{UNLOCKS[who]?.how}</b></p>
          <div class="xp"><div class="bar"><i style:width="{join.share * 100}%"></i></div><span class="muted">{join.text}</span></div>
          <p class="quirk">{FRIEND[who].quirk}</p>
        {/if}
      </div>
      {#if joined && moving}
        {@const c = CAT[moving.id]}
        <!-- Move it: big buttons to nudge the thing into place (hold to keep going) -->
        <div class="mover card">
          <div class="mvhead"><img src="{base}{c?.icon}" alt="" /><b>Move the {c?.name ?? 'thing'}</b></div>
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
            <button class="btn" onclick={cancelMove}>Cancel</button>
            <button class="btn btn-primary" onclick={saveMove}>Done</button>
          </div>
          <p class="mvnote">Just for {FRIEND[who].name}: every other buddy keeps its own fit.</p>
        </div>
      {:else if joined}
      <div class="tabs">
        <button class:on={tab === 'wear'} onclick={() => setTab('wear')}><TileArt kind="outfits" size={40} /><span>Wardrobe</span><em>{ownedCount}/{CATALOG.length}</em></button>
        <button class:on={tab === 'dances'} onclick={() => setTab('dances')}><TileArt kind="dances" size={40} /><span>Dances</span><em>{dancesOpen}/{DANCES.length}</em></button>
        <button class="shopbtn" onclick={() => { sfx.pop(); game.openShop(tab === 'wear' ? slot : null); }} title="The Island Shop"><img src="{base}game/icon-shell.webp" alt="" /><span>Shop</span></button>
      </div>
      {#if tab === 'wear'}
        <div class="gearpane scroll">
          <div class="gslots">
            {#each WEAR_SLOTS as s (s)}
              {@const id = onSlot(s)}
              {@const it = id ? CAT[id] : null}
              <div class="gsw">
                {#if s === 'colour' && colourSoon(who)}
                <button class="gslot soon" onclick={soonNote} title="{FRIEND[who].name}'s colours are coming soon">
                  <span class="gpic"><img src="{base}colours/colour_rainbow.webp" alt="" /></span>
                  <small>{SLOT_NAME[s]}</small>
                </button>
                <em class="soonpill">soon</em>
                {:else}
                <button class="gslot" class:on={slot === s} style:--rc={it ? RARITY[it.rarity].color : null} onclick={() => { slot = s; moving = null; sfx.pop(); }}>
                  <span class="gpic">{#if it}<img src="{base}{it.icon}" alt="" />{:else}<span class="plus">+</span>{/if}</span>
                  <small>{SLOT_NAME[s]}</small>
                </button>
                {/if}
                {#if movable(s)}<button class="gmv" onclick={() => startMove(s)} title="Move the {it?.name}" aria-label="Move the {it?.name}"><Icon name="hand" size={15} /></button>{/if}
              </div>
            {/each}
          </div>
          {#if onSlot(slot)}
            {@const cur = CAT[onSlot(slot)!]}
            <div class="wearing">
              <span><b>{cur?.name}</b> is on.</span>
              {#if slot !== 'colour'}<button class="btn movebtn" onclick={() => startMove()}><Icon name="hand" size={18} /> Move it</button>{/if}
              <button class="btn" onclick={() => takeOff(slot)}>Take off</button>
            </div>
          {/if}
          <div class="gitems">
            {#each forSlot as { c, mine } (c.id)}
              {@const wearing = onSlot(c.slot) === c.id}
              <button class="gtile" class:wearing class:notyet={!mine} style:--rc={RARITY[c.rarity].color} onclick={() => tapItem(c)}>
                <span class="grar">{RARITY[c.rarity].name}</span>
                <img src="{base}{c.icon}" alt="" />
                <b>{c.name}</b>
                <span class="gpow">{#if c.power}<Icon name="shield" size={14} /> {/if}{c.text}</span>
                {#if wearing}<em class="gst on"><Icon name="check" size={14} /> Wearing</em>
                {:else if mine}<em class="gst">Tap to wear</em>
                {:else if c.how === 'shop'}<em class="gst buy"><img src="{base}game/icon-shell.webp" alt="" />{c.price}</em>
                {:else if c.how === 'friendship'}<em class="gst gift"><Icon name="heart" size={14} /> Friendship {c.level}</em>
                {:else}<em class="gst champ"><Icon name="trophy" size={14} /> Champion prize</em>{/if}
              </button>
            {/each}
          </div>
          {#if slot === 'hand' || slot === 'back' || slot === 'feet'}
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
      {:else}
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
      {/if}
      {:else}
        <div class="card soon"><p>When {FRIEND[who].name} joins your team, they start their own friendship and dances, and they can wear everything you have.</p></div>
      {/if}
    </div>
  </div>

  {#if wearTip && joined}<Coach text="New! Pick a spot on your buddy, then tap a thing to put it on. Everything you have works on every buddy, and Move it puts it just where you want it." at=".gslot.on" button="Got it" onok={() => game.update(pp => markSeen(pp, 'wardrobe1'))} />{/if}

  {#if peek}
    {@const it = peek}
    {@const short = it.price !== null ? Math.max(0, it.price - adv.shells) : 0}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gbg" onclick={() => (peek = null)}>
      <div class="gcard card" style:--rc={RARITY[it.rarity].color} onclick={(e) => e.stopPropagation()}>
        <img class="gbig" src="{base}{it.icon}" alt="" />
        <div class="gtext">
          <small class="grarity">{RARITY[it.rarity].name} · {SLOT_NAME[it.slot]}</small>
          <h3>{it.name}</h3>
          {#if it.power}<p><b>In battles:</b> {it.text}</p>{#if it.set}<p class="gsetline">Part of the <b>{SETS[it.set].name}</b>. Wear all three for: {SETS[it.set].text}</p>{/if}
          {:else}<p>{it.text}</p><p class="gsetline">Just for fun.</p>{/if}
          {#if it.how === 'shop'}
            <button class="btn btn-primary gbuy" disabled={short > 0} onclick={() => buy(it)}><img src="{base}game/icon-shell.webp" alt="" />{short > 0 ? `You need ${short} more shells` : `Buy for ${it.price} shells`}</button>
            <p class="muted gnote">Yours to keep, for every buddy. You have {adv.shells} shells: practice and battles earn more.</p>
          {:else if it.how === 'friendship'}
            <p class="gchamp"><Icon name="heart" size={16} /> A friendship gift: reach friendship <b>{it.level}</b> with any buddy (your best is {bestFriendship(p)}).</p>
          {:else}
            <p class="gchamp"><Icon name="trophy" size={16} /> {howText(it, island)} in Adventure to win it.</p>
          {/if}
        </div>
        <button class="btn gclose" onclick={() => (peek = null)}>OK</button>
      </div>
    </div>
  {/if}

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
</div>

<style>
  .closet { display: flex; flex-direction: column; background: transparent; }
  .crew { display: flex; gap: 8px; padding: 10px 20px; overflow-x: auto; background: rgba(255, 255, 255, .85); border-bottom: var(--panel-border); flex: none; }
  .mate { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; width: 92px; padding: 4px 4px 8px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); }
  .mate.on { border-color: var(--primary-hi); }
  .mate .nm { font: 600 15px var(--font-ui); }
  /* not on the team yet: the real buddy in shadowy black and white */
  .mate.locked .pic :global(img) { filter: grayscale(1) brightness(.5) contrast(1.25); }
  .mate.locked .pic :global(.critter-host) { background: radial-gradient(circle at 50% 35%, #e9e9ef, #b9bccb); }
  .mate.locked .nm { color: var(--muted); }
  .mate .lk { position: absolute; top: 48px; right: 12px; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: rgba(48, 36, 80, .8); box-shadow: 0 0 0 2px #fff; }
  .joins { margin: 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .soon { padding: 16px 18px; }
  .soon p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .keep { margin: 4px 0 0; font: 600 13px/1.35 var(--font-body); color: var(--muted); }
  .mate .me { position: absolute; top: 4px; right: 4px; font: 800 9px var(--font-body); background: var(--mint); color: #0f4a36; padding: 2px 5px; border-radius: 999px; }
  .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr minmax(380px, 1.05fr); gap: 20px; padding: 18px 20px; }
  .stagebox { position: relative; min-height: 0; }
  .side { min-height: 0; display: flex; flex-direction: column; gap: 12px; }
  .who { padding: 14px 18px; display: flex; flex-direction: column; gap: 6px; }
  .who h2 { font-size: 30px; }
  .xp { display: flex; align-items: center; gap: 10px; font: 700 13px var(--font-body); }
  .lvl { background: var(--primary); color: #fff; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .bar { flex: 1; height: 12px; border-radius: 999px; background: var(--bg2); overflow: hidden; box-shadow: inset 0 2px 3px rgba(60, 40, 110, .15); }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); border-radius: 999px; transition: width .6s ease; }
  .quirk { margin: 0; color: var(--muted); font-weight: 600; }
  .advline { margin: 0; display: flex; gap: 8px; align-items: center; font: 600 14px/1.35 var(--font-body); color: var(--ink2); background: #f6f2ff; border-radius: 14px; padding: 6px 10px; }
  .advline img { width: 26px; height: 26px; object-fit: contain; flex: none; }
  .tabnote { margin: 0; font: 600 14px/1.35 var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .85); border-radius: 14px; padding: 6px 12px; }
  .power { font: 800 11px var(--font-body); color: #6a3fd6; background: #f1eaff; padding: 2px 8px; border-radius: 999px; cursor: help; }
  .who .btn { align-self: flex-start; }
  .tabs { display: flex; gap: 8px; }
  .tabs button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; font: 600 22px var(--font-ui); padding: 8px 12px; border-radius: 18px; border: 3px solid transparent; background: rgba(255, 255, 255, .85); cursor: pointer; color: var(--ink2); box-shadow: var(--shadow-sm); }
  .tabs button em { font: 800 13px var(--font-body); font-style: normal; background: var(--bg2); color: var(--ink2); padding: 3px 9px; border-radius: 999px; }
  .tabs button.on { background: #fff; border-color: var(--primary-hi); color: var(--ink); }
  .tabs button.on em { background: var(--primary); color: #fff; }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; align-content: start; padding: 4px; }
  .of { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); font: 600 14px var(--font-ui); color: var(--ink); }
  .of.on { border-color: var(--primary-hi); background: #faf7ff; }
  .of.locked { opacity: .55; filter: grayscale(.6); }
  .of.shake { animation: wiggle .35s ease; }
  .thumb { width: 88px; height: 88px; display: grid; place-items: center; }
  .thumb.dpic { border-radius: 50%; background: radial-gradient(circle at 50% 40%, #fff, #f3eaff); }
  .resetbtn { display: inline-flex; align-items: center; gap: 6px; }
  .lvl { display: inline-flex; align-items: center; gap: 4px; }
  .gchamp { display: flex; align-items: center; gap: 6px; }
  .gsname small { display: inline-flex; align-items: center; gap: 3px; }
  .movebtn { display: inline-flex; align-items: center; gap: 6px; }
  .rar { font: 800 11px var(--font-body); padding: 2px 8px; border-radius: 999px; background: var(--bg2); color: var(--ink2); }
  .rar.rare { background: #dcecff; color: #2f6fb8; }
  .rar.epic { background: #efe2ff; color: #7a4fd0; }
  .rar.legendary { background: #fff1c2; color: #8a6400; }
  .lock { display: flex; align-items: center; gap: 4px; font: 800 12px var(--font-body); color: var(--muted); }
  /* gear: the four spots on the buddy, the pieces for the chosen spot, the sets */
  .gearpane { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px 2px 8px; }
  .gslots { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; }
  .gsw { position: relative; display: grid; }
  /* a little Move it button on every spot with something on it */
  .gmv { position: absolute; top: -4px; right: -4px; width: 28px; height: 28px; border-radius: 50%; border: 0; display: grid; place-items: center; cursor: pointer; color: #5a3d00; background: linear-gradient(135deg, #ffe58a, #ffc94d); box-shadow: 0 0 0 2px #fff, var(--shadow-sm); }
  .gmv:active { transform: translateY(1px); }
  .taphint { position: absolute; left: 50%; top: 8px; transform: translateX(-50%); z-index: 3; margin: 0; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; pointer-events: none; font: 700 14px var(--font-body); color: #5a3d00; background: rgba(255, 244, 214, .95); padding: 5px 14px; border-radius: 999px; box-shadow: 0 0 0 2px #ffd36b, var(--shadow-sm); }
  .gslot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 4px; border-radius: 18px; border: 3px solid transparent; background: rgba(255, 255, 255, .92); cursor: pointer; box-shadow: var(--shadow-sm); font: inherit; }
  .gslot.on { border-color: var(--primary-hi); background: #fff; }
  .gslot.hat { opacity: .9; }
  /* a buddy whose colours aren't ready: a soft grey paint splat, and a kind note when tapped */
  .gslot.soon .gpic img { filter: grayscale(1) opacity(.45); }
  .gslot.soon small { color: var(--muted); }
  .soonpill { position: absolute; top: -5px; right: -4px; pointer-events: none; font: 800 10px var(--font-body); font-style: normal; color: #fff; background: #9b8cc9; padding: 2px 7px; border-radius: 999px; box-shadow: 0 0 0 2px #fff; }
  .gpic { width: 50px; height: 50px; display: grid; place-items: center; border-radius: 16px; background: radial-gradient(circle at 50% 40%, #fff, #f1ecfb); box-shadow: inset 0 0 0 2px var(--rc, #e4ddf3); }
  .gpic img { width: 44px; height: 44px; object-fit: contain; }
  .gpic .plus { font: 600 30px/1 var(--font-ui); color: #b8acd6; }
  .gslot small { font: 800 12px var(--font-body); color: var(--ink2); }
  .gitems { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .gtile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 18px 6px 6px; border-radius: 20px; border: 3px solid #fff; background: linear-gradient(180deg, #fff, #faf7ff); cursor: pointer; box-shadow: 0 0 0 2px var(--rc), var(--shadow-sm); font: inherit; text-align: center; transition: transform .15s; }
  .gtile:hover { transform: translateY(-3px); }
  .gtile.wearing { background: linear-gradient(180deg, #fff, #eefcf4); box-shadow: 0 0 0 3px #2fbf73, 0 0 18px rgba(47, 191, 115, .35); }
  .gtile > img { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 6px 8px rgba(40, 20, 80, .2)); }
  .gtile.notyet > img { filter: saturate(.75) drop-shadow(0 6px 8px rgba(40, 20, 80, .15)); }
  .gtile b { font: 600 17px/1.1 var(--font-ui); color: var(--ink); }
  .gpow { font: 600 12px/1.25 var(--font-body); color: var(--ink2); }
  .grar { position: absolute; top: 6px; left: 50%; transform: translateX(-50%); font: 800 10px var(--font-body); color: #fff; background: var(--rc); padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .gst { margin-top: auto; font: 800 12px var(--font-body); font-style: normal; color: var(--ink2); background: var(--bg2); padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
  .gst.on { background: #2fbf73; color: #fff; }
  .gst.buy { background: #fff3d6; color: #7a5300; }
  .gst.buy img { width: 18px; height: 18px; object-fit: contain; }
  .gst.champ { background: #fff1c2; color: #8a6400; }
  .gst.gift { background: #ffe4f0; color: #b02a6a; }
  /* (div: the gear tiles use .wearing too) */
  div.wearing { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: rgba(255, 255, 255, .92); border-radius: 16px; padding: 6px 8px 6px 14px; box-shadow: var(--shadow-sm); font: 600 15px var(--font-body); color: var(--ink2); }
  div.wearing span { flex: 1; min-width: 120px; }
  div.wearing .btn { padding: 6px 14px; font-size: 15px; }
  .movebtn { background: linear-gradient(135deg, #ffe58a, #ffc94d) !important; color: #5a3d00 !important; }
  .tabs .shopbtn { flex: 0 0 auto; }
  .tabs .shopbtn img { width: 34px; height: 34px; object-fit: contain; }
  /* Move it: a card over the stage with big buttons */
  /* Move it takes the place of the wardrobe in the side panel, so the buddy stays in full view */
  .mover { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 0 0 3px #ffd36b, var(--shadow); }
  .mvhead { display: flex; align-items: center; gap: 8px; font: 600 17px var(--font-ui); }
  .mvhead img { width: 36px; height: 36px; object-fit: contain; }
  .mvgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .mvrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .mv { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 64px; border: 0; border-radius: 14px; background: #f4f0ff; font: 600 22px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: inset 0 -3px 0 #ddd3f7; touch-action: none; user-select: none; }
  .mv:active { transform: translateY(2px); box-shadow: inset 0 -1px 0 #ddd3f7; background: #ebe4ff; }
  .mv small { font: 800 11px var(--font-body); color: var(--ink2); margin-top: 2px; }
  .mv.mid { background: #fff4d6; color: #b07b00; }
  .mvbtns { display: flex; gap: 6px; justify-content: flex-end; }
  .mvbtns .btn { padding: 6px 14px; font-size: 15px; }
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
  .gbg { position: fixed; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; padding: 16px; }
  .gcard { width: min(520px, 94vw); padding: 18px 20px; display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: center; box-shadow: 0 0 0 4px var(--rc, #fff), var(--shadow); }
  .gbig { width: 130px; height: 130px; object-fit: contain; }
  .gtext h3 { margin: 0 0 4px; font-size: 24px; }
  .gtext p { margin: 0 0 6px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .grarity { font: 800 12px var(--font-body); color: var(--rc); text-transform: uppercase; letter-spacing: .04em; }
  .gsetline { font-size: 13px !important; color: var(--muted) !important; }
  .gbuy { display: inline-flex; align-items: center; gap: 6px; }
  .gbuy img { width: 22px; height: 22px; object-fit: contain; }
  .gnote { margin-top: 6px !important; font-size: 12px !important; }
  .gchamp { background: #fff7dc; border-radius: 12px; padding: 6px 10px; }
  .gclose { grid-column: 1 / -1; justify-self: end; }
  .setpics { display: flex; flex-direction: column; gap: 6px; }
  .setpics img { width: 56px; height: 56px; }
  .gtext ul { margin: 4px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; font: 600 14px var(--font-body); color: var(--muted); }
  .gtext li.on { color: #1f9a6a; }
  /* short screens: the buddy card keeps just the name, friendship and the button */
  @media (max-height: 820px) and (min-width: 761px) {
    .who { padding: 10px 16px; gap: 4px; }
    .who h2 { font-size: 24px; }
    .quirk, .keep, .advline { display: none; }
  }
  @media (max-width: 760px) {
    .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: 46vh 1fr; }
    /* phones: the whole panel under the buddy scrolls, so the pieces never squash to nothing */
    .side { min-width: 0; overflow-y: auto; padding-bottom: 16px; }
    .gearpane, .grid { flex: none; overflow: visible; }
    .tabs button { font-size: 16px; gap: 4px; padding: 6px 4px; min-width: 0; }
    .tabs button em { display: none; }
    .gslots { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .mover { padding: 8px; gap: 6px; }
    .mv { min-height: 54px; font-size: 18px; } .mv :global(img) { width: 30px; height: 30px; }
    .tabs button :global(svg), .tabs .shopbtn img { width: 30px; height: 30px; }
    .gtile { padding: 20px 4px 8px; }
    .gtile > img { width: 60px; height: 60px; }
    .gtile b { font-size: 14px; }
    .gpow { font-size: 11px; }
    .gpic { width: 48px; height: 48px; } .gpic img { width: 40px; height: 40px; }
    .gcard { grid-template-columns: 1fr; justify-items: center; text-align: center; }
    .gbig { width: 110px; height: 110px; }
    .gset { flex-direction: column; gap: 2px; }
    .gsname { align-items: center; text-align: center; }
  }
</style>
