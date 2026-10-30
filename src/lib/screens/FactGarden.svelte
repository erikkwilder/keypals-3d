<script lang="ts">
  // The Fact Garden, in 3D: a garden island with four plots (plus, take away, times, share). Each fact
  // is a plant in a raised bed, one bed for each row of the table: a seed, a sprout, a bud, then a flower
  // in bloom. A glow at a plant's foot is its latest answer (green quick, gold slow, pink missed) and a
  // water drop floats over one due a check-up. Tap a plant to see exactly where it stands and why; tap a
  // bed's chip (or the arrows) to look at that bed up close. Plants that grew since the last visit pop
  // up one after another. It's also the grown-ups' view of what a child knows. The skill areas (fractions
  // first) get plots of their own beside the four: a bed for each skill, a plant for each kind of question.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { GardenScene, type GPlot } from '../three/gardenScene';
  import { sfx } from '../audio/sound';
  import { factId, partnerOf, isRuleFact, avgThink, isDue, opSign, answerOf, FAST_MS, BLOOM_DAYS, type Fact, type Op, type Stage } from '../math/facts';
  import { ALL_GARDEN_IDS, GARDEN_BY_OP, mathOf, stageCounts } from '../math/progress';
  import { MATH_REGIONS, STRANDS, STRAND, groupFacts } from '../math/course';
  import { iconUrl } from '../art/icons';
  import CloseButton from '../ui/CloseButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import NavTile from '../ui/NavTile.svelte';
  import MenuButton from '../ui/MenuButton.svelte';
  import { mulberry32 } from '../engine/rng';
  import { AREA, AREAS, SKILL, skillsOf, splitKey } from '../math/skills/registry';
  import { makeAt, pitch, TARGET } from '../math/skills/ability';
  import { SKILL_REGIONS } from '../math/skills/course';
  import { skillMem } from '../math/skills/progress';
  import type { AreaId } from '../math/skills/types';
  import SkillPrompt from '../math/skills/ui/SkillPrompt.svelte';

  const base = import.meta.env.BASE_URL;
  const pic = (n: string) => `${base}garden/${n}.webp`;
  const STAGE_PIC = [pic('seed'), pic('sprout'), pic('bud'), iconUrl('bloom')];
  const STAGE_WORD = ['Seed', 'Sprout', 'Bud', 'Bloom'];
  const p = $derived(game.profile!);
  const m = $derived(mathOf(p));
  let op = $state<Op>(mathOf(game.profile!).strand ?? 'x');
  // the skill areas' plots (after the four fact plots), and the one showing (null: a fact plot)
  const AREA_PLOTS = AREAS.filter(a => a.live && !a.op);
  let area = $state<AreaId | null>(!game.mathOp && game.mathArea && AREA_PLOTS.some(a => a.id === game.mathArea) ? game.mathArea : null);
  const keysOf = (a: AreaId) => skillsOf(a).flatMap(sk => sk.subs.map(sb => `${sk.id}:${sb.id}`));
  const ALL_KEYS = AREA_PLOTS.flatMap(a => keysOf(a.id));
  const keyCounts = (keys: string[]) => { const c = [0, 0, 0, 0]; for (const k of keys) c[skillMem(m)[k]?.stage ?? 0]++; return c; };
  const R11 = Array.from({ length: 11 }, (_, i) => i);
  // each operation's garden: a bed for each row, a plant for each column
  const GRID: Record<Op, { rows: number[]; cols: number[]; fact: (r: number, c: number) => Fact; bedLabel: (r: number) => string; note: string }> = {
    x: { rows: [0, 1, 2, 10, 5, 4, 3, 6, 7, 8, 9], cols: R11, fact: (b, a) => ({ a, b }), bedLabel: b => `${b}s`, note: 'A bed for each times table: the plant numbered 6 in the 2s bed is 6 × 2. Learn 6 × 2 and its turnaround 2 × 6 grows too.' },
    '+': { rows: R11, cols: R11, fact: (b, a) => ({ a, b, op: '+' }), bedLabel: b => `+${b}`, note: 'Each bed adds its number: plant 6 in the +2 bed is 6 + 2. Its turnaround, 2 + 6, grows with it.' },
    '-': { rows: R11, cols: R11, fact: (b, d) => ({ a: b + d, b, op: '-' }), bedLabel: b => `−${b}`, note: 'Each bed takes its number away; the plant\'s number is what\'s left. 8 − 3 = 5 is plant 5 in the −3 bed. Its partner 8 − 5 grows with it.' },
    '/': { rows: R11.slice(1), cols: R11, fact: (b, q) => ({ a: b * q, b, op: '/' }), bedLabel: b => `÷${b}`, note: 'Each bed shares by its number; the plant\'s number is the answer. 42 ÷ 6 = 7 is plant 7 in the ÷6 bed. Blooming times facts start these growing.' },
  };
  const grid = $derived(GRID[op]);
  const ids = $derived(GARDEN_BY_OP[op]);
  const counts = $derived(area ? keyCounts(keysOf(area)) : stageCounts(m, ids));
  const plotOf = (o: Op) => STRANDS.findIndex(s => s.op === o);
  const areaPlot = (a: AreaId) => STRANDS.length + AREA_PLOTS.findIndex(x => x.id === a);
  const curPlot = $derived(area ? areaPlot(area) : plotOf(op));
  const due = $derived(area ? keysOf(area).filter(k => isDue(skillMem(m)[k], Date.now())) : ids.filter(id => isDue(m.facts[id], Date.now())));
  const fastS = $derived(Math.round((m.fastMs ?? FAST_MS) / 1000));
  // which region teaches each fact, for "it comes up on the ... trips"
  const REGION_OF = new Map<string, string>();
  for (const r of MATH_REGIONS) for (const g of r.groups) for (const f of groupFacts(g)) if (!REGION_OF.has(factId(f))) REGION_OF.set(factId(f), r.name);

  // growth since the last visit: those plants pop up, one after another
  const seenBefore = mathOf(game.profile!).gardenSeen;
  const grewIds = ALL_GARDEN_IDS.filter(id => (mathOf(game.profile!).facts[id]?.stage ?? 0) > (seenBefore?.[id] ?? 0));
  const grewKeys = ALL_KEYS.filter(k => (skillMem(mathOf(game.profile!))[k]?.stage ?? 0) > (seenBefore?.[k] ?? 0));
  const firstVisit = !seenBefore;
  // where every fact grows: its plot, bed and column
  const WHERE = new Map<string, { op: Op; bed: number; col: number }>();
  for (const s of STRANDS) GRID[s.op].rows.forEach((rw, bed) => GRID[s.op].cols.forEach((c, col) => WHERE.set(factId(GRID[s.op].fact(rw, c)), { op: s.op, bed, col })));
  const KEY_WHERE = new Map<string, { area: AreaId; bed: number }>();
  for (const a of AREA_PLOTS) skillsOf(a.id).forEach((sk, bed) => sk.subs.forEach(sb => KEY_WHERE.set(`${sk.id}:${sb.id}`, { area: a.id, bed })));

  /** The four plots for the 3D garden, from the save. */
  function plots(): GPlot[] {
    const mm = mathOf(game.profile!), now = Date.now();
    // only plants in the plot that's open at first pop up (the others have already grown when you get there)
    const order = new Map(area ? grewKeys.filter(k => KEY_WHERE.get(k)?.area === area).map((k, i) => [k, i]) : grewIds.filter(id => WHERE.get(id)?.op === op).map((id, i) => [id, i]));
    const mem = skillMem(mm);
    const skillPlots: GPlot[] = AREA_PLOTS.map(a => ({
      op: a.id, title: a.name, sign: a.sign ?? a.name[0], color: a.color, spread: true,
      beds: skillsOf(a.id).map((sk, j) => ({
        label: sk.short ?? sk.name, color: j % 6,
        plants: sk.subs.map(sb => {
          const id = `${sk.id}:${sb.id}`, st = mem[id];
          return { id, stage: (st?.stage ?? 0) as Stage, latest: st?.seen ? (st.latest ?? null) : null, due: isDue(st, now), grew: firstVisit ? -1 : order.get(id) ?? -1 };
        }),
      })),
    }));
    return [...STRANDS.map(s => ({
      op: s.op, title: s.name, sign: opSign(s.op), color: s.color,
      beds: GRID[s.op].rows.map((rw, j) => ({
        label: GRID[s.op].bedLabel(rw), color: j % 6,
        plants: GRID[s.op].cols.map(c => {
          const id = factId(GRID[s.op].fact(rw, c)), st = mm.facts[id];
          return { id, stage: (st?.stage ?? 0) as Stage, latest: st?.seen ? (st.latest ?? null) : null, due: isDue(st, now), grew: firstVisit ? -1 : order.get(id) ?? -1 };
        }),
      })),
    })), ...skillPlots];
  }

  // ---------- the 3D garden ----------
  let scene: GardenScene | null = null;
  let disposed = false;
  let loading = $state(true);
  let viewEl: HTMLDivElement | undefined = $state();
  let bed = $state<number | null>(null);
  let narrow = $state(innerWidth < 861);
  function viewOf() {
    const r = viewEl?.getBoundingClientRect();
    // frame the garden between the tabs along the top and the bed chips (and, on a phone, the key) along the bottom
    return r ? { top: (r.top + 54) / innerHeight, bottom: (r.bottom - (narrow ? 104 : 64)) / innerHeight, left: r.left / innerWidth, right: r.right / innerWidth } : { top: 0.12, bottom: 0.9, left: 0, right: 0.75 };
  }
  function onResize() { narrow = innerWidth < 861; if (scene) scene.view = viewOf(); }
  onMount(async () => {
    addEventListener('resize', onResize);
    const snap: Record<string, number> = {};
    for (const id of ALL_GARDEN_IDS) { const s = mathOf(game.profile!).facts[id]?.stage; if (s) snap[id] = s; }
    for (const k of ALL_KEYS) { const s = skillMem(mathOf(game.profile!))[k]?.stage; if (s) snap[k] = s; }
    try {
      const blooms = stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[3] + keyCounts(ALL_KEYS)[3];
      const sc = await GardenScene.create({ plots: plots(), buddy: game.profile!.buddy, view: viewOf(), plot: curPlot, name: game.profile!.name, blooms });
      if (disposed) { sc.dispose(); return; }
      scene = sc; stage.use(sc);
      // walking the buddy round: the tabs and beds follow it, the plant beside it shows, the surprises talk
      sc.onSay = (text) => { say = text; };
      sc.onWhere = (pl, b) => {
        if (pl < STRANDS.length) { if (op !== STRANDS[pl].op || area) { op = STRANDS[pl].op; area = null; } }
        else { const a = AREA_PLOTS[pl - STRANDS.length]; if (a && area !== a.id) area = a.id; }
        bed = b;
      };
      sc.onNear = (id) => peek(id);
      requestAnimationFrame(onResize);
      // scrolling zooms the garden, not the page
      viewEl?.addEventListener('wheel', onWheel, { passive: false });
    } catch (e) { console.error(e); }
    loading = false;
    game.update(pp => { pp.math = { ...mathOf(pp), gardenSeen: snap }; });
    if ((grewIds.length || grewKeys.length) && !firstVisit) setTimeout(() => sfx.star(2), 900);
    raf = requestAnimationFrame(follow);
  });
  onDestroy(() => { disposed = true; cancelAnimationFrame(raf); cancelAnimationFrame(driveRaf); removeEventListener('resize', onResize); viewEl?.removeEventListener('wheel', onWheel); if (scene && stage.current() === scene) stage.use(null); });

  // the picked plant's little name tag follows it on screen
  let raf = 0;
  let tag = $state<{ x: number; y: number } | null>(null);
  function follow() {
    const id = picked ? factId(picked) : pickedKey;
    const at = id && scene ? scene.screenOf(id) : null, r = viewEl?.getBoundingClientRect();
    tag = at && r ? { x: at.x * innerWidth - r.left, y: at.y * innerHeight - r.top } : null;
    raf = requestAnimationFrame(follow);
  }

  function setOp(o: Op) { if (o === op && !area) return; op = o; area = null; bed = null; unpick(); looking = false; scene?.select(null); scene?.show(plotOf(o), null); sfx.click(); }
  function setArea(a: AreaId) { if (a === area) return; area = a; bed = null; unpick(); looking = false; scene?.select(null); scene?.show(areaPlot(a), null); sfx.click(); }
  function goBed(b: number | null) { bed = b; looking = false; scene?.show(curPlot, b); sfx.click(); }
  function step(d: number) {
    const n = beds.length;
    goBed(bed === null ? (d > 0 ? 0 : n - 1) : bed + d < 0 || bed + d >= n ? null : bed + d);
  }
  // ---------- steering the camera yourself ----------
  // one finger or the mouse: look round; two fingers, a right-drag or shift-drag: slide over the garden;
  // pinch or scroll: closer or further; the arrows: walk the view along. A short tap still picks a plant.
  let looking = $state(false);
  let hinted = $state(false);
  const ptrs = new Map<number, { x: number; y: number }>();
  let down = { x: 0, y: 0, t: 0, button: 0 }, moved = 0, pinch = 0, mid = { x: 0, y: 0 };
  const two = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
  function pdown(e: PointerEvent) {
    if (e.target !== viewEl) return;
    viewEl!.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button }; moved = 0; }
    if (ptrs.size === 2) { const g = two(); pinch = g.d; mid = { x: g.x, y: g.y }; moved = 99; }
  }
  function pmove(e: PointerEvent) {
    const q = ptrs.get(e.pointerId);
    if (!q || !scene) return;
    const dx = e.clientX - q.x, dy = e.clientY - q.y;
    q.x = e.clientX; q.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 1) {
      if (moved < 7) return;
      if (down.button === 2 || e.shiftKey) scene.pan(dx, dy); else scene.orbit(dx, dy);
    } else if (ptrs.size === 2) {
      const g = two();
      if (pinch > 0 && g.d > 0) scene.zoom(pinch / g.d);
      scene.pan(g.x - mid.x, g.y - mid.y);
      pinch = g.d; mid = { x: g.x, y: g.y };
    } else return;
    steered();
  }
  function pup(e: PointerEvent) {
    const tapped = ptrs.size === 1 && moved < 7 && performance.now() - down.t < 600 && down.button !== 2;
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) moved = 99;
    if (tapped) tapAt(e.clientX, e.clientY);
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    scene?.zoom(Math.exp(Math.max(-60, Math.min(60, e.deltaY)) * 0.004), e.clientX, e.clientY);
    steered();
  }
  function steered() { looking = true; hinted = true; }
  // ---------- walking the buddy round the island yourself ----------
  // the arrow keys or W A S D, the arrows on screen (held), or a tap on the ground
  type Dir = 'up' | 'down' | 'left' | 'right';
  const KEYDIR: Record<string, Dir> = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const keysHeld = new Set<Dir>(), padHeld = new Set<Dir>();
  let driveRaf = 0, driving = false;
  function driveTick() {
    const on = (d: Dir) => keysHeld.has(d) || padHeld.has(d);
    const x = (on('right') ? 1 : 0) - (on('left') ? 1 : 0), z = (on('up') ? 1 : 0) - (on('down') ? 1 : 0);
    scene?.drive(x, z);
    if (x || z) { if (!driving) { driving = true; steered(); } driveRaf = requestAnimationFrame(driveTick); }
    else { driving = false; driveRaf = 0; }
  }
  function startDrive() { if (!driveRaf) driveRaf = requestAnimationFrame(driveTick); }
  function holdOn(d: Dir, e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    padHeld.add(d); sfx.click(); startDrive();
  }
  function holdOff(d: Dir) { padHeld.delete(d); }
  function keyUp(e: KeyboardEvent) { const d = KEYDIR[e.code]; if (d) keysHeld.delete(d); }
  function backToGarden() {
    // walked off somewhere: the buddy heads back to the plot (or bed) you were at, and the garden frames it
    if (scene?.walking) scene.show(curPlot, bed); else scene?.resetView();
    looking = false; sfx.click();
  }

  /** a tap on the garden: a plant opens its card, the buddy cheers, the ground: walk there */
  function tapAt(x: number, y: number) {
    if (!scene) return;
    const h = scene.pickAt(x, y);
    if (h === 'buddy') { say = `${['Hi!', 'Water break!', 'Look how they grow!', 'Wheee!'][Math.floor(Math.random() * 4)]}`; sfx.pop(); return; }
    if (!h) { if (scene.walkTo(x, y)) { steered(); sfx.click(); } return; }
    const w = WHERE.get(h.id);
    if (w) pick(GRID[w.op].fact(GRID[w.op].rows[w.bed], GRID[w.op].cols[w.col]));
    else if (KEY_WHERE.has(h.id)) pickKey(h.id);
  }

  let picked = $state<Fact | null>(null);
  /** or a skill plant: its memory key (skill:sub) */
  let pickedKey = $state<string | null>(null);
  const pickedStat = $derived(picked ? m.facts[factId(picked)] : pickedKey ? skillMem(m)[pickedKey] : undefined);
  const partner = $derived(picked && factId(partnerOf(picked)) !== factId(picked) ? partnerOf(picked) : null);
  const partnerStat = $derived(partner ? m.facts[factId(partner)] : undefined);
  /** a phone shows the plant's little tag as you walk by, and its card when you tap the tag (or the plant) */
  let cardOpen = $state(true);
  /** walked up to a plant: its card (on a phone, just its tag) */
  function peek(id: string | null) {
    if (!id) { if (narrow && !cardOpen) unpick(); return; }
    const w = WHERE.get(id);
    if (w) { picked = GRID[w.op].fact(GRID[w.op].rows[w.bed], GRID[w.op].cols[w.col]); pickedKey = null; }
    else if (KEY_WHERE.has(id)) { pickedKey = id; picked = null; }
    else return;
    cardOpen = !narrow;
    scene?.select(id);
  }
  function pick(f: Fact) {
    const w = WHERE.get(factId(f));
    picked = f; pickedKey = null; cardOpen = true; sfx.pop();
    // (when you're steering the camera yourself, it stays where you put it)
    if (w) { if (w.op !== op || area) { op = w.op; area = null; } if (bed !== w.bed && !looking) { bed = w.bed; scene?.show(plotOf(w.op), w.bed); } }
    scene?.select(factId(f));
  }
  function pickKey(k: string) {
    const w = KEY_WHERE.get(k);
    pickedKey = k; picked = null; cardOpen = true; sfx.pop();
    if (w) { if (w.area !== area) area = w.area; if (bed !== w.bed) { bed = w.bed; scene?.show(areaPlot(w.area), w.bed); } }
    scene?.select(k);
  }
  function unpick() { picked = null; pickedKey = null; cardOpen = true; scene?.select(null); }
  /** a skill plant: its skill, the kind of question, and one like it to look at */
  const pk = $derived(pickedKey ? { ...splitKey(pickedKey) } : null);
  const pkSkill = $derived(pk ? SKILL[pk.skill] : null);
  const pkSub = $derived(pk && pkSkill ? pkSkill.subs.find(sb => sb.id === pk.sub)?.label ?? pk.sub : '');
  // an example at the child's own level (pitched like a practice question)
  const pkExample = $derived(pk && pkSkill ? makeAt(pkSkill, mulberry32(11), pk.sub, pitch(m, pkSkill.id, TARGET.practice, { grown: !!p.settings.grown })) : null);
  /** Why a skill plant is where it is, in a child's words. */
  function keyStory(k: string): string {
    const s = skillMem(m)[k], sk = SKILL[splitKey(k).skill];
    if (s?.seen) {
      if (s.stage === 3) return 'In bloom: you got these right quickly on three different days.';
      if (s.stage === 2) return `A bud: you can do these. Get them right quickly on ${BLOOM_DAYS} different days and it blooms.`;
      return 'A sprout: you have met these. Get one right and it grows a bud.';
    }
    const where = SKILL_REGIONS.find(r => r.lessons.some(l => l.learn.includes(sk?.id ?? '')));
    return `A seed, not asked yet. It comes up on the ${where?.name ?? AREA[sk?.area ?? 'fractions'].name} trips.`;
  }

  const show = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;
  /** Why a fact is where it is, in a child's words. */
  function story(f: Fact): string {
    const s = m.facts[factId(f)];
    const pf = partnerOf(f), o = f.op ?? 'x';
    if (s?.seen) {
      if (s.stage === 3) return 'In bloom: you knew it quickly on three different days.';
      if (s.stage === 2) return `A bud: you can answer it. Answer it quickly on ${BLOOM_DAYS} different days and it blooms.`;
      return 'A sprout: you have met it. Get it right and it grows a bud.';
    }
    if ((s?.stage ?? 0) > 0) {
      if (o === '-' || o === '/') return `Not asked yet, but it's growing already: its family is coming along (${o === '-' ? 'adding' : 'times'} facts that bloom start these growing, and so does ${show(pf)}).`;
      return `Not asked yet, but it's growing already: you know ${show(pf)}, its turnaround. Swap the numbers and the answer stays the same, so this one grows too.`;
    }
    const where = REGION_OF.get(factId(f));
    if (isRuleFact(f)) {
      const rule = o === 'x' ? (f.a === 0 || f.b === 0 ? 'anything times 0 is 0' : 'times 1 keeps the number the same') : o === '+' ? 'adding 0 changes nothing' : o === '-' ? (f.b === 0 ? 'taking away 0 changes nothing' : 'a number take away itself is 0') : f.b === 1 ? 'sharing into one group keeps it all' : f.a === 0 ? 'nothing shared is nothing each' : 'a number shared by itself is 1 each';
      return `A seed, not asked yet. It follows a rule: ${rule}. It comes up ${o === 'x' ? 'on the Zero and One trips' : where ? `on the ${where} trips` : 'as an easy one'} and in reviews.`;
    }
    if (where) return `A seed, not asked yet. It comes up on the ${where} trips${o === 'x' || o === '+' ? `, and learning ${show(pf)} grows it too` : ''}.`;
    return `A seed, not asked yet. Learn ${show(pf)} and this one starts growing too.`;
  }

  // the beds: each row, how much of it is in bloom
  const beds = $derived(area ? skillsOf(area).map((sk, j) => {
    const st = sk.subs.map(sb => skillMem(m)[`${sk.id}:${sb.id}`]?.stage ?? 0);
    return { j, label: sk.short ?? sk.name, total: st.length, bloom: st.filter(s => s === 3).length, grow: st.filter(s => s > 0).length };
  }) : grid.rows.map((rw, j) => {
    const bid = grid.cols.map(c => factId(grid.fact(rw, c)));
    const st = bid.map(id => m.facts[id]?.stage ?? 0);
    return { j, label: grid.bedLabel(rw), total: bid.length, bloom: st.filter(s => s === 3).length, grow: st.filter(s => s > 0).length };
  }));
  const note = $derived(area ? `A bed for each kind of ${AREA[area].name.toLowerCase()} question, and a plant for each step of it. Quick means starting within about ${Math.round(Math.min(...skillsOf(area).map(sk => sk.fastMs)) / 1000)} seconds: these take longer than facts.` : grid.note);

  function setFast(s: number) { game.update(pp => { pp.math = { ...mathOf(pp), fastMs: s * 1000 }; }); }
  let help = $state(false);
  function onKey(e: KeyboardEvent) {
    const d = KEYDIR[e.code], tag = (e.target as HTMLElement | null)?.tagName;
    if (d && !game.modalOpen && tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') { e.preventDefault(); keysHeld.add(d); startDrive(); return; }
    if (e.key !== 'Escape' || game.modalOpen) return;
    if (help) help = false; else if (picked || pickedKey) unpick(); else if (bed !== null) goBed(null); else game.go(game.home);
  }
  const skillGrowing = ALL_KEYS.some(k => (skillMem(mathOf(game.profile!))[k]?.stage ?? 0) > 0);
  let say = $state(grewIds.length && !firstVisit ? `${grewIds.length} ${grewIds.length === 1 ? 'fact grew' : 'facts grew'} since you last looked!`
    : grewKeys.length && !firstVisit ? `${grewKeys.length} new ${grewKeys.length === 1 ? 'plant grew' : 'plants grew'} since you last looked!`
    : area && skillGrowing ? `Your ${AREA[area].name.toLowerCase()} are growing. Quick answers on different days make flowers bloom.`
    : stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[3] ? 'Tap any plant to see how it\'s doing!'
    : stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[1] + stageCounts(mathOf(game.profile!), ALL_GARDEN_IDS)[2] ? 'Your garden is growing. Quick answers on different days make flowers bloom.'
    : 'Every fact you learn grows here. Take a trip on the Times Trail to plant your first ones!');
</script>

<svelte:window onkeydown={onKey} onkeyup={keyUp} onblur={() => { keysHeld.clear(); padHeld.clear(); }} />

<div class="screen garden" class:narrow>
  <header class="bar">
    <NavTile size="sm" tone="sky" kind="home" label="Home" onclick={() => game.go('hub')} />
    <h1>Fact Garden</h1>
    <div class="tally" aria-label="Garden totals">
      <span title="In bloom"><img src={STAGE_PIC[3]} alt="" /><b>{counts[3]}</b><small>bloom</small></span>
      <span title="Buds"><img src={STAGE_PIC[2]} alt="" /><b>{counts[2]}</b><small>bud</small></span>
      <span title="Sprouts"><img src={STAGE_PIC[1]} alt="" /><b>{counts[1]}</b><small>sprout</small></span>
    </div>
    <button class="helpbtn" onclick={() => { help = !help; sfx.pop(); }} aria-label="How the garden works">?</button>
    <MenuButton size={36} />
  </header>

  <div class="main">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="view" bind:this={viewEl} onpointerdown={pdown} onpointermove={pmove} onpointerup={pup} onpointercancel={(e) => ptrs.delete(e.pointerId)} oncontextmenu={(e) => e.preventDefault()}>
      <div class="tabs" role="tablist" aria-label="Which garden">
        {#each STRANDS as st (st.op)}
          {@const n = stageCounts(m, GARDEN_BY_OP[st.op])[3]}
          <button role="tab" aria-selected={!area && op === st.op} class:on={!area && op === st.op} style:--sc={st.color} onclick={() => setOp(st.op)}>
            <img src="{base}{st.art}" alt="" /><span>{st.name}</span>{#if n}<em><img src={STAGE_PIC[3]} alt="" />{n}</em>{/if}
          </button>
        {/each}
        {#each AREA_PLOTS as a (a.id)}
          {@const n = keyCounts(keysOf(a.id))[3]}
          <button role="tab" aria-selected={area === a.id} class:on={area === a.id} style:--sc={a.color} onclick={() => setArea(a.id)}>
            <img src="{base}{a.art}" alt="" /><span>{a.name}</span>{#if n}<em><img src={STAGE_PIC[3]} alt="" />{n}</em>{/if}
          </button>
        {/each}
      </div>

      <div class="say"><Critter friend={p.buddy} look={p.settings.look} size={narrow ? 40 : 52} round /><p>{say}</p></div>

      {#if loading}<div class="loadpill"><img src={STAGE_PIC[1]} alt="" />Planting your garden…</div>{/if}
      {#if (picked || pickedKey) && tag}
        {#if narrow && !cardOpen}<button class="tag open" style:left="{tag.x}px" style:top="{tag.y}px" onclick={() => { cardOpen = true; sfx.pop(); }}>{picked ? show(picked) : pkSub}<small>tap</small></button>
        {:else}<div class="tag" style:left="{tag.x}px" style:top="{tag.y}px">{picked ? show(picked) : pkSub}</div>{/if}
      {/if}

      <!-- walk your buddy round the island, and back to where the garden was looking -->
      <div class="pad" aria-label="Walk your buddy">
        {#each [['up', 90], ['left', 0], ['right', 180], ['down', -90]] as [d, rot] (d)}
          <button class="mv {d}" onpointerdown={(e) => holdOn(d as Dir, e)} onpointerup={() => holdOff(d as Dir)} onpointercancel={() => holdOff(d as Dir)} onlostpointercapture={() => holdOff(d as Dir)} aria-label="Walk {d}"><img src={iconUrl('back')} alt="" style:transform="rotate({rot}deg)" /></button>
        {/each}
        <span class="padme"><Critter friend={p.buddy} look={p.settings.look} size={narrow ? 30 : 34} round /></span>
      </div>
      {#if looking}
        <button class="backview" onclick={backToGarden}><img src={iconUrl(bed === null ? 'garden' : 'redo')} alt="" />{bed === null ? 'Back to the whole garden' : 'Back to the bed'}</button>
      {:else if !hinted && !loading}
        <p class="hint">{narrow ? 'Tap the ground to walk there · drag to look around' : 'Walk with the arrow keys or W A S D · drag to look around'}</p>
      {/if}

      <div class="key" aria-label="What the glows mean">
        <span><img src={pic('quick')} alt="" />quick</span><span><img src={pic('slow')} alt="" />slow</span><span><img src={pic('missed')} alt="" />missed</span><span><img src={pic('due')} alt="" />check-up</span>
      </div>

      <nav class="bednav" aria-label="Beds">
        <button class="arrow" onclick={() => step(-1)} aria-label="Previous bed"><img src={iconUrl('back')} alt="" /></button>
        <div class="chips">
          <button class="chip whole" class:on={bed === null} onclick={() => goBed(null)}><img src={iconUrl('garden')} alt="" />Whole garden</button>
          {#each beds as b (b.j)}
            <button class="chip" class:on={bed === b.j} onclick={() => goBed(b.j)} title="{b.bloom} of {b.total} in bloom">
              <b>{b.label}</b><i class="mini"><i class="g" style:width="{(b.grow / b.total) * 100}%"></i><i class="b" style:width="{(b.bloom / b.total) * 100}%"></i></i>
            </button>
          {/each}
        </div>
        <button class="arrow next" onclick={() => step(1)} aria-label="Next bed"><img src={iconUrl('back')} alt="" /></button>
      </nav>
    </div>

    <aside class="side">
      {#if (picked || pickedKey) && (!narrow || cardOpen)}
        {@const st = (pickedStat?.stage ?? 0) as Stage}
        <div class="card detail" role="dialog" aria-label={picked ? show(picked) : pkSkill?.name}>
          <span class="x"><CloseButton onclick={unpick} size={36} /></span>
          <div class="dhead">
            <span class="dpic s{st}"><img src={STAGE_PIC[st]} alt="" /></span>
            <div>
              {#if picked}<div class="dfact">{show(picked)} = <b>{answerOf(picked)}</b></div>
              {:else}<div class="dfact dskill">{pkSkill?.name}<small>{pkSub}</small></div>{/if}
              <div class="dstage s{st}">{STAGE_WORD[st]}</div>
            </div>
          </div>
          {#if pkExample}<div class="dex"><small>Like this:</small><SkillPrompt parts={pkExample.prompt} size={26} picSize={96} done /></div>{/if}
          <p class="story">{picked ? story(picked) : keyStory(pickedKey!)}</p>
          {#if pickedStat?.seen}
            <div class="stats">
              {#if pickedStat.latest}<span class="last"><img src={pic(pickedStat.latest === 'fast' ? 'quick' : pickedStat.latest === 'slow' ? 'slow' : 'missed')} alt="" />last time: <b>{pickedStat.latest === 'fast' ? 'quick' : pickedStat.latest === 'slow' ? 'slow' : 'missed'}</b></span>{/if}
              <span><b>{pickedStat.seen}</b> asked</span>
              <span><b>{pickedStat.right}</b> right</span>
              {#if avgThink(pickedStat) !== null}<span><b>{(avgThink(pickedStat)! / 1000).toFixed(1)}s</b> to start</span>{/if}
            </div>
            {#if st === 2}
              <div class="days" aria-label="Quick days">{#each Array(BLOOM_DAYS) as _, i}<img class:on={i < pickedStat.fastDays.length} src={pic('quick')} alt="" />{/each}<span>quick on {pickedStat.fastDays.length} of {BLOOM_DAYS} days</span></div>
            {/if}
            {#if st === 3 && pickedStat.due}<p class="next"><img src={pic('due')} alt="" />Next check-up: {new Date(pickedStat.due).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</p>{/if}
          {/if}
          {#if picked && partner}
            <button class="turn" onclick={() => pick(partner!)}>
              <img src={STAGE_PIC[(partnerStat?.stage ?? 0) as Stage]} alt="" />
              <span>{picked!.op === '-' || picked!.op === '/' ? 'Family' : 'Turnaround'}: <b>{show(partner)}</b> · {STAGE_WORD[partnerStat?.stage ?? 0]}</span>
            </button>
          {/if}
        </div>
      {/if}

      {#if !narrow || help}
        <div class="card how" class:sheet={narrow}>
          {#if narrow}<span class="x"><CloseButton onclick={() => (help = false)} size={34} /></span>{/if}
          <b class="h">How a fact grows</b>
          <ol>
            {#each [0, 1, 2, 3] as s (s)}
              <li><img src={STAGE_PIC[s]} alt="" /><b>{STAGE_WORD[s]}</b><small>{['not asked yet', 'you met it', 'you got it right', `quick on ${BLOOM_DAYS} different days`][s]}</small></li>
            {/each}
          </ol>
          <p class="foot">A slip moves a fact back one step. Blooms get check-ups after 1, 3, 7, 14 and 30 days to stay fresh. {note}</p>
          {#if due.length}<p class="duenote"><img src={pic('due')} alt="" /><span><b>{due.length}</b> {due.length === 1 ? 'plant needs' : 'plants need'} a check-up. They come up on your next trips.</span></p>{/if}
          <details class="grown">
            <summary>For grown-ups</summary>
            <label>“Quick” means starting to answer within <select value={fastS} onchange={(e) => setFast(Number((e.currentTarget as HTMLSelectElement).value))}>{#each [2, 3, 4, 5, 6] as s}<option value={s}>{s} seconds</option>{/each}</select></label>
            <small>3 seconds is the usual line for knowing a fact by heart. Only thinking time counts, not typing. Tap any plant for its history.</small>
          </details>
        </div>
      {/if}

      {#if !narrow}
        <div class="card bedlist">
          <b class="h">{area ? AREA[area].name : STRAND[op].name} beds</b>
          <!-- (the rows scroll inside the card on a short screen) -->
          <div class="brows">
          {#each beds as b (b.j)}
            <button class="brow" class:on={bed === b.j} onclick={() => goBed(b.j)}>
              <span class="bl">{b.label}</span>
              <span class="bar2"><i class="g" style:width="{(b.grow / b.total) * 100}%"></i><i class="b" style:width="{(b.bloom / b.total) * 100}%"></i></span>
              <span class="bn">{b.bloom}<small>/{b.total}</small></span>
            </button>
          {/each}
          </div>
          <small class="bnote">Pink: in bloom. Green: growing.</small>
        </div>
      {/if}
    </aside>
  </div>
</div>

<style>
  .garden { display: flex; flex-direction: column; background: none; pointer-events: none; }
  .garden > :global(*) { pointer-events: auto; }
  .bar { flex: none; display: flex; align-items: center; gap: 14px; padding: 8px 18px; background: rgba(255, 255, 255, .94); border-bottom: var(--panel-border); position: relative; z-index: 3; }
  .bar h1 { font-size: 30px; margin: 0; }
  .tally { margin-left: auto; display: flex; gap: 8px; }
  .tally span { display: flex; align-items: center; gap: 4px; background: #f4fbf3; border-radius: 999px; padding: 2px 12px 2px 4px; box-shadow: inset 0 0 0 2px #e0f1df; }
  .tally img { width: 34px; height: 34px; object-fit: contain; }
  .tally b { font: 600 22px var(--font-ui); }
  .tally small { font: 700 12px var(--font-body); color: var(--muted); }
  .helpbtn { width: 42px; height: 42px; border-radius: 50%; border: 0; background: #fff; font: 600 24px/1 var(--font-ui); color: var(--primary); cursor: pointer; box-shadow: 0 0 0 3px #ffd36b, var(--shadow-sm); display: none; }

  .main { flex: 1; min-height: 0; display: flex; pointer-events: none; }
  .main > * { pointer-events: auto; }
  /* the 3D garden shows through this box; things float over it */
  .view { position: relative; flex: 1; min-width: 0; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
  .view:active { cursor: grabbing; }
  .pad { position: absolute; right: 12px; bottom: 70px; width: 120px; height: 120px; display: grid; grid-template-columns: repeat(3, 40px); grid-template-rows: repeat(3, 40px); }
  .mv { width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, .9); display: grid; place-items: center; cursor: pointer; padding: 0; box-shadow: var(--shadow-sm); touch-action: none; }
  .mv img { width: 28px; height: 28px; object-fit: contain; pointer-events: none; }
  .mv:active { transform: scale(.92); background: #fff3c4; }
  .mv.up { grid-area: 1 / 2; } .mv.left { grid-area: 2 / 1; } .mv.right { grid-area: 2 / 3; } .mv.down { grid-area: 3 / 2; }
  .backview { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 4px 16px 4px 5px; border-radius: 999px; background: #fff; font: 600 16px var(--font-ui); color: var(--ink); box-shadow: 0 0 0 3px #ffd34d, 0 8px 20px -10px rgba(30, 20, 60, .6); animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); white-space: nowrap; }
  .backview img { width: 32px; height: 32px; object-fit: contain; }
  .hint { position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%); margin: 0; pointer-events: none; font: 700 13px var(--font-body); color: #fff; background: rgba(30, 40, 20, .55); padding: 4px 12px; border-radius: 999px; white-space: nowrap; }
  .view > :global(*) { cursor: default; }
  .tabs { position: absolute; top: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; padding: 5px; border-radius: 999px; background: rgba(255, 255, 255, .9); box-shadow: 0 8px 22px -12px rgba(30, 40, 20, .5); white-space: nowrap; }
  .tabs button { display: flex; align-items: center; gap: 6px; border: 0; cursor: pointer; padding: 3px 12px 3px 3px; border-radius: 999px; background: transparent; font: 600 15px var(--font-ui); color: var(--ink2); }
  .tabs button img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 2px #fff; }
  .tabs button.on { background: var(--sc); color: #fff; }
  .tabs em { display: flex; align-items: center; gap: 1px; font: 800 12px var(--font-body); font-style: normal; background: #fff; color: #b02a68; border-radius: 999px; padding: 0 7px 0 2px; }
  .tabs em img { width: 18px; height: 18px; box-shadow: none; border-radius: 0; object-fit: contain; }
  .say { position: absolute; left: 12px; top: 64px; display: flex; align-items: center; gap: 8px; max-width: min(380px, 60%); }
  .say p { margin: 0; font: 600 15px/1.35 var(--font-body); color: var(--ink); background: rgba(255, 255, 255, .95); padding: 8px 12px; border-radius: 16px; box-shadow: 0 6px 18px -10px rgba(30, 40, 20, .5); }
  .loadpill { position: absolute; left: 50%; top: 45%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 8px; background: #fff; padding: 6px 18px 6px 6px; border-radius: 999px; font: 600 18px var(--font-ui); color: var(--ink2); box-shadow: var(--shadow-sm); }
  .loadpill img { width: 40px; height: 40px; animation: bob 1s ease-in-out infinite; }
  @keyframes bob { 50% { transform: translateY(-4px) rotate(-6deg); } }
  .dskill { display: flex; flex-direction: column; font-size: 22px !important; line-height: 1.1; }
  .dskill small { font: 700 14px var(--font-body); color: var(--muted); }
  .dex { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; background: #fbf8f1; border-radius: 14px; padding: 6px 10px; margin: 8px 0 0; }
  .dex > small { font: 700 12px var(--font-body); color: var(--muted); }
  .tag { position: absolute; transform: translate(-50%, -100%); pointer-events: none; font: 600 18px var(--font-ui); color: var(--ink); background: #fff; padding: 2px 12px; border-radius: 999px; box-shadow: 0 0 0 3px #ffd34d, 0 8px 18px -8px rgba(30, 20, 60, .5); white-space: nowrap; }
  .tag.open { pointer-events: auto; cursor: pointer; border: 0; display: flex; align-items: center; gap: 6px; }
  .tag.open small { font: 800 11px var(--font-body); color: #fff; background: var(--primary); border-radius: 999px; padding: 1px 7px; }
  .padme { grid-area: 2 / 2; display: grid; place-items: center; pointer-events: none; }
  .key { position: absolute; right: 12px; top: 64px; display: flex; flex-direction: column; gap: 2px; background: rgba(255, 255, 255, .92); border-radius: 16px; padding: 6px 12px 6px 6px; box-shadow: 0 6px 18px -10px rgba(30, 40, 20, .5); font: 700 13px var(--font-body); color: var(--ink2); }
  .key span { display: flex; align-items: center; gap: 6px; }
  .key img { width: 28px; height: 28px; object-fit: contain; }

  .bednav { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .arrow { flex: none; width: 46px; height: 46px; border: 0; border-radius: 50%; background: #fff; display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-sm); padding: 0; }
  .arrow img { width: 34px; height: 34px; object-fit: contain; }
  .arrow.next img { transform: scaleX(-1); }
  .chips { flex: 1; min-width: 0; display: flex; gap: 5px; overflow-x: auto; padding: 4px; border-radius: 999px; background: rgba(255, 255, 255, .88); scrollbar-width: none; }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; cursor: pointer; padding: 5px 10px 6px; border-radius: 16px; background: #f4f0e8; font: 600 15px/1 var(--font-ui); color: var(--ink); }
  .chip.whole { flex-direction: row; gap: 5px; padding: 3px 12px 3px 4px; border-radius: 999px; font-size: 14px; }
  .chip.whole img { width: 30px; height: 30px; object-fit: contain; }
  .chip.on { background: var(--primary); color: #fff; }
  .mini { position: relative; display: block; width: 34px; height: 6px; border-radius: 999px; background: rgba(0, 0, 0, .1); overflow: hidden; }
  .mini i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .mini .g { background: #6fd39a; } .mini .b { background: #ff6fae; }

  .side { flex: 0 0 340px; display: flex; flex-direction: column; gap: 10px; padding: 10px 12px 12px 0; overflow-y: auto; }
  .side .card { padding: 14px 16px; position: relative; }
  .x { position: absolute; right: 8px; top: 8px; display: grid; }
  .detail { animation: pop-in .3s cubic-bezier(.3, .8, .4, 1.4); box-shadow: 0 0 0 3px #ffd34d, var(--shadow-sm); }
  .dhead { display: flex; align-items: center; gap: 10px; padding-right: 36px; }
  .dpic { flex: none; width: 74px; height: 74px; display: grid; place-items: center; border-radius: 20px; background: radial-gradient(circle at 50% 65%, #f6efe2, #e6d6bc); }
  .dpic.s3 { background: radial-gradient(circle at 50% 60%, #fff4fa, #ffd6ea); }
  .dpic img { width: 64px; height: 64px; object-fit: contain; }
  .dfact { font: 600 30px var(--font-ui); }
  .dfact b { color: var(--primary-edge); }
  .dstage { display: inline-block; font: 800 12px var(--font-body); letter-spacing: .06em; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: #efeaf8; color: var(--ink2); }
  .dstage.s1 { background: #e3f6e8; color: #2e7d4c; } .dstage.s2 { background: #efe6ff; color: #5b3fb8; } .dstage.s3 { background: #ffe3f0; color: #b02a68; }
  .story { margin: 10px 0 6px; font: 600 15px/1.4 var(--font-body); color: var(--ink2); }
  .stats { display: flex; gap: 6px; flex-wrap: wrap; }
  .stats span { display: flex; align-items: center; gap: 4px; font: 700 13px var(--font-body); color: var(--muted); background: var(--bg2); border-radius: 10px; padding: 4px 9px; }
  .stats b { font: 600 17px var(--font-ui); color: var(--ink); }
  .stats .last img { width: 22px; height: 22px; object-fit: contain; }
  .days { display: flex; align-items: center; gap: 3px; margin-top: 8px; font: 700 13px var(--font-body); color: var(--ink2); }
  .days img { width: 24px; height: 24px; object-fit: contain; filter: grayscale(1) opacity(.35); }
  .days img.on { filter: none; }
  .days span { margin-left: 4px; }
  .next { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; font: 600 14px var(--font-body); color: var(--ink2); }
  .next img { width: 24px; height: 24px; }
  .turn { margin-top: 10px; width: 100%; display: flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; background: #f7fbf2; padding: 6px 10px; font: 600 14px var(--font-body); color: var(--ink2); cursor: pointer; text-align: left; }
  .turn img { width: 34px; height: 34px; object-fit: contain; }
  .turn:hover { background: #ecf7e4; }

  .how .h, .bedlist .h, .grown summary { font: 600 18px var(--font-ui); display: block; margin-bottom: 6px; }
  .how ol { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
  .how li { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .how li img { width: 52px; height: 52px; object-fit: contain; }
  .how li b { font: 600 15px var(--font-ui); }
  .how li small { font: 700 11px/1.2 var(--font-body); color: var(--muted); }
  .foot { margin: 8px 0 0; font: 600 13px/1.4 var(--font-body); color: var(--ink2); background: #f7fbf2; border-radius: 12px; padding: 6px 10px; }
  .duenote { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; font: 600 13.5px/1.35 var(--font-body); color: var(--ink2); }
  .duenote img { width: 30px; height: 30px; }
  .grown { margin-top: 8px; }
  .grown summary { cursor: pointer; margin: 0; font-size: 15px; }
  .grown label { display: block; margin-top: 6px; font: 600 14px/1.5 var(--font-body); color: var(--ink2); }
  .grown select { font: 700 14px var(--font-body); border-radius: 8px; border: 2px solid #e4dcf2; padding: 2px 6px; background: #fff; }
  .grown small { display: block; margin-top: 6px; font: 600 12.5px/1.35 var(--font-body); color: var(--muted); }
  .brow { width: 100%; display: grid; grid-template-columns: minmax(52px, auto) 1fr 48px; align-items: center; gap: 8px; margin: 2px 0; padding: 3px 6px; border: 0; border-radius: 10px; background: none; cursor: pointer; text-align: left; }
  .brow:hover { background: #f6f2ea; }
  .brow.on { background: #efe8ff; }
  .bl { font: 600 16px var(--font-ui); color: var(--ink); white-space: nowrap; }
  .bar2 { position: relative; height: 12px; border-radius: 999px; background: #efe9e0; overflow: hidden; }
  .bar2 i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; }
  .bar2 .g { background: #9fdcb5; } .bar2 .b { background: linear-gradient(90deg, #ff9ec7, #ff6fae); }
  .bn { font: 600 18px var(--font-ui); text-align: right; color: var(--ink); }
  .bn small { font: 700 12px var(--font-body); color: var(--muted); }
  .bnote { font: 700 12px var(--font-body); color: var(--muted); }
  /* the side column fits the screen: the how-to and a plant's card keep their size, the beds list takes
     what's left and scrolls inside itself */
  .side > .how, .side > .detail { flex: none; }
  .bedlist { flex: 1 1 0; min-height: 150px; display: flex; flex-direction: column; }
  .brows { flex: 1 1 auto; min-height: 0; overflow-y: auto; margin: 0 -6px; padding: 0 6px; scrollbar-width: thin; }
  .bedlist .bnote { flex: none; margin-top: 4px; }
  /* short screens (a 1280 by 720 laptop): smaller rows and a tighter how-to */
  @media (max-height: 820px) {
    .side { gap: 8px; padding-top: 8px; padding-bottom: 8px; }
    .side .card { padding: 10px 14px; }
    .how .h, .bedlist .h { font-size: 16px; margin-bottom: 4px; }
    .how li img { width: 38px; height: 38px; }
    .how li b { font-size: 13px; }
    .foot { font-size: 12px; line-height: 1.35; padding: 5px 8px; }
    .brow { margin: 0; padding: 1px 6px; gap: 6px; }
    .bl { font-size: 14px; }
    .bar2 { height: 9px; }
    .bn { font-size: 15px; }
  }

  /* a phone: the garden fills the screen; the card and the how-to slide up from the bottom */
  .narrow .bar { padding: 6px 8px; gap: 6px; }
  .narrow .bar h1 { font-size: 20px; }
  .narrow .tally { gap: 3px; }
  .narrow .tally span { padding: 0 7px 0 0; }
  .narrow .tally small { display: none; }
  .narrow .tally img { width: 26px; height: 26px; }
  .narrow .tally b { font-size: 16px; }
  .narrow .helpbtn { display: block; flex: none; width: 36px; height: 36px; font-size: 20px; }
  @media (max-width: 480px) { .narrow .bar h1 { display: none; } .narrow .tally { margin-left: auto; } }
  .narrow .side { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 8px 8px; overflow: visible; pointer-events: none; z-index: 20; }
  .narrow .side > :global(*) { pointer-events: auto; }
  .narrow .detail, .narrow .sheet { max-height: 62vh; overflow-y: auto; box-shadow: 0 -6px 30px rgba(40, 28, 70, .25), 0 0 0 3px #ffd34d; }
  .narrow .tabs { left: 8px; right: 8px; transform: none; overflow-x: auto; scrollbar-width: none; }
  .narrow .tabs button { padding: 2px 9px 2px 2px; font-size: 12.5px; }
  .narrow .tabs button img { width: 26px; height: 26px; }
  .narrow .tabs button:not(.on) span { display: none; }
  .narrow .say { top: 58px; left: 8px; max-width: 72%; }
  .narrow .say p { font-size: 13px; padding: 6px 10px; }
  .narrow .pad { right: 6px; bottom: auto; top: 108px; width: 108px; height: 108px; grid-template-columns: repeat(3, 36px); grid-template-rows: repeat(3, 36px); }
  .narrow .mv { width: 36px; height: 36px; } .narrow .mv img { width: 24px; height: 24px; }
  .narrow .backview, .narrow .hint { bottom: 112px; }
  .narrow .backview { font-size: 14px; }
  .narrow .key { top: auto; bottom: 66px; right: 8px; flex-direction: row; gap: 6px; padding: 4px 8px 4px 4px; font-size: 11px; }
  .narrow .key img { width: 22px; height: 22px; }
  .narrow .key span { gap: 2px; }
  .narrow .bednav { left: 6px; right: 6px; bottom: 8px; }
  .narrow .arrow { width: 40px; height: 40px; }
  .narrow .chip.whole span { display: none; }
  .narrow .how ol { gap: 2px; }
  .narrow .how li img { width: 42px; height: 42px; }
</style>
