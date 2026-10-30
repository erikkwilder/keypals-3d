<script lang="ts">
  // The class's boards: the class board (this week's right answers and minutes, first names, only
  // inside the class; on or off), the weekly class goal and its trophy, and class against class.
  import { teach, act, patchClass, makeChallenge, joinChallenge, leaveChallenge, refreshClass } from '../teacher.svelte';
  import { ranked, suggestGoal } from '../boards';
  import { showClassCode } from '../names';
  import Trophy from './Trophy.svelte';
  import Critter from '../../ui/Critter.svelte';
  import type { FriendId } from '../../art/cast';

  const c = $derived(teach.current!);
  const rows = $derived(ranked(c.week));
  const right = $derived(c.week.reduce((t, r) => t + r.right, 0));
  let goal = $state(teach.current?.class.goal || suggestGoal(teach.current?.students.length ?? 20));
  let joinCode = $state('');
  const ch = $derived(c.challenge);
  const live = $derived(!!ch && ch.ends > Date.now());
  const endsText = $derived(ch ? new Date(ch.ends - 1).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '');
  const mine = $derived(c.class.id);
</script>

<div class="two">
  <div class="tp">
    <div class="top"><h3>Class board</h3>
      <label class="sw"><input type="checkbox" checked={c.class.board} onchange={(e) => act(() => patchClass({ board: (e.currentTarget as HTMLInputElement).checked }))} /> Show it to students</label>
    </div>
    <p class="muted">This week's right answers and minutes: effort, not accuracy. First names only, and only students in this class see it.</p>
    {#if !rows.length}<p class="muted">No students yet.</p>{:else}
      <ol class="board">
        {#each rows as r (r.id)}
          <li><span class="pl">{r.place}</span><Critter friend={(r.buddy ?? 'dino') as FriendId} size={34} round still /><b>{r.name}</b><span class="n">{r.right} right</span><span class="m">{Math.round(r.ms / 60000)} min</span></li>
        {/each}
      </ol>
    {/if}
    <button class="sbtn" onclick={() => act(refreshClass)}>Refresh</button>
  </div>

  <div class="tp">
    <h3>Weekly class goal</h3>
    <p class="muted">Right answers the whole class makes together this week. The trophy fills up on this page and on every student's Class work card.</p>
    <div class="goal">
      <Trophy {right} goal={c.class.goal} size={92} />
      <div>
        {#if c.class.goal}<p class="big">{right.toLocaleString('en-US')} <span>of {c.class.goal.toLocaleString('en-US')} right answers</span></p>{:else}<p class="muted">No goal yet.</p>{/if}
        <div class="row"><input type="number" min="0" step="100" bind:value={goal} aria-label="Weekly goal" /><button class="btn" onclick={() => act(() => patchClass({ goal: Math.max(0, Math.round(goal || 0)) }), 'Goal saved.')}>{c.class.goal ? 'Change goal' : 'Set the goal'}</button>{#if c.class.goal}<button class="sbtn" onclick={() => act(() => patchClass({ goal: 0 }), 'No class goal this week.')}>Turn off</button>{/if}</div>
        <p class="muted small">About 100 right answers a student is a good week.</p>
      </div>
    </div>
  </div>
</div>

<div class="tp">
  <h3>Class against class</h3>
  {#if ch && live}
    <p>Racing until <b>{endsText}</b>, by average right answers per student (so class size doesn't matter). Other classes see class names only.</p>
    <p>Challenge code for another teacher: <b class="cc">{showClassCode(ch.code)}</b></p>
    <ol class="board">
      {#each ch.classes as x, i (x.id)}<li class:me={x.id === mine}><span class="pl">{i + 1}</span><b>{x.name}</b><span class="n">{x.avg} a student</span><span class="m">{x.students} students</span></li>{/each}
    </ol>
    {#if ch.classes.length < 2}<p class="muted">Waiting for another class to join with the code.</p>{/if}
    <button class="sbtn warn" onclick={() => act(leaveChallenge, 'Left the challenge.')}>Leave the challenge</button>
  {:else}
    {#if ch}<p class="muted">Last challenge: {ch.classes.map((x, i) => `${i + 1}. ${x.name} (${x.avg})`).join(', ')}</p>{/if}
    <p class="muted">Race another class for a week: the class with the most right answers per student wins. Make a code and give it to another teacher, or join with theirs.</p>
    <div class="row">
      <button class="btn btn-primary" onclick={() => act(makeChallenge, 'Challenge made: give the code to another teacher.')}>Make a challenge code</button>
      <span class="or">or</span>
      <input bind:value={joinCode} placeholder="Their code: owl moon 12" aria-label="Challenge code" />
      <button class="btn" disabled={!joinCode.trim()} onclick={() => act(() => joinChallenge(joinCode), 'Joined! The race is on.')}>Join</button>
    </div>
  {/if}
</div>

<style>
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .two .tp { margin-bottom: 0; }
  .two + .tp { margin-top: 14px; }
  .top { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .sw { display: flex; gap: 6px; align-items: center; font: 800 14px var(--font-body); color: #2b2140; cursor: pointer; }
  .sw input { width: 20px; height: 20px; }
  .board { list-style: none; margin: 8px 0 10px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .board li { display: flex; align-items: center; gap: 10px; padding: 5px 10px; border-radius: 12px; background: #fbfaff; }
  .board li.me { background: #efe8ff; outline: 2px solid #a48bff; }
  .board .pl { width: 24px; font: 600 18px var(--font-ui); color: #7a7092; text-align: center; }
  .board b { flex: 1; font: 700 15.5px var(--font-body); }
  .board .n { font: 800 14px var(--font-body); color: #0f5a3c; }
  .board .m { font: 700 13px var(--font-body); color: #7a7092; min-width: 70px; text-align: right; }
  .goal { display: flex; gap: 18px; align-items: center; }
  .big { font: 600 26px var(--font-ui) !important; color: #2b2140 !important; margin: 0 0 8px; }
  .big span { font: 700 14px var(--font-body); color: #7a7092; }
  .goal input { width: 120px; }
  .small { font-size: 13px !important; margin: 6px 0 0; }
  .cc { font: 600 22px var(--font-ui); background: #fff4cf; border: 2px solid #f2d88a; border-radius: 10px; padding: 0 10px; }
  .or { font: 700 14px var(--font-body); color: #7a7092; }
  @media (max-width: 900px) { .two { grid-template-columns: 1fr; } .two .tp { margin-bottom: 14px; } }
</style>
