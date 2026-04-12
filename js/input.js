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

  // Click — activate current power (god mode) or drop food (normal)
  function onDown(e) {
    if (e.button === 2) return;
    e.preventDefault();
    const pos = getGamePos(e);
    if (godMode) {
      callbacks.onPower(pos.x, pos.y, POWER_NAMES[currentPower]);
    } else {
      callbacks.onPower(pos.x, pos.y, 'food');
    }
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
