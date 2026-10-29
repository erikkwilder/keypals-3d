<script lang="ts">
  // Keypals: pick your buddy, dress them up, and choose the dance they do at the finish line.
  // Outfits and dances unlock as each buddy's own friendship grows. Buddies not on the team yet show in
  // shadowy grey with what brings them in.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { BUDDIES, FRIEND, type FriendId } from '../art/cast';
  import { OUTFITS, DANCES as ALL_DANCES, forBuddy, type Reward } from '../engine/rewards';
  import { palOf, setLook } from '../engine/profile';
  import { levelFromXp } from '../engine/stickers';
  import { joinProgress, onTeam, UNLOCKS } from '../engine/team';
  import { BUDDY_ROLE, GEAR, RARITY, ROLE } from '../adventure/glimmers';
  import { advOf, advView, ISLAND, markSeen } from '../adventure/state';
  import { ITEMS, ITEM, SETS, SET_IDS, SLOTS, SLOT_NAME, buyGear, gearView, howToGet, setItems, setsOn, wearGear as putOn, wornOf, type GearItem, type SetId, type Slot } from '../adventure/gear';
  import Coach from '../ui/Coach.svelte';
  import { sfx } from '../audio/sound';
  import { stage } from '../three/stage';
  import { ShowScene } from '../three/showScene';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';
  import TileArt from '../ui/TileArt.svelte';

  const p = $derived(game.profile!);
  let who = $state<FriendId>(game.profile!.buddy);
  const pal = $derived(palOf(p, who));
  const lvl = $derived(levelFromXp(pal.xp));
  let tab = $state<'outfits' | 'dances' | 'gear'>(game.closetTab);
  // gear: the slot being picked for, and a piece (or set) shown big with what it does and how to get it
  let slot = $state<Slot>('hand');
  let peek = $state<GearItem | null>(null);
  let setPeek = $state<SetId | null>(null);
  const base = import.meta.env.BASE_URL;
  const adv = $derived(advView(p));
  const bg = $derived(gearView(adv, who));
  const setsWorn = $derived(setsOn(bg));
  const gearTip = $derived(tab === 'gear' && !adv.seen.includes('gear1'));
  // a few dances bump into some buddies' heads or hats: those buddies don't get them
  const DANCES = $derived(forBuddy(ALL_DANCES, who));
  const outfitsOpen = $derived(OUTFITS.filter(o => !locked(o)).length);
  const dancesOpen = $derived(DANCES.filter(d => !locked(d)).length);
  let burst = $state(0);
  let shake = $state<string | null>(null);
  let scene: ShowScene | null = null;
  let stageEl: HTMLDivElement | undefined = $state();
  let disposed = false;
  const RAR = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
  const ICON: Record<string, string> = { fistpump: '✊', jump: '⭐', dance_floss: '🕺', dance_robot: '🤖', dance_chicken: '🐔', dance_moonwalk: '🌙', dance_gangnam: '🐴', dance_hype: '🔥', dance_raiseroof: '🙌', dance_twist: '🌀', dance_cabbage: '🥬', dance_macarena: '💃' };

  async function show(id: FriendId) {
    const old = scene;
    const sc = await ShowScene.create({ buddies: [id], view: viewOf(), spot: 10, outfits: { [id]: palOf(game.profile!, id).outfit }, shadowed: onTeam(game.profile!, id) ? [] : [id], gear: { [id]: wornOf(advView(game.profile!), id) } });
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

  function pick(id: FriendId) { if (id === who) return; who = id; sfx.pop(); show(id); }
  function locked(r: Reward) { return r.level > lvl.level; }
  function nope(r: Reward) {
    shake = r.id; setTimeout(() => (shake = null), 400); sfx.miss();
    game.say(`Reach friendship ${r.level} to unlock ${r.name}!`);
  }
  function wear(r: Reward | null) {
    if (r && locked(r)) return nope(r);
    const id = r?.id ?? 'none';
    game.update(pp => setLook(pp, who, { outfit: id }));
    scene?.wear(who, id);
    if (id !== 'none') { burst++; sfx.badge(); } else sfx.pop();
  }
  function dance(r: Reward) {
    if (locked(r)) return nope(r);
    game.update(pp => setLook(pp, who, { dance: r.id }));
    scene?.dance(who, r.id);
    sfx.pop();
  }
  // ---------- gear ----------
  function tapPiece(it: GearItem) {
    if (!bg.owned.includes(it.id)) { peek = it; sfx.pop(); return; }
    const on = bg.on[it.slot] === it.id;
    game.update(pp => { putOn(advOf(pp), who, it.slot, on ? null : it.id); });
    scene?.wearGear(who, it.slot, on ? null : it.id);
    if (on) sfx.pop(); else { burst++; sfx.badge(); }
  }
  function buyPiece(it: GearItem) {
    let r: { ok: boolean; why?: string } = { ok: false };
    game.update(pp => { r = buyGear(advOf(pp), who, it.id); });
    if (!r.ok) { sfx.miss(); if (r.why) game.say(r.why); return; }
    scene?.wearGear(who, it.slot, it.id);
    peek = null; burst++; sfx.complete();
    game.say(`${FRIEND[who].name} got the ${it.name}!`);
  }
  function setTab(t: 'outfits' | 'dances' | 'gear') { tab = t; game.closetTab = t; sfx.pop(); }
  const island = (id: string) => ISLAND[id as keyof typeof ISLAND]?.name ?? id;
  const joined = $derived(onTeam(p, who));
  const join = $derived(joinProgress(p, who));
  function makeBuddy() { if (!joined) return; game.update(pp => { pp.buddy = who; }); burst++; sfx.complete(); scene?.dance(who, pal.dance); }

  onMount(() => { show(who); addEventListener('resize', onResize); });
  onDestroy(() => { disposed = true; removeEventListener('resize', onResize); if (scene && stage.current() === scene) stage.use(null); });
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
    </div>
    <div class="side">
      <div class="who card">
        <h2>{FRIEND[who].name}</h2>
        {#if joined}
          <div class="xp"><span class="lvl">♥ Friendship {lvl.level}</span><div class="bar"><i style:width="{(lvl.into / lvl.need) * 100}%"></i></div><span class="muted">{lvl.into}/{lvl.need} XP</span></div>
          <p class="quirk">{FRIEND[who].quirk}</p>
          <p class="advline"><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" /><span><b>In Adventure, {ROLE[BUDDY_ROLE[who]].name}:</b> {ROLE[BUDDY_ROLE[who]].text}</span></p>
          {#if p.buddy !== who}<button class="btn btn-primary" onclick={makeBuddy}>Play with {FRIEND[who].name}</button>{/if}
          <p class="keep">Each buddy earns their own friendship, outfits, dances, stickers and medals. Your lessons and stars stay with you.</p>
        {:else}
          <p class="joins"><Icon name="lock" /> Joins your team when you: <b>{UNLOCKS[who]?.how}</b></p>
          <div class="xp"><div class="bar"><i style:width="{join.share * 100}%"></i></div><span class="muted">{join.text}</span></div>
          <p class="quirk">{FRIEND[who].quirk}</p>
        {/if}
      </div>
      {#if joined}
      <div class="tabs">
        <button class:on={tab === 'outfits'} onclick={() => setTab('outfits')}><TileArt kind="outfits" size={40} /><span>Outfits</span><em>{outfitsOpen}/{OUTFITS.length}</em></button>
        <button class:on={tab === 'gear'} class="geartab" onclick={() => setTab('gear')}><img src="{base}gear/hero_cape.webp" alt="" /><span>Gear</span><em>{bg.owned.length}/{ITEMS.length}</em></button>
        <button class:on={tab === 'dances'} onclick={() => setTab('dances')}><TileArt kind="dances" size={40} /><span>Dances</span><em>{dancesOpen}/{DANCES.length}</em></button>
      </div>
      <p class="tabnote">{tab === 'outfits' ? 'Outfits open up as your friendship grows, and each one helps in Adventure battles.' : tab === 'gear' ? 'Gear helps in Adventure battles. Wear all three pieces of a set for a bonus!' : `Your finish dance plays when you finish a lesson or trip, and it's ${FRIEND[who].name}'s big Finale move in Adventure.`}</p>
      {#if tab === 'gear'}
        <div class="gearpane scroll">
          <div class="gslots">
            <button class="gslot hat" onclick={() => setTab('outfits')} title="Hats are on the Outfits tab">
              <span class="gpic">{#if pal.outfit !== 'none'}<img src="{base}outfits/{pal.outfit}.webp" alt="" />{:else}<span class="plus">+</span>{/if}</span>
              <small>Hat</small>
            </button>
            {#each SLOTS as s (s)}
              {@const it = bg.on[s] ? ITEM[bg.on[s]!] : null}
              <button class="gslot" class:on={slot === s} style:--rc={it ? RARITY[it.rarity].color : null} onclick={() => { slot = s; sfx.pop(); }}>
                <span class="gpic">{#if it}<img src="{base}gear/{it.id}.webp" alt="" />{:else}<span class="plus">+</span>{/if}</span>
                <small>{SLOT_NAME[s]}</small>
              </button>
            {/each}
          </div>
          <div class="gitems">
            {#each ITEMS.filter(i => i.slot === slot) as it (it.id)}
              {@const mine = bg.owned.includes(it.id)}
              {@const wearing = bg.on[it.slot] === it.id}
              <button class="gtile" class:wearing class:notyet={!mine} style:--rc={RARITY[it.rarity].color} onclick={() => tapPiece(it)}>
                <span class="grar">{RARITY[it.rarity].name}</span>
                <img src="{base}gear/{it.id}.webp" alt="" />
                <b>{it.name}</b>
                <span class="gpow">{it.text}</span>
                {#if wearing}<em class="gst on">✓ Wearing</em>
                {:else if mine}<em class="gst">Tap to wear</em>
                {:else if it.price !== null}<em class="gst buy"><img src="{base}game/icon-shell.webp" alt="" />{it.price}</em>
                {:else}<em class="gst champ">🏆 Champion prize</em>{/if}
              </button>
            {/each}
          </div>
          <div class="gsets">
            {#each SET_IDS as sid (sid)}
              {@const done = setsWorn.includes(sid)}
              <button class="gset" class:done onclick={() => { setPeek = sid; sfx.pop(); }}>
                <span class="gsicons">{#each setItems(sid) as it}<img class:off={bg.on[it.slot] !== it.id} src="{base}gear/{it.id}.webp" alt="" />{/each}</span>
                <span class="gsname"><b>{SETS[sid].name}</b><small>{done ? '✓ Bonus on!' : `${setItems(sid).filter(i => bg.on[i.slot] === i.id).length} of 3 on`}</small></span>
              </button>
            {/each}
          </div>
        </div>
      {:else}
      <div class="grid scroll">
        {#if tab === 'outfits'}
          <button class="of" class:on={pal.outfit === 'none'} onclick={() => wear(null)}>
            <div class="thumb"><Critter friend={who} size={80} /></div>
            <b>Just me</b><span class="rar common">Always</span>
          </button>
          {#each OUTFITS as o (o.id)}
            {@const lk = locked(o)}
            <button class="of rar-{o.rarity}" class:on={pal.outfit === o.id} class:locked={lk} class:shake={shake === o.id} onclick={() => wear(o)}>
              <div class="thumb"><img src="{import.meta.env.BASE_URL}outfits/{o.id}.webp" alt="" /></div>
              <b>{o.name}</b>
              {#if GEAR[o.id]}<span class="power" title="In Adventure: {GEAR[o.id].text}">⚔️ {GEAR[o.id].name}</span>{/if}
              {#if !lk}<span class="rar {o.rarity}">{RAR[o.rarity]}</span>
              {:else}<span class="lock" title="Unlocks at friendship {o.level}"><Icon name="lock" size={13} /> ♥ {o.level}</span>{/if}
            </button>
          {/each}
        {:else}
          {#each DANCES as d (d.id)}
            {@const lk = locked(d)}
            <button class="of dance rar-{d.rarity}" class:on={pal.dance === d.id} class:locked={lk} class:shake={shake === d.id} onclick={() => dance(d)}>
              <div class="thumb note">{ICON[d.id] ?? '♪'}</div>
              <b>{d.name}</b>
              {#if !lk}<span class="rar {d.rarity}">{pal.dance === d.id ? 'My finish dance' : RAR[d.rarity]}</span>
              {:else}<span class="lock" title="Unlocks at friendship {d.level}"><Icon name="lock" size={13} /> ♥ {d.level}</span>{/if}
            </button>
          {/each}
        {/if}
      </div>
      {/if}
      {:else}
        <div class="card soon"><p>When {FRIEND[who].name} joins your team, they start their own friendship, and outfits and dances open up as you play together.</p></div>
      {/if}
    </div>
  </div>

  {#if gearTip && joined}<Coach text="New! Pick a spot, then tap a piece to put it on. Gear helps in Adventure battles." at=".gslot.on" button="Got it" onok={() => game.update(pp => markSeen(pp, 'gear1'))} />{/if}

  {#if peek}
    {@const it = peek}
    {@const short = it.price !== null ? Math.max(0, it.price - adv.shells) : 0}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="gbg" onclick={() => (peek = null)}>
      <div class="gcard card" style:--rc={RARITY[it.rarity].color} onclick={(e) => e.stopPropagation()}>
        <img class="gbig" src="{base}gear/{it.id}.webp" alt="" />
        <div class="gtext">
          <small class="grarity">{RARITY[it.rarity].name} · {SLOT_NAME[it.slot]}</small>
          <h3>{it.name}</h3>
          <p><b>In battles:</b> {it.text}</p>
          <p class="gsetline">Part of the <b>{SETS[it.set].name}</b>. Wear all three for: {SETS[it.set].text}</p>
          {#if it.price !== null}
            <button class="btn btn-primary gbuy" disabled={short > 0} onclick={() => buyPiece(it)}><img src="{base}game/icon-shell.webp" alt="" />{short > 0 ? `You need ${short} more shells` : `Buy for ${it.price} shells`}</button>
            <p class="muted gnote">For {FRIEND[who].name}. You have {adv.shells} shells: battles and practice earn more.</p>
          {:else}
            <p class="gchamp">🏆 Beat the <b>{island(it.champion!)}</b> Champion with {FRIEND[who].name} to win it.</p>
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
        <div class="setpics">{#each setItems(sid) as it}<img class:off={bg.on[it.slot] !== it.id} src="{base}gear/{it.id}.webp" alt="" />{/each}</div>
        <div class="gtext">
          <h3>{SETS[sid].name}</h3>
          <p><b>Wear all three:</b> {SETS[sid].text}</p>
          <ul>{#each setItems(sid) as it}<li class:on={bg.on[it.slot] === it.id}>{bg.on[it.slot] === it.id ? '✓' : '○'} {it.name} <span class="muted">({SLOT_NAME[it.slot].toLowerCase()}{bg.owned.includes(it.id) ? '' : `: ${howToGet(it, island)}`})</span></li>{/each}</ul>
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
  .thumb img { width: 100%; height: 100%; object-fit: contain; }
  .thumb.note { font-size: 54px; color: #9b6bff; background: linear-gradient(135deg, #efe4ff, #ffe4f1); border-radius: 50%; width: 76px; height: 76px; }
  .rar { font: 800 11px var(--font-body); padding: 2px 8px; border-radius: 999px; background: var(--bg2); color: var(--ink2); }
  .rar.rare { background: #dcecff; color: #2f6fb8; }
  .rar.epic { background: #efe2ff; color: #7a4fd0; }
  .rar.legendary { background: #fff1c2; color: #8a6400; }
  .lock { display: flex; align-items: center; gap: 4px; font: 800 12px var(--font-body); color: var(--muted); }
  .tabs .geartab img { width: 40px; height: 40px; object-fit: contain; }
  /* gear: the four spots on the buddy, the pieces for the chosen spot, the sets */
  .gearpane { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 2px 2px 8px; }
  .gslots { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .gslot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px 4px; border-radius: 18px; border: 3px solid transparent; background: rgba(255, 255, 255, .92); cursor: pointer; box-shadow: var(--shadow-sm); font: inherit; }
  .gslot.on { border-color: var(--primary-hi); background: #fff; }
  .gslot.hat { opacity: .9; }
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
  @media (max-width: 760px) {
    .body { grid-template-columns: minmax(0, 1fr); grid-template-rows: 46vh 1fr; }
    /* phones: the whole panel under the buddy scrolls, so the pieces never squash to nothing */
    .side { min-width: 0; overflow-y: auto; padding-bottom: 16px; }
    .gearpane, .grid { flex: none; overflow: visible; }
    .tabs button { font-size: 16px; gap: 4px; padding: 6px 4px; min-width: 0; }
    .tabs button em { display: none; }
    .tabs button :global(svg), .tabs .geartab img { width: 30px; height: 30px; }
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
