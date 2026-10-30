// meta.json written the way it is kept: two-space indents, each point (and a pair or short chain of
// points) on one line.
export function formatMeta(meta) {
  return JSON.stringify(meta, null, 2)
    .replace(/\[\s+(-?[\d.e-]+),\s+(-?[\d.e-]+),\s+(-?[\d.e-]+)\s+\]/g, '[$1, $2, $3]')
    .replace(/\[\s+(\[[^[\]\n]+\](?:,\s+\[[^[\]\n]+\]){1,3})\s+\]/g, (_, inner) => `[${inner.replace(/,\s+\[/g, ', [')}]`) + '\n';
}
