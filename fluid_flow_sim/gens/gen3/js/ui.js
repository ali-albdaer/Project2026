class UI {
    constructor(main) {
        this.main = main;
        this.setupTabs();
        this.setupControls();
        this.setupCanvas();
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                document.querySelectorAll('.control-panel').forEach(p => p.classList.remove('active'));
                document.getElementById(`${tab.dataset.tab}-controls`).classList.add('active');
                
                this.main.setMode(tab.dataset.tab);
            });
        });
    }

    setupControls() {
        // Kinematics
        const uEq = document.getElementById('u-eqn');
        const vEq = document.getElementById('v-eqn');
        const updateKinematics = () => {
            if (this.main.mode === 'kinematics') {
                this.main.kinematics.updateEquations(uEq.value, vEq.value);
            }
        };
        uEq.addEventListener('change', updateKinematics);
        vEq.addEventListener('change', updateKinematics);

        // Navier-Stokes
        document.getElementById('viscosity').addEventListener('input', (e) => {
            this.main.navier.viscosity = parseFloat(e.target.value);
            document.getElementById('ns-mode').innerText = this.main.navier.viscosity > 0 ? "Viscous (Navier-Stokes)" : "Inviscid (Euler)";
        });
        document.getElementById('density').addEventListener('input', (e) => {
            this.main.navier.density = parseFloat(e.target.value);
        });
        document.getElementById('timestep').addEventListener('input', (e) => {
            this.main.navier.dt = parseFloat(e.target.value);
        });
        document.getElementById('paused').addEventListener('change', (e) => {
            this.main.navier.paused = e.target.checked;
        });
        document.getElementById('reset-sim').addEventListener('click', () => {
            // Reset logic
        });

        // Visualization
        document.getElementById('colormap').addEventListener('change', (e) => {
            this.main.vizMode = e.target.value;
        });
    }

    setupCanvas() {
        const canvas = document.getElementById('sim-canvas');
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = 1.0 - (e.clientY - rect.top) / rect.height; // Flip Y for WebGL
            
            // Probe
            this.updateProbe(x, y);
            
            // Interaction
            if (isDragging && this.main.mode === 'navier') {
                const dx = x - lastX;
                const dy = y - lastY;
                this.main.navier.addForce(x, y, dx, dy);
            }
            
            lastX = x;
            lastY = y;
        });

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = canvas.getBoundingClientRect();
            lastX = (e.clientX - rect.left) / rect.width;
            lastY = 1.0 - (e.clientY - rect.top) / rect.height;
        });

        canvas.addEventListener('mouseup', () => isDragging = false);
        canvas.addEventListener('mouseleave', () => isDragging = false);
    }

    updateProbe(x, y) {
        let data = { u: 0, v: 0, val: 0 };
        if (this.main.mode === 'kinematics') data = this.main.kinematics.getProbe(x, y);
        else if (this.main.mode === 'potential') data = this.main.potential.getProbe(x, y);
        else if (this.main.mode === 'navier') data = this.main.navier.getProbe(x, y);

        document.getElementById('probe-pos').innerText = `${x.toFixed(2)}, ${y.toFixed(2)}`;
        document.getElementById('probe-vel').innerText = `${data.u.toFixed(2)}, ${data.v.toFixed(2)}`;
        document.getElementById('probe-val').innerText = (data.val || 0).toFixed(2);
        
        // Update derived quantities for Kinematics
        if (this.main.mode === 'kinematics') {
            document.getElementById('val-div').innerText = (data.div || 0).toFixed(2);
            document.getElementById('val-vort').innerText = (data.curl || 0).toFixed(2);
        }
    }
}

// Global function for Potential buttons
window.addPotentialElement = (type) => {
    if (window.app && window.app.potential) {
        window.app.potential.addElement(type);
        // Update list UI
        updatePotentialList();
    }
};

function updatePotentialList() {
    const list = document.getElementById('potential-list');
    list.innerHTML = '';
    window.app.potential.elements.forEach((el, idx) => {
        const div = document.createElement('div');
        div.className = 'element-item';
        div.innerHTML = `
            <span>${el.type}</span>
            <button class="remove-btn" onclick="removePotentialElement(${idx})">x</button>
        `;
        list.appendChild(div);
    });
}

window.removePotentialElement = (idx) => {
    if (window.app && window.app.potential) {
        window.app.potential.removeElement(idx);
        updatePotentialList();
    }
};
