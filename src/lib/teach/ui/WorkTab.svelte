<script lang="ts">
  // Class work: every assignment with how many are done, and making, changing, archiving or deleting one,
  // or sharing it to Google Classroom. Units in the teacher's own order (the class's syllabus: students' My
  // path follows it), and the class's spelling list (it joins each student's My Words). On a phone the
  // table stacks, one piece of work to a block.
  import { teach, act, saveAssignment, saveSettings, deleteAssignment, shareWork, shareClass } from '../teacher.svelte';
  import { inOrder } from '../../../../deploy/site/class-rules.js';
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
  /** the class's units, in the teacher's order */
  const units = $derived<Assignment[]>(inOrder(c.assignments.filter(a => a.what === 'unit' && !a.archived), c.settings?.order));
  function move(i: number, by: number) {
    const ids = units.map(a => a.id), j = i + by;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void act(() => saveSettings({ order: ids }), 'Saved. Students see the new order next time they open My path.');
  }
  let words = $state(teach.current?.settings?.words ?? '');
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
      <table class="tt stack">
        <thead><tr><th>Class work</th><th>Goal</th><th>Due</th><th>For</th><th>Done</th><th></th></tr></thead>
        <tbody>
          {#each current as a (a.id)}
            {@const s = summary(a)}
            <tr>
              <td><b>{a.title}</b><br /><span class="muted">{WHAT_NAME[a.what]}{a.what === 'unit' ? ` · ${a.items?.length ?? 0} parts` : ''}{a.by ? ` · ${a.by}` : ''} · scored by {a.scoring === 'completion' ? 'finishing it' : a.scoring === 'accuracy' ? 'accuracy' : 'finishing and accuracy'}</span></td>
              <td data-l="Goal">{goalText(a)}</td>
              <td data-l="Due" class:past={a.due && a.due < Date.now()}>{dueText(a.due)}</td>
              <td data-l="For">{a.students ? `${a.students.length} student${a.students.length === 1 ? '' : 's'}` : 'Whole class'}</td>
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
        <table class="tt stack">
          <tbody>{#each old as a (a.id)}<tr><td>{a.title}</td><td>{goalText(a)}</td><td>{dueText(a.due)}</td><td class="r"><button class="sbtn" onclick={() => archive(a, false)}>Give it back</button></td></tr>{/each}</tbody>
        </table>
      {/if}
    {/if}
  </div>
  {#if units.length > 1}
    <div class="tp">
      <h3>Order of units</h3>
      <p class="muted">Students do units from the top down, on My path and Home. Move them to make your own syllabus.</p>
      <ol class="units">
        {#each units as a, i (a.id)}
          <li>
            <span class="un"><b>{i + 1}. {a.title}</b><small>{a.items?.length ?? 0} parts</small></span>
            <button class="sbtn" disabled={i === 0 || teach.busy} aria-label="Move {a.title} up" onclick={() => move(i, -1)}>Up</button>
            <button class="sbtn" disabled={i === units.length - 1 || teach.busy} aria-label="Move {a.title} down" onclick={() => move(i, 1)}>Down</button>
          </li>
        {/each}
      </ol>
    </div>
  {/if}
  <div class="tp">
    <h3>My Words</h3>
    <p class="muted">Paste a spelling list or any text. It joins each student's "My Words" typing lesson on the Open Road, which opens after Bottom Row Burrows.</p>
    <textarea bind:value={words} rows="4" maxlength="3000" placeholder="because, friend, beautiful, enough..." aria-label="The class's spelling list"></textarea>
    <button class="btn" disabled={teach.busy || words === (c.settings?.words ?? '')} onclick={() => act(() => saveSettings({ words }), 'Saved.')}>Save word list</button>
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
  .units { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .units li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: #f8f6fc; }
  .un { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .un b { font: 700 15px var(--font-body); color: #2b2140; overflow-wrap: anywhere; }
  .un small { font: 600 13px var(--font-body); color: #7a7092; }
  textarea { width: 100%; box-sizing: border-box; resize: vertical; margin: 6px 0 10px; display: block; }
  @media (max-width: 760px) {
    .r { text-align: left; white-space: normal; padding-top: 6px; }
    .r :global(.sbtn) { margin: 0 4px 4px 0; }
    .bar { width: 100%; }
  }
</style>
