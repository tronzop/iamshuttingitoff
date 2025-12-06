/*
  rawe-ceek - Main game logic (canvas + audio)

  This file contains the core gameplay loop, rendering, input handling,
  audio helpers and a small set of utilities used by the HTML5 Canvas
  racing game. Keep changes focused: prefer small, well-documented
  helpers and avoid large refactors in this file unless necessary.

  Key sections:
  - Canvas setup and `fitCanvas()` to handle devicePixelRatio
  - Player, enemy and particle state
  - Audio loading and buffer fallbacks (WebAudio + HTMLAudioElement)
  - Sprite processing helpers: `processCarSprite` and `buildHitPolygonFromImage`
  - Main loop: `frame()` renders scene and handles game-over animation
*/

// TODO: Add spacebar to keys object and 
// TODO: Add speedBoostConfig and boost state variables
// TODO: Add updateBoost() function
// TODO: Call updateBoost(dt) at start of update()
// TODO: Add drawBoostBar() function
// TODO: Call drawBoostBar() in draw()
// TODO: Test spacebar boost in game


import { getBpm, createAudio, preloadAssetGameOver, playGameOverSfx, playCloseCallScream, playPushingSound, toggleMusic, stopBeatLoop, getAudioCtx, getIsMusicOn, setIsMusicOn, setUpAudioUpload, startBeatLoop } from './audio.js';
import { spawnSmoke, updateParticles, drawParticles } from './particles.js';
import { rand, circleIntersectsPolygon } from './utils.js';
import { tryLoadSpriteSheet, loadCarSprite, getCarSprite, getCarSpriteLoaded, getCarSpriteSheet, getCarSpriteSheetLoaded, getCarSpriteSheetFrames, getCarSpriteSheetVertical, getCarSpriteCanvas, getCarHitPolygon } from './sprite.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const restartBtn = document.getElementById('restart');
const pauseBtn = document.getElementById('pause');
const musicToggle = document.getElementById('musicToggle');
const uploadSfxBtn = document.getElementById('uploadSfx');
const gameoverFileInput = document.getElementById('gameoverFile');
const sfxStatusEl = document.getElementById('sfxStatus');
const skinStatusEl = document.getElementById('skinStatus');

// Keep canvas pixel ratio sharp
function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * ratio;
  canvas.height = canvas.clientHeight * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

// Player config - now rendered as an animated Formula 1 car (visual only).
const player = {
  x: canvas.width / 2 / (window.devicePixelRatio || 1),
  y: canvas.height / 2 / (window.devicePixelRatio || 1),
  r: 14, // collision radius (keeps simpler circle collision)
  speed: 240, // px/s movement speed
  angle: 0, // current facing angle (radians)
  targetAngle: 0, // where the car should rotate to (based on movement)
  w: 46, // visual width of car body (CSS px)
  h: 18, // visual height of car body (CSS px)
  wheelRotation: 0, // used for wheel animation
  livery: '#e21b1b', // primary color - editable for skins
  accent: '#ffd700', // accent color
  exhaustIntensity: 0, // 0..1 -> more when moving fast
};

// Boost config
const speedBoostConfig = {
  duration: 0.8, // seconds
  cooldown: 2.5, // seconds
  speedMultiplier: 2.5, // player.speed * multiplier
  maxBoost: 100, // percentage
  rechargeRate: 15, // percentage per second
  drainRate: 100 / 0.8, // percentage per second (maxBoost / duration)
};

let boost = {
  current: speedBoostConfig.maxBoost, // current boost level (0-100)
  active: false, // is boost currently active
  cooldown: 0, // current cooldown timer
};
const SPRITE_RENDER_SCALE = 5.5;

// Input state
const keys = { up: false, down: false, left: false, right: false, space: false };

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') keys.up = true;
  if (e.key === 'ArrowDown' || e.key === 's') keys.down = true;
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
  if (e.key === 'p') togglePause();
  if (e.key === 'm') setIsMusicOn(toggleMusic(musicToggle, { get elapsed() { return elapsed; } }));
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') keys.up = false;
  if (e.key === 'ArrowDown' || e.key === 's') keys.down = false;
  if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

// Enemies (circles) list and spawn config
let enemies = [];
let spawnTimer = 0; // seconds
let spawnInterval = 1.6; // how frequently enemies spawn
let elapsed = 0; // seconds survived
let lastTime = performance.now();
let running = true;
let highScore = 0;

// Audio / tempo
const baseBpm = 90; // starting bpm

let lastPushingMilestone = 0; // last score milestone (in multiples of 20) that triggered sound
let gameOverTime = 0; // time since game ended (for fade/zoom animation)

function spawnEnemy() {
  // Spawn along one of the edges outside the canvas
  const edge = Math.floor(rand(0, 4));
  let x, y;
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);
  if (edge === 0) {
    x = -30;
    y = rand(0, vh);
  }
  if (edge === 1) {
    x = vw + 30;
    y = rand(0, vh);
  }
  if (edge === 2) {
    x = rand(0, vw);
    y = -30;
  }
  if (edge === 3) {
    x = rand(0, vw);
    y = vh + 30;
  }

  // choose a Pirelli compound type for visual variety (and optionally tune speed)
  const compounds = [
    { id: 'soft', name: 'Soft', color: '#ff5c5c', rim: '#111', speedMult: 1.15 },
    { id: 'medium', name: 'Medium', color: '#ffd100', rim: '#111', speedMult: 1.0 },
    { id: 'hard', name: 'Hard', color: '#f4f4f4', rim: '#111', speedMult: 0.9 },
    { id: 'inter', name: 'Intermediate', color: '#00a86b', rim: '#111', speedMult: 1.02 },
    { id: 'wet', name: 'Wet', color: '#0080ff', rim: '#111', speedMult: 0.95 },
  ];
  const compound = compounds[Math.floor(rand(0, compounds.length))];

  // target roughly towards player with some variation
  const angleToPlayer = Math.atan2(player.y - y, player.x - x);
  // base speed increases with elapsed, then we scale by tempo so enemies mirror the music intensity
  const baseSpeed = rand(60, 160) + Math.min(200, elapsed * 4);
  const bpm = getBpm(elapsed);
  const tempoFactor = 1 + Math.min(1.5, (bpm - baseBpm) / baseBpm);
  const speed = baseSpeed * tempoFactor * (compound.speedMult || 1);
  const vx = Math.cos(angleToPlayer + rand(-0.5, 0.5)) * speed;
  const vy = Math.sin(angleToPlayer + rand(-0.5, 0.5)) * speed;
  const r = rand(10, 28) * (1 + Math.min(2, elapsed / 30));

  enemies.push({ x, y, vx, vy, r, compound });
}

function resetGame() {
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);
  player.x = vw / 2;
  player.y = vh / 2;
  enemies = [];
  spawnTimer = 0;
  spawnInterval = 1.6;
  elapsed = 0;
  lastTime = performance.now();
  running = true;
  gameOverPlayed = false;
  lastPushingMilestone = 0;
  gameOverTime = 0;
  document.getElementById('gameOverPanel').classList.add('hidden');
}

restartBtn.addEventListener('click', () => {
  resetGame();
});
pauseBtn.addEventListener('click', () => {
  togglePause();
});

musicToggle.addEventListener('click', () => {
  setIsMusicOn(toggleMusic(musicToggle, { get elapsed() { return elapsed; } }));
});


let gameOverPlayed = false;

function togglePause() {
  running = !running;
  pauseBtn.textContent = running ? 'Pause' : 'Resume';
  // reset lastTime to avoid big dt when resuming
  lastTime = performance.now();
  // pause or resume audio so music follows gameplay
  const audioCtx = getAudioCtx();
  if (audioCtx) {
    if (!running && audioCtx.state === 'running') audioCtx.suspend();
    if (running && getIsMusicOn() && audioCtx.state === 'suspended') audioCtx.resume();
  }
}

function updateBoost(dt) {
  if (keys.space && boost.current > 0 && boost.cooldown <= 0 && running) {
    boost.active = true;
    boost.current = Math.max(0, boost.current - speedBoostConfig.drainRate * dt);
  } else {
    boost.active = false;
    if (boost.current < speedBoostConfig.maxBoost && boost.cooldown <= 0) {
      boost.current = Math.min(speedBoostConfig.maxBoost, boost.current + speedBoostConfig.rechargeRate * dt);
    }
  }

  if (boost.active && boost.current === 0) {
    boost.cooldown = speedBoostConfig.cooldown;
  }

  if (boost.cooldown > 0) {
    boost.cooldown = Math.max(0, boost.cooldown - dt);
  }
}

function update(dt) {
  updateBoost(dt);
  // Player movement
  let dx = 0,
    dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    const currentSpeed = boost.active ? player.speed * speedBoostConfig.speedMultiplier : player.speed;
    const vx = (dx / len) * currentSpeed;
    const vy = (dy / len) * currentSpeed;
    player.x += vx * dt;
    player.y += vy * dt;
    // target angle should point towards movement vector (car forward)
    player.targetAngle = Math.atan2(vy, vx);
    // wheel rotation visual based on forward velocity
    player.wheelRotation += Math.hypot(vx, vy) * 0.03 * dt * 60;
    // visual exhaust scales with speed (0..1)
    player.exhaustIntensity = Math.min(1, Math.hypot(vx, vy) / 600);
  }

  // keep player inside bounds
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);
  player.x = Math.max(player.r, Math.min(vw - player.r, player.x));
  player.y = Math.max(player.r, Math.min(vh - player.r, player.y));

  // spawn logic
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnEnemy();
    const bpm = getBpm(elapsed);
    const tempoFactor = 1 + Math.min(1.5, (bpm - baseBpm) / baseBpm);
    spawnTimer = Math.max(0.2, (spawnInterval - Math.min(1.1, elapsed / 45)) / tempoFactor);
  }

  // update enemies
  for (const e of enemies) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  // increase difficulty slowly
  spawnInterval = Math.max(0.6, 1.6 - elapsed / 60);

  // collision detection — circle overlap OR polygon-based hitbox if a processed sprite exists
  for (const e of enemies) {
    let hit = false;
    let distance = 0;
    const carHitPolygon = getCarHitPolygon();
    const carSpriteCanvas = getCarSpriteCanvas();

    if (carHitPolygon && carSpriteCanvas) {
      // compute visual sprite size same as drawCar
      const desiredH = player.h * 3.2;
      const desiredW = desiredH * (carSpriteCanvas.width / carSpriteCanvas.height);
      const scale = desiredW / carSpriteCanvas.width; // uniform scale
      // transform polygon to world coords
      const worldPoly = carHitPolygon.map((pt) => {
        const sx = pt.x * scale;
        const sy = pt.y * scale;
        return {
          x: player.x + Math.cos(player.angle) * sx - Math.sin(player.angle) * sy,
          y: player.y + Math.sin(player.angle) * sx + Math.cos(player.angle) * sy,
        };
      });
      // check circle vs polygon collision
      if (circleIntersectsPolygon(e.x, e.y, e.r, worldPoly)) hit = true;
      // compute closest distance from enemy circle to player center for close-call detection
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      distance = Math.hypot(dx, dy) - e.r;
    } else {
      // fallback: circle vs circle
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const distSq = dx * dx + dy * dy;
      distance = Math.hypot(dx, dy) - e.r;
      if (distSq <= (e.r + player.r) * (e.r + player.r)) hit = true;
    }

    // close-call detection: enemy passes within 30px of player center but doesn't hit
    if (!hit && running && distance < 30 && distance > 0) {
      playCloseCallScream();
    }

    if (hit) {
      running = false;
      gameOverTime = 0; // start game over animation timer
      // Stop the music/beat immediately when the game ends
      stopBeatLoop();
      setIsMusicOn(false);
      if (musicToggle) musicToggle.classList.remove('active');
      highScore = Math.max(highScore, Math.floor(elapsed));
      if (!gameOverPlayed) {
        // Play the game-over SFX and then suspend audio context after it finishes (if we can detect duration)
        playGameOverSfx();
        gameOverPlayed = true;
        document.getElementById('gameOverPanel').classList.remove('hidden');
        document.getElementById('finalScore').textContent = Math.floor(elapsed);
      }
      break;
    }
  }

  // remove offscreen or very far enemies for memory
  enemies = enemies.filter((e) => {
    return e.x > -100 && e.x < vw + 100 && e.y > -100 && e.y < vh + 100;
  });

  elapsed += dt;

  // check for 20-point milestones and play pushing sound
  const currentMilestone = Math.floor(elapsed / 20);
  if (currentMilestone > lastPushingMilestone && running) {
    lastPushingMilestone = currentMilestone;
    playPushingSound();
  }

  // slowly smooth the facing angle towards targetAngle for a nice animated turn
  const angDiff = ((player.targetAngle - player.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  // rotate faster when moving more
  player.angle += angDiff * Math.min(1, dt * 6);

  // update particles
  updateParticles(dt);
}

function draw() {
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);

  ctx.clearRect(0, 0, vw, vh);

  // background grid subtle
  ctx.fillStyle = '#071827';
  ctx.fillRect(0, 0, vw, vh);

  // draw smoke particles first (so car sits on top)
  drawParticles(ctx);

  // draw player
  drawCar(ctx, player.x, player.y, player.angle, player);

  // draw enemies (render as Pirelli tyre compounds, with colored sidewall / stripe)
  for (const e of enemies) {
    drawTyre(ctx, e.x, e.y, e.r, e.compound);
  }

  // draw boost bar
  drawBoostBar(ctx);
}

// small helper - draw a simplified, stylized Formula 1 car
function drawCar(ctx, x, y, angle, p) {
  ctx.save();
  ctx.translate(x, y);
  // When the user asked for "other side be the front when moving", we display the car facing
  // the opposite direction while it is moving. Compute a displayAngle that's flipped by PI
  // when the car is in motion (exhaustIntensity > threshold).
  const isMoving = p.exhaustIntensity > 0.02;
  const displayAngle = isMoving ? angle + Math.PI : angle;
  ctx.rotate(displayAngle);

  const carSprite = getCarSprite();
  const carSpriteLoaded = getCarSpriteLoaded();
  const carSpriteCanvas = getCarSpriteCanvas();
  const carSpriteSheet = getCarSpriteSheet();
  const carSpriteSheetLoaded = getCarSpriteSheetLoaded();
  const carSpriteSheetFrames = getCarSpriteSheetFrames();
  const carSpriteSheetVertical = getCarSpriteSheetVertical();

  // if a sprite image is available, draw it (keeps rotation/lean) and return early
  if (
    (carSpriteCanvas && carSpriteCanvas.width) ||
    (carSpriteLoaded && carSprite.naturalWidth && carSprite.naturalHeight)
  ) {
    const srcImg = carSpriteCanvas && carSpriteCanvas.width ? carSpriteCanvas : carSprite;
    // compute size so the sprite looks proportionally larger than the logical collision body
    const desiredH = p.h * SPRITE_RENDER_SCALE; // taller rendering for clear visual
    const desiredW = desiredH * (srcImg.width / srcImg.height);
    // slight lean based on angle difference; when the sprite is flipped we invert the lean so the
    // visual turns look correct relative to the drawn front of the car.
    let lean = (((p.targetAngle - p.angle + Math.PI) % (Math.PI * 2)) - Math.PI) * 0.15;
    if (isMoving) lean = -lean;
    ctx.rotate(lean);
    // If a pre-exported sprite-sheet is available, prefer it for consistent frames
    if (carSpriteSheetLoaded && carSpriteSheetFrames > 0) {
      const frameCount = carSpriteSheetFrames;
      const frameIndex =
        p.exhaustIntensity > 0.02 ? Math.abs(Math.floor(p.wheelRotation * 0.06)) % frameCount : 0;
      if (carSpriteSheetVertical) {
        // vertical: frames stacked top->bottom
        const frameW = carSpriteSheet.naturalWidth;
        const frameH = Math.round(carSpriteSheet.naturalHeight / frameCount);
        const sx = 0;
        const sy = frameIndex * frameH;
        ctx.drawImage(
          carSpriteSheet,
          sx,
          sy,
          frameW,
          frameH,
          -desiredW / 2,
          -desiredH / 2,
          desiredW,
          desiredH
        );
      } else {
        // horizontal: frames left->right
        const frameW = Math.round(carSpriteSheet.naturalWidth / frameCount);
        const frameH = carSpriteSheet.naturalHeight;
        const sx = frameIndex * frameW;
        const sy = 0;
        ctx.drawImage(
          carSpriteSheet,
          sx,
          sy,
          frameW,
          frameH,
          -desiredW / 2,
          -desiredH / 2,
          desiredW,
          desiredH
        );
      }
    } else {
      // fallback: draw single processed or raw sprite
      ctx.drawImage(srcImg, -desiredW / 2, -desiredH / 2, desiredW, desiredH);
    }
    // exhaust effect (draw using radial gradient behind sprite)
    if (p.exhaustIntensity > 0.02) {
      ctx.save();
      ctx.translate(-desiredW * 0.35, 0);
      const e = p.exhaustIntensity;
      const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, desiredW * 0.9);
      rg.addColorStop(0, `rgba(255,210,48,${0.6 * e})`);
      rg.addColorStop(0.5, `rgba(255,80,20,${0.25 * e})`);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.ellipse(-desiredW * 0.25, 0, desiredW * 0.9 * e, p.h * 0.6 * e, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // spawn smoke particles from the car's rear based on exhaust intensity
    spawnExhaustParticles(x, y, displayAngle, p.exhaustIntensity, desiredW * 0.35, 0, 0.35, 40, 60, 0.6, 20, 12, 6, 8, 0.9, 0.9, 0.85);
    ctx.restore();
    return;
  }

  // main body with gradient (primary livery)
  ctx.beginPath();
  const g = ctx.createLinearGradient(-p.w, -p.h, p.w, p.h);
  g.addColorStop(0, p.livery);
  g.addColorStop(0.7, p.accent);
  g.addColorStop(1, '#222');
  ctx.fillStyle = g;
  // tapered nose and wide rear wing shape
  ctx.moveTo(-p.w * 0.7, 0);
  ctx.quadraticCurveTo(-p.w * 0.18, -p.h * 1.0, p.w * 0.05, -p.h * 0.75);
  ctx.lineTo(p.w * 0.7, -p.h * 0.3);
  ctx.lineTo(p.w * 0.45, p.h * 0.75);
  ctx.quadraticCurveTo(p.w * 0.12, p.h * 0.35, -p.w * 0.7, 0);
  ctx.fill();

  // cockpit canopy - glossy
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = '#081722';
  ctx.ellipse(0.08 * p.w, -0.15 * p.h, p.w * 0.22, p.h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // gloss highlight
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.ellipse(0.05 * p.w, -0.22 * p.h, p.w * 0.12, p.h * 0.06, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // front wing (multi-layered)
  ctx.save();
  ctx.translate(-p.w * 0.5, 0);
  ctx.fillStyle = '#111';
  ctx.fillRect(-p.w * 0.2, -p.h * 0.08, p.w * 0.36, p.h * 0.06);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-p.w * 0.18, -p.h * 0.14, p.w * 0.28, p.h * 0.04);
  ctx.restore();

  // rear wing - dynamic angle based on target vs current angle
  ctx.save();
  const wingTilt = Math.sin(player.wheelRotation * 0.015) * 0.07;
  ctx.translate(p.w * 0.45, -p.h * 0.44);
  ctx.rotate(wingTilt);
  ctx.fillStyle = '#111';
  ctx.fillRect(-p.w * 0.02, -p.h * 0.02, p.w * 0.55, p.h * 0.12);
  ctx.fillStyle = '#333';
  ctx.fillRect(-p.w * 0.02, -p.h * 0.06, p.w * 0.3, p.h * 0.04);
  ctx.restore();

  // wheels (4) — detailed with rim and spokes
  const wheelW = p.w * 0.22;
  const wheelH = p.h * 0.5;
  // offsets
  const fx = -p.w * 0.25,
    bx = p.w * 0.35;
  const wy = p.h * 0.5;

  // front-left
  ctx.save();
  ctx.translate(fx, -wy);
  ctx.rotate(Math.sin(p.wheelRotation * 0.02) * 0.18);
  drawWheel(ctx, wheelW, wheelH, p.wheelRotation);
  ctx.restore();
  // front-right
  ctx.save();
  ctx.translate(fx, wy);
  ctx.rotate(Math.sin(p.wheelRotation * 0.02) * 0.18);
  drawWheel(ctx, wheelW, wheelH, p.wheelRotation);
  ctx.restore();
  // rear-left
  ctx.save();
  ctx.translate(bx, -wy);
  drawWheel(ctx, wheelW, wheelH, p.wheelRotation);
  ctx.restore();
  // rear-right
  ctx.save();
  ctx.translate(bx, wy);
  drawWheel(ctx, wheelW, wheelH, p.wheelRotation);
  ctx.restore();

  // small racing stripe
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.moveTo(-p.w * 0.58, -p.h * 0.14);
  ctx.lineTo(p.w * 0.58, -p.h * 0.14);
  ctx.stroke();

  // exhaust flame when accelerating
  if (p.exhaustIntensity > 0.02) {
    ctx.save();
    ctx.translate(-p.w * 0.65, 0);
    const e = p.exhaustIntensity;
    const rg = ctx.createRadialGradient(0, 0, 2, 0, 0, p.w * 0.9);
    rg.addColorStop(0, `rgba(255,210,48,${0.6 * e})`);
    rg.addColorStop(0.5, `rgba(255,80,20,${0.25 * e})`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.ellipse(-p.w * 0.2, 0, p.w * 0.9 * e, p.h * 0.6 * e, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // spawn smoke for vector car representation
    spawnExhaustParticles(x, y, displayAngle, p.exhaustIntensity, p.w * 0.65, 0, 0.25, 30, 50, 0.6, 18, 10, 5, 6, 0.8, 0.6, 0.9);
  }

  ctx.restore();
}

// draw a stylized wheel with rotating spokes
function drawWheel(ctx, ww, hh, rotation) {
  // wheel outline
  ctx.save();
  ctx.fillStyle = '#0b0b0b';
  ctx.beginPath();
  ctx.ellipse(0, 0, ww / 2, hh / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // rim
  ctx.beginPath();
  ctx.ellipse(0, 0, ww / 3.2, hh / 3.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#555';
  ctx.fill();

  // spokes — draw several thin lines that rotate
  const spokes = 6;
  ctx.strokeStyle = 'rgba(20,20,20,0.95)';
  ctx.lineWidth = Math.max(1, ww * 0.035);
  ctx.beginPath();
  for (let i = 0; i < spokes; i++) {
    const a = rotation * 0.06 + (i / spokes) * Math.PI * 2;
    const x1 = Math.cos(a) * ww * 0.12;
    const y1 = Math.sin(a) * hh * 0.12;
    const x2 = Math.cos(a) * ww * 0.45;
    const y2 = Math.sin(a) * hh * 0.45;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();

  // small hub
  ctx.beginPath();
  ctx.fillStyle = '#222';
  ctx.ellipse(0, 0, ww * 0.09, hh * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBoostBar(ctx) {
  const vw = canvas.width / (window.devicePixelRatio || 1);
  const vh = canvas.height / (window.devicePixelRatio || 1);

  const barWidth = 200;
  const barHeight = 20;
  const barX = vw - barWidth - 20;
  const barY = vh - barHeight - 20;

  // Background for the boost bar
  ctx.fillStyle = '#333';
  ctx.fillRect(barX, barY, barWidth, barHeight);

  // Current boost level
  const currentBoostWidth = (boost.current / speedBoostConfig.maxBoost) * barWidth;
  ctx.fillStyle = boost.active ? '#00ffff' : '#00ff00'; // Cyan when active, green when recharging
  ctx.fillRect(barX, barY, currentBoostWidth, barHeight);

  // Boost bar border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barWidth, barHeight);

  // Cooldown overlay
  if (boost.cooldown > 0) {
    const cooldownRatio = boost.cooldown / speedBoostConfig.cooldown;
    ctx.fillStyle = `rgba(255, 0, 0, ${0.7 * cooldownRatio})`;
    ctx.fillRect(barX, barY, barWidth, barHeight);
  }

  // Boost text
  ctx.fillStyle = '#fff';
  ctx.font = '14px system-ui, Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BOOST', barX + barWidth / 2, barY + barHeight / 2);
}

// draw a tyre compound (outer rubber, colored sidewall/stripe, inner hub)
// Helper function to spawn exhaust particles
function spawnExhaustParticles(
  x, y, displayAngle, exhaustIntensity,
  rearLocalX, rearLocalY,
  spawnProbability,
  minRv, maxRv, rvMultiplier,
  vxRandomFactor, vyRandomFactor,
  minSmokeSize, smokeSizeMultiplier,
  minSmokeAlpha, smokeAlphaMultiplier,
  smokeLifetime
) {
  const worldRearX =
    x + Math.cos(displayAngle) * rearLocalX - Math.sin(displayAngle) * rearLocalY;
  const worldRearY =
    y + Math.sin(displayAngle) * rearLocalX + Math.cos(displayAngle) * rearRearY;

  if (Math.random() < exhaustIntensity * spawnProbability) {
    const rv = minRv + Math.random() * maxRv;
    const vx =
      -Math.cos(displayAngle) * (rv * (rvMultiplier + Math.random() * rvMultiplier)) + (Math.random() - 0.5) * vxRandomFactor;
    const vy =
      -Math.sin(displayAngle) * (rv * (rvMultiplier + Math.random() * rvMultiplier)) + (Math.random() - 0.5) * vyRandomFactor;
    spawnSmoke(
      worldRearX,
      worldRearY + (Math.random() - 0.5) * 6,
      vx,
      vy,
      minSmokeSize + Math.random() * smokeSizeMultiplier * exhaustIntensity,
      minSmokeAlpha + Math.random() * smokeAlphaMultiplier,
      smokeLifetime
    );
  }
}

function drawTyre(ctx, x, y, r, compound) {
  ctx.save();
  ctx.translate(x, y);
  // main rubber
  ctx.beginPath();
  ctx.fillStyle = '#050505';
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // sidewall colored ring (thin)
  ctx.beginPath();
  ctx.fillStyle = compound && compound.color ? compound.color : '#ff5c5c';
  ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
  ctx.globalAlpha = 0.95;
  ctx.fill();
  ctx.globalAlpha = 1;
  // inner hub
  ctx.beginPath();
  ctx.fillStyle = '#202225';
  ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
  ctx.fill();
  // hubcap highlight
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.arc(-r * 0.12, -r * 0.1, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // small 'P' mark for Pirelli style
  ctx.fillStyle = compound && compound.rim ? compound.rim : '#111';
  ctx.font = `${Math.max(8, r * 0.35)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', 0, 0);
  ctx.restore();
}

function frame() {
  const now = performance.now();
  let dt = (now - lastTime) / 1000; // seconds
  lastTime = now;
  if (!running) dt = 0; // freeze updates when paused/stopped

  // limit dt to avoid big jumps
  if (dt > 0.05) dt = 0.05;

  if (running) update(dt);
  draw();
  scoreEl.textContent = `Score: ${Math.floor(elapsed)}`;

  if (!running) {
    /*
      Game-over presentation

      `gameOverTime` tracks seconds elapsed since the collision triggered
      the game-over state. We use it to drive the sadGreg fade/zoom
      animation (typically 0..3s). The overlay is drawn using the
      logical canvas size (`vw`, `vh`) so UI text and images align
      with CSS pixel coordinates regardless of devicePixelRatio.
    */
    gameOverTime += dt;

    // use logical canvas size for UI/layout math (devicePixelRatio already applied)
    const vw = canvas.width / (window.devicePixelRatio || 1);
    const vh = canvas.height / (window.devicePixelRatio || 1);

    // semi-transparent dark overlay (drawn first, then image on top)
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, vw, vh);

    // game over text on top of everything
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '28px system-ui, Arial';
    ctx.fillText('Game Over', vw / 2, vh / 2 - 10);
    ctx.font = '14px system-ui, Arial';
    ctx.fillText(`Score: ${Math.floor(elapsed)} — High: ${highScore}`, vw / 2, vh / 2 + 18);
  }

  requestAnimationFrame(frame);
}

// start the main game loop (spawn enemies + requestAnimationFrame)
let gameLoopStarted = false;
function startGameLoop() {
  if (gameLoopStarted) return;
  gameLoopStarted = true;
  for (let i = 0; i < 3; i++) spawnEnemy();
  requestAnimationFrame(frame);
}

// ensure we start the loop either when spritesheet is ready, or after a short timeout
function startGameLoopIfReady() {
  // If a spritesheet is desired and it hasn't finished loading, wait until it does
  // but don't block forever — fallback after 500ms.
  if (getCarSpriteSheetLoaded()) {
    startGameLoop();
  } else {
    // try loading sheet (this will call startGameLoopIfReady on load/error)
    tryLoadSpriteSheet(startGameLoopIfReady);
    setTimeout(() => {
      if (!gameLoopStarted) startGameLoop();
    }, 500);
  }
}

// init player position after we have accurate sizes
resetGame();
// try to preload a default game-over audio if present at /assets/gameover.mp3
preloadAssetGameOver(sfxStatusEl);

const playAgainBtn = document.getElementById('playAgain');
playAgainBtn.addEventListener('click', () => {
  resetGame();
});

// Kick off: if spritesheet exists it will call startGameLoopIfReady when loaded; otherwise start shortly
loadCarSprite(skinStatusEl);
createAudio(sfxStatusEl);
if (getIsMusicOn()) {
  musicToggle.classList.add('active');
  startBeatLoop({ get elapsed() { return elapsed; } });
}
startGameLoopIfReady();
setUpAudioUpload(uploadSfxBtn, gameoverFileInput, sfxStatusEl);

// small helper: clicking the canvas moves player to mouse
canvas.addEventListener('mousemove', (e) => {
  // comment out if you want keyboard-only control
  //const rect = canvas.getBoundingClientRect();
  //player.x = (e.clientX - rect.left);
  //player.y = (e.clientY - rect.top);
});

// keep game responsive when the window resizes
window.addEventListener('resize', () => {
  fitCanvas();
  resetGame();
});