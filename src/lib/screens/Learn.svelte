<script lang="ts">
  // Learn: one episode playing (math/ui/Episode.svelte), an activity: full screen, the one Pause button.
  // The lists of episodes are the Learn pages of each topic (screens/WayPage.svelte); opened with nothing
  // to play, this goes to Math's Learn page. Closing an episode goes back to where it was started from.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { MATH_LESSONS } from '../math/course';
  import { LESSONS } from '../math/learn';
  import { isEpisode } from '../math/episodes';
  import { FRAC_LESSONS } from '../math/fracEpisodes';
  import { SHAPE_LESSONS } from '../math/shapes/episodes';
  import { RATIO_LESSONS } from '../math/ratioEpisodes';
  import { DATA_LESSONS } from '../math/data/episodes';
  import { ALG_LESSONS } from '../math/algebra/episodes';
  import { NEG_LESSONS } from '../math/integers/episodes';
  import { SKILL_LESSONS } from '../math/skills/course';
  import { openWay } from '../nav';
  import Episode from '../math/ui/Episode.svelte';

  const open = $derived(game.learnId && isEpisode(game.learnId) ? game.learnId : null);
  /** the open episode is just its next-day quick check (a Learn page can open one that way) */
  let checking = $state(game.learnCheck);
  game.learnCheck = false;
  function close() { game.learnId = null; checking = false; game.leaveActivity(); }
  /** the skill areas' episodes: "Practise it now" starts the trip that meets its skill */
  const SKILL_EPS = [...FRAC_LESSONS, ...SHAPE_LESSONS, ...RATIO_LESSONS, ...NEG_LESSONS, ...DATA_LESSONS, ...ALG_LESSONS];
  function practiceStop(id: string) {
    const f = SKILL_EPS.find(x => x.id === id);
    if (f) return SKILL_LESSONS.find(x => x.kind === 'meet' && x.learn.includes(f.skill))?.id ?? null;
    if (id === 'zero-one') return 'twins-1';
    const l = LESSONS.find(x => x.id === id);
    if (l?.practice) return l.practice;
    const r = l?.regions[0];
    return MATH_LESSONS.find(x => x.region === r && x.kind === 'meet')?.id ?? null;
  }
  function practise(id: string) {
    const stop = practiceStop(id);
    game.learnId = null;
    if (!stop) return;
    game.setHome('math');
    if (SKILL_EPS.some(x => x.id === id) || LESSONS.find(x => x.id === id)?.practice) game.startSkill(stop); else game.startMath(stop);
  }
  onMount(() => { if (!open) openWay('math', null, 'learn'); });
</script>

<div class="screen learn">
  {#if open}
    {#key `${open}-${checking}`}
      <Episode id={open} check={checking} onclose={close} onpractice={practiceStop(open) ? () => practise(open) : undefined} onwatch={() => { checking = false; }} />
    {/key}
  {/if}
</div>

<style>
  .learn { display: flex; flex-direction: column; background: transparent; }
</style>
