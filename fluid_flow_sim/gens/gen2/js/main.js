import { Renderer } from './renderer.js';
import { PotentialFlow } from './simulations/potential.js';
import { ViscousFlow } from './simulations/viscous.js';
import { NavierStokes } from './simulations/navier_stokes.js';

const canvas = document.getElementById('sim-canvas');
const renderer = new Renderer(canvas);
const uiContainer = document.getElementById('controls-container');
const mathContainer = document.getElementById('math-container');
const equationEditor = document.getElementById('equation-editor');
const probeReadout = document.getElementById('probe-readout');
const probeToggle = document.getElementById('probe-toggle');
const fpsCounter = document.getElementById('fps-counter');

let currentSim = null;
let isProbeEnabled = false;
let lastTime = 0;

const simulations = {
    'potential': PotentialFlow,
    'viscous': ViscousFlow,
    'navier': NavierStokes
};

function setSimulation(type) {
    if (currentSim && currentSim.destroy) currentSim.destroy();
    
    const SimClass = simulations[type];
    currentSim = new SimClass(renderer, uiContainer);
    
    updateMathDisplay();
}

function updateMathDisplay() {
    if (currentSim && currentSim.getEquationHTML) {
        mathContainer.innerHTML = currentSim.getEquationHTML();
        // Re-render MathJax
        if (window.MathJax) {
            MathJax.typesetPromise([mathContainer]);
        }
    }
}

// Event Listeners
document.getElementById('sim-type').addEventListener('change', (e) => {
    setSimulation(e.target.value);
});

document.getElementById('visualization-type').addEventListener('change', (e) => {
    // Handled in render loop
});

probeToggle.addEventListener('change', (e) => {
    isProbeEnabled = e.target.checked;
    if (!isProbeEnabled) probeReadout.classList.add('hidden');
});

// Mouse Interaction
let isMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastMouseX = e.offsetX;
    lastMouseY = e.offsetY;
});

canvas.addEventListener('mouseup', () => isMouseDown = false);
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalized coordinates 0-1
    const u = x / canvas.width;
    const v = 1.0 - y / canvas.height; // Flip Y for GL

    // Probe
    if (isProbeEnabled && currentSim.getProbeValue) {
        probeReadout.classList.remove('hidden');
        probeReadout.style.left = (e.clientX + 15) + 'px';
        probeReadout.style.top = (e.clientY + 15) + 'px';
        
        const val = currentSim.getProbeValue(u, v);
        document.getElementById('probe-x').innerText = val.x;
        document.getElementById('probe-y').innerText = val.y;
        document.getElementById('probe-u').innerText = val.u;
        document.getElementById('probe-v').innerText = val.v;
        document.getElementById('probe-val').innerText = val.val;
    } else {
        probeReadout.classList.add('hidden');
    }

    // Interaction (Splatting for Navier-Stokes)
    if (isMouseDown && currentSim instanceof NavierStokes) {
        const dx = (x - lastMouseX) * 5.0;
        const dy = (lastMouseY - y) * 5.0; // Flip Y delta
        
        // Add dye color based on time
        const time = Date.now() * 0.001;
        const color = {
            r: Math.sin(time) * 0.5 + 0.5,
            g: Math.sin(time + 2) * 0.5 + 0.5,
            b: Math.sin(time + 4) * 0.5 + 0.5
        };

        currentSim.splat(u, v, dx, dy, color);
    }

    lastMouseX = x;
    lastMouseY = y;
});

// Equation Editor (Simple parameter injection for now)
document.getElementById('apply-equation').addEventListener('click', () => {
    // Advanced: Could eval() code here to override methods, but risky.
    // For now, just re-init sim to reset.
    // Or parse JSON params.
    try {
        const txt = equationEditor.value;
        if (txt.trim().startsWith('{')) {
            const params = JSON.parse(txt);
            Object.assign(currentSim.params, params);
            if (currentSim.initUI) currentSim.initUI(); // Refresh sliders
        }
    } catch (e) {
        console.error("Invalid JSON params");
    }
});

// Main Loop
function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    fpsCounter.innerText = `FPS: ${Math.round(1/dt)}`;

    const vizType = document.getElementById('visualization-type').value;
    
    if (currentSim) {
        currentSim.render(vizType);
    }

    requestAnimationFrame(loop);
}

// Init
setSimulation('potential');
requestAnimationFrame(loop);
