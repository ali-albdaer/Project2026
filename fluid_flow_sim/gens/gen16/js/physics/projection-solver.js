// projection-solver.js — Classic Chorin projection method for 2D incompressible Navier-Stokes
// Chain of fragment shader passes: advect → diffuse → divergence → pressure solve → project

import { SolverBase } from './solver-base.js';
import { generateMaskShader, packBodyUniforms } from './bodies.js';

const ADVECT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uObs;
uniform float uDt;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec4 v = texture(uVel, uv);
    if (texture(uObs, uv).r > 0.5) { fragColor = vec4(0); return; }
    // Semi-Lagrangian: trace back
    vec2 pos = uv - v.xy * uDt * uTexel;
    pos = clamp(pos, uTexel, 1.0 - uTexel);
    fragColor = texture(uVel, pos);
}`;

const DIFFUSE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uObs;
uniform float uAlpha;
uniform float uRBeta;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec2 uv = gl_FragCoord.xy * uTexel;
    if (texture(uObs, uv).r > 0.5) { fragColor = vec4(0); return; }
    vec4 cL = texelFetch(uVel, c - ivec2(1,0), 0);
    vec4 cR = texelFetch(uVel, c + ivec2(1,0), 0);
    vec4 cB = texelFetch(uVel, c - ivec2(0,1), 0);
    vec4 cT = texelFetch(uVel, c + ivec2(0,1), 0);
    vec4 cC = texelFetch(uVel, c, 0);
    fragColor = (cL + cR + cB + cT + uAlpha * cC) * uRBeta;
}`;

const DIVERGENCE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    float uR = texelFetch(uVel, c + ivec2(1,0), 0).x;
    float uL = texelFetch(uVel, c - ivec2(1,0), 0).x;
    float vT = texelFetch(uVel, c + ivec2(0,1), 0).y;
    float vB = texelFetch(uVel, c - ivec2(0,1), 0).y;
    float div = 0.5 * (uR - uL + vT - vB);
    fragColor = vec4(div, 0.0, 0.0, 0.0);
}`;

const PRESSURE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPressure;
uniform sampler2D uDiv;
uniform sampler2D uObs;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec2 uv = gl_FragCoord.xy * uTexel;
    if (texture(uObs, uv).r > 0.5) { fragColor = vec4(0); return; }
    float pL = texelFetch(uPressure, c - ivec2(1,0), 0).x;
    float pR = texelFetch(uPressure, c + ivec2(1,0), 0).x;
    float pB = texelFetch(uPressure, c - ivec2(0,1), 0).x;
    float pT = texelFetch(uPressure, c + ivec2(0,1), 0).x;
    float d  = texelFetch(uDiv, c, 0).x;
    float p  = (pL + pR + pB + pT - d) * 0.25;
    fragColor = vec4(p, 0.0, 0.0, 0.0);
}`;

const PROJECT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uPressure;
uniform sampler2D uObs;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec2 uv = gl_FragCoord.xy * uTexel;
    if (texture(uObs, uv).r > 0.5) { fragColor = vec4(0); return; }
    float pR = texelFetch(uPressure, c + ivec2(1,0), 0).x;
    float pL = texelFetch(uPressure, c - ivec2(1,0), 0).x;
    float pT = texelFetch(uPressure, c + ivec2(0,1), 0).x;
    float pB = texelFetch(uPressure, c - ivec2(0,1), 0).x;
    vec4 v = texelFetch(uVel, c, 0);
    v.x -= 0.5 * (pR - pL);
    v.y -= 0.5 * (pT - pB);
    fragColor = v;
}`;

// Apply boundary conditions (inlet velocity, wall no-slip, outlet zero-gradient)
const BC_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uObs;
uniform vec2 uInlet;
uniform vec2 uTexel;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    ivec2 size = textureSize(uVel, 0);
    vec2 uv = gl_FragCoord.xy * uTexel;
    vec4 v = texelFetch(uVel, c, 0);

    if (c.x == 0) { v = vec4(uInlet, 0.0, 0.0); }
    else if (c.x == size.x - 1) { v = texelFetch(uVel, c - ivec2(1,0), 0); }
    if (c.y == 0 || c.y == size.y - 1) { v = vec4(0); }
    if (texture(uObs, uv).r > 0.5) { v = vec4(0); }

    fragColor = v;
}`;

// Copy velocity to output format (ux, uy, rho, 0) for compatibility with renderer
const OUTPUT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uVel;
uniform sampler2D uPressure;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec4 v = texelFetch(uVel, c, 0);
    float p = texelFetch(uPressure, c, 0).x;
    // Output format matching LBM: (_, rho_proxy, ux, uy)
    // We store pressure as rho-like quantity
    fragColor = vec4(0.0, 1.0 + p, v.x, v.y);
}`;

const CURL_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uFlow;
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    float uxT = texelFetch(uFlow, c + ivec2(0,1), 0).b;
    float uxB = texelFetch(uFlow, c - ivec2(0,1), 0).b;
    float uyR = texelFetch(uFlow, c + ivec2(1,0), 0).a;
    float uyL = texelFetch(uFlow, c - ivec2(1,0), 0).a;
    float curl = (uyR - uyL) - (uxT - uxB);
    vec4 here = texelFetch(uFlow, c, 0);
    float speed = length(vec2(here.b, here.a));
    fragColor = vec4(curl, speed, here.g, 0.0);
}`;

export class ProjectionSolver extends SolverBase {
    constructor() {
        super();
        this.viscosity = 0.01;
        this.inletU = [0.1, 0.0];
        this.dt = 1.0;
        this.jacobiIterations = 40;
        this.diffuseIterations = 10;
        this.gpu = null;
        this._programs = {};
        this._flip = false;
    }

    init(gpu, width, height, params = {}) {
        this.gpu = gpu;
        this.width = width;
        this.height = height;
        if (params.viscosity !== undefined) this.viscosity = params.viscosity;
        if (params.inletU) this.inletU = params.inletU;
        if (params.jacobiIterations) this.jacobiIterations = params.jacobiIterations;

        this._createResources();
        this._compileShaders();
        this.reset();
    }

    _createResources() {
        const gpu = this.gpu;
        const w = this.width, h = this.height;

        // Double-buffered velocity: (ux, uy, 0, 0)
        this._velA = gpu.createTexture32F(w, h);
        this._velB = gpu.createTexture32F(w, h);
        this._velFboA = gpu.createFBO([this._velA]);
        this._velFboB = gpu.createFBO([this._velB]);

        // Double-buffered pressure
        this._presA = gpu.createTexture32F(w, h);
        this._presB = gpu.createTexture32F(w, h);
        this._presFboA = gpu.createFBO([this._presA]);
        this._presFboB = gpu.createFBO([this._presB]);

        // Divergence (single)
        this._divTex = gpu.createTexture32F(w, h);
        this._divFbo = gpu.createFBO([this._divTex]);

        // Output flow texture (compatible format with LBM)
        this._flowTex = gpu.createTexture32F(w, h);
        this._flowFbo = gpu.createFBO([this._flowTex]);

        // Obstacle mask
        this._obsTex = gpu.createTexture8(w, h);
        this._obsFbo = gpu.createFBO([this._obsTex]);

        // Curl
        this._curlTex = gpu.createTexture32F(w, h);
        this._curlFbo = gpu.createFBO([this._curlTex]);
    }

    _compileShaders() {
        const gpu = this.gpu;
        this._programs.advect = gpu.createProgram(ADVECT_FRAG);
        this._programs.diffuse = gpu.createProgram(DIFFUSE_FRAG);
        this._programs.divergence = gpu.createProgram(DIVERGENCE_FRAG);
        this._programs.pressure = gpu.createProgram(PRESSURE_FRAG);
        this._programs.project = gpu.createProgram(PROJECT_FRAG);
        this._programs.bc = gpu.createProgram(BC_FRAG);
        this._programs.output = gpu.createProgram(OUTPUT_FRAG);
        this._programs.curl = gpu.createProgram(CURL_FRAG);
        this._programs.mask = gpu.createProgram(generateMaskShader());
    }

    reset() {
        const gpu = this.gpu;
        const gl = gpu.gl;
        const w = this.width, h = this.height;

        // Initialize velocity to inlet value everywhere
        const initFrag = `#version 300 es
precision highp float;
uniform vec2 uInlet;
out vec4 fragColor;
void main() { fragColor = vec4(uInlet, 0.0, 0.0); }`;
        const initProg = gpu.createProgram(initFrag);
        gpu.quad(initProg, { uInlet: this.inletU }, this._velFboA, w, h);
        gpu.quad(initProg, { uInlet: this.inletU }, this._velFboB, w, h);

        // Clear pressure
        const clearFrag = `#version 300 es
precision highp float;
out vec4 fragColor;
void main() { fragColor = vec4(0); }`;
        const clearProg = gpu.createProgram(clearFrag);
        gpu.quad(clearProg, {}, this._presFboA, w, h);
        gpu.quad(clearProg, {}, this._presFboB, w, h);

        this._flip = false;
    }

    step() {
        if (this.paused) return;

        const gpu = this.gpu;
        const w = this.width, h = this.height;
        const texel = [1.0 / w, 1.0 / h];

        // Current velocity source
        let velRead = this._flip ? this._velB : this._velA;
        let velWrite = this._flip ? this._velFboA : this._velFboB;
        let velWriteTex = this._flip ? this._velA : this._velB;

        // 1. Advection (Semi-Lagrangian)
        gpu.quad(this._programs.advect, {
            uVel: velRead, uObs: this._obsTex, uDt: this.dt, uTexel: texel
        }, velWrite, w, h);

        // Swap
        [velRead, velWriteTex] = [velWriteTex, velRead];
        velWrite = (velRead === this._velA) ? this._velFboB : this._velFboA;

        // 2. Diffusion (Jacobi iterations)
        const alpha = 1.0 / (this.viscosity * this.dt);
        const rBeta = 1.0 / (4.0 + alpha);
        for (let i = 0; i < this.diffuseIterations; i++) {
            gpu.quad(this._programs.diffuse, {
                uVel: velRead, uObs: this._obsTex, uAlpha: alpha, uRBeta: rBeta, uTexel: texel
            }, velWrite, w, h);
            // Swap
            const tmp = velRead;
            velRead = (velWrite === this._velFboA) ? this._velA : this._velB;
            velWrite = (tmp === this._velA) ? this._velFboA : this._velFboB;
        }

        // 3. Apply BC before pressure solve
        const velAfterBC = (velRead === this._velA) ? this._velFboB : this._velFboA;
        gpu.quad(this._programs.bc, {
            uVel: velRead, uObs: this._obsTex, uInlet: this.inletU, uTexel: texel
        }, velAfterBC, w, h);
        velRead = (velAfterBC === this._velFboA) ? this._velA : this._velB;

        // 4. Compute divergence
        gpu.quad(this._programs.divergence, {
            uVel: velRead, uTexel: texel
        }, this._divFbo, w, h);

        // 5. Pressure solve (Jacobi iterations)
        let presRead = this._presA;
        let presWrite = this._presFboB;
        for (let i = 0; i < this.jacobiIterations; i++) {
            gpu.quad(this._programs.pressure, {
                uPressure: presRead, uDiv: this._divTex, uObs: this._obsTex, uTexel: texel
            }, presWrite, w, h);
            // Swap
            if (presRead === this._presA) {
                presRead = this._presB;
                presWrite = this._presFboA;
            } else {
                presRead = this._presA;
                presWrite = this._presFboB;
            }
        }

        // 6. Project: subtract pressure gradient from velocity
        const projWrite = (velRead === this._velA) ? this._velFboB : this._velFboA;
        gpu.quad(this._programs.project, {
            uVel: velRead, uPressure: presRead, uObs: this._obsTex, uTexel: texel
        }, projWrite, w, h);
        const finalVelTex = (projWrite === this._velFboA) ? this._velA : this._velB;

        // 7. Apply BC again
        const finalBCFbo = (finalVelTex === this._velA) ? this._velFboB : this._velFboA;
        gpu.quad(this._programs.bc, {
            uVel: finalVelTex, uObs: this._obsTex, uInlet: this.inletU, uTexel: texel
        }, finalBCFbo, w, h);

        // 8. Generate output texture in standard format
        const bcResultTex = (finalBCFbo === this._velFboA) ? this._velA : this._velB;
        gpu.quad(this._programs.output, {
            uVel: bcResultTex, uPressure: presRead
        }, this._flowFbo, w, h);

        // Track which side has the latest velocity
        this._flip = (bcResultTex === this._velB);
    }

    computeCurl() {
        const gpu = this.gpu;
        gpu.quad(this._programs.curl, {
            uFlow: this._flowTex
        }, this._curlFbo, this.width, this.height);
    }

    updateObstacleMask(bodies) {
        const gpu = this.gpu;
        const gl = gpu.gl;
        const w = this.width, h = this.height;
        const packed = packBodyUniforms(bodies);
        const prog = this._programs.mask;
        const aspect = w / h;

        gl.useProgram(prog);
        gpu.setUniformInt(prog, 'uBodyCount', packed.count);
        gpu.setUniform4fv(prog, 'uBodyPosRot', packed.posRot);
        gpu.setUniform4fv(prog, 'uBodyParam1', packed.param1);
        gpu.setUniform4fv(prog, 'uBodyParam2', packed.param2);

        gpu.quad(prog, {
            uResolution: [w, h],
            uAspect: aspect
        }, this._obsFbo, w, h);
    }

    resize(width, height) {
        this._destroyResources();
        this.width = width;
        this.height = height;
        this._createResources();
        this.reset();
    }

    setInletVelocity(ux, uy) { this.inletU = [ux, uy]; }
    setViscosity(nu) { this.viscosity = nu; }
    getViscosity() { return this.viscosity; }
    getFlowTexture() { return this._flowTex; }
    getFlowFBO() { return this._flowFbo; }
    getCurlTexture() { return this._curlTex; }
    getObstacleTexture() { return this._obsTex; }

    _destroyResources() {
        const gpu = this.gpu;
        [this._velA,this._velB,this._presA,this._presB,this._divTex,this._flowTex,this._obsTex,this._curlTex]
            .forEach(t => gpu.deleteTexture(t));
        [this._velFboA,this._velFboB,this._presFboA,this._presFboB,this._divFbo,this._flowFbo,this._obsFbo,this._curlFbo]
            .forEach(f => gpu.deleteFBO(f));
    }

    destroy() { this._destroyResources(); }
}
