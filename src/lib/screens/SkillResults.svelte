<script lang="ts">
  // The end of a skill trip, in the results layout every game shares (ui/RunResults.svelte), with its own
  // block: every question of the trip coloured by how it went, the ones to practise with their answers,
  // and what grew in the garden.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { danceOf, palOf } from '../engine/profile';
  import { RIDES, rideName } from '../engine/rides';
  import { endMessage } from '../engine/scoring';
  import { RunScene } from '../three/runScene';
  import { STRIDE } from '../math/course';
  import { MATH_TREASURE, mathGoal, MATH_RIDE } from '../math/meter';
  import { mathOf } from '../math/progress';
  import { AREA, keyLabel } from '../math/skills/registry';
  import { SKILL_LESSON, SKILL_REGION, nextSkillLesson, tempoOf } from '../math/skills/course';
  import RunResults from '../ui/RunResults.svelte';
  import { foundText } from '../math/skills/placement';

  const last = game.skillLast;
  const p = game.profile!;
  const grown = p.settings.grown;
  const lesson = SKILL_LESSON[last?.lessonId ?? 'frac-a-1'];
  const area = AREA[lesson.area];
  const regionName = lesson.region === 'start' ? area.name : SKILL_REGION[lesson.region].name;
  const tempo = tempoOf(lesson.area);
  const st = last?.stats;
  const goal = mathGoal(lesson.goal, grown, p.settings.easy);
  const passed = (last?.stars ?? 0) > 0;
  const next = nextSkillLesson(mathOf(p), lesson.area);
  const title = !last ? '' : !passed ? (last.finished ? 'So close!' : 'Trip over') : st!.misses === 0 ? (last.stars === 3 ? 'Perfect trip!' : 'No misses!') : last.stars === 3 ? 'Three stars!' : last.stars === 2 ? 'Great job!' : 'Trip done!';
  const tested = last?.testedOut ?? [];
  const sub = !last ? '' : last.regionJustDone ? `${SKILL_REGION[last.regionJustDone].name} complete!` : tested.length ? `You skipped ahead: ${tested.length} ${tested.length === 1 ? 'lesson' : 'lessons'} done already!` : passed ? `${lesson.title} · ${regionName}` : 'Right answers first, then speed. You can do it!';
  const word = last && st ? endMessage(last.stars, { record: last.newBestScore, improved: last.newBestScore, sloppy: st.acc < 0.85 && last.stars < 3 }) : '';
  const chips = last && st ? [
    { icon: 'clock' as const, value: Math.round(st.fpm), label: 'right a minute' },
    { icon: 'target' as const, value: `${Math.round(st.acc * 100)}%`, label: 'right first time' },
    { icon: 'trophy' as const, value: goal, label: `goal · best ${last.record.bestScore}`, badge: last.newBestScore && 'Record!' },
    { icon: 'ride' as const, value: rideName(last.bestRide, lesson.move), label: 'top speed', badge: last.newBestRide && 'Best!' },
  ] : [];
  const rideTh = grown ? MATH_RIDE.grown : MATH_RIDE.kids;
  const goalText = !last || !st ? '' : last.stars < 3 ? `Next goal: a score of ${goal} for three stars. Right first time counts most, then speed.`
    : RIDES[last.bestRide + 1] ? `Next goal: reach ${rideName(last.bestRide + 1, lesson.move)} (about ${Math.round(rideTh[last.bestRide + 1] / tempo)} right a minute).` : 'Top speed and three stars. Try the next trip!';
  const strip = (last?.results ?? []).map(r => ({ text: r.label, kind: r.intro ? 'new' : r.speed }));
  const practise = [...new Set((last?.results ?? []).filter(r => !r.intro && !r.ok).map(r => r.key))].map(keyLabel);
  const grew = last?.grew ?? { bloomed: [], budded: [], sprouted: [] };
  // treasure thresholds as this area's scores (each skill question is worth `tempo` facts)
  const treasureAt = (grown ? MATH_TREASURE.grown : MATH_TREASURE.kids).map(v => Math.ceil(v / tempo));
  onMount(() => { if (!last) game.go('map'); });
</script>

{#if last && st}
  <RunResults move={lesson.move} run={last} {title} {sub} {word} score={st.score} goalScore={goal} {passed} {chips}
    {treasureAt} treasureWhere="on a {area.name.toLowerCase()} trip" rideHint="Quicker answers reach"
    {goalText} openedText={last.regionJustDone ? `${SKILL_REGION[last.regionJustDone].name} is done!` : null} nextTitle={next.title}
    makeScene={() => RunScene.create({ buddy: p.buddy, outfit: palOf(p).outfit, dance: danceOf(p), length: 20, region: lesson.world, move: lesson.move, keyLen: STRIDE[lesson.move] })}
    onretry={() => game.startSkill(lesson.id, true)} onnext={() => game.startSkill(next.id)} onhome={() => game.go('hub')}
    progress={{ label: 'Garden', tone: 'mint', art: gardenArt, onclick: () => { game.mathArea = lesson.area; game.mathOp = null; game.go('garden'); } }}>
    {#snippet extra()}
      {#if last.placed}<div class="found"><b>For grown-ups: what Show What You Know found</b><p>{foundText(last.placed, p.name)}</p></div>{/if}
      <div class="bhead"><b>This trip</b><span class="legend"><i class="fast"></i>quick <i class="slow"></i>slow <i class="miss"></i>missed <i class="new"></i>new</span></div>
      <div class="strip">{#each strip as f, i (i)}<span class="fc {f.kind}" style:--d="{i * 40}ms">{f.text}</span>{/each}</div>
      {#if practise.length || grew.bloomed.length || grew.budded.length || grew.sprouted.length}
        <div class="row2">
          {#if practise.length}<div class="pr"><b class="ph">Practise</b>{#each practise as t}<span class="pf">{t}</span>{/each}</div>{/if}
          {#if grew.bloomed.length || grew.budded.length || grew.sprouted.length}
            <div class="grew" title="New growth in your garden">
              {#if grew.bloomed.length}<span class="g"><img class="gst" src="{import.meta.env.BASE_URL}icons/bloom.webp" alt="" /><b>{grew.bloomed.length}</b> bloomed</span>{/if}
              {#if grew.budded.length}<span class="g"><img class="gst" src="{import.meta.env.BASE_URL}garden/bud.webp" alt="" /><b>{grew.budded.length}</b> budding</span>{/if}
              {#if grew.sprouted.length}<span class="g"><img class="gst" src="{import.meta.env.BASE_URL}garden/sprout.webp" alt="" /><b>{grew.sprouted.length}</b> sprouted</span>{/if}
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}
  </RunResults>
{/if}

{#snippet gardenArt()}<img class="gst big" src="{import.meta.env.BASE_URL}icons/garden.webp" alt="" />{/snippet}

<style>
  .found { background: #eef6ff; border: 2px solid #cfe3ff; border-radius: 16px; padding: 8px 12px; margin: 2px 0 10px; }
  .found b { display: block; font: 600 16px var(--font-ui); color: var(--ink); margin-bottom: 2px; }
  .found p { margin: 0; font: 600 14px/1.4 var(--font-body); color: var(--ink2); }
  .bhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 4px 0 5px; }
  .bhead b { font: 600 17px var(--font-ui); }
  .legend { font: 700 12px var(--font-body); color: var(--muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .legend i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; margin-left: 6px; }
  .strip { display: flex; flex-wrap: wrap; gap: 4px; }
  .fc { font: 700 12px var(--font-body); padding: 1px 5px; border-radius: 7px; white-space: nowrap; animation: pop-in .35s var(--d) cubic-bezier(.3, .8, .4, 1.5) both; }
  .fast, .fc.fast { background: #c9f1dd; color: #0f5a3c; }
  .slow, .fc.slow { background: #fff0b8; color: #6a5200; }
  .miss, .fc.miss { background: #fbd3e2; color: #8a1f4a; }
  .new, .fc.new { background: #e6ddff; color: #4a2ea8; }
  .row2 { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 12px; margin-top: 8px; }
  .pr { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .ph { font: 600 17px var(--font-ui); margin-right: 2px; }
  .pf { font: 700 14px var(--font-body); background: #fff7d6; border-radius: 10px; padding: 2px 8px; }
  .grew { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .g { display: flex; align-items: center; gap: 3px; font: 700 13.5px var(--font-body); color: var(--ink2); }
  .g b { font: 600 18px var(--font-ui); color: var(--ink); }
  .gst { width: 28px; height: 28px; object-fit: contain; vertical-align: middle; }
  .gst.big { width: 40px; height: 40px; }
</style>
