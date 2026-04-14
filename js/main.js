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
import { initAudio, resumeAudio, updateAudio, playSplash, playThunder, playEat, playZap, playDeathTone, setUFO, playExplosion } from './audio.js';
import { createFireState, startFire, updateFires, renderFires } from './game/fire.js';
import { createParticleState, spawnDeathParticles, updateDeathParticles, renderDeathParticles, updateAmbientParticles, renderAmbientParticles, addRipple, renderRipples, updateGatorRipples } from './game/particles.js';
import { WILDLIFE_TYPES, CRYPTID_TYPES, FOOD_CHAIN, createWildlifeState, spawnWildlife, spawnAlienSurvivor, updateWildlife, renderWildlife } from './game/wildlife.js';

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

// Audio — init and start on overlay click
initAudio();
const startOverlay = document.getElementById('start-overlay');
function enterSwamp() {
  resumeAudio();
  if (startOverlay) startOverlay.classList.add('hidden');
}
if (startOverlay) {
  // touchend is more reliable than touchstart for iOS audio unlock
  startOverlay.addEventListener('touchend', (e) => { e.preventDefault(); enterSwamp(); }, { once: true });
  startOverlay.addEventListener('click', enterSwamp, { once: true });
}
// Fallback — any interaction unlocks audio
document.addEventListener('keydown', () => resumeAudio(), { once: true });
document.addEventListener('touchstart', () => resumeAudio(), { once: true });

// --- Orientation Detection ---
// JS-based because CSS media queries fail in Instagram/TikTok/Facebook/Twitter in-app browsers
const rotatePrompt = document.getElementById('rotate-prompt');

function checkOrientation() {
  // Use window dimensions — most reliable across all browsers including in-app webviews
  const w = window.innerWidth || document.documentElement.clientWidth;
  const h = window.innerHeight || document.documentElement.clientHeight;
  const isPortrait = h > w && w < 768;

  if (isPortrait) {
    document.body.classList.add('show-rotate');
    if (rotatePrompt) rotatePrompt.classList.add('visible');
  } else {
    document.body.classList.remove('show-rotate');
    if (rotatePrompt) rotatePrompt.classList.remove('visible');
  }
}

checkOrientation();
window.addEventListener('resize', checkOrientation);
// screen.orientation API — works on Android, some in-app browsers
if (screen.orientation) {
  screen.orientation.addEventListener('change', checkOrientation);
}
// Fallback for iOS and older browsers
window.addEventListener('orientationchange', checkOrientation);
// In-app browsers sometimes fire this late — recheck after a delay
window.addEventListener('load', () => setTimeout(checkOrientation, 500));

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
    vegState.maxGrowth = 1.2 + newEpoch * 0.5; // 1.2 -> 1.7 -> 2.2 -> 2.7 -> 3.2
  }

  const seasonGrowthRate = {
    spring: 0.01,
    summer: 0.005,
    autumn: -0.002,
    winter: -0.004,
  };
  const rate = seasonGrowthRate[env.season] || 0;
  const weatherMod = env.weather === 'rain' ? 1.5 : env.weather === 'storm' ? 0.8 : env.weather === 'clear' ? 0.7 : 1.0;
  const fireDamage = fireState.fires.length * -0.01;

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
      wildlifeState.wildlife.push(spawnWildlife(rng, swarmType, 0, waterY));
    }
  } else if (roll < 0.25) {
    // Stampede — deer or boar run through
    const type = rng.pick(['deer', 'deer', 'wild_boar']);
    for (let i = 0; i < rng.range(3, 7); i++) {
      const w = spawnWildlife(rng, type, 0, waterY);
      w.vx = (rng.chance(0.5) ? 1 : -1) * rng.float(12, 20);
      wildlifeState.wildlife.push(w);
    }
  } else if (roll < 0.35 && epoch >= 1) {
    // Double rainbow — purely visual, stored on vegState
    vegState.rainbow = { timer: rng.float(10, 20), opacity: 0 };
  } else if (roll < 0.45 && epoch >= 2) {
    // Ancient tree falls — big crash, starts fire
    startFire(fireState, rng.float(20, CANVAS_W - 20), waterY - rng.range(3, 8), rng, waterY);
    addRipple(particles, rng.float(40, CANVAS_W - 40), waterY, 25, 1);
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
    wildlifeState.wildlife.push(spawnWildlife(rng, type, 0, waterY));
    wildlifeState.wildlife.push(spawnWildlife(rng, type, 0, waterY));
  }
}

// --- Events ---
const events = createEventSystem();
events.onAlienSurvive = (x, y, rng) => spawnAlienSurvivor(wildlifeState, x, y, rng, waterY);
events.onStartFire = (x, y, rng) => startFire(fireState, x, y, rng, waterY);
events.onThunder = () => playThunder(Math.random() * 0.7);
events.onExplosion = () => playExplosion();
events.onGatorDeath = () => playDeathTone();
events.onTornadoPull = (tx, ty, range, dt, rng) => {
  for (const w of wildlifeState.wildlife) {
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
        spawnDeathParticles(particles, w.x, w.y, '#666666');
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

// --- Wildlife System ---
const wildlifeState = createWildlifeState();

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


// --- God Powers ---

// --- FIRE SYSTEM ---
const fireState = createFireState();

// --- PARTICLE SYSTEMS ---
const particles = createParticleState();


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
      addRipple(particles, x, y, 8, 1);
      playSplash(0.5);
      break;
    }
    case 'rain': {
      env.weather = 'rain';
      env.rainIntensity = 0.8;
      env.weatherTimer = 15;
      env.foodMultiplier = 2.0;
      addRipple(particles, x, y, 15, 1);
      break;
    }
    case 'scare': {
      scarePredators(world, x, y, 60);
      addRipple(particles, x, y, 20, 1);
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
      addRipple(particles, x, waterY, 25, 1);
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
          particles.deathParticles.push({
            x: nearestTr.x + (Math.random() - 0.5) * 8,
            y: nearestTr.y - Math.random() * 6,
            vx: (Math.random() - 0.5) * 10,
            vy: -Math.random() * 12 - 3,
            life: 0.5 + Math.random() * 0.5,
            color: i % 2 === 0 ? '#44dd44' : '#88ff88',
          });
        }
      }
      addRipple(particles, x, y, 10, 1);
      break;
    }
    case 'fire': {
      startFire(fireState, x, y, rng, waterY);
      addRipple(particles, x, y, 12, 1);
      break;
    }
  }
}

function triggerScare(x, y) {
  scarePredators(world, x, y, 60);
  addRipple(particles, x, y, 20, 1);
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
  updateAmbientParticles(particles, dt, simTime, rng, env, waterY);
  updateGatorRipples(particles, world, dt, rng, waterY);
  updateWildlife(wildlifeState, dt, simTime, rng, world, waterY, { spawnDeathParticles, spawnPrey, particles, playZap, playEat });
  updateEvents(events, world, dt, rng, waterY, simTime, env);
  updateFires(fireState, dt, rng, wildlifeState.wildlife, world, env, waterY);
  updateVegGrowth(dt);
  updateAudio(dt, env, simTime);

  // Audio hooks for events
  if (events.ufo) { setUFO(true); } else { setUFO(false); }
  updateDeathParticles(particles, dt);

  // Hurricane pushes everything
  if (events.hurricane) {
    const wind = events.hurricane.windSpeed * dt;
    for (const w of wildlifeState.wildlife) { w.x += wind; }
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
  renderRipples(ctx, particles, dt);
  renderWildlife(ctx, wildlifeState, simTime);
  renderAmbientParticles(ctx, particles, simTime);
  renderDeathParticles(ctx, particles);
  renderFires(ctx, fireState, simTime);
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
    wildlifeState.wildlife.length = 0;
    fireState.fires.length = 0;
    particles.deathParticles.length = 0;
    for (let i = 0; i < rng.range(4, 6); i++) {
      spawnGator(rng, rng.pick(['adult', 'adult', 'juvenile']));
    }
  }
});

requestAnimationFrame(gameLoop);
