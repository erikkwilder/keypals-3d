// A picture address inside a CSS variable is read by the browser against the stylesheet that uses the
// variable, not the page. In a built game that stylesheet is in /assets/, so `style:--bg="url({base}...)"`
// (base is "./") asked Chrome for /assets/learn/ep/set-dock.webp, a 404, when the picture is at
// /learn/ep/set-dock.webp: every lesson's loading backdrop and end-card frame were missing. A variable's
// picture needs a whole address, new URL(`${base}...`, document.baseURI).href, as in Adventure.svelte.
// (A plain property, such as style:background-image, is read against the page, so it needs nothing.)
// The dev server puts the CSS in the page, so this can't be seen there: this test is the check.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const svelteFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? svelteFiles(join(dir, d.name)) : d.name.endsWith('.svelte') ? [join(dir, d.name)] : []);

/** what each CSS variable in a component's markup is set to: style:--name="..." or ={...}, and --name: ...
 *  inside a style="..." or style={`...`} string */
function cssVarValues(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/style:--[\w-]+(?:\|important)?=("[^"]*"|\{[^\n]*?\}(?=\s|\/?>))/g)) out.push(m[1]);
  for (const m of src.matchAll(/style=("[^"]*"|\{`[^`]*`\})/g)) for (const d of m[1].matchAll(/--[\w-]+\s*:\s*([^;"`]*)/g)) out.push(d[1]);
  return out;
}
/** a picture address that isn't whole: it starts with {base}, BASE_URL, ./ or ../ */
const RELATIVE = /url\(\s*['"]?\s*(\{\s*(base|import\.meta\.env\.BASE_URL)\s*\}|\$\{\s*(base|import\.meta\.env\.BASE_URL)\s*\}|\.\.?\/)/;
const relativeIn = (src: string) => cssVarValues(src).filter(v => RELATIVE.test(v));

describe('pictures in CSS variables', () => {
  it('the check catches a picture address that is not whole, and only in a variable', () => {
    expect(relativeIn('<div class="ep" style:--sc={L.color} style:--bg="url({base}{place.backdrop})">')).toEqual(['"url({base}{place.backdrop})"']);
    expect(relativeIn('<div class="card" style:--frame="url({base}learn/ep/card-frame.webp)">')).toHaveLength(1);
    expect(relativeIn('<div style="--paper: url(./math/integers/paper.webp)">')).toHaveLength(1);
    expect(relativeIn('<div style:--bg={`url(${import.meta.env.BASE_URL}learn/ep/set-lab-soft.webp)`}>')).toHaveLength(1);
    expect(relativeIn('<div style:--bg="url({new URL(`${base}${place.backdrop}`, document.baseURI).href})">')).toEqual([]);
    expect(relativeIn("<div style:--pondart=\"url({art('math/pond.webp')})\">")).toEqual([]);
    expect(relativeIn('<div style:background-image="url({base}game/book-hero.webp)">')).toEqual([]);
  });

  it('no component sets a CSS variable to a picture address that is not whole', () => {
    const files = svelteFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap(f => relativeIn(readFileSync(f, 'utf8')).map(v => `${relative(SRC, f)}: ${v}`));
    expect(bad).toEqual([]);
  });

  it("finds the lessons' backdrops and frames, so the check above isn't empty", () => {
    for (const f of ['lib/math/ui/EpisodeClassic.svelte', 'lib/math/beats/BeatEpisode.svelte', 'lib/math/measure/MeasureEpisode.svelte']) {
      const urls = cssVarValues(readFileSync(join(SRC, f), 'utf8')).filter(v => v.includes('url('));
      expect(urls, f).toHaveLength(2);
      for (const u of urls) expect(u, f).toContain('document.baseURI).href');
    }
  });
});
