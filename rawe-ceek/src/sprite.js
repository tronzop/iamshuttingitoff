
let carSprite = new Image();
let carSpriteLoaded = false;
let carSpriteSheet = new Image();
let carSpriteSheetLoaded = false;
let carSpriteSheetFrames = 0;
let carSpriteSheetVertical = false;
let carSpriteCanvas = null; // offscreen canvas for processed sprite
let carHitPolygon = null; // array of points [{x,y}, ...] in sprite pixel coordinates centered at (0,0)

export function getCarSprite() {
    return carSprite;
}

export function getCarSpriteLoaded() {
    return carSpriteLoaded;
}

export function getCarSpriteSheet() {
    return carSpriteSheet;
}

export function getCarSpriteSheetLoaded() {
    return carSpriteSheetLoaded;
}

export function getCarSpriteSheetFrames() {
    return carSpriteSheetFrames;
}

export function getCarSpriteSheetVertical() {
    return carSpriteSheetVertical;
}

export function getCarSpriteCanvas() {
    return carSpriteCanvas;
}

export function getCarHitPolygon() {
    return carHitPolygon;
}

export function tryLoadSpriteSheet(startGameLoopIfReady) {
  carSpriteSheetLoaded = false;
  carSpriteSheetFrames = 0;
  // attempt trimmed vertical sheet first
  carSpriteSheet.onload = () => {
    carSpriteSheetLoaded = true;
    // detect layout: vertical (height > width) or horizontal
    try {
      if (carSpriteSheet.naturalHeight > carSpriteSheet.naturalWidth) {
        carSpriteSheetVertical = true;
        carSpriteSheetFrames = Math.max(
          1,
          Math.round(carSpriteSheet.naturalHeight / carSpriteSheet.naturalWidth)
        );
      } else {
        carSpriteSheetVertical = false;
        carSpriteSheetFrames = Math.max(
          1,
          Math.round(carSpriteSheet.naturalWidth / carSpriteSheet.naturalHeight)
        );
      }
    } catch (e) {
      carSpriteSheetFrames = 0;
    }
    console.info(
      'Loaded spritesheet',
      carSpriteSheet.naturalWidth + 'x' + carSpriteSheet.naturalHeight,
      '-',
      carSpriteSheetFrames,
      'frames',
      carSpriteSheetVertical ? '(vertical)' : '(horizontal)'
    );
    // start the game loop when sheet is loaded
    startGameLoopIfReady();
  };
  carSpriteSheet.onerror = () => {
    // if trimmed attempt failed, try the regular sheet; otherwise start anyway
    if (carSpriteSheet.src && carSpriteSheet.src.indexOf('trimmed') !== -1) {
      carSpriteSheet.src = '/assets/ferrari_spritesheet.png';
    } else {
      carSpriteSheetLoaded = false;
      startGameLoopIfReady();
    }
  };
  // kick off with trimmed first
  carSpriteSheet.src = '/assets/ferrari_spritesheet_trimmed.png';
}

function buildHitPolygonFromImage(img, sampleStep = 3) {
  const w = Math.round(img.naturalWidth),
    h = Math.round(img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  cx.drawImage(img, 0, 0, w, h);
  const id = cx.getImageData(0, 0, w, h).data;
  const points = [];
  for (let y = 0; y < h; y += sampleStep) {
    for (let x = 0; x < w; x += sampleStep) {
      const idx = (y * w + x) * 4;
      const a = id[idx + 3]; // alpha
      if (a > 40) {
        points.push({ x: x - w / 2, y: y - h / 2 });
      }
    }
  }
  if (points.length === 0) return null;
  return convexHull(points);
}

export function processCarSprite(img, skinStatusEl) {
  try {
    const w = Math.round(img.naturalWidth),
      h = Math.round(img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    const id = cx.getImageData(0, 0, w, h);
    const data = id.data;
    // remove white / near white background: set alpha=0 for pixels that are close to white
    // Use a more forgiving threshold and also run a small denoise pass to remove speckles
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      // white-ish detection by distance from pure white (0..765 max) — tuned threshold
      const distFromWhite = 255 - r + (255 - g) + (255 - b);
      if (distFromWhite < 40) {
        data[i + 3] = 0; // near-white -> transparent
      }
    }

    // denoise: remove isolated pixels with few opaque neighbors (cleans noisy outline pixels)
    const cw = c.width,
      ch = c.height;
    const copy = new Uint8ClampedArray(data); // snapshot
    for (let y = 1; y < ch - 1; y++) {
      for (let x = 1; x < cw - 1; x++) {
        const idx = (y * cw + x) * 4 + 3; // alpha index
        if (copy[idx] === 0) continue; // already transparent
        // count opaque neighbors
        let count = 0;
        for (let ny = -1; ny <= 1; ny++) {
          for (let nx = -1; nx <= 1; nx++) {
            if (nx === 0 && ny === 0) continue;
            const nidx = ((y + ny) * cw + (x + nx)) * 4 + 3;
            if (copy[nidx] > 40) count++;
          }
        }
        // if less than 2 opaque neighbors, consider it a speck and remove
        if (count < 2) data[idx] = 0;
      }
    }
    cx.putImageData(id, 0, 0);
    carSpriteCanvas = c;
    // compute hit polygon from alpha mask
    carHitPolygon = buildHitPolygonFromImage(c, 4); // sample every 4px
    if (skinStatusEl) {
      if (carHitPolygon && carHitPolygon.length > 0)
        skinStatusEl.textContent = 'Skin ready: ferrari f1.png (hitbox computed)';
      else skinStatusEl.textContent = 'Skin ready: ferrari f1.png (no visible pixels found)';
    }
  } catch (e) {
    console.warn('processCarSprite failed', e);
  }
}

export function loadCarSprite(skinStatusEl) {
    carSprite.onload = () => {
        carSpriteLoaded = true;
        if (skinStatusEl) skinStatusEl.textContent = 'Skin ready: ferrari f1.png';
        processCarSprite(carSprite, skinStatusEl);
    };
    carSprite.onerror = () => {
        carSpriteLoaded = false;
        if (skinStatusEl) skinStatusEl.textContent = 'Skin not found';
    };
    // start loading (URL contains a space, encode it)
    carSprite.src = encodeURI('/assets/ferrari f1.png');
}
