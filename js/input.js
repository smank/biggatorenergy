// Input system — god powers
// Click: drop food
// Hold (500ms): cause rain
// Double-tap / right-click: scare predators

import { CANVAS_W, CANVAS_H } from './config.js';

export function createInputHandler(canvas, callbacks) {
  let holdTimer = null;
  let holdPos = null;
  let lastClickTime = 0;

  function getGamePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / rect.width * CANVAS_W),
      y: Math.floor((e.clientY - rect.top) / rect.height * CANVAS_H),
    };
  }

  function onDown(e) {
    e.preventDefault();
    const pos = getGamePos(e);
    holdPos = pos;

    // Double-tap detection
    const now = Date.now();
    if (now - lastClickTime < 350) {
      // Double tap — scare predators
      callbacks.onScare(pos.x, pos.y);
      clearTimeout(holdTimer);
      holdTimer = null;
      lastClickTime = 0;
      return;
    }
    lastClickTime = now;

    // Start hold timer for rain
    holdTimer = setTimeout(() => {
      callbacks.onRain(pos.x, pos.y);
      holdTimer = null;
    }, 500);
  }

  function onUp(e) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      // Short click — drop food
      if (holdPos) {
        callbacks.onDropFood(holdPos.x, holdPos.y);
      }
    }
    holdPos = null;
  }

  // Right-click to scare
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pos = getGamePos(e);
    callbacks.onScare(pos.x, pos.y);
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.touchAction = 'none'; // prevent browser touch handling
}
