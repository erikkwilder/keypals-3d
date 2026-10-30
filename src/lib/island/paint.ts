// Painted textures for My Sky Island, drawn on a canvas once: soft stone blocks (the cottage, the well, the
// island's cliffs), blue roof tiles, a striped tent, and the soft glow round lanterns and crystals. Painted
// like the rest of the game (light from the top left, a darker edge underneath), and seeded so they come
// out the same every time.
import * as THREE from 'three';

const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
type Keep = <T extends { dispose(): void }>(x: T) => T;
function tex(keep: Keep, cv: HTMLCanvasElement, repeat = true) {
  const t = keep(new THREE.CanvasTexture(cv));
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const hsl = (h: number, s: number, l: number) => `hsl(${h}, ${s}%, ${l}%)`;

/** Stone blocks in rows: `big` for the island's cliffs (bigger, rougher, greyer), else a cottage wall. */
export function stones(keep: Keep, o: { big?: boolean; hue?: number; sat?: number; light?: number; seed?: number } = {}): THREE.CanvasTexture {
  const S = o.big ? 1024 : 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!, r = rnd(o.seed ?? (o.big ? 41 : 17));
  const hue = o.hue ?? 34, sat = o.sat ?? (o.big ? 14 : 22), light = o.light ?? (o.big ? 70 : 80);
  // the mortar: a darker, warm grey
  g.fillStyle = hsl(hue, sat * 0.8, light - 34); g.fillRect(0, 0, S, S);
  const rows: number[] = [];
  let y = 0;
  while (y < S) { const h = Math.round((o.big ? 90 : 52) + r() * (o.big ? 70 : 34)); rows.push(Math.min(h, S - y)); y += h; }
  // the last row too thin: fold it into the one before
  if (rows.length > 1 && rows[rows.length - 1] < (o.big ? 60 : 30)) { const t = rows.pop()!; rows[rows.length - 1] += t; }
  const gap = o.big ? 7 : 5;
  y = 0;
  for (const h of rows) {
    let x = -r() * 80;
    while (x < S) {
      const w = Math.round(h * (o.big ? 1.1 : 1.3) + r() * h * (o.big ? 1.4 : 1.2));
      const l = light - 6 + r() * 12, hh = hue + (r() - 0.5) * 10, ss = sat + (r() - 0.5) * 8;
      for (const dx of [0, S]) block(g, x - dx, y, w, h, gap, l, hh, ss, r, !!o.big);
      x += w;
    }
    y += h;
  }
  // a fine speckle over everything
  for (let i = 0; i < S * 6; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(60,40,20,.08)'; g.fillRect(r() * S, r() * S, 2, 2); }
  return tex(keep, cv);
}
function block(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap: number, l: number, hue: number, sat: number, r: () => number, big: boolean) {
  const x0 = x + gap / 2, y0 = y + gap / 2, ww = w - gap, hh = h - gap, rad = Math.min(ww, hh) * (big ? 0.28 : 0.22);
  g.save();
  g.beginPath(); g.roundRect(x0, y0, ww, hh, rad); g.clip();
  const gr = g.createLinearGradient(x0, y0, x0 + ww * 0.4, y0 + hh);
  gr.addColorStop(0, hsl(hue, sat, Math.min(96, l + 9))); gr.addColorStop(0.55, hsl(hue, sat, l)); gr.addColorStop(1, hsl(hue, sat + 4, l - 13));
  g.fillStyle = gr; g.fillRect(x0, y0, ww, hh);
  // a soft lit top edge and a shaded bottom edge
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = big ? 6 : 4; g.beginPath(); g.moveTo(x0 + rad, y0 + 2); g.lineTo(x0 + ww - rad, y0 + 2); g.stroke();
  g.strokeStyle = 'rgba(70,45,25,.28)'; g.lineWidth = big ? 9 : 5; g.beginPath(); g.moveTo(x0 + rad * 0.6, y0 + hh - 2); g.lineTo(x0 + ww - rad * 0.6, y0 + hh - 2); g.stroke();
  // a crack or two on the big ones, a few pits on all
  if (big && r() < 0.55) { g.strokeStyle = 'rgba(70,50,35,.4)'; g.lineWidth = 2.5; g.beginPath(); let cx = x0 + ww * (0.2 + r() * 0.6), cy = y0 + 4; g.moveTo(cx, cy); for (let k = 0; k < 4; k++) { cx += (r() - 0.5) * 30; cy += hh * 0.22; g.lineTo(cx, cy); } g.stroke(); }
  for (let k = 0; k < (big ? 6 : 3); k++) { g.fillStyle = 'rgba(90,65,45,.18)'; g.beginPath(); g.arc(x0 + r() * ww, y0 + r() * hh, 1.5 + r() * 3, 0, 7); g.fill(); }
  g.restore();
}

/** Rows of round roof tiles (the cottage's: slate blue). */
export function roofTiles(keep: Keep, hue = 220, sat = 48, light = 46): THREE.CanvasTexture {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!, r = rnd(5);
  g.fillStyle = hsl(hue, sat, light - 22); g.fillRect(0, 0, S, S);
  const th = 64, tw = 64;
  // rows from the bottom up, so each row's rounded ends overlap the row below
  for (let row = Math.ceil(S / th); row >= -1; row--) {
    const y = row * th, off = row % 2 ? tw / 2 : 0;
    for (let x = -tw; x < S + tw; x += tw) {
      const l = light + (r() - 0.5) * 9, cx = x + off;
      const gr = g.createLinearGradient(cx, y, cx + tw, y + th);
      gr.addColorStop(0, hsl(hue, sat, l + 14)); gr.addColorStop(0.6, hsl(hue, sat, l)); gr.addColorStop(1, hsl(hue, sat + 6, l - 12));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(cx + 2, y); g.lineTo(cx + tw - 2, y); g.lineTo(cx + tw - 2, y + th * 0.7); g.quadraticCurveTo(cx + tw / 2, y + th * 1.18, cx + 2, y + th * 0.7); g.closePath(); g.fill();
      g.strokeStyle = hsl(hue, sat, l - 24); g.lineWidth = 3; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx + 9, y + 8); g.lineTo(cx + 9, y + th * 0.6); g.stroke();
    }
  }
  return tex(keep, cv);
}

/** A tent's canvas: stripes, with little stars on the dark ones. */
export function stripes(keep: Keep, a = '#f6efe0', b = '#7b5cd6'): THREE.CanvasTexture {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * S / 8, 0, S / 8, S); }
  g.fillStyle = '#ffe27a';
  for (let i = 1; i < 8; i += 2) for (let k = 0; k < 3; k++) star(g, i * S / 8 + S / 16, 40 + k * 80 + (i % 4) * 10, 7);
  return tex(keep, cv);
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

/** A soft round glow (lanterns, crystals, the sun on the dais). */
export function glow(keep: Keep): THREE.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,.14)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return tex(keep, cv, false);
}

/** The building grid over the grass: soft squares, only where things can go. */
export function gridTex(keep: Keep, r: number, cellPx = 64): THREE.CanvasTexture {
  const n = Math.ceil(r) * 2 + 1, S = n * cellPx, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d')!, half = Math.floor(n / 2);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const ci = i - half, cj = j - half;
    if (Math.hypot(ci, cj) > r - 0.5) continue;
    g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(i * cellPx + 3, j * cellPx + 3, cellPx - 6, cellPx - 6);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; g.beginPath(); g.roundRect(i * cellPx + 3, j * cellPx + 3, cellPx - 6, cellPx - 6, 10); g.stroke();
  }
  const t = tex(keep, cv, false);
  return t;
}
