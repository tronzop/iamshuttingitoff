let audioCtx = null;
let isMusicOn = false;
let beatTimer = null; // id for scheduled beat
const baseBpm = 90; // starting bpm

let noiseBuffer = null;
let gameOverBuffer = null; // decoded AudioBuffer to play on game over
let gameOverAudioElement = null; // fallback HTMLAudioElement if external asset exists
let screamBuffer = null; // decoded AudioBuffer for close-call scream (scream.mp3)
let screamAudioElement = null; // fallback HTMLAudioElement for scream
let lastScreamTime = 0; // debounce scream playback (min 0.3s between screams)

let pushingBuffer = null; // decoded AudioBuffer for 20-point milestone (pushinglikeananimal.mp3)
let pushingAudioElement = null; // fallback HTMLAudioElement for pushing sound

export function getBpm(elapsed) {
  // tie bpm to time survived (elapsed increases only while running)
  // grows gradually and caps so it doesn't get out of control
  return baseBpm + Math.min(150, elapsed * 1.8);
}

export function createAudio(sfxStatusEl) {
  if (audioCtx) return audioCtx;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  // when the audio context is created (user gesture), attempt to pre-load and decode
  // fallback assets at /assets/gameover.mp3 and /assets/scream.mp3
  loadAudioBufferFromUrl('/assets/gameover.mp3', sfxStatusEl)
    .then((buf) => {
      if (buf) {
        gameOverBuffer = buf;
        console.info('Loaded /assets/gameover.mp3 into AudioBuffer (game-over SFX).');
        if (sfxStatusEl) sfxStatusEl.textContent = 'SFX ready: gameover.mp3';
      }
    })
    .catch(() => {});
  loadAudioBufferFromUrl('/assets/scream.mp3')
    .then((buf) => {
      if (buf) {
        screamBuffer = buf;
        console.info('Loaded /assets/scream.mp3 into AudioBuffer (close-call scream).');
      }
    })
    .catch(() => {});
  loadAudioBufferFromUrl('/assets/pushinglikeananimal.mp3')
    .then((buf) => {
      if (buf) {
        pushingBuffer = buf;
        console.info(
          'Loaded /assets/pushinglikeananimal.mp3 into AudioBuffer (20-point milestone).'
        );
      }
    })
    .catch(() => {});
    
  const storedMusicPref = localStorage.getItem('isMusicOn');
  if (storedMusicPref) {
    try {
      isMusicOn = JSON.parse(storedMusicPref);
    } catch (e) {
      isMusicOn = false;
    }
  }
  return audioCtx;
}

// create a noise buffer for hats/snare
export function createNoiseBuffer() {
  const ctx = createAudio();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function playKick(time = 0) {
  const ctx = createAudio();
  const t = ctx.currentTime + (time || 0.02);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.28);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.35);
}

export function playHat(time = 0, vel = 0.25) {
  const ctx = createAudio();
  const t = ctx.currentTime + (time || 0.02);
  const src = ctx.createBufferSource();
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
  src.buffer = noiseBuffer;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(hp);
  hp.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.08);
}

export function playSnare(time = 0, vel = 0.6) {
  const ctx = createAudio();
  const t = ctx.currentTime + (time || 0.02);
  const src = ctx.createBufferSource();
  if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
  src.buffer = noiseBuffer;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t);
  src.stop(t + 0.3);
}

// optional fallback if assets exist at /assets/gameover.mp3 and /assets/scream.mp3
export function preloadAssetGameOver(sfxStatusEl) {
  try {
    gameOverAudioElement = new Audio('/assets/gameover.mp3');
    if (sfxStatusEl) sfxStatusEl.textContent = 'SFX available: gameover.mp3 (fallback)';
  } catch (e) {
    gameOverAudioElement = null;
  }
}

export function preloadAssetScream() {
  try {
    screamAudioElement = new Audio('/assets/scream.mp3');
  } catch (e) {
    screamAudioElement = null;
  }
}

export function preloadAssetPushing() {
  try {
    pushingAudioElement = new Audio('/assets/pushinglikeananimal.mp3');
  } catch (e) {
    pushingAudioElement = null;
  }
}

// decode audio from URL into an AudioBuffer (returns null on failure)
export async function loadAudioBufferFromUrl(url) {
  try {
    const ctx = createAudio();
    const res = await fetch(url);
    if (!res.ok) throw new Error('not found');
    const ab = await res.arrayBuffer();
    const decoded = await ctx.decodeAudioData(ab);
    return decoded;
  } catch (err) {
    return null;
  }
}

export function playGameOverSfx() {
  // try to ensure audio context exists
  try {
    createAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (gameOverBuffer) {
      const s = audioCtx.createBufferSource();
      s.buffer = gameOverBuffer;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(1, audioCtx.currentTime);
      s.connect(g);
      g.connect(audioCtx.destination);
      s.start();
      return;
    }
  } catch (e) {
    // ignore, fall back to element
  }

  // fallback to audio element if present
  if (gameOverAudioElement) {
    try {
      gameOverAudioElement.currentTime = 0;
      gameOverAudioElement.play().catch(() => {});
    } catch (e) {}
    return;
  }

  // last resort: try to load and play /assets/gameover.mp3 using HTMLAudio
  try {
    const a = new Audio('/assets/gameover.mp3');
    a.play().catch(() => {});
  } catch (e) {
    /* ignore */
  }
}

export function playCloseCallScream() {
  const now = performance.now() / 1000; // convert to seconds
  if (now - lastScreamTime < 0.3) return; // debounce: min 0.3s between screams
  lastScreamTime = now;

  // try to ensure audio context exists
  try {
    createAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (screamBuffer) {
      const s = audioCtx.createBufferSource();
      s.buffer = screamBuffer;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.8, audioCtx.currentTime); // slightly lower volume
      s.connect(g);
      g.connect(audioCtx.destination);
      s.start();
      return;
    }
  } catch (e) {
    // ignore, fall back to element
  }

  // fallback to audio element if present
  if (screamAudioElement) {
    try {
      screamAudioElement.currentTime = 0;
      screamAudioElement.play().catch(() => {});
    } catch (e) {}
    return;
  }

  // last resort: try to load and play /assets/scream.mp3 using HTMLAudio
  try {
    const a = new Audio('/assets/scream.mp3');
    a.play().catch(() => {});
  } catch (e) {
    /* ignore */
  }
}

export function playPushingSound() {
  // try to ensure audio context exists
  try {
    createAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (pushingBuffer) {
      const s = audioCtx.createBufferSource();
      s.buffer = pushingBuffer;
      const g = audioCtx.createGain();
      g.gain.setValueAtTime(0.9, audioCtx.currentTime);
      s.connect(g);
      g.connect(audioCtx.destination);
      s.start();
      return;
    }
  } catch (e) {
    // ignore, fall back to element
  }

  // fallback to audio element if present
  if (pushingAudioElement) {
    try {
      pushingAudioElement.currentTime = 0;
      pushingAudioElement.play().catch(() => {});
    } catch (e) {}
    return;
  }

  // last resort: try to load and play /assets/pushinglikeananimal.mp3 using HTMLAudio
  try {
    const a = new Audio('/assets/pushinglikeananimal.mp3');
    a.play().catch(() => {});
  } catch (e) {
    /* ignore */
  }
}

export function toggleMusic(musicToggle, elapsedTracker) {
  // ensure audio context is created on user gesture
  createAudio();
  if (!isMusicOn) {
    // start music (and resume audio context on some browsers)
    isMusicOn = true;
    musicToggle.classList.add('active');
    if (audioCtx.state === 'suspended') audioCtx.resume();
    startBeatLoop(elapsedTracker);
  } else {
    isMusicOn = false;
    musicToggle.classList.remove('active');
    stopBeatLoop();
  }
  localStorage.setItem('isMusicOn', JSON.stringify(isMusicOn));
  return isMusicOn;
}

export function startBeatLoop(elapsedTracker) {
  stopBeatLoop();
  if (!isMusicOn) return;
  // schedule a simple recursive timeout that recalculates bpm from elapsed
  const tick = () => {
    if (!isMusicOn) return;
    const elapsed = elapsedTracker.elapsed;
    // bpm and interval
    const bpm = getBpm(elapsed);
    const ms = 60000 / bpm;
    // intensity increases over time — every ~15s add more elements
    const intensity = Math.floor(Math.min(4, elapsed / 15));

    // play main kick
    playKick();

    // add snare/clap on off-beat when intense
    if (intensity >= 2) setTimeout(() => playSnare(), Math.floor(ms / 2));

    // hats — subdivisions increase with intensity
    const hats = 1 + intensity; // 1..5
    for (let i = 0; i < hats; i++) {
      setTimeout(() => playHat(undefined, 0.08 + intensity * 0.04), Math.floor((ms / hats) * i));
    }

    // small random jitter so loop doesn't feel too mechanical
    const jitter = (Math.random() - 0.5) * (ms * 0.02);
    beatTimer = setTimeout(tick, Math.max(30, ms + jitter));
  };
  tick();
}

export function stopBeatLoop() {
  if (beatTimer) {
    clearTimeout(beatTimer);
    beatTimer = null;
  }
}

export function getAudioCtx() {
    return audioCtx;
}

export function getIsMusicOn() {
    return isMusicOn;
}

export function setIsMusicOn(val) {
    isMusicOn = val;
}

export function setUpAudioUpload(uploadSfxBtn, gameoverFileInput, sfxStatusEl) {
    // allow user to upload a file and decode into gameOverBuffer
    gameoverFileInput.addEventListener('change', async (ev) => {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        // create AudioContext on user gesture and decode
        createAudio();
        const fr = new FileReader();
        fr.onload = async () => {
            try {
            const ab = fr.result;
            const decoded = await audioCtx.decodeAudioData(ab.slice ? ab.slice(0) : ab);
            gameOverBuffer = decoded;
            gameOverAudioElement = null; // prefer buffer
            if (sfxStatusEl) sfxStatusEl.textContent = `SFX uploaded: ${f.name}`;
            } catch (e) {
            console.warn('Failed to decode uploaded SFX', e);
            }
        };
        fr.readAsArrayBuffer(f);
    });

    uploadSfxBtn.addEventListener('click', () => {
        gameoverFileInput.click();
    });
}
