// Input system — god powers with mode cycling
// G key toggles god mode on/off
// Mouse wheel or keys 1-6 to select power (when god mode is on)
// Click: activate current power at location (god mode) or just drop food (normal)
// Right-click: always scare (quick access)

import { CANVAS_W, CANVAS_H } from './config.js';

export const POWER_NAMES = ['food', 'rain', 'scare', 'lightning', 'heal', 'fire'];
export const POWER_COLORS = ['#dddd44', '#4488dd', '#dd4444', '#ffffff', '#44dd44', '#dd8822'];

let currentPower = 0;
let godMode = false;

// --- Pause + Speed ---
let speedIdx = 1; // 0=0.5x, 1=1x, 2=2x, 3=4x
const SPEEDS = [0.5, 1, 2, 4];
let paused = false;

export function getSpeedMultiplier() { return paused ? 0 : SPEEDS[speedIdx]; }
export function isPaused() { return paused; }
export function getSpeedLabel() { return paused ? 'paused' : SPEEDS[speedIdx] + 'x'; }
export function togglePause() { paused = !paused; }
export function cycleSpeed(dir) {
  speedIdx = (speedIdx + dir + SPEEDS.length) % SPEEDS.length;
  if (paused) paused = false; // any speed change unpauses
}

export function getCurrentPower() {
  return currentPower;
}

export function isGodMode() {
  return godMode;
}

export function createInputHandler(canvas, callbacks) {
  function getGamePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / rect.width * CANVAS_W),
      y: Math.floor((e.clientY - rect.top) / rect.height * CANVAS_H),
    };
  }

  // Click — activate current power (god mode) or drop food (terrarium fallback)
  function onDown(e) {
    if (e.button === 2) return;
    e.preventDefault();
    const pos = getGamePos(e);
    if (godMode) {
      callbacks.onPower(pos.x, pos.y, POWER_NAMES[currentPower]);
      return;
    }
    // In dynasty mode with a controlled gator, clicks belong to the player —
    // the pointerup in main.js dispatches them to playerControl. Don't also
    // drop food on top of that.
    if (callbacks.isPlayerControlActive && callbacks.isPlayerControlActive()) {
      return;
    }
    callbacks.onPower(pos.x, pos.y, 'food');
  }

  // Right-click — always scare
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getGamePos(e);
    callbacks.onScare(pos.x, pos.y);
  });

  // Mouse wheel — cycle powers (only in god mode)
  canvas.addEventListener('wheel', (e) => {
    if (!godMode) return;
    e.preventDefault();
    if (e.deltaY > 0) {
      currentPower = (currentPower + 1) % POWER_NAMES.length;
    } else {
      currentPower = (currentPower - 1 + POWER_NAMES.length) % POWER_NAMES.length;
    }
  }, { passive: false });

  // Keyboard
  window.addEventListener('keydown', (e) => {
    // Don't intercept if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Space toggles pause (only when sim is running — callbacks.isSimStarted check
    // happens in main.js by ignoring the exported state when !simulationStarted)
    if (e.key === ' ') {
      e.preventDefault();
      if (callbacks.isSimStarted && callbacks.isSimStarted()) togglePause();
      return;
    }

    // [ / ] cycle speed
    if (e.key === '[') {
      e.preventDefault();
      if (callbacks.isSimStarted && callbacks.isSimStarted()) cycleSpeed(-1);
      return;
    }
    if (e.key === ']') {
      e.preventDefault();
      if (callbacks.isSimStarted && callbacks.isSimStarted()) cycleSpeed(1);
      return;
    }

    // G toggles god mode
    if (e.key === 'g' || e.key === 'G') {
      godMode = !godMode;
      return;
    }
    // 1-6 select power (only in god mode)
    if (godMode) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= POWER_NAMES.length) {
        currentPower = num - 1;
      }
    }
  });

  // Mouse move — track cursor for glow
  canvas.addEventListener('pointermove', (e) => {
    const pos = getGamePos(e);
    if (callbacks.onMove) {
      callbacks.onMove(pos.x, pos.y);
    }
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.style.touchAction = 'none';
}
