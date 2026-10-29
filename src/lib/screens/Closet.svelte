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
  let tab = $state<'outfits' | 'dances'>(game.closetTab);
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
    const sc = await ShowScene.create({ buddies: [id], view: viewOf(), spot: 10, outfits: { [id]: palOf(game.profile!, id).outfit } });
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
        <button class:on={tab === 'outfits'} onclick={() => { tab = 'outfits'; game.closetTab = 'outfits'; sfx.pop(); }}><TileArt kind="outfits" size={40} /><span>Outfits</span><em>{outfitsOpen}/{OUTFITS.length}</em></button>
        <button class:on={tab === 'dances'} onclick={() => { tab = 'dances'; game.closetTab = 'dances'; sfx.pop(); }}><TileArt kind="dances" size={40} /><span>Dances</span><em>{dancesOpen}/{DANCES.length}</em></button>
      </div>
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
      {:else}
        <div class="card soon"><p>When {FRIEND[who].name} joins your team, they start their own friendship, and outfits and dances open up as you play together.</p></div>
      {/if}
    </div>
  </div>
</div>

<style>
  .closet { display: flex; flex-direction: column; background: transparent; }
  .crew { display: flex; gap: 8px; padding: 10px 20px; overflow-x: auto; background: rgba(255, 255, 255, .85); border-bottom: var(--panel-border); flex: none; }
  .mate { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; width: 92px; padding: 4px 4px 8px; border-radius: 18px; border: 3px solid transparent; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); }
  .mate.on { border-color: var(--primary-hi); }
  .mate .nm { font: 600 15px var(--font-ui); }
  .mate.locked .pic { filter: brightness(0) saturate(0); opacity: .45; }
  .mate.locked .nm { color: var(--muted); }
  .mate .lk { position: absolute; top: 30px; left: 0; right: 0; display: grid; place-items: center; color: #fff; filter: drop-shadow(0 1px 2px rgba(0,0,0,.4)); }
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
  @media (max-width: 760px) { .body { grid-template-columns: 1fr; grid-template-rows: 46vh 1fr; } }
</style>
