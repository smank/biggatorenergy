// Shared color utilities

export function hslToHex(h, s, l) {
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

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('');
}

export function blendColors(hexA, hexB, rng) {
  if (!hexA || !hexB) return hexA || hexB || '#4a8c2a';
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const blend = rng.random();
  const r = Math.round(a.r * blend + b.r * (1 - blend));
  const g = Math.round(a.g * blend + b.g * (1 - blend));
  const bl = Math.round(a.b * blend + b.b * (1 - blend));
  const mr = rng.chance(0.1) ? rng.range(-15, 15) : 0;
  const mg = rng.chance(0.1) ? rng.range(-15, 15) : 0;
  const mb = rng.chance(0.1) ? rng.range(-15, 15) : 0;
  return rgbToHex(r + mr, g + mg, bl + mb);
}

export function randomGatorColors(rng) {
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
