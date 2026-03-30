// bodies.js — Body types, SDF library, body management, and GLSL obstacle mask generation

export const BODY_TYPES = {
    CIRCLE:      { name: 'Circle',      params: ['radius'] },
    RECTANGLE:   { name: 'Rectangle',   params: ['width', 'height'] },
    TRIANGLE:    { name: 'Triangle',    params: ['base', 'height'] },
    AIRFOIL:     { name: 'Airfoil',     params: ['chord', 'thickness', 'camber', 'camberPos'] },
    FLAT_PLATE:  { name: 'Flat Plate',  params: ['length', 'thickness'] },
    SEMICIRCLE:  { name: 'Semicircle',  params: ['radius'] },
    HEXAGON:     { name: 'Hexagon',     params: ['radius'] },
    OGIVE:       { name: 'Ogive',       params: ['length', 'radius'] },
    I_BEAM:      { name: 'I-Beam',      params: ['width', 'height', 'flange', 'web'] },
    T_BEAM:      { name: 'T-Beam',      params: ['width', 'height', 'flange', 'web'] },
    ROUNDED_RECT:{ name: 'Rounded Rect',params: ['width', 'height', 'cornerR'] },
    DIAMOND:     { name: 'Diamond',     params: ['width', 'height'] },
    ELLIPSE:     { name: 'Ellipse',     params: ['rx', 'ry'] },
    WEDGE:       { name: 'Wedge',       params: ['length', 'halfAngle'] },
    BICONVEX:    { name: 'Biconvex',    params: ['chord', 'thickness'] },
    FIGHTER:     { name: 'Fighter',     params: ['chord'] },
    AIRLINER:    { name: 'Airliner',    params: ['chord'] },
};

const DEFAULTS = {
    CIRCLE:       { radius: 0.06 },
    RECTANGLE:    { width: 0.1, height: 0.05 },
    TRIANGLE:     { base: 0.08, height: 0.07 },
    AIRFOIL:      { chord: 0.18, thickness: 0.12, camber: 0.02, camberPos: 0.4 },
    FLAT_PLATE:   { length: 0.2, thickness: 0.004 },
    SEMICIRCLE:   { radius: 0.05 },
    HEXAGON:      { radius: 0.05 },
    OGIVE:        { length: 0.15, radius: 0.2 },
    I_BEAM:       { width: 0.08, height: 0.1, flange: 0.015, web: 0.012 },
    T_BEAM:       { width: 0.08, height: 0.1, flange: 0.015, web: 0.012 },
    ROUNDED_RECT: { width: 0.1, height: 0.05, cornerR: 0.01 },
    DIAMOND:      { width: 0.06, height: 0.1 },
    ELLIPSE:      { rx: 0.07, ry: 0.04 },
    WEDGE:        { length: 0.12, halfAngle: 0.18 },
    BICONVEX:     { chord: 0.16, thickness: 0.05 },
    FIGHTER:      { chord: 0.15 },
    AIRLINER:     { chord: 0.15 },
};

let _nextId = 1;

export class Body {
    constructor(type, x = 0.3, y = 0.5, params = {}) {
        this.id = _nextId++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.rotation = 0; // radians
        this.params = { ...DEFAULTS[type], ...params };
        this.vx = 0; // velocity for moving boundary (lattice units/step)
        this.vy = 0;
        this.name = BODY_TYPES[type].name + ' ' + this.id;
    }
}

export class BodyManager {
    constructor() {
        /** @type {Body[]} */
        this.bodies = [];
        this.selectedId = -1;
        this.maxBodies = 16;
    }

    add(type, x, y, params) {
        if (this.bodies.length >= this.maxBodies) return null;
        const b = new Body(type, x, y, params);
        this.bodies.push(b);
        return b;
    }

    remove(id) {
        this.bodies = this.bodies.filter(b => b.id !== id);
        if (this.selectedId === id) this.selectedId = -1;
    }

    get(id) {
        return this.bodies.find(b => b.id === id) || null;
    }

    select(id) {
        this.selectedId = id;
    }

    getSelected() {
        return this.get(this.selectedId);
    }

    /**
     * Hit-test: find body at normalized position (nx, ny) in [0,1]x[0,1].
     * Uses JS-side SDF evaluation.
     */
    hitTest(nx, ny) {
        for (let i = this.bodies.length - 1; i >= 0; i--) {
            const b = this.bodies[i];
            if (sdfJS(b, nx, ny) < 0) return b;
        }
        return null;
    }

    clear() {
        this.bodies = [];
        this.selectedId = -1;
    }
}

/* ───────── JS-side SDF evaluation (for hit testing) ───────── */

function rot2d(px, py, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return [px * c + py * s, -px * s + py * c];
}

function sdfJS(body, nx, ny) {
    let px = nx - body.x, py = ny - body.y;
    [px, py] = rot2d(px, py, body.rotation);
    const p = body.params;
    const aspect = typeof window !== 'undefined' ? (window.innerWidth / window.innerHeight) : (16/9);
    px *= aspect; // Convert to physical aspect ratio

    switch (body.type) {
        case 'CIRCLE': return Math.sqrt(px*px + py*py) - p.radius;
        case 'ELLIPSE': {
            const ex = px/p.rx, ey = py/p.ry;
            return (Math.sqrt(ex*ex+ey*ey)-1.0)*Math.min(p.rx,p.ry);
        }
        case 'RECTANGLE': {
            const dx = Math.abs(px)-p.width/2, dy = Math.abs(py)-p.height/2;
            return Math.max(dx,dy);
        }
        case 'ROUNDED_RECT': {
            const dx = Math.abs(px)-p.width/2+p.cornerR, dy = Math.abs(py)-p.height/2+p.cornerR;
            const odx = Math.max(dx,0), ody = Math.max(dy,0);
            return Math.sqrt(odx*odx+ody*ody)+Math.min(Math.max(dx,dy),0)-p.cornerR;
        }
        case 'TRIANGLE': {
            const h = p.height, b2 = p.base/2;
            const ty = py + h/3;
            const d1 = -ty;
            const d2 = (h*px + b2*ty - h*b2) / Math.sqrt(h*h+b2*b2);
            const d3 = (-h*px + b2*ty - h*b2) / Math.sqrt(h*h+b2*b2);
            return Math.max(d1, d2, d3);
        }
        case 'FLAT_PLATE': {
            const dx = Math.abs(px)-p.length/2, dy = Math.abs(py)-p.thickness/2;
            return Math.max(dx,dy);
        }
        case 'SEMICIRCLE': {
            const d = Math.sqrt(px*px+py*py) - p.radius;
            return py > 0 ? d : Math.max(d, -py);
        }
        case 'HEXAGON': {
            const apx = Math.abs(px), apy = Math.abs(py);
            const d = Math.max(apx*0.866025+apy*0.5, apy) - p.radius;
            return d;
        }
        case 'DIAMOND': {
            const w2 = p.width/2, h2 = p.height/2;
            const d = (Math.abs(px)/w2 + Math.abs(py)/h2 - 1.0) * Math.min(w2,h2);
            return d;
        }
        case 'AIRFOIL': {
            const chord = p.chord;
            const lx = px / chord + 0.5;
            const x = Math.max(0, Math.min(1, lx));
            const t = p.thickness;
            const yt = 5*t*(0.2969*Math.sqrt(x)-0.1260*x-0.3516*x*x+0.2843*x*x*x-0.1015*x*x*x*x);
            const yc = computeCamber(x, p.camber, p.camberPos);
            const dy = Math.abs(py/chord - yc) - yt;
            if (lx < 0) return Math.sqrt(px*px+py*py);
            if (lx > 1) return Math.sqrt((px-chord*0.5)*(px-chord*0.5)+py*py);
            return dy * chord;
        }
        default: return Math.sqrt(px*px+py*py) - 0.05;
    }
}

function computeCamber(x, m, pp) {
    if (m < 0.001) return 0;
    if (x < pp) return m / (pp * pp) * (2 * pp * x - x * x);
    return m / ((1-pp)*(1-pp)) * ((1 - 2*pp) + 2*pp*x - x*x);
}

/* ───────── GLSL SDF code generation for obstacle mask shader ───────── */

export const MAX_BODIES = 16;

/**
 * Generate the complete fragment shader for the obstacle mask.
 * Bodies are passed via uniforms.
 */
export function generateMaskShader() {
    return `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2 uResolution;
uniform int uBodyCount;
uniform vec4 uBodyPosRot[${MAX_BODIES}];   // (x, y, rotation, type)
uniform vec4 uBodyParam1[${MAX_BODIES}];   // shape-specific params
uniform vec4 uBodyParam2[${MAX_BODIES}];   // additional params
uniform float uAspect;

vec2 rotate2d(vec2 p, float a) {
    float c = cos(a), s = sin(a);
    return vec2(p.x*c + p.y*s, -p.x*s + p.y*c);
}

float sdCircle(vec2 p, float r) { return length(p) - r; }

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdRoundBox(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + r;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

float sdTriangle(vec2 p, float base, float h) {
    float b2 = base * 0.5;
    vec2 q = vec2(abs(p.x), p.y + h/3.0);
    float d1 = -q.y;
    float d2 = (h*q.x + b2*q.y - h*b2) / sqrt(h*h + b2*b2);
    return max(d1, d2);
}

float sdSemicircle(vec2 p, float r) {
    float d = length(p) - r;
    return p.y > 0.0 ? d : max(d, -p.y);
}

float sdHexagon(vec2 p, float r) {
    vec2 ap = abs(p);
    return max(ap.x * 0.866025 + ap.y * 0.5, ap.y) - r;
}

float sdDiamond(vec2 p, vec2 b) {
    return (abs(p.x)/b.x + abs(p.y)/b.y - 1.0) * min(b.x, b.y);
}

float sdEllipse(vec2 p, vec2 r) {
    vec2 q = p / r;
    return (length(q) - 1.0) * min(r.x, r.y);
}

float nacaThickness(float x, float t) {
    return 5.0*t*(0.2969*sqrt(max(x,0.0)) - 0.1260*x - 0.3516*x*x + 0.2843*x*x*x - 0.1015*x*x*x*x);
}

float nacaCamber(float x, float m, float pp) {
    if (m < 0.001) return 0.0;
    if (x < pp) return m/(pp*pp) * (2.0*pp*x - x*x);
    return m/((1.0-pp)*(1.0-pp)) * ((1.0-2.0*pp) + 2.0*pp*x - x*x);
}

float sdAirfoil(vec2 p, float chord, float t, float m, float pp) {
    float lx = p.x / chord + 0.5;
    float x = clamp(lx, 0.0, 1.0);
    float yt = nacaThickness(x, t);
    float yc = nacaCamber(x, m, pp);
    float dy = abs(p.y/chord - yc) - yt;
    if (lx < 0.0) return length(p);
    if (lx > 1.0) return length(p - vec2(chord*0.5, 0.0));
    return dy * chord;
}

float sdOgive(vec2 p, float L, float R) {
    float rho = (R*R + L*L) / (2.0*R);
    float px = p.x + L*0.5;
    if (px < 0.0) return length(p + vec2(L*0.5, 0.0));
    if (px > L) return abs(p.y) - R;
    float d = length(vec2(px, p.y) - vec2(L, 0.0)) - rho;
    return max(d, -(abs(p.y) - R));
}

// I-beam: union of 3 rectangles
float sdIBeam(vec2 p, float w, float h, float tf, float tw) {
    float d1 = sdBox(p - vec2(0.0, h*0.5-tf*0.5), vec2(w*0.5, tf*0.5)); // top flange
    float d2 = sdBox(p + vec2(0.0, h*0.5-tf*0.5), vec2(w*0.5, tf*0.5)); // bottom flange
    float d3 = sdBox(p, vec2(tw*0.5, h*0.5)); // web
    return min(min(d1, d2), d3);
}

// T-beam: union of 2 rectangles
float sdTBeam(vec2 p, float w, float h, float tf, float tw) {
    float d1 = sdBox(p - vec2(0.0, h*0.5-tf*0.5), vec2(w*0.5, tf*0.5)); // top flange
    float d2 = sdBox(p + vec2(0.0, (h-tf)*0.25), vec2(tw*0.5, (h-tf)*0.5)); // web
    return min(d1, d2);
}

float sdWedge(vec2 p, float L, float ha) {
    float lx = p.x/L + 0.5;
    if (lx < 0.0) return length(p + vec2(L*0.5, 0.0));
    float yt = tan(ha) * max(L*0.5 - p.x, 0.0);
    return abs(p.y) - yt;
}

float sdBiconvex(vec2 p, float chord, float t) {
    float lx = p.x/chord + 0.5;
    float x = clamp(lx, 0.0, 1.0);
    // Parabolic arc
    float yt = 2.0 * t * x * (1.0 - x);
    if (lx < 0.0) return length(p + vec2(chord*0.5, 0.0));
    if (lx > 1.0) return length(p - vec2(chord*0.5, 0.0));
    return (abs(p.y) - yt * chord) ;
}

// Simplified fighter cross-section: a diamond with rounded nose
float sdFighter(vec2 p, float chord) {
    // Tapered diamond with slightly rounded front
    float w = chord * 0.12;
    float d1 = sdDiamond(p, vec2(chord*0.5, w));
    float nose = length(p + vec2(chord*0.45, 0.0)) - chord*0.05;
    return max(d1, -nose);
}

// Simplified airliner cross-section: elliptical fuselage
float sdAirliner(vec2 p, float chord) {
    float rx = chord * 0.5;
    float ry = chord * 0.35;
    return sdEllipse(p, vec2(rx, ry));
}

float evalSDF(int type, vec2 p, vec4 par1, vec4 par2) {
    // type mapping:
    // 0=circle, 1=rectangle, 2=triangle, 3=airfoil, 4=flat_plate
    // 5=semicircle, 6=hexagon, 7=ogive, 8=i_beam, 9=t_beam
    // 10=rounded_rect, 11=diamond, 12=ellipse, 13=wedge, 14=biconvex
    // 15=fighter, 16=airliner
    if (type == 0) return sdCircle(p, par1.x);
    if (type == 1) return sdBox(p, vec2(par1.x*0.5, par1.y*0.5));
    if (type == 2) return sdTriangle(p, par1.x, par1.y);
    if (type == 3) return sdAirfoil(p, par1.x, par1.y, par1.z, par1.w);
    if (type == 4) return sdBox(p, vec2(par1.x*0.5, par1.y*0.5));
    if (type == 5) return sdSemicircle(p, par1.x);
    if (type == 6) return sdHexagon(p, par1.x);
    if (type == 7) return sdOgive(p, par1.x, par1.y);
    if (type == 8) return sdIBeam(p, par1.x, par1.y, par1.z, par1.w);
    if (type == 9) return sdTBeam(p, par1.x, par1.y, par1.z, par1.w);
    if (type == 10) return sdRoundBox(p, vec2(par1.x*0.5, par1.y*0.5), par1.z);
    if (type == 11) return sdDiamond(p, vec2(par1.x*0.5, par1.y*0.5));
    if (type == 12) return sdEllipse(p, vec2(par1.x, par1.y));
    if (type == 13) return sdWedge(p, par1.x, par1.y);
    if (type == 14) return sdBiconvex(p, par1.x, par1.y);
    if (type == 15) return sdFighter(p, par1.x);
    if (type == 16) return sdAirliner(p, par1.x);
    return 1.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 pos = uv;
    pos.x *= uAspect;

    float minDist = 1e10;
    int hitBody = 0;
    vec2 hitNormal = vec2(0.0);

    for (int i = 0; i < ${MAX_BODIES}; i++) {
        if (i >= uBodyCount) break;
        vec4 pr = uBodyPosRot[i];
        int type = int(pr.w);
        vec2 bp = vec2(pr.x * uAspect, pr.y);
        vec2 lp = rotate2d(pos - bp, pr.z);
        float d = evalSDF(type, lp, uBodyParam1[i], uBodyParam2[i]);
        if (d < minDist) {
            minDist = d;
            hitBody = i + 1;
        }
    }

    // Compute normal via finite differences
    float solid = minDist < 0.0 ? 1.0 : 0.0;
    float eps = 1.0 / max(uResolution.x, uResolution.y);
    // Approximate normal (only computed for cells near surface)
    float nx = 0.0, ny = 0.0;
    if (abs(minDist) < eps * 3.0) {
        // Re-evaluate SDF at offset positions for gradient (we'll skip for perf and use 0)
        nx = 0.0; ny = 0.0;
    }

    fragColor = vec4(solid, float(hitBody) / 255.0, nx * 0.5 + 0.5, ny * 0.5 + 0.5);
}`;
}

// Type string → integer mapping for shader
const TYPE_INDEX = {
    CIRCLE: 0, RECTANGLE: 1, TRIANGLE: 2, AIRFOIL: 3, FLAT_PLATE: 4,
    SEMICIRCLE: 5, HEXAGON: 6, OGIVE: 7, I_BEAM: 8, T_BEAM: 9,
    ROUNDED_RECT: 10, DIAMOND: 11, ELLIPSE: 12, WEDGE: 13, BICONVEX: 14,
    FIGHTER: 15, AIRLINER: 16,
};

/**
 * Pack body data into uniform arrays for the mask shader.
 * @param {Body[]} bodies
 * @returns {{ posRot: Float32Array, param1: Float32Array, param2: Float32Array, count: number }}
 */
export function packBodyUniforms(bodies) {
    const n = Math.min(bodies.length, MAX_BODIES);
    const posRot = new Float32Array(MAX_BODIES * 4);
    const param1 = new Float32Array(MAX_BODIES * 4);
    const param2 = new Float32Array(MAX_BODIES * 4);

    for (let i = 0; i < n; i++) {
        const b = bodies[i];
        const o = i * 4;
        posRot[o]   = b.x;
        posRot[o+1] = b.y;
        posRot[o+2] = b.rotation;
        posRot[o+3] = TYPE_INDEX[b.type] || 0;

        const p = b.params;
        const pnames = BODY_TYPES[b.type].params;
        param1[o]   = p[pnames[0]] || 0;
        param1[o+1] = p[pnames[1]] || 0;
        param1[o+2] = p[pnames[2]] || 0;
        param1[o+3] = p[pnames[3]] || 0;
    }
    return { posRot, param1, param2, count: n };
}
