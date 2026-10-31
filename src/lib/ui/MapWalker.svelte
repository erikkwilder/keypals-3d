<script lang="ts">
  // The Adventure map you walk round, Super Mario World style. The painted map of a world, a little bigger
  // than the screen and following your buddy; dotted trails between the stops (adventure/trails.ts), two
  // routes on every island that meet again before the Champion, and side trails to a treasure chest, a
  // Bonus Round and a spot hidden behind a bush or a waterfall that shows when you walk close. Your buddy
  // walks it in 3D (three/walker.ts): the arrow keys or W A S D, the stick on a phone or tablet, or tap a
  // stop to walk there by itself. It stops at every stop and fork, hops at a fork, runs when you keep
  // pushing, and stands at a little gate in front of a stop that isn't open yet. Enter (or a tap on the
  // stop) opens it.
  // On the Journey trail (`journey`, path/journey.ts) the same map and the same walking show a stretch of the
  // child's math unit: small stops on the world's own main route instead of its battles, one lit. Walking to
  // the lit stop starts it; stops ahead wait; the side trails to chests and Bonus Rounds stay open.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { game } from '../state/game.svelte';
  import { sfx } from '../audio/sound';
  import { advView, playRules, cleared, currentNode, ISLAND, islandsOf, NODE, nodeOpen, practiceDone, type MapNode, type WorldId } from '../adventure/state';
  import { mapOf } from '../adventure/worlds';
  import { along, findId, legPoints, other, px, type MapKind, type Pt, type TrailPoint } from '../adventure/trails';
  import { ctxOf, legOf, locked, pickTrail, reach, reachable, route, startPoint, usable, type Leg } from '../adventure/walk';
  import { collectHidden, findDone, hiddenFound, openChest, revealHidden, saveWalk, type FindPrize } from '../adventure/finds';
  import { MapWalker, FOOT_AT } from '../three/walker';
  import Icon from './Icon.svelte';
  import Confetti from './Confetti.svelte';
  import BonusRound from './BonusRound.svelte';
  import { STOP_ICON, STOP_WORD, type Journey, type TrailStop } from '../path/journey';

  type Props = { world: WorldId; kind: MapKind; tall: boolean; paused?: boolean; onopen: (n: MapNode) => void; journey?: Journey | null; onstop?: (s: TrailStop) => void; noFinds?: boolean };
  let { world, kind, tall, paused = false, onopen, journey = null, onstop, noFinds = false }: Props = $props();

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const a = $derived({ ...advView(p), settings: playRules.of(p) });
  const wmap = $derived(mapOf(world));
  const size = $derived(wmap.size[kind]);
  const ctx = $derived(ctxOf(world, kind, size, a, journey?.walk));
  const tr = $derived(ctx.tr);
  /** where the buddy could walk from the first stop: trails beyond are shown faint, gates on their edge */
  const home = $derived(reachable(ctx, journey?.start ?? tr.points.find(q => q.kind === 'stop')!.id));
  /** the stop standing on a trail point, on the Journey trail */
  const stopOn = (id: string) => journey?.stretch.find(s => s.at === id) ?? null;
  const cur = $derived(currentNode(a, world));
  /** the stops open and not won yet: "Next!" (both branch battles at once) */
  const nexts = $derived(new Set(tr.points.filter(q => q.kind === 'stop' && nodeOpen(a, NODE[q.id]) && !(NODE[q.id].kind === 'practice' ? practiceDone(a, q.id) : cleared(a, q.id))).map(q => q.id)));

  // ---------- the map's size and the camera ----------
  let view: HTMLDivElement | undefined = $state();
  let mapEl: HTMLDivElement | undefined = $state();
  let cv: HTMLCanvasElement | undefined = $state();
  let bubbleEl: HTMLButtonElement | undefined = $state();
  let vw = $state(800), vh = $state(600);
  /** how much bigger than covering the screen: the Sky Islands (three islands) more, so the buddy is big
   *  enough on the map and there is somewhere to walk to */
  const ZOOM: Partial<Record<WorldId, Record<MapKind, number>>> = {
    sky: { wide: 1.4, tall: 1.3 }, falls: { wide: 1.12, tall: 1.2 }, caves: { wide: 1.12, tall: 1.2 }, market: { wide: 1.12, tall: 1.2 },
    clockwork: { wide: 1.12, tall: 1.2 }, peaks: { wide: 1.12, tall: 1.2 }, jungle: { wide: 1.12, tall: 1.2 }, frost: { wide: 1.12, tall: 1.2 }, fair: { wide: 1.12, tall: 1.2 }, stars: { wide: 1.12, tall: 1.2 },
  };
  // (a view not laid out yet has no size: never a scale of 0, or a step would be infinitely long)
  const scale = $derived(Math.max(0.05, Math.max(vw / size[0], vh / size[1]) * (ZOOM[world]?.[kind] ?? 1.15)));
  const mw = $derived(size[0] * scale), mh = $derived(size[1] * scale);
  const cam = { x: 0, y: 0, ready: false };
  const bud = { w: 136, h: 156 };

  // ---------- where the buddy is ----------
  /** resting at a trail point, or on a trail (moving, or stopped at a gate) */
  let at: string | null = null;
  let leg: Leg | null = null, d = 0, moving = false;
  /** a tapped stop's way there, and the stop to open when it gets there */
  let plan: Leg[] = [], goal: string | null = null;
  let heldT = 0, restT = 0, bumped = false;
  /** the point it rests on (for the bubble and the Next! glow) */
  let here = $state<string | null>(null);
  let walked = $state(false);
  let walker: MapWalker | null = null;
  let shown = '';

  function pos(): Pt {
    if (leg) return along(tr, leg.e, leg.from, d, kind, size).at;
    return px(tr.point[at ?? tr.points[0].id].at[kind], size);
  }
  function place(id: string) { at = id; leg = null; d = 0; moving = false; plan = []; goal = null; here = id; }
  function init() {
    place(journey?.start ?? startPoint(ctx, world));
    cam.ready = false; shown = viewKey();
  }
  /** what's on show: a new one puts the buddy back on its start */
  const viewKey = () => `${world}|${kind}|${journey?.key ?? ''}`;

  // ---------- input ----------
  type Dir = 'up' | 'down' | 'left' | 'right';
  const KEYDIR: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const held = new Set<Dir>();
  let stick = $state<{ x: number; y: number } | null>(null);
  const touchy = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const showStick = $derived(touchy || tall);
  function push(): { v: Pt; run: boolean } | null {
    if (stick) { const m = Math.hypot(stick.x, stick.y); if (m > 0.3) return { v: [stick.x / m, stick.y / m], run: m > 0.88 }; }
    const x = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0), y = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
    if (!x && !y) return null;
    const m = Math.hypot(x, y);
    return { v: [x / m, y / m], run: false };
  }
  function busy() { return paused || bonus !== null || game.modalOpen; }
  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (busy() || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    const dir = KEYDIR[e.code];
    if (dir) { e.preventDefault(); held.add(dir); return; }
    if ((e.key === 'Enter' || e.key === ' ') && journey?.lit) { e.preventDefault(); if (!moving) goLit(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && here && !moving) { e.preventDefault(); act(here, true); }
  }
  function keyUp(e: KeyboardEvent) { const dir = KEYDIR[e.code]; if (dir) held.delete(dir); }

  // the stick: drag from its middle
  let stickEl: HTMLDivElement | undefined = $state();
  function stickAt(e: PointerEvent) {
    const r = stickEl!.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - r.left - R) / R, y = (e.clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    stick = { x, y };
  }
  function stickDown(e: PointerEvent) { e.preventDefault(); stickEl!.setPointerCapture(e.pointerId); stickAt(e); }
  function stickMove(e: PointerEvent) { if (stick) stickAt(e); }
  function stickUp() { stick = null; }

  // ---------- walking ----------
  function startLeg(l: Leg) {
    leg = l; d = 0; at = null; here = null; moving = true; walked = true; bumped = false;
  }
  /** turn round on the trail */
  function reverse() {
    if (!leg) return;
    const back = legOf(ctx, leg.e, leg.to);
    const dd = leg.len - d;
    leg = back; d = Math.max(0, dd); moving = true; plan = []; goal = null; bumped = false;
  }
  /** a stop's or a find's own thing: open its card, open the chest... (`keys`: asked with Enter) */
  function act(id: string, keys = false) {
    const pt = tr.point[id];
    if (!pt) return;
    if (journey) {
      const s = stopOn(id);
      if (s?.lit) { sfx.pop(); onstop?.(s); return; }
    } else if (pt.kind === 'stop') { save(); onopen(NODE[id]); return; }
    if (pt.kind === 'chest') { chest(pt); return; }
    if (pt.kind === 'hidden') { hidden(pt); return; }
    if (pt.kind === 'bonus') { bonusAsk(pt); return; }
    void keys;
  }
  function arrive(id: string, byTap: boolean) {
    place(id);
    const pt = tr.point[id], forks = (tr.out[id] ?? []).filter(e => usable(ctx, e)).length;
    restT = 0.32;
    // a hidden spot nearby shows itself when you get to the place its trail leaves from
    for (const e of tr.out[id] ?? []) if (e.hidden && !hiddenFound(a, e.b)) reveal(tr.point[e.b]);
    if (pt.kind === 'chest' || pt.kind === 'hidden' || pt.kind === 'bonus') { act(id); return; }
    // (walking to the lit stop starts it, by tap, keys or stick)
    if (journey ? stopOn(id)?.lit : byTap && pt.kind === 'stop') { act(id); return; }
    if (forks >= 3 || pt.kind === 'join') walker?.hop();
    if (pt.kind === 'stop') sfx.pop();
  }
  /** the gate: it won't open yet */
  function bump() {
    walker?.bump(); sfx.nope();
    if (!bumped) { bumped = true; game.say(journey ? 'Go to the glowing stop first!' : leg && NODE[leg.to] ? `${gateWhy(leg.to)}` : 'Not open yet!'); }
  }
  function gateWhy(id: string) {
    const n = NODE[id], isl = ISLAND[n.island];
    return n.n === 0 ? `Cheer up the Champion first, and ${isl.name} opens!` : n.kind === 'champion' ? 'Win both battles on the way here, and the Champion comes out!' : 'Win the stops before this one first!';
  }

  function tick(dt: number) {
    if (shown !== viewKey()) init();
    const go = busy() ? null : push();
    restT = Math.max(0, restT - dt);
    if (go) {
      heldT += dt; plan = []; goal = null;
      if (!moving && restT <= 0) {
        if (at) { const e = pickTrail(ctx, at, go.v); if (e) startLeg(legOf(ctx, e, at)); }
        else if (leg) {
          // standing at a gate: back the way it came, or a bump
          const dir = along(tr, leg.e, leg.from, d, kind, size).dir, dot = dir[0] * go.v[0] + dir[1] * go.v[1];
          if (dot < -0.3) reverse(); else if (dot > 0.3 && heldT < 0.1) bump();
        }
      } else if (moving && leg) {
        const dir = along(tr, leg.e, leg.from, d, kind, size).dir;
        if (dir[0] * go.v[0] + dir[1] * go.v[1] < -0.55) reverse();
      }
    } else heldT = 0;
    let speed = 0;
    if (moving && leg) {
      const far = plan.reduce((s, l) => s + l.len, leg.len - d);
      const run = (go ? heldT > 0.45 || go.run : far * scale > 420) ;
      speed = (run ? 320 : 150);
      d += (speed / scale) * dt;
      if (d >= leg.stop) {
        if (leg.stop < leg.len - 0.5) { d = leg.stop; moving = false; plan = []; goal = null; bump(); }
        else {
          const to = leg.to, tapped = goal === to;
          if (plan.length && !go) { const nx = plan.shift()!; at = to; startLeg(nx); d = 0; }
          else arrive(to, tapped);
        }
      }
      // walking close to a hidden spot: a sparkle, and its trail shows
      const me = pos();
      for (const isl of islandsOf(world)) {
        const hid = tr.point[findId(isl.id, 'hidden')];
        // (only once its trail could be walked: no sparkle beyond a gate)
        if (!hid || hiddenFound(a, hid.id) || !home.has(other(tr.out[hid.id][0], hid.id))) continue;
        const hp = px(hid.at[kind], size);
        if (Math.hypot(hp[0] - me[0], hp[1] - me[1]) < 0.19 * Math.min(size[0], size[1])) reveal(hid);
      }
    }
    // the buddy: its gait and the way it faces
    if (walker) {
      const dir = leg ? along(tr, leg.e, leg.from, d, kind, size).dir : null;
      walker.move(moving ? (speed > 200 ? 'run' : 'walk') : 'idle', moving ? dir : null, speed);
    }
  }

  // ---------- a tap on a stop or a find ----------
  function tapPoint(id: string) {
    if (busy()) return;
    if (here === id && !moving) { act(id); return; }
    const pt = tr.point[id];
    if (pt.kind === 'stop' && locked(ctx, id)) game.say(gateWhy(id));
    // from where it stands: a point, or part way along a trail (either way back to its ends)
    const opts: { cost: number; legs: Leg[] }[] = [];
    if (at) { const r = route(ctx, at, id); if (r) opts.push({ cost: r.reduce((s, l) => s + l.stop, 0), legs: r }); }
    else if (leg) {
      const back = legOf(ctx, leg.e, leg.to);
      const rb = route(ctx, leg.from, id);
      if (rb) opts.push({ cost: d + rb.reduce((s, l) => s + l.stop, 0), legs: [{ ...back, _d: leg.len - d } as Leg & { _d: number }, ...rb] });
      if (leg.stop >= leg.len - 0.5) { const rf = route(ctx, leg.to, id); if (rf) opts.push({ cost: leg.len - d + rf.reduce((s, l) => s + l.stop, 0), legs: [{ ...leg, _d: d } as Leg & { _d: number }, ...rf] }); }
      if (leg.to === id || leg.from === id) { /* covered above */ }
    }
    if (!opts.length) { sfx.nope(); return; }
    opts.sort((x, y) => x.cost - y.cost);
    const legs = opts[0].legs;
    if (!legs.length) { act(id); return; }
    sfx.click(); walked = true;
    const first = legs.shift()! as Leg & { _d?: number };
    startLeg(first); d = first._d ?? 0;
    plan = legs; goal = id;
  }

  /** a tap on a stop on the Journey trail: the lit one, or a word about the others */
  function tapStop(s: TrailStop) {
    if (busy()) return;
    if (s.lit) { tapPoint(s.at); return; }
    sfx.pop();
    game.say(s.done ? `Done: ${s.name}` : `Coming up: ${s.name}. Go to the glowing stop first!`);
  }
  /** Walk to the lit stop (the big button under the map): getting there starts it. */
  export function goLit() { if (journey?.lit) tapPoint(journey.lit.at); }

  // ---------- finds ----------
  let prize = $state<{ title: string; text: string; img: string; egg: string | null } | null>(null);
  let prizeTimer = 0;
  let burst = $state(0);
  function showPrize(title: string, f: FindPrize) {
    const eggTxt = f.egg ? ' and an egg!' : f.eggFull ? ' (your nest is full, so 15 more shells)' : '!';
    prize = { title, text: `+${f.shells} shells${eggTxt}`, img: f.kind === 'chest' ? `${base}game/chest-open.webp` : `${base}treasures/${f.treasure}.webp`, egg: f.egg ? `${base}game/egg-${f.egg.rarity}.webp` : null };
    burst++; walker?.cheer();
    clearTimeout(prizeTimer); prizeTimer = window.setTimeout(() => (prize = null), 3600);
  }
  function chest(pt: TrailPoint) {
    let f: FindPrize | null = null;
    game.update(pp => { f = openChest(pp, pt.island); });
    if (!f) { sfx.pop(); game.say('The chest is empty today. It fills up again tomorrow!'); return; }
    sfx.treasure(5);
    showPrize('A treasure chest!', f);
  }
  function reveal(pt: TrailPoint) {
    let fresh = false;
    game.update(pp => { fresh = revealHidden(pp, pt.island); });
    if (fresh) { sfx.sparkle(); walker?.hop(); game.say('Something sparkles over there!'); }
  }
  function hidden(pt: TrailPoint) {
    let f: FindPrize | null = null;
    game.update(pp => { f = collectHidden(pp, pt.island); });
    if (!f) { sfx.pop(); game.say('You found this secret spot already today. Come back tomorrow!'); return; }
    sfx.secret();
    showPrize((f as FindPrize).first ? 'A secret spot!' : 'The secret spot again!', f);
  }
  let bonus = $state<{ island: TrailPoint['island']; ask: boolean } | null>(null);
  function bonusAsk(pt: TrailPoint) {
    if (findDone(a, pt.id)) { sfx.pop(); game.say('You played this Bonus Round today. Come back tomorrow for another!'); return; }
    sfx.pop(); bonus = { island: pt.island, ask: true };
  }

  function save() {
    if (journey) return; // (the trail's place comes from the stops; Free play keeps its own)
    const id = at ?? (leg ? (leg.stop < leg.len - 0.5 || d < leg.len / 2 ? leg.from : leg.to) : null);
    if (id && game.profile) untrack(() => game.update(pp => saveWalk(pp, world, id)));
  }

  // ---------- each frame ----------
  let raf = 0, last = 0;
  /** (dev: how long a frame of ours takes, ms, averaged) */
  let cost = 0;
  function frame(t: number) {
    const c0 = performance.now();
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t;
    // (one bad frame never stops the walking)
    try { tick(dt); } catch (e) { console.warn('walk', e); moving = false; plan = []; }
    if (!Number.isFinite(d)) { d = 0; moving = false; }
    const [bx, by] = pos();
    // the camera: the buddy in the middle, the map's edges never inside the view
    // (on the trail the map can sit lower, so a stop at the very top of a map comes out from under the unit's card)
    const fit = (vSize: number, mSize: number, b: number, pad = 0) => (mSize <= vSize ? (vSize - mSize) / 2 : Math.min(pad, Math.max(vSize - mSize, vSize / 2 - b)));
    const tx = fit(vw, mw, bx * scale), ty = fit(vh, mh, by * scale + (tall ? 0 : 20), journey && tall ? 110 : 0);
    if (!Number.isFinite(cam.x) || !Number.isFinite(cam.y)) cam.ready = false;
    const k = cam.ready ? 1 - Math.exp(-dt * 5) : 1;
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.ready = true;
    if (mapEl) mapEl.style.transform = `translate3d(${cam.x.toFixed(1)}px, ${cam.y.toFixed(1)}px, 0)`;
    dodgeStick();
    if (cv) cv.style.transform = `translate3d(${(bx * scale - bud.w / 2).toFixed(1)}px, ${(by * scale - bud.h * FOOT_AT).toFixed(1)}px, 0)`;
    if (bubbleEl) bubbleEl.style.transform = `translate3d(${(bx * scale).toFixed(1)}px, ${(by * scale - bud.h * 0.62).toFixed(1)}px, 0) translate(-50%, -100%)`;
    walker?.frame(dt);
    if (import.meta.env.DEV) cost = cost * 0.95 + (performance.now() - c0) * 0.05;
    raf = requestAnimationFrame(frame);
  }

  // an island's name that would sit under the stick (the first island's often does, at the bottom
  // left of the map) slides right, just clear of it
  const names = new Set<HTMLElement>();
  function nameEl(el: HTMLElement) { names.add(el); return { destroy() { names.delete(el); } }; }
  function dodgeStick() {
    if (!stickEl || !names.size) return;
    const clear = stickEl.offsetLeft + stickEl.offsetWidth + 8, top = stickEl.offsetTop - 4;
    for (const el of names) {
      const x = (Number(el.dataset.x) / 100) * mw + cam.x, y = (Number(el.dataset.y) / 100) * mh + cam.y, left = x - el.offsetWidth / 2;
      const by = left < clear && y + el.offsetHeight > top ? `${(clear - left).toFixed(0)}px 0` : '';
      if (el.dataset.by !== by) { el.dataset.by = by; el.style.translate = by; }
    }
  }

  function measure() {
    if (!view) return;
    if (!view.clientWidth || !view.clientHeight) return;
    vw = view.clientWidth; vh = view.clientHeight;
    const s = tall ? 0.78 : 1;
    bud.w = Math.round(136 * s); bud.h = Math.round(156 * s);
    if (cv) { cv.style.width = `${bud.w}px`; cv.style.height = `${bud.h}px`; }
    walker?.resize(bud.w, bud.h);
  }
  onMount(() => {
    init();
    measure();
    const ro = new ResizeObserver(measure); if (view) ro.observe(view);
    if (cv) MapWalker.create(cv, game.profile!.buddy, bud.w, bud.h).then(w => { if (disposed) w.dispose(); else walker = w; }).catch(e => console.warn('walker', e));
    raf = requestAnimationFrame(frame);
    if (import.meta.env.DEV) (window as unknown as { __walk: unknown }).__walk = { get at() { return at; }, get leg() { return leg; }, get d() { return d; }, get cost() { return cost; }, tap: tapPoint, act, pos };
    return () => ro.disconnect();
  });
  let disposed = false;
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); clearTimeout(prizeTimer); save(); walker?.dispose(); walker = null; });
  // a different world (the World map): remember where it stood in the last one
  let lastWorld: WorldId | null = null;
  $effect(() => { const w = world; untrack(() => { if (lastWorld && lastWorld !== w) { const id = at ?? leg?.from; if (id) game.update(pp => saveWalk(pp, lastWorld!, id)); } lastWorld = w; }); });

  // ---------- what's drawn ----------
  const pct = (q: Pt) => `left:${q[0]}%;top:${q[1]}%`;
  const lineOf = (pts: Pt[]) => pts.map((q, i) => `${i ? 'L' : 'M'}${((q[0] / 100) * size[0]).toFixed(1)} ${((q[1] / 100) * size[1]).toFixed(1)}`).join(' ');
  // (on the trail, a side trail only shows with its find)
  const isFind = (id: string) => { const k = tr.point[id].kind; return k === 'chest' || k === 'bonus' || k === 'hidden'; };
  const trails = $derived(tr.edges.filter(e => usable(ctx, e) && (!journey || ![e.a, e.b].some(id => isFind(id) && !finds.includes(tr.point[id])))).map(e => ({ id: e.id, d: lineOf(legPoints(tr, e, e.a, kind)), on: journey ? journey.way.has(e.a) || journey.way.has(e.b) : home.has(e.a) && home.has(e.b) })));
  /** a gate on each trail from where you can walk into a stop that isn't open yet */
  const gates = $derived(journey ? [] : tr.edges.flatMap(e => {
    const from = home.has(e.a) && locked(ctx, e.b) ? e.a : home.has(e.b) && locked(ctx, e.a) ? e.b : null;
    if (!from || !usable(ctx, e)) return [];
    const g = along(tr, e, from, reach(ctx, e, from) + 6, kind, size).at;
    return [{ id: e.id, at: [(g[0] / size[0]) * 100, (g[1] / size[1]) * 100] as Pt }];
  }));
  const stops = $derived(tr.points.filter(q => q.kind === 'stop'));
  // (on the trail: the side trails it passes, none past the lit stop; none on a day kept to the path)
  const finds = $derived(noFinds ? [] : tr.points.filter(q => (q.kind === 'chest' || q.kind === 'bonus' || (q.kind === 'hidden' && hiddenFound(a, q.id))) && (!journey || (tr.out[q.id] ?? []).some(e => usable(ctx, e) && home.has(other(e, q.id))))));
  const kindName = { battle: 'Battle', practice: 'Practice', champion: 'Champion' };
  const bubble = $derived.by(() => {
    if (!here || paused || journey) return null;
    const pt = tr.point[here];
    if (pt?.kind !== 'stop') return null;
    const n = NODE[here];
    return n.kind === 'battle' ? `Battle ${n.n + 1}` : kindName[n.kind];
  });
  const sw = $derived(1 / scale);
</script>

<svelte:window onkeydown={onKey} onkeyup={keyUp} onblur={() => { held.clear(); stick = null; }} />

<div class="walk" class:tall bind:this={view}>
  <div class="map" bind:this={mapEl} style:width="{mw}px" style:height="{mh}px" style:background-image="url({base}{wmap[kind]})">
    <svg class="trails" viewBox="0 0 {size[0]} {size[1]}" aria-hidden="true">
      {#each trails as t (t.id)}
        <path class="under" class:off={!t.on} d={t.d} stroke-width={13 * sw} />
        <path class="dots" class:off={!t.on} d={t.d} stroke-width={7 * sw} stroke-dasharray="0 {15 * sw}" />
      {/each}
    </svg>
    {#each gates as g (g.id)}<img class="gate" src="{base}game/gate.webp" alt="" style={pct(g.at)} draggable="false" />{/each}
    {#each journey?.stretch ?? [] as s (s.id)}
      <button class="jstop {s.kind}" class:done={s.done} class:lit={s.lit} class:ahead={!s.done && !s.lit} style={pct(tr.point[s.at].at[kind])} onclick={() => tapStop(s)} aria-label="{STOP_WORD[s.kind]}: {s.name}{s.done ? ' (done)' : s.lit ? ' (next)' : ''}">
        <span class="disc"><img src="{base}{STOP_ICON[s.kind]}" alt="" draggable="false" /></span>
        {#if s.done}<span class="tick"><Icon name="check" size={20} /></span>{/if}
        {#if s.lit}<span class="nx">Next!</span>{/if}
      </button>
    {/each}
    {#each journey ? [] : stops as q (q.id)}
      {@const n = NODE[q.id]}
      {@const done = cleared(a, q.id)}
      {@const ok = nodeOpen(a, n)}
      <button class="node {n.kind}" class:done class:here={cur?.id === q.id} class:next={nexts.has(q.id)} class:locked={!ok} style={pct(q.at[kind])} onclick={() => tapPoint(q.id)} aria-label="{ISLAND[n.island].name}: {n.kind === 'battle' ? `Battle ${n.n + 1}` : kindName[n.kind]}{ok ? '' : ' (locked)'}">
        <img src="{base}game/node-{!ok ? 'lock' : n.kind}.webp" alt="" draggable="false" />
        {#if done && n.kind !== 'practice'}<span class="tick"><Icon name="check" size={24} /></span>{/if}
        {#if n.kind === 'practice' && practiceDone(a, q.id) && !done}<span class="gift"><Icon name="gift" size={28} /></span>{/if}
        {#if n.kind === 'champion' && ok && !done}<span class="crown">Champion</span>{:else if nexts.has(q.id)}<span class="nx">Next!</span>{/if}
      </button>
    {/each}
    {#each finds as q (q.id)}
      {@const today = findDone(a, q.id)}
      <button class="find {q.kind}" class:today style={pct(q.at[kind])} onclick={() => tapPoint(q.id)} aria-label={q.kind === 'chest' ? 'Treasure chest' : q.kind === 'bonus' ? 'Bonus Round' : 'Secret spot'}>
        {#if q.kind === 'chest'}<img src="{base}game/{today ? 'chest-open' : 'chest'}.webp" alt="" draggable="false" />
        {:else if q.kind === 'bonus'}<img src="{base}game/node-bonus.webp" alt="" draggable="false" />{#if today}<span class="tick"><Icon name="check" size={22} /></span>{:else}<span class="nx bonusword">Bonus!</span>{/if}
        {:else}<img class="spark" src="{base}icons/sparkle.webp" alt="" draggable="false" />{/if}
      </button>
    {/each}
    {#each journey ? [] : islandsOf(world).filter(i => tr.point[`${i.id}-0`]) as isl (isl.id)}
      {@const f = tr.point[`${isl.id}-0`].at[kind]}
      <span class="iname" use:nameEl data-x={f[0]} data-y={f[1] + (tall ? 4.2 : 7)} style="left:{f[0]}%;top:{f[1] + (tall ? 4.2 : 7)}%">{isl.name}</span>
    {/each}
    <canvas class="buddy" bind:this={cv} aria-hidden="true"></canvas>
    {#if bubble}<button class="bubble" bind:this={bubbleEl} onclick={() => here && act(here)}>{bubble}<small>{touchy ? 'Tap' : 'Enter'}</small></button>{/if}
  </div>

  {#if showStick && !journey}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="stick" bind:this={stickEl} onpointerdown={stickDown} onpointermove={stickMove} onpointerup={stickUp} onpointercancel={stickUp} onlostpointercapture={stickUp} role="presentation" aria-label="Walk">
      <span class="knob" style:transform="translate({(stick?.x ?? 0) * 34}px, {(stick?.y ?? 0) * 34}px)"></span>
    </div>
  {/if}
  {#if !walked && !paused && !journey}<p class="hint">{showStick ? 'Walk with the stick, or tap a stop' : 'Walk with the arrow keys or W A S D, or click a stop'}</p>{/if}

  {#if prize}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prize card" role="status" onclick={() => (prize = null)}>
      <img src={prize.img} alt="" />
      <div><b>{prize.title}</b><span>{prize.text}</span></div>
      {#if prize.egg}<img class="egg" src={prize.egg} alt="" />{/if}
    </div>
  {/if}
  <Confetti {burst} count={46} x={50} y={46} />
</div>

{#if bonus}
  <BonusRound island={bonus.island} onclose={() => { bonus = null; }} />
{/if}

<style>
  .walk { position: absolute; inset: 0; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; }
  .map { position: absolute; left: 0; top: 0; background-size: 100% 100%; will-change: transform; box-shadow: 0 0 60px rgba(255, 255, 255, .25); }
  .trails { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
  .trails path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .trails .under { stroke: rgba(255, 255, 255, .45); filter: drop-shadow(0 1px 1px rgba(80, 50, 20, .35)); }
  .trails .dots { stroke: #fff; filter: drop-shadow(0 0 1.5px rgba(90, 55, 20, .9)); }
  .trails .off { opacity: .45; }
  .trails .dots.off { stroke: #f4eee4; }

  .node { position: absolute; transform: translate(-50%, -62%); width: clamp(46px, 4.2vw, 68px); aspect-ratio: 1; border: 0; padding: 0; background: none; cursor: pointer; transition: transform .15s; z-index: 2; }
  .node img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 6px 6px rgba(60, 30, 10, .4)); pointer-events: none; }
  .node.champion { width: clamp(60px, 5.6vw, 92px); }
  .node:hover { transform: translate(-50%, -68%) scale(1.08); }
  .node.done img { filter: drop-shadow(0 4px 4px rgba(60, 30, 10, .35)) saturate(.8); }
  .node.next img { animation: glow 1.4s ease-in-out infinite; }
  .node.locked img { width: 82%; height: 82%; margin: 9%; }
  @keyframes glow { 50% { filter: drop-shadow(0 0 14px #fff) drop-shadow(0 0 22px #ffd36b); } }
  /* a stop won: its tick on a solid round badge, so it reads on any painting */
  .tick { position: absolute; right: -8px; top: -8px; line-height: 0; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2.5px #2fbf73, 0 3px 0 #1f8f55, 0 6px 12px -4px rgba(40, 20, 10, .55); }
  .tick :global(.ico) { width: 22px; height: 22px; }
  .gift { position: absolute; right: -10px; top: -14px; line-height: 0; animation: hop 1s ease-in-out infinite; }
  @keyframes hop { 50% { translate: 0 -6px; } }
  .crown, .nx { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); font: 800 11px var(--font-body); padding: 2px 8px; border-radius: 999px; white-space: nowrap; pointer-events: none; }
  .crown { color: #7a5200; background: #fff3c4; box-shadow: 0 0 0 2px #ffd36b; }
  .nx { color: #fff; background: var(--primary); box-shadow: 0 0 0 2px #fff; }
  .nx.bonusword { background: #7b3fd6; }

  /* a stop on the Journey trail: a small round marker, plain so the painting stays the picture */
  .jstop { position: absolute; transform: translate(-50%, -62%); width: clamp(44px, 3.9vw, 60px); aspect-ratio: 1; border: 0; padding: 0; background: none; cursor: pointer; z-index: 2; transition: transform .15s; }
  .jstop .disc { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--stop, #7c5cf5), 0 6px 10px -2px rgba(40, 20, 10, .5); box-sizing: border-box; }
  .jstop img { width: 76%; height: 76%; object-fit: contain; pointer-events: none; }
  .jstop.warmup { --stop: #f0a92e; } .jstop.learn { --stop: #f0a92e; } .jstop.try { --stop: #2e9e8e; } .jstop.practice { --stop: #4a8de8; }
  .jstop.quick { --stop: #2e9e6e; } .jstop.battle { --stop: #d9543f; } .jstop.game { --stop: #e2468f; } .jstop.champion { --stop: #e0a21c; width: clamp(56px, 5vw, 76px); }
  .jstop.champion img { width: 100%; height: 100%; }
  .jstop:hover { transform: translate(-50%, -68%) scale(1.06); }
  .jstop.ahead .disc { background: #f3f0f8; box-shadow: 0 0 0 3px rgba(255, 255, 255, .85), 0 4px 8px -2px rgba(40, 20, 10, .4); }
  .jstop.ahead img { filter: grayscale(.75) opacity(.72); }
  .jstop.done .disc { box-shadow: 0 0 0 3px #fff, 0 0 0 5px #2fbf73, 0 4px 8px -2px rgba(40, 20, 10, .45); }
  .jstop.done img { filter: saturate(.7) opacity(.8); }
  .jstop.lit { scale: 1.22; z-index: 4; animation: litin .5s cubic-bezier(.3, .8, .4, 1.6); }
  .jstop.lit .disc { animation: lit 1.4s ease-in-out infinite; }
  @keyframes lit { 50% { box-shadow: 0 0 0 3px #fff, 0 0 0 6px #ffc93d, 0 0 26px 10px rgba(255, 220, 110, .95); } }
  @keyframes litin { from { scale: .6; } }
  :global(:root[data-motion='reduced']) .jstop.lit .disc { animation: none; box-shadow: 0 0 0 3px #fff, 0 0 0 6px #ffc93d, 0 0 22px 8px rgba(255, 220, 110, .9); }
  .jstop .nx { font-size: 12px; margin-top: 3px; }

  .find { position: absolute; transform: translate(-50%, -66%); border: 0; padding: 0; background: none; cursor: pointer; z-index: 2; transition: transform .15s; }
  .find:hover { transform: translate(-50%, -72%) scale(1.08); }
  .find img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; filter: drop-shadow(0 5px 5px rgba(60, 30, 10, .4)); }
  .find.chest { width: clamp(42px, 3.8vw, 60px); aspect-ratio: 1.15; }
  .find.chest:not(.today) img { animation: wiggle 2.6s ease-in-out infinite; }
  @keyframes wiggle { 0%, 80%, 100% { rotate: 0deg; } 85% { rotate: -6deg; } 90% { rotate: 6deg; } 95% { rotate: -3deg; } }
  .find.today img { opacity: .62; filter: saturate(.6); }
  .find.bonus { width: clamp(44px, 4vw, 64px); aspect-ratio: 1; }
  .find.bonus:not(.today) img { animation: glowp 1.6s ease-in-out infinite; }
  @keyframes glowp { 50% { filter: drop-shadow(0 0 12px #fff) drop-shadow(0 0 20px #c79bff); } }
  .find.hidden { width: clamp(36px, 3.2vw, 50px); aspect-ratio: 1; }
  .find.hidden .spark { animation: twinkle 1.2s ease-in-out infinite; }
  .find.hidden.today .spark { animation: none; opacity: .5; }
  @keyframes twinkle { 50% { transform: scale(1.18) rotate(12deg); filter: drop-shadow(0 0 10px #fff); } }

  .gate { position: absolute; width: clamp(70px, 6vw, 96px); transform: translate(-50%, -70%); pointer-events: none; z-index: 2; filter: drop-shadow(0 4px 4px rgba(60, 30, 10, .4)); }
  .iname { position: absolute; transform: translateX(-50%); font: 600 clamp(14px, 1.5vw, 20px) var(--font-ui); color: #fff; text-shadow: 0 2px 6px rgba(60, 30, 10, .85); white-space: nowrap; pointer-events: none; z-index: 1; }
  .buddy { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 3; }
  .bubble { position: absolute; left: 0; top: 0; z-index: 4; display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; font: 600 16px var(--font-ui); color: var(--ink); background: #fff; border-radius: 999px; padding: 4px 6px 4px 14px; box-shadow: 0 0 0 3px #ffd36b, 0 6px 14px -6px rgba(40, 20, 10, .6); white-space: nowrap; animation: pop .3s cubic-bezier(.3, .8, .4, 1.4); }
  .bubble small { font: 800 11px var(--font-body); color: #fff; background: var(--primary); border-radius: 999px; padding: 2px 8px; }
  @keyframes pop { from { scale: .6; opacity: 0; } }

  .stick { position: absolute; left: 14px; bottom: 14px; width: 112px; height: 112px; border-radius: 50%; z-index: 5; background: radial-gradient(circle, rgba(255, 255, 255, .55), rgba(255, 255, 255, .3)); box-shadow: 0 0 0 3px rgba(255, 255, 255, .85), 0 8px 20px -8px rgba(40, 20, 60, .5); display: grid; place-items: center; touch-action: none; }
  .knob { width: 50px; height: 50px; border-radius: 50%; background: radial-gradient(circle at 40% 35%, #fff, #ffe7a1 60%, #ffc93d); box-shadow: 0 4px 10px rgba(80, 50, 0, .45), inset 0 -3px 0 rgba(200, 120, 0, .35); pointer-events: none; }
  .tall .stick { width: 100px; height: 100px; left: 10px; bottom: 10px; }
  .hint { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); margin: 0; z-index: 4; pointer-events: none; font: 700 14px var(--font-body); color: #fff; background: rgba(40, 30, 60, .6); padding: 5px 14px; border-radius: 999px; white-space: nowrap; }
  .tall .hint { top: 76px; font-size: 12.5px; }
  .prize { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); z-index: 8; display: flex; align-items: center; gap: 12px; padding: 10px 18px 10px 10px; cursor: pointer; animation: pop .35s cubic-bezier(.3, .8, .4, 1.4); box-shadow: 0 0 0 3px #ffd36b, 0 12px 30px -10px rgba(40, 20, 60, .6); }
  .prize img { width: 76px; height: 76px; object-fit: contain; }
  .prize img.egg { width: 54px; height: 64px; }
  .prize b { display: block; font: 600 22px var(--font-ui); color: var(--ink); }
  .prize span { font: 700 16px var(--font-body); color: #a86a00; }
  .tall .prize { top: 12%; width: max-content; max-width: 92vw; }
</style>
