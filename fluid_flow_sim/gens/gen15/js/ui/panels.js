// ────────────────────────────────────────────
// panels.js — Panel content builders
// ────────────────────────────────────────────
// Builds the DOM content for each sidebar panel.
// All inputs emit events via the EventBus.

import { bus, EVT } from '../events.js';
import {
    SOLVER_TYPE, COLLISION, TURB_MODEL, SHAPE, SHAPE_NAMES,
    SHAPE_DEFAULTS, FIELD, COLORMAP, DEFAULT_CONFIG
} from '../config.js';

// ── Helpers ──────────────────────────────────

function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
}

function row(label, input) {
    const r = el('div', 'field-row');
    const l = el('label', 'field-label', label);
    r.appendChild(l);
    r.appendChild(input);
    return r;
}

function slider(id, min, max, step, value, onChange) {
    const wrap = el('div', 'slider-wrap');
    const inp = document.createElement('input');
    inp.type = 'range'; inp.id = id;
    inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    const val = el('span', 'slider-value', String(value));
    val.id = id + '-val';
    inp.addEventListener('input', () => {
        val.textContent = inp.value;
        onChange(parseFloat(inp.value));
    });
    wrap.appendChild(inp);
    wrap.appendChild(val);
    return wrap;
}

function select(id, options, value, onChange) {
    const sel = document.createElement('select');
    sel.id = id;
    for (const [val, label] of options) {
        const opt = document.createElement('option');
        opt.value = val; opt.textContent = label;
        if (val === value) opt.selected = true;
        sel.appendChild(opt);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    return sel;
}

function checkbox(id, label, checked, onChange) {
    const wrap = el('div', 'checkbox-row');
    const inp = document.createElement('input');
    inp.type = 'checkbox'; inp.id = id; inp.checked = checked;
    inp.addEventListener('change', () => onChange(inp.checked));
    const lab = el('label', 'checkbox-label', label);
    lab.setAttribute('for', id);
    wrap.appendChild(inp);
    wrap.appendChild(lab);
    return wrap;
}

function numberInput(id, value, onChange, step = null) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.id = id; inp.value = value;
    inp.className = 'num-input';
    if (step) inp.step = step;
    inp.addEventListener('change', () => onChange(parseFloat(inp.value)));
    return inp;
}

function textInput(id, value, placeholder, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.id = id; inp.value = value || '';
    inp.className = 'text-input';
    inp.placeholder = placeholder;
    inp.addEventListener('change', () => onChange(inp.value));
    return inp;
}

function button(id, label, onClick) {
    const btn = document.createElement('button');
    btn.id = id; btn.textContent = label;
    btn.className = 'panel-btn';
    btn.addEventListener('click', onClick);
    return btn;
}

function separator() {
    return el('div', 'separator');
}

// ── Panel 1: Simulation Settings ─────────────

export function buildSimPanel(config, onConfigChange) {
    const wrap = el('div', 'panel-inner');

    // Resolution
    wrap.appendChild(row('Resolution',
        slider('res-slider', 64, 1024, 1, config.nx, (v) => {
            // Round to power-of-2 friendly values
            const rounded = Math.round(v);
            onConfigChange({ nx: rounded, ny: Math.round(rounded / 2) });
        })
    ));

    // Solver type
    wrap.appendChild(row('Solver',
        select('solver-type', [
            [SOLVER_TYPE.LBM, 'Lattice Boltzmann'],
            [SOLVER_TYPE.PROJECTION, 'Projection (NS)'],
        ], config.solverType, (v) => onConfigChange({ solverType: v }))
    ));

    // Collision operator (LBM only)
    wrap.appendChild(row('Collision',
        select('collision', [
            [COLLISION.BGK, 'BGK'],
            [COLLISION.TRT, 'TRT'],
            [COLLISION.MRT, 'MRT'],
        ], config.collision, (v) => onConfigChange({ collision: v }))
    ));

    // Turbulence model
    wrap.appendChild(row('Turbulence',
        select('turb-model', [
            [TURB_MODEL.NONE, 'None (Laminar)'],
            [TURB_MODEL.SMAGORINSKY, 'Smagorinsky SGS'],
        ], config.turbModel, (v) => onConfigChange({ turbModel: v }))
    ));

    // Smagorinsky constant
    wrap.appendChild(row('Cs',
        slider('smag-cs', 0.05, 0.3, 0.01, config.smagorinskyCs,
            (v) => onConfigChange({ smagorinskyCs: v }))
    ));

    wrap.appendChild(separator());

    // Assumptions
    wrap.appendChild(checkbox('periodic-y', 'Periodic BC (top/bottom)', config.periodicY,
        (v) => onConfigChange({ periodicY: v })));

    wrap.appendChild(separator());

    // Steps per frame
    wrap.appendChild(row('Steps/Frame',
        slider('steps-frame', 1, 20, 1, config.stepsPerFrame,
            (v) => onConfigChange({ stepsPerFrame: v }))
    ));

    // Controls
    const btnRow = el('div', 'btn-row');
    btnRow.appendChild(button('btn-pause', 'Pause', () => bus.emit(EVT.CONFIG_CHANGED, { paused: !config.paused })));
    btnRow.appendChild(button('btn-reset', 'Reset', () => bus.emit(EVT.SOLVER_RESET)));
    btnRow.appendChild(button('btn-step', 'Step', () => bus.emit(EVT.CONFIG_CHANGED, { singleStep: true })));
    wrap.appendChild(btnRow);

    return wrap;
}

// ── Panel 2: Flow Settings ───────────────────

export function buildFlowPanel(config, onConfigChange) {
    const wrap = el('div', 'panel-inner');

    // Free-stream velocity
    wrap.appendChild(row('U_inf',
        numberInput('u-inf', config.uInf, (v) => onConfigChange({ uInf: v }), 0.005)
    ));

    // Velocity function
    wrap.appendChild(row('u(x,y)',
        textInput('u-func', config.uInfFunction, 'e.g. U*(1-y*y/100)', (v) => {
            onConfigChange({ uInfFunction: v || null });
        })
    ));

    wrap.appendChild(separator());

    // Kinematic viscosity
    wrap.appendChild(row('Viscosity (v)',
        numberInput('viscosity', config.viscosity, (v) => onConfigChange({ viscosity: v }), 0.001)
    ));

    // Density
    wrap.appendChild(row('Density (rho)',
        numberInput('density', config.density, (v) => onConfigChange({ density: v }), 0.1)
    ));

    wrap.appendChild(separator());

    // Reynolds number (computed, display only)
    const reDisplay = el('div', 'field-row');
    reDisplay.innerHTML = `<label class="field-label">Re</label><span class="computed-value" id="re-display">--</span>`;
    wrap.appendChild(reDisplay);

    return wrap;
}

// ── Panel 3: Body Settings ───────────────────

export function buildBodyPanel(config, bodyManager, onConfigChange) {
    const wrap = el('div', 'panel-inner');

    // Body type selector + add button
    const addRow = el('div', 'add-body-row');
    const typeSelect = select('body-type',
        Object.entries(SHAPE_NAMES).map(([k, v]) => [k, v]),
        SHAPE.CIRCLE, () => {}
    );
    addRow.appendChild(typeSelect);
    addRow.appendChild(button('btn-add-body', 'Add', () => {
        bus.emit(EVT.SPAWN_MODE, { type: typeSelect.value });
    }));
    wrap.appendChild(addRow);

    wrap.appendChild(separator());

    // Body list
    const list = el('div', 'body-list');
    list.id = 'body-list';
    wrap.appendChild(list);

    // Selected body editor
    const editor = el('div', 'body-editor');
    editor.id = 'body-editor';
    editor.style.display = 'none';
    wrap.appendChild(editor);

    // Listen for body changes to rebuild list
    bus.on(EVT.BODIES_CHANGED, () => updateBodyList(list, bodyManager));
    bus.on(EVT.BODY_SELECTED, () => updateBodyEditor(editor, bodyManager, onConfigChange));

    return wrap;
}

function updateBodyList(listEl, bodyManager) {
    listEl.innerHTML = '';
    for (const body of bodyManager.bodies) {
        const item = el('div', 'body-item');
        item.dataset.id = body.id;
        if (body.id === bodyManager.selectedId) item.classList.add('selected');
        item.innerHTML = `<span class="body-name">${SHAPE_NAMES[body.type] || body.type} #${body.id}</span>`;
        item.addEventListener('click', () => bodyManager.select(body.id));

        const removeBtn = button(`rm-body-${body.id}`, 'X', (e) => {
            e.stopPropagation();
            bodyManager.removeBody(body.id);
        });
        removeBtn.className = 'body-remove-btn';
        item.appendChild(removeBtn);

        listEl.appendChild(item);
    }
}

function updateBodyEditor(editorEl, bodyManager, onConfigChange) {
    const body = bodyManager.getSelected();
    editorEl.style.display = body ? 'block' : 'none';
    if (!body) return;

    editorEl.innerHTML = '';
    const title = el('div', 'editor-title', `${SHAPE_NAMES[body.type]} #${body.id}`);
    editorEl.appendChild(title);

    // Position
    editorEl.appendChild(row('X',
        numberInput(`body-x-${body.id}`, Math.round(body.x), (v) => {
            body.setPosition(v, body.y);
            bus.emit(EVT.BODY_MOVED, body);
        })
    ));
    editorEl.appendChild(row('Y',
        numberInput(`body-y-${body.id}`, Math.round(body.y), (v) => {
            body.setPosition(body.x, v);
            bus.emit(EVT.BODY_MOVED, body);
        })
    ));

    // Angle
    editorEl.appendChild(row('Angle',
        numberInput(`body-angle-${body.id}`, Math.round(body.angle * 180 / Math.PI), (v) => {
            body.setAngle(v * Math.PI / 180);
            bus.emit(EVT.BODY_MOVED, body);
        })
    ));

    editorEl.appendChild(separator());

    // Shape-specific parameters
    const defaults = SHAPE_DEFAULTS[body.type] || {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
        const currentVal = body.params[key] !== undefined ? body.params[key] : defaultVal;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

        if (typeof currentVal === 'string') {
            editorEl.appendChild(row(label,
                textInput(`body-${key}-${body.id}`, currentVal, '', (v) => {
                    body.setParams({ [key]: v });
                    bus.emit(EVT.BODY_UPDATED, body);
                })
            ));
        } else {
            editorEl.appendChild(row(label,
                numberInput(`body-${key}-${body.id}`, currentVal, (v) => {
                    body.setParams({ [key]: v });
                    bus.emit(EVT.BODY_UPDATED, body);
                })
            ));
        }
    }

    editorEl.appendChild(separator());
    editorEl.appendChild(button(`rm-sel-body`, 'Remove Body', () => {
        bodyManager.removeBody(body.id);
    }));
}

// ── Panel 4: Visual Settings ─────────────────

export function buildVisualPanel(config, onConfigChange) {
    const wrap = el('div', 'panel-inner');

    // Display quantity
    wrap.appendChild(row('Field',
        select('display-field', [
            [FIELD.VELOCITY, 'Velocity |u|'],
            [FIELD.PRESSURE, 'Pressure'],
            [FIELD.VORTICITY, 'Vorticity'],
            [FIELD.DENSITY, 'Density'],
            [FIELD.UX, 'Velocity u_x'],
            [FIELD.UY, 'Velocity u_y'],
        ], config.field, (v) => onConfigChange({ field: v }))
    ));

    // Colormap
    wrap.appendChild(row('Colormap',
        select('colormap', [
            [COLORMAP.VIRIDIS, 'Viridis'],
            [COLORMAP.MAGMA, 'Magma'],
            [COLORMAP.INFERNO, 'Inferno'],
            [COLORMAP.PLASMA, 'Plasma'],
            [COLORMAP.JET, 'Jet'],
            [COLORMAP.COOLWARM, 'Coolwarm'],
            [COLORMAP.GRAYSCALE, 'Grayscale'],
        ], config.colormap, (v) => onConfigChange({ colormap: v }))
    ));

    wrap.appendChild(separator());

    // Show options
    wrap.appendChild(checkbox('show-bodies', 'Show Bodies', config.showBodies,
        (v) => onConfigChange({ showBodies: v })));

    wrap.appendChild(checkbox('show-bl', 'Show Boundary Layer', config.showBoundaryLayer,
        (v) => onConfigChange({ showBoundaryLayer: v })));

    // BL sub-options
    const blOpts = el('div', 'bl-options');
    blOpts.id = 'bl-options';
    blOpts.appendChild(checkbox('bl-delta', 'delta (99%)', config.blDelta,
        (v) => onConfigChange({ blDelta: v })));
    blOpts.appendChild(checkbox('bl-delta-star', 'delta* (displacement)', config.blDeltaStar,
        (v) => onConfigChange({ blDeltaStar: v })));
    blOpts.appendChild(checkbox('bl-theta', 'theta (momentum)', config.blTheta,
        (v) => onConfigChange({ blTheta: v })));
    wrap.appendChild(blOpts);

    wrap.appendChild(separator());

    wrap.appendChild(checkbox('probe-toggle', 'Probe Tool', config.probeEnabled,
        (v) => onConfigChange({ probeEnabled: v })));

    return wrap;
}
