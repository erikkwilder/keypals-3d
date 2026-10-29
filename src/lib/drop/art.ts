// Where each ball Glimmer's round body sits in its painting (public/drop/<id>.webp): the centre and the
// radius as shares of the picture's width (ears, caps and tails stick out past it). Measured from the
// paintings by the largest circle inside each outline.
export const BALL_ART: Record<string, { cx: number; cy: number; r: number; aspect: number }> = {
  sproutbun: { cx: 0.541, cy: 0.6333, r: 0.3597, aspect: 1.0907 },
  puddlepup: { cx: 0.4932, cy: 0.4872, r: 0.3565, aspect: 0.91 },
  sunsnail: { cx: 0.5732, cy: 0.5891, r: 0.3924, aspect: 1.0303 },
  bubbleocto: { cx: 0.4521, cy: 0.4632, r: 0.4383, aspect: 0.9606 },
  mushmouse: { cx: 0.493, cy: 0.473, r: 0.4061, aspect: 0.9152 },
  popcornpuff: { cx: 0.4968, cy: 0.4789, r: 0.4194, aspect: 0.9458 },
  frostowl: { cx: 0.496, cy: 0.584, r: 0.3778, aspect: 0.9872 },
  cactuskit: { cx: 0.5013, cy: 0.5707, r: 0.4499, aspect: 1.0647 },
  stormlamb: { cx: 0.4852, cy: 0.5199, r: 0.4397, aspect: 0.9561 },
  cometcat: { cx: 0.547, cy: 0.5914, r: 0.3777, aspect: 0.9817 },
  phoenixchick: { cx: 0.5542, cy: 0.5952, r: 0.4258, aspect: 1.077 },
};
