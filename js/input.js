// Input system — god powers with mode cycling
// Mouse wheel or keys 1-6 to select power
// Click: activate current power at location
// Right-click: always scare (quick access)

import { CANVAS_W, CANVAS_H } from './config.js';

export const POWER_NAMES = ['food', 'rain', 'scare', 'lightning', 'heal', 'fire'];
export const POWER_COLORS = ['#dddd44', '#4488dd', '#dd4444', '#ffffff', '#44dd44', '#dd8822'];

let currentPower = 0;

export function getCurrentPower() {
  return currentPower;
}

export function createInputHandler(canvas, callbacks) {
  function getGamePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / rect.width * CANVAS_W),
      y: Math.floor((e.clientY - rect.top) / rect.height * CANVAS_H),
    };
  }

  // Click — activate current power
  function onDown(e) {
    if (e.button === 2) return; // right-click handled by contextmenu
    e.preventDefault();
    const pos = getGamePos(e);
    callbacks.onPower(pos.x, pos.y, POWER_NAMES[currentPower]);
  }

  // Right-click — always scare (quick access)
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getGamePos(e);
    callbacks.onScare(pos.x, pos.y);
  });

  // Mouse wheel — cycle powers
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      currentPower = (currentPower + 1) % POWER_NAMES.length;
    } else {
      currentPower = (currentPower - 1 + POWER_NAMES.length) % POWER_NAMES.length;
    }
  }, { passive: false });

  // Keyboard 1-6 — direct power select
  window.addEventListener('keydown', (e) => {
    const num = parseInt(e.key);
    if (num >= 1 && num <= POWER_NAMES.length) {
      currentPower = num - 1;
    }
  });

  // Mouse move — track cursor position for glow
  canvas.addEventListener('pointermove', (e) => {
    const pos = getGamePos(e);
    if (callbacks.onMove) {
      callbacks.onMove(pos.x, pos.y);
    }
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.style.touchAction = 'none'; // prevent browser touch handling
}
