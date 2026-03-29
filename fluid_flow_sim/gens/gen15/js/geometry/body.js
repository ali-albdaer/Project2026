// ────────────────────────────────────────────
// body.js — Body class: position, shape, rasterization
// ────────────────────────────────────────────

import { createShape } from './shapes.js';
import { SHAPE_DEFAULTS } from '../config.js';

let _nextId = 1;

export class Body {
    constructor(type, x, y, params = {}, angle = 0) {
        this.id = _nextId++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.params = { ...(SHAPE_DEFAULTS[type] || {}), ...params };
        this._rebuildShape();
    }

    _rebuildShape() {
        this.shape = createShape(this.type, this.x, this.y, this.params, this.angle);
    }

    /** Signed distance at world point (px, py). Negative inside. */
    sdf(px, py) {
        return this.shape.sdf(px, py);
    }

    /** Hit test — is the point inside or on the surface? */
    contains(px, py) {
        return this.shape.sdf(px, py) <= 0;
    }

    /** Characteristic length for Re calculation. */
    get characteristicLength() {
        return this.shape.charLength;
    }

    /** Get ordered surface sample points with normals. */
    getSurfacePoints(n = 120) {
        return this.shape.surface(n);
    }

    /** Move body to new position. */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this._rebuildShape();
    }

    /** Translate by delta. */
    translate(dx, dy) {
        this.x += dx;
        this.y += dy;
        this._rebuildShape();
    }

    /** Set rotation angle (radians). */
    setAngle(angle) {
        this.angle = angle;
        this._rebuildShape();
    }

    /** Update shape parameters (merged). */
    setParams(params) {
        Object.assign(this.params, params);
        this._rebuildShape();
    }

    /**
     * Rasterize this body onto the solid grid.
     * Marks cells where sdf <= 0 as solid (value = 1).
     * @param {Uint8Array} solid - flat array [ny * nx]
     * @param {number} nx
     * @param {number} ny
     */
    rasterize(solid, nx, ny) {
        // Compute bounding box to avoid checking every cell
        const cl = this.characteristicLength;
        const margin = cl * 0.8;
        const x0 = Math.max(0, Math.floor(this.x - margin));
        const y0 = Math.max(0, Math.floor(this.y - margin));
        const x1 = Math.min(nx - 1, Math.ceil(this.x + margin));
        const y1 = Math.min(ny - 1, Math.ceil(this.y + margin));

        for (let j = y0; j <= y1; j++) {
            for (let i = x0; i <= x1; i++) {
                if (this.sdf(i, j) <= 0) {
                    solid[j * nx + i] = 1;
                }
            }
        }
    }

    /** Serialize for saving/loading. */
    toJSON() {
        return {
            type: this.type,
            x: this.x,
            y: this.y,
            angle: this.angle,
            params: { ...this.params },
        };
    }

    /** Deserialize. */
    static fromJSON(data) {
        return new Body(data.type, data.x, data.y, data.params, data.angle);
    }
}
