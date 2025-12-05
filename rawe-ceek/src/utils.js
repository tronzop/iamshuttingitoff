// geometry helpers
export function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 0.0000001) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distToSegmentSq(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1,
    vy = y2 - y1;
  const wx = px - x1,
    wy = py - y1;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return wx * wx + wy * wy;
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) {
    const dx = px - x2,
      dy = py - y2;
    return dx * dx + dy * dy;
  }
  const t = c1 / c2;
  const projx = x1 + vx * t,
    projy = y1 + vy * t;
  const dx = px - projx,
    dy = py - projy;
  return dx * dx + dy * dy;
}

export function circleIntersectsPolygon(cx, cy, r, poly) {
  if (!poly || poly.length === 0) return false;
  // if center inside polygon, collision true
  if (pointInPolygon(cx, cy, poly)) return true;
  const r2 = r * r;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    if (distToSegmentSq(cx, cy, a.x, a.y, b.x, b.y) <= r2) return true;
  }
  return false;
}

// helper: compute convex hull (monotone chain) for a set of 2D points
export function convexHull(points) {
  if (!points || points.length <= 2) return points.slice();
  const pts = points.slice().sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function rand(min, max) {
  return Math.random() * (max - min) + min;
}
