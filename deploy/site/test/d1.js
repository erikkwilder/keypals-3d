// A small stand-in for Cloudflare's D1 (the parts worker.js uses), on Node's built-in SQLite, so the
// Worker can be tested with vitest: deploy/site/worker.test.js.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const plain = (r) => (r ? { ...r } : null);

export function makeD1(schemaFile = new URL('../schema.sql', import.meta.url)) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(schemaFile, 'utf8'));
  const stmt = (sql, args = []) => ({
    sql,
    bind: (...a) => stmt(sql, a),
    first: async (col) => { const r = plain(db.prepare(sql).get(...args)); return r && col ? r[col] : r; },
    all: async () => ({ success: true, results: db.prepare(sql).all(...args).map(plain) }),
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return {
    sqlite: db,
    prepare: (sql) => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(/^\s*select/i.test(s.sql) ? await s.all() : await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
