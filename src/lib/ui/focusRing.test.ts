// Where the keyboard is, at a glance: everything it reaches gets the buttons' 3 px ring (it was Chrome's own
// 1 px ring, thin on the pastel backgrounds, and only a soft shadow on the name box and the class-code box).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const css = src('../../app.css');

describe('the focus ring', () => {
  it('buttons, links, boxes, lists and anything else Tab reaches get .btn\'s ring', () => {
    const rule = css.match(/^:where\(([^)]*\([^)]*\)[^)]*)\):where\(:focus-visible\) \{([^}]*)\}/m);
    expect(rule).not.toBeNull();
    for (const s of ['button', 'a[href]', 'input', 'select', 'textarea', 'summary', "[tabindex]:not([tabindex='-1'])"]) expect(rule![1], s).toContain(s);
    expect(rule![2]).toContain('outline: 3px solid var(--primary-edge); outline-offset: 3px;');
    expect(css).toContain('.btn:focus-visible { outline: 3px solid var(--primary-edge); outline-offset: 3px; }');
  });
  it('stands out at least 3 to 1 from a white page in every look (the guidelines ask that of a focus ring)', () => {
    const lum = (hex: string) => {
      const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const edges = [...css.matchAll(/--primary-edge: (#[0-9a-f]{6})/gi)].map(m => m[1]);
    expect(edges.length).toBe(4); // the default look, ink, paper and geo
    for (const e of edges) expect(1.05 / (lum(e) + 0.05), e).toBeGreaterThanOrEqual(3);
  });
  it('no component draws its own ring in the light colour (the home tiles, Google sign-in and others did)', async () => {
    const { readdirSync } = await import('node:fs');
    const root = new URL('../../', import.meta.url);
    const files = (readdirSync(root, { recursive: true }) as string[]).filter(f => f.endsWith('.svelte'));
    expect(files.length).toBeGreaterThan(100);
    const light = files.filter(f => /focus-visible[^}]*--primary-hi/.test(readFileSync(new URL(f, root), 'utf8')));
    expect(light).toEqual([]);
  });
  it('counts for nothing (all of it inside :where), so a component\'s own focus style still wins', () => {
    const line = css.split('\n').find(l => l.includes(':where(:focus-visible)'))!;
    const selector = line.slice(0, line.indexOf(' {'));
    // nothing outside the two :where()s
    expect(selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')).toBe('');
  });
  it('the name box and the class-code box no longer turn it off', () => {
    const name = src('../screens/NewPlayer.svelte').match(/\.name \{[^}]*\}/)![0];
    expect(name).not.toContain('outline');
    const code = src('../screens/ClassLogin.svelte').match(/\.codef input:focus \{[^}]*\}/)![0];
    expect(code).not.toContain('outline');
    expect(code).toContain('border-color: var(--primary-hi)');
  });
});
