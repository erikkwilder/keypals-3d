// The Learn episodes rebuilt as beat lessons. Everything else plays in the classic episode (ui/Episode.svelte picks).
import type { BeatLesson, World } from './types';
import { CRATE_LESSON } from './crateLesson';

export const BEAT_LESSONS: BeatLesson<World>[] = [CRATE_LESSON as unknown as BeatLesson<World>];
export const BEAT_LESSON: Record<string, BeatLesson<World>> = Object.fromEntries(BEAT_LESSONS.map(l => [l.id, l]));
