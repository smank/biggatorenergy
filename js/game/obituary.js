// Obituary Log + Notable Moments
// The swamp remembers who lived here. Field notes, not headlines.

const OB_KEY = 'bge_obituary';
const MAX_ENTRIES = 50;
const MOMENT_LIFE = 4.0; // seconds

export function createObituaryState() {
  return {
    entries: [],   // [{ name, sex, stage, age, generation, cause, deathTime, lineageId? }]
    moments: [],   // [{ text, x, y, life, maxLife, color }]
  };
}

// --- Death Logging ---

export function logDeath(state, { gator, cause, time }) {
  if (!gator) return;

  const entry = {
    name:       gator.name  || null,
    sex:        gator.sex   || 'unknown',
    stage:      gator.stage || 'unknown',
    age:        Math.floor(gator.age || 0),
    generation: gator.generation || 0,
    cause:      cause || 'unknown',
    deathTime:  time || 0,
    lineageId:  gator.lineageId || null,
  };

  // Newest first
  state.entries.unshift(entry);
  if (state.entries.length > MAX_ENTRIES) {
    state.entries.length = MAX_ENTRIES;
  }

  // Named gators get a floating moment too
  if (gator.name) {
    const momentText = _deathMomentText(gator.name, Math.floor(gator.age || 0), cause);
    const color = _causeColor(cause);
    // Position: center-ish, slight variance so stacked deaths don't overlap
    addMoment(state, {
      text: momentText,
      x: null, // caller can override; null = centered
      y: null,
      color,
    });
  }

  saveObituary(state);
}

function _deathMomentText(name, age, cause) {
  const n = name.toUpperCase();
  switch (cause) {
    case 'lightning': return `${n} struck down, age ${age}`;
    case 'heron':     return `${n} taken by heron, age ${age}`;
    case 'chupacabra': return `${n} fell to the chupacabra`;
    case 'sasquatch': return `${n} fell to sasquatch`;
    case 'alien':     return `${n} vaporized, age ${age}`;
    case 'ufo':       return `${n} taken, age ${age}`;
    case 'hunter':    return `${n} taken by hunters`;
    case 'fire':      return `${n} lost to fire, age ${age}`;
    case 'tornado':   return `${n} swept away, age ${age}`;
    case 'hurricane': return `${n} lost to the storm`;
    case 'starvation': return `${n} starved, age ${age}`;
    case 'fight':     return `${n} fell in a fight`;
    case 'old age':
    default:          return `${n} died, age ${age}`;
  }
}

function _causeColor(cause) {
  switch (cause) {
    case 'lightning':  return '#e8e860';
    case 'fire':       return '#e87020';
    case 'heron':      return '#a0c0e0';
    case 'ufo':
    case 'alien':      return '#40ff80';
    case 'chupacabra':
    case 'sasquatch':  return '#cc80cc';
    case 'hunter':     return '#e05050';
    default:           return '#cce0b8';
  }
}

// --- Notable Moments ---

export function addMoment(state, { text, x, y, color }) {
  state.moments.push({
    text:    text,
    x:       x,   // null = draw centered
    y:       y,   // null = draw at fixed vertical position
    life:    MOMENT_LIFE,
    maxLife: MOMENT_LIFE,
    color:   color || '#cce0b8',
  });
}

export function updateMoments(state, dt) {
  for (let i = state.moments.length - 1; i >= 0; i--) {
    state.moments[i].life -= dt;
    if (state.moments[i].life <= 0) {
      state.moments.splice(i, 1);
    }
  }
}

export function renderMoments(ctx, state, drawPixelText, canvasW, canvasH) {
  for (const m of state.moments) {
    const frac = m.life / m.maxLife;          // 1 → 0
    const elapsed = m.maxLife - m.life;        // 0 → maxLife

    // Float upward ~10px over lifetime
    const floatOffset = (1 - frac) * 10;

    // Opacity: full for first 3s, fade over last 1s
    const fadeStart = 1.0; // seconds remaining when fade begins
    const alpha = m.life > fadeStart ? 1.0 : m.life / fadeStart;

    if (alpha <= 0) continue;

    // Position — null means auto-center
    const charW = 4; // drawPixelText: 3px char + 1px gap
    const textW = m.text.length * charW;
    const baseX = m.x != null ? Math.floor(m.x - textW / 2)
                              : Math.floor(canvasW / 2 - textW / 2);
    // Stack multiple moments vertically so they don't overlap
    const idx = state.moments.indexOf(m);
    const stackOffset = idx * 9; // 9px between stacked moments
    const baseY = m.y != null ? Math.floor(m.y - floatOffset)
                              : Math.floor(canvasH * 0.25 - floatOffset - stackOffset);

    ctx.globalAlpha = alpha;

    // Shadow pass — 1px dark offset for readability
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    drawPixelText(ctx, m.text, baseX + 1, baseY + 1);

    // Main text
    ctx.fillStyle = m.color;
    drawPixelText(ctx, m.text, baseX, baseY);

    ctx.globalAlpha = 1;
  }
}

// Stub — toggle is handled via HTML/CSS in v1
export function renderObituaryHUD(ctx, state, drawPixelText) {
  // v1: no canvas-drawn HUD; the toggle button is in index.html
}

// --- Persistence ---

export function loadObituary() {
  try {
    const raw = localStorage.getItem(OB_KEY);
    if (!raw) return createObituaryState();
    const parsed = JSON.parse(raw);
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      moments: [], // moments are ephemeral — never persisted
    };
  } catch (e) {
    return createObituaryState();
  }
}

export function saveObituary(state) {
  try {
    localStorage.setItem(OB_KEY, JSON.stringify({ entries: state.entries }));
  } catch (e) {}
}

// --- Panel HTML helper (called once from main.js after DOM ready) ---
// Builds the obituary entry list inside the panel element.
export function renderObituaryPanel(state) {
  const list = document.getElementById('obituary-list');
  if (!list) return;
  if (state.entries.length === 0) {
    list.innerHTML = '<div class="obit-empty">no deaths recorded yet</div>';
    return;
  }
  list.innerHTML = state.entries.map(e => {
    const name  = e.name || `unnamed ${e.stage}`;
    const cause = e.cause || 'unknown';
    const age   = e.age != null ? `${e.age} days` : '';
    let line1 = name.toUpperCase();
    let line2Parts = [];
    if (age) line2Parts.push(age);
    line2Parts.push(_causePhrase(cause));
    return `<div class="obit-entry">
      <div class="obit-name">${_escHtml(line1)}</div>
      <div class="obit-detail">${_escHtml(line2Parts.join(' · '))}</div>
    </div>`;
  }).join('');
}

function _causePhrase(cause) {
  switch (cause) {
    case 'old age':    return 'old age';
    case 'heron':      return 'taken by heron';
    case 'chupacabra': return 'fell to chupacabra';
    case 'sasquatch':  return 'fell to sasquatch';
    case 'lightning':  return 'struck by lightning';
    case 'fire':       return 'lost to fire';
    case 'tornado':    return 'swept away';
    case 'hurricane':  return 'lost to hurricane';
    case 'ufo':        return 'abducted';
    case 'alien':      return 'vaporized';
    case 'hunter':     return 'taken by hunters';
    case 'fight':      return 'fell in a fight';
    case 'starvation': return 'starved';
    default:           return cause;
  }
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
