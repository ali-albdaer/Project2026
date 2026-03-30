// gpu.js — WebGL2 context manager and utility functions

export class GPU {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        /** @type {WebGL2RenderingContext} */
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            depth: false,
            stencil: false,
            antialias: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        });
        if (!this.gl) throw new Error('WebGL2 not supported');
        const gl = this.gl;

        // Required extensions
        const extFloat = gl.getExtension('EXT_color_buffer_float');
        if (!extFloat) throw new Error('EXT_color_buffer_float not supported');
        gl.getExtension('OES_texture_float_linear');

        // Full-screen quad geometry (triangle strip: 2 triangles)
        const quadVerts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        // Shared vertex shader for full-screen quad passes
        this._quadVertSrc = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}`;
        this._quadVertShader = this.compileShader(gl.VERTEX_SHADER, this._quadVertSrc);

        // Program cache
        this._programCache = {};
    }

    /* ---------- Shader / Program ---------- */

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile error:\n' + log + '\n--- Source ---\n' + source);
        }
        return shader;
    }

    /**
     * Create a program using the shared quad vertex shader and a custom fragment source.
     * Programs are cached by fragment source for reuse.
     * @param {string} fragSrc
     * @returns {WebGLProgram}
     */
    createProgram(fragSrc) {
        if (this._programCache[fragSrc]) return this._programCache[fragSrc];
        const gl = this.gl;
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, this._quadVertShader);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
        }
        gl.deleteShader(fs);
        // Cache uniform locations and types
        prog._uniforms = {};
        prog._uniformTypes = {};
        const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(prog, i);
            const name = info.name.replace(/\[0\]$/, '');
            prog._uniforms[name] = gl.getUniformLocation(prog, info.name);
            prog._uniformTypes[name] = info.type;
        }
        this._programCache[fragSrc] = prog;
        return prog;
    }

    /**
     * Create a program with custom vertex and fragment shaders (for line/overlay rendering).
     */
    createProgramRaw(vertSrc, fragSrc) {
        const gl = this.gl;
        const vs = this.compileShader(gl.VERTEX_SHADER, vertSrc);
        const fs = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(prog));
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        prog._uniforms = {};
        prog._uniformTypes = {};
        const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(prog, i);
            const name = info.name.replace(/\[0\]$/,'');
            prog._uniforms[name] = gl.getUniformLocation(prog, info.name);
            prog._uniformTypes[name] = info.type;
        }
        return prog;
    }

    /* ---------- Textures ---------- */

    /**
     * Create an RGBA32F texture.
     * @param {number} w
     * @param {number} h
     * @param {Float32Array|null} data
     * @returns {WebGLTexture}
     */
    createTexture32F(w, h, data = null) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex.width = w;
        tex.height = h;
        return tex;
    }

    /**
     * Create an RGBA8 texture.
     */
    createTexture8(w, h, data = null) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        tex.width = w;
        tex.height = h;
        return tex;
    }

    /**
     * Create a 256x1 texture from colormap array data.
     * @param {Uint8Array} data - 256*4 bytes RGBA
     */
    createColormapTexture(data) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    /* ---------- Framebuffers ---------- */

    /**
     * Create a framebuffer with multiple color attachments (MRT).
     * @param {WebGLTexture[]} textures
     * @returns {WebGLFramebuffer}
     */
    createFBO(textures) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const drawBuffers = [];
        for (let i = 0; i < textures.length; i++) {
            const attachment = gl.COLOR_ATTACHMENT0 + i;
            gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, textures[i], 0);
            drawBuffers.push(attachment);
        }
        gl.drawBuffers(drawBuffers);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error('Framebuffer incomplete: 0x' + status.toString(16));
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        fbo._textures = textures;
        return fbo;
    }

    /**
     * Create a pair of ping-pong framebuffers each with N RGBA32F textures.
     * Returns { texA: [tex,...], texB: [tex,...], fboA, fboB }
     */
    createDoubleFBO(w, h, count) {
        const texA = [], texB = [];
        for (let i = 0; i < count; i++) {
            texA.push(this.createTexture32F(w, h));
            texB.push(this.createTexture32F(w, h));
        }
        return {
            texA, texB,
            fboA: this.createFBO(texA),
            fboB: this.createFBO(texB),
            width: w, height: h
        };
    }

    /* ---------- Drawing ---------- */

    /**
     * Run a full-screen quad pass.
     * @param {WebGLProgram} program
     * @param {Object} uniforms - { name: value }  (float, vec2, int, sampler...)
     * @param {WebGLFramebuffer|null} target - null = draw to canvas
     * @param {number} [vpW] - viewport width
     * @param {number} [vpH] - viewport height
     */
    quad(program, uniforms, target, vpW, vpH) {
        const gl = this.gl;
        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        if (vpW !== undefined) gl.viewport(0, 0, vpW, vpH);

        // Set uniforms
        let texUnit = 0;
        for (const name in uniforms) {
            const loc = program._uniforms[name];
            if (loc === undefined || loc === null) continue;
            const val = uniforms[name];
            if (val instanceof WebGLTexture) {
                gl.activeTexture(gl.TEXTURE0 + texUnit);
                gl.bindTexture(gl.TEXTURE_2D, val);
                gl.uniform1i(loc, texUnit);
                texUnit++;
            } else if (typeof val === 'number') {
                const type = program._uniformTypes ? program._uniformTypes[name] : 0;
                if (type === gl.INT || type === gl.BOOL || type === gl.SAMPLER_2D) {
                    gl.uniform1i(loc, val);
                } else {
                    gl.uniform1f(loc, val);
                }
            } else if (Array.isArray(val)) {
                if (val.length === 2) gl.uniform2f(loc, val[0], val[1]);
                else if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
                else if (val.length === 4) gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
            }
        }

        gl.bindVertexArray(this.quadVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindVertexArray(null);
    }

    /**
     * Set integer uniform explicitly.
     */
    setUniformInt(program, name, value) {
        const gl = this.gl;
        gl.useProgram(program);
        const loc = program._uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform1i(loc, value);
    }

    /**
     * Set float array uniform (for body params etc.)
     */
    setUniformFloatArray(program, name, values) {
        const gl = this.gl;
        gl.useProgram(program);
        const loc = program._uniforms[name];
        if (loc !== undefined && loc !== null) {
            gl.uniform1fv(loc, values);
        }
    }

    setUniform4fv(program, name, values) {
        const gl = this.gl;
        gl.useProgram(program);
        const loc = program._uniforms[name];
        if (loc !== undefined && loc !== null) {
            gl.uniform4fv(loc, values);
        }
    }

    /* ---------- Readback ---------- */

    /**
     * Read a single pixel from a framebuffer's first color attachment.
     * @returns {Float32Array} [r, g, b, a]
     */
    readPixel(fbo, x, y) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const data = new Float32Array(4);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.FLOAT, data);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return data;
    }

    /**
     * Read a region from a framebuffer.
     */
    readRegion(fbo, x, y, w, h) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        const data = new Float32Array(w * h * 4);
        gl.readPixels(x, y, w, h, gl.RGBA, gl.FLOAT, data);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return data;
    }

    /* ---------- Cleanup ---------- */

    deleteTexture(tex) {
        if (tex) this.gl.deleteTexture(tex);
    }

    deleteFBO(fbo) {
        if (fbo) this.gl.deleteFramebuffer(fbo);
    }

    deleteDoubleFBO(dfbo) {
        if (!dfbo) return;
        dfbo.texA.forEach(t => this.deleteTexture(t));
        dfbo.texB.forEach(t => this.deleteTexture(t));
        this.deleteFBO(dfbo.fboA);
        this.deleteFBO(dfbo.fboB);
    }
}
