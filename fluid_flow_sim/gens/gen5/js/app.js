import { PotentialFlow } from './potential.js';
import { FluidSolver } from './solver.js';
import { Utils } from './utils.js';

class App {
    constructor() {
        this.canvas = document.getElementById('sim-canvas');
        this.resize();
        
        this.mode = 'potential'; // 'potential' or 'navier'
        this.potential = new PotentialFlow(this.canvas);
        this.solver = null; // Lazy init
        
        this.colormap = null;
        this.zoom = 1.0;
        this.showGrid = false;
        this.darkMode = true;

        this.initUI();
        this.initEvents();
        
        // Initial settings
        this.updateColormap(document.getElementById('color-palette').value);
        this.toggleDarkMode(this.darkMode);
        
        this.lastTime = Date.now();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.potential) this.potential.resize(this.canvas.width, this.canvas.height);
        if (this.solver) this.solver.resize(this.canvas.width, this.canvas.height);
    }

    initUI() {
        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                const tabId = e.target.dataset.tab;
                document.getElementById(`tab-content-${tabId}`).classList.add('active');
                this.setMode(tabId);
            });
        });

        // Sidebar toggle
        document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        // Potential Flow Controls
        document.getElementById('potential-scenario').addEventListener('change', (e) => {
            this.potential.loadScenario(e.target.value);
            this.updateElementsList();
        });

        document.getElementById('show-streamlines').addEventListener('change', (e) => {
            this.potential.config.showStreamlines = e.target.checked;
        });
        document.getElementById('show-potential').addEventListener('change', (e) => {
            this.potential.config.showPotential = e.target.checked;
        });
        document.getElementById('show-velocity').addEventListener('change', (e) => {
            this.potential.config.showVelocity = e.target.checked;
        });
        document.getElementById('line-density').addEventListener('input', (e) => {
            this.potential.config.density = parseInt(e.target.value);
        });

        // Navier-Stokes Controls
        const bindNS = (id, param, scale = 1) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    if (this.solver) this.solver.config[param] = parseFloat(e.target.value) * scale;
                });
            }
        };
        bindNS('ns-viscosity', 'viscosity');
        bindNS('ns-dissipation', 'dissipation');
        bindNS('ns-dt', 'dt');
        bindNS('ns-iterations', 'iterations');
        bindNS('ns-force', 'force');
        
        document.getElementById('ns-reset').addEventListener('click', () => {
            // Re-init solver
            if (this.solver) {
                this.solver.initBuffers();
            }
        });

        // Global
        document.getElementById('color-palette').addEventListener('change', (e) => {
            this.updateColormap(e.target.value);
        });
        document.getElementById('show-grid').addEventListener('change', (e) => {
            this.showGrid = e.target.checked;
            if (this.potential) this.potential.config.showGrid = this.showGrid;
            // NS grid handled in render
        });
        document.getElementById('dark-mode').addEventListener('change', (e) => {
            this.toggleDarkMode(e.target.checked);
        });
    }

    toggleDarkMode(enabled) {
        this.darkMode = enabled;
        if (enabled) {
            document.body.classList.remove('light-mode');
        } else {
            document.body.classList.add('light-mode');
        }
    }

    updateElementsList() {
        const list = document.getElementById('elements-list');
        list.innerHTML = '';
        this.potential.elements.forEach(el => {
            const div = document.createElement('div');
            div.className = 'element-item';
            div.innerHTML = `
                <div class="element-header">
                    <span>${el.type}</span>
                    <button class="remove-btn" onclick="app.removeElement(${el.id})">x</button>
                </div>
                <div>
                    ${Object.keys(el).filter(k => k !== 'id' && k !== 'type').map(k => `
                        <label style="font-size:0.8em">${k}: <input type="number" value="${el[k]}" step="0.1" 
                            onchange="app.updateElement(${el.id}, '${k}', this.value)"></label>
                    `).join('')}
                </div>
            `;
            list.appendChild(div);
        });
    }

    removeElement(id) {
        this.potential.removeElement(id);
        this.updateElementsList();
    }

    addElement(type) {
        this.potential.addElement(type);
        this.updateElementsList();
    }

    updateElement(id, key, value) {
        const el = this.potential.elements.find(e => e.id === id);
        if (el) {
            el[key] = parseFloat(value);
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'navier') {
            if (!this.solver) {
                this.solver = new FluidSolver(this.canvas);
                this.updateColormap(document.getElementById('color-palette').value);
            }
        }
    }

    updateColormap(name) {
        this.colormapName = name;
        if (this.solver) {
            this.colormap = Utils.createColormapTexture(this.solver.gl, name);
        }
        if (this.potential) {
            this.potential.setColormap(name);
        }
    }

    initEvents() {
        window.addEventListener('resize', () => this.resize());
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'h') {
                document.getElementById('ui-layer').classList.toggle('hidden');
            }
        });

        // Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(0.1, Math.min(this.zoom, 10.0));
            
            if (this.potential) this.potential.setZoom(this.zoom);
            if (this.solver) this.solver.setZoom(this.zoom);
        }, { passive: false });

        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        this.canvas.addEventListener('mouseup', () => isDragging = false);
        this.canvas.addEventListener('mousemove', (e) => {
            const x = e.clientX;
            const y = e.clientY;
            
            // Probe
            this.updateProbe(x, y);

            if (isDragging && this.mode === 'navier' && this.solver) {
                const dx = x - lastX;
                const dy = y - lastY;
                // Normalize coordinates to 0..1
                const u = x / this.canvas.width;
                const v = 1.0 - y / this.canvas.height; // WebGL Y is up
                
                this.solver.addForce(u, v, dx, -dy); // Invert dy for WebGL
            }
            lastX = x;
            lastY = y;
        });
    }

    updateProbe(x, y) {
        const probe = document.getElementById('probe-tool');
        const content = document.getElementById('probe-values');
        
        // Only show if hovering over canvas and not UI
        // Simple check: if target is canvas
        
        if (this.mode === 'potential') {
            const vel = this.potential.getVelocity(x, y);
            const pot = this.potential.getPotential(x, y);
            content.innerHTML = `
                <div>Phi: ${pot.phi.toFixed(2)}</div>
                <div>Psi: ${pot.psi.toFixed(2)}</div>
                <div>Vel: ${vel.mag.toFixed(2)}</div>
                <div>(u: ${vel.u.toFixed(2)}, v: ${vel.v.toFixed(2)})</div>
            `;
            probe.classList.remove('hidden');
        } else if (this.mode === 'navier' && this.solver) {
            // Reading pixels from WebGL is slow (readPixels), so we might skip real-time probe for NS
            // or do it only on click.
            // For now, let's just show coordinates
            content.innerHTML = `<div>Probe not available in GPU mode</div>`;
            probe.classList.remove('hidden');
        }
    }

    loop() {
        const now = Date.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        if (this.mode === 'potential') {
            this.potential.draw();
        } else if (this.mode === 'navier' && this.solver) {
            this.solver.step(this.solver.config.dt); // Use fixed time step for stability
            const quantity = document.getElementById('ns-quantity').value;
            this.solver.render(this.colormap, quantity, this.showGrid);
        }

        requestAnimationFrame(this.loop);
    }
}

// Expose app to window for HTML onclick handlers
window.app = new App();
window.app.potential.addElement = window.app.potential.addElement.bind(window.app.potential);
