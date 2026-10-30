<script lang="ts">
  // My path: one place that says what to do next, like a syllabus. Each subject (a tab for each, from
  // subjects.ts) is a list of units in order; each unit mixes the four ways to play (Learn, practice
  // trips, a game round, an Adventure battle) and ends with a unit check. Done items are crossed off with
  // a tick, the one to do next has a big Next button, and each unit says in words how it's going (getting
  // started, comfortable, strong). Units Show What You Know (or anything else) showed are "You know
  // this": open to look back at, never locked. A teacher's units come first. It's a guide: everything
  // else in the game stays open (path/rules.ts says when a grown-up or teacher keeps a player to it).
  import { onMount, tick } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import Bar from '../ui/Bar.svelte';
  import PageTabs from '../ui/PageTabs.svelte';
  import TodayCard from '../path/TodayCard.svelte';
  import { PATH_SUBJECTS, KIND_ICON, KIND_NAME, kindColor, gradeName } from '../path/units';
  import { LEVEL_WORD, pathStates, unitLevels, type ItemState, type UnitState } from '../path/progress';
  import { classUnits, pathSubject, playerRules } from '../path/player.svelte';
  import { pathView, startItem } from '../path/launch';
  import { SKILL_LESSON } from '../math/skills/course';
  import { MATH_LESSON as FACT_TRIP, PLACEMENTS } from '../math/course';
  import { CUR_TOTAL } from '../path/curriculum';
  import { gradeScope, swykId } from '../path/lessonTrips';
  import { PATH_LESSON_IDS, regionGroups } from '../path/units';
  import { factPart } from '../path/lessonTrips';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const subjects = PATH_SUBJECTS();
  // a teacher's unit still to do opens the path on its subject
  const teacherNext = classUnits(game.profile).find(x => x.state.next)?.unit.subject;
  const first = teacherNext ?? pathSubject();
  let subject = $state(subjects.some(s => s.id === first) ? first : subjects[0]?.id ?? 'math');
  const rules = $derived(playerRules(p));
  const states = $derived(pathStates(p, subject, Date.now(), subject === 'math' ? rules.grade : null));
  /** a teacher's units show on every subject's page: they come first */
  const teacherUnits = $derived(classUnits(p));
  const current = $derived(states.find(s => s.status === 'current') ?? null);
  const earlier = $derived(states.filter(s => s.status === 'earlier'));
  const main = $derived(states.filter(s => s.status !== 'earlier'));
  /** the units by grade (math), or all in one list */
  const groups = $derived.by(() => {
    const out: { name: string; units: UnitState[] }[] = [];
    for (const s of main) {
      const name = subject === 'math' ? gradeName(s.unit.grade) : '';
      const g = out.at(-1);
      if (g && g.name === name) g.units.push(s); else out.push({ name, units: [s] });
    }
    return out;
  });
  const doneUnits = $derived(main.filter(s => s.status === 'done' || s.status === 'known').length);
  let opened = $state<Record<string, boolean>>({});
  let showEarlier = $state(false);
  const isOpen = (s: UnitState) => opened[s.unit.id] ?? (s.status === 'current' || (teacherUnits.some(t => t.unit.id === s.unit.id) && !!s.next));
  function toggle(s: UnitState) { sfx.click(); opened = { ...opened, [s.unit.id]: !isOpen(s) }; }
  function pick(id: string) { if (id === subject) return; sfx.click(); subject = id; pathView.subject = id; opened = {}; void tick().then(toCurrent); }
  function go(s: UnitState, it: ItemState) { startItem(p, s.unit, it); }
  /** Show What You Know for a unit: its lessons' skills (a unit of facts: the strand's own check) */
  function unitPlacement(s: UnitState): string | null {
    const id = s.unit.id.slice(5);
    if (SKILL_LESSON[swykId(id)]) return swykId(id);
    const f = (s.unit.lessons ?? []).flatMap(l => factPart(l, regionGroups))[0];
    return f ? PLACEMENTS[f.op].id : null;
  }
  const placement = $derived(current && subject === 'math' && current.done === 0 ? unitPlacement(current) : null);
  /** Show What You Know for a whole grade: offered at the start of the grade (nothing in it done yet) */
  const gradePlacement = $derived.by(() => {
    if (!current || subject !== 'math' || current.unit.grade === null) return null;
    const g = current.unit.grade, id = swykId(gradeScope(g));
    const inGrade = main.filter(x => x.unit.grade === g);
    return SKILL_LESSON[id] && inGrade.every(x => x.done === 0) ? { id, grade: g } : null;
  });
  function place(id: string | null | undefined) {
    if (!id) return;
    sfx.click();
    game.setHome('math');
    if (FACT_TRIP[id]) game.startMath(id);
    else if (SKILL_LESSON[id]) game.startSkill(id);
  }
  /** the four steps of a lesson, as ticks */
  const STEPS = [['learn', 'Learn'], ['tryIt', 'Try it'], ['practice', 'Practice'], ['quick', 'Quick check']] as const;
  const soon = CUR_TOTAL - PATH_LESSON_IDS.length;
  let scroller: HTMLDivElement | undefined = $state();
  /** bring the unit you're on into view (Today stays in sight when it's near the top) */
  function toCurrent() {
    // (a teacher's unit to do is at the top already)
    if (teacherUnits.some(t => t.state.next)) return;
    const el = current && scroller?.querySelector(`[data-unit="${current.unit.id}"]`) as HTMLElement | null;
    if (!el || !scroller) return;
    const top = el.offsetTop - scroller.offsetTop;
    if (top > scroller.clientHeight * 0.45) scroller.scrollTo({ top: Math.max(0, top - 12), behavior: 'instant' as ScrollBehavior });
  }
  onMount(() => { void tick().then(toCurrent); });
  function onKey(e: KeyboardEvent) {
    if (game.modalOpen) return;
    if (e.key === 'Enter' && current?.next) { e.preventDefault(); go(current, current.next); }
  }
  const statusText = (s: UnitState) => s.status === 'done' ? 'Done' : s.status === 'known' ? 'You know this' : s.status === 'current' ? "You're here" : s.status === 'earlier' ? 'Before your grade' : '';
</script>

<svelte:window onkeydown={onKey} />

{#snippet unitCard(s: UnitState, teacher: string | null)}
  {@const open = isOpen(s)}
  <article class="unit {s.status}" class:open style:--uc={s.unit.color} data-unit={s.unit.id}>
    <button class="uhead" onclick={() => toggle(s)} aria-expanded={open}>
      <span class="uart" style:background-image="url({base}{s.unit.art})">{#if s.status === 'done' || s.status === 'known'}<img class="tick" src="{base}icons/check.webp" alt="" />{/if}</span>
      <span class="ut">
        <small>{teacher ? `From ${teacher}` : subject === 'math' && s.unit.grade !== null ? `${gradeName(s.unit.grade)} · Unit ${s.unit.n}` : `Unit ${s.unit.n}`} · {s.unit.part}</small>
        <b>{teacher ? s.unit.name : s.unit.name}</b>
        <span class="bar" title="{s.done} of {s.of} done"><i style:width="{(s.done / Math.max(1, s.of)) * 100}%"></i></span>
      </span>
      <span class="uside">
        {#if statusText(s)}<em class="st {s.status}">{statusText(s)}</em>{/if}
        <span class="lv">{s.done} of {s.of} · {LEVEL_WORD[s.level]}</span>
      </span>
    </button>
    {#if open}
      {@const shown = s.items.filter(x => x.skip !== 'nothing')}
      <ol class="items">
        {#each shown as it, k (it.ref)}
          {@const nx = s.next?.ref === it.ref && (s.status === 'current' || !!teacher)}
          {#if it.day && it.day !== shown[k - 1]?.day}
            {@const dayItems = shown.filter(x => x.day === it.day)}
            {@const dayDone = dayItems.every(x => x.done || x.skip)}
            <li class="dayh" class:done={dayDone}><b>Day {it.day}</b><span>{dayItems.length} thing{dayItems.length === 1 ? '' : 's'} · about {dayItems.reduce((t, x) => t + (x.kind === 'warmup' || x.kind === 'quick' ? 2 : 5), 0)} minutes</span>{#if dayDone}<img src="{base}icons/check.webp" alt="Done" />{/if}</li>
          {/if}
          <li class:done={it.done} class:next={nx} class:known={!!it.skip}>
            <button class="row" onclick={() => go(s, it)} style:--kc={kindColor(it.kind)}>
              <img class="ki" src="{base}{KIND_ICON[it.kind]}" alt="" />
              <span class="it"><span class="nm"><small>{KIND_NAME[it.kind]}</small><b>{it.name}</b></span><span class="ln">{it.line}</span></span>
              {#if it.done}<img class="okimg" src="{base}icons/check.webp" alt="Done" />
              {:else if nx}<span class="nextb">Next</span>
              {:else if it.skip}<span class="kn">You know this</span>
              {:else}<span class="gob">Go</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
      {#if s.lessons.length}
        <ul class="lessons" aria-label="Lessons in this unit">
          {#each s.lessons as l (l.id)}
            <li class:done={l.ticks.done} class:known={l.ticks.known}>
              <span class="ln2">{l.title}</span>
              {#if l.ticks.known}<em class="kn">You know this</em>{/if}
              <span class="ticks">{#each STEPS as [k, name] (k)}{#if k !== 'learn' || l.ticks.learn !== null}<i class:on={!!l.ticks[k]} title="{name}{l.ticks[k] ? ': done' : ''}">{name}</i>{/if}{/each}</span>
            </li>
          {/each}
        </ul>
      {:else if subject === 'math'}
        {@const lv = unitLevels(p, s.unit)}
        {#if lv.length}
          <div class="lvls">{#each lv as x (x.skill)}<span class="lvl {x.level.replace(' ', '-')}">{x.name}<b>{LEVEL_WORD[x.level]}</b></span>{/each}</div>
        {/if}
      {/if}
      {#if s.status === 'current' && placement}
        <div class="skip"><span>Know this unit already? Answer a quick mix and skip ahead past what you know.</span><button class="btn" onclick={() => place(placement)}>Show What You Know</button></div>
      {/if}
    {/if}
  </article>
{/snippet}

<div class="screen mypath">
  <Bar trail="{doneUnits} of {main.length} units done" />
  {#if subjects.length > 1}
    <PageTabs label="Which subject" value={subject} onpick={pick} tabs={subjects.map(x => ({ id: x.id, label: x.name }))} />
  {/if}

  <div class="body scroll" bind:this={scroller}>
    <div class="col">
      <TodayCard onPage {subject} compact={false} />
      {#if teacherUnits.length}
        <h2 class="gh">From your teacher</h2>
        {#each teacherUnits as t (t.unit.id)}{@render unitCard(t.state, t.teacher)}{/each}
      {/if}
      {#if gradePlacement}
        <div class="skip gradeskip"><span>Starting {gradeName(gradePlacement.grade).toLowerCase()}? Answer a quick mix and your path starts at the first lesson you don't know yet. Nothing gets locked.</span><button class="btn" onclick={() => place(gradePlacement?.id)}>Show What You Know</button></div>
      {/if}
      {#if earlier.length}
        <button class="earlier" onclick={() => { sfx.click(); showEarlier = !showEarlier; }}>{showEarlier ? 'Hide' : 'Show'} the {earlier.length} units before {gradeName(rules.grade).toLowerCase()} (open any time)</button>
        {#if showEarlier}{#each earlier as s (s.unit.id)}{@render unitCard(s, null)}{/each}{/if}
      {/if}
      {#each groups as g, gi (gi)}
        {#if g.name}<h2 class="gh">{g.name}</h2>{/if}
        {#each g.units as s (s.unit.id)}{@render unitCard(s, null)}{/each}
      {/each}
      <p class="foot">Your path is a guide. Everything else in Keypals is open too: tap any subject, game or world whenever you like.</p>
      {#if subject === 'math' && soon > 0}<p class="soon">For grown-ups: {PATH_LESSON_IDS.length} math lessons are ready on this path; {soon} more are coming soon.</p>{/if}
    </div>
  </div>
</div>

<style>
  .mypath { display: flex; flex-direction: column; background: linear-gradient(#eaf6ff, #f8f4ff 45%); }
  .ph { flex: none; display: flex; align-items: center; gap: 12px; padding: 8px 20px 6px; max-width: 1040px; width: 100%; margin: 0 auto; }
  .pi { width: 58px; height: 58px; object-fit: contain; filter: drop-shadow(0 3px 3px rgba(60, 30, 110, .2)); }
  .pt { display: flex; flex-direction: column; }
  .pt h1 { margin: 0; font-size: 34px; color: #3d2a86; }
  .pt span { font: 700 14px var(--font-body); color: var(--muted); }
  .subs { margin-left: auto; display: flex; gap: 8px; }
  .subs button { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 6px 16px 6px 8px; border-radius: 999px; background: #fff; font: 600 18px var(--font-ui); color: color-mix(in srgb, var(--sc) 80%, #000); box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--sc) 25%, #fff), 0 4px 0 color-mix(in srgb, var(--sc) 30%, #fff); }
  .subs button img { width: 32px; height: 32px; object-fit: contain; }
  .subs button.on { background: linear-gradient(color-mix(in srgb, var(--sc) 70%, #fff), var(--sc)); color: #fff; box-shadow: 0 4px 0 color-mix(in srgb, var(--sc) 70%, #000); }
  .body { flex: 1; min-height: 0; padding: 6px 20px 40px; }
  .col { max-width: 1000px; margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .gh { margin: 12px 0 0; font: 600 22px var(--font-ui); color: var(--ink2); }
  .earlier { align-self: flex-start; border: 0; background: rgba(255, 255, 255, .8); border-radius: 999px; padding: 8px 16px; font: 700 14px var(--font-body); color: #5a44c4; cursor: pointer; box-shadow: var(--shadow-sm); }

  .unit { --uc: #7c5cf5; background: #fff; border-radius: 22px; box-shadow: 0 0 0 2px color-mix(in srgb, var(--uc) 18%, #fff), 0 10px 22px -18px rgba(40, 20, 80, .5); overflow: hidden; }
  .unit.current { box-shadow: 0 0 0 4px #ffcf5a, 0 14px 30px -16px rgba(200, 140, 0, .55); }
  .unit.done .ut b, .unit.known .ut b { color: #4d6a5a; }
  .uhead { width: 100%; display: flex; align-items: center; gap: 12px; border: 0; background: none; cursor: pointer; padding: 10px 14px; text-align: left; font: inherit; }
  .uart { position: relative; flex: none; width: 64px; height: 64px; border-radius: 16px; background: #e6eef8 center / cover no-repeat; box-shadow: inset 0 0 0 3px rgba(255, 255, 255, .7); }
  .tick { position: absolute; right: -8px; bottom: -8px; width: 34px; height: 34px; }
  .ut { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ut small { font: 800 12px var(--font-body); text-transform: uppercase; letter-spacing: .05em; color: color-mix(in srgb, var(--uc) 75%, #000); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ut b { font: 600 22px/1.15 var(--font-ui); color: var(--ink); }
  .bar { height: 8px; border-radius: 999px; background: #efeaf6; overflow: hidden; max-width: 320px; margin-top: 3px; }
  .bar i { display: block; height: 100%; background: linear-gradient(90deg, #7fe0a8, #2fb36e); border-radius: 999px; }
  .uside { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .st { font: 800 13px var(--font-body); font-style: normal; padding: 3px 12px; border-radius: 999px; background: #efedf3; color: #6d6680; }
  .st.done { background: #c9f1dd; color: #0f5a3c; }
  .st.known { background: #fff0b8; color: #6a5200; }
  .st.current { background: #ffcf5a; color: #5a3a00; }
  .lv { font: 700 13px var(--font-body); color: var(--muted); }

  .items { list-style: none; margin: 0; padding: 0 12px 10px; display: flex; flex-direction: column; gap: 4px; }
  .dayh { display: flex; align-items: center; gap: 10px; padding: 8px 8px 2px; font: 600 14px var(--font-ui); color: #6a5a8a; }
  .dayh b { font: 700 15px var(--font-display, var(--font-ui)); color: #4a3a6a; letter-spacing: .02em; }
  .dayh span { color: #8a7aa8; font-weight: 500; }
  .dayh img { width: 18px; height: 18px; }
  .dayh.done b { color: #2e9e6e; }
  .row { --kc: #7c5cf5; width: 100%; display: flex; align-items: center; gap: 10px; border: 0; cursor: pointer; text-align: left; font: inherit; padding: 5px 10px 5px 6px; border-radius: 14px; background: #faf8fe; box-shadow: inset 0 0 0 2px #f0ebf8; }
  .row:hover { background: #f4f0fd; }
  .ki { width: 36px; height: 36px; object-fit: contain; flex: none; }
  .it { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .nm { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .it small { flex: none; font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .05em; color: color-mix(in srgb, var(--kc) 80%, #000); min-width: 96px; }
  .it b { font: 600 17.5px/1.2 var(--font-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .it .ln { font: 700 12.5px/1.3 var(--font-body); color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 104px; }
  li.done .it b { text-decoration: line-through; text-decoration-thickness: 2px; color: #7c8a84; }
  li.done .ki { opacity: .55; }
  .okimg { width: 32px; height: 32px; flex: none; }
  .gob { flex: none; font: 600 15px var(--font-ui); color: #5a44c4; padding: 4px 12px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px #e2d9f6; }
  li.next .row { background: linear-gradient(#fff8e0, #fff1c4); box-shadow: inset 0 0 0 3px #ffcf5a; }
  .nextb { flex: none; font: 600 22px var(--font-ui); color: #fff; padding: 8px 22px; border-radius: 16px; background: linear-gradient(#a48bff, #7c5cf5); box-shadow: 0 4px 0 #5d42d4; }
  .lvls { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 14px 12px; }
  .lvl { display: inline-flex; gap: 6px; align-items: baseline; font: 700 12.5px var(--font-body); color: var(--ink2); background: #f6f3fb; border-radius: 999px; padding: 3px 10px; }
  .lvl b { font: 800 12px var(--font-body); color: #6d6680; }
  .lvl.getting-started b { color: #8a6a00; }
  .lvl.comfortable b { color: #0f6a44; }
  .lvl.strong b, .lvl.stretching b { color: #1a5a8a; }
  .skip { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 0 14px 12px; padding: 10px 14px; border-radius: 16px; background: #eef7ff; }
  .skip span { flex: 1; min-width: 200px; font: 700 14px var(--font-body); color: #2459a8; }
  .lessons { list-style: none; margin: 0; padding: 2px 14px 12px; display: flex; flex-direction: column; gap: 4px; }
  .lessons li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font: 700 13.5px var(--font-body); color: var(--ink2); padding: 4px 10px; border-radius: 12px; background: #f8f6fc; }
  .lessons .ln2 { flex: 1; min-width: 140px; }
  .lessons li.done .ln2 { color: #4d6a5a; }
  .ticks { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .ticks i { font: 800 11px var(--font-body); font-style: normal; padding: 2px 8px; border-radius: 999px; background: #fff; color: #8a80a0; box-shadow: inset 0 0 0 1.5px #e2d9f1; }
  .ticks i.on { background: #c9f1dd; color: #0f5a3c; box-shadow: none; }
  .ticks i.on::before { content: '✓ '; }
  .kn { font: 800 12px var(--font-body); font-style: normal; color: #6a5200; background: #fff0b8; padding: 2px 10px; border-radius: 999px; flex: none; }
  /* a lesson the child knows: its things stay open, shown small */
  li.known .row { opacity: .8; padding-top: 2px; padding-bottom: 2px; }
  li.known .row .ln { display: none; }
  li.known .ki { height: 28px; }
  li.known .it b { font-size: 15.5px; }
  .gradeskip { margin: 0; }
  .soon { margin: 4px 4px 0; font: 600 12.5px var(--font-body); color: var(--muted); text-align: center; }
  .foot { margin: 14px 4px 0; font: 700 14px var(--font-body); color: var(--muted); text-align: center; }

  @media (max-width: 759px) {
    .ph { padding: 6px 10px 4px; gap: 8px; flex-wrap: wrap; }
    .pi { width: 44px; height: 44px; }
    .pt h1 { font-size: 26px; }
    .subs { margin-left: 0; width: 100%; }
    .subs button { flex: 1; justify-content: center; font-size: 16px; }
    .body { padding: 4px 8px 30px; }
    .uhead { padding: 8px 10px; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .uart { width: 52px; height: 52px; border-radius: 13px; }
    .ut b { font-size: 19px; }
    .uside { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; padding-left: 62px; }
    .items { padding: 0 8px 8px; }
    .row { padding: 7px 8px 7px 6px; gap: 8px; }
    .ki { width: 32px; height: 32px; }
    .it b { font-size: 16px; }
    .nm { flex-direction: column; gap: 0; }
    .it small { min-width: 0; }
    .it .ln { padding-left: 0; }
    .nextb { font-size: 18px; padding: 6px 14px; }
  }
</style>
