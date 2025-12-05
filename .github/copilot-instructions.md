## rawe-ceek — AI Coding Agent Quick Guide
```instructions
## rawe-ceek — AI Coding Agent Quick Guide

Short, actionable notes to get productive quickly in this repository (frontend Canvas game + optional leaderboard server).

### Big picture
- Frontend: `index.html` + `src/game.js` — single-file game loop, rendering, input, audio, sprites and particles. Edits to `src/game.js` are hot-reload friendly (no build step).
- Backend (optional): `server/index.js` — tiny Node `http` server exposing `GET`/`POST /leaderboard` and persisting `server/leaderboard.json`.
- Assets: `assets/` holds media. The frontend references assets directly (no bundler).

### Where to look first
- `src/game.js`: primary authoring surface. Key functions and symbols:
	- `fitCanvas()` — devicePixelRatio-aware sizing
	- `frame()` / `update(dt)` / `draw()` — main loop and rendering
	- `spawnEnemy()` / `drawTyre()` — enemy lifecycle and visuals
	- `processCarSprite()` / `buildHitPolygonFromImage()` — sprite processing and hitbox generation
	- Audio helpers: `createAudio()`, `playGameOverSfx()`, `loadAudioBufferFromUrl()`
- `server/index.js`: leaderboard API and persistence (`server/leaderboard.json`).
- `assets/`: `ferrari f1.png`, generated frames (`ferrari_frame_*.png`) and other SFX.

### Run & debug (developer workflows)
- Frontend dev server: `npm start` (serves project at `http://localhost:8080`).
- Leaderboard server: `npm run server` (runs `server/index.js`).
- Export frames tool: `npm run export-frames` — generates `/assets/ferrari_frame_0..7.png` using `tools/export_frames.js`.
- Format code: project has `.prettierrc`; run `npx prettier --write src/game.js` to format.

### Project-specific patterns & important caveats
- Single-file pattern: `src/game.js` contains most logic — prefer small, focused edits rather than large refactors.
- High-DPI canvas: code uses `window.devicePixelRatio` + `fitCanvas()` and draws using logical CSS px. Keep transforms and UI math in logical coordinates.
- Time-step: movement uses `requestAnimationFrame` + delta-time (`dt`). Preserve `dt` for motion/particles to keep behavior stable across frame rates.
- Sprite processing/hitboxes:
	- `processCarSprite()` draws a loaded image to an offscreen canvas, removes near-white background, denoises, then computes a convex hull via `buildHitPolygonFromImage()`.
	- Important: `getImageData()` requires integer width/height — code uses `Math.round(img.naturalWidth)` to avoid DOM exceptions.
	- The runtime supports either a processed `carSpriteCanvas` or a raw `carSprite` image fallback; collision uses `carHitPolygon` when available, otherwise a circle radius fallback (`player.r`).
- Sprite frames and export:
	- The repo includes a runtime generator that builds subtle animation frames (`generateSpriteFrames`) and a tool `tools/export_frames.js` to export PNG frames into `/assets`.
	- Use `npm run export-frames` to regenerate frames if you update `assets/ferrari f1.png`.
- Audio: `createAudio()` lazily creates an AudioContext on first user gesture and preloads fallback SFX (buffer+audio element fallbacks). Avoid creating AudioContext on module load to prevent autoplay restrictions.

### Editing pointers (concrete examples)
- Change enemy difficulty: edit `spawnInterval` or the `compounds` speed multipliers in `src/game.js`.
- Adjust player feel: modify `player.speed`, `player.r`, or the angle smoothing multiplier near `player.angle` updates.
- Replace sprite: drop a new image into `assets/ferrari f1.png`, then run `npm run export-frames` (optional) and ensure `processCarSprite()` computes a valid hit polygon.
- Debugging image issues: check console for `getImageData` errors — they usually mean non-integer canvas sizes or an unloaded image; verify `console.info('Loaded /assets/sadgreg.png')` logs and that `sadGregLoaded` is true.

### Integration points & external dependencies
- Frontend: no production npm deps (runs in-browser). Backend: core Node only (no external packages required for the leaderboard).
- Developer tools: `jimp` is used by `tools/export_frames.js` for frame exporting (installed by dev when running the script).

### Data flows and state
- Game state is module-scoped in `src/game.js` (player, enemies, particles, audio buffers) and persisted leaderboard state is in `server/leaderboard.json`.

### Quick checklist for common tasks
- Run dev server: `npm start` → open `http://localhost:8080`.
- Add/replace car sprite: place file at `assets/ferrari f1.png` → `npm run export-frames` → verify `carHitPolygon` in console messages.
- Tweak visuals/physics: edit `src/game.js` (prefer small changes), refresh browser.

If you want, I can shorten or expand any section, add code snippets showing exact edit locations (e.g., where to change `spawnInterval`), or add an `AGENT.md` with a curated task list. Reply with which sections you want expanded.

```
