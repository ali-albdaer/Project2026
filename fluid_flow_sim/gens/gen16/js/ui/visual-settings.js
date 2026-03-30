// visual-settings.js — Display quantity and colormap selection

import { bus } from '../core/event-bus.js';
import { COLORMAP_NAMES, getColormapCSS } from '../rendering/colormaps.js';
import { QUANTITY_NAMES } from '../rendering/renderer.js';
import { makeSelect, makeCheckbox, makeSubTitle, makeDivider } from './panel.js';

export class VisualSettings {
    constructor() {
        this.quantity = 0;
        this.colormap = 'viridis';
        this.showProbe = false;
        this.showBLDelta = false;
        this.showBLDeltaStar = false;
        this.showBLTheta = false;
    }

    init(container) {
        const el = container;

        // Quantity selector
        const qOpts = QUANTITY_NAMES.map((name, i) => ({ value: String(i), label: name }));
        const qSel = makeSelect('Quantity', qOpts, '0', v => {
            this.quantity = parseInt(v);
            bus.emit('quantity-changed', this.quantity);
        });
        el.appendChild(qSel.row);

        el.appendChild(makeDivider());
        el.appendChild(makeSubTitle('Colormap'));

        // Colormap list with preview strips
        const cmapList = document.createElement('div');
        COLORMAP_NAMES.forEach(name => {
            const opt = document.createElement('div');
            opt.className = 'cmap-option' + (name === this.colormap ? ' selected' : '');
            const strip = document.createElement('div');
            strip.className = 'cmap-strip';
            strip.style.background = getColormapCSS(name);
            const label = document.createElement('span');
            label.className = 'cmap-name';
            label.textContent = name;
            opt.append(strip, label);

            opt.addEventListener('click', () => {
                cmapList.querySelectorAll('.cmap-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                this.colormap = name;
                bus.emit('colormap-changed', name);
            });

            cmapList.appendChild(opt);
        });
        el.appendChild(cmapList);

        el.appendChild(makeDivider());
        el.appendChild(makeSubTitle('Overlays'));

        const probeChk = makeCheckbox('Probe Tool', this.showProbe, v => {
            this.showProbe = v;
            bus.emit('probe-toggled', v);
        });
        el.appendChild(probeChk.row);

        el.appendChild(makeDivider());
        el.appendChild(makeSubTitle('Boundary Layers'));

        const blDelta = makeCheckbox('delta (99%)', this.showBLDelta, v => {
            this.showBLDelta = v;
            bus.emit('bl-display-changed', { delta: v, deltaStar: this.showBLDeltaStar, theta: this.showBLTheta });
        });
        el.appendChild(blDelta.row);

        const blDeltaStar = makeCheckbox('delta* (displacement)', this.showBLDeltaStar, v => {
            this.showBLDeltaStar = v;
            bus.emit('bl-display-changed', { delta: this.showBLDelta, deltaStar: v, theta: this.showBLTheta });
        });
        el.appendChild(blDeltaStar.row);

        const blTheta = makeCheckbox('theta (momentum)', this.showBLTheta, v => {
            this.showBLTheta = v;
            bus.emit('bl-display-changed', { delta: this.showBLDelta, deltaStar: this.showBLDeltaStar, theta: v });
        });
        el.appendChild(blTheta.row);
    }
}
