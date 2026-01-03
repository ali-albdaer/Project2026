import { Utils } from './utils.js';

export class FluidSolver {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl');
        this.ext = this.gl.getExtension('OES_texture_float');
        this.gl.getExtension('OES_texture_float_linear'); // Optional

        this.width = canvas.width;
        this.height = canvas.height;
        
        // Simulation resolution (can be lower than screen)
        this.simWidth = 256;
        this.simHeight = 256;

        this.config = {
            viscosity: 0.000,
            dissipation: 0.995,
            dt: 0.1,
            iterations: 20,
            radius: 0.02, // Splat radius
            force: 1.0
        };

        this.initShaders();
        this.initBuffers();
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        // Re-init textures if needed, or just viewport
        this.gl.viewport(0, 0, this.width, this.height);
    }

    initShaders() {
        const gl = this.gl;
        
        const baseVertex = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0, 1);
            }
        `;

        const advectionShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_velocity;
            uniform sampler2D u_source;
            uniform vec2 u_texelSize;
            uniform float u_dt;
            uniform float u_dissipation;

            void main() {
                vec2 coord = v_uv - u_dt * texture2D(u_velocity, v_uv).xy * u_texelSize;
                gl_FragColor = u_dissipation * texture2D(u_source, coord);
            }
        `;

        const divergenceShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_velocity;
            uniform vec2 u_texelSize;

            void main() {
                float L = texture2D(u_velocity, v_uv - vec2(u_texelSize.x, 0)).x;
                float R = texture2D(u_velocity, v_uv + vec2(u_texelSize.x, 0)).x;
                float T = texture2D(u_velocity, v_uv + vec2(0, u_texelSize.y)).y;
                float B = texture2D(u_velocity, v_uv - vec2(0, u_texelSize.y)).y;

                float div = 0.5 * (R - L + T - B);
                gl_FragColor = vec4(div, 0, 0, 1);
            }
        `;

        const pressureShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_pressure;
            uniform sampler2D u_divergence;
            uniform vec2 u_texelSize;

            void main() {
                float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0)).x;
                float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0)).x;
                float T = texture2D(u_pressure, v_uv + vec2(0, u_texelSize.y)).x;
                float B = texture2D(u_pressure, v_uv - vec2(0, u_texelSize.y)).x;
                float C = texture2D(u_pressure, v_uv).x;
                float div = texture2D(u_divergence, v_uv).x;

                float pressure = (L + R + T + B - div) * 0.25;
                gl_FragColor = vec4(pressure, 0, 0, 1);
            }
        `;

        const gradientSubtractShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_pressure;
            uniform sampler2D u_velocity;
            uniform vec2 u_texelSize;

            void main() {
                float L = texture2D(u_pressure, v_uv - vec2(u_texelSize.x, 0)).x;
                float R = texture2D(u_pressure, v_uv + vec2(u_texelSize.x, 0)).x;
                float T = texture2D(u_pressure, v_uv + vec2(0, u_texelSize.y)).x;
                float B = texture2D(u_pressure, v_uv - vec2(0, u_texelSize.y)).x;
                
                vec2 velocity = texture2D(u_velocity, v_uv).xy;
                velocity.xy -= vec2(R - L, T - B) * 0.5;
                gl_FragColor = vec4(velocity, 0, 1);
            }
        `;

        const splatShader = `
            precision highp float;
            varying vec2 v_uv;
            uniform sampler2D u_target;
            uniform float u_aspectRatio;
            uniform vec2 u_point;
            uniform vec3 u_color;
            uniform float u_radius;

            void main() {
                vec2 p = v_uv - u_point.xy;
                p.x *= u_aspectRatio;
                vec3 splat = exp(-dot(p, p) / u_radius) * u_color;
                vec3 base = texture2D(u_target, v_uv).xyz;
                gl_FragColor = vec4(base + splat, 1);
            }
        `;

        this.programs = {
            advection: this.createProgram(baseVertex, advectionShader),
            divergence: this.createProgram(baseVertex, divergenceShader),
            pressure: this.createProgram(baseVertex, pressureShader),
            gradientSubtract: this.createProgram(baseVertex, gradientSubtractShader),
            splat: this.createProgram(baseVertex, splatShader)
        };
    }

    createProgram(vsSource, fsSource) {
        const gl = this.gl;
        const vs = this.compileShader(gl.VERTEX_SHADER, vsSource);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error(gl.getProgramInfoLog(program));
        }
        return program;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    initBuffers() {
        const gl = this.gl;
        // Full screen quad
        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
        
        this.quadIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

        // Textures (Double buffering)
        this.velocity = this.createDoubleFBO(this.simWidth, this.simHeight);
        this.density = this.createDoubleFBO(this.simWidth, this.simHeight);
        this.divergence = this.createFBO(this.simWidth, this.simHeight);
        this.pressure = this.createDoubleFBO(this.simWidth, this.simHeight);
    }

    createFBO(w, h) {
        const gl = this.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.FLOAT, null);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        
        return { texture, fbo, width: w, height: h };
    }

    createDoubleFBO(w, h) {
        return {
            read: this.createFBO(w, h),
            write: this.createFBO(w, h),
            swap: function() {
                const temp = this.read;
                this.read = this.write;
                this.write = temp;
            }
        };
    }

    runProgram(program, uniforms) {
        const gl = this.gl;
        gl.useProgram(program);
        
        // Set uniforms
        for (const name in uniforms) {
            const loc = gl.getUniformLocation(program, name);
            const val = uniforms[name];
            if (typeof val === 'number') gl.uniform1f(loc, val);
            else if (Array.isArray(val)) {
                if (val.length === 2) gl.uniform2f(loc, val[0], val[1]);
                else if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
            } else if (val.texture) {
                // It's a texture object
                gl.activeTexture(gl.TEXTURE0 + val.unit);
                gl.bindTexture(gl.TEXTURE_2D, val.texture);
                gl.uniform1i(loc, val.unit);
            }
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        const posLoc = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIndexBuffer);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    step(dt) {
        const gl = this.gl;
        const texelSize = [1.0 / this.simWidth, 1.0 / this.simHeight];

        // 1. Advection (Velocity)
        gl.viewport(0, 0, this.simWidth, this.simHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
        this.runProgram(this.programs.advection, {
            u_velocity: { texture: this.velocity.read.texture, unit: 0 },
            u_source: { texture: this.velocity.read.texture, unit: 1 },
            u_texelSize: texelSize,
            u_dt: dt,
            u_dissipation: this.config.dissipation
        });
        this.velocity.swap();

        // 2. Advection (Density/Dye) - Optional, if we want to visualize dye
        // For now, we visualize velocity magnitude, so we don't strictly need dye advection
        // unless we want to see "smoke". Let's skip for now to keep it simple, or add later.

        // 3. Splat (Interaction)
        if (this.splatData) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
            this.runProgram(this.programs.splat, {
                u_target: { texture: this.velocity.read.texture, unit: 0 },
                u_aspectRatio: this.width / this.height,
                u_point: [this.splatData.x, this.splatData.y],
                u_color: [this.splatData.dx, this.splatData.dy, 0],
                u_radius: this.config.radius
            });
            this.velocity.swap();
            this.splatData = null;
        }

        // 4. Divergence
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.fbo);
        this.runProgram(this.programs.divergence, {
            u_velocity: { texture: this.velocity.read.texture, unit: 0 },
            u_texelSize: texelSize
        });

        // 5. Pressure (Jacobi)
        // Clear pressure first? Usually warm start is better.
        for (let i = 0; i < this.config.iterations; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.write.fbo);
            this.runProgram(this.programs.pressure, {
                u_pressure: { texture: this.pressure.read.texture, unit: 0 },
                u_divergence: { texture: this.divergence.texture, unit: 1 },
                u_texelSize: texelSize
            });
            this.pressure.swap();
        }

        // 6. Gradient Subtract
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.velocity.write.fbo);
        this.runProgram(this.programs.gradientSubtract, {
            u_pressure: { texture: this.pressure.read.texture, unit: 0 },
            u_velocity: { texture: this.velocity.read.texture, unit: 1 },
            u_texelSize: texelSize
        });
        this.velocity.swap();
    }

    render(colormapTexture, quantity) {
        const gl = this.gl;
        gl.viewport(0, 0, this.width, this.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Use the display shader from index.html (need to compile it here or grab it)
        // I'll just recompile it here for safety
        if (!this.programs.display) {
            const displayFs = document.getElementById('frag-display').textContent;
            const baseVs = `
                attribute vec2 a_position;
                varying vec2 v_uv;
                void main() {
                    v_uv = a_position * 0.5 + 0.5;
                    gl_Position = vec4(a_position, 0, 1);
                }
            `;
            this.programs.display = this.createProgram(baseVs, displayFs);
        }

        let tex, type, minVal, maxVal;
        if (quantity === 'pressure') {
            tex = this.pressure.read.texture;
            type = 1;
            minVal = -0.5;
            maxVal = 0.5;
        } else if (quantity === 'divergence') {
            tex = this.divergence.texture;
            type = 1;
            minVal = -0.1;
            maxVal = 0.1;
        } else {
            tex = this.velocity.read.texture;
            type = 0;
            minVal = 0.0;
            maxVal = 1.0;
        }

        this.runProgram(this.programs.display, {
            u_texture: { texture: tex, unit: 0 },
            u_colormap: { texture: colormapTexture, unit: 1 },
            u_min: minVal,
            u_max: maxVal,
            u_type: type
        });
    }

    addForce(x, y, dx, dy) {
        this.splatData = { x, y, dx: dx * this.config.force, dy: dy * this.config.force };
    }
}
