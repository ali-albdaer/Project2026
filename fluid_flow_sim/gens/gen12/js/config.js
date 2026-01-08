/**
 * Configuration and Constants
 * Central configuration for the flow simulation
 */

export const Config = {
    // Simulation
    simulation: {
        timeStep: 0.016,          // 60 FPS target
        maxTimeStep: 0.05,        // Cap for stability
        substeps: 2,              // Physics substeps per frame
    },
    
    // Particles
    particles: {
        maxCount: 2000,
        spawnRate: 50,            // Particles per second
        size: 2,
        lifespan: 10,             // Seconds
        trailLength: 20,          // Points in trail
    },
    
    // Visualization
    visualization: {
        showParticles: true,
        showVelocityVectors: true,
        showStreamlines: false,
        showStreaklines: false,
        showStaticVectors: false,
        streamlineDensity: 20,
        lineOpacity: 0.7,
        vectorScale: 15,
        staticVectorGridSize: 40,
    },
    
    // Fluid Properties
    fluid: {
        viscosity: 0.01,          // Dynamic viscosity (Pa·s)
        temperature: 293,         // Kelvin
        density: 1.0,             // kg/m³
    },
    
    // Boundaries
    boundaries: {
        dynamic: true,            // Use screen edges
        periodic: false,          // Wrap particles
        conserveParticles: false, // Infinite lifespan
        mapWidth: 2000,
        mapHeight: 2000,
    },
    
    // View
    view: {
        zoom: 1.0,
        minZoom: 0.1,
        maxZoom: 10.0,
        panX: 0,
        panY: 0,
    },
    
    // Colors
    colors: {
        quantity: 'none',         // What to color by
        palette: 'viridis',       // Color palette name
        vectorMode: 'length',     // How to show vector magnitude
    },
    
    // Probe
    probe: {
        enabled: true,
        quantities: {
            velocity: true,
            pressure: true,
            density: true,
            temperature: true,
            streamFunction: true,
            potentialFunction: true,
            vorticity: false,
        }
    },
    
    // Physics constants
    physics: {
        gasConstant: 287.05,      // J/(kg·K) for air
        gamma: 1.4,               // Ratio of specific heats for air
        referenceTemp: 293,       // Reference temperature (K)
        referencePressure: 101325, // Reference pressure (Pa)
    }
};

// State management for real-time updates
export const State = {
    isPlaying: true,
    time: 0,
    fps: 60,
    lastFrameTime: 0,
    frameCount: 0,
    
    // Mouse state
    mouse: {
        x: 0,
        y: 0,
        worldX: 0,
        worldY: 0,
        isDown: false,
        button: 0,
        dragStart: null,
        draggingElement: null,
    },
    
    // UI state
    ui: {
        hidden: false,
        leftMenuCollapsed: false,
        rightMenuCollapsed: false,
        selectedElement: null,
        editingElement: null,
    },
    
    // Flow elements (active in simulation)
    flowElements: [],
    
    // Particles
    particles: [],
    
    // Streamlines cache
    streamlines: [],
    streaklines: [],
    
    // Performance
    lastFpsUpdate: 0,
    fpsHistory: [],
};

// Element ID counter
let elementIdCounter = 0;
export function generateElementId() {
    return ++elementIdCounter;
}

// Deep clone utility for config
export function cloneConfig(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Update configuration
export function updateConfig(path, value) {
    const keys = path.split('.');
    let current = Config;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}
