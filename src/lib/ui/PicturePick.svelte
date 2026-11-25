<script lang="ts">
  // A picture password's sixteen pictures, to tap two in order, and the two numbered places they go. The
  // class login uses it, and so does a family saying their player is a classmate on the list already
  // (Grown-ups › Players), with that child's pictures from the login card. The pictures are always in the
  // same mixed-up order, so a child learns where theirs are. `shake` goes up by one to shake the pictures
  // after a wrong pair; `small` fits them in a grown-up's card.
  import { PICTURES, pictureSrc } from '../teach/names';

  type Props = { picked: number[]; ontap: (i: number) => void; shake?: number; small?: boolean };
  let { picked, ontap, shake = 0, small = false }: Props = $props();
  const order = [5, 12, 0, 9, 14, 3, 7, 10, 1, 15, 6, 13, 2, 8, 11, 4].filter(i => i < PICTURES.length);
</script>

<div class="slots" class:small>
  {#each [0, 1] as k (k)}
    <div class="slot" class:full={picked[k] !== undefined}><b>{k + 1}</b>{#if picked[k] !== undefined}<img src={pictureSrc(picked[k])} alt={PICTURES[picked[k]].name} />{/if}</div>
  {/each}
</div>
{#key shake}
  <div class="pics" class:shake={shake > 0} class:small>
    {#each order as i (i)}
      <button class="pic" class:on={picked.includes(i)} onclick={() => ontap(i)} aria-label={PICTURES[i].name}><img src={pictureSrc(i)} alt="" /><span>{PICTURES[i].name}</span></button>
    {/each}
  </div>
{/key}

<style>
  .slots { display: flex; gap: 18px; margin-bottom: 18px; }
  .slot { width: 92px; height: 92px; border-radius: 22px; border: 3px dashed #cfc3ef; display: grid; place-items: center; position: relative; background: rgba(255, 255, 255, .7); }
  .slot b { position: absolute; top: -12px; left: -12px; width: 30px; height: 30px; border-radius: 50%; background: var(--primary); color: #fff; font: 800 16px/30px var(--font-body); }
  .slot.full { border-style: solid; border-color: var(--primary-hi); background: #fff; }
  .slot img { width: 78px; height: 78px; object-fit: contain; animation: pop .25s ease; }
  .pics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; width: min(620px, 100%); }
  .pic { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 20px; border: 3px solid #ece4fb; background: #fff; cursor: pointer; box-shadow: var(--shadow-sm); }
  .pic img { width: min(96px, 100%); aspect-ratio: 1; object-fit: contain; }
  .pic span { font: 700 15px var(--font-body); color: var(--ink2); }
  .pic:hover { border-color: var(--primary-hi); transform: translateY(-2px); }
  .pic.on { border-color: var(--primary); background: #f3eeff; opacity: .6; }
  .shake { animation: shake .45s ease; }
  .small.slots { gap: 14px; margin: 10px 0 12px 12px; }
  .small .slot { width: 64px; height: 64px; border-radius: 16px; }
  .small .slot b { top: -10px; left: -10px; width: 24px; height: 24px; font-size: 13px; line-height: 24px; }
  .small .slot img { width: 52px; height: 52px; }
  .small.pics { gap: 8px; width: min(420px, 100%); }
  .small .pic { padding: 4px 2px; border-radius: 14px; border-width: 2px; }
  .small .pic img { width: min(56px, 100%); }
  .small .pic span { font-size: 12px; }
  @keyframes shake { 20%, 60% { transform: translateX(-10px); } 40%, 80% { transform: translateX(10px); } }
  @keyframes pop { from { transform: scale(.6); } to { transform: scale(1); } }
  @media (max-width: 600px) {
    .pics { gap: 8px; }
    .pic { padding: 6px 2px; border-radius: 16px; }
    .pic span { font-size: 12.5px; }
    .slot { width: 76px; height: 76px; }
    .slot img { width: 64px; height: 64px; }
  }
</style>
