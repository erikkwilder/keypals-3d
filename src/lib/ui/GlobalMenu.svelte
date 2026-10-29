<script lang="ts">
  // The menu that goes anywhere in the game, opened from the compass on every screen. It's also the
  // scorecard: every place has its own picture and a line of what you've done there, and the strip at
  // the top adds up the big things. Three groups: Learn and practice, Play, My stuff; then Home, the
  // player, Grown-ups, Settings and where your progress is saved.
  import { onDestroy, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { ALL_LESSONS } from '../engine/course';
  import { bookView, outfitOf, palOf, passed, totalStars } from '../engine/profile';
  import { STICKERS, levelFromXp } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { teamBuddies } from '../engine/team';
  import { GLIMMERS } from '../adventure/glimmers';
  import { advView, teamOf, playLeft } from '../adventure/state';
  import { seasonView } from '../adventure/versus';
  import { LEAGUES } from '../adventure/ghosts';
  import { WORLD_PIN, lastWorld } from '../adventure/worlds';
  import { CATALOG, ownsItem } from '../adventure/wardrobe';
  import { mathOf, mathStarsTotal, ALL_GARDEN_IDS, stageCounts } from '../math/progress';
  import { MATH_LESSONS } from '../math/course';
  import { LESSONS as TRICKS } from '../math/learn';
  import { arcadeOf, arcadeStars } from '../arcade/arcade';
  import { dropOf } from '../drop/save';
  import { FRIEND } from '../art/cast';
  import Critter from './Critter.svelte';
  import SaveChip from './SaveChip.svelte';
  import { cloud, goSaveOnline } from '../state/cloud.svelte';
  import CloseButton from './CloseButton.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const m = $derived(mathOf(p));
  const pal = $derived(palOf(p));
  const lvl = $derived(levelFromXp(pal.xp));
  const book = $derived(bookView(p));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

  // what you've done, place by place
  const course = ALL_LESSONS.filter(l => !l.practice);
  const typingDone = $derived(course.filter(l => passed(p, l.id)).length);
  const typingStars = $derived(totalStars(p));
  const mathStars = $derived(mathStarsTotal(m));
  const mathDone = $derived(Object.values(m.lessons).filter(r => r.stars > 0).length);
  const tricks = $derived((m.learned ?? []).length);
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const playStars = $derived(Object.values(m.play ?? {}).reduce((t, r) => t + (r?.stars ?? []).reduce((x, y) => x + (y ?? 0), 0), 0));
  const arcStars = $derived(arcadeStars(p));
  const arcBest = $derived(Math.max(0, ...Object.values(arcadeOf(p)).map(r => r?.best ?? 0)));
  const found = $derived(Object.keys(a.glimmers).length);
  const world = $derived(WORLD_PIN[lastWorld.id]?.name ?? 'Sky Islands');
  const versus = $derived(a.settings.versus !== false);
  const duels = $derived(a.duels ?? { played: 0, won: 0 });
  const league = $derived(LEAGUES[seasonView(p).league]?.name ?? LEAGUES[0].name);
  const drop = $derived(dropOf(p));
  const play = $derived(playLeft(p));
  const playText = $derived(!play.open ? 'Play time is used up for today' : play.left === null ? 'Play any time' : `${Math.max(0, Math.floor(play.left))} min of play time left`);
  const buddies = $derived(teamBuddies(p).length);
  const owned = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
  const dancesOpen = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);
  const stickers = $derived(STICKERS.filter(s => book.stickers[s.id]).length);
  const medals = $derived(MEDALS.filter(md => (book.medals[md.id] ?? 0) > 0).length);
  const eggsReady = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const eggsAll = $derived(a.incubator.filter(e => e).length + a.nest.length);
  const team = $derived(teamOf(a));
  const allStars = $derived(typingStars + mathStars + playStars + arcStars);

  type Tile = { id: string; name: string; line: string; img?: string; buddy?: boolean; face?: string; hot?: boolean; go: () => void };
  const learn = $derived<Tile[]>([
    { id: 'typing', name: 'Typing', img: 'game/icon-typing.webp', line: `${typingStars} stars · ${typingDone}/${course.length} lessons`, go: () => { game.setHome('typing'); game.go('map'); } },
    { id: 'math', name: 'Math', img: 'game/icon-math.webp', line: `${mathStars} stars · ${mathDone}/${MATH_LESSONS.length} trips`, go: () => { game.setHome('math'); game.mathOp = null; game.mathArea = null; game.go('map'); } },
    { id: 'learn', name: 'Learn', img: 'icons/book.webp', line: `${tricks} of ${TRICKS.length} tricks learned`, go: () => game.openLearn(null, game.screen === 'learn' ? 'hub' : game.screen) },
    { id: 'garden', name: 'Fact Garden', img: 'icons/garden.webp', line: `${blooms} flowers in bloom`, go: () => { game.setHome('math'); game.go('garden'); } },
    { id: 'playground', name: 'Playground', img: 'icons/line.webp', line: playStars ? `${playStars} stars` : 'Number games, no clock', go: () => { game.setHome('math'); game.go('playground'); } },
  ]);
  const playTiles = $derived<Tile[]>([
    { id: 'arcade', name: 'Arcade', img: 'icons/arcade.webp', line: arcBest ? `${arcStars} stars · best ${fmt(arcBest)}` : 'Quick score games', go: () => game.go('arcade') },
    { id: 'adventure', name: 'Adventure', img: 'game/icon-grump.webp', line: `${found}/${GLIMMERS.length} Glimmers · ${world}`, go: () => game.go('adventure') },
    { id: 'drop', name: 'Glimmer Drop', img: 'drop/tile.webp', line: drop.best ? `Best ${fmt(drop.best)} · uses play time` : 'Just for fun · uses play time', go: () => game.go('drop') },
    ...(versus ? [
      { id: 'duel', name: 'Family Duel', img: 'game/tile-duel.webp', line: duels.played ? `${duels.won} won of ${duels.played}` : 'Two players, one screen', go: () => { game.duelMode = 'duel'; game.duelRival = null; game.duelKey++; game.go('duel'); } },
      { id: 'rivals', name: 'Rival Ghosts', img: 'game/tile-rivals.webp', line: league, go: () => game.go('rivals') },
    ] : []),
  ]);
  const stuff = $derived<Tile[]>([
    { id: 'closet', name: 'Keypals and Wardrobe', buddy: true, line: `${buddies} buddies · ${owned} things to wear`, go: () => game.openCloset('outfits') },
    { id: 'shop', name: 'Shop', img: 'game/icon-shell.webp', line: `${fmt(a.shells)} shells to spend`, go: () => game.openShop() },
    { id: 'dances', name: 'Dances', img: 'game/icon-dances.webp', line: `${dancesOpen} for ${FRIEND[p.buddy].name}`, go: () => game.openCloset('dances') },
    { id: 'stickers', name: 'Stickers', img: 'game/icon-stickers.webp', line: `${stickers} of ${STICKERS.length}`, go: () => game.openStickers('stickers') },
    { id: 'medals', name: 'Medals', img: 'game/icon-medals.webp', line: `${medals} of ${MEDALS.length} kinds won`, go: () => game.openStickers('medals') },
    { id: 'eggs', name: 'Eggs', img: `game/egg-${a.incubator.find(e => e)?.rarity ?? 'rare'}.webp`, line: eggsReady ? `${eggsReady} ready to hatch!` : eggsAll ? `${eggsAll} warming up` : 'Practice hatches eggs', hot: eggsReady > 0, go: () => game.go('eggs') },
    { id: 'team', name: 'Glimmers and Team', face: team[0] ? `game/glimmers/face/${team[0].id}${team[0].evolved ? '-evo' : ''}.webp` : 'game/glimmers/face/puddlepup.webp', line: team.length ? `${team.length} on your team · ${found} found` : `${found} found`, go: () => game.go('glimmers') },
  ]);
  const groups = $derived([
    { title: 'Learn and practice', tone: 'learn', tiles: learn },
    { title: 'Play', tone: 'play', tiles: playTiles },
    { title: 'My stuff', tone: 'stuff', tiles: stuff },
  ]);

  function go(t: Tile) { sfx.click(); game.closeMenu(); t.go(); }
  function close() { sfx.click(); game.closeMenu(); }
  function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } }
  onMount(() => { sfx.pop(); window.addEventListener('keydown', onKey, true); });
  onDestroy(() => window.removeEventListener('keydown', onKey, true));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="gm" transition:fade={{ duration: 160 }} onclick={close}>
  <div class="panel" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Menu: go anywhere" tabindex="-1">
    <header class="top">
      <img class="cmp" src="{base}icons/menu.webp" alt="" />
      <div class="tt"><h2>Go anywhere</h2><span>Everything in Keypals, and everything you've done</span></div>
      <CloseButton onclick={close} label="Close the menu" size={44} />
    </header>

    <!-- the scorecard: the big things, added up -->
    <div class="score">
      <span><img src="{base}game/icon-star.webp" alt="" /><b>{fmt(allStars)}</b> stars</span>
      <span><img src="{base}icons/garden.webp" alt="" /><b>{blooms}</b> in bloom</span>
      <span><img class="round" src="{base}game/glimmers/face/puddlepup.webp" alt="" /><b>{found}</b>/{GLIMMERS.length} Glimmers</span>
      <span><img src="{base}game/icon-stickers.webp" alt="" /><b>{stickers}</b>/{STICKERS.length} stickers</span>
      <span><img src="{base}game/icon-shell.webp" alt="" /><b>{fmt(a.shells)}</b> shells</span>
      <span><img src="{base}icons/heart.webp" alt="" />Friendship <b>{lvl.level}</b></span>
    </div>

    <div class="groups">
      {#each groups as g (g.title)}
        <section class="grp {g.tone}">
          <h3>{g.title}</h3>
          <div class="tiles">
            {#each g.tiles as t (t.id)}
              <button class="tile" class:here={game.screen === t.id || (t.id === 'closet' && game.screen === 'closet')} class:hot={t.hot} onclick={() => go(t)}>
                <span class="pic">
                  {#if t.buddy}<Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={56} round />
                  {:else if t.face}<img class="round" src="{base}{t.face}" alt="" />
                  {:else}<img src="{base}{t.img}" alt="" />{/if}
                </span>
                <span class="txt"><b>{t.name}</b><small>{t.line}</small></span>
              </button>
            {/each}
          </div>
          {#if g.tone === 'play'}<p class="note">{playText}. Practice earns more.</p>{/if}
        </section>
      {/each}
    </div>

    <footer class="bottom">
      <button class="small" onclick={() => { sfx.click(); game.closeMenu(); game.go('hub'); }}><img src="{base}game/icon-home.webp" alt="" /><span>Home</span></button>
      <button class="small" onclick={() => { sfx.click(); game.closeMenu(); game.go('players'); }}><Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={34} round /><span>{p.name}: switch player</span></button>
      <button class="small" onclick={() => { sfx.click(); game.closeMenu(); game.go('grownups'); }}><img src="{base}icons/grownups.webp" alt="" /><span>Grown-ups</span></button>
      <button class="small" onclick={() => { sfx.click(); game.closeMenu(); game.openSettings(); }}><img src="{base}game/icon-settings.webp" alt="" /><span>Settings</span></button>
      {#if cloud.online && !cloud.account && (cloud.google || cloud.microsoft)}<button class="small" onclick={() => { sfx.click(); game.closeMenu(); goSaveOnline(); }}><img src="{base}icons/cloud-save.webp" alt="" /><span>{cloud.signedOut ? 'Signed out: sign in again' : 'Grown-ups: sign in'}</span></button>{/if}
      <span class="save"><SaveChip /></span>
    </footer>
  </div>
</div>

<style>
  .gm { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 14px; background: rgba(36, 24, 70, .45); backdrop-filter: blur(6px); }
  .panel { width: min(1180px, 100%); max-height: 100%; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px 20px 18px; border-radius: 28px;
    background: linear-gradient(rgba(255, 255, 255, .97), rgba(250, 247, 255, .97)); box-shadow: 0 30px 70px -30px rgba(30, 10, 70, .7), 0 0 0 4px #fff; }
  .top { display: flex; align-items: center; gap: 12px; }
  .cmp { width: 56px; height: 56px; object-fit: contain; flex: none; filter: drop-shadow(0 4px 4px rgba(60, 30, 90, .25)); }
  .tt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .tt h2 { margin: 0; font-size: 30px; line-height: 1.05; }
  .tt span { font: 700 14px var(--font-body); color: var(--muted); }

  .score { display: flex; flex-wrap: wrap; gap: 8px; }
  .score span { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 5px; border-radius: 999px; background: #fff8e6; box-shadow: inset 0 0 0 2px #ffe7ad; font: 700 14px var(--font-body); color: var(--ink2); }
  .score b { font: 600 18px var(--font-ui); color: var(--ink); }
  .score img { width: 28px; height: 28px; object-fit: contain; }
  img.round { border-radius: 50%; object-fit: cover; }

  .groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grp { border-radius: 22px; padding: 10px 10px 8px; background: var(--g1); box-shadow: inset 0 0 0 2px var(--g2); display: flex; flex-direction: column; gap: 8px; }
  .grp.learn { --g1: #f2efff; --g2: #ddd3ff; --gt: #5b3fd0; }
  .grp.play { --g1: #ecfaf2; --g2: #c4ecd6; --gt: #1f7a50; }
  .grp.stuff { --g1: #fff4ec; --g2: #ffdcc3; --gt: #b25a1e; }
  .grp h3 { margin: 0 4px; font: 600 19px var(--font-ui); color: var(--gt); }
  .tiles { display: flex; flex-direction: column; gap: 6px; }
  .tile { display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; text-align: left; padding: 6px 10px 6px 6px; border-radius: 18px; background: #fff; box-shadow: 0 3px 0 var(--g2); transition: transform .12s; font: inherit; }
  .tile:hover, .tile:focus-visible { transform: translateY(-2px); box-shadow: 0 5px 0 var(--g2), 0 0 0 3px var(--g2); }
  .tile.here { box-shadow: 0 3px 0 var(--g2), 0 0 0 3px var(--gt); }
  .tile.hot .pic { animation: hot 1.4s ease-in-out infinite; }
  @keyframes hot { 50% { transform: scale(1.08) rotate(-4deg); } }
  .pic { width: 56px; height: 56px; flex: none; display: grid; place-items: center; }
  .pic img { width: 56px; height: 56px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 90, .2)); }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .txt b { font: 600 19px/1.15 var(--font-ui); color: var(--ink); }
  .txt small { font: 700 13px/1.25 var(--font-body); color: var(--muted); }
  .note { margin: 2px 4px 0; font: 700 12.5px var(--font-body); color: var(--gt); }

  .bottom { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding-top: 4px; border-top: 2px dashed #ece6f6; }
  .small { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 12px 4px 4px; border-radius: 999px; background: var(--bg2); font: 600 16px var(--font-ui); color: var(--ink); }
  .small img { width: 34px; height: 34px; object-fit: contain; }
  .small:hover { background: #ece6f9; }
  .save { margin-left: auto; min-width: 0; }

  @media (max-width: 900px) {
    .gm { padding: 0; place-items: stretch; }
    .panel { border-radius: 0; padding: 12px 12px 16px; box-shadow: none; }
    .groups { grid-template-columns: 1fr; }
    .tt h2 { font-size: 24px; } .tt span { font-size: 12.5px; }
    .cmp { width: 44px; height: 44px; }
    .score { gap: 5px; } .score span { font-size: 12.5px; padding: 3px 9px 3px 4px; } .score b { font-size: 15px; } .score img { width: 22px; height: 22px; }
    .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .tile { flex-direction: column; text-align: center; gap: 4px; padding: 8px 6px; }
    .txt { align-items: center; }
    .txt b { font-size: 16px; } .txt small { font-size: 12px; }
    .pic, .pic img { width: 48px; height: 48px; }
    .save { margin-left: 0; width: 100%; }
    .small { font-size: 14px; }
  }
</style>
