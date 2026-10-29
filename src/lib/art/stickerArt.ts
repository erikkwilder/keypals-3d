// Sticker and medal artwork. Stickers are die-cut illustrations of a Keypal in a pose with a
// themed background, a prop and a title ribbon. Rarer stickers shine, shimmer with
// holographic foil, or sparkle (SVG animations, so they work in every browser engine).

import type { FriendId, Look } from './cast';
import { rideIcon } from './vehicles';
import { RIDES, type RideId } from '../engine/rides';
import { GLYPH } from './badges';
import { STICKERS, type StickerDef, type StickerPose, type StickerShape } from '../engine/stickers';
import { MEDALS, type AwardDef } from '../engine/achievements';
import { iconUrl, medalArtUrl, stickerArtUrl } from './icons';

/** The stickers and medals in the book have painted art; any other (retired ones in old saved games) is drawn. */
const PAINTED_STICKERS = new Set(STICKERS.map(s => s.id));
const PAINTED_MEDALS = new Set(MEDALS.map(m => m.id));
/** Not won yet: the painted art in soft grey. */
const greyFilter = (id: string) => `<filter id="${id}grey" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".5" intercept=".46"/><feFuncG type="linear" slope=".5" intercept=".45"/><feFuncB type="linear" slope=".5" intercept=".5"/></feComponentTransfer></filter>`;
/** A painted sparkle that twinkles (the legendary stickers, the gold and rainbow medals). */
const twinkle = (x: number, y: number, r: number, begin: number, anim: boolean) =>
  `<image href="${iconUrl('sparkle')}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}"${anim ? ` opacity="0"><animate attributeName="opacity" values="0;1;0" dur="2s" begin="${begin}s" repeatCount="indefinite"/></image>` : '/>'}`;

let SID = 0;

function starD(cx: number, cy: number, r1: number, r2: number, n: number, rot = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) { const a = ((rot + (i * 180) / n) * Math.PI) / 180, r = i % 2 ? r2 : r1; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ',' + (cy + Math.sin(a) * r).toFixed(1); }
  return d + 'Z';
}

export function shapePath(shape: StickerShape): string {
  switch (shape) {
    case 'circle': return 'M100,14 a86,86 0 1 1 0,172 a86,86 0 1 1 0,-172 Z';
    case 'star': return starD(100, 106, 96, 62, 5);
    case 'heart': return 'M100,184 C34,140 10,106 14,70 C18,36 50,18 76,26 C88,30 96,40 100,50 C104,40 112,30 124,26 C150,18 182,36 186,70 C190,106 166,140 100,184 Z';
    case 'cloud': return 'M52,160 C24,160 12,136 22,116 C8,98 20,70 46,72 C46,44 76,30 98,44 C112,22 150,26 156,56 C182,56 196,84 182,104 C198,124 184,160 152,160 Z';
    case 'shield': return 'M100,12 L176,36 L172,104 C168,146 136,172 100,188 C64,172 32,146 28,104 L24,36 Z';
    case 'burst': return starD(100, 100, 92, 74, 14);
    case 'ticket': return 'M24,40 Q24,28 36,28 L164,28 Q176,28 176,40 L176,82 A18,18 0 0 0 176,118 L176,160 Q176,172 164,172 L36,172 Q24,172 24,160 L24,118 A18,18 0 0 0 24,82 Z';
    case 'hex': return 'M100,12 Q106,12 112,15 L172,50 Q180,55 180,64 L180,136 Q180,145 172,150 L112,185 Q106,188 100,188 Q94,188 88,185 L28,150 Q20,145 20,136 L20,64 Q20,55 28,50 L88,15 Q94,12 100,12 Z';
  }
}

function bgPattern(id: string, bg: StickerDef['bg'], h1: number, h2: number): { defs: string; fill: string; over: string } {
  const a = `hsl(${h1} 80% 84%)`, b = `hsl(${h2} 80% 76%)`, c = `hsl(${h1} 70% 74%)`;
  const grad = `<radialGradient id="${id}g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  let over = '';
  switch (bg) {
    case 'rays': for (let i = 0; i < 18; i++) { const a0 = (i * 20) * Math.PI / 180, a1 = (i * 20 + 10) * Math.PI / 180; over += `<path d="M100,100 L${100 + Math.cos(a0) * 160},${100 + Math.sin(a0) * 160} L${100 + Math.cos(a1) * 160},${100 + Math.sin(a1) * 160} Z" fill="#fff" opacity=".28"/>`; } break;
    case 'dots': for (let y = 20; y < 200; y += 22) for (let x = (y / 22) % 2 ? 22 : 11; x < 200; x += 22) over += `<circle cx="${x}" cy="${y}" r="4" fill="#fff" opacity=".45"/>`; break;
    case 'stripes': for (let x = -200; x < 200; x += 26) over += `<path d="M${x},0 L${x + 13},0 L${x + 213},200 L${x + 200},200 Z" fill="#fff" opacity=".3"/>`; break;
    case 'confetti': for (let i = 0; i < 26; i++) { const x = (i * 53) % 190 + 5, y = (i * 37) % 190 + 5; over += `<rect x="${x}" y="${y}" width="9" height="5" rx="2" fill="hsl(${(i * 47) % 360 < 20 || (i * 47) % 360 > 300 ? 338 : [52, 160, 200, 268, 338][i % 5]} 85% 72%)" transform="rotate(${i * 33} ${x + 4} ${y + 2})"/>`; } break;
    case 'stars': for (let i = 0; i < 14; i++) { const x = (i * 61) % 180 + 10, y = (i * 43) % 180 + 10; over += `<path d="${starD(x, y, 6 + (i % 3) * 2, 3, 5)}" fill="#fff" opacity=".7"/>`; } break;
    case 'waves': for (let y = 10; y < 200; y += 24) over += `<path d="M0,${y} q25,-10 50,0 t50,0 t50,0 t50,0" stroke="#fff" stroke-width="6" fill="none" opacity=".4"/>`; break;
    case 'checks': for (let y = 0; y < 200; y += 25) for (let x = (y / 25) % 2 ? 0 : 25; x < 200; x += 50) over += `<rect x="${x}" y="${y}" width="25" height="25" fill="#fff" opacity=".22"/>`; break;
    case 'plain': break;
  }
  return { defs: grad, fill: `url(#${id}g)`, over: over + `<rect width="200" height="200" fill="${c}" opacity="0"/>` };
}

function propArt(def: StickerDef): string {
  const d = '#3b2b4f';
  switch (def.prop) {
    case 'ride': return `<g transform="translate(128 26) scale(1.25)"><circle cx="24" cy="24" r="24" fill="#fff" opacity=".9"/><g transform="translate(6 6) scale(.75)">${rideIcon(def.ride ?? 1, `hsl(${def.hue} 60% 50%)`)}</g></g>`;
    case 'mountain': return `<path d="M-10,170 L46,92 L76,128 L104,96 L170,170 Z" fill="#fff" opacity=".55"/><path d="M46,92 L56,106 L46,102 L38,108 Z M104,96 L114,110 L104,106 L96,112 Z" fill="#fff"/>`;
    case 'star': return `<path d="${starD(160, 40, 22, 10, 5)}" fill="hsl(48 98% 64%)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
    case 'trophy': case 'medal': return `<g transform="translate(140 18)"><circle cx="20" cy="26" r="17" fill="hsl(48 95% 62%)" stroke="#fff" stroke-width="3"/><path d="${starD(20, 26, 9, 4, 5)}" fill="#fff"/></g>`;
    case 'number': return '';
    case 'treasure': return `<g transform="translate(138 20)"><path d="M4,22 Q4,10 22,10 Q40,10 40,22 Z" fill="hsl(36 70% 55%)" stroke="#fff" stroke-width="3"/><rect x="2" y="22" width="40" height="22" rx="4" fill="hsl(30 65% 48%)" stroke="#fff" stroke-width="3"/><rect x="18" y="20" width="8" height="10" rx="2" fill="hsl(48 95% 62%)"/><circle cx="12" cy="12" r="3" fill="#fff"/></g>`;
    case 'music': return `<g transform="translate(142 16)" fill="hsl(${def.hue} 70% 58%)" stroke="#fff" stroke-width="3"><path d="M14,40 L14,6 L38,0 L38,34" fill="none" stroke-width="7" stroke-linecap="round"/><path d="M14,40 L14,6 L38,0 L38,34" fill="none" stroke="hsl(${def.hue} 70% 58%)" stroke-width="3.5" stroke-linecap="round"/><ellipse cx="8" cy="40" rx="8" ry="6"/><ellipse cx="32" cy="34" rx="8" ry="6"/></g>`;
    case 'heart': return `<path d="M162,58 C140,44 136,28 148,22 C156,18 162,24 162,30 C162,24 168,18 176,22 C188,28 184,44 162,58 Z" fill="hsl(345 85% 66%)" stroke="#fff" stroke-width="3"/>`;
    case 'book': return `<g transform="translate(136 26) rotate(-8)"><path d="M0,6 Q14,0 26,6 L26,36 Q14,30 0,36 Z" fill="#fff"/><path d="M26,6 Q38,0 52,6 L52,36 Q38,30 26,36 Z" fill="#f2eefa"/><path d="M26,6 L26,36" stroke="hsl(${def.hue} 50% 60%)" stroke-width="2"/></g>`;
    case 'clock': return `<g transform="translate(140 20)"><circle cx="20" cy="22" r="19" fill="#fff" stroke="hsl(${def.hue} 60% 60%)" stroke-width="3"/><path d="M20,10 L20,22 L29,27" stroke="${d}" stroke-width="3" stroke-linecap="round" fill="none"/></g>`;
    case 'crown': return `<path d="M76,34 L74,12 L88,24 L100,6 L112,24 L126,12 L124,34 Z" fill="hsl(48 95% 62%)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
    case 'bolt': return `<path d="M164,10 L140,48 L156,48 L148,76 L176,34 L160,34 Z" fill="hsl(52 98% 64%)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`;
    case 'target': return `<g transform="translate(140 18)"><circle cx="20" cy="22" r="19" fill="#fff"/><circle cx="20" cy="22" r="13" fill="hsl(${def.hue} 70% 66%)"/><circle cx="20" cy="22" r="7" fill="#fff"/><circle cx="20" cy="22" r="3" fill="hsl(${def.hue} 70% 50%)"/></g>`;
  }
  return '';
}

export type StickerRender = { svg: string };

/**
 * A full sticker <svg>. `image` is a picture of the 3D buddy in the sticker's pose (see
 * three/snapshot.ts); until it's ready the sticker shows the buddy's portrait.
 */
export function renderSticker(def: StickerDef, friend: FriendId, _look: Look, opts: { locked?: boolean; outfit?: string; animate?: boolean; image?: string | null } = {}): string {
  if (PAINTED_STICKERS.has(def.id)) return paintedSticker(def, friend, opts);
  const id = 'st' + (SID++);
  const shape = shapePath(def.shape);
  const bg = bgPattern(id, def.bg, def.hue, def.hue2);
  const img = opts.image ?? `${import.meta.env.BASE_URL}portraits/${friend}.png`;
  const locked = !!opts.locked;
  const anim = opts.animate !== false;
  const nameSize = def.name.length > 14 ? 15 : def.name.length > 10 ? 17 : 19;
  let fx = '';
  if (!locked && (def.rarity === 'rare' || def.rarity === 'epic' || def.rarity === 'legendary')) {
    fx += `<linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>${anim ? `<animate attributeName="x1" values="-1;1.2" dur="3.2s" repeatCount="indefinite"/><animate attributeName="x2" values="0;2.2" dur="3.2s" repeatCount="indefinite"/>` : ''}</linearGradient>`;
  }
  if (!locked && (def.rarity === 'epic' || def.rarity === 'legendary')) {
    fx += `<linearGradient id="${id}holo" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="hsl(338 100% 75%)"/><stop offset=".2" stop-color="hsl(52 100% 72%)"/><stop offset=".4" stop-color="hsl(160 90% 70%)"/><stop offset=".6" stop-color="hsl(200 100% 74%)"/><stop offset=".8" stop-color="hsl(268 100% 78%)"/><stop offset="1" stop-color="hsl(338 100% 75%)"/>${anim ? `<animateTransform attributeName="gradientTransform" type="translate" values="-0.6 0; 0.6 0; -0.6 0" dur="5s" repeatCount="indefinite"/>` : ''}</linearGradient>`;
  }
  const rim = def.rarity === 'legendary' ? 'hsl(48 95% 62%)' : '#fff';
  const sparkles = !locked && def.rarity === 'legendary' ? [[30, 40, 0], [170, 150, 0.7], [160, 30, 1.4], [36, 150, 2.1]].map(([x, y, b]) => `<path d="M${x},${y - 9} Q${x},${y} ${x + 9},${y} Q${x},${y} ${x},${y + 9} Q${x},${y} ${x - 9},${y} Q${x},${y} ${x},${y - 9} Z" fill="#fff">${anim ? `<animate attributeName="opacity" values="0;1;0" dur="2s" begin="${b}s" repeatCount="indefinite"/>` : ''}</path>`).join('') : '';
  const num = def.number && !locked ? `<g transform="translate(150 36)"><circle r="21" fill="#fff"/><circle r="17" fill="hsl(${def.hue} 70% 58%)"/><text y="6" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${def.number.length > 2 ? 12 : 16}" fill="#fff">${def.number}</text></g>` : '';
  return `<svg class="sticker rar-${def.rarity}${locked ? ' locked' : ''}" viewBox="-6 -6 212 212" role="img" aria-label="${def.name}">
    <defs>${bg.defs}${fx}<clipPath id="${id}c"><path d="${shape}"/></clipPath>
      <filter id="${id}ds" x="-15%" y="-15%" width="130%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#2a1b3d" flood-opacity=".28"/></filter></defs>
    <path d="${shape}" fill="${rim}" stroke="${rim}" stroke-width="14" stroke-linejoin="round" filter="url(#${id}ds)"/>
    <g clip-path="url(#${id}c)" ${locked ? 'opacity=".55"' : ''}>
      <rect width="200" height="200" fill="${locked ? '#ece8f3' : bg.fill}"/>
      ${locked ? '' : bg.over}
      ${locked ? '' : propArt(def)}
      <image href="${img}" x="22" y="14" width="156" height="148" preserveAspectRatio="xMidYMax meet" ${locked ? 'filter="url(#lockedfx)"' : ''}/>
      ${num}
      ${def.rarity === 'epic' || def.rarity === 'legendary' ? `<rect width="200" height="200" fill="url(#${id}holo)" opacity="${locked ? 0 : 0.28}" style="mix-blend-mode:overlay"/>` : ''}
      ${!locked && def.rarity !== 'common' ? `<rect width="200" height="200" fill="url(#${id}sh)"/>` : ''}
    </g>
    ${locked ? `<text x="100" y="112" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="56" fill="#cfc6e0">?</text>` : ''}
    <g transform="translate(100 170)">
      <path d="M-78,-14 L78,-14 L70,0 L78,14 L-78,14 L-70,0 Z" fill="${locked ? '#d9d2e6' : `hsl(${def.hue} 60% 52%)`}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
      <text y="6" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${nameSize}" fill="#fff">${locked ? '???' : def.name}</text>
    </g>
    ${sparkles}
  </svg>`;
}

/**
 * A sticker with painted art: the die-cut backing (white edge, glossy patterned paper, its prop) under the
 * buddy, and the painted ribbon and number badge over it, with the name and number as text on top. The
 * shine, foil and sparkles of the rarer ones play over it as before.
 */
function paintedSticker(def: StickerDef, friend: FriendId, opts: { locked?: boolean; animate?: boolean; image?: string | null }): string {
  const id = 'st' + (SID++);
  const shape = shapePath(def.shape);
  const img = opts.image ?? `${import.meta.env.BASE_URL}portraits/${friend}.png`;
  const locked = !!opts.locked;
  const anim = opts.animate !== false;
  const nameSize = def.name.length > 14 ? 15 : def.name.length > 10 ? 17 : 19;
  let fx = '';
  if (!locked && def.rarity !== 'common') {
    fx += `<linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>${anim ? `<animate attributeName="x1" values="-1;1.2" dur="3.2s" repeatCount="indefinite"/><animate attributeName="x2" values="0;2.2" dur="3.2s" repeatCount="indefinite"/>` : ''}</linearGradient>`;
  }
  if (!locked && (def.rarity === 'epic' || def.rarity === 'legendary')) {
    fx += `<linearGradient id="${id}holo" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="hsl(338 100% 75%)"/><stop offset=".2" stop-color="hsl(52 100% 72%)"/><stop offset=".4" stop-color="hsl(160 90% 70%)"/><stop offset=".6" stop-color="hsl(200 100% 74%)"/><stop offset=".8" stop-color="hsl(268 100% 78%)"/><stop offset="1" stop-color="hsl(338 100% 75%)"/>${anim ? `<animateTransform attributeName="gradientTransform" type="translate" values="-0.6 0; 0.6 0; -0.6 0" dur="5s" repeatCount="indefinite"/>` : ''}</linearGradient>`;
  }
  const grey = locked ? ` filter="url(#${id}grey)"` : '';
  const num = def.number && !locked ? `<text x="150" y="42" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${def.number.length > 2 ? 12 : 16}" fill="#fff" stroke="rgba(40,20,70,.25)" stroke-width="2" paint-order="stroke">${def.number}</text>` : '';
  const sparkles = !locked && def.rarity === 'legendary' ? [[30, 40, 0], [170, 150, 0.7], [160, 30, 1.4], [36, 150, 2.1]].map(([x, y, b]) => twinkle(x, y, 11, b, anim)).join('') : '';
  return `<svg class="sticker rar-${def.rarity}${locked ? ' locked' : ''}" viewBox="-6 -6 212 212" role="img" aria-label="${locked ? 'A sticker to win' : def.name}">
    <defs>${fx}${locked ? greyFilter(id) : ''}<clipPath id="${id}c"><path d="${shape}"/></clipPath></defs>
    <image href="${stickerArtUrl(def.id)}" x="-6" y="-6" width="212" height="212"${grey}/>
    <g clip-path="url(#${id}c)">
      <image href="${img}" x="22" y="14" width="156" height="148" preserveAspectRatio="xMidYMax meet" ${locked ? 'filter="url(#lockedfx)" opacity=".55"' : ''}/>
      ${def.rarity === 'epic' || def.rarity === 'legendary' ? `<rect width="200" height="200" fill="url(#${id}holo)" opacity="${locked ? 0 : 0.22}" style="mix-blend-mode:overlay"/>` : ''}
      ${!locked && def.rarity !== 'common' ? `<rect width="200" height="200" fill="url(#${id}sh)"/>` : ''}
    </g>
    <image href="${stickerArtUrl(def.id + '-front')}" x="-6" y="-6" width="212" height="212"${grey}/>
    ${num}
    ${locked ? `<text x="100" y="112" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="56" fill="#cfc6e0">?</text>` : ''}
    <text x="100" y="176" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${nameSize}" fill="#fff" stroke="rgba(40,20,70,.28)" stroke-width="2.4" paint-order="stroke">${locked ? '???' : def.name}</text>
    ${sparkles}
  </svg>`;
}

/** A medal with painted art: the whole medal for its tier; not won yet, the Rose one in soft grey. */
function paintedMedal(award: AwardDef, tier: number, opts: { locked?: boolean; animate?: boolean }): string {
  const id = 'md' + (SID++);
  const locked = !!opts.locked || tier < 0;
  const T = locked ? 0 : Math.min(3, Math.max(0, tier));
  const anim = opts.animate !== false && !locked;
  const sparkles = locked ? '' : T === 2 ? twinkle(160, 92, 12, 0.3, anim) : T === 3 ? twinkle(162, 88, 13, 0.2, anim) + twinkle(40, 104, 9, 1.1, anim) + twinkle(160, 200, 9, 1.8, anim) : '';
  return `<svg class="medal tier-${locked ? -1 : T}" viewBox="0 0 200 230" role="img" aria-label="${award.name}">
    ${locked ? `<defs>${greyFilter(id)}</defs>` : ''}
    <image href="${medalArtUrl(award.id, T)}" x="0" y="0" width="200" height="230" preserveAspectRatio="xMidYMid meet"${locked ? ` filter="url(#${id}grey)" opacity=".75"` : ''}/>
    ${sparkles}
  </svg>`;
}

// ---------- medals ----------
// Medals are glossy collectibles: a patterned ribbon, a bevelled metal rim, an enamel face with
// its own illustration, and extras that pile up by tier. Rose is a smooth pink rim with beads;
// Silver adds a scalloped edge and a crisp glint; Gold adds a sunburst, gems and sparkles; Rainbow
// turns rim, rays, ribbon and face holographic. Every hue goes through safeHue(), so no orange,
// amber or bronze can sneak in (hues 13–49 are pushed to pink or lemon), and no gradient runs
// from pink straight into yellow (that midpoint is orange). Animations are SMIL only: a shine
// sweep, twinkling sparkles, and for Rainbow a drifting foil and slowly turning rays.

type TierLook = { name: string; a: string; b: string; c: string; pill: string; ink: string };
/** Tier colours for UI chips: `b` is a solid colour that takes white text, `pill` a CSS background, `ink` its text colour. */
export const TIER_LOOK: TierLook[] = [
  { name: 'Rose', a: 'hsl(345 100% 88%)', b: 'hsl(340 82% 58%)', c: 'hsl(334 72% 42%)', pill: 'linear-gradient(135deg, hsl(345 100% 72%), hsl(336 82% 52%))', ink: '#fff' },
  { name: 'Silver', a: 'hsl(200 80% 95%)', b: 'hsl(210 32% 58%)', c: 'hsl(216 30% 42%)', pill: 'linear-gradient(135deg, hsl(200 55% 78%), hsl(212 34% 52%))', ink: '#fff' },
  { name: 'Gold', a: 'hsl(57 100% 80%)', b: 'hsl(51 100% 43%)', c: 'hsl(51 100% 36%)', pill: 'linear-gradient(135deg, hsl(58 100% 70%), hsl(53 100% 50%))', ink: '#3b2b4f' },
  { name: 'Rainbow', a: 'hsl(300 100% 92%)', b: 'hsl(268 75% 62%)', c: 'hsl(258 60% 46%)', pill: 'linear-gradient(90deg, hsl(336 90% 60%), hsl(268 80% 62%), hsl(200 85% 50%), hsl(160 70% 40%))', ink: '#fff' },
];

const RAD = Math.PI / 180;
const f1 = (n: number) => +n.toFixed(1);
const CX = 100, CY = 144; // disc centre in the 200x230 medal box

/** Keep every hue out of the orange/amber/brown band. */
const safeHue = (h: number) => {
  h = ((h % 360) + 360) % 360;
  return h > 12 && h < 32 ? 348 : h >= 32 && h < 50 ? 53 : h;
};

type Paint = { c: (h: number, s: number, l: number) => string; ink: string; w: string };
const paint = (locked: boolean): Paint => locked
  ? { c: (_h, s, l) => `hsl(262 ${Math.min(s, 16)}% ${Math.round(80 + l * 0.15)}%)`, ink: 'hsl(262 16% 72%)', w: 'hsl(262 30% 97%)' }
  : { c: (h, s, l) => `hsl(${safeHue(h)} ${s}% ${l}%)`, ink: 'hsl(270 50% 16%)', w: '#fff' };
/** Every colour becomes ink: the illustration's drop shadow. */
const shadowPaint = (ink: string): Paint => ({ c: () => ink, ink, w: ink });

const pal = (k: Paint) => ({
  pink: k.c(338, 92, 62), pinkL: k.c(340, 100, 84), mag: k.c(318, 90, 58),
  red: k.c(352, 88, 58),
  lemon: k.c(55, 100, 60), lemonD: k.c(52, 100, 45), lemonL: k.c(58, 100, 85),
  mint: k.c(158, 68, 56), sky: k.c(200, 92, 62), skyL: k.c(198, 100, 86),
  violet: k.c(268, 82, 68), violetL: k.c(268, 100, 88), violetD: k.c(266, 58, 50),
  w: k.w, ink: k.ink,
});

/** Shapes with one shared ink outline, then each filled. Shapes carry no fill of their own. */
function lay(k: Paint, parts: [string, string][], w = 6): string {
  return `<g fill="${k.ink}" stroke="${k.ink}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${parts.map(p => p[0]).join('')}</g>`
    + parts.map(([s, f]) => `<g fill="${f}">${s}</g>`).join('');
}
/** A stroked line with an ink outline. */
const ln = (k: Paint, d: string, color: string, w: number) =>
  `<path d="${d}" fill="none" stroke="${k.ink}" stroke-width="${w + 3.6}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** A plump four-point sparkle centred on 0,0. */
const spark = (r: number) => { const q = f1(r * 0.2); return `M0,${-r} Q${q},${-q} ${r},0 Q${q},${q} 0,${r} Q${-q},${q} ${-r},0 Q${-q},${-q} 0,${-r} Z`; };
const sparkAt = (k: Paint, x: number, y: number, r: number, fill = k.w) =>
  `<path transform="translate(${x} ${y})" d="${spark(r)}" fill="${fill}" stroke="${k.ink}" stroke-width="2.2" stroke-linejoin="round"/>`;
function arcD(cx: number, cy: number, r: number, a0: number, a1: number) {
  const x0 = cx + Math.cos(a0 * RAD) * r, y0 = cy + Math.sin(a0 * RAD) * r, x1 = cx + Math.cos(a1 * RAD) * r, y1 = cy + Math.sin(a1 * RAD) * r;
  return `M${f1(x0)},${f1(y0)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f1(x1)},${f1(y1)}`;
}
const glint = (k: Paint, d: string, w = 2.8) => `<path d="${d}" fill="none" stroke="${k.w}" stroke-width="${w}" stroke-linecap="round" opacity=".75"/>`;

// ----- shared illustration parts (drawn around 0,0; the face is r=51) -----
const FLAME = 'M0,-38 C5,-26 22,-18 22,4 C22,21 12,31 0,31 C-12,31 -22,21 -22,4 C-22,-8 -15,-14 -11,-24 C-8,-15 -5,-11 -3,-11 C-7,-21 -5,-30 0,-38 Z';
const FLAME_IN = 'M1,-12 C5,-4 13,1 13,11 C13,21 7,27 0,27 C-7,27 -13,21 -13,12 C-13,5 -9,1 -7,-5 C-5,1 -2,2 1,-12 Z';

function keyboard(k: Paint, x: number, y: number, w: number, h: number) {
  const p = pal(k), cols = [p.pink, p.lemon, p.mint, p.sky, p.violet];
  const pad = 4.5, gap = 2.2, kw = (w - pad * 2 - gap * 4) / 5, kh = (h - pad * 2 - gap * 2) / 3;
  const x0 = x - w / 2 + pad, y0 = y - h / 2 + pad;
  const key = (c: number, r: number, span: number, fill: string) =>
    `<rect x="${f1(x0 + c * (kw + gap))}" y="${f1(y0 + r * (kh + gap))}" width="${f1(kw * span + gap * (span - 1))}" height="${f1(kh)}" rx="1.8" fill="${fill}"/>`;
  let keys = '';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) keys += key(c, r, 1, cols[(c + r * 2) % 5]);
  keys += key(0, 2, 1, cols[3]) + key(1, 2, 3, p.violetL) + key(4, 2, 1, cols[0]);
  return lay(k, [[`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="6"/>`, p.w]], 6) + keys;
}

function closedEye(k: Paint, x: number, y: number, r: number) {
  const p = pal(k), sw = f1(r * 0.2);
  const lash = (dx: number, dy: number, lx: number, ly: number) => `M${f1(x + dx)},${f1(y + dy)} l${f1(lx)},${f1(ly)}`;
  return lay(k, [[`<circle cx="${x}" cy="${y}" r="${r}"/>`, p.w]], 5)
    + `<path d="M${f1(x - r * 0.6)},${f1(y - r * 0.15)} Q${x},${f1(y + r * 0.55)} ${f1(x + r * 0.6)},${f1(y - r * 0.15)}" fill="none" stroke="${p.ink}" stroke-width="${sw}" stroke-linecap="round"/>`
    + `<path d="${lash(-r * 0.36, r * 0.1, -r * 0.16, r * 0.28)} ${lash(0, r * 0.2, 0, r * 0.32)} ${lash(r * 0.36, r * 0.1, r * 0.16, r * 0.28)}" stroke="${p.ink}" stroke-width="${f1(sw * 0.8)}" stroke-linecap="round"/>`;
}

/** A cartoon glove hand, palm out, fingers up; origin at the wrist. */
function hand(k: Paint, x: number, y: number, s: number, rot: number, flip: boolean, cuff: string) {
  const fingers = '<rect x="-9.2" y="-28" width="4.6" height="16" rx="2.3"/><rect x="-4.5" y="-32" width="4.6" height="20" rx="2.3"/><rect x="0.2" y="-31" width="4.6" height="19" rx="2.3"/><rect x="4.9" y="-26" width="4.6" height="14" rx="2.3"/>';
  const thumb = '<rect x="-2" y="-2.4" width="13" height="4.8" rx="2.4" transform="translate(-8 -6) rotate(-145)"/>';
  const palm = '<rect x="-9.4" y="-17" width="18.8" height="18" rx="7"/>';
  const band = '<rect x="-10.5" y="-1" width="21" height="7" rx="2.5"/>';
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})">`
    + `<g fill="${k.ink}" stroke="${k.ink}" stroke-width="5" stroke-linejoin="round">${fingers}${thumb}${palm}${band}</g>`
    + `<g fill="${k.w}" stroke="${k.ink}" stroke-width="1.3">${fingers}${thumb}</g><g fill="${k.w}">${palm}</g><g fill="${cuff}">${band}</g></g>`;
}

const crown = (k: Paint, x: number, y: number, s: number) => { const p = pal(k); return `<g transform="translate(${x} ${y}) scale(${s})">`
  + lay(k, [['<path d="M-15,7 L-17,-9 L-7,-2 L0,-14 L7,-2 L17,-9 L15,7 Z"/>', p.lemon]], 5)
  + `<circle cx="0" cy="0" r="2.6" fill="${p.pink}"/><circle cx="-9" cy="2" r="1.8" fill="${p.sky}"/><circle cx="9" cy="2" r="1.8" fill="${p.mint}"/></g>`; };

// ----- per-medal illustrations -----
type Draw = (k: Paint, id: string) => string;
type MedalSpec = { face: number; ribbon: [number, number]; pattern: 'stripe' | 'split' | 'dots' | 'stars'; night?: boolean; draw: Draw };

const D: Record<string, Draw> = {
  broom: (k) => { const p = pal(k);
    return '<g transform="rotate(38) translate(0 -2)">'
      + lay(k, [
        ['<rect x="-3.2" y="-40" width="6.4" height="36" rx="3.2"/>', p.violet],
        ['<path d="M-11,6 L11,6 L24,32 Q0,40 -24,32 Z"/>', p.lemon],
        ['<rect x="-11.5" y="-8" width="23" height="15" rx="4"/>', p.pink],
      ])
      + `<path d="M-4,10 L-10,32 M0,10 L0,35 M4,10 L10,32" stroke="${p.lemonD}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      + glint(k, 'M-7,-4 L-7,3', 2.4) + '</g>'
      + sparkAt(k, -22, -20, 10) + sparkAt(k, 27, 14, 7) + sparkAt(k, 2, 37, 5); },
  target: (k) => { const p = pal(k);
    return '<g transform="translate(-5 5)">' + lay(k, [['<circle r="30"/>', p.red]])
      + `<circle r="22" fill="${p.w}"/><circle r="14" fill="${p.red}"/><circle r="6.5" fill="${p.lemon}" stroke="${p.ink}" stroke-width="1.6"/></g>`
      + ln(k, 'M-5,5 L27,-27', p.violet, 3.4)
      + lay(k, [['<path d="M23,-23 L35,-35 L41,-25 L32,-17 Z"/>', p.pink], ['<path d="M23,-23 L35,-35 L25,-41 L17,-32 Z"/>', p.pinkL]], 4); },
  paw: (k) => { const p = pal(k);
    const toe = (x: number, y: number, rx: number, ry: number, r: number) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${x} ${y})"/>`;
    return '<g transform="translate(0 -8)">' + lay(k, [
      ['<path d="M0,-2 C9,-2 18,6 18,14 C18,22 10,24 0,22 C-10,24 -18,22 -18,14 C-18,6 -9,-2 0,-2 Z"/>', p.pink],
      [toe(-19, -12, 5.5, 7, -24) + toe(-7, -21, 6, 7.5, -8) + toe(7, -21, 6, 7.5, 8) + toe(19, -12, 5.5, 7, 24), p.pink],
    ], 5)
      + `<g fill="${p.w}" opacity=".75"><ellipse cx="-7" cy="5" rx="5" ry="3" transform="rotate(-20 -7 5)"/><circle cx="-20" cy="-15" r="1.8"/><circle cx="-8" cy="-24" r="2"/><circle cx="6" cy="-24" r="2"/><circle cx="18" cy="-15" r="1.8"/></g></g>`
      + ln(k, 'M-28,31 q7,-7 14,0 t14,0 t14,0 t14,0', p.lemon, 4); },
  trophy: (k) => { const p = pal(k);
    return ln(k, 'M-16,-24 C-31,-24 -30,-4 -12,-5 M16,-24 C31,-24 30,-4 12,-5', p.lemon, 4.4)
      + lay(k, [
        ['<path d="M-19,-31 L19,-31 L17,-9 C15,4 7,10 0,10 C-7,10 -15,4 -17,-9 Z"/>', p.lemon],
        ['<rect x="-4.5" y="8" width="9" height="11"/>', p.lemonD],
        ['<rect x="-17" y="18" width="34" height="13" rx="3.5"/>', p.pink],
      ])
      + `<rect x="-9" y="21.5" width="18" height="6" rx="1.5" fill="${p.lemonL}"/><path d="${starD(0, -13, 9, 4, 5)}" fill="${p.w}"/>`
      + glint(k, 'M-13,-26 Q-13,-8 -5,3', 2.6); },
  flag: (k, id) => { const p = pal(k);
    const flag = 'M-19,-32 C-6,-38 8,-26 32,-32 L32,0 C8,6 -6,-6 -19,0 Z';
    let sq = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) sq += `<rect x="${f1(-19 + c * 8.6)}" y="${-40 + r * 9}" width="8.6" height="9"/>`;
    return ln(k, 'M10,14 L34,14 M2,24 L28,24', p.lemon, 3)
      + ln(k, 'M-23,-36 L-23,36', p.violet, 4.5) + `<circle cx="-23" cy="-38" r="4.5" fill="${p.lemon}" stroke="${p.ink}" stroke-width="2.4"/>`
      + lay(k, [[`<path d="${flag}"/>`, p.w]])
      + `<clipPath id="${id}fl"><path d="${flag}"/></clipPath><g clip-path="url(#${id}fl)" fill="${p.ink}">${sq}</g>`; },
  skate: (k) => { const p = pal(k);
    return '<g transform="translate(4 4) rotate(-10)">'
      + lay(k, [['<path d="M-22,1 L-14,1 L-16,8 L-20,8 Z"/><path d="M14,1 L22,1 L20,8 L16,8 Z"/>', p.violetL]], 4)
      + ln(k, 'M-38,-6 Q-37,0 -30,0 L30,0 Q37,0 38,-6', p.pink, 6.5)
      + `<path d="M-28,-1.6 L28,-1.6" stroke="${p.lemon}" stroke-width="2.2" stroke-linecap="round"/>`
      + lay(k, [['<circle cx="-18" cy="12" r="7"/>', p.lemon], ['<circle cx="18" cy="12" r="7"/>', p.lemon]], 5)
      + `<circle cx="-18" cy="12" r="2.4" fill="${p.w}"/><circle cx="18" cy="12" r="2.4" fill="${p.w}"/></g>`
      + ln(k, 'M-42,-14 L-32,-14 M-44,-3 L-36,-3', p.violet, 2.4) + sparkAt(k, 24, -24, 8); },
  bike: (k) => { const p = pal(k);
    const wheel = (x: number) => `<circle cx="${x}" cy="12" r="13" fill="none" stroke="${p.ink}" stroke-width="6.5"/><circle cx="${x}" cy="12" r="9.2" fill="none" stroke="${p.lemon}" stroke-width="2.2"/><circle cx="${x}" cy="12" r="3" fill="${p.w}" stroke="${p.ink}" stroke-width="1.6"/>`;
    return wheel(-18) + wheel(18)
      + ln(k, 'M-18,12 L-5,-9 L13,-9 L18,12 M-18,12 L1,12 L-5,-9 M1,12 L13,-9 M-5,-9 L-6,-13', p.pink, 4)
      + ln(k, 'M13,-9 L11,-18 L18,-19', p.violet, 3.2)
      + lay(k, [['<path d="M-14,-15 Q-7,-18 0,-15 Q-7,-12 -14,-15 Z"/>', p.violet]], 4)
      + `<circle cx="1" cy="12" r="3.6" fill="${p.lemon}" stroke="${p.ink}" stroke-width="2"/>`; },
  balloon: (k) => { const p = pal(k);
    const env = 'M0,-40 C20,-40 30,-26 30,-13 C30,1 16,11 8,17 L-8,17 C-16,11 -30,1 -30,-13 C-30,-26 -20,-40 0,-40 Z';
    const mid = 'M0,-40 C9,-40 14,-26 14,-13 C14,1 8,11 4,17 L-4,17 C-8,11 -14,1 -14,-13 C-14,-26 -9,-40 0,-40 Z';
    const core = 'M0,-40 C3,-40 5,-26 5,-13 C5,1 3,11 1.5,17 L-1.5,17 C-3,11 -5,1 -5,-13 C-5,-26 -3,-40 0,-40 Z';
    const cloud = (x: number, y: number) => `<path d="M${x - 9},${y + 4} a4.5,4.5 0 0 1 2,-8 a6,6 0 0 1 11,-1 a4.5,4.5 0 0 1 5,9 Z"/>`;
    return lay(k, [[cloud(-26, 26) + cloud(30, 4), p.w]], 4)
      + `<path d="M-7,17 L-6,26 M7,17 L6,26" stroke="${p.ink}" stroke-width="2.4"/>`
      + lay(k, [[`<path d="${env}"/>`, p.pink]]) + `<path d="${mid}" fill="${p.lemon}"/><path d="${core}" fill="${p.w}"/>`
      + `<path d="${env}" fill="none" stroke="${p.ink}" stroke-width="2.2"/><rect x="-9" y="13" width="18" height="5" rx="2" fill="${p.violet}" stroke="${p.ink}" stroke-width="2"/>`
      + lay(k, [['<rect x="-8" y="25" width="16" height="11" rx="2.5"/>', p.violet]], 5) + `<path d="M-8,29.5 h16" stroke="${p.violetL}" stroke-width="2"/>`
      + glint(k, 'M-23,-18 Q-21,-31 -11,-35', 3); },
  jetpack: (k) => { const p = pal(k);
    const flame = (x: number) => lay(k, [[`<path d="M${x - 6},14 Q${x - 8},26 ${x},39 Q${x + 8},26 ${x + 6},14 Z"/>`, p.pink]], 4) + `<path d="M${x - 3},14 Q${x - 4},22 ${x},31 Q${x + 4},22 ${x + 3},14 Z" fill="${p.lemon}"/>`;
    return flame(-11) + flame(11)
      + lay(k, [
        ['<path d="M-17,10 L-5,10 L-7,17 L-15,17 Z"/><path d="M5,10 L17,10 L15,17 L7,17 Z"/>', p.violetD],
        ['<rect x="-19" y="-32" width="16" height="44" rx="8"/><rect x="3" y="-32" width="16" height="44" rx="8"/>', p.w],
        ['<rect x="-6" y="-21" width="12" height="16" rx="3"/>', p.violet],
      ])
      + `<path d="M-19,-24 A8,8 0 0 1 -3,-24 Z M3,-24 A8,8 0 0 1 19,-24 Z" fill="${p.pink}"/><path d="M-19,-24 h16 M3,-24 h16" stroke="${p.ink}" stroke-width="2"/>`
      + `<rect x="-19" y="-10" width="16" height="6" fill="${p.sky}"/><rect x="3" y="-10" width="16" height="6" fill="${p.sky}"/>`
      + glint(k, 'M-15,-18 L-15,4', 2.4) + glint(k, 'M7,-18 L7,4', 2.4)
      + sparkAt(k, -31, -16, 6) + sparkAt(k, 31, -4, 5); },
  rocket: (k, id) => { const p = pal(k);
    const body = 'M0,-38 C13,-26 14,-8 11,14 L-11,14 C-14,-8 -13,-26 0,-38 Z';
    return sparkAt(k, -26, -22, 7) + sparkAt(k, -32, 12, 4.5) + sparkAt(k, 30, 22, 5)
      + '<g transform="rotate(38) translate(0 2)">'
      + lay(k, [['<path d="M-8,14 Q-10,28 0,40 Q10,28 8,14 Z"/>', p.pink]], 4) + `<path d="M-4.5,14 Q-5,24 0,32 Q5,24 4.5,14 Z" fill="${p.lemon}"/>`
      + lay(k, [['<path d="M-11,0 L-22,14 L-22,22 L-10,14 Z"/><path d="M11,0 L22,14 L22,22 L10,14 Z"/>', p.violet], [`<path d="${body}"/>`, p.w]])
      + `<clipPath id="${id}rk"><path d="${body}"/></clipPath><rect x="-15" y="-40" width="30" height="22" fill="${p.pink}" clip-path="url(#${id}rk)"/>`
      + `<path d="M-12.5,-18 L12.5,-18" stroke="${p.ink}" stroke-width="2"/>` + ln(k, 'M0,6 L0,20', p.violet, 2.4)
      + `<circle cy="-4" r="6.5" fill="${p.sky}" stroke="${p.ink}" stroke-width="2.6"/><circle cx="-2" cy="-6" r="2" fill="${p.w}"/>`
      + glint(k, 'M-7,-14 Q-8,0 -7,8', 2.4) + '</g>'; },
  rollers: (k) => { const p = pal(k);
    const boot = 'M-20,-30 L-2,-30 Q3,-30 3,-25 L4,-6 Q22,-5 27,4 Q29,10 24,11 L-24,11 Q-27,11 -27,7 L-27,-24 Q-27,-30 -20,-30 Z';
    return ln(k, 'M-44,-8 L-35,-8 M-46,4 L-37,4', p.violetL, 2.6)
      + '<g transform="translate(3 -1) rotate(-8)">'
      + lay(k, [['<circle cx="-15" cy="23" r="8"/><circle cx="15" cy="23" r="8"/>', p.sky]], 5)
      + `<circle cx="-15" cy="23" r="2.8" fill="${p.w}"/><circle cx="15" cy="23" r="2.8" fill="${p.w}"/>`
      + lay(k, [['<rect x="26" y="9" width="9" height="11" rx="4.5"/>', p.violet]], 4.5)
      + lay(k, [[`<path d="${boot}"/>`, p.pink], ['<rect x="-31" y="9" width="63" height="7" rx="3.5"/>', p.violet]])
      + `<path d="M-27,-24 Q-27,-30 -20,-30 L-2,-30 Q3,-30 3,-25 L3.2,-22 L-27,-22 Z" fill="${p.pinkL}"/><path d="M-27,-22 L3.2,-22" stroke="${p.ink}" stroke-width="2"/>`
      + `<path d="M6,-5.5 Q22,-4.5 26.5,4 Q28,9.5 24,10.5 L9,10.5 Q5,3 6,-5.5 Z" fill="${p.w}"/>`
      + `<path d="M-5,-16 l7,2 M-5,-10 l7.5,2" stroke="${p.w}" stroke-width="2.6" stroke-linecap="round"/>`
      + `<path d="${starD(-14, -5, 6.5, 3, 5)}" fill="${p.lemon}" stroke="${p.ink}" stroke-width="1.8" stroke-linejoin="round"/>`
      + glint(k, 'M-23,-17 L-23,3', 2.6) + '</g>'
      + sparkAt(k, 30, -27, 7) + sparkAt(k, -32, -26, 4.5); },
  kart: (k) => { const p = pal(k);
    const body = 'M-30,-2 Q-30,-8 -24,-8 L-2,-7 Q6,-6 12,-1 L33,4 Q39,6 38,11 Q37,15 32,15 L-28,15 Q-32,15 -32,11 Z';
    const puff = 'M-47,6 a4.5,4.5 0 0 1 3,-8 a5.5,5.5 0 0 1 10,0 a4,4 0 0 1 1,8 Z';
    return lay(k, [[puff, p.w]], 4)
      + ln(k, 'M-31,-22 L-30,-8 M-23,-22 L-23,-8', p.violetD, 2.4)
      + lay(k, [['<rect x="-40" y="-29" width="22" height="7" rx="3.5"/>', p.lemon]], 4.5)
      + ln(k, 'M16,-2 L9,-18', p.violetD, 3)
      + lay(k, [['<circle cx="-9" cy="-17" r="11"/>', p.mint]], 5)
      + `<path d="M-4,-24 Q3,-22 2.5,-14 L-5,-13.5 Q-7,-19 -4,-24 Z" fill="${p.skyL}" stroke="${p.ink}" stroke-width="1.8"/><path d="M-19,-14 Q-10,-11 -1,-12" stroke="${p.lemon}" stroke-width="2.6" fill="none"/>`
      + `<ellipse cx="9" cy="-20" rx="3" ry="8" transform="rotate(-24 9 -20)" fill="none" stroke="${p.ink}" stroke-width="3.4"/>`
      + lay(k, [[`<path d="${body}"/>`, p.pink]])
      + `<path d="M-27,7 L10,7 Q22,8 35,11" stroke="${p.w}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`
      + `<circle cx="-13" cy="4" r="6.5" fill="${p.w}" stroke="${p.ink}" stroke-width="2"/><path d="${starD(-13, 4.3, 4.6, 2, 5)}" fill="${p.violet}"/>`
      + glint(k, 'M-25,-4 L-6,-3', 2.4)
      + lay(k, [['<circle cx="-21" cy="18" r="9"/><circle cx="26" cy="19" r="7.5"/>', p.violetD]], 5)
      + `<circle cx="-21" cy="18" r="3.6" fill="${p.lemon}"/><circle cx="26" cy="19" r="3" fill="${p.lemon}"/>`
      + sparkAt(k, 30, -22, 6.5); },
  car: (k) => { const p = pal(k);
    const shell = 'M-36,0 Q-37,-8 -28,-9 L-13,-8 L-11,-3 L15,-3 L18,-8 Q21,-11 27,-10 L34,-7 Q41,-5 41,3 L41,8 Q41,13 36,13 L-34,13 Q-38,13 -38,8 Z';
    return ln(k, 'M-28,-9 L-27,-34', p.violetD, 2.2)
      + lay(k, [['<path d="M-27,-34 L-41,-29.5 L-26.6,-25 Z"/>', p.pink]], 3.5)
      + lay(k, [['<rect x="-15" y="-25" width="10" height="19" rx="5"/>', p.pinkL]], 4)
      + ln(k, 'M16,-3 L9,-13', p.violetD, 2.6)
      + `<ellipse cx="7" cy="-15" rx="2.6" ry="7" transform="rotate(-26 7 -15)" fill="none" stroke="${p.ink}" stroke-width="3"/>`
      + lay(k, [['<path d="M17,-5 L12,-24 Q12,-26 14,-26 L16,-26 L23,-6 Z"/>', p.skyL]], 4)
      + lay(k, [[`<path d="${shell}"/>`, p.sky]])
      + `<path d="M-33,3 Q0,6 38,2" stroke="${p.w}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`
      + `<circle cx="37" cy="-1" r="3.4" fill="${p.lemonL}" stroke="${p.ink}" stroke-width="1.8"/>`
      + glint(k, 'M-31,-5 L-17,-5 M22,-6 L32,-4', 2.4)
      + lay(k, [['<circle cx="-22" cy="14" r="9"/><circle cx="25" cy="14" r="9"/>', p.violetD]], 5)
      + `<circle cx="-22" cy="14" r="5" fill="${p.w}"/><circle cx="25" cy="14" r="5" fill="${p.w}"/><circle cx="-22" cy="14" r="2.4" fill="${p.pink}"/><circle cx="25" cy="14" r="2.4" fill="${p.pink}"/>`
      + sparkAt(k, 28, -26, 6.5) + sparkAt(k, -6, -34, 4); },
  prop: (k) => { const p = pal(k);
    const hull = 'M-36,-6 L-14,-7 Q8,-8 22,-6 Q32,-3 33,3 Q32,9 22,11 Q4,14 -14,10 L-36,2 Q-39,-2 -36,-6 Z';
    const cloud = (x: number, y: number) => `<path d="M${x - 9},${y + 4} a4.5,4.5 0 0 1 2,-8 a6,6 0 0 1 11,-1 a4.5,4.5 0 0 1 5,9 Z"/>`;
    return lay(k, [[cloud(-30, 30) + cloud(-40, 16), p.w]], 4)
      + '<g transform="translate(0 -3) rotate(-10)">'
      + lay(k, [['<path d="M-35,-6 L-40,-25 Q-40,-28 -37,-28 L-32,-28 Q-29,-28 -27,-25 L-20,-7 Z"/>', p.pink]], 5)
      + lay(k, [[`<path d="${hull}"/>`, p.lemon]])
      + `<path d="M-33,-1 Q0,5 30,2" stroke="${p.sky}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      + `<path d="M-9,-7 Q-1,-19 8,-7 Z" fill="${p.skyL}" stroke="${p.ink}" stroke-width="2.2" stroke-linejoin="round"/>`
      + lay(k, [['<path d="M28,-5 Q36,-2 37,3 Q36,8 28,10 Z"/>', p.pink]], 4)
      + lay(k, [['<path d="M-13,3 Q-13,-1 -8,-1 L14,-1 Q19,-1 19,3 Q19,7 14,7 L-8,7 Q-13,7 -13,3 Z"/>', p.sky]], 4.5)
      + `<circle cx="-25" cy="0" r="3.8" fill="${p.w}" stroke="${p.ink}" stroke-width="1.6"/><circle cx="-25" cy="0" r="1.8" fill="${p.pink}"/>`
      + `<ellipse cx="41" cy="3" rx="3.6" ry="21" fill="${p.w}" opacity=".75" stroke="${p.ink}" stroke-width="2"/>`
      + `<path d="M39.6,-14 Q41,-17 42.4,-14 L42.4,20 Q41,23 39.6,20 Z" fill="${p.violetD}"/>`
      + `<circle cx="41" cy="3" r="3" fill="${p.violet}" stroke="${p.ink}" stroke-width="1.6"/>`
      + glint(k, 'M-30,-3 L-10,-4 M12,-5 L24,-4', 2.4) + '</g>'
      + sparkAt(k, 26, -28, 6.5); },
  eagle: (k) => { const p = pal(k);
    const plum = k.c(292, 40, 50), plumL = k.c(292, 48, 70);
    const wing = 'M-6,-6 Q-20,-21 -38,-21 Q-45,-21 -43,-16 L-38,-14 L-45,-11 Q-47,-7 -42,-7 L-38,-6 L-44,-2 Q-45,3 -39,1 Q-24,0 -7,9 Z';
    const covert = 'M-8,-5 Q-20,-15 -33,-15 Q-27,-6 -10,2 Z';
    return lay(k, [
      [`<path d="${wing}"/><path d="${wing}" transform="scale(-1 1)"/>`, plum],
      ['<path d="M-8,14 L8,14 L13,32 L0,27 L-13,32 Z"/>', p.w],
      ['<ellipse cx="0" cy="5" rx="11" ry="16"/>', plum],
      ['<circle cx="0" cy="-17" r="11.5"/>', p.w],
    ])
      + `<path d="${covert}" fill="${plumL}"/><path d="${covert}" transform="scale(-1 1)" fill="${plumL}"/>`
      + `<ellipse cx="0" cy="10" rx="6" ry="8" fill="${plumL}" opacity=".8"/>`
      + `<path d="M-3,14 L-4,22 M3,14 L4,22" stroke="${p.ink}" stroke-width="1.6" opacity=".35"/>`
      + lay(k, [['<path d="M-4.5,-16 L4.5,-16 Q4.5,-9 0,-5.5 Q-4.5,-9 -4.5,-16 Z"/>', p.lemon]], 3.4)
      + `<circle cx="-5" cy="-20" r="2.6" fill="${p.ink}"/><circle cx="5" cy="-20" r="2.6" fill="${p.ink}"/><circle cx="-4.2" cy="-21" r=".9" fill="${p.w}"/><circle cx="5.8" cy="-21" r=".9" fill="${p.w}"/>`
      + `<path d="M-9,-25 Q-5,-27 -2,-25 M2,-25 Q5,-27 9,-25" stroke="${plum}" stroke-width="2" fill="none" stroke-linecap="round"/>`
      + `<g fill="${p.lemon}" stroke="${p.ink}" stroke-width="1.6"><ellipse cx="-4" cy="21" rx="2.6" ry="2"/><ellipse cx="4" cy="21" rx="2.6" ry="2"/></g>`
      + glint(k, 'M-8,-22 Q-7,-27 -2,-28', 2.2)
      + sparkAt(k, 30, -28, 6) + sparkAt(k, -31, 22, 4.5); },
  plane: (k, id) => { const p = pal(k);
    const body = 'M0,-40 Q7,-30 7,-14 L7,26 L4,33 L-4,33 L-7,26 L-7,-14 Q-7,-30 0,-40 Z';
    return sparkAt(k, -26, -24, 7) + sparkAt(k, 30, 22, 5)
      + '<g transform="rotate(40) translate(0 2)">'
      + lay(k, [['<path d="M-5,32 Q0,50 5,32 Z"/>', p.pink]], 4) + `<path d="M-2.6,32 Q0,43 2.6,32 Z" fill="${p.lemon}"/>`
      + lay(k, [
        ['<path d="M-6,-6 L-33,14 L-33,20 L-6,12 Z"/><path d="M6,-6 L33,14 L33,20 L6,12 Z"/>', p.violet],
        ['<path d="M-6,21 L-16,29 L-16,33 L-5,30 Z"/><path d="M6,21 L16,29 L16,33 L5,30 Z"/>', p.violet],
        [`<path d="${body}"/>`, p.sky],
      ])
      + `<clipPath id="${id}jt"><path d="${body}"/></clipPath><rect x="-8" y="-42" width="16" height="11" fill="${p.pink}" clip-path="url(#${id}jt)"/>`
      + `<path d="M-6.6,-31 L6.6,-31" stroke="${p.ink}" stroke-width="1.8"/>`
      + `<ellipse cx="0" cy="-16" rx="3.8" ry="8" fill="${p.skyL}" stroke="${p.ink}" stroke-width="2"/>`
      + `<path d="M0,-3 L0,22" stroke="${p.lemon}" stroke-width="2.6" stroke-linecap="round"/>`
      + glint(k, 'M-4,-26 L-4,-24 M-4,-6 L-4,20', 2.2) + '</g>'; },
  flame: (k) => { const p = pal(k);
    return lay(k, [[`<path d="${FLAME}"/>`, p.pink]]) + `<path d="${FLAME_IN}" fill="${p.lemon}"/><ellipse cx="0" cy="18" rx="5.5" ry="7" fill="${p.w}"/>`
      + glint(k, 'M-15,-2 Q-16,-12 -10,-18', 2.6)
      + `<g fill="${p.lemon}" stroke="${p.ink}" stroke-width="1.6"><circle cx="17" cy="-27" r="3"/><circle cx="25" cy="-14" r="2"/><circle cx="-22" cy="-24" r="2.2"/></g>`; },
  blaze: (k) => { const p = pal(k);
    const side = (x: number, rot: number) => `<g transform="translate(${x} 14) rotate(${rot}) scale(.55)">${lay(k, [[`<path d="${FLAME}"/>`, p.violet]], 9)}<path d="${FLAME_IN}" fill="${p.lemon}"/></g>`;
    return side(-21, -28) + side(21, 28)
      + `<g transform="translate(0 -3)">${lay(k, [[`<path d="${FLAME}"/>`, p.mag]])}<path d="${FLAME}" transform="translate(0 8) scale(.75)" fill="${p.pink}"/>`
      + `<path d="${FLAME_IN}" transform="translate(0 6) scale(.8)" fill="${p.lemon}"/><ellipse cx="0" cy="21" rx="4.2" ry="5.5" fill="${p.w}"/></g>`
      + glint(k, 'M-15,-4 Q-16,-14 -10,-20', 2.6) + sparkAt(k, 24, -28, 5) + sparkAt(k, -25, -28, 4); },
  bolt: (k) => { const p = pal(k);
    return `<g transform="translate(0 2) scale(1.08)">${lay(k, [[`<path d="${FLAME}"/>`, p.pink]], 5.5)}</g>`
      + lay(k, [['<path d="M7,-34 L-15,4 L-1,4 L-7,34 L17,-6 L3,-6 Z"/>', p.lemon]])
      + glint(k, 'M4,-27 L-9,1', 2.6) + sparkAt(k, 28, -26, 6) + sparkAt(k, -28, 22, 4.5); },
  heart: (k) => { const p = pal(k);
    const heart = 'M0,30 C-26,14 -33,-2 -31,-13 C-29,-27 -12,-32 0,-18 C12,-32 29,-27 31,-13 C33,-2 26,14 0,30 Z';
    return lay(k, [[`<path d="${heart}"/>`, p.pink]]) + glint(k, 'M-22,-13 Q-20,-23 -11,-24', 3.4)
      + `<g transform="translate(2 2) rotate(-35)">${lay(k, [['<rect x="-24" y="-7.5" width="48" height="15" rx="7.5"/>', k.c(330, 70, 95)]], 4)}`
      + `<rect x="-8" y="-7.5" width="16" height="15" fill="${k.c(330, 70, 85)}"/><g fill="${k.c(330, 50, 72)}"><circle cx="-16" cy="-2.6" r="1.3"/><circle cx="-16" cy="2.6" r="1.3"/><circle cx="16" cy="-2.6" r="1.3"/><circle cx="16" cy="2.6" r="1.3"/></g></g>`
      + sparkAt(k, 30, -28, 6) + sparkAt(k, -32, 18, 4.5); },
  nopeek: (k) => keyboard(k, 0, 15, 64, 32) + closedEye(k, 0, -20, 15),
  handsFree: (k) => { const p = pal(k);
    return hand(k, -15, 30, 1.05, -14, true, p.sky) + hand(k, 15, 30, 1.05, 14, false, p.pink) + closedEye(k, 0, -25, 13); },
  touchTypist: (k) => { const p = pal(k);
    return keyboard(k, 0, 17, 64, 28) + hand(k, -15, 38, 0.7, -8, true, p.violet) + hand(k, 15, 38, 0.7, 8, false, p.violet)
      + closedEye(k, 0, -17, 12) + crown(k, 0, -34, 0.62); },
  one: (k) => { const p = pal(k);
    return lay(k, [[`<path d="${starD(0, 3, 40, 18, 5)}"/>`, p.lemon]]) + glint(k, 'M-9,-14 L-2,-27', 2.6)
      + lay(k, [['<path d="M-4,-11 L4,-14 L4,11 L9,11 L9,17 L-8,17 L-8,11 L-3,11 L-3,-5 L-8,-3.5 L-8,-9 Z"/>', p.pink]], 4); },
  stars: (k) => { const p = pal(k);
    const st = (x: number, y: number, r: number) => lay(k, [[`<path d="${starD(x, y, r, r * 0.46, 5)}"/>`, p.lemon]], 5) + `<path d="${starD(x - r * 0.12, y - r * 0.1, r * 0.4, r * 0.18, 5)}" fill="${p.lemonL}"/>`;
    return st(-23, 13, 15) + st(23, 13, 15) + st(0, -9, 23); },
  gauge: (k) => { const p = pal(k), cy = 5;
    let ticks = '';
    for (let a = 150; a <= 390; a += 30) ticks += `M${f1(Math.cos(a * RAD) * 13)},${f1(cy + Math.sin(a * RAD) * 13)} L${f1(Math.cos(a * RAD) * 17)},${f1(cy + Math.sin(a * RAD) * 17)} `;
    return lay(k, [[`<circle cy="${cy}" r="31"/>`, p.w]])
      + `<g fill="none" stroke-width="7"><path d="${arcD(0, cy, 24, 150, 230)}" stroke="${p.mint}"/><path d="${arcD(0, cy, 24, 230, 310)}" stroke="${p.lemon}"/><path d="${arcD(0, cy, 24, 310, 390)}" stroke="${p.pink}"/></g>`
      + `<path d="${ticks}" stroke="${p.ink}" stroke-width="1.8" stroke-linecap="round" opacity=".55"/>`
      + `<path d="M-4,${cy} L0,${cy - 26} L4,${cy} Z" transform="rotate(50 0 ${cy})" fill="${p.red}" stroke="${p.ink}" stroke-width="2" stroke-linejoin="round"/>`
      + `<circle cy="${cy}" r="5.5" fill="${p.ink}"/><circle cx="-1.5" cy="${cy - 1.5}" r="1.6" fill="${p.w}"/>`
      + `<rect x="-9" y="${cy + 14}" width="18" height="7" rx="3" fill="${p.violetL}" stroke="${p.ink}" stroke-width="1.6"/>`; },
  shoe: (k) => { const p = pal(k);
    const shoe = 'M-28,8 C-28,-6 -22,-15 -13,-17 L-4,-17 C-2,-9 6,-7 13,-5 C23,-3 31,1 31,9 L31,12 L-28,12 Z';
    return `<g fill="${p.lemon}" stroke="${p.ink}" stroke-width="1.6"><circle cx="-36" cy="30" r="2.6"/><circle cx="-26" cy="33" r="2.6"/><circle cx="-15" cy="35" r="2.6"/></g>`
      + ln(k, 'M-44,-8 L-35,-8 M-44,2 L-37,2', p.w, 2.6)
      + '<g transform="translate(3 0) rotate(-6)">'
      + lay(k, [[`<path d="${shoe}"/>`, p.pink], ['<path d="M-30,11 L33,11 Q33,21 25,21 L-23,21 Q-30,21 -30,11 Z"/>', p.w]])
      + `<path d="M-30,15.5 L33,15.5" stroke="${p.sky}" stroke-width="2.4"/>`
      + `<path d="M-21,5 Q0,10 23,-1" stroke="${p.lemon}" stroke-width="4.2" fill="none" stroke-linecap="round"/>`
      + `<path d="M-7,-13 l5,4 M-1,-10 l5,3 M5,-8 l5,2" stroke="${p.w}" stroke-width="2.4" stroke-linecap="round"/>`
      + glint(k, 'M-24,4 Q-24,-7 -16,-12', 2.4) + '</g>'; },
  summit: (k) => { const p = pal(k);
    return ln(k, 'M-6,-12 L-6,-40', p.violetD, 2.4) + lay(k, [['<path d="M-6,-41 L18,-33 L-6,-25 Z"/>', p.pink]], 4.5)
      + `<path d="${starD(3, -33, 4.2, 1.9, 5)}" fill="${p.w}"/>`
      + lay(k, [['<path d="M-34,28 L-6,-12 L6,2 L14,-6 L34,28 Z"/>', p.sky]])
      + `<path d="M-6,-12 L3,-1.5 L-1,-4 L-5,0 L-9,-4 L-14.4,0 Z M14,-6 L18.4,1.5 L15.5,0 L13,2 L10,-2 Z" fill="${p.w}"/>`
      + `<path d="M-6,-12 L-14,28" stroke="${p.ink}" stroke-width="1.6" opacity=".25"/>`; },
};

/** Each ride's medal drawing, by ride id. */
const RIDE_DRAW: Record<RideId, Draw> = {
  walk: D.shoe, run: D.shoe, skate: D.skate, bike: D.bike, car: D.car, rocket: D.rocket,
};
const night = (face: number, ribbon: number, draw: Draw): MedalSpec => ({ face, ribbon: [face, ribbon], pattern: 'stars', night: true, draw });
const MEDAL_SPEC: Record<string, MedalSpec> = {
  clean: { face: 172, ribbon: [172, 200], pattern: 'stripe', draw: D.broom },
  sharp: { face: 205, ribbon: [205, 340], pattern: 'stripe', draw: D.target },
  steady: { face: 232, ribbon: [232, 158], pattern: 'split', draw: D.paw },
  pb: { face: 318, ribbon: [268, 55], pattern: 'stripe', draw: D.trophy },
  'ride-record': { face: 285, ribbon: [285, 55], pattern: 'dots', draw: D.flag },
  'ride-run': { face: 284, ribbon: [284, 338], pattern: 'dots', draw: D.shoe },
  'ride-skate': { face: 160, ribbon: [160, 330], pattern: 'split', draw: D.skate },
  'ride-bike': { face: 196, ribbon: [196, 55], pattern: 'dots', draw: D.bike },
  'ride-car': { face: 330, ribbon: [330, 200], pattern: 'split', draw: D.car },
  'ride-rocket': { face: 272, ribbon: [272, 330], pattern: 'stars', draw: D.rocket },
  'streak-25': { face: 262, ribbon: [338, 200], pattern: 'stripe', draw: D.flame },
  'streak-50': { face: 222, ribbon: [318, 268], pattern: 'split', draw: D.blaze },
  'streak-100': { face: 252, ribbon: [268, 55], pattern: 'stripe', draw: D.bolt },
  comeback: { face: 176, ribbon: [342, 176], pattern: 'dots', draw: D.heart },
  // The "typing without looking" set: night-sky enamel, starry ribbons, a closed eye on each.
  nopeek: night(250, 200, D.nopeek),
  'hands-free': night(300, 200, D.handsFree),
  'touch-typist': night(268, 55, D.touchTypist),
  firsttry: { face: 200, ribbon: [55, 200], pattern: 'stripe', draw: D.one },
  three: { face: 330, ribbon: [268, 330], pattern: 'split', draw: D.stars },
  speedy: { face: 182, ribbon: [182, 340], pattern: 'stripe', draw: D.gauge },
  marathon: { face: 140, ribbon: [140, 55], pattern: 'dots', draw: D.shoe },
  goal: { face: 104, ribbon: [104, 200], pattern: 'split', draw: D.summit },
};
MEDAL_SPEC['no-peek'] = MEDAL_SPEC.nopeek;

/** Medals without their own art yet: the award's glyph on its colour. */
function fallbackSpec(award: AwardDef): MedalSpec {
  const h = safeHue(award.hue);
  if (award.icon === 'ride' && award.ride != null) return { face: h, ribbon: [h, safeHue(h + 150)], pattern: 'stripe', draw: RIDE_DRAW[RIDES[Math.min(RIDES.length - 1, award.ride)].id] };
  return {
    face: h, ribbon: [h, safeHue(h + 150)], pattern: 'stripe',
    draw: (k) => {
      const g = (GLYPH as Record<string, string>)[award.icon] ?? `<path fill="#fff" d="${starD(24, 24, 20, 9, 5)}"/>`;
      return `<g transform="translate(-31 -31) scale(1.3)"><g transform="translate(1.2 1.8)" opacity=".35">${g.replace(/#fff/g, k.ink)}</g>${g.replace(/#fff/g, k.w)}</g>`;
    },
  };
}

type Metal = { hi: string; a: string; b: string; c: string; dark: string };
const METAL: Metal[] = [
  { hi: '#f8f6fb', a: '#ece8f3', b: '#ddd6ea', c: '#cbc3dc', dark: '#b6adc9' }, // locked
  { hi: 'hsl(340 100% 97%)', a: 'hsl(345 100% 86%)', b: 'hsl(342 90% 70%)', c: 'hsl(338 78% 54%)', dark: 'hsl(334 70% 40%)' }, // rose
  { hi: '#ffffff', a: 'hsl(196 90% 95%)', b: 'hsl(204 55% 84%)', c: 'hsl(208 40% 68%)', dark: 'hsl(212 36% 50%)' }, // silver
  { hi: 'hsl(60 100% 95%)', a: 'hsl(57 100% 76%)', b: 'hsl(54 100% 57%)', c: 'hsl(52 100% 46%)', dark: 'hsl(51 100% 35%)' }, // gold
  { hi: '#ffffff', a: 'hsl(300 100% 92%)', b: 'hsl(268 90% 82%)', c: 'hsl(262 70% 66%)', dark: 'hsl(262 55% 46%)' }, // rainbow
];
const HOLO = ['hsl(330 100% 82%)', 'hsl(290 100% 86%)', 'hsl(250 100% 86%)', 'hsl(200 100% 80%)', 'hsl(165 85% 76%)', 'hsl(56 100% 78%)', '#ffffff'];
// The face foil skips yellow: yellow laid over dark enamel mixes to a muddy brown.
const FOIL = ['#ffffff', 'hsl(330 100% 84%)', '#ffffff', 'hsl(200 100% 84%)', '#ffffff', 'hsl(268 100% 88%)', '#ffffff', 'hsl(165 85% 80%)'];
const RAYS = [336, 268, 200, 160, 55];
const GEMS = [338, 200, 160, 268];

function ribbon(k: Paint, id: string, spec: MedalSpec, T: number): string {
  const locked = T < 0;
  const r1 = spec.night ? k.c(spec.ribbon[0], 60, 34) : k.c(spec.ribbon[0], 88, 60);
  const r2 = k.c(spec.ribbon[1], 92, 68), edge = spec.night ? k.c(spec.ribbon[0], 60, 22) : k.c(spec.ribbon[0], 70, 42);
  let b = `<rect x="-16" y="-20" width="32" height="130" fill="${r1}"/>`;
  if (T === 3) {
    // Pink sits next to violet and lemon next to mint: pink beside yellow reads as orange when small.
    const cols = [k.c(336, 92, 66), k.c(268, 80, 70), k.c(200, 90, 64), k.c(160, 70, 56), k.c(55, 100, 62)];
    b += cols.map((c, i) => `<rect x="${f1(-16 + i * 6.4)}" y="-20" width="6.6" height="130" fill="${c}"/>`).join('')
      + [1, 2, 3, 4].map(i => `<rect x="${f1(-16.5 + i * 6.4)}" y="-20" width="1" height="130" fill="${k.w}" opacity=".8"/>`).join('');
  } else switch (spec.pattern) {
    case 'stripe': b += `<rect x="-6" y="-20" width="12" height="130" fill="${r2}"/><rect x="-9.4" y="-20" width="1.8" height="130" fill="${k.w}"/><rect x="7.6" y="-20" width="1.8" height="130" fill="${k.w}"/>`; break;
    case 'split': b += `<rect x="0" y="-20" width="16" height="130" fill="${r2}"/><rect x="-1.2" y="-20" width="2.4" height="130" fill="${k.w}"/>`; break;
    case 'dots': for (let y = -14, row = 0; y < 106; y += 11, row++) for (const x of row % 2 ? [-8, 8] : [0]) b += `<circle cx="${x}" cy="${y}" r="3.2" fill="${k.w}" opacity=".9"/>`; break;
    case 'stars': b += `<rect x="-12" y="-20" width="2.4" height="130" fill="${r2}"/><rect x="9.6" y="-20" width="2.4" height="130" fill="${r2}"/>`;
      for (let y = -10, row = 0; y < 106; y += 15, row++) b += `<path transform="translate(${row % 2 ? 4 : -4} ${y})" d="${spark(3.4)}" fill="${k.w}"/>`; break;
  }
  if (!locked) {
    if (T === 0) b += `<rect x="-16" y="-20" width="2" height="130" fill="${k.w}" opacity=".85"/><rect x="14" y="-20" width="2" height="130" fill="${k.w}" opacity=".85"/>`;
    if (T === 1 || T === 2) {
      const m = METAL[T + 1];
      b += `<rect x="-16" y="-20" width="5.2" height="130" fill="${k.w}"/><rect x="10.8" y="-20" width="5.2" height="130" fill="${k.w}"/><rect x="-16" y="-20" width="3.6" height="130" fill="${m.b}"/><rect x="12.4" y="-20" width="3.6" height="130" fill="${m.b}"/>`;
    }
  }
  b += `<rect x="-16" y="-20" width="32" height="130" fill="url(#${id}rs)"/><rect x="-16" y="-20" width="32" height="130" fill="none" stroke="${edge}" stroke-width="1.4"/>`;
  return `<g transform="translate(72 -8) rotate(-17)">${b}</g>`
    + `<g transform="translate(125 -6) rotate(17)"><rect x="-18" y="-20" width="34" height="130" fill="${k.ink}" opacity=".2"/></g>`
    + `<g transform="translate(128 -8) rotate(17)">${b}</g>`;
}

function burst(k: Paint, T: number, M: Metal, anim: boolean): string {
  const n = T === 3 ? 20 : 16, rin = 60, rout = 84;
  const P = (a: number, r: number) => `${f1(CX + Math.cos(a * RAD) * r)},${f1(CY + Math.sin(a * RAD) * r)}`;
  let facets = '', outline = '';
  for (let i = 0; i < n; i++) {
    const a = -90 + (i * 360) / n, h = 180 / n;
    const tip = P(a, rout), bl = P(a - h, rin), mid = P(a, rin * 0.9), br = P(a + h, rin);
    const [lt, dk] = T === 3 ? [k.c(RAYS[i % 5], 100, 82), k.c(RAYS[i % 5], 88, 64)] : [M.a, M.c];
    facets += `<path d="M${tip} L${bl} L${mid} Z" fill="${lt}"/><path d="M${tip} L${mid} L${br} Z" fill="${dk}"/>`;
    outline += `${i ? 'L' : 'M'}${bl} L${tip} `;
  }
  const spin = anim && T === 3 ? `<animateTransform attributeName="transform" type="rotate" values="0 ${CX} ${CY};360 ${CX} ${CY}" dur="40s" repeatCount="indefinite"/>` : '';
  return `<g><path d="${outline}Z" fill="${M.dark}" stroke="${M.dark}" stroke-width="3.5" stroke-linejoin="round"/>${facets}${spin}</g>`;
}

const hashStr = (s: string) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const GLITTER = [[-34, -20, 1.4], [30, -32, 1.1], [38, 8, 1.3], [-40, 10, 1], [-26, 34, 1.2], [24, 34, 1.4], [6, -42, 1], [-12, 42, 1], [42, -12, 1]];

export function renderMedal(award: AwardDef, tier: number, opts: { locked?: boolean; animate?: boolean } = {}): string {
  if (PAINTED_MEDALS.has(award.id)) return paintedMedal(award, tier, opts);
  const id = 'md' + (SID++);
  const locked = !!opts.locked || tier < 0;
  const T = locked ? -1 : Math.min(3, Math.max(0, tier));
  const anim = opts.animate !== false && !locked;
  const k = paint(locked);
  const M = METAL[T + 1];
  const spec = MEDAL_SPEC[award.id] ?? fallbackSpec(award);
  const delay = ((hashStr(award.id) % 37) / 10).toFixed(1);
  const fh = safeHue(spec.face);
  const faceStops = locked ? ['#f6f3fa', '#e6e0ef', '#d6cfe4']
    : spec.night ? [`hsl(${fh} 55% 46%)`, `hsl(${fh} 62% 30%)`, `hsl(${fh} 70% 17%)`]
    : [`hsl(${fh} 95% 76%)`, `hsl(${fh} 85% 57%)`, `hsl(${fh} 80% 40%)`];
  const holoStops = (dur: number, cols = HOLO) => cols.map((c, i) => `<stop offset="${f1(i / (cols.length - 1))}" stop-color="${c}"/>`).join('')
    + (anim ? `<animateTransform attributeName="gradientTransform" type="rotate" values="0 ${CX} ${CY};360 ${CX} ${CY}" dur="${dur}s" repeatCount="indefinite"/>` : '');
  const metalStops = (rev: boolean) => {
    const s: [number, string][] = [[0, M.hi], [0.25, M.a], [0.55, M.b], [0.85, M.c], [1, M.dark]];
    return (rev ? s.map(([o, c]) => [1 - o, c] as [number, string]).reverse() : s).map(([o, c]) => `<stop offset="${f1(o)}" stop-color="${c}"/>`).join('');
  };
  const big = T >= 1; // scalloped edge from Silver up

  const defs = `<defs>
    ${T === 3
      ? `<linearGradient id="${id}rim" gradientUnits="userSpaceOnUse" x1="62" y1="106" x2="138" y2="182" spreadMethod="reflect">${holoStops(9)}</linearGradient>
         <linearGradient id="${id}bev" gradientUnits="userSpaceOnUse" x1="44" y1="88" x2="156" y2="200"><stop offset="0" stop-color="${M.c}"/><stop offset=".5" stop-color="${M.a}"/><stop offset="1" stop-color="#fff"/></linearGradient>`
      : `<linearGradient id="${id}rim" gradientUnits="userSpaceOnUse" x1="44" y1="88" x2="156" y2="200">${metalStops(false)}</linearGradient>
         <linearGradient id="${id}bev" gradientUnits="userSpaceOnUse" x1="44" y1="88" x2="156" y2="200">${metalStops(true)}</linearGradient>`}
    <radialGradient id="${id}fc" cx=".4" cy=".32" r=".75"><stop offset="0" stop-color="${faceStops[0]}"/><stop offset=".58" stop-color="${faceStops[1]}"/><stop offset="1" stop-color="${faceStops[2]}"/></radialGradient>
    <linearGradient id="${id}is" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${k.ink}" stop-opacity=".5"/><stop offset=".45" stop-color="${k.ink}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}rs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
    ${T === 3 ? `<linearGradient id="${id}fo" gradientUnits="userSpaceOnUse" x1="70" y1="114" x2="130" y2="174" spreadMethod="reflect">${holoStops(7, FOIL)}</linearGradient>` : ''}
    ${anim ? `<linearGradient id="${id}sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${T === 1 ? 0.95 : 0.75}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}d"><circle cx="${CX}" cy="${CY}" r="${big ? 74 : 68}"/></clipPath>` : ''}
  </defs>`;

  let rimDeco = '';
  for (let i = 0; i < 24; i++) {
    const a = i * 15;
    if (T >= 2 && a % 90 === 45) continue;
    rimDeco += `<circle cx="${f1(CX + Math.cos(a * RAD) * 61.4)}" cy="${f1(CY + Math.sin(a * RAD) * 61.4)}" r="1.7"/>`;
  }
  rimDeco = `<g fill="${T === 3 ? '#fff' : M.hi}" opacity="${locked ? 0.6 : 0.9}">${rimDeco}</g>`;
  if (T >= 2) rimDeco += [45, 135, 225, 315].map((a, i) => {
    const x = f1(CX + Math.cos(a * RAD) * 61.4), y = f1(CY + Math.sin(a * RAD) * 61.4);
    return `<circle cx="${x}" cy="${y}" r="4.2" fill="${k.c(GEMS[i], 90, 62)}" stroke="${M.dark}" stroke-width="1.4"/><circle cx="${f1(x - 1.3)}" cy="${f1(y - 1.3)}" r="1.4" fill="#fff"/>`;
  }).join('');

  let scallops = '';
  if (big) {
    for (let i = 0; i < 30; i++) scallops += `<circle cx="${f1(CX + Math.cos(i * 12 * RAD) * 67)}" cy="${f1(CY + Math.sin(i * 12 * RAD) * 67)}" r="6.6"/>`;
    scallops = `<g fill="url(#${id}rim)" stroke="${M.dark}" stroke-width="2.6">${scallops}</g>`;
  }

  const faceFx = (spec.night || T >= 2) && !locked
    ? `<g fill="#fff" opacity="${spec.night ? 0.9 : 0.55}">${GLITTER.map(([x, y, r]) => spec.night ? `<path transform="translate(${CX + x} ${CY + y})" d="${spark(r * 2)}"/>` : `<circle cx="${CX + x}" cy="${CY + y}" r="${r}"/>`).join('')}</g>` : '';

  const sparkle = (x: number, y: number, r: number, i: number) => {
    const fill = T === 2 ? 'hsl(58 100% 93%)' : '#fff', stroke = T === 3 ? k.c(GEMS[i % 4], 80, 60) : M.dark;
    const tw = anim ? `<animateTransform attributeName="transform" type="scale" values="1;.3;1" keyTimes="0;.5;1" dur="${(1.8 + i * 0.35).toFixed(2)}s" begin="${(Number(delay) + i * 0.45).toFixed(2)}s" repeatCount="indefinite"/>` : '';
    return `<g transform="translate(${x} ${y})"><path d="${spark(r)}" fill="${fill}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round">${tw}</path></g>`;
  };
  const sparkles = locked ? '' : T === 1 ? sparkle(154, 90, 8, 0)
    : T === 2 ? sparkle(156, 86, 11, 0) + sparkle(40, 188, 7, 1)
    : T === 3 ? sparkle(158, 84, 12, 0) + sparkle(38, 98, 8, 1) + sparkle(166, 198, 8, 2) + sparkle(34, 192, 6, 3) : '';

  const shine = anim
    ? `<g clip-path="url(#${id}d)"><path d="M20,60 L46,60 L-4,240 L-30,240 Z" fill="url(#${id}sh)" transform="translate(-70 0)"><animateTransform attributeName="transform" type="translate" values="-70 0;210 0;210 0" keyTimes="0;.3;1" dur="${T === 1 ? 3.6 : 4.6}s" begin="${delay}s" repeatCount="indefinite"/></path></g>` : '';

  const art = spec.draw(k, id);
  const artShadow = locked ? '' : `<g transform="translate(${CX + 1.6} ${CY + 2.6})" opacity=".3">${spec.draw(shadowPaint(k.ink), id + 's')}</g>`;

  return `<svg class="medal tier-${T}" viewBox="0 0 200 230" role="img" aria-label="${award.name}">
    ${defs}
    ${ribbon(k, id, spec, T)}
    ${T >= 2 ? burst(k, T, M, anim) : ''}
    <rect x="80" y="59" width="40" height="16" rx="6" fill="url(#${id}rim)" stroke="${M.dark}" stroke-width="2"/><rect x="85" y="62" width="30" height="3" rx="1.5" fill="#fff" opacity=".65"/>
    <circle cx="${CX}" cy="${CY + 5}" r="${big ? 73 : 68}" fill="${k.ink}" opacity="${locked ? 0.06 : 0.2}"/>
    ${scallops}
    <circle cx="${CX}" cy="${CY}" r="68" fill="${M.dark}"/>
    <circle cx="${CX}" cy="${CY}" r="66.4" fill="url(#${id}rim)"/>
    ${rimDeco}
    <circle cx="${CX}" cy="${CY}" r="56" fill="url(#${id}bev)"/>
    <circle cx="${CX}" cy="${CY}" r="51" fill="url(#${id}fc)"/>
    ${T === 3 ? `<circle cx="${CX}" cy="${CY}" r="51" fill="url(#${id}fo)" opacity=".36"/>` : ''}
    ${faceFx}
    <circle cx="${CX}" cy="${CY}" r="49.5" fill="none" stroke="url(#${id}is)" stroke-width="4"/>
    ${artShadow}
    <g transform="translate(${CX} ${CY})"${locked ? ' opacity=".8"' : ''}>${art}</g>
    <ellipse cx="${CX - 4}" cy="${CY - 26}" rx="36" ry="19" fill="url(#${id}gl)" opacity="${locked ? 0.4 : 0.5}" transform="rotate(-14 ${CX - 4} ${CY - 26})"/>
    <path d="${arcD(CX, CY, 61.4, 196, 250)}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="${locked ? 0.6 : 0.9}"/>
    <path d="${arcD(CX, CY, 61.4, 258, 266)}" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" opacity="${locked ? 0.5 : 0.8}"/>
    ${shine}
    ${sparkles}
  </svg>`;
}
