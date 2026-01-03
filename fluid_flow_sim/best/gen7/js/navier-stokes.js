/**
 * Navier-Stokes Solver
 * Real-time 2D incompressible Navier-Stokes solver using finite differences
 * Based on Jos Stam's "Stable Fluids" approach with improvements
 */

class NavierStokesSolver {
    constructor(width = 128, height = 128) {
        this.N = width;
        this.M = height;
        this.size = (this.N + 2) * (this.M + 2);
        
        // Physical parameters
        this.viscosity = 0.01;
        this.density = 1.0;
        this.dt = 0.016;
        this.iterations = 20;
        
        // Velocity fields (u, v)
        this.u = new Float32Array(this.size);
        this.v = new Float32Array(this.size);
        this.u_prev = new Float32Array(this.size);
        this.v_prev = new Float32Array(this.size);
        
        // Pressure
        this.p = new Float32Array(this.size);
        this.div = new Float32Array(this.size);
        
        // Density/dye for visualization
        this.d = new Float32Array(this.size);
        this.d_prev = new Float32Array(this.size);
        
        // Temperature (optional)
        this.temp = new Float32Array(this.size);
        this.temp_prev = new Float32Array(this.size);
        
        // Obstacle mask (0 = fluid, 1 = solid)
        this.obstacle = new Uint8Array(this.size);
        
        // Boundary conditions
        this.boundaryType = 'periodic'; // 'periodic', 'no-slip', 'inlet-outlet'
        this.inletVelocity = 1.0;
        
        // Running state
        this.isRunning = false;
        this.time = 0;
        
        // Domain
        this.domain = {
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5
        };
    }

    /**
     * Get array index for (i, j) coordinates
     */
    IX(i, j) {
        return i + (this.N + 2) * j;
    }

    /**
     * Reset all fields
     */
    reset() {
        this.u.fill(0);
        this.v.fill(0);
        this.u_prev.fill(0);
        this.v_prev.fill(0);
        this.p.fill(0);
        this.div.fill(0);
        this.d.fill(0);
        this.d_prev.fill(0);
        this.temp.fill(0);
        this.temp_prev.fill(0);
        this.obstacle.fill(0);
        this.time = 0;
        
        // Initialize with inlet velocity if applicable
        if (this.boundaryType === 'inlet-outlet') {
            this.applyInletOutlet();
        }
    }

    /**
     * Apply inlet-outlet boundary conditions
     */
    applyInletOutlet() {
        for (let j = 1; j <= this.M; j++) {
            // Left inlet
            this.u[this.IX(0, j)] = this.inletVelocity;
            this.u[this.IX(1, j)] = this.inletVelocity;
            this.v[this.IX(0, j)] = 0;
            
            // Right outlet (zero gradient)
            this.u[this.IX(this.N + 1, j)] = this.u[this.IX(this.N, j)];
            this.v[this.IX(this.N + 1, j)] = this.v[this.IX(this.N, j)];
        }
    }

    /**
     * Set boundary conditions
     */
    setBoundary(b, x) {
        const N = this.N;
        const M = this.M;
        
        if (this.boundaryType === 'periodic') {
            // Periodic boundaries
            for (let i = 1; i <= N; i++) {
                x[this.IX(i, 0)] = x[this.IX(i, M)];
                x[this.IX(i, M + 1)] = x[this.IX(i, 1)];
            }
            for (let j = 1; j <= M; j++) {
                x[this.IX(0, j)] = x[this.IX(N, j)];
                x[this.IX(N + 1, j)] = x[this.IX(1, j)];
            }
        } else if (this.boundaryType === 'no-slip') {
            // No-slip walls
            for (let i = 1; i <= N; i++) {
                x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
                x[this.IX(i, M + 1)] = b === 2 ? -x[this.IX(i, M)] : x[this.IX(i, M)];
            }
            for (let j = 1; j <= M; j++) {
                x[this.IX(0, j)] = b === 1 ? -x[this.IX(1, j)] : x[this.IX(1, j)];
                x[this.IX(N + 1, j)] = b === 1 ? -x[this.IX(N, j)] : x[this.IX(N, j)];
            }
        } else if (this.boundaryType === 'inlet-outlet') {
            // Inlet on left, outlet on right
            for (let j = 1; j <= M; j++) {
                if (b === 1) {
                    x[this.IX(0, j)] = this.inletVelocity;
                    x[this.IX(N + 1, j)] = x[this.IX(N, j)];
                } else {
                    x[this.IX(0, j)] = x[this.IX(1, j)];
                    x[this.IX(N + 1, j)] = x[this.IX(N, j)];
                }
            }
            // Top and bottom walls
            for (let i = 1; i <= N; i++) {
                x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
                x[this.IX(i, M + 1)] = b === 2 ? -x[this.IX(i, M)] : x[this.IX(i, M)];
            }
        }
        
        // Corners
        x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
        x[this.IX(0, M + 1)] = 0.5 * (x[this.IX(1, M + 1)] + x[this.IX(0, M)]);
        x[this.IX(N + 1, 0)] = 0.5 * (x[this.IX(N, 0)] + x[this.IX(N + 1, 1)]);
        x[this.IX(N + 1, M + 1)] = 0.5 * (x[this.IX(N, M + 1)] + x[this.IX(N + 1, M)]);
    }

    /**
     * Apply obstacle boundary conditions
     */
    applyObstacleBoundary() {
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                if (this.obstacle[this.IX(i, j)]) {
                    this.u[this.IX(i, j)] = 0;
                    this.v[this.IX(i, j)] = 0;
                    this.d[this.IX(i, j)] = 0;
                }
            }
        }
    }

    /**
     * Diffusion step using Gauss-Seidel
     */
    diffuse(b, x, x0, diff) {
        const a = this.dt * diff * this.N * this.M;
        
        for (let k = 0; k < this.iterations; k++) {
            for (let j = 1; j <= this.M; j++) {
                for (let i = 1; i <= this.N; i++) {
                    if (!this.obstacle[this.IX(i, j)]) {
                        x[this.IX(i, j)] = (x0[this.IX(i, j)] + a * (
                            x[this.IX(i - 1, j)] + x[this.IX(i + 1, j)] +
                            x[this.IX(i, j - 1)] + x[this.IX(i, j + 1)]
                        )) / (1 + 4 * a);
                    }
                }
            }
            this.setBoundary(b, x);
        }
    }

    /**
     * Advection step using semi-Lagrangian method
     */
    advect(b, d, d0, u, v) {
        const dt0 = this.dt * Math.max(this.N, this.M);
        
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                if (!this.obstacle[this.IX(i, j)]) {
                    // Trace back
                    let x = i - dt0 * u[this.IX(i, j)];
                    let y = j - dt0 * v[this.IX(i, j)];
                    
                    // Clamp to grid
                    x = Math.max(0.5, Math.min(this.N + 0.5, x));
                    y = Math.max(0.5, Math.min(this.M + 0.5, y));
                    
                    const i0 = Math.floor(x);
                    const i1 = i0 + 1;
                    const j0 = Math.floor(y);
                    const j1 = j0 + 1;
                    
                    const s1 = x - i0;
                    const s0 = 1 - s1;
                    const t1 = y - j0;
                    const t0 = 1 - t1;
                    
                    d[this.IX(i, j)] = 
                        s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
                        s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
                }
            }
        }
        this.setBoundary(b, d);
    }

    /**
     * Pressure projection to enforce incompressibility
     */
    project() {
        const h = 1.0 / Math.max(this.N, this.M);
        
        // Calculate divergence
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                this.div[this.IX(i, j)] = -0.5 * h * (
                    this.u[this.IX(i + 1, j)] - this.u[this.IX(i - 1, j)] +
                    this.v[this.IX(i, j + 1)] - this.v[this.IX(i, j - 1)]
                );
                this.p[this.IX(i, j)] = 0;
            }
        }
        this.setBoundary(0, this.div);
        this.setBoundary(0, this.p);
        
        // Solve Poisson equation for pressure
        for (let k = 0; k < this.iterations; k++) {
            for (let j = 1; j <= this.M; j++) {
                for (let i = 1; i <= this.N; i++) {
                    if (!this.obstacle[this.IX(i, j)]) {
                        this.p[this.IX(i, j)] = (this.div[this.IX(i, j)] +
                            this.p[this.IX(i - 1, j)] + this.p[this.IX(i + 1, j)] +
                            this.p[this.IX(i, j - 1)] + this.p[this.IX(i, j + 1)]
                        ) / 4;
                    }
                }
            }
            this.setBoundary(0, this.p);
        }
        
        // Subtract pressure gradient
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                if (!this.obstacle[this.IX(i, j)]) {
                    this.u[this.IX(i, j)] -= 0.5 * (this.p[this.IX(i + 1, j)] - this.p[this.IX(i - 1, j)]) / h;
                    this.v[this.IX(i, j)] -= 0.5 * (this.p[this.IX(i, j + 1)] - this.p[this.IX(i, j - 1)]) / h;
                }
            }
        }
        this.setBoundary(1, this.u);
        this.setBoundary(2, this.v);
    }

    /**
     * Main velocity step
     */
    velStep() {
        // Add forces
        this.addForces();
        
        // Swap buffers
        [this.u, this.u_prev] = [this.u_prev, this.u];
        [this.v, this.v_prev] = [this.v_prev, this.v];
        
        // Diffuse
        this.diffuse(1, this.u, this.u_prev, this.viscosity);
        this.diffuse(2, this.v, this.v_prev, this.viscosity);
        
        // Project to make divergence-free
        this.project();
        
        // Swap again
        [this.u, this.u_prev] = [this.u_prev, this.u];
        [this.v, this.v_prev] = [this.v_prev, this.v];
        
        // Advect
        this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev);
        this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev);
        
        // Project again
        this.project();
        
        // Apply obstacle boundaries
        this.applyObstacleBoundary();
    }

    /**
     * Density step
     */
    densStep() {
        // Swap
        [this.d, this.d_prev] = [this.d_prev, this.d];
        
        // Diffuse
        this.diffuse(0, this.d, this.d_prev, this.viscosity * 0.1);
        
        // Swap again
        [this.d, this.d_prev] = [this.d_prev, this.d];
        
        // Advect
        this.advect(0, this.d, this.d_prev, this.u, this.v);
        
        // Decay
        for (let i = 0; i < this.size; i++) {
            this.d[i] *= 0.999;
        }
    }

    /**
     * Add external forces
     */
    addForces() {
        // Buoyancy from temperature
        const buoyancy = 0.1;
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                this.v[this.IX(i, j)] += buoyancy * this.temp[this.IX(i, j)] * this.dt;
            }
        }
    }

    /**
     * Add velocity at a point
     */
    addVelocity(x, y, amountX, amountY) {
        const i = Math.floor(x * this.N) + 1;
        const j = Math.floor(y * this.M) + 1;
        
        if (i >= 1 && i <= this.N && j >= 1 && j <= this.M) {
            if (!this.obstacle[this.IX(i, j)]) {
                this.u[this.IX(i, j)] += amountX;
                this.v[this.IX(i, j)] += amountY;
            }
        }
    }

    /**
     * Add density at a point
     */
    addDensity(x, y, amount) {
        const i = Math.floor(x * this.N) + 1;
        const j = Math.floor(y * this.M) + 1;
        
        if (i >= 1 && i <= this.N && j >= 1 && j <= this.M) {
            if (!this.obstacle[this.IX(i, j)]) {
                this.d[this.IX(i, j)] += amount;
            }
        }
    }

    /**
     * Add circular obstacle
     */
    addCircleObstacle(cx, cy, radius) {
        const ni = Math.floor(cx * this.N) + 1;
        const nj = Math.floor(cy * this.M) + 1;
        const nr = Math.floor(radius * Math.min(this.N, this.M));
        
        for (let j = Math.max(1, nj - nr); j <= Math.min(this.M, nj + nr); j++) {
            for (let i = Math.max(1, ni - nr); i <= Math.min(this.N, ni + nr); i++) {
                const dx = i - ni;
                const dy = j - nj;
                if (dx * dx + dy * dy <= nr * nr) {
                    this.obstacle[this.IX(i, j)] = 1;
                }
            }
        }
    }

    /**
     * Add square obstacle
     */
    addSquareObstacle(cx, cy, size) {
        const ni = Math.floor(cx * this.N) + 1;
        const nj = Math.floor(cy * this.M) + 1;
        const ns = Math.floor(size * Math.min(this.N, this.M) / 2);
        
        for (let j = Math.max(1, nj - ns); j <= Math.min(this.M, nj + ns); j++) {
            for (let i = Math.max(1, ni - ns); i <= Math.min(this.N, ni + ns); i++) {
                this.obstacle[this.IX(i, j)] = 1;
            }
        }
    }

    /**
     * Add NACA airfoil obstacle
     */
    addAirfoilObstacle(cx, cy, chord, thickness = 0.12, angle = 0) {
        const nc = Math.floor(chord * this.N);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        for (let j = 1; j <= this.M; j++) {
            for (let i = 1; i <= this.N; i++) {
                // Transform to airfoil coordinates
                const px = (i - 1) / this.N - cx;
                const py = (j - 1) / this.M - cy;
                
                // Rotate
                const x = px * cos + py * sin;
                const y = -px * sin + py * cos;
                
                // NACA 4-digit airfoil
                if (x >= 0 && x <= chord) {
                    const t = thickness * chord;
                    const yt = 5 * t * (0.2969 * Math.sqrt(x / chord) 
                        - 0.1260 * (x / chord) 
                        - 0.3516 * Math.pow(x / chord, 2) 
                        + 0.2843 * Math.pow(x / chord, 3) 
                        - 0.1015 * Math.pow(x / chord, 4));
                    
                    if (Math.abs(y) <= yt) {
                        this.obstacle[this.IX(i, j)] = 1;
                    }
                }
            }
        }
    }

    /**
     * Clear obstacles
     */
    clearObstacles() {
        this.obstacle.fill(0);
    }

    /**
     * Step the simulation forward
     */
    step() {
        this.velStep();
        this.densStep();
        this.time += this.dt;
    }

    /**
     * Get velocity at world coordinates
     */
    getVelocity(x, y) {
        // Map world coordinates to grid
        const nx = (x - this.domain.xMin) / (this.domain.xMax - this.domain.xMin);
        const ny = (y - this.domain.yMin) / (this.domain.yMax - this.domain.yMin);
        
        const i = MathUtils.clamp(Math.floor(nx * this.N) + 1, 1, this.N);
        const j = MathUtils.clamp(Math.floor(ny * this.M) + 1, 1, this.M);
        
        return {
            u: this.u[this.IX(i, j)],
            v: this.v[this.IX(i, j)]
        };
    }

    /**
     * Get density at world coordinates
     */
    getDensity(x, y) {
        const nx = (x - this.domain.xMin) / (this.domain.xMax - this.domain.xMin);
        const ny = (y - this.domain.yMin) / (this.domain.yMax - this.domain.yMin);
        
        const i = MathUtils.clamp(Math.floor(nx * this.N) + 1, 1, this.N);
        const j = MathUtils.clamp(Math.floor(ny * this.M) + 1, 1, this.M);
        
        return this.d[this.IX(i, j)];
    }

    /**
     * Get pressure at world coordinates
     */
    getPressure(x, y) {
        const nx = (x - this.domain.xMin) / (this.domain.xMax - this.domain.xMin);
        const ny = (y - this.domain.yMin) / (this.domain.yMax - this.domain.yMin);
        
        const i = MathUtils.clamp(Math.floor(nx * this.N) + 1, 1, this.N);
        const j = MathUtils.clamp(Math.floor(ny * this.M) + 1, 1, this.M);
        
        return this.p[this.IX(i, j)];
    }

    /**
     * Get vorticity at grid point
     */
    getVorticity(i, j) {
        if (i < 1 || i > this.N || j < 1 || j > this.M) return 0;
        
        const dvdx = (this.v[this.IX(i + 1, j)] - this.v[this.IX(i - 1, j)]) * 0.5 * this.N;
        const dudy = (this.u[this.IX(i, j + 1)] - this.u[this.IX(i, j - 1)]) * 0.5 * this.M;
        
        return dvdx - dudy;
    }

    /**
     * Get field data for visualization
     */
    getFieldData(quantity) {
        const nx = this.N;
        const ny = this.M;
        const data = new Float32Array(nx * ny);
        let min = Infinity, max = -Infinity;
        
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const idx = j * nx + i;
                const gridIdx = this.IX(i + 1, j + 1);
                let val = 0;
                
                switch (quantity) {
                    case 'velocity':
                        val = Math.sqrt(this.u[gridIdx] ** 2 + this.v[gridIdx] ** 2);
                        break;
                    case 'pressure':
                        val = this.p[gridIdx];
                        break;
                    case 'density':
                        val = this.d[gridIdx];
                        break;
                    case 'vorticity':
                        val = this.getVorticity(i + 1, j + 1);
                        break;
                    case 'temperature':
                        val = this.temp[gridIdx];
                        break;
                    default:
                        val = Math.sqrt(this.u[gridIdx] ** 2 + this.v[gridIdx] ** 2);
                }
                
                data[idx] = val;
                if (isFinite(val)) {
                    min = Math.min(min, val);
                    max = Math.max(max, val);
                }
            }
        }
        
        return { data, range: { min, max }, nx, ny };
    }

    /**
     * Set parameters
     */
    setParams(params) {
        if (params.viscosity !== undefined) this.viscosity = params.viscosity;
        if (params.density !== undefined) this.density = params.density;
        if (params.dt !== undefined) this.dt = params.dt;
        if (params.iterations !== undefined) this.iterations = params.iterations;
        if (params.inletVelocity !== undefined) this.inletVelocity = params.inletVelocity;
        if (params.boundaryType !== undefined) this.boundaryType = params.boundaryType;
    }
}

// Export
window.NavierStokesSolver = NavierStokesSolver;
