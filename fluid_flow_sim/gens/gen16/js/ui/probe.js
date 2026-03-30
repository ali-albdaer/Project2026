// probe.js — Hover probe tool displaying flow properties at cursor position

import { bus } from '../core/event-bus.js';

export class ProbeTool {
    constructor() {
        this.enabled = false;
        this._tooltip = null;
        this._canvas = null;
        this._onMove = null;
    }

    init(canvas) {
        this._canvas = canvas;
        this._tooltip = document.getElementById('probe-tooltip');

        this._onMove = (e) => {
            if (!this.enabled) return;
            const rect = canvas.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width;
            const ny = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y
            bus.emit('probe-sample', { nx, ny, screenX: e.clientX, screenY: e.clientY });
        };

        canvas.addEventListener('mousemove', this._onMove);

        bus.on('probe-toggled', enabled => {
            this.enabled = enabled;
            if (!enabled) this.hide();
        });

        bus.on('probe-result', data => {
            if (!this.enabled || !data) { this.hide(); return; }
            this.show(data);
        });
    }

    show(data) {
        const tt = this._tooltip;
        tt.style.display = 'block';
        tt.style.left = (data.screenX + 16) + 'px';
        tt.style.top = (data.screenY - 10) + 'px';

        // Clamp to viewport
        const rect = tt.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tt.style.left = (data.screenX - rect.width - 12) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            tt.style.top = (data.screenY - rect.height - 8) + 'px';
        }

        const fmt = (v) => {
            if (v === undefined || v === null) return '--';
            const abs = Math.abs(v);
            if (abs >= 1) return v.toFixed(3);
            if (abs >= 0.0001) return v.toFixed(5);
            return v.toExponential(2);
        };

        tt.textContent =
            `u_x:  ${fmt(data.ux)}\n` +
            `u_y:  ${fmt(data.uy)}\n` +
            `|u|:  ${fmt(data.speed)}\n` +
            `rho:  ${fmt(data.rho)}\n` +
            `p:    ${fmt(data.pressure)}\n` +
            `curl: ${fmt(data.vorticity)}\n` +
            `Ma:   ${fmt(data.mach)}`;
    }

    hide() {
        if (this._tooltip) this._tooltip.style.display = 'none';
    }
}
