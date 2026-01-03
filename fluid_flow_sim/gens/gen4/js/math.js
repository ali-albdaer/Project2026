/**
 * Mathematical utilities for fluid simulation
 */

class MathUtils {
    // Vector operations
    static dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    static cross2D(a, b) {
        return a.x * b.y - a.y * b.x;
    }

    static magnitude(v) {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    static normalize(v) {
        const mag = this.magnitude(v);
        if (mag === 0) return { x: 0, y: 0 };
        return { x: v.x / mag, y: v.y / mag };
    }

    static add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y };
    }

    static subtract(a, b) {
        return { x: a.x - b.x, y: a.y - b.y };
    }

    static scale(v, s) {
        return { x: v.x * s, y: v.y * s };
    }

    static distance(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Coordinate transformations
    static cartesianToPolar(x, y) {
        const r = Math.sqrt(x * x + y * y);
        const theta = Math.atan2(y, x);
        return { r, theta };
    }

    static polarToCartesian(r, theta) {
        return {
            x: r * Math.cos(theta),
            y: r * Math.sin(theta)
        };
    }

    // Interpolation
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }

    static bilinearInterpolation(x, y, x0, x1, y0, y1, f00, f01, f10, f11) {
        const wx = (x - x0) / (x1 - x0);
        const wy = (y - y0) / (y1 - y0);
        
        const f0 = f00 * (1 - wx) + f10 * wx;
        const f1 = f01 * (1 - wx) + f11 * wx;
        
        return f0 * (1 - wy) + f1 * wy;
    }

    // Numerical derivatives
    static centralDifference(field, x, y, dx, component) {
        try {
            const xp = x + dx;
            const xm = x - dx;
            const yp = y + dx;
            const ym = y - dx;

            let result = 0;
            if (component === 'x') {
                const velXp = field.getVelocity(xp, y);
                const velXm = field.getVelocity(xm, y);
                result = (velXp.x - velXm.x) / (2 * dx);
            } else if (component === 'y') {
                const velYp = field.getVelocity(x, yp);
                const velYm = field.getVelocity(x, ym);
                result = (velYp.y - velYm.y) / (2 * dx);
            } else if (component === 'dudx') {
                const velXp = field.getVelocity(xp, y);
                const velXm = field.getVelocity(xm, y);
                result = (velXp.x - velXm.x) / (2 * dx);
            } else if (component === 'dudy') {
                const velYp = field.getVelocity(x, yp);
                const velYm = field.getVelocity(x, ym);
                result = (velYp.x - velYm.x) / (2 * dx);
            } else if (component === 'dvdx') {
                const velXp = field.getVelocity(xp, y);
                const velXm = field.getVelocity(xm, y);
                result = (velXp.y - velXm.y) / (2 * dx);
            } else if (component === 'dvdy') {
                const velYp = field.getVelocity(x, yp);
                const velYm = field.getVelocity(x, ym);
                result = (velYp.y - velYm.y) / (2 * dx);
            }
            
            return this.isValidNumber(result) ? result : 0;
        } catch (error) {
            return 0;
        }
    }

    // Calculus operations for fluid mechanics
    static divergence(field, x, y, dx = 0.01) {
        try {
            const dudx = this.centralDifference(field, x, y, dx, 'dudx');
            const dvdy = this.centralDifference(field, x, y, dx, 'dvdy');
            const result = dudx + dvdy;
            return this.isValidNumber(result) ? result : 0;
        } catch (error) {
            return 0;
        }
    }

    static vorticity(field, x, y, dx = 0.01) {
        try {
            const dvdx = this.centralDifference(field, x, y, dx, 'dvdx');
            const dudy = this.centralDifference(field, x, y, dx, 'dudy');
            const result = dvdx - dudy;
            return this.isValidNumber(result) ? result : 0;
        } catch (error) {
            return 0;
        }
    }

    static laplacian(field, x, y, dx = 0.01, component = 'magnitude') {
        const dx2 = dx * dx;
        const vel = field.getVelocity(x, y);
        const velXP = field.getVelocity(x + dx, y);
        const velXM = field.getVelocity(x - dx, y);
        const velYP = field.getVelocity(x, y + dx);
        const velYM = field.getVelocity(x, y - dx);

        if (component === 'x') {
            return (velXP.x + velXM.x - 2 * vel.x) / dx2 + 
                   (velYP.x + velYM.x - 2 * vel.x) / dx2;
        } else if (component === 'y') {
            return (velXP.y + velXM.y - 2 * vel.y) / dx2 + 
                   (velYP.y + velYM.y - 2 * vel.y) / dx2;
        } else {
            const magXP = this.magnitude(velXP);
            const magXM = this.magnitude(velXM);
            const magYP = this.magnitude(velYP);
            const magYM = this.magnitude(velYM);
            const mag = this.magnitude(vel);
            
            return (magXP + magXM - 2 * mag) / dx2 + 
                   (magYP + magYM - 2 * mag) / dx2;
        }
    }

    // Streamline integration (Runge-Kutta 4th order)
    static integrateStreamline(field, startX, startY, dt = 0.01, maxSteps = 1000, forward = true) {
        const points = [{ x: startX, y: startY }];
        let x = startX;
        let y = startY;
        const direction = forward ? 1 : -1;

        for (let i = 0; i < maxSteps; i++) {
            // RK4 integration
            const vel1 = field.getVelocity(x, y);
            const k1x = direction * vel1.x * dt;
            const k1y = direction * vel1.y * dt;

            const vel2 = field.getVelocity(x + k1x / 2, y + k1y / 2);
            const k2x = direction * vel2.x * dt;
            const k2y = direction * vel2.y * dt;

            const vel3 = field.getVelocity(x + k2x / 2, y + k2y / 2);
            const k3x = direction * vel3.x * dt;
            const k3y = direction * vel3.y * dt;

            const vel4 = field.getVelocity(x + k3x, y + k3y);
            const k4x = direction * vel4.x * dt;
            const k4y = direction * vel4.y * dt;

            x += (k1x + 2 * k2x + 2 * k3x + k4x) / 6;
            y += (k1y + 2 * k2y + 2 * k3y + k4y) / 6;

            // Check bounds and velocity magnitude
            if (Math.abs(x) > 10 || Math.abs(y) > 10 || 
                (vel1.x * vel1.x + vel1.y * vel1.y) < 1e-6) {
                break;
            }

            points.push({ x, y });
        }

        return points;
    }

    // Complex number operations for potential flow
    static complexAdd(z1, z2) {
        return { real: z1.real + z2.real, imag: z1.imag + z2.imag };
    }

    static complexMultiply(z1, z2) {
        return {
            real: z1.real * z2.real - z1.imag * z2.imag,
            imag: z1.real * z2.imag + z1.imag * z2.real
        };
    }

    static complexDivide(z1, z2) {
        const denominator = z2.real * z2.real + z2.imag * z2.imag;
        return {
            real: (z1.real * z2.real + z1.imag * z2.imag) / denominator,
            imag: (z1.imag * z2.real - z1.real * z2.imag) / denominator
        };
    }

    static complexLog(z) {
        const r = Math.sqrt(z.real * z.real + z.imag * z.imag);
        const theta = Math.atan2(z.imag, z.real);
        return { real: Math.log(r), imag: theta };
    }

    // Special functions for fluid mechanics
    static besselJ0(x) {
        // Approximation of Bessel function J0 for small arguments
        if (Math.abs(x) < 0.1) {
            const x2 = x * x;
            return 1 - x2 / 4 + x2 * x2 / 64;
        }
        // Use asymptotic approximation for large arguments
        return Math.sqrt(2 / (Math.PI * x)) * Math.cos(x - Math.PI / 4);
    }

    // Grid generation utilities
    static generateUniformGrid(xMin, xMax, yMin, yMax, nx, ny) {
        const grid = [];
        const dx = (xMax - xMin) / (nx - 1);
        const dy = (yMax - yMin) / (ny - 1);

        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                grid.push({
                    x: xMin + i * dx,
                    y: yMin + j * dy,
                    i,
                    j
                });
            }
        }
        return { grid, dx, dy, nx, ny };
    }

    // Smoothing functions
    static smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }

    static gaussianKernel(x, sigma = 1.0) {
        return Math.exp(-(x * x) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI));
    }

    // Boundary condition utilities
    static reflectVelocity(velocity, normal) {
        const dotProduct = this.dot(velocity, normal);
        return this.subtract(velocity, this.scale(normal, 2 * dotProduct));
    }

    static noSlipBoundary(velocity) {
        return { x: 0, y: 0 };
    }

    // Flow analysis utilities
    static criticalPoints(field, xMin, xMax, yMin, yMax, resolution = 50) {
        const criticalPoints = [];
        const dx = (xMax - xMin) / resolution;
        const dy = (yMax - yMin) / resolution;

        for (let i = 1; i < resolution - 1; i++) {
            for (let j = 1; j < resolution - 1; j++) {
                const x = xMin + i * dx;
                const y = yMin + j * dy;
                
                const vel = field.getVelocity(x, y);
                const magnitude = this.magnitude(vel);
                
                // Check if this is near a stagnation point
                if (magnitude < 0.01) {
                    // Classify the type of critical point
                    const dudx = this.centralDifference(field, x, y, dx * 0.1, 'dudx');
                    const dudy = this.centralDifference(field, x, y, dx * 0.1, 'dudy');
                    const dvdx = this.centralDifference(field, x, y, dx * 0.1, 'dvdx');
                    const dvdy = this.centralDifference(field, x, y, dx * 0.1, 'dvdy');
                    
                    const trace = dudx + dvdy;
                    const det = dudx * dvdy - dudy * dvdx;
                    
                    let type = 'unknown';
                    if (det > 0) {
                        if (trace < 0) type = 'sink';
                        else if (trace > 0) type = 'source';
                        else type = 'center';
                    } else if (det < 0) {
                        type = 'saddle';
                    }
                    
                    criticalPoints.push({ x, y, type, magnitude });
                }
            }
        }
        
        return criticalPoints;
    }

    // Error handling for numerical operations
    static isValidNumber(x) {
        return typeof x === 'number' && isFinite(x) && !isNaN(x);
    }

    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static safeDiv(a, b, defaultValue = 0) {
        return Math.abs(b) > 1e-12 ? a / b : defaultValue;
    }
}

// Export for use in other modules
window.MathUtils = MathUtils;