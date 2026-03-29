// ────────────────────────────────────────────
// bodyManager.js — Body collection management
// ────────────────────────────────────────────

import { Body } from './body.js';
import { bus, EVT } from '../events.js';
import { CELL } from '../config.js';

export class BodyManager {
    constructor() {
        this.bodies = [];
        this.selectedId = null;
    }

    /** Add a new body and emit event. Returns the body. */
    addBody(type, x, y, params = {}, angle = 0) {
        const body = new Body(type, x, y, params, angle);
        this.bodies.push(body);
        bus.emit(EVT.BODY_ADDED, body);
        bus.emit(EVT.BODIES_CHANGED, this.bodies);
        return body;
    }

    /** Remove body by id. */
    removeBody(id) {
        const idx = this.bodies.findIndex(b => b.id === id);
        if (idx === -1) return;
        const removed = this.bodies.splice(idx, 1)[0];
        if (this.selectedId === id) this.selectedId = null;
        bus.emit(EVT.BODY_REMOVED, removed);
        bus.emit(EVT.BODIES_CHANGED, this.bodies);
    }

    /** Select a body by id. */
    select(id) {
        this.selectedId = id;
        bus.emit(EVT.BODY_SELECTED, this.getSelected());
    }

    /** Deselect all. */
    deselect() {
        this.selectedId = null;
        bus.emit(EVT.BODY_SELECTED, null);
    }

    /** Get selected body or null. */
    getSelected() {
        return this.bodies.find(b => b.id === this.selectedId) || null;
    }

    /** Get body at world coordinates (for hit-testing). */
    getBodyAt(wx, wy) {
        // Check in reverse order (last added = on top)
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            if (this.bodies[i].contains(wx, wy)) {
                return this.bodies[i];
            }
        }
        return null;
    }

    /** Get body by id. */
    getById(id) {
        return this.bodies.find(b => b.id === id) || null;
    }

    /**
     * Rasterize all bodies onto the solid grid.
     * Resets fluid cells first, preserving inlet/outlet boundaries.
     */
    rasterizeAll(solid, nx, ny) {
        // Clear only SOLID cells back to FLUID (preserve INLET/OUTLET)
        for (let i = 0; i < solid.length; i++) {
            if (solid[i] === CELL.SOLID) solid[i] = CELL.FLUID;
        }
        for (const body of this.bodies) {
            body.rasterize(solid, nx, ny);
        }
    }

    /** Remove all bodies. */
    clear() {
        this.bodies.length = 0;
        this.selectedId = null;
        bus.emit(EVT.BODIES_CHANGED, this.bodies);
    }

    /** Get number of bodies. */
    get count() {
        return this.bodies.length;
    }
}
