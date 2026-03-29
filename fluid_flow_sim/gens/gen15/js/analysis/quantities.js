// ────────────────────────────────────────────
// quantities.js — Dimensionless numbers & derived quantities
// ────────────────────────────────────────────

/**
 * Compute all dimensionless numbers and coefficients for a body.
 * @param {object} params
 * @param {number} params.Fx — drag force (lattice units)
 * @param {number} params.Fy — lift force (lattice units)
 * @param {number} params.wallShear — average wall shear stress
 * @param {number} params.uInf — freestream velocity
 * @param {number} params.charLength — characteristic length
 * @param {number} params.nu — kinematic viscosity
 * @param {number} params.rho — density
 * @param {number} params.liftHistory — array of recent Fy values (for Strouhal)
 * @param {number} params.dt — timestep (frames)
 * @returns {object} — all computed quantities
 */
export function computeQuantities(params) {
    const { Fx = 0, Fy = 0, wallShear = 0, uInf = 0.08, charLength = 20,
            nu = 0.02, rho = 1, liftHistory = null, dt = 1 } = params;

    const U = Math.max(uInf, 1e-10);
    const L = Math.max(charLength, 1e-10);
    const dynPressure = 0.5 * rho * U * U;

    // Reynolds number
    const Re = U * L / Math.max(nu, 1e-15);

    // Drag coefficient
    const Cd = dynPressure > 0 ? Math.abs(Fx) / (dynPressure * L) : 0;

    // Lift coefficient
    const Cl = dynPressure > 0 ? Fy / (dynPressure * L) : 0;

    // Skin friction coefficient
    const Cf = dynPressure > 0 ? wallShear / dynPressure : 0;

    // Strouhal number from lift oscillation frequency
    let St = 0;
    if (liftHistory && liftHistory.length > 50) {
        const freq = estimateDominantFrequency(liftHistory, dt);
        St = freq * L / U;
    }

    // Froude number (requires gravity)
    const g = 9.81; // adjustable
    const Fr = U / Math.sqrt(g * L);

    // Prandtl (user-defined, no thermal solve)
    const Pr = 0.71; // air at room temperature

    return {
        Re: Re,
        Cd: Cd,
        Cl: Cl,
        Cf: Cf,
        St: St,
        Fr: Fr,
        Pr: Pr,
        Fx: Fx,
        Fy: Fy,
        wallShear: wallShear,
    };
}

/**
 * Estimate dominant frequency from a signal using zero-crossing method.
 * More efficient than FFT for this purpose.
 */
function estimateDominantFrequency(signal, dt) {
    if (signal.length < 10) return 0;

    // Remove mean
    let mean = 0;
    for (let i = 0; i < signal.length; i++) mean += signal[i];
    mean /= signal.length;

    // Count zero crossings
    let crossings = 0;
    for (let i = 1; i < signal.length; i++) {
        if ((signal[i - 1] - mean) * (signal[i] - mean) < 0) {
            crossings++;
        }
    }

    // Frequency = crossings / (2 * total_time)
    const totalTime = signal.length * dt;
    return totalTime > 0 ? crossings / (2 * totalTime) : 0;
}

/**
 * Format a quantity for display.
 */
export function formatQuantity(value, precision = 4) {
    if (Math.abs(value) < 1e-10) return '0';
    if (Math.abs(value) > 1e4 || Math.abs(value) < 1e-3) {
        return value.toExponential(precision - 1);
    }
    return value.toPrecision(precision);
}
