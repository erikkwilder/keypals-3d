<script lang="ts">
  // For grown-ups: every math skill in the game by grade and school standard (Common Core), in plain
  // words, with where this child is on each: not started, growing, or solid; and where they're working
  // on it now (the questions the game picks for them: getting started, comfortable, strong, stretching),
  // as words and a little six-step ladder, never a number a child could read as a grade. Areas still to
  // come are listed so the whole K-8 path is visible.
  import { game } from '../state/game.svelte';
  import { groupFacts } from '../math/course';
  import { factId } from '../math/facts';
  import { mathOf } from '../math/progress';
  import { AREAS, skillsOf } from '../math/skills/registry';
  import { skillStatus } from '../math/skills/progress';
  import { workingOf, type Working } from '../math/skills/ability';
  import { foundText } from '../math/skills/placement';
  import type { Skill } from '../math/skills/types';
  import Header from '../ui/Header.svelte';

  // the player the grown-ups picked (kept for the way back)
  const who = game.skillsFor;
  const p = $derived(game.save.profiles.find(x => x.id === who) ?? game.profile!);
  const m = $derived(mathOf(p));
  type Status = 'not started' | 'growing' | 'solid';
  /** a fact strand's skill: solid when most of its facts are in bloom (and the rest buds), growing once met */
  function status(s: Skill): Status {
    if (!s.facts) return skillStatus(m, s.id);
    const ids = s.subs.flatMap(sb => groupFacts(sb.id)).map(factId);
    const st = ids.map(id => m.facts[id]?.stage ?? 0);
    if (st.every(x => x === 0)) return 'not started';
    return st.filter(x => x === 3).length >= ids.length * 0.8 && st.every(x => x >= 2) ? 'solid' : 'growing';
  }
  const grade = (g: number) => (g === 0 ? 'K' : String(g));
  const WORD: Record<Working, string> = { 'not started': 'Not started', 'getting started': 'Getting started', comfortable: 'Comfortable', strong: 'Strong', stretching: 'Stretching' };
  const HINT: Record<Working, string> = { 'not started': '', 'getting started': 'the gentlest questions, with pictures', comfortable: 'grade-level questions', strong: 'bigger numbers, more steps', stretching: 'the hardest versions' };
  const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
  const now = Date.now();
  /** the last Show What You Know in an area (or fact strand), in words */
  const placedText = (key: string) => { const f = m.placed?.[key]; return f ? foundText(f, p.name) : null; };
  const counts = $derived.by(() => { const c = { 'not started': 0, growing: 0, solid: 0 }; for (const a of AREAS) for (const s of skillsOf(a.id)) c[status(s)]++; return c; });
</script>

<div class="screen report">
  <Header title="Math skills" sub="{p.name}: {counts.solid} solid, {counts.growing} growing" back={() => { game.skillsFor = who; game.go('grownups'); }} />
  <div class="body scroll">
    <p class="intro">Every math skill in Keypals from kindergarten to 8th grade, with its school standard, and where {p.name} is on each. <b>Solid</b> means answered right and quickly on different days; <b>growing</b> means started. <b>Working at</b> is how hard {p.name}'s questions are right now: the game aims for about 8 in 10 right, and moves up a step as {p.name} grows (or back down for a while if it's too hard).</p>
    {#each AREAS as a (a.id)}
      {@const ss = skillsOf(a.id)}
      <section class="area" style:--ac={a.color}>
        <div class="ahead"><img src="{import.meta.env.BASE_URL}{a.art}" alt="" class:soon={!a.live} /><div><h2>{a.name}</h2><span>Grades {a.grades}</span></div>{#if !a.live}<em>Coming soon</em>{/if}</div>
        {#if placedText(a.op ?? a.id)}<p class="placed"><b>Show What You Know found:</b> {placedText(a.op ?? a.id)}</p>{/if}
        {#if ss.length}
          <table>
            <thead><tr><th>Grade</th><th>Skill</th><th>In plain words</th><th>Standard</th><th>Where they are</th><th>Working at</th></tr></thead>
            <tbody>
              {#each ss as s (s.id)}
                {@const st = status(s)}
                {@const w = workingOf(m, s.id, now)}
                <tr><td class="g">{grade(s.grade)}</td><td class="n">{s.name}</td><td>{s.plain}</td><td class="c">{s.standard}</td><td><span class="st {st.replace(' ', '-')}">{st === 'not started' ? 'Not started' : st === 'growing' ? 'Growing' : 'Solid'}</span></td>
                  <td class="w">{#if w.word === 'not started'}<span class="none">Not yet</span>{:else}<span class="lad" role="img" aria-label="Working at: {WORD[w.word].toLowerCase()}, the {ORDINAL[w.rung - 1]} of six steps">{#each [1, 2, 3, 4, 5, 6] as k (k)}<i class:on={k <= w.rung} style:height="{5 + k * 2.5}px"></i>{/each}</span><span class="ww"><b>{WORD[w.word]}</b><small>{HINT[w.word]}</small></span>{/if}</td></tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <p class="muted">{a.blurb}</p>
        {/if}
      </section>
    {/each}
  </div>
</div>

<style>
  .report { display: flex; flex-direction: column; background: var(--bg); }
  .body { flex: 1; min-height: 0; padding: 14px 24px 40px; max-width: 1100px; margin: 0 auto; width: 100%; }
  .intro { font: 600 16px/1.45 var(--font-body); color: var(--ink2); margin: 0 0 14px; }
  .area { background: #fff; border-radius: 22px; padding: 14px 16px; margin: 0 0 14px; box-shadow: var(--shadow-sm); border-left: 6px solid var(--ac); }
  .ahead { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .ahead img { width: 92px; height: 46px; object-fit: cover; border-radius: 12px; }
  .ahead img.soon { filter: grayscale(.7) opacity(.7); }
  .ahead h2 { margin: 0; font-size: 22px; }
  .ahead span { font: 700 13px var(--font-body); color: var(--muted); }
  .ahead em { margin-left: auto; font: 800 12px var(--font-body); font-style: normal; color: var(--muted); background: var(--bg2); padding: 4px 10px; border-radius: 99px; }
  table { width: 100%; border-collapse: collapse; font: 600 14.5px/1.4 var(--font-body); color: var(--ink2); }
  th { text-align: left; font: 800 11px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 6px 8px; border-bottom: 2px solid var(--bg2); }
  td { padding: 8px; border-bottom: 1px solid var(--bg2); vertical-align: top; }
  td.g { font: 600 18px var(--font-ui); color: var(--ink); text-align: center; }
  td.n { font: 600 16px var(--font-ui); color: var(--ink); white-space: nowrap; }
  td.c { font-family: ui-monospace, monospace; font-size: 13px; white-space: nowrap; }
  .st { display: inline-block; padding: 3px 10px; border-radius: 99px; font: 800 12px var(--font-body); white-space: nowrap; }
  .st.not-started { background: var(--bg2); color: var(--muted); }
  .st.growing { background: #fff0b8; color: #6a5200; }
  .st.solid { background: #c9f1dd; color: #0f5a3c; }
  .placed { margin: 0 0 8px; font: 600 14px/1.4 var(--font-body); color: var(--ink2); background: #eef6ff; border-radius: 12px; padding: 6px 10px; }
  td.w { white-space: nowrap; }
  .lad { display: inline-flex; align-items: flex-end; gap: 2px; height: 20px; vertical-align: middle; margin-right: 7px; }
  .lad i { width: 5px; border-radius: 2px; background: var(--bg2); }
  .lad i.on { background: var(--ac); }
  .ww { display: inline-flex; flex-direction: column; vertical-align: middle; line-height: 1.15; }
  .ww b { font: 800 13px var(--font-body); color: var(--ink); }
  .ww small { font: 600 11.5px var(--font-body); color: var(--muted); white-space: normal; max-width: 150px; }
  .none { font: 700 12px var(--font-body); color: var(--muted); }
  @media (max-width: 700px) {
    .body { padding: 10px 10px 30px; }
    th:nth-child(3), td:nth-child(3), th:nth-child(4), td:nth-child(4) { display: none; }
    td.n { white-space: normal; }
  }
</style>
