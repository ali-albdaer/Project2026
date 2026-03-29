// ────────────────────────────────────────────
// lbm.js — Lattice Boltzmann D2Q9 solver
// ────────────────────────────────────────────
// Solves the incompressible Navier-Stokes equations in the low-Mach limit.
// Supports BGK, TRT, and MRT collision operators.
// Designed for future GPU migration: all field data is flat Float32Array.

import { D2Q9, CELL, COLLISION } from '../config.js';

export class LBMSolver {
    /**
     * @param {number} nx — grid width
     * @param {number} ny — grid height
     * @param {object} config — { uInf, viscosity, density, collision, periodicY }
     */
    constructor(nx, ny, config = {}) {
        this.type = 'lbm';
        this.nx = 0;
        this.ny = 0;
        this.config = config;
        this.resize(nx, ny);
    }

    /** (Re)allocate all arrays and initialize. */
    resize(nx, ny) {
        this.nx = nx;
        this.ny = ny;
        const N = nx * ny;

        // Distribution functions: 9 flat arrays
        this.f = new Array(9);
        this.fTemp = new Array(9);
        for (let q = 0; q < 9; q++) {
            this.f[q] = new Float32Array(N);
            this.fTemp[q] = new Float32Array(N);
        }

        // Macroscopic fields
        this.rho = new Float32Array(N);
        this.ux = new Float32Array(N);
        this.uy = new Float32Array(N);
        this.pressure = new Float32Array(N);
        this.curl = new Float32Array(N);
        this.speed = new Float32Array(N);

        // Cell flags
        this.solid = new Uint8Array(N);

        // Turbulence: local effective tau
        this.tauField = new Float32Array(N);

        this.init();
    }

    /** Initialize to equilibrium at uniform flow. */
    init() {
        const { nx, ny } = this;
        const uInf = this.config.uInf || 0.08;
        const rho0 = this.config.density || 1.0;

        // Set boundary cell types
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                if (this.solid[idx] === CELL.SOLID) continue;
                if (i === 0) {
                    this.solid[idx] = CELL.INLET;
                } else if (i === nx - 1) {
                    this.solid[idx] = CELL.OUTLET;
                } else {
                    this.solid[idx] = CELL.FLUID;
                }
            }
        }

        // Compute tau from viscosity
        this._updateTau();

        // Initialize to equilibrium at inlet velocity
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                if (this.solid[idx] === CELL.SOLID) {
                    this.rho[idx] = 0;
                    this.ux[idx] = 0;
                    this.uy[idx] = 0;
                    continue;
                }
                const [uxi, uyi] = this._getInletVelocity(i, j);
                this.rho[idx] = rho0;
                this.ux[idx] = uxi;
                this.uy[idx] = uyi;

                // Set equilibrium distributions
                for (let q = 0; q < 9; q++) {
                    this.f[q][idx] = this._feq(q, rho0, uxi, uyi);
                }
            }
        }
    }

    /** Reset to initial conditions (preserves solid geometry). */
    reset() {
        this.init();
    }

    /** Compute relaxation time from viscosity. */
    _updateTau() {
        const nu = this.config.viscosity || 0.02;
        this.tau = 3 * nu + 0.5;
        this.omega = 1 / this.tau;
    }

    /** Get inlet velocity, supporting function input. */
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

    /** Equilibrium distribution function. */
    _feq(q, rho, ux, uy) {
        const { ex, ey, w, cs2 } = D2Q9;
        const eu = ex[q] * ux + ey[q] * uy;
        const usq = ux * ux + uy * uy;
        return w[q] * rho * (1 + eu / cs2 + (eu * eu) / (2 * cs2 * cs2) - usq / (2 * cs2));
    }

    /** Advance one timestep. */
    step() {
        this._collide();
        this._stream();
        this._boundaries();
        this._macroscopic();
        this._computeDerived();
    }

    /** Collision step — applies selected operator. */
    _collide() {
        const { nx, ny, f, solid, tau } = this;
        const collision = this.config.collision || COLLISION.BGK;
        const N = nx * ny;

        // Pre-fetch turbulence config
        const useTurb = this.config.turbModel === 'smagorinsky';
        const Cs = this.config.smagorinskyCs || 0.1;

        for (let idx = 0; idx < N; idx++) {
            if (solid[idx] === CELL.SOLID) continue;

            const rho = this.rho[idx];
            const ux = this.ux[idx];
            const uy = this.uy[idx];

            if (rho < 1e-10) continue;

            let tauEff = tau;

            // Smagorinsky turbulence model
            if (useTurb) {
                tauEff = this._smagorinskyTau(idx, rho, ux, uy, tau, Cs);
            }

            this.tauField[idx] = tauEff;

            if (collision === COLLISION.BGK || collision === COLLISION.TRT) {
                const omega = 1 / tauEff;
                const omegaMinus = collision === COLLISION.TRT
                    ? 1 / (0.5 + 1 / (8 * (2 / omega - 1))) // Λ = 1/4 for TRT
                    : omega;

                for (let q = 0; q < 9; q++) {
                    const feq = this._feq(q, rho, ux, uy);
                    if (collision === COLLISION.TRT && q > 0) {
                        const qOpp = D2Q9.opp[q];
                        const fPlus = 0.5 * (f[q][idx] + f[qOpp][idx]);
                        const fMinus = 0.5 * (f[q][idx] - f[qOpp][idx]);
                        const feqPlus = 0.5 * (feq + this._feq(qOpp, rho, ux, uy));
                        const feqMinus = 0.5 * (feq - this._feq(qOpp, rho, ux, uy));
                        f[q][idx] = f[q][idx] - omega * (fPlus - feqPlus) - omegaMinus * (fMinus - feqMinus);
                    } else {
                        f[q][idx] -= omega * (f[q][idx] - feq);
                    }
                }
            } else if (collision === COLLISION.MRT) {
                this._mrtCollide(idx, rho, ux, uy, tauEff);
            }
        }
    }

    /** MRT collision in moment space (D2Q9). */
    _mrtCollide(idx, rho, ux, uy, tauEff) {
        const { f } = this;
        const fi = new Float64Array(9);
        for (let q = 0; q < 9; q++) fi[q] = f[q][idx];

        // Transform to moment space: m = M * f
        // M is the standard D2Q9 transformation matrix (Lallemand & Luo, 2000)
        const m = new Float64Array(9);
        m[0] = fi[0] + fi[1] + fi[2] + fi[3] + fi[4] + fi[5] + fi[6] + fi[7] + fi[8]; // rho
        m[1] = -4 * fi[0] - fi[1] - fi[2] - fi[3] - fi[4] + 2 * (fi[5] + fi[6] + fi[7] + fi[8]); // e
        m[2] = 4 * fi[0] - 2 * (fi[1] + fi[2] + fi[3] + fi[4]) + fi[5] + fi[6] + fi[7] + fi[8]; // eps
        m[3] = fi[1] - fi[3] + fi[5] - fi[6] - fi[7] + fi[8]; // jx
        m[4] = -2 * fi[1] + 2 * fi[3] + fi[5] - fi[6] - fi[7] + fi[8]; // qx
        m[5] = fi[2] - fi[4] + fi[5] + fi[6] - fi[7] - fi[8]; // jy
        m[6] = -2 * fi[2] + 2 * fi[4] + fi[5] + fi[6] - fi[7] - fi[8]; // qy
        m[7] = fi[1] - fi[2] + fi[3] - fi[4]; // pxx
        m[8] = fi[5] - fi[6] + fi[7] - fi[8]; // pxy

        // Equilibrium moments
        const usq = ux * ux + uy * uy;
        const meq = new Float64Array(9);
        meq[0] = rho;
        meq[1] = rho * (-2 + 3 * usq);
        meq[2] = rho * (1 - 3 * usq);
        meq[3] = rho * ux;
        meq[4] = -rho * ux;
        meq[5] = rho * uy;
        meq[6] = -rho * uy;
        meq[7] = rho * (ux * ux - uy * uy);
        meq[8] = rho * ux * uy;

        // Relaxation rates
        const s = 1 / tauEff;
        const S = [0, 1.4, 1.4, 0, 1.2, 0, 1.2, s, s]; // standard D2Q9 MRT

        // Relax in moment space
        for (let k = 0; k < 9; k++) {
            m[k] -= S[k] * (m[k] - meq[k]);
        }

        // Transform back: f = M^{-1} * m
        // Using decomposed coefficients from the standard D2Q9 inverse (Lallemand & Luo, 2000)
        const inv9 = 1 / 9, inv36 = 1 / 36, inv6 = 1 / 6, inv12 = 1 / 12, inv4 = 1 / 4;
        const a0 = inv9 * m[0];
        const a1 = inv36 * m[1];
        const a2 = inv36 * m[2];
        const a3 = inv6 * m[3];
        const a4 = inv12 * m[4];
        const a5 = inv6 * m[5];
        const a6 = inv12 * m[6];
        const a7 = inv4 * m[7];
        const a8 = inv4 * m[8];

        fi[0] = a0 - 4 * a1 + 4 * a2;
        fi[1] = a0 - a1 - 2 * a2 + a3 - 2 * a4 + a7;
        fi[2] = a0 - a1 - 2 * a2 + a5 - 2 * a6 - a7;
        fi[3] = a0 - a1 - 2 * a2 - a3 + 2 * a4 + a7;
        fi[4] = a0 - a1 - 2 * a2 - a5 + 2 * a6 - a7;
        fi[5] = a0 + 2 * a1 + a2 + a3 + a4 + a5 + a6 + a8;
        fi[6] = a0 + 2 * a1 + a2 - a3 - a4 + a5 + a6 - a8;
        fi[7] = a0 + 2 * a1 + a2 - a3 - a4 - a5 - a6 + a8;
        fi[8] = a0 + 2 * a1 + a2 + a3 + a4 - a5 - a6 - a8;

        for (let q = 0; q < 9; q++) f[q][idx] = fi[q];
    }

    /** Smagorinsky SGS turbulence: compute effective tau. */
    _smagorinskyTau(idx, rho, ux, uy, tau0, Cs) {
        const { f } = this;
        // Non-equilibrium stress tensor from f_neq = f - feq
        let Sxx = 0, Sxy = 0, Syy = 0;
        for (let q = 0; q < 9; q++) {
            const fNeq = f[q][idx] - this._feq(q, rho, ux, uy);
            Sxx += D2Q9.ex[q] * D2Q9.ex[q] * fNeq;
            Sxy += D2Q9.ex[q] * D2Q9.ey[q] * fNeq;
            Syy += D2Q9.ey[q] * D2Q9.ey[q] * fNeq;
        }
        const sMag = Math.sqrt(2 * (Sxx * Sxx + 2 * Sxy * Sxy + Syy * Syy));
        const tauTurb = 0.5 * (Math.sqrt(tau0 * tau0 + 2 * Math.SQRT2 * Cs * Cs * sMag / (rho * D2Q9.cs2 * D2Q9.cs2)) - tau0);
        return tau0 + tauTurb;
    }

    /** Streaming step — propagate distributions to neighbors. */
    _stream() {
        const { nx, ny, f, fTemp, solid } = this;
        const { ex, ey } = D2Q9;
        const periodicY = this.config.periodicY || false;

        for (let q = 0; q < 9; q++) {
            const dx = ex[q], dy = ey[q];
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    let ni = i + dx;
                    let nj = j + dy;

                    // Handle boundaries
                    if (ni < 0 || ni >= nx) continue; // inlet/outlet handled separately
                    if (periodicY) {
                        nj = ((nj % ny) + ny) % ny;
                    } else if (nj < 0 || nj >= ny) {
                        continue; // wall
                    }

                    const src = j * nx + i;
                    const dst = nj * nx + ni;

                    if (solid[src] === CELL.SOLID) continue;

                    fTemp[q][dst] = f[q][src];
                }
            }
        }

        // Swap f and fTemp
        for (let q = 0; q < 9; q++) {
            const tmp = this.f[q];
            this.f[q] = this.fTemp[q];
            this.fTemp[q] = tmp;
        }
    }

    /** Apply boundary conditions. */
    _boundaries() {
        const { nx, ny, f, solid } = this;
        const { ex, ey, opp, w, cs2 } = D2Q9;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;

                if (solid[idx] === CELL.SOLID) {
                    // Bounce-back: reverse all distributions
                    for (let q = 1; q < 9; q++) {
                        const ni = i + ex[q], nj = j + ey[q];
                        if (ni >= 0 && ni < nx && nj >= 0 && nj < ny) {
                            const nIdx = nj * nx + ni;
                            if (solid[nIdx] !== CELL.SOLID) {
                                f[opp[q]][nIdx] = f[q][nIdx];
                            }
                        }
                    }
                } else if (solid[idx] === CELL.INLET) {
                    // Zou-He velocity boundary (left wall)
                    this._zouHeInlet(i, j, idx);
                } else if (solid[idx] === CELL.OUTLET) {
                    // Extrapolation outlet (right wall)
                    this._extrapolationOutlet(i, j, idx);
                }

                // Top/bottom walls (if not periodic)
                if (!this.config.periodicY) {
                    if (j === 0 || j === ny - 1) {
                        if (solid[idx] !== CELL.SOLID) {
                            this._wallBounceBack(i, j, idx);
                        }
                    }
                }
            }
        }
    }

    /** Zou-He velocity inlet (left boundary). */
    _zouHeInlet(i, j, idx) {
        const { f } = this;
        const [ux0, uy0] = this._getInletVelocity(i, j);

        // Known: f[0], f[2], f[4], f[3], f[6], f[7]
        // Unknown: f[1], f[5], f[8]
        const rho = (f[0][idx] + f[2][idx] + f[4][idx] + 2 * (f[3][idx] + f[6][idx] + f[7][idx])) / (1 - ux0);

        this.rho[idx] = rho;
        this.ux[idx] = ux0;
        this.uy[idx] = uy0;

        const ru = rho * ux0;
        f[1][idx] = f[3][idx] + (2 / 3) * ru;
        f[5][idx] = f[7][idx] + (1 / 6) * ru + 0.5 * (f[4][idx] - f[2][idx]) + 0.5 * rho * uy0;
        f[8][idx] = f[6][idx] + (1 / 6) * ru - 0.5 * (f[4][idx] - f[2][idx]) - 0.5 * rho * uy0;
    }

    /** Extrapolation outlet (right boundary). */
    _extrapolationOutlet(i, j, idx) {
        const { nx, f } = this;
        if (i < 1) return;
        const prevIdx = j * nx + (i - 1);
        for (let q = 0; q < 9; q++) {
            f[q][idx] = f[q][prevIdx];
        }
    }

    /** Wall bounce-back for top/bottom boundaries. */
    _wallBounceBack(i, j, idx) {
        const { ny, f } = this;
        const { opp } = D2Q9;
        if (j === 0) {
            // Bottom wall: reflect upward-going distributions
            f[2][idx] = f[4][idx];
            f[5][idx] = f[7][idx];
            f[6][idx] = f[8][idx];
        } else if (j === ny - 1) {
            // Top wall: reflect downward-going distributions
            f[4][idx] = f[2][idx];
            f[7][idx] = f[5][idx];
            f[8][idx] = f[6][idx];
        }
    }

    /** Compute macroscopic fields from distributions. */
    _macroscopic() {
        const { nx, ny, f, solid, rho, ux, uy } = this;
        const { ex, ey } = D2Q9;
        const N = nx * ny;

        for (let idx = 0; idx < N; idx++) {
            if (solid[idx] === CELL.SOLID) {
                rho[idx] = 0;
                ux[idx] = 0;
                uy[idx] = 0;
                continue;
            }

            let r = 0, mx = 0, my = 0;
            for (let q = 0; q < 9; q++) {
                const fq = f[q][idx];
                r += fq;
                mx += ex[q] * fq;
                my += ey[q] * fq;
            }
            rho[idx] = r;
            if (r > 1e-10) {
                ux[idx] = mx / r;
                uy[idx] = my / r;
            } else {
                ux[idx] = 0;
                uy[idx] = 0;
            }
        }
    }

    /** Compute derived fields: pressure, vorticity, speed. */
    _computeDerived() {
        const { nx, ny, rho, ux, uy, pressure, curl, speed, solid } = this;

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                speed[idx] = Math.sqrt(ux[idx] * ux[idx] + uy[idx] * uy[idx]);
                pressure[idx] = rho[idx] * D2Q9.cs2; // p = rho * cs^2

                // Vorticity: duy/dx - dux/dy (central differences)
                if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1 &&
                    solid[idx] !== CELL.SOLID) {
                    const duy_dx = (uy[(j) * nx + (i + 1)] - uy[(j) * nx + (i - 1)]) * 0.5;
                    const dux_dy = (ux[(j + 1) * nx + i] - ux[(j - 1) * nx + i]) * 0.5;
                    curl[idx] = duy_dx - dux_dy;
                } else {
                    curl[idx] = 0;
                }
            }
        }
    }

    /** Get a field by name for rendering. */
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

    /** Update config (viscosity, collision, etc). */
    updateConfig(config) {
        Object.assign(this.config, config);
        this._updateTau();
    }
}
