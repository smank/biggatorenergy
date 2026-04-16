// Layered rendering system

import { CANVAS_W, CANVAS_H, COLORS } from '../config.js';
import { GATOR_STAGES, TINT_COLORS } from '../sprites/gator-sprites.js';

// --- Sprite Drawing ---
export function drawSprite(ctx, sprite, x, y, flipX = false, tints = null) {
  for (let py = 0; py < sprite.length; py++) {
    const row = sprite[py];
    for (let px = 0; px < row.length; px++) {
      let color = row[px];
      if (!color) continue;

      // Apply per-gator color tinting
      if (tints) {
        if (color === TINT_COLORS.body) color = tints.body;
        else if (color === TINT_COLORS.belly) color = tints.belly;
        else if (color === TINT_COLORS.dark) color = tints.dark;
        else if (color === TINT_COLORS.scute) color = tints.scute;
      }

      const dx = flipX ? (row.length - 1 - px) : px;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x + dx), Math.floor(y + py), 1, 1);
    }
  }
}

// --- Tiny 3x5 Pixel Font ---
const PIXEL_FONT = {
  '0': [0b111, 0b101, 0b101, 0b101, 0b111],
  '1': [0b010, 0b110, 0b010, 0b010, 0b111],
  '2': [0b111, 0b001, 0b111, 0b100, 0b111],
  '3': [0b111, 0b001, 0b111, 0b001, 0b111],
  '4': [0b101, 0b101, 0b111, 0b001, 0b001],
  '5': [0b111, 0b100, 0b111, 0b001, 0b111],
  '6': [0b111, 0b100, 0b111, 0b101, 0b111],
  '7': [0b111, 0b001, 0b010, 0b010, 0b010],
  '8': [0b111, 0b101, 0b111, 0b101, 0b111],
  '9': [0b111, 0b101, 0b111, 0b001, 0b111],
  'a': [0b010, 0b101, 0b111, 0b101, 0b101],
  'b': [0b110, 0b101, 0b110, 0b101, 0b110],
  'c': [0b011, 0b100, 0b100, 0b100, 0b011],
  'd': [0b110, 0b101, 0b101, 0b101, 0b110],
  'e': [0b111, 0b100, 0b110, 0b100, 0b111],
  'f': [0b111, 0b100, 0b110, 0b100, 0b100],
  'g': [0b011, 0b100, 0b101, 0b101, 0b011],
  'h': [0b101, 0b101, 0b111, 0b101, 0b101],
  'i': [0b111, 0b010, 0b010, 0b010, 0b111],
  'j': [0b001, 0b001, 0b001, 0b101, 0b010],
  'k': [0b101, 0b101, 0b110, 0b101, 0b101],
  'l': [0b100, 0b100, 0b100, 0b100, 0b111],
  'm': [0b101, 0b111, 0b111, 0b101, 0b101],
  'n': [0b101, 0b111, 0b111, 0b111, 0b101],
  'o': [0b010, 0b101, 0b101, 0b101, 0b010],
  'p': [0b110, 0b101, 0b110, 0b100, 0b100],
  'q': [0b010, 0b101, 0b101, 0b110, 0b011],
  'r': [0b110, 0b101, 0b110, 0b101, 0b101],
  's': [0b011, 0b100, 0b010, 0b001, 0b110],
  't': [0b111, 0b010, 0b010, 0b010, 0b010],
  'u': [0b101, 0b101, 0b101, 0b101, 0b010],
  'v': [0b101, 0b101, 0b101, 0b101, 0b010],
  'w': [0b101, 0b101, 0b111, 0b111, 0b101],
  'x': [0b101, 0b101, 0b010, 0b101, 0b101],
  'y': [0b101, 0b101, 0b010, 0b010, 0b010],
  'z': [0b111, 0b001, 0b010, 0b100, 0b111],
  ':': [0b000, 0b010, 0b000, 0b010, 0b000],
  ' ': [0b000, 0b000, 0b000, 0b000, 0b000],
  '.': [0b000, 0b000, 0b000, 0b000, 0b010],
  '-': [0b000, 0b000, 0b111, 0b000, 0b000],
  '#': [0b101, 0b111, 0b101, 0b111, 0b101],
};

export function drawPixelText(ctx, text, x, y) {
  let cx = x;
  for (const char of text.toLowerCase()) {
    const glyph = PIXEL_FONT[char];
    if (glyph) {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          if (glyph[row] & (1 << (2 - col))) {
            ctx.fillRect(cx + col, y + row, 1, 1);
          }
        }
      }
    }
    cx += 4;
  }
}

// --- Background Rendering ---

export function renderSky(ctx, waterY, simTime, env) {
  const tod = env ? env.timeOfDay : 0.5;

  // Sky colors shift with time of day
  let skyTop, skyMid, skyBottom;

  if (tod < 0.15 || tod > 0.85) {
    // Deep night — dark blue/black
    skyTop = '#0a0a1a';
    skyMid = '#0e1020';
    skyBottom = '#121828';
  } else if (tod < 0.25) {
    // Dawn transition
    const t = (tod - 0.15) / 0.1;
    skyTop = lerpColor('#0a0a1a', COLORS.skyTop, t);
    skyMid = lerpColor('#0e1020', COLORS.skyMid, t);
    skyBottom = lerpColor('#121828', COLORS.skyBottom, t);
  } else if (tod > 0.75) {
    // Dusk transition
    const t = (tod - 0.75) / 0.1;
    skyTop = lerpColor(COLORS.skyTop, '#0a0a1a', t);
    skyMid = lerpColor(COLORS.skyMid, '#0e1020', t);
    skyBottom = lerpColor(COLORS.skyBottom, '#121828', t);
  } else {
    // Daytime
    skyTop = COLORS.skyTop;
    skyMid = COLORS.skyMid;
    skyBottom = COLORS.skyBottom;
  }

  const bands = [
    { color: skyTop, y: 0, h: Math.floor(waterY * 0.4) },
    { color: skyMid, y: Math.floor(waterY * 0.4), h: Math.floor(waterY * 0.35) },
    { color: skyBottom, y: Math.floor(waterY * 0.75), h: waterY - Math.floor(waterY * 0.75) },
  ];
  for (const band of bands) {
    ctx.fillStyle = band.color;
    ctx.fillRect(0, band.y, CANVAS_W, band.h);
  }
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return '#' + [r, g, bl].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

export function renderTerrain(ctx, terrain, waterY) {
  for (let x = 0; x < CANVAS_W; x++) {
    const groundY = terrain[x];
    if (groundY < waterY) {
      ctx.fillStyle = COLORS.land;
      ctx.fillRect(x, groundY, 1, waterY - groundY);
      ctx.fillStyle = COLORS.landDark;
      ctx.fillRect(x, groundY, 1, 1);
    }
  }
  for (let x = 0; x < CANVAS_W; x++) {
    if (terrain[x] <= waterY + 2 && terrain[x] >= waterY - 2) {
      ctx.fillStyle = COLORS.mud;
      ctx.fillRect(x, waterY, 1, 2);
    }
  }
}

export function renderWater(ctx, waterY, simTime) {
  for (let y = waterY; y < CANVAS_H; y++) {
    const depth = (y - waterY) / (CANVAS_H - waterY);
    if (depth < 0.15) ctx.fillStyle = COLORS.waterSurface;
    else if (depth < 0.5) ctx.fillStyle = COLORS.waterMid;
    else ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(0, y, CANVAS_W, 1);
  }

  // Animated surface
  ctx.fillStyle = COLORS.waterLine;
  for (let x = 0; x < CANVAS_W; x++) {
    const wave = Math.sin(x * 0.15 + simTime * 2) * 0.8;
    ctx.fillRect(x, waterY + Math.floor(wave), 1, 1);
  }

  // Depth lines
  ctx.fillStyle = COLORS.waterSurface;
  for (let y = waterY + 8; y < CANVAS_H; y += 12) {
    for (let x = 0; x < CANVAS_W; x++) {
      if (Math.sin(x * 0.1 + simTime * 0.5 + y * 0.3) > 0.6) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

export function renderVegetation(ctx, terrain, waterY, vegRng, simTime, vegState, env) {
  // vegState controls density — vegetation grows and shrinks over time
  const vg = vegState || { growth: 1, treeGrowth: 1, flowerBloom: 1, undergrowth: 1 };
  // Wind strength from weather — affects all sway
  const isStorm = env && (env.weather === 'storm');
  const isRain = env && (env.weather === 'rain');
  const hurricaneWind = env && env._hurricaneWind || 0;
  const windMult = hurricaneWind ? 4 + Math.abs(hurricaneWind) * 0.1 : isStorm ? 3 : isRain ? 1.8 : 1;
  const windDir = hurricaneWind ? Math.sign(hurricaneWind) : Math.sin(simTime * 0.3); // unified wind direction
  // --- TALL CYPRESS / SWAMP TREES ---
  const treeZones = []; // track canopy positions for orchid anchoring
  const destroyed = (vg.destroyedTrees || []);
  const numTrees = Math.floor(vegRng.range(5, 9) * vg.treeGrowth);
  for (let i = 0; i < numTrees; i++) {
    const x = vegRng.range(8, CANVAS_W - 8);
    const groundY = terrain[x];
    const isDestroyed = destroyed.includes(x);
    if (groundY < waterY + 8) {
      const trunkH = vegRng.range(30, 55);
      const trunkW = vegRng.range(2, 5);

      // Destroyed tree — draw stump instead, but RNG continues so other trees stay stable
      if (isDestroyed) {
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(x - 1, groundY - 3, 3, 3);
        ctx.fillStyle = '#5a4a2a';
        ctx.fillRect(x - 2, groundY, 5, 2);
        // Consume the remaining RNG this tree would use (approximate)
        for (let _r = 0; _r < 20; _r++) vegRng.random();
        treeZones.push({ x, canopyY: groundY - trunkH, canopyW: 0, canopyH: 0 });
        continue;
      }
      const sway = (Math.sin(simTime * 0.2 + x * 0.15) * 0.4 + windDir * 0.3) * windMult;
      const treeType = vegRng.range(0, 2); // variety

      // Massive buttressed roots
      ctx.fillStyle = '#3a2a18';
      const baseW = trunkW + vegRng.range(3, 6);
      for (let dy = 0; dy < 8; dy++) {
        const w = Math.max(trunkW, baseW - Math.floor(dy * 0.7));
        ctx.fillRect(x - Math.floor(w / 2), groundY - dy, w, 1);
      }

      // Main trunk
      ctx.fillStyle = '#4a3a22';
      for (let dy = 8; dy < trunkH; dy++) {
        const swayOff = Math.round(sway * (dy / trunkH));
        ctx.fillRect(x - Math.floor(trunkW / 2) + swayOff, groundY - dy, trunkW, 1);
      }
      // Bark texture
      ctx.fillStyle = '#2e1e0e';
      for (let dy = 8; dy < trunkH; dy += vegRng.range(2, 5)) {
        const swayOff = Math.round(sway * (dy / trunkH));
        ctx.fillRect(x - Math.floor(trunkW / 2) + swayOff, groundY - dy, 1, vegRng.range(1, 3));
      }

      // Branches reaching out
      const numBranches = vegRng.range(2, 5);
      for (let b = 0; b < numBranches; b++) {
        const branchY = groundY - trunkH + vegRng.range(0, trunkH * 0.4);
        const branchDir = vegRng.chance(0.5) ? 1 : -1;
        const branchLen = vegRng.range(5, 15);
        ctx.fillStyle = '#3a2a18';
        for (let bx = 0; bx < branchLen; bx++) {
          const by = Math.floor(bx * 0.3 * (vegRng.chance(0.3) ? -1 : 1));
          ctx.fillRect(x + bx * branchDir + Math.round(sway), branchY + by, 1, 1);
        }
      }

      // Canopy — big, irregular, layered
      const canopyY = groundY - trunkH;
      const canopyW = Math.floor(vegRng.range(12, 22) * vg.treeGrowth);
      const canopyH = vegRng.range(6, 12);
      treeZones.push({ x, canopyY, canopyW, canopyH });

      // Dark canopy base
      ctx.fillStyle = '#1a3a14';
      for (let cy = 0; cy < canopyH; cy++) {
        const rowW = canopyW - Math.abs(cy - canopyH / 2) * 2.5 + vegRng.range(-3, 3);
        if (rowW > 0) {
          const swayOff = Math.round(sway * 1.8);
          ctx.fillRect(x - Math.floor(rowW / 2) + swayOff, canopyY + cy - 3, Math.floor(rowW), 1);
        }
      }
      // Mid canopy
      ctx.fillStyle = '#2a5a1e';
      for (let cy = 1; cy < canopyH - 1; cy++) {
        const rowW = (canopyW - 4) - Math.abs(cy - canopyH / 2) * 2 + vegRng.range(-2, 2);
        if (rowW > 0) {
          const swayOff = Math.round(sway * 1.5);
          ctx.fillRect(x - Math.floor(rowW / 2) + swayOff + 1, canopyY + cy - 2, Math.floor(rowW), 1);
        }
      }
      // Light leaf highlights
      ctx.fillStyle = '#3a7a28';
      for (let j = 0; j < 8; j++) {
        const lx = x + vegRng.range(-canopyW / 2 + 2, canopyW / 2 - 2);
        const ly = canopyY + vegRng.range(-2, canopyH - 3);
        ctx.fillRect(Math.floor(lx + sway * 1.5), ly, vegRng.range(1, 4), 1);
      }

      // Spanish moss / hanging vines — lots of it
      const numHangs = vegRng.range(4, 10);
      for (let m = 0; m < numHangs; m++) {
        const mx = x + vegRng.range(-canopyW / 2 + 1, canopyW / 2 - 1);
        const mLen = vegRng.range(5, 18); // LONG hanging moss
        const mSway = Math.sin(simTime * 0.4 + mx * 0.3 + m) * 0.8;
        const isVine = vegRng.chance(0.3);

        ctx.fillStyle = isVine ? '#3a5a2a' : '#5a7a5a';
        for (let my = 0; my < mLen; my++) {
          const mSwayOff = Math.round(mSway * (my / mLen));
          ctx.fillRect(Math.floor(mx + mSwayOff), canopyY + canopyH - 3 + my, 1, 1);
        }
        // Vine leaves
        if (isVine && mLen > 8) {
          ctx.fillStyle = '#4a8a3a';
          for (let vl = 0; vl < 3; vl++) {
            const vlY = canopyY + canopyH - 3 + vegRng.range(3, mLen - 2);
            const vlSway = Math.round(mSway * (vlY / mLen));
            ctx.fillRect(Math.floor(mx + vlSway) - 1, vlY, 1, 1);
            ctx.fillRect(Math.floor(mx + vlSway) + 1, vlY, 1, 1);
          }
        }
      }

      // Exposed roots reaching into water
      if (groundY >= waterY - 4) {
        ctx.fillStyle = '#3a2a18';
        const numRoots = vegRng.range(3, 6);
        for (let r = 0; r < numRoots; r++) {
          const rx = vegRng.range(-6, 6);
          const rDir = rx > 0 ? 1 : -1;
          const rLen = vegRng.range(3, 8);
          for (let ry = 0; ry < rLen; ry++) {
            ctx.fillRect(x + rx + Math.floor(ry * 0.6 * rDir), groundY + ry, 1, 1);
          }
        }
        // Knees (cypress knees poking out of water)
        for (let k = 0; k < vegRng.range(1, 3); k++) {
          const kx = x + vegRng.range(-8, 8);
          ctx.fillStyle = '#4a3a22';
          ctx.fillRect(kx, waterY - 3, 1, 3);
          ctx.fillRect(kx + 1, waterY - 2, 1, 2);
        }
      }
    }
  }

  // --- FALLEN LOGS ---
  for (let i = 0; i < 3; i++) {
    const x = vegRng.range(15, CANVAS_W - 30);
    const groundY = terrain[x];
    if (Math.abs(groundY - waterY) < 6) {
      const logLen = vegRng.range(8, 18);
      ctx.fillStyle = '#5a4a30';
      ctx.fillRect(x, groundY - 1, logLen, 2);
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(x, groundY - 1, logLen, 1);
      // Broken end
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(x + logLen, groundY - 2, 1, 3);
      // Moss on log
      if (vegRng.chance(0.6)) {
        ctx.fillStyle = '#4a7a3a';
        for (let m = 0; m < logLen; m += vegRng.range(2, 4)) {
          ctx.fillRect(x + m, groundY - 2, vegRng.range(1, 3), 1);
        }
      }
    }
  }

  // --- DENSE GRASS & REEDS ---
  for (let i = 0; i < Math.floor(25 * vg.undergrowth); i++) {
    const x = vegRng.range(0, CANVAS_W - 1);
    const groundY = terrain[x];
    if (groundY < waterY + 2) {
      const sway = (Math.sin(simTime * 1.5 + x * 0.5) * 0.5 + windDir * 0.2) * windMult;
      const h = vegRng.range(2, 5);
      ctx.fillStyle = vegRng.chance(0.5) ? '#4a7a2e' : '#3a6a22';
      for (let dy = 0; dy < h; dy++) {
        const s = Math.round(sway * (dy / h));
        ctx.fillRect(x + s, groundY - dy - 1, 1, 1);
      }
    }
  }

  // --- CATTAILS (thicker) ---
  for (let i = 0; i < Math.floor(12 * vg.growth); i++) {
    const x = vegRng.range(0, CANVAS_W - 1);
    const groundY = terrain[x];
    if (Math.abs(groundY - waterY) < 10) {
      const height = vegRng.range(8, 15);
      const sway = (Math.sin(simTime * 0.8 + x * 0.3) * 0.7 + windDir * 0.4) * windMult;
      ctx.fillStyle = '#5a4a2a';
      for (let dy = 0; dy < height; dy++) {
        const swayOffset = Math.round(sway * (dy / height));
        ctx.fillRect(x + swayOffset, groundY - dy, 1, 1);
      }
      ctx.fillStyle = '#3a2a14';
      const topSway = Math.round(sway);
      ctx.fillRect(x + topSway, groundY - height, 1, 4);
      ctx.fillRect(x + topSway - 1, groundY - height + 1, 1, 2);
    }
  }

  // --- LILY PADS ---
  for (let i = 0; i < 8; i++) {
    const x = vegRng.range(20, CANVAS_W - 20);
    if (terrain[x] > waterY) {
      ctx.fillStyle = '#3a7a3a';
      const wave = Math.sin(x * 0.15 + simTime * 2) * 0.5;
      const ly = waterY + Math.floor(wave);
      ctx.fillRect(x - 1, ly, 4, 1);
      ctx.fillRect(x, ly - 1, 2, 1);
      ctx.fillRect(x - 1, ly + 1, 3, 1);
      ctx.fillStyle = '#2a6a2a';
      ctx.fillRect(x, ly, 1, 1);
      if (vegRng.chance(0.3)) {
        ctx.fillStyle = '#ffaacc';
        ctx.fillRect(x + 2, ly - 1, 1, 1);
      }
    }
  }

  // --- MUD PATCHES ---
  for (let i = 0; i < 8; i++) {
    const x = vegRng.range(5, CANVAS_W - 5);
    const groundY = terrain[x];
    if (Math.abs(groundY - waterY) < 3) {
      ctx.fillStyle = '#5a4a2a';
      ctx.fillRect(x, groundY, vegRng.range(3, 8), 1);
      ctx.fillStyle = '#4a3a1e';
      ctx.fillRect(x + 1, groundY + 1, vegRng.range(2, 5), 1);
    }
  }

  // --- UNDERWATER PLANTS ---
  for (let i = 0; i < 8; i++) {
    const x = vegRng.range(15, CANVAS_W - 15);
    if (terrain[x] > waterY) {
      const height = vegRng.range(4, 12);
      const baseY = CANVAS_H - vegRng.range(2, 10);
      const sway = Math.sin(simTime * 1.2 + x * 0.4);
      ctx.fillStyle = '#1a4a22';
      for (let dy = 0; dy < height; dy++) {
        const swayOffset = Math.round(sway * (dy / height) * 2);
        ctx.fillRect(x + swayOffset, baseY - dy, 1, 1);
      }
      ctx.fillStyle = '#2a5a2a';
      ctx.fillRect(x + Math.round(sway * 2), baseY - height, 1, 1);
    }
  }

  // --- SMALL ROCKS ---
  for (let i = 0; i < 6; i++) {
    const x = vegRng.range(10, CANVAS_W - 10);
    const groundY = terrain[x];
    if (Math.abs(groundY - waterY) < 5) {
      ctx.fillStyle = '#777766';
      ctx.fillRect(x, groundY, 2, 1);
      ctx.fillStyle = '#666655';
      ctx.fillRect(x, groundY + 1, 3, 1);
    }
  }

  // --- ORCHIDS — only bloom in mature swamps, hang from trees ---
  if (vg.orchidChance > 0) {
    const numOrchids = Math.floor(vegRng.range(3, 8) * vg.orchidChance);
    for (let i = 0; i < numOrchids; i++) {
      const x = vegRng.range(15, CANVAS_W - 15);
      // Find nearest tree canopy to anchor orchid
      let nearestTree = null;
      for (const tz of treeZones) {
        if (Math.abs(x - tz.x) < tz.canopyW / 2) {
          nearestTree = tz;
          break;
        }
      }
      if (!nearestTree) { vegRng.random(); vegRng.random(); continue; } // consume RNG to stay deterministic
      {
        const oy = nearestTree.canopyY + nearestTree.canopyH + vegRng.range(2, 10);
        if (oy < 5) continue;
        const orchidColor = vegRng.pick(['#dd55cc', '#cc33aa', '#ee88dd', '#ff66ee', '#aa22cc', '#ffffff']);
        // Stem
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(x, oy, 1, 3);
        // Flower — 3x3 with center
        ctx.fillStyle = orchidColor;
        ctx.fillRect(x - 1, oy - 1, 3, 1);
        ctx.fillRect(x, oy - 2, 1, 1);
        ctx.fillRect(x - 1, oy, 1, 1);
        ctx.fillRect(x + 1, oy, 1, 1);
        // Center
        ctx.fillStyle = '#ffee44';
        ctx.fillRect(x, oy - 1, 1, 1);
        // Second petal layer for bigger orchids
        if (vegRng.chance(0.4)) {
          ctx.fillStyle = orchidColor;
          ctx.fillRect(x - 2, oy - 1, 1, 1);
          ctx.fillRect(x + 2, oy - 1, 1, 1);
          ctx.fillRect(x, oy - 3, 1, 1);
        }
      }
    }
  }

  // --- EPOCH GLOW — ancient swamps have a subtle mystical quality ---
  if (vg.growth > 2.0) {
    // Faint golden motes drifting through air
    for (let i = 0; i < Math.floor((vg.growth - 2) * 8); i++) {
      const mx = (simTime * 3 + i * 47) % CANVAS_W;
      const my = waterY - 10 + Math.sin(simTime * 0.8 + i * 1.7) * 15;
      if (my > 5 && my < waterY - 2) {
        const pulse = Math.sin(simTime * 2 + i * 2.3) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 230, 100, ${pulse * 0.15})`;
        ctx.fillRect(Math.floor(mx), Math.floor(my), 1, 1);
      }
    }
  }

  // --- BIOLUMINESCENCE — water glows at night in mature swamps ---
  if (vg.biolum && vg.biolum.timer > 0) {
    vg.biolum.timer -= 0.016;
    vg.biolum.intensity = Math.min(0.12, vg.biolum.intensity + 0.016 * 0.01);
    if (vg.biolum.timer < 5) vg.biolum.intensity *= 0.98;
    if (vg.biolum.timer <= 0) vg.biolum = null;
    else {
      for (let x = 0; x < CANVAS_W; x += 2) {
        const pulse = Math.sin(simTime * 1.5 + x * 0.2) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(50, 200, 180, ${vg.biolum.intensity * pulse})`;
        ctx.fillRect(x, waterY + 1, 2, 1);
        ctx.fillRect(x + 1, waterY + 2, 1, 1);
      }
    }
  }

  // --- RAINBOW — arcs across the sky after surprise ---
  if (vg.rainbow && vg.rainbow.timer > 0) {
    vg.rainbow.timer -= 0.016;
    vg.rainbow.opacity = Math.min(0.12, vg.rainbow.opacity + 0.016 * 0.02);
    if (vg.rainbow.timer < 3) vg.rainbow.opacity *= 0.97;
    if (vg.rainbow.timer <= 0) vg.rainbow = null;
    else {
      const colors = ['#ff000030', '#ff880030', '#ffff0030', '#00ff0030', '#0088ff30', '#4400ff30', '#8800ff30'];
      const cx = CANVAS_W * 0.5;
      const cy = waterY * 0.8;
      const baseR = 50;
      for (let ci = 0; ci < colors.length; ci++) {
        ctx.fillStyle = colors[ci];
        const r = baseR + ci * 2;
        for (let a = 0; a < Math.PI; a += 0.03) {
          const rx = cx + Math.cos(a) * r;
          const ry = cy - Math.sin(a) * r * 0.5;
          if (ry > 2 && ry < waterY) {
            ctx.fillRect(Math.floor(rx), Math.floor(ry), 1, 1);
          }
        }
      }
    }
  }

  // --- FLOATING LOGS / DEBRIS ---
  for (let i = 0; i < 4; i++) {
    const baseX = vegRng.range(0, CANVAS_W);
    const speed = vegRng.float(0.3, 1.2);
    const logLen = vegRng.range(5, 12);
    const driftX = ((baseX + simTime * speed * 8) % (CANVAS_W + logLen)) - logLen;
    const wave = Math.sin(driftX * 0.12 + simTime * 2) * 0.6;
    const ly = waterY + Math.floor(wave) + vegRng.range(1, 4);
    // Log body
    ctx.fillStyle = '#5a4a30';
    ctx.fillRect(Math.floor(driftX), ly, logLen, 1);
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(Math.floor(driftX), ly + 1, logLen, 1);
    // Broken stub at end
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(Math.floor(driftX) + logLen, ly - 1, 1, 2);
    // Tiny moss/algae on floating log
    if (vegRng.chance(0.5)) {
      ctx.fillStyle = '#4a7a3a';
      ctx.fillRect(Math.floor(driftX) + vegRng.range(1, logLen - 2), ly - 1, 2, 1);
    }
  }
  // Small debris bits
  for (let i = 0; i < 6; i++) {
    const baseX = vegRng.range(0, CANVAS_W);
    const speed = vegRng.float(0.5, 1.8);
    const dx = ((baseX + simTime * speed * 6) % CANVAS_W);
    const wave = Math.sin(dx * 0.15 + simTime * 2) * 0.5;
    const dy = waterY + Math.floor(wave) + vegRng.range(0, 3);
    ctx.fillStyle = vegRng.chance(0.5) ? '#5a4a2a' : '#3a5a2a';
    ctx.fillRect(Math.floor(dx), dy, vegRng.range(1, 3), 1);
  }

  // --- AQUATIC FLOWERS: WATER LILIES (larger) ---
  for (let i = 0; i < 6; i++) {
    const x = vegRng.range(15, CANVAS_W - 15);
    if (terrain[x] > waterY) {
      const wave = Math.sin(x * 0.15 + simTime * 2) * 0.5;
      const ly = waterY + Math.floor(wave);
      // Large lily pad (bigger than existing ones)
      ctx.fillStyle = '#2a6a2a';
      ctx.fillRect(x - 2, ly, 6, 1);
      ctx.fillRect(x - 1, ly - 1, 4, 1);
      ctx.fillRect(x - 2, ly + 1, 5, 1);
      // Pad vein
      ctx.fillStyle = '#1a5a1a';
      ctx.fillRect(x + 1, ly, 1, 1);
      // Flower petals (pink/white)
      const petalColor = vegRng.chance(0.5) ? '#ffbbdd' : '#ffe0ee';
      const petalColor2 = vegRng.chance(0.5) ? '#ff99cc' : '#ffffff';
      ctx.fillStyle = petalColor;
      ctx.fillRect(x, ly - 2, 2, 1);
      ctx.fillRect(x - 1, ly - 1, 1, 1);
      ctx.fillRect(x + 2, ly - 1, 1, 1);
      ctx.fillStyle = petalColor2;
      ctx.fillRect(x + 1, ly - 2, 1, 1);
      // Yellow center
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(x, ly - 1, 1, 1);
      ctx.fillRect(x + 1, ly - 1, 1, 1);
    }
  }

  // --- AQUATIC FLOWERS: LOTUS ---
  for (let i = 0; i < 4; i++) {
    const x = vegRng.range(25, CANVAS_W - 25);
    if (terrain[x] > waterY) {
      const wave = Math.sin(x * 0.13 + simTime * 1.8) * 0.4;
      const ly = waterY + Math.floor(wave);
      const sway = Math.sin(simTime * 0.6 + x * 0.2) * 0.3;
      const sx = Math.round(sway);
      // Stem rising from water
      ctx.fillStyle = '#3a6a2a';
      ctx.fillRect(x + sx, ly, 1, 1);
      ctx.fillRect(x + sx, ly - 1, 1, 1);
      // Lotus bloom (3-4px, pink/red)
      const lotusColor = vegRng.chance(0.5) ? '#ee5577' : '#ff7799';
      ctx.fillStyle = lotusColor;
      ctx.fillRect(x - 1 + sx, ly - 2, 3, 1);
      ctx.fillRect(x + sx, ly - 3, 2, 1);
      // Lighter tip
      ctx.fillStyle = '#ffaacc';
      ctx.fillRect(x + sx, ly - 3, 1, 1);
    }
  }

  // --- DUCKWEED PATCHES ---
  for (let i = 0; i < 12; i++) {
    const cx = vegRng.range(5, CANVAS_W - 5);
    if (terrain[cx] > waterY) {
      const clusterSize = vegRng.range(3, 8);
      for (let j = 0; j < clusterSize; j++) {
        const dx = cx + vegRng.range(-4, 4);
        const wave = Math.sin(dx * 0.15 + simTime * 2) * 0.4;
        const dy = waterY + Math.floor(wave) + vegRng.range(-1, 1);
        ctx.fillStyle = vegRng.chance(0.6) ? '#4a8a3a' : '#3a7a2a';
        ctx.fillRect(dx, dy, 1, 1);
      }
    }
  }

  // --- LAND FLOWERS (wildflowers) ---
  const flowerColors = ['#aa44cc', '#cc44aa', '#ffdd44', '#ff4444', '#ff6644', '#ffffff', '#eeddff', '#ffaaaa'];
  for (let i = 0; i < Math.floor(20 * vg.flowerBloom); i++) {
    const x = vegRng.range(5, CANVAS_W - 5);
    const groundY = terrain[x];
    if (groundY < waterY) {
      const colorIdx = vegRng.range(0, flowerColors.length - 1);
      const sway = Math.sin(simTime * 1.2 + x * 0.7 + i) * 0.3;
      const sx = Math.round(sway);
      // Stem
      ctx.fillStyle = '#3a6a22';
      ctx.fillRect(x, groundY - 1, 1, 1);
      ctx.fillRect(x + sx, groundY - 2, 1, 1);
      // Flower head
      ctx.fillStyle = flowerColors[colorIdx];
      ctx.fillRect(x + sx, groundY - 3, 1, 1);
      // Some flowers get an extra petal pixel
      if (vegRng.chance(0.4)) {
        ctx.fillRect(x + sx - 1, groundY - 3, 1, 1);
        ctx.fillRect(x + sx + 1, groundY - 3, 1, 1);
      }
      // Occasional center dot
      if (vegRng.chance(0.3)) {
        ctx.fillStyle = '#ffee44';
        ctx.fillRect(x + sx, groundY - 3, 1, 1);
      }
    }
  }

  // --- MUSHROOMS ---
  for (let i = 0; i < 8; i++) {
    const x = vegRng.range(8, CANVAS_W - 8);
    const groundY = terrain[x];
    if (groundY < waterY && groundY < waterY - 2) {
      // Brown stem
      ctx.fillStyle = '#8a7a5a';
      ctx.fillRect(x, groundY - 1, 1, 1);
      ctx.fillRect(x, groundY, 1, 1);
      // Red cap
      ctx.fillStyle = '#cc3322';
      ctx.fillRect(x - 1, groundY - 2, 3, 1);
      ctx.fillRect(x, groundY - 3, 1, 1);
      // White spots on cap
      if (vegRng.chance(0.7)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 1, groundY - 2, 1, 1);
      }
      if (vegRng.chance(0.5)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, groundY - 2, 1, 1);
      }
    }
  }

  // --- FERNS ---
  for (let i = 0; i < Math.floor(14 * vg.undergrowth); i++) {
    const x = vegRng.range(5, CANVAS_W - 5);
    const groundY = terrain[x];
    if (groundY < waterY) {
      const sway = Math.sin(simTime * 0.8 + x * 0.4 + i * 1.3) * 0.4;
      const sx = Math.round(sway);
      const fernColor = vegRng.chance(0.5) ? '#2a6a22' : '#3a7a2a';
      ctx.fillStyle = fernColor;
      // Triangular fern shape, 3-4px tall
      const h = vegRng.range(3, 4);
      for (let dy = 0; dy < h; dy++) {
        const width = h - dy; // wider at bottom, narrow at top
        const fy = groundY - dy - 1;
        const fx = x - Math.floor(width / 2) + sx;
        ctx.fillRect(fx, fy, width, 1);
      }
      // Darker center stem
      ctx.fillStyle = '#1a5a18';
      ctx.fillRect(x + sx, groundY - 1, 1, 1);
      ctx.fillRect(x + sx, groundY - 2, 1, 1);
    }
  }

  // --- GROUND TEXTURE ---
  // Dark mud spots near water line
  for (let i = 0; i < 15; i++) {
    const x = vegRng.range(2, CANVAS_W - 2);
    const groundY = terrain[x];
    if (groundY < waterY && groundY > waterY - 6) {
      const patchW = vegRng.range(2, 5);
      ctx.fillStyle = vegRng.chance(0.5) ? '#3a3018' : '#44381e';
      ctx.fillRect(x, groundY + 1, patchW, 1);
      if (vegRng.chance(0.4)) {
        ctx.fillRect(x + 1, groundY + 2, patchW - 1, 1);
      }
    }
  }
  // Lighter sandy spots on higher ground
  for (let i = 0; i < 10; i++) {
    const x = vegRng.range(2, CANVAS_W - 2);
    const groundY = terrain[x];
    if (groundY < waterY - 6) {
      const patchW = vegRng.range(1, 4);
      ctx.fillStyle = vegRng.chance(0.5) ? '#8a7a5a' : '#7a6a4a';
      ctx.fillRect(x, groundY + 1, patchW, 1);
    }
  }
  // Extra grass tufts on land
  for (let i = 0; i < 18; i++) {
    const x = vegRng.range(0, CANVAS_W - 1);
    const groundY = terrain[x];
    if (groundY < waterY) {
      ctx.fillStyle = vegRng.chance(0.5) ? '#4a8a2e' : '#3a6a1e';
      ctx.fillRect(x, groundY - 1, 1, 1);
      if (vegRng.chance(0.5)) {
        ctx.fillRect(x + 1, groundY - 1, 1, 1);
      }
      if (vegRng.chance(0.3)) {
        ctx.fillRect(x, groundY - 2, 1, 1);
      }
    }
  }
}

// --- Entity Rendering ---

export function renderGators(ctx, world, simTime) {
  for (const [id, tr, gator] of world.query('transform', 'gator')) {
    const stageData = GATOR_STAGES[gator.stage];
    if (!stageData) continue;

    const frameName = gator.frame || 'idle';
    const sprite = stageData[frameName] || stageData.idle;
    if (!sprite) continue;

    const tints = gator.traits ? {
      body: gator.traits.bodyColor || TINT_COLORS.body,
      belly: gator.traits.bellyColor || TINT_COLORS.belly,
      dark: gator.traits.darkColor || TINT_COLORS.dark,
      scute: gator.traits.scuteColor || TINT_COLORS.scute,
    } : null;

    // Scale factor based on meals eaten — gators can get MASSIVE
    const scale = gator.sizeScale || 1;
    const drawX = Math.floor(tr.x);
    const drawY = Math.floor(tr.y + (gator.breatheOffset || 0)) + (gator.slipping ? 1 : 0);

    if (scale > 1.05) {
      drawScaledSprite(ctx, sprite, drawX, drawY, tr.direction === -1, tints, scale);
    } else {
      drawSprite(ctx, sprite, drawX, drawY, tr.direction === -1, tints);
    }

    // Green glow for gators that ate aliens — conforms to sprite silhouette
    if (gator.glowing && gator.glowTimer > 0) {
      gator.glowTimer -= 0.016;
      const glowPulse = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
      const glowScale = scale > 1.05 ? scale : 1;
      const flipX = tr.direction === -1;
      // Outer glow pass — 1px border around each non-transparent pixel
      ctx.fillStyle = `rgba(0, 200, 30, ${glowPulse * 0.5})`;
      for (let py = 0; py < sprite.length; py++) {
        const row = sprite[py];
        for (let px = 0; px < row.length; px++) {
          if (!row[px]) continue;
          const dx = flipX ? (row.length - 1 - px) : px;
          const sx = Math.floor(drawX + dx * glowScale);
          const sy = Math.floor(drawY + py * glowScale);
          const sz = Math.max(1, Math.ceil(glowScale));
          ctx.fillRect(sx - 1, sy - 1, sz + 2, sz + 2);
        }
      }
      // Inner glow pass — on top of each pixel
      ctx.fillStyle = `rgba(0, 255, 50, ${glowPulse})`;
      for (let py = 0; py < sprite.length; py++) {
        const row = sprite[py];
        for (let px = 0; px < row.length; px++) {
          if (!row[px]) continue;
          const dx = flipX ? (row.length - 1 - px) : px;
          const sx = Math.floor(drawX + dx * glowScale);
          const sy = Math.floor(drawY + py * glowScale);
          const sz = Math.max(1, Math.ceil(glowScale));
          ctx.fillRect(sx, sy, sz, sz);
        }
      }
      if (gator.glowTimer <= 0) gator.glowing = false;
    }

    // Golden gator shimmer overlay
    if (gator.golden) {
      const glowScale = scale > 1.05 ? scale : 1;
      const flipX = tr.direction === -1;
      for (let py = 0; py < sprite.length; py++) {
        const row = sprite[py];
        for (let px = 0; px < row.length; px++) {
          if (!row[px]) continue;
          const dx = flipX ? (row.length - 1 - px) : px;
          const sx = Math.floor(drawX + dx * glowScale);
          const sy = Math.floor(drawY + py * glowScale);
          const sz = Math.max(1, Math.ceil(glowScale));
          const alpha = 0.15 + Math.sin(Date.now() * 0.004 + px) * 0.1;
          ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
          ctx.fillRect(sx, sy, sz, sz);
        }
      }
    }

    // Baby gators ride on mother's back
    if (gator.sex === 'female' && gator.stage === 'adult' && simTime !== undefined) {
      for (const [hid, htr, hgator] of world.query('transform', 'gator')) {
        if (hid === id) continue;
        if (hgator.stage !== 'hatchling') continue;
        const dist = Math.sqrt((htr.x - tr.x) ** 2 + (htr.y - tr.y) ** 2);
        if (dist < 10) {
          // Draw hatchling on mother's back
          const hStageData = GATOR_STAGES['hatchling'];
          if (!hStageData) continue;
          const hSprite = hStageData[hgator.frame || 'idle'] || hStageData.idle;
          if (!hSprite) continue;
          const hTints = hgator.traits ? {
            body: hgator.traits.bodyColor || TINT_COLORS.body,
            belly: hgator.traits.bellyColor || TINT_COLORS.belly,
            dark: hgator.traits.darkColor || TINT_COLORS.dark,
            scute: hgator.traits.scuteColor || TINT_COLORS.scute,
          } : null;
          const bobY = Math.sin(simTime * 3 + hid) * 0.8;
          const rideX = drawX + Math.floor((gator.spriteW || 20) * scale * 0.3);
          const rideY = drawY - 3 + Math.floor(bobY);
          drawSprite(ctx, hSprite, rideX, rideY, tr.direction === -1, hTints);
        }
      }
    }
  }
}

function drawScaledSprite(ctx, sprite, x, y, flipX, tints, scale) {
  for (let py = 0; py < sprite.length; py++) {
    const row = sprite[py];
    for (let px = 0; px < row.length; px++) {
      let color = row[px];
      if (!color) continue;
      if (tints) {
        if (color === TINT_COLORS.body) color = tints.body;
        else if (color === TINT_COLORS.belly) color = tints.belly;
        else if (color === TINT_COLORS.dark) color = tints.dark;
        else if (color === TINT_COLORS.scute) color = tints.scute;
      }
      const dx = flipX ? (row.length - 1 - px) : px;
      ctx.fillStyle = color;
      const sx = Math.floor(x + dx * scale);
      const sy = Math.floor(y + py * scale);
      const sw = Math.max(1, Math.ceil(scale));
      const sh = Math.max(1, Math.ceil(scale));
      ctx.fillRect(sx, sy, sw, sh);
    }
  }
}

export function renderPrey(ctx, world, simTime, dt) {
  for (const [id, tr, prey] of world.query('transform', 'prey')) {
    if (!prey.alive) continue;
    const sprite = prey.sprite;
    if (sprite) {
      drawSprite(ctx, sprite, Math.floor(tr.x), Math.floor(tr.y), tr.vx < 0);
    }
    // Frog tongue flick — pink line from frog mouth toward target
    if (prey.type === 'frog' && prey.tongueFlick > 0) {
      prey.tongueFlick -= dt || 0.016;
      const tx = prey.tongueTarget?.x || tr.x;
      const ty = prey.tongueTarget?.y || tr.y;
      const fx = Math.floor(tr.x + 2);
      const fy = Math.floor(tr.y + 1);
      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const tongueLen = Math.min(dist, 12);
      const steps = Math.floor(tongueLen);
      ctx.fillStyle = '#dd4466';
      for (let s = 0; s < steps; s++) {
        ctx.fillRect(Math.floor(fx + (dx / dist) * s), Math.floor(fy + (dy / dist) * s), 1, 1);
      }
      // Fly stuck on tongue tip when catching
      if (prey.tongueFlick > 0.15) {
        ctx.fillStyle = '#333333';
        ctx.fillRect(Math.floor(fx + (dx / dist) * tongueLen), Math.floor(fy + (dy / dist) * tongueLen), 1, 1);
      }
    }
  }
}

export function renderUnderwaterLife(ctx, waterY, simTime, vegRng) {
  const bottomY = CANVAS_H - 1;
  const waterDepth = CANVAS_H - waterY;

  // --- Sunken logs/debris on the bottom (static, deterministic) ---
  for (let i = 0; i < 4; i++) {
    const lx = Math.floor(vegRng.random() * (CANVAS_W - 20));
    const lw = 6 + Math.floor(vegRng.random() * 10);
    const lh = 2 + Math.floor(vegRng.random() * 2);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(lx, bottomY - lh, lw, lh);
    ctx.fillStyle = '#2e1f0f';
    ctx.fillRect(lx + 1, bottomY - lh, lw - 2, 1);
  }

  // --- Extra water weeds with variety (deterministic placement, animated sway) ---
  for (let i = 0; i < 12; i++) {
    const wx = Math.floor(vegRng.random() * CANVAS_W);
    const wh = 6 + Math.floor(vegRng.random() * 14);
    const hasFlower = vegRng.random() > 0.7;
    const colorIdx = Math.floor(vegRng.random() * 3);
    const colors = ['#2d5a1e', '#1a4a2e', '#3a6b2a'];
    const sway = Math.sin(simTime * 0.4 + i * 1.7) * 2;
    for (let j = 0; j < wh; j++) {
      const t = j / wh;
      const dx = Math.floor(sway * t);
      ctx.fillStyle = colors[colorIdx];
      ctx.fillRect(wx + dx, bottomY - j, 1, 1);
    }
    if (hasFlower) {
      const flowerColors = ['#ff6699', '#ffcc44', '#ff9944'];
      ctx.fillStyle = flowerColors[colorIdx];
      const dx = Math.floor(sway);
      ctx.fillRect(wx + dx, bottomY - wh, 2, 1);
      ctx.fillRect(wx + dx, bottomY - wh - 1, 1, 1);
    }
  }

  // --- Murky particles (slow drifting pixels) ---
  for (let i = 0; i < 20; i++) {
    const px = (i * 37 + Math.sin(simTime * 0.1 + i) * 5) % CANVAS_W;
    const py = waterY + 4 + ((i * 53 + Math.cos(simTime * 0.08 + i * 2) * 3) % (waterDepth - 8));
    const shades = ['#3a6b5e', '#2a5a4e', '#4a7b6e', '#355f53'];
    ctx.fillStyle = shades[i % shades.length];
    ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
  }

  // --- Underwater bubbles rising from bottom ---
  for (let i = 0; i < 6; i++) {
    const bx = (i * 43 + 7) % CANVAS_W;
    const riseSpeed = 8 + (i % 3) * 4;
    const by = bottomY - ((simTime * riseSpeed + i * 31) % waterDepth);
    if (by > waterY) {
      ctx.fillStyle = 'rgba(200,230,255,0.5)';
      ctx.fillRect(Math.floor(bx + Math.sin(simTime + i) * 2), Math.floor(by), 1, 1);
    }
  }

  // --- Schools of tiny fish (3-6 dots each, sinusoidal) ---
  const schoolColors = ['#c0c8d0', '#ff8844', '#5588cc'];
  for (let s = 0; s < 3; s++) {
    const count = 3 + (s % 4);
    const baseX = ((simTime * (10 + s * 5) + s * 90) % (CANVAS_W + 40)) - 20;
    const baseY = waterY + 10 + s * (waterDepth / 4);
    for (let f = 0; f < count; f++) {
      const fx = baseX + f * 3 + Math.sin(simTime * 2 + f) * 2;
      const fy = baseY + Math.sin(simTime * 1.5 + f * 0.8 + s) * 4;
      if (fy > waterY && fy < CANVAS_H) {
        ctx.fillStyle = schoolColors[s];
        ctx.fillRect(Math.floor(fx), Math.floor(fy), 1, 1);
      }
    }
  }

  // --- Catfish / bottom feeders (4-5px near bottom, slow) ---
  for (let i = 0; i < 3; i++) {
    const cx = ((simTime * (2 + i) + i * 80) % (CANVAS_W + 10)) - 5;
    const cy = bottomY - 3 - i * 2;
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(Math.floor(cx), cy, 4, 2);
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(Math.floor(cx) + 4, cy, 1, 1);
    // whiskers
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(Math.floor(cx) + 5, cy - 1, 1, 1);
    ctx.fillRect(Math.floor(cx) + 5, cy + 1, 1, 1);
  }

  // --- Turtle swimming underwater (3x2 green blob, slow) ---
  {
    const tx = ((simTime * 4 + 150) % (CANVAS_W + 20)) - 10;
    const ty = waterY + waterDepth * 0.3 + Math.sin(simTime * 0.5) * 5;
    if (ty > waterY && ty < CANVAS_H - 4) {
      ctx.fillStyle = '#3a7a3a';
      ctx.fillRect(Math.floor(tx), Math.floor(ty), 3, 2);
      // head
      ctx.fillStyle = '#4a8a4a';
      ctx.fillRect(Math.floor(tx) + 3, Math.floor(ty), 1, 1);
      // legs
      ctx.fillStyle = '#3a7a3a';
      ctx.fillRect(Math.floor(tx), Math.floor(ty) + 2, 1, 1);
      ctx.fillRect(Math.floor(tx) + 2, Math.floor(ty) + 2, 1, 1);
    }
  }

  // --- Large shadow (alligator gar) occasional pass ---
  {
    const garCycle = (simTime * 1.5) % 300;
    if (garCycle < 80) {
      const gx = (garCycle / 80) * (CANVAS_W + 30) - 15;
      const gy = waterY + waterDepth * 0.5;
      ctx.fillStyle = 'rgba(20,30,25,0.35)';
      ctx.fillRect(Math.floor(gx), Math.floor(gy), 10, 2);
      ctx.fillRect(Math.floor(gx) + 10, Math.floor(gy), 2, 1);
      ctx.fillRect(Math.floor(gx) - 1, Math.floor(gy) + 1, 1, 1);
    }
  }

  // --- Crawdads / crabs on the bottom ---
  for (let i = 0; i < 4; i++) {
    const skitter = Math.sin(simTime * 3 + i * 2.5) * 8;
    const crx = (i * 60 + 20 + skitter) % CANVAS_W;
    const cry = bottomY - 1;
    ctx.fillStyle = i % 2 === 0 ? '#8a3a2a' : '#6a4a3a';
    ctx.fillRect(Math.floor(crx), cry, 2, 1);
    // claws
    ctx.fillRect(Math.floor(crx) - 1, cry - 1, 1, 1);
    ctx.fillRect(Math.floor(crx) + 2, cry - 1, 1, 1);
  }
}

export function renderSkyLife(ctx, waterY, simTime, vegRng) {
  const skyTop = 0;
  const skyLimit = Math.floor(waterY * 0.5);

  // --- Wispy cirrus clouds (thin horizontal lines) ---
  for (let i = 0; i < 3; i++) {
    const cy = 5 + i * 8 + Math.floor(vegRng.random() * 4);
    const cx = Math.floor(vegRng.random() * CANVAS_W);
    const cw = 12 + Math.floor(vegRng.random() * 20);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect((cx + simTime * 0.3) % (CANVAS_W + cw) - cw, cy, cw, 1);
  }

  // --- Cumulus cloud puffs ---
  for (let i = 0; i < 2; i++) {
    const cy = 10 + Math.floor(vegRng.random() * (skyLimit - 15));
    const cx = Math.floor(vegRng.random() * CANVAS_W);
    const drift = (cx + simTime * 0.5 + i * 100) % (CANVAS_W + 20) - 10;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(Math.floor(drift), cy, 8, 3);
    ctx.fillRect(Math.floor(drift) + 2, cy - 1, 4, 1);
    ctx.fillRect(Math.floor(drift) + 1, cy + 3, 6, 1);
  }

  // --- Bird V-formations (occasional chevron of 5-7 dots) ---
  {
    const birdCycle = (simTime * 3) % 500;
    if (birdCycle < 120) {
      const bx = (birdCycle / 120) * (CANVAS_W + 40) - 20;
      const by = 8 + Math.sin(simTime * 0.2) * 3;
      const count = 5 + Math.floor(simTime * 0.1) % 3;
      ctx.fillStyle = '#1a1a2a';
      for (let b = 0; b < count; b++) {
        const side = b % 2 === 0 ? 1 : -1;
        const rank = Math.ceil(b / 2);
        const fx = Math.floor(bx - rank * 3);
        const fy = Math.floor(by + side * rank * 2);
        if (fy >= 0 && fy < skyLimit) {
          ctx.fillRect(fx, fy, 1, 1);
        }
      }
    }
  }

  // --- Distant airplane (tiny cross, very high, slow) ---
  {
    const planeCycle = (simTime * 2) % 600;
    if (planeCycle < 180) {
      const px = (planeCycle / 180) * (CANVAS_W + 10) - 5;
      const py = 3;
      ctx.fillStyle = '#aaaacc';
      ctx.fillRect(Math.floor(px), py, 2, 1);
      ctx.fillRect(Math.floor(px), py - 1, 1, 1);
      ctx.fillRect(Math.floor(px), py + 1, 1, 1);
    }
  }

  // --- Helicopter (rare, 3-4px with spinning rotor) ---
  {
    const heliCycle = (simTime * 1.2) % 900;
    if (heliCycle < 100) {
      const hx = (heliCycle / 100) * (CANVAS_W + 10) - 5;
      const hy = 12;
      ctx.fillStyle = '#555566';
      ctx.fillRect(Math.floor(hx), hy, 3, 2);
      // tail
      ctx.fillRect(Math.floor(hx) - 2, hy, 2, 1);
      // spinning rotor
      const rotorPhase = Math.floor(simTime * 10) % 2;
      ctx.fillStyle = '#777788';
      if (rotorPhase === 0) {
        ctx.fillRect(Math.floor(hx) - 1, hy - 1, 5, 1);
      } else {
        ctx.fillRect(Math.floor(hx) + 1, hy - 1, 1, 1);
      }
    }
  }

  // --- Hot air balloon (rare, colorful 4x5, drifts slowly) ---
  {
    const balloonCycle = (simTime * 0.8) % 1200;
    if (balloonCycle < 150) {
      const bax = (balloonCycle / 150) * (CANVAS_W + 10) - 5;
      const bay = 6 + Math.sin(simTime * 0.3) * 2;
      // envelope
      ctx.fillStyle = '#cc3333';
      ctx.fillRect(Math.floor(bax), Math.floor(bay), 4, 2);
      ctx.fillStyle = '#cccc33';
      ctx.fillRect(Math.floor(bax), Math.floor(bay) + 2, 4, 1);
      ctx.fillStyle = '#3366cc';
      ctx.fillRect(Math.floor(bax) + 1, Math.floor(bay) - 1, 2, 1);
      // basket
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(Math.floor(bax) + 1, Math.floor(bay) + 3, 2, 1);
      // ropes
      ctx.fillStyle = '#555555';
      ctx.fillRect(Math.floor(bax) + 1, Math.floor(bay) + 3, 1, 1);
      ctx.fillRect(Math.floor(bax) + 2, Math.floor(bay) + 3, 1, 1);
    }
  }

  // --- Pollen / seeds drifting downward ---
  for (let i = 0; i < 8; i++) {
    const px = (i * 31 + simTime * 1.5 + Math.sin(simTime * 0.5 + i) * 10) % CANVAS_W;
    const py = ((simTime * 3 + i * 19) % (waterY * 0.8));
    ctx.fillStyle = i % 3 === 0 ? '#ffffaa' : 'rgba(255,255,255,0.4)';
    ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
  }

  // --- Hawks circling (single dark pixel, sin/cos circles) ---
  {
    const hawkR = 12;
    const hawkCx = CANVAS_W * 0.7;
    const hawkCy = skyLimit * 0.6;
    const hx = hawkCx + Math.cos(simTime * 0.3) * hawkR;
    const hy = hawkCy + Math.sin(simTime * 0.3) * hawkR * 0.5;
    if (hy >= 0 && hy < skyLimit) {
      ctx.fillStyle = '#2a1a1a';
      ctx.fillRect(Math.floor(hx), Math.floor(hy), 1, 1);
      // wings
      ctx.fillRect(Math.floor(hx) - 1, Math.floor(hy), 1, 1);
      ctx.fillRect(Math.floor(hx) + 1, Math.floor(hy), 1, 1);
    }
  }
}

export function renderUI(ctx, seed, genCount) {
  const seedText = `seed:${seed.length > 12 ? seed.slice(-12) : seed}`;
  ctx.fillStyle = COLORS.uiTextDim;
  drawPixelText(ctx, seedText, CANVAS_W - seedText.length * 4 - 2, CANVAS_H - 6);

  if (genCount !== undefined) {
    const genText = `gen:${genCount}`;
    ctx.fillStyle = COLORS.uiTextDim;
    drawPixelText(ctx, genText, 2, CANVAS_H - 6);
  }
}
