<script lang="ts">
  // Home: the first thing you see, and the place every game comes back to. Two doors, Typing and Math,
  // each with its own trail and its own progress; above them, what all games share: your buddy's
  // friendship, today's minutes, stickers, medals and dances.
  import { game } from '../state/game.svelte';
  import { ALL_LESSONS, REGION, lessonTitle } from '../engine/course';
  import { nextLesson, outfitOf, palOf, passed, todayMs, totalStars } from '../engine/profile';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { levelFromXp } from '../engine/stickers';
  import { FRIEND } from '../art/cast';
  import { sfx } from '../audio/sound';
  import { MATH_LESSONS, MATH_REGION, STRAND, worldOf } from '../math/course';
  import { ALL_GARDEN_IDS, mathOf, mathStarsTotal, nextMathLesson, stageCounts } from '../math/progress';
  import Flower from '../math/ui/Flower.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import GearButton from '../ui/GearButton.svelte';
  import FancyAntButton from '../ui/FancyAntButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import Stars from '../ui/Stars.svelte';
  import Ring from '../ui/Ring.svelte';

  const p = $derived(game.profile!);
  const look = $derived(p.settings.look);
  const pal = $derived(palOf(p));
  const lvl = $derived(levelFromXp(pal.xp));
  const goalMs = $derived(p.settings.dailyGoalMin * 60000);
  const today = $derived(todayMs(p));
  let sw = $state(1280);
  const tsz = $derived(sw < 860 ? 'sm' : 'md');
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
  const mStars = $derived(mathStarsTotal(m));
  const mBloom = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const mGrow = $derived(ALL_GARDEN_IDS.filter(id => (m.facts[id]?.stage ?? 0) > 0).length);
  const mBest = $derived(Math.round(Math.max(0, ...Object.values(m.lessons).map(r => r.bestFpm ?? 0))));
  const mFresh = $derived(m.totals.trips === 0);
  const mPlace = $derived(`${STRAND[mNext.op].name}${mNext.region === 'start' ? '' : ' · ' + MATH_REGION[mNext.region].name}`);
  const mTrips = MATH_LESSONS.length;
  const mDone = $derived(Object.values(m.lessons).filter(r => r.stars > 0).length);

  function open(g: 'typing' | 'math') { sfx.click(); game.setHome(g); game.go('map'); }
  function play(g: 'typing' | 'math') {
    sfx.click();
    game.setHome(g);
    if (g === 'typing') game.startLesson(tNext.id); else game.startMath(mNext.id);
  }
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    const k = e.key.toLowerCase();
    if (k === 't' || k === '1') { e.preventDefault(); play('typing'); }
    if (k === 'm' || k === '2') { e.preventDefault(); play('math'); }
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
      <span class="heart">♥</span>
      <span class="ft"><b>{FRIEND[p.buddy].name} · Friendship {lvl.level}</b><i><em style:width="{(lvl.into / lvl.need) * 100}%"></em></i></span>
    </div>
    <div class="pill goal" title="Today's practice goal: typing and math both count">
      <Ring value={Math.min(1, today / goalMs)} size={32} color="var(--mint)" />
      <span><b>{Math.floor(today / 60000)}</b>/{p.settings.dailyGoalMin} min today</span>
    </div>
    <div class="spacer"></div>
    <div class="tiles">
      <NavTile size={tsz} tone="pink" label="Keypals" title="Keypals: pick your buddy and outfits" onclick={() => game.openCloset('outfits')}>
        {#snippet art()}<Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={tsz === 'sm' ? 36 : 58} round />{/snippet}
      </NavTile>
      <NavTile size={tsz} tone="lilac" kind="dances" label="Dances" badge={dancesOpen || ''} onclick={() => game.openCloset('dances')} />
      <NavTile size={tsz} tone="butter" kind="stickers" label="Stickers" badge={Object.keys(pal.stickers).length || ''} onclick={() => game.openStickers('stickers')} />
      <NavTile size={tsz} tone="sky" kind="medals" label="Medals" badge={pal.medalsTotal || ''} onclick={() => game.openStickers('medals')} />
    </div>
    {#if sw >= 860}<FancyAntButton variant="round" />{/if}
    <GearButton size={sw < 860 ? 36 : 44} />
  </header>

  <div class="body scroll">
    <div class="hello">
      <div class="bud"><Critter friend={p.buddy} {look} accessory={outfitOf(p)} size={120} mood="idle" /></div>
      <p>{hello}</p>
    </div>

    <div class="doors">
      <section class="door typing" style:--art="url({import.meta.env.BASE_URL}regions/{tNext.region}.webp)">
        <button class="banner" onclick={() => open('typing')} aria-label="Open the Typing map">
          <span class="sign"><svg viewBox="0 0 32 24" aria-hidden="true"><rect x="2" y="3" width="28" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="2.4" /><path d="M7 9h2M12 9h2M17 9h2M22 9h3M8 15h16" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg></span>
          <span class="name">Typing</span>
          <span class="tag">All ten fingers, no peeking</span>
        </button>
        <div class="info">
          <div class="where"><b>{tFresh ? 'Start here' : REGION[tNext.region].name}</b><span>{tFresh ? 'Home Row Island, lesson 1' : `Next: ${lessonTitle(tNext, game.layout)}`}</span></div>
          <div class="stats">
            <span><Stars n={1} of={1} size={18} /><b>{tStars}</b> stars</span>
            <span><b>{tDone}</b>/{course.length} lessons</span>
            {#if tBest}<span><b>{tBest}</b> wpm best</span>{/if}
          </div>
          <div class="bar2"><i style:width="{(tDone / course.length) * 100}%"></i></div>
          <div class="acts">
            <button class="btn btn-primary play" onclick={() => play('typing')}>{tFresh ? 'Start typing' : 'Play'} <span class="kbd">T</span></button>
            <button class="btn ghost" onclick={() => open('typing')}>Map</button>
          </div>
        </div>
      </section>

      <section class="door math" style:--art="url({import.meta.env.BASE_URL}regions/{worldOf(mNext)}.webp)">
        <button class="banner" onclick={() => open('math')} aria-label="Open the Math map">
          <span class="sign"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 7v8M5 11h8M19 11h8M7 21l4 4M11 21l-4 4M19 21h8M19 25h8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /></svg></span>
          <span class="name">Math</span>
          <span class="tag">Add, take away, times and share</span>
        </button>
        <div class="info">
          <div class="where"><b>{mFresh ? 'Start here' : mPlace}</b><span>{mFresh ? 'Plus, minus, times or share: pick on the map' : `Next: ${mNext.title}`}</span></div>
          <div class="stats">
            <span><Stars n={1} of={1} size={18} /><b>{mStars}</b> stars</span>
            <span><Flower stage={3} size={20} hue={320} /><b>{mBloom}</b> in bloom</span>
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
    </div>
    <p class="foot">Every game makes you and {FRIEND[p.buddy].name} better friends: new outfits, dances and stickers come from typing and math alike.</p>
  </div>
</div>

<style>
  .hub { display: flex; flex-direction: column; background: linear-gradient(#cfe9fa, #eaf6ff 55%, #f6f2ff); }
  .bar { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: rgba(255, 255, 255, .92); border-bottom: var(--panel-border); box-shadow: 0 6px 20px -16px rgba(60, 40, 110, .4); z-index: 5; }
  .me { display: flex; align-items: center; gap: 8px; background: none; border: 0; cursor: pointer; padding: 0 8px 0 0; border-radius: 16px; }
  .me:hover { background: var(--bg2); }
  .nm { font: 600 22px var(--font-ui); }
  .pill { display: flex; align-items: center; gap: 8px; background: var(--bg2); padding: 6px 12px; border-radius: 999px; font: 700 15px var(--font-body); color: var(--ink2); }
  .pill b { font: 600 18px var(--font-ui); color: var(--ink); }
  .friend .heart { color: var(--pink); font-size: 22px; line-height: 1; }
  .ft { display: flex; flex-direction: column; gap: 3px; }
  .ft b { font: 600 15px var(--font-ui); }
  .ft i { display: block; width: 150px; height: 7px; border-radius: 999px; background: #fff; overflow: hidden; }
  .ft em { display: block; height: 100%; background: linear-gradient(90deg, var(--primary-hi), var(--pink)); }
  .spacer { flex: 1; }
  .tiles { display: flex; gap: 8px; }
  .body { flex: 1; min-height: 0; padding: 18px 24px 24px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .hello { display: flex; align-items: center; gap: 14px; }
  .hello p { margin: 0; font: 600 26px var(--font-ui); color: var(--ink); background: #fff; padding: 12px 20px; border-radius: 22px; box-shadow: var(--shadow-sm); position: relative; }
  .hello p::before { content: ''; position: absolute; left: -10px; top: 50%; margin-top: -10px; border: 10px solid transparent; border-right-color: #fff; border-left: 0; }
  .bud { animation: bob 2.8s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-6px); } }
  .doors { display: grid; grid-template-columns: repeat(2, minmax(0, 520px)); gap: 26px; width: 100%; justify-content: center; }
  .door { border-radius: 30px; overflow: hidden; background: #fff; box-shadow: 0 18px 40px -22px rgba(60, 40, 110, .55), 0 0 0 4px #fff; display: flex; flex-direction: column; transition: transform .18s; }
  .door:hover { transform: translateY(-4px); }
  .banner { position: relative; height: clamp(150px, 24vh, 230px); border: 0; padding: 0; cursor: pointer; background: var(--art) center / cover no-repeat; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; padding: 16px 20px; text-align: left; color: #fff; }
  .banner::before { content: ''; position: absolute; inset: 0; background: linear-gradient(transparent 20%, var(--shade) 92%); }
  .typing { --shade: rgba(84, 52, 190, .88); --tone: #7c5cf5; }
  .math { --shade: rgba(214, 96, 24, .88); --tone: #ef7d2b; }
  .banner > * { position: relative; }
  .sign { position: absolute; top: 14px; left: 16px; width: 54px; height: 54px; border-radius: 16px; display: grid; place-items: center; background: var(--tone); box-shadow: 0 0 0 4px rgba(255, 255, 255, .85); }
  .sign svg { width: 34px; height: 34px; }
  .name { font: 600 clamp(38px, 5.4vh, 54px)/1 var(--font-ui); text-shadow: 0 3px 12px rgba(0, 0, 0, .25); }
  .tag { font: 700 16px var(--font-body); opacity: .95; }
  .info { padding: 14px 20px 18px; display: flex; flex-direction: column; gap: 10px; }
  .where { display: flex; flex-direction: column; }
  .where b { font: 600 22px var(--font-ui); color: var(--ink); }
  .where span { font: 700 15px var(--font-body); color: var(--muted); }
  .stats { display: flex; flex-wrap: wrap; gap: 8px; }
  .stats span { display: flex; align-items: center; gap: 5px; background: var(--bg2); border-radius: 999px; padding: 4px 11px; font: 700 14px var(--font-body); color: var(--ink2); }
  .stats b { font: 600 18px var(--font-ui); color: var(--ink); }
  .bar2 { position: relative; height: 10px; border-radius: 999px; background: #efeaf6; overflow: hidden; }
  .bar2 i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: var(--tone); z-index: 2; }
  .bar2 i.g { background: #9fdcb5; z-index: 1; }
  .acts { display: flex; gap: 8px; align-items: center; }
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
    .sign { width: 40px; height: 40px; top: 10px; left: auto; right: 12px; border-radius: 12px; }
    .sign svg { width: 26px; height: 26px; }
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
</style>
