// renderer.js — Flow field visualization with colormap application

const VISUALIZE_FRAG = `#version 300 es
precision highp float;

uniform sampler2D uFlow;      // (f8, rho, ux, uy)
uniform sampler2D uCurl;      // (curl, speed, rho, 0)
uniform sampler2D uObstacle;
uniform sampler2D uColormap;
uniform int uQuantity;        // 0=speed, 1=vorticity, 2=pressure, 3=ux, 4=uy
uniform float uMinVal;
uniform float uMaxVal;
uniform vec3 uBodyColor;
uniform float uOpacity;

out vec4 fragColor;

void main() {
    ivec2 c = ivec2(gl_FragCoord.xy);
    vec4 flow = texelFetch(uFlow, c, 0);
    vec4 curl = texelFetch(uCurl, c, 0);
    vec4 obs  = texelFetch(uObstacle, c, 0);

    float ux = flow.b;
    float uy = flow.a;
    float rho = flow.g;
    float speed = curl.g;
    float vort = curl.r;
    float pressure = (rho - 1.0) / 3.0; // p = (rho - rho0) * cs^2

    float val = 0.0;
    if (uQuantity == 0) val = speed;
    else if (uQuantity == 1) val = vort;
    else if (uQuantity == 2) val = pressure;
    else if (uQuantity == 3) val = ux;
    else if (uQuantity == 4) val = uy;

    // For vorticity, use symmetric range
    float t;
    if (uQuantity == 1) {
        // Map [-max, max] to [0, 1]
        t = (val / max(abs(uMaxVal - uMinVal), 1e-10)) * 0.5 + 0.5;
    } else {
        t = (val - uMinVal) / max(uMaxVal - uMinVal, 1e-10);
    }
    t = clamp(t, 0.0, 1.0);

    vec3 col = texture(uColormap, vec2(t, 0.5)).rgb;

    // Draw solid bodies
    if (obs.r > 0.5) {
        col = uBodyColor;
    }

    fragColor = vec4(col, uOpacity);
}`;

export class FlowRenderer {
    constructor() {
        this.quantity = 0; // 0=speed, 1=vorticity, 2=pressure, 3=ux, 4=uy
        this.minVal = 0.0;
        this.maxVal = 0.15;
        this.autoRange = true;
        this.bodyColor = [0.2, 0.2, 0.28];
        this.opacity = 1.0;
        this._program = null;
        this._gpu = null;
        this._colormapTex = null;
        this._avgSpeed = 0.1;
    }

    init(gpu) {
        this._gpu = gpu;
        this._program = gpu.createProgram(VISUALIZE_FRAG);
    }

    setColormap(tex) {
        this._colormapTex = tex;
    }

    render(solver, canvas) {
        const gpu = this._gpu;
        const gl = gpu.gl;

        // Compute curl/vorticity first
        solver.computeCurl();

        const flowTex = solver.getFlowTexture();
        const curlTex = solver.getCurlTexture();
        const obsTex = solver.getObstacleTexture();

        if (!flowTex || !curlTex || !obsTex || !this._colormapTex) return;

        // Auto-range: smoothly adapt min/max
        if (this.autoRange) {
            this._updateAutoRange(solver);
        }

        const prog = this._program;
        gl.useProgram(prog);
        gpu.setUniformInt(prog, 'uQuantity', this.quantity);

        gpu.quad(prog, {
            uFlow: flowTex,
            uCurl: curlTex,
            uObstacle: obsTex,
            uColormap: this._colormapTex,
            uMinVal: this.minVal,
            uMaxVal: this.maxVal,
            uBodyColor: this.bodyColor,
            uOpacity: this.opacity,
        }, null, canvas.width, canvas.height);
    }

    _updateAutoRange(solver) {
        // Smooth range based on inlet velocity
        const targetMax = Math.max(
            Math.sqrt(solver.inletU[0]**2 + solver.inletU[1]**2) * 1.8,
            0.01
        );
        if (this.quantity === 0) { // speed
            this.minVal = 0;
            this.maxVal += (targetMax - this.maxVal) * 0.05;
        } else if (this.quantity === 1) { // vorticity
            const vRange = targetMax * 3.0;
            this.minVal += (-vRange - this.minVal) * 0.05;
            this.maxVal += (vRange - this.maxVal) * 0.05;
        } else if (this.quantity === 2) { // pressure
            this.minVal += (-0.01 - this.minVal) * 0.05;
            this.maxVal += (0.01 - this.maxVal) * 0.05;
        } else { // ux, uy
            this.minVal += (-targetMax - this.minVal) * 0.05;
            this.maxVal += (targetMax - this.maxVal) * 0.05;
        }
    }
}

export const QUANTITY_NAMES = ['Speed', 'Vorticity', 'Pressure', 'Velocity X', 'Velocity Y'];
