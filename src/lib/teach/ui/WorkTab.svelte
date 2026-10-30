<script lang="ts">
  // Class work: every assignment with how many are done, and making, changing, archiving or deleting one,
  // or sharing it to Google Classroom.
  import { teach, act, saveAssignment, deleteAssignment, shareWork, shareClass } from '../teacher.svelte';
  import { WHAT_NAME, dueText, goalText, isFor, progressOf, type Assignment } from '../assignments';
  import type { Kid } from '../reports';
  import AssignEditor from './AssignEditor.svelte';

  type Props = { kids: Kid[] };
  let { kids }: Props = $props();
  const c = $derived(teach.current!);
  let editing = $state<Assignment | null>(null);
  let making = $state(false);
  let deleting = $state<string | null>(null);
  let showOld = $state(false);
  const current = $derived(c.assignments.filter(a => !a.archived).sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity)));
  const old = $derived(c.assignments.filter(a => a.archived));
  function summary(a: Assignment) {
    const mine = kids.filter(k => isFor(a, k.id));
    const prs = mine.map(k => (k.profile ? progressOf(k.profile, a) : null));
    return { of: mine.length, done: prs.filter(p => p && (p.status === 'done' || (p.status === 'late' && p.done >= 1))).length, started: prs.filter(p => p && p.status !== 'not started').length, late: prs.filter(p => p?.status === 'late' && p.done < 1).length };
  }
  const archive = (a: Assignment, on: boolean) => act(() => saveAssignment({ ...a }, a.id, on), on ? 'Archived: students don\'t see it any more.' : 'Back on the Class work card.');
</script>

{#if making || editing}
  {#key editing?.id ?? 'new'}<AssignEditor {editing} done={() => { making = false; editing = null; }} />{/key}
{:else}
  <div class="tp">
    <div class="top"><h3>Class work</h3><span class="tr"><button class="btn" onclick={() => shareClass(c.class)}>Share the class to Google Classroom</button><button class="btn btn-primary" onclick={() => (making = true)}>New class work</button></span></div>
    {#if !current.length}
      <p class="muted">Nothing assigned yet. Class work shows at the top of each student's Home screen, with a progress bar and the due date, and starts the right practice when they tap it.</p>
    {:else}
      <table class="tt">
        <thead><tr><th>Class work</th><th>Goal</th><th>Due</th><th>For</th><th>Done</th><th></th></tr></thead>
        <tbody>
          {#each current as a (a.id)}
            {@const s = summary(a)}
            <tr>
              <td><b>{a.title}</b><br /><span class="muted">{WHAT_NAME[a.what]}{a.what === 'unit' ? ` · ${a.items?.length ?? 0} parts` : ''}{a.by ? ` · ${a.by}` : ''} · scored by {a.scoring === 'completion' ? 'finishing it' : a.scoring === 'accuracy' ? 'accuracy' : 'finishing and accuracy'}</span></td>
              <td>{goalText(a)}</td>
              <td class:past={a.due && a.due < Date.now()}>{dueText(a.due)}</td>
              <td>{a.students ? `${a.students.length} student${a.students.length === 1 ? '' : 's'}` : 'Whole class'}</td>
              <td><div class="bar"><i style:width="{s.of ? (s.done / s.of) * 100 : 0}%"></i></div><span class="muted">{s.done} of {s.of} done{s.late ? ` · ${s.late} late` : ''}</span></td>
              <td class="r">
                {#if deleting === a.id}
                  <button class="sbtn warn" onclick={() => act(() => deleteAssignment(a.id), 'Deleted.').then(() => (deleting = null))}>Delete</button><button class="sbtn" onclick={() => (deleting = null)}>Keep</button>
                {:else}
                  <button class="sbtn" onclick={() => shareWork(c.class, a)} title="Post it in Google Classroom">Share to Classroom</button>
                  <button class="sbtn" onclick={() => (editing = a)}>Change</button>
                  <button class="sbtn" onclick={() => archive(a, true)}>Archive</button>
                  <button class="sbtn warn" onclick={() => (deleting = a.id)}>Delete</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
    {#if old.length}
      <button class="link" onclick={() => (showOld = !showOld)}>{showOld ? 'Hide' : 'Show'} archived class work ({old.length})</button>
      {#if showOld}
        <table class="tt">
          <tbody>{#each old as a (a.id)}<tr><td>{a.title}</td><td>{goalText(a)}</td><td>{dueText(a.due)}</td><td class="r"><button class="sbtn" onclick={() => archive(a, false)}>Give it back</button></td></tr>{/each}</tbody>
        </table>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .top { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
  .tr { display: inline-flex; gap: 8px; flex-wrap: wrap; }
  .bar { width: 120px; height: 10px; border-radius: 99px; background: #efedf3; overflow: hidden; margin-bottom: 3px; }
  .bar i { display: block; height: 100%; background: #4fcf9f; }
  .past { color: #b4541b; }
  .r { text-align: right; white-space: nowrap; }
  .link { background: none; border: 0; padding: 12px 0 4px; font: 700 14px var(--font-body); color: #6a4fe0; cursor: pointer; text-decoration: underline; }
</style>
