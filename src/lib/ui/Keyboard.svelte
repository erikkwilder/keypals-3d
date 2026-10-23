<script lang="ts">
  import { FINGER_COLOR, FINGER_LIGHT, type Finger, type Look } from '../art/cast';
  import { shiftFor, type Layout } from '../engine/layouts';

  type Props = {
    layout: Layout;
    next: string;
    look: Look;
    hints: 'auto' | 'always' | 'off';
    mastery: Record<string, number>;
    flash?: { ch: string; ok: boolean; n: number } | null;
  };
  let { layout, next, look, hints, mastery, flash = null }: Props = $props();

  let w = $state(0);
  let h = $state(0);
  const unit = $derived(Math.max(22, Math.min(w / 15.3, h / 5.35, 64)));
  const gap = $derived(Math.max(3, unit * 0.09));

  const target = $derived.by(() => {
    if (!next) return null;
    if (next === ' ') return { code: 'Space', shift: null as string | null };
    const info = layout.chars.get(next);
    if (!info) return null;
    return { code: info.code, shift: info.shift ? shiftFor(layout, next) : null };
  });
  const m = $derived(next ? (mastery[next] ?? 0) : 0);
  const strength = $derived(hints === 'off' ? 0 : hints === 'always' ? 2 : m < 0.6 ? 2 : m < 0.85 ? 1 : 0.5);

  function label(k: { base: string; special?: string; code: string }) {
    if (k.special === 'space') return '';
    if (k.special === 'shiftL' || k.special === 'shiftR') return 'shift';
    if (k.special === 'tab') return 'tab';
    if (k.special === 'caps') return 'caps';
    if (k.special === 'enter') return 'return';
    if (k.special === 'backspace') return 'delete';
    return /\p{L}/u.test(k.base) ? k.base.toUpperCase() : k.base;
  }

  function tint(finger: string, special?: string) {
    if (special && special !== 'space' && special !== 'shiftL' && special !== 'shiftR') return '#f1edf8';
    return look === 'soft' ? FINGER_LIGHT[finger as Finger] : FINGER_COLOR[finger as Finger];
  }

  /** blend a key's colour toward the plain key colour, hsl(255 33% 97%) (older Safari has no color-mix) */
  function fadeTo(col: string, amount: number) {
    const m = col.match(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/);
    if (!m) return col;
    const t = Math.max(0, Math.min(1, amount));
    return `hsl(${m[1]} ${(+m[2] * t + 33 * (1 - t)).toFixed(1)}% ${(+m[3] * t + 97 * (1 - t)).toFixed(1)}%)`;
  }

  let flashCode = $state<string | null>(null);
  let flashOk = $state(true);
  $effect(() => {
    if (!flash || !flash.n) return;
    const code = flash.ch === ' ' ? 'Space' : layout.chars.get(flash.ch)?.code ?? null;
    flashCode = null;
    requestAnimationFrame(() => { flashCode = code; flashOk = flash!.ok; });
    const t = setTimeout(() => (flashCode = null), 260);
    return () => clearTimeout(t);
  });
</script>

<div class="kb-wrap" bind:clientWidth={w} bind:clientHeight={h}>
  <div class="kb" style:--u="{unit}px" style:--g="{gap}px">
    {#each layout.rows as row, r}
      <div class="row">
        {#each row as k (k.code)}
          {@const isTarget = target && strength > 0 && (k.code === target.code || k.code === target.shift)}
          {@const km = k.base ? (mastery[k.base] ?? 0) : 0}
          <div
            class="key {k.special ?? ''}"
            class:target={isTarget}
            class:strong={isTarget && strength >= 2}
            class:subtle={isTarget && strength < 1}
            class:shiftkey={isTarget && k.code === target?.shift}
            class:flash-ok={flashCode === k.code && flashOk}
            class:flash-bad={flashCode === k.code && !flashOk}
            style:width="calc(var(--u) * {k.width ?? 1} - var(--g))"
            style:--kc={tint(k.finger, k.special)}
            style:--kf={fadeTo(tint(k.finger, k.special), hints === 'auto' && !k.special ? 1 - km * 0.55 : 1)}
            style:--fc={FINGER_COLOR[k.finger as Finger]}
          >
            <span class="cap">{label(k)}</span>
            {#if k.code === 'KeyF' || k.code === 'KeyJ'}<i class="bump"></i>{/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .kb-wrap { width: 100%; height: 100%; display: grid; place-items: center; }
  .kb { display: flex; flex-direction: column; gap: var(--g); }
  .row { display: flex; gap: var(--g); justify-content: center; }
  .key {
    position: relative; height: calc(var(--u) - var(--g));
    display: grid; place-items: center;
    border-radius: calc(var(--u) * .24);
    background: var(--kf, var(--kc));
    box-shadow: 0 calc(var(--u) * .07) 0 rgba(60, 40, 100, .14), 0 6px 12px -8px rgba(60, 40, 100, .3);
    font: 600 calc(var(--u) * .36)/1 var(--font-ui);
    color: var(--ink2);
    transition: transform .12s, box-shadow .12s, background .2s;
  }
  :global([data-look='ink']) .key { border: 2.5px solid #2a1b3d; box-shadow: 2px 3px 0 #2a1b3d; font-weight: 400; }
  :global([data-look='paper']) .key { border-radius: 6px; box-shadow: 0 2px 2px rgba(70, 55, 35, .25); }
  :global([data-look='geo']) .key { box-shadow: none; }
  .key.space, .key.shiftL, .key.shiftR, .key.tab, .key.caps, .key.enter, .key.backspace { font-size: calc(var(--u) * .24); color: var(--muted); }
  .bump { position: absolute; bottom: calc(var(--u) * .14); width: calc(var(--u) * .26); height: 3px; border-radius: 2px; background: rgba(60, 40, 100, .35); }
  .key.target { background: var(--fc); color: var(--ink); transform: translateY(-3px); box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--fc), 0 12px 20px -6px var(--fc); z-index: 2; }
  .key.target.strong { animation: key-glow 1.1s ease-in-out infinite; }
  .key.target.subtle { background: var(--kc); box-shadow: 0 0 0 2px var(--fc); transform: none; animation: none; }
  .key.shiftkey { animation: none; }
  @keyframes key-glow { 0%, 100% { box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--fc), 0 12px 20px -6px var(--fc); } 50% { box-shadow: 0 0 0 3px #fff, 0 0 0 9px var(--fc), 0 14px 26px -6px var(--fc); } }
  .key.flash-ok { transform: translateY(2px) scale(.96); }
  .key.flash-bad { animation: key-bad .28s ease; background: #ffd6e6; }
  @keyframes key-bad { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
  .pal { position: absolute; bottom: 72%; left: 50%; transform: translateX(-50%); pointer-events: none; animation: appear .2s ease; }
</style>
