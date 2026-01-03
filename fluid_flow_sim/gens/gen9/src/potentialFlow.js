import { clamp } from './util.js';

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function coreR2(x, y, a) {
  // Core regularization for singular flows.
  return x * x + y * y + a * a;
}

export class PotentialFlow {
  constructor() {
    this.uniform = { U: 1.0, angleDeg: 0 };
    this.elements = [];
    this._id = 1;
  }

  getScenarios() {
    return [
      {
        id: 'half_body',
        name: 'Half-body (Uniform + Source)',
        build: () => {
          this.uniform.U = 1;
          this.uniform.angleDeg = 0;
          this.elements = [
            { id: this._id++, type: 'source', label: 'Source', x: 0, y: 0, m: 5, core: 0.06 },
          ];
        },
      },
      {
        id: 'flow_over_cylinder',
        name: 'Flow over cylinder (Uniform + Doublet)',
        build: () => {
          this.uniform.U = 1;
          this.uniform.angleDeg = 0;
          this.elements = [
            { id: this._id++, type: 'doublet', label: 'Doublet', x: 0, y: 0, kappa: 2.0, angleDeg: 0 },
          ];
        },
      },
      {
        id: 'rotating_cylinder',
        name: 'Rotating cylinder (Uniform + Doublet + Vortex)',
        build: () => {
          this.uniform.U = 1;
          this.uniform.angleDeg = 0;
          this.elements = [
            { id: this._id++, type: 'doublet', label: 'Doublet', x: 0, y: 0, kappa: 2.0, angleDeg: 0 },
            { id: this._id++, type: 'vortex', label: 'Vortex', x: 0, y: 0, gamma: 6.0, core: 0.06 },
          ];
        },
      },
      {
        id: 'rankine_oval',
        name: 'Rankine oval (Uniform + Source + Sink)',
        build: () => {
          this.uniform.U = 1;
          this.uniform.angleDeg = 0;
          this.elements = [
            { id: this._id++, type: 'source', label: 'Source', x: -0.35, y: 0, m: 5.0, core: 0.06 },
            { id: this._id++, type: 'source', label: 'Sink', x: 0.35, y: 0, m: -5.0, core: 0.06 },
          ];
        },
      },
    ];
  }

  loadScenario(s) {
    this._id = 1;
    s.build();
  }

  addSource({ x, y, m, core }) {
    this.elements.push({ id: this._id++, type: 'source', label: m >= 0 ? 'Source' : 'Sink', x, y, m, core });
  }

  addVortex({ x, y, gamma, core }) {
    this.elements.push({ id: this._id++, type: 'vortex', label: 'Vortex', x, y, gamma, core });
  }

  addDoublet({ x, y, kappa, angleDeg }) {
    this.elements.push({ id: this._id++, type: 'doublet', label: 'Doublet', x, y, kappa, angleDeg });
  }

  removeElement(id) {
    this.elements = this.elements.filter((e) => e.id !== id);
  }

  setElementPos(id, x, y) {
    const el = this.elements.find((e) => e.id === id);
    if (!el) return;
    el.x = clamp(x, -1.2, 1.2);
    el.y = clamp(y, -1.2, 1.2);
  }

  pickElement(x, y, radius = 0.08) {
    let best = null;
    let bestD2 = radius * radius;
    for (const el of this.elements) {
      const dx = x - el.x;
      const dy = y - el.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = el;
      }
    }
    return best ? best.id : null;
  }

  // ---------- Field evaluation ----------
  _uniformVel() {
    const th = degToRad(this.uniform.angleDeg);
    return { u: this.uniform.U * Math.cos(th), v: this.uniform.U * Math.sin(th) };
  }

  velocityAt(x, y) {
    let { u, v } = this._uniformVel();

    for (const el of this.elements) {
      const dx = x - el.x;
      const dy = y - el.y;

      if (el.type === 'source') {
        // Source/sink: V = (m/2π) * r / r^2
        const r2 = coreR2(dx, dy, el.core);
        const c = el.m / (2 * Math.PI * r2);
        u += c * dx;
        v += c * dy;
      } else if (el.type === 'vortex') {
        // Vortex: V = (Γ/2π) * k×r / r^2
        const r2 = coreR2(dx, dy, el.core);
        const c = el.gamma / (2 * Math.PI * r2);
        u += -c * dy;
        v += c * dx;
      } else if (el.type === 'doublet') {
        // Doublet: potential φ = -(κ/2π) * (e·r)/r^2
        // Velocity = ∇φ. We'll implement standard dipole aligned with angle.
        const th = degToRad(el.angleDeg);
        const ex = Math.cos(th);
        const ey = Math.sin(th);
        const r2 = dx * dx + dy * dy + 1e-6;
        const er = ex * dx + ey * dy;
        const k = el.kappa / (2 * Math.PI);
        // ∂/∂x [ -k * er / r2 ]
        // = -k * ( ex*r2 - er*2dx ) / r2^2
        const denom = r2 * r2;
        u += -k * (ex * r2 - er * 2 * dx) / denom;
        v += -k * (ey * r2 - er * 2 * dy) / denom;
      }
    }

    return { u, v };
  }

  phiAt(x, y) {
    // Velocity potential (up to constant)
    const th = degToRad(this.uniform.angleDeg);
    let phi = this.uniform.U * (x * Math.cos(th) + y * Math.sin(th));

    for (const el of this.elements) {
      const dx = x - el.x;
      const dy = y - el.y;

      if (el.type === 'source') {
        const r = Math.sqrt(coreR2(dx, dy, el.core));
        phi += (el.m / (2 * Math.PI)) * Math.log(r);
      } else if (el.type === 'vortex') {
        const ang = Math.atan2(dy, dx);
        // Vortex has streamfunction ~ log(r); potential ~ Γ/(2π) * θ (multi-valued).
        phi += (el.gamma / (2 * Math.PI)) * ang;
      } else if (el.type === 'doublet') {
        const th2 = degToRad(el.angleDeg);
        const ex = Math.cos(th2);
        const ey = Math.sin(th2);
        const r2 = dx * dx + dy * dy + 1e-6;
        const er = ex * dx + ey * dy;
        phi += -(el.kappa / (2 * Math.PI)) * (er / r2);
      }
    }

    return phi;
  }

  psiAt(x, y) {
    // Streamfunction
    const th = degToRad(this.uniform.angleDeg);
    let psi = this.uniform.U * (-x * Math.sin(th) + y * Math.cos(th));

    for (const el of this.elements) {
      const dx = x - el.x;
      const dy = y - el.y;

      if (el.type === 'source') {
        const ang = Math.atan2(dy, dx);
        psi += (el.m / (2 * Math.PI)) * ang;
      } else if (el.type === 'vortex') {
        const r = Math.sqrt(coreR2(dx, dy, el.core));
        psi += -(el.gamma / (2 * Math.PI)) * Math.log(r);
      } else if (el.type === 'doublet') {
        const th2 = degToRad(el.angleDeg);
        const ex = Math.cos(th2);
        const ey = Math.sin(th2);
        const r2 = dx * dx + dy * dy + 1e-6;
        // For a dipole aligned with e, ψ = -(κ/2π) * (e⊥·r)/r^2
        const epx = -ey;
        const epy = ex;
        const erp = epx * dx + epy * dy;
        psi += -(el.kappa / (2 * Math.PI)) * (erp / r2);
      }
    }

    return psi;
  }

  // ---------- Rendering ----------
  render(ctx, width, height, opts) {
    const showStream = !!opts.showStreamlines;
    const showEquip = !!opts.showEquipotentials;
    const density = clamp(opts.density || 32, 8, 90);

    // Draw isolines by marching along gradient directions with a light seed grid.
    // This is intentionally lightweight (fast enough in Canvas2D).
    ctx.save();
    ctx.lineWidth = 1;

    if (showStream) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = 'rgba(91,188,255,0.9)';
      this._drawIsolines(ctx, width, height, density, (x, y) => this.psiAt(x, y));
    }

    if (showEquip) {
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = 'rgba(124,92,255,0.9)';
      this._drawIsolines(ctx, width, height, density, (x, y) => this.phiAt(x, y));
    }

    // subtle border
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    ctx.restore();
  }

  _drawIsolines(ctx, width, height, density, scalarFn) {
    // Simple isoline sampling on a uniform grid then draw contour-like segments.
    // Marching squares lite: for each cell, for a set of contour levels.

    const nx = Math.floor(Math.sqrt(density) * 18);
    const ny = Math.floor(Math.sqrt(density) * 10);

    const gx = nx + 1;
    const gy = ny + 1;

    const s = new Float32Array(gx * gy);
    let sMin = Infinity;
    let sMax = -Infinity;

    for (let j = 0; j < gy; j++) {
      for (let i = 0; i < gx; i++) {
        const x = (i / nx) * 2 - 1;
        const y = (1 - j / ny) * 2 - 1;
        const v = scalarFn(x, y);
        s[j * gx + i] = v;
        if (v < sMin) sMin = v;
        if (v > sMax) sMax = v;
      }
    }

    if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || Math.abs(sMax - sMin) < 1e-9) return;

    const levels = clamp(density, 10, 80);
    for (let l = 0; l < levels; l++) {
      const iso = sMin + ((l + 0.5) / levels) * (sMax - sMin);
      this._marchSquares(ctx, s, gx, gy, iso, width, height);
    }
  }

  _marchSquares(ctx, grid, gx, gy, iso, width, height) {
    const nx = gx - 1;
    const ny = gy - 1;

    function worldToPxX(i) {
      return (i / nx) * width;
    }
    function worldToPxY(j) {
      return (j / ny) * height;
    }

    // Edge interpolate
    function interp(a, b, t) {
      return a + (b - a) * t;
    }

    const idx = (i, j) => j * gx + i;

    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const s00 = grid[idx(i, j)];
        const s10 = grid[idx(i + 1, j)];
        const s01 = grid[idx(i, j + 1)];
        const s11 = grid[idx(i + 1, j + 1)];

        // Bitmask
        const b0 = s00 > iso ? 1 : 0;
        const b1 = s10 > iso ? 2 : 0;
        const b2 = s11 > iso ? 4 : 0;
        const b3 = s01 > iso ? 8 : 0;
        const code = b0 | b1 | b2 | b3;
        if (code === 0 || code === 15) continue;

        // positions in cell [0,1]
        const t0 = (iso - s00) / (s10 - s00 + 1e-12);
        const t1 = (iso - s10) / (s11 - s10 + 1e-12);
        const t2 = (iso - s01) / (s11 - s01 + 1e-12);
        const t3 = (iso - s00) / (s01 - s00 + 1e-12);

        // edge points
        const ex0 = interp(0, 1, clamp(t0, 0, 1));
        const ey0 = 0;

        const ex1 = 1;
        const ey1 = interp(0, 1, clamp(t1, 0, 1));

        const ex2 = interp(0, 1, clamp(t2, 0, 1));
        const ey2 = 1;

        const ex3 = 0;
        const ey3 = interp(0, 1, clamp(t3, 0, 1));

        // Lookup: draw segments for common cases (ambiguous cases are acceptable visually).
        const segs = [];
        switch (code) {
          case 1:
          case 14:
            segs.push([ex3, ey3, ex0, ey0]);
            break;
          case 2:
          case 13:
            segs.push([ex0, ey0, ex1, ey1]);
            break;
          case 3:
          case 12:
            segs.push([ex3, ey3, ex1, ey1]);
            break;
          case 4:
          case 11:
            segs.push([ex1, ey1, ex2, ey2]);
            break;
          case 5:
            segs.push([ex3, ey3, ex0, ey0]);
            segs.push([ex1, ey1, ex2, ey2]);
            break;
          case 6:
          case 9:
            segs.push([ex0, ey0, ex2, ey2]);
            break;
          case 7:
          case 8:
            segs.push([ex3, ey3, ex2, ey2]);
            break;
          case 10:
            segs.push([ex0, ey0, ex1, ey1]);
            segs.push([ex3, ey3, ex2, ey2]);
            break;
          default:
            break;
        }

        if (!segs.length) continue;

        const x0 = worldToPxX(i);
        const y0 = worldToPxY(j);
        const x1 = worldToPxX(i + 1);
        const y1 = worldToPxY(j + 1);

        for (const s of segs) {
          const ax = x0 + s[0] * (x1 - x0);
          const ay = y0 + s[1] * (y1 - y0);
          const bx = x0 + s[2] * (x1 - x0);
          const by = y0 + s[3] * (y1 - y0);

          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }
  }

  renderMarkers(ctx, width, height, worldToCanvas) {
    ctx.save();

    for (const el of this.elements) {
      const p = worldToCanvas(el.x, el.y);
      ctx.beginPath();
      ctx.fillStyle = el.type === 'vortex' ? 'rgba(255,91,125,0.9)' : el.type === 'doublet' ? 'rgba(124,92,255,0.9)' : 'rgba(91,188,255,0.9)';
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // label
      ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      ctx.fillStyle = 'rgba(231,238,247,0.9)';
      ctx.fillText(el.type === 'source' ? 'm' : el.type === 'vortex' ? 'Γ' : 'κ', p.x + 10, p.y - 10);

      if (el._pill) {
        el._pill.textContent = `x=${el.x.toFixed(3)}, y=${el.y.toFixed(3)}`;
      }
    }

    ctx.restore();
  }
}
