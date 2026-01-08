/**
 * Mathematical Utilities
 * Vector operations, interpolation, and numerical methods
 */

// 2D Vector class
export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    static fromAngle(angle, magnitude = 1) {
        return new Vec2(
            Math.cos(angle) * magnitude,
            Math.sin(angle) * magnitude
        );
    }
    
    clone() {
        return new Vec2(this.x, this.y);
    }
    
    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }
    
    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }
    
    mul(s) {
        return new Vec2(this.x * s, this.y * s);
    }
    
    div(s) {
        if (s === 0) return new Vec2(0, 0);
        return new Vec2(this.x / s, this.y / s);
    }
    
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }
    
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    
    lengthSq() {
        return this.x * this.x + this.y * this.y;
    }
    
    normalize() {
        const len = this.length();
        if (len === 0) return new Vec2(0, 0);
        return this.div(len);
    }
    
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vec2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }
    
    angle() {
        return Math.atan2(this.y, this.x);
    }
    
    perpendicular() {
        return new Vec2(-this.y, this.x);
    }
    
    distanceTo(v) {
        return this.sub(v).length();
    }
    
    lerp(v, t) {
        return new Vec2(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t
        );
    }
    
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    
    equals(v, epsilon = 1e-10) {
        return Math.abs(this.x - v.x) < epsilon && Math.abs(this.y - v.y) < epsilon;
    }
}

// Clamp value between min and max
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Linear interpolation
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Smooth interpolation (smoothstep)
export function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

// Map value from one range to another
export function mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + (value - inMin) * (outMax - outMin) / (inMax - inMin);
}

// Degrees to radians
export function toRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Radians to degrees
export function toDegrees(radians) {
    return radians * 180 / Math.PI;
}

// Random number in range
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

// Random point in circle
export function randomInCircle(radius) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    return new Vec2(Math.cos(angle) * r, Math.sin(angle) * r);
}

// Random point on circle
export function randomOnCircle(radius) {
    const angle = Math.random() * Math.PI * 2;
    return new Vec2(Math.cos(angle) * radius, Math.sin(angle) * radius);
}

// Numerical gradient (central difference)
export function numericalGradient(func, x, y, h = 0.001) {
    const dfdx = (func(x + h, y) - func(x - h, y)) / (2 * h);
    const dfdy = (func(x, y + h) - func(x, y - h)) / (2 * h);
    return new Vec2(dfdx, dfdy);
}

// Numerical Laplacian
export function numericalLaplacian(func, x, y, h = 0.001) {
    const d2fdx2 = (func(x + h, y) - 2 * func(x, y) + func(x - h, y)) / (h * h);
    const d2fdy2 = (func(x, y + h) - 2 * func(x, y) + func(x, y - h)) / (h * h);
    return d2fdx2 + d2fdy2;
}

// Numerical curl (for 2D, returns scalar vorticity)
export function numericalCurl(velFunc, x, y, h = 0.001) {
    // ∂v/∂x - ∂u/∂y
    const v_right = velFunc(x + h, y).y;
    const v_left = velFunc(x - h, y).y;
    const u_up = velFunc(x, y + h).x;
    const u_down = velFunc(x, y - h).x;
    
    return (v_right - v_left) / (2 * h) - (u_up - u_down) / (2 * h);
}

// Runge-Kutta 4th order integration for streamlines
export function rk4Step(position, velocityFunc, dt) {
    const k1 = velocityFunc(position.x, position.y);
    const p2 = position.add(k1.mul(dt / 2));
    const k2 = velocityFunc(p2.x, p2.y);
    const p3 = position.add(k2.mul(dt / 2));
    const k3 = velocityFunc(p3.x, p3.y);
    const p4 = position.add(k3.mul(dt));
    const k4 = velocityFunc(p4.x, p4.y);
    
    return position.add(k1.add(k2.mul(2)).add(k3.mul(2)).add(k4).mul(dt / 6));
}

// Euler integration (simpler, faster)
export function eulerStep(position, velocityFunc, dt) {
    const velocity = velocityFunc(position.x, position.y);
    return position.add(velocity.mul(dt));
}

// Sign function
export function sign(x) {
    return x > 0 ? 1 : x < 0 ? -1 : 0;
}

// Modulo that works correctly for negative numbers
export function mod(n, m) {
    return ((n % m) + m) % m;
}

// Distance from point to line segment
export function distanceToLineSegment(point, lineStart, lineEnd) {
    const line = lineEnd.sub(lineStart);
    const len = line.length();
    if (len === 0) return point.distanceTo(lineStart);
    
    const t = clamp(point.sub(lineStart).dot(line) / (len * len), 0, 1);
    const projection = lineStart.add(line.mul(t));
    return point.distanceTo(projection);
}

// Check if point is in rectangle
export function pointInRect(point, x, y, width, height) {
    return point.x >= x && point.x <= x + width &&
           point.y >= y && point.y <= y + height;
}

// Format number for display
export function formatNumber(num, decimals = 2) {
    if (Math.abs(num) < 0.001 && num !== 0) {
        return num.toExponential(decimals);
    }
    return num.toFixed(decimals);
}

// Bilinear interpolation
export function bilinearInterpolate(x, y, q11, q12, q21, q22) {
    const r1 = lerp(q11, q21, x);
    const r2 = lerp(q12, q22, x);
    return lerp(r1, r2, y);
}
