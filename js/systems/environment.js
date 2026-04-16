// Environment system — day/night cycle, weather, seasons

import { CANVAS_W, CANVAS_H } from '../config.js';

const DAY_LENGTH = 180;     // real seconds per full day cycle — slow, natural
const SEASON_LENGTH = 120;   // real seconds per season

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const SEASON_CONFIGS = {
  spring: { foodMult: 1.3, breedingMult: 1.5, skyTint: [0, 10, 0], landHue: '#5a8a3a' },
  summer: { foodMult: 1.0, breedingMult: 1.0, skyTint: [10, 5, -5], landHue: '#5a7a3a' },
  autumn: { foodMult: 0.6, breedingMult: 0.3, skyTint: [15, 5, -10], landHue: '#7a6a3a' },
  winter: { foodMult: 0.3, breedingMult: 0.0, skyTint: [-10, -5, 5], landHue: '#5a6a5a' },
};

const WEATHER_TYPES = ['clear', 'cloudy', 'rain', 'storm'];

export function createEnvironment() {
  return {
    timeOfDay: 0.25,     // start at dawn (0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk)
    season: 'spring',
    seasonIndex: 0,
    seasonTimer: SEASON_LENGTH,
    weather: 'clear',
    weatherTimer: 30,
    rainIntensity: 0,
    foodMultiplier: 1.0,
    clouds: [],
    rainDrops: [],
    stars: [],
    satellites: [],
  };
}

export function environmentSystem(env, dt, rng) {
  // Day/night cycle
  env.timeOfDay = (env.timeOfDay + dt / DAY_LENGTH) % 1.0;

  // Season progression
  env.seasonTimer -= dt;
  if (env.seasonTimer <= 0) {
    env.seasonIndex = (env.seasonIndex + 1) % SEASONS.length;
    env.season = SEASONS[env.seasonIndex];
    env.seasonTimer = SEASON_LENGTH;
  }

  const seasonConfig = SEASON_CONFIGS[env.season];
  env.foodMultiplier = seasonConfig.foodMult;

  // Weather changes
  env.weatherTimer -= dt;
  if (env.weatherTimer <= 0) {
    // Weather probabilities vary by season — more diversity, more drama
    if (env.season === 'spring') {
      env.weather = rng.pick(['clear', 'rain', 'rain', 'cloudy', 'storm', 'clear']);
    } else if (env.season === 'summer') {
      env.weather = rng.pick(['clear', 'clear', 'storm', 'storm', 'cloudy', 'rain']);
    } else if (env.season === 'autumn') {
      env.weather = rng.pick(['cloudy', 'rain', 'rain', 'clear', 'storm', 'cloudy']);
    } else {
      env.weather = rng.pick(['cloudy', 'clear', 'storm', 'cloudy', 'rain', 'clear']);
    }
    env.weatherTimer = rng.float(10, 30); // faster cycling

    if (env.weather === 'rain') {
      env.rainIntensity = rng.float(0.3, 0.7);
    } else if (env.weather === 'storm') {
      env.rainIntensity = rng.float(0.7, 1.0);
    } else {
      env.rainIntensity = 0;
    }
  }

  // Cloud management
  if (env.weather !== 'clear' && env.clouds.length < 5) {
    if (rng.chance(0.02 * dt)) {
      env.clouds.push({
        x: -20,
        y: rng.float(3, 20),
        w: rng.range(12, 30),
        h: rng.range(4, 8),
        speed: rng.float(2, 5),
      });
    }
  }
  for (let i = env.clouds.length - 1; i >= 0; i--) {
    env.clouds[i].x += env.clouds[i].speed * dt;
    if (env.clouds[i].x > CANVAS_W + 30) {
      env.clouds.splice(i, 1);
    }
  }

  // Rain drops
  if (env.rainIntensity > 0) {
    const dropCount = Math.floor(env.rainIntensity * 8);
    for (let i = 0; i < dropCount; i++) {
      if (rng.chance(0.3)) {
        env.rainDrops.push({
          x: rng.float(0, CANVAS_W),
          y: 0,
          speed: rng.float(60, 100),
          life: 1.0,
        });
      }
    }
  }
  for (let i = env.rainDrops.length - 1; i >= 0; i--) {
    env.rainDrops[i].y += env.rainDrops[i].speed * dt;
    if (env.rainDrops[i].y > CANVAS_H) {
      env.rainDrops.splice(i, 1);
    }
  }
  // Cap rain drops
  if (env.rainDrops.length > 80) {
    env.rainDrops.splice(0, env.rainDrops.length - 80);
  }

  // Stars (generated once, visible at night)
  if (env.stars.length === 0) {
    for (let i = 0; i < 30; i++) {
      env.stars.push({
        x: rng.range(0, CANVAS_W),
        y: rng.range(0, 40),
        twinkle: rng.float(0, Math.PI * 2),
      });
    }
  }

  // Satellites — generate once, move continuously
  if (env.satellites.length === 0) {
    for (let i = 0; i < rng.range(2, 3); i++) {
      env.satellites.push({
        x: rng.range(0, CANVAS_W),
        y: rng.range(3, 25),
        speed: rng.float(8, 15),
        direction: rng.chance(0.5) ? 1 : -1,
      });
    }
  }
  for (const sat of env.satellites) {
    sat.x += sat.speed * sat.direction * dt;
    if (sat.x > CANVAS_W + 5) sat.x = -5;
    if (sat.x < -5) sat.x = CANVAS_W + 5;
  }

  // Lunar cycle — ~8 day cycles per moon phase
  env.lunarPhase = (env.lunarPhase || 0) + dt / (DAY_LENGTH * 8);
  if (env.lunarPhase > 1) env.lunarPhase -= 1;

  // Track day count
  env.dayCount = (env.dayCount || 0);
  if (env.timeOfDay < 0.01 && !env.dayTicked) {
    env.dayCount++;
    env.dayTicked = true;
  }
  if (env.timeOfDay > 0.1) env.dayTicked = false;
}

// Render celestial bodies — called BEFORE terrain so they sit behind everything
export function renderCelestial(ctx, env, waterY, simTime) {
  const tod = env.timeOfDay;
  // Sky ceiling — celestial bodies stay in the top portion of the sky only
  const skyTop = 4;
  const skyBottom = Math.floor(waterY * 0.35); // well above the tree line

  // --- SUN --- (visible only during day, never overlaps moon, hidden during eclipse)
  if (tod > 0.22 && tod < 0.78 && !env._eclipseActive) {
    const dayProgress = (tod - 0.22) / 0.56;
    // Gentle horizontal drift across ~50% of the screen, centered
    const sunX = Math.floor(CANVAS_W * 0.25 + dayProgress * CANVAS_W * 0.5);
    const sunArc = Math.sin(dayProgress * Math.PI);
    const sunY = Math.floor(skyBottom - sunArc * (skyBottom - skyTop));

    // Outer atmospheric glow
    const glowAlpha = sunArc * 0.04;
    ctx.fillStyle = `rgba(255, 235, 160, ${glowAlpha})`;
    ctx.fillRect(sunX - 7, sunY - 7, 15, 15);
    ctx.fillStyle = `rgba(255, 230, 140, ${glowAlpha * 1.5})`;
    ctx.fillRect(sunX - 5, sunY - 5, 11, 11);
    ctx.fillStyle = `rgba(255, 225, 120, ${sunArc * 0.08})`;
    ctx.fillRect(sunX - 3, sunY - 3, 7, 7);

    // Sun body — 5x5
    ctx.fillStyle = '#ffee88';
    ctx.fillRect(sunX - 2, sunY - 2, 5, 5);
    // Rim
    ctx.fillStyle = '#ffdd55';
    ctx.fillRect(sunX - 2, sunY - 2, 5, 1);
    ctx.fillRect(sunX - 2, sunY + 2, 5, 1);
    ctx.fillRect(sunX - 2, sunY - 1, 1, 3);
    ctx.fillRect(sunX + 2, sunY - 1, 1, 3);
    // Core
    ctx.fillStyle = '#ffffcc';
    ctx.fillRect(sunX - 1, sunY - 1, 3, 3);
    ctx.fillStyle = '#fffff0';
    ctx.fillRect(sunX, sunY, 1, 1);
  }

  // --- STARS --- (behind moon, only at night)
  if (tod < 0.2 || tod > 0.8) {
    const nightStrength = tod < 0.2
      ? 1 - tod / 0.2
      : (tod - 0.8) / 0.2;
    if (nightStrength > 0.3) {
      ctx.fillStyle = `rgba(255, 255, 255, ${nightStrength * 0.6})`;
      for (const star of env.stars) {
        const twinkle = Math.sin(simTime * 2 + star.twinkle);
        if (twinkle > 0) {
          ctx.fillRect(star.x, star.y, 1, 1);
        }
      }
      // Satellites — steady moving dots, no twinkle
      ctx.fillStyle = `rgba(255, 255, 255, ${nightStrength * 0.7})`;
      for (const sat of env.satellites) {
        ctx.fillRect(Math.floor(sat.x), sat.y, 1, 1);
      }
    }
  }

  // --- MOON --- (visible only at night, never overlaps sun)
  if (tod < 0.18 || tod > 0.82) {
    const nightProgress = tod < 0.18
      ? (tod + 0.18) / 0.36
      : (tod - 0.82) / 0.36;
    const moonX = Math.floor(CANVAS_W * 0.25 + nightProgress * CANVAS_W * 0.5);
    const moonArc = Math.sin(nightProgress * Math.PI);
    const moonY = Math.floor(skyBottom - moonArc * (skyBottom - skyTop));
    const phase = env.lunarPhase || 0;

    // Glow
    const moonBright = 1 - Math.abs(phase - 0.5) * 2;
    ctx.fillStyle = `rgba(200, 210, 225, ${moonBright * 0.04})`;
    ctx.fillRect(moonX - 6, moonY - 6, 13, 13);
    ctx.fillStyle = `rgba(210, 215, 230, ${moonBright * 0.06})`;
    ctx.fillRect(moonX - 4, moonY - 4, 9, 9);

    // Moon body — 5x5
    ctx.fillStyle = '#ccccbb';
    ctx.fillRect(moonX - 2, moonY - 2, 5, 5);
    ctx.fillStyle = '#ddddcc';
    ctx.fillRect(moonX - 1, moonY - 1, 3, 3);
    ctx.fillStyle = '#eeeedd';
    ctx.fillRect(moonX, moonY, 1, 1);
    // Craters
    ctx.fillStyle = '#bbbbaa';
    ctx.fillRect(moonX - 1, moonY + 1, 1, 1);
    ctx.fillRect(moonX + 1, moonY - 1, 1, 1);

    // Phase shadow
    const shadowColor = 'rgba(15, 15, 30, 0.85)';
    if (phase < 0.5) {
      const shadowW = Math.ceil((1 - phase * 2) * 5);
      if (shadowW > 0) {
        ctx.fillStyle = shadowColor;
        ctx.fillRect(moonX - 2, moonY - 2, Math.min(shadowW, 5), 5);
      }
    } else {
      const shadowW = Math.ceil((phase - 0.5) * 2 * 5);
      if (shadowW > 0) {
        ctx.fillStyle = shadowColor;
        ctx.fillRect(moonX + 3 - shadowW, moonY - 2, Math.min(shadowW, 5), 5);
      }
    }

    // Full moon extra glow
    if (phase > 0.4 && phase < 0.6) {
      ctx.fillStyle = 'rgba(220, 220, 200, 0.04)';
      ctx.fillRect(moonX - 8, moonY - 8, 17, 17);
    }
  }
}

// Render foreground environment effects — called AFTER everything, on top
export function renderEnvironmentEffects(ctx, env, waterY, simTime) {
  const tod = env.timeOfDay;

  // Night overlay
  if (tod < 0.2 || tod > 0.8) {
    const nightStrength = tod < 0.2
      ? 1 - tod / 0.2
      : (tod - 0.8) / 0.2;

    const moonBrightness = 1 - Math.abs((env.lunarPhase || 0) - 0.5) * 1.5;
    const darkness = nightStrength * (0.5 - moonBrightness * 0.15);
    ctx.fillStyle = `rgba(5, 5, 25, ${darkness})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Dawn/dusk tint
  if (tod > 0.18 && tod < 0.3) {
    const strength = 1 - (tod - 0.18) / 0.12;
    const bandH = Math.floor(waterY * 0.35);
    // Warm orange at horizon
    ctx.fillStyle = `rgba(220, 120, 50, ${strength * 0.12})`;
    ctx.fillRect(0, waterY - bandH, CANVAS_W, bandH);
    // Pink higher up
    ctx.fillStyle = `rgba(200, 80, 80, ${strength * 0.08})`;
    ctx.fillRect(0, waterY - bandH * 2, CANVAS_W, bandH);
    // Faint purple at top
    ctx.fillStyle = `rgba(120, 60, 120, ${strength * 0.05})`;
    ctx.fillRect(0, 0, CANVAS_W, Math.max(1, waterY - bandH * 2));
  }
  if (tod > 0.7 && tod < 0.82) {
    const strength = (tod - 0.7) / 0.12;
    const bandH = Math.floor(waterY * 0.35);
    // Deep orange at horizon
    ctx.fillStyle = `rgba(200, 80, 30, ${strength * 0.15})`;
    ctx.fillRect(0, waterY - bandH, CANVAS_W, bandH);
    // Red-pink higher
    ctx.fillStyle = `rgba(180, 50, 60, ${strength * 0.1})`;
    ctx.fillRect(0, waterY - bandH * 2, CANVAS_W, bandH);
    // Deep purple at top
    ctx.fillStyle = `rgba(80, 30, 100, ${strength * 0.07})`;
    ctx.fillRect(0, 0, CANVAS_W, Math.max(1, waterY - bandH * 2));
  }

  // Clouds
  ctx.fillStyle = env.weather === 'storm' ? '#444455' : '#aabbcc';
  for (const cloud of env.clouds) {
    for (let cy = 0; cy < cloud.h; cy++) {
      const rowWidth = cloud.w - Math.abs(cy - cloud.h / 2) * 2;
      if (rowWidth > 0) {
        const startX = Math.floor(cloud.x + (cloud.w - rowWidth) / 2);
        ctx.fillRect(startX, Math.floor(cloud.y + cy), Math.floor(rowWidth), 1);
      }
    }
  }

  // Rain
  if (env.rainIntensity > 0) {
    ctx.fillStyle = '#8899bb';
    for (const drop of env.rainDrops) {
      ctx.fillRect(Math.floor(drop.x), Math.floor(drop.y), 1, 2);
    }
  }

  // Season tint
  if (env.season === 'autumn') {
    ctx.fillStyle = 'rgba(100, 60, 20, 0.08)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else if (env.season === 'winter') {
    ctx.fillStyle = 'rgba(150, 170, 200, 0.08)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

// Get season text for UI
export function getSeasonText(env) {
  const timeNames = ['night', 'dawn', 'day', 'day', 'day', 'dusk', 'dusk', 'night'];
  const timeIndex = Math.floor(env.timeOfDay * 8);
  return `${env.season}`;
}
