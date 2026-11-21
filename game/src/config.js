// config.js — every number that tunes "Wren, Shadow Courier": the garden's layout,
// the wardens' patrols, vision, hearing and the courier's speed. One file, so a
// balance change never means hunting through the game logic.

export const TILE = 40;
export const VIEW_WIDTH = 960;
// The canvas is taller than the garden: a 44 px bar above and a 28 px bar
// below hold the HUD, so no bar ever covers the garden's top or bottom row.
export const GARDEN_Y = 44;
export const VIEW_HEIGHT = 712;

// The garden, 24 columns by 16 rows. Legend:
//   # hedge (blocks movement and sight)   . lawn (walkable)
//   , path (walkable, drawn as stone)     B bush (walkable, hides the courier)
//   ~ fountain (blocks movement, not sight) K silver lantern key
//   P courier's start                     G garden gate (the exit)
export const LEVEL_MAP = [
  '########################',
  '#P....#......#....K....#',
  '#..B..#..##..#..####...#',
  '#.##..#......#..B...#..#',
  '#.#...####.###..#...#..#',
  '#.#.B......#....#.#....#',
  '#...#####..#.##.#.#.##.#',
  '#.B....#...#....#....#.#',
  '###.##.#.###.####.##.#.#',
  '#......#.....#....#..#.#',
  '#.####.###.#.###..#..#.#',
  '#.#....#...#.#....##.#.#',
  '#.#.##.#.B.#.#.##....#.#',
  '#...#..#...#...#.####..#',
  '#..K....#..~...#....K..#',
  '##########G#############',
];

export const LEVEL_COLS = 24;
export const LEVEL_ROWS = 16;

// Patrol routes: tile coordinates each warden walks between, pausing at each stop.
// Warden 1 sweeps the west lawns by the start, warden 2 the north hall,
// warden 3 the east beds, warden 4 the south court by the fountain.
export const GUARD_PATROLS = [
  { name: 'Bram', waypoints: [[5, 1], [5, 2], [2, 2], [2, 1]], pause: 1.2 },
  { name: 'Odile', waypoints: [[8, 1], [12, 1], [12, 3], [8, 3]], pause: 1.0 },
  { name: 'Fen', waypoints: [[21, 2], [22, 2], [22, 5], [21, 5]], pause: 1.4 },
  { name: 'Marlowe', waypoints: [[8, 11], [10, 11], [10, 13], [8, 13]], pause: 0.9 },
];

export const TUNING = {
  playerWalkSpeed: 132, // px per second
  playerRunSpeed: 205,
  playerSneakSpeed: 78,
  playerRadius: 12,
  guardWalkSpeed: 62,
  guardChaseSpeed: 148,
  guardRadius: 13,
  visionRange: 185, // px a warden can see
  visionHalfAngle: 0.62, // radians either side of facing (~71 degrees total)
  bushHideRange: 52, // a warden must be this close to spot a courier in a bush
  suspicionPerSecond: 1.15, // how fast being seen fills the meter (closer = faster)
  suspicionDecayPerSecond: 0.45,
  alertHoldSeconds: 4.5, // chase this long after losing sight
  noiseRunRadius: 150, // wardens inside this ring hear running feet
  noiseWalkRadius: 45,
  noisePebbleRadius: 190,
  catchDistance: 22,
  pebbles: 5,
  nerves: 3, // times the courier may be caught before the night ends
  keysNeeded: 3,
};

export const COLOURS = {
  night: '#0b1020',
  lawnDark: '#1d3323',
  lawnLight: '#23402a',
  path: '#46443a',
  hedge: '#123320',
  hedgeTop: '#256b31',
  bush: '#14351f',
  bushLeaf: '#2c6b35',
  water: '#1d4d6b',
  waterGlint: '#7fd4ff',
  keyGold: '#ffd76a',
  gate: '#c9a86a',
  playerCloak: '#7fb2ff',
  playerHood: '#dfe9ff',
  guardCoat: '#c65a4a',
  guardLantern: '#ffb347',
  coneCalm: 'rgba(255, 214, 120, 0.30)',
  coneSuspicious: 'rgba(255, 150, 60, 0.36)',
  coneAlert: 'rgba(255, 60, 50, 0.40)',
};
