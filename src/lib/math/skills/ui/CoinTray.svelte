<script lang="ts">
  // Make an amount: tap coins from the bank to drop them in the tray (tap a coin in the tray to take it
  // back), then Pay. The tray's total shows as you go, so counting on is easy to see.
  import { sfx } from '../../../audio/sound';
  import Icon from '../../../ui/Icon.svelte';
  import type { CustomInputProps } from './SkillInput.svelte';
  let { item, disabled, compact, onanswer, onfirst }: CustomInputProps = $props();
  const base = import.meta.env.BASE_URL;
  const ART: Record<number, string> = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter', 100: 'dollar' };
  const NAME: Record<number, string> = { 1: '1¢', 5: '5¢', 10: '10¢', 25: '25¢', 100: '$1' };
  const REL: Record<number, number> = { 1: 0.8, 5: 0.88, 10: 0.74, 25: 1, 100: 1.08 };
  const spec = $derived((item.custom?.spec ?? { coins: [25, 10, 5, 1] }) as { target?: number; coins: number[] });
  let tray = $state<{ c: number; k: number }[]>([]);
  let k = 0;
  $effect(() => { void item.id; tray = []; });
  const total = $derived(tray.reduce((t, x) => t + x.c, 0));
  const money = (c: number) => (c < 100 ? `${c}¢` : `$${(c / 100).toFixed(2)}`);
  function add(c: number) { if (disabled || tray.length >= 14) return; onfirst(); tray = [...tray, { c, k: k++ }]; sfx.coin(c); }
  function take(kk: number) { if (disabled) return; tray = tray.filter(x => x.k !== kk); sfx.click(); }
  function pay() { if (!disabled && tray.length) onanswer({ kind: 'number', value: total }); }
  function key(e: KeyboardEvent) {
    if (disabled || e.metaKey || e.ctrlKey) return;
    const i = Number(e.key);
    if (i >= 1 && i <= spec.coins.length) { e.preventDefault(); add(spec.coins[i - 1]); }
    else if (e.key === 'Backspace' && tray.length) { e.preventDefault(); take(tray[tray.length - 1].k); }
    else if (e.key === 'Enter') { e.preventDefault(); pay(); }
  }
</script>

<svelte:window onkeydown={key} />

<div class="ct" class:compact>
  <div class="tray" aria-label="Your tray: {money(total)}">
    {#each tray as x (x.k)}
      <button class="in" onpointerdown={(e) => { e.preventDefault(); take(x.k); }} tabindex="-1" aria-label="Take back {NAME[x.c]}"><img src="{base}math/money/{ART[x.c]}.webp" alt="" style:width="{Math.round((compact ? 40 : 52) * REL[x.c])}px" /></button>
    {:else}<span class="empty">Tap coins to put them here</span>{/each}
    <span class="sum">{money(total)}</span>
  </div>
  <div class="bank">
    {#each spec.coins as c, i (c)}
      <button class="coin" {disabled} onpointerdown={(e) => { e.preventDefault(); add(c); }} tabindex="-1" aria-label="Add {NAME[c]}">
        <img src="{base}math/money/{ART[c]}.webp" alt="" style:width="{Math.round((compact ? 54 : 70) * REL[c])}px" draggable="false" />
        <b>{NAME[c]}</b>
        {#if !compact}<span class="k">{i + 1}</span>{/if}
      </button>
    {/each}
    <button class="pay" disabled={disabled || !tray.length} onpointerdown={(e) => { e.preventDefault(); pay(); }} tabindex="-1"><Icon name="check" size={28} /><span>Pay</span></button>
  </div>
</div>

<style>
  .ct { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
  .tray { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; min-height: 76px; width: min(560px, 100%); padding: 10px 70px 10px 14px; border-radius: 22px; background: linear-gradient(#c99a62, #a8773f); box-shadow: inset 0 4px 10px rgba(60, 30, 5, .45), 0 4px 0 #7d5428; }
  .empty { font: 600 15px var(--font-body); color: #fff3dc; opacity: .9; }
  .in { border: 0; background: none; padding: 0; cursor: pointer; animation: drop .28s cubic-bezier(.3, 1.6, .5, 1); }
  .in img { display: block; filter: drop-shadow(0 3px 3px rgba(40, 20, 0, .45)); }
  @keyframes drop { from { transform: translateY(-26px) scale(1.2); opacity: .2; } }
  .sum { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font: 600 22px var(--font-ui); color: #fff; background: rgba(60, 30, 5, .35); padding: 4px 10px; border-radius: 12px; }
  .bank { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: 10px; }
  .coin { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; padding: 6px 8px; border-radius: 18px; background: #fff; box-shadow: var(--shadow-sm), inset 0 -3px 0 #ecdcc4; cursor: pointer; transition: transform .1s; }
  .coin:active:not(:disabled) { transform: translateY(2px) scale(.96); }
  .coin img { filter: drop-shadow(0 3px 3px rgba(70, 45, 10, .3)); }
  .coin b { font: 600 15px var(--font-ui); color: var(--ink); }
  .k { position: absolute; top: 4px; left: 6px; font: 700 11px var(--font-body); color: var(--muted); }
  .pay { display: flex; align-items: center; gap: 6px; border: 3px solid #3fbf7a; border-radius: 16px; padding: 10px 18px 10px 12px; background: linear-gradient(#7ee0a8, #3fbf7a); color: #fff; font: 600 22px var(--font-ui); box-shadow: 0 4px 0 #2f9a60; cursor: pointer; align-self: center; }
  .pay:disabled { filter: grayscale(.8); opacity: .6; cursor: default; }
  .compact .tray { min-height: 60px; padding-right: 64px; }
  .compact .coin { padding: 4px 6px; }
  .compact .sum { font-size: 18px; }
</style>
