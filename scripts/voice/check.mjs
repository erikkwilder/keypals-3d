#!/usr/bin/env node
// Checks the finished clips in public/voice/ against src/lib/content/voice.ts.
//
//   node scripts/voice/check.mjs              levels and words for every clip
//   node scripts/voice/check.mjs --levels     levels only (fast)
//   node scripts/voice/check.mjs --only a,b   just these lines
//
// Levels: duration, loudness, true peak, full-scale samples, and the level of the first and last
// 50 ms. Words: transcribes each clip with mlx_whisper (whisper-large-v3-turbo) and compares it
// with the line's text; clips that differ are listed so they can be remade with
// `node scripts/voice/generate.mjs --only <id>` (add a new seed in line-overrides.json if the same
// take comes back). Results are saved to scripts/voice/raw/check.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(ROOT, 'public', 'voice');
const SR = 44100;
const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const args = process.argv.slice(2);
const LEVELS_ONLY = args.includes('--levels');
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const ONLY = onlyArg ? new Set(onlyArg.split(',')) : null;

const { ALL_LINES } = await import(pathToFileURL(join(ROOT, 'src', 'lib', 'content', 'voice.ts')).href);
const lines = ALL_LINES.filter((l) => (!ONLY || ONLY.has(l.id)) && existsSync(join(OUT, `${l.id}.mp3`)));

// ------------------------------------------------------------------ levels

const db = (x) => 20 * Math.log10(x + 1e-9);
function decode(path) {
  const b = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 }).stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
function loudness(path) {
  const err = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-stream_loop', '3', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { maxBuffer: 1 << 28 }).stderr.toString();
  const s = err.slice(err.lastIndexOf('Summary:'));
  return { lufs: Number((s.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]), tp: Number((s.match(/True peak:\s+Peak:\s+(-?[\d.]+) dBFS/) || [])[1]) };
}
function levels(path) {
  const x = decode(path);
  const n = Math.round(0.05 * SR);
  const rms = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return db(Math.sqrt(s / (b - a))); };
  const pk = (a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i])); return db(m); };
  let full = 0;
  for (const v of x) if (Math.abs(v) >= 0.999) full++;
  return { ms: Math.round((x.length * 1000) / SR), ...loudness(path), fullScale: full,
    headRms: +rms(0, n).toFixed(1), headPeak: +pk(0, n).toFixed(1), tailRms: +rms(x.length - n, x.length).toFixed(1), tailPeak: +pk(x.length - n, x.length).toFixed(1) };
}

const results = {};
for (const l of lines) results[l.id] = { id: l.id, voice: l.voice, text: l.text, ...levels(join(OUT, `${l.id}.mp3`)) };
const vals = Object.values(results);
const max = (k) => Math.max(...vals.map((r) => r[k]));
const min = (k) => Math.min(...vals.map((r) => r[k]));
console.log(`${vals.length} clips  |  duration ${min('ms')}-${max('ms')} ms  |  loudness ${min('lufs')} to ${max('lufs')} LUFS  |  ` +
  `true peak max ${max('tp')} dBTP  |  full-scale samples ${vals.reduce((a, r) => a + r.fullScale, 0)}`);
console.log(`first 50 ms: RMS max ${max('headRms')} dB, peak max ${max('headPeak')} dB  |  last 50 ms: RMS max ${max('tailRms')} dB, peak max ${max('tailPeak')} dB`);
const loudEdges = vals.filter((r) => r.headRms > -40 || r.tailRms > -40);
if (loudEdges.length) console.log(`edges above -40 dB RMS: ${loudEdges.map((r) => `${r.id} (head ${r.headRms}, tail ${r.tailRms})`).join(', ')}`);
const overPeak = vals.filter((r) => r.tp > -1.5 || r.fullScale > 0);
if (overPeak.length) console.log(`OVER the -1.5 dBTP ceiling: ${overPeak.map((r) => `${r.id} ${r.tp}`).join(', ')}`);

// ------------------------------------------------------------------ words

if (!LEVELS_ONLY) {
  let python;
  try {
    const bin = execFileSync('which', ['mlx_whisper']).toString().trim();
    python = readFileSync(bin, 'utf8').split('\n')[0].replace(/^#!/, '').trim();
  } catch {
    console.log('mlx_whisper not found: skipping the word check');
    process.exit(0);
  }
  const py = `
import sys, json, mlx_whisper
for f in sys.argv[1:]:
    r = mlx_whisper.transcribe(f, path_or_hf_repo='mlx-community/whisper-large-v3-turbo', language='en', verbose=None, condition_on_previous_text=False)
    print(json.dumps({'f': f, 't': r['text'].strip()}), flush=True)
`;
  const files = lines.map((l) => join(OUT, `${l.id}.mp3`));
  const out = spawnSync(python, ['-I', '-c', py, ...files], { maxBuffer: 1 << 26 }).stdout.toString();
  const heard = {};
  for (const row of out.split('\n').filter((s) => s.startsWith('{'))) {
    const { f, t } = JSON.parse(row);
    heard[f.split('/').pop().slice(0, -4)] = t;
  }

  const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  // Compare letters only: no spaces (so "semi colon" = "semicolon"), digits as words, and
  // stretched letters squashed ("Hellooo" = "Hello", "Mmm" = "Mm").
  const norm = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/\d+/g, (d) => NUM[+d] ?? d)
    .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
  const lev = (a, b) => {
    const d = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0]; d[0] = i;
      for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
    }
    return d[b.length];
  };
  const flagged = [];
  for (const l of lines) {
    const h = heard[l.id] ?? '';
    const a = norm(l.text), b = norm(h);
    const sim = 1 - lev(a, b) / Math.max(a.length, b.length, 1);
    results[l.id].heard = h;
    results[l.id].match = +sim.toFixed(3);
    if (sim < 0.9) flagged.push(l.id);
  }
  console.log(`\nword check: ${lines.length - flagged.length}/${lines.length} clips match their text (90% letter match or better)`);
  for (const id of flagged) console.log(`  ${id}  [${results[id].match}]\n    text:  ${results[id].text}\n    heard: ${results[id].heard}`);
}

mkdirSync(join(HERE, 'raw'), { recursive: true });
const checkPath = join(HERE, 'raw', 'check.json');
// Merge into earlier results so a levels-only or --only run keeps the other clips' word checks.
const merged = existsSync(checkPath) ? JSON.parse(readFileSync(checkPath, 'utf8')) : {};
for (const [id, r] of Object.entries(results)) merged[id] = { ...(merged[id] || {}), ...r };
for (const id of Object.keys(merged)) if (!ALL_LINES.some((l) => l.id === id)) delete merged[id];
writeFileSync(checkPath, JSON.stringify(merged, null, 1));
