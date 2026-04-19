// Dynasty mode — named founders, bloodline tracking, extinction game-over.
// Terrarium mode is the original ambient sim; Dynasty adds stakes and progression.

export const MODE_TERRARIUM = 'terrarium';
export const MODE_DYNASTY = 'dynasty';

// Swamp-flavored name pools — a bit Faulkner, a bit Beasts of the Southern Wild.
const FIRST_NAMES_M = [
  'Gus', 'Boss', 'Tusk', 'Scales', 'Drake', 'Moss', 'Hank', 'Otis', 'Cypress',
  'Bayou', 'Rook', 'Mud', 'Jubal', 'Caliph', 'Thane', 'Hoot', 'Gator', 'Jed',
  'Ezra', 'Wade', 'Grit', 'Reuben', 'Cleat',
];
const FIRST_NAMES_F = [
  'Pearl', 'Mama', 'Delta', 'Vine', 'Ruby', 'Sable', 'Iris', 'Hazel', 'Willow',
  'Marsh', 'Cricket', 'Opal', 'Bramble', 'Loretta', 'Juno', 'Wren', 'Fen',
  'Odessa', 'Mossie', 'Clover', 'Sage',
];
const PREFIXES = ['Old', 'Big', 'One-Eye', 'Fat', 'Black', 'Silent', 'Crooked'];
const SUFFIXES = ['the Elder', 'the Long', 'of the Marsh', 'Longtooth', 'Ironhide'];

export function randomGatorName(rng, sex) {
  const pool = sex === 'female' ? FIRST_NAMES_F : FIRST_NAMES_M;
  const first = rng.pick(pool);
  // 20% chance of a prefix, 10% of a suffix — flavor without overdoing it.
  const prefix = rng.chance(0.2) ? rng.pick(PREFIXES) + ' ' : '';
  const suffix = rng.chance(0.1) ? ' ' + rng.pick(SUFFIXES) : '';
  return (prefix + first + suffix).slice(0, 24);
}

export function randomDynastyName(rng) {
  const roots = [
    'Gatorclaw', 'Blackwater', 'Mosshide', 'Cypress', 'Ironbone', 'Bayou',
    'Redtooth', 'Longshadow', 'Swamprot', 'Silverscale', 'Oakroot', 'Hollow',
  ];
  const suffixes = ['Line', 'Clan', 'House', 'Dynasty', 'Brood', 'Blood'];
  return rng.pick(roots) + ' ' + rng.pick(suffixes);
}

// A gator belongs to the bloodline if it has a lineageId matching the dynasty.
// Founders are marked explicitly; descendants inherit via breeding.
export function isBloodline(gator, dynastyId) {
  return gator && gator.lineageId === dynastyId;
}

export function countLivingBloodline(world, dynastyId) {
  let count = 0;
  for (const [, , gator] of world.query('transform', 'gator')) {
    if (gator.lineageId === dynastyId) count++;
  }
  return count;
}

export function findOldestBloodline(world, dynastyId) {
  let oldest = null;
  for (const [id, , gator] of world.query('transform', 'gator')) {
    if (gator.lineageId !== dynastyId) continue;
    if (!oldest || gator.age > oldest.age) oldest = { id, gator };
  }
  return oldest;
}

// Lineage points — a simple currency for future meta-unlocks. Persists
// across runs under a separate localStorage key so new dynasties start with
// your accumulated banking.
const LP_KEY = 'bge_lineage_points';

export function loadLineagePoints() {
  try {
    const raw = localStorage.getItem(LP_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch (e) { return 0; }
}

export function saveLineagePoints(points) {
  try { localStorage.setItem(LP_KEY, String(Math.max(0, Math.floor(points)))); } catch (e) {}
}
