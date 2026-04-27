// lineage.js — family tree construction and succession helpers
//
// Each gator now carries a lineage component:
//   gator.lineage = { motherId, fatherId, dynastyId }
// Founders have null motherId/fatherId.
// The flat gator.lineageId is kept in sync for backward compat.

// Build a generational tree from the living world + obituary records.
// Returns an array of arrays: [[gen0 nodes], [gen1 nodes], ...]
// Each node: { id, name, sex, generation, alive, lineage, gator? }
export function buildTree(world, obituaryEntries, dynastyId) {
  const nodes = new Map(); // id -> node

  // Collect living gators in the bloodline
  for (const [id, , gator] of world.query('transform', 'gator')) {
    const linId = gator.lineage?.dynastyId || gator.lineageId;
    if (linId !== dynastyId) continue;
    nodes.set(id, {
      id,
      name: gator.name || 'unnamed',
      sex: gator.sex || 'male',
      generation: gator.generation || 0,
      alive: true,
      lineage: gator.lineage || { motherId: null, fatherId: null, dynastyId },
      gator,
    });
  }

  // Collect dead gators from obituary (those with dynastyId)
  if (Array.isArray(obituaryEntries)) {
    for (const entry of obituaryEntries) {
      if (!entry || entry.dynastyId !== dynastyId) continue;
      if (nodes.has(entry.id)) continue; // alive takes priority
      nodes.set(entry.id, {
        id: entry.id,
        name: entry.name || 'unnamed',
        sex: entry.sex || 'unknown',
        generation: entry.generation || 0,
        alive: false,
        lineage: entry.lineage || { motherId: null, fatherId: null, dynastyId },
        obitEntry: entry,
      });
    }
  }

  if (nodes.size === 0) return [];

  // Group by generation
  const genMap = new Map();
  for (const node of nodes.values()) {
    const g = node.generation;
    if (!genMap.has(g)) genMap.set(g, []);
    genMap.get(g).push(node);
  }

  // Sort generations ascending
  const gens = Array.from(genMap.keys()).sort((a, b) => a - b);
  return gens.map(g => genMap.get(g));
}

// Return living bloodline members sorted by age descending (oldest first for succession)
export function getLivingSuccessors(world, dynastyId) {
  const candidates = [];
  for (const [id, , gator] of world.query('transform', 'gator')) {
    const linId = gator.lineage?.dynastyId || gator.lineageId;
    if (linId !== dynastyId) continue;
    if (gator.stage === 'egg') continue;
    candidates.push({ id, gator });
  }
  candidates.sort((a, b) => (b.gator.age || 0) - (a.gator.age || 0));
  return candidates;
}

// Mark a gator as the player-controlled one. Clears isPlayer on all others in the dynasty.
export function setPlayerGator(world, newPlayerId, dynasty) {
  for (const [id, , gator] of world.query('transform', 'gator')) {
    const linId = gator.lineage?.dynastyId || gator.lineageId;
    if (linId !== dynasty.id) continue;
    gator.isPlayer = (id === newPlayerId);
  }
  dynasty.playerGatorId = newPlayerId;
}
