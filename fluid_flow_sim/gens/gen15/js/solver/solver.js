// ────────────────────────────────────────────
// solver.js — Solver factory and interface
// ────────────────────────────────────────────

import { LBMSolver } from './lbm.js';
import { ProjectionSolver } from './projection.js';
import { SOLVER_TYPE } from '../config.js';

/**
 * Create a solver instance.
 * Both solver types expose the same API:
 *   .step()           — advance one timestep
 *   .reset()          — reinitialize
 *   .resize(nx, ny)   — change grid
 *   .getField(name)   — get Float32Array for named field
 *   .updateConfig(c)  — update settings
 *   .solid            — Uint8Array cell flags
 *   .ux, .uy          — velocity components
 *   .rho, .pressure   — density, pressure
 *   .curl, .speed     — derived fields
 *
 * @param {string} type — 'lbm' or 'projection'
 * @param {number} nx
 * @param {number} ny
 * @param {object} config
 * @returns {LBMSolver|ProjectionSolver}
 */
export function createSolver(type, nx, ny, config) {
    switch (type) {
        case SOLVER_TYPE.LBM:
            return new LBMSolver(nx, ny, config);
        case SOLVER_TYPE.PROJECTION:
            return new ProjectionSolver(nx, ny, config);
        default:
            console.warn(`Unknown solver type: ${type}, defaulting to LBM`);
            return new LBMSolver(nx, ny, config);
    }
}
