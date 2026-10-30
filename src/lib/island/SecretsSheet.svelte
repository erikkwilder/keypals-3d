<script lang="ts">
  // "Island secrets": the ones found (their keepsake, when) and a soft hint for each of the rest.
  import { SECRETS, foundCount, type SecretId } from './secrets';
  import { ITEM } from './catalog';
  import type { IslandSave } from './save';

  type Props = { isl: IslandSave; thumbs: Record<string, string> };
  let { isl, thumbs }: Props = $props();
  const base = import.meta.env.BASE_URL;
  const when = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const at = (id: SecretId) => isl.secrets[id] ?? 0;
</script>

<h2><img src="{base}island/map.webp" alt="" />Island secrets: {foundCount(isl)} of {SECRETS.length}</h2>
<p class="muted">Each one leaves a keepsake for your island and a sticker for your book.</p>
<div class="list">
  {#each SECRETS as d (d.id)}
    {@const got = at(d.id) > 0}
    <div class="sec" class:got>
      <span class="pic">{#if thumbs[d.keepsake]}<img src={thumbs[d.keepsake]} alt="" />{:else}<img class="q" src="{base}island/map.webp" alt="" />{/if}</span>
      <span class="txt">
        <b>{got ? d.name : 'A secret'}</b>
        <small>{got ? `Found ${when(at(d.id))}. Your ${ITEM[d.keepsake]?.name ?? 'keepsake'} is in storage.` : d.hint}</small>
      </span>
    </div>
  {/each}
</div>

<style>
  h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font: 600 26px var(--font-ui); color: var(--ink); }
  h2 img { width: 44px; height: 44px; }
  .muted { margin: 0 0 12px; color: var(--muted); font: 700 14px var(--font-body); }
  .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
  .sec { display: flex; align-items: center; gap: 10px; background: #f7f3fb; border-radius: 18px; padding: 8px 12px 8px 8px; }
  .sec.got { background: linear-gradient(180deg, #fffaf0, #fff4dc); box-shadow: inset 0 0 0 2px #ffd36b; }
  .pic { flex: none; width: 64px; height: 64px; border-radius: 16px; background: #fff; display: grid; place-items: center; box-shadow: inset 0 0 0 2px #efe7da; }
  .pic img { width: 60px; height: 60px; object-fit: contain; }
  .sec:not(.got) .pic img { filter: brightness(0) opacity(.18); }
  .sec:not(.got) .pic img.q { filter: grayscale(1) opacity(.45); width: 44px; height: 44px; }
  .txt { min-width: 0; }
  .txt b { display: block; font: 600 17px var(--font-ui); color: var(--ink); }
  .txt small { display: block; font: 700 13px/1.3 var(--font-body); color: var(--ink2); }
  .sec:not(.got) .txt b { color: var(--muted); }
  @media (max-width: 520px) { h2 { font-size: 21px; padding-right: 40px; } h2 img { width: 36px; height: 36px; } .list { grid-template-columns: 1fr; } }
</style>
