<script lang="ts">
  // Ideas and help: the Ideas board (ideas from families and teachers, a big heart to vote for the ones you
  // like most), and, behind the grown-up check, "Suggest an idea" and "Tell us about a problem". New ideas
  // show on the board once they've been read. Opened from the menu and the Grown-ups screen.
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import Header from '../ui/Header.svelte';
  import PageTabs from '../ui/PageTabs.svelte';
  import GrownupGate from '../ui/GrownupGate.svelte';
  import { call, cloud, grownupOpen } from '../state/cloud.svelte';
  import { IDEA_KINDS, browserName, setVoted, votedIds, type Idea, type IdeaKind } from '../state/feedback';

  const base = import.meta.env.BASE_URL;
  type Tab = 'board' | 'suggest' | 'problem';
  let tab = $state<Tab>(game.ideasTab);
  let unlocked = $state(grownupOpen());

  // ---- the board ----
  let sort = $state<'top' | 'new'>('top');
  let ideas = $state<Idea[]>([]);
  let loading = $state(true);
  let boardMsg = $state<string | null>(null);
  let voted = $state(new Set(votedIds()));
  async function load() {
    loading = true; boardMsg = null;
    try { ideas = (await call<{ ideas: Idea[] }>(`/ideas?sort=${sort}`)).ideas; }
    catch (e) { boardMsg = (e as Error).message; }
    finally { loading = false; }
  }
  $effect(() => { void sort; if (cloud.online) void load(); else loading = false; });
  async function heart(i: Idea) {
    const on = !voted.has(i.id);
    sfx.click();
    // straight away on screen; put back if the server says no
    setVoted(i.id, on); voted = new Set(votedIds()); i.votes = Math.max(0, i.votes + (on ? 1 : -1));
    try { i.votes = (await call<{ votes: number }>(`/ideas/${i.id}/vote`, { method: 'POST', body: JSON.stringify({ up: on }) })).votes; }
    catch (e) { setVoted(i.id, !on); voted = new Set(votedIds()); i.votes = Math.max(0, i.votes + (on ? -1 : 1)); boardMsg = (e as Error).message; }
  }
  const kindName = (k: IdeaKind) => IDEA_KINDS.find(x => x.id === k)?.name ?? '';

  // ---- suggesting an idea, telling us about a problem (grown-ups) ----
  let kind = $state<IdeaKind>('game');
  let text = $state('');
  let wantReply = $state(false);
  let email = $state('');
  let busy = $state(false);
  let sent = $state<Tab | null>(null);
  let formMsg = $state<string | null>(null);
  function pick(t: Tab) { tab = t; formMsg = null; if (t !== sent) sent = null; }
  async function send() {
    busy = true; formMsg = null;
    const reply = wantReply && email.trim() ? email.trim() : undefined;
    try {
      if (tab === 'suggest') await call('/ideas', { method: 'POST', body: JSON.stringify({ kind, text, email: reply }) });
      else await call('/problems', { method: 'POST', body: JSON.stringify({ text, email: reply, screen: game.ideasFrom, version: __APP_VERSION__, browser: browserName(navigator.userAgent), size: `${window.innerWidth}x${window.innerHeight}` }) });
      sent = tab; text = ''; email = ''; wantReply = false; sfx.complete();
    } catch (e) { formMsg = (e as Error).message; sfx.nope(); }
    finally { busy = false; }
  }
</script>

<div class="screen ideas">
  <Header />
  <!-- the board is for everyone (see the ideas, heart the ones you like); suggesting and telling us about a
       problem are for grown-ups (behind the grown-up check) -->
  <PageTabs label="Ideas and help" value={tab} onpick={(t) => pick(t as Tab)}
    tabs={[{ id: 'board', label: 'Ideas' }, { id: 'suggest', label: 'Suggest one', small: '(grown-ups)' }, { id: 'problem', label: 'A problem', small: '(grown-ups)' }]} />
  <div class="body scroll">


    {#if !cloud.online}
      <div class="card pane"><p>Ideas and help need the internet. You can also write to <b>hello@fancyant.com</b>.</p></div>
    {:else if tab === 'board'}
      <div class="lead">
        <p>Ideas for Keypals from families and teachers. <b>Tap the heart</b> on the ones you'd like most!</p>
        <div class="seg">
          <button class:on={sort === 'top'} onclick={() => (sort = 'top')}>Most hearts</button>
          <button class:on={sort === 'new'} onclick={() => (sort = 'new')}>Newest</button>
        </div>
      </div>
      {#if boardMsg}<p class="msg">{boardMsg}</p>{/if}
      {#if loading}<p class="muted">Getting the ideas...</p>
      {:else if !ideas.length}
        <div class="card pane empty"><img src="{base}icons/bulb.webp" alt="" /><p>No ideas on the board yet. A grown-up can suggest the first one!</p><button class="btn btn-primary" onclick={() => pick('suggest')}>Suggest an idea</button></div>
      {:else}
        <ul class="list">
          {#each ideas as i (i.id)}
            <li class="idea card" class:done={i.status === 'done'}>
              <div class="itext">
                <div class="tags"><span class="tag">{kindName(i.kind)}</span>{#if i.status === 'planned'}<span class="tag planned">We're making it</span>{:else if i.status === 'done'}<span class="tag doneTag">Done!</span>{/if}</div>
                <p>{i.text}</p>
              </div>
              <button class="heart" class:on={voted.has(i.id)} aria-pressed={voted.has(i.id)} aria-label="{voted.has(i.id) ? 'Take back my heart' : 'Give it a heart'} ({i.votes})" onclick={() => heart(i)}>
                <img src="{base}icons/heart.webp" alt="" /><b>{i.votes}</b>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {:else if !unlocked}
      <div class="card gatecard"><GrownupGate title={tab === 'suggest' ? 'Suggest an idea' : 'Tell us about a problem'} note="For grown-ups: a quick check first." onpass={() => (unlocked = true)} /></div>
    {:else if sent === tab}
      <div class="card pane thanks">
        <img src="{base}icons/{tab === 'suggest' ? 'bulb' : 'help'}.webp" alt="" />
        <h3>Thank you!</h3>
        <p>{tab === 'suggest' ? 'We read every idea. Once it has been read it shows on the Ideas board, where everyone can give it a heart.' : 'We read every message and use them to fix things. If you asked for a reply, we will write back.'}</p>
        <div class="row"><button class="btn" onclick={() => (sent = null)}>Send another</button><button class="btn btn-primary" onclick={() => pick('board')}>See the Ideas board</button></div>
      </div>
    {:else}
      <form class="card pane form" onsubmit={(e) => { e.preventDefault(); send(); }}>
        {#if tab === 'suggest'}
          <h3>Suggest an idea</h3>
          <p class="muted small">A new game, something to make better, anything. New ideas show on the Ideas board once they've been read.</p>
          <div class="seg kinds">{#each IDEA_KINDS as k (k.id)}<button type="button" class:on={kind === k.id} onclick={() => (kind = k.id)}>{k.name}</button>{/each}</div>
          <label for="ih-text">Your idea</label>
          <textarea id="ih-text" bind:value={text} maxlength="500" rows="4" placeholder="A cooking game where you measure with fractions..."></textarea>
          <span class="count">{text.length}/500</span>
        {:else}
          <h3>Tell us about a problem</h3>
          <p class="muted small">Something not working, something confusing, a wrong answer, anything. We also send the game version, the browser and the screen size, to help find it; nothing about the players.</p>
          <label for="ih-text">What happened?</label>
          <textarea id="ih-text" bind:value={text} maxlength="1000" rows="5" placeholder="On the fractions trip the pizza didn't..."></textarea>
          <span class="count">{text.length}/1000</span>
        {/if}
        <label class="check"><input type="checkbox" bind:checked={wantReply} /> I'd like a reply</label>
        {#if wantReply}
          <label for="ih-email">Your email (a grown-up's), only for the reply</label>
          <input id="ih-email" class="txt" type="email" bind:value={email} maxlength="120" autocomplete="email" placeholder="you@example.com" />
          <p class="muted small">We use it only to answer you, and delete it after 180 days.</p>
        {/if}
        {#if formMsg}<p class="msg">{formMsg}</p>{/if}
        <div class="row end"><button class="btn btn-primary" disabled={busy || text.trim().length < 3 || (wantReply && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))}>{tab === 'suggest' ? 'Send my idea' : 'Send'}</button></div>
      </form>
    {/if}
  </div>
</div>

<style>
  .ideas { display: flex; flex-direction: column; background: var(--bg); }
  .body { flex: 1; min-height: 0; padding: 18px 24px 50px; display: flex; flex-direction: column; gap: 14px; width: min(900px, 100%); margin: 0 auto; }
  .tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .tabs button { display: inline-flex; align-items: center; gap: 8px; border: 0; cursor: pointer; padding: 6px 16px 6px 6px; border-radius: 999px; background: #fff; box-shadow: var(--shadow-sm); font: 600 17px var(--font-ui); color: var(--ink2); }
  .tabs button img { width: 36px; height: 36px; object-fit: contain; }
  .tabs button.on { background: var(--primary); color: #fff; }
  .lead { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .lead p { margin: 0; font: 600 16px/1.4 var(--font-body); color: var(--ink2); }
  .seg { display: inline-flex; gap: 4px; background: var(--bg2); padding: 4px; border-radius: 14px; }
  .seg button { border: 0; background: none; padding: 7px 12px; border-radius: 10px; font: 700 14px var(--font-body); color: var(--muted); cursor: pointer; }
  .seg button.on { background: #fff; color: var(--ink); box-shadow: var(--shadow-sm); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  .idea { display: flex; align-items: center; gap: 14px; padding: 12px 12px 12px 18px; }
  .idea.done { background: #f2fff8; }
  .itext { flex: 1; min-width: 0; }
  .itext p { margin: 4px 0 0; font: 600 17px/1.4 var(--font-body); color: var(--ink); overflow-wrap: anywhere; }
  .tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .tag { font: 800 12px var(--font-body); color: var(--muted); background: var(--bg2); padding: 2px 9px; border-radius: 999px; }
  .tag.planned { background: #fff1d6; color: #8a5300; }
  .tag.doneTag { background: #dff8ea; color: #1f7a50; }
  .heart { flex: none; width: 84px; height: 84px; border-radius: 24px; border: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; background: #fff3f6; box-shadow: inset 0 0 0 3px #ffd3df; transition: transform .12s; }
  .heart img { width: 48px; height: 48px; object-fit: contain; filter: grayscale(.85) opacity(.55); transition: filter .15s, transform .15s; }
  .heart b { font: 600 18px var(--font-ui); color: var(--muted); }
  .heart.on { background: #ffe3ec; box-shadow: inset 0 0 0 3px #ff8fb1; }
  .heart.on img { filter: none; transform: scale(1.1); }
  .heart.on b { color: #c0396f; }
  .heart:active { transform: scale(.94); }
  .pane { padding: 18px 20px; }
  .empty, .thanks { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; }
  .empty img, .thanks img { width: 72px; height: 72px; object-fit: contain; }
  .thanks h3 { margin: 0; font-size: 26px; }
  .thanks p, .empty p { margin: 0; color: var(--ink2); font: 600 16px/1.45 var(--font-body); max-width: 520px; }
  .gatecard { padding: 6px; }
  .form { display: flex; flex-direction: column; gap: 8px; }
  .form h3 { margin: 0; font-size: 24px; }
  .form label { font: 700 15px var(--font-body); color: var(--ink2); }
  .kinds { flex-wrap: wrap; align-self: flex-start; }
  textarea, .txt { width: 100%; padding: 12px; border-radius: 14px; border: 2px solid var(--line); font: 600 16px var(--font-body); resize: vertical; background: #fff; }
  .count { align-self: flex-end; font: 700 12px var(--font-body); color: var(--muted); margin-top: -4px; }
  .check { display: flex; align-items: center; gap: 8px; }
  .check input { width: 20px; height: 20px; accent-color: var(--primary); }
  .small { font-size: 13px; margin: 0; }
  .msg { color: #c0396f; font: 700 14px var(--font-body); margin: 0; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .row.end { justify-content: flex-end; }
  @media (max-width: 600px) {
    .body { padding: 12px 12px 40px; }
    .tabs button { font-size: 15px; padding: 4px 12px 4px 4px; } .tabs button img { width: 30px; height: 30px; }
    .heart { width: 70px; height: 70px; } .heart img { width: 40px; height: 40px; }
    .idea { padding: 10px 10px 10px 14px; gap: 10px; }
    .itext p { font-size: 15.5px; }
  }
</style>
