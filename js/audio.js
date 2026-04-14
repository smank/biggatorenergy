// Procedural ambient audio — all generated via Web Audio API, no files
// Cricket chirps, frog croaks, bird calls, rain, thunder, water ambience

let ctx = null;
let started = false;
let masterGain = null;

// State
let ambientDrone = null;
let rainNode = null;
let rainGain = null;

export function initAudio() {
  // No-op — actual init happens in resumeAudio on first user gesture
  // iOS requires AudioContext creation inside a touch/click handler
}

export function resumeAudio() {
  // Create context on first user interaction (iOS requirement)
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.3;
      masterGain.connect(ctx.destination);
    } catch (e) {
      return; // audio not supported
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  if (!started) {
    started = true;
    startAmbientDrone();
  }
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
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const g = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.value = 55; // deep A
  osc2.type = 'sine';
  osc2.frequency.value = 82.5; // E, a fifth above
  g.gain.value = 0.03;
  osc1.connect(g);
  osc2.connect(g);
  g.connect(masterGain);
  osc1.start();
  osc2.start();
  ambientDrone = { osc1, osc2, gain: g };
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

// --- Ambient sound scheduler (called from game loop) ---
let cricketTimer = 2;
let frogTimer = 3;
let birdTimer = 5;

export function updateAudio(dt, env, simTime) {
  if (!ctx || !started) return;

  const isNight = env.timeOfDay < 0.2 || env.timeOfDay > 0.8;
  const isDusk = (env.timeOfDay > 0.7 && env.timeOfDay < 0.85) || (env.timeOfDay > 0.15 && env.timeOfDay < 0.25);

  // Crickets — mostly at night and dusk
  cricketTimer -= dt;
  if (cricketTimer <= 0) {
    if (isNight || isDusk) {
      playCricket();
      cricketTimer = 0.5 + Math.random() * 2;
    } else {
      cricketTimer = 3 + Math.random() * 5;
    }
  }

  // Frogs — dusk and night, near water
  frogTimer -= dt;
  if (frogTimer <= 0) {
    if (isNight || isDusk || env.weather === 'rain') {
      playFrogCroak();
      frogTimer = 1 + Math.random() * 4;
    } else {
      frogTimer = 5 + Math.random() * 10;
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

  // Drone volume — slightly louder at night
  if (ambientDrone) {
    const targetVol = isNight ? 0.04 : 0.02;
    ambientDrone.gain.gain.linearRampToValueAtTime(targetVol, ctx.currentTime + 1);
  }
}
