// keybinds.js — Keyboard shortcut handler

import { bus } from '../core/event-bus.js';

const BINDINGS = [
    { key: ' ',       event: 'toggle-pause',   desc: 'Pause / Resume' },
    { key: 'h',       event: 'toggle-ui',      desc: 'Hide / Show UI' },
    { key: 'Tab',     event: 'toggle-panel',   desc: 'Toggle Panel' },
    { key: 'r',       event: 'reset',           desc: 'Reset Simulation' },
    { key: 'p',       event: 'toggle-probe',   desc: 'Toggle Probe' },
    { key: '1',       event: 'set-quantity',   data: 0,  desc: 'Show Speed' },
    { key: '2',       event: 'set-quantity',   data: 1,  desc: 'Show Vorticity' },
    { key: '3',       event: 'set-quantity',   data: 2,  desc: 'Show Pressure' },
    { key: '4',       event: 'set-quantity',   data: 3,  desc: 'Show Velocity X' },
    { key: '5',       event: 'set-quantity',   data: 4,  desc: 'Show Velocity Y' },
    { key: 'Escape',  event: 'deselect',       desc: 'Deselect Body' },
    { key: 'Delete',  event: 'delete-body',    desc: 'Remove Selected Body' },
    { key: '=',       event: 'resolution-up',  desc: 'Increase Resolution' },
    { key: '-',       event: 'resolution-down',desc: 'Decrease Resolution' },
];

export class Keybinds {
    constructor() {
        this._active = true;
    }

    init() {
        window.addEventListener('keydown', (e) => {
            if (!this._active) return;

            // Don't capture when typing in inputs
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            for (const b of BINDINGS) {
                if (e.key === b.key) {
                    e.preventDefault();
                    bus.emit(b.event, b.data);
                    return;
                }
            }
        });
    }

    enable() { this._active = true; }
    disable() { this._active = false; }
}

export { BINDINGS };
