import { clamp } from '../util.js';

// Classic semi-Lagrangian stable fluids (Jos Stam style), on an N x N grid.
// Fields are stored in 1D arrays length N*N.

export class StableFluid2D {
  constructor(n) {
    this.resize(n);
    this.boundary = 'walls'; // 'walls' | 'periodic'
  }

  resize(n) {
    this.n = n;
    const size = n * n;

    this.u = new Float32Array(size);
    this.v = new Float32Array(size);
    this.u0 = new Float32Array(size);
    this.v0 = new Float32Array(size);

    this.p = new Float32Array(size);
    this.div = new Float32Array(size);

    this.rho = new Float32Array(size);
    this.rho0 = new Float32Array(size);

    this.temp = new Float32Array(size);
    this.temp0 = new Float32Array(size);

    this.vort = new Float32Array(size);
    this.psi = new Float32Array(size);

    this.dt = 0.016;
    this.visc = 0.001;
    this.diff = 0.0005;

    this.solverIters = 30;
  }

  idx(x, y) {
    return x + y * this.n;
  }

  setBoundaryMode(mode) {
    this.boundary = mode;
  }

  clear() {
    this.u.fill(0); this.v.fill(0);
    this.u0.fill(0); this.v0.fill(0);
    this.p.fill(0); this.div.fill(0);
    this.rho.fill(0); this.rho0.fill(0);
    this.temp.fill(0); this.temp0.fill(0);
    this.vort.fill(0);
    this.psi.fill(0);
  }

  addVelocity(x, y, du, dv, radius = 3) {
    const n = this.n;
    const rr = radius * radius;
    const x0 = Math.max(0, Math.floor(x - radius));
    const x1 = Math.min(n - 1, Math.ceil(x + radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const y1 = Math.min(n - 1, Math.ceil(y + radius));

    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const dx = i - x;
        const dy = j - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr) continue;
        const w = Math.exp(-d2 / (rr * 0.35 + 1e-6));
        const id = this.idx(i, j);
        this.u[id] += du * w;
        this.v[id] += dv * w;
      }
    }
  }

  addScalar(field, x, y, amount, radius = 3) {
    const n = this.n;
    const rr = radius * radius;
    const x0 = Math.max(0, Math.floor(x - radius));
    const x1 = Math.min(n - 1, Math.ceil(x + radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const y1 = Math.min(n - 1, Math.ceil(y + radius));

    for (let j = y0; j <= y1; j++) {
      for (let i = x0; i <= x1; i++) {
        const dx = i - x;
        const dy = j - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > rr) continue;
        const w = Math.exp(-d2 / (rr * 0.35 + 1e-6));
        const id = this.idx(i, j);
        field[id] += amount * w;
      }
    }
  }

  step({ dt = this.dt, visc = this.visc, diff = this.diff } = {}) {
    const n = this.n;

    // Velocity
    this.diffuse(1, this.u0, this.u, visc, dt);
    this.diffuse(2, this.v0, this.v, visc, dt);
    this.project(this.u0, this.v0, this.p, this.div);

    this.advect(1, this.u, this.u0, this.u0, this.v0, dt);
    this.advect(2, this.v, this.v0, this.u0, this.v0, dt);
    this.project(this.u, this.v, this.p, this.div);

    // Scalars (density, temperature) as passive by default
    this.diffuseScalar(this.rho0, this.rho, diff, dt);
    this.advectScalar(this.rho, this.rho0, this.u, this.v, dt);

    this.diffuseScalar(this.temp0, this.temp, diff, dt);
    this.advectScalar(this.temp, this.temp0, this.u, this.v, dt);

    // Derived
    this.computeVorticity();
    this.computeStreamFunction();

    // Keep numbers bounded
    for (let k = 0; k < n * n; k++) {
      this.rho[k] = clamp(this.rho[k], -1e4, 1e4);
      this.temp[k] = clamp(this.temp[k], -1e4, 1e4);
      this.u[k] = clamp(this.u[k], -1e4, 1e4);
      this.v[k] = clamp(this.v[k], -1e4, 1e4);
    }
  }

  // --- Numerics ---

  setB(b, x) {
    const n = this.n;
    if (this.boundary === 'periodic') {
      // Nothing special needed for periodic in this simple implementation
      // because sampling and Laplacian use wrap/clamp; we implement wrap in sampling.
      return;
    }

    // walls: reflect normal component at edges.
    for (let i = 1; i < n - 1; i++) {
      x[this.idx(i, 0)] = b === 2 ? -x[this.idx(i, 1)] : x[this.idx(i, 1)];
      x[this.idx(i, n - 1)] = b === 2 ? -x[this.idx(i, n - 2)] : x[this.idx(i, n - 2)];
      x[this.idx(0, i)] = b === 1 ? -x[this.idx(1, i)] : x[this.idx(1, i)];
      x[this.idx(n - 1, i)] = b === 1 ? -x[this.idx(n - 2, i)] : x[this.idx(n - 2, i)];
    }

    x[this.idx(0, 0)] = 0.5 * (x[this.idx(1, 0)] + x[this.idx(0, 1)]);
    x[this.idx(0, n - 1)] = 0.5 * (x[this.idx(1, n - 1)] + x[this.idx(0, n - 2)]);
    x[this.idx(n - 1, 0)] = 0.5 * (x[this.idx(n - 2, 0)] + x[this.idx(n - 1, 1)]);
    x[this.idx(n - 1, n - 1)] = 0.5 * (x[this.idx(n - 2, n - 1)] + x[this.idx(n - 1, n - 2)]);
  }

  linSolve(b, x, x0, a, c) {
    const n = this.n;
    const iters = this.solverIters;

    for (let k = 0; k < iters; k++) {
      for (let j = 1; j < n - 1; j++) {
        for (let i = 1; i < n - 1; i++) {
          const id = this.idx(i, j);
          x[id] = (x0[id] + a * (
            x[this.idx(i - 1, j)] + x[this.idx(i + 1, j)] + x[this.idx(i, j - 1)] + x[this.idx(i, j + 1)]
          )) / c;
        }
      }
      this.setB(b, x);
    }
  }

  diffuse(b, x, x0, diff, dt) {
    const n = this.n;
    const a = dt * diff * (n - 2) * (n - 2);
    this.linSolve(b, x, x0, a, 1 + 4 * a);
  }

  diffuseScalar(x, x0, diff, dt) {
    const n = this.n;
    const a = dt * diff * (n - 2) * (n - 2);
    this.linSolve(0, x, x0, a, 1 + 4 * a);
  }

  sampleField(field, x, y) {
    const n = this.n;

    if (this.boundary === 'periodic') {
      // wrap to [0, n)
      x = ((x % n) + n) % n;
      y = ((y % n) + n) % n;
    } else {
      x = clamp(x, 0.5, n - 1.5);
      y = clamp(y, 0.5, n - 1.5);
    }

    const i0 = Math.floor(x);
    const j0 = Math.floor(y);
    const i1 = i0 + 1;
    const j1 = j0 + 1;
    const s1 = x - i0;
    const s0 = 1 - s1;
    const t1 = y - j0;
    const t0 = 1 - t1;

    const ii0 = this.boundary === 'periodic' ? (i0 + n) % n : clamp(i0, 0, n - 1);
    const ii1 = this.boundary === 'periodic' ? (i1 + n) % n : clamp(i1, 0, n - 1);
    const jj0 = this.boundary === 'periodic' ? (j0 + n) % n : clamp(j0, 0, n - 1);
    const jj1 = this.boundary === 'periodic' ? (j1 + n) % n : clamp(j1, 0, n - 1);

    const a = field[this.idx(ii0, jj0)];
    const b = field[this.idx(ii1, jj0)];
    const c = field[this.idx(ii0, jj1)];
    const d = field[this.idx(ii1, jj1)];

    return s0 * (t0 * a + t1 * c) + s1 * (t0 * b + t1 * d);
  }

  advect(b, d, d0, u, v, dt) {
    const n = this.n;
    const dt0 = dt * (n - 2);

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const id = this.idx(i, j);
        const x = i - dt0 * u[id];
        const y = j - dt0 * v[id];
        d[id] = this.sampleField(d0, x, y);
      }
    }

    this.setB(b, d);
  }

  advectScalar(d, d0, u, v, dt) {
    const n = this.n;
    const dt0 = dt * (n - 2);

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const id = this.idx(i, j);
        const x = i - dt0 * u[id];
        const y = j - dt0 * v[id];
        d[id] = this.sampleField(d0, x, y);
      }
    }

    this.setB(0, d);
  }

  project(u, v, p, div) {
    const n = this.n;

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const id = this.idx(i, j);
        div[id] = -0.5 * (
          u[this.idx(i + 1, j)] - u[this.idx(i - 1, j)] +
          v[this.idx(i, j + 1)] - v[this.idx(i, j - 1)]
        ) / n;
        p[id] = 0;
      }
    }

    this.setB(0, div);
    this.setB(0, p);
    this.linSolve(0, p, div, 1, 4);

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const id = this.idx(i, j);
        u[id] -= 0.5 * n * (p[this.idx(i + 1, j)] - p[this.idx(i - 1, j)]);
        v[id] -= 0.5 * n * (p[this.idx(i, j + 1)] - p[this.idx(i, j - 1)]);
      }
    }

    this.setB(1, u);
    this.setB(2, v);
  }

  computeVorticity() {
    const n = this.n;
    const u = this.u;
    const v = this.v;
    const w = this.vort;

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const dvdx = 0.5 * (v[this.idx(i + 1, j)] - v[this.idx(i - 1, j)]) * (n - 2);
        const dudy = 0.5 * (u[this.idx(i, j + 1)] - u[this.idx(i, j - 1)]) * (n - 2);
        w[this.idx(i, j)] = dvdx - dudy; // z-vorticity
      }
    }
  }

  computeStreamFunction() {
    // Solve Laplacian(psi) = -vorticity
    const n = this.n;
    const psi = this.psi;
    const rhs = this.vort;

    // Initialize to 0 each time for stability
    psi.fill(0);

    // Simple Gauss-Seidel
    const iters = Math.min(60, this.solverIters * 2);
    for (let k = 0; k < iters; k++) {
      for (let j = 1; j < n - 1; j++) {
        for (let i = 1; i < n - 1; i++) {
          const id = this.idx(i, j);
          psi[id] = (psi[this.idx(i - 1, j)] + psi[this.idx(i + 1, j)] + psi[this.idx(i, j - 1)] + psi[this.idx(i, j + 1)] + (-rhs[id]) / ((n - 2) * (n - 2))) * 0.25;
        }
      }
      this.setB(0, psi);
    }
  }
}
