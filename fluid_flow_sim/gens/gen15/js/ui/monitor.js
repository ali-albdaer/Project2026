// ────────────────────────────────────────────
// monitor.js — Property monitor panel
// ────────────────────────────────────────────

import { formatQuantity } from '../analysis/quantities.js';

export class Monitor {
    constructor() {
        this.el = document.getElementById('monitor');
        this.contentEl = document.getElementById('monitor-content');
        this.headerEl = document.getElementById('monitor-toggle');
        this.collapsed = true;

        this.headerEl.addEventListener('click', () => this.toggle());
    }

    toggle() {
        this.collapsed = !this.collapsed;
        this.el.classList.toggle('collapsed', this.collapsed);
    }

    setVisible(v) {
        this.collapsed = !v;
        this.el.classList.toggle('collapsed', this.collapsed);
    }

    /**
     * Update the monitor display.
     * @param {Array} bodyQuantities — [{ bodyId, bodyName, quantities }]
     */
    update(bodyQuantities) {
        if (this.collapsed || !bodyQuantities || bodyQuantities.length === 0) {
            this.contentEl.innerHTML = '<div class="monitor-empty">No bodies in simulation</div>';
            return;
        }

        let html = '<table class="monitor-table"><thead><tr><th>Qty</th>';
        for (const bq of bodyQuantities) {
            html += `<th>${bq.bodyName}</th>`;
        }
        html += '</tr></thead><tbody>';

        const fields = [
            ['Re', 'Re'],
            ['Cd', 'Cd'],
            ['Cl', 'Cl'],
            ['Cf', 'Cf'],
            ['St', 'St'],
            ['Fr', 'Fr'],
            ['Fx', 'F_x'],
            ['Fy', 'F_y'],
            ['wallShear', 'tau_w'],
        ];

        for (const [key, label] of fields) {
            html += `<tr><td class="qty-label">${label}</td>`;
            for (const bq of bodyQuantities) {
                const val = bq.quantities[key];
                html += `<td class="qty-value">${val !== undefined ? formatQuantity(val) : '--'}</td>`;
            }
            html += '</tr>';
        }

        html += '</tbody></table>';
        this.contentEl.innerHTML = html;
    }
}
