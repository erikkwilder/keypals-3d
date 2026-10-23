<script lang="ts">
  import { FINGER_COLOR, type Finger, type Look } from '../art/cast';

  type Props = { side: 'left' | 'right'; active: Finger | null; also?: Finger | null; look: Look };
  let { side, active, also = null, look }: Props = $props();
  const uid = $props.id();

  // A left hand seen from above in a 200x200 box (the right hand is mirrored). Each digit is a
  // tapered capsule from knuckle `b` to tip `t`, wider at the knuckle (rb) than the tip (rt).
  // Middle is longest and pinky shortest; the thumb grows from low on the palm and points out.
  type Digit = { f: 'P' | 'R' | 'M' | 'I' | 'T'; b: [number, number]; t: [number, number]; rb: number; rt: number };
  const DIGITS: Digit[] = [
    { f: 'T', b: [126, 156], t: [170.4, 118.7], rb: 14, rt: 10 },
    { f: 'P', b: [52, 114], t: [40, 70], rb: 10.5, rt: 9 },
    { f: 'R', b: [77, 104], t: [70, 38], rb: 11.5, rt: 10 },
    { f: 'M', b: [103, 100], t: [103, 24], rb: 12, rt: 10.5 },
    { f: 'I', b: [129, 104], t: [136, 40], rb: 11.5, rt: 10 },
  ];
  // The palm: a nearly straight pinky side down to the wrist, the thumb's soft muscle swelling out
  // of the inner wrist, a rounded web up to the pointer finger, and small webs between the knuckles.
  // Its edges tuck under the digits, which are drawn over it.
  const PALM =
    'M45,110 C43,112 42.2,114.5 42.2,117 C41,132 40.5,152 42.5,170 C43.5,180 46,187 48,193 L51,232 L113,232 L117,196 ' +
    'C122,184 140.5,177 140.5,168 C140.5,162 146.5,155.6 152.3,150 L156,140 L149.1,121.9 C144.2,125.4 141,123.1 141,116 L139.9,105.2 ' +
    'L132,98 L116.3,97 L103,94 L90,96 L77,98 L64.5,104 L52,107 Z';
  const LIFT = 10;
  // drawn a touch larger than the box so the hand fills its corner; this is the point it grows from
  const GROW = 1.08, CX = 100, CY = 112;

  function geo(c: Digit) {
    const [ax, ay] = c.b, [bx, by] = c.t, L = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / L, uy = (by - ay) / L, vx = -uy, vy = ux;
    const k = (c.rb - c.rt) / L, q = Math.sqrt(1 - k * k);
    const ox = ux * k + vx * q, oy = uy * k + vy * q, ix = ux * k - vx * q, iy = uy * k - vy * q;
    const f = (v: number) => v.toFixed(2);
    const d = `M${f(ax + c.rb * ox)},${f(ay + c.rb * oy)} L${f(bx + c.rt * ox)},${f(by + c.rt * oy)} A${c.rt},${c.rt} 0 0 0 ${f(bx + c.rt * ix)},${f(by + c.rt * iy)} L${f(ax + c.rb * ix)},${f(ay + c.rb * iy)} A${c.rb},${c.rb} 0 1 0 ${f(ax + c.rb * ox)},${f(ay + c.rb * oy)}Z`;
    // the nail: an oval along the finger, just short of the tip
    const nx = bx - ux * c.rt * 0.12, ny = by - uy * c.rt * 0.12;
    return { d, ux, uy, nail: { x: nx, y: ny, rx: c.rt * 0.68, ry: c.rt * 0.8, rot: (Math.atan2(uy, ux) * 180) / Math.PI + 90 } };
  }
  const SHAPES = DIGITS.map(c => ({ ...c, ...geo(c) }));

  const id = (f: string): Finger => (f === 'T' ? 'TH' : ((side === 'left' ? 'L' : 'R') + f) as Finger);
  const color = (f: Finger) => FINGER_COLOR[f];
  const skin = $derived(look === 'ink' ? '#fffaf4' : '#fff8fc');
  const edge = $derived(look === 'ink' ? '#2d2340' : '#cfbfec');
  const edgeOn = $derived(look === 'ink' ? '#2d2340' : '#b9a3ea');
  /** where the active finger's Keypal sits: just past its lifted tip, in percent of the box */
  const tipOf = (c: (typeof SHAPES)[number]) => {
    const tx = CX + (c.t[0] + c.ux * (c.rt + LIFT) - CX) * GROW, ty = CY + (c.t[1] + c.uy * (c.rt + LIFT) - CY) * GROW;
    return { x: side === 'left' ? tx : 200 - tx, y: ty };
  };
  const activeCap = $derived(SHAPES.find(c => id(c.f) === active));
</script>

<div class="hand">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="{uid}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="174" x2="0" y2="204">
        <stop offset="0" stop-color="#fff" />
        <stop offset="1" stop-color="#000" />
      </linearGradient>
      <mask id="{uid}-wrist" maskUnits="userSpaceOnUse" x="-10" y="-30" width="220" height="270">
        <rect x="-10" y="-30" width="220" height="270" fill="url(#{uid}-fade)" />
      </mask>
    </defs>
    <g transform={side === 'right' ? 'translate(200 0) scale(-1 1)' : undefined} mask="url(#{uid}-wrist)">
      <g transform="translate({CX} {CY}) scale({GROW}) translate({-CX} {-CY})">
        <!-- outlines first, skin over them: only the outside edge of the whole hand shows -->
        <path d={PALM} fill={edge} stroke={edge} stroke-width="5" stroke-linejoin="round" />
        {#each SHAPES as c (c.f)}
          {@const fid = id(c.f)}
          <path class="finger" class:on={fid === active} style="--lx:{c.ux * LIFT}px; --ly:{c.uy * LIFT}px" d={c.d} fill={fid === active ? edgeOn : edge} stroke={fid === active ? edgeOn : edge} stroke-width="5" stroke-linejoin="round" />
        {/each}
        <path d={PALM} fill={skin} />
        {#each SHAPES as c (c.f)}
          {@const fid = id(c.f)}
          {@const lit = fid === active || fid === also}
          <g class="finger" class:on={fid === active} style="--lx:{c.ux * LIFT}px; --ly:{c.uy * LIFT}px">
            <path d={c.d} fill={skin} />
            <ellipse cx={c.nail.x} cy={c.nail.y} rx={c.nail.rx} ry={c.nail.ry} transform="rotate({c.nail.rot.toFixed(1)} {c.nail.x.toFixed(2)} {c.nail.y.toFixed(2)})" fill={color(fid)} opacity={lit ? 1 : 0.6} />
          </g>
        {/each}
      </g>
    </g>
  </svg>
  {#if active && activeCap}
    {@const tip = tipOf(activeCap)}
    {#key active}
      <div class="tipglow" style:left="{tip.x / 2}%" style:top="{tip.y / 2}%" style:--fc={color(active)}></div>
    {/key}
  {/if}
</div>

<style>
  .hand { position: relative; width: 100%; aspect-ratio: 1; max-height: 100%; }
  svg { width: 100%; height: 100%; overflow: visible; display: block; }
  /* Safari before 15 has no aspect-ratio: keep the hand square with the padding trick */
  @supports not (aspect-ratio: 1) {
    .hand { height: 0; padding-bottom: 100%; }
    svg { position: absolute; top: 0; left: 0; }
  }
  .finger { transition: transform .2s cubic-bezier(.3, .8, .4, 1.4); }
  .finger.on { transform: translate(var(--lx), var(--ly)); }
  .tipglow { position: absolute; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; pointer-events: none; background: radial-gradient(circle, #fff 0 30%, var(--fc) 32% 60%, transparent 62%); box-shadow: 0 0 14px var(--fc); animation: appear .2s ease, pulse-glow 1s ease-in-out infinite alternate; }
  @keyframes pulse-glow { to { transform: scale(1.25); } }
</style>
