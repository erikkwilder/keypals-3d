<script lang="ts">
  // "I'm in a class": type the class code (or open the link on your card), tap your name, tap your two
  // pictures in order, and your player comes from online. Big, friendly and gentle: a wrong picture just
  // says "try again", and after a few tries it's time to ask the teacher. Or "Sign in with Google" with a
  // school account: the first time, type the class code and say who you are (on the list already: tap
  // your name and pictures; new: just tap "I'm new"); after that, Google takes you straight in.
  import { onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { classState, googleCheck, googleJoin, googleLogin, lookupClass, loginStudent, studentGoogle, studentGoogleDev, type ClassLook } from '../teach/student.svelte';
  import { cloud } from '../state/cloud.svelte';
  import { api, type ApiError } from '../teach/api';
  import { cleanClassCode, sameName, showClassCode } from '../teach/names';
  import { codeBackFromGoogle, forgetWaiting, noteWaiting, showingWaiting, waitingIn, type Waiting } from '../teach/googleTrip';
  import Critter from '../ui/Critter.svelte';
  import Bar from '../ui/Bar.svelte';
  import PicturePick from '../ui/PicturePick.svelte';
  import type { FriendId } from '../art/cast';

  let step = $state<'code' | 'name' | 'pics' | 'going' | 'google' | 'waiting' | 'refused'>(classState.googleTicket ? 'google' : 'code');
  /** back from Google: the one-time ticket, and the first name Google gave */
  let ticket = $state<string | null>(classState.googleTicket);
  let gname = $state<string | null>(null);
  let newName = $state('');
  let needName = $state(false);
  let dev = $state(false);
  let devName = $state('Sam');
  /** the class code: from the class link, or the one she had before Google, kept in this tab (googleTrip.ts) */
  const kept = classState.loginCode ? null : codeBackFromGoogle();
  let code = $state(classState.loginCode ? showClassCode(cleanClassCode(classState.loginCode)) : kept ? showClassCode(kept) : '');
  let look = $state<ClassLook | null>(null);
  let who = $state<ClassLook['students'][number] | null>(null);
  let picked = $state<number[]>([]);
  let msg = $state<string | null>(null);
  let shake = $state(0);
  let busy = $state(false);
  /** back from Google to a class that won't take this account: the server's words (no list, and a way back) */
  let refused = $state<string | null>(null);
  /** waiting for the teacher's yes: the name the server said, and those this computer knows wait in this class */
  let waitName = $state<string | null>(null);
  let waits = $state<Waiting[]>([]);
  /** back from Google with a first name the list has already: most likely her, so her name comes first
   *  ("Is this you?") and "I'm new" waits below the list (the server won't add a second copy either) */
  const mine = $derived(ticket && gname && look ? look.students.find(s => sameName(s.name, gname!)) ?? null : null);

  async function find() {
    msg = null; busy = true;
    try {
      const l = await lookupClass(cleanClassCode(code));
      // back from Google: first, whether this class takes her Google account (the checks joining makes, and
      // joining still makes them), so a class that won't never shows her its list or "I'm new"
      const no = ticket ? await refusal(ticket) : null;
      look = l;
      if (no) { refused = no; step = 'refused'; return; }
      step = 'name'; sfx.pop();
      // someone this computer knows is waiting in this class: say so (and a reload comes back here)
      waits = ticket ? [] : waitingIn(code);
      showingWaiting(waits.length ? code : null);
    }
    catch (e) { msg = (e as Error).message; }
    finally { busy = false; }
  }
  /** the server's words if this class won't take this Google account; null if it will, or if it couldn't be
   *  asked (no internet, too many tries: then "I'm new" hears the answer, as before) */
  async function refusal(t: string): Promise<string | null> {
    try { await googleCheck(t, cleanClassCode(code)); return null; }
    catch (e) { const err = e as ApiError; return [403, 409, 410].includes(err.status) ? err.message : null; }
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
      if ('in' in r) { forgetWaiting([r.in.name]); who = { id: '', name: r.in.name, buddy: null }; arrived(); return; }
      if ('waiting' in r) { toWaiting(r.name); return; }
      // not waiting anywhere (any more): this computer forgets she was
      gname = r.name; forgetWaiting([gname]); step = 'code';
      // she had her class code before Google: back to her class
      if (kept) await find();
    } catch (e) { msg = (e as Error).message; ticket = null; step = 'code'; }
    finally { busy = false; }
  }
  function arrived() { showingWaiting(null); step = 'going'; sfx.pop(); setTimeout(() => game.go('hub'), 700); }
  /** the server says she's waiting for her teacher's yes: say so where the buttons were (the used sign-in
   *  isn't sent again), and keep that on this computer for this class: the class code and her first name only */
  function toWaiting(name: string | null) {
    ticket = null; msg = null;
    waitName = name ?? gname;
    if (look && waitName) noteWaiting(code, waitName);
    showingWaiting(waitingIn(code).length ? code : null);
    step = 'waiting'; sfx.pop();
  }
  /** join with Google as someone new in the class */
  async function joinNew() {
    if (!ticket || busy) return;
    busy = true; msg = null;
    try { const pl = await googleJoin(ticket, cleanClassCode(code), undefined, needName ? newName : undefined); forgetWaiting([pl.name, gname]); who = { id: '', name: pl.name, buddy: null }; arrived(); }
    catch (e) {
      const err = e as Error & { body?: { needName?: boolean; pending?: boolean; name?: unknown } };
      if (err.body?.pending) { toWaiting(typeof err.body.name === 'string' ? err.body.name : null); return; }
      if (err.body?.needName) needName = true;
      msg = err.message;
    }
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
      forgetWaiting([who!.name, gname], ticket ? null : code);
      arrived();
    } catch (e) {
      const err = e as Error & { status?: number };
      msg = err.status === 403 ? `Not quite! Try your two pictures again, ${who!.name}.` : err.message;
      shake++;
      setTimeout(() => { picked = []; }, 650);
    } finally { busy = false; }
  }
  /** from a class that won't take this Google account: back to the class code (still in the box), without
   *  this sign-in, to sign in with another account or log in with the pictures */
  function backToCode() { refused = null; msg = null; ticket = null; gname = null; needName = false; step = 'code'; }
  function back() {
    msg = null;
    if (step === 'pics') { step = 'name'; picked = []; }
    else if (step === 'name') step = 'code';
    else if (step === 'refused') backToCode();
    else { showingWaiting(null); game.go('players'); }
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
          {#if cloud.google}<button class="btn btn-big gbtn" onclick={() => { sfx.click(); studentGoogle(code); }}>Sign in with Google</button>{/if}
          {#if dev}
            <div class="dev"><b>Test Google sign-in (this computer only)</b><div class="drow"><input bind:value={devName} aria-label="Test student's first name" /><button class="btn" onclick={() => studentGoogleDev(devName, code)}>Sign in as a test student</button></div></div>
          {/if}
        </div>
      {/if}
    {:else if step === 'name' && look}
      <h1>{look.class.name}</h1>
      <p class="lead">{look.class.teacher}'s class.{mine ? '' : ticket ? ' Is your name here? Tap it. New to the class? Tap "I\'m new".' : ' Tap your name.'}</p>
      {#snippet newMe(first: boolean)}
        <div class="newme" class:below={!first}>
          {#if needName}<input bind:value={newName} maxlength="16" placeholder="Your first name" aria-label="Your first name" />{/if}
          <button class="btn {first ? 'btn-primary btn-big' : ''}" disabled={busy || (needName && !newName.trim())} onclick={joinNew}>I'm new{gname ? `: ${gname}` : ''}</button>
        </div>
      {/snippet}
      {#if !ticket && waits.length}
        <div class="waits">
          {#each waits as w (w.name)}<p class="lead isyou">{w.name}, you're waiting for your teacher's yes.</p>{/each}
          {#if cloud.google}<button class="btn btn-big gbtn" onclick={() => { sfx.click(); studentGoogle(code); }}>Sign in with Google</button>
          {:else if dev}{#each waits as w (w.name)}<button class="btn" onclick={() => studentGoogleDev(w.name, code)}>Sign in as a test student</button>{/each}{/if}
        </div>
      {/if}
      {#if mine}
        <p class="lead isyou">Is this you? Tap {mine.name}, then your two pictures.</p>
      {:else if ticket}
        {@render newMe(true)}
      {/if}
      <div class="names">
        {#each look.students as s (s.id)}
          <button class="nm card" onclick={() => pickName(s)}><Critter friend={(s.buddy ?? 'dino') as FriendId} size={58} round still decorative /><span>{s.name}</span></button>
        {/each}
      </div>
      {#if !look.students.length}<p class="lead">Nobody is in this class yet. Ask your teacher.</p>{/if}
      {#if mine}{@render newMe(false)}{/if}
    {:else if step === 'pics' && who}
      <h1>Hi {who.name}!</h1>
      <p class="lead">Tap your two pictures, in order.</p>
      <PicturePick {picked} {shake} ontap={tap} />
    {:else if step === 'refused' && look}
      <h1>{look.class.name}</h1>
      <p class="lead">{look.class.teacher}'s class.</p>
      <p class="msg" role="alert">{refused}</p>
      <button class="btn btn-primary btn-big again" onclick={() => { sfx.click(); backToCode(); }}>Go back</button>
    {:else if step === 'waiting'}
      {#if look}<h1>{look.class.name}</h1><p class="lead">{look.class.teacher}'s class.</p>{:else}<h1>Hi{waitName ? ` ${waitName}` : ''}!</h1>{/if}
      <p class="lead isyou" role="status">You're on the list. Your teacher needs to say yes first.</p>
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
  .codef input:focus { border-color: var(--primary-hi); box-shadow: 0 0 0 5px #ece4ff; }
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
  .newme.below { margin: 22px 0 0; }
  .isyou { color: var(--ink); }
  .waits { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 18px; }
  .waits .lead { margin: 0; }
  .msg { margin-top: 18px; font: 700 20px var(--font-body); color: #b4541b; background: #fff4e8; padding: 10px 18px; border-radius: 16px; }
  .again { margin-top: 22px; }
  @media (max-width: 600px) {
    h1 { font-size: 32px; }
    .lead { font-size: 17px; margin-bottom: 14px; }
    .codef input { font-size: 26px; padding: 12px; }
    .names { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .nm { font-size: 19px; }
  }
</style>
