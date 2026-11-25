// The grown-up check's "Press and hold" button (GrownupGate.svelte): the bar that fills while it's held,
// and what holds it. A finger or a mouse holds it with the pointer. Enter or Space held down holds it the
// same way: the key's repeats (a keyboard sends one about every 33 ms) change nothing, and letting go, or
// leaving the button, stops and empties the bar. A screen reader or a switch presses a button with a click
// that has no pointer behind it (`detail` 0) and can't hold, so that click goes straight on to the number
// question, which is the real check. A mouse or finger click (`detail` 1 or more) changes nothing here: the
// pointer's hold does that.

const HOLD_KEYS = new Set(['Enter', ' ']);
const STEP = 0.05, TICK = 75; // full in 1.5 s

type Key = Pick<KeyboardEvent, 'key' | 'repeat' | 'preventDefault'>;

export class HoldButton {
  /** how full the bar is, 0 to 1 */
  fill = $state(0);
  #ondone: () => void;
  #timer: ReturnType<typeof setInterval> | undefined;
  #key: string | null = null; // the key holding the button down
  #keyJustUp = false; // a click the browser sends as that key comes up is the key's, not a screen reader's
  #done = false;

  /** `ondone`: held long enough, or pressed by a screen reader: on to the number question (called once) */
  constructor(ondone: () => void) { this.#ondone = ondone; }

  #pass() {
    if (this.#done) return;
    this.#done = true;
    clearInterval(this.#timer);
    this.#ondone();
  }

  start = () => {
    clearInterval(this.#timer);
    this.fill = 0;
    this.#timer = setInterval(() => {
      this.fill += STEP;
      // full: a finger or a mouse goes on at once, a key when it comes up (the number box takes the
      // keyboard then, so a held Space's repeats can't type into it)
      if (this.fill >= 1) { clearInterval(this.#timer); if (this.#key === null) this.#pass(); }
    }, TICK);
  };

  stop = () => {
    clearInterval(this.#timer);
    if (this.#done) return;
    if (this.fill >= 1) this.#pass();
    else this.fill = 0;
  };

  keydown = (e: Key) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault(); // (or the browser's own click for Enter or Space comes too)
    if (e.repeat || this.#key !== null) return;
    this.#key = e.key;
    this.start();
  };

  keyup = (e: Key) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    if (e.key !== this.#key) return;
    this.#key = null;
    this.#keyJustUp = true;
    setTimeout(() => (this.#keyJustUp = false));
    this.stop();
  };

  blur = () => {
    this.#key = null;
    this.stop();
  };

  click = (e: Pick<MouseEvent, 'detail'>) => {
    if (e.detail === 0 && this.#key === null && !this.#keyJustUp) this.#pass();
  };

  dispose = () => clearInterval(this.#timer);
}
