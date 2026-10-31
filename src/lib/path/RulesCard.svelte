<script lang="ts">
  // The rules: the path and play time, one set of words on both sides. Grown-ups → Time and rules shows it for
  // one child, a teacher's Class rules shows it for a class. A line under a rule says when the other side
  // disagrees and which one counts (`note`). Play time is one card: the daily limits for the fun places and
  // how Adventure and Glimmer Drop are earned, with every choice either side ever had.
  import type { Snippet } from 'svelte';
  import { PLAY_RULES, type AdvSettings, type PlayRule } from '../adventure/state';
  import { CAP_MINS, FREE_MINS, FREE_PLACES, KEEPS, KEEP_TEXT, LIMITS, LIMIT_NAME, PLACE_NAME, RATIOS, RULE_WORDS, capName, focusChoices, ratioName, type FreePlace, type Keep, type Limit, type PlayChoice } from './rules';

  type Patch = { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; play?: PlayChoice };
  type Props = {
    keep: Keep; goal: number; limits: Partial<Record<FreePlace, Limit>>; play: AdvSettings;
    set: (patch: Patch) => void;
    /** who this is for: "Mia", or "your students" */
    who: string;
    /** the line under a rule, when a family and a class disagree */
    note?: (key: string) => string | null | undefined;
    /** minutes used today in a place (Grown-ups only: it's one child) */
    used?: (place: FreePlace) => number;
    /** a line under the path's heading */
    pathLine?: string;
    /** today's minutes, under the play-time choices */
    today?: Snippet;
  };
  let { keep, goal, limits, play, set, who, note = () => null, used, pathLine, today }: Props = $props();
  const FOCUS = focusChoices();
</script>

{#snippet said(key: string)}
  {@const n = note(key)}
  {#if n}<small class="said">{n}</small>{/if}
{/snippet}

<div class="card rc">
  <h3>The path</h3>
  <p class="muted small">{pathLine ?? `My path suggests what to do next. Home shows how many of today's things are done ("2 of 3 things done today").`}</p>
  <div class="grow">
    <span class="gl"><b>{RULE_WORDS.keep}</b><small>{KEEP_TEXT[keep].text}</small>{@render said('keep')}</span>
    <div class="seg">{#each KEEPS as k (k)}<button class:on={keep === k} onclick={() => set({ keep: k })}>{KEEP_TEXT[k].name}</button>{/each}</div>
  </div>
  <div class="grow">
    <span class="gl"><b>{RULE_WORDS.goal}</b><small>How many path things make a day.</small>{@render said('goal')}</span>
    <div class="seg">{#each [1, 2, 3, 4, 5] as n (n)}<button class:on={goal === n} onclick={() => set({ goal: n })}>{n}</button>{/each}</div>
  </div>
</div>

<div class="card rc">
  <h3>{RULE_WORDS.play}</h3>
  <p class="muted small">How long {who} can spend in the fun places each day. Lessons, math trips and Learn never use it, and neither does a game or a battle on the path or in class work.</p>
  <h4>{RULE_WORDS.limits}</h4>
  <p class="muted small">When the time's up, the door says so kindly and points to the path. Earned: 5 minutes, plus a minute for every minute of practice.</p>
  <div class="lims">
    {#each FREE_PLACES as pl (pl)}
      <label>{PLACE_NAME[pl]}
        <select value={limits[pl] ?? 'off'} onchange={(e) => set({ limits: { [pl]: (e.currentTarget as HTMLSelectElement).value as Limit } })}>{#each LIMITS as l (l)}<option value={l}>{LIMIT_NAME(l)}</option>{/each}</select>
        {#if used}<small>{used(pl)} min today</small>{/if}
        {@render said(`limit:${pl}`)}
      </label>
    {/each}
  </div>
  <h4>{RULE_WORDS.rule}</h4>
  <p class="muted small">Every move in a battle is still a math answer or a typed word, and practice is where the eggs hatch.</p>
  <div class="rules">
    {#each Object.entries(PLAY_RULES) as [id, r]}
      <button class="rule" class:on={play.rule === id} onclick={() => set({ play: { rule: id as PlayRule } })}><b>{r.name}</b><span>{r.text}</span></button>
    {/each}
  </div>
  {@render said('rule')}
  <div class="opts">
    {#if play.rule === 'balanced'}
      <label>{RULE_WORDS.ratio}
        <select value={play.ratio} onchange={(e) => set({ play: { ratio: Number((e.currentTarget as HTMLSelectElement).value) } })}>{#each RATIOS as r (r)}<option value={r}>{ratioName(r)}</option>{/each}</select>
        {@render said('ratio')}</label>
      <label>{RULE_WORDS.freeMin}
        <select value={play.freeMin} onchange={(e) => set({ play: { freeMin: Number((e.currentTarget as HTMLSelectElement).value) } })}>{#each FREE_MINS as m (m)}<option value={m}>{m} min</option>{/each}</select>
        {@render said('freeMin')}</label>
    {/if}
    <label>{RULE_WORDS.capMin}
      <select value={play.capMin} onchange={(e) => set({ play: { capMin: Number((e.currentTarget as HTMLSelectElement).value) } })}>{#each CAP_MINS as m (m)}<option value={m}>{capName(m)}</option>{/each}</select>
      {@render said('capMin')}</label>
    <label>{RULE_WORDS.versus}
      <select value={play.versus === false ? 'off' : 'on'} onchange={(e) => set({ play: { versus: (e.currentTarget as HTMLSelectElement).value === 'on' } })}><option value="on">On (players on one device)</option><option value="off">Off</option></select>
      {@render said('versus')}</label>
    <label>{RULE_WORDS.focus}
      <select value={play.focus} onchange={(e) => set({ play: { focus: (e.currentTarget as HTMLSelectElement).value as AdvSettings['focus'] } })}>{#each FOCUS as f (f.id)}<option value={f.id}>{f.name}</option>{/each}</select>
      {@render said('focus')}</label>
  </div>
  {@render today?.()}
</div>

<style>
  .rc { padding: 18px 20px; }
  h3 { font-size: 21px; margin: 0 0 6px; }
  h4 { margin: 16px 0 2px; font: 600 17px var(--font-ui); color: var(--ink); }
  .small { font: 600 13.5px/1.4 var(--font-body); margin: 2px 0 8px; }
  .grow { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 8px 0; border-top: 1px solid var(--line); }
  .gl { display: flex; flex-direction: column; min-width: 0; }
  .gl b { font: 600 17px var(--font-ui); color: var(--ink); }
  .gl small { font: 600 13px/1.35 var(--font-body); color: var(--muted); }
  .gl small.said, .said { display: block; font: 700 13px/1.35 var(--font-body); color: #8a4a00; background: #fff4e0; padding: 2px 8px; border-radius: 8px; margin-top: 4px; }
  .seg { display: flex; flex-wrap: wrap; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 14px; flex: none; max-width: 100%; }
  .seg button { border: 0; background: none; padding: 7px 10px; border-radius: 10px; font: 700 13px var(--font-body); color: var(--muted); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .lims { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px 12px; }
  .lims label { display: flex; flex-direction: column; gap: 3px; min-width: 0; font: 700 13px var(--font-body); color: var(--ink2); }
  .lims select { font: 600 14px var(--font-body); padding: 6px 8px; border-radius: 10px; border: 2px solid #e6dff5; background: #fff; color: var(--ink); width: 100%; }
  .lims small:not(.said) { font: 700 11.5px var(--font-body); color: var(--muted); }
  .rules { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0; }
  .rule { display: flex; flex-direction: column; gap: 3px; text-align: left; border: 3px solid #ece6f6; background: #fff; border-radius: 16px; padding: 10px 12px; cursor: pointer; }
  .rule b { font: 600 18px var(--font-ui); color: var(--ink); }
  .rule span { font: 600 13px/1.35 var(--font-body); color: var(--muted); }
  .rule.on { border-color: var(--primary-hi); background: #f6f2ff; }
  .opts { display: flex; flex-wrap: wrap; gap: 10px 18px; margin-top: 8px; }
  .opts label { display: flex; flex-direction: column; gap: 4px; min-width: 0; max-width: 100%; font: 700 13px var(--font-body); color: var(--ink2); }
  .opts select { font: 600 15px var(--font-body); padding: 6px 10px; border-radius: 10px; border: 2px solid #e6dff5; background: #fff; color: var(--ink); max-width: 100%; }
  @media (max-width: 760px) {
    .lims { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .rules { grid-template-columns: 1fr; }
    .opts label { width: 100%; }
  }
  @media (max-width: 600px) { .grow { flex-wrap: wrap; } }
</style>
