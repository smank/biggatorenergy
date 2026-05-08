// Prey and predator sprite data
const _ = null;

// Fly — 3x3, two wing frames
export const FLY_1 = [
  [_, '#888888', _],
  ['#888888', '#333333', '#888888'],
  [_, '#333333', _],
];

export const FLY_2 = [
  ['#888888', _, '#888888'],
  [_, '#333333', _],
  [_, '#333333', _],
];

// Small fish — 5x3
export const FISH_SMALL_1 = [
  [_, '#e8a030', '#e8a030', '#e8a030', _],
  ['#cc7020', '#f0c060', '#f0c060', '#222222', '#e8a030'],
  [_, '#e8c080', '#e8c080', '#e8c080', _],
];

export const FISH_SMALL_2 = [
  [_, '#e8a030', '#e8a030', '#e8a030', _],
  ['#cc7020', '#f0c060', '#f0c060', '#222222', '#e8a030'],
  [_, _, '#e8c080', '#e8c080', _],
];

// Frog — 5x4
export const FROG_1 = [
  [_, '#2a8a2a', _, '#2a8a2a', _],
  ['#2a8a2a', '#4ac04a', '#4ac04a', '#4ac04a', '#2a8a2a'],
  [_, '#6ad06a', '#4ac04a', '#6ad06a', _],
  [_, '#2a8a2a', _, '#2a8a2a', _],
];

export const FROG_2 = [
  [_, '#2a8a2a', _, '#2a8a2a', _],
  ['#2a8a2a', '#4ac04a', '#4ac04a', '#4ac04a', '#2a8a2a'],
  [_, '#6ad06a', '#4ac04a', '#6ad06a', _],
  ['#2a8a2a', _, _, _, '#2a8a2a'],
];

// Heron — 7x10 (predator, for later)
export const HERON_1 = [
  [_, _, _, '#dddddd', _, _, _],
  [_, _, '#dddddd', '#dddddd', _, _, _],
  [_, _, '#dddddd', '#dddddd', _, _, _],
  [_, '#dddddd', '#cccccc', '#dddddd', '#dddddd', _, _],
  [_, _, '#cccccc', '#dddddd', _, _, _],
  [_, _, _, '#aaaaaa', _, _, _],
  [_, _, _, '#aaaaaa', _, _, _],
  [_, _, _, '#aaaaaa', _, _, _],
  [_, _, '#aaaaaa', _, '#aaaaaa', _, _],
  [_, _, '#777777', _, '#777777', _, _],
];

// Dragonfly — 3x3, iridescent wings
export const DRAGONFLY_1 = [
  ['#8855cc', '#9966dd', '#8855cc'],
  ['#333333', '#2a2a2a', '#333333'],
  ['#55aacc', '#44aacc', '#55aacc'],
];

export const DRAGONFLY_2 = [
  [_, '#9966dd', _],
  ['#8855cc', '#2a2a2a', '#8855cc'],
  [_, '#44aacc', _],
];

// Otter — 5x3, brown with cream belly
export const OTTER_1 = [
  ['#6a4020', '#7a5030', '#7a5030', '#7a5030', '#5a3010'],
  ['#7a5030', '#c8a878', '#c8a878', '#7a5030', '#5a3010'],
  ['#5a3010', '#6a4020', '#6a4020', '#5a3010', _],
];

export const OTTER_2 = [
  ['#6a4020', '#7a5030', '#7a5030', '#7a5030', '#5a3010'],
  ['#7a5030', '#c8a878', '#c8a878', '#7a5030', '#5a3010'],
  [_, '#5a3010', '#5a3010', _, _],
];

// Bullfrog — 4x3, darker green
export const BULLFROG_1 = [
  ['#1a5a1a', '#2a7a2a', '#2a7a2a', '#1a5a1a'],
  ['#2a7a2a', '#3a9a3a', '#3a9a3a', '#2a7a2a'],
  ['#1a5a1a', '#2a7a2a', '#2a7a2a', '#1a5a1a'],
];

export const BULLFROG_2 = [
  ['#1a5a1a', '#2a7a2a', '#2a7a2a', '#1a5a1a'],
  ['#2a7a2a', '#3a9a3a', '#3a9a3a', '#2a7a2a'],
  ['#1a5a1a', _, _, '#1a5a1a'],
];

// Snapping Turtle — 5x3, spiked dark shell
export const SNAPPING_TURTLE_1 = [
  [_, '#3a3a1a', '#2a2a0a', '#3a3a1a', _],
  ['#2a2a0a', '#4a4a2a', '#5a5a3a', '#4a4a2a', '#2a2a0a'],
  ['#1a1a0a', '#3a3a1a', '#3a3a1a', '#3a3a1a', '#1a1a0a'],
];

// Bass — 5x3, green-gray
export const BASS_1 = [
  [_, '#5a7a4a', '#5a7a4a', '#5a7a4a', _],
  ['#4a6a3a', '#7a9a6a', '#7a9a6a', '#222222', '#5a7a4a'],
  [_, '#8aaa7a', '#8aaa7a', '#8aaa7a', _],
];

export const BASS_2 = [
  [_, '#5a7a4a', '#5a7a4a', '#5a7a4a', _],
  ['#4a6a3a', '#7a9a6a', '#7a9a6a', '#222222', '#5a7a4a'],
  [_, _, '#8aaa7a', '#8aaa7a', _],
];

// Gar — 8x2, dark gray primitive fish
export const GAR_1 = [
  ['#3a3a3a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#2a2a2a'],
  ['#2a2a2a', '#6a6a5a', '#6a6a5a', '#6a6a5a', '#6a6a5a', '#4a4a4a', '#3a3a3a', _],
];

export const GAR_2 = [
  ['#3a3a3a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#4a4a4a', '#2a2a2a'],
  [_, '#6a6a5a', '#6a6a5a', '#6a6a5a', '#6a6a5a', '#4a4a4a', '#3a3a3a', _],
];

// Invasive Python — 10x2, dark green/black
export const INVASIVE_PYTHON_1 = [
  ['#1a2a0a', '#2a3a0a', '#2a3a0a', '#1a2a0a', '#2a3a0a', '#2a3a0a', '#1a2a0a', '#2a3a0a', '#2a3a0a', '#1a1a0a'],
  ['#0a1a0a', '#3a4a1a', '#3a4a1a', '#0a1a0a', '#3a4a1a', '#3a4a1a', '#0a1a0a', '#3a4a1a', '#1a2a0a', _],
];

// Oil Slick Fish — 5x3, sickly greenish-yellow
export const OIL_SLICK_FISH_1 = [
  [_, '#7a8a2a', '#8a9a3a', '#7a8a2a', _],
  ['#6a7a1a', '#aaaa3a', '#aaaa3a', '#555500', '#7a8a2a'],
  [_, '#9a9a2a', '#9a9a2a', '#9a9a2a', _],
];

// Distant Cattle — 4x3, brown/black silhouette
export const DISTANT_CATTLE_1 = [
  [_, '#3a2a1a', '#3a2a1a', _],
  ['#3a2a1a', '#4a3a2a', '#4a3a2a', '#3a2a1a'],
  [_, '#2a1a0a', '#2a1a0a', _],
];
