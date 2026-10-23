#!/usr/bin/env node
// Makes the spoken voice lines with ElevenLabs.
//
//   node scripts/voice/generate.mjs                 make every line whose mp3 is missing
//   node scripts/voice/generate.mjs --only id1,id2  remake these lines (even if they exist)
//   node scripts/voice/generate.mjs --voice kip     limit to one voice (missing lines only, or all with --force)
//   node scripts/voice/generate.mjs --force         remake everything
//   node scripts/voice/generate.mjs --process-only  redo the trim/fade/level pass from scripts/voice/raw/ (no API calls)
//   node scripts/voice/generate.mjs --dry-run       show what would be made and the credit estimate
//
// Lines come from src/lib/content/voice.ts (ALL_LINES). Voices and their settings come from
// scripts/voice/voices.json. Per-line fixes (another seed, spoken text that differs from the caption,
// setting tweaks) go in scripts/voice/line-overrides.json.
//
// Raw downloads land in scripts/voice/raw/<id>.mp3 (git-ignored). Processed clips go to
// public/voice/<id>.mp3 and durations to src/lib/content/voice-manifest.json.
//
// Needs: Node 22+, ffmpeg on PATH or at /opt/homebrew/bin/ffmpeg, an ElevenLabs key in
// ~/.keys/elevenlabs.key (or ELEVENLABS_API_KEY). No npm packages.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const RAW = join(HERE, 'raw');
const OUT = join(ROOT, 'public', 'voice');
const MANIFEST = join(ROOT, 'src', 'lib', 'content', 'voice-manifest.json');
const VOICE_TS = join(ROOT, 'src', 'lib', 'content', 'voice.ts');

const MODEL = 'eleven_multilingual_v2';
const FORMAT = 'mp3_44100_128';
const MIN_CREDITS = 20000; // other projects share the account: never dip below this
const CREDITS_PER_CHAR = 0.4; // measured on this account; only used for the estimate
const CONCURRENCY = 3;

// Processing targets
const SR = 44100;
const FRAME = 220; // 5 ms analysis frames
const FRAME_MS = 5;
const SILENCE_DB = -62; // "sound" means a frame louder than this
const GAP_FRAMES = 12; // quiet runs shorter than 60 ms stay inside a sound island
const LEAD_MS = 40; // silence kept before the first sound
const TAIL_MS = 35; // kept after the last word decays below SILENCE_DB, so the fade-out covers the decay, not the word
const FADE_IN_MS = 10;
const FADE_OUT_MS = 40;
// The brief asked for about -18 LUFS. These voices are peaky (true peak sits 18-22 dB over their
// loudness), so with one linear gain and the -1.5 dBTP ceiling, 105 of 166 clips could not reach
// -18. -20 keeps 117 clips on target and the rest within about 3 LU of it.
const TARGET_LUFS = -20;
const MAX_TRUE_PEAK = -1.5;
const TP_HEADROOM = 0.2; // extra room for mp3 overshoot; checked again after encoding
const BREATH_DUCK_DB = -15;

const FFMPEG = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';

// ------------------------------------------------------------------ args

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const FORCE = flag('--force');
const DRY = flag('--dry-run');
const PROCESS_ONLY = flag('--process-only');
const ONLY = opt('--only') ? new Set(opt('--only').split(',').map((s) => s.trim()).filter(Boolean)) : null;
const ONLY_VOICE = opt('--voice');

// ------------------------------------------------------------------ inputs

async function loadLines() {
  try {
    const mod = await import(pathToFileURL(VOICE_TS).href);
    return mod.ALL_LINES;
  } catch {
    // Older Node without type stripping: drop the type syntax this file uses and evaluate it.
    let src = readFileSync(VOICE_TS, 'utf8');
    src = src.replace(/^export type .*$/gm, '');
    src = src.replace(/:\s*(\[string, string\]\[\]|Record<string, string>|Line\[\]|Line|VoiceId|string)(?=\s*[,)=])/g, '');
    src = src.replace(/^export /gm, '');
    return new Function(`${src}\nreturn ALL_LINES;`)();
  }
}

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const VOICES = readJson(join(HERE, 'voices.json'));
const OVERRIDES = readJson(join(HERE, 'line-overrides.json'), {});

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const p = join(homedir(), '.keys', 'elevenlabs.key');
  if (!existsSync(p)) throw new Error('No ElevenLabs key: set ELEVENLABS_API_KEY or create ~/.keys/elevenlabs.key');
  return readFileSync(p, 'utf8').trim();
}

// A stable seed per line, so a rerun of the same text and settings gives the same take.
const seedFor = (id) => createHash('sha1').update(id).digest().readUInt32BE(0) % 4000000000;

function requestFor(line) {
  const v = VOICES[line.voice];
  if (!v) throw new Error(`voices.json has no entry for voice "${line.voice}"`);
  const o = OVERRIDES[line.id] || {};
  return {
    voiceId: v.voice_id,
    body: {
      text: o.text || line.text,
      model_id: MODEL,
      voice_settings: { ...v.settings, ...(o.settings || {}) },
      seed: o.seed ?? seedFor(line.id),
    },
  };
}

// ------------------------------------------------------------------ ElevenLabs

async function api(path, init = {}) {
  const res = await fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: { 'xi-api-key': apiKey(), ...(init.headers || {}) },
  });
  return res;
}

async function remainingCredits() {
  const res = await api('/v1/user/subscription');
  if (!res.ok) throw new Error(`subscription check failed: ${res.status} ${await res.text()}`);
  const s = await res.json();
  return { remaining: s.character_limit - s.character_count, used: s.character_count, limit: s.character_limit };
}

async function tts(line) {
  const { voiceId, body } = requestFor(line);
  for (let attempt = 1; ; attempt++) {
    const res = await api(`/v1/text-to-speech/${voiceId}?output_format=${FORMAT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      const cost = Number(res.headers.get('character-cost') || 0);
      return { buf, cost };
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      continue;
    }
    throw new Error(`TTS failed for ${line.id}: ${res.status} ${text.slice(0, 300)}`);
  }
}

// ------------------------------------------------------------------ audio helpers

function decode(path) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], {
    maxBuffer: 1 << 28,
  });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${path}: ${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

function encode(samples, path) {
  const input = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const r = spawnSync(
    FFMPEG,
    ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
      '-map_metadata', '-1', '-c:a', 'libmp3lame', '-b:a', '128k', path],
    { input, maxBuffer: 1 << 28 },
  );
  if (r.status !== 0) throw new Error(`ffmpeg encode failed for ${path}: ${r.stderr}`);
}

// Integrated loudness and true peak via ffmpeg's EBU R128 meter. Short clips are looped to at
// least 3 s first: the meter needs 400 ms blocks, and looping keeps the reading equal to the
// clip's own loudness instead of mixing in silence.
function loudness(samples) {
  const reps = Math.max(1, Math.ceil((3 * SR) / samples.length));
  const looped = new Float32Array(samples.length * reps);
  for (let i = 0; i < reps; i++) looped.set(samples, i * samples.length);
  const input = Buffer.from(looped.buffer);
  const r = spawnSync(
    FFMPEG,
    ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', 'pipe:0',
      '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { input, maxBuffer: 1 << 28 },
  );
  const err = r.stderr.toString();
  const summary = err.slice(err.lastIndexOf('Summary:'));
  const I = Number((summary.match(/I:\s+(-?[\d.]+|-inf) LUFS/) || [])[1]);
  const tpMatch = summary.match(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/);
  const TP = tpMatch ? Number(tpMatch[1]) : NaN;
  return { I, TP };
}

const db = (x) => 20 * Math.log10(x + 1e-9);

function frameDb(x) {
  const n = Math.floor(x.length / FRAME);
  const out = new Float64Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * FRAME; i < (f + 1) * FRAME; i++) s += x[i] * x[i];
    out[f] = db(Math.sqrt(s / FRAME));
  }
  return out;
}

// Zero-crossing rate over a sample range: breath noise crosses zero far more often than voiced
// sound (hums, vowels), which keeps "Mmm" and "Hmm" from being mistaken for breaths.
function zcr(x, a, b) {
  let c = 0;
  for (let i = a + 1; i < b; i++) if ((x[i] >= 0) !== (x[i - 1] >= 0)) c++;
  return c / Math.max(1, b - a);
}

// Sound islands: runs of frames above SILENCE_DB, joined across quiet gaps under 60 ms.
function islands(fdb) {
  const out = [];
  let cur = null;
  let quiet = 0;
  for (let f = 0; f < fdb.length; f++) {
    if (fdb[f] > SILENCE_DB) {
      if (cur && quiet < GAP_FRAMES) cur.end = f;
      else {
        cur = { start: f, end: f };
        out.push(cur);
      }
      quiet = 0;
    } else quiet++;
  }
  for (const s of out) {
    s.max = -200;
    for (let f = s.start; f <= s.end; f++) s.max = Math.max(s.max, fdb[f]);
    s.frames = s.end - s.start + 1;
  }
  return out;
}

const raisedCos = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function processClip(id, rawPath, outPath) {
  const x = decode(rawPath);
  // Judge levels as they will sound after leveling: raw takes arrive anywhere from about -30 to
  // -42 LUFS, so the -62 dB "silence" line is applied on the leveled scale, not the raw one.
  const raw = loudness(x);
  const offset = TARGET_LUFS - raw.I;
  const fdb = frameDb(x).map((v) => v + offset);
  const isl = islands(fdb);
  if (!isl.length) throw new Error(`${id}: no sound found`);
  const allIsl = isl.map((s) => ({ ...s }));
  const peak = Math.max(...isl.map((s) => s.max));
  const notes = [];
  const lastFrame = fdb.length - 1;
  // A breath is quiet (24 dB under the loudest frame), noisy (high zero-crossing rate, unlike a
  // hum) and, after the last word, at least 100 ms long so a final "t" or "p" release is kept.
  const isBreath = (s, minMs = 100) => {
    const z = zcr(x, s.start * FRAME, (s.end + 1) * FRAME);
    return s.frames * FRAME_MS >= minMs && s.max < peak - 24 && z > 0.08;
  };

  // A blip of 80 ms or less that never gets above -50 dB (30 dB under the target loudness), cut off
  // from the words by silence: too faint to be part of a word, but it would stretch the clip.
  const isFaint = (s) => s.frames * FRAME_MS <= 80 && s.max < TARGET_LUFS - 30;

  // Trailing junk: a burst cut off by the end of the file (the truncated inhale), or a breath.
  while (isl.length > 1) {
    const s = isl[isl.length - 1];
    const truncated = s.end >= lastFrame - 1 && s.frames * FRAME_MS <= 120;
    if (truncated) notes.push(`cut end burst ${s.frames * FRAME_MS}ms@${s.max.toFixed(0)}dB`);
    else if (isBreath(s)) notes.push(`cut end breath ${s.frames * FRAME_MS}ms@${s.max.toFixed(0)}dB`);
    else if (isFaint(s)) notes.push(`cut faint end blip ${s.frames * FRAME_MS}ms@${s.max.toFixed(0)}dB`);
    else break;
    isl.pop();
  }
  // A burst that follows a short silence can merge into the last island; if that island runs into
  // the end of the file, cut it at its last quiet run (20 ms or more) in the final 200 ms.
  let tailStop = x.length; // the tail may not run past a burst cut out of the last island
  {
    const s = isl[isl.length - 1];
    if (s.end >= lastFrame - 1) {
      // First look for a burst in the last 60 ms that jumps 12 dB or more above a quiet stretch.
      let m = lastFrame;
      for (let f = lastFrame; f > lastFrame - 12; f--) if (fdb[f] > fdb[m]) m = f;
      const before = Array.from(fdb.slice(Math.max(0, m - 20), Math.max(0, m - 6))).sort((a, b) => a - b);
      const base = before.length ? before[Math.floor(before.length / 2)] : 0;
      if (before.length && base < -45 && fdb[m] - base > 12) {
        let k = m;
        while (k > s.start && fdb[k - 1] > base + 3) k--;
        notes.push(`cut end burst ${(lastFrame - k + 1) * FRAME_MS}ms@${fdb[m].toFixed(0)}dB over ${base.toFixed(0)}dB`);
        s.end = k - 1;
        tailStop = k * FRAME;
      }
    }
    if (s.end >= lastFrame - 1) {
      let quiet = 0;
      for (let f = s.end; f > s.start && f >= lastFrame - 40; f--) {
        if (fdb[f] <= SILENCE_DB) quiet++;
        else if (quiet >= 4) {
          notes.push(`cut end burst after ${quiet * FRAME_MS}ms gap`);
          tailStop = (f + 1 + Math.floor(quiet / 2)) * FRAME;
          s.end = f;
          break;
        } else quiet = 0;
      }
    }
  }
  // Leading breath before the first word.
  while (isl.length > 1 && (isBreath(isl[0], 30) || isFaint(isl[0]))) {
    notes.push(`cut lead ${isFaint(isl[0]) ? 'blip' : 'breath'} ${isl[0].frames * FRAME_MS}ms@${isl[0].max.toFixed(0)}dB`);
    isl.shift();
  }

  const first = isl[0];
  const last = isl[isl.length - 1];
  const s0 = first.start * FRAME;
  // Keep TAIL_MS of decay, but never reach into a burst or breath that was cut off above.
  const dropped = allIsl.find((s) => s.start > last.end);
  const tailLimit = Math.min(tailStop, dropped ? dropped.start * FRAME - Math.round(0.01 * SR) : x.length);
  const e0 = Math.max((last.end + 1) * FRAME, Math.min(x.length, tailLimit, (last.end + 1) * FRAME + Math.round((TAIL_MS * SR) / 1000)));
  const lead = Math.round((LEAD_MS * SR) / 1000);
  const from = Math.max(0, s0 - lead);
  const pad = lead - (s0 - from); // add digital silence if the take started early
  const y = new Float32Array(pad + (e0 - from));
  y.set(x.subarray(from, e0), pad);

  // Duck breaths between words (quiet, noisy islands) instead of letting the level pass lift them.
  for (let k = 1; k < isl.length - 1; k++) {
    const s = isl[k];
    if (!isBreath(s) || s.frames * FRAME_MS > 800) continue;
    const a = s.start * FRAME - from + pad;
    const b = (s.end + 1) * FRAME - from + pad;
    const g = 10 ** (BREATH_DUCK_DB / 20);
    const w = Math.min(441, Math.floor((b - a) / 2));
    for (let i = a; i < b; i++) {
      const edge = Math.min(i - a, b - 1 - i);
      const t = edge < w ? raisedCos(edge / w) : 1;
      y[i] *= 1 - (1 - g) * t;
    }
    notes.push(`ducked breath at ${Math.round(((a - pad) * 1000) / SR)}ms`);
  }

  // Fades.
  const fi = Math.round((FADE_IN_MS * SR) / 1000);
  const fo = Math.round((FADE_OUT_MS * SR) / 1000);
  for (let i = 0; i < fi && i < y.length; i++) y[i] *= raisedCos(i / fi);
  for (let i = 0; i < fo && i < y.length; i++) y[y.length - 1 - i] *= raisedCos(i / fo);

  // One linear gain to the target loudness, held under the true-peak ceiling.
  const pre = loudness(y);
  let gain = Math.min(TARGET_LUFS - pre.I, MAX_TRUE_PEAK - TP_HEADROOM - pre.TP);
  // The mp3 shifts loudness and peaks a little, so measure the encoded file and correct.
  let check;
  let used;
  const encodeAt = (dB) => {
    const g = 10 ** (dB / 20);
    const z = new Float32Array(y.length);
    for (let i = 0; i < y.length; i++) z[i] = y[i] * g;
    encode(z, outPath);
    used = dB;
    return measure(outPath);
  };
  for (let attempt = 0; attempt < 5; attempt++) {
    check = encodeAt(gain);
    if (check.tp > MAX_TRUE_PEAK || check.maxAbs >= 0.999) {
      gain -= Math.max(0.2, check.tp - MAX_TRUE_PEAK + 0.1);
      continue;
    }
    const up = Math.min(TARGET_LUFS - check.lufs, MAX_TRUE_PEAK - 0.1 - check.tp);
    if (up > 0.15) {
      gain += up;
      continue;
    }
    break;
  }
  if (check.tp > MAX_TRUE_PEAK || check.maxAbs >= 0.999) check = encodeAt(used - 1);
  return { id, gain: +used.toFixed(2), rawLufs: raw.I, notes, ...check };
}

// Final-file checks: duration, edge levels, sample and true peak, loudness.
function measure(path) {
  const x = decode(path);
  const n50 = Math.round(0.05 * SR);
  const rms = (a, b) => {
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    return db(Math.sqrt(s / Math.max(1, b - a)));
  };
  const pk = (a, b) => {
    let m = 0;
    for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i]));
    return m;
  };
  let full = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) >= 0.999) full++;
  const { I, TP } = loudness(x);
  return {
    ms: Math.round((x.length * 1000) / SR),
    lufs: +I.toFixed(1),
    tp: +TP.toFixed(2),
    maxAbs: +pk(0, x.length).toFixed(4),
    fullScale: full,
    head50Rms: +rms(0, n50).toFixed(1),
    head50Peak: +db(pk(0, n50)).toFixed(1),
    tail50Rms: +rms(x.length - n50, x.length).toFixed(1),
    tail50Peak: +db(pk(x.length - n50, x.length)).toFixed(1),
  };
}

// ------------------------------------------------------------------ main

async function pool(items, n, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

async function main() {
  mkdirSync(RAW, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const lines = await loadLines();
  const ids = new Set(lines.map((l) => l.id));
  if (ONLY) for (const id of ONLY) if (!ids.has(id)) throw new Error(`--only: unknown line id "${id}"`);

  const selected = lines.filter((l) => (!ONLY || ONLY.has(l.id)) && (!ONLY_VOICE || l.voice === ONLY_VOICE));
  const todo = PROCESS_ONLY
    ? selected.filter((l) => existsSync(join(RAW, `${l.id}.mp3`)))
    : selected.filter((l) => FORCE || ONLY || !existsSync(join(OUT, `${l.id}.mp3`)));

  const chars = todo.reduce((a, l) => a + requestFor(l).body.text.length, 0);
  console.log(`${lines.length} lines; ${todo.length} to ${PROCESS_ONLY ? 'reprocess' : 'make'}` +
    (PROCESS_ONLY ? '' : ` (${chars} characters, about ${Math.round(chars * CREDITS_PER_CHAR)} credits)`));
  if (DRY) {
    for (const l of todo) console.log(`  ${l.id}  [${l.voice}]  ${requestFor(l).body.text}`);
    return;
  }

  let spent = 0;
  if (todo.length && !PROCESS_ONLY) {
    const before = await remainingCredits();
    console.log(`credits remaining before: ${before.remaining} of ${before.limit}`);
    if (before.remaining < MIN_CREDITS) {
      console.error(`Stopping: fewer than ${MIN_CREDITS} credits remain (other projects share this account).`);
      process.exit(2);
    }
  }

  const results = [];
  let done = 0;
  await pool(todo, PROCESS_ONLY ? 1 : CONCURRENCY, async (line) => {
    const rawPath = join(RAW, `${line.id}.mp3`);
    if (!PROCESS_ONLY) {
      const { buf, cost } = await tts(line);
      writeFileSync(rawPath, buf);
      spent += cost;
      appendFileSync(join(RAW, 'costs.log'), `${new Date().toISOString()}\t${line.id}\t${cost}\n`);
    }
    const r = processClip(line.id, rawPath, join(OUT, `${line.id}.mp3`));
    r.voice = line.voice;
    results.push(r);
    done++;
    console.log(`[${done}/${todo.length}] ${line.id.padEnd(22)} ${String(r.ms).padStart(5)}ms ` +
      `${r.lufs} LUFS  TP ${r.tp}  head ${r.head50Rms}dB tail ${r.tail50Rms}dB` +
      (r.notes.length ? `  (${r.notes.join('; ')})` : ''));
  });

  // Report for this run (merged into the running report in raw/).
  const reportPath = join(RAW, 'report.json');
  const report = readJson(reportPath, {});
  for (const r of results) report[r.id] = r;
  writeFileSync(reportPath, JSON.stringify(report, null, 1));

  // Manifest: every line that has a processed file, in ALL_LINES order.
  const old = readJson(MANIFEST, {});
  const manifest = {};
  for (const l of lines) {
    const p = join(OUT, `${l.id}.mp3`);
    if (!existsSync(p)) continue;
    const ms = report[l.id]?.ms ?? old[l.id]?.ms ?? measure(p).ms;
    manifest[l.id] = { voice: l.voice, ms };
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

  const missing = lines.filter((l) => !manifest[l.id]).map((l) => l.id);
  const orphans = readdirSync(OUT).filter((f) => f.endsWith('.mp3') && !ids.has(f.slice(0, -4)));
  console.log(`\nmanifest: ${Object.keys(manifest).length} clips` + (missing.length ? `, missing: ${missing.join(', ')}` : ''));
  if (orphans.length) console.log(`files with no line in voice.ts (not deleted): ${orphans.join(', ')}`);

  if (results.length) {
    const worst = (k, dir = 1) => results.reduce((a, r) => (dir * r[k] > dir * a[k] ? r : a));
    const tpLimited = results.filter((r) => r.lufs < TARGET_LUFS - 0.5);
    console.log(`checks: max true peak ${worst('tp').tp} dBTP (${worst('tp').id}), ` +
      `full-scale samples ${results.reduce((a, r) => a + r.fullScale, 0)}, ` +
      `loudest head ${worst('head50Rms').head50Rms} dB (${worst('head50Rms').id}), ` +
      `loudest tail ${worst('tail50Rms').tail50Rms} dB (${worst('tail50Rms').id})` +
      (tpLimited.length ? `, held below ${TARGET_LUFS} LUFS by the peak ceiling: ${tpLimited.map((r) => `${r.id} ${r.lufs}`).join(', ')}` : ''));
  }
  if (spent) {
    const after = await remainingCredits();
    console.log(`credits spent this run (character-cost headers): ${spent}; remaining after: ${after.remaining}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
