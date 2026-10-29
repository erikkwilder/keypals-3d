// Where each map stop sits on the painted maps, in percent of the picture: the wide map (desktop) and
// the tall one (phones). Placed by eye along the stone paths.
export const SPOTS: Record<'wide' | 'tall', Record<string, [number, number]>> = {
  wide: {
    'meadow-0': [10.7, 66.0], 'meadow-1': [17.1, 62.2], 'meadow-2': [22.9, 57.7], 'meadow-3': [16.4, 52.0], 'meadow-4': [22.6, 49.6], 'meadow-5': [28.6, 52.9],
    'treetops-0': [43.6, 50.8], 'treetops-1': [49.3, 48.0], 'treetops-2': [54.6, 44.7], 'treetops-3': [50.4, 40.4], 'treetops-4': [59.3, 38.1], 'treetops-5': [62.9, 44.4],
    'bay-0': [73.9, 43.8], 'bay-1': [77.9, 40.9], 'bay-2': [82.1, 38.1], 'bay-3': [88.2, 41.9], 'bay-4': [85.4, 32.4], 'bay-5': [90.1, 24.7],
    // Fraction Falls (its own pictures, map-falls-*.webp): the round stone platforms, the pie shop to the top
    'falls-0': [19.1, 69.4], 'falls-1': [33.9, 57.4], 'falls-2': [49.4, 48.0], 'falls-3': [64.4, 38.9], 'falls-4': [79.1, 31.1], 'falls-5': [86.3, 14.4],
    // Market Isle (map-market-*.webp): the round stone platforms, from the fruit stalls to the golden hall
    'market-0': [19.0, 68.5], 'market-1': [34.8, 58.6], 'market-2': [47.5, 42.5], 'market-3': [64.2, 37.5], 'market-4': [79.3, 31.0], 'market-5': [87.0, 15.8],
  },
  tall: {
    'meadow-0': [46.1, 85.0], 'meadow-1': [56.3, 78.2], 'meadow-2': [47.2, 72.1], 'meadow-3': [55.2, 66.4], 'meadow-4': [67.5, 63.3], 'meadow-5': [48.8, 57.5],
    'treetops-0': [53.1, 49.3], 'treetops-1': [53.6, 42.9], 'treetops-2': [69.7, 41.8], 'treetops-3': [52.5, 36.4], 'treetops-4': [35.4, 38.6], 'treetops-5': [50.4, 31.4],
    'bay-0': [58.4, 21.4], 'bay-1': [63.2, 15.4], 'bay-2': [51.4, 13.6], 'bay-3': [83.6, 16.1], 'bay-4': [69.7, 10.0], 'bay-5': [75.6, 6.1],
    'falls-0': [43.6, 78.6], 'falls-1': [61.3, 59.9], 'falls-2': [47.9, 43.1], 'falls-3': [72.8, 31.9], 'falls-4': [53.7, 23.3], 'falls-5': [71.3, 11.1],
    'market-0': [45.0, 87.5], 'market-1': [59.3, 72.0], 'market-2': [55.3, 53.2], 'market-3': [68.7, 33.2], 'market-4': [55.5, 18.2], 'market-5': [71.0, 6.4],
  },
};
