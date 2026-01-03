# Fluid Flow Simulation

An interactive web application for visualizing various fluid mechanics concepts and flow patterns in real-time.

## Features

### Flow Types Supported
- **Uniform Flow** - Constant velocity field
- **Source/Sink Flow** - Radial flow from/to a point
- **Irrotational Vortex** - Circular flow around a point
- **Doublet Flow** - Combination of source and sink
- **Half-Body Flow** - Flow around a streamlined body (Uniform + Source)
- **Cylinder Flow** - Potential flow around circular cylinder (Uniform + Doublet)
- **Cylinder with Circulation** - Cylinder flow with Magnus effect (Uniform + Doublet + Vortex)
- **Poiseuille Flow** - Viscous flow between parallel plates
- **Couette Flow** - Viscous shear flow
- **Custom Flow** - User-defined velocity field equations

### Visualization Modes
- **Velocity Magnitude** - Color-coded velocity field
- **Pressure Distribution** - Pressure field visualization
- **Streamlines** - Flow path visualization
- **Vorticity** - Local fluid rotation
- **Velocity Vectors** - Arrow field showing velocity direction and magnitude
- **Velocity Potential** - Potential function contours
- **Stream Function** - Stream function contours

### Interactive Features
- Real-time parameter adjustment
- Multiple color maps (Viridis, Plasma, Jet, Cool-Warm, Rainbow)
- Mouse probe tool for detailed flow information
- Customizable equation editor
- Grid and boundary visualization
- Export/import simulation configurations

## Mathematical Background

This simulation implements solutions to fundamental fluid mechanics equations:

### Continuity Equation (Conservation of Mass)
```
∂ρ/∂t + ∇·(ρV) = 0
```
For incompressible flow: `∇·V = 0`

### Momentum Conservation (Navier-Stokes)
```
ρ(∂V/∂t + (V·∇)V) = -∇p + ρg + μ∇²V
```

### Stream Function (ψ)
For 2D incompressible flow:
- `u = ∂ψ/∂y`
- `v = -∂ψ/∂x`
- Streamlines: `ψ = constant`

### Velocity Potential (φ)
For irrotational flow:
- `u = ∂φ/∂x`
- `v = ∂φ/∂y`
- Governing equation: `∇²φ = 0` (Laplace's equation)

### Elementary Flows
1. **Uniform Flow**: `ψ = Uy`, `φ = Ux`
2. **Source**: `ψ = (m/2π)θ`, `φ = (m/2π)ln(r)`
3. **Vortex**: `ψ = -(Γ/2π)ln(r)`, `φ = (Γ/2π)θ`
4. **Doublet**: `ψ = -(κsin(θ))/r`, `φ = (κcos(θ))/r`

### Viscous Flows
1. **Poiseuille Flow**: `u(y) = -(1/2μ)(dp/dx)(y² - h²)`
2. **Couette Flow**: `u(y) = U(y/b) + (1/2μ)(dp/dx)(y² - by)`

## Usage

### Running the Application
1. Open `index.html` in a web browser
2. Or serve via Python's HTTP server:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`

### Controls
- **Flow Type**: Select from dropdown menu
- **Visualization Mode**: Choose how to display the flow
- **Parameters**: Adjust flow-specific parameters with sliders
- **Time Controls**: Play/pause animation and adjust time step
- **View Options**: Toggle grid, boundaries, and probe tool

### Keyboard Shortcuts
- `Space`: Toggle play/pause
- `Ctrl+R`: Reset simulation
- `Ctrl+S`: Export configuration

### Custom Equations
For the Custom Flow type, enter velocity equations in the format:
```
u = sin(x) * cos(y)
v = -cos(x) * sin(y)
```

Supported functions: `sin`, `cos`, `tan`, `exp`, `log`, `sqrt`
Variables: `x`, `y`, `t` (time)
Constants: `pi`

## Technical Implementation

### Architecture
- **HTML5 Canvas** for high-performance rendering
- **Vanilla JavaScript** (no dependencies)
- **Real-time computation** using numerical methods
- **Responsive design** with modern CSS

### Performance Optimization
- Efficient grid-based field computation
- Adaptive quality settings
- Canvas-based rendering with device pixel ratio support
- Streamlined mathematical operations

### Browser Compatibility
- Modern browsers supporting HTML5 Canvas
- ES6+ JavaScript features
- WebGL not required (uses 2D canvas context)

## File Structure

```
gen4/
├── index.html              # Main HTML file
├── styles.css             # UI styling
├── js/
│   ├── main.js           # Application entry point
│   ├── simulation.js     # Main simulation engine
│   ├── flows.js          # Flow field implementations
│   ├── visualization.js  # Rendering and visualization
│   ├── ui.js            # User interface controller
│   └── math.js          # Mathematical utilities
└── README.md            # This file
```

## Educational Applications

This simulation is designed for:
- **Fluid Mechanics Courses** - Visualizing theoretical concepts
- **Engineering Education** - Understanding practical flow scenarios
- **Research Visualization** - Exploring flow patterns and behavior
- **Interactive Learning** - Hands-on experimentation with parameters

## Key Concepts Demonstrated

1. **Potential Flow Theory** - Superposition of elementary flows
2. **Viscous Flow Solutions** - Exact analytical solutions
3. **Flow Visualization** - Multiple representation methods
4. **Boundary Conditions** - No-slip, free-slip, and wall effects
5. **Conservation Laws** - Mass and momentum conservation
6. **Vorticity and Circulation** - Rotational flow characteristics

## Limitations

- 2D flow visualization only
- Steady-state solutions (some time-dependent for animation)
- Simplified boundary conditions
- No turbulence modeling
- Incompressible flow assumption for most cases

## Future Enhancements

- 3D flow visualization
- Particle tracking
- Turbulence models
- Compressible flow effects
- Heat transfer coupling
- Import/export of experimental data

## References

Based on classical fluid mechanics principles from:
- White, F.M. "Fluid Mechanics"
- Anderson, J.D. "Fundamentals of Aerodynamics"
- Kundu, P.K. "Fluid Mechanics"

## License

This project is provided for educational purposes. Feel free to modify and distribute for non-commercial use.