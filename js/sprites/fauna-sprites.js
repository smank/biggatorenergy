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
