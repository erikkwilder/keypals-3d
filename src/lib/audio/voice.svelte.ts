// Spoken lines: plays public/voice/<id>.mp3 and shows a caption while speaking. One line at a time;
// a new line replaces the old one unless it is only a short bark and something important is playing.
// There is no robot-voice fallback: if a clip can't play, the caption stays up for a reading-length
// moment instead (the browser's own speech voice used to cut in when kids clicked quickly).

import { ALL_LINES, type Line } from '../content/voice';
import { game } from '../state/game.svelte';

const BY_ID = new Map(ALL_LINES.map(l => [l.id, l]));
export const voiceState = $state<{ caption: string | null; speaker: string | null; playing: string | null }>({ caption: null, speaker: null, playing: null });

let audio: HTMLAudioElement | null = null;
let important = false;
let captionTimer: ReturnType<typeof setTimeout> | undefined;
const missing = new Set<string>();

function allowed(line: Line) {
  // only the coach speaks out loud; the Keypals' lines show as text (their voices were pulled)
  return line.voice === 'coach' && game.settings.voice !== false;
}

function stopAll() {
  if (audio) { audio.onended = null; audio.pause(); audio = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** No clip: leave the caption up long enough to read it, then carry on. */
function readInstead(line: Line, onEnd: () => void) {
  setTimeout(onEnd, Math.max(1800, line.text.length * 60));
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
    const a = new Audio(`voice/${id}.mp3`);
    a.volume = Math.min(1, game.settings.volume * 1.1);
    audio = a;
    a.onended = done;
    // only a clip that fails to load counts as missing
    a.onerror = () => { missing.add(id); if (audio === a) readInstead(line, done); };
    // play() also fails when a newer line cuts this one off before it starts (clicking quickly), or
    // before the page has been tapped: neither means the clip is missing, so nothing else speaks
    a.play().catch(() => { if (audio === a) readInstead(line, done); else resolve(); });
  });
}

export function hush() {
  stopAll();
  voiceState.playing = null;
  voiceState.caption = null;
  important = false;
}

export function lineText(id: string) { return BY_ID.get(id)?.text ?? ''; }
