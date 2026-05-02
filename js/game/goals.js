// Dynasty Goals / Objectives System
// One active goal is shown in the HUD as a one-line objective.
// Completions fire a notable moment and award lineage points.

// ctx = { player, dynasty, world, simTime, era }
// player = gator component (may be null if player gator is dead)

const GOAL_STORAGE_PREFIX = 'bge_goals_';

// --- Goal definitions ---
// isActive(ctx): whether this goal applies right now
// isComplete(ctx): whether the condition is met
const GOAL_DEFS = [
  {
    id: 'feed',
    text: 'you are hungry. find food.',
    // weight is dynamic — computed in activeGoal() below
    weight: 10, // base; scaled by hunger in activeGoal
    oneTime: false,
    isActive(ctx) {
      return !!(ctx.player && ctx.player.hunger > 0.45);
    },
    isComplete(ctx, state) {
      // complete when hunger drops below 0.3 and the fed window is satisfied
      return !!(ctx.player && ctx.player.hunger < 0.3);
    },
    reward: { lp: 0, moment: null }, // no LP / moment for routine feeding
  },
  {
    id: 'heir',
    text: 'produce an heir.',
    weight: 60,
    // oneTime means LP/moment only fires once. But HUD can re-show if all descendants die
    // — see special handling in updateGoals and activeGoal using 'heir_lp_done' sub-key.
    oneTime: true,
    heirRepeatable: true, // custom flag: show in HUD even if LP already claimed
    isActive(ctx) {
      if (!ctx.player || ctx.player.stage !== 'adult') return false;
      // active when dynasty has no living non-egg descendants
      return _noLivingDescendants(ctx);
    },
    isComplete(ctx) {
      return !_noLivingDescendants(ctx);
    },
    reward: { lp: 10, moment: 'the bloodline continues.' },
  },
  {
    id: 'survive',
    text: 'stay alive.',
    weight: 5, // low — fallback when nothing else applies
    oneTime: false,
    isActive(_ctx) { return true; },
    isComplete(_ctx) { return false; }, // never completes — passive baseline
    reward: { lp: 0, moment: null },
  },
  {
    id: 'first-kill',
    text: 'make your first kill.',
    weight: 30,
    oneTime: true,
    isActive(ctx) {
      return !!(ctx.player && (ctx.player.mealCount || 0) === 0);
    },
    isComplete(ctx) {
      return !!(ctx.player && (ctx.player.mealCount || 0) > 0);
    },
    reward: { lp: 5, moment: 'first blood. <NAME> has killed.' },
  },
  {
    id: 'first-child',
    text: 'see your first hatchling.',
    weight: 35,
    oneTime: true,
    isActive(ctx) {
      // active until first descendant ever exists (living or dead in obit)
      return _noDescendantsEver(ctx);
    },
    isComplete(ctx) {
      return !_noDescendantsEver(ctx);
    },
    reward: { lp: 8, moment: 'a hatchling. <NAME> has reproduced.' },
  },
  {
    id: 'age-10',
    text: 'live ten days.',
    weight: 15,
    oneTime: true,
    isActive(ctx) {
      return !!(ctx.player && ctx.player.age < 600);
    },
    isComplete(ctx) {
      return !!(ctx.player && ctx.player.age >= 600);
    },
    reward: { lp: 10, moment: '<NAME> has survived ten days.' },
  },
  {
    id: 'age-30',
    text: 'live thirty days.',
    weight: 18,
    oneTime: true,
    isActive(ctx) {
      // gates after age-10
      return !!(ctx.player && ctx.player.age >= 600 && ctx.player.age < 1800);
    },
    isComplete(ctx) {
      return !!(ctx.player && ctx.player.age >= 1800);
    },
    reward: { lp: 25, moment: '<NAME> has survived thirty days.' },
  },
  {
    id: 'see-era-2',
    text: 'see the next era.',
    weight: 25,
    oneTime: true,
    isActive(ctx) {
      return !!(ctx.dynasty && (ctx.dynasty.era || 1) === 1);
    },
    isComplete(ctx) {
      return !!(ctx.dynasty && (ctx.dynasty.era || 1) >= 2);
    },
    reward: { lp: 30, moment: 'the industrial age. <NAME> saw it come.' },
  },
];

// --- helpers ---

function _noLivingDescendants(ctx) {
  if (!ctx.world || !ctx.dynasty) return false;
  for (const [, , g] of ctx.world.query('transform', 'gator')) {
    if (g.stage === 'egg') continue;
    const linId = g.lineage?.dynastyId || g.lineageId;
    if (linId !== ctx.dynasty.id) continue;
    if (g.isPlayer) continue; // player itself doesn't count as a descendant
    if ((g.generation || 0) > 0) return false; // there IS a living descendant
  }
  return true;
}

function _noDescendantsEver(ctx) {
  // Check living
  if (!_noLivingDescendants(ctx)) return false;
  // Check obituary for any past bloodline entry with generation > 0
  const entries = ctx.obituary || [];
  for (const e of entries) {
    if (e.lineageId === ctx.dynasty?.id && (e.generation || 0) > 0) return false;
  }
  return true;
}

// --- Public API ---

export function createGoalState() {
  return {
    completed: [],    // ids of completed one-time goals
    _lastFedTimer: 0, // seconds since last hunger drop below threshold
    _starvingFired: false, // whether starvation moment fired this crisis
    _starvingReset: false,
  };
}

export function loadGoals(dynastyId) {
  if (!dynastyId) return null;
  try {
    const raw = localStorage.getItem(GOAL_STORAGE_PREFIX + dynastyId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      _lastFedTimer: 0,
      _starvingFired: false,
      _starvingReset: false,
    };
  } catch (e) { return null; }
}

export function saveGoals(state, dynastyId) {
  if (!dynastyId || !state) return;
  try {
    localStorage.setItem(GOAL_STORAGE_PREFIX + dynastyId, JSON.stringify({
      completed: state.completed || [],
    }));
  } catch (e) {}
}

// ctx: { player, dynasty, world, simTime, era, obituary }
// callbacks: { onComplete(goal), onAwardLP(amount), addMoment(text) }
export function updateGoals(state, dt, ctx, callbacks) {
  if (!state) return;

  // Feed window timer: track time below 0.3 hunger so we can mark it satisfied
  if (ctx.player && ctx.player.hunger < 0.3) {
    state._lastFedTimer = (state._lastFedTimer || 0) + dt;
  } else {
    state._lastFedTimer = 0;
  }

  // Starvation moment tracking
  if (ctx.player && ctx.player.hunger > 0.95) {
    if (!state._starvingFired) {
      state._starvingFired = true;
      const name = (ctx.player.name || 'gator').toUpperCase();
      callbacks?.addMoment?.(`${name} is starving`);
    }
  } else if (ctx.player && ctx.player.hunger < 0.7) {
    // reset so it can fire again next crisis
    state._starvingFired = false;
  }

  for (const goal of GOAL_DEFS) {
    // Skip one-time goals already completed
    if (goal.oneTime && state.completed.includes(goal.id)) continue;
    // Skip non-active goals
    if (!goal.isActive(ctx)) continue;
    // Check completion
    if (!goal.isComplete(ctx, state)) continue;

    // Special case: feed goal needs the fed window (2s under 0.3)
    if (goal.id === 'feed') {
      if ((state._lastFedTimer || 0) < 2.0) continue;
      state._lastFedTimer = 0;
      // feed never awards LP or fires a moment — just completes silently
      continue;
    }

    // One-time goals: mark completed and reward
    if (goal.oneTime) {
      state.completed.push(goal.id);
      if (goal.reward.lp > 0) {
        callbacks?.onAwardLP?.(goal.reward.lp);
      }
      if (goal.reward.moment) {
        const playerName = (ctx.player?.name || 'gator').toUpperCase();
        const momentText = goal.reward.moment.replace('<NAME>', playerName);
        callbacks?.addMoment?.(momentText);
      }
      callbacks?.onComplete?.(goal);
      saveGoals(state, ctx.dynasty?.id);
    }
  }
}

// Returns the highest-weight active, non-completed goal (or the survive fallback).
// ctx: { player, dynasty, world, simTime, era, obituary }
export function activeGoal(state, ctx) {
  if (!state) return GOAL_DEFS.find(g => g.id === 'survive') || null;

  let best = null;
  let bestWeight = -1;

  for (const goal of GOAL_DEFS) {
    // Skip one-time goals already completed, UNLESS heirRepeatable (show in HUD but no re-reward)
    if (goal.oneTime && state.completed.includes(goal.id) && !goal.heirRepeatable) continue;
    // Must be active
    if (!goal.isActive(ctx)) continue;

    // Dynamic weight for feed goal
    let weight = goal.weight;
    if (goal.id === 'feed' && ctx.player) {
      weight = 10 + ctx.player.hunger * 80;
    }

    if (weight > bestWeight) {
      bestWeight = weight;
      best = goal;
    }
  }

  // Fallback: survive is always returned if nothing else qualifies
  if (!best) {
    best = GOAL_DEFS.find(g => g.id === 'survive') || null;
  }

  return best;
}
