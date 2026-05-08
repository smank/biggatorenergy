// Lineage Points Shop — permanent upgrades purchased between dynasty runs.
// Unlock definitions live here; effect application helpers are exported for
// use in main.js at founder-roll and founding-pair-setup time.

const UNLOCKS_KEY = 'bge_unlocks';

export const UNLOCKS = [
  // --- TRAIT BOOSTS ---
  {
    id: 'big_founders',
    name: 'founders begin large',
    description: 'founding pair carries a size advantage into the swamp',
    cost: 15,
    category: 'traits',
  },
  {
    id: 'fertile_founders',
    name: 'founders begin fertile',
    description: 'the bloodline takes root faster',
    cost: 15,
    category: 'traits',
  },
  {
    id: 'swift_founders',
    name: 'swift founders',
    description: 'your founders begin slightly faster than average',
    cost: 15,
    category: 'traits',
  },
  {
    id: 'aggressive_founders',
    name: 'aggressive founders',
    description: 'founders arrive with an edge — higher aggression from day one',
    cost: 15,
    category: 'traits',
  },
  {
    id: 'slow_metabolism',
    name: 'slow metabolism',
    description: 'founders run lean — hunger drains a little slower at founding',
    cost: 20,
    category: 'traits',
  },
  {
    id: 'enduring_founders',
    name: 'enduring founders',
    description: 'the bloodline grows large — founders can reach exceptional size',
    cost: 25,
    category: 'traits',
  },

  // --- STARTING CONDITIONS ---
  {
    id: 'extra_rerolls',
    name: '+2 founding rerolls',
    description: 'two more chances to find the right pair',
    cost: 10,
    category: 'start',
  },
  {
    id: 'extra_rerolls_2',
    name: '+2 more rerolls',
    description: 'additional patience — two further chances stacked on the first',
    cost: 20,
    category: 'start',
  },
  {
    id: 'start_with_juvenile',
    name: 'start with a juvenile',
    description: 'a young bloodline member arrives with the founders — head start',
    cost: 40,
    category: 'start',
  },
  {
    id: 'start_with_kill_count',
    name: 'battle-hardened founders',
    description: 'founders arrive with five meals behind them — already grown',
    cost: 20,
    category: 'start',
  },
  {
    id: 'start_in_era_2',
    name: 'industrial origins',
    description: 'dynasty opens in the industrial era — primordial swamp skipped',
    cost: 75,
    category: 'start',
  },

  // --- COSMETICS ---
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
  {
    id: 'pearl_pool',
    name: 'pearl bloodline',
    description: '10% chance founders carry a pearl-white sheen — rare and striking',
    cost: 40,
    category: 'cosmetic',
  },
  {
    id: 'rusty_pool',
    name: 'rust-iron bloodline',
    description: '10% chance founders are rust-red, like old iron left in the shallows',
    cost: 35,
    category: 'cosmetic',
  },
  {
    id: 'mossy_pool',
    name: 'mossy bloodline',
    description: '10% chance founders wear the swamp — dark green, damp, covered in growth',
    cost: 25,
    category: 'cosmetic',
  },
  {
    id: 'striped_pool',
    name: 'striped bloodline',
    description: '5% chance founders carry ancient banding — bold dark and pale stripes',
    cost: 60,
    category: 'cosmetic',
  },

  // --- GAMEPLAY MODS ---
  {
    id: 'slow_hunger',
    name: 'slow hunger',
    description: "your gator's hunger drains 25% slower — a little more time in the sun",
    cost: 30,
    category: 'gameplay',
  },
  {
    id: 'fast_eggs',
    name: 'fast eggs',
    description: 'incubation shortened 25% — the clutch hatches before the rains',
    cost: 30,
    category: 'gameplay',
  },
  {
    id: 'larger_clutches',
    name: 'larger clutches',
    description: 'nests run deeper — average clutch size increases by one',
    cost: 40,
    category: 'gameplay',
  },
  {
    id: 'tougher_skin',
    name: 'tougher skin',
    description: 'your gator takes a beating — effective health ceiling raised 20%',
    cost: 35,
    category: 'gameplay',
  },
  {
    id: 'keen_senses',
    name: 'keen senses',
    description: 'your gator notices things farther out — inspect targets at greater range',
    cost: 20,
    category: 'gameplay',
  },

  // --- META ---
  {
    id: 'legacy_renown',
    name: 'legacy renown',
    description: 'first goal each new dynasty rewards double lineage points',
    cost: 50,
    category: 'meta',
  },
  {
    id: 'silent_swamp',
    name: 'silent swamp',
    description: 'a quieter ambient mix — half the swamp noise, full atmosphere',
    cost: 15,
    category: 'meta',
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
  if (owned.has('swift_founders')) {
    traits.speed = Math.min(1.6, traits.speed + 0.2);
  }
  if (owned.has('aggressive_founders')) {
    traits.aggression = Math.min(1.0, traits.aggression + 0.15);
  }
  if (owned.has('slow_metabolism')) {
    traits.metabolism = Math.max(0.3, traits.metabolism - 0.2);
  }
  if (owned.has('enduring_founders')) {
    traits.maxSize = Math.min(1.9, traits.maxSize + 0.3);
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

  // Pearl: light gray-blue, iridescent belly
  if (owned.has('pearl_pool') && rng.chance(0.10)) {
    return {
      darkColor:  '#b8c8d8',
      bodyColor:  '#d0e0ea',
      bellyColor: '#eaf4f8',
      scuteColor: '#a8b8cc',
    };
  }

  // Rusty: deep orange-brown with tan belly
  if (owned.has('rusty_pool') && rng.chance(0.10)) {
    return {
      darkColor:  '#5c2a0e',
      bodyColor:  '#8b4422',
      bellyColor: '#c47a3a',
      scuteColor: '#6e3418',
    };
  }

  // Mossy: dark forest green with damp moss patches
  // Alternate between two close variants for texture feel
  if (owned.has('mossy_pool') && rng.chance(0.10)) {
    const variant = rng.chance(0.5);
    return {
      darkColor:  variant ? '#1a2e10' : '#162808',
      bodyColor:  variant ? '#2e4a1a' : '#223814',
      bellyColor: '#4a6a2a',
      scuteColor: '#1e3612',
    };
  }

  // Striped: fake banding via contrasting dark/body/scute
  if (owned.has('striped_pool') && rng.chance(0.05)) {
    return {
      darkColor:  '#0a0a0a',
      bodyColor:  '#d4c890',
      bellyColor: '#e8dca8',
      scuteColor: '#080808',
    };
  }

  return null;
}

// Returns the effective max rerolls, adding +2 per reroll unlock owned.
export function getMaxRerolls(baseRerolls) {
  const owned = loadPurchasedUnlocks();
  let bonus = 0;
  if (owned.has('extra_rerolls'))   bonus += 2;
  if (owned.has('extra_rerolls_2')) bonus += 2;
  return baseRerolls + bonus;
}

// --- Gameplay-mod helpers ---

// Returns adjusted hunger drain rate (player gator). -25% if slow_hunger owned.
export function applyHungerRate(baseRate) {
  return isPurchased('slow_hunger') ? baseRate * 0.75 : baseRate;
}

// Returns adjusted egg incubation seconds. -25% if fast_eggs owned.
export function applyEggIncubationRate(baseSec) {
  return isPurchased('fast_eggs') ? baseSec * 0.75 : baseSec;
}

// Returns adjusted clutch size. +1 if larger_clutches owned.
export function applyClutchSize(baseSize) {
  return isPurchased('larger_clutches') ? baseSize + 1 : baseSize;
}

// Returns adjusted effective health max multiplier. +20% if tougher_skin owned.
export function applyHealthMultiplier(baseHp) {
  return isPurchased('tougher_skin') ? baseHp * 1.2 : baseHp;
}

// Returns adjusted hover/inspect hit radius. Wider if keen_senses owned.
export function applyHoverRadius(baseRadius) {
  return isPurchased('keen_senses') ? baseRadius * 1.75 : baseRadius;
}

// Returns true if start_in_era_2 is owned.
export function isStartInEra2() {
  return isPurchased('start_in_era_2');
}

// Returns meal count bonus for founders. 5 if start_with_kill_count owned.
export function getStartMealCount() {
  return isPurchased('start_with_kill_count') ? 5 : 0;
}

// Returns LP multiplier for a goal award.
// goalsCompletedCount is the length of state.completed AFTER the goal was pushed.
// 2x for the first goal completed (count === 1) if legacy_renown is owned.
export function getLegacyRenownMultiplier(goalsCompletedCount) {
  if (goalsCompletedCount === 1 && isPurchased('legacy_renown')) return 2;
  return 1;
}

// Returns true if silent_swamp is owned.
export function isSilentSwamp() {
  return isPurchased('silent_swamp');
}
