// Svelte 5 drops the spaces at the start and the end of a block ({#if}, {:else}, {#each}...): "4 student{s}{#if w}
// · {w} waiting{/if}" showed "4 students· 2 waiting" (a477e7e), and "{#if a}Well done {/if}{name}" would show
// "Well doneMia". Where a word sits right against a block, a space the block starts or ends with has to be kept
// another way: {' · '}, as in Teach.svelte. This reads every component and finds each place where two words
// would run together, so none can come back.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const svelteFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? svelteFiles(join(dir, d.name)) : d.name.endsWith('.svelte') ? [join(dir, d.name)] : []);

type Node = { type: string; start: number; data?: string; name?: string; elseif?: boolean };
type Frag = { nodes: Node[] } | null | undefined;
const field = (n: Node, k: string) => (n as unknown as Record<string, Frag>)[k];
/** Svelte's own whitespace: spaces, tabs and new lines (a non-breaking space stays) */
const ALL_WS = /^[ \t\r\n]*$/, STARTS_WS = /^[ \t\r\n]/, ENDS_WS = /[ \t\r\n]$/;
/** set aside before Svelte trims (clean_nodes), so they are never a block's first or last thing */
const AWAY = new Set(['Comment', 'ConstTag', 'DeclarationTag', 'DebugTag', 'SvelteBody', 'SvelteWindow', 'SvelteDocument', 'SvelteHead', 'TitleElement', 'SnippetBlock']);
/** elements that sit inside a line of words */
const INLINE = new Set(['a', 'abbr', 'b', 'bdi', 'code', 'em', 'i', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u']);
const BLOCKS = new Set(['IfBlock', 'EachBlock', 'KeyBlock', 'AwaitBlock']);
const KIDS = ['fragment', 'consequent', 'alternate', 'body', 'fallback', 'pending', 'then', 'catch'];

const kept = (f: Frag) => (f?.nodes ?? []).filter(n => !AWAY.has(n.type));
/** a block's branches: {#if}'s, each {:else if}'s and {:else}'s; {#each}'s body and its {:else}; {#key}'s; {#await}'s */
function branches(b: Node): Node[][] {
  if (b.type === 'IfBlock') {
    const alt = kept(field(b, 'alternate'));
    return [kept(field(b, 'consequent')), ...(alt.length === 1 && alt[0].type === 'IfBlock' && alt[0].elseif ? branches(alt[0]) : alt.length ? [alt] : [])];
  }
  const keys = b.type === 'EachBlock' ? ['body', 'fallback'] : b.type === 'KeyBlock' ? ['fragment'] : ['pending', 'then', 'catch'];
  return keys.map(k => kept(field(b, k))).filter(ns => ns.length);
}
const words = (ns: Node[]) => ns.filter(n => !(n.type === 'Text' && ALL_WS.test(n.data!)));
/** shows a word right at its end (or start): text, a {value}, an inline element (when `els`), or a block that does */
function wordAt(n: Node | undefined, end: boolean, els = true): boolean {
  if (!n) return false;
  if (n.type === 'Text') return !ALL_WS.test(n.data!) && !(end ? ENDS_WS : STARTS_WS).test(n.data!);
  if (n.type === 'ExpressionTag') return true;
  if (n.type === 'RegularElement') return els && INLINE.has(n.name!);
  if (BLOCKS.has(n.type)) return branches(n).some(ns => { const w = words(ns), x = end ? w.at(-1) : w[0]; return !!x && (x.type === 'Text' || wordAt(x, end, els)); });
  return false;
}

/** where a block's first or last space is dropped right against a word (offsets into the source) */
function runTogether(src: string): number[] {
  const out: number[] = [];
  const check = (blk: Node, before: Node | undefined, after: Node | undefined) => {
    const pre = wordAt(before, true), post = wordAt(after, false);
    branches(blk).forEach((b, k) => {
      const first = b[0], last = b.at(-1)!;
      const lead = first.type === 'Text' && STARTS_WS.test(first.data!), trail = last.type === 'Text' && ENDS_WS.test(last.data!);
      const w = words(b);
      if (!w.length) { if (lead && pre && post) out.push(first.start); return; }
      // an {#each}'s items follow each other: one item's end sits against the next one's start (items that are
      // elements are left alone: chips, ticks, letters and pictures, laid out by their CSS)
      const items = blk.type === 'EachBlock' && k === 0;
      if (lead && (pre || (items && (w.at(-1)!.type === 'Text' || wordAt(w.at(-1), true, false))))) out.push(first.start);
      if (trail && (post || (items && (w[0].type === 'Text' || wordAt(w[0], false, false))))) out.push(last.start);
    });
  };
  const walk = (f: Frag) => {
    const ns = kept(f);
    ns.forEach((n, j) => { if (BLOCKS.has(n.type)) check(n, ns[j - 1], ns[j + 1]); });
    for (const n of f?.nodes ?? []) for (const k of KIDS) { const c = field(n, k); if (c?.nodes) walk(c); }
  };
  walk((parse(src, { modern: true }) as unknown as { fragment: Frag }).fragment);
  return out;
}

describe('spaces at the start and end of a block', () => {
  it('the check finds a space dropped right against a word, and only there', () => {
    const n = (s: string) => runTogether(s).length;
    expect(n('<span>4 student{s}{#if w} · <em>{w} waiting</em>{/if}</span>')).toBe(1);
    expect(n("<span>4 student{s}{#if w}{' · '}<em>{w} waiting</em>{/if}</span>")).toBe(0);
    expect(n('<p>{#if a}Well done {/if}{name}!</p>')).toBe(1);
    expect(n('<p>Hi{#if n}!{:else} there{/if}</p>')).toBe(1);
    expect(n('<p>Hi{#if a}!{:else if b} there{:else}.{/if}</p>')).toBe(1);
    expect(n('<p><b>Mia</b>{#if a} is here{/if}</p>')).toBe(1);
    expect(n('<p>{#each xs as x} {x}{/each}</p>')).toBe(1);
    expect(n('<p>{#each xs as x}{x}, {/each}</p>')).toBe(1);
    expect(n('<p>{#if a}<Icon name="check" /> {/if}{text}</p>')).toBe(1);
    expect(n('<p>a{#if x} {/if}b</p>')).toBe(1);
    // the space before or after the block stays; s and other endings sit right against the word
    expect(n('<p>Hi {#if n} {n}{/if} there</p>')).toBe(0);
    expect(n('<p>{n} star{#if n !== 1}s{/if} left</p>')).toBe(0);
    expect(n('<ul>\n  {#each xs as x}\n    <li>{x}</li>\n  {/each}\n</ul>')).toBe(0);
    expect(n('<div>{#if a}\n  <b>x</b>\n{:else}\n  <i>y</i>\n{/if}</div>')).toBe(0);
    expect(n('<div><h2>Hi</h2>{#if a} <p>x</p>{/if}</div>')).toBe(0);
    expect(n('<div class="row">\n  {#each xs as x}\n    <span class="chip">{x}</span>\n  {/each}\n</div>')).toBe(0);
  });

  it('no component runs two words together that way', () => {
    const files = svelteFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap(f => {
      const src = readFileSync(f, 'utf8');
      return runTogether(src).map(o => `${relative(SRC, f)}:${src.slice(0, o).split('\n').length}: ${src.slice(Math.max(0, o - 50), o + 30).replace(/\s+/g, ' ')}`);
    });
    expect(bad).toEqual([]);
  });
});
