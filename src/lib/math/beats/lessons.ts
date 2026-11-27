// The Learn episodes rebuilt as beat lessons. Everything else plays in the classic episode (ui/Episode.svelte picks).
import type { BeatLesson, World } from './types';
import { CRATE_LESSON } from './crateLesson';
import { COUNT_LESSON } from './countLesson';
import { SHARE_LESSON } from './shareLesson';
import { EQUATION_LESSON } from './equationLesson';
import { TEN_LESSON } from './tenLesson';
import { TEEN_LESSON } from './teenLesson';

export const BEAT_LESSONS: BeatLesson<World>[] = [CRATE_LESSON, COUNT_LESSON, SHARE_LESSON, EQUATION_LESSON, TEN_LESSON, TEEN_LESSON].map(l => l as unknown as BeatLesson<World>);
export const BEAT_LESSON: Record<string, BeatLesson<World>> = Object.fromEntries(BEAT_LESSONS.map(l => [l.id, l]));
