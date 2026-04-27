// Gator AI state machine
// States: idle, wandering, hunting, eating, sleeping, courting, mating, nesting, guarding, fighting, fleeing, dying

import { CANVAS_W } from '../config.js';
import { distance } from '../utils/math.js';

function transition(gator, state, rng) {
  gator.state = state;
  switch (state) {
    case 'idle':
      gator.stateTimer = rng.float(1.5, 4);
      break;
    case 'wandering':
      gator.stateTimer = rng.float(2, 6);
      gator.wanderDir = rng.chance(0.5) ? 1 : -1;
      break;
    case 'hunting':
      gator.stateTimer = rng.float(3, 8);
      break;
    case 'eating':
      gator.stateTimer = 0.4;
      break;
    case 'sleeping':
      gator.stateTimer = rng.float(4, 10);
      break;
    default:
      gator.stateTimer = rng.float(1.5, 4);
  }
}

function findNearestPrey(world, x, y, range) {
  let nearest = null;
  let nearestDist = range;

  for (const [id, tr, prey] of world.query('transform', 'prey')) {
    if (!prey.alive) continue;
    const dist = distance(x, y, tr.x, tr.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { id, tr, prey, dist };
    }
  }
  return nearest;
}

export function aiSystem(world, dt, rng, waterY) {
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    // Eggs don't do anything
    if (gator.stage === 'egg') continue;

    // Initialize state if needed
    if (!gator.state) {
      transition(gator, 'idle', rng);
    }

    // --- Player-controlled gator: execute playerOverride, skip random AI ---
    if (gator.isPlayer && gator.playerOverride) {
      const ov = gator.playerOverride;

      // Run animation timers regardless
      gator.blinkTimer = (gator.blinkTimer || 0) - dt;
      if (gator.blinkTimer <= 0) {
        if (gator.frame === 'blink') { gator.frame = 'idle'; gator.blinkTimer = rng.float(3, 8); }
        else { gator.frame = 'blink'; gator.blinkTimer = 0.15; }
      }
      gator.breatheTimer = (gator.breatheTimer || 0) - dt;
      if (gator.breatheTimer <= 0) {
        gator.breatheOffset = gator.breatheOffset === 0 ? 1 : 0;
        gator.breatheTimer = gator.breatheOffset === 0 ? rng.float(6, 12) : 0.5;
      }

      if (ov.action === 'moveTo') {
        const dx = ov.x - (tr.x + (gator.spriteW || 10) / 2);
        const dy = ov.y - tr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) {
          const speed = (gator.traits?.speed || 1) * 10;
          tr.vx = (dx / dist) * speed;
          tr.vy = (dy / dist) * speed * 0.3;
          tr.direction = dx > 0 ? 1 : -1;
          if (gator.inWater) gator.frame = 'swim';
        } else {
          tr.vx *= 0.85;
          tr.vy *= 0.85;
          gator.playerOverride = null; // arrived
          gator.state = 'idle';
          gator.stateTimer = rng.float(1, 3);
        }
      } else if (ov.action === 'hunt') {
        const ptr = world.get(ov.targetId, 'transform');
        const pp = world.get(ov.targetId, 'prey');
        if (!ptr || !pp || !pp.alive) {
          gator.playerOverride = null;
          gator.state = 'idle';
          gator.stateTimer = rng.float(1, 3);
        } else {
          const dx = ptr.x - tr.x;
          const dy = ptr.y - tr.y;
          const dist = distance(tr.x, tr.y, ptr.x, ptr.y);
          const speed = (gator.traits?.speed || 1) * 15;
          if (dist > 1) {
            tr.vx = (dx / dist) * speed;
            tr.vy = (dy / dist) * speed * 0.5;
            tr.direction = dx > 0 ? 1 : -1;
          }
          if (gator.inWater) gator.frame = 'swim';
          const sizeScale = gator.sizeScale || 1;
          const eatRange = (gator.spriteW || 20) * 0.4 * sizeScale;
          if (dist < eatRange) {
            tr.direction = dx > 0 ? 1 : -1;
            pp.alive = false;
            world.kill(ov.targetId);
            gator.frame = 'eat';
            gator.hunger = Math.max(0, gator.hunger - (pp.value || 0.15));
            gator.mealCount = (gator.mealCount || 0) + 1;
            const maxS = (gator.traits?.maxSize || 1) * 2.0;
            gator.sizeScale = Math.min(maxS, 1 + gator.mealCount * 0.02);
            gator.playerOverride = null;
            gator.state = 'eating';
            gator.stateTimer = 0.4;
          }
        }
      }
      // fight and court states are handled by the breeding system already
      // so we just fall through and let breeding system manage those states

      // Hunger/energy drain still applies to player gator
      gator.hunger = Math.min(1, gator.hunger + dt * 0.015 * (gator.traits?.metabolism || 1));
      if (gator.state !== 'sleeping') {
        const activityDrain = (gator.state === 'hunting' || gator.state === 'wandering') ? 0.01 : 0.005;
        gator.energy = Math.max(0, gator.energy - dt * activityDrain);
      }
      continue; // skip normal AI for player gator
    }

    // For player gator with no override, let idle state run (shows life) but don't
    // choose random wandering or hunger-driven targets
    if (gator.isPlayer) {
      gator.stateTimer -= dt;
      gator.blinkTimer = (gator.blinkTimer || 0) - dt;
      if (gator.blinkTimer <= 0) {
        if (gator.frame === 'blink') { gator.frame = 'idle'; gator.blinkTimer = rng.float(3, 8); }
        else if (gator.state !== 'eating') { gator.frame = 'blink'; gator.blinkTimer = 0.15; }
        else { gator.blinkTimer = rng.float(3, 8); }
      }
      gator.breatheTimer = (gator.breatheTimer || 0) - dt;
      if (gator.breatheTimer <= 0) {
        gator.breatheOffset = gator.breatheOffset === 0 ? 1 : 0;
        gator.breatheTimer = gator.breatheOffset === 0 ? rng.float(6, 12) : 0.5;
      }
      // Keep player gator loosely idle — slow to a stop if wandering state expired
      if (gator.state === 'wandering' && gator.stateTimer <= 0) {
        transition(gator, 'idle', rng);
      }
      if (gator.state === 'idle') {
        tr.vx *= 0.9;
      }
      if (gator.state === 'eating' && gator.stateTimer <= 0) {
        gator.frame = 'idle';
        transition(gator, 'idle', rng);
      }
      gator.hunger = Math.min(1, gator.hunger + dt * 0.015 * (gator.traits?.metabolism || 1));
      if (gator.state !== 'sleeping') {
        const activityDrain = (gator.state === 'hunting' || gator.state === 'wandering') ? 0.01 : 0.005;
        gator.energy = Math.max(0, gator.energy - dt * activityDrain);
      }
      continue;
    }

    // States managed by breeding system — don't override
    const breedingManaged = ['courting', 'mating', 'fighting', 'fleeing'];
    if (breedingManaged.includes(gator.state)) {
      gator.stateTimer -= dt;
      // Still run animation timers
      gator.blinkTimer = (gator.blinkTimer || 0) - dt;
      if (gator.blinkTimer <= 0 && gator.state !== 'fighting') {
        if (gator.frame === 'blink') {
          gator.frame = 'idle';
          gator.blinkTimer = rng.float(3, 8);
        } else {
          gator.frame = 'blink';
          gator.blinkTimer = 0.15;
        }
      }
      gator.breatheTimer = (gator.breatheTimer || 0) - dt;
      if (gator.breatheTimer <= 0) {
        gator.breatheOffset = gator.breatheOffset === 0 ? 1 : 0;
        gator.breatheTimer = gator.breatheOffset === 0 ? rng.float(6, 12) : 0.5;
      }
      continue;
    }

    gator.stateTimer -= dt;

    // Animation timers
    gator.blinkTimer = (gator.blinkTimer || 0) - dt;
    if (gator.blinkTimer <= 0) {
      if (gator.frame === 'blink') {
        gator.frame = 'idle';
        gator.blinkTimer = rng.float(3, 8);
      } else if (gator.state !== 'eating' && gator.state !== 'sleeping' && gator.state !== 'deathroll') {
        gator.frame = 'blink';
        gator.blinkTimer = 0.15;
      } else {
        gator.blinkTimer = rng.float(3, 8);
      }
    }

    // Breathe animation
    gator.breatheTimer = (gator.breatheTimer || 0) - dt;
    if (gator.breatheTimer <= 0) {
      gator.breatheOffset = gator.breatheOffset === 0 ? 1 : 0;
      gator.breatheTimer = gator.breatheOffset === 0 ? rng.float(6, 12) : 0.5;
    }

    // State machine
    switch (gator.state) {
      case 'idle': {
        tr.vx *= 0.9; // slow to stop
        if (gator.stateTimer <= 0) {
          if (gator.hunger > 0.3) {
            transition(gator, 'hunting', rng);
          } else if (gator.energy < 0.3) {
            transition(gator, 'sleeping', rng);
          } else {
            transition(gator, 'wandering', rng);
          }
        }
        break;
      }

      case 'wandering': {
        const speed = (gator.traits?.speed || 1) * 8;
        tr.vx = gator.wanderDir * speed;
        tr.direction = gator.wanderDir;

        // Set swim frame if in water
        if (gator.inWater) {
          gator.frame = 'swim';
        } else if (gator.frame === 'swim') {
          gator.frame = 'idle';
        }

        // Reverse at edges
        if (tr.x <= 6) gator.wanderDir = 1;
        if (tr.x >= CANVAS_W - (gator.spriteW || 20) - 6) gator.wanderDir = -1;

        if (gator.stateTimer <= 0) {
          transition(gator, 'idle', rng);
        }

        // Opportunistic hunting — gators are always looking for a meal
        if (gator.hunger > 0.2) {
          const prey = findNearestPrey(world, tr.x, tr.y, 50);
          if (prey) {
            gator.targetId = prey.id;
            transition(gator, 'hunting', rng);
          }
        }
        break;
      }

      case 'hunting': {
        const prey = gator.targetId
          ? (() => {
              const ptr = world.get(gator.targetId, 'transform');
              const pp = world.get(gator.targetId, 'prey');
              return ptr && pp && pp.alive ? { id: gator.targetId, tr: ptr, prey: pp } : null;
            })()
          : findNearestPrey(world, tr.x, tr.y, 60);

        if (!prey) {
          transition(gator, 'wandering', rng);
          break;
        }

        gator.targetId = prey.id;

        // Move toward prey
        const dx = prey.tr.x - tr.x;
        const dy = prey.tr.y - tr.y;
        const dist = distance(tr.x, tr.y, prey.tr.x, prey.tr.y);
        const speed = (gator.traits?.speed || 1) * 15;

        if (dist > 1) {
          tr.vx = (dx / dist) * speed;
          tr.vy = (dy / dist) * speed * 0.5;
          tr.direction = dx > 0 ? 1 : -1;
        }

        if (gator.inWater) {
          gator.frame = 'swim';
        }

        // Eat if close enough — scale eat range with size
        const sizeScale = gator.sizeScale || 1;
        const eatRange = (gator.spriteW || 20) * 0.4 * sizeScale;
        if (dist < eatRange) {
          // Face the prey
          tr.direction = (prey.tr.x - tr.x) > 0 ? 1 : -1;
          prey.prey.alive = false;
          world.kill(prey.id);
          gator.frame = 'eat';
          gator.hunger = Math.max(0, gator.hunger - (prey.prey.value || 0.15));
          gator.targetId = null;
          // Track meals — gators grow with each meal
          gator.mealCount = (gator.mealCount || 0) + 1;
          // Size increases with meals, affected by maxSize trait
          const maxScale = (gator.traits?.maxSize || 1) * 2.0; // can get up to 2x base
          gator.sizeScale = Math.min(maxScale, 1 + gator.mealCount * 0.02);
          transition(gator, 'eating', rng);
        }

        if (gator.stateTimer <= 0) {
          gator.targetId = null;
          transition(gator, 'idle', rng);
        }
        break;
      }

      case 'eating': {
        tr.vx *= 0.8;
        tr.vy *= 0.8;
        gator.frame = 'eat';
        if (gator.stateTimer <= 0) {
          gator.frame = 'idle';
          transition(gator, 'idle', rng);
        }
        break;
      }

      case 'sleeping': {
        tr.vx = 0;
        tr.vy = 0;
        gator.frame = 'blink'; // eyes closed
        gator.energy = Math.min(1, gator.energy + dt * 0.05);
        if (gator.stateTimer <= 0 || gator.energy > 0.8) {
          gator.frame = 'idle';
          transition(gator, 'idle', rng);
        }
        break;
      }

      case 'deathroll': {
        gator.frame = 'eat'; // mouth open the whole time

        // Drift toward water if on land
        if (tr.y < waterY - 2) {
          tr.vy = 8;
        } else {
          tr.vy *= 0.8;
        }
        // Slight horizontal drift toward center of water
        tr.vx *= 0.9;

        // Spin — alternate direction every 0.3s to simulate rolling
        gator.deathrollRollTimer = (gator.deathrollRollTimer || 0.3) - dt;
        if (gator.deathrollRollTimer <= 0) {
          tr.direction = tr.direction === 1 ? -1 : 1;
          gator.deathrollRollTimer = 0.3;
        }

        // Prey follows the gator's mouth
        if (gator.deathrollPrey) {
          const mouthOffsetX = tr.direction === 1 ? (gator.spriteW || 10) : 0;
          gator.deathrollPrey.x = tr.x + mouthOffsetX;
          gator.deathrollPrey.y = tr.y + 1;
        }

        if (gator.stateTimer <= 0) {
          // Kill the prey now
          if (gator.deathrollWildlife) {
            gator.deathrollWildlife.alive = false;
          }
          // Apply meal rewards
          gator.hunger = Math.max(0, gator.hunger - (gator.deathrollMealValue || 0.2));
          gator.mealCount = (gator.mealCount || 0) + (gator.deathrollMealCount || 2);
          const maxS = (gator.traits?.maxSize || 1) * 2.0;
          gator.sizeScale = Math.min(maxS, 1 + gator.mealCount * 0.02);
          // Clean up
          gator.deathrollPrey = null;
          gator.deathrollWildlife = null;
          gator.deathrollMealValue = null;
          gator.deathrollMealCount = null;
          gator.deathrollRollTimer = null;
          transition(gator, 'eating', rng);
        }
        break;
      }

      case 'guarding': {
        // Stay near nest
        if (gator.nest) {
          const dxNest = gator.nest.x - tr.x;
          if (Math.abs(dxNest) > 8) {
            tr.vx = Math.sign(dxNest) * (gator.traits?.speed || 1) * 6;
            tr.direction = dxNest > 0 ? 1 : -1;
          } else {
            tr.vx *= 0.85;
          }
          tr.vy *= 0.8;

          // Hatch timer counts down
          gator.nest.hatchTimer -= dt;

          if (gator.nest.hatchTimer <= 0) {
            // Hatch — spawn babies via callback stored on gator
            gator.nestHatchReady = true; // breeding system handles actual spawning
            gator.frame = 'idle';
            transition(gator, 'idle', rng);
          }
        } else {
          // Nest removed somehow
          transition(gator, 'idle', rng);
        }

        if (gator.stateTimer <= 0 && !gator.nest) {
          transition(gator, 'idle', rng);
        }
        break;
      }
    }

    // Hunger and energy drain
    gator.hunger = Math.min(1, gator.hunger + dt * 0.015 * (gator.traits?.metabolism || 1));
    if (gator.state !== 'sleeping') {
      const activityDrain = (gator.state === 'hunting' || gator.state === 'wandering') ? 0.01 : 0.005;
      gator.energy = Math.max(0, gator.energy - dt * activityDrain);
    }
  }
}
