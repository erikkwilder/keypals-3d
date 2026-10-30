<script lang="ts">
  // Class work at the top of Home, for a player in a class: each assignment with a progress bar and its
  // due date (tap it to start the right practice), the class trophy filling toward this week's goal, the
  // boards, and "Done for today" on a shared school computer.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { classesOf, doneForToday, loadClasses, loggedInHere } from '../teach/student.svelte';
  import { dueText, goalText, progressOf, type Assignment } from '../teach/assignments';
  import { startAssignment } from '../teach/launch';
  import Trophy from '../teach/ui/Trophy.svelte';

  type Props = { compact?: boolean };
  let { compact = false }: Props = $props();
  const p = $derived(game.profile);
  const classes = $derived(classesOf(p));
  const shared = $derived(loggedInHere(p));
  let leaving = $state<'ask' | 'saving' | 'stuck' | null>(null);
  onMount(() => { void loadClasses(game.profile); });

  const DAY = 86400000;
  function dueChip(a: Assignment, done: boolean) {
    if (!a.due) return { text: 'Any time', tone: 'calm' };
    if (done) return { text: 'Done!', tone: 'done' };
    const left = a.due - Date.now();
    if (left < 0) return { text: 'Late: keep going!', tone: 'late' };
    if (left < DAY && new Date(a.due).getDate() === new Date().getDate()) return { text: 'Due today', tone: 'soon' };
    if (left < 2 * DAY) return { text: 'Due tomorrow', tone: 'soon' };
    return { text: `Due ${dueText(a.due)}`, tone: 'calm' };
  }
  function start(a: Assignment) { if (!p) return; sfx.click(); startAssignment(p, a); }
  async function leave(anyway = false) {
    if (!p) return;
    leaving = 'saving';
    const ok = await doneForToday(p, anyway);
    if (!ok) leaving = 'stuck';
  }
</script>

{#if p && classes.length}
  {#each classes as c (c.id)}
    {@const work = c.assignments.map(a => ({ a, pr: progressOf(p, a) })).sort((x, y) => Number(x.pr.done >= 1) - Number(y.pr.done >= 1) || (x.a.due ?? Infinity) - (y.a.due ?? Infinity))}
    {@const open = work.filter(w => w.pr.done < 1)}
    <section class="cw" class:compact>
      <header>
        <img class="ic" src="{import.meta.env.BASE_URL}icons/book.webp" alt="" />
        <div class="tt"><b>Class work</b><span>{c.name} · {c.teacher}</span></div>
        {#if c.goal}
          <div class="goal" title="Your class's goal this week: {c.goal.toLocaleString('en-US')} right answers together">
            <Trophy right={c.week.right} goal={c.goal} size={compact ? 34 : 44} />
            <span><b>{c.week.right.toLocaleString('en-US')}</b> of {c.goal.toLocaleString('en-US')}<small>class goal</small></span>
          </div>
        {/if}
        <button class="btn ghost sm" onclick={() => { sfx.click(); game.visit('boards'); }}>Boards</button>
        {#if shared}<button class="btn ghost sm" onclick={() => (leaving = 'ask')}>Done for today</button>{/if}
      </header>
      {#if !work.length}
        <p class="none">No class work right now. Practise anything you like!</p>
      {:else}
        <div class="list">
          {#each work as { a, pr } (a.id)}
            {@const chip = dueChip(a, pr.done >= 1)}
            <button class="item" class:done={pr.done >= 1} onclick={() => start(a)}>
              <span class="nm"><b>{a.title}</b><small>{goalText(a)}</small></span>
              <span class="prog"><i style:width="{Math.round(pr.done * 100)}%"></i></span>
              <span class="pc">{Math.round(pr.done * 100)}%</span>
              <span class="chip {chip.tone}">{chip.text}</span>
              <span class="go">{pr.done >= 1 ? 'Again' : pr.done > 0 ? 'Keep going' : 'Start'}</span>
            </button>
          {/each}
        </div>
        {#if !open.length}<p class="none yay">All your class work is done. Amazing!</p>{/if}
      {/if}
    </section>
  {/each}
  {#if leaving}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="ask" onclick={() => { if (leaving !== 'saving') leaving = null; }}>
      <div class="box card" onclick={(e) => e.stopPropagation()}>
        {#if leaving === 'ask'}
          <h3>Done for today, {p.name}?</h3>
          <p>Your progress is saved online. Your player leaves this computer, and comes back next time you log in with your pictures.</p>
          <div class="row"><button class="btn" onclick={() => (leaving = null)}>Keep playing</button><button class="btn btn-primary" onclick={() => leave()}>Yes, I'm done</button></div>
        {:else if leaving === 'saving'}
          <h3>Saving your progress…</h3>
        {:else}
          <h3>Not saved online yet</h3>
          <p>The internet might be down. Stay on this computer and try again in a minute, or leave anyway (today's newest progress could be lost).</p>
          <div class="row"><button class="btn btn-primary" onclick={() => (leaving = null)}>Stay</button><button class="btn" onclick={() => leave(true)}>Leave anyway</button></div>
        {/if}
      </div>
    </div>
  {/if}
{/if}

<style>
  .cw { background: linear-gradient(180deg, #fffdf2, #fff8dc); border: 3px solid #f2d88a; border-radius: 24px; padding: 12px 16px 14px; margin: 0 0 16px; box-shadow: 0 10px 24px -16px rgba(140, 100, 0, .45); }
  header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .ic { width: 44px; height: 44px; object-fit: contain; }
  .tt { display: flex; flex-direction: column; flex: 1; min-width: 140px; }
  .tt b { font: 600 24px var(--font-ui); color: var(--ink); }
  .tt span { font: 700 14px var(--font-body); color: #7a6420; }
  .goal { display: flex; align-items: center; gap: 6px; background: #fff; border-radius: 16px; padding: 4px 12px 4px 6px; }
  .goal span { display: flex; flex-direction: column; font: 700 13px var(--font-body); color: var(--ink2); line-height: 1.15; }
  .goal b { font: 600 18px var(--font-ui); color: var(--ink); }
  .goal small { font: 800 11px var(--font-body); color: #a07a10; text-transform: uppercase; letter-spacing: .05em; }
  .sm { padding: 8px 14px; min-height: 0; font-size: 15px; background: #fff; }
  .list { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
  .item { display: grid; grid-template-columns: minmax(0, 1fr) minmax(80px, 200px) 44px auto auto; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 16px; border: 2px solid #f0e2b0; background: #fff; cursor: pointer; text-align: left; color: inherit; transition: transform .12s; }
  .item:hover { transform: translateY(-2px); border-color: #e6c75c; }
  .item.done { opacity: .75; }
  .nm { display: flex; flex-direction: column; min-width: 0; }
  .nm b { font: 600 19px var(--font-ui); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nm small { font: 700 13px var(--font-body); color: var(--muted); }
  .prog { height: 14px; border-radius: 99px; background: #f1ead2; overflow: hidden; }
  .prog i { display: block; height: 100%; background: linear-gradient(90deg, #6fdcb0, #3fbf8a); border-radius: 99px; }
  .pc { font: 800 14px var(--font-body); color: var(--ink2); text-align: right; }
  .chip { font: 800 12.5px var(--font-body); padding: 4px 10px; border-radius: 99px; white-space: nowrap; }
  .chip.calm { background: #eef3ff; color: #2f4f9a; }
  .chip.soon { background: #ffe9c7; color: #8a4b00; }
  .chip.late { background: #ffe0da; color: #9a2a1a; }
  .chip.done { background: #c9f1dd; color: #0f5a3c; }
  .go { font: 800 14px var(--font-body); color: #fff; background: var(--primary); padding: 7px 14px; border-radius: 12px; white-space: nowrap; }
  .done .go { background: #9ad8bd; }
  .none { margin: 10px 2px 0; font: 700 15px var(--font-body); color: #7a6420; }
  .yay { color: #0f6a48; }
  .ask { position: fixed; inset: 0; z-index: 80; background: rgba(40, 28, 70, .4); display: grid; place-items: center; padding: 16px; }
  .box { padding: 20px 24px; width: min(460px, 100%); display: flex; flex-direction: column; gap: 10px; }
  .box h3 { margin: 0; font-size: 24px; }
  .box p { margin: 0; font: 600 16px/1.45 var(--font-body); color: var(--ink2); }
  .row { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
  .compact { padding: 10px 10px 12px; border-radius: 18px; }
  @media (max-width: 700px) {
    .item { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'nm go' 'prog chip'; gap: 6px 10px; }
    .nm { grid-area: nm; } .go { grid-area: go; } .prog { grid-area: prog; } .chip { grid-area: chip; justify-self: end; }
    .pc { display: none; }
    .tt b { font-size: 20px; }
    .ic { width: 34px; height: 34px; }
  }
</style>
