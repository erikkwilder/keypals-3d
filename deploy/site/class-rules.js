// Rules shared by the server (classes.js) and the game (src/lib/teach): what a student's name may be,
// class codes, the made-up names on world boards, and what counts as a believable score. Plain
// JavaScript with no imports, so the Worker and the game load the same file.

/** Words for class codes: short and easy to spell for a six-year-old. A code is two words and a number:
 *  FOX-PEAR-42. */
export const CLASS_WORDS = ('ant apple bat bean bear bee bell bird boat book bus cake cat clam cloud coat corn cow crab cub cup deer dog '
  + 'dot drum duck egg elk fan fig fish flag fox frog gem goat gull hat hen hill hive jam jar jet kite lake lamb leaf lime lion log map '
  + 'mink mole moon moth mug nest net nut oak owl pan pea pear pen pig pine plum pond pony pup rain ram ray rock rose ruby sail seal '
  + 'ship sky slug snow sock star sun swan tent tide toad top tree tub van vase web whale wind wing wolf worm yak yam zebra').split(' ');

/** The picture password: two of this many pictures, in order (the game draws them: src/lib/teach/names.ts). */
export const PICTURE_COUNT = 16;

/** Most students in one class, and classes for one teacher. */
export const MAX_STUDENTS = 40;
export const MAX_CLASSES = 30;

/** Made-up names for the world boards: an adjective and an animal, never anything typed. */
export const ALIAS_ADJ = ['Brave', 'Bright', 'Bouncy', 'Busy', 'Calm', 'Cheery', 'Clever', 'Cosy', 'Curious', 'Dashing', 'Daring', 'Eager',
  'Fancy', 'Fast', 'Friendly', 'Fuzzy', 'Gentle', 'Giggly', 'Golden', 'Happy', 'Helpful', 'Jolly', 'Kind', 'Lucky', 'Merry', 'Mighty',
  'Nimble', 'Peppy', 'Plucky', 'Proud', 'Quick', 'Quiet', 'Shiny', 'Silly', 'Snappy', 'Sparkly', 'Speedy', 'Sunny', 'Super', 'Swift',
  'Tidy', 'Witty', 'Zippy'];
export const ALIAS_ANIMALS = ['Otter', 'Panda', 'Koala', 'Fox', 'Owl', 'Robin', 'Badger', 'Beaver', 'Bunny', 'Camel', 'Cheetah', 'Dolphin',
  'Duck', 'Eagle', 'Falcon', 'Ferret', 'Finch', 'Gecko', 'Goose', 'Hedgehog', 'Heron', 'Hippo', 'Kitten', 'Lemur', 'Lion', 'Llama',
  'Moose', 'Narwhal', 'Newt', 'Pelican', 'Penguin', 'Puffin', 'Pony', 'Quokka', 'Seal', 'Sloth', 'Sparrow', 'Squirrel', 'Swan',
  'Tiger', 'Toucan', 'Turtle', 'Walrus', 'Whale', 'Wombat', 'Yak', 'Zebra'];
export const isAlias = (s) => {
  const m = /^([A-Z][a-z]+) ([A-Z][a-z]+)$/.exec(String(s || ''));
  return !!m && ALIAS_ADJ.includes(m[1]) && ALIAS_ANIMALS.includes(m[2]);
};

/** The buddies a new class player may get (the first six in the game; a child can change later). */
export const START_BUDDIES = ['dino', 'cheetah', 'monkey', 'koala', 'box', 'turtle'];
/** Any buddy id the boards may show: lower-case letters only. */
export const isBuddyId = (s) => /^[a-z]{2,16}$/.test(String(s || ''));

/**
 * A student's name as the teacher typed it, kept to a first name or nickname: the first word, and a
 * one-letter initial after it if there is one ("Maria L." for a second Maria). Anything that looks like
 * an email, a phone number or a full name is cut down or refused. Returns null when nothing usable is left.
 */
export function cleanStudentName(raw) {
  let s = String(raw ?? '').normalize('NFC');
  // a spreadsheet row: only the first cell
  s = s.split(/[\t,;|]/)[0];
  s = s.replace(/[<>"`{}[\]\\/()=+*#$%^&~_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || s.includes('@') || /\d{3,}/.test(s) || /^https?:/i.test(s)) return null;
  const words = s.split(' ').filter(Boolean);
  let name = words[0].replace(/^[-'.]+|[-'.]+$/g, '');
  if (!name || !/\p{L}/u.test(name)) return null;
  // "Maria L" or "Maria L." keeps the initial; "Maria Lopez" keeps only "Maria"
  const second = words[1]?.replace(/\.$/, '');
  if (second && /^\p{L}$/u.test(second)) name = `${name} ${second.toUpperCase()}.`;
  name = name.slice(0, 16);
  return name[0].toLocaleUpperCase() + name.slice(1);
}

/** A pasted list of names (one a line, or separated by commas), cleaned, without repeats. */
export function splitNames(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  // one line with commas: a list on one line; several lines: each line is a row (its first cell is the name)
  const parts = lines.length === 1 && lines[0].includes(',') ? lines[0].split(',') : lines;
  const out = [];
  for (const p of parts) { const n = cleanStudentName(p); if (n && !out.some(x => x.toLowerCase() === n.toLowerCase())) out.push(n); }
  return out;
}

/** A class's name: plain words, up to 40 letters ("Room 12 Math"). */
export const cleanClassName = (raw) => String(raw ?? '').replace(/[<>"`{}\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
/** The name kids see for their teacher ("Ms. Rivera"). */
export const cleanTeacherName = (raw) => String(raw ?? '').replace(/[<>"`{}\\@]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);

/** A week, by the date of its Monday (2026-10-26). */
export const isWeek = (w) => /^\d{4}-\d{2}-\d{2}$/.test(String(w || ''));
/** A day (2026-10-29). */
export const isDay = isWeek;

/** One week's effort, as the game reports it, kept to what a child could really do in a week. */
export function cleanWeek(b) {
  const n = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
  return { right: n(b?.right, 30000), ms: n(b?.ms, 40 * 3600000), stars: n(b?.stars, 3000) };
}

/** The highest believable score in each Arcade game's daily challenge (three times the three-star score:
 *  src/lib/arcade/arcade.ts). Anything above is not put on the world board. */
export const WORLD_GAMES = { slalom: 75000, catch: 16500, tower: 30000 };
export const worldScoreOk = (game, score) => Object.hasOwn(WORLD_GAMES, game) && Number.isInteger(score) && score > 0 && score <= WORLD_GAMES[game];

// ---------- a class's path and time rules, and students' Google sign-in (src/lib/path/rules.ts) ----------
/** Keep students on My path: off, path first (the rest opens once today's path things are done), path only. */
export const KEEPS = ['off', 'first', 'only'];
/** A daily limit for a free-time place: off, minutes, or earned by practice. */
export const LIMITS = ['off', '10', '15', '20', '30', 'earned'];
export const FREE_PLACES = ['garden', 'island', 'closet', 'dances'];
/** A school's internet domain ("school.org"), or null. */
export function cleanDomain(raw) {
  const d = String(raw ?? '').trim().toLowerCase().replace(/^.*@/, '');
  return d.length <= 80 && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null;
}
/** A class's settings, checked, on top of what it had: keep (to the path), goal (path things a day),
 *  limits (per free-time place), google (students may sign in with Google: on or off) and domain (only
 *  Google accounts from this school domain, or null for any). */
export function cleanClassSettings(raw, was = {}) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const out = { keep: 'off', goal: 3, limits: {}, google: 'on', domain: null, ...was };
  if (KEEPS.includes(b.keep)) out.keep = b.keep;
  if (b.goal !== undefined) out.goal = Math.max(1, Math.min(6, Math.round(Number(b.goal) || 3)));
  if (b.limits && typeof b.limits === 'object') {
    const l = { ...out.limits };
    for (const k of FREE_PLACES) if (LIMITS.includes(b.limits[k])) l[k] = b.limits[k];
    out.limits = l;
  }
  if (b.google === 'on' || b.google === 'off') out.google = b.google;
  if (b.domain !== undefined) out.domain = b.domain === null || b.domain === '' ? null : cleanDomain(b.domain);
  return out;
}
/** A Google account's school domain: Google's own `hd` (a school or company account), else nothing. */
export const googleDomain = (me) => (me && typeof me.hd === 'string' ? cleanDomain(me.hd) : null);
/** Whether an account from `hd` may join a class kept to `domain` (the domain itself or a part of it). */
export const domainOk = (hd, domain) => !domain || (!!hd && (hd === domain || hd.endsWith(`.${domain}`)));
/**
 * Whether a new teacher's classes are on straight away: a Google account from a school or company (Google
 * Workspace: it has a domain, `hd`) is approved; a plain Gmail account waits for an admin to say yes; the
 * people who look after Keypals are approved. Other sign-ins (Microsoft) can't become new teachers: null.
 */
export function teacherStatusFor({ provider, hd, admin = false }) {
  if (admin) return 'approved';
  if (provider !== 'google' && provider !== 'dev') return null;
  return hd ? 'approved' : 'pending';
}
