<script lang="ts">
  // The end of a typing lesson, in the results layout every game shares (ui/RunResults.svelte).
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { ALL_LESSONS, LESSON, REGION, REGIONS, lessonIndex, lessonMove, lessonTitle } from '../engine/course';
  import { RIDE_SCORE, rideName } from '../engine/rides';
  import { danceOf, isUnlocked, nextGoal, nextLesson, palOf } from '../engine/profile';
  import { endMessage, finalTarget, ghostWords, lessonGoal, platinumScore, runTitle, starScores } from '../engine/scoring';
  import Certificate from '../ui/Certificate.svelte';
  import { RunScene, courseKeyLen } from '../three/runScene';
  import RunResults from '../ui/RunResults.svelte';

  const last = game.last;
  const p = game.profile!;
  const grown = p.settings.grown;
  const lesson = last ? LESSON[last.lessonId] : ALL_LESSONS[0];
  const region = REGION[lesson.region];
  // the trail with its rides, or a climb, a swim or a sled run
  const move = lessonMove(lesson);
  const passedRun = (last?.stars ?? 0) > 0;
  const following = ALL_LESSONS[lessonIndex(lesson.id) + 1];
  const nextUp = following && isUnlocked(p, following) && following.region !== 'road' ? following : nextLesson(p);
  // Animal Typing's results: speed + accuracy bonus = score, measured against the lesson's goal
  const goalScore = lessonGoal(lesson, grown, p.settings.easy);
  const goal = last ? nextGoal(p, last, goalScore, grown ? RIDE_SCORE.grown : RIDE_SCORE.kids, move) : '';
  const score = last?.score ?? 0;
  const speedPart = Math.round(last?.wpm ?? 0);
  const bonusPart = Math.max(0, score - speedPart);
  const avgScore = last && last.record.attempts ? Math.round((last.record.scoreSum ?? score) / last.record.attempts) : score;
  const word = last ? endMessage(last.stars, { record: last.newBestScore, improved: last.newBestScore, sloppy: last.acc < 0.9 && last.stars < 3, platinum: last.platinumJust }) : '';
  const final = lesson.kind === 'final';
  const ft = finalTarget(grown, p.settings.easy);
  const title = !last ? '' : runTitle({ stars: last.stars, errors: last.errors, finished: last.finished, passed: passedRun, sprint: lesson.kind === 'sprint', final });
  // when a lesson isn't passed, say which part was short: the keys right, or the speed
  const passAcc = Math.max(0, lesson.pass - (p.settings.easy ? 0.05 : 0));
  const why = !last || passedRun ? '' : final
    ? (last.acc < ft.acc ? `Aim for ${Math.round(ft.acc * 100)}% right (you got ${Math.round(last.acc * 100)}%), then ${ft.wpm} words a minute.` : `So close! ${ft.wpm} words a minute graduates you (you reached ${Math.round(last.wpm)}).`)
    : last.acc < passAcc ? `Slow down a little: ${Math.round(passAcc * 100)}% right passes, you got ${Math.round(last.acc * 100)}%.`
    : `Nearly! A score of ${starScores(goalScore)[0]} gets the first star.`;
  const sub = !last ? '' : passedRun ? (final ? `The whole course, done. ${Math.round(last.wpm)} words a minute at ${Math.round(last.acc * 100)}%!` : last.regionJustDone ? `${REGION[last.regionJustDone].name} complete!` : `${lessonTitle(lesson, game.layout)} · ${region.name}`) : why;
  let cert = $state(false);
  const nextRegion = last?.regionJustDone ? REGIONS[REGIONS.findIndex(r => r.id === last.regionJustDone) + 1] : null;
  const chips = last ? [
    { icon: 'clock' as const, value: speedPart, label: 'speed (wpm)', badge: last.newBestWpm && 'Best!' },
    { icon: 'target' as const, value: `+${bonusPart}`, label: 'clean-typing bonus' },
    { icon: 'trophy' as const, value: goalScore, label: `goal · best ${last.record.bestScore ?? score} · avg ${avgScore}`, badge: last.newBestScore && 'Record!' },
    { icon: 'ride' as const, value: rideName(last.bestRide, move), label: move === 'run' ? 'top ride' : 'top speed', badge: last.newBestRide && 'Best!' },
  ] : [];

  onMount(() => { if (!last) game.go('map'); });
</script>

{#if last}
  <RunResults {move} run={last} {title} {sub} {word} {score} {goalScore} passed={passedRun} {chips}
    rideHint="Type faster to reach"
    goalText={goal} openedText={nextRegion ? `${nextRegion.name} is open!` : null} nextTitle={lessonTitle(nextUp, game.layout)}
    makeScene={() => RunScene.create({ buddy: p.buddy, outfit: palOf(p).outfit, dance: danceOf(p), length: last.text.length, region: lesson.region, move, keyLen: move === 'run' ? undefined : courseKeyLen(move, last.text.length) })}
    onretry={() => game.startLesson(lesson.id, true)} onnext={() => game.startLesson(nextUp.id)} onhome={() => game.go('hub')}
    progress={{ label: 'Progress', kind: 'chart', onclick: () => game.openChart(lesson.id) }}>
    {#snippet badges()}
      {#if final && passedRun}<button class="certbtn" onclick={() => (cert = true)}>🎓 Your certificate</button>{/if}
      {#if last.ghost}<p class="ghost" class:won={last.ghost.beat}>👻 {ghostWords(last.ghost)}</p>{/if}
    {/snippet}
    {#snippet ringExtra()}
      {#if last.record.platinum}<div class="plat" title="Platinum: a score of {platinumScore(goalScore)}">✦ Platinum</div>{/if}
    {/snippet}
  </RunResults>
  {#if cert}<Certificate name={p.name} buddy={p.buddy} wpm={last.wpm} acc={last.acc} at={Date.now()} onclose={() => (cert = false)} />{/if}
{/if}

<style>
  .certbtn { display: inline-block; margin: 0 6px 6px; padding: 6px 14px; border: 0; border-radius: 999px; cursor: pointer; font: 700 15px var(--font-body); color: #3b2d55; background: linear-gradient(135deg, #fff3c4, #f7d774); box-shadow: 0 3px 0 #c9a227; animation: pop-in .5s cubic-bezier(.3, .8, .4, 1.5); }
  .ghost { display: inline-block; margin: 0 0 6px; padding: 4px 12px; border-radius: 999px; background: #efe9fb; color: var(--ink2); font: 700 14px var(--font-body); }
  .ghost.won { background: #e2f7ee; color: #0f6a48; }
  .plat { position: absolute; left: 50%; bottom: -10px; transform: translateX(-50%); white-space: nowrap; font: 800 12px var(--font-body); color: #3b2d55; background: linear-gradient(135deg, #e9f2ff, #f4e8ff, #e8fff6); border: 2px solid #fff; box-shadow: 0 3px 10px rgba(90, 70, 160, .35); padding: 3px 10px; border-radius: 999px; }
</style>
