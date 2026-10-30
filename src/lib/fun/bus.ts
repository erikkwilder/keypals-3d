// Surprises on the screen (FunLayer.svelte) hear about moments in the games through these: a golden
// letter typed, a math answer, the results, a battle starting, a visitor in the 3D world saying who it is
// ({ text, x, y }: where on the screen). One line in each game sends them.
export type FunKind = 'golden' | 'mathRight' | 'results' | 'battleStart' | 'finishStar' | 'bubblePop' | 'visitor';
type Listener = (kind: FunKind, data?: unknown) => void;
const listeners = new Set<Listener>();
export function funEvent(kind: FunKind, data?: unknown) { for (const l of listeners) { try { l(kind, data); } catch { /* a surprise must never break a game */ } } }
export function onFun(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
/** The 3D world's surprises show only during a lesson or trip (the islands are reused for battles). */
export const world = { run: false };
