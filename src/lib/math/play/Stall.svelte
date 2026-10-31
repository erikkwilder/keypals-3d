<script lang="ts">
  // Market Stall: keep a little stall, no clock. First price your three goods (any prices in the level's
  // range), then six Glimmer shoppers each buy something and pay with a quarter, 50¢ or a dollar bill: tap
  // coins into the tray for their change. The rules are in math/market/stall.ts.
  import { onDestroy, untrack } from 'svelte';
  import { mulberry32, shuffle } from '../../engine/rng';
  import { sfx } from '../../audio/sound';
  import type { FriendId } from '../../art/cast';
  import type { PlayBuddy } from './buddy';
  import { FirstTries, slipStars } from '../playground';
  import { GOODS } from '../market/dash';
  import { SHOPPERS, changeDue, countUpText, nudge, owed, stallGoods, stallLevel, stallShoppers, startPrices } from '../market/stall';
  import { COIN_ART, COIN_NAME, COIN_REL as REL, moneyText } from '../skills/decimals';
  import { GLIMMERS } from '../../adventure/glimmers';
  import { glimmerArt } from '../../adventure/evolve';

  type Props = { level: number; buddy: FriendId; ondone: (r: { stars: 0 | 1 | 2 | 3; ms: number; answers: boolean[] }) => void; pal?: PlayBuddy };
  let { level, ondone, pal }: Props = $props();
  const base = import.meta.env.BASE_URL;
  let corner: HTMLDivElement | undefined = $state();
  // the buddy keeps the stall from its corner, about 100 pixels tall
  $effect(() => { if (corner && pal) pal.area(corner, { span: Math.max(1.6, corner.getBoundingClientRect().width / 85), feetAt: 0.92 }); });
  // a new level remakes this whole round (the Playground keys it), so the first level is the one to use
  const lv = untrack(() => level);
  const rng = mulberry32(Date.now() % 1e9);
  const L = stallLevel(lv);
  const goods = stallGoods(rng);
  let prices = $state(startPrices(lv, rng));
  const shoppers = stallShoppers(lv, rng);
  const faces = shuffle(rng, GLIMMERS.filter(g => g.rarity !== 'legendary' && g.rarity !== 'mythic').map(g => g.id)).slice(0, SHOPPERS);
  const t0 = performance.now();
  let open = $state(false);
  let i = $state(0);
  let tray = $state<{ c: number; k: number }[]>([]);
  let kk = 0;
  let slips = $state(0), tries = $state(0);
  const firsts = new FirstTries();
  let note = $state('');
  let ok = $state(false);
  const timers: ReturnType<typeof setTimeout>[] = [];
  onDestroy(() => timers.forEach(clearTimeout));

  const buys = $derived(shoppers[i]);
  const cost = $derived(owed(prices, buys));
  const due = $derived(changeDue(lv, prices, buys));
  const total = $derived(tray.reduce((t, x) => t + x.c, 0));
  const PAID = L.pay === 100 ? 'a dollar bill' : L.pay === 50 ? 'two quarters' : 'a quarter';
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

  function price(n: number, dir: 1 | -1) { if (open) return; sfx.click(); prices[n] = nudge(lv, prices[n], dir); }
  function openStall() { if (open) return; sfx.whoosh(); open = true; pal?.cheer(); note = ''; }
  function add(c: number) { if (!open || ok || tray.length >= 14) return; note = ''; tray = [...tray, { c, k: kk++ }]; sfx.coin(c); }
  function take(k: number) { if (ok) return; tray = tray.filter(x => x.k !== k); sfx.click(); }
  function give() {
    if (!open || ok) return;
    if (!tray.length) { sfx.nope(); note = `Tap coins for the change: ${moneyText(L.pay)} take away ${moneyText(cost)}.`; return; }
    if (total === due) {
      ok = true; firsts.hit(); sfx.till(); pal?.cheer();
      note = `Thank you! ${moneyText(cost)} + ${moneyText(due)} = ${moneyText(L.pay)}.`;
      timers.push(setTimeout(() => {
        if (i + 1 >= shoppers.length) { ondone({ stars: slipStars(slips), ms: performance.now() - t0, answers: firsts.answers }); return; }
        i++; tray = []; ok = false; tries = 0; note = '';
      }, 1700));
    } else {
      slips++; tries++; firsts.miss(); sfx.miss(); pal?.oops();
      note = tries > 1 ? `Count up: ${countUpText(cost, L.pay)} That's ${moneyText(due)}.` : `That's ${moneyText(total)}, ${total < due ? 'not enough' : 'too much'}. ${moneyText(cost)} and the change should make ${moneyText(L.pay)}.`;
    }
  }
  function onKey(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) return;
    if (!open) { if (e.key === 'Enter') { e.preventDefault(); openStall(); } return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 4) { e.preventDefault(); add([25, 10, 5, 1][n - 1]); }
    else if (e.key === 'Backspace' && tray.length) { e.preventDefault(); take(tray[tray.length - 1].k); }
    else if (e.key === 'Enter') { e.preventDefault(); give(); }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="st">
  {#if open}<div class="top"><span class="dots">{#each shoppers as _, k}<i class:done={k < i || (k === i && ok)} class:now={k === i}></i>{/each}</span></div>{/if}
  <div class="row">
    <div class="main">
      <!-- the stall: your three goods with their price tags -->
      <div class="stall" class:open>
        {#each goods as g, n (g)}
          {@const bought = open && buys.includes(n)}
          <div class="good" class:bought class:dim={open && !bought}>
            <img src="{base}math/market/{GOODS[g].a}.webp" alt={GOODS[g].name} />
            <span class="tag">{moneyText(prices[n])}</span>
            {#if !open}
              <div class="pbtn"><button onclick={() => price(n, -1)} aria-label="Cheaper">−</button><button onclick={() => price(n, 1)} aria-label="Dearer">+</button></div>
            {/if}
          </div>
        {/each}
      </div>

      {#if !open}
        <div class="ask">
          <p>Price your goods! Shoppers will pay with <b>{PAID}</b>. Any prices from {moneyText(L.lo)} to {moneyText(L.hi)}.</p>
          <button class="btn btn-primary go" onclick={openStall}>Open the stall <span class="kbd">enter</span></button>
        </div>
      {:else}
        {#key i}
          <div class="shopper">
            <img class="face" src="{base}{glimmerArt(faces[i % faces.length])}" alt="" />
            <div class="says">
              <span>{buys.length > 1 ? `${cap(GOODS[goods[buys[0]]].name)} and ${GOODS[goods[buys[1]]].name}, please!` : `${cap(GOODS[goods[buys[0]]].name)}, please!`}</span>
              <span class="paid">Here's {#if L.pay === 100}<img class="bill" src="{base}math/money/bill.webp" alt="" />{:else}{#each Array(L.pay / 25) as _, q (q)}<img src="{base}math/money/quarter.webp" alt="" />{/each}{/if}<b>{moneyText(L.pay)}</b></span>
            </div>
          </div>
        {/key}
        <div class="tray" aria-label="The change: {moneyText(total)}">
          {#each tray as x (x.k)}
            <button class="in" onpointerdown={(e) => { e.preventDefault(); take(x.k); }} tabindex="-1" aria-label="Take back a {COIN_NAME[x.c]}"><img src="{base}math/money/{COIN_ART[x.c]}.webp" alt="" style:width="{Math.round(48 * REL[x.c])}px" /></button>
          {:else}<span class="empty">Tap coins for the change</span>{/each}
          <span class="sum">{moneyText(total)}</span>
        </div>
        <div class="bank">
          {#each [25, 10, 5, 1] as c, n (c)}
            <button class="coin" disabled={ok} onpointerdown={(e) => { e.preventDefault(); add(c); }} tabindex="-1" aria-label="Add a {COIN_NAME[c]}">
              <img src="{base}math/money/{COIN_ART[c]}.webp" alt="" style:width="{Math.round(58 * REL[c])}px" draggable="false" />
              <b>{moneyText(c)}</b><span class="k">{n + 1}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <!-- your buddy keeps the stall from here, cheering each sale -->
    <div class="corner" bind:this={corner}></div>
  </div>
  {#if open}
    <div class="foot">
      <p class="note" class:good={ok}>{note || (L.two ? `Add the two prices, then count up to ${moneyText(L.pay)}.` : `Count up from the price to ${moneyText(L.pay)}.`)}</p>
      <button class="btn btn-primary check" onclick={give} disabled={ok}>Give change <span class="kbd">enter</span></button>
    </div>
  {/if}
</div>

<style>
  .st { width: min(980px, 100%); margin: 0 auto; display: flex; flex-direction: column; gap: 10px; }
  .top { display: flex; justify-content: center; }
  .dots { display: flex; gap: 6px; justify-content: center; background: rgba(255, 255, 255, .9); border-radius: 20px; padding: 6px 14px; box-shadow: var(--shadow-sm); }
  .dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6e0f2; }
  .dots i.done { background: #e6a817; } .dots i.now { box-shadow: 0 0 0 3px #e6a817; }
  .row { display: flex; gap: 12px; align-items: stretch; }
  .main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .corner { flex: 0 0 clamp(140px, 18vw, 220px); }

  .stall { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; width: 100%; padding: 12px; border-radius: 24px; background: linear-gradient(#c99a62, #a8773f); box-shadow: inset 0 3px 0 rgba(255, 255, 255, .25), 0 5px 0 #7d5428, var(--shadow-sm); }
  .good { position: relative; display: flex; flex-direction: column; align-items: center; gap: 6px; background: #fff8ea; border-radius: 18px; padding: 10px 6px; transition: transform .25s, opacity .25s, box-shadow .25s; }
  .good img { width: clamp(64px, 11vw, 104px); height: clamp(64px, 11vw, 104px); object-fit: contain; filter: drop-shadow(0 5px 5px rgba(80, 50, 10, .25)); }
  .good.bought { transform: translateY(-4px); box-shadow: 0 0 0 4px #ffd36b, 0 0 24px rgba(255, 210, 107, .9); }
  .good.dim { opacity: .55; }
  .tag { font: 600 26px var(--font-ui); color: #6b3d10; background: #fff3c9; border: 2px dashed #d9a441; border-radius: 12px; padding: 0 12px; }
  .pbtn { display: flex; gap: 10px; }
  .pbtn button { width: 50px; height: 46px; border-radius: 14px; border: 0; cursor: pointer; font: 600 28px/1 var(--font-ui); background: linear-gradient(#fff, #f1ecfb); box-shadow: 0 4px 0 #d9cff0; color: var(--ink); touch-action: manipulation; }
  .pbtn button:active { transform: translateY(3px); box-shadow: 0 1px 0 #d9cff0; }

  .ask { display: flex; flex-direction: column; align-items: center; gap: 10px; background: rgba(255, 255, 255, .94); border-radius: 20px; padding: 12px 18px; box-shadow: var(--shadow-sm); text-align: center; }
  .ask p { margin: 0; font: 600 18px/1.4 var(--font-body); color: var(--ink2); }
  .ask b { color: #2f7d5b; }
  .go { font-size: 22px; padding: 12px 24px; }

  .shopper { display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, .94); border-radius: 20px; padding: 6px 16px 6px 6px; box-shadow: var(--shadow-sm); animation: walkin .45s cubic-bezier(.3, .8, .4, 1.3); }
  @keyframes walkin { from { transform: translateX(40px); opacity: 0; } }
  .face { width: 72px; height: 72px; object-fit: cover; border-radius: 16px; background: #eaf4ff; }
  .says { display: flex; flex-direction: column; gap: 2px; font: 600 19px var(--font-ui); color: var(--ink); }
  .paid { display: flex; align-items: center; gap: 4px; font: 700 15px var(--font-body); color: var(--ink2); }
  .paid img { width: 32px; height: 32px; object-fit: contain; }
  .paid img.bill { width: 68px; height: 32px; }
  .paid b { font: 600 20px var(--font-ui); color: #2f7d5b; }

  .tray { position: relative; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; min-height: 72px; width: min(560px, 100%); padding: 10px 70px 10px 14px; border-radius: 22px; background: linear-gradient(#3d8f69, #2f7d5b); box-shadow: inset 0 4px 10px rgba(10, 40, 20, .45), 0 4px 0 #7d5428; }
  .empty { font: 600 15px var(--font-body); color: #e8fff3; opacity: .9; }
  .in { border: 0; background: none; padding: 0; cursor: pointer; animation: drop .28s cubic-bezier(.3, 1.6, .5, 1); }
  .in img { display: block; filter: drop-shadow(0 3px 3px rgba(10, 30, 10, .45)); }
  @keyframes drop { from { transform: translateY(-26px) scale(1.2); opacity: .2; } }
  .sum { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font: 600 22px var(--font-ui); color: #fff; background: rgba(0, 30, 10, .3); padding: 4px 10px; border-radius: 12px; }
  .bank { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: center; gap: 10px; }
  .coin { position: relative; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; padding: 6px 10px; border-radius: 18px; background: #fff; box-shadow: var(--shadow-sm), inset 0 -3px 0 #ecdcc4; cursor: pointer; transition: transform .1s; touch-action: manipulation; }
  .coin:active:not(:disabled) { transform: translateY(2px) scale(.96); }
  .coin img { filter: drop-shadow(0 3px 3px rgba(70, 45, 10, .3)); }
  .coin b { font: 600 15px var(--font-ui); color: var(--ink); }
  .k { position: absolute; top: 4px; left: 6px; font: 700 11px var(--font-body); color: var(--muted); }

  .foot { display: flex; align-items: center; gap: 12px; }
  .note { flex: 1; margin: 0; font: 600 16px/1.35 var(--font-body); color: var(--ink2); background: #fff7d6; border-radius: 14px; padding: 10px 14px; }
  .note.good { background: #e2f7ee; color: #0f6a48; }
  .check { font-size: 22px; padding: 12px 22px; }
  @media (max-width: 600px) {
    .row { flex-direction: column-reverse; } .corner { flex: 0 0 100px; }
    .stall { gap: 6px; padding: 8px; border-radius: 18px; }
    .good { padding: 6px 2px; border-radius: 14px; }
    .tag { font-size: 20px; padding: 0 8px; }
    .pbtn { gap: 6px; } .pbtn button { width: 40px; height: 40px; font-size: 24px; }
    .face { width: 56px; height: 56px; }
    .says { font-size: 16px; }
    .tray { min-height: 60px; padding-right: 64px; }
    .bank { gap: 6px; } .coin { padding: 4px 6px; } .k { display: none; }
    .foot { flex-direction: column; align-items: stretch; }
    .check .kbd, .go .kbd { display: none; }
  }
</style>
