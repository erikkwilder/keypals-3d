<script lang="ts">
  // Home: the first thing you see, and the place every game comes back to. Four doors, all alike: Typing
  // and Math (practice, each with its own trail), the Arcade (quick score games, and Glimmer Drop) and
  // Adventure (battles and Glimmers); above them, what all games share: your buddy's friendship, today's
  // minutes, stickers, medals and dances, and the compass that goes anywhere. Where your progress is
  // saved shows by the hello, and if a grown-up's sign-in ran out, a banner says so.
  import { game } from '../state/game.svelte';
  import { ALL_LESSONS, REGION, lessonTitle } from '../engine/course';
  import { bookView, nextLesson, outfitOf, palOf, passed, todayMs, totalStars } from '../engine/profile';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { levelFromXp, STICKERS } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { GLIMMERS } from '../adventure/glimmers';
  import { FRIEND } from '../art/cast';
  import { sfx } from '../audio/sound';
  import { MATH_LESSONS, MATH_REGION, STRAND, worldOf } from '../math/course';
  import { ALL_GARDEN_IDS, mathOf, mathStarsTotal, nextMathLesson, stageCounts } from '../math/progress';
  import { advView, markSeen } from '../adventure/state';
  import { ARCADE, arcadeOf, arcadeStars, dailyGame } from '../arcade/arcade';
  import { dropOf } from '../drop/save';
  import { WORLD_PIN, lastWorld } from '../adventure/worlds';
  import { cloud, goSaveOnline, staySignedOut } from '../state/cloud.svelte';
  import SaveChip from '../ui/SaveChip.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import MusicButton from '../ui/MusicButton.svelte';
  import MenuButton from '../ui/MenuButton.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import TileArt from '../ui/TileArt.svelte';
  import Stars from '../ui/Stars.svelte';
  import Ring from '../ui/Ring.svelte';
  import Icon from '../ui/Icon.svelte';

  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const pal = $derived(palOf(p));
  const lvl = $derived(levelFromXp(pal.xp));
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  let sw = $state(1280);
  const tsz = $derived(sw < 1560 ? 'sm' : 'md');
  const dancesOpen = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);

  // typing's door
  const tNext = $derived(nextLesson(p));
  const course = ALL_LESSONS.filter(l => !l.practice);
  const tDone = $derived(course.filter(l => passed(p, l.id)).length);
  const tStars = $derived(totalStars(p));
  const tBest = $derived(Math.round(Math.max(0, ...Object.values(p.lessons).map(r => r.bestWpm ?? 0))));
  const tFresh = $derived(tDone === 0);
  // math's door
  const m = $derived(mathOf(p));
  const mNext = $derived(nextMathLesson(m));
  const adv = $derived(advView(p));
  // how it all fits together: shown once, and from the ? button
  let guide = $state(!(advView(game.profile!).seen ?? []).includes('guide'));
  function closeGuide() { guide = false; game.update(pp => markSeen(pp, 'guide')); }
  const advFound = $derived(Object.keys(adv.glimmers).length);
  const advReady = $derived(adv.incubator.filter(e => e && e.have >= e.need).length);
  const mStars = $derived(mathStarsTotal(m));
  const mBloom = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const mGrow = $derived(ALL_GARDEN_IDS.filter(id => (m.facts[id]?.stage ?? 0) > 0).length);
  const mBest = $derived(Math.round(Math.max(0, ...Object.values(m.lessons).map(r => r.bestFpm ?? 0))));
  const mFresh = $derived(m.totals.trips === 0);
  const mPlace = $derived(`${STRAND[mNext.op].name}${mNext.region === 'start' ? '' : ' · ' + MATH_REGION[mNext.region].name}`);
  const mTrips = MATH_LESSONS.length;
  const mDone = $derived(Object.values(m.lessons).filter(r => r.stars > 0).length);
  // the Arcade's door
  const today0 = dailyGame();
  const aStars = $derived(arcadeStars(p));
  const aBest = $derived(Math.max(0, ...Object.values(arcadeOf(p)).map(r => r?.best ?? 0)));
  const aPlayed = $derived(Object.values(arcadeOf(p)).some(r => (r?.plays ?? 0) > 0));
  const dropBest = $derived(dropOf(p).best);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  // Adventure's door
  const worldName = $derived(WORLD_PIN[lastWorld.id]?.name ?? 'Sky Islands');

  function open(g: 'typing' | 'math') { sfx.click(); game.setHome(g); if (g === 'math') game.mathOp = null; game.go('map'); }
  function play(g: 'typing' | 'math') {
    sfx.click();
    game.setHome(g);
    // a first-time math player picks what kind of math first
    if (g === 'typing') game.startLesson(tNext.id); else if (mFresh) { game.mathOp = null; game.go('map'); } else game.startMath(mNext.id);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    const k = e.key.toLowerCase();
    if (k === 't' || k === '1') { e.preventDefault(); play('typing'); }
    if (k === 'm' || k === '2') { e.preventDefault(); play('math'); }
    if (k === 'g' || k === '3') { e.preventDefault(); sfx.click(); game.go('arcade'); }
    if (k === 'a' || k === '4') { e.preventDefault(); sfx.click(); game.go('adventure'); }
    if (e.key === 'Enter') { e.preventDefault(); play(game.homeGame); }
    if (e.key === 'Escape') game.go('players');
  }
  const hello = $derived(today === 0 ? `Hi ${p.name}! What shall we play today?` : today >= goalMs ? `Goal done for today, ${p.name}! Want to keep going?` : `Welcome back, ${p.name}! Pick a game.`);
</script>

<svelte:window onkeydown={onKey} />

<div class="screen hub" bind:clientWidth={sw}>
  <header class="bar">
    <button class="me" onclick={() => game.go('players')} title="Switch player">
      <Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={54} round />
      <span class="nm">{p.name}</span>
    </button>
    <div class="pill friend" title="Everything you play, typing or math, makes you better friends">
      <Icon name="heart" size={24} />
      <span class="ft"><b>{FRIEND[p.buddy].name} · Friendship {lvl.level}</b><i><em style:width="{(lvl.into / lvl.need) * 100}%"></em></i></span>
    </div>
    <div class="pill goal" title="Today's practice goal: typing and math both count">
      <Ring value={Math.min(1, today / goalMs)} size={32} color="var(--mint)" />
      <span><b>{Math.floor(today / 60000)}</b>/{p.settings.dailyGoalMin} min today</span>
    </div>
    <div class="pill shells" title="Shells: earned in practice and battles, spent in the Adventure shop">
      <img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><span><b>{adv.shells}</b> shells</span>
    </div>
    <button class="howbtn" onclick={() => { guide = true; sfx.pop(); }} title="How Keypals works"><Icon name="help" size={28} /></button>
    <div class="spacer"></div>
    <div class="tiles">
      <NavTile size={tsz} tone="pink" label="Keypals" title="Keypals: pick your buddy and outfits" onclick={() => game.openCloset('outfits')}>
        {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={tsz === 'sm' ? 36 : 58} round />{/snippet}
      </NavTile>
      <NavTile size={tsz} tone="mint" label="Shop" title="The Island Shop: things to wear for every buddy, eggs and treats" onclick={() => game.openShop()}>
        {#snippet art()}<img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" style:width="{tsz === 'sm' ? 34 : 54}px" style:height="{tsz === 'sm' ? 34 : 54}px" style:object-fit="contain" />{/snippet}
      </NavTile>
      <NavTile size={tsz} tone="lilac" kind="dances" label="Dances" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />
      <NavTile size={tsz} tone="butter" kind="stickers" label="Stickers" badge={STICKERS.filter(s => bookView(p).stickers[s.id]).length || ''} onclick={() => game.openStickers('stickers')} />
      <NavTile size={tsz} tone="sky" kind="medals" label="Medals" badge={MEDALS.filter(m => (bookView(p).medals[m.id] ?? 0) > 0).length || ''} onclick={() => game.openStickers('medals')} />
    </div>
    {#if sw >= 1560}<FancyAntButton variant="round" />{/if}
    <GearButton size={sw < 860 ? 36 : 44} music={sw >= 600} menu={sw >= 600} />
  </header>

  <div class="body scroll">
    <div class="hello">
      <div class="bud"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={96} mood="idle" /></div>
      <p>{hello}</p>
      <!-- on a phone the header has no room beside the gear: the music button sits by the hello -->
      {#if sw < 600}<span class="hmus"><MenuButton size={30} plain /><MusicButton size={30} plain /></span>{/if}
      {#if sw >= 860}<span class="hsave"><SaveChip /></span>{/if}
    </div>
    {#if sw < 860}<div class="hsave sm"><SaveChip compact={sw < 600} /></div>{/if}

    <!-- a grown-up's sign-in ran out on this computer: say so, so nobody thinks they're still saving -->
    {#if cloud.signedOut}
      <div class="signedout">
        <img src="{import.meta.env.BASE_URL}icons/cloud-save.webp" alt="" />
        <p><b>You were signed out.</b> Sign in again to keep saving online{cloud.signedOut.name ? ` as ${cloud.signedOut.name.split(' ')[0]}` : ''}. Progress is still kept on this computer.</p>
        <button class="btn btn-primary" onclick={() => { sfx.click(); goSaveOnline(); }}>Sign in again</button>
        <button class="btn ghost" onclick={() => { sfx.click(); staySignedOut(); }}>Stay signed out</button>
      </div>
    {/if}

    <div class="doors">
      <section class="door typing">
        <!-- the picture as an inline style: a relative url() inside a custom property resolves against the stylesheet's folder, not the page -->
        <button class="banner" style:background-image="url({import.meta.env.BASE_URL}regions/{tNext.region}.webp)" onclick={() => open('typing')} aria-label="Open the Typing map">
          <span class="sign"><img src="{import.meta.env.BASE_URL}game/icon-typing.webp" alt="" /></span>
          <span class="name">Typing</span>
          <span class="tag">All ten fingers, no peeking</span>
        </button>
        <div class="info">
          <div class="where"><b>{tFresh ? 'Start here' : REGION[tNext.region].name}</b><span>{tFresh ? 'Home Row Island, lesson 1' : `Next: ${lessonTitle(tNext, game.layout)}`}</span></div>
          <div class="stats">
            <span><Stars n={1} of={1} size={18} /><b>{tStars}</b> stars</span>
            <span><b>{tDone}</b>/{course.length} lessons</span>
            {#if tBest}<span><b>{tBest}</b> words a minute best</span>{/if}
          </div>
          <div class="bar2"><i style:width="{(tDone / course.length) * 100}%"></i></div>
          <div class="acts">
            <button class="btn btn-primary play" onclick={() => play('typing')}>{tFresh ? 'Start typing' : 'Play'} <span class="kbd">T</span></button>
            <button class="btn ghost" onclick={() => open('typing')}>Map</button>
          </div>
        </div>
      </section>

      <section class="door math">
        <button class="banner" style:background-image="url({import.meta.env.BASE_URL}regions/{worldOf(mNext)}.webp)" onclick={() => open('math')} aria-label="Open the Math map">
          <span class="sign"><img src="{import.meta.env.BASE_URL}game/icon-math.webp" alt="" /></span>
          <span class="name">Math</span>
          <span class="tag">Add, take away, times and share</span>
        </button>
        <div class="info">
          <div class="where"><b>{mFresh ? 'Start here' : mPlace}</b><span>{mFresh ? 'Plus, minus, times or share: pick on the map' : `Next: ${mNext.title}`}</span></div>
          <div class="stats">
            <span><Stars n={1} of={1} size={18} /><b>{mStars}</b> stars</span>
            <span><Icon name="bloom" size={20} /><b>{mBloom}</b> in bloom</span>
            {#if mBest}<span><b>{mBest}</b> a minute best</span>{/if}
          </div>
          <div class="bar2"><i style:width="{(mDone / mTrips) * 100}%"></i><i class="g" style:width="{(mGrow / ALL_GARDEN_IDS.length) * 100}%"></i></div>
          <div class="acts">
            <button class="btn btn-primary play" onclick={() => play('math')}>{mFresh ? 'Start math' : 'Play'} <span class="kbd">M</span></button>
            <button class="btn ghost" onclick={() => open('math')}>Map</button>
            <button class="btn ghost" onclick={() => { sfx.click(); game.setHome('math'); game.go('garden'); }}>Garden</button>
          </div>
        </div>
      </section>

      <!-- the Arcade: quick score games (they count as practice), and Glimmer Drop, just for fun -->
      <section class="door arcade">
        <button class="banner" style:background-image="url({import.meta.env.BASE_URL}arcade/bg-plaza.webp)" onclick={() => { sfx.click(); game.go('arcade'); }} aria-label="Open the Arcade">
          <span class="sign"><img src="{import.meta.env.BASE_URL}icons/arcade.webp" alt="" /></span>
          <span class="name">Arcade</span>
          <span class="tag">Quick score games, and Glimmer Drop</span>
        </button>
        <div class="info">
          <div class="where"><b>Today's challenge: {ARCADE[today0].name}</b><span>{aPlayed ? 'Beat it for bonus shells' : 'Every answer counts as practice'}</span></div>
          <div class="stats">
            <span><Stars n={1} of={1} size={18} /><b>{aStars}</b> stars</span>
            {#if aBest}<span><b>{fmt(aBest)}</b> best score</span>{/if}
            {#if dropBest}<span><img class="si" src="{import.meta.env.BASE_URL}drop/tile.webp" alt="" /><b>{fmt(dropBest)}</b> Drop best</span>{/if}
          </div>
          <div class="acts">
            <button class="btn btn-primary play" onclick={() => { sfx.click(); game.go('arcade'); }}>Play <span class="kbd">G</span></button>
            <button class="btn ghost withimg" onclick={() => { sfx.click(); game.go('drop'); }} title="Glimmer Drop: just for fun, played with your play time"><img src="{import.meta.env.BASE_URL}drop/tile.webp" alt="" />Glimmer Drop</button>
          </div>
        </div>
      </section>

      <!-- Adventure: battles, Glimmers and eggs; practice warms the eggs and (with the grown-ups' rule) earns play time -->
      <section class="door adventure">
        <button class="banner" style:background-image="url({import.meta.env.BASE_URL}game/door-adventure.webp)" onclick={() => { sfx.click(); game.go('adventure'); }} aria-label="Open Adventure">
          <span class="sign"><img src="{import.meta.env.BASE_URL}game/icon-grump.webp" alt="" /></span>
          <span class="name">Adventure</span>
          <span class="tag">Cheer up grumpy storm clouds and collect Glimmers</span>
        </button>
        <div class="info">
          <div class="where"><b>{worldName}</b><span>{advReady ? `${advReady} egg${advReady === 1 ? '' : 's'} ready to hatch!` : 'Battles, duels and rival ghosts'}</span></div>
          <div class="stats">
            <span><img class="si round" src="{import.meta.env.BASE_URL}game/glimmers/face/puddlepup.webp" alt="" /><b>{advFound}</b>/{GLIMMERS.length} Glimmers</span>
            <span><img class="si" src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><b>{fmt(adv.shells)}</b> shells</span>
            {#if advReady}<span class="ready"><img class="si" src="{import.meta.env.BASE_URL}game/egg-rare.webp" alt="" /><b>{advReady}</b> ready!</span>{/if}
          </div>
          <div class="bar2"><i style:width="{(advFound / GLIMMERS.length) * 100}%"></i></div>
          <div class="acts">
            <button class="btn btn-primary play" onclick={() => { sfx.click(); game.go('adventure'); }}>Play <span class="kbd">A</span></button>
            {#if advReady}<button class="btn ghost" onclick={() => { sfx.click(); game.go('eggs'); }}>Hatch</button>{/if}
            <button class="btn ghost" onclick={() => { sfx.click(); game.go('glimmers'); }}>Team</button>
          </div>
        </div>
      </section>
    </div>
    <p class="foot">Practice and the Arcade make you better and earn shells and eggs; Adventure is where your buddy and your Glimmers use them. Lost? The compass at the top goes anywhere.</p>
  </div>

  {#if guide}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="guidebg" onclick={closeGuide}>
      <div class="guide card" onclick={(e) => e.stopPropagation()}>
        <h2>How Keypals works</h2>
        <div class="gsteps">
          <div class="gs"><div class="gpic" style:background-image="url({import.meta.env.BASE_URL}game/intro-practice.webp)"></div><b>1. Practice</b><p>Typing lessons, math trips and the playground. They earn stars that open new lessons, friendship with your buddy, and shells. Every right answer makes your eggs grow.</p></div>
          <div class="gs"><div class="gpic" style:background-image="url({import.meta.env.BASE_URL}regions/village.webp)"><span class="gb"><Critter friend={p.buddy} size={90} /></span></div><b>2. Your Keypals</b><p>Friendship with each buddy opens new outfits and dances. New buddies join as you play. Outfits and dances help in Adventure too.</p></div>
          <div class="gs"><div class="gpic" style:background-image="url({import.meta.env.BASE_URL}game/intro-story.webp)"></div><b>3. Adventure</b><p>Cheer up grumpy Glimmers with your answers, and they join your team. Duel your family, race Rival Ghosts, and help your Glimmers grow up!</p></div>
          <div class="gs"><div class="gpic trophies"><TileArt kind="stickers" size={80} /><TileArt kind="medals" size={80} /></div><b>4. Stickers and medals</b><p>Medals are for great things you can do again and again: three stars, no slips, quick answers. Stickers are for firsts. Both earn shells.</p></div>
        </div>
        <!-- everything there is to earn, one line each: the same in every game -->
        <h3 class="gh">What you earn</h3>
        <div class="earn">
          <div class="ei"><img src="{import.meta.env.BASE_URL}game/icon-star.webp" alt="" /><p><b>Stars</b> How well a lesson, trip or round went. They open the next one, and new Keypals join as you collect them.</p></div>
          <div class="ei"><span class="eh"><Icon name="heart" size={40} /></span><p><b>Friendship</b> Grows every time you play with your buddy, in practice or Adventure. It opens outfits and dances.</p></div>
          <div class="ei"><img src="{import.meta.env.BASE_URL}treasures/ruby.webp" alt="" /><p><b>Treasure</b> The better your score, the better the treasure you find, from a Shiny Pebble up to a Rainbow Star. Each one is worth shells.</p></div>
          <div class="ei"><img src="{import.meta.env.BASE_URL}game/icon-shell.webp" alt="" /><p><b>Shells</b> Earned by playing. Spend them in the Shop on things to wear, eggs and treats.</p></div>
          <div class="ei"><img src="{import.meta.env.BASE_URL}game/egg-common.webp" alt="" /><p><b>Eggs and Glimmers</b> Right answers in practice hatch eggs; battles bring Glimmers too. They level up and help in battles.</p></div>
          <div class="ei"><img src="{import.meta.env.BASE_URL}game/icon-medals.webp" alt="" /><p><b>Medals and stickers</b> For the great things you do, with any buddy. They all go in your one book.</p></div>
          <div class="ei"><img src="{import.meta.env.BASE_URL}game/league-0.webp" alt="" /><p><b>Leagues</b> Only in Rival Ghosts: win points this week to move up a league.</p></div>
        </div>
        <button class="btn btn-primary" onclick={closeGuide}>Let's play!</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .hub { display: flex; flex-direction: column; background: linear-gradient(#cfe9fa, #eaf6ff 55%, #f6f2ff); }
  .bar { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); box-shadow: 0 6px 20px -16px rgba(60, 40, 110, .4); z-index: 5; }
  .me { display: flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; padding: 0 8px 0 0; border-radius: 16px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 22px var(--font-ui); }
  .pill { display: flex; align-items: center; gap: 8px; white-space: nowrap; background: var(--bg2); padding: 6px 12px; border-radius: 999px; font: 700 15px var(--font-body); color: var(--ink2); }
  .pill b { font: 600 18px var(--font-ui); color: var(--ink); }
  .ft { display: flex; flex-direction: column; gap: 3px; }
  .pill.friend { white-space: normal; }
  .ft b { font: 600 15px var(--font-ui); }
  .ft i { display: block; width: 150px; height: 7px; border-radius: 999px; background: #fff; overflow: hidden; }
  .ft em { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); }
  .spacer { flex: 1; }
  .pill.shells img { width: 28px; height: 28px; object-fit: contain; }
  .howbtn { display: grid; place-items: center; padding: 0; width: 40px; height: 40px; flex: none; border-radius: 50%; border: 0; background: #fff; font: 600 22px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b; }
  .guidebg { position: fixed; inset: 0; z-index: 40; background: rgba(30, 20, 60, .5); display: grid; place-items: center; padding: 16px; }
  .guide { width: min(1040px, 96vw); max-height: 92vh; overflow: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
  .guide h2 { margin: 0; font-size: 32px; }
  .gsteps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .gs { display: flex; flex-direction: column; gap: 6px; }
  .gs b { font: 600 20px var(--font-ui); }
  .gs p { margin: 0; font: 600 14px/1.45 var(--font-body); color: var(--ink2); }
  .gpic { aspect-ratio: 4 / 3; border-radius: 18px; background-size: cover; background-position: center; position: relative; box-shadow: var(--shadow-sm); }
  .gpic .gb { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); }
  .gpic.trophies { display: flex; align-items: center; justify-content: center; gap: 6px; background: linear-gradient(135deg, #fff4c2, #e6f1ff); }
  .guide > .btn { align-self: flex-end; font-size: 20px; padding: 10px 22px; }
  .gh { margin: 4px 0 -4px; font-size: 22px; }
  .earn { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .ei { display: flex; gap: 10px; align-items: flex-start; background: #faf8fe; border-radius: 16px; padding: 10px 12px; }
  .ei img, .ei .eh { width: 44px; height: 44px; flex: none; object-fit: contain; }
  .ei .eh { display: grid; place-items: center; }
  .ei p { margin: 0; font: 600 13.5px/1.4 var(--font-body); color: var(--ink2); }
  .ei p b { display: block; font: 600 16px var(--font-ui); color: var(--ink); }
  @media (max-width: 760px) { .earn { grid-template-columns: 1fr; } .gsteps { grid-template-columns: repeat(2, minmax(0, 1fr)); } .guide h2 { font-size: 24px; } .gs b { font-size: 16px; } .gs p { font-size: 12.5px; } .pill.shells span { display: none; } }
  .tiles { display: flex; gap: 8px; }
  /* middling widths: the header tiles stand picture-over-word, and the pills that are also elsewhere step
     aside, so the compass, music and settings always fit */
  @media (min-width: 861px) and (max-width: 1559px) {
    .tiles :global(.tile) { flex-direction: column; gap: 1px; padding: 4px 8px 5px; }
    .tiles :global(.tile .lbl) { font-size: 13px; white-space: nowrap; }
  }
  @media (min-width: 861px) and (max-width: 1399px) { .pill.shells { display: none; } }
  /* phones: shells show on the Adventure door and in the menu, so the friendship pill gets the room */
  @media (max-width: 599px) { .pill.shells { display: none; } }
  @media (min-width: 861px) and (max-width: 1199px) { .goal { display: none; } .ft i { width: 100px; } }
  .body { flex: 1; min-height: 0; padding: 18px 24px 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .hello { display: flex; align-items: center; gap: 14px; width: min(1580px, 100%); justify-content: center; }
  .hello p { margin: 0; font: 600 26px var(--font-ui); color: var(--ink); background: #fff; padding: 12px 20px; border-radius: 22px; box-shadow: var(--shadow-sm); position: relative; }
  .hello p::before { content: ''; position: absolute; left: -10px; top: 50%; margin-top: -10px; border: 10px solid transparent; border-right-color: #fff; border-left: 0; }
  .bud { animation: bob 2.8s ease-in-out infinite; margin: -10px 0; }
  @keyframes bob { 50% { transform: translateY(-6px); } }
  .doors { display: grid; grid-template-columns: repeat(2, minmax(0, 540px)); gap: 20px 24px; width: 100%; justify-content: center; }
  /* wide screens: the four doors side by side, so Home shows everything at once */
  @media (min-width: 1180px) { .doors { grid-template-columns: repeat(4, minmax(0, 380px)); gap: 18px; } .doors .name { font-size: clamp(32px, 4.4vh, 44px); } }
  .door { border-radius: 30px; overflow: hidden; background: #fff; box-shadow: 0 18px 40px -22px rgba(60, 40, 110, .55), 0 0 0 4px #fff; display: flex; flex-direction: column; transition: transform .18s; }
  .door:hover { transform: translateY(-4px); }
  .banner { position: relative; height: clamp(120px, 17vh, 180px); border: 0; padding: 0; cursor: pointer; background-position: center; background-size: cover; background-repeat: no-repeat; background-color: #cfe2f5; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: 16px 20px; text-align: left; color: #fff; }
  .banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 20%, var(--shade) 92%); }
  .typing { --shade: rgba(84, 52, 190, .88); --tone: #7c5cf5; }
  .math { --shade: rgba(214, 96, 24, .88); --tone: #ef7d2b; }
  .arcade { --shade: rgba(196, 50, 120, .86); --tone: #e2468f; }
  .adventure { --shade: rgba(28, 112, 80, .88); --tone: #2e9e6e; }
  .stats .si { width: 22px; height: 22px; object-fit: contain; }
  .stats .si.round { border-radius: 50%; object-fit: cover; }
  .stats .ready { color: #c2348a; animation: bob 1.4s ease-in-out infinite; }
  .withimg { display: inline-flex; align-items: center; gap: 6px; padding-left: 8px; }
  .withimg img { width: 30px; height: 30px; object-fit: contain; margin: -6px 0; }
  .hsave { margin-left: 8px; }
  .hsave.sm { margin: -4px 0 0; align-self: center; max-width: 100%; }
  .signedout { width: min(1580px, 100%); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: 20px; background: #fff4e0; box-shadow: inset 0 0 0 3px #ffcf7a; }
  .signedout img { width: 44px; height: 44px; object-fit: contain; filter: grayscale(.6); }
  .signedout p { flex: 1; min-width: 220px; margin: 0; font: 600 16px/1.35 var(--font-body); color: #6b3d00; }
  .signedout b { font: 600 18px var(--font-ui); color: #5a3000; }
  .banner > * { position: relative; }
  .sign { position: absolute; top: 10px; right: 12px; width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center; background: linear-gradient(#fff, #f6f2ff); box-shadow: 0 0 0 4px var(--tone), 0 8px 18px -6px rgba(30, 10, 60, .45); transition: transform .2s cubic-bezier(.3, .8, .4, 1.5); }
  .sign img { width: 54px; height: 54px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 110, .25)); }
  .banner:hover .sign { transform: scale(1.06) rotate(4deg); }
  .name { font: 600 clamp(38px, 5.4vh, 54px)/1 var(--font-ui); text-shadow: 0 3px 12px rgba(0, 0, 0, .25); }
  .tag { font: 700 16px var(--font-body); opacity: .95; }
  .info { padding: 12px 20px 16px; display: flex; flex-direction: column; gap: 9px; flex: 1; }
  .info .acts { margin-top: auto; }
  .where { display: flex; flex-direction: column; }
  .where b { font: 600 22px var(--font-ui); color: var(--ink); }
  .where span { font: 700 15px var(--font-body); color: var(--muted); }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stats span { display: flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 4px 11px; font: 700 14px var(--font-body); color: var(--ink2); }
  .stats b { font: 600 18px var(--font-ui); color: var(--ink); }
  .bar2 { position: relative; height: 10px; border-radius: 999px; background: #efeaf6; overflow: hidden; }
  .bar2 i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--tone); z-index: 2; }
  .bar2 i.g { background: #9fdcb5; z-index: 1; }
  .acts { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .play { flex: 1; font-size: 22px; padding: 12px 18px; background: linear-gradient(color-mix(in srgb, var(--tone) 70%, #fff), var(--tone)); box-shadow: 0 5px 0 color-mix(in srgb, var(--tone) 70%, #000); }
  .play .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 12px; height: 22px; }
  .ghost { background: var(--bg2); color: var(--ink); box-shadow: none; font-size: 17px; padding: 12px 16px; }
  .foot { margin: 4px 0 0; font: 600 14.5px var(--font-body); color: var(--muted); text-align: center; max-width: 640px; }

  @media (max-width: 860px) {
    .bar { padding: 6px 10px; gap: 6px 8px; flex-wrap: wrap; }
    .me :global(.critter-host) { width: 40px !important; height: 40px !important; }
    .friend { flex: 1; min-width: 0; }
    .nm { font-size: 18px; }
    .goal { display: none; }
    .ft i { width: 90px; }
    .ft b { font-size: 13px; }
    .tiles { order: 10; width: 100%; justify-content: space-between; }
    .tiles :global(.tile) { flex: 1 1 0; min-width: 0; flex-direction: column; gap: 1px; padding: 4px 2px 5px; }
    .tiles :global(.tile .lbl) { font-size: 13px; white-space: nowrap; }
    .spacer { display: none; }
    .body { padding: 10px 12px 18px; gap: 10px; }
    .hello .bud { display: none; }
    .hello p { font-size: 18px; padding: 8px 14px; }
    .hello p::before { display: none; }
    .doors { grid-template-columns: 1fr; gap: 12px; }
    .banner { height: 96px; padding: 10px 14px; }
    .sign { width: 52px; height: 52px; top: 10px; left: auto; right: 12px; border-radius: 16px; box-shadow: 0 0 0 3px var(--tone), 0 6px 12px -6px rgba(30, 10, 60, .45); }
    .sign img { width: 44px; height: 44px; }
    .name { font-size: 34px; }
    .tag { font-size: 13px; }
    .info { padding: 10px 14px 12px; gap: 7px; }
    .where b { font-size: 18px; }
    .where span { font-size: 13px; }
    .stats span { padding: 3px 8px; font-size: 12.5px; }
    .stats b { font-size: 15px; }
    .play { font-size: 19px; padding: 9px 14px; }
    .play .kbd { display: none; }
    .ghost { font-size: 15px; padding: 9px 12px; }
    .foot { display: none; }
  }
  .hmus { margin-left: auto; flex: none; display: flex; gap: 6px; }
</style>
