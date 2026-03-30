// lbm-solver.js — Lattice Boltzmann D2Q9 BGK solver (GPU-accelerated via WebGL2)
// Pull-scheme collision+streaming in a single MRT render pass.

import { SolverBase } from './solver-base.js';
import { generateMaskShader, packBodyUniforms, MAX_BODIES } from './bodies.js';

/* ════════════════ GLSL Shaders (inline) ════════════════ */

// Shared constants inserted into every LBM shader
const LBM_HEADER = `#version 300 es
precision highp float;

// D2Q9 velocity vectors
const vec2 e[9] = vec2[9](
    vec2( 0, 0), // 0: rest
    vec2( 1, 0), // 1: east
    vec2( 0, 1), // 2: north
    vec2(-1, 0), // 3: west
    vec2( 0,-1), // 4: south
    vec2( 1, 1), // 5: NE
    vec2(-1, 1), // 6: NW
    vec2(-1,-1), // 7: SW
    vec2( 1,-1)  // 8: SE
);

const float w[9] = float[9](
    4.0/9.0,
    1.0/9.0, 1.0/9.0, 1.0/9.0, 1.0/9.0,
    1.0/36.0, 1.0/36.0, 1.0/36.0, 1.0/36.0
);

// Opposite direction indices for bounce-back
const int opp[9] = int[9](0, 3, 4, 1, 2, 7, 8, 5, 6);

float feq(int i, float rho, vec2 u) {
    float eu = dot(e[i], u);
    float uu = dot(u, u);
    return w[i] * rho * (1.0 + 3.0*eu + 4.5*eu*eu - 1.5*uu);
}
`;

// ─── Collision + Streaming (combined, pull scheme) ───
const COLLIDE_STREAM_FRAG = LBM_HEADER + `
uniform sampler2D uTex0;  // (f0, f1, f2, f3)
uniform sampler2D uTex1;  // (f4, f5, f6, f7)
uniform sampler2D uTex2;  // (f8, rho, ux, uy)
uniform sampler2D uObstacle;
uniform float uTau;
uniform vec2 uInlet;      // inlet velocity (ux, uy) in lattice units
uniform int uBCLeft;      // 0=zou-he velocity, 1=periodic
uniform int uBCTopBot;    // 0=no-slip, 1=periodic

layout(location=0) out vec4 out0; // (f0, f1, f2, f3)
layout(location=1) out vec4 out1; // (f4, f5, f6, f7)
layout(location=2) out vec4 out2; // (f8, rho, ux, uy)

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);
    ivec2 size = textureSize(uTex0, 0);
    int W = size.x, H = size.y;

    // Check obstacle at current cell
    vec4 obs = texelFetch(uObstacle, coord, 0);
    bool isSolid = obs.r > 0.5;

    // Pull distributions from neighbors (streaming)
    // f_i at (x,y) came from (x - e_i.x, y - e_i.y)
    // Handle boundary wrapping
    float f[9];

    // f0: rest (0,0) → pull from self
    f[0] = texelFetch(uTex0, coord, 0).r;
    // f1: east (1,0) → pull from (x-1, y)
    { ivec2 s = coord + ivec2(-1,0); if(s.x<0) s.x=(uBCLeft==1)?W-1:0; f[1] = texelFetch(uTex0, s, 0).g; }
    // f2: north (0,1) → pull from (x, y-1)
    { ivec2 s = coord + ivec2(0,-1); if(s.y<0) s.y=(uBCTopBot==1)?H-1:0; f[2] = texelFetch(uTex0, s, 0).b; }
    // f3: west (-1,0) → pull from (x+1, y)
    { ivec2 s = coord + ivec2(1,0); if(s.x>=W) s.x=(uBCLeft==1)?0:W-1; f[3] = texelFetch(uTex0, s, 0).a; }
    // f4: south (0,-1) → pull from (x, y+1)
    { ivec2 s = coord + ivec2(0,1); if(s.y>=H) s.y=(uBCTopBot==1)?0:H-1; f[4] = texelFetch(uTex1, s, 0).r; }
    // f5: NE (1,1) → pull from (x-1, y-1)
    { ivec2 s = coord + ivec2(-1,-1);
      if(s.x<0) s.x=(uBCLeft==1)?W-1:0; if(s.y<0) s.y=(uBCTopBot==1)?H-1:0;
      f[5] = texelFetch(uTex1, s, 0).g; }
    // f6: NW (-1,1) → pull from (x+1, y-1)
    { ivec2 s = coord + ivec2(1,-1);
      if(s.x>=W) s.x=(uBCLeft==1)?0:W-1; if(s.y<0) s.y=(uBCTopBot==1)?H-1:0;
      f[6] = texelFetch(uTex1, s, 0).b; }
    // f7: SW (-1,-1) → pull from (x+1, y+1)
    { ivec2 s = coord + ivec2(1,1);
      if(s.x>=W) s.x=(uBCLeft==1)?0:W-1; if(s.y>=H) s.y=(uBCTopBot==1)?0:H-1;
      f[7] = texelFetch(uTex1, s, 0).a; }
    // f8: SE (1,-1) → pull from (x-1, y+1)
    { ivec2 s = coord + ivec2(-1,1);
      if(s.x<0) s.x=(uBCLeft==1)?W-1:0; if(s.y>=H) s.y=(uBCTopBot==1)?0:H-1;
      f[8] = texelFetch(uTex2, s, 0).r; }

    // ── Boundary conditions ──
    bool isInlet  = (coord.x == 0);
    bool isOutlet = (coord.x == W - 1);
    bool isBottom = (coord.y == 0 && uBCTopBot == 0);
    bool isTop    = (coord.y == H - 1 && uBCTopBot == 0);

    if (isSolid) {
        // Bounce-back: reverse all distributions
        float tmp[9];
        for (int i = 0; i < 9; i++) tmp[i] = f[i];
        for (int i = 0; i < 9; i++) f[i] = tmp[opp[i]];
        // Macroscopic at wall: zero velocity, unit density
        float rho = 1.0;
        for (int i = 0; i < 9; i++) rho += 0.0; // already bounced
        out0 = vec4(f[0], f[1], f[2], f[3]);
        out1 = vec4(f[4], f[5], f[6], f[7]);
        out2 = vec4(f[8], 1.0, 0.0, 0.0);
        return;
    }

    if (isInlet) {
        // Zou-He velocity inlet BC
        vec2 uIn = uInlet;
        float rho_in = (f[0] + f[2] + f[4] + 2.0*(f[3] + f[6] + f[7])) / (1.0 - uIn.x);
        f[1] = f[3] + (2.0/3.0) * rho_in * uIn.x;
        f[5] = f[7] - 0.5*(f[2] - f[4]) + 0.5*rho_in*uIn.y + (1.0/6.0)*rho_in*uIn.x;
        f[8] = f[6] + 0.5*(f[2] - f[4]) - 0.5*rho_in*uIn.y + (1.0/6.0)*rho_in*uIn.x;
        float rho = 0.0;
        for (int i = 0; i < 9; i++) rho += f[i];
        out0 = vec4(f[0], f[1], f[2], f[3]);
        out1 = vec4(f[4], f[5], f[6], f[7]);
        out2 = vec4(f[8], rho, uIn.x, uIn.y);
        return;
    }

    if (isOutlet) {
        // Zero-gradient (extrapolation) outlet
        // Copy from interior cell (x-1)
        ivec2 interior = ivec2(coord.x - 1, coord.y);
        vec4 t0 = texelFetch(uTex0, interior, 0);
        vec4 t1 = texelFetch(uTex1, interior, 0);
        vec4 t2 = texelFetch(uTex2, interior, 0);
        out0 = t0; out1 = t1; out2 = t2;
        return;
    }

    if (isTop || isBottom) {
        // No-slip bounce-back for top/bottom walls
        float tmp[9];
        for (int i = 0; i < 9; i++) tmp[i] = f[i];
        for (int i = 0; i < 9; i++) f[i] = tmp[opp[i]];
        out0 = vec4(f[0], f[1], f[2], f[3]);
        out1 = vec4(f[4], f[5], f[6], f[7]);
        out2 = vec4(f[8], 1.0, 0.0, 0.0);
        return;
    }

    // ── Interior: compute macroscopic quantities ──
    float rho = 0.0;
    vec2 u = vec2(0.0);
    for (int i = 0; i < 9; i++) {
        rho += f[i];
        u += f[i] * e[i];
    }
    u /= max(rho, 1e-10);

    // Clamp velocity for stability
    float speed = length(u);
    if (speed > 0.3) u *= 0.3 / speed;

    // ── BGK collision ──
    float invTau = 1.0 / uTau;
    for (int i = 0; i < 9; i++) {
        float fi_eq = feq(i, rho, u);
        f[i] = f[i] - (f[i] - fi_eq) * invTau;
    }

    out0 = vec4(f[0], f[1], f[2], f[3]);
    out1 = vec4(f[4], f[5], f[6], f[7]);
    out2 = vec4(f[8], rho, u.x, u.y);
}`;

// ─── Initialize to equilibrium ───
const INIT_EQ_FRAG = LBM_HEADER + `
uniform vec2 uVelocity;
uniform float uDensity;
layout(location=0) out vec4 out0;
layout(location=1) out vec4 out1;
layout(location=2) out vec4 out2;

void main() {
    float rho = uDensity;
    vec2 u = uVelocity;
    float f[9];
    for (int i = 0; i < 9; i++) f[i] = feq(i, rho, u);
    out0 = vec4(f[0], f[1], f[2], f[3]);
    out1 = vec4(f[4], f[5], f[6], f[7]);
    out2 = vec4(f[8], rho, u.x, u.y);
}`;

// ─── Compute curl (vorticity) ───
const CURL_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uFlow; // tex2: (f8, rho, ux, uy)
out vec4 fragColor;
void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    float uxT = texelFetch(uFlow, c + ivec2(0,1), 0).b;
    float uxB = texelFetch(uFlow, c - ivec2(0,1), 0).b;
    float uyR = texelFetch(uFlow, c + ivec2(1,0), 0).a;
    float uyL = texelFetch(uFlow, c - ivec2(1,0), 0).a;
    float curl = (uyR - uyL) - (uxT - uxB);
    // Also store speed for convenience
    vec4 here = texelFetch(uFlow, c, 0);
    float speed = length(vec2(here.b, here.a));
    fragColor = vec4(curl, speed, here.g, 0.0); // curl, speed, rho, 0
}`;

/* ════════════════ Solver Class ════════════════ */

export class LBMSolver extends SolverBase {
    constructor() {
        super();
        this.tau = 0.6;
        this.inletU = [0.1, 0.0];
        this.density = 1.0;
        this.bcLeft = 0; // 0=zou-he, 1=periodic
        this.bcTopBot = 0; // 0=no-slip, 1=periodic
        this.gpu = null;
        this._dfbo = null;   // distribution double FBO
        this._obsTex = null; // obstacle mask texture
        this._obsFbo = null;
        this._curlTex = null;
        this._curlFbo = null;
        this._flowFboA = null; // FBO for reading flow tex (tex2 of A side)
        this._flowFboB = null;
        this._programs = {};
        this._flip = false;  // ping-pong state
        this._prevObsTex = null; // for detecting newly solid/freed cells
    }

    init(gpu, width, height, params = {}) {
        this.gpu = gpu;
        this.width = width;
        this.height = height;
        if (params.tau !== undefined) this.tau = params.tau;
        if (params.inletU) this.inletU = params.inletU;
        if (params.density !== undefined) this.density = params.density;

        this._createResources();
        this._compileShaders();
        this.reset();
    }

    _createResources() {
        const gpu = this.gpu;
        const w = this.width, h = this.height;

        // Distribution textures: 3 RGBA32F per side, ping-pong
        this._dfbo = gpu.createDoubleFBO(w, h, 3);

        // Obstacle mask: RGBA8
        this._obsTex = gpu.createTexture8(w, h);
        this._obsFbo = gpu.createFBO([this._obsTex]);

        // Curl / derived quantities texture
        this._curlTex = gpu.createTexture32F(w, h);
        this._curlFbo = gpu.createFBO([this._curlTex]);

        // FBOs for reading flow texture (third texture of each side)
        this._flowFboA = gpu.createFBO([this._dfbo.texA[2]]);
        this._flowFboB = gpu.createFBO([this._dfbo.texB[2]]);
    }

    _compileShaders() {
        const gpu = this.gpu;
        this._programs.collideStream = gpu.createProgram(COLLIDE_STREAM_FRAG);
        this._programs.initEq = gpu.createProgram(INIT_EQ_FRAG);
        this._programs.curl = gpu.createProgram(CURL_FRAG);
        this._programs.mask = gpu.createProgram(generateMaskShader());
    }

    reset() {
        const gpu = this.gpu;
        const w = this.width, h = this.height;

        // Initialize both sides to equilibrium
        const prog = this._programs.initEq;
        gpu.quad(prog, {
            uVelocity: this.inletU,
            uDensity: this.density
        }, this._dfbo.fboA, w, h);

        gpu.quad(prog, {
            uVelocity: this.inletU,
            uDensity: this.density
        }, this._dfbo.fboB, w, h);

        this._flip = false;
    }

    step() {
        if (this.paused) return;

        const gpu = this.gpu;
        const gl = gpu.gl;
        const w = this.width, h = this.height;

        // Determine source and target
        const src = this._flip ? this._dfbo.texB : this._dfbo.texA;
        const tgtFbo = this._flip ? this._dfbo.fboA : this._dfbo.fboB;

        const prog = this._programs.collideStream;
        gl.useProgram(prog);
        // Set integer uniforms explicitly
        gpu.setUniformInt(prog, 'uBCLeft', this.bcLeft);
        gpu.setUniformInt(prog, 'uBCTopBot', this.bcTopBot);

        gpu.quad(prog, {
            uTex0: src[0],
            uTex1: src[1],
            uTex2: src[2],
            uObstacle: this._obsTex,
            uTau: this.tau,
            uInlet: this.inletU
        }, tgtFbo, w, h);

        this._flip = !this._flip;
    }

    /** Compute curl / vorticity field */
    computeCurl() {
        const gpu = this.gpu;
        const flowTex = this.getFlowTexture();
        gpu.quad(this._programs.curl, {
            uFlow: flowTex
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

    setInletVelocity(ux, uy) {
        this.inletU = [ux, uy];
    }

    setViscosity(nu) {
        // tau = 3*nu + 0.5  (lattice units)
        this.tau = 3.0 * nu + 0.5;
    }

    getViscosity() {
        return (this.tau - 0.5) / 3.0;
    }

    getFlowTexture() {
        // Return the third texture (f8, rho, ux, uy) from the current read side
        return this._flip ? this._dfbo.texB[2] : this._dfbo.texA[2];
    }

    getFlowFBO() {
        return this._flip ? this._flowFboB : this._flowFboA;
    }

    getCurlTexture() {
        return this._curlTex;
    }

    getObstacleTexture() {
        return this._obsTex;
    }

    _destroyResources() {
        const gpu = this.gpu;
        if (this._dfbo) gpu.deleteDoubleFBO(this._dfbo);
        if (this._obsTex) gpu.deleteTexture(this._obsTex);
        if (this._obsFbo) gpu.deleteFBO(this._obsFbo);
        if (this._curlTex) gpu.deleteTexture(this._curlTex);
        if (this._curlFbo) gpu.deleteFBO(this._curlFbo);
        if (this._flowFboA) gpu.deleteFBO(this._flowFboA);
        if (this._flowFboB) gpu.deleteFBO(this._flowFboB);
    }

    destroy() {
        this._destroyResources();
    }
}
