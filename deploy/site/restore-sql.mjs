// The SQL that puts a weekly backup back (restore-backup.mjs runs it with wrangler; worker.test.js runs it
// on the stand-in database). Each table's columns come from the backup's own rows, so a table or column
// added later comes back too.

/** Parents first: accounts before the players that point at them, classes before their students. */
export const RESTORE_ORDER = [
  'accounts', 'players', 'ideas', 'problems',
  // classes (schema-classes.sql)
  'teachers', 'classes', 'students', 'assignments', 'player_week', 'challenges', 'challenge_classes',
  'teacher_status', 'class_settings', 'student_google', 'account_domains',
];

const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const PIECE = 60000;

/** rows: { table: [row, ...] }, as the backup's files hold them. One statement a line; a big saved player
 *  goes in as pieces (no statement may be longer than about 100 KB). */
export function restoreLines(rows) {
  const unknown = Object.keys(rows).filter(t => rows[t].length && !RESTORE_ORDER.includes(t));
  if (unknown.length) throw new Error(`The backup has tables the restore doesn't know: ${unknown.join(', ')}. Add them to RESTORE_ORDER.`);
  const lines = [];
  for (const t of RESTORE_ORDER) {
    for (const r of rows[t] ?? []) {
      const cols = Object.keys(r);
      if (t !== 'players' || String(r.data).length <= PIECE) { lines.push(`INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(c => q(r[c])).join(', ')});`); continue; }
      const d = String(r.data);
      lines.push(`INSERT OR REPLACE INTO players (${cols.join(', ')}) VALUES (${cols.map(c => (c === 'data' ? q(d.slice(0, PIECE)) : q(r[c]))).join(', ')});`);
      for (let i = PIECE; i < d.length; i += PIECE) lines.push(`UPDATE players SET data = data || ${q(d.slice(i, i + PIECE))} WHERE code = ${q(r.code)};`);
    }
  }
  // a player a grown-up deleted everywhere since the backup stays deleted (worker.js: the gone table)
  lines.push('DELETE FROM players WHERE code IN (SELECT code FROM gone);');
  return lines;
}
