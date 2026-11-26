#!/usr/bin/env node
// Several takes of a line to choose from, each with its own seed: made by the local model in one run (it loads
// once) and processed exactly as generate.mjs processes a clip, into scripts/voice/raw/local/takes/<id>.s<seed>.mp3
// next to <id>.old.mp3 (the clip as it was). public/voice, made.json and the manifest are left as they were.
//
//   node scripts/voice/takes.mjs --only ep.count.how,ep.count.fit --seeds 101-108
//
// To keep a take: give the line that seed in line-overrides.json ({ "<id>": { "seed": 104 } }) and run
// `node scripts/voice/generate.mjs --only <id> --process-only` (its raw take stays in raw/local, which git ignores).
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'public', 'voice');
const LOCAL_RAW = join(HERE, 'raw', 'local');
const TAKES = join(LOCAL_RAW, 'takes');
const PYTHON = existsSync('/opt/homebrew/bin/python3') ? '/opt/homebrew/bin/python3' : 'python3';
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const ids = (opt('--only') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!ids.length) throw new Error('usage: takes.mjs --only id1,id2 [--seeds 101-108]');
const [s0, s1] = (opt('--seeds') || '101-108').split('-').map(Number);
const seeds = Array.from({ length: (s1 ?? s0) - s0 + 1 }, (_, i) => s0 + i);

const { ALL_LINES } = await import(pathToFileURL(join(ROOT, 'src', 'lib', 'content', 'voice.ts')).href);
const VOICES = JSON.parse(readFileSync(join(HERE, 'voices.json'), 'utf8'));
const OV_PATH = join(HERE, 'line-overrides.json');
const ovText = existsSync(OV_PATH) ? readFileSync(OV_PATH, 'utf8') : '{}\n';
const OV = JSON.parse(ovText);
const lines = ids.map((id) => {
  const l = ALL_LINES.find((x) => x.id === id);
  if (!l) throw new Error(`unknown line id "${id}"`);
  if (!VOICES[l.voice]?.local) throw new Error(`${id}: voice "${l.voice}" has no local voice`);
  return l;
});
const spoken = (l) => (OV[l.id] || {}).text || l.said || l.text;
// generate.mjs's recipe hash for the local engine with this seed, so `--process-only` finds the raw take
const hashFor = (l, seed) => {
  const o = { ...(OV[l.id] || {}), seed };
  return createHash('sha1').update(['local', VOICES[l.voice].local, spoken(l), o.seed ?? '', JSON.stringify(o.settings || {})].join('|') + (o.speed != null ? `|${o.speed}` : '')).digest('hex').slice(0, 10);
};

mkdirSync(TAKES, { recursive: true });
const jobs = lines.flatMap((l) => seeds.map((seed) => ({ id: `${l.id}__${hashFor(l, seed)}`, text: spoken(l), voice: VOICES[l.voice].local, seed,
  ...(OV[l.id]?.speed != null ? { speed: OV[l.id].speed } : {}) })));
const jobsPath = join(LOCAL_RAW, 'takes-jobs.json');
writeFileSync(jobsPath, JSON.stringify(jobs, null, 1));
let r = spawnSync(PYTHON, [join(HERE, 'local_tts.py'), '--in', jobsPath, '--out', LOCAL_RAW], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('local_tts.py failed');

for (const l of lines) {
  const cur = join(OUT, `${l.id}.mp3`), old = join(TAKES, `${l.id}.old.mp3`);
  if (existsSync(cur) && !existsSync(old)) copyFileSync(cur, old);
}
// generate.mjs rewrites these for each seed: kept here and put back after
const keep = [join(HERE, 'made.json'), join(ROOT, 'src', 'lib', 'content', 'voice-manifest.json'), join(HERE, 'raw', 'report.json'), ...lines.map((l) => join(OUT, `${l.id}.mp3`))];
const saved = keep.map((p) => (existsSync(p) ? readFileSync(p) : null));
try {
  for (const seed of seeds) {
    const ov = JSON.parse(ovText);
    for (const l of lines) ov[l.id] = { ...(ov[l.id] || {}), seed };
    writeFileSync(OV_PATH, JSON.stringify(ov, null, 2) + '\n');
    r = spawnSync(process.execPath, [join(HERE, 'generate.mjs'), '--only', ids.join(','), '--process-only'], { encoding: 'utf8' });
    const made = (r.stdout || '').split('\n').filter((s) => /^\[\d+\/\d+\]/.test(s));
    if (r.status !== 0 || made.length !== lines.length) throw new Error(`seed ${seed}: generate.mjs --process-only made ${made.length} of ${lines.length}\n${r.stdout}\n${r.stderr}`);
    for (const l of lines) copyFileSync(join(OUT, `${l.id}.mp3`), join(TAKES, `${l.id}.s${seed}.mp3`));
    for (const m of made) console.log(`seed ${seed}: ${m.replace(/^\[\d+\/\d+\]\s*/, '')}`);
  }
} finally {
  writeFileSync(OV_PATH, ovText);
  keep.forEach((p, i) => { if (saved[i]) writeFileSync(p, saved[i]); });
}
console.log(`takes in ${TAKES}`);
