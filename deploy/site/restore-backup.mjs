#!/usr/bin/env node
// Put saved players and grown-up accounts back from a weekly backup (worker.js backup, R2 bucket
// "keypals-backups"). Every player and account in the backup goes back to how it was then; players made
// after the backup are left as they are. See RESTORE.md.
//
//   node restore-backup.mjs                       # what the latest backup holds (nothing is written)
//   node restore-backup.mjs 2026-11-01 --yes      # put that backup back into the live database
//   node restore-backup.mjs latest --database keypals-restore-test --yes   # into a test database
//   node restore-backup.mjs latest --local --persist-to <dir> --yes        # wrangler dev's local copies
//
// Options: --database <name> (default keypals), --root <path/> (a prefix in front of backups/, for
// tests), --local and --persist-to <dir> (read the local R2 and write the local D1 of `wrangler dev`),
// --from-local (read the local R2 but write the remote database), --yes (actually write).
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'latest';
const DB = opt('--database', 'keypals'), ROOT = opt('--root', ''), PERSIST = opt('--persist-to');
const LOCAL = flag('--local'), FROM_LOCAL = LOCAL || flag('--from-local'), WRITE = flag('--yes');
const ACCOUNT = '2f5232a84d058ef9f332c077eef372d8';
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_EMAIL: 'erikkwilder@gmail.com', CLOUDFLARE_API_KEY: readFileSync(join(homedir(), '.cloudflare/global-api-key'), 'utf8').trim() };
const wrangler = (a, opts = {}) => execFileSync('npx', ['wrangler', ...a], { cwd: HERE, env, maxBuffer: 1 << 30, ...opts });
const where = (local) => (local ? ['--local', ...(PERSIST ? ['--persist-to', PERSIST] : [])] : ['--remote']);

/** one object from the backup bucket, as bytes */
const get = (key) => wrangler(['r2', 'object', 'get', `keypals-backups/${ROOT}${key}`, '--pipe', ...where(FROM_LOCAL)], { stdio: ['ignore', 'pipe', 'ignore'] });

// 1. which backup
const prefix = which === 'latest' ? JSON.parse(get('backups/latest.json').toString()).prefix : `backups/${which}/`;
const manifest = JSON.parse(get(`${prefix}manifest.json`).toString());
console.log(`Backup from ${new Date(manifest.at).toISOString()}: ${Object.entries(manifest.counts).map(([t, n]) => `${n} ${t}`).join(', ')} in ${manifest.files.length} file(s).`);

// 2. read every file
const rows = { players: [], accounts: [] };
for (const f of manifest.files) {
  const table = f.split('/').pop().split('-')[0];
  rows[table].push(...JSON.parse(gunzipSync(get(f)).toString()));
}
for (const [t, n] of Object.entries(manifest.counts)) if (rows[t].length !== n) throw new Error(`${t}: the manifest says ${n} rows, the files hold ${rows[t].length}`);
if (!WRITE) { console.log(`Read ${rows.players.length} players and ${rows.accounts.length} accounts. Nothing written (add --yes to restore into "${DB}"${LOCAL ? ' (local)' : ''}).`); process.exit(0); }

// 3. write them back (accounts first, so players can point at them)
const COLS = { accounts: ['id', 'provider', 'sub', 'email', 'name', 'created', 'seen'], players: ['code', 'data', 'updated', 'created', 'opened', 'account'] };
const ordered = [['accounts', rows.accounts], ['players', rows.players]];
// one SQL file; a big saved player goes in as pieces (no statement may be longer than about 100 KB)
const q = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`);
const PIECE = 60000;
const lines = [];
for (const [t, rs] of ordered) {
  for (const r of rs) {
    if (t !== 'players' || String(r.data).length <= PIECE) { lines.push(`INSERT OR REPLACE INTO ${t} (${COLS[t].join(', ')}) VALUES (${COLS[t].map(c => q(r[c])).join(', ')});`); continue; }
    const d = String(r.data);
    lines.push(`INSERT OR REPLACE INTO players (${COLS.players.join(', ')}) VALUES (${COLS.players.map(c => (c === 'data' ? q(d.slice(0, PIECE)) : q(r[c]))).join(', ')});`);
    for (let i = PIECE; i < d.length; i += PIECE) lines.push(`UPDATE players SET data = data || ${q(d.slice(i, i + PIECE))} WHERE code = ${q(r.code)};`);
  }
}
// a player a grown-up deleted everywhere since the backup stays deleted (worker.js: the gone table)
lines.push('DELETE FROM players WHERE code IN (SELECT code FROM gone);');
const dir = mkdtempSync(join(tmpdir(), 'kp-restore-')), file = join(dir, 'restore.sql');
writeFileSync(file, lines.join('\n'));
try { wrangler(['d1', 'execute', DB, ...where(LOCAL), '--file', file, ...(LOCAL ? [] : ['--yes'])], { stdio: ['ignore', 'ignore', 'inherit'] }); }
finally { rmSync(dir, { recursive: true }); }
console.log(`Restored ${rows.accounts.length} accounts and ${rows.players.length} players into "${DB}"${LOCAL ? ' (local)' : ''}.`);
