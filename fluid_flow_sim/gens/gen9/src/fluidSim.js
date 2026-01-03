import { clamp } from './util.js';

function idx(i, j, n) {
  return i + j * n;
}

function wrap01(x) {
  // clamp to [0,1)
  return Math.max(0, Math.min(0.999999, x));
}

function bilerp(field, x, y, n) {
  x = wrap01(x);
  y = wrap01(y);

  const fx = x * (n - 1);
  const fy = y * (n - 1);

  const i0 = Math.floor(fx);
  const j0 = Math.floor(fy);
  const i1 = Math.min(n - 1, i0 + 1);
  const j1 = Math.min(n - 1, j0 + 1);
  const tx = fx - i0;
  const ty = fy - j0;

  const a = field[idx(i0, j0, n)];
  const b = field[idx(i1, j0, n)];
  const c = field[idx(i0, j1, n)];
  const d = field[idx(i1, j1, n)];

  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * ty;
}

export class FluidSim {
  constructor() {
    this.n = 128;
    this.dt = 0.016;
    this.viscosity = 0.0006; // ν
    this.diffusionRho = 0.0002;
    this.diffusionTemp = 0.0002;
    this.vorticityConfinement = 15;

    this.forceFx = (x, y, t) => 0;
    this.forceFy = (x, y, t) => 0;
    this.sourceRho = (x, y, t) => 0;
    this.sourceTemp = (x, y, t) => 0;

    this.resize(this.n, this.n);
  }

  resize(w, h) {
    // Keep it square for simplicity.
    const n = Math.max(32, Math.min(512, Math.floor(w)));
    this.n = n;

    const N = n * n;
    this.u = new Float32Array(N);
    this.v = new Float32Array(N);
    this.u0 = new Float32Array(N);
    this.v0 = new Float32Array(N);

    this.p = new Float32Array(N);
    this.div = new Float32Array(N);

    this.rho = new Float32Array(N);
    this.rho0 = new Float32Array(N);

    this.temp = new Float32Array(N);
    this.temp0 = new Float32Array(N);

    this.vort = new Float32Array(N);
    this.vort0 = new Float32Array(N);

    this.reset();
  }

  reset() {
    const N = this.n * this.n;
    this.u.fill(0);
    this.v.fill(0);
    this.p.fill(0);
    this.rho.fill(0);
    this.temp.fill(0);

    // mild initial puff
    const n = this.n;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = (j / (n - 1)) * 2 - 1;
        const r2 = x * x + y * y;
        const k = Math.exp(-r2 * 6);
        this.rho[idx(i, j, n)] = 0.15 * k;
        this.temp[idx(i, j, n)] = 0.08 * k;
      }
    }
  }

  injectFromPointer({ x, y, fx, fy, rho, temp }) {
    // x,y in [-1,1]. apply small splat.
    const n = this.n;
    const ix = Math.floor(((x + 1) * 0.5) * (n - 1));
    const iy = Math.floor(((y + 1) * 0.5) * (n - 1));
    const r = Math.max(2, Math.floor(n / 48));

    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const i = ix + di;
        const j = iy + dj;
        if (i < 1 || j < 1 || i > n - 2 || j > n - 2) continue;
        const w = Math.exp(-(di * di + dj * dj) / (r * r + 1e-6));
        const k = idx(i, j, n);
        this.u[k] += 0.0025 * fx * w;
        this.v[k] += 0.0025 * fy * w;
        this.rho[k] += 0.05 * rho * w;
        this.temp[k] += 0.05 * temp * w;
      }
    }
  }

  // ---------- Simulation core (Stable Fluids) ----------
  step(t) {
    const n = this.n;
    const dt = this.dt;

    // Add forces from equation editor
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = (j / (n - 1)) * 2 - 1;
        const k = idx(i, j, n);

        const fx = this.forceFx(x, y, t) || 0;
        const fy = this.forceFy(x, y, t) || 0;
        this.u[k] += fx * dt;
        this.v[k] += fy * dt;

        const sr = this.sourceRho(x, y, t) || 0;
        const st = this.sourceTemp(x, y, t) || 0;
        this.rho[k] += sr * dt;
        this.temp[k] += st * dt;
      }
    }

    // Vorticity confinement (adds detail / curl)
    if (this.vorticityConfinement > 0) {
      this._computeVorticity(this.vort);
      if (!this.vortConfNx || this.vortConfNx.length !== n * n) {
        this.vortConfNx = new Float32Array(n * n);
        this.vortConfNy = new Float32Array(n * n);
      }
      this._vorticityConfinement(this.vort, this.u, this.v, this.vortConfNx, this.vortConfNy);
    }

    // Diffuse velocity
    this._diffuse(this.u0, this.u, this.viscosity, dt);
    this._diffuse(this.v0, this.v, this.viscosity, dt);

    // Project (make incompressible)
    this._project(this.u0, this.v0, this.p, this.div);

    // Advect velocity
    this._advect(this.u, this.u0, this.u0, this.v0, dt);
    this._advect(this.v, this.v0, this.u0, this.v0, dt);

    // Project again
    this._project(this.u, this.v, this.p, this.div);

    // Scalars: density + temp
    this._diffuse(this.rho0, this.rho, this.diffusionRho, dt);
    this._advect(this.rho, this.rho0, this.u, this.v, dt);

    this._diffuse(this.temp0, this.temp, this.diffusionTemp, dt);
    this._advect(this.temp, this.temp0, this.u, this.v, dt);

    // mild decay (prevents blow-up)
    const N = n * n;
    for (let k = 0; k < N; k++) {
      this.rho[k] *= 0.999;
      this.temp[k] *= 0.999;
      this.u[k] *= 0.9995;
      this.v[k] *= 0.9995;
    }
  }

  _setBounds(x) {
    const n = this.n;
    // Simple boundaries: zero-gradient for scalars, no-slip-ish for velocity handled separately by projection steps.
    for (let i = 1; i < n - 1; i++) {
      x[idx(i, 0, n)] = x[idx(i, 1, n)];
      x[idx(i, n - 1, n)] = x[idx(i, n - 2, n)];
      x[idx(0, i, n)] = x[idx(1, i, n)];
      x[idx(n - 1, i, n)] = x[idx(n - 2, i, n)];
    }
    x[idx(0, 0, n)] = 0.5 * (x[idx(1, 0, n)] + x[idx(0, 1, n)]);
    x[idx(0, n - 1, n)] = 0.5 * (x[idx(1, n - 1, n)] + x[idx(0, n - 2, n)]);
    x[idx(n - 1, 0, n)] = 0.5 * (x[idx(n - 2, 0, n)] + x[idx(n - 1, 1, n)]);
    x[idx(n - 1, n - 1, n)] = 0.5 * (x[idx(n - 2, n - 1, n)] + x[idx(n - 1, n - 2, n)]);
  }

  _diffuse(x, x0, diff, dt) {
    const n = this.n;
    const a = dt * diff * (n - 1) * (n - 1);

    x.set(x0);
    // Gauss-Seidel iterations
    for (let iter = 0; iter < 14; iter++) {
      for (let j = 1; j < n - 1; j++) {
        for (let i = 1; i < n - 1; i++) {
          const k = idx(i, j, n);
          x[k] = (x0[k] + a * (
            x[idx(i - 1, j, n)] + x[idx(i + 1, j, n)] + x[idx(i, j - 1, n)] + x[idx(i, j + 1, n)]
          )) / (1 + 4 * a);
        }
      }
      this._setBounds(x);
    }
  }

  _advect(d, d0, u, v, dt) {
    const n = this.n;
    const inv = 1 / (n - 1);

    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = idx(i, j, n);

        const x = i * inv;
        const y = j * inv;

        // backtrace
        const vx = u[k];
        const vy = v[k];

        const px = x - dt * vx;
        const py = y - dt * vy;

        d[k] = bilerp(d0, px, py, n);
      }
    }

    this._setBounds(d);
  }

  _project(u, v, p, div) {
    const n = this.n;
    const h = 1 / (n - 1);

    // div = -0.5 * h * (du/dx + dv/dy)
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = idx(i, j, n);
        div[k] = -0.5 * h * (
          u[idx(i + 1, j, n)] - u[idx(i - 1, j, n)] +
          v[idx(i, j + 1, n)] - v[idx(i, j - 1, n)]
        );
        p[k] = 0;
      }
    }
    this._setBounds(div);
    this._setBounds(p);

    // Solve Poisson: ∇²p = div
    for (let iter = 0; iter < 26; iter++) {
      for (let j = 1; j < n - 1; j++) {
        for (let i = 1; i < n - 1; i++) {
          const k = idx(i, j, n);
          p[k] = (div[k] +
            p[idx(i - 1, j, n)] + p[idx(i + 1, j, n)] +
            p[idx(i, j - 1, n)] + p[idx(i, j + 1, n)]
          ) / 4;
        }
      }
      this._setBounds(p);
    }

    // Subtract gradient
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = idx(i, j, n);
        u[k] -= 0.5 * (p[idx(i + 1, j, n)] - p[idx(i - 1, j, n)]) / h;
        v[k] -= 0.5 * (p[idx(i, j + 1, n)] - p[idx(i, j - 1, n)]) / h;
      }
    }

    this._setBounds(u);
    this._setBounds(v);
  }

  _computeVorticity(out) {
    const n = this.n;
    const h = 1 / (n - 1);
    for (let j = 1; j < n - 1; j++) {
      for (let i = 1; i < n - 1; i++) {
        const k = idx(i, j, n);
        const dvdx = (this.v[idx(i + 1, j, n)] - this.v[idx(i - 1, j, n)]) / (2 * h);
        const dudy = (this.u[idx(i, j + 1, n)] - this.u[idx(i, j - 1, n)]) / (2 * h);
        out[k] = dvdx - dudy;
      }
    }
    this._setBounds(out);
  }

  _vorticityConfinement(vort, u, v, nxField, nyField) {
    const n = this.n;
    const h = 1 / (n - 1);

    // Compute gradient of |ω|
    for (let j = 2; j < n - 2; j++) {
      for (let i = 2; i < n - 2; i++) {
        const k = idx(i, j, n);
        const wL = Math.abs(vort[idx(i - 1, j, n)]);
        const wR = Math.abs(vort[idx(i + 1, j, n)]);
        const wB = Math.abs(vort[idx(i, j - 1, n)]);
        const wT = Math.abs(vort[idx(i, j + 1, n)]);

        const gx = (wR - wL) / (2 * h);
        const gy = (wT - wB) / (2 * h);
        const gl = Math.sqrt(gx * gx + gy * gy) + 1e-8;
        nxField[k] = gx / gl;
        nyField[k] = gy / gl;
      }
    }

    const eps = this.vorticityConfinement;
    for (let j = 2; j < n - 2; j++) {
      for (let i = 2; i < n - 2; i++) {
        const k = idx(i, j, n);
        const nx = nxField[k];
        const ny = nyField[k];
        const w = vort[k];
        // f = ε * (N × ωk) => (ny*ω, -nx*ω)
        u[k] += eps * ny * w * this.dt;
        v[k] += -eps * nx * w * this.dt;
      }
    }
  }

  sample(wx, wy) {
    // wx,wy in [-1,1]
    const x = clamp((wx + 1) * 0.5, 0, 1);
    const y = clamp((wy + 1) * 0.5, 0, 1);
    const n = this.n;

    const u = bilerp(this.u, x, y, n);
    const v = bilerp(this.v, x, y, n);
    const p = bilerp(this.p, x, y, n);
    const rho = bilerp(this.rho, x, y, n);
    const temp = bilerp(this.temp, x, y, n);

    // compute vorticity on-the-fly
    const eps = 1 / (n - 1);
    const x1 = clamp(x + eps, 0, 1);
    const x0 = clamp(x - eps, 0, 1);
    const y1 = clamp(y + eps, 0, 1);
    const y0 = clamp(y - eps, 0, 1);
    const dvdx = (bilerp(this.v, x1, y, n) - bilerp(this.v, x0, y, n)) / (2 * eps);
    const dudy = (bilerp(this.u, x, y1, n) - bilerp(this.u, x, y0, n)) / (2 * eps);
    const vort = dvdx - dudy;

    return { u, v, p, rho, temp, vort };
  }

  render(ctx, width, height, opts) {
    const n = this.n;
    const pal = opts.palette;
    const q = opts.quantity || 'speed';

    // Determine range (robust-ish) by sampling.
    let minV = Infinity;
    let maxV = -Infinity;
    const samples = 350;
    for (let s = 0; s < samples; s++) {
      const i = (s * 131) % n;
      const j = (s * 97) % n;
      const k = idx(i, j, n);
      let v;
      if (q === 'speed') v = Math.hypot(this.u[k], this.v[k]);
      else if (q === 'pressure') v = this.p[k];
      else if (q === 'density') v = this.rho[k];
      else if (q === 'temp') v = this.temp[k];
      else if (q === 'vorticity') {
        // approximate
        const i0 = Math.max(1, Math.min(n - 2, i));
        const j0 = Math.max(1, Math.min(n - 2, j));
        const h = 1 / (n - 1);
        const dvdx = (this.v[idx(i0 + 1, j0, n)] - this.v[idx(i0 - 1, j0, n)]) / (2 * h);
        const dudy = (this.u[idx(i0, j0 + 1, n)] - this.u[idx(i0, j0 - 1, n)]) / (2 * h);
        v = dvdx - dudy;
      } else v = 0;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }

    if (!Number.isFinite(minV) || !Number.isFinite(maxV) || Math.abs(maxV - minV) < 1e-10) {
      minV = 0;
      maxV = 1;
    }

    // Symmetric range for signed quantities
    if (q === 'pressure' || q === 'vorticity') {
      const a = Math.max(Math.abs(minV), Math.abs(maxV));
      minV = -a;
      maxV = a;
    }

    const img = ctx.createImageData(width, height);
    const data = img.data;

    for (let py = 0; py < height; py++) {
      const y = py / (height - 1);
      for (let px = 0; px < width; px++) {
        const x = px / (width - 1);
        const i = Math.floor(x * (n - 1));
        const j = Math.floor(y * (n - 1));
        const k = idx(i, j, n);

        let val;
        if (q === 'speed') val = Math.hypot(this.u[k], this.v[k]);
        else if (q === 'pressure') val = this.p[k];
        else if (q === 'density') val = this.rho[k];
        else if (q === 'temp') val = this.temp[k];
        else if (q === 'vorticity') {
          const i0 = Math.max(1, Math.min(n - 2, i));
          const j0 = Math.max(1, Math.min(n - 2, j));
          const h = 1 / (n - 1);
          const dvdx = (this.v[idx(i0 + 1, j0, n)] - this.v[idx(i0 - 1, j0, n)]) / (2 * h);
          const dudy = (this.u[idx(i0, j0 + 1, n)] - this.u[idx(i0, j0 - 1, n)]) / (2 * h);
          val = dvdx - dudy;
        } else val = 0;

        let t = (val - minV) / (maxV - minV);
        t = clamp(t, 0, 1);
        const c = pal.sample(t);

        const o = (px + py * width) * 4;
        data[o + 0] = c.r;
        data[o + 1] = c.g;
        data[o + 2] = c.b;
        data[o + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);

    // overlay velocity arrows (sparse)
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1;
    const step = Math.max(10, Math.floor(width / 38));
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const xi = Math.floor((x / (width - 1)) * (n - 1));
        const yi = Math.floor((y / (height - 1)) * (n - 1));
        const k = idx(xi, yi, n);
        const u = this.u[k];
        const v = this.v[k];
        const s = Math.hypot(u, v);
        if (s < 0.005) continue;
        const scale = 18;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + u * scale + 0.5, y + v * scale + 0.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}
