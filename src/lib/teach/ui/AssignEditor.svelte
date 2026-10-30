<script lang="ts">
  // Making (or changing) class work: what to practise, the goal, the due date, who it's for and how
  // it's scored. Math skills can be picked by area, one by one, or by Common Core standard. A unit is a
  // list of My path items in order: start from one of the path's units and change it, or build one from
  // skills, Learn episodes, games, battles and a unit check.
  import { untrack } from 'svelte';
  import { teach, act, saveAssignment } from '../teacher.svelte';
  import { REGIONS } from '../../engine/course';
  import { AREA, AREAS, SKILL } from '../../math/skills/registry';
  import type { AreaId } from '../../math/skills/types';
  import { pathOf, gradeName, itemOf, KIND_NAME, type Unit } from '../../path/units';
  import { SUBJECT } from '../../subjects';
  import { WORLD_PINS } from '../../adventure/worlds';
  import { CHECK_AREAS, EPISODES, GOALS_FOR, GOAL_DEFAULT, LIVE_SKILLS, STANDARDS, WHAT_NAME, endOfDay, goalText, partName, skillsForStandard, skillsInArea, type Assignment, type AssignmentData, type GoalType, type Scoring, type What } from '../assignments';

  type Props = { editing: Assignment | null; done: () => void };
  let { editing, done }: Props = $props();
  const c = $derived(teach.current!);
  const active = $derived(c.students.filter(s => s.status === 'active'));
  // (the editor is made fresh for each assignment: its starting values come from it once)
  const e = untrack(() => editing);
  let what = $state<What>(e?.what ?? 'skills');
  let pickBy = $state<'area' | 'skill' | 'standard'>('area');
  let area = $state<string>(e?.skills[0] ? SKILL[e.skills[0]]?.area ?? 'fractions' : 'fractions');
  let standard = $state<string>(STANDARDS[0]);
  let skills = $state<string[]>(e?.skills ?? skillsInArea('fractions'));
  let lessons = $state<string[]>(e?.lessons ?? []);
  let episodes = $state<string[]>(e?.episodes ?? []);
  let areas = $state<string[]>(e?.areas ?? []);
  let goalType = $state<GoalType>(e?.goal.type ?? 'right');
  let goalN = $state<number>(e?.goal.n ?? GOAL_DEFAULT.right);
  const iso = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let due = $state<string>(e?.due ? iso(e.due) : iso(Date.now() + 7 * 86400000));
  let who = $state<'all' | 'some'>(e?.students ? 'some' : 'all');
  let chosen = $state<string[]>(e?.students ?? []);
  let scoring = $state<Scoring>(e?.scoring ?? 'completion');
  let title = $state(e?.title ?? '');
  let titleTouched = $state(!!e);
  let by = $state(e ? e.by : AREA.fractions.name);
  // a unit: its items in order, the path unit it started from, and its subject
  let items = $state<string[]>(e?.items ?? []);
  let unitId = $state<string>(e?.unit ?? '');
  let unitSubject = $state<string>(e?.subject ?? 'math');
  const pathUnits = $derived(pathOf(unitSubject));
  const unitGroups = $derived.by(() => {
    const out: { name: string; units: Unit[] }[] = [];
    for (const u of pathUnits) { const n = u.grade === null ? u.part : gradeName(u.grade); const g = out.at(-1); if (g && g.name === n) g.units.push(u); else out.push({ name: n, units: [u] }); }
    return out;
  });
  function pickUnit(id: string) {
    unitId = id;
    const u = pathUnits.find(x => x.id === id);
    if (u) { items = u.items.map(i => i.ref); if (!titleTouched) title = u.name; }
  }
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; items = n; };
  let addKind = $state<'ep' | 'skill' | 'game' | 'battle' | 'check'>('skill');
  let addWhat = $state('');
  const ADD_KINDS = [{ id: 'skill', name: 'Practise a skill' }, { id: 'ep', name: 'A Learn episode' }, { id: 'game', name: 'A game round' }, { id: 'battle', name: 'A battle' }, { id: 'check', name: 'A unit check' }] as const;
  const addChoices = $derived<{ id: string; name: string }[]>(addKind === 'skill' ? LIVE_SKILLS.map(x => ({ id: x.id, name: `${x.name} (${x.grade === 0 ? 'K' : `gr. ${x.grade}`})` }))
    : addKind === 'ep' ? (SUBJECT.math?.ways.learn.things ?? []).map(t => ({ id: t.id, name: t.name }))
    : addKind === 'game' ? (SUBJECT.math?.ways.games.things ?? []).filter(t => t.kind === 'arcade' && !t.soon).map(t => ({ id: t.id, name: t.name }))
    : addKind === 'battle' ? WORLD_PINS.filter(w => w.map).map(w => ({ id: w.id, name: w.name })) : []);
  function addItem() {
    const ref = addKind === 'check' ? 'check' : `${addKind}:${addWhat || addChoices[0]?.id}`;
    if (!ref.endsWith(':undefined') && !items.includes(ref)) items = [...items, ref];
  }

  const parts = $derived(({ skills, typing: lessons, learn: episodes, check: areas, unit: items } as Record<What, string[]>)[what]);
  const autoTitle = $derived.by(() => {
    if (what === 'unit') return pathUnits.find(u => u.id === unitId)?.name ?? 'Our unit';
    if (what === 'skills') return by || (skills.length === 1 ? SKILL[skills[0]]?.name : `${skills.length} math skills`) || 'Math practice';
    const names = parts.map(id => partName({ what }, id));
    const head = what === 'check' ? 'Show What You Know: ' : '';
    return names.length ? head + (names.length <= 2 ? names.join(' and ') : `${names[0]} and ${names.length - 1} more`) : WHAT_NAME[what];
  });
  $effect(() => { if (!titleTouched) title = autoTitle; });
  $effect(() => { if (!GOALS_FOR[what].includes(goalType)) { goalType = GOALS_FOR[what][0]; goalN = GOAL_DEFAULT[goalType]; } });

  function setWhat(w: What) { if (w === what) return; what = w; goalType = GOALS_FOR[w][0]; goalN = GOAL_DEFAULT[goalType]; if (w === 'learn') scoring = 'completion'; }
  function pickArea(a: string) { area = a; skills = skillsInArea(a); by = AREA[a as AreaId]?.name ?? ''; }
  function pickStandard(code: string) { standard = code; skills = skillsForStandard(code); by = code; }
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const liveAreas = AREAS.filter(a => a.live);

  async function save() {
    const data: AssignmentData = {
      title: title.trim() || autoTitle, what, skills: what === 'skills' ? skills : [], lessons: what === 'typing' ? lessons : [], episodes: what === 'learn' ? episodes : [], areas: what === 'check' ? areas : [],
      by: what === 'skills' ? by : '', goal: { type: goalType, n: Math.max(1, Math.round(goalN || 1)) }, scoring,
      ...(what === 'unit' ? { items, subject: unitSubject, ...(unitId ? { unit: unitId } : {}) } : {}),
      start: e?.start ?? Date.now(), due: due ? endOfDay(due) : null, students: who === 'some' ? chosen : null,
    };
    const r = await act(() => saveAssignment(data, e?.id, e?.archived), e ? 'Saved.' : 'Class work made. Students see it on their Class work card.');
    if (r) done();
  }
  const ready = $derived(parts.length > 0 && (who === 'all' || chosen.length > 0));
</script>

<div class="tp ed">
  <h3>{e ? 'Change class work' : 'New class work'}</h3>
  <div class="sec">
    <span class="lab">What</span>
    <div class="seg">{#each Object.entries(WHAT_NAME) as [w, name] (w)}<button class:on={what === w} onclick={() => setWhat(w as What)}>{name}</button>{/each}</div>
  </div>

  {#if what === 'skills'}
    <div class="sec">
      <span class="lab">Pick by</span>
      <div class="seg small">
        <button class:on={pickBy === 'area'} onclick={() => (pickBy = 'area')}>Area</button>
        <button class:on={pickBy === 'skill'} onclick={() => (pickBy = 'skill')}>Skill</button>
        <button class:on={pickBy === 'standard'} onclick={() => (pickBy = 'standard')}>Common Core standard</button>
      </div>
      {#if pickBy === 'area'}
        <div class="chips">{#each liveAreas as a (a.id)}<button class="pick" class:on={area === a.id && by === a.name} style:--ac={a.color} onclick={() => pickArea(a.id)}>{a.name} <small>gr. {a.grades}</small></button>{/each}</div>
      {:else if pickBy === 'standard'}
        <select value={standard} onchange={(ev) => pickStandard((ev.currentTarget as HTMLSelectElement).value)}>
          {#each STANDARDS as code (code)}<option value={code}>{code}: {LIVE_SKILLS.filter(s => s.standard === code).map(s => s.name).join(', ')}</option>{/each}
        </select>
      {:else}
        <div class="list">
          {#each liveAreas as a (a.id)}
            <b>{a.name}</b>
            {#each LIVE_SKILLS.filter(s => s.area === a.id) as s (s.id)}
              <label><input type="checkbox" checked={skills.includes(s.id)} onchange={() => { skills = toggle(skills, s.id); by = ''; }} /> {s.name} <small>{s.grade === 0 ? 'K' : `gr. ${s.grade}`} · {s.standard}</small></label>
            {/each}
          {/each}
        </div>
      {/if}
      <p class="sum">{skills.length ? `Skills: ${skills.map(id => SKILL[id]?.name).join(', ')}` : 'No skills picked yet.'}</p>
    </div>
  {:else if what === 'typing'}
    <div class="sec"><span class="lab">Lessons</span>
      <div class="list">
        {#each REGIONS as r (r.id)}
          <b>{r.name}</b>
          {#each r.lessons as l (l.id)}<label><input type="checkbox" checked={lessons.includes(l.id)} onchange={() => (lessons = toggle(lessons, l.id))} /> {l.title}</label>{/each}
        {/each}
      </div>
    </div>
  {:else if what === 'unit'}
    <div class="sec"><span class="lab">Start from a unit on My path</span>
      <div class="row">
        <div class="seg small">{#each ['math', 'typing'] as sj (sj)}<button class:on={unitSubject === sj} onclick={() => { unitSubject = sj; unitId = ''; items = []; }}>{SUBJECT[sj]?.name ?? sj}</button>{/each}</div>
        <select value={unitId} onchange={(ev) => pickUnit((ev.currentTarget as HTMLSelectElement).value)} aria-label="Which unit">
          <option value="">Build my own</option>
          {#each unitGroups as g (g.name)}<optgroup label={g.name}>{#each g.units as u (u.id)}<option value={u.id}>Unit {u.n}: {u.name} ({u.part})</option>{/each}</optgroup>{/each}
        </select>
      </div>
      <p class="muted">Students see the unit at the top of My path and on their Class work card, and work through it in this order. Change the order, take things out or add more.</p>
    </div>
    <div class="sec"><span class="lab">In this unit ({items.length})</span>
      {#if items.length}
        <ol class="ulist">
          {#each items as ref, i (ref)}
            {@const it = itemOf(ref, unitSubject)}
            <li><span class="k">{KIND_NAME[it.kind]}</span><b>{it.name}</b>
              <span class="mv"><button class="sbtn" disabled={i === 0} onclick={() => move(i, -1)}>Earlier</button><button class="sbtn" disabled={i === items.length - 1} onclick={() => move(i, 1)}>Later</button><button class="sbtn warn" onclick={() => (items = items.filter(x => x !== ref))}>Take out</button></span></li>
          {/each}
        </ol>
      {:else}<p class="muted">Nothing yet: pick a unit above, or add things below.</p>{/if}
      <div class="row add">
        <select bind:value={addKind} onchange={() => (addWhat = '')} aria-label="Add what kind">{#each ADD_KINDS as k (k.id)}<option value={k.id}>{k.name}</option>{/each}</select>
        {#if addKind !== 'check'}<select bind:value={addWhat} aria-label="Which one">{#each addChoices as x (x.id)}<option value={x.id}>{x.name}</option>{/each}</select>{/if}
        <button class="sbtn" onclick={addItem}>Add</button>
      </div>
    </div>
  {:else if what === 'learn'}
    <div class="sec"><span class="lab">Episodes</span>
      <div class="list">{#each EPISODES as ep (ep.id)}<label><input type="checkbox" checked={episodes.includes(ep.id)} onchange={() => (episodes = toggle(episodes, ep.id))} /> {ep.title}</label>{/each}</div>
    </div>
  {:else}
    <div class="sec"><span class="lab">Areas</span>
      <p class="muted">A quick mixed check. Students skip ahead past what they already know, and you see where they are.</p>
      <div class="chips">{#each CHECK_AREAS as a (a)}<button class="pick" class:on={areas.includes(a)} style:--ac={AREA[a as AreaId].color} onclick={() => (areas = toggle(areas, a))}>{AREA[a as AreaId].name}</button>{/each}</div>
    </div>
  {/if}

  <div class="grid2">
    <div class="sec">
      <span class="lab">Goal</span>
      <div class="row">
        <select bind:value={goalType} onchange={() => (goalN = GOAL_DEFAULT[goalType])}>{#each GOALS_FOR[what] as g (g)}<option value={g}>{goalText({ what, goal: { type: g, n: GOAL_DEFAULT[g] } }).replace(/^\d+ /, g === 'right' || g === 'minutes' ? 'A number of ' : '')}</option>{/each}</select>
        {#if goalType === 'right' || goalType === 'minutes'}<input type="number" min="1" max="100000" bind:value={goalN} aria-label="How many" class="num" /><span>{goalType === 'minutes' ? 'minutes' : what === 'typing' ? 'words typed right' : 'right answers'}</span>{/if}
      </div>
    </div>
    <div class="sec">
      <span class="lab">Due</span>
      <div class="row"><input type="date" bind:value={due} /><button class="sbtn" onclick={() => (due = '')}>No due date</button></div>
    </div>
    <div class="sec">
      <span class="lab">Scored by</span>
      <div class="seg small">
        <button class:on={scoring === 'completion'} onclick={() => (scoring = 'completion')}>Finishing it</button>
        <button class:on={scoring === 'accuracy'} disabled={what === 'learn'} onclick={() => (scoring = 'accuracy')}>Accuracy</button>
        <button class:on={scoring === 'both'} disabled={what === 'learn'} onclick={() => (scoring = 'both')}>Both</button>
      </div>
    </div>
    <div class="sec">
      <span class="lab">For</span>
      <div class="seg small"><button class:on={who === 'all'} onclick={() => (who = 'all')}>The whole class</button><button class:on={who === 'some'} onclick={() => (who = 'some')}>Chosen students</button></div>
      {#if who === 'some'}<div class="kids">{#each active as s (s.id)}<label><input type="checkbox" checked={chosen.includes(s.id)} onchange={() => (chosen = toggle(chosen, s.id))} /> {s.name}</label>{/each}</div>{/if}
    </div>
  </div>
  <div class="sec">
    <span class="lab">Title students see</span>
    <input class="title" bind:value={title} oninput={() => (titleTouched = true)} maxlength="80" />
  </div>
  <div class="row end">
    <button class="btn" onclick={done}>Cancel</button>
    <button class="btn btn-primary" disabled={!ready || teach.busy} onclick={save}>{e ? 'Save' : 'Give it to the class'}</button>
  </div>
</div>

<style>
  .ed { border-color: #c9b8ff; }
  .sec { margin: 12px 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
  .lab { font: 800 12px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: #7a7092; }
  .seg { display: inline-flex; flex-wrap: wrap; border: 1.5px solid #d8cfee; border-radius: 12px; overflow: hidden; }
  .seg button { border: 0; background: #fff; padding: 9px 14px; font: 800 14px var(--font-body); color: #4a4061; cursor: pointer; border-right: 1px solid #ece6f6; }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: #7c5cf5; color: #fff; }
  .seg button:disabled { opacity: .4; cursor: default; }
  .seg.small button { padding: 7px 12px; font-size: 13.5px; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .pick { border: 2px solid #e4dcf4; background: #fff; border-radius: 12px; padding: 8px 12px; font: 800 14px var(--font-body); color: #2b2140; cursor: pointer; border-left: 6px solid var(--ac, #7c5cf5); }
  .pick small { color: #7a7092; font-weight: 700; }
  .pick.on { background: #f3eeff; border-color: #a48bff; border-left-color: var(--ac, #7c5cf5); }
  .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 2px 18px; max-height: 300px; overflow: auto; width: 100%; padding: 8px 10px; border: 1px solid #ece6f6; border-radius: 12px; background: #fcfbff; }
  .list b { grid-column: 1 / -1; font: 800 13px var(--font-body); color: #6d6680; margin-top: 8px; }
  .list label, .kids label { font: 600 14px var(--font-body); color: #2b2140; display: flex; gap: 6px; align-items: baseline; cursor: pointer; }
  .list small { color: #7a7092; font-weight: 700; }
  .sum { font: 700 13.5px/1.5 var(--font-body); color: #4a4061; margin: 0; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .num { width: 100px; }
  .kids { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .title { width: min(560px, 100%); }
  .ulist { margin: 0; padding: 0 0 0 22px; width: 100%; display: flex; flex-direction: column; gap: 4px; }
  .ulist li { font: 600 14px var(--font-body); color: #2b2140; padding: 4px 0; border-bottom: 1px solid #f0ecf7; }
  .ulist .k { display: inline-block; min-width: 92px; font: 800 11.5px var(--font-body); text-transform: uppercase; letter-spacing: .05em; color: #7a7092; }
  .ulist .mv { float: right; display: inline-flex; gap: 4px; }
  .add { margin-top: 6px; }
  .add select { max-width: 340px; }
  .end { justify-content: flex-end; margin-top: 10px; }
  @media (max-width: 760px) { .grid2 { grid-template-columns: 1fr; } }
</style>
