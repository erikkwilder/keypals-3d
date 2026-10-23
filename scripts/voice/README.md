# Voice lines

> **2026-10-23:** the Keypal voices were pulled (they read as awkward); only the coach speaks. `generate.mjs` can still make the friend lines, but the game never plays them and their clips are not shipped.

Add the line to `src/lib/content/voice.ts` and run `node scripts/voice/generate.mjs`: it makes only the missing clips (into `public/voice/`), rewrites `src/lib/content/voice-manifest.json`, takes voices and settings from `voices.json`, and stops if the ElevenLabs account (key in `~/.keys/elevenlabs.key`) has under 20,000 credits left. To remake a clip run `node scripts/voice/generate.mjs --only <id>` (if the same bad take comes back, give that line a new `seed` or a respelled `text` in `line-overrides.json`), or `--force` to remake them all. Then run `node scripts/voice/check.mjs` to check levels and compare a transcript of each clip with its text.
