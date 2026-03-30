// sim-settings.js — Simulation settings panel: resolution, solver, substeps, assumptions

import { bus } from '../core/event-bus.js';
import { makeSlider, makeSelect, makeCheckbox, makeSubTitle, makeDivider, makeButton, makeNumberInput } from './panel.js';

export class SimSettings {
    constructor() {
        this.resolution = 256;
        this.solver = 'lbm';
        this.substeps = 4;
        this.jacobiIter = 40;
        this.assumptions = {
            incompressible: true,
            isothermal: true,
            twoDimensional: true,
            steadyBC: true,
            boussinesq: false,
        };
    }

    init(container) {
        const el = container;

        // Resolution
        const res = makeSlider('Resolution', 64, 1024, this.resolution, 1, v => {
            // Snap to nearest power-of-2-ish
            const snapped = Math.round(v / 16) * 16;
            this.resolution = Math.max(64, snapped);
            res.val.textContent = this.resolution;
            bus.emit('resolution-changed', this.resolution);
        });
        el.appendChild(res.row);

        // Solver type
        const solverSel = makeSelect('Solver', [
            { value: 'lbm', label: 'LBM D2Q9 (BGK)' },
            { value: 'projection', label: 'Projection (Chorin)' }
        ], this.solver, v => {
            this.solver = v;
            jacIterRow.style.display = v === 'projection' ? 'flex' : 'none';
            bus.emit('solver-changed', v);
        });
        el.appendChild(solverSel.row);

        // Substeps per frame
        const sub = makeSlider('Substeps', 1, 32, this.substeps, 1, v => {
            this.substeps = Math.round(v);
            bus.emit('substeps-changed', this.substeps);
        });
        el.appendChild(sub.row);

        // Jacobi iterations (projection solver only)
        const jac = makeNumberInput('Jacobi Iter.', this.jacobiIter, 1, v => {
            this.jacobiIter = Math.max(1, Math.round(v));
            bus.emit('jacobi-changed', this.jacobiIter);
        });
        const jacIterRow = jac.row;
        jacIterRow.style.display = this.solver === 'projection' ? 'flex' : 'none';
        el.appendChild(jacIterRow);

        el.appendChild(makeDivider());
        el.appendChild(makeSubTitle('Assumptions'));

        // Assumption checkboxes
        const assumptions = [
            ['Incompressible', 'incompressible'],
            ['Isothermal', 'isothermal'],
            ['2D', 'twoDimensional'],
            ['Steady BC', 'steadyBC'],
            ['Boussinesq approx.', 'boussinesq'],
        ];
        assumptions.forEach(([label, key]) => {
            const cb = makeCheckbox(label, this.assumptions[key], v => {
                this.assumptions[key] = v;
                bus.emit('assumption-changed', { key, value: v });
            });
            el.appendChild(cb.row);
        });

        el.appendChild(makeDivider());

        // Control buttons
        const btnRow = document.createElement('div');
        btnRow.className = 'btn-group';
        btnRow.appendChild(makeButton('Reset', 'btn-accent', () => bus.emit('reset')));
        btnRow.appendChild(makeButton('Pause', '', () => bus.emit('toggle-pause')));
        el.appendChild(btnRow);
    }
}
