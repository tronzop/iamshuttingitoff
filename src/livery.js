// Liveries for the player car. The sprite sheet in assets/ is a Ferrari; every other team is
// a palette swap of it, built once on an offscreen canvas: the saturated reds become the
// team's primary colour (shading preserved) and the orange/yellow details — wheel rims, the
// badge — become the accent. Anything that cannot be recoloured (a tainted canvas when the
// page is opened from disk) returns null and the renderer falls back to the vector car.
import { drawVectorCar } from './render.js';
import { teamOfCar } from './cars.js';

const cache = new Map(); // team id -> canvas | null

const hexRgb = (h) => {
  const s = h.replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
/** Hue (degrees), saturation and value (0..1) of an rgb triple. */
export function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}
/** Which paint a source pixel takes: 'primary' for the red body, 'accent' for orange/yellow details, null to leave alone. */
export function classifyPixel(r, g, b, a) {
  if (a < 40) return null;
  const [h, s, v] = hsv(r, g, b);
  if (s < 0.45 || v < 0.18) return null; // greys, blacks, the white lettering
  if (h >= 340 || h <= 12) return 'primary';
  if (h > 12 && h <= 62) return 'accent';
  return null;
}
/**
 * Recolours one source pixel to `paint` ([r,g,b]) keeping the sprite's shading: value scales
 * the paint, and low-saturation highlights pull towards white.
 */
export function recolour(r, g, b, paint) {
  const [, s, v] = hsv(r, g, b);
  const shade = Math.min(1.25, v / 0.82);
  const hl = Math.max(0, (0.7 - s) / 0.7) * 0.85; // glossy highlight on the source
  return paint.map((c) => Math.round(Math.min(255, (c * shade) * (1 - hl) + 255 * shade * hl)));
}

/** Sprite sheet for a car: the original for Ferrari, a recoloured copy for everyone else; null if recolouring is impossible. */
export function liverySheet(sheet, car) {
  if (!sheet || !sheet.complete || !sheet.naturalWidth) return null;
  if (car.team === 'ferrari') return sheet;
  if (cache.has(car.team)) return cache.get(car.team);
  let out = null;
  try {
    const team = teamOfCar(car);
    const c = document.createElement('canvas');
    c.width = sheet.naturalWidth;
    c.height = sheet.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(sheet, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height); // throws on a tainted canvas (file://)
    const d = img.data;
    const primary = hexRgb(team.primary);
    const accent = hexRgb(team.accent);
    for (let i = 0; i < d.length; i += 4) {
      const kind = classifyPixel(d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (!kind) continue;
      const [r, g, b] = recolour(d[i], d[i + 1], d[i + 2], kind === 'primary' ? primary : accent);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(img, 0, 0);
    out = c;
  } catch {
    out = null;
  }
  cache.set(car.team, out);
  return out;
}

/**
 * Draws a car facing right into `ctx` centred on (0,0) at w×h: the livery sprite when we have
 * one, the vector car in team colours otherwise. `frame` picks the wheel-spin frame.
 */
export function drawLivery(ctx, sheet, frames, car, w, h, frame = 0) {
  const s = liverySheet(sheet, car);
  if (s) {
    const fw = s.width || s.naturalWidth;
    const fh = (s.height || s.naturalHeight) / frames;
    const fi = Math.floor(frame) % frames;
    ctx.scale(-1, 1); // the sprite faces left; we drive right
    ctx.drawImage(s, 0, fi * fh, fw, fh, -w / 2, -h / 2, w, h);
    ctx.scale(-1, 1);
    return true;
  }
  drawVectorCar(ctx, w, h, teamOfCar(car), frame);
  return false;
}
