<script lang="ts">
  // The finger coach: a keyboard seen from above with two hands on it. The coach talks and
  // the fingers show the move: land on the home row, reach for a key, press it, come home.
  import { onDestroy, onMount } from 'svelte';
  import { FINGER_COLOR, FINGER_LIGHT, type Finger, type Look } from '../art/cast';
  import type { KeyDef, Layout } from '../engine/layouts';
  import { HOME_CODE, type DemoAct, type DemoKey, type DemoStep } from '../engine/demos';
  import { Spring, onFrame } from '../anim/spring';
  import { hush, lineText, say } from '../audio/voice.svelte';
  import { sfx } from '../audio/sound';
  import { game } from '../state/game.svelte';
  import Icon from './Icon.svelte';

  type Props = { steps: DemoStep[]; layout: Layout; look: Look; title?: string; onDone: (skipped: boolean) => void };
  let { steps, layout, look, title = 'Finger coach', onDone }: Props = $props();

  type Digit = 'LP' | 'LR' | 'LM' | 'LI' | 'LT' | 'RT' | 'RI' | 'RM' | 'RR' | 'RP';
  type Pt = { x: number; y: number };
  const DIGITS: Digit[] = ['LP', 'LR', 'LM', 'LI', 'LT', 'RT', 'RI', 'RM', 'RR', 'RP'];
  const EIGHT: Digit[] = ['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP'];
  const THUMBS: Digit[] = ['LT', 'RT'];
  const U = 100;
  const VB = { x: -40, y: -170, w: 1580, h: 870 };
  /** how thick each digit is, as a radius at the knuckle and at the tip: middle is widest, pinky slimmest */
  const RAD: Record<string, [number, number]> = { P: [27, 23], R: [30, 26], M: [32, 27.5], I: [31, 26.5], T: [33, 28] };
  const side = (d: Digit) => (d[0] === 'L' ? 'L' : 'R') as 'L' | 'R';
  const fingerOf = (d: Digit): Finger => (d === 'LT' || d === 'RT' ? 'TH' : (d as Finger));
  const digitOf = (f: Finger): Digit => (f === 'TH' ? 'RT' : (f as Digit));

  // ---------- keyboard geometry ----------
  type KeyBox = { code: string; x: number; y: number; w: number; cx: number; cy: number; label: string; finger: Finger; special?: string };
  function labelOf(k: KeyDef) {
    if (k.special === 'space') return '';
    if (k.special === 'shiftL' || k.special === 'shiftR') return 'shift';
    if (k.special === 'tab') return 'tab';
    if (k.special === 'caps') return 'caps';
    if (k.special === 'enter') return 'return';
    if (k.special === 'backspace') return 'delete';
    return /\p{L}/u.test(k.base) ? k.base.toUpperCase() : k.base;
  }
  const keys: KeyBox[] = [];
  // the layout can't change while the coach is open
  // svelte-ignore state_referenced_locally
  for (const row of layout.rows) {
    let x = row[0]?.row === 4 ? 3.75 * U : 0;
    for (const k of row) {
      const w = (k.width ?? 1) * U;
      keys.push({ code: k.code, x, y: k.row * U, w, cx: x + w / 2, cy: k.row * U + U / 2, label: labelOf(k), finger: k.finger, special: k.special });
      x += w;
    }
  }
  const byCode = new Map(keys.map(k => [k.code, k]));
  const space = byCode.get('Space')!;
  const keyFill = (k: KeyBox) => {
    if (k.special && k.special !== 'space' && k.special !== 'shiftL' && k.special !== 'shiftR') return '#f1edf8';
    return look === 'soft' ? FINGER_LIGHT[k.finger as Finger] : FINGER_COLOR[k.finger as Finger];
  };
  const friendCol = (f: Finger) => FINGER_COLOR[f];

  // ---------- hands ----------
  const TIP_DY = 12;
  const tipAt = (code: string): Pt => { const k = byCode.get(code)!; return { x: k.cx, y: k.cy + TIP_DY }; };
  // halfway between the two pointer fingers: the right hand is the left hand mirrored across it
  const MID = (tipAt(HOME_CODE.LI).x + tipAt(HOME_CODE.RI).x) / 2;
  function homeTip(d: Digit): Pt {
    if (d === 'LT') return { x: MID - 62, y: space.cy + 4 };
    if (d === 'RT') return { x: MID + 62, y: space.cy + 4 };
    return tipAt(HOME_CODE[d]);
  }
  // Each knuckle sits below its fingertip (left hand; the right mirrors it). The middle finger
  // reaches furthest and the pinky least, so their knuckles sit lowest and highest.
  const KNUCKLE: Record<string, [number, number]> = { P: [36, 122], R: [18, 146], M: [0, 156], I: [-20, 146] };
  // the thumb's own knuckle sits low on the inner side of the palm, below the pointer finger
  const THUMB_ROOT: [number, number] = [15, 108];
  function restBase(d: Digit): Pt {
    const s = side(d) === 'L' ? 1 : -1;
    if (d === 'LT' || d === 'RT') { const i = restBase(d === 'LT' ? 'LI' : 'RI'); return { x: i.x + THUMB_ROOT[0] * s, y: i.y + THUMB_ROOT[1] }; }
    const h = homeTip(d), [dx, dy] = KNUCKLE[d[1]];
    return { x: h.x + dx * s, y: h.y + dy };
  }
  const HOME = Object.fromEntries(DIGITS.map(d => [d, homeTip(d)])) as Record<Digit, Pt>;
  const BASE = Object.fromEntries(DIGITS.map(d => [d, restBase(d)])) as Record<Digit, Pt>;

  const tip = Object.fromEntries(DIGITS.map(d => [d, { x: new Spring(HOME[d].x, 150, 19), y: new Spring(HOME[d].y, 150, 19), up: new Spring(1, 140, 15) }])) as Record<Digit, { x: Spring; y: Spring; up: Spring }>;
  const hand = { L: { x: new Spring(0, 80, 15), y: new Spring(0, 80, 15) }, R: { x: new Spring(0, 80, 15), y: new Spring(0, 80, 15) } };
  const enter = new Spring(560, 34, 10);
  const lift = new Spring(1, 50, 11);
  let bob = 0;

  // ---------- hand shapes ----------
  // The back of the hand is one rigid shape: it only ever slides with its hand, so its outline is
  // built once and moved with a transform. Fingers are tapered capsules from knuckle to tip. The
  // thumb also carries the soft web it shares with the pointer finger and the muscle at its root
  // that runs down into the wrist, so it always looks grown from the palm.
  type Seg = [string, ...[number, number][]];
  // left palm, relative to the left pointer knuckle; the right palm mirrors it
  const PALM: Seg[] = [
    ['M', [-261, -32]],
    ['C', [-267, -26], [-271, -20], [-272, -12]], // pinky's outer edge flows straight into the palm
    ['C', [-275, 22], [-279, 72], [-277, 122]],   // the long, nearly straight pinky side
    ['C', [-276, 182], [-265, 232], [-253, 282]], // narrowing into the wrist
    ['L', [-259, 432]],                           // forearm, off the bottom of the stage
    ['L', [-31, 432]],
    ['L', [-20, 292]],                            // inner wrist (the thumb's muscle ends here)
    ['L', [36, 22]],                              // top of the thumb web
    ['L', [33, 4]],                               // pointer finger's inner side
    ['L', [15, -12]], ['L', [-39, -8]], ['L', [-80, -6]], ['L', [-122, -8]], ['L', [-162, -11]], ['L', [-205, -20]], ['L', [-243, -31]], // webs between the fingers
  ];
  const WRIST: Pt = { x: -20, y: 292 }, WEB: Pt = { x: 36, y: 22 }, INNER: Pt = { x: 33, y: 4 }, MUSCLE: Pt = { x: 40, y: 200 };
  const f1 = (v: number) => v.toFixed(1);
  const handPt = (sd: 'L' | 'R', p: Pt): Pt => { const i = BASE[(sd + 'I') as Digit]; return { x: i.x + p.x * (sd === 'L' ? 1 : -1), y: i.y + p.y }; };
  function palmPath(sd: 'L' | 'R'): string {
    return PALM.map(([c, ...pts]) => c + pts.map(([x, y]) => { const p = handPt(sd, { x, y }); return `${f1(p.x)},${f1(p.y)}`; }).join(' ')).join('') + 'Z';
  }
  const PALM_D = { L: palmPath('L'), R: palmPath('R') };
  const restOf = (sd: 'L' | 'R') => ({ wrist: handPt(sd, WRIST), web: handPt(sd, WEB), inner: handPt(sd, INNER), muscle: handPt(sd, MUSCLE) });
  const REST = { L: restOf('L'), R: restOf('R') };

  /** Unit direction and the two side normals where a tapered capsule's edges touch its end circles. */
  function frame(a: Pt, ra: number, b: Pt, rb: number, s: number) {
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, vx = -uy * s, vy = ux * s;
    const c = Math.max(-0.95, Math.min(0.95, (ra - rb) / L)), q = Math.sqrt(1 - c * c);
    return { L, ux, uy, ox: ux * c + vx * q, oy: uy * c + vy * q, ix: ux * c - vx * q, iy: uy * c - vy * q };
  }
  /** a finger: wide at the knuckle `a`, a little slimmer and round at the tip `b` */
  function finger(a: Pt, ra: number, b: Pt, rb: number): string {
    const g = frame(a, ra, b, rb, 1);
    return `M${f1(a.x + ra * g.ox)},${f1(a.y + ra * g.oy)}L${f1(b.x + rb * g.ox)},${f1(b.y + rb * g.oy)}A${rb},${rb} 0 0 0 ${f1(b.x + rb * g.ix)},${f1(b.y + rb * g.iy)}L${f1(a.x + ra * g.ix)},${f1(a.y + ra * g.iy)}A${ra},${ra} 0 1 0 ${f1(a.x + ra * g.ox)},${f1(a.y + ra * g.oy)}Z`;
  }
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  /** the thumb, with its web to the pointer finger and its muscle down to the wrist */
  function thumb(sd: 'L' | 'R', a: Pt, b: Pt, off: Pt): string {
    const s = sd === 'L' ? 1 : -1, [ra, rb] = RAD.T, g = frame(a, ra, b, rb, s);
    const add = (p: Pt) => ({ x: p.x + off.x, y: p.y + off.y });
    const wrist = add(REST[sd].wrist), web = add(REST[sd].web), inner = add(REST[sd].inner);
    const tOut = { x: b.x + rb * g.ox, y: b.y + rb * g.oy }, tIn = { x: b.x + rb * g.ix, y: b.y + rb * g.iy };
    const rOut = { x: a.x + ra * g.ox, y: a.y + ra * g.oy }, rIn = { x: a.x + ra * g.ix, y: a.y + ra * g.iy };
    // web: round off the corner where the palm's inner edge meets the thumb's inner edge
    let ex = web.x - inner.x, ey = web.y - inner.y, el = Math.hypot(ex, ey) || 1;
    ex /= el; ey /= el;
    let dx = rIn.x - tIn.x, dy = rIn.y - tIn.y; const dl = Math.hypot(dx, dy) || 1;
    dx /= dl; dy /= dl;
    const den = cross(ex, ey, dx, dy);
    let t = 20, k = 40;
    if (Math.abs(den) > 0.05) { t = cross(tIn.x - web.x, tIn.y - web.y, dx, dy) / den; k = cross(tIn.x - web.x, tIn.y - web.y, ex, ey) / den; }
    if (!(t > 4 && k > 8)) { t = 20; k = Math.max(8, k); }
    const cx = web.x + ex * t, cy = web.y + ey * t, m = Math.min(t * 0.6, k - 6);
    const wi = { x: cx - dx * m, y: cy - dy * m };
    // Below the thumb a soft curve turns down the side of the hand, over the swell of the thumb's
    // muscle, and in to the wrist.
    const muscle = add(REST[sd].muscle);
    const j = { x: tOut.x + (rOut.x - tOut.x) * 0.78, y: tOut.y + (rOut.y - tOut.y) * 0.78 };
    const ol = Math.hypot(rOut.x - tOut.x, rOut.y - tOut.y) || 1, ox = (rOut.x - tOut.x) / ol, oy = (rOut.y - tOut.y) / ol;
    const jm = Math.hypot(muscle.x - j.x, muscle.y - j.y), mw = Math.hypot(wrist.x - muscle.x, wrist.y - muscle.y);
    const sweep = s > 0 ? 1 : 0;
    return `M${f1(web.x)},${f1(web.y)}C${f1(web.x + ex * t * 0.6)},${f1(web.y + ey * t * 0.6)} ${f1(wi.x + dx * m * 0.6)},${f1(wi.y + dy * m * 0.6)} ${f1(wi.x)},${f1(wi.y)}`
      + `L${f1(tIn.x)},${f1(tIn.y)}A${rb},${rb} 0 0 ${sweep} ${f1(tOut.x)},${f1(tOut.y)}L${f1(j.x)},${f1(j.y)}`
      + `C${f1(j.x + ox * jm * 0.3)},${f1(j.y + oy * jm * 0.3)} ${f1(muscle.x)},${f1(muscle.y - jm * 0.5)} ${f1(muscle.x)},${f1(muscle.y)}`
      + `C${f1(muscle.x)},${f1(muscle.y + mw * 0.45)} ${f1(wrist.x + s * mw * 0.12)},${f1(wrist.y - mw * 0.25)} ${f1(wrist.x)},${f1(wrist.y)}Z`;
  }

  type Frame = { tips: Record<Digit, Pt>; bases: Record<Digit, Pt>; ups: Record<Digit, number>; off: { L: Pt; R: Pt }; shape: Record<Digit, string>; lift: number };
  function computeFrame(): Frame {
    const lf = lift.x, ey = enter.x - lf * 34 + bob;
    const off = { L: { x: hand.L.x.x, y: hand.L.y.x + ey }, R: { x: hand.R.x.x, y: hand.R.y.x + ey } };
    const tips = {} as Record<Digit, Pt>, bases = {} as Record<Digit, Pt>, ups = {} as Record<Digit, number>, shape = {} as Record<Digit, string>;
    for (const d of DIGITS) {
      const o = off[side(d)];
      bases[d] = { x: BASE[d].x + o.x, y: BASE[d].y + o.y };
      tips[d] = { x: tip[d].x.x, y: tip[d].y.x + ey - tip[d].up.x * 26 };
      ups[d] = Math.max(0, tip[d].up.x);
      const [ra, rb] = RAD[d[1]];
      shape[d] = d === 'LT' || d === 'RT' ? thumb(side(d), bases[d], tips[d], o) : finger(bases[d], ra, tips[d], rb);
    }
    return { tips, bases, ups, off, shape, lift: lf };
  }
  let F = $state.raw<Frame>(computeFrame());

  // ---------- what's on screen besides the hands ----------
  let down = $state<Record<string, boolean>>({});
  let glow = $state<string[]>([]);
  let bump = $state<string[]>([]);
  let blind = $state(false);
  let pals = $state<Digit[]>([]);
  let bubble = $state<{ code: string; ch: string; shift: boolean; finger: Finger; n: number } | null>(null);
  let ripples = $state<{ id: number; x: number; y: number }[]>([]);
  let rippleN = 0;

  // ---------- the script ----------
  let stepI = $state(0);
  let token = 0;
  let closed = false;
  const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

  function moveTo(d: Digit, code: string) {
    const t = tipAt(code), s = side(d);
    tip[d].x.target = t.x; tip[d].y.target = t.y;
    const ox = Math.max(-60, Math.min(60, (t.x - HOME[d].x) * 0.22)), oy = Math.max(-50, Math.min(40, (t.y - HOME[d].y) * 0.22));
    hand[s].x.target = ox; hand[s].y.target = oy;
    for (const o of DIGITS) if (o !== d && side(o) === s) { tip[o].x.target = HOME[o].x + ox * 0.7; tip[o].y.target = HOME[o].y + oy * 0.7; }
  }
  function moveHome(d: Digit) {
    const s = side(d);
    hand[s].x.target = 0; hand[s].y.target = 0;
    for (const o of DIGITS) if (side(o) === s) { tip[o].x.target = HOME[o].x; tip[o].y.target = HOME[o].y; }
  }
  function press(code: string, f: Finger) {
    down = { ...down, [code]: true };
    const k = byCode.get(code)!;
    const id = ++rippleN;
    ripples = [...ripples, { id, x: k.cx, y: k.cy }];
    setTimeout(() => (ripples = ripples.filter(r => r.id !== id)), 650);
    sfx.key(f);
  }
  const release = (code: string) => { const { [code]: _, ...rest } = down; down = rest; };

  /** Put every finger in place: `landed` rest on the keys, the rest hover just above. */
  function pose(landed: Digit[], handLift = 0) {
    for (const d of DIGITS) { tip[d].x.target = HOME[d].x; tip[d].y.target = HOME[d].y; tip[d].up.target = landed.includes(d) ? 0 : 1; }
    hand.L.x.target = hand.L.y.target = hand.R.x.target = hand.R.y.target = 0;
    enter.target = 0;
    lift.target = handLift;
    bob = 0;
    down = {}; glow = []; bump = []; blind = false; pals = []; bubble = null;
  }

  async function tap(d: Digit, code: string, alive: () => boolean, travel: boolean) {
    tip[d].up.target = 0.65;
    if (travel) moveTo(d, code);
    await wait(travel ? 400 : 150);
    if (!alive()) return;
    tip[d].up.target = 0;
    await wait(90);
    if (!alive()) return;
    press(code, fingerOf(d));
    await wait(200);
    release(code);
    if (travel) { tip[d].up.target = 0.5; moveHome(d); await wait(330); tip[d].up.target = 0; } else await wait(120);
  }

  async function reachOnce(k: DemoKey, alive: () => boolean, times: number) {
    const d = digitOf(k.finger);
    const travel = !(k.code === HOME_CODE[d as keyof typeof HOME_CODE]);
    bubble = { code: k.code, ch: k.ch, shift: !!k.shift, finger: k.finger, n: (bubble?.n ?? 0) + 1 };
    glow = k.shift ? [k.code, k.shift] : [k.code];
    await wait(450);
    for (let i = 0; i < times && alive(); i++) {
      let sd: Digit | null = null;
      if (k.shift) {
        sd = k.shift === 'ShiftLeft' ? 'LP' : 'RP';
        tip[sd].up.target = 0.6; moveTo(sd, k.shift);
        await wait(380);
        if (!alive()) return;
        tip[sd].up.target = 0; down = { ...down, [k.shift]: true };
        await wait(160);
      }
      await tap(d, k.code, alive, travel);
      if (sd && k.shift) { release(k.shift); tip[sd].up.target = 0.4; moveHome(sd); await wait(260); tip[sd].up.target = 0; }
      await wait(260);
    }
  }

  async function act(a: DemoAct, alive: () => boolean, until: { done: boolean }) {
    switch (a.a) {
      case 'enter':
        pose([], 1);
        enter.set(560); enter.target = 0;
        return;
      case 'float': {
        pose([], 1);
        const t0 = performance.now();
        while (alive() && !until.done) { bob = Math.sin((performance.now() - t0) / 420) * 10; await wait(30); }
        bob = 0;
        return;
      }
      case 'land': {
        const prev = a.fingers.length > 2 ? ['LI', 'RI'] : a.fingers.length === 2 ? ['LI'] : [];
        pose(prev as Digit[], 0.25);
        if (a.fingers.length <= 2) {
          const f = a.fingers[a.fingers.length - 1], code = HOME_CODE[f as keyof typeof HOME_CODE];
          glow = [code]; bump = [code];
          bubble = { code, ch: byCode.get(code)!.label, shift: false, finger: f, n: (bubble?.n ?? 0) + 1 };
        }
        await wait(700);
        for (const f of a.fingers) {
          if (!alive()) return;
          const d = f as Digit;
          if (prev.includes(d)) continue;
          const code = HOME_CODE[d as keyof typeof HOME_CODE];
          glow = a.fingers.length > 2 ? [...glow, code] : glow;
          tip[d].up.target = 0;
          await wait(170);
          press(code, f);
          await wait(140);
          release(code);
          await wait(a.fingers.length > 2 ? 260 : 400);
        }
        if (a.fingers.length > 2) lift.target = 0;
        return;
      }
      case 'thumbs': {
        pose(EIGHT, 0);
        glow = ['Space'];
        await wait(500);
        for (const d of THUMBS) { tip[d].up.target = 0; await wait(260); }
        while (alive() && !until.done) {
          await tap('RT', 'Space', alive, false);
          await wait(420);
          await tap('LT', 'Space', alive, false);
          await wait(700);
        }
        return;
      }
      case 'wave': {
        pose([...EIGHT, ...THUMBS], 0);
        glow = EIGHT.map(d => HOME_CODE[d as keyof typeof HOME_CODE]);
        await wait(300);
        while (alive() && !until.done) {
          for (const d of EIGHT) { if (!alive()) return; tip[d].up.target = 0.8; setTimeout(() => (tip[d].up.target = 0), 170); await wait(95); }
          await wait(650);
        }
        return;
      }
      case 'pals': {
        pose([...EIGHT, ...THUMBS], 0);
        await wait(300);
        for (const d of [...EIGHT.slice(0, 4), 'RT' as Digit, ...EIGHT.slice(4)]) {
          if (!alive()) return;
          pals = [...pals, d];
          tip[d].up.target = 0.5; setTimeout(() => (tip[d].up.target = 0), 160);
          sfx.pop();
          await wait(380);
        }
        return;
      }
      case 'blind': {
        pose([...EIGHT, ...THUMBS], 0);
        await wait(250);
        blind = true;
        await wait(600);
        while (alive() && !until.done) {
          for (const k of a.keys) { if (!alive() || until.done) break; await tap(digitOf(k.finger), k.code, alive, false); await wait(260); }
        }
        return;
      }
      case 'cheer': {
        pose([...EIGHT, ...THUMBS], 0);
        await wait(300);
        for (let i = 0; i < 2 && alive(); i++) {
          for (const d of EIGHT) tip[d].up.target = 0.7;
          await wait(170);
          for (const d of EIGHT) tip[d].up.target = 0;
          await wait(80);
          for (const d of EIGHT) press(HOME_CODE[d as keyof typeof HOME_CODE], fingerOf(d));
          await wait(180);
          down = {};
          await wait(260);
        }
        if (alive()) { lift.target = 1; sfx.cheer(); }
        return;
      }
      case 'reach': {
        pose([...EIGHT, ...THUMBS], 0);
        await wait(350);
        do {
          for (const k of a.keys) { if (!alive()) return; await reachOnce(k, alive, a.keys.length <= 2 ? 2 : 1); }
        } while (alive() && !until.done);
        bubble = null; glow = [];
        return;
      }
    }
  }

  async function run(i: number) {
    const my = ++token;
    const alive = () => token === my && !closed;
    stepI = i;
    const step = steps[i];
    const until = { done: false };
    const voiceOn = game.settings.sound && game.settings.voice !== false;
    const text = lineText(step.line);
    const spoken = say(step.line, { important: true, caption: false });
    // a floor on reading time, in case the voice is off or can't play
    Promise.all([spoken, wait(text.length * (voiceOn ? 48 : 58) + 900)]).then(() => (until.done = true));
    await Promise.all([act(step.act, alive, until), spoken]);
    while (alive() && !until.done) await wait(100);
    await wait(500);
    if (!alive()) return;
    if (i + 1 < steps.length) run(i + 1);
    else finish(false);
  }
  function next() { hush(); if (stepI + 1 < steps.length) run(stepI + 1); else finish(false); }
  function back() { hush(); if (stepI > 0) run(stepI - 1); }
  function finish(skipped: boolean) {
    if (closed) return;
    closed = true; token++;
    hush();
    onDone(skipped);
  }

  function onKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); finish(true); }
    else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  }

  let stop: (() => void) | undefined;
  onMount(() => {
    window.addEventListener('keydown', onKey, true);
    stop = onFrame(dt => {
      for (const d of DIGITS) { tip[d].x.step(dt); tip[d].y.step(dt); tip[d].up.step(dt); }
      for (const h of [hand.L, hand.R]) { h.x.step(dt); h.y.step(dt); }
      enter.step(dt); lift.step(dt);
      F = computeFrame();
    });
    run(0);
  });
  onDestroy(() => { closed = true; token++; stop?.(); window.removeEventListener('keydown', onKey, true); hush(); });

  // overlay helpers: SVG units to percent of the stage box
  const px = (x: number) => ((x - VB.x) / VB.w) * 100;
  const py = (y: number) => ((y - VB.y) / VB.h) * 100;
  const skin = $derived(look === 'ink' ? '#fffaf4' : '#fff7fb');
  const edge = $derived(look === 'ink' ? '#2d2340' : '#bea9e4');
  /** outline thickness: soft and light, a touch firmer in the ink look */
  const line = $derived(look === 'ink' ? 5 : 4.5);
  /** the Keypal-coloured nail: an oval lying along the finger, just short of the tip */
  const nailOf = (d: Digit) => {
    const t = F.tips[d], b = F.bases[d], rb = RAD[d[1]][1];
    const ux = t.x - b.x, uy = t.y - b.y, len = Math.hypot(ux, uy) || 1;
    const x = t.x - (ux / len) * rb * 0.12, y = t.y - (uy / len) * rb * 0.12;
    return { x, y, rx: rb * 0.6, ry: rb * 0.72, rot: (Math.atan2(uy, ux) * 180) / Math.PI + 90 };
  };
  /** a little knuckle crease across each finger, bowed toward the tip */
  const crease = (d: Digit) => {
    const t = F.tips[d], b = F.bases[d], [ra, rb] = RAD[d[1]], at = d[1] === 'T' ? 0.36 : 0.5;
    const dx = b.x - t.x, dy = b.y - t.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const mx = t.x + dx * at, my = t.y + dy * at, half = (rb + (ra - rb) * at) * 0.42;
    return `M${f1(mx - uy * half)},${f1(my + ux * half)}Q${f1(mx - ux * 6)},${f1(my - uy * 6)} ${f1(mx + uy * half)},${f1(my - ux * half)}`;
  };
  const bubbleBox = $derived.by(() => {
    if (!bubble) return null;
    const k = byCode.get(bubble.code)!;
    return { x: k.cx, y: Math.max(VB.y + 70, k.y - 70) };
  });
</script>

<div class="coach-wrap" role="dialog" aria-label={title}>
  <div class="coach card">
    <div class="head">
      <span class="badge"><Icon name="cap" size={34} /></span>
      <h2>{title}</h2>
      <div class="dots">{#each steps as _, i}<i class:on={i === stepI} class:past={i < stepI}></i>{/each}</div>
    </div>
    <div class="stage">
      <svg viewBox="{VB.x} {VB.y} {VB.w} {VB.h}" aria-hidden="true">
        <rect x="-26" y="-22" width="1552" height="545" rx="34" fill="#f4effb" stroke="#e4d9f3" stroke-width="4" />
        {#each keys as k (k.code)}
          {@const isGlow = glow.includes(k.code)}
          <g class="key" class:down={down[k.code]} class:glow={isGlow}>
            <rect x={k.x + 5} y={k.y + 9} width={k.w - 10} height={U - 10} rx="16" fill="#d9cdea" />
            <rect class="cap" x={k.x + 5} y={k.y + 4} width={k.w - 10} height={U - 12} rx="16" fill={isGlow ? friendCol(k.finger) : keyFill(k)} />
            {#if isGlow}<rect class="ring" x={k.x + 1} y={k.y} width={k.w - 2} height={U - 4} rx="19" fill="none" stroke={friendCol(k.finger)} stroke-width="5" />{/if}
            <text class="lbl" class:small={k.label.length > 1} class:hide={blind && !k.special} x={k.cx} y={k.cy + (k.label.length > 1 ? 4 : 10)} fill={isGlow ? '#fff' : '#4a3b63'}>{k.label}</text>
            {#if k.code === 'KeyF' || k.code === 'KeyJ'}
              <rect class="bump" class:pulse={bump.includes(k.code)} x={k.cx - 14} y={k.y + U - 30} width="28" height="6" rx="3" fill={isGlow ? '#fff' : '#8f7fb0'} />
            {/if}
          </g>
        {/each}
        {#each ripples as r (r.id)}<circle class="ripple" cx={r.x} cy={r.y} r="60" fill="none" stroke="#fff" stroke-width="8" />{/each}

        {#each ['L', 'R'] as sd (sd)}
          {@const h = sd as 'L' | 'R'}
          {@const ds = DIGITS.filter(d => side(d) === sd)}
          {@const palmAt = `translate(${f1(F.off[h].x)} ${f1(F.off[h].y)})`}
          {@const to = 1 + F.ups[(h + 'T') as Digit] * 1.2 + F.lift * 1.8}
          <g class="shadow" opacity={0.1 + F.lift * 0.03}>
            <path d={PALM_D[h]} fill="#4b2f80" transform="translate({f1(F.off[h].x + 10 + F.lift * 18)} {f1(F.off[h].y + 14 + F.lift * 34)})" />
            <path d={F.shape[(h + 'T') as Digit]} fill="#4b2f80" transform="translate({f1(10 * to)} {f1(14 * to)})" />
            {#each ds.filter(d => d[1] !== 'T') as d}
              {@const o = 1 + F.ups[d] * 2.2 + F.lift * 1.8}
              <line x1={F.bases[d].x + 10 + F.lift * 18} y1={F.bases[d].y + 14 + F.lift * 34} x2={F.tips[d].x + 10 * o} y2={F.tips[d].y + 14 * o} stroke="#4b2f80" stroke-width={RAD[d[1]][0] + RAD[d[1]][1]} stroke-linecap="round" />
            {/each}
          </g>
          <!-- outlines first, then the skin over them, so only the outside edge of the whole hand shows -->
          <g class="hand" opacity="0.84">
            <path d={PALM_D[h]} transform={palmAt} fill={edge} stroke={edge} stroke-width={line * 2} stroke-linejoin="round" />
            {#each ds as d}<path d={F.shape[d]} fill={edge} stroke={edge} stroke-width={line * 2} stroke-linejoin="round" />{/each}
            <path d={PALM_D[h]} transform={palmAt} fill={skin} />
            {#each ds as d}<path d={F.shape[d]} fill={skin} />{/each}
            {#each ds as d}<path d={crease(d)} fill="none" stroke={edge} stroke-width="3.5" stroke-linecap="round" opacity=".55" />{/each}
            {#each ds as d}
              {@const n = nailOf(d)}
              <g transform="rotate({f1(n.rot)} {f1(n.x)} {f1(n.y)})">
                <ellipse cx={n.x} cy={n.y} rx={n.rx} ry={n.ry} fill={friendCol(fingerOf(d))} />
                <ellipse cx={n.x - n.rx * 0.32} cy={n.y - n.ry * 0.3} rx={n.rx * 0.26} ry={n.ry * 0.34} fill="#fff" opacity=".6" />
              </g>
            {/each}
          </g>
        {/each}

        {#if bubble && bubbleBox}
          {#key bubble.n}
            <g class="bubble" style:transform-origin="{bubbleBox.x}px {bubbleBox.y + 60}px">
              <path d="M{bubbleBox.x - 70},{bubbleBox.y - 70} h140 a26,26 0 0 1 26,26 v62 a26,26 0 0 1 -26,26 h-50 l-20,26 l-20,-26 h-50 a26,26 0 0 1 -26,-26 v-62 a26,26 0 0 1 26,-26 z" fill="#fff" stroke={friendCol(bubble.finger)} stroke-width="6" />
              <text class="big" x={bubbleBox.x + (bubble.shift ? 26 : 0)} y={bubbleBox.y + 10} fill="#3b2d55">{bubble.ch}</text>
              {#if bubble.shift}<text class="tag" x={bubbleBox.x - 44} y={bubbleBox.y + 2} fill="#7a6a98">shift</text>{/if}
            </g>
          {/key}
        {/if}
      </svg>
      {#each pals as d (d)}
        <div class="pal-tip" style:left="{px(F.tips[d].x)}%" style:top="{py(F.tips[d].y - 30)}%" style:--fc={friendCol(fingerOf(d))}></div>
      {/each}
    </div>
    <p class="line">{lineText(steps[stepI]?.line ?? '')}</p>
    <div class="actions">
      <button class="btn" onclick={() => finish(true)}>Skip <span class="kbd">esc</span></button>
      <div class="grow"></div>
      {#if stepI > 0}<button class="btn" onclick={back}>Back</button>{/if}
      <button class="btn btn-primary" onclick={next}>{stepI + 1 < steps.length ? 'Next' : "Let's go!"} <span class="kbd">enter</span></button>
    </div>
  </div>
</div>

<style>
  .coach-wrap { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; background: rgba(60, 40, 110, .28); backdrop-filter: blur(3px); padding: 16px; }
  .coach { width: min(1040px, 100%, calc((100vh - 250px) * 1.816)); padding: 16px 20px 16px; animation: pop-in .35s cubic-bezier(.3, .8, .4, 1.3); }
  .head { display: flex; align-items: center; gap: 10px; }
  .head h2 { font-size: 24px; }
  .badge { line-height: 0; }
  .dots { margin-left: auto; display: flex; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; background: #e4dcf2; transition: background .2s, transform .2s; }
  .dots i.past { background: #c4b3ea; }
  .dots i.on { background: var(--primary); transform: scale(1.3); }
  .stage { position: relative; width: 100%; aspect-ratio: 1580 / 870; margin-top: 6px; overflow: hidden; border-radius: 20px; background: linear-gradient(#fbf8ff, #f3ecfc); }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  @supports not (aspect-ratio: 1) { .stage { height: 0; padding-bottom: 55.06%; } }
  .key .cap { transition: transform .08s, fill .2s; }
  .key.down .cap { transform: translateY(5px); }
  .key.glow .ring { animation: ring 1s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
  @keyframes ring { 50% { opacity: .35; transform: scale(1.06); } }
  .lbl { font: 600 40px var(--font-ui); text-anchor: middle; transition: opacity .4s; }
  .lbl.small { font-size: 24px; }
  .lbl.hide { opacity: 0; }
  .bump.pulse { animation: bump .6s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center; }
  @keyframes bump { to { transform: scale(1.6, 1.8); fill: #fff; } }
  .ripple { animation: ripple .6s ease-out forwards; transform-box: fill-box; transform-origin: center; }
  @keyframes ripple { from { transform: scale(.3); opacity: .9; } to { transform: scale(1.4); opacity: 0; } }
  .bubble { animation: bub .35s cubic-bezier(.3, .8, .4, 1.5); }
  @keyframes bub { from { transform: scale(.3); opacity: 0; } }
  .big { font: 700 74px var(--font-ui); text-anchor: middle; }
  .tag { font: 700 26px var(--font-body); text-anchor: middle; }
  .pal-pop { position: absolute; transform: translate(-50%, -100%); pointer-events: none; animation: appear .2s ease; }
  .pal-tip { position: absolute; width: 22px; height: 22px; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; background: radial-gradient(circle, #fff 0 30%, var(--fc) 32% 62%, transparent 64%); box-shadow: 0 0 12px var(--fc); animation: appear .2s ease; }
  .line { margin: 10px 4px 8px; font: 600 clamp(17px, 2.3vh, 21px)/1.35 var(--font-body); color: var(--ink); min-height: 2.7em; text-align: center; }
  .actions { display: flex; align-items: center; gap: 10px; }
  .grow { flex: 1; }
</style>
