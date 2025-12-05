// particle smoke system for rear of car
const particles = [];
export function spawnSmoke(x, y, vx, vy, size, life, alpha) {
  particles.push({ x, y, vx, vy, size, life, age: 0, alpha });
}

export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.size += dt * 6;
  }
}

export function drawParticles(ctx) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const t = 1 - p.age / p.life;
    ctx.save();
    ctx.globalAlpha = p.alpha * t;
    const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.size);
    const c = Math.floor(120 + t * 60); // smoke color range
    g.addColorStop(0, `rgba(${c},${c},${c},${0.9 * t})`);
    g.addColorStop(1, `rgba(${c},${c},${c},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
