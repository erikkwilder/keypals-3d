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
    expect(rule![2]).toContain('outline: 3px solid var(--primary-hi); outline-offset: 3px;');
    expect(css).toContain('.btn:focus-visible { outline: 3px solid var(--primary-hi); outline-offset: 3px; }');
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
