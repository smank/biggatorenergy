// Gator sprite data — American alligator
// Dark olive/charcoal body, broad flat snout, armored ridged back, thick tail
// Stubby splayed legs, yellow-green eye, lighter belly
const _ = null;
const D = '#2a3a1e'; // dark olive outline
const B = '#3a5a28'; // body — dark olive-green
const V = '#7a8a5a'; // belly — muted yellowish
const E = '#cccc44'; // eye — yellowish-green
const P = '#665500'; // pupil — dark
const M = '#884444'; // mouth interior — dark pink
const T = '#ccccaa'; // teeth — off-white
const S = '#2e4a22'; // scute/ridges — slightly darker than body
const N = '#1a2a12'; // nostril — very dark
const L = '#3a4a2a'; // legs — slightly different from body

// --- STAGE 0: EGG (5x4) ---
const EGG = [
  [_, '#e0d4b0', '#e8dcc0', '#e0d4b0', _],
  ['#d4c8a0', '#f5ecd5', '#f0e8d0', '#f5ecd5', '#d4c8a0'],
  ['#d4c8a0', '#ede0c8', '#e8dcc0', '#ede0c8', '#d4c8a0'],
  [_, '#c8b890', '#d4c8a0', '#c8b890', _],
];

// --- STAGE 1: HATCHLING (10x5) ---
// Babies have yellow striping — distinctive juvenile pattern
const Y = '#8a8a3a'; // yellow stripe accent
const HATCHLING_IDLE = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, Y, E, P, N, _],
  [_, D, B, B, B, B, B, B, D, D],
  [_, _, V, V, V, V, V, _, _, _],
  [_, _, L, _, _, L, _, _, _, _],
];

const HATCHLING_BLINK = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, Y, D, D, N, _],
  [_, D, B, B, B, B, B, B, D, D],
  [_, _, V, V, V, V, V, _, _, _],
  [_, _, L, _, _, L, _, _, _, _],
];

const HATCHLING_EAT = [
  [_, _, _, _, S, S, _, _, _, _],
  [_, _, D, D, B, Y, E, P, T, _],
  [_, D, B, B, B, B, B, M, M, D],
  [_, _, V, V, V, V, V, T, _, _],
  [_, _, L, _, _, L, _, _, _, _],
];

// --- STAGE 2: JUVENILE (16x7) ---
const JUVENILE_IDLE = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, E, P, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, D, D, D, D, N, _],
  [_, D, V, V, V, V, V, V, V, V, V, D, D, N, _, _],
  [_, _, _, L, _, _, L, _, _, L, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const JUVENILE_BLINK = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, D, D, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, D, D, D, D, N, _],
  [_, D, V, V, V, V, V, V, V, V, V, D, D, N, _, _],
  [_, _, _, L, _, _, L, _, _, L, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const JUVENILE_EAT = [
  [_, _, _, _, _, _, S, S, S, _, _, _, _, _, _, _],
  [_, _, _, _, D, S, B, B, B, S, _, _, _, _, _, _],
  [_, _, _, D, B, B, B, B, B, B, E, P, D, T, T, _],
  [D, D, D, B, B, B, B, B, B, B, D, D, M, M, M, D],
  [_, D, V, V, V, V, V, V, V, V, V, D, D, T, T, _],
  [_, _, _, L, _, _, L, _, _, L, _, _, _, _, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// --- STAGE 3: ADULT (24x9) ---
// Broad flat snout with visible overbite, armored back, thick powerful tail
// Eye sits raised above the skull line (like real gators floating with eyes above water)
const ADULT_IDLE = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, E, P, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, D, D, N, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, _, _, _, _, D, D, D, D, D, D],
  [_, _, _, L, _, _, _, L, _, _, _, L, _, _, _, _, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_BLINK = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, D, D, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, D, D, N, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, _, _, _, _, D, D, D, D, D, D],
  [_, _, _, L, _, _, _, L, _, _, _, L, _, _, _, _, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Eating: broad jaws open wide — upper jaw tilts up, lower drops, gap between
const ADULT_EAT = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, E, P, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, D, T, T, T, _, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, _, _, _, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, _, _, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, D, T, T, T, _, _, _, _, _, _, _],
  [_, _, _, L, _, _, _, L, _, _, _, L, _, D, D, D, D, N, _, D, D, D, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_SWIM = [
  [_, _, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, S, D, S, D, S, E, P, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _],
  [_, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _, _, _, _],
  [D, D, D, D, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _],
  [_, D, D, D, V, V, V, V, V, V, V, V, V, V, D, D, N, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, D, D, D, D, D, D, D, D, _, _, _, _, D, D, D, D, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// --- STAGE 4: ELDER (28x10) --- massive, scarred, darkened with age
const ELDER_IDLE = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, E, P, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, D, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, _, _, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, _, D, D, D, D, D, D, D],
  [_, _, _, L, _, _, _, _, L, _, _, _, L, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_BLINK = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, D, D, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, D, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, _, _, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, V, V, B, _, _, _, _, D, D, D, D, D, D, D],
  [_, _, _, L, _, _, _, _, L, _, _, _, L, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_EAT = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, E, P, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, D, T, T, T, _, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, _, _, _, _, _, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, D, T, T, T, _, _, _, _, _, _, _, _],
  [_, _, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, D, D, D, N, _, D, D, D, D, D, D],
  [_, _, _, L, _, _, _, _, L, _, _, _, L, _, _, _, _, _, _, _, D, D, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_SWIM = [
  [_, _, _, _, _, _, _, _, _, _, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, S, D, S, D, S, D, E, P, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, B, B, B, B, B, B, B, D, D, D, D, N, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, D, D, B, B, B, B, B, B, B, B, B, B, D, D, D, _, _, _, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _],
  [D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N, _, _, _, _, _, _, _, _],
  [_, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, V, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, D, D, D, D, D, D, D],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
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
    idle: ELDER_IDLE, blink: ELDER_BLINK, eat: ELDER_EAT, swim: ELDER_SWIM,
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
