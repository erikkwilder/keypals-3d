<script lang="ts">
  // The grown-up check, everywhere grown-up things live (the Grown-ups screen, signing in): press and hold,
  // then type a number written in words ("sixty-three"). A grown-up does it in a few seconds; a young
  // child can't read it yet. Once passed it stays open for ten minutes.
  import { onMount } from 'svelte';
  import { grownupOpen, passGrownupCheck } from '../state/cloud.svelte';
  import { sfx } from '../audio/sound';

  type Props = { onpass: () => void; title?: string; note?: string };
  let { onpass, title = 'For parents and teachers', note = 'A quick check that you’re a grown-up.' }: Props = $props();

  const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const n = 21 + Math.floor(Math.random() * 79);
  const words = n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[n / 10];

  let step = $state<'hold' | 'type'>('hold');
  let holding = $state(0);
  let typed = $state('');
  let wrong = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let holdTimer: ReturnType<typeof setInterval> | undefined;
  function startHold() {
    clearInterval(holdTimer);
    holding = 0;
    holdTimer = setInterval(() => {
      holding += 0.05;
      if (holding >= 1) { clearInterval(holdTimer); step = 'type'; sfx.click(); setTimeout(() => input?.focus(), 50); }
    }, 75);
  }
  function stopHold() { clearInterval(holdTimer); if (step === 'hold') holding = 0; }
  function check() {
    if (Number(typed.trim()) === n) { passGrownupCheck(); sfx.complete(); onpass(); }
    else { wrong = true; typed = ''; sfx.nope(); }
  }
  onMount(() => { if (grownupOpen()) onpass(); return () => clearInterval(holdTimer); });
</script>

<div class="gate">
  <h2>{title}</h2>
  <p class="muted">{note}</p>
  {#if step === 'hold'}
    <button class="btn btn-primary btn-big hold" onpointerdown={startHold} onpointerup={stopHold} onpointerleave={stopHold} onkeydown={(e) => e.key === 'Enter' && startHold()} onkeyup={stopHold}>
      <span class="fill" style:width="{holding * 100}%"></span><span class="lbl">Press and hold</span>
    </button>
  {:else}
    <form class="ask card" onsubmit={(e) => { e.preventDefault(); check(); }}>
      <label for="gg-num">Type this number in digits: <b>{words}</b></label>
      <div class="row">
        <input id="gg-num" bind:this={input} bind:value={typed} inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off" oninput={() => (wrong = false)} />
        <button class="btn btn-primary" disabled={!typed.trim()}>Open</button>
      </div>
      {#if wrong}<p class="err">That’s not it. Have another look.</p>{/if}
    </form>
  {/if}
</div>

<style>
  .gate { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px 16px; text-align: center; }
  .gate h2 { font-size: 32px; margin: 0; }
  .gate p { margin: 0; }
  .hold { position: relative; overflow: hidden; width: min(280px, 100%); }
  .hold .fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(255, 255, 255, .35); }
  .hold .lbl { position: relative; }
  .ask { padding: 16px 20px; display: flex; flex-direction: column; gap: 10px; align-items: center; max-width: 420px; }
  .ask label { font: 600 18px/1.4 var(--font-ui); color: var(--ink); }
  .ask label b { color: var(--primary); font-size: 22px; }
  .row { display: flex; gap: 10px; }
  .row input { width: 90px; font: 600 26px var(--font-ui); text-align: center; padding: 6px 10px; border-radius: 12px; border: 2px solid #e4dcf2; }
  .err { color: #c0396b; font-weight: 700; }
</style>
