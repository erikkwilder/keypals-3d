<script lang="ts">
  // Solve it on the balance: mystery boxes and weights on one side, weights on the other. Tap a weight (or
  // "Take 1 off both sides") and the same comes off BOTH sides, so it stays level; once the boxes are on
  // their own, two or more boxes can share out the other side into equal piles; then type what one box
  // weighs and Check. A child who already knows can type the answer straight away. Keys: digits,
  // Backspace, Enter; minus takes 1 off both sides.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import NumPad from '../../ui/NumPad.svelte';
  import BalanceView from '../../algebra/BalanceView.svelte';
  import type { BalanceSpec } from '../algebra';
  import type { CustomInputProps } from './SkillInput.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const spec = $derived((item.custom?.spec ?? { boxes: 1, left: 0, right: 1 }) as BalanceSpec);
  let l = $state(0), r = $state(0), shared = $state(false), typed = $state(''), bad = $state(false);
  let wobble = $state(0);
  $effect(() => { void item.id; l = spec.left; r = spec.right; shared = false; typed = ''; bad = false; });
  const name = $derived(spec.letter ?? 'the box');
  const alone = $derived(l === 0);
  const say = $derived(
    !alone ? `Take the same off both sides. ${l} to go on the ${spec.letter ? spec.letter : 'box'} side.`
    : spec.boxes === 1 ? `${spec.letter ? spec.letter : 'The box'} on its own balances ${r}.`
    : !shared ? `${spec.boxes} ${spec.letter ? `${spec.letter}'s` : 'boxes'} balance ${r}. Share it out!`
    : `Each ${spec.letter ? spec.letter : 'box'} balances ${r / spec.boxes}.`);
  function take(v: number) {
    if (disabled || l <= 0) return;
    onfirst();
    const k = Math.min(v, l);
    l -= k; r -= k;
    wobble++; sfx.thunk(); sfx.pop();
    if (l === 0) setTimeout(() => sfx.twinkle(), 250);
  }
  function share() { if (disabled || !alone || spec.boxes < 2 || shared) return; onfirst(); shared = true; sfx.whoosh(); setTimeout(() => sfx.twinkle(), 300); }
  function digit(d: string) {
    if (disabled || d === '.' || d === '-') return;
    onfirst(); bad = false;
    if (typed.length >= 3) typed = '';
    typed += d; sfx.click();
  }
  function back() { if (!disabled) { bad = false; typed = typed.slice(0, -1); } }
  function check() {
    if (disabled || !typed) return;
    const ok = (onanswer as (a: { kind: 'number'; value: number }) => unknown)({ kind: 'number', value: Number(typed) });
    if (ok === false) { bad = true; setTimeout(() => { if (bad) { typed = ''; bad = false; } }, 700); }
  }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); digit(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); back(); }
    else if (e.key === 'Enter') { e.preventDefault(); check(); }
    else if (e.key === '-') { e.preventDefault(); if (!alone) take(1); else share(); }
  }
  let vw = $state(1280);
  const bw = $derived(Math.min(compact ? 360 : 470, vw - 40));
</script>

<svelte:window onkeydown={key} bind:innerWidth={vw} />

<div class="bi" class:compact>
  <div class="scale">
    {#key wobble}<div class="wob" class:go={wobble > 0}>
      <BalanceView boxes={spec.boxes} left={l} right={r} letter={spec.letter ?? '?'} groups={shared ? spec.boxes : 0} w={bw}
        glowWeights={!alone && !disabled} glowBoxes={alone && (spec.boxes === 1 || shared)} ontap={(_s, kind, v) => { if (kind === 'weight') take(v); }} />
    </div>{/key}
    <p class="say">{say}</p>
  </div>
  <div class="acts">
    {#if !alone}<button class="btn act" {disabled} onpointerdown={(e) => { e.preventDefault(); take(1); }} tabindex="-1">Take 1 off both sides</button>
    {:else if spec.boxes > 1 && !shared}<button class="btn act" {disabled} onpointerdown={(e) => { e.preventDefault(); share(); }} tabindex="-1">Share into {spec.boxes}</button>{/if}
    <span class="ans" class:bad><span class="who">{#if spec.letter}<i>{spec.letter}</i>{:else}<b class="bx"></b>{/if} =</span><span class="box">{typed}</span></span>
    <button class="ok" disabled={disabled || !typed || bad} onpointerdown={(e) => { e.preventDefault(); check(); }} tabindex="-1" aria-label="Check {name}"><Icon name="check" size={26} /><span>Check</span></button>
  </div>
  <NumPad ondigit={digit} onback={back} {disabled} {compact} />
</div>

<style>
  .bi { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
  .scale { display: flex; flex-direction: column; align-items: center; }
  .wob.go { animation: wob .5s ease; }
  @keyframes wob { 30% { transform: translateY(3px); } 60% { transform: translateY(-2px); } }
  .say { margin: -4px 0 0; font: 700 16px var(--font-body); color: #4b3a86; background: #f3efff; border-radius: 99px; padding: 4px 14px; text-align: center; }
  .acts { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; }
  .act { font-size: 17px; padding: 10px 16px; border-radius: 16px; background: linear-gradient(#fff3c4, #ffd36b); box-shadow: 0 4px 0 #d9a42b; color: #6b3d10; }
  .ans { display: flex; align-items: center; gap: 8px; font: 600 30px var(--font-ui); color: var(--ink); }
  .who i { font-family: Georgia, serif; font-style: italic; color: #6c4fd8; }
  .who .bx { display: inline-block; width: 26px; height: 26px; border-radius: 6px; background: linear-gradient(#a98cff, #6c4fd8); vertical-align: -3px; }
  .box { min-width: 64px; min-height: 48px; padding: 2px 12px; border-radius: 16px; background: #fff; box-shadow: inset 0 0 0 4px #a98cff, 0 0 0 5px #efe9ff; display: grid; place-items: center; }
  .ans.bad .box { color: #d6335c; background: #fff0f3; box-shadow: inset 0 0 0 4px #ff8aa5, 0 0 0 5px #ffe0e8; animation: nope .4s ease; }
  @keyframes nope { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
  .ok { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 8px 18px 8px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 20px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; }
  .ok:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .say { font-size: 14px; }
  .compact .ans { font-size: 24px; }
  .compact .act { font-size: 15px; padding: 8px 12px; }
</style>
