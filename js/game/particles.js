// --- Particle Systems ---
// Death particles, ambient particles, ripples, and gator ripples
import { CANVAS_W, CANVAS_H } from '../config.js';

export function createParticleState() {
  return {
    deathParticles: [],
    ambientParticles: [],
    ripples: [],
    gatorRippleTimer: 0,
  };
}

// --- Death Particles ---

export function spawnDeathParticles(state, x, y, color = '#882222') {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    state.deathParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 15 - 3,
      life: 0.5 + Math.random() * 0.8,
      color,
    });
  }
}

export function updateDeathParticles(state, dt) {
  for (let i = state.deathParticles.length - 1; i >= 0; i--) {
    const p = state.deathParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 25 * dt; // gravity
    p.life -= dt;
    if (p.life <= 0) state.deathParticles.splice(i, 1);
  }
}

export function renderDeathParticles(ctx, state) {
  for (const p of state.deathParticles) {
    const alpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

// --- Ambient Particles ---

export function updateAmbientParticles(state, dt, simTime, rng, env, waterY) {
  const { ambientParticles } = state;
  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;

  // Fireflies at night
  if (isNight && ambientParticles.length < 20) {
    if (rng.chance(0.05 * dt)) {
      ambientParticles.push({
        type: 'firefly',
        x: rng.float(10, CANVAS_W - 10),
        y: rng.float(waterY - 20, waterY - 2),
        vx: rng.float(-2, 2),
        vy: rng.float(-1, 1),
        phase: rng.float(0, Math.PI * 2),
        life: rng.float(5, 15),
      });
    }
  }

  // Bubbles from underwater
  if (ambientParticles.length < 25) {
    if (rng.chance(0.03 * dt)) {
      ambientParticles.push({
        type: 'bubble',
        x: rng.float(30, CANVAS_W - 30),
        y: CANVAS_H - rng.float(5, 15),
        vx: rng.float(-0.5, 0.5),
        vy: -rng.float(4, 8),
        life: rng.float(3, 8),
      });
    }
  }

  // Autumn leaves
  if (env.season === 'autumn' && ambientParticles.length < 25) {
    if (rng.chance(0.04 * dt)) {
      ambientParticles.push({
        type: 'leaf',
        x: CANVAS_W + 5,
        y: rng.float(5, waterY - 5),
        vx: -rng.float(3, 8),
        vy: rng.float(1, 4),
        phase: rng.float(0, Math.PI * 2),
        life: rng.float(8, 20),
      });
    }
  }

  // Dragonflies during day
  if (!isNight && ambientParticles.length < 20) {
    if (rng.chance(0.01 * dt)) {
      ambientParticles.push({
        type: 'dragonfly',
        x: rng.chance(0.5) ? -5 : CANVAS_W + 5,
        y: rng.float(5, waterY - 5),
        vx: rng.float(-6, 6),
        vy: rng.float(-3, 3),
        changeTimer: rng.float(0.5, 2),
        life: rng.float(10, 25),
      });
    }
  }

  // Update particles
  for (let i = ambientParticles.length - 1; i >= 0; i--) {
    const p = ambientParticles[i];
    p.life -= dt;
    if (p.life <= 0) { ambientParticles.splice(i, 1); continue; }

    switch (p.type) {
      case 'firefly':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx += rng.float(-1, 1) * dt;
        p.vy += rng.float(-1, 1) * dt;
        p.vx *= 0.98; p.vy *= 0.98;
        break;
      case 'bubble':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx += Math.sin(simTime * 3 + i) * 0.5 * dt;
        if (p.y < waterY) { ambientParticles.splice(i, 1); continue; }
        break;
      case 'leaf':
        p.x += p.vx * dt;
        p.y += p.vy * dt + Math.sin(simTime * 2 + p.phase) * 0.3 * dt;
        if (p.x < -10 || p.y > waterY) { ambientParticles.splice(i, 1); continue; }
        break;
      case 'dragonfly':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.changeTimer -= dt;
        if (p.changeTimer <= 0) {
          p.vx = rng.float(-8, 8);
          p.vy = rng.float(-4, 4);
          p.changeTimer = rng.float(0.3, 1.5);
        }
        if (p.y > waterY - 2) p.vy = -Math.abs(p.vy);
        if (p.y < 3) p.vy = Math.abs(p.vy);
        if (p.x < -10 || p.x > CANVAS_W + 10) { ambientParticles.splice(i, 1); continue; }
        break;
    }
  }
}

export function renderAmbientParticles(ctx, state, simTime) {
  for (const p of state.ambientParticles) {
    switch (p.type) {
      case 'firefly': {
        const brightness = (Math.sin(simTime * 4 + p.phase) + 1) * 0.5;
        if (brightness > 0.3) {
          const alpha = brightness * Math.min(1, p.life);
          ctx.fillStyle = `rgba(238, 255, 136, ${alpha})`;
          ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
          // Glow
          if (brightness > 0.7) {
            ctx.fillStyle = `rgba(238, 255, 136, ${alpha * 0.3})`;
            ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y), 1, 1);
            ctx.fillRect(Math.floor(p.x) + 1, Math.floor(p.y), 1, 1);
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y) - 1, 1, 1);
            ctx.fillRect(Math.floor(p.x), Math.floor(p.y) + 1, 1, 1);
          }
        }
        break;
      }
      case 'bubble':
        ctx.fillStyle = `rgba(136, 187, 204, ${Math.min(0.6, p.life * 0.2)})`;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
        break;
      case 'leaf': {
        const frame = Math.sin(simTime * 3 + p.phase) > 0;
        ctx.fillStyle = '#aa6633';
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 1);
        ctx.fillStyle = '#cc8844';
        ctx.fillRect(Math.floor(p.x) + (frame ? 0 : 1), Math.floor(p.y) + 1, 1, 1);
        break;
      }
      case 'dragonfly': {
        const wingUp = Math.sin(simTime * 15 + p.x) > 0;
        ctx.fillStyle = '#3355aa';
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 1);
        ctx.fillStyle = '#6688aa';
        if (wingUp) {
          ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, 1, 1);
          ctx.fillRect(Math.floor(p.x) + 2, Math.floor(p.y) - 1, 1, 1);
        } else {
          ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) + 1, 1, 1);
          ctx.fillRect(Math.floor(p.x) + 2, Math.floor(p.y) + 1, 1, 1);
        }
        break;
      }
    }
  }
}

// --- Ripples ---

export function addRipple(state, x, y, maxRadius, opacity) {
  state.ripples.push({ x, y, radius: 0, maxRadius, opacity });
}

export function renderRipples(ctx, state, dt) {
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const r = state.ripples[i];
    r.radius += dt * 15;
    r.opacity -= dt * 1.2;

    if (r.opacity <= 0 || r.radius > r.maxRadius) {
      state.ripples.splice(i, 1);
      continue;
    }

    ctx.fillStyle = `rgba(180, 220, 200, ${r.opacity * 0.5})`;
    const steps = Math.floor(r.radius * 4);
    for (let a = 0; a < steps; a++) {
      const angle = (a / steps) * Math.PI * 2;
      const px = Math.floor(r.x + Math.cos(angle) * r.radius);
      const py = Math.floor(r.y + Math.sin(angle) * r.radius);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

// --- Gator Ripples ---

export function updateGatorRipples(state, world, dt, rng, waterY) {
  state.gatorRippleTimer -= dt;
  if (state.gatorRippleTimer > 0) return;
  state.gatorRippleTimer = rng.float(1.5, 4);

  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (gator.stage === 'egg') continue;
    if (gator.inWater && (gator.state === 'wandering' || gator.state === 'hunting' || gator.state === 'swimming')) {
      addRipple(state,
        tr.x + (gator.spriteW || 10) / 2,
        waterY,
        5 + (gator.spriteW || 10) / 4,
        0.4,
      );
      break; // one ripple per cycle
    }
    // Idle gators occasionally cause subtle ripples
    if (gator.inWater && rng.chance(0.3)) {
      addRipple(state,
        tr.x + (gator.spriteW || 10) / 2,
        waterY,
        3,
        0.2,
      );
      break;
    }
  }
}
