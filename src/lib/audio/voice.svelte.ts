// Spoken lines: plays public/voice/<id>.mp3 and shows a caption while speaking. One line at a time;
// a new line replaces the old one unless it is only a short bark and something important is playing.
// There is no robot-voice fallback: if a clip can't play, the caption stays up for a reading-length
// moment instead (the browser's own speech voice used to cut in when kids clicked quickly).

import { ALL_LINES, BUDDY_VOICE, type Line } from '../content/voice';
import { game } from '../state/game.svelte';
import { onPageAway, pageAway } from './away';
import { keepClips, keptUrl, lessonClips } from './keep';
import { requestAnswered, requestFailed } from '../state/net.svelte';

const BY_ID = new Map(ALL_LINES.map(l => [l.id, l]));
export const voiceState = $state<{ caption: string | null; speaker: string | null; playing: string | null }>({ caption: null, speaker: null, playing: null });

let audio: HTMLAudioElement | null = null;
let important = false;
let captionTimer: ReturnType<typeof setTimeout> | undefined;
const missing = new Set<string>();
/** how to start or carry on the line now, while the game is put away (away.ts): it finishes when it's back,
 *  so a Learn that is waiting for the line just waits */
let startLine: (() => void) | null = null;
let held: (() => void) | null = null;
/** a lesson is paused (holdVoice): the line stands still where it is, and nothing new speaks until Keep going */
let still = false;
let stilled: (() => void) | null = null;
onPageAway({
  away() { if (audio && !audio.paused && !audio.ended) { audio.pause(); held = startLine; } },
  back() { const go = held; held = null; go?.(); },
});

function allowed(line: Line) {
  // the coach and the buddies' Learn voices (kid-a, kid-b, kid-c) speak out loud; the Keypals' own old
  // lines show as text (those voices were pulled)
  return (line.voice === 'coach' || line.voice.startsWith('kid-')) && game.settings.voice !== false;
}

function stopAll() {
  if (audio) { audio.onended = null; audio.pause(); audio = null; }
  held = null; stilled = null;
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** No clip: leave the caption up long enough to read it, then carry on. */
function readInstead(line: Line, onEnd: () => void) {
  // (it doesn't run out while a lesson is paused)
  const go = () => { if (still) setTimeout(go, 250); else onEnd(); };
  setTimeout(go, Math.max(1800, line.text.length * 60));
}

/** Speak a line by id. Returns a promise that resolves when it finishes (or is skipped). */
export function say(id: string, opts: { important?: boolean; caption?: boolean } = {}): Promise<void> {
  const line = BY_ID.get(id);
  if (!line || !allowed(line)) return Promise.resolve();
  if (important && !opts.important && voiceState.playing) return Promise.resolve();
  stopAll();
  important = !!opts.important;
  voiceState.playing = id;
  if (opts.caption !== false) { voiceState.caption = line.text; voiceState.speaker = line.voice; }
  clearTimeout(captionTimer);
  return new Promise(resolve => {
    const done = () => {
      if (voiceState.playing === id) {
        voiceState.playing = null;
        important = false;
        captionTimer = setTimeout(() => { if (!voiceState.playing) { voiceState.caption = null; voiceState.speaker = null; } }, 700);
      }
      resolve();
    };
    if (missing.has(id)) { readInstead(line, done); return; }
    // the copy a Learn lesson keeps on this computer (keep.ts), else the network
    const kept = keptUrl(id);
    const a = new Audio(kept ?? `voice/${id}.mp3`);
    a.volume = Math.min(1, game.settings.volume * 1.1);
    audio = a;
    a.onended = done;
    // only a clip that fails to load counts as missing: not a kept copy, and not while the computer is
    // offline (then it's tried again next time, once the connection is back)
    a.onerror = () => { if (!kept && !offline()) missing.add(id); if (audio === a) readInstead(line, done); };
    // play() also fails when a newer line cuts this one off before it starts (clicking quickly), or
    // before the page has been tapped: neither means the clip is missing, so nothing else speaks
    startLine = () => { a.play().catch(() => { if (audio === a) readInstead(line, done); else resolve(); }); };
    if (still) stilled = startLine; else if (pageAway()) held = startLine; else startLine();
  });
}

/** A short word still playing (a count word, said without a caption): resolves when it has ended, or after
 *  `ms` at most. A lesson's next line waits for it, so the last number counted is never cut off. */
export function wordDone(ms = 1000): Promise<void> {
  const a = audio;
  if (!a || important || a.ended || (a.paused && !still)) return Promise.resolve();
  return new Promise(r => {
    // (while a lesson is paused the word waits with it, and is heard out after Keep going)
    const arm = (): ReturnType<typeof setTimeout> => setTimeout(() => { if (still) t = arm(); else r(); }, ms);
    let t = arm();
    a.addEventListener('ended', () => { clearTimeout(t); r(); }, { once: true });
  });
}

/** A lesson's Pause (math/ui/lessonPause.ts): the line playing stops where it is, mid-word, and nothing new speaks
 *  until resumeVoice, which carries it on from that point. Erik, 2026-11-25: "If I pause the lesson, I want it to
 *  actually pause right then. And then when I say keep going, to have it start talking again where it left off." */
export function holdVoice() {
  if (still) return;
  still = true;
  if (audio && !audio.paused && !audio.ended) { audio.pause(); stilled = startLine; }
  // (put away at the same moment: it carries on at Keep going, not when the page comes back)
  else if (held) { stilled = held; held = null; }
}
/** Keep going: the held line carries on from where it stopped (or, `carryOn` false, as the lesson is left, it's
 *  let go without a sound) */
export function resumeVoice(carryOn = true) {
  if (!still) return;
  still = false;
  const go = stilled; stilled = null;
  if (go && carryOn) { if (pageAway()) held = go; else go(); }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Keep a Learn lesson's clips on this computer while it plays (keep.ts), so the narrator carries on if the
 *  connection drops: `keys` name its lines (ep.<key>.…), `buddy` is the buddy who speaks in it, `shared`
 *  adds the lines every classic episode says. Returns what lets them go, for when the lesson ends. With the
 *  voice off nothing is fetched. */
export function keepLesson(o: { keys: string[]; buddy?: string; shared?: boolean }): () => void {
  if (game.settings.voice === false) return () => {};
  const voice = o.buddy ? BUDDY_VOICE[o.buddy] ?? 'kid-a' : undefined;
  return keepClips(lessonClips(ALL_LINES, { keys: o.keys, voice, shared: o.shared }), { answered: requestAnswered, failed: requestFailed }).release;
}

/** Keep a few more clips while a lesson plays: the short words its world says (the count words), which aren't
 *  lesson lines. Returns what lets them go. With the voice off nothing is fetched. */
export function keepWords(ids: readonly string[]): () => void {
  if (game.settings.voice === false || !ids.length) return () => {};
  return keepClips(ids, { answered: requestAnswered, failed: requestFailed }).release;
}

export function hush() {
  stopAll();
  voiceState.playing = null;
  voiceState.caption = null;
  important = false;
}

export function lineText(id: string) { return BY_ID.get(id)?.text ?? ''; }
