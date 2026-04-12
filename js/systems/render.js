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

export function renderSky(ctx, waterY, simTime) {
  const bands = [
    { color: COLORS.skyTop, y: 0, h: Math.floor(waterY * 0.4) },
    { color: COLORS.skyMid, y: Math.floor(waterY * 0.4), h: Math.floor(waterY * 0.35) },
    { color: COLORS.skyBottom, y: Math.floor(waterY * 0.75), h: waterY - Math.floor(waterY * 0.75) },
  ];
  for (const band of bands) {
    ctx.fillStyle = band.color;
    ctx.fillRect(0, band.y, CANVAS_W, band.h);
  }
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

export function renderVegetation(ctx, terrain, waterY, vegRng, simTime) {
  // --- TALL CYPRESS / SWAMP TREES ---
  const numTrees = vegRng.range(5, 9);
  for (let i = 0; i < numTrees; i++) {
    const x = vegRng.range(8, CANVAS_W - 8);
    const groundY = terrain[x];
    if (groundY < waterY + 8) {
      const trunkH = vegRng.range(30, 55); // TALL trees
      const trunkW = vegRng.range(2, 5);
      const sway = Math.sin(simTime * 0.2 + x * 0.15) * 0.4;
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
      const canopyW = vegRng.range(12, 22);
      const canopyH = vegRng.range(6, 12);

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
  for (let i = 0; i < 25; i++) {
    const x = vegRng.range(0, CANVAS_W - 1);
    const groundY = terrain[x];
    if (groundY < waterY + 2) {
      const sway = Math.sin(simTime * 1.5 + x * 0.5) * 0.5;
      const h = vegRng.range(2, 5);
      ctx.fillStyle = vegRng.chance(0.5) ? '#4a7a2e' : '#3a6a22';
      for (let dy = 0; dy < h; dy++) {
        const s = Math.round(sway * (dy / h));
        ctx.fillRect(x + s, groundY - dy - 1, 1, 1);
      }
    }
  }

  // --- CATTAILS (thicker) ---
  for (let i = 0; i < 12; i++) {
    const x = vegRng.range(0, CANVAS_W - 1);
    const groundY = terrain[x];
    if (Math.abs(groundY - waterY) < 10) {
      const height = vegRng.range(8, 15);
      const sway = Math.sin(simTime * 0.8 + x * 0.3) * 0.7;
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
}

// --- Entity Rendering ---

export function renderGators(ctx, world) {
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
    const drawY = Math.floor(tr.y + (gator.breatheOffset || 0));

    if (scale > 1.05) {
      drawScaledSprite(ctx, sprite, drawX, drawY, tr.direction === -1, tints, scale);
    } else {
      drawSprite(ctx, sprite, drawX, drawY, tr.direction === -1, tints);
    }

    // Green glow for gators that ate aliens
    if (gator.glowing && gator.glowTimer > 0) {
      gator.glowTimer -= 0.016; // ~1 frame
      const glowPulse = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
      const w = (gator.spriteW || 20) * (scale > 1.05 ? scale : 1);
      const h = (gator.spriteH || 8) * (scale > 1.05 ? scale : 1);
      ctx.fillStyle = `rgba(0, 255, 50, ${glowPulse})`;
      ctx.fillRect(drawX - 1, drawY - 1, Math.ceil(w) + 2, Math.ceil(h) + 2);
      ctx.fillStyle = `rgba(0, 200, 30, ${glowPulse * 0.5})`;
      ctx.fillRect(drawX - 2, drawY - 2, Math.ceil(w) + 4, Math.ceil(h) + 4);
      if (gator.glowTimer <= 0) gator.glowing = false;
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

export function renderPrey(ctx, world, simTime) {
  for (const [id, tr, prey] of world.query('transform', 'prey')) {
    if (!prey.alive) continue;
    const sprite = prey.sprite;
    if (sprite) {
      drawSprite(ctx, sprite, Math.floor(tr.x), Math.floor(tr.y), tr.vx < 0);
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
