// ────────────────────────────────────────────
// renderer.js — WebGL flow field renderer
// ────────────────────────────────────────────
// Renders a scalar field as a textured quad with a colormap LUT.
// Designed for GPU migration: data upload via textures.

import { getColormapLUT } from './colormap.js';

const VERT_SRC = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
out vec2 v_texcoord;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texcoord = a_texcoord;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
in vec2 v_texcoord;
out vec4 fragColor;

uniform sampler2D u_field;
uniform sampler2D u_colormap;
uniform sampler2D u_solid;
uniform float u_minVal;
uniform float u_maxVal;
uniform vec3 u_solidColor;

void main() {
    float val = texture(u_field, v_texcoord).r;
    float solidFlag = texture(u_solid, v_texcoord).r;

    // Solid cells: render as dark
    if (solidFlag > 0.5) {
        fragColor = vec4(u_solidColor, 1.0);
        return;
    }

    // Normalize to [0, 1]
    float range = u_maxVal - u_minVal;
    float t = range > 1e-10 ? clamp((val - u_minVal) / range, 0.0, 1.0) : 0.5;

    // Sample colormap (1D texture)
    vec4 color = texture(u_colormap, vec2(t, 0.5));
    fragColor = vec4(color.rgb, 1.0);
}`;

export class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.fieldTex = null;
        this.colormapTex = null;
        this.solidTex = null;
        this.fieldNx = 0;
        this.fieldNy = 0;
        this.minVal = 0;
        this.maxVal = 0.12;
        this.autoRange = true;
        this._currentColormap = '';
        this._solidFloat = null;
        this._solidSize = 0;
        this._hasLinearFloat = false;
    }

    init() {
        const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false });
        if (!gl) throw new Error('WebGL2 not supported');
        this.gl = gl;

        // Enable float texture linear filtering
        this._hasLinearFloat = !!gl.getExtension('OES_texture_float_linear');
        gl.getExtension('EXT_color_buffer_float');

        // Compile shaders
        const vs = this._compileShader(gl.VERTEX_SHADER, VERT_SRC);
        const fs = this._compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Shader link error: ' + gl.getProgramInfoLog(this.program));
        }

        // Full-screen quad
        const quadVerts = new Float32Array([
            -1, -1,  0, 0,
             1, -1,  1, 0,
            -1,  1,  0, 1,
             1,  1,  1, 1,
        ]);
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

        const aPos = gl.getAttribLocation(this.program, 'a_position');
        const aTex = gl.getAttribLocation(this.program, 'a_texcoord');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(aTex);
        gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 16, 8);

        this.vao = vao;

        // Create textures (float textures may need NEAREST if linear not supported)
        this.fieldTex = this._createTexture(true);
        this.colormapTex = this._createTexture(false);
        this.solidTex = this._createTexture(true);

        // Uniform locations
        gl.useProgram(this.program);
        this.u_field = gl.getUniformLocation(this.program, 'u_field');
        this.u_colormap = gl.getUniformLocation(this.program, 'u_colormap');
        this.u_solid = gl.getUniformLocation(this.program, 'u_solid');
        this.u_minVal = gl.getUniformLocation(this.program, 'u_minVal');
        this.u_maxVal = gl.getUniformLocation(this.program, 'u_maxVal');
        this.u_solidColor = gl.getUniformLocation(this.program, 'u_solidColor');

        gl.uniform1i(this.u_field, 0);
        gl.uniform1i(this.u_colormap, 1);
        gl.uniform1i(this.u_solid, 2);
        gl.uniform3f(this.u_solidColor, 0.12, 0.14, 0.18);
    }

    _compileShader(type, src) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }
        return shader;
    }

    _createTexture(isFloat = false) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        const filter = (isFloat && !this._hasLinearFloat) ? gl.NEAREST : gl.LINEAR;
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    /**
     * Upload scalar field data for rendering.
     * @param {Float32Array} data — flat array [ny * nx]
     * @param {number} nx
     * @param {number} ny
     */
    setField(data, nx, ny) {
        const gl = this.gl;
        this.fieldNx = nx;
        this.fieldNy = ny;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, data);

        // Auto-range
        if (this.autoRange) {
            let min = Infinity, max = -Infinity;
            for (let i = 0; i < data.length; i++) {
                const v = data[i];
                if (v !== 0 && isFinite(v)) {
                    if (v < min) min = v;
                    if (v > max) max = v;
                }
            }
            if (min < max) {
                // Smooth range transitions
                this.minVal += (min - this.minVal) * 0.1;
                this.maxVal += (max - this.maxVal) * 0.1;
            }
        }
    }

    /**
     * Upload solid field.
     * @param {Uint8Array} solid — cell type flags
     * @param {number} nx
     * @param {number} ny
     */
    setSolid(solid, nx, ny) {
        const gl = this.gl;
        // Reuse Float32Array allocation
        const size = nx * ny;
        if (!this._solidFloat || this._solidSize !== size) {
            this._solidFloat = new Float32Array(size);
            this._solidSize = size;
        }
        for (let i = 0; i < size; i++) {
            this._solidFloat[i] = solid[i] === 1 ? 1.0 : 0.0;
        }
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.solidTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, this._solidFloat);
    }

    /**
     * Set the active colormap.
     * @param {string} name
     */
    setColormap(name) {
        if (name === this._currentColormap) return;
        this._currentColormap = name;

        const gl = this.gl;
        const lut = getColormapLUT(name);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.colormapTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut);
    }

    /** Render the flow field. */
    draw() {
        const gl = this.gl;
        if (!gl) return;

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.fieldTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.colormapTex);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.solidTex);

        gl.uniform1f(this.u_minVal, this.minVal);
        gl.uniform1f(this.u_maxVal, this.maxVal);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /** Resize canvas. */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
