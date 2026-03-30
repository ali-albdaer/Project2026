// monitor.js — Property monitor: forces, coefficients, dimensionless numbers

import { bus } from '../core/event-bus.js';

export class Monitor {
    constructor() {
        this._el = null;
        this._items = {};
    }

    init(container) {
        this._el = container;

        const grid = document.createElement('div');
        grid.className = 'monitor-grid';

        const fields = [
            ['Re', 'Re'], ['Cd', 'Cd'], ['Cl', 'Cl'], ['Cf', 'Cf'],
            ['St', 'St'], ['Fr', 'Fr'], ['Pr', 'Pr'],
            ['Drag', 'drag'], ['Lift', 'lift'], ['Wall Shear', 'wallShear'],
        ];

        fields.forEach(([label, key]) => {
            const item = document.createElement('div');
            item.className = 'monitor-item';
            const k = document.createElement('span');
            k.className = 'monitor-key';
            k.textContent = label;
            const v = document.createElement('span');
            v.className = 'monitor-val';
            v.textContent = '--';
            item.append(k, v);
            grid.appendChild(item);
            this._items[key] = v;
        });

        this._el.appendChild(grid);
    }

    update(results) {
        if (!results) return;
        for (const key in this._items) {
            const val = results[key];
            if (val !== undefined) {
                this._items[key].textContent = this._format(val);
            }
        }
    }

    _format(v) {
        if (v === 0) return '0';
        const abs = Math.abs(v);
        if (abs >= 1000) return v.toFixed(0);
        if (abs >= 1) return v.toFixed(2);
        if (abs >= 0.001) return v.toFixed(4);
        return v.toExponential(2);
    }
}
