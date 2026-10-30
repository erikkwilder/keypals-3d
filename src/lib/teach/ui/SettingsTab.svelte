<script lang="ts">
  // A class's name and grade, archiving it (students can't log in; it's kept), or deleting it for good
  // (its class players and their progress go too) after typing its name.
  import { teach, act, patchClass, deleteClass } from '../teacher.svelte';

  const c = $derived(teach.current!);
  let name = $state(teach.current?.class.name ?? '');
  let grade = $state(teach.current?.class.grade ?? 3);
  let confirm = $state('');
  const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
  const made = $derived(c.students.filter(s => !s.home).length);
</script>

<div class="tp">
  <h3>Class settings</h3>
  <div class="row">
    <label class="f">Name<input bind:value={name} maxlength="40" /></label>
    <label class="f">Grade<select bind:value={grade}>{#each GRADES as g, i (i)}<option value={i}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>{/each}</select></label>
    <button class="btn" disabled={!name.trim() || teach.busy} onclick={() => act(() => patchClass({ name, grade }), 'Saved.')}>Save</button>
  </div>
</div>

<div class="tp">
  <h3>{c.class.archived ? 'Archived' : 'Archive the class'}</h3>
  <p class="muted">{c.class.archived ? 'Students can\'t log in and don\'t see its class work. Everything is kept: bring it back any time.' : 'At the end of a term: students can\'t log in any more and its class work goes away, but everything is kept and you can bring it back.'}</p>
  <button class="btn" onclick={() => act(() => patchClass({ archived: !c.class.archived }), c.class.archived ? 'The class is back.' : 'Archived.')}>{c.class.archived ? 'Bring it back' : 'Archive'}</button>
</div>

<div class="tp danger">
  <h3>Delete the class</h3>
  <p>This deletes the class, its class work and its roster for good. {made} class player{made === 1 ? '' : 's'} and their progress will be deleted too. Players linked from home stay with their families.</p>
  <label class="f">Type the class's name, <b>{c.class.name}</b>, to delete it<input bind:value={confirm} /></label>
  <button class="btn warnb" disabled={confirm.trim().toLowerCase() !== c.class.name.trim().toLowerCase() || teach.busy} onclick={() => act(() => deleteClass(confirm), 'The class was deleted.')}>Delete {c.class.name} for good</button>
</div>

<style>
  .f { display: flex; flex-direction: column; gap: 5px; font: 700 13px var(--font-body); color: #4a4061; }
  .row { align-items: flex-end !important; }
  .danger { border-color: #f1c6c9; background: #fffafa; }
  .danger .f { margin: 10px 0; max-width: 420px; }
  .warnb { background: #c8323c; color: #fff; box-shadow: 0 5px 0 #8f1f27; }
  .warnb:disabled { opacity: .45; }
</style>
