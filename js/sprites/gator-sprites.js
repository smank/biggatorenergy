// Gator sprite data — caricature alligator
// Side view, faces RIGHT (renderer flips horizontally when direction === -1).
// Tail tapers to the left, body in the middle, head + snout on the right.
// Eye sits raised on top of the skull. Nostril at the snout tip.
const _ = null;
const D = '#2a4a1e'; // dark outline
const B = '#3a6a28'; // body — rich dark green
const V = '#8a9a5a'; // belly — warm yellowish
const E = '#eedd33'; // eye — big and bright
const P = '#553300'; // pupil — dark
const M = '#994444'; // mouth interior
const T = '#ddddbb'; // teeth
const S = '#2e5a22'; // scute/ridges
const N = '#1a3a12'; // nostril
const L = '#305020'; // legs

// --- STAGE 0: EGG (5x4) ---
const EGG = [
  [_, '#e0d4b0', '#e8dcc0', '#e0d4b0', _],
  ['#d4c8a0', '#f5ecd5', '#f0e8d0', '#f5ecd5', '#d4c8a0'],
  ['#d4c8a0', '#ede0c8', '#e8dcc0', '#ede0c8', '#d4c8a0'],
  [_, '#c8b890', '#d4c8a0', '#c8b890', _],
];

// --- STAGE 1: HATCHLING (10x5) ---
// Cute baby — short body, big head, raised eye, tiny snout
const HATCHLING_IDLE = [
  [_, _, _, S, S, S, _, _, _, _],
  [_, _, D, B, B, B, D, E, P, _],
  [_, D, B, B, B, B, B, B, D, N],
  [_, _, D, V, V, V, V, V, D, _],
  [_, _, _, L, _, _, L, _, _, _],
];

const HATCHLING_BLINK = [
  [_, _, _, S, S, S, _, _, _, _],
  [_, _, D, B, B, B, D, D, D, _],
  [_, D, B, B, B, B, B, B, D, N],
  [_, _, D, V, V, V, V, V, D, _],
  [_, _, _, L, _, _, L, _, _, _],
];

const HATCHLING_EAT = [
  [_, _, _, S, S, S, _, _, _, _],
  [_, _, D, B, B, B, D, E, P, _],
  [_, D, B, B, B, B, D, T, T, N],
  [_, _, D, V, V, V, D, M, T, _],
  [_, _, _, L, _, _, L, _, _, _],
];

// --- STAGE 2: JUVENILE (16x7) ---
// Lengthening out — clear head/body/tail proportions
const JUVENILE_IDLE = [
  [_, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, D, S, D, S, D, S, D, E, E, _, _],
  [_, _, _, D, D, B, B, B, B, B, B, B, E, P, D, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, D, D, _],
  [_, _, _, D, _, L, L, _, _, L, L, _, _, L, _, _],
];

const JUVENILE_BLINK = [
  [_, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, D, S, D, S, D, S, D, D, D, _, _],
  [_, _, _, D, D, B, B, B, B, B, B, B, D, D, D, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, D, D, _],
  [_, _, _, D, _, L, L, _, _, L, L, _, _, L, _, _],
];

const JUVENILE_EAT = [
  [_, _, _, _, _, _, _, S, S, S, S, _, _, _, _, _],
  [_, _, _, _, _, D, S, D, S, D, S, D, E, E, _, _],
  [_, _, _, D, D, B, B, B, B, B, B, B, E, P, D, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, D, T, T, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, D, M, M, _],
  [_, D, V, V, V, V, V, V, V, V, V, D, D, T, T, _],
  [_, _, _, D, _, L, L, _, _, L, L, _, _, D, D, _],
];

// --- STAGE 3: ADULT (24x9) ---
// Heavy body, defined snout + jaw line, raised eye dome, tapering tail
const ADULT_IDLE = [
  [_, _, _, _, _, _, _, _, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, _, E, E, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, D, E, P, D, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, D, _, _],
  [_, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, D, D, D, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ADULT_BLINK = [
  [_, _, _, _, _, _, _, _, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, _, D, D, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, D, D, D, D, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, D, _, _],
  [_, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, D, D, D, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Big chomp — upper and lower jaws separated by a 1px mouth gap
const ADULT_EAT = [
  [_, _, _, _, _, _, _, _, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, _, E, E, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, D, E, P, D, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, D, T, T, T, D, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, M, M, M, M, D, _],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, M, M, M, D, _, _],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, T, T, T, D, _, _],
  [_, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, D, D, D, D, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Swimming — legs tucked, body trails a darker waterline shadow
const ADULT_SWIM = [
  [_, _, _, _, _, _, _, _, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, _, E, E, _, _, _, _, _],
  [_, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, D, E, P, D, _, _, _, _],
  [_, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _],
  [_, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [D, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, N],
  [_, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// --- STAGE 4: ELDER (28x10) — biggest, longest snout, full row of scutes
const ELDER_IDLE = [
  [_, _, _, _, _, _, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, S, _, _, E, E, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, B, D, D, E, P, D, _, _, _, _, _],
  [_, _, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _],
  [_, _, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N],
  [D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, _],
  [_, _, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, D, _, _],
  [_, _, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, L, L, _, _, D, D, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_BLINK = [
  [_, _, _, _, _, _, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, S, _, _, D, D, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, B, D, D, D, D, D, _, _, _, _, _],
  [_, _, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _],
  [_, _, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N],
  [D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, _],
  [_, _, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, D, _, _],
  [_, _, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, L, L, _, _, D, D, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_EAT = [
  [_, _, _, _, _, _, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, S, _, _, E, E, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, B, D, D, E, P, D, _, _, _, _, _],
  [_, _, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, T, T, T, D, _],
  [_, _, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, M, M, M, D, _],
  [D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, M, M, D, _, _],
  [_, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, M, M, D, _, _],
  [_, _, D, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, V, D, T, T, D, _, _],
  [_, _, _, D, D, _, L, L, _, _, L, L, _, _, L, L, _, _, L, L, _, D, D, D, D, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

const ELDER_SWIM = [
  [_, _, _, _, _, _, _, _, _, S, S, S, S, S, S, S, S, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, D, S, D, S, D, S, D, S, D, S, _, _, E, E, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, D, B, B, B, B, B, B, B, B, B, B, D, D, E, P, D, _, _, _, _, _],
  [_, _, _, _, D, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, _, _, _],
  [_, _, D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, D, N],
  [D, D, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, B, D, N],
  [_, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, D, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
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
