<script lang="ts">
  // The little surprises on the screen, on top of every game. None of them blocks anything or costs
  // anything; most are rare, and some only happen if you poke around:
  // - Home: your buddy is the real 3D buddy as soon as it can be (liveBuddy.ts: the picture shows first, so
  //   Home paints at once), idling and glancing about; tickle it (tap it) and it squirms and giggles, says
  //   something new each time, and sneezes at the sixth tap; type "hello" or your buddy's name; fireflies
  //   come out in the evening; on the day you first played, a year on, it's your Keypals birthday.
  // - The maps: type "keypals", the secret word, and the first time it gives you the Secret Word sticker
  //   (after that, a party); "hello" and your buddy's name work there too.
  // - A typing lesson: a golden letter now and then (typing it right is a little party).
  // - A math trip: 10 × 10 is a hundred, and 7 × 8 = 56 counts "5, 6, 7, 8!".
  // - The playground: a rainbow bubble now and then.
  // - Results: sometimes another buddy from your team photobombs the picture (and says who it is).
  // - Battles: once in a while the grumpy Glimmer sneezes before it starts.
  // - The Adventure map: a cloud shaped like a whale drifts across the sky now and then.
  // - Lessons and trips (worldEggs.ts): visitors from Adventure pop in with a poof, and a bubble here says
  //   who each one is and that it came to say hi.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { FRIEND, type FriendId } from '../art/cast';
  import { teamBuddies } from '../engine/team';
  import Confetti from '../ui/Confetti.svelte';
  import Critter from '../ui/Critter.svelte';
  import { chance, everything, recall, remember } from './luck';
  import { onFun, type FunKind } from './bus';
  import { LiveBuddy } from './liveBuddy';
  import { giveSecretSticker, SECRET_STICKER } from './secret';
  import { noteSecret } from '../adventure/ladderSave';
  import { advOf } from '../adventure/state';
  import { lookForEggs } from '../adventure/ladderMoment.svelte';
  import { STICKER } from '../engine/stickers';
  import StickerCard from '../ui/StickerCard.svelte';

  const base = import.meta.env.BASE_URL;
  // a speech bubble somewhere on the screen (x, y in px), a small toast, confetti
  let bubble = $state<{ text: string; x: number; y: number; key: number; big?: boolean } | null>(null);
  let toast = $state<{ text: string; key: number } | null>(null);
  let burst = $state(0), confX = $state(50), confY = $state(25), confN = $state(60);
  let bubbleT = 0, toastT = 0;
  function say(text: string, at: { x: number; y: number }, ms = 2200, big = false) {
    bubble = { text, x: at.x, y: at.y, key: Date.now(), big };
    clearTimeout(bubbleT); bubbleT = window.setTimeout(() => (bubble = null), ms);
  }
  function note(text: string, ms = 1900) {
    toast = { text, key: Date.now() };
    clearTimeout(toastT); toastT = window.setTimeout(() => (toast = null), ms);
  }
  function party(x = 50, y = 25, n = 60) { confX = x; confY = y; confN = n; burst++; }
  const buddyEl = () => document.querySelector('.hub .hello .bud') as HTMLElement | null;
  const above = (el: Element | null) => { const r = el?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + 6 } : { x: innerWidth / 2, y: innerHeight * 0.3 }; };

  // ---------- Home: tickle the buddy ----------
  // the sixth tickle makes your buddy sneeze; after that it keeps giggling. Home's buddy is the real 3D
  // buddy (liveBuddy.ts), so the whole body squirms and sneezes; until that's ready (or where it can't be
  // drawn) the picture wiggles.
  const TICKLES = ['Hee hee! That tickles!', 'Boop!', "I'm ticklish there!", "Okay, okay, I'm awake!", 'Hee hee... my nose itches...', 'ACHOO! Oh, excuse me!'];
  const MORE = ["I'm going to tickle YOU back!", 'Hee hee hee!'];
  let pokes = 0, pokeT = 0;
  let live: LiveBuddy | null = null, liveFor: FriendId | null = null, making = false;
  /** the 3D buddy over the picture (made as soon as Home is up, or on a first tickle) */
  async function liveBud(bud: HTMLElement, id: FriendId) {
    if (live && liveFor === id) return live;
    if (making) return null;
    making = true;
    endLive();
    const lb = await LiveBuddy.create(id, bud, { stay: true, quiet: !!game.profile?.settings.reducedMotion });
    making = false;
    if (!lb) return null;
    if (game.screen !== 'hub' || game.profile?.buddy !== id || game.modalOpen) { lb.dispose(); return null; }
    lb.onEnd = () => { if (live === lb) { live = null; liveFor = null; } };
    live = lb; liveFor = id;
    return lb;
  }
  function endLive() { live?.dispose(); live = null; liveFor = null; }
  $effect(() => { if (game.screen !== 'hub' || game.modalOpen) endLive(); });
  // Home: the real buddy comes in by itself, a moment after the page (and its picture) is up, and again
  // after something that was open over Home closes
  $effect(() => {
    const id = game.profile?.buddy;
    if (game.screen !== 'hub' || game.modalOpen || !id) return;
    let tries = 0, t = 0;
    const go = () => { const bud = buddyEl(); if (bud && bud.getBoundingClientRect().width > 4) void liveBud(bud, id); else if (++tries < 20) t = window.setTimeout(go, 250); };
    t = window.setTimeout(go, 300);
    return () => clearTimeout(t);
  });
  function onClick(e: MouseEvent) {
    const bud = (e.target as Element | null)?.closest?.('.hub .hello .bud') as HTMLElement | null;
    const p = game.profile;
    if (!bud || game.screen !== 'hub' || !p) return;
    clearTimeout(pokeT); pokeT = window.setTimeout(() => (pokes = 0), 6000);
    const line = pokes < TICKLES.length ? TICKLES[pokes] : MORE[(pokes - TICKLES.length) % MORE.length];
    pokes++;
    const sneezing = line.startsWith('ACHOO');
    bud.classList.remove('fun-wiggle', 'fun-sneeze'); void bud.offsetWidth;
    const at = performance.now();
    const lb = live && liveFor === p.buddy ? live : null;
    if (lb) { if (sneezing) lb.sneeze(); else lb.tickle(); }
    else {
      // the first tickle: the picture wiggles while the 3D buddy gets ready, then it carries on in 3D
      void liveBud(bud, p.buddy).then(b => { if (b && performance.now() - at < 700) { if (sneezing) b.sneeze(); else b.tickle(); } });
    }
    if (sneezing) {
      sfx.sneeze();
      setTimeout(() => { if (!lb) bud.classList.add('fun-sneeze'); say(line, above(bud), 2400, true); party(above(bud).x / innerWidth * 100, above(bud).y / innerHeight * 100 + 6, 14); }, 900);
      say('Ah... ah...', above(bud), 900);
      return;
    }
    if (!lb) bud.classList.add('fun-wiggle');
    sfx.giggle();
    say(line, above(bud));
  }

  // ---------- secret words ----------
  let typed = '';
  /** the Secret Word sticker card, just won (a time, so a new win shows it fresh) */
  let secret = $state(0), secretT = 0;
  function seeSticker() { secret = 0; game.openStickers('stickers'); }
  const HOME_KEYS = new Set(['t', 'm', 'a', '1', '2', '3']); // Home's own shortcuts: words there avoid them
  function onKey(e: KeyboardEvent) {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || game.modalOpen) return;
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return;
    const scr = game.screen;
    if (scr !== 'hub' && scr !== 'map') return; // Home, and the typing and math maps
    typed = (typed + e.key.toLowerCase()).slice(-12);
    const p = game.profile; if (!p) return;
    const name = FRIEND[p.buddy]?.name.toLowerCase() ?? '';
    const usable = (w: string) => scr !== 'hub' || ![...w].some(c => HOME_KEYS.has(c));
    const where = scr === 'hub' ? above(buddyEl()) : { x: innerWidth / 2, y: innerHeight * 0.35 };
    if (scr !== 'hub' && typed.endsWith('keypals')) {
      typed = ''; sfx.secret(); party(50, 18, 120); setTimeout(() => party(25, 30, 60), 350); setTimeout(() => party(75, 30, 60), 650);
      // the first time it's a real prize: the Secret Word sticker, and a card saying so; after that, the party
      let first = false;
      game.update(pp => { first = giveSecretSticker(pp); noteSecret(pp, advOf(pp), 'word'); });
      setTimeout(() => lookForEggs(), first ? 9500 : 3200); // a ladder secret: its egg comes after the card
      if (first) { clearTimeout(secretT); secret = Date.now(); secretT = window.setTimeout(() => (secret = 0), 9000); }
      else say('The secret word again! Party time!', where, 3000, true);
      return;
    }
    const bud = FRIEND[p.buddy]?.name ?? 'Your buddy';
    if (typed.endsWith('hello') && usable('hello')) { typed = ''; sfx.giggle(); say(`You said hello, so ${bud} says hello back! Hi, ${p.name}!`, where, 3200); return; }
    if (name.length >= 3 && usable(name) && typed.endsWith(name)) { typed = ''; sfx.secret(); say(`You typed my name! That's me, ${bud}!`, where, 3200); party(where.x / innerWidth * 100, where.y / innerHeight * 100, 24); }
  }

  // ---------- Home: fireflies in the evening, and the Keypals birthday ----------
  const hour = new Date().getHours();
  const evening = hour >= 19 || hour < 6 || everything();
  const flies = Array.from({ length: 9 }, (_, i) => ({ x: 6 + ((i * 37) % 88), y: 30 + ((i * 53) % 60), d: 7 + (i % 4) * 2.5, delay: -(i * 1.7) }));
  let birthdayDone = false;
  function checkBirthday() {
    const p = game.profile; if (!p || birthdayDone || game.screen !== 'hub') return;
    birthdayDone = true;
    const days = Object.keys(p.days ?? {}).sort();
    if (!days.length) return;
    const [fy, fm, fd] = days[0].split('-').map(Number), now = new Date();
    const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
    if (now.getFullYear() > fy && now.getMonth() + 1 === fm && now.getDate() === fd && recall('birthday', '') !== today) {
      remember('birthday', today);
      const yrs = now.getFullYear() - fy;
      setTimeout(() => { sfx.secret(); party(50, 20, 140); say(`Happy Keypals birthday! ${yrs === 1 ? 'A whole year' : `${yrs} whole years`} of playing together!`, above(buddyEl()), 4500, true); }, 1200);
    }
  }
  $effect(() => { if (game.screen === 'hub') setTimeout(checkBirthday, 300); });

  // ---------- results: a photobomb ----------
  let peek = $state<{ id: FriendId; key: number } | null>(null);
  function photobomb() {
    const p = game.profile; if (!p) return;
    const others = teamBuddies(p).filter(b => b !== p.buddy);
    if (!others.length) return;
    const id = others[Math.floor(Math.random() * others.length)];
    setTimeout(() => {
      if (game.screen !== 'results' && game.screen !== 'mathResults') return;
      peek = { id, key: Date.now() }; sfx.giggle();
      setTimeout(() => (peek = null), 3200);
    }, 3800);
  }

  // ---------- battles: the grumpy Glimmer sneezes ----------
  let achoo = $state(0);
  function sneeze() { setTimeout(() => { if (game.screen !== 'battle') return; sfx.sneeze(); setTimeout(() => (achoo = Date.now()), 900); setTimeout(() => (achoo = 0), 3000); }, 2600); }

  // ---------- the Adventure map: a cloud whale ----------
  let whale = $state<{ key: number; top: number; dur: number } | null>(null), whaleT = 0;
  function nextWhale(first = false) {
    clearTimeout(whaleT);
    whaleT = window.setTimeout(() => {
      if (game.screen === 'adventure') { const dur = 26 + Math.random() * 8; whale = { key: Date.now(), top: 9 + Math.random() * 10, dur }; setTimeout(() => (whale = null), dur * 1000); }
      nextWhale();
    }, first ? 9000 : 50000 + Math.random() * 40000);
  }

  // ---------- moments the games tell us about ----------
  function on(kind: FunKind, data?: unknown) {
    if (kind === 'golden') { sfx.golden(); party(50, 32, 80); note('A golden letter!'); }
    else if (kind === 'bubblePop') { sfx.giggle(); party(50, 45, 50); note('A rainbow bubble!'); }
    else if (kind === 'mathRight') {
      const v = (data as { value: number; a?: number; b?: number } | undefined);
      if (!v) return;
      if (v.value === 100) { sfx.secret(); party(50, 30, 90); note('One hundred!'); }
      else if (v.value === 56 && ((v.a === 7 && v.b === 8) || (v.a === 8 && v.b === 7))) note('5, 6, 7, 8!', 2200);
    }
    else if (kind === 'results') { if (chance(1 / 6)) photobomb(); }
    else if (kind === 'battleStart') { if (chance(1 / 8)) sneeze(); }
    else if (kind === 'visitor') {
      // over the visitor, but kept in the middle of the picture: never over the letters or the question at
      // the top, or the keyboard and buttons at the bottom
      const v = data as { text: string; x: number; y: number } | undefined;
      if (v && !game.modalOpen) say(v.text, { x: v.x, y: Math.min(innerHeight * 0.62, Math.max(innerHeight * 0.4, v.y)) }, 4200);
    }
  }
  let off: (() => void) | null = null;
  onMount(() => {
    off = onFun(on);
    addEventListener('click', onClick, true);
    addEventListener('keydown', onKey);
    nextWhale(true);
  });
  onDestroy(() => { off?.(); removeEventListener('click', onClick, true); removeEventListener('keydown', onKey); clearTimeout(whaleT); clearTimeout(secretT); endLive(); });
</script>

{#if game.screen === 'hub' && evening}
  <div class="flies" aria-hidden="true">{#each flies as f, i (i)}<i style:left="{f.x}%" style:top="{f.y}%" style:--d="{f.d}s" style:animation-delay="{f.delay}s"></i>{/each}</div>
{/if}

{#if whale && game.screen === 'adventure'}
  {#key whale.key}
    <!-- it drifts past and never gets in the way of a tap -->
    <div class="cwhale" style:top="{whale.top}%" style:--dur="{whale.dur}s" aria-hidden="true"><img src="{base}fun/cloudwhale.webp" alt="" draggable="false" /></div>
  {/key}
{/if}

{#if peek}
  {#key peek.key}
    <div class="peek" aria-hidden="true"><Critter friend={peek.id} size={150} mood="dance" /><span class="pb">Psst! It's me, {FRIEND[peek.id].name}, from your team. Great job!</span></div>
  {/key}
{/if}

{#if achoo}
  <div class="achoo" aria-hidden="true"><b>ACHOO!</b><small>Bless you!</small></div>
{/if}

{#if secret && game.profile}
  {#key secret}
    <!-- the secret word's prize: the sticker itself, and where it went -->
    <div class="fsecret card" role="status">
      <div class="fsart"><StickerCard def={STICKER[SECRET_STICKER]} friend={game.profile.buddy} look={game.profile.settings.look} size={104} /></div>
      <div class="fstext"><b>Secret word!</b><span>You got the Secret Word sticker. It's in your sticker book.</span><button class="btn btn-primary" onclick={seeSticker}>See my sticker</button></div>
    </div>
  {/key}
{/if}

{#if bubble}
  {#key bubble.key}
    {@const half = Math.min(220, innerWidth / 2 - 8)}
    <div class="fbub" class:big={bubble.big} style:left="{Math.min(innerWidth - half, Math.max(half, bubble.x))}px" style:top="{Math.max(90, bubble.y)}px">{bubble.text}</div>
  {/key}
{/if}
{#if toast}{#key toast.key}<div class="ftoast">{toast.text}</div>{/key}{/if}
<div class="conf"><Confetti {burst} count={confN} x={confX} y={confY} spread={1.4} /></div>

<style>
  .conf { position: fixed; inset: 0; pointer-events: none; z-index: 95; }
  .fbub { position: fixed; z-index: 96; transform: translate(-50%, -100%); background: #fff; color: var(--ink); font: 600 18px/1.25 var(--font-ui); padding: 9px 16px; border-radius: 18px; box-shadow: 0 10px 24px -10px rgba(40, 20, 80, .55), 0 0 0 3px #ffe08a; pointer-events: none; width: max-content; max-width: min(440px, calc(100vw - 16px)); text-align: center; animation: fpop .35s cubic-bezier(.3, .8, .4, 1.5) both; }
  /* the Secret Word sticker, just won: the sticker, what it is and where it went, and a way to go and see it */
  .fsecret { position: fixed; left: 50%; top: 18%; z-index: 97; transform: translateX(-50%); width: min(500px, calc(100vw - 20px)); display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; padding: 14px 18px; box-shadow: 0 0 0 4px #ffd36b, 0 18px 40px -14px rgba(60, 30, 110, .6); animation: fpop3 .5s cubic-bezier(.3, .8, .4, 1.4) both; }
  .fstext { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
  .fstext b { font: 600 26px var(--font-ui); color: var(--ink); }
  .fstext span { font: 600 17px/1.35 var(--font-body); color: var(--ink2); }
  .fsart { animation: fspin 1s cubic-bezier(.2, 1.2, .4, 1) both; }
  @keyframes fpop3 { from { opacity: 0; transform: translate(-50%, -18px) scale(.85); } }
  @keyframes fspin { from { transform: rotate(-200deg) scale(.3); opacity: 0; } }
  @media (max-width: 520px) { .fsecret { grid-template-columns: 1fr; justify-items: center; text-align: center; } .fstext { align-items: center; } }
  .fbub::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -9px; border: 9px solid transparent; border-top-color: #fff; border-bottom: 0; }
  .fbub.big { font-size: 22px; padding: 11px 20px; }
  @keyframes fpop { from { opacity: 0; transform: translate(-50%, -80%) scale(.7); } }
  /* in the middle of the picture: never over the letters, the question or the buttons */
  .ftoast { position: fixed; left: 50%; top: 44%; z-index: 96; transform: translateX(-50%); background: linear-gradient(90deg, #fff6c9, #ffffff, #fff6c9); color: #6a4300; font: 600 22px var(--font-ui); padding: 10px 22px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd36b, 0 12px 30px -12px rgba(120, 80, 0, .6); pointer-events: none; white-space: nowrap; animation: fpop2 .4s cubic-bezier(.3, .8, .4, 1.5) both; }
  @keyframes fpop2 { from { opacity: 0; transform: translate(-50%, -14px) scale(.8); } }

  .flies { position: fixed; inset: 0; pointer-events: none; z-index: 2; overflow: hidden; }
  .flies i { position: absolute; width: 7px; height: 7px; border-radius: 50%; background: #fff7a8; box-shadow: 0 0 10px 4px rgba(255, 236, 120, .75); animation: fly var(--d) ease-in-out infinite alternate, blink 2.3s ease-in-out infinite; opacity: .85; }
  @keyframes fly { 0% { transform: translate(0, 0); } 33% { transform: translate(40px, -30px); } 66% { transform: translate(-25px, -60px); } 100% { transform: translate(30px, -15px); } }
  @keyframes blink { 50% { opacity: .2; } }

  .cwhale { position: fixed; left: 0; z-index: 3; width: clamp(150px, 18vw, 260px); pointer-events: none; animation: drift var(--dur) linear forwards; opacity: .93; filter: drop-shadow(0 8px 10px rgba(60, 90, 140, .18)); }
  .cwhale img { width: 100%; display: block; animation: bobw 4s ease-in-out infinite; }
  @keyframes drift { from { transform: translateX(105vw); } to { transform: translateX(-30vw); } }
  @keyframes bobw { 50% { transform: translateY(-8px) rotate(-1.5deg); } }

  /* peeking in from the left edge, beside the picture of your buddy (clear of the buttons) */
  .peek { position: fixed; left: -14px; top: 16%; z-index: 90; pointer-events: none; animation: peek 3.2s cubic-bezier(.3, .8, .4, 1) forwards; transform-origin: bottom left; }
  .pb { position: absolute; left: 118px; top: 8px; background: #fff; font: 600 17px var(--font-ui); color: var(--ink); padding: 6px 12px; border-radius: 14px; box-shadow: 0 8px 20px -8px rgba(40, 20, 80, .5); white-space: nowrap; }
  @keyframes peek { 0% { transform: translate(-110%, 10%) rotate(14deg); } 18%, 78% { transform: translate(0, 0) rotate(9deg); } 100% { transform: translate(-110%, 10%) rotate(14deg); } }

  .achoo { position: fixed; left: 50%; top: 22%; z-index: 90; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; animation: achoo 2.1s cubic-bezier(.2, 1.4, .4, 1) both; }
  .achoo b { font: 600 clamp(44px, 7vw, 72px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 3px #5aa9f0; paint-order: stroke; text-shadow: 0 5px 0 #2f78c4; transform: rotate(-6deg); }
  .achoo small { margin-top: 8px; font: 600 18px var(--font-ui); color: var(--ink); background: #fff; padding: 3px 12px; border-radius: 999px; }
  @keyframes achoo { 0% { opacity: 0; transform: translateX(-50%) scale(.3); } 15% { opacity: 1; transform: translateX(-50%) scale(1.15); } 25% { transform: translateX(-50%) scale(1); } 85% { opacity: 1; } 100% { opacity: 0; } }

  /* the picture hides while the 3D buddy stands in its place */
  :global(.fun-live img) { opacity: 0; }
  :global(.fun-wiggle) { animation: funwiggle .5s ease; }
  :global(.fun-sneeze) { animation: funsneeze .6s ease; }
  @keyframes -global-funwiggle { 25% { transform: rotate(-8deg) scale(1.06); } 50% { transform: rotate(7deg); } 75% { transform: rotate(-4deg); } }
  @keyframes -global-funsneeze { 0% { transform: scale(1); } 20% { transform: scale(.88) translateY(4px); } 45% { transform: scale(1.12) translateY(-10px) rotate(-6deg); } 100% { transform: none; } }
</style>
