// State persistence — localStorage save/load, elapsed time fast-forward

const SAVE_INTERVAL = 30; // seconds
const MAX_FAST_FORWARD = 86400; // cap at 24 hours

export function createPersistence(seed) {
  const key = `idlegator_${seed}`;
  let saveTimer = SAVE_INTERVAL;

  return {
    save(world, env, simTime, maxGeneration, vegState) {
      const gators = [];
      for (const [id, tr, gator] of world.query('transform', 'gator')) {
        gators.push({ tr: { ...tr }, gator: { ...gator, traits: { ...gator.traits } } });
      }

      const state = {
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
        savedAt: Date.now(),
        version: 1,
      };

      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch (e) {
        // localStorage might be full or unavailable
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const state = JSON.parse(raw);
        if (state.version !== 1) return null;
        return state;
      } catch (e) {
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
