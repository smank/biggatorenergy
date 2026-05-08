// Dramatic events system — lightning strikes, UFO abductions, celestial events, tragedy

import { CANVAS_W, CANVAS_H } from '../config.js';
import { logDeath, addMoment } from '../game/obituary.js';

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
    tornado: null,
    fog: null,
    bloodMoon: null,
    swampGas: [],
    meteorImpact: null,
    // New events
    gatorBrawl: null,
    meteorShower: null,        // array of streaks
    cropDuster: null,
    plague: null,
    swampGeyser: null,
  };
}

export function updateEvents(events, world, dt, rng, waterY, simTime, env, obituaryState, currentEraId) {
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
          ufo.timer = 5; // longer struggle window
          ufo.struggleProgress = 0; // 0 = ground, 1 = fully abducted
          ufo.beamStrength = rng.float(0.6, 1.2); // UFO tractor beam power
          ufo.shakeIntensity = 0;
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
            ufo.targetX = closest.tr.x;
            ufo.victimStartY = closest.tr.y;
          }
        }
        break;
      case 'abduct': {
        ufo.beamOn = true;
        // Drift over target
        if (ufo.targetX) {
          ufo.x += (ufo.targetX - ufo.x) * dt * 1.5;
        }

        if (ufo.victimId !== null) {
          const victimTr = world.get(ufo.victimId, 'transform');
          const victimGator = world.get(ufo.victimId, 'gator');

          if (!victimTr || !victimGator) {
            ufo.victimId = null;
            ufo.phase = 'depart';
            ufo.beamOn = false;
            ufo.timer = 3;
            break;
          }

          // --- TUG OF WAR ---
          // Gator resistance based on size, strength, aggression
          const gatorSize = victimGator.sizeScale || 1;
          const gatorStage = victimGator.stage;
          const stageWeight = { hatchling: 0.15, juvenile: 0.35, adult: 0.8, elder: 1.5 };
          const weight = (stageWeight[gatorStage] || 1) * gatorSize;
          const aggression = victimGator.traits?.aggression || 0.5;
          const gatorResistance = weight * (0.5 + aggression * 0.5);

          // Beam pulls up, gator resists — each frame is a dice roll
          const pullForce = ufo.beamStrength;
          const resistForce = gatorResistance * rng.float(0.3, 1.2); // luck factor
          const netForce = pullForce - resistForce * 0.5;

          ufo.struggleProgress += netForce * dt * 0.3;
          ufo.struggleProgress = Math.max(0, Math.min(1, ufo.struggleProgress));

          // Visual: gator position interpolated between ground and UFO
          const groundY = ufo.victimStartY || (waterY - 4);
          victimTr.y = groundY + (ufo.y + 5 - groundY) * ufo.struggleProgress;
          victimTr.x += (ufo.x - victimTr.x) * dt * 2 * ufo.struggleProgress;
          victimTr.vx = 0;
          victimTr.vy = 0;

          // Shake intensity increases with struggle
          ufo.shakeIntensity = Math.min(3, ufo.struggleProgress * 4 + (1 - ufo.struggleProgress) * 2);
          // Apply shake to UFO position
          ufo.x += Math.sin(simTime * 20) * ufo.shakeIntensity * 0.3;
          ufo.y += Math.cos(simTime * 25) * ufo.shakeIntensity * 0.2;

          // === OUTCOME CHECK ===
          if (ufo.struggleProgress >= 1) {
            // ABDUCTION SUCCESS — gator taken
            if (obituaryState) {
              const victim = world.get(ufo.victimId, 'gator');
              logDeath(obituaryState, { gator: victim, cause: 'ufo', time: simTime });
            }
            world.kill(ufo.victimId);
            ufo.victimId = null;
            ufo.abducted = true;
            ufo.phase = 'depart';
            ufo.beamOn = false;
            ufo.timer = 3;
          } else if (ufo.struggleProgress <= 0 && ufo.timer < 3) {
            // GATOR WINS — breaks free! UFO loses grip
            victimTr.y = groundY;
            victimTr.vy = 0;
            // Gator is angry and energized
            victimGator.state = 'idle';
            victimGator.stateTimer = 2;
            victimGator.energy = Math.min(1, victimGator.energy + 0.3);
            ufo.victimId = null;
            // UFO might crash from the strain
            if (rng.chance(0.4)) {
              ufo.phase = 'crashing';
              ufo.crashVx = rng.float(-15, 15);
              ufo.beamOn = false;
            } else {
              ufo.phase = 'depart';
              ufo.beamOn = false;
              ufo.timer = 3;
            }
          }
        } else {
          // No victim, just leave
          ufo.phase = 'depart';
          ufo.beamOn = false;
          ufo.timer = 3;
        }

        ufo.timer -= dt;
        if (ufo.timer <= 0) {
          // Time's up — whatever state we're in, resolve it
          if (ufo.victimId !== null) {
            const victimTr = world.get(ufo.victimId, 'transform');
            if (victimTr) {
              if (ufo.struggleProgress > 0.45) {
                // Close enough — abduction succeeds at the last moment
                if (obituaryState) {
                  const victim = world.get(ufo.victimId, 'gator');
                  logDeath(obituaryState, { gator: victim, cause: 'ufo', time: simTime });
                }
                world.kill(ufo.victimId);
                ufo.abducted = true;
              } else {
                // Gator drops back down
                victimTr.y = ufo.victimStartY || (waterY - 4);
                victimTr.vy = 5; // falls
              }
            }
            ufo.victimId = null;
          }
          ufo.phase = 'depart';
          ufo.beamOn = false;
          ufo.timer = 3;
        }
        break;
      }
      case 'depart':
        ufo.y -= 25 * dt;
        ufo.x += 15 * dt;
        // Chance to malfunction and crash — only if abduction failed (no payload)
        if (!ufo.crashChecked) {
          const crashChance = ufo.abducted ? 0 : 0.35;
          if (rng.chance(crashChance)) {
            ufo.phase = 'crashing';
            ufo.crashVx = rng.float(-15, 15);
            ufo.beamOn = false;
          }
          ufo.crashChecked = true;
          if (ufo.phase === 'crashing') break;
        }
        if (ufo.y < -20) {
          events.ufo = null;
        }
        break;
      case 'crashing': {
        // UFO spiraling down, smoking — slow dramatic descent
        ufo.y += 10 * dt;
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
          ufo.timer = 15; // wreckage stays visible while aliens crawl out
          ufo.crashX = Math.max(15, Math.min(CANVAS_W - 15, ufo.x));
          ufo.crashY = waterY - 3;
          ufo.x = ufo.crashX; // snap wreckage on screen
          events.lightningFlash = 0.8; // impact flash
          if (events.onExplosion) events.onExplosion();
          // Aliens will crawl out during the 'crashed' phase
          ufo.aliensToSpawn = rng.range(1, 3);
          ufo.alienSpawnTimer = rng.float(1.5, 3); // delay before first one emerges
          // Crash starts a fire
          if (events.onStartFire) {
            events.onStartFire(ufo.x - 3, waterY - 3, rng);
            events.onStartFire(ufo.x + 3, waterY - 4, rng);
          }
        }
        break;
      }
      case 'crashed':
        ufo.timer -= dt;
        // Aliens crawl out of the wreckage one at a time
        if (ufo.aliensToSpawn > 0) {
          ufo.alienSpawnTimer -= dt;
          if (ufo.alienSpawnTimer <= 0) {
            if (events.onAlienSurvive) {
              events.onAlienSurvive(ufo.crashX, ufo.crashY, rng);
            }
            ufo.aliensToSpawn--;
            ufo.alienSpawnTimer = rng.float(1, 2.5); // stagger each survivor
          }
        }
        if (ufo.timer <= 0) {
          events.ufo = null;
        }
        break;
    }
  }

  // Eclipse — suppress normal sun rendering while active
  env._eclipseActive = !!events.eclipse;
  if (events.eclipse) {
    const ecl = events.eclipse;
    ecl.timer -= dt;
    const totalDur = ecl.totalDuration || 20;
    const elapsed = totalDur - ecl.timer;
    // Slow ramp up, hold near totality, ramp out
    ecl.progress = Math.min(1, elapsed / (totalDur * 0.45));
    ecl._tod = env.timeOfDay; // track sun position for rendering
    // Mid-eclipse: wildlife pauses for 5s and orients to the sky
    const midPoint = totalDur * 0.5;
    if (!ecl.wildlifePaused && elapsed >= midPoint - 2.5 && elapsed <= midPoint + 2.5) {
      ecl.wildlifePaused = true;
      ecl.wildlifePauseTimer = 5;
      if (events.onEclipsePause) events.onEclipsePause();
    }
    if (ecl.wildlifePaused) {
      ecl.wildlifePauseTimer -= dt;
      if (ecl.wildlifePauseTimer <= 0) ecl.wildlifePaused = false;
    }
    // Stars become visible during totality
    ecl._showStars = ecl.progress > 0.6 && ecl.timer > totalDur * 0.1;
    if (ecl.timer <= 0) {
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

  // Tornado — moves across screen with debris
  if (events.tornado) {
    const t = events.tornado;
    t.x += t.speed * dt;
    t.timer -= dt;
    const suckRange = 30;

    // Spawn debris particles
    if (rng.chance(0.4)) {
      t.debris.push({
        x: t.x + rng.float(-4, 4),
        y: t.y + rng.float(-20, 5),
        vx: rng.float(-15, 15),
        vy: rng.float(-10, 5),
        life: rng.float(0.3, 1.0),
      });
    }
    // Update debris
    for (let i = t.debris.length - 1; i >= 0; i--) {
      const d = t.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) t.debris.splice(i, 1);
    }

    // Suck in and damage gators
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      const dist = Math.abs(tr.x + (gator.spriteW || 10) / 2 - t.x);
      if (dist < suckRange) {
        // Pull toward center
        const pull = (1 - dist / suckRange) * 40;
        tr.vx += Math.sign(t.x - tr.x) * pull * dt;
        tr.vy -= pull * 0.5 * dt; // lift upward
        // Damage if very close
        if (dist < 8) {
          gator.health -= dt * 0.3;
          // Fling gator upward if caught
          tr.vy = -20;
          tr.vx = rng.float(-15, 15);
          if (gator.health <= 0) {
            if (obituaryState) logDeath(obituaryState, { gator, cause: 'tornado', time: simTime });
            world.kill(id);
          }
        }
      }
    }

    // Suck in wildlife — callback to main.js
    if (events.onTornadoPull) {
      events.onTornadoPull(t.x, t.y, suckRange, dt, rng);
    }

    if (t.timer <= 0 || t.x < -20 || t.x > CANVAS_W + 20) {
      events.tornado = null;
    }
  }

  // Fog — ramp up, hold, fade out
  if (events.fog) {
    events.fog.timer -= dt;
    const total = events.fog.totalDuration;
    const elapsed = total - events.fog.timer;
    const rampUp = total * 0.2;
    const rampDown = total * 0.2;
    if (elapsed < rampUp) {
      events.fog.opacity = (elapsed / rampUp) * events.fog.maxOpacity;
    } else if (events.fog.timer < rampDown) {
      events.fog.opacity = (events.fog.timer / rampDown) * events.fog.maxOpacity;
    } else {
      events.fog.opacity = events.fog.maxOpacity;
    }
    if (events.fog.timer <= 0) events.fog = null;
  }

  // Blood Moon — tint decays with timer
  if (events.bloodMoon) {
    events.bloodMoon.timer -= dt;
    if (events.bloodMoon.timer <= 0) events.bloodMoon = null;
  }

  // Swamp Gas — ambient pulsing green orbs near water surface
  if (rng.chance(0.08 * dt)) {
    events.swampGas.push({
      x: rng.float(5, CANVAS_W - 5),
      y: waterY + rng.float(-6, 2),
      life: rng.float(2, 5),
      maxLife: 0, // set below
      radius: rng.float(1, 2.5),
      phase: rng.float(0, Math.PI * 2),
      driftX: rng.float(-3, 3),
      driftY: rng.float(-4, -1),
    });
    events.swampGas[events.swampGas.length - 1].maxLife = events.swampGas[events.swampGas.length - 1].life;
  }
  for (let i = events.swampGas.length - 1; i >= 0; i--) {
    const g = events.swampGas[i];
    g.x += g.driftX * dt;
    g.y += g.driftY * dt;
    g.life -= dt;
    if (g.life <= 0) events.swampGas.splice(i, 1);
  }

  // Meteor Impact — falling then impact
  if (events.meteorImpact) {
    const m = events.meteorImpact;
    if (m.phase === 'falling') {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      // Spawn trail particles
      if (rng.chance(0.6)) {
        m.trail.push({
          x: m.x + rng.float(-1, 1),
          y: m.y + rng.float(-1, 1),
          life: rng.float(0.2, 0.6),
        });
      }
      if (m.y >= waterY - 2) {
        m.phase = 'impact';
        m.impactX = m.x;
        m.impactY = waterY - 2;
        m.timer = 3;
        events.lightningFlash = 1.0;
        // Spawn fire at impact
        if (events.onStartFire) {
          events.onStartFire(m.x, waterY - 3, rng);
          events.onStartFire(m.x - 4, waterY - 2, rng);
          events.onStartFire(m.x + 4, waterY - 2, rng);
        }
        // Spawn crater debris
        m.craterDebris = [];
        for (let c = 0; c < 12; c++) {
          m.craterDebris.push({
            x: m.x + rng.float(-2, 2),
            y: waterY - 2,
            vx: rng.float(-25, 25),
            vy: rng.float(-30, -5),
            life: rng.float(0.5, 1.5),
          });
        }
      }
    } else if (m.phase === 'impact') {
      m.timer -= dt;
      // Update trail decay
      for (let i = m.trail.length - 1; i >= 0; i--) {
        m.trail[i].life -= dt;
        if (m.trail[i].life <= 0) m.trail.splice(i, 1);
      }
      // Update crater debris
      if (m.craterDebris) {
        for (let i = m.craterDebris.length - 1; i >= 0; i--) {
          const d = m.craterDebris[i];
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.vy += 40 * dt; // gravity
          d.life -= dt;
          if (d.life <= 0) m.craterDebris.splice(i, 1);
        }
      }
      if (m.timer <= 0) events.meteorImpact = null;
    }
    // Decay trail particles even during falling
    if (events.meteorImpact && m.phase === 'falling') {
      for (let i = m.trail.length - 1; i >= 0; i--) {
        m.trail[i].life -= dt;
        if (m.trail[i].life <= 0) m.trail.splice(i, 1);
      }
    }
  }

  // ---- GATOR BRAWL ----
  const isDay = env.timeOfDay >= 0.2 && env.timeOfDay <= 0.8;
  if (!events.gatorBrawl && rng.chance((isDay ? 0.001 : 0.0002) * dt)) {
    // Pick two AI (non-player) gators
    const candidates = [];
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (gator.stage === 'egg' || gator.stage === 'hatchling') continue;
      if (gator.isPlayer) continue;
      candidates.push({ id, tr, gator });
    }
    if (candidates.length >= 2) {
      const shuffled = candidates.sort(() => rng.random() - 0.5);
      const a = shuffled[0];
      const b = shuffled[1];
      events.gatorBrawl = {
        idA: a.id,
        idB: b.id,
        phase: 'charge',   // charge → fight → flee
        timer: 5,
        winner: null,
        splashTimer: 0,
        splashParticles: [],
        startAX: a.tr.x,
        startBX: b.tr.x,
        announced: false,
      };
    }
  }
  if (events.gatorBrawl) {
    const brawl = events.gatorBrawl;
    const trA = world.get(brawl.idA, 'transform');
    const trB = world.get(brawl.idB, 'transform');
    const gA = world.get(brawl.idA, 'gator');
    const gB = world.get(brawl.idB, 'gator');

    // Announce on first tick
    if (!brawl.announced && obituaryState) {
      addMoment(obituaryState, { text: 'two strangers come to blows.', x: null, y: null, color: '#e8c060' });
      brawl.announced = true;
    }

    if (!trA || !trB || !gA || !gB) {
      events.gatorBrawl = null;
    } else {
      brawl.timer -= dt;
      if (brawl.phase === 'charge') {
        // Rush toward each other
        const midX = (trA.x + trB.x) * 0.5;
        trA.vx += Math.sign(midX - trA.x) * 30 * dt;
        trB.vx += Math.sign(midX - trB.x) * 30 * dt;
        trA.vx = Math.min(Math.max(trA.vx, -20), 20);
        trB.vx = Math.min(Math.max(trB.vx, -20), 20);
        const dist = Math.abs(trA.x - trB.x);
        if (dist < 8 || brawl.timer < 3.5) {
          brawl.phase = 'fight';
          brawl.timer = rng.float(3, 6);
          brawl.winner = rng.chance(0.5) ? 'A' : 'B';
        }
      } else if (brawl.phase === 'fight') {
        // Shake and splash
        trA.vx = Math.sin(simTime * 18) * 4;
        trB.vx = -Math.sin(simTime * 18) * 4;
        trA.vy = Math.cos(simTime * 22) * 1.5;
        trB.vy = -Math.cos(simTime * 22) * 1.5;
        brawl.splashTimer -= dt;
        if (brawl.splashTimer <= 0) {
          brawl.splashTimer = rng.float(0.1, 0.3);
          const sx = (trA.x + trB.x) * 0.5 + rng.float(-3, 3);
          brawl.splashParticles.push({ x: sx, y: waterY - 1, vx: rng.float(-8, 8), vy: rng.float(-10, -3), life: rng.float(0.3, 0.7) });
          if (events.onSplash) events.onSplash();
        }
        if (brawl.timer <= 0) {
          brawl.phase = 'flee';
          brawl.timer = 2;
          // Loser takes minor damage
          const loserGator = brawl.winner === 'A' ? gB : gA;
          loserGator.health = Math.max(0.1, (loserGator.health || 1) - 0.2);
        }
      } else if (brawl.phase === 'flee') {
        // Loser flees
        const loserTr = brawl.winner === 'A' ? trB : trA;
        const loserG  = brawl.winner === 'A' ? gB  : gA;
        loserTr.vx += Math.sign(loserTr.x - (brawl.winner === 'A' ? trA.x : trB.x)) * 20 * dt;
        loserG.state = 'idle';
        loserG.stateTimer = 3;
        if (brawl.timer <= 0) events.gatorBrawl = null;
      }
      // Update splash particles
      for (let i = brawl.splashParticles.length - 1; i >= 0; i--) {
        const sp = brawl.splashParticles[i];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.vy += 20 * dt;
        sp.life -= dt;
        if (sp.life <= 0) brawl.splashParticles.splice(i, 1);
      }
    }
  }

  // ---- METEOR SHOWER ----
  const isNightForMeteors = env.timeOfDay > 0.75 || env.timeOfDay < 0.2;
  if (!events.meteorShower && isNightForMeteors && rng.chance(0.0005 * dt)) {
    if (obituaryState) addMoment(obituaryState, { text: 'stars fall.', x: null, y: null, color: '#ddeeff' });
    const count = rng.range(5, 11);
    events.meteorShower = { streaks: [], impactScheduled: rng.chance(0.4), timer: 5 };
    for (let s = 0; s < count; s++) {
      const spawnDelay = rng.float(0, 3);
      events.meteorShower.streaks.push({
        x: rng.float(-20, CANVAS_W + 20),
        y: rng.float(-5, 10),
        vx: rng.float(25, 60) * (rng.chance(0.5) ? 1 : -1),
        vy: rng.float(20, 45),
        life: rng.float(0.6, 1.5),
        maxLife: 0,
        delay: spawnDelay,
      });
      events.meteorShower.streaks[events.meteorShower.streaks.length - 1].maxLife =
        events.meteorShower.streaks[events.meteorShower.streaks.length - 1].life;
    }
  }
  if (events.meteorShower) {
    const ms = events.meteorShower;
    ms.timer -= dt;
    let anyAlive = false;
    for (const s of ms.streaks) {
      if (s.delay > 0) { s.delay -= dt; anyAlive = true; continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life > 0) anyAlive = true;
    }
    // Optional impact flash at end
    if (ms.impactScheduled && ms.timer <= 0 && !ms.impactDone) {
      ms.impactDone = true;
      events.lightningFlash = 0.4;
      const ix = rng.float(20, CANVAS_W - 20);
      if (events.onStartFire && rng.chance(0.3)) events.onStartFire(ix, waterY - rng.range(2, 5), rng);
    }
    if (!anyAlive && ms.timer <= 0) events.meteorShower = null;
  }

  // ---- CROP DUSTER ----
  const isIndustrialEra = (currentEraId || 1) >= 2;
  if (!events.cropDuster && isIndustrialEra && isDay && rng.chance(0.0003 * dt)) {
    const fromLeft = rng.chance(0.5);
    if (obituaryState) addMoment(obituaryState, { text: 'a man flies overhead.', x: null, y: null, color: '#c8b88a' });
    events.cropDuster = {
      x: fromLeft ? -20 : CANVAS_W + 20,
      y: waterY - rng.float(18, 30),
      vx: (fromLeft ? 1 : -1) * rng.float(25, 40),
      timer: 7,
      puffs: [],
      puffTimer: 0,
    };
  }
  if (events.cropDuster) {
    const cd = events.cropDuster;
    cd.x += cd.vx * dt;
    cd.timer -= dt;
    cd.puffTimer -= dt;
    if (cd.puffTimer <= 0) {
      cd.puffTimer = rng.float(0.08, 0.18);
      cd.puffs.push({
        x: cd.x - Math.sign(cd.vx) * 4,
        y: cd.y + 2,
        vx: -Math.sign(cd.vx) * rng.float(0.5, 2),
        vy: rng.float(-1, 2),
        life: rng.float(1.5, 3),
        maxLife: 0,
      });
      cd.puffs[cd.puffs.length - 1].maxLife = cd.puffs[cd.puffs.length - 1].life;
    }
    // Update puffs
    for (let i = cd.puffs.length - 1; i >= 0; i--) {
      const p = cd.puffs[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) cd.puffs.splice(i, 1);
    }
    // Scare nearby wildlife via callback
    if (events.onCropDusterPass) events.onCropDusterPass(cd.x, cd.y, dt, rng);
    // Done when off screen
    if (cd.timer <= 0 || cd.x < -40 || cd.x > CANVAS_W + 40) events.cropDuster = null;
  }

  // ---- PLAGUE ----
  if (!events.plague && rng.chance(0.00015 * dt)) {
    // Find a random wildlife victim to start the spread
    const allGators = [];
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (gator.stage !== 'egg') allGators.push({ id, tr, gator });
    }
    if (allGators.length > 0) {
      const victim = rng.pick(allGators);
      if (!victim.gator.sick) {
        victim.gator.sick = true;
        victim.gator.sickTimer = rng.float(30, 60);
        if (obituaryState) addMoment(obituaryState, { text: 'a sickness moves through the swamp.', x: null, y: null, color: '#88bb55' });
        events.plague = { active: true, drips: [], spreadTimer: rng.float(8, 15) };
      }
    }
  }
  if (events.plague) {
    const plague = events.plague;
    plague.spreadTimer -= dt;
    let anySick = false;

    // Spread to nearby gators
    if (plague.spreadTimer <= 0) {
      plague.spreadTimer = rng.float(8, 15);
      const sickGators = [];
      const healthyGators = [];
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        if (gator.stage === 'egg') continue;
        if (gator.sick) sickGators.push({ id, tr, gator });
        else healthyGators.push({ id, tr, gator });
      }
      for (const sg of sickGators) {
        for (const hg of healthyGators) {
          if (Math.abs(sg.tr.x - hg.tr.x) < 20 && rng.chance(0.35)) {
            hg.gator.sick = true;
            hg.gator.sickTimer = rng.float(30, 60);
            break;
          }
        }
      }
    }

    // Tick sick gators — slow movement, damage over time, drip particles
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (!gator.sick) continue;
      anySick = true;
      gator.sickTimer -= dt;
      // Slow them down
      tr.vx *= Math.pow(0.95, dt * 10);
      // Occasional damage
      if (rng.chance(0.02 * dt)) {
        gator.health = Math.max(0, (gator.health || 1) - 0.03);
        if (gator.health <= 0) {
          if (obituaryState) logDeath(obituaryState, { gator, cause: 'plague', time: simTime });
          world.kill(id);
        }
      }
      // Spawn drip particle
      if (rng.chance(0.8 * dt)) {
        plague.drips.push({
          x: tr.x + rng.float(-3, 3),
          y: tr.y - 6,
          vy: rng.float(4, 8),
          life: rng.float(0.4, 1),
        });
      }
      // Recovery
      if (gator.sickTimer <= 0 && rng.chance(0.3 * dt)) {
        gator.sick = false;
        delete gator.sickTimer;
      }
    }
    // Update drips
    for (let i = plague.drips.length - 1; i >= 0; i--) {
      const d = plague.drips[i];
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) plague.drips.splice(i, 1);
    }
    if (!anySick) {
      if (obituaryState) addMoment(obituaryState, { text: 'the sickness has passed.', x: null, y: null, color: '#aaddaa' });
      events.plague = null;
    }
  }

  // ---- SWAMP GAS GEYSER ----
  if (!events.swampGeyser && rng.chance(0.001 * dt)) {
    const geyserX = rng.float(10, CANVAS_W - 10);
    if (obituaryState) addMoment(obituaryState, { text: 'the swamp coughs.', x: null, y: null, color: '#88cc66' });
    events.swampGeyser = {
      x: geyserX,
      y: waterY - 1,
      timer: rng.float(3, 5),
      particles: [],
      particleTimer: 0,
      ignited: false,
    };
    // Check for nearby fire — ignite if close
    if (events.onCheckNearbyFire) {
      const nearFire = events.onCheckNearbyFire(geyserX, waterY, 18);
      if (nearFire) {
        events.swampGeyser.ignited = true;
        events.lightningFlash = 0.5;
        if (events.onExplosion) events.onExplosion();
      }
    }
    // Scare wildlife near geyser
    if (events.onGeyserScare) events.onGeyserScare(geyserX, waterY, 25);
  }
  if (events.swampGeyser) {
    const gy = events.swampGeyser;
    gy.timer -= dt;
    gy.particleTimer -= dt;
    if (gy.particleTimer <= 0) {
      gy.particleTimer = rng.float(0.04, 0.1);
      const ignited = gy.ignited;
      gy.particles.push({
        x: gy.x + rng.float(-3, 3),
        y: gy.y,
        vx: rng.float(-4, 4),
        vy: -rng.float(8, 18),
        life: rng.float(0.4, 1.2),
        maxLife: 0,
        ignited,
      });
      gy.particles[gy.particles.length - 1].maxLife = gy.particles[gy.particles.length - 1].life;
    }
    for (let i = gy.particles.length - 1; i >= 0; i--) {
      const p = gy.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.9, dt * 10);
      p.vy *= Math.pow(0.95, dt * 10);
      p.life -= dt;
      if (p.life <= 0) gy.particles.splice(i, 1);
    }
    if (gy.timer <= 0) events.swampGeyser = null;
  }

  // Trigger new events — frequently, this swamp is chaotic
  if (events.eventTimer <= 0) {
    events.eventTimer = rng.float(15, 40);
    triggerRandomEvent(events, world, rng, waterY, simTime, env, obituaryState, currentEraId);
  }

  // Storm lightning — frequent and dramatic during storms
  if (env.weather === 'storm' && rng.chance(0.2 * dt)) {
    spawnLightning(events, rng, waterY, world, obituaryState, simTime);
  }

  // Random lightning even outside storms (heat lightning)
  if (rng.chance(0.01 * dt)) {
    spawnLightning(events, rng, waterY, world, obituaryState, simTime);
  }
}

function triggerRandomEvent(events, world, rng, waterY, simTime, env, obituaryState, currentEraId) {
  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;

  const roll = rng.random();

  {
    if (roll < 0.04 && !events.ufo) {
      // UFO — rare and memorable
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
    } else if (roll < 0.20) {
      // Lightning strike (heat lightning)
      spawnLightning(events, rng, waterY, world, obituaryState, simTime);
    } else if (roll < 0.40 && isNight) {
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
    } else if (roll < 0.42 && !events.eclipse) {
      // Enhanced Eclipse — longer, more dramatic, stars visible, wildlife pauses
      const duration = rng.float(18, 28);
      events.eclipse = {
        timer: duration,
        totalDuration: duration,
        progress: 0,
        x: CANVAS_W * 0.5 + rng.float(-30, 30),
        y: rng.float(5, 20),
        wildlifePaused: false,
        wildlifePauseTimer: 0,
        announced: false,
      };
    } else if (roll < 0.52 && events.onStartFire) {
      // Wildfire — spontaneous combustion in dry season
      events.onStartFire(rng.float(15, CANVAS_W - 15), waterY - rng.range(3, 8), rng);
    } else if (roll < 0.62 && !events.flood) {
      // Flash flood — water rises temporarily
      events.flood = {
        timer: rng.float(8, 15),
        intensity: rng.float(5, 15), // pixels of water rise
        progress: 0,
        currentDir: rng.chance(0.5) ? 1 : -1,
        currentSpeed: rng.float(8, 15),
      };
    } else if (roll < 0.70 && !events.hurricane) {
      // Hurricane — extreme wind, rain, everything moves
      events.hurricane = {
        timer: rng.float(8, 20),
        windSpeed: rng.float(20, 40) * (rng.chance(0.5) ? 1 : -1),
      };
      env.weather = 'storm';
      env.rainIntensity = 1.0;
      env.weatherTimer = 20;
    } else if (roll < 0.76 && !events.tornado) {
      // Tornado — rare, devastating funnel crossing the screen
      events.tornado = {
        x: rng.chance(0.5) ? -10 : CANVAS_W + 10,
        y: waterY - 10,
        width: 6,
        speed: rng.float(8, 15) * (rng.chance(0.5) ? 1 : -1),
        timer: rng.float(10, 20),
        debris: [],
      };
    } else if (roll < 0.85 && !events.fog) {
      // Fog — thick swamp fog rolls in
      const duration = rng.float(10, 25);
      events.fog = {
        timer: duration,
        totalDuration: duration,
        maxOpacity: rng.float(0.3, 0.6),
        opacity: 0,
      };
    } else if (roll < 0.94 && isNight && !events.bloodMoon) {
      // Blood Moon — eerie red tint across the swamp
      events.bloodMoon = {
        timer: rng.float(10, 20),
        intensity: rng.float(0.15, 0.35),
      };
    } else if (roll < 0.97 && !events.meteorImpact) {
      // Meteor Impact — extremely rare, a fireball from the sky
      const targetX = rng.float(30, CANVAS_W - 30);
      events.meteorImpact = {
        x: targetX + rng.float(-40, 40),
        y: -5,
        vx: rng.float(-10, 10),
        vy: rng.float(25, 45),
        phase: 'falling',
        trail: [],
        timer: 0,
        impactX: 0,
        impactY: 0,
        craterDebris: [],
      };
    }
    // roll 0.97–1.0 falls through (no-op — keeps swamp quiet)
  }
  // end triggerRandomEvent
}

function spawnLightning(events, rng, waterY, world, obituaryState, simTime) {
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
  if (events.onThunder) events.onThunder();

  // Lightning can kill a gator (rare tragedy)
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (Math.abs(tr.x + (gator.spriteW || 10) / 2 - x) < 6) {
      if (rng.chance(0.15)) {
        gator.health -= 0.5;
        if (gator.health <= 0) {
          if (obituaryState) logDeath(obituaryState, { gator, cause: 'lightning', time: simTime });
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

  // Lightning can strike and ignite a tree
  if (events.onLightningStrikeTree && rng.chance(0.25)) {
    events.onLightningStrikeTree(x, rng);
  }
}

// --- Render Events ---
export function renderEvents(ctx, events, simTime, waterY) {
  // Gator Brawl — splash particles
  if (events.gatorBrawl && events.gatorBrawl.phase !== 'flee') {
    const brawl = events.gatorBrawl;
    for (const sp of brawl.splashParticles) {
      const alpha = Math.min(1, sp.life * 3);
      ctx.fillStyle = `rgba(120, 200, 160, ${alpha})`;
      ctx.fillRect(Math.floor(sp.x), Math.floor(sp.y), 1, 1);
    }
    // Brawl indicator — small impact stars during fight phase
    if (brawl.phase === 'fight' && brawl.idA !== null) {
      const flashOn = Math.sin(simTime * 20) > 0;
      if (flashOn) {
        // We don't have gator positions here — splash center approximation via particles
        if (brawl.splashParticles.length > 0) {
          const sp0 = brawl.splashParticles[0];
          ctx.fillStyle = `rgba(255, 220, 80, 0.7)`;
          ctx.fillRect(Math.floor(sp0.x) - 1, Math.floor(sp0.y) - 3, 1, 1);
          ctx.fillRect(Math.floor(sp0.x) + 1, Math.floor(sp0.y) - 3, 1, 1);
        }
      }
    }
  }

  // Meteor Shower — diagonal streaks
  if (events.meteorShower) {
    for (const s of events.meteorShower.streaks) {
      if (s.delay > 0) continue;
      if (s.life <= 0) continue;
      const alpha = Math.min(1, (s.life / s.maxLife) * 2);
      const sx = Math.floor(s.x);
      const sy = Math.floor(s.y);
      // Head — bright white-yellow
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
      ctx.fillRect(sx, sy, 1, 1);
      // Trail — 3-pixel fading
      const norm = Math.sqrt(s.vx * s.vx + s.vy * s.vy) || 1;
      const tx1 = sx - Math.round(s.vx / norm * 2);
      const ty1 = sy - Math.round(s.vy / norm * 2);
      const tx2 = sx - Math.round(s.vx / norm * 4);
      const ty2 = sy - Math.round(s.vy / norm * 4);
      ctx.fillStyle = `rgba(255, 230, 150, ${alpha * 0.6})`;
      ctx.fillRect(tx1, ty1, 1, 1);
      ctx.fillStyle = `rgba(255, 200, 100, ${alpha * 0.3})`;
      ctx.fillRect(tx2, ty2, 1, 1);
    }
  }

  // Crop Duster — biplane silhouette + pesticide puffs
  if (events.cropDuster) {
    const cd = events.cropDuster;
    const cx = Math.floor(cd.x);
    const cy = Math.floor(cd.y);
    const facingRight = cd.vx > 0;
    // Fuselage
    ctx.fillStyle = '#444444';
    ctx.fillRect(cx - 5, cy, 11, 3);
    // Wing
    ctx.fillStyle = '#333333';
    ctx.fillRect(cx - 7, cy + 1, 15, 1);
    // Tail fin
    ctx.fillStyle = '#555555';
    ctx.fillRect(facingRight ? cx - 5 : cx + 3, cy - 2, 2, 2);
    // Propeller (flicker)
    ctx.fillStyle = '#666666';
    const propSide = facingRight ? cx + 6 : cx - 7;
    if (Math.sin(simTime * 30) > 0) {
      ctx.fillRect(propSide, cy - 2, 1, 5);
    } else {
      ctx.fillRect(propSide - 2, cy + 1, 5, 1);
    }
    // Pesticide puffs
    for (const p of cd.puffs) {
      const frac = p.life / p.maxLife;
      const alpha = frac * 0.45;
      const r = Math.floor(2 + (1 - frac) * 4);
      ctx.fillStyle = `rgba(180, 220, 140, ${alpha})`;
      ctx.fillRect(Math.floor(p.x) - r, Math.floor(p.y) - r, r * 2 + 1, r * 2 + 1);
      ctx.fillStyle = `rgba(200, 240, 160, ${alpha * 0.5})`;
      ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, 3, 3);
    }
  }

  // Plague — green drip particles above sick gators
  if (events.plague) {
    for (const d of events.plague.drips) {
      const alpha = Math.min(1, d.life * 2);
      ctx.fillStyle = `rgba(100, 200, 80, ${alpha})`;
      ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 1, 2);
    }
  }

  // Swamp Gas Geyser — erupting green plume
  if (events.swampGeyser) {
    const gy = events.swampGeyser;
    for (const p of gy.particles) {
      const frac = p.life / p.maxLife;
      const alpha = frac * 0.7;
      if (p.ignited) {
        // Fire colors
        ctx.fillStyle = `rgba(255, ${Math.floor(80 + frac * 120)}, 20, ${alpha})`;
      } else {
        // Green gas
        ctx.fillStyle = `rgba(${Math.floor(60 + frac * 60)}, 200, 60, ${alpha})`;
      }
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
      // Outer glow
      ctx.fillStyle = p.ignited
        ? `rgba(255, 150, 30, ${alpha * 0.25})`
        : `rgba(80, 255, 80, ${alpha * 0.2})`;
      ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, 4, 4);
    }
    // Ground burst indicator
    const burstPulse = 0.5 + 0.5 * Math.sin(simTime * 12);
    ctx.fillStyle = gy.ignited
      ? `rgba(255, 140, 20, ${burstPulse * 0.5})`
      : `rgba(80, 220, 60, ${burstPulse * 0.4})`;
    ctx.fillRect(Math.floor(gy.x) - 2, Math.floor(gy.y), 5, 2);
  }

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

  // Tornado — dark funnel narrowing toward the bottom
  if (events.tornado) {
    const t = events.tornado;
    const tx = Math.floor(t.x);
    const topY = Math.max(0, t.y - 30);
    const botY = Math.floor(t.y + 5);
    for (let py = topY; py <= botY; py++) {
      const frac = (py - topY) / Math.max(1, botY - topY);
      const halfW = Math.max(1, Math.floor(t.width * (1 - frac * 0.7) * 0.5));
      const wobble = Math.floor(Math.sin(py * 0.5 + simTime * 6) * 1.5);
      const alpha = 0.5 + frac * 0.3;
      ctx.fillStyle = `rgba(68, 68, 68, ${alpha})`;
      ctx.fillRect(tx - halfW + wobble, py, halfW * 2, 1);
      // Inner darker core
      if (halfW > 1) {
        ctx.fillStyle = `rgba(34, 34, 34, ${alpha * 0.7})`;
        ctx.fillRect(tx - Math.floor(halfW * 0.4) + wobble, py, Math.max(1, Math.floor(halfW * 0.8)), 1);
      }
    }
    // Debris particles
    for (const d of t.debris) {
      const alpha = Math.min(1, d.life * 3);
      ctx.fillStyle = `rgba(80, 60, 40, ${alpha})`;
      ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 1, 1);
    }
  }

  // Swamp Gas — pulsing green orbs near water
  for (const g of events.swampGas) {
    const lifeFrac = g.life / g.maxLife;
    const pulse = 0.5 + 0.5 * Math.sin(simTime * 4 + g.phase);
    const alpha = lifeFrac * pulse * 0.6;
    const gx = Math.floor(g.x);
    const gy = Math.floor(g.y);
    // Outer glow
    ctx.fillStyle = `rgba(80, 255, 80, ${alpha * 0.2})`;
    ctx.fillRect(gx - 2, gy - 2, 5, 5);
    // Mid glow
    ctx.fillStyle = `rgba(100, 255, 100, ${alpha * 0.4})`;
    ctx.fillRect(gx - 1, gy - 1, 3, 3);
    // Core
    ctx.fillStyle = `rgba(150, 255, 150, ${alpha})`;
    ctx.fillRect(gx, gy, 1, 1);
  }

  // Meteor Impact
  if (events.meteorImpact) {
    const m = events.meteorImpact;
    if (m.phase === 'falling') {
      // Fireball
      const mx = Math.floor(m.x);
      const my = Math.floor(m.y);
      ctx.fillStyle = '#ff4400';
      ctx.fillRect(mx - 1, my - 1, 3, 3);
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(mx, my, 1, 1);
      // Trail
      for (const tp of m.trail) {
        const alpha = Math.min(1, tp.life * 3);
        ctx.fillStyle = `rgba(255, 100, 30, ${alpha})`;
        ctx.fillRect(Math.floor(tp.x), Math.floor(tp.y), 1, 1);
      }
    } else if (m.phase === 'impact') {
      // Crater
      const cx = Math.floor(m.impactX);
      const cy = Math.floor(m.impactY);
      ctx.fillStyle = '#332211';
      ctx.fillRect(cx - 4, cy, 9, 3);
      ctx.fillStyle = '#221100';
      ctx.fillRect(cx - 3, cy + 1, 7, 2);
      // Fire glow at crater
      const flicker = Math.sin(simTime * 10) > 0;
      ctx.fillStyle = flicker ? '#ff6622' : '#ff4400';
      ctx.fillRect(cx - 2, cy - 1, 5, 1);
      ctx.fillStyle = '#ffaa33';
      ctx.fillRect(cx - 1, cy - 2, 3, 1);
      // Crater debris particles
      if (m.craterDebris) {
        for (const d of m.craterDebris) {
          const alpha = Math.min(1, d.life * 2);
          ctx.fillStyle = `rgba(120, 80, 40, ${alpha})`;
          ctx.fillRect(Math.floor(d.x), Math.floor(d.y), 1, 1);
        }
      }
      // Remaining trail particles
      for (const tp of m.trail) {
        const alpha = Math.min(1, tp.life * 3);
        ctx.fillStyle = `rgba(255, 100, 30, ${alpha})`;
        ctx.fillRect(Math.floor(tp.x), Math.floor(tp.y), 1, 1);
      }
    }
  }

  // Eclipse — renders sun at its real position with moon crossing over (enhanced)
  if (events.eclipse) {
    const e = events.eclipse;
    const progress = e.progress || 0; // 0 → 1 → fade at end via timer
    const totalDur = e.totalDuration || 20;
    const endFade = Math.min(1, e.timer / (totalDur * 0.15)); // fade out last 15%
    const eff = progress * endFade; // effective intensity
    // Dark blue sky tint — more dramatic than before
    ctx.fillStyle = `rgba(0, 5, 35, ${eff * 0.72})`;
    ctx.fillRect(0, 0, CANVAS_W, waterY);
    // Stars become visible during totality
    if (e._showStars) {
      const starAlpha = Math.min(1, (eff - 0.6) * 2.5) * 0.85;
      // Use deterministic star positions seeded from eclipse x
      const seed = Math.floor(e.x || 0) + 77;
      for (let si = 0; si < 18; si++) {
        const sx = Math.floor(((seed * (si + 1) * 1637) % CANVAS_W + CANVAS_W) % CANVAS_W);
        const sy = Math.floor(((seed * (si + 3) * 2311) % (waterY * 0.7) + 1));
        const twinkle = 0.5 + 0.5 * Math.sin(simTime * 3 + si * 1.3);
        ctx.fillStyle = `rgba(255, 255, 240, ${starAlpha * twinkle})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
    }
    // Calculate real sun position (same math as renderCelestial)
    const tod = e._tod || 0.5;
    const skyTop = 4;
    const skyBottom = Math.floor(waterY * 0.35);
    const dayP = Math.max(0, Math.min(1, (tod - 0.22) / 0.56));
    const sunX = Math.floor(CANVAS_W * 0.25 + dayP * CANVAS_W * 0.5);
    const sunArc = Math.sin(dayP * Math.PI);
    const sunY = Math.floor(skyBottom - sunArc * (skyBottom - skyTop));
    // Sun (dim during eclipse)
    const sunAlpha = 1 - eff * 0.7;
    ctx.fillStyle = `rgba(255, 221, 68, ${sunAlpha})`;
    ctx.fillRect(sunX - 2, sunY - 2, 5, 5);
    ctx.fillStyle = `rgba(255, 238, 136, ${sunAlpha})`;
    ctx.fillRect(sunX - 1, sunY - 1, 3, 3);
    // Moon overlay
    const moonOffset = Math.floor((1 - eff) * 6 - 3);
    ctx.fillStyle = '#111122';
    ctx.fillRect(sunX - 2 + moonOffset, sunY - 2, 5, 5);
    // Corona when near total
    if (eff > 0.7) {
      ctx.fillStyle = `rgba(255, 200, 100, ${(eff - 0.7) * 2})`;
      ctx.fillRect(sunX - 3, sunY, 1, 1);
      ctx.fillRect(sunX + 3, sunY, 1, 1);
      ctx.fillRect(sunX, sunY - 3, 1, 1);
      ctx.fillRect(sunX, sunY + 3, 1, 1);
      // Extra corona rays
      ctx.fillStyle = `rgba(255, 180, 80, ${(eff - 0.7) * 1.2})`;
      ctx.fillRect(sunX - 4, sunY - 1, 1, 1);
      ctx.fillRect(sunX + 4, sunY - 1, 1, 1);
      ctx.fillRect(sunX - 1, sunY + 4, 1, 1);
      ctx.fillRect(sunX + 1, sunY - 4, 1, 1);
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

  // Fog — semi-transparent gray, denser near ground
  if (events.fog) {
    const op = events.fog.opacity;
    // Upper fog — lighter
    ctx.fillStyle = `rgba(160, 170, 160, ${op * 0.4})`;
    ctx.fillRect(0, 0, CANVAS_W, Math.floor(waterY * 0.5));
    // Mid fog
    ctx.fillStyle = `rgba(140, 150, 140, ${op * 0.6})`;
    ctx.fillRect(0, Math.floor(waterY * 0.5), CANVAS_W, Math.floor(waterY * 0.5));
    // Ground-level fog — densest
    ctx.fillStyle = `rgba(120, 130, 120, ${op * 0.85})`;
    ctx.fillRect(0, waterY - 10, CANVAS_W, 15);
    // Water fog
    ctx.fillStyle = `rgba(130, 140, 130, ${op * 0.5})`;
    ctx.fillRect(0, waterY + 5, CANVAS_W, CANVAS_H - waterY - 5);
  }

  // Blood Moon — red tint overlay across the whole screen
  if (events.bloodMoon) {
    const fadeIn = Math.min(1, (events.bloodMoon.timer > 2 ? 1 : events.bloodMoon.timer / 2));
    const intensity = events.bloodMoon.intensity * fadeIn;
    ctx.fillStyle = `rgba(180, 20, 20, ${intensity})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Subtle pulsing
    const pulse = Math.sin(simTime * 1.5) * 0.03;
    ctx.fillStyle = `rgba(200, 0, 0, ${Math.max(0, intensity * 0.5 + pulse)})`;
    ctx.fillRect(0, 0, CANVAS_W, waterY);
  }
}
