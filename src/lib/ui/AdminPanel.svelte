<script lang="ts">
  // The Admin section of the Grown-ups screen, for the people who look after Keypals (ADMIN_EMAILS on the
  // server, Google sign-ins only; the server checks every request): approve, hide, merge and mark ideas,
  // read the problems people told us about or the game reported by itself, and see the numbers (how many
  // play and what they play, counted without identifiers).
  import { call } from '../state/cloud.svelte';
  import { IDEA_KINDS, type IdeaKind, type IdeaStatus } from '../state/feedback';

  type AdminIdea = { id: number; kind: IdeaKind; text: string; email: string | null; status: IdeaStatus; merged_into: number | null; votes: number; created: number };
  type Problem = { id: number; kind: 'told' | 'auto'; text: string; email: string | null; stack: string | null; screen: string; version: string; browser: string; size: string; times: number; status: 'new' | 'read' | 'done'; created: number; lastseen: number };

  import StatsDash from './StatsDash.svelte';
  let tab = $state<'ideas' | 'problems' | 'numbers'>('ideas');
  let ideas = $state<AdminIdea[]>([]);
  let problems = $state<Problem[]>([]);
  let msg = $state<string | null>(null);
  let showDone = $state(false);
  let merging = $state<number | null>(null);
  let editing = $state<number | null>(null);
  let editText = $state('');

  async function load() {
    msg = null;
    try {
      const [i, p] = await Promise.all([call<{ ideas: AdminIdea[] }>('/admin/ideas'), call<{ problems: Problem[] }>('/admin/problems')]);
      ideas = i.ideas; problems = p.problems;
    } catch (e) { msg = (e as Error).message; }
  }
  $effect(() => { void load(); });
  async function act(fn: () => Promise<unknown>) {
    msg = null;
    try { await fn(); await load(); } catch (e) { msg = (e as Error).message; }
  }
  const setIdea = (id: number, body: Record<string, unknown>) => act(() => call(`/admin/ideas/${id}`, { method: 'POST', body: JSON.stringify(body) }));
  const setProblem = (id: number, status: Problem['status']) => act(() => call(`/admin/problems/${id}`, { method: 'POST', body: JSON.stringify({ status }) }));
  const dropProblem = (id: number) => act(() => call(`/admin/problems/${id}`, { method: 'DELETE' }));
  const dropIdea = (id: number) => act(() => call(`/admin/ideas/${id}`, { method: 'DELETE' }));

  const waiting = $derived(ideas.filter(i => i.status === 'new').length);
  const openProblems = $derived(problems.filter(p => p.status !== 'done'));
  const shownProblems = $derived(showDone ? problems : openProblems);
  const STATUS_NAME: Record<IdeaStatus, string> = { new: 'Waiting', shown: 'On the board', planned: 'Planned', done: 'Done', hidden: 'Hidden', merged: 'Merged' };
  const kindName = (k: IdeaKind) => IDEA_KINDS.find(x => x.id === k)?.name ?? k;
  const when = (t: number) => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
</script>

<div class="admin">
  <div class="tabs">
    <button class:on={tab === 'ideas'} onclick={() => (tab = 'ideas')}>Ideas{#if waiting}<span class="n">{waiting} waiting</span>{/if}</button>
    <button class:on={tab === 'problems'} onclick={() => (tab = 'problems')}>Problems{#if openProblems.length}<span class="n">{openProblems.length} open</span>{/if}</button>
    <button class:on={tab === 'numbers'} onclick={() => (tab = 'numbers')}>Numbers</button>
    {#if tab !== 'numbers'}<button class="ghost" onclick={load}>Refresh</button>{/if}
  </div>
  {#if msg}<p class="msg">{msg}</p>{/if}

  {#if tab === 'numbers'}
    <StatsDash />
  {:else if tab === 'ideas'}
    {#if !ideas.length}<p class="muted small">No ideas yet.</p>{/if}
    <ul class="rows">
      {#each ideas as i (i.id)}
        <li class="row {i.status}">
          <div class="head"><span class="st">{STATUS_NAME[i.status]}</span><span class="muted">#{i.id} · {kindName(i.kind)} · {i.votes} ♥ · {when(i.created)}</span>{#if i.email}<a href="mailto:{i.email}">{i.email}</a>{/if}</div>
          {#if editing === i.id}
            <textarea bind:value={editText} rows="3" maxlength="500"></textarea>
            <div class="btns"><button class="btn" onclick={() => (editing = null)}>Cancel</button><button class="btn btn-primary" onclick={() => { editing = null; setIdea(i.id, { text: editText }); }}>Save words</button></div>
          {:else}
            <p class="text">{i.text}</p>
          {/if}
          {#if i.status === 'merged'}<p class="muted small">Merged into #{i.merged_into}</p>
          {:else}
            <div class="btns">
              {#if i.status !== 'shown'}<button class="btn btn-primary" onclick={() => setIdea(i.id, { status: 'shown' })}>{i.status === 'new' ? 'Approve' : 'Show on the board'}</button>{/if}
              {#if i.status !== 'planned'}<button class="btn" onclick={() => setIdea(i.id, { status: 'planned' })}>Planned</button>{/if}
              {#if i.status !== 'done'}<button class="btn" onclick={() => setIdea(i.id, { status: 'done' })}>Done</button>{/if}
              {#if i.status !== 'hidden'}<button class="btn" onclick={() => setIdea(i.id, { status: 'hidden' })}>Hide</button>{/if}
              <button class="btn" onclick={() => { editing = i.id; editText = i.text; }}>Edit words</button>
              {#if merging === i.id}
                <select onchange={(e) => { const v = Number((e.currentTarget as HTMLSelectElement).value); merging = null; if (v) setIdea(i.id, { into: v }); }}>
                  <option value="">Merge into...</option>
                  {#each ideas.filter(x => x.id !== i.id && x.status !== 'merged') as x (x.id)}<option value={x.id}>#{x.id} {x.text.slice(0, 50)}</option>{/each}
                </select>
              {:else}<button class="btn" onclick={() => (merging = i.id)}>Merge...</button>{/if}
              <button class="btn" onclick={() => dropIdea(i.id)}>Delete</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <label class="muted small"><input type="checkbox" bind:checked={showDone} /> Show done ones too</label>
    {#if !shownProblems.length}<p class="muted small">Nothing open. Nice.</p>{/if}
    <ul class="rows">
      {#each shownProblems as p (p.id)}
        <li class="row {p.status}">
          <div class="head">
            <span class="st">{p.kind === 'auto' ? 'Game error' : 'Told us'}</span>
            {#if p.times > 1}<b>×{p.times}</b>{/if}
            <span class="muted">{p.status} · last {when(p.lastseen)} · {p.screen || '?'} · v{p.version || '?'} · {p.browser || '?'} · {p.size || '?'}</span>
            {#if p.email}<a href="mailto:{p.email}">{p.email}</a>{/if}
          </div>
          <p class="text">{p.text}</p>
          {#if p.stack}<details><summary>Stack</summary><pre>{p.stack}</pre></details>{/if}
          <div class="btns">
            {#if p.status === 'new'}<button class="btn" onclick={() => setProblem(p.id, 'read')}>Mark read</button>{/if}
            {#if p.status !== 'done'}<button class="btn btn-primary" onclick={() => setProblem(p.id, 'done')}>Done</button>{:else}<button class="btn" onclick={() => setProblem(p.id, 'new')}>Open again</button>{/if}
            <button class="btn" onclick={() => dropProblem(p.id)}>Delete</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .admin { display: flex; flex-direction: column; gap: 10px; }
  .tabs { display: flex; gap: 6px; flex-wrap: wrap; }
  .tabs button { border: 0; cursor: pointer; padding: 7px 14px; border-radius: 12px; background: var(--bg2); font: 700 14px var(--font-body); color: var(--ink2); display: inline-flex; gap: 6px; align-items: center; }
  .tabs button.on { background: var(--primary); color: #fff; }
  .tabs .ghost { margin-left: auto; background: none; color: var(--primary); }
  .n { font-size: 12px; background: #ff9f1a; color: #fff; padding: 1px 7px; border-radius: 999px; }
  .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { border: 2px solid var(--line); border-radius: 14px; padding: 10px 12px; background: #fff; display: flex; flex-direction: column; gap: 6px; }
  .row.new { border-color: #ffcf8a; background: #fffaf0; }
  .row.hidden, .row.merged, .row.done { opacity: .75; }
  .head { display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline; font: 700 13px var(--font-body); }
  .st { background: var(--bg2); padding: 1px 8px; border-radius: 999px; color: var(--ink); }
  .text { margin: 0; font: 600 15px/1.4 var(--font-body); overflow-wrap: anywhere; white-space: pre-wrap; }
  .btns { display: flex; gap: 6px; flex-wrap: wrap; }
  .btns :global(.btn) { padding: 6px 12px; font-size: 14px; }
  textarea { width: 100%; padding: 8px; border-radius: 10px; border: 2px solid var(--line); font: 600 15px var(--font-body); }
  select { font: 600 14px var(--font-body); padding: 6px; border-radius: 10px; border: 2px solid var(--line); max-width: 100%; }
  pre { margin: 6px 0 0; font: 12px/1.4 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; background: #f7f5fb; padding: 8px; border-radius: 8px; }
  .msg { color: #c0396f; font-weight: 700; margin: 0; }
  .small { font-size: 13px; margin: 0; }
</style>
