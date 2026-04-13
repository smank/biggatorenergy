// --- FIRE SYSTEM ---

export function createFireState() {
  return { fires: [] };
}

export function startFire(state, x, y, rng, waterY) {
  // Only on land (above water)
  if (y > waterY - 1) return;
  // Don't stack fires
  if (state.fires.some(f => Math.abs(f.x - x) < 5)) return;
  state.fires.push({
    x: Math.floor(x),
    y: Math.floor(y),
    intensity: rng.float(0.5, 1),
    life: rng.float(10, 25),
    spreadTimer: rng.float(2, 5),
    width: rng.range(3, 6),
  });
}

export function updateFires(state, dt, rng, wildlife, world, env, waterY) {
  for (let i = state.fires.length - 1; i >= 0; i--) {
    const f = state.fires[i];
    f.life -= dt;
    f.intensity = Math.min(1, f.intensity + dt * 0.05);

    // Spread
    f.spreadTimer -= dt;
    if (f.spreadTimer <= 0 && state.fires.length < 8) {
      f.spreadTimer = rng.float(3, 8);
      if (rng.chance(0.4)) {
        const dir = rng.chance(0.5) ? -1 : 1;
        startFire(state, f.x + dir * rng.range(4, 10), f.y + rng.float(-2, 2), rng, waterY);
      }
    }

    // Grow
    if (rng.chance(0.1 * dt)) f.width = Math.min(12, f.width + 1);

    // Kill nearby wildlife
    for (const w of wildlife) {
      if (!w.alive) continue;
      if (Math.abs(w.x - f.x) < f.width && Math.abs(w.y - f.y) < 5) {
        if (!['bird', 'egret', 'heron_bg', 'butterfly', 'mothman'].includes(w.type)) {
          w.alive = false; // burned
        }
      }
    }

    // Damage nearby gators
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (Math.abs(tr.x - f.x) < f.width && Math.abs(tr.y - f.y) < 6) {
        gator.health -= dt * 0.08;
        // Gator flees fire
        if (gator.state !== 'fleeing') {
          gator.state = 'fleeing';
          gator.stateTimer = 3;
          tr.vx = Math.sign(tr.x - f.x) * 15;
        }
      }
    }

    // Rain puts out fires faster
    if (env.weather === 'rain' || env.weather === 'storm') {
      f.life -= dt * 2;
    }

    if (f.life <= 0) {
      state.fires.splice(i, 1);
    }
  }
}

export function renderFires(ctx, state, simTime) {
  for (const f of state.fires) {
    const alpha = Math.min(1, f.life * 0.2);
    for (let fx = 0; fx < f.width; fx++) {
      const flicker = Math.sin(simTime * 12 + fx * 2.5 + f.x) * 0.5 + 0.5;
      const height = Math.floor(flicker * 4 + 2);
      // Fire colors bottom to top
      for (let fy = 0; fy < height; fy++) {
        const ratio = fy / height;
        if (ratio < 0.3) {
          ctx.fillStyle = `rgba(255, 60, 0, ${alpha * f.intensity})`;
        } else if (ratio < 0.6) {
          ctx.fillStyle = `rgba(255, 150, 0, ${alpha * f.intensity * 0.8})`;
        } else {
          ctx.fillStyle = `rgba(255, 220, 50, ${alpha * f.intensity * 0.6})`;
        }
        ctx.fillRect(f.x + fx, f.y - fy, 1, 1);
      }
    }
    // Smoke above fire
    ctx.fillStyle = `rgba(80, 80, 80, ${alpha * 0.3})`;
    for (let s = 0; s < 3; s++) {
      const sx = f.x + Math.floor(f.width / 2) + Math.floor(Math.sin(simTime * 3 + s * 2) * 2);
      const sy = f.y - 6 - s * 2 - Math.floor(Math.sin(simTime * 2 + s) * 1);
      ctx.fillRect(sx, sy, 2, 1);
    }
    // Light glow on ground
    ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.06})`;
    ctx.fillRect(f.x - 3, f.y - 8, f.width + 6, 10);
  }
}
