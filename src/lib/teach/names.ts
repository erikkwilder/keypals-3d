// Names and pictures for classes: the sixteen pictures of the picture password (Glimmers from the
// game, each with a one-word name a child can say), class codes as they're shown and printed, and
// the made-up names on the world boards. The rules themselves (what a student's name may be, the lists
// of words) are shared with the server: deploy/site/class-rules.js.
import { ALIAS_ADJ, ALIAS_ANIMALS, PICTURE_COUNT } from '../../../deploy/site/class-rules.js';

/** The picture password's pictures, by number. The numbers are saved with every student: never reorder
 *  this list or take one out (add at the end only, and raise PICTURE_COUNT on both sides). */
export const PICTURES: { id: string; name: string }[] = [
  { id: 'puddlepup', name: 'Pup' }, { id: 'pebbletort', name: 'Tortoise' }, { id: 'sproutbun', name: 'Bunny' }, { id: 'embernewt', name: 'Newt' },
  { id: 'fernfox', name: 'Fox' }, { id: 'snowseal', name: 'Seal' }, { id: 'frostowl', name: 'Owl' }, { id: 'sparkmoth', name: 'Moth' },
  { id: 'whalecalf', name: 'Whale' }, { id: 'sunsnail', name: 'Snail' }, { id: 'mittenyeti', name: 'Yeti' }, { id: 'bubbleocto', name: 'Octopus' },
  { id: 'mushmouse', name: 'Mouse' }, { id: 'rainbootfrog', name: 'Frog' }, { id: 'cactuskit', name: 'Kitten' }, { id: 'stormlamb', name: 'Lamb' },
].slice(0, PICTURE_COUNT);
export const pictureSrc = (i: number) => `${import.meta.env.BASE_URL}game/glimmers/face/${PICTURES[i]?.id ?? 'puddlepup'}.webp`;

/** A class or challenge code to show: "fox pear 42". */
export const showClassCode = (c: string) => c.toLowerCase().replaceAll('-', ' ');
/** A code as people type it ("Fox pear 42") in the server's form: FOX-PEAR-42. */
export const cleanClassCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Where a printed QR code and the "go to" line send students: the class login with the code filled in.
 *  On the live site that's keypals.org; anywhere else (a test server) this same page. */
export function classUrl(code: string, loc: { hostname: string; origin: string; pathname: string } = location): string {
  const live = /(^|\.)keypals\.org$|(^|\.)fancyant\.com$/.test(loc.hostname);
  return `${live ? 'https://keypals.org/' : loc.origin + loc.pathname}#class=${code}`;
}
/** The address to show on a printed card, without https:// */
export const classUrlShort = (code: string, loc?: { hostname: string; origin: string; pathname: string }) => classUrl(code, loc).replace(/^https?:\/\//, '');

/** A made-up name for the world boards: an adjective and an animal, picked at random (never typed). */
export function newAlias(rnd: () => number = Math.random): string {
  return `${ALIAS_ADJ[Math.floor(rnd() * ALIAS_ADJ.length)]} ${ALIAS_ANIMALS[Math.floor(rnd() * ALIAS_ANIMALS.length)]}`;
}
