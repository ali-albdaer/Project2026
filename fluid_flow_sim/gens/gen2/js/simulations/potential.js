import { commonVS } from '../renderer.js';

export class PotentialFlow {
    constructor(renderer, uiContainer) {
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.uiContainer = uiContainer;
        
        this.elements = [
            { type: 'uniform', u: 1.0, v: 0.0, enabled: true },
            { type: 'source', x: 0.0, y: 0.0, m: 0.0, enabled: true }, // m is strength
            { type: 'vortex', x: 0.0, y: 0.0, gamma: 0.0, enabled: true },
            { type: 'doublet', x: 0.0, y: 0.0, kappa: 0.0, angle: 0.0, enabled: true }
        ];

        this.params = {
            zoom: 5.0,
            centerX: 0.0,
            centerY: 0.0
        };

        this.program = null;
        this.initUI();
        this.updateShader();
    }

    initUI() {
        this.uiContainer.innerHTML = '';
        
        const createSlider = (label, obj, prop, min, max, step, onChange) => {
            const div = document.createElement('div');
            div.className = 'slider-container';
            div.innerHTML = `
                <div class="slider-label"><span>${label}</span><span id="val-${label}">${obj[prop]}</span></div>
                <input type="range" min="${min}" max="${max}" step="${step}" value="${obj[prop]}">
            `;
            const input = div.querySelector('input');
            input.addEventListener('input', (e) => {
                obj[prop] = parseFloat(e.target.value);
                div.querySelector(`#val-${label}`).innerText = obj[prop];
                if (onChange) onChange();
            });
            return div;
        };

        // Uniform Flow Controls
        const uniformGroup = document.createElement('div');
        uniformGroup.className = 'control-group';
        uniformGroup.innerHTML = '<h4>Uniform Flow</h4>';
        uniformGroup.appendChild(createSlider('U (Vel X)', this.elements[0], 'u', -5, 5, 0.1));
        uniformGroup.appendChild(createSlider('V (Vel Y)', this.elements[0], 'v', -5, 5, 0.1));
        this.uiContainer.appendChild(uniformGroup);

        // Source/Sink Controls
        const sourceGroup = document.createElement('div');
        sourceGroup.className = 'control-group';
        sourceGroup.innerHTML = '<h4>Source / Sink</h4>';
        sourceGroup.appendChild(createSlider('Strength (m)', this.elements[1], 'm', -10, 10, 0.1));
        sourceGroup.appendChild(createSlider('X Pos', this.elements[1], 'x', -5, 5, 0.1));
        sourceGroup.appendChild(createSlider('Y Pos', this.elements[1], 'y', -5, 5, 0.1));
        this.uiContainer.appendChild(sourceGroup);

        // Vortex Controls
        const vortexGroup = document.createElement('div');
        vortexGroup.className = 'control-group';
        vortexGroup.innerHTML = '<h4>Vortex</h4>';
        vortexGroup.appendChild(createSlider('Circulation (Γ)', this.elements[2], 'gamma', -10, 10, 0.1));
        vortexGroup.appendChild(createSlider('X Pos', this.elements[2], 'x', -5, 5, 0.1));
        vortexGroup.appendChild(createSlider('Y Pos', this.elements[2], 'y', -5, 5, 0.1));
        this.uiContainer.appendChild(vortexGroup);

        // Doublet Controls
        const doubletGroup = document.createElement('div');
        doubletGroup.className = 'control-group';
        doubletGroup.innerHTML = '<h4>Doublet (Cylinder)</h4>';
        doubletGroup.appendChild(createSlider('Strength (κ)', this.elements[3], 'kappa', 0, 10, 0.1));
        doubletGroup.appendChild(createSlider('Angle', this.elements[3], 'angle', 0, 6.28, 0.1));
        doubletGroup.appendChild(createSlider('X Pos', this.elements[3], 'x', -5, 5, 0.1));
        doubletGroup.appendChild(createSlider('Y Pos', this.elements[3], 'y', -5, 5, 0.1));
        this.uiContainer.appendChild(doubletGroup);

        // View Controls
        const viewGroup = document.createElement('div');
        viewGroup.className = 'control-group';
        viewGroup.innerHTML = '<h4>View</h4>';
        viewGroup.appendChild(createSlider('Zoom', this.params, 'zoom', 1, 20, 0.5));
        this.uiContainer.appendChild(viewGroup);
    }

    getEquationHTML() {
        return `
        $$ \\nabla^2 \\phi = 0, \\quad \\nabla^2 \\psi = 0 $$
        $$ u = \\frac{\\partial \\phi}{\\partial x} = \\frac{\\partial \\psi}{\\partial y}, \\quad v = \\frac{\\partial \\phi}{\\partial y} = -\\frac{\\partial \\psi}{\\partial x} $$
        <br>
        <b>Superposition:</b>
        $$ \\psi_{total} = \\psi_{uniform} + \\psi_{source} + \\psi_{vortex} + \\psi_{doublet} $$
        `;
    }

    updateShader() {
        const fsSource = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;

        uniform float u_zoom;
        uniform vec2 u_center;
        uniform float u_aspect;
        uniform int u_vizType; // 0: Vel, 1: Pressure, 2: Curl, 3: Stream, 4: Dye

        // Element Uniforms
        uniform vec2 u_uniform_vel;
        uniform vec3 u_source; // x, y, strength
        uniform vec3 u_vortex; // x, y, circulation
        uniform vec4 u_doublet; // x, y, strength, angle

        const float PI = 3.14159265359;

        vec2 getVelocity(vec2 p) {
            vec2 vel = u_uniform_vel;

            // Source
            vec2 ds = p - u_source.xy;
            float rs = length(ds);
            if (rs > 0.001) {
                float vr = u_source.z / (2.0 * PI * rs);
                vel += vr * (ds / rs);
            }

            // Vortex
            vec2 dv = p - u_vortex.xy;
            float rv = length(dv);
            if (rv > 0.001) {
                float vtheta = u_vortex.z / (2.0 * PI * rv);
                vel += vtheta * vec2(-dv.y, dv.x) / rv;
            }

            // Doublet
            vec2 dd = p - u_doublet.xy;
            float rd = length(dd);
            if (rd > 0.001) {
                // Doublet potential phi = (kappa * cos(theta - alpha)) / r
                // Vr = -kappa * cos(theta - alpha) / r^2
                // Vtheta = -kappa * sin(theta - alpha) / r^2
                // Convert to cartesian
                float theta = atan(dd.y, dd.x) - u_doublet.w;
                float vr = -u_doublet.z * cos(theta) / (rd * rd);
                float vtheta = -u_doublet.z * sin(theta) / (rd * rd);
                
                vec2 er = dd / rd;
                vec2 et = vec2(-er.y, er.x);
                vel += vr * er + vtheta * et;
            }

            return vel;
        }

        float getStreamFunction(vec2 p) {
            float psi = u_uniform_vel.x * p.y - u_uniform_vel.y * p.x;

            // Source: psi = (m / 2pi) * theta
            vec2 ds = p - u_source.xy;
            psi += (u_source.z / (2.0 * PI)) * atan(ds.y, ds.x);

            // Vortex: psi = -(Gamma / 2pi) * ln(r)
            vec2 dv = p - u_vortex.xy;
            psi -= (u_vortex.z / (2.0 * PI)) * log(length(dv) + 0.0001);

            // Doublet: psi = - (kappa * sin(theta)) / r
            vec2 dd = p - u_doublet.xy;
            float rd = length(dd);
            if (rd > 0.001) {
                float theta = atan(dd.y, dd.x) - u_doublet.w;
                psi -= (u_doublet.z * sin(theta)) / rd;
            }

            return psi;
        }

        vec3 jet(float t) {
            return clamp(vec3(1.5 - abs(2.0 * t - 1.0), 
                              1.5 - abs(2.0 * t - 2.0), 
                              1.5 - abs(2.0 * t - 3.0)), 0.0, 1.0);
        }

        void main() {
            vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0) * u_zoom + u_center;
            
            vec2 vel = getVelocity(p);
            float speed = length(vel);
            
            vec3 color = vec3(0.0);

            if (u_vizType == 0) { // Velocity
                color = jet(speed * 0.5); // Scale speed for viz
            } else if (u_vizType == 1) { // Pressure (Bernoulli: P + 0.5*rho*V^2 = const) -> P ~ -V^2
                float p_coeff = 1.0 - speed * speed; 
                color = jet(p_coeff * 0.5 + 0.5);
            } else if (u_vizType == 3) { // Stream Function
                float psi = getStreamFunction(p);
                float lines = sin(psi * 10.0);
                color = vec3(smoothstep(-0.1, 0.1, lines));
                // Mix with velocity for better look
                color *= jet(speed * 0.2 + 0.2);
            } else {
                color = jet(speed * 0.5);
            }

            // Draw streamlines overlay
            float psi = getStreamFunction(p);
            float contour = abs(fract(psi * 2.0) - 0.5);
            if (contour < 0.05) color = mix(color, vec3(1.0), 0.5);

            outColor = vec4(color, 1.0);
        }
        `;
        this.program = this.renderer.createShader(commonVS, fsSource);
    }

    render(vizType) {
        if (!this.program) return;
        const gl = this.gl;
        gl.useProgram(this.program);

        gl.uniform1f(gl.getUniformLocation(this.program, 'u_zoom'), this.params.zoom);
        gl.uniform2f(gl.getUniformLocation(this.program, 'u_center'), this.params.centerX, this.params.centerY);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_aspect'), this.renderer.canvas.width / this.renderer.canvas.height);
        
        // Map vizType string to int
        const vizMap = { 'velocity': 0, 'pressure': 1, 'curl': 2, 'streamfunction': 3, 'dye': 4 };
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_vizType'), vizMap[vizType] || 0);

        // Elements
        gl.uniform2f(gl.getUniformLocation(this.program, 'u_uniform_vel'), this.elements[0].u, this.elements[0].v);
        gl.uniform3f(gl.getUniformLocation(this.program, 'u_source'), this.elements[1].x, this.elements[1].y, this.elements[1].m);
        gl.uniform3f(gl.getUniformLocation(this.program, 'u_vortex'), this.elements[2].x, this.elements[2].y, this.elements[2].gamma);
        gl.uniform4f(gl.getUniformLocation(this.program, 'u_doublet'), this.elements[3].x, this.elements[3].y, this.elements[3].kappa, this.elements[3].angle);

        this.renderer.drawQuad(this.program);
    }

    getProbeValue(x, y) {
        // Convert screen x,y (0-1) to world space
        const aspect = this.renderer.canvas.width / this.renderer.canvas.height;
        const wx = (x - 0.5) * aspect * this.params.zoom + this.params.centerX;
        const wy = (y - 0.5) * this.params.zoom + this.params.centerY;

        // Re-implement math from shader for CPU probe
        let u = this.elements[0].u;
        let v = this.elements[0].v;

        // Source
        let dx = wx - this.elements[1].x;
        let dy = wy - this.elements[1].y;
        let r2 = dx*dx + dy*dy;
        if (r2 > 0.00001) {
            let coef = this.elements[1].m / (2 * Math.PI * r2);
            u += coef * dx;
            v += coef * dy;
        }

        // Vortex
        dx = wx - this.elements[2].x;
        dy = wy - this.elements[2].y;
        r2 = dx*dx + dy*dy;
        if (r2 > 0.00001) {
            let coef = this.elements[2].gamma / (2 * Math.PI * r2);
            u += coef * (-dy);
            v += coef * (dx);
        }

        // Doublet
        dx = wx - this.elements[3].x;
        dy = wy - this.elements[3].y;
        let r = Math.sqrt(dx*dx + dy*dy);
        if (r > 0.001) {
            let theta = Math.atan2(dy, dx) - this.elements[3].angle;
            let vr = -this.elements[3].kappa * Math.cos(theta) / (r*r);
            let vt = -this.elements[3].kappa * Math.sin(theta) / (r*r);
            let erx = dx/r, ery = dy/r;
            let etx = -ery, ety = erx;
            u += vr * erx + vt * etx;
            v += vr * ery + vt * ety;
        }

        return {
            x: wx.toFixed(2),
            y: wy.toFixed(2),
            u: u.toFixed(2),
            v: v.toFixed(2),
            val: Math.sqrt(u*u + v*v).toFixed(2)
        };
    }
}
