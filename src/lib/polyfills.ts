// Small stand-ins for browser features newer than Safari 14 (macOS Catalina's built-in engine
// before its Safari updates). Loaded before anything else.
const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.structuredClone !== 'function') {
  // game data is plain JSON, so a JSON round trip is a faithful copy
  g.structuredClone = (v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, 'at', {
    configurable: true, writable: true,
    value(this: unknown[], i: number) { const n = Math.trunc(i) || 0; return this[n < 0 ? this.length + n : n]; },
  });
}
if (!(Object as unknown as { hasOwn?: unknown }).hasOwn) {
  Object.defineProperty(Object, 'hasOwn', { configurable: true, writable: true, value: (o: object, k: PropertyKey) => Object.prototype.hasOwnProperty.call(o, k) });
}

/** A rough name for the browser engine, from what it can do (the Mac app's user agent hides the Safari version). */
export function engineLabel(): string {
  const s = (q: string) => typeof CSS !== 'undefined' && CSS.supports(q);
  const native = typeof (window as unknown as { structuredClone?: unknown }).structuredClone === 'function' && !String(window.structuredClone).includes('JSON');
  if (s('color: color-mix(in srgb, red, blue)')) return 'Safari 16.2 or newer';
  if (native) return 'Safari 15.4 to 16.1';
  if (s('aspect-ratio: 1')) return 'Safari 15.0 to 15.3';
  if (s('inset: 0')) return 'Safari 14.1';
  return 'Safari 14.0 or older';
}
