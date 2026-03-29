// ────────────────────────────────────────────
// events.js — Lightweight pub/sub event bus
// ────────────────────────────────────────────

export class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const set = this._listeners.get(event);
        if (set) {
            set.delete(callback);
            if (set.size === 0) this._listeners.delete(event);
        }
    }

    emit(event, data) {
        const set = this._listeners.get(event);
        if (set) {
            for (const cb of set) {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`EventBus error in "${event}":`, e);
                }
            }
        }
    }

    once(event, callback) {
        const wrapper = (data) => {
            this.off(event, wrapper);
            callback(data);
        };
        this.on(event, wrapper);
    }

    clear() {
        this._listeners.clear();
    }
}

// Singleton instance
export const bus = new EventBus();

// Event name constants
export const EVT = {
    // Solver
    SOLVER_STEP: 'solver:step',
    SOLVER_RESET: 'solver:reset',
    SOLVER_RESIZE: 'solver:resize',
    SOLVER_TYPE_CHANGED: 'solver:typeChanged',

    // Settings
    CONFIG_CHANGED: 'config:changed',
    RESOLUTION_CHANGED: 'config:resolution',
    FIELD_CHANGED: 'config:field',
    COLORMAP_CHANGED: 'config:colormap',

    // Bodies
    BODY_ADDED: 'body:added',
    BODY_REMOVED: 'body:removed',
    BODY_SELECTED: 'body:selected',
    BODY_MOVED: 'body:moved',
    BODY_UPDATED: 'body:updated',
    BODIES_CHANGED: 'body:changed',

    // UI
    SIDEBAR_TOGGLE: 'ui:sidebarToggle',
    PANEL_TOGGLE: 'ui:panelToggle',
    MONITOR_TOGGLE: 'ui:monitorToggle',
    UI_TOGGLE: 'ui:toggle',
    PROBE_TOGGLE: 'ui:probeToggle',

    // Interaction
    CANVAS_CLICK: 'interact:click',
    CANVAS_MOVE: 'interact:move',
    SPAWN_MODE: 'interact:spawnMode',
    SPAWN_CANCEL: 'interact:spawnCancel',

    // Scenario
    SCENARIO_LOAD: 'scenario:load',
};
