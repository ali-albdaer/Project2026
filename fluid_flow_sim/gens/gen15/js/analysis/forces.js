// ────────────────────────────────────────────
// forces.js — Drag, lift, wall shear stress
// ────────────────────────────────────────────
// Computes forces on bodies using the momentum-exchange method (LBM)
// or direct integration of pressure/shear (Projection solver).

import { D2Q9, CELL } from '../config.js';

/**
 * Compute drag and lift on a body using pressure and velocity gradient integration.
 * Works for both solver types.
 */
export function computeForces(solver, body, nx, ny) {
    const solid = solver.solid;
    const ux = solver.ux;
    const uy = solver.uy;
    const pressure = solver.pressure;
    const rho = solver.rho;
    const nu = solver.config?.viscosity || 0.02;

    let Fx = 0, Fy = 0;
    let wallShearSum = 0;
    let wallShearCount = 0;

    // Find boundary cells: fluid cells adjacent to solid cells of this body
    const surfacePoints = body.getSurfacePoints(200);

    for (const sp of surfacePoints) {
        const si = Math.round(sp.x);
        const sj = Math.round(sp.y);
        if (si < 1 || si >= nx - 1 || sj < 1 || sj >= ny - 1) continue;
        const idx = sj * nx + si;

        // Find the nearest fluid cell in the normal direction
        const fi = Math.round(si + sp.nx);
        const fj = Math.round(sj + sp.ny);
        if (fi < 1 || fi >= nx - 1 || fj < 1 || fj >= ny - 1) continue;
        const fIdx = fj * nx + fi;
        if (solid[fIdx] === CELL.SOLID) continue;

        // Pressure force: F_p = -p * n * dA
        const p = pressure[fIdx];
        Fx -= p * sp.nx;
        Fy -= p * sp.ny;

        // Viscous shear stress: τ = μ * du/dn
        // Approximate du/dn from the fluid cell
        const uTan = ux[fIdx] * (-sp.ny) + uy[fIdx] * sp.nx; // tangential velocity
        const dist = Math.sqrt((fi - si) ** 2 + (fj - sj) ** 2) || 1;
        const shear = nu * (solver.config?.density || 1) * uTan / dist;

        // Viscous force in tangential direction, projected to x,y
        Fx += shear * (-sp.ny);
        Fy += shear * sp.nx;

        wallShearSum += Math.abs(shear);
        wallShearCount++;
    }

    const avgWallShear = wallShearCount > 0 ? wallShearSum / wallShearCount : 0;

    return { Fx, Fy, wallShear: avgWallShear };
}

/**
 * Momentum exchange method for LBM solver (more accurate for LBM).
 */
export function computeForcesLBM(solver, body, nx, ny) {
    if (solver.type !== 'lbm') return computeForces(solver, body, nx, ny);

    const { solid, f } = solver;
    const { ex, ey, opp } = D2Q9;

    let Fx = 0, Fy = 0;

    // Iterate over all solid cells belonging to this body
    for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
            const idx = j * nx + i;
            if (solid[idx] !== CELL.SOLID) continue;
            if (!body.contains(i, j)) continue;

            // Momentum exchange with adjacent fluid cells
            for (let q = 1; q < 9; q++) {
                const ni = i + ex[q], nj = j + ey[q];
                if (ni < 0 || ni >= nx || nj < 0 || nj >= ny) continue;
                const nIdx = nj * nx + ni;
                if (solid[nIdx] === CELL.SOLID) continue;

                // Force = e_q * (f_q(fluid) + f_opp(fluid))
                const qo = opp[q];
                Fx += ex[q] * (f[q][nIdx] + f[qo][nIdx]);
                Fy += ey[q] * (f[q][nIdx] + f[qo][nIdx]);
            }
        }
    }

    // Wall shear from velocity gradient
    const surfacePoints = body.getSurfacePoints(100);
    let wallShearSum = 0, count = 0;
    const nu = solver.config?.viscosity || 0.02;
    const rho0 = solver.config?.density || 1;

    for (const sp of surfacePoints) {
        const fi = Math.round(sp.x + sp.nx);
        const fj = Math.round(sp.y + sp.ny);
        if (fi < 1 || fi >= nx - 1 || fj < 1 || fj >= ny - 1) continue;
        const fIdx = fj * nx + fi;
        if (solid[fIdx] === CELL.SOLID) continue;

        const uTan = solver.ux[fIdx] * (-sp.ny) + solver.uy[fIdx] * sp.nx;
        wallShearSum += Math.abs(nu * rho0 * uTan);
        count++;
    }

    return {
        Fx,
        Fy,
        wallShear: count > 0 ? wallShearSum / count : 0
    };
}
