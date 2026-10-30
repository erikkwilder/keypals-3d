<script lang="ts">
  // My progress (a page of My stuff): how each subject is going in plain words (stars, what you're
  // working on, how far along) and the minutes played this week.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { ALL_LESSONS, REGION, lessonTitle } from '../engine/course';
  import { dayKey, nextLesson, passed, totalStars } from '../engine/profile';
  import { mathOf, mathStarsTotal, nextMathLesson, stageCounts, ALL_GARDEN_IDS } from '../math/progress';
  import { MATH_LESSONS, MATH_REGION, STRAND } from '../math/course';
  import { AREAS } from '../math/skills/registry';
  import { SKILL_LESSONS } from '../math/skills/course';
  import { openSubjectPage } from '../nav';
  import Header from '../ui/Header.svelte';
  import Ring from '../ui/Ring.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
  const blooms = $derived(stageCounts(m, ALL_GARDEN_IDS)[3]);
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
</script>

<div class="screen prog">
  <Header />
  <div class="body scroll">
    <section class="progress">
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
          <button class="btn" onclick={() => { sfx.click(); openSubjectPage('typing'); }}>Typing</button>
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
          <button class="btn" onclick={() => { sfx.click(); openSubjectPage('math'); }}>Math</button>
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
  .prog { display: flex; flex-direction: column; background: linear-gradient(#f3f9ff, #fbf8ff 40%); }
  .body { flex: 1; min-height: 0; padding: 18px 24px 40px; display: flex; flex-direction: column; align-items: center; }
  .progress { width: min(1240px, 100%); }
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
  @media (max-width: 1100px) { .subjects { grid-template-columns: 1fr 1fr; } .subj.week { grid-column: 1 / -1; } }
  @media (max-width: 760px) { .body { padding: 12px 12px 30px; } .subjects { grid-template-columns: 1fr; } }
</style>
