// flow-settings.js — Flow parameter controls: velocity, viscosity, density, temperature

import { bus } from '../core/event-bus.js';
import { makeSlider, makeTextInput, makeNumberInput, makeSubTitle, makeDivider } from './panel.js';

export class FlowSettings {
    constructor() {
        this.inletUx = 0.1;
        this.inletUy = 0.0;
        this.viscosity = 0.02;
        this.density = 1.0;
        this.temperature = 293.15; // K (cosmetic)
        this.uxExpr = '0.1';
        this.uyExpr = '0';
        this.useExpr = false;
    }

    init(container) {
        const el = container;

        el.appendChild(makeSubTitle('Inlet Velocity'));

        // Velocity sliders
        const uxSlider = makeSlider('U_x', 0, 0.25, this.inletUx, 0.001, v => {
            this.inletUx = v;
            bus.emit('inlet-changed', { ux: this.inletUx, uy: this.inletUy });
        });
        el.appendChild(uxSlider.row);

        const uySlider = makeSlider('U_y', -0.1, 0.1, this.inletUy, 0.001, v => {
            this.inletUy = v;
            bus.emit('inlet-changed', { ux: this.inletUx, uy: this.inletUy });
        });
        el.appendChild(uySlider.row);

        el.appendChild(makeSubTitle('Function Input u(x,y,t)'));

        const uxExpr = makeTextInput('u_x =', this.uxExpr, v => {
            this.uxExpr = v;
            this._tryApplyExpr();
        });
        el.appendChild(uxExpr.row);

        const uyExpr = makeTextInput('u_y =', this.uyExpr, v => {
            this.uyExpr = v;
            this._tryApplyExpr();
        });
        el.appendChild(uyExpr.row);

        el.appendChild(makeDivider());
        el.appendChild(makeSubTitle('Fluid Properties'));

        const viscSlider = makeSlider('Viscosity', 0.001, 0.1, this.viscosity, 0.001, v => {
            this.viscosity = v;
            bus.emit('viscosity-changed', v);
        });
        el.appendChild(viscSlider.row);

        const densInput = makeNumberInput('Density', this.density, 0.1, v => {
            this.density = Math.max(0.1, v);
            bus.emit('density-changed', this.density);
        });
        el.appendChild(densInput.row);

        const tempInput = makeNumberInput('Temperature (K)', this.temperature, 1, v => {
            this.temperature = v;
            bus.emit('temperature-changed', this.temperature);
        });
        el.appendChild(tempInput.row);
    }

    _tryApplyExpr() {
        try {
            // Validate expression by evaluating at (0.5, 0.5, 0)
            const fnUx = new Function('x', 'y', 't', 'return ' + this.uxExpr);
            const fnUy = new Function('x', 'y', 't', 'return ' + this.uyExpr);
            const testUx = fnUx(0.5, 0.5, 0);
            const testUy = fnUy(0.5, 0.5, 0);
            if (typeof testUx === 'number' && typeof testUy === 'number') {
                this.inletUx = testUx;
                this.inletUy = testUy;
                bus.emit('inlet-changed', { ux: testUx, uy: testUy, exprUx: this.uxExpr, exprUy: this.uyExpr });
            }
        } catch (e) {
            // Invalid expression — ignore silently
        }
    }

    /** Evaluate velocity expressions at a given point. */
    evalVelocity(x, y, t) {
        try {
            const fnUx = new Function('x', 'y', 't', 'return ' + this.uxExpr);
            const fnUy = new Function('x', 'y', 't', 'return ' + this.uyExpr);
            return [fnUx(x, y, t), fnUy(x, y, t)];
        } catch (e) {
            return [this.inletUx, this.inletUy];
        }
    }
}
