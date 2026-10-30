<script lang="ts">
  // Today's goal, opened from the minutes in the top bar: the minutes so far against the goal, this week
  // day by day (a tick on each day the goal was met), what counts toward it, and the next thing to play.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { dayKey, todayMs } from '../engine/profile';
  import { keepGoing } from '../nav';
  import Popover from './Popover.svelte';
  import Ring from './Ring.svelte';
  import Icon from './Icon.svelte';

  type Props = { anchor: HTMLElement | null; onclose: () => void };
  let { anchor, onclose }: Props = $props();
  const p = $derived(game.profile!);
  const goal = $derived(p.settings.dailyGoalMin);
  const min = $derived(Math.floor(todayMs(p) / 60000));
  const done = $derived(min >= goal);
  // the last seven days, today last
  const week = $derived(Array.from({ length: 7 }, (_, i) => {
    const t = Date.now() - (6 - i) * 86400000, d = p.days[dayKey(t)];
    const m = Math.floor((d?.ms ?? 0) / 60000);
    return { key: dayKey(t), day: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }), min: m, hit: !!d?.goal || m >= goal, today: i === 6 };
  }));
  const hits = $derived(week.filter(d => d.hit).length);
  const next = $derived(keepGoing(game.homeGame, p));
  function play() { onclose(); next.go(); }
</script>

<Popover {anchor} {onclose} label="Today's goal">
  <div class="head">
    <span class="big"><Ring value={Math.min(1, min / Math.max(1, goal))} size={74} width={9} color={done ? 'var(--mint)' : 'var(--primary)'} /><b>{min}</b></span>
    <div>
      <b>{done ? 'Goal done for today!' : `${Math.max(0, goal - min)} more ${goal - min === 1 ? 'minute' : 'minutes'} today`}</b>
      <span>{min} of {goal} minutes today</span>
    </div>
  </div>
  <h3>This week <small>{hits} of 7 days hit the goal</small></h3>
  <div class="week">
    {#each week as d (d.key)}
      <div class="day" class:hit={d.hit} class:today={d.today}>
        <span class="dot">{#if d.hit}<Icon name="check" size={22} />{:else}{d.min}{/if}</span>
        <small>{d.today ? 'Today' : d.day}</small>
      </div>
    {/each}
  </div>
  <h3>What counts</h3>
  <p class="counts">Typing lessons, math trips, Learn and the games in the Arcade and the Playground all count. Adventure battles and Glimmer Drop use play time instead.</p>
  <p class="who">A grown-up can change the goal in Grown-ups.</p>
  <button class="btn btn-primary play" onclick={() => { sfx.click(); play(); }}>{next.fresh ? 'Start' : 'Keep going'}: {next.label}</button>
</Popover>

<style>
  .head { display: flex; align-items: center; gap: 14px; padding-right: 36px; }
  .big { position: relative; display: grid; place-items: center; flex: none; }
  .big b { position: absolute; font: 600 26px var(--font-ui); color: var(--ink); }
  .head div { display: flex; flex-direction: column; }
  .head div b { font: 600 22px/1.15 var(--font-ui); color: var(--ink); }
  .head div span { font: 700 14px var(--font-body); color: var(--muted); }
  h3 { display: flex; align-items: baseline; gap: 8px; margin: 14px 0 6px; font-size: 16px; color: var(--primary); }
  h3 small { font: 700 12.5px var(--font-body); color: var(--muted); }
  .week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .dot { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: #f1ecfb; font: 600 15px var(--font-ui); color: var(--ink2); }
  .day.hit .dot { background: #d9f6e7; box-shadow: inset 0 0 0 3px var(--mint); }
  .day.today .dot { box-shadow: inset 0 0 0 3px var(--primary); }
  .day.today.hit .dot { box-shadow: inset 0 0 0 3px var(--mint), 0 0 0 3px #fff, 0 0 0 5px var(--primary); }
  .day small { font: 700 11.5px var(--font-body); color: var(--muted); }
  .day.today small { color: var(--primary); }
  .counts { margin: 0; font: 600 14px/1.4 var(--font-body); color: var(--ink2); }
  .who { margin: 6px 0 0; font: 700 12.5px var(--font-body); color: var(--muted); }
  .play { width: 100%; margin-top: 12px; white-space: normal; }
</style>
