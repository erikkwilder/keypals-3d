<script lang="ts">
  // A class's name and grade; My path and time (keep students on the path, path things a day, daily time
  // for the free-time places); how students sign in (with their school Google account too, maybe only from
  // the school's domain) and sharing the class to Google Classroom; archiving it (students can't log in;
  // it's kept), or deleting it for good (its class players and their progress go too) after typing its name.
  import { teach, act, patchClass, deleteClass, saveSettings, shareClass } from '../teacher.svelte';
  import { FREE_PLACES, KEEPS, KEEP_TEXT, LIMITS, LIMIT_NAME, PLACE_NAME, type FreePlace, type Keep, type Limit } from '../../path/rules';

  const c = $derived(teach.current!);
  let name = $state(teach.current?.class.name ?? '');
  let grade = $state(teach.current?.class.grade ?? 3);
  let confirm = $state('');
  const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
  const made = $derived(c.students.filter(s => !s.home).length);
  type Set = { keep: string; goal: number; limits?: Partial<Record<FreePlace, Limit>>; google?: 'on' | 'off'; domain?: string | null };
  const set = $derived<Set>(c.settings ?? { keep: 'off', goal: 3, limits: {}, google: 'on', domain: null });
  let domain = $state(teach.current?.settings?.domain ?? teach.current?.teacher?.domain ?? '');
  const googleOnes = $derived(c.students.filter(s => s.google).length);
</script>

<div class="tp">
  <h3>My path and time</h3>
  <p class="muted">Every student has My path: units in order, each mixing Learn, practice, a game and a battle, with a unit check. It starts at this class's grade. Give a whole unit on the Class work tab.</p>
  <div class="opt">
    <span class="lab">Keep students on the path</span>
    <div class="seg">{#each KEEPS as k (k)}<button class:on={set.keep === k} onclick={() => act(() => saveSettings({ keep: k as Keep }), 'Saved.')}>{KEEP_TEXT[k].name}</button>{/each}</div>
    <small>{KEEP_TEXT[(set.keep as Keep) ?? 'off'].text}</small>
  </div>
  <div class="opt">
    <span class="lab">Path things a day</span>
    <div class="seg">{#each [1, 2, 3, 4, 5] as n (n)}<button class:on={set.goal === n} onclick={() => act(() => saveSettings({ goal: n }), 'Saved.')}>{n}</button>{/each}</div>
  </div>
  <div class="opt">
    <span class="lab">Daily time for the just-for-fun places</span>
    <div class="lims">
      {#each FREE_PLACES as pl (pl)}
        <label>{PLACE_NAME[pl as FreePlace]}<select value={set.limits?.[pl as FreePlace] ?? 'off'} onchange={(e) => act(() => saveSettings({ limits: { [pl]: (e.currentTarget as HTMLSelectElement).value as Limit } }), 'Saved.')}>{#each LIMITS as l (l)}<option value={l}>{LIMIT_NAME(l as Limit)}</option>{/each}</select></label>
      {/each}
    </div>
    <small>When time's up the door says so kindly and points to the path. Earned: 5 minutes, plus a minute for every minute of practice. A family's own player linked to the class keeps the family's rules at home.</small>
  </div>
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
  .opt { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; margin: 12px 0; }
  .opt small { font: 600 13px/1.4 var(--font-body); color: #7a7092; max-width: 80ch; }
  .lab { font: 800 12px var(--font-body); text-transform: uppercase; letter-spacing: .06em; color: #7a7092; }
  .seg { display: inline-flex; flex-wrap: wrap; border: 1.5px solid #d8cfee; border-radius: 12px; overflow: hidden; }
  .seg button { border: 0; background: #fff; padding: 8px 14px; font: 800 14px var(--font-body); color: #4a4061; cursor: pointer; border-right: 1px solid #ece6f6; }
  .seg button:last-child { border-right: 0; }
  .seg button.on { background: #7c5cf5; color: #fff; }
  .lims { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px 14px; width: 100%; max-width: 820px; }
  .lims label { display: flex; flex-direction: column; gap: 4px; font: 700 13px var(--font-body); color: #4a4061; }
  .chk { display: inline-flex; gap: 8px; align-items: center; font: 700 14.5px var(--font-body); color: #2b2140; cursor: pointer; margin: 6px 0; }
  .chk input { width: 18px; height: 18px; }
  .dom { margin: 2px 0 6px 26px; }
  .share { margin-top: 10px; }
  .share .btn { display: inline-flex; align-items: center; gap: 8px; }
  .share img { width: 28px; height: 28px; object-fit: contain; }
  .share .muted { font: 600 13px var(--font-body); max-width: 60ch; }
  @media (max-width: 760px) { .lims { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .f { display: flex; flex-direction: column; gap: 5px; font: 700 13px var(--font-body); color: #4a4061; }
  .row { align-items: flex-end !important; }
  .danger { border-color: #f1c6c9; background: #fffafa; }
  .danger .f { margin: 10px 0; max-width: 420px; }
  .warnb { background: #c8323c; color: #fff; box-shadow: 0 5px 0 #8f1f27; }
  .warnb:disabled { opacity: .45; }
</style>
