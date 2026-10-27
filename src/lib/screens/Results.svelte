<script lang="ts">
  // The end of a typing lesson, in the results layout every game shares (ui/RunResults.svelte).
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { ALL_LESSONS, LESSON, REGION, REGIONS, lessonIndex } from '../engine/course';
  import { RIDES, RIDE_SCORE } from '../engine/rides';
  import { danceOf, isUnlocked, nextGoal, nextLesson, palOf } from '../engine/profile';
  import { endMessage, ghostWords, lessonGoal, platinumScore, runTitle } from '../engine/scoring';
  import { TREASURE_SCORE } from '../engine/rewards';
  import { RunScene } from '../three/runScene';
  import RunResults from '../ui/RunResults.svelte';

  const last = game.last;
  const p = game.profile!;
  const grown = p.settings.grown;
  const lesson = last ? LESSON[last.lessonId] : ALL_LESSONS[0];
  const region = REGION[lesson.region];
  const passedRun = (last?.stars ?? 0) > 0;
  const following = ALL_LESSONS[lessonIndex(lesson.id) + 1];
  const nextUp = following && isUnlocked(p, following) && following.region !== 'road' ? following : nextLesson(p);
  // Animal Typing's results: speed + accuracy bonus = score, measured against the lesson's goal
  const goalScore = lessonGoal(lesson, grown, p.settings.easy);
  const goal = last ? nextGoal(p, last, goalScore, grown ? RIDE_SCORE.grown : RIDE_SCORE.kids) : '';
  const score = last?.score ?? 0;
  const speedPart = Math.round(last?.wpm ?? 0);
  const bonusPart = Math.max(0, score - speedPart);
  const avgScore = last && last.record.attempts ? Math.round((last.record.scoreSum ?? score) / last.record.attempts) : score;
  const word = last ? endMessage(last.stars, { record: last.newBestScore, improved: last.newBestScore, sloppy: last.acc < 0.9 && last.stars < 3, platinum: last.platinumJust }) : '';
  const title = !last ? '' : runTitle({ stars: last.stars, errors: last.errors, finished: last.finished, passed: passedRun, sprint: lesson.kind === 'sprint' });
  const sub = !last ? '' : passedRun ? (last.regionJustDone ? `${REGION[last.regionJustDone].name} complete!` : `${lesson.title} · ${region.name}`) : 'Fewer slips will get you there. You can do it!';
  const nextRegion = last?.regionJustDone ? REGIONS[REGIONS.findIndex(r => r.id === last.regionJustDone) + 1] : null;
  const chips = last ? [
    { icon: 'clock' as const, value: speedPart, label: 'speed (wpm)', badge: last.newBestWpm && 'Best!' },
    { icon: 'target' as const, value: `+${bonusPart}`, label: 'clean-typing bonus' },
    { icon: 'trophy' as const, value: goalScore, label: `goal · best ${last.record.bestScore ?? score} · avg ${avgScore}`, badge: last.newBestScore && 'Record!' },
    { icon: 'ride' as const, value: RIDES[last.bestRide].name, label: 'top ride', badge: last.newBestRide && 'Best!' },
  ] : [];

  onMount(() => { if (!last) game.go('map'); });
</script>

{#if last}
  <RunResults run={last} {title} {sub} {word} {score} {goalScore} passed={passedRun} {chips}
    treasureAt={grown ? TREASURE_SCORE.grown : TREASURE_SCORE.kids} treasureWhere="in a lesson" rideHint="Type faster to reach"
    goalText={goal} openedText={nextRegion ? `${nextRegion.name} is open!` : null} nextTitle={nextUp.title}
    makeScene={() => RunScene.create({ buddy: p.buddy, outfit: palOf(p).outfit, dance: danceOf(p), length: last.text.length, region: lesson.region })}
    onretry={() => game.startLesson(lesson.id, true)} onnext={() => game.startLesson(nextUp.id)} onhome={() => game.go('map')}
    progress={{ label: 'Progress', kind: 'chart', onclick: () => game.openChart(lesson.id) }}>
    {#snippet badges()}
      {#if last.ghost}<p class="ghost" class:won={last.ghost.beat}>👻 {ghostWords(last.ghost)}</p>{/if}
    {/snippet}
    {#snippet ringExtra()}
      {#if last.record.platinum}<div class="plat" title="Platinum: a score of {platinumScore(goalScore)}">✦ Platinum</div>{/if}
    {/snippet}
  </RunResults>
{/if}

<style>
  .ghost { display: inline-block; margin: 0 0 6px; padding: 4px 12px; border-radius: 999px; background: #efe9fb; color: var(--ink2); font: 700 14px var(--font-body); }
  .ghost.won { background: #e2f7ee; color: #0f6a48; }
  .plat { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); white-space: nowrap; font: 800 12px var(--font-body); color: #3b2d55; background: linear-gradient(135deg, #e9f2ff, #f4e8ff, #e8fff6); border: 2px solid #fff; box-shadow: 0 3px 10px rgba(90, 70, 160, .35); padding: 3px 10px; border-radius: 999px; }
</style>
