// body-settings.js — Body management panel: add/remove/configure bodies

import { bus } from '../core/event-bus.js';
import { BODY_TYPES } from '../physics/bodies.js';
import { makeSelect, makeSlider, makeButton, makeSubTitle, makeDivider, makeNumberInput } from './panel.js';

export class BodySettings {
    constructor(bodyManager) {
        this.bodyManager = bodyManager;
        this.container = null;
        this._listEl = null;
        this._paramsEl = null;
        this._addType = 'CIRCLE';
    }

    init(container) {
        this.container = container;

        // Add body controls
        const typeOptions = Object.keys(BODY_TYPES).map(k => ({
            value: k, label: BODY_TYPES[k].name
        }));
        const typeSel = makeSelect('Type', typeOptions, this._addType, v => {
            this._addType = v;
        });
        container.appendChild(typeSel.row);

        const addBtn = makeButton('Add Body', 'btn-accent btn-block', () => {
            this._addBody();
        });
        container.appendChild(addBtn);

        container.appendChild(makeDivider());
        container.appendChild(makeSubTitle('Bodies'));

        // Body list
        this._listEl = document.createElement('div');
        this._listEl.className = 'body-list';
        container.appendChild(this._listEl);

        // Parameter editing area
        this._paramsEl = document.createElement('div');
        this._paramsEl.className = 'body-params';
        container.appendChild(this._paramsEl);

        // Listen for selection changes
        bus.on('body-selected', id => this._onSelect(id));

        this._refreshList();
    }

    _addBody() {
        // Place at center of domain with slight random offset to avoid stacking
        const x = 0.35 + (Math.random() - 0.5) * 0.05;
        const y = 0.5 + (Math.random() - 0.5) * 0.05;
        const body = this.bodyManager.add(this._addType, x, y);
        if (body) {
            this.bodyManager.select(body.id);
            bus.emit('bodies-changed');
            bus.emit('body-selected', body.id);
            this._refreshList();
        }
    }

    _refreshList() {
        this._listEl.innerHTML = '';
        for (const body of this.bodyManager.bodies) {
            const item = document.createElement('div');
            item.className = 'body-item' + (body.id === this.bodyManager.selectedId ? ' selected' : '');
            item.innerHTML = `<span class="body-item-name">${body.name}</span><span class="body-item-remove" title="Remove">&times;</span>`;

            item.querySelector('.body-item-name').addEventListener('click', () => {
                this.bodyManager.select(body.id);
                bus.emit('body-selected', body.id);
                this._refreshList();
            });

            item.querySelector('.body-item-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                this.bodyManager.remove(body.id);
                bus.emit('bodies-changed');
                this._refreshList();
                this._paramsEl.innerHTML = '';
            });

            this._listEl.appendChild(item);
        }
    }

    _onSelect(id) {
        this._refreshList();
        this._showParams(id);
    }

    _showParams(id) {
        this._paramsEl.innerHTML = '';
        const body = this.bodyManager.get(id);
        if (!body) return;

        this._paramsEl.appendChild(makeSubTitle('Position & Rotation'));

        const xCtrl = makeSlider('X', 0.05, 0.95, body.x, 0.005, v => {
            body.x = v;
            bus.emit('bodies-changed');
        });
        this._paramsEl.appendChild(xCtrl.row);

        const yCtrl = makeSlider('Y', 0.05, 0.95, body.y, 0.005, v => {
            body.y = v;
            bus.emit('bodies-changed');
        });
        this._paramsEl.appendChild(yCtrl.row);

        const rotCtrl = makeSlider('Angle', -3.14, 3.14, body.rotation, 0.01, v => {
            body.rotation = v;
            bus.emit('bodies-changed');
        });
        this._paramsEl.appendChild(rotCtrl.row);

        this._paramsEl.appendChild(makeDivider());
        this._paramsEl.appendChild(makeSubTitle('Shape Parameters'));

        const paramNames = BODY_TYPES[body.type].params;
        for (const pname of paramNames) {
            const val = body.params[pname] || 0;
            const ctrl = makeSlider(pname, 0.001, 0.5, val, 0.001, v => {
                body.params[pname] = v;
                bus.emit('bodies-changed');
            });
            this._paramsEl.appendChild(ctrl.row);
        }
    }

    refresh() {
        this._refreshList();
        if (this.bodyManager.selectedId >= 0) {
            this._showParams(this.bodyManager.selectedId);
        }
    }
}
