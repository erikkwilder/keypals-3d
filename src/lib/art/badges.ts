// Glyphs for achievement stickers, drawn white on the sticker's color. 48x48 space.
import type { Icon } from '../engine/achievements';

const st = 'fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
const W = 'fill="#fff"';

export const GLYPH: Record<Exclude<Icon, 'ride' | 'friend'>, string> = {
  sparkle: `<path ${W} d="M24 6c1.6 9 4 11.4 13 13-9 1.6-11.4 4-13 13-1.6-9-4-11.4-13-13 9-1.6 11.4-4 13-13z"/><path ${W} d="M37 29c.8 4 1.8 5 5.6 5.8-3.8.8-4.8 1.8-5.6 5.6-.8-3.8-1.8-4.8-5.6-5.6 3.8-.8 4.8-1.8 5.6-5.8z"/>`,
  target: `<circle cx="24" cy="24" r="16" ${st}/><circle cx="24" cy="24" r="8" ${st}/><circle cx="24" cy="24" r="3" ${W}/>`,
  wave: `<path ${st} d="M6 28c4-8 8-8 12 0s8 8 12 0 8-8 12 0"/><path ${st} d="M6 18c4-8 8-8 12 0s8 8 12 0 8-8 12 0" opacity=".6"/>`,
  trophy: `<path ${W} d="M15 8h18v9a9 9 0 0 1-18 0z"/><path ${st} d="M15 11H9a6 6 0 0 0 7 7M33 11h6a6 6 0 0 1-7 7"/><path ${W} d="M21 26h6v6h-6zM16 36h16v5H16z"/>`,
  bolt: `<path ${W} d="M27 4 10 27h11l-3 17 18-24H25z"/>`,
  heart: `<path ${W} d="M24 41C10 31 6 24 6 17a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 7-4 14-18 24z"/>`,
  eye: `<path ${st} d="M5 24s7-11 19-11 19 11 19 11-7 11-19 11S5 24 5 24z"/><path ${st} d="M8 8l32 32"/>`,
  hand: `<path ${W} d="M16 26V12a2.6 2.6 0 0 1 5.2 0v10M21.2 21V9a2.6 2.6 0 0 1 5.2 0v12M26.4 21.5v-9a2.6 2.6 0 0 1 5.2 0V27a11 11 0 0 1-11 11h-1a10 10 0 0 1-8.5-4.8L8 27a2.8 2.8 0 0 1 4.4-3.4L16 27z"/>`,
  star: `<path ${W} d="M24 5l5.6 11.6 12.7 1.7-9.3 8.8 2.4 12.6L24 33.6 12.6 39.7 15 27.1l-9.3-8.8 12.7-1.7z"/>`,
  stars: `<path ${W} d="M14 14l3.4 7 7.6 1-5.5 5.3 1.4 7.6L14 31.3 7.1 34.9l1.4-7.6L3 22l7.6-1z"/><path ${W} d="M34 8l3.4 7 7.6 1-5.5 5.3 1.4 7.6L34 25.3l-6.9 3.6 1.4-7.6L23 16l7.6-1z"/><path ${W} d="M32 30l2.3 4.7 5.1.7-3.7 3.6.9 5.1L32 41.7l-4.6 2.4.9-5.1-3.7-3.6 5.1-.7z"/>`,
  arrow: `<path ${st} d="M8 34l12-12 7 7 13-15"/><path ${st} d="M30 14h10v10"/>`,
  book: `<path ${W} d="M8 10c6-2 11-1 15 2v28c-4-3-9-4-15-2z"/><path ${W} d="M40 10c-6-2-11-1-15 2v28c4-3 9-4 15-2z" opacity=".8"/>`,
  ring: `<circle cx="24" cy="24" r="16" ${st} opacity=".5"/><path ${st} d="M24 8a16 16 0 1 1-15.2 11"/><path ${st} d="M16 24l6 6 11-12"/>`,
  house: `<path ${W} d="M24 7 6 22h5v18h10V30h6v10h10V22h5z"/>`,
  tree: `<circle cx="24" cy="18" r="12" ${W}/><circle cx="14" cy="24" r="7" ${W}/><circle cx="34" cy="24" r="7" ${W}/><path ${W} d="M21 26h6v16h-6z"/>`,
  burrow: `<path ${W} d="M6 40c0-12 8-22 18-22s18 10 18 22z"/><path fill="rgba(0,0,0,.25)" d="M14 40c0-7 4.5-12 10-12s10 5 10 12z"/><circle cx="34" cy="10" r="4" ${W}/>`,
  cliff: `<path ${W} d="M4 42 16 12l8 10 6-6 14 26z"/><path fill="rgba(0,0,0,.18)" d="M16 12l3 14-7 16H4z"/>`,
  mountain: `<path ${W} d="M3 40 18 14l8 12 5-7 14 21z"/><path fill="rgba(0,0,0,.2)" d="M18 14l4.5 7.5-4.5 2-4.5-2z"/>`,
  shell: `<path ${W} d="M24 40c-10 0-16-7-16-14 0-10 8-18 16-18s16 8 16 18c0 7-6 14-16 14z"/><path fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2.5" d="M24 40V10M24 40 13 16M24 40l11-24M24 40 9 26M24 40l15-14"/>`,
  road: `<path ${W} d="M18 6h12l10 36H8z"/><path fill="rgba(0,0,0,.25)" d="M23 10h2v6h-2zM22.5 20h3v7h-3zM22 31h4v8h-4z"/>`,
  clock: `<circle cx="24" cy="26" r="16" ${st}/><path ${st} d="M24 18v8l6 4M19 6h10"/>`,
  words: `<rect x="6" y="10" width="36" height="28" rx="6" ${W}/><path stroke="rgba(0,0,0,.25)" stroke-width="3.5" stroke-linecap="round" d="M12 19h18M12 26h24M12 32h12"/>`,
  semi: `<circle cx="24" cy="15" r="5" ${W}/><path ${W} d="M19 26h10l-6 16h-6z"/>`,
  space: `<rect x="5" y="18" width="38" height="14" rx="5" ${W}/><path ${st} d="M12 10l4 4M36 10l-4 4M24 6v6"/>`,
  gift: `<rect x="7" y="18" width="34" height="22" rx="4" ${W}/><rect x="5" y="13" width="38" height="8" rx="3" ${W}/><path fill="rgba(0,0,0,.2)" d="M22 13h4v27h-4z"/><path ${st} d="M24 13c-4-8-12-6-9-1M24 13c4-8 12-6 9-1"/>`,
  crown: `<path ${W} d="M6 36 9 14l9 9 6-13 6 13 9-9 3 22z"/><rect x="6" y="37" width="36" height="5" rx="2" ${W}/>`,
  wand: `<path ${st} d="M10 38 30 18"/><path ${W} d="M34 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><circle cx="40" cy="26" r="2.4" ${W}/><circle cx="22" cy="10" r="2" ${W}/>`,
};
