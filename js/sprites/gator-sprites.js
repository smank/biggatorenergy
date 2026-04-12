// Gator sprite data — more realistic alligator proportions
// Low slung body, long snout, ridged back, powerful tail
const _ = null;
const D = '#2d5a1e'; // dark outline/ridges
const B = '#4a8c2a'; // body
const V = '#8bc34a'; // belly / lighter underside
const E = '#ffff00'; // eye
const P = '#cc9900'; // pupil
const M = '#cc4444'; // mouth interior
const T = '#e8e8d0'; // teeth
const S = '#3a6b2e'; // scute (back ridges)
const N = '#1e4a14'; // nostril/dark detail

// --- STAGE 0: EGG (5x4) ---
const EGG = [
  [_, '#e0d4b0', '#e8dcc0', '#e0d4b0', _],
  ['#d4c8a0', '#f5ecd5', '#f0e8d0', '#f5ecd5', '#d4c8a0'],
  ['#d4c8a0', '#ede0c8', '#e8dcc0', '#ede0c8', '#d4c8a0'],
  [_, '#c8b890', '#d4c8a0', '#c8b890', _],
];

// --- STAGE 1: HATCHLING (10x5) — tiny baby gator ---
const HATCHLING_IDLE = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, B, E, P, D, _],
  [_, D, B, B, B, B, B, B, N, D],
  [_, _, V, V, V, V, V, _, _, _],
  [_, _, V, _, _, V, _, _, _, _],
];

const HATCHLING_BLINK = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, B, D, D, D, _],
  [_, D, B, B, B, B, B, B, N, D],
  [_, _, V, V, V, V, V, _, _, _],
  [_, _, V, _, _, V, _, _, _, _],
];

const HATCHLING_EAT = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, B, E, P, T, _],
  [_, D, B, B, B, B, B, M, M, D],
  [_, _, V, V, V, V, V, T, _, _],
  [_, _, V, _, _, V, _, _, _, _],
];

// --- STAGE 2: JUVENILE (16x7) — developing ridges, longer snout ---
const JUVENILE_IDLE = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, E, P, D, D, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _],
  [_, D, V, V, V, V, V, V, V, V, V, V, B, D, _, _],
  [_, _, _, V, _, _, V, _, _, V, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const JUVENILE_BLINK = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, D, D, D, D, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _],
  [_, D, V, V, V, V, V, V, V, V, V, V, B, D, _, _],
  [_, _, _, V, _, _, V, _, _, V, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const JUVENILE_EAT = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, E, P, D, T, T, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, M, M, M, D],
  [_, D, V, V, V, V, V, V, V, V, V, V, D, T, T, _],
  [_, _, _, V, _, _, V, _, _, V, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// --- STAGE 3: ADULT (24x9) — full gator, armored back, long snout, thick tail ---
const ADULT_IDLE = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, E, P, D, D, _, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, B, D, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, D, D, D, D, D, D],
  [_, _, _, V, _, _, _, V, _, _, _, V, _, _, _, _, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_BLINK = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, D, D, D, D, _, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, B, D, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, D, D, D, D, D, D],
  [_, _, _, V, _, _, _, V, _, _, _, V, _, _, _, _, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_EAT = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, E, P, D, T, T, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, M, M, M, D, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, M, M, M, D, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, D, T, T, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, D, D, D, D, D, D],
  [_, _, _, V, _, _, _, V, _, _, _, V, _, _, _, _, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_SWIM = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, E, P, D, D, _, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _],
  [_, D, D, D, V, V, V, V, V, V, V, V, V, V, V, V, B, D, _, _, _, _, _, _],
  [_, _, _, D, D, D, D, D, D, D, D, D, D, D, D, _, _, _, D, D, D, D, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// --- STAGE 4: ELDER (28x10) — scarred, massive, faded ---
const ELDER_IDLE = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, E, P, D, D, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, D, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, D, D, D, D, D, D, D, D],
  [_, _, _, V, _, _, _, _, V, _, _, _, V, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_BLINK = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, D, D, D, D, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, N, D, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, D, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, D, D, D, D, D, D, D, D],
  [_, _, _, V, _, _, _, _, V, _, _, _, V, _, _, _, _, _, _, D, D, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Export all stages
export const GATOR_STAGES = {
  egg: { idle: EGG, width: 5, height: 4 },
  hatchling: {
    idle: HATCHLING_IDLE, blink: HATCHLING_BLINK, eat: HATCHLING_EAT,
    width: 10, height: 5,
  },
  juvenile: {
    idle: JUVENILE_IDLE, blink: JUVENILE_BLINK, eat: JUVENILE_EAT,
    width: 16, height: 7,
  },
  adult: {
    idle: ADULT_IDLE, blink: ADULT_BLINK, eat: ADULT_EAT, swim: ADULT_SWIM,
    width: 24, height: 9,
  },
  elder: {
    idle: ELDER_IDLE, blink: ELDER_BLINK,
    width: 28, height: 10,
  },
};

// Color keys used in sprites that should be tinted per-gator
export const TINT_COLORS = {
  body: B,
  belly: V,
  dark: D,
  scute: S,
};
