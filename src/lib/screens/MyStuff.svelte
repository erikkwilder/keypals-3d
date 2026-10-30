<script lang="ts">
  // My stuff: everything that's yours in one place. Big picture tiles for what you've collected (your
  // buddies and wardrobe with the Shop, dances, stickers, medals, Glimmers and their book, eggs, the Fact
  // Garden, My Sky Island), each with a live count, and then My progress: how each subject is going in
  // plain words (stars, what you're working on, how far along) and the minutes played this week.
  // Opened from the top bar and the compass menu; Back goes where it was opened from.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { ALL_LESSONS, REGION, lessonTitle } from '../engine/course';
  import { bookView, dayKey, nextLesson, outfitOf, palOf, passed, totalStars } from '../engine/profile';
  import { STICKERS, levelFromXp } from '../engine/stickers';
  import { MEDALS } from '../engine/achievements';
  import { DANCES, forBuddy } from '../engine/rewards';
  import { teamBuddies } from '../engine/team';
  import { GLIMMER_TOTAL } from '../adventure/glimmers';
  import { advView, teamOf } from '../adventure/state';
  import { CATALOG, ownsItem } from '../adventure/wardrobe';
  import { mathOf, mathStarsTotal, nextMathLesson, stageCounts, ALL_GARDEN_IDS } from '../math/progress';
  import { MATH_LESSONS, MATH_REGION, STRAND } from '../math/course';
  import { AREAS } from '../math/skills/registry';
  import { SKILL_LESSONS } from '../math/skills/course';
  import { islandLine } from '../island/save';
  import { FRIEND } from '../art/cast';
  import { openSubject } from '../nav';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Ring from '../ui/Ring.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived(advView(p));
  const m = $derived(mathOf(p));
  const lvl = $derived(levelFromXp(palOf(p).xp));
  const book = $derived(bookView(p));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const back = () => game.go(game.stuffBack === 'mystuff' ? 'hub' : game.stuffBack);

  // ---------- what you've collected ----------
  const buddies = $derived(teamBuddies(p).length);
  const owned = $derived(CATALOG.filter(c => ownsItem(p, c.id)).length);
  const dances = $derived(forBuddy(DANCES, p.buddy).filter(d => d.level <= lvl.level).length);
  const stickers = $derived(STICKERS.filter(s => book.stickers[s.id]).length);
  const medals = $derived(MEDALS.filter(md => (book.medals[md.id] ?? 0) > 0).length);
  const medalWins = $derived(MEDALS.reduce((t, md) => t + (book.medals[md.id] ?? 0), 0));
  const found = $derived(Object.keys(a.glimmers).length);
  const team = $derived(teamOf(a));
  const eggsReady = $derived(a.incubator.filter(e => e && e.have >= e.need).length);
  const eggsAll = $derived(a.incubator.filter(e => e).length + a.nest.length);
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  const growing = $derived.by(() => { const c = stageCounts(m, ALL_GARDEN_IDS); return c[1] + c[2]; });

  type Tile = { id: string; name: string; count: string; line: string; img: string; bg?: string; tone: string; hot?: boolean; go: () => void; extra?: { label: string; go: () => void } };
  const tiles = $derived<Tile[]>([
    { id: 'closet', name: 'Keypals and Wardrobe', count: `${owned}`, line: `things to wear · ${buddies} ${buddies === 1 ? 'buddy' : 'buddies'}`, img: '', bg: 'game/intro-keypals.webp', tone: '#e2468f', go: () => game.openCloset('outfits'), extra: { label: 'Shop', go: () => game.openShop() } },
    { id: 'dances', name: 'Dances', count: `${dances}`, line: `open for ${FRIEND[p.buddy].name}`, img: 'game/icon-dances.webp', tone: '#7c5cf5', go: () => game.openCloset('dances') },
    { id: 'stickers', name: 'Stickers', count: `${stickers}`, line: `of ${STICKERS.length} found`, img: 'game/icon-stickers.webp', bg: 'game/intro-stickers.webp', tone: '#e6a817', go: () => game.openStickers('stickers') },
    { id: 'medals', name: 'Medals', count: `${medals}`, line: `of ${MEDALS.length} kinds · ${fmt(medalWins)} won`, img: 'game/icon-medals.webp', tone: '#2f63bd', go: () => game.openStickers('medals') },
    { id: 'glimmers', name: 'Glimmers', count: `${found}`, line: `of ${GLIMMER_TOTAL} met${team.length ? ` · ${team.length} on your team` : ''}`, img: '', bg: 'game/intro-glimmers.webp', tone: '#2e9e6e', go: () => game.go('glimmers'), extra: { label: 'Glimmer Book', go: () => game.openBook() } },
    { id: 'eggs', name: 'Eggs', count: `${eggsAll}`, line: eggsReady ? `${eggsReady} ready to hatch!` : eggsAll ? 'warming up' : 'practice hatches eggs', img: `game/egg-${a.incubator.find(e => e)?.rarity ?? 'rare'}.webp`, tone: '#b4561a', hot: eggsReady > 0, go: () => game.go('eggs') },
    { id: 'garden', name: 'Fact Garden', count: `${blooms}`, line: `in bloom · ${growing} growing`, img: 'icons/garden.webp', tone: '#1f7a50', go: () => game.go('garden') },
    { id: 'island', name: 'My Sky Island', count: '', line: islandLine(p), img: '', bg: 'island/card.webp', tone: '#13786c', go: () => game.go('island') },
  ]);
  function go(f: () => void) { sfx.click(); f(); }

  // ---------- my progress ----------
  const course = ALL_LESSONS.filter(l => !l.practice);
  const typingDone = $derived(course.filter(l => passed(p, l.id)).length);
  const typingNext = $derived(nextLesson(p));
  const recent = $derived(p.history.slice(-10));
  const wpm = $derived(recent.length ? Math.round(recent.reduce((t, h) => t + h.wpm, 0) / recent.length) : 0);
  const acc = $derived(recent.length ? Math.round((recent.reduce((t, h) => t + h.acc, 0) / recent.length) * 100) : 0);
  const mathNext = $derived(nextMathLesson(m));
  const live = AREAS.filter(x => x.live);
  /** kinds of math with at least one trip played */
  const started = $derived(live.filter(x => x.op ? MATH_LESSONS.some(l => l.op === x.op && m.lessons[l.id]) : SKILL_LESSONS.some(l => l.area === x.id && m.lessons[l.id])).length);
  const trips = $derived(Object.values(m.lessons).filter(r => r.stars > 0).length);
  const week = $derived(Array.from({ length: 7 }, (_, i) => { const t = Date.now() - (6 - i) * 86400000; return { key: dayKey(t), day: new Date(t).toLocaleDateString(undefined, { weekday: 'narrow' }), min: Math.floor((p.days[dayKey(t)]?.ms ?? 0) / 60000), today: i === 6 }; }));
  const weekMin = $derived(week.reduce((t, d) => t + d.min, 0));
  const goalDays = $derived(week.filter(d => d.min >= p.settings.dailyGoalMin || p.days[d.key]?.goal).length);
  const maxMin = $derived(Math.max(p.settings.dailyGoalMin, ...week.map(d => d.min)));
  /** how typing is going, in words */
  const typingWords = $derived(!typingDone ? 'Just starting: the home row comes first.' : typingDone === course.length ? 'Every typing lesson passed!' : wpm >= 30 ? 'Speedy fingers!' : wpm >= 15 ? 'Getting quicker every week.' : 'Finding the keys, finger by finger.');
  const mathWords = $derived(!trips ? 'Just starting: pick a kind of math to try.' : started >= 6 ? `Exploring ${started} kinds of math!` : blooms >= 50 ? 'Lots of facts in bloom.' : 'Growing facts one trip at a time.');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
</script>

<div class="screen stuff">
  <Header title="My stuff" sub="Everything you've collected, and how you're doing" {back} />
  <div class="body scroll">
    <div class="me">
      <Critter friend={p.buddy} look={p.settings.look} accessory={outfitOf(p)} size={78} round />
      <div><h2>{p.name} and {FRIEND[p.buddy].name}</h2><span><Icon name="heart" size={18} /> Friendship {lvl.level} · <img src="{base}game/icon-shell.webp" alt="" /> {fmt(a.shells)} shells</span></div>
      <button class="btn jump" onclick={() => { sfx.click(); scrollTo('progress'); }}><img src="{base}icons/chart.webp" alt="" />My progress</button>
    </div>

    <div class="tiles">
      {#each tiles as t (t.id)}
        <div class="tile" class:hot={t.hot} style:--tc={t.tone}>
          <button class="main" onclick={() => go(t.go)}>
            <span class="art" class:bg={!!t.bg} style:background-image={t.bg ? `url(${base}${t.bg})` : null}>
              {#if t.id === 'glimmers'}{#if team.length}<span class="faces">{#each team.map(g => `${g.id}${g.evolved ? '-evo' : ''}`) as f (f)}<img src="{base}game/glimmers/face/{f}.webp" alt="" />{/each}</span>{/if}
              {:else if t.img}<img class="pic" src="{base}{t.img}" alt="" />{/if}
            </span>
            <span class="txt">
              <b>{t.name}</b>
              <span class="cnt">{#if t.count}<em>{t.count}</em>{/if}<small>{t.line}</small></span>
            </span>
          </button>
          {#if t.extra}{@const ex = t.extra}<button class="extra" onclick={() => go(ex.go)}>{ex.label}</button>{/if}
        </div>
      {/each}
      <button class="tile progtile" style:--tc="#5b3fd0" onclick={() => { sfx.click(); scrollTo('progress'); }}>
        <span class="art"><img class="pic" src="{base}icons/chart.webp" alt="" /></span>
        <span class="txt"><b>My progress</b><span class="cnt"><em>{fmt(totalStars(p) + mathStarsTotal(m))}</em><small>stars · {weekMin} min this week</small></span></span>
      </button>
    </div>

    <section class="progress" id="progress">
      <h2>My progress</h2>
      <div class="subjects">
        <article class="subj" style:--sc="#7c5cf5">
          <header><img src="{base}game/icon-typing.webp" alt="" /><h3>Typing</h3><span class="st"><img src="{base}game/icon-star.webp" alt="" />{fmt(totalStars(p))}</span></header>
          <p class="words">{typingWords}</p>
          <div class="bar"><i style:width="{(typingDone / course.length) * 100}%"></i></div>
          <ul>
            <li><b>{typingDone}</b> of {course.length} lessons passed</li>
            <li>Working on <b>{REGION[typingNext.region].name}</b>: {lessonTitle(typingNext, game.layout)}</li>
            {#if recent.length}<li>About <b>{wpm}</b> words a minute, <b>{acc}%</b> of keys right</li>{/if}
          </ul>
          <button class="btn" onclick={() => { sfx.click(); openSubject('typing', 'practice'); }}>Typing map</button>
        </article>
        <article class="subj" style:--sc="#ef7d2b">
          <header><img src="{base}game/icon-math.webp" alt="" /><h3>Math</h3><span class="st"><img src="{base}game/icon-star.webp" alt="" />{fmt(mathStarsTotal(m))}</span></header>
          <p class="words">{mathWords}</p>
          <div class="bar"><i style:width="{(started / live.length) * 100}%"></i></div>
          <ul>
            <li><b>{started}</b> of {live.length} kinds of math started, <b>{trips}</b> trips with stars</li>
            <li>Working on <b>{STRAND[mathNext.op].name}</b>{mathNext.region === 'start' ? '' : `, ${MATH_REGION[mathNext.region].name}`}</li>
            <li><b>{blooms}</b> facts in bloom in the Fact Garden</li>
          </ul>
          <button class="btn" onclick={() => { sfx.click(); openSubject('math', 'practice'); }}>Math page</button>
        </article>
        <article class="subj week" style:--sc="#2e9e6e">
          <header><Ring value={Math.min(1, goalDays / 7)} size={40} width={6} color="var(--mint)" /><h3>This week</h3><span class="st">{weekMin} min</span></header>
          <p class="words">{goalDays ? `You hit your goal on ${goalDays} ${goalDays === 1 ? 'day' : 'days'} this week.` : `Your goal is ${p.settings.dailyGoalMin} minutes a day.`}</p>
          <div class="days">
            {#each week as d (d.key)}
              <div class="dcol" class:today={d.today}><span class="b" class:goal={d.min >= p.settings.dailyGoalMin} style:height="{Math.max(4, (d.min / maxMin) * 100)}%"></span><small>{d.day}</small></div>
            {/each}
          </div>
          <p class="note">Minutes from lessons, trips, Learn and games. Green days hit the goal.</p>
        </article>
      </div>
    </section>
  </div>
</div>

<style>
  .stuff { display: flex; flex-direction: column; background: linear-gradient(#f3f9ff, #fbf8ff 40%); }
  .body { flex: 1; min-height: 0; padding: 18px 24px 50px; display: flex; flex-direction: column; gap: 18px; }
  .me { display: flex; align-items: center; gap: 14px; }
  .me h2 { margin: 0; font-size: 26px; }
  .me span { display: inline-flex; align-items: center; gap: 5px; font: 700 15px var(--font-body); color: var(--ink2); }
  .me span img { width: 22px; height: 22px; object-fit: contain; }
  .jump { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
  .jump img { width: 30px; height: 30px; object-fit: contain; }

  .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .tile { --tc: #7c5cf5; position: relative; display: flex; flex-direction: column; border-radius: 26px; background: #fff; overflow: hidden; border: 0; padding: 0; cursor: pointer; text-align: left; font: inherit;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--tc) 22%, #fff), 0 6px 0 color-mix(in srgb, var(--tc) 28%, #fff), 0 18px 30px -18px rgba(40, 20, 80, .45); transition: transform .14s; }
  .tile:hover { transform: translateY(-3px); }
  .main { display: flex; flex-direction: column; border: 0; padding: 0; background: none; cursor: pointer; text-align: left; font: inherit; flex: 1; }
  .art { position: relative; display: grid; place-items: center; height: 132px; background: linear-gradient(135deg, color-mix(in srgb, var(--tc) 14%, #fff), color-mix(in srgb, var(--tc) 30%, #fff)); }
  .art.bg { background-size: cover; background-position: center; }
  .pic { width: 104px; height: 104px; object-fit: contain; filter: drop-shadow(0 8px 8px rgba(40, 20, 80, .3)); transition: transform .2s; }
  .art.bg .pic { width: 84px; height: 84px; position: absolute; left: 12px; bottom: 10px; }
  .tile:hover .pic { transform: scale(1.06) rotate(-4deg); }
  .faces { position: absolute; left: 12px; bottom: 10px; display: flex; }
  .faces img { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; object-position: center 35%; box-shadow: 0 0 0 3px #fff, 0 4px 10px rgba(40, 20, 80, .35); }
  .faces img + img { margin-left: -16px; }
  .txt { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px 14px; }
  .txt b { font: 600 22px/1.1 var(--font-ui); color: var(--ink); }
  .cnt { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .cnt em { font: 600 26px/1 var(--font-ui); font-style: normal; color: var(--tc); }
  .cnt small { font: 700 14px/1.3 var(--font-body); color: var(--muted); }
  .extra { position: absolute; right: 12px; top: 12px; border: 0; cursor: pointer; padding: 6px 14px; border-radius: 999px; background: #fff; color: var(--tc); font: 600 15px var(--font-ui); box-shadow: 0 3px 0 color-mix(in srgb, var(--tc) 35%, #fff), 0 6px 14px -6px rgba(40, 20, 80, .45); }
  .extra:hover { transform: translateY(-1px); }
  .tile.hot .pic { animation: hot 1.4s ease-in-out infinite; }
  @keyframes hot { 50% { transform: scale(1.08) rotate(-4deg); } }

  .progress { scroll-margin-top: 10px; }
  .progress > h2 { margin: 6px 0 12px; font-size: 26px; }
  .subjects { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  .subj { --sc: #7c5cf5; display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 16px; border-radius: 24px; background: #fff; box-shadow: 0 0 0 3px color-mix(in srgb, var(--sc) 20%, #fff), 0 14px 26px -18px rgba(40, 20, 80, .45); }
  .subj header { display: flex; align-items: center; gap: 8px; }
  .subj header > img { width: 40px; height: 40px; object-fit: contain; }
  .subj h3 { margin: 0; font-size: 24px; color: color-mix(in srgb, var(--sc) 80%, #000); }
  .st { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font: 600 20px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 2px 12px 2px 6px; border-radius: 999px; }
  .st img { width: 24px; height: 24px; }
  .words { margin: 0; font: 600 17px/1.35 var(--font-ui); color: var(--ink); }
  .bar { height: 10px; border-radius: 999px; background: #f1ecfb; overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: 999px; background: var(--sc); }
  .subj ul { margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 3px; font: 600 14.5px/1.35 var(--font-body); color: var(--ink2); }
  .subj b { color: var(--ink); }
  .subj .btn { align-self: flex-start; margin-top: auto; }
  .days { display: flex; align-items: flex-end; gap: 6px; height: 96px; }
  .dcol { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; }
  .dcol .b { width: 100%; border-radius: 8px 8px 4px 4px; background: var(--lilac); }
  .dcol .b.goal { background: var(--mint); }
  .dcol small { font: 700 12px var(--font-body); color: var(--muted); }
  .dcol.today small { color: var(--primary); }
  .note { margin: 0; font: 700 12.5px var(--font-body); color: var(--muted); }

  @media (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } .subjects { grid-template-columns: 1fr 1fr; } .subj.week { grid-column: 1 / -1; } }
  /* short laptop screens: shorter pictures, so more fits before it scrolls */
  @media (max-height: 800px) and (min-width: 760px) { .art { height: 104px; } .pic { width: 84px; height: 84px; } .art.bg .pic { width: 70px; height: 70px; } .tiles { gap: 12px; } }
  @media (max-width: 760px) {
    .body { padding: 12px 12px 40px; gap: 14px; }
    .me h2 { font-size: 20px; }
    .me :global(.critter-host) { width: 56px !important; height: 56px !important; }
    .jump { display: none; }
    .tiles { gap: 10px; }
    .art { height: 92px; }
    .pic { width: 70px; height: 70px; }
    .art.bg .pic { width: 56px; height: 56px; left: 8px; bottom: 6px; }
    .faces img { width: 44px; height: 44px; }
    .txt { padding: 8px 10px 10px; }
    .txt b { font-size: 17px; }
    .cnt em { font-size: 21px; }
    .cnt small { font-size: 12px; }
    .extra { right: 8px; top: 8px; padding: 4px 10px; font-size: 13px; }
    .subjects { grid-template-columns: 1fr; }
  }
</style>
