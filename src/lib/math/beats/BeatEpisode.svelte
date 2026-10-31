<script lang="ts">
  // The player for a beat lesson (math/beats/types.ts): a little silent film in a real 3D place that stops for
  // the child. The lesson's script says what happens; this is the part every lesson shares: the place, the
  // coach's few words, the thoughts over the friends' heads, the number pad and choices, the hands' job with
  // its hint, the stars, and the card at the end. It saves like every episode (learn.ts finishLesson,
  // markChecked) and keeps what the lesson wants to remember about this child for the next day.
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Vector3 } from 'three';
  import { stage, type Controller } from '../../three/stage';
  import { EpisodeScene, type View } from '../../three/episodeScene';
  import { game } from '../../state/game.svelte';
  import { quietForLesson, sfx } from '../../audio/sound';
  import { hush, lineText, say } from '../../audio/voice.svelte';
  import { danceOf } from '../../engine/profile';
  import { advView } from '../../adventure/state';
  import { finishLesson, markChecked, type Board } from '../learn';
  import { mathOf } from '../progress';
  import { SETS } from '../episodes';
  import NumPad from '../ui/NumPad.svelte';
  import SpeechDock from '../ui/SpeechDock.svelte';
  import PauseButton from '../../ui/PauseButton.svelte';
  import { placeName } from '../../nav';
  import Confetti from '../../ui/Confetti.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RewardTap from '../../ui/RewardTap.svelte';
  import PathNextButton from '../../path/PathNextButton.svelte';
  import { pathNext, startPathNext, type PathNext } from '../../path/next';
  import type { BeatLesson, Choice, Notes, Pin, Teller, World } from './types';

  type Props = { lesson: BeatLesson<World>; embedded?: boolean; check?: boolean; onclose: () => void; onpractice?: () => void };
  let { lesson, embedded = false, check = false, onclose, onpractice }: Props = $props();

  const base = import.meta.env.BASE_URL;
  // (keyed by its lesson: this doesn't change while it's open)
  // svelte-ignore state_referenced_locally
  const L = lesson, place = SETS[L.set], buddy = game.profile!.buddy;
  const CLEAR: Board = { cell: 48, dots: [], frames: [], plates: [], line: null, tags: [] };
  const DOCK_H = { wide: 92, narrow: 74 };
  const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  let sc = $state<EpisodeScene | null>(null);
  let world = $state<World | null>(null);
  let ctl: Controller | null = null, before: Controller | null = null;
  let gone = false;

  type Ask = { kind: 'num'; prompt: string } | { kind: 'pick'; prompt: string; choices: Choice[] } | { kind: 'hands'; words: string } | { kind: 'go'; label: string };
  let phase = $state<'load' | 'play' | 'card' | 'checked'>('load');
  let ask = $state<Ask | null>(null);
  let line = $state('');
  let typed = $state('');
  let at = $state(-1);
  let stuck = $state(false);
  let pins = $state<Pin[]>([]);
  let thoughts = $state<{ buddy: string | null; pal: string | null }>({ buddy: null, pal: null });
  let bet = $state<string | null>(null);
  let burst = $state(0);
  let result = $state<{ first: boolean; shells: number; eggs: number } | null>(null);
  let cardWords = $state<string[]>([]);
  let pn = $state<PathNext | null>(null);
  let w = $state(1280), h = $state(800);
  let bottomH = $state(0);
  const narrow = $derived(w < 760);
  /** what answers the open question */
  let answer: ((v: string) => void) | null = null;
  /** hands: "Show me" for the job in hand */
  let showMe: (() => void) | null = null;

  /** Stopped: the page closed while a script was still going. */
  class Left extends Error {}
  const live = async <T,>(p: Promise<T>): Promise<T> => { const v = await p; if (gone) throw new Left(); return v; };

  const teller: Teller = {
    async say(id) {
      line = lineText(id);
      const t0 = performance.now();
      await live(Promise.race([say(id, { important: true, caption: false }), sleep(2500 + line.length * 95)]));
      if (game.settings.voice === false) await live(sleep(Math.max(0, Math.max(1500, line.length * 55) - (performance.now() - t0))));
    },
    num(prompt, id) {
      typed = ''; ask = { kind: 'num', prompt };
      if (id) void this.say(id).catch(() => {}); else line = '';
      return live(new Promise<string>(r => { answer = r; })).then(v => { ask = null; line = ''; typed = ''; return Number(v); });
    },
    pick(prompt, choices, id) {
      ask = { kind: 'pick', prompt, choices };
      if (id) void this.say(id).catch(() => {}); else line = '';
      return live(new Promise<string>(r => { answer = r; })).then(v => { ask = null; line = ''; return v as never; });
    },
    async hands(words, job, me) {
      ask = { kind: 'hands', words }; stuck = false; showMe = me; line = '';
      const late = setTimeout(() => { stuck = true; }, 12000);
      await live(job());
      clearTimeout(late);
      ask = null; stuck = false; showMe = null;
    },
    go(label) {
      ask = { kind: 'go', label };
      return live(new Promise<string>(r => { answer = r; })).then(() => { ask = null; line = ''; });
    },
    wait: ms => live(sleep(ms)),
    buddy(m) { const s = sc; if (!s) return; ({ wave: () => s.wave(), cheer: () => s.cheer(), jump: () => s.jump(), gasp: () => s.gasp(), oops: () => s.oops(), shrug: () => s.shrug(), nod: () => s.nod(), clap: () => s.clap(), think: () => s.think(3), point: () => s.point(undefined, 1.6), present: () => s.present(1.8), talk: () => s.talk(1.5) })[m](); },
    pal(m) { sc?.palDo(m); },
    thought(who, text) { thoughts = { ...thoughts, [who]: text }; },
    myBet(text) { bet = text; },
    beat(n) { at = n; },
  };

  function typeDigit(d: string) { if (ask?.kind !== 'num' || typed.length >= 4) return; typed += d; sfx.click(); }
  function back() { if (ask?.kind === 'num') typed = typed.slice(0, -1); }
  function send() { if (ask?.kind === 'num' && typed) { sfx.pop(); answer?.(typed); } }
  function tap(id: string) { sfx.pop(); answer?.(id); }
  function primary() {
    if (ask?.kind === 'num') send();
    else if (ask?.kind === 'go') tap('go');
    else if (phase === 'card' && pn && game.profile) { sfx.click(); startPathNext(game.profile, pn); }
    else if (phase === 'card' || phase === 'checked') leave();
  }
  function onKey(e: KeyboardEvent) {
    if (game.sheet || game.settingsOpen) return;
    const mine = (fn: () => void) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (ask?.kind === 'num') {
      if (/^[0-9]$/.test(e.key)) return mine(() => typeDigit(e.key));
      if (e.key === 'Backspace') return mine(back);
    }
    if (e.key === 'Enter' || e.key === ' ') return mine(primary);
    if (e.key === 'Escape') return mine(pauseHere);
  }
  const backLabel = embedded ? 'my trip' : game.screen === 'learn' ? (game.from ? placeName(game.from) : 'Home') : placeName(game.here());
  function pauseHere() { if (!game.pause) game.openPause(() => {}, { name: backLabel, go: leave }); }
  function leave() { sfx.click(); onclose(); }
  function home() { sfx.click(); game.learnId = null; game.learnOverlay = null; game.go('hub'); }

  async function run(s: EpisodeScene, wd: World) {
    try {
      if (check) {
        await L.check(teller, wd, mathOf(game.profile!).lessonNotes?.[L.id] ?? null);
        phase = 'checked'; ask = null; bet = null;
        game.update(pp => markChecked(pp, L.id));
        s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party();
        sfx.complete(); burst++;
        cardWords = L.card(mathOf(game.profile!).lessonNotes?.[L.id] ?? {});
      } else {
        const notes: Notes = await L.play(teller, wd);
        phase = 'card'; ask = null; bet = null; line = '';
        let res = { first: false, shells: 0, eggs: 0 };
        game.update(pp => {
          const x = finishLesson(pp, L.id);
          res = { first: x.first, shells: x.shells, eggs: x.eggsReady.length };
          const m = (pp.math = mathOf(pp));
          m.lessonNotes = { ...(m.lessonNotes ?? {}), [L.id]: { ...notes, ...(m.lessonNotes?.[L.id] ?? {}) } };
        });
        result = res;
        cardWords = L.card(mathOf(game.profile!).lessonNotes?.[L.id] ?? notes);
        if (!embedded) pn = pathNext(game.profile, `learn:${L.id}`);
        s.gather(true); s.shot('pals'); s.dance(danceOf(game.profile!)); s.party(); s.palDo('happy');
        sfx.complete(); burst++;
      }
    } catch (e) { if (!(e instanceof Left)) console.error(e); }
  }

  // ---------- the child's hands go to the world ----------
  function down(e: PointerEvent) { if (!world?.pointer('down', e.clientX, e.clientY)) return; e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
  function move(e: PointerEvent) { if (world?.pointer('move', e.clientX, e.clientY)) e.preventDefault(); }
  function up(e: PointerEvent) { world?.pointer('up', e.clientX, e.clientY); }
  function pin(node: HTMLElement, at: () => Vector3 | null) {
    sc?.pin(node, at);
    return { update(n: () => Vector3 | null) { sc?.pin(node, n); }, destroy() { sc?.unpin(node); } };
  }

  // ---------- where the 3D picture goes ----------
  function viewFor(): View {
    const H = h || 1;
    const top = (narrow ? 58 + DOCK_H.narrow : 72 + DOCK_H.wide) / H;
    let bottom = 1 - (narrow ? 116 : 104) / H, right = 0.99;
    if (ask?.kind === 'num') bottom = 1 - (narrow ? 352 : 228) / H;
    else if (ask?.kind === 'pick') bottom = 1 - (narrow ? 196 : 170) / H;
    else if (phase === 'card' || phase === 'checked') { if (narrow) bottom = 0.5; else right = 0.5; }
    if (narrow && bottomH && phase === 'play') bottom = Math.min(bottom, 1 - (bottomH + 14) / H);
    return { top, bottom, left: 0.01, right };
  }
  $effect(() => { void phase; void ask; void w; void h; void bottomH; sc?.setView(viewFor()); });

  let unquiet = () => {};
  onMount(() => {
    unquiet = quietForLesson();
    addEventListener('keydown', onKey, true);
    const own = advView(game.profile!).glimmers[L.star];
    void EpisodeScene.create({ setId: L.set, buddy, star: L.star, evolved: !!own?.evolved }).then(async s => {
      if (gone) { s.dispose(); return; }
      const wd = await L.world(s);
      await wd.load();
      if (gone) { s.dispose(); return; }
      ctl = { fps: 60, update: (dt, t) => { s.update(dt, t); wd.update(dt, t); }, focus: () => s.focus(), dispose: () => {} };
      before = stage.swap(ctl); s.enter();
      if (import.meta.env.DEV) (window as unknown as { __beat: object }).__beat = { sc: s, world: wd, ask: () => ask, phase: () => phase, typed: (v: string) => { typed = v; send(); }, tap, primary, line: () => line, thoughts: () => thoughts, showMe: () => showMe?.() };
      s.show(CLEAR, true); s.fit(wd.bounds()); wd.refit();
      wd.onChange = () => { pins = wd.pins; };
      s.setView(viewFor());
      sc = s; world = wd;
      s.shot('wide');
      await tick();
      phase = 'play';
      await run(s, wd);
    }).catch(e => console.error(e));
  });
  onDestroy(() => {
    gone = true;
    hush(); unquiet();
    removeEventListener('keydown', onKey, true);
    if (sc) { const s = sc; sc = null; world?.dispose(); world = null; if (stage.current() === ctl) stage.swap(before); s.dispose(); }
  });
  const pinOf = (id: string) => () => world?.pins.find(p => p.id === id)?.at() ?? null;
  const showing = $derived(pins.filter(p => phase === 'play' || p.kind === 'sum'));
</script>

<svelte:window bind:innerWidth={w} bind:innerHeight={h} />
<div class="ep" class:narrow style:--sc={L.color} style:--bg="url({base}{place.backdrop})">
  <div class="hit" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} role="presentation"></div>
  <div class="vignette"></div>

  {#if phase === 'load'}
    <div class="loading"><div class="lcard"><small>{place.name}</small><b>{L.title}</b><span class="dots3"><i></i><i></i><i></i></span></div></div>
  {/if}

  <!-- the numbers and words that live on things in the room -->
  {#if sc && world && phase === 'play'}
    {#each showing as p (p.id)}
      <div class="pin" use:pin={pinOf(p.id)}>
        {#if p.kind === 'edge'}<span class="edge t-{p.c}">{p.text}</span>
        {:else if p.kind === 'tick'}<span class="tick t-{p.c}">{p.text}</span>
        {:else if p.kind === 'count'}<span class="count">{p.text}</span>
        {:else if p.kind === 'sum'}<div class="sum"><div class="row1">{#each p.parts ?? [] as q, i}<b class="t-{q.c ?? 'ink'}" style:animation-delay="{i * 0.12}s">{q.t}</b>{/each}</div>{#if p.under}<div class="row2">{#each p.under as u, i}{#if i}<i>{i === p.under.length - 1 ? '=' : '×'}</i>{/if}<span class="u{i}">{u}</span>{/each}</div>{/if}</div>
        {:else}<span class="word">{p.text}</span>{/if}
      </div>
    {/each}
    {#if ask?.kind === 'hands' && world.tryPoint()}
      <div class="pin" use:pin={() => world?.handPoint() ?? null}><span class="hand"><i></i></span></div>
    {/if}
    {#if thoughts.buddy}<div class="pin" use:pin={() => sc?.head('buddy') ?? null}><span class="thought">{thoughts.buddy}</span></div>{/if}
    {#if thoughts.pal}<div class="pin" use:pin={() => sc?.head('pal') ?? null}><span class="thought pal">{thoughts.pal}</span></div>{/if}
  {/if}

  <div class="top">
    <PauseButton esc={false} back={{ name: backLabel, go: leave }} />
    {#if check}
      <div class="prog checkhead"><Icon name="bulb" size={22} /> Quick check: {L.title}</div>
    {:else}
      <div class="prog" aria-label="Part {Math.max(1, at + 1)} of {L.beats}">
        {#each Array(L.beats) as _, n}<img src="{base}game/icon-star.webp" alt="" class:on={n < at} class:now={n === at} />{/each}
      </div>
    {/if}
    <div class="chip"><img src="{base}learn/tile.webp" alt="" /><span><small>{place.name}</small><b>{L.title}</b></span></div>
  </div>
  {#if phase !== 'load' && line}<SpeechDock text={line} {narrow} />{/if}
  {#if bet && phase === 'play'}<div class="mybet"><small>You</small><b>{bet}</b></div>{/if}

  <div class="bottom" bind:clientHeight={bottomH}>
    {#if ask?.kind === 'num'}
      <div class="turn">
        <div class="ask"><svg class="ico" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3 28 9.5v13L16 29 4 22.5v-13z" fill="#8f7bff"/><path d="M16 3 28 9.5 16 16 4 9.5z" fill="#c9bcff"/><path d="M16 16v13L4 22.5v-13z" fill="#6d5ae0"/></svg><span class="q">{ask.prompt}</span><span class="box">{typed || ' '}</span><button class="btn btn-primary gobtn" disabled={!typed} onclick={send}>Go <span class="kbd">enter</span></button></div>
        <NumPad ondigit={typeDigit} onback={back} compact={narrow} lit={null} />
      </div>
    {:else if ask?.kind === 'pick'}
      <div class="fix">
        <span class="pill task">{ask.prompt}</span>
        <div class="choices">{#each ask.choices as c}<button class="choice" onclick={() => tap(c.id)}>{c.text}</button>{/each}</div>
      </div>
    {:else if ask?.kind === 'hands'}
      <div class="row"><span class="pill task">{ask.words}</span>{#if stuck}<button class="btn ghostbtn" onclick={() => { sfx.click(); stuck = false; showMe?.(); }}>Show me</button>{/if}</div>
    {:else if ask?.kind === 'go'}
      <div class="row"><button class="btn btn-primary btn-big go" onclick={() => tap('go')}>{ask.label} <span class="kbd">enter</span></button></div>
    {/if}
  </div>

  {#if phase === 'card' || phase === 'checked'}
    <div class="cardside">
      <div class="card" style:--frame="url({base}learn/ep/card-frame.webp)">
        <div class="cin">
          <small>{phase === 'checked' ? 'Remembered!' : 'Trick card'}</small>
          <h2>{L.title}</h2>
          <div class="cpic"><img class="cart" src="{base}{L.art}" alt="" /></div>
          {#each cardWords as c}<p>{c}</p>{/each}
        </div>
      </div>
      {#if phase === 'card'}
        <div class="prizes">
          {#if result?.shells}{@const n = result.shells}<RewardTap kind="shells" {n}>{#snippet children(tap)}<button class="prize tap" onclick={tap} title="Your shells"><img src="{base}game/icon-shell.webp" alt="" /><b>+{n}</b><small>shells</small></button>{/snippet}</RewardTap>{/if}
          <span class="prize"><Icon name="bulb" size={34} /><b>Trick</b><small>for battles</small></span>
          {#if result?.eggs}<RewardTap kind="egg">{#snippet children(tap)}<button class="prize tap" onclick={tap} title="Hatch it!"><img class="wob" src="{base}game/egg-common.webp" alt="" /><b>Ready!</b><small>hatch it</small></button>{/snippet}</RewardTap>
          {:else}<span class="prize"><img src="{base}game/egg-common.webp" alt="" /><b>Grew</b><small>eggs</small></span>{/if}
          {#if result?.first}<span class="prize"><Icon name="clock" size={34} /><b>Tomorrow</b><small>quick check</small></span>{/if}
        </div>
      {/if}
      <div class="cbtns">
        {#if embedded}
          <button class="btn btn-primary btn-big" onclick={leave}>Back to my trip <span class="kbd">enter</span></button>
        {:else if pn && phase === 'card'}
          <PathNextButton next={pn} hotkey={narrow ? undefined : 'enter'} compact={narrow} />
          {#if !pn.trail}
            <button class="btn btn-big" onclick={leave}>Back to {backLabel}</button>
            {#if backLabel !== 'Home'}<button class="btn btn-big" onclick={home}>Home</button>{/if}
          {/if}
        {:else}
          {#if onpractice && phase === 'card'}<button class="btn btn-big" onclick={() => { sfx.click(); onpractice?.(); }}>Practise it now</button>{/if}
          <button class="btn btn-primary btn-big" onclick={leave}>More tricks <span class="kbd">enter</span></button>
        {/if}
      </div>
    </div>
  {/if}
  <Confetti {burst} x={narrow ? 50 : 30} y={40} />
</div>

<style>
  .ep { position: fixed; inset: 0; z-index: 35; overflow: hidden; user-select: none; -webkit-user-select: none; }
  .hit { position: absolute; inset: 0; touch-action: none; }
  .vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse 85% 75% at 50% 45%, rgba(0, 0, 0, 0) 60%, rgba(60, 30, 10, .28) 100%); }
  .loading { position: absolute; inset: 0; display: grid; place-items: center; background: var(--bg) center / cover; }
  .loading::before { content: ''; position: absolute; inset: 0; backdrop-filter: blur(6px); background: rgba(255, 240, 220, .2); }
  .lcard { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; background: rgba(255, 255, 255, .94); border-radius: 26px; padding: 18px 30px; box-shadow: var(--shadow); }
  .lcard small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: var(--sc); }
  .lcard b { font: 600 28px var(--font-ui); color: var(--ink); }
  .dots3 { display: flex; gap: 6px; margin-top: 6px; }
  .dots3 i { width: 9px; height: 9px; border-radius: 50%; background: #ffc93a; animation: bob 1s ease-in-out infinite; }
  .dots3 i:nth-child(2) { animation-delay: .15s; } .dots3 i:nth-child(3) { animation-delay: .3s; }
  @keyframes bob { 50% { transform: translateY(-6px); } }

  /* words on things: the scene moves .pin to a 3D point */
  .pin { position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; z-index: 2; }
  .pin > * { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); white-space: nowrap; }
  .t-a { color: #1f6fd1; } .t-b { color: #d63c7c; } .t-c { color: #c47c00; } .t-ink { color: #2a1f45; }
  .edge { font: 700 clamp(28px, 4.2vh, 40px)/1 var(--font-ui); background: #fff; min-width: 1.2em; text-align: center; padding: 3px 9px 4px; border-radius: 14px; box-shadow: 0 0 0 3px currentColor, 0 6px 14px rgba(60, 30, 10, .4); animation: pop .35s cubic-bezier(.3, 1.6, .5, 1) both; }
  .tick { font: 700 20px/1 var(--font-ui); background: #fff; padding: 2px 8px; border-radius: 10px; box-shadow: 0 3px 8px rgba(80, 40, 10, .3); animation: pop .25s cubic-bezier(.3, 1.6, .5, 1) both; }
  .count { font: 700 clamp(34px, 5.4vh, 54px)/1 var(--font-ui); color: #3a2400; background: linear-gradient(#fffaf0, #fff0c8); padding: 4px 18px; border-radius: 18px; box-shadow: 0 0 0 3px #ffd75e, 0 10px 20px rgba(90, 50, 0, .3); }
  .word { font: 700 19px/1 var(--font-ui); color: #5a3a14; background: rgba(255, 250, 235, .95); padding: 6px 12px; border-radius: 12px; box-shadow: 0 4px 10px rgba(80, 40, 10, .3); animation: pop .3s both; }
  .thought { transform: translate(-50%, -100%); font: 700 clamp(22px, 3.4vh, 32px)/1 var(--font-ui); color: #2a1f45; background: #fff; padding: 8px 16px; border-radius: 20px; box-shadow: 0 0 0 3px #d9cff0, 0 10px 18px rgba(60, 30, 90, .3); animation: pop .35s cubic-bezier(.3, 1.6, .5, 1) both; }
  .thought::after { content: ''; position: absolute; left: 50%; bottom: -14px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px #d9cff0; }
  .sum { transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 2px; background: linear-gradient(#fffaf0, #fff0c8); padding: 8px 22px 10px; border-radius: 22px; box-shadow: 0 0 0 4px #ffd75e, 0 0 34px rgba(255, 200, 60, .7), 0 12px 24px rgba(90, 50, 0, .35); }
  .row1 { display: flex; align-items: baseline; gap: 10px; font: 700 clamp(34px, 5.4vh, 54px)/1.1 var(--font-ui); }
  .row1 b { font-weight: 700; animation: pop .35s cubic-bezier(.3, 1.6, .5, 1) both; }
  .row2 { display: flex; align-items: baseline; gap: 6px; font: 700 15px/1 var(--font-body); }
  .row2 i { font-style: normal; color: #7a6440; } .u0 { color: #1f6fd1; } .u1 { color: #d63c7c; } .u2 { color: #c47c00; } .u3 { color: #2a1f45; }
  @keyframes pop { from { opacity: 0; scale: .5; } }
  .hand { width: 46px; height: 46px; border-radius: 50%; border: 4px solid rgba(255, 255, 255, .95); box-shadow: 0 0 0 3px rgba(255, 196, 60, .8), 0 4px 14px rgba(0, 0, 0, .3); display: grid; place-items: center; }
  .hand i { width: 16px; height: 16px; border-radius: 50%; background: #fff; }

  .top { position: absolute; left: 0; right: 0; top: 0; display: flex; align-items: center; gap: 12px; padding: 12px 18px 12px 80px; z-index: 3; pointer-events: none; }
  .top > :global(*) { pointer-events: auto; }
  .prog { flex: 1; display: flex; justify-content: center; gap: 8px; background: rgba(255, 255, 255, .88); border-radius: 999px; padding: 8px 16px; max-width: 520px; margin: 0 auto; box-shadow: 0 6px 18px -8px rgba(60, 30, 10, .45); }
  .checkhead { flex: 0 1 auto; align-items: center; gap: 8px; font: 600 18px var(--font-ui); color: #8a5a00; }
  .prog img { width: 24px; height: 24px; object-fit: contain; filter: grayscale(1) opacity(.35); transition: filter .3s, transform .3s; }
  .prog img.on { filter: none; }
  .prog img.now { filter: drop-shadow(0 0 6px #ffd36b); transform: scale(1.3); }
  .chip { display: flex; align-items: center; gap: 8px; background: rgba(255, 255, 255, .88); border-radius: 18px; padding: 4px 14px 4px 4px; box-shadow: 0 6px 18px -8px rgba(60, 30, 10, .45); }
  .chip img { width: 34px; height: 40px; object-fit: contain; }
  .chip small { display: block; font: 800 10px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: var(--sc); }
  .chip b { font: 600 17px/1.1 var(--font-ui); color: var(--ink); }
  .mybet { position: absolute; left: 18px; top: 50%; translate: 0 -50%; z-index: 3; display: flex; flex-direction: column; align-items: center; gap: 2px; background: #fff; padding: 8px 18px 10px; border-radius: 18px; box-shadow: 0 0 0 3px #bfe3ff, 0 10px 18px rgba(30, 60, 90, .3); animation: pop .3s both; max-width: 200px; text-align: center; }
  .mybet small { font: 800 11px var(--font-body); letter-spacing: .08em; text-transform: uppercase; color: #1f6fd1; }
  .mybet b { font: 700 26px/1.1 var(--font-ui); color: #2a1f45; }

  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 18px 18px; z-index: 3; display: flex; justify-content: center; pointer-events: none; }
  .bottom > :global(*) { pointer-events: auto; }
  .row { display: flex; align-items: center; gap: 14px; justify-content: center; flex-wrap: wrap; }
  .pill { font: 700 18px var(--font-body); color: #fff; background: rgba(60, 36, 20, .72); backdrop-filter: blur(6px); padding: 12px 26px; border-radius: 999px; box-shadow: 0 8px 20px -8px rgba(0, 0, 0, .5); }
  .pill.task { background: rgba(70, 40, 10, .8); box-shadow: 0 0 0 3px rgba(255, 210, 90, .7), 0 8px 20px -8px rgba(0, 0, 0, .5); }
  .go { display: inline-flex; align-items: center; gap: 8px; animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.04); } }
  .ghostbtn { background: rgba(255, 255, 255, .9); }
  .kbd { background: rgba(255, 255, 255, .25); border-color: rgba(255, 255, 255, .4); color: inherit; font-size: 11px; height: 22px; }
  .fix { display: flex; flex-direction: column; align-items: center; gap: 12px; }
  .choices { display: flex; gap: 14px; }
  .choice { min-width: 130px; height: 84px; padding: 0 18px; border: 0; border-radius: 24px; cursor: pointer; font: 600 28px var(--font-ui); color: var(--ink); background: linear-gradient(#fff, #fff4dc); box-shadow: 0 0 0 4px #ffd75e, 0 7px 0 #e0a51c, 0 14px 24px -8px rgba(90, 50, 0, .5); transition: transform .1s; }
  .choice:hover { transform: translateY(-3px); }
  .choice:active { transform: translateY(3px); }
  .turn { display: flex; flex-direction: column; align-items: center; gap: 10px; width: min(1000px, 100%); }
  .ask { display: flex; align-items: center; gap: 12px; font: 600 clamp(26px, 4vh, 38px)/1.1 var(--font-ui); color: var(--ink); background: rgba(255, 255, 255, .95); padding: 8px 12px 8px 22px; border-radius: 24px; box-shadow: 0 12px 28px -12px rgba(60, 30, 10, .6); }
  .ico { width: 1.1em; height: 1.1em; flex: none; }
  .box { min-width: 2.2em; padding: 2px 12px; border-radius: 16px; background: #f4f0fb; box-shadow: inset 0 0 0 3px #d9cff0; text-align: center; white-space: pre; }
  .gobtn { display: inline-flex; align-items: center; gap: 6px; font-size: 20px; }

  .cardside { position: absolute; z-index: 4; right: 4%; top: 50%; translate: 0 -50%; width: min(430px, 44vw); display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .card { position: relative; width: min(320px, 100%); aspect-ratio: 512 / 700; background: var(--frame) center / 100% 100% no-repeat; filter: drop-shadow(0 18px 30px rgba(90, 50, 0, .45)); animation: flip .9s cubic-bezier(.3, 1.3, .5, 1) both; display: flex; }
  .card::before { content: ''; position: absolute; inset: 13% 11% 9%; border-radius: 10px; background: radial-gradient(ellipse at 50% 40%, #fffaf0, #f8e7c4 75%, #efd29c); box-shadow: inset 0 0 18px rgba(170, 110, 20, .35); z-index: -1; }
  @keyframes flip { from { transform: perspective(900px) rotateY(180deg) scale(.4); opacity: 0; } 60% { opacity: 1; } }
  .cin { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 26% 15% 16%; text-align: center; }
  .cin small { font: 800 12px var(--font-body); letter-spacing: .1em; text-transform: uppercase; color: #a8700a; }
  .cin h2 { margin: 0; font: 600 clamp(22px, 2.6vw, 30px)/1.05 var(--font-ui); color: #4a2f00; }
  .cpic { position: relative; width: 100%; aspect-ratio: 1.6; }
  .cart { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 12px; }
  .cin p { margin: 0; font: 600 14px/1.3 var(--font-body); color: #6b4a14; }
  .prizes { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .prize { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 86px; height: 88px; gap: 1px; border-radius: 20px; background: rgba(255, 255, 255, .95); box-shadow: 0 0 0 3px #ffe9a8, var(--shadow-sm); color: #b07a10; }
  .prize img { width: 36px; height: 36px; object-fit: contain; }
  .prize b { font: 600 17px/1 var(--font-ui); color: var(--ink); }
  .prize small { font: 700 11px var(--font-body); color: var(--muted); }
  .cbtns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .cbtns :global(.pn) { flex: 1 1 100%; justify-content: center; }
  .prize.tap { border: 0; font: inherit; cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, 0 5px 0 #f0c24a, var(--shadow-sm); transition: transform .12s; }
  .prize.tap:hover { transform: translateY(-3px); }
  .prize .wob { animation: ep-wob .7s ease-in-out infinite; }
  @keyframes ep-wob { 25% { transform: rotate(-9deg); } 75% { transform: rotate(9deg); } }

  /* phones */
  .narrow .top { padding: 8px 10px 8px 64px; gap: 8px; }
  .narrow .chip { display: none; }
  .narrow .prog { gap: 4px; padding: 6px 10px; }
  .narrow .prog img { width: 16px; height: 16px; }
  .narrow .bottom { padding: 0 10px 12px; }
  .narrow .pill { font-size: 15px; padding: 10px 16px; text-align: center; white-space: normal; }
  .narrow .go { font-size: 18px; padding: 12px 20px; }
  .narrow .kbd { display: none; }
  .narrow .choice { min-width: 92px; height: 70px; font-size: 22px; }
  .narrow .choices { gap: 10px; }
  .narrow .ask { font-size: 24px; padding: 6px 8px 6px 14px; }
  .narrow .tick { font-size: 15px; }
  .narrow .word { font-size: 15px; }
  .narrow .row1 { font-size: 30px; }
  .narrow .mybet { left: 8px; top: 124px; translate: none; padding: 4px 12px 6px; }
  .narrow .mybet b { font-size: 20px; }
  .narrow .cardside { left: 0; right: 0; top: auto; bottom: 10px; translate: none; width: 100%; padding: 0 12px; gap: 8px; }
  .narrow .card { width: min(190px, 48vw); }
  .narrow .cin { gap: 2px; }
  .narrow .cin h2 { font-size: 17px; }
  .narrow .cin p { font-size: 11px; }
  .narrow .prize { width: 70px; height: 70px; } .narrow .prize img { width: 28px; height: 28px; } .narrow .prize b { font-size: 14px; }
  .narrow .cbtns .btn-big { font-size: 17px; padding: 12px 18px; }
</style>
