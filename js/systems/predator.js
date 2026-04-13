// Predator system — herons that swoop in and eat baby gators

import { CANVAS_W, CANVAS_H } from '../config.js';
import { HERON_1 } from '../sprites/fauna-sprites.js';
import { distance } from '../utils/math.js';

const HERON_SPAWN_INTERVAL = 30; // seconds between potential spawns
const HERON_SPEED = 18;
const SWOOP_SPEED = 30;

export function predatorSystem(world, dt, rng, waterY, simTime) {
  // Count babies for spawn scaling
  let babyCount = 0;
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (gator.stage === 'hatchling' || gator.stage === 'egg') babyCount++;
  }

  // Spawn herons based on baby count
  let heronCount = 0;
  for (const [id, tr, pred] of world.query('transform', 'predator')) {
    heronCount++;
  }

  // Chance to spawn increases with babies
  if (heronCount < 2 && babyCount > 0) {
    const spawnChance = babyCount * 0.003 * dt;
    if (rng.chance(spawnChance)) {
      spawnHeron(world, rng, waterY);
    }
  }

  // Update herons
  for (const [id, tr, pred] of world.query('transform', 'predator')) {
    pred.lifetime -= dt;

    // Scared away?
    if (pred.scared) {
      tr.vy = -HERON_SPEED * 2;
      tr.vx = pred.fleeDir * HERON_SPEED;
      if (tr.y < -20) {
        world.kill(id);
      }
      continue;
    }

    switch (pred.state) {
      case 'circling': {
        // Fly across the top of the screen
        tr.x += tr.vx * dt;
        tr.y += Math.sin(simTime * 2 + id) * 0.3;

        // Look for a target
        let bestTarget = null;
        let bestDist = 80;
        for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
          if (gator.stage !== 'hatchling') continue;
          const dist = distance(tr.x, tr.y, gtr.x, gtr.y);
          if (dist < bestDist) {
            bestDist = dist;
            bestTarget = { id: gid, tr: gtr };
          }
        }

        if (bestTarget) {
          pred.state = 'swooping';
          pred.targetId = bestTarget.id;
          pred.swoopTimer = 3;
        }

        // Leave if past edges or timeout
        if (tr.x < -15 || tr.x > CANVAS_W + 15 || pred.lifetime <= 0) {
          world.kill(id);
        }
        break;
      }

      case 'swooping': {
        const targetTr = world.get(pred.targetId, 'transform');
        const targetGator = world.get(pred.targetId, 'gator');

        if (!targetTr || !targetGator || targetGator.stage !== 'hatchling') {
          pred.state = 'circling';
          pred.targetId = null;
          break;
        }

        // Dive toward target
        const dx = targetTr.x - tr.x;
        const dy = targetTr.y - tr.y;
        const dist = distance(tr.x, tr.y, targetTr.x, targetTr.y);

        if (dist > 2) {
          tr.vx = (dx / dist) * SWOOP_SPEED;
          tr.vy = (dy / dist) * SWOOP_SPEED;
        }

        // Catch!
        if (dist < 6) {
          world.kill(pred.targetId); // baby eaten
          pred.state = 'fleeing';
          pred.swoopTimer = 0;
        }

        pred.swoopTimer -= dt;
        if (pred.swoopTimer <= 0) {
          // Missed, fly away
          pred.state = 'fleeing';
        }
        break;
      }

      case 'fleeing': {
        tr.vy = -HERON_SPEED * 1.5;
        tr.vx = pred.fleeDir * HERON_SPEED * 0.5;
        if (tr.y < -20) {
          world.kill(id);
        }
        break;
      }
    }

    // Apply velocity
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;
  }
}

function spawnHeron(world, rng, waterY) {
  const id = world.create();
  const fromLeft = rng.chance(0.5);

  world.add(id, 'transform', {
    x: fromLeft ? -10 : CANVAS_W + 10,
    y: rng.float(5, waterY * 0.4),
    vx: fromLeft ? HERON_SPEED * 0.5 : -HERON_SPEED * 0.5,
    vy: 0,
    direction: fromLeft ? 1 : -1,
  });

  world.add(id, 'predator', {
    type: 'heron',
    state: 'circling',
    targetId: null,
    swoopTimer: 0,
    lifetime: rng.float(15, 30),
    scared: false,
    fleeDir: fromLeft ? -1 : 1,
    sprite: HERON_1,
  });

  return id;
}

// Scare predators in a radius (god power)
export function scarePredators(world, x, y, radius = 50) {
  for (const [id, tr, pred] of world.query('transform', 'predator')) {
    const dist = distance(x, y, tr.x, tr.y);
    if (dist < radius) {
      pred.scared = true;
      pred.fleeDir = tr.x < x ? -1 : 1;
    }
  }
}
