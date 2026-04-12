// Seeded PRNG — mulberry32
// All simulation randomness flows through this. No Math.random() in sim code.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export function createRNG(seed) {
  if (typeof seed === 'string') seed = hashString(seed);
  const next = mulberry32(seed);

  return {
    _seed: seed,

    random() {
      return next();
    },

    range(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },

    float(min, max) {
      return min + next() * (max - min);
    },

    chance(probability) {
      return next() < probability;
    },

    pick(array) {
      return array[Math.floor(next() * array.length)];
    },

    gaussian(mean = 0, stddev = 1) {
      // Box-Muller transform
      const u1 = next();
      const u2 = next();
      const z = Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2);
      return mean + z * stddev;
    },

    shuffle(array) {
      const a = [...array];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
}

export function seedFromHash() {
  const hash = window.location.hash;
  const match = hash.match(/seed=([^&]+)/);
  if (match) return match[1];
  return null;
}
