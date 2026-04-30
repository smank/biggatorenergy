import { createRNG, seedFromHash } from './rng.js';
import { CANVAS_W, CANVAS_H, TICK_RATE, MAX_DT, WATER_LINE, FOOD_SPAWN_MIN, FOOD_SPAWN_MAX, MAX_FOOD } from './config.js';
import { GATOR_STAGES, TINT_COLORS } from './sprites/gator-sprites.js';
import { FLY_1, FLY_2, FISH_SMALL_1, FISH_SMALL_2, FROG_1, FROG_2 } from './sprites/fauna-sprites.js';
import { World } from './ecs.js';
import { aiSystem } from './systems/ai.js';
import { physicsSystem } from './systems/physics.js';
import { lifecycleSystem } from './systems/lifecycle.js';
import { breedingSystem, inheritTraits } from './systems/breeding.js';
import { predatorSystem, scarePredators } from './systems/predator.js';
import { createEnvironment, environmentSystem, renderCelestial, renderEnvironmentEffects, getSeasonText, maybeInjectAcidRain } from './systems/environment.js';
import { drawSprite, drawPixelText, renderSky, renderRainbow, renderTerrain, renderWater, renderVegetation, renderGators, renderPrey, renderUnderwaterLife, renderSkyLife, renderUI, renderSmokestacks } from './systems/render.js';
import { createInputHandler, getCurrentPower, isGodMode, POWER_NAMES, POWER_COLORS, getSpeedMultiplier, isPaused, getSpeedLabel, togglePause, cycleSpeed } from './input.js';
import { createPersistence } from './state.js';
import { createEventSystem, updateEvents, renderEvents } from './systems/events.js';
import { initAudio, resumeAudio, updateAudio, playSplash, playThunder, playEat, playZap, playDeathTone, setUFO, playExplosion, toggleMute, isMuted, setEpoch, playGatorStare, playEggHatch } from './audio.js';
import { createFireState, startFire, updateFires, renderFires } from './game/fire.js';
import { createParticleState, spawnDeathParticles, updateDeathParticles, renderDeathParticles, updateAmbientParticles, renderAmbientParticles, addRipple, renderRipples, updateGatorRipples } from './game/particles.js';
import { WILDLIFE_TYPES, CRYPTID_TYPES, FOOD_CHAIN, createWildlifeState, spawnWildlife, spawnAlienSurvivor, updateWildlife, renderWildlife } from './game/wildlife.js';
import { MODE_TERRARIUM, MODE_DYNASTY, randomGatorName, randomDynastyName, countLivingBloodline, loadLineagePoints, saveLineagePoints, updateEraClock, renderEraHUD, initEraDynasty, getCurrentEra, ERA_FLAVOR } from './game/dynasty.js';
import { initInspector, openInspectorAt, openInspectorForGator, closeInspector } from './systems/inspector.js';
import { UNLOCKS, purchase, loadPurchasedUnlocks, applyUnlocksToFounderRoll, applyUnlocksToFounderColors, getMaxRerolls } from './game/unlocks.js';
import { loadObituary, updateMoments, renderMoments, renderObituaryPanel } from './game/obituary.js';
import { attachLineage } from './game/dynasty.js';
import { buildTree, getLivingSuccessors, setPlayerGator } from './systems/lineage.js';
import { initPlayerControl, dispatchClick, dispatchHold, setPlayerControlDynasty, setPlayerControlWildlife, hoverState } from './systems/playerControl.js';

// --- Seed ---
// Priority: URL hash > localStorage last seed > new random seed
const urlSeed = seedFromHash();
let seed;
if (urlSeed) {
  seed = urlSeed;
} else {
  // Check if we have a previous seed saved
  try {
    seed = localStorage.getItem('idlegator_lastSeed') || String(Date.now());
  } catch (e) {
    seed = String(Date.now());
  }
}
const rng = createRNG(seed);
window.location.hash = `seed=${seed}`;
try { localStorage.setItem('idlegator_lastSeed', seed); } catch (e) {}

// --- Canvas ---
const canvas = document.getElementById('game');
if (!canvas) {
  document.body.innerHTML = '<p style="color:#6a8a5a;font-family:monospace;padding:1em;">canvas element missing</p>';
  throw new Error('Canvas element not found');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
  document.body.innerHTML = '<p style="color:#6a8a5a;font-family:monospace;padding:1em;">your browser cannot render this swamp</p>';
  throw new Error('Canvas 2D context unavailable');
}
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
ctx.imageSmoothingEnabled = false;

// Audio — initAudio sets up persistent listeners on all interaction events
initAudio();
const startOverlay = document.getElementById('start-overlay');
function enterSwamp() {
  resumeAudio();
  if (startOverlay) startOverlay.classList.add('hidden');
}
if (startOverlay) {
  startOverlay.addEventListener('touchend', (e) => { e.preventDefault(); enterSwamp(); }, { once: true });
  startOverlay.addEventListener('click', enterSwamp, { once: true });
  startOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      enterSwamp();
    }
  }, { once: true });
}
// M key toggles mute
document.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') toggleMute();
});

// --- Orientation Detection ---
// Polls every frame — in-app browsers (Instagram, Facebook, TikTok, Twitter, Snapchat)
// often don't fire resize/orientationchange events on rotation.
// Only triggers on actual touch/mobile devices — desktop windows that happen to be
// narrow (tall sidebar layouts, vertically-split dev windows) should never see this.
const rotatePrompt = document.getElementById('rotate-prompt');
let lastOrientationCheck = '';
const isTouchDevice = (() => {
  try {
    // No fine pointer + no hover = a touch device. Modern way to detect this.
    if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
    // Fallback: maxTouchPoints > 0 catches iPads in desktop-mode requests.
    if ((navigator.maxTouchPoints || 0) > 1) return true;
  } catch (e) {}
  return false;
})();

function checkOrientation() {
  if (!isTouchDevice) return; // never harass desktop users
  const w = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const h = window.innerHeight || document.documentElement.clientHeight || screen.height;
  const key = `${w}x${h}`;
  if (key === lastOrientationCheck) return; // no change
  lastOrientationCheck = key;

  const isPortrait = h > w;

  if (isPortrait) {
    document.body.classList.add('show-rotate');
    if (rotatePrompt) rotatePrompt.classList.add('visible');
  } else {
    document.body.classList.remove('show-rotate');
    if (rotatePrompt) rotatePrompt.classList.remove('visible');
  }
}

checkOrientation();
// Listen to everything — some subset will fire in any given browser
window.addEventListener('resize', checkOrientation);
if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
  screen.orientation.addEventListener('change', checkOrientation);
}
window.addEventListener('orientationchange', checkOrientation);
// Touch can trigger a recheck — in-app browsers sometimes update dimensions on interaction
document.addEventListener('touchstart', checkOrientation, { passive: true });
document.addEventListener('visibilitychange', checkOrientation);

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
  growth: 0.8,       // 0-3, overall vegetation multiplier — start with a living swamp
  treeGrowth: 0.7,   // tree canopy fullness
  flowerBloom: 0.5,  // flower density
  undergrowth: 0.7,  // grass/fern density
  destroyedTrees: [], // x positions of trees ripped out by tornados
  flyingDebris: [],   // tree chunks orbiting a tornado
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

  // Growth rates are very small — changes should be imperceptible moment-to-moment
  // You notice the swamp has changed, not that it's changing
  const seasonGrowthRate = {
    spring: 0.002,
    summer: 0.001,
    autumn: -0.0005,
    winter: -0.001,
  };
  const rate = seasonGrowthRate[env.season] || 0;
  const weatherMod = env.weather === 'rain' ? 1.3 : env.weather === 'storm' ? 0.9 : env.weather === 'clear' ? 0.8 : env.weather === 'acid_rain' ? 0.6 : 1.0;
  const fireDamage = fireState.fires.length * -0.003;

  // Tiny baseline growth — the swamp inches forward
  const baseGrowth = 0.0003 * (1 + vegState.epoch * 0.2);

  vegState.growth = Math.max(0.3, Math.min(vegState.maxGrowth, vegState.growth + (rate * weatherMod + fireDamage + baseGrowth) * dt));
  vegState.treeGrowth = Math.max(0.4, Math.min(vegState.maxGrowth * 0.9, vegState.treeGrowth + (rate * 0.4 * weatherMod + baseGrowth * 0.5) * dt));
  vegState.flowerBloom = Math.max(0.1, Math.min(vegState.maxGrowth, vegState.flowerBloom + (rate * 0.8 * weatherMod + baseGrowth) * dt));
  vegState.undergrowth = Math.max(0.2, Math.min(vegState.maxGrowth, vegState.undergrowth + (rate * 0.6 * weatherMod + baseGrowth) * dt));

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
events.onLightningStrikeTree = (lightningX, lRng) => {
  // Recreate tree positions the same way the tornado does
  const treeRng = createRNG(lRng._seed + 999);
  const numTrees = Math.floor(treeRng.range(5, 9) * vegState.treeGrowth);
  for (let i = 0; i < numTrees; i++) {
    const treeX = treeRng.range(8, CANVAS_W - 8);
    treeRng.range(0, 100); // consume RNG to stay aligned with render
    const dist = Math.abs(treeX - lightningX);
    if (dist < 10 && !vegState.destroyedTrees.includes(treeX)) {
      vegState.destroyedTrees.push(treeX);
      startFire(fireState, treeX, waterY - lRng.range(3, 8), lRng, waterY);
      spawnDeathParticles(particles, treeX, waterY - 15, '#ff6622');
      spawnDeathParticles(particles, treeX, waterY - 10, '#ff9944');
      break; // only strike one tree per bolt
    }
  }
};
events.onTornadoPull = (tx, ty, range, dt, rng) => {
  for (const w of wildlifeState.wildlife) {
    if (!w.alive) continue;
    const dist = Math.abs(w.x - tx);
    if (dist < range) {
      const pull = (1 - dist / range) * 50;
      w.vx += Math.sign(tx - w.x) * pull * dt;
      w.vy -= pull * 0.4 * dt;
      if (dist < 6) {
        w.alive = false;
        spawnDeathParticles(particles, w.x, w.y, '#666666');
      }
    }
  }
  // Rip up trees near the tornado
  // Trees are procedurally placed by vegRng — we track destroyed x positions
  // to skip them in rendering. Spawn flying debris chunks.
  const treeRng = createRNG(rng._seed + 999);
  const numTrees = Math.floor(treeRng.range(5, 9) * vegState.treeGrowth);
  for (let i = 0; i < numTrees; i++) {
    const treeX = treeRng.range(8, CANVAS_W - 8);
    treeRng.range(0, 100); // consume RNG to stay aligned with render
    const dist = Math.abs(treeX - tx);
    if (dist < 12 && !vegState.destroyedTrees.includes(treeX)) {
      vegState.destroyedTrees.push(treeX);
      // Spawn flying debris — trunk chunks and canopy pieces
      for (let d = 0; d < rng.range(3, 6); d++) {
        vegState.flyingDebris.push({
          x: treeX + rng.float(-5, 5),
          y: ty + rng.float(-20, 0),
          vx: rng.float(-8, 8),
          vy: rng.float(-15, -5),
          rot: rng.float(0, Math.PI * 2),
          rotSpeed: rng.float(-5, 5),
          size: rng.range(2, 5),
          color: rng.pick(['#4a3a22', '#3a2a18', '#2a5a1e', '#1a3a14']),
          life: rng.float(3, 8),
          tornadoX: tx, // track tornado center for orbiting
        });
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
function spawnGator(rng, stage = 'adult', opts = {}) {
  const stageData = GATOR_STAGES[stage];
  const id = world.create();
  const colors = randomGatorColors(rng);

  world.add(id, 'transform', {
    x: opts.x ?? rng.float(20, CANVAS_W - 40),
    y: opts.y ?? (waterY - rng.float(2, 8)),
    vx: 0, vy: 0,
    direction: rng.chance(0.5) ? 1 : -1,
  });

  const sex = opts.sex || (rng.chance(0.5) ? 'male' : 'female');
  const gatorComp = {
    stage, frame: 'idle',
    spriteW: stageData.width, spriteH: stageData.height,
    sex,
    age: 0, hunger: rng.float(0.1, 0.4), energy: rng.float(0.6, 1.0), health: 1.0,
    state: null, stateTimer: 0, targetId: null,
    blinkTimer: rng.float(2, 6), breatheTimer: rng.float(6, 12), breatheOffset: 0,
    inWater: false, generation: 0, mealCount: 0, sizeScale: 1,
    traits: opts.traits || {
      speed: rng.float(0.7, 1.3), maxSize: rng.float(0.8, 1.2),
      aggression: rng.float(0.2, 0.8), fertility: rng.float(0.3, 0.7),
      metabolism: rng.float(0.7, 1.3), ...colors,
    },
    name: opts.name,
    lineageId: opts.lineageId,
    founder: !!opts.founder,
    isPlayer: !!opts.isPlayer,
  };

  // Attach lineage component for founders (no parents)
  if (opts.lineageId) {
    gatorComp.lineage = { dynastyId: opts.lineageId, motherId: null, fatherId: null };
  }

  // Golden gator — 1-in-100 chance
  if (rng.chance(0.01)) {
    gatorComp.golden = true;
    gatorComp.traits.darkColor = '#8a7a20';
    gatorComp.traits.bodyColor = '#ccaa30';
    gatorComp.traits.bellyColor = '#eedd60';
    gatorComp.traits.scuteColor = '#aa9020';
  }

  world.add(id, 'gator', gatorComp);
  return id;
}

// --- Spawn Gator from Parents ---
let maxGeneration = 0;

function spawnGatorFromParents(rng, pos, motherTraits, fatherTraits, parentGen, lineageId, motherId, fatherId) {
  const stageData = GATOR_STAGES['egg'];
  const id = world.create();
  const traits = inheritTraits(motherTraits, fatherTraits, rng);
  const gen = (parentGen || 0) + 1;
  if (gen > maxGeneration) maxGeneration = gen;

  world.add(id, 'transform', {
    x: pos.x, y: pos.y, vx: 0, vy: 0,
    direction: rng.chance(0.5) ? 1 : -1,
  });

  const sex = rng.chance(0.5) ? 'male' : 'female';
  const gatorComp = {
    stage: 'egg', frame: 'idle',
    spriteW: stageData.width, spriteH: stageData.height,
    sex,
    age: 0, hunger: 0.2, energy: 1.0, health: 1.0,
    state: 'egg', stateTimer: 15,
    targetId: null, blinkTimer: 99, breatheTimer: 99, breatheOffset: 0,
    inWater: false, generation: gen, mealCount: 0, sizeScale: 1, traits,
    // Named-lineage children get auto-generated names too
    name: lineageId ? randomGatorName(rng, sex) : undefined,
    lineageId: lineageId || undefined,
  };

  // Attach lineage component with parent ids
  if (lineageId) {
    gatorComp.lineage = { dynastyId: lineageId, motherId: motherId || null, fatherId: fatherId || null };
  }

  // Golden gator — 1-in-100 chance
  if (rng.chance(0.01)) {
    gatorComp.golden = true;
    gatorComp.traits.darkColor = '#8a7a20';
    gatorComp.traits.bodyColor = '#ccaa30';
    gatorComp.traits.bellyColor = '#eedd60';
    gatorComp.traits.scuteColor = '#aa9020';
  }

  world.add(id, 'gator', gatorComp);
  return id;
}

let simTime = 0;

// --- Fire / Wildlife / Particles ---
// Declared before the load block below because updateVegGrowth() can call
// triggerSurprise() during the fast-forward path at init, which touches all
// three. Construction is order-independent; they're just empty containers.
const fireState = createFireState();
const wildlifeState = createWildlifeState();
const particles = createParticleState();
const obituaryState = loadObituary();

// --- Mode + Dynasty state (set by load or by mode-picker overlay) ---
let gameMode = MODE_TERRARIUM; // default for fresh/terrarium starts
let dynasty = null;            // { id, name, foundedAt, founderNames, era, eraClock, gensBonusReached } when in dynasty mode
let lineagePoints = loadLineagePoints();
let dynastyFounderIds = [];    // ids of founders, tracked for extinction check
let extinctionGraceTimer = 0;  // don't trigger game-over during the first few seconds of a new dynasty

// --- Era Celebration state ---
let pendingEraCelebration = null; // { era, timer } — set when an era advance fires
let eraCelebrationTimer = 0;

// --- Death cutscene state ---
let deathCutsceneActive = false;
let deathCutscenePending = null; // { successors } to show after cutscene
let deathCutsceneStartTime = 0; // performance.now() when cutscene began
const DEATH_CUTSCENE_DURATION_MS = 3500; // 3.5s real time

// --- Player HUD throttle ---
let hudLastRefresh = 0;
const HUD_REFRESH_MS = 100; // ~10fps for portrait, 10fps for stats

// --- Load Saved State or Fresh Start ---
const savedState = persistence.load();
let needsModePicker = false;
if (savedState && Array.isArray(savedState.gators) && savedState.gators.length > 0) {
  // Restore mode/dynasty if present, default to terrarium for older saves
  gameMode = savedState.mode === MODE_DYNASTY ? MODE_DYNASTY : MODE_TERRARIUM;
  dynasty = savedState.dynasty || null;

  // Restore gators with trait defaults — handles older saves missing newer trait fields
  const TRAIT_DEFAULTS = { speed: 1, maxSize: 1, aggression: 0.5, fertility: 0.5, metabolism: 1 };
  for (const saved of savedState.gators) {
    if (!saved || !saved.tr || !saved.gator) continue;
    const id = world.create();
    world.add(id, 'transform', { vx: 0, vy: 0, direction: 1, ...saved.tr });
    world.add(id, 'gator', {
      ...saved.gator,
      traits: { ...TRAIT_DEFAULTS, ...randomGatorColors(rng), ...(saved.gator.traits || {}) },
    });
  }
  // Restore environment
  if (savedState.env) {
    Object.assign(env, savedState.env);
  }
  // Restore sim time and generation
  simTime = savedState.simTime || 0;
  maxGeneration = savedState.maxGeneration || 0;
  // Restore vegState age/epoch
  if (savedState.vegAge) vegState.age = savedState.vegAge;
  if (savedState.vegEpoch) vegState.epoch = savedState.vegEpoch;
  if (savedState.vegGrowth) vegState.growth = savedState.vegGrowth;

  // Fast-forward elapsed real time while away
  const elapsed = persistence.getElapsedTime(savedState);
  if (elapsed > 5) {
    // Adaptive tick size — bigger steps for longer absences, capped at ~4000 iterations
    // <10 min: 0.5s ticks. <1 hr: 2s ticks. <6 hr: 10s ticks. >6 hr: 30s ticks.
    const tickDt = elapsed < 600 ? 0.5 : elapsed < 3600 ? 2 : elapsed < 21600 ? 10 : 30;
    const numTicks = Math.floor(elapsed / tickDt);
    const cappedTicks = Math.min(numTicks, 4000);

    try {
      for (let t = 0; t < cappedTicks; t++) {
        environmentSystem(env, tickDt, rng);
        aiSystem(world, tickDt, rng, waterY);
        breedingSystem(world, tickDt, rng, waterY, spawnGatorFromParents);
        lifecycleSystem(world, tickDt, rng);
        physicsSystem(world, tickDt, terrain, waterY, rng);
        world.flush();
        simTime += tickDt;
        // In terrarium mode, repopulate if everything dies. Dynasty mode lets the
        // bloodline truly die — extinction is detected in the live game loop.
        if (gameMode === MODE_TERRARIUM && world.count('gator') === 0) {
          for (let i = 0; i < rng.range(3, 5); i++) spawnGator(rng, 'adult');
        }
      }
    } catch (e) {
      // Fast-forward failed — accept current sim state and continue
      if (typeof console !== 'undefined') console.warn('[bge] fast-forward aborted:', e.message);
    }
    // Vegetation catches up with the full elapsed time
    updateVegGrowth(elapsed);
    vegState.age += elapsed;
  }
} else {
  // No save — show mode picker before spawning anything. The game loop can still
  // start running (rendering landscape + wildlife); gators come in after choice.
  needsModePicker = true;
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

// --- The Deep ---
const deepState = { shadowX: -50, shadowActive: false, shadowTimer: 30, rippleTimer: 15, shadowDir: 1, eyeFlash: 0 };

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
        // Flies can dip close to the water — frogs need to catch them
        if (tr.y > waterY - 1) tr.vy -= 20 * dt; // hard bounce off water
        else if (tr.y > waterY - 8) tr.vy -= 3 * dt; // gentle drift upward near surface
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
        // Frogs hunt flies but can't fly — they hop on the ground and use their tongue
        let chasedFly = false;
        for (const [fid, ftr, fprey] of world.query('transform', 'prey')) {
          if (fprey.type !== 'fly' || !fprey.alive) continue;
          const dx = ftr.x - tr.x;
          const dy = ftr.y - tr.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Only pursue flies within reach
          const flyTooHigh = ftr.y < tr.y - 20;
          if (dist < 45 && !flyTooHigh) {
            chasedFly = true;

            // Hop toward fly horizontally
            const onGround = tr.y >= waterY - 3;
            if (onGround) {
              tr.vx = Math.sign(dx) * Math.min(Math.abs(dx), 12);
              if (dy < -3) {
                tr.vy = -rng.float(6, 10);
              }
            }

            // Tongue strike — generous range, frogs are good at this
            prey.tongueTarget = { x: ftr.x, y: ftr.y };
            if (dist < 18) {
              prey.tongueFlick = 0.2;
              // Eat — tongue is long and sticky
              if (dist < 15) {
                fprey.alive = false;
                world.kill(fid);
                prey.value += 0.03;
                prey.tongueFlick = 0.35;
              }
            }
            break;
          }
        }
        if (!chasedFly) {
          // Idle hopping — short grounded hops
          if (prey.buzzTimer <= 0) {
            tr.vx = rng.float(-3, 3);
            if (tr.y >= waterY - 3) {
              tr.vy = -rng.float(4, 7); // modest hop
            }
            prey.buzzTimer = rng.float(1, 3);
          }
        }
        tr.vy += 25 * dt; // strong gravity — frogs come back down fast
        if (tr.y > waterY - 2) { tr.y = waterY - 2; tr.vy = 0; tr.vx *= 0.8; }
        break;
    }
  }
}


// --- God Powers ---

// --- SKULL GRAVEYARD ---
const skulls = [];

// --- ANIMAL TRACKS ---
const tracks = [];
let trackSpawnTimer = 0;

function addSkull(x, y) {
  if (skulls.length > 30) skulls.shift(); // remove oldest
  skulls.push({ x: Math.floor(x), y: Math.floor(y), age: 0 });
}

function renderSkulls(ctx, skulls, simTime) {
  for (let i = skulls.length - 1; i >= 0; i--) {
    const skull = skulls[i];

    // Return to the earth — skulls sink and fade over time
    // Phase 1 (0-30s): fresh bone white
    // Phase 2 (30-120s): yellowing
    // Phase 3 (120-240s): mossy, starting to sink
    // Phase 4 (240-360s): earth-colored, mostly submerged, fading
    // Phase 5 (360+): gone
    if (skull.age > 360) {
      skulls.splice(i, 1);
      continue;
    }

    let color, mossed = false;
    let sinkOffset = 0;
    let alpha = 1;

    if (skull.age < 30) {
      color = '#ddddcc';
    } else if (skull.age < 120) {
      color = '#cccc99';
    } else if (skull.age < 240) {
      color = '#88aa77';
      mossed = true;
      sinkOffset = Math.floor((skull.age - 120) / 120); // sink 0-1 pixel
    } else {
      color = '#6a6a55';
      mossed = true;
      sinkOffset = 1;
      alpha = 1 - (skull.age - 240) / 120; // fade out over final phase
    }

    const sx = skull.x;
    const sy = skull.y + sinkOffset;

    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = color;
    // Top row: cranium (skip if fully sunk)
    if (sinkOffset < 2) {
      ctx.fillRect(sx, sy, 3, 1);
    }
    // Bottom row: jaw
    ctx.fillRect(sx, sy + 1, 1, 1);
    ctx.fillRect(sx + 2, sy + 1, 1, 1);
    // Moss on top
    if (mossed && sinkOffset < 1) {
      ctx.fillStyle = '#5a7a44';
      ctx.fillRect(sx + 1, sy - 1, 1, 1);
    }
    ctx.globalAlpha = 1;
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
        const nextX = bx + (rng.random() - 0.5) * 10;
        const nextY = by + 5 + rng.random() * 10;
        bolt.segments.push({ x1: bx, y1: by, x2: nextX, y2: nextY });
        bx = nextX;
        by = nextY;
      }
      events.lightningBolts.push(bolt);
      events.lightningFlash = 1;
      // Damage nearby gators slightly
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        if (Math.abs(tr.x + (gator.spriteW || 10) / 2 - x) < 6) {
          if (rng.chance(0.15)) {
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
            x: nearestTr.x + rng.float(-4, 4),
            y: nearestTr.y - rng.float(0, 6),
            vx: rng.float(-5, 5),
            vy: -rng.float(3, 15),
            life: rng.float(0.5, 1.0),
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
  isSimStarted: () => simulationStarted,
});

// --- Gator Inspector ---
initInspector({ canvas, world, GATOR_STAGES });

// --- Player Control system init (wired later in commitFounders when dynasty is set) ---
initPlayerControl({
  canvas, world, dynasty: null,
  playSplash, addRipple, particles, spawnDeathParticles,
  waterY, wildlifeState,
});

// Pointer hold tracking
let _pointerDown = false;
let _pointerClientX = 0;
let _pointerClientY = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  _pointerDown = true;
  _pointerClientX = e.clientX;
  _pointerClientY = e.clientY;
});
canvas.addEventListener('pointercancel', () => { _pointerDown = false; });
canvas.addEventListener('pointerleave', () => { _pointerDown = false; });

canvas.addEventListener('pointerup', (e) => {
  _pointerDown = false;
  if (e.button !== 0) return;
  if (isGodMode()) return; // god mode clicks are for powers, not inspection
  if (gameOver) return;    // let the game-over handler own this

  const isShiftHeld = e.shiftKey;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (e.clientX - rect.left) * scaleX;
  const cy = (e.clientY - rect.top) * scaleY;

  // In dynasty mode, try player control dispatch first.
  // Shift-click or no player gator = fall through to inspector.
  if (gameMode === MODE_DYNASTY && dynasty && dynasty.playerGatorId && !isShiftHeld) {
    const consumed = dispatchClick(cx, cy, false);
    if (consumed) return;
  }

  // Inspector handles clicks on all gators (shift-click in dynasty = always inspect)
  openInspectorAt(e.clientX, e.clientY);
});

// I key: inspect the player's own gator
document.addEventListener('keydown', (e) => {
  if (e.key === 'i' || e.key === 'I') {
    if (gameMode === MODE_DYNASTY && dynasty && dynasty.playerGatorId) {
      const tr = world.get(dynasty.playerGatorId, 'transform');
      if (tr) {
        const rect = canvas.getBoundingClientRect();
        // Convert logical coords back to client coords for inspector
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        const clientX = rect.left + tr.x * scaleX;
        const clientY = rect.top + tr.y * scaleY;
        openInspectorAt(clientX, clientY);
      }
    }
  }
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
let tickerOffset = 0;
let tickerCache = { key: '', text: '', width: 0 };

function renderFullUI(ctx, simTime) {
  ctx.fillStyle = '#334433';

  const gatorCount = world.count('gator');

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

  // Show epoch in top-right when not in god mode
  const epochName = EPOCH_NAMES[vegState.epoch] || '';
  if (!isGodMode() && vegState.epoch > 0) {
    const epochLabel = `era:${epochName}`;
    ctx.fillStyle = '#3a4a3a';
    drawPixelText(ctx, epochLabel, CANVAS_W - epochLabel.length * 4 - 2, 3);
  }

  // Dynasty HUD — top-center bloodline status + era HUD
  if (gameMode === MODE_DYNASTY && dynasty) {
    const aliveCount = countLivingBloodline(world, dynasty.id);
    const label = `${dynasty.name}`.toLowerCase();
    ctx.fillStyle = '#6aaa5a';
    const labelX = Math.floor(CANVAS_W / 2 - label.length * 2);
    drawPixelText(ctx, label, labelX, 3);
    const sub = `gen:${maxGeneration}  blood:${aliveCount}`;
    ctx.fillStyle = aliveCount <= 2 ? '#aa5a5a' : '#4a6a4a';
    drawPixelText(ctx, sub, Math.floor(CANVAS_W / 2 - sub.length * 2), 9);
    // Era HUD — small, top-right, below epoch label row
    renderEraHUD(ctx, dynasty, drawPixelText, CANVAS_W, CANVAS_H);
  }

  // Speed / pause indicator — bottom-right, above ticker
  {
    const label = getSpeedLabel();
    const isP = isPaused();
    const isNonDefault = !isP && label !== '1x';
    ctx.fillStyle = isP ? '#cca050' : isNonDefault ? '#aa6a4a' : '#3a4a3a';
    drawPixelText(ctx, label, CANVAS_W - label.length * 4 - 2, CANVAS_H - 13);
  }

  // Mute indicator
  if (isMuted()) {
    ctx.fillStyle = '#554444';
    drawPixelText(ctx, 'muted', 2, CANVAS_H - 13);
  }

  // --- Live ticker (scrolling bar at very bottom) ---
  // Cache the text — only rebuild when any tracked value actually changes
  const tickerKey = `${gatorCount}|${maxGeneration}|${env.dayCount || 0}|${env.season}|${env.weather}`;
  if (tickerKey !== tickerCache.key) {
    const weatherPart = env.weather !== 'clear' ? env.weather.toUpperCase() + ' -- ' : '';
    const seedPart = seed.length > 12 ? seed.slice(-12) : seed;
    tickerCache.text = `LIVE -- BIG GATOR ENERGY SWAMP CAM -- EST. 2026 -- POP: ${gatorCount} -- GEN: ${maxGeneration} -- DAY ${env.dayCount || 0} -- ${env.season.toUpperCase()} -- ${weatherPart}SEED: ${seedPart} --  `;
    tickerCache.width = tickerCache.text.length * 4; // 3px char + 1px gap
    tickerCache.key = tickerKey;
  }
  tickerOffset = (simTime * 8) % tickerCache.width; // 8px/sec scroll
  const tickerY = CANVAS_H - 6;
  ctx.fillStyle = '#4a6a4a';
  for (let ox = -tickerOffset; ox < CANVAS_W; ox += tickerCache.width) {
    drawPixelText(ctx, tickerCache.text, Math.floor(ox), tickerY);
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

// --- Player HUD ---
// HTML overlay card at bottom-center. Refreshed at ~10fps.

const GATOR_STATE_LABELS = {
  idle:      'idle',
  wandering: 'swimming',
  hunting:   'hunting',
  eating:    'eating',
  sleeping:  'sleeping',
  courting:  'courting',
  mating:    'mating',
  nesting:   'nesting',
  guarding:  'guarding',
  fighting:  'fighting',
  fleeing:   'fleeing',
  dying:     'dying',
};

function getActionLabel(gator) {
  const base = GATOR_STATE_LABELS[gator.state] || (gator.state || 'idle');
  // Add target info when hunting or courting
  if ((gator.state === 'hunting' || gator.state === 'eating') && gator.targetId) {
    const prey = world.get(gator.targetId, 'prey');
    if (prey?.type) return `${base} ${prey.type}`;
    const tw = world.get(gator.targetId, 'gator');
    if (tw?.name) return `${base} ${tw.name}`;
  }
  if (gator.state === 'courting' && gator.courtTarget) {
    const cg = world.get(gator.courtTarget, 'gator');
    if (cg?.name) return `courting ${cg.name}`;
  }
  if (gator.state === 'fighting' && gator.fightTarget) {
    const fg = world.get(gator.fightTarget, 'gator');
    if (fg?.name) return `fighting ${fg.name}`;
  }
  return base;
}

function updatePlayerHUD() {
  if (gameMode !== MODE_DYNASTY || !dynasty || !dynasty.playerGatorId) {
    const hudEl = document.getElementById('player-hud');
    if (hudEl) hudEl.classList.add('hidden');
    return;
  }

  const gator = world.get(dynasty.playerGatorId, 'gator');
  const tr = world.get(dynasty.playerGatorId, 'transform');
  if (!gator || !tr) {
    const hudEl = document.getElementById('player-hud');
    if (hudEl) hudEl.classList.add('hidden');
    return;
  }

  const now = performance.now();
  const hudEl = document.getElementById('player-hud');
  if (!hudEl) return;
  hudEl.classList.remove('hidden');

  // Name
  const nameEl = document.getElementById('player-hud-name');
  if (nameEl) nameEl.textContent = (gator.name || 'gator').toLowerCase();

  // Action
  const actionEl = document.getElementById('player-hud-action');
  if (actionEl) actionEl.textContent = getActionLabel(gator);

  // Stat bars — hunger, energy, health (all 0.0–1.0)
  // hunger: 0 = full (good), 1 = starving (bad) — bar shows how hungry they are
  const hunger = Math.max(0, Math.min(1, gator.hunger || 0));
  const hungerEl = document.getElementById('hud-bar-hunger');
  if (hungerEl) {
    hungerEl.style.width = `${Math.round(hunger * 100)}%`;
    hungerEl.classList.toggle('critical', hunger > 0.65);
  }
  // energy: 1 = full, 0 = exhausted — bar shows remaining energy
  const energy = Math.max(0, Math.min(1, gator.energy !== undefined ? gator.energy : 1));
  const energyEl = document.getElementById('hud-bar-energy');
  if (energyEl) energyEl.style.width = `${Math.round(energy * 100)}%`;

  // health: 0.0–1.0
  const health = Math.max(0, Math.min(1, gator.health !== undefined ? gator.health : 1));
  const healthEl = document.getElementById('hud-bar-health');
  if (healthEl) {
    healthEl.style.width = `${Math.round(health * 100)}%`;
    healthEl.classList.toggle('critical', health < 0.25);
  }

  // Portrait mini-canvas — refresh at ~10fps
  if (now - hudLastRefresh > HUD_REFRESH_MS) {
    hudLastRefresh = now;
    const portrait = document.getElementById('player-portrait');
    if (portrait) {
      const pCtx = portrait.getContext('2d');
      pCtx.imageSmoothingEnabled = false;
      pCtx.clearRect(0, 0, portrait.width, portrait.height);
      // Dark background
      pCtx.fillStyle = '#0a120e';
      pCtx.fillRect(0, 0, portrait.width, portrait.height);
      // Draw gator sprite using existing drawSprite
      const stageData = GATOR_STAGES[gator.stage];
      if (stageData) {
        const frameName = gator.frame || 'idle';
        const sprite = stageData[frameName] || stageData.idle || stageData[Object.keys(stageData)[0]];
        if (sprite) {
          const sw = sprite[0].length;
          const sh = sprite.length;
          const tints = gator.traits || null;
          // Scale to fit canvas — largest integer scale that doesn't overflow
          const scaleX = Math.floor(portrait.width / sw);
          const scaleY = Math.floor(portrait.height / sh);
          const pxSize = Math.max(1, Math.min(scaleX, scaleY));
          const ox2 = Math.floor((portrait.width - sw * pxSize) / 2);
          const oy2 = Math.floor((portrait.height - sh * pxSize) / 2);
          for (let py = 0; py < sh; py++) {
            const row = sprite[py];
            for (let px = 0; px < row.length; px++) {
              let color = row[px];
              if (!color) continue;
              if (tints) {
                if (color === TINT_COLORS.body && tints.body) color = tints.body;
                else if (color === TINT_COLORS.belly && tints.belly) color = tints.belly;
                else if (color === TINT_COLORS.dark && tints.dark) color = tints.dark;
                else if (color === TINT_COLORS.scute && tints.scute) color = tints.scute;
              }
              pCtx.fillStyle = color;
              const drawX = tr.direction === -1 ? ox2 + (row.length - 1 - px) * pxSize : ox2 + px * pxSize;
              pCtx.fillRect(drawX, oy2 + py * pxSize, pxSize, pxSize);
            }
          }
        }
      }
    }
  }
}

// --- Hover tooltip ---
function updateHoverTooltip() {
  const tooltipEl = document.getElementById('hover-tooltip');
  if (!tooltipEl) return;

  if (gameMode !== MODE_DYNASTY || !dynasty || !dynasty.playerGatorId || !hoverState.kind || hoverState.kind === 'empty') {
    tooltipEl.classList.add('hidden');
    // Reset cursor to default
    canvas.style.cursor = '';
    return;
  }

  const { kind, name, clientX, clientY } = hoverState;

  // Build tooltip text
  let label = '';
  let cursor = 'crosshair';
  switch (kind) {
    case 'self':
      label = (name ? name : 'you') + ' · tail-slap';
      cursor = 'cell';
      break;
    case 'mate':
      label = (name ? name + ' · ' : '') + 'court';
      cursor = 'copy';
      break;
    case 'rival':
      label = (name ? name + ' · ' : '') + 'fight';
      cursor = 'not-allowed';
      break;
    case 'gator':
      label = (name ? name + ' · ' : '') + 'gator';
      cursor = 'crosshair';
      break;
    case 'prey':
      label = (name || 'prey') + ' · hunt';
      cursor = 'crosshair';
      break;
    case 'wildlife':
      label = (name || 'wildlife') + ' · scare';
      cursor = 'crosshair';
      break;
    default:
      tooltipEl.classList.add('hidden');
      canvas.style.cursor = '';
      return;
  }

  tooltipEl.textContent = label;
  tooltipEl.classList.remove('hidden');
  canvas.style.cursor = cursor;

  // Position near cursor, offset so it doesn't obscure the target
  const offset = 14;
  let tx = clientX + offset;
  let ty = clientY - offset;
  // Keep inside viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = tooltipEl.offsetWidth || 80;
  const th = tooltipEl.offsetHeight || 20;
  if (tx + tw > vw - 8) tx = clientX - tw - offset;
  if (ty < 8) ty = clientY + offset;
  if (ty + th > vh - 8) ty = vh - th - 8;
  tooltipEl.style.left = `${tx}px`;
  tooltipEl.style.top = `${ty}px`;
}

// --- Death cutscene ---

const DEATH_POEMS = {
  'old age':  'the swamp goes quiet.',
  'heron':    'the heron took them. it always does.',
  'lightning':'a bright moment, then nothing.',
  'fire':     'they were warmed before they were gone.',
  'tornado':  'the wind has them now.',
  'hunter':   'a man with a gun.',
  'alien':    'stars. then static.',
  'ufo':      'stars. then static.',
  'starvation': 'hunger is patient.',
  'fight':    'the swamp does not mourn the fallen.',
};

function deathCausePoem(cause) {
  return DEATH_POEMS[cause] || 'the swamp continues.';
}

function showDeathCutscene(gator, cause, successors) {
  deathCutsceneActive = true;
  deathCutscenePending = successors;
  deathCutsceneStartTime = performance.now();

  const el = document.getElementById('death-cutscene');
  if (!el) return;

  const age = Math.floor((gator.age || 0) / 60);
  document.getElementById('death-name').textContent = (gator.name || 'gator').toLowerCase();
  document.getElementById('death-meta').textContent = `age ${age}d · died of ${cause || 'unknown'}`;
  document.getElementById('death-poem').textContent = deathCausePoem(cause);

  el.classList.remove('hidden');
  // Trigger CSS fade: dim background after a tick
  requestAnimationFrame(() => {
    el.classList.add('active');
    // Show text after 0.5s (background needs to fade in first)
    setTimeout(() => el.classList.add('text-visible'), 500);
  });
}

function tickDeathCutscene(_dt) {
  if (!deathCutsceneActive) return;
  const elapsed = performance.now() - deathCutsceneStartTime;
  if (elapsed >= DEATH_CUTSCENE_DURATION_MS) {
    // Done — hide cutscene and show succession
    deathCutsceneActive = false;
    const el = document.getElementById('death-cutscene');
    if (el) {
      el.classList.remove('active', 'text-visible');
      el.classList.add('hidden');
    }
    if (deathCutscenePending && deathCutscenePending.length > 0) {
      showSuccessionModal(deathCutscenePending);
    }
    deathCutscenePending = null;
  }
}

// --- Paused frame render ---
// Renders the current scene state without advancing simulation, then overlays a
// semi-transparent dim + "paused" pixel text. Called each frame when paused.
function renderPausedFrame(ctx, simTime) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const frameVegRng = createRNG(rng._seed + 999);

  renderSky(ctx, waterY, simTime, env);
  renderCelestial(ctx, env, waterY, simTime);
  renderRainbow(ctx, vegState, waterY);
  renderSkyLife(ctx, waterY, simTime, frameVegRng);
  renderTerrain(ctx, terrain, waterY);

  // Gator drag marks
  for (const track of tracks) {
    ctx.globalAlpha = Math.max(0, 1 - track.age / 20);
    ctx.fillStyle = '#3a3a2a';
    ctx.fillRect(Math.floor(track.x), Math.floor(track.y), 1, 1);
  }
  ctx.globalAlpha = 1;

  renderWater(ctx, waterY, simTime);
  renderTheDeep(ctx, deepState, waterY, simTime);
  renderUnderwaterLife(ctx, waterY, simTime, frameVegRng);
  renderVegetation(ctx, terrain, waterY, frameVegRng, simTime, vegState, env);
  renderSkulls(ctx, skulls, simTime);
  renderPrey(ctx, world, simTime, 0);
  renderGators(ctx, world, simTime);
  renderPredators(ctx, world);
  renderRipples(ctx, particles, 0);
  renderWildlife(ctx, wildlifeState, simTime);
  renderAmbientParticles(ctx, particles, simTime);
  renderDeathParticles(ctx, particles);

  // Flying debris
  for (const d of vegState.flyingDebris) {
    const px = Math.floor(d.x);
    const py = Math.floor(d.y);
    ctx.fillStyle = d.color;
    const cos = Math.cos(d.rot);
    const sin = Math.sin(d.rot);
    for (let dx = 0; dx < d.size; dx++) {
      for (let dy = 0; dy < Math.max(1, d.size - 1); dy++) {
        const rx = Math.floor(px + dx * cos - dy * sin);
        const ry = Math.floor(py + dx * sin + dy * cos);
        ctx.fillRect(rx, ry, 1, 1);
      }
    }
  }
  renderFires(ctx, fireState, simTime);
  renderEvents(ctx, events, simTime, waterY);
  renderEnvironmentEffects(ctx, env, waterY, simTime);
  renderMoments(ctx, obituaryState, drawPixelText, CANVAS_W, CANVAS_H);

  renderFullUI(ctx, simTime);

  // Pause overlay — slight dim + centered text
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const pauseMsg = 'paused  ·  press space';
  ctx.fillStyle = '#cca050';
  drawPixelText(ctx, pauseMsg, Math.floor(CANVAS_W / 2 - pauseMsg.length * 2), Math.floor(CANVAS_H / 2 - 3));
}

// --- The Deep rendering ---
function renderTheDeep(ctx, deepState, waterY, simTime) {
  if (!deepState.shadowActive) return;
  const sx = deepState.shadowX;
  const baseY = waterY + 20 + Math.sin(simTime * 0.8) * 3; // undulate vertically
  const bodyLen = 50;
  const bodyH = 7;

  // Draw dark elongated oval shape underwater
  ctx.fillStyle = 'rgba(5, 15, 5, 0.3)';
  for (let px = 0; px < bodyLen; px++) {
    // Oval taper: full height in middle, thin at ends
    const t = px / bodyLen; // 0..1
    const taper = Math.sin(t * Math.PI); // 0 at edges, 1 at center
    const h = Math.max(1, Math.floor(bodyH * taper));
    const drawX = Math.floor(sx + (deepState.shadowDir === 1 ? px : -px));
    const drawY = Math.floor(baseY - h / 2);
    ctx.fillRect(drawX, drawY, 1, h);
  }

  // Eyes -- blink and you miss it
  if (deepState.eyeFlash > 0) {
    ctx.fillStyle = 'rgba(80, 120, 60, 0.2)';
    const frontX = deepState.shadowDir === 1 ? sx + bodyLen - 5 : sx - bodyLen + 5;
    const eyeY = Math.floor(baseY - 1);
    ctx.fillRect(Math.floor(frontX), eyeY, 2, 2);
    ctx.fillRect(Math.floor(frontX), eyeY + 3, 2, 2);
  }
}

// --- Save on unload ---
window.addEventListener('beforeunload', () => {
  persistence.save(world, env, simTime, maxGeneration, vegState, { mode: gameMode, dynasty });
});

// --- Era Celebration click-to-dismiss ---
const eraCelebrationEl = document.getElementById('era-celebration');
if (eraCelebrationEl) {
  eraCelebrationEl.addEventListener('click', () => {
    pendingEraCelebration = null;
    eraCelebrationTimer = 0;
    eraCelebrationEl.classList.add('hidden');
  });
}

// --- Title backdrop ---
// One-time static frame painted behind the title screen. Renders the stage
// the player is about to inherit — sky + moon + terrain + water + vegetation —
// with no creatures, no animation, no time passing. A still photograph.
function paintTitleBackdrop() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  // Force a contemplative dusk on the title — consistent with the OG preview.
  const titleEnv = {
    ...env,
    timeOfDay: 0.78, // dusk
    season: env.season || 'summer',
    weather: 'clear',
    rainIntensity: 0,
    foodMultiplier: 1,
  };
  const titleTime = 0; // frozen — no wave animation
  const titleVegRng = createRNG(rng._seed + 999);
  renderSky(ctx, waterY, titleTime, titleEnv);
  renderCelestial(ctx, titleEnv, waterY, titleTime);
  renderTerrain(ctx, terrain, waterY);
  renderWater(ctx, waterY, titleTime);
  renderVegetation(ctx, terrain, waterY, titleVegRng, titleTime, vegState, titleEnv);
}

// --- Title screen / founding pair / dynasty extinction UI ---
const titleScreen = document.getElementById('title-screen');
const titleMainMenu = document.getElementById('title-main');
const titleTerrSubmenu = document.getElementById('title-terrarium-submenu');
const titleDynSubmenu = document.getElementById('title-dynasty-submenu');
const foundingPair = document.getElementById('founding-pair');
const gameOverOverlay = document.getElementById('game-over');
const MAX_REROLLS = 5;
let pendingFounders = null;     // { dynastyId, name, rerollsLeft, male, female }
let dynastyExtinct = false;     // set when bloodline is gone (dynasty mode)
let dynastyStats = null;        // populated on extinction for the overlay

// Does the loaded save actually contain gameplay state we can resume?
const hasSavedSession = !!(savedState && Array.isArray(savedState.gators) && savedState.gators.length > 0);
const savedSessionMode = hasSavedSession ? (savedState.mode === MODE_DYNASTY ? MODE_DYNASTY : MODE_TERRARIUM) : null;

function setTitleMenu(which) {
  if (!titleScreen) return;
  titleMainMenu?.classList.toggle('hidden', which !== 'main');
  titleTerrSubmenu?.classList.toggle('hidden', which !== 'terrarium');
  titleDynSubmenu?.classList.toggle('hidden', which !== 'dynasty');
}

function showTitleScreen() {
  if (!titleScreen) {
    // Fallback — if the title markup isn't there, default to terrarium fresh.
    startTerrariumFresh();
    return;
  }
  // Title is the entry gate — hide the generic "click to enter" overlay and
  // let clicks on title buttons resume audio.
  if (startOverlay) startOverlay.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  setTitleMenu('main');

  // Populate continue sub-labels with context from the save
  const terrSubEl = document.getElementById('terrarium-continue-sub');
  const dynSubEl = document.getElementById('dynasty-continue-sub');
  if (terrSubEl && hasSavedSession && savedSessionMode === MODE_TERRARIUM) {
    const seedShort = String(seed).slice(-10);
    terrSubEl.textContent = `seed ${seedShort} · gen ${savedState.maxGeneration || 0}`;
  }
  if (dynSubEl && hasSavedSession && savedSessionMode === MODE_DYNASTY) {
    dynSubEl.textContent = savedState.dynasty?.name
      ? `${savedState.dynasty.name.toLowerCase()} · gen ${savedState.maxGeneration || 0}`
      : `your bloodline · gen ${savedState.maxGeneration || 0}`;
  }

  titleScreen.onclick = (e) => {
    const infoBtn = e.target.closest('[data-info]');
    if (infoBtn) {
      showInfoPopover(infoBtn.dataset.info);
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    resumeAudio(); // user gesture — unlocks Web Audio for the rest of the session
    handleTitleAction(btn.dataset.action);
  };
}

const MODE_INFO = {
  dynasty: {
    heading: 'dynasty mode',
    // Keep text thoughtful and observed — not congratulatory.
    body: `you choose <em>two founders</em>. they breed. their line breeds. the bloodline
      thins over generations — hunters, disasters, old age, the herons.<br><br>
      when the last of your line dies, the swamp carries on without you. you earn
      <em>lineage points</em> for every generation survived. spend them on new founders,
      new traits, new biomes between runs.<br><br>
      <em>permanent. unforgiving. the good kind.</em>`,
  },
  terrarium: {
    heading: 'terrarium mode',
    body: `an <em>aquarium</em>. no goals, no losing. gators live and die freely,
      the world goes on. god powers are unlimited. nothing is tracked.<br><br>
      <em>for watching. for decompressing. for putting on the second monitor.</em>`,
  },
};

function showInfoPopover(which) {
  const pop = document.getElementById('title-info-popover');
  const heading = document.getElementById('title-info-heading');
  const body = document.getElementById('title-info-body');
  if (!pop || !heading || !body) return;
  const info = MODE_INFO[which];
  if (!info) return;
  heading.textContent = info.heading;
  body.innerHTML = info.body;
  pop.classList.remove('hidden');
}

function hideInfoPopover() {
  const pop = document.getElementById('title-info-popover');
  if (pop) pop.classList.add('hidden');
}

// Close button + Escape key dismiss
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-action="info-close"]');
  if (closeBtn) hideInfoPopover();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideInfoPopover();
});

function handleTitleAction(action) {
  switch (action) {
    case 'dynasty':
      if (hasSavedSession) {
        // Save exists — show submenu so user explicitly picks continue vs new.
        // Hide continue if the saved mode isn't dynasty (you can't continue a
        // terrarium save as a dynasty).
        const continueBtn = titleDynSubmenu?.querySelector('[data-action="dynasty-continue"]');
        if (continueBtn) continueBtn.style.display = (savedSessionMode === MODE_DYNASTY) ? '' : 'none';
        setTitleMenu('dynasty');
      } else {
        // No save — straight to founding pair.
        titleScreen.classList.add('hidden');
        showFoundingPair();
      }
      break;

    case 'terrarium':
      if (hasSavedSession) {
        const continueBtn = titleTerrSubmenu?.querySelector('[data-action="terrarium-continue"]');
        if (continueBtn) continueBtn.style.display = (savedSessionMode === MODE_TERRARIUM) ? '' : 'none';
        setTitleMenu('terrarium');
      } else {
        titleScreen.classList.add('hidden');
        startTerrariumFresh();
      }
      break;

    case 'terrarium-continue':
    case 'dynasty-continue':
      // Saved state is already restored into the world during boot.
      // "Continue" just dismisses the title and starts the simulation.
      titleScreen.classList.add('hidden');
      simulationStarted = true;
      break;

    case 'terrarium-new':
      // Fresh seed + fresh terrarium — full reload after setting intent flag.
      startNewRun(MODE_TERRARIUM);
      break;

    case 'dynasty-new':
      startNewRun(MODE_DYNASTY);
      break;

    case 'back':
      setTitleMenu('main');
      break;
  }
}

// Fresh-run reload: wipe save + seed, set an intent flag so the next boot
// skips the title and goes straight to the relevant setup path.
function startNewRun(mode) {
  try { persistence.clear(); } catch (e) {}
  try { localStorage.removeItem('idlegator_lastSeed'); } catch (e) {}
  try { localStorage.setItem('bge_pending_mode', mode); } catch (e) {}
  window.location.hash = '';
  window.location.reload();
}

function startTerrariumFresh() {
  gameMode = MODE_TERRARIUM;
  dynasty = null;
  const initialCount = rng.range(4, 6);
  for (let i = 0; i < initialCount; i++) {
    spawnGator(rng, rng.pick(['adult', 'adult', 'juvenile', 'juvenile', 'adult']));
  }
  simulationStarted = true;
}

function rollFounderCandidate(sex) {
  const baseColors = randomGatorColors(rng);
  const overrideColors = applyUnlocksToFounderColors(rng);
  const colors = overrideColors || baseColors;
  const traits = {
    speed: rng.float(0.7, 1.3),
    maxSize: rng.float(0.8, 1.2),
    aggression: rng.float(0.2, 0.8),
    fertility: rng.float(0.3, 0.7),
    metabolism: rng.float(0.7, 1.3),
    ...colors,
  };
  applyUnlocksToFounderRoll(traits);
  return { sex, name: randomGatorName(rng, sex), traits };
}

function describeTrait(t) {
  const labels = [];
  if (t.maxSize > 1.1) labels.push('big');
  else if (t.maxSize < 0.9) labels.push('runty');
  if (t.speed > 1.15) labels.push('fast');
  else if (t.speed < 0.85) labels.push('slow');
  if (t.aggression > 0.65) labels.push('mean');
  else if (t.aggression < 0.35) labels.push('docile');
  if (t.fertility > 0.6) labels.push('fertile');
  return labels.length ? labels.join(' · ') : 'unremarkable';
}

function renderFounderPreview(canvasEl, sex, traits) {
  const c = canvasEl.getContext('2d');
  if (!c) return;
  c.imageSmoothingEnabled = false;
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const sprite = GATOR_STAGES.adult.idle;
  const tints = { body: traits.bodyColor, belly: traits.bellyColor, dark: traits.darkColor, scute: traits.scuteColor };
  drawSprite(c, sprite, 2, 1, false, tints);
}

function refreshFoundingPairUI() {
  const grid = document.getElementById('founding-pair-grid');
  const rerollSpan = document.getElementById('founding-rerolls');
  const nameLabel = document.getElementById('founding-dynasty-name');
  if (!grid || !pendingFounders) return;
  if (rerollSpan) rerollSpan.textContent = String(pendingFounders.rerollsLeft);
  if (nameLabel) nameLabel.textContent = '— ' + pendingFounders.name + ' —';

  // Default control selection to male (first card)
  if (!pendingFounders.controlSex) pendingFounders.controlSex = 'male';

  grid.innerHTML = '';
  for (const founder of [pendingFounders.male, pendingFounders.female]) {
    const wrap = document.createElement('div');
    wrap.className = 'bge-founder' + (pendingFounders.controlSex === founder.sex ? ' bge-founder-controlled' : '');
    const canvasEl = document.createElement('canvas');
    canvasEl.className = 'bge-founder-preview';
    canvasEl.width = 28; canvasEl.height = 10;
    wrap.appendChild(canvasEl);
    const sexEl = document.createElement('div');
    sexEl.className = 'bge-founder-sex';
    sexEl.textContent = founder.sex;
    wrap.appendChild(sexEl);
    const input = document.createElement('input');
    input.className = 'bge-founder-name';
    input.maxLength = 20;
    input.value = founder.name;
    input.oninput = (e) => { founder.name = e.target.value.slice(0, 20); };
    wrap.appendChild(input);
    const trait = document.createElement('div');
    trait.className = 'bge-founder-trait';
    trait.textContent = describeTrait(founder.traits);
    wrap.appendChild(trait);

    // Control radio — "play as this one"
    const controlLabel = document.createElement('label');
    controlLabel.className = 'bge-founder-control-label';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'founder-control';
    radio.value = founder.sex;
    radio.checked = pendingFounders.controlSex === founder.sex;
    radio.onchange = () => {
      pendingFounders.controlSex = founder.sex;
      // Refresh control highlight on both cards
      const cards = grid.querySelectorAll('.bge-founder');
      cards.forEach(c => c.classList.remove('bge-founder-controlled'));
      wrap.classList.add('bge-founder-controlled');
    };
    controlLabel.appendChild(radio);
    controlLabel.appendChild(document.createTextNode('play as this one'));
    wrap.appendChild(controlLabel);

    grid.appendChild(wrap);
    renderFounderPreview(canvasEl, founder.sex, founder.traits);
  }
}

function showFoundingPair() {
  if (!foundingPair) { startTerrariumFresh(); return; }
  pendingFounders = {
    dynastyId: 'dyn_' + rng.range(1e6, 9e6).toString(36),
    name: randomDynastyName(rng),
    rerollsLeft: getMaxRerolls(MAX_REROLLS),
    male: rollFounderCandidate('male'),
    female: rollFounderCandidate('female'),
  };
  foundingPair.classList.remove('hidden');
  refreshFoundingPairUI();
  const rerollBtn = document.getElementById('founding-reroll');
  const beginBtn = document.getElementById('founding-begin');
  if (rerollBtn) rerollBtn.onclick = () => {
    if (!pendingFounders || pendingFounders.rerollsLeft <= 0) return;
    pendingFounders.rerollsLeft--;
    pendingFounders.male = rollFounderCandidate('male');
    pendingFounders.female = rollFounderCandidate('female');
    pendingFounders.name = randomDynastyName(rng);
    refreshFoundingPairUI();
  };
  if (beginBtn) beginBtn.onclick = () => {
    if (!pendingFounders) return;
    commitFounders();
    foundingPair.classList.add('hidden');
  };
}

function commitFounders() {
  const p = pendingFounders;
  if (!p) return;
  gameMode = MODE_DYNASTY;
  dynasty = {
    id: p.dynastyId,
    name: p.name,
    foundedAt: Date.now(),
    founderNames: [p.male.name, p.female.name],
    eraReached: 0,
    playerGatorId: null,
  };
  extinctionGraceTimer = 30; // 30s of grace so a stray event doesn't end it frame 1
  dynastyFounderIds = [];

  const controlSex = p.controlSex || 'male';

  const maleId = spawnGator(rng, 'adult', {
    x: CANVAS_W * 0.4, y: waterY - 3,
    sex: 'male', traits: p.male.traits,
    name: p.male.name, lineageId: p.dynastyId, founder: true,
    isPlayer: controlSex === 'male',
  });
  const femaleId = spawnGator(rng, 'adult', {
    x: CANVAS_W * 0.55, y: waterY - 3,
    sex: 'female', traits: p.female.traits,
    name: p.female.name, lineageId: p.dynastyId, founder: true,
    isPlayer: controlSex === 'female',
  });
  dynastyFounderIds.push(maleId, femaleId);
  dynasty.playerGatorId = controlSex === 'male' ? maleId : femaleId;

  // Wire player control system
  setPlayerControlDynasty(dynasty);
  setPlayerControlWildlife(wildlifeState);

  pendingFounders = null;
  simulationStarted = true;
  // Show the family-tree HUD button now that we're in dynasty mode
  if (familyTreeToggle) familyTreeToggle.classList.remove('hidden');
}

// --- Family tree + succession ---
const familyTreeToggle = document.getElementById('family-tree-toggle');
const familyTreeOverlay = document.getElementById('family-tree-overlay');
const familyTreeBody = document.getElementById('family-tree-body');
const familyTreeStats = document.getElementById('family-tree-stats');
const familyTreeClose = document.getElementById('family-tree-close');
let familyTreeMode = 'browse'; // 'browse' | 'succession'

function renderTreeNode(node, mode) {
  const wrap = document.createElement('div');
  wrap.className = 'family-tree-node';
  if (!node.alive) wrap.classList.add('is-dead');
  if (node.gator?.isPlayer) wrap.classList.add('is-player');

  const name = document.createElement('div');
  name.className = 'family-tree-name';
  name.textContent = node.name;
  wrap.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'family-tree-meta';
  const sexGlyph = node.sex === 'female' ? '♀' : (node.sex === 'male' ? '♂' : '·');
  if (node.alive && node.gator) {
    const days = Math.floor((node.gator.age || 0) / 60);
    meta.textContent = `${sexGlyph} ${node.gator.stage} · ${days}d`;
  } else if (node.obitEntry) {
    const days = Math.floor((node.obitEntry.age || 0) / 60);
    meta.textContent = `${sexGlyph} died · ${days}d · ${node.obitEntry.cause || 'unknown'}`;
  } else {
    meta.textContent = `${sexGlyph} ${node.alive ? 'alive' : 'gone'}`;
  }
  wrap.appendChild(meta);

  if (mode === 'succession' && node.alive && node.gator?.stage !== 'egg') {
    const becomeBtn = document.createElement('button');
    becomeBtn.type = 'button';
    becomeBtn.className = 'family-tree-become-btn';
    becomeBtn.textContent = 'become';
    becomeBtn.onclick = (e) => {
      e.stopPropagation();
      pickHeir(node.id);
    };
    wrap.appendChild(becomeBtn);
  } else if (mode === 'browse') {
    wrap.onclick = () => {
      // Open inspector for the node's gator if alive
      if (node.alive && node.gator) {
        closeFamilyTree();
        openInspectorForGator(node.gator);
      }
    };
  }

  return wrap;
}

function showFamilyTree(mode = 'browse') {
  if (!familyTreeOverlay || !familyTreeBody || !dynasty) return;
  familyTreeMode = mode;
  const obit = obituaryState?.entries || [];
  const tree = buildTree(world, obit, dynasty.id);

  let alive = 0, dead = 0;
  for (const gen of tree) for (const n of gen) (n.alive ? alive++ : dead++);
  if (familyTreeStats) {
    familyTreeStats.textContent = `${alive} alive · ${dead} gone · gen ${maxGeneration}`;
  }

  familyTreeBody.innerHTML = '';
  if (mode === 'succession') {
    const banner = document.createElement('div');
    banner.className = 'family-tree-mode-label';
    banner.textContent = 'the bloodline goes on. choose your heir.';
    familyTreeBody.appendChild(banner);
  }

  if (tree.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'family-tree-empty';
    empty.textContent = 'no record yet';
    familyTreeBody.appendChild(empty);
  } else {
    tree.forEach((gen, i) => {
      const genWrap = document.createElement('div');
      genWrap.className = 'family-tree-gen';
      const genLabel = document.createElement('div');
      genLabel.className = 'family-tree-gen-label';
      genLabel.textContent = i === 0 ? 'founders' : `generation ${i}`;
      genWrap.appendChild(genLabel);
      const row = document.createElement('div');
      row.className = 'family-tree-row';
      gen.sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0));
      for (const node of gen) row.appendChild(renderTreeNode(node, mode));
      genWrap.appendChild(row);
      familyTreeBody.appendChild(genWrap);
    });
  }

  familyTreeOverlay.classList.remove('hidden');
}

function closeFamilyTree() {
  familyTreeOverlay?.classList.add('hidden');
  familyTreeMode = 'browse';
}

function pickHeir(newPlayerId) {
  setPlayerGator(world, newPlayerId, dynasty);
  setPlayerControlDynasty(dynasty);
  closeFamilyTree();
}

function showSuccessionModal(successors) {
  // The succession modal IS the family tree, filtered to living members.
  // buildTree already includes all alive bloodline; we just open it in succession mode.
  showFamilyTree('succession');
}

if (familyTreeToggle) familyTreeToggle.onclick = () => showFamilyTree('browse');
if (familyTreeClose) familyTreeClose.onclick = () => {
  if (familyTreeMode === 'succession') return; // can't dismiss succession without picking
  closeFamilyTree();
};
familyTreeOverlay?.addEventListener('click', (e) => {
  if (e.target === familyTreeOverlay && familyTreeMode === 'browse') closeFamilyTree();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && familyTreeMode === 'browse') closeFamilyTree();
  if (e.key === 't' || e.key === 'T') {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (gameMode === MODE_DYNASTY && dynasty && simulationStarted && familyTreeOverlay?.classList.contains('hidden')) {
      showFamilyTree('browse');
    }
  }
});

// On boot for an already-loaded dynasty save, expose the family tree button
if (gameMode === MODE_DYNASTY && dynasty && familyTreeToggle) {
  familyTreeToggle.classList.remove('hidden');
}

function showDynastyGameOver() {
  dynastyExtinct = true;
  // Tally stats for the obituary
  dynastyStats = {
    name: dynasty?.name || 'dynasty',
    generationsReached: maxGeneration,
    daysLived: Math.floor(simTime / 60), // rough sim-days proxy
    lineagePointsEarned: Math.max(1, maxGeneration * 10 + Math.floor(simTime / 30)),
  };
  lineagePoints += dynastyStats.lineagePointsEarned;
  saveLineagePoints(lineagePoints);
  if (!gameOverOverlay) return;
  const statsEl = document.getElementById('game-over-stats');
  if (statsEl) {
    statsEl.innerHTML =
      `<div><span class="bge-label">dynasty:</span> <span class="bge-value">${dynastyStats.name}</span></div>` +
      `<div><span class="bge-label">founders:</span> <span class="bge-value">${(dynasty?.founderNames || []).join(' · ')}</span></div>` +
      `<div><span class="bge-label">generations:</span> <span class="bge-value">${dynastyStats.generationsReached}</span></div>` +
      `<div><span class="bge-label">days lived:</span> <span class="bge-value">${dynastyStats.daysLived}</span></div>` +
      `<div><span class="bge-label">lineage points:</span> <span class="bge-value">+${dynastyStats.lineagePointsEarned} (${lineagePoints} total)</span></div>`;
  }
  gameOverOverlay.classList.remove('hidden');
}

function resetToFreshDynasty() {
  // Wipe current world save + seed so we get a brand-new swamp
  try { persistence.clear(); } catch (e) {}
  try { localStorage.removeItem('idlegator_lastSeed'); } catch (e) {}
  window.location.hash = '';
  window.location.reload();
}

function resetToTerrarium() {
  try { persistence.clear(); } catch (e) {}
  window.location.hash = '';
  window.location.reload();
}

const gameOverRestart = document.getElementById('game-over-restart');
if (gameOverRestart) gameOverRestart.onclick = resetToFreshDynasty;
const gameOverTerrarium = document.getElementById('game-over-terrarium');
if (gameOverTerrarium) gameOverTerrarium.onclick = resetToTerrarium;

// --- Obituary Panel ---
const obituaryPanel = document.getElementById('obituary-panel');
const obituaryToggle = document.getElementById('obituary-toggle');
if (obituaryToggle && obituaryPanel) {
  obituaryToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowOpen = obituaryPanel.classList.toggle('hidden');
    // classList.toggle returns true when class was ADDED (so panel is now hidden)
    const isOpen = !nowOpen;
    obituaryToggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) renderObituaryPanel(obituaryState);
  });
}
// Close when clicking outside the panel
document.addEventListener('click', (e) => {
  if (!obituaryPanel || !obituaryToggle) return;
  if (!obituaryPanel.classList.contains('hidden') &&
      !obituaryPanel.contains(e.target) && e.target !== obituaryToggle) {
    obituaryPanel.classList.add('hidden');
    obituaryToggle.setAttribute('aria-expanded', 'false');
  }
});

// --- Unlocks Shop ---
let shopReturnOverlay = null;

function openUnlocksShop(returnTo) {
  shopReturnOverlay = returnTo || null;
  renderUnlocksShop();
  const shopEl = document.getElementById('unlocks-shop');
  if (shopEl) shopEl.classList.remove('hidden');
}

function closeUnlocksShop() {
  const shopEl = document.getElementById('unlocks-shop');
  if (shopEl) shopEl.classList.add('hidden');
  shopReturnOverlay = null;
}

function renderUnlocksShop() {
  const balanceEl = document.getElementById('unlocks-balance');
  const listEl = document.getElementById('unlocks-list');
  const feedbackEl = document.getElementById('unlocks-feedback');
  if (!listEl) return;
  if (balanceEl) balanceEl.textContent = `${lineagePoints} lineage point${lineagePoints === 1 ? '' : 's'}`;
  if (feedbackEl) feedbackEl.textContent = '';

  const owned = loadPurchasedUnlocks();
  const allOwned = UNLOCKS.every(u => owned.has(u.id));
  listEl.innerHTML = '';

  if (allOwned) {
    const empty = document.createElement('div');
    empty.className = 'unlock-row';
    empty.style.cssText = 'color:#4a6a4a;font-size:10px;letter-spacing:2px;';
    empty.textContent = 'nothing more for sale';
    listEl.appendChild(empty);
    return;
  }

  for (const unlock of UNLOCKS) {
    const isOwned = owned.has(unlock.id);
    const canAfford = lineagePoints >= unlock.cost;
    const row = document.createElement('div');
    row.className = 'unlock-row ' + (isOwned ? 'owned' : canAfford ? 'affordable' : 'unaffordable');
    row.dataset.id = unlock.id;

    const text = document.createElement('div');
    text.className = 'unlock-text';
    const nameDiv = document.createElement('div');
    nameDiv.className = 'unlock-name';
    nameDiv.textContent = unlock.name;
    const descDiv = document.createElement('div');
    descDiv.className = 'unlock-desc';
    descDiv.textContent = unlock.description;
    text.appendChild(nameDiv);
    text.appendChild(descDiv);

    const right = document.createElement('div');
    right.className = 'unlock-right';

    if (isOwned) {
      const badge = document.createElement('span');
      badge.className = 'unlock-owned-badge';
      badge.textContent = 'kept';
      right.appendChild(badge);
    } else {
      const cost = document.createElement('span');
      cost.className = 'unlock-cost';
      cost.textContent = `${unlock.cost} lp`;
      right.appendChild(cost);
      if (canAfford) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'unlock-buy-btn';
        btn.textContent = 'keep';
        btn.dataset.buyId = unlock.id;
        right.appendChild(btn);
      }
    }

    row.appendChild(text);
    row.appendChild(right);
    listEl.appendChild(row);
  }
}

const shopOverlayEl = document.getElementById('unlocks-shop');
if (shopOverlayEl) {
  shopOverlayEl.addEventListener('click', (e) => {
    if (e.target.closest('#unlocks-close')) { closeUnlocksShop(); return; }
    const buyBtn = e.target.closest('[data-buy-id]');
    if (buyBtn) {
      const result = purchase(buyBtn.dataset.buyId, lineagePoints);
      const feedbackEl = document.getElementById('unlocks-feedback');
      if (result.ok) {
        lineagePoints = result.newPoints;
        saveLineagePoints(lineagePoints);
        const row = shopOverlayEl.querySelector(`[data-id="${buyBtn.dataset.buyId}"]`);
        if (row) { row.classList.add('flash'); row.addEventListener('animationend', () => row.classList.remove('flash'), { once: true }); }
        renderUnlocksShop();
      } else {
        if (feedbackEl) feedbackEl.textContent = result.error || 'not enough';
      }
    }
  });
}

const titleVaultBtn = document.getElementById('title-vault-btn');
if (titleVaultBtn) titleVaultBtn.onclick = () => openUnlocksShop('title');
const gameOverVaultBtn = document.getElementById('game-over-vault-btn');
if (gameOverVaultBtn) gameOverVaultBtn.onclick = () => openUnlocksShop('game-over');

// Boot flow:
// 1. If a "new run" intent was stashed by the title screen (via reload), honor it.
// 2. Otherwise, always show the title screen — even for existing saves, so the user
//    can choose Continue vs. New without clearing storage manually.
let pendingNewMode = null;
try {
  pendingNewMode = localStorage.getItem('bge_pending_mode');
  if (pendingNewMode) localStorage.removeItem('bge_pending_mode');
} catch (e) {}

if (pendingNewMode === MODE_DYNASTY) {
  if (startOverlay) startOverlay.classList.add('hidden');
  showFoundingPair();
} else if (pendingNewMode === MODE_TERRARIUM) {
  if (startOverlay) startOverlay.classList.add('hidden');
  startTerrariumFresh();
} else {
  showTitleScreen();
}

// --- Game Loop ---
let lastTime = 0;
let gameOver = false;
let gameOverTimer = 0;
// Render-freeze flag — when false, the game loop skips all simulation + animation
// and leaves the one-time static title backdrop on screen. Flipped to true when the
// user picks Continue / commits founders / starts terrarium fresh.
let simulationStarted = false;
let titleBackdropPainted = false;

function gameLoop(timestamp) {
  // Title-screen render freeze: paint a single static backdrop frame, then
  // skip every subsequent frame until the player commits to a mode. No
  // simulation, no audio updates, no time passing.
  if (!simulationStarted) {
    if (!titleBackdropPainted) {
      paintTitleBackdrop();
      titleBackdropPainted = true;
    }
    lastTime = timestamp; // keep dt from ballooning once sim starts
    requestAnimationFrame(gameLoop);
    return;
  }

  if (!lastTime) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000;
  if (dt > MAX_DT) dt = MAX_DT;
  lastTime = timestamp;

  // Apply speed multiplier (0 when paused)
  const speedMult = getSpeedMultiplier();
  dt *= speedMult;

  simTime += dt;

  // Orientation poll — catches rotations in browsers that fire no events
  checkOrientation();

  // Skip all simulation when paused — fall through to render below
  if (speedMult === 0) {
    renderPausedFrame(ctx, simTime);
    requestAnimationFrame(gameLoop);
    return;
  }

  // Environment
  environmentSystem(env, dt, rng);

  // Era system — tick era clock in dynasty mode; inject acid rain in industrial+
  if (gameMode === MODE_DYNASTY && dynasty) {
    initEraDynasty(dynasty);
    const eraCallbacks = {
      onAdvance({ era }) {
        pendingEraCelebration = { era, timer: 4 };
        eraCelebrationTimer = 4;
      },
      onLineagePointBonus(amount) {
        lineagePoints += amount;
        saveLineagePoints(lineagePoints);
      },
    };
    updateEraClock(dynasty, dt, maxGeneration, rng, eraCallbacks);
    if (dynasty.era >= 2) maybeInjectAcidRain(env, rng);
  }

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
  breedingSystem(world, dt, rng, waterY, spawnGatorFromParents, obituaryState);
  lifecycleSystem(world, dt, rng, obituaryState, simTime);
  predatorSystem(world, dt, rng, waterY, simTime, obituaryState);
  physicsSystem(world, dt, terrain, waterY, rng);
  updateAmbientParticles(particles, dt, simTime, rng, env, waterY);
  updateGatorRipples(particles, world, dt, rng, waterY);
  const currentEraId = (gameMode === MODE_DYNASTY && dynasty) ? (dynasty.era || 1) : 1;
  updateWildlife(wildlifeState, dt, simTime, rng, world, waterY, { spawnDeathParticles, spawnPrey, particles, playZap, playEat, obituaryState }, currentEraId);
  updateEvents(events, world, dt, rng, waterY, simTime, env, obituaryState);
  updateFires(fireState, dt, rng, wildlifeState.wildlife, world, env, waterY);

  // Update flying tree debris
  for (let i = vegState.flyingDebris.length - 1; i >= 0; i--) {
    const d = vegState.flyingDebris[i];
    d.life -= dt;
    if (d.life <= 0 || d.y > waterY + 10) {
      vegState.flyingDebris.splice(i, 1);
      continue;
    }
    // If tornado still active, orbit around it
    if (events.tornado) {
      const dx = events.tornado.x - d.x;
      const pull = Math.sign(dx) * 15;
      d.vx += pull * dt;
      d.vy -= 8 * dt; // tornado lifts debris
    } else {
      d.vy += 12 * dt; // gravity when tornado is gone
    }
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.rotSpeed * dt;
    d.vx *= 0.99;
  }

  // Destroyed trees slowly regrow (remove from list after 120s)
  for (let i = vegState.destroyedTrees.length - 1; i >= 0; i--) {
    // Track age by storing as {x, age} — but currently just x numbers
    // Simple approach: remove one random destroyed tree every 30 seconds
  }
  if (vegState.destroyedTrees.length > 0 && rng.chance(0.03 * dt)) {
    vegState.destroyedTrees.shift(); // oldest tree regrows first
  }
  updateVegGrowth(dt);
  updateAudio(dt, env, simTime);
  setEpoch(vegState.epoch);

  // Audio hooks for events
  if (events.ufo) { setUFO(true); } else { setUFO(false); }
  updateDeathParticles(particles, dt);
  updateMoments(obituaryState, dt);

  // Player HUD + hover tooltip (HTML overlays)
  updatePlayerHUD();
  updateHoverTooltip();

  // Hurricane pushes everything + expose wind to renderer
  env._hurricaneWind = events.hurricane ? events.hurricane.windSpeed : 0;
  if (events.hurricane) {
    const wind = events.hurricane.windSpeed * dt;
    for (const w of wildlifeState.wildlife) { w.x += wind; }
    for (const [id, tr] of world.query('transform', 'gator')) { tr.x += wind * 0.3; }
    for (const [id, tr] of world.query('transform', 'prey')) { tr.x += wind * 0.5; }
  }

  // Flood current — pushes submerged things sideways, extinguishes fires
  if (events.flood && events.flood.progress > 2) {
    const floodCurrent = events.flood.currentDir * events.flood.currentSpeed;
    const floodWaterY = waterY - events.flood.progress;
    // Wildlife drifts with current
    for (const w of wildlifeState.wildlife) {
      if (w.y > floodWaterY) {
        w.x += floodCurrent * dt;
      }
    }
    // Skulls drift slowly
    for (const skull of skulls) {
      if (skull.y > floodWaterY) {
        skull.x += floodCurrent * dt * 0.5;
      }
    }
    // Fires get extinguished by rising water
    for (const fire of fireState.fires) {
      if (fire.y > floodWaterY) {
        fire.life -= dt * 5;
      }
    }
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

  // --- The Deep update ---
  deepState.shadowTimer -= dt;
  if (deepState.shadowTimer <= 0 && !deepState.shadowActive) {
    deepState.shadowActive = true;
    deepState.shadowDir = rng.chance(0.5) ? 1 : -1;
    deepState.shadowX = deepState.shadowDir === 1 ? -60 : CANVAS_W + 10;
    deepState.shadowTimer = rng.float(30, 90);
  }
  if (deepState.shadowActive) {
    deepState.shadowX += deepState.shadowDir * (CANVAS_W + 70) / 8 * dt; // cross in ~8 seconds
    // Deactivate when off screen
    if ((deepState.shadowDir === 1 && deepState.shadowX > CANVAS_W + 10) ||
        (deepState.shadowDir === -1 && deepState.shadowX < -60)) {
      deepState.shadowActive = false;
    }
    // Occasional eye flash
    if (rng.chance(0.15 * dt)) {
      deepState.eyeFlash = 0.03; // one frame basically
    }
    if (deepState.eyeFlash > 0) deepState.eyeFlash -= dt;
  }
  deepState.rippleTimer -= dt;
  if (deepState.rippleTimer <= 0) {
    addRipple(particles, rng.float(20, CANVAS_W - 20), waterY, rng.float(15, 20), 0.6);
    deepState.rippleTimer = rng.float(15, 40);
  }

  // Skull aging
  for (const skull of skulls) {
    skull.age += dt;
  }

  // Animal tracks — gators leave drag marks near the waterline
  trackSpawnTimer -= dt;
  if (trackSpawnTimer <= 0) {
    trackSpawnTimer = 0.3;
    for (const [id, tr, gator] of world.query('transform', 'gator')) {
      if (Math.abs(tr.vx) > 2 && Math.abs(tr.y + gator.spriteH - waterY) < 5) {
        tracks.push({ x: tr.x + gator.spriteW / 2, y: waterY - 1, age: 0 });
        if (tracks.length > 40) tracks.shift();
      }
    }
  }
  for (let i = tracks.length - 1; i >= 0; i--) {
    tracks[i].age += dt;
    if (tracks[i].age > 20) tracks.splice(i, 1);
  }

  // Harvest gator deaths — spawn skulls before flush removes them
  for (const deadId of world.dead) {
    if (world.has(deadId, 'gator')) {
      const tr = world.get(deadId, 'transform');
      const gator = world.get(deadId, 'gator');
      if (tr && gator && gator.stage !== 'egg') {
        addSkull(tr.x + (gator.spriteW || 10) / 2 - 1, tr.y + (gator.spriteH || 5) - 2);
      }
    }
  }

  // Player gator death check — detect when the player-controlled gator has died
  if (gameMode === MODE_DYNASTY && dynasty && dynasty.playerGatorId && !dynastyExtinct && !deathCutsceneActive) {
    const pgGator = world.get(dynasty.playerGatorId, 'gator');
    if (!pgGator) {
      // Player gator is gone — find cause from obituary (most recent entry for this gator name)
      const lastPgName = dynasty._lastPlayerGatorName || null;
      let deathCause = 'unknown';
      let deathGatorSnap = dynasty._lastPlayerGatorSnap || { name: lastPgName, age: 0 };
      if (lastPgName && obituaryState?.entries) {
        const entry = obituaryState.entries.find(e => e.name === lastPgName);
        if (entry) {
          deathCause = entry.cause || 'unknown';
          deathGatorSnap = { name: entry.name, age: entry.age };
        }
      }
      dynasty.playerGatorId = null;
      dynasty._lastPlayerGatorName = null;
      dynasty._lastPlayerGatorSnap = null;

      const successors = getLivingSuccessors(world, dynasty.id);
      if (successors.length > 0) {
        showDeathCutscene(deathGatorSnap, deathCause, successors);
      }
      // If no successors, extinction check below will handle it
    } else {
      // Track current gator name/snapshot so we have it if they die next frame
      dynasty._lastPlayerGatorName = pgGator.name || null;
      dynasty._lastPlayerGatorSnap = { name: pgGator.name, age: pgGator.age || 0 };
    }
  }

  // Tick death cutscene timer
  tickDeathCutscene(dt);

  // Population check — behavior depends on mode.
  // Terrarium: classic "all gators dead" canvas game-over screen with respawn button.
  // Dynasty: the bloodline (lineageId matching dynasty.id) is what matters. Non-lineage
  //   gators coming and going is just ambient life. Extinction = lineage count hits 0.
  if (gameMode === MODE_DYNASTY && dynasty && !dynastyExtinct) {
    if (extinctionGraceTimer > 0) extinctionGraceTimer -= dt;
    else if (countLivingBloodline(world, dynasty.id) === 0) {
      showDynastyGameOver();
    }
  } else if (gameMode === MODE_TERRARIUM) {
    if (world.count('gator') === 0 && !gameOver) {
      gameOver = true;
      gameOverTimer = 0;
    }
  }

  world.flush();

  // Auto-save
  if (persistence.shouldAutoSave(dt)) {
    persistence.save(world, env, simTime, maxGeneration, vegState, { mode: gameMode, dynasty });
  }

  // --- Render ---
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const frameVegRng = createRNG(rng._seed + 999);

  renderSky(ctx, waterY, simTime, env);
  renderCelestial(ctx, env, waterY, simTime);
  renderRainbow(ctx, vegState, waterY);
  // Industrial era: distant smokestacks behind terrain
  if (currentEraId >= 2) renderSmokestacks(ctx, waterY, simTime, rng._seed);
  renderSkyLife(ctx, waterY, simTime, frameVegRng);
  renderTerrain(ctx, terrain, waterY);

  // Gator drag marks — dark dots that fade over time
  for (const track of tracks) {
    ctx.globalAlpha = Math.max(0, 1 - track.age / 20);
    ctx.fillStyle = '#3a3a2a';
    ctx.fillRect(Math.floor(track.x), Math.floor(track.y), 1, 1);
  }
  ctx.globalAlpha = 1;

  renderWater(ctx, waterY, simTime);
  renderTheDeep(ctx, deepState, waterY, simTime);
  renderUnderwaterLife(ctx, waterY, simTime, frameVegRng);
  renderVegetation(ctx, terrain, waterY, frameVegRng, simTime, vegState, env);
  renderSkulls(ctx, skulls, simTime);
  renderPrey(ctx, world, simTime, dt);
  renderGators(ctx, world, simTime);
  renderPredators(ctx, world);
  renderRipples(ctx, particles, dt);
  renderWildlife(ctx, wildlifeState, simTime);
  renderAmbientParticles(ctx, particles, simTime);
  renderDeathParticles(ctx, particles);

  // Render flying tree debris
  for (const d of vegState.flyingDebris) {
    const px = Math.floor(d.x);
    const py = Math.floor(d.y);
    ctx.fillStyle = d.color;
    // Rotating chunk — draw a small rectangle at an angle approximated by pixel offsets
    const cos = Math.cos(d.rot);
    const sin = Math.sin(d.rot);
    for (let dx = 0; dx < d.size; dx++) {
      for (let dy = 0; dy < Math.max(1, d.size - 1); dy++) {
        const rx = Math.floor(px + dx * cos - dy * sin);
        const ry = Math.floor(py + dx * sin + dy * cos);
        ctx.fillRect(rx, ry, 1, 1);
      }
    }
  }
  renderFires(ctx, fireState, simTime);
  renderEvents(ctx, events, simTime, waterY);
  renderEnvironmentEffects(ctx, env, waterY, simTime);

  // Heat shimmer — wavy pixel displacement above ground during peak sun
  const tod = env.timeOfDay;
  const noonIntensity = (tod > 0.35 && tod < 0.65) ? 1 - Math.abs(tod - 0.5) * 6.67 : 0;
  if (noonIntensity > 0.1 && env.weather === 'clear') {
    const shimmerZone = waterY - 15; // shimmer near the ground
    for (let y = shimmerZone; y < waterY; y++) {
      const offset = Math.round(Math.sin(y * 0.8 + simTime * 4) * noonIntensity * 1.5);
      if (offset !== 0) {
        // Shift this row horizontally by copying it onto itself offset
        ctx.drawImage(canvas, 0, y, CANVAS_W, 1, offset, y, CANVAS_W, 1);
      }
    }
  }

  renderMoments(ctx, obituaryState, drawPixelText, CANVAS_W, CANVAS_H);
  renderFullUI(ctx, simTime);

  // Era transition celebration overlay — cinematic chapter card
  if (pendingEraCelebration) {
    eraCelebrationTimer -= dt;
    if (eraCelebrationTimer <= 0) {
      pendingEraCelebration = null;
      eraCelebrationTimer = 0;
    } else {
      // Fade in over 0.6s, hold, fade out over 0.5s
      const total = 4.0;
      const fadeInDur = 0.6;
      const fadeOutDur = 0.5;
      const elapsed = total - eraCelebrationTimer;
      let fadeAlpha;
      if (elapsed < fadeInDur) {
        fadeAlpha = elapsed / fadeInDur;
      } else if (eraCelebrationTimer < fadeOutDur) {
        fadeAlpha = eraCelebrationTimer / fadeOutDur;
      } else {
        fadeAlpha = 1;
      }
      const cel = pendingEraCelebration;
      const el = document.getElementById('era-celebration');
      if (el) {
        if (!el.dataset.era || el.dataset.era !== String(cel.era.id)) {
          el.dataset.era = String(cel.era.id);
          const numeralEl = el.querySelector('.era-cel-numeral');
          const nameEl = el.querySelector('.era-cel-name');
          const flavorEl = el.querySelector('.era-cel-flavor');
          // Roman numeral for era id
          const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
          if (numeralEl) numeralEl.textContent = ROMAN[cel.era.id] || String(cel.era.id);
          if (nameEl) nameEl.textContent = cel.era.name.toUpperCase();
          if (flavorEl) flavorEl.textContent = ERA_FLAVOR[cel.era.id] || `the ${cel.era.name} era begins.`;
        }
        el.style.opacity = String(Math.max(0, Math.min(1, fadeAlpha)));
        el.classList.remove('hidden');
      }
    }
    if (!pendingEraCelebration) {
      const el = document.getElementById('era-celebration');
      if (el) el.classList.add('hidden');
    }
  }

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
    skulls.length = 0;
    tracks.length = 0;
    for (let i = 0; i < rng.range(4, 6); i++) {
      spawnGator(rng, rng.pick(['adult', 'adult', 'juvenile']));
    }
  }
});

// --- Mobile sim controls ---
// Show pause + speed buttons only on touch devices
if (isTouchDevice) {
  const simControls = document.getElementById('sim-controls');
  const pauseBtn = document.getElementById('sim-pause-btn');
  const speedBtn = document.getElementById('sim-speed-btn');

  if (simControls && pauseBtn && speedBtn) {
    simControls.classList.add('touch-visible');

    pauseBtn.addEventListener('click', () => {
      if (!simulationStarted) return;
      togglePause();
      pauseBtn.textContent = isPaused() ? '\u25b6' : 'pause';
      pauseBtn.classList.toggle('is-paused', isPaused());
    });

    speedBtn.addEventListener('click', () => {
      if (!simulationStarted) return;
      cycleSpeed(1);
      speedBtn.textContent = getSpeedLabel();
      // cycleSpeed unpauses — sync pause button
      pauseBtn.textContent = isPaused() ? '\u25b6' : 'pause';
      pauseBtn.classList.toggle('is-paused', isPaused());
    });
  }
}

requestAnimationFrame(gameLoop);
