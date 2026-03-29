import { clamp, rotateToLocal } from "../math.js";

function sdfCircle(x, y, r) {
  return Math.hypot(x, y) - r;
}

function sdfBox(x, y, hx, hy) {
  const qx = Math.abs(x) - hx;
  const qy = Math.abs(y) - hy;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0);
}

function sdfDiamond(x, y, a, b) {
  return (Math.abs(x) / Math.max(a, 1e-6)) + (Math.abs(y) / Math.max(b, 1e-6)) - 1;
}

function sdfAirfoil(x, y, chord, thickness) {
  const xNorm = clamp((x / chord) + 0.5, 0, 1);
  const t = clamp(thickness / Math.max(chord, 1e-6), 0.02, 0.25);

  const yt = 5 * t * (
    0.2969 * Math.sqrt(Math.max(xNorm, 0)) -
    0.1260 * xNorm -
    0.3516 * xNorm * xNorm +
    0.2843 * xNorm * xNorm * xNorm -
    0.1015 * xNorm * xNorm * xNorm * xNorm
  );

  const upper = yt * chord;
  const lower = -upper;
  const yAbsDist = y > upper ? y - upper : y < lower ? lower - y : -Math.min(upper - y, y - lower);

  const leadTrailDist = x < -0.5 * chord
    ? -0.5 * chord - x
    : x > 0.5 * chord
      ? x - 0.5 * chord
      : 0;

  if (leadTrailDist > 0 && yAbsDist > 0) {
    return Math.hypot(leadTrailDist, yAbsDist);
  }

  return Math.max(leadTrailDist, yAbsDist);
}

export class Body {
  constructor(params) {
    this.id = params.id;
    this.type = params.type;
    this.x = params.x;
    this.y = params.y;
    this.vx = params.vx || 0;
    this.vy = params.vy || 0;
    this.ax = 0;
    this.ay = 0;
    this.angle = params.angle || 0;
    this.omega = params.omega || 0;
    this.mass = Math.max(params.mass || 1, 1e-3);
    this.sizeA = Math.max(params.sizeA || 0.05, 0.004);
    this.sizeB = Math.max(params.sizeB || 0.02, 0.002);
    this.dragging = false;
  }

  sdf(worldX, worldY) {
    const cosA = Math.cos(this.angle);
    const sinA = Math.sin(this.angle);
    const p = rotateToLocal(worldX, worldY, this.x, this.y, cosA, sinA);

    switch (this.type) {
      case "sphere":
      case "cylinder":
        return sdfCircle(p.x, p.y, this.sizeA);
      case "rectangle":
        return sdfBox(p.x, p.y, this.sizeA, this.sizeB);
      case "flatPlate":
        return sdfBox(p.x, p.y, this.sizeA, Math.max(0.004, this.sizeB * 0.2));
      case "diamond":
        return sdfDiamond(p.x, p.y, this.sizeA, this.sizeB) * Math.min(this.sizeA, this.sizeB);
      case "airfoil":
        return sdfAirfoil(p.x, p.y, Math.max(this.sizeA * 2, 0.01), Math.max(this.sizeB, 0.004));
      default:
        return sdfCircle(p.x, p.y, this.sizeA);
    }
  }

  contains(worldX, worldY) {
    return this.sdf(worldX, worldY) <= 0;
  }

  velocityAt(worldX, worldY) {
    const rx = worldX - this.x;
    const ry = worldY - this.y;
    return {
      x: this.vx - this.omega * ry,
      y: this.vy + this.omega * rx
    };
  }

  boundingBox() {
    const r = Math.max(this.sizeA, this.sizeB) * 1.75;
    return {
      minX: clamp(this.x - r, 0, 1),
      minY: clamp(this.y - r, 0, 1),
      maxX: clamp(this.x + r, 0, 1),
      maxY: clamp(this.y + r, 0, 1)
    };
  }

  integrate(dt) {
    if (this.dragging) {
      this.ax = 0;
      this.ay = 0;
      this.omega *= 0.85;
      return;
    }

    this.vx += this.ax * dt;
    this.vy += this.ay * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle += this.omega * dt;

    this.vx *= 0.998;
    this.vy *= 0.998;
    this.omega *= 0.995;

    const wall = Math.max(this.sizeA, this.sizeB) * 0.6;
    if (this.x < wall || this.x > 1 - wall) {
      this.vx *= -0.5;
      this.x = clamp(this.x, wall, 1 - wall);
    }
    if (this.y < wall || this.y > 1 - wall) {
      this.vy *= -0.5;
      this.y = clamp(this.y, wall, 1 - wall);
    }

    this.ax = 0;
    this.ay = 0;
  }
}

export class BodyManager {
  constructor() {
    this.bodies = [];
    this.nextId = 1;
  }

  addBody(params) {
    const body = new Body({
      ...params,
      id: this.nextId
    });
    this.nextId += 1;
    this.bodies.push(body);
    return body;
  }

  removeBody(id) {
    const idx = this.bodies.findIndex((b) => b.id === id);
    if (idx >= 0) {
      this.bodies.splice(idx, 1);
      return true;
    }
    return false;
  }

  clear() {
    this.bodies.length = 0;
  }

  pickBody(x, y) {
    let picked = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = this.bodies.length - 1; i >= 0; i -= 1) {
      const b = this.bodies[i];
      if (!b.contains(x, y)) {
        continue;
      }
      const d = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
      if (d < bestDist) {
        bestDist = d;
        picked = b;
      }
    }
    return picked;
  }

  rasterizeToGrid(grid) {
    grid.resetSolidMask();

    for (let b = 0; b < this.bodies.length; b += 1) {
      const body = this.bodies[b];
      const bb = body.boundingBox();
      const iMin = clamp((bb.minX * grid.invDx) | 0, 0, grid.nx - 1);
      const iMax = clamp((bb.maxX * grid.invDx) | 0, 0, grid.nx - 1);
      const jMin = clamp((bb.minY * grid.invDy) | 0, 0, grid.ny - 1);
      const jMax = clamp((bb.maxY * grid.invDy) | 0, 0, grid.ny - 1);

      for (let j = jMin; j <= jMax; j += 1) {
        const cy = grid.cellCenterY(j);
        for (let i = iMin; i <= iMax; i += 1) {
          const cx = grid.cellCenterX(i);
          if (body.contains(cx, cy)) {
            const vel = body.velocityAt(cx, cy);
            grid.markSolidCell(i, j, vel.x, vel.y);
          }
        }
      }
    }
  }

  integrate(dt) {
    for (let i = 0; i < this.bodies.length; i += 1) {
      this.bodies[i].integrate(dt);
    }
  }
}
