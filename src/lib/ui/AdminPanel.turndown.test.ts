// Turning a teacher down in Grown-ups > Admin > Teachers (read from the source: the panel needs an admin signed
// in): asked first, with the teacher's name.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./AdminPanel.svelte', import.meta.url), 'utf8');

describe('Turn down', () => {
  it('asks first, "Turn down {name}? Their classes stay off.", with Turn down and Cancel', () => {
    expect(src).toContain('<button class="btn" onclick={() => (declining = t.account)}>Turn down</button>');
    expect(src).toContain('<span class="confirm">Turn down {t.display}? Their classes stay off.</span>');
    expect(src).toContain(`<button class="btn" onclick={() => { declining = null; void setTeacher(t.account, 'declined'); }}>Turn down</button>`);
    expect(src).toContain('<button class="btn" onclick={() => (declining = null)}>Cancel</button>');
  });
  it('is the only way to turn one down: no button does it straight away', () => {
    expect(src.match(/setTeacher\(t\.account, 'declined'\)/g)).toHaveLength(1);
  });
});
