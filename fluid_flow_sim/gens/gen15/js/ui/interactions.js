// ────────────────────────────────────────────
// interactions.js — Mouse and touch interactions
// ────────────────────────────────────────────
// Handles body dragging, placement, probe, and selection.

import { bus, EVT } from '../events.js';
import { CELL } from '../config.js';

export class InteractionManager {
    constructor(overlayCanvas, app) {
        this.canvas = overlayCanvas;
        this.app = app;

        // State
        this.isDragging = false;
        this.dragBody = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.spawnMode = false;
        this.spawnType = null;
        this.spawnPreviewX = 0;
        this.spawnPreviewY = 0;

        // Bind handlers
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);

        overlayCanvas.addEventListener('mousedown', this._onMouseDown);
        overlayCanvas.addEventListener('mousemove', this._onMouseMove);
        overlayCanvas.addEventListener('mouseup', this._onMouseUp);
        overlayCanvas.addEventListener('mouseleave', this._onMouseUp);

        // Spawn mode events
        bus.on(EVT.SPAWN_MODE, (data) => {
            this.spawnMode = true;
            this.spawnType = data.type;
            this.canvas.style.cursor = 'crosshair';
        });

        bus.on(EVT.SPAWN_CANCEL, () => {
            this.cancelSpawn();
        });
    }

    /** Convert canvas pixel coords to grid coords. */
    _canvasToGrid(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const { nx, ny } = this.app;
        return {
            x: (px / rect.width) * nx,
            y: (py / rect.height) * ny,
        };
    }

    _onMouseDown(e) {
        const { x, y } = this._canvasToGrid(e.clientX, e.clientY);

        if (this.spawnMode) {
            // Place body
            this.app.bodyManager.addBody(this.spawnType, Math.round(x), Math.round(y));
            this.cancelSpawn();
            bus.emit(EVT.BODIES_CHANGED, this.app.bodyManager.bodies);
            return;
        }

        // Check if clicking on a body
        const body = this.app.bodyManager.getBodyAt(x, y);
        if (body) {
            this.isDragging = true;
            this.dragBody = body;
            this.dragOffsetX = x - body.x;
            this.dragOffsetY = y - body.y;
            this.app.bodyManager.select(body.id);
            this.canvas.style.cursor = 'grabbing';
        } else {
            this.app.bodyManager.deselect();
        }
    }

    _onMouseMove(e) {
        const { x, y } = this._canvasToGrid(e.clientX, e.clientY);

        if (this.isDragging && this.dragBody) {
            this.dragBody.setPosition(
                Math.round(x - this.dragOffsetX),
                Math.round(y - this.dragOffsetY)
            );
            bus.emit(EVT.BODY_MOVED, this.dragBody);
            return;
        }

        if (this.spawnMode) {
            this.spawnPreviewX = x;
            this.spawnPreviewY = y;
            return;
        }

        // Probe
        if (this.app.config.probeEnabled) {
            this._updateProbe(x, y);
        }

        // Hover cursor
        if (!this.spawnMode) {
            const body = this.app.bodyManager.getBodyAt(x, y);
            this.canvas.style.cursor = body ? 'grab' : (this.app.config.probeEnabled ? 'crosshair' : 'default');
        }
    }

    _onMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
            bus.emit(EVT.BODY_MOVED, this.dragBody);
            this.dragBody = null;
        }
    }

    _updateProbe(gx, gy) {
        const { nx, ny } = this.app;
        const solver = this.app.solver;

        const i = Math.floor(gx);
        const j = Math.floor(gy);
        if (i < 0 || i >= nx || j < 0 || j >= ny) return;

        const idx = j * nx + i;
        const probeTooltip = document.getElementById('probe-tooltip');

        if (solver.solid[idx] === CELL.SOLID) {
            probeTooltip.classList.add('hidden');
            return;
        }

        const vals = {
            'rho': solver.rho[idx]?.toFixed(4) || '--',
            'u_x': solver.ux[idx]?.toFixed(5) || '--',
            'u_y': solver.uy[idx]?.toFixed(5) || '--',
            '|u|': solver.speed[idx]?.toFixed(5) || '--',
            'p': solver.pressure[idx]?.toFixed(5) || '--',
            'w': solver.curl[idx]?.toFixed(5) || '--',
        };

        let html = `<div class="probe-coords">(${i}, ${j})</div>`;
        for (const [k, v] of Object.entries(vals)) {
            html += `<div class="probe-row"><span class="probe-key">${k}</span><span class="probe-val">${v}</span></div>`;
        }

        probeTooltip.innerHTML = html;
        probeTooltip.classList.remove('hidden');

        // Position tooltip near cursor
        const rect = this.canvas.getBoundingClientRect();
        const px = (gx / nx) * rect.width;
        const py = (gy / ny) * rect.height;
        probeTooltip.style.left = (px + rect.left + 20) + 'px';
        probeTooltip.style.top = (py + rect.top - 10) + 'px';

        // Store for overlay drawing
        this.app.probeData = { active: true, x: gx, y: gy, values: vals };
    }

    cancelSpawn() {
        this.spawnMode = false;
        this.spawnType = null;
        this.canvas.style.cursor = 'default';
    }

    /** Get spawn preview for overlay rendering. */
    getSpawnPreview() {
        if (!this.spawnMode) return null;
        // Create temporary body for preview
        const { Body } = this.app;
        if (!Body) return null;
        try {
            return new Body(this.spawnType, this.spawnPreviewX, this.spawnPreviewY);
        } catch {
            return null;
        }
    }
}
