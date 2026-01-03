/**
 * Math Utilities for Fluid Flow Simulation
 * Contains core mathematical functions and helpers
 */

const MathUtils = {
    // Constants
    PI: Math.PI,
    TWO_PI: 2 * Math.PI,
    HALF_PI: Math.PI / 2,
    EPSILON: 1e-10,

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Map value from one range to another
     */
    map(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    },

    /**
     * Normalize value to [0, 1] range
     */
    normalize(value, min, max) {
        if (max - min < this.EPSILON) return 0.5;
        return this.clamp((value - min) / (max - min), 0, 1);
    },

    /**
     * Distance between two points
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Squared distance (faster, no sqrt)
     */
    distanceSquared(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return dx * dx + dy * dy;
    },

    /**
     * Angle from point 1 to point 2
     */
    angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    },

    /**
     * Safe atan2 with singularity handling
     */
    safeAtan2(y, x) {
        if (Math.abs(x) < this.EPSILON && Math.abs(y) < this.EPSILON) {
            return 0;
        }
        return Math.atan2(y, x);
    },

    /**
     * Safe log (natural) with singularity handling
     */
    safeLog(value) {
        if (value < this.EPSILON) return -20; // Cap at very negative value
        return Math.log(value);
    },

    /**
     * Compute gradient using central differences
     */
    gradient(field, x, y, h = 0.01) {
        const dfdx = (field(x + h, y) - field(x - h, y)) / (2 * h);
        const dfdy = (field(x, y + h) - field(x, y - h)) / (2 * h);
        return { x: dfdx, y: dfdy };
    },

    /**
     * Compute curl (2D - returns scalar vorticity)
     */
    curl(vx, vy, x, y, h = 0.01) {
        const dvydx = (vy(x + h, y) - vy(x - h, y)) / (2 * h);
        const dvxdy = (vx(x, y + h) - vx(x, y - h)) / (2 * h);
        return dvydx - dvxdy;
    },

    /**
     * Compute divergence
     */
    divergence(vx, vy, x, y, h = 0.01) {
        const dvxdx = (vx(x + h, y) - vx(x - h, y)) / (2 * h);
        const dvydy = (vy(x, y + h) - vy(x, y - h)) / (2 * h);
        return dvxdx + dvydy;
    },

    /**
     * Bilinear interpolation on a 2D grid
     */
    bilinearInterpolate(grid, x, y, nx, ny) {
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, nx - 1);
        const y1 = Math.min(y0 + 1, ny - 1);
        
        const tx = x - x0;
        const ty = y - y0;
        
        const c00 = grid[y0 * nx + x0] || 0;
        const c10 = grid[y0 * nx + x1] || 0;
        const c01 = grid[y1 * nx + x0] || 0;
        const c11 = grid[y1 * nx + x1] || 0;
        
        const c0 = this.lerp(c00, c10, tx);
        const c1 = this.lerp(c01, c11, tx);
        
        return this.lerp(c0, c1, ty);
    },

    /**
     * RK4 integration step for particle advection
     */
    rk4Step(x, y, velocityField, dt) {
        const k1 = velocityField(x, y);
        const k2 = velocityField(x + 0.5 * dt * k1.u, y + 0.5 * dt * k1.v);
        const k3 = velocityField(x + 0.5 * dt * k2.u, y + 0.5 * dt * k2.v);
        const k4 = velocityField(x + dt * k3.u, y + dt * k3.v);
        
        return {
            x: x + (dt / 6) * (k1.u + 2 * k2.u + 2 * k3.u + k4.u),
            y: y + (dt / 6) * (k1.v + 2 * k2.v + 2 * k3.v + k4.v)
        };
    },

    /**
     * Generate contour levels
     */
    generateContourLevels(min, max, numLevels) {
        const levels = [];
        const step = (max - min) / (numLevels + 1);
        for (let i = 1; i <= numLevels; i++) {
            levels.push(min + i * step);
        }
        return levels;
    },

    /**
     * Marching squares for contour extraction
     * Returns line segments for a given contour level
     */
    marchingSquares(field, level, xMin, xMax, yMin, yMax, resolution) {
        const segments = [];
        const dx = (xMax - xMin) / resolution;
        const dy = (yMax - yMin) / resolution;
        
        for (let i = 0; i < resolution; i++) {
            for (let j = 0; j < resolution; j++) {
                const x = xMin + i * dx;
                const y = yMin + j * dy;
                
                // Get corner values
                const v00 = field(x, y);
                const v10 = field(x + dx, y);
                const v01 = field(x, y + dy);
                const v11 = field(x + dx, y + dy);
                
                // Calculate case index
                let caseIndex = 0;
                if (v00 > level) caseIndex |= 1;
                if (v10 > level) caseIndex |= 2;
                if (v11 > level) caseIndex |= 4;
                if (v01 > level) caseIndex |= 8;
                
                // Skip empty or full cells
                if (caseIndex === 0 || caseIndex === 15) continue;
                
                // Interpolate edge crossings
                const edges = this.getMarchingSquaresEdges(caseIndex, x, y, dx, dy, v00, v10, v01, v11, level);
                segments.push(...edges);
            }
        }
        
        return segments;
    },

    /**
     * Helper for marching squares - get edge segments
     */
    getMarchingSquaresEdges(caseIndex, x, y, dx, dy, v00, v10, v01, v11, level) {
        const segments = [];
        
        // Linear interpolation on edges
        const interpX = (v1, v2, y0) => {
            const t = (level - v1) / (v2 - v1 + this.EPSILON);
            return { x: x + t * dx, y: y0 };
        };
        
        const interpY = (v1, v2, x0) => {
            const t = (level - v1) / (v2 - v1 + this.EPSILON);
            return { x: x0, y: y + t * dy };
        };
        
        // Edge midpoints (for simplicity, using midpoints instead of exact interpolation for some cases)
        const bottom = interpX(v00, v10, y);
        const top = interpX(v01, v11, y + dy);
        const left = interpY(v00, v01, x);
        const right = interpY(v10, v11, x + dx);
        
        // Lookup table for marching squares
        const cases = {
            1: [[left, bottom]],
            2: [[bottom, right]],
            3: [[left, right]],
            4: [[right, top]],
            5: [[left, top], [right, bottom]],
            6: [[bottom, top]],
            7: [[left, top]],
            8: [[top, left]],
            9: [[top, bottom]],
            10: [[left, bottom], [right, top]],
            11: [[right, top]],
            12: [[left, right]],
            13: [[bottom, right]],
            14: [[left, bottom]]
        };
        
        const caseEdges = cases[caseIndex];
        if (caseEdges) {
            for (const [p1, p2] of caseEdges) {
                segments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
            }
        }
        
        return segments;
    },

    /**
     * Smooth a value using exponential moving average
     */
    smoothValue(current, target, smoothing = 0.1) {
        return current + (target - current) * smoothing;
    },

    /**
     * Create rotation matrix for 2D
     */
    rotationMatrix(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            a: cos, b: -sin,
            c: sin, d: cos
        };
    },

    /**
     * Apply rotation matrix to point
     */
    rotatePoint(x, y, matrix) {
        return {
            x: matrix.a * x + matrix.b * y,
            y: matrix.c * x + matrix.d * y
        };
    },

    /**
     * Generate pseudo-random number with seed
     */
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    },

    /**
     * Gaussian/Normal distribution random
     */
    gaussianRandom(mean = 0, stdDev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(this.TWO_PI * u2);
        return z0 * stdDev + mean;
    }
};

// Export for use in other modules
window.MathUtils = MathUtils;
