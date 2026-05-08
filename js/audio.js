// Procedural ambient audio — all generated via Web Audio API, no files
// Cricket chirps, frog croaks, bird calls, rain, thunder, water ambience

let ctx = null;
let started = false;
let masterGain = null;
let muted = false;

// Epoch — swamp maturity stage (0-4)
let epoch = 0;

export function setEpoch(e) {
  epoch = e;
}

// State
let ambientDrone = null;
let rainNode = null;
let rainGain = null;

let audioUnavailable = false;
let listenersAttached = false;

export function initAudio() {
  if (listenersAttached) return;
  listenersAttached = true;
  // Persistent listeners — retry on every interaction
  // In-app browsers (Instagram, TikTok) often swallow the first event
  for (const evt of ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown']) {
    document.addEventListener(evt, resumeAudio, { passive: true });
  }
}

export function resumeAudio() {
  if (audioUnavailable) return;
  if (!ctx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API unavailable');
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.3;
      masterGain.connect(ctx.destination);
    } catch (e) {
      audioUnavailable = true;
      if (typeof console !== 'undefined') console.warn('[bge] audio unavailable:', e.message);
      return;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!started && ctx.state === 'running') {
    started = true;
    try { startAmbientDrone(); } catch (e) { /* keep audio ctx alive even if drone fails */ }
  }
}

export function toggleMute() {
  muted = !muted;
  if (masterGain) {
    masterGain.gain.value = muted ? 0 : 0.3;
  }
  return muted;
}

export function isMuted() {
  return muted;
}

// --- Utility ---
function createNoise(duration) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playTone(freq, duration, gain = 0.05, type = 'sine', detune = 0) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// --- Ambient Drone (low swamp hum) ---
function startAmbientDrone() {
  if (!ctx) return;

  // Base drone oscillators (always present)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const baseGain = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 55; // deep A
  osc2.type = 'sine';
  osc2.frequency.value = 82.5; // E, a fifth above
  baseGain.gain.value = 0.015;
  osc1.connect(baseGain);
  osc2.connect(baseGain);
  baseGain.connect(masterGain);
  osc1.start();
  osc2.start();

  // Third oscillator — octave up (epoch 1+)
  const osc3 = ctx.createOscillator();
  const thirdGain = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.value = 110;
  thirdGain.gain.value = 0;
  osc3.connect(thirdGain);
  thirdGain.connect(masterGain);
  osc3.start();

  // Sub-bass rumble (epoch 3+)
  const subOsc = ctx.createOscillator();
  const subGain = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.value = 35;
  subGain.gain.value = 0;
  subOsc.connect(subGain);
  subGain.connect(masterGain);
  subOsc.start();

  // High shimmer with tremolo (epoch 4)
  const shimmerOsc = ctx.createOscillator();
  const shimmerGain = ctx.createGain();
  const tremoloOsc = ctx.createOscillator();
  const tremoloGain = ctx.createGain();
  shimmerOsc.type = 'sine';
  shimmerOsc.frequency.value = 440;
  shimmerGain.gain.value = 0;
  // Tremolo: LFO modulating the shimmer gain
  tremoloOsc.type = 'sine';
  tremoloOsc.frequency.value = 2; // slow tremolo
  tremoloGain.gain.value = 0; // depth set by updateDroneForEpoch
  tremoloOsc.connect(tremoloGain);
  tremoloGain.connect(shimmerGain.gain);
  shimmerOsc.connect(shimmerGain);
  shimmerGain.connect(masterGain);
  shimmerOsc.start();
  tremoloOsc.start();

  ambientDrone = {
    osc1, osc2, baseGain,
    osc3, thirdGain,
    subOsc, subGain,
    shimmerOsc, shimmerGain, tremoloOsc, tremoloGain
  };

  updateDroneForEpoch();
}

function updateDroneForEpoch() {
  if (!ambientDrone || !ctx) return;
  const t = ctx.currentTime + 2; // smooth 2s transition
  const d = ambientDrone;

  if (epoch === 0) {
    d.baseGain.gain.linearRampToValueAtTime(0.015, t);
    d.thirdGain.gain.linearRampToValueAtTime(0, t);
    d.subGain.gain.linearRampToValueAtTime(0, t);
    d.shimmerGain.gain.linearRampToValueAtTime(0, t);
    d.tremoloGain.gain.linearRampToValueAtTime(0, t);
  } else if (epoch === 1) {
    d.baseGain.gain.linearRampToValueAtTime(0.025, t);
    d.thirdGain.gain.linearRampToValueAtTime(0.01, t);
    d.subGain.gain.linearRampToValueAtTime(0, t);
    d.shimmerGain.gain.linearRampToValueAtTime(0, t);
    d.tremoloGain.gain.linearRampToValueAtTime(0, t);
  } else if (epoch === 2) {
    d.baseGain.gain.linearRampToValueAtTime(0.03, t);
    d.thirdGain.gain.linearRampToValueAtTime(0.015, t);
    d.subGain.gain.linearRampToValueAtTime(0, t);
    d.shimmerGain.gain.linearRampToValueAtTime(0, t);
    d.tremoloGain.gain.linearRampToValueAtTime(0, t);
  } else if (epoch === 3) {
    d.baseGain.gain.linearRampToValueAtTime(0.035, t);
    d.thirdGain.gain.linearRampToValueAtTime(0.015, t);
    d.subGain.gain.linearRampToValueAtTime(0.02, t);
    d.shimmerGain.gain.linearRampToValueAtTime(0, t);
    d.tremoloGain.gain.linearRampToValueAtTime(0, t);
  } else if (epoch >= 4) {
    d.baseGain.gain.linearRampToValueAtTime(0.04, t);
    d.thirdGain.gain.linearRampToValueAtTime(0.02, t);
    d.subGain.gain.linearRampToValueAtTime(0.025, t);
    d.shimmerGain.gain.linearRampToValueAtTime(0.008, t);
    d.tremoloGain.gain.linearRampToValueAtTime(0.004, t);
  }
}

// --- Cricket Chirp ---
export function playCricket() {
  if (!ctx) return;
  const freq = 4000 + Math.random() * 2000;
  const chirps = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chirps; i++) {
    const t = ctx.currentTime + i * 0.08;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }
}

// --- Frog Croak ---
export function playFrogCroak() {
  if (!ctx) return;
  const baseFreq = 80 + Math.random() * 120;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(baseFreq, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}

// --- Bird Call ---
export function playBirdCall() {
  if (!ctx) return;
  const baseFreq = 1200 + Math.random() * 1500;
  const notes = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < notes; i++) {
    const t = ctx.currentTime + i * 0.12;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const noteFreq = baseFreq * (1 + (Math.random() - 0.5) * 0.3);
    osc.frequency.setValueAtTime(noteFreq, t);
    osc.frequency.exponentialRampToValueAtTime(noteFreq * (0.8 + Math.random() * 0.4), t + 0.1);
    g.gain.setValueAtTime(0.02, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.12);
  }
}

// --- Splash ---
export function playSplash(intensity = 0.5) {
  if (!ctx) return;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(0.3);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06 * intensity, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  noise.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  noise.start();
}

// --- Thunder ---
export function playThunder(distance = 0.5) {
  if (!ctx) return;
  duckAudioBriefly();
  // distance 0 = close (loud), 1 = far (quiet, delayed)
  const delay = distance * 1.5;
  const t = ctx.currentTime + delay;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(2);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 150 + (1 - distance) * 200;
  const g = ctx.createGain();
  const vol = 0.12 * (1 - distance * 0.7);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.05);
  g.gain.setValueAtTime(vol, t + 0.1);
  g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.5 + distance);
  noise.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  noise.start(t);
  noise.stop(t + 2 + distance);
}

// --- Rain ---
export function setRain(intensity) {
  if (!ctx) return;
  if (intensity <= 0) {
    if (rainGain) {
      rainGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1);
    }
    return;
  }
  if (!rainNode) {
    rainNode = ctx.createBufferSource();
    rainNode.buffer = createNoise(3);
    rainNode.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 0.5;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainNode.connect(filter);
    filter.connect(rainGain);
    rainGain.connect(masterGain);
    rainNode.start();
  }
  rainGain.gain.linearRampToValueAtTime(intensity * 0.08, ctx.currentTime + 0.5);
}

// --- Raygun Zap ---
export function playZap() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(2000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// --- Death/Eat crunch ---
export function playEat() {
  if (!ctx) return;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(0.1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  noise.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  noise.start();
}

// --- Low death tone ---
export function playDeathTone() {
  if (!ctx) return;
  playTone(65, 1.5, 0.03, 'sine');
  playTone(82, 1.5, 0.02, 'sine');
}

// --- UFO hum ---
let ufoOsc = null;
let ufoGain = null;
export function setUFO(active) {
  if (!ctx) return;
  if (active && !ufoOsc) {
    ufoOsc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    ufoGain = ctx.createGain();
    ufoOsc.type = 'sine';
    ufoOsc.frequency.value = 220;
    osc2.type = 'sine';
    osc2.frequency.value = 223; // slight detune = wobble
    ufoGain.gain.value = 0.03;
    ufoOsc.connect(ufoGain);
    osc2.connect(ufoGain);
    ufoGain.connect(masterGain);
    ufoOsc.start();
    osc2.start();
    ufoOsc._pair = osc2;
  } else if (!active && ufoOsc) {
    ufoGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    ufoOsc.stop(ctx.currentTime + 0.6);
    ufoOsc._pair.stop(ctx.currentTime + 0.6);
    ufoOsc = null;
    ufoGain = null;
  }
}

// --- Explosion ---
export function playExplosion() {
  if (!ctx) return;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(1);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.15, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
  noise.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  noise.start();
}

// --- Bullfrog (deep croak, epoch 3+) ---
function playBullfrog() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(50, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.4);
  g.gain.setValueAtTime(0.03, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.55);
}

// --- Deep Call (ethereal whale-like sweep, epoch 4) ---
function playDeepCall() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  // Vibrato LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 2);
  lfo.type = 'sine';
  lfo.frequency.value = 4;
  lfoGain.gain.value = 3; // slight vibrato depth in Hz
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  g.gain.setValueAtTime(0.015, ctx.currentTime);
  g.gain.setValueAtTime(0.015, ctx.currentTime + 1.5);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  lfo.start();
  osc.stop(ctx.currentTime + 2.1);
  lfo.stop(ctx.currentTime + 2.1);
}

// --- Gator Stare (subtle low drone) ---
export function playGatorStare() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 60;
  g.gain.setValueAtTime(0.01, ctx.currentTime);
  g.gain.setValueAtTime(0.01, ctx.currentTime + 0.7);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 1.05);
}

// --- Egg Hatch (quick high chirp) ---
export function playEggHatch() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(2000, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.02, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(g);
  g.connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// --- Duck Audio Briefly (thunder compression effect) ---
export function duckAudioBriefly() {
  if (!ctx || !masterGain) return;
  const savedGain = muted ? 0 : 0.3;
  masterGain.gain.setValueAtTime(0.1, ctx.currentTime);
  masterGain.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
  masterGain.gain.linearRampToValueAtTime(savedGain, ctx.currentTime + 0.8);
}

// ============================================================
// ACTION SFX
// ============================================================

// --- Tail Slap — sharp wet thwack ---
export function playTailSlap() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  // Low thud body
  const thudOsc = ctx.createOscillator();
  const thudGain = ctx.createGain();
  thudOsc.type = 'sine';
  thudOsc.frequency.setValueAtTime(120, now);
  thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
  thudGain.gain.setValueAtTime(0.07, now);
  thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  thudOsc.connect(thudGain);
  thudGain.connect(masterGain);
  thudOsc.start(now);
  thudOsc.stop(now + 0.22);
  // High splash burst
  const splash = ctx.createBufferSource();
  splash.buffer = createNoise(0.15);
  const splashFilter = ctx.createBiquadFilter();
  splashFilter.type = 'bandpass';
  splashFilter.frequency.value = 3500;
  splashFilter.Q.value = 1.2;
  const splashGain = ctx.createGain();
  splashGain.gain.setValueAtTime(0.06, now);
  splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  splash.connect(splashFilter);
  splashFilter.connect(splashGain);
  splashGain.connect(masterGain);
  splash.start(now);
}

// --- Bellow — deep growling roar with vibrato and filter sweep ---
export function playBellow(intensity = 1) {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const dur = 1.5;
  // Main roar oscillator
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  // Vibrato LFO
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.3);
  osc.frequency.linearRampToValueAtTime(55, now + dur);
  lfo.type = 'sine';
  lfo.frequency.value = 5.5;
  lfoGain.gain.value = 6; // Hz vibrato depth
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  // Filter sweep: start mid, drop to subby
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.frequency.linearRampToValueAtTime(180, now + dur);
  filter.Q.value = 1.5;
  const vol = 0.055 * Math.min(1, intensity);
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(vol, now + 0.08);
  oscGain.gain.setValueAtTime(vol, now + dur - 0.3);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(filter);
  filter.connect(oscGain);
  oscGain.connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.05);
  lfo.start(now);
  lfo.stop(now + dur + 0.05);
  // Sub layer
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.value = 45;
  subGain.gain.setValueAtTime(0.03 * intensity, now);
  subGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.8);
  sub.connect(subGain);
  subGain.connect(masterGain);
  sub.start(now);
  sub.stop(now + dur);
}

// --- Bite — quick wet snap, <100ms ---
export function playBite() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(0.08);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.07, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  noise.start(now);
  // Teeth-click transient
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'square';
  click.frequency.setValueAtTime(600, now);
  click.frequency.exponentialRampToValueAtTime(200, now + 0.04);
  clickGain.gain.setValueAtTime(0.04, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  click.connect(clickGain);
  clickGain.connect(masterGain);
  click.start(now);
  click.stop(now + 0.06);
}

// --- Growl — short angry sub-vocal, ~0.6s ---
export function playGrowl() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const dur = 0.6;
  const osc = ctx.createOscillator();
  const distortion = ctx.createWaveShaper();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(70, now);
  osc.frequency.linearRampToValueAtTime(55, now + dur);
  // Soft clip for gritty texture
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const x = (i * 2) / 256 - 1;
    curve[i] = Math.tanh(x * 2.5);
  }
  distortion.curve = curve;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.035, now + 0.05);
  g.gain.setValueAtTime(0.035, now + dur - 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(distortion);
  distortion.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + dur + 0.05);
}

// --- Mate — low rumble, slow, peaceful, ~2s ---
export function playMate() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const dur = 2.0;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 68;
  osc2.type = 'sine';
  osc2.frequency.value = 73; // slight beat frequency for warmth
  lfo.type = 'sine';
  lfo.frequency.value = 1.2; // very slow, restful vibrato
  lfoGain.gain.value = 2;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.025, now + 0.4);
  g.gain.setValueAtTime(0.025, now + dur - 0.5);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(g);
  osc2.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc2.start(now);
  osc.stop(now + dur + 0.1);
  osc2.stop(now + dur + 0.1);
  lfo.start(now);
  lfo.stop(now + dur + 0.1);
}

// --- Hatch — tiny chirp + crack (enhanced version of playEggHatch) ---
export function playHatch() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  // Shell crack — short noise transient
  const crack = ctx.createBufferSource();
  crack.buffer = createNoise(0.05);
  const crackFilter = ctx.createBiquadFilter();
  crackFilter.type = 'highpass';
  crackFilter.frequency.value = 2000;
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0.04, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  crack.connect(crackFilter);
  crackFilter.connect(crackGain);
  crackGain.connect(masterGain);
  crack.start(now);
  // Tiny hatchling chirp — two notes
  for (let i = 0; i < 2; i++) {
    const t = now + 0.04 + i * 0.07;
    const chirp = ctx.createOscillator();
    const chirpGain = ctx.createGain();
    chirp.type = 'sine';
    chirp.frequency.setValueAtTime(2800 + i * 300, t);
    chirp.frequency.exponentialRampToValueAtTime(2000 + i * 200, t + 0.06);
    chirpGain.gain.setValueAtTime(0.018, t);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    chirp.connect(chirpGain);
    chirpGain.connect(masterGain);
    chirp.start(t);
    chirp.stop(t + 0.08);
  }
}

// --- Goal Complete — soft two-tone chime at a 5th interval ---
export function playGoalComplete() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const freqs = [523.25, 784]; // C5, G5 — a perfect fifth
  freqs.forEach((freq, i) => {
    const t = now + i * 0.12;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.38);
    // Subtle overtone shimmer
    const overtone = ctx.createOscillator();
    const og = ctx.createGain();
    overtone.type = 'sine';
    overtone.frequency.value = freq * 2;
    og.gain.setValueAtTime(0.006, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    overtone.connect(og);
    og.connect(masterGain);
    overtone.start(t);
    overtone.stop(t + 0.22);
  });
}

// --- Starving Heartbeat — muffled slow thump-thump, loops while active ---
let _heartbeatNode = null;
let _heartbeatGain = null;
let _heartbeatInterval = null;

function _playHeartbump() {
  if (!ctx || !masterGain) return;
  // Double thump: lub-dub
  [0, 0.18].forEach(offset => {
    const t = ctx.currentTime + offset;
    const noise = ctx.createBufferSource();
    noise.buffer = createNoise(0.12);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    noise.connect(filter);
    filter.connect(g);
    g.connect(masterGain);
    noise.start(t);
  });
}

export function startStarvingHeartbeat() {
  if (!ctx || isMuted()) return;
  if (_heartbeatInterval !== null) return; // already running
  _playHeartbump();
  _heartbeatInterval = setInterval(() => {
    if (!ctx || isMuted()) return;
    _playHeartbump();
  }, 1200); // ~50 bpm — slow, ominous
}

export function stopStarvingHeartbeat() {
  if (_heartbeatInterval !== null) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

// --- Era Transition — slow atmospheric swell, one-shot ~3s ---
export function playEraTransition() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const dur = 3.0;
  // Bass swell
  const bass = ctx.createOscillator();
  const bassGain = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(40, now);
  bass.frequency.linearRampToValueAtTime(55, now + dur * 0.6);
  bass.frequency.linearRampToValueAtTime(40, now + dur);
  bassGain.gain.setValueAtTime(0, now);
  bassGain.gain.linearRampToValueAtTime(0.03, now + 0.8);
  bassGain.gain.setValueAtTime(0.03, now + dur - 0.6);
  bassGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  bass.connect(bassGain);
  bassGain.connect(masterGain);
  bass.start(now);
  bass.stop(now + dur + 0.1);
  // Mid shimmer — two detuned sines swell in
  [220, 330].forEach((freq, i) => {
    const t = now + i * 0.2;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = (i === 0 ? -8 : 8);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012, t + 1.0);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(now + dur + 0.1);
  });
  // High harmonic breath — noise filtered to airy top
  const breath = ctx.createBufferSource();
  breath.buffer = createNoise(dur);
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = 1800;
  breathFilter.Q.value = 3;
  const breathGain = ctx.createGain();
  breathGain.gain.setValueAtTime(0, now);
  breathGain.gain.linearRampToValueAtTime(0.008, now + 1.2);
  breathGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  breath.connect(breathFilter);
  breathFilter.connect(breathGain);
  breathGain.connect(masterGain);
  breath.start(now);
}

// ============================================================
// ERA AMBIENT LAYERS
// ============================================================

// Era 2 (Industrial): persistent machinery hum + occasional sounds
let _industrialHumNode = null;
let _industrialHumGain = null;
let _industrialCrankTimer = 0;
let _trainTimer = 0;
let _currentEraId = 1;

function _startIndustrialHum() {
  if (!ctx || _industrialHumNode) return;
  // Low-frequency machinery rumble (40–60 Hz looped noise + sine)
  const rumble = ctx.createOscillator();
  const rumbleGain = ctx.createGain();
  rumble.type = 'sawtooth';
  rumble.frequency.value = 52;
  rumbleGain.gain.value = 0.008;
  rumble.connect(rumbleGain);
  rumbleGain.connect(masterGain);
  rumble.start();

  const humNoise = ctx.createBufferSource();
  humNoise.buffer = createNoise(4);
  humNoise.loop = true;
  const humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 180;
  _industrialHumGain = ctx.createGain();
  _industrialHumGain.gain.value = 0.012;
  humNoise.connect(humFilter);
  humFilter.connect(_industrialHumGain);
  _industrialHumGain.connect(masterGain);
  humNoise.start();

  _industrialHumNode = { rumble, rumbleGain, humNoise };
}

function _stopIndustrialHum() {
  if (!_industrialHumNode || !ctx) return;
  const t = ctx.currentTime + 2;
  if (_industrialHumGain) _industrialHumGain.gain.linearRampToValueAtTime(0.001, t);
  try {
    _industrialHumNode.rumble.stop(t + 0.1);
    _industrialHumNode.humNoise.stop(t + 0.1);
  } catch (e) { /* already stopped */ }
  _industrialHumNode = null;
  _industrialHumGain = null;
}

function _playMetalClank() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  // Short metallic transient: highpass noise with ring
  const noise = ctx.createBufferSource();
  noise.buffer = createNoise(0.18);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1200;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.02, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  noise.connect(hp);
  hp.connect(ng);
  ng.connect(masterGain);
  noise.start(now);
  // Ring tone
  const ring = ctx.createOscillator();
  const rg = ctx.createGain();
  ring.type = 'sine';
  ring.frequency.value = 900 + Math.random() * 400;
  rg.gain.setValueAtTime(0.012, now);
  rg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  ring.connect(rg);
  rg.connect(masterGain);
  ring.start(now);
  ring.stop(now + 0.25);
}

function _playDistantTrain() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  const dur = 2.5;
  // Distant train whistle — two overlapping harmonics, very quiet
  [440, 550].forEach((freq, i) => {
    const t = now + i * 0.08;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.linearRampToValueAtTime(freq * 0.92, t + dur); // Doppler drift
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.012, t + 0.3);
    g.gain.setValueAtTime(0.012, t + dur - 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  });
}

function _playDistantHeron() {
  if (!ctx || isMuted()) return;
  const now = ctx.currentTime;
  // Great blue heron — a flat, raspy croak: braaak
  for (let i = 0; i < 3; i++) {
    const t = now + i * 0.18;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.12);
    g.gain.setValueAtTime(0.015, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }
}

// Called from main.js when era changes in dynasty mode
export function setEraAmbient(eraId) {
  _currentEraId = eraId;
  if (eraId >= 2) {
    if (!_industrialHumNode && ctx && started) _startIndustrialHum();
  } else {
    _stopIndustrialHum();
  }
  // Reset per-era sound timers
  _industrialCrankTimer = 8 + Math.random() * 10;
  _trainTimer = 20 + Math.random() * 30;
  _heronTimer = 15 + Math.random() * 25;
}

// --- Ambient sound scheduler (called from game loop) ---
let cricketTimer = 2;
let frogTimer = 3;
let birdTimer = 5;
let bullfrogTimer = 8;
let deepCallTimer = 15;
let _heronTimer = 15;

export function updateAudio(dt, env, simTime) {
  if (!ctx || !started || muted) return;

  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;
  const isDusk = (env.timeOfDay > 0.7 && env.timeOfDay < 0.85) || (env.timeOfDay > 0.15 && env.timeOfDay < 0.25);

  // Industrial era suppresses frog life (pollution)
  const isIndustrial = _currentEraId >= 2;
  const frogMult = isIndustrial ? 0.35 : 1.0;

  // Epoch-scaled interval helpers
  // lerp from sparse (epoch 0) to dense (epoch 4)
  const epochFactor = epoch / 4; // 0..1

  // Crickets — mostly at night and dusk
  cricketTimer -= dt;
  if (cricketTimer <= 0) {
    if (isNight || isDusk) {
      playCricket();
      // epoch 0: 2-5s, epoch 4: 0.3-1s
      const lo = 2 - epochFactor * 1.7;   // 2 -> 0.3
      const hi = 5 - epochFactor * 4;     // 5 -> 1
      cricketTimer = lo + Math.random() * (hi - lo);
    } else {
      cricketTimer = (3 + Math.random() * 5) * (1 - epochFactor * 0.5);
    }
  }

  // Frogs — dusk and night, near water; suppressed in industrial era
  frogTimer -= dt;
  if (frogTimer <= 0) {
    if ((isNight || isDusk || env.weather === 'rain') && Math.random() < frogMult) {
      playFrogCroak();
      // epoch 0: 3-8s, epoch 4: 0.5-2s
      const lo = 3 - epochFactor * 2.5;   // 3 -> 0.5
      const hi = 8 - epochFactor * 6;     // 8 -> 2
      frogTimer = (lo + Math.random() * (hi - lo)) * (isIndustrial ? 2.5 : 1);
    } else {
      frogTimer = (5 + Math.random() * 10) * (1 - epochFactor * 0.5) * (isIndustrial ? 2 : 1);
    }
  }

  // Bullfrog — epoch 3+ only
  if (epoch >= 3) {
    bullfrogTimer -= dt;
    if (bullfrogTimer <= 0) {
      if ((isNight || isDusk) && !isIndustrial) {
        playBullfrog();
      }
      bullfrogTimer = 4 + Math.random() * 8;
    }
  }

  // Deep call — epoch 4 only
  if (epoch >= 4) {
    deepCallTimer -= dt;
    if (deepCallTimer <= 0) {
      playDeepCall();
      deepCallTimer = 10 + Math.random() * 20;
    }
  }

  // Birds — daytime
  birdTimer -= dt;
  if (birdTimer <= 0) {
    if (!isNight) {
      playBirdCall();
      birdTimer = 3 + Math.random() * 8;
    } else {
      birdTimer = 10 + Math.random() * 15;
    }
  }

  // Era 1 (Primordial): occasional distant heron call
  if (!isIndustrial) {
    _heronTimer -= dt;
    if (_heronTimer <= 0) {
      if (!isNight) _playDistantHeron();
      _heronTimer = 20 + Math.random() * 40;
    }
  }

  // Era 2 (Industrial): metal clanks + train whistle
  if (isIndustrial) {
    _industrialCrankTimer -= dt;
    if (_industrialCrankTimer <= 0) {
      _playMetalClank();
      _industrialCrankTimer = 6 + Math.random() * 14;
    }
    _trainTimer -= dt;
    if (_trainTimer <= 0) {
      _playDistantTrain();
      _trainTimer = 25 + Math.random() * 45;
    }
  }

  // Rain ambience
  setRain(env.rainIntensity || 0);

  // Update drone layers for current epoch
  updateDroneForEpoch();
}
