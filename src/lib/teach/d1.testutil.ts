// A stand-in for Cloudflare's D1 in tests: the same calls (prepare, bind, first, all, run, batch) over
// Node's own SQLite, with the real schema files. Used by server.test.ts to run worker.js end to end.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

type Row = Record<string, unknown>;
class Stmt {
  constructor(private db: DatabaseSync, private sql: string, private args: unknown[] = []) {}
  bind(...args: unknown[]) { return new Stmt(this.db, this.sql, args); }
  private params() { return this.args.map(a => (a === undefined ? null : typeof a === 'boolean' ? (a ? 1 : 0) : a)) as (string | number | null)[]; }
  async first<T = Row>(): Promise<T | null> { return ((this.db.prepare(this.sql).get(...this.params()) as T) ?? null); }
  async all<T = Row>(): Promise<{ results: T[] }> { return { results: this.db.prepare(this.sql).all(...this.params()) as T[] }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.params()); return { meta: { changes: Number(r.changes) } }; }
}
export class TestD1 {
  readonly db = new DatabaseSync(':memory:');
  constructor() {
    for (const f of ['schema.sql', 'schema-classes.sql']) this.db.exec(readFileSync(new URL(`../../../deploy/site/${f}`, import.meta.url), 'utf8'));
  }
  prepare(sql: string) { return new Stmt(this.db, sql); }
  async batch(list: Stmt[]) {
    this.db.exec('BEGIN');
    try { const out = []; for (const s of list) out.push(await s.run()); this.db.exec('COMMIT'); return out; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  /** every row of a table (for looking at what's stored) */
  rows(table: string): Row[] { return this.db.prepare(`SELECT * FROM ${table}`).all() as Row[]; }
}
