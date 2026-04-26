// Wildlife system — the swamp is ALIVE
// Extracted from main.js: all wildlife spawning, updating, and rendering

import { CANVAS_W, CANVAS_H } from '../config.js';
import { distance } from '../utils/math.js';
import { WILDLIFE_VALID_ERAS } from './dynasty.js';
import { logDeath } from './obituary.js';

export const WILDLIFE_TYPES = [
  'turtle', 'snake', 'bird', 'butterfly', 'raccoon', 'opossum',
  'heron_bg', 'nutria', 'crawfish', 'mosquito_swarm', 'egret',
  'armadillo', 'rabbit', 'deer',
  'water_moccasin', 'pelican', 'osprey', 'wild_boar', 'panther',
  'coyote', 'beaver', 'jeep', 'airboat',
];

export const CRYPTID_TYPES = ['sasquatch', 'chupacabra', 'mothman'];
const CRYPTID_SET = new Set(CRYPTID_TYPES);

// Pre-built Sets for hot-path type checks (avoid per-frame .includes() O(n) scans)
const GRAVITY_TYPES = new Set(['deer', 'rabbit', 'raccoon', 'opossum', 'armadillo', 'sasquatch', 'chupacabra', 'hunter_foot', 'alien', 'wild_boar', 'panther', 'coyote', 'jeep']);
const HUNTER_TYPES = new Set(['hunter_foot', 'hunter_boat', 'jeep', 'airboat']);
const NON_EDIBLE_WILDLIFE = new Set(['bird', 'egret', 'butterfly', 'mosquito_swarm', 'mothman', 'hunter_foot', 'hunter_boat', 'jeep', 'airboat', 'panther', 'pelican', 'osprey']);
const TOUGH_PREY = new Set(['deer', 'raccoon', 'nutria']);

export const FOOD_CHAIN = {
  snake:       { prey: ['crawfish', 'rabbit', 'mosquito_swarm'], fears: ['heron_bg', 'egret', 'bird', 'sasquatch', 'hunter_foot', 'hunter_boat'], speed: 8 },
  heron_bg:    { prey: ['crawfish', 'snake', 'nutria'], fears: ['sasquatch', 'chupacabra'], speed: 6 },
  egret:       { prey: ['crawfish', 'snake'], fears: ['sasquatch', 'chupacabra'], speed: 6 },
  bird:        { prey: ['snake', 'rabbit', 'crawfish', 'butterfly', 'mosquito_swarm'], fears: [], speed: 10 },
  raccoon:     { prey: ['crawfish', 'turtle', 'mosquito_swarm'], fears: ['snake', 'chupacabra', 'sasquatch', 'hunter_foot'], speed: 7 },
  opossum:     { prey: ['crawfish', 'mosquito_swarm'], fears: ['snake', 'raccoon', 'chupacabra', 'hunter_foot'], speed: 5 },
  nutria:      { prey: [], fears: ['snake', 'heron_bg', 'chupacabra', 'hunter_foot', 'hunter_boat'], speed: 6 },
  armadillo:   { prey: ['crawfish', 'mosquito_swarm'], fears: ['chupacabra', 'hunter_foot'], speed: 3 },
  rabbit:      { prey: [], fears: ['snake', 'bird', 'chupacabra', 'sasquatch', 'hunter_foot'], speed: 14 },
  deer:        { prey: [], fears: ['chupacabra', 'sasquatch', 'hunter_foot', 'hunter_boat', 'snake'], speed: 16 },
  turtle:      { prey: ['crawfish', 'mosquito_swarm'], fears: ['raccoon'], speed: 2 },
  crawfish:    { prey: [], fears: ['snake', 'heron_bg', 'egret', 'raccoon', 'turtle', 'bird', 'armadillo', 'opossum'], speed: 4 },
  butterfly:   { prey: [], fears: ['bird'], speed: 5 },
  mosquito_swarm: { prey: [], fears: [], speed: 3 },
  sasquatch:   { prey: ['deer', 'raccoon', 'opossum', 'nutria', 'armadillo'], fears: ['hunter_foot', 'hunter_boat'], speed: 6 },
  chupacabra:  { prey: ['raccoon', 'opossum', 'nutria', 'rabbit', 'deer', 'armadillo', 'turtle', 'snake'], fears: ['hunter_foot', 'hunter_boat'], speed: 14 },
  mothman:     { prey: [], fears: [], speed: 4 },
  hunter_foot: { prey: [], fears: ['sasquatch'], speed: 5 }, // gator hunting handled separately
  hunter_boat: { prey: [], fears: [], speed: 7 },
  water_moccasin: { prey: ['crawfish'], fears: ['heron_bg', 'egret'], speed: 7 },
  pelican: { prey: [], fears: [], speed: 8 },
  osprey: { prey: ['snake', 'water_moccasin', 'crawfish'], fears: [], speed: 12 },
  wild_boar: { prey: ['snake', 'crawfish', 'armadillo'], fears: ['panther', 'hunter_foot', 'sasquatch'], speed: 9 },
  panther: { prey: ['deer', 'wild_boar', 'raccoon', 'rabbit', 'opossum', 'coyote'], fears: ['hunter_foot'], speed: 14 },
  coyote: { prey: ['rabbit', 'armadillo', 'opossum'], fears: ['panther', 'wild_boar', 'hunter_foot'], speed: 11 },
  beaver: { prey: [], fears: ['snake', 'water_moccasin', 'chupacabra'], speed: 4 },
  jeep: { prey: [], fears: [], speed: 12 },
  airboat: { prey: [], fears: [], speed: 15 },
  alien: { prey: [], fears: [], speed: 5 }, // fights are handled specially
};

export function createWildlifeState() {
  return { wildlife: [], rivalTimer: 10 };
}

export function spawnAlienSurvivor(state, x, y, rng, waterY) {
  state.wildlife.push({
    type: 'alien',
    x, y,
    vx: rng.float(-4, 4),
    vy: 0,
    animTimer: 0,
    life: rng.float(10, 18), // short lifespan — they don't survive long in the swamp
    alive: true,
    hp: 3,
    huntTimer: 0,
    raygunTimer: rng.float(1, 3),
    panicking: true,
  });
}

export function spawnWildlife(rng, type, simTime, waterY) {
  const fromLeft = rng.chance(0.5);
  const base = {
    type,
    x: fromLeft ? rng.float(-8, -3) : rng.float(CANVAS_W + 3, CANVAS_W + 8),
    y: waterY - rng.float(2, 12),
    vx: (fromLeft ? 1 : -1) * rng.float(2, 8),
    vy: 0,
    animTimer: 0,
    life: rng.float(12, 40),
    alive: true,
    hp: 1,
  };

  // Type-specific overrides
  switch (type) {
    case 'bird': case 'egret': case 'heron_bg':
      base.y = waterY - rng.float(15, 35);
      base.vx = (fromLeft ? 1 : -1) * rng.float(5, 10);
      break;
    case 'butterfly': case 'mosquito_swarm':
      base.y = waterY - rng.float(8, 25);
      base.vx *= 0.5;
      break;
    case 'snake':
      base.y = waterY - rng.float(0, 5);
      base.vx *= 0.7;
      break;
    case 'crawfish':
      base.y = waterY + rng.float(2, 8);
      base.vx *= 0.3;
      break;
    case 'turtle':
      base.vx *= 0.3;
      base.y = waterY - 1;
      break;
    case 'deer':
      base.y = waterY - rng.float(6, 15);
      base.vx = (fromLeft ? 1 : -1) * rng.float(8, 14);
      base.hp = 3;
      break;
    case 'raccoon': case 'opossum': case 'armadillo':
      base.y = waterY - rng.float(2, 6);
      base.vx *= 0.6;
      break;
    case 'nutria': case 'rabbit':
      base.y = waterY - rng.float(1, 5);
      break;
    // Cryptids
    case 'sasquatch':
      base.y = waterY - rng.float(15, 25);
      base.vx = (fromLeft ? 1 : -1) * rng.float(3, 6);
      base.life = rng.float(15, 30);
      base.hp = 10;
      break;
    case 'chupacabra':
      base.y = waterY - rng.float(5, 12);
      base.vx = (fromLeft ? 1 : -1) * rng.float(6, 12);
      base.life = rng.float(15, 35);
      base.hp = 5;
      base.huntTimer = 0;
      break;
    case 'mothman':
      base.y = rng.float(5, 20);
      base.vx = (fromLeft ? 1 : -1) * rng.float(2, 4);
      base.life = rng.float(10, 20);
      base.hp = 99;
      break;
    // New wildlife
    case 'water_moccasin':
      base.y = waterY + rng.float(1, 5);
      base.vx = (fromLeft ? 1 : -1) * rng.float(3, 6);
      base.hp = 2;
      break;
    case 'pelican':
      base.y = waterY - rng.float(20, 35);
      base.vx = (fromLeft ? 1 : -1) * rng.float(4, 7);
      base.hp = 2;
      base.diveTimer = rng.float(3, 8);
      break;
    case 'osprey':
      base.y = rng.float(5, 20);
      base.vx = (fromLeft ? 1 : -1) * rng.float(6, 10);
      base.hp = 2;
      break;
    case 'wild_boar':
      base.y = waterY - rng.float(4, 10);
      base.vx = (fromLeft ? 1 : -1) * rng.float(5, 9);
      base.hp = 4;
      break;
    case 'panther':
      base.y = waterY - rng.float(5, 12);
      base.vx = (fromLeft ? 1 : -1) * rng.float(3, 6);
      base.hp = 6;
      base.life = rng.float(30, 50);
      base.huntTimer = 0;
      break;
    case 'coyote':
      base.y = waterY - rng.float(3, 8);
      base.vx = (fromLeft ? 1 : -1) * rng.float(5, 8);
      base.hp = 3;
      break;
    case 'beaver':
      base.y = waterY - rng.float(0, 3);
      base.vx = (fromLeft ? 1 : -1) * rng.float(1, 3);
      base.hp = 2;
      break;
    // Vehicles
    case 'jeep':
      base.y = waterY - rng.float(5, 10);
      base.vx = (fromLeft ? 1 : -1) * rng.float(10, 15);
      base.hp = 8;
      base.life = rng.float(15, 30);
      base.huntTimer = rng.float(2, 5);
      break;
    case 'airboat':
      base.y = waterY + rng.float(1, 3);
      base.vx = (fromLeft ? 1 : -1) * rng.float(12, 18);
      base.hp = 6;
      base.life = rng.float(15, 30);
      base.huntTimer = rng.float(2, 5);
      break;
    // Hunters
    case 'hunter_foot':
      base.y = waterY - rng.float(4, 10);
      base.vx = (fromLeft ? 1 : -1) * rng.float(3, 6);
      base.life = rng.float(20, 45);
      base.hp = 4;
      base.huntTimer = rng.float(2, 5);
      base.hasGun = true;
      break;
    case 'hunter_boat':
      base.y = waterY + rng.float(1, 4);
      base.vx = (fromLeft ? 1 : -1) * rng.float(4, 8);
      base.life = rng.float(20, 45);
      base.hp = 5;
      base.huntTimer = rng.float(2, 5);
      base.hasGun = true;
      break;
  }

  return base;
}

/**
 * Update all wildlife creatures.
 * @param {object} state - Wildlife state from createWildlifeState()
 * @param {number} dt - Delta time
 * @param {number} simTime - Total simulation time
 * @param {object} rng - RNG instance
 * @param {object} world - ECS world
 * @param {number} waterY - Water line Y position
 * @param {object} callbacks - { spawnDeathParticles(particles, x, y, color), spawnPrey, particles, playZap, playEat, obituaryState? }
 * @param {number} [currentEraId=1] - Current era id for era-gated spawn filtering
 */
export function updateWildlife(state, dt, simTime, rng, world, waterY, callbacks, currentEraId = 1) {
  const { spawnDeathParticles, spawnPrey, particles, playZap, playEat, obituaryState } = callbacks;
  const wildlife = state.wildlife;

  // Build era-valid type list (types without an entry are valid in all eras)
  const validTypes = WILDLIFE_TYPES.filter(t => {
    const validEras = WILDLIFE_VALID_ERAS[t];
    return !validEras || validEras.includes(currentEraId);
  });

  // Industrial era: nutria weight 3x — add extra copies to the pick pool
  const spawnPool = currentEraId >= 2
    ? [...validTypes, 'nutria', 'nutria']
    : validTypes;

  // Spawn regular wildlife frequently — the swamp should be teeming
  if (wildlife.length < 30) {
    const spawnAttempts = wildlife.length < 10 ? 3 : 1;
    for (let s = 0; s < spawnAttempts; s++) {
      if (rng.chance(0.4 * dt)) {
        const type = rng.pick(spawnPool);
        wildlife.push(spawnWildlife(rng, type, simTime, waterY));
      }
    }
  }

  // Cryptid spawn — not that rare, this swamp is WEIRD
  if (rng.chance(0.02 * dt)) {
    const type = rng.pick(CRYPTID_TYPES);
    const cryptidCount = wildlife.filter(w => CRYPTID_TYPES.includes(w.type)).length;
    if (cryptidCount < 2) {
      wildlife.push(spawnWildlife(rng, type, simTime, waterY));
    }
  }

  // Human hunters / vehicles — respect era gating (jeep/airboat only in industrial+)
  if (rng.chance(0.012 * dt)) {
    const hunterCount = wildlife.filter(w => ['hunter_boat', 'hunter_foot', 'jeep', 'airboat'].includes(w.type)).length;
    if (hunterCount < 3) {
      const hunterPool = currentEraId >= 2
        ? ['hunter_boat', 'hunter_foot', 'hunter_foot', 'jeep', 'airboat']
        : ['hunter_boat', 'hunter_foot', 'hunter_foot'];
      const type = rng.pick(hunterPool);
      wildlife.push(spawnWildlife(rng, type, simTime, waterY));
    }
  }

  for (let i = wildlife.length - 1; i >= 0; i--) {
    const w = wildlife[i];
    w.life -= dt;
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    w.animTimer += dt;

    if (!w.alive || w.hp <= 0) {
      wildlife.splice(i, 1);
      continue;
    }

    const chain = FOOD_CHAIN[w.type];

    // Skip expensive food chain logic for off-screen creatures
    const onScreen = w.x > -5 && w.x < CANVAS_W + 5 && w.y > -5 && w.y < CANVAS_H + 5;
    if (!onScreen) continue;

    const huntRange = 35;
    const killRange = 5;
    const fleeRange = 30;

    // --- FLEE from predators ---
    if (chain && chain.fears.length > 0) {
      for (const other of wildlife) {
        if (other === w || !other.alive) continue;
        if (!chain.fears.includes(other.type)) continue;
        const dist = distance(w.x, w.y, other.x, other.y);
        if (dist < fleeRange) {
          // Run away!
          const fleeSpeed = (chain.speed || 6) * 1.3;
          w.vx = Math.sign(w.x - other.x) * fleeSpeed;
          if (w.type === 'deer' || w.type === 'rabbit') {
            w.vy = -rng.float(3, 8); // jump while fleeing
          }
          break;
        }
      }
      // Flee from gators too
      for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
        if (gator.stage === 'egg') continue;
        const dist = distance(w.x, w.y, gtr.x, gtr.y);
        if (dist < fleeRange * 0.7) {
          w.vx = Math.sign(w.x - gtr.x) * (chain.speed || 6) * 1.2;
          break;
        }
      }
    }

    // --- HUNT prey ---
    w.huntTimer = (w.huntTimer || 0) - dt;
    if (chain && chain.prey.length > 0 && w.huntTimer <= 0) {
      let closest = null;
      let closestDist = huntRange;
      for (const other of wildlife) {
        if (other === w || !other.alive) continue;
        if (!chain.prey.includes(other.type)) continue;
        const dist = distance(w.x, w.y, other.x, other.y);
        if (dist < closestDist) {
          closestDist = dist;
          closest = other;
        }
      }
      // Also hunt prey entities (frogs, fish, flies)
      if (!closest && ['snake', 'heron_bg', 'egret', 'bird', 'raccoon'].includes(w.type)) {
        for (const [pid, ptr, pprey] of world.query('transform', 'prey')) {
          if (!pprey.alive) continue;
          // snakes/herons eat frogs and fish
          if (w.type === 'snake' && pprey.type !== 'frog') continue;
          if ((w.type === 'heron_bg' || w.type === 'egret') && pprey.type !== 'fish' && pprey.type !== 'frog') continue;
          if (w.type === 'bird' && pprey.type !== 'fly') continue;
          if (w.type === 'raccoon' && pprey.type !== 'frog') continue;
          const dist = distance(w.x, w.y, ptr.x, ptr.y);
          if (dist < closestDist) {
            closestDist = dist;
            closest = { x: ptr.x, y: ptr.y, _preyEntity: true, _preyId: pid, _prey: pprey };
          }
        }
      }

      if (closest) {
        const speed = chain.speed || 6;
        w.vx = Math.sign((closest.x || closest.x) - w.x) * speed;
        if (Math.abs(w.y - (closest.y || closest.y)) > 3) {
          w.vy = Math.sign((closest.y || closest.y) - w.y) * speed * 0.5;
        }

        if (closestDist < killRange) {
          // KILL!
          if (closest._preyEntity) {
            closest._prey.alive = false;
            world.kill(closest._preyId);
          } else {
            // Fight — bigger creature might win
            const myPower = (w.hp || 1) * rng.float(0.5, 1.5);
            const theirPower = (closest.hp || 1) * rng.float(0.5, 1.5);
            if (myPower >= theirPower) {
              closest.alive = false;
              spawnDeathParticles(particles, closest.x, closest.y);
            } else {
              // Failed hunt, take damage
              w.hp -= 1;
              spawnDeathParticles(particles, w.x, w.y);
              if (w.hp <= 0) w.alive = false;
            }
          }
          w.huntTimer = rng.float(2, 6);
        }
      } else {
        w.huntTimer = rng.float(0.5, 2);
      }
    }

    // --- Type-specific movement ---
    switch (w.type) {
      case 'turtle':
        w.vx *= 0.99;
        break;
      case 'snake':
        w.y += Math.sin(simTime * 3 + i) * 2 * dt;
        break;
      case 'bird': case 'egret': case 'heron_bg':
        w.y += Math.sin(simTime * 1.5 + i * 2) * 3 * dt;
        break;
      case 'butterfly':
        w.y += Math.sin(simTime * 4 + i * 3) * 8 * dt;
        w.vx += Math.sin(simTime * 2 + i) * 2 * dt;
        if (w.y > waterY - 3) w.y = waterY - 3;
        break;
      case 'mosquito_swarm':
        w.x += Math.sin(simTime * 5 + i) * 3 * dt;
        w.y += Math.sin(simTime * 7 + i * 2) * 2 * dt;
        break;
      case 'crawfish':
        if (w.y < waterY) w.y = waterY + 2;
        w.vx += rng.float(-2, 2) * dt;
        break;
      case 'raccoon': case 'opossum':
        if (rng.chance(0.3 * dt)) w.vx += rng.float(-3, 3);
        break;
      case 'nutria':
        if (w.y < waterY - 1) w.vy += 5 * dt;
        break;
      case 'deer':
        if (rng.chance(0.1 * dt)) w.vx *= rng.float(0.3, 1.2);
        break;
      case 'armadillo':
        w.y += Math.sin(simTime * 6 + i) * 0.5 * dt;
        break;
      case 'rabbit':
        if (w.animTimer > 0.8) {
          w.vy = -rng.float(5, 10);
          w.animTimer = 0;
        }
        w.vy += 20 * dt;
        if (w.y > waterY - 2) { w.y = waterY - 2; w.vy = 0; }
        break;
      case 'sasquatch':
        if (rng.chance(0.2 * dt)) w.vx *= 0.5;
        if (rng.chance(0.1 * dt)) w.vx = Math.sign(w.vx || 1) * rng.float(2, 5);
        break;
      case 'chupacabra':
        break; // movement handled by hunt logic
      case 'mothman':
        w.y += Math.sin(simTime * 1 + i) * 2 * dt;
        break;
      case 'water_moccasin':
        if (w.y < waterY) w.y = waterY + 2;
        w.y += Math.sin(simTime * 3 + i * 1.5) * 2 * dt;
        break;
      case 'pelican':
        w.y += Math.sin(simTime * 1.2 + i * 2) * 2 * dt;
        w.diveTimer = (w.diveTimer || 3) - dt;
        if (w.diveTimer <= 0 && w.y < waterY - 10) {
          w.vy = 25; // dive!
          w.diveTimer = rng.float(5, 12);
        }
        if (w.y > waterY - 3) { w.vy = -15; } // pull back up
        w.vy *= 0.95;
        break;
      case 'osprey':
        w.y += Math.sin(simTime * 2 + i * 3) * 1.5 * dt;
        break;
      case 'wild_boar':
        if (rng.chance(0.15 * dt)) w.vx *= rng.float(0.5, 1.8); // charge bursts
        break;
      case 'panther':
        // Slow stalk, burst when near prey
        w.vx *= 0.99;
        if (rng.chance(0.05 * dt)) w.vx = Math.sign(w.vx || 1) * rng.float(2, 14);
        break;
      case 'coyote':
        w.y += Math.sin(simTime * 5 + i) * 0.5 * dt; // trot bounce
        break;
      case 'beaver':
        if (w.y < waterY - 2) w.y = waterY - 1;
        w.y += Math.sin(simTime * 2 + i) * 0.3 * dt; // bob
        break;
      case 'jeep':
        w.y += Math.sin(simTime * 15 + i) * 0.2 * dt; // engine rumble
        if (w.y > waterY - 3) w.y = waterY - 3;
        break;
      case 'airboat':
        if (w.y < waterY) w.y = waterY + 1;
        w.y += Math.sin(simTime * 8 + i) * 0.3 * dt;
        break;
      case 'hunter_foot':
      case 'hunter_boat':
        // Fleeing with flailing arms after losing a fight
        if (w.fleeing) {
          w.fleeTimer -= dt;
          w.vx = Math.sign(w.vx || 1) * Math.abs(w.vx) * 1.02; // accelerate away
          if (Math.abs(w.vx) < 8) w.vx = Math.sign(w.vx || 1) * 8; // minimum flee speed
          if (w.fleeTimer <= 0) w.fleeing = false;
        }
        break;
      case 'alien': {
        // Beam-up exit when life is almost gone
        if (w.life < 3 && !w.beamingUp) {
          w.beamingUp = true;
          w.beamTimer = 2.5;
          w.vx = 0;
        }
        if (w.beamingUp) {
          w.beamTimer -= dt;
          w.vx = 0;
          w.vy = -3 * (1 - w.beamTimer / 2.5); // accelerate upward
          w.y += w.vy * dt;
          if (w.beamTimer <= 0) {
            w.alive = false; // gone
          }
          break; // skip all other alien behavior while beaming
        }

        // Panicked alien with raygun — aggressive, dangerous
        w.raygunTimer = (w.raygunTimer || 0) - dt;
        // Erratic panicked movement
        w.vx += rng.float(-12, 12) * dt;
        if (rng.chance(0.3 * dt)) w.vx *= -1;
        w.vx = Math.max(-6, Math.min(6, w.vx));

        // Shoot raygun at nearby gators — fast and deadly
        if (w.raygunTimer <= 0) {
          let shotFired = false;
          for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
            if (gator.stage === 'egg') continue;
            const dist = distance(w.x, w.y, gtr.x, gtr.y);
            if (dist < 35) {
              // ZAP! — powerful raygun blast
              const damage = 0.3 + rng.float(0, 0.2); // heavy damage
              gator.health -= damage;
              w.raygunTimer = rng.float(0.5, 1.5); // fires fast
              w.lastZapX = gtr.x + (gator.spriteW || 10) / 2;
              w.lastZapY = gtr.y;
              w.zapFlash = 0.35;
              playZap();
              spawnDeathParticles(particles, gtr.x + (gator.spriteW || 10) / 2, gtr.y + 2, '#33ff33');

              if (gator.health <= 0) {
                // VAPORIZED — gator disintegrates
                if (obituaryState) logDeath(obituaryState, { gator, cause: 'alien', time: simTime });
                world.kill(gid);
                // Green vaporization flash
                for (let v = 0; v < 8; v++) {
                  particles.deathParticles.push({
                    x: gtr.x + rng.float(0, gator.spriteW || 10),
                    y: gtr.y + rng.float(0, gator.spriteH || 5),
                    vx: rng.float(-15, 15),
                    vy: rng.float(-20, -5),
                    life: rng.float(0.5, 1.2),
                    color: rng.pick(['#33ff33', '#66ff66', '#00cc00', '#aaffaa']),
                  });
                }
              }
              shotFired = true;
              break;
            }
          }
          // Also shoot at nearby wildlife
          if (!shotFired) {
            for (const other of wildlife) {
              if (other === w || !other.alive) continue;
              if (other.type === 'alien') continue;
              const dist = distance(w.x, w.y, other.x, other.y);
              if (dist < 20) {
                other.hp = (other.hp || 1) - 2;
                w.lastZapX = other.x; w.lastZapY = other.y;
                w.zapFlash = 0.3;
                spawnDeathParticles(particles, other.x, other.y, '#33ff33');
                if (other.hp <= 0) other.alive = false;
                w.raygunTimer = rng.float(0.8, 1.5);
                shotFired = true;
                break;
              }
            }
          }
          if (!shotFired) w.raygunTimer = rng.float(0.3, 0.8);
        }
        if (w.zapFlash) w.zapFlash -= dt;
        break;
      }
    }

    // --- Gravity for land animals ---
    if (GRAVITY_TYPES.has(w.type)) {
      w.vy = (w.vy || 0) + 15 * dt;
      if (w.y > waterY - 2) { w.y = waterY - 2; w.vy = Math.min(0, w.vy); }
    }

    // --- HUNTERS vs EVERYTHING ---
    if (HUNTER_TYPES.has(w.type)) {
      w.huntTimer = (w.huntTimer || 0) - dt;
      if (w.huntTimer <= 0) {
        // Find nearest target — gators preferred, but will shoot anything
        let target = null;
        let targetDist = 35;
        let targetIsGator = false;

        // Check gators first (primary target)
        for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
          if (gator.stage === 'egg') continue;
          const dist = distance(w.x, w.y, gtr.x, gtr.y);
          if (dist < targetDist) {
            targetDist = dist;
            target = { x: gtr.x, y: gtr.y, id: gid, gator, tr: gtr };
            targetIsGator = true;
          }
        }

        // Also hunt wildlife — deer, sasquatch, anything big enough
        const hunterTargets = ['deer', 'sasquatch', 'chupacabra', 'snake', 'raccoon', 'nutria', 'alien'];
        for (const other of wildlife) {
          if (other === w || !other.alive) continue;
          if (!hunterTargets.includes(other.type)) continue;
          const dist = distance(w.x, w.y, other.x, other.y);
          if (dist < targetDist) {
            targetDist = dist;
            target = other;
            targetIsGator = false;
          }
        }

        if (target) {
          w.vx = Math.sign((target.x || target.tr?.x || 0) - w.x) * (w.type === 'hunter_boat' ? 6 : 4);

          if (targetDist < 10) {
            if (targetIsGator) {
              // Gator fight
              const gatorPower = (target.gator.sizeScale || 1) *
                (target.gator.traits?.aggression || 0.5) *
                (target.gator.stage === 'adult' || target.gator.stage === 'elder' ? 1.5 : 0.6);
              const hunterPower = rng.float(0.4, 1.2);
              if (gatorPower > hunterPower) {
                // Face the hunter
                target.tr.direction = (w.x - target.tr.x) > 0 ? 1 : -1;
                w.alive = false;
                target.gator.hunger = Math.max(0, target.gator.hunger - 0.4);
                target.gator.frame = 'eat';
                target.gator.state = 'eating';
                target.gator.stateTimer = 1;
                target.gator.mealCount = (target.gator.mealCount || 0) + 5;
                const maxS = (target.gator.traits?.maxSize || 1) * 2.0;
                target.gator.sizeScale = Math.min(maxS, 1 + target.gator.mealCount * 0.02);
              } else {
                target.gator.health -= 0.4;
                spawnDeathParticles(particles, target.tr.x + 5, target.tr.y + 3);
                w.muzzleFlash = 0.15; // gun flash
                if (target.gator.health <= 0) {
                  if (obituaryState) logDeath(obituaryState, { gator: target.gator, cause: 'hunter', time: simTime });
                  world.kill(target.id);
                }
                w.vx *= -1;
              }
            } else {
              // Wildlife fight — hunter usually wins but cryptids fight back
              const targetPower = (target.hp || 1) * rng.float(0.3, 1.5);
              const hunterPower = rng.float(1, 2.5);
              if (hunterPower > targetPower) {
                target.alive = false;
                spawnDeathParticles(particles, target.x, target.y);
              } else {
                // Target fights back — hunter takes damage
                w.hp -= 1;
                spawnDeathParticles(particles, w.x, w.y);
                if (w.hp <= 0) {
                  w.alive = false;
                } else {
                  // Hunter flees with flailing arms
                  w.fleeing = true;
                  w.fleeTimer = 3;
                }
                w.vx *= -2; // knocked back
              }
            }
            w.huntTimer = rng.float(2, 6);
          }
        } else {
          w.huntTimer = rng.float(0.5, 2);
        }
      }
    }

    // --- GATORS eat wildlife on contact ---
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (gator.stage === 'egg' || gator.stage === 'hatchling') continue;
      if (CRYPTID_SET.has(w.type)) continue;
      if (NON_EDIBLE_WILDLIFE.has(w.type)) continue;
      // Aliens fight back but can be eaten

      const sizeScale = gator.sizeScale || 1;
      const eatDist = (gator.spriteW || 10) * 0.5 * sizeScale;
      const dist = distance(tr.x + (gator.spriteW || 10) / 2, tr.y, w.x, w.y);
      if (dist < eatDist) {
        // Fight check for bigger prey
        if (TOUGH_PREY.has(w.type) && gator.stage === 'juvenile') {
          if (rng.chance(0.4)) continue; // juvenile might fail
        }
        // Alien fight — they resist with rayguns. Real odds.
        if (w.type === 'alien') {
          const gatorPower = (gator.sizeScale || 1) *
            (gator.stage === 'adult' || gator.stage === 'elder' ? 1.2 : 0.5) *
            rng.float(0.4, 1.3); // luck
          const alienPower = rng.float(0.6, 1.4); // aliens are tough
          if (gatorPower < alienPower) {
            // Alien wins — zaps gator hard, might vaporize
            const zapDamage = 0.3 + rng.float(0, 0.3);
            gator.health -= zapDamage;
            w.zapFlash = 0.4;
            w.lastZapX = tr.x + (gator.spriteW || 10) / 2;
            w.lastZapY = tr.y;
            spawnDeathParticles(particles, tr.x + (gator.spriteW || 10) / 2, tr.y, '#33ff33');
            if (gator.health <= 0) {
              // VAPORIZED
              if (obituaryState) logDeath(obituaryState, { gator, cause: 'alien', time: simTime });
              world.kill(id);
              for (let v = 0; v < 10; v++) {
                particles.deathParticles.push({
                  x: tr.x + rng.float(0, gator.spriteW || 10),
                  y: tr.y + rng.float(0, gator.spriteH || 5),
                  vx: rng.float(-15, 15), vy: rng.float(-20, -5),
                  life: rng.float(0.5, 1.5),
                  color: rng.pick(['#33ff33', '#66ff66', '#00cc00']),
                });
              }
            }
            continue; // alien escapes
          }
          // else gator overpowers alien — fall through to eating
        }
        // Face the prey
        tr.direction = (w.x - tr.x) > 0 ? 1 : -1;

        // Large prey triggers death roll instead of instant eat
        const DEATHROLL_PREY = ['deer', 'wild_boar', 'raccoon', 'nutria', 'beaver'];
        if (DEATHROLL_PREY.includes(w.type) && gator.stage !== 'hatchling') {
          gator.state = 'deathroll';
          gator.stateTimer = 2.5;
          gator.deathrollPrey = { x: w.x, y: w.y, type: w.type };
          gator.frame = 'eat';
          gator.deathrollWildlife = w; // keep reference to kill later
          gator.deathrollRollTimer = 0.3;
          // Store meal info for after the roll
          gator.deathrollMealValue = w.type === 'deer' ? 0.4 : 0.2;
          gator.deathrollMealCount = w.type === 'deer' ? 4 : 2;
          playEat();
          break;
        }

        w.alive = false;
        const mealValue = w.type === 'deer' ? 0.4 : w.type === 'alien' ? 0.3 : 0.2;
        gator.hunger = Math.max(0, gator.hunger - mealValue);
        gator.frame = 'eat';
        gator.state = 'eating';
        gator.stateTimer = 0.5;
        playEat();
        gator.mealCount = (gator.mealCount || 0) + (w.type === 'deer' ? 4 : w.type === 'alien' ? 3 : 2);
        const maxS = (gator.traits?.maxSize || 1) * 2.0;
        gator.sizeScale = Math.min(maxS, 1 + gator.mealCount * 0.02);
        spawnDeathParticles(particles, w.x, w.y, w.type === 'alien' ? '#33ff33' : '#882222');
        // Eating an alien makes you GLOW GREEN
        if (w.type === 'alien') {
          gator.glowing = true;
          gator.glowTimer = 60; // glow for 60 seconds
          // Alien DNA boost — speed and size surge
          if (gator.traits) {
            gator.traits.speed = Math.min(2, (gator.traits.speed || 1) * 1.3);
            gator.traits.maxSize = Math.min(3, (gator.traits.maxSize || 1) * 1.2);
          }
        }
        break;
      }
    }

    // Kill off-screen entities quickly — tighter bounds
    if (w.life <= 0 || w.x < -12 || w.x > CANVAS_W + 12 || w.y < -15 || w.y > CANVAS_H + 5) {
      wildlife.splice(i, 1);
    }
  }
}

export function renderWildlife(ctx, state, simTime) {
  const wildlife = state.wildlife;
  for (const w of wildlife) {
    if (!w.alive) continue;
    const px = Math.floor(w.x);
    const py = Math.floor(w.y);
    // Skip rendering off-screen creatures
    if (px < -10 || px > CANVAS_W + 10 || py < -10 || py > CANVAS_H + 5) continue;
    const flipX = w.vx < 0;

    switch (w.type) {
      case 'turtle':
        ctx.fillStyle = '#5a6a3a';
        ctx.fillRect(px, py, 4, 2);
        ctx.fillStyle = '#6a7a4a';
        ctx.fillRect(px + 1, py, 2, 1);
        ctx.fillStyle = '#4a5a2a';
        ctx.fillRect(flipX ? px + 4 : px - 1, py + 1, 1, 1);
        ctx.fillRect(px, py + 2, 1, 1);
        ctx.fillRect(px + 3, py + 2, 1, 1);
        break;
      case 'snake':
        ctx.fillStyle = '#7a5a2a';
        for (let s = 0; s < 8; s++) {
          const sy = Math.round(Math.sin(simTime * 5 + s * 0.7) * 1.2);
          ctx.fillRect(px + (flipX ? -s : s), py + sy, 1, 1);
        }
        // Head
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px + (flipX ? -8 : 8), py, 1, 1);
        // Tongue
        if (Math.sin(simTime * 8) > 0.5) {
          ctx.fillStyle = '#cc3333';
          ctx.fillRect(px + (flipX ? -9 : 9), py, 1, 1);
        }
        break;
      case 'bird':
        ctx.fillStyle = '#333333';
        const bwing = Math.sin(simTime * 6 + w.x) > 0;
        ctx.fillRect(px, py + (bwing ? -1 : 0), 1, 1);
        ctx.fillRect(px + 1, py, 1, 1);
        ctx.fillRect(px + 2, py + (bwing ? -1 : 0), 1, 1);
        break;
      case 'egret':
        // White bird, taller
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(px, py, 1, 3);
        ctx.fillRect(px + (flipX ? -1 : 1), py, 1, 2);
        ctx.fillStyle = '#ffaa33'; // beak
        ctx.fillRect(px + (flipX ? -2 : 2), py, 1, 1);
        const ewing = Math.sin(simTime * 5 + w.x) > 0;
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(px + (flipX ? 1 : -1), py + (ewing ? -1 : 0), 1, 1);
        ctx.fillRect(px + (flipX ? 2 : -2), py + (ewing ? -1 : 0), 1, 1);
        break;
      case 'heron_bg':
        // Tall gray bird
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(px, py, 1, 5);
        ctx.fillRect(px + (flipX ? -1 : 1), py + 1, 1, 3);
        ctx.fillStyle = '#888888';
        ctx.fillRect(px, py + 5, 1, 3); // legs
        ctx.fillStyle = '#ccaa44'; // beak
        ctx.fillRect(px + (flipX ? -1 : 1), py, 2, 1);
        break;
      case 'butterfly':
        const flap = Math.sin(simTime * 10 + w.x) > 0;
        const bcolor = ['#dd77dd', '#ddaa44', '#77aadd', '#dd5555'][Math.abs(Math.floor(w.x * 0.1)) % 4];
        ctx.fillStyle = bcolor;
        ctx.fillRect(px + (flap ? -1 : 0), py - (flap ? 1 : 0), 1, 1);
        ctx.fillRect(px + (flap ? 1 : 0), py - (flap ? 1 : 0), 1, 1);
        ctx.fillStyle = '#333333';
        ctx.fillRect(px, py, 1, 1);
        break;
      case 'mosquito_swarm':
        // Cloud of dots
        ctx.fillStyle = '#555555';
        for (let m = 0; m < 6; m++) {
          const mx = Math.sin(simTime * 8 + m * 1.5) * 3;
          const my = Math.cos(simTime * 7 + m * 2) * 2;
          ctx.fillRect(px + Math.floor(mx), py + Math.floor(my), 1, 1);
        }
        break;
      case 'crawfish':
        ctx.fillStyle = '#cc4422';
        ctx.fillRect(px, py, 3, 1);
        ctx.fillStyle = '#aa3311';
        ctx.fillRect(px + (flipX ? 3 : -1), py - 1, 1, 1); // claw
        ctx.fillRect(px + (flipX ? 3 : -1), py + 1, 1, 1); // claw
        break;
      case 'raccoon':
        // Chunky gray body, masked face
        ctx.fillStyle = '#888888';
        ctx.fillRect(px, py, 4, 3);
        ctx.fillStyle = '#666666';
        ctx.fillRect(px + (flipX ? -1 : 4), py, 1, 2); // head
        ctx.fillStyle = '#333333'; // mask
        ctx.fillRect(px + (flipX ? -1 : 4), py, 1, 1);
        ctx.fillStyle = '#aaaaaa'; // tail stripes
        ctx.fillRect(px + (flipX ? 4 : -1), py + 1, 1, 1);
        ctx.fillRect(px + (flipX ? 4 : -2), py + 1, 1, 1);
        ctx.fillRect(px, py + 3, 1, 1); ctx.fillRect(px + 3, py + 3, 1, 1); // feet
        break;
      case 'opossum':
        ctx.fillStyle = '#999999';
        ctx.fillRect(px, py, 4, 2);
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(px + (flipX ? -1 : 4), py, 1, 2);
        ctx.fillStyle = '#ffaaaa'; // pink nose
        ctx.fillRect(px + (flipX ? -2 : 5), py, 1, 1);
        // Long tail
        ctx.fillStyle = '#aaaaaa';
        for (let t = 0; t < 4; t++) {
          ctx.fillRect(px + (flipX ? 4 + t : -1 - t), py + 2, 1, 1);
        }
        break;
      case 'nutria':
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(px, py, 4, 2);
        ctx.fillStyle = '#aa8a4a';
        ctx.fillRect(px + 1, py, 2, 1);
        ctx.fillStyle = '#6a4a2a'; // head
        ctx.fillRect(px + (flipX ? -1 : 4), py, 1, 2);
        ctx.fillStyle = '#ff8844'; // orange teeth!
        ctx.fillRect(px + (flipX ? -2 : 5), py + 1, 1, 1);
        break;
      case 'armadillo':
        // Banded shell
        ctx.fillStyle = '#8a7a6a';
        ctx.fillRect(px, py, 5, 2);
        ctx.fillStyle = '#7a6a5a'; // bands
        ctx.fillRect(px + 1, py, 1, 2);
        ctx.fillRect(px + 3, py, 1, 2);
        ctx.fillStyle = '#6a5a4a'; // head
        ctx.fillRect(px + (flipX ? -1 : 5), py, 1, 2);
        ctx.fillRect(px + 1, py + 2, 1, 1); ctx.fillRect(px + 3, py + 2, 1, 1);
        break;
      case 'rabbit':
        ctx.fillStyle = '#bbaa88';
        ctx.fillRect(px, py, 3, 2);
        ctx.fillStyle = '#ccbb99';
        ctx.fillRect(px + (flipX ? -1 : 3), py - 1, 1, 2); // head
        // Ears
        ctx.fillStyle = '#aa9977';
        ctx.fillRect(px + (flipX ? -1 : 3), py - 2, 1, 1);
        ctx.fillRect(px + (flipX ? 0 : 2), py - 2, 1, 1);
        // White tail
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + (flipX ? 3 : -1), py, 1, 1);
        break;
      case 'deer':
        // Larger animal
        ctx.fillStyle = '#9a7a4a';
        ctx.fillRect(px, py, 6, 3);
        ctx.fillStyle = '#aa8a5a';
        ctx.fillRect(px + 1, py, 4, 2);
        // Head + neck
        ctx.fillStyle = '#8a6a3a';
        ctx.fillRect(px + (flipX ? -1 : 6), py - 2, 1, 3);
        ctx.fillRect(px + (flipX ? -2 : 7), py - 2, 1, 2);
        // Antlers (if any)
        if (Math.floor(w.x * 0.1) % 2 === 0) {
          ctx.fillStyle = '#6a5a3a';
          ctx.fillRect(px + (flipX ? -2 : 7), py - 3, 1, 1);
          ctx.fillRect(px + (flipX ? -3 : 8), py - 4, 1, 1);
        }
        // Legs
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(px + 1, py + 3, 1, 2);
        ctx.fillRect(px + 4, py + 3, 1, 2);
        // White belly
        ctx.fillStyle = '#ccbbaa';
        ctx.fillRect(px + 2, py + 2, 2, 1);
        break;

      // --- NEW WILDLIFE ---
      case 'water_moccasin':
        // Thick dark snake in water, cottonmouth open
        ctx.fillStyle = '#2a1a0a';
        for (let s = 0; s < 7; s++) {
          const sy = Math.round(Math.sin(simTime * 4 + s * 0.8) * 1);
          ctx.fillRect(px + (flipX ? -s : s), py + sy, 1, 1);
        }
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px + (flipX ? -7 : 7), py, 1, 1);
        // Cotton white mouth flash
        if (Math.sin(simTime * 6 + w.x) > 0.7) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + (flipX ? -8 : 8), py, 1, 1);
        }
        break;
      case 'pelican':
        // Large white bird with big beak
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(px, py, 4, 3);
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(px + 1, py, 2, 2);
        // Big beak
        ctx.fillStyle = '#ee9933';
        ctx.fillRect(px + (flipX ? -2 : 4), py + 1, 3, 1);
        ctx.fillStyle = '#dd8822';
        ctx.fillRect(px + (flipX ? -2 : 4), py + 2, 2, 1); // pouch
        // Wings
        const pwing = Math.sin(simTime * 4 + w.x) > 0;
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(px - 1, py + (pwing ? -1 : 1), 1, 2);
        ctx.fillRect(px + 4, py + (pwing ? -1 : 1), 1, 2);
        break;
      case 'osprey':
        // Brown/white raptor
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px, py, 3, 2);
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(px + 1, py + 1, 1, 1); // white belly
        ctx.fillStyle = '#444444';
        ctx.fillRect(px + (flipX ? -1 : 3), py, 1, 1); // beak
        const owing = Math.sin(simTime * 7 + w.x) > 0;
        ctx.fillStyle = '#4a2a0a';
        ctx.fillRect(px - 1, py + (owing ? -1 : 0), 1, 1);
        ctx.fillRect(px + 3, py + (owing ? -1 : 0), 1, 1);
        break;
      case 'wild_boar':
        // Dark bristly body, lighter snout, tusks
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(px, py, 5, 3);
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(px + 1, py, 3, 2);
        // Snout
        ctx.fillStyle = '#8a6a4a';
        ctx.fillRect(px + (flipX ? -1 : 5), py + 1, 1, 2);
        // Tusks
        ctx.fillStyle = '#eeeeee';
        ctx.fillRect(px + (flipX ? -1 : 5), py + 2, 1, 1);
        // Legs
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(px + 1, py + 3, 1, 1);
        ctx.fillRect(px + 3, py + 3, 1, 1);
        // Bristle ridge
        ctx.fillStyle = '#2a1a0a';
        ctx.fillRect(px + 1, py - 1, 3, 1);
        break;
      case 'panther':
        // Sleek black body, yellow eyes, long tail
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(px, py, 6, 2);
        ctx.fillStyle = '#222222';
        ctx.fillRect(px + 1, py, 4, 1);
        // Head
        ctx.fillRect(px + (flipX ? -1 : 6), py - 1, 2, 2);
        // Yellow eyes
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(px + (flipX ? -1 : 7), py - 1, 1, 1);
        // Long tail
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(px + (flipX ? 6 : -1), py, 1, 1);
        ctx.fillRect(px + (flipX ? 7 : -2), py - 1, 1, 1);
        ctx.fillRect(px + (flipX ? 8 : -3), py - 1, 1, 1);
        // Legs
        ctx.fillRect(px + 1, py + 2, 1, 1);
        ctx.fillRect(px + 4, py + 2, 1, 1);
        break;
      case 'coyote':
        // Tan/sandy body, pointed ears
        ctx.fillStyle = '#aa8855';
        ctx.fillRect(px, py, 5, 2);
        ctx.fillStyle = '#bb9966';
        ctx.fillRect(px + 1, py, 3, 1);
        // Head + ears
        ctx.fillStyle = '#aa8855';
        ctx.fillRect(px + (flipX ? -1 : 5), py - 1, 1, 2);
        ctx.fillStyle = '#997744';
        ctx.fillRect(px + (flipX ? -1 : 5), py - 2, 1, 1); // ear
        // Bushy tail
        ctx.fillStyle = '#aa8855';
        ctx.fillRect(px + (flipX ? 5 : -1), py - 1, 1, 2);
        ctx.fillRect(px + (flipX ? 6 : -2), py - 1, 1, 1);
        // Legs
        ctx.fillStyle = '#886633';
        ctx.fillRect(px + 1, py + 2, 1, 1);
        ctx.fillRect(px + 3, py + 2, 1, 1);
        break;
      case 'beaver':
        // Brown body, flat tail, orange teeth
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(px, py, 4, 2);
        ctx.fillStyle = '#7a5a3a';
        ctx.fillRect(px + 1, py, 2, 1);
        // Flat tail
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px + (flipX ? 4 : -2), py + 1, 2, 1);
        // Head
        ctx.fillRect(px + (flipX ? -1 : 4), py, 1, 2);
        // Orange teeth
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(px + (flipX ? -2 : 5), py + 1, 1, 1);
        break;

      // --- VEHICLES ---
      case 'jeep': {
        // Boxy olive body
        ctx.fillStyle = '#6a7a4a';
        ctx.fillRect(px, py, 8, 3);
        ctx.fillStyle = '#7a8a5a';
        ctx.fillRect(px + 1, py, 6, 2);
        // Windshield
        ctx.fillStyle = '#aaccdd';
        ctx.fillRect(px + (flipX ? 1 : 5), py, 2, 1);
        // Roll bar
        ctx.fillStyle = '#444444';
        ctx.fillRect(px + 2, py - 1, 1, 1);
        ctx.fillRect(px + 5, py - 1, 1, 1);
        ctx.fillRect(px + 2, py - 2, 4, 1);
        // Wheels
        ctx.fillStyle = '#222222';
        ctx.fillRect(px + 1, py + 3, 2, 2);
        ctx.fillRect(px + 5, py + 3, 2, 2);
        ctx.fillStyle = '#444444';
        ctx.fillRect(px + 1, py + 3, 1, 1);
        ctx.fillRect(px + 5, py + 3, 1, 1);
        // Person
        ctx.fillStyle = '#ddaa88';
        ctx.fillRect(px + 3, py - 3, 1, 1); // head
        ctx.fillStyle = '#556633';
        ctx.fillRect(px + 3, py - 2, 1, 1); // body
        // Headlight
        ctx.fillStyle = '#ffff88';
        ctx.fillRect(px + (flipX ? 0 : 7), py + 1, 1, 1);
        // Muzzle flash
        if (w.muzzleFlash && w.muzzleFlash > 0) {
          ctx.fillStyle = '#ffff44';
          ctx.fillRect(px + 3 + (flipX ? -3 : 3), py - 3, 2, 1);
          w.muzzleFlash -= 0.016;
        }
        break;
      }
      case 'airboat': {
        // Flat hull
        ctx.fillStyle = '#888888';
        ctx.fillRect(px, py, 9, 2);
        ctx.fillStyle = '#999999';
        ctx.fillRect(px + 1, py, 7, 1);
        // Pointed bow
        ctx.fillStyle = '#777777';
        ctx.fillRect(px + (flipX ? -1 : 9), py, 2, 1);
        // Fan cage (circle-ish)
        ctx.fillStyle = '#666666';
        const fanX = px + (flipX ? 8 : -1);
        ctx.fillRect(fanX, py - 2, 3, 4);
        ctx.fillStyle = '#555555';
        ctx.fillRect(fanX + 1, py - 1, 1, 2); // fan center
        // Fan blade spin
        const blade = Math.sin(simTime * 20) > 0;
        ctx.fillStyle = '#444444';
        ctx.fillRect(fanX + (blade ? 0 : 1), py - 2 + (blade ? 0 : 1), blade ? 3 : 1, blade ? 1 : 2);
        // Elevated seat + person
        ctx.fillStyle = '#666666';
        ctx.fillRect(px + 4, py - 2, 1, 2); // seat post
        ctx.fillStyle = '#ddaa88';
        ctx.fillRect(px + 4, py - 4, 1, 1); // head
        ctx.fillStyle = '#886644';
        ctx.fillRect(px + 4, py - 3, 1, 1); // body
        // Water spray behind
        if (Math.abs(w.vx) > 5) {
          ctx.fillStyle = 'rgba(180, 220, 220, 0.4)';
          const sprayDir = w.vx > 0 ? -1 : 1;
          for (let sp = 0; sp < 4; sp++) {
            ctx.fillRect(px + (sprayDir > 0 ? 10 : -1 - sp), py + 1 + Math.floor(Math.sin(simTime * 12 + sp) * 1), 1, 1);
          }
        }
        // Muzzle flash
        if (w.muzzleFlash && w.muzzleFlash > 0) {
          ctx.fillStyle = '#ffff44';
          ctx.fillRect(px + 4 + (flipX ? -2 : 2), py - 4, 2, 1);
          w.muzzleFlash -= 0.016;
        }
        break;
      }

      // --- CRYPTIDS ---
      case 'sasquatch':
        // Big, hairy, bipedal
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px, py, 4, 6);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(px + 1, py, 2, 5);
        // Head
        ctx.fillStyle = '#4a2a0a';
        ctx.fillRect(px + 1, py - 2, 2, 2);
        // Eyes
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px + (flipX ? 1 : 2), py - 2, 1, 1);
        // Arms
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(px + (flipX ? 4 : -1), py + 1, 1, 3);
        ctx.fillRect(px + (flipX ? -1 : 4), py + 1, 1, 3);
        // Feet
        ctx.fillRect(px, py + 6, 1, 1);
        ctx.fillRect(px + 3, py + 6, 1, 1);
        break;
      case 'chupacabra':
        // Spiny, hunched, predatory
        ctx.fillStyle = '#3a4a3a';
        ctx.fillRect(px, py, 5, 3);
        // Spines
        ctx.fillStyle = '#2a3a2a';
        ctx.fillRect(px + 1, py - 1, 1, 1);
        ctx.fillRect(px + 2, py - 2, 1, 1);
        ctx.fillRect(px + 3, py - 1, 1, 1);
        // Head
        ctx.fillStyle = '#4a5a4a';
        ctx.fillRect(px + (flipX ? -1 : 5), py, 2, 2);
        // Red eyes
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(px + (flipX ? -1 : 6), py, 1, 1);
        // Legs
        ctx.fillStyle = '#2a3a2a';
        ctx.fillRect(px, py + 3, 1, 2);
        ctx.fillRect(px + 4, py + 3, 1, 2);
        break;
      case 'mothman':
        // Large wings, red eyes, dark silhouette
        const mwing = Math.sin(simTime * 3 + w.x) > 0;
        ctx.fillStyle = '#1a1a2a';
        // Body
        ctx.fillRect(px, py, 2, 4);
        // Wings
        ctx.fillRect(px - (mwing ? 4 : 3), py + (mwing ? -1 : 0), 4, 2);
        ctx.fillRect(px + 2, py + (mwing ? -1 : 0), 4, 2);
        // Eyes — glowing red
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(px, py, 1, 1);
        ctx.fillRect(px + 1, py, 1, 1);
        // Red eye glow
        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
        ctx.fillRect(px - 1, py - 1, 4, 3);
        break;

      // --- HUNTERS ---
      case 'hunter_foot': {
        // Person with hat and gun
        ctx.fillStyle = '#886644'; // clothes
        ctx.fillRect(px, py + 1, 2, 3); // body
        ctx.fillStyle = '#aa8866';
        ctx.fillRect(px, py + 1, 2, 1); // shirt
        // Head
        ctx.fillStyle = '#ddaa88';
        ctx.fillRect(px, py - 1, 2, 2);
        // Hat
        ctx.fillStyle = '#554433';
        ctx.fillRect(px - 1, py - 2, 4, 1);
        ctx.fillRect(px, py - 3, 2, 1);
        // Legs
        ctx.fillStyle = '#445533';
        ctx.fillRect(px, py + 4, 1, 2);
        ctx.fillRect(px + 1, py + 4, 1, 2);
        if (w.fleeing) {
          // Flailing arms — alternate up/down rapidly
          const armUp = Math.sin(simTime * 15) > 0;
          ctx.fillStyle = '#ddaa88'; // skin tone arms
          if (armUp) {
            ctx.fillRect(px - 1, py - 1, 1, 1); // left arm up
            ctx.fillRect(px + 2, py + 2, 1, 1); // right arm down
          } else {
            ctx.fillRect(px - 1, py + 2, 1, 1); // left arm down
            ctx.fillRect(px + 2, py - 1, 1, 1); // right arm up
          }
        } else {
          // Gun
          ctx.fillStyle = '#333333';
          const gunDir = flipX ? -1 : 1;
          ctx.fillRect(px + (flipX ? -2 : 2), py + 1, 3, 1);
          // Muzzle flash
          if (w.muzzleFlash && w.muzzleFlash > 0) {
            ctx.fillStyle = '#ffff44';
            ctx.fillRect(px + (flipX ? -3 : 5), py, 2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + (flipX ? -4 : 6), py + 1, 1, 1);
            w.muzzleFlash -= 0.016;
          }
        }
        break;
      }
      case 'hunter_boat': {
        // Boat hull
        ctx.fillStyle = '#6a5a3a';
        ctx.fillRect(px - 2, py + 2, 10, 2);
        ctx.fillStyle = '#7a6a4a';
        ctx.fillRect(px - 1, py + 1, 8, 1);
        // Pointed bow
        ctx.fillStyle = '#5a4a2a';
        ctx.fillRect(px + (flipX ? -3 : 8), py + 2, 2, 1);
        // Person in boat
        ctx.fillStyle = '#886644';
        ctx.fillRect(px + 2, py - 1, 2, 2);
        ctx.fillStyle = '#ddaa88'; // head
        ctx.fillRect(px + 2, py - 3, 2, 2);
        // Hat
        ctx.fillStyle = '#cc4444'; // red cap
        ctx.fillRect(px + 1, py - 4, 4, 1);
        // Gun
        ctx.fillStyle = '#333333';
        ctx.fillRect(px + (flipX ? -1 : 4), py - 1, 3, 1);
        // Muzzle flash
        if (w.muzzleFlash && w.muzzleFlash > 0) {
          ctx.fillStyle = '#ffff44';
          ctx.fillRect(px + (flipX ? -2 : 7), py - 2, 2, 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + (flipX ? -3 : 8), py - 1, 1, 1);
          w.muzzleFlash -= 0.016;
        }
        break;
      }

      // --- ALIEN ---
      case 'alien': {
        // Small green humanoid with big head, raygun
        // Body
        ctx.fillStyle = '#44cc44';
        ctx.fillRect(px, py + 1, 2, 2);
        // Big head
        ctx.fillStyle = '#55dd55';
        ctx.fillRect(px - 1, py - 2, 4, 3);
        // Big black eyes
        ctx.fillStyle = '#111111';
        ctx.fillRect(px - 1, py - 1, 2, 1);
        ctx.fillRect(px + 1, py - 1, 2, 1);
        // Legs
        ctx.fillStyle = '#33aa33';
        ctx.fillRect(px, py + 3, 1, 1);
        ctx.fillRect(px + 1, py + 3, 1, 1);
        // Raygun arm
        ctx.fillStyle = '#888888';
        ctx.fillRect(px + (flipX ? -1 : 2), py + 1, 2, 1);
        // Raygun tip
        ctx.fillStyle = '#ff3333';
        ctx.fillRect(px + (flipX ? -2 : 4), py + 1, 1, 1);

        // Raygun ZAP beam
        if (w.zapFlash && w.zapFlash > 0 && w.lastZapX !== undefined) {
          ctx.fillStyle = `rgba(0, 255, 100, ${w.zapFlash * 2})`;
          const zx = Math.floor(w.lastZapX);
          const zy = Math.floor(w.lastZapY);
          // Draw beam line
          const steps = Math.max(Math.abs(zx - px), Math.abs(zy - py));
          for (let s = 0; s <= steps; s += 2) {
            const bx = Math.floor(px + (zx - px) * s / steps);
            const by = Math.floor(py + 1 + (zy - py - 1) * s / steps);
            ctx.fillRect(bx, by, 1, 1);
          }
          // Impact flash
          ctx.fillStyle = `rgba(100, 255, 100, ${w.zapFlash * 3})`;
          ctx.fillRect(zx - 1, zy - 1, 3, 3);
        }

        // Alien glow aura
        ctx.fillStyle = 'rgba(0, 255, 0, 0.08)';
        ctx.fillRect(px - 2, py - 3, 6, 8);

        // Beam-up effect — wavy glow column rising upward
        if (w.beamingUp) {
          const beamProgress = 1 - (w.beamTimer / 2.5);
          const beamAlpha = 0.1 + beamProgress * 0.25;
          // Vertical beam column above the alien
          for (let by = py - 3; by > py - 50; by--) {
            const wave = Math.sin(by * 0.4 + simTime * 8) * 1.5;
            const width = 2 + Math.floor(beamProgress * 2);
            ctx.fillStyle = `rgba(100, 255, 150, ${beamAlpha * (1 - (py - 3 - by) / 50)})`;
            ctx.fillRect(px - Math.floor(width / 2) + Math.floor(wave), by, width, 1);
          }
          // Alien body flickers/fades
          ctx.fillStyle = `rgba(100, 255, 150, ${0.2 + Math.sin(simTime * 12) * 0.15})`;
          ctx.fillRect(px - 1, py - 2, 4, 6);
        }
        break;
      }
    }
  }
}
