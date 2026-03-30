// event-bus.js — Lightweight pub/sub for decoupled module communication

class EventBus {
    constructor() {
        this._listeners = {};
    }

    on(event, callback) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        const list = this._listeners[event];
        if (!list) return;
        const idx = list.indexOf(callback);
        if (idx !== -1) list.splice(idx, 1);
    }

    emit(event, data) {
        const list = this._listeners[event];
        if (!list) return;
        for (let i = 0; i < list.length; i++) {
            list[i](data);
        }
    }
}

export const bus = new EventBus();
