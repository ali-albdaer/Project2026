import { commonVS } from '../renderer.js';

export class NavierStokes {
    constructor(renderer, uiContainer) {
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.uiContainer = uiContainer;
        
        this.width = 256; // Simulation grid size
        this.height = 256;
        
        this.params = {
            dt: 0.016,
            viscosity: 0.0, // Inviscid by default (Euler)
            iterations: 20,
            dissipation: 0.99,
            curl: 0.0 // Vorticity confinement strength
        };

        this.initFBOs();
        this.initShaders();
        this.initUI();
    }

    initFBOs() {
        const gl = this.gl;
        // Helper to create double buffered FBOs
        const createDoubleFBO = (w, h) => {
            let fbos = [];
            for (let i = 0; i < 2; i++) {
                const tex = this.renderer.createTexture(w, h, gl.RGBA32F, gl.RGBA, gl.FLOAT, null);
                const fbo = gl.createFramebuffer();
                gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
                fbos.push({ fbo, tex });
            }
            return {
                read: fbos[0],
                write: fbos[1],
                swap: function() {
                    let temp = this.read;
                    this.read = this.write;
                    this.write = temp;
                }
            };
        };

        // Check for float texture support
        if (!gl.getExtension('EXT_color_buffer_float')) {
            console.error("Float textures not supported");
        }

        this.velocity = createDoubleFBO(this.width, this.height);
        this.density = createDoubleFBO(this.width, this.height);
        this.pressure = createDoubleFBO(this.width, this.height);
        this.divergence = createDoubleFBO(this.width, this.height).read; // Single buffer needed
        this.curl = createDoubleFBO(this.width, this.height).read; // Single buffer needed
    }

    initShaders() {
        const gl = this.gl;
        
        const compile = (fs) => this.renderer.createShader(commonVS, fs);

        this.shaders = {
            advect: compile(advectShader),
            divergence: compile(divergenceShader),
            jacobi: compile(jacobiShader),
            gradientSubtract: compile(gradientSubtractShader),
            splat: compile(splatShader),
            curl: compile(curlShader),
            display: compile(displayShader)
        };
    }

    initUI() {
        this.uiContainer.innerHTML = '';
        
        const createSlider = (label, obj, prop, min, max, step) => {
            const div = document.createElement('div');
            div.className = 'slider-container';
            div.innerHTML = `
                <div class="slider-label"><span>${label}</span><span id="val-${label}">${obj[prop]}</span></div>
                <input type="range" min="${min}" max="${max}" step="${step}" value="${obj[prop]}">
            `;
            div.querySelector('input').addEventListener('input', (e) => {
                obj[prop] = parseFloat(e.target.value);
                div.querySelector(`#val-${label}`).innerText = obj[prop];
            });
            return div;
        };

        const group = document.createElement('div');
        group.className = 'control-group';
        group.innerHTML = '<h4>Simulation Parameters</h4>';
        group.appendChild(createSlider('Viscosity', this.params, 'viscosity', 0, 0.1, 0.001));
        group.appendChild(createSlider('Dissipation', this.params, 'dissipation', 0.9, 1.0, 0.001));
        group.appendChild(createSlider('Iterations', this.params, 'iterations', 5, 50, 1));
        group.appendChild(createSlider('Time Step', this.params, 'dt', 0.001, 0.1, 0.001));
        
        const btn = document.createElement('button');
        btn.innerText = "Reset Simulation";
        btn.onclick = () => this.reset();
        group.appendChild(btn);

        this.uiContainer.appendChild(group);
    }

    reset() {
        const gl = this.gl;
        // Clear all FBOs
        [this.velocity, this.density, this.pressure].forEach(pair => {
            gl.bindFramebuffer(gl.FRAMEBUFFER, pair.read.fbo);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.bindFramebuffer(gl.FRAMEBUFFER, pair.write.fbo);
            gl.clear(gl.COLOR_BUFFER_BIT);
        });
    }

    getEquationHTML() {
        return `
        $$ \\frac{\\partial \\vec{V}}{\\partial t} + (\\vec{V} \\cdot \\nabla)\\vec{V} = -\\nabla p + \\nu \\nabla^2 \\vec{V} $$
        $$ \\nabla \\cdot \\vec{V} = 0 $$
        <br>
        <b>Steps:</b> Advect $\\rightarrow$ Diffuse $\\rightarrow$ Project (Pressure Solve)
        `;
    }

    step(dt) {
        const gl = this.gl;
        gl.viewport(0, 0, this.width, this.height);

        // 1. Advect Velocity
        gl.useProgram(this.shaders.advect);
        gl.uniform1f(gl.getUniformLocation(this.shaders.advect, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(this.shaders.advect, 'dissipation'), 1.0); // No dissipation on vel usually
        gl.uniform1i(gl.getUniformLocation(this.shaders.advect, 'uVelocity'), 0);
        gl.uniform1i(gl.getUniformLocation(this.shaders.advect, 'uSource'), 0); // Advect self
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
        this.renderer.drawQuad(this.shaders.advect);
        this.velocity.swap();

        // 2. Advect Density
        gl.useProgram(this.shaders.advect);
        gl.uniform1f(gl.getUniformLocation(this.shaders.advect, 'dt'), dt);
        gl.uniform1f(gl.getUniformLocation(this.shaders.advect, 'dissipation'), this.params.dissipation);
        gl.uniform1i(gl.getUniformLocation(this.shaders.advect, 'uVelocity'), 0);
        gl.uniform1i(gl.getUniformLocation(this.shaders.advect, 'uSource'), 1);
        
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.density.read.tex);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.write.fbo);
        this.renderer.drawQuad(this.shaders.advect);
        this.density.swap();

        // 3. Diffuse (Viscosity) - Implicitly handled if viscosity > 0 via Jacobi, 
        // but for simple Euler we skip or do simple blur. 
        // Let's skip explicit diffusion for now as it requires another Jacobi solver loop.
        // Advection-only is "Inviscid" (Euler).

        // 4. Project
        // 4a. Divergence
        gl.useProgram(this.shaders.divergence);
        gl.uniform1i(gl.getUniformLocation(this.shaders.divergence, 'uVelocity'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.fbo);
        this.renderer.drawQuad(this.shaders.divergence);

        // 4b. Clear Pressure
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.read.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // 4c. Pressure Solve (Jacobi)
        gl.useProgram(this.shaders.jacobi);
        gl.uniform1i(gl.getUniformLocation(this.shaders.jacobi, 'uPressure'), 0);
        gl.uniform1i(gl.getUniformLocation(this.shaders.jacobi, 'uDivergence'), 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.divergence.tex);

        for (let i = 0; i < this.params.iterations; i++) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.tex);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.write.fbo);
            this.renderer.drawQuad(this.shaders.jacobi);
            this.pressure.swap();
        }

        // 4d. Subtract Gradient
        gl.useProgram(this.shaders.gradientSubtract);
        gl.uniform1i(gl.getUniformLocation(this.shaders.gradientSubtract, 'uPressure'), 0);
        gl.uniform1i(gl.getUniformLocation(this.shaders.gradientSubtract, 'uVelocity'), 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
        this.renderer.drawQuad(this.shaders.gradientSubtract);
        this.velocity.swap();

        // 5. Compute Curl (for viz)
        gl.useProgram(this.shaders.curl);
        gl.uniform1i(gl.getUniformLocation(this.shaders.curl, 'uVelocity'), 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.curl.fbo);
        this.renderer.drawQuad(this.shaders.curl);
    }

    splat(x, y, dx, dy, color) {
        const gl = this.gl;
        gl.viewport(0, 0, this.width, this.height);
        
        gl.useProgram(this.shaders.splat);
        gl.uniform1i(gl.getUniformLocation(this.shaders.splat, 'uTarget'), 0);
        gl.uniform1f(gl.getUniformLocation(this.shaders.splat, 'aspectRatio'), this.width / this.height);
        gl.uniform2f(gl.getUniformLocation(this.shaders.splat, 'point'), x, y);
        gl.uniform3f(gl.getUniformLocation(this.shaders.splat, 'color'), dx, dy, 0.0);
        gl.uniform1f(gl.getUniformLocation(this.shaders.splat, 'radius'), 0.005);

        // Splat into velocity
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
        this.renderer.drawQuad(this.shaders.splat);
        this.velocity.swap();

        // Splat into density
        gl.uniform3f(gl.getUniformLocation(this.shaders.splat, 'color'), color.r, color.g, color.b);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.density.read.tex);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.density.write.fbo);
        this.renderer.drawQuad(this.shaders.splat);
        this.density.swap();
    }

    render(vizType) {
        this.step(this.params.dt);

        const gl = this.gl;
        gl.viewport(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
        
        gl.useProgram(this.shaders.display);
        
        // Map vizType
        const vizMap = { 'velocity': 0, 'pressure': 1, 'curl': 2, 'streamfunction': 3, 'dye': 4 };
        gl.uniform1i(gl.getUniformLocation(this.shaders.display, 'uVizType'), vizMap[vizType] || 4);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.velocity.read.tex);
        gl.uniform1i(gl.getUniformLocation(this.shaders.display, 'uVelocity'), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.pressure.read.tex);
        gl.uniform1i(gl.getUniformLocation(this.shaders.display, 'uPressure'), 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.curl.tex);
        gl.uniform1i(gl.getUniformLocation(this.shaders.display, 'uCurl'), 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.density.read.tex);
        gl.uniform1i(gl.getUniformLocation(this.shaders.display, 'uDensity'), 3);

        this.renderer.drawQuad(this.shaders.display);
    }

    getProbeValue(x, y) {
        // Reading pixels from FBO is slow (gl.readPixels). 
        // For high performance, we might skip this or do it only when mouse stops.
        // Or just return "N/A" for this complex sim to avoid stalling pipeline.
        // But user asked for it.
        // We can read just 1 pixel.
        
        const gl = this.gl;
        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        
        const px = Math.floor(x * this.width);
        const py = Math.floor(y * this.height);
        
        const read = (tex) => {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
            const data = new Float32Array(4);
            gl.readPixels(px, py, 1, 1, gl.RGBA, gl.FLOAT, data);
            return data;
        };

        const vel = read(this.velocity.read.tex);
        const p = read(this.pressure.read.tex);

        gl.deleteFramebuffer(fb);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        return {
            x: x.toFixed(2),
            y: y.toFixed(2),
            u: vel[0].toFixed(2),
            v: vel[1].toFixed(2),
            val: p[0].toFixed(2) // Pressure
        };
    }
}

// --- Shaders ---

const advectShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform float dt;
uniform float dissipation;

void main() {
    vec2 coord = v_uv - dt * texture(uVelocity, v_uv).xy;
    outColor = dissipation * texture(uSource, coord);
}
`;

const divergenceShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uVelocity;

void main() {
    float L = textureOffset(uVelocity, v_uv, ivec2(-1, 0)).x;
    float R = textureOffset(uVelocity, v_uv, ivec2(1, 0)).x;
    float B = textureOffset(uVelocity, v_uv, ivec2(0, -1)).y;
    float T = textureOffset(uVelocity, v_uv, ivec2(0, 1)).y;

    float div = 0.5 * (R - L + T - B);
    outColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

const jacobiShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;

void main() {
    float L = textureOffset(uPressure, v_uv, ivec2(-1, 0)).x;
    float R = textureOffset(uPressure, v_uv, ivec2(1, 0)).x;
    float B = textureOffset(uPressure, v_uv, ivec2(0, -1)).x;
    float T = textureOffset(uPressure, v_uv, ivec2(0, 1)).x;
    
    float div = texture(uDivergence, v_uv).x;
    float p = (L + R + B + T - div) * 0.25;
    
    outColor = vec4(p, 0.0, 0.0, 1.0);
}
`;

const gradientSubtractShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;

void main() {
    float L = textureOffset(uPressure, v_uv, ivec2(-1, 0)).x;
    float R = textureOffset(uPressure, v_uv, ivec2(1, 0)).x;
    float B = textureOffset(uPressure, v_uv, ivec2(0, -1)).x;
    float T = textureOffset(uPressure, v_uv, ivec2(0, 1)).x;

    vec2 vel = texture(uVelocity, v_uv).xy;
    vel.xy -= vec2(R - L, T - B) * 0.5;
    
    outColor = vec4(vel, 0.0, 1.0);
}
`;

const splatShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec2 point;
uniform vec3 color;
uniform float radius;

void main() {
    vec2 p = v_uv - point;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture(uTarget, v_uv).xyz;
    outColor = vec4(base + splat, 1.0);
}
`;

const curlShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uVelocity;

void main() {
    float L = textureOffset(uVelocity, v_uv, ivec2(-1, 0)).y;
    float R = textureOffset(uVelocity, v_uv, ivec2(1, 0)).y;
    float B = textureOffset(uVelocity, v_uv, ivec2(0, -1)).x;
    float T = textureOffset(uVelocity, v_uv, ivec2(0, 1)).x;
    
    float curl = (R - L) - (T - B);
    outColor = vec4(curl * 0.5, 0.0, 0.0, 1.0);
}
`;

const displayShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform sampler2D uVelocity;
uniform sampler2D uPressure;
uniform sampler2D uCurl;
uniform sampler2D uDensity;
uniform int uVizType;

vec3 jet(float t) {
    return clamp(vec3(1.5 - abs(2.0 * t - 1.0), 
                      1.5 - abs(2.0 * t - 2.0), 
                      1.5 - abs(2.0 * t - 3.0)), 0.0, 1.0);
}

void main() {
    vec3 color = vec3(0.0);
    
    if (uVizType == 0) { // Velocity
        float speed = length(texture(uVelocity, v_uv).xy);
        color = jet(speed * 2.0);
    } else if (uVizType == 1) { // Pressure
        float p = texture(uPressure, v_uv).x;
        color = jet(p * 2.0 + 0.5);
    } else if (uVizType == 2) { // Curl
        float c = texture(uCurl, v_uv).x;
        color = jet(c * 2.0 + 0.5);
    } else if (uVizType == 4) { // Dye
        color = texture(uDensity, v_uv).xyz;
    } else {
        color = texture(uDensity, v_uv).xyz;
    }

    outColor = vec4(color, 1.0);
}
`;
