// Navier-Stokes Eulerian Solver
class NavierStokesSolver {
    constructor(width, height, gridSize) {
        this.width = width;
        this.height = height;
        this.gridSize = gridSize;
        this.nx = Math.floor(width / gridSize);
        this.ny = Math.floor(height / gridSize);
        
        // Velocity fields
        this.u = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v = this.create2DArray(this.nx + 2, this.ny + 1);
        this.u_prev = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v_prev = this.create2DArray(this.nx + 2, this.ny + 1);
        
        // Pressure and density
        this.p = this.create2DArray(this.nx + 2, this.ny + 2);
        this.density = this.create2DArray(this.nx + 2, this.ny + 2);
        this.temperature = this.create2DArray(this.nx + 2, this.ny + 2);
        
        // Obstacle mask
        this.obstacle = this.create2DArray(this.nx + 2, this.ny + 2);
        
        // Simulation parameters
        this.viscosity = 0.001;
        this.density_value = 1.0;
        this.dt = 0.1;
        this.iterations = 20;
        
        this.initializeFields();
    }

    create2DArray(nx, ny) {
        const arr = new Array(nx);
        for (let i = 0; i < nx; i++) {
            arr[i] = new Array(ny).fill(0);
        }
        return arr;
    }

    initializeFields() {
        // Initialize with uniform density and temperature
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                this.density[i][j] = this.density_value;
                this.temperature[i][j] = 293; // Room temperature in K
            }
        }
    }

    // Add circular obstacle
    addCircularObstacle(cx, cy, radius) {
        const gridCx = Math.floor(cx / this.gridSize);
        const gridCy = Math.floor(cy / this.gridSize);
        const gridRadius = radius / this.gridSize;
        
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                const dx = i - gridCx;
                const dy = j - gridCy;
                if (dx * dx + dy * dy < gridRadius * gridRadius) {
                    this.obstacle[i][j] = 1;
                }
            }
        }
    }

    // Clear obstacles
    clearObstacles() {
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                this.obstacle[i][j] = 0;
            }
        }
    }

    // Reset simulation
    reset() {
        this.u = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v = this.create2DArray(this.nx + 2, this.ny + 1);
        this.u_prev = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v_prev = this.create2DArray(this.nx + 2, this.ny + 1);
        this.p = this.create2DArray(this.nx + 2, this.ny + 2);
        this.initializeFields();
    }

    // Apply boundary conditions
    applyBoundaryConditions(inletVelocity) {
        // Left boundary - inlet
        for (let j = 1; j < this.ny + 1; j++) {
            this.u[0][j] = inletVelocity;
            this.v[0][j] = 0;
        }
        
        // Right boundary - outlet (zero gradient)
        for (let j = 1; j < this.ny + 1; j++) {
            this.u[this.nx][j] = this.u[this.nx - 1][j];
            this.v[this.nx + 1][j] = this.v[this.nx][j];
        }
        
        // Top and bottom boundaries - no slip
        for (let i = 0; i < this.nx + 1; i++) {
            this.u[i][0] = 0;
            this.u[i][this.ny + 1] = 0;
        }
        for (let i = 0; i < this.nx + 2; i++) {
            this.v[i][0] = 0;
            this.v[i][this.ny] = 0;
        }
    }

    // Advection step using semi-Lagrangian method
    advect(field, field_prev, u, v) {
        const dt0 = this.dt * Math.max(this.nx, this.ny);
        
        for (let i = 1; i < field.length - 1; i++) {
            for (let j = 1; j < field[0].length - 1; j++) {
                if (this.obstacle[i] && this.obstacle[i][j]) continue;
                
                let x = i - dt0 * u[i][j];
                let y = j - dt0 * v[i][j];
                
                x = Math.max(0.5, Math.min(field.length - 1.5, x));
                y = Math.max(0.5, Math.min(field[0].length - 1.5, y));
                
                const i0 = Math.floor(x);
                const j0 = Math.floor(y);
                const i1 = i0 + 1;
                const j1 = j0 + 1;
                
                const s1 = x - i0;
                const s0 = 1 - s1;
                const t1 = y - j0;
                const t0 = 1 - t1;
                
                field[i][j] = s0 * (t0 * field_prev[i0][j0] + t1 * field_prev[i0][j1]) +
                              s1 * (t0 * field_prev[i1][j0] + t1 * field_prev[i1][j1]);
            }
        }
    }

    // Diffusion step using Gauss-Seidel iteration
    diffuse(field, field_prev, diff) {
        const a = this.dt * diff * this.nx * this.ny;
        
        for (let k = 0; k < this.iterations; k++) {
            for (let i = 1; i < field.length - 1; i++) {
                for (let j = 1; j < field[0].length - 1; j++) {
                    if (this.obstacle[i] && this.obstacle[i][j]) continue;
                    
                    field[i][j] = (field_prev[i][j] + a * (
                        field[i - 1][j] + field[i + 1][j] +
                        field[i][j - 1] + field[i][j + 1]
                    )) / (1 + 4 * a);
                }
            }
        }
    }

    // Project to ensure incompressibility
    project() {
        const h = 1.0 / Math.max(this.nx, this.ny);
        
        // Compute divergence
        const div = this.create2DArray(this.nx + 2, this.ny + 2);
        const p = this.create2DArray(this.nx + 2, this.ny + 2);
        
        for (let i = 1; i < this.nx + 1; i++) {
            for (let j = 1; j < this.ny + 1; j++) {
                if (this.obstacle[i][j]) continue;
                
                div[i][j] = -0.5 * h * (
                    this.u[i][j] - this.u[i - 1][j] +
                    this.v[i][j] - this.v[i][j - 1]
                );
                p[i][j] = 0;
            }
        }
        
        // Solve for pressure using Gauss-Seidel
        for (let k = 0; k < this.iterations; k++) {
            for (let i = 1; i < this.nx + 1; i++) {
                for (let j = 1; j < this.ny + 1; j++) {
                    if (this.obstacle[i][j]) continue;
                    
                    p[i][j] = (div[i][j] + p[i - 1][j] + p[i + 1][j] +
                               p[i][j - 1] + p[i][j + 1]) / 4;
                }
            }
        }
        
        // Update velocity field
        for (let i = 1; i < this.nx; i++) {
            for (let j = 1; j < this.ny + 1; j++) {
                if (!this.obstacle[i][j] && !this.obstacle[i + 1][j]) {
                    this.u[i][j] -= 0.5 * (p[i + 1][j] - p[i][j]) / h;
                }
            }
        }
        
        for (let i = 1; i < this.nx + 1; i++) {
            for (let j = 1; j < this.ny; j++) {
                if (!this.obstacle[i][j] && !this.obstacle[i][j + 1]) {
                    this.v[i][j] -= 0.5 * (p[i][j + 1] - p[i][j]) / h;
                }
            }
        }
        
        this.p = p;
    }

    // Time step
    step(inletVelocity) {
        // Apply boundary conditions
        this.applyBoundaryConditions(inletVelocity);
        
        // Store previous velocities
        this.u_prev = this.u.map(row => [...row]);
        this.v_prev = this.v.map(row => [...row]);
        
        // Diffusion
        this.diffuse(this.u, this.u_prev, this.viscosity);
        this.diffuse(this.v, this.v_prev, this.viscosity);
        
        // Project
        this.project();
        
        // Store for advection
        this.u_prev = this.u.map(row => [...row]);
        this.v_prev = this.v.map(row => [...row]);
        
        // Advection
        this.advect(this.u, this.u_prev, this.u_prev, this.v_prev);
        this.advect(this.v, this.v_prev, this.u_prev, this.v_prev);
        
        // Project again
        this.project();
        
        // Apply obstacle boundary conditions
        for (let i = 1; i < this.nx; i++) {
            for (let j = 1; j < this.ny + 1; j++) {
                if (this.obstacle[i][j] || this.obstacle[i + 1][j]) {
                    this.u[i][j] = 0;
                }
            }
        }
        
        for (let i = 1; i < this.nx + 1; i++) {
            for (let j = 1; j < this.ny; j++) {
                if (this.obstacle[i][j] || this.obstacle[i][j + 1]) {
                    this.v[i][j] = 0;
                }
            }
        }
    }

    // Get velocity at a point
    getVelocity(x, y) {
        const i = Math.floor(x / this.gridSize);
        const j = Math.floor(y / this.gridSize);
        
        if (i < 0 || i >= this.nx || j < 0 || j >= this.ny) {
            return { u: 0, v: 0, magnitude: 0 };
        }
        
        const u = (this.u[i][j] + this.u[i][j + 1]) / 2;
        const v = (this.v[i][j] + this.v[i + 1][j]) / 2;
        
        return { u, v, magnitude: Math.sqrt(u * u + v * v) };
    }

    // Get pressure at a point
    getPressure(x, y) {
        const i = Math.floor(x / this.gridSize);
        const j = Math.floor(y / this.gridSize);
        
        if (i < 0 || i >= this.nx + 2 || j < 0 || j >= this.ny + 2) {
            return 0;
        }
        
        return this.p[i][j];
    }

    // Get vorticity at a point
    getVorticity(x, y) {
        const i = Math.floor(x / this.gridSize);
        const j = Math.floor(y / this.gridSize);
        
        if (i < 1 || i >= this.nx || j < 1 || j >= this.ny) {
            return 0;
        }
        
        const dvdx = (this.v[i + 1][j] - this.v[i][j]) * this.nx;
        const dudy = (this.u[i][j + 1] - this.u[i][j]) * this.ny;
        
        return dvdx - dudy;
    }

    // Get density at a point
    getDensity(x, y) {
        const i = Math.floor(x / this.gridSize);
        const j = Math.floor(y / this.gridSize);
        
        if (i < 0 || i >= this.nx + 2 || j < 0 || j >= this.ny + 2) {
            return this.density_value;
        }
        
        return this.density[i][j];
    }

    // Get temperature at a point
    getTemperature(x, y) {
        const i = Math.floor(x / this.gridSize);
        const j = Math.floor(y / this.gridSize);
        
        if (i < 0 || i >= this.nx + 2 || j < 0 || j >= this.ny + 2) {
            return 293;
        }
        
        return this.temperature[i][j];
    }
}
