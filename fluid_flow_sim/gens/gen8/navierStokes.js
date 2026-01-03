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
        
        // Geometry objects
        this.geometries = [];
        
        // Flow configuration
        this.flowType = 'uniform';
        this.time = 0;
        this.heatSources = [];
        
        // Simulation parameters
        this.viscosity = 0.001;
        this.density_value = 1.0;
        this.dt = 0.1;
        this.iterations = 20;
        this.inletVelocity = 5.0;
        
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

    // Add geometry
    addGeometry(type, params) {
        const geometry = {
            type,
            params: { ...params },
            id: Date.now()
        };
        this.geometries.push(geometry);
        this.updateObstacles();
        return geometry.id;
    }

    // Remove geometry
    removeGeometry(id) {
        this.geometries = this.geometries.filter(g => g.id !== id);
        this.updateObstacles();
    }

    // Move geometry
    moveGeometry(id, newX, newY) {
        const geom = this.geometries.find(g => g.id === id);
        if (geom) {
            geom.params.x = newX;
            geom.params.y = newY;
            this.updateObstacles();
        }
    }

    // Get geometry at point
    getGeometryAtPoint(x, y) {
        for (let i = this.geometries.length - 1; i >= 0; i--) {
            const geom = this.geometries[i];
            if (this.isPointInGeometry(x, y, geom)) {
                return geom;
            }
        }
        return null;
    }

    // Check if point is in geometry
    isPointInGeometry(x, y, geom) {
        const { type, params } = geom;
        const dx = x - params.x;
        const dy = y - params.y;

        switch (type) {
            case 'circle':
                return dx * dx + dy * dy <= params.radius * params.radius;
            
            case 'rectangle':
                return Math.abs(dx) <= params.width / 2 && 
                       Math.abs(dy) <= params.height / 2;
            
            case 'ellipse':
                return (dx * dx) / (params.a * params.a) + 
                       (dy * dy) / (params.b * params.b) <= 1;
            
            case 'airfoil':
                return this.isPointInAirfoil(dx, dy, params);
            
            default:
                return false;
        }
    }

    // NACA 4-digit airfoil
    isPointInAirfoil(dx, dy, params) {
        const chord = params.chord || 100;
        const x = dx / chord + 0.5; // Normalize to 0-1
        const y = dy / chord;
        
        if (x < 0 || x > 1) return false;
        
        // NACA 0012 profile thickness
        const t = 0.12;
        const yt = 5 * t * chord * (0.2969 * Math.sqrt(x) - 0.1260 * x - 
                   0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
        
        return Math.abs(y * chord) <= yt;
    }

    // Update obstacle mask based on geometries
    updateObstacles() {
        // Clear obstacle mask
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                this.obstacle[i][j] = 0;
            }
        }

        // Add all geometries to obstacle mask
        for (const geom of this.geometries) {
            this.addGeometryToObstacles(geom);
        }
    }

    // Add a single geometry to obstacle mask
    addGeometryToObstacles(geom) {
        const { type, params } = geom;
        const gridX = params.x / this.gridSize;
        const gridY = params.y / this.gridSize;

        switch (type) {
            case 'circle':
                this.addCircleObstacle(gridX, gridY, params.radius / this.gridSize);
                break;
            
            case 'rectangle':
                this.addRectangleObstacle(gridX, gridY, 
                    params.width / this.gridSize, params.height / this.gridSize);
                break;
            
            case 'ellipse':
                this.addEllipseObstacle(gridX, gridY, 
                    params.a / this.gridSize, params.b / this.gridSize);
                break;
            
            case 'airfoil':
                this.addAirfoilObstacle(gridX, gridY, params.chord / this.gridSize);
                break;
        }
    }

    addCircleObstacle(cx, cy, radius) {
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                const dx = i - cx;
                const dy = j - cy;
                if (dx * dx + dy * dy < radius * radius) {
                    this.obstacle[i][j] = 1;
                }
            }
        }
    }

    addRectangleObstacle(cx, cy, width, height) {
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                const dx = Math.abs(i - cx);
                const dy = Math.abs(j - cy);
                if (dx <= width / 2 && dy <= height / 2) {
                    this.obstacle[i][j] = 1;
                }
            }
        }
    }

    addEllipseObstacle(cx, cy, a, b) {
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                const dx = i - cx;
                const dy = j - cy;
                if ((dx * dx) / (a * a) + (dy * dy) / (b * b) < 1) {
                    this.obstacle[i][j] = 1;
                }
            }
        }
    }

    addAirfoilObstacle(cx, cy, chord) {
        for (let i = 0; i < this.nx + 2; i++) {
            for (let j = 0; j < this.ny + 2; j++) {
                const dx = (i - cx) / chord;
                const dy = (j - cy) / chord;
                const x = dx + 0.5;
                const y = dy;
                
                if (x >= 0 && x <= 1) {
                    const t = 0.12;
                    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 
                               0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
                    
                    if (Math.abs(y) <= yt) {
                        this.obstacle[i][j] = 1;
                    }
                }
            }
        }
    }

    // Reset simulation
    reset() {
        // Recreate all arrays with current dimensions
        this.u = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v = this.create2DArray(this.nx + 2, this.ny + 1);
        this.u_prev = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v_prev = this.create2DArray(this.nx + 2, this.ny + 1);
        this.p = this.create2DArray(this.nx + 2, this.ny + 2);
        this.density = this.create2DArray(this.nx + 2, this.ny + 2);
        this.temperature = this.create2DArray(this.nx + 2, this.ny + 2);
        this.obstacle = this.create2DArray(this.nx + 2, this.ny + 2);
        
        this.initializeFields();
        this.time = 0;
    }

    // Update grid resolution
    updateGridSize(newGridSize) {
        this.gridSize = newGridSize;
        this.nx = Math.floor(this.width / newGridSize);
        this.ny = Math.floor(this.height / newGridSize);
        
        // Recreate all arrays with new dimensions
        this.u = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v = this.create2DArray(this.nx + 2, this.ny + 1);
        this.u_prev = this.create2DArray(this.nx + 1, this.ny + 2);
        this.v_prev = this.create2DArray(this.nx + 2, this.ny + 1);
        this.p = this.create2DArray(this.nx + 2, this.ny + 2);
        this.density = this.create2DArray(this.nx + 2, this.ny + 2);
        this.temperature = this.create2DArray(this.nx + 2, this.ny + 2);
        this.obstacle = this.create2DArray(this.nx + 2, this.ny + 2);
        
        this.initializeFields();
        this.updateObstacles();
        this.time = 0;
    }

    // Add heat source
    addHeatSource(x, y, intensity, radius) {
        this.heatSources.push({ x, y, intensity, radius });
    }

    // Clear heat sources
    clearHeatSources() {
        this.heatSources = [];
    }

    // Apply heat sources to temperature field
    applyHeatSources() {
        for (const source of this.heatSources) {
            const gridX = Math.floor(source.x / this.gridSize);
            const gridY = Math.floor(source.y / this.gridSize);
            const gridRadius = source.radius / this.gridSize;
            
            for (let i = 0; i < this.nx + 2; i++) {
                for (let j = 0; j < this.ny + 2; j++) {
                    const dx = i - gridX;
                    const dy = j - gridY;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < gridRadius) {
                        const factor = Math.exp(-dist * dist / (gridRadius * gridRadius));
                        this.temperature[i][j] += source.intensity * factor * this.dt;
                    }
                }
            }
        }
    }

    // Apply buoyancy force (thermal convection)
    applyBuoyancy() {
        const g = 9.81; // Gravity
        const beta = 0.003; // Thermal expansion coefficient
        const T_ref = 293; // Reference temperature
        
        for (let i = 1; i < this.nx + 1; i++) {
            for (let j = 1; j < this.ny; j++) {
                if (!this.obstacle[i][j] && !this.obstacle[i][j + 1]) {
                    const T_avg = (this.temperature[i][j] + this.temperature[i][j + 1]) / 2;
                    const buoyancy = -g * beta * (T_avg - T_ref) * this.dt;
                    this.v[i][j] += buoyancy;
                }
            }
        }
    }

    // Apply boundary conditions
    applyBoundaryConditions(inletVelocity) {
        this.time += this.dt;
        
        // Left boundary - inlet (different flow types)
        for (let j = 1; j < this.ny + 1; j++) {
            const yPos = (j - this.ny / 2) / this.ny;
            
            switch (this.flowType) {
                case 'uniform':
                    this.u[0][j] = inletVelocity;
                    this.v[0][j] = 0;
                    break;
                
                case 'jet':
                    // Gaussian jet profile
                    const jetWidth = 0.2;
                    this.u[0][j] = inletVelocity * Math.exp(-yPos * yPos / (jetWidth * jetWidth));
                    this.v[0][j] = 0;
                    break;
                
                case 'vortexStreet':
                    // Alternating vortices
                    const vortexFreq = 2.0;
                    this.u[0][j] = inletVelocity * (1 + 0.2 * Math.sin(this.time * vortexFreq));
                    this.v[0][j] = inletVelocity * 0.3 * Math.cos(this.time * vortexFreq) * Math.exp(-yPos * yPos / 0.1);
                    break;
                
                case 'pulsating':
                    // Pulsating flow
                    const pulsateFreq = 3.0;
                    this.u[0][j] = inletVelocity * (1 + 0.5 * Math.sin(this.time * pulsateFreq));
                    this.v[0][j] = 0;
                    break;
                
                case 'thermal':
                    // Thermal convection setup
                    this.u[0][j] = inletVelocity * 0.1;
                    this.v[0][j] = 0;
                    break;
            }
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
        
        // No-slip boundary conditions on obstacles
        this.applyObstacleBoundaryConditions();
    }

    // Apply no-slip conditions on obstacles
    applyObstacleBoundaryConditions() {
        for (let i = 1; i < this.nx; i++) {
            for (let j = 1; j < this.ny + 1; j++) {
                // Set velocity to zero at obstacle boundaries
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
        this.inletVelocity = inletVelocity;
        
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
        
        // Temperature advection and diffusion
        const temp_prev = this.temperature.map(row => [...row]);
        this.advect(this.temperature, temp_prev, this.u, this.v);
        this.diffuse(this.temperature, temp_prev, this.viscosity * 0.1); // Thermal diffusivity
        
        // Apply heat sources
        if (this.heatSources.length > 0) {
            this.applyHeatSources();
        }
        
        // Apply buoyancy for thermal flow
        if (this.flowType === 'thermal') {
            this.applyBuoyancy();
        }
        
        // Project again
        this.project();
        
        // Apply obstacle boundary conditions (no-slip)
        this.applyObstacleBoundaryConditions();
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
