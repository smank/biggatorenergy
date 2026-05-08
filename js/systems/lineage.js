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

// Compute layout coordinates for the hierarchical tree.
//
// Layout algorithm (top-down, per-generation):
//   Gen 0 (founders): place side by side, centered on origin.
//   Gen N+1: for each child, x = average of parent x coords. Then sort by x
//            and resolve collisions by nudging nodes apart until MIN_GAP is satisfied.
//
// Returns an object:
//   {
//     nodeLayout: Map<id, { x, y, cx, cy }>  — top-left + center coords in SVG space
//     svgWidth, svgHeight                     — total canvas size
//     generations: Array<Array<node>>          — same structure as buildTree output,
//                                               each row sorted by x
//   }
export function computeTreeLayout(tree, { nodeW = 90, nodeH = 70, colGap = 16, rowGap = 80 } = {}) {
  const MIN_GAP = nodeW + colGap; // minimum center-to-center distance
  const ROW_H = nodeH + rowGap;   // vertical stride between generation rows

  const nodeLayout = new Map(); // id -> { x, y, cx, cy }

  // Process each generation top-down
  for (let gi = 0; gi < tree.length; gi++) {
    const gen = tree[gi];
    const y = gi * ROW_H;

    if (gi === 0) {
      // Founders: lay out side-by-side centered at x=0
      const totalW = gen.length * nodeW + (gen.length - 1) * colGap;
      const startX = -totalW / 2;
      gen.forEach((node, idx) => {
        const x = startX + idx * MIN_GAP;
        nodeLayout.set(node.id, { x, y });
      });
    } else {
      // Assign x based on parent midpoints (fall back to spreading if no parents known)
      const positioned = [];
      for (const node of gen) {
        const { motherId, fatherId } = node.lineage || {};
        const motherLayout = motherId ? nodeLayout.get(motherId) : null;
        const fatherLayout = fatherId ? nodeLayout.get(fatherId) : null;

        let x;
        if (motherLayout && fatherLayout) {
          x = (motherLayout.x + fatherLayout.x) / 2;
        } else if (motherLayout) {
          x = motherLayout.x;
        } else if (fatherLayout) {
          x = fatherLayout.x;
        } else {
          // Orphan with unknown parents — place at center
          x = 0;
        }
        positioned.push({ node, x });
      }

      // Sort by x so siblings cluster naturally
      positioned.sort((a, b) => a.x - b.x);

      // Resolve collisions: scan left-to-right, push right if too close
      for (let i = 1; i < positioned.length; i++) {
        const prev = positioned[i - 1];
        const cur = positioned[i];
        if (cur.x - prev.x < MIN_GAP) {
          cur.x = prev.x + MIN_GAP;
        }
      }

      // Re-center the generation under its spread
      // (optional cosmetic pass — shift entire row so its centroid lines up
      // with the centroid of the parent positions it was derived from)
      const rowCentroid = positioned.reduce((s, p) => s + p.x, 0) / positioned.length;
      // Compute what the ideal centroid should be (avg of all unique parent x's)
      const parentXs = new Set();
      for (const { node } of positioned) {
        const { motherId, fatherId } = node.lineage || {};
        if (motherId && nodeLayout.has(motherId)) parentXs.add(nodeLayout.get(motherId).x);
        if (fatherId && nodeLayout.has(fatherId)) parentXs.add(nodeLayout.get(fatherId).x);
      }
      if (parentXs.size > 0) {
        const parentCentroid = Array.from(parentXs).reduce((s, x) => s + x, 0) / parentXs.size;
        const shift = parentCentroid - rowCentroid;
        for (const p of positioned) p.x += shift;
      }

      // Second collision pass after re-centering (shift may have created new overlaps)
      positioned.sort((a, b) => a.x - b.x);
      for (let i = 1; i < positioned.length; i++) {
        const prev = positioned[i - 1];
        const cur = positioned[i];
        if (cur.x - prev.x < MIN_GAP) {
          cur.x = prev.x + MIN_GAP;
        }
      }

      // Store layout
      for (const { node, x } of positioned) {
        nodeLayout.set(node.id, { x, y });
      }

      // Mutate gen array to match sorted order (so callers render in x-order)
      positioned.forEach(({ node }, idx) => { gen[idx] = node; });
    }
  }

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity;
  for (const { x } of nodeLayout.values()) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  if (!isFinite(minX)) { minX = 0; maxX = 0; }

  const PADDING = 40;
  const svgWidth = (maxX - minX) + nodeW + PADDING * 2;
  const svgHeight = tree.length * ROW_H - rowGap + nodeH + PADDING * 2;

  // Translate all coords so (minX, 0) maps to (PADDING, PADDING)
  const offsetX = -minX + PADDING;
  const offsetY = PADDING;

  for (const layout of nodeLayout.values()) {
    layout.x += offsetX;
    layout.y += offsetY;
    layout.cx = layout.x + nodeW / 2;
    layout.cy = layout.y + nodeH / 2;
  }

  return { nodeLayout, svgWidth, svgHeight, generations: tree, nodeW, nodeH };
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

// Designate a gator as the named heir. Clears isHeir on the previous heir (if any),
// sets isHeir = true on the new one, and records dynasty.heirGatorId.
// The caller is responsible for ensuring the gator is alive, non-egg, in bloodline,
// and not the current player.
export function setHeirGator(world, newHeirId, dynasty) {
  for (const [id, , gator] of world.query('transform', 'gator')) {
    const linId = gator.lineage?.dynastyId || gator.lineageId;
    if (linId !== dynasty.id) continue;
    gator.isHeir = (id === newHeirId);
  }
  dynasty.heirGatorId = newHeirId;
}

// Remove the designated heir without assigning a new one.
export function clearHeirGator(world, dynasty) {
  if (!dynasty.heirGatorId) return;
  for (const [id, , gator] of world.query('transform', 'gator')) {
    const linId = gator.lineage?.dynastyId || gator.lineageId;
    if (linId !== dynasty.id) continue;
    if (id === dynasty.heirGatorId) gator.isHeir = false;
  }
  dynasty.heirGatorId = null;
}
