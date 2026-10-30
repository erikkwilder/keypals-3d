<script lang="ts">
  // Rival Ghosts: today's three rivals (your family's ghosts first, then you last week, then island
  // rivals the game makes up), your league and this week's points, and news of who played your ghost.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { FRIEND } from '../art/cast';
  import { GLIMMER } from '../adventure/glimmers';
  import { advView, markSeen } from '../adventure/state';
  import { daysLeft, LEAGUES, nickname, playsLike, rivalsFor, UP_AT, type Rival } from '../adventure/ghosts';
  import { ghostCopyOf, season, seasonView } from '../adventure/versus';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Coach from '../ui/Coach.svelte';
  import Icon from '../ui/Icon.svelte';
  import { DuelScene } from '../three/duelScene';
  // build the arena while you choose a rival, so the game opens straight away
  DuelScene.warm('treetops');

  const base = import.meta.env.BASE_URL;
  const backdrop = new URL(`${base}game/intro-rivals.webp`, document.baseURI).href;
  // a new week rolls over when you come in (and the news is shown once)
  let news = $state<{ at: number; who: string; buddy: import('../art/cast').FriendId; youWon: boolean }[]>([]);
  let promoted = $state<number | null>(null);
  onMount(() => {
    game.update(p => {
      const s = season(p);
      news = s.inbox.slice(); s.inbox = [];
      if (s.promoted !== undefined) { promoted = s.promoted; delete s.promoted; }
    });
    if (!seen.has('rivals1')) setTimeout(() => (coach = { text: 'A ghost plays the way its player really plays. Beat a rival to win its Glimmer and league points!', at: '.rivals' }), 600);
  });
  const p = $derived(game.profile!);
  const s = $derived(seasonView(p));
  const rivals = $derived(rivalsFor(p, game.save.profiles, s, ghostCopyOf));
  const league = $derived(LEAGUES[s.league]);
  const nextL = $derived(LEAGUES[s.league + 1]);
  const seen = new Set(advView(game.profile!).seen ?? []);
  let coach = $state<{ text: string; at: string } | null>(null);
  let howOpen = $state(false);
  const TAG: Record<Rival['kind'], string> = { family: 'Family', past: 'You, last week', island: 'Island rival (made by the game)' };

  function battle(r: Rival) {
    sfx.whoosh();
    game.update(pp => markSeen(pp, 'rivals1'));
    game.duelMode = 'rival'; game.duelRival = r; game.duelKey++;
    game.go('duel');
  }
  function newName() { game.update(pp => { const ss = season(pp); ss.nick = nickname(Date.now() % 1e9); }); sfx.pop(); }
</script>

<div class="rv" style:background-image="url({backdrop})">
  <Header />
  <div class="body">
    <div class="season card" style:--lc={league.color}>
      <img class="badge" src="{base}game/league-{s.league}.webp" alt="" />
      <div class="sinfo">
        <small>You are</small>
        <div class="nick"><b>{s.nick}</b><button class="linky" onclick={newName}>New name</button></div>
        <div class="lname">{league.name}</div>
        {#if nextL}
          <div class="bar"><i style:width="{Math.min(100, (s.points / UP_AT) * 100)}%"></i></div>
          <p class="pts"><b>{s.points}</b> of {UP_AT} points this week to reach <img src="{base}game/league-{s.league + 1}.webp" alt="" /> <b>{nextL.name}</b> · {daysLeft()} day{daysLeft() === 1 ? '' : 's'} left</p>
        {:else}
          <p class="pts">The top league! <b>{s.points}</b> points this week.</p>
        {/if}
      </div>
      <button class="how" onclick={() => { howOpen = true; sfx.pop(); }}>How it works</button>
    </div>

    {#if promoted !== null}
      <div class="promo card"><img src="{base}game/league-{promoted}.webp" alt="" /><div><b>You moved up to the {LEAGUES[promoted].name}!</b><p>Great week. Your new rivals are a little tougher.</p></div></div>
    {/if}
    {#each news as n (n.at)}
      <div class="news card"><Critter friend={n.buddy} size={40} round /><p><b>{n.who}</b> played your ghost{n.youWon ? ' and your ghost won!' : '. They won this time!'}</p></div>
    {/each}

    <h3 class="title">Your rivals today</h3>
    <div class="rivals">
      {#each rivals as r (r.id)}
        {@const beat = s.beaten.includes(r.id)}
        <div class="rcard card" class:fam={r.kind === 'family'}>
          <span class="tag">{TAG[r.kind]}</span>
          <div class="ghost"><Critter friend={r.buddy} size={124} /></div>
          <h4>{r.name}{r.kind === 'family' ? "'s ghost" : ''}</h4>
          <div class="lg"><img src="{base}game/league-{r.league}.webp" alt="" />{LEAGUES[r.league].name}</div>
          <div class="team">{#each r.team as m (m.id)}<span title={GLIMMER[m.id].name}><img src="{base}game/glimmers/face/{m.id}{m.evolved ? '-evo' : ''}.webp" alt="" /><small>{GLIMMER[m.id].name}</small></span>{:else}<small class="none">No Glimmers yet</small>{/each}</div>
          <div class="likes">{#each playsLike(r.stats) as w}<span>{w}</span>{/each}</div>
          <button class="btn" onclick={() => battle(r)}>{beat ? 'Battle again' : 'Battle!'}</button>
          {#if beat}<span class="beat"><Icon name="check" size={16} /> Beaten this week</span>{/if}
        </div>
      {/each}
    </div>
    <p class="foot">Ghosts stay on this device: no chat, no names but nicknames. {FRIEND[p.buddy].name} and your team play for your ghost when others battle it.</p>
  </div>

  {#if howOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="helpbg" onclick={() => (howOpen = false)}>
      <div class="helpcard card" onclick={(e) => e.stopPropagation()}>
        <h2>How Rival Ghosts works</h2>
        <div class="hrows">
          <div class="hr"><div class="mini"><span class="gh"><Critter friend="cheetah" size={52} round /></span></div><p><b>A ghost</b> plays the way its player really plays.</p></div>
          <div class="hr"><div class="mini"><span class="mbar"><i><em></em></i></span></div><p><b>Fill your bar first</b> to win the Glimmer.</p></div>
          <div class="hr"><div class="mini"><span class="pt">+3</span></div><p><b>A win is 3 points</b> (once a week for each rival). Playing is 1.</p></div>
          <div class="hr"><div class="mini"><span class="lgs">{#each [0, 1, 2] as k}<img src="{base}game/league-{k}.webp" alt="" />{/each}</span></div><p><b>{UP_AT} points in a week</b> moves you up a league.</p></div>
          <div class="hr"><div class="mini"><span class="cal">7</span></div><p><b>Every Monday</b> the points start again.</p></div>
          <div class="hr"><div class="mini"><Critter friend={p.buddy} size={52} round /></div><p><b>Your ghost</b> plays for you when family battle it.</p></div>
        </div>
        <button class="btn btn-primary" onclick={() => (howOpen = false)}>Got it</button>
      </div>
    </div>
  {/if}
  {#if coach}<Coach text={coach.text} at={coach.at} button="Got it" onok={() => { coach = null; game.update(pp => markSeen(pp, 'rivals1')); }} />{/if}
</div>

<style>
  .rv { position: fixed; inset: 0; display: flex; flex-direction: column; background-size: cover; background-position: center; }
  .rv::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(12px) brightness(1.05); background: rgba(250, 248, 255, .3); }
  .rv > :global(*) { position: relative; }
  .body { flex: 1; min-height: 0; overflow: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
  .body > * { width: min(1100px, 100%); }
  .season { display: flex; align-items: center; gap: 16px; padding: 12px 18px; box-shadow: 0 0 0 3px var(--lc), var(--shadow-sm); }
  .badge { width: 104px; height: 104px; object-fit: contain; flex: none; filter: drop-shadow(0 6px 10px rgba(40, 20, 80, .3)); }
  .sinfo { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .sinfo small { font: 800 12px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .nick { display: flex; align-items: baseline; gap: 10px; }
  .nick b { font: 600 26px var(--font-ui); color: var(--ink); }
  .lname { font: 600 18px var(--font-ui); color: var(--lc); }
  .bar { height: 14px; border-radius: 999px; background: #e9e5f4; overflow: hidden; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #ffd36b, #ff9f43); border-radius: 999px; }
  .pts { margin: 0; font: 600 15px/1.5 var(--font-body); color: var(--ink2); }
  .pts img { width: 24px; height: 24px; object-fit: contain; vertical-align: -6px; }
  .how, .linky { border: 0; background: none; cursor: pointer; font: 700 14px var(--font-body); color: var(--primary); text-decoration: underline; }
  .how { align-self: flex-start; background: #fff; border-radius: 999px; padding: 6px 14px; text-decoration: none; box-shadow: 0 0 0 2px #e4def3; }
  .promo, .news { display: flex; align-items: center; gap: 12px; padding: 10px 14px; }
  .promo { background: linear-gradient(90deg, #fff4c2, #fff); box-shadow: 0 0 0 3px #ffd36b; }
  .promo img { width: 64px; height: 64px; object-fit: contain; }
  .promo b { font: 600 20px var(--font-ui); } .promo p, .news p { margin: 2px 0 0; font: 600 15px var(--font-body); color: var(--ink2); }
  .title { margin: 4px 0 0; font-size: 22px; color: var(--ink); text-shadow: 0 1px 0 #fff; }
  .rivals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .rcard { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 30px 12px 14px; text-align: center; background: linear-gradient(#f4faff, #ffffff 60%); }
  .rcard.fam { box-shadow: 0 0 0 3px #8fc8ff, var(--shadow-sm); }
  .tag { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font: 800 11px var(--font-body); color: #fff; background: #5aa9f0; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .fam .tag { background: #3d9cf0; }
  /* a ghost: one soft blue, see-through, glowing */
  .ghost { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(165deg) saturate(2.4) drop-shadow(0 0 14px rgba(110, 180, 255, .95)); opacity: .82; animation: float 3s ease-in-out infinite; }
  @keyframes float { 50% { translate: 0 -6px; } }
  .rcard h4 { margin: 0; font: 600 21px var(--font-ui); color: var(--ink); }
  .lg { display: flex; align-items: center; gap: 4px; font: 700 13px var(--font-body); color: var(--muted); }
  .lg img { width: 22px; height: 22px; object-fit: contain; }
  .team { display: flex; gap: 10px; justify-content: center; min-height: 58px; }
  .team span { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .team img { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 2px #cfe6ff; }
  .team small { font: 700 11px var(--font-body); color: var(--ink2); }
  .none { font: 700 12px var(--font-body); color: var(--muted); align-self: center; }
  .likes { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
  .likes span { font: 700 12px var(--font-body); color: #1f5f9c; background: #e6f2ff; padding: 3px 9px; border-radius: 999px; }
  .beat { font: 700 13px var(--font-body); color: #1f9a6a; }
  .foot { margin: 0; font: 600 13px/1.4 var(--font-body); color: var(--ink2); text-align: center; background: rgba(255, 255, 255, .7); border-radius: 14px; padding: 6px 12px; }
  .helpbg { position: fixed; inset: 0; z-index: 30; background: rgba(40, 28, 70, .4); display: grid; place-items: center; }
  .helpcard { width: min(680px, 94vw); max-height: 88vh; overflow: auto; padding: 18px 24px; display: flex; flex-direction: column; gap: 8px; }
  .helpcard h2 { margin: 0; } .helpcard .btn { align-self: flex-end; }
  .hrows { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .hr { display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; background: #faf8fe; border-radius: 16px; padding: 12px 10px; }
  .hr p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink2); }
  .hr p b { display: block; color: var(--ink); font-size: 16px; }
  .mini { width: 100%; height: 64px; display: grid; place-items: center; }
  .gh { filter: grayscale(1) brightness(1.2) sepia(1) hue-rotate(165deg) saturate(2.4) drop-shadow(0 0 10px rgba(110, 180, 255, .95)); opacity: .85; }
  .mbar { background: #fff; border-radius: 999px; padding: 4px; box-shadow: var(--shadow-sm); }
  .mbar i { display: block; width: 110px; height: 12px; border-radius: 999px; background: #e6e2f2; overflow: hidden; }
  .mbar em { display: block; width: 70%; height: 100%; background: linear-gradient(90deg, #8cc8ff, #3d9cf0); }
  .pt { font: 600 34px var(--font-ui); color: #e08a00; }
  .lgs { display: flex; } .lgs img { width: 40px; height: 40px; object-fit: contain; margin: 0 -4px; }
  .cal { width: 46px; height: 50px; border-radius: 10px; background: #fff; box-shadow: inset 0 10px 0 #ff7a6b, var(--shadow-sm); display: grid; place-items: center; padding-top: 10px; font: 600 24px var(--font-ui); color: var(--ink); }
  @media (max-width: 760px) {
    .rivals { grid-template-columns: 1fr; }
    .season { flex-wrap: wrap; gap: 10px; padding: 10px 12px; }
    .badge { width: 72px; height: 72px; }
    .sinfo { flex: 1 1 calc(100% - 90px); }
    .how { order: 3; align-self: center; margin-left: 82px; }
    .nick b { font-size: 21px; }
    .hrows { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rcard { padding-top: 28px; }
  }
</style>
