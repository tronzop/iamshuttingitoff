# rawe-ceek - AI Coding Agent Guide

A dependency-free HTML5 Canvas racing game where the player navigates a stylized Formula-1 car around spawning enemy obstacles (Pirelli tire compounds). The architecture spans a frontend game (`src/game.js`) and optional leaderboard API server (`server/index.js`).

## Architecture & Key Components

### Frontend (Canvas Game)
- **Entry**: `index.html` defines canvas and UI overlays (HUD, game-over panel, leaderboard)
- **Main logic**: `src/game.js` (~1000 lines) contains the complete game loop, rendering, and player/enemy mechanics
- **Styling**: `src/style.css` handles canvas fullscreen layout and overlay positioning

**Critical Design Patterns:**
- Game runs at 60fps via `requestAnimationFrame`; delta-time (`dt`) is calculated to handle variable frame rates
- **Canvas pixel ratio handling**: Uses `window.devicePixelRatio` to maintain sharpness on high-DPI displays (see `fitCanvas()`)
- **State management**: Game state (player position, enemies list, score, running flag) is kept in module scope; no external state library
- **Collision detection**: Uses either convex-hull polygon matching (for sprite images) or circular radius (`player.r = 14`) for fallback

### Backend (Leaderboard API)
- **File**: `server/index.js` (~60 lines)
- **Purpose**: Accepts GET/POST to `/leaderboard` endpoint; persists scores in `leaderboard.json`
- **Design**: Plain Node.js `http` module; no frameworks or extra npm packages required
- **CORS**: Enabled for all origins to support cross-origin game submissions

### Styling & Rendering
- **Player**: Rendered as a vector-drawn F1 car with rotating wheels, wings, and exhaust particles. Optionally uses sprite (`/assets/ferrari f1.png`) if present; sprite is preprocessed to remove white backgrounds and generate a convex hitbox polygon.
- **Enemies**: Rendered as Pirelli tire compounds (Soft, Medium, Hard, Intermediate, Wet) with color-coded sidewalls; each has a `speedMult` modifier to vary difficulty
- **Dynamic difficulty**: Enemy spawn rate and speed increase with `elapsed` time; music tempo/BPM also scales (`getBpm()` returns 90 + min(150, elapsed * 1.8))

## Developer Workflows

### Run Locally
```bash
# Frontend only (simple web server on port 8080)
npm start

# Backend leaderboard server (port 3000)
npm run server

# Both simultaneously (requires concurrently)
npm run start:all
```

### Docker
```bash
docker-compose up
# Runs both servers; ports 3738 (http-server) and 3002 (leaderboard)
```

### File Upload Features
- **Custom SFX**: Player can upload audio via "Upload SFX" button; decoded into WebAudio buffer and played at game-over
- **Sprite replacement**: Drop `ferrari f1.png` in `/assets/` folder; game auto-detects and uses it with white-background removal + convex-hull hitbox generation

## Code Patterns & Conventions

### Audio System
- Uses Web Audio API for synthesized beats (kick, hat, snare) and optional gameover SFX
- Audio context created lazily on user gesture (first interaction with Sound button or SFX upload)
- Three fallback chains for gameover: (1) pre-decoded buffer, (2) uploaded buffer, (3) fallback to `<audio>` element or `/assets/gameover.mp3`

### Leaderboard Integration
- Frontend checks if `localhost:3000` is available; otherwise falls back to `/leaderboard` (relative path)
- Score submission is async/non-blocking; game overlay allows retry on failure
- Top 25 scores kept on-disk; full leaderboard pruned to 100 entries on POST

### Particle System
- Smoke particles spawn from car rear; tracked in `particles[]` array with position, velocity, age, size, alpha
- Particles updated each frame via `updateParticles(dt)` and rendered before the car (depth ordering)

### Input Handling
- Arrow keys or WASD for movement (state tracked in `keys` object)
- Keyboard shortcuts: `P` = pause, `M` = toggle music
- Button clicks wired to same pause/music functions for accessibility

## Common Edits

### Adjust Difficulty
- Tweak `spawnInterval` (default 1.6s) in module scope
- Edit `spawnEnemy()` to modify base speed formula or enemy spawn edges
- Adjust `compounds[].speedMult` for per-type speed variations

### Modify Player Movement
- `player.speed` (default 240 px/s)
- `player.r` (collision radius, default 14)
- Steering response: `player.angle` smoothing factor in `update()` (currently `dt * 6`)

### Customize Visuals
- F1 car colors: Edit `player.livery` and `player.accent` (currently red + gold)
- Enemy tire colors: Modify `compounds[]` array in `spawnEnemy()`
- Background: Solid color in `draw()` (currently `#071827`); can swap for gradient

## Testing & Debugging

- **No build step**: Edits to `src/game.js` or `index.html` require only a browser refresh
- **Leaderboard testing**: If API is unreachable, game gracefully falls back and shows "Leaderboard unavailable"
- **Check browser console** for sprite/audio loading logs (e.g., "Loaded /assets/gameover.mp3 into AudioBuffer")
- **Collision debug**: Add `console.log(circleIntersectsPolygon(...))` in update loop to verify hitbox logic

## Key External Assets

- `/assets/gameover.mp3` — fallback game-over sound (optional; game works without it)
- `/assets/ferrari f1.png` — optional sprite (if missing, vector car is rendered)

All other content is generated at runtime (no external image dependencies required for core gameplay).
