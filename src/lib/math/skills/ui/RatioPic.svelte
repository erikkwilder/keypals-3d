<script lang="ts">
  // The ratios pictures (skills/ratioPic.ts): painted fruit on painted plates (one plate, or a row of the
  // same plate: batches), a little table on a wooden tag, a graph on squared paper (points, a line), and a
  // map strip with its scale. `size` is about the picture's height.
  import { FRUIT, type RatioPic } from '../ratioPic';
  type Props = { pic: RatioPic; size?: number };
  let { pic, size = 150 }: Props = $props();
  const base = import.meta.env.BASE_URL;

  // ---- fruit on plates: each plate's fruit in a little heap, kinds side by side ----
  const plates = $derived(pic.kind === 'fruit' ? Math.max(1, pic.plates ?? 1) : 0);
  const per = $derived(pic.kind === 'fruit' ? pic.sets.reduce((t, s) => t + s.n, 0) : 0);
  /** a plate's width: smaller when there are more plates (they share the line) */
  const pw = $derived(Math.round(size * (plates === 1 ? (per > 8 ? 1.5 : 1.15) : plates === 2 ? 0.95 : 0.8)));
  /** a fruit's width on a plate */
  const fw = $derived(Math.round(pw * (per <= 3 ? 0.36 : per <= 6 ? 0.28 : per <= 10 ? 0.22 : per <= 16 ? 0.17 : 0.14)));
  const fruitList = $derived(pic.kind === 'fruit' ? pic.sets.flatMap(s => Array.from({ length: s.n }, () => s.f)) : []);

  // ---- a graph ----
  const G = 200, PAD = 30;
  const gx = (x: number) => (pic.kind === 'graph' ? PAD + (x / pic.max[0]) * (G - PAD - 10) : 0);
  const gy = (y: number) => (pic.kind === 'graph' ? G - PAD - (y / pic.max[1]) * (G - PAD - 10) : 0);
  const yTicks = $derived(pic.kind === 'graph' ? Array.from({ length: 5 }, (_, i) => Math.round((pic.max[1] * i) / 4 * 10) / 10) : []);
</script>

{#if pic.kind === 'fruit'}
  <span class="plates" role="img" aria-label={pic.sets.map(s => `${s.n * plates} ${s.n * plates === 1 ? FRUIT[s.f].one : FRUIT[s.f].many}`).join(', ')}>
    {#each Array(plates) as _, k (k)}
      <span class="plate" style:width="{pw}px" style:height="{pw}px" style:background-image="url({base}learn/plate.webp)">
        <span class="heap" style:--fw="{fw}px">
          {#each fruitList as f, i (i)}<img src="{base}math/ratios/fruit/{f}.webp" alt="" draggable="false" style:--r="{((i * 47 + k * 13) % 23) - 11}deg" />{/each}
        </span>
      </span>
    {/each}
  </span>
{:else if pic.kind === 'table'}
  <span class="tbl" style:background-image="url({base}learn/tag.webp)" style:--fs="{Math.max(15, Math.round(size * 0.13))}px">
    <table>
      <thead><tr><th>{pic.head[0]}</th><th>{pic.head[1]}</th></tr></thead>
      <tbody>{#each pic.rows as [x, y], i (i)}<tr><td>{x}</td><td>{y}</td></tr>{/each}</tbody>
    </table>
  </span>
{:else if pic.kind === 'graph'}
  <svg class="graph" viewBox="0 0 {G} {G}" width={size * 1.2} height={size * 1.2} role="img" aria-label="A graph">
    <rect x="0" y="0" width={G} height={G} rx="14" fill="#fffaf0" />
    {#each Array(pic.max[0] + 1) as _, i (i)}<line x1={gx(i)} x2={gx(i)} y1={gy(0)} y2={gy(pic.max[1])} stroke="#e7dcc6" stroke-width="1" />{/each}
    {#each yTicks as t (t)}<line x1={gx(0)} x2={gx(pic.max[0])} y1={gy(t)} y2={gy(t)} stroke="#e7dcc6" stroke-width="1" /><text x={gx(0) - 5} y={gy(t) + 4} text-anchor="end" class="gl">{t}</text>{/each}
    {#each Array(pic.max[0] + 1) as _, i (i)}<text x={gx(i)} y={gy(0) + 15} text-anchor="middle" class="gl">{i}</text>{/each}
    <line x1={gx(0)} y1={gy(0)} x2={gx(pic.max[0]) + 4} y2={gy(0)} stroke="#6b4a2b" stroke-width="2.5" stroke-linecap="round" />
    <line x1={gx(0)} y1={gy(0)} x2={gx(0)} y2={gy(pic.max[1]) - 4} stroke="#6b4a2b" stroke-width="2.5" stroke-linecap="round" />
    {#if pic.line}<polyline points={pic.pts.map(([x, y]) => `${gx(x)},${gy(y)}`).join(' ')} fill="none" stroke="#f07a3a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />{/if}
    {#each pic.pts as [x, y], i (i)}<circle cx={gx(x)} cy={gy(y)} r="5.5" fill="#fff" stroke="#e0562a" stroke-width="3" />{/each}
    {#if pic.names}<text x={gx(pic.max[0])} y={gy(0) - 6} text-anchor="end" class="gn">{pic.names[0]}</text><text x={gx(0) + 6} y={gy(pic.max[1]) + 4} class="gn">{pic.names[1]}</text>{/if}
  </svg>
{:else if pic.kind === 'scale'}
  {@const unit = Math.min(26, (size * 2.2) / Math.max(4, pic.cm + 1))}
  <span class="map" style:--u="{unit}px">
    <span class="route" style:width="{pic.cm * unit}px"><i class="a"></i><i class="b"></i></span>
    <span class="ruler" style:width="{pic.cm * unit}px">{#each Array(Math.floor(pic.cm) + 1) as _, i (i)}<i style:left="{i * unit}px"></i>{/each}<b>{pic.cm} cm</b></span>
    <span class="key">{pic.label}</span>
  </span>
{/if}

<style>
  .plates { display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap; max-width: 100%; }
  .plate { position: relative; display: grid; place-items: center; background-size: 100% 100%; filter: drop-shadow(0 6px 8px rgba(80, 50, 20, .22)); }
  .heap { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; width: 72%; gap: 0; }
  .heap img { width: var(--fw); height: var(--fw); object-fit: contain; margin: calc(var(--fw) * -.08); transform: rotate(var(--r)); filter: drop-shadow(0 3px 2px rgba(60, 30, 10, .3)); }
  .tbl { display: inline-block; padding: 10px 16px 12px; background-size: 100% 100%; filter: drop-shadow(0 6px 10px rgba(80, 50, 20, .2)); }
  table { border-collapse: collapse; font: 600 var(--fs) var(--font-ui); color: #5b3416; }
  th { font: 800 calc(var(--fs) * .62) var(--font-body); text-transform: uppercase; letter-spacing: .04em; color: #9a6a3a; padding: 0 12px 4px; border-bottom: 2px solid #d9b98a; }
  td { text-align: center; padding: 2px 12px; }
  td + td, th + th { border-left: 2px solid #d9b98a; }
  .graph { display: block; filter: drop-shadow(0 6px 10px rgba(80, 50, 20, .18)); }
  .gl { font: 600 10px var(--font-ui); fill: #8a6a4a; }
  .gn { font: 800 9px var(--font-body); fill: #b06a2a; text-transform: uppercase; }
  .map { display: inline-flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 18px; border-radius: 16px; background: linear-gradient(#fbf1d6, #f1dfb3); box-shadow: inset 0 0 0 3px #e2c58c, 0 6px 12px rgba(80, 50, 20, .18); }
  .route { position: relative; height: 18px; border-bottom: 4px dashed #c0562a; }
  .route i { position: absolute; bottom: -12px; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #ffe08a, #e6a817); box-shadow: 0 0 0 3px #fff; }
  .route .a { left: -9px; } .route .b { right: -9px; background: radial-gradient(circle at 35% 35%, #ffb0c8, #e0567a); }
  .ruler { position: relative; height: 26px; border-top: 3px solid #6b4a2b; margin-top: 8px; }
  .ruler i { position: absolute; top: 0; width: 2px; height: 10px; background: #6b4a2b; transform: translateX(-1px); }
  .ruler b { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); font: 600 14px var(--font-ui); color: #6b4a2b; white-space: nowrap; }
  .key { font: 700 13px var(--font-body); color: #fff; background: #2e9e6e; padding: 2px 10px; border-radius: 999px; white-space: nowrap; }
</style>
