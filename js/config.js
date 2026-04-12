// Canvas and rendering
export const CANVAS_W = 256;
export const CANVAS_H = 144;

// Simulation
export const TICK_RATE = 1 / 10; // 10 Hz fixed timestep
export const MAX_DT = 0.1;       // clamp frame delta to prevent spiral

// Colors — swamp palette
export const COLORS = {
  // Sky — smaller, murkier
  skyTop: '#5a7a6a',
  skyMid: '#6a8a7a',
  skyBottom: '#7a9a85',

  // Water — murky swamp water
  waterSurface: '#2a5a3a',
  waterMid: '#1d4a2e',
  waterDeep: '#122e1c',
  waterLine: '#3a7a4a',

  // Land
  land: '#4a6a2e',
  landDark: '#3a5a22',
  mud: '#5a4a2a',
  mudDark: '#4a3a1e',

  // Gator
  gatorDark: '#2d5a1e',
  gatorBody: '#4a8c2a',
  gatorBelly: '#8bc34a',
  gatorEye: '#ffff00',
  gatorEyeDark: '#cc9900',
  gatorMouth: '#cc4444',

  // UI
  uiText: '#667766',
  uiTextDim: '#334433',
};

// Environment — water line pushed down, more land/swamp
export const WATER_LINE = 0.62; // much lower — more land above
export const TERRAIN_ROUGHNESS = 3;

// Lifecycle timing — faster pace
export const LIFECYCLE = {
  eggDuration: 30,        // 3 real seconds
  hatchlingDuration: 45,  // 4.5 real seconds
  juvenileDuration: 90,   // 9 real seconds
  adultDuration: 200,     // 20 real seconds
  elderDuration: 80,      // 8 real seconds
};

// Food — frequent spawning for lively ecosystem
export const FOOD_SPAWN_MIN = 1;
export const FOOD_SPAWN_MAX = 2.5;
export const MAX_FOOD = 16;
