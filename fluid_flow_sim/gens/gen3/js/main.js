class App {
    constructor() {
        this.canvas = document.getElementById('sim-canvas');
        this.renderer = new Renderer(this.canvas);
        
        this.kinematics = new KinematicsSim(this.renderer);
        this.potential = new PotentialSim(this.renderer);
        this.navier = new NavierStokesSim(this.renderer);
        
        this.ui = new UI(this);
        
        this.mode = 'kinematics'; // kinematics, potential, navier
        this.vizMode = 'velocity'; // velocity, pressure, curl, divergence
        
        // Initial setup
        this.kinematics.updateEquations(
            document.getElementById('u-eqn').value,
            document.getElementById('v-eqn').value
        );
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.renderer.resize(rect.width, rect.height);
    }
    
    loop(t) {
        const dt = Math.min((t - this.lastTime) / 1000, 0.1);
        this.lastTime = t;
        
        if (this.mode === 'kinematics') {
            this.kinematics.update(dt);
            this.kinematics.draw(this.vizMode);
        } else if (this.mode === 'potential') {
            this.potential.update(dt);
            this.potential.draw(this.vizMode);
        } else if (this.mode === 'navier') {
            this.navier.update(dt);
            this.navier.draw(this.vizMode);
        }
        
        requestAnimationFrame((t) => this.loop(t));
    }
}

window.onload = () => {
    window.app = new App();
    // Initialize potential list
    updatePotentialList();
};
