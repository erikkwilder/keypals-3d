// "Already play on another computer?" on New player is how a child back on a new computer brings their player
// here. As btn-ghost (no background, border or shadow) it read as a bold line of text under the name box,
// so a child who had played before would most likely type their name and start again.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('"Already play on another computer?" looks like a button', () => {
  const s = src('./SaveCodeForm.svelte');
  it('is a plain .btn with the same words', () => {
    expect(s).toContain('<button class="btn codebtn" onclick={() => (open = true)}>Already play on another computer?</button>');
    expect(s).not.toContain('btn-ghost codebtn');
  });
  it('.btn shows as a button (a background, a border and its shadow) and is the size btn-ghost was', () => {
    const css = src('../../app.css');
    const btn = css.match(/^\.btn \{([\s\S]*?)\}/m)![1];
    for (const w of ['background: var(--card)', 'border: var(--btn-border)', 'box-shadow: 0 4px 0 var(--btn-shadow-color)']) expect(btn, w).toContain(w);
    // (btn-ghost only took the background and shadow away, so the screen's layout is as it was)
    expect(css).toContain('.btn-ghost { background: transparent; box-shadow: none; }');
  });
});
