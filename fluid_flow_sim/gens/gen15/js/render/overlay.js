// ────────────────────────────────────────────
// overlay.js — Canvas 2D overlay for annotations
// ────────────────────────────────────────────
// Draws body outlines, boundary layer curves, probe crosshair, and FPS
// on a transparent canvas layered above the WebGL render.

import { CELL } from '../config.js';

export class Overlay {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Draw all overlay elements.
     * @param {object} params
     * @param {Array} params.bodies — body list
     * @param {number} params.selectedId — selected body id
     * @param {object} params.blData — boundary layer data per body id
     * @param {object} params.probeData — { active, x, y, values }
     * @param {number} params.fps
     * @param {object} params.config — display config
     * @param {number} params.nx — grid width
     * @param {number} params.ny — grid height
     * @param {boolean} params.spawnMode — body spawn preview active
     * @param {{x:number,y:number,type:string}} params.spawnPreview — preview body
     */
    draw(params) {
        const { bodies, selectedId, blData, probeData, fps, config, nx, ny,
                spawnMode, spawnPreview } = params;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Scale factors: canvas pixels per grid cell
        const sx = w / nx;
        const sy = h / ny;

        // Draw body outlines
        if (config.showBodies) {
            for (const body of bodies) {
                const isSelected = body.id === selectedId;
                this._drawBodyOutline(ctx, body, sx, sy, isSelected);
            }
        }

        // Spawn preview
        if (spawnMode && spawnPreview) {
            ctx.globalAlpha = 0.5;
            this._drawBodyOutline(ctx, spawnPreview, sx, sy, false, '#58a6ff');
            ctx.globalAlpha = 1.0;
        }

        // Boundary layer curves
        if (config.showBoundaryLayer && blData) {
            for (const bodyId of Object.keys(blData)) {
                const bl = blData[bodyId];
                if (!bl || !bl.points) continue;
                if (config.blDelta) this._drawBLCurve(ctx, bl.points, 'delta', sx, sy, '#4ecdc4', []);
                if (config.blDeltaStar) this._drawBLCurve(ctx, bl.points, 'deltaStar', sx, sy, '#ff6b6b', [6, 4]);
                if (config.blTheta) this._drawBLCurve(ctx, bl.points, 'theta', sx, sy, '#ffd93d', [2, 3]);
            }
        }

        // Probe crosshair
        if (probeData && probeData.active) {
            this._drawProbe(ctx, probeData, sx, sy);
        }

        // FPS indicator
        this._drawFPS(ctx, fps, w, h);
    }

    _drawBodyOutline(ctx, body, sx, sy, isSelected, color = null) {
        const pts = body.getSurfacePoints(80);
        if (pts.length < 3) return;

        ctx.beginPath();
        ctx.moveTo(pts[0].x * sx, pts[0].y * sy);
        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x * sx, pts[i].y * sy);
        }
        ctx.closePath();

        ctx.strokeStyle = color || (isSelected ? '#58a6ff' : 'rgba(200, 210, 230, 0.7)');
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();

        if (isSelected) {
            ctx.fillStyle = 'rgba(88, 166, 255, 0.05)';
            ctx.fill();
        }
    }

    _drawBLCurve(ctx, blPoints, field, sx, sy, color, dashPattern) {
        if (blPoints.length < 2) return;

        ctx.beginPath();
        ctx.setLineDash(dashPattern);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;

        let started = false;
        for (const pt of blPoints) {
            const val = pt[field];
            if (val <= 0) continue;

            const px = (pt.x + pt.nx * val) * sx;
            const py = (pt.y + pt.ny * val) * sy;

            if (!started) {
                ctx.moveTo(px, py);
                started = true;
            } else {
                ctx.lineTo(px, py);
            }
        }

        ctx.stroke();
        ctx.setLineDash([]);
    }

    _drawProbe(ctx, probeData, sx, sy) {
        const px = probeData.x * sx;
        const py = probeData.y * sy;
        const size = 8;

        // Crosshair
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - size, py); ctx.lineTo(px + size, py);
        ctx.moveTo(px, py - size); ctx.lineTo(px, py + size);
        ctx.stroke();

        // Circle
        ctx.beginPath();
        ctx.arc(px, py, size * 0.6, 0, Math.PI * 2);
        ctx.stroke();
    }

    _drawFPS(ctx, fps, w, h) {
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(180, 190, 210, 0.7)';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.round(fps)} FPS`, 8, h - 8);
    }
}
