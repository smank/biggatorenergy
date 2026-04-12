// Dramatic events system — lightning strikes, UFO abductions, celestial events, tragedy

import { CANVAS_W, CANVAS_H } from '../config.js';

export function createEventSystem() {
  return {
    eventTimer: 20,
    lightningFlash: 0,
    lightningBolts: [],
    ufo: null,
    shootingStars: [],
    meteor: null,
    eclipse: null,
    eventLog: [], // recent events for flavor
  };
}

export function updateEvents(events, world, dt, rng, waterY, simTime, env) {
  events.eventTimer -= dt;

  // Crash smoke decay
  if (events.crashSmoke) {
    for (let i = events.crashSmoke.length - 1; i >= 0; i--) {
      const s = events.crashSmoke[i];
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) events.crashSmoke.splice(i, 1);
    }
  }

  // Lightning flash decay
  if (events.lightningFlash > 0) {
    events.lightningFlash -= dt * 4;
  }

  // Lightning bolts decay
  for (let i = events.lightningBolts.length - 1; i >= 0; i--) {
    events.lightningBolts[i].life -= dt;
    if (events.lightningBolts[i].life <= 0) events.lightningBolts.splice(i, 1);
  }

  // Shooting stars decay
  for (let i = events.shootingStars.length - 1; i >= 0; i--) {
    const s = events.shootingStars[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (s.life <= 0) events.shootingStars.splice(i, 1);
  }

  // UFO logic
  if (events.ufo) {
    const ufo = events.ufo;
    ufo.timer -= dt;

    switch (ufo.phase) {
      case 'approach':
        ufo.x += (ufo.targetX - ufo.x) * dt * 0.5;
        ufo.y += (ufo.hoverY - ufo.y) * dt * 0.8;
        if (Math.abs(ufo.x - ufo.targetX) < 3 && Math.abs(ufo.y - ufo.hoverY) < 2) {
          ufo.phase = 'hover';
          ufo.timer = 2;
        }
        break;
      case 'hover':
        ufo.y += Math.sin(simTime * 3) * 0.3;
        ufo.beamOn = true;
        if (ufo.timer <= 0) {
          ufo.phase = 'abduct';
          ufo.timer = 2.5;
          // Find nearest gator — wide search
          const gators = world.query('transform', 'gator');
          let closest = null;
          let closestDist = 60;
          for (const [id, tr, gator] of gators) {
            if (gator.stage === 'egg') continue;
            const dist = Math.abs(tr.x - ufo.x);
            if (dist < closestDist) {
              closestDist = dist;
              closest = { id, tr, gator };
            }
          }
          if (closest) {
            ufo.victimId = closest.id;
            // Move UFO over the victim
            ufo.targetX = closest.tr.x;
          }
        }
        break;
      case 'abduct':
        ufo.beamOn = true;
        // Drift over target
        if (ufo.targetX) {
          ufo.x += (ufo.targetX - ufo.x) * dt * 1.5;
        }
        // Pull victim up
        if (ufo.victimId !== null) {
          const victimTr = world.get(ufo.victimId, 'transform');
          if (victimTr) {
            victimTr.y -= 20 * dt;
            victimTr.x += (ufo.x - victimTr.x) * dt * 3;
            victimTr.vx = 0;
            victimTr.vy = 0;
            if (victimTr.y < ufo.y + 5) {
              world.kill(ufo.victimId);
              ufo.victimId = null;
              ufo.abducted = true;
            }
          } else {
            ufo.victimId = null; // victim already dead
          }
        }
        if (ufo.timer <= 0) {
          ufo.phase = 'depart';
          ufo.beamOn = false;
          ufo.timer = 3;
        }
        break;
      case 'depart':
        ufo.y -= 25 * dt;
        ufo.x += 15 * dt;
        // Chance to malfunction and crash!
        if (!ufo.crashChecked && rng.chance(0.35)) {
          ufo.phase = 'crashing';
          ufo.crashVx = rng.float(-15, 15);
          ufo.beamOn = false;
          ufo.crashChecked = true;
          break;
        }
        ufo.crashChecked = true;
        if (ufo.y < -20) {
          events.ufo = null;
        }
        break;
      case 'crashing': {
        // UFO spiraling down, smoking
        ufo.y += 18 * dt;
        ufo.x += ufo.crashVx * dt;
        ufo.crashVx *= 0.98;
        ufo.crashSpin = (ufo.crashSpin || 0) + dt * 8;
        // Smoke particles
        if (!events.crashSmoke) events.crashSmoke = [];
        if (rng.chance(0.5)) {
          events.crashSmoke.push({
            x: ufo.x + rng.float(-3, 3),
            y: ufo.y + rng.float(-2, 2),
            vy: -rng.float(3, 8),
            life: rng.float(0.5, 1.5),
          });
        }
        // Hit ground
        if (ufo.y > waterY - 5) {
          ufo.phase = 'crashed';
          ufo.timer = 0.5;
          ufo.crashX = ufo.x;
          ufo.crashY = waterY - 3;
          events.lightningFlash = 0.8; // impact flash
          // Spawn alien survivor
          if (events.onAlienSurvive) {
            events.onAlienSurvive(ufo.x, waterY - 4, rng);
          }
          // Crash starts a fire
          if (events.onStartFire) {
            events.onStartFire(ufo.x - 3, waterY - 3, rng);
            events.onStartFire(ufo.x + 3, waterY - 4, rng);
          }
        }
        break;
      }
      case 'crashed':
        // Wreckage sits there briefly then fades
        ufo.timer -= dt;
        if (ufo.timer <= 0) {
          events.ufo = null;
        }
        break;
    }
  }

  // Eclipse
  if (events.eclipse) {
    events.eclipse.timer -= dt;
    events.eclipse.progress += dt * 0.1;
    if (events.eclipse.timer <= 0) {
      events.eclipse = null;
    }
  }

  // Flood
  if (events.flood) {
    events.flood.timer -= dt;
    events.flood.progress = Math.sin((1 - events.flood.timer / 15) * Math.PI) * events.flood.intensity;
    if (events.flood.timer <= 0) events.flood = null;
  }

  // Hurricane — push everything sideways
  if (events.hurricane) {
    events.hurricane.timer -= dt;
    if (events.hurricane.timer <= 0) events.hurricane = null;
  }

  // Trigger new events — frequently, this swamp is chaotic
  if (events.eventTimer <= 0) {
    events.eventTimer = rng.float(6, 18);
    triggerRandomEvent(events, world, rng, waterY, simTime, env);
  }

  // Storm lightning — frequent and dramatic during storms
  if (env.weather === 'storm' && rng.chance(0.2 * dt)) {
    spawnLightning(events, rng, waterY, world);
  }

  // Random lightning even outside storms (heat lightning)
  if (rng.chance(0.01 * dt)) {
    spawnLightning(events, rng, waterY, world);
  }
}

function triggerRandomEvent(events, world, rng, waterY, simTime, env) {
  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;

  // Roll multiple times — sometimes multiple things happen at once
  const numRolls = rng.range(1, 3);
  for (let r = 0; r < numRolls; r++) {
    const roll = rng.random();

    if (roll < 0.15 && !events.ufo) {
      // UFO abduction — fairly common in this swamp
      const targetX = rng.float(30, CANVAS_W - 30);
      events.ufo = {
        x: rng.chance(0.5) ? -20 : CANVAS_W + 20,
        y: -10,
        targetX,
        hoverY: Math.max(10, waterY - 30),
        phase: 'approach',
        timer: 5,
        beamOn: false,
        victimId: null,
        lights: [rng.float(0, Math.PI * 2), rng.float(0, Math.PI * 2), rng.float(0, Math.PI * 2)],
      };
    } else if (roll < 0.45) {
      // Lightning strike
      spawnLightning(events, rng, waterY, world);
    } else if (roll < 0.65 && isNight) {
      // Shooting stars — sometimes a burst of them
      const count = rng.range(1, 4);
      for (let s = 0; s < count; s++) {
        events.shootingStars.push({
          x: rng.float(0, CANVAS_W),
          y: rng.float(0, 15),
          vx: rng.float(40, 80) * (rng.chance(0.5) ? 1 : -1),
          vy: rng.float(15, 30),
          life: rng.float(0.5, 1.5),
        });
      }
    } else if (roll < 0.72 && !events.eclipse) {
      // Eclipse
      events.eclipse = {
        timer: rng.float(8, 15),
        progress: 0,
        x: CANVAS_W * 0.5 + rng.float(-30, 30),
        y: rng.float(5, 20),
      };
    } else if (roll < 0.80 && events.onStartFire) {
      // Wildfire — spontaneous combustion in dry season
      events.onStartFire(rng.float(15, CANVAS_W - 15), waterY - rng.range(3, 8), rng);
    } else if (roll < 0.88 && !events.flood) {
      // Flash flood — water rises temporarily
      events.flood = {
        timer: rng.float(8, 15),
        intensity: rng.float(5, 15), // pixels of water rise
        progress: 0,
      };
    } else if (roll < 0.92 && !events.hurricane) {
      // Hurricane — extreme wind, rain, everything moves
      events.hurricane = {
        timer: rng.float(8, 20),
        windSpeed: rng.float(20, 40) * (rng.chance(0.5) ? 1 : -1),
      };
      env.weather = 'storm';
      env.rainIntensity = 1.0;
      env.weatherTimer = 20;
    }
  }
}

function spawnLightning(events, rng, waterY, world) {
  const x = rng.float(10, CANVAS_W - 10);
  const bolt = {
    x,
    segments: [],
    life: 0.3,
  };

  // Generate jagged bolt
  let bx = x;
  let by = 0;
  while (by < waterY + 10) {
    const nextX = bx + rng.float(-5, 5);
    const nextY = by + rng.float(5, 15);
    bolt.segments.push({ x1: bx, y1: by, x2: nextX, y2: nextY });
    bx = nextX;
    by = nextY;
  }

  events.lightningBolts.push(bolt);
  events.lightningFlash = 1;

  // Lightning can kill a gator (rare tragedy)
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (Math.abs(tr.x + (gator.spriteW || 10) / 2 - x) < 6) {
      if (rng.chance(0.15)) {
        gator.health -= 0.5;
        if (gator.health <= 0) {
          world.kill(id);
        }
        break;
      }
    }
  }

  // Lightning can start fires on land
  if (bx < CANVAS_W && events.onStartFire && rng.chance(0.3)) {
    events.onStartFire(bx, waterY - rng.range(2, 6), rng);
  }
}

// --- Render Events ---
export function renderEvents(ctx, events, simTime, waterY) {
  // Lightning bolts
  for (const bolt of events.lightningBolts) {
    const alpha = Math.min(1, bolt.life * 4);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    for (const seg of bolt.segments) {
      // Draw line pixel by pixel
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      for (let s = 0; s <= steps; s++) {
        const px = Math.floor(seg.x1 + (dx * s) / steps);
        const py = Math.floor(seg.y1 + (dy * s) / steps);
        ctx.fillRect(px, py, 1, 1);
        // Glow
        ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.3})`;
        ctx.fillRect(px - 1, py, 1, 1);
        ctx.fillRect(px + 1, py, 1, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      }
    }
  }

  // Lightning flash (screen overlay)
  if (events.lightningFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${events.lightningFlash * 0.3})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Shooting stars
  for (const s of events.shootingStars) {
    const alpha = Math.min(1, s.life * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
    // Trail
    ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.5})`;
    ctx.fillRect(Math.floor(s.x - s.vx * 0.02), Math.floor(s.y - s.vy * 0.02), 1, 1);
    ctx.fillStyle = `rgba(150, 150, 255, ${alpha * 0.3})`;
    ctx.fillRect(Math.floor(s.x - s.vx * 0.04), Math.floor(s.y - s.vy * 0.04), 1, 1);
  }

  // Crash smoke
  if (events.crashSmoke) {
    for (const s of events.crashSmoke) {
      const alpha = Math.min(0.6, s.life);
      ctx.fillStyle = `rgba(80, 80, 80, ${alpha})`;
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 2, 1);
      ctx.fillStyle = `rgba(60, 60, 60, ${alpha * 0.5})`;
      ctx.fillRect(Math.floor(s.x) - 1, Math.floor(s.y) - 1, 3, 1);
    }
  }

  // UFO
  if (events.ufo) {
    const ufo = events.ufo;
    const ux = Math.floor(ufo.x);
    const uy = Math.floor(ufo.y);

    if (ufo.phase === 'crashed') {
      // Crashed wreckage — broken saucer, fire, smoke
      ctx.fillStyle = '#555566';
      ctx.fillRect(ux - 4, uy + 1, 9, 2);
      ctx.fillStyle = '#444455';
      ctx.fillRect(ux - 3, uy, 5, 1);
      // Fire
      const fireFlicker = Math.sin(simTime * 12) > 0;
      ctx.fillStyle = fireFlicker ? '#ff6622' : '#ff4400';
      ctx.fillRect(ux - 1, uy - 1, 2, 1);
      ctx.fillRect(ux, uy - 2, 1, 1);
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(ux + (fireFlicker ? 1 : -1), uy - 1, 1, 1);
      // Sparks
      if (Math.sin(simTime * 20) > 0.7) {
        ctx.fillStyle = '#ffff88';
        ctx.fillRect(ux + Math.floor(Math.sin(simTime * 15) * 3), uy - 1, 1, 1);
      }
    } else {
      // Flying UFO
      if (ufo.phase === 'crashing') {
        // Tilted/spinning saucer
        const tilt = Math.sin(ufo.crashSpin || 0);
        ctx.fillStyle = '#888899';
        ctx.fillRect(ux - 4, uy + 1 + Math.floor(tilt), 9, 2);
        ctx.fillStyle = '#667788';
        ctx.fillRect(ux - 2, uy - 1 + Math.floor(tilt * 0.5), 5, 1);
        // Fire trail
        ctx.fillStyle = '#ff6622';
        ctx.fillRect(ux - 2, uy + 3, 2, 1);
        ctx.fillStyle = '#ffaa33';
        ctx.fillRect(ux + 1, uy + 3, 1, 1);
      } else {
        // Normal UFO body
        ctx.fillStyle = '#888899';
        ctx.fillRect(ux - 4, uy + 1, 9, 2);
        ctx.fillStyle = '#aaaabb';
        ctx.fillRect(ux - 3, uy, 7, 1);
        ctx.fillStyle = '#667788';
        ctx.fillRect(ux - 2, uy - 1, 5, 1);
        // Dome
        ctx.fillStyle = '#99ccdd';
        ctx.fillRect(ux - 1, uy - 2, 3, 1);
        ctx.fillRect(ux, uy - 3, 1, 1);
      }

      // Blinking lights (not when crashed)
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
      for (let l = 0; l < 3; l++) {
        const phase = Math.sin(simTime * 6 + ufo.lights[l]);
        if (phase > 0) {
          ctx.fillStyle = colors[l % colors.length];
          ctx.fillRect(ux - 3 + l * 3, uy + 2, 1, 1);
        }
      }

      // Tractor beam
      if (ufo.beamOn) {
        for (let by = uy + 3; by < waterY + 5; by++) {
          const width = 1 + Math.floor((by - uy) * 0.3);
          const alpha = 0.15 + Math.sin(simTime * 8 + by * 0.3) * 0.05;
          ctx.fillStyle = `rgba(100, 255, 150, ${alpha})`;
          ctx.fillRect(ux - Math.floor(width / 2), by, width, 1);
        }
      }
    }
  }

  // Eclipse
  if (events.eclipse) {
    const e = events.eclipse;
    const progress = Math.sin(e.progress * Math.PI); // 0 -> 1 -> 0
    // Darken sky
    ctx.fillStyle = `rgba(0, 0, 20, ${progress * 0.5})`;
    ctx.fillRect(0, 0, CANVAS_W, waterY);
    // Moon passing over sun
    const sunX = Math.floor(e.x);
    const sunY = Math.floor(e.y);
    // Sun
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(sunX - 2, sunY - 2, 5, 5);
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(sunX - 1, sunY - 1, 3, 3);
    // Moon overlay
    const moonOffset = Math.floor((1 - progress) * 6 - 3);
    ctx.fillStyle = '#111122';
    ctx.fillRect(sunX - 2 + moonOffset, sunY - 2, 5, 5);
    // Corona when near total
    if (progress > 0.7) {
      ctx.fillStyle = `rgba(255, 200, 100, ${(progress - 0.7) * 2})`;
      ctx.fillRect(sunX - 3, sunY, 1, 1);
      ctx.fillRect(sunX + 3, sunY, 1, 1);
      ctx.fillRect(sunX, sunY - 3, 1, 1);
      ctx.fillRect(sunX, sunY + 3, 1, 1);
    }
  }

  // Flood — rising water overlay
  if (events.flood) {
    const rise = Math.floor(events.flood.progress);
    if (rise > 0) {
      ctx.fillStyle = 'rgba(30, 80, 50, 0.4)';
      ctx.fillRect(0, waterY - rise, CANVAS_W, rise);
      ctx.fillStyle = 'rgba(60, 120, 80, 0.3)';
      for (let x = 0; x < CANVAS_W; x++) {
        const wave = Math.sin(x * 0.2 + simTime * 4) * 1.5;
        ctx.fillRect(x, waterY - rise + Math.floor(wave), 1, 1);
      }
    }
  }

  // Hurricane — horizontal rain, chaos
  if (events.hurricane) {
    ctx.fillStyle = 'rgba(150, 170, 200, 0.06)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#8899bb';
    const windDir = events.hurricane.windSpeed > 0 ? 1 : -1;
    for (let d = 0; d < 25; d++) {
      const dx = Math.floor((simTime * Math.abs(events.hurricane.windSpeed) * 3 + d * 37) % CANVAS_W);
      const dy = Math.floor((simTime * 40 + d * 23) % CANVAS_H);
      ctx.fillRect(dx, dy, 3 * windDir, 1);
    }
  }
}
