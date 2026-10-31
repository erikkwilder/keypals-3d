<script lang="ts">
  // Students: add them by first name (one a line, or paste a column from a spreadsheet), say yes or no
  // to families linking a player from home, rename, give new pictures, remove.
  import { teach, act, addStudents, renameStudent, resetPics, removeStudent, approve, type Student } from '../teacher.svelte';
  import { splitNames } from '../../../../deploy/site/class-rules.js';
  import PicturePass from './PicturePass.svelte';

  const c = $derived(teach.current!);
  const active = $derived(c.students.filter(s => s.status === 'active'));
  const pending = $derived(c.students.filter(s => s.status === 'pending'));
  let text = $state('');
  const preview = $derived<string[]>(splitNames(text));
  let renaming = $state<string | null>(null);
  let newName = $state('');
  let removing = $state<string | null>(null);
  /** the student "New pictures" is asking about (their printed card stops working) */
  let picturing = $state<string | null>(null);
  const nameOf = (id: string | null) => c.students.find(s => s.id === id)?.name ?? '';
  async function add() { const r = await act(() => addStudents(text)); if (r) { teach.msg = `Added ${r.length} student${r.length === 1 ? '' : 's'}. Print their login cards from the top of the page.`; text = ''; } }
  function startRename(s: Student) { renaming = s.id; newName = s.name; }
</script>

<div class="tp">
  <h3>Add students</h3>
  <p class="muted">Type or paste first names, one a line (a column copied from a spreadsheet works too). Only the first name and an initial are kept ("Maria L."): last names, emails and birthdays are left out.</p>
  <div class="add">
    <textarea bind:value={text} rows="5" placeholder={'Maria\nSam\nAva'}></textarea>
    <div class="pv">
      {#if preview.length}<b>Will add {preview.length}:</b><span>{preview.join(', ')}</span>{:else}<span class="muted">Names show here as you type.</span>{/if}
      <button class="btn btn-primary" disabled={!preview.length || teach.busy} onclick={add}>Add {preview.length || ''} student{preview.length === 1 ? '' : 's'}</button>
    </div>
  </div>
</div>

{#if pending.length}
  <div class="tp wait">
    <h3>Waiting for you</h3>
    <p class="muted">Families asked to link a player from home to this class. Say yes only if you know who it is.</p>
    <table class="tt">
      <tbody>
        {#each pending as s (s.id)}
          <tr>
            <td><b>{s.name}</b></td>
            <td>{s.claims ? `Says it's ${nameOf(s.claims)}: their progress from home and school will be put together` : 'A new student from home'}</td>
            <td class="r"><button class="sbtn" onclick={() => act(() => approve(s), `${s.name} is in the class now.`)}>Yes</button> <button class="sbtn warn" onclick={() => act(() => removeStudent(s.id), 'Said no.')}>No</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<div class="tp">
  <h3>Students ({active.length})</h3>
  {#if !active.length}
    <p class="muted">No students yet.</p>
  {:else}
    <table class="tt">
      <thead><tr><th>Name</th><th>Picture password</th><th>Player</th><th></th></tr></thead>
      <tbody>
        {#each active as s (s.id)}
          <tr>
            <td>
              {#if renaming === s.id}
                <form class="ren" onsubmit={(e) => { e.preventDefault(); act(() => renameStudent(s.id, newName)).then(() => (renaming = null)); }}><input bind:value={newName} maxlength="16" aria-label="New name" /><button class="sbtn">Save</button><button type="button" class="sbtn" onclick={() => (renaming = null)}>Cancel</button></form>
              {:else}<button class="namebtn" onclick={() => (teach.studentId = s.id)}>{s.name}</button>{/if}
            </td>
            <td><PicturePass pics={s.pics} size={34} /></td>
            <td class="muted">{s.home ? 'From home (the family keeps it)' : 'Made by the class'}{s.google ? ' · signs in with Google' : ''}</td>
            <td class="r">
              {#if picturing === s.id}
                <span class="sure">New pictures for {s.name}? Their old login card stops working.</span>
                <button class="sbtn warn" onclick={() => act(() => resetPics(s.id), `${s.name} has new pictures. Print a new card.`).then(() => (picturing = null))}>New pictures</button>
                <button class="sbtn" onclick={() => (picturing = null)}>Keep</button>
              {:else if removing === s.id}
                <span class="sure">Remove {s.name}?{s.home ? '' : ' Their class player and progress are deleted.'}</span>
                <button class="sbtn warn" onclick={() => act(() => removeStudent(s.id), `${s.name} was removed.`).then(() => (removing = null))}>Remove</button>
                <button class="sbtn" onclick={() => (removing = null)}>Keep</button>
              {:else}
                <button class="sbtn" onclick={() => startRename(s)}>Rename</button>
                <button class="sbtn" onclick={() => (picturing = s.id)}>New pictures</button>
                <button class="sbtn warn" onclick={() => (removing = s.id)}>Remove</button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
  textarea { width: 100%; resize: vertical; min-height: 120px; }
  .pv { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; font: 600 14px/1.5 var(--font-body); color: #4a4061; }
  .r { text-align: right; white-space: nowrap; }
  .ren { display: flex; gap: 6px; }
  .ren input { width: 140px; padding: 5px 9px; }
  .sure { font: 700 13px var(--font-body); color: #b4232c; margin-right: 6px; white-space: normal; }
  .wait { border-color: #f6cf9c; background: #fffaf2; }
  @media (max-width: 760px) { .add { grid-template-columns: 1fr; } .r { white-space: normal; } }
</style>
