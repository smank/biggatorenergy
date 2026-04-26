// inspector.js — tap-to-inspect gator overlay
// Opens a field-note card when the player clicks/taps a gator on canvas.

let _canvas = null;
let _world = null;
let _GATOR_STAGES = null;
let _overlay = null;
let _card = null;

export function initInspector({ canvas, world, GATOR_STAGES }) {
  _canvas = canvas;
  _world = world;
  _GATOR_STAGES = GATOR_STAGES;
  _overlay = document.getElementById('inspector-overlay');
  _card = document.getElementById('inspector-card');

  if (!_overlay || !_card) return;

  // Close on backdrop click (but not on card itself)
  _overlay.addEventListener('pointerdown', (e) => {
    if (e.target === _overlay) closeInspector();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !_overlay.classList.contains('hidden')) {
      closeInspector();
    }
  });
}

export function closeInspector() {
  if (_overlay) _overlay.classList.add('hidden');
}

// Convert raw pointer event coords to canvas logical pixel coords
function toCanvasCoords(clientX, clientY) {
  const rect = _canvas.getBoundingClientRect();
  const scaleX = _canvas.width / rect.width;
  const scaleY = _canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

// Hit-test all gators; return the one with largest sizeScale that contains (cx, cy)
function hitTest(cx, cy) {
  let best = null;
  let bestScale = -1;

  for (const [id, tr, gator] of _world.query('transform', 'gator')) {
    const scale = gator.sizeScale || 1;
    const w = (gator.spriteW || 10) * scale;
    const h = (gator.spriteH || 5) * scale;
    // tr.x, tr.y is the top-left of the sprite bounding box
    if (cx >= tr.x && cx <= tr.x + w && cy >= tr.y && cy <= tr.y + h) {
      if (scale > bestScale) {
        bestScale = scale;
        best = { id, tr, gator };
      }
    }
  }
  return best;
}

function describeTrait(t) {
  if (!t) return 'unremarkable';
  const labels = [];
  if (t.maxSize > 1.1) labels.push('big');
  else if (t.maxSize < 0.9) labels.push('runty');
  if (t.speed > 1.15) labels.push('fast');
  else if (t.speed < 0.85) labels.push('slow');
  if (t.aggression > 0.65) labels.push('mean');
  else if (t.aggression < 0.35) labels.push('docile');
  if (t.fertility > 0.6) labels.push('fertile');
  return labels.length ? labels.join(' · ') : 'unremarkable';
}

function buildCard(gator) {
  const name = (gator.name && gator.name.trim()) ? gator.name.toUpperCase() : 'unnamed';
  const sexSymbol = gator.sex === 'male' ? '♂' : '♀';
  const stage = gator.stage || 'adult';
  const ageDays = Math.floor((gator.age || 0) / 60);
  const gen = gator.generation || 0;
  const origin = gator.founder === true ? 'founder' : 'descendant';
  const traits = describeTrait(gator.traits);
  const meals = gator.mealCount || 0;
  // Health as percentage, clamped 0-100
  const healthPct = Math.round(Math.max(0, Math.min(1, gator.health || 0)) * 100);
  const golden = gator.golden ? ' ✦' : '';

  // Meal/kill stat phrasing
  let statLine = '';
  if (meals === 0) {
    statLine = 'has eaten nothing.';
  } else if (meals === 1) {
    statLine = 'ate once.';
  } else {
    statLine = `ate ${meals}.`;
  }

  const html = `
    <div class="inspector-name">${name}${golden}</div>
    <div class="inspector-byline">${sexSymbol} ${stage} · ${ageDays} days · gen ${gen}</div>
    <div class="inspector-origin">${origin}</div>
    <div class="inspector-traits">${traits}</div>
    <div class="inspector-stats">${statLine} health: ${healthPct}%</div>
    <div class="inspector-rename">
      <input
        type="text"
        id="inspector-rename-input"
        class="inspector-rename-input"
        maxlength="24"
        placeholder="give them a name"
        value="${gator.name ? gator.name : ''}"
        autocomplete="off"
        spellcheck="false"
      />
      <button type="button" class="inspector-save-btn" id="inspector-save-btn">save</button>
    </div>
    <button type="button" class="inspector-close-btn" id="inspector-close-btn">close</button>
  `;

  _card.innerHTML = html;

  const saveBtn = document.getElementById('inspector-save-btn');
  const closeBtn = document.getElementById('inspector-close-btn');
  const input = document.getElementById('inspector-rename-input');

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newName = input ? input.value.trim().slice(0, 24) : '';
      gator.name = newName || undefined;
      closeInspector();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeInspector);
  }

  // Also allow Enter key in input to save
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (saveBtn) saveBtn.click();
      }
    });
  }
}

export function openInspectorAt(clientX, clientY) {
  if (!_canvas || !_world || !_overlay || !_card) return;

  const { x: cx, y: cy } = toCanvasCoords(clientX, clientY);
  const hit = hitTest(cx, cy);
  if (!hit) return;

  buildCard(hit.gator);
  _overlay.classList.remove('hidden');

  // Focus the rename input after a tick so it's in the DOM
  requestAnimationFrame(() => {
    const input = document.getElementById('inspector-rename-input');
    if (input) input.focus();
  });
}
