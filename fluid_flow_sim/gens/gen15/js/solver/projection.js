// ────────────────────────────────────────────
// projection.js — Traditional NS solver (Chorin projection)
// ────────────────────────────────────────────
// Implements the incompressible Navier-Stokes equations using:
//   1. Semi-Lagrangian advection (unconditionally stable)
//   2. Explicit diffusion
//   3. Pressure-Poisson projection (Gauss-Seidel)
// Same API as LBMSolver for interchangeability.

import { CELL } from '../config.js';

export class ProjectionSolver {
    constructor(nx, ny, config = {}) {
        this.type = 'projection';
        this.nx = 0;
        this.ny = 0;
        this.config = config;
        this.resize(nx, ny);
    }

    resize(nx, ny) {
        this.nx = nx;
        this.ny = ny;
        const N = nx * ny;

        this.ux = new Float32Array(N);
        this.uy = new Float32Array(N);
        this.ux0 = new Float32Array(N);
        this.uy0 = new Float32Array(N);
        this.pressure = new Float32Array(N);
        this.rho = new Float32Array(N);
        this.div = new Float32Array(N);
        this.curl = new Float32Array(N);
        this.speed = new Float32Array(N);
        this.solid = new Uint8Array(N);
        this.tauField = new Float32Array(N);

        // Pressure solver workspace
        this.pTemp = new Float32Array(N);

        this.init();
    }

    init() {
        const { nx, ny } = this;
        const uInf = this.config.uInf || 0.08;
        const rho0 = this.config.density || 1.0;

        // Set boundary types
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                if (this.solid[idx] === CELL.SOLID) continue;
                if (i === 0) this.solid[idx] = CELL.INLET;
                else if (i === nx - 1) this.solid[idx] = CELL.OUTLET;
                else this.solid[idx] = CELL.FLUID;
            }
        }

        // Initialize uniform flow
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                if (this.solid[idx] === CELL.SOLID) {
                    this.ux[idx] = 0;
                    this.uy[idx] = 0;
                } else {
                    const [vx, vy] = this._getInletVelocity(i, j);
                    this.ux[idx] = vx;
                    this.uy[idx] = vy;
                }
                this.rho[idx] = rho0;
                this.pressure[idx] = 0;
            }
        }
    }

    reset() {
        this.init();
    }

    _getInletVelocity(x, y) {
        const uInf = this.config.uInf || 0.08;
        if (this.config.uInfFunction) {
            try {
                const fn = new Function('x', 'y', 'U', `return ${this.config.uInfFunction};`);
                const result = fn(x, y, uInf);
                if (Array.isArray(result)) return result;
                return [result, 0];
            } catch {
                return [uInf, 0];
            }
        }
        return [uInf, 0];
    }

    step() {
        const dt = 1.0; // lattice units: dt=1, dx=1
        this._advect(dt);
        this._diffuse(dt);
        this._applyTurbulence(dt);
        this._project(dt);
        this._enforceBoundaries();
        this._computeDerived();
    }

    /** Semi-Lagrangian advection: trace back and interpolate. */
    _advect(dt) {
        const { nx, ny, ux, uy, ux0, uy0, solid } = this;

        // Copy current velocity
        ux0.set(ux);
        uy0.set(uy);

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (solid[idx] === CELL.SOLID) continue;

                // Trace back
                let x0 = i - dt * ux0[idx];
                let y0 = j - dt * uy0[idx];

                // Clamp to domain
                x0 = Math.max(0.5, Math.min(nx - 1.5, x0));
                y0 = Math.max(0.5, Math.min(ny - 1.5, y0));

                // Bilinear interpolation
                ux[idx] = this._bilerp(ux0, x0, y0);
                uy[idx] = this._bilerp(uy0, x0, y0);
            }
        }
    }

    /** Bilinear interpolation on a flat field array. */
    _bilerp(field, x, y) {
        const { nx } = this;
        const i0 = Math.floor(x), j0 = Math.floor(y);
        const i1 = i0 + 1, j1 = j0 + 1;
        const sx = x - i0, sy = y - j0;

        return (1 - sx) * (1 - sy) * field[j0 * nx + i0] +
               sx * (1 - sy) * field[j0 * nx + i1] +
               (1 - sx) * sy * field[j1 * nx + i0] +
               sx * sy * field[j1 * nx + i1];
    }

    /** Explicit diffusion step. */
    _diffuse(dt) {
        const { nx, ny, ux, uy, ux0, uy0, solid } = this;
        const nu = this.config.viscosity || 0.02;
        const alpha = nu * dt;

        // Save pre-diffusion
        ux0.set(ux);
        uy0.set(uy);

        // Jacobi iterations for implicit diffusion
        const iters = 4;
        for (let k = 0; k < iters; k++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const idx = j * nx + i;
                    if (solid[idx] === CELL.SOLID) continue;

                    ux[idx] = (ux0[idx] + alpha * (
                        ux[idx - 1] + ux[idx + 1] +
                        ux[idx - nx] + ux[idx + nx]
                    )) / (1 + 4 * alpha);

                    uy[idx] = (uy0[idx] + alpha * (
                        uy[idx - 1] + uy[idx + 1] +
                        uy[idx - nx] + uy[idx + nx]
                    )) / (1 + 4 * alpha);
                }
            }
        }
    }

    /** Optional Smagorinsky-like turbulent viscosity boost. */
    _applyTurbulence(dt) {
        if (this.config.turbModel !== 'smagorinsky') return;
        const { nx, ny, ux, uy, solid, tauField } = this;
        const Cs = this.config.smagorinskyCs || 0.1;
        const dx = 1;

        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (solid[idx] === CELL.SOLID) continue;

                // Strain rate tensor components
                const dudx = (ux[idx + 1] - ux[idx - 1]) * 0.5;
                const dudy = (ux[idx + nx] - ux[idx - nx]) * 0.5;
                const dvdx = (uy[idx + 1] - uy[idx - 1]) * 0.5;
                const dvdy = (uy[idx + nx] - uy[idx - nx]) * 0.5;

                const Sxx = dudx, Sxy = 0.5 * (dudy + dvdx), Syy = dvdy;
                const Smag = Math.sqrt(2 * (Sxx * Sxx + 2 * Sxy * Sxy + Syy * Syy));
                const nuTurb = (Cs * dx) * (Cs * dx) * Smag;

                // Apply extra diffusion
                const alpha = nuTurb * dt;
                tauField[idx] = nuTurb;

                if (alpha > 0) {
                    const prevUx = ux[idx], prevUy = uy[idx];
                    ux[idx] = (prevUx + alpha * (
                        ux[idx - 1] + ux[idx + 1] + ux[idx - nx] + ux[idx + nx]
                    )) / (1 + 4 * alpha);
                    uy[idx] = (prevUy + alpha * (
                        uy[idx - 1] + uy[idx + 1] + uy[idx - nx] + uy[idx + nx]
                    )) / (1 + 4 * alpha);
                }
            }
        }
    }

    /** Pressure projection: enforce divergence-free velocity. */
    _project(dt) {
        const { nx, ny, ux, uy, pressure, div, pTemp, solid } = this;
        const rho0 = this.config.density || 1.0;

        // 1. Compute divergence
        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (solid[idx] === CELL.SOLID) {
                    div[idx] = 0;
                    continue;
                }
                div[idx] = -0.5 * (
                    ux[idx + 1] - ux[idx - 1] +
                    uy[idx + nx] - uy[idx - nx]
                );
            }
        }

        // 2. Solve pressure Poisson: ∇²p = div  (Gauss-Seidel)
        pressure.fill(0);
        const numIters = 20; // More iterations = more accurate
        for (let k = 0; k < numIters; k++) {
            for (let j = 1; j < ny - 1; j++) {
                for (let i = 1; i < nx - 1; i++) {
                    const idx = j * nx + i;
                    if (solid[idx] === CELL.SOLID) continue;

                    // Count valid neighbors (not solid)
                    let pSum = 0, count = 0;
                    if (solid[idx - 1] !== CELL.SOLID) { pSum += pressure[idx - 1]; count++; }
                    if (solid[idx + 1] !== CELL.SOLID) { pSum += pressure[idx + 1]; count++; }
                    if (solid[idx - nx] !== CELL.SOLID) { pSum += pressure[idx - nx]; count++; }
                    if (solid[idx + nx] !== CELL.SOLID) { pSum += pressure[idx + nx]; count++; }

                    if (count > 0) {
                        pressure[idx] = (div[idx] + pSum) / count;
                    }
                }
            }
        }

        // 3. Correct velocity: u = u* - ∇p
        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (solid[idx] === CELL.SOLID) continue;

                ux[idx] -= 0.5 * (pressure[idx + 1] - pressure[idx - 1]);
                uy[idx] -= 0.5 * (pressure[idx + nx] - pressure[idx - nx]);
            }
        }

        // Scale pressure for display (p = div * rho0 * cs2 equivalent)
        for (let i = 0; i < pressure.length; i++) {
            pressure[i] *= rho0;
        }
    }

    /** Enforce boundary conditions. */
    _enforceBoundaries() {
        const { nx, ny, ux, uy, solid } = this;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;

                if (solid[idx] === CELL.SOLID) {
                    ux[idx] = 0;
                    uy[idx] = 0;
                } else if (solid[idx] === CELL.INLET) {
                    const [vx, vy] = this._getInletVelocity(i, j);
                    ux[idx] = vx;
                    uy[idx] = vy;
                } else if (solid[idx] === CELL.OUTLET) {
                    // Neumann: copy from interior
                    if (i > 0) {
                        ux[idx] = ux[j * nx + (i - 1)];
                        uy[idx] = uy[j * nx + (i - 1)];
                    }
                }

                // Top/bottom walls: no-slip
                if (!this.config.periodicY) {
                    if (j === 0 || j === ny - 1) {
                        ux[idx] = 0;
                        uy[idx] = 0;
                    }
                }
            }
        }

        // Near-solid: enforce no-slip on neighbors
        for (let j = 1; j < ny - 1; j++) {
            for (let i = 1; i < nx - 1; i++) {
                const idx = j * nx + i;
                if (solid[idx] !== CELL.SOLID) continue;
                // Zero velocity at solid
                ux[idx] = 0;
                uy[idx] = 0;
            }
        }
    }

    _computeDerived() {
        const { nx, ny, ux, uy, rho, curl, speed, solid, pressure } = this;
        const rho0 = this.config.density || 1.0;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                rho[idx] = rho0; // incompressible: density is constant
                speed[idx] = Math.sqrt(ux[idx] * ux[idx] + uy[idx] * uy[idx]);

                if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1 &&
                    solid[idx] !== CELL.SOLID) {
                    const duy_dx = (uy[j * nx + (i + 1)] - uy[j * nx + (i - 1)]) * 0.5;
                    const dux_dy = (ux[(j + 1) * nx + i] - ux[(j - 1) * nx + i]) * 0.5;
                    curl[idx] = duy_dx - dux_dy;
                } else {
                    curl[idx] = 0;
                }
            }
        }
    }

    getField(name) {
        switch (name) {
            case 'velocity': return this.speed;
            case 'pressure': return this.pressure;
            case 'vorticity': return this.curl;
            case 'density': return this.rho;
            case 'ux': return this.ux;
            case 'uy': return this.uy;
            default: return this.speed;
        }
    }

    updateConfig(config) {
        Object.assign(this.config, config);
    }
}
