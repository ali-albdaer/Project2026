/**
 * Math Utilities Module
 * Core mathematical functions for fluid dynamics calculations
 */

export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    static fromPolar(r, theta) {
        return new Vector2(r * Math.cos(theta), r * Math.sin(theta));
    }

    clone() {
        return new Vector2(this.x, this.y);
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

    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }

    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }

    scale(s) {
        this.x *= s;
        this.y *= s;
        return this;
    }

    multiply(v) {
        this.x *= v.x;
        this.y *= v.y;
        return this;
    }

    divide(s) {
        if (s !== 0) {
            this.x /= s;
            this.y /= s;
        }
        return this;
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

    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const len = this.length();
        if (len > 0) {
            this.x /= len;
            this.y /= len;
        }
        return this;
    }

    normalized() {
        return this.clone().normalize();
    }

    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos - this.y * sin;
        const y = this.x * sin + this.y * cos;
        this.x = x;
        this.y = y;
        return this;
    }

    angle() {
        return Math.atan2(this.y, this.x);
    }

    angleTo(v) {
        return Math.atan2(v.y - this.y, v.x - this.x);
    }

    distanceTo(v) {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceToSquared(v) {
        const dx = v.x - this.x;
        const dy = v.y - this.y;
        return dx * dx + dy * dy;
    }

    lerp(v, t) {
        this.x += (v.x - this.x) * t;
        this.y += (v.y - this.y) * t;
        return this;
    }

    perpendicular() {
        return new Vector2(-this.y, this.x);
    }

    negate() {
        this.x = -this.x;
        this.y = -this.y;
        return this;
    }

    isZero(epsilon = 1e-10) {
        return Math.abs(this.x) < epsilon && Math.abs(this.y) < epsilon;
    }

    clamp(minX, maxX, minY, maxY) {
        this.x = Math.max(minX, Math.min(maxX, this.x));
        this.y = Math.max(minY, Math.min(maxY, this.y));
        return this;
    }

    clampLength(maxLength) {
        const len = this.length();
        if (len > maxLength) {
            this.scale(maxLength / len);
        }
        return this;
    }

    toArray() {
        return [this.x, this.y];
    }

    toString() {
        return `(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`;
    }
}

// Static vector operations (return new vectors)
Vector2.add = (a, b) => new Vector2(a.x + b.x, a.y + b.y);
Vector2.sub = (a, b) => new Vector2(a.x - b.x, a.y - b.y);
Vector2.scale = (v, s) => new Vector2(v.x * s, v.y * s);
Vector2.lerp = (a, b, t) => new Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
Vector2.distance = (a, b) => a.distanceTo(b);
Vector2.zero = () => new Vector2(0, 0);
Vector2.one = () => new Vector2(1, 1);
Vector2.up = () => new Vector2(0, -1);
Vector2.down = () => new Vector2(0, 1);
Vector2.left = () => new Vector2(-1, 0);
Vector2.right = () => new Vector2(1, 0);

/**
 * Math utilities
 */
export const MathUtils = {
    PI: Math.PI,
    TWO_PI: Math.PI * 2,
    HALF_PI: Math.PI / 2,
    DEG_TO_RAD: Math.PI / 180,
    RAD_TO_DEG: 180 / Math.PI,
    EPSILON: 1e-10,

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    inverseLerp(a, b, value) {
        if (a === b) return 0;
        return (value - a) / (b - a);
    },

    map(value, inMin, inMax, outMin, outMax) {
        return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
    },

    smoothstep(edge0, edge1, x) {
        const t = this.clamp((x - edge0) / (edge1 - edge0), 0, 1);
        return t * t * (3 - 2 * t);
    },

    degToRad(degrees) {
        return degrees * this.DEG_TO_RAD;
    },

    radToDeg(radians) {
        return radians * this.RAD_TO_DEG;
    },

    wrapAngle(angle) {
        while (angle < -this.PI) angle += this.TWO_PI;
        while (angle > this.PI) angle -= this.TWO_PI;
        return angle;
    },

    randomRange(min, max) {
        return min + Math.random() * (max - min);
    },

    randomInt(min, max) {
        return Math.floor(min + Math.random() * (max - min + 1));
    },

    randomGaussian(mean = 0, stdDev = 1) {
        const u1 = Math.random();
        const u2 = Math.random();
        const randStdNormal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(this.TWO_PI * u2);
        return mean + stdDev * randStdNormal;
    },

    sign(x) {
        return x > 0 ? 1 : x < 0 ? -1 : 0;
    },

    approxEqual(a, b, epsilon = this.EPSILON) {
        return Math.abs(a - b) < epsilon;
    },

    // Polar to Cartesian
    polarToCartesian(r, theta) {
        return new Vector2(r * Math.cos(theta), r * Math.sin(theta));
    },

    // Cartesian to Polar
    cartesianToPolar(x, y) {
        return {
            r: Math.sqrt(x * x + y * y),
            theta: Math.atan2(y, x)
        };
    },

    // Bilinear interpolation
    bilinearInterpolate(q11, q12, q21, q22, x1, x2, y1, y2, x, y) {
        const r1 = ((x2 - x) / (x2 - x1)) * q11 + ((x - x1) / (x2 - x1)) * q21;
        const r2 = ((x2 - x) / (x2 - x1)) * q12 + ((x - x1) / (x2 - x1)) * q22;
        return ((y2 - y) / (y2 - y1)) * r1 + ((y - y1) / (y2 - y1)) * r2;
    },

    // Numerical differentiation (central difference)
    centralDifference(f, x, h = 0.001) {
        return (f(x + h) - f(x - h)) / (2 * h);
    },

    // 2D gradient
    gradient2D(f, x, y, h = 0.001) {
        const dfdx = (f(x + h, y) - f(x - h, y)) / (2 * h);
        const dfdy = (f(x, y + h) - f(x, y - h)) / (2 * h);
        return new Vector2(dfdx, dfdy);
    },

    // 2D Laplacian
    laplacian2D(f, x, y, h = 0.001) {
        const d2fdx2 = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
        const d2fdy2 = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
        return d2fdx2 + d2fdy2;
    },

    // 2D curl (for scalar vorticity from velocity field)
    curl2D(vx, vy, x, y, h = 0.001) {
        const dvydx = (vy(x + h, y) - vy(x - h, y)) / (2 * h);
        const dvxdy = (vx(x, y + h) - vx(x, y - h)) / (2 * h);
        return dvydx - dvxdy;
    }
};

/**
 * Object pool for performance
 */
export class ObjectPool {
    constructor(factory, initialSize = 100) {
        this.factory = factory;
        this.pool = [];
        this.expand(initialSize);
    }

    expand(count) {
        for (let i = 0; i < count; i++) {
            this.pool.push(this.factory());
        }
    }

    acquire() {
        if (this.pool.length === 0) {
            this.expand(50);
        }
        return this.pool.pop();
    }

    release(obj) {
        this.pool.push(obj);
    }

    clear() {
        this.pool = [];
    }

    get size() {
        return this.pool.length;
    }
}

/**
 * Simple event emitter
 */
export class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => callback(...args));
    }

    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    clear() {
        this.events = {};
    }
}

/**
 * UUID generator
 */
export function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}
