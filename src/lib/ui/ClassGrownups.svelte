<script lang="ts">
  // On the Grown-ups screen: the teacher area, linking this player to a class (the teacher says yes
  // first) or unlinking it, and the world boards for the Arcade's daily challenge (off unless turned on;
  // a made-up name, never the player's own).
  import { game } from '../state/game.svelte';
  import { cloud } from '../state/cloud.svelte';
  import type { Profile } from '../engine/profile';
  import { send } from '../teach/api';
  import { classesOf, loadClasses, lookupClass, mineOf, type ClassLook } from '../teach/student.svelte';
  import { openTeach } from '../teach/teacher.svelte';
  import { boardPrefs, setWorldBoards } from '../teach/boards';
  import { cleanClassCode } from '../teach/names';

  type Props = { p: Profile };
  let { p }: Props = $props();
  const mine = $derived(mineOf(p));
  const classes = $derived(classesOf(p));
  let code = $state('');
  let look = $state<ClassLook | null>(null);
  let claims = $state<string>('new');
  let name = $state('');
  let msg = $state<string | null>(null);
  let busy = $state(false);
  /** the class "Unlink" is asking about */
  let asking = $state<string | null>(null);
  const prefs = $derived(boardPrefs(p));
  $effect(() => { void loadClasses(p); });
  $effect(() => { name = p.name.split(' ')[0]; look = null; code = ''; msg = null; });

  async function run(fn: () => Promise<unknown>, done: string) {
    busy = true; msg = null;
    try { await fn(); msg = done; } catch (e) { msg = (e as Error).message; } finally { busy = false; }
  }
  const find = () => run(async () => { look = await lookupClass(cleanClassCode(code)); claims = 'new'; }, '');
  const link = () => run(async () => {
    await send('/class/link', 'POST', { code: cleanClassCode(code), player: p.cloud!.code, ...(claims === 'new' ? { name } : { claims }) });
    look = null; code = '';
    await loadClasses(p, true);
  }, `Asked to join. ${p.name} joins the class when the teacher says yes.`);
  const unlink = (classId: string, className: string) => run(async () => { await send('/class/link', 'DELETE', { player: p.cloud!.code, class: classId }); await loadClasses(p, true); }, `${p.name} left ${className}. Their progress stays here.`);
  function world(on: boolean) {
    const prof = game.save.profiles.find(x => x.id === p.id);
    if (!prof) return;
    setWorldBoards(prof, on);
    prof.updatedAt = Date.now();
    game.persist();
    game.onProfileChange?.();
  }
</script>

<div class="card cg">
  <div class="teachrow">
    <div><h3>Teachers</h3><p class="muted">Make a class, give class work, see a gradebook and reports. Students log in with a class code and two pictures.</p></div>
    <button class="btn btn-primary" onclick={() => openTeach('grownups')}>Keypals for teachers</button>
  </div>

  <h4>{p.name} and a class</h4>
  {#if !cloud.online}
    <p class="muted small">Linking to a class works on keypals.org.</p>
  {:else if !p.cloud}
    <p class="muted small">Save {p.name} online first (above), then you can link {p.name} to a class so school and home progress are one.</p>
  {:else}
    {#each classes as c (c.id)}
      <p class="small">In <b>{c.name}</b> ({c.teacher}) as {c.student.name}. {#if c.home && asking !== c.id}<button class="lnk" disabled={busy} onclick={() => (asking = c.id)}>Unlink</button>{/if}</p>
      {#if c.home && asking === c.id}
        <div class="ask" role="alertdialog" aria-label="Unlink {p.name} from {c.name}?">
          <p class="small"><b>Unlink {p.name} from {c.name}?</b> {p.name} leaves the class: {c.teacher} won't see {p.name}'s progress or give class work any more. {p.name}'s own progress stays. To join again, ask the teacher.</p>
          <div class="row">
            <button class="btn" onclick={() => (asking = null)}>Stay in the class</button>
            <button class="btn" disabled={busy} onclick={() => { asking = null; void unlink(c.id, c.name); }}>Yes, unlink</button>
          </div>
        </div>
      {/if}
    {/each}
    {#each mine?.pending ?? [] as c (c.id)}
      <p class="small">Waiting for {c.teacher ?? 'the teacher'} to say yes: <b>{c.name}</b>. <button class="lnk" disabled={busy} onclick={() => unlink(c.id, c.name)}>Cancel</button></p>
    {/each}
    {#if !look}
      <form class="row" onsubmit={(e) => { e.preventDefault(); if (code.trim()) void find(); }}>
        <input bind:value={code} placeholder="Class code: fox pear 42" aria-label="Class code" />
        <button class="btn" disabled={!code.trim() || busy}>Link to a class</button>
      </form>
    {:else}
      <p class="small"><b>{look.class.name}</b>, {look.class.teacher}'s class. Is {p.name} already on the class list?</p>
      <div class="row">
        <select bind:value={claims} aria-label="Who is it">
          <option value="new">No: join as a new student</option>
          {#each look.students as s (s.id)}<option value={s.id}>Yes: {s.name}</option>{/each}
        </select>
        {#if claims === 'new'}<input bind:value={name} maxlength="16" aria-label="First name for the class" placeholder="First name" />{/if}
        <button class="btn btn-primary" disabled={busy || (claims === 'new' && !name.trim())} onclick={link}>Ask the teacher</button>
        <button class="btn" onclick={() => (look = null)}>Cancel</button>
      </div>
      <p class="muted small">{claims === 'new' ? 'Only a first name, no last name.' : `School and home progress are put together, and ${p.name} plays as one player everywhere.`}</p>
    {/if}
  {/if}

  <h4>World boards</h4>
  <label class="sw"><input type="checkbox" checked={!!prefs.world} onchange={(e) => world((e.currentTarget as HTMLInputElement).checked)} /> Put {p.name}'s best in the Arcade's daily challenge on the world board</label>
  <p class="muted small">Off unless you turn it on. The board shows only a made-up name{prefs.alias ? ` (${p.name} would be "${prefs.alias}")` : ', like "Brave Otter"'}, the buddy and the score: never a typed name.</p>
  {#if msg}<p class="small msg">{msg}</p>{/if}
</div>

<style>
  .cg { padding: 18px 20px; }
  .teachrow { display: flex; align-items: center; gap: 16px; }
  .teachrow h3 { margin: 0 0 2px; }
  .teachrow p { margin: 0; font: 600 14px/1.4 var(--font-body); }
  h4 { margin: 16px 0 4px; font-size: 16px; }
  .small { font-size: 13.5px; margin: 4px 0 8px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  input, select { font: 600 15px var(--font-body); padding: 8px 12px; border-radius: 12px; border: 2px solid #e6dff5; }
  .lnk { background: none; border: 0; color: var(--primary); font: 700 13.5px var(--font-body); text-decoration: underline; cursor: pointer; }
  .sw { display: flex; gap: 8px; align-items: center; font: 700 14.5px var(--font-body); color: var(--ink2); cursor: pointer; }
  .sw input { width: 20px; height: 20px; }
  .msg { color: var(--primary); font-weight: 700; }
  .ask { margin: 6px 0 10px; padding: 10px 14px; border-radius: 14px; background: #fff4e0; box-shadow: inset 0 0 0 2px #ffd59a; }
  .ask p { margin: 0 0 8px; }
  @media (max-width: 600px) { .teachrow { flex-direction: column; align-items: stretch; } }
</style>
