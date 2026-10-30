<script lang="ts">
  // Family Duel: who's playing. Two players from this device (or a guest: a grown-up or a friend), each
  // with math or typing at their own level, take turns on one screen. Rival Ghosts comes here too, with
  // the rival already picked, and goes straight to the arena.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { mulberry32 } from '../engine/rng';
  import { BUDDIES, FRIEND, type FriendId } from '../art/cast';
  import { GLIMMERS, type GlimmerId, type Rarity } from '../adventure/glimmers';
  import { advView, markSeen } from '../adventure/state';
  import { GUEST_LEVELS, type GuestLevel, type SideSetup } from '../adventure/duel';
  import { guestSide, rivalSide, sideOf } from '../adventure/versus';
  import type { Subject } from '../adventure/battle';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import DuelPlay from './DuelPlay.svelte';
  import { DuelScene } from '../three/duelScene';
  import { DUEL_CARD } from '../adventure/duel';

  const base = import.meta.env.BASE_URL;
  const backdrop = new URL(`${base}game/intro-duel.webp`, document.baseURI).href;
  const me = game.profile!;
  const mode = game.duelMode;
  const rival = game.duelRival;
  const SIDE = ['#3d9cf0', '#f0675a'];
  // the New badge on the Duel tile goes once you've been here
  if (!advView(me).seen?.includes('duel1')) game.update(pp => markSeen(pp, 'duel1'));
  // build the arena while the players choose, so the duel opens straight away
  DuelScene.warm('treetops');

  /** The Glimmer in the middle: any that isn't a Champion, rarer ones less often. */
  function rollGlimmer(seed: number): GlimmerId {
    const r = mulberry32(seed);
    const odds: [Rarity, number][] = [['common', 42], ['uncommon', 30], ['rare', 18], ['epic', 8], ['legendary', 2]];
    let x = r() * 100, rar: Rarity = 'common';
    for (const [k, w] of odds) { x -= w; if (x < 0) { rar = k; break; } }
    const list = GLIMMERS.filter(g => !g.champion && g.rarity === rar);
    const from = list.length ? list : GLIMMERS.filter(g => !g.champion);
    return from[Math.floor(r() * from.length)].id as GlimmerId;
  }

  // ---------- who's playing ----------
  type Who = { kind: 'player'; id: string } | { kind: 'guest'; name: 'Grown-up' | 'Friend' };
  const others = game.save.profiles.filter(p => p.id !== me.id);
  let who = $state<[Who, Who]>([{ kind: 'player', id: me.id }, others[0] ? { kind: 'player', id: others[0].id } : { kind: 'guest', name: 'Grown-up' }]);
  let subj = $state<[Subject, Subject]>([advView(me).subject, others[0] ? advView(others[0]).subject : 'math']);
  let level = $state<[GuestLevel, GuestLevel]>(['grown', 'grown']);
  let guestBuddy = $state<[FriendId, FriendId]>(['turtle', 'koala']);
  const starters = BUDDIES.slice(0, 6);
  const same = $derived(who[0].kind === 'player' && who[1].kind === 'player' && who[0].id === who[1].id);
  function choose(i: 0 | 1, w: Who) {
    who[i] = w; sfx.click();
    if (w.kind === 'player') { const p = game.save.profiles.find(x => x.id === w.id); if (p) subj[i] = advView(p).subject; }
    // a grown-up starts on grown-up questions, a friend on adding
    else level[i] = w.name === 'Grown-up' ? 'grown' : 'plus';
  }
  const isWho = (i: number, w: Who) => who[i].kind === w.kind && (w.kind === 'player' ? (who[i] as { id: string }).id === w.id : (who[i] as { name: string }).name === w.name);

  function sideFor(i: 0 | 1): SideSetup {
    const w = who[i];
    if (w.kind === 'player') { const p = game.save.profiles.find(x => x.id === w.id)!; return sideOf(p, subj[i]); }
    return guestSide(w.name, guestBuddy[i], level[i], subj[i]);
  }

  // ---------- playing ----------
  let sides = $state<[SideSetup, SideSetup] | null>(null);
  let glimmer = $state<GlimmerId>(rollGlimmer(Date.now() % 1e9));
  let key = $state(0);
  // players take it in turns to go first, game by game (a ghost always lets you go first)
  let first = $state<0 | 1>(0);
  if (mode === 'rival' && rival) sides = [sideOf(me), rivalSide(rival, me, game.save.profiles)];
  function start() {
    if (same) return;
    sfx.whoosh();
    sides = [sideFor(0), sideFor(1)];
    glimmer = rollGlimmer(Date.now() % 1e9);
    key++;
  }
  function again() {
    // the same players again (their teams and levels may have changed), with a new Glimmer
    if (mode === 'rival' && rival) sides = [sideOf(game.profile!), rivalSide(rival, game.profile!, game.save.profiles)];
    else { sides = [sideFor(0), sideFor(1)]; first = (1 - first) as 0 | 1; }
    glimmer = rollGlimmer(Date.now() % 1e9);
    key++;
  }
  /** out of a duel: back to who's playing (a Rival Ghosts battle: back to the rivals) */
  function exit() {
    if (mode === 'rival') { game.go('rivals'); return; }
    if (sides) { sides = null; return; }
    game.back();
  }
</script>

{#if sides}
  {#key key}<DuelPlay {sides} {glimmer} {mode} {rival} {first} onagain={again} onexit={exit} />{/key}
{:else}
  <div class="setup" style:background-image="url({backdrop})">
    <Header />
    <div class="body">
      <div class="intro card">
        <img src="{base}game/intro-duel.webp" alt="" />
        <div>
          <h2>Who can cheer up the grumpy Glimmer first?</h2>
          <ul>
            <li><b>Take turns:</b> pick a card, it flips over, answer what's on it.</li>
            <li><b>Fair for everyone:</b> your own questions, and every right answer is +{DUEL_CARD}, little sums or big times tables.</li>
            <li><b>Right in a row</b> wins it, and your team of Glimmers helps. The winner gets the Glimmer!</li>
          </ul>
        </div>
      </div>
      <div class="cols">
        {#each [0, 1] as i (i)}
          {@const ii = i as 0 | 1}
          <div class="col card" style:--sc={SIDE[i]}>
            <h3><span class="dot"></span>Player {i + 1}</h3>
            <div class="chips">
              {#each game.save.profiles as p (p.id)}
                <button class="chip" class:on={isWho(i, { kind: 'player', id: p.id })} class:taken={who[1 - i].kind === 'player' && (who[1 - i] as { id: string }).id === p.id} onclick={() => choose(ii, { kind: 'player', id: p.id })}>
                  <Critter friend={p.buddy} size={44} round /><b>{p.name}</b>
                </button>
              {/each}
              {#each ['Grown-up', 'Friend'] as const as nm}
                <button class="chip guest" class:on={isWho(i, { kind: 'guest', name: nm })} onclick={() => choose(ii, { kind: 'guest', name: nm })}>
                  <Critter friend={guestBuddy[i]} size={44} round /><b>{nm}</b>
                </button>
              {/each}
            </div>
            <div class="subj">
              <button class:on={subj[i] === 'math'} onclick={() => { subj[ii] = 'math'; sfx.click(); }}><span class="pic">3 + 4</span>Math</button>
              <button class:on={subj[i] === 'typing'} onclick={() => { subj[ii] = 'typing'; sfx.click(); }}><span class="pic">abc</span>Typing</button>
            </div>
            {#if who[i].kind === 'guest'}
              <p class="lab">How hard?</p>
              <div class="levels">
                {#each GUEST_LEVELS as l (l.id)}
                  <button class:on={level[i] === l.id} onclick={() => { level[ii] = l.id; sfx.click(); }}><span class="pic">{subj[i] === 'math' ? l.math : l.typing}</span>{l.name}</button>
                {/each}
              </div>
              <p class="lab">Buddy</p>
              <div class="buddies">
                {#each starters as bd (bd.id)}<button class:on={guestBuddy[i] === bd.id} onclick={() => { guestBuddy[ii] = bd.id; sfx.click(); }} aria-label={FRIEND[bd.id].name}><Critter friend={bd.id} size={40} round /></button>{/each}
              </div>
            {:else}
              <p class="note">Questions come from {game.save.profiles.find(p => p.id === (who[i] as { id: string }).id)?.name}'s own practice, with their Glimmers and outfit powers.</p>
            {/if}
          </div>
        {/each}
      </div>
      <div class="go">
        {#if same}<p class="warn">Pick two different players.</p>{/if}
        <button class="btn btn-primary big" disabled={same} onclick={start}>Start the duel!</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .setup { position: fixed; inset: 0; display: flex; flex-direction: column; background-size: cover; background-position: center; }
  .setup::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(14px) brightness(1.05); background: rgba(255, 250, 255, .35); }
  .setup > :global(*) { position: relative; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; align-items: center; }
  .intro { width: min(1100px, 100%); display: flex; gap: 18px; align-items: center; padding: 12px; }
  .intro img { width: 300px; aspect-ratio: 3 / 2; object-fit: cover; border-radius: 18px; flex: none; }
  .intro h2 { margin: 0 0 6px; font-size: 26px; }
  .intro ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
  .intro li { font: 600 16px/1.35 var(--font-body); color: var(--ink2); }
  .cols { width: min(1100px, 100%); display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .col { padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 0 0 3px var(--sc), var(--shadow-sm); }
  .col h3 { margin: 0; font-size: 22px; display: flex; align-items: center; gap: 8px; }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--sc); }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { display: flex; align-items: center; gap: 8px; border: 0; cursor: pointer; background: #f4f2fb; border-radius: 999px; padding: 3px 14px 3px 3px; font: inherit; box-shadow: inset 0 0 0 2px #e4def3; }
  .chip b { font: 600 16px var(--font-ui); color: var(--ink); }
  .chip.on { background: #fff; box-shadow: 0 0 0 3px var(--sc), var(--shadow-sm); }
  .chip.taken:not(.on) { opacity: .45; }
  .chip.guest b { color: var(--ink2); }
  .subj, .levels { display: flex; gap: 8px; flex-wrap: wrap; }
  .subj button, .levels button { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; cursor: pointer; border-radius: 18px; padding: 8px 14px; background: #f4f2fb; font: 700 14px var(--font-body); color: var(--ink2); box-shadow: inset 0 0 0 2px #e4def3; min-width: 92px; }
  .subj button.on, .levels button.on { background: #fff; color: var(--ink); box-shadow: 0 0 0 3px var(--sc), var(--shadow-sm); }
  .pic { font: 600 22px var(--font-ui); color: var(--ink); background: linear-gradient(160deg, #fff6c4, #ffd36b); border-radius: 12px; padding: 2px 10px; }
  .levels .pic { font-size: 18px; background: linear-gradient(160deg, #e2f4ff, #8fd0ff); }
  .lab { margin: 2px 0 0; font: 800 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .buddies { display: flex; gap: 6px; flex-wrap: wrap; }
  .buddies button { border: 0; background: none; padding: 2px; border-radius: 50%; cursor: pointer; }
  .buddies button.on { box-shadow: 0 0 0 3px var(--sc); }
  .note { margin: 0; font: 600 14px/1.4 var(--font-body); color: var(--muted); }
  .go { display: flex; flex-direction: column; align-items: center; gap: 6px; padding-bottom: 10px; }
  .big { font-size: 24px; padding: 14px 34px; }
  .warn { margin: 0; font: 700 15px var(--font-body); color: #b02a48; }
  @media (max-width: 760px) {
    .intro { flex-direction: column; text-align: left; }
    .intro img { width: 100%; }
    .intro h2 { font-size: 21px; }
    .cols { grid-template-columns: 1fr; }
  }
</style>
