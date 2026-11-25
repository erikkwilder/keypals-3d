// A page that asks for code files a publish just removed reloads by itself, once: online only, and at most
// once in five minutes (so a page that still can't load stops and shows "This part didn't load").
import { describe, expect, it } from 'vitest';
import { KEY, WINDOW, reloadForUpdate, type ReloadEnv } from './reloadOnce';

function env(o: { online?: boolean; t?: number; stored?: string | null; noStore?: boolean } = {}) {
  const box: Record<string, string> = {};
  if (o.stored != null) box[KEY] = o.stored;
  let reloads = 0;
  const e: ReloadEnv = {
    online: () => o.online ?? true,
    store: o.noStore ? null : { getItem: (k) => box[k] ?? null, setItem: (k, v) => { box[k] = v; } },
    now: () => o.t ?? 1_000_000,
    reload: () => { reloads++; },
  };
  return { e, box, reloads: () => reloads };
}

describe('reloading once for an update', () => {
  it('reloads the first time, and remembers when', () => {
    const x = env({ t: 1_000_000 });
    expect(reloadForUpdate(x.e)).toBe(true);
    expect(x.reloads()).toBe(1);
    expect(x.box[KEY]).toBe('1000000');
  });
  it('not again within five minutes (a page that still fails shows its message)', () => {
    const x = env({ t: 1_000_000 + WINDOW - 1, stored: '1000000' });
    expect(reloadForUpdate(x.e)).toBe(false);
    expect(x.reloads()).toBe(0);
  });
  it('again after five minutes (a later publish in the same tab)', () => {
    const x = env({ t: 1_000_000 + WINDOW + 1, stored: '1000000' });
    expect(reloadForUpdate(x.e)).toBe(true);
    expect(x.reloads()).toBe(1);
  });
  it("never while offline (a reload would show the browser's own offline page)", () => {
    const x = env({ online: false });
    expect(reloadForUpdate(x.e)).toBe(false);
    expect(x.reloads()).toBe(0);
  });
  it('never without somewhere to remember it (so it can never loop)', () => {
    const x = env({ noStore: true });
    expect(reloadForUpdate(x.e)).toBe(false);
    expect(x.reloads()).toBe(0);
  });
});
