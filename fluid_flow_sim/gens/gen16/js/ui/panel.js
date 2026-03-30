// panel.js — Collapsible left panel framework with accordion sections

import { bus } from '../core/event-bus.js';

export class Panel {
    constructor() {
        this.el = document.getElementById('panel');
        this.content = document.getElementById('panel-content');
        this.toggleBtn = document.getElementById('panel-toggle');
        this.collapsed = false;
        this._init();
    }

    _init() {
        // Panel toggle
        this.toggleBtn.addEventListener('click', () => this.toggle());

        // Section headers (accordion)
        const headers = this.el.querySelectorAll('.section-header');
        headers.forEach(h => {
            h.addEventListener('click', () => {
                const section = h.closest('.panel-section');
                section.classList.toggle('collapsed');
            });
        });

        // Start with all sections expanded
        document.body.classList.add('panel-open');
    }

    toggle() {
        this.collapsed = !this.collapsed;
        this.el.classList.toggle('collapsed', this.collapsed);
        document.body.classList.toggle('panel-open', !this.collapsed);
        bus.emit('panel-toggled', this.collapsed);
    }

    show() {
        this.collapsed = false;
        this.el.classList.remove('collapsed');
        document.body.classList.add('panel-open');
    }

    hide() {
        this.collapsed = true;
        this.el.classList.add('collapsed');
        document.body.classList.remove('panel-open');
    }
}

/* ───── UI Builder Helpers ───── */

export function makeSlider(label, min, max, value, step, onChange) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const lbl = document.createElement('span');
    lbl.className = 'ctrl-label';
    lbl.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = value;

    const val = document.createElement('span');
    val.className = 'ctrl-value';
    val.textContent = Number(value).toPrecision(3);

    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        val.textContent = v < 0.01 ? v.toExponential(1) : Number(v).toPrecision(3);
        onChange(v);
    });

    row.append(lbl, slider, val);
    return { row, slider, val };
}

export function makeSelect(label, options, value, onChange) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const lbl = document.createElement('span');
    lbl.className = 'ctrl-label';
    lbl.textContent = label;

    const select = document.createElement('select');
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = typeof opt === 'object' ? opt.value : opt;
        o.textContent = typeof opt === 'object' ? opt.label : opt;
        if (o.value === value) o.selected = true;
        select.appendChild(o);
    });

    select.addEventListener('change', () => onChange(select.value));

    row.append(lbl, select);
    return { row, select };
}

export function makeCheckbox(label, checked, onChange) {
    const row = document.createElement('label');
    row.className = 'checkbox-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.addEventListener('change', () => onChange(cb.checked));

    const span = document.createElement('span');
    span.textContent = label;

    row.append(cb, span);
    return { row, checkbox: cb };
}

export function makeNumberInput(label, value, step, onChange) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const lbl = document.createElement('span');
    lbl.className = 'ctrl-label';
    lbl.textContent = label;

    const input = document.createElement('input');
    input.type = 'number';
    input.value = value;
    input.step = step;
    input.addEventListener('change', () => onChange(parseFloat(input.value)));

    row.append(lbl, input);
    return { row, input };
}

export function makeTextInput(label, value, onChange) {
    const row = document.createElement('div');
    row.className = 'ctrl-row';

    const lbl = document.createElement('span');
    lbl.className = 'ctrl-label';
    lbl.textContent = label;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fn-input';
    input.value = value;
    input.addEventListener('change', () => onChange(input.value));

    row.append(lbl, input);
    return { row, input };
}

export function makeButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn ' + (className || '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

export function makeSubTitle(text) {
    const el = document.createElement('div');
    el.className = 'sub-title';
    el.textContent = text;
    return el;
}

export function makeDivider() {
    const el = document.createElement('div');
    el.className = 'divider';
    return el;
}
