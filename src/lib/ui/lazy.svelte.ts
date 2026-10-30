// Screens and pieces of the game that load when they're first needed, not with the first page: the
// title comes up after a small download, and each screen's code (its 3D scene, its games, its data)
// follows when it opens. A piece that has loaded once is kept, so opening it again is instant.
import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component<any>;
type Loader = () => Promise<{ default: AnyComponent }>;

export type Lazy = {
  /** the component once it has loaded (asking for it starts the download) */
  readonly c: AnyComponent | null;
  /** the download failed (a dropped connection): `retry` tries again */
  readonly failed: boolean;
  load(): Promise<AnyComponent | null>;
  retry(): void;
};

export function lazy(loader: Loader): Lazy {
  let c = $state.raw<AnyComponent | null>(null);
  let failed = $state(false);
  let p: Promise<AnyComponent | null> | null = null;
  const load = () =>
    (p ??= loader().then(
      m => (c = m.default),
      () => { failed = true; p = null; return null; },
    ));
  return {
    get c() { if (!c && !p && !failed) void load(); return c; },
    get failed() { return failed; },
    load,
    retry() { failed = false; void load(); },
  };
}

/** Load some pieces when the computer has a quiet moment (the next screens a player is likely to open). */
export function preloadWhenIdle(pieces: Lazy[], after = 1500) {
  const idle = (f: () => void) => {
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout: 4000 }); else setTimeout(f, 200);
  };
  setTimeout(() => {
    let i = 0;
    // one at a time, so they never compete with what's on screen for the connection
    const next = () => { const l = pieces[i++]; if (l) idle(() => void l.load().then(next)); };
    next();
  }, after);
}
