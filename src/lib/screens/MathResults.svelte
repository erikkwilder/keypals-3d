<script lang="ts">
  // The end of a math trip, in the results layout every game shares (ui/RunResults.svelte), with one
  // block of its own: every fact of the trip coloured by speed (green quick, yellow slow, pink missed),
  // the facts to practise with their answers, and what grew in the Fact Garden.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { danceOf, palOf } from '../engine/profile';
  import { RIDES, rideName } from '../engine/rides';
  import { endMessage } from '../engine/scoring';
  import { RunScene } from '../three/runScene';
  import { MATH_LESSON, MATH_REGION, STRAND, STRIDE, moveOf, worldOf } from '../math/course';
  import { parseFact, answerOf, opSign } from '../math/facts';
  import { MATH_TREASURE, mathGoal, MATH_RIDE } from '../math/meter';
  import { mathOf, nextMathLesson } from '../math/progress';
  import Flower from '../math/ui/Flower.svelte';
  import RunResults from '../ui/RunResults.svelte';

  const last = game.mathLast;
  const p = game.profile!;
  const grown = p.settings.grown;
  const lesson = MATH_LESSON[last?.lessonId ?? 'twins-1'];
  const regionName = lesson.region === 'start' ? STRAND[lesson.op].name : MATH_REGION[lesson.region].name;
  const st = last?.stats;
  const goal = mathGoal(lesson.goal, grown, p.settings.easy);
  const passed = (last?.stars ?? 0) > 0;
  const next = nextMathLesson(mathOf(p));

  const title = !last ? '' : !passed ? (last.finished ? 'So close!' : 'Trip over') : st!.misses === 0 ? (last.stars === 3 ? 'Perfect trip!' : 'No misses!') : last.stars === 3 ? 'Three stars!' : last.stars === 2 ? 'Great job!' : 'Trip done!';
  const tested = last?.testedOut ?? [];
  const sub = !last ? '' : last.regionJustDone ? `${MATH_REGION[last.regionJustDone].name} complete!` : tested.length ? `You skipped ahead past the ${new Intl.ListFormat('en', { type: 'conjunction' }).format(tested.map(r => MATH_REGION[r].op === 'x' ? `${MATH_REGION[r].table}s` : MATH_REGION[r].name))}!` : passed ? `${lesson.title} · ${regionName}` : 'Right answers first, then speed. You can do it!';
  const word = last && st ? endMessage(last.stars, { record: last.newBestScore, improved: last.newBestScore, sloppy: st.acc < 0.85 && last.stars < 3 }) : '';
  const newBestFpm = !!(last && st && last.before && last.finished && st.fpm > last.before.bestFpm);
  const chips = last && st ? [
    { icon: 'clock' as const, value: Math.round(st.fpm), label: 'right a minute', badge: newBestFpm && 'Best!' },
    { icon: 'target' as const, value: `${Math.round(st.acc * 100)}%`, label: 'right first time' },
    { icon: 'trophy' as const, value: goal, label: `goal · best ${last.record.bestScore}`, badge: last.newBestScore && 'Record!' },
    { icon: 'ride' as const, value: rideName(last.bestRide, moveOf(lesson)), label: 'top speed', badge: last.newBestRide && 'Best!' },
  ] : [];
  // the next thing to aim for, like a typing lesson's
  const rideTh = grown ? MATH_RIDE.grown : MATH_RIDE.kids;
  const goalText = !last || !st ? '' : last.stars < 3 ? `Next goal: a score of ${goal} for three stars. Right first time counts most, then speed.`
    : RIDES[last.bestRide + 1] ? `Next goal: reach ${rideName(last.bestRide + 1, moveOf(lesson))} (about ${rideTh[last.bestRide + 1]} right a minute).` : 'Top ride and three stars. Try the next trip!';

  // every fact of the trip, in order, coloured by how it went
  const strip = (last?.results ?? []).map(r => ({ ...parseFact(r.id), kind: r.intro ? 'new' : r.speed }));
  const practise = [...new Set((last?.results ?? []).filter(r => !r.intro && !r.ok).map(r => r.id))].map(parseFact);
  const grew = last?.grew ?? { bloomed: [], budded: [], sprouted: [] };
  const fmt = (f: { a: number; b: number; op?: import('../math/facts').Op }) => `${f.a} ${opSign(f)} ${f.b}`;

  onMount(() => { if (!last) game.go('map'); });
</script>

{#if last && st}
  <RunResults move={moveOf(lesson)} run={last} {title} {sub} {word} score={st.score} goalScore={goal} {passed} {chips}
    treasureAt={grown ? MATH_TREASURE.grown : MATH_TREASURE.kids} treasureWhere="on a math trip" rideHint="Quicker answers reach"
    {goalText} openedText={last.regionJustDone ? `${MATH_REGION[last.regionJustDone].name} is done!` : null} nextTitle={next.title}
    makeScene={() => RunScene.create({ buddy: p.buddy, outfit: palOf(p).outfit, dance: danceOf(p), length: 20, region: worldOf(lesson), move: moveOf(lesson), keyLen: STRIDE[moveOf(lesson)] })}
    onretry={() => game.startMath(lesson.id, true)} onnext={() => game.startMath(next.id)} onhome={() => game.go('hub')}
    progress={{ label: 'Garden', tone: 'mint', art: gardenArt, onclick: () => game.go('garden') }}>
    {#snippet extra()}
      <div class="bhead"><b>This trip</b><span class="legend"><i class="fast"></i>quick <i class="slow"></i>slow <i class="miss"></i>missed <i class="new"></i>new</span></div>
      <div class="strip">
        {#each strip as f, i (i)}<span class="fc {f.kind}" style:--d="{i * 40}ms" title={`${fmt(f)} = ${answerOf(f)}`}>{fmt(f)}</span>{/each}
      </div>
      {#if practise.length || grew.bloomed.length || grew.budded.length || grew.sprouted.length}
        <div class="row2">
          {#if practise.length}
            <div class="pr"><b class="ph">Practise</b>{#each practise as f}<span class="pf">{fmt(f)} = <b>{answerOf(f)}</b></span>{/each}</div>
          {/if}
          {#if grew.bloomed.length || grew.budded.length || grew.sprouted.length}
            <div class="grew" title="New growth in your Fact Garden">
              {#if grew.bloomed.length}<span class="g"><Flower stage={3} size={26} hue={320} /><b>{grew.bloomed.length}</b> bloomed</span>{/if}
              {#if grew.budded.length}<span class="g"><Flower stage={2} size={26} hue={270} /><b>{grew.budded.length}</b> budding</span>{/if}
              {#if grew.sprouted.length}<span class="g"><Flower stage={1} size={26} /><b>{grew.sprouted.length}</b> sprouted</span>{/if}
            </div>
          {/if}
        </div>
      {/if}
    {/snippet}
  </RunResults>
{/if}

{#snippet gardenArt()}<Flower stage={3} size={36} hue={320} />{/snippet}

<style>
  .bhead { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 4px 0 5px; }
  .bhead b { font: 600 17px var(--font-ui); }
  .bhead .muted { font: 700 12.5px var(--font-body); }
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
  .pf b { font: 600 17px var(--font-ui); color: var(--primary-edge); }
  .grew { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .g { display: flex; align-items: center; gap: 3px; font: 700 13.5px var(--font-body); color: var(--ink2); }
  .g b { font: 600 18px var(--font-ui); color: var(--ink); }
</style>
