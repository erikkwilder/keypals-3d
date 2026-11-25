<script lang="ts">
  // "I'm in a class": type the class code (or open the link on your card), tap your name, tap your two
  // pictures in order, and your player comes from online. Big, friendly and gentle: a wrong picture just
  // says "try again", and after a few tries it's time to ask the teacher. Or "Sign in with Google" with a
  // school account: the first time, type the class code and say who you are (on the list already: tap
  // your name and pictures; new: just tap "I'm new"); after that, Google takes you straight in.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { classState, googleJoin, googleLogin, lookupClass, loginStudent, studentGoogle, studentGoogleDev, type ClassLook } from '../teach/student.svelte';
  import { cloud } from '../state/cloud.svelte';
  import { api } from '../teach/api';
  import { cleanClassCode, showClassCode } from '../teach/names';
  import Critter from '../ui/Critter.svelte';
  import Bar from '../ui/Bar.svelte';
  import PicturePick from '../ui/PicturePick.svelte';
  import type { FriendId } from '../art/cast';

  let step = $state<'code' | 'name' | 'pics' | 'going' | 'google'>(classState.googleTicket ? 'google' : 'code');
  /** back from Google: the one-time ticket, and the first name Google gave */
  let ticket = $state<string | null>(classState.googleTicket);
  let gname = $state<string | null>(null);
  let newName = $state('');
  let needName = $state(false);
  let dev = $state(false);
  let devName = $state('Sam');
  let code = $state(classState.loginCode ? showClassCode(cleanClassCode(classState.loginCode)) : '');
  let look = $state<ClassLook | null>(null);
  let who = $state<ClassLook['students'][number] | null>(null);
  let picked = $state<number[]>([]);
  let msg = $state<string | null>(null);
  let shake = $state(0);
  let busy = $state(false);

  async function find() {
    msg = null; busy = true;
    try { look = await lookupClass(cleanClassCode(code)); step = 'name'; sfx.pop(); }
    catch (e) { msg = (e as Error).message; }
    finally { busy = false; }
  }
  onMount(() => {
    void api<{ dev: boolean }>('/teach/config').then(c => (dev = c.dev)).catch(() => null);
    if (classState.googleTicket) { classState.googleTicket = null; void fromGoogle(); return; }
    if (classState.loginCode) { classState.loginCode = null; void find(); }
  });
  async function fromGoogle() {
    if (!ticket) return;
    busy = true; msg = null;
    try {
      const r = await googleLogin(ticket);
      if ('in' in r) { who = { id: '', name: r.in.name, buddy: null }; arrived(); return; }
      gname = r.name; step = 'code';
    } catch (e) { msg = (e as Error).message; ticket = null; step = 'code'; }
    finally { busy = false; }
  }
  function arrived() { step = 'going'; sfx.pop(); setTimeout(() => game.go('hub'), 700); }
  /** join with Google as someone new in the class */
  async function joinNew() {
    if (!ticket || busy) return;
    busy = true; msg = null;
    try { const pl = await googleJoin(ticket, cleanClassCode(code), undefined, needName ? newName : undefined); who = { id: '', name: pl.name, buddy: null }; arrived(); }
    catch (e) { const err = e as Error & { body?: { needName?: boolean } }; if (err.body?.needName) needName = true; msg = err.message; }
    finally { busy = false; }
  }
  function pickName(s: ClassLook['students'][number]) { sfx.click(); who = s; picked = []; msg = null; step = 'pics'; }
  async function tap(i: number) {
    if (busy || picked.length >= 2 || picked.includes(i)) return;
    sfx.click();
    picked = [...picked, i];
    if (picked.length < 2) return;
    busy = true;
    try {
      if (ticket) await googleJoin(ticket, cleanClassCode(code), { id: who!.id, pics: picked });
      else await loginStudent(cleanClassCode(code), who!.id, picked);
      step = 'going'; sfx.pop();
      setTimeout(() => game.go('hub'), 700);
    } catch (e) {
      const err = e as Error & { status?: number };
      msg = err.status === 403 ? `Not quite! Try your two pictures again, ${who!.name}.` : err.message;
      shake++;
      setTimeout(() => { picked = []; }, 650);
    } finally { busy = false; }
  }
  function back() {
    msg = null;
    if (step === 'pics') { step = 'name'; picked = []; }
    else if (step === 'name') step = 'code';
    else game.go('players');
  }
</script>

<div class="screen clogin">
  <Bar title="I'm in a class" plain {back} />
  <div class="body scroll">
    {#if step === 'google'}
      <h1>Signing you in…</h1>
      <p class="lead">Just a moment.</p>
    {:else if step === 'code'}
      <h1>{ticket ? `Hi${gname ? ` ${gname}` : ''}!` : "I'm in a class"}</h1>
      <p class="lead">{ticket ? "Type your class code. You only do this once: next time, Sign in with Google takes you straight in." : "Type your class code. It's on your card: two words and a number."}</p>
      <form class="codef" onsubmit={(e) => { e.preventDefault(); if (code.trim()) void find(); }}>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={code} placeholder="fox pear 42" autocomplete="off" autocapitalize="off" spellcheck="false" autofocus aria-label="Class code" />
        <button class="btn btn-primary btn-big" disabled={!code.trim() || busy}>Next</button>
      </form>
      {#if !ticket && (cloud.google || dev)}
        <div class="org">
          <span class="or">or, with a school Google account</span>
          {#if cloud.google}<button class="btn btn-big gbtn" onclick={() => { sfx.click(); studentGoogle(); }}>Sign in with Google</button>{/if}
          {#if dev}
            <div class="dev"><b>Test Google sign-in (this computer only)</b><div class="drow"><input bind:value={devName} aria-label="Test student's first name" /><button class="btn" onclick={() => studentGoogleDev(devName)}>Sign in as a test student</button></div></div>
          {/if}
        </div>
      {/if}
    {:else if step === 'name' && look}
      <h1>{look.class.name}</h1>
      <p class="lead">{look.class.teacher}'s class. {ticket ? 'Is your name here? Tap it. New to the class? Tap "I\'m new".' : 'Tap your name.'}</p>
      {#if ticket}
        <div class="newme">
          {#if needName}<input bind:value={newName} maxlength="16" placeholder="Your first name" aria-label="Your first name" />{/if}
          <button class="btn btn-primary btn-big" disabled={busy || (needName && !newName.trim())} onclick={joinNew}>I'm new{gname ? `: ${gname}` : ''}</button>
        </div>
      {/if}
      <div class="names">
        {#each look.students as s (s.id)}
          <button class="nm card" onclick={() => pickName(s)}><Critter friend={(s.buddy ?? 'dino') as FriendId} size={58} round still decorative /><span>{s.name}</span></button>
        {/each}
      </div>
      {#if !look.students.length}<p class="lead">Nobody is in this class yet. Ask your teacher.</p>{/if}
    {:else if step === 'pics' && who}
      <h1>Hi {who.name}!</h1>
      <p class="lead">Tap your two pictures, in order.</p>
      <PicturePick {picked} {shake} ontap={tap} />
    {:else if step === 'going'}
      <h1>Welcome, {who?.name}!</h1>
      <p class="lead">Getting your things ready…</p>
    {/if}
    {#if msg}<p class="msg" role="alert">{msg}</p>{/if}
  </div>
</div>

<style>
  .clogin { display: flex; flex-direction: column; background: radial-gradient(circle at 15% 10%, #ffe6f2 0, transparent 40%), radial-gradient(circle at 85% 20%, #dff1ff 0, transparent 42%), radial-gradient(circle at 50% 100%, #e3fbef 0, transparent 50%), var(--bg); }
  .top { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px; }
  .body { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; padding: 10px 20px 40px; text-align: center; }
  h1 { font-size: 44px; margin: 6px 0 4px; }
  .lead { font: 600 21px/1.35 var(--font-body); color: var(--ink2); margin: 0 0 22px; }
  .codef { display: flex; flex-direction: column; gap: 16px; align-items: center; width: min(520px, 100%); }
  .codef input { width: 100%; font: 600 34px var(--font-ui); text-align: center; padding: 16px; border-radius: 22px; border: 3px solid #d9cdf7; background: #fff; color: var(--ink); letter-spacing: .02em; }
  .codef input:focus { outline: none; border-color: var(--primary-hi); box-shadow: 0 0 0 5px #ece4ff; }
  .names { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; width: min(960px, 100%); }
  .nm { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; cursor: pointer; font: 600 22px var(--font-ui); color: var(--ink); }
  .nm:hover { transform: translateY(-3px); }
  .org { margin-top: 26px; display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(520px, 100%); }
  .or { font: 700 16px var(--font-body); color: var(--muted); }
  .gbtn { display: inline-flex; align-items: center; gap: 10px; }
  .dev { margin-top: 6px; padding: 10px 14px; border: 2px dashed #f0c36a; background: #fffaf0; border-radius: 14px; font: 600 14px var(--font-body); }
  .drow { display: flex; gap: 8px; margin-top: 6px; justify-content: center; flex-wrap: wrap; }
  .drow input, .newme input { font: 600 18px var(--font-body); padding: 8px 12px; border-radius: 12px; border: 2px solid #d9cdf7; }
  .newme { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-bottom: 18px; }
  .msg { margin-top: 18px; font: 700 20px var(--font-body); color: #b4541b; background: #fff4e8; padding: 10px 18px; border-radius: 16px; }
  @media (max-width: 600px) {
    h1 { font-size: 32px; }
    .lead { font-size: 17px; margin-bottom: 14px; }
    .codef input { font-size: 26px; padding: 12px; }
    .names { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .nm { font-size: 19px; }
  }
</style>
