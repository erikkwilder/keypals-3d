// The crate's sounds, doing the work a narrator would: a tink as a cube is cut, a clack as one lands, a
// rattle that tells you the crate isn't full before you see why, and the dull thunk of one that is.
import { noise, tone } from '../measure/sounds';

let lastClack = 0;
export const bSfx = {
  /** a cube is cut from the crystal */
  tink() { tone(2600, { dur: 0.09, gain: 0.03, type: 'sine', slideTo: 2200 }); },
  /** a cube lands (never more than one every 40 ms, so a pour stays soft) */
  clack() {
    const now = performance.now(); if (now - lastClack < 40) return; lastClack = now;
    tone(900 + Math.random() * 500, { dur: 0.04, gain: 0.05, type: 'triangle' }); noise(0.03, { gain: 0.05, freq: 3200, q: 3 });
  },
  /** loose cubes shaking in a crate */
  rattle() { for (let i = 0; i < 12; i++) { noise(0.035, { gain: 0.09, freq: 1800 + Math.random() * 2600, q: 5, delay: i * 0.085 }); tone(1100 + Math.random() * 900, { dur: 0.03, gain: 0.03, type: 'triangle', delay: i * 0.085 }); } },
  /** a full crate: one dull knock and nothing else */
  thunk() { tone(120, { dur: 0.2, gain: 0.16, slideTo: 70 }); noise(0.06, { gain: 0.05, freq: 500, q: 1 }); },
  /** a cube cracks */
  crack() { noise(0.09, { gain: 0.14, freq: 4200, q: 1.2 }); tone(620, { dur: 0.12, gain: 0.05, type: 'square', slideTo: 180 }); },
  /** a step along a line */
  tick(k = 0) { tone(700 + k * 90, { dur: 0.05, gain: 0.06, type: 'triangle' }); },
  /** the Sky Ferry's bell, up above */
  bell() { tone(1046, { dur: 0.9, gain: 0.05, type: 'sine' }); tone(1568, { dur: 0.7, gain: 0.025, type: 'sine', delay: 0.02 }); },
  /** a crate tips over */
  tip() { noise(0.5, { gain: 0.04, freq: 500, sweepTo: 180, q: 0.7, attack: 0.1 }); tone(110, { dur: 0.22, gain: 0.14, slideTo: 60, delay: 0.75 }); },
  /** a gulp and a little burp of sparkles */
  gulp() { tone(320, { dur: 0.12, gain: 0.08, slideTo: 150 }); tone(210, { dur: 0.18, gain: 0.08, type: 'triangle', slideTo: 320, delay: 0.3 }); },
};
