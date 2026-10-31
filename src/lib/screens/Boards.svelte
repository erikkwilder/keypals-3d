<script lang="ts">
  // The boards, for players: your class's board this week (if your teacher turned it on), your class's
  // goal and trophy, class against class, your family's board (players in one grown-up's account), and
  // today's Arcade challenge around the world (made-up names only). Effort, not accuracy.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { cloud } from '../state/cloud.svelte';
  import { api } from '../teach/api';
  import { classesOf, loadClasses, reportWeek } from '../teach/student.svelte';
  import { boardPrefs, ranked, trophy } from '../teach/boards';
  import { weekKey } from '../teach/activity';
  import { dayKey } from '../engine/profile';
  import { ARCADE, dailyGame } from '../arcade/arcade';
  import Header from '../ui/Header.svelte';
  import Critter from '../ui/Critter.svelte';
  import Trophy from '../teach/ui/Trophy.svelte';
  import type { FriendId } from '../art/cast';

  const p = $derived(game.profile!);
  const classes = $derived(classesOf(p));
  let family = $state<{ name: string; buddy: string | null; stars: number; right: number; ms: number; me: boolean }[] | null>(null);
  let world = $state<{ alias: string; buddy: string; score: number }[] | null>(null);
  let by = $state<'right' | 'ms'>('right');
  const today = dailyGame();
  const prefs = $derived(boardPrefs(p));
  const mins = (ms: number) => Math.round(ms / 60000);

  onMount(async () => {
    const me = game.profile;
    if (!me || !cloud.online) return;
    if (me.cloud) { await reportWeek(me).catch(() => null); await loadClasses(me, true); }
    if (me.cloud) api<{ players: NonNullable<typeof family> }>(`/family/${encodeURIComponent(me.cloud.code)}?week=${weekKey(Date.now())}`).then(r => (family = r.players)).catch(() => (family = []));
    api<{ rows: NonNullable<typeof world> }>(`/world/${today}?day=${dayKey(Date.now())}`).then(r => (world = r.rows)).catch(() => (world = []));
  });
</script>

<div class="screen boards">
  <Header />
  <div class="body scroll">
    {#if !cloud.online}
      <p class="note">The boards need the internet.</p>
    {/if}
    {#if !p.cloud}
      <!-- not saved online yet: the boards that need it, said kindly, and who can turn it on -->
      <section class="pane hello">
        <img src="{import.meta.env.BASE_URL}icons/trophy.webp" alt="" />
        <div>
          <h2>Want to be on the boards?</h2>
          <p>Your class's board and your family's board show players who are saved online. A grown-up can turn that on for you in Grown-ups, under Sign-in and saving. Today's Arcade challenge around the world is below for everyone.</p>
          <button class="btn" onclick={() => game.openGrownups('saving')}><img src="{import.meta.env.BASE_URL}icons/grownups.webp" alt="" />Ask a grown-up</button>
        </div>
      </section>
    {/if}

    {#each classes as c (c.id)}
      <section class="pane">
        <h2>{c.name}</h2>
        <div class="goalrow">
          {#if c.goal}
            {@const t = trophy(c.week.right, c.goal)}
            <Trophy right={c.week.right} goal={c.goal} size={84} />
            <div><b class="big">{c.week.right.toLocaleString('en-US')} <span>of {c.goal.toLocaleString('en-US')} right answers</span></b><p>{t.stage === 3 ? 'Your class reached its goal this week! Gold trophy!' : `Your whole class together. ${t.left.toLocaleString('en-US')} more for the gold trophy!`}</p></div>
          {:else}
            <p class="muted">{c.week.played} of {c.week.students} in your class practised this week.</p>
          {/if}
        </div>
        {#if c.board && c.rows.length}
          <div class="seg"><button class:on={by === 'right'} onclick={() => (by = 'right')}>Right answers</button><button class:on={by === 'ms'} onclick={() => (by = 'ms')}>Minutes</button></div>
          <ol class="board">
            {#each ranked(c.rows, by) as r, i (i)}
              <li class:me={r.me}><span class="pl">{r.place}</span><Critter friend={(r.buddy ?? 'dino') as FriendId} size={40} round still /><b>{r.name}{r.me ? ' (you)' : ''}</b><span class="n">{by === 'right' ? `${r.right} right` : `${mins(r.ms)} min`}</span></li>
            {/each}
          </ol>
        {/if}
        {#if c.challenge && c.challenge.ends > Date.now()}
          <h3>Class against class</h3>
          <p class="muted">Right answers per student this week. Every answer helps your class!</p>
          <ol class="board">
            {#each c.challenge.classes as x, i (x.id)}<li class:me={x.id === c.id}><span class="pl">{i + 1}</span><b>{x.name}</b><span class="n">{x.avg} each</span></li>{/each}
          </ol>
        {/if}
      </section>
    {/each}

    {#if family && family.length > 1}
      <section class="pane">
        <h2>Your family</h2>
        <p class="muted">Stars this week, for everyone in your grown-up's account.</p>
        <ol class="board">
          {#each family as f, i (i)}<li class:me={f.me}><span class="pl">{i + 1}</span><Critter friend={(f.buddy ?? 'dino') as FriendId} size={40} round still /><b>{f.name}{f.me ? ' (you)' : ''}</b><span class="n">{f.stars} ★</span><span class="m">{mins(f.ms)} min</span></li>{/each}
        </ol>
      </section>
    {/if}

    <section class="pane">
      <h2>Around the world: {ARCADE[today].name}</h2>
      <p class="muted">Today's Arcade challenge. Everyone gets a made-up name. {#if prefs.world}You're on the board as <b>{prefs.alias}</b>.{:else}To be on it, ask a grown-up to turn on world boards (Grown-ups screen).{/if}</p>
      {#if world === null}<p class="muted">Loading…</p>
      {:else if !world.length}<p class="muted">Nobody yet today. Be the first!</p>
      {:else}
        <ol class="board">
          {#each world as w, i (i)}<li class:me={prefs.world && w.alias === prefs.alias}><span class="pl">{i + 1}</span><Critter friend={w.buddy as FriendId} size={40} round still /><b>{w.alias}</b><span class="n">{w.score.toLocaleString('en-US')}</span></li>{/each}
        </ol>
      {/if}
      <button class="btn btn-primary" onclick={() => game.go('arcade')}>Play today's challenge</button>
    </section>
  </div>
</div>

<style>
  .boards { display: flex; flex-direction: column; background: var(--bg); }
  .body { flex: 1; min-height: 0; padding: 16px 20px 40px; display: flex; flex-direction: column; gap: 16px; align-items: center; }
  .pane { width: min(760px, 100%); background: #fff; border-radius: 22px; padding: 16px 20px; box-shadow: var(--shadow-sm); }
  h2 { margin: 0 0 6px; font-size: 26px; }
  h3 { margin: 14px 0 2px; font-size: 20px; }
  .muted { color: var(--muted); font: 600 15px/1.4 var(--font-body); margin: 0 0 8px; }
  .note { font: 700 16px var(--font-body); color: var(--muted); }
  .hello { display: flex; gap: 14px; align-items: flex-start; background: linear-gradient(135deg, #fff9e8, #fff); box-shadow: 0 0 0 3px #ffe08a, var(--shadow-sm); }
  .hello > img { width: 64px; height: 64px; object-fit: contain; flex: none; }
  .hello p { margin: 0 0 10px; font: 600 16px/1.45 var(--font-body); color: var(--ink2); }
  .hello .btn { display: inline-flex; align-items: center; gap: 6px; }
  .hello .btn img { width: 26px; height: 26px; object-fit: contain; }
  .goalrow { display: flex; align-items: center; gap: 14px; margin: 4px 0 10px; }
  .goalrow p { margin: 2px 0 0; font: 600 15px var(--font-body); color: var(--ink2); }
  .big { font: 600 26px var(--font-ui); }
  .big span { font: 700 15px var(--font-body); color: var(--muted); }
  .seg { display: inline-flex; border-radius: 14px; background: var(--bg2); padding: 3px; gap: 3px; margin: 4px 0 8px; }
  .seg button { border: 0; background: none; padding: 7px 14px; border-radius: 11px; font: 800 14px var(--font-body); color: var(--ink2); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .board { list-style: none; margin: 6px 0 12px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .board li { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-radius: 16px; background: #faf8ff; }
  .board li.me { background: #efe8ff; box-shadow: inset 0 0 0 2px var(--primary-hi); }
  .pl { width: 28px; text-align: center; font: 600 22px var(--font-ui); color: var(--muted); }
  .board li:nth-child(1) .pl { color: #d4a20a; } .board li:nth-child(2) .pl { color: #8a97a8; } .board li:nth-child(3) .pl { color: #b9692e; }
  .board b { flex: 1; font: 600 19px var(--font-ui); color: var(--ink); }
  .n { font: 800 16px var(--font-body); color: #0f6a48; }
  .m { font: 700 14px var(--font-body); color: var(--muted); min-width: 60px; text-align: right; }
  @media (max-width: 600px) { .body { padding: 10px 10px 30px; } .pane { padding: 12px 14px; } h2 { font-size: 21px; } .board b { font-size: 16px; } }
</style>
