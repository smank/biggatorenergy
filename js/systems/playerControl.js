// playerControl.js — click-to-act dispatcher for the player-controlled gator
//
// Converts canvas pointer events into gator intent overrides.
// The AI system reads gator.playerOverride to execute the player's will.

import { distance } from '../utils/math.js';

let _canvas = null;
let _world = null;
let _dynasty = null;
let _playSplash = null;
let _addRipple = null;
let _particles = null;
let _spawnDeathParticles = null;
let _waterY = 0;
let _wildlifeState = null;

// Hold-detection state
let _holdTimer = 0;
let _holdClientX = 0;
let _holdClientY = 0;
let _holdActive = false;
const HOLD_DURATION = 0.8; // seconds

// Tail-slap particle burst — green splash chips
function splatTailSlap(x, y) {
  if (!_spawnDeathParticles) return;
  for (let i = 0; i < 5; i++) {
    _spawnDeathParticles({ deathParticles: _particles.deathParticles }, x + (Math.random() - 0.5) * 8, y, '#5aaa3a');
  }
  if (_addRipple && _particles) {
    _addRipple(_particles, x, y, 10, 0.6);
  }
  if (_playSplash) _playSplash(0.4);
}

// Convert client coords to canvas logical pixel coords
function toCanvasCoords(clientX, clientY) {
  const rect = _canvas.getBoundingClientRect();
  const scaleX = _canvas.width / rect.width;
  const scaleY = _canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// Hit-test all gators; return best hit (largest scale wins ties)
function hitTestGators(cx, cy) {
  let best = null;
  let bestScale = -1;
  for (const [id, tr, gator] of _world.query('transform', 'gator')) {
    const scale = gator.sizeScale || 1;
    const w = (gator.spriteW || 10) * scale;
    const h = (gator.spriteH || 5) * scale;
    if (cx >= tr.x && cx <= tr.x + w && cy >= tr.y && cy <= tr.y + h) {
      if (scale > bestScale) {
        bestScale = scale;
        best = { id, tr, gator };
      }
    }
  }
  return best;
}

// Hit-test wildlife; return nearest within tolerance
function hitTestWildlife(cx, cy) {
  if (!_wildlifeState) return null;
  let best = null;
  let bestDist = 8;
  for (const w of _wildlifeState.wildlife) {
    if (!w.alive) continue;
    const d = distance(cx, cy, w.x, w.y);
    if (d < bestDist) {
      bestDist = d;
      best = w;
    }
  }
  return best;
}

// Hit-test prey entities
function hitTestPrey(cx, cy) {
  let best = null;
  let bestDist = 8;
  for (const [id, tr, prey] of _world.query('transform', 'prey')) {
    if (!prey.alive) continue;
    const d = distance(cx, cy, tr.x, tr.y);
    if (d < bestDist) {
      bestDist = d;
      best = { id, tr, prey };
    }
  }
  return best;
}

function getPlayerGator() {
  if (!_dynasty || !_dynasty.playerGatorId) return null;
  const gator = _world.get(_dynasty.playerGatorId, 'gator');
  const tr = _world.get(_dynasty.playerGatorId, 'transform');
  if (!gator || !tr) return null;
  return { id: _dynasty.playerGatorId, gator, tr };
}

export function dispatchClick(canvasX, canvasY, isShiftHeld) {
  if (!_world || !_dynasty) return false;
  const player = getPlayerGator();
  if (!player) return false;

  const hitGator = hitTestGators(canvasX, canvasY);

  // Shift-click on any gator always opens inspector
  if (isShiftHeld && hitGator) {
    return false; // return false = let inspector handle it
  }

  // Click on player's own gator = tail slap
  if (hitGator && hitGator.id === player.id) {
    // Tail slap: visual splash + scare nearby wildlife
    const midX = player.tr.x + (player.gator.spriteW || 10) / 2;
    const midY = player.tr.y + (player.gator.spriteH || 5);
    splatTailSlap(midX, midY);
    // Scare wildlife nearby
    if (_wildlifeState) {
      for (const w of _wildlifeState.wildlife) {
        if (!w.alive) continue;
        const d = distance(midX, midY, w.x, w.y);
        if (d < 35) {
          w.scared = true;
          w.scareTimer = 2.5;
          w.vx = (w.x > midX ? 1 : -1) * 18;
        }
      }
    }
    return true; // consumed — do NOT open inspector
  }

  // Click on another gator
  if (hitGator) {
    const tg = hitGator.gator;
    const linId = tg.lineage?.dynastyId || tg.lineageId;
    const isBloodline = linId === _dynasty.id;

    // If it's an opposite-sex bloodline adult, try courtship
    if (isBloodline && tg.stage === 'adult' && tg.sex !== player.gator.sex &&
        !tg.isPregnant && (tg.mateCooldown || 0) <= 0) {
      player.gator.playerOverride = { action: 'court', targetId: hitGator.id };
      player.gator.state = 'courting';
      player.gator.courtTarget = hitGator.id;
      player.gator.courtTimer = 3;
      player.gator.stateTimer = 5;
      return true;
    }

    // Otherwise fight
    player.gator.playerOverride = { action: 'fight', targetId: hitGator.id };
    player.gator.state = 'fighting';
    player.gator.stateTimer = 4;
    player.gator.fightTarget = hitGator.id;
    // Engage the target too
    const targetGator = hitGator.gator;
    if (targetGator && targetGator.state !== 'dying') {
      targetGator.state = 'fighting';
      targetGator.stateTimer = 4;
      targetGator.fightTarget = player.id;
    }
    return true;
  }

  // Click on prey
  const hitPrey = hitTestPrey(canvasX, canvasY);
  if (hitPrey) {
    player.gator.playerOverride = { action: 'hunt', targetId: hitPrey.id };
    player.gator.state = 'hunting';
    player.gator.stateTimer = 8;
    player.gator.targetId = hitPrey.id;
    return true;
  }

  // Click on wildlife
  const hitWildlife = hitTestWildlife(canvasX, canvasY);
  if (hitWildlife) {
    // Can hunt larger wildlife if it has a meat value; otherwise scare
    player.gator.playerOverride = { action: 'scare', targetWildlife: hitWildlife };
    hitWildlife.scared = true;
    hitWildlife.scareTimer = 3;
    hitWildlife.vx = (hitWildlife.x > canvasX ? 1 : -1) * 20;
    if (_addRipple && _particles) {
      _addRipple(_particles, canvasX, canvasY, 6, 0.5);
    }
    return true;
  }

  // Click on empty space = move to coords
  player.gator.playerOverride = { action: 'moveTo', x: canvasX, y: canvasY };
  player.gator.state = 'wandering';
  player.gator.stateTimer = 5;
  return true;
}

export function dispatchHold(canvasX, canvasY) {
  if (!_world || !_dynasty) return;
  const player = getPlayerGator();
  if (!player) return;

  // Bellow — radial expanding ripple
  const midX = player.tr.x + (player.gator.spriteW || 10) / 2;
  const midY = player.tr.y + (player.gator.spriteH || 5) / 2;
  if (_addRipple && _particles) {
    _addRipple(_particles, midX, midY, 30, 0.8);
    _addRipple(_particles, midX, midY, 20, 0.5);
  }
  if (_playSplash) _playSplash(0.6);
  // Scare all nearby wildlife in a wider radius
  if (_wildlifeState) {
    for (const w of _wildlifeState.wildlife) {
      if (!w.alive) continue;
      const d = distance(midX, midY, w.x, w.y);
      if (d < 60) {
        w.scared = true;
        w.scareTimer = 4;
        w.vx = (w.x > midX ? 1 : -1) * 22;
      }
    }
  }
}

// Called every frame in the game loop to tick hold detection
export function updatePlayerControl(dt, pointerDown, clientX, clientY) {
  if (!pointerDown) {
    _holdActive = false;
    _holdTimer = 0;
    return;
  }
  if (_holdActive) return; // already fired
  _holdTimer += dt;
  _holdClientX = clientX;
  _holdClientY = clientY;
  if (_holdTimer >= HOLD_DURATION) {
    _holdActive = true;
    const { x, y } = toCanvasCoords(_holdClientX, _holdClientY);
    dispatchHold(x, y);
  }
}

export function initPlayerControl({ canvas, world, dynasty, playSplash, addRipple, particles, spawnDeathParticles, waterY, wildlifeState }) {
  _canvas = canvas;
  _world = world;
  _dynasty = dynasty;
  _playSplash = playSplash;
  _addRipple = addRipple;
  _particles = particles;
  _spawnDeathParticles = spawnDeathParticles;
  _waterY = waterY;
  _wildlifeState = wildlifeState;
}

// Call this whenever dynasty reference changes (e.g. new dynasty created)
export function setPlayerControlDynasty(dynasty) {
  _dynasty = dynasty;
}

export function setPlayerControlWildlife(wildlifeState) {
  _wildlifeState = wildlifeState;
}
