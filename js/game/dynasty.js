// Dynasty mode — named founders, bloodline tracking, extinction game-over.
// Terrarium mode is the original ambient sim; Dynasty adds stakes and progression.

export const MODE_TERRARIUM = 'terrarium';
export const MODE_DYNASTY = 'dynasty';

// --- ERA SYSTEM ---
// Each era lasts 480 real seconds (8 min) of dynasty play time.
// Generation milestones also bump the era forward as a bonus.

export const ERAS = [
  { id: 1, key: 'primordial', name: 'primordial', durationSeconds: 480 },
  { id: 2, key: 'industrial', name: 'industrial', durationSeconds: 480 },
  // future eras added here
];

// Poetic flavor text shown at the moment of era transition — observed, not announced
export const ERA_FLAVOR = {
  2: 'smokestacks rise on the horizon. the herons remain.',
  // future: 3: '...'
};

// Which era ids each wildlife type is valid in.
// All unlisted types default to all eras.
// nutria gets a 3x weight boost in industrial — handled in the spawner.
export const WILDLIFE_VALID_ERAS = {
  turtle:         [1, 2],
  snake:          [1, 2],
  bird:           [1, 2],
  butterfly:      [1, 2],
  raccoon:        [1, 2],
  opossum:        [1, 2],
  heron_bg:       [1, 2],
  nutria:         [1, 2],
  crawfish:       [1, 2],
  mosquito_swarm: [1, 2],
  egret:          [1, 2],
  armadillo:      [1, 2],
  rabbit:         [1, 2],
  deer:           [1, 2],
  water_moccasin: [1, 2],
  pelican:        [1, 2],
  osprey:         [1, 2],
  wild_boar:      [1, 2],
  panther:        [1, 2],
  coyote:         [1, 2],
  beaver:         [1, 2],
  jeep:           [2],      // industrial only — vehicles don't exist in primordial
  airboat:        [2],      // industrial only
};

// Generation milestones that grant a bonus era advance (each fires only once)
const ERA_GEN_MILESTONES = [10, 25, 50];

// Initialise era fields on a dynasty object (idempotent — safe to call on load)
export function initEraDynasty(dynasty) {
  if (dynasty.era === undefined) dynasty.era = 1;
  if (dynasty.eraClock === undefined) dynasty.eraClock = 0;
  if (!Array.isArray(dynasty.gensBonusReached)) dynasty.gensBonusReached = [];
}

export function getCurrentEra(dynasty) {
  return ERAS.find(e => e.id === (dynasty.era || 1)) || ERAS[0];
}

// Attempt to advance era by 1. Returns { advanced, newEra }.
// callbacks: { onAdvance({ era, dynasty }), onLineagePointBonus(amount) }
export function advanceEra(dynasty, rng, callbacks) {
  const currentIdx = ERAS.findIndex(e => e.id === dynasty.era);
  const nextEra = ERAS[currentIdx + 1];
  if (!nextEra) return { advanced: false, newEra: null }; // already at max era

  dynasty.era = nextEra.id;
  dynasty.eraClock = 0;

  // Award lineage points for reaching a new era
  const lpBonus = 50 * nextEra.id;
  callbacks?.onLineagePointBonus?.(lpBonus);
  callbacks?.onAdvance?.({ era: nextEra, dynasty });

  return { advanced: true, newEra: nextEra };
}

// Called every frame in dynasty mode. Ticks eraClock, checks for milestone
// and clock-driven era advances.
// dt: frame delta (seconds)
// generationCount: maxGeneration from main.js
// rng: game RNG instance
// callbacks: { onAdvance({ era, dynasty }), onLineagePointBonus(amount) }
export function updateEraClock(dynasty, dt, generationCount, rng, callbacks) {
  initEraDynasty(dynasty);

  dynasty.eraClock += dt;

  // Check generation milestones — each fires once
  for (const milestone of ERA_GEN_MILESTONES) {
    if (generationCount >= milestone && !dynasty.gensBonusReached.includes(milestone)) {
      dynasty.gensBonusReached.push(milestone);
      const { advanced } = advanceEra(dynasty, rng, callbacks);
      if (advanced) return; // one advance per frame is enough
    }
  }

  // Check time-based advance
  const currentEra = getCurrentEra(dynasty);
  if (dynasty.eraClock >= currentEra.durationSeconds) {
    dynasty.eraClock -= currentEra.durationSeconds;
    advanceEra(dynasty, rng, callbacks);
  }
}

// Renders the era name + progress bar in the top-right area of the dynasty HUD.
// Should be called after the dynasty name/gen text has already been drawn.
export function renderEraHUD(ctx, dynasty, drawPixelText, CANVAS_W, CANVAS_H) {
  if (!dynasty) return;
  initEraDynasty(dynasty);

  const era = getCurrentEra(dynasty);
  const label = `era:${era.name}`;

  // Position: below dynasty bloodline line (which is at y=9), just right of center
  const x = CANVAS_W - label.length * 4 - 2;
  const y = 15;

  ctx.fillStyle = '#4a7a4a';
  drawPixelText(ctx, label, x, y);

  // Progress bar: 40px wide, 2px tall, just below the label
  const barW = 40;
  const barX = CANVAS_W - barW - 2;
  const barY = y + 7;
  const progress = Math.min(1, dynasty.eraClock / era.durationSeconds);
  const fillW = Math.floor(barW * progress);

  // Background track
  ctx.fillStyle = '#2a3a2a';
  ctx.fillRect(barX, barY, barW, 2);
  // Fill
  ctx.fillStyle = '#5a9a5a';
  if (fillW > 0) ctx.fillRect(barX, barY, fillW, 2);
}

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
