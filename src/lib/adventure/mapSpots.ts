// Where each map stop sits on the painted maps, in percent of the picture: the wide map (desktop) and
// the tall one (phones). Placed by eye along the stone paths.
export const SPOTS: Record<'wide' | 'tall', Record<string, [number, number]>> = {
  wide: {
    'meadow-0': [10.7, 66.0], 'meadow-1': [17.1, 62.2], 'meadow-2': [22.9, 57.7], 'meadow-3': [16.4, 52.0], 'meadow-4': [22.6, 49.6], 'meadow-5': [28.6, 52.9],
    'treetops-0': [43.6, 50.8], 'treetops-1': [49.3, 48.0], 'treetops-2': [54.6, 44.7], 'treetops-3': [50.4, 40.4], 'treetops-4': [59.3, 38.1], 'treetops-5': [62.9, 44.4],
    'bay-0': [73.9, 43.8], 'bay-1': [77.9, 40.9], 'bay-2': [82.1, 38.1], 'bay-3': [88.2, 41.9], 'bay-4': [85.4, 32.4], 'bay-5': [90.1, 24.7],
  },
  tall: {
    'meadow-0': [46.1, 85.0], 'meadow-1': [56.3, 78.2], 'meadow-2': [47.2, 72.1], 'meadow-3': [55.2, 66.4], 'meadow-4': [67.5, 63.3], 'meadow-5': [48.8, 57.5],
    'treetops-0': [53.1, 49.3], 'treetops-1': [53.6, 42.9], 'treetops-2': [69.7, 41.8], 'treetops-3': [52.5, 36.4], 'treetops-4': [35.4, 38.6], 'treetops-5': [50.4, 31.4],
    'bay-0': [58.4, 21.4], 'bay-1': [63.2, 15.4], 'bay-2': [51.4, 13.6], 'bay-3': [83.6, 16.1], 'bay-4': [69.7, 10.0], 'bay-5': [75.6, 6.1],
  },
};
