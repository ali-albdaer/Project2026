/**
 * Potential Flow Engine
 * Handles superposition of flow elements and field computations
 */

class PotentialFlow {
    constructor() {
        this.elements = [];
        this.domain = {
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5
        };
        this.resolution = 100;
        
        // Cached field data
        this.psiField = null;
        this.phiField = null;
        this.velocityField = null;
        this.needsUpdate = true;
        
        // Field ranges for normalization
        this.psiRange = { min: 0, max: 1 };
        this.phiRange = { min: 0, max: 1 };
        this.velRange = { min: 0, max: 1 };
    }

    /**
     * Add a flow element
     */
    addElement(element) {
        this.elements.push(element);
        this.needsUpdate = true;
        return element;
    }

    /**
     * Remove a flow element by id
     */
    removeElement(id) {
        const index = this.elements.findIndex(e => e.id === id);
        if (index !== -1) {
            this.elements.splice(index, 1);
            this.needsUpdate = true;
            return true;
        }
        return false;
    }

    /**
     * Get element by id
     */
    getElement(id) {
        return this.elements.find(e => e.id === id);
    }

    /**
     * Clear all elements
     */
    clearElements() {
        this.elements = [];
        this.needsUpdate = true;
    }

    /**
     * Set domain bounds
     */
    setDomain(xMin, xMax, yMin, yMax) {
        this.domain = { xMin, xMax, yMin, yMax };
        this.needsUpdate = true;
    }

    /**
     * Compute stream function at a point (superposition)
     */
    psi(x, y) {
        let psi = 0;
        for (const element of this.elements) {
            if (element.enabled) {
                psi += element.psi(x, y);
            }
        }
        return psi;
    }

    /**
     * Compute velocity potential at a point (superposition)
     */
    phi(x, y) {
        let phi = 0;
        for (const element of this.elements) {
            if (element.enabled) {
                phi += element.phi(x, y);
            }
        }
        return phi;
    }

    /**
     * Compute velocity at a point (superposition)
     */
    velocity(x, y) {
        let u = 0, v = 0;
        for (const element of this.elements) {
            if (element.enabled) {
                const vel = element.velocity(x, y);
                u += vel.u;
                v += vel.v;
            }
        }
        return { u, v };
    }

    /**
     * Compute velocity magnitude
     */
    velocityMagnitude(x, y) {
        const vel = this.velocity(x, y);
        return Math.sqrt(vel.u * vel.u + vel.v * vel.v);
    }

    /**
     * Compute pressure coefficient (Cp = 1 - (V/V∞)²)
     */
    pressureCoefficient(x, y, Vinf = 1) {
        const vmag = this.velocityMagnitude(x, y);
        return 1 - (vmag / Vinf) ** 2;
    }

    /**
     * Compute vorticity (curl of velocity)
     */
    vorticity(x, y, h = 0.01) {
        const v1 = this.velocity(x + h, y);
        const v2 = this.velocity(x - h, y);
        const v3 = this.velocity(x, y + h);
        const v4 = this.velocity(x, y - h);
        
        const dvdx = (v1.v - v2.v) / (2 * h);
        const dudy = (v3.u - v4.u) / (2 * h);
        
        return dvdx - dudy;
    }

    /**
     * Update field caches
     */
    updateFields() {
        if (!this.needsUpdate) return;
        
        const nx = this.resolution;
        const ny = this.resolution;
        const dx = (this.domain.xMax - this.domain.xMin) / (nx - 1);
        const dy = (this.domain.yMax - this.domain.yMin) / (ny - 1);
        
        this.psiField = new Float32Array(nx * ny);
        this.phiField = new Float32Array(nx * ny);
        this.velocityField = new Float32Array(nx * ny * 2);
        
        let psiMin = Infinity, psiMax = -Infinity;
        let phiMin = Infinity, phiMax = -Infinity;
        let velMin = Infinity, velMax = -Infinity;
        
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const x = this.domain.xMin + i * dx;
                const y = this.domain.yMin + j * dy;
                const idx = j * nx + i;
                
                const psi = this.psi(x, y);
                const phi = this.phi(x, y);
                const vel = this.velocity(x, y);
                const vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
                
                this.psiField[idx] = psi;
                this.phiField[idx] = phi;
                this.velocityField[idx * 2] = vel.u;
                this.velocityField[idx * 2 + 1] = vel.v;
                
                // Clamp extreme values for better visualization
                const clampedPsi = MathUtils.clamp(psi, -100, 100);
                const clampedPhi = MathUtils.clamp(phi, -100, 100);
                const clampedVel = MathUtils.clamp(vmag, 0, 50);
                
                if (isFinite(clampedPsi)) {
                    psiMin = Math.min(psiMin, clampedPsi);
                    psiMax = Math.max(psiMax, clampedPsi);
                }
                if (isFinite(clampedPhi)) {
                    phiMin = Math.min(phiMin, clampedPhi);
                    phiMax = Math.max(phiMax, clampedPhi);
                }
                if (isFinite(clampedVel)) {
                    velMin = Math.min(velMin, clampedVel);
                    velMax = Math.max(velMax, clampedVel);
                }
            }
        }
        
        this.psiRange = { min: psiMin, max: psiMax };
        this.phiRange = { min: phiMin, max: phiMax };
        this.velRange = { min: velMin, max: velMax };
        
        this.needsUpdate = false;
    }

    /**
     * Get streamline contours using marching squares
     */
    getStreamlines(numLines = 30) {
        this.updateFields();
        
        const levels = MathUtils.generateContourLevels(
            this.psiRange.min, 
            this.psiRange.max, 
            numLines
        );
        
        const allSegments = [];
        
        for (const level of levels) {
            const segments = MathUtils.marchingSquares(
                (x, y) => this.psi(x, y),
                level,
                this.domain.xMin,
                this.domain.xMax,
                this.domain.yMin,
                this.domain.yMax,
                this.resolution
            );
            allSegments.push(...segments);
        }
        
        return allSegments;
    }

    /**
     * Get potential line contours
     */
    getPotentialLines(numLines = 30) {
        this.updateFields();
        
        const levels = MathUtils.generateContourLevels(
            this.phiRange.min,
            this.phiRange.max,
            numLines
        );
        
        const allSegments = [];
        
        for (const level of levels) {
            const segments = MathUtils.marchingSquares(
                (x, y) => this.phi(x, y),
                level,
                this.domain.xMin,
                this.domain.xMax,
                this.domain.yMin,
                this.domain.yMax,
                this.resolution
            );
            allSegments.push(...segments);
        }
        
        return allSegments;
    }

    /**
     * Trace a streamline from a starting point using RK4
     */
    traceStreamline(startX, startY, direction = 1, maxSteps = 500, dt = 0.02) {
        const points = [{ x: startX, y: startY }];
        let x = startX;
        let y = startY;
        
        for (let i = 0; i < maxSteps; i++) {
            const vel = this.velocity(x, y);
            const vmag = Math.sqrt(vel.u * vel.u + vel.v * vel.v);
            
            if (vmag < MathUtils.EPSILON) break;
            
            // Normalize and scale by direction
            const step = dt / vmag;
            const result = MathUtils.rk4Step(x, y, (px, py) => this.velocity(px, py), direction * step);
            
            x = result.x;
            y = result.y;
            
            // Check bounds
            if (x < this.domain.xMin || x > this.domain.xMax ||
                y < this.domain.yMin || y > this.domain.yMax) {
                break;
            }
            
            points.push({ x, y });
        }
        
        return points;
    }

    /**
     * Generate field data for gradient visualization
     */
    getFieldData(quantity) {
        this.updateFields();
        
        const nx = this.resolution;
        const ny = this.resolution;
        const data = new Float32Array(nx * ny);
        let range = { min: 0, max: 1 };
        
        switch (quantity) {
            case 'velocity':
                for (let i = 0; i < nx * ny; i++) {
                    const u = this.velocityField[i * 2];
                    const v = this.velocityField[i * 2 + 1];
                    data[i] = Math.sqrt(u * u + v * v);
                }
                range = this.velRange;
                break;
                
            case 'stream':
                data.set(this.psiField);
                range = this.psiRange;
                break;
                
            case 'potential':
                data.set(this.phiField);
                range = this.phiRange;
                break;
                
            case 'pressure':
                const Vinf = this.getVinfinity();
                for (let j = 0; j < ny; j++) {
                    for (let i = 0; i < nx; i++) {
                        const dx = (this.domain.xMax - this.domain.xMin) / (nx - 1);
                        const dy = (this.domain.yMax - this.domain.yMin) / (ny - 1);
                        const x = this.domain.xMin + i * dx;
                        const y = this.domain.yMin + j * dy;
                        data[j * nx + i] = this.pressureCoefficient(x, y, Vinf);
                    }
                }
                // Find range
                let pMin = Infinity, pMax = -Infinity;
                for (let i = 0; i < data.length; i++) {
                    if (isFinite(data[i])) {
                        pMin = Math.min(pMin, data[i]);
                        pMax = Math.max(pMax, data[i]);
                    }
                }
                range = { min: Math.max(pMin, -5), max: Math.min(pMax, 2) };
                break;
                
            case 'vorticity':
                for (let j = 0; j < ny; j++) {
                    for (let i = 0; i < nx; i++) {
                        const dx = (this.domain.xMax - this.domain.xMin) / (nx - 1);
                        const dy = (this.domain.yMax - this.domain.yMin) / (ny - 1);
                        const x = this.domain.xMin + i * dx;
                        const y = this.domain.yMin + j * dy;
                        data[j * nx + i] = this.vorticity(x, y);
                    }
                }
                // Find range
                let vortMin = Infinity, vortMax = -Infinity;
                for (let i = 0; i < data.length; i++) {
                    if (isFinite(data[i])) {
                        vortMin = Math.min(vortMin, data[i]);
                        vortMax = Math.max(vortMax, data[i]);
                    }
                }
                range = { min: vortMin, max: vortMax };
                break;
        }
        
        return { data, range, nx, ny };
    }

    /**
     * Get free stream velocity (from uniform flow elements)
     */
    getVinfinity() {
        let Vinf = 1;
        for (const element of this.elements) {
            if (element instanceof UniformFlow && element.enabled) {
                Vinf = Math.max(Vinf, Math.abs(element.U));
            }
        }
        return Vinf;
    }

    /**
     * Invalidate cache (call when elements change)
     */
    invalidate() {
        this.needsUpdate = true;
    }

    /**
     * Export configuration as JSON
     */
    toJSON() {
        return {
            domain: this.domain,
            elements: this.elements.map(e => ({
                type: e.type,
                params: e.getParams()
            }))
        };
    }

    /**
     * Import configuration from JSON
     */
    fromJSON(config) {
        this.domain = config.domain || this.domain;
        this.clearElements();
        
        for (const elem of config.elements) {
            const params = {};
            for (const [key, val] of Object.entries(elem.params)) {
                params[key] = val.value;
            }
            const element = FlowElementFactory.create(elem.type, params);
            if (element) {
                this.addElement(element);
            }
        }
        
        this.needsUpdate = true;
    }
}

// Export
window.PotentialFlow = PotentialFlow;
