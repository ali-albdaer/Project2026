class NavierStokesSim {
    constructor(renderer) {
        this.renderer = renderer;
        this.width = 128;
        this.height = 128;
        this.simSize = 128;
        
        // Create textures and FBOs
        // Velocity: 2 components (x, y)
        this.vel0 = this.createDoubleBuffer();
        this.vel1 = this.createDoubleBuffer(); // Temp
        
        // Pressure: 1 component
        this.pressure = this.createDoubleBuffer();
        
        // Divergence: 1 component
        this.divergence = renderer.createTexture(this.simSize, this.simSize);
        this.divFbo = renderer.createFramebuffer(this.divergence);
        
        this.initShaders();
        
        this.viscosity = 0.0;
        this.dt = 0.016;
        this.density = 1.0;
        this.paused = false;
    }
    
    createDoubleBuffer() {
        const t1 = this.renderer.createTexture(this.simSize, this.simSize);
        const t2 = this.renderer.createTexture(this.simSize, this.simSize);
        const f1 = this.renderer.createFramebuffer(t1);
        const f2 = this.renderer.createFramebuffer(t2);
        return {
            read: { tex: t1, fbo: f1 },
            write: { tex: t2, fbo: f2 },
            swap: function() {
                const temp = this.read;
                this.read = this.write;
                this.write = temp;
            }
        };
    }
    
    initShaders() {
        const vert = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0, 1);
        }`;
        
        const advectFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_velocity;
        uniform sampler2D u_source;
        uniform float dt;
        uniform float rdx; // 1 / dx
        out vec4 outColor;
        void main() {
            vec2 vel = texture(u_velocity, v_uv).xy;
            vec2 coord = v_uv - dt * vel * rdx; // Backtrace
            outColor = texture(u_source, coord);
        }`;
        
        const divFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_velocity;
        uniform float halfrdx; // 0.5 / dx
        out vec4 outColor;
        void main() {
            float w = texture(u_velocity, v_uv + vec2(1.0/128.0, 0.0)).x;
            float e = texture(u_velocity, v_uv - vec2(1.0/128.0, 0.0)).x;
            float n = texture(u_velocity, v_uv + vec2(0.0, 1.0/128.0)).y;
            float s = texture(u_velocity, v_uv - vec2(0.0, 1.0/128.0)).y;
            float div = halfrdx * (w - e + n - s);
            outColor = vec4(div, 0, 0, 1);
        }`;
        
        const jacobiFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_x; // x (pressure or velocity)
        uniform sampler2D u_b; // b (divergence or velocity)
        uniform float alpha;
        uniform float rBeta; // 1/beta
        out vec4 outColor;
        void main() {
            vec4 xL = texture(u_x, v_uv - vec2(1.0/128.0, 0.0));
            vec4 xR = texture(u_x, v_uv + vec2(1.0/128.0, 0.0));
            vec4 xB = texture(u_x, v_uv - vec2(0.0, 1.0/128.0));
            vec4 xT = texture(u_x, v_uv + vec2(0.0, 1.0/128.0));
            vec4 bC = texture(u_b, v_uv);
            outColor = (xL + xR + xB + xT + alpha * bC) * rBeta;
        }`;
        
        const gradFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_pressure;
        uniform sampler2D u_velocity;
        uniform float halfrdx;
        out vec4 outColor;
        void main() {
            float pL = texture(u_pressure, v_uv - vec2(1.0/128.0, 0.0)).x;
            float pR = texture(u_pressure, v_uv + vec2(1.0/128.0, 0.0)).x;
            float pB = texture(u_pressure, v_uv - vec2(0.0, 1.0/128.0)).x;
            float pT = texture(u_pressure, v_uv + vec2(0.0, 1.0/128.0)).x;
            vec2 vel = texture(u_velocity, v_uv).xy;
            vel.xy -= halfrdx * vec2(pR - pL, pT - pB);
            outColor = vec4(vel, 0, 1);
        }`;
        
        const splatFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_target;
        uniform vec2 point;
        uniform vec3 color;
        uniform float radius;
        out vec4 outColor;
        void main() {
            vec2 p = v_uv - point;
            p.x *= 1.0; // Aspect ratio?
            float d = dot(p, p);
            float val = exp(-d / radius);
            vec3 base = texture(u_target, v_uv).xyz;
            outColor = vec4(base + val * color, 1.0);
        }`;

        this.programs = {
            advect: this.renderer.createShader(vert, advectFrag),
            divergence: this.renderer.createShader(vert, divFrag),
            jacobi: this.renderer.createShader(vert, jacobiFrag),
            gradient: this.renderer.createShader(vert, gradFrag),
            splat: this.renderer.createShader(vert, splatFrag)
        };
    }
    
    update(dt) {
        if (this.paused) return;
        
        const r = this.renderer;
        const dx = 1.0 / this.simSize;
        
        // 1. Advect Velocity
        r.runProgram(this.programs.advect, {
            u_velocity: { type: 'tex', value: this.vel0.read.tex },
            u_source: { type: 'tex', value: this.vel0.read.tex },
            dt: { type: '1f', value: dt },
            rdx: { type: '1f', value: 1.0 / dx }
        }, this.vel0.write.fbo);
        this.vel0.swap();
        
        // 2. Diffuse (Viscosity)
        if (this.viscosity > 0) {
            const alpha = dx * dx / (this.viscosity * dt);
            const rBeta = 1.0 / (4.0 + alpha);
            for (let i = 0; i < 20; i++) {
                r.runProgram(this.programs.jacobi, {
                    u_x: { type: 'tex', value: this.vel0.read.tex },
                    u_b: { type: 'tex', value: this.vel0.read.tex }, // Should be initial velocity? No, diffusion solves dx/dt = nu laplacian x. x_new = x_old + dt nu laplacian x_new. (I - dt nu L) x_new = x_old. Ax=b. b is x_old.
                    alpha: { type: '1f', value: alpha },
                    rBeta: { type: '1f', value: rBeta }
                }, this.vel0.write.fbo);
                this.vel0.swap();
            }
        }
        
        // 3. Project
        // 3a. Divergence
        r.runProgram(this.programs.divergence, {
            u_velocity: { type: 'tex', value: this.vel0.read.tex },
            halfrdx: { type: '1f', value: 0.5 / dx }
        }, this.divFbo);
        
        // 3b. Pressure Solve (Poisson)
        // L p = div w
        // alpha = -dx^2, beta = 4
        const alpha = -dx * dx;
        const rBeta = 0.25;
        
        // Clear pressure? Usually warm start is better.
        
        for (let i = 0; i < 40; i++) {
            r.runProgram(this.programs.jacobi, {
                u_x: { type: 'tex', value: this.pressure.read.tex },
                u_b: { type: 'tex', value: this.divergence },
                alpha: { type: '1f', value: alpha },
                rBeta: { type: '1f', value: rBeta }
            }, this.pressure.write.fbo);
            this.pressure.swap();
        }
        
        // 3c. Subtract Gradient
        r.runProgram(this.programs.gradient, {
            u_pressure: { type: 'tex', value: this.pressure.read.tex },
            u_velocity: { type: 'tex', value: this.vel0.read.tex },
            halfrdx: { type: '1f', value: 0.5 / dx }
        }, this.vel0.write.fbo);
        this.vel0.swap();
    }
    
    addForce(x, y, dx, dy) {
        // Splat force into velocity
        const r = this.renderer;
        r.runProgram(this.programs.splat, {
            u_target: { type: 'tex', value: this.vel0.read.tex },
            point: { type: '2f', value: [x, y] },
            color: { type: '3f', value: [dx * 100, dy * 100, 0] }, // Scale force
            radius: { type: '1f', value: 0.005 } // Small radius
        }, this.vel0.write.fbo);
        this.vel0.swap();
    }
    
    draw(mode) {
        let tex = this.vel0.read.tex;
        let type = 1;
        let scale = 0.5;
        let channel = 0;
        
        if (mode === 'pressure') {
            tex = this.pressure.read.tex;
            type = 0;
            scale = 0.8;
        } else if (mode === 'divergence') {
            tex = this.divergence;
            type = 0;
            scale = 0.8;
        } else if (mode === 'curl') {
            // Need to compute curl.
            // For now, just show velocity
            type = 1;
        }
        
        this.renderer.drawTexture(tex, type, scale, channel);
    }
    
    getProbe(x, y) {
        // Read pixels is slow.
        // But for a probe on hover, we can read 1 pixel.
        // Or just return 0 for now as reading from GPU is async/slow in JS without PBOs.
        // Actually, we can readPixels from the FBO.
        const gl = this.renderer.gl;
        const fb = this.vel0.read.fbo;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        const px = Math.floor(x * this.simSize);
        const py = Math.floor(y * this.simSize);
        const data = new Float32Array(4);
        gl.readPixels(px, py, 1, 1, gl.RGBA, gl.FLOAT, data);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return { u: data[0], v: data[1], val: 0 };
    }
}
