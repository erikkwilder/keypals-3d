// Spoken lines: plays public/voice/<id>.mp3 when it exists, otherwise the browser's own
// speech voice. Shows a caption while speaking. One line at a time; a new line replaces
// the old one unless it is only a short bark and something important is playing.

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

function speakFallback(line: Line, onEnd: () => void) {
  if (typeof speechSynthesis === 'undefined') { setTimeout(onEnd, 1800); return; }
  const u = new SpeechSynthesisUtterance(line.text);
  const voices = speechSynthesis.getVoices();
  const pick = voices.find(v => /Samantha|Karen|Moira|Google US English|Jenny|Aria/i.test(v.name)) ?? voices.find(v => v.lang.startsWith('en')) ?? null;
  if (pick) u.voice = pick;
  u.rate = line.voice === 'koala' ? 0.88 : line.voice === 'cheetah' ? 1.1 : 0.98;
  u.pitch = line.voice === 'coach' ? 1 : line.voice === 'koala' ? 1.1 : 1.3;
  u.volume = game.settings.volume;
  u.onend = onEnd;
  u.onerror = onEnd;
  speechSynthesis.speak(u);
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
    if (missing.has(id)) { speakFallback(line, done); return; }
    const a = new Audio(`voice/${id}.mp3`);
    a.volume = Math.min(1, game.settings.volume * 1.1);
    audio = a;
    a.onended = done;
    a.onerror = () => { missing.add(id); if (audio === a) speakFallback(line, done); };
    a.play().catch(() => { missing.add(id); speakFallback(line, done); });
  });
}

export function hush() {
  stopAll();
  voiceState.playing = null;
  voiceState.caption = null;
  important = false;
}

export function lineText(id: string) { return BY_ID.get(id)?.text ?? ''; }
