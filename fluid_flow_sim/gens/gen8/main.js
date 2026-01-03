// Main Application Controller
class FluidSimApp {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.setupCanvas();
        
        this.mode = 'potential'; // 'potential' or 'navier-stokes'
        this.isPaused = false;
        this.animationId = null;
        
        // Initialize simulators
        this.potentialFlow = new PotentialFlow(this.canvas.width, this.canvas.height);
        this.navierStokes = new NavierStokesSolver(this.canvas.width, this.canvas.height, 8);
        
        // Initialize visualizer
        this.visualizer = new FlowVisualizer(this.canvas, this.potentialFlow);
        
        // Add default obstacle for NS
        this.navierStokes.addCircularObstacle(
            this.canvas.width / 3,
            this.canvas.height / 2,
            40
        );
        
        this.setupEventListeners();
        this.setupUI();
        this.start();
    }

    setupCanvas() {
        const container = document.getElementById('canvasContainer');
        const maxWidth = window.innerWidth - 400; // Account for control panel
        const maxHeight = window.innerHeight - 100; // Account for header
        
        this.canvas.width = Math.min(1200, maxWidth);
        this.canvas.height = Math.min(800, maxHeight);
    }

    setupEventListeners() {
        // Mode switching
        document.getElementById('potentialModeBtn').addEventListener('click', () => {
            this.switchMode('potential');
        });
        
        document.getElementById('navierStokesModeBtn').addEventListener('click', () => {
            this.switchMode('navier-stokes');
        });
        
        // UI toggle
        document.getElementById('toggleUIBtn').addEventListener('click', () => {
            document.getElementById('controlPanel').classList.toggle('hidden');
        });
        
        // Visualization options
        document.getElementById('showStreamlines').addEventListener('change', (e) => {
            this.visualizer.showStreamlines = e.target.checked;
        });
        
        document.getElementById('showPotentialLines').addEventListener('change', (e) => {
            this.visualizer.showPotentialLines = e.target.checked;
        });
        
        document.getElementById('showVelocityField').addEventListener('change', (e) => {
            this.visualizer.showVelocityField = e.target.checked;
        });
        
        document.getElementById('showColorMap').addEventListener('change', (e) => {
            this.visualizer.showColorMap = e.target.checked;
        });
        
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.visualizer.showGrid = e.target.checked;
        });
        
        document.getElementById('colorQuantity').addEventListener('change', (e) => {
            this.visualizer.colorQuantity = e.target.value;
        });
        
        document.getElementById('colorPalette').addEventListener('change', (e) => {
            this.visualizer.colorPalette = e.target.value;
        });
        
        // Potential flow controls
        document.getElementById('scenarioSelect').addEventListener('change', (e) => {
            if (e.target.value !== 'custom') {
                this.potentialFlow.loadScenario(e.target.value);
                this.updateFlowList();
            }
        });
        
        document.getElementById('addFlowBtn').addEventListener('click', () => {
            this.showFlowModal();
        });
        
        // Navier-Stokes controls
        document.getElementById('viscosity').addEventListener('change', (e) => {
            this.navierStokes.viscosity = parseFloat(e.target.value);
        });
        
        document.getElementById('density').addEventListener('change', (e) => {
            this.navierStokes.density_value = parseFloat(e.target.value);
        });
        
        document.getElementById('timeStep').addEventListener('change', (e) => {
            this.navierStokes.dt = parseFloat(e.target.value);
        });
        
        document.getElementById('iterations').addEventListener('change', (e) => {
            this.navierStokes.iterations = parseInt(e.target.value);
        });
        
        document.getElementById('enableObstacle').addEventListener('change', (e) => {
            if (!e.target.checked) {
                this.navierStokes.clearObstacles();
            } else {
                this.navierStokes.addCircularObstacle(
                    this.canvas.width / 3,
                    this.canvas.height / 2,
                    40
                );
            }
        });
        
        document.getElementById('resetSimBtn').addEventListener('click', () => {
            this.navierStokes.reset();
            if (document.getElementById('enableObstacle').checked) {
                this.navierStokes.addCircularObstacle(
                    this.canvas.width / 3,
                    this.canvas.height / 2,
                    40
                );
            }
        });
        
        document.getElementById('pauseSimBtn').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            document.getElementById('pauseSimBtn').textContent = 
                this.isPaused ? 'Resume' : 'Pause';
        });
        
        // Probe tool
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleProbe(e);
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            document.getElementById('probeInfo').classList.add('hidden');
        });
        
        // Click to add flow element (potential flow mode)
        this.canvas.addEventListener('click', (e) => {
            if (this.mode === 'potential' && this.clickToAddFlow) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                this.addFlowAtPosition(x, y);
            }
        });
    }

    setupUI() {
        this.updateFlowList();
    }

    switchMode(newMode) {
        this.mode = newMode;
        
        // Update button states
        document.getElementById('potentialModeBtn').classList.toggle('active', newMode === 'potential');
        document.getElementById('navierStokesModeBtn').classList.toggle('active', newMode === 'navier-stokes');
        
        // Toggle control panels
        document.getElementById('potentialControls').classList.toggle('hidden', newMode !== 'potential');
        document.getElementById('navierStokesControls').classList.toggle('hidden', newMode !== 'navier-stokes');
        
        // Switch simulator
        if (newMode === 'potential') {
            this.visualizer.simulator = this.potentialFlow;
        } else {
            this.visualizer.simulator = this.navierStokes;
        }
    }

    handleProbe(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const probeInfo = document.getElementById('probeInfo');
        probeInfo.classList.remove('hidden');
        probeInfo.style.left = (e.clientX + 15) + 'px';
        probeInfo.style.top = (e.clientY + 15) + 'px';
        
        const simulator = this.mode === 'potential' ? this.potentialFlow : this.navierStokes;
        const vel = simulator.getVelocity(x, y);
        
        let html = `<div><strong>Position:</strong> (${x.toFixed(1)}, ${y.toFixed(1)})</div>`;
        html += `<div><strong>Velocity:</strong> ${vel.magnitude.toFixed(3)}</div>`;
        html += `<div><strong>u:</strong> ${vel.u.toFixed(3)}, <strong>v:</strong> ${vel.v.toFixed(3)}</div>`;
        
        if (this.mode === 'potential') {
            const psi = this.potentialFlow.getStreamFunction(x, y);
            const phi = this.potentialFlow.getPotentialFunction(x, y);
            const cp = this.potentialFlow.getPressureCoefficient(x, y, 10);
            html += `<div><strong>ψ:</strong> ${psi.toFixed(3)}</div>`;
            html += `<div><strong>φ:</strong> ${phi.toFixed(3)}</div>`;
            html += `<div><strong>Cp:</strong> ${cp.toFixed(3)}</div>`;
        } else {
            const p = this.navierStokes.getPressure(x, y);
            const vort = this.navierStokes.getVorticity(x, y);
            const rho = this.navierStokes.getDensity(x, y);
            html += `<div><strong>Pressure:</strong> ${p.toFixed(3)}</div>`;
            html += `<div><strong>Vorticity:</strong> ${vort.toFixed(3)}</div>`;
            html += `<div><strong>Density:</strong> ${rho.toFixed(3)}</div>`;
        }
        
        probeInfo.innerHTML = html;
    }

    showFlowModal() {
        const modal = document.getElementById('flowModal');
        modal.classList.remove('hidden');
        
        const flowType = document.getElementById('flowType');
        this.updateFlowParams(flowType.value);
        
        flowType.addEventListener('change', (e) => {
            this.updateFlowParams(e.target.value);
        });
        
        document.getElementById('addFlowConfirm').onclick = () => {
            this.confirmAddFlow();
            modal.classList.add('hidden');
        };
        
        document.getElementById('cancelFlowBtn').onclick = () => {
            modal.classList.add('hidden');
        };
    }

    updateFlowParams(flowType) {
        const paramsDiv = document.getElementById('flowParams');
        let html = '';
        
        html += `<label>X: <input type="number" id="flowX" value="${this.canvas.width / 2}"></label>`;
        html += `<label>Y: <input type="number" id="flowY" value="${this.canvas.height / 2}"></label>`;
        
        switch (flowType) {
            case 'uniform':
                html += `<label>Velocity (U): <input type="number" id="flowParam1" value="10" step="0.5"></label>`;
                html += `<label>Angle (deg): <input type="number" id="flowParam2" value="0" step="5"></label>`;
                break;
            case 'source':
            case 'sink':
                html += `<label>Strength (m): <input type="number" id="flowParam1" value="500" step="10"></label>`;
                break;
            case 'vortex':
                html += `<label>Circulation (Γ): <input type="number" id="flowParam1" value="300" step="10"></label>`;
                break;
            case 'doublet':
                html += `<label>Strength (κ): <input type="number" id="flowParam1" value="2000" step="100"></label>`;
                break;
        }
        
        paramsDiv.innerHTML = html;
    }

    confirmAddFlow() {
        const flowType = document.getElementById('flowType').value;
        const x = parseFloat(document.getElementById('flowX').value);
        const y = parseFloat(document.getElementById('flowY').value);
        const param1 = document.getElementById('flowParam1') ? 
                      parseFloat(document.getElementById('flowParam1').value) : 0;
        const param2 = document.getElementById('flowParam2') ? 
                      parseFloat(document.getElementById('flowParam2').value) : 0;
        
        let params = { x, y };
        
        switch (flowType) {
            case 'uniform':
                params.U = param1;
                params.angle = param2;
                break;
            case 'source':
            case 'sink':
                params.m = param1;
                break;
            case 'vortex':
                params.Gamma = param1;
                break;
            case 'doublet':
                params.kappa = param1;
                break;
        }
        
        this.potentialFlow.addFlow(flowType, params);
        this.updateFlowList();
        document.getElementById('scenarioSelect').value = 'custom';
    }

    updateFlowList() {
        const flowList = document.getElementById('flowList');
        flowList.innerHTML = '';
        
        for (const flow of this.potentialFlow.flows) {
            const div = document.createElement('div');
            div.className = 'flow-item';
            
            let paramStr = '';
            switch (flow.type) {
                case 'uniform':
                    paramStr = `U=${flow.params.U}, θ=${flow.params.angle}°`;
                    break;
                case 'source':
                case 'sink':
                    paramStr = `m=${flow.params.m}`;
                    break;
                case 'vortex':
                    paramStr = `Γ=${flow.params.Gamma}`;
                    break;
                case 'doublet':
                    paramStr = `κ=${flow.params.kappa}`;
                    break;
            }
            
            div.innerHTML = `
                <div class="flow-item-info">
                    <div class="flow-item-type">${flow.type.charAt(0).toUpperCase() + flow.type.slice(1)}</div>
                    <div class="flow-item-params">${paramStr} @ (${flow.params.x.toFixed(0)}, ${flow.params.y.toFixed(0)})</div>
                </div>
                <button class="flow-item-remove" data-id="${flow.id}">Remove</button>
            `;
            
            div.querySelector('.flow-item-remove').addEventListener('click', (e) => {
                this.potentialFlow.removeFlow(parseInt(e.target.dataset.id));
                this.updateFlowList();
                document.getElementById('scenarioSelect').value = 'custom';
            });
            
            flowList.appendChild(div);
        }
    }

    update() {
        if (this.isPaused) return;
        
        if (this.mode === 'navier-stokes') {
            const inletVelocity = parseFloat(document.getElementById('inletVelocity').value) || 5.0;
            this.navierStokes.step(inletVelocity);
        }
    }

    render() {
        this.visualizer.render();
    }

    animate() {
        this.update();
        this.render();
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    start() {
        // Load default scenario
        this.potentialFlow.loadScenario('cylinder');
        this.updateFlowList();
        document.getElementById('scenarioSelect').value = 'cylinder';
        
        this.animate();
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FluidSimApp();
});
