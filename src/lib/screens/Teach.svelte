<script lang="ts">
  // Keypals for teachers: sign in with Google, say "I'm a teacher" once, then classes. A school Google
  // account's classes are on straight away; a plain Gmail account can set up, and its classes turn on once
  // we've said yes (a banner says so). A class has a code
  // students type (or scan from their login card), a roster of first names, class work, a gradebook,
  // reports and the class's boards. Built for a desktop or a tablet, in light colours and plain words.
  // Behind the grown-up check like the Grown-ups screen, so a child at a shared computer can't wander in.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { cloud, grownupOpen, signInForTeach, signOut } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';
  import GrownupGate from '../ui/GrownupGate.svelte';
  import { teach, act, loadMe, devSignIn, becomeTeacher, createClass, openClass } from '../teach/teacher.svelte';
  import { showClassCode } from '../teach/names';
  import Bar from '../ui/Bar.svelte';
  import ClassPage from '../teach/ui/ClassPage.svelte';

  let unlocked = $state(grownupOpen());
  let display = $state('');
  let agree = $state(false);
  let newName = $state('');
  let newGrade = $state(3);
  let devName = $state('Ms. Rivera');
  let showArchived = $state(false);
  const GRADES = ['K', '1', '2', '3', '4', '5', '6', '7', '8'];
  const active = $derived(teach.classes.filter(c => !c.archived));
  const archived = $derived(teach.classes.filter(c => c.archived));
  const status = $derived(teach.me?.teacher?.status ?? 'approved');

  onMount(() => { if (!teach.loaded || !teach.me?.signedIn) void loadMe(); });
  async function out() { await signOut(); teach.me = { signedIn: false }; teach.classes = []; teach.current = null; }
  /** Back: from a class to all of them, then back to where For teachers was opened from (Home, or the
   *  player list with nobody picked: game.back) */
  function back() { if (teach.current) { teach.current = null; return; } game.back(); }
  /** A parent who came this way to sign in: their players are on the player list, not here. */
  function parent() { sfx.click(); game.go(game.save.profiles.length ? 'players' : 'newPlayer'); }
</script>

{#snippet parentWay()}
  <button class="btn" onclick={parent}>I'm a parent, take me to my players</button>
{/snippet}

{#snippet waiting()}
  <section class="panel wait" class:no={status === 'declined'}>
    {#if status === 'declined'}
      <h2>We couldn't turn on classes for this account</h2>
      <p>Students can't log in to these classes. If you're a teacher, sign in with your school Google account and your classes are on straight away, or write to us from Ideas and help.</p>
    {:else}
      <h2>We'll turn on your classes soon</h2>
      <p>You signed in with a personal Google account, so we check first that you're a teacher (usually within a day). You can set everything up now: add students, print cards and give class work. Students can log in once your classes are on. With a school Google account they're on straight away.</p>
    {/if}
  </section>
{/snippet}

<div class="screen teach">
  <Bar title={teach.current ? 'All classes' : 'For teachers'} {back} />
  {#if teach.me?.teacher}
    <div class="wholine"><span class="who">{teach.me.teacher.display}</span><button class="tb" onclick={out}>Sign out</button></div>
  {/if}

  {#if !unlocked}
    <GrownupGate onpass={() => (unlocked = true)} title="For teachers" note="A quick check that you're a grown-up." />
  {:else}
    <div class="tbody scroll">
      <div class="wrap">
        {#if !cloud.online}
          <section class="panel">
            <h2>Teachers' pages need the internet</h2>
            <p>Open Keypals at <b>keypals.org</b> to make classes. Nothing about classes is kept on this computer.</p>
          </section>
        {:else if !teach.loaded}
          <p class="muted">Loading…</p>
        {:else if !teach.me?.signedIn}
          <section class="panel hero">
            <h2>Use Keypals with your class</h2>
            <p>Make a class, add your students by first name, and print login cards. Students log in with a class code and two pictures: no emails, no passwords to remember. Then give class work, see a gradebook and reports, and cheer on a class goal together.</p>
            <ul class="facts">
              <li>Free, with no ads.</li>
              <li>For each child we keep only the first name or nickname you type, their game progress and their picture password.</li>
              <li>Teachers sign in with Google. A school Google account is best: its classes are on straight away. With a personal Gmail account you can set everything up, and we turn your classes on once we've checked (usually within a day).</li>
              <li>Students log in with the class code and pictures, or with their own school Google account. They never give us an email.</li>
            </ul>
            <div class="row">
              {#if cloud.google}<button class="btn btn-primary" onclick={signInForTeach}>Sign in with Google</button>{/if}
              {@render parentWay()}
              {#if !cloud.google && !teach.dev}<p class="muted">Sign-in isn't set up on this copy of Keypals.</p>{/if}
            </div>
            {#if teach.dev}
              <div class="dev">
                <b>Test sign-in (this computer only)</b>
                <p>For trying the teacher pages on a test server. It doesn't exist on the real site. A school account's classes are on straight away; a Gmail account's wait for an admin.</p>
                <div class="row"><input bind:value={devName} aria-label="Test teacher's name" /><button class="btn" onclick={() => devSignIn(devName)}>Test: school account</button><button class="btn" onclick={() => devSignIn(devName, true)}>Test: Gmail account</button></div>
              </div>
            {/if}
          </section>
        {:else if !teach.me.teacher && teach.me.canTeach === false}
          <section class="panel">
            <h2>Teachers sign in with Google</h2>
            <p>You're signed in with {teach.me.account?.provider === 'microsoft' ? 'Microsoft' : 'another account'}. To make classes, sign out and sign in with a Google account: a school one is best, so your classes are on straight away.</p>
            <div class="row"><button class="btn btn-primary" onclick={out}>Sign out</button>{@render parentWay()}</div>
          </section>
        {:else if !teach.me.teacher}
          <section class="panel">
            <h2>I'm a teacher</h2>
            <p>Signed in as {teach.me.account?.name ?? 'you'}. One quick step before your first class.</p>
            <label class="field">The name your students call you
              <input bind:value={display} placeholder="Ms. Rivera" maxlength="30" />
            </label>
            <div class="note">
              <b>Before you start</b>
              <ul>
                <li>I'm using Keypals with my school's permission, for learning only.</li>
                <li>I'll add students by first name or a nickname: no last names, emails or birthdays.</li>
                <li>Keypals keeps each student's name as I type it, their game progress and their picture password, and this week's practice for the class board. I can delete a student or a whole class at any time, and their class players go with them.</li>
                <li>Families can link a player from home to my class; I say yes first.</li>
              </ul>
              <label class="check"><input type="checkbox" bind:checked={agree} /> I agree</label>
            </div>
            <div class="row"><button class="btn btn-primary" disabled={!display.trim() || !agree || teach.busy} onclick={() => act(() => becomeTeacher(display, agree))}>Continue</button>{@render parentWay()}</div>
          </section>
        {:else if teach.current}
          {#if status !== 'approved'}{@render waiting()}{/if}
          <ClassPage />
        {:else}
          {#if status !== 'approved'}{@render waiting()}{/if}
          <section class="panel">
            <div class="h2row"><h2>Your classes</h2></div>
            {#if active.length}
              <div class="classes">
                {#each active as c (c.id)}
                  <button class="cls" onclick={() => act(() => openClass(c.id))}>
                    <b>{c.name}</b>
                    <span>Grade {GRADES[c.grade]} · {c.students ?? 0} student{c.students === 1 ? '' : 's'}{#if c.pending} · <em>{c.pending} waiting for you</em>{/if}</span>
                    <span class="code">Code: {showClassCode(c.code)}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <p class="muted">No classes yet. Make your first one below.</p>
            {/if}
            <form class="newc" onsubmit={(e) => { e.preventDefault(); if (newName.trim()) act(() => createClass(newName, newGrade)); }}>
              <b>New class</b>
              <label class="field">Name<input bind:value={newName} placeholder="Room 12 Math" maxlength="40" /></label>
              <label class="field">Grade<select bind:value={newGrade}>{#each GRADES as g, i (i)}<option value={i}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>{/each}</select></label>
              <button class="btn btn-primary" disabled={!newName.trim() || teach.busy}>Make the class</button>
            </form>
            {#if archived.length}
              <button class="link" onclick={() => (showArchived = !showArchived)}>{showArchived ? 'Hide' : 'Show'} archived classes ({archived.length})</button>
              {#if showArchived}
                <div class="classes">
                  {#each archived as c (c.id)}<button class="cls old" onclick={() => act(() => openClass(c.id, 'settings'))}><b>{c.name}</b><span>Archived · grade {GRADES[c.grade]}</span></button>{/each}
                </div>
              {/if}
            {/if}
          </section>
        {/if}
        {#if teach.msg && !teach.current}<p class="msg" role="status">{teach.msg}</p>{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .teach { display: flex; flex-direction: column; background: #f7f5fb; color: #2b2140; }
  .wholine { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 6px 20px; background: #faf8ff; }
  .tb { border: 1px solid #ddd5ee; background: #fff; border-radius: 10px; padding: 8px 12px; font: 700 14px var(--font-body); color: #3b3157; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
  .tb:hover { background: #f6f2ff; }
  .brand { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .brand img { width: 38px; height: 38px; object-fit: contain; }
  .brand div { display: flex; flex-direction: column; }
  .brand b { font: 600 20px var(--font-ui); }
  .brand span { font: 700 12px var(--font-body); color: #7a7092; }
  .who { font: 700 14px var(--font-body); color: #4a4061; }
  .tbody { flex: 1; min-height: 0; }
  .wrap { max-width: 1240px; margin: 0 auto; padding: 22px 24px 60px; }
  .panel { background: #fff; border: 1px solid #e8e2f3; border-radius: 16px; padding: 20px 24px; margin-bottom: 18px; }
  .panel h2 { margin: 0 0 8px; font: 600 26px var(--font-ui); }
  .panel p { font: 600 15.5px/1.5 var(--font-body); color: #4a4061; margin: 0 0 10px; max-width: 75ch; }
  .hero h2 { font-size: 32px; }
  .facts { margin: 6px 0 16px; padding-left: 20px; font: 600 15px/1.7 var(--font-body); color: #4a4061; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .dev { margin-top: 18px; padding: 12px 14px; border: 2px dashed #f0c36a; background: #fffaf0; border-radius: 12px; }
  .dev b { font: 800 14px var(--font-body); }
  .dev p { font-size: 13.5px; margin: 2px 0 8px; }
  input, select { font: 600 15px var(--font-body); padding: 9px 12px; border-radius: 10px; border: 1.5px solid #d8cfee; background: #fff; color: #2b2140; }
  .field { display: flex; flex-direction: column; gap: 5px; font: 700 13px var(--font-body); color: #4a4061; margin: 10px 0; max-width: 360px; }
  .note { background: #f8f6fc; border: 1px solid #e8e2f3; border-radius: 12px; padding: 12px 16px; margin: 12px 0; max-width: 80ch; }
  .note b { font: 800 14px var(--font-body); }
  .note ul { margin: 6px 0 10px; padding-left: 20px; font: 600 14.5px/1.6 var(--font-body); color: #4a4061; }
  .check { display: inline-flex; gap: 8px; align-items: center; font: 800 15px var(--font-body); cursor: pointer; }
  .check input { width: 20px; height: 20px; }
  .h2row { display: flex; align-items: center; gap: 12px; }
  .classes { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; margin: 10px 0 18px; }
  .cls { text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: 14px; border: 1.5px solid #e2daf2; background: #fbfaff; cursor: pointer; color: inherit; }
  .cls:hover { border-color: #a48bff; background: #f6f2ff; }
  .cls b { font: 600 20px var(--font-ui); }
  .cls span { font: 700 13.5px var(--font-body); color: #6d6680; }
  .cls em { font-style: normal; color: #b4541b; }
  .cls .code { font-family: ui-monospace, monospace; font-size: 13px; }
  .cls.old { opacity: .75; }
  .newc { display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap; padding: 14px 16px; border-radius: 14px; background: #f8f6fc; border: 1px solid #ece6f6; }
  .newc > b { width: 100%; font: 800 15px var(--font-body); }
  .newc .field { margin: 0; }
  .link { background: none; border: 0; padding: 12px 0 0; font: 700 14px var(--font-body); color: #6a4fe0; cursor: pointer; text-decoration: underline; }
  .msg { font: 700 14.5px var(--font-body); color: #6a4fe0; }
  .muted { color: #7a7092; }
  .wait { background: #fff8e6; border-color: #f2d88a; }
  .wait h2 { font-size: 22px; }
  .wait.no { background: #fff4f4; border-color: #f1c6c9; }
  @media (max-width: 700px) {
    .tbar { padding: 8px 10px; gap: 8px; }
    .tb span, .brand span, .who { display: none; }
    .wrap { padding: 14px 12px 40px; }
    .panel { padding: 16px; }
  }
</style>
