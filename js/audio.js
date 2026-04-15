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

export function initAudio() {
  // Set up persistent listeners — retry audio resume on EVERY interaction
  // In-app browsers (Instagram, TikTok) often swallow the first event
  for (const evt of ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown']) {
    document.addEventListener(evt, resumeAudio, { passive: true });
  }
}

export function resumeAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.3;
      masterGain.connect(ctx.destination);
    } catch (e) {
      return;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (!started && ctx.state === 'running') {
    started = true;
    startAmbientDrone();
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

// --- Ambient sound scheduler (called from game loop) ---
let cricketTimer = 2;
let frogTimer = 3;
let birdTimer = 5;
let bullfrogTimer = 8;
let deepCallTimer = 15;

export function updateAudio(dt, env, simTime) {
  if (!ctx || !started || muted) return;

  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;
  const isDusk = (env.timeOfDay > 0.7 && env.timeOfDay < 0.85) || (env.timeOfDay > 0.15 && env.timeOfDay < 0.25);

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

  // Frogs — dusk and night, near water
  frogTimer -= dt;
  if (frogTimer <= 0) {
    if (isNight || isDusk || env.weather === 'rain') {
      playFrogCroak();
      // epoch 0: 3-8s, epoch 4: 0.5-2s
      const lo = 3 - epochFactor * 2.5;   // 3 -> 0.5
      const hi = 8 - epochFactor * 6;     // 8 -> 2
      frogTimer = lo + Math.random() * (hi - lo);
    } else {
      frogTimer = (5 + Math.random() * 10) * (1 - epochFactor * 0.5);
    }
  }

  // Bullfrog — epoch 3+ only
  if (epoch >= 3) {
    bullfrogTimer -= dt;
    if (bullfrogTimer <= 0) {
      if (isNight || isDusk) {
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

  // Rain ambience
  setRain(env.rainIntensity || 0);

  // Update drone layers for current epoch
  updateDroneForEpoch();
}
