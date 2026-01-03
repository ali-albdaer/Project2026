import { commonVS } from '../renderer.js';

export class ViscousFlow {
    constructor(renderer, uiContainer) {
        this.renderer = renderer;
        this.gl = renderer.gl;
        this.uiContainer = uiContainer;
        
        this.type = 'poiseuille'; // poiseuille, couette, pipe
        this.params = {
            dpdx: -2.0, // Pressure gradient
            mu: 1.0,    // Viscosity
            h: 1.0,     // Half-height or radius
            U: 1.0,     // Moving plate velocity (Couette)
            zoom: 3.0
        };

        this.program = null;
        this.initUI();
        this.updateShader();
    }

    initUI() {
        this.uiContainer.innerHTML = '';
        
        const typeSelect = document.createElement('div');
        typeSelect.className = 'control-group';
        typeSelect.innerHTML = `
            <label>Flow Type</label>
            <select id="viscous-type">
                <option value="poiseuille">Plane Poiseuille (Parallel Plates)</option>
                <option value="couette">Couette (Moving Plate)</option>
                <option value="pipe">Hagen-Poiseuille (Pipe)</option>
            </select>
        `;
        this.uiContainer.appendChild(typeSelect);
        typeSelect.querySelector('select').addEventListener('change', (e) => {
            this.type = e.target.value;
            this.updateShader();
            this.initUI(); // Re-render UI for specific params
        });

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

        const paramGroup = document.createElement('div');
        paramGroup.className = 'control-group';
        paramGroup.innerHTML = '<h4>Parameters</h4>';
        
        paramGroup.appendChild(createSlider('Pressure Grad (dP/dx)', this.params, 'dpdx', -10, 10, 0.1));
        paramGroup.appendChild(createSlider('Viscosity (μ)', this.params, 'mu', 0.1, 5, 0.1));
        paramGroup.appendChild(createSlider('Height/Radius (h/R)', this.params, 'h', 0.1, 2, 0.1));
        
        if (this.type === 'couette') {
            paramGroup.appendChild(createSlider('Plate Vel (U)', this.params, 'U', -5, 5, 0.1));
        }

        paramGroup.appendChild(createSlider('Zoom', this.params, 'zoom', 1, 10, 0.5));
        this.uiContainer.appendChild(paramGroup);
    }

    getEquationHTML() {
        if (this.type === 'poiseuille') {
            return `$$ u(y) = \\frac{1}{2\\mu} \\left(\\frac{dP}{dx}\\right) (y^2 - h^2) $$`;
        } else if (this.type === 'couette') {
            return `$$ u(y) = U\\frac{y}{h} + \\frac{1}{2\\mu}\\left(\\frac{dP}{dx}\\right)(y^2 - hy) $$ <br> (Note: simplified for y from 0 to h)`;
        } else {
            return `$$ V_z(r) = \\frac{1}{4\\mu} \\left( \\frac{dP}{dz} \\right) (r^2 - R^2) $$`;
        }
    }

    updateShader() {
        // We'll inject the specific velocity function into the shader
        let velFunc = '';
        if (this.type === 'poiseuille') {
            velFunc = `
                if (abs(p.y) > u_h) return vec2(0.0);
                float u = (1.0 / (2.0 * u_mu)) * u_dpdx * (p.y * p.y - u_h * u_h);
                return vec2(u, 0.0);
            `;
        } else if (this.type === 'couette') {
            // Couette typically 0 to h. Let's center it for viz: -h/2 to h/2? 
            // Or just keep 0 to h. Let's do 0 to h for consistency with formula.
            // Formula in tex: y=b is moving. Let's assume plates at y=0 and y=h.
            velFunc = `
                if (p.y < 0.0 || p.y > u_h) return vec2(0.0);
                float term1 = u_U * (p.y / u_h);
                float term2 = (1.0 / (2.0 * u_mu)) * u_dpdx * (p.y * p.y - u_h * p.y);
                return vec2(term1 + term2, 0.0);
            `;
        } else if (this.type === 'pipe') {
            // 3D pipe viewed in 2D cross section? Or longitudinal?
            // Usually longitudinal profile is parabolic.
            // Let's show longitudinal section (z, r). y axis is r.
            velFunc = `
                if (abs(p.y) > u_h) return vec2(0.0);
                float u = (1.0 / (4.0 * u_mu)) * u_dpdx * (p.y * p.y - u_h * u_h);
                return vec2(u, 0.0);
            `;
        }

        const fsSource = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        out vec4 outColor;

        uniform float u_zoom;
        uniform float u_aspect;
        uniform int u_vizType;

        uniform float u_dpdx;
        uniform float u_mu;
        uniform float u_h;
        uniform float u_U;

        vec2 getVelocity(vec2 p) {
            ${velFunc}
        }

        vec3 jet(float t) {
            return clamp(vec3(1.5 - abs(2.0 * t - 1.0), 
                              1.5 - abs(2.0 * t - 2.0), 
                              1.5 - abs(2.0 * t - 3.0)), 0.0, 1.0);
        }

        void main() {
            vec2 p = (v_uv - 0.5) * vec2(u_aspect, 1.0) * u_zoom;
            // Shift for Couette to show 0 to h centered
            if (${this.type === 'couette' ? 'true' : 'false'}) {
                p.y += u_h * 0.5;
            }

            vec2 vel = getVelocity(p);
            float speed = length(vel);

            vec3 color = vec3(0.0);
            
            // Draw walls
            if (${this.type === 'couette' ? 'true' : 'false'}) {
                if (abs(p.y - u_h/2.0) > u_h/2.0 + 0.02) discard; // Outside
                if (abs(p.y - u_h/2.0) > u_h/2.0) color = vec3(0.5); // Walls
                else color = jet(speed * 0.5);
            } else {
                if (abs(p.y) > u_h + 0.02) discard;
                if (abs(p.y) > u_h) color = vec3(0.5);
                else color = jet(speed * 0.5);
            }

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
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_aspect'), this.renderer.canvas.width / this.renderer.canvas.height);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_vizType'), 0); // Only velocity relevant mostly

        gl.uniform1f(gl.getUniformLocation(this.program, 'u_dpdx'), this.params.dpdx);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_mu'), this.params.mu);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_h'), this.params.h);
        gl.uniform1f(gl.getUniformLocation(this.program, 'u_U'), this.params.U);

        this.renderer.drawQuad(this.program);
    }

    getProbeValue(x, y) {
        const aspect = this.renderer.canvas.width / this.renderer.canvas.height;
        let wx = (x - 0.5) * aspect * this.params.zoom;
        let wy = (y - 0.5) * this.params.zoom;
        
        if (this.type === 'couette') wy += this.params.h * 0.5;

        let u = 0;
        const { dpdx, mu, h, U } = this.params;

        if (this.type === 'poiseuille') {
            if (Math.abs(wy) <= h) {
                u = (1/(2*mu)) * dpdx * (wy*wy - h*h);
            }
        } else if (this.type === 'couette') {
            if (wy >= 0 && wy <= h) {
                u = U*(wy/h) + (1/(2*mu))*dpdx*(wy*wy - h*wy);
            }
        } else if (this.type === 'pipe') {
            if (Math.abs(wy) <= h) {
                u = (1/(4*mu)) * dpdx * (wy*wy - h*h);
            }
        }

        return {
            x: wx.toFixed(2),
            y: wy.toFixed(2),
            u: u.toFixed(2),
            v: "0.00",
            val: Math.abs(u).toFixed(2)
        };
    }
}
