<script lang="ts">
  // Turning the buddy on show all the way round: drag anywhere on the stage, or tap the turn buttons
  // (an eighth of a turn each, smoothly). Used by the Wardrobe and the Shop, so things on the back can
  // be seen from behind.
  import { onDestroy } from 'svelte';
  import type { ShowScene } from '../three/showScene';
  import Icon from './Icon.svelte';
  type Props = { scene: () => ShowScene | null; el: HTMLElement | undefined; top?: boolean };
  let { scene, el, top = false }: Props = $props();
  let dragging = false, lastX = 0;
  function down(e: PointerEvent) {
    // only on the stage itself (cards and buttons on it keep their taps)
    if (e.target !== el) return;
    dragging = true; lastX = e.clientX;
    el?.setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    scene()?.drag((e.clientX - lastX) * 0.012);
    lastX = e.clientX;
  }
  function up() { dragging = false; }
  $effect(() => {
    if (!el) return;
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.style.touchAction = 'pan-y';
    el.style.cursor = 'grab';
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  });
  onDestroy(up);
</script>

<div class="turns" class:top>
  <button class="tb" onclick={() => scene()?.turn(-Math.PI / 4)} aria-label="Turn left"><span class="mir"><Icon name="replay" size={26} /></span></button>
  <span class="lab">Drag to turn</span>
  <button class="tb" onclick={() => scene()?.turn(Math.PI / 4)} aria-label="Turn right"><Icon name="replay" size={26} /></button>
</div>

<style>
  .turns { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); z-index: 4; display: flex; align-items: center; gap: 8px; pointer-events: none; }
  /* (the Shop: in the top corner, clear of a cloud or a hat over the buddy) */
  .turns.top { bottom: auto; top: 8px; left: 10px; transform: none; }
  .tb { pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; border: 0; display: grid; place-items: center; background: rgba(255, 255, 255, .94); box-shadow: 0 0 0 3px #e4ddf3, var(--shadow-sm); cursor: pointer; }
  .tb:active { transform: translateY(2px); }
  .mir { display: inline-flex; transform: scaleX(-1); }
  .lab { font: 700 13px var(--font-body); color: var(--ink2); background: rgba(255, 255, 255, .85); padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
</style>
