import { clamp } from "../math.js";
import { CELL_SOLID } from "./grid.js";
import { computeEddyViscosity } from "./models.js";

export class FlowSolver {
  constructor(grid) {
    this.resize(grid);
  }

  resize(grid) {
    this.rhs = new Float32Array(grid.nx * grid.ny);
    this.cgR = new Float32Array(grid.nx * grid.ny);
    this.cgP = new Float32Array(grid.nx * grid.ny);
    this.cgAp = new Float32Array(grid.nx * grid.ny);
    this.tempSrc = new Float32Array(grid.nx * grid.ny);
    this.uSrc = new Float32Array((grid.nx + 1) * grid.ny);
    this.vSrc = new Float32Array(grid.nx * (grid.ny + 1));
  }

  step(state, dt, t) {
    const { grid, sim, flow, bodies } = state;

    if (this.rhs.length !== grid.nx * grid.ny) {
      this.resize(grid);
    }

    const maxSpeed = grid.maxCenterSpeed();
    const cflDt = sim.cfl * Math.min(grid.dx, grid.dy) / Math.max(maxSpeed, 1e-6);
    const useDt = Math.min(dt, sim.maxDt, cflDt);
    sim.lastDt = useDt;

    this.uSrc.set(grid.u);
    this.vSrc.set(grid.v);
    this.tempSrc.set(grid.temperature);

    this.advectVelocity(grid, this.uSrc, this.vSrc, useDt);
    this.advectTemperature(grid, useDt, sim.viscosity / Math.max(sim.prandtl, 0.25));

    flow.applyInlet(grid, t + useDt);
    this.applyExternalForces(state, useDt);

    const eddyNu = computeEddyViscosity(grid, sim.primarySolver, sim.viscosity);
    this.diffuseVelocity(grid, sim, useDt, eddyNu);

    bodies.rasterizeToGrid(grid);
    this.applyBodyVelocityConstraints(grid);

    if (sim.primarySolver === "vorticityProjection") {
      this.applyVorticityConfinement(grid, useDt, 0.35);
    }

    const pressureIters = sim.strictIncompressible ? sim.pressureIters : Math.max(20, (sim.pressureIters * 0.35) | 0);
    this.project(grid, useDt, sim, pressureIters);

    this.applyBodyVelocityConstraints(grid);
    grid.enforceDomainBoundaries(sim.noSlipWalls);
  }

  advectVelocity(grid, uSrc, vSrc, dt) {
    const nx = grid.nx;
    const ny = grid.ny;

    for (let j = 0; j < ny; j += 1) {
      const y = (j + 0.5) * grid.dy;
      for (let i = 0; i <= nx; i += 1) {
        const x = i * grid.dx;
        const v1x = grid.sampleU(x, y, uSrc);
        const v1y = grid.sampleV(x, y, vSrc);

        const xMid = clamp(x - 0.5 * dt * v1x, 0, 1);
        const yMid = clamp(y - 0.5 * dt * v1y, 0, 1);

        const v2x = grid.sampleU(xMid, yMid, uSrc);
        const v2y = grid.sampleV(xMid, yMid, vSrc);

        const xb = clamp(x - dt * v2x, 0, 1);
        const yb = clamp(y - dt * v2y, 0, 1);

        grid.uTmp[grid.uIdx(i, j)] = grid.sampleU(xb, yb, uSrc);
      }
    }

    for (let j = 0; j <= ny; j += 1) {
      const y = j * grid.dy;
      for (let i = 0; i < nx; i += 1) {
        const x = (i + 0.5) * grid.dx;
        const v1x = grid.sampleU(x, y, uSrc);
        const v1y = grid.sampleV(x, y, vSrc);

        const xMid = clamp(x - 0.5 * dt * v1x, 0, 1);
        const yMid = clamp(y - 0.5 * dt * v1y, 0, 1);

        const v2x = grid.sampleU(xMid, yMid, uSrc);
        const v2y = grid.sampleV(xMid, yMid, vSrc);

        const xb = clamp(x - dt * v2x, 0, 1);
        const yb = clamp(y - dt * v2y, 0, 1);

        grid.vTmp[grid.vIdx(i, j)] = grid.sampleV(xb, yb, vSrc);
      }
    }

    const uSwap = grid.u;
    grid.u = grid.uTmp;
    grid.uTmp = uSwap;

    const vSwap = grid.v;
    grid.v = grid.vTmp;
    grid.vTmp = vSwap;
  }

  advectTemperature(grid, dt, alpha) {
    const nx = grid.nx;
    const ny = grid.ny;

    for (let j = 0; j < ny; j += 1) {
      const y = (j + 0.5) * grid.dy;
      for (let i = 0; i < nx; i += 1) {
        const x = (i + 0.5) * grid.dx;
        const vel = grid.sampleVelocity(x, y);
        const xb = clamp(x - dt * vel.x, 0, 1);
        const yb = clamp(y - dt * vel.y, 0, 1);

        const gx = xb * grid.invDx - 0.5;
        const gy = yb * grid.invDy - 0.5;
        grid.temperature[grid.c(i, j)] = this.bilerpCell(grid, this.tempSrc, gx, gy);
      }
    }

    const ax = alpha * dt * grid.invDx * grid.invDx;
    const ay = alpha * dt * grid.invDy * grid.invDy;

    for (let iter = 0; iter < 4; iter += 1) {
      for (let j = 1; j < ny - 1; j += 1) {
        for (let i = 1; i < nx - 1; i += 1) {
          const c = grid.c(i, j);
          if (grid.cellType[c] === CELL_SOLID) {
            continue;
          }

          const sum = ax * (grid.temperature[grid.c(i - 1, j)] + grid.temperature[grid.c(i + 1, j)]) +
            ay * (grid.temperature[grid.c(i, j - 1)] + grid.temperature[grid.c(i, j + 1)]);

          grid.temperature[c] = (this.tempSrc[c] + sum) / (1 + 2 * ax + 2 * ay);
        }
      }
    }
  }

  applyExternalForces(state, dt) {
    const { grid, sim } = state;
    const nx = grid.nx;
    const ny = grid.ny;

    if (sim.boussinesq) {
      const beta = 1 / Math.max(sim.temperature, 1);
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          const c = grid.c(i, j);
          if (grid.cellType[c] === CELL_SOLID) {
            continue;
          }
          const buoyancy = sim.gravity * beta * (grid.temperature[c] - sim.temperature);
          grid.v[grid.vIdx(i, j)] += dt * buoyancy;
          grid.v[grid.vIdx(i, j + 1)] += dt * buoyancy;
        }
      }
    }
  }

  effectiveNu(sim, speed, eddyNu) {
    let nu = sim.viscosity + eddyNu;
    if (sim.inviscidCore && speed > 0.9 * Math.abs(sim.uxInf || 1)) {
      nu *= 0.22;
    }
    return nu;
  }

  diffuseVelocity(grid, sim, dt, eddyNu) {
    const nx = grid.nx;
    const ny = grid.ny;

    this.uSrc.set(grid.u);
    this.vSrc.set(grid.v);

    const idx2 = grid.invDx * grid.invDx;
    const idy2 = grid.invDy * grid.invDy;

    for (let iter = 0; iter < 8; iter += 1) {
      for (let j = 1; j < ny - 1; j += 1) {
        for (let i = 1; i < nx; i += 1) {
          const cL = grid.c(i - 1, j);
          const cR = grid.c(i, j);
          if (grid.cellType[cL] === CELL_SOLID || grid.cellType[cR] === CELL_SOLID) {
            continue;
          }

          const ux = 0.5 * (grid.u[grid.uIdx(i, j)] + grid.u[grid.uIdx(i, j)]);
          const nuFace = this.effectiveNu(sim, Math.abs(ux), 0.5 * (eddyNu[cL] + eddyNu[cR]));
          const aX = dt * nuFace * idx2;
          const aY = dt * nuFace * idy2;

          const center = grid.uIdx(i, j);
          const sum = aX * (grid.u[grid.uIdx(i - 1, j)] + grid.u[grid.uIdx(i + 1, j)]) +
            aY * (grid.u[grid.uIdx(i, j - 1)] + grid.u[grid.uIdx(i, j + 1)]);

          grid.u[center] = (this.uSrc[center] + sum) / (1 + 2 * aX + 2 * aY);
        }
      }

      for (let j = 1; j < ny; j += 1) {
        for (let i = 1; i < nx - 1; i += 1) {
          const cB = grid.c(i, j - 1);
          const cT = grid.c(i, j);
          if (grid.cellType[cB] === CELL_SOLID || grid.cellType[cT] === CELL_SOLID) {
            continue;
          }

          const vy = 0.5 * (grid.v[grid.vIdx(i, j)] + grid.v[grid.vIdx(i, j)]);
          const nuFace = this.effectiveNu(sim, Math.abs(vy), 0.5 * (eddyNu[cB] + eddyNu[cT]));
          const aX = dt * nuFace * idx2;
          const aY = dt * nuFace * idy2;

          const center = grid.vIdx(i, j);
          const sum = aX * (grid.v[grid.vIdx(i - 1, j)] + grid.v[grid.vIdx(i + 1, j)]) +
            aY * (grid.v[grid.vIdx(i, j - 1)] + grid.v[grid.vIdx(i, j + 1)]);

          grid.v[center] = (this.vSrc[center] + sum) / (1 + 2 * aX + 2 * aY);
        }
      }
    }
  }

  applyBodyVelocityConstraints(grid) {
    const nx = grid.nx;
    const ny = grid.ny;

    for (let j = 0; j < ny; j += 1) {
      for (let i = 1; i < nx; i += 1) {
        const cL = grid.c(i - 1, j);
        const cR = grid.c(i, j);
        const sL = grid.cellType[cL] === CELL_SOLID;
        const sR = grid.cellType[cR] === CELL_SOLID;
        if (!sL && !sR) {
          continue;
        }

        const vx = sL && sR
          ? 0.5 * (grid.solidVelX[cL] + grid.solidVelX[cR])
          : sL
            ? grid.solidVelX[cL]
            : grid.solidVelX[cR];

        grid.u[grid.uIdx(i, j)] = vx;
      }
    }

    for (let j = 1; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const cB = grid.c(i, j - 1);
        const cT = grid.c(i, j);
        const sB = grid.cellType[cB] === CELL_SOLID;
        const sT = grid.cellType[cT] === CELL_SOLID;
        if (!sB && !sT) {
          continue;
        }

        const vy = sB && sT
          ? 0.5 * (grid.solidVelY[cB] + grid.solidVelY[cT])
          : sB
            ? grid.solidVelY[cB]
            : grid.solidVelY[cT];

        grid.v[grid.vIdx(i, j)] = vy;
      }
    }

    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] !== CELL_SOLID) {
          continue;
        }
        grid.pressure[c] = 0;
      }
    }
  }

  computeDivergenceAndRhs(grid, dt, density) {
    const nx = grid.nx;
    const ny = grid.ny;
    const scale = density / Math.max(dt, 1e-8);

    for (let j = 0; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          this.rhs[c] = 0;
          continue;
        }

        const div = (grid.u[grid.uIdx(i + 1, j)] - grid.u[grid.uIdx(i, j)]) * grid.invDx +
          (grid.v[grid.vIdx(i, j + 1)] - grid.v[grid.vIdx(i, j)]) * grid.invDy;

        grid.divergence[c] = div;
        this.rhs[c] = scale * div;
      }
    }
  }

  project(grid, dt, sim, pressureIters) {
    this.computeDivergenceAndRhs(grid, dt, sim.density);

    if (sim.pressureSolver === "pcg") {
      this.solvePressurePCG(grid, pressureIters, 1e-5);
    } else {
      this.solvePressureSOR(grid, pressureIters, sim.sorOmega);
    }

    this.subtractPressureGradient(grid, dt, sim.density);
  }

  solvePressureSOR(grid, iters, omega) {
    const nx = grid.nx;
    const ny = grid.ny;

    const idx2 = grid.invDx * grid.invDx;
    const idy2 = grid.invDy * grid.invDy;

    for (let iter = 0; iter < iters; iter += 1) {
      for (let color = 0; color < 2; color += 1) {
        for (let j = 1; j < ny - 1; j += 1) {
          const iStart = 1 + ((j + color) & 1);
          for (let i = iStart; i < nx - 1; i += 2) {
            const c = grid.c(i, j);
            if (grid.cellType[c] === CELL_SOLID) {
              continue;
            }

            const cL = grid.c(i - 1, j);
            const cR = grid.c(i + 1, j);
            const cB = grid.c(i, j - 1);
            const cT = grid.c(i, j + 1);

            const pL = grid.cellType[cL] === CELL_SOLID ? grid.pressure[c] : grid.pressure[cL];
            const pR = grid.cellType[cR] === CELL_SOLID ? grid.pressure[c] : grid.pressure[cR];
            const pB = grid.cellType[cB] === CELL_SOLID ? grid.pressure[c] : grid.pressure[cB];
            const pT = grid.cellType[cT] === CELL_SOLID ? grid.pressure[c] : grid.pressure[cT];

            const denom = 2 * (idx2 + idy2);
            const pStar = ((pL + pR) * idx2 + (pB + pT) * idy2 - this.rhs[c]) / denom;
            grid.pressure[c] += omega * (pStar - grid.pressure[c]);
          }
        }
      }
    }
  }

  applyPoisson(grid, x, out) {
    const nx = grid.nx;
    const ny = grid.ny;
    const idx2 = grid.invDx * grid.invDx;
    const idy2 = grid.invDy * grid.invDy;

    out.fill(0);

    for (let j = 1; j < ny - 1; j += 1) {
      for (let i = 1; i < nx - 1; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          continue;
        }

        const cL = grid.c(i - 1, j);
        const cR = grid.c(i + 1, j);
        const cB = grid.c(i, j - 1);
        const cT = grid.c(i, j + 1);

        const xL = grid.cellType[cL] === CELL_SOLID ? x[c] : x[cL];
        const xR = grid.cellType[cR] === CELL_SOLID ? x[c] : x[cR];
        const xB = grid.cellType[cB] === CELL_SOLID ? x[c] : x[cB];
        const xT = grid.cellType[cT] === CELL_SOLID ? x[c] : x[cT];

        out[c] = (xL - 2 * x[c] + xR) * idx2 + (xB - 2 * x[c] + xT) * idy2;
      }
    }
  }

  dotFluid(grid, a, b) {
    let sum = 0;
    for (let j = 1; j < grid.ny - 1; j += 1) {
      for (let i = 1; i < grid.nx - 1; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          continue;
        }
        sum += a[c] * b[c];
      }
    }
    return sum;
  }

  solvePressurePCG(grid, maxIters, tol) {
    const p = grid.pressure;
    const r = this.cgR;
    const d = this.cgP;
    const q = this.cgAp;

    this.applyPoisson(grid, p, q);

    for (let i = 0; i < r.length; i += 1) {
      r[i] = this.rhs[i] - q[i];
      d[i] = r[i];
    }

    let rr = this.dotFluid(grid, r, r);
    const rhsNorm = Math.sqrt(Math.max(this.dotFluid(grid, this.rhs, this.rhs), 1e-18));

    if (Math.sqrt(rr) <= tol * rhsNorm) {
      return;
    }

    for (let iter = 0; iter < maxIters; iter += 1) {
      this.applyPoisson(grid, d, q);
      const dq = this.dotFluid(grid, d, q);
      const alpha = rr / Math.max(dq, 1e-20);

      for (let i = 0; i < p.length; i += 1) {
        p[i] += alpha * d[i];
        r[i] -= alpha * q[i];
      }

      const rrNew = this.dotFluid(grid, r, r);
      if (Math.sqrt(rrNew) <= tol * rhsNorm) {
        break;
      }

      const beta = rrNew / Math.max(rr, 1e-20);
      for (let i = 0; i < d.length; i += 1) {
        d[i] = r[i] + beta * d[i];
      }

      rr = rrNew;
    }
  }

  subtractPressureGradient(grid, dt, density) {
    const nx = grid.nx;
    const ny = grid.ny;
    const scaleX = dt / Math.max(density * grid.dx, 1e-8);
    const scaleY = dt / Math.max(density * grid.dy, 1e-8);

    for (let j = 0; j < ny; j += 1) {
      for (let i = 1; i < nx; i += 1) {
        const cL = grid.c(i - 1, j);
        const cR = grid.c(i, j);
        if (grid.cellType[cL] === CELL_SOLID || grid.cellType[cR] === CELL_SOLID) {
          continue;
        }

        const gradP = grid.pressure[cR] - grid.pressure[cL];
        grid.u[grid.uIdx(i, j)] -= scaleX * gradP;
      }
    }

    for (let j = 1; j < ny; j += 1) {
      for (let i = 0; i < nx; i += 1) {
        const cB = grid.c(i, j - 1);
        const cT = grid.c(i, j);
        if (grid.cellType[cB] === CELL_SOLID || grid.cellType[cT] === CELL_SOLID) {
          continue;
        }

        const gradP = grid.pressure[cT] - grid.pressure[cB];
        grid.v[grid.vIdx(i, j)] -= scaleY * gradP;
      }
    }
  }

  applyVorticityConfinement(grid, dt, epsilon) {
    const nx = grid.nx;
    const ny = grid.ny;

    for (let j = 1; j < ny - 1; j += 1) {
      for (let i = 1; i < nx - 1; i += 1) {
        const c = grid.c(i, j);
        if (grid.cellType[c] === CELL_SOLID) {
          continue;
        }

        const w = this.localVorticity(grid, i, j);
        const gradWx = Math.abs(this.localVorticity(grid, i + 1, j)) - Math.abs(this.localVorticity(grid, i - 1, j));
        const gradWy = Math.abs(this.localVorticity(grid, i, j + 1)) - Math.abs(this.localVorticity(grid, i, j - 1));

        const len = Math.hypot(gradWx, gradWy);
        if (len < 1e-8) {
          continue;
        }

        const nxw = gradWx / len;
        const nyw = gradWy / len;

        const fx = epsilon * nyw * w;
        const fy = -epsilon * nxw * w;

        grid.u[grid.uIdx(i, j)] += dt * fx;
        grid.u[grid.uIdx(i + 1, j)] += dt * fx;
        grid.v[grid.vIdx(i, j)] += dt * fy;
        grid.v[grid.vIdx(i, j + 1)] += dt * fy;
      }
    }
  }

  localVorticity(grid, i, j) {
    const duDy = (
      (grid.u[grid.uIdx(i, j + 1)] + grid.u[grid.uIdx(i + 1, j + 1)]) -
      (grid.u[grid.uIdx(i, j - 1)] + grid.u[grid.uIdx(i + 1, j - 1)])
    ) * 0.5 * 0.5 * grid.invDy;

    const dvDx = (
      (grid.v[grid.vIdx(i + 1, j)] + grid.v[grid.vIdx(i + 1, j + 1)]) -
      (grid.v[grid.vIdx(i - 1, j)] + grid.v[grid.vIdx(i - 1, j + 1)])
    ) * 0.5 * 0.5 * grid.invDx;

    return dvDx - duDy;
  }

  bilerpCell(grid, data, gx, gy) {
    const x = clamp(gx, 0, grid.nx - 1.001);
    const y = clamp(gy, 0, grid.ny - 1.001);
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = x - x0;
    const ty = y - y0;

    const c00 = data[grid.c(x0, y0)];
    const c10 = data[grid.c(x1, y0)];
    const c01 = data[grid.c(x0, y1)];
    const c11 = data[grid.c(x1, y1)];

    const a = c00 + (c10 - c00) * tx;
    const b = c01 + (c11 - c01) * tx;
    return a + (b - a) * ty;
  }
}
