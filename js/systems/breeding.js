// Breeding system — courtship, mating, nesting, egg incubation, hatching

import { GATOR_STAGES } from '../sprites/gator-sprites.js';
import { blendColors } from '../utils/colors.js';
import { distance } from '../utils/math.js';

const MATE_COOLDOWN = 25;       // seconds between mating attempts
const PREGNANCY_DURATION = 10;  // seconds of pregnancy
const EGG_INCUBATION = 8;       // seconds for eggs to hatch
const COURTSHIP_RANGE = 45;     // pixels
const COURTSHIP_DURATION = 3;   // seconds of courtship before mating

export function breedingSystem(world, dt, rng, waterY, spawnGatorFromParents) {
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    // Only adults can breed
    if (gator.stage !== 'adult') continue;

    // Cooldown
    gator.mateCooldown = (gator.mateCooldown || 0) - dt;
    if (gator.mateCooldown > 0) continue;

    // Males initiate courtship
    if (gator.sex === 'male' && gator.state === 'idle' && gator.hunger < 0.5 && gator.energy > 0.4) {
      // Find a nearby female
      if (!gator.courtTarget) {
        const female = findMate(world, id, tr, gator);
        if (female) {
          gator.courtTarget = female.id;
          gator.courtTimer = COURTSHIP_DURATION;
          gator.state = 'courting';
          gator.stateTimer = COURTSHIP_DURATION + 2;
        }
      }
    }

    // Courting behavior
    if (gator.state === 'courting' && gator.sex === 'male') {
      const femaleTr = world.get(gator.courtTarget, 'transform');
      const femaleGator = world.get(gator.courtTarget, 'gator');

      if (!femaleTr || !femaleGator || femaleGator.stage !== 'adult' || femaleGator.sex !== 'female') {
        // Target gone or invalid
        gator.courtTarget = null;
        gator.state = 'idle';
        gator.stateTimer = rng.float(3, 8);
        continue;
      }

      // Move toward female
      const dx = femaleTr.x - tr.x;
      const dy = femaleTr.y - tr.y;
      const dist = distance(tr.x, tr.y, femaleTr.x, femaleTr.y);
      const speed = (gator.traits?.speed || 1) * 6;

      if (dist > 5) {
        tr.vx = (dx / dist) * speed;
        tr.vy = (dy / dist) * speed * 0.3;
        tr.direction = dx > 0 ? 1 : -1;
      } else {
        tr.vx *= 0.8;
        tr.vy *= 0.8;
      }

      gator.courtTimer -= dt;

      // Courtship success — female evaluates
      if (gator.courtTimer <= 0 && dist < 8) {
        // Female accepts based on male size and aggression
        const maleScore = (gator.traits?.maxSize || 1) + (gator.traits?.aggression || 0.5) * 0.5;
        const acceptChance = Math.min(0.8, maleScore * 0.4 * (femaleGator.traits?.fertility || 0.5));

        if (rng.chance(acceptChance) && femaleGator.mateCooldown <= 0) {
          // Mating!
          gator.state = 'mating';
          gator.stateTimer = 3;
          femaleGator.state = 'mating';
          femaleGator.stateTimer = 3;
          femaleGator.matePartner = id;
          gator.matePartner = gator.courtTarget;
          gator.mateCooldown = MATE_COOLDOWN;
          femaleGator.mateCooldown = MATE_COOLDOWN;
        } else {
          // Rejected
          gator.courtTarget = null;
          gator.state = 'idle';
          gator.stateTimer = rng.float(5, 15);
          gator.mateCooldown = MATE_COOLDOWN * 0.3;
        }
      }
    }

    // Mating state (both partners)
    if (gator.state === 'mating') {
      tr.vx *= 0.9;
      tr.vy *= 0.9;

      if (gator.stateTimer <= 0) {
        // After mating, female becomes pregnant
        if (gator.sex === 'female') {
          gator.isPregnant = true;
          gator.pregnancyTimer = PREGNANCY_DURATION;
          gator.mateTraits = world.get(gator.matePartner, 'gator')?.traits || null;
        }
        gator.state = 'idle';
        gator.stateTimer = rng.float(3, 8);
        gator.courtTarget = null;
        gator.matePartner = null;
      }
    }

    // Pregnancy
    if (gator.isPregnant) {
      gator.pregnancyTimer -= dt;
      // Pregnant females eat more
      gator.hunger += dt * 0.003;

      if (gator.pregnancyTimer <= 0) {
        // Lay eggs — create nest mound
        gator.isPregnant = false;
        const clutchSize = Math.floor((gator.traits?.fertility || 0.5) * 4) + rng.range(1, 3);

        gator.nest = {
          x: tr.x,
          y: waterY - 2,
          eggs: clutchSize,
          hatchTimer: EGG_INCUBATION,
          parentTraits: gator.traits,
          mateTraits: gator.mateTraits,
          generation: gator.generation,
        };
        gator.state = 'guarding';
        gator.stateTimer = 10;
      }
    }

    // Nest hatching — triggered by AI guarding state timer expiry
    if (gator.nestHatchReady && gator.nest) {
      const nest = gator.nest;
      for (let i = 0; i < nest.eggs; i++) {
        spawnGatorFromParents(
          rng,
          { x: nest.x + rng.float(-6, 6), y: nest.y - rng.float(0, 2) },
          nest.parentTraits,
          nest.mateTraits,
          nest.generation
        );
      }
      gator.nest = null;
      gator.nestHatchReady = false;
      gator.mateTraits = null;
    }

    // Fighting — males in close proximity with high aggression
    if (gator.sex === 'male' && gator.stage === 'adult' && gator.state === 'idle') {
      for (const [otherId, otherTr, otherGator] of world.query('transform', 'gator')) {
        if (otherId === id) continue;
        if (otherGator.sex !== 'male' || otherGator.stage !== 'adult') continue;
        if (otherGator.golden) continue; // don't challenge the golden gator

        const dist = Math.abs(otherTr.x - tr.x);
        if (dist < 15) {
          const fightChance = (gator.traits?.aggression || 0.5) * 0.02;
          if (rng.chance(fightChance * dt)) {
            gator.state = 'fighting';
            gator.stateTimer = rng.float(2, 5);
            gator.fightTarget = otherId;
            otherGator.state = 'fighting';
            otherGator.stateTimer = rng.float(2, 5);
            otherGator.fightTarget = id;
            break;
          }
        }
      }
    }

    // Fighting resolution
    if (gator.state === 'fighting') {
      const targetTr = world.get(gator.fightTarget, 'transform');
      if (targetTr) {
        // Face opponent
        tr.direction = targetTr.x > tr.x ? 1 : -1;
        // Lunge toward
        const dx = targetTr.x - tr.x;
        if (Math.abs(dx) > 3) {
          tr.vx = Math.sign(dx) * (gator.traits?.speed || 1) * 10;
        } else {
          tr.vx *= 0.8;
        }
        gator.frame = 'eat'; // mouth open for fighting
      }

      if (gator.stateTimer <= 0) {
        // Resolve fight — bigger/more aggressive wins
        const targetGator = world.get(gator.fightTarget, 'gator');
        if (targetGator) {
          const myPower = (gator.traits?.maxSize || 1) * (gator.traits?.aggression || 0.5);
          const theirPower = (targetGator.traits?.maxSize || 1) * (targetGator.traits?.aggression || 0.5);

          if (myPower > theirPower + rng.float(-0.2, 0.2)) {
            // I won — opponent flees
            targetGator.state = 'fleeing';
            targetGator.stateTimer = rng.float(3, 6);
            targetGator.health -= 0.15;
          } else {
            // I lost
            gator.state = 'fleeing';
            gator.stateTimer = rng.float(3, 6);
            gator.health -= 0.15;
          }
        }
        if (gator.state === 'fighting') {
          gator.state = 'idle';
          gator.stateTimer = rng.float(3, 8);
        }
        gator.frame = 'idle';
        gator.fightTarget = null;
      }
    }

    // Fleeing
    if (gator.state === 'fleeing') {
      // Run away from fight target or just run
      tr.vx = -tr.direction * (gator.traits?.speed || 1) * 15;
      if (gator.stateTimer <= 0) {
        gator.state = 'idle';
        gator.stateTimer = rng.float(3, 8);
      }
    }
  }
}

function findMate(world, myId, myTr, myGator) {
  let best = null;
  let bestDist = COURTSHIP_RANGE;

  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (id === myId) continue;
    if (gator.sex !== 'female') continue;
    if (gator.stage !== 'adult') continue;
    if (gator.isPregnant) continue;
    if ((gator.mateCooldown || 0) > 0) continue;
    if (gator.state === 'mating' || gator.state === 'courting') continue;

    let dist = distance(myTr.x, myTr.y, tr.x, tr.y);

    // Golden gators are preferred mates — effectively doubles attractiveness
    const effectiveDist = gator.golden ? dist * 0.5 : dist;

    if (effectiveDist < bestDist) {
      bestDist = effectiveDist;
      best = { id, tr, gator, dist };
    }
  }
  return best;
}

// Trait inheritance
export function inheritTraits(parentA, parentB, rng) {
  if (!parentA || !parentB) return parentA || parentB || {};

  const traits = {};
  const numericKeys = ['speed', 'maxSize', 'aggression', 'fertility', 'metabolism'];

  for (const key of numericKeys) {
    const a = parentA[key] ?? 1;
    const b = parentB[key] ?? 1;
    const blend = rng.random();
    let value = a * blend + b * (1 - blend);
    // Mutation
    if (rng.chance(0.1)) {
      value *= 1 + rng.gaussian(0, 0.15);
    }
    traits[key] = Math.max(0.3, Math.min(2.0, value));
  }

  // Color inheritance
  const colorKeys = ['darkColor', 'bodyColor', 'bellyColor', 'scuteColor'];
  for (const key of colorKeys) {
    traits[key] = blendColors(parentA[key], parentB[key], rng);
  }

  return traits;
}

// Color utilities imported from utils/colors.js
