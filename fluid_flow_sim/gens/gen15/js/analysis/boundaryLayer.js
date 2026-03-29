// ────────────────────────────────────────────
// boundaryLayer.js — BL thickness calculations
// ────────────────────────────────────────────
// Computes δ (99%), δ* (displacement), θ (momentum) from velocity profiles
// normal to body surfaces. Also includes Thwaites' and Head's integral methods.

import { CELL } from '../config.js';

/**
 * Compute boundary layer thicknesses at each surface point.
 * @param {object} solver — solver instance
 * @param {Body} body — body to analyze
 * @param {number} nx
 * @param {number} ny
 * @param {number} nSamples — number of surface sample points
 * @returns {{ points: Array<{x, y, delta, deltaStar, theta, Ue}> }}
 */
export function computeBoundaryLayer(solver, body, nx, ny, nSamples = 60) {
    const surfacePoints = body.getSurfacePoints(nSamples);
    const { ux, uy, solid } = solver;
    const uInf = solver.config?.uInf || 0.08;

    const results = [];
    const maxProbeLen = 40; // max distance to probe along normal

    for (const sp of surfacePoints) {
        let delta = 0, deltaStar = 0, theta = 0;
        let Ue = uInf; // edge velocity

        // Sample velocity along outward normal
        const profile = [];
        for (let d = 1; d <= maxProbeLen; d++) {
            const px = sp.x + sp.nx * d;
            const py = sp.y + sp.ny * d;

            // Bounds check
            if (px < 0 || px >= nx - 1 || py < 0 || py >= ny - 1) break;

            // Bilinear interpolation
            const i0 = Math.floor(px), j0 = Math.floor(py);
            const i1 = i0 + 1, j1 = j0 + 1;
            const sx = px - i0, sy = py - j0;

            // Check if any corner is solid
            const idx00 = j0 * nx + i0, idx10 = j0 * nx + i1;
            const idx01 = j1 * nx + i0, idx11 = j1 * nx + i1;
            if (solid[idx00] === CELL.SOLID || solid[idx10] === CELL.SOLID ||
                solid[idx01] === CELL.SOLID || solid[idx11] === CELL.SOLID) continue;

            const vx = (1 - sx) * (1 - sy) * ux[idx00] + sx * (1 - sy) * ux[idx10] +
                       (1 - sx) * sy * ux[idx01] + sx * sy * ux[idx11];
            const vy = (1 - sx) * (1 - sy) * uy[idx00] + sx * (1 - sy) * uy[idx10] +
                       (1 - sx) * sy * uy[idx01] + sx * sy * uy[idx11];

            // Tangential velocity component (along body surface)
            const uTan = Math.abs(vx * (-sp.ny) + vy * sp.nx);
            // Normal velocity component
            const uNorm = vx * sp.nx + vy * sp.ny;
            // Total speed
            const uTotal = Math.sqrt(vx * vx + vy * vy);

            profile.push({ d, uTan, uTotal, vx, vy });
        }

        if (profile.length < 3) {
            results.push({ x: sp.x, y: sp.y, nx: sp.nx, ny: sp.ny, delta: 0, deltaStar: 0, theta: 0, Ue: uInf });
            continue;
        }

        // Find edge velocity (max tangential velocity in profile)
        Ue = 0;
        for (const p of profile) {
            if (p.uTan > Ue) Ue = p.uTan;
        }
        if (Ue < 1e-10) Ue = uInf;

        // δ: distance where uTan reaches 99% of Ue
        delta = profile[profile.length - 1].d;
        for (let k = 0; k < profile.length; k++) {
            if (profile[k].uTan >= 0.99 * Ue) {
                delta = profile[k].d;
                break;
            }
        }

        // δ* and θ via trapezoidal integration
        deltaStar = 0;
        theta = 0;
        for (let k = 0; k < profile.length - 1; k++) {
            const d0 = profile[k].d, d1 = profile[k + 1].d;
            const dd = d1 - d0;
            const ratio0 = Math.min(profile[k].uTan / Ue, 1);
            const ratio1 = Math.min(profile[k + 1].uTan / Ue, 1);

            // δ* = ∫(1 - u/Ue)dn
            deltaStar += 0.5 * ((1 - ratio0) + (1 - ratio1)) * dd;

            // θ = ∫(u/Ue)(1 - u/Ue)dn
            theta += 0.5 * (ratio0 * (1 - ratio0) + ratio1 * (1 - ratio1)) * dd;

            if (profile[k + 1].d > delta * 1.5) break; // Don't integrate too far
        }

        results.push({
            x: sp.x, y: sp.y,
            nx: sp.nx, ny: sp.ny,
            delta, deltaStar, theta, Ue
        });
    }

    return { points: results };
}

/**
 * Thwaites' method for laminar boundary layer (integral method).
 * Provides an analytical estimate for comparison.
 * @param {number} Ue — edge velocity
 * @param {number} x — distance along surface from stagnation point
 * @param {number} nu — kinematic viscosity
 * @returns {{ theta, deltaStar, H, Cf }}
 */
export function thwaitesMethod(Ue, x, nu) {
    if (x <= 0 || Ue <= 0 || nu <= 0) return { theta: 0, deltaStar: 0, H: 2.59, Cf: 0 };

    // θ² = 0.45 ν / Ue⁶ * ∫₀ˣ Ue⁵ dx ≈ 0.45 ν x / Ue (for uniform Ue)
    const theta2 = 0.45 * nu * x / Ue;
    const theta = Math.sqrt(theta2);

    // Thwaites' parameter: λ = θ² / ν * dUe/dx (= 0 for flat plate)
    // For flat plate (dUe/dx = 0): λ = 0
    const lambda = 0; // flat plate case

    // Shape factor correlation (Thwaites)
    const H = 2.61 - 3.75 * lambda + 5.24 * lambda * lambda;
    const deltaStar = H * theta;

    // Skin friction correlation
    const l_plus = 0.22 + 1.57 * lambda - 1.8 * lambda * lambda;
    const Re_theta = Ue * theta / nu;
    const Cf = Re_theta > 0 ? 2 * l_plus / Re_theta : 0;

    return { theta, deltaStar, H, Cf };
}

/**
 * Shape factor H = δ_star/θ — used for transition detection.
 * H > 2.4–2.6 indicates separation is approaching.
 * @param {number} deltaStar
 * @param {number} theta
 * @returns {number}
 */
export function shapeFactorH(deltaStar, theta) {
    if (theta < 1e-10) return 0;
    return deltaStar / theta;
}
