<script lang="ts">
  // Glimmer Drop: a just-for-fun game you earn with play time (the same minutes Adventure uses). Drop
  // Glimmer eggs into the cloud jar; they crack open into round Glimmers, and two of the same that bump
  // together pop and merge into the next, bigger one. Chains score more. Keep the jar below the line.
  // The jar and its Glimmers are drawn on a canvas over the 3D island, where your buddy cheers you on.
  import { onDestroy, onMount } from 'svelte';
  import { game } from '../state/game.svelte';
  import { stage } from '../three/stage';
  import { ShowScene } from '../three/showScene';
  import { sfx } from '../audio/sound';
  import { danceOf, dayKey } from '../engine/profile';
  import { playLeft, PLAY_RULES, advView } from '../adventure/state';
  import { nextLesson } from '../engine/profile';
  import { mathOf, nextMathLesson } from '../math/progress';
  import { CHAIN, DropGame, JAR, TOP, daySeed, type DropEvent } from '../drop/engine';
  import { BALL_ART } from '../drop/art';
  import { dropOf, familyBoard, markFound, recordRound, spendPlay } from '../drop/save';
  import GearButton from '../ui/GearButton.svelte';
  import Critter from '../ui/Critter.svelte';
  import Confetti from '../ui/Confetti.svelte';
  import Icon from '../ui/Icon.svelte';

  const base = import.meta.env.BASE_URL;
  const p = $derived(game.profile!);
  const me = game.profile!;
  const day = dayKey(Date.now());
  let narrow = $state(innerWidth < 760);

  // ---------- pictures ----------
  const sprites: HTMLImageElement[] = CHAIN.map(c => { const im = new Image(); im.src = `${base}drop/${c.id}.webp`; return im; });
  const eggs: Record<string, HTMLImageElement> = {};
  for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) { const im = new Image(); im.src = `${base}game/egg-${r}.webp`; eggs[r] = im; }
  const rimImg = new Image(); rimImg.src = `${base}drop/rim.webp`;
  const pedImg = new Image(); pedImg.src = `${base}drop/pedestal.webp`;

  // ---------- the round ----------
  type Phase = 'menu' | 'play' | 'over';
  let phase = $state<Phase>('menu');
  let mode = $state<'daily' | 'free'>('daily');
  let g: DropGame | null = null;
  let score = $state(0);
  let hold = $state(0), next = $state(0);
  let warning = $state(false);
  let gustDir = $state<0 | -1 | 1>(0);
  let paused = $state(false);
  let ended = $state<{ why: 'full' | 'time'; score: number; tier: number; chain: number; newBest: boolean; newDaily: boolean } | null>(null);
  let burst = $state(0);
  // play time: minutes left now (counting what this round has used but not saved yet)
  let unsaved = 0, lastSave = 0;
  let timeUp = $state<number | null>(null); // seconds of "finish up" left once play time runs out
  const left = $derived.by(() => { void tick; const l = playLeft(p); return l.left === null ? null : l.left - unsaved / 60000; });
  const open = $derived(playLeft(p).open);
  let tick = $state(0);

  // what's shown on the boards
  const save = $derived(dropOf(p));
  const board = $derived.by(() => { void tick; return familyBoard(game.save.profiles, day); });
  const found = $derived(new Set(save.found));

  // ---------- floating words and the discovery card ----------
  type Float = { id: number; x: number; y: number; text: string; kind: string };
  let floats = $state<Float[]>([]); let fid = 0;
  let banner = $state<{ text: string; key: number; big: boolean } | null>(null);
  let discovery = $state<{ tier: number; key: number } | null>(null);

  // ---------- the 3D buddy beside the jar ----------
  let scene: ShowScene | null = null;
  let disposed = false;
  let lastMove = 0;
  function viewOf() {
    return narrow ? { top: 0.7, bottom: 0.995, left: -0.06, right: 0.44 } : { top: 0.24, bottom: 0.86, left: 0.12, right: 0.42 };
  }
  // on a phone the jar fills the screen, so the buddy cheers as a picture in front of it
  let cheer = $state(0);
  function react(move: string, force = false) {
    const now = performance.now();
    if (!force && now - lastMove < 2400) return;
    lastMove = now;
    cheer++;
    scene?.dance(me.buddy, move);
  }

  // ---------- drawing ----------
  let box: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();
  let ctx: CanvasRenderingContext2D | null = null;
  let cw = 0, ch = 0, dpr = 1;
  /** jar units to canvas pixels */
  let k = 1, ox = 0, oy = 0;
  let shake = 0;
  let glass = $state({ l: 0, t: 0, w: 0, h: 0, r: 0 });
  type Part = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'star' | 'dot' | 'shard' | 'ring'; spin: number; a: number };
  const parts: Part[] = [];
  /** where the held egg is aimed (jar units), drawn smoothly */
  let aimDraw = JAR.w / 2;

  function layout() {
    if (!box || !canvas) return;
    narrow = innerWidth < 760;
    const r = box.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    cw = r.width; ch = r.height;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    ctx = canvas.getContext('2d');
    // room above the jar for the cloud and its egg, below for the pedestal
    const top = 140, bottom = 50, side = 16;
    k = Math.min((cw - side * 2) / (JAR.w + 40), (ch - 10) / (JAR.h + top + bottom));
    // a phone keeps the jar up top, leaving the bottom corner for the buddy
    ox = (cw - JAR.w * k) / 2; oy = (narrow ? 6 : Math.max(6, (ch - (JAR.h + top + bottom) * k) / 2)) + top * k;
    // the frosted glass behind the jar (the island blurs through it)
    const gi = 10 * k;
    glass = { l: X(0) - gi, t: Y(-24), w: JAR.w * k + gi * 2, h: Y(JAR.h) + gi - Y(-24), r: 56 * k };
    if (scene) scene.view = viewOf();
  }
  const X = (x: number) => ox + x * k, Y = (y: number) => oy + y * k;
  /** a point in jar units, as a position on the page (for the floating words) */
  function pagePos(x: number, y: number) { const r = box!.getBoundingClientRect(); return { x: r.left + X(x), y: r.top + Y(y) }; }

  function drawBall(c: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number, angle: number, squash: number, alpha = 1) {
    const im = sprites[tier], art = BALL_ART[CHAIN[tier].id];
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, y);
    // squash flat on impact, stretch back up
    c.scale(1 + squash * 0.55, 1 - squash * 0.45);
    c.save();
    c.rotate(angle);
    if (im.complete && im.naturalWidth) {
      const s = (r * 1.06) / (art.r * im.naturalWidth);
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      c.drawImage(im, -art.cx * w, -art.cy * h, w, h);
    } else { c.fillStyle = '#cfe3ff'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); }
    c.restore();
    // a glossy shine that stays at the top left as it rolls
    const gl = c.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.04, -r * 0.3, -r * 0.35, r * 0.75);
    gl.addColorStop(0, 'rgba(255,255,255,.55)'); gl.addColorStop(0.45, 'rgba(255,255,255,.08)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, r * 0.98, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function drawEgg(c: CanvasRenderingContext2D, tier: number, x: number, y: number, r: number, wob = 0) {
    const im = eggs[CHAIN[tier].egg];
    if (!im.complete || !im.naturalWidth) return;
    const h = r * 2.35, w = h * (im.naturalWidth / im.naturalHeight);
    c.save(); c.translate(x, y); c.rotate(Math.sin(wob) * 0.12);
    c.drawImage(im, -w / 2, -h * 0.56, w, h);
    c.restore();
  }
  function jarPath(c: CanvasRenderingContext2D, inset = 0) {
    const l = X(0) - inset, r = X(JAR.w) + inset, t = Y(-24), b = Y(JAR.h) + inset, rad = 56 * k;
    c.beginPath(); c.moveTo(l, t); c.lineTo(l, b - rad); c.quadraticCurveTo(l, b, l + rad, b); c.lineTo(r - rad, b); c.quadraticCurveTo(r, b, r, b - rad); c.lineTo(r, t);
  }

  function draw(dt: number, t: number) {
    const c = ctx;
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, cw, ch);
    if (shake > 0.01) c.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 12);
    shake *= Math.exp(-dt * 7);
    // the pedestal under the jar
    if (pedImg.complete && pedImg.naturalWidth) { const w = JAR.w * k * 1.42, h = w * (pedImg.naturalHeight / pedImg.naturalWidth); c.drawImage(pedImg, X(JAR.w / 2) - w / 2, Y(JAR.h) - h * 0.42, w, h); }
    // the back of the glass
    jarPath(c, 10 * k); c.closePath();
    const bg = c.createLinearGradient(X(0), 0, X(JAR.w), 0);
    bg.addColorStop(0, 'rgba(200,228,255,.42)'); bg.addColorStop(0.5, 'rgba(236,246,255,.22)'); bg.addColorStop(1, 'rgba(190,220,255,.42)');
    c.fillStyle = bg; c.fill();
    // the line not to fill past: a soft ribbon of light, red and pulsing when the jar is too full
    const ly = Y(JAR.line), pulse = warning ? 0.55 + Math.sin(t * 12) * 0.45 : 0;
    c.save();
    c.strokeStyle = warning ? `rgba(255,90,120,${0.6 + pulse * 0.4})` : 'rgba(255,255,255,.75)';
    c.lineWidth = (warning ? 5 : 3) * Math.max(0.7, k);
    c.setLineDash([14 * k, 10 * k]); c.lineDashOffset = -t * 30;
    c.shadowColor = warning ? '#ff5a78' : '#ffffff'; c.shadowBlur = warning ? 18 : 8;
    c.beginPath(); c.moveTo(X(4), ly); c.lineTo(X(JAR.w - 4), ly); c.stroke();
    c.restore();
    // where the egg will fall
    if (g && phase === 'play' && !g.done) {
      aimDraw += (g.aim - aimDraw) * (1 - Math.exp(-dt * 18));
      const r = CHAIN[g.hold].r * k, ex = X(aimDraw), ey = Y(JAR.line - CHAIN[g.hold].r - 46);
      c.save(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.setLineDash([4, 8]);
      c.beginPath(); c.moveTo(ex, ey + r); c.lineTo(ex, Y(JAR.h)); c.stroke(); c.restore();
    }
    // the Glimmers
    if (g) for (const b of g.balls) {
      const r = CHAIN[b.tier].r * b.grow * k, x = X(b.body.position.x), y = Y(b.body.position.y);
      if (b.egg) drawEgg(c, b.tier, x, y, CHAIN[b.tier].r * k, t * 10);
      else drawBall(c, b.tier, x, y, r, b.body.angle, b.squash);
    }
    // sparkles, shards and rings
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.kind === 'shard' ? 900 : 120) * dt; q.vx *= Math.exp(-dt * 2); q.a += q.spin * dt;
      const f = q.life / q.max;
      c.save(); c.globalAlpha = Math.min(1, f * 1.6); c.translate(q.x, q.y); c.rotate(q.a);
      if (q.kind === 'ring') { c.strokeStyle = q.color; c.lineWidth = 4 * f; c.beginPath(); c.arc(0, 0, q.size * (1.4 - f), 0, Math.PI * 2); c.stroke(); }
      else if (q.kind === 'star') { c.fillStyle = q.color; c.shadowColor = q.color; c.shadowBlur = 10; const s = q.size; c.beginPath(); for (let j = 0; j < 8; j++) { const rr = j % 2 ? s * 0.38 : s; const a = (j / 8) * Math.PI * 2; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); }
      else if (q.kind === 'shard') { c.fillStyle = q.color; c.beginPath(); c.moveTo(-q.size, -q.size * 0.4); c.lineTo(q.size, 0); c.lineTo(-q.size * 0.3, q.size * 0.6); c.closePath(); c.fill(); }
      else { c.fillStyle = q.color; c.beginPath(); c.arc(0, 0, q.size * f, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    // the front of the glass: a thick edge (outside and in), long shines, a bright bottom curve and a rim
    c.save();
    jarPath(c, 10 * k);
    c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(3, 5 * k); c.shadowColor = 'rgba(90,150,230,.7)'; c.shadowBlur = 12; c.stroke();
    c.shadowBlur = 0;
    jarPath(c, 3 * k);
    c.strokeStyle = 'rgba(170,210,255,.55)'; c.lineWidth = Math.max(1.5, 2.5 * k); c.stroke();
    // the curve of light along the bottom
    c.beginPath(); c.ellipse(X(JAR.w / 2), Y(JAR.h - 18), JAR.w * 0.36 * k, 10 * k, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = Math.max(2, 4 * k); c.lineCap = 'round'; c.stroke();
    c.restore();
    const shine = (x0: number, w: number, a: number) => { const gr = c.createLinearGradient(X(x0), 0, X(x0 + w), 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(X(x0), Y(10), w * k, (JAR.h - 70) * k); };
    shine(18, 34, 0.32); shine(62, 12, 0.22); shine(JAR.w - 40, 22, 0.18);
    // the cloud rim on the jar's mouth
    if (rimImg.complete && rimImg.naturalWidth) { const w = JAR.w * k * 1.26, h = w * (rimImg.naturalHeight / rimImg.naturalWidth); c.drawImage(rimImg, X(JAR.w / 2) - w / 2, Y(-30) - h * 0.62, w, h); }
    // the egg you're holding, in front of the cloud, on a soft glow so it's easy to find
    if (g && phase === 'play' && !g.done && g.canDrop()) {
      const r = CHAIN[g.hold].r * k, ex = X(aimDraw), ey = Y(JAR.line - CHAIN[g.hold].r - 46);
      const glow = c.createRadialGradient(ex, ey, 0, ex, ey, r * 2.4);
      glow.addColorStop(0, 'rgba(255,250,210,.85)'); glow.addColorStop(1, 'rgba(255,250,210,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(ex, ey, r * 2.4, 0, Math.PI * 2); c.fill();
      drawEgg(c, g.hold, ex, ey, r, t * 3);
    }
    // wind on its way: arrows across the jar
    if (gustDir) {
      c.save(); c.globalAlpha = 0.55 + Math.sin(t * 10) * 0.3; c.fillStyle = '#ffffff'; c.shadowColor = '#7fc8ff'; c.shadowBlur = 12;
      for (let i = 0; i < 3; i++) {
        const y = Y(JAR.line + 70 + i * 110), x = X(JAR.w / 2) + gustDir * ((t * 140 + i * 60) % (JAR.w * 0.5) * k - JAR.w * 0.25 * k);
        c.beginPath(); c.moveTo(x + gustDir * 26, y); c.lineTo(x - gustDir * 14, y - 16); c.lineTo(x - gustDir * 6, y); c.lineTo(x - gustDir * 14, y + 16); c.closePath(); c.fill();
      }
      c.restore();
    }
  }

  function sparkle(x: number, y: number, n: number, colors: string[], speed = 260, size = 7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 0.5 + Math.random() * 0.6, max: 1.1, size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], kind: Math.random() < 0.6 ? 'star' : 'dot', spin: (Math.random() - 0.5) * 10, a: 0 });
    }
  }
  const COLORS = ['#ffffff', '#ffe066', '#ff9fd0', '#8fe3ff', '#b9a4ff'];
  function float(x: number, y: number, text: string, kind: string) {
    const pos = pagePos(x, y);
    const f = { id: fid++, x: pos.x, y: pos.y, text, kind };
    floats = [...floats, f];
    setTimeout(() => (floats = floats.filter(q => q.id !== f.id)), 1300);
  }
  const CHAIN_WORDS = ['', 'Merge!', 'Double!', 'Triple!', 'Mega chain!', 'Super chain!', 'Ultra chain!'];

  function handle(ev: DropEvent[]) {
    for (const e of ev) {
      if (e.k === 'drop') sfx.dropEgg();
      else if (e.k === 'crack') { sfx.crack(); for (let i = 0; i < 10; i++) parts.push({ x: X(e.x), y: Y(e.y), vx: (Math.random() - 0.5) * 320, vy: -120 - Math.random() * 200, life: 0.5, max: 0.5, size: 5 + Math.random() * 4, color: i % 2 ? '#fff6e0' : '#ffe3a8', kind: 'shard', spin: (Math.random() - 0.5) * 16, a: 0 }); }
      else if (e.k === 'land') sfx.plop(g?.balls.find(b => b.id === e.id)?.tier ?? 0, Math.min(3, e.force / 3));
      else if (e.k === 'merge') {
        sfx.merge(e.tier, e.chain);
        const r = CHAIN[e.tier].r * k;
        sparkle(X(e.x), Y(e.y), 10 + e.tier * 3 + e.chain * 4, COLORS, 180 + e.tier * 30, 5 + e.tier * 0.8);
        parts.push({ x: X(e.x), y: Y(e.y), vx: 0, vy: 0, life: 0.45, max: 0.45, size: r * 1.2, color: 'rgba(255,255,255,.9)', kind: 'ring', spin: 0, a: 0 });
        float(e.x, e.y - CHAIN[e.tier].r, e.chain < 2 && e.tier >= 3 ? `Merge! +${e.points}` : `+${e.points}`, e.chain >= 2 ? 'big' : 'pts');
        if (e.chain >= 2) { banner = { text: CHAIN_WORDS[Math.min(CHAIN_WORDS.length - 1, e.chain)], key: Date.now(), big: e.chain >= 4 }; shake = Math.min(1, 0.25 + e.chain * 0.15); if (e.chain >= 3) react('fistpump'); }
        if (e.tier >= 6) shake = Math.max(shake, 0.35);
        // a Glimmer of the chain made for the first time
        let isNew = false;
        game.update(pp => { isNew = markFound(pp, e.tier); });
        if (isNew) {
          discovery = { tier: e.tier, key: Date.now() };
          sfx.reveal(Math.min(5, Math.floor(e.tier / 2)));
          if (e.tier >= 5) { burst++; react(danceOf(me), true); }
          setTimeout(() => { if (discovery?.tier === e.tier) discovery = null; }, 2600);
        }
      } else if (e.k === 'party') {
        sfx.party(); burst++; shake = 1;
        sparkle(X(e.x), Y(e.y), 70, COLORS, 520, 11);
        banner = { text: 'Glimmer party!', key: Date.now(), big: true };
        float(e.x, e.y, `+${e.points}`, 'big');
        react('jump', true);
      } else if (e.k === 'gustWarn') { gustDir = e.dir; sfx.gustWarn(); }
      else if (e.k === 'gust') { sfx.gust(); setTimeout(() => (gustDir = 0), 1300); }
      else if (e.k === 'warn') { warning = e.on; if (e.on) sfx.brink(); }
      else if (e.k === 'full') finish('full');
    }
  }

  // ---------- the loop ----------
  let raf = 0, lastT = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0);
    lastT = now;
    const t = now / 1000;
    if (g && phase === 'play' && !paused) {
      // keys held: move the egg
      if (keys.left || keys.right) g.setAim(g.aim + (keys.right ? 1 : -1) * 420 * dt);
      handle(g.step(dt));
      score = g.score; hold = g.hold; next = g.next;
      // play time
      unsaved += dt * 1000;
      if (now - lastSave > 10000 && unsaved > 0) { const ms = unsaved; unsaved = 0; lastSave = now; game.update(pp => spendPlay(pp, ms)); }
      tick++;
      if (timeUp === null && left !== null && left <= 0) { timeUp = 15; sfx.brink(); }
      if (timeUp !== null) { timeUp = Math.max(0, timeUp - dt); if (timeUp <= 0) finish('time'); }
    }
    draw(dt, t);
  }

  // ---------- controls ----------
  const keys = { left: false, right: false };
  function toJarX(clientX: number) { const r = box!.getBoundingClientRect(); return (clientX - r.left - ox) / k; }
  function onMove(e: PointerEvent) { if (g && phase === 'play') g.setAim(toJarX(e.clientX)); }
  function onDown(e: PointerEvent) { if (g && phase === 'play') { g.setAim(toJarX(e.clientX)); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } }
  function onUp(e: PointerEvent) { if (g && phase === 'play' && !paused) { g.setAim(toJarX(e.clientX)); g.drop(); } }
  function onKey(e: KeyboardEvent, down: boolean) {
    if (phase !== 'play') { if (down && (e.key === 'Enter' || e.key === ' ') && phase === 'over' && canPlay) { e.preventDefault(); start(mode); } return; }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = down; e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = down; e.preventDefault(); }
    else if (down && (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown')) { e.preventDefault(); if (!paused) g?.drop(); }
    else if (down && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) paused = !paused;
  }
  function onVis() { if (document.hidden && phase === 'play') paused = true; }

  // ---------- starting and ending ----------
  const canPlay = $derived(open && (left === null || left > 0.05));
  function start(m: 'daily' | 'free') {
    if (!canPlay) { sfx.nope(); return; }
    mode = m;
    g = new DropGame(m === 'daily' ? daySeed(day) : (Date.now() % 1e9) | 0);
    aimDraw = JAR.w / 2; parts.length = 0;
    score = 0; hold = g.hold; next = g.next; warning = false; gustDir = 0; ended = null; timeUp = null; paused = false;
    unsaved = 0; lastSave = performance.now();
    phase = 'play'; sfx.unlock();
    react('fistpump', true);
    // for checking the end card: __drop.over = 99 fills the jar
    if (import.meta.env.DEV) (window as unknown as { __drop: DropGame }).__drop = g;
  }
  function finish(why: 'full' | 'time') {
    if (!g || phase !== 'play') return;
    g.stop();
    const r = { score: g.score, tier: g.best.tier, chain: g.best.chain };
    let res = { newBest: false, newDaily: false };
    const ms = unsaved; unsaved = 0;
    game.update(pp => { res = recordRound(pp, { score: r.score, tier: r.tier, daily: mode === 'daily', day, ms, at: Date.now() }); });
    ended = { why, ...r, ...res };
    if (why === 'full') sfx.jarFull(); else sfx.complete();
    if (res.newBest || res.newDaily) { burst++; react(danceOf(me), true); } else react('wave1', true);
    warning = false; gustDir = 0; timeUp = null;
    setTimeout(() => { phase = 'over'; tick++; }, 900);
  }
  function leave() {
    if (g && phase === 'play') { const ms = unsaved; unsaved = 0; if (ms > 0) game.update(pp => spendPlay(pp, ms)); }
    game.go('adventure');
  }
  function practice(kind: 'math' | 'typing') {
    if (kind === 'typing') { game.setHome('typing'); game.startLesson(nextLesson(p).id); }
    else { game.setHome('math'); game.startMath(nextMathLesson(mathOf(p)).id); }
  }

  onMount(async () => {
    layout();
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(frame);
    const sc = await ShowScene.create({ buddies: narrow ? [] : [me.buddy], view: viewOf(), spot: 32, fromSave: true });
    if (disposed) { sc.dispose(); return; }
    scene = sc; stage.use(sc); sc.select(me.buddy);
    requestAnimationFrame(layout);
  });
  onDestroy(() => {
    disposed = true; cancelAnimationFrame(raf);
    removeEventListener('resize', layout); document.removeEventListener('visibilitychange', onVis);
    if (g && phase === 'play' && unsaved > 0) { const ms = unsaved; game.update(pp => spendPlay(pp, ms)); }
    if (scene && stage.current() === scene) stage.use(null);
  });
  const fmt = (n: number) => n.toLocaleString('en-US');
  const sprite = (t: number) => `${base}drop/${CHAIN[t].id}.webp`;
</script>

<svelte:window onkeydown={(e) => onKey(e, true)} onkeyup={(e) => onKey(e, false)} />

<div class="drop" class:narrow>
  <div class="top">
    <button class="back" onclick={leave} aria-label="Back to the Adventure map"><Icon name="back" size={30} /></button>
    <div class="title"><small>Just for fun</small><b>Glimmer Drop</b></div>
    {#if phase !== 'menu'}<span class="chip mode">{mode === 'daily' ? "Today's jar" : 'Free play'}</span>{/if}
    <span class="sp"></span>
    {#if left !== null}<span class="chip time" class:low={left < 2} title={PLAY_RULES[advView(p).settings.rule].text}><Icon name="clock" size={20} /> {Math.max(0, Math.ceil(left))}<span class="mn">&nbsp;min</span></span>{/if}
    <GearButton size={narrow ? 40 : 46} />
  </div>

  <div class="main">
    {#if !narrow}
      <aside class="side left">
        <div class="board card">
          <h3>Family scores <span>today's jar</span></h3>
          {#each board.slice(0, 5) as r, i (r.id)}
            <div class="row" class:me={r.id === p.id}><span class="rk">{i + 1}</span><Critter friend={r.buddy} size={30} round /><b>{r.name}</b><em>{fmt(r.today || r.best)}</em></div>
          {:else}<p class="muted">Play today's jar to be first on the board!</p>{/each}
        </div>
      </aside>
    {/if}

    <div class="jarbox" bind:this={box} onpointermove={onMove} onpointerdown={onDown} onpointerup={onUp} role="application" aria-label="The cloud jar: move to aim, tap or press space to drop">
      <div class="frost" style:left="{glass.l}px" style:top="{glass.t}px" style:width="{glass.w}px" style:height="{glass.h}px" style:border-radius="0 0 {glass.r}px {glass.r}px"></div>
      <canvas bind:this={canvas}></canvas>
      {#if phase === 'play'}
        <div class="hud">
          <div class="score card"><small>Score</small><b>{fmt(score)}</b><span>Best {fmt(Math.max(save.best, score))}</span></div>
          <div class="next card"><small>Next</small><img src="{base}game/egg-{CHAIN[next].egg}.webp" alt="" /><img class="nb" src={sprite(next)} alt={CHAIN[next].name} /></div>
        </div>
        {#if narrow}<div class="pal"><Critter friend={me.buddy} size={150} pulse={{ kind: 'joy', n: cheer }} /></div>{/if}
        {#if warning}<div class="warnpill">Too full! Merge to make room</div>{/if}
        {#if timeUp !== null}<div class="warnpill time">Play time's up: {Math.ceil(timeUp)} seconds to finish!</div>{/if}
        {#if paused}<div class="pausebg"><div class="card pausecard"><h2>Paused</h2><button class="btn btn-primary" onclick={() => (paused = false)}>Keep going</button><button class="btn" onclick={leave}>Leave</button></div></div>{/if}
      {/if}
    </div>

    {#if !narrow}
      <aside class="side right">
        <div class="chainbox card">
          <h3>The Glimmer chain</h3>
          <p class="muted">Two the same make the next one. Can you make a Phoenix Chick?</p>
          <div class="chain">
            {#each CHAIN as c, i (c.id)}
              <div class="link" class:got={found.has(i) || i < 5} title={found.has(i) || i < 5 ? c.name : 'Not made yet'}>
                <img src={sprite(i)} alt="" style:width="{15 + i * 2.5}px" />
              </div>
              {#if i < TOP}<span class="arr">›</span>{/if}
            {/each}
          </div>
        </div>
      </aside>
    {/if}
  </div>

  {#each floats as f (f.id)}<div class="float {f.kind}" style:left="{f.x}px" style:top="{f.y}px">{f.text}</div>{/each}
  {#if banner}{#key banner.key}<div class="banner" class:bigb={banner.big}>{banner.text}</div>{/key}{/if}
  {#if discovery}
    {#key discovery.key}
      <div class="disc card">
        <img src={sprite(discovery.tier)} alt="" />
        <div><small>New Glimmer!</small><b>{CHAIN[discovery.tier].name}</b><span>{discovery.tier === TOP ? 'The biggest of them all!' : `Next: ${CHAIN[discovery.tier + 1].name}`}</span></div>
      </div>
    {/key}
  {/if}

  {#if phase === 'menu'}
    <div class="overlay">
      <div class="card menu">
        <img class="art" src="{base}drop/tile.webp" alt="" />
        <h1>Glimmer Drop</h1>
        <div class="how">
          <div><img src="{base}game/egg-common.webp" alt="" /><p><b>Drop an egg</b> Move it over the jar, then tap.</p></div>
          <div><span class="pair"><img src={sprite(1)} alt="" /><img src={sprite(1)} alt="" /><i>→</i><img src={sprite(2)} alt="" /></span><p><b>Two the same</b> bump and grow into a bigger Glimmer.</p></div>
          <div><span class="line"></span><p><b>Don't fill past the line</b> or the jar is full.</p></div>
        </div>
        {#if canPlay}
          <div class="modes">
            <button class="btn btn-primary big" onclick={() => start('daily')}><span>Today's jar</span><small>{save.daily?.day === day ? `Your best today: ${fmt(save.daily.best)}` : 'The same eggs for everyone today'}</small></button>
            <button class="btn big" onclick={() => start('free')}><span>Free play</span><small>{save.best ? `Best ever: ${fmt(save.best)}` : 'A new jar every time'}</small></button>
          </div>
          {#if left !== null}<p class="playnote"><Icon name="clock" size={18} /> {Math.max(0, Math.ceil(left))} minute{Math.ceil(left) === 1 ? '' : 's'} of play time left today. Practice earns more.</p>{/if}
        {:else}
          <p class="playnote closed">{playLeft(p).why || 'Play time is used up for today.'}</p>
          <div class="modes"><button class="btn btn-primary" onclick={() => practice('math')}>Math practice</button><button class="btn btn-primary" onclick={() => practice('typing')}>Typing practice</button></div>
        {/if}
      </div>
    </div>
  {/if}

  {#if phase === 'over' && ended}
    <div class="overlay">
      <div class="card over">
        <small class="why">{ended.why === 'full' ? 'The jar is full!' : "Play time's up for today!"}</small>
        <h1>{fmt(ended.score)}</h1>
        {#if ended.newBest}<span class="ribbon">New best ever!</span>{:else if ended.newDaily}<span class="ribbon">Your best on today's jar!</span>{/if}
        <div class="stats">
          <div><img src={sprite(Math.max(0, ended.tier))} alt="" /><p><b>{CHAIN[Math.max(0, ended.tier)].name}</b>the biggest you made</p></div>
          <div><span class="cn">{ended.chain}×</span><p><b>Longest chain</b>merges in a row</p></div>
        </div>
        {#if board.length}
          <div class="board mini">
            {#each board.slice(0, 4) as r, i (r.id)}<div class="row" class:me={r.id === p.id}><span class="rk">{i + 1}</span><Critter friend={r.buddy} size={26} round /><b>{r.name}</b><em>{fmt(r.today || r.best)}</em></div>{/each}
          </div>
        {/if}
        <div class="modes">
          {#if canPlay}<button class="btn btn-primary" onclick={() => start(mode)}>Play again <span class="kbd">enter</span></button>{/if}
          <button class="btn" onclick={leave}>Back to the map</button>
        </div>
        {#if !canPlay}<p class="playnote">Practice earns more play time.</p>{/if}
      </div>
    </div>
  {/if}

  <Confetti {burst} count={90} x={50} y={30} spread={1.6} />
</div>

<style>
  .drop { position: fixed; inset: 0; display: flex; flex-direction: column; font-family: var(--font-body); user-select: none; -webkit-user-select: none; overflow: hidden; }
  .top { display: flex; align-items: center; gap: 10px; padding: 12px 16px 4px; position: relative; z-index: 3; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { width: 48px; height: 48px; border-radius: 50%; border: 0; background: rgba(255, 255, 255, .94); display: grid; place-items: center; cursor: pointer; box-shadow: var(--shadow-sm); }
  .title { display: flex; flex-direction: column; background: rgba(255, 255, 255, .94); border-radius: 18px; padding: 4px 16px; box-shadow: var(--shadow-sm); }
  .title small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .title b { font: 600 22px/1.1 var(--font-ui); color: var(--ink); }
  .sp { flex: 1; }
  .chip { display: flex; align-items: center; gap: 6px; font: 600 17px var(--font-ui); background: rgba(255, 255, 255, .94); border-radius: 999px; padding: 6px 14px; box-shadow: var(--shadow-sm); color: var(--ink); }
  .chip.mode { font-size: 15px; color: #6d3fd6; }
  .chip.time.low { box-shadow: 0 0 0 3px #ff8fa8, var(--shadow-sm); }
  .mn { font-size: 13px; color: var(--muted); }
  .main { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(220px, 1fr) minmax(360px, 1.5fr) minmax(220px, 1fr); gap: 12px; padding: 4px 16px 12px; }
  /* the jar reaches up between the top buttons, so it can be as big as the screen allows */
  .drop:not(.narrow) .main { margin-top: -60px; }
  .drop:not(.narrow) .side { padding-top: 60px; }
  @media (max-width: 1240px) { .chip.mode { display: none; } }
  .narrow .main { grid-template-columns: 1fr; padding: 0 6px 6px; }
  .side { display: flex; flex-direction: column; justify-content: flex-end; gap: 12px; min-height: 0; }
  .side.right { justify-content: center; }
  .card { background: rgba(255, 255, 255, .95); border-radius: 22px; box-shadow: 0 14px 34px -18px rgba(40, 20, 90, .55); }
  .board { padding: 12px 14px; }
  .board h3, .chainbox h3 { margin: 0 0 8px; font-size: 18px; }
  .board h3 span { font: 700 12px var(--font-body); color: var(--muted); margin-left: 6px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 14px; }
  .row.me { background: #f1ebff; }
  .row .rk { width: 20px; font: 700 14px var(--font-ui); color: var(--muted); text-align: center; }
  .row b { flex: 1; font: 600 16px var(--font-ui); color: var(--ink); }
  .row em { font: 600 16px var(--font-ui); font-style: normal; color: #6d3fd6; }
  .muted { color: var(--muted); font: 600 14px/1.4 var(--font-body); margin: 0; }
  .chainbox { padding: 14px; }
  .chain { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 2px; margin-top: 10px; }
  .link img { display: block; filter: grayscale(1) brightness(0.35) opacity(.45); transition: filter .4s; }
  .link.got img { filter: drop-shadow(0 2px 3px rgba(40, 20, 80, .3)); }
  .arr { color: #b8aed6; font: 600 16px var(--font-ui); }
  /* a narrower panel keeps the whole chain on one line without the arrows */
  @media (max-width: 1560px) { .arr { display: none; } .chain { gap: 4px; } }
  .jarbox { position: relative; min-height: 0; touch-action: none; cursor: crosshair; }
  .jarbox canvas { position: absolute; inset: 0; display: block; }
  .pal { position: absolute; left: -4px; bottom: -6px; pointer-events: none; filter: drop-shadow(0 6px 8px rgba(30, 20, 60, .35)); }
  .frost { position: absolute; -webkit-backdrop-filter: blur(3px) saturate(1.15) brightness(1.06); backdrop-filter: blur(3px) saturate(1.15) brightness(1.06); pointer-events: none; }
  .hud { position: absolute; top: 4px; left: 0; right: 0; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
  .score { padding: 8px 18px; display: flex; flex-direction: column; align-items: center; }
  .score small, .next small { font: 800 11px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .score b { font: 600 34px/1 var(--font-ui); color: var(--ink); }
  .score span { font: 700 12px var(--font-body); color: var(--muted); }
  .next { padding: 6px 12px 8px; display: flex; flex-direction: column; align-items: center; position: relative; }
  .next img { width: 44px; height: 52px; object-fit: contain; }
  .next .nb { position: absolute; right: -10px; bottom: -6px; width: 34px; height: 34px; }
  .warnpill { position: absolute; left: 50%; top: 92px; transform: translateX(-50%); background: #fff0f3; color: #c2304e; font: 600 17px var(--font-ui); padding: 6px 16px; border-radius: 999px; box-shadow: 0 0 0 3px #ff8fa8; animation: throb .7s ease-in-out infinite; white-space: nowrap; pointer-events: none; }
  .warnpill.time { top: 130px; background: #fff8e6; color: #9a5a00; box-shadow: 0 0 0 3px #ffd36b; }
  @keyframes throb { 50% { transform: translateX(-50%) scale(1.06); } }
  .pausebg { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(40, 28, 70, .25); }
  .pausecard { padding: 18px 26px; display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .pausecard h2 { margin: 0; }
  .float { position: fixed; transform: translate(-50%, -50%); font: 600 30px var(--font-ui); color: #fff; -webkit-text-stroke: 6px #2f7be0; paint-order: stroke; text-shadow: 0 3px 0 #1d55a8, 0 0 16px #bfe8ff; pointer-events: none; z-index: 6; animation: rise 1.3s cubic-bezier(.2, .8, .3, 1) forwards; white-space: nowrap; }
  .float.big { font-size: 40px; -webkit-text-stroke-color: #e07b00; text-shadow: 0 3px 0 #b35a00, 0 0 22px #ffe066; }
  @keyframes rise { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6); } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15); } 70% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -170%) scale(1); } }
  .banner { position: fixed; left: 50%; top: 32%; transform: translate(-50%, -50%); z-index: 7; pointer-events: none; font: 600 clamp(36px, 6vw, 64px)/1 var(--font-ui); color: #fff; -webkit-text-stroke: 3px #6d3fd6; paint-order: stroke; text-shadow: 0 6px 0 #4a23a8, 0 0 30px #fff; animation: bannerin 1.1s cubic-bezier(.2, 1.3, .4, 1) forwards; white-space: nowrap; }
  .banner.bigb { font-size: clamp(46px, 8vw, 88px); -webkit-text-stroke-color: #e07b00; text-shadow: 0 6px 0 #b35a00, 0 0 40px #ffe066; }
  @keyframes bannerin { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.4) rotate(-8deg); } 25% { opacity: 1; transform: translate(-50%, -50%) scale(1.1) rotate(2deg); } 40% { transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -70%) scale(1); } }
  .disc { position: fixed; left: 50%; top: 84px; transform: translateX(-50%); z-index: 8; display: flex; align-items: center; gap: 12px; padding: 8px 18px 8px 8px; box-shadow: 0 0 0 4px #ffd36b, 0 18px 40px -16px rgba(120, 70, 0, .6); animation: slidein .5s cubic-bezier(.2, 1.3, .4, 1); pointer-events: none; }
  .disc img { width: 64px; height: 64px; object-fit: contain; animation: wiggle 1s ease-in-out infinite; }
  .disc small { display: block; font: 800 11px var(--font-body); color: #a86a00; text-transform: uppercase; letter-spacing: .06em; }
  .disc b { display: block; font: 600 22px var(--font-ui); color: var(--ink); }
  .disc span { font: 700 13px var(--font-body); color: var(--muted); }
  @keyframes slidein { from { opacity: 0; transform: translate(-50%, -30px) scale(.8); } }
  @keyframes wiggle { 50% { transform: rotate(-8deg) scale(1.06); } }
  .overlay { position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, .25), rgba(40, 28, 70, .45)); padding: 16px; }
  .menu, .over { width: min(560px, 94vw); max-height: 92vh; overflow: auto; padding: 18px 24px 22px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; animation: slidein .4s cubic-bezier(.2, 1.2, .4, 1); }
  .menu .art { width: 150px; height: 150px; object-fit: contain; margin-top: -6px; filter: drop-shadow(0 8px 14px rgba(40, 20, 80, .25)); }
  .menu h1, .over h1 { margin: 0; font-size: 40px; }
  .how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 100%; }
  .how > div { background: #faf8fe; border-radius: 16px; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .how img { width: 44px; height: 44px; object-fit: contain; }
  .how p { margin: 0; font: 600 13px/1.35 var(--font-body); color: var(--ink2); }
  .how p b { display: block; font: 600 15px var(--font-ui); color: var(--ink); }
  .pair { display: flex; align-items: center; gap: 2px; height: 44px; }
  .pair img { width: 26px; height: 26px; } .pair img:last-child { width: 40px; height: 40px; }
  .pair i { font-style: normal; color: var(--primary); font-weight: 700; }
  .how .line { display: block; width: 70px; height: 44px; border-bottom: 4px dashed #ff8fa8; border-radius: 0 0 12px 12px; background: linear-gradient(transparent 60%, #e6f2ff 60%); box-shadow: inset 0 -16px 0 #cfe4ff; }
  .modes { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .btn.big { display: flex; flex-direction: column; align-items: center; padding: 12px 22px; }
  .btn.big span { font: 600 22px var(--font-ui); }
  .btn.big small { font: 700 12px var(--font-body); opacity: .85; }
  .playnote { margin: 4px 0 0; display: flex; align-items: center; gap: 6px; justify-content: center; font: 700 14px var(--font-body); color: var(--muted); }
  .playnote.closed { color: #9a5a00; font-size: 16px; }
  .over .why { font: 800 14px var(--font-body); color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .over h1 { font-size: 64px; color: #6d3fd6; }
  .ribbon { font: 600 18px var(--font-ui); color: #fff; background: linear-gradient(135deg, #f7b733, #ff6fae); padding: 4px 16px; border-radius: 999px; box-shadow: 0 0 0 3px #fff, 0 8px 18px -8px rgba(200, 80, 120, .7); }
  .stats { display: flex; gap: 10px; width: 100%; }
  .stats > div { flex: 1; display: flex; align-items: center; gap: 8px; background: #faf8fe; border-radius: 16px; padding: 8px 10px; text-align: left; }
  .stats img { width: 54px; height: 54px; object-fit: contain; }
  .stats p { margin: 0; font: 600 13px var(--font-body); color: var(--muted); }
  .stats p b { display: block; font: 600 16px var(--font-ui); color: var(--ink); }
  .cn { width: 54px; text-align: center; font: 600 28px var(--font-ui); color: #e07b00; }
  .board.mini { width: 100%; background: #faf8fe; border-radius: 16px; padding: 6px 8px; }
  .board.mini .row b { text-align: left; }
  @media (max-width: 760px) {
    .top { padding: 8px 8px 2px; gap: 6px; }
    .back { width: 42px; height: 42px; }
    .title { padding: 2px 12px; } .title b { font-size: 18px; } .title small { display: none; }
    .chip.mode { display: none; }
    .score { padding: 4px 12px; } .score b { font-size: 26px; }
    .warnpill { top: 70px; font-size: 14px; } .warnpill.time { top: 104px; }
    .how { grid-template-columns: 1fr; }
    .how > div { flex-direction: row; text-align: left; }
    .menu .art { width: 110px; height: 110px; }
    .menu h1 { font-size: 30px; } .over h1 { font-size: 48px; }
    .disc { top: 64px; }
  }
</style>
