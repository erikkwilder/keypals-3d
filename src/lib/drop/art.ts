// Where each jelly Glimmer's round body sits in its painting (fractions of the picture: centre, radius as a
// share of the width, height over width), its main colour, and its eyes and the skin above them for
// blinking. Measured from the art by the painting script (cut out, then the largest circle inside each outline and the darkest blobs on the face).

export type Eye = { x: number; y: number; rx: number; ry: number };
export const BALL_ART: Record<string, { cx: number; cy: number; r: number; aspect: number; color: string; lid?: string; eyes?: Eye[] }> = {
  sproutbun: {cx: 0.5657, cy: 0.5387, r: 0.4087, aspect: 1.0653, color: "#aeeb87", lid: "#b9f69e", eyes: [{x: 0.4216, y: 0.4425, rx: 0.0857, ry: 0.0684}, {x: 0.7263, y: 0.4581, rx: 0.082, ry: 0.0689}]},
  puddlepup: {cx: 0.5102, cy: 0.4231, r: 0.3807, aspect: 0.9014, color: "#3dbbfc", lid: "#5bc6fb", eyes: [{x: 0.3696, y: 0.39, rx: 0.0872, ry: 0.0742}, {x: 0.6714, y: 0.3369, rx: 0.0799, ry: 0.077}]},
  sunsnail: {cx: 0.5651, cy: 0.5508, r: 0.4156, aspect: 1.0881, color: "#fc920f", lid: "#fcb11c", eyes: [{x: 0.4026, y: 0.4915, rx: 0.0975, ry: 0.0773}, {x: 0.7172, y: 0.4894, rx: 0.0984, ry: 0.0786}]},
  bubbleocto: {cx: 0.5049, cy: 0.4936, r: 0.4124, aspect: 0.8373, color: "#fa83da", lid: "#f488ea", eyes: [{x: 0.3532, y: 0.4597, rx: 0.1067, ry: 0.0898}, {x: 0.6711, y: 0.4216, rx: 0.0956, ry: 0.0933}]},
  mushmouse: {cx: 0.4911, cy: 0.5724, r: 0.3897, aspect: 0.9141, color: "#fbbd7e", lid: "#f5c385", eyes: [{x: 0.345, y: 0.5318, rx: 0.0809, ry: 0.0689}, {x: 0.6485, y: 0.5181, rx: 0.0805, ry: 0.0702}]},
  popcornpuff: {cx: 0.5458, cy: 0.5449, r: 0.4327, aspect: 1.0996, color: "#fccc1b", lid: "#fce034", eyes: [{x: 0.3959, y: 0.4766, rx: 0.1147, ry: 0.1022}, {x: 0.7264, y: 0.4638, rx: 0.1089, ry: 0.0969}]},
  frostowl: {cx: 0.5433, cy: 0.5563, r: 0.4298, aspect: 1.0606, color: "#b1d4fa", lid: "#c2e1fa", eyes: [{x: 0.3893, y: 0.469, rx: 0.1077, ry: 0.0878}, {x: 0.717, y: 0.4696, rx: 0.1042, ry: 0.0852}]},
  cactuskit: {cx: 0.5476, cy: 0.5139, r: 0.4293, aspect: 1.0432, color: "#a2c914", lid: "#abdc25", eyes: [{x: 0.3842, y: 0.4771, rx: 0.1155, ry: 0.0926}, {x: 0.7216, y: 0.4662, rx: 0.1102, ry: 0.0979}]},
  stormlamb: {cx: 0.4992, cy: 0.5872, r: 0.3756, aspect: 0.9136, color: "#d09afb", lid: "#cda7fa", eyes: [{x: 0.3787, y: 0.5275, rx: 0.078, ry: 0.0716}, {x: 0.6665, y: 0.5305, rx: 0.0784, ry: 0.0678}]},
  cometcat: {cx: 0.4984, cy: 0.4871, r: 0.4087, aspect: 0.9266, color: "#22357e"},
  phoenixchick: {cx: 0.4975, cy: 0.5942, r: 0.4804, aspect: 1.1882, color: "#fd7e06", lid: "#fd5708", eyes: [{x: 0.3052, y: 0.5633, rx: 0.1114, ry: 0.1058}, {x: 0.6981, y: 0.5608, rx: 0.1094, ry: 0.1048}]},
};
