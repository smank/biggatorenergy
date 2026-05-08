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
// Builds the Swamp Gazette newspaper inside the panel element.
export function renderObituaryPanel(state) {
  const panel = document.getElementById('obituary-panel');
  if (!panel) return;

  const totalDeaths = state.entries.length;

  // Compute era (Vol.) from the highest generation seen, clamped to roman numeral range
  const maxGen = state.entries.reduce((m, e) => Math.max(m, e.generation || 0), 0);
  const vol = _toRoman(Math.max(1, maxGen));

  // Edition line — no. is the total death count
  const editionLine = `Vol. ${vol} &middot; No. ${totalDeaths}`;

  // Masthead HTML (replaces obit-header text via DOM; we rebuild everything below)
  const mastheadHtml = `
    <div class="gazette-masthead">
      <div class="gazette-title">The Swamp Gazette</div>
      <div class="gazette-edition">${editionLine}</div>
    </div>`;

  // Entries
  let bodyHtml = '';

  if (totalDeaths === 0) {
    bodyHtml = `<div class="gazette-empty">No news from the bayou. Yet.</div>`;
  } else {
    const FULL_COUNT = 5; // first N get the full obit treatment

    bodyHtml = '<div class="gazette-section-label">Obituaries</div>';

    state.entries.forEach((e, idx) => {
      const name  = (e.name || `Unnamed ${e.stage || 'gator'}`).toUpperCase();
      const age   = e.age != null ? e.age : '?';
      const cause = e.cause || 'unknown';
      const phrase = _causePhrase(cause);
      const dateStamp = _relativeDate(e.deathTime);

      if (idx < FULL_COUNT) {
        // Full obituary treatment
        const ageDesc = e.sex && e.sex !== 'unknown'
          ? `${age} days. ${e.sex === 'female' ? 'She' : 'He'} ${_genDesc(e)}.`
          : `${age} days.`;
        bodyHtml += `
          <div class="gazette-entry gazette-entry-full${idx > 0 ? ' gazette-entry-ruled' : ''}">
            <div class="gazette-entry-header">
              <span class="gazette-entry-name">${_escHtml(name)}</span>
            </div>
            <div class="gazette-entry-lede">${_escHtml(name)}, ${_escHtml(ageDesc)}</div>
            <div class="gazette-entry-cause">${_escHtml(phrase)}</div>
            <div class="gazette-entry-date">${_escHtml(dateStamp)}</div>
          </div>`;
      } else {
        // Classified-ad treatment for older entries
        if (idx === FULL_COUNT) {
          bodyHtml += `<div class="gazette-classifieds-header">&#xB7;&#xB7;&#xB7; Earlier Notices &#xB7;&#xB7;&#xB7;</div>`;
        }
        const opacity = Math.max(0.35, 1 - (idx - FULL_COUNT) * 0.07);
        bodyHtml += `
          <div class="gazette-entry gazette-entry-classified" style="opacity:${opacity.toFixed(2)}">
            <span class="gazette-classified-name">${_escHtml(name)}</span>
            <span class="gazette-classified-dot"> &middot; </span>
            <span class="gazette-classified-age">${_escHtml(String(age))} days</span>
            <span class="gazette-classified-dot"> &middot; </span>
            <span class="gazette-classified-cause">${_escHtml(_causeShort(cause))}</span>
          </div>`;
      }
    });
  }

  panel.innerHTML = `
    ${mastheadHtml}
    <div class="gazette-body">
      ${bodyHtml}
    </div>`;
}

// Short cause for classified-ad lines
function _causeShort(cause) {
  switch (cause) {
    case 'old age':    return 'old age';
    case 'heron':      return 'heron';
    case 'chupacabra': return 'chupacabra';
    case 'sasquatch':  return 'sasquatch';
    case 'lightning':  return 'lightning';
    case 'fire':       return 'fire';
    case 'tornado':    return 'tornado';
    case 'hurricane':  return 'hurricane';
    case 'ufo':        return 'ufo';
    case 'alien':      return 'alien';
    case 'hunter':     return 'hunters';
    case 'fight':      return 'territorial dispute';
    case 'starvation': return 'starvation';
    default:           return cause;
  }
}

// Newspaper-prose cause phrases (full entries)
function _causePhrase(cause) {
  switch (cause) {
    case 'old age':    return 'Old age finally caught them.';
    case 'heron':      return 'Taken by heron at the shallows.';
    case 'lightning':  return 'Struck down in a bright moment.';
    case 'fire':       return 'Lost to the flame.';
    case 'tornado':    return 'The wind has them now.';
    case 'hurricane':  return 'Carried off by the storm.';
    case 'ufo':        return 'Witnesses report a beam of light.';
    case 'alien':      return 'Vaporized. Investigators are baffled.';
    case 'hunter':     return 'Shot by a man with a gun.';
    case 'fight':      return 'Killed in a territorial dispute.';
    case 'starvation': return 'Died of hunger. The bayou provides nothing.';
    case 'chupacabra': return 'Drained. The myth persists.';
    case 'sasquatch':  return 'Crushed. Tracks confirm the rumor.';
    default:           return 'Cause unknown. The swamp keeps its secrets.';
  }
}

// Generation descriptor phrase for full entries
function _genDesc(e) {
  const gen = e.generation || 0;
  if (gen === 0) return 'lived in the first era';
  if (gen === 1) return 'was of the first generation';
  return `was of generation ${gen}`;
}

// Relative date stamp from deathTime (game sim-seconds, not wall-clock ms)
// deathTime is simTime (seconds of sim elapsed); we treat it as sim-time only.
// Since we don't have real wall-clock context here, we compare entries by index
// (entry 0 = most recent) and show "today", "yesterday", or "X days ago" by
// comparing deathTime deltas at ~86400 sim-seconds per day.
function _relativeDate(deathTime) {
  if (!deathTime && deathTime !== 0) return '';
  const SIM_DAY = 86400; // sim-seconds per swamp day
  // We'd need "now" to compute relative time. Use Date.now() as wall-clock isn't
  // meaningful here, so we store deathTime as sim-seconds and compare to nothing.
  // Best approximation: deathTime within last day = "today", etc.
  // Since we can't access simTime here, just show the sim-day number.
  const simDay = Math.floor(deathTime / SIM_DAY);
  if (simDay <= 0) return 'early days';
  return `day ${simDay}`;
}

// Convert integer to Roman numeral
function _toRoman(n) {
  if (n <= 0) return 'I';
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}

function _escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
