// Achievements System — lifetime, persistent across all dynasties.
// Completely separate from per-dynasty goals (js/game/goals.js).
// State lives in 'bge_achievements' localStorage key.

const ACH_KEY = 'bge_achievements';

// --- Achievement definitions ---
// milestone: true → show description even when locked (progress hooks engagement)
export const ACHIEVEMENTS = [
  {
    id: 'first-blood',
    title: 'First Blood',
    description: 'Killed your first prey.',
    lpReward: 5,
  },
  {
    id: 'first-clutch',
    title: 'First Clutch',
    description: 'Saw your first hatchling.',
    lpReward: 10,
  },
  {
    id: 'first-dynasty',
    title: 'Founder',
    description: 'Started a dynasty.',
    lpReward: 5,
  },
  {
    id: 'gen-10',
    title: 'Lineage',
    description: 'Reached gen 10 in a single dynasty.',
    lpReward: 25,
    milestone: true,
  },
  {
    id: 'gen-25',
    title: 'Long Line',
    description: 'Reached gen 25 in a single dynasty.',
    lpReward: 50,
    milestone: true,
  },
  {
    id: 'gen-50',
    title: 'Ancestral',
    description: 'Reached gen 50 in a single dynasty.',
    lpReward: 100,
    milestone: true,
  },
  {
    id: 'gen-100',
    title: 'Eternal',
    description: 'Reached gen 100 in a single dynasty.',
    lpReward: 250,
    milestone: true,
  },
  {
    id: 'era-2',
    title: 'Witness to Industry',
    description: 'Saw the Industrial Era.',
    lpReward: 25,
    milestone: true,
  },
  {
    id: 'survived-tornado',
    title: 'Stormwise',
    description: 'Survived a tornado as the player gator.',
    lpReward: 15,
  },
  {
    id: 'survived-ufo',
    title: 'Earthbound',
    description: 'Saw a UFO and lived.',
    lpReward: 15,
  },
  {
    id: 'golden-gator',
    title: 'The Golden One',
    description: 'Witnessed a golden gator in your bloodline.',
    lpReward: 20,
  },
  {
    id: 'cryptid-sighting',
    title: 'True Believer',
    description: 'Saw a cryptid in dynasty mode.',
    lpReward: 15,
  },
  {
    id: 'kills-50',
    title: 'Apex',
    description: 'Killed 50 creatures cumulatively.',
    lpReward: 30,
    milestone: true,
  },
  {
    id: 'kills-200',
    title: 'Wholesale',
    description: 'Killed 200 creatures cumulatively.',
    lpReward: 60,
    milestone: true,
  },
  {
    id: 'kills-1000',
    title: 'Legend',
    description: 'Killed 1000 creatures cumulatively.',
    lpReward: 200,
    milestone: true,
  },
  {
    id: 'oldest-50d',
    title: 'Methuselah',
    description: 'A gator in your line lived 50 days.',
    lpReward: 25,
    milestone: true,
  },
  {
    id: 'oldest-100d',
    title: 'Patriarch',
    description: 'A gator in your line lived 100 days.',
    lpReward: 50,
    milestone: true,
  },
  {
    id: 'bloodline-extinct',
    title: 'Last of My Line',
    description: 'Saw your dynasty end.',
    lpReward: 10,
  },
  {
    id: '5-dynasties',
    title: 'Many Lives',
    description: 'Started 5 different dynasties.',
    lpReward: 25,
    milestone: true,
  },
  {
    id: 'gator-fight-win',
    title: 'Champion',
    description: 'Won a fight against another gator.',
    lpReward: 10,
  },
  {
    id: 'lifetime-100-eggs',
    title: 'Fertile',
    description: 'Hatched 100 eggs across all dynasties.',
    lpReward: 50,
    milestone: true,
  },
  {
    id: 'mate-died-survived',
    title: 'Widower',
    description: 'Outlived your founding mate.',
    lpReward: 15,
  },
  {
    id: 'dynasty-died-young',
    title: 'Cut Short',
    description: 'Lost a dynasty before gen 5.',
    lpReward: 5,
  },
  {
    id: 'albino-bloodline',
    title: 'Pale Line',
    description: 'Had an albino gator in your bloodline.',
    lpReward: 25,
  },
  {
    id: 'vault-100lp',
    title: 'Patron',
    description: 'Earned 100 LP cumulative.',
    lpReward: 25,
    milestone: true,
  },
];

// --- State shape ---
// {
//   unlocked: [<id>, ...],
//   stats: {
//     totalKills, totalEggs, totalDynasties, totalLP,
//     dynastyKills,          // kills this dynasty (reset on new dynasty)
//     dynastyEggs,           // eggs this dynasty
//     dynastyOldestAge,      // oldest gator age seen this dynasty (sim-ticks / 60 = days)
//     sawTornadoThisSession, // bool: player was alive through a tornado
//     sawUFOThisSession,     // bool: player was present during a UFO event (and survived)
//   }
// }

export function loadAchievementState() {
  try {
    const raw = localStorage.getItem(ACH_KEY);
    if (!raw) return _blankState();
    const parsed = JSON.parse(raw);
    return {
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      stats: {
        totalKills:           _num(parsed.stats?.totalKills),
        totalEggs:            _num(parsed.stats?.totalEggs),
        totalDynasties:       _num(parsed.stats?.totalDynasties),
        totalLP:              _num(parsed.stats?.totalLP),
        dynastyKills:         _num(parsed.stats?.dynastyKills),
        dynastyEggs:          _num(parsed.stats?.dynastyEggs),
        dynastyOldestAge:     _num(parsed.stats?.dynastyOldestAge),
        sawTornadoThisSession: false,
        sawUFOThisSession:    false,
      },
    };
  } catch (e) {
    return _blankState();
  }
}

export function saveAchievementState(state) {
  if (!state) return;
  try {
    localStorage.setItem(ACH_KEY, JSON.stringify({
      unlocked: state.unlocked || [],
      stats: {
        totalKills:       state.stats.totalKills       || 0,
        totalEggs:        state.stats.totalEggs        || 0,
        totalDynasties:   state.stats.totalDynasties   || 0,
        totalLP:          state.stats.totalLP          || 0,
        dynastyKills:     state.stats.dynastyKills     || 0,
        dynastyEggs:      state.stats.dynastyEggs      || 0,
        dynastyOldestAge: state.stats.dynastyOldestAge || 0,
        // session flags are ephemeral — not persisted
      },
    }));
  } catch (e) {}
}

// --- Stat helpers ---

export function recordKill(state) {
  if (!state) return;
  state.stats.totalKills++;
  state.stats.dynastyKills = (state.stats.dynastyKills || 0) + 1;
}

export function recordEgg(state) {
  if (!state) return;
  state.stats.totalEggs++;
  state.stats.dynastyEggs = (state.stats.dynastyEggs || 0) + 1;
}

export function recordDynastyStart(state) {
  if (!state) return;
  state.stats.totalDynasties++;
  // Reset per-dynasty stats
  state.stats.dynastyKills = 0;
  state.stats.dynastyEggs = 0;
  state.stats.dynastyOldestAge = 0;
  state.stats.sawTornadoThisSession = false;
  state.stats.sawUFOThisSession = false;
  saveAchievementState(state);
}

export function recordLP(state, amount) {
  if (!state || amount <= 0) return;
  state.stats.totalLP = (state.stats.totalLP || 0) + amount;
}

// --- Lookup helpers ---

export function isUnlocked(state, id) {
  return !!(state?.unlocked?.includes(id));
}

export function getUnlockedCount(state) {
  return state?.unlocked?.length || 0;
}

export function getTotalCount() {
  return ACHIEVEMENTS.length;
}

// --- Core check + award ---
// ctx: { dynasty, world, simTime, events?, wildlifeState? }
// callbacks: { onUnlock(achievement), onAwardLP(amount), addMoment(text) }
export function checkAchievements(state, ctx, callbacks) {
  if (!state) return;

  const dynasty = ctx.dynasty;
  const obituary = ctx.obituary || [];

  // Track oldest gator age seen in this dynasty (from living gators)
  if (dynasty && ctx.world) {
    for (const [, , g] of ctx.world.query('transform', 'gator')) {
      if (!g.lineageId || g.lineageId !== dynasty?.id) continue;
      const ageDays = (g.age || 0) / 60;
      if (ageDays > (state.stats.dynastyOldestAge || 0)) {
        state.stats.dynastyOldestAge = ageDays;
      }
    }
    // Also check obituary for this dynasty
    for (const e of obituary) {
      if (e.lineageId !== dynasty?.id) continue;
      const ageDays = (e.age || 0) / 60;
      if (ageDays > (state.stats.dynastyOldestAge || 0)) {
        state.stats.dynastyOldestAge = ageDays;
      }
    }
  }

  for (const ach of ACHIEVEMENTS) {
    if (state.unlocked.includes(ach.id)) continue;
    if (_check(ach.id, state, ctx)) {
      _award(state, ach, callbacks);
    }
  }
}

// --- Internal condition checker ---
function _check(id, state, ctx) {
  const stats = state.stats;
  const dynasty = ctx.dynasty;
  const world = ctx.world;
  const obituary = ctx.obituary || [];

  switch (id) {
    case 'first-blood':
      return stats.totalKills >= 1;

    case 'first-clutch':
      return stats.totalEggs >= 1;

    case 'first-dynasty':
      return stats.totalDynasties >= 1;

    case 'gen-10':
      return !!(dynasty && (ctx.maxGeneration || 0) >= 10);

    case 'gen-25':
      return !!(dynasty && (ctx.maxGeneration || 0) >= 25);

    case 'gen-50':
      return !!(dynasty && (ctx.maxGeneration || 0) >= 50);

    case 'gen-100':
      return !!(dynasty && (ctx.maxGeneration || 0) >= 100);

    case 'era-2':
      return !!(dynasty && (dynasty.era || 1) >= 2);

    case 'survived-tornado':
      return !!(stats.sawTornadoThisSession);

    case 'survived-ufo':
      return !!(stats.sawUFOThisSession);

    case 'golden-gator': {
      if (!dynasty || !world) return false;
      // Check living bloodline
      for (const [, , g] of world.query('transform', 'gator')) {
        if ((g.lineageId === dynasty.id || g.lineage?.dynastyId === dynasty.id) && g.golden) return true;
      }
      return false;
    }

    case 'cryptid-sighting':
      return !!(ctx.seenCryptid);

    case 'kills-50':
      return stats.totalKills >= 50;

    case 'kills-200':
      return stats.totalKills >= 200;

    case 'kills-1000':
      return stats.totalKills >= 1000;

    case 'oldest-50d':
      return (stats.dynastyOldestAge || 0) >= 50;

    case 'oldest-100d':
      return (stats.dynastyOldestAge || 0) >= 100;

    case 'bloodline-extinct':
      return !!(ctx.dynastyJustEnded);

    case '5-dynasties':
      return stats.totalDynasties >= 5;

    case 'gator-fight-win':
      return !!(ctx.fightWinThisFrame);

    case 'lifetime-100-eggs':
      return stats.totalEggs >= 100;

    case 'mate-died-survived':
      return !!(ctx.mateJustDied);

    case 'dynasty-died-young':
      return !!(ctx.dynastyJustEnded && (ctx.maxGeneration || 0) < 5);

    case 'albino-bloodline': {
      if (!dynasty || !world) return false;
      for (const [, , g] of world.query('transform', 'gator')) {
        if ((g.lineageId === dynasty.id || g.lineage?.dynastyId === dynasty.id) && g.albino) return true;
      }
      return false;
    }

    case 'vault-100lp':
      return (stats.totalLP || 0) >= 100;

    default:
      return false;
  }
}

// --- Award an achievement ---
function _award(state, ach, callbacks) {
  state.unlocked.push(ach.id);
  saveAchievementState(state);
  if (ach.lpReward > 0) {
    callbacks?.onAwardLP?.(ach.lpReward);
  }
  callbacks?.onUnlock?.(ach);
  if (callbacks?.addMoment) {
    callbacks.addMoment(`achievement: ${ach.title.toLowerCase()}`);
  }
}

// --- Panel HTML renderer ---
// Builds the achievements overlay inside the element with id 'achievements-panel'.
export function renderAchievementsPanel(state) {
  const panel = document.getElementById('achievements-panel');
  if (!panel) return;

  const unlockedCount = getUnlockedCount(state);
  const totalCount    = getTotalCount();
  const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  let html = `
    <div class="ach-header">
      <div class="ach-title">achievements</div>
      <div class="ach-progress">${unlockedCount} / ${totalCount} &nbsp;&middot;&nbsp; ${pct}%</div>
    </div>
    <div class="ach-list">`;

  for (const ach of ACHIEVEMENTS) {
    const unlocked = state.unlocked.includes(ach.id);
    const showDesc = unlocked || ach.milestone;
    const desc = showDesc ? ach.description.toLowerCase() : '???';
    const mod = unlocked ? 'ach-item--unlocked' : 'ach-item--locked';
    const lpStr = ach.lpReward > 0 ? `+${ach.lpReward} lp` : '';

    html += `
      <div class="ach-item ${mod}">
        <div class="ach-item-title">${_escHtml(ach.title)}</div>
        <div class="ach-item-desc">${_escHtml(desc)}</div>
        ${lpStr ? `<div class="ach-item-lp">${lpStr}</div>` : ''}
      </div>`;
  }

  html += '</div>';
  panel.innerHTML = html;
}

// --- Private helpers ---

function _blankState() {
  return {
    unlocked: [],
    stats: {
      totalKills: 0,
      totalEggs: 0,
      totalDynasties: 0,
      totalLP: 0,
      dynastyKills: 0,
      dynastyEggs: 0,
      dynastyOldestAge: 0,
      sawTornadoThisSession: false,
      sawUFOThisSession: false,
    },
  };
}

function _num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
