// ────────────────────────────────────────────
// keybinds.js — Keyboard shortcut handler
// ────────────────────────────────────────────

import { bus, EVT } from '../events.js';
import { KEYBINDS } from '../config.js';

export class KeybindManager {
    constructor(app) {
        this.app = app;
        this._handler = this._onKeyDown.bind(this);
        document.addEventListener('keydown', this._handler);
    }

    _onKeyDown(e) {
        // Don't intercept when typing in inputs
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        const key = e.key;
        const bind = KEYBINDS[key];
        if (!bind) return;

        e.preventDefault();

        switch (bind.action) {
            case 'toggleSidebar':
                this.app.sidebar.toggle();
                break;
            case 'togglePause':
                this.app.config.paused = !this.app.config.paused;
                this.app.updatePauseButton();
                break;
            case 'reset':
                bus.emit(EVT.SOLVER_RESET);
                break;
            case 'singleStep':
                this.app.singleStep();
                break;
            case 'toggleProbe':
                this.app.config.probeEnabled = !this.app.config.probeEnabled;
                bus.emit(EVT.CONFIG_CHANGED, { probeEnabled: this.app.config.probeEnabled });
                break;
            case 'toggleMonitor':
                this.app.monitor.toggle();
                break;
            case 'toggleUI':
                this.app.toggleUI();
                break;
            case 'togglePanel1':
                this.app.sidebar.togglePanel(0);
                break;
            case 'togglePanel2':
                this.app.sidebar.togglePanel(1);
                break;
            case 'togglePanel3':
                this.app.sidebar.togglePanel(2);
                break;
            case 'togglePanel4':
                this.app.sidebar.togglePanel(3);
                break;
            case 'deleteBody':
                if (this.app.bodyManager.selectedId) {
                    this.app.bodyManager.removeBody(this.app.bodyManager.selectedId);
                }
                break;
            case 'cancel':
                this.app.cancelSpawnMode();
                this.app.bodyManager.deselect();
                break;
            case 'speedUp':
                this.app.config.stepsPerFrame = Math.min(20, this.app.config.stepsPerFrame + 1);
                bus.emit(EVT.CONFIG_CHANGED, { stepsPerFrame: this.app.config.stepsPerFrame });
                break;
            case 'speedDown':
                this.app.config.stepsPerFrame = Math.max(1, this.app.config.stepsPerFrame - 1);
                bus.emit(EVT.CONFIG_CHANGED, { stepsPerFrame: this.app.config.stepsPerFrame });
                break;
        }
    }

    destroy() {
        document.removeEventListener('keydown', this._handler);
    }
}
