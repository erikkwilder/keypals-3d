// Data and chance on the practice map: three islands at the Chance Fair, laid out like the other skill
// areas (skills/course.ts): a Meet lesson per new skill, practice, a mix, and a checkpoint run that can be
// taken first to test out, plus a Show What You Know for the whole area.
//   The Prize Tent (K-3): sorting and counting prizes, picture graphs, how likely, bar graphs.
//   Ribbon Row (4-6): line plots of ribbon lengths, the mean as a fair share, median, mode and range, and
//     dot plots, histograms and box plots.
//   Spinner Square (7): chance as a fraction, what should happen against what did, two things at once.
import type { MathMove } from '../course';
import type { RegionId } from '../../engine/course';
import type { SkillKind, SkillLesson, SkillRegion } from '../skills/course';

type Head = Omit<SkillRegion, 'lessons'>;
function region(r: Head, lessons: [string, SkillKind, string[], string[], number, MathMove, string][]): SkillRegion {
  return { ...r, lessons: lessons.map(([title, kind, skills, learn, goal, move, blurb], i) => ({ id: `${r.id}-${i + 1}`, region: r.id, area: r.area, n: i + 1, title, kind, skills, learn, goal, blurb, move, world: r.world })) };
}

export const TENT_SKILLS = ['da-sort', 'da-picgraph', 'da-likely', 'da-bars'];
export const RIBBON_SKILLS = ['da-lineplot', 'da-mean', 'da-middle', 'da-plots'];
export const SQUARE_SKILLS = ['da-chance', 'da-expect', 'da-both'];
const TENT: Head = { id: 'data-a', area: 'data', name: 'The Prize Tent', blurb: 'Sort and count the prizes, read picture graphs and bar graphs, and say how likely something is.', world: 'village' as RegionId, chip: 'Graphs', skills: TENT_SKILLS };
const RIBBON: Head = { id: 'data-b', area: 'data', name: 'Ribbon Row', blurb: 'Line plots of ribbon lengths, the mean as a fair share, the median, mode and range, and dot plots, histograms and box plots.', world: 'treetops' as RegionId, chip: 'Mean', skills: RIBBON_SKILLS };
const SQUARE: Head = { id: 'data-c', area: 'data', name: 'Spinner Square', blurb: 'Chance as a fraction, what should happen in an experiment, and two things at once.', world: 'shores' as RegionId, chip: '3/8', skills: SQUARE_SKILLS };

export const DATA_REGIONS: SkillRegion[] = [
  region(TENT, [
    ['Sort and Count', 'meet', ['da-sort'], ['da-sort'], 8, 'run', 'Put each kind in its own row, then count. The longest row has the most.'],
    ['Picture Graphs', 'meet', ['da-picgraph', 'da-sort'], ['da-picgraph'], 7, 'swim', 'Each picture is one prize. Look at the key: sometimes one picture stands for 2!'],
    ['How Likely?', 'meet', ['da-likely'], ['da-likely'], 7, 'climb', 'None can happen: impossible. All of them: certain. Half: an even chance.'],
    ['Bar Graphs', 'meet', ['da-bars', 'da-picgraph'], ['da-bars'], 6, 'slide', 'Run your finger from the top of the bar across to the numbers.'],
    ['Prize Tent Mix', 'mix', TENT_SKILLS, [], 6, 'run', 'Everything so far, all mixed up.'],
    ['Prize Tent Run', 'check', TENT_SKILLS, [], 7, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(RIBBON, [
    ['Line Plots', 'meet', ['da-lineplot'], ['da-lineplot'], 5, 'run', 'One dot for each ribbon, stacked over its length.'],
    ['Fair Share', 'meet', ['da-mean', 'da-lineplot'], ['da-mean'], 5, 'climb', 'The mean: add them all up, then share them out equally.'],
    ['The Middle One', 'meet', ['da-middle', 'da-mean'], ['da-middle'], 5, 'swim', 'Line them up. The median is the middle, the mode comes up most, the range is biggest take away smallest.'],
    ['Plots and Boxes', 'meet', ['da-plots', 'da-middle'], ['da-plots'], 5, 'slide', 'Dot plots, histograms and box plots: three ways to see lots of numbers at once.'],
    ['Ribbon Row Mix', 'mix', RIBBON_SKILLS, [], 5, 'run', 'Everything on this island, all mixed up.'],
    ['Ribbon Row Run', 'check', RIBBON_SKILLS, [], 5, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(SQUARE, [
    ['Chance', 'meet', ['da-chance', 'da-likely'], ['da-chance'], 5, 'run', 'The ways it can happen over all the ways there are: 3 red of 8 is 3/8.'],
    ['What Should Happen', 'meet', ['da-expect', 'da-chance'], ['da-expect'], 5, 'swim', 'Chance times tries: a 1/4 chance in 40 spins is about 10 times.'],
    ['Two at Once', 'meet', ['da-both', 'da-chance'], ['da-both'], 4, 'climb', 'Every first choice goes with every second: 3 hats and 4 tops make 12 outfits.'],
    ['Spinner Practice', 'practice', ['da-both', 'da-expect', 'da-chance'], [], 4, 'slide', 'The new ones again, with chance to help.'],
    ['Spinner Square Mix', 'mix', [...SQUARE_SKILLS, 'da-mean', 'da-plots'], [], 5, 'run', 'This island and the last, all mixed up.'],
    ['Spinner Square Run', 'check', SQUARE_SKILLS, [], 5, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];

export const DATA_PLACEMENT: SkillLesson = {
  id: 'start-data', region: 'start', area: 'data', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...TENT_SKILLS, ...RIBBON_SKILLS, ...SQUARE_SKILLS], learn: [], goal: 6, move: 'run', world: 'village' as RegionId,
  blurb: 'A quick mix of graphs, the mean and chance. Answer what you know and skip ahead!',
};

/** The Learn episode for each skill (math/data/episodes.ts): opened from its Meet lesson, results and practice. */
export const DATA_EPISODES: Record<string, string> = {
  'da-sort': 'data-sort', 'da-picgraph': 'data-bars', 'da-bars': 'data-bars', 'da-likely': 'data-chance', 'da-lineplot': 'data-lineplot',
  'da-mean': 'data-mean', 'da-middle': 'data-median', 'da-plots': 'data-median', 'da-chance': 'data-chance', 'da-expect': 'data-chance', 'da-both': 'data-both',
};
