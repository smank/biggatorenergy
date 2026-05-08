// State persistence — localStorage save/load, elapsed time fast-forward

const SAVE_INTERVAL = 30; // seconds
const MAX_FAST_FORWARD = 86400; // cap at 24 hours
const SAVE_VERSION = 2;

// --- Migration helpers ---

function migrateV1ToV2(state) {
  // v1 saves predate: dynasty.era, dynasty.eraClock, dynasty.gensBonusReached,
  //   dynasty.mateGatorId, dynasty.playerGatorId, dynasty.heirGatorId,
  //   gator.lineage (object form), gator.isPlayer, gator.isHeir, gator.traits.*
  // Apply defaults for missing fields; preserve existing fields.
  if (state.dynasty) {
    state.dynasty.era              ??= 1;
    state.dynasty.eraClock         ??= 0;
    state.dynasty.gensBonusReached ??= [];
    state.dynasty.mateGatorId      ??= null;
    state.dynasty.playerGatorId    ??= null;
    state.dynasty.heirGatorId      ??= null;
  }
  if (Array.isArray(state.gators)) {
    for (const saved of state.gators) {
      if (!saved || !saved.gator) continue;
      const g = saved.gator;
      // Convert flat lineageId → lineage object (or assign null if no lineageId)
      if (!g.lineage) {
        if (g.lineageId) {
          g.lineage = { dynastyId: g.lineageId, motherId: null, fatherId: null };
        } else if (state.dynasty && state.dynasty.id) {
          // Very old save: no lineageId at all — tie to current dynasty so gators
          // aren't orphaned. We can't know parentage, so set parents null.
          g.lineage = { dynastyId: state.dynasty.id, motherId: null, fatherId: null };
          g.lineageId = state.dynasty.id;
        } else {
          g.lineage = null;
        }
      }
      // Boolean flags — trust saved value if present, default false
      g.isPlayer ??= false;
      g.isHeir   ??= false;
      // Trait defaults — defense-in-depth (main.js TRAIT_DEFAULTS also covers these)
      g.traits            ??= {};
      g.traits.speed      ??= 1;
      g.traits.maxSize    ??= 1;
      g.traits.aggression ??= 0.5;
      g.traits.fertility  ??= 0.5;
      g.traits.metabolism ??= 1;
    }
  }
  state.version = 2;
  return state;
}

function migrate(state) {
  if (!state || typeof state !== 'object') return null;
  // Pre-versioned saves (before version field existed) are treated as v1
  if (state.version === undefined) state.version = 1;
  let migrated = false;
  while (state.version < SAVE_VERSION) {
    if (state.version === 1) {
      state = migrateV1ToV2(state);
      migrated = true;
    } else {
      break; // unknown intermediate version — stop here
    }
  }
  if (migrated) {
    if (typeof console !== 'undefined') {
      console.log('[bge] migrated save to v' + state.version);
    }
  }
  return state;
}

export function createPersistence(seed) {
  const key = `idlegator_${seed}`;
  let saveTimer = SAVE_INTERVAL;

  return {
    save(world, env, simTime, maxGeneration, vegState, extras) {
      const gators = [];
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        gators.push({ tr: { ...tr }, gator: { ...gator, traits: { ...gator.traits } } });
      }

      const state = {
        version: SAVE_VERSION,
        simTime,
        maxGeneration,
        gators,
        env: {
          timeOfDay: env.timeOfDay,
          season: env.season,
          seasonIndex: env.seasonIndex,
          seasonTimer: env.seasonTimer,
          weather: env.weather,
          weatherTimer: env.weatherTimer,
          rainIntensity: env.rainIntensity,
        },
        vegAge: vegState ? vegState.age : 0,
        vegEpoch: vegState ? vegState.epoch : 0,
        vegGrowth: vegState ? vegState.growth : 0.8,
        // Mode + dynasty snapshot — older saves omit these and default to terrarium on load.
        mode: extras?.mode,
        dynasty: extras?.dynasty,
        savedAt: Date.now(),
      };

      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        // localStorage quota exceeded, disabled (private mode), or unavailable
        if (typeof console !== 'undefined') {
          console.warn('[bge] save failed:', e.message);
        }
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        let state = JSON.parse(raw);
        state = migrate(state);
        if (!state) return null;
        // Refuse saves from a future version we can't understand
        if (state.version > SAVE_VERSION) return null;
        return state;
      } catch (e) {
        if (typeof console !== 'undefined') {
          console.warn('[bge] saved state corrupt, starting fresh:', e.message);
        }
        return null;
      }
    },

    getElapsedTime(savedState) {
      if (!savedState || !savedState.savedAt) return 0;
      return Math.min(MAX_FAST_FORWARD, (Date.now() - savedState.savedAt) / 1000);
    },

    shouldAutoSave(dt) {
      saveTimer -= dt;
      if (saveTimer <= 0) {
        saveTimer = SAVE_INTERVAL;
        return true;
      }
      return false;
    },

    clear() {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    },
  };
}
