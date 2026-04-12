import { createRNG, seedFromHash } from './rng.js';
import { CANVAS_W, CANVAS_H, TICK_RATE, MAX_DT, WATER_LINE, FOOD_SPAWN_MIN, FOOD_SPAWN_MAX, MAX_FOOD } from './config.js';
import { GATOR_STAGES } from './sprites/gator-sprites.js';
import { FLY_1, FLY_2, FISH_SMALL_1, FISH_SMALL_2, FROG_1, FROG_2 } from './sprites/fauna-sprites.js';
import { World } from './ecs.js';
import { aiSystem } from './systems/ai.js';
import { physicsSystem } from './systems/physics.js';
import { lifecycleSystem } from './systems/lifecycle.js';
import { breedingSystem, inheritTraits } from './systems/breeding.js';
import { predatorSystem, scarePredators } from './systems/predator.js';
import { createEnvironment, environmentSystem, renderCelestial, renderEnvironmentEffects, getSeasonText } from './systems/environment.js';
import { drawSprite, drawPixelText, renderSky, renderTerrain, renderWater, renderVegetation, renderGators, renderPrey, renderUnderwaterLife, renderSkyLife, renderUI } from './systems/render.js';
import { createInputHandler, getCurrentPower, isGodMode, POWER_NAMES, POWER_COLORS } from './input.js';
import { createPersistence } from './state.js';
import { createEventSystem, updateEvents, renderEvents } from './systems/events.js';

// Wire up alien survivor callback
function spawnAlienSurvivor(x, y, rng) {
  wildlife.push({
    type: 'alien',
    x, y,
    vx: rng.float(-4, 4),
    vy: 0,
    animTimer: 0,
    life: rng.float(25, 50),
    alive: true,
    hp: 3,
    huntTimer: 0,
    raygunTimer: rng.float(1, 3),
    panicking: true,
  });
}

// --- Seed ---
const urlSeed = seedFromHash();
const seed = urlSeed || String(Date.now());
const rng = createRNG(seed);
if (!urlSeed) window.location.hash = `seed=${seed}`;

// --- Canvas ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
ctx.imageSmoothingEnabled = false;

// --- Terrain ---
const waterY = Math.floor(CANVAS_H * WATER_LINE);
const terrain = generateTerrain(rng);

function generateTerrain(rng) {
  const heights = new Array(CANVAS_W);

  // Seed-driven parameters for terrain variety
  const numChannels = rng.range(2, 5);
  const numBumps = rng.range(2, 5);
  const baseLevel = CANVAS_H * rng.float(0.50, 0.60);
  const roughness = rng.float(1.5, 4);

  // Generate random water channels
  const channels = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push({
      pos: rng.float(0.1, 0.9),
      width: rng.float(150, 800),
      depth: rng.float(8, 25),
    });
  }

  // Generate random land bumps / islands
  const bumps = [];
  for (let i = 0; i < numBumps; i++) {
    bumps.push({
      pos: rng.float(0.05, 0.95),
      width: rng.float(60, 200),
      height: rng.float(6, 18),
    });
  }

  for (let x = 0; x < CANVAS_W; x++) {
    let h = baseLevel;

    // Apply channels (push terrain down = water)
    for (const ch of channels) {
      h += Math.exp(-((x - CANVAS_W * ch.pos) ** 2) / ch.width) * ch.depth;
    }

    // Apply bumps (push terrain up = land)
    for (const bp of bumps) {
      h -= Math.exp(-((x - CANVAS_W * bp.pos) ** 2) / bp.width) * bp.height;
    }

    // Noise
    h += rng.float(-roughness, roughness);

    heights[x] = Math.floor(h);
  }

  // Light smoothing
  for (let i = 0; i < 2; i++) {
    for (let x = 1; x < CANVAS_W - 1; x++) {
      heights[x] = (heights[x - 1] + heights[x] * 2 + heights[x + 1]) / 4;
    }
  }
  return heights;
}

// --- ECS World ---
const world = new World();

// --- Environment ---
const env = createEnvironment();

// --- Vegetation Growth State ---
// The swamp becomes grander over time. Starts modest, grows into something epic.
const vegState = {
  growth: 0.5,       // 0-3, overall vegetation multiplier
  treeGrowth: 0.5,   // tree canopy fullness — caps grow higher over time
  flowerBloom: 0.3,  // flower density
  undergrowth: 0.5,  // grass/fern density
  age: 0,            // total sim-seconds lived — drives epoch transitions
  epoch: 0,          // 0=nascent, 1=established, 2=flourishing, 3=ancient, 4=primordial
  orchidChance: 0,   // orchids only bloom in mature swamps
  maxGrowth: 1.2,    // cap increases per epoch
  surpriseTimer: 30, // countdown to next surprise event
};

const EPOCH_NAMES = ['nascent', 'established', 'flourishing', 'ancient', 'primordial'];
const EPOCH_THRESHOLDS = [0, 120, 360, 720, 1200]; // seconds

function updateVegGrowth(dt) {
  vegState.age += dt;

  // Epoch progression — the swamp matures
  const newEpoch = EPOCH_THRESHOLDS.findLastIndex(t => vegState.age >= t);
  if (newEpoch > vegState.epoch) {
    vegState.epoch = newEpoch;
    // Each epoch raises the ceiling
    vegState.maxGrowth = 1.2 + newEpoch * 0.5; // 1.2 → 1.7 → 2.2 → 2.7 → 3.2
  }

  const seasonGrowthRate = {
    spring: 0.01,
    summer: 0.005,
    autumn: -0.002,
    winter: -0.004,
  };
  const rate = seasonGrowthRate[env.season] || 0;
  const weatherMod = env.weather === 'rain' ? 1.5 : env.weather === 'storm' ? 0.8 : env.weather === 'clear' ? 0.7 : 1.0;
  const fireDamage = fires.length * -0.01;

  // Slow but relentless baseline growth — the swamp always wants to expand
  const baseGrowth = 0.001 * (1 + vegState.epoch * 0.3);

  vegState.growth = Math.max(0.2, Math.min(vegState.maxGrowth, vegState.growth + (rate * weatherMod + fireDamage + baseGrowth) * dt));
  vegState.treeGrowth = Math.max(0.3, Math.min(vegState.maxGrowth * 0.9, vegState.treeGrowth + (rate * 0.5 * weatherMod + baseGrowth * 0.8) * dt));
  vegState.flowerBloom = Math.max(0, Math.min(vegState.maxGrowth, vegState.flowerBloom + (rate * 1.5 * weatherMod + baseGrowth) * dt));
  vegState.undergrowth = Math.max(0.1, Math.min(vegState.maxGrowth, vegState.undergrowth + (rate * weatherMod + baseGrowth) * dt));

  // Orchids only appear in established+ swamps, bloom chance increases with age
  vegState.orchidChance = vegState.epoch >= 1 ? Math.min(1, (vegState.epoch - 1) * 0.25 + vegState.flowerBloom * 0.1) : 0;

  // --- SURPRISE EVENTS — increasingly wild as swamp ages ---
  vegState.surpriseTimer -= dt;
  if (vegState.surpriseTimer <= 0) {
    vegState.surpriseTimer = rng.float(20, 50) / (1 + vegState.epoch * 0.3);
    triggerSurprise(rng);
  }
}

function triggerSurprise(rng) {
  const roll = rng.random();
  const epoch = vegState.epoch;

  // Higher epochs unlock wilder surprises
  if (roll < 0.15) {
    // Swarm — mass wildlife spawn
    const types = ['butterfly', 'bird', 'mosquito_swarm', 'crawfish'];
    const swarmType = rng.pick(types);
    for (let i = 0; i < rng.range(5, 12); i++) {
      wildlife.push(spawnWildlife(rng, swarmType, 0));
    }
  } else if (roll < 0.25) {
    // Stampede — deer or boar run through
    const type = rng.pick(['deer', 'deer', 'wild_boar']);
    for (let i = 0; i < rng.range(3, 7); i++) {
      const w = spawnWildlife(rng, type, 0);
      w.vx = (rng.chance(0.5) ? 1 : -1) * rng.float(12, 20);
      wildlife.push(w);
    }
  } else if (roll < 0.35 && epoch >= 1) {
    // Double rainbow — purely visual, stored on vegState
    vegState.rainbow = { timer: rng.float(10, 20), opacity: 0 };
  } else if (roll < 0.45 && epoch >= 2) {
    // Ancient tree falls — big crash, starts fire
    startFire(rng.float(20, CANVAS_W - 20), waterY - rng.range(3, 8), rng);
    ripples.push({ x: rng.float(40, CANVAS_W - 40), y: waterY, radius: 0, maxRadius: 25, opacity: 1 });
  } else if (roll < 0.55 && epoch >= 2) {
    // Bioluminescence — water glows blue-green at night
    vegState.biolum = { timer: rng.float(15, 30), intensity: 0 };
  } else if (roll < 0.65 && epoch >= 3) {
    // Mass hatching — bunch of gator eggs appear
    for (let i = 0; i < rng.range(3, 6); i++) {
      const x = rng.float(20, CANVAS_W - 20);
      spawnGatorFromParents(rng, { x, y: waterY - rng.float(1, 4) },
        { speed: 1, maxSize: rng.float(1, 1.5), aggression: 0.5, fertility: 0.5, metabolism: 1,
          ...randomGatorColors(rng) }, null, maxGeneration);
    }
  } else if (roll < 0.72 && epoch >= 1) {
    // Frog chorus — tons of frogs spawn
    for (let i = 0; i < rng.range(6, 15); i++) {
      spawnPrey(rng);
    }
  } else if (roll < 0.80 && epoch >= 3) {
    // Primordial fog + cryptid appearance
    events.fog = events.fog || { timer: rng.float(15, 25), maxOpacity: 0.35, opacity: 0, phase: 'rising', totalDuration: 20 };
    const type = rng.pick(CRYPTID_TYPES);
    wildlife.push(spawnWildlife(rng, type, 0));
    wildlife.push(spawnWildlife(rng, type, 0));
  }
}

// --- Events ---
const events = createEventSystem();
events.onAlienSurvive = spawnAlienSurvivor;
events.onStartFire = startFire;
events.onTornadoPull = (tx, ty, range, dt, rng) => {
  for (const w of wildlife) {
    if (!w.alive) continue;
    const dist = Math.abs(w.x - tx);
    if (dist < range) {
      // Pull toward tornado center
      const pull = (1 - dist / range) * 50;
      w.vx += Math.sign(tx - w.x) * pull * dt;
      w.vy -= pull * 0.4 * dt;
      // Kill if sucked into center
      if (dist < 6) {
        w.alive = false;
        spawnDeathParticles(w.x, w.y, '#666666');
      }
    }
  }
};

// --- Persistence ---
const persistence = createPersistence(seed);

// --- Gator Color Generation ---
function randomGatorColors(rng) {
  const hue = rng.range(80, 140);
  const sat = rng.float(0.3, 0.7);
  const darkL = rng.float(0.12, 0.22);
  const bodyL = rng.float(0.28, 0.42);
  const bellyL = rng.float(0.45, 0.65);
  return {
    darkColor: hslToHex(hue, sat, darkL),
    bodyColor: hslToHex(hue, sat, bodyL),
    bellyColor: hslToHex(hue + rng.range(-10, 20), sat * 0.8, bellyL),
    scuteColor: hslToHex(hue + 5, sat * 0.9, bodyL * 0.85),
  };
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color)));
  };
  const r = f(0), g = f(8), b = f(4);
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// --- Spawn Gators ---
function spawnGator(rng, stage = 'adult') {
  const stageData = GATOR_STAGES[stage];
  const id = world.create();
  const colors = randomGatorColors(rng);

  world.add(id, 'transform', {
    x: rng.float(20, CANVAS_W - 40),
    y: waterY - rng.float(2, 8),
    vx: 0, vy: 0,
    direction: rng.chance(0.5) ? 1 : -1,
  });

  world.add(id, 'gator', {
    stage, frame: 'idle',
    spriteW: stageData.width, spriteH: stageData.height,
    sex: rng.chance(0.5) ? 'male' : 'female',
    age: 0, hunger: rng.float(0.1, 0.4), energy: rng.float(0.6, 1.0), health: 1.0,
    state: null, stateTimer: 0, targetId: null,
    blinkTimer: rng.float(2, 6), breatheTimer: rng.float(6, 12), breatheOffset: 0,
    inWater: false, generation: 0, mealCount: 0, sizeScale: 1,
    traits: {
      speed: rng.float(0.7, 1.3), maxSize: rng.float(0.8, 1.2),
      aggression: rng.float(0.2, 0.8), fertility: rng.float(0.3, 0.7),
      metabolism: rng.float(0.7, 1.3), ...colors,
    },
  });
  return id;
}

// --- Spawn Gator from Parents ---
let maxGeneration = 0;

function spawnGatorFromParents(rng, pos, motherTraits, fatherTraits, parentGen) {
  const stageData = GATOR_STAGES['egg'];
  const id = world.create();
  const traits = inheritTraits(motherTraits, fatherTraits, rng);
  const gen = (parentGen || 0) + 1;
  if (gen > maxGeneration) maxGeneration = gen;

  world.add(id, 'transform', {
    x: pos.x, y: pos.y, vx: 0, vy: 0,
    direction: rng.chance(0.5) ? 1 : -1,
  });

  world.add(id, 'gator', {
    stage: 'egg', frame: 'idle',
    spriteW: stageData.width, spriteH: stageData.height,
    sex: rng.chance(0.5) ? 'male' : 'female',
    age: 0, hunger: 0.2, energy: 1.0, health: 1.0,
    state: 'egg', stateTimer: 15,
    targetId: null, blinkTimer: 99, breatheTimer: 99, breatheOffset: 0,
    inWater: false, generation: gen, mealCount: 0, sizeScale: 1, traits,
  });
  return id;
}

// --- Initial Population ---
const initialCount = rng.range(4, 6);
for (let i = 0; i < initialCount; i++) {
  spawnGator(rng, rng.pick(['adult', 'adult', 'juvenile', 'juvenile', 'adult']));
}

// --- Rival Gator System ---
// Occasionally, a rival adult gator wanders in from the edge to compete
let rivalTimer = rng.float(10, 25);

function spawnRivalGator(rng) {
  const stageData = GATOR_STAGES['adult'];
  const id = world.create();
  const colors = randomGatorColors(rng);
  const fromLeft = rng.chance(0.5);

  world.add(id, 'transform', {
    x: fromLeft ? -10 : CANVAS_W + 10,
    y: waterY - rng.float(2, 6),
    vx: (fromLeft ? 1 : -1) * rng.float(5, 10),
    vy: 0,
    direction: fromLeft ? 1 : -1,
  });

  world.add(id, 'gator', {
    stage: 'adult', frame: 'idle',
    spriteW: stageData.width, spriteH: stageData.height,
    sex: 'male', // rivals are always aggressive males
    age: rng.float(10, 50), hunger: rng.float(0.3, 0.6), energy: rng.float(0.7, 1.0), health: 1.0,
    state: 'wandering', stateTimer: rng.float(5, 15), targetId: null,
    wanderDir: fromLeft ? 1 : -1,
    blinkTimer: rng.float(2, 6), breatheTimer: rng.float(6, 12), breatheOffset: 0,
    inWater: false, generation: 0, mealCount: 0, sizeScale: 1, isRival: true,
    traits: {
      speed: rng.float(1.0, 1.5),
      maxSize: rng.float(1.0, 1.4), // rivals tend to be bigger
      aggression: rng.float(0.6, 1.0), // more aggressive
      fertility: rng.float(0.3, 0.7),
      metabolism: rng.float(0.8, 1.2),
      ...colors,
    },
  });
  return id;
}

// --- Wildlife System — the swamp is ALIVE ---
let wildlife = [];

const WILDLIFE_TYPES = [
  'turtle', 'snake', 'bird', 'butterfly', 'raccoon', 'opossum',
  'heron_bg', 'nutria', 'crawfish', 'mosquito_swarm', 'egret',
  'armadillo', 'rabbit', 'deer',
  'water_moccasin', 'pelican', 'osprey', 'wild_boar', 'panther',
  'coyote', 'beaver', 'jeep', 'airboat',
];

const CRYPTID_TYPES = ['sasquatch', 'chupacabra', 'mothman'];

function spawnWildlife(rng, type, simTime) {
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

function updateWildlife(dt, simTime, rng) {
  // Spawn regular wildlife frequently
  // Spawn wildlife aggressively — the swamp should be teeming
  if (wildlife.length < 30) {
    // Multiple spawn attempts per frame for density
    const spawnAttempts = wildlife.length < 10 ? 3 : 1;
    for (let s = 0; s < spawnAttempts; s++) {
      if (rng.chance(0.4 * dt)) {
        const type = rng.pick(WILDLIFE_TYPES);
        wildlife.push(spawnWildlife(rng, type, simTime));
      }
    }
  }

  // Cryptid spawn — not that rare, this swamp is WEIRD
  if (rng.chance(0.02 * dt)) {
    const type = rng.pick(CRYPTID_TYPES);
    const cryptidCount = wildlife.filter(w => CRYPTID_TYPES.includes(w.type)).length;
    if (cryptidCount < 2) {
      wildlife.push(spawnWildlife(rng, type, simTime));
    }
  }

  // Human hunters — show up in boats or on foot
  if (rng.chance(0.012 * dt)) {
    const hunterCount = wildlife.filter(w => ['hunter_boat', 'hunter_foot', 'jeep', 'airboat'].includes(w.type)).length;
    if (hunterCount < 3) {
      const type = rng.pick(['hunter_boat', 'hunter_foot', 'hunter_foot', 'jeep', 'airboat']);
      wildlife.push(spawnWildlife(rng, type, simTime));
    }
  }

  // --- FOOD CHAIN ---
  // Who eats whom:
  // snake eats: crawfish, frog(prey), rabbit, mosquito_swarm
  // heron_bg/egret eats: crawfish, frog(prey), fish(prey), snake
  // raccoon eats: crawfish, frog(prey), turtle eggs (turtle)
  // opossum eats: crawfish, mosquito_swarm, insects
  // deer: herbivore, flees from everything
  // rabbit: herbivore, flees from everything
  // hawk(bird) eats: snake, rabbit, crawfish
  // sasquatch eats: deer, raccoon, opossum, nutria — top land predator
  // chupacabra eats: anything it can catch except cryptids/hunters
  // hunters hunt: gators, deer, sasquatch

  const FOOD_CHAIN = {
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
    const huntRange = 35;
    const killRange = 5;
    const fleeRange = 30;

    // --- FLEE from predators ---
    if (chain && chain.fears.length > 0) {
      for (const other of wildlife) {
        if (other === w || !other.alive) continue;
        if (!chain.fears.includes(other.type)) continue;
        const dist = Math.sqrt((other.x - w.x) ** 2 + (other.y - w.y) ** 2);
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
        const dist = Math.sqrt((gtr.x - w.x) ** 2 + (gtr.y - w.y) ** 2);
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
        const dist = Math.sqrt((other.x - w.x) ** 2 + (other.y - w.y) ** 2);
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
          const dist = Math.sqrt((ptr.x - w.x) ** 2 + (ptr.y - w.y) ** 2);
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
              spawnDeathParticles(closest.x, closest.y);
            } else {
              // Failed hunt, take damage
              w.hp -= 1;
              spawnDeathParticles(w.x, w.y);
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
        break; // handled below
      case 'alien': {
        // Panicked alien with raygun — shoots at nearby gators
        w.raygunTimer = (w.raygunTimer || 0) - dt;
        if (w.panicking) {
          w.vx += rng.float(-8, 8) * dt;
          if (rng.chance(0.2 * dt)) w.vx *= -1;
        }
        // Shoot raygun at nearby gators
        if (w.raygunTimer <= 0) {
          for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
            if (gator.stage === 'egg') continue;
            const dist = Math.sqrt((gtr.x - w.x) ** 2 + (gtr.y - w.y) ** 2);
            if (dist < 25) {
              // ZAP! — raygun hit
              gator.health -= 0.15;
              w.raygunTimer = rng.float(1, 2.5);
              w.lastZapX = gtr.x + (gator.spriteW || 10) / 2;
              w.lastZapY = gtr.y;
              w.zapFlash = 0.2;
              if (gator.health <= 0) {
                world.kill(gid);
              }
              break;
            }
          }
          if (w.raygunTimer <= 0) w.raygunTimer = rng.float(0.5, 1.5);
        }
        if (w.zapFlash) w.zapFlash -= dt;
        break;
      }
    }

    // --- Gravity for land animals ---
    if (['deer', 'rabbit', 'raccoon', 'opossum', 'armadillo', 'sasquatch', 'chupacabra', 'hunter_foot', 'alien', 'wild_boar', 'panther', 'coyote', 'jeep'].includes(w.type)) {
      w.vy = (w.vy || 0) + 15 * dt;
      if (w.y > waterY - 2) { w.y = waterY - 2; w.vy = Math.min(0, w.vy); }
    }

    // --- HUNTERS vs EVERYTHING ---
    if (['hunter_foot', 'hunter_boat', 'jeep', 'airboat'].includes(w.type)) {
      w.huntTimer = (w.huntTimer || 0) - dt;
      if (w.huntTimer <= 0) {
        // Find nearest target — gators preferred, but will shoot anything
        let target = null;
        let targetDist = 35;
        let targetIsGator = false;

        // Check gators first (primary target)
        for (const [gid, gtr, gator] of world.query('transform', 'gator')) {
          if (gator.stage === 'egg') continue;
          const dist = Math.sqrt((gtr.x - w.x) ** 2 + (gtr.y - w.y) ** 2);
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
          const dist = Math.sqrt((other.x - w.x) ** 2 + (other.y - w.y) ** 2);
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
                spawnDeathParticles(target.tr.x + 5, target.tr.y + 3);
                w.muzzleFlash = 0.15; // gun flash
                if (target.gator.health <= 0) world.kill(target.id);
                w.vx *= -1;
              }
            } else {
              // Wildlife fight — hunter usually wins but cryptids fight back
              const targetPower = (target.hp || 1) * rng.float(0.3, 1.5);
              const hunterPower = rng.float(1, 2.5);
              if (hunterPower > targetPower) {
                target.alive = false;
                spawnDeathParticles(target.x, target.y);
              } else {
                // Target fights back — hunter takes damage
                w.hp -= 1;
                spawnDeathParticles(w.x, w.y);
                if (w.hp <= 0) w.alive = false;
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
      if (CRYPTID_TYPES.includes(w.type)) continue;
      if (['bird', 'egret', 'butterfly', 'mosquito_swarm', 'mothman', 'hunter_foot', 'hunter_boat', 'jeep', 'airboat', 'panther', 'pelican', 'osprey'].includes(w.type)) continue;
      // Aliens fight back but can be eaten

      const sizeScale = gator.sizeScale || 1;
      const eatDist = (gator.spriteW || 10) * 0.5 * sizeScale;
      const dist = Math.sqrt((tr.x + (gator.spriteW || 10) / 2 - w.x) ** 2 + (tr.y - w.y) ** 2);
      if (dist < eatDist) {
        // Fight check for bigger prey
        if (['deer', 'raccoon', 'nutria'].includes(w.type) && gator.stage === 'juvenile') {
          if (rng.chance(0.4)) continue; // juvenile might fail
        }
        // Alien fight — they resist with rayguns
        if (w.type === 'alien') {
          const gatorPower = (gator.sizeScale || 1) * rng.float(0.5, 1.5);
          if (gatorPower < 0.6) {
            // Alien zaps gator, escapes
            gator.health -= 0.2;
            w.zapFlash = 0.3;
            w.lastZapX = tr.x; w.lastZapY = tr.y;
            continue;
          }
        }
        w.alive = false;
        const mealValue = w.type === 'deer' ? 0.4 : w.type === 'alien' ? 0.3 : 0.2;
        gator.hunger = Math.max(0, gator.hunger - mealValue);
        gator.frame = 'eat';
        gator.state = 'eating';
        gator.stateTimer = 0.5;
        gator.mealCount = (gator.mealCount || 0) + (w.type === 'deer' ? 4 : w.type === 'alien' ? 3 : 2);
        const maxS = (gator.traits?.maxSize || 1) * 2.0;
        gator.sizeScale = Math.min(maxS, 1 + gator.mealCount * 0.02);
        spawnDeathParticles(w.x, w.y, w.type === 'alien' ? '#33ff33' : '#882222');
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

    if (w.life <= 0 || w.x < -20 || w.x > CANVAS_W + 20 || w.y < -20 || w.y > CANVAS_H + 10) {
      wildlife.splice(i, 1);
    }
  }
}

function renderWildlife(ctx, simTime) {
  for (const w of wildlife) {
    if (!w.alive) continue;
    const px = Math.floor(w.x);
    const py = Math.floor(w.y);
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
        break;
      }
    }
  }
}

// --- Food ---
let foodSpawnTimer = rng.float(FOOD_SPAWN_MIN, FOOD_SPAWN_MAX);

const PREY_TYPES = {
  fly:  { sprites: [FLY_1, FLY_2],             value: 0.08, spawnAboveWater: true,  speed: 12 },
  fish: { sprites: [FISH_SMALL_1, FISH_SMALL_2], value: 0.15, spawnAboveWater: false, speed: 8 },
  frog: { sprites: [FROG_1, FROG_2],           value: 0.12, spawnAboveWater: true,  speed: 5 },
};

function spawnPrey(rng) {
  const type = rng.pick(['fly', 'fly', 'fish', 'fish', 'frog', 'frog', 'frog']);
  const config = PREY_TYPES[type];
  const id = world.create();

  let x, y;
  if (type === 'frog') {
    // Frogs spawn on-screen near water
    x = rng.float(15, CANVAS_W - 15);
    y = waterY - rng.float(2, 6);
  } else if (config.spawnAboveWater) {
    x = rng.chance(0.5) ? -5 : CANVAS_W + 5;
    y = rng.float(waterY - 30, waterY - 5);
  } else {
    x = rng.chance(0.5) ? -5 : CANVAS_W + 5;
    y = rng.float(waterY + 5, CANVAS_H - 10);
  }

  world.add(id, 'transform', { x, y, vx: (x < 0 ? 1 : -1) * rng.float(config.speed * 0.5, config.speed), vy: 0, direction: x < 0 ? 1 : -1 });
  world.add(id, 'prey', { type, alive: true, value: config.value, sprite: config.sprites[0], sprites: config.sprites, animTimer: 0, animFrame: 0, baseY: y, buzzTimer: 0 });
  return id;
}

function preySystem(world, dt, simTime, rng) {
  for (const [id, tr, prey] of world.query('transform', 'prey')) {
    if (!prey.alive) continue;

    prey.animTimer += dt;
    if (prey.animTimer > (prey.type === 'fly' ? 0.08 : 0.25)) {
      prey.animTimer = 0;
      prey.animFrame = (prey.animFrame + 1) % prey.sprites.length;
      prey.sprite = prey.sprites[prey.animFrame];
    }

    switch (prey.type) {
      case 'fly':
        prey.buzzTimer -= dt;
        if (prey.buzzTimer <= 0) {
          tr.vx += rng.float(-8, 8); tr.vy += rng.float(-6, 6);
          prey.buzzTimer = rng.float(0.1, 0.4);
        }
        tr.vx *= 0.98; tr.vy *= 0.98;
        if (tr.y > waterY - 3) tr.vy -= 15 * dt;
        if (tr.y < 5) tr.vy += 10 * dt;
        if (tr.x < 5) tr.vx += 10 * dt;
        if (tr.x > CANVAS_W - 5) tr.vx -= 10 * dt;
        break;
      case 'fish':
        tr.y = prey.baseY + Math.sin(simTime * 1.5 + id * 3) * 4;
        if (tr.y < waterY + 3) tr.y = waterY + 3;
        break;
      case 'frog':
        prey.buzzTimer -= dt;
        // Frogs hunt flies!
        let chasedFly = false;
        for (const [fid, ftr, fprey] of world.query('transform', 'prey')) {
          if (fprey.type !== 'fly' || !fprey.alive) continue;
          const dist = Math.sqrt((ftr.x - tr.x) ** 2 + (ftr.y - tr.y) ** 2);
          if (dist < 20) {
            // Leap toward fly
            const dx = ftr.x - tr.x;
            const dy = ftr.y - tr.y;
            tr.vx = (dx / dist) * 15;
            tr.vy = (dy / dist) * 15;
            chasedFly = true;
            // Eat if close
            if (dist < 4) {
              fprey.alive = false;
              world.kill(fid);
              prey.value += 0.02; // frog gets fatter
            }
            break;
          }
        }
        if (!chasedFly) {
          if (prey.buzzTimer <= 0) {
            tr.vx = rng.float(-3, 3); tr.vy = -rng.float(3, 8);
            prey.buzzTimer = rng.float(1.5, 4);
          }
        }
        tr.vy += 15 * dt;
        if (tr.y > waterY - 2) { tr.y = waterY - 2; tr.vy = 0; }
        break;
    }
  }
}

// --- Ambient Particles ---
let ambientParticles = [];

function updateAmbientParticles(dt, simTime, rng) {
  // Spawn new particles
  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;

  // Fireflies at night (especially in swamp-like conditions)
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

function renderAmbientParticles(ctx, simTime) {
  for (const p of ambientParticles) {
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

// --- Auto-ripples from gator movement ---
let gatorRippleTimer = 0;

function updateGatorRipples(dt, rng) {
  gatorRippleTimer -= dt;
  if (gatorRippleTimer > 0) return;
  gatorRippleTimer = rng.float(1.5, 4);

  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    if (gator.stage === 'egg') continue;
    if (gator.inWater && (gator.state === 'wandering' || gator.state === 'hunting' || gator.state === 'swimming')) {
      ripples.push({
        x: tr.x + (gator.spriteW || 10) / 2,
        y: waterY,
        radius: 0,
        maxRadius: 5 + (gator.spriteW || 10) / 4,
        opacity: 0.4,
      });
      break; // one ripple per cycle
    }
    // Idle gators occasionally cause subtle ripples
    if (gator.inWater && rng.chance(0.3)) {
      ripples.push({
        x: tr.x + (gator.spriteW || 10) / 2,
        y: waterY,
        radius: 0,
        maxRadius: 3,
        opacity: 0.2,
      });
      break;
    }
  }
}

// --- God Powers ---
let ripples = [];

// --- FIRE SYSTEM ---
let fires = [];

// --- DEATH PARTICLES — small blood/impact splatter ---
let deathParticles = [];

function spawnDeathParticles(x, y, color = '#882222') {
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    deathParticles.push({
      x, y,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 15 - 3,
      life: 0.5 + Math.random() * 0.8,
      color,
    });
  }
}

function updateDeathParticles(dt) {
  for (let i = deathParticles.length - 1; i >= 0; i--) {
    const p = deathParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 25 * dt; // gravity
    p.life -= dt;
    if (p.life <= 0) deathParticles.splice(i, 1);
  }
}

function renderDeathParticles(ctx) {
  for (const p of deathParticles) {
    const alpha = Math.min(1, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function startFire(x, y, rng) {
  // Only on land (above water)
  if (y > waterY - 1) return;
  // Don't stack fires
  if (fires.some(f => Math.abs(f.x - x) < 5)) return;
  fires.push({
    x: Math.floor(x),
    y: Math.floor(y),
    intensity: rng.float(0.5, 1),
    life: rng.float(10, 25),
    spreadTimer: rng.float(2, 5),
    width: rng.range(3, 6),
  });
}

function updateFires(dt, rng) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i];
    f.life -= dt;
    f.intensity = Math.min(1, f.intensity + dt * 0.05);

    // Spread
    f.spreadTimer -= dt;
    if (f.spreadTimer <= 0 && fires.length < 8) {
      f.spreadTimer = rng.float(3, 8);
      if (rng.chance(0.4)) {
        const dir = rng.chance(0.5) ? -1 : 1;
        startFire(f.x + dir * rng.range(4, 10), f.y + rng.float(-2, 2), rng);
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
      fires.splice(i, 1);
    }
  }
}

function renderFires(ctx, simTime) {
  for (const f of fires) {
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

// --- Cursor tracking for power glow ---
let cursorX = -1, cursorY = -1;

function activatePower(x, y, type) {
  switch (type) {
    case 'food': {
      const foodType = y < waterY ? 'fly' : 'fish';
      const config = PREY_TYPES[foodType];
      const id = world.create();
      world.add(id, 'transform', { x, y, vx: 0, vy: 0, direction: 1 });
      world.add(id, 'prey', { type: foodType, alive: true, value: config.value, sprite: config.sprites[0], sprites: config.sprites, animTimer: 0, animFrame: 0, baseY: y, buzzTimer: 0 });
      ripples.push({ x, y, radius: 0, maxRadius: 8, opacity: 1 });
      break;
    }
    case 'rain': {
      env.weather = 'rain';
      env.rainIntensity = 0.8;
      env.weatherTimer = 15;
      env.foodMultiplier = 2.0;
      ripples.push({ x, y, radius: 0, maxRadius: 15, opacity: 1 });
      break;
    }
    case 'scare': {
      scarePredators(world, x, y, 60);
      ripples.push({ x, y, radius: 0, maxRadius: 20, opacity: 1 });
      break;
    }
    case 'lightning': {
      // Spawn a lightning bolt at the given x position
      const bolt = { x, segments: [], life: 0.3 };
      let bx = x;
      let by = 0;
      while (by < waterY + 10) {
        const nextX = bx + (Math.random() - 0.5) * 10;
        const nextY = by + 5 + Math.random() * 10;
        bolt.segments.push({ x1: bx, y1: by, x2: nextX, y2: nextY });
        bx = nextX;
        by = nextY;
      }
      events.lightningBolts.push(bolt);
      events.lightningFlash = 1;
      // Damage nearby gators slightly
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        if (Math.abs(tr.x + (gator.spriteW || 10) / 2 - x) < 6) {
          if (Math.random() < 0.15) {
            gator.health -= 0.5;
            if (gator.health <= 0) world.kill(id);
            break;
          }
        }
      }
      ripples.push({ x, y: waterY, radius: 0, maxRadius: 25, opacity: 1 });
      break;
    }
    case 'heal': {
      // Find nearest gator within 30px and heal it
      let nearestId = null, nearestDist = 30, nearestTr = null, nearestGator = null;
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        const dx = tr.x - x, dy = tr.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = id;
          nearestTr = tr;
          nearestGator = gator;
        }
      }
      if (nearestGator) {
        nearestGator.health = Math.min(1, nearestGator.health + 0.3);
        nearestGator.hunger = Math.max(0, nearestGator.hunger - 0.2);
        // Spawn green heal particles
        for (let i = 0; i < 6; i++) {
          deathParticles.push({
            x: nearestTr.x + (Math.random() - 0.5) * 8,
            y: nearestTr.y - Math.random() * 6,
            vx: (Math.random() - 0.5) * 10,
            vy: -Math.random() * 12 - 3,
            life: 0.5 + Math.random() * 0.5,
            color: i % 2 === 0 ? '#44dd44' : '#88ff88',
          });
        }
      }
      ripples.push({ x, y, radius: 0, maxRadius: 10, opacity: 1 });
      break;
    }
    case 'fire': {
      startFire(x, y, rng);
      ripples.push({ x, y, radius: 0, maxRadius: 12, opacity: 1 });
      break;
    }
  }
}

function triggerScare(x, y) {
  scarePredators(world, x, y, 60);
  ripples.push({ x, y, radius: 0, maxRadius: 20, opacity: 1 });
}

createInputHandler(canvas, {
  onPower: activatePower,
  onScare: triggerScare,
  onMove: (x, y) => { cursorX = x; cursorY = y; },
});

// --- Predator Rendering ---
function renderPredators(ctx, world) {
  for (const [id, tr, pred] of world.query('transform', 'predator')) {
    if (pred.sprite) {
      drawSprite(ctx, pred.sprite, Math.floor(tr.x), Math.floor(tr.y), tr.direction === -1);
    }
  }
}

// --- Ripple Rendering ---
function renderRipples(ctx, dt) {
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += dt * 15;
    r.opacity -= dt * 1.2;

    if (r.opacity <= 0 || r.radius > r.maxRadius) {
      ripples.splice(i, 1);
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

// --- Extended UI ---
function renderFullUI(ctx, simTime) {
  ctx.fillStyle = '#334433';

  // Bottom left: pop and generation
  const gatorCount = world.count('gator');
  drawPixelText(ctx, `pop:${gatorCount}`, 2, CANVAS_H - 6);
  drawPixelText(ctx, `gen:${maxGeneration}`, 2, CANVAS_H - 13);

  // Top left: god mode indicator
  if (isGodMode()) {
    const powerIdx = getCurrentPower();
    const powerName = POWER_NAMES[powerIdx];
    const powerColor = POWER_COLORS[powerIdx];
    ctx.fillStyle = powerColor;
    drawPixelText(ctx, `god:${powerName}`, 2, 3);
    ctx.fillStyle = '#556655';
    drawPixelText(ctx, `[${powerIdx + 1}]`, 2 + (5 + powerName.length) * 4, 3);
  }

  // Bottom right: seed and season
  const seedText = `seed:${seed.length > 12 ? seed.slice(-12) : seed}`;
  drawPixelText(ctx, seedText, CANVAS_W - seedText.length * 4 - 2, CANVAS_H - 6);

  // Season + day count + moon phase
  const moonPhases = ['new', 'wax', 'half', 'gib', 'full', 'gib', 'half', 'wan'];
  const moonIndex = Math.floor((env.lunarPhase || 0) * 8) % 8;
  const epochName = EPOCH_NAMES[vegState.epoch] || '';
  const infoText = `${env.season} d${env.dayCount || 0}`;
  // Show epoch in top-right when not in god mode
  if (!isGodMode() && vegState.epoch > 0) {
    ctx.fillStyle = '#445544';
    drawPixelText(ctx, epochName, CANVAS_W - epochName.length * 4 - 2, 3);
  }
  drawPixelText(ctx, infoText, CANVAS_W - infoText.length * 4 - 2, CANVAS_H - 13);

  // Weather indicator
  if (env.weather !== 'clear') {
    const weatherText = env.weather;
    ctx.fillStyle = env.weather === 'storm' ? '#554444' : '#334433';
    drawPixelText(ctx, weatherText, CANVAS_W - weatherText.length * 4 - 2, CANVAS_H - 20);
  }

  // Cursor glow — only in god mode
  if (isGodMode() && cursorX >= 0 && cursorY >= 0) {
    const pidx = getCurrentPower();
    const pcolor = POWER_COLORS[pidx];
    const pulse = 0.4 + 0.3 * Math.sin(simTime * 5);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = pcolor;
    ctx.fillRect(cursorX - 1, cursorY - 1, 3, 3);
    ctx.globalAlpha = pulse * 0.3;
    ctx.fillRect(cursorX - 2, cursorY - 2, 5, 5);
    ctx.globalAlpha = 1;
  }
}

// --- Save on unload ---
window.addEventListener('beforeunload', () => {
  persistence.save(world, env, simTime, maxGeneration);
});

// --- Game Loop ---
let lastTime = 0;
let simTime = 0;
let gameOver = false;
let gameOverTimer = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  if (dt > MAX_DT) dt = MAX_DT;
  lastTime = timestamp;
  simTime += dt;

  // Environment
  environmentSystem(env, dt, rng);

  // Food spawning (affected by environment)
  foodSpawnTimer -= dt;
  const effectiveFoodMax = Math.floor(MAX_FOOD * env.foodMultiplier);
  if (foodSpawnTimer <= 0 && world.count('prey') < effectiveFoodMax) {
    spawnPrey(rng);
    foodSpawnTimer = rng.float(FOOD_SPAWN_MIN, FOOD_SPAWN_MAX) / env.foodMultiplier;
  }

  // Systems
  preySystem(world, dt, simTime, rng);
  aiSystem(world, dt, rng, waterY);
  breedingSystem(world, dt, rng, waterY, spawnGatorFromParents);
  lifecycleSystem(world, dt, rng);
  predatorSystem(world, dt, rng, waterY, simTime);
  physicsSystem(world, dt, terrain, waterY);
  updateAmbientParticles(dt, simTime, rng);
  updateGatorRipples(dt, rng);
  updateWildlife(dt, simTime, rng);
  updateEvents(events, world, dt, rng, waterY, simTime, env);
  updateFires(dt, rng);
  updateVegGrowth(dt);
  updateDeathParticles(dt);

  // Hurricane pushes everything
  if (events.hurricane) {
    const wind = events.hurricane.windSpeed * dt;
    for (const w of wildlife) { w.x += wind; }
    for (const [id, tr] of world.query('transform', 'gator')) { tr.x += wind * 0.3; }
    for (const [id, tr] of world.query('transform', 'prey')) { tr.x += wind * 0.5; }
  }

  // Rival gators
  rivalTimer -= dt;
  if (rivalTimer <= 0) {
    const gatorCount = world.count('gator');
    if (gatorCount > 2 && gatorCount < 15) {
      spawnRivalGator(rng);
    }
    rivalTimer = rng.float(12, 30);
  }

  // Population check — GAME OVER if all gators die
  if (world.count('gator') === 0 && !gameOver) {
    gameOver = true;
    gameOverTimer = 0;
  }

  world.flush();

  // Auto-save
  if (persistence.shouldAutoSave(dt)) {
    persistence.save(world, env, simTime, maxGeneration);
  }

  // --- Render ---
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const frameVegRng = createRNG(rng._seed + 999);

  renderSky(ctx, waterY, simTime);
  renderCelestial(ctx, env, waterY, simTime);
  renderSkyLife(ctx, waterY, simTime, frameVegRng);
  renderTerrain(ctx, terrain, waterY);
  renderWater(ctx, waterY, simTime);
  renderUnderwaterLife(ctx, waterY, simTime, frameVegRng);
  renderVegetation(ctx, terrain, waterY, frameVegRng, simTime, vegState);
  renderPrey(ctx, world, simTime);
  renderGators(ctx, world);
  renderPredators(ctx, world);
  renderRipples(ctx, dt);
  renderWildlife(ctx, simTime);
  renderAmbientParticles(ctx, simTime);
  renderDeathParticles(ctx);
  renderFires(ctx, simTime);
  renderEvents(ctx, events, simTime, waterY);
  renderEnvironmentEffects(ctx, env, waterY, simTime);
  renderFullUI(ctx, simTime);

  // GAME OVER screen
  if (gameOver) {
    gameOverTimer += dt;
    const fadeIn = Math.min(1, gameOverTimer * 0.5);

    // Dark overlay
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeIn * 0.7})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (gameOverTimer > 1) {
      // Title
      ctx.fillStyle = `rgba(200, 50, 50, ${fadeIn})`;
      const title = 'all your gators is dead';
      drawPixelText(ctx, title, Math.floor(CANVAS_W / 2 - title.length * 2), Math.floor(CANVAS_H * 0.35));

      if (gameOverTimer > 2.5) {
        // Start Over button
        const btnText = 'start over';
        const btnX = Math.floor(CANVAS_W / 2 - btnText.length * 2);
        const btnY = Math.floor(CANVAS_H * 0.55);

        // Button bg
        ctx.fillStyle = `rgba(60, 80, 60, ${fadeIn * 0.8})`;
        ctx.fillRect(btnX - 4, btnY - 3, btnText.length * 4 + 8, 11);
        ctx.fillStyle = `rgba(80, 120, 80, ${fadeIn})`;
        ctx.fillRect(btnX - 3, btnY - 2, btnText.length * 4 + 6, 9);

        ctx.fillStyle = `rgba(200, 220, 200, ${fadeIn})`;
        drawPixelText(ctx, btnText, btnX, btnY);

        // Store button bounds for click detection
        gameOverBtn = { x: btnX - 4, y: btnY - 3, w: btnText.length * 4 + 8, h: 11 };
      }
    }
  }

  requestAnimationFrame(gameLoop);
}

let gameOverBtn = null;

// Game over click handler
canvas.addEventListener('pointerup', (e) => {
  if (!gameOver || !gameOverBtn || gameOverTimer < 2.5) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / rect.width * CANVAS_W);
  const y = Math.floor((e.clientY - rect.top) / rect.height * CANVAS_H);
  if (x >= gameOverBtn.x && x <= gameOverBtn.x + gameOverBtn.w &&
      y >= gameOverBtn.y && y <= gameOverBtn.y + gameOverBtn.h) {
    // RESTART
    gameOver = false;
    gameOverTimer = 0;
    gameOverBtn = null;
    maxGeneration = 0;
    wildlife.length = 0;
    fires.length = 0;
    deathParticles.length = 0;
    for (let i = 0; i < rng.range(4, 6); i++) {
      spawnGator(rng, rng.pick(['adult', 'adult', 'juvenile']));
    }
  }
});

requestAnimationFrame(gameLoop);
