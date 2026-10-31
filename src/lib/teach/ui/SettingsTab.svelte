<script lang="ts">
  // Class rules: the same rules in the same words as a parent's Time and rules (path/RulesCard.svelte: keep to
  // the path, things a day, play time), who keeps their family's rules and whose family is stricter, sound
  // off for the class, how students sign in (with their school Google account too, maybe only from the
  // school's domain) and sharing the class to Google Classroom. Then "This class": its name and grade,
  // archiving it (students can't log in; it's kept), or deleting it for good (its class players and their
  // progress go too) after typing its name.
  import { teach, act, patchClass, deleteClass, saveSettings, shareClass } from '../teacher.svelte';
  import { DEFAULT_SETTINGS } from '../../adventure/state';
  import { ruleDiffs, type Keep } from '../../path/rules';
  import RulesCard from '../../path/RulesCard.svelte';

  const c = $derived(teach.current!);
  let name = $state(teach.current?.class.name ?? '');
  let grade = $state(teach.current?.class.grade ?? 3);
  let confirm = $state('');
  const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
  const made = $derived(c.students.filter(s => !s.home).length);
  const set = $derived<NonNullable<typeof c.settings>>(c.settings ?? { keep: 'off', goal: 3, limits: {}, google: 'on', domain: null });
  /** a family's own players linked to the class: class rules don't count for them */
  const linked = $derived(c.students.filter(s => s.home && s.status === 'active'));
  /** class players whose family's rule is stricter than the class's (the same words as the parent's page) */
  const stricter = $derived(c.students.filter(s => !s.home && s.status === 'active').flatMap(s => {
    const pr = teach.profiles[s.id];
    const lines = pr ? ruleDiffs(pr, set).filter(d => d.counts === 'family').map(d => `${d.label}, ${d.family}`) : [];
    return lines.length ? [{ name: s.name, lines }] : [];
  }));
  let domain = $state(teach.current?.settings?.domain ?? teach.current?.teacher?.domain ?? '');
  const googleOnes = $derived(c.students.filter(s => s.google).length);
</script>

<div class="tp lead">
  <h3>Class rules</h3>
  <p class="muted">These count for the players this class made. If a family and the class disagree, the stricter rule wins, and both of you can see it.</p>
  {#if linked.length}
    <p class="kept"><b>{linked.length} student{linked.length === 1 ? ' keeps their' : 's keep their'} family's rules: {linked.map(s => s.name).join(', ')}.</b> {linked.length === 1 ? 'This is' : 'These are'} a family's own player{linked.length === 1 ? '' : 's'} linked to the class. The game can't tell home from school, so class rules don't count for them anywhere, and you can't change that from here.</p>
  {/if}
  {#if stricter.length}
    <div class="kept"><b>A family's rule is stricter for {stricter.length === 1 ? 'one student' : `${stricter.length} students`}, so it counts:</b>
      <ul>{#each stricter as x (x.name)}<li>{x.name}: {x.lines.join('; ')}</li>{/each}</ul>
    </div>
  {/if}
</div>

<RulesCard who="your students" keep={(set.keep as Keep) ?? 'off'} goal={set.goal} limits={set.limits ?? {}} play={{ ...DEFAULT_SETTINGS, ...(set.play ?? {}) }} set={(patch) => act(() => saveSettings(patch), 'Saved.')}
  pathLine="Every student has My path: units in order, each mixing Learn, practice, a game and a battle, with a unit check. It starts at this class's grade. Give a whole unit on the Class work tab." />

<div class="tp">
  <h3>Sound</h3>
  <label class="chk"><input type="checkbox" checked={set.sound === 'off'} onchange={(e) => act(() => saveSettings({ sound: e.currentTarget.checked ? 'off' : 'on' }), 'Saved.')} /> Sound off for the class</label>
  <p class="muted">Music, sounds and the coach's voice stay off for your students, and their switches say "Your teacher turned this off". Their own choices come back when you turn this off again.</p>
</div>

<div class="tp">
  <h3>How students sign in</h3>
  <p class="muted">Every student can log in with the class code and their two pictures. Students with a school Google account can also tap "Sign in with Google", type the class code once, and from then on Google takes them straight in, on any computer. We keep only a coded copy of their Google account's id and their first name: never their email.{#if googleOnes} {googleOnes} student{googleOnes === 1 ? ' signs' : 's sign'} in with Google now.{/if}</p>
  <label class="chk"><input type="checkbox" checked={set.google !== 'off'} onchange={(e) => act(() => saveSettings({ google: e.currentTarget.checked ? 'on' : 'off' }), 'Saved.')} /> Students can sign in with Google</label>
  {#if set.google !== 'off'}
    <div class="row dom">
      <label class="chk"><input type="checkbox" checked={!!set.domain} onchange={(e) => act(() => saveSettings({ domain: e.currentTarget.checked ? domain : null }), e.currentTarget.checked ? 'Only school accounts can join with Google now.' : 'Saved.')} disabled={!set.domain && !domain.trim()} /> Only accounts from my school:</label>
      <input bind:value={domain} placeholder="myschool.org" aria-label="School domain" />
      {#if set.domain && domain.trim() && domain.trim().toLowerCase() !== set.domain}<button class="sbtn" onclick={() => act(() => saveSettings({ domain }), 'Saved.')}>Save</button>{/if}
    </div>
  {/if}
  <div class="row share">
    <button class="btn" onclick={() => shareClass(c.class)}><img src="{import.meta.env.BASE_URL}icons/mail.webp" alt="" />Share to Google Classroom</button>
    <span class="muted">Posts the class's login link in Google Classroom. (Bringing a Classroom roster in by itself needs Google to review Keypals first: coming later.)</span>
  </div>
</div>

<h3 class="group">This class</h3>
<div class="tp">
  <h3>Name and grade</h3>
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
  .lead .kept { margin: 8px 0 0; padding: 8px 12px; border-radius: 12px; background: #fff4e0; font: 600 14px/1.45 var(--font-body); color: #6b4a12; }
  .kept ul { margin: 4px 0 0; padding-left: 20px; }
  .group { margin: 22px 0 8px; font: 600 24px var(--font-ui); color: #2b2140; }
  .chk { display: inline-flex; gap: 8px; align-items: center; font: 700 14.5px var(--font-body); color: #2b2140; cursor: pointer; margin: 6px 0; }
  .chk input { width: 18px; height: 18px; }
  .dom { margin: 2px 0 6px 26px; }
  .share { margin-top: 10px; }
  .share .btn { display: inline-flex; align-items: center; gap: 8px; }
  .share img { width: 28px; height: 28px; object-fit: contain; }
  .share .muted { font: 600 13px var(--font-body); max-width: 60ch; }
  .f { display: flex; flex-direction: column; gap: 5px; font: 700 13px var(--font-body); color: #4a4061; }
  .row { align-items: flex-end !important; }
  .danger { border-color: #f1c6c9; background: #fffafa; }
  .danger .f { margin: 10px 0; max-width: 420px; }
  .warnb { background: #c8323c; color: #fff; box-shadow: 0 5px 0 #8f1f27; }
  .warnb:disabled { opacity: .45; }
</style>
