// analysis.js — Force computation, boundary layer analysis, dimensionless numbers

export class FlowAnalysis {
    constructor() {
        this.results = {
            drag: 0, lift: 0,
            Cd: 0, Cl: 0, Cf: 0,
            wallShear: 0,
            Re: 0, St: 0, Fr: 0, Pr: 0,
            maxSpeed: 0, avgSpeed: 0,
            maxVorticity: 0,
        };
        this._sampleBuffer = null;
        this._frameCount = 0;
        this._liftHistory = [];
    }

    /**
     * Compute derived quantities from flow field.
     * @param {import('../core/gpu.js').GPU} gpu
     * @param {import('./solver-base.js').SolverBase} solver
     * @param {import('./bodies.js').Body[]} bodies
     * @param {Object} flowParams - { inletU, viscosity, density, charLength }
     */
    compute(gpu, solver, bodies, flowParams) {
        this._frameCount++;

        const w = solver.width, h = solver.height;
        const Uinf = Math.sqrt(flowParams.inletU[0]**2 + flowParams.inletU[1]**2);
        const nu = flowParams.viscosity;
        const rho = flowParams.density || 1.0;

        // Dimensionless numbers
        const L = flowParams.charLength || (w * 0.1); // characteristic length in lattice units
        this.results.Re = Uinf * L / Math.max(nu, 1e-10);
        this.results.Pr = 0.71; // Air at standard conditions (cosmetic)
        this.results.Fr = Uinf / Math.sqrt(9.81 * L / w); // Approximate
        this.results.St = 0; // Will be computed from lift oscillation

        // Sample a strip of the flow field for force computation
        // Read the macroscopic texture to get velocity/pressure
        const flowFbo = solver.getFlowFBO();
        if (!flowFbo) return;

        // For forces: sample a column around each body
        if (bodies.length > 0 && this._frameCount % 3 === 0) {
            this._computeForces(gpu, solver, bodies, flowParams);
        }

        // Compute Strouhal number from lift oscillation
        if (this._liftHistory.length > 100) {
            this._computeStrouhal(flowParams);
        }
    }

    _computeForces(gpu, solver, bodies, flowParams) {
        const w = solver.width, h = solver.height;
        const Uinf = Math.sqrt(flowParams.inletU[0]**2 + flowParams.inletU[1]**2);
        const rho = flowParams.density || 1.0;

        // Read a vertical strip through the first body for simple force estimation
        const body = bodies[0];
        if (!body) return;

        const bx = Math.round(body.x * w);
        const by = Math.round(body.y * h);

        // Read a small region around the body for momentum deficit calculation
        const sampleW = Math.min(40, Math.round(w * 0.1));
        const sampleH = Math.min(h, h);
        const x0 = Math.max(0, Math.min(w - sampleW, bx + sampleW));

        try {
            const flowFbo = solver.getFlowFBO();
            const data = gpu.readRegion(flowFbo, x0, 0, Math.min(sampleW, w - x0), sampleH);

            // Momentum deficit method for drag
            let dragSum = 0;
            let liftSum = 0;
            for (let j = 0; j < sampleH; j++) {
                const idx = j * sampleW * 4; // might be partial
                if (idx + 3 >= data.length) break;
                const ux = data[idx + 2]; // ux
                const uy = data[idx + 3]; // uy
                const localRho = data[idx + 1]; // rho
                dragSum += localRho * ux * (Uinf - ux);
                liftSum += localRho * ux * uy;
            }

            this.results.drag = dragSum / sampleH;
            this.results.lift = liftSum / sampleH;

            // Coefficients
            const qInf = 0.5 * rho * Uinf * Uinf;
            const charL = this._estimateCharLength(body, w, h);
            if (qInf > 1e-10 && charL > 0) {
                this.results.Cd = this.results.drag / (qInf * charL);
                this.results.Cl = this.results.lift / (qInf * charL);
            }

            // Record lift for Strouhal computation
            this._liftHistory.push(this.results.lift);
            if (this._liftHistory.length > 500) this._liftHistory.shift();

            // Wall shear stress estimate (tau_w ≈ mu * du/dy at wall)
            const mu = flowParams.viscosity * rho;
            this.results.wallShear = mu * Math.abs(this.results.drag) / Math.max(charL, 1);
            this.results.Cf = this.results.wallShear / Math.max(qInf, 1e-10);

        } catch (e) {
            // Readback may fail; ignore
        }
    }

    _computeStrouhal(flowParams) {
        // Simple zero-crossing frequency detection on lift signal
        const hist = this._liftHistory;
        let crossings = 0;
        for (let i = 1; i < hist.length; i++) {
            if ((hist[i] >= 0 && hist[i-1] < 0) || (hist[i] < 0 && hist[i-1] >= 0)) {
                crossings++;
            }
        }
        const freq = crossings / (2.0 * hist.length); // in simulation steps
        const Uinf = Math.sqrt(flowParams.inletU[0]**2 + flowParams.inletU[1]**2);
        const L = flowParams.charLength || 10;
        this.results.St = freq * L / Math.max(Uinf, 1e-10);
    }

    _estimateCharLength(body, w, h) {
        const p = body.params;
        switch (body.type) {
            case 'CIRCLE': return p.radius * 2 * h;
            case 'RECTANGLE': return p.height * h;
            case 'AIRFOIL': return p.chord * h;
            case 'FLAT_PLATE': return p.length * h;
            case 'ELLIPSE': return p.ry * 2 * h;
            default: return (p.radius || p.height || p.width || 0.05) * h;
        }
    }

    /**
     * Compute boundary layer profiles along a body surface.
     * Returns arrays of { x, delta, deltaStar, theta } for rendering.
     */
    computeBoundaryLayer(gpu, solver, body, flowParams) {
        if (!body) return [];
        const w = solver.width, h = solver.height;
        const Uinf = Math.sqrt(flowParams.inletU[0]**2 + flowParams.inletU[1]**2);
        if (Uinf < 1e-6) return [];

        const flowFbo = solver.getFlowFBO();
        if (!flowFbo) return [];

        const bx = body.x * w;
        const by = body.y * h;
        const profiles = [];

        // Sample at several x-stations along the body
        const charW = (body.params.chord || body.params.length || body.params.width || body.params.radius * 2 || 0.1);
        const startX = Math.round((body.x - charW * 0.5) * w);
        const endX = Math.round((body.x + charW * 0.6) * w);
        const stations = 12;

        for (let s = 0; s < stations; s++) {
            const sx = Math.round(startX + (endX - startX) * s / (stations - 1));
            if (sx < 0 || sx >= w) continue;

            // Read a vertical column at this x-station
            try {
                const colData = gpu.readRegion(flowFbo, sx, 0, 1, h);

                // Find body surface (where obstacle mask transitions)
                // Then scan outward to find BL thickness
                const byInt = Math.round(by);

                // Scan upward from body center to find outer edge
                let delta99 = 0, deltaStar = 0, theta = 0;
                let foundSurface = false;

                for (let j = byInt; j < h - 1; j++) {
                    const ux = colData[j * 4 + 2];
                    const uRatio = Math.abs(ux) / Math.max(Uinf, 1e-10);

                    if (!foundSurface && uRatio < 0.01) {
                        foundSurface = true;
                        continue;
                    }
                    if (!foundSurface) continue;

                    const dy = (j - byInt) / h;
                    if (uRatio >= 0.99 && delta99 === 0) {
                        delta99 = dy;
                    }
                    deltaStar += (1.0 - uRatio) * (1.0 / h);
                    theta += uRatio * (1.0 - uRatio) * (1.0 / h);

                    if (delta99 > 0 && uRatio > 0.999) break;
                }

                if (delta99 === 0) delta99 = deltaStar * 2; // fallback

                profiles.push({
                    x: sx / w,
                    y: by / h,
                    delta: delta99,
                    deltaStar: deltaStar,
                    theta: theta
                });
            } catch (e) { /* ignore readback errors */ }
        }

        return profiles;
    }

    /**
     * Read flow properties at a specific point.
     */
    probeAt(gpu, solver, nx, ny) {
        const w = solver.width, h = solver.height;
        const px = Math.round(nx * w);
        const py = Math.round(ny * h);
        if (px < 0 || px >= w || py < 0 || py >= h) return null;

        try {
            const flowFbo = solver.getFlowFBO();
            const data = gpu.readPixel(flowFbo, px, py);
            const ux = data[2], uy = data[3], rho = data[1];
            const speed = Math.sqrt(ux * ux + uy * uy);

            // Read curl if available
            let curl = 0;
            try {
                const curlData = gpu.readPixel(solver._curlFbo, px, py);
                curl = curlData[0];
            } catch(e) {}

            return {
                x: nx, y: ny,
                ux, uy, rho, speed,
                pressure: rho - 1.0, // p = (rho - rho0) * cs^2, cs^2 = 1/3
                vorticity: curl,
                mach: speed / 0.5774 // cs = 1/sqrt(3)
            };
        } catch (e) {
            return null;
        }
    }
}
