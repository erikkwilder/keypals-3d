// Every Learn episode's id (math/episodes.ts epLesson plays each): the fact tricks and place value
// (learn.ts), fractions, shapes, ratios, data, negative numbers, money and the Star Lab.
import { epLesson } from './episodes';
import { LESSONS } from './learn';
import { FRAC_LESSONS } from './fracEpisodes';
import { SHAPE_LESSONS } from './shapes/episodes';
import { RATIO_LESSONS } from './ratioEpisodes';
import { DATA_LESSONS } from './data/episodes';
import { NEG_LESSONS } from './integers/episodes';
import { MARKET_LESSONS } from './market/episodes';
import { ALG_LESSONS } from './algebra/episodes';

export function episodeIds(): string[] {
  const ids = [...LESSONS, ...FRAC_LESSONS, ...SHAPE_LESSONS, ...RATIO_LESSONS, ...DATA_LESSONS, ...NEG_LESSONS, ...MARKET_LESSONS, ...ALG_LESSONS].map(l => l.id);
  return [...new Set(ids)].filter(id => !!epLesson(id));
}
