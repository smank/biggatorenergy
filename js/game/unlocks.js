// Lineage Points Shop — permanent upgrades purchased between dynasty runs.
// Unlock definitions live here; effect application helpers are exported for
// use in main.js at founder-roll and founding-pair-setup time.

const UNLOCKS_KEY = 'bge_unlocks';

export const UNLOCKS = [
  {
    id: 'extra_rerolls',
    name: '+2 founding rerolls',
    description: 'two more chances to find the right pair',
    cost: 10,
    category: 'founding',
  },
  {
    id: 'big_founders',
    name: 'founders begin large',
    description: 'founding pair carries a size advantage into the swamp',
    cost: 15,
    category: 'founding',
  },
  {
    id: 'fertile_founders',
    name: 'founders begin fertile',
    description: 'the bloodline takes root faster',
    cost: 15,
    category: 'founding',
  },
  {
    id: 'albino_pool',
    name: 'albino bloodline',
    description: '10% chance founders roll cream-white — light carries through generations',
    cost: 50,
    category: 'cosmetic',
  },
  {
    id: 'coal_pool',
    name: 'coal-black bloodline',
    description: '10% chance founders roll coal-black — dark as swamp bottom',
    cost: 30,
    category: 'cosmetic',
  },
];

// --- Persistence ---

export function loadPurchasedUnlocks() {
  try {
    const raw = localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch (e) { return new Set(); }
}

export function savePurchasedUnlocks(set) {
  try {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify([...set]));
  } catch (e) {}
}

export function isPurchased(id) {
  return loadPurchasedUnlocks().has(id);
}

// purchase(id, currentPoints) -> { ok, newPoints, error? }
// Validates ownership + funds, deducts, persists, returns new balance.
export function purchase(id, currentPoints) {
  const unlock = UNLOCKS.find(u => u.id === id);
  if (!unlock) return { ok: false, newPoints: currentPoints, error: 'unknown unlock' };

  const owned = loadPurchasedUnlocks();
  if (owned.has(id)) return { ok: false, newPoints: currentPoints, error: 'already owned' };
  if (currentPoints < unlock.cost) return { ok: false, newPoints: currentPoints, error: 'not enough' };

  owned.add(id);
  savePurchasedUnlocks(owned);
  return { ok: true, newPoints: currentPoints - unlock.cost };
}

// --- Effect helpers (called from main.js) ---

// Mutate traits object in-place according to purchased unlocks.
// Called after rollFounderCandidate() builds the raw traits object.
export function applyUnlocksToFounderRoll(traits) {
  const owned = loadPurchasedUnlocks();

  if (owned.has('big_founders')) {
    traits.maxSize = Math.min(1.6, traits.maxSize + 0.2);
  }
  if (owned.has('fertile_founders')) {
    traits.fertility = Math.min(0.95, traits.fertility + 0.15);
  }

  return traits;
}

// Returns a color-override object if a cosmetic unlock fires, or null.
// Called after rollFounderCandidate() — if non-null, replace the color fields.
export function applyUnlocksToFounderColors(rng) {
  const owned = loadPurchasedUnlocks();

  // Albino: cream-white with pink tinge
  if (owned.has('albino_pool') && rng.chance(0.10)) {
    return {
      darkColor:  '#d4c0b8',
      bodyColor:  '#eaddd6',
      bellyColor: '#f5ece8',
      scuteColor: '#c8b8b0',
    };
  }

  // Coal-black: very dark gray-black
  if (owned.has('coal_pool') && rng.chance(0.10)) {
    return {
      darkColor:  '#141414',
      bodyColor:  '#222222',
      bellyColor: '#3a3a3a',
      scuteColor: '#1a1a1a',
    };
  }

  return null;
}

// Returns the effective max rerolls, adding +2 if extra_rerolls is owned.
export function getMaxRerolls(baseRerolls) {
  return isPurchased('extra_rerolls') ? baseRerolls + 2 : baseRerolls;
}
