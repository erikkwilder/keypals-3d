<script lang="ts">
  // My progress (a page of My stuff), for the child (a grown-up's Reports open it for any child, playing or
  // not: then it's only to read, with nothing that starts a game):
  // - Time playing: minutes each day this week (green when the goal was hit), the last four weeks, all together.
  // - Going well: math skills that are solid, keys typed fast and right, facts in bloom, speed going up.
  // - Keep practising: skills still growing and tricky keys (each skill opens its topic). Never "behind".
  // - Practice done: lessons passed, trips, facts in bloom, tricks learned, games played, and each subject.
  // - What I earned: stars, shells, eggs, medals, stickers and Glimmers, when, and from what, newest first,
  //   from the player's ledger (engine/ledger.ts); before the ledger began, from the lesson and trip
  //   history, the sticker book and the Glimmers' dates.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { ALL_LESSONS, LESSON, lessonTitle } from '../engine/course';
  import { bookView, dayKey, passed, type Profile } from '../engine/profile';
  import { allStars } from '../engine/team';
  import { mastery } from '../engine/mastery';
  import { AWARD } from '../engine/achievements';
  import { STICKER } from '../engine/stickers';
  import type { LedgerEntry } from '../engine/ledger';
  import { PAINTED_MEDAL_IDS } from '../art/stickerArt';
  import { mathOf, stageCounts, ALL_GARDEN_IDS } from '../math/progress';
  import { MATH_LESSON, groupFacts } from '../math/course';
  import { factId } from '../math/facts';
  import { SKILL_LESSON } from '../math/skills/course';
  import { AREAS, skillsOf } from '../math/skills/registry';
  import { skillStatus } from '../math/skills/progress';
  import type { Skill } from '../math/skills/types';
  import { advView, ISLAND, NODE } from '../adventure/state';
  import { glimmerName, type GlimmerId } from '../adventure/glimmers';
  import { ARCADE_GAMES } from '../arcade/arcade';
  import { isTopic, openSubjectPage } from '../nav';
  import { SHOP_ENTRY } from '../shop/shop';
  import Header from '../ui/Header.svelte';
  import Ring from '../ui/Ring.svelte';

  const base = import.meta.env.BASE_URL;
  // (opened from a grown-up's Reports for one child: that child, and Back goes to that child's report)
  const other = game.progressFor; game.progressFor = null;
  const p = $derived<Profile>(game.save.profiles.find(x => x.id === other) ?? game.profile!);
  const reading = $derived(!!other && other !== game.profile?.id);
  const m = $derived(mathOf(p));
  const a = $derived(advView(p));
  const book = $derived(bookView(p));
  const grown = $derived(!!p.settings.grown);
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const DAY = 86_400_000;

  // ---------- time playing ----------
  const goal = $derived(p.settings.dailyGoalMin);
  const minOf = (t: number) => Math.floor((p.days[dayKey(t)]?.ms ?? 0) / 60000);
  const week = $derived(Array.from({ length: 7 }, (_, i) => { const t = Date.now() - (6 - i) * DAY; return { key: dayKey(t), day: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }), min: minOf(t), today: i === 6, goal: minOf(t) >= goal || !!p.days[dayKey(t)]?.goal }; }));
  const weekMin = $derived(week.reduce((t, d) => t + d.min, 0));
  const goalDays = $derived(week.filter(d => d.goal).length);
  const maxMin = $derived(Math.max(goal, ...week.map(d => d.min)));
  const weeks = $derived(Array.from({ length: 4 }, (_, w) => { let min = 0; for (let d = 0; d < 7; d++) min += minOf(Date.now() - (w * 7 + d) * DAY); return { min, name: w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago` }; }).reverse());
  const maxWeek = $derived(Math.max(goal * 7, ...weeks.map(w => w.min)));
  const allMin = $derived(Math.floor(Object.values(p.days).reduce((t, d) => t + (d?.ms ?? 0), 0) / 60000));
  const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

  // ---------- skills: going well, and still growing ----------
  type Status = 'not started' | 'growing' | 'solid';
  /** a fact strand: solid when most of its facts bloom (as in the grown-ups' report); a skill: its own memory */
  function status(s: Skill): Status {
    if (!s.facts) return skillStatus(m, s.id);
    const ids = s.subs.flatMap(sb => groupFacts(sb.id)).map(factId);
    const st = ids.map(id => m.facts[id]?.stage ?? 0);
    if (st.every(x => x === 0)) return 'not started';
    return st.filter(x => x === 3).length >= ids.length * 0.8 && st.every(x => x >= 2) ? 'solid' : 'growing';
  }
  const skills = $derived(AREAS.filter(x => x.live).flatMap(ar => skillsOf(ar.id).map(s => ({ s, area: ar, st: status(s) }))));
  const solid = $derived(skills.filter(x => x.st === 'solid'));
  const growing = $derived(skills.filter(x => x.st === 'growing'));
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
  // typing: keys typed often, fast and right; and the tricky ones (letters tried enough to tell)
  const keyList = $derived(Object.entries(p.keys ?? {}).filter(([ch, k]) => /^[a-z]$/.test(ch) && k && k.n >= 8).map(([ch, k]) => ({ ch, m: mastery(k, grown), n: k.n })));
  const strongKeys = $derived(keyList.filter(k => k.m >= 0.7 && k.n >= 20).sort((x, y) => y.m - x.m).slice(0, 8));
  const trickyKeys = $derived(keyList.filter(k => k.m < 0.45).sort((x, y) => x.m - y.m).slice(0, 6));
  const runs = $derived(p.history ?? []);
  const avg = (xs: { wpm: number }[]) => (xs.length ? xs.reduce((t, h) => t + h.wpm, 0) / xs.length : 0);
  const wpmNow = $derived(Math.round(avg(runs.slice(-5))));
  const faster = $derived(runs.length >= 10 && avg(runs.slice(-5)) > avg(runs.slice(-10, -5)) * 1.05);
  const threeStar = $derived(Object.values(p.lessons).filter(r => r.stars >= 3).length + Object.values(m.lessons).filter(r => r.stars >= 3).length);
  function practise(area: string) {
    sfx.click();
    if (!isTopic('math', area)) { openSubjectPage('math'); return; }
    game.setHome('math'); game.subject = 'math'; game.topic = area; game.visit('topic');
  }

  // ---------- practice done ----------
  const course = ALL_LESSONS.filter(l => !l.practice);
  const typingDone = $derived(course.filter(l => passed(p, l.id)).length);
  const trips = $derived(m.totals?.trips ?? 0);
  const tricks = $derived(m.learned?.length ?? 0);
  const games = $derived(Object.values(p.arcade ?? {}).reduce((t, r) => t + ((r as { plays?: number } | undefined)?.plays ?? 0), 0));
  const stars = $derived(allStars(p));

  // ---------- what I earned ----------
  type Ev = LedgerEntry;
  const events = $derived.by<Ev[]>(() => {
    const led = p.ledger ?? [];
    const since = led[0]?.at ?? Infinity;
    // before the ledger began: what the save already knows the time of
    const older: Ev[] = [
      ...runs.filter(h => h.at < since && h.stars > 0).map(h => ({ at: h.at, from: 'Typing lesson', ref: `typing:${h.lessonId}`, stars: h.stars })),
      ...(m.history ?? []).filter(h => h.at < since && h.stars > 0).map(h => ({ at: h.at, from: 'Math trip', ref: `math:${h.lessonId}`, stars: h.stars })),
      ...Object.entries(book.stickers).filter(([id, v]) => !!v && v.at < since && !!STICKER[id]).map(([id, v]) => ({ at: v.at, from: 'A new sticker', stickers: [id] })),
      ...Object.entries(a.glimmers).filter(([, o]) => (o?.got ?? 0) > 0 && o!.got < since).map(([id, o]) => ({ at: o!.got, from: 'A new Glimmer', glimmers: [id] })),
    ];
    return [...older, ...led].sort((x, y) => y.at - x.at);
  });
  const weekAgo = Date.now() - 7 * DAY;
  const thisWeek = $derived.by(() => {
    const t = { stars: 0, shells: 0, eggs: 0, medals: 0, stickers: 0, glimmers: 0 };
    for (const e of events) {
      if (e.at < weekAgo) break;
      t.stars += e.stars ?? 0; t.shells += Math.max(0, e.shells ?? 0); t.eggs += e.eggs ?? 0;
      t.medals += e.medals?.length ?? 0; t.stickers += e.stickers?.length ?? 0; t.glimmers += e.glimmers?.length ?? 0;
    }
    return t;
  });
  let shown = $state(30);
  /** the events shown, under a heading for each day */
  const days = $derived.by(() => {
    const out: { label: string; list: Ev[] }[] = [];
    const today = dayKey(Date.now()), yday = dayKey(Date.now() - DAY);
    for (const e of events.slice(0, shown)) {
      const k = dayKey(e.at);
      const label = k === today ? 'Today' : k === yday ? 'Yesterday' : new Date(e.at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      if (out.at(-1)?.label !== label) out.push({ label, list: [] });
      out.at(-1)!.list.push(e);
    }
    return out;
  });
  /** what exactly it was, by name ("Home Row 3", "Pizza Rush", "Sunny Meadow") */
  function refName(ref?: string): string {
    if (!ref) return '';
    const [kind, id] = [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)];
    if (kind === 'typing') return LESSON[id] ? lessonTitle(LESSON[id], game.layout) : '';
    if (kind === 'math') return MATH_LESSON[id]?.title ?? SKILL_LESSON[id]?.title ?? '';
    if (kind === 'arcade') return ARCADE_GAMES.find(g => g.id === id)?.name ?? '';
    if (kind === 'battle') { const n = NODE[id]; return n ? ISLAND[n.island]?.name ?? '' : ''; }
    return '';
  }
  const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const medalPic = (id: string) => (PAINTED_MEDAL_IDS.includes(id) ? `${base}icons/medals/${id}-0.webp` : `${base}game/icon-medals.webp`);
  /** a list of names with how many of each ("Clean Sweep ×2") */
  function counted(ids: string[]): { id: string; n: number }[] {
    const c = new Map<string, number>();
    for (const id of ids) c.set(id, (c.get(id) ?? 0) + 1);
    return [...c].map(([id, n]) => ({ id, n }));
  }
  const evo = (id: string) => !!a.glimmers[id as GlimmerId]?.evolved;
</script>

<div class="screen prog">
  <Header title={reading ? `${p.name}'s progress` : undefined} back={other ? () => { game.skillsFor = other; game.back(); } : undefined} />
  <div class="body scroll">
    <div class="wrap">
      <div class="lc">
        <!-- time playing -->
        <section class="card time">
          <header><img src="{base}icons/clock.webp" alt="" /><h2>Time playing</h2><span class="pill">{hm(weekMin)} this week</span></header>
          <p class="words">{goalDays ? `You hit your ${goal}-minute goal on ${goalDays} ${goalDays === 1 ? 'day' : 'days'} this week!` : `Your goal is ${goal} minutes a day.`}</p>
          <div class="days" role="img" aria-label="Minutes each day this week">
            {#each week as d (d.key)}
              <div class="dcol" class:today={d.today}><em>{d.min || ''}</em><span class="b" class:goal={d.goal} style:height="{Math.max(3, (d.min / maxMin) * 100)}%"></span><small>{d.day}</small></div>
            {/each}
          </div>
          <div class="weeks">
            {#each weeks as w (w.name)}
              <div class="wk"><small>{w.name}</small><span class="wb"><i style:width="{Math.max(2, (w.min / maxWeek) * 100)}%"></i></span><b>{hm(w.min)}</b></div>
            {/each}
          </div>
          <p class="note">All together: <b>{hm(allMin)}</b> of lessons, trips, Learn and games.</p>
        </section>

        <!-- going well -->
        <section class="card well">
          <header><img src="{base}game/icon-sun.webp" alt="" /><h2>Going well</h2></header>
          {#if solid.length || strongKeys.length || blooms || faster || threeStar}
            <ul class="chips">
              {#each solid.slice(0, 8) as x (x.s.id)}<li class="chip" style:--ac={x.area.color}><i></i>{x.s.name}</li>{/each}
              {#if strongKeys.length}<li class="chip keys"><span>Quick, sure fingers on</span>{#each strongKeys as k (k.ch)}<kbd>{k.ch.toUpperCase()}</kbd>{/each}</li>{/if}
              {#if blooms}<li class="chip"><img src="{base}icons/bloom.webp" alt="" />{blooms} {blooms === 1 ? 'fact' : 'facts'} in bloom</li>{/if}
              {#if faster}<li class="chip"><img src="{base}icons/bolt.webp" alt="" />Typing faster: about {wpmNow} words a minute</li>{/if}
              {#if threeStar}<li class="chip"><img src="{base}game/icon-star.webp" alt="" />Three stars on {threeStar} {threeStar === 1 ? 'lesson or trip' : 'lessons and trips'}</li>{/if}
            </ul>
          {:else}
            <p class="empty">Play a few lessons or trips and the things you do well show up here.</p>
          {/if}
        </section>

        <!-- keep practising -->
        <section class="card grow">
          <header><img src="{base}icons/garden.webp" alt="" /><h2>Keep practising</h2></header>
          {#if growing.length || trickyKeys.length}
            <p class="sub">These are growing. A little more practice makes them strong!</p>
            <ul class="chips">
              {#each growing.slice(0, 8) as x (x.s.id)}<li>{#if reading}<span class="chip go" style:--ac={x.area.color}><i></i>{x.s.name}</span>{:else}<button class="chip go" style:--ac={x.area.color} onclick={() => practise(x.area.id)} title="Practise {x.area.name}"><i></i>{x.s.name}<img class="arr" src="{base}icons/right.webp" alt="" /></button>{/if}</li>{/each}
              {#if trickyKeys.length}<li class="chip keys"><span>Tricky keys to practise</span>{#each trickyKeys as k (k.ch)}<kbd>{k.ch.toUpperCase()}</kbd>{/each}</li>{/if}
            </ul>
          {:else}
            <p class="empty">Nothing here yet. When you start something new, it shows up here while it grows.</p>
          {/if}
        </section>

        <!-- practice done -->
        <section class="card done">
          <header><img src="{base}icons/chart.webp" alt="" /><h2>Practice done</h2><span class="pill"><img src="{base}game/icon-star.webp" alt="" />{fmt(stars)} stars</span></header>
          <div class="tiles">
            <div class="tile"><b>{typingDone}<small> of {course.length}</small></b><span>typing lessons passed</span><span class="tb"><i style:width="{(typingDone / course.length) * 100}%"></i></span></div>
            <div class="tile"><b>{fmt(p.totals.runs)}</b><span>typing lessons played</span></div>
            <div class="tile"><b>{fmt(trips)}</b><span>math trips</span></div>
            <div class="tile"><b>{fmt(blooms)}</b><span>facts in bloom</span></div>
            <div class="tile"><b>{fmt(tricks)}</b><span>tricks learned</span></div>
            <div class="tile"><b>{fmt(games)}</b><span>Arcade games played</span></div>
          </div>
          {#if !reading}<div class="go">
            <button class="btn" onclick={() => { sfx.click(); openSubjectPage('typing'); }}><img src="{base}game/icon-typing.webp" alt="" />Typing</button>
            <button class="btn" onclick={() => { sfx.click(); openSubjectPage('math'); }}><img src="{base}game/icon-math.webp" alt="" />Math</button>
          </div>{/if}
        </section>
      </div>

      <!-- what I earned -->
      <section class="card earn">
        <header><img src="{base}icons/gift.webp" alt="" /><h2>What I earned</h2></header>
        <div class="week">
          <span class="wl">This week</span>
          <span class="tot"><img src="{base}game/icon-star.webp" alt="" /><b>{thisWeek.stars}</b> stars</span>
          <span class="tot"><img src="{base}game/icon-shell.webp" alt="" /><b>{fmt(thisWeek.shells)}</b> shells</span>
          <span class="tot"><img src="{base}game/egg-common.webp" alt="" /><b>{thisWeek.eggs}</b> {thisWeek.eggs === 1 ? 'egg' : 'eggs'}</span>
          <span class="tot"><img src="{base}game/icon-medals.webp" alt="" /><b>{thisWeek.medals}</b> {thisWeek.medals === 1 ? 'medal' : 'medals'}</span>
          <span class="tot"><img src="{base}game/icon-stickers.webp" alt="" /><b>{thisWeek.stickers}</b> {thisWeek.stickers === 1 ? 'sticker' : 'stickers'}</span>
          <span class="tot"><img src="{base}icons/sparkle.webp" alt="" /><b>{thisWeek.glimmers}</b> {thisWeek.glimmers === 1 ? 'Glimmer' : 'Glimmers'}</span>
        </div>
        {#if days.length}
          {#each days as d (d.label)}
            <h3 class="dh">{d.label}</h3>
            <ol class="evs">
              {#each d.list as e, i (`${e.at}-${i}`)}
                {@const nm = refName(e.ref)}
                <li class="ev">
                  <span class="when">{time(e.at)}</span>
                  <div class="what">
                    <b>{e.from}{#if nm}<span class="nm">: {nm}</span>{/if}</b>
                    <div class="got">
                      {#if e.stars}<span class="g"><img src="{base}game/icon-star.webp" alt="" />{e.stars} {e.stars === 1 ? 'star' : 'stars'}</span>{/if}
                      {#if e.shells && e.shells > 0}<span class="g"><img src="{base}game/icon-shell.webp" alt="" />+{fmt(e.shells)} shells</span>{/if}
                      {#each counted(e.bought ?? []) as bt (bt.id)}{@const it = SHOP_ENTRY[bt.id]}<span class="g spent bought">{#if it?.pic}<img src="{base}{it.pic}" alt="" />{/if}Bought: {it?.name ?? 'something'}{bt.n > 1 ? ` ×${bt.n}` : ''}</span>{/each}
                      {#if e.shells && e.shells < 0}<span class="g spent"><img src="{base}game/icon-shell.webp" alt="" />{fmt(-e.shells)} shells spent</span>{/if}
                      {#if e.eggs}<span class="g"><img src="{base}game/egg-common.webp" alt="" />{e.eggs === 1 ? 'An egg' : `${e.eggs} eggs`}</span>{/if}
                      {#each counted(e.medals ?? []) as md (md.id)}<span class="g"><img src={medalPic(md.id)} alt="" />{AWARD[md.id]?.name ?? 'A medal'}{md.n > 1 ? ` ×${md.n}` : ''}</span>{/each}
                      {#each e.stickers ?? [] as st (st)}<span class="g"><img src="{base}game/icon-stickers.webp" alt="" />{STICKER[st]?.name ?? 'A sticker'}</span>{/each}
                      {#each e.glimmers ?? [] as gl (gl)}<span class="g"><img class="face" src="{base}game/glimmers/face/{gl}{evo(gl) ? '-evo' : ''}.webp" alt="" />{glimmerName(gl as GlimmerId, evo(gl))}</span>{/each}
                    </div>
                  </div>
                </li>
              {/each}
            </ol>
          {/each}
          {#if events.length > shown}<button class="btn more" onclick={() => { sfx.click(); shown += 40; }}>Show more</button>{/if}
        {:else}
          <p class="empty">Stars, shells, eggs, medals, stickers and Glimmers you earn show up here, with when and where you got them.</p>
        {/if}
      </section>
    </div>
  </div>
</div>

<style>
  .prog { display: flex; flex-direction: column; background: linear-gradient(#f3f9ff, #fbf8ff 40%); }
  .body { flex: 1; min-height: 0; padding: 16px 22px 36px; }
  .wrap { width: min(1320px, 100%); margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; align-items: start; }
  .lc { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .card { padding: 12px 16px 14px; border-radius: 24px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .card header { display: flex; align-items: center; gap: 8px; }
  .card header > img { width: 36px; height: 36px; object-fit: contain; }
  h2 { margin: 0; font-size: 23px; color: var(--ink); }
  .pill { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font: 600 16px var(--font-ui); color: var(--ink); background: #fff8e6; padding: 3px 12px; border-radius: 999px; white-space: nowrap; }
  .pill img { width: 22px; height: 22px; }
  .words { margin: 0; font: 600 16px/1.35 var(--font-ui); color: var(--ink); }
  .sub { margin: 0; font: 600 14px/1.35 var(--font-body); color: var(--ink2); }
  .empty { margin: 0; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .note { margin: 0; font: 600 14px var(--font-body); color: var(--ink2); }
  /* time */
  .days { display: flex; align-items: flex-end; gap: 8px; height: 110px; }
  .dcol { flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 3px; }
  .dcol em { font: 700 12px var(--font-body); font-style: normal; color: var(--ink2); min-height: 15px; }
  .dcol .b { width: 100%; border-radius: 8px 8px 4px 4px; background: #c9bdf2; }
  .dcol .b.goal { background: #3fbf86; }
  .dcol small { font: 700 12px var(--font-body); color: var(--ink2); }
  .dcol.today small { color: var(--primary-edge); }
  .weeks { display: flex; flex-direction: column; gap: 4px; }
  .wk { display: grid; grid-template-columns: 104px 1fr 84px; align-items: center; gap: 8px; }
  .wk small { font: 700 13px var(--font-body); color: var(--ink2); }
  .wk b { font: 700 13px var(--font-body); color: var(--ink); text-align: right; }
  .wb { height: 10px; border-radius: 99px; background: #efeaf8; overflow: hidden; }
  .wb i { display: block; height: 100%; border-radius: 99px; background: #9c84f0; }
  /* going well, keep practising */
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { --ac: #7c5cf5; display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 6px 12px; border-radius: 999px; background: #f6f3fd; box-shadow: inset 0 0 0 2px #ebe5f7; font: 600 16px var(--font-ui); color: var(--ink); }
  .chip i { width: 12px; height: 12px; border-radius: 50%; background: var(--ac); flex: none; }
  .chip img { width: 24px; height: 24px; object-fit: contain; }
  .well .chip { background: #effaf4; box-shadow: inset 0 0 0 2px #cdeedd; }
  .chip.keys { border-radius: 18px; }
  .chip.keys span { font: 700 14px var(--font-body); color: var(--ink2); }
  kbd { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 4px; box-sizing: border-box; border-radius: 8px; background: #fff; box-shadow: 0 2px 0 #d6cdea, inset 0 0 0 1px #e1d9f1; font: 600 16px var(--font-ui); color: var(--ink); }
  button.chip { border: 0; cursor: pointer; transition: transform .14s; }
  button.chip:hover { transform: translateY(-2px); box-shadow: inset 0 0 0 2px #c9b8ff; }
  .chip .arr { width: 18px; height: 18px; }
  /* practice done */
  .tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .tile { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 16px; background: #f8f6fd; }
  .tile b { font: 600 24px/1.1 var(--font-ui); color: var(--ink); }
  .tile b small { font: 700 14px var(--font-body); color: var(--ink2); }
  .tile span { font: 700 13px/1.25 var(--font-body); color: var(--ink2); }
  .tb { display: block; height: 7px; border-radius: 99px; background: #e9e4f6; overflow: hidden; margin-top: 3px; }
  .tb i { display: block; height: 100%; background: #7c5cf5; border-radius: 99px; }
  .go { display: flex; gap: 8px; flex-wrap: wrap; }
  .go .btn { display: inline-flex; align-items: center; gap: 6px; font-size: 17px; padding: 6px 14px 6px 8px; }
  .go .btn img { width: 26px; height: 26px; object-fit: contain; }
  /* what I earned */
  .week { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; padding: 8px 12px; border-radius: 16px; background: #fff8e6; }
  .wl { font: 600 16px var(--font-ui); color: #8a5a00; margin-right: 4px; }
  .tot { display: inline-flex; align-items: center; gap: 4px; font: 700 14px var(--font-body); color: var(--ink2); }
  .tot b { font: 600 17px var(--font-ui); color: var(--ink); }
  .tot img { width: 22px; height: 22px; object-fit: contain; }
  .dh { margin: 6px 0 0; font-size: 16px; color: var(--ink2); }
  .evs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ev { display: grid; grid-template-columns: 70px 1fr; gap: 8px; align-items: start; padding: 8px 10px; border-radius: 16px; background: #faf8fe; }
  .when { font: 700 13px/1.6 var(--font-body); color: var(--ink2); }
  .what { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .what > b { font: 600 16px/1.25 var(--font-ui); color: var(--ink); }
  .what .nm { font-weight: 500; color: var(--ink2); }
  .got { display: flex; flex-wrap: wrap; gap: 4px 6px; }
  .g { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px 2px 4px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px #ebe5f7; font: 700 13.5px var(--font-body); color: var(--ink); }
  .g img { width: 22px; height: 22px; object-fit: contain; }
  .g img.face { border-radius: 50%; object-fit: cover; }
  .g.spent { color: var(--ink2); background: #f6f4f9; }
  .g.bought { padding-left: 10px; } .g.bought img { margin-left: -6px; }
  .more { align-self: center; margin-top: 4px; }
  @media (max-width: 900px) {
    .body { padding: 10px 10px 28px; }
    .wrap { grid-template-columns: 1fr; gap: 12px; }
    .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .wk { grid-template-columns: 90px 1fr 76px; }
    h2 { font-size: 21px; }
    .ev { grid-template-columns: 58px 1fr; padding: 6px 8px; }
  }
</style>
