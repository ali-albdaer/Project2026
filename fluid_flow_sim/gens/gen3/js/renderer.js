class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            console.error("WebGL2 not supported");
            return;
        }
        
        this.width = canvas.width;
        this.height = canvas.height;
        
        this.ext = this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('OES_texture_float_linear');

        // Fullscreen quad
        this.quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1, 1, 1
        ]), this.gl.STATIC_DRAW);

        this.programs = {};
        this.initShaders();
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.width = w;
        this.height = h;
        this.gl.viewport(0, 0, w, h);
    }

    createShader(vertSrc, fragSrc) {
        const gl = this.gl;
        const vert = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vert, vertSrc);
        gl.compileShader(vert);
        if (!gl.getShaderParameter(vert, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(vert));
        }

        const frag = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(frag, fragSrc);
        gl.compileShader(frag);
        if (!gl.getShaderParameter(frag, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(frag));
        }

        const prog = gl.createProgram();
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        return prog;
    }

    initShaders() {
        const vert = `#version 300 es
        in vec2 a_position;
        out vec2 v_uv;
        void main() {
            v_uv = a_position * 0.5 + 0.5;
            gl_Position = vec4(a_position, 0, 1);
        }`;

        const displayFrag = `#version 300 es
        precision highp float;
        in vec2 v_uv;
        uniform sampler2D u_field;
        uniform int u_type; // 0: scalar, 1: vector
        uniform int u_channel; // 0:r, 1:g, 2:b, 3:a
        uniform float u_scale;
        out vec4 outColor;

        vec3 turbo(float t) {
            // Turbo colormap approximation
            const vec3 c0 = vec3(0.114089010972696, 0.062865986931743, 0.224861094036412);
            const vec3 c1 = vec3(0.669932747744728, 0.599971292988144, -0.008893463448561);
            const vec3 c2 = vec3(0.112396442273656, -1.71196135326086, 0.006622040719053);
            const vec3 c3 = vec3(-2.43027553728467, 1.35968335426845, 2.93228707973477);
            const vec3 c4 = vec3(2.75397635191474, -2.38083112701648, -3.28831522154567);
            const vec3 c5 = vec3(-0.08470040853713, 0.608500985383333, 0.61452105550527);
            return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * c5))));
        }

        void main() {
            vec4 val = texture(u_field, v_uv);
            vec3 color = vec3(0.0);
            
            if (u_type == 0) { // Scalar
                float v = 0.0;
                if (u_channel == 0) v = val.r;
                else if (u_channel == 1) v = val.g;
                else if (u_channel == 2) v = val.b;
                else if (u_channel == 3) v = val.a;
                
                float t = clamp(v * u_scale + 0.5, 0.0, 1.0);
                color = turbo(t);
            } else if (u_type == 1) { // Vector (Velocity) - always uses RG
                float mag = length(val.rg);
                float t = clamp(mag * u_scale, 0.0, 1.0);
                color = turbo(t);
            }
            
            outColor = vec4(color, 1.0);
        }`;

        this.programs.display = this.createShader(vert, displayFrag);
    }

    createTexture(width, height, data = null) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
    }

    createFramebuffer(tex) {
        const gl = this.gl;
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        return fbo;
    }

    // Helper to run a shader program
    runProgram(prog, uniforms, outputFbo) {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, outputFbo);
        // We need to set viewport to the FBO size.
        // Assuming FBO texture size matches sim size.
        // Let's pass width/height or assume it matches renderer.width/height if we resize renderer to sim size?
        // No, renderer.width is canvas size.
        // Let's assume 128x128 for now or pass it.
        // Better: check texture size attached to FBO? Too slow.
        // Let's just use a fixed sim size for now: 128x128.
        gl.viewport(0, 0, 128, 128); 
        
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);
        
        let texUnit = 0;
        for (const [name, obj] of Object.entries(uniforms)) {
            const loc = gl.getUniformLocation(prog, name);
            if (obj.type === '1f') gl.uniform1f(loc, obj.value);
            else if (obj.type === '1i') gl.uniform1i(loc, obj.value);
            else if (obj.type === '2f') gl.uniform2f(loc, obj.value[0], obj.value[1]);
            else if (obj.type === 'tex') {
                gl.activeTexture(gl.TEXTURE0 + texUnit);
                gl.bindTexture(gl.TEXTURE_2D, obj.value);
                gl.uniform1i(loc, texUnit);
                texUnit++;
            }
        }
        
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    drawTexture(tex, type, scale = 1.0, channel = 0) {
        const gl = this.gl;
        gl.useProgram(this.programs.display);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(0);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(this.programs.display, "u_field"), 0);
        gl.uniform1i(gl.getUniformLocation(this.programs.display, "u_type"), type);
        gl.uniform1i(gl.getUniformLocation(this.programs.display, "u_channel"), channel);
        gl.uniform1f(gl.getUniformLocation(this.programs.display, "u_scale"), scale);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
