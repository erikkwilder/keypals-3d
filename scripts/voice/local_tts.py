#!/usr/bin/env python3
"""Local text-to-speech for Keypals voice lines (no ElevenLabs, no network after setup).

    python3 scripts/voice/local_tts.py --in jobs.json --out DIR [--steps 32] [--force]
    python3 scripts/voice/local_tts.py --list

jobs.json is [{"id": "...", "text": "...", "voice": "<name>"}, ...]. Optional per-job keys:
"seed" (int, OmniVoice voices: a new seed gives a new take of a bad line) and "speed" (float).
Writes DIR/<id>.wav: raw 24 kHz mono 16-bit, not trimmed or leveled (generate.mjs does that).
OmniVoice output only gets a 60 Hz high-pass to remove a DC/rumble drift (see OmniEngine.synth).
Existing files are skipped unless --force.

Two engines, each loaded once per run, only if a job needs it:
  kokoro    Kokoro-82M v1.0 (kokoro-onnx 0.6.1, fp16 ONNX re-export from model-files-v1.1).
            Stock voices; deterministic; ~4-5x real time on the M4 CPU.
  omnivoice k2-fsa OmniVoice (mlx-community/OmniVoice-8bit, dequantized to bf16 at load) on MLX.
            Voices here were DESIGNED from text attributes (no real person), then one take of
            each was kept in refs/ and every line is cloned from it, so a voice stays the same
            across hundreds of lines. ~0.7-0.9x real time at 32 steps (~1.6-1.8x at --steps 16).

Setup (already done on the Mac Mini; 1.7 GB under ~/.cache/keypals-voice):
  uv venv --python /opt/homebrew/bin/python3 ~/.cache/keypals-voice/venv
  uv pip install --python ~/.cache/keypals-voice/venv/bin/python mlx-audio==0.6.3 kokoro-onnx==0.6.1 soundfile
  kokoro/:    kokoro-v1.0.fp16.onnx (github thewh1teagle/kokoro-onnx release model-files-v1.1) + voices-v1.0.bin
  omnivoice/: hf mlx-community/OmniVoice-8bit, with audio_tokenizer/model.safetensors taken from
              mlx-community/OmniVoice-bf16 (403 MB instead of the 806 MB fp32 copy)
Run with any python3: the script re-launches itself inside that venv.
"""

import os
import sys

VENV_PY = os.path.expanduser("~/.cache/keypals-voice/venv/bin/python")
if os.path.exists(VENV_PY) and os.path.realpath(sys.prefix) != os.path.realpath(os.path.dirname(os.path.dirname(VENV_PY))):
    os.execv(VENV_PY, [VENV_PY, os.path.abspath(__file__), *sys.argv[1:]])

import argparse
import json
import resource
import time
import warnings
from fractions import Fraction
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
CACHE = Path(os.path.expanduser("~/.cache/keypals-voice"))
SR = 24000

# Reference sentences the designed voices said (must match the ref clip word for word).
REF_COACH = ("Hello there, friend! Today we're going to count, add, and look at the numbers "
             "together. Take your time. Are you ready? Let's begin.")
REF_KID = ("Hmm, let me think about it. Six plus three? I'll count it out on my fingers. "
           "Six, seven, eight, nine. So it's nine! That was fun.")

# ---- voice table -------------------------------------------------------------------------
VOICES = {
    # Coach (recommended): designed warm alto teacher. Closest local match to what Matilda was
    # picked for: alto pitch (170-205 Hz vs Matilda's 193-218) with lots of pitch movement.
    "coach": {"engine": "omnivoice", "ref": "refs/coach.wav", "ref_text": REF_COACH,
              "design": "instruct 'female, middle-aged', seed 14"},
    # Coach runners-up
    "coach-omni": {"engine": "omnivoice", "ref": "refs/coach-omni.wav", "ref_text": REF_COACH,
                   "design": "instruct 'female, young adult', seed 14 (brighter, 213-242 Hz)"},
    "coach-sarah": {"engine": "kokoro", "voice": "af_sarah", "speed": 0.95},  # most pitch movement of the Kokoro voices
    "coach-heart": {"engine": "kokoro", "voice": "af_heart", "speed": 0.95},  # Kokoro's top-graded voice, steadier/flatter
    "coach-bella": {"engine": "kokoro", "voice": "af_bella", "speed": 0.95},
    # Buddies (designed child voices, cloned from one kept take each)
    "kid-a": {"engine": "omnivoice", "ref": "refs/kid-a.wav", "ref_text": REF_KID,
              "design": "instruct 'male, child, high pitch', seed 21 (calm boy, ~260-290 Hz)"},
    "kid-b": {"engine": "omnivoice", "ref": "refs/kid-b.wav", "ref_text": REF_KID,
              "design": "instruct 'female, child, moderate pitch', seed 13 (girl, ~340-380 Hz)"},
    "kid-c": {"engine": "omnivoice", "ref": "refs/kid-c.wav", "ref_text": REF_KID,
              "design": "instruct 'male, child', seed 21 (brighter boy, ~305-350 Hz)"},
    # Kokoro fallback buddy: blended adult voices, faster, with a gentle resample pitch lift.
    # Reads as a young woman more than a child (~205-215 Hz); fast and fully deterministic.
    "kid-d": {"engine": "kokoro", "voice": {"af_jessica": 0.5, "af_sky": 0.5}, "speed": 1.05, "lift": 1.12},
}
DEFAULT_SEED = 7  # OmniVoice: same text + voice + seed -> same take

# Words an engine says wrong -> respelling applied before synthesis (whole-word, case-sensitive).
RESPELL = {
    "kokoro": {},
    "omnivoice": {},
}


def respell(text, engine):
    import re
    for a, b in RESPELL.get(engine, {}).items():
        text = re.sub(rf"\b{re.escape(a)}\b", b, text)
    return text


# ---- Kokoro ------------------------------------------------------------------------------
class KokoroEngine:
    def __init__(self):
        from kokoro_onnx import Kokoro
        d = CACHE / "kokoro"
        self.k = Kokoro(str(d / "kokoro-v1.0.fp16.onnx"), str(d / "voices-v1.0.bin"))

    def synth(self, text, v, job):
        voice = v["voice"]
        if isinstance(voice, dict):
            voice = sum(w * self.k.get_voice_style(n) for n, w in voice.items())
        lift = v.get("lift", 1.0)
        speed = float(job.get("speed", v.get("speed", 1.0)))
        a, sr = self.k.create(text, voice=voice, speed=speed / lift, lang="en-us")
        a = np.asarray(a, dtype=np.float32)
        if lift != 1.0:  # play back faster = higher pitch and formants, tempo restored by speed/lift
            from scipy.signal import resample_poly
            f = Fraction(1 / lift).limit_denominator(200)
            a = resample_poly(a, f.numerator, f.denominator).astype(np.float32)
        assert sr == SR
        return a


# ---- OmniVoice ---------------------------------------------------------------------------
class OmniEngine:
    def __init__(self, steps):
        import mlx.core as mx
        from mlx_audio.tts.models.omnivoice.omnivoice import Model, OmniVoiceConfig
        self.mx, self.steps, self.refs = mx, steps, {}
        mx.set_cache_limit(512 * 1024 * 1024)  # varied line lengths otherwise grow MLX's buffer cache to ~10 GB
        path = CACHE / "omnivoice"
        model = Model(OmniVoiceConfig.from_dict(json.load(open(path / "config.json"))))
        raw = mx.load(str(path / "model.safetensors"))
        w = {}
        for k, val in raw.items():  # 'omnivoice-rowwise' int8: weight[out, groups, 64] * scales[out, groups]
            if k.endswith(".scales"):
                continue
            if f"{k}.scales" in raw:
                val = (val.astype(mx.float32) * raw[f"{k}.scales"].astype(mx.float32)[..., None]).reshape(val.shape[0], -1)
            if val.dtype in (mx.float32, mx.float16):
                val = val.astype(mx.bfloat16)
            w[k] = val
        model.load_weights(list(model.sanitize(w).items()), strict=True)
        mx.eval(model.parameters())
        model.eval()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            Model.post_load_hook(model, path)
        self.model = model

    def ref_tokens(self, v):
        key = v["ref"]
        if key not in self.refs:
            from mlx_audio.tts.models.omnivoice.utils import create_voice_clone_prompt
            with np.errstate(all="ignore"):
                self.refs[key] = create_voice_clone_prompt(str(HERE / v["ref"]), tokenizer=self.model.audio_tokenizer,
                                                           ref_text=v["ref_text"])
        return self.refs[key]

    def synth(self, text, v, job):
        from mlx_audio.tts.models.omnivoice.duration import RuleDurationEstimator
        rt = self.ref_tokens(v)
        speed = float(job.get("speed", v.get("speed", 1.0)))
        # Length from the reference voice's own pace (as upstream OmniVoice does), +6% room for pauses.
        n = RuleDurationEstimator().estimate_duration(text, v["ref_text"], rt.shape[0])
        n = max(12, int(n * 1.06 / speed))
        # The Higgs decoder leaves a DC offset / sub-20 Hz drift (up to -13 dB under the peak) that
        # hides the silence at the edges and breaks trimming. A zero-phase 60 Hz high-pass removes
        # it and nothing audible (the lowest designed voice sits near 200 Hz).
        from scipy.signal import butter, sosfiltfilt
        db = lambda x: 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-9)
        for attempt in range(3):
            self.mx.random.seed(int(job.get("seed", DEFAULT_SEED)))
            r = next(self.model.generate(text=text, language="en", ref_tokens=rt, ref_text=v["ref_text"],
                                         duration_s=n / 25.0, num_steps=self.steps))
            a = np.array(r.audio, dtype=np.float64)
            a = sosfiltfilt(butter(4, 60, "highpass", fs=SR, output="sos"), a)
            # The model speaks for exactly the time it's given: when the estimate is short, the last
            # word is still sounding at the very end (cut off). Then give it more time and say it again.
            if db(a[-int(0.06 * SR):]) < db(a) - 20 or attempt == 2:
                break
            n = int(n * 1.15) + 6
        return a.astype(np.float32)


# ---- main --------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--in", dest="inp", help="jobs.json")
    ap.add_argument("--out", help="output directory")
    ap.add_argument("--steps", type=int, default=32, help="OmniVoice unmasking steps (16 = ~2x faster)")
    ap.add_argument("--force", action="store_true", help="remake files that already exist")
    ap.add_argument("--list", action="store_true", help="print the voice table and exit")
    a = ap.parse_args()
    if a.list:
        for k, v in VOICES.items():
            print(f"{k:16s} {v['engine']:10s} {v.get('voice') or v.get('design')}")
        return
    if not a.inp or not a.out:
        ap.error("--in and --out are required")
    jobs = json.load(open(a.inp))
    bad = [j for j in jobs if j.get("voice") not in VOICES]
    if bad:
        sys.exit(f"unknown voice(s): {sorted({j.get('voice') for j in bad})}; known: {', '.join(VOICES)}")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    todo = [j for j in jobs if a.force or not (out / f"{j['id']}.wav").exists()]
    print(f"{len(jobs)} jobs, {len(jobs) - len(todo)} already done, {len(todo)} to make", flush=True)
    # group by engine then voice so each model loads once and each reference is encoded once
    todo.sort(key=lambda j: (VOICES[j["voice"]]["engine"], j["voice"]))
    engines, t_load, t_syn, secs = {}, 0.0, 0.0, 0.0
    for i, j in enumerate(todo, 1):
        v = VOICES[j["voice"]]
        e = v["engine"]
        if e not in engines:
            t = time.time()
            engines[e] = KokoroEngine() if e == "kokoro" else OmniEngine(a.steps)
            t_load += time.time() - t
            print(f"loaded {e} in {time.time() - t:.1f}s", flush=True)
        t = time.time()
        audio = engines[e].synth(respell(j["text"], e), v, j)
        dt = time.time() - t
        t_syn += dt
        secs += len(audio) / SR
        sf.write(out / f"{j['id']}.wav", audio, SR, subtype="PCM_16")
        print(f"[{i}/{len(todo)}] {j['id']} ({j['voice']}) {len(audio) / SR:.1f}s audio in {dt:.1f}s", flush=True)
    if todo:
        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1e9  # bytes on macOS
        mlx_peak = ""
        if "omnivoice" in engines:
            mlx_peak = f", MLX peak {engines['omnivoice'].mx.get_peak_memory() / 1e9:.2f} GB"
        print(f"done: {secs:.1f}s of audio in {t_syn:.1f}s synth ({secs / max(t_syn, 1e-9):.2f}x real time), "
              f"{t_load:.1f}s loading; peak RSS {peak:.2f} GB{mlx_peak}", flush=True)


if __name__ == "__main__":
    main()
