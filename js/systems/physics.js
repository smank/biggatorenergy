// Physics system — movement, land/water detection, boundary clamping

import { CANVAS_W, CANVAS_H } from '../config.js';

export function physicsSystem(world, dt, terrain, waterY, rng) {
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    // Slip on mud — gators near the waterline can lose their footing
    if (gator.slipping) {
      gator.slipTimer -= dt;
      tr.vx *= 1.5;
      if (gator.slipTimer <= 0) {
        gator.slipping = false;
      }
    } else if (rng && Math.abs(tr.vx) > 3 && Math.abs(tr.y + (gator.spriteH || 8) - waterY) < 3) {
      if (rng.chance(0.005 * dt)) {
        gator.slipping = true;
        gator.slipTimer = 0.5;
      }
    }

    // Apply velocity
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;

    // Determine if in water
    const feetY = tr.y + (gator.spriteH || 8);
    gator.inWater = feetY > waterY;

    // Water slows movement
    if (gator.inWater) {
      tr.vx *= 0.6;
    }

    // Clamp to world bounds
    const margin = 4;
    tr.x = Math.max(margin, Math.min(CANVAS_W - (gator.spriteW || 20) - margin, tr.x));

    // Vertical clamping — gator must stay near the ground/water
    // Find ground height at gator's x position
    const gatorCenterX = Math.floor(Math.max(0, Math.min(CANVAS_W - 1, tr.x + (gator.spriteW || 10) / 2)));
    const groundHere = terrain[gatorCenterX];

    // Gator walks on ground or swims in water — never floats in sky
    const spriteH = gator.spriteH || 8;
    const minY = Math.min(groundHere, waterY) - spriteH; // on ground or at water surface
    const maxY = waterY + 10; // can go a bit below water

    // Gators should gravitate toward the ground/water line
    const targetY = Math.min(groundHere - spriteH + 2, waterY - spriteH / 2);
    if (tr.y < targetY - 2) {
      tr.vy += 20 * dt; // gravity pulls them down
    }

    tr.y = Math.max(minY, Math.min(maxY, tr.y));

    // Dampen vertical velocity
    tr.vy *= 0.9;
  }

  // Simple physics for prey
  for (const [id, tr, prey] of world.query('transform', 'prey')) {
    tr.x += tr.vx * dt;
    tr.y += tr.vy * dt;

    // Remove if off screen
    if (tr.x < -10 || tr.x > CANVAS_W + 10 || tr.y < -10 || tr.y > CANVAS_H + 10) {
      world.kill(id);
    }
  }
}
