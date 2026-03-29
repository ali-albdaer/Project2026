import { clamp, bilerp } from "../math.js";

export const CELL_FLUID = 0;
export const CELL_SOLID = 1;

export class MACGrid {
  constructor(nx, ny, width = 1, height = 1) {
    this.resize(nx, ny, width, height);
  }

  resize(nx, ny, width = 1, height = 1) {
    this.nx = Math.max(16, nx | 0);
    this.ny = Math.max(16, ny | 0);
    this.width = width;
    this.height = height;
    this.dx = width / this.nx;
    this.dy = height / this.ny;
    this.invDx = 1 / this.dx;
    this.invDy = 1 / this.dy;

    const uCount = (this.nx + 1) * this.ny;
    const vCount = this.nx * (this.ny + 1);
    const cCount = this.nx * this.ny;

    this.u = new Float32Array(uCount);
    this.v = new Float32Array(vCount);
    this.uTmp = new Float32Array(uCount);
    this.vTmp = new Float32Array(vCount);
    this.pressure = new Float32Array(cCount);
    this.divergence = new Float32Array(cCount);
    this.temperature = new Float32Array(cCount);
    this.vorticity = new Float32Array(cCount);
    this.cellType = new Uint8Array(cCount);
    this.solidVelX = new Float32Array(cCount);
    this.solidVelY = new Float32Array(cCount);

    this.clear();
  }

  clear() {
    this.u.fill(0);
    this.v.fill(0);
    this.uTmp.fill(0);
    this.vTmp.fill(0);
    this.pressure.fill(0);
    this.divergence.fill(0);
    this.temperature.fill(300);
    this.vorticity.fill(0);
    this.cellType.fill(CELL_FLUID);
    this.solidVelX.fill(0);
    this.solidVelY.fill(0);
  }

  c(i, j) {
    return i + this.nx * j;
  }

  uIdx(i, j) {
    return i + (this.nx + 1) * j;
  }

  vIdx(i, j) {
    return i + this.nx * j;
  }

  inCell(i, j) {
    return i >= 0 && j >= 0 && i < this.nx && j < this.ny;
  }

  cellCenterX(i) {
    return (i + 0.5) * this.dx;
  }

  cellCenterY(j) {
    return (j + 0.5) * this.dy;
  }

  sampleU(x, y, source = this.u) {
    const gx = x * this.invDx;
    const gy = y * this.invDy - 0.5;
    return bilerp(source, this.nx + 1, this.ny, gx, gy);
  }

  sampleV(x, y, source = this.v) {
    const gx = x * this.invDx - 0.5;
    const gy = y * this.invDy;
    return bilerp(source, this.nx, this.ny + 1, gx, gy);
  }

  sampleVelocity(x, y) {
    return {
      x: this.sampleU(x, y),
      y: this.sampleV(x, y)
    };
  }

  setInletFromFunctions(fx, fy, t) {
    const nx = this.nx;
    const ny = this.ny;

    for (let j = 0; j < ny; j += 1) {
      const y = (j + 0.5) * this.dy;
      this.u[this.uIdx(0, j)] = fx(0, y, t);
    }

    for (let i = 0; i < nx; i += 1) {
      const x = (i + 0.5) * this.dx;
      this.v[this.vIdx(i, 0)] = fy(x, 0, t);
      this.v[this.vIdx(i, ny)] = fy(x, 1, t);
    }
  }

  enforceDomainBoundaries(noSlipWalls = true) {
    const nx = this.nx;
    const ny = this.ny;

    for (let j = 0; j < ny; j += 1) {
      this.u[this.uIdx(0, j)] = this.u[this.uIdx(1, j)];
      this.u[this.uIdx(nx, j)] = this.u[this.uIdx(nx - 1, j)];
    }

    for (let i = 0; i < nx; i += 1) {
      if (noSlipWalls) {
        this.v[this.vIdx(i, 0)] = 0;
        this.v[this.vIdx(i, ny)] = 0;
      } else {
        this.v[this.vIdx(i, 0)] = this.v[this.vIdx(i, 1)];
        this.v[this.vIdx(i, ny)] = this.v[this.vIdx(i, ny - 1)];
      }
    }
  }

  centerSpeed(i, j) {
    const ux = 0.5 * (this.u[this.uIdx(i, j)] + this.u[this.uIdx(i + 1, j)]);
    const vy = 0.5 * (this.v[this.vIdx(i, j)] + this.v[this.vIdx(i, j + 1)]);
    return Math.sqrt(ux * ux + vy * vy);
  }

  maxCenterSpeed() {
    let m = 0;
    for (let j = 0; j < this.ny; j += 1) {
      for (let i = 0; i < this.nx; i += 1) {
        const c = this.c(i, j);
        if (this.cellType[c] === CELL_SOLID) {
          continue;
        }
        const s = this.centerSpeed(i, j);
        if (s > m) {
          m = s;
        }
      }
    }
    return m;
  }

  resetSolidMask() {
    this.cellType.fill(CELL_FLUID);
    this.solidVelX.fill(0);
    this.solidVelY.fill(0);
  }

  markSolidCell(i, j, vx, vy) {
    if (!this.inCell(i, j)) {
      return;
    }
    const c = this.c(i, j);
    this.cellType[c] = CELL_SOLID;
    this.solidVelX[c] = vx;
    this.solidVelY[c] = vy;
  }

  nearestCell(x, y) {
    return {
      i: clamp((x * this.invDx) | 0, 0, this.nx - 1),
      j: clamp((y * this.invDy) | 0, 0, this.ny - 1)
    };
  }
}
