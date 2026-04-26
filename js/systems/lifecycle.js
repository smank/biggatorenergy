// Lifecycle system — aging through stages, hunger/energy drain, natural death

import { GATOR_STAGES } from '../sprites/gator-sprites.js';
import { logDeath } from '../game/obituary.js';

// Stage durations in sim-seconds (at real-time, 1 sim-second = 1 real second)
const STAGE_DURATIONS = {
  egg: 8,
  hatchling: 15,
  juvenile: 40,
  adult: 100,
  elder: 40,
};

const STAGE_ORDER = ['egg', 'hatchling', 'juvenile', 'adult', 'elder'];

export function lifecycleSystem(world, dt, rng, obituaryState, simTime) {
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    // Age
    gator.age += dt;

    // Stage progression
    const stageDuration = STAGE_DURATIONS[gator.stage] * (gator.traits?.maxSize || 1);
    const stageIndex = STAGE_ORDER.indexOf(gator.stage);

    if (gator.age > stageDuration && stageIndex < STAGE_ORDER.length - 1) {
      const nextStage = STAGE_ORDER[stageIndex + 1];

      // Egg hatching
      if (gator.stage === 'egg') {
        gator.stage = 'hatchling';
        gator.age = 0;
        gator.state = null; // let AI initialize
        const stageData = GATOR_STAGES['hatchling'];
        if (stageData) {
          gator.spriteW = stageData.width;
          gator.spriteH = stageData.height;
        }
        continue;
      }

      gator.stage = nextStage;
      gator.age = 0;

      // Update sprite dimensions
      const stageData = GATOR_STAGES[nextStage];
      if (stageData) {
        gator.spriteW = stageData.width;
        gator.spriteH = stageData.height;
      }

      // Elders are slower
      if (nextStage === 'elder' && gator.traits) {
        gator.traits.speed *= 0.6;
      }
    }

    // Starvation death
    if (gator.hunger >= 1.0) {
      gator.health -= dt * 0.1;
      if (gator.health <= 0) {
        if (obituaryState) logDeath(obituaryState, { gator, cause: 'starvation', time: simTime });
        world.kill(id);
        continue;
      }
    }

    // Elder death from old age
    if (gator.stage === 'elder') {
      const deathChance = (gator.age / (STAGE_DURATIONS.elder * (gator.traits?.maxSize || 1))) * 0.01;
      if (rng.chance(deathChance * dt)) {
        if (obituaryState) logDeath(obituaryState, { gator, cause: 'old age', time: simTime });
        world.kill(id);
        continue;
      }
    }
  }
}
